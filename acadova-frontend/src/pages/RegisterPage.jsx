import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/common/Alert';

const normalizeName = (value) => value.trim().replace(/ +/g, ' ');
const validName = (value) => value.length >= 2 && value.length <= 100
  && !/[\p{Cc}\p{Cf}]/u.test(value)
  && /^[\p{L}\p{M}\p{N} .\p{Pd}'\u2019]+$/u.test(value);

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const requirements = [
    ['At least 8 characters', password.length >= 8],
    ['An uppercase letter', /[A-Z]/.test(password)],
    ['A lowercase letter', /[a-z]/.test(password)],
    ['A number', /[0-9]/.test(password)],
    ['A special character', /[^A-Za-z0-9\s]/.test(password)],
  ];
  const passwordValid = requirements.every(([, met]) => met)
    && password.length <= 64 && new TextEncoder().encode(password).length <= 72
    && !/[\p{Cc}\p{Cf}]/u.test(password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanName = normalizeName(name);
    const cleanEmail = email.trim().toLowerCase();
    const next = {};
    if (!validName(cleanName)) next.name = 'Enter a valid full name (2 to 100 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) next.email = 'Enter a valid email address.';
    if (!passwordValid) next.password = 'Meet all password requirements (maximum 64 characters and 72 UTF-8 bytes).';
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    setFields(next);
    setError(Object.keys(next).length ? 'Check the highlighted fields.' : '');
    if (Object.keys(next).length) return;
    try {
      setSubmitting(true);
      await register({ name: cleanName, email: cleanEmail, password });
      sessionStorage.setItem('acadova_pending_email', cleanEmail);
      navigate('/verify-email/pending', { replace: true, state: { email: cleanEmail } });
    } catch (err) {
      if (err.data?.code === 'VERIFICATION_EMAIL_UNAVAILABLE') {
        sessionStorage.setItem('acadova_pending_email', cleanEmail);
        navigate('/verify-email/pending', { replace: true, state: { email: cleanEmail, deliveryFailed: true } });
        return;
      }
      if (err.status === 409) setFields({ email: 'This email address is already registered.' });
      setError(err.status === 409 ? 'An account with this email address already exists.'
        : err.status >= 500 ? 'Acadova is temporarily unavailable. Please try again.'
          : err.data?.message || 'Account could not be created. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <>
    <span className="auth-form-eyebrow">Join the exchange</span>
    <h2>Create your Acadova account</h2>
    <p className="auth-form-intro">Start learning with student peers. You can add your skills later from your Profile.</p>
    <Alert type="danger" message={error} onClose={() => setError('')} />
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-group"><label className="form-label" htmlFor="register-name">Full name</label><input id="register-name" type="text" className="form-input" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(fields.name)} aria-describedby={fields.name ? 'register-name-error' : undefined} required autoFocus />{fields.name && <span className="form-error" id="register-name-error">{fields.name}</span>}</div>
      <div className="form-group"><label className="form-label" htmlFor="register-email">Email address</label><input id="register-email" type="email" className="form-input" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(fields.email)} aria-describedby={fields.email ? 'register-email-error' : undefined} required />{fields.email && <span className="form-error" id="register-email-error">{fields.email}</span>}</div>
      <div className="form-group"><label className="form-label" htmlFor="register-password">Password</label><div className="auth-password-field"><input id="register-password" type={showPassword ? 'text' : 'password'} className="form-input" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'register-password-error register-password-hint' : 'register-password-hint'} minLength={8} maxLength={64} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div><span className="form-hint" id="register-password-hint">Maximum 64 characters and 72 UTF-8 bytes.</span><ul className="auth-password-requirements" aria-label="Password requirements">{requirements.map(([label, met]) => <li key={label} className={met ? 'is-met' : ''}><span aria-hidden="true">{met ? <Check size={14} /> : '○'}</span>{label}</li>)}</ul>{fields.password && <span className="form-error" id="register-password-error">{fields.password}</span>}</div>
      <div className="form-group"><label className="form-label" htmlFor="register-confirm-password">Confirm password</label><div className="auth-password-field"><input id="register-confirm-password" type={showConfirmPassword ? 'text' : 'password'} className="form-input" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(fields.confirmPassword)} aria-describedby={fields.confirmPassword ? 'register-confirm-password-error' : undefined} required /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{fields.confirmPassword && <span className="form-error" id="register-confirm-password-error">{fields.confirmPassword}</span>}</div>
      <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>{submitting ? 'Creating account...' : <>Create Account <ArrowRight size={17} /></>}</button>
    </form>
    <div className="auth-switch"><span>Already have an account?</span><Link to="/login" className="btn btn-secondary">Log in</Link></div>
  </>;
};

export default RegisterPage;
