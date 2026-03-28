# FinclarityAI Architecture

## Current State

The repository currently implements a single Flask application with one AI blueprint. Earlier documentation described a multi-agent system, but the codebase today is better understood as a retrieval-augmented app with a few specialized endpoints.

## System Components

### 1. Flask Application Layer

`backend/app.py` is the main orchestration layer.

Responsibilities:

- bootstraps Flask
- initializes Supabase
- configures sessions and CORS
- registers the chat blueprint
- serves `index`, `login`, and `dashboard`
- handles signup, login, guest access, logout, and profile updates
- persists user finance data and chat state
- applies a global error handler

### 2. AI Blueprint

`backend/chat.py` contains the AI-facing routes.

Routes:

- `/chat`
  - streaming chatbot route
  - performs embedding generation
  - calls Supabase RPC retrieval
  - builds the LLM prompt
  - streams the response with SSE
- `/api/compare_product`
  - generates concise JSON comparison fields
- `/api/product_details`
  - generates deep structured JSON for a specific product

This is endpoint specialization, not independent long-running agents.

### 3. Supabase Layer

Supabase is used in three roles:

- authentication
- persistent user storage
- vector-backed retrieval over indexed product documents

Current backend assumptions:

- `user_data` table stores chat payloads and memory
- `financial_docs` table stores content, metadata, and embeddings
- `match_financial_docs` RPC performs similarity search

### 4. Model Layer

The current model stack is:

- OpenAI embeddings: `text-embedding-3-small`
- OpenAI chat: `gpt-4o-mini`
- OpenAI detailed extraction: `gpt-4o`
- Optional OpenRouter model for chatbot `free` mode

Mode behavior:

- `pro` mode uses the OpenAI client
- `free` mode uses OpenRouter if configured, otherwise the app falls back to the OpenAI-backed path

### 5. Frontend Layer

The frontend is server-rendered HTML with large client-side JavaScript modules.

Key files:

- `backend/templates/index.html`
- `backend/templates/login.html`
- `backend/templates/dashboard.html`
- `backend/static/js/dashboard.js`
- `backend/static/js/login.js`

The dashboard script manages:

- auth/session checks
- chat streaming
- local chat history
- memory extraction tags
- comparison flows
- calculators
- responsive dashboard behavior

## Chat Logic Flow

### User Message Path

1. Frontend posts to `/chat`.
2. Backend validates session.
3. The message and recent history are converted into a retrieval query.
4. OpenAI generates an embedding.
5. Supabase RPC `match_financial_docs` retrieves the top matching records.
6. Retrieved context plus user memory are injected into the prompt.
7. The selected model generates a streamed response.
8. The frontend appends chunks live and stores the assistant reply.

### Guardrails

The current chat design includes several explicit constraints:

- if no database documents match, the assistant is instructed to refuse
- greetings are handled with a lighter path
- responses are expected to end with a source label
- persistent facts can be emitted with `[MEMORY: ...]` tags

## Data Ingestion Architecture

`backend/scrapper.py` is the ingestion script.

Flow:

1. Firecrawl crawls configured target URLs.
2. Page markdown is passed to OpenAI for product extraction.
3. Each extracted product is converted into a structured text chunk.
4. OpenAI generates embeddings for that chunk.
5. The result is inserted into `financial_docs` in Supabase.

This gives the chat and comparison features their retrieval base.

## What The Architecture Is Not

The current codebase does not implement:

- autonomous multi-agent handoff between advisor/research/extractor services
- a dedicated job queue or worker system
- background scheduled indexing inside the app
- formal observability, tracing, or automated validation pipelines

## Practical Architecture Summary

The most accurate present-day description is:

- single Flask backend
- Supabase-backed auth and persistence
- OpenAI-powered retrieval and generation
- optional OpenRouter free-mode chat path
- Firecrawl plus OpenAI ingestion script
- dashboard-heavy frontend with chat, compare, and calculator tooling
