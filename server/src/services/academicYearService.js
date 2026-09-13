/**
 * Academic Year Service — Institution-scoped AcademicYear management & resolution
 * Altus Kairos — Tenant & Relationship Integrity Hardening
 */

const AppError = require('../utils/AppError');

/**
 * Resolves the single active academic year for a specific institution.
 * Guards against missing academic year (409) and multi-active data corruption (409).
 */
async function getCurrentAcademicYear(prisma, institutionId) {
  if (!institutionId) {
    throw new AppError(
      'Institution context is required',
      401,
      'INSTITUTION_CONTEXT_REQUIRED'
    );
  }

  const years = await prisma.academicYear.findMany({
    where: {
      institutionId,
      isCurrent: true,
      status: 'ACTIVE',
    },
    take: 2,
    orderBy: { startDate: 'desc' },
  });

  if (years.length === 0) {
    throw new AppError(
      'No current academic year is configured for this institution.',
      409,
      'ACTIVE_ACADEMIC_YEAR_REQUIRED'
    );
  }

  if (years.length > 1) {
    throw new AppError(
      'Data integrity conflict: multiple current academic years exist for this institution.',
      409,
      'MULTIPLE_CURRENT_ACADEMIC_YEARS'
    );
  }

  return years[0];
}

/**
 * Validates and fetches an academic year ensuring it strictly belongs to the institution.
 */
async function getAcademicYearForInstitution(prisma, institutionId, academicYearId) {
  if (!institutionId) {
    throw new AppError(
      'Institution context is required',
      401,
      'INSTITUTION_CONTEXT_REQUIRED'
    );
  }

  if (!academicYearId) {
    throw new AppError('Academic year ID is required', 400, 'VALIDATION_ERROR');
  }

  const year = await prisma.academicYear.findFirst({
    where: {
      id: academicYearId,
      institutionId,
    },
  });

  if (!year) {
    throw new AppError(
      'Academic year not found for the current institution.',
      404,
      'ACADEMIC_YEAR_NOT_FOUND'
    );
  }

  return year;
}

module.exports = {
  getCurrentAcademicYear,
  getAcademicYearForInstitution,
};
