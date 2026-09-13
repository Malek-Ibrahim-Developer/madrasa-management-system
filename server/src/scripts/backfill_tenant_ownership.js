/**
 * Comprehensive Tenant Ownership Backfill Script
 * Altus Kairos — Phase 2B Tenant & Relationship Integrity
 * 
 * Safely resolves and links institutionId for Student, Teacher, and Subject models.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('🔄 Starting Tenant Ownership Backfill...');

  // 1. Resolve primary institution
  const defaultInstitutionId = process.env.DEV_INSTITUTION_ID;
  let primaryInstitution = null;
  if (defaultInstitutionId) {
    primaryInstitution = await prisma.institution.findUnique({ where: { id: defaultInstitutionId } });
  }
  if (!primaryInstitution) {
    primaryInstitution = await prisma.institution.findFirst({ where: { code: 'ALTUS-MAIN' } }) ||
                         await prisma.institution.findFirst();
  }

  if (!primaryInstitution) {
    throw new Error('No institution exists in database. Please seed or create an institution first.');
  }

  console.log(`🏢 Target Institution: ${primaryInstitution.name} (${primaryInstitution.id})`);

  // 2. Backfill Students
  const students = await prisma.student.findMany({
    where: { institutionId: null },
    include: {
      enrollments: {
        include: {
          academicYear: true,
        },
      },
    },
  });

  console.log(`👨‍🎓 Found ${students.length} students without institutionId.`);

  let studentUpdatedCount = 0;
  for (const student of students) {
    let resolvedInstitutionId = null;

    const institutionIds = [
      ...new Set(
        student.enrollments
          .map((e) => e.academicYear?.institutionId)
          .filter(Boolean)
      ),
    ];

    if (institutionIds.length === 1) {
      resolvedInstitutionId = institutionIds[0];
    } else if (institutionIds.length > 1) {
      console.warn(`⚠️ Student ${student.id} (${student.admissionNo}) has cross-institution enrollments:`, institutionIds);
      resolvedInstitutionId = institutionIds[0]; // Anchor to primary active
    } else {
      resolvedInstitutionId = primaryInstitution.id;
    }

    await prisma.student.update({
      where: { id: student.id },
      data: { institutionId: resolvedInstitutionId },
    });
    studentUpdatedCount++;
  }
  console.log(`✅ Backfilled ${studentUpdatedCount} students with institutionId.`);

  // 3. Backfill Teachers
  const teachers = await prisma.teacher.findMany({
    where: { institutionId: null },
    include: {
      classes: {
        include: {
          class: {
            include: {
              academicYear: true,
            },
          },
        },
      },
    },
  });

  console.log(`👨‍🏫 Found ${teachers.length} teachers without institutionId.`);
  let teacherUpdatedCount = 0;
  for (const teacher of teachers) {
    let resolvedInstitutionId = null;

    const institutionIds = [
      ...new Set(
        teacher.classes
          .map((ct) => ct.class?.academicYear?.institutionId)
          .filter(Boolean)
      ),
    ];

    if (institutionIds.length === 1) {
      resolvedInstitutionId = institutionIds[0];
    } else {
      resolvedInstitutionId = primaryInstitution.id;
    }

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { institutionId: resolvedInstitutionId },
    });
    teacherUpdatedCount++;
  }
  console.log(`✅ Backfilled ${teacherUpdatedCount} teachers with institutionId.`);

  // 4. Backfill Subjects
  const subjectsUpdated = await prisma.subject.updateMany({
    where: { institutionId: null },
    data: { institutionId: primaryInstitution.id },
  });
  console.log(`📚 Backfilled ${subjectsUpdated.count} subjects with institutionId.`);

  // 5. Verification — Verify 0 NULLs remain
  const remainingNullStudents = await prisma.student.count({ where: { institutionId: null } });
  const remainingNullTeachers = await prisma.teacher.count({ where: { institutionId: null } });
  const remainingNullSubjects = await prisma.subject.count({ where: { institutionId: null } });

  console.log('\n📊 Backfill Verification Report:');
  console.log(`   Remaining NULL Students: ${remainingNullStudents}`);
  console.log(`   Remaining NULL Teachers: ${remainingNullTeachers}`);
  console.log(`   Remaining NULL Subjects: ${remainingNullSubjects}`);

  if (remainingNullStudents > 0 || remainingNullTeachers > 0 || remainingNullSubjects > 0) {
    throw new Error('Backfill incomplete: NULL institutionId rows still exist.');
  }

  console.log('\n🎉 Tenant Ownership Backfill completed successfully!');
}

if (require.main === module) {
  backfill()
    .catch((err) => {
      console.error('❌ Backfill failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = backfill;
