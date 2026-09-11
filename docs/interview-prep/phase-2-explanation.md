# Phase 2: Document Ingestion

In this phase, we built the backend capability to accept file uploads (PDF, DOCX, TXT, EML) or pasted raw text, and extract the raw string content. We are intentionally *not* adding the LLM yet — this phase just proves we can get text out of files reliably.

## What we built and why, file by file:

- **`requirements.txt`**: Added `pypdf` (for PDF text extraction), `python-docx` (for Word documents), and `python-multipart` (required by FastAPI to parse `multipart/form-data` uploads).
- **`backend/document_parser.py`**: A new utility file containing a single `extract_text(file_bytes, filename)` function. 
  - *Why it's structured this way:* It keeps the messy logic of handling different file extensions out of our main routing file. It checks the extension and routes to the correct library.
  - *Tricky part:* Handling `.eml` files. We used Python's built-in `email` module, which parses the raw bytes into an `EmailMessage`. We try to grab the plain text body using `msg.get_body(preferencelist=('plain', 'html'))`, but added a fallback loop to walk the email parts if that fails, because raw EML structures can be notoriously unpredictable.
- **`backend/main.py` (Updated)**: We added the `POST /api/extract` route. 
  - *Why it's structured this way:* It takes either a `file` (as `UploadFile`) OR `text` (as `Form`). This allows our frontend to hit the exact same endpoint whether the user dragged-and-dropped a PDF or just pasted a paragraph into the chat box.

We can now upload files and get plain text strings back. In Phase 3, we will pass these strings to LangGraph and Groq.

### Late Addition: File Size and Corruption Constraints
- **`backend/main.py` (Constraint Updates)**: Added a `MAX_FILE_SIZE` check (10MB) that throws a clean `HTTP 413 Payload Too Large`. We also tightened the `try/except` block: instead of returning a generic 500 error when `pypdf` or `python-docx` crashes on a corrupted file, we catch the exception and return a clean `HTTP 400 Bad Request` with a user-friendly message. This ensures our frontend doesn't crash trying to parse a backend stack trace.
