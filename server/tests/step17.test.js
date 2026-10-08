const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../src/models/User');
const { signToken, verifyToken, generateToken } = require('../src/utils/jwt');
const auth = require('../src/middleware/auth');
const authorize = require('../src/middleware/authorize');
const {
  hasDepartmentAccess,
  getAllowedDepartmentIds,
  requireDepartmentAccess,
} = require('../src/utils/departmentAccess');
const { login, getMe } = require('../src/controllers/authController');
const AppError = require('../src/utils/AppError');

// Ensure a test JWT_SECRET is set
const TEST_SECRET = 'test_secret_key_for_unit_tests_only_32_characters_long';
process.env.JWT_SECRET = TEST_SECRET;
process.env.JWT_EXPIRES_IN = '1h';

// Helper to mock Express req, res, next
const createMockReqRes = ({ body = {}, headers = {}, params = {}, query = {}, user = null } = {}) => {
  const req = { body, headers, params, query, user };
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

async function runStep17Tests() {
  console.log('=== ServiceDesk Pro Step 17 Test Suite ===\n');
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

  const originalFindOne = User.findOne;
  const originalFindById = User.findById;

  // ==========================================
  // 1. LOGIN TESTS
  // ==========================================
  console.log('--- 1. Login Controller Tests ---');

  await test('Login fails when email is missing (400)', async () => {
    const { req, res, next, getError } = createMockReqRes({
      body: { password: 'password123' },
    });
    await login(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.message, 'Please provide email and password');
  });

  await test('Login fails when password is missing (400)', async () => {
    const { req, res, next, getError } = createMockReqRes({
      body: { email: 'user@example.com' },
    });
    await login(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.message, 'Please provide email and password');
  });

  await test('Login fails with generic 401 when user not found', async () => {
    User.findOne = () => ({
      select: () => Promise.resolve(null),
    });

    const { req, res, next, getError } = createMockReqRes({
      body: { email: 'nonexistent@example.com', password: 'password123' },
    });
    await login(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Invalid email or password');
  });

  await test('Login fails with generic 401 when password does not match', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'user@example.com',
      password: '$2b$10$hashedpassword',
      isActive: true,
      comparePassword: async () => false, // Password mismatch
    };

    User.findOne = () => ({
      select: () => Promise.resolve(mockUser),
    });

    const { req, res, next, getError } = createMockReqRes({
      body: { email: 'user@example.com', password: 'WrongPassword' },
    });
    await login(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Invalid email or password');
  });

  await test('Login fails with 401 when user account is inactive', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'inactive@example.com',
      isActive: false, // Inactive
      comparePassword: async () => true,
    };

    User.findOne = () => ({
      select: () => Promise.resolve(mockUser),
    });

    const { req, res, next, getError } = createMockReqRes({
      body: { email: 'inactive@example.com', password: 'ValidPassword123!' },
    });
    await login(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'User account is inactive');
  });

  await test('Login succeeds with valid credentials, updates lastLoginAt, returns token & safe user', async () => {
    let saveCalled = false;
    const userId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();
    const deptId = new mongoose.Types.ObjectId();

    const mockUser = {
      _id: userId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      role: 'IT_MANAGER',
      organizationId: orgId,
      departmentId: deptId,
      assignedDepartments: [],
      isActive: true,
      password: '$2b$10$hashedpassword',
      lastLoginAt: null,
      comparePassword: async (pwd) => pwd === 'CorrectPassword123!',
      save: async function () {
        saveCalled = true;
      },
    };

    let queriedEmail = null;
    User.findOne = (query) => {
      queriedEmail = query.email;
      return {
        select: (proj) => {
          assert.strictEqual(proj, '+password');
          return Promise.resolve(mockUser);
        },
      };
    };

    // Test with mixed-case and untrimmed email
    const { req, res, next, getError } = createMockReqRes({
      body: { email: '  JoHn.DoE@ExAmPlE.cOm  ', password: 'CorrectPassword123!' },
    });
    await login(req, res, next);
    const err = getError();

    assert.strictEqual(err, null, 'Login should succeed without error');
    assert.strictEqual(queriedEmail, 'john.doe@example.com', 'Email must be normalized to lowercase & trimmed');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Token must be returned');
    assert.ok(saveCalled, 'lastLoginAt must be saved');
    assert.ok(mockUser.lastLoginAt instanceof Date, 'lastLoginAt must be updated with Date');

    // Verify token validity and sub claim
    const decoded = verifyToken(res.body.token);
    assert.strictEqual(decoded.sub, userId.toString());
    assert.strictEqual(decoded.id, userId.toString());

    // Verify safe user profile (never expose password)
    assert.strictEqual(res.body.user._id.toString(), userId.toString());
    assert.strictEqual(res.body.user.email, 'john.doe@example.com');
    assert.strictEqual(res.body.user.role, 'IT_MANAGER');
    assert.strictEqual(res.body.user.password, undefined, 'Password must never be returned');
  });

  // ==========================================
  // 2. GET /ME ENDPOINT TESTS
  // ==========================================
  console.log('\n--- 2. GET /api/auth/me Tests ---');

  await test('/me returns current user from req.user', async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'tech@example.com',
      role: 'TECHNICIAN',
    };
    const { req, res, next, getError } = createMockReqRes({ user: mockUser });
    await getMe(req, res, next);

    assert.strictEqual(getError(), null);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.email, 'tech@example.com');
  });

  await test('Full /me pipeline rejects request with missing token (401)', async () => {
    const { req, res, next, getError } = createMockReqRes({ headers: {} });
    await auth(req, res, next);
    assert.strictEqual(getError().statusCode, 401);
    assert.strictEqual(getError().message, 'Authentication token is required');
  });

  await test('Full /me pipeline rejects request with invalid token (401)', async () => {
    const { req, res, next, getError } = createMockReqRes({
      headers: { authorization: 'Bearer invalid.token.payload' },
    });
    await auth(req, res, next);
    assert.strictEqual(getError().statusCode, 401);
    assert.strictEqual(getError().message, 'Invalid authentication token');
  });

  await test('Full /me pipeline rejects expired token (401)', async () => {
    const expiredToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), iat: Math.floor(Date.now() / 1000) - 100 },
      TEST_SECRET,
      { expiresIn: '10s' }
    );
    const { req, res, next, getError } = createMockReqRes({
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    await auth(req, res, next);
    assert.strictEqual(getError().statusCode, 401);
    assert.strictEqual(getError().message, 'Authentication token has expired');
  });

  await test('Full /me pipeline succeeds with valid token and loads user', async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = generateToken(userId.toString());
    const dbUser = {
      _id: userId,
      email: 'admin@example.com',
      role: 'SYSTEM_ADMIN',
      isActive: true,
    };

    User.findById = () => ({
      select: () => Promise.resolve(dbUser),
    });

    const { req, res, next, getError } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });

    // Run auth middleware then getMe
    await auth(req, res, (err) => {
      if (err) return next(err);
      getMe(req, res, next);
    });

    assert.strictEqual(getError(), null);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'SYSTEM_ADMIN');
  });

  // ==========================================
  // 3. ROLE-BASED AUTHORIZATION TESTS
  // ==========================================
  console.log('\n--- 3. Role Authorization (authorize) Tests ---');

  const ALL_ROLES = ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'];

  await test('authorize fails with 401 if req.user is missing', async () => {
    const middleware = authorize('SYSTEM_ADMIN');
    const { req, res, next, getError } = createMockReqRes({ user: null });
    middleware(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Authentication required');
  });

  await test('authorize fails with 403 when user role is not permitted', async () => {
    const middleware = authorize('SYSTEM_ADMIN', 'IT_MANAGER');
    const { req, res, next, getError } = createMockReqRes({
      user: { role: 'EMPLOYEE' },
    });
    middleware(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.message, 'You do not have permission to perform this action');
  });

  await test('authorize passes when user has one of the allowed roles', async () => {
    for (const role of ALL_ROLES) {
      const middleware = authorize(role);
      const { req, res, next, getError } = createMockReqRes({
        user: { role },
      });
      middleware(req, res, next);
      assert.strictEqual(getError(), null, `Role ${role} should be authorized`);
    }
  });

  await test('authorize supports multiple allowed roles', async () => {
    const middleware = authorize('TECHNICIAN', 'IT_MANAGER');
    const { req: req1, res: res1, next: next1, getError: getError1 } = createMockReqRes({
      user: { role: 'TECHNICIAN' },
    });
    middleware(req1, res1, next1);
    assert.strictEqual(getError1(), null);

    const { req: req2, res: res2, next: next2, getError: getError2 } = createMockReqRes({
      user: { role: 'ASSET_MANAGER' },
    });
    middleware(req2, res2, next2);
    assert.strictEqual(getError2().statusCode, 403);
  });

  // ==========================================
  // 4. DEPARTMENT ACCESS HELPER TESTS
  // ==========================================
  console.log('\n--- 4. Department Access Helper Tests ---');

  const orgA = new mongoose.Types.ObjectId();
  const orgB = new mongoose.Types.ObjectId();
  const deptA1 = new mongoose.Types.ObjectId();
  const deptA2 = new mongoose.Types.ObjectId();
  const deptA3 = new mongoose.Types.ObjectId();

  await test('Rejects cross-tenant access regardless of role (multi-tenant boundary)', () => {
    const adminUser = {
      role: 'SYSTEM_ADMIN',
      organizationId: orgA,
    };
    // Attempting to access resource in orgB
    const hasAccess = hasDepartmentAccess(adminUser, deptA1, orgB);
    assert.strictEqual(hasAccess, false, 'Cross-org access must always return false');
  });

  await test('SYSTEM_ADMIN and IT_MANAGER have access to all departments in their org', () => {
    const sysAdmin = { role: 'SYSTEM_ADMIN', organizationId: orgA };
    const itManager = { role: 'IT_MANAGER', organizationId: orgA };

    assert.strictEqual(hasDepartmentAccess(sysAdmin, deptA1, orgA), true);
    assert.strictEqual(hasDepartmentAccess(sysAdmin, deptA2, orgA), true);
    assert.strictEqual(hasDepartmentAccess(itManager, deptA1, orgA), true);
    assert.strictEqual(hasDepartmentAccess(itManager, deptA3, orgA), true);

    assert.strictEqual(getAllowedDepartmentIds(sysAdmin), null);
    assert.strictEqual(getAllowedDepartmentIds(itManager), null);
  });

  await test('TECHNICIAN has access to primary department and assignedDepartments only', () => {
    const tech = {
      role: 'TECHNICIAN',
      organizationId: orgA,
      departmentId: deptA1,
      assignedDepartments: [deptA2],
    };

    // Primary department
    assert.strictEqual(hasDepartmentAccess(tech, deptA1, orgA), true);
    // Assigned department
    assert.strictEqual(hasDepartmentAccess(tech, deptA2, orgA), true);
    // Unassigned department
    assert.strictEqual(hasDepartmentAccess(tech, deptA3, orgA), false);

    const allowed = getAllowedDepartmentIds(tech);
    assert.deepStrictEqual(allowed.sort(), [deptA1.toString(), deptA2.toString()].sort());
  });

  await test('EMPLOYEE has access to primary department only', () => {
    const employee = {
      role: 'EMPLOYEE',
      organizationId: orgA,
      departmentId: deptA1,
      assignedDepartments: [],
    };

    assert.strictEqual(hasDepartmentAccess(employee, deptA1, orgA), true);
    assert.strictEqual(hasDepartmentAccess(employee, deptA2, orgA), false);
  });

  await test('requireDepartmentAccess middleware denies unauthorized department with 403', () => {
    const middleware = requireDepartmentAccess('deptId', 'orgId');
    const { req, res, next, getError } = createMockReqRes({
      user: {
        role: 'EMPLOYEE',
        organizationId: orgA,
        departmentId: deptA1,
        assignedDepartments: [],
      },
      params: { deptId: deptA2.toString(), orgId: orgA.toString() },
    });
    middleware(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(
      err.message,
      'You do not have permission to access resources in this department'
    );
  });

  await test('requireDepartmentAccess middleware permits authorized department', () => {
    const middleware = requireDepartmentAccess('deptId', 'orgId');
    const { req, res, next, getError } = createMockReqRes({
      user: {
        role: 'TECHNICIAN',
        organizationId: orgA,
        departmentId: deptA1,
        assignedDepartments: [deptA2],
      },
      params: { deptId: deptA2.toString(), orgId: orgA.toString() },
    });
    middleware(req, res, next);
    assert.strictEqual(getError(), null);
  });

  // Restore User methods
  User.findOne = originalFindOne;
  User.findById = originalFindById;

  console.log(`\nStep 17 Tests Completed: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runStep17Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
