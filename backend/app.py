import os
import requests
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
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

        # check if user exists
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
        else:
            return jsonify({
                "status": "error",
                "message": insert_res.text
            })

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