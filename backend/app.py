import os
import json
import requests
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer
from functools import lru_cache
from supabase import create_client, Client

load_dotenv()

# -------------------------
# SUPABASE SETUP (Cleaned up imports)
# -------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Supabase env variables missing")

print("⏳ Initializing Supabase Client...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    raise Exception("OpenRouter API key missing")

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1"
)

embed_model = SentenceTransformer("all-MiniLM-L6-v2")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USER_DATA_DIR = os.path.join(BASE_DIR, "user_data")
os.makedirs(USER_DATA_DIR, exist_ok=True)

@lru_cache(maxsize=2000)
def get_cached_embedding(text):
    """Caches sentence embeddings to prevent CPU thread blocking on repeat queries."""
    return embed_model.encode(text).tolist()

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

app.secret_key = os.getenv("SECRET_KEY", "change-this-in-production")
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False
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

        # 🔥 PURE VAULT. NO CUSTOM TABLES.
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
        error_msg = str(e)
        print(f"🚨 ACTUAL VAULT ERROR: {error_msg}")
        
        # Catch duplicate users
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

        # 🔥 Check credentials directly against the encrypted Vault
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        user = response.user
        session['user_id'] = user.id
        session['user_email'] = user.email
        session['user_name'] = user.user_metadata.get('full_name', 'User')

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })

    except Exception as e:
        print(f"🚨 VAULT LOGIN ERROR: {str(e)}")
        return jsonify({"status": "fail", "message": "Invalid credentials"})


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


@app.route("/api/get_userdata", methods=["GET"])
def get_userdata():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Not authenticated"}), 401
        
    user_id = session['user_id']
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/user_data",
            headers=HEADERS,
            params={"user_id": f"eq.{user_id}"}
        )
        
        if response.status_code == 200:
            rows = response.json()
            if rows:
                return jsonify({"status": "success", "data": rows[0]})
        
        return jsonify({"status": "success", "data": {"chats": [], "memory": []}})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route("/api/sync_userdata", methods=["POST"])
def sync_userdata():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Not authenticated"}), 401
        
    user_id = session['user_id']
    
    try:
        data = request.get_json()
        payload = {
            "user_id": user_id,
            "chats": data.get("chats", []),
            "memory": data.get("memory", []),
            "updated_at": "now()"
        }
        
        # Upsert using PostgREST resolution=merge-duplicates
        upsert_headers = HEADERS.copy()
        upsert_headers["Prefer"] = "resolution=merge-duplicates"
        
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/user_data",
            headers=upsert_headers,
            json=payload
        )
        
        if response.status_code in [200, 201, 204]:
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": f"DB Error: {response.text}"})
            
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


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



@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "success"})


