# InterviewLens — ChatGPT Deployment Prompt
# ==========================================
# Copy everything below this line and paste into ChatGPT.
# ========================================================

I have a full-stack AI interview analysis platform called InterviewLens that I want to deploy to the internet. Help me deploy it end-to-end with all commands I can copy-paste directly.

---

## TECH STACK

**Backend:**
- Python 3.11
- FastAPI + Uvicorn
- PostgreSQL + SQLAlchemy ORM (psycopg2-binary)
- MediaPipe 0.10.14, YOLOv8 (ultralytics), OpenAI Whisper, Librosa, OpenCV
- Groq API (Llama 3) for AI evaluation
- WebSocket endpoint at /live for real-time camera analysis
- File uploads up to 500MB (video files)
- FFmpeg required on server

**Frontend:**
- React 18 + Vite
- Builds to static files in dist/
- Communicates with backend via REST + WebSocket
- API base URL must be changed from localhost to production domain before building

**Database:**
- PostgreSQL (tables auto-created on first backend startup via SQLAlchemy)
- No Alembic — models.Base.metadata.create_all() handles table creation

**Backend folder structure:**
```
backend/
├── main.py
├── database.py
├── models.py
├── schemas.py
├── crud.py
├── visual_analysis.py
├── audio_analysis.py
├── plagiarism_analysis.py
├── requirements.txt
└── .env.example
```

**Required .env file:**
```
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama3-8b-8192
HOST=0.0.0.0
PORT=8000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=interviewlens
DB_USER=postgres
DB_PASSWORD=your_db_password
```

**Frontend .env before building:**
```
VITE_API_URL=https://api.yourdomain.com
```

**All hardcoded localhost URLs in frontend must be updated to use:**
```javascript
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_URL  = API_URL.replace("https://", "wss://").replace("http://", "ws://") + "/live";
```

---

## WHAT I NEED

Please give me a complete step-by-step deployment guide with every terminal command in full so I can copy-paste directly. Cover the following:

### 1. SERVER SETUP
- Recommend the best cloud provider and instance type (needs minimum 4GB RAM for Whisper + MediaPipe + YOLO running simultaneously)
- Exact OS to use (Ubuntu 22.04 LTS preferred)
- All initial setup commands: update packages, create a non-root user, configure firewall (UFW), open ports 80 and 443
- Install Python 3.11 exactly (not 3.12, not system default)
- Install FFmpeg (required by MoviePy and Whisper)
- Install Git
- Install Node.js 18+ and npm (for building frontend on server or locally)

### 2. POSTGRESQL SETUP ON SERVER
- Install PostgreSQL
- Create database named interviewlens
- Create a dedicated postgres user with a password
- Test the connection
- Configure pg_hba.conf if needed for local connections

### 3. BACKEND DEPLOYMENT
- Clone the repository
- Create Python 3.11 virtual environment inside the backend/ folder
- Install all requirements from requirements.txt
- Important: torch must install before mediapipe and ultralytics — give the correct install order if needed
- Create the .env file with all required variables
- Run a test to confirm FastAPI starts: uvicorn main:app --host 0.0.0.0 --port 8000
- Confirm tables are auto-created in PostgreSQL on first startup
- Set up systemd service so backend starts automatically on reboot and restarts on crash
- Give the exact systemd service file content

### 4. NGINX AS REVERSE PROXY
- Install Nginx
- Create server block that:
  - Proxies all HTTP traffic to localhost:8000
  - Handles WebSocket upgrade for /live endpoint (needs Upgrade header + proxy_read_timeout 3600s)
  - Sets client_max_body_size 500M for video uploads
  - Serves backend /static/ directory for captured frame images
- Give the exact nginx config file

### 5. HTTPS WITH CERTBOT
- Install Certbot
- Get free SSL certificate from Let's Encrypt for the backend domain
- Configure auto-renewal
- After HTTPS is set up, confirm WebSocket will work over wss:// automatically

### 6. FRONTEND BUILD AND DEPLOYMENT
- Create frontend .env with VITE_API_URL pointing to the production backend HTTPS domain
- Show which files in the frontend need localhost replaced with the env variable
- Run npm install and npm run build
- Two deployment options:
  - Option A: Deploy dist/ to Vercel (simplest)
  - Option B: Serve dist/ from Nginx on the same VPS alongside the backend
- Give commands for both options

### 7. CORS UPDATE
- In backend/main.py, the allow_origins is currently ["*"]
- Show how to update it to only allow the actual frontend domain after deployment

### 8. MODEL PRE-WARMING
- YOLOv8 downloads yolov8n.pt (~6MB) on first inference call
- Whisper downloads the base model (~140MB) on first transcription
- Show how to add a startup pre-warm script so models download before the first real user request hits
- Or show how to add a startup event in FastAPI main.py to trigger model loading at boot

### 9. ENVIRONMENT VARIABLES ON HOSTING PLATFORMS
- If using Railway, Render, or fly.io instead of a VPS:
  - How to set environment variables through their dashboard
  - Which of these platforms can handle 4GB RAM requirement
  - Docker-based deployment option as an alternative

### 10. MONITORING AND MAINTENANCE
- How to check backend logs: journalctl -u interviewlens -f
- How to verify the backend is running: curl http://localhost:8000/health
- How to check PostgreSQL is storing sessions: psql command to count rows
- Basic monitoring setup (UptimeRobot free tier is fine)
- How to restart the backend: sudo systemctl restart interviewlens

### 11. ESTIMATED COSTS
- Monthly cost for the minimum viable VPS setup
- Groq API cost (note: Groq has a free tier)
- Any other costs (domain, SSL is free via Let's Encrypt)

### 12. PRODUCTION CHECKLIST
Give me a final checklist of everything to verify before sharing the link publicly:
- Backend health endpoint returns ok
- PostgreSQL is storing sessions after a test upload
- HTTPS works on backend domain
- WebSocket /live works over wss://
- Frontend can upload a video and get results
- CORS is locked to the frontend domain
- .env file is not committed to git (.gitignore check)

Give me all commands in full. Do not abbreviate or use placeholders — use example values like yourdomain.com and replace markers clearly so I know what to substitute.
