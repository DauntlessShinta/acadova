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
    { to: '/moderator', label: 'Moderator Overview' },
    { to: '/moderator#reviews', label: 'Reviews' },
  ],
  admin: [
    { to: '/admin', label: 'Overview' },
    { to: '/admin#users', label: 'Users' },
    { to: '/admin#analytics', label: 'Analytics' },
    { to: '/moderator', label: 'Moderation' },
  ],
};

export const normalizeRole = (role) => (
  Object.hasOwn(ROLE_HOME_ROUTES, role) ? role : 'student'
);

export const getRoleHomeRoute = (role) => ROLE_HOME_ROUTES[normalizeRole(role)];

export const getRoleNavigation = (role) => authenticatedNavigation[normalizeRole(role)];
