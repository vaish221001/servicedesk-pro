const Category = require('../models/Category');
const Department = require('../models/Department');
const SlaPolicy = require('../models/SlaPolicy');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('./auditService');

/**
 * Creates a new category or subcategory within the organization.
 */
const createCategory = async (organizationId, data, actor, req = null) => {
  const {
    name,
    departmentId,
    parentId = null,
    defaultPriority = 'MEDIUM',
    defaultSlaPolicyId = null,
    defaultAssigneeId = null,
    isActive = true,
  } = data;

  if (!name || !name.trim()) {
    throw new AppError('Category name is required', 400);
  }

  if (!departmentId) {
    throw new AppError('Department ID is required', 400);
  }

  // 1. Verify Department exists within the same organization
  const department = await Department.findOne({ _id: departmentId, organizationId, isActive: true });
  if (!department) {
    throw new AppError('Invalid department or department belongs to another organization', 400);
  }

  // 2. Validate Parent Category if provided (Subcategory creation)
  if (parentId) {
    const parentCategory = await Category.findOne({ _id: parentId, organizationId, isActive: true });
    if (!parentCategory) {
      throw new AppError('Parent category not found or belongs to another organization', 400);
    }

    // Ensure parent category belongs to the same department
    if (parentCategory.departmentId.toString() !== departmentId.toString()) {
      throw new AppError('Subcategory department must match parent category department', 400);
    }

    // Prevent multi-tier nesting beyond 2 tiers (parent cannot itself have a parent)
    if (parentCategory.parentId) {
      throw new AppError('Subcategories cannot have subcategories (maximum 2-level taxonomy supported)', 400);
    }
  }

  // 3. Validate SLA Policy if provided
  if (defaultSlaPolicyId) {
    const slaPolicy = await SlaPolicy.findOne({ _id: defaultSlaPolicyId, organizationId, isActive: true });
    if (!slaPolicy) {
      throw new AppError('Default SLA policy not found or belongs to another organization', 400);
    }
  }

  // 4. Validate Default Assignee if provided
  if (defaultAssigneeId) {
    const assignee = await User.findOne({ _id: defaultAssigneeId, organizationId, isActive: true });
    if (!assignee) {
      throw new AppError('Default assignee not found or account is inactive', 400);
    }
    if (!['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(assignee.role)) {
      throw new AppError('Default assignee must have a technical role (TECHNICIAN, IT_MANAGER, SYSTEM_ADMIN)', 400);
    }
  }

  const category = await Category.create({
    organizationId,
    departmentId,
    name: name.trim(),
    parentId,
    defaultPriority,
    defaultSlaPolicyId,
    defaultAssigneeId,
    isActive,
  });

  // Audit Logging
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'CATEGORY_CREATED',
    entityType: 'CATEGORY',
    entityId: category._id,
    details: { name: category.name, departmentId, parentId, isSubcategory: !!parentId },
    req,
  });

  return category;
};

/**
 * Lists categories within the organization with optional filtering.
 */
const getCategories = async (organizationId, query = {}, userRole = 'EMPLOYEE') => {
  const filter = { organizationId };

  if (query.departmentId) {
    filter.departmentId = query.departmentId;
  }

  if (query.parentId !== undefined) {
    if (query.parentId === 'null' || query.parentId === null) {
      filter.parentId = null; // Top-level categories only
    } else {
      filter.parentId = query.parentId; // Subcategories of a specific parent
    }
  }

  // Non-admins only see active categories by default unless specified
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  } else if (userRole === 'EMPLOYEE') {
    filter.isActive = true;
  }

  const categories = await Category.find(filter)
    .populate('departmentId', 'name code')
    .populate('parentId', 'name')
    .populate('defaultSlaPolicyId', 'name')
    .populate('defaultAssigneeId', 'firstName lastName email role')
    .sort({ name: 1 });

  return categories;
};

/**
 * Retrieves a single category by ID within the organization.
 */
