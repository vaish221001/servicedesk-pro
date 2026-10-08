const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const Department = require('../models/Department');
const User = require('../models/User');
const Asset = require('../models/Asset');
const Organization = require('../models/Organization');
const AppError = require('../utils/AppError');
const { resolveSlaPolicy, calculateDueDates, applySlaStatusTransition } = require('./slaService');
const { createAuditLog } = require('./auditService');
const { hasDepartmentAccess, getAllowedDepartmentIds } = require('../utils/departmentAccess');

/**
 * Standard Helpdesk Ticket Lifecycle Transitions
 */
const ALLOWED_TRANSITIONS = {
  OPEN: ['ASSIGNED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'PENDING', 'OPEN'],
  IN_PROGRESS: ['PENDING', 'RESOLVED'],
  PENDING: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
};

/**
 * Generates an organization-scoped, unique ticket number safely (e.g. SDP-2026-0001).
 *
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @returns {Promise<string>}
 */
const generateTicketNumber = async (organizationId) => {
  const year = new Date().getFullYear();
  const prefix = `SDP-${year}-`;

  // Find the ticket with the highest sequence number in the current year for this organization
  const latestTicket = await Ticket.findOne({
    organizationId,
    ticketNumber: new RegExp(`^${prefix}\\d+$`),
  })
    .sort({ ticketNumber: -1 })
    .collation({ locale: 'en_US', numericOrdering: true })
    .select('ticketNumber');

  let nextSeq = 1;
  if (latestTicket && latestTicket.ticketNumber) {
    const parts = latestTicket.ticketNumber.split('-');
    const lastNum = parseInt(parts[2], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * Creates a new ticket with full validation and SLA assignment.
 */
const createTicket = async (organizationId, ticketData, actor, req = null) => {
  const {
    title,
    description,
    departmentId,
    categoryId,
    subcategoryId = null,
    priority,
    relatedAssetId = null,
    channel = 'PORTAL',
    assignedTo = null,
    tags = [],
  } = ticketData;

  // 1. Validate mandatory basic fields
  if (!title || !title.trim()) {
    throw new AppError('Ticket title is required', 400);
  }
  if (!description || !description.trim()) {
    throw new AppError('Ticket description is required', 400);
  }
  if (!departmentId) {
    throw new AppError('Department ID is required', 400);
  }
  if (!categoryId) {
    throw new AppError('Category ID is required', 400);
  }

  // 2. Validate Department within organization
  const department = await Department.findOne({ _id: departmentId, organizationId, isActive: true });
  if (!department) {
    throw new AppError('Invalid department or department belongs to another organization', 400);
  }

  // 3. Validate Category & Subcategory consistency
  const category = await Category.findOne({ _id: categoryId, organizationId, isActive: true });
  if (!category) {
    throw new AppError('Invalid category or category belongs to another organization', 400);
  }
  if (category.departmentId.toString() !== departmentId.toString()) {
    throw new AppError('Category does not belong to the selected department', 400);
  }

  if (subcategoryId) {
    const subcategory = await Category.findOne({ _id: subcategoryId, organizationId, isActive: true });
    if (!subcategory) {
      throw new AppError('Invalid subcategory or subcategory belongs to another organization', 400);
    }
    if (!subcategory.parentId || subcategory.parentId.toString() !== categoryId.toString()) {
      throw new AppError('Subcategory must have parentId matching categoryId', 400);
    }
  }

  // 4. Resolve Requester ID (Employees can only create tickets for themselves)
  let requesterId = actor._id;
  if (ticketData.requesterId && ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(actor.role)) {
    const requestedUser = await User.findOne({ _id: ticketData.requesterId, organizationId, isActive: true });
    if (!requestedUser) {
      throw new AppError('Requester user not found in this organization or is inactive', 400);
    }
    requesterId = requestedUser._id;
  }

  // 5. Validate Related Asset (if specified)
  if (relatedAssetId) {
    const asset = await Asset.findOne({ _id: relatedAssetId, organizationId });
    if (!asset) {
      throw new AppError('Related asset not found or belongs to another organization', 400);
    }
    if (actor.role === 'EMPLOYEE') {
      const isAssigned = asset.currentAssigneeId && asset.currentAssigneeId.toString() === actor._id.toString();
      const inSameDept = actor.departmentId && asset.departmentId && asset.departmentId.toString() === actor.departmentId.toString();
      if (!isAssigned && !inSameDept) {
        throw new AppError('You are not authorized to link this asset to the ticket', 403);
      }
    }
  }

  // 6. Resolve Initial Priority
  const effectivePriority = priority || category.defaultPriority || 'MEDIUM';
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(effectivePriority)) {
    throw new AppError('Invalid ticket priority tier', 400);
  }

  // 7. Resolve Initial Assignment
  let initialAssignedTo = null;
  let initialAssignedAt = null;
  let initialStatus = 'OPEN';

  const targetAssigneeId = assignedTo || category.defaultAssigneeId;
  if (targetAssigneeId) {
    const assignee = await User.findOne({ _id: targetAssigneeId, organizationId, isActive: true });
    if (assignee && ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(assignee.role)) {
      initialAssignedTo = assignee._id;
      initialAssignedAt = new Date();
      initialStatus = 'ASSIGNED';
    }
  }

  // 8. SLA Policy Calculation
  const organization = await Organization.findById(organizationId);
  const slaPolicy = await resolveSlaPolicy(organizationId, categoryId);
  const { responseDue, resolutionDue, slaPolicyId } = calculateDueDates(
    slaPolicy,
    effectivePriority,
    organization
  );

  // 9. Concurrency-Safe Ticket Creation (with duplicate key retry)
  let createdTicket = null;
  let attempts = 0;
  const maxAttempts = 5;

  while (!createdTicket && attempts < maxAttempts) {
    attempts++;
    const ticketNumber = await generateTicketNumber(organizationId);

    try {
      createdTicket = await Ticket.create({
        organizationId,
        ticketNumber,
        title: title.trim(),
        description: description.trim(),
        requesterId,
        departmentId,
        categoryId,
        subcategoryId,
        priority: effectivePriority,
        status: initialStatus,
        assignedTo: initialAssignedTo,
        assignedAt: initialAssignedAt,
        relatedAssetId,
        channel,
        slaPolicyId,
        responseDue,
        resolutionDue,
        tags: Array.isArray(tags) ? tags : [],
      });
    } catch (err) {
      // If code 11000 (duplicate ticketNumber collision), retry with next sequence
      if (err.code === 11000 && attempts < maxAttempts) {
        continue;
      }
      throw err;
    }
  }

  if (!createdTicket) {
    throw new AppError('Failed to generate a unique ticket number. Please try again.', 500);
  }

  // 10. Audit Log
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'TICKET_CREATED',
    entityType: 'TICKET',
    entityId: createdTicket._id,
    details: {
      ticketNumber: createdTicket.ticketNumber,
      title: createdTicket.title,
      priority: createdTicket.priority,
      status: createdTicket.status,
      assignedTo: initialAssignedTo,
    },
    req,
  });

  return createdTicket;
};

/**
 * Lists tickets with organization boundaries, role access control, filtering, and pagination.
 */
const getTickets = async (organizationId, user, query = {}) => {
  const filter = { organizationId };

  // 1. Role-Based Scoping
  if (user.role === 'EMPLOYEE') {
    // Employees can only ever access tickets they submitted
    filter.requesterId = user._id;
  } else if (user.role === 'TECHNICIAN') {
    // Technicians can access tickets in their authorized departments OR assigned to them
    const allowedDeptIds = getAllowedDepartmentIds(user);
    if (allowedDeptIds && allowedDeptIds.length > 0) {
      filter.$or = [
        { departmentId: { $in: allowedDeptIds } },
        { assignedTo: user._id },
      ];
    } else {
      filter.assignedTo = user._id;
    }
  } else if (user.role === 'ASSET_MANAGER') {
    // Asset Managers can access tickets requested by them, tickets in their department, or tickets with linked assets
    const allowedDeptIds = getAllowedDepartmentIds(user);
    const orConditions = [
      { requesterId: user._id },
      { relatedAssetId: { $ne: null } },
    ];
    if (allowedDeptIds && allowedDeptIds.length > 0) {
      orConditions.push({ departmentId: { $in: allowedDeptIds } });
    }
    filter.$or = orConditions;
  }
  // IT_MANAGER and SYSTEM_ADMIN have full view of their organization's tickets

  // 2. Query Filters
  if (query.status) {
    if (Array.isArray(query.status)) {
      filter.status = { $in: query.status };
    } else {
      filter.status = query.status;
    }
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.departmentId) {
    filter.departmentId = query.departmentId;
  }

  if (query.categoryId) {
    filter.categoryId = query.categoryId;
  }

  if (query.assignedTo) {
    filter.assignedTo = query.assignedTo;
  }

  if (query.requesterId && user.role !== 'EMPLOYEE') {
    filter.requesterId = query.requesterId;
  }

  if (query.isResponseBreached !== undefined) {
    filter.isResponseBreached = query.isResponseBreached === 'true' || query.isResponseBreached === true;
  }

  if (query.isResolutionBreached !== undefined) {
    filter.isResolutionBreached = query.isResolutionBreached === 'true' || query.isResolutionBreached === true;
  }

  if (query.escalationLevel !== undefined) {
    filter.escalationLevel = Number(query.escalationLevel);
  }

  // 3. Search Filter (title, description, or ticketNumber)
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    const searchCondition = [
      { ticketNumber: searchRegex },
      { title: searchRegex },
      { description: searchRegex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchCondition }];
      delete filter.$or;
    } else {
      filter.$or = searchCondition;
    }
  }

  // 4. Pagination
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  // 5. Sorting
  const sort = query.sort || '-createdAt';

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate('requesterId', 'firstName lastName email role departmentId')
      .populate('assignedTo', 'firstName lastName email role departmentId')
      .populate('departmentId', 'name code')
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .populate('relatedAssetId', 'assetTag name type status')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Ticket.countDocuments(filter),
  ]);

  return {
    tickets,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves a single ticket by ID with full role-based access verification.
 */
const getTicketById = async (organizationId, ticketId, user) => {
  const ticket = await Ticket.findOne({ _id: ticketId, organizationId })
    .populate('requesterId', 'firstName lastName email role departmentId')
    .populate('assignedTo', 'firstName lastName email role departmentId')
    .populate('departmentId', 'name code')
    .populate('categoryId', 'name')
    .populate('subcategoryId', 'name')
    .populate('relatedAssetId', 'assetTag name type manufacturer model status')
    .populate('slaPolicyId', 'name targets')
    .populate('resolvedBy', 'firstName lastName email')
    .populate('lastReopenedBy', 'firstName lastName email');

  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  // Role Access Verification
  if (user.role === 'EMPLOYEE') {
    const requesterId = ticket.requesterId._id || ticket.requesterId;
    if (requesterId.toString() !== user._id.toString()) {
      throw new AppError('You do not have permission to view this ticket', 403);
    }
  } else if (user.role === 'TECHNICIAN') {
    const deptId = ticket.departmentId._id || ticket.departmentId;
    const isAssigned =
      ticket.assignedTo && (ticket.assignedTo._id || ticket.assignedTo).toString() === user._id.toString();
    const hasDeptAccess = hasDepartmentAccess(user, deptId, organizationId);

    if (!isAssigned && !hasDeptAccess) {
      throw new AppError('You do not have permission to view tickets in this department', 403);
    }
  } else if (user.role === 'ASSET_MANAGER') {
    const requesterId = ticket.requesterId._id || ticket.requesterId;
    const isRequester = requesterId.toString() === user._id.toString();
    const deptId = ticket.departmentId._id || ticket.departmentId;
    const hasDeptAccess = hasDepartmentAccess(user, deptId, organizationId);
    const hasLinkedAsset = !!ticket.relatedAssetId;

    if (!isRequester && !hasDeptAccess && !hasLinkedAsset) {
      throw new AppError('You do not have permission to view this ticket', 403);
    }
  }

  return ticket;
};

/**
 * Updates permitted ticket fields with validation and audit logging.
 */
const updateTicket = async (organizationId, ticketId, updateData, user, req = null) => {
  const ticket = await Ticket.findOne({ _id: ticketId, organizationId });
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  // Access Control check
  if (user.role === 'EMPLOYEE' || user.role === 'ASSET_MANAGER') {
    if (ticket.requesterId.toString() !== user._id.toString()) {
      throw new AppError('You do not have permission to update this ticket', 403);
    }
    if (ticket.status !== 'OPEN') {
      throw new AppError('Tickets cannot be modified once processing has begun', 403);
    }
  } else if (user.role === 'TECHNICIAN') {
    const hasDeptAccess = hasDepartmentAccess(user, ticket.departmentId, organizationId);
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === user._id.toString();
    if (!hasDeptAccess && !isAssigned) {
      throw new AppError('You do not have permission to update tickets in this department', 403);
    }
  }

  const previousSnapshot = {
    title: ticket.title,
    priority: ticket.priority,
    categoryId: ticket.categoryId,
    subcategoryId: ticket.subcategoryId,
  };

  // Title / Description
  if (updateData.title !== undefined) {
    if (!updateData.title.trim()) throw new AppError('Title cannot be empty', 400);
    ticket.title = updateData.title.trim();
  }
  if (updateData.description !== undefined) {
    if (!updateData.description.trim()) throw new AppError('Description cannot be empty', 400);
    ticket.description = updateData.description.trim();
  }

  // Priority Update (Technicians, Managers, Admins)
  if (updateData.priority && user.role !== 'EMPLOYEE') {
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(updateData.priority)) {
      throw new AppError('Invalid priority tier', 400);
    }
    if (ticket.priority !== updateData.priority) {
      ticket.priority = updateData.priority;

      // Recalculate SLA due dates if not yet resolved
      if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
        const organization = await Organization.findById(organizationId);
        const policy = ticket.slaPolicyId ? await SlaPolicy.findById(ticket.slaPolicyId) : null;
        const dueDates = calculateDueDates(policy, ticket.priority, organization, ticket.createdAt);
        ticket.responseDue = dueDates.responseDue;
        ticket.resolutionDue = dueDates.resolutionDue;
      }
    }
  }

  // Category Updates (Non-Employees)
  if (updateData.categoryId && user.role !== 'EMPLOYEE') {
    const category = await Category.findOne({
      _id: updateData.categoryId,
      organizationId,
      departmentId: ticket.departmentId,
      isActive: true,
    });
    if (!category) {
      throw new AppError('Invalid category or category does not match ticket department', 400);
    }
    ticket.categoryId = updateData.categoryId;
  }

  if (updateData.subcategoryId !== undefined && user.role !== 'EMPLOYEE') {
    if (updateData.subcategoryId) {
      const subcategory = await Category.findOne({
        _id: updateData.subcategoryId,
        organizationId,
        isActive: true,
      });
      if (!subcategory || !subcategory.parentId || subcategory.parentId.toString() !== ticket.categoryId.toString()) {
        throw new AppError('Subcategory must match the ticket category', 400);
      }
      ticket.subcategoryId = updateData.subcategoryId;
    } else {
      ticket.subcategoryId = null;
    }
  }

  // Tags
  if (Array.isArray(updateData.tags) && user.role !== 'EMPLOYEE') {
    ticket.tags = updateData.tags;
  }

  // Related Asset
  if (updateData.relatedAssetId !== undefined) {
    if (updateData.relatedAssetId) {
      const asset = await Asset.findOne({ _id: updateData.relatedAssetId, organizationId });
      if (!asset) throw new AppError('Related asset not found in this organization', 400);
      if (user.role === 'EMPLOYEE') {
        const isAssigned = asset.currentAssigneeId && asset.currentAssigneeId.toString() === user._id.toString();
        const inSameDept = user.departmentId && asset.departmentId && asset.departmentId.toString() === user.departmentId.toString();
        if (!isAssigned && !inSameDept) {
          throw new AppError('You are not authorized to link this asset to the ticket', 403);
        }
      }
      ticket.relatedAssetId = updateData.relatedAssetId;
    } else {
      ticket.relatedAssetId = null;
    }
  }

  await ticket.save();

  // Audit Log
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: user._id,
    actorRole: user.role,
    action: 'TICKET_UPDATED',
    entityType: 'TICKET',
    entityId: ticket._id,
    details: { previous: previousSnapshot, updated: { title: ticket.title, priority: ticket.priority } },
    req,
  });

  return ticket;
};

