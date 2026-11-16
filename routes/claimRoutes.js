import express from 'express';

import {
    submitClaim,
    getMyClaims,
    reviewClaim
} from '../controllers/claimController.js';

import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Submit a Claim
router.post('/', verifyToken, submitClaim);

// Get Claims Submitted by Logged-in User
router.get('/my-claims', verifyToken, getMyClaims);

// Approve or Reject a Claim
router.put('/:id/review', verifyToken, reviewClaim);

export default router;