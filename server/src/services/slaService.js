const SlaPolicy = require('../models/SlaPolicy');
const Organization = require('../models/Organization');
const Category = require('../models/Category');

/**
 * Default fallback targets in minutes if a policy lacks a specific tier
 */
const DEFAULT_TARGETS = {
  CRITICAL: { responseTimeMinutes: 15, resolutionTimeMinutes: 120 },
  HIGH: { responseTimeMinutes: 60, resolutionTimeMinutes: 480 },
  MEDIUM: { responseTimeMinutes: 240, resolutionTimeMinutes: 1440 },
  LOW: { responseTimeMinutes: 480, resolutionTimeMinutes: 2880 },
};

/**
 * Advances a start date forward by a number of minutes according to business hours.
 *
 * @param {Date} startDate - Initial start time
 * @param {number} minutesToAdd - Target minutes to add
 * @param {Object} businessHours - { start: '09:00', end: '18:00', workingDays: [1,2,3,4,5] }
 * @returns {Date} Calculated due date
 */
const addBusinessMinutes = (startDate, minutesToAdd, businessHours) => {
  if (!businessHours || !businessHours.start || !businessHours.end || !businessHours.workingDays) {
    return new Date(startDate.getTime() + minutesToAdd * 60000);
  }

  const [startHour, startMin] = businessHours.start.split(':').map(Number);
  const [endHour, endMin] = businessHours.end.split(':').map(Number);
  const workingDays = new Set(businessHours.workingDays);

  const workDayStartMins = startHour * 60 + startMin;
  const workDayEndMins = endHour * 60 + endMin;
  const dailyWorkMins = workDayEndMins - workDayStartMins;

  if (dailyWorkMins <= 0 || workingDays.size === 0) {
    return new Date(startDate.getTime() + minutesToAdd * 60000);
  }

  let current = new Date(startDate.getTime());
  let remainingMins = minutesToAdd;

  // Move current to valid working window if currently outside
  const snapToWorkHours = (date) => {
    while (true) {
      const day = date.getDay();
      const currentMins = date.getHours() * 60 + date.getMinutes();

      if (!workingDays.has(day)) {
        // Jump to next day at start hour
        date.setDate(date.getDate() + 1);
        date.setHours(startHour, startMin, 0, 0);
        continue;
      }

      if (currentMins < workDayStartMins) {
        date.setHours(startHour, startMin, 0, 0);
        break;
      }

      if (currentMins >= workDayEndMins) {
        date.setDate(date.getDate() + 1);
        date.setHours(startHour, startMin, 0, 0);
        continue;
      }

      break;
    }
  };

  snapToWorkHours(current);

  while (remainingMins > 0) {
    const currentMins = current.getHours() * 60 + current.getMinutes();
    const availableToday = workDayEndMins - currentMins;

    if (remainingMins <= availableToday) {
      current = new Date(current.getTime() + remainingMins * 60000);
      remainingMins = 0;
    } else {
      remainingMins -= availableToday;
      current.setDate(current.getDate() + 1);
      current.setHours(startHour, startMin, 0, 0);
      snapToWorkHours(current);
    }
  }

  return current;
};

/**
 * Resolves the applicable SLA policy for a ticket based on precedence:
 * 1. Category default policy
 * 2. Organization default policy
 * 3. Any policy flagged isDefault: true in the organization
 *
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string|import('mongoose').Types.ObjectId} [categoryId]
 * @returns {Promise<import('../models/SlaPolicy')|null>}
 */
const resolveSlaPolicy = async (organizationId, categoryId = null) => {
  // Precedence 1: Category SLA Policy
  if (categoryId) {
    const category = await Category.findOne({ _id: categoryId, organizationId, isActive: true });
    if (category && category.defaultSlaPolicyId) {
      const categoryPolicy = await SlaPolicy.findOne({
        _id: category.defaultSlaPolicyId,
        organizationId,
        isActive: true,
      });
      if (categoryPolicy) return categoryPolicy;
    }
  }

  // Precedence 2: Organization SLA Policy
  const organization = await Organization.findOne({ _id: organizationId, isActive: true });
  if (organization && organization.defaultSlaPolicyId) {
    const orgPolicy = await SlaPolicy.findOne({
      _id: organization.defaultSlaPolicyId,
      organizationId,
      isActive: true,
    });
    if (orgPolicy) return orgPolicy;
  }

  // Precedence 3: Organization isDefault: true policy
  const defaultPolicy = await SlaPolicy.findOne({
    organizationId,
    isDefault: true,
    isActive: true,
  });
  if (defaultPolicy) return defaultPolicy;

  // Precedence 4: Fallback to any active policy in the organization
  return SlaPolicy.findOne({ organizationId, isActive: true });
};

