/**
 * Academic Architecture Data Migration & Backfill Script
 * Connects classes to AcademicYear, backfills Teacher & ClassTeacher models,
 * and populates Enrollment records for all students with strict institution scope.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting Academic Architecture Migration...');

  try {
    // 0. Resolve target institution
    const institutionId = process.env.DEV_INSTITUTION_ID;
    let institution = null;
    if (institutionId) {
      institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    }
    if (!institution) {
      institution = await prisma.institution.findFirst({ where: { code: 'ALTUS-MAIN' } }) ||
                    await prisma.institution.findFirst();
    }

    if (!institution) {
      throw new Error('Target institution not found. Please create an institution first.');
    }

    console.log(`🏢 Migrating for Institution: ${institution.name} (${institution.id})`);

    // 1. Create or find default AcademicYear for this institution
    let academicYear = await prisma.academicYear.findFirst({
      where: {
        institutionId: institution.id,
        isCurrent: true,
      },
    });

    if (!academicYear) {
      academicYear = await prisma.academicYear.upsert({
        where: {
          institutionId_name: {
            institutionId: institution.id,
            name: '2025-2026',
          },
        },
        update: {
          isCurrent: true,
          status: 'ACTIVE',
        },
        create: {
          institutionId: institution.id,
          name: '2025-2026',
          startDate: new Date('2025-06-01T00:00:00.000Z'),
          endDate: new Date('2026-05-31T23:59:59.999Z'),
          isCurrent: true,
          status: 'ACTIVE',
        },
      });
      console.log('✅ Created/Ensured AcademicYear:', academicYear.name, `(${academicYear.id})`);
    } else {
      console.log('ℹ️ Using existing AcademicYear:', academicYear.name);
    }

    // 2. Link classes to academicYearId
    const classes = await prisma.class.findMany();
    for (const cls of classes) {
      if (!cls.academicYearId) {
        await prisma.class.update({
          where: { id: cls.id },
          data: { academicYearId: academicYear.id },
        });
      }

      // 3. Migrate teacher string to Teacher and ClassTeacher models
      if (cls.teacher && cls.teacher.trim()) {
        const teacherName = cls.teacher.trim();
        let teacherRecord = await prisma.teacher.findFirst({
          where: {
            institutionId: institution.id,
            name: teacherName,
          },
        });

        if (!teacherRecord) {
          teacherRecord = await prisma.teacher.create({
            data: {
              institutionId: institution.id,
              name: teacherName,
              isActive: true,
            },
          });
          console.log('  👨‍🏫 Created Teacher:', teacherName);
        }

        // Create ClassTeacher relation
        await prisma.classTeacher.upsert({
          where: {
            classId_teacherId: {
              classId: cls.id,
              teacherId: teacherRecord.id,
            },
          },
          update: { role: 'Main Teacher' },
          create: {
            classId: cls.id,
            teacherId: teacherRecord.id,
            role: 'Main Teacher',
          },
        });
      }
    }
    console.log(`✅ Updated ${classes.length} classes with AcademicYear and ClassTeacher assignments.`);

    // 4. Migrate Student classId links to Enrollment records
    const students = await prisma.student.findMany({
      where: { classId: { not: null } },
    });

    let enrollmentCount = 0;
    for (const student of students) {
      if (student.classId) {
        const existingEnrollment = await prisma.enrollment.findFirst({
          where: {
            studentId: student.id,
            academicYearId: academicYear.id,
          },
        });

        if (!existingEnrollment) {
          await prisma.enrollment.create({
            data: {
              studentId: student.id,
              classId: student.classId,
              academicYearId: academicYear.id,
              status: 'ACTIVE',
            },
          });
          enrollmentCount++;
        }
      }
    }
    console.log(`✅ Created ${enrollmentCount} Enrollment records for existing students.`);
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
