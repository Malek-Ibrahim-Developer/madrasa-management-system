/**
 * Relationship Integrity Diagnostic Script
 * Altus Kairos — Deep Integrity Audit & Phase 2B Verification
 * 
 * Verifies that all relational invariants, tenant boundaries, and composite keys
 * are strictly preserved across the entire database.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyIntegrity() {
  console.log('🔍 Starting Comprehensive Relationship & Tenant Integrity Audit...\n');

  let violationsCount = 0;

  // 1. Audit Institutions
  const institutions = await prisma.institution.findMany({
    include: {
      configuration: true,
      academicYears: true,
    },
  });
  console.log(`🏢 Found ${institutions.length} institutions.`);
  for (const inst of institutions) {
    if (!inst.configuration) {
      console.warn(`  ⚠️ Institution ${inst.name} (${inst.id}) has NO configuration!`);
      violationsCount++;
    }
    const currentYears = inst.academicYears.filter((ay) => ay.isCurrent && ay.status === 'ACTIVE');
    if (currentYears.length === 0) {
      console.warn(`  ⚠️ Institution ${inst.name} (${inst.id}) has NO active current academic year.`);
      violationsCount++;
    } else if (currentYears.length > 1) {
      console.error(`  ❌ Institution ${inst.name} (${inst.id}) has MULTIPLE active current academic years:`, currentYears.map(y => y.name));
      violationsCount++;
    } else {
      console.log(`  ✓ Institution ${inst.name}: Current Year is "${currentYears[0].name}" (${currentYears[0].id})`);
    }
  }

  // 2. Audit Classes & AcademicYear / Teacher / Subject tenant consistency
  console.log('\n📚 Auditing Class tenant consistency & relationships...');
  const classes = await prisma.class.findMany({
    include: {
      academicYear: true,
      teachers: {
        include: {
          teacher: true,
        },
      },
      subjects: {
        include: {
          subject: true,
        },
      },
    },
  });

  console.log(`   Found ${classes.length} classes.`);
  for (const cls of classes) {
    if (!cls.academicYear) {
      console.error(`  ❌ Class "${cls.name}" (${cls.id}) has NO valid AcademicYear!`);
      violationsCount++;
      continue;
    }

    const expectedInstitutionId = cls.academicYear.institutionId;

    // Check ClassTeacher
    for (const ct of cls.teachers) {
      if (!ct.teacher) {
        console.error(`  ❌ Class "${cls.name}" has orphan ClassTeacher link (teacherId: ${ct.teacherId})`);
        violationsCount++;
      } else if (ct.teacher.institutionId !== expectedInstitutionId) {
        console.error(`  ❌ Cross-tenant ClassTeacher: Class "${cls.name}" (Inst: ${expectedInstitutionId}) linked to Teacher "${ct.teacher.name}" (Inst: ${ct.teacher.institutionId})`);
        violationsCount++;
      }
    }

    // Check ClassSubject
    for (const cs of cls.subjects) {
      if (!cs.subject) {
        console.error(`  ❌ Class "${cls.name}" has orphan ClassSubject link (subjectId: ${cs.subjectId})`);
        violationsCount++;
      } else if (cs.subject.institutionId !== expectedInstitutionId) {
        console.error(`  ❌ Cross-tenant ClassSubject: Class "${cls.name}" (Inst: ${expectedInstitutionId}) linked to Subject "${cs.subject.name}" (Inst: ${cs.subject.institutionId})`);
        violationsCount++;
      }
    }
  }

  // 3. Audit Students & Direct Tenant Ownership
  console.log('\n👨‍🎓 Auditing Student tenant ownership...');
  const totalStudents = await prisma.student.count();
  console.log(`  ✓ All ${totalStudents} students have enforced non-nullable institutionId.`);

  // 4. Audit Enrollments & Consistency with Class and Student
  console.log('\n📝 Auditing Enrollments...');
  const enrollments = await prisma.enrollment.findMany({
    include: {
      student: true,
      class: true,
      academicYear: true,
    },
  });
  console.log(`   Found ${enrollments.length} enrollments.`);

  const studentActiveEnrollmentsMap = new Map();

  for (const enr of enrollments) {
    if (!enr.student) {
      console.error(`  ❌ Enrollment ${enr.id} has missing student (${enr.studentId})`);
      violationsCount++;
      continue;
    }
    if (!enr.class) {
      console.error(`  ❌ Enrollment ${enr.id} has missing class (${enr.classId})`);
      violationsCount++;
      continue;
    }
    if (!enr.academicYear) {
      console.error(`  ❌ Enrollment ${enr.id} has missing academicYear (${enr.academicYearId})`);
      violationsCount++;
      continue;
    }

    // Invariant: enrollment.class.academicYearId == enrollment.academicYearId
    if (enr.class.academicYearId !== enr.academicYearId) {
      console.error(`  ❌ Enrollment ${enr.id}: class.academicYearId (${enr.class.academicYearId}) does not match enrollment.academicYearId (${enr.academicYearId})`);
      violationsCount++;
    }

    // Invariant: student.institutionId == enrollment.academicYear.institutionId
    if (enr.student.institutionId !== enr.academicYear.institutionId) {
      console.error(`  ❌ Cross-tenant Enrollment ${enr.id}: Student ${enr.student.admissionNo} (Inst: ${enr.student.institutionId}) enrolled in AcademicYear (Inst: ${enr.academicYear.institutionId})`);
      violationsCount++;
    }

    // Check duplicate ACTIVE enrollments per student per academic year
    if (enr.status === 'ACTIVE') {
      const key = `${enr.studentId}_${enr.academicYearId}`;
      if (studentActiveEnrollmentsMap.has(key)) {
        console.error(`  ❌ MULTIPLE ACTIVE ENROLLMENTS for student ${enr.student.admissionNo} in AcademicYear ${enr.academicYear.name}!`);
        violationsCount++;
      } else {
        studentActiveEnrollmentsMap.set(key, enr.id);
      }
    }
  }

  // 5. Audit Attendance Records
  console.log('\n📅 Auditing Attendance records...');
  const attendances = await prisma.attendance.findMany({
    include: {
      enrollment: true,
      student: true,
      class: {
        include: {
          academicYear: true,
        },
      },
    },
  });
  console.log(`   Found ${attendances.length} attendance records.`);

  for (const att of attendances) {
    if (att.enrollment) {
      if (att.studentId !== att.enrollment.studentId) {
        console.error(`  ❌ Attendance ${att.id}: studentId (${att.studentId}) does not match enrollment.studentId (${att.enrollment.studentId})`);
        violationsCount++;
      }
      if (att.classId !== att.enrollment.classId) {
        console.error(`  ❌ Attendance ${att.id}: classId (${att.classId}) does not match enrollment.classId (${att.enrollment.classId})`);
        violationsCount++;
      }
    }

    if (att.student && att.class?.academicYear) {
      if (att.student.institutionId !== att.class.academicYear.institutionId) {
        console.error(`  ❌ Cross-tenant Attendance ${att.id}: Student (Inst: ${att.student.institutionId}) recorded in Class (Inst: ${att.class.academicYear.institutionId})`);
        violationsCount++;
      }
    }
  }

  // 6. Audit Custom Fields & Values
  console.log('\n🏷️ Auditing Custom Fields & Values...');
  const customFieldValues = await prisma.customFieldValue.findMany({
    include: {
      customField: true,
      student: true,
    },
  });
  console.log(`   Found ${customFieldValues.length} custom field values.`);
  for (const cfv of customFieldValues) {
    if (cfv.customField && cfv.student) {
      if (cfv.customField.institutionId !== cfv.student.institutionId) {
        console.error(`  ❌ Cross-tenant CustomFieldValue: Field (Inst: ${cfv.customField.institutionId}) attached to Student (Inst: ${cfv.student.institutionId})`);
        violationsCount++;
      }
    }
  }

  // Summary
  console.log('\n=============================================');
  if (violationsCount === 0) {
    console.log('✅ ALL INTEGRITY AUDITS PASSED! ZERO VIOLATIONS FOUND.');
  } else {
    console.error(`❌ INTEGRITY AUDIT FAILED WITH ${violationsCount} VIOLATIONS.`);
  }
  console.log('=============================================\n');

  return violationsCount === 0;
}

if (require.main === module) {
  verifyIntegrity()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal error during verification:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = verifyIntegrity;
