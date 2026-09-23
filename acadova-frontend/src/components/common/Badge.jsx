import React from 'react';

export const Badge = ({ status, children, variant }) => {
  let badgeClass = 'badge-navy';

  const type = variant || status?.toLowerCase();

  switch (type) {
    case 'accepted':
    case 'completed':
    case 'active':
    case 'earned':
      badgeClass = 'badge-success';
      break;
    case 'pending':
    case 'waiting':
      badgeClass = 'badge-pending';
      break;
    case 'rejected':
    case 'cancelled':
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
