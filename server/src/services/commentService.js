const Ticket = require('../models/Ticket');
const TicketComment = require('../models/TicketComment');
const WorkLog = require('../models/WorkLog');
const AuditLog = require('../models/AuditLog');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('./auditService');
const { notifyTicketComment } = require('./notificationService');
const { hasDepartmentAccess } = require('../utils/departmentAccess');

/**
 * Validates that a user has read access to a specific ticket.
 */
const verifyTicketAccess = async (ticketId, organizationId, user) => {
  const ticket = await Ticket.findOne({ _id: ticketId, organizationId });
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  if (user.role === 'EMPLOYEE') {
    if (ticket.requesterId.toString() !== user._id.toString()) {
      throw new AppError('You do not have permission to access this ticket', 403);
    }
  } else if (user.role === 'TECHNICIAN') {
    const hasDeptAccess = hasDepartmentAccess(user, ticket.departmentId, organizationId);
    const isAssigned =
      ticket.assignedTo && ticket.assignedTo.toString() === user._id.toString();
    if (!hasDeptAccess && !isAssigned) {
      throw new AppError('You do not have permission to access tickets in this department', 403);
    }
  } else if (user.role === 'ASSET_MANAGER') {
    const isRequester = ticket.requesterId.toString() === user._id.toString();
    const hasDeptAccess = hasDepartmentAccess(user, ticket.departmentId, organizationId);
    const hasLinkedAsset = !!ticket.relatedAssetId;
    if (!isRequester && !hasDeptAccess && !hasLinkedAsset) {
      throw new AppError('You do not have permission to access this ticket', 403);
    }
  }

  return ticket;
};

/**
 * Adds a comment or internal note to a ticket, optionally with attachments.
 */
const addComment = async (organizationId, ticketId, data, files = [], user, req = null) => {
  const ticket = await verifyTicketAccess(ticketId, organizationId, user);

  const { content, isInternal: isInternalRaw } = data;
  const isInternal = isInternalRaw === 'true' || isInternalRaw === true;

  if (!content || !content.trim()) {
    throw new AppError('Comment content is required', 400);
  }

  // Only technical staff (TECHNICIAN, IT_MANAGER, SYSTEM_ADMIN) can post internal notes
  if (isInternal) {
    if (user.role === 'EMPLOYEE') {
      throw new AppError('Employees are not permitted to create internal notes', 403);
    }
    if (!['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(user.role)) {
      throw new AppError('You are not permitted to create internal notes', 403);
    }
  }

  // Process uploaded files
  const attachments = (files || []).map((file) => ({
    fileName: file.originalname,
    fileUrl: `/api/tickets/${ticketId}/attachments/${file.filename}`,
    fileSize: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date(),
  }));

  const comment = await TicketComment.create({
    ticketId,
    organizationId,
    authorId: user._id,
    content: content.trim(),
    isInternal,
    attachments,
  });

  // Populate author details for immediate client return
  await comment.populate('authorId', 'firstName lastName email avatarUrl role');

  // Audit Logging
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: user._id,
    actorRole: user.role,
    action: isInternal ? 'TICKET_INTERNAL_NOTE_ADDED' : 'TICKET_COMMENT_ADDED',
    entityType: 'TICKET',
    entityId: ticketId,
    details: {
      commentId: comment._id,
      isInternal,
      attachmentCount: attachments.length,
    },
    req,
  });

  // Notify relevant parties
  await notifyTicketComment(ticket, comment, user);

  return comment;
};

/**
 * Retrieves comments for a ticket in chronological order.
 * Strictly hides internal notes from non-technical roles.
 */
