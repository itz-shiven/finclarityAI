import os
import json
import requests
import flask
from flask import Flask, request, jsonify, render_template, session, redirect, url_for, Response
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer
from functools import lru_cache
from supabase import create_client, Client
from werkzeug.exceptions import HTTPException

load_dotenv(override=True)

# -------------------------
# SUPABASE SETUP (Cleaned up imports)
# -------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # 🔥 SECURE BACKEND KEY
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Supabase env variables missing")

# Use Service Role Key if available for administrative tasks (bypasses RLS)
backend_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
supabase: Client = create_client(SUPABASE_URL, backend_key)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise Exception("OpenAI API key missing")

# Official OpenAI Client
client = OpenAI(api_key=OPENAI_API_KEY)
# Dedicated client for embeddings (same key)
openai_client = client 

# embed_model = SentenceTransformer("all-MiniLM-L6-v2") # Removed due to dimension mismatch (384 vs 1536)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USER_DATA_DIR = os.path.join(BASE_DIR, "user_data")
os.makedirs(USER_DATA_DIR, exist_ok=True)

@lru_cache(maxsize=2000)
def get_cached_embedding(text):
    """Caches OpenAI embeddings (1536-dim) to match Supabase database schema."""
    try:
        # Use OpenAI client for embeddings (ensure it's the real OpenAI client, not OpenRouter if OpenRouter doesn't support embeddings)
        # Actually, many users use a separate client for real OpenAI if OpenRouter is only for chat.
        # But let's check if we can use the existing 'client' or if we need a dedicated one.
        
        # NOTE: OpenRouter doesn't usually provide embeddings. Usually people use the real OpenAI API for this.
        # If OPENAI_API_KEY is for real OpenAI:
        # We might need a separate client.
        
        # Let's define a dedicated openai_client for embeddings if needed.
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        response = openai_client.embeddings.create(
            input=text,
            model="text-embedding-3-small" # or text-embedding-ada-002
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Embedding error: {e}")
        # Fallback to zeros of correct dimension to prevent server crash, though results will be poor
        return [0.0] * 1536

def is_greeting(text):
    """Detects if the message is a simple greeting or casual small talk."""
    import re
    greetings = [
        r"\bhi\b", r"\bhello\b", r"\bhey\b", r"\bgood morning\b", 
        r"\bgood afternoon\b", r"\bgood evening\b", r"\bhow are you\b",
        r"\bwho are you\b", r"\bthanks\b", r"\bthank you\b", r"\bnamaste\b"
    ]
    text_lower = text.lower().strip()
    for pattern in greetings:
        if re.search(pattern, text_lower):
            return True
    # Also check for very short messages that might be greetings
    if len(text_lower.split()) <= 2 and any(word in text_lower for word in ["hi", "hey", "hello"]):
        return True
    return False

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

app.secret_key = os.getenv("SECRET_KEY", "change-this-in-production")
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# -------------------------
# SECURE CORS SETUP
# -------------------------
# Your VIP Guest List of allowed frontend URLs
ALLOWED_ORIGINS = [
    "http://localhost:3000",       # If you are using React/Next.js locally
    "http://127.0.0.1:5000",       # Local HTML/JS testing
    "http://localhost:5000",       # Local HTML/JS testing
    "https://your-future-domain.com" # Put your Vercel/Netlify link here later!
]

CORS(app, supports_credentials=True, origins=ALLOWED_ORIGINS)

# -------------------------
# GLOBAL ERROR HANDLER
# -------------------------
@app.errorhandler(Exception)
def handle_exception(e):
    # 1. Handle standard HTTP errors (like 404 Not Found, 401 Unauthorized)
    if isinstance(e, HTTPException):
        return jsonify({
            "status": "error",
            "message": e.description
        }), e.code

    # 2. Catch all unexpected backend crashes (500 Internal Server Error)
    import traceback
    print("🚨 [GLOBAL CRASH CATCHER] An error occurred:")
    traceback.print_exc() 
    
    return jsonify({
        "status": "error",
        "message": "An unexpected server error occurred. Our team has been notified."
    }), 500
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
        import traceback
        traceback.print_exc()
        error_msg = str(e)
        print(f"[ERROR] ACTUAL VAULT ERROR: {error_msg}")
        
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

        # 🔥 Ensure user_data row exists
        ensure_user_data(user.id, user.email, session['user_name'])

        return jsonify({
            "status": "success",
            "redirect": "/dashboard"
        })

    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] LOGIN FAILURE for {email}: {error_msg}")
        
        # 🔥 ULTRA SMART HINT: Check if user exists in Supabase Auth directly
        try:
            # Try to sign up with a dummy password. 
            # If they exist, Supabase will return "User already registered"
            check_signup = supabase.auth.sign_up({"email": email, "password": "DummyPassword123!"})
            # If it reaches here, the user DID NOT exist (or signup was allowed)
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
# CURRENT USER API
# -------------------------
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

        # SET SESSION
        # Since we use "PURE VAULT", we trust the frontend's authentication 
        # (which was verified by Supabase) and set the session directly.
        session['user_id'] = user_id
        session['user_name'] = user_name or "Google User"
        session['user_email'] = user_email
        
        # 🔥 Ensure user_data row exists
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
    """Ensures a row exists in user_data for this user_id."""
    try:
        # Check if exists
        res = supabase.table("user_data").select("user_id").eq("user_id", user_id).execute()
        if not res.data:
            # Create new row (Matching confirmed schema: user_id, chats, memory)
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
        
        docs = sorted([d for d in raw_docs if d.get('similarity', 0) > 0.35], key=lambda x: x.get('similarity', 0), reverse=True)[:5]

        # ===== DEBUG: RAG SOURCE TRACKING =====
        print(f"[RAG DEBUG] Total docs from DB: {len(raw_docs)}")
        print(f"[RAG DEBUG] Docs after similarity filter (>0.35): {len(docs)}")
        for i, doc in enumerate(docs):
            print(f"[RAG DEBUG] Doc #{i+1} | similarity={doc.get('similarity', 'N/A'):.4f} | preview: {str(doc.get('content', ''))[:120]}")
        if not docs:
            print("[RAG DEBUG] [WARNING] NO DOCS MATCHED - LLM will use GENERAL KNOWLEDGE, NOT table data!")
        # =======================================

        # =========================
        # [STEP 3]: CONTEXT & MEMORY INJECTION
        # =========================
        if docs:
            rag_context = "\n\n".join([
                f"{doc['content']}\nSource: {doc.get('url', 'N/A')}"
                for doc in docs
            ])
            source_info = "SOURCE: 🏦 **Finclarity Database**"
        else:
            # Fallback when no financial data found
            print("[RAG DEBUG] [WARNING] FALLBACK TRIGGERED - Replying from general LLM knowledge, NOT from financial_docs table!")
            
            # Check if it's a greeting/small talk
            if is_greeting(message):
                rag_context = "USER IS GREETING: This is casual small talk. You are NOT restricted by the 'NO DATA AVAILABLE' rule. Please greet the user warmly and naturally. Be varied in your greeting—if the user greets you multiple times, don't use the exact same words. Keep it to 1-2 sentences."
                source_info = "SOURCE: 🤖 **AI Knowledge**"
            else:
                rag_context = "❌ NO DATA AVAILABLE: There are no financial documents in the database matching this query. You MUST refuse to answer and tell the user to contact support or check back later. DO NOT use your training data to answer."
                source_info = "SOURCE: 🏦 **Finclarity Database** (Attempted)"
        
        memory_str = "\n".join(f"- {m}" for m in user_memory)
        memory_block = f"USER PROFILE MEMORY (Facts you learned in past sessions):\n{memory_str}\n\n" if memory_str else ""
        
        context = f"INFORMATION SOURCE: {source_info}\n\n" + memory_block + rag_context

        # =========================
        # [STEP 4]: DYNAMIC PROMPT
        # =========================
        system_prompt = """
🔒 IMPORTANT: DATA SOURCE RESTRICTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST ONLY answer questions using the financial documents provided in the CONTEXT section below.
- If the context says "❌ NO DATA AVAILABLE", you MUST refuse to answer.
- DO NOT use your training data, general knowledge, or the internet.
- If context doesn't have the information, say: "I don't have this information in my database. Please contact support."
- NEVER answer financial questions that aren't covered by the provided documents.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are Finclarity AI — a smart financial assistant for Indian users.

Your goal: Give clear, practical, and easy-to-understand financial guidance.

━━━━━━━━━━━━━━━━━━━
OUT OF DOMAIN & SMALL TALK HANDLING
━━━━━━━━━━━━━━━━━━━
- CASUAL SMALL TALK ALLOWED: If the user engages in normal human small talk (e.g., "how are you", "who are you", "good morning"), reply warmly and naturally in 1-2 sentences, then politely ask how you can help them with their finances.
- STRICTLY OUT OF DOMAIN: If the user asks complex non-financial questions (e.g., coding, history, politics) or types random gibberish (e.g., "asdf"):
  - Do NOT attempt to answer the external question.
  - Reply with 1 short sentence politely refusing, reminding them you are a financial assistant.
- NO DATA IN DATABASE: If no matching financial documents exist in the database for the user's query:
  - You MUST refuse to answer.
  - Say: "I don't have information about this in my database. Please contact support or try rephrasing your question."
  - DO NOT use your training knowledge or make up information.

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 MANDATORY SOURCE CITATION (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every single response without exception MUST end with a source citation.
This is a HARD CONSTRAINT.

FORMAT:
Source: 🏦 **Finclarity Database** (If information came from the provided context)
Source: 🤖 **AI Knowledge** (If this was a greeting, small talk, or AI explanation)

RULES:
- Place it at the VERY BOTTOM of your response.
- Separate it with a blank line.
- If context URLs exist, list them below the "Finclarity Database" footer.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELF-CORRECTION & FINAL CHECK:
- "Did I include the Source footer at the very end?" -> If NO, fix it before sending.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
->
"""

        # =========================
        # [STEP 5]: LLM
        # =========================
        messages = [{"role": "system", "content": system_prompt}]
        
        for msg in history[:-1]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            
        messages.append({
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion:\n{message}"
        })

        # Multi-greeting variety hint & Source reminder
        if is_greeting(message):
            messages[-1]["content"] += "\n\n(IMPORTANT: Use Source: 🤖 **AI Knowledge** and provide a varied greeting.)"
        else:
            messages[-1]["content"] += f"\n\n(IMPORTANT: Based on the provided context, you must use {source_info} at the end of your response.)"

        # =========================
        # [STEP 5]: Streaming LLM Response
        # =========================
        def generate():
            full_reply = ""
            print(f"[LLM DEBUG] Starting stream for GPT-4o-mini...")
            
            stream = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7 if is_greeting(message) else 0.3,
                max_tokens=800,
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_reply += content
                    yield f"data: {json.dumps({'chunk': content})}\n\n"

            # After stream ends, we can handle memory extraction or background logging if needed
            print(f"[LLM DEBUG] Stream completed. Length: {len(full_reply)}")

        return flask.Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"reply": "[ERROR] Server error\n\nSource: 🤖 **System Error Handler**"})
