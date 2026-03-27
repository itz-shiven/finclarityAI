import os
import requests
from datetime import datetime, timezone
from uuid import uuid4
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
from werkzeug.exceptions import HTTPException

# Import the chat blueprint containing your AI logic
from chat import chat_bp

load_dotenv(override=True)

# -------------------------
# SUPABASE SETUP
# -------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Supabase env variables missing")

# Use Service Role Key if available for administrative tasks (bypasses RLS)
backend_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
supabase: Client = create_client(SUPABASE_URL, backend_key)

app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY", "change-this-in-production")
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# -------------------------
# REGISTER BLUEPRINTS
# -------------------------
app.register_blueprint(chat_bp)

# -------------------------
# SECURE CORS SETUP
# -------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:5000",
    "http://localhost:5000",
    "https://finclarityai.onrender.com",
    "https://finclarityai-giqz.onrender.com"
]

CORS(app, supports_credentials=True, origins=ALLOWED_ORIGINS)

# -------------------------
# GLOBAL ERROR HANDLER
# -------------------------
@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({
            "status": "error",
            "message": e.description
        }), e.code

    import traceback
    print("🚨 [GLOBAL CRASH CATCHER] An error occurred:")
    traceback.print_exc() 
    
    return jsonify({
        "status": "error",
        "message": "An unexpected server error occurred. Our team has been notified."
    }), 500

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}


def default_finance_data():
    return {
        "todos": [],
        "goals": [],
        "expenses": []
    }


def _extract_chat_and_finance(raw_chats):
    if isinstance(raw_chats, dict):
        chat_history = raw_chats.get("chat_history")
        finance_data = raw_chats.get("finance_data")
        if not isinstance(chat_history, list):
            chat_history = []
        if not isinstance(finance_data, dict):
            finance_data = default_finance_data()
        else:
            base = default_finance_data()
            for key in base:
                if isinstance(finance_data.get(key), list):
                    base[key] = finance_data[key]
            finance_data = base
        return chat_history, finance_data

    if isinstance(raw_chats, list):
        return raw_chats, default_finance_data()

    return [], default_finance_data()


def _build_chats_payload(chat_history, finance_data):
    return {
        "chat_history": chat_history if isinstance(chat_history, list) else [],
        "finance_data": finance_data if isinstance(finance_data, dict) else default_finance_data()
    }


def _get_user_data_row(user_id):
    res = supabase.table("user_data").select("chats, memory").eq("user_id", user_id).execute()
    if res.data:
        return res.data[0]
    supabase.table("user_data").insert({
        "user_id": user_id,
        "chats": _build_chats_payload([], default_finance_data()),
        "memory": []
    }).execute()
    return {"chats": [], "memory": []}


def _get_finance_data_for_user(user_id):
    row = _get_user_data_row(user_id)
    _, finance_data = _extract_chat_and_finance(row.get("chats"))
    return finance_data


def _save_finance_data_for_user(user_id, finance_data):
    row = _get_user_data_row(user_id)
    chat_history, _ = _extract_chat_and_finance(row.get("chats"))
    payload = _build_chats_payload(chat_history, finance_data)
    update_res = supabase.table("user_data").update({"chats": payload}).eq("user_id", user_id).execute()
    if not update_res.data:
        supabase.table("user_data").insert({
            "user_id": user_id,
            "chats": payload,
            "memory": []
        }).execute()

# -------------------------
# ROUTES
# -------------------------
@app.route("/", methods=["GET", "HEAD"])
def home():
    if request.method == "HEAD":
        return "", 200
    return render_template("index.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/dashboard")
def dashboard():
    if 'user_id' not in session and 'is_guest' not in session:
        return redirect(url_for('login_page'))

    username = session.get("user_name", "User")
    return render_template(
        "dashboard.html",
        username=username
    )

# -------------------------
# SIGNUP API
# -------------------------
@app.route("/api/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")

        if not name or not email or not password:
            return jsonify({"status": "error", "message": "Missing required fields"})

        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "full_name": name
                }
            }
        })
        
        return jsonify({"status": "success"})

    except Exception as e:
        import traceback
        traceback.print_exc()
        error_msg = str(e)
        print(f"[ERROR] ACTUAL VAULT ERROR: {error_msg}")
        
        if "already registered" in error_msg.lower() or "user already exists" in error_msg.lower():
            return jsonify({"status": "exists", "message": "User already exists."})
            
        return jsonify({"status": "error", "message": f"Auth error: {error_msg}"})

