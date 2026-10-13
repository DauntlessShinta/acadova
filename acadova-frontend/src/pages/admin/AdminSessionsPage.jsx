import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useSearchDraft } from '../../utils/useSearchDraft';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatSessionDateTime, getSessionStatus, SESSION_STATUS_FILTERS } from '../../utils/sessionPresentation';

export const AdminSessionsPage = () => {
  const [sessions, setSessions] = useState([]);
  const [params, setParams] = useSearchParams();
  const draft = useSearchDraft(params, setParams);
  const search = draft.value;
  const filter = params.get('status') || 'all';
  const page = Number(params.get('page')) || 1;
  const [pagination, setPagination] = useState(null);
  const generation = useRef({ value: 0 });
  const query = params.toString();
  const changePage = value => { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next); };
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const ticket = ++generation.current.value;
    setLoading(true);
    setError('');
    try {
      const response = await analyticsService.getAdminSessions(Object.fromEntries(new URLSearchParams(query)));
      if (ticket !== generation.current.value) return;
      setPagination(response.pagination || { total: response.data?.length || 0, pages: 1 });
      setSessions(response.data || []);
      setAvailable(true);
    } catch (err) {
      if (ticket !== generation.current.value) return;
      setAvailable(false);
      setError(err.message || 'Session data could not be loaded.');
    } finally { if (ticket === generation.current.value) setLoading(false); }
  }, [query]);

  useEffect(() => { Promise.resolve().then(load); const state = generation.current; return () => { state.value++; }; }, [load]);
  const visible = sessions;

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Sessions</span><h1>Session directory</h1><p>View session activity and progress. Participant messages remain private.</p></div></header>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <div className="card staff-filter-bar"><label className="admin-search"><span className="sr-only">Search sessions by subject or participant</span><Search size={16} /><input type="search" className="form-input" maxLength={80} placeholder="Search subject or participant" value={search} onChange={(event) => draft.change(event.target.value)} /></label><label className="staff-filter-select">Stored status <select className="form-select" value={filter} onChange={(event) => (() => { const next = new URLSearchParams(params); if (event.target.value === 'all') next.delete('status'); else next.set('status', event.target.value); next.delete('page'); setParams(next); })()}>{SESSION_STATUS_FILTERS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="staff-filter-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setParams({}); }}>Clear filters</button><button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={load}>Refresh sessions</button></div>
      {!loading && available && <p className="form-hint" role="status">{sessions.length} of {pagination?.total ?? sessions.length} matching sessions ? Page {page}. Filters use stored status (scheduled includes legacy accepted). Historical completed records can display as awaiting confirmation after ledger review. Credits shown are the agreed cost; a stored completed status alone does not prove settlement.</p>}
      {loading ? <LoadingSpinner text="Loading sessions..." size={34} /> : !available ? <EmptyState icon={Calendar} title="Sessions unavailable" description="Session data could not be loaded." actionText="Retry" onAction={load} /> : visible.length === 0 ? <EmptyState icon={Calendar} title="No sessions match this view" description="Try another status or search term." /> : (
        <div className="table-responsive" tabIndex={0} role="region" aria-label="Session directory. Scroll horizontally to view all columns."><table className="table admin-session-table"><thead><tr><th>Subject</th><th>Learner</th><th>Tutor</th><th>Schedule</th><th>Status</th><th>Credits</th></tr></thead><tbody>{visible.map((session) => { const status = getSessionStatus(session); return <tr key={session._id}><td><strong>{session.subject}</strong></td><td>{session.learner?.name || 'Unavailable'}</td><td>{session.tutor?.name || 'Unavailable'}</td><td>{formatSessionDateTime(session.scheduledAt) || 'Not scheduled'}</td><td><Badge status={status.key}>{status.label}</Badge></td><td>{session.creditAmount}</td></tr>; })}</tbody></table></div>
      )}
      <div className="staff-filter-actions" aria-label="Session pages"><button className="btn btn-secondary btn-sm" disabled={loading || page <= 1} onClick={() => changePage(page - 1)}>Previous</button><button className="btn btn-secondary btn-sm" disabled={loading || page >= (pagination?.pages || 1)} onClick={() => changePage(page + 1)}>Next</button></div>
    </div>
  );
};

export default AdminSessionsPage;
