import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Search } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatSessionDateTime, getSessionStatus, SESSION_STATUS_FILTERS } from '../../utils/sessionPresentation';

export const AdminSessionsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await analyticsService.getAdminSessions();
      setSessions(response.data || []);
      setAvailable(true);
    } catch (err) {
      setAvailable(false);
      setError(err.message || 'Session data could not be loaded.');
    } finally { setLoading(false); }
  };

  useEffect(() => { Promise.resolve().then(load); }, []);
  const visible = useMemo(() => sessions.filter((session) => (
    (filter === 'all' || getSessionStatus(session).filterKey === filter)
    && (!search.trim() || [session.subject, session.learner?.name, session.tutor?.name].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())))
  )), [sessions, filter, search]);

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Sessions</span><h1>Session directory</h1><p>View session activity and progress. Participant messages remain private.</p></div></header>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <div className="card staff-filter-bar"><label className="admin-search"><span className="sr-only">Search sessions by subject or participant</span><Search size={16} /><input type="search" className="form-input" placeholder="Search subject or participant" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="staff-filter-select">Status <select className="form-select" value={filter} onChange={(event) => setFilter(event.target.value)}>{SESSION_STATUS_FILTERS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {loading ? <LoadingSpinner text="Loading sessions..." size={34} /> : !available ? <EmptyState icon={Calendar} title="Sessions unavailable" description="Session data could not be loaded." actionText="Retry" onAction={load} /> : visible.length === 0 ? <EmptyState icon={Calendar} title="No sessions match this view" description="Try another status or search term." /> : (
        <div className="table-responsive" tabIndex={0} role="region" aria-label="Session directory. Scroll horizontally to view all columns."><table className="table admin-session-table"><thead><tr><th>Subject</th><th>Learner</th><th>Tutor</th><th>Schedule</th><th>Status</th><th>Credits</th></tr></thead><tbody>{visible.map((session) => { const status = getSessionStatus(session); return <tr key={session._id}><td><strong>{session.subject}</strong></td><td>{session.learner?.name || 'Unavailable'}</td><td>{session.tutor?.name || 'Unavailable'}</td><td>{formatSessionDateTime(session.scheduledAt) || 'Not scheduled'}</td><td><Badge status={status.key}>{status.label}</Badge></td><td>{session.creditAmount}</td></tr>; })}</tbody></table></div>
      )}
    </div>
  );
};

export default AdminSessionsPage;
