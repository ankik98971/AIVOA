import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { setComplaintData, patchComplaintData } from '../features/complaintSlice';

export default function CopilotPanel() {
  const dispatch = useDispatch();
  const currentForm = useSelector((state) => state.complaint);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]); // { role: 'user'|'ai', text: string }
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll chat window on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ---- Core: send text to /api/chat ----
  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInputText('');
    setIsLoading(true);
    setLoadingStep('Thinking...');

    // Build a clean form snapshot to send as context (exclude UI-only keys)
    const { status, descriptionStale, ...formPayload } = currentForm;

    try {
      const res = await axios.post('http://localhost:8000/api/chat', {
        message: text,
        current_form: formPayload
      });

      const { intent, current_form, reply, description_stale } = res.data;

      // NEW_COMPLAINT replaces the whole form; CORRECTION patches it
      if (intent === 'NEW_COMPLAINT') {
        dispatch(setComplaintData(current_form));
      } else if (intent === 'CORRECTION') {
        dispatch(patchComplaintData({ ...current_form, descriptionStale: description_stale }));
      }
      // GENERAL_QUESTION doesn't touch the form at all

      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Something went wrong.';
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${detail}` }]);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // ---- File upload: extract text first, then send to /api/chat ----
  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error: File exceeds the 10MB limit.' }]);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text: `📎 Uploaded: ${file.name}` }]);
    setIsLoading(true);
    setLoadingStep('Extracting document text...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const extractRes = await axios.post('http://localhost:8000/api/extract', formData);
      const extractedText = extractRes.data.extracted_text;

      setLoadingStep('Running AI analysis...');
      // Now feed the extracted text through the full AI pipeline
      await sendMessageDirect(extractedText);
    } catch (err) {
      const detail = err.response?.data?.detail || 'File could not be processed.';
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${detail}` }]);
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // A version of sendMessage that doesn't add a second user bubble (the file upload already did)
  const sendMessageDirect = async (text) => {
    const { status, descriptionStale, ...formPayload } = currentForm;
    try {
      const res = await axios.post('http://localhost:8000/api/chat', {
        message: text,
        current_form: formPayload
      });
      const { intent, current_form, reply, description_stale } = res.data;
      if (intent === 'NEW_COMPLAINT') {
        dispatch(setComplaintData(current_form));
      } else if (intent === 'CORRECTION') {
        dispatch(patchComplaintData({ ...current_form, descriptionStale: description_stale }));
      }
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Something went wrong.';
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${detail}` }]);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ margin: 0 }}>AIVOA Copilot</h2>
        <span style={{ fontSize: '0.7rem', backgroundColor: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>
          Powered by LangGraph
        </span>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#6366f1' : '#d1d5db'}`,
          borderRadius: '8px',
          padding: '14px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragOver ? '#eef2ff' : '#f9fafb',
          marginBottom: '12px',
          transition: 'all 0.15s ease'
        }}
      >
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
          📂 Drag & drop or <strong>click to browse</strong><br />
          <span style={{ fontSize: '0.72rem' }}>PDF, DOCX, TXT, EML · Max 10 MB</span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.eml"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* Chat Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>
            Paste complaint text below or upload a file to begin.
          </p>
        )}
        {messages.map((msg, i) => {
          const isError = msg.role === 'ai' && msg.text.startsWith('Error:');
          return (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.role === 'user' ? '#6366f1' : isError ? '#fef2f2' : '#ffffff',
              color: msg.role === 'user' ? 'white' : isError ? '#991b1b' : '#1f2937',
              padding: '9px 13px',
              borderRadius: '12px',
              maxWidth: '88%',
              fontSize: '0.85rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              border: msg.role === 'user' ? 'none' : isError ? '1px solid #fca5a5' : '1px solid #e5e7eb',
              whiteSpace: 'pre-wrap'
            }}>
              {isError ? '⚠ ' : ''}{msg.text}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{
            alignSelf: 'flex-start',
            backgroundColor: '#f3f4f6',
            color: '#6b7280',
            padding: '9px 13px',
            borderRadius: '12px',
            fontSize: '0.82rem',
            fontStyle: 'italic',
            border: '1px solid #e5e7eb'
          }}>
            ⏳ {loadingStep}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ marginTop: 'auto' }}>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste complaint text or chat (Enter to send, Shift+Enter for newline)…"
          disabled={isLoading}
          style={{
            width: '100%',
            height: '80px',
            padding: '10px',
            boxSizing: 'border-box',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            resize: 'none',
            fontSize: '0.85rem',
            fontFamily: 'Inter, sans-serif'
          }}
        />
        <button
          onClick={() => sendMessage(inputText)}
          disabled={isLoading || !inputText.trim()}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isLoading ? '#a5b4fc' : '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            marginTop: '6px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}
        >
          {isLoading ? loadingStep : 'Send'}
        </button>
      </div>
    </div>
  );
}
