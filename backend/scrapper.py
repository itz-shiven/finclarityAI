import os
import json
import time
from dotenv import load_dotenv
from supabase import create_client, Client
from firecrawl import Firecrawl 
from sentence_transformers import SentenceTransformer
import google.generativeai as genai

# -------------------------
# 1. SETUP & AUTH
# -------------------------
load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") 
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
firecrawl_app = Firecrawl(api_key=FIRECRAWL_API_KEY)

print("⏳ Loading Vector Embedding Model...")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2') 

print("⏳ Loading Gemini 2.5 Flash (The Data Cleaner)...")
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel('gemini-2.5-flash')
print("✅ All AI Systems Loaded!")

# -------------------------
# 2. THE CHUNKER
# -------------------------
def chunk_text(text, max_words=150):
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = ""
    for p in paragraphs:
        if len(current_chunk.split()) + len(p.split()) < max_words:
            current_chunk += p + "\n\n"
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = p + "\n\n"
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    return chunks

# -------------------------
# 3. THE ETL ENGINE
# -------------------------
def process_target(url, provider_name, service_name, doc_type):
    print(f"\n🕷️ Crawling {doc_type.upper()} page: {url}")
    try:
        # Step A: Leashed Crawl (Max 3 pages to catch PDFs but prevent infinite loops)
        # 🔥 Updated to the newest Firecrawl SDK syntax
        crawl_result = firecrawl_app.crawl(
            url, 
            limit=3,
            scrape_options={'formats': ['markdown']},
            poll_interval=2
        )
        
        # 🔥 Failsafe Data Extractor (Handles both Objects and Dictionaries)
        pages = crawl_result.data if hasattr(crawl_result, 'data') else crawl_result.get('data', [])
        
        raw_markdown = ""
        for page in pages:
            md = page.markdown if hasattr(page, 'markdown') else page.get('markdown', '')
            if md:
                raw_markdown += md + "\n\n"
            
        if not raw_markdown.strip():
            print("   ⚠️ No text found, skipping.")
            return False
            
        print(f"   ✅ Crawled {len(raw_markdown)} characters. Handing off to Gemini Flash...")
        
        # Step B: LLM Interceptor (Cleaning the Data)
        if doc_type == "product":
            prompt = f"""You are a financial data extractor. Read this messy website data.
            Extract all the factual features, interest rates, rewards, and benefits.
            Remove all marketing fluff, navigation menus, and junk. Return clean, structured paragraphs.
            Raw Data: {raw_markdown}"""
        else:
            prompt = f"""You are a strict financial auditor. Read these Terms and Conditions.
            Find every single hidden fee, penalty charge, lock-in period, and red flag.
            List them out clearly as bullet points. Do not miss anything.
            Raw Data: {raw_markdown}"""
            
        response = gemini_model.generate_content(prompt)
        clean_data = response.text
        
        print(f"   🧠 Gemini cleaned the data! New optimized size: {len(clean_data)} characters.")
        
        # Step C: Chunk & Embed the CLEAN data
        chunks = chunk_text(clean_data)
        for chunk in chunks:
            embedding = embedding_model.encode(chunk).tolist() 
            
            supabase.table("financial_docs").insert({
                "url": url,
                "content": chunk,
                "embedding": embedding,
                "provider_name": provider_name,
                "service_name": service_name,
                "doc_type": doc_type
            }).execute()
            
        print(f"   💾 Saved {len(chunks)} ultra-clean chunks to Database.")
        return True

    except Exception as e:
        print(f"   🚨 Error processing {url}: {str(e)}")
        return False

# -------------------------
# 4. THE MASTER LOOP
# -------------------------
if __name__ == "__main__":
    print("\n🚀 Starting FinClarity AI ETL Pipeline...")
    
    # 🔥 Bulletproof Path Fix (Forces Python to find the file)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, 'targets.json')
    
    try:
        with open(json_path, 'r') as file:
            targets = json.load(file)
    except FileNotFoundError:
        print(f"🚨 targets.json not found! I am looking exactly here: {json_path}")
        exit()

    for target in targets:
        provider = target['provider_name']
        service = target['service_name']
        
        print(f"\n========================================")
        print(f"🏦 Processing: {provider} - {service}")
        print(f"========================================")
        
        # Process Marketing Page
        process_target(target['product_url'], provider, service, "product")
        
        # Process T&C / PDF Pages
        process_target(target['terms_url'], provider, service, "terms")
        
        # 🔥 ADD THESE TWO LINES RIGHT HERE
        print("\n⏳ Pausing for 25 seconds to respect Firecrawl's speed limits...")
        time.sleep(25) 
        
    # Make sure this final print statement is OUTSIDE the loop (no indentation)
    print("\n✅ All targets processed successfully! Your AI is now a genius.")