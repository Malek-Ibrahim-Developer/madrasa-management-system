/**
 * Enrollment Service — Core domain service managing authoritative student memberships,
 * promotions, class transfers, and withdrawals.
 * Altus Kairos — Tenant & Relationship Integrity Hardening
 */

const AppError = require('../utils/AppError');
const { startOfDay, isEnrollmentEffectiveOnDate } = require('../utils/enrollmentRules');
const auditService = require('./auditService');

/**
 * Get active enrollment for a student in a specific academic year.
 * Detects and raises corruption conflicts if multiple active enrollments exist.
 */
async function getActiveEnrollment(tx, studentId, academicYearId) {
  const active = await tx.enrollment.findMany({
    where: {
      studentId,
      academicYearId,
      status: 'ACTIVE',
    },
    include: {
      class: true,
      academicYear: true,
    },
    take: 2,
  });

  if (active.length > 1) {
    throw new AppError(
      'Data integrity conflict: multiple ACTIVE enrollments exist for the student in the same academic year.',
      409,
      'MULTIPLE_ACTIVE_ENROLLMENTS'
    );
  }

  return active[0] || null;
}

/**
 * Get the enrollment effective for a student on a specific business date
 */
async function getEffectiveEnrollment(tx, studentId, academicYearId, date) {
  const targetDate = startOfDay(date);

  const enrollments = await tx.enrollment.findMany({
    where: {
      studentId,
      academicYearId,
      enrollmentDate: { lte: targetDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: targetDate } },
      ],
    },
    include: {
      class: true,
      academicYear: true,
    },
    orderBy: { enrollmentDate: 'desc' },
  });

  return enrollments.find((e) => isEnrollmentEffectiveOnDate(e, targetDate)) || null;
}

/**
 * Enroll a student into a class with atomic capacity, tenant isolation, and uniqueness validation
 */
async function enrollStudent(tx, {
  institutionId = null,
  studentId,
  classId,
  academicYearId = null,
  enrollmentDate = new Date(),
  rollNumber = null,
  actor = null,
  ipAddress = null,
  userAgent = null,
}) {
  // 1. Validate student exists and belongs to institution
  const student = await tx.student.findUnique({
    where: { id: studentId },
  });
  if (!student) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  }

  if (institutionId && student.institutionId !== institutionId) {
    throw new AppError('Student not found in current institution', 404, 'STUDENT_NOT_FOUND');
  }

  // 2. Validate class exists, belongs to same institution, and is ACTIVE
  const classRecord = await tx.class.findUnique({
    where: { id: classId },
    include: { academicYear: true },
  });
  if (!classRecord) {
    throw new AppError('Target class not found', 404, 'CLASS_NOT_FOUND');
  }

  if (institutionId && classRecord.academicYear.institutionId !== institutionId) {
    throw new AppError('Target class not found in current institution', 404, 'CLASS_NOT_FOUND');
  }

  if (student.institutionId !== classRecord.academicYear.institutionId) {
    throw new AppError('Cross-institution enrollment is prohibited: Student and Class belong to different institutions', 403, 'CROSS_TENANT_ENROLLMENT_PROHIBITED');
  }

  if (classRecord.status !== 'ACTIVE') {
    throw new AppError('Cannot enroll in a class that is not ACTIVE', 409, 'CLASS_NOT_ACTIVE');
  }

  // 3. Resolve academic year
  const resolvedAcademicYearId = academicYearId || classRecord.academicYearId;
  if (classRecord.academicYearId !== resolvedAcademicYearId) {
    throw new AppError('Class does not belong to the specified academic year', 409, 'ACADEMIC_YEAR_MISMATCH');
  }

  // 4. Invariant: Max one ACTIVE enrollment per student per academic year
  const activeExisting = await getActiveEnrollment(tx, studentId, resolvedAcademicYearId);
  if (activeExisting) {
    throw new AppError(
      `Student already has an active enrollment in "${activeExisting.class.name}" for this academic year. Use transfer instead.`,
      409,
      'ACTIVE_ENROLLMENT_CONFLICT'
    );
  }

  // 5. Enforce class capacity constraint
  const currentActiveCount = await tx.enrollment.count({
    where: {
      classId,
      status: 'ACTIVE',
    },
  });
  if (currentActiveCount >= classRecord.capacity) {
    throw new AppError(
      `Class "${classRecord.name}" is at maximum capacity (${classRecord.capacity} students)`,
      409,
      'CLASS_CAPACITY_EXCEEDED'
    );
  }

  // 6. Create authoritative Enrollment
  const enrollment = await tx.enrollment.create({
    data: {
      studentId,
      classId,
      academicYearId: resolvedAcademicYearId,
      enrollmentDate: startOfDay(enrollmentDate),
      rollNumber: rollNumber || null,
      status: 'ACTIVE',
    },
  });

  // 7. Synchronize legacy Student.classId for backwards compatibility
  await tx.student.update({
    where: { id: studentId },
    data: { classId },
  });

  // 8. Audit trail
  await auditService.record(tx, {
    institutionId: classRecord.academicYear.institutionId,
    userId: actor?.id || null,
    action: 'STUDENT_ENROLLED',
    entityType: 'Enrollment',
    entityId: enrollment.id,
    afterData: enrollment,
    ipAddress,
    userAgent,
  });

  return enrollment;
}

/**
 * Transfer a student from one class to another atomically ensuring same institution
 */
