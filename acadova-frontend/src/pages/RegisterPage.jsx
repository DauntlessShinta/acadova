import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Coins, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/common/Alert';
import TagInput from '../components/common/TagInput';

const registrationError = (error) => {
  if (error.status === 409) return 'An account with this email address already exists.';
  if (error.status >= 500) return 'Acadova is temporarily unavailable. Please try again.';
  return error.data?.message || 'Account could not be created. Check your details and try again.';
};

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [skillsToTeach, setSkillsToTeach] = useState([]);
  const [skillsToLearn, setSkillsToLearn] = useState([]);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!name.trim()) next.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 6) next.password = 'Use at least 6 characters.';
    setFields(next);
    setError(Object.keys(next).length ? 'Check the highlighted fields.' : '');
    if (Object.keys(next).length) return;
    try {
      setSubmitting(true);
      await register({ name: name.trim(), email: email.trim(), password, skillsToTeach, skillsToLearn });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.status === 409) setFields({ email: 'This email address is already registered.' });
      setError(registrationError(err));
    }
    finally { setSubmitting(false); }
  };

  return <>
    <span className="auth-form-eyebrow">Join the exchange</span>
    <h2>Create your Acadova account</h2>
    <p className="auth-form-intro">Start learning with student peers. Your account begins with two learning credits.</p>
    <div className="auth-credit-note"><Coins size={18} /><span>2 starting credits to book your first session</span></div>
    <Alert type="danger" message={error} onClose={() => setError('')} />
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-group"><label className="form-label" htmlFor="register-name">Full name</label><input id="register-name" type="text" className="form-input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(fields.name)} aria-describedby={fields.name ? 'register-name-error' : undefined} required autoFocus />{fields.name && <span className="form-error" id="register-name-error">{fields.name}</span>}</div>
      <div className="form-group"><label className="form-label" htmlFor="register-email">Email address</label><input id="register-email" type="email" className="form-input" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(fields.email)} aria-describedby={fields.email ? 'register-email-error' : undefined} required />{fields.email && <span className="form-error" id="register-email-error">{fields.email}</span>}</div>
      <div className="form-group"><label className="form-label" htmlFor="register-password">Password</label><div className="auth-password-field"><input id="register-password" type={showPassword ? 'text' : 'password'} className="form-input" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'register-password-error' : 'register-password-hint'} minLength={6} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div><span className="form-hint" id="register-password-hint">At least 6 characters.</span>{fields.password && <span className="form-error" id="register-password-error">{fields.password}</span>}</div>
      <div className="form-group"><label className="form-label" htmlFor="register-teach">Skills you can teach <span className="auth-optional">(optional)</span></label><TagInput id="register-teach" tags={skillsToTeach} onChange={setSkillsToTeach} placeholder="Add a subject, then press Enter" /><span className="form-hint">Peers can find you for these subjects.</span></div>
      <div className="form-group"><label className="form-label" htmlFor="register-learn">Skills you want to learn <span className="auth-optional">(optional)</span></label><TagInput id="register-learn" tags={skillsToLearn} onChange={setSkillsToLearn} placeholder="Add a subject, then press Enter" /><span className="form-hint">Helps you find relevant peers.</span></div>
      <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>{submitting ? 'Creating account...' : <>Create account <ArrowRight size={17} /></>}</button>
    </form>
    <div className="auth-switch"><span>Already have an account?</span><Link to="/login" className="btn btn-secondary">Log in</Link></div>
  </>;
};

export default RegisterPage;
