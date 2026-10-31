"""
End-to-End Acceptance Tests for Vyohm (Phases 1, 2, 3)
Verifies:
1. Phase 1: Upload pipeline, zero loss, speaker-labeled segments, character-level identical text.
2. Phase 2: Transcript search, RAG Q&A with strict citations, action confirmation logic.
3. Phase 3: Offline queue & idempotency (201 created vs 200 duplicate), abstention evaluation (>=80%).
"""

import io
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import db

client = TestClient(app)


def test_phase1_verification_endpoint():
    """Phase 1 Acceptance Criteria Verification"""
    res = client.post("/verify/phase1")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PASS"
    assert data["loss_report"]["zero_loss_verified"] is True
    assert data["criteria"]["no_missing_words"] is True
    assert data["criteria"]["character_level_identical"] is True
    assert data["silence_segments_isolated"] is True


def test_phase2_verification_endpoint():
    """Phase 2 Acceptance Criteria Verification"""
    res = client.post("/verify/phase2")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PASS"
    assert data["calendar_requires_confirmation"] is True
    assert data["email_draft_only_no_send"] is True
    assert data["citations_verified"] is True
    assert data["criteria"]["email_draft_saved_never_sent"] is True


def test_phase3_verification_endpoint():
    """Phase 3 Acceptance Criteria Verification"""
    res = client.post("/verify/phase3")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PASS"
    assert data["idempotency_verified"] is True
    assert data["abstention_target_met"] is True
    assert data["abstention_rate_pct"] >= 80.0


def test_idempotency_upload_contract():
    """
    Contract test:
    First upload -> HTTP 201 Created
    Duplicate upload (same device_id & recorded_at) -> HTTP 200 OK with {"status": "duplicate"}
    """
    import uuid
    audio_content = b"RIFF....WAVEfmt ...."
    device_id = f"hw-contract-{uuid.uuid4().hex[:6]}"
    recorded_at = "2026-10-31T11:00:00Z"

    # First upload
    res1 = client.post(
        "/upload",
        data={"device_id": device_id, "recorded_at": recorded_at},
        files={"audio": ("test_clip.wav", io.BytesIO(audio_content), "audio/wav")}
    )
    assert res1.status_code == 201
    d1 = res1.json()
    assert d1["status"] == "PENDING"
    assert "id" in d1

    # Second duplicate upload
    res2 = client.post(
        "/upload",
        data={"device_id": device_id, "recorded_at": recorded_at},
        files={"audio": ("test_clip.wav", io.BytesIO(audio_content), "audio/wav")}
    )
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["status"] == "duplicate"


def test_chat_abstention_and_citations():
    """Test that out-of-domain questions abstain, and in-domain questions cite sources."""
    # Out-of-domain question
    res_out = client.post("/chat", json={"query": "What is the airspeed velocity of an unladen swallow?"})
    assert res_out.status_code == 200
    d_out = res_out.json()
    assert "The recordings do not contain this information" in d_out["answer"]
    assert len(d_out["sources"]) == 0

    # In-domain question
    res_in = client.post("/chat", json={"query": "What did we promise the vendor?"})
    assert res_in.status_code == 200
    d_in = res_in.json()
    assert len(d_in["sources"]) > 0
    first_source = d_in["sources"][0]
    assert "recording_id" in first_source
    assert "time_ms" in first_source
