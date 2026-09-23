import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import TagInput from '../components/common/TagInput';
import StarRating from '../components/common/StarRating';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  User,
  Save,
  GraduationCap,
  BookOpen,
  Mail,
  ShieldCheck,
  Star,
  Coins,
  CheckCircle2,
} from 'lucide-react';

export const ProfilePage = () => {
  const { user, credits, refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [skillsToTeach, setSkillsToTeach] = useState([]);
  const [skillsToLearn, setSkillsToLearn] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setSkillsToTeach(user.skillsToTeach || []);
      setSkillsToLearn(user.skillsToLearn || []);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    try {
      setSaving(true);
      await userService.updateMe({
        name: name.trim(),
        skillsToTeach,
        skillsToLearn,
      });

      await refreshUser();
      setSuccess('Profile and academic skills successfully updated!');
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-narrow">
      <div style={{ marginBottom: '28px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--brass-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Account & Academic Preferences
        </span>
        <h1 style={{ fontSize: '2rem', color: 'var(--navy-900)', margin: '4px 0 0' }}>
          My Profile
        </h1>
      </div>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="grid-2">
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
              <StarRating rating={user?.rating || 5.0} size={15} />
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
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Skills You Can Teach
              </label>
              <TagInput
                tags={skillsToTeach}
                onChange={setSkillsToTeach}
                placeholder="Add skill (e.g. React, Java, Database)..."
              />
              <span className="form-hint">These appear in student peer discovery.</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Skills You Want to Learn (Learner Role)
              </label>
              <TagInput
                tags={skillsToLearn}
                onChange={setSkillsToLearn}
                placeholder="Add skill (e.g. Python, Calculus)..."
              />
              <span className="form-hint">Used to recommend relevant student peers.</span>
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