/**
 * Calculates response and resolution due dates given an SLA policy, priority, and organization.
 *
 * @param {Object} policy - SlaPolicy document or null
 * @param {string} priority - 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
 * @param {Object} organization - Organization document
 * @param {Date} [startTime=new Date()]
 * @returns {{ responseDue: Date, resolutionDue: Date, slaPolicyId: string|null }}
 */
const calculateDueDates = (policy, priority, organization, startTime = new Date()) => {
  const normPriority = (priority || 'MEDIUM').toUpperCase();

  let target = null;
  if (policy && Array.isArray(policy.targets)) {
    target = policy.targets.find((t) => t.priority === normPriority);
  }

  if (!target) {
    target = DEFAULT_TARGETS[normPriority] || DEFAULT_TARGETS.MEDIUM;
  }

  const businessHoursOnly = policy?.businessHoursOnly ?? true;
  const businessHours = businessHoursOnly ? organization?.businessHours : null;

  let responseDue;
  let resolutionDue;

  if (businessHoursOnly && businessHours) {
    responseDue = addBusinessMinutes(startTime, target.responseTimeMinutes, businessHours);
    resolutionDue = addBusinessMinutes(startTime, target.resolutionTimeMinutes, businessHours);
  } else {
    responseDue = new Date(startTime.getTime() + target.responseTimeMinutes * 60000);
    resolutionDue = new Date(startTime.getTime() + target.resolutionTimeMinutes * 60000);
  }

  return {
    responseDue,
    resolutionDue,
    slaPolicyId: policy ? policy._id : null,
  };
};

/**
 * Handles SLA pause/resume and breach checks during ticket status transitions.
 *
 * @param {Object} ticket - Mongoose Ticket document
 * @param {string} oldStatus - Previous ticket status
 * @param {string} newStatus - Next ticket status
 * @param {string|import('mongoose').Types.ObjectId} [actorId=null] - User who triggered transition
 */
const applySlaStatusTransition = (ticket, oldStatus, newStatus, actorId = null) => {
  const now = new Date();

  // 1. Moving to PENDING -> Pause SLA resolution timer
  if (newStatus === 'PENDING' && oldStatus !== 'PENDING') {
    ticket.slaPausedAt = now;
  }

  // 2. Moving out of PENDING -> Calculate elapsed paused time and extend resolutionDue
  if (oldStatus === 'PENDING' && newStatus !== 'PENDING') {
    if (ticket.slaPausedAt) {
      const pausedMs = now.getTime() - ticket.slaPausedAt.getTime();
      const pausedMins = Math.max(1, Math.round(pausedMs / 60000));
      ticket.totalSlaPausedMinutes = (ticket.totalSlaPausedMinutes || 0) + pausedMins;

      // Extend resolutionDue forward by the paused duration
      if (ticket.resolutionDue) {
        ticket.resolutionDue = new Date(ticket.resolutionDue.getTime() + pausedMs);
      }
      ticket.slaPausedAt = null;
    }
  }

  // 3. First response recording (when moving out of OPEN or when agent starts work)
  if (oldStatus === 'OPEN' && ['ASSIGNED', 'IN_PROGRESS'].includes(newStatus)) {
    if (!ticket.firstRespondedAt) {
      ticket.firstRespondedAt = now;
      if (ticket.responseDue && ticket.firstRespondedAt > ticket.responseDue) {
        ticket.isResponseBreached = true;
        ticket.escalationLevel = Math.max(ticket.escalationLevel || 0, 2);
      }
    }
  }

  // 4. Moving to RESOLVED
  if (newStatus === 'RESOLVED') {
    ticket.resolvedAt = now;
    if (actorId) ticket.resolvedBy = actorId;
    if (ticket.resolutionDue && ticket.resolvedAt > ticket.resolutionDue) {
      ticket.isResolutionBreached = true;
      ticket.escalationLevel = Math.max(ticket.escalationLevel || 0, 2);
    }
  }

  // 5. Moving to CLOSED
  if (newStatus === 'CLOSED') {
    ticket.closedAt = now;
  }

  // 6. Reopening from RESOLVED or CLOSED -> Clear resolvedAt
  if (['RESOLVED', 'CLOSED'].includes(oldStatus) && newStatus === 'IN_PROGRESS') {
    ticket.resolvedAt = null;
    ticket.resolvedBy = null;
    ticket.closedAt = null;
  }
};

module.exports = {
  resolveSlaPolicy,
  calculateDueDates,
  applySlaStatusTransition,
  addBusinessMinutes,
  DEFAULT_TARGETS,
};
