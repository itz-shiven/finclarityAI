import os
import requests
from dotenv import load_dotenv

load_dotenv('d:/1 hackathon/finclarityAI/backend/.env')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# Check columns of user 1 or any user
res = requests.get(f"{SUPABASE_URL}/rest/v1/users?limit=1", headers=HEADERS)
print("GET users response:")
print(res.status_code)
print(res.json())

# Check tables
# In PostgREST, we can sometimes hit the root to see OpenAPI spec
res_spec = requests.get(f"{SUPABASE_URL}/rest/v1/", headers={"apikey": SUPABASE_KEY})
# if it's too big we just look at the keys
data = res_spec.json()
if "definitions" in data:
    print("\nTables found in OpenAPI spec:")
    for table_name, schema in data["definitions"].items():
        print(f"- {table_name}")
        if table_name == "users" or table_name == "chats":
            print(f"  Columns for {table_name}: ", list(schema.get("properties", {}).keys()))
