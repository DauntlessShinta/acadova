import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PrivacyContent, TermsContent } from '../../pages/PolicyPages';
import { canCompletePolicyReview, hasReachedPolicyEnd } from '../../utils/policyReview';

export default function PolicyReviewDialog({ accepted = false, onClose, onAgree }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const scrollRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        const focusable = [...dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const frame = window.requestAnimationFrame(() => {
      if (scrollRef.current) setReachedEnd(hasReachedPolicyEnd(scrollRef.current));
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(<div className="modal-backdrop policy-review-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div ref={dialogRef} className="modal-dialog policy-review-dialog" role="dialog" aria-modal="true"
      aria-labelledby="policy-review-title" aria-describedby="policy-review-instruction">
      <div className="modal-header"><h2 id="policy-review-title">Review Terms &amp; Privacy</h2>
        <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="Close policy review"><X size={20} /></button>
      </div>
      <p id="policy-review-instruction" className="policy-review-instruction">
        {accepted ? 'You have already agreed for this account form. You may reread the policies below.'
          : 'Scroll through both policies to the end before choosing whether to agree.'}
      </p>
      <div ref={scrollRef} className="policy-review-scroll" role="region" aria-label="Terms of Use and Privacy Policy"
        tabIndex={0} onScroll={(event) => {
          if (hasReachedPolicyEnd(event.currentTarget)) setReachedEnd(true);
        }}>
        <div className="policy-review-content"><h3>Terms of Use</h3><TermsContent sectionHeading="h4" />
          <h3>Privacy Policy</h3><PrivacyContent sectionHeading="h4" /></div>
      </div>
      <div className="modal-footer policy-review-actions">
        {accepted ? <p role="status">Agreement completed for this form.</p> : <label className={!reachedEnd ? 'policy-review-disabled' : ''}>
          <input type="checkbox" checked={checked} disabled={!reachedEnd}
            onChange={(event) => setChecked(event.target.checked)} />
          <span>I have read and agree to the Terms of Use and acknowledge the Privacy Policy.</span>
        </label>}
        <div className="policy-review-buttons"><button type="button" className="btn btn-secondary" onClick={onClose}>
          {accepted ? 'Done' : 'Close'}
        </button>{!accepted && <button type="button" className="btn btn-primary"
          disabled={!canCompletePolicyReview(reachedEnd, checked)}
          onClick={() => { if (canCompletePolicyReview(reachedEnd, checked)) onAgree(); }}>Agree &amp; Continue</button>}</div>
      </div>
    </div>
  </div>, document.body);
}
