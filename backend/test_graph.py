import os
from langchain_core.messages import HumanMessage
from graph import copilot_graph
from dotenv import load_dotenv
import json

load_dotenv() # Ensures GROQ_API_KEY is loaded

def print_result(state):
    print("\n" + "="*50)
    print(f"Messages: {state['messages'][-1].content}")
    print("\nUpdated Form State:")
    print(json.dumps(state.get('current_form', {}), indent=2))
    print("="*50 + "\n")

if __name__ == "__main__":
    if not os.environ.get("GROQ_API_KEY") or os.environ.get("GROQ_API_KEY") == "your-key-here":
        print("ERROR: GROQ_API_KEY is not set correctly in .env")
        exit(1)
        
    print("Testing Example 1: Pasted Text (New Complaint)")
    initial_msg = "Apollo Pharmacy reported discolored capsules in Amoxicillin Capsules 500 mg. Batch number AMX240602. Manufacturing date March 2026. Expiry date February 2028. Please log this complaint"
    
    state_1 = {
        "messages": [HumanMessage(content=initial_msg)],
        "current_form": {}
    }
    
    result_1 = copilot_graph.invoke(state_1)
    print_result(result_1)
    
    print("Testing Example 1: Correction")
    correction_msg = "ah sorry the batch number is BMX240602 and affected quantity is 48 capsules"
    
    state_2 = {
        "messages": [HumanMessage(content=correction_msg)],
        "current_form": result_1["current_form"]
    }
    
    result_2 = copilot_graph.invoke(state_2)
    print_result(result_2)

    print("Testing Example 2: Mock PDF Upload (New Complaint)")
    # Updating this string to match the exact details of "Example B" from the assignment
    pdf_text = "Complaint ID: CC-2026-00154\nSource: Email\nCustomer: ABC Formulations Ltd.\nProduct: Metformin Hydrochloride API\nGrade: IP/BP\nIssue: Foreign matter contamination found in a drum.\nBatch: MFH260712A\nQuantity: 25 kg (1 HDPE Drum)\nMfg Date: 25 June 2026"
    
    state_3 = {
        "messages": [HumanMessage(content=pdf_text)],
        "current_form": {}
    }
    
    result_3 = copilot_graph.invoke(state_3)
    print_result(result_3)

    print("Testing General Question")
    question_msg = "Based on this complaint, what batch number is affected?"
    
    state_4 = {
        "messages": [HumanMessage(content=question_msg)],
        "current_form": result_3["current_form"]
    }
    
    print("\n[DEBUG] State BEFORE General Question:")
    print(json.dumps(state_4["current_form"], indent=2))
    
    result_4 = copilot_graph.invoke(state_4)
    
    print("\n" + "="*50)
    print(f"Messages: {state_4['messages'][-1].content}")
    print("\nAI Answer:")
    print(result_4['messages'][-1].content)
    print("\n[DEBUG] State AFTER General Question:")
    print(json.dumps(result_4.get("current_form", {}), indent=2))
    print("="*50 + "\n")
    print("""
    =====================================================
    Testing Example 3: Site-Block Guard (deterministic)
    Complaint text mentions a drum and contamination but
    does NOT contain the words Manufacturing / Packaging /
    Warehouse / QC Lab.
    EXPECTED: originating_site_block == "Not Provided"
    =====================================================
    """)
    # Deliberately uses packaging-adjacent words ("drum", "HDPE liner", "container")
    # without any of the four valid site-block keywords, to exercise the guard.
    guard_test_msg = (
        "Delta Chemicals reported suspect black particles inside the inner HDPE liner "
        "of a 50 kg drum of Ibuprofen API, batch IBU-0926-DX. "
        "Mfg date July 2026. Customer contacted us by phone."
    )

    state_5 = {
        "messages": [HumanMessage(content=guard_test_msg)],
        "current_form": {}
    }

    result_5 = copilot_graph.invoke(state_5)
    print_result(result_5)

    # Explicit assertion — this is the one check that must pass
    site_val = result_5["current_form"].get("originating_site_block", "")
    if site_val == "Not Provided":
        print("✅ PASS: originating_site_block correctly forced to 'Not Provided' by guard.")
    else:
        print(f"❌ FAIL: originating_site_block = '{site_val}' — guard did not fire.")
        print("   Check that graph.py was saved and __pycache__ is not stale.")

print("""
=====================================================
Testing Example 4: Site-Block Guard (keyword-elsewhere regression test)
Complaint text mentions "packaging" only as a damaged
MATERIAL, not a site, and hints at a different facility
without using any of the four exact valid keywords.
EXPECTED: originating_site_block == "Not Provided"
This specifically regression-tests the bug where the old
guard checked for ANY valid keyword anywhere in the text,
rather than checking the SPECIFIC value the LLM extracted.
=====================================================
""")
guard_test_msg_2 = (
    "Orion Labs received a complaint about crushed primary packaging on a "
    "shipment of Paracetamol Tablets, batch OR-2201. The batch was produced "
    "at our main formulation facility. Customer contacted via phone."
)

state_6 = {
    "messages": [HumanMessage(content=guard_test_msg_2)],
    "current_form": {}
}

result_6 = copilot_graph.invoke(state_6)
print_result(result_6)

site_val_2 = result_6["current_form"].get("originating_site_block", "")
if site_val_2 == "Not Provided":
    print("✅ PASS: guard correctly ignored the unrelated 'packaging' keyword and forced 'Not Provided'.")
else:
    print(f"❌ FAIL: originating_site_block = '{site_val_2}' — guard let an unsupported value through.")
    print("   This means the guard is still checking for ANY keyword's presence, not the SPECIFIC extracted value.")
