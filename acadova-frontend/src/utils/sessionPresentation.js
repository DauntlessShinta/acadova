const entityId = (entity) => String(entity?._id || entity?.id || entity || '');

// datetime-local is a wall-clock time in the browser's timezone. Send an
// explicit UTC instant so the API never interprets it in the server's timezone.
export const toSessionInstant = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error('Enter a valid session date and time.');
  return date.toISOString();
};

export const getSessionPerspective = (session, currentUser) => {
  const currentUserId = entityId(currentUser);
  const isTeaching = entityId(session?.tutor) === currentUserId;

  return {
    isTeaching,
    label: isTeaching ? 'Teaching' : 'Learning',
    counterpart: isTeaching ? session?.learner : session?.tutor,
  };
};

export const formatSessionDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
};

const statusDetails = {
  pending: { label: 'Requested', key: 'pending' },
  accepted: { label: 'Scheduled', key: 'scheduled' },
  scheduled: { label: 'Scheduled', key: 'scheduled' },
  in_progress: { label: 'In progress', key: 'in_progress' },
  awaiting_validation: { label: 'Awaiting validation', key: 'awaiting_validation' },
  completed: { label: 'Completed', key: 'completed' },
  rejected: { label: 'Declined', key: 'declined' },
  declined: { label: 'Declined', key: 'declined' },
  cancelled: { label: 'Cancelled', key: 'cancelled' },
  no_show: { label: 'No-show', key: 'no_show' },
  disputed: { label: 'Disputed', key: 'disputed' },
  resolved: { label: 'Resolved', key: 'resolved' },
};

const filterStatuses = [
  'pending', 'scheduled', 'in_progress', 'awaiting_validation', 'completed',
  'declined', 'cancelled', 'no_show', 'disputed', 'resolved',
];

export const SESSION_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  ...filterStatuses.map((value) => ({ value, label: statusDetails[value].label })),
];

const statusDetail = (status) => Object.hasOwn(statusDetails, status) ? statusDetails[status] : null;

export const getSessionStatusLabel = (status) => statusDetail(status)?.label || 'Status unavailable';

export const getSessionStatus = (session) => {
  // A future API can provide its authoritative interpretation of an old
  // completed record. The browser must not infer historical settlement.
  if (session?.canonicalStatus != null) {
    const canonical = statusDetail(session.canonicalStatus);
    return canonical ? { ...canonical, filterKey: canonical.key } : {
      label: 'Status unavailable', key: 'unknown', filterKey: 'unknown',
    };
  }
  if (session?.status === 'completed' && !session.confirmedAt) {
    return { label: 'Awaiting confirmation', key: 'waiting', filterKey: 'awaiting_validation' };
  }
  const detail = statusDetail(session?.status);
  return detail ? { ...detail, filterKey: detail.key } : {
    label: 'Status unavailable', key: 'unknown', filterKey: 'unknown',
  };
};

export const getSessionNextStep = (session, isTeaching, counterpartName = 'your peer') => {
  if (session?.canonicalStatus != null) {
    const nextSteps = {
      pending: isTeaching ? `Review ${counterpartName}'s request.` : `Waiting for ${counterpartName} to respond to your request.`,
      scheduled: `Your session with ${counterpartName} is scheduled.`,
      in_progress: 'This session is in progress.',
      awaiting_validation: 'This session is awaiting validation.',
      completed: 'This session is complete.',
      declined: 'This request was declined. You can find another peer.',
      cancelled: 'This session was cancelled.',
      no_show: 'This session was recorded as a no-show.',
      disputed: 'This session is under review.',
      resolved: 'This session dispute has been resolved.',
    };
    return Object.hasOwn(nextSteps, session.canonicalStatus)
      ? nextSteps[session.canonicalStatus]
      : 'This session state is not yet available. Refresh for the latest details.';
  }
  if (session?.status === 'pending') {
    return isTeaching
      ? `Review ${counterpartName}'s request and accept or decline it.`
      : `Waiting for ${counterpartName} to respond to your request.`;
  }
  if (['accepted', 'scheduled'].includes(session?.status)
    && (session.learnerCheckedInAt || session.tutorCheckedInAt)) {
    return 'A participant has checked in. Waiting for the other participant to check in.';
  }
  if (session?.status === 'accepted') {
    if (isTeaching && session.meetingMethod === 'online' && !session.meetingLink) return 'Add the meeting link so your learner can join.';
    if (isTeaching && session.meetingMethod === 'in-person' && !session.location) return 'Add the meeting location so your learner knows where to go.';
    return `Coordinate with ${counterpartName} and meet at the scheduled time.`;
  }
  if (session?.status === 'scheduled') return `Your session with ${counterpartName} is scheduled.`;
  if (session?.status === 'in_progress') return 'This session is in progress.';
  if (session?.status === 'awaiting_validation') return 'This session is awaiting validation.';
  if (session?.status === 'completed' && !session.confirmedAt) {
    return isTeaching
      ? 'Waiting for the Learner to confirm completion.'
      : `${counterpartName} marked this session complete. Confirm it to transfer the credits.`;
  }
  if (session?.status === 'completed' && session.confirmedAt) return 'The exchange is complete. You can now review your peer.';
  if (session?.status === 'rejected' || session?.status === 'declined') return 'This request was declined. You can find another peer.';
  if (session?.status === 'cancelled') return 'This session was cancelled.';
  if (session?.status === 'no_show') return 'This session was recorded as a no-show.';
  if (session?.status === 'disputed') return 'This session is under review.';
  if (session?.status === 'resolved') return 'This session dispute has been resolved.';
  return 'This session state is not yet available. Refresh for the latest details.';
};
