const assert = require('assert');
const mongoose = require('mongoose');

const authorize = require('../src/middleware/authorize');
const AppError = require('../src/utils/AppError');
const { hasDepartmentAccess, getAllowedDepartmentIds } = require('../src/utils/departmentAccess');

// Models
const Ticket = require('../src/models/Ticket');
const Asset = require('../src/models/Asset');
const AssetAssignment = require('../src/models/AssetAssignment');
const Vendor = require('../src/models/Vendor');
const KnowledgeArticle = require('../src/models/KnowledgeArticle');
const TicketComment = require('../src/models/TicketComment');
const WorkLog = require('../src/models/WorkLog');
const AuditLog = require('../src/models/AuditLog');
const User = require('../src/models/User');

// Services
const ticketService = require('../src/services/ticketService');
const assetService = require('../src/services/assetService');
const commentService = require('../src/services/commentService');
const workLogService = require('../src/services/workLogService');
const knowledgeArticleService = require('../src/services/knowledgeArticleService');

// Organization & Department IDs
const orgA = new mongoose.Types.ObjectId();
const orgB = new mongoose.Types.ObjectId(); // Cross-tenant boundary
const deptIT = new mongoose.Types.ObjectId();
const deptHR = new mongoose.Types.ObjectId();
const deptProcurement = new mongoose.Types.ObjectId();

// 5 Core Roles in orgA
const systemAdminUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@org-a.com',
  role: 'SYSTEM_ADMIN',
  organizationId: orgA,
  departmentId: deptIT,
  isActive: true,
};

const itManagerUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Manager',
  lastName: 'User',
  email: 'manager@org-a.com',
  role: 'IT_MANAGER',
  organizationId: orgA,
  departmentId: deptIT,
  isActive: true,
};

const technicianUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Tech',
  lastName: 'User',
  email: 'tech@org-a.com',
  role: 'TECHNICIAN',
  organizationId: orgA,
  departmentId: deptIT,
  assignedDepartments: [deptIT],
  isActive: true,
};

const employeeUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Employee',
  lastName: 'User',
  email: 'emp@org-a.com',
  role: 'EMPLOYEE',
  organizationId: orgA,
  departmentId: deptHR,
  assignedDepartments: [],
  isActive: true,
};

const assetManagerUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'AssetMgr',
  lastName: 'User',
  email: 'assetmgr@org-a.com',
  role: 'ASSET_MANAGER',
  organizationId: orgA,
  departmentId: deptProcurement,
  assignedDepartments: [deptProcurement],
  isActive: true,
};

// Cross-tenant User in orgB
const externalUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'External',
  lastName: 'User',
  email: 'external@org-b.com',
  role: 'SYSTEM_ADMIN',
  organizationId: orgB,
  departmentId: new mongoose.Types.ObjectId(),
  isActive: true,
};

// Test Runner Helper
let passed = 0;
let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(err);
    failed++;
  }
};

