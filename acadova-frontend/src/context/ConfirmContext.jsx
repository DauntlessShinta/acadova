import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../components/common/Modal';
import { ConfirmContext } from './confirmAccess';

export function ConfirmProvider({ children }) {
  const [decision, setDecision] = useState(null);
  const [input, setInput] = useState('');
  const pending = useRef(null);
  const confirm = useCallback((message, options = {}) => new Promise((resolve) => {
    if (pending.current) { resolve(false); return; }
    pending.current = resolve;
    setInput('');
    setDecision({ message, title: 'Confirm action', label: 'Confirm', destructive: true, ...options });
  }), []);
  const finish = useCallback((accepted) => {
    pending.current?.(accepted);
    pending.current = null;
    setDecision(null);
  }, []);
  useEffect(() => () => { pending.current?.(false); }, []);
  return <ConfirmContext.Provider value={confirm}>
    {children}
    <Modal isOpen={Boolean(decision)} onClose={() => finish(false)} title={decision?.title}
      footer={<><button type="button" className="btn btn-secondary" onClick={() => finish(false)}>Cancel</button>
        <button type="button" className={`btn ${decision?.destructive ? 'btn-danger' : 'btn-primary'}`}
          disabled={decision?.input && input.trim().length < (decision.minLength || 1)}
          onClick={() => finish(decision?.input ? input.trim() : true)}>{decision?.label}</button></>}>
      <p className="confirmation-copy">{decision?.message}</p>
      {decision?.input && <div className="form-group"><label className="form-label" htmlFor="confirmation-reason">Reason</label>
        <textarea id="confirmation-reason" className="form-textarea" value={input} maxLength={decision.maxLength || 500}
          onChange={(event) => setInput(event.target.value)} aria-describedby="confirmation-reason-help" />
        <p id="confirmation-reason-help" className="form-hint">Enter {decision.minLength || 1}–{decision.maxLength || 500} characters. This reason is recorded with the action.</p>
      </div>}
    </Modal>
  </ConfirmContext.Provider>;
}
