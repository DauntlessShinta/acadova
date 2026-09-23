const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getMe, updateMe, searchTutors, getUserById } = require('../controllers/userController');

router.use(authenticateToken);

router.get('/me', getMe);
router.patch('/me', updateMe);
router.get('/tutors', searchTutors);
router.get('/:id', getUserById);

module.exports = router;
