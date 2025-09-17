import React from 'react';

export const ICPUnifiedModal = ({ isOpen, onClose }: any) => {
  if (!isOpen) return null;
  
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}>
      <div style={{ background: 'white', padding: '20px', margin: '50px auto', width: '500px' }}>
        <h2>ICP Modal (Simplified)</h2>
        <p>This is a temporary simplified version</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
