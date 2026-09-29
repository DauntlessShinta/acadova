const mongoose = require('mongoose');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const Session = require('../models/Session');
const Assessment = require('../models/Assessment');
const LearningResource = require('../models/LearningResource');
const LearningModule = require('../models/LearningModule');

const labels = {
  session_payment: 'Tutoring session',
  initial_grant: 'Starting credits',
  assessment_reward: 'Assessment reward',
  learning_unlock: 'Learning unlock',
  admin_adjustment: 'Credit adjustment',
};
const idOf = (value) => value?.toString();
const validRef = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

// GET /api/credits/mine — only the authenticated Student's activity.
exports.getMyCreditHistory = async (req, res) => {
  try {
    const viewerId = req.user.id;
    const page = req.validatedQuery?.page || 1;
    const limit = req.validatedQuery?.limit || 20;
    const rows = await CreditTransaction.find({
      $or: [{ fromUser: viewerId }, { toUser: viewerId }],
    })
      .select('_id type amount fromUser toUser session assessment resource module unlock createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const transactions = rows.slice(0, limit);
    const viewerObjectId = new mongoose.Types.ObjectId(viewerId);
    // Aggregate all recorded activity, not just the current history page.
    // Match the normalization rule: only positive whole amounts with exactly one viewer side count.
    const [totals] = await CreditTransaction.aggregate([
      { $match: {
        $or: [{ fromUser: viewerObjectId }, { toUser: viewerObjectId }],
      } },
      { $match: { $expr: { $isNumber: '$amount' } } },
      { $match: { amount: { $gt: 0, $lte: Number.MAX_SAFE_INTEGER },
        $expr: { $eq: ['$amount', { $trunc: ['$amount', 0] }] } } },
      { $group: {
        _id: null,
        recordedEarned: { $sum: { $cond: [
          { $and: [{ $eq: ['$toUser', viewerObjectId] }, { $ne: ['$fromUser', viewerObjectId] }] },
          '$amount', 0,
        ] } },
        recordedSpent: { $sum: { $cond: [
          { $and: [{ $eq: ['$fromUser', viewerObjectId] }, { $ne: ['$toUser', viewerObjectId] }] },
          '$amount', 0,
        ] } },
      } },
    ]);
    const peerIds = [...new Set(transactions.flatMap((tx) => [tx.fromUser, tx.toUser]
      .map(idOf).filter((id) => validRef(id) && id !== viewerId)))];
    const sessionIds = [...new Set(transactions.map((tx) => idOf(tx.session)).filter(validRef))];
    const assessmentIds = [...new Set(transactions.map((tx) => idOf(tx.assessment)).filter(validRef))];
    const resourceIds = [...new Set(transactions.map((tx) => idOf(tx.resource)).filter(validRef))];
    const moduleIds = [...new Set(transactions.map((tx) => idOf(tx.module)).filter(validRef))];
    const [peers, sessions, assessments, resources, modules] = await Promise.all([
      peerIds.length ? User.find({ _id: { $in: peerIds } }).select('_id name').lean() : [],
      sessionIds.length ? Session.find({ _id: { $in: sessionIds } })
        .select('_id subject scheduledAt learner tutor').lean() : [],
      assessmentIds.length ? Assessment.find({ _id: { $in: assessmentIds } })
        .select('_id title').lean() : [],
      resourceIds.length ? LearningResource.find({ _id: { $in: resourceIds } })
        .select('_id title').lean() : [],
      moduleIds.length ? LearningModule.find({ _id: { $in: moduleIds } })
        .select('_id title').lean() : [],
    ]);
    const peerById = new Map(peers.map((peer) => [idOf(peer._id), peer.name]));
    const sessionById = new Map(sessions.map((session) => [idOf(session._id), session]));
    const assessmentById = new Map(assessments.map((assessment) => [idOf(assessment._id), assessment.title]));
    const resourceById = new Map(resources.map((resource) => [idOf(resource._id), resource.title]));
    const moduleById = new Map(modules.map((module) => [idOf(module._id), module.title]));

    const data = transactions.map((tx) => {
      const fromViewer = idOf(tx.fromUser) === viewerId;
      const toViewer = idOf(tx.toUser) === viewerId;
      const direction = fromViewer === toViewer ? 'neutral' : toViewer ? 'earned' : 'spent';
      const session = sessionById.get(idOf(tx.session));
      const peerId = fromViewer ? idOf(tx.toUser) : idOf(tx.fromUser);
      const counterparty = tx.type === 'initial_grant' ? null : peerById.get(peerId) || null;
      const relatedSession = session ? {
        id: idOf(session._id), subject: session.subject || null,
        scheduledAt: session.scheduledAt || null,
      } : null;
      let description = null;
      if (tx.type === 'initial_grant') description = 'Acadova welcome credit grant';
      else if (tx.type === 'assessment_reward') {
        description = assessmentById.get(idOf(tx.assessment)) || 'Approved assessment';
      }
      else if (tx.type === 'learning_unlock') {
        description = tx.resource ? resourceById.get(idOf(tx.resource)) || 'Learning resource'
          : moduleById.get(idOf(tx.module)) || 'Learning module';
      }
      else if (tx.type === 'session_payment' && session) {
        const role = idOf(session.learner) === viewerId ? 'learner'
          : idOf(session.tutor) === viewerId ? 'tutor' : null;
        if (role === 'learner' && direction === 'spent' && counterparty
          && idOf(session.tutor) === peerId) description = `Learned with ${counterparty}`;
        else if (role === 'tutor' && direction === 'earned' && counterparty
          && idOf(session.learner) === peerId) description = `Taught ${counterparty}`;
        else if (session.subject) description = session.subject;
        if (session.subject && description !== session.subject) description += ` · ${session.subject}`;
      }
      const amount = Number.isSafeInteger(tx.amount) && tx.amount > 0 ? tx.amount : null;
      return {
        id: idOf(tx._id), type: tx.type || 'unknown', direction, amount,
        signedAmount: amount === null ? null : direction === 'earned' ? amount
          : direction === 'spent' ? -amount : null,
        label: tx.type === 'learning_unlock' ? tx.resource ? 'Learning resource' : 'Learning module'
          : labels[tx.type] || 'Credit activity', description,
        occurredAt: tx.createdAt || null, relatedSession, counterparty,
        relatedAssessment: tx.type === 'assessment_reward' && validRef(idOf(tx.assessment))
          ? { id: idOf(tx.assessment), title: assessmentById.get(idOf(tx.assessment)) || null } : null,
        relatedLearning: tx.type === 'learning_unlock' ? {
          resourceId: validRef(idOf(tx.resource)) ? idOf(tx.resource) : null,
          moduleId: validRef(idOf(tx.module)) ? idOf(tx.module) : null,
        } : null,
        // Read-only aliases keep the deployed legacy client's history display working.
        subject: relatedSession?.subject || (tx.type === 'initial_grant' ? 'Starting credits' : null),
        createdAt: tx.createdAt || null,
      };
    });

    res.json({ success: true, message: 'Credit history retrieved', balance: req.user.credits,
      summary: { recordedEarned: totals?.recordedEarned || 0, recordedSpent: totals?.recordedSpent || 0 },
      data, pagination: { page, limit, hasMore } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving credit history' });
  }
};
