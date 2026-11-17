import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { getMyFoundNotifications, reviewFoundNotification, submitFoundNotification } from '../controllers/notificationController.js';

const router = express.Router();
router.get('/received', verifyToken, getMyFoundNotifications);
router.post('/', verifyToken, submitFoundNotification);
router.put('/:id/review', verifyToken, reviewFoundNotification);

export default router;
