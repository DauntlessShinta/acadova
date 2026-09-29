const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');
const { assessmentSubmissionLimiter } = require('../middleware/writeLimiters');
const controller = require('../controllers/assessmentController');

router.use(authenticateToken, requireRole('student'), validateQuery());
router.get('/', controller.listPublishedAssessments);
router.get('/attempts/:id', validateParams(schemas.assessmentId), controller.getOwnAttempt);
router.get('/:id', validateParams(schemas.assessmentId), controller.getPublishedAssessment);
router.post('/:id/submit', assessmentSubmissionLimiter, validateParams(schemas.assessmentId),
  validateBody(schemas.assessmentSubmit), controller.submitAssessment);

module.exports = router;
