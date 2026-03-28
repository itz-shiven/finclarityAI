import os
import json
import re
import flask
from flask import Blueprint, request, jsonify, session
from openai import OpenAI
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(override=True)

# -------------------------
# SETUP & CLIENTS
# -------------------------
chat_bp = Blueprint('chat_bp', __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
CHATBOT_OPENAI_MODEL = os.getenv("CHATBOT_OPENAI_MODEL", "gpt-4o-mini")
CHATBOT_OPENROUTER_MODEL = os.getenv("CHATBOT_OPENROUTER_MODEL", "liquid/lfm-2.5-1.2b-instruct:free")
CHATBOT_OPENROUTER_FALLBACK_MODEL = os.getenv("CHATBOT_OPENROUTER_FALLBACK_MODEL")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise Exception("Supabase env variables missing in chat.py")
if not OPENAI_API_KEY:
    raise Exception("OpenAI API key missing")

# Initialize clients using your updated method
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)
openrouter_client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1"
) if OPENROUTER_API_KEY else None

# -------------------------
# HELPER FUNCTIONS
# -------------------------
def is_greeting(text):
    """Detects if the message is a simple greeting or casual small talk."""
    greetings = [
        r"\bhi\b", r"\bhello\b", r"\bhey\b", r"\bgood morning\b", 
        r"\bgood afternoon\b", r"\bgood evening\b", r"\bhow are you\b",
        r"\bwho are you\b", r"\bwho r u\b", r"\bwho are u\b", r"\bwhat are you\b",
        r"\bthanks\b", r"\bthank you\b", r"\bnamaste\b", r"\bhii+\b", r"\bhelo+\b"
    ]
    text_lower = text.lower().strip()
    for pattern in greetings:
        if re.search(pattern, text_lower):
            return True
    
    if len(text_lower.split()) <= 2 and any(word in text_lower for word in ["hi", "hey", "hello"]):
        return True
    return False


def is_small_talk_or_identity_query(text):
    text_lower = (text or "").lower().strip()
    if is_greeting(text_lower):
        return True

    patterns = [
        r"\bwho are (you|u)\b",
        r"\bwhat can you do\b",
        r"\bwhat do you do\b",
        r"\btell me about yourself\b",
        r"\bhow does this work\b",
        r"\bare you ai\b",
        r"\bwhat is finclarity\b",
        r"\bhelp\b"
    ]
    return any(re.search(pattern, text_lower) for pattern in patterns)


def build_small_talk_reply(message):
    text_lower = (message or "").lower().strip()
    if re.search(r"\bwho are (you|u)\b|\bwhat are you\b|\btell me about yourself\b", text_lower):
        return (
            "### About Me\n"
            "- I am **Finclarity AI**, your finance assistant for **cards, loans, savings, investing, and comparisons**.\n"
            "- I can answer from the **Finclarity Database** when product data exists, and I can also help with simple finance guidance and chat.\n\n"
            "Source: 🤖 **AI Knowledge**"
        )

    if re.search(r"\bwhat can you do\b|\bhelp\b|\bhow does this work\b", text_lower):
        return (
            "### How I Help\n"
            "- I can help with **financial product comparisons, planning questions, savings, loans, cards, and investing topics**.\n"
            "- Ask me something specific, and if your database has matching product info I will use that too.\n\n"
            "Source: 🤖 **AI Knowledge**"
        )

    return build_instant_greeting_reply()


def requires_database_lookup(text):
    text_lower = (text or "").lower().strip()
    patterns = [
        r"\bcompare\b",
        r"\bvs\b",
        r"\bcredit card\b",
        r"\bloan\b",
        r"\binterest rate\b",
        r"\bprocessing fee\b",
        r"\bannual fee\b",
        r"\bjoining fee\b",
        r"\bforex markup\b",
        r"\beligibility\b",
        r"\blounge access\b",
        r"\breward rate\b",
        r"\bbrokerage\b",
        r"\bamc\b",
        r"\bfeatures of\b",
        r"\bdetails of\b",
        r"\bhdfc\b",
        r"\bsbi\b",
        r"\baxis\b",
        r"\bicici\b",
        r"\bkotak\b",
        r"\bamex\b",
        r"\bindusind\b",
        r"\byes bank\b",
        r"\bbajaj\b"
    ]
    return any(re.search(pattern, text_lower) for pattern in patterns)