/**
 * Assigns or reassigns a ticket to a technician.
 */
const assignTicket = async (organizationId, ticketId, assigneeId, user, req = null) => {
  if (user.role === 'EMPLOYEE') {
    throw new AppError('Employees cannot assign or reassign tickets', 403);
  }

  const ticket = await Ticket.findOne({ _id: ticketId, organizationId });
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  // Check department access of the user performing the assignment
  if (user.role === 'TECHNICIAN') {
    const hasDeptAccess = hasDepartmentAccess(user, ticket.departmentId, organizationId);
    if (!hasDeptAccess) {
      throw new AppError('You do not have permission to assign tickets in this department', 403);
    }
  }

  // Validate Assignee
  let assignee = null;
  if (assigneeId) {
    assignee = await User.findOne({ _id: assigneeId, organizationId, isActive: true });
    if (!assignee) {
      throw new AppError('Assignee user not found in this organization or is inactive', 400);
    }
    if (!['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(assignee.role)) {
      throw new AppError('Assignee must have a technical support role', 400);
    }

    // Verify assignee has department access
    const assigneeHasAccess = hasDepartmentAccess(assignee, ticket.departmentId, organizationId);
    if (!assigneeHasAccess) {
      throw new AppError('The selected technician is not assigned to service this department', 400);
    }
  }

  const previousAssignee = ticket.assignedTo;
  ticket.assignedTo = assignee ? assignee._id : null;
  ticket.assignedAt = assignee ? new Date() : null;

  // If status is OPEN and assigned, advance to ASSIGNED
  if (ticket.status === 'OPEN' && assignee) {
    applySlaStatusTransition(ticket, 'OPEN', 'ASSIGNED', user._id);
    ticket.status = 'ASSIGNED';
  } else if (!assignee && ticket.status === 'ASSIGNED') {
    // If unassigned from ASSIGNED status, return to OPEN
    ticket.status = 'OPEN';
  }

  await ticket.save();

  // Audit Log
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: user._id,
    actorRole: user.role,
    action: 'TICKET_ASSIGNED',
    entityType: 'TICKET',
    entityId: ticket._id,
    details: {
      previousAssignee,
      assignedTo: ticket.assignedTo,
      assignedByName: `${user.firstName} ${user.lastName}`,
    },
    req,
  });

  return ticket;
};

