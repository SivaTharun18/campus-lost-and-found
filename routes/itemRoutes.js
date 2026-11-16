import express from 'express';
import upload from '../middleware/uploadMiddleware.js';

import {
    createItem,
    getAllItems,
    searchItems,
    updateItem,
    deleteItem,
    getItemById
} from '../controllers/itemController.js';

import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a Lost or Found Item
router.post('/', verifyToken, upload.single('image'), createItem);

// Search and Filter Items
router.get('/search', searchItems);

// Get Single Item by ID
router.get('/:id', getItemById);

// Get All Items
router.get('/', getAllItems);

// Update an Item
router.put('/:id', verifyToken, updateItem);

// Delete an Item
router.delete('/:id', verifyToken, deleteItem);

export default router;