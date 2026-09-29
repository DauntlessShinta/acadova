import React from 'react';

export const Badge = ({ status, children, variant }) => {
  let badgeClass = 'badge-navy';

  const type = variant || status?.toLowerCase();

  switch (type) {
    case 'accepted':
    case 'scheduled':
    case 'completed':
    case 'resolved':
    case 'active':
    case 'earned':
      badgeClass = 'badge-success';
      break;
    case 'pending':
    case 'waiting':
    case 'awaiting_validation':
    case 'disputed':
      badgeClass = 'badge-pending';
      break;
    case 'rejected':
    case 'declined':
    case 'cancelled':
    case 'no_show':
    case 'spent':
      badgeClass = 'badge-danger';
      break;
    case 'admin':
      badgeClass = 'badge-brass';
      break;
    case 'moderator':
      badgeClass = 'badge-info';
      break;
    case 'student':
    case 'learner':
    case 'tutor':
      badgeClass = 'badge-navy';
      break;
    case 'info':
    case 'in_progress':
      badgeClass = 'badge-info';
      break;
    default:
      badgeClass = 'badge-navy';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      {children || status}
    </span>
  );
};

export default Badge;
