import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, FileCheck, Flag, GraduationCap, History, ShieldCheck, TriangleAlert, Users, Zap } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import { DashboardKpis, DashboardPanel, PanelLink, RecordIcon } from '../../components/staff/DashboardPrimitives';
import { StaffPageHeader, StaffNotes, StaffLineChart, StaffBars } from '../../components/staff/StaffDashboardUi';
import { useDashboardData } from '../../utils/useDashboardData';
import { useStaffPeriod } from '../../utils/useStaffPeriod';
import { fillDays } from '../../utils/analyticsPresentation';
import { readableTime, initials, eventLabel } from '../../utils/staffPresentation';
const sources = [['users', analyticsService.getAdminOverview], ['operations', analyticsService.getAdminOperations], ['activity', analyticsService.getAdminDashboard], ['subjects', analyticsService.getSubjectAnalytics], ['sessions', analyticsService.getSessionAnalytics]];
const series = [{ key: 'signups', label: 'Registered accounts' }, { key: 'requests', label: 'Session requests' }];
export default function AdminOverviewPage() {
  const { range, invalid, change } = useStaffPeriod();
  const { data, loading, busy, error, updatedAt, refresh } = useDashboardData(sources, range, !invalid);
  const users = data.users, ops = data.operations, statuses = ops?.byStatus || {};
  const attention = [
    ['Reported content', ops?.openStudyReports, 'Open Study Set reports', '/admin/study-sets?case=reports', Flag, 'red'],
    ['Session disputes', ops ? statuses.disputed || 0 : null, 'Explicit disputes requiring a staff decision', '/admin/disputes', TriangleAlert, 'violet'],
    ['Learning resource submissions', ops?.pendingResources, 'Submitted resources awaiting publication review', '/admin/learning#manage-panel-resources', BookOpen, 'amber'],
    ['Unverified accounts', users?.unverified, 'Accounts explicitly awaiting email verification', '/admin/users?status=unverified', Users, 'blue'],
  ];
  const days = new Map((data.activity?.signups || []).map(row => [row._id, { date: row._id, signups: row.count }]));
  for (const row of data.sessions?.trend || []) days.set(row._id, { ...(days.get(row._id) || { date: row._id }), requests: row.count });
  return <div className="staff-page staff-dashboard">
    <StaffPageHeader title="Admin Overview" description="Platform health, key metrics and system activity." scope="Role scope: platform operations only" period={{ range, invalid, onChange: change }} updatedAt={updatedAt} busy={busy} refresh={refresh}/>
    <Alert type="danger" message={error || invalid}/>
    <DashboardKpis loading={loading} items={[
      { label: 'Total Users', value: users?.total, detail: 'Registered accounts', icon: Users, tone: 'blue' },
      { label: 'Students', value: users?.students, detail: 'Current Student accounts', icon: GraduationCap, tone: 'green' },
      { label: 'Moderators', value: users?.moderators, detail: 'Current Moderator accounts', icon: ShieldCheck, tone: 'violet' },
      { label: 'Open Session Issues', value: ops ? statuses.disputed || 0 : null, detail: 'Current explicitly disputed sessions', icon: Flag, tone: 'red' },
      { label: 'Pending Reviews', value: ops ? ops.pendingResources + ops.pendingStudySets : null, detail: 'Current resource and Study Set queue', icon: FileCheck, tone: 'amber' },
    ]}/>
    <div className="staff-dashboard-pair dashboard-panel-grid">
      <DashboardPanel title="Needs Attention" description="Recorded items requiring follow-up." icon={TriangleAlert} action={<PanelLink to="/admin/moderation"/>}><ul className="dashboard-records attention-list">{attention.map(([title, count, description, to, Icon, tone]) => <li key={title}><Link to={to}><RecordIcon icon={Icon} tone={tone}/><div className="record-copy"><strong>{title}</strong><p>{description}</p></div><span className="record-count">{count ?? 'Unavailable'}</span></Link></li>)}</ul></DashboardPanel>
      <DashboardPanel title="Recent Admin Activity" description="Recorded administrative and moderation actions in this period." icon={History} action={<PanelLink to="/admin/trust-activity?tab=activity"/>}>{!data.activity ? <p className="staff-chart-empty">{loading ? 'Loading recorded actions...' : 'Activity unavailable. Refresh to retry.'}</p> : !data.activity.recent.length ? <p className="staff-chart-empty">No recorded actions in this period.</p> : <ul className="dashboard-records">{data.activity.recent.map(row => <li className="dashboard-record" key={row._id}><RecordIcon initials={initials(row.actor?.name) || 'S'}/><div className="record-copy"><strong>{row.actor?.name || 'Former staff account'}</strong><p>{row.summary || eventLabel(row.action)}</p></div><time dateTime={row.createdAt}>{readableTime(row.createdAt)}</time></li>)}</ul>}</DashboardPanel>
    </div>
    <div className="staff-overview-bottom"><DashboardPanel title="Platform Snapshot" description="Recorded events in the selected UTC period." icon={BarChart3}><div className="staff-snapshot-grid"><div><h3>Platform activity over time</h3>{data.activity && data.sessions ? <StaffLineChart rows={fillDays(range, [...days.values()], ['signups', 'requests'])} series={series}/> : <p className="staff-chart-empty">Activity unavailable.</p>}</div><div><h3>Top-demand subjects</h3><p className="staff-small-note">Session requests created in this period.</p>{data.subjects ? data.subjects.length ? <StaffBars rows={data.subjects.slice(0, 5).map(row => ({ label: row.subject, value: row.requestCount }))}/> : <p className="staff-chart-empty">No recorded subject demand.</p> : <p className="staff-chart-empty">Subject demand unavailable.</p>}</div></div></DashboardPanel>
      <DashboardPanel title="Quick Actions" description="Common administrative tasks." icon={Zap}><div className="staff-quick-actions">{[['/admin/users', 'Manage Users', 'View and manage authorized accounts', Users], ['/admin/moderation', 'Review Escalations', 'Review recorded content and session cases', Flag], ['/admin/trust-activity?tab=activity', 'View Audit Log', 'Browse recorded platform actions', ShieldCheck]].map(([to, title, text, Icon]) => <Link key={to} to={to}><RecordIcon icon={Icon}/><div><strong>{title}</strong><p>{text}</p></div><span aria-hidden="true">&rsaquo;</span></Link>)}</div></DashboardPanel></div>
    <StaffNotes/>
    <details className="staff-dashboard-details"><summary>Data definitions and compatibility</summary><p>Account and queue KPIs are current snapshots, not date-filtered cohorts or active-user estimates. Trends and recent actions use the selected period. Historical accounts with absent email-verification metadata remain distinct from explicitly unverified accounts. Session requests, account registrations and completion are independent events. Existing credit history remains available in Policies &amp; Settings.</p></details>
  </div>;
}
