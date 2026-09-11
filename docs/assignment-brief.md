# AIVOA Internship Assignment — Consolidated Brief

## 1. Objective
Build an AI-powered **Customer Complaint Management System** for the pharmaceutical
manufacturing industry (API/FDF products). It has two halves:
1. A form-based UI where QA staff log a customer complaint.
2. An AI copilot (chat panel) that reads a pasted complaint or an uploaded document
   (PDF/DOCX/TXT/EML) and **auto-fills the form**, including a suggested risk assessment.

Not evaluated on pharma domain expertise — evaluated on curiosity, research, clean
implementation, and product thinking.

## 2. Mandatory Tech Stack
- **Frontend:** React + Redux (state management)
- **Backend:** Python + FastAPI
- **AI orchestration:** LangGraph
- **LLM:** Groq API — `gemma2-9b-it` (primary), optionally `llama-3.3-70b-versatile`
- **Database:** MySQL or PostgreSQL
- **Font:** Google Inter
- Coding may be done with AI tools (Claude/ChatGPT/Gemini/Copilot etc.) but you must
  understand and adapt the code, not blind-paste it — you'll be asked to explain/extend
  it in the interview.
- Production-grade OCR/document parsing is explicitly **not required** — simple text
  extraction is fine.

## 3. UI Layout (confirmed from demo video, more precise than the PDF screenshot)

Two-panel layout.

### Left panel — "Log Customer Complaint" form
Status badge top-right cycles: **Pending Triage → Ready to Commit** (and presumably
some "Committed" state after the final button, not shown in the demo).

**1. Origin & Customer Details**
- Complaint Source (e.g. "Pharmacy", "Email")
- Customer Name

**2. Product & Batch Identification**
- Product Name
- Product Strength/Grade
- Batch / Lot Number
- Affected Quantity
- Manufacturing Date
- Expiry Date

**3. Facility & Material Impact**
- Originating Site Block (dropdown, e.g. "Manufacturing")
- Impacted Non-Product Materials / NPM (e.g. "Primary Packaging (Bottle)")

**4. Defect Analysis**
- Complaint Category (e.g. "Product Defect - Discoloration")
- Complaint Description (synthesized narrative)
- **AI Copilot Risk Assessment** sub-box:
  - Severity (Suggested) — e.g. Major/Minor/Critical
  - Suggested Next Action — e.g. "Route to QA Investigation & Issue Replacement"
  - Initial Risk Assessment — free text reasoning
- **"Commit to QMS Ledger"** button (final save action)

Any field not present in the source text/document should show **"Not Provided"**,
not be left blank or hallucinated.

### Right panel — "AIVOA Copilot" (chat)
- Drag-and-drop or "click to browse" file upload (PDF/DOCX/TXT/EML, max 10MB)
- Text input to paste raw complaint text/email or chat with the assistant
- "Powered by LangGraph" badge
- Shows a progress step while processing (e.g. "Extracting tabular data via OCR…")

## 4. AI Behaviors Required (this is the core engineering challenge)

The LangGraph graph needs to support **at least two distinct intents** on every
incoming chat message, using the *current form state* as context:

1. **New complaint extraction** — user pastes text or uploads a doc describing a new
   complaint. Graph should: parse input → extract structured fields → classify
   complaint category → generate severity/next action/risk assessment → return full
   JSON → fully replace/populate the form. Assistant replies with a short natural
   confirmation summarizing what it found.

2. **Correction / patch update** — user sends a follow-up message correcting one or
   two fields (e.g. "ah sorry the batch number is X and affected quantity is Y").
   Graph should: detect this is a correction (not a new complaint) → identify which
   field(s) are referenced → update only those fields in form state → leave everything
   else untouched → assistant confirms exactly what changed.

This means: **the graph needs the current form/complaint state passed in on every
turn**, and needs an initial routing/classification step to decide "new complaint"
vs. "correction to existing complaint" vs. general chat question.

