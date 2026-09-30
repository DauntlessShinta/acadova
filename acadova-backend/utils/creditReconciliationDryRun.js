const { matchesPayment } = require('./sessionLifecycleCompatibility');

const BATCH_SIZE = 250;
const SAMPLE_LIMIT = 25;
const TYPES = ['initial_grant', 'session_payment', 'assessment_reward',
  'learning_unlock', 'admin_adjustment'];
const requiredIndexes = [
  ['credittransactions', 'uniq_session_payment_session', { session: 1, type: 1 },
    { type: 'session_payment', session: { $exists: true } }],
  ['credittransactions', 'uniq_initial_grant_recipient', { toUser: 1 },
    { type: 'initial_grant', toUser: { $exists: true } }],
  ['credittransactions', 'uniq_assessment_reward_recipient_assessment',
    { toUser: 1, assessment: 1, type: 1 },
    { type: 'assessment_reward', toUser: { $exists: true }, assessment: { $exists: true } }],
  ['credittransactions', 'uniq_learning_unlock_ledger_resource',
    { fromUser: 1, resource: 1, type: 1 },
    { type: 'learning_unlock', resource: { $exists: true } }],
  ['credittransactions', 'uniq_learning_unlock_ledger_module',
    { fromUser: 1, module: 1, type: 1 },
    { type: 'learning_unlock', module: { $exists: true } }],
  ['credittransactions', 'uniq_admin_adjustment_reference', { adjustmentReference: 1 },
    { type: 'admin_adjustment', adjustmentReference: { $exists: true } }],
  ['learningunlocks', 'uniq_learning_unlock_student_resource', { student: 1, resource: 1 },
    { resource: { $exists: true } }],
  ['learningunlocks', 'uniq_learning_unlock_student_module', { student: 1, module: 1 },
    { module: { $exists: true } }],
  ['learningtopics', 'uniq_learning_topic_slug', { slug: 1 }, null],
];

const id = (value) => value == null ? null : String(value);
const normalized = (value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalized(value[key])])) : value;
const sameShape = (left, right) => JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
const sameKey = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const hasIndex = (indexes, name, key, partial) => indexes.some((index) =>
  index.name === name && index.unique === true && sameKey(index.key, key)
  && sameShape(index.partialFilterExpression || null, partial));
const validAmount = (value) => Number.isSafeInteger(value) && value > 0;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const makeReport = () => ({
  mode: 'read_only_dry_run',
  totalUsers: 0,
  transactionsByType: Object.fromEntries(TYPES.map((type) => [type, 0])),
  anomalies: {
    invalidTransactionAmount: 0, brokenSessionPayment: 0,
    duplicateLookingEvent: 0, duplicateLookingEntitlement: 0,
    orphanLearningUnlockLedger: 0, orphanLearningEntitlement: 0,
    malformedAdminAdjustment: 0, negativeUserBalance: 0, invalidUserBalance: 0,
    ledgerCoveredBalanceMismatchCandidate: 0,
  },
  legacyUnreconcilableUsers: 0,
  legacyUnreconcilableSamples: [],
  samples: {},
  indexReadiness: [],
});

const record = (report, category, value) => {
  report.anomalies[category] += 1;
  const bucket = report.samples[category] ||= [];
  if (bucket.length < SAMPLE_LIMIT) bucket.push(id(value));
};

const eventKey = (row) => {
  if (row.type === 'initial_grant') return row.toUser && `grant:${id(row.toUser)}`;
  if (row.type === 'session_payment') return row.session && `session:${id(row.session)}`;
  if (row.type === 'assessment_reward') return row.toUser && row.assessment
    && `assessment:${id(row.toUser)}:${id(row.assessment)}`;
  if (row.type === 'learning_unlock') return row.fromUser && (row.resource || row.module)
    && `unlock:${id(row.fromUser)}:${row.resource ? 'resource' : 'module'}:${id(row.resource || row.module)}`;
  if (row.type === 'admin_adjustment') return row.adjustmentReference
    && `adjustment:${String(row.adjustmentReference).toLowerCase()}`;
  return null;
};

const validAdjustment = (row) => {
  if (!row.adjustmentTarget || !row.adjustmentActor || !validAmount(row.amount)
    || !uuid.test(row.adjustmentReference || '')
    || typeof row.adjustmentReason !== 'string'
    || row.adjustmentReason.trim().length < 10 || row.adjustmentReason.trim().length > 500
    || row.session || row.assessment || row.result || row.resource || row.module || row.unlock) return false;
  if (row.adjustmentDirection === 'credit') {
    return !row.fromUser && id(row.toUser) === id(row.adjustmentTarget);
  }
  if (row.adjustmentDirection === 'debit') {
    return !row.toUser && id(row.fromUser) === id(row.adjustmentTarget);
  }
  return false;
};

