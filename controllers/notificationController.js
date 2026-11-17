import pool from '../config/database.js';

const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
};

export const submitFoundNotification = async (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ message: 'Only students can send found notifications' });
    const { item_id, found_location, found_date, description, message } = req.body;
    if (!/^\d+$/.test(String(item_id || '')) || Number(item_id) < 1 || !found_location?.trim() || !validDate(found_date) || !description?.trim() || !message?.trim()) {
        return res.status(400).json({ message: 'Item, found location, valid found date, description and message are required' });
    }
    if (found_location.trim().length > 250 || description.trim().length > 2000 || message.trim().length > 2000) {
        return res.status(400).json({ message: 'Location must be under 250 characters; description and message must be under 2000 characters' });
    }

    const client = await pool.connect();
    let open = false;
    try {
        await client.query('BEGIN'); open = true;
        const item = await client.query('SELECT user_id, item_type, status FROM items WHERE item_id = $1 FOR UPDATE', [item_id]);
        if (!item.rows.length || item.rows[0].item_type !== 'lost' || item.rows[0].status !== 'active') {
            await client.query('ROLLBACK'); open = false;
            return res.status(404).json({ message: 'Active lost item not found' });
        }
        if (String(item.rows[0].user_id) === String(req.user.user_id)) {
            await client.query('ROLLBACK'); open = false;
            return res.status(403).json({ message: 'You cannot notify yourself about your own item' });
        }
        const duplicate = await client.query(
            "SELECT notification_id FROM found_notifications WHERE item_id = $1 AND finder_id = $2 AND status = 'pending' LIMIT 1",
            [item_id, req.user.user_id]
        );
        if (duplicate.rows.length) {
            await client.query('ROLLBACK'); open = false;
            return res.status(409).json({ message: 'You already sent a pending notification for this item' });
        }
        const created = await client.query(
            `INSERT INTO found_notifications (item_id, finder_id, found_location, found_date, description, message)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [item_id, req.user.user_id, found_location.trim(), found_date, description.trim(), message.trim()]
        );
        await client.query('COMMIT'); open = false;
        return res.status(201).json({ message: 'Found notification sent to the item owner.', notification: created.rows[0] });
    } catch (error) {
        if (open) await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    } finally { client.release(); }
};

export const getMyFoundNotifications = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT n.notification_id, n.item_id, i.title AS item_title,
                    f.name AS finder_name, f.email AS finder_email,
                    n.found_location, n.found_date, n.description, n.message,
                    n.status, n.created_at
             FROM found_notifications n
             JOIN items i ON i.item_id = n.item_id
             JOIN users f ON f.user_id = n.finder_id
             WHERE i.user_id = $1 AND i.item_type = 'lost'
             ORDER BY n.created_at DESC`,
            [req.user.user_id]
        );
        return res.json({ total: result.rows.length, notifications: result.rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// The owner of the original Lost item reviews a pending found notification.
export const reviewFoundNotification = async (req, res) => {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
    }
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
        return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const client = await pool.connect();
    let open = false;
    try {
        await client.query('BEGIN'); open = true;
        const reference = await client.query(
            'SELECT item_id FROM found_notifications WHERE notification_id = $1', [req.params.id]
        );
        if (!reference.rows.length) {
            await client.query('ROLLBACK'); open = false;
            return res.status(404).json({ message: 'Found notification not found' });
        }
        const itemResult = await client.query(
            'SELECT user_id, item_type, status FROM items WHERE item_id = $1 FOR UPDATE',
            [reference.rows[0].item_id]
        );
        const notificationResult = await client.query(
            'SELECT * FROM found_notifications WHERE notification_id = $1 FOR UPDATE', [req.params.id]
        );
        const item = itemResult.rows[0], notification = notificationResult.rows[0];
        if (!item || !notification) {
            await client.query('ROLLBACK'); open = false;
            return res.status(404).json({ message: 'Found notification or item not found' });
        }
        if (String(item.user_id) !== String(req.user.user_id) || item.item_type !== 'lost') {
            await client.query('ROLLBACK'); open = false;
            return res.status(403).json({ message: 'Only the original Lost item owner can review this notification' });
        }
        if (notification.status !== 'pending' || item.status !== 'active') {
            await client.query('ROLLBACK'); open = false;
            return res.status(409).json({ message: 'Only pending notifications for active Lost items can be reviewed' });
        }
        const updated = await client.query(
            'UPDATE found_notifications SET status = $1 WHERE notification_id = $2 RETURNING *',
            [status, req.params.id]
        );
        await client.query('COMMIT'); open = false;
        return res.json({ message: `Found notification ${status}. Arrange collection with the finder; approval does not mark the item returned.`, notification: updated.rows[0] });
    } catch (error) {
        if (open) await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    } finally { client.release(); }
};
