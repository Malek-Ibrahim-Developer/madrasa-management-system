/**
 * Module Enforcement Middleware — Phase 2A
 * 
 * Checks if a module is enabled for the current institution.
 * Must be used AFTER institutionContext middleware.
 */

const AppError = require('../utils/AppError');
const { getInstitutionConfiguration } = require('../services/institutionConfigurationService');

/**
 * Route middleware that ensures a specific module is enabled
 * @param {string} moduleFlag - e.g. 'studentsEnabled', 'attendanceEnabled'
 */
function requireModuleEnabled(moduleFlag) {
  return async (req, res, next) => {
    try {
      if (!req.institutionId) {
        return next(new AppError(
          'Institution context is required',
          401,
          'INSTITUTION_CONTEXT_REQUIRED'
        ));
      }

      const config = await getInstitutionConfiguration(req.institutionId, req.prisma);

      if (!config || config[moduleFlag] === false) {
        return next(new AppError(
          'This module is disabled for the institution',
          403,
          'MODULE_DISABLED'
        ));
      }

      // Attach config to request for downstream use
      req.institutionConfig = config;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requireModuleEnabled;
