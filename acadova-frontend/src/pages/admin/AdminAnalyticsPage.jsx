import React, { useEffect, useState } from 'react';
import { BarChart3, Coins, Star } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StarRating from '../../components/common/StarRating';

const sources = [
  ['subjects', analyticsService.getSubjectAnalytics],
  ['sessions', analyticsService.getSessionAnalytics],
  ['ratings', analyticsService.getRatingAnalytics],
  ['credits', analyticsService.getCreditAnalytics],
];

export const AdminAnalyticsPage = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled(sources.map(([, fetcher]) => fetcher()));
    setData(Object.fromEntries(sources.map(([key], index) => [key, results[index].status === 'fulfilled' ? results[index].value.data : null])));
    if (results.some((result) => result.status === 'rejected')) setError('Some analytics data could not be loaded.');
    setLoading(false);
  };

  useEffect(() => { Promise.resolve().then(load); }, []);
  const maxDemand = Math.max(1, ...(data.subjects || []).map((item) => item.requestCount || 0));
  const statusRows = [
    ['Requested', 'pending'], ['Accepted', 'accepted'],
    ['Tutor marked complete', 'completed'], ['Declined', 'rejected'], ['Cancelled', 'cancelled'],
  ];

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Analytics</span><h1>Platform analytics</h1><p>Session, subject, rating, and credit activity from Acadova records.</p></div></header>
      <Alert type="danger" message={error} />
      {loading ? <LoadingSpinner text="Loading platform analytics..." size={34} /> : (
        <>
          <div className="grid-3 admin-analytics-cards">
            <div className="card metric-panel"><span><Star size={17} /> Average visible rating</span><strong className="mono">{data.ratings ? data.ratings.averageRating == null ? 'No ratings yet' : Number(data.ratings.averageRating).toFixed(2) : 'Unavailable'}</strong><small>{data.ratings ? `${data.ratings.totalRatings} visible reviews` : 'Data could not be loaded'}</small></div>
            <div className="card metric-panel"><span><Coins size={17} /> Credits transferred</span><strong className="mono">{data.credits ? data.credits.totalCreditsMoved : 'Unavailable'}</strong><small>{data.credits ? `${data.credits.totalTransactions} transfers` : 'Data could not be loaded'}</small></div>
            <div className="card metric-panel"><span><BarChart3 size={17} /> Total sessions</span><strong className="mono">{data.sessions ? data.sessions.total : 'Unavailable'}</strong><small>All recorded session states</small></div>
          </div>
          <div className="grid-2 admin-analytics-grid">
            <section className="card"><h2>Session status</h2>{!data.sessions ? <p>Session analytics are unavailable.</p> : <><p className="staff-data-note">“Tutor marked complete” includes sessions awaiting learner confirmation.</p><div className="status-list">{statusRows.map(([label, key]) => <div key={key}><span>{label}</span><strong className="mono">{data.sessions.byStatus?.[key] || 0}</strong></div>)}</div></>}</section>
            <section className="card"><h2>Visible review distribution</h2>{!data.ratings ? <p>Rating analytics are unavailable.</p> : data.ratings.totalRatings === 0 ? <EmptyState icon={Star} title="No visible reviews yet" description="Review distribution appears after confirmed exchanges are reviewed." /> : <><div className="rating-summary"><strong className="mono">{Number(data.ratings.averageRating).toFixed(2)}</strong><StarRating rating={data.ratings.averageRating} size={18} /></div><div className="rating-distribution">{[5, 4, 3, 2, 1].map((stars) => { const count = data.ratings.distribution?.find((item) => item._id === stars)?.count || 0; return <div key={stars}><span>{stars} star</span><span className="analytics-bar" aria-label={`${count} ${stars}-star ratings`}><span style={{ width: `${Math.round(count / data.ratings.totalRatings * 100)}%` }} /></span><span className="mono">{count}</span></div>; })}</div></>}</section>
          </div>
          <section className="card subject-demand-panel"><div className="panel-heading"><div><h2>Subject demand</h2><p>Subjects ranked by session requests.</p></div><BarChart3 size={22} /></div>{!data.subjects ? <p>Subject analytics are unavailable.</p> : data.subjects.length === 0 ? <EmptyState icon={BarChart3} title="No subject demand data yet" description="Demand appears as students request sessions." /> : <div className="subject-demand-list">{data.subjects.map((item) => <div key={item.subject}><div><strong>{item.subject}</strong><span>{item.requestCount} request{item.requestCount === 1 ? '' : 's'}</span></div><span className="analytics-bar"><span style={{ width: `${Math.round(item.requestCount / maxDemand * 100)}%` }} /></span></div>)}</div>}</section>
          {error && <button type="button" className="btn btn-secondary btn-sm staff-retry" onClick={load}>Retry unavailable analytics</button>}
        </>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
