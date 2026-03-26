# FinclarityAI: Agent Architecture & Logic Flow

This document outlines the generative AI architecture within FinclarityAI, detailing the distinct agent roles, their inter-communication methods, external tool integrations, and robust error-handling pipelines designed for the **ET AI Hackathon 2026**.

---

## 🤖 1. Agent Roles & Capabilities

Our system is divided into three highly specialized AI agents, each scoped with distinct LLM prompts and models based on operational complexity:

### A. The Financial Advisor Agent (Main Chat)
- **Model:** `gpt-4o-mini` (Streaming)
- **Role:** Handles conversational queries, provides personalized financial advice, and manages small talk.
- **Core Directives:** 
  - Strictly operates entirely on provided context (RAG paradigm).
  - Enforces mandatory source citations.
  - Generates state-of-the-art permanent fact extraction tokens (`[MEMORY: <fact>]`) to build contextual memory vaults.

### B. The Comparative Extractor Agent
- **Model:** `gpt-4o-mini` (JSON Output)
- **Role:** Parses massive textual documents and distills raw financial data into structured comparative JSON logic (e.g., matching features, pricing, pros/cons).
- **Core Directives:** Required to output exact JSON schemas tailored dynamically to the requested financial category (Cards, Loans, Stocks, etc.).

### C. The Deep Research Agent (Product Details)
- **Model:** `gpt-4o` (High-tier reasoning, JSON Output)
- **Role:** Performs exhaustive evaluations of singular financial products (credit cards, loans) to generate deep-dives.
- **Core Directives:** Isolates extremely nuanced details such as hidden fees, exact forex markups, and explicit eligibility criteria, outputting a precise JSON object (`"pros"`, `"cons"`, `"verdict"`).

---

## 🔄 2. Agent Communication & Lifecycles

Agents do not run in isolation; they are orchestrated by a tightly coupled Python Flask backend managing state and memory.

1. **User Query Initiation:** User submits a textual query via the frontend JS client.
2. **Vectorization pipeline:** The Orchestrator intercepts the query and automatically converts it into a 1536-dimensional vector using OpenAI's `text-embedding-3-small`.
3. **Database Handshake (Retrieval):** The Orchestrator calls a Supabase Remote Procedure Call (`rpc: match_financial_docs`) executing cosine similarity matching against the knowledge base.
4. **Context Assembly:** 
  - Short-term conversational history is loaded.
  - Long-term persistent memory (`USER PROFILE MEMORY`) is injected.
  - Extracted Supabase documents are stitched into a giant context block.
5. **Agent Inference:** The appropriate Agent (Advisor, Extractor, or Researcher) is invoked via an asynchronous POST request to the OpenAI API.
6. **Streaming & Hydration:** For the Advisor Agent, data is streamed directly back to the DOM via Server-Sent Events (SSE) using HTML5 `EventSource`. For JSON Extractors, Flask blocks until completion and hydrates frontend Reactivity pipelines.

---

## 🔌 3. Tool Integrations

The overarching intelligence of FinclarityAI relies on heavy integration between three distinct cloud tools:

*   **Supabase Vector Store (PostgreSQL):** Acts as the semantic brain. We bypass standard keyword search in favor of `pgvector` indexing to ensure the agents always retrieve the most contextually relevant documents.
*   **OpenAI GPT-4 API:** Handles all text embeddings and language generation paradigms.
*   **Finclarity Custom Scraper (`scrapper.py`):** An automated headless data tool designed to ingest current web data and securely pipe it directly into our Supabase vector arrays.

---

## 🛡️ 4. Resilience & Error-Handling Logic

FinclarityAI is engineered with defensive programming strategies to ensure the agent never hallucinates or crashes the UI during external downtimes:

### "No Data" Fallbacks & Hallucination Prevention
- If the Vector search yields irrelevant results (Threshold mismatch), the orchestrator automatically injects `"❌ NO DATA AVAILABLE"` into the agent context.
- The Global System Prompt strictly mandates that the LLM must refuse to answer using general pre-trained knowledge if this token is present, entirely mitigating financial hallucinations.

### Graceful External API Degradation
- **Embeddings Failure:** Caught via explicit `try/except` blocks. Reverts gracefully to a generic API error message without halting the main Flask loop (`"I'm having trouble connecting to my knowledge base right now."`).
- **Malformed JSON Recovery:** When Extractor agents occasionally output markdown blockquotes instead of raw JSON strings, the backend incorporates aggressive string stripping logic (e.g. `reply.strip("```json")`) followed by a safe `json.loads()`.
- **Parsing Fallback:** If JSON decoding mathematically fails entirely after scrubbing, the agent injects a safe dummy object (`{"Status": "Not Found"}`) allowing the frontend to degrade gracefully rather than throwing undefined JS exceptions.

### Global Crash Catcher
- Implemented at the highest application registry layer (`@app.errorhandler`), ensuring any deep agent failure or asynchronous timeout resolves to a safe `HTTP 500` JSON wrapper returning `"An unexpected server error occurred"` instead of leaking tracebacks to the client.
