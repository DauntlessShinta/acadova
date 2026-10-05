import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children, footer, maxWidth = '540px' }) => {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialogRef.current?.querySelector('button, input, select, textarea, a[href]')?.focus();
    const handleKeyDown = (e) => {
      if ([...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialogRef.current) return;
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
          .filter((control) => !control.disabled && control.getClientRects().length);
        const first = controls[0]; const last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="modal-dialog"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
