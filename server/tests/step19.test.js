const assert = require('assert');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Category = require('../src/models/Category');
const Ticket = require('../src/models/Ticket');
const TicketComment = require('../src/models/TicketComment');
const WorkLog = require('../src/models/WorkLog');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');
const Organization = require('../src/models/Organization');

const commentService = require('../src/services/commentService');
const workLogService = require('../src/services/workLogService');
const notificationService = require('../src/services/notificationService');
const automationService = require('../src/services/automationService');
const { getSafeFilePath, ALLOWED_MIME_TYPES } = require('../src/utils/fileStorage');
const AppError = require('../src/utils/AppError');

// Safe mock identifiers
const orgA = new mongoose.Types.ObjectId();
const orgB = new mongoose.Types.ObjectId();
const deptIT = new mongoose.Types.ObjectId();

const employeeUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Emily',
  lastName: 'Employee',
  email: 'emily@example.com',
  role: 'EMPLOYEE',
  organizationId: orgA,
  departmentId: deptIT,
  assignedDepartments: [],
  isActive: true,
};

const technicianUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Tom',
  lastName: 'Technician',
  email: 'tom@example.com',
  role: 'TECHNICIAN',
  organizationId: orgA,
  departmentId: deptIT,
  assignedDepartments: [],
  isActive: true,
};

const itManagerUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Mary',
  lastName: 'Manager',
  email: 'mary@example.com',
  role: 'IT_MANAGER',
  organizationId: orgA,
  departmentId: deptIT,
  assignedDepartments: [],
  isActive: true,
};

// Global default mocks for DB isolation
AuditLog.create = (doc) => Promise.resolve(doc);
Notification.create = (doc) => Promise.resolve(doc);
User.find = () => ({ select: () => Promise.resolve([]) });

