import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function ComplaintsList() {
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    // Fetch the saved complaints from our existing Phase 1 backend endpoint
    axios.get('http://localhost:8000/api/complaints')
      .then(res => setComplaints(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>QMS Ledger - Saved Complaints</h2>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '12px' }}>ID</th>
            <th style={{ padding: '12px' }}>Customer</th>
            <th style={{ padding: '12px' }}>Product</th>
            <th style={{ padding: '12px' }}>Batch / Lot</th>
            <th style={{ padding: '12px' }}>Suggested Action</th>
          </tr>
        </thead>
        <tbody>
          {complaints.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No complaints found in the ledger.</td>
            </tr>
          ) : (
            complaints.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px' }}>{c.id}</td>
                <td style={{ padding: '12px' }}>{c.customer_name}</td>
                <td style={{ padding: '12px' }}>{c.product_name}</td>
                <td style={{ padding: '12px' }}>{c.batch_lot_number}</td>
                <td style={{ padding: '12px' }}>{c.ai_suggested_next_action}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
