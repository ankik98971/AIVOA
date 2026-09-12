# AIVOA — AI-Powered Customer Complaint Management System

An AI-assisted complaint intake and triage system for a pharmaceutical
manufacturing QMS. A copilot chat panel extracts structured complaint data
from pasted text or uploaded documents (PDF/DOCX/TXT/EML), lets a QA officer
review and correct the extraction, and blocks committing incomplete
complaints to the QMS ledger.

## Tech Stack

- **Frontend:** React (Vite, plain JavaScript) + Redux Toolkit
- **Backend:** FastAPI + SQLAlchemy
- **Database:** PostgreSQL (via Docker Compose)
- **AI Orchestration:** LangGraph
- **LLM:** Groq (openai/gpt-oss-20b) — see "Model Substitution" below

## Architecture

```
User (chat text or file upload)
    |
    v
CopilotPanel.jsx --> POST /api/extract  (file upload only -- pulls raw
    |                                     text out of PDF/DOCX/TXT/EML)
    |
    v
POST /api/chat
    |
    v
LangGraph pipeline (backend/graph.py)
  - Intent router
      - NEW_COMPLAINT    -> extraction node
      - CORRECTION       -> patch node
      - GENERAL_QUESTION -> Q&A node
    |
    v
Redux (complaintSlice.js) -- form state, status badge, completeness check
    |
    v
POST /api/complaints -> PostgreSQL (QMS Ledger)
```

## Key Design Decisions

- **Model substitution:** the assignment specifies Groq's gemma2-9b-it,
  which was decommissioned (deprecated Oct 2025). We use openai/gpt-oss-20b,
  Groq's current recommended replacement.
- **Corrections don't re-synthesize the description:** when a correction
  patches a field (e.g. batch number), complaint_description is left
  untouched rather than regenerated, so user-edited narrative text is never
  silently overwritten. The frontend flags this with a descriptionStale
  warning when a patched field is one the description likely references.
- **originating_site_block uses a deterministic post-processing guard,**
  not just a prompt instruction. We found openai/gpt-oss-20b is not fully
  deterministic at temperature=0 on Groq's infrastructure, so a prompt-only
  constraint on this enum field was unreliable. After extraction, a plain
  Python keyword scan checks whether the source text actually contains one of
  the four valid site names -- if not, the field is force-set to
  "Not Provided", regardless of what the LLM returned.
- **Completeness Checker (bonus feature):** the "Ready to Commit" status is
  computed, not manually set. REQUIRED_FIELDS lives as a single source of
  truth in the backend (main.py) and is exposed via GET /api/required-fields;
  the frontend fetches it once on load rather than hardcoding its own copy.
  A complaint can only reach 'Committed' after a successful save, and that
  status is treated as terminal -- no later edit can downgrade it back to
  'Pending Triage'.

## Prerequisites

- Python 3.9
- Node.js (for the Vite frontend)
- Docker (for PostgreSQL)
- A Groq API key

## Setup & Local Run

**1. Clone and enter the project**
```bash
git clone <repo-url>
cd AIVOA
```

**2. Backend -- Python environment (venv lives at the project root)**
```bash
python3.9 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**3. Environment variables**
```bash
cp .env.example .env
```
Edit .env and add your real GROQ_API_KEY. The Postgres values can stay as
the defaults unless you want to change them.

**4. Start PostgreSQL**
```bash
docker-compose up -d
```

**5. Run the backend**
```bash
cd backend
uvicorn main:app --reload
```
Runs at http://localhost:8000.

**6. Run the frontend** (in a separate terminal)
```bash
cd frontend
npm install
npm run dev
```
Runs at http://localhost:5173.

## Testing

**Backend -- LangGraph pipeline tests** (requires a live GROQ_API_KEY in
.env, since these hit the real Groq API):
```bash
source venv/bin/activate
cd backend
python test_graph.py
```

**Frontend -- Redux logic tests:**
```bash
cd frontend
npm run test
```

## Project Structure

```
AIVOA/
  requirements.txt        Python deps (project root, not backend/)
  docker-compose.yml      PostgreSQL
  .env.example
  backend/
    main.py                FastAPI routes: /api/chat, /api/extract,
                              /api/complaints, /api/required-fields
    graph.py                LangGraph pipeline + site-block guard
    models.py               SQLAlchemy models
    schemas.py               Pydantic schemas
    database.py               DB session/engine setup
    document_parser.py         PDF/DOCX/TXT/EML extraction
    test_graph.py               Pipeline test fixtures
  frontend/
    src/
      components/
        CopilotPanel.jsx      Chat + file upload UI
        ComplaintForm.jsx      Form, status badge, missing-fields
      features/
        complaintSlice.js       Redux state, computeStatus logic
        complaintSlice.test.js   Committed-protection tests
  docs/
    assignment-brief.md
    interview-prep/            Phase-by-phase decision log
```

## Demo Videos

- **Feature Walkthrough:** https://drive.google.com/file/d/1Vx42q3gpjaRWsSoBwQd5IlDyBZlDpnw-/view?usp=drive_link
- **Code Walkthrough:** https://drive.google.com/file/d/1ISD3dzyBmc2BkW2GYu9u2kziKY3r8Oxt/view?usp=sharing
