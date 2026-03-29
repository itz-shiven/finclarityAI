import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

def remove_manual_data():
    try:
        res = supabase.table('financial_docs').delete().eq("metadata->>source", "internal_manual_fix").execute()
        print(f"Deleted records: {len(res.data) if res.data else 0}")
    except Exception as e:
        print(f"Error deleting: {e}")

if __name__ == "__main__":
    remove_manual_data()
