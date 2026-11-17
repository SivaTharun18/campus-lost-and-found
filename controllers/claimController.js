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

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const item = await client.query(
                'SELECT user_id, status FROM items WHERE item_id = $1 FOR UPDATE', [item_id]
            );
            if (!item.rows.length || item.rows[0].status !== 'active') {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Item not found or unavailable' });
            }
            if (String(item.rows[0].user_id) === String(claimant_id)) {
                await client.query('ROLLBACK');
                return res.status(403).json({ message: 'You cannot claim your own item' });
            }
            const existingClaim = await client.query(
                `SELECT claim_id FROM claims WHERE item_id = $1 AND claimant_id = $2 AND status = 'pending' LIMIT 1`,
                [item_id, claimant_id]
            );
            if (existingClaim.rows.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'You have already submitted a pending claim' });
            }
            const result = await client.query(
                'INSERT INTO claims (item_id, claimant_id, message) VALUES ($1, $2, $3) RETURNING *',
                [item_id, claimant_id, message || null]
            );
            await client.query('COMMIT');
            return res.status(201).json({
            message: 'Claim submitted successfully!',
            claim: result.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

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

// Claims on found items owned by the logged-in student.
export const getClaimsReceived = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT claims.claim_id, claims.item_id, items.title AS item_title,
                    users.name AS claimant_name, users.email AS claimant_email,
                    claims.message, claims.created_at, claims.status
             FROM claims
             JOIN items ON claims.item_id = items.item_id
             JOIN users ON claims.claimant_id = users.user_id
             WHERE items.user_id = $1 AND items.item_type = 'found'
             ORDER BY claims.created_at DESC`,
            [req.user.user_id]
        );
        res.json({ message: 'Claims received retrieved successfully!', total: result.rows.length, claims: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// List all claims for administrators, optionally filtered by status.
export const getAllClaims = async (req, res) => {
    try {
        const { status } = req.query;
        const allowedStatuses = ['pending', 'approved', 'rejected'];

        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Status must be pending, approved, or rejected' });
        }

        const result = await pool.query(
            `SELECT claims.claim_id, claims.item_id, claims.claimant_id,
                    items.title AS item_title, users.name AS claimant_name,
                    users.email AS claimant_email, items.location,
                    claims.message, claims.created_at, claims.status
             FROM claims
             JOIN items ON claims.item_id = items.item_id
             JOIN users ON claims.claimant_id = users.user_id
             WHERE ($1::text IS NULL OR claims.status = $1)
             ORDER BY claims.created_at DESC`,
            [status || null]
        );

        res.json({ message: 'Claims retrieved successfully!', total: result.rows.length, claims: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Make a claim decision inside a transaction. Locking the item first serializes
// owner and admin decisions for every claim belonging to that item.
const decideClaim = async ({ id, status, reviewerId, admin = false }, res) => {
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const client = await pool.connect();
    let transactionOpen = false;
    try {
        await client.query('BEGIN');
        transactionOpen = true;

        const reference = await client.query(
            'SELECT item_id FROM claims WHERE claim_id = $1', [id]
        );
        if (!reference.rows.length) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return res.status(404).json({ message: 'Claim not found' });
        }

        const itemResult = await client.query(
            'SELECT user_id AS owner_id, status AS item_status FROM items WHERE item_id = $1 FOR UPDATE',
            [reference.rows[0].item_id]
        );
        const claimResult = await client.query(
            'SELECT * FROM claims WHERE claim_id = $1 FOR UPDATE', [id]
        );
        const claim = claimResult.rows[0];
        const item = itemResult.rows[0];

        if (!claim || !item) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return res.status(404).json({ message: 'Claim not found' });
        }
        if (!admin && item.owner_id !== reviewerId) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return res.status(403).json({ message: 'You are not authorized to review this claim' });
        }
        if (claim.status !== 'pending') {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return res.status(400).json({ message: 'This claim has already been reviewed' });
        }

        if (status === 'approved') {
            const previousApproval = await client.query(
                `SELECT claim_id FROM claims
                 WHERE item_id = $1 AND status = 'approved' AND claim_id <> $2
                 LIMIT 1`,
                [claim.item_id, id]
            );
            if (previousApproval.rows.length || item.item_status !== 'active') {
                await client.query('ROLLBACK');
                transactionOpen = false;
                return res.status(409).json({ message: 'Another claim has already been approved for this item, or the item is unavailable' });
            }
        }

        const result = await client.query(
            'UPDATE claims SET status = $1 WHERE claim_id = $2 RETURNING *', [status, id]
        );
        if (status === 'approved') {
            await client.query("UPDATE items SET status = 'claimed' WHERE item_id = $1", [claim.item_id]);
        }
        await client.query('COMMIT');
        transactionOpen = false;
        return res.json({ message: `Claim ${status} successfully!`, claim: result.rows[0] });
    } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// Existing owner review remains available with its original authorization.
export const reviewClaim = async (req, res) => decideClaim({
    id: req.params.id,
    status: req.body.status,
    reviewerId: req.user.user_id
}, res);

// Separate admin-only review handler (route applies verifyToken + verifyAdmin).
export const reviewClaimAsAdmin = async (req, res) => decideClaim({
    id: req.params.id,
    status: req.body.status,
    reviewerId: req.user.user_id,
    admin: true
}, res);