@app.route("/api/compare_product", methods=["POST"])
def compare_product():
    if 'user_id' not in session and 'is_guest' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    try:
        data = request.get_json()
        product_name = data.get("product_name")
        provider = data.get("provider")
        category = data.get("category")

        if not product_name:
            return jsonify({"status": "error", "message": "Product name is required"}), 400

        # Create search query
        search_query = f"{provider} {product_name} {category} features fees interest benefits"
        query_embedding = get_cached_embedding(search_query)

        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/match_documents",
            headers=HEADERS,
            json={
                "query_embedding": query_embedding,
                "match_count": 10 # Increase depth to find more features
            }
        )
        
        raw_docs = res.json()
        if not isinstance(raw_docs, list):
            print(f"SUPABASE ERROR in compare_product: {raw_docs}")
            raw_docs = []
            
        # Slightly more inclusive similarity to ensure we get something if the product name is slightly different
        docs = sorted([d for d in raw_docs if isinstance(d, dict) and d.get('similarity', 0) > 0.35], key=lambda x: x.get('similarity', 0), reverse=True)[:5]
        
        if docs:
            context = "\n\n".join([doc['content'] for doc in docs])
        else:
            context = "❌ NO DATA AVAILABLE: The database does not contain information on this product."

        system_prompt = f"""
You are an expert financial data extractor. You must extract key comparison details for the product '{product_name}' by '{provider}'.
Category: {category}

### INSTRUCTIONS:
1. ONLY return a JSON object. No other text.
2. Use the provided context to fill in values.
3. If a value is missing from the context, use "Not Available" for that field.
4. Keep values extremely concise (under 8 words).

### STRICT KEY LIST (ONLY use these keys for {category}):
"""
        if category.lower() == "cards":
            system_prompt += '{"Joining Fee": "...", "Annual Fee": "...", "Reward Rate": "...", "Lounge Access": "...", "Forex Markup": "...", "Milestones/Offers": "...", "Best For": "..."}'
        elif category.lower() == "loans":
            system_prompt += '{"Interest Rate": "...", "Processing Fee": "...", "Max Loan Amount": "...", "Tenure": "...", "Eligibility": "...", "Foreclosure Charges": "..."}'
        elif category.lower() == "stocks" or category.lower() == "stock market":
            system_prompt += '{"Brokerage (Intraday)": "...", "Brokerage (Delivery)": "...", "Account Opening Fee": "...", "AMC": "...", "Platforms": "...", "Margin/Leverage": "..."}'
        else:
            system_prompt += '{"Feature 1": "...", "Feature 2": "...", "Feature 3": "...", "Pricing": "...", "Pros": "...", "Cons": "..."}'

        system_prompt += "\nDo NOT invent new keys. Use exactly the keys listed above."

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context:\n{context}\n\nExtract requested JSON for {product_name}."}
        ]

        # ===== DEBUG: COMPARE LLM INPUT =====
        print(f"[COMPARE DEBUG] Fetching JSON for {product_name}...")
        # ====================================

        ai_res = client.chat.completions.create(
            model="gpt-4o-mini", # Switched to GPT-4o mini
            messages=messages,
            temperature=0.1,
            max_tokens=300
        )

        reply = ai_res.choices[0].message.content.strip()
        
        # ===== DEBUG: COMPARE LLM OUTPUT =====
        print(f"[COMPARE DEBUG] Raw LLM Reply: {reply}")
        # =====================================
        
        # Clean up any potential markdown formatting manually just in case
        if reply.startswith("```json"):
            reply = reply[7:]
        if reply.startswith("```"):
            reply = reply[3:]
        if reply.endswith("```"):
            reply = reply[:-3]
        
        reply = reply.strip()
        
        try:
            features = json.loads(reply)
            if isinstance(features, str):
                # LLM outputted a JSON-encoded string instead of an object
                features = {"Info": features}
            if not isinstance(features, dict):
                features = {"Info": str(features)}
        except json.JSONDecodeError:
            print(f"[COMPARE DEBUG] LLM Failed to output valid JSON. Output was: {reply}")
            features = {"Status": "Not Found", "Details": "The database contains limited info about this specific product." if "NO DATA AVAILABLE" in context else "Unable to parse data."}

        return jsonify({
            "status": "success",
            "product_name": product_name,
            "provider": provider,
            "features": features
        })

    except Exception as e:
        print(f"ERROR in compare_product: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/product_details", methods=["POST"])
