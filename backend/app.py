import os
import requests
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

# -------------------------
# SESSION CONFIG
# -------------------------
app.secret_key = os.getenv("SECRET_KEY", "change-this-in-production")
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # True in production

CORS(app, supports_credentials=True)

# -------------------------
# SUPABASE CONFIG
# -------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE credentials. Check your .env file.")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# -------------------------
# ROUTES
# -------------------------

# 🔥 FIXED FOR UPTIMEROBOT (HEAD SUPPORT)


@app.route("/", methods=["GET", "HEAD"])
def home():
    if request.method == "HEAD":
        return "", 200  # fast response for uptime robot
    return render_template("index.html")


@app.route("/login")
def login_page():
    return render_template("login.html")


@app.route("/dashboard")
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))

    return render_template(
        "dashboard.html",
        username=session.get("user_name", "User")
    )

# -------------------------
# SIGNUP API
# -------------------------


@app.route("/api/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data received"})

        name = data.get("name")
        email = data.get("email")
        password = data.get("password")

        if not name or not email or not password:
            return jsonify({"status": "error", "message": "Missing required fields"})

        check_res = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=HEADERS,
            params={"email": f"eq.{email}"}
        )

        if check_res.status_code != 200:
            return jsonify({"status": "error", "message": "Database error"})

        if check_res.json():
            return jsonify({"status": "exists"})

        hashed_password = generate_password_hash(password)

        insert_res = requests.post(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=HEADERS,
            json={
                "name": name,
                "email": email,
                "password": hashed_password
            }
        )

        if insert_res.status_code in [200, 201]:
            return jsonify({"status": "success"})

        return jsonify({"status": "error", "message": "Insert failed"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

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

        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=HEADERS,
            params={"email": f"eq.{email}"}
        )

        if response.status_code != 200:
            return jsonify({"status": "error", "message": "Database error"})

        users = response.json()

        if not users:
            return jsonify({"status": "fail", "message": "User not found"})

        user = users[0]

        if check_password_hash(user["password"], password):
            session['user_id'] = user.get('id')
            session['user_name'] = user.get('name')
            session['user_email'] = user.get('email')

            return jsonify({
                "status": "success",
                "redirect": "/dashboard"
            })

        return jsonify({"status": "fail", "message": "Invalid credentials"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

# -------------------------
# CURRENT USER API
# -------------------------
# -------------------------
# GOOGLE LOGIN API
# -------------------------

@app.route("/api/google-login", methods=["POST"])
def google_login():
    try:
        data = request.get_json()

        name = data.get("name")
        email = data.get("email")

        if not email:
            return jsonify({"status": "error", "message": "Email required"})

        # Check if user exists
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=HEADERS,
            params={"email": f"eq.{email}"}
        )

        if response.status_code != 200:
            return jsonify({"status": "error", "message": "Database error"})

        users = response.json()

        if users:
            user = users[0]
        else:
            # Create new user
            insert_res = requests.post(
                f"{SUPABASE_URL}/rest/v1/users",
                headers=HEADERS,
                json={
                    "name": name or "Google User",
                    "email": email,
                    "password": ""
                }
            )

            if insert_res.status_code not in [200, 201]:
                return jsonify({"status": "error", "message": "Insert failed"})

            # Fetch again
            fetch_res = requests.get(
                f"{SUPABASE_URL}/rest/v1/users",
                headers=HEADERS,
                params={"email": f"eq.{email}"}
            )

            user = fetch_res.json()[0]

        # SET SESSION
        session['user_id'] = user.get('id')
        session['user_name'] = user.get('name')
        session['user_email'] = user.get('email')

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route("/api/user", methods=["GET"])
def get_user():
    if 'user_id' in session:
        return jsonify({
            "status": "success",
            "user": {
                "id": session.get('user_id'),
                "name": session.get('user_name'),
                "email": session.get('user_email')
            }
        })

    return jsonify({"status": "error", "message": "Not logged in"}), 401

# -------------------------
# LOGOUT API
# -------------------------


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "success"})

# -------------------------
# CHAT API
# -------------------------


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        message = data.get("message")

        if not message:
            return jsonify({"reply": "Empty message"})

        return jsonify({
            "reply": f"AI: You said '{message}'"
        })

    except Exception as e:
        return jsonify({"reply": f"Error: {str(e)}"})


# -------------------------
# RUN SERVER
# -------------------------
if __name__ == "__main__":
    app.run(debug=True)
