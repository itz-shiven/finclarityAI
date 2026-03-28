# FinclarityAI — Comprehensive Commit History

Updated through `ad26a6c` on March 27, 2026.

---

## Latest Highlights

- `ad26a6c` feat: setup free-tier and pro-tier AI model selection
- `4607282` fix: hero section layout and styling on landing page
- `1dc5297` fix: finalize mobile-responsive dashboard and sidebar
- `b5965aa` feat: add mobile CSS/JS optimizations for dashboard
- `3e93e65` feat: initial mobile-responsive layout for dashboard & login
- `e9c773b` feat: integrate Facebook OAuth on login page
- `21ed729` feat: implement Microsoft OAuth login flow
- `6763781` feat: redesign user profile section in dashboard
- `c6e374f` fix: resolve dashboard to-do widget bugs

---

## Chronological Timeline

### March 16, 2026 — Project Inception

| Hash | Description |
|------|-------------|
| `5795225` | **Initial commit** — repository created with README |

---

### March 17, 2026 — Static Frontend Scaffold

| Hash | Description |
|------|-------------|
| `d57a551` | **Add static frontend scaffold** — landing page HTML, CSS, responsive styles, phone mockup assets, and chatbot JS stub |
| `a5b9d30` | **Remove demo button from landing page** |

---

### March 18, 2026 — Flask Backend & Supabase Integration

| Hash | Description |
|------|-------------|
| `a18f203` | **Add hero animations** — intro video assets and login page styles |
| `ec4e89f` | **Create Flask server** — app.py, db.py, login/dashboard templates, static assets migrated into `backend/` |
| `b62147e` | **Configure Render hosting** — add deployment dependencies |
| `aed9ebe` | **Add Gunicorn** — production WSGI server for Render |
| `6753400` | **Update app.py** — backend route adjustments |
| `f6506ae` | **Connect to Supabase** — add `.env`, Supabase client init, and auth JS |
| `6e2cc00` | **Secure environment variables** — add `.env` to `.gitignore`, remove exposed keys |
| `1e62aba` | **Fix .gitignore patterns** — ensure env files are properly excluded |

---

### March 19, 2026 — Google OAuth & Dashboard Polish

| Hash | Description |
|------|-------------|
| `99ec0f9` | **Update requirements.txt** — add missing Python dependencies |
| `dcde4b2` | **Update requirements.txt** — pin dependency versions |
| `82cd7e4` | **Add UptimeRobot health check & dashboard UI enhancements** — chatbot, login, and dashboard JS/CSS updates |
| `3a29978` | **Sync working tree** — no file changes (empty commit) |
| `b49faa2` | **Update root requirements.txt** |
| `30cb4ad` | **Implement partial Google OAuth** — add OAuth routes, login JS, and Supabase auth flow |
| `e7fbf79` | **Add OAuth callback processing** — handle Google redirect, dashboard session, and login UI updates |
| `a6f914d` | **Fix dashboard layout** — CSS styling adjustments |
| `a8a7070` | **Fix post-login dashboard redirect** — correct JS redirect logic |

---

### March 20, 2026 — OAuth Redirect Fixes

| Hash | Description |
|------|-------------|
| `d307fbc` | **Fix OAuth redirect URL (attempt 1)** — update callback URL in app.py and login JS |
| `592e898` | **Fix OAuth redirect URL (attempt 2)** — correct redirect URI in app.py |
| `c99b1e4` | **Fix OAuth redirect URL (attempt 3)** — finalize correct callback path |
| `cb186c6` | **Fix Google login button handler** — update login.js event binding |
| `ecbecfe` | **Finalize Google OAuth flow** — complete end-to-end Google sign-in with proper redirects |

---

### March 21, 2026 — Dashboard Overhaul, Chatbot, Scraper & Theme System

