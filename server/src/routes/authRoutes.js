const express = require('express');
const { login, getMe } = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes (requires valid JWT Bearer token and active user)
router.get('/me', auth, getMe);

module.exports = router;
