import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  ExternalLink,
  MapPin,
  MessageSquare,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import ratingService from '../services/ratingService';
import Alert from '../components/common/Alert';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StarRating from '../components/common/StarRating';
import {
  formatSessionDateTime,
  getSessionNextStep,
  getSessionPerspective,
  getSessionStatus,
} from '../utils/sessionPresentation';

const idOf = (value) => String(value?._id || value?.id || value || '');

export const SessionRoomPage = () => {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [meetingValue, setMeetingValue] = useState('');
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const loadSession = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const response = await sessionService.getSession(id);
      setSession(response.data);
      setMeetingValue(response.data.meetingMethod === 'online'
        ? response.data.meetingLink || ''
        : response.data.location || '');
    } catch (err) {
      setError(err.message || 'Session could not be loaded.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  const loadMessages = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setMessagesLoading(true);
    try {
      const response = await sessionService.getMessages(id);
      setMessages(response.data || []);
    } catch (err) {
      setError(err.message || 'Session messages could not be loaded.');
    } finally {
      if (showLoading) setMessagesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    Promise.resolve().then(() => loadSession({ showLoading: true }));
  }, [loadSession]);

  const messagesAvailable = ['accepted', 'completed'].includes(session?.status);

  useEffect(() => {
    if (!messagesAvailable) return undefined;
    Promise.resolve().then(() => loadMessages({ showLoading: true }));
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages();
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [loadMessages, messagesAvailable]);

  const perspective = useMemo(() => (
    session ? getSessionPerspective(session, user) : null
  ), [session, user]);
  const isTeaching = perspective?.isTeaching;
  const counterpart = perspective?.counterpart;
  const displayStatus = session ? getSessionStatus(session) : null;
  const nextStep = session
    ? getSessionNextStep(session, isTeaching, counterpart?.name || 'your peer')
    : '';

  const runStatusAction = async (status) => {
    const prompts = {
      rejected: 'Decline this session request? The learner will need to find another peer.',
      cancelled: 'Cancel this session? Both participants will lose access to active coordination.',
      completed: `Mark this ${session.subject} session as finished?\n\n${session.learner?.name || 'The learner'} will be asked to confirm before credits are transferred.`,
    };
    if (prompts[status] && !window.confirm(prompts[status])) return;
    try {
      setActionLoading(true);
      setError('');
      const response = await sessionService.updateSessionStatus(id, status);
      setSession(response.data);
      setSuccess(response.message);
    } catch (err) {
      setError(err.message || 'The session could not be updated.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCoordinationSave = async (event) => {
    event.preventDefault();
    try {
      setActionLoading(true);
      setError('');
      const field = session.meetingMethod === 'online' ? 'meetingLink' : 'location';
      const response = await sessionService.updateCoordination(id, { [field]: meetingValue });
      setSession(response.data);
      setSuccess(response.message);
    } catch (err) {
      setError(err.message || 'Meeting details could not be saved.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    const credits = `${session.creditAmount} credit${session.creditAmount === 1 ? '' : 's'}`;
    if (!window.confirm(`Confirm that this session was completed and transfer ${credits} to ${session.tutor?.name || 'the Tutor'}?`)) return;
    try {
      setActionLoading(true);
      setError('');
      const response = await sessionService.confirmSession(id);
      setSession(response.data);
      setSuccess(response.message);
      await refreshUser();
    } catch (err) {
      setError(err.message || 'Session confirmation could not be completed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!messageBody.trim()) {
      setError('Enter a message before sending.');
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      const response = await sessionService.sendMessage(id, messageBody);
      setMessages((current) => current.some((item) => item._id === response.data._id)
        ? current
        : [...current, response.data]);
      setMessageBody('');
      setSuccess('Message sent.');
      await loadMessages();
    } catch (err) {
      setError(err.message || 'Message could not be sent.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRating = async (event) => {
    event.preventDefault();
    try {
      setActionLoading(true);
      setError('');
      await ratingService.submitRating({ sessionId: id, rating: ratingStars, comment: ratingComment });
      setRatingSubmitted(true);
      setSuccess('Your peer rating and feedback were submitted.');
      await refreshUser();
    } catch (err) {
      setError(err.message || 'The rating could not be submitted.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Session Room..." size={36} />;
  if (!session) {
    return (
      <div className="session-room-page">
        <Link to="/sessions" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /> Back to Sessions</Link>
        <Alert type="danger" message={error || 'Session could not be loaded.'} />
      </div>
    );
  }

  const scheduledLabel = formatSessionDateTime(session.scheduledAt);
  const acceptedReached = ['accepted', 'completed'].includes(session.status);
  const completedReached = session.status === 'completed';
  const isClosed = ['cancelled', 'rejected'].includes(session.status);

  return (
    <div className="session-room-page">
      <Link to="/sessions" className="session-room-back"><ArrowLeft size={15} /> Back to Sessions</Link>

      <header className="session-room-header">
        <div>
          <span className="student-eyebrow">Session room</span>
          <h1>{session.subject}</h1>
          <div className="session-room-identity">
            <span className={`session-role-badge ${isTeaching ? 'is-teaching' : 'is-learning'}`}>
              {perspective.label}
            </span>
            <span>with <strong>{counterpart?.name || 'Peer student'}</strong></span>
          </div>
        </div>
        <Badge status={displayStatus.key}>{displayStatus.label}</Badge>
      </header>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <section className="session-next-step" aria-labelledby="next-step-heading">
        <div><CheckCircle2 size={22} aria-hidden="true" /></div>
        <div><span>Next step</span><h2 id="next-step-heading">{nextStep}</h2></div>
      </section>

      <div className="session-room-layout">
        <main className="session-room-main">
          <section className="card session-room-section" aria-labelledby="details-heading">
            <h2 id="details-heading">Session details</h2>
            <dl className="session-details-grid">
              <div><dt><Calendar size={16} /> Date and time</dt><dd>{scheduledLabel || 'Not scheduled'}</dd></div>
              <div><dt><MapPin size={16} /> Method</dt><dd>{session.meetingMethod === 'online' ? 'Online' : session.meetingMethod === 'in-person' ? 'In person' : 'Not recorded'}</dd></div>
              <div><dt><UserRound size={16} /> Other participant</dt><dd>{counterpart?.name || 'Peer student'}</dd></div>
              <div><dt><Coins size={16} /> Credits</dt><dd>{session.creditAmount} credit{session.creditAmount === 1 ? '' : 's'} transferred after confirmation</dd></div>
            </dl>

            {session.meetingMethod === 'online' && session.meetingLink && (
              <div className="session-meeting-result">
                <span>Meeting link</span>
                <a href={session.meetingLink} target="_blank" rel="noreferrer">Open secure meeting link <ExternalLink size={14} /></a>
              </div>
            )}
            {session.meetingMethod === 'in-person' && session.location && (
              <div className="session-meeting-result"><span>Meeting location</span><strong>{session.location}</strong></div>
            )}

            {isTeaching && session.status === 'accepted' && (
              <form className="coordination-form" onSubmit={handleCoordinationSave}>
                <label className="form-label" htmlFor="meeting-detail">
                  {session.meetingMethod === 'online' ? 'HTTPS meeting link' : 'Meeting location'}
                </label>
                <div>
                  <input
                    id="meeting-detail"
                    type={session.meetingMethod === 'online' ? 'url' : 'text'}
                    className="form-input"
                    value={meetingValue}
                    maxLength={session.meetingMethod === 'online' ? 500 : 300}
                    required
                    placeholder={session.meetingMethod === 'online' ? 'https://meet.example.com/...' : 'University Library – Study Area 2'}
                    onChange={(event) => setMeetingValue(event.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary" disabled={actionLoading}>Save details</button>
                </div>
                <span className="form-hint">The Tutor owns these practical meeting details to avoid conflicting edits.</span>
              </form>
            )}
          </section>

          <section className="card session-room-section" aria-labelledby="request-heading">
            <h2 id="request-heading">Request message</h2>
            <blockquote>{session.requestMessage || 'No request message was recorded for this older session.'}</blockquote>
          </section>

          <section className="card session-room-section" aria-labelledby="messages-heading">
            <div className="session-section-heading">
              <div><MessageSquare size={18} /><h2 id="messages-heading">Session messages</h2></div>
              {messagesAvailable && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadMessages({ showLoading: true })} disabled={messagesLoading}>
                  <RefreshCw size={14} /> Refresh
                </button>
              )}
            </div>
            {!messagesAvailable ? (
              <p className="session-muted-copy">Messages become available after the Tutor accepts this session.</p>
            ) : messagesLoading && messages.length === 0 ? (
              <LoadingSpinner text="Loading session messages..." size={28} />
            ) : (
              <>
                <div className="session-messages" aria-live="polite">
                  {messages.length === 0 && <p className="session-muted-copy">No messages yet. Start with the detail your peer needs most.</p>}
                  {messages.map((message) => {
                    const isMine = idOf(message.sender) === idOf(user);
                    return (
                      <article key={message._id} className={`session-message ${isMine ? 'is-mine' : 'is-theirs'}`}>
                        <div><strong>{isMine ? 'You' : message.sender?.name || 'Other participant'}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></div>
                        <p>{message.body}</p>
                      </article>
                    );
                  })}
                </div>
                <form className="message-composer" onSubmit={handleSendMessage}>
                  <label className="form-label" htmlFor="session-message">Message</label>
                  <textarea
                    id="session-message"
                    className="form-textarea"
                    rows={3}
                    maxLength={1000}
                    value={messageBody}
                    placeholder="Share a meeting detail or study note..."
                    onChange={(event) => setMessageBody(event.target.value)}
                  />
                  <div><span className="form-hint">{1000 - messageBody.length} characters remaining</span><button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}><Send size={14} /> Send message</button></div>
                </form>
              </>
            )}
          </section>

          {session.confirmedAt && !ratingSubmitted && (
            <section className="card session-room-section" aria-labelledby="review-heading">
              <h2 id="review-heading">Review your peer</h2>
              <form onSubmit={handleRating}>
                <div className="form-group rating-form-stars"><label className="form-label">Star rating</label><StarRating rating={ratingStars} readOnly={false} size={28} onChange={setRatingStars} /><span>{ratingStars} out of 5</span></div>
                <div className="form-group"><label className="form-label" htmlFor="rating-comment">Constructive feedback (optional)</label><textarea id="rating-comment" className="form-textarea" rows={3} maxLength={500} value={ratingComment} onChange={(event) => setRatingComment(event.target.value)} /></div>
                <button className="btn btn-primary btn-sm" type="submit" disabled={actionLoading}>Submit review</button>
              </form>
            </section>
          )}
        </main>

        <aside className="session-room-sidebar">
          <section className="card session-room-section" aria-labelledby="progress-heading">
            <h2 id="progress-heading">Session progress</h2>
            <ol className="session-progress">
              <li className="is-done"><span><Check size={14} /></span><div><strong>Requested</strong><small>Session details proposed</small></div></li>
              <li className={acceptedReached ? 'is-done' : isClosed ? 'is-stopped' : 'is-current'}><span>{acceptedReached ? <Check size={14} /> : '2'}</span><div><strong>Accepted</strong><small>{acceptedReached ? 'Tutor accepted' : 'Waiting for Tutor'}</small></div></li>
              <li className={completedReached ? 'is-done' : acceptedReached ? 'is-current' : ''}><span>{completedReached ? <Check size={14} /> : '3'}</span><div><strong>Session completed</strong><small>Tutor marks it finished</small></div></li>
              <li className={session.confirmedAt ? 'is-done' : completedReached ? 'is-current' : ''}><span>{session.confirmedAt ? <Check size={14} /> : '4'}</span><div><strong>Confirmed</strong><small>Learner releases credits</small></div></li>
            </ol>
          </section>

          {!isClosed && !session.confirmedAt && (
            <section className="card session-room-section session-actions-panel" aria-labelledby="actions-heading">
              <h2 id="actions-heading">Available actions</h2>
              {isTeaching && session.status === 'pending' && <><button className="btn btn-primary" type="button" disabled={actionLoading} onClick={() => runStatusAction('accepted')}>Accept request</button><button className="btn btn-danger" type="button" disabled={actionLoading} onClick={() => runStatusAction('rejected')}>Decline request</button></>}
              {isTeaching && session.status === 'accepted' && <button className="btn btn-navy" type="button" disabled={actionLoading} onClick={() => runStatusAction('completed')}>Complete session</button>}
              {!isTeaching && session.status === 'completed' && <button className="btn btn-primary" type="button" disabled={actionLoading} onClick={handleConfirm}>Confirm completion and transfer {session.creditAmount} credit{session.creditAmount === 1 ? '' : 's'}</button>}
              {isTeaching && session.status === 'completed' && <p>Waiting for learner confirmation. No credits have transferred yet.</p>}
              {(session.status === 'pending' || session.status === 'accepted') && <button className="btn btn-ghost session-cancel-action" type="button" disabled={actionLoading} onClick={() => runStatusAction('cancelled')}>Cancel session</button>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

export default SessionRoomPage;
