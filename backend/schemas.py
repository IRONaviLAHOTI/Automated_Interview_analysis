"""
schemas.py — Pydantic v2 Schemas
==================================
Python 3.11 compatible. Uses Pydantic v2 syntax.
Optional fields use Optional[X] = None pattern.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class SessionCreate(BaseModel):
    """Internal schema — used when saving to DB after analysis."""
    username:             str
    final_score:          float
    grade:                Optional[str]       = None
    visual_score:         Optional[int]       = 0
    confidence_score:     Optional[int]       = 0
    communication_score:  Optional[float]     = 0.0
    transcript:           Optional[str]       = None
    language:             Optional[str]       = "en"
    word_count:           Optional[int]       = 0
    speech_rate_wpm:      Optional[float]     = 0.0
    avg_pitch:            Optional[float]     = 0.0
    avg_volume:           Optional[float]     = 0.0
    feedback:             Optional[str]       = None
    plagiarism_status:    Optional[str]       = None
    tone:                 Optional[str]       = None
    answer_depth:         Optional[str]       = None
    blink_rate:           Optional[float]     = 0.0
    head_movement_pct:    Optional[float]     = 0.0
    eye_contact_breaks:   Optional[int]       = 0
    arms_crossed_pct:     Optional[float]     = 0.0
    slouch_pct:           Optional[float]     = 0.0
    phone_detected:       Optional[int]       = 0
    multiple_people:      Optional[int]       = 0
    flags:                Optional[List[Any]] = []
    file_name:            Optional[str]       = None
    file_type:            Optional[str]       = None
    processing_time_s:    Optional[float]     = None


class SessionResponse(BaseModel):
    """Full session — returned when fetching one session by ID."""
    id:                   int
    username:             str
    final_score:          float
    grade:                Optional[str]
    visual_score:         Optional[int]
    confidence_score:     Optional[int]
    communication_score:  Optional[float]
    transcript:           Optional[str]
    language:             Optional[str]
    word_count:           Optional[int]
    speech_rate_wpm:      Optional[float]
    avg_pitch:            Optional[float]
    avg_volume:           Optional[float]
    feedback:             Optional[str]
    plagiarism_status:    Optional[str]
    tone:                 Optional[str]
    answer_depth:         Optional[str]
    blink_rate:           Optional[float]
    head_movement_pct:    Optional[float]
    eye_contact_breaks:   Optional[int]
    arms_crossed_pct:     Optional[float]
    slouch_pct:           Optional[float]
    phone_detected:       Optional[int]
    multiple_people:      Optional[int]
    flags:                Optional[List[Any]]
    file_name:            Optional[str]
    file_type:            Optional[str]
    processing_time_s:    Optional[float]
    created_at:           datetime

    model_config = {"from_attributes": True}


class SessionSummary(BaseModel):
    """Lightweight — returned when listing all sessions."""
    id:           int
    username:     str
    final_score:  float
    grade:        Optional[str]
    word_count:   Optional[int]
    file_name:    Optional[str]
    created_at:   datetime

    model_config = {"from_attributes": True}


class DeleteResponse(BaseModel):
    message:    str
    session_id: int
