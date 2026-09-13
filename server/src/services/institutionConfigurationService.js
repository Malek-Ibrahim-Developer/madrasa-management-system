/**
 * Institution Configuration Service — Core business logic for managing
 * institution-level module flags, academic behavior, and attendance rules.
 * 
 * Altus Kairos — Phase 1 Architecture
 */

const AppError = require('../utils/AppError');

const CONFIG_KEYS = [
  'studentsEnabled',
  'coursesEnabled',
  'attendanceEnabled',
  'examsEnabled',
  'feesEnabled',
  'accountsEnabled',
  'salaryEnabled',
  'libraryEnabled',
  'hostelEnabled',
  'kitchenEnabled',
  'resultsEnabled',
  'requireAcademicYear',
  'allowMultipleSections',
  'allowAttendanceEdit',
  'attendanceLockDays',
];

/**
 * Validate configuration input against schema rules
 */
function validateConfigurationInput(input = {}) {
  const output = {};

  for (const key of CONFIG_KEYS) {
    if (input[key] !== undefined) {
      output[key] = input[key];
    }
  }

  for (const key of CONFIG_KEYS) {
    if (
      key !== 'attendanceLockDays' &&
      output[key] !== undefined &&
      typeof output[key] !== 'boolean'
    ) {
      throw new AppError(
        `${key} must be a boolean`,
        400,
        'INVALID_CONFIGURATION'
      );
    }
  }

  if (
    output.attendanceLockDays !== undefined &&
    (
      !Number.isInteger(output.attendanceLockDays) ||
      output.attendanceLockDays < 0 ||
      output.attendanceLockDays > 365
    )
  ) {
    throw new AppError(
      'Attendance lock days must be an integer between 0 and 365',
      400,
      'INVALID_CONFIGURATION'
    );
  }

  return output;
}

/**
 * Resolve prisma client and institutionId from flexible argument signatures
 */
function resolveArgs(first, second, third) {
  let prisma = null;
  let institutionId = null;
  let data = null;

  if (first && typeof first === 'object' && first.institutionConfiguration) {
    prisma = first;
    institutionId = second;
    data = third;
  } else {
    institutionId = first;
    if (second && typeof second === 'object' && second.institutionConfiguration) {
      prisma = second;
      data = third;
    } else {
      data = second;
      prisma = third;
    }
  }

  return { prisma, institutionId, data };
}

/**
 * Fetch or initialize institution configuration via upsert
 */
async function getInstitutionConfiguration(first, second) {
  const { prisma, institutionId } = resolveArgs(first, second);

  if (!institutionId) {
    throw new AppError(
      'Institution context is required',
      400,
      'INSTITUTION_CONTEXT_REQUIRED'
    );
  }

  if (!prisma) {
    throw new AppError('Database client is required', 500, 'INTERNAL_SERVER_ERROR');
  }

  return prisma.institutionConfiguration.upsert({
    where: { institutionId },
    create: { institutionId },
    update: {},
  });
}

/**
 * Update institution configuration after rigorous input validation
 */
async function updateInstitutionConfiguration(first, second, third) {
  const { prisma, institutionId, data: input } = resolveArgs(first, second, third);

  if (!institutionId) {
    throw new AppError(
      'Institution context is required',
      400,
      'INSTITUTION_CONTEXT_REQUIRED'
    );
  }

  if (!prisma) {
    throw new AppError('Database client is required', 500, 'INTERNAL_SERVER_ERROR');
  }

  const validatedData = validateConfigurationInput(input);

  return prisma.institutionConfiguration.upsert({
    where: { institutionId },
    create: {
      institutionId,
      ...validatedData,
    },
    update: validatedData,
  });
}

module.exports = {
  CONFIG_KEYS,
  validateConfigurationInput,
  getInstitutionConfiguration,
  updateInstitutionConfiguration,
};
