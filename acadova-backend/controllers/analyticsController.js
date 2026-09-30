const Session = require('../models/Session');
const Rating = require('../models/Rating');
const CreditTransaction = require('../models/CreditTransaction');
const { runSubjectDemandMapReduce } = require('../utils/mapReduce');

// GET /api/analytics/subjects
// Demonstrates MAP -> GROUP -> REDUCE over session subjects to compute
// Subject Demand Frequency, one of our measurable research variables.
exports.getSubjectAnalytics = async (req, res) => {
  try {
    const sessions = await Session.find({}, 'subject');
    const data = runSubjectDemandMapReduce(sessions);
    res.json({ success: true, message: 'Subject demand analytics', data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while computing subject analytics' });
  }
};

// GET /api/analytics/sessions
// Supports the Session Completion Volume variable.
exports.getSessionAnalytics = async (req, res) => {
  try {
    const counts = await Session.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byStatus = counts.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});
    const total = counts.reduce((sum, row) => sum + row.count, 0);

    res.json({
      success: true,
      message: 'Session analytics',
      data: { total, byStatus },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while computing session analytics' });
  }
};

// GET /api/analytics/ratings
// Supports the Peer Rating Scores variable.
exports.getRatingAnalytics = async (req, res) => {
  try {
    const [summary] = await Rating.aggregate([
      { $match: { isHidden: { $ne: true } } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const distribution = await Rating.aggregate([
      { $match: { isHidden: { $ne: true } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      message: 'Rating analytics',
      data: {
        averageRating: summary ? Number(summary.average.toFixed(2)) : null,
        totalRatings: summary ? summary.count : 0,
        distribution,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while computing rating analytics' });
  }
};

// GET /api/analytics/credits
// Supports the Credit Transactions variable.
exports.getCreditAnalytics = async (req, res) => {
  try {
    const rows = await CreditTransaction.aggregate([
      { $group: { _id: { type: '$type', direction: '$adjustmentDirection' },
        count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]);
    const breakdown = {
      sessionTransferred: 0, initialGranted: 0, assessmentAwarded: 0,
      learningSpent: 0, adminAdded: 0, adminRemoved: 0,
    };
    let totalTransactions = 0;
    let totalCreditsMoved = 0;
    for (const row of rows) {
      totalTransactions += row.count;
      totalCreditsMoved += row.amount;
      if (row._id.type === 'session_payment') breakdown.sessionTransferred += row.amount;
      if (row._id.type === 'initial_grant') breakdown.initialGranted += row.amount;
      if (row._id.type === 'assessment_reward') breakdown.assessmentAwarded += row.amount;
      if (row._id.type === 'learning_unlock') breakdown.learningSpent += row.amount;
      if (row._id.type === 'admin_adjustment' && row._id.direction === 'credit') breakdown.adminAdded += row.amount;
      if (row._id.type === 'admin_adjustment' && row._id.direction === 'debit') breakdown.adminRemoved += row.amount;
    }

    res.json({
      success: true,
      message: 'Credit transaction analytics',
      data: {
        totalTransactions,
        totalCreditsMoved,
        breakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while computing credit analytics' });
  }
};
