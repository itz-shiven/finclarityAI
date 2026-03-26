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

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise Exception("Supabase env variables missing in chat.py")
if not OPENAI_API_KEY:
    raise Exception("OpenAI API key missing")

# Initialize clients using your updated method
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# -------------------------
# HELPER FUNCTIONS
# -------------------------
def get_embedding(text):
    """Converts text to a 1536-dimension vector using OpenAI."""
    try:
        response = openai_client.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"🚨 OpenAI Embedding Error: {e}")
        return None

def is_greeting(text):
    """Detects if the message is a simple greeting or casual small talk."""
    greetings = [
        r"\bhi\b", r"\bhello\b", r"\bhey\b", r"\bgood morning\b", 
        r"\bgood afternoon\b", r"\bgood evening\b", r"\bhow are you\b",
        r"\bwho are you\b", r"\bthanks\b", r"\bthank you\b", r"\bnamaste\b"
    ]
    text_lower = text.lower().strip()
    for pattern in greetings:
        if re.search(pattern, text_lower):
            return True
    
    if len(text_lower.split()) <= 2 and any(word in text_lower for word in ["hi", "hey", "hello"]):
        return True
    return False

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

        if not message:
            return jsonify({"reply": "Empty message"})

        print(f"\n🔍 [RAG] Processing query: '{message}'")
        
        # 1. Generate the vector for the user's question
        query_embedding = get_embedding(message)
        if not query_embedding:
            return jsonify({"reply": "I'm having trouble connecting to my knowledge base right now. Please try again in a moment.\n\nSource: 🤖 **System Error**"})

        # 2. Search Supabase for the best matches using your updated RPC call
        try:
            response = supabase.rpc(
                'match_financial_docs',
                {
                    'query_embedding': query_embedding,
                    'match_threshold': 0.3, 
                    'match_count': 5        
                }
            ).execute()
            docs = response.data
        except Exception as e:
            print(f"🚨 [RAG] Supabase Search Error: {e}")
            docs = []

        # ===== DEBUG: RAG SOURCE TRACKING =====
        print(f"[RAG DEBUG] Docs retrieved: {len(docs)}")
        for i, doc in enumerate(docs):
            print(f"  -> Match #{i+1} | similarity={doc.get('similarity', 'N/A'):.4f} | preview: {str(doc.get('content', ''))[:80]}...")
        # =======================================

        # 3. Context & Memory Injection
        if docs:
            rag_context = "\n\n".join([
                f"{doc.get('content', '')}\nSource: {doc.get('metadata', {}).get('source', 'Unknown')}"
                for doc in docs
            ])
            source_info = "SOURCE: 🏦 **Finclarity Database**"
        else:
            print("[RAG DEBUG] [WARNING] NO DOCS MATCHED - Using fallback logic.")
            if is_greeting(message):
                rag_context = "USER IS GREETING: This is casual small talk. You are NOT restricted by the 'NO DATA AVAILABLE' rule. Please greet the user warmly and naturally. Be varied in your greeting. Keep it to 1-2 sentences."
                source_info = "SOURCE: 🤖 **AI Knowledge**"
            else:
                rag_context = "❌ NO DATA AVAILABLE: There are no financial documents in the database matching this query. You MUST refuse to answer and tell the user to contact support or check back later. DO NOT use your training data to answer."
                source_info = "SOURCE: 🏦 **Finclarity Database** (Attempted)"

        memory_str = "\n".join(f"- {m}" for m in user_memory)
        memory_block = f"USER PROFILE MEMORY (Facts you learned in past sessions):\n{memory_str}\n\n" if memory_str else ""
        
        context = f"INFORMATION SOURCE: {source_info}\n\n{memory_block}{rag_context}"

        # 4. Master Prompt
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
- CASUAL SMALL TALK ALLOWED: If the user engages in normal human small talk, reply warmly and naturally in 1-2 sentences, then politely ask how you can help them with their finances.
- STRICTLY OUT OF DOMAIN: If the user asks complex non-financial questions or types random gibberish:
  - Do NOT attempt to answer the external question.
  - Reply with 1 short sentence politely refusing, reminding them you are a financial assistant.
- NO DATA IN DATABASE: If no matching financial documents exist in the database for the user's query:
  - You MUST refuse to answer.
  - Say: "I don't have information about this in my database. Please contact support or try rephrasing your question."

━━━━━━━━━━━━━━━━━━━
RESPONSE LOGIC & FORMATTING (STRICT)
━━━━━━━━━━━━━━━━━━━
- NEVER write long paragraphs. Max 1-2 lines per block.
- By default, ALL responses MUST be in bullet points unless the user explicitly asks for a paragraph.
- Break every idea into a new bullet.
- **BOLD IMPORTANT WORDS**: Use Markdown bold (`**text**`) for numbers, dates, terms, and key advice.
- **USE HEADERS**: Use `###` for sub-sections to make them stand out.
- Response should be scannable in 5 seconds.

━━━━━━━━━━━━━━━━━━━
CONTEXT & MEMORY USAGE (LONG & SHORT-TERM MEMORY)
━━━━━━━━━━━━━━━━━━━
- Always maintain continuity with the chat history.
- Always provide a highly personalized experience based on what you already know about the user.

━━━━━━━━━━━━━━━━━━━
STATE-OF-THE-ART PERMANENT FACT EXTRACTION
━━━━━━━━━━━━━━━━━━━
- If the user reveals a persistent, important personal fact about themselves (e.g., their salary, their city, their financial goals, their age, their debts), you MUST save it to your permanent memory vault.
- To save a fact to memory, include this exact tag anywhere in your response: [MEMORY: <fact>]
- Example: [MEMORY: User earns 50k INR per month]

🚨 MANDATORY SOURCE CITATION (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every single response without exception MUST end with a source citation. Place it at the VERY BOTTOM of your response, separated by a blank line.
Format:
Source: 🏦 **Finclarity Database** (If information came from context)
Source: 🤖 **AI Knowledge** (If greeting/small talk)
"""

        # 5. Assemble the LLM Payload
        messages = [{"role": "system", "content": system_prompt}]
        
        for msg in history[:-1]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            
        final_user_content = f"Context:\n{context}\n\nQuestion:\n{message}"
        
        if is_greeting(message):
            final_user_content += "\n\n(IMPORTANT: Use Source: 🤖 **AI Knowledge** and provide a varied greeting.)"
        else:
            final_user_content += f"\n\n(IMPORTANT: Based on the provided context, you must use {source_info} at the end of your response.)"
            
        messages.append({"role": "user", "content": final_user_content})

        # 6. Stream the Response to the Frontend
        def generate():
            print(f"[LLM DEBUG] Starting stream for GPT-4o-mini...")
            try:
                stream = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.7 if is_greeting(message) else 0.2,
                    max_tokens=600,
                    stream=True
                )

                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"
                        
            except Exception as e:
                print(f"🚨 [LLM ERROR]: {e}")
                yield f"data: {json.dumps({'chunk': ' An error occurred while generating the response.'})}\n\n"

        return flask.Response(generate(), mimetype='text/event-stream')

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