// Production cutover requires a separately reviewed source change and operator
// reconciliation. Neither an environment variable nor a client can enable it.
const RELEASE_APPROVED = true;
let isolated;
function active() {
  if (RELEASE_APPROVED) return true;
  if (!isolated) return false;
  const mongoose = require('mongoose');
  const c = mongoose.connection;
  return process.env.NODE_ENV === 'test' && c.readyState === 1 && c.getClient() === isolated.client
    && c.name === isolated.database && c.host === '127.0.0.1' && c.port === 27032;
}
async function activateIsolatedStudentExperience() {
  const c = require('mongoose').connection;
  if (process.env.NODE_ENV !== 'test' || c.readyState !== 1 || c.host !== '127.0.0.1' || c.port !== 27032
    || !/^acadova_exp_engine_test_[a-f0-9]{32}$/.test(c.name)) throw new Error('Fresh isolated Student EXP database required.');
  const hello = await c.db.admin().command({ hello: 1 });
  if (hello.setName !== 'acadovaExpQA' || hello.hosts?.length !== 1 || hello.hosts[0] !== '127.0.0.1:27032') throw new Error('Unexpected isolated topology.');
  isolated = Object.freeze({ client:c.getClient(), database:c.name });
}
function capabilities() { const safety=require('./studentReleaseSafety');return { freeLearning:active(), expActive:active(), version:active()?'student-free-exp-1':'legacy-credits', legacyCaseWritesAllowed:safety.legacyCaseWritesAllowed(), recoveryWriteHold:safety.recoveryWriteHold() }; }
function rejectCreditWrite() {
  if (active()) throw Object.assign(new Error('The credit economy is retired. Historical records are read-only.'), { status:410, code:'CREDIT_ECONOMY_RETIRED' });
}
function retired(req, res, next) {
  if (!active()) return next();
  return res.status(410).json({ success:false, code:'CREDIT_ECONOMY_RETIRED', message:'Credits are retired. Historical records are retained for authorized review.' });
}
module.exports = { active, capabilities, rejectCreditWrite, retired, activateIsolatedStudentExperience };
