const mongoose = require('mongoose');

// Owner-reviewed source change required for production enforcement. Environment
// variables alone cannot enable MFA before mailbox/index/recovery readiness.
const RELEASE_APPROVED = false;
let isolatedClient;
function enabled() {
  const c = mongoose.connection;
  return RELEASE_APPROVED || (process.env.NODE_ENV === 'test' && c.readyState === 1
    && c.getClient() === isolatedClient && c.host === '127.0.0.1' && c.port === 27032
    && /^acadova_staff_mfa_test_[a-f0-9]{32}$/.test(c.name));
}
async function activateIsolatedStaffMfa() {
  const c = mongoose.connection;
  if (process.env.NODE_ENV !== 'test' || c.host !== '127.0.0.1' || c.port !== 27032
    || !/^acadova_staff_mfa_test_[a-f0-9]{32}$/.test(c.name)) throw new Error('Isolated MFA database required');
  const hello = await c.db.admin().command({ hello: 1 });
  if (hello.setName !== 'acadovaExpQA' || hello.hosts?.length !== 1
    || hello.hosts[0] !== '127.0.0.1:27032') throw new Error('Isolated replica required');
  isolatedClient = c.getClient();
}
const isStaff = role => role === 'admin' || role === 'moderator';
module.exports = { enabled, activateIsolatedStaffMfa, isStaff, RELEASE_APPROVED };
