const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { getMyCreditHistory, getCurrentCreditRules } = require('../controllers/creditController');

const historyQuery = (req, res, next) => {
  if (Object.keys(req.query).some((key) => !['page', 'limit'].includes(key))) {
    return res.status(400).json({ success: false, message: 'Unexpected query field.' });
  }
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  if ((req.query.page !== undefined && !/^[1-9]\d*$/.test(req.query.page))
    || (req.query.limit !== undefined && !/^[1-9]\d*$/.test(req.query.limit))
    || !Number.isSafeInteger(page) || page > 10000
    || !Number.isSafeInteger(limit) || limit > 50) {
    return res.status(400).json({ success: false, message: 'Invalid credit history page or limit.' });
  }
  req.validatedQuery = { page, limit };
  next();
};

router.use(authenticateToken, requireRole('student'));

router.get('/mine', historyQuery, getMyCreditHistory);
router.get('/rules', (req, res, next) => Object.keys(req.query).length
  ? res.status(400).json({ success: false, message: 'Unexpected query field.' }) : next(), getCurrentCreditRules);

module.exports = router;
