const notificationService = require('../services/notificationService');

/**
 * @desc    Get user notifications with pagination
 * @route   GET /api/notifications
 * @access  Private (All authenticated users)
 */
const getNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getUserNotifications(
      req.user.organizationId,
      req.user._id,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private (All authenticated users)
 */
const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(
      req.user.organizationId,
      req.params.id,
      req.user._id
    );
    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Mark all user notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private (All authenticated users)
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(
      req.user.organizationId,
      req.user._id
    );
    res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get unread notifications count
 * @route   GET /api/notifications/unread-count
 * @access  Private (All authenticated users)
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(
      req.user.organizationId,
      req.user._id
    );
    res.status(200).json({
      success: true,
      unreadCount: result.unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
