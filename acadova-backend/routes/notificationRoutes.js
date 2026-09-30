const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateBody, validateQuery } = require('../middleware/validation');
const controller = require('../controllers/notificationController');

const router = express.Router();
router.use(authenticateToken);
router.get('/', controller.listMine);
router.use(validateQuery());
router.get('/push-identity', controller.pushIdentity);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', validateBody({}), controller.markAllRead);
router.patch('/:id/read', validateBody({}), controller.markRead);
module.exports = router;
