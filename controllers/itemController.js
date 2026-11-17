import pool from '../config/database.js';

// Create Lost or Found Item
// Create a Lost or Found Item with Image Upload
export const createItem = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            item_type,
            location,
            item_date
        } = req.body;

        // Validate required fields
        if (!title || !item_type || !location) {
            return res.status(400).json({
                message: 'Title, item type and location are required'
            });
        }

        // Validate item type
        if (!['lost', 'found'].includes(item_type)) {
            return res.status(400).json({
                message: 'Item type must be lost or found'
            });
        }

        // Get uploaded image filename
        const image_url = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        // Insert item into PostgreSQL
        const result = await pool.query(
            `INSERT INTO items
            (user_id, title, description, category,
             item_type, location, item_date, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                req.user.user_id,
                title,
                description,
                category,
                item_type,
                location,
                item_date || null,
                image_url
            ]
        );

        res.status(201).json({
            message: 'Item reported successfully!',
            item: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};

// Get All Lost and Found Items
export const getAllItems = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT items.*, users.name AS reported_by
             FROM items
             JOIN users ON items.user_id = users.user_id
             WHERE items.status = 'active'
             ORDER BY items.created_at DESC`
        );

        res.json({
            message: 'Items retrieved successfully',
            total: result.rows.length,
            items: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};

// Search and Filter Items
export const searchItems = async (req, res) => {
    try {
        const { keyword, category, location, item_type } = req.query;

        let query = `
            SELECT items.*, users.name AS reported_by
            FROM items
            JOIN users ON items.user_id = users.user_id
            WHERE items.status = 'active'
        `;

        const values = [];

        if (keyword) {
            values.push(`%${keyword}%`);
            query += ` AND (items.title ILIKE $${values.length}
                      OR items.description ILIKE $${values.length})`;
        }

        if (category) {
            values.push(category);
            query += ` AND items.category ILIKE $${values.length}`;
        }

        if (location) {
            values.push(`%${location}%`);
            query += ` AND items.location ILIKE $${values.length}`;
        }

        if (item_type) {
            values.push(item_type);
            query += ` AND items.item_type = $${values.length}`;
        }

        query += ' ORDER BY items.created_at DESC';

        const result = await pool.query(query, values);

        res.json({
            message: 'Search completed successfully',
            total: result.rows.length,
            items: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};

// Update an Item
export const updateItem = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            title,
            description,
            category,
            item_type,
            location,
            item_date
        } = req.body;

        const result = await pool.query(
            `UPDATE items
             SET title = $1,
                 description = $2,
                 category = $3,
                 item_type = $4,
                 location = $5,
                 item_date = $6
             WHERE item_id = $7 AND user_id = $8
             RETURNING *`,
            [
                title,
                description,
                category,
                item_type,
                location,
                item_date,
                id,
                req.user.user_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Item not found or you are not authorized to update it'
            });
        }

        res.json({
            message: 'Item updated successfully!',
            item: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Server error'
        });
    }
};


// Delete an Item
export const deleteItem = async (req, res) => {
    const client = await pool.connect();
    let transactionOpen = false;
    try {
        const { id } = req.params;
        await client.query('BEGIN');
        transactionOpen = true;
        const itemResult = await client.query(
            'SELECT user_id, status FROM items WHERE item_id = $1 FOR UPDATE', [id]
        );
        const item = itemResult.rows[0];
        if (!item) {
            await client.query('ROLLBACK'); transactionOpen = false;
            return res.status(404).json({ message: 'Item not found' });
        }
        if (String(item.user_id) !== String(req.user.user_id) && req.user.role !== 'admin') {
            await client.query('ROLLBACK'); transactionOpen = false;
            return res.status(403).json({ message: 'You are not authorized to delete this item' });
        }
        if (item.status === 'claimed') {
            await client.query('ROLLBACK'); transactionOpen = false;
            return res.status(409).json({ message: 'Claimed items cannot be deleted or archived' });
        }
        if (item.status === 'returned' || item.status === 'archived') {
            await client.query('ROLLBACK'); transactionOpen = false;
            return res.status(409).json({ message: 'Returned or archived items cannot be deleted' });
        }
        const history = await client.query(
            'SELECT EXISTS (SELECT 1 FROM claims WHERE item_id = $1) OR EXISTS (SELECT 1 FROM public.found_notifications WHERE item_id = $1) AS has_history',
            [id]
        );
        if (history.rows[0].has_history) {
            await client.query("UPDATE items SET status = 'archived' WHERE item_id = $1", [id]);
            await client.query('COMMIT'); transactionOpen = false;
            return res.json({ message: 'Item archived. Existing claim and notification history has been preserved.' });
        }
        await client.query('DELETE FROM items WHERE item_id = $1', [id]);
        await client.query('COMMIT'); transactionOpen = false;
        return res.json({ message: 'Item deleted successfully!' });

    } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        client.release();
    }
};

// The owner of a lost report confirms its physical return.
export const markLostItemReturned = async (req, res) => {
    const client = await pool.connect();
    let open = false;
    try {
        await client.query('BEGIN'); open = true;
        const item = await client.query(
            'SELECT user_id, item_type, status FROM items WHERE item_id = $1 FOR UPDATE', [req.params.id]
        );
        if (!item.rows.length) {
            await client.query('ROLLBACK'); open = false;
            return res.status(404).json({ message: 'Item not found' });
        }
        if (String(item.rows[0].user_id) !== String(req.user.user_id)) {
            await client.query('ROLLBACK'); open = false;
            return res.status(403).json({ message: 'Only the item owner can confirm its return' });
        }
        if (item.rows[0].item_type !== 'lost' || item.rows[0].status !== 'active') {
            await client.query('ROLLBACK'); open = false;
            return res.status(409).json({ message: 'Only an active lost item can be marked returned' });
        }
        await client.query("UPDATE items SET status = 'returned' WHERE item_id = $1", [req.params.id]);
        await client.query("UPDATE public.found_notifications SET status = 'resolved' WHERE item_id = $1 AND status = 'pending'", [req.params.id]);
        await client.query('COMMIT'); open = false;
        return res.json({ message: 'Item marked returned. Found notification history has been preserved.' });
    } catch (error) {
        if (open) await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    } finally { client.release(); }
};


// Get Single Item by ID
export const getItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT items.*, users.name AS reported_by
             FROM items
             JOIN users ON items.user_id = users.user_id
             WHERE items.item_id = $1 AND items.status = 'active'`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        res.json({
            message: 'Item found successfully!',
            item: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};
