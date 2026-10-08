const assert = require('assert');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Department = require('../src/models/Department');
const AuditLog = require('../src/models/AuditLog');
const userService = require('../src/services/userService');
const userController = require('../src/controllers/userController');
const authorize = require('../src/middleware/authorize');
const AppError = require('../src/utils/AppError');

// Mock IDs
const orgA = new mongoose.Types.ObjectId();
const orgB = new mongoose.Types.ObjectId();
const deptIT = new mongoose.Types.ObjectId();
const deptHR = new mongoose.Types.ObjectId();

const adminUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@org-a.com',
  role: 'SYSTEM_ADMIN',
  organizationId: orgA,
  departmentId: deptIT,
  isActive: true,
};

const secondAdmin = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Second',
  lastName: 'Admin',
  email: 'admin2@org-a.com',
  role: 'SYSTEM_ADMIN',
  organizationId: orgA,
  departmentId: deptIT,
  isActive: true,
};

const employeeUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Alice',
  lastName: 'Employee',
  email: 'alice@org-a.com',
  role: 'EMPLOYEE',
  organizationId: orgA,
  departmentId: deptIT,
  isActive: true,
};

const technicianUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Bob',
  lastName: 'Tech',
  email: 'bob@org-a.com',
  role: 'TECHNICIAN',
  organizationId: orgA,
  departmentId: deptIT,
  isActive: true,
};

const itManagerUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Carol',
  lastName: 'Manager',
  email: 'carol@org-a.com',
  role: 'IT_MANAGER',
  organizationId: orgA,
  departmentId: deptIT,
  isActive: true,
};

// Express mock helper
const createMockReqRes = ({ body = {}, headers = {}, params = {}, query = {}, user = adminUser } = {}) => {
  const req = { body, headers, params, query, user, ip: '127.0.0.1' };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  let errorPassed = null;
  const next = (err) => {
    errorPassed = err || null;
  };
  return { req, res, next, getError: () => errorPassed };
};

