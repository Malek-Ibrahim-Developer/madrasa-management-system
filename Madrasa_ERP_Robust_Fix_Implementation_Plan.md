# Madrasa Management System — Robust ERP Fix & Architecture Implementation Plan

## Purpose

This document is the implementation specification for bringing the current Madrasa Management System / Altus Kairos codebase in line with the agreed product approach:

1. Institution-level customization must be a core capability, not just custom fields.
2. Enrollment must be the authoritative source for academic membership.
3. Historical records must remain historically correct.
4. Critical mutations must be transaction-safe and concurrency-safe.
5. Authentication, sessions, RBAC, audit logging and authorization must be server-side.
6. Errors and validation must be standardized.
7. The existing good UI/design-system work should be preserved rather than rewritten unnecessarily.
8. Existing data must not be destroyed during the migration.

> **Important:** This is an implementation blueprint. It is intentionally explicit about files, models, routes, services, rules and code patterns. Apply it incrementally. Do not run destructive database commands against production.

---

# 1. Current Architecture — Problems to Fix

The current repository already has useful foundations:

- React + Vite frontend
- Express backend
- Prisma + PostgreSQL
- Central CSS variables/design tokens
- A relatively mature Students module
- Class + Enrollment concepts
- AppError/error handler foundation

The major architectural gaps are:

- Authentication is still effectively a client-side/demo implementation.
- RBAC is not actually enforced server-side.
- Institution configuration is not a first-class domain.
- `Student.classId` is still used by business logic in places where Enrollment should be authoritative.
- Attendance is not consistently tied to the effective Enrollment.
- Some historical reports use current `Student.classId`.
- `classRoutes.js` has a dangerous hard-coded Academic Year fallback.
- Import/Export has Prisma schema drift.
- Seed data does not follow the current Enrollment architecture.
- Dashboard is mostly mock data.
- Audit trail is missing.
- Critical business rules are scattered through route handlers.
- Database migration/versioning needs a proper strategy.
- Testing of business invariants is insufficient.

---

# 2. Target Architecture

Use this dependency direction:

```text
                    ┌────────────────────────┐
                    │ Institution             │
                    │ Configuration           │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Academic Year           │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Class                   │
                    └───────────┬────────────┘
                                │
                                ▼
Student ───────────────────► Enrollment
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
               Attendance                Results
                    │
                    ▼
                  Reports
```

Cross-cutting systems:

```text
Authentication
      │
      ▼
Session
      │
      ▼
User ──► Role ──► Permission

All critical mutations
      │
      ├── Validation
      ├── Authorization
      ├── Transaction
      ├── Concurrency protection
      └── AuditLog
```

---

# 3. Non-Negotiable Business Invariants

These rules must be treated as architecture, not UI behavior.

## 3.1 Academic membership

For a student and academic year:

```text
Maximum one ACTIVE Enrollment
```

Preferred PostgreSQL constraint:

```sql
CREATE UNIQUE INDEX "unique_active_enrollment_per_year"
ON "enrollments" ("student_id", "academic_year_id")
WHERE "status" = 'ACTIVE';
```

Do NOT execute this as arbitrary startup DDL.

Introduce it through a controlled Prisma migration after the existing data has been audited.

---

## 3.2 Enrollment validity

An enrollment is effective on date `D` when:

```text
enrollment.status is active/valid for the date
AND D >= enrollment.enrollmentDate
AND (enrollment.exitDate IS NULL OR D <= enrollment.exitDate)
```

The exact status semantics should be centralized in one service/helper.

Never duplicate slightly different versions of this rule across modules.

---

## 3.3 Student.classId

Keep:

```prisma
classId String?
```

temporarily as a legacy compatibility field.

Rules:

```text
Business queries       -> Enrollment
Historical reports     -> Enrollment
Attendance             -> Enrollment
Current class display  -> Enrollment
Temporary compatibility sync -> Student.classId
```

Do not use `Student.classId` as the source of truth.

---

# 4. Phase 0 — Create a Safe Baseline

Before modifying production data:

## Files to create

