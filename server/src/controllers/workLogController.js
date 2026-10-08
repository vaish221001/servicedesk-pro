const workLogService = require('../services/workLogService');

/**
 * @desc    Create a work log on a ticket
 * @route   POST /api/tickets/:id/work-logs
 * @access  Private (TECHNICIAN, IT_MANAGER, SYSTEM_ADMIN)
 */
const createWorkLog = async (req, res, next) => {
  try {
    const workLog = await workLogService.createWorkLog(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      data: workLog,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List work logs on a ticket
 * @route   GET /api/tickets/:id/work-logs
 * @access  Private (TECHNICIAN, IT_MANAGER, SYSTEM_ADMIN)
 */
const getWorkLogs = async (req, res, next) => {
  try {
    const workLogs = await workLogService.getWorkLogs(
      req.user.organizationId,
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: workLogs,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update a work log entry
 * @route   PATCH /api/tickets/:id/work-logs/:workLogId
 * @access  Private (Author technician, IT_MANAGER, SYSTEM_ADMIN)
 */
const updateWorkLog = async (req, res, next) => {
  try {
    const workLog = await workLogService.updateWorkLog(
      req.user.organizationId,
      req.params.id,
      req.params.workLogId,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: workLog,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a work log entry
 * @route   DELETE /api/tickets/:id/work-logs/:workLogId
 * @access  Private (Author technician, IT_MANAGER, SYSTEM_ADMIN)
 */
const deleteWorkLog = async (req, res, next) => {
  try {
    const result = await workLogService.deleteWorkLog(
      req.user.organizationId,
      req.params.id,
      req.params.workLogId,
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
  createWorkLog,
  getWorkLogs,
  updateWorkLog,
  deleteWorkLog,
};
