/**
 * Temporary Development Context Middleware
 * Altus Kairos — Phase 1 Architecture
 * 
 * Provides deterministic institution and role context for local development
 * without requiring real login/password authentication.
 * 
 * Security rules:
 * - Disabled in production
 * - Never accepts arbitrary client-supplied institutionId
 * - No silent arbitrary fallback
 */

function devContext(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  req.devContext = {
    institutionId: process.env.DEV_INSTITUTION_ID || null,
    role: process.env.DEV_ROLE || 'ADMIN',
  };

  next();
}

module.exports = devContext;
