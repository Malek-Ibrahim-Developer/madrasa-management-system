/**
 * Production-Grade Seed Script — Populates the database in strict relational dependency order:
 * Institution -> Configuration -> AcademicYear -> Roles & Permissions -> Users -> Teachers -> Classes -> ClassTeachers -> Students -> Enrollments
 * 
 * Run with: npm run db:seed
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./utils/password');
const { startOfDay } = require('./utils/enrollmentRules');
const { PERMISSIONS } = require('./config/permissions');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting Altus Kairos Enterprise Seed...\n');

  // 1. Institution
  console.log('  🏢 Creating/updating Institution...');
  const institution = await prisma.institution.upsert({
    where: { code: 'ALTUS-MAIN' },
    update: {},
    create: {
      name: 'Darul Uloom Altus Kairos',
      code: 'ALTUS-MAIN',
      description: 'Premier Islamic Seminary & Comprehensive Madrasa',
      phone: '+91 9876543210',
      email: 'admin@altuskairos.com',
      address: 'Madrasa Campus, Knowledge City, Gujarat, India',
      status: 'ACTIVE',
    },
  });
  console.log(`    ✓ Institution: ${institution.name} (${institution.code})`);

  // 2. Institution Configuration
  console.log('  ⚙️ Creating/updating Institution Configuration...');
  await prisma.institutionConfiguration.upsert({
    where: { institutionId: institution.id },
    update: {},
    create: {
      institutionId: institution.id,
      studentsEnabled: true,
      coursesEnabled: true,
      attendanceEnabled: true,
      examsEnabled: true,
      feesEnabled: false,
      accountsEnabled: false,
      salaryEnabled: false,
      libraryEnabled: false,
      hostelEnabled: false,
      kitchenEnabled: false,
      resultsEnabled: false,
      requireAcademicYear: true,
      allowMultipleSections: true,
      allowAttendanceEdit: true,
      attendanceLockDays: 14,
    },
  });
  console.log('    ✓ Configuration saved');

  // 3. Academic Year — Scoped by composite key [institutionId, name]
  console.log('  📅 Creating/updating Active Academic Year...');
  const academicYear = await prisma.academicYear.upsert({
    where: {
      institutionId_name: {
        institutionId: institution.id,
        name: '2025-2026',
      },
    },
    update: {
      isCurrent: true,
      status: 'ACTIVE',
      startDate: new Date('2025-06-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T23:59:59.999Z'),
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
  console.log(`    ✓ Academic Year: ${academicYear.name} (isCurrent: ${academicYear.isCurrent})`);

  // 4. Permissions — Canonical permissions from permissions.js
  console.log('  🛡️ Seeding Granular Permissions...');
  const permissionEntries = Object.values(PERMISSIONS).map((code) => ({
    code,
    description: `Permission for ${code.replace('.', ' ')}`,
  }));

  const permissions = [];
  for (const p of permissionEntries) {
    const createdPerm = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    permissions.push(createdPerm);
  }
  console.log(`    ✓ ${permissions.length} permissions verified`);

  // 5. Roles & RolePermissions
  console.log('  👥 Seeding Roles & Permissions mapping...');
  const adminRole = await prisma.role.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: 'Admin' } },
    update: {},
    create: {
      name: 'Admin',
      description: 'Super Administrator with full system control',
      institutionId: institution.id,
    },
  });

  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
  console.log(`    ✓ Role: ${adminRole.name} linked to all permissions`);

  // 6. Users
  console.log('  👤 Creating default Admin user...');
  const passwordHash = await hashPassword('admin123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@altuskairos.com' },
    update: { passwordHash, roleId: adminRole.id, institutionId: institution.id },
    create: {
      name: 'Ibrahim Malek (Admin)',
      email: 'admin@altuskairos.com',
      passwordHash,
      phone: '+91 9876543210',
      roleId: adminRole.id,
      institutionId: institution.id,
      isActive: true,
    },
  });
  console.log(`    ✓ Admin user: ${adminUser.email} (Password: admin123)`);

  // 7. Classes, Teachers & ClassTeacher Normalization
  console.log('  📚 Seeding Classes & Normalized Teachers...');
  const sampleClasses = [
    { name: 'Class 8', code: 'CLS-08A', section: 'A', teacher: 'Maulana Zubair', capacity: 40 },
    { name: 'Class 9', code: 'CLS-09A', section: 'A', teacher: 'Maulana Tariq', capacity: 40 },
    { name: 'Class 10', code: 'CLS-10A', section: 'A', teacher: 'Maulana Rashid', capacity: 40 },
    { name: 'Hifz Year 1', code: 'HFZ-01', section: null, teacher: 'Qari Abdullah', capacity: 30 },
    { name: 'Hifz Year 2', code: 'HFZ-02', section: null, teacher: 'Qari Hamza', capacity: 30 },
  ];

  const createdClasses = [];
  for (const cls of sampleClasses) {
    let teacherRecord = null;
    if (cls.teacher) {
      teacherRecord = await prisma.teacher.findFirst({
        where: { institutionId: institution.id, name: cls.teacher },
      });
      if (!teacherRecord) {
        teacherRecord = await prisma.teacher.create({
          data: {
            institutionId: institution.id,
            name: cls.teacher,
            isActive: true,
          },
        });
      }
    }

    const created = await prisma.class.upsert({
      where: {
        academicYearId_code: {
          academicYearId: academicYear.id,
          code: cls.code,
        },
      },
      update: { academicYearId: academicYear.id, teacher: cls.teacher },
      create: {
        ...cls,
        academicYearId: academicYear.id,
        status: 'ACTIVE',
      },
    });

    if (teacherRecord) {
      await prisma.classTeacher.upsert({
        where: {
          classId_teacherId: {
            classId: created.id,
            teacherId: teacherRecord.id,
          },
        },
        update: { role: 'Main Teacher' },
        create: {
          classId: created.id,
          teacherId: teacherRecord.id,
          role: 'Main Teacher',
        },
      });
    }

    createdClasses.push(created);
    console.log(`    ✓ ${created.name} (${created.code}) — Teacher: ${cls.teacher}`);
  }

  // 8. Students & Authoritative Enrollments
  console.log('\n  👨‍🎓 Seeding Students & Authoritative Enrollments...');
  const sampleStudents = [
    { admissionNo: 'AK-2025-001', firstName: 'Ahmed', lastName: 'Raza', fatherName: 'Mohammad Raza', gender: 'MALE', phone: '+91 9876543001', dateOfBirth: new Date('2010-03-15') },
    { admissionNo: 'AK-2025-002', firstName: 'Zaid', lastName: 'Khan', fatherName: 'Salman Khan', gender: 'MALE', phone: '+91 9876543002', dateOfBirth: new Date('2009-07-22') },
    { admissionNo: 'AK-2025-003', firstName: 'Bilal', lastName: 'Ahmad', fatherName: 'Nasir Ahmad', gender: 'MALE', phone: '+91 9876543003', dateOfBirth: new Date('2010-11-08') },
    { admissionNo: 'AK-2025-004', firstName: 'Hamza', lastName: 'Siddiqui', fatherName: 'Tariq Siddiqui', gender: 'MALE', phone: '+91 9876543004', dateOfBirth: new Date('2011-01-30') },
    { admissionNo: 'AK-2025-005', firstName: 'Umar', lastName: 'Farooq', fatherName: 'Khalid Farooq', gender: 'MALE', phone: '+91 9876543005', dateOfBirth: new Date('2010-05-12') },
    { admissionNo: 'AK-2025-006', firstName: 'Yusuf', lastName: 'Ali', fatherName: 'Imran Ali', gender: 'MALE', phone: '+91 9876543006', dateOfBirth: new Date('2009-09-18') },
    { admissionNo: 'AK-2025-007', firstName: 'Ibrahim', lastName: 'Qureshi', fatherName: 'Anwar Qureshi', gender: 'MALE', phone: '+91 9876543007', dateOfBirth: new Date('2011-04-25') },
    { admissionNo: 'AK-2025-008', firstName: 'Owais', lastName: 'Shaikh', fatherName: 'Rafiq Shaikh', gender: 'MALE', phone: '+91 9876543008', dateOfBirth: new Date('2010-08-03') },
  ];

  const enrollmentStartDate = startOfDay(new Date('2025-06-01'));

  for (let i = 0; i < sampleStudents.length; i++) {
    const assignedClass = createdClasses[i % createdClasses.length];

    const student = await prisma.student.upsert({
      where: {
        institutionId_admissionNo: {
          institutionId: institution.id,
          admissionNo: sampleStudents[i].admissionNo,
        },
      },
      update: { classId: assignedClass.id },
      create: {
        ...sampleStudents[i],
        institutionId: institution.id,
        classId: assignedClass.id,
        admissionDate: enrollmentStartDate,
        status: 'ACTIVE',
      },
    });

    // Create authoritative active enrollment
    await prisma.enrollment.upsert({
      where: { id: `seed-enr-${student.id}` },
      update: { classId: assignedClass.id, status: 'ACTIVE' },
      create: {
        id: `seed-enr-${student.id}`,
        studentId: student.id,
        classId: assignedClass.id,
        academicYearId: academicYear.id,
        enrollmentDate: enrollmentStartDate,
        status: 'ACTIVE',
        rollNumber: String(i + 1).padStart(2, '0'),
      },
    });

    console.log(`    ✓ ${student.firstName} ${student.lastName} -> ${assignedClass.name} (Roll: ${String(i + 1).padStart(2, '0')})`);
  }

  console.log('\n✅ Altus Kairos Enterprise Seed completed successfully!\n');
}

seed()
  .catch((e) => {
    console.error('❌ Seed execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
