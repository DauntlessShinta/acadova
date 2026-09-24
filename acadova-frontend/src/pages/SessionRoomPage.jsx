import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { createRefreshGate } from '../utils/refreshGate';
import {
  formatSessionDateTime,
  getSessionNextStep,
  getSessionPerspective,
  getSessionStatus,
} from '../utils/sessionPresentation';

const idOf = (value) => String(value?._id || value?.id || value || '');

export const SessionRoomPage = () => {
  const { id } = useParams();
  return <SessionRoom key={id} id={id} />;
};

const SessionRoom = ({ id }) => {
  const { user, refreshUser } = useAuth();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [meetingValue, setMeetingValue] = useState('');
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const gate = useRef(createRefreshGate());
  const actionInProgress = useRef(false);
  const meetingDirty = useRef(false);
  const lastSettlement = useRef(null);

  const refreshRoom = useCallback(async ({ showLoading = false } = {}) => {
    if (actionInProgress.current) return;
    const ticket = gate.current.start();
    if (ticket === null) return;
    setRefreshing(true);
    if (showLoading) setLoading(true);
    try {
      const response = await sessionService.getSession(id);
      if (!gate.current.isCurrent(ticket)) return;
      const latest = response.data;
      setSession(latest);
      setRatingSubmitted(Boolean(latest.myReview));
      if (!meetingDirty.current) {
        setMeetingValue(latest.meetingMethod === 'online' ? latest.meetingLink || '' : latest.location || '');
      }
      if (latest.creditsSettledAt && latest.creditsSettledAt !== lastSettlement.current) {
        lastSettlement.current = latest.creditsSettledAt;
        void refreshUser();
      }
      if (['accepted', 'completed'].includes(latest.status)) {
        const messageResponse = await sessionService.getMessages(id);
        if (!gate.current.isCurrent(ticket)) return;
        setMessages(messageResponse.data || []);
      } else {
        setMessages([]);
      }
      setRefreshError('');
    } catch (err) {
      if (gate.current.isCurrent(ticket)) setRefreshError(err.message || 'Session refresh failed. Try Refresh session.');
    } finally {
      if (gate.current.isCurrent(ticket)) {
        gate.current.finish(ticket);
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [id, refreshUser]);

  useEffect(() => {
    let active = true;
    const refreshVisibleRoom = () => {
      if (document.visibilityState === 'visible') void refreshRoom();
    };
    Promise.resolve().then(() => { if (active) void refreshRoom({ showLoading: true }); });
    const intervalId = window.setInterval(refreshVisibleRoom, 5000);
    window.addEventListener('focus', refreshVisibleRoom);
    document.addEventListener('visibilitychange', refreshVisibleRoom);
    const refreshGate = gate.current;
    return () => {
      active = false;
      refreshGate.invalidate();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshVisibleRoom);
      document.removeEventListener('visibilitychange', refreshVisibleRoom);
    };
  }, [refreshRoom]);

  const messagesAvailable = ['accepted', 'completed'].includes(session?.status);

  const beginAction = () => {
    if (actionInProgress.current) return false;
    actionInProgress.current = true;
    gate.current.invalidate();
    setRefreshing(false);
    setActionLoading(true);
    setError('');
    return true;
  };

  const finishAction = () => {
    actionInProgress.current = false;
    setActionLoading(false);
    void refreshRoom();
  };

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
    if (!beginAction()) return;
    try {
      const response = await sessionService.updateSessionStatus(id, status);
      setSession(response.data);
      setSuccess(response.message);
    } catch (err) {
      setError(err.message || 'The session could not be updated.');
    } finally {
      finishAction();
    }
  };

  const handleCoordinationSave = async (event) => {
    event.preventDefault();
    if (!beginAction()) return;
    try {
      const field = session.meetingMethod === 'online' ? 'meetingLink' : 'location';
      const response = await sessionService.updateCoordination(id, { [field]: meetingValue });
      setSession(response.data);
      meetingDirty.current = false;
      setMeetingValue(response.data.meetingMethod === 'online' ? response.data.meetingLink || '' : response.data.location || '');
      setSuccess(response.message);
    } catch (err) {
      setError(err.message || 'Meeting details could not be saved.');
    } finally {
      finishAction();
    }
  };

  const handleConfirm = async () => {
    const credits = `${session.creditAmount} credit${session.creditAmount === 1 ? '' : 's'}`;
    if (!window.confirm(`Confirm that this session was completed and transfer ${credits} to ${session.tutor?.name || 'the Tutor'}?`)) return;
    if (!beginAction()) return;
    try {
      const response = await sessionService.confirmSession(id);
      setSession(response.data);
      setSuccess(response.message);
      await refreshUser();
    } catch (err) {
      setError(err.message || 'Session confirmation could not be completed.');
    } finally {
      finishAction();
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!messageBody.trim()) {
      setError('Enter a message before sending.');
      return;
    }
    if (!beginAction()) return;
    try {
      const response = await sessionService.sendMessage(id, messageBody);
      setMessages((current) => current.some((item) => item._id === response.data._id)
        ? current
        : [...current, response.data]);
      setMessageBody('');
      setSuccess('Message sent.');
    } catch (err) {
      setError(err.message || 'Message could not be sent.');
    } finally {
      finishAction();
    }
  };

  const handleRating = async (event) => {
    event.preventDefault();
    if (!beginAction()) return;
    try {
      await ratingService.submitRating({ sessionId: id, rating: ratingStars, comment: ratingComment });
      setRatingSubmitted(true);
      setSuccess('Your peer rating and feedback were submitted.');
      await refreshUser();
    } catch (err) {
      setError(err.message || 'The rating could not be submitted.');
    } finally {
      finishAction();
    }
  };

  if (loading) return <LoadingSpinner text="Loading Session Room..." size={36} />;
  if (!session) {
    return (
      <div className="session-room-page">
        <Link to="/sessions" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /> Back to Sessions</Link>
        <Alert type="danger" message={refreshError || error || 'Session could not be loaded.'} />
        <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={() => refreshRoom({ showLoading: true })}>Retry</button>
      </div>
    );
  }

  const scheduledLabel = formatSessionDateTime(session.scheduledAt);
  const meetingMethodLabel = session.meetingMethod === 'online'
    ? 'Online'
    : session.meetingMethod === 'in-person' ? 'In person' : 'Not recorded';
  const creditLabel = `${session.creditAmount} credit${session.creditAmount === 1 ? '' : 's'}`;
  const acceptedReached = ['accepted', 'completed'].includes(session.status);
  const completedReached = session.status === 'completed';
  const isClosed = ['cancelled', 'rejected'].includes(session.status);
  const hasSecondaryActions = ['pending', 'accepted'].includes(session.status)
    || (isTeaching && session.status === 'completed' && !session.confirmedAt);

  return (
    <div className="session-room-page">
      <Link to="/sessions" className="session-room-back"><ArrowLeft size={15} /> Back to Sessions</Link>

      <header className="session-room-header">
        <span className="student-eyebrow">Session room</span>
        <div className="session-room-title-row">
          <h1>{session.subject}</h1>
          <span className="session-room-status" aria-label={`Session status: ${displayStatus.label}`}>
            <Badge status={displayStatus.key}>{displayStatus.label}</Badge>
          </span>
        </div>
        <div className="session-room-identity">
          <span className={`session-role-badge ${isTeaching ? 'is-teaching' : 'is-learning'}`}>
            {perspective.label}
          </span>
          <span>with <strong>{counterpart?.name || 'Peer student'}</strong></span>
        </div>
        <ul className="session-room-summary" aria-label="Session summary">
          <li><Calendar size={16} aria-hidden="true" /><time dateTime={session.scheduledAt}>{scheduledLabel || 'Not scheduled'}</time></li>
          <li><MapPin size={16} aria-hidden="true" /><span>{meetingMethodLabel}</span></li>
          <li><Coins size={16} aria-hidden="true" /><span>{creditLabel}</span></li>
        </ul>
      </header>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="danger" message={refreshError} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <section className={`session-next-step ${session.confirmedAt ? 'is-complete' : isClosed ? 'is-closed' : ''}`} aria-labelledby="next-step-heading">
        <CheckCircle2 size={19} aria-hidden="true" />
        <div>
          <span>Next step</span>
          <h2 id="next-step-heading">{nextStep}</h2>
          {session.status === 'pending' && !isTeaching && <p>No action is required from you right now.</p>}
          {session.confirmedAt && <p>{creditLabel} transferred.</p>}
        </div>
        {isTeaching && session.status === 'pending' && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={() => runStatusAction('accepted')}>Accept request</button>}
        {isTeaching && session.status === 'accepted' && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={() => runStatusAction('completed')}>Complete session</button>}
        {!isTeaching && session.status === 'completed' && !session.confirmedAt && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={handleConfirm}>Confirm completion and transfer {creditLabel}</button>}
      </section>

      <div className="session-room-layout">
        <main className="session-room-main">
          <section className="card session-room-section session-details-panel" aria-labelledby="details-heading">
            <h2 id="details-heading">Session details</h2>
            <dl className="session-details-grid">
              <div><dt><UserRound size={16} /> Other participant</dt><dd>{counterpart?.name || 'Peer student'}</dd></div>
              <div><dt><Calendar size={16} /> Date and time</dt><dd>{scheduledLabel || 'Not scheduled'}</dd></div>
              <div><dt><MapPin size={16} /> Method</dt><dd>{meetingMethodLabel}</dd></div>
              <div><dt><Coins size={16} /> Credits</dt><dd>{creditLabel} transferred after confirmation</dd></div>
            </dl>

            <div className="session-request-message">
              <h3>Request message</h3>
              <blockquote>{session.requestMessage || 'No request message was recorded for this older session.'}</blockquote>
            </div>

            {session.meetingMethod === 'online' && session.meetingLink && (
              <div className="session-meeting-result">
                <span>Meeting link</span>
                <a href={session.meetingLink} target="_blank" rel="noreferrer">Open secure meeting link <ExternalLink size={14} /></a>
              </div>
            )}
            {session.meetingMethod === 'in-person' && session.location && (
              <div className="session-meeting-result"><span>Meeting location</span><strong>{session.location}</strong></div>
            )}

            {!['online', 'in-person'].includes(session.meetingMethod) && (
              <p className="session-muted-copy">This older session has no recorded meeting method. Use a new request for the current coordination workflow; this record is unchanged.</p>
            )}
            {isTeaching && session.status === 'accepted' && ['online', 'in-person'].includes(session.meetingMethod) && (
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
                    disabled={actionLoading}
                    placeholder={session.meetingMethod === 'online' ? 'https://meet.example.com/...' : 'University Library – Study Area 2'}
                    onChange={(event) => { meetingDirty.current = true; setMeetingValue(event.target.value); }}
                  />
                  <button type="submit" className="btn btn-secondary" disabled={actionLoading}>Save details</button>
                </div>
                <span className="form-hint">The Tutor owns these practical meeting details to avoid conflicting edits.</span>
              </form>
            )}
          </section>

          <section className={`card session-room-section session-messages-panel ${messagesAvailable ? '' : 'is-unavailable'}`} aria-labelledby="messages-heading">
            <div className="session-section-heading">
              <div>
                <MessageSquare size={18} aria-hidden="true" />
                <div><h2 id="messages-heading">Messages</h2>{messagesAvailable && <p>Coordinate the details of your session.</p>}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Refresh session" onClick={() => refreshRoom()} disabled={refreshing || actionLoading}>
                <RefreshCw size={14} /> {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <p className="session-refresh-note">Updates automatically every 5 seconds while this page is visible.</p>
            {!messagesAvailable ? (
              <p className="session-muted-copy">Messages become available after the Tutor accepts this session.</p>
            ) : refreshing && messages.length === 0 ? (
              <LoadingSpinner text="Loading session messages..." size={28} />
            ) : (
              <>
                <div className="session-messages" aria-live="polite">
                  {messages.length === 0 && !refreshError && <p className="session-muted-copy">No messages yet. Start with the detail your peer needs most.</p>}
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

          {ratingSubmitted && <Alert type="success" message="Your review for this session has been submitted." />}
          {session.confirmedAt && session.creditsSettledAt && !ratingSubmitted && (
            <section className="card session-room-section session-review-panel" aria-labelledby="review-heading">
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
          <section className="card session-room-section session-progress-panel" aria-labelledby="progress-heading">
            <h2 id="progress-heading">Session progress</h2>
            <ol className="session-progress">
              <li className={session.status === 'pending' ? 'is-current' : 'is-done'} aria-current={session.status === 'pending' ? 'step' : undefined}><span>{session.status === 'pending' ? '1' : <Check size={14} />}</span><div><strong>Requested</strong><small>Session details proposed</small></div></li>
              <li className={session.status === 'accepted' ? 'is-current' : acceptedReached ? 'is-done' : isClosed ? 'is-stopped' : ''} aria-current={session.status === 'accepted' ? 'step' : undefined}><span>{acceptedReached && session.status !== 'accepted' ? <Check size={14} /> : '2'}</span><div><strong>Accepted</strong><small>{acceptedReached ? 'Tutor accepted' : 'Waiting for Tutor'}</small></div></li>
              <li className={completedReached ? 'is-done' : ''}><span>{completedReached ? <Check size={14} /> : '3'}</span><div><strong>Session completed</strong><small>Tutor marks it finished</small></div></li>
              <li className={session.confirmedAt ? 'is-done' : completedReached ? 'is-current' : ''} aria-current={!session.confirmedAt && completedReached ? 'step' : undefined}><span>{session.confirmedAt ? <Check size={14} /> : '4'}</span><div><strong>Confirmed</strong><small>Learner releases credits</small></div></li>
            </ol>
          </section>

          {hasSecondaryActions && !isClosed && (
            <section className="card session-room-section session-actions-panel" aria-labelledby="actions-heading">
              <h2 id="actions-heading">Actions</h2>
              {isTeaching && session.status === 'pending' && <button className="btn btn-ghost session-destructive-action" type="button" disabled={actionLoading} onClick={() => runStatusAction('rejected')}>Decline request</button>}
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
