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

router.use(authenticateToken);
router.use(requireRole('student'));

router.post('/', createSession);
router.get('/', getMySessions);
router.get('/:id', getSessionById);
router.patch('/:id/status', updateSessionStatus);
router.patch('/:id/coordination', updateCoordination);
router.post('/:id/confirm', confirmSession);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', createMessage);

module.exports = router;
