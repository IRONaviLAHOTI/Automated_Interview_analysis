<<<<<<< HEAD
# InterviewLens — AI Interview Analysis Platform

## Quick Start

### Backend
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # fill in your values
uvicorn main:app --reload --host localhost --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### PostgreSQL (one-time setup)
```sql
CREATE DATABASE interviewlens;
```
Tables are auto-created when the backend starts.

## Endpoints
- POST   /analyse              — Upload + analyse interview
- GET    /sessions             — List all sessions
- GET    /sessions/{id}        — Get session by ID
- GET    /sessions/user/{name} — Get sessions by username
- DELETE /sessions/{id}        — Delete session
- GET    /health               — Health check
- WS     /live                 — Live camera analysis
- POST   /analyse/audio        — Post-session audio transcription

## Environment Variables (backend/.env)
```
GROQ_API_KEY=
GROQ_MODEL=llama3-8b-8192
HOST=localhost
PORT=8000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=interviewlens
DB_USER=postgres
DB_PASSWORD=
```

## Deploy
See DEPLOY_PROMPT.md — paste its contents into ChatGPT for full deployment guide.
=======
# Automated_Interview_analysis
>>>>>>> bf989c06f907897051275d25953a9ab0e0f7f7aa
