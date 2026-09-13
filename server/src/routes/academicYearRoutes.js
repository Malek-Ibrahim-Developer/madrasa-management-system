/**
 * Academic Year Routes — Institution-scoped AcademicYear management
 * Altus Kairos — Tenant & Relationship Integrity Hardening
 */

const express = require('express');
const router = express.Router();
const AppError = require('../utils/AppError');
const requirePermission = require('../middleware/requirePermission');
const { requireInstitutionContext } = require('../middleware/institutionContext');
const auditService = require('../services/auditService');

router.use(requireInstitutionContext);

/**
 * GET /api/academic-years
 * List all academic years for the current institution
 */
router.get('/', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const years = await req.prisma.academicYear.findMany({
      where: {
        institutionId: req.institutionId,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    res.json({
      success: true,
      data: years,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/academic-years
 * Create a new academic year for the institution
 */
router.post('/', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const { name, startDate, endDate, isCurrent, status } = req.body;

    if (!name || !name.trim()) {
      throw new AppError('Academic year name is required', 400, 'VALIDATION_ERROR');
    }
    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400, 'VALIDATION_ERROR');
    }

    const trimmedName = name.trim();

    // Check duplicate name within this institution
    const existing = await req.prisma.academicYear.findUnique({
      where: {
        institutionId_name: {
          institutionId: req.institutionId,
          name: trimmedName,
        },
      },
    });

    if (existing) {
      throw new AppError(
        `Academic year "${trimmedName}" already exists for this institution`,
        409,
        'DUPLICATE_ACADEMIC_YEAR'
      );
    }

    const created = await req.prisma.$transaction(async (tx) => {
      // If marking as current, unmark existing current years for this institution
      if (isCurrent) {
        await tx.academicYear.updateMany({
          where: {
            institutionId: req.institutionId,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
          },
        });
      }

      const year = await tx.academicYear.create({
        data: {
          institutionId: req.institutionId,
          name: trimmedName,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isCurrent: Boolean(isCurrent),
          status: status || 'ACTIVE',
        },
      });

      await auditService.record(tx, {
        institutionId: req.institutionId,
        action: 'ACADEMIC_YEAR_CREATED',
        entityType: 'AcademicYear',
        entityId: year.id,
        afterData: year,
      });

      return year;
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/academic-years/:id/current
 * Transactionally mark an academic year as the active/current one for the institution
 */
router.patch('/:id/current', requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const updated = await req.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: {
          id: req.params.id,
          institutionId: req.institutionId,
        },
      });

      if (!year) {
        throw new AppError('Academic year not found', 404, 'ACADEMIC_YEAR_NOT_FOUND');
      }

      // Unmark any existing current years for this institution
      await tx.academicYear.updateMany({
        where: {
          institutionId: req.institutionId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });

      // Mark the selected one as current
      const marked = await tx.academicYear.update({
        where: { id: year.id },
        data: {
          isCurrent: true,
          status: 'ACTIVE',
        },
      });

      await auditService.record(tx, {
        institutionId: req.institutionId,
        action: 'ACADEMIC_YEAR_SET_CURRENT',
        entityType: 'AcademicYear',
        entityId: marked.id,
        beforeData: year,
        afterData: marked,
      });

      return marked;
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
