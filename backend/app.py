import os
import requests
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer
load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

embed_model = SentenceTransformer("all-MiniLM-L6-v2")
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
# Allow cross-site redirects from OAuth
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

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
        print(f"DEBUG: Checking if {email} exists in Supabase...")
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=HEADERS,
            params={"email": f"eq.{email}"}
        )
        
        # 🚨 NEW: Print exact Supabase error if the GET fails
        if response.status_code != 200:
            print(f"🚨 SUPABASE GET ERROR: {response.text}")
            return jsonify({"status": "error", "message": f"Database error: {response.text}"})

        users = response.json()

        if users:
            print("DEBUG: User found! Logging them in.")
            user = users[0]
        else:
            print("DEBUG: User not found. Attempting to create new user...")
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

            # 🚨 NEW: Print exact Supabase error if the POST fails
            if insert_res.status_code not in [200, 201]:
                print(f"🚨 SUPABASE INSERT ERROR: {insert_res.text}")
                return jsonify({"status": "error", "message": f"Insert failed: {insert_res.text}"})

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
        print("DEBUG: Session successfully created!")

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })

    except Exception as e:
        print(f"🚨 PYTHON CRASH: {str(e)}")
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
# GUEST LOGIN API
# -------------------------


@app.route("/api/guest-login", methods=["POST"])
def guest_login():
    try:
        session['is_guest'] = True
        session['user_name'] = 'Guest'

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

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
        if 'is_guest' in session or 'user_id' not in session:
            return jsonify({"status": "error", "message": "Please login"}), 401

        data = request.get_json()
        message = data.get("message")

        if not message:
            return jsonify({"reply": "Empty message"})

        # =========================
        # 🔥 STEP 1: EMBEDDING
        # =========================
        query_embedding = embed_model.encode(message).tolist()

        # =========================
        # 🔥 STEP 2: SUPABASE VECTOR SEARCH
        # =========================
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/match_documents",
            headers=HEADERS,
            json={
                "query_embedding": query_embedding,
                "match_count": 4
            }
        )

        docs = res.json()

        if not docs:
            return jsonify({
                "reply": "I couldn't find anything in your financial data."
            })

        # =========================
        # 🔥 STEP 3: CONTEXT
        # =========================
        context = "\n\n".join([
    f"{doc['content']}\nSource: {doc.get('url', 'N/A')}"
    for doc in docs
])

        # =========================
        # 🔥 STEP 4: DYNAMIC PROMPT
        # =========================
        system_prompt = """
You are Finclarity AI - a dynamic financial assistant.

GUIDELINES:
- PRIMARY: Answer from the provided context when available
- SECONDARY: Use your knowledge to enhance or clarify the answer
- ADAPTIVE: Adjust tone and depth based on user complexity
- If context unavailable: Provide helpful financial guidance with disclaimer
- Keep answers clear, relevant, and actionable
- Use examples when helpful
- Acknowledge uncertainty naturally
"""

        # =========================
        # 🔥 STEP 5: LLM
        # =========================
        ai_res = client.chat.completions.create(
            model="meta-llama/llama-3-8b-instruct",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Context:\n{context}\n\nQuestion:\n{message}"
                }
            ]
        )

        reply = ai_res.choices[0].message.content

        return jsonify({"reply": reply})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"reply": "Server error"})
# -------------------------
# PROFILE MANAGEMENT API
# -------------------------

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

        # Update in Supabase
        update_res = requests.patch(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=HEADERS,
            params={"id": f"eq.{session['user_id']}"},
            json={
                "name": new_name,
                "email": new_email
            }
        )

        if update_res.status_code in [200, 204]:
            session['user_name'] = new_name
            session['user_email'] = new_email
            return jsonify({"status": "success"})
        
        return jsonify({"status": "error", "message": f"Update failed: {update_res.text}"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


@app.route("/change_password", methods=["POST"])
def change_password():
    if 'user_id' not in session and 'is_guest' not in session:
        return jsonify({"status": "error", "message": "Not authenticated"}), 401

    if session.get('is_guest'):
        return jsonify({"status": "error", "message": "Guest accounts cannot change password"})

    try:
        data = request.get_json()
        current_password = data.get("currentPassword")
        new_password = data.get("newPassword")

        # Fetch current user to verify password
        fetch_res = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=HEADERS,
            params={"id": f"eq.{session['user_id']}"}
        )

        users = fetch_res.json()
        if not users:
            return jsonify({"status": "error", "message": "User not found"})
        
        user = users[0]
        stored_hash = user.get("password", "")
        
        # Verify current password (if stored password exists)
        if stored_hash and not check_password_hash(stored_hash, current_password):
            return jsonify({"status": "error", "message": "Incorrect current password"})

        # Hash new password
        hashed_password = generate_password_hash(new_password)

        # Update in Supabase
        update_res = requests.patch(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=HEADERS,
            params={"id": f"eq.{session['user_id']}"},
            json={
                "password": hashed_password
            }
        )

        if update_res.status_code in [200, 204]:
            return jsonify({"status": "success"})
        
        return jsonify({"status": "error", "message": f"Update failed: {update_res.text}"})
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
