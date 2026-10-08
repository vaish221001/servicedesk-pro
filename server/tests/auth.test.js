const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { signToken, verifyToken, generateToken } = require('../src/utils/jwt');
const auth = require('../src/middleware/auth');
const User = require('../src/models/User');
const AppError = require('../src/utils/AppError');

// Ensure a test JWT_SECRET is set for running tests safely
const TEST_SECRET = 'test_secret_key_for_unit_tests_only_32_characters_long';
const originalJwtSecret = process.env.JWT_SECRET;
const originalJwtExpiresIn = process.env.JWT_EXPIRES_IN;
process.env.JWT_SECRET = TEST_SECRET;
process.env.JWT_EXPIRES_IN = '1h';

// Helper to create mock Express req, res, next
const createMockReqResNext = (headers = {}) => {
  const req = { headers };
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
  return { req, res, next: (err) => next(err), getError: () => errorPassed };
};

async function runAuthTests() {
  console.log('=== ServiceDesk Pro Auth Foundation Tests ===\n');
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

  // 1. JWT Utility Tests
  console.log('--- JWT Utility Tests ---');

  await test('signToken and verifyToken work with valid payload', async () => {
    const payload = { id: new mongoose.Types.ObjectId().toString(), role: 'EMPLOYEE' };
    const token = signToken(payload);
    assert.strictEqual(typeof token, 'string');

    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, payload.id);
    assert.strictEqual(decoded.role, payload.role);
  });

  await test('generateToken creates token with userId claim', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = generateToken(userId);
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, userId);
  });

  await test('signToken throws AppError(500) if JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    try {
      signToken({ id: '123' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err instanceof AppError, true);
      assert.strictEqual(err.statusCode, 500);
    } finally {
      process.env.JWT_SECRET = TEST_SECRET;
    }
  });

  await test('verifyToken throws AppError(500) if JWT_SECRET is missing', async () => {
    const token = signToken({ id: '123' });
    delete process.env.JWT_SECRET;
    try {
      verifyToken(token);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err instanceof AppError, true);
      assert.strictEqual(err.statusCode, 500);
    } finally {
      process.env.JWT_SECRET = TEST_SECRET;
    }
  });

  // 2. Auth Middleware Tests
  console.log('\n--- Auth Middleware Tests ---');

  await test('Rejects request with missing Authorization header (401)', async () => {
    const { req, res, next, getError } = createMockReqResNext({});
    await auth(req, res, next);
    const err = getError();
    assert.ok(err, 'Expected error to be passed to next');
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Authentication token is required');
  });

  await test('Rejects non-Bearer Authorization header scheme (401)', async () => {
    const { req, res, next, getError } = createMockReqResNext({
      authorization: 'Basic dXNlcjpwYXNz',
    });
    await auth(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Authentication token is required');
  });

  await test('Rejects empty Bearer token (401)', async () => {
    const { req, res, next, getError } = createMockReqResNext({
      authorization: 'Bearer ',
    });
    await auth(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Authentication token is required');
  });

  await test('Rejects malformed token (401)', async () => {
    const { req, res, next, getError } = createMockReqResNext({
      authorization: 'Bearer this.is.notavalidjwt',
    });
    await auth(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Invalid authentication token');
  });

  await test('Rejects token signed with an untrusted/different secret (401)', async () => {
    const forgedToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString() },
      'wrong_untrusted_secret_key'
    );
    const { req, res, next, getError } = createMockReqResNext({
      authorization: `Bearer ${forgedToken}`,
    });
    await auth(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Invalid authentication token');
  });

  await test('Rejects expired token (401)', async () => {
    // Generate token that expired 10 seconds ago
    const expiredToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), iat: Math.floor(Date.now() / 1000) - 60 },
      TEST_SECRET,
      { expiresIn: '10s' }
    );
    const { req, res, next, getError } = createMockReqResNext({
      authorization: `Bearer ${expiredToken}`,
    });
    await auth(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Authentication token has expired');
  });

  await test('Rejects token with invalid/non-ObjectId userId (401)', async () => {
    const badToken = jwt.sign({ id: 'not_an_object_id' }, TEST_SECRET);
    const { req, res, next, getError } = createMockReqResNext({
      authorization: `Bearer ${badToken}`,
    });
    await auth(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Invalid authentication token');
  });

  // Mock User.findById for database isolation tests
  const originalFindById = User.findById;

  await test('Rejects token if user was deleted or no longer exists in DB (401)', async () => {
    const validUserId = new mongoose.Types.ObjectId().toString();
    const token = generateToken(validUserId);

    // Mock User.findById returning null (user not found)
    User.findById = () => ({
      select: () => Promise.resolve(null),
    });

    const { req, res, next, getError } = createMockReqResNext({
      authorization: `Bearer ${token}`,
    });
    await auth(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'User belonging to this token no longer exists');
  });

  await test('Rejects token if user account is inactive (401)', async () => {
    const validUserId = new mongoose.Types.ObjectId().toString();
    const token = generateToken(validUserId);

    // Mock User.findById returning an inactive user
    User.findById = () => ({
      select: () =>
        Promise.resolve({
          _id: validUserId,
          email: 'inactive@example.com',
          isActive: false,
          role: 'EMPLOYEE',
        }),
    });

    const { req, res, next, getError } = createMockReqResNext({
      authorization: `Bearer ${token}`,
    });
    await auth(req, res, next);
    const err = getError();
    assert.ok(err);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'User account is inactive');
  });

  await test('Accepts valid token, attaches DB user to req.user, ignores forged token claims', async () => {
    const validUserId = new mongoose.Types.ObjectId().toString();
    const realOrgId = new mongoose.Types.ObjectId().toString();

    // Attacker forged token claiming role: 'SYSTEM_ADMIN' and organizationId: 'fake_org'
    const forgedClaimToken = jwt.sign(
      {
        id: validUserId,
        role: 'SYSTEM_ADMIN',
        organizationId: 'fake_org',
      },
      TEST_SECRET
    );

    // Actual user record in database has role: 'EMPLOYEE' and organizationId: realOrgId
    const authoritativeDbUser = {
      _id: validUserId,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      role: 'EMPLOYEE',
      organizationId: realOrgId,
      isActive: true,
      // password field excluded
    };

    User.findById = (id) => {
      assert.strictEqual(id.toString(), validUserId);
      return {
        select: (projection) => {
          assert.strictEqual(projection, '-password');
          return Promise.resolve(authoritativeDbUser);
        },
      };
    };

    const { req, res, next, getError } = createMockReqResNext({
      authorization: `Bearer ${forgedClaimToken}`,
    });
    await auth(req, res, next);
    const err = getError();

    assert.strictEqual(err, null, 'next() should have been called without error');
    assert.ok(req.user, 'req.user should be attached');
    assert.strictEqual(req.user._id, validUserId);
    assert.strictEqual(req.user.email, 'alice@example.com');
    // Ensure role and organization are from DB, NOT the forged token
    assert.strictEqual(req.user.role, 'EMPLOYEE', 'Role MUST come from DB, not token');
    assert.strictEqual(req.user.organizationId, realOrgId, 'OrganizationId MUST come from DB, not token');
    assert.strictEqual(req.user.password, undefined, 'Password must not be present');
  });

  // Restore User.findById and env variables
  User.findById = originalFindById;
  if (originalJwtSecret !== undefined) {
    process.env.JWT_SECRET = originalJwtSecret;
  } else {
    delete process.env.JWT_SECRET;
  }
  if (originalJwtExpiresIn !== undefined) {
    process.env.JWT_EXPIRES_IN = originalJwtExpiresIn;
  } else {
    delete process.env.JWT_EXPIRES_IN;
  }

  console.log(`\nTests Completed: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAuthTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
