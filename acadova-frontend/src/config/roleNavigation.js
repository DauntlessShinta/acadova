export const ROLE_HOME_ROUTES = {
  student: '/dashboard',
  moderator: '/moderator',
  admin: '/admin',
};

const authenticatedNavigation = {
  student: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/tutors', label: 'Find Peers' },
    { to: '/sessions', label: 'Sessions' },
    { to: '/credits', label: 'Credits' },
    { to: '/profile', label: 'Profile' },
  ],
  moderator: [
    { to: '/moderator', label: 'Overview' },
    { to: '/moderator/reviews', label: 'Reviews' },
  ],
  admin: [
    { to: '/admin', label: 'Overview' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/sessions', label: 'Sessions' },
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/moderation', label: 'Moderation' },
  ],
};

export const normalizeRole = (role) => (
  Object.hasOwn(ROLE_HOME_ROUTES, role) ? role : 'student'
);

export const getRoleHomeRoute = (role) => ROLE_HOME_ROUTES[normalizeRole(role)];

export const getRoleNavigation = (role) => authenticatedNavigation[normalizeRole(role)];

export const canAccessStaffArea = (role, area) => (
  area === 'admin' ? role === 'admin' : area === 'moderator' && (role === 'moderator' || role === 'admin')
);
