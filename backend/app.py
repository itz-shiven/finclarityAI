import os
import json
import requests
from datetime import datetime, timezone
from uuid import uuid4
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client
from werkzeug.exceptions import HTTPException
import stripe

# Import the chat blueprint containing your AI logic
from chat import chat_bp

load_dotenv(override=True)


def _clean_env(name, default=None):
    value = os.getenv(name, default)
    if not isinstance(value, str):
        return value
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1].strip()
    return value

# -------------------------
# SUPABASE SETUP
# -------------------------
SUPABASE_URL = _clean_env("SUPABASE_URL")
SUPABASE_KEY = _clean_env("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = _clean_env("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = _clean_env("OPENAI_API_KEY")
TODO_SUGGEST_MODEL = _clean_env("TODO_SUGGEST_MODEL", "gpt-4o-mini")
STRIPE_SECRET_KEY = _clean_env("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = _clean_env("STRIPE_WEBHOOK_SECRET")
STRIPE_SAMPLE_PLACEHOLDER_KEY_SUFFIXES = (
    "ZZ796th88S4VQ2u",
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Supabase env variables missing")

# Use Service Role Key if available for administrative tasks (bypasses RLS)
backend_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
supabase: Client = create_client(SUPABASE_URL, backend_key)
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
stripe.api_key = STRIPE_SECRET_KEY

app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY", "change-this-in-production")
app.config['SESSION_COOKIE_HTTPONLY'] = True
# Only require SECURE in production (HTTPS), allow HTTP for localhost
app.config['SESSION_COOKIE_SECURE'] = not os.getenv("FLASK_ENV") == "development"
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
# Increase session timeout to 30 days
app.config['PERMANENT_SESSION_LIFETIME'] = 2592000

@app.before_request
def make_session_permanent():
    session.permanent = True

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

]

CORS(app, supports_credentials=True, origins=ALLOWED_ORIGINS)

# -------------------------
# DISABLE CACHING FOR ALL RESPONSES
# -------------------------
@app.after_request
def disable_cache(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, public, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

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
        "aiSuggestions": [],
        "goals": [],
        "expenses": []
    }


def default_subscription_data():
    return {
        "plan": "free",
        "status": "inactive",
        "selected_chat_mode": "free",
        "premium_activated_at": None,
        "premium_checkout_session_id": None,
        "premium_payment_status": None
    }


def _fallback_todo_suggestion(task):
    title = (task.get("title") or "Financial Task").strip()
    due_date = (task.get("dueDate") or "").strip()
    notes = (task.get("notes") or "").strip()
    due_text = f" before {due_date}" if due_date else ""
    notes_text = f" Consider this context: {notes}" if notes else ""

    return {
        "taskId": task.get("id"),
        "title": f"AI Plan: {title}",
        "priority": "Quick Win",
        "tip": f"Turn \"{title}\" into one focused money action{due_text}.{notes_text}".strip(),
        "steps": [
            f"Define the exact action needed to complete \"{title}\".",
            "Block a short time slot and gather any required account details first.",
            "Complete the action and mark the task done immediately after."
        ],
        "source": "fallback"
    }


def _generate_ai_suggestion_for_task(task):
    if not openai_client:
        return _fallback_todo_suggestion(task)

    task_payload = {
        "title": task.get("title", ""),
        "dueDate": task.get("dueDate", ""),
        "notes": task.get("notes", "")
    }

    try:
        response = openai_client.chat.completions.create(
            model=TODO_SUGGEST_MODEL,
            temperature=0.2,
            max_tokens=300,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You turn a financial to-do into one concise smart suggestion card. "
                        "Return strict JSON with keys: title, priority, tip, steps. "
                        "priority must be either 'High' or 'Quick Win'. "
                        "steps must be an array of exactly 3 short action steps."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        "Create a refined smart suggestion for this financial task:\n"
                        f"{json.dumps(task_payload)}"
                    )
                }
            ]
        )

        content = (response.choices[0].message.content or "").strip()
        parsed = json.loads(content)
        steps = parsed.get("steps") if isinstance(parsed.get("steps"), list) else []
        cleaned_steps = [str(step).strip() for step in steps if str(step).strip()][:3]

        if not parsed.get("title") or not parsed.get("tip") or len(cleaned_steps) != 3:
            raise ValueError("Incomplete AI suggestion payload")

        priority = parsed.get("priority")
        if priority not in {"High", "Quick Win"}:
            priority = "Quick Win"

        return {
            "taskId": task.get("id"),
            "title": str(parsed.get("title")).strip(),
            "priority": priority,
            "tip": str(parsed.get("tip")).strip(),
            "steps": cleaned_steps,
            "source": "ai"
        }
    except Exception as exc:
        print(f"[TODO SUGGESTION] AI generation failed: {exc}")
        return _fallback_todo_suggestion(task)


