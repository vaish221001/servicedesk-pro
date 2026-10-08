const assert = require('assert');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Category = require('../src/models/Category');
const Ticket = require('../src/models/Ticket');
const SlaPolicy = require('../src/models/SlaPolicy');
const Organization = require('../src/models/Organization');
const Asset = require('../src/models/Asset');
const AuditLog = require('../src/models/AuditLog');

const slaService = require('../src/services/slaService');
const categoryService = require('../src/services/categoryService');
const ticketService = require('../src/services/ticketService');
const auditService = require('../src/services/auditService');

const AppError = require('../src/utils/AppError');

// Safe mock IDs for test isolation
const orgA = new mongoose.Types.ObjectId();
const orgB = new mongoose.Types.ObjectId();
const deptIT = new mongoose.Types.ObjectId();
const deptHR = new mongoose.Types.ObjectId();

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
  assignedDepartments: [deptHR],
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

// Default mock resolvers to prevent Mongoose connection timeouts in unit tests
Organization.findOne = () => Promise.resolve({ _id: orgA, isActive: true, businessHours: { start: '09:00', end: '18:00', workingDays: [1,2,3,4,5] } });
Organization.findById = () => Promise.resolve({ _id: orgA, isActive: true, businessHours: { start: '09:00', end: '18:00', workingDays: [1,2,3,4,5] } });
SlaPolicy.findOne = () => Promise.resolve(null);
SlaPolicy.findById = () => Promise.resolve(null);
AuditLog.create = (doc) => Promise.resolve(doc);

