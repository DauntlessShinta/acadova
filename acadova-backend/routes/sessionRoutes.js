const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const {
  createSession,
  getMySessions,
  getSessionById,
  updateSessionStatus,
  updateCoordination,
  generateGoogleMeet,
  proposeReschedule,
  acceptReschedule,
  declineReschedule,
  withdrawReschedule,
  checkIn,
  finishSession,
  reportNoShow,
  disputeSession,
  getMessages,
  createMessage,
  confirmSession,
} = require('../controllers/sessionController');
const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');
const { sessionCreationLimiter, sessionActionLimiter, messageLimiter } = require('../middleware/writeLimiters');
const completion = require('../controllers/completionController');

router.use(authenticateToken);
router.use(requireRole('student'));
router.use(validateQuery());

router.post('/', sessionCreationLimiter, validateBody(schemas.session), createSession);
router.get('/', getMySessions);
router.get('/:id', validateParams(schemas.sessionId), getSessionById);
router.patch('/:id/status', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.sessionStatus), updateSessionStatus);
router.patch('/:id/coordination', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.coordination, { exactlyOne: true }), updateCoordination);
router.post('/:id/google-meet', sessionActionLimiter, validateParams(schemas.sessionId),
  validateBody(schemas.googleMeet), generateGoogleMeet);
router.post('/:id/reschedule', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.reschedule), proposeReschedule);
router.post('/:id/reschedule/accept', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.rescheduleDecision), acceptReschedule);
router.post('/:id/reschedule/decline', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.rescheduleDecision), declineReschedule);
router.post('/:id/reschedule/withdraw', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.rescheduleDecision), withdrawReschedule);
router.post('/:id/check-in', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.checkIn), checkIn);
router.post('/:id/finish', sessionActionLimiter, validateParams(schemas.sessionId), validateBody({}), finishSession);
router.post('/:id/no-show', sessionActionLimiter, validateParams(schemas.sessionId), validateBody({}), reportNoShow);
router.post('/:id/dispute', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.dispute), disputeSession);
router.post('/:id/exp-report',sessionActionLimiter,validateParams(schemas.sessionId),validateBody(schemas.dispute),require('../controllers/growthReviewController').report);
router.post('/:id/confirm', sessionActionLimiter, validateParams(schemas.sessionId), validateBody({}), confirmSession);
router.get('/:id/evidence', validateParams(schemas.sessionId), completion.getEvidence);
router.post('/:id/evidence', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.completionEvidence), completion.submitEvidence);
router.post('/:id/review-request', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.dispute), completion.requestReview);
router.get('/:id/messages', validateParams(schemas.sessionId), getMessages);
router.post('/:id/messages', messageLimiter, validateParams(schemas.sessionId), validateBody(schemas.message), createMessage);

module.exports = router;
