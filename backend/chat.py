import os
import re
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI

# Load environment variables
load_dotenv(override=True)

# -------------------------
# INITIALIZE CLIENTS
# -------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise Exception("Supabase env variables missing in chat.py")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
# THE MAIN RAG PIPELINE
# -------------------------
def get_answer(message, history=[], user_memory=[]):
    print(f"\n🔍 [RAG] Processing query: '{message}'")
    
    # 1. Generate the vector for the user's question
    query_embedding = get_embedding(message)
    if not query_embedding:
        return "I'm having trouble connecting to my knowledge base right now. Please try again in a moment.\n\nSource: 🤖 **System Error**"

    # 2. Search Supabase for the best matches
    # We use the new 1536-dimension RPC we created earlier
    try:
        response = supabase.rpc(
            'match_financial_docs',
            {
                'query_embedding': query_embedding,
                'match_threshold': 0.3, # Returns good matches
                'match_count': 5        # Grabs top 5 chunks for context
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

    # 4. Your Master Prompt (Preserved perfectly)
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
    
    # Inject chat history
    for msg in history[:-1]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        
    # Inject current question and context
    final_user_content = f"Context:\n{context}\n\nQuestion:\n{message}"
    
    if is_greeting(message):
        final_user_content += "\n\n(IMPORTANT: Use Source: 🤖 **AI Knowledge** and provide a varied greeting.)"
    else:
        final_user_content += f"\n\n(IMPORTANT: Based on the provided context, you must use {source_info} at the end of your response.)"
        
    messages.append({"role": "user", "content": final_user_content})

    # 6. Call OpenAI
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7 if is_greeting(message) else 0.2, # Precise for finance, creative for greetings
            max_tokens=600
        )
        return completion.choices[0].message.content
    except Exception as e:
        print(f"🚨 [RAG] OpenAI Chat Error: {e}")
        return "I'm currently experiencing a technical hiccup. Please try asking your question again.\n\nSource: 🤖 **System Error**"