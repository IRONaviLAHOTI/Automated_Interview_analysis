"""
audio_analysis.py — Audio Analysis Module
==========================================
Python 3.11 compatible.
Handles: audio extraction (MoviePy), transcription (Whisper),
         pitch (librosa pyin), volume (RMS), speech rate (WPM).
"""

from __future__ import annotations
import os
import tempfile
from typing import Dict, Any, List

import numpy as np


def _extract_audio(video_path: str, tmp_dir: str) -> str:
    """Extract audio from video as WAV. Return path to WAV file."""
    from moviepy.editor import VideoFileClip
    wav_path = os.path.join(tmp_dir, "audio.wav")
    clip = VideoFileClip(video_path)
    if clip.audio is None:
        raise ValueError("No audio track found in video")
    clip.audio.write_audiofile(wav_path, verbose=False, logger=None)
    clip.close()
    return wav_path


def analyse_audio(input_path: str) -> Dict[str, Any]:
    """
    Run full audio analysis on a video or audio file.
    Returns dict with transcript, pitch, volume, speech rate.
    """
    import whisper
    import librosa
    import soundfile as sf

    tmp_dir = tempfile.mkdtemp(prefix="audio_")

    try:
        ext = os.path.splitext(input_path)[1].lower()
        video_exts = {".mp4", ".mov", ".webm", ".avi", ".mkv"}

        if ext in video_exts:
            audio_path = _extract_audio(input_path, tmp_dir)
        else:
            audio_path = input_path

        # ── Whisper transcription ─────────────────────────────────────────
        model  = whisper.load_model("base")
        result = model.transcribe(audio_path)
        transcript  = result.get("text", "").strip()
        language    = result.get("language", "en")
        word_count  = len(transcript.split()) if transcript else 0

        # ── Librosa audio features ────────────────────────────────────────
        audio, sr = librosa.load(audio_path, sr=None)
        duration  = librosa.get_duration(y=audio, sr=sr)

        # Pitch via pyin
        f0, voiced_flag, _ = librosa.pyin(
            audio,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
        )
        voiced_f0   = f0[~np.isnan(f0)] if f0 is not None else np.array([])
        avg_pitch   = float(np.mean(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        pitch_score = 1 if 85 <= avg_pitch <= 255 else 0

        step = max(1, len(f0) // 50) if f0 is not None else 1
        pitch_over_time: List[float] = [
            float(v) for v in (f0[::step] if f0 is not None else [])
            if not np.isnan(v)
        ]

        # Volume (RMS)
        rms            = librosa.feature.rms(y=audio, frame_length=2048, hop_length=512)[0]
        avg_volume     = float(np.mean(rms))
        volume_stability = float(np.std(rms))
        volume_score   = 1 if avg_volume > 0.01 else 0

        step_v = max(1, len(rms) // 50)
        volume_over_time: List[float] = [float(v) for v in rms[::step_v]]

        # Speech rate
        duration_min   = duration / 60 if duration > 0 else 1
        speech_rate    = round(word_count / duration_min, 1)
        rate_score     = 1 if 130 <= speech_rate <= 170 else 0

        wpm_segments   = result.get("segments", [])
        wpm_trend: List[float] = []
        for seg in wpm_segments:
            seg_dur = seg.get("end", 0) - seg.get("start", 0)
            seg_words = len(seg.get("text", "").split())
            if seg_dur > 0:
                wpm_trend.append(round(seg_words / (seg_dur / 60), 1))

        confidence_score = pitch_score + volume_score + rate_score

        return {
            "transcript":       transcript,
            "language":         language,
            "word_count":       word_count,
            "avg_pitch":        round(avg_pitch, 2),
            "pitch_score":      pitch_score,
            "pitch_over_time":  pitch_over_time,
            "avg_volume":       round(avg_volume, 4),
            "volume_score":     volume_score,
            "volume_stability": round(volume_stability, 4),
            "volume_over_time": volume_over_time,
            "speech_rate_wpm":  speech_rate,
            "rate_score":       rate_score,
            "wpm_trend":        wpm_trend,
            "confidence_score": confidence_score,
            "error":            None,
        }

    except Exception as e:
        return {
            "transcript": "", "language": "en", "word_count": 0,
            "avg_pitch": 0.0, "pitch_score": 0, "pitch_over_time": [],
            "avg_volume": 0.0, "volume_score": 0, "volume_stability": 0.0,
            "volume_over_time": [], "speech_rate_wpm": 0.0, "rate_score": 0,
            "wpm_trend": [], "confidence_score": 0, "error": str(e),
        }
    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
