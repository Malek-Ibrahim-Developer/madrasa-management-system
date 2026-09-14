require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('📦 Applying partial unique index: unique_active_enrollment_per_year...');

  try {
    // 1. Check for any existing active duplicate enrollments first
    const duplicates = await prisma.$queryRaw`
      SELECT "studentId", "academicYearId", COUNT(*) as count
      FROM "enrollments"
      WHERE "status" = 'ACTIVE'
      GROUP BY "studentId", "academicYearId"
      HAVING COUNT(*) > 1;
    `;

    if (duplicates.length > 0) {
      console.error('❌ Cannot create unique index: Found duplicate active enrollments:', duplicates);
      process.exit(1);
    }

    // 2. Create the partial unique index
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_enrollment_per_year"
      ON "enrollments" ("studentId", "academicYearId")
      WHERE "status" = 'ACTIVE';
    `);

    console.log('✅ Partial unique index "unique_active_enrollment_per_year" created successfully!');

    // 3. Verify in pg_indexes
    const verify = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'enrollments' AND indexname = 'unique_active_enrollment_per_year';
    `;

    console.log('🔍 Verified in PostgreSQL indexes:\n', verify);
  } catch (error) {
    console.error('❌ Failed to apply partial unique index:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
