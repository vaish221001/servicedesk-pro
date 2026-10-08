const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Creates an in-app notification document.
 *
 * @param {Object} params
 * @param {string|import('mongoose').Types.ObjectId} params.organizationId
 * @param {string|import('mongoose').Types.ObjectId} params.recipientId
 * @param {string|import('mongoose').Types.ObjectId} [params.senderId=null]
 * @param {string} params.type - 'TICKET_CREATED'|'TICKET_ASSIGNED'|'TICKET_COMMENT'|'TICKET_STATUS_CHANGED'|'SLA_BREACH_WARNING'|'ASSET_ASSIGNED'|'SYSTEM_ALERT'
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.link=null]
 * @param {string|import('mongoose').Types.ObjectId} [params.relatedTicketId=null]
 * @param {string|import('mongoose').Types.ObjectId} [params.relatedAssetId=null]
 * @returns {Promise<import('../models/Notification')>}
 */
const createNotification = async ({
  organizationId,
  recipientId,
  senderId = null,
  type,
  title,
  message,
  link = null,
  relatedTicketId = null,
  relatedAssetId = null,
}) => {
  try {
    if (!recipientId || !organizationId) return null;

    // Do not notify a user about their own immediate action
    if (senderId && recipientId.toString() === senderId.toString()) {
      return null;
    }

    const notification = await Notification.create({
      organizationId,
      recipientId,
      senderId,
      type,
      title: title.trim(),
      message: message.trim(),
      link,
      relatedTicketId,
      relatedAssetId,
      isRead: false,
    });

    return notification;
  } catch (error) {
    console.error('Notification Creation Warning:', error.message);
    return null;
  }
};

/**
 * Notification handler for ticket creation.
 */
const notifyTicketCreated = async (ticket, actor) => {
  try {
    // Notify department technicians/managers about new ticket in their queue
    const agents = await User.find({
      organizationId: ticket.organizationId,
      role: { $in: ['TECHNICIAN', 'IT_MANAGER'] },
      $or: [
        { departmentId: ticket.departmentId },
        { assignedDepartments: ticket.departmentId },
      ],
      isActive: true,
    }).select('_id');

    const promises = agents.map((agent) =>
      createNotification({
        organizationId: ticket.organizationId,
        recipientId: agent._id,
        senderId: actor?._id || null,
        type: 'TICKET_CREATED',
        title: `New Ticket: ${ticket.ticketNumber}`,
        message: `${ticket.title} (Priority: ${ticket.priority})`,
        link: `/tickets/${ticket._id}`,
        relatedTicketId: ticket._id,
      })
    );

    await Promise.all(promises);
  } catch (err) {
    console.error('notifyTicketCreated Warning:', err.message);
  }
};

/**
 * Notification handler for ticket assignment.
 */
const notifyTicketAssigned = async (ticket, assigneeId, actor) => {
  if (!assigneeId) return;
  await createNotification({
    organizationId: ticket.organizationId,
    recipientId: assigneeId,
    senderId: actor?._id || null,
    type: 'TICKET_ASSIGNED',
    title: `Ticket Assigned: ${ticket.ticketNumber}`,
    message: `You have been assigned to ticket "${ticket.title}".`,
    link: `/tickets/${ticket._id}`,
    relatedTicketId: ticket._id,
  });
};

/**
 * Notification handler for new comments and internal notes.
 * Strictly respects internal-note privacy: NEVER notifies employee/requester on internal notes.
 */
const notifyTicketComment = async (ticket, comment, actor) => {
  try {
    const requesterId = ticket.requesterId?._id || ticket.requesterId;
    const assignedToId = ticket.assignedTo?._id || ticket.assignedTo;

    // 1. If this is an INTERNAL NOTE: DO NOT notify the requester
    if (comment.isInternal) {
      // Notify assigned technician if someone else posted the note
      if (assignedToId && assignedToId.toString() !== actor._id.toString()) {
        await createNotification({
          organizationId: ticket.organizationId,
          recipientId: assignedToId,
          senderId: actor._id,
          type: 'TICKET_COMMENT',
          title: `Internal Note on ${ticket.ticketNumber}`,
          message: `${actor.firstName} ${actor.lastName} added an internal note to ticket ${ticket.ticketNumber}.`,
          link: `/tickets/${ticket._id}`,
          relatedTicketId: ticket._id,
        });
      }
      return;
    }

    // 2. If PUBLIC reply:
    // If the actor is NOT the requester, notify requester
    if (requesterId && requesterId.toString() !== actor._id.toString()) {
      await createNotification({
        organizationId: ticket.organizationId,
        recipientId: requesterId,
        senderId: actor._id,
        type: 'TICKET_COMMENT',
        title: `New Reply on ${ticket.ticketNumber}`,
        message: `${actor.firstName} replied: "${comment.content.slice(0, 100)}${
          comment.content.length > 100 ? '...' : ''
        }"`,
        link: `/tickets/${ticket._id}`,
        relatedTicketId: ticket._id,
      });
    }

    // If actor is the requester, notify the assigned technician
    if (assignedToId && assignedToId.toString() !== actor._id.toString()) {
      await createNotification({
        organizationId: ticket.organizationId,
        recipientId: assignedToId,
        senderId: actor._id,
        type: 'TICKET_COMMENT',
        title: `Requester Reply on ${ticket.ticketNumber}`,
        message: `${actor.firstName} replied on ticket ${ticket.ticketNumber}.`,
        link: `/tickets/${ticket._id}`,
        relatedTicketId: ticket._id,
      });
    }
  } catch (err) {
    console.error('notifyTicketComment Warning:', err.message);
  }
};