/**
 * Transitions ticket status adhering strictly to the lifecycle model and reopening rules.
 */
const changeTicketStatus = async (organizationId, ticketId, statusData, user, req = null) => {
  const { status: newStatus, resolutionNotes, rootCause, reopenReason } = statusData;

  if (!newStatus) {
    throw new AppError('Target status is required', 400);
  }

  const ticket = await Ticket.findOne({ _id: ticketId, organizationId });
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  const oldStatus = ticket.status;

  // No-op if status already matches
  if (oldStatus === newStatus) {
    return ticket;
  }

  // 1. Role Authorization Check
  if (user.role === 'EMPLOYEE' || user.role === 'ASSET_MANAGER') {
    // Non-technical roles can ONLY cancel (OPEN -> CLOSED) or reopen (RESOLVED/CLOSED -> IN_PROGRESS)
    const isCancel = oldStatus === 'OPEN' && newStatus === 'CLOSED';
    const isReopen = ['RESOLVED', 'CLOSED'].includes(oldStatus) && newStatus === 'IN_PROGRESS';

    if (!isCancel && !isReopen) {
      throw new AppError('Non-technical roles are only permitted to cancel an open ticket or reopen a resolved ticket', 403);
    }

    if (ticket.requesterId.toString() !== user._id.toString()) {
      throw new AppError('You can only change status for your own tickets', 403);
    }
  } else if (user.role === 'TECHNICIAN') {
    const hasDeptAccess = hasDepartmentAccess(user, ticket.departmentId, organizationId);
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === user._id.toString();
    if (!hasDeptAccess && !isAssigned) {
      throw new AppError('You do not have permission to manage tickets in this department', 403);
    }
  }

  // 2. Lifecycle Transition Validation
  const validNextStates = ALLOWED_TRANSITIONS[oldStatus] || [];
  if (!validNextStates.includes(newStatus)) {
    throw new AppError(
      `Invalid status transition from ${oldStatus} to ${newStatus}. Allowed transitions: ${validNextStates.join(', ')}`,
      400
    );
  }

  // 3. Handling RESOLVED transition
  if (newStatus === 'RESOLVED') {
    if (!resolutionNotes || !resolutionNotes.trim()) {
      throw new AppError('Resolution notes are mandatory when marking a ticket as RESOLVED', 400);
    }
    ticket.resolutionNotes = resolutionNotes.trim();
    if (rootCause) ticket.rootCause = rootCause.trim();
  }

  // 4. Handling Reopening transition (RESOLVED/CLOSED -> IN_PROGRESS)
  if (['RESOLVED', 'CLOSED'].includes(oldStatus) && newStatus === 'IN_PROGRESS') {
    if (!reopenReason || !reopenReason.trim()) {
      throw new AppError('A valid reopenReason is mandatory to reopen a resolved or closed ticket', 400);
    }

    // 72-Hour Window Rule for Employees
    if (user.role === 'EMPLOYEE') {
      const resolvedAt = ticket.resolvedAt || ticket.updatedAt;
      const hoursSinceResolved = (Date.now() - new Date(resolvedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceResolved > 72) {
        throw new AppError(
          'Tickets can only be reopened by the requester within 72 hours of resolution. Please submit a new ticket.',
          400
        );
      }
    }

    ticket.reopenedCount = (ticket.reopenedCount || 0) + 1;
    ticket.lastReopenedAt = new Date();
    ticket.lastReopenedBy = user._id;
    ticket.reopenReason = reopenReason.trim();

    // Log separate TICKET_REOPENED audit event
    await createAuditLog({
      organizationId,
      actorType: 'HUMAN',
      actorId: user._id,
      actorRole: user.role,
      action: 'TICKET_REOPENED',
      entityType: 'TICKET',
      entityId: ticket._id,
      details: {
        reopenedCount: ticket.reopenedCount,
        reopenReason: ticket.reopenReason,
        previousStatus: oldStatus,
      },
      req,
    });
  }

  // 5. Apply SLA State Machine (pause, resume, first response, breach checks)
  applySlaStatusTransition(ticket, oldStatus, newStatus, user._id);

  ticket.status = newStatus;
  await ticket.save();

  // 6. Audit Logging
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: user._id,
    actorRole: user.role,
    action: 'TICKET_STATUS_CHANGED',
    entityType: 'TICKET',
    entityId: ticket._id,
    details: {
      oldStatus,
      newStatus,
      resolutionNotes: ticket.resolutionNotes,
      totalSlaPausedMinutes: ticket.totalSlaPausedMinutes,
    },
    req,
  });

  return ticket;
};

