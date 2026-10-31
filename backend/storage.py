"""
Storage Layer for Vyohm
Dual support: Local PC Disk Storage (backend/uploads/) + MinIO (S3-compatible Object Storage).
Guarantees:
1. Every recording is saved locally to your PC in backend/uploads/.
2. If MinIO is available (e.g. localhost:9000), it automatically syncs/uploads to MinIO bucket.
3. When a recording is deleted, it is removed both from the local uploads folder AND from MinIO.
"""

import os
import io
from typing import Dict, Any, Optional

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "127.0.0.1:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "vyohm-recordings")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() in ("true", "1")


class StorageManager:
    def __init__(self):
        self.local_dir = UPLOADS_DIR
        self.bucket_name = MINIO_BUCKET
        self.minio_client = None
        self.is_minio_connected = False
        self._init_minio()

    def _init_minio(self):
        """Attempts fast connection to MinIO; falls back cleanly to local disk if offline."""
        try:
            from minio import Minio
            # Fast check
            client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE,
            )
            # Check if bucket exists or create it
            if not client.bucket_exists(self.bucket_name):
                client.make_bucket(self.bucket_name)
            self.minio_client = client
            self.is_minio_connected = True
            print(f"[Storage] MinIO connected at {MINIO_ENDPOINT} (Bucket: {self.bucket_name}). Dual-storage active.")
        except Exception as e:
            self.is_minio_connected = False
            self.minio_client = None
            print(f"[Storage] MinIO offline or unreachable ({e}). Local PC storage active: {self.local_dir}")

    def save_audio(self, filename: str, file_bytes: bytes) -> Dict[str, Any]:
        """
        Saves audio file to local PC disk in backend/uploads/.
        If MinIO is running, also syncs to MinIO bucket.
        """
        local_path = os.path.join(self.local_dir, filename)
        
        # 1. Save to local PC disk
        with open(local_path, "wb") as f:
            f.write(file_bytes)

        # 2. Sync to MinIO if connected
        minio_synced = False
        if self.is_minio_connected and self.minio_client:
            try:
                stream = io.BytesIO(file_bytes)
                self.minio_client.put_object(
                    bucket_name=self.bucket_name,
                    object_name=filename,
                    data=stream,
                    length=len(file_bytes),
                    content_type="audio/wav"
                )
                minio_synced = True
            except Exception as e:
                print(f"[Storage] Warning: Failed to sync to MinIO: {e}")

        return {
            "filepath": local_path,
            "filename": filename,
            "minio_synced": minio_synced,
            "size_bytes": len(file_bytes)
        }

    def delete_audio(self, filepath: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Deletes audio file from local PC disk in backend/uploads/.
        Also deletes from MinIO bucket if present.
        """
        local_deleted = False
        minio_deleted = False

        # 1. Delete from local PC folder
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
                local_deleted = True
                print(f"[Storage] Deleted local file: {filepath}")
            except Exception as e:
                print(f"[Storage] Failed to delete local file {filepath}: {e}")

        # Try to resolve filename if not passed
        obj_name = filename or (os.path.basename(filepath) if filepath else None)

        # Also check and clean up any potential duplicate/fallback WAV in uploads folder
        if obj_name:
            direct_local = os.path.join(self.local_dir, obj_name)
            if os.path.exists(direct_local) and direct_local != filepath:
                try:
                    os.remove(direct_local)
                    local_deleted = True
                except Exception:
                    pass

        # 2. Delete from MinIO if connected
        if obj_name and self.is_minio_connected and self.minio_client:
            try:
                self.minio_client.remove_object(self.bucket_name, obj_name)
                minio_deleted = True
                print(f"[Storage] Deleted MinIO object: {obj_name}")
            except Exception as e:
                print(f"[Storage] Failed to delete MinIO object {obj_name}: {e}")

        return {
            "local_deleted": local_deleted,
            "minio_deleted": minio_deleted
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "local_storage_dir": self.local_dir,
            "minio_connected": self.is_minio_connected,
            "minio_endpoint": MINIO_ENDPOINT if self.is_minio_connected else None,
            "minio_bucket": self.bucket_name if self.is_minio_connected else None
        }


# Global singleton instance
storage = StorageManager()
