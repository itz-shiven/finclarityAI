# FinclarityAI Build Process

This document summarizes how the repository evolved into its present state as of March 28, 2026.

## Phase 1: Foundation And Hosting

Dates: March 16-18, 2026

Focus:

- repository bootstrap
- Flask backend creation
- Supabase connectivity
- first Render deployment setup

Representative commits:

- `5795225` Initial commit
- `ec4e89f` Flask server made
- `b62147e` Hosting on Render
- `aed9ebe` added gunicorn
- `f6506ae` connecting to supabase
- `6e2cc00` added .env to gitignore

## Phase 2: Auth Flow Formation

Dates: March 19-20, 2026

Focus:

- dependency cleanup
- Google OAuth integration
- login redirect repairs
- dashboard entry flow stabilization

Representative commits:

- `30cb4ad` partial_google_auth
- `e7fbf79` o auth processing
- `a8a7070` dashboard redirecting fixed
- `d307fbc` o auth redirect fix try1
- `ecbecfe` final google

## Phase 3: Dashboard, Chat, And Retrieval Foundations

Dates: March 21-24, 2026

Focus:

- dashboard UI buildout
- theme system
- retrieval-backed chatbot
- streamed responses
- scraper and knowledge-base ingestion
- comparison flow foundations

Representative commits:

- `79849fa` Dashboard
- `5990a46` updated dashbooard with lot of features
- `30742c7` changed theme of project
- `cc15043` added llm which responds with Database
- `bbeab63` streamenable type shi8
- `52debe4` scrapper added
- `6c690bd` final scrapper added
- `1fc4a83` compare section

## Phase 4: Stability And Submission Packaging

Dates: March 23-27, 2026

Focus:

- global error handling
- Render fixes
- runtime cleanup
- hackathon documentation

Representative commits:

- `c73e9be` fixed llm
- `3c4bf28` error handling made global...
- `0235570` render.yaml updated
- `c9377bb` render
- `dcca2aa` runtime
- `81fa0e0` renderfix
- `2588b17` docs: add comprehensive AI agent architecture documentation
- `0cdd080` docs: finalize ET AI Hackathon 2026 submission package
- `aaca618` docs: finalize exhaustive comprehensive build process log

## Phase 5: Dashboard Expansion, Personal Data, And Social Auth

Date: March 27, 2026

Focus:

- calculator and comparison fixes
- profile redesign
- to-do and finance-data improvements
- Microsoft and Facebook auth expansion

Representative commits:

- `19daccb` fixed fourth table,name in dark mode and compare-count
- `b963cc3` fixed calculator and first 2 points
- `6763781` Profile changed
- `c6e374f` to do fixes
- `7a74579` changed linkedin to microsoft
- `21ed729` microsoft login done
- `a25f2cf` added facebook auth
- `e9c773b` added facebook auth
- `cfff4ca` login page

## Phase 6: Mobile And Model Tiering

Date: March 27, 2026

Focus:

- mobile optimization
- landing-page polish
- chatbot free/pro model split

Representative commits:

- `3e93e65` mobile opt
- `b5965aa` mobile optimizationsss
- `1dc5297` final mobileopt
- `4607282` fixed hero page
- `ad26a6c` set up free and pro ai models

## Phase 7: Premium Subscription Flow

Date: March 28, 2026

Focus:

- Stripe checkout integration
- premium plan state persistence
- payment verification logic
- docs refresh

Representative commits:

- `5bd5338` stripe done
- `43cd324` stripe added
- `eff378c` Chatbot fixed
- `2bb3dc2` settings button fixed
- `554c255` update instr files

## Present Build Picture

The repository is currently built around:

- one Flask web app in `backend/app.py`
- one AI blueprint in `backend/chat.py`
- server-rendered templates with large client-side dashboard logic
- Supabase-backed auth, storage, and retrieval
- OpenAI-powered embeddings and generation
- optional OpenRouter routing for free chat mode
- Stripe-backed premium upgrades
- optional Firecrawl ingestion through `backend/scrapper.py`

## Current Build And Run Process

For local development, the present workflow is:

1. Create a virtual environment.
2. Install `backend/requirements.txt`.
3. Provide Supabase and OpenAI environment variables.
4. Run `python app.py` inside `backend/`.

For deployment, `render.yaml` currently:

1. builds from `backend/`
2. installs Python dependencies with `pip`
3. starts the app with `python app.py`

## Important Corrections To Older Docs

- The live codebase is not a multi-agent runtime.
- Premium billing and plan selection are now part of the current application surface.
- The app stores more than chat history now; it also persists finance data and subscription state inside the `user_data` record.
- Build/runtime documentation still needs one final cleanup around Python version alignment and whether Render should run Flask directly or switch to Gunicorn.
