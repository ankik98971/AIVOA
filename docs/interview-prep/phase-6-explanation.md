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

## The `originating_site_block` deterministic guard — verified, and a bug found and fixed
The README's claim about a keyword-scan guard in `graph.py` is real. It lives
in `new_complaint_node`, right after the LLM extraction call:

```python
VALID_SITE_BLOCKS = ["Manufacturing", "Packaging", "Warehouse", "QC Lab"]
site_value = extracted_data.get("originating_site_block", "Not Provided")
if site_value not in VALID_SITE_BLOCKS or site_value.lower() not in latest_msg.lower():
    extracted_data["originating_site_block"] = "Not Provided"
```

**Why it exists:** `openai/gpt-oss-20b` isn't fully deterministic at
temperature=0 on Groq's infrastructure, and the model was found to infer a
plausible-but-unstated site from context clues (e.g. seeing "drum" and
guessing "Packaging"). A prompt instruction alone ("only use a value if
explicitly stated") wasn't reliable enough on its own, so a second,
non-LLM layer was added: after extraction, plain Python checks whether the
site value the model chose is actually one of the four valid options *and*
literally appears in the source text — if not, it's force-overwritten to
"Not Provided," with no model call involved in that decision.

**A real bug was found and fixed in this guard during review.** The original
version checked whether *any* of the four valid keywords appeared *anywhere*
in the text, not whether the *specific value the model chose* was supported:
```python
# The original, buggy version:
site_mentioned = any(kw.lower() in latest_msg.lower() for kw in VALID_SITE_BLOCKS)
if not site_mentioned:
    extracted_data["originating_site_block"] = "Not Provided"
```
This meant a complaint could mention "packaging" in a completely unrelated
sense — e.g. describing *damaged packaging material*, not the *originating
site* — and the guard would see that keyword present, conclude "a site was
mentioned," and let through a hallucinated, unrelated value like
"Manufacturing" for the site field, even though "Manufacturing" itself never
appeared anywhere in the text. This is exactly the failure mode the guard was
built to prevent, just approached from a different angle than the original
"packaging bug" that motivated building the guard in the first place.

The fix changes the check from "does any valid keyword exist somewhere" to
"does the specific extracted value exist, verbatim, in the source text."
A new regression test (`test_graph.py`, Example 4) exercises this exact case
— a complaint describing "crushed primary packaging" as damaged material and
a vague reference to a "formulation facility" (a strong distractor phrase
likely to tempt an LLM into guessing "Manufacturing") — and confirms the
guard now correctly forces "Not Provided" instead of letting a hallucinated
value through.
