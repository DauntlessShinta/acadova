import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import { passwordRequirements } from '../utils/authForm';
import { useToast } from '../context/toastAccess';
import { focusInvalidField } from '../utils/focusInvalidField';

export default function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState(token ? 'ready' : 'invalid');
  const [fields, setFields] = useState({});
  const toast = useToast();
  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', '/reset-password');
  }, [token]);
  const submit = async (event) => {
    event.preventDefault();
    if (state === 'working') return;
    if (!passwordRequirements(password).every(([, met]) => met)
      || password.length > 64 || new TextEncoder().encode(password).length > 72) {
      setFields({ password: 'Use 8–64 characters with uppercase, lowercase, a number, and a special character.' });
      focusInvalidField({ password: true }, { password: 'reset-password' });
      return;
    }
    if (password !== confirm) { setFields({ confirm: 'Passwords do not match.' }); focusInvalidField({ confirm: true }, { confirm: 'reset-confirm' }); return; }
    setState('working'); setFields({});
    try { await authService.resetPassword(token, password); setState('success'); toast('success', 'Your password has been updated.'); setPassword(''); setConfirm(''); }
    catch (failure) {
      if (failure?.data?.code === 'RESET_EXPIRED') setState('expired');
      else if (failure?.data?.code === 'RESET_INVALID') setState('invalid');
      else { setState('ready'); toast('error', 'Unable to reset your password right now. Please try again.'); }
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
          <form onSubmit={submit}>
            <div className="form-group"><label className="form-label" htmlFor="reset-password">New password</label>
              <input id="reset-password" className="form-input" type="password" autoComplete="new-password"
                aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'reset-password-error' : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required />{fields.password && <span id="reset-password-error" className="form-error">{fields.password}</span>}</div>
            <div className="form-group"><label className="form-label" htmlFor="reset-confirm">Confirm new password</label>
              <input id="reset-confirm" className="form-input" type="password" autoComplete="new-password"
                aria-invalid={Boolean(fields.confirm)} aria-describedby={fields.confirm ? 'reset-confirm-error' : undefined} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />{fields.confirm && <span id="reset-confirm-error" className="form-error">{fields.confirm}</span>}</div>
            <button className="btn btn-primary auth-submit" disabled={state === 'working'}>
              {state === 'working' ? 'Updating password...' : 'Reset password'}</button>
          </form>
        </>}
    <div className="auth-switch"><Link to={state === 'expired' || state === 'invalid' ? '/forgot-password' : '/login'}>
      {state === 'expired' || state === 'invalid' ? 'Request a new link' : 'Back to login'}</Link></div>
  </>;
}
