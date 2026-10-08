const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

/**
 * Signs a JWT with the given payload using JWT_SECRET and configured expiration.
 *
 * @param {Object} payload - Data payload to encode in the token
 * @param {Object} [options] - Additional jsonwebtoken sign options
 * @returns {string} Signed JWT string
 */
const signToken = (payload, options = {}) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('Server configuration error: JWT secret is missing', 500);
  }

  const defaultOptions = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };

  return jwt.sign(payload, secret, { ...defaultOptions, ...options });
};

/**
 * Verifies and decodes a JWT using JWT_SECRET.
 *
 * @param {string} token - The JWT string to verify
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('Server configuration error: JWT secret is missing', 500);
  }

  return jwt.verify(token, secret);
};

/**
 * Helper to generate an authentication token with a user ID in the payload.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId - User ID
 * @param {Object} [extraClaims] - Optional additional claims (token consumers must still verify DB)
 * @param {Object} [options] - Optional sign options
 * @returns {string} Signed JWT string
 */
const generateToken = (userId, extraClaims = {}, options = {}) => {
  return signToken({ id: userId, sub: userId, ...extraClaims }, options);
};

module.exports = {
  signToken,
  verifyToken,
  generateToken,
};
