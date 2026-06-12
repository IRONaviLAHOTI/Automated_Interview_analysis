"""
models.py — SQLAlchemy ORM Models
===================================
Python 3.11 compatible.
Defines the interview_sessions table in PostgreSQL.
Flags stored as JSONB for native PostgreSQL JSON support.
"""

from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id                   = Column(Integer, primary_key=True, index=True)
    username             = Column(String(255), nullable=False, index=True)

    # Scores
    final_score          = Column(Float,   nullable=False, default=0.0)
    grade                = Column(String(2), nullable=True)
    visual_score         = Column(Integer,  nullable=True, default=0)
    confidence_score     = Column(Integer,  nullable=True, default=0)
    communication_score  = Column(Float,    nullable=True, default=0.0)

    # Audio / transcript
    transcript           = Column(Text,      nullable=True)
    language             = Column(String(10), nullable=True, default="en")
    word_count           = Column(Integer,   nullable=True, default=0)
    speech_rate_wpm      = Column(Float,     nullable=True, default=0.0)
    avg_pitch            = Column(Float,     nullable=True, default=0.0)
    avg_volume           = Column(Float,     nullable=True, default=0.0)

    # AI evaluation
    feedback             = Column(Text,      nullable=True)
    plagiarism_status    = Column(String(50), nullable=True)
    tone                 = Column(String(50), nullable=True)
    answer_depth         = Column(String(50), nullable=True)

    # Visual metrics
    blink_rate           = Column(Float,     nullable=True, default=0.0)
    head_movement_pct    = Column(Float,     nullable=True, default=0.0)
    eye_contact_breaks   = Column(Integer,   nullable=True, default=0)
    arms_crossed_pct     = Column(Float,     nullable=True, default=0.0)
    slouch_pct           = Column(Float,     nullable=True, default=0.0)
    phone_detected       = Column(Integer,   nullable=True, default=0)  # 0/1
    multiple_people      = Column(Integer,   nullable=True, default=0)  # 0/1

    # Behavioral flags as JSONB array
    # [{type, frame, timestamp_s, detail}, ...]
    flags                = Column(JSONB, nullable=True, default=list)

    # Session metadata
    file_name            = Column(String(255), nullable=True)
    file_type            = Column(String(10),  nullable=True)
    processing_time_s    = Column(Float,       nullable=True)

    created_at           = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
