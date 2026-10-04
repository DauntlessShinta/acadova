import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { addToast, dismissToast, makeToast } from '../utils/toastState';
import { ToastContext } from './toastAccess';

const icons = { success: CheckCircle2, error: AlertCircle, warning: TriangleAlert, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());
  const dismiss = useCallback((id) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => dismissToast(current, id));
  }, []);
  const showToast = useCallback((type, message) => {
    const toast = makeToast(type, message, ++nextId.current);
    setToasts((current) => addToast(current, toast));
    timers.current.set(toast.id, window.setTimeout(() => dismiss(toast.id), 6000));
    return toast.id;
  }, [dismiss]);
  useEffect(() => {
    const pending = timers.current;
    return () => { for (const timer of pending.values()) window.clearTimeout(timer); pending.clear(); };
  }, []);

  return <ToastContext.Provider value={showToast}>
    {children}
    <div className="toast-viewport" aria-label="Notifications">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return <div className={`app-toast app-toast-${toast.type}`} key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'}>
          <Icon size={19} aria-hidden="true" />
          <p>{toast.message}</p>
          <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><X size={16} /></button>
        </div>;
      })}
    </div>
  </ToastContext.Provider>;
}
