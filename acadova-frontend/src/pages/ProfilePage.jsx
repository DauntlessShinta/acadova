import { useToast } from '../context/toastAccess';
import { normalizeName, nameValidationMessage } from '../utils/nameValidation';
import { useUnsavedChanges } from '../utils/useUnsavedChanges';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import TagInput from '../components/common/TagInput';
import PeerReputation from '../components/common/PeerReputation';
import { Save, Mail } from 'lucide-react';

export const ProfilePage = () => {
  const { user } = useAuth();
  // Reset drafts only when switching accounts, not on focus/credit refreshes.
  return <ProfileEditor key={user?._id || user?.id} />;
};

const ProfileEditor = () => {
  const toast = useToast();
  const { user, credits, refreshUser } = useAuth();

  const [name, setName] = useState(() => user?.name || '');
  const [skillsToTeach, setSkillsToTeach] = useState(() => user?.skillsToTeach || []);
  const [skillsToLearn, setSkillsToLearn] = useState(() => user?.skillsToLearn || []);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [saved, setSaved] = useState(() => JSON.stringify([user?.name || '', user?.skillsToTeach || [], user?.skillsToLearn || []]));
  const dirty = saved !== JSON.stringify([name, skillsToTeach, skillsToLearn]);
  useUnsavedChanges(dirty);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNameError('');

    const validationError = nameValidationMessage(name);
    if (validationError) { setNameError(validationError); document.getElementById('name')?.focus(); return; }

    try {
      setSaving(true);
      await userService.updateMe({
        name: normalizeName(name),
        skillsToTeach,
        skillsToLearn,
      });

      // Normalize the saved name, but preserve any newer edit made in flight.
      setName((current) => current === name ? normalizeName(name) : current);

      await refreshUser();
      setSaved(JSON.stringify([normalizeName(name), skillsToTeach, skillsToLearn]));
      toast('success', 'Profile and academic skills updated.');
    } catch (err) {
      toast('error', err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-narrow profile-page" data-unsaved={dirty}>
      <div style={{ marginBottom: '28px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--brass-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Account & Academic Preferences
        </span>
        <h1 style={{ fontSize: '2rem', color: 'var(--navy-900)', margin: '4px 0 0' }}>
          My Profile
        </h1>
      </div>

      <div className="grid-2 profile-layout">
        {/* Left Card: Account Overview & Badges */}
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--brass-100)',
              color: 'var(--brass-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem',
              margin: '0 auto 12px',
              border: '2px solid var(--brass-300)',
            }}>
              {user?.name?.charAt(0) || 'U'}
            </div>
            <h3 style={{ margin: '0 0 4px', color: 'var(--navy-900)' }}>{user?.name}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Mail size={14} /> {user?.email}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--ink-600)' }}>Account Role:</span>
              <span className="badge badge-navy" style={{ textTransform: 'capitalize' }}>
                {user?.role || 'student'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--ink-600)' }}>Wallet Balance:</span>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--brass-700)' }}>
                {credits} Credits
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--ink-600)' }}>Peer Rating:</span>
              <PeerReputation peer={user} size={15} />
            </div>

            {user?.createdAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--ink-600)' }}>Member Since:</span>
                <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--ink-500)' }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Profile Edit Form */}
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-900)', marginBottom: '18px' }}>
            Edit Profile & Skills
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Full Display Name
              </label>
              <input
                id="name"
                aria-invalid={Boolean(nameError)} aria-describedby="profile-name-help"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p id="profile-name-help" className={nameError ? "form-error" : "form-hint"}>{nameError || "Enter the name you normally use for school or tutoring."}</p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-skills-teach">
                Skills You Can Teach
              </label>
              <TagInput
                id="profile-skills-teach"
                tags={skillsToTeach}
                onChange={setSkillsToTeach}
                placeholder="Add skill (e.g. React, Java, Database)..."
              />
              <span className="form-hint">These appear in student peer discovery.</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-skills-learn">
                Skills You Want to Learn
              </label>
              <TagInput
                id="profile-skills-learn"
                tags={skillsToLearn}
                onChange={setSkillsToLearn}
                placeholder="Add skill (e.g. Python, Calculus)..."
              />
              <span className="form-hint">Describe the skills you want to study.</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '12px' }}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving changes...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
