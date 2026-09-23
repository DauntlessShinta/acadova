const CreditTransaction = require('../models/CreditTransaction');

// GET /api/credits/mine - the logged-in user's own credit transaction history.
exports.getMyCreditHistory = async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      $or: [{ fromUser: req.user.id }, { toUser: req.user.id }],
    })
      .populate('fromUser', 'name')
      .populate('toUser', 'name')
      .populate('session', 'subject')
      .sort({ createdAt: -1 });

    // Reshape server-side so the frontend doesn't need to know the viewer's
    // own id to figure out whether this was a credit earned or spent.
    const data = transactions.map((tx) => {
      const isEarner = tx.toUser._id.toString() === req.user.id;
      return {
        id: tx._id,
        direction: isEarner ? 'earned' : 'spent',
        amount: tx.amount,
        subject: tx.session ? tx.session.subject : null,
        counterparty: isEarner ? tx.fromUser.name : tx.toUser.name,
        createdAt: tx.createdAt,
      };
    });

    res.json({ success: true, message: 'Credit history retrieved', data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving credit history' });
  }
};
