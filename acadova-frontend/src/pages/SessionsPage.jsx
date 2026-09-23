import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import Alert from '../components/common/Alert';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SessionCard from '../components/student/SessionCard';
import { getSessionPerspective, getSessionStatus } from '../utils/sessionPresentation';

const roleFilters = [
  { value: 'all', label: 'All' },
  { value: 'learning', label: 'Learning' },
  { value: 'teaching', label: 'Teaching' },
];

const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Requested' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'waiting', label: 'Awaiting confirmation' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Declined' },
];

export const SessionsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [sessionsAvailable, setSessionsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSessions = async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const response = await sessionService.getMySessions();
      setSessions(response?.data || []);
      setSessionsAvailable(true);
    } catch (err) {
      setSessionsAvailable(false);
      setError(err.message || 'Sessions could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchSessions({ showLoading: false }));
  }, []);

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    const perspective = getSessionPerspective(session, user);
    const roleMatches = roleFilter === 'all'
      || (roleFilter === 'teaching' && perspective.isTeaching)
      || (roleFilter === 'learning' && !perspective.isTeaching);
    const statusMatches = statusFilter === 'all' || getSessionStatus(session).key === statusFilter;
    return roleMatches && statusMatches;
  }), [roleFilter, sessions, statusFilter, user]);

  const roleCounts = useMemo(() => sessions.reduce((counts, session) => {
    if (getSessionPerspective(session, user).isTeaching) counts.teaching += 1;
    else counts.learning += 1;
    return counts;
  }, { learning: 0, teaching: 0 }), [sessions, user]);

  const handleUpdateStatus = async (sessionId, nextStatus) => {
    if (nextStatus === 'rejected' && !window.confirm('Decline this session request? The learner will need to find another peer.')) return;
    try {
      setActionLoading(true);
      setError('');
      const response = await sessionService.updateSessionStatus(sessionId, nextStatus);
      setSuccessMessage(response.message);
      await fetchSessions({ showLoading: false });
    } catch (err) {
      setError(err.message || 'The session could not be updated.');
    } finally {
      setActionLoading(false);
    }
  };

  const emptyDescription = roleFilter === 'teaching'
    ? 'You do not have teaching sessions matching these filters.'
    : roleFilter === 'learning'
      ? 'You do not have learning sessions matching these filters.'
      : 'You do not have sessions matching these filters.';

  return (
    <div className="student-sessions-page">
      <header className="student-page-header">
        <div><span className="student-eyebrow">Peer sessions</span><h1>Sessions</h1><p>See whether you are learning or teaching, who you are meeting, and what happens next.</p></div>
        <Link to="/tutors" className="btn btn-primary"><BookOpen size={15} /> Request Session</Link>
      </header>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />

      <div className="card student-session-filters">
        <div className="session-filter-group" aria-label="Filter by your role in the session">
          {roleFilters.map((item) => {
            const count = item.value === 'all' ? sessions.length : roleCounts[item.value];
            return <button key={item.value} type="button" className={`btn btn-sm ${roleFilter === item.value ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={roleFilter === item.value} onClick={() => setRoleFilter(item.value)}>{item.label} ({count})</button>;
          })}
        </div>
        <div className="session-filter-group" aria-label="Filter by session status">
          <span><Filter size={14} /> Status</span>
          {statusFilters.map((item) => <button key={item.value} type="button" className={`session-filter-chip ${statusFilter === item.value ? 'is-active' : ''}`} aria-pressed={statusFilter === item.value} onClick={() => setStatusFilter(item.value)}>{item.label}</button>)}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading your peer sessions..." size={36} />
      ) : !sessionsAvailable ? (
        <EmptyState icon={Clock} title="Sessions unavailable" description="Sessions could not be loaded. Try again." actionText="Retry" onAction={() => fetchSessions()} />
      ) : filteredSessions.length === 0 ? (
        <EmptyState icon={Clock} title="No sessions in this view" description={emptyDescription} actionText={roleFilter !== 'teaching' ? 'Find Peers' : undefined} onAction={roleFilter !== 'teaching' ? () => navigate('/tutors') : undefined} />
      ) : (
        <div className="student-session-list">
          {filteredSessions.map((session) => <SessionCard key={session._id} session={session} currentUser={user} actionLoading={actionLoading} onStatusChange={handleUpdateStatus} />)}
        </div>
      )}
    </div>
  );
};

export default SessionsPage;
