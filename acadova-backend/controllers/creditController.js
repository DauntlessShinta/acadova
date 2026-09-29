const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const Session = require('../models/Session');

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
      .select('_id type amount fromUser toUser session createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const transactions = rows.slice(0, limit);
    const peerIds = [...new Set(transactions.flatMap((tx) => [tx.fromUser, tx.toUser]
      .map(idOf).filter((id) => validRef(id) && id !== viewerId)))];
    const sessionIds = [...new Set(transactions.map((tx) => idOf(tx.session)).filter(validRef))];
    const [peers, sessions] = await Promise.all([
      peerIds.length ? User.find({ _id: { $in: peerIds } }).select('_id name').lean() : [],
      sessionIds.length ? Session.find({ _id: { $in: sessionIds } })
        .select('_id subject scheduledAt learner tutor').lean() : [],
    ]);
    const peerById = new Map(peers.map((peer) => [idOf(peer._id), peer.name]));
    const sessionById = new Map(sessions.map((session) => [idOf(session._id), session]));

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
        label: labels[tx.type] || 'Credit activity', description,
        occurredAt: tx.createdAt || null, relatedSession, counterparty,
        // Read-only aliases keep the deployed legacy client's history display working.
        subject: relatedSession?.subject || (tx.type === 'initial_grant' ? 'Starting credits' : null),
        createdAt: tx.createdAt || null,
      };
    });

    res.json({ success: true, message: 'Credit history retrieved', balance: req.user.credits,
      data, pagination: { page, limit, hasMore } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving credit history' });
  }
};
