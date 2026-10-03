import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import Alert from '../components/common/Alert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setSending(true); setError('');
    try { await authService.forgotPassword(email.trim().toLowerCase()); setSent(true); }
    catch (failure) { setError(failure?.status === 429
      ? 'Too many requests. Please try again later.'
      : 'We could not process your request right now. Please try again.'); }
    finally { setSending(false); }
  };
  return <>
    <span className="auth-form-eyebrow">Account recovery</span>
    <h2>Forgot your password?</h2>
    {sent ? <>
      <p className="auth-form-intro" role="status">If an account exists for that email, a password reset link has been sent.</p>
      <p>Check your inbox and spam folder. The link expires in 30 minutes.</p>
    </> : <>
      <p className="auth-form-intro">Enter your email and we'll send you a reset link.</p>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <form onSubmit={submit}>
        <div className="form-group"><label className="form-label" htmlFor="recovery-email">Email address</label>
          <input id="recovery-email" className="form-input" type="email" autoComplete="email"
            value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></div>
        <button className="btn btn-primary auth-submit" disabled={sending}>{sending ? 'Sending...' : 'Send reset link'}</button>
      </form>
    </>}
    <div className="auth-switch"><Link to="/login">Back to login</Link></div>
  </>;
}
