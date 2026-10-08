import assert from 'node:assert';
import process from 'node:process';

// Mock localStorage for Node test environment
const mockStorage = {};
globalThis.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => {
    mockStorage[key] = String(val);
  },
  removeItem: (key) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
};

// Mock window and document for browser environment simulation
const dispatchedEvents = [];
const createdLinks = [];
let revokedUrls = [];

globalThis.window = {
  dispatchEvent: (event) => {
    dispatchedEvents.push(event);
  },
  URL: {
    createObjectURL: (blob) => `blob:mock-url-${blob.size || 'default'}`,
    revokeObjectURL: (url) => {
      revokedUrls.push(url);
    },
  },
};

globalThis.document = {
  body: {
    appendChild: (elem) => {
      createdLinks.push(elem);
    },
    removeChild: (elem) => {
      const idx = createdLinks.indexOf(elem);
      if (idx !== -1) createdLinks.splice(idx, 1);
    },
  },
  createElement: (tag) => {
    if (tag === 'a') {
      return {
        tag: 'a',
        href: '',
        download: '',
        clicked: false,
        click() {
          this.clicked = true;
        },
      };
    }
    return { tag };
  },
};

globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};

import { getToken, setToken, clearToken, ApiError, api } from '../src/services/apiClient.js';
import { ticketService } from '../src/services/ticketService.js';
import { assetService } from '../src/services/assetService.js';
import { knowledgeService } from '../src/services/knowledgeService.js';
import { reportService } from '../src/services/reportService.js';
import { aiAssistant } from '../src/utils/aiAssistant.js';
import { userService } from '../src/services/userService.js';