| Hash | Description |
|------|-------------|
| `79849fa` | **Build initial dashboard page** — layout, sidebar, CSS, and JS scaffold |
| `8192d8b` | **Fix dashboard JS** — resolve initialization errors |
| `d51545a` | **Fix settings icon alignment** — dashboard CSS tweak |
| `b2146c9` | **Add profile button** — dashboard header with user profile dropdown |
| `5990a46` | **Enhance dashboard with multiple features** — app routes, CSS, JS, and template updates |
| `5ac9d10` | Merge branch `main` into `ychanges` |
| `30742c7` | **Implement dark/light theme system** — add theme toggle JS, update all CSS files and templates for dual-theme support |
| `cc15043` | **Add LLM-powered database query responses** — integrate AI responses backed by Supabase data |
| `52debe4` | **Add initial web scraper** — scrapper.py for financial data collection |
| `46f88e0` | Merge branch `main` into `ychanges` |
| `6c690bd` | **Finalize web scraper** — complete scrapper.py with targets.json data |
| `f2b2dbe` | Merge pull request #4 from `itz-shiven/ychanges` |
| `2f53ac8` | **Add targets.json to .gitignore** — exclude scraped data from repo |
| `8726a69` | **Update chatbot styling** — refine chatbot CSS in app.py and dashboard styles |
| `7e19be3` | **Update chatbot message handling** |
| `bbeab63` | **Enable streaming responses in chatbot** — update app.py, dashboard JS, and template for streamed AI replies |
| `2f1cfd1` | **Add human-readable response formatting** — format AI output in dashboard JS |
| `78830b5` | **Update requirements.txt** — add new dependencies |
| `21d46b4` | **Refactor code formatting** — clean up app.py, add check_db.py, dashboard style/JS improvements |
| `61582d7` | **Add error detection for Render deployment** — improve error handling in app.py |
| `d37b73e` | **Update Render deployment config** |
| `1ba2aa4` | **Get chatbot working end-to-end** — fix app.py routes, chatbot JS, and user data persistence |
| `52c428a` | **Fix chatbot and dashboard bugs** — resolve app.py errors, dashboard JS issues, and user data handling |
| `2c166cc` | Merge branch `main` |

---

### March 22, 2026 — Chatbot Completion & Auth Overhaul

| Hash | Description |
|------|-------------|
| `eeae80c` | **Complete chatbot feature** — full chat UI, message persistence, login flow, and dashboard integration |
| `0d9daf3` | **Organize database layer** — sort Supabase queries in app.py and update targets.json |
| `826aa56` | Merge branch `main` |
| `f56df4f` | **Sync dashboard changes for pull** — update app.py, dashboard CSS/JS/HTML |
| `72bd091` | **Sync working tree for pull** (empty commit) |
| `ad4f0d5` | **Overhaul sign-in/sign-up flow & dashboard features** — redesign login/signup pages, update auth JS, add new dashboard widgets |
| `cdf9eb8` | **Complete authentication integration** — finalize all auth flows in app.py |
| `bad1d6b` | Merge branch `main` into `ychanges` |

---

### March 23, 2026 — LLM & Error Handling Fixes

| Hash | Description |
|------|-------------|
| `c73e9be` | **Fix LLM response generation** — resolve AI query handling in app.py |
| `3c4bf28` | **Add global error handling middleware** — centralize error handling in app.py |

---

### March 24, 2026 — Scraper & Product Comparison

| Hash | Description |
|------|-------------|
| `94048f4` | **Complete financial data scraper** — finalize scrapper.py with targets.json output |
| `045f692` | Merge branch `main` |
| `1fc4a83` | **Build product comparison section** — add compare UI to dashboard, backend API, and chatbot integration |
| `6dbe05d` | Merge branch `main` |

---

### March 25, 2026 — Chatbot Improvements

| Hash | Description |
|------|-------------|
| `b8f2753` | **Improve chatbot AI responses** — update chat.py module and app.py integration |

---

### March 26, 2026 — Major UI Reform, Docs & Hackathon Prep

| Hash | Description |
|------|-------------|
| `18d7b97` | **Major UI overhaul** — redesign home page, link database to documents, reform compare section, add financial calculators, update delete button |
| `d100fe5` | Merge branch `main` |
| `279666c` | **Refactor chat module** — update chat.py, app.py, add VS Code settings, update dashboard UI & requirements |
| `17f6cd1` | **Remove Chinese localization from dashboard** |
| `127c5f0` | **Fix breadcrumb navigation** — update dashboard routing, CSS, JS, and template |
| `8a5b5ef` | **Restore chat history feature** — fix app/chat pycache and history retrieval |
| `fe7c80e` | chore: init GenAI hackathon project structure |
| `8d95c4f` | feat(backend): setup robust Flask backend with Supabase auth |
| `2617775` | feat(ai): integrate OpenAI API for intelligent financial assistant |
| `55c39fd` | feat(db): establish persistent user chat memory via Supabase |
| `37b9fa0` | feat(ui): design intuitive dashboard and seamless chat interface |
| `5d392b1` | chore: finalize AI features and prep for hackathon submission |
| `1d96801` | docs: finalize GenAI hackathon README and build logs |
| `4c08ef2` | docs: update README with hackathon focus |
| `b1a7996` | chore: refresh build process log |
| `83db95d` | docs: finalize ET AI Hackathon 2026 submission artifacts |
| `2503e39` | docs: replace raw txt commit log with markdown timeline |
| `1ec6dce` | docs: link new markdown timeline in README |
| `ae1d735` | docs: append comprehensive commit history to build process log |
| `f581de8` | docs: finalize hackathon chronological commit history log |
| `2588b17` | docs: add comprehensive AI agent architecture documentation |
| `0cdd080` | docs: finalize ET AI Hackathon 2026 submission package |

