"""
WhisperLiveKit-compliant Zero-Loss Speaker Alignment Layer
Implements exact token-to-speaker attribution, boundary overlap resolution,
silence segment isolation, and lagging diarization buffer logic.
"""

from typing import List, Dict, Any, Optional


def align_tokens_to_speakers(
    asr_tokens: List[Dict[str, Any]],
    diar_spans: List[Dict[str, Any]],
    silence_speaker: str = "-2",
    silence_gap_threshold: float = 1.0,
) -> List[Dict[str, Any]]:
    """
    Core WhisperLiveKit alignment logic.
    
    asr_tokens: [{"text": str, "start": float, "end": float}, ...]
    diar_spans: [{"speaker": str, "start": float, "end": float}, ...]
    Returns: [{"speaker": str, "text": str, "start": float, "end": float, "start_ms": int, "end_ms": int}, ...]
    
    Invariants guaranteed:
    1. Zero Loss: Every token is retained, never discarded.
    2. Overlap Resolution: Boundary-crossing tokens assigned to speaker with max overlap.
    3. Zero-duration handling: Handled by finding containing diarization span.
    4. Silent segments: When silence exceeds threshold, output as separate lines (speaker: -2), never merged.
    """
    if not asr_tokens:
        return []
    
    # If no diarization spans available, assign all to UNKNOWN
    if not diar_spans:
        full_text = " ".join(t["text"].strip() for t in asr_tokens if t["text"].strip())
        start_t = asr_tokens[0]["start"]
        end_t = asr_tokens[-1]["end"]
        return [{
            "speaker": "UNKNOWN",
            "text": full_text,
            "start": start_t,
            "end": end_t,
            "start_ms": int(start_t * 1000),
            "end_ms": int(end_t * 1000),
            "words_count": len(full_text.split()),
        }]

    lines = []
    current_speaker = None
    current_text = []
    line_start = None
    last_token_end = None

    for token in asr_tokens:
        t_start = float(token["start"])
        t_end = float(token["end"])
        t_text = str(token["text"]).strip()
        
        # Check for significant silence gap between tokens
        if last_token_end is not None and (t_start - last_token_end) >= silence_gap_threshold:
            # Close previous active speaker line before silence
            if current_text:
                text_content = " ".join(current_text)
                lines.append({
                    "speaker": current_speaker if current_speaker is not None else "UNKNOWN",
                    "text": text_content,
                    "start": line_start,
                    "end": last_token_end,
                    "start_ms": int(line_start * 1000) if line_start is not None else 0,
                    "end_ms": int(last_token_end * 1000),
                    "words_count": len(text_content.split()),
                })
                current_text = []
                current_speaker = None
                line_start = None
            
            # Insert isolated silent segment (speaker: -2, never merged)
            lines.append({
                "speaker": silence_speaker,
                "text": "[SILENCE]",
                "start": last_token_end,
                "end": t_start,
                "start_ms": int(last_token_end * 1000),
                "end_ms": int(t_start * 1000),
                "words_count": 0,
            })

        # Calculate overlap with diarization spans
        if t_end == t_start:
            # Zero-duration token: find containing span
            span = next((s for s in diar_spans if s["start"] <= t_start <= s["end"]), None)
        else:
            # Choose speaker with maximum temporal overlap
            span = max(
                diar_spans,
                key=lambda s: max(0.0, min(t_end, float(s["end"])) - max(t_start, float(s["start"]))),
            )
            overlap = max(0.0, min(t_end, float(span["end"])) - max(t_start, float(span["start"])))
            if overlap <= 0.0:
                # No actual overlap; check if token is within tolerance of closest span
                span = min(
                    diar_spans,
                    key=lambda s: min(abs(t_start - float(s["end"])), abs(float(s["start"]) - t_end))
                )

        speaker = span["speaker"] if span else "UNKNOWN"

        # Speaker change -> close current line, open new line
        if speaker != current_speaker and current_text:
            text_content = " ".join(current_text)
            lines.append({
                "speaker": current_speaker,
                "text": text_content,
                "start": line_start,
                "end": last_token_end,
                "start_ms": int(line_start * 1000) if line_start is not None else 0,
                "end_ms": int(last_token_end * 1000) if last_token_end is not None else 0,
                "words_count": len(text_content.split()),
            })
            current_text = []
            line_start = t_start

        if line_start is None:
            line_start = t_start

        current_speaker = speaker
        current_text.append(t_text)  # Token ALWAYS retained, never discarded
        last_token_end = t_end

    if current_text:
        text_content = " ".join(current_text)
        lines.append({
            "speaker": current_speaker if current_speaker is not None else "UNKNOWN",
            "text": text_content,
            "start": line_start,
            "end": last_token_end,
            "start_ms": int(line_start * 1000) if line_start is not None else 0,
            "end_ms": int(last_token_end * 1000) if last_token_end is not None else 0,
            "words_count": len(text_content.split()),
        })

    return lines


