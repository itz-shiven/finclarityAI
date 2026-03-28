from supabase import create_client
import os

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

def search_documents(query_embedding, chat_mode="pro"):
    try:
        response = supabase.rpc(
            'match_financial_docs',
            {
                'query_embedding': query_embedding,
                'match_threshold': 0.45,
                'match_count': 3 if chat_mode == "free" else 5
            }
        ).execute()

        return response.data or []
    except Exception as e:
        print(f"[Vector Search Error] {e}")
        return []