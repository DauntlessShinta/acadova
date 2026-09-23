import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import ratingService from '../services/ratingService';
import Badge from '../components/common/Badge';
import StarRating from '../components/common/StarRating';
import Modal from '../components/common/Modal';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  BookOpen,
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
  Check,
  X,
  Calendar,
  Coins,
  MessageSquare,
  Filter,
} from 'lucide-react';

export const SessionsPage = () => {
  const { user, refreshUser } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [roleTab, setRoleTab] = useState('learner'); // 'learner' | 'tutor'
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  // Rating Modal State
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingSession, setRatingSession] = useState(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await sessionService.getMySessions();
      setSessions(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load study sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const isCurrentLearner = (s) => (s.learner?._id === user?._id || s.learner?._id === user?.id || s.learner === user?._id || s.learner === user?.id);
  const isCurrentTutor = (s) => (s.tutor?._id === user?._id || s.tutor?._id === user?.id || s.tutor === user?._id || s.tutor === user?.id);

  const filteredSessions = sessions.filter((s) => {
    const roleMatch = roleTab === 'learner' ? isCurrentLearner(s) : isCurrentTutor(s);
    const statusMatch = statusFilter === 'all' || s.status === statusFilter;
    return roleMatch && statusMatch;
  });

  const handleUpdateStatus = async (sessionId, newStatus) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMessage('');

      await sessionService.updateSessionStatus(sessionId, newStatus);
      setSuccessMessage(`Session successfully updated to "${newStatus}"!`);

      await refreshUser();
      await fetchSessions();
    } catch (err) {
      setError(err.message || `Failed to update session to ${newStatus}`);
    } finally {
      setActionLoading(false);
    }
  };

  const openRatingModal = (session) => {
    setRatingSession(session);
    setRatingStars(5);
    setRatingComment('');
    setRatingError('');
    setIsRatingModalOpen(true);
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    setRatingError('');

    try {
      setRatingSubmitting(true);
      await ratingService.submitRating({
        sessionId: ratingSession._id,
        rating: ratingStars,
        comment: ratingComment,
      });

      setIsRatingModalOpen(false);
      setSuccessMessage('Thank you! Your peer rating and feedback have been submitted.');
      await refreshUser();
    } catch (err) {
      setRatingError(err.message || 'Failed to submit rating. You may have already rated this session.');
    } finally {
      setRatingSubmitting(false);
    }
  };

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
          <span style={{ fontSize: '0.85rem', color: 'var(--brass-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Study Rooms
          </span>
          <h1 style={{ fontSize: '2rem', color: 'var(--navy-900)', margin: '4px 0 0' }}>
            My Sessions
          </h1>
        </div>

        {/* Tab Controls: As Learner / As Tutor */}
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
            onClick={() => setRoleTab('learner')}
            style={{
              background: roleTab === 'learner' ? 'var(--navy-900)' : 'transparent',
              color: roleTab === 'learner' ? '#ffffff' : 'var(--ink-700)',
              border: 'none',
            }}
          >
            <BookOpen size={14} /> As Learner ({sessions.filter(isCurrentLearner).length})
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setRoleTab('tutor')}
            style={{
              background: roleTab === 'tutor' ? 'var(--navy-900)' : 'transparent',
              color: roleTab === 'tutor' ? '#ffffff' : 'var(--ink-700)',
              border: 'none',
            }}
          >
            <GraduationCap size={14} /> As Tutor ({sessions.filter(isCurrentTutor).length})
          </button>
        </div>
      </div>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />

      {/* Filter Chips Bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={14} /> Status:
          </span>
          {['all', 'pending', 'accepted', 'completed', 'cancelled', 'rejected'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? 'var(--navy-900)' : 'var(--bg-subtle)',
                color: statusFilter === st ? '#ffffff' : 'var(--ink-700)',
                border: `1px solid ${statusFilter === st ? 'var(--navy-900)' : 'var(--border-subtle)'}`,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 500,
                textTransform: 'capitalize',
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {roleTab === 'learner' && (
          <Link to="/tutors" className="btn btn-primary btn-sm">
            <BookOpen size={14} /> Request New Session
          </Link>
        )}
      </div>

      {/* Session Cards List */}
      {loading ? (
        <LoadingSpinner text="Retrieving study session records..." size={36} />
      ) : filteredSessions.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={`No ${statusFilter === 'all' ? '' : statusFilter} sessions found`}
          description={
            roleTab === 'learner'
              ? 'You have not requested any study sessions matching this filter.'
              : 'You do not have any tutoring requests matching this filter.'
          }
          actionText={roleTab === 'learner' ? 'Find a Peer Tutor' : undefined}
          onAction={roleTab === 'learner' ? () => window.location.href = '/tutors' : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredSessions.map((session) => {
            const counterpart = roleTab === 'learner' ? session.tutor : session.learner;
            const counterpartRole = roleTab === 'learner' ? 'Tutor' : 'Learner';

            return (
              <div
                key={session._id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  borderLeft: `4px solid ${
                    session.status === 'completed'
                      ? 'var(--success-text)'
                      : session.status === 'accepted'
                      ? 'var(--navy-700)'
                      : session.status === 'pending'
                      ? 'var(--warning-text)'
                      : 'var(--danger-text)'
                  }`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-900)', margin: 0 }}>
                        {session.subject}
                      </h3>
                      <Badge status={session.status} />
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--ink-600)' }}>
                      {counterpartRole}: <strong>{counterpart?.name || 'Peer Scholar'}</strong> ({counterpart?.email})
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="badge badge-brass" style={{ fontSize: '0.82rem', marginBottom: 4 }}>
                      {session.creditAmount} Credit{session.creditAmount > 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
                      Requested: {new Date(session.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Scheduled Time Banner */}
                {session.scheduledAt && (
                  <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--ink-700)',
                    background: 'var(--bg-subtle)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <Calendar size={14} color="var(--brass-600)" />
                    <span>Scheduled Session: <strong>{new Date(session.scheduledAt).toLocaleString()}</strong></span>
                  </div>
                )}

                {/* Session Actions Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                }}>
                  {/* Tutor Actions */}
                  {roleTab === 'tutor' && session.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(session._id, 'accepted')}
                      >
                        <Check size={14} /> Accept Request
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(session._id, 'rejected')}
                      >
                        <X size={14} /> Decline
                      </button>
                    </>
                  )}

                  {roleTab === 'tutor' && session.status === 'accepted' && (
                    <button
                      type="button"
                      className="btn btn-navy btn-sm"
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus(session._id, 'completed')}
                    >
                      <CheckCircle2 size={14} /> Complete Session & Claim +{session.creditAmount} Credits
                    </button>
                  )}

                  {/* Learner or Tutor Cancel */}
                  {(session.status === 'pending' || session.status === 'accepted') && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger-text)' }}
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus(session._id, 'cancelled')}
                    >
                      Cancel Session
                    </button>
                  )}

                  {/* Rate Completed Session (Learner or Tutor) */}
                  {session.status === 'completed' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openRatingModal(session)}
                    >
                      <Star size={14} color="var(--brass-500)" /> Rate {counterpartRole}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PEER RATING MODAL */}
      <Modal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        title="Submit Peer Review & Rating"
      >
        <form onSubmit={handleRatingSubmit}>
          <Alert type="danger" message={ratingError} onClose={() => setRatingError('')} />

          <p style={{ fontSize: '0.9rem', color: 'var(--ink-600)', marginBottom: '18px' }}>
            Rate your study session for <strong>{ratingSession?.subject}</strong>. Your feedback fosters accountability and quality across the Acadova network.
          </p>

          <div className="form-group" style={{ textAlign: 'center', margin: '20px 0' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>
              Star Rating (1 to 5 Stars)
            </label>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <StarRating
                rating={ratingStars}
                readOnly={false}
                size={28}
                onChange={(val) => setRatingStars(val)}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--brass-700)', fontWeight: 600, marginTop: 4, display: 'block' }}>
              {ratingStars === 5 ? '5.0 - Exceptional Knowledge Transfer' :
               ratingStars === 4 ? '4.0 - Very Good & Helpful' :
               ratingStars === 3 ? '3.0 - Satisfactory Session' :
               ratingStars === 2 ? '2.0 - Needed Improvement' :
               '1.0 - Unsatisfactory'}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="comment">
              Constructive Feedback (Optional)
            </label>
            <textarea
              id="comment"
              className="form-textarea"
              rows={4}
              placeholder="e.g. Explained recursion algorithms clearly with practical code examples..."
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              maxLength={500}
            />
            <span className="form-hint">{500 - ratingComment.length} characters remaining</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsRatingModalOpen(false)}
            >
              Close
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={ratingSubmitting}
            >
              {ratingSubmitting ? 'Submitting Review...' : 'Submit Rating'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SessionsPage;