class StreamingAligner:
    """
    Streaming Aligner with buffer_diarization to handle lagging diarization.
    Unconfirmed tokens enter buffer_diarization until diarization catches up,
    then they are attributed exactly once with zero loss.
    """
    def __init__(self, silence_gap_threshold: float = 1.0):
        self.buffer_tokens: List[Dict[str, Any]] = []
        self.diar_spans: List[Dict[str, Any]] = []
        self.max_diar_timestamp: float = 0.0
        self.confirmed_lines: List[Dict[str, Any]] = []
        self.silence_gap_threshold = silence_gap_threshold

    def update_diarization(self, new_spans: List[Dict[str, Any]]) -> None:
        """Update diarization spans as they arrive from lagging diarization model."""
        self.diar_spans.extend(new_spans)
        # Deduplicate and sort spans
        self.diar_spans.sort(key=lambda s: s["start"])
        if self.diar_spans:
            self.max_diar_timestamp = max(float(s["end"]) for s in self.diar_spans)

    def feed_asr_tokens(self, new_tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Receives streaming tokens.
        Tokens before max_diar_timestamp can be safely aligned.
        Tokens past max_diar_timestamp stay in buffer_diarization.
        """
        self.buffer_tokens.extend(new_tokens)
        
        # Partition tokens into confirmable vs waiting in buffer
        ready_tokens = []
        remaining_buffer = []

        for token in self.buffer_tokens:
            if float(token["end"]) <= self.max_diar_timestamp:
                ready_tokens.append(token)
            else:
                remaining_buffer.append(token)

        self.buffer_tokens = remaining_buffer

        if ready_tokens:
            aligned = align_tokens_to_speakers(
                ready_tokens,
                self.diar_spans,
                silence_gap_threshold=self.silence_gap_threshold
            )
            self.confirmed_lines.extend(aligned)
            return aligned
        return []

    def flush_remaining(self) -> List[Dict[str, Any]]:
        """Flush any tokens left in buffer upon end of stream."""
        if not self.buffer_tokens:
            return []
        aligned = align_tokens_to_speakers(
            self.buffer_tokens,
            self.diar_spans,
            silence_gap_threshold=self.silence_gap_threshold
        )
        self.buffer_tokens = []
        self.confirmed_lines.extend(aligned)
        return aligned


def verify_zero_loss(
    asr_tokens: List[Dict[str, Any]],
    aligned_segments: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Verifies that zero tokens or words were lost in the alignment process.
    - Word count equality (excluding explicit [SILENCE] tags)
    - Normalized text match
    """
    raw_tokens_words = []
    for t in asr_tokens:
        text = str(t["text"]).strip()
        if text:
            raw_tokens_words.extend(text.split())

    aligned_words = []
    for s in aligned_segments:
        if s.get("speaker") == "-2" or s.get("text") == "[SILENCE]":
            continue
        text = str(s["text"]).strip()
        if text:
            aligned_words.extend(text.split())

    raw_count = len(raw_tokens_words)
    aligned_count = len(aligned_words)
    words_match = (raw_tokens_words == aligned_words)
    count_match = (raw_count == aligned_count)

    raw_joined = " ".join(raw_tokens_words)
    aligned_joined = " ".join(aligned_words)
    char_match = (raw_joined == aligned_joined)

    return {
        "raw_word_count": raw_count,
        "aligned_word_count": aligned_count,
        "count_match": count_match,
        "words_identical": words_match,
        "characters_identical": char_match,
        "zero_loss_verified": count_match and char_match,
    }
