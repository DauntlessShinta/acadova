import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Coins, GraduationCap, Inbox, Search, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import userService from '../services/userService';
import Alert from '../components/common/Alert';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PeerCard from '../components/student/PeerCard';
import SessionCard from '../components/student/SessionCard';
import { getSessionPerspective, getSessionStatus } from '../utils/sessionPresentation';
import { readLearningResume } from '../utils/learningResume';
import { useToast } from '../context/toastAccess';

export const DashboardPage = () => {
  const { user, credits, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const resume = readLearningResume(user?._id || user?.id);
  const [sessions, setSessions] = useState([]);
  const [recommendedPeers, setRecommendedPeers] = useState([]);
  const [availability, setAvailability] = useState({ sessions: false, peers: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    .filter((session) => ['scheduled', 'in_progress', 'awaiting_validation'].includes(getSessionStatus(session).filterKey))
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
    if (nextStatus === 'declined' && !window.confirm('Decline this session request? The learner will need to find another peer.')) return;
    try {
      setActionLoading(true);
      setError('');
      await sessionService.updateSessionStatus(sessionId, nextStatus);
      toast('success', nextStatus === 'scheduled' ? 'Session accepted and scheduled.' : 'Session declined.');
      await refreshUser();
      await loadDashboardData({ showLoading: false });
    } catch (err) {
      toast('error', err.message || `The session could not be updated to ${nextStatus}.`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading your Acadova dashboard..." size={36} />;
  }

  return (
    <div className="student-dashboard">
      <header className="student-home-hero">
        <div>
          <span className="student-eyebrow">Learn · Teach · Grow</span>
          <h1>Hello, {user?.name?.split(' ')[0] || 'Student'}</h1>
          <p>What would you like to learn today?</p>
          <form className="student-home-search" onSubmit={(event) => {
            event.preventDefault();
            navigate(search.trim() ? '/tutors?subject=' + encodeURIComponent(search.trim()) : '/tutors');
          }}>
            <label className="sr-only" htmlFor="home-skill-search">Search skills or subjects</label>
            <input id="home-skill-search" className="form-input" value={search}
              onChange={(event) => setSearch(event.target.value)} placeholder="Search a skill or subject" />
            <button className="btn btn-primary" type="submit"><Search size={16} /> Search tutors</button>
          </form>
          <div className="student-home-hero-actions">
            <Link to="/tutors" className="btn btn-secondary">Find a Tutor</Link>
            <Link to="/learning" className="btn btn-secondary">Explore Learning</Link>
          </div>
        </div>
        <Link to="/credits" className="student-home-wallet">
          <Coins size={22} /><strong>{credits} Acadova Credits</strong><span>View credit activity</span>
        </Link>
      </header>

      <Alert type="danger" message={error} onClose={() => setError('')} />

      <section className="student-home-next" aria-labelledby="next-session-heading">
        <div className="student-section-heading"><div><span>Coming up</span>
          <h2 id="next-session-heading">Next session</h2></div><Link to="/sessions">All sessions</Link></div>
        {!availability.sessions ? <p>Sessions are unavailable right now.</p>
          : upcomingSessions.length ? <SessionCard session={upcomingSessions[0]} currentUser={user} compact />
            : <div className="card"><p>You don't have any tutoring sessions yet.</p>
              <Link to="/tutors" className="btn btn-primary btn-sm">Find a Tutor</Link></div>}
      </section>

      <section className="student-home-learning" aria-labelledby="continue-learning-heading">
        <div className="student-section-heading"><div><span>At your pace</span>
          <h2 id="continue-learning-heading">Continue Learning</h2></div><Link to="/learning">Explore Learning</Link></div>
        <div className="card">{resume
          ? <><h3>{resume.moduleTitle || 'Your last module'}</h3>
            <p>Pick up at lesson {resume.lessonIndex + 1} on this browser.</p>
            <Link to="/learning?continue=1" className="btn btn-primary btn-sm">Continue</Link></>
          : <><p>Ready to learn at your own pace?</p>
            <Link to="/learning" className="btn btn-primary btn-sm">Explore Learning</Link></>}</div>
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
              description="Scheduled sessions and sessions awaiting a next step will appear here."
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