# -------------------------
# LOGIN API
# -------------------------
@app.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"status": "error", "message": "Missing email or password"})

        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        user = response.user
        session['user_id'] = user.id
        session['user_email'] = user.email
        session['user_name'] = user.user_metadata.get('full_name', 'User')

        ensure_user_data(user.id, user.email, session['user_name'])

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })

    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] LOGIN FAILURE for {email}: {error_msg}")
        
        try:
            check_signup = supabase.auth.sign_up({"email": email, "password": "DummyPassword123!"})
        except Exception as signup_err:
            if "already registered" in str(signup_err).lower():
                return jsonify({
                    "status": "fail", 
                    "message": f"Account exists. If you previously signed in via Google, please use the 'Login with Google' button, then set your password in Profile Settings."
                })
            
        return jsonify({
            "status": "fail", 
            "message": "Invalid credentials or user not found"
        })

# -------------------------
# GOOGLE LOGIN API
# -------------------------
@app.route("/api/google-login", methods=["POST"])
def google_login():
    try:
        data = request.get_json()
        user_id = data.get("id")
        user_name = data.get("name")
        user_email = data.get("email")

        if not user_email or not user_id:
            return jsonify({"status": "error", "message": "User data missing"})

        session['user_id'] = user_id
        session['user_name'] = user_name or "Google User"
        session['user_email'] = user_email
        
        ensure_user_data(user_id, user_email, session['user_name'])
        
        print(f"DEBUG: Session successfully created for {user_email}!")

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })

    except Exception as e:
        print(f"🚨 GOOGLE LOGIN ERROR: {str(e)}")
        return jsonify({"status": "error", "message": str(e)})

@app.route("/api/user", methods=["GET"])
def get_user():
    if 'user_id' in session:
        return jsonify({
            "status": "success",
            "user": {
                "id": session.get('user_id'),
                "name": session.get('user_name'),
                "email": session.get('user_email'),
                "isGuest": False
            }
        })
    elif 'is_guest' in session:
        return jsonify({
            "status": "success",
            "user": {
                "id": None,
                "name": "Guest",
                "email": None,
                "isGuest": True
            }
        })

    return jsonify({"status": "error", "message": "Not logged in"}), 401

# -------------------------
# USER DATA PERSISTENCE (CHATS/MEMORY)
# -------------------------
def ensure_user_data(user_id, email, name):
    try:
        res = supabase.table("user_data").select("user_id").eq("user_id", user_id).execute()
        if not res.data:
            supabase.table("user_data").insert({
                "user_id": user_id,
                "chats": _build_chats_payload([], default_finance_data()),
                "memory": []
            }).execute()
            print(f"[DATABASE] Created new user_data row for ID: {user_id}")
    except Exception as e:
        print(f"[ERROR] ensure_user_data failed: {str(e)}")

@app.route("/api/sync_userdata", methods=["POST"])
def sync_userdata():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        chats = data.get("chats")
        memory = data.get("memory")
        finance_data = data.get("finance_data")
        
        update_data = {}
        row = _get_user_data_row(session['user_id'])
        current_chat_history, current_finance_data = _extract_chat_and_finance(row.get("chats"))
        if chats is not None:
            current_chat_history = chats if isinstance(chats, list) else []
        if finance_data is not None and isinstance(finance_data, dict):
            merged_finance = default_finance_data()
            for key in merged_finance:
                if isinstance(finance_data.get(key), list):
                    merged_finance[key] = finance_data[key]
                else:
                    merged_finance[key] = current_finance_data.get(key, [])
            current_finance_data = merged_finance

        if chats is not None or finance_data is not None:
            update_data["chats"] = _build_chats_payload(current_chat_history, current_finance_data)
        if memory is not None:
            update_data["memory"] = memory
        
        if update_data:
            supabase.table("user_data").update(update_data).eq("user_id", session['user_id']).execute()
            
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"🚨 SYNC ERROR: {str(e)}")
        return jsonify({"status": "error", "message": str(e)})

@app.route("/api/get_userdata", methods=["GET"])
def get_userdata():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    
    res = supabase.table("user_data").select("chats, memory").eq("user_id", session['user_id']).execute()
    
    if res.data:
        chats, finance_data = _extract_chat_and_finance(res.data[0].get("chats"))
        return jsonify({
            "status": "success",
            "data": {
                "chats": chats,
                "memory": res.data[0].get("memory", []),
                "finance_data": finance_data
            }
        })
        
    return jsonify({
        "status": "success",
        "data": {
            "chats": [],
            "memory": [],
            "finance_data": default_finance_data()
        }
    })


@app.route("/api/finance_data", methods=["GET"])
def get_finance_data():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    ensure_user_data(session['user_id'], session.get('user_email'), session.get('user_name'))
    finance_data = _get_finance_data_for_user(session['user_id'])
    return jsonify({"status": "success", "data": finance_data})


