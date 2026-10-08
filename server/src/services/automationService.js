const Ticket = require('../models/Ticket');
const { applySlaStatusTransition } = require('./slaService');
const { createAuditLog } = require('./auditService');
const { notifyTicketStatusChanged, notifySlaWarning } = require('./notificationService');

let autoCloseIntervalId = null;
let slaMonitorIntervalId = null;
let isAutoCloseRunning = false;
let isSlaMonitoringRunning = false;

/**
 * 72-Hour Auto-Close Job
 *
 * Scans for tickets in RESOLVED status that have passed the 72-hour inactivity
 * window without reopen requests, and marks them as CLOSED.
 *
 * @returns {Promise<{ closedCount: number }>}
 */
const runAutoCloseJob = async () => {
  if (isAutoCloseRunning) {
    return { closedCount: 0, status: 'SKIPPED_ALREADY_RUNNING' };
  }

  isAutoCloseRunning = true;
  let closedCount = 0;

  try {
    const cutoffDate = new Date(Date.now() - 72 * 60 * 60 * 1000);

    const ticketsToClose = await Ticket.find({
      status: 'RESOLVED',
      resolvedAt: { $lte: cutoffDate },
    });

    for (const ticket of ticketsToClose) {
      const oldStatus = ticket.status;
      ticket.status = 'CLOSED';
      ticket.closedAt = new Date();

      applySlaStatusTransition(ticket, oldStatus, 'CLOSED');
      await ticket.save();

      // System Audit Log
      await createAuditLog({
        organizationId: ticket.organizationId,
        actorType: 'SYSTEM',
        actorId: null,
        actorRole: 'SYSTEM',
        action: 'TICKET_AUTO_CLOSED',
        entityType: 'TICKET',
        entityId: ticket._id,
        details: {
          previousStatus: oldStatus,
          newStatus: 'CLOSED',
          resolvedAt: ticket.resolvedAt,
          autoClosedAfterHours: 72,
        },
      });

      // System Notification
      await notifyTicketStatusChanged(ticket, oldStatus, 'CLOSED', null);

      closedCount++;
    }
  } catch (error) {
    console.error('Auto-Close Job Error:', error.message);
  } finally {
    isAutoCloseRunning = false;
  }

  return { closedCount };
};

/**
 * SLA Monitoring and Automated Escalation Job
 *
 * Scans active tickets, evaluates response and resolution deadlines against
 * the standardized escalation tiers (0=NORMAL, 1=APPROACHING_BREACH (80%),
 * 2=BREACHED (100%), 3=SEVERE_ESCALATION (150%)), updates ticket records,
 * and emits audit and notification events without duplicate spamming.
 *
 * @returns {Promise<{ evaluatedCount: number, escalatedCount: number }>}
 */
