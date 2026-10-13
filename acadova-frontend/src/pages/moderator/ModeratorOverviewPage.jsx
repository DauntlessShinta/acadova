import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileCheck, Flag, MessagesSquare, CheckCircle2, TriangleAlert, Clock3, BarChart3, ArrowRight } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import ModerationQueue from '../../components/staff/ModerationQueue';
import { DashboardHeader, DashboardKpis, DashboardPanel, RecordIcon } from '../../components/staff/DashboardPrimitives';
import DashboardTrend from '../../components/staff/DashboardTrend';
import { useDashboardData } from '../../utils/useDashboardData';
import { dailyModeration, readableTime, initials, eventLabel, decisionStatus } from '../../utils/staffPresentation';
import { Link } from 'react-router-dom';
const sources = [['overview', analyticsService.getModeratorDashboard]];
const series = [{ key: 'reviews', label: 'Review decisions recorded' }, { key: 'reports', label: 'Study reports created' }, { key: 'sessions', label: 'Session decisions recorded' }];
export default function ModeratorOverviewPage() {
  const [params, setParams] = useSearchParams();
  const days = [7, 30, 90].includes(Number(params.get('days'))) ? Number(params.get('days')) : 7;
  const [showQueue, setShowQueue] = useState(false);
  const { data, loading, busy, error, updatedAt, refresh } = useDashboardData(sources, { days });
  const overview = data.overview; const counts = overview?.counts;
  const openQueue = () => { setShowQueue(true); requestAnimationFrame(() => document.getElementById('full-review-queue')?.scrollIntoView({ block: 'start' })); };
  return <div className="staff-page operations-dashboard">
    <DashboardHeader title="Moderator Overview" description="Review submitted content, resolve exceptions, and keep learning resources reliable." updatedAt={updatedAt} busy={busy} onRefresh={refresh} />
    <Alert type="danger" message={error} />
    <><span className="sr-only" role="status">{loading ? 'Loading moderation overview...' : ''}</span>
      <DashboardKpis loading={loading} items={[
        { label: 'Pending Reviews', value: counts?.pendingReviews, detail: 'Submitted resources and Study Sets', icon: FileCheck, tone: 'blue' },
        { label: 'Reported Content', value: counts?.reportedContent, detail: 'Open Study Set reports', icon: Flag, tone: 'red' },
        { label: 'Session Disputes', value: counts?.sessionDisputes, detail: 'Sessions explicitly disputed', icon: MessagesSquare, tone: 'violet' },
        { label: 'Decisions Today', value: counts?.decisionsToday, detail: 'Recorded staff decisions \u00b7 UTC', icon: CheckCircle2, tone: 'green' },
      ]} />
      <div className="dashboard-panel-grid">
        <DashboardPanel title="Priority Queue" description="Oldest recorded open cases first." icon={TriangleAlert} action={<button className="dashboard-panel-link" onClick={openQueue}>View all cases<ArrowRight size={16} aria-hidden="true" /></button>}>
          {!overview?.queue ? <p className="dashboard-empty">Review cases are unavailable.</p> : !overview.queue.length ? <p className="dashboard-empty">No open cases in these queues.</p> : <ul className="dashboard-records staff-queue-list">{overview.queue.slice(0, 6).map(row => <li key={row.type + row.id}><Link to={row.href}><RecordIcon icon={row.type === 'dispute' ? MessagesSquare : row.type === 'report' ? Flag : FileCheck} tone={row.type === 'report' ? 'amber' : 'blue'} /><div className="record-copy"><strong>{row.title}</strong><p>{row.detail}</p></div><time dateTime={row.date}>{readableTime(row.date)}</time></Link></li>)}</ul>}
        </DashboardPanel>
        <DashboardPanel title="Recent Moderation Activity" description="Latest recorded moderation decisions." icon={Clock3}>
          {!overview?.recent ? <p className="dashboard-empty">Recorded decisions are unavailable.</p> : !overview.recent.length ? <p className="dashboard-empty">No recorded moderation decisions yet.</p> : <ul className="dashboard-records">{overview.recent.map(row => <li className="dashboard-record" key={row._id}><RecordIcon icon={FileCheck} initials={initials(row.actor?.name)} tone="violet" /><div className="record-copy"><strong>{row.actor?.name || 'Former staff account'}</strong><p>{row.summary || eventLabel(row.action)}</p><time dateTime={row.createdAt}>{readableTime(row.createdAt)}</time></div><span className="dashboard-status">{decisionStatus(row)}</span></li>)}</ul>}
        </DashboardPanel>
      </div>
      <DashboardPanel title="Moderation Workload Trend" description="Recorded review decisions, new Study reports and Session decisions." icon={BarChart3} className="dashboard-trend-panel"
        action={<div className="dashboard-periods" role="group" aria-label="Moderation trend period">{[7, 30, 90].map(value => <button type="button" key={value} aria-pressed={days === value} onClick={() => { const next = new URLSearchParams(params); next.set('days', String(value)); setParams(next); }}>{value} days</button>)}</div>}>
        {overview?.from && overview?.to ? <DashboardTrend rows={dailyModeration(overview.trend, overview)} series={series} emptyText="No recorded moderation activity in this period." /> : <p className="dashboard-empty">Workload trend is unavailable.</p>}
      </DashboardPanel>
      <details className="dashboard-help"><summary>About these moderation records</summary><p>Counts use actual stored states. The queue is ordered by recorded age, with no invented severity. Explicit review referrals can appear alongside disputes. Draft topics, modules and assessments, resolved cases and review recommendations remain available in the full review queue.</p><p>Decisions Today uses the UTC calendar day and includes recorded Administrator and Moderator moderation decisions. Trend dates use UTC. Report creation counts first submissions, not later reopening cycles. Normal sessions need no mandatory Moderator approval. Updates are checked every 45 seconds while visible.</p></details>
      {showQueue && <ModerationQueue />}
    </>
  </div>;
}
