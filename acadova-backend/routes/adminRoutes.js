const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { listUsers } = require('../controllers/adminController');

router.use(authenticateToken, requireRole('admin'));

router.get('/users', listUsers);

module.exports = router;
