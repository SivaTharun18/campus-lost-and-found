import pool from '../config/database.js';

// Get User Dashboard
export const getUserDashboard = async (req, res) => {
    try {
        const user_id = req.user.user_id;

        // Get item statistics
        const itemStats = await pool.query(
            `SELECT
                COUNT(*) AS total_items,
                COUNT(*) FILTER (WHERE item_type = 'lost') AS lost_items,
                COUNT(*) FILTER (WHERE item_type = 'found') AS found_items
             FROM items
             WHERE user_id = $1`,
            [user_id]
        );

        // Get claim statistics
        const claimStats = await pool.query(
            `SELECT COUNT(*) AS total_claims
             FROM claims
             WHERE claimant_id = $1`,
            [user_id]
        );

        // Get recent items
        const recentItems = await pool.query(
            `SELECT *
             FROM items
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 5`,
            [user_id]
        );

        res.json({
            message: 'Dashboard retrieved successfully!',
            statistics: {
                total_items: Number(itemStats.rows[0].total_items),
                lost_items: Number(itemStats.rows[0].lost_items),
                found_items: Number(itemStats.rows[0].found_items),
                total_claims: Number(claimStats.rows[0].total_claims)
            },
            recent_items: recentItems.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};