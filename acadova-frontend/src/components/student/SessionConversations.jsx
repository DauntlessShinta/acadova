import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/notificationAccess';
import sessionService from '../../services/sessionService';
import { canMessageSession, threadAlerts, threadFromNotification } from '../../utils/messagingUx';
import { getSessionPerspective, getSessionStatus } from '../../utils/sessionPresentation';
import LoadingSpinner from '../common/LoadingSpinner';

export default function SessionConversations({ onOpen }) {
  const { user } = useAuth(); const { items, refresh } = useNotifications();
  const [sessions, setSessions] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void refresh();
    sessionService.getMySessions().then((response) => { if (active) { setSessions(response.data || []); setError(''); } })
      .catch(() => { if (active) setError('Conversations could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, refresh]);
  if (loading) return <LoadingSpinner text="Loading Session conversations..." />;
  if (error) return <div><p role="alert">{error}</p><button className="btn btn-secondary" onClick={() => { setLoading(true); setAttempt(attempt + 1); }}>Retry</button></div>;
  const conversations = sessions.filter(canMessageSession);
  return <div className="session-conversations">
    <p className="form-hint">Messages belong to your tutoring Sessions. Select a conversation to open its Chat tab.</p>
    {!conversations.length && <p>No Session conversations are available yet. Chat opens after a request is accepted.</p>}
    <ul>{conversations.map((session) => {
      const unread = threadAlerts(items, session._id);
      const latest = items.find((item) => item.type?.startsWith('message.') && threadFromNotification(item) === String(session._id));
      return <li key={session._id}><Link className="conversation-link" to={`/sessions/${session._id}#session-messages`} onClick={onOpen}>
        <strong>{getSessionPerspective(session, user).counterpart?.name || 'Your peer'}</strong>
        <span>{session.subject}</span><small>{latest?.message || getSessionStatus(session).label}</small>
        {unread.length > 0 && <span className="conversation-unread">Unread message alert</span>}
      </Link></li>;
    })}</ul>
    <p className="form-hint">Activity comes from recent in-app notifications, not message previews or exact unread-message totals.</p>
  </div>;
}
