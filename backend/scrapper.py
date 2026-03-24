import os
import json
import time
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from supabase import create_client, Client
from openai import OpenAI

# Load environment variables
load_dotenv()

# Initialize API Clients (Gemini removed, fully reliant on OpenAI now)
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
firecrawl_app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# -------------------------
# 1. THE EMBEDDING GENERATOR
# -------------------------
def get_embedding(text):
    """
    Generates a 1536-dimension vector using OpenAI's highly accurate embedding model.
    """
    try:
        response = openai_client.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"🚨 OpenAI Embedding Error: {e}")
        return None

# -------------------------
# 2. THE DEEP CRAWL PIPELINE
# -------------------------
def run_financial_crawl(start_url, provider_name, service_name):
    print(f"🚀 Crawling {provider_name} ({service_name}) at: {start_url}")

    try:
        crawl_job = firecrawl_app.start_crawl(
            url=start_url,
            limit=100,
            scrape_options={"formats": ["markdown"]},
            max_discovery_depth=5,
            include_paths=[
                "cards", "loans", "insurance", "invest", 
                "accounts", "deposits", "wealth", "nri", 
                "fees", "terms", "faq"
            ],
            exclude_paths=[
                "careers", "about-us", "investor-relations", 
                "press", "news", "blog", "sustainability", 
                "locations", "branches", "atms"
            ]
        )
        
        crawl_id = crawl_job.id if hasattr(crawl_job, 'id') else crawl_job.get('id')
        print(f"✅ Crawl initiated. ID: {crawl_id}")
        
        while True:
            status_response = firecrawl_app.get_crawl_status(crawl_id)
            status = status_response.model_dump() if hasattr(status_response, 'model_dump') else (status_response.dict() if hasattr(status_response, 'dict') else status_response)
            
            current_state = status.get('status')
            
            if current_state == 'completed':
                data = status.get('data', [])
                print(f"✅ Crawl finished! Found {len(data)} pages.")
                process_and_save_data(data, provider_name, service_name)
                break
            elif current_state == 'failed':
                print("🚨 Crawl failed.")
                break
            
            print("⏳ Crawling in progress... waiting 10 seconds.")
            time.sleep(10)
            
    except Exception as e:
        print(f"🚨 Error starting crawl: {e}")

# -------------------------
# 3. THE AI FILTER & DATABASE INSERTION
# -------------------------
def process_and_save_data(crawled_pages, provider_name, service_name):
    print(f"🧠 Passing {provider_name} {service_name} data through OpenAI (gpt-4o-mini) and generating embeddings...")
    
    for page in crawled_pages:
        raw_markdown = page.get('markdown', '')
        source_url = page.get('metadata', {}).get('sourceURL', 'Unknown URL')
        
        if not raw_markdown or len(raw_markdown) < 100:
            continue
            
        # Still cap at 40k characters to keep token costs extremely low
        safe_markdown = raw_markdown[:40000] 
        
        try:
            # 1. Extract JSON facts via OpenAI gpt-4o-mini
            completion = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system", 
                        "content": """You are an expert financial data analyst. Read the markdown from this bank's website and extract all distinct financial products. 
                        
                        Return a strict JSON object with a single key 'products' containing an array of objects. 
                        Each object MUST have these exact string keys:
                        - 'product_name': The exact name of the card, loan, or account.
                        - 'category': The type of product (e.g., 'Credit Card', 'Personal Loan', 'Savings Account').
                        - 'details': A highly detailed summary. You MUST include specific numbers if found: interest rates (APR), annual/joining fees, key reward benefits, eligibility criteria, and penalty charges."""
                    },
                    {
                        "role": "user", 
                        "content": f"Please extract the financial products from this raw markdown:\n\n{safe_markdown}"
                    }
                ],
                response_format={"type": "json_object"}
            )
            
            response_text = completion.choices[0].message.content
            extracted_data = json.loads(response_text)
            extracted_products = extracted_data.get('products', [])
            
            # 2. Process each specific product
            for product in extracted_products:
                product_name = product.get('product_name', 'Unknown')
                category = product.get('category', 'Unknown')
                details = product.get('details', '')
                
                print(f"💾 Processing: {product_name} from {source_url}")
                
                content_chunk = f"Provider: {provider_name}\nService: {service_name}\nProduct: {product_name}\nCategory: {category}\nDetails: {details}\nSource: {source_url}"
                
                # 3. Generate OpenAI Vector (1536 dimensions)
                vector = get_embedding(content_chunk)
                if not vector:
                    print(f"⚠️ Skipping insertion for {product_name} due to embedding failure.")
                    continue
                
                # 4. Insert directly into Supabase WITH rich metadata tags
                supabase.table('financial_docs').insert({
                    "content": content_chunk,
                    "metadata": {
                        "provider": provider_name,
                        "service_type": service_name,
                        "source": source_url, 
                        "category": category,
                        "product_name": product_name
                    },
                    "embedding": vector
                }).execute()
                
                print(f"✅ Successfully vaulted: {product_name}")
                
        except Exception as e:
            print(f"⚠️ Error processing page {source_url}: {e}")
            
        # The ultimate speed upgrade: Just a half-second breather instead of 13 seconds
        time.sleep(0.5) 

# -------------------------
# 4. EXECUTION & TARGET PARSING
# -------------------------
if __name__ == "__main__":
    print("📂 Locating targets.json...")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, 'targets.json')
    
    try:
        with open(json_path, 'r') as file:
            targets = json.load(file)
            
        if not targets:
            print("⚠️ No targets found in targets.json.")
        else:
            print(f"🎯 Found {len(targets)} services to map. Starting batch crawl...\n")
            
            for target in targets:
                provider = target.get("provider_name", "Unknown Provider")
                service = target.get("service_name", "Unknown Service")
                product_url = target.get("product_url")
                terms_url = target.get("terms_url")
                
                print(f"\n=========================================")
                print(f"🏦 INITIALIZING: {provider} - {service}")
                print(f"=========================================")
                
                if product_url:
                    run_financial_crawl(product_url, provider, service)
                    # We keep this 35s sleep to respect Firecrawl's free tier limits between sites
                    time.sleep(35) 
                    
                if terms_url:
                    print(f"\n📄 Engaging separate Terms & Conditions crawl for {provider}...")
                    run_financial_crawl(terms_url, provider, service)
                    time.sleep(35)
                    
            print("\n🎉 ALL TARGETS CRAWLED AND VAULTED SUCCESSFULLY!")

    except FileNotFoundError:
        print(f"🚨 Error: Could not find the file at {json_path}")
    except json.JSONDecodeError:
        print("🚨 Error: 'targets.json' is not valid JSON. Check for missing commas or quotes.")