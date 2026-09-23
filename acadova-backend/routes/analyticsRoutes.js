const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const {
  getSubjectAnalytics,
  getSessionAnalytics,
  getRatingAnalytics,
  getCreditAnalytics,
} = require('../controllers/analyticsController');
const { validateQuery } = require('../middleware/validation');

// Analytics are platform-level insight, not exposed to ordinary students.
router.use(authenticateToken, requireRole('admin'));
router.use(validateQuery());

router.get('/subjects', getSubjectAnalytics);
router.get('/sessions', getSessionAnalytics);
router.get('/ratings', getRatingAnalytics);
router.get('/credits', getCreditAnalytics);

module.exports = router;
