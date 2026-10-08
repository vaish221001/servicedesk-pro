const mongoose = require('mongoose');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * Authentication Middleware
 * Validates the JWT Bearer token, fetches the current user from the database,
 * and ensures the account exists, is active, and is not using forged/stale token claims.
 */
const auth = async (req, res, next) => {
  try {
    // 1. Check for Authorization header with Bearer token
    const authHeader = req.headers && req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication token is required', 401));
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      return next(new AppError('Authentication token is required', 401));
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Authentication token has expired', 401));
      }
      if (err.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid authentication token', 401));
      }
      // If it's a configuration error (e.g. missing JWT_SECRET), pass along
      if (err.isOperational && err.statusCode === 500) {
        return next(err);
      }
      return next(new AppError('Invalid authentication token', 401));
    }

    // 3. Extract user ID from token payload
    const userId = decoded.id || decoded.sub || decoded.userId || decoded._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return next(new AppError('Invalid authentication token', 401));
    }

    // 4. Load fresh user record from the database (never trust token claims for role or organization)
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return next(new AppError('User belonging to this token no longer exists', 401));
    }

    // 5. Check if user account is active
    if (!user.isActive) {
      return next(new AppError('User account is inactive', 401));
    }

    // 6. Attach authoritative database user to req
    req.user = user;

    next();
  } catch (err) {
    next(err);
  }
};

auth.protect = auth;
auth.auth = auth;

module.exports = auth;
