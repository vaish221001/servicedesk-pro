const assert = require('assert');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Category = require('../src/models/Category');
const Ticket = require('../src/models/Ticket');
const Vendor = require('../src/models/Vendor');
const Asset = require('../src/models/Asset');
const AssetAssignment = require('../src/models/AssetAssignment');
const KnowledgeArticle = require('../src/models/KnowledgeArticle');
const AuditLog = require('../src/models/AuditLog');
const Notification = require('../src/models/Notification');
const Organization = require('../src/models/Organization');

const vendorService = require('../src/services/vendorService');
const assetService = require('../src/services/assetService');
const knowledgeArticleService = require('../src/services/knowledgeArticleService');
const ticketService = require('../src/services/ticketService');
const AppError = require('../src/utils/AppError');

// Safe mock identifiers
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
  assignedDepartments: [],
  isActive: true,
};

const assetManagerUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Alice',
  lastName: 'AssetMgr',
  email: 'alice@example.com',
  role: 'ASSET_MANAGER',
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

const systemAdminUser = {
  _id: new mongoose.Types.ObjectId(),
  firstName: 'Sam',
  lastName: 'Admin',
  email: 'sam@example.com',
  role: 'SYSTEM_ADMIN',
  organizationId: orgA,
  departmentId: deptIT,
  assignedDepartments: [],
  isActive: true,
};

// Global default mocks for DB isolation
AuditLog.create = (doc) => Promise.resolve(doc);
Notification.create = (doc) => Promise.resolve(doc);
User.find = () => ({ select: () => Promise.resolve([]) });
Department.findOne = (query) => Promise.resolve({ _id: query?._id || deptIT, organizationId: orgA, isActive: true });
Department.find = () => Promise.resolve([]);
Organization.findById = () => Promise.resolve({ _id: orgA, name: 'Acme Corp' });

