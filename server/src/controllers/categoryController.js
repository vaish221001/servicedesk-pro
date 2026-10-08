const categoryService = require('../services/categoryService');

/**
 * @desc    Create a category or subcategory
 * @route   POST /api/categories
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER)
 */
const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(
      req.user.organizationId,
      req.body,
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List categories for organization
 * @route   GET /api/categories
 * @access  Private (All authenticated users in org)
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.getCategories(
      req.user.organizationId,
      req.query,
      req.user.role
    );
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get category by ID
 * @route   GET /api/categories/:id
 * @access  Private (All authenticated users in org)
 */
const getCategoryById = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(
      req.user.organizationId,
      req.params.id
    );
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update a category
 * @route   PATCH /api/categories/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER)
 */
const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate a category
 * @route   DELETE /api/categories/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const result = await categoryService.deleteCategory(
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
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
