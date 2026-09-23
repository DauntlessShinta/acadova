import React from 'react';
import { Calendar, Check, CheckCircle2, Coins, UserRound, X } from 'lucide-react';
import Badge from '../common/Badge';
import { formatSessionDateTime, getSessionPerspective } from '../../utils/sessionPresentation';

export const SessionCard = ({
  session,
  currentUser,
  actionLoading = false,
  onStatusChange,
  onRate,
  compact = false,
}) => {
  const { isTeaching, label, counterpart } = getSessionPerspective(session, currentUser);
  const scheduledLabel = formatSessionDateTime(session.scheduledAt);
  const canCancel = (session.status === 'pending' && !isTeaching) || session.status === 'accepted';

  return (
    <article className={`student-session-card ${compact ? 'student-session-card-compact' : ''}`}>
      <div className="student-session-card-main">
        <div className="student-session-card-heading">
          <span className={`session-role-badge ${isTeaching ? 'is-teaching' : 'is-learning'}`}>{label}</span>
          <Badge status={session.status} />
        </div>
        <h3>{session.subject}</h3>
        <div className="student-session-detail">
          <UserRound size={15} aria-hidden="true" />
          <span>with <strong>{counterpart?.name || 'Peer student'}</strong></span>
        </div>
        {scheduledLabel && (
          <div className="student-session-detail">
            <Calendar size={15} aria-hidden="true" />
            <time dateTime={session.scheduledAt}>{scheduledLabel}</time>
          </div>
        )}
        <div className="student-session-detail">
          <Coins size={15} aria-hidden="true" />
          <span>{session.creditAmount} credit{session.creditAmount === 1 ? '' : 's'}</span>
        </div>
      </div>

      {onStatusChange && (
        <div className="student-session-actions">
          {isTeaching && session.status === 'pending' && (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={actionLoading} onClick={() => onStatusChange(session._id, 'accepted')}>
                <Check size={14} /> Accept
              </button>
              <button type="button" className="btn btn-danger btn-sm" disabled={actionLoading} onClick={() => onStatusChange(session._id, 'rejected')}>
                <X size={14} /> Decline
              </button>
            </>
          )}
          {isTeaching && session.status === 'accepted' && (
            <button type="button" className="btn btn-navy btn-sm" disabled={actionLoading} onClick={() => onStatusChange(session._id, 'completed')}>
              <CheckCircle2 size={14} /> Complete session
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-ghost btn-sm session-cancel-action" disabled={actionLoading} onClick={() => onStatusChange(session._id, 'cancelled')}>
              Cancel
            </button>
          )}
          {session.status === 'completed' && onRate && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRate(session)}>
              Rate peer
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default SessionCard;
