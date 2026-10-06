import { useConfirm } from '../context/confirmAccess';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Coins, GraduationCap, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import learningService from '../services/learningService';
import userService from '../services/userService';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PeerCard from '../components/student/PeerCard';
import SessionCard from '../components/student/SessionCard';
import { getSessionPerspective, getSessionStatus } from '../utils/sessionPresentation';
import { readLearningResume } from '../utils/learningResume';
import { useToast } from '../context/toastAccess';

export const DashboardPage = () => {
  const confirm = useConfirm();
  const { user, credits, refreshUser } = useAuth();
  const toast = useToast();
  const resume = readLearningResume(user?._id || user?.id);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [sessions, setSessions] = useState([]);
  const [topics, setTopics] = useState([]);
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

    const [sessionsResult, peersResult, topicsResult] = await Promise.allSettled([
      sessionService.getMySessions(),
      userService.searchTutors(),
      learningService.topics(),
    ]);

    setCurrentTime(Date.now());
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

    if (topicsResult.status === 'fulfilled') setTopics(topicsResult.value?.data || []);
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
    .filter((session) => ['accepted', 'scheduled'].includes(session.status)
      && new Date(session.scheduledAt).getTime() >= currentTime)
    .sort((left, right) => new Date(left.scheduledAt) - new Date(right.scheduledAt)), [sessions, currentTime]);
  const attentionSessions = sessions.filter((session) => ['in_progress', 'awaiting_validation', 'disputed', 'no_show'].includes(session.status)
    || (getSessionStatus(session).filterKey === 'awaiting_validation')
    || (['accepted', 'scheduled'].includes(session.status) && new Date(session.scheduledAt).getTime() < currentTime));

  const pendingSessions = sessions.filter((session) => session.status === 'pending');
  const pendingTeachingRequests = pendingSessions.filter((session) => (
    getSessionPerspective(session, user).isTeaching
  ));

  const handleUpdateStatus = async (sessionId, nextStatus) => {
    if (nextStatus === 'declined' && !await confirm('Decline this session request? The learner will need to find another peer.', { title: 'Decline request', label: 'Decline request' })) return;
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
      <header className="student-home-hero home-welcome">
        <div className="home-greeting"><div><span className="student-eyebrow">Learn together. Grow together.</span>
        <h1>{sessions.length ? 'Welcome back' : 'Welcome to Acadova'}, {user?.name?.split(' ')[0] || 'Student'}</h1>
        <p>What would you like to do today?</p></div><Link to="/credits" className="home-credit-summary home-mobile-credits"><Coins size={18} aria-hidden="true" /><strong>{credits} Credits</strong></Link></div>
        <div className="home-paths">
          <Link to="/tutors" className="home-path"><Search aria-hidden="true" size={24} /><strong>Find someone to teach me</strong><span>Get help from a peer with a subject or skill.</span></Link>
          <Link to="/learning" className="home-path"><BookOpen aria-hidden="true" size={24} /><strong>Explore learning</strong><span>Study approved resources at your own pace.</span></Link>
          <Link to="/profile" className="home-path"><GraduationCap aria-hidden="true" size={24} /><strong>Share what I know</strong><span>Add teaching skills so peers can find you.</span></Link>
        </div>
      </header>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <div className="home-context-grid">
        {upcomingSessions.length > 0 && <section aria-labelledby="next-session-heading">
          <div className="student-section-heading"><h2 id="next-session-heading">Upcoming session</h2><Link to="/sessions">All sessions</Link></div>
          <SessionCard session={upcomingSessions[0]} currentUser={user} compact />
        </section>}
        {resume && <section aria-labelledby="continue-learning-heading">
          <div className="student-section-heading"><h2 id="continue-learning-heading">Continue learning</h2></div>
          <div className="card"><h3>{resume.moduleTitle || 'Your last module'}</h3><p>Continue at lesson {resume.lessonIndex + 1} on this browser.</p>
            <Link to="/learning?continue=1" className="btn btn-primary">Continue learning</Link></div>
        </section>}
      </div>
      {attentionSessions.length > 0 && <section aria-labelledby="attention-heading"><div className="student-section-heading"><h2 id="attention-heading">Needs your attention</h2><Link to="/sessions">All sessions</Link></div><div className="home-context-grid">{attentionSessions.slice(0, 3).map((session) => <SessionCard key={session._id} session={session} currentUser={user} compact />)}</div></section>}
      {pendingTeachingRequests.length > 0 && <section aria-labelledby="teaching-heading">
        <div className="student-section-heading"><h2 id="teaching-heading">Teaching requests ({pendingTeachingRequests.length})</h2><Link to="/sessions">All requests</Link></div>
        <div className="home-context-grid">{pendingTeachingRequests.slice(0, 3).map((session) => <SessionCard key={session._id} session={session} currentUser={user}
          actionLoading={actionLoading} onStatusChange={handleUpdateStatus} compact />)}</div>
      </section>}
      {availability.peers && recommendedPeers.length > 0 && <section aria-labelledby="peers-heading">
        <div className="student-section-heading"><h2 id="peers-heading">Peers who can help</h2><Link to="/tutors">Browse tutors</Link></div>
        <p>Explore peers who have added teaching skills.</p>
        <div className="student-peer-grid">{recommendedPeers.slice(0, 3).map((peer) => <PeerCard key={peer._id} peer={peer} compact />)}</div>
      </section>}
      {topics.length > 0 && <section aria-labelledby="featured-learning-heading"><div className="student-section-heading"><h2 id="featured-learning-heading">Explore learning topics</h2><Link to="/learning">All topics</Link></div>
        <div className="home-paths">{topics.slice(0, 3).map((topic) => <Link key={topic.id} to={`/learning?topic=${topic.id}`} className="home-path"><BookOpen size={22} aria-hidden="true" /><strong>{topic.name}</strong><span>{topic.description}</span></Link>)}</div>
      </section>}
      {(!user?.skillsToLearn?.length || !user?.skillsToTeach?.length) && <section className="card profile-reminders">
        <h2>Make Acadova yours</h2><p>Add learning interests and teaching skills to your Profile. You can learn and teach with the same account.</p><Link to="/profile" className="btn btn-secondary">Complete my profile</Link>
      </section>}

    </div>
  );
};

export default DashboardPage;