```text
docs/
  ARCHITECTURE.md
  DATA_INTEGRITY.md
  MIGRATION_PLAN.md
  RBAC.md
  CUSTOMIZATION.md
  AUDIT_LOGGING.md

server/
  src/
    services/
    repositories/
    middleware/
    utils/
```

Record:

- current schema
- current seed behavior
- current API endpoints
- current frontend routes
- migration risks
- known legacy fields

Create a database backup before schema changes.

---

# 5. Phase 1 — Institution + Configuration Foundation

## 5.1 Prisma schema

File:

```text
server/prisma/schema.prisma
```

Add an Institution model.

Suggested structure:

```prisma
model Institution {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  description String?
  phone       String?
  email       String?
  address     String?
  logoUrl     String?
  status      String   @default("ACTIVE")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  configuration InstitutionConfiguration?
  academicYears  AcademicYear[]
  users          User[]
  auditLogs      AuditLog[]
}
```

Add:

```prisma
model InstitutionConfiguration {
  id            String @id @default(cuid())
  institutionId String @unique

  // Feature switches
  attendanceEnabled Boolean @default(true)
  feesEnabled       Boolean @default(false)
  resultsEnabled    Boolean @default(false)

  // Academic behavior
  requireAcademicYear Boolean @default(true)
  allowMultipleSections Boolean @default(true)

  // Attendance behavior
  allowAttendanceEdit Boolean @default(true)
  attendanceLockDays  Int     @default(7)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  institution Institution @relation(fields: [institutionId], references: [id], onDelete: Cascade)
}
```

Do not put every future setting into one giant JSON field immediately. Stable business rules should have typed columns/models. JSON can be used for genuinely flexible UI metadata.

---

# 6. Phase 2 — Academic Year as a Real Foundation

File:

```text
server/prisma/schema.prisma
```

Ensure AcademicYear has:

```prisma
model AcademicYear {
  id            String   @id @default(cuid())
  institutionId String
  name          String
  startDate     DateTime
  endDate       DateTime
  status        String   @default("ACTIVE")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  institution Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  classes     Class[]
  enrollments Enrollment[]

  @@index([institutionId, status])
}
```

Rules:

- Only an explicitly configured Academic Year can be active.
- Do not silently create `2025-2026`.
- If a required active year is missing, return a clear configuration error.

### Fix file

```text
server/src/routes/classRoutes.js
```

Remove logic equivalent to:

```js
if (!academicYear) {
  // create 2025-2026
}
```

Replace with:

```js
if (!academicYear) {
  throw new AppError(
    'ACTIVE_ACADEMIC_YEAR_REQUIRED',
    409,
    'An active academic year must be configured before creating a class.'
  );
}
```

Use the project's actual `AppError` constructor signature when applying this code.

---

# 7. Phase 3 — Enrollment Service

Create:

```text
server/src/services/enrollmentService.js
server/src/utils/enrollmentRules.js
```

Centralize:

```js
export function isEnrollmentEffectiveOnDate(enrollment, date) {
  const target = startOfDay(date);
  const start = startOfDay(enrollment.enrollmentDate);

  if (target < start) return false;

  if (enrollment.exitDate) {
    const exit = startOfDay(enrollment.exitDate);
    if (target > exit) return false;
  }

  return true;
}
```

Also create service methods:

```js
export async function getActiveEnrollment(tx, studentId, academicYearId) {}
export async function getEffectiveEnrollment(tx, studentId, academicYearId, date) {}
export async function enrollStudent(tx, input) {}
export async function transferStudent(tx, input) {}
export async function withdrawStudent(tx, input) {}
```

---

# 8. Enrollment Creation

All enrollment creation must perform:

```text
Student exists
        ↓
Academic Year exists
        ↓
Academic Year belongs to institution
        ↓
Class exists
        ↓
Class is ACTIVE
        ↓
Class belongs to Academic Year
        ↓
Student has no ACTIVE enrollment for year
        ↓
Capacity is available
        ↓
Transaction
        ↓
Create Enrollment
        ↓
Synchronize Student.classId temporarily
        ↓
Audit
```