## 5. Two Demo Examples Shown in the Video (useful as test cases)

**Example A — pasted text:**
> "Apollo Pharmacy reported discolored capsules in Amoxicillin Capsules 500 mg.
> Batch number AMX240602. Manufacturing date March 2026. Expiry date February 2028.
> Please log this complaint"

Extracted: Complaint Source=Pharmacy, Customer Name=Apollo Pharmacy, Product=
Amoxicillin Capsules, Strength=500mg, Batch=AMX240602, Mfg=March 2026, Expiry=
Feb 2028, Site Block=Manufacturing, NPM=Primary Packaging (Bottle), Category=
Product Defect - Discoloration, Description="Apollo Pharmacy reported 12 discolored
capsules in a sealed bottle. Requesting investigation and replacement.", Severity=
Major, Next Action="Route to QA Investigation & Issue Replacement", Risk Assessment=
"Potential moisture ingress or primary packaging seal failure leading to capsule
discoloration...".

Then correction: "ah sorry the batch number is BMX240602 and affected quantity is
48 capsules" → only Batch/Lot Number and Affected Quantity fields update.

**Example B — PDF upload:**
A fictional pharma complaint PDF referencing complaint ID "CC-2026-00154", customer
"ABC Formulations Ltd.", product "Metformin Hydrochloride API", issue = foreign
matter contamination in a drum. Extracted fields included Source=Email, Product
Strength/Grade=IP/BP, Batch=MFH260712A, Affected Quantity=25 kg (1 HDPE Drum), Mfg=
25 June 2026, Expiry=Not Provided (missing in source → shows "Not Provided", not
blank). Then a correction round updates Batch → "CHG 260712A" and Affected Quantity
→ "50 kg (2 HDPE Drum)".

Use these two scenarios (or close variants) as your own test fixtures — you're
explicitly allowed to create your own realistic pharma complaint PDFs/emails for
demonstration.

## 6. Bonus Features (optional, pick 1–2 realistic ones)
- Complaint Completeness Checker (flag missing required fields)
- Root Cause Recommendation
- Duplicate Complaint Detection (e.g. embedding similarity vs. existing DB records)
- CAPA Recommendation
- Complaint Summary
- AI Risk Classification (may already be covered by the built-in risk assessment box)

## 7. Deliverables
Submit via the provided Google Form, including:
- GitHub repository (full source)
- 5–10 minute demo video(s) — **two separate video submissions**:
  1. Working demo of all implemented AI tools and frontend features
  2. A code walkthrough: full end-to-end flow — frontend input (prompt or file
     upload) → API endpoints → backend processing → AI/LangGraph workflow → how the
     response populates the form and AI Copilot Risk Assessment section.

## 8. Suggested Build Order
1. **Skeleton:** FastAPI + Postgres/MySQL models matching the field schema above;
   React/Redux static two-panel UI; "Commit to QMS Ledger" saves to DB.
2. **Document ingestion:** upload endpoint handling PDF/DOCX/TXT/EML + pasted text
   (simple parsing — pypdf / python-docx / email module is enough).
3. **LangGraph + Groq extraction pipeline:** graph node(s) that call Groq
   (`gemma2-9b-it`) with a prompt instructing it to return strict JSON matching the
   form schema; include a routing node to distinguish "new complaint" vs "correction".
4. **Chat/copilot Q&A:** endpoint for free-form questions about the current complaint.
5. **Bonus AI features:** 1–2 from the list above.
6. **Test data + both demo videos.**

## 9. Notes for whoever implements this
- Field names/labels above come directly from the actual demo video UI (more
  authoritative than the static screenshot in the assignment PDF) — match these.
- Keep the LLM prompt strict: "return only JSON, no preamble," with an explicit
  schema, and instruct it to use "Not Provided" for missing fields rather than
  guessing.
- The state-passing/correction-patch behavior is the single most distinctive
  requirement — most "generic" complaint-extraction builds will miss this, so it's
  worth emphasizing in the interview walkthrough.
