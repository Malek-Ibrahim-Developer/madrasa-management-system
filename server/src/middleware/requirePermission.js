/**
 * Authorization Middleware — Phase 2A
 * 
 * Enforces RBAC permission checks on route handlers.
 * 
 * In development: Uses req.devRole with centralized ROLE_PERMISSIONS map
 * In production (future): Uses req.user.role with database permissions
 */

const AppError = require('../utils/AppError');
const { roleHasPermission } = require('../config/permissions');

/**
 * Route middleware ensuring the current identity has the required permission
 * @param {string} permissionCode - e.g. 'students.view', 'settings.manage'
 */
function requirePermission(permissionCode) {
  return (req, res, next) => {
    // Future production path: check req.user permissions from database
    if (req.user) {
      const userPerms = req.user.permissions || [];
      if (userPerms.includes('*') || userPerms.includes(permissionCode)) {
        return next();
      }
      if (req.user.role && req.user.role.name === 'Admin') {
        return next();
      }
      return next(new AppError(
        'You do not have permission to perform this action',
        403,
        'FORBIDDEN'
      ));
    }

    // Development path: check req.devRole against centralized permission map
    if (req.devRole) {
      if (roleHasPermission(req.devRole, permissionCode)) {
        return next();
      }
      return next(new AppError(
        'You do not have permission to perform this action',
        403,
        'FORBIDDEN'
      ));
    }

    // No identity at all
    return next(new AppError(
      'Authentication required',
      401,
      'AUTH_REQUIRED'
    ));
  };
}

module.exports = requirePermission;