---

### March 27, 2026 — Render Deployment, Auth Expansion & Mobile Optimization

| Hash | Description |
|------|-------------|
| `aaca618` | docs: finalize exhaustive comprehensive build process log |
| `12f9d29` | **Update hackathon submission artifacts** — refresh README, COMMIT_HISTORY, agent architecture, and impact model docs |
| `2e1d997` | **Sync dashboard changes for pull** — update app.py, dashboard CSS/JS/HTML |
| `03b63ba` | Merge branch `main` |
| `07a4bff` | **Add Supabase secret key & login page redesign** — configure auth keys, update login CSS/JS, add render.yaml, include user data fixtures |
| `0235570` | **Update Render deployment config** — adjust render.yaml and app.py settings |
| `c9377bb` | **Add Python runtime config for Render** — create runtime.txt and update render.yaml |
| `dcca2aa` | **Update Python runtime version** — adjust runtime.txt for Render compatibility |
| `b1ef013` | **Fix Render deployment error** — correct render.yaml configuration |
| `81fa0e0` | **Fix Render build requirements** — update requirements.txt for deployment |
| `4bdd81f` | Merge branch `new-branch` |
| `6da4bf1` | **Fix chatbot response handling** — resolve dashboard JS chat display bug |
| `19daccb` | **Fix comparison table, dark mode name display, and compare counter** — dashboard CSS/JS updates |
| `c62cf41` | **Fix comparison table (duplicate commit)** |
| `f6c65f1` | **Remove search feature from dashboard** — strip search bar from template |
| `b963cc3` | **Fix financial calculator and resolve first two review issues** — dashboard CSS/JS/HTML fixes |
| `1d59806` | Merge branch `main` |
| `6763781` | **Redesign user profile section** — update profile UI in app.py, dashboard CSS/JS/HTML |
| `b3e97e8` | Merge branch `main` |
| `c6e374f` | **Fix dashboard to-do widget** — resolve task list bugs in app.py, dashboard CSS/JS/HTML |
| `9f81f0e` | Merge branch `main` |
| `7a74579` | **Replace LinkedIn OAuth with Microsoft OAuth** — swap provider in app.py, login JS, and template |
| `21ed729` | **Implement Microsoft OAuth login** — add full Microsoft sign-in flow with login page UI |
| `a25f2cf` | **Add Facebook OAuth backend** — integrate Facebook auth in app.py and login JS |
| `0983bdc` | Merge branch `main` |
| `cfff4ca` | **Redesign login page** — overhaul login/signup UI with new styles across CSS, JS, and templates |
| `32976d5` | Merge branch `main` |
| `e9c773b` | **Integrate Facebook OAuth on login page** — add Facebook auth button, CSS, and JS handler |
| `34fd06c` | Merge branch `main` |
| `3e93e65` | **Add initial mobile optimizations** — create mobile CSS/JS, update dashboard and login templates |
| `0bf25af` | Merge branch `main` |
| `b5965aa` | **Expand mobile optimizations** — refine responsive CSS, sidebar behavior, and dashboard layout |
| `1dc5297` | **Finalize mobile-responsive dashboard** — polish mobile CSS/JS for sidebar, chat, and navigation |
| `4607282` | **Fix hero section on landing page** — correct CSS and HTML layout issues |
| `eb0dfe7` | Merge branch `main` |
| `ad26a6c` | **Setup free and pro AI model tiers** — add model selection logic in chat.py, dashboard CSS/JS/HTML |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total Commits** | 102 |
| **Development Period** | March 16 – March 27, 2026 (12 days) |
| **Feature Commits** | ~60 |
| **Bug Fix Commits** | ~20 |
| **Documentation Commits** | ~15 |
| **Merge Commits** | ~17 |
| **Contributors** | Team itz-shiven |
