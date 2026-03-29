# 🏗️ FinclarityAI — Build Process & Log

> A comprehensive chronological log of how the FinclarityAI repository evolved from inception to its fully-functional premium state, logged between **March 16** and **March 29, 2026**.

---

## 🚀 Phase 1: Foundation & Hosting
📅 **Date(s):** March 16-18, 2026

**🎯 Core Focus:**
- **Repository Bootstrap:** Initializing the codebase.
- **Flask Backend:** Creating the core API layer.
- **Supabase Connectivity:** Linking database and authentication flows.
- **Render Deployment:** First live deployment setup.

**📝 Key Commits:**
- `5795225` Initial commit
- `ec4e89f` Create Flask server
- `b62147e` Configure Render hosting
- `aed9ebe` Add Gunicorn
- `f6506ae` Connect to Supabase
- `6e2cc00` Add .env to gitignore

---

## 🔐 Phase 2: Auth Flow Formation
📅 **Date(s):** March 19-20, 2026

**🎯 Core Focus:**
- **Dependency Cleanup:** Stabilizing Python requirements.
- **Google OAuth Integration:** First major social login capability.
- **Login Redirect Repairs:** Fixing deep-linking and post-login routing.
- **Dashboard Entry Stabilization:** Cementing the authenticated user experience.

**📝 Key Commits:**
- `30cb4ad` Partial Google Auth
- `e7fbf79` OAuth processing
- `a8a7070` Fix dashboard redirecting
- `d307fbc` Fix OAuth redirect
- `ecbecfe` Finalize Google OAuth

---

## 💬 Phase 3: Dashboard, Chat & Retrieval Foundations
📅 **Date(s):** March 21-24, 2026

**🎯 Core Focus:**
- **Dashboard UI Buildout:** Main interface structure and interactivity.
- **Theme System:** Added full dark/light mode context.
- **Retrieval-Backed Chatbot:** The core LLM pipeline linked to Supabase matching.
- **Streamed Responses:** SSE implementation for real-time generative answers.
- **Scraper & Knowledge Base:** Firecrawl data ingestion via `scrapper.py`.
- **Comparison Flow:** Groundwork for the table comparison interface.

**📝 Key Commits:**
- `79849fa` Build dashboard
- `5990a46` Update dashboard with multiple features
- `30742c7` Implement dark/light theme system
- `cc15043` Add LLM which responds with database
- `bbeab63` Enable streaming responses
- `52debe4` Add scraper
- `6c690bd` Finalize scraper
- `1fc4a83` Build compare section

---

## 🛡️ Phase 4: Stability & Submission Packaging
📅 **Date(s):** March 23-27, 2026

**🎯 Core Focus:**
- **Global Error Handling:** Centralized response failsafes.
- **Render Fixes:** Resolved production building/serving issues.
- **Runtime Cleanup:** Locked correct python runtime versions.
- **Hackathon Documentation:** Polished repo context for external readers.

**📝 Key Commits:**
- `c73e9be` Fix LLM responses
- `3c4bf28` Make error handling global
- `0235570` Update render.yaml
- `c9377bb` Add Python runtime config for Render
- `dcca2aa` Update runtime version
- `81fa0e0` Fix Render build requirements
- `2588b17` Docs: Add comprehensive AI agent architecture
- `0cdd080` Docs: Finalize ET AI Hackathon submission package
- `aaca618` Docs: Finalize exhaustive build process log

---

## 📊 Phase 5: Dashboard Expansion & Social Auth
📅 **Date(s):** March 27, 2026

**🎯 Core Focus:**
- **Calculators & Comparisons:** Restored and repaired missing tools.
- **Profile Redesign:** Upgraded account-viewing UI.
- **Finance Data:** Expanded user persistence (To-Dos).
- **Expanded Providers:** Added Microsoft and Facebook login paradigms.

**📝 Key Commits:**
- `19daccb` Fix comparison table and dark mode
- `b963cc3` Fix calculator
- `6763781` Change user profile UI
- `c6e374f` Fix to-do bugs
- `7a74579` Change LinkedIn to Microsoft
- `21ed729` Implement Microsoft login
- `a25f2cf` Add Facebook Auth backend
- `e9c773b` Integrate Facebook Auth on login page
- `cfff4ca` Redesign login page

---

## 📱 Phase 6: Mobile Polish & Model Tiering
📅 **Date(s):** March 27, 2026

**🎯 Core Focus:**
- **Mobile Optimization:** Heavy CSS overhaul for smaller viewports.
- **Landing-Page Polish:** Fixed hero alignments and media.
- **Model Tiers:** Structured the split between "Free" models and "Pro" reasoning.

**📝 Key Commits:**
- `3e93e65` Initial mobile optimization
- `b5965aa` Expand mobile optimizations
- `1dc5297` Finalize mobile responsive dashboard
- `4607282` Fix hero section on landing page
- `ad26a6c` Setup free and pro AI models

---

## 💳 Phase 7: Premium Subscription Flow
📅 **Date(s):** March 28, 2026

**🎯 Core Focus:**
- **Stripe Integration:** Created full billing/checkout pipelines.
- **State Persistence:** Supabase now correctly retains `.plan` status.
- **Payment Verification:** Webhooks ensuring true account upgrades.

**📝 Key Commits:**
- `5bd5338` Implement Stripe logic
- `43cd324` Enhance Stripe logic
- `eff378c` Fix chatbot handling
- `2bb3dc2` Fix settings button
- `554c255` Update instruction files

---

## 💎 Phase 8: Premium Feature Locking & Final Polish
📅 **Date(s):** March 29, 2026

**🎯 Core Focus:**
- **Product Lockout:** Restricting product comparisons strictly to premium users.
- **Visual Indicators:** UI lock icons visually state restricted components.
- **Structure Fixes:** Repaired Free/Pro LLM model backend errors.
- **Cleanups:** Removed irrelevant display cards; fixed compare table rendering.

**📝 Key Commits:**
- `63019a9` Lock compare features
- `ade899d` Fix lock behavior
- `839fcbc` Fix lock icon
- `104a163` Fix compare table on search
- `1feab81` Remove irrelevant tracking and UI cards
- `f74b43e` Fix free model structure issues
- `43b1464` Stabilize LLM and functionality

---

## 📌 Present Build Picture

The repository currently centers around:
- **Core App:** One Flask web app root located in `backend/app.py`
- **AI Backend:** Specialized LLM logic located in `backend/chat.py`
- **Frontend Architecture:** Server-rendered templates utilizing dense client-side dashboard JS
- **Supabase Integration:** Backs auth, profile storage/memory, and vector retrieval (`financial_docs`)
- **LLM Pipeline:** OpenAI-powered generation & embeddings, scaling optional OpenRouter models on "free" tiers
- **Monetization:** Stripe-backed subscription upgrades and webhooks
- **Crawler:** Firecrawl and OpenAI extraction script inside `backend/scrapper.py`

## ⚙️ Build & Run Process

**Local Fast Start:**
1. Generate `venv` and activate
2. Install dependencies: `pip install -r requirements.txt`
3. Provide Supabase, Stripe, and OpenAI environment configurations (`.env`)
4. Root launch: `python app.py` (inside `backend/`)

**Render Deployment:**
The `render.yaml` orchestrates the remote process:
1. Targets `backend/` directory
2. Initiates `pip install -r requirements.txt`
3. Start command invokes `python app.py` natively

> **Note:** Both Render and Local environments have been unified to mandate `python-3.11.9` for strict compatibility.
