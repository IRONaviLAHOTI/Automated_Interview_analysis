"""
main.py — FastAPI Backend Entry Point
=======================================
Python 3.11 compatible.
All type hints use Optional[X] instead of X | None for 3.11 support.

ENDPOINTS:
  POST /analyse              — Upload video, run full pipeline, save to DB
  POST /analyse/audio        — Analyse audio from live session recording
  GET  /sessions             — List all sessions (paginated)
  GET  /sessions/{id}        — Get full session by ID
  GET  /sessions/user/{name} — Get all sessions for a username
  DELETE /sessions/{id}      — Delete session by ID
  GET  /health               — Health check
  WS   /live                 — Real-time frame analysis WebSocket
"""

from __future__ import annotations

import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import List, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import (
    FastAPI, File, Form, HTTPException,
    UploadFile, WebSocket, WebSocketDisconnect, Depends,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from audio_analysis      import analyse_audio
from plagiarism_analysis import analyse_plagiarism
from visual_analysis     import analyse_visual, analyse_frame

from database import engine, get_db
import models
import crud
from schemas import SessionCreate, SessionResponse, SessionSummary, DeleteResponse

load_dotenv()

# Create tables on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="InterviewLens API",
    description="AI-powered interview analysis with PostgreSQL session storage",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for d in ["static/frames", "static/poses", "static/blinks"]:
    os.makedirs(d, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm"}


def _grade(total: float) -> str:
    if total >= 8.5: return "A"
    if total >= 7.0: return "B"
    if total >= 5.5: return "C"
    if total >= 4.0: return "D"
    return "F"


# ── Health ────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "4.0.0"}


# ── Main analysis endpoint ────────────────────────────────────────────────
@app.post("/analyse", response_model=SessionResponse)
async def analyse_file(
    file:      UploadFile = File(...),
    username:  str        = Form(...),
    questions: str        = Form(default=""),
    job_title: str        = Form(default=""),
    db:        Session    = Depends(get_db),
):
    t0 = time.perf_counter()

    if not username.strip():
        raise HTTPException(400, "username is required")

    ext = Path(file.filename or "file.mp4").suffix.lower()
    if ext not in VIDEO_EXTENSIONS | AUDIO_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    is_video = ext in VIDEO_EXTENSIONS
    q_list   = [q.strip() for q in questions.split(",") if q.strip()]
    tmp_dir  = tempfile.mkdtemp(prefix="interview_")
    tmp_path = os.path.join(tmp_dir, f"upload{ext}")

    try:
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)

        # Visual analysis
        if is_video:
            vis = analyse_visual(tmp_path)
        else:
            vis = {
                "blink_score": 0, "posture_score": 0, "blink_rate": 0.0,
                "head_movement_pct": 0.0, "phone_detected": False,
                "frame_captures": [], "visual_score": 0,
                "eye_contact_breaks": 0, "avg_iris_deviation": 0.0,
                "multiple_people": False, "arms_crossed_pct": 0.0,
                "slouch_pct": 0.0, "flags": [], "error": None,
            }

        # Audio analysis
        aud = analyse_audio(tmp_path)

        # AI evaluation
        plag = analyse_plagiarism(
            transcript = aud.get("transcript", ""),
            questions  = q_list,
            job_title  = job_title,
        )

        total   = round(
            vis.get("visual_score", 0) +
            aud.get("confidence_score", 0) +
            plag.get("communication_score", 0),
            2
        )
        elapsed = round(time.perf_counter() - t0, 2)

        # Save to PostgreSQL
        session_data = SessionCreate(
            username            = username.strip(),
            final_score         = total,
            grade               = _grade(total),
            visual_score        = vis.get("visual_score", 0),
            confidence_score    = aud.get("confidence_score", 0),
            communication_score = plag.get("communication_score", 0.0),
            transcript          = aud.get("transcript", ""),
            language            = aud.get("language", "en"),
            word_count          = aud.get("word_count", 0),
            speech_rate_wpm     = aud.get("speech_rate_wpm", 0.0),
            avg_pitch           = aud.get("avg_pitch", 0.0),
            avg_volume          = aud.get("avg_volume", 0.0),
            feedback            = plag.get("feedback", ""),
            plagiarism_status   = plag.get("plagiarism_status", "unknown"),
            tone                = plag.get("tone", "unknown"),
            answer_depth        = plag.get("answer_depth", "unknown"),
            blink_rate          = vis.get("blink_rate", 0.0),
            head_movement_pct   = vis.get("head_movement_pct", 0.0),
            eye_contact_breaks  = vis.get("eye_contact_breaks", 0),
            arms_crossed_pct    = vis.get("arms_crossed_pct", 0.0),
            slouch_pct          = vis.get("slouch_pct", 0.0),
            phone_detected      = 1 if vis.get("phone_detected") else 0,
            multiple_people     = 1 if vis.get("multiple_people") else 0,
            flags               = vis.get("flags", []),
            file_name           = file.filename,
            file_type           = "video" if is_video else "audio",
            processing_time_s   = elapsed,
        )

        saved = crud.create_session(db=db, data=session_data)
        return saved

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Live audio analysis (post-session) ───────────────────────────────────
@app.post("/analyse/audio")
async def analyse_audio_live(file: UploadFile = File(...)):
    """Transcribe and analyse audio blob from live session."""
    tmp_dir  = tempfile.mkdtemp(prefix="live_audio_")
    tmp_path = os.path.join(tmp_dir, "session.webm")
    try:
        with open(tmp_path, "wb") as f:
            f.write(await file.read())
        aud  = analyse_audio(tmp_path)
        plag = analyse_plagiarism(
            transcript = aud.get("transcript", ""),
            questions  = [],
            job_title  = "",
        )
        return JSONResponse(content={**aud, **plag})
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Session endpoints ─────────────────────────────────────────────────────
@app.get("/sessions", response_model=List[SessionSummary])
def list_sessions(
    skip:  int     = 0,
    limit: int     = 50,
    db:    Session = Depends(get_db),
):
    return crud.get_all_sessions(db=db, skip=skip, limit=limit)


@app.get("/sessions/user/{username}", response_model=List[SessionSummary])
def sessions_by_user(
    username: str,
    skip:     int     = 0,
    limit:    int     = 20,
    db:       Session = Depends(get_db),
):
    sessions = crud.get_sessions_by_username(db=db, username=username, skip=skip, limit=limit)
    if not sessions:
        raise HTTPException(404, f"No sessions found for: {username}")
    return sessions


@app.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_session_by_id(db=db, session_id=session_id)
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")
    return session


@app.delete("/sessions/{session_id}", response_model=DeleteResponse)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_session(db=db, session_id=session_id)
    if not deleted:
        raise HTTPException(404, f"Session {session_id} not found")
    return DeleteResponse(message="Session deleted successfully", session_id=session_id)


# ── WebSocket live analysis ───────────────────────────────────────────────
@app.websocket("/live")
async def live_analysis(websocket: WebSocket):
    """Stream JPEG frames → receive per-frame JSON flags."""
    await websocket.accept()
    try:
        while True:
            frame_bytes = await websocket.receive_bytes()
            result      = analyse_frame(frame_bytes)
            await websocket.send_json(result)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"error": str(exc)})
            await websocket.close()
        except Exception:
            pass


@app.get("/")
def root():
    return {
        "service": "InterviewLens API",
        "version": "4.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host   = os.getenv("HOST", "localhost"),
        port   = int(os.getenv("PORT", 8000)),
        reload = True,
    )
