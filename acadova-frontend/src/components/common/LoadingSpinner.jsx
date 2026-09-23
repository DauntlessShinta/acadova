import React from 'react';

export const LoadingSpinner = ({ text = 'Loading data...', size = 28 }) => {
  return (
    <div className="loading-container">
      <div className="spinner" style={{ width: size, height: size }} />
      {text && <p style={{ fontSize: '0.9rem', color: 'var(--ink-500)', margin: 0 }}>{text}</p>}
    </div>
  );
};

export default LoadingSpinner;

