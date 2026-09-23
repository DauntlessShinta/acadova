const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const {
  listRatingsForModeration,
  updateRatingVisibility,
} = require('../controllers/moderatorController');
const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');
const { staffActionLimiter } = require('../middleware/writeLimiters');

router.use(authenticateToken, requireRole('moderator', 'admin'));
router.use(validateQuery());

router.get('/ratings', listRatingsForModeration);
router.patch('/ratings/:id/visibility', staffActionLimiter, validateParams(schemas.reviewId), validateBody(schemas.visibility), updateRatingVisibility);

module.exports = router;
