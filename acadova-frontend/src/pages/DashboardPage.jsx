import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import userService from '../services/userService';
import creditService from '../services/creditService';
import StatCard from '../components/common/StatCard';
import StarRating from '../components/common/StarRating';
import Badge from '../components/common/Badge';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  BookOpen,
  Coins,
  GraduationCap,
  Star,
  Clock,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Calendar,
  Sparkles,
  Inbox,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

export const DashboardPage = () => {
  const { user, credits, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState('learner'); // 'learner' | 'tutor'
  const [sessions, setSessions] = useState([]);
  const [recommendedTutors, setRecommendedTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [sessionsRes, tutorsRes] = await Promise.all([
        sessionService.getMySessions().catch(() => ({ data: [] })),
        userService.searchTutors().catch(() => ({ data: [] })),
      ]);

      const allSessions = sessionsRes?.data || [];
      setSessions(allSessions);

      // Filter out current user from tutors list
      const tutorsList = (tutorsRes?.data || []).filter((t) => t._id !== user?._id && t._id !== user?.id);
      setRecommendedTutors(tutorsList.slice(0, 4));
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?._id]);

  // Derived metrics
  const myLearnerSessions = sessions.filter((s) => s.learner?._id === user?._id || s.learner?._id === user?.id || s.learner === user?._id || s.learner === user?.id);
  const myTutorSessions = sessions.filter((s) => s.tutor?._id === user?._id || s.tutor?._id === user?.id || s.tutor === user?._id || s.tutor === user?.id);

  const pendingIncomingRequests = myTutorSessions.filter((s) => s.status === 'pending');
  const activeLearnerSessions = myLearnerSessions.filter((s) => s.status === 'accepted' || s.status === 'pending');
  const activeTutorSessions = myTutorSessions.filter((s) => s.status === 'accepted');
  const completedLearnerSessions = myLearnerSessions.filter((s) => s.status === 'completed');
  const completedTutorSessions = myTutorSessions.filter((s) => s.status === 'completed');

  // Handle Quick Session Actions (Accept / Reject / Complete)
  const handleUpdateStatus = async (sessionId, newStatus) => {
    try {
      setActionLoading(true);
      setError('');
      setActionSuccess('');

      await sessionService.updateSessionStatus(sessionId, newStatus);
      setActionSuccess(`Session marked as "${newStatus}" successfully!`);

      // Refresh credits and sessions
      await refreshUser();
      await loadDashboardData();
    } catch (err) {
      setError(err.message || `Failed to update session status to ${newStatus}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading your Acadova dashboard..." size={36} />;
  }

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--brass-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Academic Portal
          </span>
          <h1 style={{ fontSize: '2rem', color: 'var(--navy-900)', margin: '4px 0 0' }}>
            Welcome back, {user?.name || 'Scholar'}!
          </h1>
        </div>

        {/* Learner / Tutor Mode Switcher */}
        <div style={{
          background: 'var(--bg-subtle)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          gap: '4px',
          border: '1px solid var(--border-subtle)',
        }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setActiveTab('learner')}
            style={{
              background: activeTab === 'learner' ? 'var(--navy-900)' : 'transparent',
              color: activeTab === 'learner' ? '#ffffff' : 'var(--ink-700)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <BookOpen size={14} /> Learner Mode
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setActiveTab('tutor')}
            style={{
              background: activeTab === 'tutor' ? 'var(--navy-900)' : 'transparent',
              color: activeTab === 'tutor' ? '#ffffff' : 'var(--ink-700)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <GraduationCap size={14} /> Tutor Mode
            {pendingIncomingRequests.length > 0 && (
              <span style={{
                background: 'var(--brass-500)',
                color: '#fff',
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                marginLeft: 4,
              }}>
                {pendingIncomingRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={actionSuccess} onClose={() => setActionSuccess('')} />

      {/* METRIC STAT CARDS */}
      <div className="stat-grid" style={{ marginBottom: '32px' }}>
        <StatCard
          title="Available Credits"
          value={`${credits} Credits`}
          subtitle="100% Cashless Balance"
          icon={Coins}
          color="var(--brass-600)"
        />

        {activeTab === 'learner' ? (
          <>
            <StatCard
              title="Active Sessions"
              value={activeLearnerSessions.length}
              subtitle="Pending & Scheduled"
              icon={Clock}
              color="var(--info-text)"
            />
            <StatCard
              title="Completed as Learner"
              value={completedLearnerSessions.length}
              subtitle="Knowledge Acquired"
              icon={CheckCircle2}
              color="var(--success-text)"
            />
            <StatCard
              title="Learning Subjects"
              value={(user?.skillsToLearn || []).length}
              subtitle="In your wishlist"
              icon={BookOpen}
              color="var(--navy-700)"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Pending Requests"
              value={pendingIncomingRequests.length}
              subtitle="Awaiting your response"
              icon={Inbox}
              color="var(--warning-text)"
            />
            <StatCard
              title="Completed as Tutor"
              value={completedTutorSessions.length}
              subtitle="Credits Earned"
              icon={CheckCircle2}
              color="var(--success-text)"
            />
            <StatCard
              title="Tutor Rating"
              value={Number(user?.rating || 5.0).toFixed(1)}
              subtitle="Verified peer average"
              icon={Star}
              color="var(--brass-500)"
            />
          </>
        )}
      </div>

      {/* TAB CONTENT: LEARNER HUB */}
      {activeTab === 'learner' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
          {/* Left Column: My Learning Sessions */}
          <div>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ margin: 0, color: 'var(--navy-900)', fontSize: '1.2rem' }}>Upcoming & Active Study Rooms</h3>
                <Link to="/sessions" style={{ fontSize: '0.85rem', color: 'var(--brass-700)', fontWeight: 600 }}>
                  View All ({myLearnerSessions.length})
                </Link>
              </div>

              {activeLearnerSessions.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No active sessions requested"
                  description="Find a student tutor in your area of study and book a 1-on-1 session."
                  actionText="Browse Available Tutors"
                  onAction={() => window.location.href = '/tutors'}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeLearnerSessions.slice(0, 4).map((session) => (
                    <div
                      key={session._id}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <strong style={{ color: 'var(--navy-900)', fontSize: '1rem' }}>{session.subject}</strong>
                        <Badge status={session.status} />
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--ink-600)', marginBottom: 8 }}>
                        Tutor: <strong>{session.tutor?.name || 'Peer Tutor'}</strong> ({session.tutor?.email})
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--ink-500)' }}>
                        <span>Fee: {session.creditAmount} Credits</span>
                        <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Recommended Peer Tutors */}
          <div>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ margin: 0, color: 'var(--navy-900)', fontSize: '1.2rem' }}>Recommended Peer Tutors</h3>
                <Link to="/tutors" style={{ fontSize: '0.85rem', color: 'var(--brass-700)', fontWeight: 600 }}>
                  Search All
                </Link>
              </div>

              {recommendedTutors.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="No tutors found"
                  description="Be the first to list your skills or check back soon."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {recommendedTutors.map((tutor) => (
                    <div
                      key={tutor._id}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <strong style={{ color: 'var(--navy-900)' }}>{tutor.name}</strong>
                          <StarRating rating={tutor.rating || 5.0} size={13} />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(tutor.skillsToTeach || []).map((s, idx) => (
                            <span key={idx} className="badge badge-navy" style={{ fontSize: '0.7rem', textTransform: 'none' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Link
                        to={`/tutors/${tutor._id}`}
                        className="btn btn-primary btn-sm"
                        style={{ flexShrink: 0 }}
                      >
                        Request
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TUTOR HUB */}
      {activeTab === 'tutor' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
          {/* Left Column: Incoming Requests */}
          <div>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ margin: 0, color: 'var(--navy-900)', fontSize: '1.2rem' }}>
                  Incoming Session Requests
                </h3>
                <span className="badge badge-pending">{pendingIncomingRequests.length} Pending</span>
              </div>

              {pendingIncomingRequests.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No pending requests"
                  description="When fellow students request tutoring for your listed skills, they will appear here."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {pendingIncomingRequests.map((req) => (
                    <div
                      key={req._id}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--warning-border)',
                        background: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <strong style={{ color: 'var(--navy-900)', fontSize: '1.05rem' }}>{req.subject}</strong>
                        <span className="badge badge-brass">+{req.creditAmount} Credits</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--ink-600)', margin: '0 0 12px' }}>
                        Requested by: <strong>{req.learner?.name || 'Student'}</strong> ({req.learner?.email})
                      </p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1 }}
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(req._id, 'accepted')}
                        >
                          <Check size={14} /> Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ flex: 1 }}
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(req._id, 'rejected')}
                        >
                          <X size={14} /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Tutoring Slots */}
          <div>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ margin: 0, color: 'var(--navy-900)', fontSize: '1.2rem' }}>
                  Accepted & Active Tutoring Slots
                </h3>
                <Link to="/profile" style={{ fontSize: '0.85rem', color: 'var(--brass-700)', fontWeight: 600 }}>
                  Manage Skills
                </Link>
              </div>

              {activeTutorSessions.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No active sessions to teach"
                  description="Accept pending requests to begin teaching and earning credits."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {activeTutorSessions.map((session) => (
                    <div
                      key={session._id}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <strong style={{ color: 'var(--navy-900)' }}>{session.subject}</strong>
                        <Badge status={session.status} />
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--ink-600)', margin: '0 0 12px' }}>
                        Learner: <strong>{session.learner?.name || 'Student'}</strong>
                      </p>
                      <button
                        type="button"
                        className="btn btn-navy btn-sm"
                        style={{ width: '100%' }}
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(session._id, 'completed')}
                      >
                        <CheckCircle2 size={14} /> Mark as Completed (+{session.creditAmount} Credits)
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

