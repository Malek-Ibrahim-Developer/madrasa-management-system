/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (error, req, res, next) => {
  console.error('🚨 [ERROR OCCURRED IN API]:', {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    stack: error.stack,
  });

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    code: error.code || 'INTERNAL_ERROR',
    message: statusCode >= 500 ? 'An unexpected server error occurred' : error.message,
  });
};

module.exports = errorHandler;
