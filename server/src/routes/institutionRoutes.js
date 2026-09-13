/**
 * Institution Routes — Phase 2A
 * Protected endpoints for institution profile and configuration
 */

const express = require('express');
const router = express.Router();

const AppError = require('../utils/AppError');
const requirePermission = require('../middleware/requirePermission');
const { requireInstitutionContext } = require('../middleware/institutionContext');
const {
  getInstitutionConfiguration,
  updateInstitutionConfiguration,
} = require('../services/institutionConfigurationService');
const auditService = require('../services/auditService');

const PROFILE_KEYS = [
  'name',
  'description',
  'phone',
  'email',
  'address',
  'logoUrl',
];

// All institution routes require institution context
router.use(requireInstitutionContext);

/**
 * GET /api/institution/configuration
 */
router.get('/configuration',
  requirePermission('settings.view'),
  async (req, res, next) => {
    try {
      const data = await getInstitutionConfiguration(req.institutionId, req.prisma);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/institution/configuration
 */
router.put('/configuration',
  requirePermission('settings.manage'),
  async (req, res, next) => {
    try {
      // Get before state for audit
      const beforeData = await getInstitutionConfiguration(req.institutionId, req.prisma);

      const data = await updateInstitutionConfiguration(
        req.institutionId,
        req.body,
        req.prisma
      );

      // Audit log
      await auditService.record(req.prisma, {
        institutionId: req.institutionId,
        action: 'CONFIGURATION_UPDATED',
        entityType: 'InstitutionConfiguration',
        entityId: data.id,
        beforeData,
        afterData: data,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/institution/profile
 */
router.get('/profile',
  requirePermission('settings.view'),
  async (req, res, next) => {
    try {
      const institution = await req.prisma.institution.findUnique({
        where: { id: req.institutionId },
      });

      if (!institution) {
        throw new AppError('Institution not found', 404, 'NOT_FOUND');
      }

      res.json({ success: true, data: institution });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/institution/profile
 */
router.put('/profile',
  requirePermission('settings.manage'),
  async (req, res, next) => {
    try {
      // Filter only allowed profile fields
      const updateData = {};
      for (const key of PROFILE_KEYS) {
        if (req.body[key] !== undefined) {
          updateData[key] = req.body[key];
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid profile fields provided for update', 400, 'VALIDATION_ERROR');
      }

      // Validate required fields
      if (updateData.name !== undefined && (!updateData.name || updateData.name.trim().length === 0)) {
        throw new AppError('Institution name cannot be empty', 400, 'VALIDATION_ERROR');
      }

      if (updateData.email !== undefined && updateData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updateData.email)) {
          throw new AppError('Invalid email format', 400, 'VALIDATION_ERROR');
        }
      }

      const beforeData = await req.prisma.institution.findUnique({
        where: { id: req.institutionId },
      });

      const updated = await req.prisma.institution.update({
        where: { id: req.institutionId },
        data: updateData,
      });

      // Audit log
      await auditService.record(req.prisma, {
        institutionId: req.institutionId,
        action: 'PROFILE_UPDATED',
        entityType: 'Institution',
        entityId: updated.id,
        beforeData,
        afterData: updated,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
