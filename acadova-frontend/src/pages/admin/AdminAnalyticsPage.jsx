import { Link } from 'react-router-dom';
import { useState } from 'react';
import AdminGrowthAnalytics from '../../components/staff/AdminGrowthAnalytics';
import { BarChart3, FileCheck, Flag, GraduationCap, Lightbulb, Users } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import { DashboardKpis, DashboardPanel } from '../../components/staff/DashboardPrimitives';
import { StaffPageHeader, StaffNotes, StaffLineChart, StaffBars } from '../../components/staff/StaffDashboardUi';
import { useDashboardData } from '../../utils/useDashboardData';
import { useStaffPeriod } from '../../utils/useStaffPeriod';
import { fillDays } from '../../utils/analyticsPresentation';
import { getSessionStatusLabel } from '../../utils/sessionPresentation';
const sources = [['subjects', analyticsService.getSubjectAnalytics], ['sessions', analyticsService.getSessionAnalytics], ['ratings', analyticsService.getRatingAnalytics], ['credits', analyticsService.getCreditAnalytics], ['learning', analyticsService.getLearningAnalytics], ['operations', analyticsService.getAdminOperations], ['activity', analyticsService.getAdminDashboard]];
const series = [{ key: 'requests', label: 'Session requests' }, { key: 'decisions', label: 'Recorded moderation decisions' }];
export default function AdminAnalyticsPage() {
  const [growthOpen,setGrowthOpen]=useState(false);
  const { range, invalid, change } = useStaffPeriod();
  const { data, loading, busy, error, updatedAt, refresh } = useDashboardData(sources, range, !invalid);
  const ops = data.operations, statuses = data.sessions?.byStatus || {}, peak = data.subjects?.[0];
  const days = new Map((data.sessions?.trend || []).map(row => [row._id, { date: row._id, requests: row.count }]));
  for (const row of data.activity?.moderation || []) days.set(row._id, { ...(days.get(row._id) || { date: row._id }), decisions: row.count });
  return <div className="staff-page staff-dashboard">
    <StaffPageHeader title="Admin Analytics" description="Platform usage, content demand and assessment outcomes." scope="Role scope: aggregated platform insights only" period={{ range, invalid, onChange: change }} busy={busy} refresh={refresh} updatedAt={updatedAt}/>
    <Alert type="danger" message={error || invalid}/>
    <DashboardKpis loading={loading} items={[
      { label: 'Session Requests', value: data.sessions?.total, detail: 'Created in selected period', icon: Users, tone: 'blue' },
      { label: 'Pending Reviews', value: ops ? ops.pendingResources + ops.pendingStudySets : null, detail: 'Current open review queue', icon: FileCheck, tone: 'amber' },
      { label: 'Official Assessment Pass Rate', value: data.learning ? data.learning.officialPassRate == null ? 'No attempts' : `${data.learning.officialPassRate}%` : null, detail: data.learning ? `${data.learning.officialPassed} / ${data.learning.officialAttempts} official attempts` : 'Awaiting recorded outcomes', icon: GraduationCap, tone: 'green' },
      { label: 'Subject Demand Peak', value: data.subjects ? peak?.subject || 'No requests' : null, detail: peak ? `${peak.requestCount} recorded requests` : 'Selected period', icon: GraduationCap, tone: 'violet' },
      { label: 'Open Session Issues', value: ops ? ops.byStatus?.disputed || 0 : null, detail: 'Current explicitly disputed sessions', icon: Flag, tone: 'red' },
    ]}/>
    <div className="staff-dashboard-pair">
      <DashboardPanel title="Platform activity over time" description="Session requests and recorded moderation events." icon={BarChart3}>{data.sessions && data.activity ? <StaffLineChart rows={fillDays(range, [...days.values()], ['requests', 'decisions'])} series={series}/> : <p className="staff-chart-empty">{loading ? 'Loading activity...' : 'Activity unavailable. Refresh to retry.'}</p>}</DashboardPanel>
      <DashboardPanel title="Top-demand subjects" description="Session requests created in the selected UTC period." icon={BarChart3}>{data.subjects ? data.subjects.length ? <StaffBars rows={data.subjects.slice(0, 8).map(row => ({ label: row.subject, value: row.requestCount }))}/> : <p className="staff-chart-empty">No subject demand in this period.</p> : <p className="staff-chart-empty">Subject demand unavailable.</p>}</DashboardPanel>
    </div>
    <div className="staff-dashboard-thirds">
      <DashboardPanel title="Requested sessions by status" description="Current stored states of requests in this period." icon={BarChart3}>{data.sessions ? <StaffBars rows={Object.entries(statuses).map(([status, value]) => ({ key: status, label: status === 'accepted' ? 'Scheduled (legacy accepted)' : status === 'rejected' ? 'Declined (legacy rejected)' : getSessionStatusLabel(status), value }))}/> : <p className="staff-chart-empty">Session states unavailable.</p>}</DashboardPanel>
      <DashboardPanel title="Assessment outcomes" description="Official submitted attempts in the selected period." icon={BarChart3}>{data.learning ? <StaffBars rows={[{ label: 'Passed', value: data.learning.officialPassed }, { label: 'Failed', value: data.learning.officialAttempts - data.learning.officialPassed }]}/> : <p className="staff-chart-empty">Assessment results unavailable.</p>}</DashboardPanel>
      <DashboardPanel title="What needs attention" description="Recorded values to support review." icon={Lightbulb}><ul className="staff-insight-list"><li><strong>Review current queues</strong><p>{ops ? `${ops.pendingResources + ops.pendingStudySets} resources and Study Sets await review.` : 'Queue data unavailable.'} Normal sessions do not require routine staff approval.</p></li><li><strong>Address subject demand</strong><p>{peak ? `${peak.subject} leads this period with ${peak.requestCount} requests.` : 'No demand peak can be identified.'}</p></li><li><strong>Investigate session issues</strong><p>{ops ? `${ops.byStatus?.disputed || 0} currently disputed sessions require authorized review.` : 'Session issue data unavailable.'}</p></li></ul><Link to="/admin/moderation" className="staff-text-link">Open review queues &rarr;</Link></DashboardPanel>
    </div>
    <details className="staff-dashboard-details"><summary>Credit activity, ratings and learning details</summary><p>Historical credit movements are internal credits, not cash or current balances. Session request status is not proof of settlement or provider attendance.</p><div className="staff-dashboard-pair"><DashboardPanel title="Credit activity by source">{data.credits ? <StaffBars rows={Object.entries(data.credits.breakdown || {}).map(([label, value]) => ({ label: ({ sessionTransferred: 'Tutoring transfers', initialGranted: 'Starting grants', assessmentAwarded: 'Assessment rewards', learningSpent: 'Learning unlocks', adminAdded: 'Admin credits added', adminRemoved: 'Admin credits removed' })[label] || label, value }))}/> : <p>Credit analytics unavailable.</p>}</DashboardPanel><DashboardPanel title="Learning and visible reviews"><p>{data.ratings ? data.ratings.averageRating == null ? 'No visible ratings in this period.' : `${data.ratings.totalRatings} visible ratings; average ${data.ratings.averageRating}.` : 'Ratings unavailable.'}</p>{data.learning && <StaffBars rows={[{ label: 'Practice attempts', value: data.learning.practiceAttempts }, { label: 'Study quizzes submitted', value: data.learning.studyAttempts }, { label: 'Resource unlocks', value: data.learning.resourceUnlocks }, { label: 'Module unlocks', value: data.learning.moduleUnlocks }]}/>}</DashboardPanel></div></details>
    {error && <button type="button" className="btn btn-secondary staff-retry" onClick={refresh}>Retry unavailable analytics</button>}
    <details className="staff-dashboard-details" onToggle={event=>setGrowthOpen(event.currentTarget.open)}><summary>EXP &amp; levels — recorded progression</summary>{growthOpen&&<AdminGrowthAnalytics range={range} enabled={!invalid}/>}</details>
    <StaffNotes/>
  </div>;
}
