const assetService = require('../services/assetService');

/**
 * @desc    Create a new asset
 * @route   POST /api/assets
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER)
 */
const createAsset = async (req, res, next) => {
  try {
    const asset = await assetService.createAsset(
      req.user.organizationId,
      req.body,
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      data: asset,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List assets with filters and pagination
 * @route   GET /api/assets
 * @access  Private (Role-scoped: employees only see their own assigned assets)
 */
const getAssets = async (req, res, next) => {
  try {
    const result = await assetService.getAssets(
      req.user.organizationId,
      req.user,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result.assets,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get asset by ID
 * @route   GET /api/assets/:id
 * @access  Private (Role-scoped)
 */
const getAssetById = async (req, res, next) => {
  try {
    const asset = await assetService.getAssetById(
      req.user.organizationId,
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: asset,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update asset
 * @route   PATCH /api/assets/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER)
 */
const updateAsset = async (req, res, next) => {
  try {
    const asset = await assetService.updateAsset(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: asset,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Assign asset to user/department
 * @route   POST /api/assets/:id/assign
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER)
 */
const assignAsset = async (req, res, next) => {
  try {
    const result = await assetService.assignAsset(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: result.asset,
      assignment: result.assignment,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Return asset back to inventory
 * @route   POST /api/assets/:id/return
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER)
 */
const returnAsset = async (req, res, next) => {
  try {
    const result = await assetService.returnAsset(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: result.asset,
      assignment: result.assignment,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get historical assignments for an asset
 * @route   GET /api/assets/:id/assignments
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER, TECHNICIAN)
 */
const getAssetAssignments = async (req, res, next) => {
  try {
    const assignments = await assetService.getAssetAssignments(
      req.user.organizationId,
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate asset
 * @route   DELETE /api/assets/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER)
 */
const deleteAsset = async (req, res, next) => {
  try {
    const result = await assetService.deleteAsset(
      req.user.organizationId,
      req.params.id,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  assignAsset,
  returnAsset,
  getAssetAssignments,
  deleteAsset,
};
