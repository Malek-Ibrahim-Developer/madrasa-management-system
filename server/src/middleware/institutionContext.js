/**
 * Institution Context Guard — Phase 2A
 * 
 * Ensures req.institutionId is set before proceeding.
 * In development: set by devContext middleware
 * In production (future): set by auth middleware from req.user.institutionId
 */

const AppError = require('../utils/AppError');

function requireInstitutionContext(req, res, next) {
  // Future: if req.user exists (authenticated), use req.user.institutionId
  if (req.user && req.user.institution) {
    req.institutionId = req.user.institution.id;
  }

  if (!req.institutionId) {
    return next(new AppError(
      'Institution context is required',
      401,
      'INSTITUTION_CONTEXT_REQUIRED'
    ));
  }

  next();
}

module.exports = { requireInstitutionContext };