def build_rag_search_query(message, history):
    """Expands follow-up prompts with recent context so retrieval stays on-topic."""
    recent_turns = []
    for msg in history[-4:]:
        role = msg.get("role", "user")
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        recent_turns.append(f"{role}: {content}")

    if not recent_turns:
        return message

    return f"Conversation so far:\n" + "\n".join(recent_turns) + f"\n\nLatest user question:\n{message}"

def get_chat_model_config(chat_mode):
    """Chatbot-only provider switch. Other tabs continue using OpenAI directly."""
    if chat_mode == "free" and openrouter_client:
        return {
            "client": openrouter_client,
            "model": CHATBOT_OPENROUTER_MODEL,
            "fallback_model": CHATBOT_OPENROUTER_FALLBACK_MODEL,
            "label": "Free"
        }

    return {
        "client": openai_client,
        "model": CHATBOT_OPENAI_MODEL,
        "fallback_model": None,
        "label": "Pro"
    }


def default_subscription_data():
    return {
        "plan": "free",
        "status": "inactive",
        "selected_chat_mode": "free"
    }


def get_user_subscription(user_id):
    try:
        response = supabase.table("user_data").select("chats").eq("user_id", user_id).limit(1).execute()
        if not response.data:
            return default_subscription_data()

        chats = response.data[0].get("chats")
        if not isinstance(chats, dict):
            return default_subscription_data()

        subscription = chats.get("subscription")
        if not isinstance(subscription, dict):
            return default_subscription_data()

        plan = str(subscription.get("plan") or "free").lower()
        status = str(subscription.get("status") or "inactive").lower()
        selected_mode = str(subscription.get("selected_chat_mode") or "free").lower()

        return {
            "plan": "premium" if plan == "premium" else "free",
            "status": "active" if plan == "premium" and status == "active" else "inactive",
            "selected_chat_mode": "pro" if selected_mode == "pro" and plan == "premium" and status == "active" else "free"
        }
    except Exception as exc:
        print(f"[CHAT SUBSCRIPTION ERROR] {exc}")
        return default_subscription_data()

def is_mode_query(text):
    text_lower = (text or "").lower().strip()
    patterns = [
        "which model are you",
        "what model are you",
        "which mode are you",
        "what mode are you",
        "which provider are you",
        "what provider are you",
        "are you in free mode",
        "are you in pro mode"
    ]
    return any(pattern in text_lower for pattern in patterns)

def build_database_only_refusal():
    return (
        "### Data Not Found\n"
        "- I don't have information about this in my database.\n"
        "- Please contact support or try rephrasing your question.\n\n"
        "Source: **Finclarity Database** (No matching data)"
    )

def build_instant_greeting_reply():
    return (
        "### Hello\n"
        "- Hey! I can help with **cards, loans, savings, investing, and product comparisons**.\n"
        "- Ask me a finance question and I'll answer from the **Finclarity Database** when matching data is available.\n\n"
        "Source: 🤖 **AI Knowledge**"
    )

def build_sse_response(reply_text, model_config):
    def generate_once():
        yield f"data: {json.dumps({'meta': {'provider': model_config['label'], 'model': model_config['model']}})}\n\n"
        yield f"data: {json.dumps({'chunk': reply_text})}\n\n"

    response = flask.Response(generate_once(), mimetype='text/event-stream')
    response.headers["X-Chat-Provider"] = model_config["label"]
    response.headers["X-Chat-Model"] = model_config["model"]
    response.headers["Chat-Provider"] = model_config["label"]
    response.headers["Chat-Model"] = model_config["model"]
    response.headers["Access-Control-Expose-Headers"] = "X-Chat-Provider, X-Chat-Model, Chat-Provider, Chat-Model"
    return response

def create_chat_completion(client, model, messages, temperature, max_tokens, stream=False):
    return client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=stream
    )

