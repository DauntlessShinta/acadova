import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Coins, GraduationCap, Inbox, Search, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import userService from '../services/userService';
import Alert from '../components/common/Alert';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatCard from '../components/common/StatCard';
import PeerCard from '../components/student/PeerCard';
import SessionCard from '../components/student/SessionCard';
import { getSessionPerspective } from '../utils/sessionPresentation';

export const DashboardPage = () => {
  const { user, credits, refreshUser } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [recommendedPeers, setRecommendedPeers] = useState([]);
  const [availability, setAvailability] = useState({ sessions: false, peers: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadDashboardData = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
      setError('');
    }

    const [sessionsResult, peersResult] = await Promise.allSettled([
      sessionService.getMySessions(),
      userService.searchTutors(),
    ]);

    setAvailability({
      sessions: sessionsResult.status === 'fulfilled',
      peers: peersResult.status === 'fulfilled',
    });

    if (sessionsResult.status === 'fulfilled') {
      setSessions(sessionsResult.value?.data || []);
    }
    if (peersResult.status === 'fulfilled') {
      const currentUserId = String(user?._id || user?.id || '');
      const studentPeers = (peersResult.value?.data || []).filter((peer) => (
        peer.role === 'student' && String(peer._id) !== currentUserId
      ));
      setRecommendedPeers(studentPeers.slice(0, 4));
    }

    const failedCount = [sessionsResult, peersResult].filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
      setError('Some dashboard information could not be loaded. Refresh the page to try again.');
    }
    setLoading(false);
  }, [user?._id, user?.id]);

  useEffect(() => {
    Promise.resolve().then(() => loadDashboardData({ showLoading: false }));
  }, [loadDashboardData]);

  const upcomingSessions = useMemo(() => sessions
    .filter((session) => session.status === 'accepted' || (session.status === 'completed' && !session.confirmedAt))
    .sort((left, right) => {
      const leftDate = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right.scheduledAt ? new Date(right.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    }), [sessions]);

  const pendingSessions = sessions.filter((session) => session.status === 'pending');
  const pendingTeachingRequests = pendingSessions.filter((session) => (
    getSessionPerspective(session, user).isTeaching
  ));

  const handleUpdateStatus = async (sessionId, nextStatus) => {
    if (nextStatus === 'rejected' && !window.confirm('Decline this session request? The learner will need to find another peer.')) return;
    try {
      setActionLoading(true);
      setError('');
      setActionSuccess('');
      await sessionService.updateSessionStatus(sessionId, nextStatus);
      setActionSuccess(nextStatus === 'accepted' ? 'Session accepted.' : 'Session declined.');
      await refreshUser();
      await loadDashboardData({ showLoading: false });
    } catch (err) {
      setError(err.message || `The session could not be updated to ${nextStatus}.`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading your Acadova dashboard..." size={36} />;
  }

  return (
    <div className="student-dashboard">
      <header className="student-page-header">
        <div>
          <span className="student-eyebrow">Student workspace</span>
          <h1>Welcome back, {user?.name || 'Student'}</h1>
          <p>Learn from peers, share what you know, and keep your sessions moving.</p>
        </div>
        <Link to="/tutors" className="btn btn-primary">
          <Search size={16} /> Find Peers
        </Link>
      </header>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={actionSuccess} onClose={() => setActionSuccess('')} />

      <section aria-labelledby="student-summary-heading">
        <h2 id="student-summary-heading" className="sr-only">Student summary</h2>
        <div className="stat-grid student-summary-grid">
          <StatCard title="Credit Balance" value={credits} subtitle="Available learning credits" icon={Coins} color="var(--acadova-action)" />
          <StatCard title="Active Sessions" value={availability.sessions ? upcomingSessions.length : '—'} subtitle={availability.sessions ? 'Accepted or awaiting confirmation' : 'Data unavailable'} icon={BookOpen} color="var(--acadova-success)" />
          <StatCard title="Pending Requests" value={availability.sessions ? pendingSessions.length : '—'} subtitle={availability.sessions ? `${pendingTeachingRequests.length} awaiting your response` : 'Data unavailable'} icon={Inbox} color="var(--acadova-warning)" />
          <StatCard title="Recommended Peers" value={availability.peers ? recommendedPeers.length : '—'} subtitle={availability.peers ? 'Available student peers' : 'Data unavailable'} icon={Users} color="var(--acadova-primary)" />
        </div>
      </section>

      <div className="student-dashboard-grid">
        <section className="student-dashboard-main" aria-labelledby="upcoming-heading">
          <div className="student-section-heading">
            <div>
              <span>Sessions</span>
              <h2 id="upcoming-heading">Active sessions</h2>
            </div>
            <Link to="/sessions">View all sessions</Link>
          </div>
          {!availability.sessions ? (
            <EmptyState icon={BookOpen} title="Sessions unavailable" description="Refresh the page to load your upcoming sessions." />
          ) : upcomingSessions.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No upcoming sessions"
              description="Accepted sessions and sessions awaiting confirmation will appear here."
              actionText="Find a Peer"
              onAction={() => { window.location.href = '/tutors'; }}
            />
          ) : (
            <div className="student-card-list">
              {upcomingSessions.slice(0, 3).map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  currentUser={user}
                  actionLoading={actionLoading}
                  onStatusChange={handleUpdateStatus}
                  compact
                />
              ))}
            </div>
          )}
        </section>

        <aside className="student-dashboard-side" aria-labelledby="pending-heading">
          <div className="student-section-heading">
            <div>
              <span>My teaching</span>
              <h2 id="pending-heading">Pending requests</h2>
            </div>
            <span className="badge badge-pending">{pendingTeachingRequests.length}</span>
          </div>
          {!availability.sessions ? (
            <EmptyState icon={Inbox} title="Requests unavailable" description="Refresh the page to load incoming requests." />
          ) : pendingTeachingRequests.length === 0 ? (
            <EmptyState icon={Inbox} title="No requests to review" description="New requests from students learning your subjects will appear here." />
          ) : (
            <div className="student-card-list">
              {pendingTeachingRequests.slice(0, 3).map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  currentUser={user}
                  actionLoading={actionLoading}
                  onStatusChange={handleUpdateStatus}
                  compact
                />
              ))}
            </div>
          )}
        </aside>
      </div>

      <section className="student-skills-section" aria-labelledby="skills-heading">
        <div className="student-section-heading">
          <div>
            <span>Academic profile</span>
            <h2 id="skills-heading">Learning and teaching</h2>
          </div>
          <Link to="/profile">Manage skills</Link>
        </div>
        <div className="grid-2">
          <div className="card skill-panel">
            <div className="skill-panel-heading"><BookOpen size={19} /><h3>My learning</h3></div>
            <div className="skill-chip-list">
              {(user?.skillsToLearn || []).map((skill) => <span key={skill} className="badge badge-info">{skill}</span>)}
              {(user?.skillsToLearn || []).length === 0 && <p>Add subjects you want to learn from other students.</p>}
            </div>
          </div>
          <div className="card skill-panel">
            <div className="skill-panel-heading"><GraduationCap size={19} /><h3>My teaching</h3></div>
            <div className="skill-chip-list">
              {(user?.skillsToTeach || []).map((skill) => <span key={skill} className="badge badge-navy">{skill}</span>)}
              {(user?.skillsToTeach || []).length === 0 && <p>Add subjects you can teach to receive peer requests.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="student-peers-section" aria-labelledby="recommended-peers-heading">
        <div className="student-section-heading">
          <div>
            <span>Peer discovery</span>
            <h2 id="recommended-peers-heading">Recommended peers</h2>
          </div>
          <Link to="/tutors">Browse all peers</Link>
        </div>
        {!availability.peers ? (
          <EmptyState icon={Users} title="Peer discovery unavailable" description="Refresh the page to load recommended students." />
        ) : recommendedPeers.length === 0 ? (
          <EmptyState icon={Users} title="No peers available yet" description="Check back as more students add subjects they can teach." />
        ) : (
          <div className="student-peer-grid">
            {recommendedPeers.map((peer) => <PeerCard key={peer._id} peer={peer} compact />)}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
