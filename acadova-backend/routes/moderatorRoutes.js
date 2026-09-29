const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const {
  listRatingsForModeration,
  updateRatingVisibility,
  listDisputedSessions,
  resolveSessionDispute,
} = require('../controllers/moderatorController');
const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');
const { staffActionLimiter } = require('../middleware/writeLimiters');

router.use(authenticateToken, requireRole('moderator', 'admin'));
router.use(validateQuery());

router.get('/ratings', listRatingsForModeration);
router.patch('/ratings/:id/visibility', staffActionLimiter, validateParams(schemas.reviewId), validateBody(schemas.visibility), updateRatingVisibility);
router.get('/sessions/disputed', listDisputedSessions);
router.post('/sessions/:id/resolve', staffActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.resolution), resolveSessionDispute);

module.exports = router;
