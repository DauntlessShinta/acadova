import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Filter, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import sessionService from '../services/sessionService';
import ratingService from '../services/ratingService';
import Alert from '../components/common/Alert';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import StarRating from '../components/common/StarRating';
import SessionCard from '../components/student/SessionCard';
import { getSessionPerspective } from '../utils/sessionPresentation';

const roleFilters = [
  { value: 'all', label: 'All' },
  { value: 'learning', label: 'Learning' },
  { value: 'teaching', label: 'Teaching' },
];

const statusFilters = ['all', 'pending', 'accepted', 'completed', 'cancelled', 'rejected'];

export const SessionsPage = () => {
  const { user, refreshUser } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [sessionsAvailable, setSessionsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingSession, setRatingSession] = useState(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');

  const fetchSessions = async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
      setError('');
    }
    try {
      const response = await sessionService.getMySessions();
      setSessions(response?.data || []);
      setSessionsAvailable(true);
    } catch (err) {
      setSessionsAvailable(false);
      setError(err.message || 'Your sessions could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchSessions({ showLoading: false }));
  }, []);

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    const perspective = getSessionPerspective(session, user);
    const roleMatches = roleFilter === 'all'
      || (roleFilter === 'teaching' && perspective.isTeaching)
      || (roleFilter === 'learning' && !perspective.isTeaching);
    const statusMatches = statusFilter === 'all' || session.status === statusFilter;
    return roleMatches && statusMatches;
  }), [roleFilter, sessions, statusFilter, user]);

  const roleCounts = useMemo(() => sessions.reduce((counts, session) => {
    if (getSessionPerspective(session, user).isTeaching) counts.teaching += 1;
    else counts.learning += 1;
    return counts;
  }, { learning: 0, teaching: 0 }), [sessions, user]);

  const handleUpdateStatus = async (sessionId, nextStatus) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMessage('');
      await sessionService.updateSessionStatus(sessionId, nextStatus);
      setSuccessMessage(`Session updated to ${nextStatus}.`);
      await refreshUser();
      await fetchSessions({ showLoading: false });
    } catch (err) {
      setError(err.message || `The session could not be updated to ${nextStatus}.`);
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

  const handleRatingSubmit = async (event) => {
    event.preventDefault();
    setRatingError('');
    try {
      setRatingSubmitting(true);
      await ratingService.submitRating({
        sessionId: ratingSession._id,
        rating: ratingStars,
        comment: ratingComment,
      });
      setIsRatingModalOpen(false);
      setSuccessMessage('Your peer rating and feedback were submitted.');
      await refreshUser();
    } catch (err) {
      setRatingError(err.message || 'The rating could not be submitted. You may have already rated this session.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const emptyDescription = roleFilter === 'teaching'
    ? 'You do not have teaching sessions matching these filters.'
    : roleFilter === 'learning'
      ? 'You do not have learning sessions matching these filters.'
      : 'You do not have sessions matching these filters.';

  return (
    <div className="student-sessions-page">
      <header className="student-page-header">
        <div>
          <span className="student-eyebrow">Peer sessions</span>
          <h1>Sessions</h1>
          <p>See whether you are learning or teaching, who you are meeting, and what happens next.</p>
        </div>
        <Link to="/tutors" className="btn btn-primary"><BookOpen size={15} /> Request Session</Link>
      </header>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />

      <div className="card student-session-filters">
        <div className="session-filter-group" aria-label="Filter by your role in the session">
          {roleFilters.map((item) => {
            const count = item.value === 'all' ? sessions.length : roleCounts[item.value];
            return (
              <button
                key={item.value}
                type="button"
                className={`btn btn-sm ${roleFilter === item.value ? 'btn-primary' : 'btn-secondary'}`}
                aria-pressed={roleFilter === item.value}
                onClick={() => setRoleFilter(item.value)}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="session-filter-group" aria-label="Filter by session status">
          <span><Filter size={14} /> Status</span>
          {statusFilters.map((status) => (
            <button
              key={status}
              type="button"
              className={`session-filter-chip ${statusFilter === status ? 'is-active' : ''}`}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading your peer sessions..." size={36} />
      ) : !sessionsAvailable ? (
        <EmptyState icon={Clock} title="Sessions unavailable" description="Refresh the page to try loading your sessions again." />
      ) : filteredSessions.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No sessions in this view"
          description={emptyDescription}
          actionText={roleFilter !== 'teaching' ? 'Find Peers' : undefined}
          onAction={roleFilter !== 'teaching' ? () => { window.location.href = '/tutors'; } : undefined}
        />
      ) : (
        <div className="student-session-list">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session._id}
              session={session}
              currentUser={user}
              actionLoading={actionLoading}
              onStatusChange={handleUpdateStatus}
              onRate={openRatingModal}
            />
          ))}
        </div>
      )}

      <Modal isOpen={isRatingModalOpen} onClose={() => setIsRatingModalOpen(false)} title="Rate Your Peer Session">
        <form onSubmit={handleRatingSubmit}>
          <Alert type="danger" message={ratingError} onClose={() => setRatingError('')} />
          <p>
            Rate your <strong>{ratingSession?.subject}</strong> session. Constructive feedback supports trust across Acadova.
          </p>
          <div className="form-group rating-form-stars">
            <label className="form-label">Star rating</label>
            <StarRating rating={ratingStars} readOnly={false} size={28} onChange={setRatingStars} />
            <span>{ratingStars} out of 5</span>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="comment">Constructive feedback (optional)</label>
            <textarea
              id="comment"
              className="form-textarea"
              rows={4}
              value={ratingComment}
              onChange={(event) => setRatingComment(event.target.value)}
              maxLength={500}
              placeholder="What was helpful about this peer session?"
            />
            <span className="form-hint">{500 - ratingComment.length} characters remaining</span>
          </div>
          <div className="modal-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsRatingModalOpen(false)}>Close</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={ratingSubmitting}>
              <Star size={14} /> {ratingSubmitting ? 'Submitting…' : 'Submit Rating'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SessionsPage;
