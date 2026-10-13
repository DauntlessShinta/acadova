import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, GraduationCap, ShieldCheck, UsersRound, TriangleAlert, Coins, BarChart3, FileCheck, Flag, Clock3, BookOpen } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import { DashboardHeader, DashboardKpis, DashboardPanel, PanelLink, RecordIcon } from '../../components/staff/DashboardPrimitives';
import DashboardTrend from '../../components/staff/DashboardTrend';
import { useDashboardData } from '../../utils/useDashboardData';
import { recentRange, dailyActivity } from '../../utils/analyticsPresentation';
import { ledgerPresentation, readableTime, initials } from '../../utils/staffPresentation';

const sources = [['users', analyticsService.getAdminOverview], ['operations', analyticsService.getAdminOperations],
  ['sessions', analyticsService.getSessionAnalytics], ['credits', analyticsService.getCreditAnalytics], ['ledger', analyticsService.getRecentLedger]];
const series = [{ key: 'requests', label: 'Session requests' }, { key: 'payments', label: 'Tutoring payment records' }];
export default function AdminOverviewPage() {
  const [params, setParams] = useSearchParams();
  const days = [7, 30, 90].includes(Number(params.get('days'))) ? Number(params.get('days')) : 30;
  const range = recentRange(days);
  const { data, loading, busy, error, updatedAt, refresh } = useDashboardData(sources, range);
  const users = data.users; const ops = data.operations; const statuses = ops?.byStatus || {};
  const attention = [
    ['Awaiting participant confirmation', ops ? statuses.awaiting_validation || 0 : null, 'Participants complete the normal confirmation flow', '/admin/sessions?status=awaiting_validation', Clock3, 'blue'],
    ['Open session disputes', ops ? statuses.disputed || 0 : null, 'Explicit disputes requiring a staff decision', '/admin/disputes', Flag, 'red'],
    ['Pending Study Set reviews', ops?.pendingStudySets, 'Saved revisions awaiting publication review', '/admin/study-sets?case=pending', FileCheck, 'amber'],
    ['Submitted learning resources', ops?.pendingResources, 'Resources awaiting publication review', '/admin/learning#manage-panel-resources', BookOpen, 'blue'],
    ['Open Study Set reports', ops?.openStudyReports, 'Recorded reports awaiting review', '/admin/study-sets?case=reports', TriangleAlert, 'amber'],
  ];
  const changePeriod = value => { const next = new URLSearchParams(params); next.set('days', String(value)); setParams(next); };
  return <div className="staff-page operations-dashboard">
    <DashboardHeader title="Admin Overview" description="Monitor platform activity, manage accounts, and follow up on recorded cases." updatedAt={updatedAt} busy={busy} onRefresh={refresh} />
    <Alert type="danger" message={error} />
    <><span className="sr-only" role="status">{loading ? 'Loading platform overview...' : ''}</span>
      <DashboardKpis loading={loading} items={[
        { label: 'Total Users', value: users?.total, detail: 'Registered accounts', icon: Users, tone: 'blue' },
        { label: 'Students', value: users?.students, detail: 'Can learn and teach', icon: GraduationCap, tone: 'green' },
        { label: 'Moderators', value: users?.moderators, detail: 'Moderation accounts', icon: ShieldCheck, tone: 'violet' },
        { label: 'Current Tutoring', value: ops ? (statuses.pending || 0) + (statuses.accepted || 0) + (statuses.scheduled || 0) + (statuses.in_progress || 0) : null, detail: 'Requested, scheduled or in progress', icon: UsersRound, tone: 'amber' },
      ]} />
      <div className="dashboard-panel-grid">
        <DashboardPanel title="Needs Attention" icon={TriangleAlert} action={<PanelLink to="/admin/sessions">View sessions</PanelLink>}>
          <ul className="dashboard-records attention-list">{attention.map(([title, count, description, to, Icon, tone]) => <li key={title}>
            <Link to={to}><RecordIcon icon={Icon} tone={tone} /><div className="record-copy"><strong>{title}</strong><p>{description}</p></div><span className="record-count tabular">{count ?? 'Unavailable'}</span></Link>
          </li>)}</ul>
        </DashboardPanel>
        <DashboardPanel title="Recent Recorded Credit Activity" icon={Coins} action={<PanelLink to="/admin/credits" />}>
          {!data.ledger ? <p className="dashboard-empty">Credit activity is unavailable. Refresh to retry.</p> : !data.ledger.length ? <p className="dashboard-empty">No recorded credit activity yet.</p> : <ul className="dashboard-records">{data.ledger.slice(0, 6).map(row => { const entry = ledgerPresentation(row); return <li key={row._id} className="dashboard-record">
            <RecordIcon icon={Coins} initials={initials(row.toUserName || row.fromUserName)} /><div className="record-copy"><strong>{entry.title}</strong><p>{entry.description}</p></div>
            <div className={'record-value ledger-' + entry.direction}><strong className="tabular">{entry.amount}<span className="sr-only"> credits, {entry.direction}</span></strong><time dateTime={row.createdAt}>{readableTime(row.createdAt)}</time></div>
          </li>; })}</ul>}
        </DashboardPanel>
      </div>
      <DashboardPanel title="Platform Activity Trend" description="Session requests and tutoring payment records over time." icon={BarChart3} className="dashboard-trend-panel"
        action={<div className="dashboard-periods" role="group" aria-label="Activity trend period">{[7, 30, 90].map(value => <button type="button" key={value} aria-pressed={days === value} onClick={() => changePeriod(value)}>{value} days</button>)}</div>}>
        {data.sessions && data.credits ? <DashboardTrend rows={dailyActivity(data.sessions.trend || [], data.credits.trend || [], range)} series={series} /> : <p className="dashboard-empty">Activity trend is unavailable. Refresh to retry.</p>}
      </DashboardPanel>
      <details className="dashboard-help"><summary>How to read this overview</summary><p>Account and current-session counts are platform totals. Only the trend uses the selected inclusive UTC period. Current Tutoring includes legacy accepted schedules and does not prove attendance. Requests use creation dates; payments use ledger dates. These independent events are not a completion rate.</p><p>Credits are internal ledger movements, not cash or current wallet balances. Transfers are shown without an issuance or debit sign. The confirmation queue uses the stored awaiting-validation state; normal sessions require participant confirmations, not routine staff approval. <Link to="/admin/sessions?status=completed">Review historical completion records separately</Link>.</p><p>{users ? `${users.suspended} suspended accounts; ${users.unverified} explicitly awaiting verification. Historical accounts with absent verification metadata are not counted as unverified.` : 'Account health information is unavailable.'} Updates are checked every 45 seconds while this page is visible.</p><PanelLink to="/admin/analytics">Explore Analytics</PanelLink></details>
    </>
  </div>;
}
