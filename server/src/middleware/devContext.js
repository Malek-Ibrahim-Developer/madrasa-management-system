/**
 * Development Context Middleware — Phase 2A
 * 
 * Provides deterministic institution and role context for development.
 * 
 * Security rules:
 * - Disabled in production
 * - Institution context comes ONLY from server env (DEV_INSTITUTION_ID)
 * - Role comes from X-Dev-Role header (set by frontend DevRoleSwitcher)
 * - Falls back to DEV_ROLE env var if no header present
 * - Never accepts client-supplied institutionId
 * 
 * Sets:
 *   req.institutionId — server-derived institution context
 *   req.devRole — current development role for RBAC
 *   req.devContext — legacy compatibility object
 */

const AppError = require('../utils/AppError');
const { DEV_ROLES } = require('../config/permissions');

function devContext(req, res, next) {
  // In production, institution context must come from authenticated user
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  const institutionId = process.env.DEV_INSTITUTION_ID || null;
  
  // Role from header (frontend DevRoleSwitcher) or env fallback
  const headerRole = req.headers['x-dev-role'];
  const role = (headerRole && Object.values(DEV_ROLES).includes(headerRole))
    ? headerRole
    : (process.env.DEV_ROLE || 'ADMIN');

  // Set canonical request properties
  req.institutionId = institutionId;
  req.devRole = role;

  // Legacy compatibility
  req.devContext = {
    institutionId,
    role,
  };

  next();
}

module.exports = devContext;
