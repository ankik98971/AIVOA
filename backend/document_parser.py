import io
import email
from email import policy
from pypdf import PdfReader
from docx import Document

def extract_text(file_bytes: bytes, filename: str) -> str:
    """
    Extracts raw text from PDF, DOCX, TXT, or EML files.
    Returns the extracted string. Production-grade OCR is intentionally skipped
    as per the project requirements.
    """
    filename = filename.lower()
    
    if filename.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore")
        
    elif filename.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(file_bytes))
        text_pages = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_pages.append(page_text)
        return "\n".join(text_pages)
        
    elif filename.endswith(".docx"):
        doc = Document(io.BytesIO(file_bytes))
        text_paragraphs = [para.text for para in doc.paragraphs]
        return "\n".join(text_paragraphs)
        
    elif filename.endswith(".eml"):
        # Parse the raw bytes into an EmailMessage object
        msg = email.message_from_bytes(file_bytes, policy=policy.default)
        extracted = []
        extracted.append(f"Subject: {msg.get('subject', 'No Subject')}")
        extracted.append(f"From: {msg.get('from', 'Unknown')}")
        extracted.append(f"To: {msg.get('to', 'Unknown')}\n")
        
        # Try to get the plain text body
        body = msg.get_body(preferencelist=('plain', 'html'))
        if body:
            extracted.append(body.get_content())
        else:
            # Fallback if no specific body part is found
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    extracted.append(part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="ignore"))
        return "\n".join(extracted)
        
    else:
        raise ValueError("Unsupported file format. Please upload PDF, DOCX, TXT, or EML.")
