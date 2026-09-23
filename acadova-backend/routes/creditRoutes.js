const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getMyCreditHistory } = require('../controllers/creditController');

router.use(authenticateToken);

router.get('/mine', getMyCreditHistory);

module.exports = router;