async function runStep19Tests() {
  console.log('=== ServiceDesk Pro Step 19 Test Suite ===\n');
  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${name}`);
      console.error(err);
    }
  };

  const origTicketFindOne = Ticket.findOne;
  const origCommentCreate = TicketComment.create;
  const origCommentFind = TicketComment.find;
  const origWorkLogCreate = WorkLog.create;
  const origWorkLogFind = WorkLog.find;

  // ==========================================
  // 1. COMMENTS AND PRIVACY TESTS
  // ==========================================
  console.log('--- 1. Comments and Privacy Tests ---');

  const ticketId = new mongoose.Types.ObjectId();
  const mockTicket = {
    _id: ticketId,
    organizationId: orgA,
    departmentId: deptIT,
    requesterId: employeeUser._id,
    assignedTo: technicianUser._id,
    status: 'IN_PROGRESS',
  };

  Ticket.findOne = () => Promise.resolve(mockTicket);

  await test('Employees cannot create internal notes (403)', async () => {
    try {
      await commentService.addComment(
        orgA,
        ticketId,
        { content: 'Internal secret notes', isInternal: true },
        [],
        employeeUser
      );
      assert.fail('Should have rejected employee creating internal note');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'Employees are not permitted to create internal notes');
    }
  });

  await test('Technician can create both public replies and internal notes', async () => {
    let capturedComment = null;
    TicketComment.create = (doc) => {
      capturedComment = doc;
      return Promise.resolve({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        populate: () => Promise.resolve(doc),
      });
    };

    // Public reply
    await commentService.addComment(
      orgA,
      ticketId,
      { content: 'Please restart your computer', isInternal: false },
      [],
      technicianUser
    );
    assert.strictEqual(capturedComment.isInternal, false);
    assert.strictEqual(capturedComment.content, 'Please restart your computer');

    // Internal note
    await commentService.addComment(
      orgA,
      ticketId,
      { content: 'Suspected hardware failure on motherboard', isInternal: true },
      [],
      technicianUser
    );
    assert.strictEqual(capturedComment.isInternal, true);
    assert.strictEqual(capturedComment.content, 'Suspected hardware failure on motherboard');
  });

  await test('Employees NEVER see internal notes in comments list', async () => {
    let capturedFilter = null;
    TicketComment.find = (filter) => {
      capturedFilter = filter;
      return {
        populate: () => ({
          sort: () => Promise.resolve([]),
        }),
      };
    };

    // 1. Employee query
    await commentService.getComments(orgA, ticketId, employeeUser);
    assert.strictEqual(
      capturedFilter.isInternal,
      false,
      'Filter must enforce isInternal: false for employees'
    );

    // 2. Technician query
    await commentService.getComments(orgA, ticketId, technicianUser);
    assert.strictEqual(
      capturedFilter.isInternal,
      undefined,
      'Technicians must see both internal and public notes'
    );
  });

  // ==========================================
  // 2. ATTACHMENT VALIDATION AND PRIVACY TESTS
  // ==========================================
  console.log('\n--- 2. Attachment Validation Tests ---');

  await test('Allowed MIME types list includes safe documents, images, and archives', () => {
    assert.ok(ALLOWED_MIME_TYPES.has('image/png'));
    assert.ok(ALLOWED_MIME_TYPES.has('image/jpeg'));
    assert.ok(ALLOWED_MIME_TYPES.has('application/pdf'));
    assert.ok(ALLOWED_MIME_TYPES.has('text/plain'));
    assert.ok(ALLOWED_MIME_TYPES.has('application/zip'));
    assert.strictEqual(ALLOWED_MIME_TYPES.has('application/x-msdownload'), false);
    assert.strictEqual(ALLOWED_MIME_TYPES.has('application/x-sh'), false);
  });

  await test('getSafeFilePath prevents directory traversal attacks', () => {
    try {
      getSafeFilePath('../../etc/passwd');
      assert.fail('Should have rejected path traversal attempt');
    } catch (err) {
      assert.ok(err.statusCode === 403 || err.statusCode === 404);
    }

    try {
      getSafeFilePath('..\\..\\windows\\system32\\config');
      assert.fail('Should have rejected Windows path traversal');
    } catch (err) {
      assert.ok(err.statusCode === 403 || err.statusCode === 404);
    }
  });

  await test('downloadAttachment rejects employees from accessing internal note attachments (403)', async () => {
    const commentController = require('../src/controllers/commentController');
    const internalComment = {
      _id: new mongoose.Types.ObjectId(),
      ticketId,
      organizationId: orgA,
      isInternal: true,
      attachments: [{ fileName: 'secret.pdf', fileUrl: '/api/tickets/' + ticketId + '/attachments/secret.pdf' }],
    };

    TicketComment.findOne = () => Promise.resolve(internalComment);

    const req = {
      params: { id: ticketId, filename: 'secret.pdf' },
      user: employeeUser,
    };
    let errorPassed = null;
    const next = (err) => {
      errorPassed = err;
    };

    await commentController.downloadAttachment(req, {}, next);
    assert.ok(errorPassed, 'Expected error passed to next()');
    assert.strictEqual(errorPassed.statusCode, 403);
    assert.strictEqual(
      errorPassed.message,
      'You do not have permission to access internal attachments'
    );
  });

  // ==========================================
  // 3. WORK LOG PERMISSIONS AND VALIDATION TESTS
  // ==========================================
  console.log('\n--- 3. Work Log Tests ---');

  await test('Employees cannot create work logs (403)', async () => {
    try {
      await workLogService.createWorkLog(
        orgA,
        ticketId,
        { timeSpentMinutes: 30, description: 'Worked on laptop' },
        employeeUser
      );
      assert.fail('Should have rejected employee work logging');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.ok(err.message.includes('Employees are not permitted'));
    }
  });

  await test('Employees cannot view technician work logs (403)', async () => {
    try {
      await workLogService.getWorkLogs(orgA, ticketId, employeeUser);
      assert.fail('Should have rejected employee viewing work logs');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.ok(err.message.includes('Employees are not permitted'));
    }
  });

  await test('Technician can create work log with valid time and description', async () => {
    let capturedWorkLog = null;
    WorkLog.create = (doc) => {
      capturedWorkLog = doc;
      return Promise.resolve({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        populate: () => Promise.resolve(doc),
      });
    };

    const result = await workLogService.createWorkLog(
      orgA,
      ticketId,
      { timeSpentMinutes: 45, description: 'Replaced broken RAM module' },
      technicianUser
    );

    assert.ok(result);
    assert.strictEqual(capturedWorkLog.timeSpentMinutes, 45);
    assert.strictEqual(capturedWorkLog.description, 'Replaced broken RAM module');
    assert.strictEqual(capturedWorkLog.technicianId.toString(), technicianUser._id.toString());
  });

  await test('Work log rejects invalid or negative timeSpentMinutes (400)', async () => {
    try {
      await workLogService.createWorkLog(
        orgA,
        ticketId,
        { timeSpentMinutes: -10, description: 'Negative work' },
        technicianUser
      );
      assert.fail('Should have rejected negative minutes');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('positive number'));
    }
  });

  // ==========================================
  // 4. NOTIFICATION & PRIVACY TESTS
  // ==========================================
  console.log('\n--- 4. Notification Tests ---');

  await test('Internal notes NEVER trigger notifications to employees/requesters', async () => {
    let notifiedRecipients = [];
    Notification.create = (doc) => {
      notifiedRecipients.push(doc.recipientId.toString());
      return Promise.resolve(doc);
    };

    const internalComment = {
      isInternal: true,
      content: 'Confidential agent notes',
    };

    await notificationService.notifyTicketComment(mockTicket, internalComment, technicianUser);

    assert.strictEqual(
      notifiedRecipients.includes(employeeUser._id.toString()),
      false,
      'Requester must NOT be notified of internal notes'
    );
  });

  await test('Public comments by technician notify the requester', async () => {
    let notifiedRecipients = [];
    Notification.create = (doc) => {
      notifiedRecipients.push(doc.recipientId.toString());
      return Promise.resolve(doc);
    };

    const publicComment = {
      isInternal: false,
      content: 'Your laptop is ready for pickup',
    };

    await notificationService.notifyTicketComment(mockTicket, publicComment, technicianUser);

    assert.ok(
      notifiedRecipients.includes(employeeUser._id.toString()),
      'Requester must be notified of public comments'
    );
  });

  await test('markAsRead updates notification state scoped to user', async () => {
    const notifId = new mongoose.Types.ObjectId();
    let queryUsed = null;
    let updateUsed = null;

    Notification.findOneAndUpdate = (query, update) => {
      queryUsed = query;
      updateUsed = update;
      return Promise.resolve({ _id: notifId, isRead: true });
    };

    await notificationService.markAsRead(orgA, notifId, employeeUser._id);
    assert.strictEqual(queryUsed._id.toString(), notifId.toString());
    assert.strictEqual(queryUsed.recipientId.toString(), employeeUser._id.toString());
    assert.strictEqual(queryUsed.organizationId.toString(), orgA.toString());
    assert.strictEqual(updateUsed.isRead, true);
  });

  // ==========================================
  // 5. ACTIVITY FEED PRIVACY TESTS
  // ==========================================
  console.log('\n--- 5. Activity Feed Tests ---');

  await test('Activity feed redacts internal notes and work logs for employee users', async () => {
    TicketComment.find = () => ({
      populate: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              content: 'Public comment',
              isInternal: false,
              createdAt: new Date('2026-03-01T10:00:00Z'),
            },
          ]),
      }),
    });

    AuditLog.find = () => ({
      populate: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              action: 'TICKET_STATUS_CHANGED',
              timestamp: new Date('2026-03-01T11:00:00Z'),
              details: { newStatus: 'IN_PROGRESS' },
            },
          ]),
      }),
    });

    WorkLog.find = () => ({
      populate: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              description: 'Internal labor log',
              timeSpentMinutes: 60,
              createdAt: new Date('2026-03-01T12:00:00Z'),
            },
          ]),
      }),
    });

    // Employee request
    const employeeFeed = await commentService.getActivityFeed(orgA, ticketId, employeeUser);
    const hasInternalNote = employeeFeed.some((f) => f.type === 'INTERNAL_NOTE');
    const hasWorkLog = employeeFeed.some((f) => f.type === 'WORK_LOG');
    assert.strictEqual(hasInternalNote, false, 'Employee feed must have NO internal notes');
    assert.strictEqual(hasWorkLog, false, 'Employee feed must have NO work logs');

    // Technician request
    const techFeed = await commentService.getActivityFeed(orgA, ticketId, technicianUser);
    assert.ok(techFeed.some((f) => f.type === 'WORK_LOG'), 'Technician feed must include work logs');
  });

  // ==========================================
  // 6. BACKGROUND AUTOMATION TESTS
  // ==========================================
  console.log('\n--- 6. Background Automation Tests ---');

  await test('72-Hour Auto-Close job closes qualifying resolved tickets', async () => {
    let saved = false;
    const oldResolvedDate = new Date(Date.now() - 80 * 60 * 60 * 1000); // 80 hours ago (> 72h)
    const qualifyingTicket = {
      _id: new mongoose.Types.ObjectId(),
      ticketNumber: 'SDP-2026-0100',
      organizationId: orgA,
      status: 'RESOLVED',
      resolvedAt: oldResolvedDate,
      save: function () {
        saved = true;
        return Promise.resolve(this);
      },
    };

    Ticket.find = (q) => {
      assert.strictEqual(q.status, 'RESOLVED');
      return Promise.resolve([qualifyingTicket]);
    };

    const result = await automationService.runAutoCloseJob();
    assert.strictEqual(result.closedCount, 1);
    assert.strictEqual(qualifyingTicket.status, 'CLOSED');
    assert.ok(qualifyingTicket.closedAt instanceof Date);
    assert.ok(saved);
  });

  await test('SLA monitoring escalates approaching breach at 80% and breach at 100%', async () => {
    const now = new Date();
    let savedCount = 0;

    // Ticket 1: 100% breached resolution
    const breachedTicket = {
      _id: new mongoose.Types.ObjectId(),
      ticketNumber: 'SDP-2026-0101',
      organizationId: orgA,
      status: 'IN_PROGRESS',
      createdAt: new Date(now.getTime() - 10 * 60 * 60 * 1000),
      resolutionDue: new Date(now.getTime() - 1 * 60 * 60 * 1000), // Overdue by 1 hour
      isResolutionBreached: false,
      escalationLevel: 0,
      save: function () {
        savedCount++;
        return Promise.resolve(this);
      },
    };

    // Ticket 2: 85% elapsed response time (approaching breach)
    const totalResp = 60 * 60 * 1000; // 60 mins
    const approachingTicket = {
      _id: new mongoose.Types.ObjectId(),
      ticketNumber: 'SDP-2026-0102',
      organizationId: orgA,
      status: 'OPEN',
      createdAt: new Date(now.getTime() - 52 * 60 * 1000), // 52 mins elapsed (86%)
      responseDue: new Date(now.getTime() + 8 * 60 * 1000), // 8 mins left
      isResponseBreached: false,
      firstRespondedAt: null,
      escalationLevel: 0,
      save: function () {
        savedCount++;
        return Promise.resolve(this);
      },
    };

    Ticket.find = () => Promise.resolve([breachedTicket, approachingTicket]);

    const result = await automationService.runSlaMonitoringJob();
    assert.strictEqual(result.evaluatedCount, 2);
    assert.strictEqual(result.escalatedCount, 2);

    // Verify breached ticket
    assert.strictEqual(breachedTicket.isResolutionBreached, true);
    assert.strictEqual(breachedTicket.escalationLevel, 2); // BREACHED

    // Verify approaching breach ticket
    assert.strictEqual(approachingTicket.escalationLevel, 1); // APPROACHING_BREACH
  });

  await test('SLA monitoring escalates past 150% threshold to SEVERE_ESCALATION (level 3)', async () => {
    const now = new Date();
    // Ticket with resolution target of 2 hours, but created 6 hours ago (300% elapsed)
    const severeTicket = {
      _id: new mongoose.Types.ObjectId(),
      ticketNumber: 'SDP-2026-0104',
      organizationId: orgA,
      status: 'IN_PROGRESS',
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      resolutionDue: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      isResolutionBreached: true,
      escalationLevel: 2, // Was breached, now severe
      save: function () {
        return Promise.resolve(this);
      },
    };

    Ticket.find = () => Promise.resolve([severeTicket]);

    const result = await automationService.runSlaMonitoringJob();
    assert.strictEqual(severeTicket.escalationLevel, 3, 'Must escalate to level 3');
    assert.strictEqual(result.escalatedCount, 1);
  });

  await test('Auto-close job prevents overlapping concurrent executions', async () => {
    // If job is artificially marked as running
    const originalFind = Ticket.find;
    Ticket.find = () =>
      new Promise((resolve) => setTimeout(() => resolve([]), 50));

    const p1 = automationService.runAutoCloseJob();
    const p2 = automationService.runAutoCloseJob(); // Should detect lock and skip

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.ok(
      r1.status === 'SKIPPED_ALREADY_RUNNING' || r2.status === 'SKIPPED_ALREADY_RUNNING',
      'One of the runs must be skipped due to active execution lock'
    );

    Ticket.find = originalFind;
  });

  // Restore mocks
  Ticket.findOne = origTicketFindOne;
  TicketComment.create = origCommentCreate;
  TicketComment.find = origCommentFind;
  WorkLog.create = origWorkLogCreate;
  WorkLog.find = origWorkLogFind;

  console.log(`\nStep 19 Tests Completed: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runStep19Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
