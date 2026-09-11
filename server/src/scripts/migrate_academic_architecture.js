/**
 * Academic Architecture Data Migration & Backfill Script
 * Connects classes to AcademicYear, backfills Teacher & ClassTeacher models,
 * and populates Enrollment records for all students.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting Academic Architecture Migration...');

  try {
    // 1. Create default AcademicYear if none exists
    let academicYear = await prisma.academicYear.findFirst({
      where: { isCurrent: true },
    });

    if (!academicYear) {
      academicYear = await prisma.academicYear.create({
        data: {
          name: '2025-2026',
          startDate: new Date('2025-06-01T00:00:00.000Z'),
          endDate: new Date('2026-05-31T23:59:59.999Z'),
          isCurrent: true,
        },
      });
      console.log('✅ Created AcademicYear:', academicYear.name, `(${academicYear.id})`);
    } else {
      console.log('ℹ️ Using existing AcademicYear:', academicYear.name);
    }

    // 2. Link all classes to academicYearId
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
          where: { name: teacherName },
        });

        if (!teacherRecord) {
          teacherRecord = await prisma.teacher.create({
            data: {
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

migrate();
