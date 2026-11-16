import express from 'express';

import { getAdminDashboard } from '../controllers/adminController.js';

import { verifyToken } from '../middleware/authMiddleware.js';
import { verifyAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Admin Dashboard (Admin Only)
router.get('/', verifyToken, verifyAdmin, getAdminDashboard);

export default router;