import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import sessionService from '../services/sessionService';
import StarRating from '../components/common/StarRating';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  ArrowLeft,
} from 'lucide-react';

export const TutorProfilePage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { credits, refreshUser } = useAuth();

  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Request form state
  const [sessionSubject, setSessionSubject] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [meetingMethod, setMeetingMethod] = useState('online');
  const [requestMessage, setRequestMessage] = useState('');
  const [creditCost, setCreditCost] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const fetchTutor = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await userService.getUserById(id);
        if (res?.data?.role === 'student') {
          setTutor(res.data);
          if (res.data.skillsToTeach?.length > 0) {
            setSessionSubject(res.data.skillsToTeach[0]);
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to load peer profile');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTutor();
    }
  }, [id]);

  useEffect(() => {
    if (tutor && location.hash === '#request-session') {
      document.getElementById('request-session')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, tutor]);

  const handleRequestSession = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const errors = {};
    if (!sessionSubject.trim()) errors.subject = 'Choose a subject.';
    if (!scheduledAt) errors.scheduledAt = 'Enter a preferred session date.';
    if (!meetingMethod) errors.meetingMethod = 'Choose a session method.';
    if (!requestMessage.trim()) errors.requestMessage = 'Tell your peer what you would like help with.';
    if (requestMessage.trim().length > 500) errors.requestMessage = 'Your message must be 500 characters or fewer.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Check the highlighted session details.');
      return;
    }

    if (credits < creditCost) {
      setError(`Insufficient credits. You have ${credits} credits, but this session requires ${creditCost}.`);
      return;
    }

    try {
      setSubmitting(true);
      await sessionService.createSession({
        tutorId: id,
        subject: sessionSubject.trim(),
        scheduledAt: scheduledAt || undefined,
        meetingMethod,
        requestMessage: requestMessage.trim(),
        creditAmount: creditCost,
      });

      setSuccessMsg(`Session requested successfully with ${tutor.name}!`);
      refreshUser();
    } catch (err) {
      setError(err.message || 'Failed to request session.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading peer details..." size={36} />;
  }

  if (!tutor) {
    return (
      <div>
        <Link to="/tutors" className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to Peers
        </Link>
        <Alert type="danger" message={error || 'Peer not found.'} />
      </div>
    );
  }

  return (
    <div className="container-narrow">
      <Link to="/tutors" className="btn btn-secondary btn-sm" style={{ marginBottom: 24, display: 'inline-flex', gap: 6 }}>
        <ArrowLeft size={14} /> Back to All Peers
      </Link>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={successMsg} onClose={() => setSuccessMsg('')} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '28px' }}>
        {/* Left Column: Peer Profile Info */}
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'var(--brass-100)',
              color: 'var(--brass-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              margin: '0 auto 14px',
              border: '2px solid var(--brass-300)',
            }}>
              {tutor.name?.charAt(0) || 'T'}
            </div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-900)', marginBottom: '6px' }}>{tutor.name}</h2>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <StarRating rating={tutor.rating ?? 0} size={18} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--ink-800)', marginBottom: '10px' }}>Specialties & Teaching Subjects</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(tutor.skillsToTeach || []).map((skill, idx) => (
                <span key={idx} className="badge badge-brass" style={{ textTransform: 'none', fontSize: '0.82rem' }}>
                  {skill}
                </span>
              ))}
              {(tutor.skillsToTeach || []).length === 0 && (
                <span style={{ fontSize: '0.88rem', color: 'var(--ink-400)' }}>No specific teaching skills listed.</span>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--ink-800)', marginBottom: '10px' }}>Learning Interests</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(tutor.skillsToLearn || []).map((skill, idx) => (
                <span key={idx} className="badge badge-navy" style={{ textTransform: 'none', fontSize: '0.82rem' }}>
                  {skill}
                </span>
              ))}
              {(tutor.skillsToLearn || []).length === 0 && (
                <span style={{ fontSize: '0.88rem', color: 'var(--ink-400)' }}>None listed.</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Request Session Form */}
        <div className="card" id="request-session">
          <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-900)', marginBottom: '14px' }}>
            Request a Study Session
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--ink-600)', marginBottom: '20px' }}>
            Book a 1-on-1 collaborative study room with {tutor.name}. Credits transfer only after you confirm completion.
          </p>

          <form onSubmit={handleRequestSession}>
            <div className="form-group">
              <label className="form-label" htmlFor="subject">Subject / Topic</label>
              <input
                id="subject"
                type="text"
                className="form-input"
                placeholder="e.g. Java Data Structures"
                value={sessionSubject}
              onChange={(e) => setSessionSubject(e.target.value)}
              aria-invalid={Boolean(fieldErrors.subject)}
              required
            />
              {fieldErrors.subject && <span className="form-error">{fieldErrors.subject}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="scheduledAt">Preferred Date & Time</label>
              <input
                id="scheduledAt"
                type="datetime-local"
                className="form-input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              aria-invalid={Boolean(fieldErrors.scheduledAt)}
              required
            />
              <span className="form-hint">Enter your local date and time. Each participant sees it in their own timezone.</span>
              {fieldErrors.scheduledAt && <span className="form-error">{fieldErrors.scheduledAt}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="meetingMethod">Session Method</label>
              <select id="meetingMethod" className="form-select" value={meetingMethod} onChange={(e) => setMeetingMethod(e.target.value)} required>
                <option value="online">Online</option>
                <option value="in-person">In Person</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="requestMessage">Short Request Message</label>
              <textarea
                id="requestMessage"
                className="form-textarea"
                rows={3}
                maxLength={500}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Tell your peer what you would like help with."
                aria-invalid={Boolean(fieldErrors.requestMessage)}
                required
              />
              <span className="form-hint">{500 - requestMessage.length} characters remaining</span>
              {fieldErrors.requestMessage && <span className="form-error">{fieldErrors.requestMessage}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="creditCost">Credit Fee</label>
              <select
                id="creditCost"
                className="form-select"
                value={creditCost}
                onChange={(e) => setCreditCost(Number(e.target.value))}
              >
                <option value={1}>1 Credit (Standard 30-45m)</option>
                <option value={2}>2 Credits (Deep Dive 60-90m)</option>
              </select>
            </div>

            <div style={{
              background: 'var(--brass-50)',
              border: '1px solid var(--brass-300)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              margin: '16px 0 20px',
              fontSize: '0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>Your Balance:</span>
              <strong className="mono">{credits} Credits</strong>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={submitting}
            >
              {submitting ? 'Sending Request...' : 'Send Session Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TutorProfilePage;
