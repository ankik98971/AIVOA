import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import ComplaintForm from './components/ComplaintForm';
import CopilotPanel from './components/CopilotPanel';
import ComplaintsList from './components/ComplaintsList';
import { setRequiredFields } from './features/complaintSlice';

function App() {
  const [view, setView] = useState('form');
  const dispatch = useDispatch();

  // Fetch required fields from backend once on mount.
  // If this fails, requiredFields stays [] in Redux → badge stays 'Pending Triage'.
  // That's the safe failure mode: incomplete config means "not ready," not "all clear."
  useEffect(() => {
    axios.get('http://localhost:8000/api/required-fields')
      .then(res => dispatch(setRequiredFields(res.data.required_fields)))
      .catch(err => console.error('Could not load required fields config:', err));
  }, []); // Empty deps: runs once, on mount only

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header Navigation */}
      <div style={{ padding: '15px 20px', backgroundColor: '#1f2937', color: 'white', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', marginRight: '20px' }}>AIVOA QMS</h1>
        <button 
          onClick={() => setView('form')} 
          style={{ background: view === 'form' ? '#374151' : 'transparent', color: 'white', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', fontWeight: view === 'form' ? 'bold' : 'normal' }}
        >
          Log New Complaint
        </button>
        <button 
          onClick={() => setView('list')} 
          style={{ background: view === 'list' ? '#374151' : 'transparent', color: 'white', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', fontWeight: view === 'list' ? 'bold' : 'normal' }}
        >
          View Ledger
        </button>
      </div>

      {/* Main Content Area */}
      {view === 'form' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Panel */}
          <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #ccc', overflowY: 'auto' }}>
            <ComplaintForm />
          </div>

          {/* Right Panel */}
          <div style={{ width: '400px', padding: '20px', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
            <CopilotPanel />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb' }}>
          <ComplaintsList />
        </div>
      )}
    </div>
  );
}

export default App;
