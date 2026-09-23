const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { createSession, getMySessions, updateSessionStatus } = require('../controllers/sessionController');

router.use(authenticateToken);

router.post('/', createSession);
router.get('/', getMySessions);
router.patch('/:id/status', updateSessionStatus);

module.exports = router;
