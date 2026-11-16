import pool from '../config/database.js';

// Submit a Claim
export const submitClaim = async (req, res) => {
    try {
        const { item_id, message } = req.body;

        const claimant_id = req.user.user_id;

        if (!item_id) {
            return res.status(400).json({
                message: 'Item ID is required'
            });
        }

        // Check whether the item exists
        const item = await pool.query(
            `SELECT * FROM items
             WHERE item_id = $1 AND status = 'active'`,
            [item_id]
        );

        if (item.rows.length === 0) {
            return res.status(404).json({
                message: 'Item not found or unavailable'
            });
        }

        // Prevent users from claiming their own items
        if (item.rows[0].user_id === claimant_id) {
            return res.status(403).json({
                message: 'You cannot claim your own item'
            });
        }

        // Check whether a claim already exists
        const existingClaim = await pool.query(
            `SELECT * FROM claims
             WHERE item_id = $1
             AND claimant_id = $2
             AND status = 'pending'`,
            [item_id, claimant_id]
        );

        if (existingClaim.rows.length > 0) {
            return res.status(400).json({
                message: 'You have already submitted a pending claim'
            });
        }

        // Insert the claim
        const result = await pool.query(
            `INSERT INTO claims
             (item_id, claimant_id, message)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [item_id, claimant_id, message || null]
        );

        res.status(201).json({
            message: 'Claim submitted successfully!',
            claim: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};

// Get Claims Submitted by Logged-in User
export const getMyClaims = async (req, res) => {
    try {
        const user_id = req.user.user_id;

        const result = await pool.query(
            `SELECT claims.*, items.title AS item_title,
                    items.location, users.name AS claimant_name
             FROM claims
             JOIN items ON claims.item_id = items.item_id
             JOIN users ON claims.claimant_id = users.user_id
             WHERE claims.claimant_id = $1
             ORDER BY claims.created_at DESC`,
            [user_id]
        );

        res.json({
            message: 'Your claims retrieved successfully!',
            total: result.rows.length,
            claims: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};

// Approve or Reject a Claim
export const reviewClaim = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { status } = req.body;

        const reviewer_id = req.user.user_id;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                message: 'Status must be approved or rejected'
            });
        }

        await client.query('BEGIN');

        // Check the claim and item owner
        const claim = await client.query(
            `SELECT claims.*, items.user_id AS owner_id
             FROM claims
             JOIN items ON claims.item_id = items.item_id
             WHERE claims.claim_id = $1
             FOR UPDATE OF claims`,
            [id]
        );

        if (claim.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                message: 'Claim not found'
            });
        }

        // Only the item owner can review the claim
        if (claim.rows[0].owner_id !== reviewer_id) {
            await client.query('ROLLBACK');

            return res.status(403).json({
                message: 'You are not authorized to review this claim'
            });
        }

        if (claim.rows[0].status !== 'pending') {
            await client.query('ROLLBACK');

            return res.status(400).json({
                message: 'This claim has already been reviewed'
            });
        }

        // Update claim status
        const result = await client.query(
            `UPDATE claims
             SET status = $1
             WHERE claim_id = $2
             RETURNING *`,
            [status, id]
        );

        // If approved, update item status
        if (status === 'approved') {
            await client.query(
                `UPDATE items
                 SET status = 'claimed'
                 WHERE item_id = $1`,
                [claim.rows[0].item_id]
            );
        }

        await client.query('COMMIT');

        res.json({
            message: `Claim ${status} successfully!`,
            claim: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });

    } finally {
        client.release();
    }
};