# -------------------------
# THE MAIN CHAT ROUTE (STREAMING RAG PIPELINE)
# -------------------------
@chat_bp.route("/chat", methods=["POST"])
def chat():
    try:
        if 'is_guest' not in session and 'user_id' not in session:
            return jsonify({"status": "error", "message": "Please login"}), 401

        data = request.get_json()
        message = data.get("message")
        history = data.get("history", [])
        user_memory = data.get("user_memory", [])
        chat_mode = (data.get("chat_mode") or "pro").lower()
        if 'user_id' in session:
            subscription = get_user_subscription(session['user_id'])
            premium_active = subscription.get("plan") == "premium" and subscription.get("status") == "active"
            if not premium_active and chat_mode == "pro":
                chat_mode = "free"

        if not message:
            return jsonify({"reply": "Empty message"})

        print(f"\n🔍 [RAG] Processing query: '{message}'")
        
        model_config = get_chat_model_config(chat_mode)

        small_talk_query = is_small_talk_or_identity_query(message)
        database_required = requires_database_lookup(message)

        if model_config["label"] == "Free" and small_talk_query:
            direct_reply = build_small_talk_reply(message)
            print(f"[LLM DEBUG] Instant greeting reply using {model_config['label']} / {model_config['model']}")
            return build_sse_response(direct_reply, model_config)

        if model_config["label"] == "Free" and is_mode_query(message):
            direct_reply = (
                f"### Current Mode\n"
                f"- You are chatting with **{model_config['label']}** mode.\n"
                f"- Current model: **{model_config['model']}**.\n\n"
                f"Source: ðŸ¤– **System Configuration**"
            )
            print(f"[LLM DEBUG] Instant mode reply using {model_config['label']} / {model_config['model']}")
            return build_sse_response(direct_reply, model_config)

        # -------------------------
        # RAG RETRIEVAL (CLEAN)
        # -------------------------
        from services.rag_service import retrieve_context

        docs, status = retrieve_context(message, history, chat_mode)

        docs = [doc for doc in docs if float(doc.get("similarity") or 0) >= 0.45]

        # ===== DEBUG: RAG SOURCE TRACKING =====
        print(f"[RAG DEBUG] Docs retrieved: {len(docs)}")
        for i, doc in enumerate(docs):
            print(f"  -> Match #{i+1} | similarity={doc.get('similarity', 'N/A'):.4f} | preview: {str(doc.get('content', ''))[:80]}...")
        # =======================================

        if not docs and small_talk_query:
            print("[RAG DEBUG] No docs matched, but query is small talk/identity. Routing to AI knowledge response.")
            return build_sse_response(build_small_talk_reply(message), model_config)

        if not docs and database_required:
            print("[RAG DEBUG] [WARNING] NO DOCS MATCHED - Refusing with database-only response.")
            return build_sse_response(build_database_only_refusal(), model_config)

        # 3. Context & Memory Injection
        if docs:
            rag_context = "\n\n".join([
                f"{doc.get('content', '')}\nSource: {doc.get('metadata', {}).get('source', 'Unknown')}"
                for doc in docs
            ])
            source_info = "SOURCE: 🏦 **Finclarity Database**"
        else:
            print("[RAG DEBUG] [INFO] NO DOCS MATCHED - Using AI knowledge fallback.")
            if small_talk_query:
                rag_context = "The user is making casual conversation or asking about Finclarity AI itself. Reply naturally, briefly, and helpfully."
                source_info = "SOURCE: 🤖 **AI Knowledge**"
            else:
                rag_context = "❌ NO DATA AVAILABLE: There are no financial documents in the database matching this query. You MUST refuse to answer and tell the user to contact support or check back later. DO NOT use your training data to answer."
                source_info = "SOURCE: 🏦 **Finclarity Database** (Attempted)"

        if not docs and not small_talk_query and not database_required:
            rag_context = (
                "The user is asking a general finance question that does not require database-only product facts. "
                "You may answer using broad financial knowledge. Keep the answer practical, simple, and educational. "
                "Do not invent Finclarity database facts or specific product claims."
            )
            source_info = "SOURCE: 🤖 **AI Knowledge**"

        memory_str = "\n".join(f"- {m}" for m in user_memory)
        memory_block = f"USER PROFILE MEMORY (Facts you learned in past sessions):\n{memory_str}\n\n" if memory_str else ""
        
        context = f"INFORMATION SOURCE: {source_info}\n\n{memory_block}{rag_context}"
        from services.decision_service import generate_decision

        decision_block = generate_decision(docs, message, user_memory)

        if decision_block:
            context += "\n\nIMPORTANT DECISION:\n" + decision_block

        # 4. Master Prompt
        system_prompt = """
🔒 IMPORTANT: DOMAIN RESTRICTION & SOURCE USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are Finclarity AI — a specialized Financial Assistant for Indian users.
Your strictly enforced domain is FINANCE, BANKING, INVESTING, TAXES, and MONEY MANAGEMENT.

DOMAIN RULES:
1. **FINANCIAL ADVICE/GUIDANCE**: If a user asks for financial guidance (budgeting, savings tips, general finance help), and it's NOT product-specific, use your internal AI Knowledge to provide a helpful, practical response.
2. **DATABASE PRODUCTS**: If a user asks about specific cards, loans, or institutions, use the provided CONTEXT. If context says "❌ NO DATA AVAILABLE", refuse based on that specific product.
3. **STRICT REFUSAL (OUT-OF-DOMAIN)**: If a user asks non-financial questions, you MUST politely refuse.
   - **REFUSE**: Travel, Directions (e.g., "How to go to Chandigarh?"), Sports, Cooking, Geography, Science, Arts, or non-finance general knowledge.
   - **REFUSE RESPONSE**: "I am a financial assistant and I can only help you with questions related to cards, loans, investing, and money management. How can I help you with your finances today?"

━━━━━━━━━━━━━━━━━━━
OUT OF DOMAIN & SMALL TALK HANDLING
━━━━━━━━━━━━━━━━━━━
- CASUAL SMALL TALK: If the user says "Hi", "How are you?", or asks "Who are you?", reply warmly in 1-2 sentences, then ask how you can help with their finances.
- CLEAR OFF-TOPIC: For questions about anything other than finance, banking, or investing:
  - You MUST refuse. Do NOT try to answer the question even halfway.
- NO DATA IN DATABASE: If the user asks for a specific product and matching documents aren't found:
  - Say: "I don't have information about this specific item in my database. Please contact support or try rephrasing."
- ADVICE & GUIDANCE: If no matching product documents exist BUT the query is about general financial advice (e.g., "How to save 10% of my income?"):
  - Provide helpful financial guidance using AI knowledge.

━━━━━━━━━━━━━━━━━━━
RESPONSE FORMATTING (STRICT)
━━━━━━━━━━━━━━━━━━━
- NEVER write long paragraphs. Max 1-2 lines per block.
- Use bullet points for almost everything.
- **BOLD** numbers, dates, and key advice.
- Use `###` headers for sections.

🚨 SOURCE CITATION (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bottom of response:
Source: 🏦 **Finclarity Database** (If product-specific facts were used)
Source: 🤖 **AI Knowledge** (If greeting or general financial advice)
"""

        # 5. Assemble the LLM Payload
        messages = [{"role": "system", "content": system_prompt}]
        
        for msg in history[:-1]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            
        final_user_content = f"""
        Context:
        {context}

        User Question:
        {message}

        IMPORTANT:
        - If there is a section titled 'Final Recommendation', you MUST include it in your answer.
        - Do NOT ignore recommendation sections.
        """
        
        if is_greeting(message):
            final_user_content += "\n\n(IMPORTANT: Use Source: 🤖 **AI Knowledge** and provide a varied greeting.)"
        elif "AI Knowledge" in source_info:
            final_user_content += "\n\n(IMPORTANT: This is a general AI-knowledge question, not a database-only lookup. Answer helpfully using general financial knowledge and end with Source: 🤖 **AI Knowledge**.)"
        else:
            final_user_content += f"\n\n(IMPORTANT: Based on the provided context, you must use {source_info} at the end of your response.)"
            
        messages.append({"role": "user", "content": final_user_content})

        # 6. Stream the Response to the Frontend
        def generate():
            active_model = model_config["model"]
            temperature = 0.1
            max_tokens = 350 if model_config["label"] == "Free" else 600
            print(f"[LLM DEBUG] Starting stream for {active_model} ({model_config['label']})...")
            try:
                full_reply = ""
                yield f"data: {json.dumps({'meta': {'provider': model_config['label'], 'model': active_model}})}\n\n"
                stream = create_chat_completion(
                    client=model_config["client"],
                    model=active_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True
                )

                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_reply += content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"

                if not full_reply.strip():
                    print(f"[LLM DEBUG] Empty stream from {active_model}, retrying without streaming...")
                    retry_res = create_chat_completion(
                        client=model_config["client"],
                        model=active_model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    retry_content = (retry_res.choices[0].message.content or "").strip()
                    if retry_content:
                        full_reply = retry_content
                        yield f"data: {json.dumps({'chunk': retry_content})}\n\n"

                print(f"[LLM DEBUG] Provider={model_config['label']} Model={active_model}")
                print(f"[LLM DEBUG] User message: {message}")
                print(f"[LLM DEBUG] Final reply: {full_reply}")

                # 🔥 ADD HERE (NOT ABOVE, NOT INSIDE IF)

                try:
                    from services.decision_service import generate_decision
                    decision_block = generate_decision(docs, message, user_memory)

                    if decision_block:
                        full_reply += "\n\n" + decision_block

                except Exception as e:
                    print(f"[DECISION ERROR] {e}")
                        
            except Exception as e:
                if model_config["label"] == "Free" and model_config.get("fallback_model") and active_model != model_config["fallback_model"]:
                    fallback_model = model_config["fallback_model"]
                    print(f"[LLM DEBUG] Primary free model failed ({active_model}). Retrying with fallback {fallback_model}...")
                    try:
                        fallback_res = create_chat_completion(
                            client=model_config["client"],
                            model=fallback_model,
                            messages=messages,
                            temperature=temperature,
                            max_tokens=max_tokens
                        )
                        fallback_content = (fallback_res.choices[0].message.content or "").strip()
                        yield f"data: {json.dumps({'meta': {'provider': model_config['label'], 'model': fallback_model}})}\n\n"
                        if fallback_content:
                            print(f"[LLM DEBUG] Fallback free model succeeded: {fallback_model}")
                            yield f"data: {json.dumps({'chunk': fallback_content})}\n\n"
                            return
                    except Exception as fallback_error:
                        print(f"[LLM DEBUG] Fallback free model failed: {fallback_error}")
                print(f"🚨 [LLM ERROR]: {e}")
                yield f"data: {json.dumps({'error': str(e), 'provider': model_config['label'], 'model': active_model})}\n\n"
                yield f"data: {json.dumps({'chunk': ' An error occurred while generating the response.'})}\n\n"

        response = flask.Response(generate(), mimetype='text/event-stream')
        response.headers["X-Chat-Provider"] = model_config["label"]
        response.headers["X-Chat-Model"] = model_config["model"]
        response.headers["Chat-Provider"] = model_config["label"]
        response.headers["Chat-Model"] = model_config["model"]
        response.headers["Access-Control-Expose-Headers"] = "X-Chat-Provider, X-Chat-Model, Chat-Provider, Chat-Model"
        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"reply": "[ERROR] Server error\n\nSource: 🤖 **System Error Handler**"})


