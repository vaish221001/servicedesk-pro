/**
 * Custom Operational Error Class
 * Extends the built-in Error class to support HTTP status codes and operational error tracking.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode || 500;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
