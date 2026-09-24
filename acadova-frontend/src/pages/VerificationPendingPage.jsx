import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Alert from '../components/common/Alert';
import authService from '../services/authService';
import { maskEmail, normalizeEmail } from '../utils/authForm';

export const VerificationPendingPage = () => {
  const location = useLocation();
  const initialEmail = location.state?.email || sessionStorage.getItem('acadova_pending_email') || '';
  const [knownEmail, setKnownEmail] = useState(initialEmail);
  const [draftEmail, setDraftEmail] = useState(initialEmail);
  const [cooldown, setCooldown] = useState(location.state?.justRegistered ? 60 : 0);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [message, setMessage] = useState(location.state?.deliveryFailed
    ? "We couldn't send the verification email right now. You can try again." : '');
  const [messageType, setMessageType] = useState(location.state?.deliveryFailed ? 'danger' : 'info');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (sendingRef.current || cooldown > 0) return;
    const email = normalizeEmail(draftEmail);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Enter a valid email address to request a new link.');
      setMessageType('danger');
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      await authService.resendVerification(email);
      sessionStorage.setItem('acadova_pending_email', email);
      setKnownEmail(email);
      setDraftEmail(email);
      setMessage('If the account is eligible, a new verification email has been sent.');
      setMessageType('info');
      setCooldown(60);
    } catch (error) {
      setMessage(error.status === 429 ? 'Too many requests. Please try again later.'
        : !error.status ? 'Unable to reach Acadova. Check your connection and try again.'
          : 'Unable to request a new email right now. Please try again later.');
      setMessageType('danger');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return <>
    <span className="auth-form-eyebrow">One more step</span>
    <h2>Check your email</h2>
    <p className="auth-form-intro">{knownEmail
      ? <>Your Acadova account for <strong>{maskEmail(knownEmail)}</strong> is waiting for email verification. Use the link in your email or resend it below.</>
      : 'Enter your email address to request a verification link before logging in to Acadova.'}</p>
    <Alert type={messageType} message={message} />
    {knownEmail ? <button type="button" className="auth-inline-button" onClick={() => { setKnownEmail(''); setMessage(''); }}>Use another email address</button>
      : <div className="form-group"><label className="form-label" htmlFor="pending-email">Email address</label><input id="pending-email" className="form-input" type="email" autoComplete="email" inputMode="email" value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} /></div>}
    <button type="button" className="btn btn-primary auth-submit" onClick={resend} disabled={sending || cooldown > 0}>
      {sending ? 'Sending...' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
    </button>
    <div className="auth-switch"><span>Already verified?</span><Link to="/login" className="btn btn-secondary">Go to Login</Link></div>
  </>;
};

export default VerificationPendingPage;
