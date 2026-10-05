import React, { useEffect, useState } from 'react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const actions = ['session.dispute_resolved', 'credit.rules_changed', 'credit.admin_adjustment',
  'learning.topic_created', 'learning.topic_published', 'learning.topic_archived',
  'learning.resource_approved', 'learning.resource_rejected', 'learning.resource_archived',
  'learning.module_created', 'learning.module_published', 'learning.module_archived',
  'learning.assessment_created', 'learning.assessment_published',
  'review.moderated', 'user.suspended', 'user.reactivated', 'user.role_changed',
  'security.login_cooldown_started', 'security.login_cooldown_extended',
  'security.login_success_after_failures'];

export default function AdminAuditLogsPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [actorDraft, setActorDraft] = useState('');
  const [targetType, setTargetType] = useState('');
  const [loading, setLoading] = useState(true);
  const [actorError, setActorError] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (active) setLoading(true);
      try {
        const response = await analyticsService.getAuditLogs({ page, limit: 25,
          ...(action ? { action } : {}), ...(actor ? { actor } : {}),
          ...(targetType ? { targetType } : {}) });
        if (active) { setRows(response.data || []); setPagination(response.pagination); setError(''); }
      } catch (err) { if (active) setError(err.message || 'Audit logs could not be loaded.'); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [page, action, actor, targetType]);
  const updateFilter = (setter) => (event) => { setter(event.target.value.trim()); setPage(1); };
  return <div className="staff-page">
    <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Audit</span>
      <h1>Audit logs</h1><p>Recorded privileged actions from P4 onward. Historical actions are not backfilled.</p></div></header>
    <Alert type="danger" message={error} />
    <div className="card staff-filter-bar">
      <label>Action <select className="form-select" value={action} onChange={updateFilter(setAction)}>
        <option value="">All actions</option>{actions.map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Actor ID <input id="audit-actor" aria-invalid={Boolean(actorError)} aria-describedby={actorError ? 'audit-actor-error' : undefined} className="form-input" value={actorDraft} onChange={(event) => setActorDraft(event.target.value)} placeholder="User ID" />{actorError && <span className="form-error" id="audit-actor-error">{actorError}</span>}</label>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
        const value = actorDraft.trim();
        if (value && !/^[a-f\d]{24}$/i.test(value)) { setActorError('Enter a valid Actor ID.'); document.getElementById('audit-actor')?.focus(); return; }
        setActorError(''); setActor(value); setPage(1);
      }}>Apply actor</button>
      <label>Target type <select className="form-select" value={targetType} onChange={updateFilter(setTargetType)}>
        <option value="">All types</option>{['Session', 'User', 'Rating', 'LearningTopic', 'LearningResource',
          'LearningModule', 'Assessment', 'CreditConfig', 'CreditTransaction'].map((type) => <option key={type}>{type}</option>)}
      </select></label>
    </div>
    {loading ? <LoadingSpinner text="Loading audit logs..." size={30} /> : <>
      <div className="table-responsive"><table className="table"><thead><tr>
        <th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Target</th><th>Summary</th>
      </tr></thead><tbody>{rows.map((row) => <tr key={row._id}>
        <td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.actorRole === 'system' ? 'System' : row.actor?.name || row.actor?._id || 'Former account'}</td>
        <td>{row.actorRole}</td><td>{row.action}</td><td>{row.targetType} · {row.targetId}</td><td>{row.summary}</td>
      </tr>)}</tbody></table></div>
      {rows.length === 0 && <p className="staff-data-note">No matching audit records.</p>}
      <div className="session-dispute-actions">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} · {pagination.total} records</span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page * pagination.limit >= pagination.total} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </>}
  </div>;
}