@app.route("/api/finance_todos", methods=["POST"])
def create_finance_todo():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    notes = (data.get("notes") or "").strip()
    due_date = (data.get("dueDate") or "").strip()

    if not title:
        return jsonify({"status": "error", "message": "Task title is required"}), 400

    finance_data = _get_finance_data_for_user(session['user_id'])
    task = {
        "id": str(uuid4()),
        "title": title,
        "notes": notes,
        "dueDate": due_date,
        "completed": bool(data.get("completed", False)),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    finance_data["todos"].append(task)
    _save_finance_data_for_user(session['user_id'], finance_data)

    return jsonify({"status": "success", "task": task, "data": finance_data})


@app.route("/api/finance_todos/<task_id>", methods=["PUT"])
def update_finance_todo(task_id):
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.get_json() or {}
    finance_data = _get_finance_data_for_user(session['user_id'])

    updated_task = None
    for task in finance_data["todos"]:
        if task.get("id") == task_id:
            if "title" in data:
                task["title"] = (data.get("title") or "").strip() or task.get("title", "Untitled Task")
            if "notes" in data:
                task["notes"] = (data.get("notes") or "").strip()
            if "dueDate" in data:
                task["dueDate"] = (data.get("dueDate") or "").strip()
            if "completed" in data:
                task["completed"] = bool(data.get("completed"))
            task["updatedAt"] = datetime.now(timezone.utc).isoformat()
            updated_task = task
            break

    if not updated_task:
        return jsonify({"status": "error", "message": "Task not found"}), 404

    _save_finance_data_for_user(session['user_id'], finance_data)
    return jsonify({"status": "success", "task": updated_task, "data": finance_data})


@app.route("/api/finance_todos/<task_id>", methods=["DELETE"])
def delete_finance_todo(task_id):
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    finance_data = _get_finance_data_for_user(session['user_id'])
    original_count = len(finance_data["todos"])
    finance_data["todos"] = [task for task in finance_data["todos"] if task.get("id") != task_id]

    if len(finance_data["todos"]) == original_count:
        return jsonify({"status": "error", "message": "Task not found"}), 404

    _save_finance_data_for_user(session['user_id'], finance_data)
    return jsonify({"status": "success", "data": finance_data})


@app.route("/api/finance_data", methods=["PUT"])
def update_finance_data():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    payload = request.get_json() or {}
    finance_data = _get_finance_data_for_user(session['user_id'])

    for key in ["goals", "expenses", "todos"]:
        if key in payload and isinstance(payload.get(key), list):
            finance_data[key] = payload[key]

    _save_finance_data_for_user(session['user_id'], finance_data)
    return jsonify({"status": "success", "data": finance_data})

@app.route("/api/guest-login", methods=["POST"])
def guest_login():
        session['is_guest'] = True
        session['user_name'] = 'Guest'

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })
    
@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "success"})

@app.route("/update_profile", methods=["POST"])
def update_profile():
    if 'user_id' not in session and 'is_guest' not in session:
        return jsonify({"status": "error", "message": "Not authenticated"}), 401

    if session.get('is_guest'):
        return jsonify({"status": "error", "message": "Guest accounts cannot update profile"})

    try:
        payload = request.get_json() or {}
        new_name = (payload.get("name") or "").strip()
        new_email = (payload.get("email") or "").strip()

        if not new_name and not new_email:
            return jsonify({"status": "error", "message": "Name or email cannot be empty."}), 400

        update_payload = {}
        if new_email:
            update_payload["email"] = new_email

        metadata = {}
        if new_name:
            metadata["full_name"] = new_name
        if metadata:
            update_payload["user_metadata"] = metadata

        if not update_payload:
            return jsonify({"status": "error", "message": "Nothing to update."}), 400

        supabase.auth.admin.update_user(session['user_id'], update_payload)

        if new_name:
            session['user_name'] = new_name
        if new_email:
            session['user_email'] = new_email

        return jsonify({
            "status": "success",
            "name": session['user_name'],
            "email": session['user_email']
        })
    except Exception as e:
        print(f"[UPDATE PROFILE ERROR] {str(e)}")
        return jsonify({"status": "error", "message": str(e)})

@app.route("/change_password", methods=["POST"])
def change_password():
    if 'user_id' not in session and 'is_guest' not in session:
        return jsonify({"status": "error", "message": "Not authenticated"}), 401

    if session.get('is_guest'):
        return jsonify({"status": "error", "message": "Guest accounts cannot change password"})

    try:
        return jsonify({"status": "error", "message": "Please change password via the account settings (Supabase Auth)."})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route("/logout", methods=["GET", "POST"])
def page_logout():
    session.clear()
    return redirect(url_for('login_page'))

# -------------------------
# RUN SERVER
# -------------------------
if __name__ == "__main__":
    import os
    # Render dynamic port assignment
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
