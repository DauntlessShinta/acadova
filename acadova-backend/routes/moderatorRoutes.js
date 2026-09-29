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
const learningController = require('../controllers/learningController');

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
router.get('/learning/topics', learningController.listStaffTopics);
router.post('/learning/topics', staffActionLimiter, validateBody(schemas.learningTopic), learningController.createTopic);
router.post('/learning/topics/:id/publish', staffActionLimiter, validateParams(schemas.learningId),
  validateBody({}), learningController.publishTopic);
router.post('/learning/topics/:id/archive', staffActionLimiter, validateParams(schemas.learningId),
  validateBody({}), learningController.archiveTopic);
router.get('/learning/resources', learningController.listStaffResources);
router.get('/learning/resources/:id', validateParams(schemas.learningId), learningController.getStaffResource);
router.post('/learning/resources/:id/publish', staffActionLimiter, validateParams(schemas.learningId),
  validateBody(schemas.learningReview), learningController.publishResource);
router.post('/learning/resources/:id/reject', staffActionLimiter, validateParams(schemas.learningId),
  validateBody(schemas.learningRejection), learningController.rejectResource);
router.post('/learning/resources/:id/archive', staffActionLimiter, validateParams(schemas.learningId),
  validateBody({}), learningController.archiveResource);
router.get('/learning/modules', learningController.listStaffModules);
router.post('/learning/modules', staffActionLimiter, validateBody(schemas.learningModule), learningController.createModule);
router.post('/learning/modules/:id/publish', staffActionLimiter, validateParams(schemas.learningId),
  validateBody(schemas.learningModulePublish), learningController.publishModule);
router.post('/learning/modules/:id/archive', staffActionLimiter, validateParams(schemas.learningId),
  validateBody({}), learningController.archiveModule);

module.exports = router;
