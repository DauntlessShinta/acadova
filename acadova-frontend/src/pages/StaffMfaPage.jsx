import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { clearStaffChallenge, readStaffChallenge, saveStaffChallenge } from '../utils/staffMfa';
import { getRoleHomeRoute } from '../config/roleNavigation';
import PublicBrandLogo from '../components/common/PublicBrandLogo';
import './StaffMfaPage.css';

export default function StaffMfaPage() {
  const [pending, setPending] = useState(readStaffChallenge);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(Date.now);
  const locked = useRef(false);
  const input = useRef(null);
  const mounted = useRef(true);
  const { verifyStaffMfa } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { mounted.current = true; const timer = setInterval(() => setNow(Date.now()), 1000); return () => { mounted.current = false; clearInterval(timer); }; }, []);
  const expired = !pending || Date.parse(pending.expiresAt) <= now;
  const wait = Math.max(0, Math.ceil((Date.parse(pending?.resendAt) - now) / 1000)) || 0;
  async function submit(event) {
    event.preventDefault();
    if (locked.current || expired) return;
    if (!/^[0-9]{6}$/.test(code)) { setError('Enter the six-digit code from your latest email.'); input.current?.focus(); return; }
    locked.current = true; setWorking(true); setError(''); setNotice('');
    try {
      const response = await verifyStaffMfa(pending.challenge, code);
      if (mounted.current) { setCode(''); setNotice('Identity verified. Opening your workspace...'); navigate(getRoleHomeRoute(response.data.user.role), { replace: true }); }
    } catch (failure) {
      if (mounted.current) { setCode(''); setError(failure.message || 'Verification failed. Please try again.'); input.current?.focus(); }
    } finally { locked.current = false; if (mounted.current) setWorking(false); }
  }
  async function resend() {
    if (locked.current || expired || wait) return;
    locked.current = true; setWorking(true); setError(''); setNotice(''); setCode('');
    try {
      const response = await authService.resendStaffMfa(pending.challenge);
      if (mounted.current) { setPending(response.data); saveStaffChallenge(response.data); setNow(Date.now()); setNotice('A new code was sent. Use only the latest email.'); input.current?.focus(); }
    } catch (failure) { if (mounted.current) setError(failure.message || 'The email could not be sent. Return to sign-in and try again.'); }
    finally { locked.current = false; if (mounted.current) setWorking(false); }
  }
  return <section className="staff-mfa" aria-labelledby="staff-mfa-title">
    <Link to="/" aria-label="Acadova home"><PublicBrandLogo /></Link>
    <ShieldCheck className="staff-mfa-emblem" size={28} aria-hidden="true" />
    <h2 id="staff-mfa-title">Verify your identity</h2>
    <p>One more step to protect your staff workspace.</p>
    {pending && <p>Enter the code sent to <strong>{pending.maskedEmail}</strong>. It expires five minutes after sign-in.</p>}
    {expired ? <p role="alert">Your verification has expired. Return to sign-in to request a fresh code.</p> : <form onSubmit={submit}>
      <label className="form-label" htmlFor="staff-mfa-code">Six-digit verification code</label>
      <input ref={input} id="staff-mfa-code" className="form-input staff-mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => { setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }} aria-invalid={Boolean(error)} aria-describedby="staff-mfa-message" autoFocus />
      <button className="btn btn-primary" type="submit" disabled={working}>{working ? 'Verifying...' : 'Verify Code'}</button>
      <button className="btn btn-secondary" type="button" disabled={working || wait > 0} onClick={resend}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend Code'}</button>
    </form>}
    <p id="staff-mfa-message" role={error ? 'alert' : 'status'}>{error || notice}</p>
    <Link className="staff-mfa-back" to="/login" onClick={clearStaffChallenge}>Back to sign-in</Link>
    <small>Never share your code. No access to your mailbox? Contact your authorized Acadova administrator.</small>
  </section>;
}
