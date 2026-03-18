import os
import requests
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv   # ✅ ADD THIS

load_dotenv()  # ✅ ADD THIS (loads .env)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

CORS(app)

# -------------------------
# SUPABASE CONFIG
# -------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")   # ✅ removed fallback
SUPABASE_KEY = os.getenv("SUPABASE_KEY")   # ✅ removed hardcoded key

# ⚠️ safety check (VERY IMPORTANT)
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
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

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

        # Use Supabase Auth API to register the user
        auth_res = requests.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers=HEADERS,
            json={
                "email": email,
                "password": password,
                "data": {"name": name}
            }
        )

        auth_data = auth_res.json()

        if auth_res.status_code == 200 and auth_data.get("id"):
            return jsonify({"status": "success"})

        # Supabase returns 422 when the user already exists
        if auth_res.status_code == 422:
            return jsonify({"status": "exists"})

        error_msg = (
            auth_data.get("msg")
            or auth_data.get("error_description")
            or auth_data.get("message")
            or auth_res.text
        )
        return jsonify({"status": "error", "message": error_msg})

    except Exception as e:
        print("Signup Error:", str(e))
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

        # Use Supabase Auth API to authenticate
        auth_res = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers=HEADERS,
            json={
                "email": email,
                "password": password
            }
        )

        auth_data = auth_res.json()

        if auth_res.status_code == 200 and auth_data.get("access_token"):
            return jsonify({"status": "success", "redirect": "/dashboard"})
        else:
            return jsonify({"status": "fail", "message": "Invalid credentials"})

    except Exception as e:
        print("Login Error:", str(e))
        return jsonify({"status": "error", "message": str(e)})

# -------------------------
# RUN SERVER
# -------------------------
if __name__ == "__main__":
    app.run(debug=True)