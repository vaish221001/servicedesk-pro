const express = require('express');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Authoritative security: All user management endpoints require a valid JWT
// and strict SYSTEM_ADMIN role
router.use(auth);
router.use(authorize('SYSTEM_ADMIN'));

// Department options for user forms
router.get('/departments', userController.getDepartments);

// User CRUD & Status
router.route('/')
  .get(userController.getUsers)
  .post(userController.createUser);

router.route('/:id')
  .get(userController.getUserById)
  .patch(userController.updateUser);

router.patch('/:id/status', userController.setUserStatus);

module.exports = router;
