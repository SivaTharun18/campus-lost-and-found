import express from 'express';

import { getUserDashboard } from '../controllers/dashboardController.js';

import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get Logged-in User Dashboard
router.get('/', verifyToken, getUserDashboard);

export default router;