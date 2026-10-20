import { BarChart3, Clock3, FileCheck, Flag, Lightbulb, MessagesSquare, ShieldCheck } from 'lucide-react';
import Alert from '../../components/common/Alert';
import { DashboardKpis, DashboardPanel } from '../../components/staff/DashboardPrimitives';
import { StaffPageHeader, StaffNotes, StaffLineChart, StaffBars, StaffStackedChart } from '../../components/staff/StaffDashboardUi';
import { useDashboardData } from '../../utils/useDashboardData';
import { useStaffPeriod } from '../../utils/useStaffPeriod';
import { fillDays } from '../../utils/analyticsPresentation';
import analyticsService from '../../services/analyticsService';

const sources = [['analytics', analyticsService.getModeratorAnalytics]];
const series = [{ key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }, { key: 'other', label: 'Other recorded decisions' }];
export default function ModeratorAnalyticsPage() {
  const { range, invalid, change } = useStaffPeriod(7);
  const { data, loading, busy, error, refresh, updatedAt } = useDashboardData(sources, range, !invalid);
  const values = data.analytics;
  const daily = new Map();
  for (const row of values?.trend || []) { const day = daily.get(row.date) || { date: row.date }; day[row.outcome] = row.count; daily.set(row.date, day); }
  const rows = fillDays(range, [...daily.values()], series.map(row => row.key));
  return <div className="staff-page staff-dashboard staff-moderation">
    <StaffPageHeader title="Moderator Analytics" description="Review operations, recorded decisions and queue trends." scope="Role scope: review operations analytics only" period={{ range, invalid, onChange: change }} busy={busy} refresh={refresh} updatedAt={updatedAt}/>
    <Alert type="danger" message={error || invalid}/>
    <DashboardKpis loading={loading} items={[
      { label: 'Pending Queue', value: values?.pendingQueue, detail: 'Current open items', icon: FileCheck, tone: 'amber' },
      { label: 'Recorded Decisions', value: values?.reviewDecisions, detail: 'Within selected UTC period', icon: Clock3, tone: 'violet' },
      { label: 'Approval Rate', value: values ? values.approvalRate == null ? 'No decisions' : `${values.approvalRate}%` : null, detail: 'Approvals / approvals + rejections', icon: ShieldCheck, tone: 'green' },
      { label: 'Reported Items', value: values?.reportsCreated, detail: 'Study reports created in period', icon: Flag, tone: 'red' },
      { label: 'Session Issues', value: values?.sessionIssues, detail: 'Current disputes and referrals', icon: MessagesSquare, tone: 'blue' },
    ]}/>
    <div className="staff-dashboard-pair">
      <DashboardPanel title="Moderation throughput over time" description="Recorded decisions by day and outcome." icon={BarChart3}>{values ? <StaffLineChart rows={rows} series={series}/> : <p className="staff-chart-empty">{loading ? 'Loading moderation activity...' : 'Activity unavailable. Refresh to retry.'}</p>}</DashboardPanel>
      <DashboardPanel title="Open queue by content type" description="Current recorded items awaiting review." icon={BarChart3}>{values ? <StaffBars rows={values.queue}/> : <p className="staff-chart-empty">Queue counts unavailable.</p>}</DashboardPanel>
    </div>
    <div className="staff-dashboard-thirds">
      <DashboardPanel title="Decision outcomes" description="Recorded decisions in the selected period." icon={BarChart3}>{values ? <StaffStackedChart rows={rows} series={series}/> : <p className="staff-chart-empty">Outcomes unavailable.</p>}</DashboardPanel>
      <DashboardPanel title="Queue aging" description="Elapsed days since recorded submission." icon={Clock3}>{values ? <StaffBars rows={values.aging.filter(row => row.label !== 'unknown' || row.value).map(row => ({ ...row, label: row.label === 'unknown' ? 'Date unknown' : row.label }))} vertical/> : <p className="staff-chart-empty">Queue ages unavailable.</p>}</DashboardPanel>
      <DashboardPanel title="Operational notes" description="How to interpret these recorded values." icon={Lightbulb}><ul className="staff-insight-list"><li><strong>Current queue snapshot</strong><p>{values ? `${values.pendingQueue} open items across the supported moderation queues.` : 'Refresh to load current queue counts.'}</p></li><li><strong>Decision events, not unique content</strong><p>Repeated publication decisions count separately. Other decisions include closures, archives and session reviews.</p></li><li><strong>No inferred review duration</strong><p>Reliable per-cycle review timings are unavailable. Missing submission dates remain explicitly unknown.</p></li></ul></DashboardPanel>
    </div>
    <StaffNotes>Case-level summaries only; private content stays in authorized review pages.</StaffNotes>
  </div>;
}
