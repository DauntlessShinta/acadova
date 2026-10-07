import React from 'react';
import { BookOpen } from 'lucide-react';

export const LoadingSpinner = ({ text = 'Loading data...', size = 28 }) => {
  return (
    <div className="loading-container" role="status" aria-live="polite" aria-atomic="true">
      <span className="loading-indicator" aria-hidden="true"><BookOpen size={size} strokeWidth={1.5} /></span>
      <p>{text || 'Loading...'}</p>
    </div>
  );
};

export default LoadingSpinner;

