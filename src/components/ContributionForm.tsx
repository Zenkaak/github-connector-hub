import React, { useState } from 'react';
// 1. Import the hook we created in the Provider
import { useConnectivity } from '../context/ConnectivityProvider'; 

const ContributionForm = () => {
  // 2. Grab the real-time status
  const { isOnline } = useConnectivity();
  const [amount, setAmount] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) return; // Double safety check
    
    console.log(`Processing M-Pesa payment for KES ${amount}`);
    // Logic for M-Pesa STK push goes here
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>Chama Contribution</h3>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>Amount (KES)</label>
          <input 
            type="number" 
            placeholder="e.g. 1000" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
            required
          />
        </div>
        
        {/* 3. The Smart Button: Changes color and state based on network */}
        <button 
          type="submit"
          disabled={!isOnline} 
          style={{ 
            ...buttonStyle,
            backgroundColor: isOnline ? '#0f172a' : '#94a3b8', 
            cursor: isOnline ? 'pointer' : 'not-allowed'
          }}
        >
          {isOnline ? 'Pay via M-Pesa' : 'Offline: Check Connection'}
        </button>

        {/* 4. The Warning Message: Only shows when offline */}
        {!isOnline && (
          <div style={warningBoxStyle}>
            <p style={{ margin: 0 }}>
              ⚠️ <b>M-Pesa pushes</b> require an active connection. Your input is saved, but we can't trigger the payment prompt until you are back online.
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

// --- Professional Styling ---
const containerStyle: React.CSSProperties = {
  background: '#ffffff',
  padding: '24px',
  borderRadius: '16px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  maxWidth: '400px',
  margin: '20px auto'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '600',
  color: '#475569',
  marginBottom: '4px'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '16px',
  boxSizing: 'border-box'
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: '700',
  transition: 'all 0.3s ease'
};

const warningBoxStyle: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px',
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #ef4444',
  color: '#991b1b',
  fontSize: '13px',
  lineHeight: '1.5'
};

export default ContributionForm;
