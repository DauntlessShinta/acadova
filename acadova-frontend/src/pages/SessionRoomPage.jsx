import { useNotifications } from '../context/notificationAccess';
import { isChatViewed, isNearChatBottom, newIncomingMessages, canMessageSession } from '../utils/messagingUx';
import { resourceSource } from '../utils/learningPresentation';
import { useConfirm } from '../context/confirmAccess';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  ExternalLink,
  MapPin,
  Maximize2,
  MessageSquare,
  Minimize2,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import ratingService from '../services/ratingService';
import WorkflowTabs from '../components/common/WorkflowTabs';
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
  getSessionTimeline, canCancelSession,
} from '../utils/sessionPresentation';

const idOf = (value) => String(value?._id || value?.id || value || '');

export const SessionRoomPage = () => {
  const { id } = useParams();
  return <SessionRoom key={id} id={id} />;
};

const SessionRoom = ({ id }) => {
  const { hash, key: navigationKey } = useLocation();
  const [activeSection, setActiveSection] = useState(hash === '#session-messages' ? 'messages' : 'overview');
  const { refresh: refreshNotifications, setActiveThread } = useNotifications();
  const confirm = useConfirm();
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!loading && hash === '#session-messages') {
      Promise.resolve().then(() => setActiveSection('messages'));
      const frame = requestAnimationFrame(() => document.getElementById('session-messages')?.scrollIntoView({ block: 'start' }));
      return () => cancelAnimationFrame(frame);
    }
  }, [loading, hash, navigationKey]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [clockNow, setClockNow] = useState(null);
  const [messageBody, setMessageBody] = useState('');
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [messageNotice, setMessageNotice] = useState('');
  const [messageError, setMessageError] = useState('');
  const [chatExpanded, setChatExpanded] = useState(false);
  const expandTrigger = useRef(null);
  const chatPanel = useRef(null);
  const composerRef = useRef(null);
  const chatScrollSnapshot = useRef(null);
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
  const chatActive = useRef(false);
  const lastMessages = useRef([]);
  const fetchedMessages = useRef(false);
  const forceChatScroll = useRef(true);
  const googleConfigured = isGoogleClientConfigured(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  const refreshRoom = useCallback(async ({ showLoading = false, notify = false } = {}) => {
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
      if (canMessageSession(latest) && chatActive.current && isChatViewed('messages')) {
        const messageResponse = await sessionService.getMessages(id);
        if (!gate.current.isCurrent(ticket)) return;
        if (!chatActive.current) return;
        const incoming = newIncomingMessages(lastMessages.current, messageResponse.data || [], user);
        const firstFetch = !fetchedMessages.current;
        lastMessages.current = mergeSessionMessages(lastMessages.current, messageResponse.data || []);
        setMessages(lastMessages.current); setMessagesLoaded(true); fetchedMessages.current = true;
        if (!firstFetch && !followMessages.current && incoming.length) setNewMessageCount((count) => count + incoming.length);
        if (firstFetch || incoming.length) void refreshNotifications({ afterCurrent: true });
      } else if (!canMessageSession(latest)) {
        lastMessages.current = []; setMessages([]); setMessagesLoaded(true);
      }
      setRefreshError('');
      if (notify) toast('info', 'Session refreshed.');
    } catch {
      if (gate.current.isCurrent(ticket)) {
        if (notify) toast('error', 'Session updates are temporarily unavailable. Try again.');
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
  }, [id, refreshUser, toast, user, refreshNotifications]);

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
    if (activeSection === 'messages') { followMessages.current = true; forceChatScroll.current = true; }
    const viewed = () => {
      chatActive.current = isChatViewed(activeSection);
      setActiveThread(chatActive.current ? id : '');
      if (chatActive.current) void refreshRoom();
    };
    viewed(); window.addEventListener('focus', viewed); window.addEventListener('blur', viewed);
    document.addEventListener('visibilitychange', viewed);
    return () => { chatActive.current = false; setActiveThread(''); window.removeEventListener('focus', viewed); window.removeEventListener('blur', viewed); document.removeEventListener('visibilitychange', viewed); };
  }, [activeSection, id, refreshRoom, setActiveThread]);
  useLayoutEffect(() => {
    const list = messagesRef.current;
    if (activeSection === 'messages' && list && (followMessages.current || forceChatScroll.current)) {
      list.scrollTop = list.scrollHeight; forceChatScroll.current = false;
    }
  }, [messages, activeSection, messagesLoaded]);
  useLayoutEffect(() => {
    const field = composerRef.current;
    if (field && activeSection === 'messages') {
      field.style.height = 'auto';
      field.style.height = `${Math.min(field.scrollHeight, 144)}px`;
    }
  }, [messageBody, activeSection]);
  useLayoutEffect(() => {
    const snapshot = chatScrollSnapshot.current;
    const list = messagesRef.current;
    if (snapshot && list) {
      list.scrollTop = snapshot.follow ? list.scrollHeight : snapshot.top;
      followMessages.current = snapshot.follow;
      chatScrollSnapshot.current = null;
    }
    if (!chatExpanded) { chatPanel.current?.style.removeProperty('--chat-expanded-height'); return undefined; }
    if (activeSection !== 'messages') return undefined;
    const fitChat = () => {
      const panel = chatPanel.current;
      if (!panel) return;
      const header = [...document.querySelectorAll('.student-utility-bar, .student-mobile-header')].find((element) => element.getClientRects().length);
      const bottomNav = document.querySelector('.student-mobile-bottom');
      const offset = (header?.getBoundingClientRect().bottom || 0) + 12;
      const bottomSpace = bottomNav?.getClientRects().length ? bottomNav.getBoundingClientRect().height : 0;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const available = viewportHeight - offset - bottomSpace - 16;
      panel.style.setProperty('--chat-expanded-height', `${Math.max(240, available)}px`);
      window.scrollTo({ top: window.scrollY + panel.getBoundingClientRect().top - offset, behavior: 'instant' });
    };
    fitChat();
    const frame = requestAnimationFrame(fitChat);
    window.addEventListener('resize', fitChat);
    window.visualViewport?.addEventListener('resize', fitChat);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fitChat);
      window.visualViewport?.removeEventListener('resize', fitChat);
    };
  }, [chatExpanded, activeSection]);
  const resizeChat = (expanded) => {
    chatScrollSnapshot.current = { top: messagesRef.current?.scrollTop || 0, follow: followMessages.current };
    setChatExpanded(expanded);
    // An in-page workspace retains normal tab order; it is not a modal.
    if (!expanded) requestAnimationFrame(() => expandTrigger.current?.focus({ preventScroll: true }));
  };
  const changeSection = (section) => { setActiveSection(section); if (section === 'messages') setNewMessageCount(0); };
  const newestMessages = () => { const list = messagesRef.current; if (list) list.scrollTop = list.scrollHeight; followMessages.current = true; setNewMessageCount(0); };

  // Display helpers never grant permission for unsupported response contracts.
  const usesLegacyActions = session?.canonicalStatus == null;
  const messagesAvailable = canMessageSession(session);

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
      cancelled: session.status === 'pending' ? 'This request will be cancelled for both participants. No credits will be transferred.' : 'The scheduled session will be cancelled for both participants. No credits will be transferred.',
      completed: `Mark this ${session.subject} session as finished?\n\n${session.learner?.name || 'The learner'} will be asked to confirm before credits are transferred.`,
    };
    if (prompts[status] && !await confirm(prompts[status], { title: status === 'cancelled' ? 'Cancel this session?' : status === 'declined' ? 'Decline request' : 'Finish Session', label: status === 'cancelled' ? 'Cancel Session' : status === 'declined' ? 'Decline request' : 'Finish Session' })) return;
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
    if (session.meetingMethod === 'online' && !resourceSource(meetingValue.trim())) { toast('error', 'Use a valid HTTPS meeting URL.'); return; }
    const existing = session.meetingMethod === 'online' ? session.meetingLink : session.location;
    if (existing && meetingValue.trim() !== existing && !await confirm('Replace the existing meeting details? Both participants will need to use the new details.', { title: 'Replace meeting details', label: 'Replace details' })) return;
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
    if (!accept && !await confirm('Decline this proposed schedule? The current agreed time will remain.', { title: 'Decline proposed time', label: 'Decline time' })) return;
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
    if (!await confirm('Finish the live session? Both participants must then confirm before credits transfer.', { title: 'Finish Session', label: 'Finish Session', destructive: false })) return;
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
    if (!await confirm('Record this session as a no-show? Check-in evidence determines who was absent. No credits will transfer.', { title: 'Record no-show', label: 'Record no-show' })) return;
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
    if (!await confirm('Submit this dispute for Moderator review? Normal validation will pause.', { title: 'Submit dispute', label: 'Submit dispute' })) return;
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
    if (!await confirm(prompt, { title: 'Confirm Session', label: 'Confirm Session', destructive: false })) return;
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
      lastMessages.current = mergeSessionMessages(lastMessages.current, [response.data]);
      followMessages.current = true; forceChatScroll.current = true; setNewMessageCount(0);
      setMessages(lastMessages.current);
      setMessageBody((current) => current === sentBody ? '' : current);
      setMessageNotice('Message sent.');
    } catch (err) {
      setMessageError(err.message || 'Message could not be sent. Your draft is still here.');
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
  const canCheckIn = usesLegacyActions && ['accepted', 'scheduled'].includes(session.status)
    && checkInOpen && !checkInBlockedByProposal && !myCheckIn;
  const canReportNoShow = usesLegacyActions && ['accepted', 'scheduled'].includes(session.status)
    && Number.isFinite(agreedTime) && clockNow != null
    && clockNow > agreedTime + 4 * 60 * 60 * 1000 && !checkInBlockedByProposal
    && !session.startedAt && !(session.learnerCheckedInAt && session.tutorCheckedInAt);
  const canReschedule = usesLegacyActions && ['accepted', 'scheduled'].includes(session.status);
  const hasRescheduleProposal = canReschedule && Boolean(session.rescheduleProposalId && session.proposedScheduledAt);
  const proposedByMe = hasRescheduleProposal && idOf(session.rescheduleProposedBy) === idOf(user);
  const proposedScheduleLabel = formatSessionDateTime(session.proposedScheduledAt);
  const meetingMethodLabel = session.meetingMethod === 'online'
    ? 'Online'
    : session.meetingMethod === 'in-person' ? 'In person' : 'Not recorded';
  const creditLabel = `${session.creditAmount} credit${session.creditAmount === 1 ? '' : 's'}`;
  const myValidation = isTeaching ? session.tutorConfirmedAt : session.learnerConfirmedAt;
  const isClosed = ['cancelled', 'declined', 'rejected', 'no_show', 'resolved'].includes(session.status);
  const hasSecondaryActions = usesLegacyActions && (
    canCancelSession(session)
    || (isTeaching && session.status === 'completed' && !session.confirmedAt)
  );
  const needsMeetingDetails = usesLegacyActions && isTeaching && canReschedule
    && !(session.meetingMethod === 'online' ? session.meetingLink : session.meetingMethod === 'in-person' ? session.location : true);
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
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Refresh session" onClick={() => refreshRoom({ notify: true })} disabled={refreshing || actionLoading}>
                <RefreshCw size={14} /> Refresh
              </button>
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
          <h2 id="next-step-heading">{hasRescheduleProposal ? 'Review the proposed time before checking in.' : needsMeetingDetails ? 'Add the agreed meeting details for your peer.' : canReportNoShow ? 'The check-in window ended. Review attendance and report a no-show if needed.' : nextStep}</h2>
          {session.status === 'pending' && !isTeaching && <p>No action is required from you right now.</p>}
          {session.creditsSettledAt && <p>{creditLabel} transferred.</p>}
        </div>
        {usesLegacyActions && isTeaching && session.status === 'pending' && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={() => runStatusAction('scheduled')}>Accept request</button>}
        {usesLegacyActions && isTeaching && session.status === 'accepted' && !needsMeetingDetails && <button className={`btn btn-sm ${canCheckIn ? 'btn-secondary' : 'btn-primary'}`} type="button" disabled={actionLoading} onClick={() => runStatusAction('completed')}>Complete session</button>}
        {usesLegacyActions && isTeaching && session.status === 'in_progress' && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={handleFinishSession}>Finish live session</button>}
        {usesLegacyActions && session.status === 'awaiting_validation' && !myValidation && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={handleConfirm}>Confirm session</button>}
        {canReportNoShow && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={handleNoShow}>Report no-show</button>}
        {usesLegacyActions && !isTeaching && session.status === 'completed' && !session.confirmedAt && <button className="btn btn-primary btn-sm" type="button" disabled={actionLoading} onClick={handleConfirm}>Confirm completion and transfer {creditLabel}</button>}
        {canCheckIn && <button type="button" className={`btn btn-sm ${needsMeetingDetails ? 'btn-secondary' : 'btn-primary'}`} disabled={actionLoading} onClick={handleCheckIn}>Check in</button>}
        {session.meetingMethod === 'online' && ['accepted', 'scheduled', 'in_progress'].includes(session.status) && resourceSource(session.meetingLink) && <a className="btn btn-secondary btn-sm" href={session.meetingLink} target="_blank" rel="noopener noreferrer">Join Meeting <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
        {needsMeetingDetails && <button type="button" className={`btn btn-sm ${hasRescheduleProposal ? 'btn-secondary' : 'btn-primary'}`} onClick={() => changeSection('details')}>Add meeting details</button>}
        {hasRescheduleProposal && <button className="btn btn-primary btn-sm" onClick={() => changeSection('details')}>Review proposed time</button>}
      </section>

      <details className="session-secondary-actions" hidden={!hasSecondaryActions || isClosed}><summary>More session actions</summary>          {hasSecondaryActions && !isClosed && (
            <section className="card session-room-section session-actions-panel" aria-labelledby="actions-heading">
              <h2 id="actions-heading">Actions</h2>
              {isTeaching && session.status === 'pending' && <button className="btn btn-ghost session-destructive-action" type="button" disabled={actionLoading} onClick={() => runStatusAction('declined')}>Decline request</button>}
              {isTeaching && session.status === 'completed' && <p>Waiting for learner confirmation. No credits have transferred yet.</p>}
              {canCancelSession(session) && <button className="btn btn-ghost session-cancel-action" type="button" disabled={actionLoading} onClick={() => runStatusAction('cancelled')}>Cancel session</button>}
            </section>
          )}</details>
      <Alert type="danger" message={refreshError} />
      <WorkflowTabs id="room" tabs={[['overview', 'Overview'], ['messages', 'Chat'], ['progress', 'Progress'], ['details', 'Details']]} active={activeSection} onChange={changeSection} />
      <div className={`session-room-layout section-${activeSection}`}>
        <div className="session-room-main">
          <section id="room-panel-overview" role="tabpanel" tabIndex={0} aria-labelledby="room-tab-overview" hidden={activeSection !== 'overview'} className="card session-room-section session-details-panel">
            <h2 id="overview-heading">Overview</h2><p>{nextStep}</p>
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

            {usesLegacyActions && ['awaiting_validation', 'no_show'].includes(session.status) && (
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

            {session.meetingMethod === 'online' && session.meetingLink && (
              <div className="session-meeting-result">
                <span>Online meeting</span>
                <span>Join Meeting opens the agreed link. It does not prove attendance; use Acadova check-in and post-session confirmation.</span>
              </div>
            )}
            {session.meetingMethod === 'in-person' && session.location && (
              <div className="session-meeting-result"><span>Meeting location</span><strong>{session.location}</strong></div>
            )}

            {!['online', 'in-person'].includes(session.meetingMethod) && (
              <p className="session-muted-copy">This older session has no recorded meeting method. Use a new request for the current coordination workflow; this record is unchanged.</p>
            )}
          </section>

          <section id="room-panel-messages" ref={chatPanel} role="tabpanel" tabIndex={0} aria-labelledby="room-tab-messages" hidden={activeSection !== 'messages'} className={`card session-room-section session-messages-panel ${chatExpanded ? 'is-expanded' : ''} ${messagesAvailable ? '' : 'is-unavailable'}`}
            onKeyDown={(event) => { if (event.key === 'Escape' && chatExpanded) { event.preventDefault(); event.stopPropagation(); resizeChat(false); } }}>

            <div className="session-section-heading">
              <div>
                <MessageSquare size={18} aria-hidden="true" />
                <div><h2 id="session-messages">Chat with {counterpart?.name || 'your peer'}</h2>{messagesAvailable && <p>{session.subject}</p>}</div>
              </div>
              {messagesAvailable && <button type="button" ref={expandTrigger} className="btn btn-secondary btn-sm chat-expand" aria-label={chatExpanded ? 'Minimize chat' : 'Expand chat'} title={chatExpanded ? 'Minimize chat' : 'Expand chat'} aria-expanded={chatExpanded} aria-controls="session-chat-workspace" onClick={() => resizeChat(!chatExpanded)}>
                {chatExpanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}<span className="chat-expand-label">{chatExpanded ? 'Minimize chat' : 'Expand chat'}</span>
              </button>}
            </div>
            <p className="session-refresh-note">Messages refresh automatically while this chat is open.</p>
            {!messagesAvailable ? (
              <p className="session-muted-copy">{usesLegacyActions ? 'Messages become available after the Tutor accepts this session.' : 'Messaging is unavailable for this session state in the current app.'}</p>
            ) : !messagesLoaded ? (
              <LoadingSpinner text="Loading session messages..." size={28} />
            ) : (
              <div className="session-chat-workspace" id="session-chat-workspace">
                <div className="session-messages" ref={messagesRef} role="log" aria-label="Session conversation" aria-live="polite" tabIndex={0}
                  onScroll={(event) => {
                    const list = event.currentTarget;
                    followMessages.current = isNearChatBottom(list);
                    if (followMessages.current) setNewMessageCount(0);
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
                {newMessageCount > 0 && <button type="button" className="btn btn-secondary btn-sm chat-new-messages" onClick={newestMessages}>{newMessageCount} new {newMessageCount === 1 ? 'message' : 'messages'} - go to newest</button>}
                <form className="message-composer" onSubmit={handleSendMessage} aria-busy={sendingMessage}>
                  <label className="form-label" htmlFor="session-message">Message</label>
                  <div className="chat-compose-row">
                  <textarea
                    id="session-message"
                    ref={composerRef}
                    className="form-textarea"
                    rows={1}
                    maxLength={1000}
                    value={messageBody}
                    placeholder="Share a meeting detail or study note..."
                    aria-invalid={Boolean(messageError)}
                    aria-describedby={messageError ? 'session-message-error' : undefined}
                    onChange={(event) => { setMessageBody(event.target.value); setMessageError(''); setMessageNotice(''); }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={actionLoading || sendingMessage || !messageBody.trim()} aria-busy={sendingMessage}><Send size={16} aria-hidden="true" />{sendingMessage ? 'Sending...' : 'Send'}</button>
                  </div>
                  {messageNotice && <p role="status" className="form-hint">{messageNotice}</p>}
                  {messageError && <span role="alert" className="form-error" id="session-message-error">{messageError}</span>}
                  <span className="form-hint chat-character-count">{1000 - messageBody.length} characters remaining</span>
                </form>
              </div>
            )}
          </section>

          <section id="room-panel-details" role="tabpanel" tabIndex={0} aria-labelledby="room-tab-details" hidden={activeSection !== 'details'} className="card session-room-section"><h2 id="details-heading">Session details</h2><div>            {canReschedule && (
              <details className="session-reschedule" open={hasRescheduleProposal}><summary className="text-action">Schedule and rescheduling</summary>
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
              </details>
            )}

{!canReschedule && <p>A new time cannot be proposed in this session state.</p>}</div>
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

            {usesLegacyActions && isTeaching && ['accepted', 'scheduled'].includes(session.status)
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
                    target="_blank" rel="noopener noreferrer">Open Google Meet <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
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
          <div hidden={activeSection !== 'overview'}>
          {ratingSubmitted && <Alert type="success" message="Your review for this session has been submitted." />}
          {usesLegacyActions && session.ratingEligible && ['completed', 'resolved'].includes(session.status) && !ratingSubmitted && (
            <section className="card session-room-section session-review-panel" aria-labelledby="review-heading">
              <h2 id="review-heading">Review your peer</h2>
              <form onSubmit={handleRating}>
                <div className="form-group rating-form-stars"><label className="form-label">Star rating</label><StarRating rating={ratingStars} readOnly={false} size={28} onChange={setRatingStars} /><span>{ratingStars} out of 5</span></div>
                <div className="form-group"><label className="form-label" htmlFor="rating-comment">Constructive feedback (optional)</label><textarea id="rating-comment" className="form-textarea" rows={3} maxLength={500} value={ratingComment} onChange={(event) => setRatingComment(event.target.value)} /></div>
                <button className="btn btn-primary btn-sm" type="submit" disabled={actionLoading}>Submit review</button>
              </form>
            </section>
          )}
          </div>
        </div>

        <aside id="room-panel-progress" hidden={activeSection !== 'progress'} role="tabpanel" tabIndex={0} aria-labelledby="room-tab-progress" className="session-room-sidebar" data-selected={activeSection === 'progress'}>
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
                  : step.state === 'current' ? 'Needs attention' : step.state === 'stopped' ? 'Not applicable ? session stopped' : 'Not yet complete'}</small></div>
              </li>)}
            </ol>
          </section>


        </aside>
      </div>
    </div>
  );
};

export default SessionRoomPage;
