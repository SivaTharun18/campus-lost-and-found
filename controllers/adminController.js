import pool from '../config/database.js';

// Get Admin Dashboard Statistics
export const getAdminDashboard = async (req, res) => {
    try {

        // Total registered users
        const users = await pool.query(
            'SELECT COUNT(*) FROM users'
        );

        // Total lost and found items
        const items = await pool.query(
            `SELECT
                COUNT(*) AS total_items,
                COUNT(*) FILTER (WHERE item_type = 'lost') AS lost_items,
                COUNT(*) FILTER (WHERE item_type = 'found') AS found_items
             FROM items`
        );

        // Total claims and their statuses
        const claims = await pool.query(
            `SELECT
                COUNT(*) AS total_claims,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_claims,
                COUNT(*) FILTER (WHERE status = 'approved') AS approved_claims,
                COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_claims
             FROM claims`
        );

        res.json({
            message: 'Admin dashboard retrieved successfully!',

            statistics: {
                total_users: Number(users.rows[0].count),
                total_items: Number(items.rows[0].total_items),
                lost_items: Number(items.rows[0].lost_items),
                found_items: Number(items.rows[0].found_items),
                total_claims: Number(claims.rows[0].total_claims),
                pending_claims: Number(claims.rows[0].pending_claims),
                approved_claims: Number(claims.rows[0].approved_claims),
                rejected_claims: Number(claims.rows[0].rejected_claims)
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};