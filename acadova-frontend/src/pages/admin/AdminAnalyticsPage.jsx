import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Coins, Star } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import { useDashboardData } from '../../utils/useDashboardData';
import Alert from '../../components/common/Alert';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarRating from '../../components/common/StarRating';
import { getSessionStatusLabel } from '../../utils/sessionPresentation';
import { ActivityTrend, ComparisonChart } from '../../components/staff/AnalyticsCharts';
import { dailyActivity, recentRange, rangeError } from '../../utils/analyticsPresentation';

const sources = [
  ['subjects', analyticsService.getSubjectAnalytics],
  ['sessions', analyticsService.getSessionAnalytics],
  ['ratings', analyticsService.getRatingAnalytics],
  ['credits', analyticsService.getCreditAnalytics],
  ['learning', analyticsService.getLearningAnalytics],
];

export const AdminAnalyticsPage = () => {
  const [params, setParams] = useSearchParams();
  const defaults = recentRange(30);
  const from = params.get('from') ?? defaults.from;
  const to = params.get('to') ?? defaults.to;
  const rangeKey = `${from}:${to}`;
  const [draftState, setDraftState] = useState({ from, to, rangeKey });
  const draft = draftState.rangeKey === rangeKey ? draftState : { from, to };
  const setDraft = update => setDraftState(current => ({ ...update(current.rangeKey === rangeKey ? current : { from, to }), rangeKey }));
  const [filterState, setFilterState] = useState(null);
  const filterError = filterState?.rangeKey === rangeKey ? filterState.message : '';
  const setFilterError = message => setFilterState({ message, rangeKey });
  const invalidRange = rangeError({ from, to });
  const { data, loading, busy, error, updatedAt, refresh: load } = useDashboardData(sources, { from, to }, !invalidRange);

  const maxDemand = Math.max(1, ...(data.subjects || []).map((item) => item.requestCount || 0));
  const byStatus = data.sessions?.byStatus || {};
  const legacyRows = ['pending', 'accepted', 'completed', 'rejected', 'cancelled'];
  const canonicalRows = ['scheduled', 'in_progress', 'awaiting_validation', 'declined', 'no_show', 'disputed', 'resolved'];
  const statusRows = [
    ...legacyRows,
    ...canonicalRows.filter((status) => Object.hasOwn(byStatus, status)),
  ].map((status) => [
    status === 'accepted' ? 'Scheduled (legacy accepted)'
      : status === 'rejected' ? 'Declined (legacy rejected)'
        : getSessionStatusLabel(status),
    status,
  ]);

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Analytics</span><h1>Platform analytics</h1><p>Session demand, credit movements and learning outcomes from stored Acadova records.</p></div></header>
      <section className="card analytics-filter" aria-label="Analytics period">
        <div className="staff-filter-actions">{[7, 30, 90].map(days => <button type="button" key={days} className="btn btn-secondary btn-sm" aria-pressed={from === recentRange(days).from && to === recentRange(days).to} onClick={() => setParams(recentRange(days))}>Last {days} days</button>)}</div>
        <details className="analytics-custom-range" open={invalidRange ? true : undefined}><summary>Custom date range</summary>
        <form className="staff-filter-bar" onSubmit={event => { event.preventDefault(); const message = rangeError(draft); setFilterError(message); if (!message) setParams({ from: draft.from, to: draft.to }); }}>
          <label>From (UTC)<input type="date" className="form-input" required value={draft.from} onChange={event => setDraft(current => ({ ...current, from: event.target.value }))} /></label>
          <label>To (UTC)<input type="date" className="form-input" required value={draft.to} onChange={event => setDraft(current => ({ ...current, to: event.target.value }))} /></label>
          <button className="btn btn-primary btn-sm">Apply period</button>
        </form><p className="form-error" role="alert">{filterError || invalidRange}</p></details>
        <p className="form-hint" role="status">{invalidRange ? 'Correct the period to load analytics.' : `${from} through ${to}, inclusive (UTC). All charts and KPIs use this period.`}</p>
      </section>
      <div className="dashboard-refresh"><p role="status">{updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : 'No complete refresh yet'} ? Checks every 45 seconds while this page is visible.{busy && !loading ? ' Updating?' : ''}</p><button type="button" className="btn btn-secondary btn-sm" disabled={busy || Boolean(invalidRange)} onClick={load}>Refresh analytics</button></div>
      <Alert type="danger" message={error} />
      {loading ? <LoadingSpinner text="Loading platform analytics..." size={34} /> : !invalidRange && (
        <>
          <div className="admin-analytics-kpis">
            <div className="card metric-panel"><span><Star size={17} /> Average visible rating</span><strong className="tabular">{data.ratings ? data.ratings.averageRating == null ? 'No ratings yet' : Number(data.ratings.averageRating).toFixed(2) : 'Unavailable'}</strong><small>{data.ratings ? `${data.ratings.totalRatings} visible reviews` : 'Data could not be loaded'}</small></div>
            <div className="card metric-panel"><span><Coins size={17} /> Tutoring credits transferred</span><strong className="tabular">{data.credits ? data.credits.breakdown?.sessionTransferred ?? 0 : 'Unavailable'}</strong><small>{data.credits ? `${data.credits.totalTransactions} recorded credit events` : 'Data could not be loaded'}</small></div>
            <div className="card metric-panel"><span><BarChart3 size={17} /> Session requests</span><strong className="tabular">{data.sessions ? data.sessions.total : 'Unavailable'}</strong><small>Created during this period, in any state</small></div>
            <div className="card metric-panel"><span>Official assessment pass rate</span><strong className="tabular">{data.learning ? data.learning.officialPassRate == null ? 'No attempts' : `${data.learning.officialPassRate}%` : 'Unavailable'}</strong><small>{data.learning ? `${data.learning.officialPassed} passed / ${data.learning.officialAttempts} official attempts` : 'Data could not be loaded'}</small></div>
            <div className="card metric-panel"><span>Learning unlocks</span><strong className="tabular">{data.learning ? data.learning.unlocks : 'Unavailable'}</strong><small>Recorded resource and module unlocks</small></div>
          </div>
          <section className="card"><h2>Session activity over time</h2><p className="staff-data-note">Requests use creation dates; tutoring payments use ledger dates. These are independent event counts, not a completion rate or evidence of provider attendance.</p>{data.sessions && data.credits ? <ActivityTrend rows={dailyActivity(data.sessions.trend || [], data.credits.trend || [], { from, to })} /> : <p>Session trend is unavailable. Retry to load both sources.</p>}</section>
          <div className="grid-2 admin-analytics-grid">
            <section className="card"><h2>Credit activity by source</h2><p className="staff-data-note">Internal credits only. Movements do not represent cash, net supply or current balances.</p>{!data.credits ? <p>Credit analytics are unavailable.</p> : <ComparisonChart unit="credits" rows={[
              ['Tutoring transfers', 'sessionTransferred'], ['Starting grants issued', 'initialGranted'],
              ['Assessment rewards issued', 'assessmentAwarded'], ['Learning unlocks spent', 'learningSpent'],
              ['Admin credits added', 'adminAdded'], ['Admin credits removed', 'adminRemoved'],
            ].map(([label, key]) => ({ label, value: data.credits.breakdown?.[key] ?? 0 }))} />}</section>
            <section className="card"><h2>Learning engagement and outcomes</h2><p className="staff-data-note">Counts are submitted attempts and paid unlock records. Practice and Study Set attempts award zero credits; missing historical attempt mode is classified as official.</p>{data.learning ? <ComparisonChart rows={[
              { label: 'Official passed attempts', value: data.learning.officialPassed },
              { label: 'Official failed attempts', value: data.learning.officialAttempts - data.learning.officialPassed },
              { label: 'Official assessment practice', value: data.learning.practiceAttempts },
              { label: 'Study Set quizzes submitted', value: data.learning.studyAttempts },
              { label: 'Resource unlocks', value: data.learning.resourceUnlocks },
              { label: 'Module unlocks', value: data.learning.moduleUnlocks },
            ]} /> : <p>Learning analytics are unavailable.</p>}</section>
            <section className="card"><h2>Current status of requested sessions</h2>{!data.sessions ? <p>Session analytics are unavailable.</p> : <><p className="staff-data-note">Snapshot of Sessions created in this period. Older completed sessions may still await learner confirmation; stored completion is not proof of payment.</p><div className="status-list">{statusRows.map(([label, key]) => <div key={key}><span>{label}</span><strong className="tabular">{data.sessions.byStatus?.[key] || 0}</strong></div>)}</div></>}</section>
            <section className="card"><h2>Visible review distribution</h2>{!data.ratings ? <p>Rating analytics are unavailable.</p> : data.ratings.totalRatings === 0 ? <EmptyState icon={Star} title="No visible reviews yet" description="Review distribution appears after confirmed exchanges are reviewed." /> : <><div className="rating-summary"><StarRating rating={data.ratings.averageRating} size={18} /></div><div className="rating-distribution">{[5, 4, 3, 2, 1].map((stars) => { const count = data.ratings.distribution?.find((item) => item._id === stars)?.count || 0; return <div key={stars}><span>{stars} star</span><span className="analytics-bar" aria-label={`${count} ${stars}-star ratings`}><span style={{ width: `${Math.round(count / data.ratings.totalRatings * 100)}%` }} /></span><span className="tabular">{count}</span></div>; })}</div></>}</section>
          </div>
          <section className="card subject-demand-panel"><div className="panel-heading"><div><h2>Subject demand</h2><p>Top 20 subjects by requests created in this period.</p></div><BarChart3 size={22} aria-hidden="true" /></div>{!data.subjects ? <p>Subject analytics are unavailable.</p> : data.subjects.length === 0 ? <EmptyState icon={BarChart3} title="No subject demand data yet" description="Demand appears as students request sessions." /> : <div className="subject-demand-list">{data.subjects.map((item) => <div key={item.subject}><div><strong>{item.subject}</strong><span>{item.requestCount} request{item.requestCount === 1 ? '' : 's'}</span></div><span className="analytics-bar" aria-hidden="true"><span style={{ width: `${Math.round(item.requestCount / maxDemand * 100)}%` }} /></span></div>)}</div>}</section>
          <section className="card analytics-insights"><h2>What needs attention</h2><ul>
            <li>{data.subjects?.length ? `${data.subjects[0].subject} leads recorded demand (${data.subjects[0].requestCount} requests). Use this to prioritize teaching coverage.` : 'There is insufficient subject data to identify demand.'}</li>
            <li>{data.sessions ? `${(byStatus.awaiting_validation || 0) + (byStatus.disputed || 0)} sessions created in this period currently await confirmation or dispute review. Check the Session directory; normal completion requires no staff approval.` : 'Session backlog data is unavailable.'}</li>
            <li>{data.learning?.officialAttempts ? `Official attempts passed at ${data.learning.officialPassRate}% across ${data.learning.officialAttempts} attempts. Review assessment clarity and learning materials when interpreting this; repeat attempts are counted separately.` : 'No official attempts are available to assess learning outcomes.'}</li>
          </ul><div className="staff-filter-actions"><Link className="btn btn-secondary btn-sm" to="/admin/sessions">Review sessions</Link><Link className="btn btn-secondary btn-sm" to="/admin/assessments">Review assessments</Link></div></section>
          {error && <button type="button" className="btn btn-secondary btn-sm staff-retry" onClick={load}>Retry unavailable analytics</button>}
        </>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
