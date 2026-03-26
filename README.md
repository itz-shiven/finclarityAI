# FinclarityAI - GenAI Hackathon 🚀

FinclarityAI is an intelligent financial tracking and analysis dashboard built specifically for the **GenAI Hackathon, ET**. It empowers users to monitor their financial metrics while leveraging a powerful GenAI chat interface to gain personalized insights from their data.

## 🌟 Hackathon Focus: Generative AI Integration
At the core of FinclarityAI is our OpenAI-powered intelligent assistant. It doesn't just display numbers; it interprets them. The AI agent:
- Understands complex financial queries using advanced NLP.
- Persistently remembers user context and chat history across sessions.
- Helps users uncover trends, summarize their spending, and offer tailored financial clarity.

## 🛠️ Build Architecture & Tech Stack

This project was developed rapidly during the hackathon using:
- **Backend**: Flask (Python) with RESTful API endpoints.
- **AI Engine**: OpenAI API for generative conversational logic.
- **Database & Auth**: Supabase (PostgreSQL) for secure Email/Password & Google OAuth authentication, and persistent user chat memory.
- **Frontend**: Vanilla HTML/JS with responsive CSS, featuring dynamic view transitions for a seamless user experience.

## 📝 Build Process & Git History

The development journey for this hackathon is documented in the commit history to demonstrate our systematic build process:

1. **Ideation & Setup**: Initialized the project structure and Flask foundation.
2. **Authentication**: Integrated Supabase to handle secure user signups and seamless Google OAuth.
3. **GenAI Integration**: Connected the OpenAI API, building the core intelligence of the financial assistant.
4. **Data Persistence**: Set up Supabase tables to ensure the AI remembers past conversations and user memory.
5. **UI/UX Polish**: Designed the intuitive dashboard and chat interface.
6. **Finalization**: Prepped the platform for the hackathon submission.

*(See `build_process_commits.txt` for the detailed commit log).*

## ⚙️ Setup Instructions

### Prerequisites
- Python 3.8+
- [Supabase](https://supabase.com/) Account & Project
- OpenAI API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd finclarityAI
   ```

2. **Setup Virtual Environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install Dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Environment Variables:**
   Create a `.env` file in the `backend` directory with the following variables:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   SECRET_KEY=your_flask_secret_key
   OPENAI_API_KEY=your_openai_api_key
   ```

5. **Run the Application:**
   ```bash
   python app.py
   ```
   The application will be available at `http://127.0.0.1:5000/`.
