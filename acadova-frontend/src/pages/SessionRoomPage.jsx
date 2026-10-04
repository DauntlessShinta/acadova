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
import { loadGoogleCalendarAuthorization, requestGoogleCalendarAccess } from '../services/googleCalendarAuthorization';
import { useToast } from '../context/toastAccess';
import { isGoogleClientConfigured, googleMeetHome } from '../utils/googleConfig';
import { mergeSessionMessages } from '../utils/sessionMessages';
import {
  formatSessionDateTime,
  getSessionNextStep,
  getSessionPerspective,
  getSessionStatus,
  getSessionTimeline,
} from '../utils/sessionPresentation';

const idOf = (value) => String(value?._id || value?.id || value || '');

export const SessionRoomPage = () => {
  const { id } = useParams();
  return <SessionRoom key={id} id={id} />;
};

const SessionRoom = ({ id }) => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [clockNow, setClockNow] = useState(null);
  const [messageBody, setMessageBody] = useState('');
  const [messageError, setMessageError] = useState('');
  const [meetingValue, setMeetingValue] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [proposedTime, setProposedTime] = useState('');
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const gate = useRef(createRefreshGate());
  const actionInProgress = useRef(false);
  const meetingDirty = useRef(false);
  const lastSettlement = useRef(null);
  const roomLoaded = useRef(false);
  const messagesRef = useRef(null);
  const followMessages = useRef(true);
  const googleConfigured = isGoogleClientConfigured(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  const refreshRoom = useCallback(async ({ showLoading = false } = {}) => {
    if (actionInProgress.current) return;
    const ticket = gate.current.start();
    if (ticket === null) return;
    setRefreshing(true);
    if (showLoading && !roomLoaded.current) setLoading(true);
    try {
      const response = await sessionService.getSession(id);
      if (!gate.current.isCurrent(ticket)) return;
      const latest = response.data;
      roomLoaded.current = true;
      setClockNow(Date.now());
      setSession(latest);
      setRatingSubmitted(Boolean(latest.myReview));
      if (!meetingDirty.current) {
        setMeetingValue(latest.meetingMethod === 'online' ? latest.meetingLink || '' : latest.location || '');
      }
      if (latest.creditsSettledAt && latest.creditsSettledAt !== lastSettlement.current) {
        lastSettlement.current = latest.creditsSettledAt;
        void refreshUser();
      }
      if (latest.canonicalStatus == null && ['accepted', 'scheduled', 'in_progress', 'awaiting_validation', 'completed'].includes(latest.status)) {
        const messageResponse = await sessionService.getMessages(id);
        if (!gate.current.isCurrent(ticket)) return;
        setMessages((current) => mergeSessionMessages(current, messageResponse.data || []));
        setMessagesLoaded(true);
      } else {
        setMessages([]);
        setMessagesLoaded(true);
      }
      setRefreshError('');
    } catch {
      if (gate.current.isCurrent(ticket)) {
        setRefreshError('Session updates are temporarily unavailable. Try Refresh.');
        if (roomLoaded.current) setMessagesLoaded(true);
      }
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

  useEffect(() => {
    let active = true;
    if (!googleConfigured) return undefined;
    loadGoogleCalendarAuthorization().then(() => { if (active) setGoogleReady(true); })
      .catch(() => { if (active) setGoogleReady(false); });
    return () => { active = false; };
  }, [googleConfigured]);

  useEffect(() => {
    const list = messagesRef.current;
    if (list && followMessages.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  // The current API supports actions only for its legacy response contract.
  const usesLegacyActions = session?.canonicalStatus == null;
  const messagesAvailable = usesLegacyActions && ['accepted', 'scheduled', 'in_progress', 'awaiting_validation', 'completed'].includes(session?.status);

  const beginAction = () => {
    if (actionInProgress.current) return false;
    actionInProgress.current = true;
    gate.current.invalidate();
    setRefreshing(false);
    setActionLoading(true);
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
      declined: 'Decline this session request? The learner will need to find another peer.',
      cancelled: 'Cancel this session? Both participants will lose access to active coordination.',
      completed: `Mark this ${session.subject} session as finished?\n\n${session.learner?.name || 'The learner'} will be asked to confirm before credits are transferred.`,
    };
    if (prompts[status] && !window.confirm(prompts[status])) return;
    if (!beginAction()) return;
    try {
      const response = await sessionService.updateSessionStatus(id, status);
      setSession(response.data);
      toast('success', response.message);
    } catch (err) {
      toast('error', err.message?.toLowerCase().includes('meeting link')
        ? 'Add a meeting link before completing this session.'
        : err.message || 'The session could not be updated.');
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
      toast('success', response.message);
    } catch (err) {
      toast('error', err.message || 'Meeting details could not be saved.');
    } finally {
      finishAction();
    }
  };

  const handleGenerateMeet = async () => {
    if (!googleReady || !beginAction()) return;
    try {
      const accessToken = await requestGoogleCalendarAccess();
      const response = await sessionService.generateGoogleMeet(id, accessToken);
      setSession(response.data);
      setMeetingValue(response.data.meetingLink || '');
      meetingDirty.current = false;
      toast('success', 'Google Meet link is ready for both participants.');
    } catch {
      toast('error', "Couldn't create a Google Meet link. You can paste a meeting link manually.");
    } finally { finishAction(); }
  };

  const handleRescheduleProposal = async (event) => {
    event.preventDefault();
    if (!beginAction()) return;
    try {
      const response = await sessionService.proposeReschedule(id, proposedTime);
      setSession(response.data);
      setProposedTime('');
      toast('success', response.message);
    } catch (err) {
      toast('error', err.message || 'The new time could not be proposed.');
    } finally {
      finishAction();
    }
  };

  const handleRescheduleDecision = async (accept) => {
    if (!beginAction()) return;
    try {
      const response = accept
        ? await sessionService.acceptReschedule(id, session.rescheduleProposalId)
        : await sessionService.declineReschedule(id, session.rescheduleProposalId);
      setSession(response.data);
      toast('success', response.message);
    } catch (err) {
      toast('error', err.message || 'The reschedule response could not be saved.');
    } finally {
      finishAction();
    }
  };

  const handleCheckIn = async () => {
    if (!beginAction()) return;
    try {
      const response = await sessionService.checkIn(id);
      setSession(response.data);
      toast('success', response.message);
    } catch (err) {
      toast('error', err.message || 'Check-in could not be saved.');
    } finally {
      finishAction();
    }
  };

  const handleFinishSession = async () => {
    if (!window.confirm('Finish the live session? Both participants must then confirm before credits transfer.')) return;
    if (!beginAction()) return;
    try {
      const response = await sessionService.finishSession(id);
      setSession(response.data);
      toast('success', response.message);
    } catch (err) {
      toast('error', err.message || 'The session could not be finished.');
    } finally {
      finishAction();
    }
  };

  const handleNoShow = async () => {
    if (!window.confirm('Record this session as a no-show? Check-in evidence determines who was absent. No credits will transfer.')) return;
    if (!beginAction()) return;
    try {
      const response = await sessionService.reportNoShow(id);
      setSession(response.data);
      toast('success', response.message);
    } catch (err) {
      toast('error', err.message || 'No-show could not be recorded.');
    } finally {
      finishAction();
    }
  };

  const handleDispute = async (event) => {
    event.preventDefault();
    if (!beginAction()) return;
    try {
      const response = await sessionService.disputeSession(id, disputeReason.trim());
      setSession(response.data);
      setDisputeReason('');
      toast('success', response.message);
    } catch (err) {
      toast('error', err.message || 'Dispute could not be submitted.');
    } finally {
      finishAction();
    }
  };

  const handleConfirm = async () => {
    const credits = `${session.creditAmount} credit${session.creditAmount === 1 ? '' : 's'}`;
    const prompt = session.status === 'awaiting_validation'
      ? `Confirm that the tutoring interaction happened? ${credits} transfer only after both participants confirm.`
      : `Confirm that this session was completed and transfer ${credits} to ${session.tutor?.name || 'the Tutor'}?`;
    if (!window.confirm(prompt)) return;
    if (!beginAction()) return;
    try {
      const response = await sessionService.confirmSession(id);
      setSession(response.data);
      toast('success', response.message);
      if (response.data.creditsSettledAt) await refreshUser();
    } catch (err) {
      toast('error', err.message || 'Session confirmation could not be completed.');
    } finally {
      finishAction();
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!messageBody.trim()) {
      setMessageError('Enter a message before sending.');
      return;
    }
    setMessageError('');
    if (!beginAction()) return;
    const sentBody = messageBody;
    setSendingMessage(true);
    try {
      const response = await sessionService.sendMessage(id, sentBody);
      setMessages((current) => mergeSessionMessages(current, [response.data]));
      setMessageBody((current) => current === sentBody ? '' : current);
      toast('success', 'Message sent.');
    } catch (err) {
      toast('error', err.message || 'Message could not be sent.');
    } finally {
      setSendingMessage(false);
      finishAction();
    }
  };

  const handleRating = async (event) => {
    event.preventDefault();
    if (!beginAction()) return;
    try {
      await ratingService.submitRating({ sessionId: id, rating: ratingStars, comment: ratingComment });
      setRatingSubmitted(true);
      toast('success', 'Your peer rating and feedback were submitted.');
      await refreshUser();
    } catch (err) {
      toast('error', err.message || 'The rating could not be submitted.');
    } finally {
      finishAction();
    }
  };

  if (loading) return <LoadingSpinner text="Loading Session Room..." size={36} />;
  if (!session) {
    return (
      <div className="session-room-page">
        <Link to="/sessions" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /> Back to Sessions</Link>
        <Alert type="danger" message={refreshError || 'Session could not be loaded.'} />
        <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={() => refreshRoom({ showLoading: true })}>Retry</button>
      </div>
    );
  }

  const scheduledLabel = formatSessionDateTime(session.scheduledAt);
  const checkInStateVisible = ['accepted', 'scheduled', 'in_progress'].includes(session.status);
  const agreedTime = session.scheduledAt ? new Date(session.scheduledAt).getTime() : NaN;
  const checkInOpen = Number.isFinite(agreedTime) && clockNow != null
    && clockNow >= agreedTime - 15 * 60 * 1000
    && clockNow <= agreedTime + 4 * 60 * 60 * 1000;
  const myCheckIn = isTeaching ? session.tutorCheckedInAt : session.learnerCheckedInAt;
  const peerCheckIn = isTeaching ? session.learnerCheckedInAt : session.tutorCheckedInAt;
  const checkInBlockedByProposal = Boolean(session.rescheduleProposalId || session.proposedScheduledAt);
  const canCheckIn = ['accepted', 'scheduled'].includes(session.status)
    && checkInOpen && !checkInBlockedByProposal && !myCheckIn;
  const canReportNoShow = ['accepted', 'scheduled'].includes(session.status)
    && Number.isFinite(agreedTime) && clockNow != null
    && clockNow > agreedTime + 4 * 60 * 60 * 1000 && !checkInBlockedByProposal
    && !session.startedAt && !(session.learnerCheckedInAt && session.tutorCheckedInAt);
  const canReschedule = ['accepted', 'scheduled'].includes(session.status);
  const hasRescheduleProposal = canReschedule && Boolean(session.rescheduleProposalId && session.proposedScheduledAt);
  const proposedByMe = hasRescheduleProposal && idOf(session.rescheduleProposedBy) === idOf(user);
  const proposedScheduleLabel = formatSessionDateTime(session.proposedScheduledAt);
  const meetingMethodLabel = session.meetingMethod === 'online'
    ? 'Online'
    : session.meetingMethod === 'in-person' ? 'In person' : 'Not recorded';
  const creditLabel = `${session.creditAmount} credit${session.creditAmount === 1 ? '' : 's'}`;
  const myValidation = isTeaching ? session.tutorConfirmedAt : session.learnerConfirmedAt;
  const isClosed = ['cancelled', 'declined', 'no_show', 'resolved'].includes(displayStatus.filterKey);
  const hasSecondaryActions = usesLegacyActions && (
    ['pending', 'accepted'].includes(session.status)
    || (isTeaching && session.status === 'completed' && !session.confirmedAt)
  );
  const timeline = getSessionTimeline(session);

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

      <section className={`session-next-step ${displayStatus.key === 'completed' ? 'is-complete' : isClosed ? 'is-closed' : ''}`} aria-labelledby="next-step-heading">
        <CheckCircle2 size={19} aria-hidden="true" />
        <div>
          <span>Next step</span>
          <h2 id="next-step-heading">{nextStep}</h2>
          {session.status === 'pending' && !isTeaching && <p>No action is required from you right now.</p>}
          {session.creditsSettledAt && <p>{creditLabel} transferred.</p>}
        </div>
        {usesLegacyActions && isTeaching && session.status === 'pending' && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={() => runStatusAction('scheduled')}>Accept request</button>}
        {usesLegacyActions && isTeaching && session.status === 'accepted' && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={() => runStatusAction('completed')}>Complete session</button>}
        {isTeaching && session.status === 'in_progress' && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={handleFinishSession}>Finish live session</button>}
        {session.status === 'awaiting_validation' && !myValidation && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={handleConfirm}>Confirm session</button>}
        {canReportNoShow && <button className="btn btn-secondary btn-sm" type="button" disabled={actionLoading} onClick={handleNoShow}>Report no-show</button>}
        {usesLegacyActions && !isTeaching && session.status === 'completed' && !session.confirmedAt && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={handleConfirm}>Confirm completion and transfer {creditLabel}</button>}
      </section>

      <div className="session-room-layout">
        <main className="session-room-main">
          <section className="card session-room-section session-details-panel" aria-labelledby="details-heading">
            <h2 id="details-heading">Session details</h2>
            <dl className="session-details-grid">
              <div><dt><UserRound size={16} /> Other participant</dt><dd>{counterpart?.name || 'Peer student'}</dd></div>
              <div><dt><Calendar size={16} /> Date and time</dt><dd>{scheduledLabel || 'Not scheduled'}</dd></div>
              <div><dt><MapPin size={16} /> Method</dt><dd>{meetingMethodLabel}</dd></div>
              <div><dt><Coins size={16} /> Credits</dt><dd>{usesLegacyActions ? `${creditLabel} transferred after confirmation` : creditLabel}</dd></div>
            </dl>

            <div className="session-request-message">
              <h3>Request message</h3>
              <blockquote>{session.requestMessage || 'No request message was recorded for this older session.'}</blockquote>
            </div>

            {checkInStateVisible && (
              <div className="session-check-in">
                <h3>Session check-in</h3>
                <p className="session-muted-copy">Check-in is available from 15 minutes before until 4 hours after the agreed time.</p>
                <p>Learner: {session.learnerCheckedInAt ? `Checked in ${formatSessionDateTime(session.learnerCheckedInAt)}` : 'Not checked in'}</p>
                <p>Tutor: {session.tutorCheckedInAt ? `Checked in ${formatSessionDateTime(session.tutorCheckedInAt)}` : 'Not checked in'}</p>
                {session.status === 'in_progress' ? (
                  <p><strong>In progress{session.startedAt ? ` since ${formatSessionDateTime(session.startedAt)}` : ''}.</strong></p>
                ) : myCheckIn ? (
                  <p>Waiting for {peerCheckIn ? 'the session to start' : 'your peer to check in'}.</p>
                ) : checkInBlockedByProposal ? (
                  <p>Resolve the reschedule proposal before checking in.</p>
                ) : !checkInOpen ? (
                  <p>Check-in is not available at this time.</p>
                ) : null}
                {canCheckIn && <button type="button" className="btn btn-primary btn-sm" disabled={actionLoading} onClick={handleCheckIn}>Check in</button>}
              </div>
            )}

            {session.status === 'awaiting_validation' && (
              <div className="session-validation">
                <h3>Session validation</h3>
                <p>The live interaction is finished. Credits transfer only after both participants confirm.</p>
                <p>Learner: {session.learnerConfirmedAt ? 'Confirmed' : 'Waiting for confirmation'}</p>
                <p>Tutor: {session.tutorConfirmedAt ? 'Confirmed' : 'Waiting for confirmation'}</p>
                {myValidation && <p>Thanks for confirming. Waiting for your peer.</p>}
              </div>
            )}

            {['awaiting_validation', 'no_show'].includes(session.status) && (
              <form className="session-validation" onSubmit={handleDispute}>
                <h3>Disagree or report a problem</h3>
                <p>A Moderator will review the session evidence. Opening a dispute does not transfer credits.</p>
                <label className="form-label" htmlFor="dispute-reason">Reason</label>
                <textarea id="dispute-reason" className="form-textarea" rows={3} minLength={10} maxLength={500} required value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} disabled={actionLoading} />
                <button className="btn btn-secondary btn-sm" type="submit" disabled={actionLoading}>Submit dispute</button>
              </form>
            )}

            {session.status === 'no_show' && (
              <div className="session-validation">
                <h3>No-show recorded</h3>
                <p>{session.noShowAbsent === 'both' ? 'Neither participant checked in.' : session.noShowAbsent === 'learner' ? 'The Learner did not check in.' : 'The Tutor did not check in.'} No tutoring credits were transferred.</p>
              </div>
            )}
            {session.status === 'disputed' && (
              <div className="session-validation">
                <h3>Moderator review required</h3>
                <p>Normal confirmation is paused. No credits have transferred.</p>
                <p><strong>Reason:</strong> {session.disputeReason}</p>
              </div>
            )}
            {session.status === 'resolved' && (
              <div className="session-validation">
                <h3>Dispute resolved</h3>
                <p>{session.resolution === 'confirm_session'
                  ? 'The tutoring session was confirmed by a Moderator and credits were settled.'
                  : 'The tutoring session was not validated. No credits were transferred.'}</p>
                <p><strong>Decision note:</strong> {session.resolutionNote}</p>
              </div>
            )}

            {canReschedule && (
              <div className="session-reschedule">
                <h3>Reschedule</h3>
                <p className="session-muted-copy">Current agreed time: {scheduledLabel || 'Not recorded'}. A new time takes effect only when your peer accepts it.</p>
                {hasRescheduleProposal ? (
                  <div className="session-reschedule-proposal">
                    <p><strong>Proposed time:</strong> {proposedScheduleLabel || 'Unavailable'}</p>
                    <p><strong>Proposed by:</strong> {proposedByMe ? 'You' : counterpart?.name || 'Your peer'}</p>
                    <p>{proposedByMe ? 'Waiting for your peer to respond.' : `${counterpart?.name || 'Your peer'} proposed this time. The current time remains in place until you accept.`}</p>
                    {!proposedByMe && (
                      <div className="session-reschedule-actions">
                        <button type="button" className="btn btn-primary btn-sm" disabled={actionLoading} onClick={() => handleRescheduleDecision(true)}>Accept new time</button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={actionLoading} onClick={() => handleRescheduleDecision(false)}>Decline new time</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleRescheduleProposal}>
                    <label className="form-label" htmlFor="reschedule-time">Propose a new date and time</label>
                    <div className="session-reschedule-actions">
                      <input id="reschedule-time" className="form-input" type="datetime-local" value={proposedTime} onChange={(event) => setProposedTime(event.target.value)} required disabled={actionLoading} />
                      <button type="submit" className="btn btn-secondary btn-sm" disabled={actionLoading}>Propose time</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {session.meetingMethod === 'online' && session.meetingLink && (
              <div className="session-meeting-result">
                <span>Online meeting</span>
                <a className="btn btn-primary btn-sm" href={session.meetingLink}
                  target="_blank" rel="noopener noreferrer">Join Meeting <ExternalLink size={14} /></a>
              </div>
            )}
            {session.meetingMethod === 'in-person' && session.location && (
              <div className="session-meeting-result"><span>Meeting location</span><strong>{session.location}</strong></div>
            )}

            {!['online', 'in-person'].includes(session.meetingMethod) && (
              <p className="session-muted-copy">This older session has no recorded meeting method. Use a new request for the current coordination workflow; this record is unchanged.</p>
            )}
            {isTeaching && ['accepted', 'scheduled'].includes(session.status)
              && ['online', 'in-person'].includes(session.meetingMethod) && (
              <>
              {session.meetingMethod === 'online' && <div className="session-meet-choice">
                <h3>Online meeting</h3>
                <p>Create or paste a meeting link. Google Meet, Teams, Zoom, and other safe HTTPS links are supported.</p>
                <div className="session-meet-actions">
                  {googleConfigured && googleReady && <button type="button" className="btn btn-primary btn-sm"
                    disabled={actionLoading || Boolean(session.meetingLink)}
                    onClick={handleGenerateMeet}>Generate Google Meet</button>}
                  <a className="btn btn-secondary btn-sm" href={googleMeetHome}
                    target="_blank" rel="noopener noreferrer">Open Google Meet <ExternalLink size={14} /></a>
                </div>
                <p className="form-hint">Create a meeting there, copy its link, then paste it below. You can also use another meeting service.</p>
              </div>}
              <form className="coordination-form" onSubmit={handleCoordinationSave}>
                <label className="form-label" htmlFor="meeting-detail">
                  {session.meetingMethod === 'online' ? 'Paste meeting link (Google Meet, Teams, Zoom, or HTTPS)' : 'Meeting location'}
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
                  <button type="submit" className="btn btn-secondary" disabled={actionLoading}>{session.meetingMethod === 'online' ? 'Save meeting link' : 'Save location'}</button>
                </div>
                <span className="form-hint">The Tutor owns these practical meeting details to avoid conflicting edits.</span>
              </form>
              </>
            )}
          </section>

          <section className={`card session-room-section session-messages-panel ${messagesAvailable ? '' : 'is-unavailable'}`} aria-labelledby="messages-heading">
            <Alert type="danger" message={refreshError} />
            <div className="session-section-heading">
              <div>
                <MessageSquare size={18} aria-hidden="true" />
                <div><h2 id="messages-heading">Messages</h2>{messagesAvailable && <p>Coordinate the details of your session.</p>}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Refresh session" onClick={() => refreshRoom()} disabled={refreshing || actionLoading}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <p className="session-refresh-note">Updates automatically every 5 seconds while this page is visible.</p>
            {!messagesAvailable ? (
              <p className="session-muted-copy">{usesLegacyActions ? 'Messages become available after the Tutor accepts this session.' : 'Messaging is unavailable for this session state in the current app.'}</p>
            ) : !messagesLoaded ? (
              <LoadingSpinner text="Loading session messages..." size={28} />
            ) : (
              <>
                <div className="session-messages" ref={messagesRef} aria-live="polite"
                  onScroll={(event) => {
                    const list = event.currentTarget;
                    followMessages.current = list.scrollHeight - list.scrollTop - list.clientHeight < 72;
                  }}>
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
                    aria-invalid={Boolean(messageError)}
                    aria-describedby={messageError ? 'session-message-error' : undefined}
                    onChange={(event) => { setMessageBody(event.target.value); setMessageError(''); }}
                  />
                  {messageError && <span className="form-error" id="session-message-error">{messageError}</span>}
                  <div><span className="form-hint">{1000 - messageBody.length} characters remaining</span><button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading || sendingMessage}><Send size={14} /> {sendingMessage ? 'Sending...' : 'Send message'}</button></div>
                </form>
              </>
            )}
          </section>

          {ratingSubmitted && <Alert type="success" message="Your review for this session has been submitted." />}
          {session.ratingEligible && ['completed', 'resolved'].includes(session.status) && !ratingSubmitted && (
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
              {timeline.map((step, index) => <li key={step.label}
                className={step.state === 'done' ? 'is-done'
                  : step.state === 'current' ? 'is-current'
                    : step.state === 'stopped' ? 'is-stopped' : ''}
                aria-current={step.state === 'current' ? 'step' : undefined}>
                <span>{step.state === 'done' ? <Check size={14} /> : index + 1}</span>
                <div><strong>{step.label}</strong><small>{step.state === 'done' ? 'Done'
                  : step.state === 'current' ? 'Needs attention' : 'Not yet complete'}</small></div>
              </li>)}
            </ol>
          </section>

          {hasSecondaryActions && !isClosed && (
            <section className="card session-room-section session-actions-panel" aria-labelledby="actions-heading">
              <h2 id="actions-heading">Actions</h2>
              {isTeaching && session.status === 'pending' && <button className="btn btn-ghost session-destructive-action" type="button" disabled={actionLoading} onClick={() => runStatusAction('declined')}>Decline request</button>}
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
