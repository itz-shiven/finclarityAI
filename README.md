# FinclarityAI — ET AI Hackathon 2026 🚀

> An AI-powered financial clarity dashboard that leverages Generative AI to help users understand, compare, and plan their finances intelligently.

---

## 🧠 What is FinclarityAI?

FinclarityAI is a full-stack web application built during the **ET AI Hackathon 2026**. It combines a modern financial dashboard with an OpenAI-powered conversational assistant that understands financial queries, remembers past context, and delivers personalized insights — all in real time.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **AI Financial Assistant** | GPT-4 powered chatbot that answers financial queries with persistent memory |
| **Smart Product Comparison** | Side-by-side comparison of financial products across 8 categories |
| **Financial Calculators** | SIP, Lumpsum, EMI, PPF, NPS, CAGR, GST, Income Tax and more |
| **Secure Auth** | Email/Password + Google OAuth via Supabase |
| **Guest Mode** | Try the app without signing up |
| **Real-time Scraping** | Live financial data fetched via custom scraper |
| **Persistent Memory** | Chat history and user preferences synced to Supabase |

---

## 🛠️ Tech Stack

- **Backend**: Python 3 / Flask
- **AI Engine**: OpenAI GPT-4 API
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Frontend**: HTML5 / Vanilla JS / CSS3 (Glassmorphism UI)
- **Data**: Custom web scraper (`scrapper.py`)

---


## ⚙️ Setup Instructions

### Prerequisites
- Python 3.8+
- A [Supabase](https://supabase.com/) project (URL + API keys)
- An [OpenAI](https://platform.openai.com/) API key

### 1. Clone & Enter Project
```bash
git clone https://github.com/itz-shiven/finclarityAI.git
cd finclarityAI
```

### 2. Create Virtual Environment
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 3. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 4. Configure Environment
Create a `.env` file inside `backend/`:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SECRET_KEY=your_flask_secret_key
OPENAI_API_KEY=your_openai_api_key
```

### 5. Run the App
```bash
python app.py
```
Open **http://127.0.0.1:5000/** in your browser.

---

## 📁 Project Structure

```
finclarityAI/
├── backend/
│   ├── app.py              # Flask app, routes, auth, Supabase client
│   ├── chat.py             # AI chat blueprint (OpenAI integration)
│   ├── scrapper.py         # Financial data scraper
│   ├── requirements.txt    # Python dependencies
│   ├── templates/          # HTML templates (index, login, dashboard)
│   └── static/             # CSS, JS, assets
├── .env                    # Environment variables (not committed)
├── .gitignore
└── README.md
```

---

## 📝 Documentation & Build Process

- **[Agent Architecture](agent_architecture.md)**: Detailed description of AI roles, communication, and error-handling.
- **[Build Process Log](build_process_commits.md)**: A chronological timeline of the project’s development journey.

---

## 📜 License

Built for the **ET AI Hackathon 2026**. All rights reserved by the team.
