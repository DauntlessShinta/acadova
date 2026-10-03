import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import { passwordRequirements } from '../utils/authForm';
import Alert from '../components/common/Alert';

export default function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState(token ? 'ready' : 'invalid');
  const [error, setError] = useState('');
  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', '/reset-password');
  }, [token]);
  const submit = async (event) => {
    event.preventDefault();
    if (state === 'working') return;
    if (!passwordRequirements(password).every(([, met]) => met)
      || password.length > 64 || new TextEncoder().encode(password).length > 72) {
      setError('Use 8–64 characters with uppercase, lowercase, a number, and a special character.');
      return;
    }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setState('working'); setError('');
    try { await authService.resetPassword(token, password); setState('success'); setPassword(''); setConfirm(''); }
    catch (failure) {
      if (failure?.data?.code === 'RESET_EXPIRED') setState('expired');
      else if (failure?.data?.code === 'RESET_INVALID') setState('invalid');
      else { setState('ready'); setError('Unable to reset your password right now. Please try again.'); }
    }
  };
  return <>
    <span className="auth-form-eyebrow">Account recovery</span>
    <h2>{state === 'success' ? 'Password updated' : state === 'expired' ? 'Reset link expired'
      : state === 'invalid' ? 'Reset link unavailable' : 'Choose a new password'}</h2>
    {state === 'success' ? <p className="auth-form-intro" role="status">You can now log in with your new password.</p>
      : state === 'expired' || state === 'invalid'
        ? <p className="auth-form-intro">Request a new link to reset your password.</p>
        : <>
          <p className="auth-form-intro">Enter a new password for your Acadova account.</p>
          <Alert type="danger" message={error} onClose={() => setError('')} />
          <form onSubmit={submit}>
            <div className="form-group"><label className="form-label" htmlFor="reset-password">New password</label>
              <input id="reset-password" className="form-input" type="password" autoComplete="new-password"
                value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <div className="form-group"><label className="form-label" htmlFor="reset-confirm">Confirm new password</label>
              <input id="reset-confirm" className="form-input" type="password" autoComplete="new-password"
                value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></div>
            <button className="btn btn-primary auth-submit" disabled={state === 'working'}>
              {state === 'working' ? 'Updating password...' : 'Reset password'}</button>
          </form>
        </>}
    <div className="auth-switch"><Link to={state === 'expired' || state === 'invalid' ? '/forgot-password' : '/login'}>
      {state === 'expired' || state === 'invalid' ? 'Request a new link' : 'Back to login'}</Link></div>
  </>;
}
