import os
import requests
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USER_DATA_DIR = os.path.join(BASE_DIR, "user_data")
os.makedirs(USER_DATA_DIR, exist_ok=True)

app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY", "change-this-in-production")
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False
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
    "[http://127.0.0.1:5000](http://127.0.0.1:5000)",       
    "http://localhost:5000",       
    "[https://your-future-domain.com](https://your-future-domain.com)" 
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
                "chats": [],
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
        
        update_data = {}
        if chats is not None: update_data["chats"] = chats
        if memory is not None: update_data["memory"] = memory
        
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
        return jsonify({
            "status": "success",
            "data": res.data[0]
        })
        
    return jsonify({"status": "success", "data": {"chats": [], "memory": []}})

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

@app.route("/api/what_changed", methods=["GET"])
def get_what_changed():
    if 'user_id' not in session:
        return jsonify({
            "status": "success",
            "updates": [
                {
                    "date": "March 21, 2024",
                    "title": "HDFC Home Loan Rates",
                    "badge": "Update",
                    "badgeClass": "badge-update",
                    "oldVal": "8.75%",
                    "newVal": "8.40%",
                    "desc": "New Repo-linked rates applied to existing floating loans."
                },
                {
                    "date": "March 18, 2024",
                    "title": "Axis Bank Policy Shift",
                    "badge": "Alert",
                    "badgeClass": "badge-alert",
                    "oldVal": "Unlimited Lounge",
                    "newVal": "₹50k Spend Filter",
                    "desc": "Airport lounge access now requires a minimum spend of ₹50,000 in previous quarter."
                },
                {
                    "date": "March 15, 2024",
                    "title": "Gold ETF Inflows",
                    "badge": "Info",
                    "badgeClass": "badge-info",
                    "oldVal": "Neutral",
                    "newVal": "Bullish",
                    "desc": "Market analysts suggest increasing allocation to Gold due to global uncertainty."
                }
            ]
        })

    user_id = session['user_id']
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/user_data",
            headers=HEADERS,
            params={"user_id": f"eq.{user_id}"}
        )
        
        memory = []
        if response.status_code == 200:
            rows = response.json()
            if rows:
                memory = rows[0].get("memory", [])
        
        all_updates = [
            {
                "keywords": ["SBI", "card", "credit"],
                "date": "March 22, 2024",
                "title": "SBI Card Reward Update",
                "badge": "Update",
                "badgeClass": "badge-update",
                "oldVal": "10x Points",
                "newVal": "5x Points",
                "desc": "SBI Card has revised reward points on online rent payments."
            },
            {
                "keywords": ["HDFC", "loan", "home"],
                "date": "March 21, 2024",
                "title": "HDFC Home Loan Rates",
                "badge": "Update",
                "badgeClass": "badge-update",
                "oldVal": "8.75%",
                "newVal": "8.40%",
                "desc": "New Repo-linked rates applied to existing floating loans."
            },
            {
                "keywords": ["Axis", "card", "lounge"],
                "date": "March 18, 2024",
                "title": "Axis Bank Policy Shift",
                "badge": "Alert",
                "badgeClass": "badge-alert",
                "oldVal": "Unlimited Lounge",
                "newVal": "₹50k Spend Filter",
                "desc": "Airport lounge access now requires a minimum spend of ₹50,000 in previous quarter."
            },
            {
                "keywords": ["Gold", "ETF", "invest"],
                "date": "March 15, 2024",
                "title": "Gold ETF Inflows",
                "badge": "Info",
                "badgeClass": "badge-info",
                "oldVal": "Neutral",
                "newVal": "Bullish",
                "desc": "Market analysts suggest increasing allocation to Gold due to global uncertainty."
            },
            {
                "keywords": ["Crypto", "tax", "TDS"],
                "date": "March 12, 2024",
                "title": "Crypto TDS Reminder",
                "badge": "Alert",
                "badgeClass": "badge-alert",
                "oldVal": "N/A",
                "newVal": "1% TDS",
                "desc": "Reminder to ensure all VDA trades are reported for 1% TDS compliance."
            }
        ]

        personalized = []
        interests = " ".join(memory).lower()
        
        for up in all_updates:
            if any(kw.lower() in interests for kw in up["keywords"]):
                personalized.append(up)

        if not personalized:
            personalized = all_updates[:3]

        return jsonify({
            "status": "success",
            "updates": personalized
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route("/update_profile", methods=["POST"])
def update_profile():
    if 'user_id' not in session and 'is_guest' not in session:
        return jsonify({"status": "error", "message": "Not authenticated"}), 401

    if session.get('is_guest'):
        return jsonify({"status": "error", "message": "Guest accounts cannot update profile"})

    try:
        data = request.get_json()
        new_name = data.get("name")
        new_email = data.get("email")

        session['user_name'] = new_name
        session['user_email'] = new_email
        
        return jsonify({"status": "success"})
    except Exception as e:
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
    app.run(debug=True)