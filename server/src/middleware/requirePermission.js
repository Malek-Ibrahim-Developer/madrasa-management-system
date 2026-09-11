/**
 * Authorization Middleware — Enforces required RBAC permission on route handlers
 */

const AppError = require('../utils/AppError');
const permissionService = require('../services/permissionService');

/**
 * Route middleware ensuring req.user holds the required permission code
 * @param {string} permissionCode 
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication is required.', 401, 'AUTHENTICATION_REQUIRED');
      }

      const allowed = await permissionService.userHasPermission(
        req.prisma,
        req.user,
        permissionCode
      );

      if (!allowed) {
        throw new AppError(
          `You do not have permission to perform this action (${permissionCode}).`,
          403,
          'FORBIDDEN'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requirePermission;