const getComments = async (organizationId, ticketId, user) => {
  await verifyTicketAccess(ticketId, organizationId, user);

  const filter = {
    ticketId,
    organizationId,
  };

  // Only technical personnel can see internal notes
  if (!['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(user.role)) {
    filter.isInternal = false;
  }

  const comments = await TicketComment.find(filter)
    .populate('authorId', 'firstName lastName email avatarUrl role')
    .sort({ createdAt: 1 });

  return comments;
};

/**
 * Returns a unified, chronological activity feed for a ticket.
 * Combines comments, status transitions, assignments, and work logs.
 * Strictly redacts internal notes and technician work logs from non-technical roles.
 */
const getActivityFeed = async (organizationId, ticketId, user) => {
  const ticket = await verifyTicketAccess(ticketId, organizationId, user);

  const isTechnicalStaff = ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(user.role);

  // 1. Fetch Comments
  const commentFilter = { ticketId, organizationId };
  if (!isTechnicalStaff) {
    commentFilter.isInternal = false;
  }

  const commentsPromise = TicketComment.find(commentFilter)
    .populate('authorId', 'firstName lastName avatarUrl role')
    .lean();

  // 2. Fetch Relevant Audit Logs (status changes, assignments, reopenings)
  const auditFilter = {
    organizationId,
    entityType: 'TICKET',
    entityId: ticketId,
    action: {
      $in: [
        'TICKET_CREATED',
        'TICKET_STATUS_CHANGED',
        'TICKET_ASSIGNED',
        'TICKET_REOPENED',
        'TICKET_AUTO_CLOSED',
      ],
    },
  };
  const auditsPromise = AuditLog.find(auditFilter)
    .populate('actorId', 'firstName lastName avatarUrl role')
    .lean();

  // 3. Fetch Work Logs (Hidden from non-technical roles)
  let workLogsPromise = Promise.resolve([]);
  if (isTechnicalStaff) {
    workLogsPromise = WorkLog.find({ ticketId, organizationId })
      .populate('technicianId', 'firstName lastName avatarUrl role')
      .lean();
  }

  const [comments, audits, workLogs] = await Promise.all([
    commentsPromise,
    auditsPromise,
    workLogsPromise,
  ]);

  const feed = [];

  // Map Comments
  comments.forEach((c) => {
    feed.push({
      id: c._id,
      type: c.isInternal ? 'INTERNAL_NOTE' : 'COMMENT',
      timestamp: c.createdAt,
      actor: c.authorId
        ? {
            id: c.authorId._id,
            name: `${c.authorId.firstName} ${c.authorId.lastName}`,
            role: c.authorId.role,
            avatarUrl: c.authorId.avatarUrl,
          }
        : { name: 'System', role: 'SYSTEM' },
      data: {
        content: c.content,
        attachments: c.attachments || [],
        isInternal: c.isInternal,
      },
    });
  });

  // Map Audit Events
  audits.forEach((a) => {
    let summary = a.action;
    if (a.action === 'TICKET_STATUS_CHANGED') {
      summary = `Status changed to ${a.details?.newStatus || 'updated'}`;
    } else if (a.action === 'TICKET_ASSIGNED') {
      summary = 'Ticket assigned';
    } else if (a.action === 'TICKET_REOPENED') {
      summary = `Ticket reopened: ${a.details?.reopenReason || ''}`;
    } else if (a.action === 'TICKET_AUTO_CLOSED') {
      summary = 'Ticket auto-closed after 72 hours of resolution';
    } else if (a.action === 'TICKET_CREATED') {
      summary = 'Ticket created';
    }

    feed.push({
      id: a._id,
      type: 'SYSTEM_EVENT',
      timestamp: a.timestamp,
      actor: a.actorId
        ? {
            id: a.actorId._id,
            name: `${a.actorId.firstName} ${a.actorId.lastName}`,
            role: a.actorRole,
          }
        : { name: 'System Automation', role: 'SYSTEM' },
      data: {
        action: a.action,
        summary,
        details: a.details,
      },
    });
  });

  // Map Work Logs (Technicians and Admins only)
  workLogs.forEach((w) => {
    feed.push({
      id: w._id,
      type: 'WORK_LOG',
      timestamp: w.workDate || w.createdAt,
      actor: w.technicianId
        ? {
            id: w.technicianId._id,
            name: `${w.technicianId.firstName} ${w.technicianId.lastName}`,
            role: w.technicianId.role,
          }
        : { name: 'Technician', role: 'TECHNICIAN' },
      data: {
        timeSpentMinutes: w.timeSpentMinutes,
        description: w.description,
        workDate: w.workDate,
      },
    });
  });

  // Sort feed chronologically
  feed.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return feed;
};

module.exports = {
  verifyTicketAccess,
  addComment,
  getComments,
  getActivityFeed,
};
