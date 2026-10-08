const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');

const router = express.Router();

// All category routes require authentication
router.use(auth);

// Read categories: Available to all authenticated members of the organization
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Manage categories: Restricted to SYSTEM_ADMIN and IT_MANAGER
router.post('/', authorize('SYSTEM_ADMIN', 'IT_MANAGER'), createCategory);
router.patch('/:id', authorize('SYSTEM_ADMIN', 'IT_MANAGER'), updateCategory);
router.delete('/:id', authorize('SYSTEM_ADMIN', 'IT_MANAGER'), deleteCategory);

module.exports = router;
