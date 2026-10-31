"""
Database Layer for Vyohm
Dual support: MongoDB (Primary) with resilient SQLite Fallback.
Provides unified API for recordings, segments, action items, and jobs.
Enforces UNIQUE(device_id, recorded_at) idempotency constraint.
"""

import os
import sqlite3
import json
import uuid
import datetime
from typing import Dict, Any, List, Optional, Tuple
import pymongo
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("MONGODB_DB", "vyohm")
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "vyohm.db")


class DatabaseManager:
    def __init__(self):
        self.mode = "sqlite"  # 'mongodb' or 'sqlite'
        self.mongo_client: Optional[MongoClient] = None
        self.mongo_db = None
        self._init_connection()
        self._init_schema()

    def _init_connection(self):
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1500)
            client.server_info()  # Trigger fast connection check
            self.mongo_client = client
            self.mongo_db = client[DB_NAME]
            self.mode = "mongodb"
            print(f"[Database] Successfully connected to MongoDB at {MONGO_URI} (DB: {DB_NAME})")
        except Exception as e:
            self.mode = "sqlite"
            print(f"[Database] MongoDB offline or unreachable ({e}). Using embedded SQLite database ({SQLITE_DB_PATH}) as active store.")

    def _get_sqlite_conn(self):
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self):
        if self.mode == "mongodb":
            try:
                # Ensure unique compound index on (device_id, recorded_at) for idempotency
                self.mongo_db.recordings.create_index(
                    [("device_id", pymongo.ASCENDING), ("recorded_at", pymongo.ASCENDING)],
                    unique=True,
                    name="unique_device_recorded_at"
                )
                self.mongo_db.segments.create_index([("recording_id", pymongo.ASCENDING)])
                self.mongo_db.action_items.create_index([("recording_id", pymongo.ASCENDING)])
                self.mongo_db.jobs.create_index([("job_id", pymongo.ASCENDING)], unique=True)
            except Exception as e:
                print(f"[Database] Warning creating Mongo indexes: {e}")
        
        # Always initialize SQLite schema as fallback or backup
        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recordings (
                id TEXT PRIMARY KEY,
                device_id TEXT NOT NULL,
                recorded_at TEXT NOT NULL,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                duration_ms INTEGER DEFAULT 0,
                word_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'COMPLETED',
                summary TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(device_id, recorded_at)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS segments (
                id TEXT PRIMARY KEY,
                recording_id TEXT NOT NULL,
                speaker TEXT NOT NULL,
                text TEXT NOT NULL,
                start_ms INTEGER NOT NULL,
                end_ms INTEGER NOT NULL,
                order_idx INTEGER NOT NULL,
                FOREIGN KEY (recording_id) REFERENCES recordings(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_items (
                id TEXT PRIMARY KEY,
                recording_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                details TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'awaiting_confirmation',
                created_at TEXT NOT NULL,
                FOREIGN KEY (recording_id) REFERENCES recordings(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                stage TEXT NOT NULL,
                error TEXT,
                data TEXT,
                updated_at TEXT NOT NULL
            )
        """)

        conn.commit()

        # Migrate existing DBs: add alias, key_insights, and checksum columns if they don't exist
        try:
            cursor.execute("ALTER TABLE recordings ADD COLUMN alias TEXT DEFAULT ''")
            conn.commit()
        except Exception:
            pass  # Column already exists
        try:
            cursor.execute("ALTER TABLE recordings ADD COLUMN key_insights TEXT DEFAULT '[]'")
            conn.commit()
        except Exception:
            pass  # Column already exists
        try:
            cursor.execute("ALTER TABLE recordings ADD COLUMN checksum TEXT DEFAULT ''")
            conn.commit()
        except Exception:
            pass  # Column already exists

        # Unique partial index on checksum: ensures absolute uniqueness at the DB level
        # while ignoring empty legacy rows without checksum
        try:
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_recordings_checksum
                ON recordings(checksum)
                WHERE checksum IS NOT NULL AND checksum != ''
            """)
            conn.commit()
        except Exception:
            pass

        conn.close()

    # ---------------- RECORDINGS & IDEMPOTENCY ---------------- #

    def create_recording(
        self,
        device_id: str,
        recorded_at: str,
        filename: str,
        filepath: str,
        duration_ms: int = 0,
        word_count: int = 0,
        summary: str = "",
        recording_id: Optional[str] = None,
        checksum: Optional[str] = None
    ) -> Tuple[Optional[Dict[str, Any]], bool]:
        """
        Idempotent recording creation.
        Returns (recording_dict, is_duplicate).
        If (checksum) already exists (non-empty) OR (device_id, recorded_at) already exists,
        returns existing record and True.
        """
        rec_id = recording_id or f"rec-{uuid.uuid4().hex[:8]}"
        now = datetime.datetime.utcnow().isoformat()
        checksum_val = (checksum or "").strip()

        # 1. Fast checksum deduplication check
        if checksum_val:
            existing = self.get_recording_by_checksum(checksum_val)
            if existing:
                return existing, True

        if self.mode == "mongodb":
            # Check (device_id, recorded_at)
            existing = self.mongo_db.recordings.find_one({"device_id": device_id, "recorded_at": recorded_at})
            if existing:
                existing["id"] = existing.get("_id", existing.get("id"))
                return existing, True

            doc = {
                "_id": rec_id,
                "id": rec_id,
                "device_id": device_id,
                "recorded_at": recorded_at,
                "filename": filename,
                "filepath": filepath,
                "duration_ms": duration_ms,
                "word_count": word_count,
                "status": "PROCESSING",
                "summary": summary,
                "checksum": checksum_val,
                "created_at": now
            }
            try:
                self.mongo_db.recordings.insert_one(doc)
                return doc, False
            except DuplicateKeyError:
                if checksum_val:
                    existing = self.mongo_db.recordings.find_one({"checksum": checksum_val})
                if not existing:
                    existing = self.mongo_db.recordings.find_one({"device_id": device_id, "recorded_at": recorded_at})
                if existing:
                    existing["id"] = existing.get("_id", existing.get("id"))
                return existing, True
            except Exception as e:
                print(f"[Database] Mongo error: {e}, falling back to SQLite for this operation")

        # SQLite implementation
        conn = self._get_sqlite_conn()
        cursor = conn.cursor()

        # Check (device_id, recorded_at) in SQLite first
        cursor.execute("SELECT * FROM recordings WHERE device_id = ? AND recorded_at = ?", (device_id, recorded_at))
        existing_row = cursor.fetchone()
        if existing_row:
            conn.close()
            return dict(existing_row), True

        try:
            cursor.execute("""
                INSERT INTO recordings (id, device_id, recorded_at, filename, filepath, duration_ms, word_count, status, summary, checksum, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PROCESSING', ?, ?, ?)
            """, (rec_id, device_id, recorded_at, filename, filepath, duration_ms, word_count, summary, checksum_val, now))
            conn.commit()
            cursor.execute("SELECT * FROM recordings WHERE id = ?", (rec_id,))
            row = dict(cursor.fetchone())
            conn.close()
            return row, False
        except sqlite3.IntegrityError:
            # Collision on unique constraint (checksum or device_id+recorded_at)
            row = None
            if checksum_val:
                cursor.execute("SELECT * FROM recordings WHERE checksum = ?", (checksum_val,))
                row = cursor.fetchone()
            if not row:
                cursor.execute("SELECT * FROM recordings WHERE device_id = ? AND recorded_at = ?", (device_id, recorded_at))
                row = cursor.fetchone()
            conn.close()
            return dict(row) if row else None, True

    def get_recording_by_checksum(self, checksum: str) -> Optional[Dict[str, Any]]:
        """Look up recording by its SHA-256 checksum."""
        if not checksum or not checksum.strip():
            return None
        checksum = checksum.strip()

        if self.mode == "mongodb":
            try:
                rec = self.mongo_db.recordings.find_one({"checksum": checksum})
                if rec:
                    rec["id"] = str(rec.get("_id", rec.get("id")))
                    rec.pop("_id", None)
                    return rec
            except Exception as e:
                print(f"[Database] Mongo read checksum error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM recordings WHERE checksum = ?", (checksum,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def is_recording_processing(self, recording_id: Optional[str] = None, checksum: Optional[str] = None) -> bool:
        """Check whether a recording or its deterministic job is currently in progress."""
        rec = None
        if checksum:
            rec = self.get_recording_by_checksum(checksum)
        if not rec and recording_id:
            rec = self.get_recording(recording_id)

        if rec and rec.get("status") in ("PROCESSING", "PENDING"):
            return True

        if checksum:
            job_id = f"job-{checksum[:16]}"
            job = self.get_job(job_id)
            if job and job.get("status") in ("PROCESSING", "PENDING"):
                return True

        return False

    def update_recording(self, recording_id: str, updates: Dict[str, Any]):
        if self.mode == "mongodb":
            try:
                self.mongo_db.recordings.update_one({"id": recording_id}, {"$set": updates})
                return
            except Exception as e:
                print(f"[Database] Mongo update error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        clauses = []
        params = []
        for k, v in updates.items():
            clauses.append(f"{k} = ?")
            params.append(v)
        params.append(recording_id)
        cursor.execute(f"UPDATE recordings SET {', '.join(clauses)} WHERE id = ?", params)
        conn.commit()
        conn.close()

    def get_recording(self, recording_id: str) -> Optional[Dict[str, Any]]:
        if self.mode == "mongodb":
            try:
                rec = self.mongo_db.recordings.find_one({"id": recording_id})
                if rec:
                    rec["id"] = str(rec.get("_id", rec.get("id")))
                    rec.pop("_id", None)
                    return rec
            except Exception as e:
                print(f"[Database] Mongo read error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM recordings WHERE id = ?", (recording_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def list_recordings(self) -> List[Dict[str, Any]]:
        if self.mode == "mongodb":
            try:
                records = list(self.mongo_db.recordings.find().sort("recorded_at", pymongo.DESCENDING))
                for r in records:
                    r["id"] = str(r.get("_id", r.get("id")))
                    r.pop("_id", None)
                return records
            except Exception as e:
                print(f"[Database] Mongo list error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM recordings ORDER BY recorded_at DESC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows

    def delete_recording(self, recording_id: str) -> bool:
        """
        Deletes recording and all associated segments and action items from DB.
        Returns True if recording was deleted, False if not found.
        """
        if self.mode == "mongodb":
            try:
                self.mongo_db.segments.delete_many({"recording_id": recording_id})
                self.mongo_db.action_items.delete_many({"recording_id": recording_id})
                res = self.mongo_db.recordings.delete_one({"id": recording_id})
                return res.deleted_count > 0
            except Exception as e:
                print(f"[Database] Mongo delete error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM segments WHERE recording_id = ?", (recording_id,))
        cursor.execute("DELETE FROM action_items WHERE recording_id = ?", (recording_id,))
        cursor.execute("DELETE FROM recordings WHERE id = ?", (recording_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    # ---------------- SEGMENTS ---------------- #

    def save_segments(self, recording_id: str, segments: List[Dict[str, Any]]):
        if self.mode == "mongodb":
            try:
                self.mongo_db.segments.delete_many({"recording_id": recording_id})
                docs = []
                for idx, seg in enumerate(segments):
                    docs.append({
                        "_id": f"{recording_id}-seg-{idx}",
                        "recording_id": recording_id,
                        "speaker": seg.get("speaker", "UNKNOWN"),
                        "text": seg.get("text", ""),
                        "start_ms": seg.get("start_ms", int(seg.get("start", 0) * 1000)),
                        "end_ms": seg.get("end_ms", int(seg.get("end", 0) * 1000)),
                        "order_idx": idx
                    })
                if docs:
                    self.mongo_db.segments.insert_many(docs)
                return
            except Exception as e:
                print(f"[Database] Mongo save segments error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM segments WHERE recording_id = ?", (recording_id,))
        for idx, seg in enumerate(segments):
            seg_id = f"{recording_id}-seg-{idx}"
            start_ms = seg.get("start_ms", int(seg.get("start", 0) * 1000))
            end_ms = seg.get("end_ms", int(seg.get("end", 0) * 1000))
            cursor.execute("""
                INSERT INTO segments (id, recording_id, speaker, text, start_ms, end_ms, order_idx)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (seg_id, recording_id, seg.get("speaker", "UNKNOWN"), seg.get("text", ""), start_ms, end_ms, idx))
        conn.commit()
        conn.close()

    def get_segments(self, recording_id: str) -> List[Dict[str, Any]]:
        if self.mode == "mongodb":
            try:
                segs = list(self.mongo_db.segments.find({"recording_id": recording_id}).sort("order_idx", pymongo.ASCENDING))
                for s in segs:
                    s["id"] = str(s.get("_id", s.get("id")))
                    s.pop("_id", None)
                return segs
            except Exception as e:
                print(f"[Database] Mongo get segments error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM segments WHERE recording_id = ? ORDER BY order_idx ASC", (recording_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows

    def search_transcripts(self, query: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search across all transcript segments with optional date filtering."""
        query_lower = query.lower()
        results = []

        if self.mode == "mongodb":
            try:
                # Text regex match
                filter_q = {"text": {"$regex": query, "$options": "i"}}
                segs = list(self.mongo_db.segments.find(filter_q))
                for s in segs:
                    rec = self.mongo_db.recordings.find_one({"id": s["recording_id"]})
                    if rec:
                        rec_date = rec.get("recorded_at", "")
                        if date_from and rec_date < date_from:
                            continue
                        if date_to and rec_date > date_to:
                            continue
                        results.append({
                            "segment_id": str(s.get("_id", s.get("id"))),
                            "recording_id": s["recording_id"],
                            "recording_name": rec.get("filename", ""),
                            "recorded_at": rec_date,
                            "speaker": s["speaker"],
                            "text": s["text"],
                            "start_ms": s["start_ms"],
                            "end_ms": s["end_ms"]
                        })
                return results
            except Exception as e:
                print(f"[Database] Mongo search error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id as segment_id, s.recording_id, s.speaker, s.text, s.start_ms, s.end_ms,
                   r.filename as recording_name, r.recorded_at
            FROM segments s
            JOIN recordings r ON s.recording_id = r.id
            WHERE LOWER(s.text) LIKE ?
            ORDER BY r.recorded_at DESC, s.start_ms ASC
        """, (f"%{query_lower}%",))
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()

        for r in rows:
            rec_date = r.get("recorded_at", "")
            if date_from and rec_date < date_from:
                continue
            if date_to and rec_date > date_to:
                continue
            results.append(r)
        return results

    # ---------------- ACTION ITEMS ---------------- #

    def create_action_item(
        self,
        recording_id: str,
        item_type: str,
        title: str,
        details: Dict[str, Any],
        status: str = "awaiting_confirmation"
    ) -> Dict[str, Any]:
        item_id = f"act-{uuid.uuid4().hex[:8]}"
        now = datetime.datetime.utcnow().isoformat()
        details_str = json.dumps(details) if isinstance(details, dict) else str(details)

        if self.mode == "mongodb":
            try:
                doc = {
                    "_id": item_id,
                    "id": item_id,
                    "recording_id": recording_id,
                    "type": item_type,
                    "title": title,
                    "details": details if isinstance(details, dict) else json.loads(details_str),
                    "status": status,
                    "created_at": now
                }
                self.mongo_db.action_items.insert_one(doc)
                return doc
            except Exception as e:
                print(f"[Database] Mongo action item error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO action_items (id, recording_id, type, title, details, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (item_id, recording_id, item_type, title, details_str, status, now))
        conn.commit()
        conn.close()
        return {
            "id": item_id,
            "recording_id": recording_id,
            "type": item_type,
            "title": title,
            "details": details,
            "status": status,
            "created_at": now
        }

    def list_action_items(self, status: Optional[str] = None, recording_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.mode == "mongodb":
            try:
                query = {}
                if status:
                    query["status"] = status
                if recording_id:
                    query["recording_id"] = recording_id
                items = list(self.mongo_db.action_items.find(query).sort("created_at", pymongo.DESCENDING))
                for item in items:
                    item["id"] = str(item.get("_id", item.get("id")))
                    item.pop("_id", None)
                return items
            except Exception as e:
                print(f"[Database] Mongo list actions error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        q = "SELECT * FROM action_items WHERE 1=1"
        params = []
        if status:
            q += " AND status = ?"
            params.append(status)
        if recording_id:
            q += " AND recording_id = ?"
            params.append(recording_id)
        q += " ORDER BY created_at DESC"
        cursor.execute(q, params)
        rows = []
        for r in cursor.fetchall():
            d = dict(r)
            try:
                d["details"] = json.loads(d["details"])
            except Exception:
                pass
            rows.append(d)
        conn.close()
        return rows

    def confirm_action_item(self, action_id: str, decision: str = "confirmed") -> Optional[Dict[str, Any]]:
        """
        Confirms or rejects an action item (e.g. Calendar event or Draft email).
        Enforces that draft_email is strictly saved as draft, never sent.
        """
        valid_status = "confirmed" if decision in ["confirmed", "approve", "approved"] else "rejected"

        if self.mode == "mongodb":
            try:
                self.mongo_db.action_items.update_one({"id": action_id}, {"$set": {"status": valid_status}})
                item = self.mongo_db.action_items.find_one({"id": action_id})
                if item:
                    item["id"] = str(item.get("_id", item.get("id")))
                    item.pop("_id", None)
                    return item
            except Exception as e:
                print(f"[Database] Mongo confirm error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("UPDATE action_items SET status = ? WHERE id = ?", (valid_status, action_id))
        conn.commit()
        cursor.execute("SELECT * FROM action_items WHERE id = ?", (action_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            d = dict(row)
            try:
                d["details"] = json.loads(d["details"])
            except Exception:
                pass
            return d
        return None

    # ---------------- JOBS ---------------- #

    def set_job(self, job_id: str, status: str, stage: str, data: Optional[Dict[str, Any]] = None, error: Optional[str] = None):
        now = datetime.datetime.utcnow().isoformat()
        if self.mode == "mongodb":
            try:
                self.mongo_db.jobs.update_one(
                    {"job_id": job_id},
                    {"$set": {
                        "job_id": job_id,
                        "status": status,
                        "stage": stage,
                        "data": data or {},
                        "error": error,
                        "updated_at": now
                    }},
                    upsert=True
                )
                return
            except Exception as e:
                print(f"[Database] Mongo job save error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO jobs (job_id, status, stage, error, data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                status = excluded.status,
                stage = excluded.stage,
                error = excluded.error,
                data = excluded.data,
                updated_at = excluded.updated_at
        """, (job_id, status, stage, error, json.dumps(data) if data else None, now))
        conn.commit()
        conn.close()

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        if self.mode == "mongodb":
            try:
                job = self.mongo_db.jobs.find_one({"job_id": job_id})
                if job:
                    job.pop("_id", None)
                    return job
            except Exception as e:
                print(f"[Database] Mongo get job error: {e}")

        conn = self._get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            d = dict(row)
            try:
                d["data"] = json.loads(d["data"]) if d["data"] else {}
            except Exception:
                pass
            return d
        return None


# Global singleton instance
db = DatabaseManager()