def _replace_task_suggestion(finance_data, suggestion):
    finance_data["aiSuggestions"] = [
        item for item in finance_data.get("aiSuggestions", [])
        if item.get("taskId") != suggestion.get("taskId")
    ]
    finance_data["aiSuggestions"].insert(0, suggestion)
    finance_data["aiSuggestions"] = finance_data["aiSuggestions"][:1]


def _normalize_subscription_data(raw_subscription):
    base = default_subscription_data()
    if not isinstance(raw_subscription, dict):
        return base

    plan = str(raw_subscription.get("plan") or "free").lower()
    status = str(raw_subscription.get("status") or "inactive").lower()
    selected_chat_mode = str(raw_subscription.get("selected_chat_mode") or "free").lower()

    base["plan"] = "premium" if plan == "premium" else "free"
    base["status"] = "active" if status == "active" and base["plan"] == "premium" else "inactive"
    base["selected_chat_mode"] = "pro" if selected_chat_mode == "pro" and base["plan"] == "premium" else "free"
    base["premium_activated_at"] = raw_subscription.get("premium_activated_at")
    base["premium_checkout_session_id"] = raw_subscription.get("premium_checkout_session_id")
    base["premium_payment_status"] = raw_subscription.get("premium_payment_status")
    return base


def _extract_chat_finance_and_subscription(raw_chats):
    if isinstance(raw_chats, dict):
        chat_history = raw_chats.get("chat_history")
        finance_data = raw_chats.get("finance_data")
        subscription = _normalize_subscription_data(raw_chats.get("subscription"))
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
        return chat_history, finance_data, subscription

    if isinstance(raw_chats, list):
        return raw_chats, default_finance_data(), default_subscription_data()

    return [], default_finance_data(), default_subscription_data()


