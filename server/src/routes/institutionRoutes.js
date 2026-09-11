/**
 * Institution Routes — Endpoints for institution profile and configuration
 * Altus Kairos — Phase 1 Architecture
 */

const express = require('express');
const router = express.Router();

const AppError = require('../utils/AppError');
const {
  getInstitutionConfiguration,
  updateInstitutionConfiguration,
} = require('../services/institutionConfigurationService');

const PROFILE_KEYS = [
  'name',
  'description',
  'phone',
  'email',
  'address',
  'logoUrl',
];

/**
 * 1. GET /api/institution/configuration
 */
router.get('/configuration', async (req, res, next) => {
  try {
    const institutionId = req.devContext?.institutionId;

    if (!institutionId) {
      throw new AppError(
        'Institution context is required',
        400,
        'INSTITUTION_CONTEXT_REQUIRED'
      );
    }

    const data = await getInstitutionConfiguration(institutionId, req.prisma);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. PUT /api/institution/configuration
 */
router.put('/configuration', async (req, res, next) => {
  try {
    const institutionId = req.devContext?.institutionId;

    if (!institutionId) {
      throw new AppError(
        'Institution context is required',
        400,
        'INSTITUTION_CONTEXT_REQUIRED'
      );
    }

    const data = await updateInstitutionConfiguration(
      institutionId,
      req.body,
      req.prisma
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 3. GET /api/institution/profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const institutionId = req.devContext?.institutionId;

    if (!institutionId) {
      throw new AppError(
        'Institution context is required',
        400,
        'INSTITUTION_CONTEXT_REQUIRED'
      );
    }

    const institution = await req.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new AppError('Institution not found', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: institution,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 4. PUT /api/institution/profile
 */
router.put('/profile', async (req, res, next) => {
  try {
    const institutionId = req.devContext?.institutionId;

    if (!institutionId) {
      throw new AppError(
        'Institution context is required',
        400,
        'INSTITUTION_CONTEXT_REQUIRED'
      );
    }

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

    const updated = await req.prisma.institution.update({
      where: { id: institutionId },
      data: updateData,
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
