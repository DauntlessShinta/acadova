import React, { useState, useEffect } from 'react';
import analyticsService from '../services/analyticsService';
import StatCard from '../components/common/StatCard';
import StarRating from '../components/common/StarRating';
import Badge from '../components/common/Badge';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  ShieldAlert,
  Users,
  BookOpen,
  CheckCircle2,
  Star,
  Coins,
  BarChart3,
  Layers,
  ArrowRight,
  Search,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const AdminDashboardPage = () => {
  const [subjectDemand, setSubjectDemand] = useState([]);
  const [sessionStats, setSessionStats] = useState(null);
  const [ratingStats, setRatingStats] = useState(null);
  const [creditStats, setCreditStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError('');

      const [subjectsRes, sessionsRes, ratingsRes, creditsRes, usersRes] = await Promise.all([
        analyticsService.getSubjectAnalytics().catch(() => ({ data: [] })),
        analyticsService.getSessionAnalytics().catch(() => ({ data: { total: 0, byStatus: {} } })),
        analyticsService.getRatingAnalytics().catch(() => ({ data: { averageRating: null, totalRatings: 0, distribution: [] } })),
        analyticsService.getCreditAnalytics().catch(() => ({ data: { totalTransactions: 0, totalCreditsMoved: 0 } })),
        analyticsService.getAdminUsers().catch(() => ({ data: [] })),
      ]);

      setSubjectDemand(subjectsRes?.data || []);
      setSessionStats(sessionsRes?.data || { total: 0, byStatus: {} });
      setRatingStats(ratingsRes?.data || { averageRating: null, totalRatings: 0, distribution: [] });
      setCreditStats(creditsRes?.data || { totalTransactions: 0, totalCreditsMoved: 0 });
      setUsersList(usersRes?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load administrative analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.skillsToTeach || []).some((s) => s.toLowerCase().includes(q))
    );
  });

  const maxRequestCount = subjectDemand.length > 0
    ? Math.max(...subjectDemand.map((d) => d.requestCount), 1)
    : 1;

  if (loading) {
    return <LoadingSpinner text="Executing MapReduce pipelines & analytics..." size={36} />;
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brass-600)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
            <ShieldAlert size={16} /> Platform Administration & Insights
          </div>
          <h1 style={{ fontSize: '2rem', color: 'var(--navy-900)', margin: '4px 0 0' }}>
            Admin Analytics Dashboard
          </h1>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchAdminData}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Run MapReduce Analytics
        </button>
      </div>

      <Alert type="danger" message={error} onClose={() => setError('')} />

      {/* PLATFORM KPI STAT CARDS */}
      <div className="stat-grid" style={{ marginBottom: '32px' }}>
        <StatCard
          title="Total Registered Users"
          value={usersList.length}
          subtitle="Students & Administrators"
          icon={Users}
          color="var(--navy-800)"
        />
        <StatCard
          title="Total Study Sessions"
          value={sessionStats?.total || 0}
          subtitle={`${sessionStats?.byStatus?.completed || 0} completed`}
          icon={BookOpen}
          color="var(--brass-600)"
        />
        <StatCard
          title="Platform Average Rating"
          value={ratingStats?.averageRating ? `${ratingStats.averageRating}★` : '5.0★'}
          subtitle={`${ratingStats?.totalRatings || 0} verified reviews`}
          icon={Star}
          color="var(--brass-500)"
        />
        <StatCard
          title="Credit Volume Moved"
          value={`${creditStats?.totalCreditsMoved || 0} Cr`}
          subtitle={`${creditStats?.totalTransactions || 0} completed transfers`}
          icon={Coins}
          color="var(--success-text)"
        />
      </div>

      {/* MAPREDUCE SECTION */}
      <div className="card" style={{ marginBottom: '32px', border: '1px solid var(--brass-300)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={22} color="var(--brass-600)" />
            <div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)', fontSize: '1.25rem' }}>
                Subject Demand Frequency (MapReduce Engine)
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-500)' }}>
                Computed via backend MapReduce simulation: <code>mapSessions</code> → <code>groupMappedResults</code> → <code>reduceGroupedResults</code>
              </p>
            </div>
          </div>
          <span className="badge badge-brass">Live MapReduce Query</span>
        </div>

        {/* MAPREDUCE CONCEPT WORKFLOW VISUALIZER */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          alignItems: 'center',
        }}>
          <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Stage 1</span>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--navy-900)' }}>MAP STAGE</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-600)' }}>Session → (Subject, 1)</span>
          </div>

          <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Stage 2</span>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--navy-900)' }}>GROUP / SHUFFLE</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-600)' }}>Key grouping → [1, 1, 1]</span>
          </div>

          <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Stage 3</span>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--navy-900)' }}>REDUCE STAGE</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-600)' }}>Sum frequencies per key</span>
          </div>

          <div style={{ background: 'var(--brass-50)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--brass-300)' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--brass-700)', textTransform: 'uppercase' }}>Outcome</span>
            <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--brass-700)' }}>DEMAND RANKING</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--brass-700)' }}>Sorted demand frequency</span>
          </div>
        </div>

        {/* MAPREDUCE DATA BAR CHART */}
        {subjectDemand.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No session subject data yet"
            description="Subject demand frequencies will appear here as students request and complete study sessions."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {subjectDemand.map((item, idx) => {
              const percentage = Math.round((item.requestCount / maxRequestCount) * 100);

              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: 4 }}>
                    <strong style={{ color: 'var(--navy-900)' }}>{item.subject}</strong>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--brass-700)' }}>
                      {item.requestCount} request{item.requestCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--brass-500), var(--brass-400))',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TWO COLUMNS: SESSION STATUS BREAKDOWN & PEER RATING DISTRIBUTION */}
      <div className="grid-2" style={{ marginBottom: '32px' }}>
        {/* Session Status Card */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-900)', marginBottom: '16px' }}>
            Session Lifecycle Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Completed Sessions', count: sessionStats?.byStatus?.completed || 0, badge: 'badge-success' },
              { label: 'Accepted / Scheduled', count: sessionStats?.byStatus?.accepted || 0, badge: 'badge-navy' },
              { label: 'Pending Requests', count: sessionStats?.byStatus?.pending || 0, badge: 'badge-pending' },
              { label: 'Cancelled Sessions', count: sessionStats?.byStatus?.cancelled || 0, badge: 'badge-danger' },
              { label: 'Rejected Requests', count: sessionStats?.byStatus?.rejected || 0, badge: 'badge-danger' },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                }}
              >
                <span>{row.label}</span>
                <span className={`badge ${row.badge}`}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rating Breakdown Card */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-900)', marginBottom: '16px' }}>
            Peer Rating Score Distribution
          </h3>
          <div style={{ textAlign: 'center', marginBottom: '18px', padding: '16px', background: 'var(--brass-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--brass-300)' }}>
            <div className="mono" style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--navy-900)', lineHeight: 1 }}>
              {ratingStats?.averageRating ? Number(ratingStats.averageRating).toFixed(2) : '5.00'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
              <StarRating rating={ratingStats?.averageRating || 5.0} size={20} />
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-600)' }}>
              Computed from {ratingStats?.totalRatings || 0} peer evaluations
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const row = (ratingStats?.distribution || []).find((d) => d._id === stars);
              const count = row ? row.count : 0;
              const total = ratingStats?.totalRatings || 1;
              const pct = Math.round((count / total) * 100);

              return (
                <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                  <span style={{ width: '32px', fontFamily: 'var(--font-mono)' }}>{stars} ★</span>
                  <div style={{ flex: 1, height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brass-500)' }} />
                  </div>
                  <span className="mono" style={{ width: '28px', textAlign: 'right', color: 'var(--ink-500)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* USER MANAGEMENT TABLE */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-900)', margin: '0 0 4px' }}>
              Platform User Directory
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-500)' }}>
              Registered accounts with active credit balances and expertise profiles.
            </p>
          </div>

          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
              placeholder="Search user name or skill..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found matching search"
            description="Clear search term to view all registered users."
          />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Credits</th>
                  <th>Rating</th>
                  <th>Teaching Skills</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u._id || u.id}>
                    <td>
                      <strong style={{ color: 'var(--navy-900)' }}>{u.name}</strong>
                    </td>
                    <td className="mono" style={{ fontSize: '0.82rem', color: 'var(--ink-600)' }}>
                      {u.email}
                    </td>
                    <td>
                      <Badge status={u.role || 'student'} />
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 700, color: 'var(--brass-700)' }}>
                        {u.credits ?? 0}
                      </span>
                    </td>
                    <td>
                      <StarRating rating={u.rating || 5.0} size={13} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                        {(u.skillsToTeach || []).map((s, idx) => (
                          <span key={idx} className="badge badge-brass" style={{ fontSize: '0.7rem', textTransform: 'none' }}>
                            {s}
                          </span>
                        ))}
                        {(u.skillsToTeach || []).length === 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--ink-400)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: '0.8rem', color: 'var(--ink-500)' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;

