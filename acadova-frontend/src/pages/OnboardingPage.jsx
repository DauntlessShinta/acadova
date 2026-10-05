import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import TagInput from '../components/common/TagInput';
import { normalizeName, nameValidationMessage } from '../utils/nameValidation';
import { useToast } from '../context/toastAccess';
import { needsProfileSetup } from '../utils/profileSetup';

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [learn, setLearn] = useState(user?.skillsToLearn || []);
  const [teach, setTeach] = useState(user?.skillsToTeach || []);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  if (!needsProfileSetup(user)) return <Navigate to="/dashboard" replace />;
  const finish = async (event) => {
    event.preventDefault();
    const invalidName = nameValidationMessage(displayName);
    setNameError(invalidName);
    if (invalidName) { document.getElementById('onboard-name')?.focus(); return; }
    const name = normalizeName(displayName);
    setSaving(true);
    try {
      await userService.updateMe({ name, skillsToLearn: learn, skillsToTeach: teach });
      await userService.finishOnboarding();
      await refreshUser();
      toast('success', 'Profile setup saved.');
      navigate('/dashboard', { replace: true });
    } catch {
      toast('error', 'We could not save your profile. Please try again.');
    } finally { setSaving(false); }
  };
  const skip = async () => {
    setSaving(true);
    try {
      await userService.finishOnboarding();
      await refreshUser();
      toast('info', 'You can finish your Profile later.');
      navigate('/dashboard', { replace: true });
    } catch { toast('error', 'We could not save your choice. Please try again.'); }
    finally { setSaving(false); }
  };
  return <div className="container-narrow onboarding">
    <span className="auth-form-eyebrow">Getting started · Step {step + 1} of 3</span>
    <h1>Welcome to Acadova</h1>
    <p>Tell us a little about your learning interests. You can edit everything later in your Profile.</p>
    {step === 0 && <section className="card">
      <h2>What would you like to learn?</h2>
      <p>We'll use this to help you find peers and learning content. Add a topic, then press Enter.</p>
      <label className="form-label" htmlFor="onboard-learn">Learning interests</label>
      <TagInput id="onboard-learn" tags={learn} onChange={setLearn} placeholder="e.g. Python, Calculus" />
    </section>}
    {step === 1 && <section className="card">
      <h2>What can you teach?</h2>
      <p>This helps other Students find you when they need help with a subject. You can leave this empty for now.</p>
      <label className="form-label" htmlFor="onboard-teach">Teaching skills</label>
      <TagInput id="onboard-teach" tags={teach} onChange={setTeach} placeholder="e.g. Java, Mathematics" />
    </section>}
    {step === 2 && <form className="card" onSubmit={finish}>
      <h2>Tell us about yourself</h2>
      <p>This is your Acadova display name, even if you signed in with Google.</p>
      <div className="form-group"><label className="form-label" htmlFor="onboard-name">Full name</label>
        <input id="onboard-name" className="form-input" value={displayName}
          onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required aria-invalid={Boolean(nameError)} aria-describedby="onboard-name-help" /></div>
      <p id="onboard-name-help" className={nameError ? 'form-error' : 'form-hint'}>{nameError || 'Enter the name you normally use for school or tutoring. A family name is optional.'}</p>
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Finish setup'}</button>
    </form>}
    <div className="onboarding-actions">
      {step > 0 && <button type="button" className="btn btn-secondary" disabled={saving}
        onClick={() => { setStep(step - 1); }}>Back</button>}
      {step < 2 && <button type="button" className="btn btn-primary"
        onClick={() => { setStep(step + 1); }}>Continue</button>}
      <button type="button" className="btn btn-secondary" disabled={saving} onClick={skip}>Skip for now</button>
    </div>
  </div>;
}
