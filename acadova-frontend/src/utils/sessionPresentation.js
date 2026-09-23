const entityId = (entity) => String(entity?._id || entity?.id || entity || '');

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
  }).format(date);
};

export const getSessionStatus = (session) => {
  if (session?.status === 'completed' && !session?.confirmedAt) {
    return { label: 'Awaiting confirmation', key: 'waiting' };
  }
  const labels = {
    pending: 'Requested',
    accepted: 'Accepted',
    completed: 'Completed',
    rejected: 'Declined',
    cancelled: 'Cancelled',
  };
  return { label: labels[session?.status] || 'Unknown', key: session?.status };
};

export const getSessionNextStep = (session, isTeaching, counterpartName = 'your peer') => {
  if (session?.status === 'pending') {
    return isTeaching
      ? `Review ${counterpartName}'s request and accept or decline it.`
      : `Waiting for ${counterpartName} to respond to your request.`;
  }
  if (session?.status === 'accepted') {
    if (isTeaching && session.meetingMethod === 'online' && !session.meetingLink) return 'Add the meeting link so your learner can join.';
    if (isTeaching && session.meetingMethod === 'in-person' && !session.location) return 'Add the meeting location so your learner knows where to go.';
    return `Coordinate with ${counterpartName} and meet at the scheduled time.`;
  }
  if (session?.status === 'completed' && !session.confirmedAt) {
    return isTeaching
      ? 'Waiting for the Learner to confirm completion.'
      : `${counterpartName} marked this session complete. Confirm it to transfer the credits.`;
  }
  if (session?.confirmedAt) return 'The exchange is complete. You can now review your peer.';
  if (session?.status === 'rejected') return 'This request was declined. You can find another peer.';
  return 'This session is closed.';
};
