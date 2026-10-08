const vendorService = require('../services/vendorService');

/**
 * @desc    Create a new vendor
 * @route   POST /api/vendors
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER)
 */
const createVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.createVendor(
      req.user.organizationId,
      req.body,
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      data: vendor,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List vendors with search and pagination
 * @route   GET /api/vendors
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER, TECHNICIAN)
 */
const getVendors = async (req, res, next) => {
  try {
    const result = await vendorService.getVendors(
      req.user.organizationId,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result.vendors,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get vendor by ID
 * @route   GET /api/vendors/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER, TECHNICIAN)
 */
const getVendorById = async (req, res, next) => {
  try {
    const vendor = await vendorService.getVendorById(
      req.user.organizationId,
      req.params.id
    );
    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update vendor
 * @route   PATCH /api/vendors/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER)
 */
const updateVendor = async (req, res, next) => {
  try {
    const vendor = await vendorService.updateVendor(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate vendor
 * @route   DELETE /api/vendors/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER)
 */
const deleteVendor = async (req, res, next) => {
  try {
    const result = await vendorService.deleteVendor(
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
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
};
