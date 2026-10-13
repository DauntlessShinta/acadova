import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import moderationService from '../../services/moderationService';
import learningService from '../../services/learningService';
import assessmentService from '../../services/assessmentService';
import studyService from '../../services/studyService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatSessionDateTime } from '../../utils/sessionPresentation';
import { staffLearningHash } from '../../utils/staffLearningNavigation';

const empty = { disputes: [], resolved: [], resources: [], topics: [], modules: [], assessments: [], study: [] };
const names = Object.keys(empty);
const kind = (item) => item.type === 'study' ? 'Study Set review' : item.type === 'activity' ? 'Review recommended'
  : item.type === 'content' ? 'Learning content' : 'Session exception';

export default function ModerationQueue() {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState({});
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('open');
  const [sort, setSort] = useState('oldest');
  const [search, setSearch] = useState('');
  const version = useRef(0);
  const load = async () => {
    const current = ++version.current;
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      moderationService.getDisputedSessions(), moderationService.getResolvedSessions(),
      learningService.staffResources(), learningService.staffTopics(),
      learningService.staffModules(), assessmentService.staffList(), studyService.staffList(),
    ]);
    if (version.current !== current) return;
    setAvailability(Object.fromEntries(names.map((name, index) => [name, results[index].status === 'fulfilled'])));
    setData(Object.fromEntries(names.map((name, index) =>
      [name, results[index].status === 'fulfilled' ? results[index].value.data || [] : []])));
    setError(results.some((result) => result.status === 'rejected')
      ? 'Some queue sections could not be loaded. Refresh to try again.' : '');
    setLoading(false);
  };
  useEffect(() => { let active = true; Promise.resolve().then(() => { if (active) load(); }); return () => { active = false; version.current += 1; }; }, []);
  const rows = useMemo(() => {
    const items = [
      ...data.study.map(row => ({ id: row.id, type: 'study', status: 'open', title: row.title || 'Untitled study set',
        detail: `${row.state === 'pending' ? 'Publication awaiting review' : 'Reported Study Set'} · ${row.reports.length} open reports · ${row.authorName}`,
        date: row.reports[0]?.createdAt || row.submittedAt || row.updatedAt,
        to: `/moderator/study-sets?set=${row.id}`, priority: row.reports.length ? 2 : 3 })),
      ...data.disputes.map((row) => ({ id: row._id, type: 'dispute', status: 'open',
        title: row.subject, detail: row.disputedBy ? `Disputed by ${row.disputedBy.name || 'a participant'}` : 'Unresolved completion review referral',
        date: row.reviewReferral?.createdAt || row.disputedAt, to: `/moderator/disputes?session=${row._id}`, priority: 1 })),
      ...data.resources.filter((row) => row.reviewStatus === 'submitted').map((row) => ({
        id: row.id, type: 'content', status: 'open', title: row.title,
        detail: 'Resource awaiting review', date: row.createdAt, to: `/moderator/learning${staffLearningHash('resources')}`, priority: 2 })),
      ...data.topics.filter((row) => row.status === 'draft').map((row) => ({
        id: row.id, type: 'content', status: 'open', title: row.name,
        detail: 'Topic draft', date: row.createdAt, to: `/moderator/learning${staffLearningHash('topics')}`, priority: 3 })),
      ...data.modules.filter((row) => row.status === 'draft').map((row) => ({
        id: row.id, type: 'content', status: 'open', title: row.title,
        detail: 'Module draft', date: row.createdAt, to: `/moderator/learning${staffLearningHash('modules')}`, priority: 3 })),
      ...data.assessments.filter((row) => row.status === 'draft').map((row) => ({
        id: row.id, type: 'content', status: 'open', title: row.title,
        detail: 'Assessment draft', date: row.createdAt, to: '/moderator/assessments', priority: 3 })),
      ...data.disputes.filter((row) => row.reviewIndicators?.includes('prior_credit_transaction'))
        .map((row) => ({ id: `signal-${row._id}`, type: 'activity', status: 'open',
          title: row.subject, detail: 'Session exception has a recorded credit transaction',
          date: row.disputedAt, to: '/moderator/disputes', priority: 0 })),
      ...data.resolved.map((row) => ({ id: row._id, type: 'dispute', status: 'resolved',
        title: row.subject, detail: row.status === 'completed' ? 'Closed by participant confirmations' : row.resolution === 'confirm_session' ? 'Resolved as valid' : 'Resolved as invalid',
        date: row.resolvedAt, to: '/moderator/disputes?status=resolved', priority: 4 })),
    ];
    return items.filter((item) => item.status === status && (type === 'all' || item.type === type)
      && (!search.trim() || [item.title, item.detail].some(value => value?.toLowerCase().includes(search.trim().toLowerCase()))))
      .sort((a, b) => sort === 'priority' ? a.priority - b.priority
        : sort === 'oldest' ? new Date(a.date || 0) - new Date(b.date || 0)
          : new Date(b.date || 0) - new Date(a.date || 0));
  }, [data, type, status, sort, search]);

  return <div className="staff-page"><header className="staff-page-header"><div>
    <span className="staff-eyebrow">Moderator / Exceptions</span><h2 id="full-review-queue" tabIndex={-1}>Review queue</h2>
    <p>Normal tutoring sessions need no Moderator approval. Review exceptions and learning content here.</p>
  </div></header><Alert type="danger" message={error} />
    {loading ? <LoadingSpinner text="Loading review queue..." /> : <>
      <div className="staff-queue-summary card"><strong>{availability.disputes ? data.disputes.length : 'Unavailable'} Session exceptions</strong>
        <strong>{availability.resources ? data.resources.filter((row) => row.reviewStatus === 'submitted').length : 'Unavailable'} resource reviews</strong>
        <strong>{availability.disputes ? data.disputes.filter((row) => row.reviewIndicators?.includes('prior_credit_transaction')).length : 'Unavailable'} review recommendations</strong>
        <Link to="/moderator/reviews">Browse review moderation</Link></div>
      <p className="form-hint">{availability.study ? `${data.study.length} loaded Study Set cases awaiting publication or report review.` : 'Study Set queue unavailable.'} Queues are bounded by each source; these counts are not platform totals.</p>
      <div className="staff-queue-filters card">
        <label>Status <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="resolved">Resolved</option></select></label>
        <label>Type <select className="form-select" value={type} onChange={(event) => setType(event.target.value)}><option value="all">All</option><option value="dispute">Session exceptions</option><option value="content">Learning content</option><option value="study">Study Sets and reports</option><option value="activity">Review recommended</option></select></label>
        <label>Search loaded cases<input type="search" className="form-input" maxLength={80} value={search} onChange={event => setSearch(event.target.value)} placeholder="Title, subject or case detail" /></label>
        <label>Sort <select className="form-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="oldest">Oldest first</option><option value="newest">Newest first</option><option value="priority">Review order</option></select></label>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={load}>Refresh queue</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setType('all'); setStatus('open'); setSort('oldest'); }}>Clear filters</button>
      </div>
      <p className="form-hint">{rows.length} items from available sources in this view. Review recommendations are not fraud findings.</p>
      {rows.length ? <div className="staff-queue-list">{rows.map((item) => <article className="card" key={`${item.type}-${item.id}`}>
        <span className="staff-eyebrow">{kind(item)}</span><h2>{item.title}</h2><p>{item.detail}</p>
        <p className="form-hint">{formatSessionDateTime(item.date) || 'Time unavailable'}</p>
        <Link to={item.to} className="btn btn-primary btn-sm">Review</Link>
      </article>)}</div> : <p className="card">{error ? 'The queue is incomplete. Refresh to load unavailable sources.' : 'No items match this view.'} <Link to="/moderator/reviews">Browse review moderation</Link>.</p>}
    </>}
  </div>;
}
