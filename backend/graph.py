import os
import json
import re
from typing import Dict, TypedDict, Any, List
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage

# 1. Define State
class GraphState(TypedDict):
    messages: List[Any]
    current_form: Dict[str, Any]
    intent: str

# 2. Helper Functions
def get_llm():
    return ChatGroq(model="openai/gpt-oss-20b", temperature=0, max_tokens=1500)

def extract_json_from_text(text: str) -> dict:
    """Defensively parses JSON from LLM output, handling markdown fences or preamble."""
    try:
        # First try direct parse in case it followed rules perfectly
        return json.loads(text)
    except:
        # Fallback to regex if it wrapped it in ```json ... ``` (case insensitive)
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
        if match:
            try:
                return json.loads(match.group(1))
            except:
                pass
        
        # Final fallback: brute force find the first { and last }
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end+1])
            except:
                pass
    return {}

# 3. Nodes
def router_node(state: GraphState):
    """Classifies the user's intent based on their message and current form state."""
    llm = get_llm()
    latest_msg = state["messages"][-1].content
    
    prompt = f"""You are an intent classifier for a Customer Complaint Management System.
User message: "{latest_msg}"

Classify the user's intent into EXACTLY ONE of these three categories:
1. NEW_COMPLAINT: User is providing text or a document describing a brand new complaint.
2. CORRECTION: User is correcting specific fields of the existing complaint (e.g., "change batch to X").
3. GENERAL_QUESTION: User is asking a question about the current complaint or system.

Return ONLY a valid JSON object with a single key "intent". No preamble.
Example: {{"intent": "NEW_COMPLAINT"}}
"""
    response = llm.invoke([HumanMessage(content=prompt)])
    parsed = extract_json_from_text(response.content)
    intent = parsed.get("intent", "GENERAL_QUESTION") # Default if parse fails
    return {"intent": intent}

def new_complaint_node(state: GraphState):
    """Extracts a completely new complaint and replaces the form state."""
    llm = get_llm()
    latest_msg = state["messages"][-1].content
    
    prompt = f"""You are an AI assistant for a pharmaceutical Quality Management System.
Extract the following information from the provided complaint text.
If a field is not present AND cannot be reasonably inferred, set its value exactly to "Not Provided".

Schema keys:
- complaint_source (The channel/origin type, e.g. "Pharmacy", "Hospital", "Email", "Phone". Do NOT put the customer's name here.)
- customer_name (The name of the entity or person reporting it, e.g. "Apollo Pharmacy", "ABC Formulations Ltd.")
- product_name
- product_strength_grade
- batch_lot_number
- affected_quantity
- manufacturing_date
- expiry_date
- originating_site_block (e.g. Manufacturing, Packaging, Warehouse, QC Lab. ONLY use a value if it is explicitly stated in the text. Do not guess.)
- impacted_non_product_materials (The actual physical material affected, e.g. "Primary Packaging (Bottle)", "HDPE Drum", "Label". Do NOT restate the defect or issue itself here.)
- complaint_category (Synthesize a sensible categorization based on the described symptoms, e.g. 'Product Defect - Discoloration', 'Packaging - Crushed'. Do not use 'Not Provided' if you can infer a category.)
- complaint_description (write a synthesized narrative summary)
- ai_severity (Minor, Major, Critical)
- ai_suggested_next_action
- ai_initial_risk_assessment (free text reasoning)

Complaint text:
"{latest_msg}"

Return strictly valid JSON matching the schema keys above. No markdown fences, no preamble.
"""
    response = llm.invoke([HumanMessage(content=prompt)])
    extracted_data = extract_json_from_text(response.content)
    
    # Ensure all keys exist
    schema_keys = ["complaint_source", "customer_name", "product_name", "product_strength_grade", "batch_lot_number", "affected_quantity", "manufacturing_date", "expiry_date", "originating_site_block", "impacted_non_product_materials", "complaint_category", "complaint_description", "ai_severity", "ai_suggested_next_action", "ai_initial_risk_assessment"]
    for k in schema_keys:
        if k not in extracted_data:
            extracted_data[k] = "Not Provided"

    # --- Deterministic guard for originating_site_block ---
    # The LLM sometimes infers a site from context clues (e.g. "drum" implies Packaging).
    # We override its answer unless one of the four valid values appears literally in the
    # source text. This is a simple string scan — no LLM involved, always reproducible.
    VALID_SITE_BLOCKS = ["Manufacturing", "Packaging", "Warehouse", "QC Lab"]
    site_value = extracted_data.get("originating_site_block", "Not Provided")
    if site_value not in VALID_SITE_BLOCKS or site_value.lower() not in latest_msg.lower():
        extracted_data["originating_site_block"] = "Not Provided"

    return {
        "current_form": extracted_data,
        "messages": [AIMessage(content="I have extracted the new complaint details and updated the form. Please review the extracted fields.")]
    }


def correction_node(state: GraphState):
    """Generates a JSON patch for specific fields based on a user correction."""
    llm = get_llm()
    latest_msg = state["messages"][-1].content
    current_form_json = json.dumps(state.get("current_form", {}), indent=2)
    
    prompt = f"""You are an AI assistant helping to correct a pharmaceutical complaint form.
User correction: "{latest_msg}"

Current form state:
{current_form_json}

Identify which fields need to be updated. Return ONLY a JSON object containing the keys and new values for the fields that changed.
CRITICAL RULE: Do NOT update `complaint_description` unless the user explicitly asks to rewrite the summary. Only patch the discrete fields mentioned in the correction.
Do not return the whole form. No preamble.
"""
    response = llm.invoke([HumanMessage(content=prompt)])
    patch_data = extract_json_from_text(response.content)
    
    updated_form = state.get("current_form", {}).copy()
    for k, v in patch_data.items():
        if k in updated_form: # Only update known schema fields
            updated_form[k] = v

    changed_keys = list(patch_data.keys())
    msg = f"I have applied your corrections to: {', '.join(changed_keys)}." if changed_keys else "I couldn't identify which fields to correct."
    
    return {
        "current_form": updated_form,
        "messages": [AIMessage(content=msg)]
    }

def general_question_node(state: GraphState):
    """Answers general questions using the current form as context."""
    llm = get_llm()
    latest_msg = state["messages"][-1].content
    current_form_json = json.dumps(state.get("current_form", {}), indent=2)
    
    prompt = f"""You are a helpful QA assistant.
User asked: "{latest_msg}"

Context (Current Complaint Form):
{current_form_json}

Answer the user's question briefly based on the context.
"""
    response = llm.invoke([HumanMessage(content=prompt)])
    return {
        "messages": [AIMessage(content=response.content)]
    }

# 4. Routing Logic
def route_intent(state: GraphState):
    intent = state.get("intent")
    if intent == "NEW_COMPLAINT":
        return "new_complaint"
    elif intent == "CORRECTION":
        return "correction"
    else:
        return "general_question"

# 5. Build Graph
def build_graph():
    workflow = StateGraph(GraphState)
    
    workflow.add_node("router", router_node)
    workflow.add_node("new_complaint", new_complaint_node)
    workflow.add_node("correction", correction_node)
    workflow.add_node("general_question", general_question_node)
    
    workflow.set_entry_point("router")
    
    workflow.add_conditional_edges(
        "router",
        route_intent,
        {
            "new_complaint": "new_complaint",
            "correction": "correction",
            "general_question": "general_question"
        }
    )
    
    workflow.add_edge("new_complaint", END)
    workflow.add_edge("correction", END)
    workflow.add_edge("general_question", END)
    
    return workflow.compile()

copilot_graph = build_graph()
