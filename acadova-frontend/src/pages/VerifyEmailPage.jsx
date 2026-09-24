import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';

export const VerifyEmailPage = () => {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
  const [result, setResult] = useState(token ? 'loading' : 'invalid');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    window.history.replaceState(window.history.state, '', '/verify-email');
    authService.verifyEmail(token).then(() => {
      sessionStorage.removeItem('acadova_pending_email');
      setResult('success');
    }).catch((error) => {
      setResult(error.data?.code === 'VERIFICATION_EXPIRED' ? 'expired' : 'invalid');
    });
  }, [token]);

  const content = {
    loading: ['Verifying your email', 'Please wait while we check your link.', null, null],
    success: ['Email verified', 'Your Acadova account is ready.', '/login', 'Log in to Acadova'],
    invalid: ['This verification link is invalid', 'The link may already have been used.', '/verify-email/pending', 'Request a new verification email'],
    expired: ['This verification link has expired', 'Request a new link to verify your account.', '/verify-email/pending', 'Send a new verification email'],
  }[result];

  return <>
    <span className="auth-form-eyebrow">Email verification</span>
    <h2>{content[0]}</h2>
    <p className="auth-form-intro" role="status" aria-live="polite">{content[1]}</p>
    {content[2] && <Link className="btn btn-primary auth-submit" to={content[2]}>{content[3]}</Link>}
  </>;
};

export default VerifyEmailPage;
