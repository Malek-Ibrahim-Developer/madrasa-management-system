# Database Migration & Backfill Plan — Altus Kairos

## 1. Migration Protocol

1. **Zero Destructive Commands**: Never execute `prisma migrate reset`, table drops, or column truncations in any environment containing real data.
2. **Controlled Phased Rollout**:
   - Step 1: Add new tables and nullable foreign keys.
   - Step 2: Run verification and backfill scripts.
   - Step 3: Verify 100% data mapping.
   - Step 4: Apply uniqueness indexes and foreign key constraints.
3. **No Startup DDL**: Never run DDL queries (`$executeRawUnsafe`) from Express server startup (`server/index.js`).

## 2. Attendance → Enrollment Backfill Sequence

1. Execute pre-check audit script (`backfillAttendanceEnrollments.js --audit`) to log:
   - Total attendance rows
   - Rows with unambiguous matching enrollment
   - Rows with conflicting/zero matching enrollments
2. Run backfill (`backfillAttendanceEnrollments.js --backfill`) linking `Attendance.enrollmentId = Enrollment.id`.
3. Verify zero unmapped rows before tightening schema constraints.
