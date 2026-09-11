/**
 * Attendance Service — Core business logic for daily attendance,
 * transfer-safe marking, clear/unmark, and weighted monthly statistics.
 */

const AppError = require('../utils/AppError');
const { startOfDay, endOfDay, isEnrollmentEffectiveOnDate } = require('../utils/enrollmentRules');
const auditService = require('./auditService');

/**
 * Fetch daily attendance roster for a class on a specific business date
 */
async function getDailyAttendance(prisma, { classId, date }) {
  if (!classId || !date) {
    throw new AppError('classId and date are required', 400, 'VALIDATION_ERROR');
  }

  const targetDate = startOfDay(date);
  const finishDate = endOfDay(date);

  // 1. Verify class exists
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    include: { academicYear: true },
  });

  if (!classRecord) {
    throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
  }

  // 2. Fetch students who had an effective enrollment in this class on this date
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId,
      academicYearId: classRecord.academicYearId,
      enrollmentDate: { lte: targetDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: targetDate } },
      ],
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, admissionNo: true },
      },
    },
    orderBy: [
      { student: { firstName: 'asc' } },
      { student: { lastName: 'asc' } },
    ],
  });

  const effectiveEnrollments = enrollments.filter(e => isEnrollmentEffectiveOnDate(e, targetDate));
  const studentIds = effectiveEnrollments.map(e => e.studentId);

  // 3. Fetch existing attendance records
  const attendances = await prisma.attendance.findMany({
    where: {
      classId,
      date: {
        gte: targetDate,
        lte: finishDate,
      },
      studentId: { in: studentIds },
    },
  });

  const attendanceMap = new Map();
  attendances.forEach(a => attendanceMap.set(a.studentId, a));

  // 4. Combine effective students with attendance records
  const records = effectiveEnrollments.map(enrollment => {
    const student = enrollment.student;
    const record = attendanceMap.get(student.id);

    return {
      studentId: student.id,
      enrollmentId: enrollment.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNo: student.admissionNo,
      status: record ? record.status : null,
      remarks: record ? record.remarks : null,
      id: record ? record.id : null,
    };
  });

  const markedCount = records.filter(r => r.status !== null).length;

  return {
    date: date.toString().split('T')[0],
    classId,
    className: classRecord.name,
    academicYearName: classRecord.academicYear?.name || null,
    totalStudents: records.length,
    markedCount,
    records,
  };
}

/**
 * Mark, update, or clear attendance records inside a transactional boundary
 */
