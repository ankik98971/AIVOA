# Phase 5: Completeness Checker (Bonus Feature)

## Why this feature, over the alternatives
Four bonus features were on the table: Duplicate Complaint Detection, CAPA
Recommendation, Complaint Summary, and Completeness Checker. Completeness
Checker was chosen because:
- It directly reinforces the app's core promise — that "Ready to Commit"
  actually means something, not just a label the AI feels like showing.
- It doesn't need any new AI calls or extra Groq usage — it's pure backend/
  frontend logic, so it's cheap to build correctly and cheap to verify (no
  LLM non-determinism to fight with, unlike the other three options).
- It closes a real gap: without it, a QA officer could commit a complaint
  missing critical fields like `batch_lot_number` or `ai_severity`, which
  defeats the point of a QMS ledger.

Duplicate Detection and CAPA Recommendation were both judged as more
interesting on paper but riskier to build well in the time available (Duplicate
Detection needs embeddings + a similarity threshold that's easy to tune badly;
CAPA Recommendation risks sounding authoritative about a corrective action
without a real evidence base). Complaint Summary was judged too similar to
what `complaint_description` already does.

## File by file

### `backend/main.py` — `REQUIRED_FIELDS` and `GET /api/required-fields`
```python
REQUIRED_FIELDS = [
    "complaint_source", "customer_name", "product_name", "batch_lot_number",
    "complaint_category", "complaint_description", "ai_severity",
]
```
**Why this structure:** this list is the single source of truth for what
"complete" means, and it lives on the backend, not duplicated in the frontend.
The frontend fetches it once via `GET /api/required-fields` on load rather than
hardcoding its own copy — if the required set ever changes, it changes in one
place.

**Non-obvious detail worth noting:** not every form field is in this list.
Fields like `expiry_date`, `originating_site_block`, and
`ai_suggested_next_action` are deliberately excluded, because they can be
*legitimately* "Not Provided" (a source document might genuinely never state an
expiry date) — requiring them would make it impossible to ever commit some
real complaints. The required set is the minimum viable record, not "every
field the form has."

`main.py` also enforces this server-side, not just in the UI:
```python
missing = [f for f in REQUIRED_FIELDS if not payload.get(f) or payload[f] == "Not Provided"]
if missing:
    raise HTTPException(status_code=422, ...)
```
This matters because the frontend badge is a UX hint, not a security boundary
— someone could hit `POST /api/complaints` directly (e.g. via curl or a bug in
the UI) and bypass any client-side check. The backend re-validates independently
so an incomplete record can never actually land in the database, regardless of
what the frontend thinks.

### `frontend/src/features/complaintSlice.js` — `computeStatus`
This is the core logic of the whole feature, and it's a plain function, not a
class or a separate service — deliberately kept simple enough to read top to
bottom in a few seconds.

**The three rules, in order, and why each exists:**
1. **`Committed` is terminal.** Checked first, before anything else. Once a
   complaint has been successfully saved to the database, no later edit to the
   form should ever change its badge back to "Pending Triage" or "Ready to
   Commit" — those statuses don't make sense for a record that already exists
   in the ledger. This is the property the Phase 5 tests specifically verify.
2. **An empty `requiredFields` list defaults to `Pending Triage`, not
   "Ready to Commit."** This is a subtle but important safety choice. The
   required-fields list is fetched asynchronously from the backend on page
   load — for a brief moment (or if the fetch fails), `requiredFields` is `[]`.
   If the code had written `requiredFields.every(...)` naively, an empty array
   would trivially satisfy `.every()` (vacuous truth) and show "Ready to
   Commit" on an entirely blank form. Explicitly checking for an empty list
   first closes that gap.
3. Otherwise, every required field must be present, non-empty, and not the
   literal string `"Not Provided"` for the status to become "Ready to Commit."

`computeStatus` is called from every reducer that can change form
content — `setComplaintData`, `patchComplaintData`, and `updateField` — so the
badge recalculates in real time whether the change came from the AI or from a
manual keystroke, without any of those reducers needing to duplicate the logic
themselves.

### `frontend/src/features/complaintSlice.test.js` — Vitest tests
Before this phase, there was no test runner in the project at all — this is
the first real automated test coverage. Two tests, both targeting the specific
edge cases the design was built to protect against, not just happy-path checks:

1. **Committed protection test:** builds a fully valid form, confirms it
   reaches "Ready to Commit," manually sets status to "Committed" (the way
   `setStatus` is called after a real DB save), then edits a required field to
   be empty — and asserts the status is still "Committed," not downgraded.
   This is the one test that would fail immediately if rule #1 in
   `computeStatus` were ever accidentally removed or reordered.
2. **Vacuous-truth test:** confirms that with no `requiredFields` loaded yet,
   even a mostly-empty form correctly shows "Pending Triage," not "Ready to
   Commit." This is the test that would have caught the `.every()` bug
   described above, if it existed.

**Worth saying explicitly in an interview:** these two tests aren't
comprehensive coverage of the whole slice — they're targeted regression tests
for the two specific failure modes that were reasoned about during design, which
is arguably more valuable than broad shallow coverage for a project this size.