@app.route("/chat", methods=["POST"])
def chat():
    try:
        if 'is_guest' in session or 'user_id' not in session:
            return jsonify({"status": "error", "message": "Please login"}), 401

        data = request.get_json()
        message = data.get("message")
        history = data.get("history", [])
        user_memory = data.get("user_memory", [])

        if not message:
            return jsonify({"reply": "Empty message"})

        query_embedding = get_cached_embedding(message)

        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/match_documents",
            headers=HEADERS,
            json={
                "query_embedding": query_embedding,
                "match_count": 8
            }
        )

        raw_docs = res.json()
        
        docs = sorted([d for d in raw_docs if d.get('similarity', 1) > 0.60], key=lambda x: x.get('similarity', 0), reverse=True)[:3]

        # =========================
        # 🔥 STEP 3: CONTEXT & MEMORY INJECTION
        # =========================
        if docs:
            rag_context = "\n\n".join([
                f"{doc['content']}\nSource: {doc.get('url', 'N/A')}"
                for doc in docs
            ])
        else:
            # Fallback when no financial data found
            rag_context = "No specific financial documents found. Provide general financial guidance based on your knowledge."
        
        memory_str = "\n".join(f"- {m}" for m in user_memory)
        memory_block = f"USER PROFILE MEMORY (Facts you learned in past sessions):\n{memory_str}\n\n" if memory_str else ""
        
        context = memory_block + rag_context

        # =========================
        # 🔥 STEP 4: DYNAMIC PROMPT
        # =========================
        system_prompt = """
You are Finclarity AI — a smart financial assistant for Indian users.

Your goal: Give clear, practical, and easy-to-understand financial guidance.

━━━━━━━━━━━━━━━━━━━
OUT OF DOMAIN & SMALL TALK HANDLING
━━━━━━━━━━━━━━━━━━━
- CASUAL SMALL TALK ALLOWED: If the user engages in normal human small talk (e.g., "how are you", "who are you", "good morning"), reply warmly and naturally in 1-2 sentences, then politely ask how you can help them with their finances.
- STRICTLY OUT OF DOMAIN: If the user asks complex non-financial questions (e.g., coding, history, politics) or types random gibberish (e.g., "asdf"):
  - Do NOT attempt to answer the external question.
  - Reply with 1 short sentence politely refusing, reminding them you are a financial assistant.

━━━━━━━━━━━━━━━━━━━
INTENT DETECTION
━━━━━━━━━━━━━━━━━━━
First classify the user input:

1. CASUAL → hi, hello, thanks, who are you
2. SIMPLE → direct financial question (definition, basic concept)
3. COMPLEX → analysis, comparison, multi-part, document review

━━━━━━━━━━━━━━━━━━━
RESPONSE LOGIC
━━━━━━━━━━━━━━━━━━━

IF CASUAL:
- 1–2 lines only
- Friendly, human tone
- No bullets, no structure

Example:
"Hi! 👋 How can I help you today?"

---

IF SIMPLE QUESTION:

- Answer MUST be in bullets (no paragraph intro)
- Max 3–5 bullets

Format:

Definition (if needed):
- One-line meaning

Key Points:
- Point 1
- Point 2
- Point 3

Example (optional):
- Short example

---

IF COMPLEX QUESTION:
- Structured sections allowed
- Use bullets heavily (avoid long paragraphs)
- Add clear headers

Structure:

━━━━━━━━━━━━━━━━━━━
⚠️ Risks / Concerns
━━━━━━━━━━━━━━━━━━━
- Bullet points

━━━━━━━━━━━━━━━━━━━
🎁 Benefits (with limits)
━━━━━━━━━━━━━━━━━━━
- Include restrictions

━━━━━━━━━━━━━━━━━━━
📌 Missing / Hidden Info
━━━━━━━━━━━━━━━━━━━
- Gaps or unclear points

━━━━━━━━━━━━━━━━━━━
✅ Final Verdict
━━━━━━━━━━━━━━━━━━━
- Clear recommendation

━━━━━━━━━━━━━━━━━━━
💡 Actionable Advice
━━━━━━━━━━━━━━━━━━━
- Practical next steps

━━━━━━━━━━━━━━━━━━━
FORMATTING RULES (STRICT)
━━━━━━━━━━━━━━━━━━━
- NEVER write long paragraphs
- Max 2 lines per paragraph
- Prefer bullets over text
- Each bullet = one idea
- Response should be scannable in 5 seconds

If any paragraph >2 lines → convert into bullets

━━━━━━━━━━━━━━━━━━━
CONTEXT & MEMORY USAGE (LONG & SHORT-TERM MEMORY)
━━━━━━━━━━━━━━━━━━━
- You have access to a deep history of the user's previous questions and your previous answers in this conversation.
- Treat this history as your LONG-TERM MEMORY. Always maintain continuity.
- If the user refers to a topic discussed earlier, seamlessly recall the details without asking them to repeat themselves.
- If the user's current question is ambiguous, use the history to infer what they are talking about.
- Always provide a highly personalized experience based on what you already know about the user from the chat history.

━━━━━━━━━━━━━━━━━━━
STATE-OF-THE-ART PERMANENT FACT EXTRACTION
━━━━━━━━━━━━━━━━━━━
- If the user reveals a persistent, important personal fact about themselves (e.g., their salary, their city, their financial goals, their age, their debts), you MUST save it to your permanent memory vault.
- To save a fact to memory, include this exact tag anywhere in your response: [MEMORY: <fact>]
- Example: [MEMORY: User earns 50k INR per month]
- Example: [MEMORY: User is looking to buy a house in 2 years in Mumbai]
- Example: [MEMORY: User has an active SBI credit card]
- The system will secretly extract these tags and feed them to you in all future conversations so you NEVER forget who they are!

━━━━━━━━━━━━━━━━━━━
VISUAL SPACING & MARKDOWN (STRICT)
━━━━━━━━━━━━━━━━━━━
- NEVER write long paragraphs. Max 1-2 lines per block.
- **BOLD IMPORTANT WORDS**: Use Markdown bold (`**text**`) for numbers, dates, terms, and key advice.
- **USE HEADERS**: Use `###` for sub-sections to make them stand out.
- Each section MUST have a blank line before and after.
- Each bullet point MUST be on a new line.
- Response should be scannable in 5 seconds.

━━━━━━━━━━━━━━━━━━━
SELF-CORRECTION & READABILITY:
━━━━━━━━━━━━━━━━━━━
Before sending response:
- "Is the most important info bolded?"
- "Are there headers to guide the eye?"
- "Is there plenty of white space?"
- "Did I use bullets?"
━━━━━━━━━━━━━━━━━━━
Before responding, ensure:
- Is response length matching question complexity?
- Can user scan this in 5 seconds?
- Are bullets used where possible?
- Any long paragraph? → fix it

GOAL:
Feel like a smart, practical financial advisor — clear, helpful, and to the point.

DEFAULT OUTPUT MODE: BULLET-FIRST

- By default, ALL responses MUST be in bullet points
- Paragraphs are NOT allowed unless user explicitly asks:
  (e.g., "explain in paragraph", "write detailed explanation")

IF NOT SPECIFIED:
→ ALWAYS USE BULLETS

━━━━━━━━━━━━━━━━━━━
HARD RULES:
━━━━━━━━━━━━━━━━━━━
- No paragraph longer than 1 line
- Break every idea into a new bullet
- Even TL;DR must be in bullets
- If response is written in paragraph → IMMEDIATELY convert to bullets

━━━━━━━━━━━━━━━━━━━
EXCEPTION:
━━━━━━━━━━━━━━━━━━━
Only use paragraph format IF user explicitly says:
- "explain in detail"
- "write in paragraph"
- "long explanation"

Otherwise → bullets only

━━━━━━━━━━━━━━━━━━━
SELF-CORRECTION:
━━━━━━━━━━━━━━━━━━━
Before sending response:
- Check: "Did I write any paragraph?"
→ If YES → convert into bullet format
"""

        # =========================
        # 🔥 STEP 5: LLM
        # =========================
        messages = [{"role": "system", "content": system_prompt}]
        
        for msg in history[:-1]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            
        messages.append({
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion:\n{message}"
        })

        ai_res = client.chat.completions.create(
            model="meta-llama/llama-3-8b-instruct",
            messages=messages,
            temperature=0.3,
            max_tokens=600
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