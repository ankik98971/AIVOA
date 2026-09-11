# Phase 1: Project Scaffold

This phase sets up the foundational structure of our Customer Complaint Management System, focusing purely on boilerplate, database models, and a static UI, without touching any AI features yet.

## What we built and why, file by file:

- **`.env` and `.env.example`**: We created an environment file to store secrets like `GROQ_API_KEY` and database credentials. It's critical to never hardcode these. We added `.env` to `.gitignore` so it won't be pushed to the repository, but committed `.env.example` as a template for other developers.
- **`docker-compose.yml`**: Spins up a local PostgreSQL container quickly without needing to install Postgres on the host machine. We used standard environment variables to inject the DB username, password, and database name.
- **`backend/database.py`**: Configures the SQLAlchemy database engine and session. We kept it simple using standard synchronous database calls since the requirements favor simplicity over high concurrency.
- **`backend/models.py`**: Maps the 15 exact form fields from the assignment schema to a Postgres `complaints` table using SQLAlchemy. We set the default string for everything to `"Not Provided"` instead of `null` or an empty string, enforcing the requirement from the prompt straight at the database layer.
- **`backend/schemas.py`**: Defines Pydantic models (`ComplaintCreate`, `ComplaintOut`) to validate the data coming in and out of our FastAPI endpoints. This ensures the frontend sends the right payload shape before we even try saving to Postgres.
- **`backend/main.py`**: The FastAPI application entry point. It has two simple endpoints right now: `POST /api/complaints` to save the manually filled form (which satisfies the "working Commit to QMS Ledger" requirement), and `GET /api/complaints` to fetch them back. We added CORS middleware so our Vite frontend can talk to it locally.
- **`frontend/src/store.js` & `features/complaintSlice.js`**: We set up Redux Toolkit to manage the form state. We need Redux because the AI panel (right) and the form panel (left) are separate sibling components that need to read and update the same data. The slice contains the initial empty state (mostly empty strings), and defines actions like `setComplaintData` (for new complaints) and `patchComplaintData` (which we'll use later for the AI's partial corrections).
- **`frontend/src/App.jsx`**: The main layout file implementing the requested static two-panel design using standard Flexbox. Left side gets the form, right side gets the AI Copilot.
- **`frontend/src/components/ComplaintForm.jsx`**: The left panel. It renders all the inputs bound to the Redux state, grouped into the 4 requested sections. The most interesting part is the "Status Badge" logic at the top, which flips from "Pending Triage" to "Ready to Commit" or "Committed" based on Redux state. The "Commit" button posts the Redux state to our FastAPI backend.
- **`frontend/src/components/CopilotPanel.jsx`**: The right panel. It's just static HTML/CSS right now (a disabled text area, a mock file upload box, and a submit button). We'll wire this up to LangGraph in a future phase.

## Security Checklist Confirmed:
- [x] `.env` created with placeholder credentials.
- [x] `.env.example` created and will be tracked by git.
- [x] `.gitignore` updated so `.env` is NOT committed.
- [x] No secrets hardcoded anywhere in Python or JS files.

### Late Addition: Complaints Ledger View
- **`frontend/src/components/ComplaintsList.jsx`**: A simple React component that uses `useEffect` to call `GET /api/complaints` via Axios. It maps over the returned JSON array and renders a clean HTML table displaying the database rows.
- **`frontend/src/App.jsx` (Updated)**: We added a top navigation bar and a simple React state hook (`const [view, setView] = useState('form')`) to conditionally render either the main split-panel form view or the new full-screen ledger view. We intentionally avoided using a heavy routing library like `react-router-dom` to keep the architecture as simple and interview-friendly as possible.