/**
 * Links an authorized asset to a ticket with organization isolation and authorization checks.
 */
const linkAssetToTicket = async (organizationId, ticketId, assetId, user, req = null) => {
  const ticket = await Ticket.findOne({ _id: ticketId, organizationId });
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  // Access check
  if (user.role === 'EMPLOYEE') {
    if (ticket.requesterId.toString() !== user._id.toString()) {
      throw new AppError('You do not have permission to link assets to this ticket', 403);
    }
  } else if (user.role === 'TECHNICIAN') {
    const hasDeptAccess = hasDepartmentAccess(user, ticket.departmentId, organizationId);
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === user._id.toString();
    if (!hasDeptAccess && !isAssigned) {
      throw new AppError('You do not have permission to modify tickets in this department', 403);
    }
  }

  let asset = null;
  if (assetId) {
    asset = await Asset.findOne({ _id: assetId, organizationId });
    if (!asset) {
      throw new AppError('Asset not found or belongs to another organization', 400);
    }

    if (user.role === 'EMPLOYEE') {
      const isAssigned = asset.currentAssigneeId && asset.currentAssigneeId.toString() === user._id.toString();
      const inSameDept = user.departmentId && asset.departmentId && asset.departmentId.toString() === user.departmentId.toString();
      if (!isAssigned && !inSameDept) {
        throw new AppError('You are not authorized to link this asset to the ticket', 403);
      }
    }
  }

  const previousAssetId = ticket.relatedAssetId;
  ticket.relatedAssetId = asset ? asset._id : null;
  await ticket.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: user._id,
    actorRole: user.role,
    action: 'TICKET_ASSET_LINKED',
    entityType: 'TICKET',
    entityId: ticket._id,
    details: { previousAssetId, relatedAssetId: ticket.relatedAssetId },
    req,
  });

  return ticket;
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignTicket,
  changeTicketStatus,
  linkAssetToTicket,
  generateTicketNumber,
  ALLOWED_TRANSITIONS,
};