async function transferStudent(tx, {
  institutionId = null,
  studentId,
  targetClassId,
  transferDate = new Date(),
  reason = null,
  rollNumber = null,
  actor = null,
  ipAddress = null,
  userAgent = null,
}) {
  const targetDate = startOfDay(transferDate);

  // 1. Validate target class
  const targetClass = await tx.class.findUnique({
    where: { id: targetClassId },
    include: { academicYear: true },
  });
  if (!targetClass) {
    throw new AppError('Target class not found', 404, 'CLASS_NOT_FOUND');
  }

  if (institutionId && targetClass.academicYear.institutionId !== institutionId) {
    throw new AppError('Target class not found in current institution', 404, 'CLASS_NOT_FOUND');
  }

  if (targetClass.status !== 'ACTIVE') {
    throw new AppError('Target class is not ACTIVE', 409, 'CLASS_NOT_ACTIVE');
  }

  // 2. Resolve current active enrollment
  const currentEnrollment = await getActiveEnrollment(tx, studentId, targetClass.academicYearId);
  if (!currentEnrollment) {
    throw new AppError('Student does not have an active enrollment to transfer from', 404, 'ENROLLMENT_NOT_FOUND');
  }

  if (currentEnrollment.academicYear.institutionId !== targetClass.academicYear.institutionId) {
    throw new AppError('Cross-institution transfer is prohibited', 403, 'CROSS_TENANT_TRANSFER_PROHIBITED');
  }

  if (currentEnrollment.classId === targetClassId) {
    throw new AppError('Student is already enrolled in the target class', 409, 'SAME_CLASS_TRANSFER');
  }

  // 3. Verify capacity in target class
  const targetActiveCount = await tx.enrollment.count({
    where: {
      classId: targetClassId,
      status: 'ACTIVE',
    },
  });
  if (targetActiveCount >= targetClass.capacity) {
    throw new AppError(
      `Target class "${targetClass.name}" is at maximum capacity (${targetClass.capacity} students)`,
      409,
      'CLASS_CAPACITY_EXCEEDED'
    );
  }

  // 4. Close old enrollment (DO NOT DELETE)
  const closedEnrollment = await tx.enrollment.update({
    where: { id: currentEnrollment.id },
    data: {
      status: 'TRANSFERRED',
      exitDate: targetDate,
    },
  });

  // 5. Create new active enrollment
  const newEnrollment = await tx.enrollment.create({
    data: {
      studentId,
      classId: targetClassId,
      academicYearId: targetClass.academicYearId,
      enrollmentDate: targetDate,
      rollNumber: rollNumber || currentEnrollment.rollNumber,
      status: 'ACTIVE',
    },
  });

  // 6. Synchronize legacy Student.classId
  await tx.student.update({
    where: { id: studentId },
    data: { classId: targetClassId },
  });

  // 7. Audit trail
  await auditService.record(tx, {
    institutionId: targetClass.academicYear.institutionId,
    userId: actor?.id || null,
    action: 'STUDENT_TRANSFERRED',
    entityType: 'Enrollment',
    entityId: newEnrollment.id,
    beforeData: { oldEnrollment: closedEnrollment, reason },
    afterData: newEnrollment,
    ipAddress,
    userAgent,
  });

  return newEnrollment;
}

/**
 * Withdraw a student from their active enrollment
 */
async function withdrawStudent(tx, {
  institutionId = null,
  studentId,
  academicYearId = null,
  withdrawalDate = new Date(),
  reason = null,
  actor = null,
  ipAddress = null,
  userAgent = null,
}) {
  const targetDate = startOfDay(withdrawalDate);

  // 1. Resolve active academic year
  let activeYear = null;
  if (academicYearId) {
    activeYear = await tx.academicYear.findFirst({
      where: {
        id: academicYearId,
        ...(institutionId && { institutionId }),
      },
    });
  } else {
    activeYear = await tx.academicYear.findFirst({
      where: {
        isCurrent: true,
        ...(institutionId && { institutionId }),
      },
    });
  }

  if (!activeYear) {
    throw new AppError('No active academic year found', 404, 'ACADEMIC_YEAR_NOT_FOUND');
  }

  const currentEnrollment = await getActiveEnrollment(tx, studentId, activeYear.id);
  if (!currentEnrollment) {
    throw new AppError('No active enrollment found for this student', 404, 'ENROLLMENT_NOT_FOUND');
  }

  // 2. Transition status to WITHDRAWN
  const updatedEnrollment = await tx.enrollment.update({
    where: { id: currentEnrollment.id },
    data: {
      status: 'WITHDRAWN',
      exitDate: targetDate,
    },
  });

  // 3. Clear legacy Student.classId and set status INACTIVE
  await tx.student.update({
    where: { id: studentId },
    data: {
      classId: null,
      status: 'INACTIVE',
    },
  });

  // 4. Audit trail
  await auditService.record(tx, {
    institutionId: activeYear.institutionId,
    userId: actor?.id || null,
    action: 'STUDENT_WITHDRAWN',
    entityType: 'Enrollment',
    entityId: updatedEnrollment.id,
    beforeData: { previousEnrollment: currentEnrollment, reason },
    afterData: updatedEnrollment,
    ipAddress,
    userAgent,
  });

  return updatedEnrollment;
}

module.exports = {
  getActiveEnrollment,
  getEffectiveEnrollment,
  enrollStudent,
  transferStudent,
  withdrawStudent,
};