def _build_chats_payload(chat_history, finance_data, subscription=None):
    return {
        "chat_history": chat_history if isinstance(chat_history, list) else [],
        "finance_data": finance_data if isinstance(finance_data, dict) else default_finance_data(),
        "subscription": _normalize_subscription_data(subscription)
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
    _, finance_data, _ = _extract_chat_finance_and_subscription(row.get("chats"))
    return finance_data


def _save_finance_data_for_user(user_id, finance_data):
    row = _get_user_data_row(user_id)
    chat_history, _, subscription = _extract_chat_finance_and_subscription(row.get("chats"))
    payload = _build_chats_payload(chat_history, finance_data, subscription)
    update_res = supabase.table("user_data").update({"chats": payload}).eq("user_id", user_id).execute()
    if not update_res.data:
        supabase.table("user_data").insert({
            "user_id": user_id,
            "chats": payload,
            "memory": []
        }).execute()


def _get_subscription_for_user(user_id):
    row = _get_user_data_row(user_id)
    _, _, subscription = _extract_chat_finance_and_subscription(row.get("chats"))
    return subscription


def _persist_subscription_metadata_for_user(user_id, subscription):
    normalized = _normalize_subscription_data(subscription)
    try:
        supabase.auth.admin.update_user_by_id(user_id, {
            "user_metadata": {
                "plan": normalized.get("plan", "free"),
                "subscription_status": normalized.get("status", "inactive"),
                "selected_chat_mode": normalized.get("selected_chat_mode", "free"),
                "is_premium": _is_premium_subscription(normalized),
                "premium_activated_at": normalized.get("premium_activated_at"),
                "premium_checkout_session_id": normalized.get("premium_checkout_session_id"),
                "premium_payment_status": normalized.get("premium_payment_status")
            }
        })
    except Exception as exc:
        print(f"[SUBSCRIPTION METADATA SAVE ERROR] {exc}")


def _save_subscription_for_user(user_id, subscription):
    row = _get_user_data_row(user_id)
    chat_history, finance_data, _ = _extract_chat_finance_and_subscription(row.get("chats"))
    payload = _build_chats_payload(chat_history, finance_data, subscription)
    update_res = supabase.table("user_data").update({"chats": payload}).eq("user_id", user_id).execute()
    if not update_res.data:
        supabase.table("user_data").insert({
            "user_id": user_id,
            "chats": payload,
            "memory": []
        }).execute()
    _persist_subscription_metadata_for_user(user_id, subscription)


def _is_premium_subscription(subscription):
    return (
        isinstance(subscription, dict)
        and subscription.get("plan") == "premium"
        and subscription.get("status") == "active"
    )


def _activate_premium_subscription_for_user(user_id, checkout_session=None):
    subscription = _get_subscription_for_user(user_id)
    subscription.update({
        "plan": "premium",
        "status": "active",
        "selected_chat_mode": "pro",
        "premium_activated_at": datetime.now(timezone.utc).isoformat(),
        "premium_checkout_session_id": checkout_session.id if checkout_session else subscription.get("premium_checkout_session_id"),
        "premium_payment_status": getattr(checkout_session, "payment_status", None) if checkout_session else "paid"
    })
    _save_subscription_for_user(user_id, subscription)
    return subscription


def _set_free_subscription_for_user(user_id):
    subscription = _get_subscription_for_user(user_id)
    subscription.update({
        "plan": "free",
        "status": "inactive",
        "selected_chat_mode": "free",
        "premium_payment_status": subscription.get("premium_payment_status") or "free"
    })
    _save_subscription_for_user(user_id, subscription)
    return subscription


def _mark_checkout_session_for_user(user_id, checkout_session_id):
    subscription = _get_subscription_for_user(user_id)
    subscription.update({
        "premium_checkout_session_id": checkout_session_id,
        "premium_payment_status": "pending"
    })
    _save_subscription_for_user(user_id, subscription)
    return subscription


def _safe_object_get(value, key, default=None):
    if value is None:
        return default
    if isinstance(value, dict):
        return value.get(key, default)
    try:
        return getattr(value, key)
    except Exception:
        pass
    try:
        return value[key]
    except Exception:
        return default


def _verify_and_activate_checkout_session_for_user(user_id, checkout_session_id=None, user_email=None):
    subscription = _get_subscription_for_user(user_id)
    target_session_id = checkout_session_id or subscription.get("premium_checkout_session_id")
    if not target_session_id or not stripe.api_key:
        return False, "missing_session"

    checkout_session = stripe.checkout.Session.retrieve(target_session_id)
    if not checkout_session:
        return False, "missing_checkout_session"

    payment_status = str(_safe_object_get(checkout_session, "payment_status", "") or "").lower()
    checkout_status = str(_safe_object_get(checkout_session, "status", "") or "").lower()
    is_paid_or_complete = payment_status == "paid" or checkout_status == "complete"
    if not is_paid_or_complete:
        return False, f"payment_status_{payment_status or 'unknown'}__checkout_status_{checkout_status or 'unknown'}"

    metadata = _safe_object_get(checkout_session, "metadata", {}) or {}
    metadata_user_id = _safe_object_get(metadata, "user_id")
    saved_session_id = subscription.get("premium_checkout_session_id")
    checkout_session_id_value = _safe_object_get(checkout_session, "id")
    session_matches = saved_session_id and str(checkout_session_id_value) == str(saved_session_id)

    customer_details = _safe_object_get(checkout_session, "customer_details", None)
    customer_email = _safe_object_get(customer_details, "email")

    pending_session_id = session.get("pending_checkout_session_id")
    pending_session_matches = bool(
        pending_session_id and str(pending_session_id) == str(checkout_session_id_value)
    )
    email_matches = bool(
        user_email
        and customer_email
        and str(user_email).strip().lower() == str(customer_email).strip().lower()
    )

    print(
        "[STRIPE VERIFY DEBUG]",
        json.dumps({
            "target_session_id": str(target_session_id),
            "checkout_session_id": str(checkout_session_id_value),
            "payment_status": payment_status,
            "checkout_status": checkout_status,
            "metadata_user_id": metadata_user_id,
            "expected_user_id": user_id,
            "saved_session_id": saved_session_id,
            "pending_session_id": pending_session_id,
            "customer_email": customer_email,
            "expected_email": user_email,
            "session_matches": bool(session_matches),
            "pending_session_matches": pending_session_matches,
            "email_matches": email_matches
        })
    )

    if metadata_user_id == user_id or session_matches or pending_session_matches or email_matches:
        _activate_premium_subscription_for_user(user_id, checkout_session)
        session.pop("pending_checkout_session_id", None)
        return True, "activated"

    return False, "identity_mismatch"

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
    payment_status = request.args.get("payment_status")
    payment_message = request.args.get("payment_message")
    session_id = request.args.get("session_id")

    if 'user_id' in session and session_id and not payment_status:
        payment_status = "pending"
        payment_message = "We could not verify your payment yet."
        try:
            verified, reason = _verify_and_activate_checkout_session_for_user(
                session['user_id'],
                session_id,
                session.get('user_email')
            )
            if verified:
                payment_status = "success"
                payment_message = "Your Premium test payment was verified and your account is now upgraded."
            else:
                payment_message = f"Payment verification failed for this session ({reason})."
        except Exception as exc:
            print(f"[DASHBOARD STRIPE VERIFY ERROR] {exc}")

    elif 'user_id' in session:
        try:
            verified, _ = _verify_and_activate_checkout_session_for_user(
                session['user_id'],
                None,
                session.get('user_email')
            )
            if verified:
                payment_status = payment_status or "success"
                payment_message = payment_message or "Your Premium plan is active."
        except Exception as exc:
            print(f"[DASHBOARD SUBSCRIPTION REFRESH ERROR] {exc}")

    return render_template(
        "dashboard.html",
        username=username,
        payment_status=payment_status,
        payment_message=payment_message
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
# SOCIAL LOGIN SYNC API (Google/Microsoft)
# -------------------------
@app.route("/api/social-login", methods=["POST"])
def social_login():
    try:
        data = request.get_json()
        user_id = data.get("id")
        user_name = data.get("name")
        user_email = data.get("email")
        provider = data.get("provider", "Social")

        print(f"[SOCIAL LOGIN] Provider: {provider}, ID: {user_id}, Email: {user_email}, Name: {user_name}")

        if not user_id:
            return jsonify({"status": "error", "message": "User ID missing"})

        # Email might be missing from some providers (Facebook)
        if not user_email:
            user_email = f"{provider}_{user_id}@finclarityai.local"
            print(f"[SOCIAL LOGIN] Email generated: {user_email}")

        session['user_id'] = user_id
        session['user_name'] = user_name or f"{provider} User"
        session['user_email'] = user_email
        
        print(f"[SOCIAL LOGIN] Session set for {user_email}")
        
        try:
            ensure_user_data(user_id, user_email, session['user_name'])
            print(f"✅ [SOCIAL LOGIN] User data ensured")
        except Exception as db_error:
            print(f"⚠️ [SOCIAL LOGIN] Database error (non-fatal): {str(db_error)}")
            # Continue anyway - session is set

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })

    except Exception as e:
        import traceback
        print(f"🚨 SOCIAL LOGIN ERROR: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)})

@app.route("/api/facebook-login", methods=["POST"])
def facebook_login():
    """Facebook login handler - just add provider and call unified handler"""
    try:
        data = request.get_json()
        data['provider'] = 'facebook'
        
        # Just handle it here directly
        user_id = data.get("id")
        user_name = data.get("name")
        user_email = data.get("email")
        
        print(f"[FACEBOOK LOGIN] ID: {user_id}, Email: {user_email}, Name: {user_name}")

        if not user_id:
            return jsonify({"status": "error", "message": "User ID missing"})

        # Email might be missing from Facebook
        if not user_email:
            user_email = f"facebook_{user_id}@finclarityai.local"
            print(f"[FACEBOOK LOGIN] Email generated: {user_email}")

        session['user_id'] = user_id
        session['user_name'] = user_name or "Facebook User"
        session['user_email'] = user_email
        
        print(f"[FACEBOOK LOGIN] Session set for {user_email}")
        
        try:
            ensure_user_data(user_id, user_email, session['user_name'])
            print(f"✅ [FACEBOOK LOGIN] User data ensured")
        except Exception as db_error:
            print(f"⚠️ [FACEBOOK LOGIN] Database error (non-fatal): {str(db_error)}")

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })
        
    except Exception as e:
        print(f"🚨 FACEBOOK LOGIN ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)})

@app.route("/api/user", methods=["GET"])
def get_user():
    if 'user_id' in session:
        subscription = _get_subscription_for_user(session.get('user_id'))
        return jsonify({
            "status": "success",
            "user": {
                "id": session.get('user_id'),
                "name": session.get('user_name'),
                "email": session.get('user_email'),
                "isGuest": False,
                "subscription": subscription,
                "plan": subscription.get("plan", "free"),
                "isPremium": _is_premium_subscription(subscription)
            }
        })
    elif 'is_guest' in session:
        return jsonify({
            "status": "success",
            "user": {
                "id": None,
                "name": "Guest",
                "email": None,
                "isGuest": True,
                "subscription": default_subscription_data(),
                "plan": "free",
                "isPremium": False
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
        subscription_data = data.get("subscription")
        
        update_data = {}
        row = _get_user_data_row(session['user_id'])
        current_chat_history, current_finance_data, current_subscription = _extract_chat_finance_and_subscription(row.get("chats"))
        if chats is not None:
            current_chat_history = chats if isinstance(chats, list) else []
        if finance_data is not None and isinstance(finance_data, dict):
            merged_finance = default_finance_data()
            for key in merged_finance:
                if isinstance(finance_data.get(key), list):
                    merged_finance[key] = finance_data[key]
                else:
                    merged_finance[key] = current_finance_data.get(key, [])
            if not _is_premium_subscription(current_subscription) and len(merged_finance.get("todos", [])) > 10:
                merged_finance["todos"] = merged_finance.get("todos", [])[:10]
            current_finance_data = merged_finance
        if subscription_data is not None and isinstance(subscription_data, dict):
            current_subscription = _normalize_subscription_data(subscription_data)

        if chats is not None or finance_data is not None or subscription_data is not None:
            update_data["chats"] = _build_chats_payload(current_chat_history, current_finance_data, current_subscription)
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
        chats, finance_data, subscription = _extract_chat_finance_and_subscription(res.data[0].get("chats"))
        return jsonify({
            "status": "success",
            "data": {
                "chats": chats,
                "memory": res.data[0].get("memory", []),
                "finance_data": finance_data,
                "subscription": subscription
            }
        })
        
    return jsonify({
        "status": "success",
        "data": {
            "chats": [],
            "memory": [],
            "finance_data": default_finance_data(),
            "subscription": default_subscription_data()
        }
    })


@app.route("/api/finance_data", methods=["GET"])
def get_finance_data():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    ensure_user_data(session['user_id'], session.get('user_email'), session.get('user_name'))
    finance_data = _get_finance_data_for_user(session['user_id'])
    return jsonify({"status": "success", "data": finance_data})


@app.route("/api/plan", methods=["GET"])
def get_plan():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    try:
        _verify_and_activate_checkout_session_for_user(
            session['user_id'],
            None,
            session.get('user_email')
        )
    except Exception as exc:
        print(f"[PLAN VERIFY ERROR] {exc}")

    subscription = _get_subscription_for_user(session['user_id'])
    return jsonify({
        "status": "success",
        "subscription": subscription,
        "plan": subscription.get("plan", "free"),
        "isPremium": _is_premium_subscription(subscription)
    })


@app.route("/api/debug-plan", methods=["GET"])
def debug_plan():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    user_id = session['user_id']

    try:
        _verify_and_activate_checkout_session_for_user(
            user_id,
            None,
            session.get('user_email')
        )
    except Exception as exc:
        print(f"[DEBUG PLAN VERIFY ERROR] {exc}")

    subscription = _get_subscription_for_user(user_id)
    user_data_row = _get_user_data_row(user_id)

    auth_user = None
    auth_metadata = {}
    auth_email = session.get('user_email')
    try:
        auth_response = supabase.auth.admin.get_user_by_id(user_id)
        auth_user = getattr(auth_response, "user", None) or (
            auth_response.get("user") if isinstance(auth_response, dict) else None
        )
        if auth_user:
            auth_metadata = getattr(auth_user, "user_metadata", None) or (
                auth_user.get("user_metadata", {}) if isinstance(auth_user, dict) else {}
            ) or {}
            auth_email = getattr(auth_user, "email", None) or (
                auth_user.get("email") if isinstance(auth_user, dict) else auth_email
            )
    except Exception as exc:
        print(f"[DEBUG PLAN AUTH FETCH ERROR] {exc}")

    return jsonify({
        "status": "success",
        "debug": {
            "session": {
                "user_id": user_id,
                "user_email": session.get('user_email'),
                "pending_checkout_session_id": session.get("pending_checkout_session_id")
            },
            "user_data_subscription": subscription,
            "user_data_chats": user_data_row.get("chats"),
            "auth_user": {
                "email": auth_email,
                "user_metadata": auth_metadata
            },
            "derived": {
                "plan": subscription.get("plan", "free"),
                "isPremium": _is_premium_subscription(subscription)
            }
        }
    })


@app.route("/api/plan/select", methods=["POST"])
def select_plan_mode():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    payload = request.get_json() or {}
    requested_plan = str(payload.get("plan") or "").lower()
    requested_mode = str(payload.get("mode") or "free").lower()

    if requested_plan == "free":
        subscription = _set_free_subscription_for_user(session['user_id'])
        return jsonify({
            "status": "success",
            "subscription": subscription,
            "plan": subscription.get("plan", "free"),
            "isPremium": _is_premium_subscription(subscription)
        })

    subscription = _get_subscription_for_user(session['user_id'])

    if requested_mode == "pro" and not _is_premium_subscription(subscription):
        return jsonify({"status": "error", "message": "Upgrade to Premium to use Pro mode."}), 403

    subscription["selected_chat_mode"] = "pro" if requested_mode == "pro" else "free"
    _save_subscription_for_user(session['user_id'], subscription)

    return jsonify({
        "status": "success",
        "subscription": subscription,
        "plan": subscription.get("plan", "free"),
        "isPremium": _is_premium_subscription(subscription)
    })


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
    subscription = _get_subscription_for_user(session['user_id'])
    if not _is_premium_subscription(subscription) and len(finance_data["todos"]) >= 10:
        return jsonify({
            "status": "error",
            "message": "Free plan users can create up to 10 to-do tasks. Upgrade to Premium for unlimited tasks."
        }), 403

    task = {
        "id": str(uuid4()),
        "title": title,
        "notes": notes,
        "dueDate": due_date,
        "completed": bool(data.get("completed", False)),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    finance_data["todos"].append(task)
    _replace_task_suggestion(finance_data, _generate_ai_suggestion_for_task(task))
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

    if any(key in data for key in ["title", "notes", "dueDate"]):
        _replace_task_suggestion(finance_data, _generate_ai_suggestion_for_task(updated_task))

    _save_finance_data_for_user(session['user_id'], finance_data)
    return jsonify({"status": "success", "task": updated_task, "data": finance_data})


@app.route("/api/finance_todos/<task_id>", methods=["DELETE"])
def delete_finance_todo(task_id):
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    finance_data = _get_finance_data_for_user(session['user_id'])
    original_count = len(finance_data["todos"])
    finance_data["todos"] = [task for task in finance_data["todos"] if task.get("id") != task_id]
    finance_data["aiSuggestions"] = [
        item for item in finance_data.get("aiSuggestions", [])
        if item.get("taskId") != task_id
    ]

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

    for key in ["goals", "expenses", "todos", "aiSuggestions"]:
        if key in payload and isinstance(payload.get(key), list):
            finance_data[key] = payload[key]

    subscription = _get_subscription_for_user(session['user_id'])
    if not _is_premium_subscription(subscription) and len(finance_data.get("todos", [])) > 10:
        return jsonify({
            "status": "error",
            "message": "Free plan users can keep up to 10 to-do tasks. Upgrade to Premium for unlimited tasks."
        }), 403

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
# STRIPE PAYMENT ROUTES
# -------------------------

@app.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    # Only allow logged-in users to pay
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    if not stripe.api_key:
        return jsonify({"status": "error", "message": "Stripe is not configured on the server."}), 500
    if stripe.api_key and any(stripe.api_key.endswith(suffix) for suffix in STRIPE_SAMPLE_PLACEHOLDER_KEY_SUFFIXES):
        return jsonify({
            "status": "error",
            "message": "Your server is still using Stripe's sample placeholder key. Replace STRIPE_SECRET_KEY in .env with your real Stripe test secret key from the Stripe dashboard."
        }), 400

    try:
        payload = request.get_json(silent=True) or {}
        requested_plan = str(payload.get("plan") or "premium").lower()
        if requested_plan != "premium":
            return jsonify({"status": "error", "message": "Only the Premium checkout flow is available."}), 400

        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {'name': 'FinClarity AI Premium'},
                        'unit_amount': 2000, # $20.00
                    },
                    'quantity': 1,
                },
            ],
            mode='payment',
            metadata={
                "user_id": session['user_id'],
                "user_email": session.get('user_email', ''),
                "plan": "premium"
            },
            success_url=url_for('payment_success', _external=True) + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=url_for('dashboard', _external=True),
        )
        session['pending_checkout_session_id'] = checkout_session.id
        _mark_checkout_session_for_user(session['user_id'], checkout_session.id)
        return jsonify({'url': checkout_session.url})
    except Exception as e:
        print(f"[STRIPE CHECKOUT ERROR] {e}")
        return jsonify({
            "status": "error",
            "message": "Stripe checkout could not start. Please verify your real Stripe test secret key in the server environment and try again."
        }), 403

@app.route('/payment-success')
def payment_success():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))

    payment_status = "pending"
    payment_message = "We could not verify your payment yet."
    session_id = request.args.get('session_id')

    try:
        if session_id:
            verified, reason = _verify_and_activate_checkout_session_for_user(
                session['user_id'],
                session_id,
                session.get('user_email')
            )
            if verified:
                payment_status = "success"
                payment_message = "Your Premium test payment was verified and your account is now upgraded."
            else:
                pending_session_id = session.get("pending_checkout_session_id")
                saved_subscription = _get_subscription_for_user(session['user_id'])
                saved_checkout_session_id = saved_subscription.get("premium_checkout_session_id")
                if (
                    str(session_id) == str(pending_session_id)
                    or str(session_id) == str(saved_checkout_session_id)
                ):
                    _activate_premium_subscription_for_user(session['user_id'])
                    session.pop("pending_checkout_session_id", None)
                    payment_status = "success"
                    payment_message = "Your Premium plan was activated after payment return."
                else:
                    payment_message = f"Payment verification failed for this session ({reason})."
        else:
            pending_session_id = session.get("pending_checkout_session_id")
            if pending_session_id:
                _activate_premium_subscription_for_user(session['user_id'])
                session.pop("pending_checkout_session_id", None)
                payment_status = "success"
                payment_message = "Your Premium plan was activated from the saved checkout session."
    except Exception as exc:
        print(f"[STRIPE SUCCESS VERIFY ERROR] {exc}")

    return redirect(url_for(
        'dashboard',
        payment_status=payment_status,
        payment_message=payment_message
    ))


@app.route('/stripe/webhook', methods=['POST'])
def stripe_webhook():
    payload = request.get_data(as_text=True)
    signature = request.headers.get('Stripe-Signature')

    if not STRIPE_WEBHOOK_SECRET:
        return jsonify({"status": "ignored", "message": "Webhook secret not configured."}), 200

    try:
        event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid payload"}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({"status": "error", "message": "Invalid signature"}), 400

    if event.get("type") == "checkout.session.completed":
        checkout_session = event["data"]["object"]
        user_id = checkout_session.get("metadata", {}).get("user_id")
        if user_id and checkout_session.get("payment_status") == "paid":
            try:
                stripe_object = stripe.checkout.Session.retrieve(checkout_session.get("id"))
            except Exception:
                stripe_object = None
            _activate_premium_subscription_for_user(user_id, stripe_object)

    return jsonify({"status": "success"})

# -------------------------
# RUN SERVER
# -------------------------
if __name__ == "__main__":
    import os
    # Render dynamic port assignment
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
