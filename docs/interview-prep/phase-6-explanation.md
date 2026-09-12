# Phase 6: Polish Pass

## What this phase covers
No new features — this phase closes out rough edges that were acceptable
placeholders earlier (raw error text, a browser `alert()`, no font) but
weren't acceptable to ship or demo.

## File by file

### `frontend/src/index.css` — Google Inter font
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', sans-serif;
  ...
}
```
**Why this structure:** a single `@import` plus one `font-family` declaration
on `body` — every component inherits it by default through normal CSS
inheritance, so there was no need to set `font-family` again in
`ComplaintForm.jsx` or `CopilotPanel.jsx` individually. Four weights
(400/500/600/700) are pulled in, which covers regular body text through
semibold labels and bold headers without loading the entire variable font
family.

### `frontend/src/components/CopilotPanel.jsx` — error styling
Two related but separate fixes went into this file:

**1. Removed the native `alert()` for the file-size limit.** Previously, if
someone dropped an oversized file, the browser would show a native OS-level
alert box — jarring, blocks the whole page, and looks unfinished in a demo
video. Now the same check happens (`file.size > 10 * 1024 * 1024`), but the
result is pushed into the same chat message list as a normal AI-style bubble:
```js
setMessages(prev => [...prev, { role: 'ai', text: 'Error: File exceeds the 10MB limit.' }]);
```
**Non-obvious detail worth noting:** this means the file-size check now has
*two* layers — the frontend check here (fast, no network round-trip, better
UX) and the original Phase 2 backend check in `/api/extract` (the real
enforcement boundary, since the frontend check is trivially bypassable by
anyone hitting the API directly). Same defense-in-depth pattern as the
`REQUIRED_FIELDS` re-validation in Phase 5 — never trust the client-side check
alone.

**2. Consistent red error-bubble styling.** Every error message in the chat —
whether from a failed `/api/chat` call, a failed `/api/extract` call, or the
file-size check above — now renders through one shared branch of logic:
```js
const isError = msg.role === 'ai' && msg.text.startsWith('Error:');
```
If `isError` is true, the bubble gets a red-tinted background (`#fef2f2`),
a red border (`#fca5a5`), red text (`#991b1b`), and a `⚠` prefix. Before this
fix, error text was just dumped into a normal AI-colored bubble, so a failed
request looked visually identical to a successful one — someone skimming the
chat could easily miss that something went wrong. Using a string prefix
(`'Error:'`) as the signal is deliberately simple: no new state field, no enum,
just a plain-text convention checked at render time.

### `README.md`
Three parts worth being able to speak to directly:

**Architecture diagram** — a plain text flow, not a rendered image, tracing a
single request end to end: user input → `CopilotPanel.jsx` → `/api/extract`
(files only) → `/api/chat` → the LangGraph pipeline's three-way intent split
→ back into Redux (`complaintSlice.js`) → `/api/complaints` → Postgres. Kept
as text specifically so it stays in sync with the code without needing a
diagramming tool — anyone reading the README top to bottom can trace the same
path through the actual files.

**Key Design Decisions section** — this is effectively a condensed index of
the real engineering decisions made across every phase (the model
substitution from Phase 3, the correction/description trade-off, the
Completeness Checker rationale from Phase 5), written for someone who will
never read the full `docs/interview-prep/` folder. Worth treating this section
as your "one paragraph per decision" cheat sheet if an interviewer asks you to
summarize the project quickly.

**Setup instructions** — written to be followed exactly as commands, in order,
including the reminder that the Python venv lives at the project root (not
inside `backend/`), which was a real point of confusion earlier in the build
and is worth keeping explicit for anyone (including future-you) running this
from scratch.

## One thing to verify, not just document
The README's Key Design Decisions section states that `originating_site_block`
is protected by a deterministic Python keyword-scan guard in `graph.py`, on
top of the prompt-level instruction from Phase 3, because `openai/gpt-oss-20b`
wasn't reliably deterministic at temperature=0 for that field on Groq's
infrastructure. This is a reasonable and well-motivated fix if it's actually
implemented — but it wasn't reviewed as part of Phase 3 or 4's approval, and
its existence should be confirmed directly in `graph.py` before relying on it
as a talking point in an interview.
