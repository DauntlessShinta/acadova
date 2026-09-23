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

