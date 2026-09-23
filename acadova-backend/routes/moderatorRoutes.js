const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const {
  listRatingsForModeration,
  updateRatingVisibility,
} = require('../controllers/moderatorController');

router.use(authenticateToken, requireRole('moderator', 'admin'));

router.get('/ratings', listRatingsForModeration);
router.patch('/ratings/:id/visibility', updateRatingVisibility);

module.exports = router;
