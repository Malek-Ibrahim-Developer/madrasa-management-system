/**
 * Backfill Attendance Enrollments Script
 * Maps legacy Attendance records to their authoritative Enrollment ID.
 * 
 * Usage:
 *   Audit only:   node server/src/scripts/backfillAttendanceEnrollments.js --audit
 *   Backfill:     node server/src/scripts/backfillAttendanceEnrollments.js --backfill
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { startOfDay, isEnrollmentEffectiveOnDate } = require('../utils/enrollmentRules');

const prisma = new PrismaClient();

async function main() {
  const isBackfill = process.argv.includes('--backfill');
  const mode = isBackfill ? 'BACKFILL' : 'AUDIT';

  console.log(`\n🔍 Running Attendance Enrollment Migration in [${mode}] mode...\n`);

  const totalAttendances = await prisma.attendance.count();
  console.log(`📊 Total Attendance records: ${totalAttendances}`);

  const attendances = await prisma.attendance.findMany({
    orderBy: { date: 'asc' },
  });

  let mappedCount = 0;
  let alreadyMappedCount = 0;
  let unmappedCount = 0;
  let conflictingCount = 0;
  const anomalies = [];

  for (const att of attendances) {
    if (att.enrollmentId) {
      alreadyMappedCount++;
      continue;
    }

    const attDate = startOfDay(att.date);

    // Find all matching enrollments for this student, class, and date
    const candidates = await prisma.enrollment.findMany({
      where: {
        studentId: att.studentId,
        classId: att.classId,
        enrollmentDate: { lte: attDate },
        OR: [
          { exitDate: null },
          { exitDate: { gte: attDate } },
        ],
      },
    });

    const matching = candidates.filter(e => isEnrollmentEffectiveOnDate(e, attDate));

    if (matching.length === 1) {
      mappedCount++;
      if (isBackfill) {
        await prisma.attendance.update({
          where: { id: att.id },
          data: { enrollmentId: matching[0].id },
        });
      }
    } else if (matching.length === 0) {
      unmappedCount++;
      anomalies.push({
        attendanceId: att.id,
        studentId: att.studentId,
        classId: att.classId,
        date: att.date.toISOString().split('T')[0],
        reason: 'Zero matching enrollments for student + class on date',
      });
    } else {
      conflictingCount++;
      anomalies.push({
        attendanceId: att.id,
        studentId: att.studentId,
        classId: att.classId,
        date: att.date.toISOString().split('T')[0],
        reason: `Multiple (${matching.length}) matching enrollments found`,
      });
    }
  }

  console.log(`✅ Already mapped:      ${alreadyMappedCount}`);
  console.log(`🎯 Unambiguously mapped: ${mappedCount}`);
  console.log(`⚠️ Unmapped (zero match): ${unmappedCount}`);
  console.log(`❌ Conflicts (multiple):  ${conflictingCount}`);

  if (anomalies.length > 0) {
    console.log('\n⚠️ Anomalies detected:');
    console.table(anomalies.slice(0, 20));
    if (anomalies.length > 20) {
      console.log(`... and ${anomalies.length - 20} more.`);
    }
  }

  if (isBackfill) {
    console.log(`\n✨ Backfill completed! Updated ${mappedCount} records.`);
  } else {
    console.log('\n💡 Audit completed. Run with --backfill to apply unambiguous mappings.');
  }
}

main()
  .catch((e) => {
    console.error('Fatal error during backfill audit:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
