import pool from '../config/database.js';
import bcrypt from 'bcrypt';

// Student Registration
export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Please provide name, email and password'
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into PostgreSQL
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING user_id, name, email, role`,
            [name, email, hashedPassword]
        );

        res.status(201).json({
            message: 'Registration successful!',
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        if (error.code === '23505') {
            return res.status(409).json({
                message: 'Email already registered'
            });
        }

        res.status(500).json({
            message: 'Server error'
        });
    }
};

// Student Login
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({
                message: 'Please provide email and password'
            });
        }

        // Find user in PostgreSQL
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const user = result.rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid password'
            });
        }

        // Generate JWT token
        const jwt = await import('jsonwebtoken');

        const token = jwt.default.sign(
    {
        user_id: user.user_id,
        email: user.email,
        role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
);

        res.json({
            message: 'Login successful!',
            token: token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};

// Get logged-in student profile
export const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT user_id, name, email, role
             FROM users
             WHERE user_id = $1`,
            [req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        res.json({
            message: 'Profile retrieved successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error'
        });
    }
};