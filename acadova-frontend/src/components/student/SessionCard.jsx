import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Check, Coins, MapPin, UserRound, X } from 'lucide-react';
import Badge from '../common/Badge';
import { formatSessionDateTime, getSessionPerspective, getSessionStatus } from '../../utils/sessionPresentation';

export const SessionCard = ({
  session,
  currentUser,
  actionLoading = false,
  onStatusChange,
  compact = false,
}) => {
  const { isTeaching, label, counterpart } = getSessionPerspective(session, currentUser);
  const displayStatus = getSessionStatus(session);
  const scheduledLabel = formatSessionDateTime(session.scheduledAt);
  const hasIndependentActions = Boolean(onStatusChange && isTeaching && session.status === 'pending' && session.canonicalStatus == null);

  return (
    <article className={`student-session-card ${compact ? 'student-session-card-compact' : ''}`}>
      <div className="student-session-card-main">
        <div className="student-session-card-heading">
          <span className={`session-role-badge ${isTeaching ? 'is-teaching' : 'is-learning'}`}>{label}</span>
          <Badge status={displayStatus.key}>{displayStatus.label}</Badge>
        </div>
        <h3>{hasIndependentActions ? session.subject : <Link className="session-card-destination" to={`/sessions/${session._id}`} aria-label={`View Session: ${session.subject}`}>{session.subject}</Link>}</h3>
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
        {session.meetingMethod && (
          <div className="student-session-detail">
            <MapPin size={15} aria-hidden="true" />
            <span>{session.meetingMethod === 'online' ? 'Online' : 'In person'}</span>
          </div>
        )}
        {isTeaching && session.status === 'pending' && session.requestMessage && (
          <p className="session-request-preview">“{session.requestMessage}”</p>
        )}
      </div>

      <div className="student-session-actions">
        {hasIndependentActions ? <Link className="btn btn-secondary btn-sm" to={`/sessions/${session._id}`}>View Session <ArrowRight size={18} aria-hidden="true" /></Link> : <span className="session-card-open" aria-hidden="true">View Session <ArrowRight size={18} /></span>}
        {hasIndependentActions && (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={actionLoading} onClick={() => onStatusChange(session._id, 'scheduled')}>
                <Check size={14} /> Accept
              </button>
              <button type="button" className="btn btn-danger btn-sm" disabled={actionLoading} onClick={() => onStatusChange(session._id, 'declined')}>
                <X size={14} /> Decline
              </button>
            </>
        )}
      </div>
    </article>
  );
};

export default SessionCard;
