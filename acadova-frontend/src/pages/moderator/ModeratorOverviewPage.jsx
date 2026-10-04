import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import moderationService from '../../services/moderationService';
import learningService from '../../services/learningService';
import assessmentService from '../../services/assessmentService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatSessionDateTime } from '../../utils/sessionPresentation';

const empty = { disputes: [], resolved: [], resources: [], topics: [], modules: [], assessments: [] };
const names = Object.keys(empty);
const kind = (item) => item.type === 'activity' ? 'Review recommended'
  : item.type === 'content' ? 'Learning content' : 'Session dispute';

export default function ModeratorOverviewPage() {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('open');
  const [sort, setSort] = useState('oldest');
  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      moderationService.getDisputedSessions(), moderationService.getResolvedSessions(),
      learningService.staffResources(), learningService.staffTopics(),
      learningService.staffModules(), assessmentService.staffList(),
    ]);
    setData(Object.fromEntries(names.map((name, index) =>
      [name, results[index].status === 'fulfilled' ? results[index].value.data || [] : []])));
    setError(results.some((result) => result.status === 'rejected')
      ? 'Some queue sections could not be loaded. Refresh to try again.' : '');
    setLoading(false);
  };
  useEffect(() => { Promise.resolve().then(load); }, []);
  const rows = useMemo(() => {
    const items = [
      ...data.disputes.map((row) => ({ id: row._id, type: 'dispute', status: 'open',
        title: row.subject, detail: `Disputed by ${row.disputedBy?.name || 'a participant'}`,
        date: row.disputedAt, to: '/moderator/disputes', priority: 1 })),
      ...data.resources.filter((row) => row.reviewStatus === 'submitted').map((row) => ({
        id: row.id, type: 'content', status: 'open', title: row.title,
        detail: 'Resource awaiting review', date: row.createdAt, to: '/moderator/learning#manage-resources', priority: 2 })),
      ...data.topics.filter((row) => row.status === 'draft').map((row) => ({
        id: row.id, type: 'content', status: 'open', title: row.name,
        detail: 'Topic draft', date: row.createdAt, to: '/moderator/learning#manage-topics', priority: 3 })),
      ...data.modules.filter((row) => row.status === 'draft').map((row) => ({
        id: row.id, type: 'content', status: 'open', title: row.title,
        detail: 'Module draft', date: row.createdAt, to: '/moderator/learning#manage-modules', priority: 3 })),
      ...data.assessments.filter((row) => row.status === 'draft').map((row) => ({
        id: row.id, type: 'content', status: 'open', title: row.title,
        detail: 'Assessment draft', date: row.createdAt, to: '/moderator/assessments', priority: 3 })),
      ...data.disputes.filter((row) => row.reviewIndicators?.includes('prior_credit_transaction'))
        .map((row) => ({ id: `signal-${row._id}`, type: 'activity', status: 'open',
          title: row.subject, detail: 'Disputed Session has a recorded credit transaction',
          date: row.disputedAt, to: '/moderator/disputes', priority: 0 })),
      ...data.resolved.map((row) => ({ id: row._id, type: 'dispute', status: 'resolved',
        title: row.subject, detail: row.resolution === 'confirm_session' ? 'Resolved as valid' : 'Resolved as invalid',
        date: row.resolvedAt, to: '/moderator/disputes?status=resolved', priority: 4 })),
    ];
    return items.filter((item) => item.status === status && (type === 'all' || item.type === type))
      .sort((a, b) => sort === 'priority' ? a.priority - b.priority
        : sort === 'oldest' ? new Date(a.date || 0) - new Date(b.date || 0)
          : new Date(b.date || 0) - new Date(a.date || 0));
  }, [data, type, status, sort]);

  return <div className="staff-page"><header className="staff-page-header"><div>
    <span className="staff-eyebrow">Moderator / Exceptions</span><h1>Needs Attention</h1>
    <p>Normal tutoring sessions need no Moderator approval. Review exceptions and learning content here.</p>
  </div></header><Alert type="danger" message={error} />
    {loading ? <LoadingSpinner text="Loading review queue..." /> : <>
      <div className="staff-queue-summary card"><strong>{data.disputes.length} Session disputes</strong>
        <strong>{data.resources.filter((row) => row.reviewStatus === 'submitted').length} resource reviews</strong>
        <strong>{data.disputes.filter((row) => row.reviewIndicators?.includes('prior_credit_transaction')).length} review recommendations</strong>
        <Link to="/moderator/reviews">Browse review moderation</Link></div>
      <div className="staff-queue-filters card">
        <label>Status <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="resolved">Resolved</option></select></label>
        <label>Type <select className="form-select" value={type} onChange={(event) => setType(event.target.value)}><option value="all">All</option><option value="dispute">Disputes</option><option value="content">Learning content</option><option value="activity">Review recommended</option></select></label>
        <label>Sort <select className="form-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="oldest">Oldest first</option><option value="newest">Newest first</option><option value="priority">Priority</option></select></label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Refresh queue</button>
      </div>
      <p className="form-hint">{rows.length} items in this view. Review recommendations are not fraud findings.</p>
      {rows.length ? <div className="staff-queue-list">{rows.map((item) => <article className="card" key={`${item.type}-${item.id}`}>
        <span className="staff-eyebrow">{kind(item)}</span><h2>{item.title}</h2><p>{item.detail}</p>
        <p className="form-hint">{formatSessionDateTime(item.date) || 'Time unavailable'}</p>
        <Link to={item.to} className="btn btn-primary btn-sm">Review</Link>
      </article>)}</div> : <p className="card">No items match this view. <Link to="/moderator/reviews">Browse review moderation</Link>.</p>}
    </>}
  </div>;
}
