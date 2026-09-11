/**
 * Seed script — Populate the database with sample data
 * Run with: npm run db:seed
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const sampleClasses = [
  { name: 'Class 1', code: 'CLS-01', section: 'A', teacher: 'Maulana Zubair', capacity: 35 },
  { name: 'Class 2', code: 'CLS-02', section: 'A', teacher: 'Maulana Tariq', capacity: 35 },
  { name: 'Class 3', code: 'CLS-03', section: 'A', teacher: 'Maulana Rashid', capacity: 40 },
  { name: 'Class 4', code: 'CLS-04', section: 'A', teacher: 'Maulana Imran', capacity: 40 },
  { name: 'Class 5', code: 'CLS-05', section: 'A', teacher: 'Maulana Yaseen', capacity: 40 },
  { name: 'Class 6', code: 'CLS-06', section: 'A', teacher: 'Maulana Dawood', capacity: 45 },
  { name: 'Class 7', code: 'CLS-07', section: 'A', teacher: 'Maulana Ismail', capacity: 45 },
  { name: 'Class 8', code: 'CLS-08', section: 'A', teacher: 'Maulana Suleman', capacity: 45 },
  { name: 'Hifz Year 1', code: 'HFZ-01', section: null, teacher: 'Qari Abdullah', capacity: 25 },
  { name: 'Hifz Year 2', code: 'HFZ-02', section: null, teacher: 'Qari Hamza', capacity: 25 },
  { name: 'Aalim Year 1', code: 'ALM-01', section: null, teacher: 'Mufti Ahmad', capacity: 30 },
  { name: 'Aalim Year 2', code: 'ALM-02', section: null, teacher: 'Mufti Yusuf', capacity: 30 },
];

const sampleStudents = [
  { admissionNo: 'AK-2024-001', firstName: 'Ahmed', lastName: 'Raza', fatherName: 'Mohammad Raza', gender: 'MALE', phone: '+91 9876543001', dateOfBirth: new Date('2010-03-15') },
  { admissionNo: 'AK-2024-002', firstName: 'Zaid', lastName: 'Khan', fatherName: 'Salman Khan', gender: 'MALE', phone: '+91 9876543002', dateOfBirth: new Date('2009-07-22') },
  { admissionNo: 'AK-2024-003', firstName: 'Bilal', lastName: 'Ahmad', fatherName: 'Nasir Ahmad', gender: 'MALE', phone: '+91 9876543003', dateOfBirth: new Date('2010-11-08') },
  { admissionNo: 'AK-2024-004', firstName: 'Hamza', lastName: 'Siddiqui', fatherName: 'Tariq Siddiqui', gender: 'MALE', phone: '+91 9876543004', dateOfBirth: new Date('2011-01-30') },
  { admissionNo: 'AK-2024-005', firstName: 'Umar', lastName: 'Farooq', fatherName: 'Khalid Farooq', gender: 'MALE', phone: '+91 9876543005', dateOfBirth: new Date('2010-05-12') },
  { admissionNo: 'AK-2024-006', firstName: 'Yusuf', lastName: 'Ali', fatherName: 'Imran Ali', gender: 'MALE', phone: '+91 9876543006', dateOfBirth: new Date('2009-09-18') },
  { admissionNo: 'AK-2024-007', firstName: 'Ibrahim', lastName: 'Qureshi', fatherName: 'Anwar Qureshi', gender: 'MALE', phone: '+91 9876543007', dateOfBirth: new Date('2011-04-25') },
  { admissionNo: 'AK-2024-008', firstName: 'Owais', lastName: 'Shaikh', fatherName: 'Rafiq Shaikh', gender: 'MALE', phone: '+91 9876543008', dateOfBirth: new Date('2010-08-03') },
  { admissionNo: 'AK-2024-009', firstName: 'Talha', lastName: 'Ansari', fatherName: 'Jamal Ansari', gender: 'MALE', phone: '+91 9876543009', dateOfBirth: new Date('2009-12-14') },
  { admissionNo: 'AK-2024-010', firstName: 'Arham', lastName: 'Patel', fatherName: 'Shakir Patel', gender: 'MALE', phone: '+91 9876543010', dateOfBirth: new Date('2011-06-20') },
  { admissionNo: 'AK-2024-011', firstName: 'Saad', lastName: 'Malik', fatherName: 'Zaheer Malik', gender: 'MALE', phone: '+91 9876543011', dateOfBirth: new Date('2010-02-09') },
  { admissionNo: 'AK-2024-012', firstName: 'Rayyan', lastName: 'Sheikh', fatherName: 'Akbar Sheikh', gender: 'MALE', phone: '+91 9876543012', dateOfBirth: new Date('2009-10-27') },
  { admissionNo: 'AK-2024-013', firstName: 'Anas', lastName: 'Hashmi', fatherName: 'Nadeem Hashmi', gender: 'MALE', phone: '+91 9876543013', dateOfBirth: new Date('2011-08-11') },
  { admissionNo: 'AK-2024-014', firstName: 'Dawud', lastName: 'Rizvi', fatherName: 'Hasan Rizvi', gender: 'MALE', phone: '+91 9876543014', dateOfBirth: new Date('2010-01-05') },
  { admissionNo: 'AK-2024-015', firstName: 'Sulaiman', lastName: 'Momin', fatherName: 'Yaqub Momin', gender: 'MALE', phone: '+91 9876543015', dateOfBirth: new Date('2009-06-17') },
];

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Clear existing data
  console.log('  Clearing existing data...');
  await prisma.result.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();

  // Seed classes
  console.log('  📚 Creating classes...');
  const createdClasses = [];
  for (const cls of sampleClasses) {
    const created = await prisma.class.create({ data: cls });
    createdClasses.push(created);
    console.log(`    ✓ ${created.name} (${created.code})`);
  }

  // Seed students — distribute across classes
  console.log('\n  👨‍🎓 Creating students...');
  for (let i = 0; i < sampleStudents.length; i++) {
    const classIndex = i % createdClasses.length;
    const student = await prisma.student.create({
      data: {
        ...sampleStudents[i],
        classId: createdClasses[classIndex].id,
        admissionDate: new Date(`2024-0${(i % 6) + 1}-${String((i % 28) + 1).padStart(2, '0')}`),
      },
    });
    console.log(`    ✓ ${student.firstName} ${student.lastName} → ${createdClasses[classIndex].name}`);
  }

  console.log(`\n✅ Seeded ${sampleClasses.length} classes and ${sampleStudents.length} students!`);
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