async function runStep20Tests() {
  console.log('=== ServiceDesk Pro Step 20 Test Suite ===\n');
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

  // Track audit logs
  let capturedAuditLogs = [];
  AuditLog.create = (doc) => {
    capturedAuditLogs.push(doc);
    return Promise.resolve(doc);
  };

  // ==========================================
  // 1. VENDOR MANAGEMENT TESTS
  // ==========================================
  console.log('--- 1. Vendor Management Tests ---');

  await test('Vendor creation requires name and sets organizationId', async () => {
    const origCreate = Vendor.create;
    try {
      await assert.rejects(
        () => vendorService.createVendor(orgA, { name: '   ' }, assetManagerUser),
        (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('name is required')
      );

      let createdDoc = null;
      Vendor.create = (doc) => {
        createdDoc = { _id: new mongoose.Types.ObjectId(), ...doc };
        return Promise.resolve(createdDoc);
      };

      const result = await vendorService.createVendor(
        orgA,
        { name: 'Dell Technologies', contactPerson: 'John Dell', email: 'DELL@EXAMPLE.COM' },
        assetManagerUser
      );

      assert.strictEqual(result.name, 'Dell Technologies');
      assert.strictEqual(result.organizationId.toString(), orgA.toString());
      assert.strictEqual(result.email, 'dell@example.com');
      assert.strictEqual(result.isActive, true);
    } finally {
      Vendor.create = origCreate;
    }
  });

  await test('Vendor retrieval enforces organization isolation (404 across orgs)', async () => {
    const origFindOne = Vendor.findOne;
    try {
      Vendor.findOne = ({ _id, organizationId }) => {
        if (organizationId.toString() === orgA.toString()) {
          return Promise.resolve({ _id, organizationId: orgA, name: 'Vendor A' });
        }
        return Promise.resolve(null);
      };

      const vendorId = new mongoose.Types.ObjectId();
      const vendor = await vendorService.getVendorById(orgA, vendorId);
      assert.strictEqual(vendor.name, 'Vendor A');

      await assert.rejects(
        () => vendorService.getVendorById(orgB, vendorId),
        (err) => err instanceof AppError && err.statusCode === 404
      );
    } finally {
      Vendor.findOne = origFindOne;
    }
  });

  await test('Vendor update and soft-deletion create audit logs', async () => {
    const origFindOne = Vendor.findOne;
    try {
      const mockVendor = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        name: 'Initial Name',
        isActive: true,
        save: function () {
          return Promise.resolve(this);
        },
      };
      Vendor.findOne = () => Promise.resolve(mockVendor);

      capturedAuditLogs = [];
      await vendorService.updateVendor(orgA, mockVendor._id, { name: 'Updated Vendor' }, assetManagerUser);
      assert.strictEqual(mockVendor.name, 'Updated Vendor');
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'VENDOR_UPDATED'), true);

      await vendorService.deleteVendor(orgA, mockVendor._id, assetManagerUser);
      assert.strictEqual(mockVendor.isActive, false);
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'VENDOR_DELETED'), true);
    } finally {
      Vendor.findOne = origFindOne;
    }
  });

  // ==========================================
  // 2. ASSET MANAGEMENT TESTS
  // ==========================================
  console.log('--- 2. Asset Management Tests ---');

  await test('Asset creation requires assetTag, name, and assetType with unique tag per org', async () => {
    const origFindOne = Asset.findOne;
    const origCreate = Asset.create;
    try {
      await assert.rejects(
        () => assetService.createAsset(orgA, { name: 'Laptop' }, assetManagerUser),
        (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('Asset tag is required')
      );

      // Duplicate asset tag in same org rejected
      Asset.findOne = ({ organizationId, assetTag }) => {
        if (assetTag === 'AST-001') return Promise.resolve({ _id: new mongoose.Types.ObjectId(), assetTag: 'AST-001' });
        return Promise.resolve(null);
      };

      await assert.rejects(
        () =>
          assetService.createAsset(
            orgA,
            { assetTag: 'AST-001', name: 'Laptop', assetType: 'HARDWARE' },
            assetManagerUser
          ),
        (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('already exists')
      );

      let created = null;
      Asset.create = (doc) => {
        created = { _id: new mongoose.Types.ObjectId(), ...doc };
        return Promise.resolve(created);
      };

      const asset = await assetService.createAsset(
        orgA,
        { assetTag: 'ast-002', name: 'Workstation ThinkPad', assetType: 'HARDWARE' },
        assetManagerUser
      );

      assert.strictEqual(asset.assetTag, 'AST-002');
      assert.strictEqual(asset.status, 'IN_STOCK');
      assert.strictEqual(asset.currentAssigneeId, null);
    } finally {
      Asset.findOne = origFindOne;
      Asset.create = origCreate;
    }
  });

  await test('Asset creation validates vendor and department within same organization', async () => {
    const origFindOneAsset = Asset.findOne;
    const origFindOneVendor = Vendor.findOne;
    const origFindOneDept = Department.findOne;
    try {
      Asset.findOne = () => Promise.resolve(null);
      // Vendor not found in org
      Vendor.findOne = () => Promise.resolve(null);

      const crossOrgVendorId = new mongoose.Types.ObjectId();
      await assert.rejects(
        () =>
          assetService.createAsset(
            orgA,
            { assetTag: 'AST-003', name: 'Monitor', assetType: 'PERIPHERAL', vendorId: crossOrgVendorId },
            assetManagerUser
          ),
        (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('Invalid vendor')
      );

      Vendor.findOne = () => Promise.resolve({ _id: crossOrgVendorId, organizationId: orgA });
      Department.findOne = () => Promise.resolve(null);

      const crossOrgDeptId = new mongoose.Types.ObjectId();
      await assert.rejects(
        () =>
          assetService.createAsset(
            orgA,
            {
              assetTag: 'AST-003',
              name: 'Monitor',
              assetType: 'PERIPHERAL',
              vendorId: crossOrgVendorId,
              departmentId: crossOrgDeptId,
            },
            assetManagerUser
          ),
        (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('Invalid department')
      );
    } finally {
      Asset.findOne = origFindOneAsset;
      Vendor.findOne = origFindOneVendor;
      Department.findOne = origFindOneDept;
    }
  });

  await test('Employees can only view assets assigned to them (custody isolation)', async () => {
    const origFind = Asset.find;
    const origCount = Asset.countDocuments;
    const origFindOne = Asset.findOne;
    try {
      let capturedFilter = null;
      Asset.find = (filter) => {
        capturedFilter = filter;
        return {
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
        };
      };
      Asset.countDocuments = () => Promise.resolve(0);

      // Employee query
      await assetService.getAssets(orgA, employeeUser, {});
      assert.strictEqual(
        capturedFilter.currentAssigneeId.toString(),
        employeeUser._id.toString(),
        'Employee listing must be filtered to currentAssigneeId'
      );

      // Manager query (not restricted)
      await assetService.getAssets(orgA, assetManagerUser, {});
      assert.strictEqual(capturedFilter.currentAssigneeId, undefined);

      // Get by ID: employee viewing an asset assigned to someone else fails with 403
      const otherUserId = new mongoose.Types.ObjectId();
      Asset.findOne = () => ({
        populate: () => ({
          populate: () => ({
            populate: () =>
              Promise.resolve({
                _id: new mongoose.Types.ObjectId(),
                organizationId: orgA,
                currentAssigneeId: otherUserId,
              }),
          }),
        }),
      });

      await assert.rejects(
        () => assetService.getAssetById(orgA, new mongoose.Types.ObjectId(), employeeUser),
        (err) => err instanceof AppError && err.statusCode === 403
      );
    } finally {
      Asset.find = origFind;
      Asset.countDocuments = origCount;
      Asset.findOne = origFindOne;
    }
  });

  // ==========================================
  // 3. ASSET ASSIGNMENT LIFECYCLE TESTS
  // ==========================================
  console.log('--- 3. Asset Assignment Lifecycle Tests ---');

  await test('Asset checkout creates AssetAssignment, updates status to ASSIGNED, and sets assignee', async () => {
    const origFindOneAsset = Asset.findOne;
    const origFindOneAssignment = AssetAssignment.findOne;
    const origFindOneUser = User.findOne;
    const origCreateAssignment = AssetAssignment.create;
    try {
      const mockAsset = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        assetTag: 'AST-LAPTOP-1',
        name: 'Dell Precision',
        status: 'IN_STOCK',
        currentAssigneeId: null,
        departmentId: null,
        save: function () {
          return Promise.resolve(this);
        },
      };

      Asset.findOne = () => Promise.resolve(mockAsset);
      AssetAssignment.findOne = () => Promise.resolve(null);
      User.findOne = () => Promise.resolve(employeeUser);

      let createdAssignment = null;
      AssetAssignment.create = (doc) => {
        createdAssignment = { _id: new mongoose.Types.ObjectId(), ...doc };
        return Promise.resolve(createdAssignment);
      };

      capturedAuditLogs = [];
      const result = await assetService.assignAsset(
        orgA,
        mockAsset._id,
        { assignedTo: employeeUser._id, notes: 'New hire equipment' },
        assetManagerUser
      );

      assert.strictEqual(mockAsset.status, 'ASSIGNED');
      assert.strictEqual(mockAsset.currentAssigneeId.toString(), employeeUser._id.toString());
      assert.strictEqual(result.assignment.assignedTo.toString(), employeeUser._id.toString());
      assert.strictEqual(result.assignment.returnedAt, null);
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'ASSET_ASSIGNED'), true);
    } finally {
      Asset.findOne = origFindOneAsset;
      AssetAssignment.findOne = origFindOneAssignment;
      User.findOne = origFindOneUser;
      AssetAssignment.create = origCreateAssignment;
    }
  });

  await test('Asset checkout strictly rejects conflicting active assignments', async () => {
    const origFindOneAsset = Asset.findOne;
    const origFindOneAssignment = AssetAssignment.findOne;
    try {
      // 1. Asset is already marked ASSIGNED
      const assignedAsset = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        status: 'ASSIGNED',
        currentAssigneeId: employeeUser._id,
      };
      Asset.findOne = () => Promise.resolve(assignedAsset);

      await assert.rejects(
        () => assetService.assignAsset(orgA, assignedAsset._id, { assignedTo: technicianUser._id }, assetManagerUser),
        (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('currently assigned')
      );

      // 2. Active assignment record exists with returnedAt: null
      const inStockAsset = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        status: 'IN_STOCK',
        currentAssigneeId: null,
      };
      Asset.findOne = () => Promise.resolve(inStockAsset);
      AssetAssignment.findOne = () => Promise.resolve({ _id: new mongoose.Types.ObjectId(), returnedAt: null });

      await assert.rejects(
        () => assetService.assignAsset(orgA, inStockAsset._id, { assignedTo: technicianUser._id }, assetManagerUser),
        (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('Conflicting active assignment')
      );
    } finally {
      Asset.findOne = origFindOneAsset;
      AssetAssignment.findOne = origFindOneAssignment;
    }
  });

  await test('Asset return sets returnedAt, returnCondition, resets Asset to IN_STOCK, and logs audit', async () => {
    const origFindOneAsset = Asset.findOne;
    const origFindOneAssignment = AssetAssignment.findOne;
    try {
      const mockAsset = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        status: 'ASSIGNED',
        currentAssigneeId: employeeUser._id,
        save: function () {
          return Promise.resolve(this);
        },
      };

      const mockAssignment = {
        _id: new mongoose.Types.ObjectId(),
        assetId: mockAsset._id,
        organizationId: orgA,
        returnedAt: null,
        returnCondition: null,
        save: function () {
          return Promise.resolve(this);
        },
      };

      Asset.findOne = () => Promise.resolve(mockAsset);
      AssetAssignment.findOne = () => Promise.resolve(mockAssignment);

      capturedAuditLogs = [];
      const result = await assetService.returnAsset(
        orgA,
        mockAsset._id,
        { returnCondition: 'EXCELLENT', notes: 'Returned upon project completion' },
        assetManagerUser
      );

      assert.strictEqual(mockAsset.status, 'IN_STOCK');
      assert.strictEqual(mockAsset.currentAssigneeId, null);
      assert.notStrictEqual(mockAssignment.returnedAt, null);
      assert.strictEqual(mockAssignment.returnCondition, 'EXCELLENT');
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'ASSET_RETURNED'), true);
    } finally {
      Asset.findOne = origFindOneAsset;
      AssetAssignment.findOne = origFindOneAssignment;
    }
  });

  await test('Asset assignment history retrieves records for valid asset in organization', async () => {
    const origFindOneAsset = Asset.findOne;
    const origFindAssignment = AssetAssignment.find;
    try {
      const assetId = new mongoose.Types.ObjectId();
      Asset.findOne = () => ({
        populate: () => ({
          populate: () => ({
            populate: () => Promise.resolve({ _id: assetId, organizationId: orgA }),
          }),
        }),
      });

      const mockHistory = [
        { _id: new mongoose.Types.ObjectId(), assetId, assignedTo: employeeUser._id, returnedAt: new Date() },
        { _id: new mongoose.Types.ObjectId(), assetId, assignedTo: technicianUser._id, returnedAt: null },
      ];

      AssetAssignment.find = ({ assetId: qAssetId, organizationId }) => ({
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve(mockHistory),
          }),
        }),
      });

      const history = await assetService.getAssetAssignments(orgA, assetId, assetManagerUser);
      assert.strictEqual(history.length, 2);
    } finally {
      Asset.findOne = origFindOneAsset;
      AssetAssignment.find = origFindAssignment;
    }
  });

  // ==========================================
  // 4. TICKET-ASSET LINKING TESTS
  // ==========================================
  console.log('--- 4. Ticket-Asset Linking Tests ---');

  await test('Linking asset to ticket validates organization boundary and employee authorization', async () => {
    const origFindOneTicket = Ticket.findOne;
    const origFindOneAsset = Asset.findOne;
    try {
      const mockTicket = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        departmentId: deptIT,
        requesterId: employeeUser._id,
        relatedAssetId: null,
        save: function () {
          return Promise.resolve(this);
        },
      };

      Ticket.findOne = () => Promise.resolve(mockTicket);

      // Asset in different organization (returns null)
      Asset.findOne = ({ _id, organizationId }) => Promise.resolve(null);
      await assert.rejects(
        () => ticketService.linkAssetToTicket(orgA, mockTicket._id, new mongoose.Types.ObjectId(), employeeUser),
        (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('not found or belongs to another')
      );

      // Asset belongs to someone else and employee is requester
      const otherUserAsset = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        currentAssigneeId: new mongoose.Types.ObjectId(),
        departmentId: deptHR, // different department
      };
      Asset.findOne = () => Promise.resolve(otherUserAsset);

      await assert.rejects(
        () => ticketService.linkAssetToTicket(orgA, mockTicket._id, otherUserAsset._id, employeeUser),
        (err) => err instanceof AppError && err.statusCode === 403 && err.message.includes('not authorized to link')
      );

      // Asset assigned to the employee -> succeeds!
      const employeeAssignedAsset = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        currentAssigneeId: employeeUser._id,
        departmentId: deptIT,
      };
      Asset.findOne = () => Promise.resolve(employeeAssignedAsset);

      capturedAuditLogs = [];
      const updatedTicket = await ticketService.linkAssetToTicket(
        orgA,
        mockTicket._id,
        employeeAssignedAsset._id,
        employeeUser
      );
      assert.strictEqual(updatedTicket.relatedAssetId.toString(), employeeAssignedAsset._id.toString());
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'TICKET_ASSET_LINKED'), true);
    } finally {
      Ticket.findOne = origFindOneTicket;
      Asset.findOne = origFindOneAsset;
    }
  });

  // ==========================================
  // 5. KNOWLEDGE BASE TESTS
  // ==========================================
  console.log('--- 5. Knowledge Base Tests ---');

  await test('Article creation requires title, content, valid category, and generates unique slug', async () => {
    const origFindOneCategory = Category.findOne;
    const origFindOneArticle = KnowledgeArticle.findOne;
    const origCreateArticle = KnowledgeArticle.create;
    try {
      Category.findOne = () => Promise.resolve({ _id: new mongoose.Types.ObjectId(), organizationId: orgA, isActive: true });

      // Simulate slug collision on first try, available on second
      let callCount = 0;
      KnowledgeArticle.findOne = () => {
        callCount++;
        return {
          select: () => {
            if (callCount === 1) return Promise.resolve({ _id: new mongoose.Types.ObjectId() });
            return Promise.resolve(null);
          },
        };
      };

      let createdArticle = null;
      KnowledgeArticle.create = (doc) => {
        createdArticle = { _id: new mongoose.Types.ObjectId(), ...doc };
        return Promise.resolve(createdArticle);
      };

      capturedAuditLogs = [];
      const article = await knowledgeArticleService.createArticle(
        orgA,
        {
          title: 'How to Reset Your VPN Password',
          content: 'Follow these steps to reset VPN...',
          categoryId: new mongoose.Types.ObjectId(),
          tags: ['vpn', 'password'],
        },
        technicianUser
      );

      assert.strictEqual(article.slug, 'how-to-reset-your-vpn-password-2');
      assert.strictEqual(article.status, 'DRAFT');
      assert.strictEqual(article.visibility, 'PUBLIC');
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'ARTICLE_CREATED'), true);
    } finally {
      Category.findOne = origFindOneCategory;
      KnowledgeArticle.findOne = origFindOneArticle;
      KnowledgeArticle.create = origCreateArticle;
    }
  });

  await test('Article listing strictly prevents employees from seeing drafts or internal articles', async () => {
    const origFind = KnowledgeArticle.find;
    const origCount = KnowledgeArticle.countDocuments;
    try {
      let capturedFilter = null;
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
      KnowledgeArticle.countDocuments = () => Promise.resolve(0);

      // 1. Employee query forces status: 'PUBLISHED' and visibility: 'PUBLIC'
      await knowledgeArticleService.getArticles(orgA, employeeUser, { status: 'DRAFT', visibility: 'INTERNAL_ONLY' });
      assert.strictEqual(capturedFilter.status, 'PUBLISHED', 'Employee must not be able to override status');
      assert.strictEqual(capturedFilter.visibility, 'PUBLIC', 'Employee must not be able to override visibility');

      // 2. Technician can filter drafts and internal articles
      await knowledgeArticleService.getArticles(orgA, technicianUser, { status: 'DRAFT', visibility: 'INTERNAL_ONLY' });
      assert.strictEqual(capturedFilter.status, 'DRAFT');
      assert.strictEqual(capturedFilter.visibility, 'INTERNAL_ONLY');
    } finally {
      KnowledgeArticle.find = origFind;
      KnowledgeArticle.countDocuments = origCount;
    }
  });

  await test('Get article by ID or slug enforces employee visibility and increments view count', async () => {
    const origFindOne = KnowledgeArticle.findOne;
    try {
      // Internal draft article
      const draftArticle = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        slug: 'internal-admin-procedure',
        status: 'DRAFT',
        visibility: 'INTERNAL_ONLY',
        viewCount: 5,
        save: function () {
          return Promise.resolve(this);
        },
      };

      KnowledgeArticle.findOne = () => ({
        populate: () => ({
          populate: () => ({
            populate: () => Promise.resolve(draftArticle),
          }),
        }),
      });

      // Employee cannot view draft
      await assert.rejects(
        () => knowledgeArticleService.getArticleByIdOrSlug(orgA, 'internal-admin-procedure', employeeUser),
        (err) => err instanceof AppError && err.statusCode === 403
      );

      // Technician can view and viewCount increments
      const viewedArticle = await knowledgeArticleService.getArticleByIdOrSlug(
        orgA,
        'internal-admin-procedure',
        technicianUser
      );
      assert.strictEqual(viewedArticle.viewCount, 6);
    } finally {
      KnowledgeArticle.findOne = origFindOne;
    }
  });

  await test('Article publishing, archiving, and review update dates, statuses, and audit log', async () => {
    const origFindOne = KnowledgeArticle.findOne;
    try {
      const mockArticle = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        authorId: technicianUser._id,
        status: 'DRAFT',
        visibility: 'PUBLIC',
        lastReviewedAt: null,
        reviewedBy: null,
        save: function () {
          return Promise.resolve(this);
        },
      };

      KnowledgeArticle.findOne = () => Promise.resolve(mockArticle);

      // Publish
      capturedAuditLogs = [];
      await knowledgeArticleService.publishArticle(orgA, mockArticle._id, technicianUser);
      assert.strictEqual(mockArticle.status, 'PUBLISHED');
      assert.notStrictEqual(mockArticle.lastReviewedAt, null);
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'ARTICLE_PUBLISHED'), true);

      // Archive
      await knowledgeArticleService.archiveArticle(orgA, mockArticle._id, technicianUser);
      assert.strictEqual(mockArticle.status, 'ARCHIVED');
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'ARTICLE_ARCHIVED'), true);

      // Review
      await knowledgeArticleService.reviewArticle(orgA, mockArticle._id, itManagerUser);
      assert.strictEqual(mockArticle.reviewedBy.toString(), itManagerUser._id.toString());
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'ARTICLE_REVIEWED'), true);
    } finally {
      KnowledgeArticle.findOne = origFindOne;
    }
  });

  await test('Helpfulness feedback increments helpfulVotes or notHelpfulVotes safely', async () => {
    const origFindOne = KnowledgeArticle.findOne;
    try {
      const publishedArticle = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        helpfulVotes: 10,
        notHelpfulVotes: 2,
        save: function () {
          return Promise.resolve(this);
        },
      };

      KnowledgeArticle.findOne = () => Promise.resolve(publishedArticle);

      // Vote helpful
      const resHelpful = await knowledgeArticleService.voteFeedback(orgA, publishedArticle._id, { vote: 'helpful' }, employeeUser);
      assert.strictEqual(resHelpful.helpfulVotes, 11);

      // Vote not helpful
      const resNotHelpful = await knowledgeArticleService.voteFeedback(orgA, publishedArticle._id, { vote: 'notHelpful' }, employeeUser);
      assert.strictEqual(resNotHelpful.notHelpfulVotes, 3);

      // Invalid vote
      await assert.rejects(
        () => knowledgeArticleService.voteFeedback(orgA, publishedArticle._id, { vote: 'maybe' }, employeeUser),
        (err) => err instanceof AppError && err.statusCode === 400
      );
    } finally {
      KnowledgeArticle.findOne = origFindOne;
    }
  });

  await test('Article deletion is restricted to managers and system admins', async () => {
    const origFindOne = KnowledgeArticle.findOne;
    const origDeleteOne = KnowledgeArticle.deleteOne;
    try {
      const mockArticle = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgA,
        title: 'Article to Delete',
        slug: 'article-to-delete',
      };
      KnowledgeArticle.findOne = () => Promise.resolve(mockArticle);
      KnowledgeArticle.deleteOne = () => Promise.resolve({ deletedCount: 1 });

      // Employee cannot delete (403)
      await assert.rejects(
        () => knowledgeArticleService.deleteArticle(orgA, mockArticle._id, employeeUser),
        (err) => err instanceof AppError && err.statusCode === 403
      );

      // Technician cannot delete (403)
      await assert.rejects(
        () => knowledgeArticleService.deleteArticle(orgA, mockArticle._id, technicianUser),
        (err) => err instanceof AppError && err.statusCode === 403
      );

      // IT Manager can delete
      capturedAuditLogs = [];
      const res = await knowledgeArticleService.deleteArticle(orgA, mockArticle._id, itManagerUser);
      assert.strictEqual(res.message, 'Article deleted successfully');
      assert.strictEqual(capturedAuditLogs.some((l) => l.action === 'ARTICLE_DELETED'), true);
    } finally {
      KnowledgeArticle.findOne = origFindOne;
      KnowledgeArticle.deleteOne = origDeleteOne;
    }
  });

  // ==========================================
  // 6. ROUTE & RBAC AUTHORIZATION TESTS
  // ==========================================
  console.log('--- 6. Route and RBAC Authorization Tests ---');

  const authorize = require('../src/middleware/authorize');

  await test('Vendor and asset management authorize middleware rejects employees with 403', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER');

    let errReceived = null;
    mw({ user: employeeUser }, {}, (err) => {
      errReceived = err;
    });

    assert.ok(errReceived);
    assert.strictEqual(errReceived.statusCode, 403);
    assert.strictEqual(errReceived.message, 'You do not have permission to perform this action');
  });

  await test('Vendor and asset management authorize middleware permits ASSET_MANAGER, IT_MANAGER, and SYSTEM_ADMIN', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER');

    for (const allowedUser of [assetManagerUser, itManagerUser, systemAdminUser]) {
      let errReceived = null;
      let nextCalled = false;
      mw({ user: allowedUser }, {}, (err) => {
        errReceived = err;
        nextCalled = true;
      });
      assert.strictEqual(errReceived, undefined);
      assert.strictEqual(nextCalled, true);
    }
  });

  await test('Vendor viewing permits TECHNICIAN but rejects EMPLOYEE', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER', 'TECHNICIAN');

    let techErr = null;
    mw({ user: technicianUser }, {}, (err) => {
      techErr = err;
    });
    assert.strictEqual(techErr, undefined);

    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => {
      empErr = err;
    });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);
  });

  await test('Knowledge article authoring permits TECHNICIAN but strictly rejects EMPLOYEE', async () => {
    const mw = authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN');

    let techErr = null;
    mw({ user: technicianUser }, {}, (err) => {
      techErr = err;
    });
    assert.strictEqual(techErr, undefined);

    let empErr = null;
    mw({ user: employeeUser }, {}, (err) => {
      empErr = err;
    });
    assert.ok(empErr);
    assert.strictEqual(empErr.statusCode, 403);
  });
  console.log(`\nStep 20 Tests Completed: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStep20Tests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runStep20Tests };
