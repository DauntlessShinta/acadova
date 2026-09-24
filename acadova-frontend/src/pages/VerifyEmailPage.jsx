import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import { verificationResultForError } from '../utils/authForm';

const content = {
  loading: ['Verifying your email...', 'Please wait while we check your link.', null, null],
  success: ['Email verified', 'Your Acadova account is ready.', '/login', 'Log in to Acadova'],
  invalid: ['This verification link is invalid or has already been used.', 'Request a new link if you still need to verify your account.', '/verify-email/pending', 'Request a new verification email'],
  expired: ['This verification link has expired.', 'Request a new link to verify your account.', '/verify-email/pending', 'Send a new verification email'],
  unavailable: ['Verification is temporarily unavailable', 'We could not check your link. Please try again.', null, null],
};

export const VerifyEmailPage = () => {
  // The token remains only in component memory and is removed from browser history.
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
  const [result, setResult] = useState(token ? 'loading' : 'invalid');
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const headingRef = useRef(null);

  useEffect(() => {
    if (!token || inFlight.current) return;
    inFlight.current = true;
    window.history.replaceState(window.history.state, '', '/verify-email');
    authService.verifyEmail(token).then(() => {
      sessionStorage.removeItem('acadova_pending_email');
      setResult('success');
    }).catch((error) => {
      setResult(verificationResultForError(error));
    }).finally(() => {
      inFlight.current = false;
    });
  }, [token, retry]);

  useEffect(() => {
    if (result !== 'loading') headingRef.current?.focus();
  }, [result]);

  const [title, description, route, action] = content[result];
  return <>
    <span className="auth-form-eyebrow">Email verification</span>
    <h2 ref={headingRef} tabIndex={-1}>{title}</h2>
    <p className="auth-form-intro" role="status" aria-live="polite">{description}</p>
    {route && <Link className="btn btn-primary auth-submit" to={route}>{action}</Link>}
    {result === 'unavailable' && <button type="button" className="btn btn-primary auth-submit" onClick={() => { setResult('loading'); setRetry((count) => count + 1); }}>Try verification again</button>}
  </>;
};

export default VerifyEmailPage;
