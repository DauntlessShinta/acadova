// Only these synthetic accounts on this fixed loopback QA replica set may be prepared/repaired.
const mongoose = require('mongoose'); const bcrypt = require('bcryptjs'); const { randomBytes } = require('node:crypto');
const User = require('../models/User'); const { isValidPassword } = require('../middleware/validation');
const QA_URI = 'mongodb://127.0.0.1:27031/acadova?replicaSet=acadovaAiQA';
const emails = Object.freeze(['ai-study-student@example.test', 'ai-study-other@example.test']);
const fail = message => { throw Object.assign(new Error(message), { code: 'AI_QA_SETUP' }); };
function assertQaUri(uri) {
  // Never consume MONGO_URI, dotenv, SRV hosts, credentials, extra hosts or a caller-selected database.
  if (uri !== QA_URI) fail('Only the fixed loopback acadovaAiQA connection is permitted.');
}
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || !isValidPassword(password)) fail('Set ACADOVA_AI_QA_PASSWORD to 12–64 characters (at most 72 UTF-8 bytes), with uppercase, lowercase, number and special character.');
}
async function prepareAccounts({ password, resetCredentials = false, connection = mongoose.connection }) {
  if (process.env.NODE_ENV === 'production') fail('Synthetic account preparation is disabled in production.');
  validatePassword(password);
  const testDatabase = process.env.NODE_ENV === 'test' && connection.name === `acadova_ai_login_test_${process.pid}`;
  if (connection.host !== '127.0.0.1' || connection.port !== 27031 || connection.name !== 'acadova' && !testDatabase) fail('Only the dedicated loopback QA database is permitted.');
  const hello = await connection.db.admin().command({ hello: 1 });
  if (hello.setName !== 'acadovaAiQA' || hello.hosts?.some(host => host !== '127.0.0.1:27031')) fail('Unexpected QA replica set.');
  const users = connection.models.User || connection.model('User', User.schema);
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [index, email] of emails.entries()) {
        const existing = await users.findOne({ email }).session(session).lean();
        if (existing && (existing.role !== 'student' || existing.emailVerified !== true || existing.suspendedAt)) fail('A named QA account has unexpected role, verification or suspension state. No accounts were changed.');
        if (existing && !resetCredentials) {
          if (!/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(existing.password || '') || !await bcrypt.compare(password, existing.password)) fail('Existing QA credentials need repair. Rerun with --reset-synthetic-passwords to update only the two allowlisted accounts.');
          continue; // Ordinary preparation never clears a valid account's active cooldown.
        }
        // User has no hashing hook. Use the same bcrypt cost as register/resetPassword.
        const hash = await bcrypt.hash(password, 10);
        if (!existing) {
          await users.create([{ name: `Synthetic AI QA Student ${index + 1}`, email, password: hash, role: 'student', emailVerified: true,
            onboardingFinishedAt: new Date(), skillsToTeach: ['Testing'], skillsToLearn: ['Algorithms'] }], { session });
        } else {
          const result = await users.updateOne({ _id: existing._id, email, role: 'student', emailVerified: true, suspendedAt: null, password: existing.password },
            { $set: { password: hash, authVersion: randomBytes(32).toString('hex'), failedLoginAttempts: 0 },
              $unset: { lastFailedLoginAt: 1, loginCooldownUntil: 1, passwordResetTokenHash: 1, passwordResetExpires: 1 } }, { session, runValidators: true });
          if (result.modifiedCount !== 1) fail('A QA account changed concurrently. No accounts were changed; retry preparation.');
        }
      }
    });
  } finally { await session.endSession(); }
}
async function main({ argv = process.argv.slice(2), env = process.env, uri = QA_URI, connect = mongoose.connect.bind(mongoose), disconnect = mongoose.disconnect.bind(mongoose), log = console } = {}) {
  let connected = false;
  try {
    if (env.NODE_ENV === 'production') fail('Synthetic account preparation is disabled in production.');
    if (!argv.includes('--prepare-synthetic') || argv.some(arg => !['--prepare-synthetic', '--reset-synthetic-passwords'].includes(arg))) fail('Use --prepare-synthetic and optionally --reset-synthetic-passwords.');
    validatePassword(env.ACADOVA_AI_QA_PASSWORD); assertQaUri(uri);
    await connect(uri, { serverSelectionTimeoutMS: 5000 }); connected = true;
    await prepareAccounts({ password: env.ACADOVA_AI_QA_PASSWORD, resetCredentials: argv.includes('--reset-synthetic-passwords') });
    log.log('Synthetic Students ready: ' + emails.join(', ') + '. Use the password you supplied. Existing balances and learning data are preserved.');
    return 0;
  } catch (error) {
    // Database/validation errors may contain credential-bearing documents. Never print raw errors.
    log.error(error.code === 'AI_QA_SETUP' ? error.message : 'Local QA setup failed. Verify the dedicated loopback replica set; no credentials are logged.'); return 1;
  } finally { if (connected) await disconnect(); }
}
if (require.main === module) void main().then(code => { process.exitCode = code; });
module.exports = { main, prepareAccounts, assertQaUri, QA_URI, emails };
