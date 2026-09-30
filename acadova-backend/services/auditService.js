const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

const ACTIONS = Object.freeze({
  dispute: 'session.dispute_resolved', rules: 'credit.rules_changed', adjustment: 'credit.admin_adjustment',
  topicCreated: 'learning.topic_created', topicPublished: 'learning.topic_published',
  topicArchived: 'learning.topic_archived', resourcePublished: 'learning.resource_approved',
  resourceRejected: 'learning.resource_rejected', resourceArchived: 'learning.resource_archived',
  moduleCreated: 'learning.module_created', modulePublished: 'learning.module_published',
  moduleArchived: 'learning.module_archived', review: 'review.moderated',
  assessmentCreated: 'learning.assessment_created', assessmentPublished: 'learning.assessment_published',
  suspended: 'user.suspended', reactivated: 'user.reactivated', role: 'user.role_changed',
});

// Only known non-secret scalar fields may enter persistent metadata. Never accept a request body.
const SAFE_FIELDS = new Set(['resolution', 'direction', 'amount', 'reference', 'beforeVersion',
  'afterVersion', 'previousRole', 'newRole', 'hidden', 'previousStatus', 'newStatus', 'creditCost']);

async function recordAudit({ actor, action, targetType, targetId, summary, metadata = {}, session }) {
  if (!actor?.id || !['moderator', 'admin'].includes(actor.role)
    || !Object.values(ACTIONS).includes(action)
    || !['Session', 'CreditConfig', 'CreditTransaction', 'LearningTopic', 'LearningResource',
      'LearningModule', 'Assessment', 'Rating', 'User'].includes(targetType)
    || !targetId || typeof summary !== 'string') throw new Error('Invalid audit event');
  const safe = Object.fromEntries(Object.entries(metadata).filter(([key, value]) =>
    SAFE_FIELDS.has(key) && ['string', 'number', 'boolean'].includes(typeof value)));
  const [entry] = await AuditLog.create([{ actor: actor.id, actorRole: actor.role, action,
    targetType, targetId: String(targetId), summary: summary.slice(0, 200), metadata: safe }],
  session ? { session } : {});
  return entry;
}

async function auditedContentChange(req, action, targetType, summary, write, metadata = {}) {
  const dbSession = await mongoose.startSession();
  try {
    let row;
    await dbSession.withTransaction(async () => {
      row = await write(dbSession);
      if (!row) return;
      await recordAudit({ actor: req.user, action, targetType, targetId: row._id,
        summary, metadata, session: dbSession });
    });
    return row;
  } finally { await dbSession.endSession(); }
}

module.exports = { ACTIONS, recordAudit, auditedContentChange };
