import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Clock3, FileCheck, Flag, History, MessagesSquare, TriangleAlert, Zap } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import ModerationQueue from '../../components/staff/ModerationQueue';
import { DashboardKpis, DashboardPanel, PanelLink, RecordIcon } from '../../components/staff/DashboardPrimitives';
import { StaffPageHeader, StaffNotes, StaffLineChart, StaffBars } from '../../components/staff/StaffDashboardUi';
import { useDashboardData } from '../../utils/useDashboardData';
import { useStaffPeriod } from '../../utils/useStaffPeriod';
import { fillDays } from '../../utils/analyticsPresentation';
import { readableTime, decisionStatus } from '../../utils/staffPresentation';
const sources = [['overview', analyticsService.getModeratorDashboard], ['analytics', analyticsService.getModeratorAnalytics]];
const series = [{ key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }];
export default function ModeratorOverviewPage() {
  const { range, invalid, change } = useStaffPeriod();
  const [showQueue, setShowQueue] = useState(false);
  const { data, loading, busy, error, updatedAt, refresh } = useDashboardData(sources, range, !invalid);
  const overview = data.overview, counts = overview?.counts, analytics = data.analytics;
  const days = new Map();
  for (const row of analytics?.trend || []) { const value = days.get(row.date) || { date: row.date }; value[row.outcome] = row.count; days.set(row.date, value); }
  const openQueue = () => { setShowQueue(true); requestAnimationFrame(() => document.getElementById('full-review-queue')?.scrollIntoView({ block: 'start' })); };
  return <div className="staff-page staff-dashboard staff-moderation">
    <StaffPageHeader title="Moderator Overview" description="Review submitted content, resolve issues and make moderation decisions." scope="Role scope: moderation queue and content review only" period={{ range, invalid, onChange: change }} busy={busy} refresh={refresh} updatedAt={updatedAt}/>
    <Alert type="danger" message={error || invalid}/>
    <DashboardKpis loading={loading} items={[
      { label: 'Pending Reviews', value: counts?.pendingReviews, detail: 'Current resources and Study Sets', icon: FileCheck, tone: 'blue' },
      { label: 'Reported Content', value: counts?.reportedContent, detail: 'Current open Study Set reports', icon: Flag, tone: 'red' },
      { label: 'Session Disputes', value: counts?.sessionDisputes, detail: 'Current explicitly disputed sessions', icon: MessagesSquare, tone: 'violet' },
      { label: 'Study Sets Awaiting Review', value: counts?.pendingStudySets, detail: 'Current submitted publications', icon: FileCheck, tone: 'green' },
      { label: 'Decisions Today', value: counts?.decisionsToday, detail: 'Recorded staff decisions today, UTC', icon: Clock3, tone: 'amber' },
    ]}/>
    <div className="staff-dashboard-pair dashboard-panel-grid">
      <DashboardPanel title="Priority Queue" description="Oldest recorded open cases first." icon={TriangleAlert} action={<button type="button" className="dashboard-panel-link" onClick={openQueue}>View all cases</button>}>
        {!overview ? <p className="staff-chart-empty">{loading ? 'Loading cases...' : 'Queue unavailable. Refresh to retry.'}</p> : !overview.queue.length ? <p className="staff-chart-empty">No open cases in these queues.</p> : <ul className="dashboard-records">{overview.queue.slice(0, 5).map(row => <li key={row.type + row.id}><Link to={row.href}><RecordIcon icon={row.type === 'dispute' ? MessagesSquare : row.type === 'report' ? Flag : FileCheck} tone={row.type === 'report' ? 'red' : row.type === 'dispute' ? 'violet' : 'blue'}/><div className="record-copy"><strong>{row.title}</strong><p>{row.detail}</p></div><time dateTime={row.date}>{readableTime(row.date)}</time></Link></li>)}</ul>}
      </DashboardPanel>
      <DashboardPanel title="Recent Moderation Activity" description="Latest recorded review and session decisions." icon={History}>{!overview ? <p className="staff-chart-empty">Activity unavailable.</p> : !overview.recent.length ? <p className="staff-chart-empty">No moderation decisions recorded yet.</p> : <ul className="dashboard-records">{overview.recent.slice(0, 5).map(row => <li className="dashboard-record" key={row._id}><RecordIcon icon={FileCheck} tone={decisionStatus(row) === 'Rejected' ? 'red' : 'green'}/><div className="record-copy"><strong>{row.summary}</strong><p>{decisionStatus(row)}</p></div><time dateTime={row.createdAt}>{readableTime(row.createdAt)}</time></li>)}</ul>}</DashboardPanel>
    </div>
    <div className="staff-dashboard-thirds">
      <DashboardPanel title="Queue Snapshot" description="Current open items by content type." icon={BarChart3}>{analytics ? <StaffBars rows={analytics.queue}/> : <p className="staff-chart-empty">Queue counts unavailable.</p>}</DashboardPanel>
      <DashboardPanel title="Moderation Throughput" description="Recorded publication decisions over time." icon={BarChart3} action={<PanelLink to="/moderator/analytics">Analytics</PanelLink>}>{analytics ? <StaffLineChart rows={fillDays(range, [...days.values()], ['approved', 'rejected'])} series={series}/> : <p className="staff-chart-empty">Decision trend unavailable.</p>}</DashboardPanel>
      <DashboardPanel title="Quick Actions" description="Common moderation tasks." icon={Zap}><div className="staff-quick-actions">{[['/moderator/learning#manage-panel-resources', 'Review Resources', 'Submitted learning content', FileCheck], ['/moderator/disputes', 'Resolve Session Issues', 'Review explicit disputes and referrals', MessagesSquare], ['/moderator/analytics', 'Review Decision Activity', 'Recorded moderation outcomes', Clock3]].map(([to, title, text, Icon]) => <Link key={to} to={to}><RecordIcon icon={Icon}/><div><strong>{title}</strong><p>{text}</p></div></Link>)}</div></DashboardPanel>
    </div>
    <StaffNotes>Only submitted content and case metadata relevant to moderation are exposed.</StaffNotes>
    <details className="staff-dashboard-details"><summary>Moderation data definitions</summary><p>Current queue counts are independent of the selected activity period. Decisions Today uses the current UTC day. No invented severity or provider attendance is inferred. Normal sessions require participant confirmation, not mandatory staff approval. Other publication and review workflows remain in the full queue.</p></details>
    {showQueue && <ModerationQueue/>}
  </div>;
}