Do not rely only on frontend validation.

---

# 9. Transfer

Implement transfer as one transaction:

```js
await prisma.$transaction(async (tx) => {
  // 1. Lock/read current enrollment state.
  // 2. Validate current active enrollment.
  // 3. Validate target class.
  // 4. Validate target academic year.
  // 5. Validate capacity.
  // 6. Close old enrollment.
  // 7. Create new enrollment.
  // 8. Synchronize legacy Student.classId.
  // 9. Create audit entry.
});
```

Old record:

```text
status = TRANSFERRED
exitDate = transferDate
```

New record:

```text
status = ACTIVE
enrollmentDate = transferDate
```

Do not delete the old record.

---

# 10. Withdrawal

Withdrawal:

```text
ACTIVE Enrollment
        ↓
WITHDRAWN
        ↓
exitDate = withdrawal date
```

Then:

```text
Student.classId = null
```

for temporary legacy synchronization.

No historical Attendance/Results/Fees should be deleted.

---

# 11. Phase 4 — Authentication

Current files:

```text
src/context/AuthContext.jsx
src/services/authService.js
src/components/ProtectedRoute.jsx
src/pages/Login.jsx
server/index.js
server/src/routes/index.js
```

Current browser-local authentication must not remain the production mechanism.

Create:

```text
server/src/routes/authRoutes.js
server/src/services/authService.js
server/src/middleware/authMiddleware.js
server/src/utils/password.js
```

Recommended server flow:

```text
POST /api/auth/login
        ↓
Validate credentials
        ↓
Create server-side session
        ↓
Set secure HttpOnly cookie
        ↓
Return safe user profile
```

Do not return password hashes to frontend.

Use a modern password hashing algorithm such as Argon2id or bcrypt with an appropriate cost.

---

# 12. One-Device / One-Session Policy

Create Prisma model:

```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  deviceId     String
  tokenHash    String   @unique

  createdAt    DateTime @default(now())
  lastSeenAt   DateTime @default(now())
  expiresAt    DateTime
  revokedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([deviceId])
}
```

Login logic:

```js
await prisma.$transaction(async (tx) => {
  await tx.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  await tx.session.create({
    data: {
      userId,
      deviceId,
      tokenHash,
      expiresAt,
    },
  });
});
```

Result:

```text
Login on Web
    ↓
Session A

Login on Mobile
    ↓
Session A revoked
    ↓
Session B active
```

Do not rely on localStorage alone to enforce this.

---

# 13. Phase 5 — RBAC

Add:

```prisma
model Role {
  id            String @id @default(cuid())
  institutionId String
  name          String
  description   String?

  institution Institution @relation(fields: [institutionId], references: [id], onDelete: Cascade)
  users       User[]
  permissions RolePermission[]

  @@unique([institutionId, name])
}

model Permission {
  id          String @id @default(cuid())
  code        String @unique
  description String?

  roles RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}
```

Permission examples:

```text
students.view
students.create
students.update
students.archive

classes.view
classes.create
classes.update
classes.archive

enrollment.view
enrollment.create
enrollment.transfer
enrollment.withdraw

attendance.view
attendance.mark
attendance.edit
attendance.clear

reports.view

configuration.view
configuration.update

users.view
users.manage

roles.view
roles.manage
```

---

# 14. Authorization Middleware

Create:

```text
server/src/middleware/requirePermission.js
```

Pattern:

```js
export function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(
          'AUTHENTICATION_REQUIRED',
          401,
          'Authentication is required.'
        );
      }

      const allowed = await permissionService.userHasPermission(
        req.user.id,
        permissionCode
      );

      if (!allowed) {
        throw new AppError(
          'FORBIDDEN',
          403,
          'You do not have permission to perform this action.'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
```

Use it at route level:

```js
router.post(
  '/',
  requirePermission('students.create'),
  createStudent
);
```

Frontend hiding a button is NOT authorization.

Backend must enforce every protected mutation.

---

# 15. Phase 6 — Audit Log

