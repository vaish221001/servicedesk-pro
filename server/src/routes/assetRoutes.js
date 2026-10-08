const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  assignAsset,
  returnAsset,
  getAssetAssignments,
  deleteAsset,
} = require('../controllers/assetController');

const router = express.Router();

// All asset routes require authentication
router.use(auth);

// Asset Listing & Retrieval (Scoped: employees only see their assigned assets)
router.get('/', getAssets);
router.get('/:id', getAssetById);

// Asset Management (Restricted to SYSTEM_ADMIN and ASSET_MANAGER)
router.post(
  '/',
  authorize('SYSTEM_ADMIN', 'ASSET_MANAGER'),
  createAsset
);

router.patch(
  '/:id',
  authorize('SYSTEM_ADMIN', 'ASSET_MANAGER'),
  updateAsset
);

router.delete(
  '/:id',
  authorize('SYSTEM_ADMIN', 'ASSET_MANAGER'),
  deleteAsset
);

// Asset Assignment Lifecycle (Checkout and Return)
router.post(
  '/:id/assign',
  authorize('SYSTEM_ADMIN', 'ASSET_MANAGER'),
  assignAsset
);

router.post(
  '/:id/return',
  authorize('SYSTEM_ADMIN', 'ASSET_MANAGER'),
  returnAsset
);

// Asset Assignment History
router.get(
  '/:id/assignments',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER', 'TECHNICIAN'),
  getAssetAssignments
);

module.exports = router;
