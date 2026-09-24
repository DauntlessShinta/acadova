import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Alert from '../components/common/Alert';
import authService from '../services/authService';

const maskEmail = (value) => {
  const [local, domain] = value.split('@');
  if (!local || !domain) return '';
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
};

export const VerificationPendingPage = () => {
  const location = useLocation();
  const [email, setEmail] = useState(() => location.state?.email || sessionStorage.getItem('acadova_pending_email') || '');
  const [cooldown, setCooldown] = useState(location.state?.email && !location.state?.deliveryFailed ? 60 : 0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(location.state?.deliveryFailed
    ? 'Your account was created, but the email could not be sent. Please try resending shortly.' : '');

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setMessage('Enter a valid email address to request a new link.');
      return;
    }
    setSending(true);
    try {
      await authService.resendVerification(cleanEmail);
      sessionStorage.setItem('acadova_pending_email', cleanEmail);
      setEmail(cleanEmail);
      setMessage('If an unverified account exists, a new verification email has been sent.');
      setCooldown(60);
    } catch (error) {
      setMessage(error.status === 429 ? 'Too many requests. Please try again later.'
        : 'Unable to request a new email right now. Please try again later.');
    } finally {
      setSending(false);
    }
  };

  return <>
    <span className="auth-form-eyebrow">One more step</span>
    <h2>Check your email</h2>
    <p className="auth-form-intro">{email ? <>We sent a verification link to <strong>{maskEmail(email)}</strong>.</>
      : 'Enter your email address to request a verification link.'} Verify your email to continue to Acadova.</p>
    <Alert type="info" message={message} />
    {!email && <div className="form-group"><label className="form-label" htmlFor="pending-email">Email address</label><input id="pending-email" className="form-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>}
    <button type="button" className="btn btn-primary auth-submit" onClick={resend} disabled={sending || cooldown > 0}>
      {sending ? 'Sending...' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
    </button>
    <div className="auth-switch"><span>Already verified?</span><Link to="/login" className="btn btn-secondary">Go to Login</Link></div>
  </>;
};

export default VerificationPendingPage;
