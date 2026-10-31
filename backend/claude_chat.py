"""
claude_chat.py — Claude-powered recording chat with native Anthropic tool support.

Tools available (defined in tools.py):
  • create_calendar_event  — saves a calendar task to DB (awaiting user approval)
  • draft_email            — saves an email draft to DB (never auto-sent)

Flow:
  1. Build a system prompt embedding the full transcript + recording metadata.
  2. Send messages + tools to Claude via official Anthropic SDK (tools parameter).
  3. If Claude returns stop_reason='tool_use', execute tools, append tool_results, and loop.
  4. Return final text answer + list of any tool actions taken.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv
import anthropic

# Ensure backend/.env is loaded
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv()

from backend.tools import (
    ANTHROPIC_TOOLS,
    VYOHM_TOOLS,
    execute_tool,
    set_recording_context,
)

CLAUDE_KEY = os.getenv("CLAUDE_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _format_transcript(segments: List[Dict[str, Any]]) -> str:
    """Format segments into readable transcript with speaker + timestamps."""
    lines = []
    for seg in segments:
        start_s = seg.get("start_ms", 0) / 1000
        end_s = seg.get("end_ms", 0) / 1000
        speaker = seg.get("speaker", "UNKNOWN")
        text = seg.get("text", "").strip()
        lines.append(f"[{start_s:.1f}s – {end_s:.1f}s] {speaker}: {text}")
    return "\n".join(lines) if lines else "(No transcript available)"


def _build_system_prompt(recording: Dict[str, Any], transcript_text: str) -> str:
    return f"""You are an intelligent assistant analyzing a specific audio recording for the Vyohm platform.
Provide highlighted important insights if any (use **bold** for key points, decisions, deadlines, names).

Recording Details:
- Filename: {recording.get('filename', 'Unknown')}
- Recorded At: {recording.get('recorded_at', 'Unknown')}
- Duration: {recording.get('duration_ms', 0) / 1000:.1f} seconds
- Word Count: {recording.get('word_count', 0)}
- Summary: {recording.get('summary', 'No summary available')}

Full Transcript (with speaker labels and timestamps):
---
{transcript_text}
---

Instructions:
1. Answer questions ONLY based on the transcript above. Do NOT use outside knowledge.
2. When referencing specific statements, include the timestamp (e.g., "At 1:23, SPEAKER_00 said...").
3. If the transcript does not contain the answer, say clearly: "This recording does not contain that information."
4. Use **bold** to highlight key insights, action items, decisions, and important names/dates.
5. You have two tools available:
   - create_calendar_event: Use automatically when the transcript reveals a meeting, deadline, or scheduled task.
   - draft_email: Use automatically when a follow-up email should be sent based on the discussion.
6. Always confirm to the user when you've used a tool (calendar event or email draft created).
"""


def _sanitize_messages(messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """Sanitize and format messages for Anthropic messages API."""
    out: List[Dict[str, Any]] = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if not content or not str(content).strip():
            continue
        if role not in ("user", "assistant"):
            role = "user"

        # Prevent consecutive messages with the same role by combining or appending
        if out and out[-1]["role"] == role:
            out[-1]["content"] = f"{out[-1]['content']}\n\n{content}"
        else:
            out.append({"role": role, "content": str(content)})

    # Anthropic requires the first message to be from 'user'
    if not out or out[0]["role"] != "user":
        out.insert(0, {"role": "user", "content": "What is this recording about?"})

    return out


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

def chat_with_recording(
    recording: Dict[str, Any],
    segments: List[Dict[str, Any]],
    messages: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Run a Claude conversation scoped to one recording, with auto tool use.

    Args:
        recording:  Recording metadata dict
        segments:   Transcript segments [{speaker, text, start_ms, end_ms}]
        messages:   Conversation history [{role, content}]

    Returns:
        {
          "answer": str,            # final Claude text response
          "model": str,
          "recording_id": str,
          "tool_actions": [         # list of tools Claude invoked
            {"tool": str, "input": dict, "result": str}
          ]
        }
    """
    recording_id = recording.get("id", "")
    current_key = os.getenv("CLAUDE_KEY", CLAUDE_KEY)

    if not current_key or current_key in ("my_claude_key", ""):
        return {
            "answer": "⚠️ Claude API key not configured. Please set **CLAUDE_KEY** in `backend/.env` and restart the server.",
            "model": "none",
            "recording_id": recording_id,
            "tool_actions": [],
        }

    # Inject recording context so tools know which recording they belong to
    set_recording_context(recording_id)

    transcript_text = _format_transcript(segments)
    system_prompt = _build_system_prompt(recording, transcript_text)
    api_messages = _sanitize_messages(messages)

    try:
        client = anthropic.Anthropic(api_key=current_key)
        tool_actions: List[Dict[str, Any]] = []

        # ── Multi-turn tool execution loop (max 5 rounds) ───────────────────
        for _ in range(5):
            response = client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=2048,
                system=system_prompt,
                tools=ANTHROPIC_TOOLS,
                messages=api_messages,
            )

            if response.stop_reason == "tool_use":
                # Append assistant message with its tool-use blocks
                api_messages.append({
                    "role": "assistant",
                    "content": response.content,
                })

                # Process every tool_use block and construct tool_result blocks
                tool_results = []
                for block in response.content:
                    if getattr(block, "type", None) == "tool_use":
                        tool_name = block.name
                        tool_input = block.input or {}
                        tool_call_id = block.id

                        result = execute_tool(tool_name, tool_input)
                        tool_actions.append({
                            "tool": tool_name,
                            "input": tool_input,
                            "result": result,
                        })
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_call_id,
                            "content": str(result),
                        })

                # Append user response containing all tool results
                api_messages.append({
                    "role": "user",
                    "content": tool_results,
                })

            else:
                # Normal completion (stop_reason == 'end_turn' or other non-tool reason)
                final_text = "".join(
                    b.text for b in response.content if hasattr(b, "text") and b.text
                )
                return {
                    "answer": final_text or "No response generated.",
                    "model": CLAUDE_MODEL,
                    "recording_id": recording_id,
                    "tool_actions": tool_actions,
                }

        # Safety fallback if loop limit reached
        return {
            "answer": "Completed tool actions, but the conversation reached the turn limit.",
            "model": CLAUDE_MODEL,
            "recording_id": recording_id,
            "tool_actions": tool_actions,
        }

    except anthropic.AuthenticationError:
        return {
            "answer": "❌ **Invalid Claude API key.** Please check your `CLAUDE_KEY` in `backend/.env`.",
            "model": "error",
            "recording_id": recording_id,
            "tool_actions": [],
        }
    except Exception as e:
        return {
            "answer": f"❌ Claude API error: {str(e)}",
            "model": "error",
            "recording_id": recording_id,
            "tool_actions": [],
        }