/**
 * Notification handler for ticket status changes.
 */
const notifyTicketStatusChanged = async (ticket, oldStatus, newStatus, actor) => {
  try {
    const requesterId = ticket.requesterId?._id || ticket.requesterId;
    const assignedToId = ticket.assignedTo?._id || ticket.assignedTo;

    // Notify requester
    if (requesterId && (!actor || requesterId.toString() !== actor._id?.toString())) {
      await createNotification({
        organizationId: ticket.organizationId,
        recipientId: requesterId,
        senderId: actor?._id || null,
        type: 'TICKET_STATUS_CHANGED',
        title: `Ticket ${ticket.ticketNumber} is now ${newStatus}`,
        message: `Status updated from ${oldStatus} to ${newStatus}.`,
        link: `/tickets/${ticket._id}`,
        relatedTicketId: ticket._id,
      });
    }

    // Notify assigned technician
    if (assignedToId && (!actor || assignedToId.toString() !== actor._id?.toString())) {
      await createNotification({
        organizationId: ticket.organizationId,
        recipientId: assignedToId,
        senderId: actor?._id || null,
        type: 'TICKET_STATUS_CHANGED',
        title: `Ticket ${ticket.ticketNumber} Status Changed`,
        message: `Status changed to ${newStatus}.`,
        link: `/tickets/${ticket._id}`,
        relatedTicketId: ticket._id,
      });
    }
  } catch (err) {
    console.error('notifyTicketStatusChanged Warning:', err.message);
  }
};

/**
 * Notification handler for SLA breach warnings.
 */
const notifySlaWarning = async (ticket, stage, title, message) => {
  try {
    const recipients = new Set();
    if (ticket.assignedTo) {
      recipients.add(ticket.assignedTo.toString());
    }

    // Notify department IT managers
    const managers = await User.find({
      organizationId: ticket.organizationId,
      role: { $in: ['IT_MANAGER', 'SYSTEM_ADMIN'] },
      $or: [
        { departmentId: ticket.departmentId },
        { assignedDepartments: ticket.departmentId },
      ],
      isActive: true,
    }).select('_id');

    managers.forEach((m) => recipients.add(m._id.toString()));

    const promises = Array.from(recipients).map((recipientId) =>
      createNotification({
        organizationId: ticket.organizationId,
        recipientId,
        senderId: null, // System event
        type: 'SLA_BREACH_WARNING',
        title,
        message,
        link: `/tickets/${ticket._id}`,
        relatedTicketId: ticket._id,
      })
    );

    await Promise.all(promises);
  } catch (err) {
    console.error('notifySlaWarning Warning:', err.message);
  }
};

/**
 * Lists user notifications with pagination and read filtering.
 */
const getUserNotifications = async (organizationId, userId, query = {}) => {
  const filter = {
    organizationId,
    recipientId: userId,
  };

  if (query.isRead !== undefined) {
    filter.isRead = query.isRead === 'true' || query.isRead === true;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate('senderId', 'firstName lastName avatarUrl role')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ organizationId, recipientId: userId, isRead: false }),
  ]);

  return {
    notifications,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      unreadCount,
    },
  };
};

/**
 * Marks a single notification as read.
 */
const markAsRead = async (organizationId, notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: userId, organizationId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  return notification;
};

/**
 * Marks all notifications for a user as read.
 */
const markAllAsRead = async (organizationId, userId) => {
  const result = await Notification.updateMany(
    { organizationId, recipientId: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return { modifiedCount: result.modifiedCount };
};

/**
 * Returns unread count for badge display.
 */
const getUnreadCount = async (organizationId, userId) => {
  const count = await Notification.countDocuments({
    organizationId,
    recipientId: userId,
    isRead: false,
  });

  return { unreadCount: count };
};

module.exports = {
  createNotification,
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyTicketComment,
  notifyTicketStatusChanged,
  notifySlaWarning,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
