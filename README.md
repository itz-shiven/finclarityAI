# FinclarityAI

FinclarityAI is a full-stack financial assistant built for the ET AI Hackathon 2026. The current app combines a Flask backend, a Supabase-backed user layer, a retrieval-based AI chat experience, product comparison flows, calculators, and a polished dashboard UI for exploring financial products.

## Current Product Scope

- AI chat with `free` and `pro` modes
- Retrieval-augmented answers grounded in `financial_docs`
- Product comparison and detailed product analysis endpoints
- Email/password, guest, Google/Microsoft/Facebook session sync flows
- Persistent user data in Supabase for chats, memory, todos, goals, and expenses
- Dashboard tools including calculators, to-do management, and comparison workflows
- Render deployment via `render.yaml`

## Architecture

The present architecture is a single Flask application, not a separate multi-agent runtime.

### Backend

- `backend/app.py` runs the Flask server, session management, auth APIs, finance-data APIs, profile updates, and template routes.
- `backend/chat.py` provides the AI and comparison blueprint:
  - `/chat` streams chat responses over Server-Sent Events
  - `/api/compare_product` returns compact comparison JSON
  - `/api/product_details` returns deeper structured product details

### Data and Auth

- Supabase is used for auth and persistence.
- The backend expects a `user_data` table with:
  - `user_id`
  - `chats`
  - `memory`
- The AI retrieval layer expects:
  - a `financial_docs` table storing embeddings and metadata
  - an RPC named `match_financial_docs` for semantic search

### AI Layer

- OpenAI is used for:
  - embeddings via `text-embedding-3-small`
  - chat/comparison/detail generation via `gpt-4o-mini` and `gpt-4o`
- OpenRouter is optional and currently used only for the chatbot `free` mode if an API key is configured.
- The chat flow injects:
  - recent conversation history
  - saved user memory
  - retrieved Supabase documents

### Frontend

- Server-rendered HTML lives in `backend/templates/`
- Static assets live in `backend/static/`
- Main screens:
  - `index.html` for the landing page
  - `login.html` for auth
  - `dashboard.html` for the app shell
- `backend/static/js/dashboard.js` drives:
  - chat streaming
  - comparison UI
  - calculators
  - todo/suggestions flows
  - profile and session sync

## Request Flow

1. A logged-in or guest user opens the dashboard.
2. Dashboard JS restores local/backend state and checks auth.
3. Chat requests post to `/chat` with message, history, memory, and chat mode.
4. The backend generates an embedding for the retrieval query.
5. Supabase RPC `match_financial_docs` returns relevant product documents.
6. The selected model produces a streamed reply over SSE.
7. The frontend renders chunks live and stores chat and memory state.

## Build and Run

### Prerequisites

- Python 3.13 recommended
- Supabase project with auth and database tables
- OpenAI API key
- Optional OpenRouter API key for `free` chat mode
- Optional Firecrawl API key if you want to run the scraper

### Local Setup

```bash
git clone https://github.com/itz-shiven/finclarityAI.git
cd finclarityAI
python -m venv venv
venv\Scripts\activate
cd backend
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

### Environment Variables

The current backend uses these keys:

```env
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SECRET_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
CHATBOT_OPENAI_MODEL=gpt-4o-mini
CHATBOT_OPENROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free
CHATBOT_OPENROUTER_FALLBACK_MODEL=
FIRECRAWL_API_KEY=
```

## Deployment

`render.yaml` currently deploys the backend as a Render web service with:

- root directory: `backend`
- build command: `pip install -r requirements.txt`
- start command: `python app.py`
- Python version: `3.13.5`

## Project Structure

```text
finclarityAI/
├── backend/
│   ├── app.py
│   ├── chat.py
│   ├── scrapper.py
│   ├── check_db.py
│   ├── requirements.txt
│   ├── runtime.txt
│   ├── targets.json
│   ├── templates/
│   └── static/
├── README.md
├── impact_model.md
├── agent_architecture.md
├── build_process_commits.md
├── COMMIT_HISTORY.md
└── render.yaml
```

## Important Notes

- The current system is retrieval-based, but it is not a true multi-agent orchestration stack.
- The docs previously described a more ambitious architecture than the code currently implements.
- There are no automated tests in the repository at the moment.
- Some client-side Supabase values are currently embedded in templates and should be treated as deployment configuration that may need cleanup later.
