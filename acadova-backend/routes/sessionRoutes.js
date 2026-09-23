const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const {
  createSession,
  getMySessions,
  getSessionById,
  updateSessionStatus,
  updateCoordination,
  getMessages,
  createMessage,
  confirmSession,
} = require('../controllers/sessionController');
const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');
const { sessionCreationLimiter, sessionActionLimiter, messageLimiter } = require('../middleware/writeLimiters');

router.use(authenticateToken);
router.use(requireRole('student'));
router.use(validateQuery());

router.post('/', sessionCreationLimiter, validateBody(schemas.session), createSession);
router.get('/', getMySessions);
router.get('/:id', validateParams(schemas.sessionId), getSessionById);
router.patch('/:id/status', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.sessionStatus), updateSessionStatus);
router.patch('/:id/coordination', sessionActionLimiter, validateParams(schemas.sessionId), validateBody(schemas.coordination, { exactlyOne: true }), updateCoordination);
router.post('/:id/confirm', sessionActionLimiter, validateParams(schemas.sessionId), validateBody({}), confirmSession);
router.get('/:id/messages', validateParams(schemas.sessionId), getMessages);
router.post('/:id/messages', messageLimiter, validateParams(schemas.sessionId), validateBody(schemas.message), createMessage);

module.exports = router;
