# Phase 3: LangGraph + Groq Pipeline

This phase is the core AI logic of the application. We implemented the graph orchestration that interprets user input, extracts JSON data, and handles partial corrections against the existing form state.

## What we built and why, file by file:

- **`requirements.txt`**: Added `langgraph`, `langchain-groq`, and `langchain-core`.
- **`backend/graph.py`**: This is the heart of the AI behavior. It defines a LangGraph `StateGraph`.
  - **The State (`GraphState`)**: Crucially, this state includes `current_form`. Every time the frontend sends a message, it will also send the current JSON state of the form, meaning the graph always knows what's already been filled out.
  - **Defensive JSON Parsing (`extract_json_from_text`)**: The Groq `gemma2-9b-it` model can sometimes ignore "strictly JSON no markdown" prompts. I wrote a small regex fallback that strips markdown fences (````json ... ````) before calling `json.loads()`. *This is a great talking point for the interview about real-world LLM resilience.*
  - **Nodes**:
    - `router_node`: Looks at the user's message and classifies it into `NEW_COMPLAINT`, `CORRECTION`, or `GENERAL_QUESTION`.
    - `new_complaint_node`: Prompts the LLM with the full 15-field schema. It completely replaces `state["current_form"]`. It includes a programmatic loop to ensure any missing keys are forced to `"Not Provided"`, satisfying a strict requirement.
    - `correction_node`: This is the hardest part of the prompt. Instead of regenerating the whole form, it prompts the LLM to output ONLY the keys that changed. It then iterates over this patch and updates only those specific fields in `state["current_form"]`, leaving the rest untouched.
    - `general_question_node`: Simple RAG-style QA using `current_form` as context.
- **`backend/test_graph.py`**: A standalone script to prove the graph works exactly as specified in the assignment's two examples, without needing the frontend. It passes the output of Example 1 directly into the input state of Example 2 (the correction) to prove the patch behavior works.
- **`docs/sample-complaints/`**: I generated two realistic mock complaints (`example2_contamination.txt` and `example3_packaging.txt`) that you can use during your final video demo.

### Late Addition: Model Upgrade & Parser Resilience
- **Model Change**: We replaced `gemma2-9b-it` with `openai/gpt-oss-20b`. Although the original assignment specified Gemma, Groq deprecated it. To ensure the application remains functional, we substituted it with Groq's currently recommended replacement model. 
- **Parser Resilience**: Different models format JSON slightly differently (e.g., lowercase vs uppercase markdown tags, preamble structures). To account for this, we hardened `extract_json_from_text` in `graph.py` by making the markdown regex case-insensitive (`re.IGNORECASE`) and adding a final brute-force fallback that extracts the substring between the first `{` and the last `}`. This guarantees that as long as valid JSON exists somewhere in the output, the app won't crash.
