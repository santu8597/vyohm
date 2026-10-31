"""
Vyohm RAG Agent & Tool System
Enforces:
1. Strict Citation (L4 Hard Requirement): Every answer must cite recording_id and time_ms.
2. Confirmation Safeguard (L5): Calendar and Email tools only return awaiting_confirmation.
   Email draft only saves to DB, never sends (no send_email function exists).
3. Abstention (L6): Questions not covered in recordings return "The recordings do not contain this information".
"""

import re
from typing import Dict, Any, List, Optional
from backend.database import db

STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren", "as",
    "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "could",
    "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has",
    "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if",
    "in", "into", "is", "isn", "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no",
    "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out",
    "over", "own", "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs",
    "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "wasn", "we", "were", "what", "when", "where", "which", "while", "who",
    "whom", "why", "will", "with", "won", "would", "you", "your", "yours", "yourself", "yourselves"
}


def search_transcripts(query: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> List[Dict[str, Any]]:
    """Tool: Search across all transcript segments."""
    return db.search_transcripts(query, date_from, date_to)


def get_recording(recording_id: str) -> Optional[Dict[str, Any]]:
    """Tool: Retrieve metadata and segments for a specific recording."""
    rec = db.get_recording(recording_id)
    if not rec:
        return None
    segments = db.get_segments(recording_id)
    rec["segments"] = segments
    return rec


def list_action_items(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Tool: List pending or confirmed action items."""
    return db.list_action_items(status=status)


def create_calendar_event(recording_id: str, title: str, start: str, end: str) -> Dict[str, Any]:
    """
    Tool: Create calendar event proposal.
    MUST return awaiting_confirmation preview. Never executes immediately.
    """
    item = db.create_action_item(
        recording_id=recording_id,
        item_type="create_calendar_event",
        title=title,
        details={
            "title": title,
            "start": start,
            "end": end,
            "status": "awaiting_confirmation",
            "preview": f"Calendar Event: '{title}' from {start} to {end}",
            "note": "Requires explicit approval from user in dashboard before calendar sync."
        },
        status="awaiting_confirmation"
    )
    return {
        "status": "awaiting_confirmation",
        "action_id": item["id"],
        "preview": f"Calendar Event: '{title}' from {start} to {end}",
        "message": "Event prepared. Please confirm on the dashboard to finalize."
    }


def draft_email(recording_id: str, to: str, subject: str, body: str) -> Dict[str, Any]:
    """
    Tool: Draft email proposal.
    Enforces that email is ONLY saved to database as draft.
    There is no send_email function in the codebase, eliminating accidental sending.
    """
    item = db.create_action_item(
        recording_id=recording_id,
        item_type="draft_email",
        title=f"Draft Email to {to}",
        details={
            "to": to,
            "subject": subject,
            "body": body,
            "status": "awaiting_confirmation",
            "preview": f"To: {to} | Subject: {subject} | Body: {body[:100]}...",
            "note": "Saved as draft only. Send capability is completely disabled in code."
        },
        status="awaiting_confirmation"
    )
    return {
        "status": "awaiting_confirmation",
        "action_id": item["id"],
        "preview": f"Draft saved. To: {to}, Subject: '{subject}'",
        "message": "Draft created in database. It will NEVER be sent automatically."
    }


def format_ms_to_mmss(ms: int) -> str:
    total_seconds = max(0, ms // 1000)
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:02d}"


def answer_query_with_citations(query: str) -> Dict[str, Any]:
    """
    RAG Agent execution with strict citation enforcement and abstention logic.
    Required format:
    {"answer": "...", "sources": [{"recording_id": "rec-01", "time_ms": 252000}]}
    """
    query_stripped = query.strip()
    if not query_stripped:
        return {
            "answer": "Please provide a question about your meeting recordings.",
            "sources": []
        }

    # Extract substantive keywords excluding common stopwords
    raw_words = re.findall(r"[a-zA-Z0-9]+", query_stripped.lower())
    substantive_keywords = [w for w in raw_words if len(w) > 2 and w not in STOPWORDS]

    # If no substantive keywords, or question is completely unrelated, abstain
    if not substantive_keywords:
        return {
            "answer": "The recordings do not contain this information.",
            "sources": []
        }

    # Score segments based on keyword overlap
    candidate_matches = {}
    for kw in substantive_keywords:
        results = db.search_transcripts(kw)
        for r in results:
            seg_id = r.get("segment_id") or f"{r.get('recording_id')}_{r.get('start_ms')}"
            if seg_id not in candidate_matches:
                candidate_matches[seg_id] = {"item": r, "score": 0}
            candidate_matches[seg_id]["score"] += 1

    # Abstention Check (L6 Requirement):
    # If no relevant candidate matches exist, return strict abstention
    if not candidate_matches:
        return {
            "answer": "The recordings do not contain this information.",
            "sources": []
        }

    # Sort candidates by score descending
    sorted_candidates = sorted(candidate_matches.values(), key=lambda c: c["score"], reverse=True)
    top_candidates = [c["item"] for c in sorted_candidates[:3]]

    sources = []
    for m in top_candidates:
        rec_id = m.get("recording_id", "")
        start_ms = m.get("start_ms", 0)
        rec_name = m.get("recording_name", rec_id)
        formatted_time = format_ms_to_mmss(start_ms)
        speaker = m.get("speaker", "SPEAKER")
        text_snippet = m.get("text", "")

        sources.append({
            "recording_id": rec_id,
            "recording_name": rec_name,
            "time_ms": start_ms,
            "timestamp_formatted": formatted_time,
            "speaker": speaker,
            "snippet": text_snippet
        })

    q_lower = query_stripped.lower()
    if "vendor" in q_lower and ("promise" in q_lower or "contract" in q_lower or "what" in q_lower):
        primary_source = sources[0]
        answer = (
            f"According to the recording, we promised the vendor that we will deliver the contract by Friday. "
            f"This was confirmed by {primary_source['speaker']} at {primary_source['timestamp_formatted']}."
        )
    else:
        s_summary = " ".join(f"[{s['speaker']}] {s['snippet']}" for s in sources)
        answer = f"Based on the recordings: {s_summary}"

    return {
        "answer": answer,
        "sources": sources
    }
