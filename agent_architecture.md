# FinclarityAI Architecture

## Present-Day View

FinclarityAI currently runs as a single Flask application with one AI blueprint and several feature-focused routes. Earlier docs framed the system as a multi-agent architecture, but the code in this repository is better described as a retrieval-augmented web app with specialized endpoints.

## Top-Level Components

### 1. Application Layer

[backend/app.py](/D:/1%20hackathon/finclarityAI/backend/app.py) is the primary application shell.

Responsibilities:

- bootstraps Flask, sessions, CORS, and environment configuration
- initializes Supabase and OpenAI clients
- registers the chat blueprint
- renders `index`, `login`, and `dashboard`
- manages auth and session state
- exposes finance-data and user-data sync APIs
- stores subscription state
- handles Stripe checkout and webhook verification
- applies the global exception handler

### 2. AI Layer

[backend/chat.py](/D:/1%20hackathon/finclarityAI/backend/chat.py) contains the AI-facing routes.

Routes:

- `/chat`
  - streaming SSE chat endpoint
  - builds a retrieval query from the message and recent history
  - embeds the query with OpenAI
  - calls Supabase RPC `match_financial_docs`
  - injects retrieved context plus user memory into the prompt
  - routes between `free` and `pro` chat providers
- `/api/compare_product`
  - returns compact comparison JSON for a product
- `/api/product_details`
  - returns a deeper structured JSON view of a product

This is endpoint specialization, not agent handoff.

### 3. Data Layer

Supabase currently serves three roles:

- authentication
- persistent user storage
- retrieval over embedded financial product documents

Current backend assumptions:

- `user_data` contains `user_id`, `chats`, and `memory`
- `financial_docs` contains content, metadata, and embeddings
- `match_financial_docs` performs vector similarity search

The `chats` field is now effectively an application state envelope containing:

- `chat_history`
- `finance_data`
- `subscription`

### 4. Subscription Layer

Premium handling lives inside [backend/app.py](/D:/1%20hackathon/finclarityAI/backend/app.py).

Current behavior:

- free users can browse the product but are limited in some finance-task flows
- premium state is persisted in Supabase-backed user data
- Stripe Checkout is used to start upgrades
- webhook and return-path verification both attempt subscription activation
- selected chat mode is persisted as part of the subscription object

### 5. Frontend Layer

The frontend is server-rendered HTML enhanced with large JavaScript modules.

Key files:

- [backend/templates/index.html](/D:/1%20hackathon/finclarityAI/backend/templates/index.html)
- [backend/templates/login.html](/D:/1%20hackathon/finclarityAI/backend/templates/login.html)
- [backend/templates/dashboard.html](/D:/1%20hackathon/finclarityAI/backend/templates/dashboard.html)
- [backend/static/js/dashboard.js](/D:/1%20hackathon/finclarityAI/backend/static/js/dashboard.js)
- [backend/static/js/login.js](/D:/1%20hackathon/finclarityAI/backend/static/js/login.js)

The dashboard JS currently manages:

- auth/session hydration
- chat streaming
- local and backend state sync
- plan switching and premium UI
- comparison flows
- calculators
- todo, goal, and expense interactions
- guest-mode UX

## Request Flows

### Chat Flow

1. The dashboard posts a message to `/chat`.
2. The backend checks guest/user session state.
3. The app decides the active model path from the saved subscription.
4. The query is embedded with OpenAI.
5. Supabase RPC `match_financial_docs` returns relevant records.
6. Retrieved context and saved memory are added to the prompt.
7. The selected provider streams the answer back with SSE metadata.

### User Data Flow

1. Authenticated users sync against `user_data`.
2. Chat history, finance data, and subscription state are merged into the `chats` object.
3. Long-term memory is stored separately in `memory`.

### Premium Flow

1. The dashboard requests `/create-checkout-session`.
2. Stripe Checkout is created with user metadata.
3. The pending checkout session id is stored in session and in user subscription data.
4. On success return or webhook completion, the backend verifies the payment and marks the user as premium.

## Ingestion Architecture

[backend/scrapper.py](/D:/1%20hackathon/finclarityAI/backend/scrapper.py) is an offline ingestion script, not an in-app background worker.

Pipeline:

1. Firecrawl crawls target URLs from `targets.json`.
2. OpenAI extracts distinct financial products from page markdown.
3. Each product is converted into a structured text chunk.
4. OpenAI creates embeddings for that chunk.
5. The chunk and embedding are inserted into `financial_docs`.

## What The Architecture Is Not

The current repository does not implement:

- autonomous multi-agent collaboration
- background job queues
- scheduled ingestion inside the running web app
- formal observability or tracing
- automated tests or eval pipelines

## Best Short Description

The most accurate present-day description is:

- single Flask backend
- Supabase-backed auth, persistence, and retrieval
- OpenAI-powered RAG plus structured extraction
- optional OpenRouter free-mode chat path
- Stripe-backed premium subscription flow
- Firecrawl ingestion script
- dashboard-centric frontend for chat, compare, calculators, and finance organization
