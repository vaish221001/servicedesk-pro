const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('./auditService');

const VALID_ROLES = ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'];

/**
 * ServiceDesk Pro — User Management Service
 *
 * Implements organization-scoped user administrative capabilities,
 * role management, deactivation protection, and audit logging.
 */

/**
 * List users with pagination, regex search, and multi-criteria filters.
 */
const getUsers = async (organizationId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 15));
  const skip = (page - 1) * limit;

  const filter = { organizationId };

  // Filter by Role
  if (query.role && VALID_ROLES.includes(query.role)) {
    filter.role = query.role;
  }

  // Filter by Primary Department
  if (query.departmentId && mongoose.Types.ObjectId.isValid(query.departmentId)) {
    filter.departmentId = query.departmentId;
  }

  // Filter by Active Status
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (query.status === 'active' || query.status === 'true' || query.status === true) {
      filter.isActive = true;
    } else if (query.status === 'inactive' || query.status === 'false' || query.status === false) {
      filter.isActive = false;
    }
  } else if (query.isActive !== undefined && query.isActive !== null && query.isActive !== '') {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  // Keyword Search across firstName, lastName, email, jobTitle
  if (query.search && query.search.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { jobTitle: searchRegex },
    ];
  }

  // Sorting
  const sort = query.sort || '-createdAt';

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .populate('departmentId', 'name code')
      .populate('assignedDepartments', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Retrieve single user by ID within the tenant organization.
 */
const getUserById = async (organizationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid User ID', 400);
  }

  const user = await User.findOne({ _id: userId, organizationId })
    .select('-password')
    .populate('departmentId', 'name code')
    .populate('assignedDepartments', 'name code');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
};

/**
 * Create a new user with secure password hashing and organization boundary validation.
 */
const createUser = async (organizationId, data, actor, req = null) => {
  const {
    firstName,
    lastName,
    email,
    password,
    role = 'EMPLOYEE',
    departmentId,
    assignedDepartments = [],
    phone,
    jobTitle,
    isActive = true,
  } = data;

  // Validation
  if (!firstName || !firstName.trim()) {
    throw new AppError('First name is required', 400);
  }
  if (!lastName || !lastName.trim()) {
    throw new AppError('Last name is required', 400);
  }
  if (!email || !email.trim()) {
    throw new AppError('Email address is required', 400);
  }
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email.trim())) {
    throw new AppError('Please provide a valid email address', 400);
  }
  if (!password || password.length < 8) {
    throw new AppError('Password is required and must be at least 8 characters', 400);
  }
  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, 400);
  }
  if (!departmentId || !mongoose.Types.ObjectId.isValid(departmentId)) {
    throw new AppError('Valid Department ID is required', 400);
  }

  // 1. Check duplicate email in entire database
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('A user with this email address already exists', 400);
  }

  // 2. Validate primary Department in organization
  const dept = await Department.findOne({ _id: departmentId, organizationId, isActive: true });
  if (!dept) {
    throw new AppError('Department not found or belongs to another organization', 400);
  }

  // 3. Validate assigned secondary departments if provided
  const validAssignedDepts = [];
  if (Array.isArray(assignedDepartments) && assignedDepartments.length > 0) {
    for (const dId of assignedDepartments) {
      if (mongoose.Types.ObjectId.isValid(dId)) {
        const secondaryDept = await Department.findOne({ _id: dId, organizationId, isActive: true });
        if (secondaryDept) {
          validAssignedDepts.push(secondaryDept._id);
        }
      }
    }
  }

  // 4. Create user (Mongoose pre-save hook will hash the password)
  const newUser = await User.create({
    organizationId,
    departmentId: dept._id,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    password,
    role,
    phone: phone ? phone.trim() : undefined,
    jobTitle: jobTitle ? jobTitle.trim() : undefined,
    assignedDepartments: validAssignedDepts,
    isActive: Boolean(isActive),
  });

  // 5. Audit log
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'USER_CREATED',
    entityType: 'USER',
    entityId: newUser._id,
    details: {
      name: `${newUser.firstName} ${newUser.lastName}`,
      email: newUser.email,
      role: newUser.role,
      department: dept.name,
    },
    req,
  });

  // Return user without password
  return getUserById(organizationId, newUser._id);
};

/**
 * Update user details, role, department, or reset password.
 */
