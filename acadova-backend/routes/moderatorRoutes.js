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
const assessmentController = require('../controllers/assessmentController');

router.use(authenticateToken, requireRole('moderator', 'admin'));
router.use(validateQuery());

router.get('/ratings', listRatingsForModeration);
router.patch('/ratings/:id/visibility', staffActionLimiter, validateParams(schemas.reviewId), validateBody(schemas.visibility), updateRatingVisibility);
router.get('/sessions/disputed', listDisputedSessions);
router.post('/sessions/:id/resolve', staffActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.resolution), resolveSessionDispute);
router.get('/assessments', assessmentController.listStaffAssessments);
router.get('/assessments/:id', validateParams(schemas.assessmentId), assessmentController.getStaffAssessment);
router.post('/assessments', staffActionLimiter, validateBody(schemas.assessmentCreate), assessmentController.createAssessment);
router.post('/assessments/:id/publish', staffActionLimiter, validateParams(schemas.assessmentId),
  validateBody({}), assessmentController.publishAssessment);

module.exports = router;
