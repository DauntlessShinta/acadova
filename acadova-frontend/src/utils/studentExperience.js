const roots = ['/dashboard', '/subjects', '/learning', '/assessments', '/study-sets', '/study-share', '/study-together', '/tutors', '/sessions', '/profile', '/growth'];
export const isUnifiedStudentPath = pathname => roots.some(root => pathname === root || pathname.startsWith(root + '/'));
