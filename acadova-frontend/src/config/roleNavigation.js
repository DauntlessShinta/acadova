export const ROLE_HOME_ROUTES = {
  student: '/dashboard',
  moderator: '/moderator',
  admin: '/admin',
};

const authenticatedNavigation = {
  student: [
    { to: '/dashboard', label: 'Home' },
    { to: '/tutors', label: 'Find Tutors' },
    { to: '/learning', label: 'Learning' },
    { to: '/sessions', label: 'Sessions' },
    { to: '/sessions?view=messages', label: 'Messages' },
    { to: '/credits', label: 'Credits' },
    { to: '/profile', label: 'Profile' },
  ],
  moderator: [
    { to: '/moderator', label: 'Overview' },
    { to: '/moderator/reviews', label: 'Reviews' },
    { to: '/moderator/disputes', label: 'Session disputes' },
    { to: '/moderator/assessments', label: 'Assessments' },
    { to: '/moderator/learning', label: 'Learning content' },
    { to: '/moderator/study-sets', label: 'Study-set reviews' },
  ],
  admin: [
    { to: '/admin', label: 'Overview' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/sessions', label: 'Sessions' },
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/credits', label: 'Credits' },
    { to: '/admin/audit-logs', label: 'Audit logs' },
    { to: '/admin/security', label: 'Security' },
    { to: '/admin/moderation', label: 'Moderation' },
    { to: '/admin/assessments', label: 'Assessments' },
    { to: '/admin/learning', label: 'Learning content' },
    { to: '/admin/study-sets', label: 'Study-set reviews' },
  ],
};

export const normalizeRole = (role) => (
  Object.hasOwn(ROLE_HOME_ROUTES, role) ? role : 'student'
);

export const getRoleHomeRoute = (role) => ROLE_HOME_ROUTES[normalizeRole(role)];

export const getRoleNavigation = (role) => authenticatedNavigation[normalizeRole(role)];

// Route-derived context is shared by the shell and browser title. Query views
// are parsed explicitly so history navigation and deep links stay synchronized.
export function getPageContext(pathname, search = '') {
  const path = pathname.replace(/\/$/, '') || '/';
  const params = new URLSearchParams(search);
  for (const area of ['admin', 'moderator']) {
    const link = authenticatedNavigation[area].find(({ to }) => to === path);
    if (link) return { title: link.label, area: area === 'admin' ? 'Administration' : 'Moderator', to: link.to };
  }
  if (path === '/study-sets' || path.startsWith('/study-sets/')) return { title: path === '/study-sets/new' ? 'Create a study set' : path !== '/study-sets' ? params.get('edit') === '1' ? 'Edit study set' : params.has('attempt') ? 'Study quiz' : 'Study set' : 'Study sets', to: '/study-sets', learning: true };
  if (path === '/assessments') return { title: 'Assessments', to: '/assessments', learning: true };
  if (path === '/learning') return { title: 'Learning', to: '/learning', learning: true };
  if (path.startsWith('/tutors/')) return { title: 'Tutor profile', to: '/tutors' };
  if (path.startsWith('/sessions/')) return { title: 'Session room', to: '/sessions' };
  if (path === '/sessions' && params.get('view') === 'messages') return { title: 'Messages', to: '/sessions?view=messages' };
  const link = authenticatedNavigation.student.find(({ to }) => to === path);
  if (link) return { title: link.label, to: link.to };
  const publicTitles = { '/': 'Peer learning', '/about': 'About', '/features': 'Features', '/login': 'Login', '/register': 'Register', '/onboarding': 'Complete your profile', '/terms': 'Terms of service', '/privacy': 'Privacy policy', '/community-guidelines': 'Community guidelines', '/verify-email': 'Verify email', '/verify-email/pending': 'Check your email', '/forgot-password': 'Forgot password', '/reset-password': 'Reset password' };
  return { title: publicTitles[path] || 'Page not found', to: path };
}

export const canAccessStaffArea = (role, area) => (
  area === 'admin' ? role === 'admin' : area === 'moderator' && (role === 'moderator' || role === 'admin')
);
