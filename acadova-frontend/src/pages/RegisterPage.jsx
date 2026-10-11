import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/toastAccess';
import { focusInvalidField } from '../utils/focusInvalidField';
import { passwordRequirements, pendingRegistrationNavigation, registrationErrorMessage, validateRegistration } from '../utils/authForm';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import PolicyReviewDialog from '../components/auth/PolicyReviewDialog';
import './RegisterPage.css';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const toast = useToast();
  const [fields, setFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const requirements = passwordRequirements(password);
  const requirementLabels = ['8+ characters', 'Uppercase letter', 'Lowercase letter', 'Number', 'Special character'];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const { fields: next, account } = validateRegistration({ name, email, password, confirmPassword, policyAccepted });
    setFields(next);

    if (Object.keys(next).length) { focusInvalidField(next, { name: 'register-name', email: 'register-email', password: 'register-password', confirmPassword: 'register-confirm-password', policyAccepted: 'register-policy-review' }); return; }
    try {
      submittingRef.current = true;
      setSubmitting(true);
      await register(account);
      toast('success', 'Account created. Check your email to verify.');
      sessionStorage.setItem('acadova_pending_email', account.email);
      navigate('/verify-email/pending', { replace: true, state: { email: account.email, justRegistered: true } });
    } catch (err) {
      const pending = pendingRegistrationNavigation(err, account.email);
      if (pending) {
        sessionStorage.setItem('acadova_pending_email', pending.state.email);
        navigate(pending.path, { replace: true, state: pending.state });
        return;
      }
      if (err.data?.code === 'VERIFICATION_EMAIL_UNAVAILABLE') {
        sessionStorage.setItem('acadova_pending_email', account.email);
        navigate('/verify-email/pending', { replace: true, state: { email: account.email, deliveryFailed: true } });
        return;
      }
      if (err.status === 409) setFields({ email: 'An account with this email already exists.' });
      toast('error', registrationErrorMessage(err));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return <>
    <span className="auth-form-eyebrow">Join the exchange</span>
    <h1 className="register-title">Create your Acadova account</h1>
    <p className="auth-form-intro">Learn with peers. Add your skills later from your Profile.</p>
    <form className="register-form" onSubmit={handleSubmit} noValidate>
      <div className="register-fields">
      <div className="form-group">
        <label className="form-label" htmlFor="register-name">Full name</label>
        <input id="register-name" placeholder="Juan Dela Cruz" type="text" className="form-input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(fields.name)} aria-describedby={fields.name ? 'register-name-hint register-name-error' : 'register-name-hint'} required autoFocus />
        <span className="form-hint" id="register-name-hint">Name used at school or tutoring.</span>
        {fields.name && <span className="form-error" id="register-name-error">{fields.name}</span>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="register-email">Email address</label>
        <input id="register-email" type="email" placeholder="student@example.com" className="form-input" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(fields.email)} aria-describedby={fields.email ? 'register-email-error' : undefined} required />
        {fields.email && <span className="form-error" id="register-email-error">{fields.email}</span>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="register-password">Password</label>
        <div className="auth-password-field">
          <input id="register-password" type={showPassword ? 'text' : 'password'} className="form-input" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'register-password-hint register-password-requirements register-password-error' : 'register-password-hint register-password-requirements'} minLength={8} required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </div>
        {fields.password && <span className="form-error" id="register-password-error">{fields.password}</span>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="register-confirm-password">Confirm password</label>
        <div className="auth-password-field">
          <input id="register-confirm-password" type={showConfirmPassword ? 'text' : 'password'} className="form-input" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(fields.confirmPassword)} aria-describedby={fields.confirmPassword ? 'register-confirm-password-error' : undefined} required />
          <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </div>
        {fields.confirmPassword && <span className="form-error" id="register-confirm-password-error">{fields.confirmPassword}</span>}
      </div>
      </div>
      <div className="register-password-guidance">
        <p className="form-hint" id="register-password-hint">Password requirements</p>
        <ul className="auth-password-requirements" id="register-password-requirements" aria-label="Password requirements">{requirements.map(([label, met], index) => <li key={label} className={met ? 'is-met' : ''}><span aria-hidden="true">{met ? <Check size={14} /> : '○'}</span><span className="sr-only">{met ? 'Met: ' : 'Required: '}</span>{requirementLabels[index]}</li>)}</ul>
      </div>
      <div className="form-group policy-acknowledgment">
        <p>I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link> and acknowledge the <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.</p>
        <div className="register-consent-review">
        <button id="register-policy-review" type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewOpen(true)}
          aria-describedby={fields.policyAccepted ? 'register-policy-error' : undefined}>
          {policyAccepted ? 'Review Terms & Privacy again' : 'Review Terms & Privacy'}
        </button>
        <p className={policyAccepted ? 'policy-review-status is-accepted' : 'policy-review-status'} role="status">
          {policyAccepted ? 'Terms and Privacy acknowledgment completed.' : 'Review and agree before creating your account.'}
        </p>
        </div>
        {fields.policyAccepted && <span className="form-error" id="register-policy-error">{fields.policyAccepted}</span>}
        <p>See also our <Link to="/community-guidelines" target="_blank" rel="noopener noreferrer">Community Guidelines</Link>.</p>
      </div>
      <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>{submitting ? 'Creating account...' : <>Create Account <ArrowRight size={17} /></>}</button>
    </form>
    {reviewOpen && <PolicyReviewDialog className="register-policy-backdrop" accepted={policyAccepted} onClose={() => setReviewOpen(false)}
      onAgree={() => { setPolicyAccepted(true); setFields((current) => Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== 'policyAccepted'),
      )); setReviewOpen(false); }} />}
    <GoogleSignInButton />
    <div className="auth-switch"><span>Already have an account?</span><Link to="/login" className="btn btn-secondary">Log in</Link></div>
  </>;
};

export default RegisterPage;
