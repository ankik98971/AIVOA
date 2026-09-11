import { createSlice } from '@reduxjs/toolkit';

// --- Pure function: compute the status badge from current form data ---
// Called from every reducer that can change form content.
// Rules:
//   1. 'Committed' is terminal — never downgrade it.
//   2. If requiredFields hasn't loaded yet (empty list), default to 'Pending Triage'.
//      An empty list must NOT silently mean "all good" — that inverts the safety property.
//   3. Otherwise: 'Ready to Commit' only if every required field is non-empty and not "Not Provided".
function computeStatus(formData, requiredFields, currentStatus) {
  if (currentStatus === 'Committed') return 'Committed';
  if (!requiredFields || requiredFields.length === 0) return 'Pending Triage';

  const allFilled = requiredFields.every((field) => {
    const val = formData[field];
    return val && val.trim() !== '' && val !== 'Not Provided';
  });

  return allFilled ? 'Ready to Commit' : 'Pending Triage';
}

const initialState = {
  // 1. Origin & Customer Details
  complaint_source: '',
  customer_name: '',
  // 2. Product & Batch Identification
  product_name: '',
  product_strength_grade: '',
  batch_lot_number: '',
  affected_quantity: '',
  manufacturing_date: '',
  expiry_date: '',
  // 3. Facility & Material Impact
  originating_site_block: '',
  impacted_non_product_materials: '',
  // 4. Defect Analysis
  complaint_category: '',
  complaint_description: '',
  ai_severity: '',
  ai_suggested_next_action: '',
  ai_initial_risk_assessment: '',

  // UI state (not sent to backend)
  status: 'Pending Triage',
  descriptionStale: false,
  // Fetched from backend on mount — empty until loaded
  requiredFields: [],
};

const complaintSlice = createSlice({
  name: 'complaint',
  initialState,
  reducers: {
    // Stores the required fields list fetched from GET /api/required-fields.
    // Also recomputes status in case the form was partially filled before this arrived.
    setRequiredFields: (state, action) => {
      state.requiredFields = action.payload;
      state.status = computeStatus(state, action.payload, state.status);
    },

    // Completely replaces the form state (for new complaints from AI).
    setComplaintData: (state, action) => {
      const newForm = { ...state, ...action.payload, descriptionStale: false };
      newForm.status = computeStatus(newForm, state.requiredFields, state.status);
      return newForm;
    },

    // Patches specific fields (for AI corrections).
    patchComplaintData: (state, action) => {
      const { descriptionStale, ...fields } = action.payload;
      const newForm = { ...state, ...fields, descriptionStale: !!descriptionStale };
      newForm.status = computeStatus(newForm, state.requiredFields, state.status);
      return newForm;
    },

    // Updates a single field from manual UI edits.
    updateField: (state, action) => {
      const { field, value } = action.payload;
      state[field] = value;
      // Editing the description dismisses the stale warning
      if (field === 'complaint_description') {
        state.descriptionStale = false;
      }
      // Recompute badge after every keystroke so it reacts in real-time
      state.status = computeStatus(state, state.requiredFields, state.status);
    },

    setStatus: (state, action) => {
      // Only used externally to set 'Committed' after a successful DB save
      state.status = action.payload;
    },

    resetForm: () => initialState,
  },
});

export const {
  setRequiredFields,
  setComplaintData,
  patchComplaintData,
  updateField,
  setStatus,
  resetForm,
} = complaintSlice.actions;

export default complaintSlice.reducer;
