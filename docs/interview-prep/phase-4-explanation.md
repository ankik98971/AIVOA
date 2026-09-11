# Phase 4: Frontend Integration

This phase wired the static UI from Phase 1 to the real AI backend built in Phase 3. After this phase, a user can paste text or upload a file in the right panel, watch the form auto-fill on the left, make corrections in chat, and hit Commit to save everything to Postgres.

## What we built and why, file by file:

### `backend/main.py` — Added `/api/chat`
This new endpoint is the only entry point the frontend needs for all AI behavior. It receives the user's message plus a full snapshot of the current form, calls LangGraph, and returns: the updated `current_form`, the AI's `reply` message, the classified `intent`, and a `description_stale` boolean. The `description_stale` logic lives in Python on the server — it compares the old vs. new values for fields that `complaint_description` commonly references (batch number, product name, quantity, etc.) and sets the flag if any of them changed during a `CORRECTION`. This keeps the frontend simple: it just reads a boolean.

### `frontend/src/features/complaintSlice.js` — Added `descriptionStale`
We added a `descriptionStale` boolean to the Redux state. The `patchComplaintData` action now accepts and stores this flag. The `updateField` action auto-clears it when the user edits `complaint_description` directly, so the warning dismisses naturally without an extra button. `setComplaintData` always resets it too, since a brand new extraction makes the description fresh again.

### `frontend/src/components/CopilotPanel.jsx` — Fully rewritten
This is the most complex component.
- **Two-stage file flow**: File uploads hit `/api/extract` first (simple text extraction), which allows showing "Extracting document text..." then "Running AI analysis..." as two distinct progress steps. This is the "extraction progress state" the spec requires. The extracted text is then forwarded to `/api/chat` exactly like typed text.
- **`sendMessageDirect`**: A small internal helper that runs the `/api/chat` call without prepending a user bubble. Needed for file uploads because the "📎 Uploaded: filename" bubble already represents the user action.
- **Dispatch branching**: `NEW_COMPLAINT` → `setComplaintData` (full replace). `CORRECTION` → `patchComplaintData` with `descriptionStale`. `GENERAL_QUESTION` → nothing dispatched. This is how we guarantee the form is never accidentally touched by a non-complaint message.

### `frontend/src/components/ComplaintForm.jsx` — Refactored + stale warning
- Extracted a `Field` helper (stays in the same file, not a separate component) to remove repetitive label+input markup.
- Status badge now handles three states: Pending Triage (red), Ready to Commit (green), Committed (blue).
- Commit button is only enabled in `Ready to Commit` state — disabled and grey in all other states.
- The `descriptionStale` amber warning appears directly below `complaint_description` and disappears the moment the user types in that field.

### `frontend/src/index.css`
Replaced Vite's boilerplate with a Google Fonts `@import` for Inter, a global `box-sizing` reset, and clean body defaults.

## Key Design Decisions

1. **Description Stale flag computed server-side**: We could have done this diff in Redux, but keeping it in Python means the frontend never needs to know which fields "count" as references. That list can change without a frontend deploy.
2. **Stale warning is non-blocking**: Per our Phase 3 decision, corrections intentionally do not rewrite the description. The amber note gives QA staff the information they need to decide whether to update it manually, without forcing them to.
