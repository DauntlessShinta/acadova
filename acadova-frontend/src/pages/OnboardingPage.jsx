import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import TagInput from '../components/common/TagInput';
import Alert from '../components/common/Alert';
import { needsProfileSetup, splitDisplayName } from '../utils/profileSetup';

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [initialName] = useState(() => splitDisplayName(user?.name));
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [learn, setLearn] = useState(user?.skillsToLearn || []);
  const [teach, setTeach] = useState(user?.skillsToTeach || []);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!needsProfileSetup(user)) return <Navigate to="/dashboard" replace />;
  const finish = async (event) => {
    event.preventDefault();
    setError('');
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    if (name.length < 2 || name.length > 80 || !firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.'); return;
    }
    setSaving(true);
    try {
      await userService.updateMe({ name, skillsToLearn: learn, skillsToTeach: teach });
      await userService.finishOnboarding();
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch {
      setError('We could not save your profile. Please try again.');
    } finally { setSaving(false); }
  };
  const skip = async () => {
    setSaving(true); setError('');
    try {
      await userService.finishOnboarding();
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch { setError('We could not save your choice. Please try again.'); }
    finally { setSaving(false); }
  };
  return <div className="container-narrow onboarding">
    <span className="auth-form-eyebrow">Getting started · Step {step + 1} of 3</span>
    <h1>Welcome to Acadova</h1>
    <p>Tell us a little about your learning interests. You can edit everything later in your Profile.</p>
    <Alert type="danger" message={error} onClose={() => setError('')} />
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
      <div className="form-group"><label className="form-label" htmlFor="onboard-first">First name</label>
        <input id="onboard-first" className="form-input" value={firstName}
          onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required /></div>
      <div className="form-group"><label className="form-label" htmlFor="onboard-last">Last name</label>
        <input id="onboard-last" className="form-input" value={lastName}
          onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required /></div>
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Finish setup'}</button>
    </form>}
    <div className="onboarding-actions">
      {step > 0 && <button type="button" className="btn btn-secondary" disabled={saving}
        onClick={() => { setError(''); setStep(step - 1); }}>Back</button>}
      {step < 2 && <button type="button" className="btn btn-primary"
        onClick={() => { setError(''); setStep(step + 1); }}>Continue</button>}
      <button type="button" className="btn btn-secondary" disabled={saving} onClick={skip}>Skip for now</button>
    </div>
  </div>;
}
