/**
 * 404 Not Found Middleware
 * Catches all requests to unmatched API routes and returns a standardized 404 JSON response.
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};

module.exports = notFound;
