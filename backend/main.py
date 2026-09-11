from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
import schemas
from database import engine, get_db
from document_parser import extract_text

# Create DB tables. We keep it simple without Alembic migrations for Phase 1.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="QMS Ledger API")

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "API is running"}

MAX_FILE_SIZE = 10 * 1024 * 1024 # 10MB

@app.post("/api/extract")
async def extract_document(
    file: UploadFile = File(None),
    text: str = Form(None)
):
    """
    Phase 2: Extracts text from uploaded files (PDF, DOCX, TXT, EML) 
    or passes through raw pasted text.
    Returns the raw string (no LLM yet).
    """
    if file:
        try:
            contents = await file.read()
            if len(contents) > MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail="File size exceeds the 10MB limit.")
                
            extracted_text = extract_text(contents, file.filename)
            return {"extracted_text": extracted_text}
        except HTTPException:
            raise # Re-raise our intentional HTTPExceptions
        except ValueError as e:
            # Unsupported file types (thrown by our parser)
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            # Corrupted files or parsing library crashes
            raise HTTPException(status_code=400, detail=f"File could not be read. It may be corrupted. ({str(e)})")
    elif text:
        return {"extracted_text": text}
    else:
        raise HTTPException(status_code=400, detail="Must provide either 'file' or 'text'")


# Fields that, if changed by a correction, might make complaint_description stale.
# These are fields that the AI commonly weaves into the generated narrative text —
# verified against actual LLM output from test_graph.py.
DESCRIPTION_REFERENCE_FIELDS = {
    "batch_lot_number",       # e.g. "Batch AMX240602" appears in description
    "product_name",           # e.g. "Amoxicillin Capsules" named in narrative
    "product_strength_grade", # e.g. "500 mg" embedded in product reference
    "affected_quantity",      # e.g. "48 capsules" mentioned in description
    "customer_name",          # e.g. "Apollo Pharmacy reported..."
    "complaint_source",       # e.g. "reported via email" — confirmed in test output
    "manufacturing_date",     # dates sometimes referenced in risk assessment narrative
    "expiry_date"
}

# Single source of truth for required fields.
# The frontend fetches this list via GET /api/required-fields so there is
# no separate hardcoded copy in the React code.
REQUIRED_FIELDS = [
    "complaint_source",
    "customer_name",
    "product_name",
    "batch_lot_number",
    "complaint_category",
    "complaint_description",
    "ai_severity",
]

class ChatRequest(BaseModel):
    message: str
    current_form: dict

@app.get("/api/required-fields")
def get_required_fields():
    """
    Phase 5: Returns the list of fields that must be filled before a complaint
    can be committed. Frontend uses this to drive the status badge and show
    missing-field warnings without duplicating the list.
    """
    return {"required_fields": REQUIRED_FIELDS}

@app.post("/api/chat")
async def chat_with_copilot(req: ChatRequest):
    """
    Phase 4: Main AI Copilot endpoint.
    Accepts the user's message + current form state, runs it through LangGraph,
    and returns the updated form and a description_stale flag if relevant fields changed.
    """
    from graph import copilot_graph
    from langchain_core.messages import HumanMessage

    state = {
        "messages": [HumanMessage(content=req.message)],
        "current_form": req.current_form,
        "intent": ""
    }

    try:
        result = copilot_graph.invoke(state)
        intent = result.get("intent", "UNKNOWN")
        new_form = result.get("current_form", {})
        ai_reply = result["messages"][-1].content

        # Check if the correction touched any field complaint_description references
        description_stale = False
        if intent == "CORRECTION":
            for field in DESCRIPTION_REFERENCE_FIELDS:
                old_val = req.current_form.get(field)
                new_val = new_form.get(field)
                if old_val != new_val:
                    description_stale = True
                    break

        return {
            "intent": intent,
            "current_form": new_form,
            "reply": ai_reply,
            "description_stale": description_stale
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/complaints", response_model=schemas.ComplaintOut)
def create_complaint(complaint: schemas.ComplaintCreate, db: Session = Depends(get_db)):
    """Saves a manually-filled form to the DB."""
    # Guard: reject incomplete complaints. This is the authoritative enforcement point —
    # the frontend badge is advisory only; this check can't be bypassed.
    payload = complaint.model_dump()
    missing = [
        f for f in REQUIRED_FIELDS
        if not payload.get(f) or payload[f] == "Not Provided"
    ]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot commit: required fields are missing or 'Not Provided': {missing}"
        )

    db_complaint = models.Complaint(**payload)
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint

@app.get("/api/complaints", response_model=list[schemas.ComplaintOut])
def list_complaints(db: Session = Depends(get_db)):
    """Lists saved complaints."""
    return db.query(models.Complaint).order_by(models.Complaint.id.desc()).all()

