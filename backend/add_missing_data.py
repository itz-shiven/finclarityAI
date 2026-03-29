import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI

# Load environment variables
load_dotenv()

# Initialize clients
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_embedding(text):
    try:
        response = openai_client.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None

# Products to add (Extracted from dashboard.js static data)
missing_products = [
    {
        "provider": "AXIS",
        "name": "AXIS Atlas",
        "category": "Cards",
        "details": "Joining Fee: ₹5,000 + GST. Annual Fee: ₹5,000 (5,000 Edge Miles reward). Reward Rate: 5% (Edge Miles) on Travel. Lounge Access: Unlimited Domestic + 8 Intl. Forex Markup: 3.5% + GST. Milestones: Up to 10,000 Miles on Spends. Best For: Frequent Flyers."
    },
    {
        "provider": "SBI",
        "name": "SBI Cashback Card",
        "category": "Cards",
        "details": "Joining Fee: ₹999 + GST. Annual Fee: ₹999 (Waived on ₹2L spend). Reward Rate: 5% Unlimited Cashback (Online). Lounge Access: None. Forex Markup: 3.5% + GST. Milestones: Fuel Surcharge Waiver. Best For: Online Shopping."
    },
    {
        "provider": "ICICI",
        "name": "Amazon Pay ICICI",
        "category": "Cards",
        "details": "Joining Fee: Lifetime Free (₹0). Annual Fee: Lifetime Free (₹0). Reward Rate: 5% for Prime Customers. Lounge Access: None. Forex Markup: 3.5% + GST. Milestones: Unlimited Earnings. Best For: Amazon Loyalists."
    },
    {
        "provider": "Star Health",
        "name": "Star Health Comprehensive",
        "category": "Insurance",
        "details": "Sum Insured: ₹5L - ₹1Cr. Premium: Starts at ₹12,000/yr. Waiting Period: 36 Months (PED). No Claim Bonus: Up to 100%. Restoration: 100% Automatic. OPD Cover: Included up to ₹5,000. Best For: Family Floater."
    },
    {
        "provider": "Kotak",
        "name": "Kotak 811",
        "category": "Savings",
        "details": "Min Balance: Zero Balance. Interest Rate: Up to 7% p.a. Debit Card: Virtual (Free). Account Type: Full Digital. Mobile App: Industry Leading. ATM Access: Any ATM. Best For: Digital Savvy Users."
    }
]

def add_products():
    for p in missing_products:
        print(f"Processing: {p['name']}...")
        content = f"Provider: {p['provider']}\nProduct: {p['name']}\nCategory: {p['category']}\nDetails: {p['details']}\nSource: Internal Database"
        
        vector = get_embedding(content)
        if not vector:
            continue
            
        try:
            supabase.table('financial_docs').insert({
                "content": content,
                "metadata": {
                    "provider": p['provider'],
                    "category": p['category'],
                    "product_name": p['name'],
                    "source": "internal_manual_fix"
                },
                "embedding": vector
            }).execute()
            print(f"Successfully added: {p['name']}")
        except Exception as e:
            print(f"Error inserting {p['name']}: {e}")

if __name__ == "__main__":
    add_products()
