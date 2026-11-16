import express from 'express';
import pool from './config/database.js';
import userRoutes from './routes/userRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import claimRoutes from './routes/claimRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

app.use(express.json());
app.use('/api/items', itemRoutes);
app.use('/api/users', userRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
// Serve uploaded images
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Home route
app.get('/', (req, res) => {
    res.send('Campus Lost and Found Portal API is running!');
});

// Test database connection
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');

        res.json({
            message: 'Database connected successfully!',
            time: result.rows[0].now
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Database connection failed!'
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
