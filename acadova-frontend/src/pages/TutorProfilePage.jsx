import { useToast } from '../context/toastAccess';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import sessionService from '../services/sessionService';
import creditService from '../services/creditService';
import PeerReputation from '../components/common/PeerReputation';
import { sessionRequestTimeError } from '../utils/sessionRequestTime';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  ArrowLeft,
} from 'lucide-react';

export const TutorProfilePage = () => {
  const toast = useToast();
  const { id } = useParams();
  const location = useLocation();
  const { credits, refreshUser } = useAuth();

  const [tutor, setTutor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewError, setReviewError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Request form state
  const [sessionSubject, setSessionSubject] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [meetingMethod, setMeetingMethod] = useState('online');
  const [requestMessage, setRequestMessage] = useState('');
  const submittingRef = useRef(false);
  const [requestedSession, setRequestedSession] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [sessionCost, setSessionCost] = useState(null);

  useEffect(() => {
    const fetchTutor = async () => {
      try {
        setLoading(true);
        setError(''); setRequestedSession(null);
        const res = await userService.getUserById(id);
        if (res?.data?.role === 'student') {
          setTutor(res.data);
          setReviews([]); setReviewError('');
          userService.getUserReviews(id).then((reviewResult) => setReviews(reviewResult.data || []))
            .catch(() => setReviewError('Reviews could not be loaded. Please refresh to try again.'));
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
      creditService.getCurrentRules().then((response) => setSessionCost(response.data.tutoringSessionCost))
        .catch(() => setSessionCost(null));
    }
  }, [id]);

  useEffect(() => {
    if (tutor && location.hash === '#request-session') {
      document.getElementById('request-session')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, tutor]);

  const handleRequestSession = async (e) => {
    e.preventDefault();
    if (submittingRef.current || requestedSession) return;
    setError('');


    const errors = {};
    if (!sessionSubject.trim()) errors.subject = 'Choose a subject.';
    const timeError = sessionRequestTimeError(scheduledAt);
    if (timeError) errors.scheduledAt = timeError;
    if (!meetingMethod) errors.meetingMethod = 'Choose a session method.';
    if (!requestMessage.trim()) errors.requestMessage = 'Tell your peer what you would like help with.';
    if (requestMessage.trim().length > 500) errors.requestMessage = 'Your message must be 500 characters or fewer.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => document.getElementById(Object.keys(errors)[0])?.focus());
      return;
    }

    if (sessionCost !== null && credits < sessionCost) {
      setFieldErrors({ credits: 'You need more Acadova Credits. Pass a qualifying assessment or teach a verified session to earn credits.' });
      return;
    }

    try {
      submittingRef.current = true; setSubmitting(true);
      const result = await sessionService.createSession({
        tutorId: id,
        subject: sessionSubject.trim(),
        scheduledAt: scheduledAt || undefined,
        meetingMethod,
        requestMessage: requestMessage.trim(),
      });

      setRequestedSession(result.data);
      toast('success', 'Session request sent.');
      refreshUser();
    } catch (err) {
      toast('error', err.message || 'Failed to request session.');
    } finally {
      submittingRef.current = false; setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading peer details..." size={36} />;
  }

  if (!tutor) {
    return (
      <div>
        <Link to="/tutors" className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to Find Tutors
        </Link>
        <Alert type="danger" message={error || 'Peer not found.'} />
      </div>
    );
  }

  return (
    <div className="container-narrow tutor-profile-page">
      <Link to="/tutors" className="btn btn-secondary btn-sm" style={{ marginBottom: 24, display: 'inline-flex', gap: 6 }}>
        <ArrowLeft size={14} /> Back to Find Tutors
      </Link>

      <Alert type="danger" message={error} onClose={() => setError('')} />

      <div className="tutor-profile-layout">
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
            <h1 style={{ fontSize: '1.6rem', color: 'var(--navy-900)', marginBottom: '6px' }}>{tutor.name}</h1>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <PeerReputation peer={tutor} size={18} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--ink-800)', marginBottom: '10px' }}>What can this person teach me?</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(tutor.skillsToTeach || []).map((skill, idx) => (
                <span key={idx} className="badge badge-brass" style={{ textTransform: 'none', fontSize: '0.82rem' }}>
                  {skill}
                </span>
              ))}
              {(tutor.skillsToTeach || []).length === 0 && (
                <span className="form-hint">No specific teaching skills listed.</span>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--ink-800)', marginBottom: '10px' }}>Also learning</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(tutor.skillsToLearn || []).map((skill, idx) => (
                <span key={idx} className="badge badge-navy" style={{ textTransform: 'none', fontSize: '0.82rem' }}>
                  {skill}
                </span>
              ))}
              {(tutor.skillsToLearn || []).length === 0 && (
                <span className="form-hint">None listed.</span>
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
            Book a 1-on-1 collaborative study room with {tutor.name}. Credits transfer after both participants confirm a verified session, or after a valid Moderator resolution.
          </p>

          {requestedSession ? <div className="session-request-success" role="status"><h2>Session request sent</h2><p>{tutor.name} will receive your request and proposed schedule.</p><Link className="btn btn-primary" to={`/sessions/${requestedSession._id || requestedSession.id}`}>View requested session</Link></div> : <form onSubmit={handleRequestSession}>
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
              aria-describedby={fieldErrors.scheduledAt ? 'request-time-error' : undefined}
              required
            />
              <span className="form-hint">Enter your local date and time. Each participant sees it in their own timezone.</span>
              {fieldErrors.scheduledAt && <span className="form-error" id="request-time-error">{fieldErrors.scheduledAt}</span>}
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
              {fieldErrors.credits && <p className="form-error">{fieldErrors.credits}</p>}
              <span className="form-label">Tutoring Session Cost: {sessionCost ?? 'Unavailable'} credits</span>
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
              <strong className="tabular">{credits} Credits</strong>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={submitting}
            >
              {submitting ? 'Sending Request...' : 'Send Session Request'}
            </button>
          </form>}
        </div>
      </div>
      <section className="card peer-reviews" aria-labelledby="peer-reviews-heading">
        <h2 id="peer-reviews-heading">Peer reviews</h2>
        {reviewError ? <Alert type="danger" message={reviewError} /> : reviews.length === 0 ? <p>No visible reviews yet.</p>
          : reviews.map((review) => <article key={review.id}>
            <strong>{review.reviewerName}</strong> · {review.rating} out of 5
            {review.comment && <p>{review.comment}</p>}
          </article>)}
      </section>
    </div>
  );
};

export default TutorProfilePage;