# -------------------------
# PRODUCT COMPARISON ROUTES
# -------------------------
@chat_bp.route("/api/compare_product", methods=["POST"])
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

        search_query = f"{provider} {product_name} {category} features fees interest benefits"
        query_embedding = get_embedding(search_query)

        # Updated to use your new RPC
        try:
            response = supabase.rpc(
                'match_financial_docs',
                {
                    'query_embedding': query_embedding,
                    'match_threshold': 0.35,
                    'match_count': 10
                }
            ).execute()
            docs = response.data
        except Exception as e:
            print(f"🚨 Supabase Error in compare_product: {e}")
            docs = []
        
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

        print(f"[COMPARE DEBUG] Fetching JSON for {product_name}...")

        ai_res = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.1,
            max_tokens=300
        )

        reply = ai_res.choices[0].message.content.strip()
        
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

@chat_bp.route("/api/product_details", methods=["POST"])
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

        search_query = f"EXHAUSTIVE DETAILS for {provider} {product_name} {category}: benefits, fees, charges, eligibility, documents required, pros cons, terms and conditions"
        query_embedding = get_embedding(search_query)

        # Updated to use your new RPC
        try:
            response = supabase.rpc(
                'match_financial_docs',
                {
                    'query_embedding': query_embedding,
                    'match_threshold': 0.3,
                    'match_count': 15
                }
            ).execute()
            docs = response.data
        except Exception as e:
            print(f"🚨 Supabase Error in product_details: {e}")
            docs = []
        
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

        ai_res = openai_client.chat.completions.create(
            model="gpt-4o",
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