async function runUserManagementTests() {
  console.log('=== ServiceDesk Pro User Management Test Suite ===\n');
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

  let capturedAuditLogs = [];
  AuditLog.create = (doc) => {
    capturedAuditLogs.push(doc);
    return Promise.resolve(doc);
  };

  // 1. Role Authorization Tests
  console.log('--- 1. RBAC & Route Authorization Tests ---');

  await test('authorize middleware rejects EMPLOYEE, TECHNICIAN, and IT_MANAGER from user management', () => {
    const authMiddleware = authorize('SYSTEM_ADMIN');

    // EMPLOYEE
    const { req: reqEmp, res: resEmp, next: nextEmp, getError: getErrEmp } = createMockReqRes({ user: employeeUser });
    authMiddleware(reqEmp, resEmp, nextEmp);
    assert.ok(getErrEmp() instanceof AppError);
    assert.strictEqual(getErrEmp().statusCode, 403);

    // TECHNICIAN
    const { req: reqTech, res: resTech, next: nextTech, getError: getErrTech } = createMockReqRes({ user: technicianUser });
    authMiddleware(reqTech, resTech, nextTech);
    assert.strictEqual(getErrTech()?.statusCode, 403);

    // IT_MANAGER
    const { req: reqMgr, res: resMgr, next: nextMgr, getError: getErrMgr } = createMockReqRes({ user: itManagerUser });
    authMiddleware(reqMgr, resMgr, nextMgr);
    assert.strictEqual(getErrMgr()?.statusCode, 403);

    // SYSTEM_ADMIN passes
    const { req: reqAdm, res: resAdm, next: nextAdm, getError: getErrAdm } = createMockReqRes({ user: adminUser });
    authMiddleware(reqAdm, resAdm, nextAdm);
    assert.strictEqual(getErrAdm(), null);
  });

  // 2. User Listing & Filters Tests
  console.log('--- 2. User Listing & Filter Tests ---');

  await test('userService.getUsers applies organization boundary and pagination', async () => {
    let capturedFilter = null;
    let capturedSkip = null;
    let capturedLimit = null;

    User.find = (f) => {
      capturedFilter = f;
      return {
        select: () => ({
          populate: () => ({
            populate: () => ({
              sort: () => ({
                skip: (s) => {
                  capturedSkip = s;
                  return {
                    limit: (l) => {
                      capturedLimit = l;
                      return {
                        lean: () => Promise.resolve([employeeUser, technicianUser]),
                      };
                    },
                  };
                },
              }),
            }),
          }),
        }),
      };
    };
    User.countDocuments = (f) => Promise.resolve(25);

    const res = await userService.getUsers(orgA, { page: '2', limit: '10' });

    assert.strictEqual(capturedFilter.organizationId.toString(), orgA.toString());
    assert.strictEqual(capturedSkip, 10);
    assert.strictEqual(capturedLimit, 10);
    assert.strictEqual(res.pagination.page, 2);
    assert.strictEqual(res.pagination.total, 25);
    assert.strictEqual(res.pagination.totalPages, 3);
    assert.strictEqual(res.users.length, 2);
  });

  await test('userService.getUsers filters by role, departmentId, and status', async () => {
    let capturedFilter = null;
    User.find = (f) => {
      capturedFilter = f;
      return {
        select: () => ({
          populate: () => ({
            populate: () => ({
              sort: () => ({
                skip: () => ({
                  limit: () => ({
                    lean: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    };
    User.countDocuments = () => Promise.resolve(0);

    await userService.getUsers(orgA, {
      role: 'TECHNICIAN',
      departmentId: deptIT.toString(),
      status: 'active',
      search: 'John Doe',
    });

    assert.strictEqual(capturedFilter.organizationId.toString(), orgA.toString());
    assert.strictEqual(capturedFilter.role, 'TECHNICIAN');
    assert.strictEqual(capturedFilter.departmentId, deptIT.toString());
    assert.strictEqual(capturedFilter.isActive, true);
    assert.ok(capturedFilter.$or);
    assert.strictEqual(capturedFilter.$or.length, 4);
  });

  // 3. User Creation Tests
  console.log('--- 3. User Creation Tests ---');

  await test('userService.createUser validates required fields and email regex', async () => {
    await assert.rejects(
      () => userService.createUser(orgA, { firstName: '', lastName: 'Test', email: 'test@example.com' }, adminUser),
      /First name is required/
    );

    await assert.rejects(
      () => userService.createUser(orgA, { firstName: 'Test', lastName: 'Test', email: 'not-an-email', password: 'password123', role: 'EMPLOYEE', departmentId: deptIT }, adminUser),
      /valid email address/
    );

    await assert.rejects(
      () => userService.createUser(orgA, { firstName: 'Test', lastName: 'Test', email: 'test@example.com', password: 'short', role: 'EMPLOYEE', departmentId: deptIT }, adminUser),
      /at least 8 characters/
    );

    await assert.rejects(
      () => userService.createUser(orgA, { firstName: 'Test', lastName: 'Test', email: 'test@example.com', password: 'password123', role: 'SUPER_USER', departmentId: deptIT }, adminUser),
      /Invalid role/
    );
  });

  await test('userService.createUser rejects duplicate email address with 400', async () => {
    User.findOne = (query) => {
      if (query.email === 'existing@example.com') {
        return Promise.resolve({ _id: new mongoose.Types.ObjectId(), email: 'existing@example.com' });
      }
      return Promise.resolve(null);
    };

    await assert.rejects(
      () =>
        userService.createUser(
          orgA,
          {
            firstName: 'Dave',
            lastName: 'Duplicate',
            email: 'existing@example.com',
            password: 'Password123!',
            role: 'EMPLOYEE',
            departmentId: deptIT,
          },
          adminUser
        ),
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('already exists'));
        return true;
      }
    );
  });

  await test('userService.createUser rejects department belonging to another organization', async () => {
    User.findOne = () => Promise.resolve(null);
    Department.findOne = () => Promise.resolve(null); // Not found in orgA

    await assert.rejects(
      () =>
        userService.createUser(
          orgA,
          {
            firstName: 'Dave',
            lastName: 'Dept',
            email: 'dave@example.com',
            password: 'Password123!',
            role: 'EMPLOYEE',
            departmentId: deptHR,
          },
          adminUser
        ),
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Department not found'));
        return true;
      }
    );
  });

  await test('userService.createUser successfully creates user and creates audit log', async () => {
    capturedAuditLogs = [];
    User.findOne = (q) => {
      if (q._id) {
        return {
          select: () => ({
            populate: () => ({
              populate: () =>
                Promise.resolve({
                  _id: q._id,
                  firstName: 'New',
                  lastName: 'Member',
                  email: 'new@example.com',
                  role: 'TECHNICIAN',
                  departmentId: { _id: deptIT, name: 'IT Support' },
                  isActive: true,
                }),
            }),
          }),
        };
      }
      return Promise.resolve(null); // No duplicate email
    };

    Department.findOne = (q) => Promise.resolve({ _id: q._id, name: 'IT Support', organizationId: orgA, isActive: true });

    let createdDoc = null;
    User.create = (doc) => {
      createdDoc = doc;
      return Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc });
    };

    const createdUser = await userService.createUser(
      orgA,
      {
        firstName: 'New',
        lastName: 'Member',
        email: 'new@example.com',
        password: 'SecurePassword123!',
        role: 'TECHNICIAN',
        departmentId: deptIT,
        phone: '+1 555-0199',
        jobTitle: 'Support Specialist',
      },
      adminUser
    );

    assert.strictEqual(createdDoc.email, 'new@example.com');
    assert.strictEqual(createdDoc.role, 'TECHNICIAN');
    assert.strictEqual(createdDoc.jobTitle, 'Support Specialist');
    assert.strictEqual(createdUser.email, 'new@example.com');
    assert.strictEqual(capturedAuditLogs.length, 1);
    assert.strictEqual(capturedAuditLogs[0].action, 'USER_CREATED');
  });

  // 4. User Update & Demotion Protection Tests
  console.log('--- 4. User Update & Protection Tests ---');

  await test('userService.updateUser prevents demoting the last active SYSTEM_ADMIN', async () => {
    const targetAdminId = new mongoose.Types.ObjectId();
    const targetAdminUser = {
      _id: targetAdminId,
      organizationId: orgA,
      role: 'SYSTEM_ADMIN',
      isActive: true,
      departmentId: deptIT,
      save: () => Promise.resolve(),
    };

    User.findOne = () => Promise.resolve(targetAdminUser);
    // Count other active admins: 0 other admins!
    User.countDocuments = () => Promise.resolve(0);

    await assert.rejects(
      () =>
        userService.updateUser(
          orgA,
          targetAdminId,
          { role: 'EMPLOYEE' },
          adminUser
        ),
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Cannot demote the last active SYSTEM_ADMIN'));
        return true;
      }
    );
  });

  await test('userService.updateUser permits demoting admin when another active SYSTEM_ADMIN exists', async () => {
    const targetAdminId = new mongoose.Types.ObjectId();
    let saved = false;
    const targetAdminUser = {
      _id: targetAdminId,
      organizationId: orgA,
      role: 'SYSTEM_ADMIN',
      isActive: true,
      departmentId: deptIT,
      save() {
        saved = true;
        return Promise.resolve(this);
      },
    };

    const makeChainable = (doc) => ({
      ...doc,
      select: () => ({
        populate: () => ({
          populate: () => Promise.resolve(doc),
        }),
      }),
      then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      catch: (reject) => Promise.resolve(doc).catch(reject),
    });

    User.findOne = () => makeChainable(targetAdminUser);
    // 1 other active admin exists
    User.countDocuments = () => Promise.resolve(1);

    const updated = await userService.updateUser(
      orgA,
      targetAdminId,
      { role: 'IT_MANAGER' },
      adminUser
    );

    assert.strictEqual(saved, true);
    assert.strictEqual(targetAdminUser.role, 'IT_MANAGER');
  });

  // 5. Deactivation & Reactivation Protection Tests
  console.log('--- 5. Deactivation & Reactivation Tests ---');

  await test('userService.setUserStatus prevents admin from deactivating their own account', async () => {
    const ownAdminDoc = {
      _id: adminUser._id,
      organizationId: orgA,
      role: 'SYSTEM_ADMIN',
      isActive: true,
    };
    User.findOne = () => Promise.resolve(ownAdminDoc);

    await assert.rejects(
      () => userService.setUserStatus(orgA, adminUser._id, false, adminUser),
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('cannot deactivate their own account'));
        return true;
      }
    );
  });

  await test('userService.setUserStatus prevents deactivating the last active SYSTEM_ADMIN', async () => {
    const otherAdminId = new mongoose.Types.ObjectId();
    const otherAdminDoc = {
      _id: otherAdminId,
      organizationId: orgA,
      role: 'SYSTEM_ADMIN',
      isActive: true,
    };
    User.findOne = () => Promise.resolve(otherAdminDoc);
    User.countDocuments = () => Promise.resolve(0); // 0 other active admins

    await assert.rejects(
      () => userService.setUserStatus(orgA, otherAdminId, false, adminUser),
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Cannot deactivate the last active SYSTEM_ADMIN'));
        return true;
      }
    );
  });

  await test('userService.setUserStatus successfully deactivates and reactivates a user', async () => {
    capturedAuditLogs = [];
    const targetUserId = new mongoose.Types.ObjectId();
    let savedStatus = true;
    const targetUserDoc = {
      _id: targetUserId,
      organizationId: orgA,
      role: 'EMPLOYEE',
      email: 'target@example.com',
      isActive: true,
      save() {
        savedStatus = this.isActive;
        return Promise.resolve(this);
      },
    };

    const makeChainable = (doc) => ({
      ...doc,
      select: () => ({
        populate: () => ({
          populate: () => Promise.resolve(doc),
        }),
      }),
      then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      catch: (reject) => Promise.resolve(doc).catch(reject),
    });

    User.findOne = () => makeChainable(targetUserDoc);

    // Deactivate
    await userService.setUserStatus(orgA, targetUserId, false, adminUser);
    assert.strictEqual(savedStatus, false);
    assert.strictEqual(capturedAuditLogs.length, 1);
    assert.strictEqual(capturedAuditLogs[0].action, 'USER_DEACTIVATED');

    // Reactivate
    await userService.setUserStatus(orgA, targetUserId, true, adminUser);
    assert.strictEqual(savedStatus, true);
    assert.strictEqual(capturedAuditLogs.length, 2);
    assert.strictEqual(capturedAuditLogs[1].action, 'USER_REACTIVATED');
  });

  // 6. Departments Listing
  console.log('--- 6. Departments Listing for Form Options ---');

  await test('userService.getDepartments retrieves active departments for org', async () => {
    let capturedOrg = null;
    Department.find = (f) => {
      capturedOrg = f.organizationId;
      return {
        select: () => ({
          sort: () => ({
            lean: () => Promise.resolve([{ _id: deptIT, name: 'IT' }, { _id: deptHR, name: 'HR' }]),
          }),
        }),
      };
    };

    const depts = await userService.getDepartments(orgA);
    assert.strictEqual(capturedOrg.toString(), orgA.toString());
    assert.strictEqual(depts.length, 2);
    assert.strictEqual(depts[0].name, 'IT');
  });

  console.log(`\nUser Management Tests Completed: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runUserManagementTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
