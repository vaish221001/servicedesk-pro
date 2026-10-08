const Ticket = require('../models/Ticket');
const WorkLog = require('../models/WorkLog');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('./auditService');
const { hasDepartmentAccess } = require('../utils/departmentAccess');

/**
 * Validates technician access to a ticket for work logging.
 */
const verifyTechnicianTicketAccess = async (ticketId, organizationId, user) => {
  if (user.role === 'EMPLOYEE') {
    throw new AppError('Employees are not permitted to access or log technician work', 403);
  }
  if (!['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(user.role)) {
    throw new AppError('Only technical support personnel are permitted to access or log technician work', 403);
  }

  const ticket = await Ticket.findOne({ _id: ticketId, organizationId });
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  if (user.role === 'TECHNICIAN') {
    const hasDeptAccess = hasDepartmentAccess(user, ticket.departmentId, organizationId);
    const isAssigned =
      ticket.assignedTo && ticket.assignedTo.toString() === user._id.toString();
    if (!hasDeptAccess && !isAssigned) {
      throw new AppError('You do not have permission to manage work logs in this department', 403);
    }
  }

  return ticket;
};

/**
 * Creates a work log on a ticket.
 */
const createWorkLog = async (organizationId, ticketId, data, user, req = null) => {
  const ticket = await verifyTechnicianTicketAccess(ticketId, organizationId, user);

  const { timeSpentMinutes, description, workDate } = data;

  const parsedMinutes = parseInt(timeSpentMinutes, 10);
  if (isNaN(parsedMinutes) || parsedMinutes <= 0) {
    throw new AppError('Time spent must be a positive number of minutes (minimum 1)', 400);
  }

  if (!description || !description.trim()) {
    throw new AppError('Work description is required', 400);
  }

  const parsedDate = workDate ? new Date(workDate) : new Date();
  if (isNaN(parsedDate.getTime())) {
    throw new AppError('Invalid work date format', 400);
  }

  const workLog = await WorkLog.create({
    ticketId,
    organizationId,
    technicianId: user._id,
    timeSpentMinutes: parsedMinutes,
    workDate: parsedDate,
    description: description.trim(),
  });

  await workLog.populate('technicianId', 'firstName lastName email avatarUrl role');

  // Audit Logging
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: user._id,
    actorRole: user.role,
    action: 'WORK_LOG_CREATED',
    entityType: 'TICKET',
    entityId: ticketId,
    details: {
      workLogId: workLog._id,
      timeSpentMinutes: parsedMinutes,
      workDate: parsedDate,
    },
    req,
  });

  return workLog;
};

/**
 * Lists work logs for a ticket.
 */
const getWorkLogs = async (organizationId, ticketId, user) => {
  await verifyTechnicianTicketAccess(ticketId, organizationId, user);

  const workLogs = await WorkLog.find({ ticketId, organizationId })
    .populate('technicianId', 'firstName lastName email avatarUrl role')
    .sort({ workDate: -1, createdAt: -1 });

  return workLogs;
};

/**
 * Updates a work log entry.
 */
const updateWorkLog = async (organizationId, ticketId, workLogId, data, user, req = null) => {
  await verifyTechnicianTicketAccess(ticketId, organizationId, user);

  const workLog = await WorkLog.findOne({ _id: workLogId, ticketId, organizationId });
  if (!workLog) {
    throw new AppError('Work log not found', 404);
  }

  // Technicians can only edit their own work logs; Managers and Admins can edit any
  if (user.role === 'TECHNICIAN' && workLog.technicianId.toString() !== user._id.toString()) {
    throw new AppError('You can only edit your own work logs', 403);
  }

  if (data.timeSpentMinutes !== undefined) {
    const mins = parseInt(data.timeSpentMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      throw new AppError('Time spent must be a positive number of minutes', 400);
    }
    workLog.timeSpentMinutes = mins;
  }

  if (data.description !== undefined) {
    if (!data.description.trim()) {
      throw new AppError('Work description cannot be empty', 400);
    }
    workLog.description = data.description.trim();
  }

  if (data.workDate !== undefined) {
    const date = new Date(data.workDate);
    if (isNaN(date.getTime())) {
      throw new AppError('Invalid work date format', 400);
    }
    workLog.workDate = date;
  }

  await workLog.save();

  // Audit Logging
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: user._id,
    actorRole: user.role,
    action: 'WORK_LOG_UPDATED',
    entityType: 'TICKET',
    entityId: ticketId,
    details: {
      workLogId: workLog._id,
      timeSpentMinutes: workLog.timeSpentMinutes,
    },
    req,
  });

  return workLog;
};

/**
 * Deletes a work log entry.
 */
const deleteWorkLog = async (organizationId, ticketId, workLogId, user, req = null) => {
  await verifyTechnicianTicketAccess(ticketId, organizationId, user);

  const workLog = await WorkLog.findOne({ _id: workLogId, ticketId, organizationId });
  if (!workLog) {
    throw new AppError('Work log not found', 404);
  }

  if (user.role === 'TECHNICIAN' && workLog.technicianId.toString() !== user._id.toString()) {
    throw new AppError('You can only delete your own work logs', 403);
  }

  await WorkLog.deleteOne({ _id: workLogId });

  // Audit Logging
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: user._id,
    actorRole: user.role,
    action: 'WORK_LOG_DELETED',
    entityType: 'TICKET',
    entityId: ticketId,
    details: {
      workLogId,
      timeSpentMinutes: workLog.timeSpentMinutes,
    },
    req,
  });

  return { message: 'Work log deleted successfully' };
};

module.exports = {
  createWorkLog,
  getWorkLogs,
  updateWorkLog,
  deleteWorkLog,
};
