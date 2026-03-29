# FinclarityAI

**Live Demo:** [https://finclarityai.onrender.com/](https://finclarityai.onrender.com/)

FinclarityAI is a hackathon-stage financial assistant built around a Flask backend, Supabase auth/data storage, retrieval-backed AI responses, and a dashboard for chat, comparison, calculators, and personal finance tracking.

## What The App Does Today

- Streams AI chat responses from `/chat`
- Grounds product answers against `financial_docs` in Supabase
- Supports `free` and `pro` chat modes
- Lets users compare products and open detailed product breakdowns
- Supports email/password, guest, Google, Microsoft, and Facebook login flows
- Stores chat history, memory, subscription state, todos, goals, and expenses in Supabase
- Includes a Stripe-powered Premium upgrade flow that restricts features like Product Comparison to pro users
- Ships as a single Render web service rooted at `backend/`

## Present Architecture

This repository does not run a true multi-agent system today.

The current production shape is:

- `backend/app.py`
  - Flask app entrypoint
  - session management, auth/session APIs, finance-data APIs, subscription APIs, and Stripe routes
  - template rendering for landing, login, and dashboard
- `backend/chat.py`
  - AI blueprint with streaming chat
  - retrieval against Supabase RPC `match_financial_docs`
  - comparison and product-detail endpoints
- `backend/scrapper.py`
  - optional ingestion pipeline using Firecrawl + OpenAI + Supabase
- `backend/templates/` and `backend/static/`
  - server-rendered UI plus dashboard/login/landing assets

## Core Data Dependencies

The running app expects a Supabase project with:

- auth enabled
- a `user_data` table storing:
  - `user_id`
  - `chats`
  - `memory`
- a `financial_docs` table storing product content, metadata, and embeddings
- an RPC named `match_financial_docs` for semantic retrieval

The `chats` payload is currently used as a compound document holding:

- `chat_history`
- `finance_data`
- `subscription`

## AI Behavior Today

- Embeddings use `text-embedding-3-small`
- Main chat defaults to `gpt-4o-mini`
- Product details use `gpt-4o-mini`
- `free` mode can use OpenRouter if `OPENROUTER_API_KEY` is configured
- If no matching financial documents are found for a product-style query, the chatbot refuses rather than inventing product facts

## Local Development

### Prerequisites

- Python `3.11+`
- Supabase project and credentials
- OpenAI API key
- Optional OpenRouter API key for free-mode chat
- Optional Stripe keys for premium checkout testing
- Optional Firecrawl key for ingestion

Note: Render deployment and local development are both configured for `python-3.11.9`.

### Setup

```powershell
git clone https://github.com/itz-shiven/finclarityAI.git
cd finclarityAI
python -m venv venv
venv\Scripts\activate
cd backend
pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

## Environment Variables

To get started, copy `.env.example` to `.env` and fill in your credentials.

### Required For Core App

```env
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SECRET_KEY=
OPENAI_API_KEY=
```

### Optional For Chat Mode Routing

```env
OPENROUTER_API_KEY=
CHATBOT_OPENAI_MODEL=gpt-4o-mini
CHATBOT_OPENROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free
CHATBOT_OPENROUTER_FALLBACK_MODEL=
TODO_SUGGEST_MODEL=gpt-4o-mini
```

### Optional For Premium Payments

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Optional For Ingestion

```env
FIRECRAWL_API_KEY=
```

## Build And Deployment

Render is configured through [render.yaml](/D:/1%20hackathon/finclarityAI/render.yaml):

- service type: `web`
- root directory: `backend`
- build command: `pip install -r requirements.txt`
- start command: `python app.py`

Current deployment note:

- `render.yaml` starts the Flask dev server with `python app.py`
- `gunicorn` is present in `requirements.txt` but is not currently the configured start command

## Ingestion Workflow

If you want to refresh the financial knowledge base:

1. Add crawl targets in `backend/targets.json`.
2. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and `FIRECRAWL_API_KEY`.
3. Run `python scrapper.py` from `backend/`.

The script crawls pages, extracts structured product information, generates embeddings, and inserts records into `financial_docs`.

## Project Structure

```text
finclarityAI/
|-- backend/
|   |-- app.py
|   |-- chat.py
|   |-- scrapper.py
|   |-- decision_engine.py
|   |-- check_db.py
|   |-- requirements.txt
|   |-- runtime.txt
|   |-- targets.json
|   |-- templates/
|   |-- static/
|   `-- services/
|-- README.md
|-- build_process_commits.md
|-- COMMIT_HISTORY.md
|-- render.yaml
|-- verify_new_logic.py
`-- debug_fin.py
```

## Current Caveats

- **Limited Database Output:** Due to the hackathon scale and current scraping limits, our database currently has a limited subset of financial product data ingested. As a result, some specific product queries or comparisons may not yield results. The system is designed to seamlessly become fully functional and support all queries once more data is scraped and ingested into the `financial_docs` table.
- No automated test suite is committed today.
- The docs previously overstated the system as a multi-agent architecture; the current code is a single Flask app with specialized AI endpoints.
