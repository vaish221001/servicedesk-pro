const userService = require('../services/userService');

/**
 * ServiceDesk Pro — User Management Controller
 */

/**
 * @desc    List users with pagination, search, and role/department/status filters
 * @route   GET /api/users
 * @access  Private (SYSTEM_ADMIN only)
 */
const getUsers = async (req, res, next) => {
  try {
    const result = await userService.getUsers(req.user.organizationId, req.query);
    res.status(200).json({
      success: true,
      count: result.users.length,
      pagination: result.pagination,
      data: result.users,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private (SYSTEM_ADMIN only)
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.organizationId, req.params.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a new user
 * @route   POST /api/users
 * @access  Private (SYSTEM_ADMIN only)
 */
const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(
      req.user.organizationId,
      req.body,
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update user details, role, department, or password
 * @route   PATCH /api/users/:id
 * @access  Private (SYSTEM_ADMIN only)
 */
const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Set user active/inactive status
 * @route   PATCH /api/users/:id/status
 * @access  Private (SYSTEM_ADMIN only)
 */
const setUserStatus = async (req, res, next) => {
  try {
    const user = await userService.setUserStatus(
      req.user.organizationId,
      req.params.id,
      req.body.isActive,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get organization departments for user form dropdowns
 * @route   GET /api/users/departments
 * @access  Private (SYSTEM_ADMIN only)
 */
const getDepartments = async (req, res, next) => {
  try {
    const departments = await userService.getDepartments(req.user.organizationId);
    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  setUserStatus,
  getDepartments,
};
