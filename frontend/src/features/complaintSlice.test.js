import { describe, it, expect } from 'vitest';
import reducer, {
  setRequiredFields,
  setComplaintData,
  setStatus,
  updateField,
} from './complaintSlice';

describe('complaintSlice — Committed protection', () => {
  it('does not downgrade a Committed complaint when a required field is edited', () => {
    let state = reducer(undefined, { type: '@@INIT' });

    state = reducer(state, setRequiredFields([
      'complaint_source',
      'customer_name',
      'product_name',
      'batch_lot_number',
      'complaint_category',
      'complaint_description',
      'ai_severity',
      'ai_initial_risk_assessment',
    ]));

    state = reducer(state, setComplaintData({
      complaint_source: 'Email',
      customer_name: 'Apollo Pharmacy',
      product_name: 'Amoxicillin Capsules',
      batch_lot_number: 'AMX240602',
      complaint_category: 'Product Defect - Discoloration',
      complaint_description: 'Discolored capsules reported.',
      ai_severity: 'Minor',
      ai_initial_risk_assessment: 'Low risk, investigate.',
    }));

    expect(state.status).toBe('Ready to Commit');

    state = reducer(state, setStatus('Committed'));
    expect(state.status).toBe('Committed');

    state = reducer(state, updateField({ field: 'batch_lot_number', value: '' }));

    expect(state.status).toBe('Committed');
  });

  it('treats an empty requiredFields list as not ready, not vacuously ready', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    state = reducer(state, setComplaintData({
      complaint_source: 'Email',
      customer_name: 'Apollo Pharmacy',
    }));
    expect(state.status).toBe('Pending Triage');
  });
});
