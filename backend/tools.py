"""
tools.py — Tools for Claude to use during recording chat.

Tools available:
  • create_calendar_event  – saves a calendar task to the DB as an action item
  • draft_email            – saves a draft email to the DB (NEVER sent automatically)

Both tools return a confirmation string that Claude feeds back to the user.
"""

from __future__ import annotations

import datetime
import json
from typing import Optional, Dict, Any, List

from backend.database import db

# ─────────────────────────────────────────────────────────────────────────────
# Internal state: current recording_id injected before each chat turn
# ─────────────────────────────────────────────────────────────────────────────
_current_recording_id: str = ""


def set_recording_context(recording_id: str) -> None:
    """Call this before invoking the agent so tools know which recording they belong to."""
    global _current_recording_id
    _current_recording_id = recording_id


# ─────────────────────────────────────────────────────────────────────────────
# Tool 1: Calendar Event
# ─────────────────────────────────────────────────────────────────────────────
def create_calendar_event(
    title: str,
    start_time: str,
    end_time: Optional[str] = None,
    description: Optional[str] = "",
    attendees: Optional[str] = "",
) -> str:
    """
    Create a calendar event or task extracted from the recording.
    Saved to DB with status='awaiting_confirmation' for user approval.
    """
    recording_id = _current_recording_id or "unknown"

    if isinstance(attendees, list):
        attendees_list = attendees
        attendees_str = ", ".join(attendees)
    else:
        attendees_str = attendees or ""
        attendees_list = [a.strip() for a in attendees_str.split(",") if a.strip()]

    details = {
        "title": title,
        "start": start_time,
        "end": end_time or "",
        "description": description or "",
        "attendees": attendees_list,
        "source": "auto-extracted by Claude",
        "created_at": datetime.datetime.utcnow().isoformat(),
    }

    try:
        item = db.create_action_item(
            recording_id=recording_id,
            item_type="create_calendar_event",
            title=f"📅 {title}",
            details=details,
            status="awaiting_confirmation",
        )
        return (
            f"✅ Calendar event created (pending user approval in Email Approval page):\n"
            f"  Title: {title}\n"
            f"  Start: {start_time}\n"
            f"  End: {end_time or 'Not specified'}\n"
            f"  Attendees: {attendees_str or 'None specified'}\n"
            f"  ID: {item['id']}"
        )
    except Exception as e:
        return f"❌ Failed to create calendar event: {str(e)}"


# ─────────────────────────────────────────────────────────────────────────────
# Tool 2: Draft Email
# ─────────────────────────────────────────────────────────────────────────────
def draft_email(
    to: str,
    subject: str,
    body: str,
) -> str:
    """
    Draft a follow-up email based on the recording transcript.
    Saved to DB with status='awaiting_confirmation'. NEVER sent automatically.
    """
    recording_id = _current_recording_id or "unknown"

    details = {
        "to": to,
        "subject": subject,
        "body": body,
        "preview": body[:120] + "..." if len(body) > 120 else body,
        "note": "Draft only — never auto-sent. Awaiting user approval.",
        "source": "auto-drafted by Claude",
        "created_at": datetime.datetime.utcnow().isoformat(),
    }

    try:
        item = db.create_action_item(
            recording_id=recording_id,
            item_type="draft_email",
            title=f"✉️ {subject}",
            details=details,
            status="awaiting_confirmation",
        )
        return (
            f"✅ Email draft saved (pending user approval in Email Approval page):\n"
            f"  To: {to}\n"
            f"  Subject: {subject}\n"
            f"  Preview: {details['preview']}\n"
            f"  ID: {item['id']}\n"
            f"  ⚠️ This email will NOT be sent until approved on the Email Approval page."
        )
    except Exception as e:
        return f"❌ Failed to draft email: {str(e)}"


# ─────────────────────────────────────────────────────────────────────────────
# Anthropic Tool Schemas
# ─────────────────────────────────────────────────────────────────────────────
ANTHROPIC_TOOLS = [
    {
        "name": "create_calendar_event",
        "description": "Create a calendar event or task extracted from the recording. Saved to DB as pending user approval. Use automatically when the transcript mentions meetings, deadlines, due dates, or scheduled tasks.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Short event title (e.g. 'Follow-up with Vendor')"},
                "start_time": {"type": "string", "description": "ISO 8601 datetime or human-readable date/time (e.g. '2026-11-01T10:00:00')"},
                "end_time": {"type": "string", "description": "Optional end datetime or string"},
                "description": {"type": "string", "description": "Additional notes, agenda, or context from transcript"},
                "attendees": {"type": "string", "description": "Comma-separated list of attendee names or emails"}
            },
            "required": ["title", "start_time"]
        }
    },
    {
        "name": "draft_email",
        "description": "Draft a follow-up email based on the recording transcript. Saved to DB as draft (NEVER auto-sent, requires user approval on the Email Approval page). Use automatically when the transcript mentions action items, follow-ups, or meeting summaries to share.",
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "description": "Recipient name or email address"},
                "subject": {"type": "string", "description": "Email subject line"},
                "body": {"type": "string", "description": "Full email body text (professional tone)"}
            },
            "required": ["to", "subject", "body"]
        }
    }
]

VYOHM_TOOLS = ANTHROPIC_TOOLS


def execute_tool(tool_name: str, tool_input: Dict[str, Any]) -> str:
    """Execute a tool by name with arguments dict."""
    if tool_name == "create_calendar_event":
        return create_calendar_event(
            title=tool_input.get("title", ""),
            start_time=tool_input.get("start_time", ""),
            end_time=tool_input.get("end_time"),
            description=tool_input.get("description", ""),
            attendees=tool_input.get("attendees", ""),
        )
    elif tool_name == "draft_email":
        return draft_email(
            to=tool_input.get("to", ""),
            subject=tool_input.get("subject", ""),
            body=tool_input.get("body", ""),
        )
    return f"Unknown tool: {tool_name}"
