const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const {
  getSubjectAnalytics,
  getSessionAnalytics,
  getRatingAnalytics,
  getCreditAnalytics,
  getLearningAnalytics,
} = require('../controllers/analyticsController');
const { analyticsWindow } = require('../utils/analyticsWindow');

// Analytics are platform-level insight, not exposed to ordinary students.
router.use(authenticateToken, requireRole('admin'));
router.use(analyticsWindow);

router.get('/subjects', getSubjectAnalytics);
router.get('/sessions', getSessionAnalytics);
router.get('/ratings', getRatingAnalytics);
router.get('/credits', getCreditAnalytics);
router.get('/learning', getLearningAnalytics);

module.exports = router;