async function runStep18Tests() {
  console.log('=== ServiceDesk Pro Step 18 Test Suite ===\n');
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

  // ==========================================
  // 1. SLA FOUNDATION & DUE DATE CALCULATION
  // ==========================================
  console.log('--- 1. SLA Foundation Tests ---');

  await test('Default targets are defined for all 4 priorities', () => {
    const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    for (const p of priorities) {
      assert.ok(slaService.DEFAULT_TARGETS[p], `Missing default target for ${p}`);
      assert.ok(slaService.DEFAULT_TARGETS[p].responseTimeMinutes > 0);
      assert.ok(slaService.DEFAULT_TARGETS[p].resolutionTimeMinutes > 0);
    }
  });

  await test('Calendar SLA calculation adds exact minutes when 24x7 / no business hours', () => {
    const startTime = new Date('2026-03-01T10:00:00.000Z');
    const policy = {
      _id: new mongoose.Types.ObjectId(),
      businessHoursOnly: false,
      targets: [
        { priority: 'CRITICAL', responseTimeMinutes: 15, resolutionTimeMinutes: 120 },
      ],
    };

    const dueDates = slaService.calculateDueDates(policy, 'CRITICAL', null, startTime);
    assert.strictEqual(
      dueDates.responseDue.toISOString(),
      new Date('2026-03-01T10:15:00.000Z').toISOString()
    );
    assert.strictEqual(
      dueDates.resolutionDue.toISOString(),
      new Date('2026-03-01T12:00:00.000Z').toISOString()
    );
  });

  await test('Business hours calculation advances within Mon-Fri 09:00-18:00 window', () => {
    const businessHours = {
      start: '09:00',
      end: '18:00',
      workingDays: [1, 2, 3, 4, 5],
    };

    // Thursday 17:00 (1 hour before close), add 120 minutes (2 hours)
    // 60 minutes today (until 18:00) + 60 minutes tomorrow (09:00 -> 10:00)
    const startTime = new Date(2026, 2, 19, 17, 0, 0); // Thursday
    const result = slaService.addBusinessMinutes(startTime, 120, businessHours);

    assert.strictEqual(result.getHours(), 10);
    assert.strictEqual(result.getMinutes(), 0);
    assert.strictEqual(result.getDate(), 20); // Friday
  });

  await test('SLA state machine pauses when entering PENDING and resumes with extended due date', () => {
    const initialDue = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now
    const ticket = {
      status: 'IN_PROGRESS',
      resolutionDue: initialDue,
      slaPausedAt: null,
      totalSlaPausedMinutes: 0,
    };

    // 1. Move to PENDING
    slaService.applySlaStatusTransition(ticket, 'IN_PROGRESS', 'PENDING');
    assert.ok(ticket.slaPausedAt instanceof Date, 'slaPausedAt must be set');

    // 2. Simulate 30 minutes in PENDING
    ticket.slaPausedAt = new Date(Date.now() - 30 * 60 * 1000);

    // 3. Move back to IN_PROGRESS
    slaService.applySlaStatusTransition(ticket, 'PENDING', 'IN_PROGRESS');
    assert.strictEqual(ticket.slaPausedAt, null, 'slaPausedAt must be cleared');
    assert.ok(ticket.totalSlaPausedMinutes >= 30, 'totalSlaPausedMinutes must be incremented');
    assert.ok(
      ticket.resolutionDue.getTime() > initialDue.getTime(),
      'resolutionDue must be pushed forward by pause duration'
    );
  });

  // ==========================================
  // 2. CATEGORY MANAGEMENT TESTS
  // ==========================================
  console.log('\n--- 2. Category Management Tests ---');

  const origCatFindOne = Category.findOne;
  const origDeptFindOne = Department.findOne;
  const origCatCreate = Category.create;

  await test('Category creation requires name and departmentId', async () => {
    try {
      await categoryService.createCategory(orgA, { name: '' }, itManagerUser);
      assert.fail('Should have thrown on missing name');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.message, 'Category name is required');
    }
  });

  await test('Category creation rejects department from a different organization', async () => {
    Department.findOne = () => Promise.resolve(null); // Not found in orgA

    try {
      await categoryService.createCategory(orgA, { name: 'Hardware', departmentId: deptIT }, itManagerUser);
      assert.fail('Should have rejected cross-org department');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('Invalid department'));
    }
  });

  await test('Subcategory rejects parent category with mismatching department', async () => {
    const parentCatId = new mongoose.Types.ObjectId();
    Department.findOne = () => Promise.resolve({ _id: deptIT, organizationId: orgA, isActive: true });
    Category.findOne = () =>
      Promise.resolve({
        _id: parentCatId,
        departmentId: deptHR, // Different department!
        organizationId: orgA,
        isActive: true,
      });

    try {
      await categoryService.createCategory(
        orgA,
        { name: 'Monitors', departmentId: deptIT, parentId: parentCatId },
        itManagerUser
      );
      assert.fail('Should have rejected subcategory department mismatch');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(
        err.message,
        'Subcategory department must match parent category department'
      );
    }
  });

  await test('Category cannot be its own parent', async () => {
    const catId = new mongoose.Types.ObjectId();
    Category.findOne = () => Promise.resolve({ _id: catId, organizationId: orgA });

    try {
      await categoryService.updateCategory(orgA, catId, { parentId: catId }, itManagerUser);
      assert.fail('Should have rejected self-parenting');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.message, 'Category cannot be its own parent');
    }
  });

  // ==========================================
  // 3. TICKET MANAGEMENT TESTS
  // ==========================================
  console.log('\n--- 3. Ticket Management Tests ---');

  const catHardwareId = new mongoose.Types.ObjectId();
  const subcatLaptopId = new mongoose.Types.ObjectId();

  await test('Ticket creation requires title, description, departmentId, and categoryId', async () => {
    try {
      await ticketService.createTicket(orgA, { title: '' }, employeeUser);
      assert.fail('Should have thrown on missing fields');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.message, 'Ticket title is required');
    }
  });

  await test('Ticket creation rejects category not belonging to selected department', async () => {
    Department.findOne = () => Promise.resolve({ _id: deptIT, organizationId: orgA, isActive: true });
    Category.findOne = (q) => {
      if (q._id.toString() === catHardwareId.toString()) {
        return Promise.resolve({
          _id: catHardwareId,
          departmentId: deptHR, // Different department!
          organizationId: orgA,
          isActive: true,
        });
      }
      return Promise.resolve(null);
    };

    try {
      await ticketService.createTicket(
        orgA,
        {
          title: 'Laptop Broken',
          description: 'Screen is cracked',
          departmentId: deptIT,
          categoryId: catHardwareId,
        },
        employeeUser
      );
      assert.fail('Should have rejected category department mismatch');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(
        err.message,
        'Category does not belong to the selected department'
      );
    }
  });

  await test('Employee is strictly forced as requesterId during ticket creation', async () => {
    const attackerSpecifiedRequester = new mongoose.Types.ObjectId();
    let savedRequesterId = null;

    Department.findOne = () => Promise.resolve({ _id: deptIT, organizationId: orgA, isActive: true });
    Category.findOne = () =>
      Promise.resolve({
        _id: catHardwareId,
        departmentId: deptIT,
        organizationId: orgA,
        isActive: true,
      });
    Organization.findById = () => Promise.resolve({ _id: orgA, isActive: true });
    Ticket.findOne = () => ({
      sort: () => ({
        collation: () => ({
          select: () => Promise.resolve(null),
        }),
      }),
    });

    const origTicketCreate = Ticket.create;
    Ticket.create = (doc) => {
      savedRequesterId = doc.requesterId;
      return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
    };

    await ticketService.createTicket(
      orgA,
      {
        title: 'Broken Keyboard',
        description: 'Keys sticking',
        departmentId: deptIT,
        categoryId: catHardwareId,
        requesterId: attackerSpecifiedRequester, // Attempt spoofing
      },
      employeeUser
    );

    assert.strictEqual(
      savedRequesterId.toString(),
      employeeUser._id.toString(),
      'Requester must be forced to the authenticated employee ID'
    );

    Ticket.create = origTicketCreate;
  });

  await test('Ticket number generation produces SDP-YYYY-XXXX sequential format', async () => {
    const year = new Date().getFullYear();
    Ticket.findOne = () => ({
      sort: () => ({
        collation: () => ({
          select: () => Promise.resolve({ ticketNumber: `SDP-${year}-0042` }),
        }),
      }),
    });

    const ticketNumber = await ticketService.generateTicketNumber(orgA);
    assert.strictEqual(ticketNumber, `SDP-${year}-0043`);
  });

  // ==========================================
  // 4. LIFECYCLE & ROLE TRANSITION TESTS
  // ==========================================
  console.log('\n--- 4. Lifecycle & Role Transition Tests ---');

  await test('Disallows invalid status transitions (e.g., OPEN -> RESOLVED directly)', async () => {
    const ticketId = new mongoose.Types.ObjectId();
    Ticket.findOne = () =>
      Promise.resolve({
        _id: ticketId,
        organizationId: orgA,
        departmentId: deptIT,
        status: 'OPEN',
      });

    try {
      await ticketService.changeTicketStatus(
        orgA,
        ticketId,
        { status: 'RESOLVED', resolutionNotes: 'Fixed' },
        itManagerUser
      );
      assert.fail('Should have rejected OPEN -> RESOLVED transition');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('Invalid status transition from OPEN to RESOLVED'));
    }
  });

  await test('Transition to RESOLVED requires resolutionNotes', async () => {
    const ticketId = new mongoose.Types.ObjectId();
    Ticket.findOne = () =>
      Promise.resolve({
        _id: ticketId,
        organizationId: orgA,
        departmentId: deptIT,
        status: 'IN_PROGRESS',
      });

    try {
      await ticketService.changeTicketStatus(
        orgA,
        ticketId,
        { status: 'RESOLVED', resolutionNotes: '' },
        itManagerUser
      );
      assert.fail('Should have required resolutionNotes');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(
        err.message,
        'Resolution notes are mandatory when marking a ticket as RESOLVED'
      );
    }
  });

  await test('Employee can reopen resolved ticket within 72 hours with reopenReason', async () => {
    const ticketId = new mongoose.Types.ObjectId();
    let savedTicket = null;

    const mockTicket = {
      _id: ticketId,
      organizationId: orgA,
      departmentId: deptIT,
      requesterId: employeeUser._id,
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago (<= 72h)
      reopenedCount: 0,
      save: function () {
        savedTicket = this;
        return Promise.resolve(this);
      },
    };

    Ticket.findOne = () => Promise.resolve(mockTicket);

    const result = await ticketService.changeTicketStatus(
      orgA,
      ticketId,
      { status: 'IN_PROGRESS', reopenReason: 'Monitor still flickering after repair' },
      employeeUser
    );

    assert.strictEqual(result.status, 'IN_PROGRESS');
    assert.strictEqual(result.reopenedCount, 1);
    assert.strictEqual(result.reopenReason, 'Monitor still flickering after repair');
    assert.strictEqual(result.lastReopenedBy.toString(), employeeUser._id.toString());
  });

  await test('Employee cannot reopen resolved ticket after 72 hours', async () => {
    const ticketId = new mongoose.Types.ObjectId();
    const mockTicket = {
      _id: ticketId,
      organizationId: orgA,
      departmentId: deptIT,
      requesterId: employeeUser._id,
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 75 * 60 * 60 * 1000), // 75 hours ago (> 72h)
    };

    Ticket.findOne = () => Promise.resolve(mockTicket);

    try {
      await ticketService.changeTicketStatus(
        orgA,
        ticketId,
        { status: 'IN_PROGRESS', reopenReason: 'Problem came back' },
        employeeUser
      );
      assert.fail('Should have rejected reopening past 72h for employee');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('72 hours'));
    }
  });

  await test('Technician assignment enforces eligible roles and authorized departments', async () => {
    const ticketId = new mongoose.Types.ObjectId();
    Ticket.findOne = () =>
      Promise.resolve({
        _id: ticketId,
        organizationId: orgA,
        departmentId: deptIT,
        status: 'OPEN',
        save: function () {
          return Promise.resolve(this);
        },
      });

    // Attempting to assign to an EMPLOYEE
    User.findOne = () =>
      Promise.resolve({
        _id: employeeUser._id,
        role: 'EMPLOYEE', // Ineligible!
        organizationId: orgA,
        isActive: true,
      });

    try {
      await ticketService.assignTicket(orgA, ticketId, employeeUser._id, itManagerUser);
      assert.fail('Should have rejected assignment to an employee');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('Assignee must have a technical support role'));
    }
  });

  await test('Employee cannot access another user ticket by ID (403)', async () => {
    const ticketId = new mongoose.Types.ObjectId();
    const otherUser = new mongoose.Types.ObjectId();

    Ticket.findOne = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: () => ({
                      populate: () =>
                        Promise.resolve({
                          _id: ticketId,
                          organizationId: orgA,
                          departmentId: deptIT,
                          requesterId: otherUser, // Different user!
                        }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    try {
      await ticketService.getTicketById(orgA, ticketId, employeeUser);
      assert.fail('Should have denied employee access to other user ticket');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'You do not have permission to view this ticket');
    }
  });

  await test('Technician cannot access ticket in unauthorized department (403)', async () => {
    const ticketId = new mongoose.Types.ObjectId();
    const deptFinance = new mongoose.Types.ObjectId(); // Not in IT or HR

    Ticket.findOne = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: () => ({
                      populate: () =>
                        Promise.resolve({
                          _id: ticketId,
                          organizationId: orgA,
                          departmentId: deptFinance,
                          assignedTo: null,
                          requesterId: new mongoose.Types.ObjectId(),
                        }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    try {
      await ticketService.getTicketById(orgA, ticketId, technicianUser);
      assert.fail('Should have denied technician access to unauthorized department');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(
        err.message,
        'You do not have permission to view tickets in this department'
      );
    }
  });

  await test('Cross-organization access strictly returns 404 (multi-tenant boundary)', async () => {
    const ticketId = new mongoose.Types.ObjectId();

    // Query with orgA searches for { _id: ticketId, organizationId: orgA } which returns null because ticket is in orgB
    Ticket.findOne = (q) => {
      assert.strictEqual(q.organizationId.toString(), orgA.toString());
      return {
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: () => ({
                      populate: () => ({
                        populate: () => Promise.resolve(null),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    };

    try {
      await ticketService.getTicketById(orgA, ticketId, itManagerUser);
      assert.fail('Should have returned 404 for cross-org ticket');
    } catch (err) {
      assert.strictEqual(err.statusCode, 404);
      assert.strictEqual(err.message, 'Ticket not found');
    }
  });

  await test('Employee ticket listing is strictly scoped to requesterId', async () => {
    let capturedFilter = null;
    Ticket.find = (filter) => {
      capturedFilter = filter;
      return {
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => ({
                  populate: () => ({
                    sort: () => ({
                      skip: () => ({
                        limit: () => Promise.resolve([]),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    };
    Ticket.countDocuments = () => Promise.resolve(0);

    await ticketService.getTickets(orgA, employeeUser, {});
    assert.strictEqual(capturedFilter.organizationId.toString(), orgA.toString());
    assert.strictEqual(
      capturedFilter.requesterId.toString(),
      employeeUser._id.toString(),
      'Filter must include requesterId for employees'
    );
  });

  // ==========================================
  // 5. AUDIT LOGGING TESTS
  // ==========================================
  console.log('\n--- 5. Audit Logging Tests ---');

  await test('Audit log creates sanitized entry with actor and entity context', async () => {
    let createdAudit = null;
    const origAuditCreate = AuditLog.create;
    AuditLog.create = (doc) => {
      createdAudit = doc;
      return Promise.resolve(doc);
    };

    await auditService.createAuditLog({
      organizationId: orgA,
      actorType: 'HUMAN',
      actorId: itManagerUser._id,
      actorRole: itManagerUser.role,
      action: 'TICKET_STATUS_CHANGED',
      entityType: 'TICKET',
      entityId: new mongoose.Types.ObjectId(),
      details: {
        oldStatus: 'OPEN',
        newStatus: 'ASSIGNED',
        password: 'should_be_stripped',
      },
    });

    assert.ok(createdAudit);
    assert.strictEqual(createdAudit.action, 'TICKET_STATUS_CHANGED');
    assert.strictEqual(createdAudit.actorRole, 'IT_MANAGER');
    assert.strictEqual(createdAudit.details.password, undefined, 'Sensitive field was stripped');
    assert.strictEqual(createdAudit.details.newStatus, 'ASSIGNED');

    AuditLog.create = origAuditCreate;
  });

  // Restore mocks
  Category.findOne = origCatFindOne;
  Department.findOne = origDeptFindOne;

  console.log(`\nStep 18 Tests Completed: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runStep18Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
