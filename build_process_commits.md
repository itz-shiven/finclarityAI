# FinclarityAI Build Process

This document summarizes how the repository evolved into its current state as of March 27, 2026.

## Phase 1: Project Setup

Dates: March 16-18, 2026

Focus:

- initial repository setup
- Flask backend creation
- Render deployment preparation
- Supabase connectivity

Representative commits:

- `5795225` Initial commit
- `ec4e89f` Flask server made
- `b62147e` Hosting on Render
- `aed9ebe` added gunicorn
- `f6506ae` connecting to supabase
- `6e2cc00` added .env to gitignore

## Phase 2: Auth and Basic UX

Dates: March 19-20, 2026

Focus:

- requirements cleanup
- Google auth work
- login redirect fixes
- early dashboard fixes

Representative commits:

- `30cb4ad` partial_google_auth
- `e7fbf79` o auth processing
- `a6f914d` dashboard fix
- `a8a7070` dashboard redirecting fixed
- `d307fbc` o auth redirect fix try1
- `ecbecfe` final google

## Phase 3: Dashboard and Chat Foundation

Dates: March 21-22, 2026

Focus:

- dashboard UI buildout
- theme and profile work
- first AI chat backed by database content
- streaming chat responses

Representative commits:

- `79849fa` Dashboard
- `5990a46` updated dashbooard with lot of features
- `30742c7` changed theme of project
- `cc15043` added llm which responds with Database
- `bbeab63` streamenable type shi8
- `1ba2aa4` ChatBort Working
- `eeae80c` ChatBot Done

## Phase 4: Data Ingestion and Retrieval

Dates: March 21-24, 2026

Focus:

- scraper pipeline
- retrieval grounding
- database organization
- compare feature beginnings

Representative commits:

- `52debe4` scrapper added
- `6c690bd` final scrapper added
- `0d9daf3` database sorted
- `94048f4` scrapper done
- `1fc4a83` compare section

## Phase 5: Stability and Submission Docs

Dates: March 23-27, 2026

Focus:

- global error handling
- Render fixes
- runtime and deployment cleanup
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

## Phase 6: Dashboard Expansion and User Data Features

Date: March 27, 2026

Focus:

- calculator and comparison fixes
- profile improvements
- finance to-do and dashboard refinements
- social auth expansion

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

## Phase 7: Mobile and Model Mode Updates

Date: March 27, 2026

Focus:

- mobile optimization
- landing page polish
- chatbot provider split into free/pro modes

Representative commits:

- `3e93e65` mobile opt
- `b5965aa` mobile optimizationsss
- `1dc5297` final mobileopt
- `4607282` fixed hero page
- `ad26a6c` set up free and pro ai models

## Current Build Picture

As of the latest commits, the app is built around:

- Flask server-side rendering
- Supabase auth and persistence
- OpenAI retrieval and generation
- optional OpenRouter free chatbot mode
- Render deployment from `backend/`

## What Changed Since The Older Docs

The most important correction is architectural:

- the live code is a single Flask app with specialized AI endpoints
- the repo no longer matches the earlier "multi-agent" framing in the old docs
- the latest work has centered on auth breadth, mobile UX, dashboard polish, and dual chat modes