const runSlaMonitoringJob = async () => {
  if (isSlaMonitoringRunning) {
    return { evaluatedCount: 0, escalatedCount: 0, status: 'SKIPPED_ALREADY_RUNNING' };
  }

  isSlaMonitoringRunning = true;
  let evaluatedCount = 0;
  let escalatedCount = 0;

  try {
    const now = new Date();

    // Only process tickets actively running against SLA (skip PENDING which is paused)
    const activeTickets = await Ticket.find({
      status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      slaPausedAt: null, // Confirm SLA is not paused
    });

    evaluatedCount = activeTickets.length;

    for (const ticket of activeTickets) {
      let isModified = false;
      const initialEscalation = ticket.escalationLevel || 0;

      // ==========================================
      // 1. Evaluate Response SLA
      // ==========================================
      if (!ticket.firstRespondedAt && ticket.responseDue) {
        if (now > ticket.responseDue) {
          // 100% Response Breach
          if (!ticket.isResponseBreached) {
            ticket.isResponseBreached = true;
            ticket.escalationLevel = Math.max(ticket.escalationLevel || 0, 2);
            isModified = true;

            await createAuditLog({
              organizationId: ticket.organizationId,
              actorType: 'SYSTEM',
              actorRole: 'SYSTEM',
              action: 'SLA_RESPONSE_BREACHED',
              entityType: 'TICKET',
              entityId: ticket._id,
              details: { responseDue: ticket.responseDue, now },
            });

            await notifySlaWarning(
              ticket,
              'RESPONSE_BREACHED',
              `SLA Response Breached: ${ticket.ticketNumber}`,
              `Initial response time deadline of ${ticket.responseDue.toISOString()} has passed.`
            );
          }
        } else {
          // Check 80% Approaching Breach Threshold
          const totalResponseMs =
            new Date(ticket.responseDue).getTime() - new Date(ticket.createdAt).getTime();
          const elapsedResponseMs = now.getTime() - new Date(ticket.createdAt).getTime();

          if (
            totalResponseMs > 0 &&
            elapsedResponseMs / totalResponseMs >= 0.8 &&
            ticket.escalationLevel < 1
          ) {
            ticket.escalationLevel = 1;
            isModified = true;

            await createAuditLog({
              organizationId: ticket.organizationId,
              actorType: 'SYSTEM',
              actorRole: 'SYSTEM',
              action: 'SLA_APPROACHING_RESPONSE_BREACH',
              entityType: 'TICKET',
              entityId: ticket._id,
              details: { thresholdPercentage: 80, responseDue: ticket.responseDue },
            });

            await notifySlaWarning(
              ticket,
              'APPROACHING_RESPONSE_BREACH',
              `SLA Approaching Response Breach: ${ticket.ticketNumber}`,
              `Ticket ${ticket.ticketNumber} has reached 80% of allowed initial response time.`
            );
          }
        }
      }

      // ==========================================
      // 2. Evaluate Resolution SLA
      // ==========================================
      if (!ticket.resolvedAt && ticket.resolutionDue) {
        if (now > ticket.resolutionDue) {
          // 100% Resolution Breach
          if (!ticket.isResolutionBreached) {
            ticket.isResolutionBreached = true;
            ticket.escalationLevel = Math.max(ticket.escalationLevel || 0, 2);
            isModified = true;

            await createAuditLog({
              organizationId: ticket.organizationId,
              actorType: 'SYSTEM',
              actorRole: 'SYSTEM',
              action: 'SLA_RESOLUTION_BREACHED',
              entityType: 'TICKET',
              entityId: ticket._id,
              details: { resolutionDue: ticket.resolutionDue, now },
            });

            await notifySlaWarning(
              ticket,
              'RESOLUTION_BREACHED',
              `SLA Resolution Breached: ${ticket.ticketNumber}`,
              `Ticket resolution deadline of ${ticket.resolutionDue.toISOString()} has expired.`
            );
          } else if (ticket.escalationLevel < 3) {
            // Check 150% Severe Escalation Threshold
            const totalResolutionMs =
              new Date(ticket.resolutionDue).getTime() - new Date(ticket.createdAt).getTime();
            const elapsedResolutionMs = now.getTime() - new Date(ticket.createdAt).getTime();

            if (totalResolutionMs > 0 && elapsedResolutionMs / totalResolutionMs >= 1.5) {
              ticket.escalationLevel = 3;
              isModified = true;

              await createAuditLog({
                organizationId: ticket.organizationId,
                actorType: 'SYSTEM',
                actorRole: 'SYSTEM',
                action: 'SLA_SEVERE_ESCALATION',
                entityType: 'TICKET',
                entityId: ticket._id,
                details: { escalationLevel: 3, threshold: '150%' },
              });

              await notifySlaWarning(
                ticket,
                'SEVERE_ESCALATION',
                `URGENT SLA Severe Escalation: ${ticket.ticketNumber}`,
                `Ticket ${ticket.ticketNumber} remains unresolved past 150% of SLA time target.`
              );
            }
          }
        } else {
          // Check 80% Approaching Breach Threshold
          const pausedAdjustmentMs = (ticket.totalSlaPausedMinutes || 0) * 60 * 1000;
          const totalResolutionMs =
            new Date(ticket.resolutionDue).getTime() -
            new Date(ticket.createdAt).getTime() -
            pausedAdjustmentMs;
          const elapsedResolutionMs =
            now.getTime() - new Date(ticket.createdAt).getTime() - pausedAdjustmentMs;

          if (
            totalResolutionMs > 0 &&
            elapsedResolutionMs / totalResolutionMs >= 0.8 &&
            ticket.escalationLevel < 1
          ) {
            ticket.escalationLevel = 1;
            isModified = true;

            await createAuditLog({
              organizationId: ticket.organizationId,
              actorType: 'SYSTEM',
              actorRole: 'SYSTEM',
              action: 'SLA_APPROACHING_RESOLUTION_BREACH',
              entityType: 'TICKET',
              entityId: ticket._id,
              details: { thresholdPercentage: 80, resolutionDue: ticket.resolutionDue },
            });

            await notifySlaWarning(
              ticket,
              'APPROACHING_RESOLUTION_BREACH',
              `SLA Approaching Resolution Breach: ${ticket.ticketNumber}`,
              `Ticket ${ticket.ticketNumber} has reached 80% of allowed resolution time.`
            );
          }
        }
      }

      if (isModified) {
        await ticket.save();
        if (ticket.escalationLevel > initialEscalation) {
          escalatedCount++;
        }
      }
    }
  } catch (error) {
    console.error('SLA Monitoring Job Error:', error.message);
  } finally {
    isSlaMonitoringRunning = false;
  }

  return { evaluatedCount, escalatedCount };
};

/**
 * Starts periodic automation timers.
 */
const startAutomationJobs = (intervalMs = 60000) => {
  stopAutomationJobs();

  // Run initial checks safely in background
  runAutoCloseJob().catch((err) => console.error('Initial Auto-Close Error:', err));
  runSlaMonitoringJob().catch((err) => console.error('Initial SLA Monitor Error:', err));

  autoCloseIntervalId = setInterval(runAutoCloseJob, intervalMs);
  slaMonitorIntervalId = setInterval(runSlaMonitoringJob, intervalMs);

  // Prevent background timers from keeping test processes open
  if (autoCloseIntervalId?.unref) autoCloseIntervalId.unref();
  if (slaMonitorIntervalId?.unref) slaMonitorIntervalId.unref();
};

/**
 * Stops periodic automation timers.
 */
const stopAutomationJobs = () => {
  if (autoCloseIntervalId) {
    clearInterval(autoCloseIntervalId);
    autoCloseIntervalId = null;
  }
  if (slaMonitorIntervalId) {
    clearInterval(slaMonitorIntervalId);
    slaMonitorIntervalId = null;
  }
};

module.exports = {
  runAutoCloseJob,
  runSlaMonitoringJob,
  startAutomationJobs,
  stopAutomationJobs,
};
