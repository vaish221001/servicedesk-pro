const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
} = require('../controllers/vendorController');

const router = express.Router();

// All vendor routes require authentication
router.use(auth);

// Vendors CRUD
router.get(
  '/',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER', 'TECHNICIAN'),
  getVendors
);

router.post(
  '/',
  authorize('SYSTEM_ADMIN', 'ASSET_MANAGER'),
  createVendor
);

router.get(
  '/:id',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER', 'TECHNICIAN'),
  getVendorById
);

router.patch(
  '/:id',
  authorize('SYSTEM_ADMIN', 'ASSET_MANAGER'),
  updateVendor
);

router.delete(
  '/:id',
  authorize('SYSTEM_ADMIN', 'ASSET_MANAGER'),
  deleteVendor
);

module.exports = router;
