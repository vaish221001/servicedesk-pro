const AuditLog = require('../models/AuditLog');

/**
 * Service to create structured audit log entries.
 * Ensures multi-tenant isolation, safe payload sanitization, and support
 * for both human actors and automated system tasks.
 *
 * @param {Object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId - Tenant organization ID
 * @param {string} [params.actorType='HUMAN'] - 'HUMAN' or 'SYSTEM'
 * @param {import('mongoose').Types.ObjectId|string} [params.actorId=null] - User ID who performed action
 * @param {string} [params.actorRole='SYSTEM'] - Role snapshot at time of event
 * @param {string} params.action - Action identifier (e.g., TICKET_CREATED, TICKET_STATUS_CHANGED)
 * @param {string} params.entityType - 'USER'|'TICKET'|'ASSET'|'SLA_POLICY'|'DEPARTMENT'|'CATEGORY'|'VENDOR'|'KB_ARTICLE'
 * @param {import('mongoose').Types.ObjectId|string} params.entityId - ID of entity affected
 * @param {Object} [params.details=null] - Diff or summary details
 * @param {import('express').Request} [params.req=null] - Optional express request for IP and User-Agent
 * @returns {Promise<import('../models/AuditLog')>}
 */
const createAuditLog = async ({
  organizationId,
  actorType = 'HUMAN',
  actorId = null,
  actorRole = 'SYSTEM',
  action,
  entityType,
  entityId,
  details = null,
  req = null,
}) => {
  try {
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
      userAgent = req.headers['user-agent'] || null;
    }

    // Sanitize details: strip password or token references if present
    let sanitizedDetails = details;
    if (details && typeof details === 'object') {
      sanitizedDetails = JSON.parse(JSON.stringify(details));
      if (sanitizedDetails.password) delete sanitizedDetails.password;
      if (sanitizedDetails.token) delete sanitizedDetails.token;
      if (sanitizedDetails.secret) delete sanitizedDetails.secret;
    }

    const logEntry = await AuditLog.create({
      organizationId,
      actorType,
      actorId,
      actorRole,
      action,
      entityType,
      entityId,
      ipAddress,
      userAgent,
      details: sanitizedDetails,
      timestamp: new Date(),
    });

    return logEntry;
  } catch (error) {
    // Non-blocking error handling: audit log failures should not fail the primary business transaction,
    // but should be logged to stderr
    console.error('AuditLog Creation Warning:', error.message);
    return null;
  }
};

module.exports = {
  createAuditLog,
};
