"""
Automated Unit & Invariant Tests for Zero-Loss Speaker Alignment Layer
Verifies WhisperLiveKit specification invariants.
"""

import pytest
from backend.aligner import align_tokens_to_speakers, StreamingAligner, verify_zero_loss


def test_zero_loss_word_and_character_equality():
    """
    Acceptance Criteria:
    Word count = original transcript word count (zero loss).
    Character-level identical text with only speaker labels changed.
    """
    asr_tokens = [
        {"text": "Good", "start": 0.0, "end": 0.3},
        {"text": "morning", "start": 0.3, "end": 0.7},
        {"text": "everyone,", "start": 0.7, "end": 1.2},
        {"text": "welcome", "start": 1.2, "end": 1.6},
        {"text": "to", "start": 1.6, "end": 1.8},
        {"text": "the", "start": 1.8, "end": 2.0},
        {"text": "sprint", "start": 2.0, "end": 2.4},
        {"text": "planning.", "start": 2.4, "end": 2.9},
        {"text": "Thanks,", "start": 3.0, "end": 3.3},
        {"text": "glad", "start": 3.3, "end": 3.6},
        {"text": "to", "start": 3.6, "end": 3.8},
        {"text": "be", "start": 3.8, "end": 4.0},
        {"text": "here.", "start": 4.0, "end": 4.4},
    ]

    diar_spans = [
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 2.95},
        {"speaker": "SPEAKER_01", "start": 2.95, "end": 5.0},
    ]

    aligned = align_tokens_to_speakers(asr_tokens, diar_spans)
    report = verify_zero_loss(asr_tokens, aligned)

    assert report["zero_loss_verified"] is True
    assert report["raw_word_count"] == 13
    assert report["aligned_word_count"] == 13
    assert report["count_match"] is True
    assert report["characters_identical"] is True
    assert len(aligned) == 2
    assert aligned[0]["speaker"] == "SPEAKER_00"
    assert aligned[1]["speaker"] == "SPEAKER_01"


def test_boundary_overlap_resolution():
    """
    Invariant: Tokens crossing speaker boundaries remain intact and are
    assigned to the speaker with greater overlap. Never cut or split.
    """
    # Token straddles boundary at t=3.0: start=2.8, end=3.4 (duration=0.6)
    # Overlap with SPEAKER_00 (0.0 to 3.0): 3.0 - 2.8 = 0.2s
    # Overlap with SPEAKER_01 (3.0 to 6.0): 3.4 - 3.0 = 0.4s
    # Greater overlap is with SPEAKER_01!
    asr_tokens = [
        {"text": "First", "start": 1.0, "end": 1.5},
        {"text": "StraddlingToken", "start": 2.8, "end": 3.4},
        {"text": "Second", "start": 3.5, "end": 4.0},
    ]

    diar_spans = [
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 3.0},
        {"speaker": "SPEAKER_01", "start": 3.0, "end": 6.0},
    ]

    aligned = align_tokens_to_speakers(asr_tokens, diar_spans)
    
    # StraddlingToken must be assigned to SPEAKER_01 (0.4s > 0.2s overlap)
    spk0_line = next(s for s in aligned if s["speaker"] == "SPEAKER_00")
    spk1_line = next(s for s in aligned if s["speaker"] == "SPEAKER_01")

    assert "First" in spk0_line["text"]
    assert "StraddlingToken" in spk1_line["text"]
    assert "Second" in spk1_line["text"]
    
    # Zero loss holds
    report = verify_zero_loss(asr_tokens, aligned)
    assert report["zero_loss_verified"] is True


def test_zero_duration_token_handling():
    """
    Invariant: Zero-duration tokens find containing diarization span.
    """
    asr_tokens = [
        {"text": "InstantaneousToken", "start": 2.5, "end": 2.5},
    ]

    diar_spans = [
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 2.0},
        {"speaker": "SPEAKER_01", "start": 2.0, "end": 4.0},
    ]

    aligned = align_tokens_to_speakers(asr_tokens, diar_spans)
    assert len(aligned) == 1
    assert aligned[0]["speaker"] == "SPEAKER_01"
    assert aligned[0]["text"] == "InstantaneousToken"


def test_silence_isolation():
    """
    Invariant: Silent segments are output as separate lines (speaker: -2),
    never merged into neighboring speech.
    """
    asr_tokens = [
        {"text": "Speech", "start": 1.0, "end": 1.5},
        {"text": "Before", "start": 1.5, "end": 2.0},
        # 2.0s gap (silence threshold is 1.0s)
        {"text": "Speech", "start": 4.0, "end": 4.5},
        {"text": "After", "start": 4.5, "end": 5.0},
    ]

    diar_spans = [
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 2.2},
        {"speaker": "SPEAKER_01", "start": 3.8, "end": 6.0},
    ]

    aligned = align_tokens_to_speakers(asr_tokens, diar_spans, silence_gap_threshold=1.0)
    
    # Find silence segment
    silence_segments = [s for s in aligned if s["speaker"] == "-2"]
    assert len(silence_segments) == 1
    assert silence_segments[0]["text"] == "[SILENCE]"
    assert silence_segments[0]["start"] == 2.0
    assert silence_segments[0]["end"] == 4.0

    # Ensure zero speech loss
    report = verify_zero_loss(asr_tokens, aligned)
    assert report["zero_loss_verified"] is True


def test_streaming_aligner_lagging_diarization():
    """
    Invariant: When diarization lags, unconfirmed tokens enter buffer_diarization,
    and once diarization catches up, they are attributed exactly once.
    """
    aligner = StreamingAligner()

    tokens_batch1 = [
        {"text": "One", "start": 0.0, "end": 0.5},
        {"text": "Two", "start": 0.5, "end": 1.0},
    ]

    tokens_batch2 = [
        {"text": "Three", "start": 1.0, "end": 1.5},
        {"text": "Four", "start": 1.5, "end": 2.0},
    ]

    # Feed tokens before diarization arrives
    out1 = aligner.feed_asr_tokens(tokens_batch1)
    assert len(out1) == 0  # Buffered because diarization is lagging
    assert len(aligner.buffer_tokens) == 2

    # Diarization arrives up to t=1.2s
    aligner.update_diarization([
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 1.2}
    ])

    # Now feeding batch2 or re-evaluating allows batch1 to be confirmed
    out2 = aligner.feed_asr_tokens(tokens_batch2)
    # Batch1 tokens (end <= 1.2) are attributed to SPEAKER_00
    assert len(out2) > 0
    assert "One Two" in out2[0]["text"]

    # Diarization catches up to 3.0s
    aligner.update_diarization([
        {"speaker": "SPEAKER_01", "start": 1.2, "end": 3.0}
    ])
    out3 = aligner.flush_remaining()
    assert len(out3) > 0
    assert "Three Four" in out3[0]["text"]

    # Verify total attributed words
    all_words = []
    for line in aligner.confirmed_lines:
        all_words.extend(line["text"].split())
    assert all_words == ["One", "Two", "Three", "Four"]
