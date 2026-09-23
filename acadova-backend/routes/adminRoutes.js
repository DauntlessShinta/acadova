const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { listUsers, updateUserRole } = require('../controllers/adminController');

router.use(authenticateToken, requireRole('admin'));

router.get('/users', listUsers);
router.patch('/users/:id/role', updateUserRole);

module.exports = router;
