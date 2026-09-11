import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateField, setStatus, resetForm } from '../features/complaintSlice';
import axios from 'axios';

// Shared style for all text inputs
const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  boxSizing: 'border-box',
  borderRadius: '5px',
  border: '1px solid #d1d5db',
  fontFamily: 'Inter, sans-serif',
  fontSize: '0.875rem',
  marginTop: '3px'
};

// A simple labeled input row
function Field({ label, name, value, onChange, type = 'input', isRequired, isMissing }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: isMissing ? '#b45309' : '#374151' }}>
        {label}
        {isRequired && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          style={{ ...inputStyle, height: '70px', resize: 'vertical', borderColor: isMissing ? '#f59e0b' : '#d1d5db' }}
        />
      ) : (
        <input
          name={name}
          value={value}
          onChange={onChange}
          style={{ ...inputStyle, borderColor: isMissing ? '#f59e0b' : '#d1d5db' }}
        />
      )}
    </div>
  );
}

export default function ComplaintForm() {
  const data = useSelector((state) => state.complaint);
  const dispatch = useDispatch();

  // Compute which required fields are still missing (not filled / still "Not Provided")
  const missingFields = data.requiredFields.filter((field) => {
    const val = data[field];
    return !val || val.trim() === '' || val === 'Not Provided';
  });

  const handleChange = (e) => {
    dispatch(updateField({ field: e.target.name, value: e.target.value }));
  };

  const handleCommit = async () => {
    try {
      const { status, descriptionStale, requiredFields, ...payload } = data;
      await axios.post('http://localhost:8000/api/complaints', payload);
      dispatch(setStatus('Committed'));
      alert('Complaint saved to QMS Ledger!');
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to commit complaint.';
      alert(detail);
    }
  };

  // Status badge colors
  const badgeColors = {
    'Pending Triage': { bg: '#fee2e2', color: '#991b1b' },
    'Ready to Commit': { bg: '#dcfce7', color: '#166534' },
    'Committed': { bg: '#dbeafe', color: '#1e40af' },
  };
  const badge = badgeColors[data.status] || badgeColors['Pending Triage'];

  return (
    <div>
      {/* Header + Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ margin: 0 }}>Log Customer Complaint</h2>
        <span style={{
          padding: '5px 12px',
          borderRadius: '15px',
          backgroundColor: badge.bg,
          color: badge.color,
          fontWeight: '700',
          fontSize: '0.8rem'
        }}>
          {data.status}
        </span>
      </div>

      {/* Missing fields warning — only shown when there are missing required fields */}
      {missingFields.length > 0 && data.status !== 'Committed' && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '6px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '0.8rem',
          color: '#92400e'
        }}>
          <strong>⚠ Required fields incomplete:</strong>
          <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
            {missingFields.map((f) => (
              <li key={f}>{f.replace(/_/g, ' ')}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Origin & Customer Details */}
      <section style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
          1. Origin & Customer Details
        </h3>
        <Field label="Complaint Source" name="complaint_source" value={data.complaint_source} onChange={handleChange} />
        <Field label="Customer Name" name="customer_name" value={data.customer_name} onChange={handleChange} />
      </section>

      {/* 2. Product & Batch Identification */}
      <section style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
          2. Product & Batch Identification
        </h3>
        <Field label="Product Name" name="product_name" value={data.product_name} onChange={handleChange} />
        <Field label="Product Strength / Grade" name="product_strength_grade" value={data.product_strength_grade} onChange={handleChange} />
        <Field label="Batch / Lot Number" name="batch_lot_number" value={data.batch_lot_number} onChange={handleChange} />
        <Field label="Affected Quantity" name="affected_quantity" value={data.affected_quantity} onChange={handleChange} />
        <Field label="Manufacturing Date" name="manufacturing_date" value={data.manufacturing_date} onChange={handleChange} />
        <Field label="Expiry Date" name="expiry_date" value={data.expiry_date} onChange={handleChange} />
      </section>

      {/* 3. Facility & Material Impact */}
      <section style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
          3. Facility & Material Impact
        </h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Originating Site Block</label>
          <select
            name="originating_site_block"
            value={data.originating_site_block}
            onChange={handleChange}
            style={inputStyle}
          >
            <option value="">Select...</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Packaging">Packaging</option>
            <option value="Warehouse">Warehouse</option>
            <option value="QC Lab">QC Lab</option>
            <option value="Not Provided">Not Provided</option>
          </select>
        </div>
        <Field label="Impacted Non-Product Materials" name="impacted_non_product_materials" value={data.impacted_non_product_materials} onChange={handleChange} />
      </section>

      {/* 4. Defect Analysis */}
      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
          4. Defect Analysis
        </h3>
        <Field label="Complaint Category" name="complaint_category" value={data.complaint_category} onChange={handleChange} />

        {/* Complaint Description with stale warning */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Complaint Description</label>
          <textarea
            name="complaint_description"
            value={data.complaint_description}
            onChange={handleChange}
            style={{ ...inputStyle, height: '70px', resize: 'vertical' }}
          />
          {data.descriptionStale && (
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '0.76rem',
              color: '#92400e',
              backgroundColor: '#fffbeb',
              border: '1px solid #fcd34d',
              borderRadius: '4px',
              padding: '4px 8px'
            }}>
              ⚠ Description may reference outdated fields — review or update manually.
            </p>
          )}
        </div>

        {/* AI Copilot Risk Assessment Sub-box */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          marginTop: '8px'
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#0369a1' }}>AI Copilot Risk Assessment</h4>
          <Field label="Severity (Suggested)" name="ai_severity" value={data.ai_severity} onChange={handleChange} />
          <Field label="Suggested Next Action" name="ai_suggested_next_action" value={data.ai_suggested_next_action} onChange={handleChange} />
          <Field label="Initial Risk Assessment" name="ai_initial_risk_assessment" value={data.ai_initial_risk_assessment} onChange={handleChange} type="textarea" />
        </div>
      </section>

      <button
        onClick={handleCommit}
        disabled={data.status !== 'Ready to Commit'}
        style={{
          padding: '12px 24px',
          backgroundColor: data.status === 'Ready to Commit' ? '#2563eb' : '#9ca3af',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: data.status === 'Ready to Commit' ? 'pointer' : 'not-allowed',
          fontSize: '1rem',
          fontFamily: 'Inter, sans-serif',
          fontWeight: '600',
          width: '100%'
        }}
      >
        {data.status === 'Committed' ? '✓ Committed to QMS Ledger' : 'Commit to QMS Ledger'}
      </button>
    </div>
  );
}
