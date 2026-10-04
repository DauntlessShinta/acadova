import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleHomeRoute } from '../../config/roleNavigation';
import { isGoogleClientConfigured } from '../../utils/googleConfig';
import PolicyReviewDialog from './PolicyReviewDialog';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const configured = isGoogleClientConfigured(clientId);

export default function GoogleSignInButton() {
  const container = useRef(null);
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [pendingCredential, setPendingCredential] = useState(null);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    if (!configured) return undefined;
    let active = true;
    const render = () => {
      if (!active || !container.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!active || !credential) return;
          setError('');
          setWorking(true);
          try {
            const response = await googleLogin(credential);
            navigate(getRoleHomeRoute(response?.data?.user?.role), { replace: true });
          } catch (failure) {
            if (active && failure?.data?.code === 'POLICY_ACCEPTANCE_REQUIRED') {
              setPendingCredential(credential);
              setPolicyAccepted(false);
              setError('Review the account policies before creating your Acadova account.');
            } else if (active) setError(failure?.status === 403 ? 'This account is suspended.'
              : failure?.status === 429 ? 'Too many attempts. Please try again shortly.'
                : 'Google sign-in could not be completed. Please try again.');
          } finally {
            if (active) setWorking(false);
          }
        },
      });
      container.current.replaceChildren();
      window.google.accounts.id.renderButton(container.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
        shape: 'rectangular', width: Math.min(320, container.current.clientWidth || 320),
      });
    };
    if (window.google?.accounts?.id) render();
    else {
      let script = document.querySelector('script[data-acadova-google]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.dataset.acadovaGoogle = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
      return () => { active = false; script.removeEventListener('load', render); };
    }
    return () => { active = false; };
  }, [googleLogin, navigate]);

  const createGoogleAccount = async (event) => {
    event.preventDefault();
    if (!policyAccepted || !pendingCredential || working) return;
    setWorking(true); setError('');
    try {
      const response = await googleLogin(pendingCredential, true);
      setPendingCredential(null);
      navigate(getRoleHomeRoute(response?.data?.user?.role), { replace: true });
    } catch {
      setError('Google sign-up could not be completed. Please try signing in again.');
      setPendingCredential(null);
    } finally { setWorking(false); }
  };

  if (!configured) return null;
  return <div className="auth-google">
    <div className="auth-divider"><span>or</span></div>
    <div ref={container} className={working ? 'auth-google-working' : ''} aria-label="Continue with Google" />
    {working && <p role="status">Signing in with Google...</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {pendingCredential && <form className="policy-acknowledgment" onSubmit={createGoogleAccount}>
      <p>I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link> and acknowledge the <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewOpen(true)}>
        {policyAccepted ? 'Review Terms & Privacy again' : 'Review Terms & Privacy'}
      </button>
      <p className={policyAccepted ? 'policy-review-status is-accepted' : 'policy-review-status'} role="status">
        {policyAccepted ? 'Terms and Privacy acknowledgment completed for this new Google account.' : 'Review and agree before creating your account.'}
      </p>
      <button className="btn btn-primary btn-sm" type="submit" disabled={!policyAccepted || working}>Create account</button>
    </form>}
    {reviewOpen && <PolicyReviewDialog accepted={policyAccepted} onClose={() => setReviewOpen(false)}
      onAgree={() => { setPolicyAccepted(true); setError(''); setReviewOpen(false); }} />}
  </div>;
}
