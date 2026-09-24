import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/common/Alert';
import { getRoleHomeRoute } from '../config/roleNavigation';

const loginError = (error) => {
  if (error.status === 401) return 'Email or password is incorrect.';
  if (error.status >= 500) return 'Acadova is temporarily unavailable. Please try again.';
  return error.data?.message || 'Unable to sign in. Please try again.';
};

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    if (!password) next.password = 'Enter your password.';
    setFields(next);
    setError('');
    if (Object.keys(next).length) return;
    try {
      setSubmitting(true);
      const response = await login(email.trim(), password);
      navigate(getRoleHomeRoute(response?.data?.user?.role), { replace: true });
    } catch (err) {
      if (err.data?.code === 'EMAIL_VERIFICATION_REQUIRED') {
        sessionStorage.setItem('acadova_pending_email', email.trim().toLowerCase());
        navigate('/verify-email/pending', { replace: true, state: { email: email.trim().toLowerCase() } });
        return;
      }
      setError(loginError(err));
    } finally { setSubmitting(false); }
  };

  return <>
    <span className="auth-form-eyebrow">Welcome back</span>
    <h2>Log in to Acadova</h2>
    <p className="auth-form-intro">Continue your peer learning journey.</p>
    <Alert type="danger" message={error} onClose={() => setError('')} />
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-group"><label className="form-label" htmlFor="login-email">Email address</label><input id="login-email" type="email" className="form-input" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(fields.email)} aria-describedby={fields.email ? 'login-email-error' : undefined} required autoFocus />{fields.email && <span className="form-error" id="login-email-error">{fields.email}</span>}</div>
      <div className="form-group"><label className="form-label" htmlFor="login-password">Password</label><div className="auth-password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} className="form-input" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'login-password-error' : undefined} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{fields.password && <span className="form-error" id="login-password-error">{fields.password}</span>}</div>
      <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>{submitting ? 'Logging in...' : <>Log in <ArrowRight size={17} /></>}</button>
    </form>
    <div className="auth-switch"><span>New to Acadova?</span><Link to="/register" className="btn btn-secondary">Create an account</Link></div>
  </>;
};

export default LoginPage;