async function markAttendance(prisma, {
  classId,
  date,
  records,
  actor = null,
  ipAddress = null,
  userAgent = null,
}) {
  if (!classId || !date || !Array.isArray(records)) {
    throw new AppError('classId, date, and records array are required', 400, 'VALIDATION_ERROR');
  }

  const attendanceDate = startOfDay(date);
  const finishDate = endOfDay(date);

  // 1. Verify class
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    include: { academicYear: true },
  });

  if (!classRecord) {
    throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
  }

  // 2. Reject duplicates in payload
  const seenStudentIds = new Set();
  for (const r of records) {
    if (!r.studentId) {
      throw new AppError('Each attendance record must have a studentId', 422, 'VALIDATION_ERROR');
    }
    if (seenStudentIds.has(r.studentId)) {
      throw new AppError(`Duplicate student ID in request: ${r.studentId}`, 409, 'DUPLICATE_STUDENT_IN_REQUEST');
    }
    seenStudentIds.add(r.studentId);
  }

  // 3. Execute inside transaction
  return await prisma.$transaction(async (tx) => {
    const upserted = [];
    const cleared = [];

    for (const record of records) {
      // Resolve student's effective enrollment for classId on attendanceDate
      const effectiveEnrollment = await tx.enrollment.findFirst({
        where: {
          studentId: record.studentId,
          classId,
          academicYearId: classRecord.academicYearId,
          enrollmentDate: { lte: attendanceDate },
          OR: [
            { exitDate: null },
            { exitDate: { gte: attendanceDate } },
          ],
        },
      });

      if (!effectiveEnrollment || !isEnrollmentEffectiveOnDate(effectiveEnrollment, attendanceDate)) {
        throw new AppError(
          `Student (${record.studentId}) was not actively enrolled in "${classRecord.name}" on ${attendanceDate.toISOString().split('T')[0]}`,
          409,
          'ATTENDANCE_ENROLLMENT_MISMATCH'
        );
      }

      // Check existing attendance record for transfer protection
      const existingRecord = await tx.attendance.findUnique({
        where: {
          studentId_date: {
            studentId: record.studentId,
            date: attendanceDate,
          },
        },
      });

      if (existingRecord && existingRecord.classId !== classId) {
        throw new AppError(
          `Student already has an attendance record in another class on this date`,
          409,
          'ATTENDANCE_ENROLLMENT_MISMATCH'
        );
      }

      // If status is empty or UNMARKED, unmark / clear by deleting row
      if (!record.status || record.status === 'UNMARKED') {
        if (existingRecord) {
          await tx.attendance.delete({
            where: { id: existingRecord.id },
          });
          cleared.push(record.studentId);
        }
        continue;
      }

      // Valid enum check
      const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
      const normalizedStatus = record.status.toString().toUpperCase();
      if (!validStatuses.includes(normalizedStatus)) {
        throw new AppError(`Invalid status: "${record.status}". Must be one of: ${validStatuses.join(', ')}`, 422, 'INVALID_ATTENDANCE_STATUS');
      }

      // Upsert record
      const saved = await tx.attendance.upsert({
        where: {
          studentId_date: {
            studentId: record.studentId,
            date: attendanceDate,
          },
        },
        update: {
          status: normalizedStatus,
          remarks: record.remarks || null,
          enrollmentId: effectiveEnrollment.id,
        },
        create: {
          date: attendanceDate,
          status: normalizedStatus,
          remarks: record.remarks || null,
          studentId: record.studentId,
          classId,
          enrollmentId: effectiveEnrollment.id,
        },
      });

      upserted.push(saved);
    }

    // Audit log
    await auditService.record(tx, {
      institutionId: classRecord.academicYear?.institutionId || null,
      userId: actor?.id || null,
      action: 'ATTENDANCE_MARKED',
      entityType: 'Attendance',
      entityId: classId,
      afterData: { date: attendanceDate, updatedCount: upserted.length, clearedCount: cleared.length },
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message: 'Attendance saved successfully',
      updatedCount: upserted.length,
      clearedCount: cleared.length,
    };
  });
}

/**
 * Monthly attendance statistics with date-aware eligible denominators
 * and mathematically sound weighted monthly attendance average.
 */
