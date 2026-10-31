# 🎙️ Vyohm — Zero-Loss Audio Alignment, Safe Action Execution & Meeting Intelligence Platform

> **Vyohm** is an enterprise-grade audio transcription, zero-loss speaker alignment, and meeting intelligence platform built with **FastAPI**, **Next.js 14**, **Groq Whisper**, and **Claude**. It guarantees zero word loss across conversational speaker boundaries, enforces strict human-in-the-loop confirmation safeguards for calendar/email actions, and features robust SHA-256 deduplication to prevent duplicate processing.

---

## 📌 Table of Contents
1. [Why We Built This](#-why-we-built-this)
2. [How We Built It (System Architecture)](#-how-we-built-it-system-architecture)
3. [Why It's Robust (Core Engineering Guarantees)](#-why-its-robust-core-engineering-guarantees)
4. [Duplicate Processing Prevention (P0 Safety Mechanism)](#-duplicate-processing-prevention-p0-safety-mechanism)
5. [Action Safeguards (Human-in-the-Loop)](#-action-safeguards-human-in-the-loop)
6. [Tech Stack](#-tech-stack)
7. [Project Directory Layout](#-project-directory-layout)
8. [Getting Started & Local Setup](#-getting-started--local-setup)
9. [API Reference & Endpoints](#-api-reference--endpoints)
10. [Automated Verification Tests](#-automated-verification-tests)

---

## 💡 Why We Built This

Traditional meeting recorders, speech-to-text APIs, and AI voice assistants suffer from four critical architectural flaws:

1. **Boundary Word Loss & Diarization Mangles**:
   When multiple people speak or interrupt each other, standard diarization algorithms (e.g., Pyannote) slice audio on arbitrary time windows. When aligning with ASR word tokens, boundary words get truncated, duplicated, or completely dropped. In legal, medical, or executive contexts, losing a word like *"not"*, *"never"*, or a crucial date alters the entire legal record.

2. **Accidental & Unsafe Autonomous Actions**:
   Modern LLMs with tool access frequently hallucinate or trigger high-consequence external side effects—such as sending half-baked emails or booking overlapping calendar invites without user approval.

3. **Hallucinated Answers Without Ground Truth**:
   Generic conversational assistants answer questions about past meetings without providing verifiable citations, making it impossible to check which participant made a statement or at what exact millisecond it was uttered.

4. **Wasted Compute & Duplicate Processing Loops**:
   When users accidentally upload the same voice recording multiple times, or when a worker process crashes and retries a task, standard pipelines run redundant Whisper and LLM calls. This creates duplicate transcripts, exhausts API token limits, and corrupts analytics data.

**Vyohm was built from first principles to solve these four problems.**

---

## 🏗️ How We Built It (System Architecture)

```
                            ┌──────────────────────────────────────────────┐
                            │          Next.js 14 Client (Web UI)          │
                            │   (Sleek Dark Theme, Violet Accents, Player) │
                            └──────────────────────┬───────────────────────┘
                                                   │ HTTP / REST
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     Vyohm FastAPI Engine                                         │
│                                                                                                  │
│  ┌───────────────────────┐   ┌───────────────────────────────┐   ┌─────────────────────────────┐ │
│  │ SHA-256 Ingest &      ├──►│ Asynchronous Job Queue        ├──►│ Zero-Loss Alignment Engine  │ │
│  │ Deduplication Guard   │   │ (Deterministic Job IDs)       │   │ (WhisperLiveKit Invariant)  │ │
│  └───────────────────────┘   └───────────────────────────────┘   └──────────────┬──────────────┘ │
│                                                                                 │                │
│  ┌───────────────────────┐   ┌───────────────────────────────┐                  ▼                │
│  │ Claude Intelligence   │◄──┤ Dual Database Layer           │◄─── [Groq Whisper STT + Diar]   │
│  │ (Alias, Summary,      │   │ (SQLite Fallback + MongoDB)   │                                   │
│  │  Insights, Approvals) │   └──────────────┬────────────────┘                                   │
│  └───────────────────────┘                  │                                                    │
│                                             ▼                                                    │
│                              ┌───────────────────────────────┐                                   │
│                              │ MinIO / Disk Storage Engine   │                                   │
│                              └───────────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Core Components
- **FastAPI Core (`backend/main.py`)**: Asynchronous, ASGI-driven API with background workers, CORS middleware, and automated acceptance test runners.
- **Whisper Alignment Layer (`backend/aligner.py`)**: Implements the zero-loss alignment algorithm ensuring every single ASR token is attributed to the correct speaker without altering characters or missing words.
- **Pipeline Runner (`backend/engine.py`)**: Fast inference using Groq `whisper-large-v3-turbo` with word-level timestamps, combined with diarization clustering and fallback acoustics.
- **Claude Intelligence Layer (`backend/claude_chat.py`, `backend/tools.py`)**: Anthropic Claude integration scoped to the current recording's transcript. Powers automated alias generation, 2–3 sentence ready summaries, key phrase extraction, and follow-up email drafts.
- **Storage Subsystem (`backend/storage.py`)**: Unified local disk storage (`backend/uploads/`) with MinIO S3 object-storage synchronization.
- **Live Watcher (`backend/watcher.py`)**: Background directory watcher that ingests hardware audio clips automatically with deduplication and zero server restarts.
- **Next.js Frontend (`frontend/src/`)**: Modern reactive interface built with React 18, TypeScript, Lucide Icons, and Tailwind CSS.

---

## 🛡️ Why It's Robust (Core Engineering Guarantees)

### 1. The Zero-Loss Speaker Alignment Invariant
- **Word Preservation Guarantee**:
  $$\text{Count}(\text{Tokens}_{\text{Input}}) = \text{Count}(\text{Words}_{\text{Aligned}})$$
- **Character-Level Identity**: Punctuation, casing, contractions, and word order in the original speech stream are mathematically verified against the aligned output via `verify_zero_loss`.
- **Silence Isolation**: Audio pauses greater than the silence threshold ($1.0\,\text{s}$) are strictly isolated into dedicated segment rows with speaker label `"-2"`, preventing speech bleeding into pause gaps.

### 2. Dual Database Resilience (Zero Downtime)
- Primary support for **MongoDB** (production clusters).
- Automatic, transparent fallback to embedded **SQLite** (`vyohm.db`) with zero manual configuration. If MongoDB is offline, Vyohm continues operating without disruption.

### 3. Strict Citation & Source Grounding
- RAG queries answer questions **only** from the transcribed audio.
- Every claim returns structured citations containing `recording_id`, `speaker`, `time_ms`, and snippet evidence.
- Verified $\ge 80\%$ abstention rate on out-of-domain or unanswerable queries (*"The recordings do not contain this information"*).

---

## 🔒 Duplicate Processing Prevention (P0 Safety Mechanism)

To solve duplicate uploads, worker retries after crashes, and wasted compute, Vyohm incorporates a multi-layer deduplication engine:

```
Audio Upload
     │
     ▼
[Compute SHA-256 Checksum]
     │
     ├──► Checksum matches existing recording?
     │         │
     │         ├── Yes & Status == 'PROCESSING' ──► HTTP 200 (duplicate, in_flight: true) [No new job]
     │         ├── Yes & Status == 'COMPLETED'  ──► HTTP 200 (duplicate, already processed) [No new job]
     │         └── Yes & Status == 'FAILED'     ──► Retry pipeline with same deterministic job ID
     │
     └──► No ──► Compute Deterministic Job ID: `job-{checksum[:16]}`
                 │
                 ├── Insert DB (Guaranteed unique by SQLite partial index)
                 ├── Register Deterministic Job in Queue
                 └── Dispatch Background Pipeline (HTTP 201 Created)
```

### Key Mechanisms:
1. **SHA-256 Content Hashing**:
   - Audio bytes are hashed immediately on stream read:
     ```python
     checksum = hashlib.sha256(contents).hexdigest()
     ```
   - Renaming `meeting.wav` to `meeting_copy.wav` or changing timestamps **will not** fool the system; the content hash is invariant.

2. **Deterministic Job IDs**:
   - Rather than generating random UUIDs (`job-8a7f1...`), job IDs are deterministically derived:
     ```python
     job_id = f"job-{checksum[:16]}"
     ```
   - Re-submitting an identical clip targets the exact same job queue row.

3. **Active In-Flight Locking**:
   - Before launching background workers, the system checks whether the recording or job is already in `PROCESSING` or `PENDING` state via `db.is_recording_processing()`.
   - If active, the secondary upload is safely ignored with HTTP 200, preventing parallel execution and duplicate segments.

4. **Database-Level Uniqueness**:
   - Enforced by SQLite partial unique indexing:
     ```sql
     CREATE UNIQUE INDEX idx_recordings_checksum
     ON recordings(checksum)
     WHERE checksum IS NOT NULL AND checksum != '';
     ```
   - Guarantees database engine enforcement even under high concurrency.

5. **Crash & Retry Idempotency**:
   - If a worker crashes or fails, re-uploading the file triggers an idempotent retry that reuses the existing recording record instead of creating a second row.
   - `save_segments()` executes `DELETE FROM segments WHERE recording_id = ?` before inserting, ensuring transcript segments are never duplicated.

---

## ✉️ Action Safeguards (Human-in-the-Loop)

Vyohm enforces strict confirmation boundaries for any AI-triggered action:

- **No Auto-Sending**: Vyohm has **no programmatic capability** to send emails or write calendar events automatically.
- **Drafts Only**: When Claude or the pipeline identifies a follow-up action (e.g., emailing vendor deliverables, scheduling review syncs), it calls `draft_email` or `create_calendar_event`.
- **`awaiting_confirmation` Status**: Action items are saved to the `action_items` table with state `awaiting_confirmation`.
- **Approval Dashboard (`/email-approval`)**: Users must review the recipient, subject, time, and body before clicking **Approve** or **Reject**.

---

## 💻 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | Python 3.10+, FastAPI, Uvicorn, Pydantic v2 |
| **Speech-to-Text** | Groq API (`whisper-large-v3-turbo`), Faster-Whisper |
| **Diarization & Alignment**| Pyannote Audio 3.1, Vyohm Zero-Loss Dynamic Programming Aligner |
| **LLM & Agent Layer** | Anthropic Claude (`claude-sonnet-4-6`), LangChain Tools |
| **Data & Storage** | SQLite (`vyohm.db`), PyMongo (MongoDB), MinIO (S3-compatible) |
| **Frontend Framework** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling & UI** | Tailwind CSS, Lucide React Icons |

---

## 📁 Project Directory Layout

```
vyohm/
├── backend/
│   ├── aligner.py          # Zero-loss alignment & mathematical verification algorithms
│   ├── engine.py           # Whisper STT, diarization clustering, background pipeline
│   ├── claude_chat.py      # Claude Sonnet integration scoped to single recording
│   ├── tools.py            # LangChain-compatible calendar & email draft tool schemas
│   ├── database.py         # Dual DB manager (SQLite & MongoDB) with schema migrations
│   ├── storage.py          # Local disk and MinIO S3 object sync
│   ├── watcher.py          # Live file system watcher with SHA-256 deduplication
│   ├── main.py             # FastAPI routes, contract endpoints, verification suites
│   ├── requirements.txt    # Python package dependencies
│   ├── .env                # API keys and configuration
│   └── uploads/            # Local audio file storage directory
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # Main Dashboard with sidebar and audio player
│   │   │   ├── email-approval/        # Human-in-the-loop action approval interface
│   │   │   └── recordings/[id]/       # Two-column detail page (Transcript + AI Panel)
│   │   ├── components/                # Modular UI components (Navbar, Sidebar, Modals, etc.)
│   │   └── lib/
│   │       └── api.ts                 # Typed REST client connecting frontend to backend
│   ├── package.json
│   └── tailwind.config.js
│
└── README.md
```

---

## 🚀 Getting Started & Local Setup

### 1. Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: 18.x or higher
- **FFmpeg**: Installed and available on system PATH

### 2. Backend Setup
1. Navigate to the backend directory and configure the virtual environment:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure `backend/.env`:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   CLAUDE_KEY=sk-ant-your_claude_api_key_here
   CLAUDE_MODEL=claude-sonnet-4-6

   # MinIO Object Storage (Optional - defaults to local disk)
   MINIO_ENDPOINT=127.0.0.1:9000
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   MINIO_BUCKET=vyohm-recordings
   MINIO_SECURE=false

   # Live Watcher (Optional)
   ENABLE_WATCHER=false
   ```
4. Start the backend development server:
   ```bash
   python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
   ```
   *The API will be available at `http://127.0.0.1:8000` (Swagger docs at `/docs`).*

### 3. Frontend Setup
1. Open a second terminal and navigate to `frontend`:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   *The web application will be live at `http://localhost:3000`.*

---

## 📡 API Reference & Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/upload` | Contract upload endpoint with SHA-256 deduplication and deterministic jobs |
| `GET` | `/transcriptions/{job_id}` | Poll background processing status and pipeline stage |
| `GET` | `/recordings` | List all stored recordings with alias, summary, and metadata |
| `GET` | `/recordings/{id}` | Detailed recording view with time-indexed speaker segments |
| `DELETE`| `/recordings/{id}` | Deletes audio from disk, MinIO, and records from DB |
| `GET` | `/audio/{id}` | Stream audio file for HTML5 playback with range support |
| `POST` | `/recordings/{id}/insights` | Claude generates alias, ready-to-read summary, and key phrases |
| `POST` | `/recordings/{id}/draft-followup`| Claude drafts context-aware follow-up email saved to approvals |
| `POST` | `/chat/recording/{id}` | Multi-turn conversational chat scoped to a specific recording |
| `GET` | `/search` | Global search across all transcripts with date filtering |
| `GET` | `/action-items` | List calendar/email drafts awaiting confirmation |
| `POST` | `/action-items/{id}/confirm` | Confirm or reject a pending action item |

---

## 🧪 Automated Verification Tests

Vyohm includes automated acceptance test runners verifying core system invariants:

1. **Phase 1: Zero-Loss Alignment Verification**
   ```bash
   curl -X POST http://127.0.0.1:8000/verify/phase1
   ```
   *Verifies character-level identical match, word count equality, and silence separation.*

2. **Phase 2: RAG Citations & Approval Safeguards**
   ```bash
   curl -X POST http://127.0.0.1:8000/verify/phase2
   ```
   *Verifies transcript search, millisecond-level citations, and draft-only email creation.*

3. **Phase 3: Idempotency & Deduplication Suite**
   ```bash
   curl -X POST http://127.0.0.1:8000/verify/phase3
   ```
   *Validates duplicate upload rejection and $\ge 80\%$ unanswerable question abstention rate.*

---


