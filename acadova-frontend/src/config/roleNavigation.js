export const ROLE_HOME_ROUTES = {
  student: '/dashboard',
  moderator: '/moderator',
  admin: '/admin',
};

const authenticatedNavigation = {
  student: [
    { to: '/dashboard', label: 'Home' },
    { to: '/subjects', label: 'My Subjects' },
    { to: '/study-sets', label: 'Study Sets' },
    { to: '/study-together', label: 'Study Together' },
    { to: '/tutors', label: 'Find Tutors' },
    { to: '/learning', label: 'Learning' },
    { to: '/sessions', label: 'Sessions' },
    { to: '/sessions?view=messages', label: 'Messages' },
    { to: '/credits', label: 'Credits' },
    { to: '/profile', label: 'Profile' },
    { to: '/settings', label: 'Settings' },
  ],
  moderator: [
    { to: '/moderator', label: 'Overview' },
    { to: '/moderator/reviews', label: 'Reviews' },
    { to: '/moderator/disputes', label: 'Session disputes' },
    { to: '/moderator/assessments', label: 'Assessments' },
    { to: '/moderator/learning', label: 'Learning content' },
    { to: '/moderator/study-circles', label: 'Circle reports' },
    { to: '/moderator/study-sets', label: 'Study-set reviews' },
    { to: '/moderator/settings', label: 'Settings' },
  ],
  admin: [
    { to: '/admin', label: 'Overview' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/sessions', label: 'Sessions' },
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/credits', label: 'Credits' },
    { to: '/admin/trust-activity', label: 'Trust & Activity' },
    { to: '/admin/moderation', label: 'Moderation' },
    { to: '/admin/assessments', label: 'Assessments' },
    { to: '/admin/learning', label: 'Learning content' },
    { to: '/admin/study-circles', label: 'Circle reports' },
    { to: '/admin/study-sets', label: 'Study-set reviews' },
    { to: '/admin/settings', label: 'Settings' },
  ],
};

export const normalizeRole = (role) => (
  Object.hasOwn(ROLE_HOME_ROUTES, role) ? role : 'student'
);

export const getRoleHomeRoute = (role) => ROLE_HOME_ROUTES[normalizeRole(role)];

export const getRoleNavigation = (role) => authenticatedNavigation[normalizeRole(role)];

// Existing routes remain canonical; these groups organize their presentation.
export const getStaffWorkspaceGroups = area => area === 'moderator' ? [
  { label: 'Queue', to: '/moderator', items: [
    ['/moderator','Queue overview'], ['/moderator/learning#manage-panel-resources','Resource submissions'],
    ['/moderator/reviews','Community reviews'], ['/moderator/disputes','Session issues'],
    ['/moderator/study-circles','Circle reports'], ['/moderator/study-sets','Study-set decisions'],
  ] },
  { label: 'Learning Content', to: '/moderator/learning', items: [
    ['/moderator/learning','Topics, modules & resources'], ['/moderator/assessments','Assessments'],
  ] },
] : [
  { label: 'Overview', to: '/admin', items: [['/admin','Platform overview'],['/admin/analytics','Analytics']] },
  { label: 'Users & Roles', to: '/admin/users', items: [['/admin/users','Users & roles']] },
  { label: 'Catalog', to: '/admin/learning', items: [['/admin/learning','Topics, modules & resources'],['/admin/assessments','Assessments']] },
  { label: 'Escalations', to: '/admin/moderation', items: [['/admin/moderation','Review queue'],['/admin/disputes','Session issues'],['/admin/sessions','Session oversight'],['/admin/study-circles','Circle reports'],['/admin/study-sets','Study-set decisions']] },
  { label: 'Policies & Settings', to: '/admin/settings', items: [['/admin/settings','Settings'],['/admin/credits','Credit policies & history'],['/admin/trust-activity?tab=security','Security events'],['/admin/trust-activity?tab=protection','Login protection']] },
  { label: 'Audit Log', to: '/admin/trust-activity?tab=activity', items: [['/admin/trust-activity?tab=activity','Audit activity']] },
];

export function staffWorkspaceGroup(area, pathname, search = '', hash = '') {
  const groups = getStaffWorkspaceGroups(area);
  if (area === 'admin' && pathname === '/admin/trust-activity') {
    return groups.find(group => group.label === (['security','protection'].includes(new URLSearchParams(search).get('tab')) ? 'Policies & Settings' : 'Audit Log'));
  }
  if (area === 'moderator' && pathname === '/moderator/learning' && hash === '#manage-panel-resources') return groups[0];
  return groups.find(group => group.items.some(([to]) => to.split(/[?#]/)[0] === pathname && !to.includes('#')));
}

// Route-derived context is shared by the shell and browser title. Query views
// are parsed explicitly so history navigation and deep links stay synchronized.
export function getPageContext(pathname, search = '') {
  const path = pathname.replace(/\/$/, '') || '/';
  const params = new URLSearchParams(search);
  if (path === '/growth') return { title: 'Growth', to: '/growth' };
  if (path === '/subjects' || path.startsWith('/subjects/')) return { title: 'My Subjects', to: '/subjects', learning: true };
  if (path.startsWith('/study-share/')) return { title: 'Shared study set', to: '/study-sets', learning: true };
  if (path === '/dashboard/peer') return { title: 'Study Together', to: '/dashboard/peer' };
  if (path === '/admin/disputes') return { title: 'Session disputes', area: 'Administration', to: '/admin/moderation' };
  if (['/admin/audit-logs', '/admin/security'].includes(path)) return { title: 'Trust & Activity', area: 'Administration', to: '/admin/trust-activity' };
  for (const area of ['admin', 'moderator']) {
    const link = authenticatedNavigation[area].find(({ to }) => to === path);
    if (link) return { title: link.label, area: area === 'admin' ? 'Administration' : 'Moderator', to: link.to };
  }
  if (path === '/learning/ai-study' || path.startsWith('/learning/ai-study/')) return { title: params.get('view') === 'mine' ? 'My AI Study Sets' : 'AI Study Tools', to: '/learning/ai-study', learning: true };
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
