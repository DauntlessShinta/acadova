const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { getMyCreditHistory } = require('../controllers/creditController');
const { validateQuery } = require('../middleware/validation');

router.use(authenticateToken, requireRole('student'));

router.get('/mine', validateQuery(), getMyCreditHistory);

module.exports = router;