async function getAttendanceStats(prisma, { classId, month, year }) {
  if (!classId || !month || !year) {
    throw new AppError('classId, month, and year are required', 400, 'VALIDATION_ERROR');
  }

  const parsedMonth = parseInt(month, 10);
  const parsedYear = parseInt(year, 10);

  const startDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1));
  const endDate = new Date(Date.UTC(parsedYear, parsedMonth, 0, 23, 59, 59, 999));

  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, academicYearId: true },
  });

  if (!classRecord) {
    throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
  }

  // Fetch all enrollments that overlap with the requested month
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId,
      academicYearId: classRecord.academicYearId,
      enrollmentDate: { lte: endDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: startDate } },
      ],
    },
  });

  // Fetch all attendance records for this class in this month
  const attendances = await prisma.attendance.findMany({
    where: {
      classId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const attendanceByDay = new Map();
  attendances.forEach(a => {
    const dayKey = a.date.toISOString().split('T')[0];
    if (!attendanceByDay.has(dayKey)) {
      attendanceByDay.set(dayKey, []);
    }
    attendanceByDay.get(dayKey).push(a);
  });

  // Calculate day-by-day stats
  const dailyStats = [];
  let totalAttendedStudentDays = 0;
  let totalEligibleStudentDays = 0;
  let totalWorkingDays = 0;

  const totalDaysInMonth = new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const currentDayDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, d));
    const dayKey = currentDayDate.toISOString().split('T')[0];

    // Compute eligible students on this specific day
    const eligibleCount = enrollments.filter(e => isEnrollmentEffectiveOnDate(e, currentDayDate)).length;

    const dayRecords = attendanceByDay.get(dayKey) || [];

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    dayRecords.forEach(r => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'EXCUSED') excused++;
    });

    const marked = present + absent + late + excused;
    const unmarked = Math.max(eligibleCount - marked, 0);

    const attended = present + late + excused;
    const percentage = eligibleCount > 0
      ? parseFloat(((attended / eligibleCount) * 100).toFixed(1))
      : 0;

    if (marked > 0) {
      totalWorkingDays++;
      totalAttendedStudentDays += attended;
      totalEligibleStudentDays += eligibleCount;
    }

    dailyStats.push({
      date: dayKey,
      eligibleStudents: eligibleCount,
      present,
      absent,
      late,
      excused,
      unmarked,
      percentage: marked > 0 ? percentage : null,
      isMarked: marked > 0,
    });
  }

  // Weighted Monthly Average
  const averageAttendance = totalEligibleStudentDays > 0
    ? parseFloat(((totalAttendedStudentDays / totalEligibleStudentDays) * 100).toFixed(1))
    : 0;

  return {
    className: classRecord.name,
    month: parsedMonth,
    year: parsedYear,
    totalWorkingDays,
    totalEligibleStudentDays,
    totalAttendedStudentDays,
    averageAttendance,
    dailyStats,
  };
}

/**
 * Attendance range report querying students strictly via effective enrollment periods,
 * completely eliminating legacy Student.classId queries.
 */
async function getAttendanceReport(prisma, { classId, dateFrom, dateTo }) {
  if (!classId || !dateFrom || !dateTo) {
    throw new AppError('classId, dateFrom, and dateTo are required', 400, 'VALIDATION_ERROR');
  }

  const startDate = startOfDay(dateFrom);
  const endDate = endOfDay(dateTo);

  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, academicYearId: true },
  });

  if (!classRecord) {
    throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
  }

  // Fetch all students who were enrolled in this class during the range
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId,
      academicYearId: classRecord.academicYearId,
      enrollmentDate: { lte: endDate },
      OR: [
        { exitDate: null },
        { exitDate: { gte: startDate } },
      ],
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, admissionNo: true },
      },
    },
    orderBy: [
      { student: { firstName: 'asc' } },
      { student: { lastName: 'asc' } },
    ],
  });

  const studentMap = new Map();
  enrollments.forEach(e => {
    studentMap.set(e.student.id, {
      studentId: e.student.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`.trim(),
      admissionNo: e.student.admissionNo,
      enrollmentStatus: e.status,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
    });
  });

  // Fetch all attendances for the range
  const attendances = await prisma.attendance.findMany({
    where: {
      classId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      studentId: { in: Array.from(studentMap.keys()) },
    },
  });

  attendances.forEach(r => {
    if (studentMap.has(r.studentId)) {
      const stats = studentMap.get(r.studentId);
      if (r.status === 'PRESENT') stats.present++;
      else if (r.status === 'ABSENT') stats.absent++;
      else if (r.status === 'LATE') stats.late++;
      else if (r.status === 'EXCUSED') stats.excused++;
      stats.total++;
    }
  });

  const report = Array.from(studentMap.values()).map(stats => {
    const attended = stats.present + stats.late + stats.excused;
    const percentage = stats.total > 0
      ? parseFloat(((attended / stats.total) * 100).toFixed(1))
      : 0;

    return {
      ...stats,
      percentage,
    };
  });

  return report;
}

module.exports = {
  getDailyAttendance,
  markAttendance,
  getAttendanceStats,
  getAttendanceReport,
};
