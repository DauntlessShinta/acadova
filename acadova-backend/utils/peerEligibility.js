// Match authentication's historical compatibility: only explicit false is denied.
const availableStudentFilter = () => ({ role: 'student', suspendedAt: null,
  emailVerified: { $ne: false } });
const isAvailableStudent = (user) => Boolean(user && user.role === 'student'
  && !user.suspendedAt && user.emailVerified !== false);
module.exports = { availableStudentFilter, isAvailableStudent };
