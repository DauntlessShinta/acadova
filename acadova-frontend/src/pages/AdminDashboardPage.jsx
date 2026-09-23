import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Coins,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  UserCog,
  Users,
} from 'lucide-react';
import analyticsService from '../services/analyticsService';
import Alert from '../components/common/Alert';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StarRating from '../components/common/StarRating';
import StatCard from '../components/common/StatCard';

const initialAvailability = {
  subjects: false,
  sessions: false,
  ratings: false,
  credits: false,
  users: false,
};

const getSettledData = (result, fallback) => (
  result.status === 'fulfilled' ? result.value?.data ?? fallback : fallback
);

export const AdminDashboardPage = () => {
  const [subjectDemand, setSubjectDemand] = useState([]);
  const [sessionStats, setSessionStats] = useState(null);
  const [ratingStats, setRatingStats] = useState(null);
  const [creditStats, setCreditStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [availability, setAvailability] = useState(initialAvailability);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changingRoleId, setChangingRoleId] = useState('');

  const fetchAdminData = async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
      setError('');
    }

    const results = await Promise.allSettled([
      analyticsService.getSubjectAnalytics(),
      analyticsService.getSessionAnalytics(),
      analyticsService.getRatingAnalytics(),
      analyticsService.getCreditAnalytics(),
      analyticsService.getAdminUsers(),
    ]);
    const [subjectsResult, sessionsResult, ratingsResult, creditsResult, usersResult] = results;
    const nextAvailability = {
      subjects: subjectsResult.status === 'fulfilled',
      sessions: sessionsResult.status === 'fulfilled',
      ratings: ratingsResult.status === 'fulfilled',
      credits: creditsResult.status === 'fulfilled',
      users: usersResult.status === 'fulfilled',
    };

    setSubjectDemand(getSettledData(subjectsResult, []));
    setSessionStats(getSettledData(sessionsResult, null));
    setRatingStats(getSettledData(ratingsResult, null));
    setCreditStats(getSettledData(creditsResult, null));
    setUsersList(getSettledData(usersResult, []));
    setAvailability(nextAvailability);

    const failedCount = results.filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
      setError(`${failedCount} administration data source${failedCount === 1 ? '' : 's'} could not be loaded. Unavailable values are marked below.`);
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchAdminData({ showLoading: false }));
  }, []);

  const roleCounts = useMemo(() => usersList.reduce((counts, account) => {
    if (account.role === 'student') counts.students += 1;
    if (account.role === 'moderator') counts.moderators += 1;
    return counts;
  }, { students: 0, moderators: 0 }), [usersList]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return usersList;
    return usersList.filter((account) => (
      account.name?.toLowerCase().includes(query)
      || account.email?.toLowerCase().includes(query)
      || account.role?.toLowerCase().includes(query)
    ));
  }, [userSearch, usersList]);

  const handleRoleChange = async (targetUser) => {
    if (targetUser.role === 'admin') return;

    const targetId = targetUser._id || targetUser.id;
    const nextRole = targetUser.role === 'moderator' ? 'student' : 'moderator';
    const action = nextRole === 'moderator' ? 'promote' : 'demote';
    const confirmation = `Are you sure you want to ${action} ${targetUser.name} ${nextRole === 'moderator' ? 'to Moderator' : 'to Student'}?`;
    if (!window.confirm(confirmation)) return;

    try {
      setChangingRoleId(targetId);
      setError('');
      setSuccess('');
      const response = await analyticsService.updateUserRole(targetId, nextRole);
      setUsersList((current) => current.map((account) => (
        (account._id || account.id) === targetId ? response.data : account
      )));
      setSuccess(`${targetUser.name}'s role was changed to ${nextRole}.`);
    } catch (err) {
      setError(err.message || 'The user role could not be updated.');
    } finally {
      setChangingRoleId('');
    }
  };

  const maxRequestCount = Math.max(...subjectDemand.map((item) => item.requestCount || 0), 1);
  const availableValue = (isAvailable, value) => (isAvailable ? value : '—');

  if (loading) {
    return <LoadingSpinner text="Loading platform administration data..." size={36} />;
  }

  return (
    <div className="staff-dashboard admin-dashboard">
      <header className="staff-page-header" id="overview">
        <div>
          <span className="staff-eyebrow"><ShieldCheck size={17} /> Platform administration</span>
          <h1>Acadova Administration</h1>
          <p>Platform overview, account roles, and operational analytics.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchAdminData} disabled={loading}>
          <RefreshCw size={15} /> Refresh platform data
        </button>
      </header>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <section aria-labelledby="platform-summary-heading">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">Overview</span>
            <h2 id="platform-summary-heading">Platform summary</h2>
          </div>
        </div>
        <div className="stat-grid admin-summary-grid">
          <StatCard
            title="Total Users"
            value={availableValue(availability.users, usersList.length)}
            subtitle="All registered accounts"
            icon={Users}
            color="var(--acadova-primary)"
          />
          <StatCard
            title="Students"
            value={availableValue(availability.users, roleCounts.students)}
            subtitle="Peer-learning accounts"
            icon={BookOpen}
            color="var(--acadova-action)"
          />
          <StatCard
            title="Moderators"
            value={availableValue(availability.users, roleCounts.moderators)}
            subtitle="Review moderation staff"
            icon={UserCog}
            color="var(--acadova-primary)"
          />
          <StatCard
            title="Sessions"
            value={availableValue(availability.sessions, sessionStats?.total ?? 0)}
            subtitle={availability.sessions ? `${sessionStats?.byStatus?.completed || 0} completed` : 'Data unavailable'}
            icon={Activity}
            color="var(--acadova-success)"
          />
        </div>
      </section>

      <section className="staff-section" id="users" aria-labelledby="user-management-heading">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">Users</span>
            <h2 id="user-management-heading">User management</h2>
            <p>Manage Moderator access while keeping Administrator accounts protected.</p>
          </div>
          <label className="admin-search">
            <span className="sr-only">Search users</span>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              className="form-input"
              placeholder="Search name, email, or role"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
            />
          </label>
        </div>

        {!availability.users ? (
          <EmptyState icon={Users} title="User directory unavailable" description="Refresh the page to retry the administrator user request." />
        ) : filteredUsers.length === 0 ? (
          <EmptyState icon={Search} title="No matching users" description="Try a different name, email address, or role." />
        ) : (
          <div className="table-responsive">
            <table className="table admin-user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current role</th>
                  <th>Joined</th>
                  <th>Role action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((account) => {
                  const accountId = account._id || account.id;
                  const isAdmin = account.role === 'admin';
                  return (
                    <tr key={accountId}>
                      <td><strong>{account.name}</strong></td>
                      <td className="mono admin-user-email">{account.email}</td>
                      <td><Badge status={account.role || 'student'} /></td>
                      <td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</td>
                      <td>
                        {isAdmin ? (
                          <span className="protected-label"><ShieldCheck size={14} /> Protected</span>
                        ) : (
                          <button
                            type="button"
                            className={`btn btn-sm ${account.role === 'moderator' ? 'btn-secondary' : 'btn-primary'}`}
                            disabled={changingRoleId === accountId}
                            onClick={() => handleRoleChange(account)}
                            aria-label={`${account.role === 'moderator' ? 'Demote' : 'Promote'} ${account.name}`}
                          >
                            {changingRoleId === accountId
                              ? 'Updating…'
                              : account.role === 'moderator'
                                ? 'Demote to Student'
                                : 'Promote to Moderator'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="staff-section" id="analytics" aria-labelledby="analytics-heading">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">Analytics</span>
            <h2 id="analytics-heading">Platform activity</h2>
            <p>Real session, rating, credit, and subject-demand data from existing analytics services.</p>
          </div>
        </div>

        <div className="grid-3 admin-analytics-cards">
          <div className="card metric-panel">
            <span><Star size={17} /> Average visible rating</span>
            <strong className="mono">
              {availability.ratings && ratingStats?.averageRating != null
                ? Number(ratingStats.averageRating).toFixed(2)
                : '—'}
            </strong>
            <small>{availability.ratings ? `${ratingStats?.totalRatings || 0} visible reviews` : 'Data unavailable'}</small>
          </div>
          <div className="card metric-panel">
            <span><Coins size={17} /> Credit activity</span>
            <strong className="mono">{availableValue(availability.credits, creditStats?.totalCreditsMoved ?? 0)}</strong>
            <small>{availability.credits ? `${creditStats?.totalTransactions || 0} completed transfers` : 'Data unavailable'}</small>
          </div>
          <div className="card metric-panel">
            <span><BookOpen size={17} /> Completed sessions</span>
            <strong className="mono">{availableValue(availability.sessions, sessionStats?.byStatus?.completed ?? 0)}</strong>
            <small>{availability.sessions ? `${sessionStats?.total || 0} total sessions` : 'Data unavailable'}</small>
          </div>
        </div>

        <div className="grid-2 admin-analytics-grid">
          <div className="card">
            <h3>Session status</h3>
            {!availability.sessions ? (
              <p>Session analytics are unavailable.</p>
            ) : (
              <div className="status-list">
                {[
                  ['Completed', sessionStats?.byStatus?.completed || 0, 'badge-success'],
                  ['Accepted', sessionStats?.byStatus?.accepted || 0, 'badge-info'],
                  ['Pending', sessionStats?.byStatus?.pending || 0, 'badge-pending'],
                  ['Cancelled', sessionStats?.byStatus?.cancelled || 0, 'badge-danger'],
                  ['Rejected', sessionStats?.byStatus?.rejected || 0, 'badge-danger'],
                ].map(([label, count, badgeClass]) => (
                  <div key={label}><span>{label}</span><span className={`badge ${badgeClass}`}>{count}</span></div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Visible review distribution</h3>
            {!availability.ratings ? (
              <p>Rating analytics are unavailable.</p>
            ) : ratingStats?.totalRatings === 0 ? (
              <EmptyState icon={Star} title="No visible reviews yet" description="Rating distribution will appear after completed sessions are reviewed." />
            ) : (
              <>
                <div className="rating-summary">
                  <strong className="mono">{Number(ratingStats.averageRating).toFixed(2)}</strong>
                  <StarRating rating={ratingStats.averageRating} size={18} />
                </div>
                <div className="rating-distribution">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = ratingStats.distribution?.find((item) => item._id === stars)?.count || 0;
                    const percentage = Math.round((count / ratingStats.totalRatings) * 100);
                    return (
                      <div key={stars}>
                        <span>{stars} star</span>
                        <span className="analytics-bar"><span style={{ width: `${percentage}%` }} /></span>
                        <span className="mono">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card subject-demand-panel">
          <div className="panel-heading">
            <div>
              <h3>Subject demand</h3>
              <p>Requested session subjects ranked by existing platform analytics.</p>
            </div>
            <BarChart3 size={22} />
          </div>
          {!availability.subjects ? (
            <p>Subject analytics are unavailable.</p>
          ) : subjectDemand.length === 0 ? (
            <EmptyState icon={BarChart3} title="No subject demand data yet" description="Demand will appear as students request learning sessions." />
          ) : (
            <div className="subject-demand-list">
              {subjectDemand.map((item) => (
                <div key={item.subject}>
                  <div><strong>{item.subject}</strong><span>{item.requestCount} request{item.requestCount === 1 ? '' : 's'}</span></div>
                  <span className="analytics-bar"><span style={{ width: `${Math.round((item.requestCount / maxRequestCount) * 100)}%` }} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
