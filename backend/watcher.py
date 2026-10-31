"""
Vyohm Live Upload Watcher (Phase 3.2 L6 Requirement)
Monitors the uploads directory in the background.
Automatically triggers the transcription/alignment pipeline when a new file lands.
Enforces deduplication and idempotency without requiring server restarts.
"""

import os
import time
import uuid
import datetime
import hashlib
import threading
from typing import Set
from backend.database import db
from backend.engine import run_pipeline

WATCH_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(WATCH_DIR, exist_ok=True)

processed_files: Set[str] = set()
_watcher_running = False


def scan_and_process():
    """Scans the upload directory for unprocessed audio files with SHA-256 deduplication."""
    try:
        files = os.listdir(WATCH_DIR)
        for fname in files:
            if not fname.lower().endswith((".wav", ".mp3", ".m4a", ".ogg", ".webm")):
                continue
            
            fpath = os.path.join(WATCH_DIR, fname)
            if not os.path.isfile(fpath):
                continue
            
            # File signature
            fstat = os.stat(fpath)
            file_key = f"{fname}-{fstat.st_size}-{fstat.st_mtime}"
            if file_key in processed_files:
                continue
            
            # Wait a moment to ensure file is completely written if still streaming
            time.sleep(0.5)

            # Compute SHA-256 checksum of file content
            try:
                with open(fpath, "rb") as f:
                    file_bytes = f.read()
                checksum = hashlib.sha256(file_bytes).hexdigest()
            except Exception as e:
                print(f"[Watcher] Error reading {fname} for checksum: {e}")
                continue

            deterministic_job_id = f"job-{checksum[:16]}"

            # Deduplication: check if already exists in DB by checksum
            existing_rec = db.get_recording_by_checksum(checksum)
            if existing_rec:
                print(f"[Watcher] Duplicate detected for {fname} (matched SHA-256 checksum {checksum[:8]}). Skipping.")
                processed_files.add(file_key)
                continue

            # Extract or assign device_id and recorded_at
            device_id = "device-auto-watcher"
            recorded_at = datetime.datetime.fromtimestamp(fstat.st_mtime).isoformat()
            
            # Check idempotency in DB
            rec, is_dup = db.create_recording(
                device_id=device_id,
                recorded_at=recorded_at,
                filename=fname,
                filepath=fpath,
                duration_ms=0,
                word_count=0,
                checksum=checksum
            )

            processed_files.add(file_key)

            if is_dup:
                print(f"[Watcher] Duplicate detected for {fname} ({device_id}, {recorded_at}). Skipping.")
                continue

            print(f"[Watcher] New audio file detected: {fname} (checksum={checksum[:8]}). Auto-triggering pipeline with deterministic job {deterministic_job_id}...")
            
            # Run pipeline asynchronously in thread
            thread = threading.Thread(target=run_pipeline, args=(deterministic_job_id, rec["id"], fpath), daemon=True)
            thread.start()

    except Exception as e:
        print(f"[Watcher] Scan error: {e}")


ENABLE_WATCHER = os.getenv("ENABLE_WATCHER", "false").lower() in ("true", "1")


def _watcher_loop(interval_sec: float = 2.0):
    global _watcher_running
    print(f"[Watcher] Live file watcher started on {WATCH_DIR} (interval={interval_sec}s)...")
    while _watcher_running:
        scan_and_process()
        time.sleep(interval_sec)


def start_watcher(interval_sec: float = 2.0):
    global _watcher_running
    if not ENABLE_WATCHER:
        print("[Watcher] Live file watcher is disabled by default (ENABLE_WATCHER=false). Unsolicited auto-recordings disabled.")
        return

    if not _watcher_running:
        _watcher_running = True
        w_thread = threading.Thread(target=_watcher_loop, args=(interval_sec,), daemon=True)
        w_thread.start()


def stop_watcher():
    global _watcher_running
    _watcher_running = False
