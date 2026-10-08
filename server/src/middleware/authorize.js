const AppError = require('../utils/AppError');

/**
 * Role-Based Authorization Middleware
 *
 * Restricts access to users having one of the specified roles.
 * Relies strictly on the authoritative database record populated on req.user
 * by the authentication middleware, never trusting client or token claims.
 *
 * Supported roles:
 * - SYSTEM_ADMIN
 * - IT_MANAGER
 * - TECHNICIAN
 * - EMPLOYEE
 * - ASSET_MANAGER
 *
 * @param {...string} allowedRoles - List of permitted role names
 * @returns {import('express').RequestHandler} Express middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // 1. Guard against invocation without preceding auth middleware
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    // 2. Check if the database-loaded user role matches any allowed role
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

module.exports = authorize;