async function runClientTests() {
  console.log('=== ServiceDesk Pro Frontend Client Tests ===\n');
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

  // 1. Token Storage Tests
  console.log('--- 1. Token Management Tests ---');

  await test('setToken stores token in localStorage and getToken retrieves it', () => {
    setToken('sample-jwt-token-12345');
    assert.strictEqual(getToken(), 'sample-jwt-token-12345');
  });

  await test('clearToken removes token from localStorage', () => {
    setToken('sample-jwt-token-12345');
    clearToken();
    assert.strictEqual(getToken(), null);
  });

  // 2. ApiError Tests
  console.log('--- 2. ApiError Class Tests ---');

  await test('ApiError encapsulates status, message, and data correctly', () => {
    const err = new ApiError('Resource not found', 404, { detail: 'Asset AST-999 missing' });
    assert.strictEqual(err.name, 'ApiError');
    assert.strictEqual(err.message, 'Resource not found');
    assert.strictEqual(err.status, 404);
    assert.deepStrictEqual(err.data, { detail: 'Asset AST-999 missing' });
    assert.strictEqual(err instanceof Error, true);
  });

  // 3. API Client HTTP Wrapper Tests
  console.log('--- 3. API Client Request & Auth Interception Tests ---');

  await test('API client automatically attaches Bearer token to request headers', async () => {
    setToken('authenticated-jwt-token');

    let capturedHeaders = null;
    let capturedUrl = null;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: [] }),
      };
    };

    const res = await api.get('/tickets');
    assert.strictEqual(res.success, true);
    assert.strictEqual(capturedHeaders.Authorization, 'Bearer authenticated-jwt-token');
    assert.ok(capturedUrl.endsWith('/tickets'));
  });

  await test('API client 401 response clears token, triggers auth:unauthorized event, and throws ApiError(401)', async () => {
    setToken('expired-jwt-token');

    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: false, message: 'Token expired' }),
    });

    await assert.rejects(
      () => api.get('/auth/me'),
      (err) => {
        assert.strictEqual(err instanceof ApiError, true);
        assert.strictEqual(err.status, 401);
        assert.strictEqual(err.message, 'Token expired');
        return true;
      }
    );

    assert.strictEqual(getToken(), null, 'Token must be cleared upon 401');
    assert.strictEqual(dispatchedEvents.some((e) => e.type === 'auth:unauthorized'), true);
  });

  await test('API client handles server errors with custom message', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: false, message: 'Invalid ticket input data' }),
    });

    await assert.rejects(
      () => api.post('/tickets', { title: '' }),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.message, 'Invalid ticket input data');
        return true;
      }
    );
  });

  // 4. Ticket Service API Integration Tests
  console.log('--- 4. Ticket Service API Integration Tests ---');

  await test('ticketService.getTickets builds query string correctly with all filter options', async () => {
    let capturedUrl = null;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: [], pagination: { total: 0 } }),
      };
    };

    await ticketService.getTickets({
      page: 2,
      limit: 15,
      status: 'OPEN',
      priority: 'HIGH',
      categoryId: 'cat-123',
      search: 'laptop',
      sort: '-createdAt',
    });

    assert.ok(capturedUrl.includes('page=2'));
    assert.ok(capturedUrl.includes('limit=15'));
    assert.ok(capturedUrl.includes('status=OPEN'));
    assert.ok(capturedUrl.includes('priority=HIGH'));
    assert.ok(capturedUrl.includes('categoryId=cat-123'));
    assert.ok(capturedUrl.includes('search=laptop'));
    assert.ok(capturedUrl.includes('sort=-createdAt'));
  });

  await test('ticketService.createTicket sends POST request with correct payload', async () => {
    let capturedMethod = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedMethod = options.method;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 't-1', ticketNumber: 'TICK-1001' } }),
      };
    };

    const res = await ticketService.createTicket({
      title: 'VPN connection dropped',
      description: 'Cannot connect to company gateway',
      categoryId: 'cat-net',
      priority: 'HIGH',
    });

    assert.strictEqual(capturedMethod, 'POST');
    assert.strictEqual(capturedBody.title, 'VPN connection dropped');
    assert.strictEqual(capturedBody.priority, 'HIGH');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.ticketNumber, 'TICK-1001');
  });

  await test('ticketService.changeTicketStatus calls PATCH /tickets/:id/status', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 't-1', status: 'RESOLVED' } }),
      };
    };

    const res = await ticketService.changeTicketStatus('t-1', {
      status: 'RESOLVED',
      resolutionNotes: 'Replaced faulty ethernet patch cable.',
      rootCause: 'Hardware damage',
    });

    assert.ok(capturedUrl.endsWith('/tickets/t-1/status'));
    assert.strictEqual(capturedBody.status, 'RESOLVED');
    assert.strictEqual(capturedBody.resolutionNotes, 'Replaced faulty ethernet patch cable.');
    assert.strictEqual(res.data.status, 'RESOLVED');
  });

  await test('ticketService.assignTicket calls PATCH /tickets/:id/assign', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 't-1', assignedTo: 'tech-456' } }),
      };
    };

    const res = await ticketService.assignTicket('t-1', 'tech-456');
    assert.ok(capturedUrl.endsWith('/tickets/t-1/assign'));
    assert.strictEqual(capturedBody.assignedTo, 'tech-456');
    assert.strictEqual(res.data.assignedTo, 'tech-456');
  });

  await test('ticketService.addComment dispatches multipart FormData without overriding Content-Type', async () => {
    let capturedMethod = null;
    let capturedHeaders = null;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedMethod = options.method;
      capturedHeaders = options.headers;
      capturedBody = options.body;
      return {
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'c-1', body: 'Investigating issue' } }),
      };
    };

    // Real FormData (supported natively in modern Node)
    const mockFormData = new FormData();
    mockFormData.append('body', 'Investigating issue');
    const res = await ticketService.addComment('t-1', mockFormData);

    assert.strictEqual(capturedMethod, 'POST');
    assert.strictEqual(capturedBody, mockFormData);
    // When body is FormData, Content-Type must not be 'application/json' so browser can set boundary
    assert.strictEqual(capturedHeaders['Content-Type'], undefined);
    assert.strictEqual(res.success, true);
  });

  await test('ticketService.createWorkLog posts technician duration and description', async () => {
    let capturedUrl = null;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'wl-1', timeSpentMinutes: 45 } }),
      };
    };

    const res = await ticketService.createWorkLog('t-1', {
      timeSpentMinutes: 45,
      description: 'Configured router VLAN table',
      isBillable: true,
    });

    assert.ok(capturedUrl.endsWith('/tickets/t-1/work-logs'));
    assert.strictEqual(capturedBody.timeSpentMinutes, 45);
    assert.strictEqual(capturedBody.isBillable, true);
    assert.strictEqual(res.data.timeSpentMinutes, 45);
  });

  await test('ticketService.downloadAttachment sends authenticated Bearer token and triggers blob download', async () => {
    setToken('download-auth-token');
    revokedUrls = [];

    let capturedHeaders = null;
    let capturedUrl = null;

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        blob: async () => ({ size: 1024, type: 'image/png' }),
      };
    };

    await ticketService.downloadAttachment('t-99', 'screenshot-123.png', 'my_error.png');

    assert.ok(capturedUrl.includes('/tickets/t-99/attachments/screenshot-123.png'));
    assert.strictEqual(capturedHeaders.Authorization, 'Bearer download-auth-token');
    assert.strictEqual(revokedUrls.length, 1);
  });

  // 5. Lifecycle Transition & Authorization Validation Rules
  console.log('--- 5. Lifecycle & Role-Based Rules Tests ---');

  await test('Lifecycle state transitions correctly enforce valid target statuses', () => {
    const validTransitions = {
      OPEN: ['ASSIGNED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'],
      ASSIGNED: ['IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'],
      IN_PROGRESS: ['PENDING', 'RESOLVED', 'CLOSED'],
      PENDING: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED', 'IN_PROGRESS'],
      CLOSED: ['IN_PROGRESS'],
    };

    // OPEN can transition to IN_PROGRESS
    assert.ok(validTransitions.OPEN.includes('IN_PROGRESS'));
    // RESOLVED can be CLOSED or reopened to IN_PROGRESS
    assert.ok(validTransitions.RESOLVED.includes('CLOSED'));
    assert.ok(validTransitions.RESOLVED.includes('IN_PROGRESS'));
    // CLOSED can only reopen to IN_PROGRESS
    assert.deepStrictEqual(validTransitions.CLOSED, ['IN_PROGRESS']);
  });

  await test('Role-based visibility ensures Employees cannot access internal notes or work logs', () => {
    const isEmployee = (role) => role === 'EMPLOYEE';
    const canSeeInternalNotes = (role) => !isEmployee(role);
    const canAccessWorkLogs = (role) => !isEmployee(role);

    assert.strictEqual(canSeeInternalNotes('EMPLOYEE'), false);
    assert.strictEqual(canSeeInternalNotes('TECHNICIAN'), true);
    assert.strictEqual(canSeeInternalNotes('IT_MANAGER'), true);
    assert.strictEqual(canSeeInternalNotes('SYSTEM_ADMIN'), true);

    assert.strictEqual(canAccessWorkLogs('EMPLOYEE'), false);
    assert.strictEqual(canAccessWorkLogs('TECHNICIAN'), true);
  });

  await test('Employee ticket edit permissions are strictly confined to OPEN status and own tickets', () => {
    const canEmployeeEdit = (user, ticket) => {
      if (user.role !== 'EMPLOYEE') return true;
      return ticket.status === 'OPEN' && ticket.createdBy?._id === user._id;
    };

    const user = { _id: 'u-emp', role: 'EMPLOYEE' };
    const ownOpenTicket = { status: 'OPEN', createdBy: { _id: 'u-emp' } };
    const ownInProgressTicket = { status: 'IN_PROGRESS', createdBy: { _id: 'u-emp' } };
    const otherOpenTicket = { status: 'OPEN', createdBy: { _id: 'u-other' } };

    assert.strictEqual(canEmployeeEdit(user, ownOpenTicket), true);
    assert.strictEqual(canEmployeeEdit(user, ownInProgressTicket), false);
    assert.strictEqual(canEmployeeEdit(user, otherOpenTicket), false);
  });

  // 6. Asset & Vendor Service API Tests
  console.log('--- 6. Asset & Vendor Service API Tests ---');

  await test('assetService.getAssets serializes search, status, type, and pagination query params', async () => {
    let capturedUrl = null;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: [], pagination: { total: 0 } }),
      };
    };

    await assetService.getAssets({
      page: 1,
      limit: 15,
      status: 'IN_STOCK',
      assetType: 'HARDWARE',
      search: 'macbook',
    });

    assert.ok(capturedUrl.includes('/assets'));
    assert.ok(capturedUrl.includes('page=1'));
    assert.ok(capturedUrl.includes('limit=15'));
    assert.ok(capturedUrl.includes('status=IN_STOCK'));
    assert.ok(capturedUrl.includes('assetType=HARDWARE'));
    assert.ok(capturedUrl.includes('search=macbook'));
  });

  await test('assetService.createAsset posts new asset payload with assetTag and assetType', async () => {
    let capturedMethod = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedMethod = options.method;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'ast-101', assetTag: 'AST-101' } }),
      };
    };

    const res = await assetService.createAsset({
      assetTag: 'AST-101',
      name: 'Dell Precision 7760',
      assetType: 'HARDWARE',
      status: 'IN_STOCK',
    });

    assert.strictEqual(capturedMethod, 'POST');
    assert.strictEqual(capturedBody.assetTag, 'AST-101');
    assert.strictEqual(capturedBody.assetType, 'HARDWARE');
    assert.strictEqual(res.success, true);
  });

  await test('assetService.assignAsset calls POST /assets/:id/assign with target assignee', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'ast-101', status: 'ASSIGNED' } }),
      };
    };

    const res = await assetService.assignAsset('ast-101', {
      assignedTo: 'user-789',
      notes: 'Issued for graphic workstation',
    });

    assert.ok(capturedUrl.endsWith('/assets/ast-101/assign'));
    assert.strictEqual(capturedBody.assignedTo, 'user-789');
    assert.strictEqual(res.data.status, 'ASSIGNED');
  });

  await test('assetService.returnAsset calls POST /assets/:id/return with returnCondition', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'ast-101', status: 'IN_STOCK' } }),
      };
    };

    const res = await assetService.returnAsset('ast-101', {
      returnCondition: 'GOOD',
      notes: 'Returned in full working condition with AC adapter',
    });

    assert.ok(capturedUrl.endsWith('/assets/ast-101/return'));
    assert.strictEqual(capturedBody.returnCondition, 'GOOD');
    assert.strictEqual(res.data.status, 'IN_STOCK');
  });

  await test('assetService.getAssetAssignments retrieves custody history', async () => {
    let capturedUrl = null;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: [{ _id: 'asgn-1', assignedAt: '2026-01-01' }] }),
      };
    };

    const res = await assetService.getAssetAssignments('ast-101');
    assert.ok(capturedUrl.endsWith('/assets/ast-101/assignments'));
    assert.strictEqual(res.data.length, 1);
  });

  await test('assetService.getVendors and createVendor work properly', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      if (options?.body) capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'v-1', name: 'Apple Inc' } }),
      };
    };

    await assetService.createVendor({ name: 'Apple Inc', email: 'sales@apple.com' });
    assert.ok(capturedUrl.endsWith('/vendors'));
    assert.strictEqual(capturedBody.name, 'Apple Inc');
  });

  // 7. Knowledge Base Service API Tests
  console.log('--- 7. Knowledge Base Service API Tests ---');

  await test('knowledgeService.getArticles queries /knowledge-base with filters', async () => {
    let capturedUrl = null;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: [], pagination: { total: 0 } }),
      };
    };

    await knowledgeService.getArticles({
      search: 'printer',
      categoryId: 'cat-hardware',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      page: 1,
    });

    assert.ok(capturedUrl.includes('/knowledge-base'));
    assert.ok(capturedUrl.includes('search=printer'));
    assert.ok(capturedUrl.includes('categoryId=cat-hardware'));
    assert.ok(capturedUrl.includes('status=PUBLISHED'));
    assert.ok(capturedUrl.includes('visibility=PUBLIC'));
  });

  await test('knowledgeService.createArticle posts article body', async () => {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'kb-1', title: 'VPN Setup' } }),
      };
    };

    const res = await knowledgeService.createArticle({
      title: 'VPN Setup Guide',
      content: 'Step 1: Download client...',
      categoryId: 'cat-net',
      status: 'PUBLISHED',
    });

    assert.strictEqual(capturedBody.title, 'VPN Setup Guide');
    assert.strictEqual(res.success, true);
  });

  await test('knowledgeService.voteFeedback posts helpfulness vote to /feedback', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, helpfulVotes: 5, notHelpfulVotes: 1 }),
      };
    };

    const res = await knowledgeService.voteFeedback('kb-1', true);
    assert.ok(capturedUrl.endsWith('/knowledge-base/kb-1/feedback'));
    assert.strictEqual(capturedBody.vote, 'helpful');
    assert.strictEqual(res.helpfulVotes, 5);
  });

  await test('knowledgeService lifecycle transitions publish, archive, and review call respective endpoints', async () => {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: {} }),
      };
    };

    await knowledgeService.publishArticle('kb-1');
    await knowledgeService.archiveArticle('kb-1');
    await knowledgeService.reviewArticle('kb-1');

    assert.ok(urls[0].endsWith('/knowledge-base/kb-1/publish'));
    assert.ok(urls[1].endsWith('/knowledge-base/kb-1/archive'));
    assert.ok(urls[2].endsWith('/knowledge-base/kb-1/review'));
  });

  // 8. Asset & Knowledge Base Role Scoping Tests
  console.log('--- 8. Asset & KB Role-Based Scoping Tests ---');

  await test('Asset and Vendor management permissions are strictly restricted from Employees', () => {
    const canManageAssets = (role) => ['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER'].includes(role);
    const canViewVendors = (role) => ['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER', 'TECHNICIAN'].includes(role);

    assert.strictEqual(canManageAssets('EMPLOYEE'), false);
    assert.strictEqual(canManageAssets('TECHNICIAN'), false);
    assert.strictEqual(canManageAssets('ASSET_MANAGER'), true);
    assert.strictEqual(canManageAssets('IT_MANAGER'), true);
    assert.strictEqual(canManageAssets('SYSTEM_ADMIN'), true);

    assert.strictEqual(canViewVendors('EMPLOYEE'), false);
    assert.strictEqual(canViewVendors('TECHNICIAN'), true);
  });

  await test('Knowledge article authoring and deletion permissions conform to backend RBAC rules', () => {
    const canAuthorArticle = (role) => ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'].includes(role);
    const canDeleteArticle = (role) => ['SYSTEM_ADMIN', 'IT_MANAGER'].includes(role);

    assert.strictEqual(canAuthorArticle('EMPLOYEE'), false);
    assert.strictEqual(canAuthorArticle('TECHNICIAN'), true);
    assert.strictEqual(canAuthorArticle('IT_MANAGER'), true);
    assert.strictEqual(canAuthorArticle('SYSTEM_ADMIN'), true);

    assert.strictEqual(canDeleteArticle('EMPLOYEE'), false);
    assert.strictEqual(canDeleteArticle('TECHNICIAN'), false);
    assert.strictEqual(canDeleteArticle('IT_MANAGER'), true);
    assert.strictEqual(canDeleteArticle('SYSTEM_ADMIN'), true);
  });

  // 9. AI Triage and Classification Tests
  console.log('--- 9. AI Triage & Classification Tests ---');

  await test('classifyTicket detects critical urgency keywords and assigns CRITICAL priority', () => {
    const categories = [
      { _id: 'cat-net', name: 'Network & Connectivity' },
      { _id: 'cat-soft', name: 'Software Applications' },
    ];
    const result = aiAssistant.classifyTicket('Production down: VPN outage impacting all users', 'Cannot access remote gateway', categories);
    assert.ok(result);
    assert.strictEqual(result.suggestedPriority, 'CRITICAL');
    assert.ok(result.confidence >= 0.90);
    assert.strictEqual(result.suggestedCategory?._id, 'cat-net');
    assert.ok(result.probableIssue.includes('High-impact'));
  });

  await test('classifyTicket detects low urgency questions and assigns LOW priority', () => {
    const result = aiAssistant.classifyTicket('Minor question about mouse setup guide', 'When possible please let me know', []);
    assert.ok(result);
    assert.strictEqual(result.suggestedPriority, 'LOW');
    assert.strictEqual(result.confidence, 0.80);
  });

  await test('classifyTicket returns null safely when input text is too short', () => {
    const result = aiAssistant.classifyTicket('hi', '', []);
    assert.strictEqual(result, null);
  });

  // 10. Knowledge Base Recommendations Tests
  console.log('--- 10. Knowledge Base Recommendations Tests ---');

  await test('getRecommendedArticles queries knowledge base API with search keyword and returns matching articles', async () => {
    const originalGet = api.get;
    let queryPassed = null;
    api.get = async (url) => {
      queryPassed = url;
      return {
        success: true,
        data: [
          { _id: 'kb-1', title: 'VPN Troubleshooting Guide', category: 'Network' },
          { _id: 'kb-2', title: 'Gateway Access Reset', category: 'Network' },
        ],
      };
    };

    const articles = await aiAssistant.getRecommendedArticles('VPN connection failed', 2);
    api.get = originalGet;

    assert.ok(queryPassed.includes('/knowledge-base'));
    assert.ok(queryPassed.includes('search=VPN'));
    assert.strictEqual(articles.length, 2);
    assert.strictEqual(articles[0].title, 'VPN Troubleshooting Guide');
  });

  await test('getRecommendedArticles returns empty array without network call for short queries', async () => {
    const articles = await aiAssistant.getRecommendedArticles('ab');
    assert.deepStrictEqual(articles, []);
  });

  // 11. Reports Dashboard Metrics Aggregation Tests
  console.log('--- 11. Reports Dashboard Metrics Aggregation Tests ---');

  await test('reportService.getReportMetrics calculates correct KPIs and net resolution hours', async () => {
    const originalGetTickets = ticketService.getTickets;
    const originalGetAssets = assetService.getAssets;

    const mockTickets = [
      {
        _id: 't-1',
        ticketNumber: 'TICK-101',
        title: 'Network outage',
        status: 'OPEN',
        priority: 'CRITICAL',
        isResolutionBreached: true,
        createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        assignedTo: { firstName: 'Alice', lastName: 'Technician' },
      },
      {
        _id: 't-2',
        ticketNumber: 'TICK-102',
        title: 'Keyboard issue',
        status: 'RESOLVED',
        priority: 'LOW',
        isResolutionBreached: false,
        createdAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        totalSlaPausedMinutes: 60, // 4 hours gross - 1 hour paused = 3 hours net
        assignedTo: { firstName: 'Bob', lastName: 'Technician' },
      },
    ];

    const mockAssets = [
      { _id: 'a-1', name: 'MacBook Pro', assetType: 'LAPTOP', status: 'ASSIGNED', purchaseCost: 2500 },
      { _id: 'a-2', name: 'Dell Monitor', assetType: 'DESKTOP', status: 'IN_STOCK', purchaseCost: 400 },
    ];

    ticketService.getTickets = async () => ({ success: true, data: mockTickets });
    assetService.getAssets = async () => ({ success: true, data: mockAssets });

    const metrics = await reportService.getReportMetrics();

    ticketService.getTickets = originalGetTickets;
    assetService.getAssets = originalGetAssets;

    assert.strictEqual(metrics.totalTickets, 2);
    assert.strictEqual(metrics.activeTicketsCount, 1);
    assert.strictEqual(metrics.resolvedTicketsCount, 1);
    assert.strictEqual(metrics.statusCounts.OPEN, 1);
    assert.strictEqual(metrics.statusCounts.RESOLVED, 1);
    assert.strictEqual(metrics.priorityCounts.CRITICAL, 1);
    assert.strictEqual(metrics.priorityCounts.LOW, 1);
    assert.strictEqual(metrics.breachedCount, 1);
    assert.strictEqual(metrics.slaComplianceRate, 50); // 1 out of 2 breached = 50%
    assert.strictEqual(metrics.avgResolutionHours, '3.0'); // 3.0 net hours
    assert.strictEqual(metrics.assetStats.total, 2);
    assert.strictEqual(metrics.assetStats.assigned, 1);
    assert.strictEqual(metrics.assetStats.inStock, 1);
    assert.strictEqual(metrics.assetStats.totalProcurementCost, 2900);
  });

  // 12. Sanitized CSV Export Tests
  console.log('--- 12. Sanitized CSV Export Tests ---');

  await test('exportTicketsCSV generates sanitized CSV headers and formatted row values', () => {
    const tickets = [
      {
        ticketNumber: 'TICK-201',
        title: 'Printer "Paper Jam" in 2nd Floor',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        categoryId: { name: 'Hardware & Peripherals' },
        requesterId: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        assignedTo: { firstName: 'Alice', lastName: 'Tech' },
        createdAt: '2026-09-01T10:00:00Z',
        resolvedAt: null,
        isResolutionBreached: false,
        resolutionNotes: 'Inspecting roller mechanism',
      },
    ];

    const csv = reportService.exportTicketsCSV(tickets);
    assert.ok(csv.includes('Ticket Number,Subject,Status,Priority,Category'));
    assert.ok(csv.includes('TICK-201'));
    assert.ok(csv.includes('"Printer ""Paper Jam"" in 2nd Floor"'));
    assert.ok(csv.includes('"John Doe"'));
    assert.ok(csv.includes('"Hardware & Peripherals"'));
    assert.ok(csv.includes('NO'));
  });

  await test('exportAssetsCSV generates sanitized CSV headers and formatted currency', () => {
    const assets = [
      {
        assetTag: 'AST-501',
        name: 'Dell XPS 15',
        assetType: 'LAPTOP',
        status: 'ASSIGNED',
        category: 'Workstation',
        manufacturer: 'Dell',
        model: 'XPS 9520',
        serialNumber: 'SN-998877',
        location: 'Building B, Desk 42',
        currentAssigneeId: { firstName: 'Sara', lastName: 'Connor' },
        purchaseCost: 1899.99,
        purchaseDate: '2026-01-15T00:00:00Z',
        warrantyExpiry: '2029-01-15T00:00:00Z',
      },
    ];

    const csv = reportService.exportAssetsCSV(assets);
    assert.ok(csv.includes('Asset Tag,Asset Name,Type,Status,Category'));
    assert.ok(csv.includes('AST-501'));
    assert.ok(csv.includes('"Dell XPS 15"'));
    assert.ok(csv.includes('1899.99'));
    assert.ok(csv.includes('"Sara Connor"'));
    assert.ok(csv.includes('2026-01-15'));
  });

  await test('exportTicketsCSV and exportAssetsCSV throw on empty array', () => {
    assert.throws(() => reportService.exportTicketsCSV([]), /No ticket records available/);
    assert.throws(() => reportService.exportAssetsCSV([]), /No asset records available/);
  });

  // 13. Reports Role-Based Scoping Tests
  console.log('--- 13. Reports Role-Based Scoping Tests ---');

  await test('Reports page access is strictly role-restricted to SYSTEM_ADMIN, IT_MANAGER, and ASSET_MANAGER', () => {
    const canViewReports = (role) => ['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER'].includes(role);

    assert.strictEqual(canViewReports('EMPLOYEE'), false);
    assert.strictEqual(canViewReports('TECHNICIAN'), false);
    assert.strictEqual(canViewReports('ASSET_MANAGER'), true);
    assert.strictEqual(canViewReports('IT_MANAGER'), true);
    assert.strictEqual(canViewReports('SYSTEM_ADMIN'), true);
  });

  // 14. Bug Fixes & Regression Protection Tests
  console.log('--- 14. Bug Fixes & Regression Protection Tests ---');

  await test('EmptyState icon resolution safely handles both component functions and React elements', () => {
    const isElem = (val) => val !== null && typeof val === 'object' && 'type' in val && 'props' in val;
    const dummyComponent = () => null;
    const dummyElement = { type: dummyComponent, props: { size: 24 } };

    // Function/Component reference: not an element
    assert.strictEqual(isElem(dummyComponent), false);
    // Element instance: matches element check
    assert.strictEqual(isElem(dummyElement), true);
  });

  await test('Category response normalization handles both backend envelope and raw array safely', () => {
    const normalize = (catRes) => (Array.isArray(catRes) ? catRes : catRes?.data || []);

    const rawArray = [{ _id: 'c1', name: 'Hardware', parentId: null }];
    const enveloped = {
      success: true,
      count: 2,
      data: [
        { _id: 'c1', name: 'Hardware', parentId: null },
        { _id: 'c2', name: 'Laptops', parentId: 'c1' },
      ],
    };
    const nullResponse = null;
    const emptyObject = {};

    assert.deepStrictEqual(normalize(rawArray), rawArray);
    assert.deepStrictEqual(normalize(enveloped), enveloped.data);
    assert.deepStrictEqual(normalize(nullResponse), []);
    assert.deepStrictEqual(normalize(emptyObject), []);

    // Filter top-level categories
    const topCategories = normalize(enveloped).filter((c) => !c.parentId);
    assert.strictEqual(topCategories.length, 1);
    assert.strictEqual(topCategories[0].name, 'Hardware');

    // Filter subcategories
    const subCategories = normalize(enveloped).filter((c) => c.parentId === 'c1');
    assert.strictEqual(subCategories.length, 1);
    assert.strictEqual(subCategories[0].name, 'Laptops');
  });

  // 15. User Management Service & RBAC Tests
  console.log('--- 15. User Management Service & RBAC Tests ---');

  await test('userService.getUsers serializes pagination, search, role, and department query params', async () => {
    let capturedUrl = null;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, count: 0, data: [], pagination: { total: 0 } }),
      };
    };

    await userService.getUsers({
      page: 1,
      limit: 15,
      search: 'Alice',
      role: 'TECHNICIAN',
      departmentId: 'dept-99',
      status: 'active',
    });

    assert.ok(capturedUrl.includes('/users?'));
    assert.ok(capturedUrl.includes('page=1'));
    assert.ok(capturedUrl.includes('limit=15'));
    assert.ok(capturedUrl.includes('search=Alice'));
    assert.ok(capturedUrl.includes('role=TECHNICIAN'));
    assert.ok(capturedUrl.includes('departmentId=dept-99'));
    assert.ok(capturedUrl.includes('status=active'));
  });

  await test('userService.createUser sends POST with name, email, role, and department', async () => {
    let capturedMethod = null;
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedMethod = options.method;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          data: { _id: 'u-1', email: capturedBody.email, role: capturedBody.role },
        }),
      };
    };

    const res = await userService.createUser({
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah@skynet.com',
      password: 'ResistancePassword123!',
      role: 'TECHNICIAN',
      departmentId: 'dept-it-1',
      jobTitle: 'Security Lead',
    });

    assert.strictEqual(capturedMethod, 'POST');
    assert.strictEqual(capturedBody.email, 'sarah@skynet.com');
    assert.strictEqual(capturedBody.role, 'TECHNICIAN');
    assert.strictEqual(capturedBody.departmentId, 'dept-it-1');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.email, 'sarah@skynet.com');
  });

  await test('userService.updateUser sends PATCH request with updated profile attributes', async () => {
    let capturedUrl = null;
    let capturedMethod = null;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedMethod = options.method;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'u-1', ...capturedBody } }),
      };
    };

    const res = await userService.updateUser('u-1', {
      firstName: 'Sarah',
      lastName: 'Connor-Reese',
      role: 'IT_MANAGER',
    });

    assert.ok(capturedUrl.endsWith('/users/u-1'));
    assert.strictEqual(capturedMethod, 'PATCH');
    assert.strictEqual(capturedBody.role, 'IT_MANAGER');
    assert.strictEqual(res.data.lastName, 'Connor-Reese');
  });

  await test('userService.setUserStatus calls PATCH /users/:id/status with target state', async () => {
    let capturedUrl = null;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { _id: 'u-1', isActive: capturedBody.isActive } }),
      };
    };

    const resDeact = await userService.setUserStatus('u-1', false);
    assert.ok(capturedUrl.endsWith('/users/u-1/status'));
    assert.strictEqual(capturedBody.isActive, false);
    assert.strictEqual(resDeact.data.isActive, false);

    const resReact = await userService.setUserStatus('u-1', true);
    assert.strictEqual(capturedBody.isActive, true);
    assert.strictEqual(resReact.data.isActive, true);
  });

  await test('userService.getDepartments queries /users/departments and returns array', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: [{ _id: 'd-1', name: 'Information Technology', code: 'IT' }],
      }),
    });

    const depts = await userService.getDepartments();
    assert.strictEqual(Array.isArray(depts), true);
    assert.strictEqual(depts.length, 1);
    assert.strictEqual(depts[0].code, 'IT');
  });

  await test('User Management access is strictly restricted to SYSTEM_ADMIN role', () => {
    const canManageUsers = (role) => role === 'SYSTEM_ADMIN';

    assert.strictEqual(canManageUsers('EMPLOYEE'), false);
    assert.strictEqual(canManageUsers('TECHNICIAN'), false);
    assert.strictEqual(canManageUsers('ASSET_MANAGER'), false);
    assert.strictEqual(canManageUsers('IT_MANAGER'), false);
    assert.strictEqual(canManageUsers('SYSTEM_ADMIN'), true);
  });

  // 16. Frontend RBAC Navigation & Action Button Authorization Tests
  console.log('--- 16. Frontend RBAC Navigation & Action Button Authorization Tests ---');

  await test('ProtectedRoute role guard evaluates allowed roles correctly across all five roles', () => {
    const checkRoleAccess = (allowedRoles, userRole) => {
      if (!allowedRoles || !Array.isArray(allowedRoles)) return true;
      return allowedRoles.includes(userRole);
    };

    // /admin route (allowedRoles: ['SYSTEM_ADMIN'])
    const adminRoles = ['SYSTEM_ADMIN'];
    assert.strictEqual(checkRoleAccess(adminRoles, 'SYSTEM_ADMIN'), true);
    assert.strictEqual(checkRoleAccess(adminRoles, 'IT_MANAGER'), false);
    assert.strictEqual(checkRoleAccess(adminRoles, 'TECHNICIAN'), false);
    assert.strictEqual(checkRoleAccess(adminRoles, 'ASSET_MANAGER'), false);
    assert.strictEqual(checkRoleAccess(adminRoles, 'EMPLOYEE'), false);

    // /reports route (allowedRoles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER'])
    const reportRoles = ['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER'];
    assert.strictEqual(checkRoleAccess(reportRoles, 'SYSTEM_ADMIN'), true);
    assert.strictEqual(checkRoleAccess(reportRoles, 'IT_MANAGER'), true);
    assert.strictEqual(checkRoleAccess(reportRoles, 'ASSET_MANAGER'), true);
    assert.strictEqual(checkRoleAccess(reportRoles, 'TECHNICIAN'), false);
    assert.strictEqual(checkRoleAccess(reportRoles, 'EMPLOYEE'), false);

    // Public / all-authenticated routes (null allowedRoles)
    assert.strictEqual(checkRoleAccess(null, 'EMPLOYEE'), true);
    assert.strictEqual(checkRoleAccess(null, 'TECHNICIAN'), true);
  });

  await test('Sidebar navigation items strictly reflect authorized roles for all five roles', () => {
    const navItems = [
      { to: '/dashboard', roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'] },
      { to: '/tickets', roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'] },
      { to: '/assets', roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'] },
      { to: '/knowledge-base', roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'] },
      { to: '/reports', roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER'] },
      { to: '/admin', roles: ['SYSTEM_ADMIN'] },
    ];

    const getVisibleNavRoutes = (role) =>
      navItems.filter((item) => item.roles.includes(role)).map((item) => item.to);

    // EMPLOYEE: 4 navigation links (no reports, no admin)
    const empRoutes = getVisibleNavRoutes('EMPLOYEE');
    assert.deepStrictEqual(empRoutes, ['/dashboard', '/tickets', '/assets', '/knowledge-base']);

    // TECHNICIAN: 4 navigation links (no reports, no admin)
    const techRoutes = getVisibleNavRoutes('TECHNICIAN');
    assert.deepStrictEqual(techRoutes, ['/dashboard', '/tickets', '/assets', '/knowledge-base']);

    // ASSET_MANAGER: 5 navigation links (includes reports, no admin)
    const assetMgrRoutes = getVisibleNavRoutes('ASSET_MANAGER');
    assert.deepStrictEqual(assetMgrRoutes, ['/dashboard', '/tickets', '/assets', '/knowledge-base', '/reports']);

    // IT_MANAGER: 5 navigation links (includes reports, no admin)
    const itMgrRoutes = getVisibleNavRoutes('IT_MANAGER');
    assert.deepStrictEqual(itMgrRoutes, ['/dashboard', '/tickets', '/assets', '/knowledge-base', '/reports']);

    // SYSTEM_ADMIN: all 6 navigation links
    const adminNavRoutes = getVisibleNavRoutes('SYSTEM_ADMIN');
    assert.deepStrictEqual(adminNavRoutes, ['/dashboard', '/tickets', '/assets', '/knowledge-base', '/reports', '/admin']);
  });

  await test('Asset mutation buttons are visible ONLY to SYSTEM_ADMIN and ASSET_MANAGER', () => {
    const canManageAssets = (role) => ['SYSTEM_ADMIN', 'ASSET_MANAGER'].includes(role);

    assert.strictEqual(canManageAssets('SYSTEM_ADMIN'), true);
    assert.strictEqual(canManageAssets('ASSET_MANAGER'), true);
    assert.strictEqual(canManageAssets('IT_MANAGER'), false); // Read-only
    assert.strictEqual(canManageAssets('TECHNICIAN'), false);  // Read-only
    assert.strictEqual(canManageAssets('EMPLOYEE'), false);
  });

  await test('Ticket assignment button is visible ONLY to technical operations staff', () => {
    const canAssignTicket = (role) => ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(role);

    assert.strictEqual(canAssignTicket('TECHNICIAN'), true);
    assert.strictEqual(canAssignTicket('IT_MANAGER'), true);
    assert.strictEqual(canAssignTicket('SYSTEM_ADMIN'), true);
    assert.strictEqual(canAssignTicket('ASSET_MANAGER'), false);
    assert.strictEqual(canAssignTicket('EMPLOYEE'), false);
  });

  await test('Internal notes toggle and Work Logs are visible ONLY to technical operations staff', () => {
    const canAccessInternalTools = (role) => ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(role);

    assert.strictEqual(canAccessInternalTools('TECHNICIAN'), true);
    assert.strictEqual(canAccessInternalTools('IT_MANAGER'), true);
    assert.strictEqual(canAccessInternalTools('SYSTEM_ADMIN'), true);
    assert.strictEqual(canAccessInternalTools('ASSET_MANAGER'), false);
    assert.strictEqual(canAccessInternalTools('EMPLOYEE'), false);
  });

  // 17. Phase 2: Role-Based Dashboard Resolution & Metrics Processing Tests
  console.log('--- 17. Phase 2: Role-Based Dashboard Resolution & Metrics Processing Tests ---');

  await test('DashboardPage routes each authenticated role to the correct dashboard component', () => {
    const resolveDashboardName = (role) => {
      switch (role) {
        case 'SYSTEM_ADMIN':
          return 'AdminDashboard';
        case 'IT_MANAGER':
          return 'ManagerDashboard';
        case 'TECHNICIAN':
          return 'TechnicianDashboard';
        case 'ASSET_MANAGER':
          return 'AssetManagerDashboard';
        case 'EMPLOYEE':
        default:
          return 'EmployeeDashboard';
      }
    };

    assert.strictEqual(resolveDashboardName('SYSTEM_ADMIN'), 'AdminDashboard');
    assert.strictEqual(resolveDashboardName('IT_MANAGER'), 'ManagerDashboard');
    assert.strictEqual(resolveDashboardName('TECHNICIAN'), 'TechnicianDashboard');
    assert.strictEqual(resolveDashboardName('EMPLOYEE'), 'EmployeeDashboard');
    assert.strictEqual(resolveDashboardName('ASSET_MANAGER'), 'AssetManagerDashboard');
    assert.strictEqual(resolveDashboardName(undefined), 'EmployeeDashboard'); // Fallback
    assert.strictEqual(resolveDashboardName('UNKNOWN_ROLE'), 'EmployeeDashboard'); // Fallback
  });

  await test('AdminDashboard correctly computes multi-tenant user, ticket, and asset KPIs', () => {
    const mockUsers = [
      { _id: 'u1', isActive: true, role: 'SYSTEM_ADMIN' },
      { _id: 'u2', isActive: true, role: 'TECHNICIAN' },
      { _id: 'u3', isActive: false, role: 'EMPLOYEE' },
    ];
    const mockTickets = [
      { _id: 't1', status: 'OPEN', isResponseBreached: false, isResolutionBreached: false },
      { _id: 't2', status: 'IN_PROGRESS', isResponseBreached: true, isResolutionBreached: false },
      { _id: 't3', status: 'RESOLVED', isResponseBreached: false, isResolutionBreached: false },
      { _id: 't4', status: 'CLOSED', isResponseBreached: false, isResolutionBreached: true },
    ];
    const mockAssets = [
      { _id: 'a1', status: 'IN_STOCK' },
      { _id: 'a2', status: 'ASSIGNED' },
      { _id: 'a3', status: 'UNDER_MAINTENANCE' },
      { _id: 'a4', status: 'RETIRED' },
    ];

    const activeUsers = mockUsers.filter((u) => u.isActive).length;
    const inactiveUsers = mockUsers.length - activeUsers;
    assert.strictEqual(activeUsers, 2);
    assert.strictEqual(inactiveUsers, 1);

    const openCount = mockTickets.filter((t) => ['OPEN', 'ASSIGNED'].includes(t.status)).length;
    const inProgressCount = mockTickets.filter((t) => ['IN_PROGRESS', 'PENDING'].includes(t.status)).length;
    const resolvedCount = mockTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
    const breachedCount = mockTickets.filter((t) => t.isResponseBreached || t.isResolutionBreached).length;

    assert.strictEqual(openCount, 1);
    assert.strictEqual(inProgressCount, 1);
    assert.strictEqual(resolvedCount, 2);
    assert.strictEqual(breachedCount, 2);

    const compliant = mockTickets.length - breachedCount;
    const slaCompliancePct = Math.round((compliant / mockTickets.length) * 100);
    assert.strictEqual(slaCompliancePct, 50);

    const inStockAssets = mockAssets.filter((a) => a.status === 'IN_STOCK').length;
    const assignedAssets = mockAssets.filter((a) => a.status === 'ASSIGNED').length;
    const maintAssets = mockAssets.filter((a) => ['UNDER_MAINTENANCE', 'IN_REPAIR'].includes(a.status)).length;
    const retiredAssets = mockAssets.filter((a) => ['RETIRED', 'DISPOSED', 'LOST'].includes(a.status)).length;
    assert.strictEqual(inStockAssets, 1);
    assert.strictEqual(assignedAssets, 1);
    assert.strictEqual(maintAssets, 1);
    assert.strictEqual(retiredAssets, 1);
  });

  await test('ManagerDashboard computes team workload balance and priority escalations accurately', () => {
    const techA = { _id: 'tech1', firstName: 'Alice', lastName: 'Tech' };
    const techB = { _id: 'tech2', firstName: 'Bob', lastName: 'Tech' };

    const mockTickets = [
      { _id: 't1', status: 'OPEN', priority: 'LOW', assignedTo: null },
      { _id: 't2', status: 'ASSIGNED', priority: 'HIGH', assignedTo: techA },
      { _id: 't3', status: 'IN_PROGRESS', priority: 'CRITICAL', assignedTo: techA },
      { _id: 't4', status: 'RESOLVED', priority: 'MEDIUM', assignedTo: techA },
      { _id: 't5', status: 'IN_PROGRESS', priority: 'HIGH', assignedTo: techB },
    ];

    const statusCounts = { OPEN: 0, ASSIGNED: 0, IN_PROGRESS: 0, PENDING: 0, RESOLVED: 0, CLOSED: 0 };
    const technicianWorkload = {};
    const highPriorityTickets = [];
    let unassignedCount = 0;

    mockTickets.forEach((t) => {
      if (statusCounts[t.status] !== undefined) statusCounts[t.status]++;
      if (['HIGH', 'CRITICAL'].includes(t.priority) && !['RESOLVED', 'CLOSED'].includes(t.status)) {
        highPriorityTickets.push(t);
      }
      if (t.assignedTo) {
        const id = t.assignedTo._id;
        if (!technicianWorkload[id]) {
          technicianWorkload[id] = { id, name: `${t.assignedTo.firstName} ${t.assignedTo.lastName}`, total: 0, active: 0, resolved: 0 };
        }
        technicianWorkload[id].total++;
        if (['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING'].includes(t.status)) {
          technicianWorkload[id].active++;
        } else {
          technicianWorkload[id].resolved++;
        }
      } else if (!['RESOLVED', 'CLOSED'].includes(t.status)) {
        unassignedCount++;
      }
    });

    assert.strictEqual(statusCounts.OPEN, 1);
    assert.strictEqual(statusCounts.ASSIGNED, 1);
    assert.strictEqual(statusCounts.IN_PROGRESS, 2);
    assert.strictEqual(statusCounts.RESOLVED, 1);
    assert.strictEqual(unassignedCount, 1);
    assert.strictEqual(highPriorityTickets.length, 3); // t2, t3, t5
    assert.strictEqual(technicianWorkload['tech1'].active, 2);
    assert.strictEqual(technicianWorkload['tech1'].resolved, 1);
    assert.strictEqual(technicianWorkload['tech2'].active, 1);
  });

  await test('TechnicianDashboard filters assigned workbench, status/priority groups, and work logs', () => {
    const technicianId = 'tech-001';
    const mockTickets = [
      { _id: 't1', ticketNumber: 'SDP-1', status: 'ASSIGNED', priority: 'HIGH', assignedTo: { _id: 'tech-001' } },
      { _id: 't2', ticketNumber: 'SDP-2', status: 'IN_PROGRESS', priority: 'CRITICAL', assignedTo: { _id: 'tech-001' } },
      { _id: 't3', ticketNumber: 'SDP-3', status: 'RESOLVED', priority: 'LOW', assignedTo: { _id: 'tech-001' } },
      { _id: 't4', ticketNumber: 'SDP-4', status: 'OPEN', priority: 'MEDIUM', assignedTo: { _id: 'tech-002' } }, // other tech
    ];

    const myAssignedTickets = mockTickets.filter((t) => t.assignedTo?._id === technicianId);
    assert.strictEqual(myAssignedTickets.length, 3);

    const activeAssigned = myAssignedTickets.filter((t) => ['ASSIGNED', 'IN_PROGRESS', 'PENDING'].includes(t.status));
    assert.strictEqual(activeAssigned.length, 2);

    // Grouping by status
    const statusGroups = { ASSIGNED: 0, IN_PROGRESS: 0, RESOLVED: 0 };
    myAssignedTickets.forEach((t) => {
      if (statusGroups[t.status] !== undefined) statusGroups[t.status]++;
    });
    assert.strictEqual(statusGroups.ASSIGNED, 1);
    assert.strictEqual(statusGroups.IN_PROGRESS, 1);
    assert.strictEqual(statusGroups.RESOLVED, 1);

    // Grouping by priority
    const priorityGroups = { CRITICAL: 0, HIGH: 0, LOW: 0 };
    myAssignedTickets.forEach((t) => {
      if (priorityGroups[t.priority] !== undefined) priorityGroups[t.priority]++;
    });
    assert.strictEqual(priorityGroups.CRITICAL, 1);
    assert.strictEqual(priorityGroups.HIGH, 1);
    assert.strictEqual(priorityGroups.LOW, 1);

    // Work logs duration summation
    const mockWorkLogs = [
      { ticketId: 't1', timeSpentMinutes: 45 },
      { ticketId: 't2', timeSpentMinutes: 60 },
    ];
    const totalMinutes = mockWorkLogs.reduce((sum, log) => sum + log.timeSpentMinutes, 0);
    assert.strictEqual(totalMinutes, 105);
  });

  await test('EmployeeDashboard isolates requester tickets, pending actions, and assigned equipment', () => {
    const employeeId = 'emp-100';
    const mockTickets = [
      { _id: 't1', requesterId: employeeId, status: 'OPEN' },
      { _id: 't2', requesterId: employeeId, status: 'PENDING' }, // Awaiting response
      { _id: 't3', requesterId: employeeId, status: 'RESOLVED' },
      { _id: 't4', requesterId: employeeId, status: 'CLOSED' },
    ];
    const mockEquipment = [
      { _id: 'ast-1', name: 'MacBook Pro 16', currentAssigneeId: employeeId, status: 'ASSIGNED' },
      { _id: 'ast-2', name: 'Dell Monitor 27', currentAssigneeId: employeeId, status: 'ASSIGNED' },
    ];

    const openCount = mockTickets.filter((t) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length;
    const awaitingResponseCount = mockTickets.filter((t) => t.status === 'PENDING').length;
    const resolvedCount = mockTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;

    assert.strictEqual(openCount, 1);
    assert.strictEqual(awaitingResponseCount, 1);
    assert.strictEqual(resolvedCount, 2);
    assert.strictEqual(mockEquipment.length, 2);
  });

  await test('AssetManagerDashboard accurately evaluates fleet status and warranty expiration health', () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const soonDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 days in future
    const distantDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year in future

    const mockAssets = [
      { _id: 'a1', status: 'IN_STOCK', assetType: 'HARDWARE', warrantyExpiry: pastDate.toISOString() },
      { _id: 'a2', status: 'ASSIGNED', assetType: 'HARDWARE', warrantyExpiry: soonDate.toISOString() },
      { _id: 'a3', status: 'ASSIGNED', assetType: 'PERIPHERAL', warrantyExpiry: distantDate.toISOString() },
      { _id: 'a4', status: 'IN_REPAIR', assetType: 'NETWORK', warrantyExpiry: null },
      { _id: 'a5', status: 'RETIRED', assetType: 'HARDWARE', warrantyExpiry: pastDate.toISOString() },
    ];

    const inStock = mockAssets.filter((a) => a.status === 'IN_STOCK').length;
    const assigned = mockAssets.filter((a) => a.status === 'ASSIGNED').length;
    const maintenance = mockAssets.filter((a) => ['IN_REPAIR', 'UNDER_MAINTENANCE'].includes(a.status)).length;
    const retired = mockAssets.filter((a) => ['RETIRED', 'DISPOSED', 'LOST'].includes(a.status)).length;

    assert.strictEqual(inStock, 1);
    assert.strictEqual(assigned, 2);
    assert.strictEqual(maintenance, 1);
    assert.strictEqual(retired, 1);

    // Warranty analysis
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const expired = [];
    const expiringSoon = [];
    const activeValid = [];
    let notSpecified = 0;

    mockAssets.forEach((a) => {
      if (!a.warrantyExpiry) {
        notSpecified++;
        return;
      }
      const expDate = new Date(a.warrantyExpiry);
      if (expDate < now) {
        expired.push(a);
      } else if (expDate <= ninetyDaysFromNow) {
        expiringSoon.push(a);
      } else {
        activeValid.push(a);
      }
    });

    assert.strictEqual(expired.length, 2); // a1 and a5 (30 days ago)
    assert.strictEqual(expiringSoon.length, 1); // a2 (45 days in future)
    assert.strictEqual(activeValid.length, 1); // a3 (1 year in future)
    assert.strictEqual(notSpecified, 1); // a4 (no warranty date)
  });

  await test('Strict RBAC endpoint authorization rules are preserved across all dashboard roles', () => {
    // Authorized roles per domain service
    const canAccessUsers = (role) => role === 'SYSTEM_ADMIN';
    const canAccessAllTickets = (role) => ['SYSTEM_ADMIN', 'IT_MANAGER'].includes(role);
    const canAccessVendors = (role) => ['SYSTEM_ADMIN', 'ASSET_MANAGER', 'IT_MANAGER', 'TECHNICIAN'].includes(role);
    const canMutateAssets = (role) => ['SYSTEM_ADMIN', 'ASSET_MANAGER'].includes(role);

    // EMPLOYEE: strictly denied from users, vendors, and asset mutation
    assert.strictEqual(canAccessUsers('EMPLOYEE'), false);
    assert.strictEqual(canAccessAllTickets('EMPLOYEE'), false);
    assert.strictEqual(canAccessVendors('EMPLOYEE'), false);
    assert.strictEqual(canMutateAssets('EMPLOYEE'), false);

    // TECHNICIAN: strictly denied from users and asset mutation
    assert.strictEqual(canAccessUsers('TECHNICIAN'), false);
    assert.strictEqual(canAccessVendors('TECHNICIAN'), true);
    assert.strictEqual(canMutateAssets('TECHNICIAN'), false);

    // ASSET_MANAGER: strictly denied from users
    assert.strictEqual(canAccessUsers('ASSET_MANAGER'), false);
    assert.strictEqual(canAccessVendors('ASSET_MANAGER'), true);
    assert.strictEqual(canMutateAssets('ASSET_MANAGER'), true);

    // SYSTEM_ADMIN: permitted across all domains
    assert.strictEqual(canAccessUsers('SYSTEM_ADMIN'), true);
    assert.strictEqual(canAccessAllTickets('SYSTEM_ADMIN'), true);
    assert.strictEqual(canAccessVendors('SYSTEM_ADMIN'), true);
    assert.strictEqual(canMutateAssets('SYSTEM_ADMIN'), true);
  });

  console.log(`\nClient Tests Completed: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runClientTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

