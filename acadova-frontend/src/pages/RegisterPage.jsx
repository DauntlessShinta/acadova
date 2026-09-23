import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, ArrowRight, Sparkles, Coins, CheckCircle2 } from 'lucide-react';
import Alert from '../components/common/Alert';
import TagInput from '../components/common/TagInput';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [skillsToTeach, setSkillsToTeach] = useState(['Java', 'Web Development']);
  const [skillsToLearn, setSkillsToLearn] = useState(['Python', 'Algorithms']);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter a valid academic email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        skillsToTeach,
        skillsToLearn,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '60px 0 80px' }}>
      <div className="container-sm">
        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--brass-100)',
              color: 'var(--brass-700)',
              marginBottom: '14px',
            }}>
              <UserPlus size={22} />
            </div>
            <h2 style={{ color: 'var(--navy-900)', marginBottom: '6px' }}>Create Your Acadova Account</h2>
            <p style={{ fontSize: '0.92rem', color: 'var(--ink-600)' }}>
              Join the peer-to-peer knowledge exchange community.
            </p>
          </div>

          {/* Welcome Bonus Notice */}
          <div style={{
            background: 'var(--brass-50)',
            border: '1px solid var(--brass-300)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <Coins size={22} color="var(--brass-600)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--brass-700)' }}>
              <strong>+2 Initial Credits:</strong> You will immediately receive 2 complimentary credits in your wallet to book your first study session!
            </div>
          </div>

          <Alert type="danger" message={error} onClose={() => setError('')} />

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Academic Email Address
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="alex.morgan@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password (min 6 characters)
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Skills You Can Teach (Tutor Role)
              </label>
              <TagInput
                tags={skillsToTeach}
                onChange={setSkillsToTeach}
                placeholder="Add skill (e.g. Java, React, SQL)..."
              />
              <span className="form-hint">Peers can find and book you for these topics.</span>
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
              <span className="form-hint">Used to recommend compatible peer tutors.</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px', padding: '12px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>Creating account...</span>
              ) : (
                <>
                  <span>Complete Registration (+2 Credits)</span> <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={{
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.9rem',
            color: 'var(--ink-600)',
          }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--brass-700)', fontWeight: 600 }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

