"""
plagiarism_analysis.py — AI Communication Evaluation
======================================================
Python 3.11 compatible.
Uses Groq/Llama3 for transcript evaluation.
Falls back to rule-based scoring if API key not set.
"""

from __future__ import annotations
import os
import json
from typing import Dict, Any, List

from dotenv import load_dotenv
load_dotenv()

_groq_client = None

def _get_groq():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not set")
        from groq import Groq
        _groq_client = Groq(api_key=api_key)
    return _groq_client


def _rule_based_score(transcript: str) -> Dict[str, Any]:
    """Fallback scoring when Groq API is unavailable."""
    words      = transcript.lower().split()
    word_count = len(words)
    score      = 0.0

    if word_count >= 50:  score += 1.0
    if word_count >= 100: score += 0.5

    fillers      = ["um", "uh", "like", "you know", "basically", "literally", "right"]
    filler_count = sum(words.count(f) for f in fillers)
    if word_count > 0 and filler_count / word_count < 0.05:
        score += 1.0

    unique_words = len(set(words))
    if word_count > 0 and unique_words / word_count > 0.60:
        score += 1.0

    sentence_count = (
        transcript.count(".") + transcript.count("?") + transcript.count("!")
    )
    if sentence_count >= 3:  score += 0.5
    if sentence_count >= 6:  score += 0.5

    if word_count > 0 and score == 0:
        score = 0.5

    score = min(score, 5.0)

    return {
        "communication_score": round(score, 2),
        "plagiarism_status":   "uncertain",
        "feedback":            "Rule-based evaluation. Add GROQ_API_KEY for AI feedback.",
        "strengths":           [],
        "improvements":        [],
        "skills_mentioned":    [],
        "key_topics":          [],
        "tone":                "unknown",
        "answer_depth":        "unknown",
        "memorisation_signals": [],
        "llama_available":     False,
        "error":               None,
    }


def analyse_plagiarism(
    transcript: str,
    questions:  List[str] = None,
    job_title:  str = "",
) -> Dict[str, Any]:
    """Evaluate transcript using Llama3. Falls back to rule-based."""
    questions = questions or []

    if not transcript.strip():
        return {
            "communication_score": 0.0,
            "plagiarism_status":   "unknown",
            "feedback":            "No transcript available.",
            "strengths": [], "improvements": [], "skills_mentioned": [],
            "key_topics": [], "tone": "unknown", "answer_depth": "unknown",
            "memorisation_signals": [], "llama_available": False, "error": None,
        }

    try:
        client = _get_groq()
        model  = os.getenv("GROQ_MODEL", "llama3-8b-8192")

        prompt = f"""You are an expert interview evaluator. Analyze the following interview transcript carefully.

Job Title: {job_title or 'Not specified'}
Questions Asked: {', '.join(questions) if questions else 'Not provided'}

Transcript:
{transcript}

Return ONLY a valid JSON object with exactly these fields (no extra text, no markdown):
{{
  "communication_score": <float 0-5>,
  "plagiarism_status": "<original|likely_copied|uncertain>",
  "feedback": "<2-3 sentence overall evaluation>",
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<improvement1>", "<improvement2>"],
  "skills_mentioned": ["<skill1>", "<skill2>"],
  "key_topics": ["<topic1>", "<topic2>"],
  "tone": "<confident|nervous|monotone|natural|unclear>",
  "answer_depth": "<shallow|moderate|deep>",
  "memorisation_signals": ["<signal1>"]
}}"""

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1000,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        parsed = json.loads(raw)

        return {
            "communication_score": float(parsed.get("communication_score", 0)),
            "plagiarism_status":   str(parsed.get("plagiarism_status", "uncertain")),
            "feedback":            str(parsed.get("feedback", "")),
            "strengths":           list(parsed.get("strengths", [])),
            "improvements":        list(parsed.get("improvements", [])),
            "skills_mentioned":    list(parsed.get("skills_mentioned", [])),
            "key_topics":          list(parsed.get("key_topics", [])),
            "tone":                str(parsed.get("tone", "unknown")),
            "answer_depth":        str(parsed.get("answer_depth", "unknown")),
            "memorisation_signals": list(parsed.get("memorisation_signals", [])),
            "llama_available":     True,
            "error":               None,
        }

    except RuntimeError:
        return _rule_based_score(transcript)
    except Exception as e:
        fallback = _rule_based_score(transcript)
        fallback["error"] = str(e)
        return fallback
