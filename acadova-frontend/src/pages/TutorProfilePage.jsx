import { minimumLocalDateTime } from '../utils/scheduling';
import { useToast } from '../context/toastAccess';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import sessionService from '../services/sessionService';
import FreeSessionRequest from '../components/student/FreeSessionRequest';
import creditService from '../services/creditService';
import PeerReputation from '../components/common/PeerReputation';
import { AvailabilityGuidance } from '../components/student/WeeklyAvailability';
import { sessionRequestTimeError } from '../utils/sessionRequestTime';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import WorkflowTabs from '../components/common/WorkflowTabs';
import {
  ArrowLeft, MessageSquare, CalendarDays, BookOpen, GraduationCap, Languages,
} from 'lucide-react';

export const TutorProfilePage = () => {
  const toast = useToast();
  const { id } = useParams();
  const location = useLocation();
  const { user, credits, refreshUser, freeLearning } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = ['about', 'subjects', 'reviews', 'availability'].includes(params.get('section')) ? params.get('section') : 'about';
  const isSelf = String(user?._id || user?.id) === id;
  const eligible = user?.role === 'student' && user.emailVerified !== false && !user.suspendedAt;
  const [messageBusy, setMessageBusy] = useState(false);
  const messageGeneration = useRef({ ticket: 0 });

  const [tutor, setTutor] = useState(null);
  const canRequest = eligible && !isSelf && Boolean(tutor?.skillsToTeach?.length);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewError, setReviewError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Request form state
  const [freeRequestOpen,setFreeRequestOpen]=useState(false);
  const [sessionSubject, setSessionSubject] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const submittingRef = useRef(false);
  const [requestedSession, setRequestedSession] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sessionCost, setSessionCost] = useState(null);

  useEffect(() => {
    let active = true;
    const generation = messageGeneration.current;
    generation.ticket++;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true); setTutor(null); setError(''); setReviews([]); setReviewsLoading(true);
      setRequestedSession(null); setRequestError(''); setReviewError(''); setFieldErrors({}); setSessionCost(null);
      setScheduledAt(''); setRequestMessage(''); setMessageBusy(false); setFreeRequestOpen(false);
    });
    userService.getUserById(id).then(res => {
      if (!active) return;
      if (res?.data?.role !== 'student') { setError('Peer profile not found.'); return; }
      setTutor(res.data); setSessionSubject(res.data.skillsToTeach?.[0] || '');
      userService.getUserReviews(id).then(result => { if (active) setReviews(result.data || []); })
        .catch(() => { if (active) setReviewError('Reviews could not be loaded. Please refresh to try again.'); })
        .finally(() => { if (active) setReviewsLoading(false); });
    }).catch(err => { if (active) setError(err.message || 'Failed to load peer profile.'); })
      .finally(() => { if (active) setLoading(false); });
    if(!freeLearning) creditService.getCurrentRules().then(response => { if (active) setSessionCost(response.data.tutoringSessionCost); })
      .catch(() => { if (active) setSessionCost(null); });
    return () => { active = false; generation.ticket++; };
  }, [id, freeLearning]);

  const openRequest = (message = false) => {
    if (!canRequest) return;
    if(freeLearning){setFreeRequestOpen(true);return;}
    const next = new URLSearchParams(params); next.delete('section');
    navigate({ search: next.toString(), hash: '#request-session' });
    requestAnimationFrame(() => {
      const input = document.getElementById(message ? 'requestMessage' : 'subject');
      input?.scrollIntoView({ block: 'center' }); input?.focus({ preventScroll: true });
    });
  };
  const openMessage = async () => {
    if (messageBusy) return;
    const ticket = messageGeneration.current.ticket;
    setMessageBusy(true);
    try {
      const response = await sessionService.getMySessions();
      if (ticket !== messageGeneration.current.ticket) return;
      const ownId = String(user._id || user.id);
      const conversation = (response.data || []).find(session => {
        const peers = [session.learner, session.tutor].map(peer => String(peer?._id || peer?.id || peer));
        return peers.includes(id) && peers.includes(ownId);
      });
      if (conversation) navigate(`/sessions/${conversation._id || conversation.id}#session-messages`);
      else if (canRequest) openRequest(true);
      else toast('info', 'Messages stay with Sessions. You do not have a Session with this student yet.');
    } catch { if (ticket === messageGeneration.current.ticket) toast('error', 'Your conversations could not be loaded. Try again from Sessions > Messages.'); }
    finally { if (ticket === messageGeneration.current.ticket) setMessageBusy(false); }
  };

  useEffect(() => {
    if (tutor && location.hash === '#request-session') {
      if(freeLearning){Promise.resolve().then(()=>setFreeRequestOpen(true));return;}
      document.getElementById('request-session')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, tutor, freeLearning]);

  const handleRequestSession = async (e) => {
    e.preventDefault();
    if (submittingRef.current || requestedSession || !canRequest || sessionCost === null) return;
    setRequestError('');


    const errors = {};
    if (!tutor.skillsToTeach?.includes(sessionSubject)) errors.subject = 'Choose one of this peer\'s teaching subjects.';
    const timeError = sessionRequestTimeError(scheduledAt);
    if (timeError) errors.scheduledAt = timeError;
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
        meetingMethod: 'online',
        requestMessage: requestMessage.trim(),
      });

      setRequestedSession(result.data);
      toast('success', 'Session request sent.');
      refreshUser();
    } catch (err) {
      setRequestError(err.message || 'Failed to request session.');
      toast('error', err.message || 'Failed to request session.');
    } finally {
      submittingRef.current = false; setSubmitting(false);
    }
  };

  if (loading || (tutor && String(tutor._id || tutor.id) !== id)) {
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

  return <div className="container-narrow tutor-profile-page public-peer-profile">
    <Link to="/tutors" className="public-profile-back"><ArrowLeft size={16} aria-hidden="true" />Back to Find Tutors</Link>
    <Alert type="danger" message={error} onClose={() => setError('')} />
    <section className="card public-profile-hero" aria-label="Student profile">
      <div className="public-profile-cover" aria-hidden="true"><span /><span /></div>
      <div className="public-profile-header">
        <div className="public-profile-avatar" aria-hidden="true">{tutor.name?.charAt(0) || 'S'}</div>
        <div className="public-profile-identity"><span className="student-eyebrow">Student · Peer learning</span><h1>{tutor.name}</h1><PeerReputation peer={tutor} size={18} />{tutor.growth&&<div className="ac-peer-growth" aria-label="Shared academic recognition">{tutor.growth.level!=null&&<span>Level {tutor.growth.level}</span>}{tutor.growth.rankTitle&&<span>{tutor.growth.rankTitle}</span>}{tutor.growth.badges?.map(badge=><span key={badge.id}>{badge.title}</span>)}</div>}
          <div className="public-profile-skills" aria-label="Self-listed teaching subjects">{(tutor.skillsToTeach || []).slice(0, 4).map(skill => <span className="badge badge-blue" key={skill}>{skill}</span>)}{tutor.skillsToTeach?.length > 4 && <button type="button" onClick={() => { const next = new URLSearchParams(params); next.set('section', 'subjects'); setParams(next); }}>View all {tutor.skillsToTeach.length} subjects</button>}</div>
        </div>
        <div className="public-profile-actions">{isSelf ? <Link className="btn btn-primary" to="/profile">Edit Profile</Link> : <>
          {canRequest && <button type="button" className="btn btn-primary" onClick={() => openRequest()}><CalendarDays size={18} aria-hidden="true" />Request Session</button>}
          {eligible && <button type="button" className="btn btn-secondary" disabled={messageBusy} onClick={openMessage}><MessageSquare size={18} aria-hidden="true" />{messageBusy ? 'Opening...' : 'Message'}</button>}
        </>}</div>
      </div>
      <WorkflowTabs id="public-profile" tabs={[["about", "About"], ["subjects", "Subjects"], ["reviews", "Reviews"], ["availability", "Availability"]]} active={section} onChange={value => { const next = new URLSearchParams(params); next.set('section', value); setParams(next); }} />
    </section>
    <section role="tabpanel" id="public-profile-panel-about" aria-labelledby="public-profile-tab-about" hidden={section !== 'about'} className="public-profile-about">
      <article className="card"><h2>About {tutor.name?.split(' ')[0]}</h2><p className="public-profile-bio">{tutor.bio || 'This student has not shared a biography yet.'}</p>
        <h3>Also learning</h3><div className="public-profile-skills">{(tutor.skillsToLearn || []).map(skill => <span className="badge badge-navy" key={skill}>{skill}</span>)}{!tutor.skillsToLearn?.length && <p className="form-hint">No learning subjects listed.</p>}</div>
      </article>
      <aside className="card public-profile-details"><h2>Profile details</h2><dl>
        {tutor.university && <><dt><GraduationCap size={18} aria-hidden="true" />University</dt><dd>{tutor.university}</dd></>}
        {tutor.yearLevel && <><dt><BookOpen size={18} aria-hidden="true" />Year level</dt><dd>{tutor.yearLevel}</dd></>}
        {tutor.languages?.length > 0 && <><dt><Languages size={18} aria-hidden="true" />Languages</dt><dd>{tutor.languages.join(', ')}</dd></>}
      </dl>{!tutor.university && !tutor.yearLevel && !tutor.languages?.length && <p>No optional academic details shared.</p>}<p className="form-hint">Students choose which optional details to share. Teaching subjects are self-listed.</p></aside>
    </section>
    <section role="tabpanel" id="public-profile-panel-subjects" aria-labelledby="public-profile-tab-subjects" hidden={section !== 'subjects'} className="card">
      <h2>Teaching subjects</h2><p>Subjects this student offers to teach. A listing is not an Acadova certification.</p><ul className="public-subject-list">{(tutor.skillsToTeach || []).map(skill => <li key={skill}><BookOpen size={20} aria-hidden="true" /><strong>{skill}</strong></li>)}</ul>{!tutor.skillsToTeach?.length && <p>No teaching subjects listed. Session requests are unavailable for this student.</p>}
    </section>
    <section role="tabpanel" id="public-profile-panel-reviews" aria-labelledby="public-profile-tab-reviews" hidden={section !== 'reviews'} className="card peer-reviews">
      <h2 id="peer-reviews-heading">Peer reviews</h2>{reviewsLoading ? <LoadingSpinner text="Loading reviews..." /> : reviewError ? <Alert type="danger" message={reviewError} /> : reviews.length === 0 ? <p>No visible reviews yet.</p> : reviews.map(review => <article key={review.id}><strong>{review.reviewerName}</strong><span> · {review.rating} out of 5</span>{review.comment && <p>{review.comment}</p>}</article>)}{reviews.length === 20 && <p className="form-hint">Showing the latest 20 visible reviews.</p>}
    </section>
    <section role="tabpanel" id="public-profile-panel-availability" aria-labelledby="public-profile-tab-availability" hidden={section !== 'availability'} className="card"><h2>Availability</h2><AvailabilityGuidance availability={tutor.weeklyAvailability} /><p>Propose a future online session. Usual availability is guidance, not a reservation; the tutor must accept your request.</p></section>
    {freeLearning&&freeRequestOpen&&canRequest&&<FreeSessionRequest key={id} tutor={tutor} close={()=>setFreeRequestOpen(false)}/>}
    {canRequest && !freeLearning && (
        <div className="card" id="request-session">
          <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-900)', marginBottom: '14px' }}>
            Request a Study Session
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--ink-600)', marginBottom: '20px' }}>
            Request an online peer tutoring session with {tutor.name}. Credits transfer after both participants confirm a verified session, or after a valid Moderator resolution.
          </p>

          {requestedSession ? <div className="session-request-success" role="status"><h2>Session request sent</h2><p>{tutor.name} will receive your request and proposed schedule.</p><Link className="btn btn-primary" to={`/sessions/${requestedSession._id || requestedSession.id}`}>View requested session</Link></div> : <form onSubmit={handleRequestSession} aria-busy={submitting}>
            <Alert type="danger" message={requestError} onClose={() => setRequestError('')} />
            <div className="form-group">
              <label className="form-label" htmlFor="subject">Subject / Topic</label>
              <select
                id="subject"
                className="form-input"
                value={sessionSubject}
              onChange={(e) => setSessionSubject(e.target.value)}
              aria-invalid={Boolean(fieldErrors.subject)}
              aria-describedby={`subject-help${fieldErrors.subject ? ' subject-error' : ''}`}
              disabled={!tutor.skillsToTeach?.length || submitting}
              required
              >
                <option value="" disabled hidden>Choose a teaching subject</option>
                {(tutor.skillsToTeach || []).map((skill, index) => <option key={`${skill}-${index}`} value={skill}>{skill}</option>)}
              </select>
              <span className="form-hint" id="subject-help">{tutor.skillsToTeach?.length ? 'Choose a subject this peer currently teaches.' : 'This peer has not listed teaching subjects yet. Find another peer or ask them to update their Profile.'}</span>
              {fieldErrors.subject && <span className="form-error" id="subject-error">{fieldErrors.subject}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="scheduledAt">Preferred Date & Time</label>
              <input
                id="scheduledAt"
                type="datetime-local"
                min={minimumLocalDateTime()}
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

            <AvailabilityGuidance availability={tutor?.weeklyAvailability} selected={scheduledAt} />
            <p className="form-hint">Online session. The Tutor will add an HTTPS meeting link after accepting.</p>

            <div className="form-group">
              <label className="form-label" htmlFor="requestMessage">Message to Tutor (Optional)</label>
              <textarea
                id="requestMessage"
                className="form-textarea"
                rows={3}
                maxLength={500}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Tell your peer what you would like help with."
                aria-invalid={Boolean(fieldErrors.requestMessage)} aria-describedby="profile-request-message-help"
              />
              <span id="profile-request-message-help" className="form-hint">Example: I need help with Java arrays. {500 - requestMessage.length} characters remaining</span>
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
              disabled={submitting || sessionCost === null || !canRequest}
              aria-busy={submitting}
            >
              {submitting ? 'Sending Request...' : 'Send Session Request'}
            </button>
          </form>}
        </div>
    )}
    {!isSelf && !canRequest && <p className="form-hint">{!tutor.skillsToTeach?.length ? 'This student has not listed any teaching subjects.' : 'Session requests require an eligible Student account.'}</p>}
  </div>;
};

export default TutorProfilePage;