Add:

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  institutionId String
  userId        String?

  action        String
  entityType    String
  entityId      String?

  beforeData    Json?
  afterData     Json?

  ipAddress     String?
  userAgent     String?

  createdAt     DateTime @default(now())

  institution Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  user         User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([institutionId, createdAt])
  @@index([entityType, entityId])
  @@index([userId, createdAt])
}
```

Create:

```text
server/src/services/auditService.js
```

Example:

```js
await auditService.record(tx, {
  institutionId,
  userId: req.user.id,
  action: 'STUDENT_TRANSFERRED',
  entityType: 'Enrollment',
  entityId: newEnrollment.id,
  beforeData: oldEnrollment,
  afterData: newEnrollment,
});
```

Audit critical actions:

- student creation/update/archive
- enrollment
- transfer
- withdrawal
- attendance edit/clear
- fee changes
- result changes
- user creation/deactivation
- role/permission changes
- configuration changes

Audit logs should not be casually editable/deletable.

---

# 16. Phase 7 — Attendance Rewrite

Files:

```text
server/prisma/schema.prisma
server/src/routes/attendanceRoutes.js
src/pages/Attendance.jsx
src/styles/attendance.css
```

Attendance must contain:

```prisma
model Attendance {
  id           String   @id @default(cuid())
  studentId    String
  enrollmentId String?
  classId      String
  date         DateTime
  status       String
  remarks      String?

  student   Student    @relation(fields: [studentId], references: [id], onDelete: Restrict)
  enrollment Enrollment? @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  class     Class      @relation(fields: [classId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([studentId, date])
  @@index([enrollmentId, date])
  @@index([classId, date])
}
```

During migration `enrollmentId` may remain nullable temporarily.

---

# 17. Attendance Data Migration

Create:

```text
server/prisma/manual-migrations/001_add_attendance_enrollment.sql
server/src/scripts/backfillAttendanceEnrollments.js
```

Backfill only when the historical record can be mapped unambiguously.

Never guess.

Audit mode:

```bash
node server/src/scripts/backfillAttendanceEnrollments.js --audit
```

Backfill mode:

```bash
node server/src/scripts/backfillAttendanceEnrollments.js --backfill
```

Do not delete or rewrite attendance status/date/class as part of the backfill.

After all records are safely mapped, consider making:

```text
Attendance.enrollmentId NOT NULL
```

through a controlled migration.

---

# 18. Attendance Marking Rules

For every attendance row:

```text
Student exists
        ↓
Requested Class exists
        ↓
Class belongs to requested Academic Year
        ↓
Effective Enrollment exists for date
        ↓
Enrollment belongs to requested Class
        ↓
Permission allows action
        ↓
Write inside transaction
```

Reject mismatch with 409.

Example error:

```json
{
  "success": false,
  "error": {
    "code": "ATTENDANCE_ENROLLMENT_MISMATCH",
    "message": "The student was not enrolled in this class on the selected date."
  }
}
```

---

# 19. Attendance Clear / Unmark

Do not use a fake status such as:

```text
ABSENT = false
```

to mean "not marked".

Use actual deletion of the attendance record for unmarking, when institution policy allows it.

For bulk clear:

```js
await prisma.$transaction(async (tx) => {
  await tx.attendance.deleteMany({
    where: {
      date,
      studentId: { in: clearStudentIds },
    },
  });
});
```

Permission and attendance-lock rules must be checked first.

---

# 20. Attendance Statistics

Do NOT use:

```text
current active student count × entire month
```

as the denominator.

Instead calculate eligible student-days from effective Enrollment periods.

Conceptually:

```text
For each day in range:
    determine each student's effective enrollment
    count eligible student
    count marked attendance
```

Then:

```text
attendance percentage =
present student-days / eligible student-days * 100
```

If the system later has a real calendar/holiday model, use it to exclude non-working days.

Do not invent a second calendar implementation if one already exists.

---

# 21. Historical Attendance Reports

Never query historical class membership through:

```js
student.classId
```

Wrong:

```js
where: {
  classId,
}
```

on Student for historical reports.

Correct:

```text
Attendance
  ↓
Enrollment
  ↓
Class
  ↓
AcademicYear
```

or determine effective enrollment for the report date/range.

---

# 22. Phase 8 — Import Fixes

File:

```text
server/src/routes/importRoutes.js
```

Current schema drift must be removed.

Current Prisma Class uses:

```text
code
```

so import lookup should use:

```js
where: {
  code: classCode,
}
```

not:

```js
classCode
```

CustomField queries must use actual schema fields:

```text
name
fieldKey
fieldType
sortOrder
section
```

Do NOT query:

```text
entityType
```

unless that field is intentionally added to the schema as part of the new customization architecture.

---

# 23. Import Validation Pipeline

Import should follow:

```text
Upload
 ↓
Parse
 ↓
Normalize
 ↓
Validate headers
 ↓
Validate each row
 ↓
Resolve class
 ↓
Resolve custom fields
 ↓
Validate duplicate student identifiers
 ↓
Validate enrollment rules
 ↓
Preview
 ↓
User confirms
 ↓
Transactional import
 ↓
Import audit record
```

Do not partially mutate the database before validation if the UI promises an atomic import.

For large imports, use chunking carefully while maintaining explicit error reporting.

---

# 24. Phase 9 — Export Fixes

File:

```text
server/src/routes/exportRoutes.js
```

Replace schema-drifted CustomField references:

```text
entityType
displayOrder
fieldLabel
```

with the actual schema or the new explicit customization model.

Export field metadata should have one canonical definition.

Suggested DTO:

```js
{
  key: customField.fieldKey,
  label: customField.name,
  type: customField.fieldType,
  order: customField.sortOrder,
  section: customField.section
}
```

---

# 25. Phase 10 — Seed Rewrite

File:

```text
server/src/scripts/seed.js
```

Seed in dependency order:

```text
Institution
 ↓
InstitutionConfiguration
 ↓
AcademicYear
 ↓
Roles
 ↓
Permissions
 ↓
RolePermissions
 ↓
Users
 ↓
Classes
 ↓
Students
 ↓
Enrollments
 ↓
Sample Attendance
```

Never create a Class without its Academic Year.

Never seed a Student as academically enrolled only through:

```text
Student.classId
```

Create an Enrollment.

The seed database should represent the real production architecture.

---

# 26. Phase 11 — Service Layer

Do not keep all business logic inside routes.

Create:

```text
server/src/services/
  enrollmentService.js
  attendanceService.js
  studentService.js
  classService.js
  authService.js
  permissionService.js
  auditService.js
  institutionService.js
  configurationService.js
```

Routes should become thin:

```js
router.post('/', requirePermission('attendance.mark'), async (req, res, next) => {
  try {
    const result = await attendanceService.markAttendance({
      actor: req.user,
      input: req.body,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});
```

Business logic belongs in services.

---

# 27. Phase 12 — Repository Layer

A repository layer is optional for very simple queries, but useful for repeated complex queries.

Create where needed:

```text
server/src/repositories/
  enrollmentRepository.js
  attendanceRepository.js
  studentRepository.js
```

Do not create meaningless wrappers around every single Prisma call.

Use repositories where they encapsulate meaningful query logic.

---

# 28. Phase 13 — Standard API Errors

File:

```text
server/src/utils/AppError.js
server/src/middleware/errorHandler.js
```

Standardize error format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Suggested codes:

```text
AUTHENTICATION_REQUIRED
INVALID_CREDENTIALS
FORBIDDEN

ACTIVE_ACADEMIC_YEAR_REQUIRED
ACADEMIC_YEAR_NOT_FOUND

STUDENT_NOT_FOUND
CLASS_NOT_FOUND
ENROLLMENT_NOT_FOUND

ACTIVE_ENROLLMENT_CONFLICT
CLASS_CAPACITY_EXCEEDED
INVALID_ENROLLMENT_STATE

ATTENDANCE_ENROLLMENT_MISMATCH
ATTENDANCE_DATE_INVALID
ATTENDANCE_LOCKED

VALIDATION_ERROR
DUPLICATE_RECORD
```

Map Prisma errors centrally.

Especially:

```text
P2002 -> 409
P2025 -> 404 or domain-specific not-found
```

Do not expose raw Prisma errors to users.

---

# 29. Phase 14 — Student Module Cleanup

Keep the existing strong Students UI.

Do NOT rewrite it from scratch.

Fix architecture:

```text
Student
   ↓
Enrollment
```

Current class display should be derived from active enrollment.

Student list APIs should include a current enrollment DTO.

Example:

```js
{
  id,
  name,
  ...
  currentEnrollment: {
    id,
    classId,
    className,
    section,
    academicYearId
  }
}
```

Do not make frontend infer this from `Student.classId`.

---

# 30. Student Profile Edit Fix

Current pattern can fail if the target student is not on the current paginated Students page.

Instead:

```text
/students?edit=<studentId>
```

should cause:

```text
GET /api/students/:studentId
        ↓
load exact record
        ↓
open modal
```

Do not depend on the currently loaded page.

---

# 31. Phase 15 — Institution Custom Fields

Current `CustomField` system is useful but should be upgraded.

A robust field definition should conceptually support:

```text
institutionId
entityType
fieldKey
label
fieldType
required
searchable
filterable
exportable
visible
sortOrder
section
validation rules
```

If these are added, use consistent names.

Suggested model:

```prisma
model CustomField {
  id            String @id @default(cuid())
  institutionId String

  entityType String
  fieldKey   String
  label      String
  fieldType  String

  required   Boolean @default(false)
  searchable Boolean @default(false)
  filterable Boolean @default(false)
  exportable Boolean @default(true)
  visible    Boolean @default(true)

  sortOrder Int @default(0)
  section   String?

  validation Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([institutionId, entityType, fieldKey])
  @@index([institutionId, entityType, sortOrder])
}
```

This is a schema change. If applied, update all frontend/backend references together.

---

# 32. Customization Is More Than Custom Fields

The configuration system should eventually control:

```text
Institution identity
Academic years
Class structure
Sections
Attendance rules
Student fields
Staff fields
Fee behavior
Result behavior
Permissions
Dashboard widgets
Numbering/codes
Notifications
```

Avoid hard-coding institution-specific rules in route files.

Bad:

```js
if (institution === 'ABC') {
  ...
}
```

Good:

```js
if (configuration.attendance.allowEdit) {
  ...
}
```

---

# 33. Phase 16 — Dashboard

Files:

```text
src/pages/Dashboard.jsx
src/data/mockData.js
src/components/dashboard/*.jsx
```

Remove hard-coded production values such as:

```text
342 students
28 staff
485000 balance
94.2%
```

Create API:

```text
GET /api/dashboard/summary
GET /api/dashboard/attendance
GET /api/dashboard/finance
GET /api/dashboard/activity
```

Dashboard should consume real data.

Eventually widget visibility should be configurable per institution/role.

Do not remove `mockData.js` until all consumers have been migrated.

---

# 34. Phase 17 — Design System

Keep:

```text
src/styles/variables.css
src/styles/globals.css
```

as the single design source.

All modules should use:

```css
var(--primary-500)
var(--surface-*)
var(--text-*)
var(--border-*)
var(--radius-*)
var(--space-*)
```

Do not create module-specific brand systems such as:

```css
--primary-color: #4f46e5;
```

in Attendance.

Attendance should use the ERP's shared Emerald/Teal design tokens.

---

# 35. UI Rule

Modules can have different interaction patterns.

They must not look like different products.

```text
Students
Classes
Attendance
Fees
Results
Reports
Settings
```

must share:

- typography
- spacing
- buttons
- input styles
- table language
- modal language
- cards
- badges
- error states
- loading states
- empty states
- responsive principles

---

# 36. Phase 18 — Delete / Archive Semantics

Do not treat all entities as deletable.

Use:

```text
Student       -> archive/deactivate
Class         -> deactivate/archive
User          -> deactivate/revoke sessions
Enrollment    -> status transition
Attendance    -> clear/unmark according to policy
AuditLog      -> immutable
AcademicYear  -> close/archive
```

Historical records must survive.

---

# 37. Phase 19 — Concurrency

Critical operations must be tested under concurrent requests:

```text
two users enroll into last available seat
two users transfer same student
two users mark same attendance
two users modify same configuration
```

Use:

```text
transaction
+
appropriate locking
+
database unique constraints
+
domain conflict detection
```

Never assume frontend button disabling is concurrency control.

---

# 38. Phase 20 — Database Migration Strategy

Move production schema evolution toward:

```text
Prisma migrations
```

Do NOT use:

```text
prisma migrate reset
```

on production.

Do NOT add arbitrary startup SQL such as:

```js
await prisma.$executeRaw(...)
```

for permanent schema management.

Migration sequence should be explicit:

```text
existing data audit
        ↓
migration
        ↓
backfill
        ↓
verification
        ↓
constraint
```

Example Attendance:

```text
Add nullable enrollmentId
        ↓
Backfill unambiguous rows
        ↓
Audit unresolved rows
        ↓
Fix/manual mapping
        ↓
Verify all rows
        ↓
Make enrollmentId required
```

---

# 39. Phase 21 — Automated Tests

Add backend tests for business invariants.

Minimum cases:

## Enrollment

```text
creates enrollment
rejects duplicate ACTIVE enrollment
rejects inactive class
rejects wrong academic year
rejects over-capacity
```

## Transfer

```text
closes old enrollment
creates new enrollment
preserves history
updates legacy classId
```

## Withdrawal

```text
sets WITHDRAWN
sets exitDate
clears legacy classId
preserves history
```

## Attendance

```text
allows effective enrollment
rejects before enrollment date
rejects after exit date
rejects wrong class
allows clear
rejects unauthorized edit
```

## RBAC

```text
authorized user succeeds
unauthorized user gets 403
```

## Session

```text
new login revokes previous session
revoked session cannot call protected API
```

## Audit

```text
critical mutation produces audit record
```

---

# 40. Frontend Authentication Cleanup

After backend authentication exists:

```text
src/context/AuthContext.jsx
```

should fetch/restore server session.

Do not store:

```text
password
```

in localStorage.

Avoid using localStorage as the authority for authentication state.

`ProtectedRoute.jsx` should depend on server-confirmed auth state.

`api.js` should handle:

```text
401
403
```

centrally.

For cookie-based sessions:

```js
fetch(url, {
  credentials: 'include',
  ...
});
```

---

# 41. Route Protection

File:

```text
src/App.jsx
```

Remove the current production bypass.

Target:

```text
<App>
  <AuthProvider>
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  </AuthProvider>
</App>
```

And module-level permission checks:

```text
Students
Classes
Attendance
Settings
Reports
```

must be permission-aware.

---

# 42. Configuration UI

Create:

```text
src/pages/settings/
  InstitutionSettings.jsx
  AcademicSettings.jsx
  AttendanceSettings.jsx
  StudentSettings.jsx
  SecuritySettings.jsx
  PermissionSettings.jsx
  CustomFieldsSettings.jsx
```

Possible navigation:

```text
Settings
├── Institution
├── Academic
├── Students
├── Attendance
├── Fees
├── Results
├── Security
├── Users & Roles
└── Custom Fields
```

Only authorized users should see/edit each section.

---

# 43. Configuration Change Rules

Configuration updates must be:

```text
authenticated
+
authorized
+
validated
+
transactional where multiple values change
+
audited
```

Example:

```text
Admin changes attendanceLockDays
        ↓
validate integer >= 0
        ↓
permission check
        ↓
update
        ↓
audit before/after
```

---

# 44. What NOT To Do

Never:

```text
- rewrite entire project from zero
- silently create missing Academic Years
- use Student.classId for historical logic
- trust frontend permissions
- use localStorage as production authentication authority
- delete historical enrollment records
- guess attendance enrollment mapping
- silently repair conflicting data
- add startup DDL as a replacement for migrations
- hard-code institution-specific rules
- introduce a different color system per module
- claim tests/build passed if they were not actually run
```

---

# 45. Recommended Implementation Order

Implement in this exact dependency order:

```text
STEP 1
Repository/schema audit + backup

STEP 2
Institution + InstitutionConfiguration

STEP 3
AcademicYear hardening

STEP 4
Enrollment service + invariants

STEP 5
Remove business dependence on Student.classId

STEP 6
Authentication + sessions

STEP 7
RBAC + permissions

STEP 8
Audit logging

STEP 9
Attendance Enrollment migration + rewrite

STEP 10
Import/Export schema alignment

STEP 11
Seed rewrite

STEP 12
Dashboard real-data migration

STEP 13
Settings/configuration UI

STEP 14
Reports

STEP 15
Fees/Results/Staff/etc.

STEP 16
Automated tests

STEP 17
Production security/performance hardening
```

---

# 46. Definition of Done

A phase is NOT done merely because the page works.

It is done when:

```text
Schema correct
+
API correct
+
Authorization correct
+
Validation correct
+
Transaction/concurrency considered
+
Historical behavior correct
+
Error handling standardized
+
Audit implemented where required
+
Frontend integrated
+
Responsive UI
+
Tests added
+
Migration documented
```

---

# 47. Final Target

The final system should behave like:

```text
                INSTITUTION
                     │
                     ▼
             CONFIGURATION
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
 ACADEMIC STRUCTURE          SECURITY
       │                           │
       ▼                           ▼
 ACADEMIC YEAR              AUTHENTICATION
       │                           │
       ▼                           ▼
     CLASS                     SESSION
       │                           │
       ▼                           ▼
  ENROLLMENT                    USER
       │                           │
   ┌───┼────┐                     ▼
   ▼   ▼    ▼                    ROLE
Attend Fees Results                │
   │                               ▼
   └───────────────►          PERMISSIONS
                    │
                    ▼
                 AUDIT
                    │
                    ▼
                 REPORTS
```

The important architectural rule is:

> **Configuration controls behavior, Enrollment controls academic membership, server-side authorization controls access, transactions/constraints protect state, and historical records remain historically correct.**

---

# 48. Immediate First Implementation

Do NOT start by polishing Dashboard or adding more placeholder modules.

The first implementation batch should be:

```text
1. Institution model
2. InstitutionConfiguration model
3. AcademicYear hardening
4. Remove hard-coded 2025-2026 fallback
5. Enrollment service
6. Active Enrollment invariant
7. Audit model/service foundation
8. Authentication/session foundation
9. RBAC schema foundation
```

Then:

```text
10. Attendance migration
11. Attendance rewrite
```

This sequence creates the foundation required by the rest of the ERP.

---

# 49. Safety Rules During Implementation

Before every schema change:

```text
1. inspect current schema
2. inspect all consumers
3. inspect existing data shape
4. design migration
5. create backup
6. migrate
7. verify
8. only then tighten constraints
```

Before changing a shared field:

```text
search all backend references
search all frontend references
search seed/import/export/report references
```

Before declaring completion:

```text
run syntax checks
run tests
run Prisma validation/generation where environment permits
run frontend build where dependencies permit
inspect errors
```

If a verification step cannot run because of environment/network/dependency limitations, report that fact honestly.

---

# 50. Summary

The goal is not to turn the current code into a completely different application.

The goal is to evolve it from:

```text
functional prototype
```

into:

```text
configurable + historically correct + secure + transaction-safe + auditable ERP
```

while preserving the strongest existing work.

The most important architectural decisions are:

```text
Institution
    ↓
Configuration

AcademicYear
    ↓
Class
    ↓
Enrollment
    ↓
Academic membership

Authentication
    ↓
Session
    ↓
User
    ↓
Role
    ↓
Permission

Critical mutation
    ↓
Validation
    ↓
Transaction
    ↓
Audit

Historical report
    ↓
Effective Enrollment
    ↓
Never current Student.classId
```

This document should be treated as the implementation contract for the next development phases.
