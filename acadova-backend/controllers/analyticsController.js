const Session = require('../models/Session');
const Rating = require('../models/Rating');
const CreditTransaction = require('../models/CreditTransaction');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const LearningUnlock = require('../models/LearningUnlock');
const StudyAttempt = require('../models/StudyAttempt');
const { dateMatch, aggregate } = require('../utils/analyticsWindow');
const dayOf = field => ({ $dateToString: { format: '%Y-%m-%d', date: '$' + field, timezone: 'UTC' } });

// GET /api/analytics/subjects
// Groups/counts subject demand in MongoDB; never materializes every Session in Node.
exports.getSubjectAnalytics = async (req, res) => {
  try {
    const rows = await aggregate(Session, [
      { $match: { ...dateMatch(req, 'createdAt'), subject: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$subject', requestCount: { $sum: 1 } } },
      { $sort: { requestCount: -1, _id: 1 } }, { $limit: 20 },
    ]);
    const data = rows.map(row => ({ subject: row._id, requestCount: row.requestCount }));
    res.json({ success: true, message: 'Subject demand analytics', data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while computing subject analytics' });
  }
};

// GET /api/analytics/sessions
// Supports the Session Completion Volume variable.
exports.getSessionAnalytics = async (req, res) => {
  try {
    const [summary] = await aggregate(Session, [
      { $match: dateMatch(req, 'createdAt') },
      { $facet: {
        counts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        trend: [{ $match: { createdAt: { $type: 'date' } } },
          { $group: { _id: dayOf('createdAt'), count: { $sum: 1 } } },
          { $sort: { _id: -1 } }, { $limit: 366 }, { $sort: { _id: 1 } }],
      } },
    ]);
    const counts = summary?.counts || [];
    const byStatus = counts.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});
    const total = counts.reduce((sum, row) => sum + row.count, 0);

    res.json({
      success: true,
      message: 'Session analytics',
      data: { total, byStatus, trend: summary?.trend || [] },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while computing session analytics' });
  }
};

// GET /api/analytics/ratings
// Supports the Peer Rating Scores variable.
exports.getRatingAnalytics = async (req, res) => {
  try {
    const [summary] = await aggregate(Rating, [
      { $match: { ...dateMatch(req, 'createdAt'), isHidden: { $ne: true } } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const distribution = await aggregate(Rating, [
      { $match: { ...dateMatch(req, 'createdAt'), isHidden: { $ne: true } } },
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
    const [summary] = await aggregate(CreditTransaction, [
      { $match: dateMatch(req, 'createdAt') },
      { $facet: {
        rows: [{ $group: { _id: { type: '$type', direction: '$adjustmentDirection' },
          count: { $sum: 1 }, amount: { $sum: '$amount' } } }],
        trend: [{ $match: { type: 'session_payment', createdAt: { $type: 'date' } } },
          { $group: { _id: dayOf('createdAt'), count: { $sum: 1 } } },
          { $sort: { _id: -1 } }, { $limit: 366 }, { $sort: { _id: 1 } }],
      } },
    ]);
    const rows = summary?.rows || [];
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
        tutoringPayments: rows.filter(row => row._id.type === 'session_payment').reduce((sum, row) => sum + row.count, 0),
        trend: summary?.trend || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while computing credit analytics' });
  }
};

// Counts outcomes, not resource views or externally verified meeting attendance.
exports.getLearningAnalytics = async (req, res) => {
  try {
    const [attemptRows, unlockRows, studyRows] = await Promise.all([
      aggregate(AssessmentAttempt, [{ $match: dateMatch(req, 'submittedAt') },
        { $group: { _id: { $ifNull: ['$mode', 'official'] }, count: { $sum: 1 },
          passed: { $sum: { $cond: ['$passed', 1, 0] } }, averageScore: { $avg: '$score' } } }]),
      aggregate(LearningUnlock, [{ $match: dateMatch(req, 'unlockedAt') },
        { $group: { _id: { $cond: [{ $ifNull: ['$resource', false] }, 'resource', 'module'] }, count: { $sum: 1 } } }]),
      aggregate(StudyAttempt, [{ $match: { ...dateMatch(req, 'submittedAt'), submittedAt: {
        $type: 'date', ...(dateMatch(req, 'submittedAt').submittedAt || {}),
      } } }, { $count: 'count' }]),
    ]);
    const official = attemptRows.find(row => row._id === 'official');
    const officialAttempts = official?.count || 0;
    const officialPassed = official?.passed || 0;
    const resourceUnlocks = unlockRows.find(row => row._id === 'resource')?.count || 0;
    const moduleUnlocks = unlockRows.find(row => row._id === 'module')?.count || 0;
    res.json({ success: true, data: { officialAttempts, officialPassed,
      officialPassRate: officialAttempts ? Math.round(officialPassed * 1000 / officialAttempts) / 10 : null,
      averageOfficialScore: Number.isFinite(official?.averageScore) ? Math.round(official.averageScore * 10) / 10 : null,
      practiceAttempts: attemptRows.find(row => row._id === 'practice')?.count || 0,
      studyAttempts: studyRows[0]?.count || 0, resourceUnlocks, moduleUnlocks,
      unlocks: resourceUnlocks + moduleUnlocks,
    } });
  } catch { res.status(503).json({ success: false, message: 'Learning analytics could not be loaded.' }); }
};