const runRbacTestSuite = async () => {
  console.log('\n=== ServiceDesk Pro RBAC Phase 1 Test Suite ===\n');

  // Stub audit log to avoid DB dependency
  AuditLog.create = async (doc) => ({ _id: new mongoose.Types.ObjectId(), ...doc });

  // --------------------------------------------------------------------------
  // MODULE 1: USER MANAGEMENT AUTHORIZATION
  // --------------------------------------------------------------------------
  console.log('--- 1. User Management RBAC (/api/users) ---');

  await test('User Management route middleware strictly permits ONLY SYSTEM_ADMIN', async () => {
    const mw = authorize('SYSTEM_ADMIN');

    // SYSTEM_ADMIN: Allowed
    let adminErr = null;
    mw({ user: systemAdminUser }, {}, (err) => { adminErr = err; });
    assert.strictEqual(adminErr, undefined);

    // IT_MANAGER: Denied (403)
    let managerErr = null;
    mw({ user: itManagerUser }, {}, (err) => { managerErr = err; });
    assert.ok(managerErr);
    assert.strictEqual(managerErr.statusCode, 403);

    // TECHNICIAN: Denied (403)
    let techErr = null;
    mw({ user: technicianUser }, {}, (err) => { techErr = err; });
    assert.ok(techErr);
    assert.strictEqual(techErr.statusCode, 403);

    // ASSET_MANAGER: Denied (403)
    let assetErr = null;
    mw({ user: assetManagerUser }, {}, (err) => { assetErr = err; });
    assert.ok(assetErr);
    assert.strictEqual(assetErr.statusCode, 403);

    // EMPLOYEE: Denied (403)
    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);
  });

  // --------------------------------------------------------------------------
  // MODULE 2: ASSET MANAGEMENT MUTATIONS & READS
  // --------------------------------------------------------------------------
  console.log('--- 2. Asset Management RBAC (/api/assets) ---');

  await test('Asset mutation authorize middleware restricts operations to SYSTEM_ADMIN and ASSET_MANAGER', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'ASSET_MANAGER');

    // SYSTEM_ADMIN: Allowed
    let adminErr = null;
    mw({ user: systemAdminUser }, {}, (err) => { adminErr = err; });
    assert.strictEqual(adminErr, undefined);

    // ASSET_MANAGER: Allowed
    let assetMgrErr = null;
    mw({ user: assetManagerUser }, {}, (err) => { assetMgrErr = err; });
    assert.strictEqual(assetMgrErr, undefined);

    // IT_MANAGER: Denied (403) - Read-only operational scope
    let itMgrErr = null;
    mw({ user: itManagerUser }, {}, (err) => { itMgrErr = err; });
    assert.ok(itMgrErr);
    assert.strictEqual(itMgrErr.statusCode, 403);

    // TECHNICIAN: Denied (403) - Read-only scope
    let techErr = null;
    mw({ user: technicianUser }, {}, (err) => { techErr = err; });
    assert.ok(techErr);
    assert.strictEqual(techErr.statusCode, 403);

    // EMPLOYEE: Denied (403)
    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);
  });

  await test('Asset assignments history route middleware permits technical/management roles but rejects EMPLOYEE', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER', 'TECHNICIAN');

    for (const user of [systemAdminUser, itManagerUser, assetManagerUser, technicianUser]) {
      let errReceived = null;
      mw({ user }, {}, (err) => { errReceived = err; });
      assert.strictEqual(errReceived, undefined);
    }

    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);
  });

  await test('Employee getAssetById strictly enforces custody (denies viewing another user equipment)', async () => {
    const mockAsset = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      name: 'MacBook Pro',
      currentAssigneeId: new mongoose.Types.ObjectId(), // Belongs to someone else
      populate: function () { return this; },
    };

    const origFindOne = Asset.findOne;
    Asset.findOne = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => Promise.resolve(mockAsset),
        }),
      }),
    });

    try {
      await assetService.getAssetById(orgA, mockAsset._id, employeeUser);
      assert.fail('Should have thrown 403');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'You do not have permission to view this asset');
    } finally {
      Asset.findOne = origFindOne;
    }
  });

  await test('Employee getAssetById permits viewing equipment currently assigned to them', async () => {
    const mockAsset = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      name: 'Dell Latitude',
      currentAssigneeId: employeeUser._id, // Matches employee
      populate: function () { return this; },
    };

    const origFindOne = Asset.findOne;
    Asset.findOne = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => Promise.resolve(mockAsset),
        }),
      }),
    });

    try {
      const res = await assetService.getAssetById(orgA, mockAsset._id, employeeUser);
      assert.strictEqual(res.name, 'Dell Latitude');
    } finally {
      Asset.findOne = origFindOne;
    }
  });

  await test('Staff roles (SYSTEM_ADMIN, IT_MANAGER, ASSET_MANAGER, TECHNICIAN) can view any asset in their organization', async () => {
    const mockAsset = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      name: 'Network Switch',
      currentAssigneeId: null,
      populate: function () { return this; },
    };

    const origFindOne = Asset.findOne;
    Asset.findOne = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => Promise.resolve(mockAsset),
        }),
      }),
    });

    try {
      for (const user of [systemAdminUser, itManagerUser, assetManagerUser, technicianUser]) {
        const res = await assetService.getAssetById(orgA, mockAsset._id, user);
        assert.strictEqual(res.name, 'Network Switch');
      }
    } finally {
      Asset.findOne = origFindOne;
    }
  });

  // --------------------------------------------------------------------------
  // MODULE 3: VENDOR MANAGEMENT RBAC
  // --------------------------------------------------------------------------
  console.log('--- 3. Vendor Management RBAC (/api/vendors) ---');

  await test('Vendor mutations authorize middleware restricts operations to SYSTEM_ADMIN and ASSET_MANAGER', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'ASSET_MANAGER');

    // SYSTEM_ADMIN: Allowed
    let adminErr = null;
    mw({ user: systemAdminUser }, {}, (err) => { adminErr = err; });
    assert.strictEqual(adminErr, undefined);

    // ASSET_MANAGER: Allowed
    let assetMgrErr = null;
    mw({ user: assetManagerUser }, {}, (err) => { assetMgrErr = err; });
    assert.strictEqual(assetMgrErr, undefined);

    // IT_MANAGER: Denied (403)
    let itMgrErr = null;
    mw({ user: itManagerUser }, {}, (err) => { itMgrErr = err; });
    assert.ok(itMgrErr);
    assert.strictEqual(itMgrErr.statusCode, 403);

    // TECHNICIAN: Denied (403)
    let techErr = null;
    mw({ user: technicianUser }, {}, (err) => { techErr = err; });
    assert.ok(techErr);
    assert.strictEqual(techErr.statusCode, 403);

    // EMPLOYEE: Denied (403)
    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);
  });

  await test('Vendor viewing authorize middleware permits technical & management staff but rejects EMPLOYEE', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER', 'TECHNICIAN');

    for (const user of [systemAdminUser, itManagerUser, assetManagerUser, technicianUser]) {
      let errReceived = null;
      mw({ user }, {}, (err) => { errReceived = err; });
      assert.strictEqual(errReceived, undefined);
    }

    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);
  });

  // --------------------------------------------------------------------------
  // MODULE 4: TICKET SCOPING & DATA ACCESS
  // --------------------------------------------------------------------------
  console.log('--- 4. Ticket Scoping & Data Access RBAC (/api/tickets) ---');

  await test('ticketService.getTickets scopes EMPLOYEE strictly to requesterId = user._id', async () => {
    let capturedFilter = null;
    const origFind = Ticket.find;
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
    const origCount = Ticket.countDocuments;
    Ticket.countDocuments = () => Promise.resolve(0);

    try {
      await ticketService.getTickets(orgA, employeeUser);
      assert.strictEqual(capturedFilter.organizationId.toString(), orgA.toString());
      assert.strictEqual(capturedFilter.requesterId.toString(), employeeUser._id.toString());
    } finally {
      Ticket.find = origFind;
      Ticket.countDocuments = origCount;
    }
  });

  await test('ticketService.getTickets scopes TECHNICIAN to authorized departments or assignment', async () => {
    let capturedFilter = null;
    const origFind = Ticket.find;
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
    const origCount = Ticket.countDocuments;
    Ticket.countDocuments = () => Promise.resolve(0);

    try {
      await ticketService.getTickets(orgA, technicianUser);
      assert.strictEqual(capturedFilter.organizationId.toString(), orgA.toString());
      assert.ok(capturedFilter.$or);
      assert.deepStrictEqual(capturedFilter.$or[0], { departmentId: { $in: [deptIT.toString()] } });
      assert.deepStrictEqual(capturedFilter.$or[1], { assignedTo: technicianUser._id });
    } finally {
      Ticket.find = origFind;
      Ticket.countDocuments = origCount;
    }
  });

  await test('ticketService.getTickets scopes ASSET_MANAGER to own tickets, department, or linked assets', async () => {
    let capturedFilter = null;
    const origFind = Ticket.find;
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
    const origCount = Ticket.countDocuments;
    Ticket.countDocuments = () => Promise.resolve(0);

    try {
      await ticketService.getTickets(orgA, assetManagerUser);
      assert.strictEqual(capturedFilter.organizationId.toString(), orgA.toString());
      assert.ok(capturedFilter.$or);
      const orClauses = capturedFilter.$or;
      assert.ok(orClauses.some((c) => c.requesterId && c.requesterId.toString() === assetManagerUser._id.toString()));
      assert.ok(orClauses.some((c) => c.relatedAssetId));
      assert.ok(orClauses.some((c) => c.departmentId));
    } finally {
      Ticket.find = origFind;
      Ticket.countDocuments = origCount;
    }
  });

  await test('ticketService.getTickets allows IT_MANAGER and SYSTEM_ADMIN organization-wide view', async () => {
    let capturedAdminFilter = null;
    let capturedManagerFilter = null;
    const origFind = Ticket.find;
    Ticket.find = (filter) => {
      if (!capturedAdminFilter) capturedAdminFilter = filter;
      else capturedManagerFilter = filter;
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
    const origCount = Ticket.countDocuments;
    Ticket.countDocuments = () => Promise.resolve(0);

    try {
      await ticketService.getTickets(orgA, systemAdminUser);
      await ticketService.getTickets(orgA, itManagerUser);

      // No requesterId or department $or restrictions applied
      assert.strictEqual(capturedAdminFilter.organizationId.toString(), orgA.toString());
      assert.strictEqual(capturedAdminFilter.requesterId, undefined);
      assert.strictEqual(capturedAdminFilter.$or, undefined);

      assert.strictEqual(capturedManagerFilter.organizationId.toString(), orgA.toString());
      assert.strictEqual(capturedManagerFilter.requesterId, undefined);
      assert.strictEqual(capturedManagerFilter.$or, undefined);
    } finally {
      Ticket.find = origFind;
      Ticket.countDocuments = origCount;
    }
  });

  await test('ticketService.getTicketById denies EMPLOYEE from viewing another user ticket', async () => {
    const otherTicket = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      requesterId: { _id: new mongoose.Types.ObjectId() },
      departmentId: deptIT,
    };

    const origFindOne = Ticket.findOne;
    Ticket.findOne = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: () => ({
                      populate: () => Promise.resolve(otherTicket),
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
      await ticketService.getTicketById(orgA, otherTicket._id, employeeUser);
      assert.fail('Should have thrown 403');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'You do not have permission to view this ticket');
    } finally {
      Ticket.findOne = origFindOne;
    }
  });

  await test('ticketService.getTicketById denies TECHNICIAN from viewing ticket in unauthorized department', async () => {
    const hrTicket = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      requesterId: { _id: employeeUser._id },
      departmentId: { _id: deptHR }, // HR department, technician is only assigned to IT
      assignedTo: null,
    };

    const origFindOne = Ticket.findOne;
    Ticket.findOne = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: () => ({
                      populate: () => Promise.resolve(hrTicket),
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
      await ticketService.getTicketById(orgA, hrTicket._id, technicianUser);
      assert.fail('Should have thrown 403');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'You do not have permission to view tickets in this department');
    } finally {
      Ticket.findOne = origFindOne;
    }
  });

  // --------------------------------------------------------------------------
  // MODULE 5: TICKET ASSIGNMENT & LIFECYCLE RESTRICTIONS
  // --------------------------------------------------------------------------
  console.log('--- 5. Ticket Assignment & Lifecycle RBAC ---');

  await test('Ticket assignment route middleware restricts assignTicket to TECHNICIAN, IT_MANAGER, SYSTEM_ADMIN', async () => {
    const mw = authorize('TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN');

    // Technical roles permitted
    for (const user of [systemAdminUser, itManagerUser, technicianUser]) {
      let errReceived = null;
      mw({ user }, {}, (err) => { errReceived = err; });
      assert.strictEqual(errReceived, undefined);
    }

    // EMPLOYEE: Denied (403)
    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);

    // ASSET_MANAGER: Denied (403)
    let assetErr = null;
    mw({ user: assetManagerUser }, {}, (err) => { assetErr = err; });
    assert.ok(assetErr);
    assert.strictEqual(assetErr.statusCode, 403);
  });

  await test('ticketService.changeTicketStatus denies non-technical roles from directly resolving tickets', async () => {
    const ticketDoc = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      requesterId: employeeUser._id,
      departmentId: deptIT,
      status: 'OPEN',
      save: async () => {},
    };

    const origFindOne = Ticket.findOne;
    Ticket.findOne = () => Promise.resolve(ticketDoc);

    try {
      await ticketService.changeTicketStatus(
        orgA,
        ticketDoc._id,
        { status: 'RESOLVED', resolutionNotes: 'Fixed' },
        employeeUser
      );
      assert.fail('Should have thrown 403');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
    } finally {
      Ticket.findOne = origFindOne;
    }
  });

  // --------------------------------------------------------------------------
  // MODULE 6: INTERNAL NOTES & ATTACHMENT PRIVACY
  // --------------------------------------------------------------------------
  console.log('--- 6. Internal Notes & Attachment Privacy RBAC ---');

  await test('commentService.addComment strictly blocks EMPLOYEE and ASSET_MANAGER from creating internal notes', async () => {
    const ticketDoc = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      requesterId: employeeUser._id,
      departmentId: deptIT,
    };

    const origFindOne = Ticket.findOne;
    Ticket.findOne = () => Promise.resolve(ticketDoc);

    // EMPLOYEE blocked
    try {
      await commentService.addComment(
        orgA,
        ticketDoc._id,
        { content: 'Internal note', isInternal: true },
        [],
        employeeUser
      );
      assert.fail('Should have thrown 403 for EMPLOYEE');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'Employees are not permitted to create internal notes');
    }

    // ASSET_MANAGER blocked
    const assetMgrTicket = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      requesterId: assetManagerUser._id,
      departmentId: deptProcurement,
    };
    Ticket.findOne = () => Promise.resolve(assetMgrTicket);

    try {
      await commentService.addComment(
        orgA,
        assetMgrTicket._id,
        { content: 'Asset manager confidential', isInternal: true },
        [],
        assetManagerUser
      );
      assert.fail('Should have thrown 403 for ASSET_MANAGER');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'You are not permitted to create internal notes');
    } finally {
      Ticket.findOne = origFindOne;
    }
  });

  await test('commentService.getComments strictly filters out internal notes for non-technical roles', async () => {
    let capturedFilter = null;
    const origFindOne = Ticket.findOne;
    Ticket.findOne = () => Promise.resolve({
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgA,
      requesterId: employeeUser._id,
      departmentId: deptIT,
      relatedAssetId: new mongoose.Types.ObjectId(), // Permits asset manager ticket inspection
    });

    const origCommentFind = TicketComment.find;
    TicketComment.find = (filter) => {
      capturedFilter = filter;
      return {
        populate: () => ({
          sort: () => Promise.resolve([]),
        }),
      };
    };

    try {
      // 1. Employee query
      await commentService.getComments(orgA, new mongoose.Types.ObjectId(), employeeUser);
      assert.strictEqual(capturedFilter.isInternal, false);

      // 2. Asset Manager query
      await commentService.getComments(orgA, new mongoose.Types.ObjectId(), assetManagerUser);
      assert.strictEqual(capturedFilter.isInternal, false);

      // 3. Technician query includes internal notes
      await commentService.getComments(orgA, new mongoose.Types.ObjectId(), technicianUser);
      assert.strictEqual(capturedFilter.isInternal, undefined);

      // 4. IT Manager query includes internal notes
      await commentService.getComments(orgA, new mongoose.Types.ObjectId(), itManagerUser);
      assert.strictEqual(capturedFilter.isInternal, undefined);
    } finally {
      Ticket.findOne = origFindOne;
      TicketComment.find = origCommentFind;
    }
  });

  // --------------------------------------------------------------------------
  // MODULE 7: WORK LOGS RBAC
  // --------------------------------------------------------------------------
  console.log('--- 7. Technician Work Logs RBAC (/api/tickets/:id/work-logs) ---');

  await test('Work log route middleware restricts work logs to TECHNICIAN, IT_MANAGER, SYSTEM_ADMIN', async () => {
    const mw = authorize('TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN');

    // Technical roles permitted
    for (const user of [systemAdminUser, itManagerUser, technicianUser]) {
      let errReceived = null;
      mw({ user }, {}, (err) => { errReceived = err; });
      assert.strictEqual(errReceived, undefined);
    }

    // EMPLOYEE: Denied (403)
    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);

    // ASSET_MANAGER: Denied (403)
    let assetErr = null;
    mw({ user: assetManagerUser }, {}, (err) => { assetErr = err; });
    assert.ok(assetErr);
    assert.strictEqual(assetErr.statusCode, 403);
  });

  await test('workLogService.createWorkLog strictly rejects EMPLOYEE and ASSET_MANAGER at service layer', async () => {
    // EMPLOYEE: Throws 403
    try {
      await workLogService.createWorkLog(
        orgA,
        new mongoose.Types.ObjectId(),
        { timeSpentMinutes: 30, description: 'Fix' },
        employeeUser
      );
      assert.fail('Should have thrown 403 for EMPLOYEE');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.ok(err.message.includes('Employees are not permitted'));
    }

    // ASSET_MANAGER: Throws 403
    try {
      await workLogService.createWorkLog(
        orgA,
        new mongoose.Types.ObjectId(),
        { timeSpentMinutes: 30, description: 'Inventory check' },
        assetManagerUser
      );
      assert.fail('Should have thrown 403 for ASSET_MANAGER');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.message, 'Only technical support personnel are permitted to access or log technician work');
    }
  });

  // --------------------------------------------------------------------------
  // MODULE 8: KNOWLEDGE BASE RBAC
  // --------------------------------------------------------------------------
  console.log('--- 8. Knowledge Base RBAC (/api/knowledge-base) ---');

  await test('Knowledge Base authoring route middleware permits TECHNICIAN, IT_MANAGER, SYSTEM_ADMIN, rejects EMPLOYEE and ASSET_MANAGER', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN');

    for (const user of [systemAdminUser, itManagerUser, technicianUser]) {
      let errReceived = null;
      mw({ user }, {}, (err) => { errReceived = err; });
      assert.strictEqual(errReceived, undefined);
    }

    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);

    let assetErr = null;
    mw({ user: assetManagerUser }, {}, (err) => { assetErr = err; });
    assert.ok(assetErr);
    assert.strictEqual(assetErr.statusCode, 403);
  });

  await test('Knowledge Base article deletion is strictly restricted to SYSTEM_ADMIN and IT_MANAGER', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'IT_MANAGER');

    for (const user of [systemAdminUser, itManagerUser]) {
      let errReceived = null;
      mw({ user }, {}, (err) => { errReceived = err; });
      assert.strictEqual(errReceived, undefined);
    }

    // TECHNICIAN: Denied (403)
    let techErr = null;
    mw({ user: technicianUser }, {}, (err) => { techErr = err; });
    assert.ok(techErr);
    assert.strictEqual(techErr.statusCode, 403);

    // ASSET_MANAGER: Denied (403)
    let assetErr = null;
    mw({ user: assetManagerUser }, {}, (err) => { assetErr = err; });
    assert.ok(assetErr);
    assert.strictEqual(assetErr.statusCode, 403);

    // EMPLOYEE: Denied (403)
    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => { empErr = err; });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);
  });

  await test('knowledgeArticleService.getArticles restricts EMPLOYEE and ASSET_MANAGER to PUBLISHED and PUBLIC articles', async () => {
    let capturedFilter = null;
    const origFind = KnowledgeArticle.find;
    KnowledgeArticle.find = (filter) => {
      capturedFilter = filter;
      return {
        populate: () => ({
          populate: () => ({
            populate: () => ({
              select: () => ({
                sort: () => ({
                  skip: () => ({
                    limit: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    };
    const origCount = KnowledgeArticle.countDocuments;
    KnowledgeArticle.countDocuments = () => Promise.resolve(0);

    try {
      // 1. EMPLOYEE query
      await knowledgeArticleService.getArticles(orgA, employeeUser);
      assert.strictEqual(capturedFilter.status, 'PUBLISHED');
      assert.strictEqual(capturedFilter.visibility, 'PUBLIC');

      // 2. ASSET_MANAGER query
      await knowledgeArticleService.getArticles(orgA, assetManagerUser);
      assert.strictEqual(capturedFilter.status, 'PUBLISHED');
      assert.strictEqual(capturedFilter.visibility, 'PUBLIC');

      // 3. TECHNICIAN query can inspect drafts
      await knowledgeArticleService.getArticles(orgA, technicianUser, { status: 'DRAFT' });
      assert.strictEqual(capturedFilter.status, 'DRAFT');
    } finally {
      KnowledgeArticle.find = origFind;
      KnowledgeArticle.countDocuments = origCount;
    }
  });

  await test('knowledgeArticleService.getArticleByIdOrSlug denies non-technical users from viewing draft or internal articles', async () => {
    const draftArticle = {
      _id: new mongoose.Types.ObjectId(),
      slug: 'internal-runbook',
      status: 'DRAFT',
      visibility: 'INTERNAL_ONLY',
      save: async () => {},
    };

    const origFindOne = KnowledgeArticle.findOne;
    KnowledgeArticle.findOne = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => Promise.resolve(draftArticle),
        }),
      }),
    });

    try {
      // Employee: 403
      try {
        await knowledgeArticleService.getArticleByIdOrSlug(orgA, draftArticle.slug, employeeUser);
        assert.fail('Should have thrown 403 for EMPLOYEE');
      } catch (err) {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.message, 'You do not have permission to view this article');
      }

      // Asset Manager: 403
      try {
        await knowledgeArticleService.getArticleByIdOrSlug(orgA, draftArticle.slug, assetManagerUser);
        assert.fail('Should have thrown 403 for ASSET_MANAGER');
      } catch (err) {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.message, 'You do not have permission to view this article');
      }

      // Technician: Permitted
      const techResult = await knowledgeArticleService.getArticleByIdOrSlug(orgA, draftArticle.slug, technicianUser);
      assert.strictEqual(techResult.slug, 'internal-runbook');
    } finally {
      KnowledgeArticle.findOne = origFindOne;
    }
  });

  // --------------------------------------------------------------------------
  // MODULE 9: CROSS-ORGANIZATION MULTI-TENANT BOUNDARY
  // --------------------------------------------------------------------------
  console.log('--- 9. Cross-Organization Multi-Tenant Boundary ---');

  await test('hasDepartmentAccess strictly blocks cross-tenant access regardless of user role', async () => {
    // externalUser has SYSTEM_ADMIN role in orgB
    const hasAccessToOrgA = hasDepartmentAccess(externalUser, deptIT, orgA);
    assert.strictEqual(hasAccessToOrgA, false);

    // systemAdminUser in orgA cannot access resources in orgB
    const adminAccessToOrgB = hasDepartmentAccess(systemAdminUser, deptIT, orgB);
    assert.strictEqual(adminAccessToOrgB, false);
  });

  console.log(`\nRBAC Phase 1 Tests Completed: ${passed}/${passed + failed} passed.`);
  if (failed > 0) {
    process.exit(1);
  }
};

runRbacTestSuite();
