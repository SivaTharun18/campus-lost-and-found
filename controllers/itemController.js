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
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM items
             WHERE item_id = $1 AND user_id = $2
             RETURNING *`,
            [id, req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Item not found or you are not authorized to delete it'
            });
        }

        res.json({
            message: 'Item deleted successfully!'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};


// Get Single Item by ID
export const getItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT items.*, users.name AS reported_by
             FROM items
             JOIN users ON items.user_id = users.user_id
             WHERE items.item_id = $1`,
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