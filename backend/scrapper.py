import os
from dotenv import load_dotenv
from supabase import create_client, Client
from firecrawl import Firecrawl 
from sentence_transformers import SentenceTransformer

# -------------------------
# 1. SETUP & AUTH
# -------------------------
load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") # 🚨 Must be your service_role key
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
firecrawl_app = Firecrawl(api_key=FIRECRAWL_API_KEY)

print("⏳ Loading AI Embedding Model... (This takes a few seconds the first time)")
# all-MiniLM-L6-v2 outputs exactly 384 dimensions, perfectly matching our pgvector table
model = SentenceTransformer('all-MiniLM-L6-v2') 
print("✅ AI Model Loaded!")


# -------------------------
# 2. THE CHUNKER
# -------------------------
def chunk_text(text, max_words=150):
    """
    AI models have small attention spans. This function breaks a massive 
    article into bite-sized chunks of roughly 150 words without breaking paragraphs.
    """
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
# 3. THE MAIN PIPELINE
# -------------------------
def process_and_store_article(url):
    print(f"\n🔥 Step 1: Firecrawl scraping {url}...")
    try:
        # Scrape
        scrape_result = firecrawl_app.scrape(url, formats=['markdown'])
        markdown_text = scrape_result.markdown # Using your working fix!
        
        if not markdown_text:
            print("⚠️ No text found on page.")
            return False
            
        print(f"✅ Extracted {len(markdown_text)} characters.")
        
        # Chunk
        print("🧩 Step 2: Chunking text...")
        chunks = chunk_text(markdown_text)
        print(f"✅ Split article into {len(chunks)} chunks.")
        
        # Embed & Upload
        print("🧠 Step 3: Generating Embeddings & Uploading to Supabase...")
        for i, chunk in enumerate(chunks):
            # Convert text to a 384-dimensional vector
            embedding = model.encode(chunk).tolist() 
            
            # Push to your Supabase pgvector table
            supabase.table("financial_docs").insert({
                "url": url,
                "content": chunk,
                "embedding": embedding
            }).execute()
            
            print(f"   -> Saved chunk {i+1}/{len(chunks)} to database.")
            
        print("\n🚀 SUCCESS! Entire article is now searchable by your AI.")
        return True

    except Exception as e:
        print(f"\n🚨 Pipeline error: {str(e)}")
        return False

# -------------------------
# 4. RUN THE TEST
# -------------------------
if __name__ == "__main__":
    # Feed it an Investopedia article to build your knowledge base
    test_url = "https://www.sbimf.com/"
    process_and_store_article(test_url)