const getCategoryById = async (organizationId, categoryId) => {
  const category = await Category.findOne({ _id: categoryId, organizationId })
    .populate('departmentId', 'name code')
    .populate('parentId', 'name')
    .populate('defaultSlaPolicyId', 'name targets')
    .populate('defaultAssigneeId', 'firstName lastName email role');

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  return category;
};

/**
 * Updates an existing category within the organization.
 */
const updateCategory = async (organizationId, categoryId, data, actor, req = null) => {
  const category = await Category.findOne({ _id: categoryId, organizationId });
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  const previousSnapshot = {
    name: category.name,
    departmentId: category.departmentId,
    parentId: category.parentId,
    isActive: category.isActive,
  };

  // Name
  if (data.name !== undefined) {
    if (!data.name.trim()) throw new AppError('Category name cannot be empty', 400);
    category.name = data.name.trim();
  }

  // Department
  if (data.departmentId && data.departmentId.toString() !== category.departmentId.toString()) {
    const department = await Department.findOne({ _id: data.departmentId, organizationId, isActive: true });
    if (!department) throw new AppError('Invalid department or belongs to another organization', 400);
    category.departmentId = data.departmentId;
  }

  // Parent Category
  if (data.parentId !== undefined) {
    if (data.parentId) {
      if (data.parentId.toString() === categoryId.toString()) {
        throw new AppError('Category cannot be its own parent', 400);
      }
      const parent = await Category.findOne({ _id: data.parentId, organizationId, isActive: true });
      if (!parent) throw new AppError('Parent category not found or belongs to another organization', 400);
      if (parent.parentId) throw new AppError('Multi-level nesting beyond 2 tiers is not allowed', 400);
      category.parentId = data.parentId;
    } else {
      category.parentId = null;
    }
  }

  // Default Priority
  if (data.defaultPriority) {
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(data.defaultPriority)) {
      throw new AppError('Invalid default priority value', 400);
    }
    category.defaultPriority = data.defaultPriority;
  }

  // Default SLA Policy
  if (data.defaultSlaPolicyId !== undefined) {
    if (data.defaultSlaPolicyId) {
      const policy = await SlaPolicy.findOne({ _id: data.defaultSlaPolicyId, organizationId, isActive: true });
      if (!policy) throw new AppError('SLA policy not found or belongs to another organization', 400);
      category.defaultSlaPolicyId = data.defaultSlaPolicyId;
    } else {
      category.defaultSlaPolicyId = null;
    }
  }

  // Default Assignee
  if (data.defaultAssigneeId !== undefined) {
    if (data.defaultAssigneeId) {
      const assignee = await User.findOne({ _id: data.defaultAssigneeId, organizationId, isActive: true });
      if (!assignee) throw new AppError('Assignee user not found or inactive', 400);
      if (!['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(assignee.role)) {
        throw new AppError('Assignee must have a technical role', 400);
      }
      category.defaultAssigneeId = data.defaultAssigneeId;
    } else {
      category.defaultAssigneeId = null;
    }
  }

  // Active status
  if (data.isActive !== undefined) {
    category.isActive = !!data.isActive;
  }

  await category.save();

  // Audit Logging
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'CATEGORY_UPDATED',
    entityType: 'CATEGORY',
    entityId: category._id,
    details: { previous: previousSnapshot, updated: { name: category.name, isActive: category.isActive } },
    req,
  });

  return category;
};

/**
 * Deactivates or removes a category.
 */
const deleteCategory = async (organizationId, categoryId, actor, req = null) => {
  const category = await Category.findOne({ _id: categoryId, organizationId });
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  // Check if any subcategories exist under this category
  const subcategoryCount = await Category.countDocuments({ parentId: category._id, organizationId });
  if (subcategoryCount > 0) {
    throw new AppError('Cannot delete category with existing subcategories. Reassign or remove subcategories first.', 400);
  }

  // Soft deactivate to preserve referential integrity for existing tickets
  category.isActive = false;
  await category.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'CATEGORY_DELETED',
    entityType: 'CATEGORY',
    entityId: category._id,
    details: { name: category.name, softDeleted: true },
    req,
  });

  return { message: 'Category deactivated successfully' };
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