const updateUser = async (organizationId, userId, updateData, actor, req = null) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid User ID', 400);
  }

  const user = await User.findOne({ _id: userId, organizationId });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const auditChanges = {};

  // 1. Role Change & Last Admin Protection
  if (updateData.role && updateData.role !== user.role) {
    if (!VALID_ROLES.includes(updateData.role)) {
      throw new AppError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, 400);
    }

    // Guard: Prevent demoting the last active SYSTEM_ADMIN
    if (user.role === 'SYSTEM_ADMIN' && updateData.role !== 'SYSTEM_ADMIN') {
      const activeAdminCount = await User.countDocuments({
        organizationId,
        role: 'SYSTEM_ADMIN',
        isActive: true,
        _id: { $ne: user._id },
      });

      if (activeAdminCount === 0) {
        throw new AppError('Cannot demote the last active SYSTEM_ADMIN in the organization', 400);
      }
    }

    auditChanges.role = { from: user.role, to: updateData.role };
    user.role = updateData.role;
  }

  // 2. Email Change
  if (updateData.email && updateData.email.toLowerCase().trim() !== user.email) {
    const normalizedEmail = updateData.email.toLowerCase().trim();
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new AppError('Please provide a valid email address', 400);
    }

    const emailTaken = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
    if (emailTaken) {
      throw new AppError('A user with this email address already exists', 400);
    }

    auditChanges.email = { from: user.email, to: normalizedEmail };
    user.email = normalizedEmail;
  }

  // 3. Department Change
  if (updateData.departmentId && updateData.departmentId.toString() !== user.departmentId.toString()) {
    if (!mongoose.Types.ObjectId.isValid(updateData.departmentId)) {
      throw new AppError('Invalid Department ID', 400);
    }

    const dept = await Department.findOne({
      _id: updateData.departmentId,
      organizationId,
      isActive: true,
    });
    if (!dept) {
      throw new AppError('Department not found or belongs to another organization', 400);
    }

    auditChanges.departmentId = { from: user.departmentId, to: dept._id };
    user.departmentId = dept._id;
  }

  // 4. Assigned Departments
  if (updateData.assignedDepartments !== undefined) {
    const validDepts = [];
    if (Array.isArray(updateData.assignedDepartments)) {
      for (const dId of updateData.assignedDepartments) {
        if (mongoose.Types.ObjectId.isValid(dId)) {
          const sDept = await Department.findOne({ _id: dId, organizationId, isActive: true });
          if (sDept) validDepts.push(sDept._id);
        }
      }
    }
    user.assignedDepartments = validDepts;
  }

  // 5. Standard Profile Attributes
  if (updateData.firstName && updateData.firstName.trim()) {
    user.firstName = updateData.firstName.trim();
  }
  if (updateData.lastName && updateData.lastName.trim()) {
    user.lastName = updateData.lastName.trim();
  }
  if (updateData.phone !== undefined) {
    user.phone = updateData.phone ? updateData.phone.trim() : undefined;
  }
  if (updateData.jobTitle !== undefined) {
    user.jobTitle = updateData.jobTitle ? updateData.jobTitle.trim() : undefined;
  }

  // 6. Optional Password Reset
  if (updateData.password) {
    if (updateData.password.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400);
    }
    user.password = updateData.password;
    auditChanges.passwordReset = true;
  }

  // 7. Active Status update if passed directly in updateData
  if (updateData.isActive !== undefined && updateData.isActive !== user.isActive) {
    const targetStatus = Boolean(updateData.isActive);
    if (!targetStatus) {
      // Guard self-deactivation
      if (user._id.toString() === actor._id.toString()) {
        throw new AppError('Administrators cannot deactivate their own account', 400);
      }
      // Guard last active admin
      if (user.role === 'SYSTEM_ADMIN') {
        const otherAdmins = await User.countDocuments({
          organizationId,
          role: 'SYSTEM_ADMIN',
          isActive: true,
          _id: { $ne: user._id },
        });
        if (otherAdmins === 0) {
          throw new AppError('Cannot deactivate the last active SYSTEM_ADMIN in the organization', 400);
        }
      }
    }
    auditChanges.isActive = { from: user.isActive, to: targetStatus };
    user.isActive = targetStatus;
  }

  await user.save();

  // Audit log
  if (Object.keys(auditChanges).length > 0) {
    await createAuditLog({
      organizationId,
      actorType: 'HUMAN',
      actorId: actor._id,
      actorRole: actor.role,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user._id,
      details: auditChanges,
      req,
    });
  }

  return getUserById(organizationId, user._id);
};

/**
 * Toggle user active/inactive status with safety guardrails against self-deactivation
 * and last-admin deactivation.
 */
const setUserStatus = async (organizationId, userId, isActive, actor, req = null) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid User ID', 400);
  }

  const user = await User.findOne({ _id: userId, organizationId });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const targetStatus = Boolean(isActive);

  // If already at requested status, return early
  if (user.isActive === targetStatus) {
    return getUserById(organizationId, user._id);
  }

  // Guard: Deactivation rules
  if (!targetStatus) {
    // 1. Admin cannot deactivate themselves
    if (user._id.toString() === actor._id.toString()) {
      throw new AppError('Administrators cannot deactivate their own account', 400);
    }

    // 2. Cannot deactivate the last active SYSTEM_ADMIN
    if (user.role === 'SYSTEM_ADMIN') {
      const activeAdminCount = await User.countDocuments({
        organizationId,
        role: 'SYSTEM_ADMIN',
        isActive: true,
        _id: { $ne: user._id },
      });

      if (activeAdminCount === 0) {
        throw new AppError('Cannot deactivate the last active SYSTEM_ADMIN in the organization', 400);
      }
    }
  }

  user.isActive = targetStatus;
  await user.save();

  // Audit log
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: targetStatus ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'USER',
    entityId: user._id,
    details: {
      userEmail: user.email,
      newStatus: targetStatus ? 'ACTIVE' : 'INACTIVE',
    },
    req,
  });

  return getUserById(organizationId, user._id);
};

/**
 * Retrieves all active departments within the organization for user form selection.
 */
const getDepartments = async (organizationId) => {
  return Department.find({ organizationId, isActive: true })
    .select('name code description')
    .sort('name')
    .lean();
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  setUserStatus,
  getDepartments,
  VALID_ROLES,
};
