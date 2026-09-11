/**
 * Production-Grade Seed Script — Populates the database in strict relational dependency order:
 * Institution -> Configuration -> AcademicYear -> Roles & Permissions -> Users -> Classes -> Students -> Enrollments -> Attendance
 * 
 * Run with: npm run db:seed
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./utils/password');
const { startOfDay } = require('./utils/enrollmentRules');

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

  // 3. Academic Year
  console.log('  📅 Creating/updating Active Academic Year...');
  const academicYear = await prisma.academicYear.upsert({
    where: { name: '2025-2026' },
    update: { isCurrent: true, institutionId: institution.id },
    create: {
      name: '2025-2026',
      startDate: new Date('2025-06-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T23:59:59.999Z'),
      isCurrent: true,
      status: 'ACTIVE',
      institutionId: institution.id,
    },
  });
  console.log(`    ✓ Academic Year: ${academicYear.name} (isCurrent: ${academicYear.isCurrent})`);

  // 4. Permissions
  console.log('  🛡️ Seeding Granular Permissions...');
  const permissionCodes = [
    { code: 'students.view', description: 'View student profiles' },
    { code: 'students.create', description: 'Create new student' },
    { code: 'students.update', description: 'Update student record' },
    { code: 'students.archive', description: 'Archive student' },
    { code: 'classes.view', description: 'View classes' },
    { code: 'classes.create', description: 'Create class' },
    { code: 'classes.update', description: 'Update class' },
    { code: 'classes.archive', description: 'Archive class' },
    { code: 'enrollment.view', description: 'View enrollments' },
    { code: 'enrollment.create', description: 'Enroll student' },
    { code: 'enrollment.transfer', description: 'Transfer student' },
    { code: 'enrollment.withdraw', description: 'Withdraw student' },
    { code: 'attendance.view', description: 'View attendance' },
    { code: 'attendance.mark', description: 'Mark daily attendance' },
    { code: 'attendance.edit', description: 'Edit attendance' },
    { code: 'attendance.clear', description: 'Clear attendance' },
    { code: 'reports.view', description: 'View reports' },
    { code: 'configuration.view', description: 'View configuration' },
    { code: 'configuration.update', description: 'Update configuration' },
    { code: 'users.view', description: 'View system users' },
    { code: 'users.manage', description: 'Manage system users' },
  ];

  const permissions = [];
  for (const p of permissionCodes) {
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

  // 7. Classes
  console.log('  📚 Seeding Classes...');
  const sampleClasses = [
    { name: 'Class 8', code: 'CLS-08A', section: 'A', teacher: 'Maulana Zubair', capacity: 40 },
    { name: 'Class 9', code: 'CLS-09A', section: 'A', teacher: 'Maulana Tariq', capacity: 40 },
    { name: 'Class 10', code: 'CLS-10A', section: 'A', teacher: 'Maulana Rashid', capacity: 40 },
    { name: 'Hifz Year 1', code: 'HFZ-01', section: null, teacher: 'Qari Abdullah', capacity: 30 },
    { name: 'Hifz Year 2', code: 'HFZ-02', section: null, teacher: 'Qari Hamza', capacity: 30 },
  ];

  const createdClasses = [];
  for (const cls of sampleClasses) {
    const created = await prisma.class.upsert({
      where: { code: cls.code },
      update: { academicYearId: academicYear.id },
      create: {
        ...cls,
        academicYearId: academicYear.id,
        status: 'ACTIVE',
      },
    });
    createdClasses.push(created);
    console.log(`    ✓ ${created.name} (${created.code})`);
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
      where: { admissionNo: sampleStudents[i].admissionNo },
      update: { classId: assignedClass.id },
      create: {
        ...sampleStudents[i],
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
