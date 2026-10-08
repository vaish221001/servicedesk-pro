const AppError = require('./AppError');

/**
 * Department Access Helper
 *
 * Enforces organization boundary separation and department-level authorization
 * utilizing the user's primary departmentId, assignedDepartments list, and system role.
 */

/**
 * Checks whether a user has permission to access a specific department.
 *
 * Access Rules:
 * 1. Multi-Tenant Boundary: The target organizationId must strictly match the user's organizationId.
 * 2. Organization-Wide Roles: SYSTEM_ADMIN and IT_MANAGER have access across all departments in their organization.
 * 3. Department-Restricted Roles: TECHNICIAN, EMPLOYEE, and ASSET_MANAGER have access if:
 *    - The department matches user.departmentId (primary department), OR
 *    - The department is in user.assignedDepartments (cross-assigned departments).
 *
 * @param {Object} user - The authenticated user record (req.user)
 * @param {string|import('mongoose').Types.ObjectId} targetDepartmentId - Department ID to access
 * @param {string|import('mongoose').Types.ObjectId} [targetOrganizationId] - Optional resource organization ID
 * @returns {boolean} True if access is permitted, false otherwise
 */
const hasDepartmentAccess = (user, targetDepartmentId, targetOrganizationId) => {
  if (!user || !user.organizationId) {
    return false;
  }

  // 1. Strict Organization Multi-Tenancy Boundary Enforcement
  if (targetOrganizationId) {
    const userOrgStr = user.organizationId.toString();
    const targetOrgStr = targetOrganizationId.toString();
    if (userOrgStr !== targetOrgStr) {
      return false; // Cross-organization access is strictly prohibited
    }
  }

  // 2. Global organizational roles
  if (user.role === 'SYSTEM_ADMIN' || user.role === 'IT_MANAGER') {
    return true;
  }

  if (!targetDepartmentId) {
    return false;
  }

  const targetDeptStr = targetDepartmentId.toString();

  // 3. Primary department match
  if (user.departmentId && user.departmentId.toString() === targetDeptStr) {
    return true;
  }

  // 4. Assigned departments list match (e.g., technician assigned to support multiple departments)
  if (Array.isArray(user.assignedDepartments)) {
    const isAssigned = user.assignedDepartments.some((dept) => {
      const id = dept && (dept._id || dept);
      return id && id.toString() === targetDeptStr;
    });

    if (isAssigned) {
      return true;
    }
  }

  return false;
};

/**
 * Returns a list of department IDs accessible by the user, or null if unrestricted within org.
 *
 * @param {Object} user - The authenticated user record
 * @returns {string[]|null} Array of department ID strings, or null for all departments in organization
 */
const getAllowedDepartmentIds = (user) => {
  if (!user) {
    return [];
  }

  // SYSTEM_ADMIN and IT_MANAGER have access to all departments in their organization
  if (user.role === 'SYSTEM_ADMIN' || user.role === 'IT_MANAGER') {
    return null;
  }

  const allowedIds = new Set();
  if (user.departmentId) {
    allowedIds.add(user.departmentId.toString());
  }

  if (Array.isArray(user.assignedDepartments)) {
    user.assignedDepartments.forEach((dept) => {
      const id = dept && (dept._id || dept);
      if (id) {
        allowedIds.add(id.toString());
      }
    });
  }

  return Array.from(allowedIds);
};

/**
 * Express middleware factory to protect future routes by department access.
 *
 * @param {Function|string} [deptExtractor] - Function (req => deptId) or param/body key name
 * @param {Function|string} [orgExtractor] - Function (req => orgId) or param/body key name
 * @returns {import('express').RequestHandler}
 */
const requireDepartmentAccess = (deptExtractor = 'departmentId', orgExtractor = 'organizationId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const deptId =
      typeof deptExtractor === 'function'
        ? deptExtractor(req)
        : req.params[deptExtractor] || req.body[deptExtractor] || req.query[deptExtractor];

    const orgId =
      typeof orgExtractor === 'function'
        ? orgExtractor(req)
        : req.params[orgExtractor] ||
          req.body[orgExtractor] ||
          req.query[orgExtractor] ||
          req.user.organizationId;

    if (!hasDepartmentAccess(req.user, deptId, orgId)) {
      return next(
        new AppError('You do not have permission to access resources in this department', 403)
      );
    }

    next();
  };
};

module.exports = {
  hasDepartmentAccess,
  getAllowedDepartmentIds,
  requireDepartmentAccess,
};
