"""
crud.py — Database CRUD Operations
=====================================
Python 3.11 compatible.
All DB read/write/delete logic lives here.
Routes call these functions — keeps routes clean.
"""

from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from models import InterviewSession
from schemas import SessionCreate


def create_session(db: Session, data: SessionCreate) -> InterviewSession:
    """Insert a new interview session into PostgreSQL."""
    session = InterviewSession(
        username            = data.username,
        final_score         = data.final_score,
        grade               = data.grade,
        visual_score        = data.visual_score,
        confidence_score    = data.confidence_score,
        communication_score = data.communication_score,
        transcript          = data.transcript,
        language            = data.language,
        word_count          = data.word_count,
        speech_rate_wpm     = data.speech_rate_wpm,
        avg_pitch           = data.avg_pitch,
        avg_volume          = data.avg_volume,
        feedback            = data.feedback,
        plagiarism_status   = data.plagiarism_status,
        tone                = data.tone,
        answer_depth        = data.answer_depth,
        blink_rate          = data.blink_rate,
        head_movement_pct   = data.head_movement_pct,
        eye_contact_breaks  = data.eye_contact_breaks,
        arms_crossed_pct    = data.arms_crossed_pct,
        slouch_pct          = data.slouch_pct,
        phone_detected      = data.phone_detected,
        multiple_people     = data.multiple_people,
        flags               = data.flags or [],
        file_name           = data.file_name,
        file_type           = data.file_type,
        processing_time_s   = data.processing_time_s,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_all_sessions(
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> List[InterviewSession]:
    """Return all sessions newest first with pagination."""
    return (
        db.query(InterviewSession)
        .order_by(desc(InterviewSession.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_session_by_id(
    db: Session,
    session_id: int,
) -> Optional[InterviewSession]:
    """Return one session by primary key. None if not found."""
    return (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id)
        .first()
    )


def get_sessions_by_username(
    db: Session,
    username: str,
    skip: int = 0,
    limit: int = 20,
) -> List[InterviewSession]:
    """Return all sessions for a specific candidate."""
    return (
        db.query(InterviewSession)
        .filter(InterviewSession.username == username)
        .order_by(desc(InterviewSession.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )


def delete_session(db: Session, session_id: int) -> bool:
    """Delete session by ID. Returns True if deleted, False if not found."""
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id)
        .first()
    )
    if not session:
        return False
    db.delete(session)
    db.commit()
    return True