def product_details():
    if 'user_id' not in session and 'is_guest' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    try:
        data = request.get_json()
        product_name = data.get("product_name")
        provider = data.get("provider")
        category = data.get("category")

        if not product_name:
            return jsonify({"status": "error", "message": "Product name is required"}), 400

        # Create deep search query
        search_query = f"EXHAUSTIVE DETAILS for {provider} {product_name} {category}: benefits, fees, charges, eligibility, documents required, pros cons, terms and conditions"
        query_embedding = get_cached_embedding(search_query)

        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/match_documents",
            headers=HEADERS,
            json={
                "query_embedding": query_embedding,
                "match_count": 15 # High depth for exhaustive details
            }
        )
        
        raw_docs = res.json()
        if not isinstance(raw_docs, list):
            raw_docs = []
            
        docs = sorted([d for d in raw_docs if isinstance(d, dict) and d.get('similarity', 0) > 0.3], key=lambda x: x.get('similarity', 0), reverse=True)[:8]
        
        if docs:
            context = "\n\n".join([doc['content'] for doc in docs])
        else:
            context = "❌ NO DATA AVAILABLE"

        system_prompt = f"""
You are an expert financial researcher. Your goal is to extract EVERY SINGLE DETAIL for the product '{product_name}' by '{provider}' ({category}).
Users want 'saari matlab saari' (all of it) info.

### EXTRACTION CATEGORIES:
1. **Overview**: Catchy summary, Best For (Target Audience), Key Highlights.
2. **Features & Benefits**: Exhaustive list of rewards, lounge access, cashback, insurance covers, welcome gifts, etc.
3. **Fees & Charges**: Joining fee, Annual fee (and waivers), Reward redemption fee, Late payment, Cash advance, Interest rates, Forex markup.
4. **Eligibility & Docs**: Age, Salary, CIBIL, Required documents (KYC, Income proof).
5. **AI Verdict**: Pros (What's goated?), Cons (What's the catch?), Final recommendation.

### RULES:
1. RESPONSE MUST BE VALID JSON.
2. If info is missing, say "Check Official Website" or "Standard terms apply".
3. Use arrays for lists of benefits/docs.
4. Maintain a premium, professional tone.

### FORMAT:
{{
  "overview": {{ "summary": "...", "best_for": "...", "highlights": ["...", "..."] }},
  "benefits": [ "...", "...", "..." ],
  "fees": {{ "joining": "...", "annual": "...", "interest": "...", "forex": "...", "others": ["...", "..."] }},
  "eligibility": {{ "age": "...", "income": "...", "docs": ["...", "..."] }},
  "verdict": {{ "pros": ["...", "..."], "cons": ["...", "..."], "recommendation": "..." }}
}}
"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context:\n{context}\n\nExtract requested exhaustive JSON for {product_name}."}
        ]

        ai_res = client.chat.completions.create(
            model="gpt-4o", # High quality for deep extraction
            messages=messages,
            temperature=0.1,
            response_format={ "type": "json_object" }
        )

        reply = ai_res.choices[0].message.content.strip()
        details = json.loads(reply)

        return jsonify({
            "status": "success",
            "product_name": product_name,
            "provider": provider,
            "details": details
        })

    except Exception as e:
        print(f"ERROR in product_details: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/what_changed", methods=["GET"])
def get_what_changed():
    if 'user_id' not in session:
        # For guests or non-logged in users, return standard updates
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
        # Fetch user data (memory)
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
        
        # All available updates
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

        # Filter based on memory
        personalized = []
        interests = " ".join(memory).lower()
        
        for up in all_updates:
            if any(kw.lower() in interests for kw in up["keywords"]):
                personalized.append(up)

        # Fallback to standard if no personalized matches
        if not personalized:
            personalized = all_updates[:3]

        return jsonify({
            "status": "success",
            "updates": personalized
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

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

        # Update in Supabase Auth (This requires Service Role Key or user token)
        # For now, we update the session. If user has Service Role Key, 
        # they should use it for the client.
        session['user_name'] = new_name
        session['user_email'] = new_email
        
        # Optional: Attempt to update metadata if client is capable
        # supabase.auth.update_user({"data": {"full_name": new_name}})
        
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
        data = request.get_json()
        # new_password = data.get("newPassword")
        
        # NOTE: Changing password via server-side session without 
        # service role key is restricted in Supabase for security.
        # This route should ideally be handled directly via frontend Supabase client.
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