async function runDryRun(db) {
  const report = makeReport();
  const users = new Map();
  const sessions = new Map();
  const unlocks = new Map();
  const ledgerUnlocks = new Set();
  const eventKeys = new Set();
  const entitlementKeys = new Set();
  const grantedUsers = new Set();
  const deltas = new Map();
  const addDelta = (userId, amount) => {
    if (userId && users.has(userId)) deltas.set(userId, (deltas.get(userId) || 0) + amount);
  };

  for await (const user of db.collection('users').find({}, {
    projection: { _id: 1, role: 1, credits: 1 },
  }).batchSize(BATCH_SIZE)) {
    const key = id(user._id);
    users.set(key, user);
    report.totalUsers += 1;
    if (typeof user.credits === 'number' && user.credits < 0) record(report, 'negativeUserBalance', user._id);
    else if (!Number.isSafeInteger(user.credits)) record(report, 'invalidUserBalance', user._id);
  }
  for await (const session of db.collection('sessions').find({}, {
    projection: { _id: 1, learner: 1, tutor: 1, creditAmount: 1 },
  }).batchSize(BATCH_SIZE)) sessions.set(id(session._id), session);
  for await (const unlock of db.collection('learningunlocks').find({}, {
    projection: { _id: 1, student: 1, resource: 1, module: 1, pricePaid: 1 },
  }).batchSize(BATCH_SIZE)) {
    unlocks.set(id(unlock._id), unlock);
    const key = unlock.student && (unlock.resource || unlock.module)
      && `${id(unlock.student)}:${unlock.resource ? 'resource' : 'module'}:${id(unlock.resource || unlock.module)}`;
    if (key && entitlementKeys.has(key)) record(report, 'duplicateLookingEntitlement', unlock._id);
    if (key) entitlementKeys.add(key);
  }

  for await (const row of db.collection('credittransactions').find({}, {
    projection: { _id: 1, type: 1, amount: 1, fromUser: 1, toUser: 1,
      session: 1, assessment: 1, result: 1, resource: 1, module: 1, unlock: 1,
      adjustmentTarget: 1, adjustmentActor: 1, adjustmentDirection: 1,
      adjustmentReason: 1, adjustmentReference: 1 },
  }).batchSize(BATCH_SIZE)) {
    const type = row.type || 'missing';
    report.transactionsByType[type] = (report.transactionsByType[type] || 0) + 1;
    if (!validAmount(row.amount)) record(report, 'invalidTransactionAmount', row._id);
    const key = eventKey(row);
    if (key && eventKeys.has(key)) record(report, 'duplicateLookingEvent', row._id);
    if (key) eventKeys.add(key);
    if (type === 'initial_grant' && row.toUser) grantedUsers.add(id(row.toUser));
    if (type === 'session_payment') {
      const session = sessions.get(id(row.session));
      if (!session || id(row.fromUser) === id(row.toUser) || !matchesPayment(session, row)) {
        record(report, 'brokenSessionPayment', row._id);
      }
    }
    if (type === 'learning_unlock') {
      const entitlement = unlocks.get(id(row.unlock));
      if (!entitlement || id(entitlement.student) !== id(row.fromUser)
        || id(entitlement.resource) !== id(row.resource)
        || id(entitlement.module) !== id(row.module)
        || entitlement.pricePaid !== row.amount) {
        record(report, 'orphanLearningUnlockLedger', row._id);
      } else ledgerUnlocks.add(id(row.unlock));
    }
    if (type === 'admin_adjustment' && !validAdjustment(row)) {
      record(report, 'malformedAdminAdjustment', row._id);
    }
    if (validAmount(row.amount) && id(row.fromUser) !== id(row.toUser)) {
      addDelta(id(row.fromUser), -row.amount);
      addDelta(id(row.toUser), row.amount);
    }
  }
  for (const unlock of unlocks.values()) {
    if (!ledgerUnlocks.has(id(unlock._id))) record(report, 'orphanLearningEntitlement', unlock._id);
  }
  for (const [key, user] of users) {
    if (user.role !== 'student') continue;
    if (!grantedUsers.has(key)) {
      report.legacyUnreconcilableUsers += 1;
      if (report.legacyUnreconcilableSamples.length < SAMPLE_LIMIT) {
        report.legacyUnreconcilableSamples.push(key);
      }
    }
    else if (Number.isSafeInteger(user.credits) && user.credits !== (deltas.get(key) || 0)) {
      record(report, 'ledgerCoveredBalanceMismatchCandidate', user._id);
    }
  }
  const indexes = {};
  for (const collection of ['credittransactions', 'learningunlocks', 'learningtopics']) {
    indexes[collection] = await db.collection(collection).indexes();
  }
  report.indexReadiness = requiredIndexes.map(([collection, name, key, partial]) => ({
    collection, name, ready: hasIndex(indexes[collection], name, key, partial),
  }));
  return report;
}

module.exports = { runDryRun, hasIndex, requiredIndexes };
