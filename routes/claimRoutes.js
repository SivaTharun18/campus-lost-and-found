import express from 'express';

import {
    submitClaim,
    getMyClaims,
    getClaimsReceived,
    reviewClaim,
    getAllClaims,
    reviewClaimAsAdmin
} from '../controllers/claimController.js';

import { verifyToken } from '../middleware/authMiddleware.js';
import { verifyAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Submit a Claim
router.post('/', verifyToken, submitClaim);

// Get Claims Submitted by Logged-in User
router.get('/my-claims', verifyToken, getMyClaims);
router.get('/received', verifyToken, getClaimsReceived);

// Admin claim inbox and decision APIs
router.get('/admin', verifyToken, verifyAdmin, getAllClaims);
router.put('/admin/:id/review', verifyToken, verifyAdmin, reviewClaimAsAdmin);

// Approve or Reject a Claim
router.put('/:id/review', verifyToken, reviewClaim);

export default router;
