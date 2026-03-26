🚀 FinclarityAI: Agent Architecture & Logic Flow

FinclarityAI is a multi-agent, retrieval-augmented generative AI system designed to deliver accurate, explainable, and personalized financial intelligence. The system leverages specialized AI agents, a vector-based knowledge layer, and a resilient backend orchestration pipeline built using Flask, Supabase, and OpenAI APIs.

🤖 1. Agent Roles & Capabilities

FinclarityAI adopts a modular multi-agent architecture, where each agent is optimized for a specific task:

A. Financial Advisor Agent (Conversational Core)

Model: gpt-4o-mini (Streaming)
Purpose: Primary user-facing chatbot for financial guidance and Q&A

Capabilities:

Context-aware conversational responses
Personalized financial advice
Natural dialogue handling (follow-ups, small talk)

Constraints:

Operates strictly on retrieved context (RAG-based)
Enforces mandatory source citations
Generates structured memory tokens like:
[MEMORY: User prefers low-risk investments]
Builds long-term user intelligence
B. Comparative Extractor Agent (Structured Intelligence Engine)

Model: gpt-4o-mini (JSON Output)
Purpose: Converts unstructured financial documents into structured comparison data

Capabilities:

Extracts features, pricing, eligibility, pros/cons
Outputs strict JSON schemas dynamically based on category

Example Output:
{
"product": "Credit Cards",
"features": [...],
"fees": [...],
"pros": [...],
"cons": [...]
}

C. Deep Research Agent (High-Reasoning Specialist)

Model: gpt-4o (Advanced reasoning, JSON Output)
Purpose: Performs deep analysis of individual financial products

Capabilities:

Detects hidden fees and fine print
Evaluates forex markup, eligibility, rewards
Produces structured verdicts

Output Format:
{
"pros": [...],
"cons": [...],
"verdict": "Best for frequent travelers..."
}

🔄 2. Agent Communication & Lifecycle

All agents are orchestrated through a central Flask backend that manages context, routing, and memory.

End-to-End Flow:

User Query Input
User sends a query via the frontend (JavaScript / EventSource)
Query Vectorization
Converted into embeddings using text-embedding-3-small (1536-dimensional vector)
Semantic Retrieval (Supabase)
An RPC call (match_financial_docs) performs cosine similarity search using pgvector
Context Assembly
Combines:
Retrieved documents
Chat history
Persistent user memory
Agent Routing
Based on query type:
Advice → Advisor Agent
Comparison → Extractor Agent
Deep analysis → Research Agent
Inference Execution
Asynchronous API call to OpenAI
Response Delivery
Advisor Agent → Streaming via Server-Sent Events (SSE)
Extractor/Research Agents → JSON responses
🔌 3. Tool Integrations

Supabase (Vector Database Layer):

PostgreSQL with pgvector
Stores document embeddings
Enables semantic similarity search

OpenAI APIs:

Embeddings: text-embedding-3-small
Models: gpt-4o-mini, gpt-4o
Handles reasoning, generation, and structured outputs

Custom Scraper (scrapper.py):

Headless scraping pipeline
Extracts financial data (banks, policies, etc.)
Pushes processed data into Supabase vector store
🛡️ 4. Resilience & Error Handling

FinclarityAI is designed with defensive AI principles to ensure reliability and prevent hallucinations.

A. Hallucination Prevention
If vector search fails, system injects:
"❌ NO DATA AVAILABLE"
LLM is strictly instructed to refuse answering without context
Ensures fully grounded financial responses
B. API Failure Handling

Embedding Failure:

Wrapped in try/except
Returns fallback message:
"I'm having trouble connecting to my knowledge base right now."

JSON Formatting Issues:

Cleans malformed responses (e.g., removing ```json blocks)
Uses safe parsing with json.loads()

Parsing Failure Fallback:

Injects safe object:
{
"Status": "Not Found"
}
Prevents frontend crashes
C. Global Crash Handler
Implemented using @app.errorhandler
Returns safe response:
{
"error": "An unexpected server error occurred"
}

Prevents:

Stack trace leaks
UI failures
🧠 Key Innovation Summary
Multi-agent AI system with specialized roles
Retrieval-Augmented Generation (RAG) with strict grounding
Real-time streaming and structured JSON pipelines
Persistent user memory for personalization
Robust error handling and fallback mechanisms