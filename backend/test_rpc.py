import os
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_KEY = os.getenv("OPENAI_API_KEY")

from supabase import create_client
import httpx

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_embed(text):
    res = httpx.post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": f"Bearer {OPENAI_KEY}"},
        json={"input": text, "model": "text-embedding-3-small"}
    )
    return res.json()["data"][0]["embedding"]

q = "HDFC HDFC Regalia Gold Cards features fees interest benefits"
vector = get_embed(q)

response = sb.rpc(
    'match_financial_docs',
    {
        'query_embedding': vector,
        'match_threshold': 0.35,
        'match_count': 10
    }
).execute()

docs = response.data
print(f"Num docs found at 0.35: {len(docs)}")

product_name = "HDFC Regalia Gold"
product_words = [w.lower() for w in product_name.split() if len(w) > 2]
print(f"Words: {product_words}")

filtered_docs = []
for doc in docs:
    content_lower = doc.get('content', '').lower()
    if any(w in content_lower for w in product_words):
        filtered_docs.append(doc)

print(f"Num docs after filter: {len(filtered_docs)}")
