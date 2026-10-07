import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export const Alert = ({ type = 'info', message, onClose, children }) => {
  if (!message && !children) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
      case 'error':
        return <AlertCircle size={18} style={{ flexShrink: 0 }} />;
      case 'success':
        return <CheckCircle2 size={18} style={{ flexShrink: 0 }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ flexShrink: 0 }} />;
      case 'info':
      default:
        return <Info size={18} style={{ flexShrink: 0 }} />;
    }
  };

  const alertClass = type === 'error' ? 'alert-danger' : `alert-${type}`;

  return (
    <div
      className={`alert ${alertClass}`}
      role={type === 'danger' || type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'danger' || type === 'error' ? 'assertive' : 'polite'}
    >
      {getIcon()}
      <div className="alert-content">{message || children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss message"
          className="alert-dismiss"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;
