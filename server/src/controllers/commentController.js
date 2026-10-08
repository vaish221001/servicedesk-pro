const path = require('path');
const commentService = require('../services/commentService');
const TicketComment = require('../models/TicketComment');
const { getSafeFilePath } = require('../utils/fileStorage');
const AppError = require('../utils/AppError');

/**
 * @desc    Add comment or internal note to ticket
 * @route   POST /api/tickets/:id/comments
 * @access  Private (Role-scoped)
 */
const addComment = async (req, res, next) => {
  try {
    const comment = await commentService.addComment(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.files || [],
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get comments for a ticket (internal notes hidden from employees)
 * @route   GET /api/tickets/:id/comments
 * @access  Private (Role-scoped)
 */
const getComments = async (req, res, next) => {
  try {
    const comments = await commentService.getComments(
      req.user.organizationId,
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get complete chronological activity feed for a ticket
 * @route   GET /api/tickets/:id/activity
 * @access  Private (Role-scoped)
 */
const getActivityFeed = async (req, res, next) => {
  try {
    const feed = await commentService.getActivityFeed(
      req.user.organizationId,
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: feed,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Download a ticket attachment securely
 * @route   GET /api/tickets/:id/attachments/:filename
 * @access  Private (Role-scoped & internal note protected)
 */
const downloadAttachment = async (req, res, next) => {
  try {
    const { id: ticketId, filename } = req.params;
    if (!filename || typeof filename !== 'string') {
      throw new AppError('Invalid attachment filename', 400);
    }

    // 1. Verify general ticket access
    await commentService.verifyTicketAccess(ticketId, req.user.organizationId, req.user);

    // 2. Sanitize filename and escape regex special characters against regex injection
    const safeFilename = path.basename(filename);
    const escapedFilename = safeFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 3. Find associated comment to check internal-note privacy
    const comment = await TicketComment.findOne({
      ticketId,
      organizationId: req.user.organizationId,
      'attachments.fileUrl': new RegExp(escapedFilename),
    });

    if (!comment) {
      throw new AppError('Attachment not found on this ticket', 404);
    }

    // 3. Non-technical roles must NEVER download attachments from internal notes
    if (comment.isInternal && !['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(req.user.role)) {
      throw new AppError('You do not have permission to access internal attachments', 403);
    }

    // 4. Resolve safe file path (prevents directory traversal)
    const filePath = getSafeFilePath(filename);

    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addComment,
  getComments,
  getActivityFeed,
  downloadAttachment,
};
