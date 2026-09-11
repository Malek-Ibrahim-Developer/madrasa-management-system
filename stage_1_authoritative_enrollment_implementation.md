# Stage 1 — Authoritative Enrollment Migration
## Implementation Specification for IDE AI

> This is the single implementation specification for Stage 1.
> Follow it exactly. Do not redesign the architecture or modify unrelated modules.

## 1. Objective

Make `Enrollment` the authoritative source of a student's current class membership.

Transitional architecture:

```text
Student
├── classId                 ← legacy compatibility field
└── enrollments
    └── Enrollment
        ├── studentId
        ├── classId
        ├── academicYearId
        └── status
```

Do NOT remove `Student.classId` in Stage 1.

## 2. Non-negotiable rules

1. Enrollment is the business source of truth for current class membership.
2. Student.classId is compatibility-only.
3. No new business query may use Student.classId.
4. `classId === undefined` means class membership is not being changed.
5. `classId === null` means explicitly remove current class membership.
6. A non-null classId means assign or transfer.
7. Historical enrollments must remain untouched by current-year operations.
8. Never silently repair multiple ACTIVE enrollments.
9. Never guess an academic year.
10. Never enroll into an invalid/inactive/wrong-year class.
11. Never exceed class capacity.
12. Multi-table state changes must be atomic.
13. Preserve existing API contracts wherever possible.
14. Do not rename existing variables/parameters unnecessarily.
15. Do not create duplicate helpers or duplicate business logic.

## 3. Verified current data

```text
Students:                         14
Classes:                          12
Enrollments:                      14
ACTIVE Enrollments:               14
Students with Student.classId:    14
Students without classId:          0
Mismatched active enrollments:     0
Students with multiple ACTIVE:     0
Academic Year:                2025-2026
```

Do not assume these numbers remain unchanged.

## 4. Academic year

Only resolve the current academic year when class membership changes.

```js
const activeAcademicYear = await tx.academicYear.findFirst({
  where: { isCurrent: true },
});
```

If class membership requires an academic year and none exists:

```text
HTTP 400
NO_ACTIVE_ACADEMIC_YEAR
```

Never fall back to the latest created year.

AcademicYear is not required for:
- metadata-only student updates
- creating a student without a class
- imports with no class assignment
- clearing classId when there is no ACTIVE enrollment to close

## 5. classId semantics

### Omitted

```js
classId === undefined
```

Do not change class membership, Enrollment, or Student.classId. Do not resolve AcademicYear.

### Explicit null

```js
classId === null
```

If an ACTIVE current-year Enrollment exists:
- resolve current AcademicYear
- mark it WITHDRAWN
- set exitDate
- set Student.classId = null

If no ACTIVE enrollment exists:
- do not create an Enrollment
- clear Student.classId
- do not require AcademicYear

### Non-null ID

Resolve current AcademicYear, validate the target class, check capacity, then assign/transfer atomically.

## 6. Target class validation

Before creating an ACTIVE Enrollment:

1. Class exists.
2. Class is eligible/ACTIVE.
3. Class belongs to the current AcademicYear.

Failure:

```text
HTTP 422
INVALID_TARGET_CLASS
```

Use the actual field names in the repository.

## 7. Active enrollment lookup

Current membership must be queried using:

```text
studentId
+
current academicYearId
+
status = ACTIVE
```

If more than one ACTIVE enrollment exists:

```text
HTTP 409
MULTIPLE_ACTIVE_ENROLLMENTS
```

Do not silently repair or delete them.

## 8. Student creation

### Without class

Create Student only:

```text
Student.classId = null
No Enrollment
```

### With class

One transaction:

```text
Resolve AcademicYear
Validate class
Lock class row
Check capacity
Create Student
Create ACTIVE Enrollment
Synchronize Student.classId
COMMIT
```

Any failure rolls back everything.

## 9. Student update

### Same class

If requested class equals current ACTIVE enrollment class:
- no new Enrollment
- no status change
- no exitDate
- synchronize legacy Student.classId

### Transfer

One transaction:

```text
Resolve AcademicYear
Find current ACTIVE enrollment
Reject multiple ACTIVE enrollments
Validate target class
Lock target Class row
Check capacity
Mark old enrollment TRANSFERRED + exitDate
Create new ACTIVE enrollment
Synchronize Student.classId
COMMIT
```

On failure:
- old enrollment remains ACTIVE
- new enrollment does not exist
- Student.classId remains unchanged

### Remove class

If ACTIVE enrollment exists:
- mark WITHDRAWN
- set exitDate
- set Student.classId = null

If none exists:
- set Student.classId = null
- do not create Enrollment
- no AcademicYear required

## 10. Capacity protection

Capacity is enforced by the backend.

Inside the same transaction, before counting:

```js
await tx.$queryRaw`
  SELECT id
  FROM "classes"
  WHERE id = ${targetClassId}
  FOR UPDATE
`;
```

Then:

```js
const activeCount = await tx.enrollment.count({
  where: {
    classId: targetClassId,
    status: 'ACTIVE',
  },
});
```

If `activeCount >= capacity`:

```text
HTTP 409
CLASS_CAPACITY_EXCEEDED
```

Do not modify the previous enrollment on a failed transfer.

Use the actual installed Prisma/PostgreSQL capabilities; do not invent APIs.

## 11. Active enrollment uniqueness

The desired database safeguard is:

```sql
CREATE UNIQUE INDEX "unique_active_enrollment_per_year"
ON "enrollments" ("student_id", "academic_year_id")
WHERE "status" = 'ACTIVE';
```

Do NOT create this index in `server/index.js`.

Do NOT execute schema DDL at application startup.

Do NOT blindly use `prisma db push`.

Create a controlled, reproducible database migration/baseline strategy appropriate to the existing database, which currently has no migration history.

Before applying:
- verify no duplicate ACTIVE enrollments
- preserve all existing records
- make the migration safe if the index already exists
- document verification

A genuine unique-enrollment conflict must become:

```text
HTTP 409
CONCURRENT_ENROLLMENT_CONFLICT
```

Do not convert unrelated P2002 errors.

## 12. Student list/detail

`GET /api/students` must filter class membership through ACTIVE Enrollment for the current academic year.

Conceptually:

```js
where: {
  enrollments: {
    some: {
      status: 'ACTIVE',
      academicYear: { isCurrent: true },
      classId,
    },
  },
}
```

Use actual repository relation names.

Current class in API responses must come from ACTIVE Enrollment.

If none exists:

```text
classId = null
class = null
```

Do not fall back to Student.classId for business membership.

Detail responses must include the current ACTIVE Enrollment and its Class.

## 13. Attendance

Replace Student.classId membership queries with ACTIVE Enrollment queries.

Attendance statistics must count ACTIVE enrollments.

Do not modify historical attendance records in Stage 1.

## 14. Exports

Update Excel/PDF student exports so class filtering and class display use ACTIVE Enrollment.

Preserve existing export format and columns.

## 15. Import

Preserve existing:
- validation
- duplicate handling
- class mapping
- skipped rows
- error reporting

Do not assume a JavaScript try/catch inside one PostgreSQL transaction provides partial success.

Inspect the actual import implementation and preserve its current semantics using a transaction model actually supported by the repository.

If no row has a mapped class:
- no AcademicYear required

If one or more rows have a mapped class:
- resolve current AcademicYear
- validate target class
- check capacity
- create Student
- create ACTIVE Enrollment

Student.classId may be populated only for legacy compatibility.

## 16. Legacy Student.classId

During Stage 1 it may remain synchronized.

It must NOT be used for:
- membership filtering
- attendance
- student counts
- capacity
- exports
- business authorization
- determining current class

## 17. Frontend

Do not redesign the Students page.

Consume the new backend response.

If temporary compatibility is required:

```js
// TEMPORARY STAGE 1 MIGRATION FALLBACK
const currentClass =
  student.enrollments?.[0]?.class || student.class;
```

Mark it clearly as temporary.

Do not modify Courses.jsx.

## 18. Expected files to change

```text
server/src/routes/studentRoutes.js
server/src/routes/attendanceRoutes.js
server/src/routes/exportRoutes.js
server/src/routes/importRoutes.js
src/pages/StudentProfile.jsx
```

Potentially:

```text
server/src/utils/enrollmentSync.js
```

only if genuinely needed.

Database migration files may be added.

## 19. Files that must not change

Unless a real dependency requires it:

```text
server/prisma/schema.prisma
src/pages/Courses.jsx
src/styles/*
src/services/authService.js
unrelated routes
unrelated components
unrelated database models
```

Do not perform broad refactoring.

## 20. Variable/parameter safety

Before changing any function:
- inspect existing parameters
- preserve parameter names
- preserve return shapes
- preserve imports
- search every caller before changing a signature
- do not invent `studentId`/`id` substitutions
- do not invent `classId`/`targetClassId` substitutions without consistency
- do not invent unnecessary academicYearId parameters
- do not leave undefined variables
- do not leave unused imports

If a helper is created, define its parameter contract once and use exactly the same names everywhere.

## 21. Error contract

Use the existing AppError and error middleware.

Required business errors:

```text
NO_ACTIVE_ACADEMIC_YEAR        400
INVALID_TARGET_CLASS            422
MULTIPLE_ACTIVE_ENROLLMENTS     409
CLASS_CAPACITY_EXCEEDED         409
CONCURRENT_ENROLLMENT_CONFLICT  409
```

Preserve the project's existing JSON error response shape.

## 22. Tests

### Student
- create without class
- create with valid class
- invalid/inactive/wrong-year class
- full class
- no current academic year
- metadata-only update
- classId omitted
- assign class
- same-class update
- transfer
- remove class
- remove class with no active enrollment
- multiple active enrollment anomaly

### Attendance
- current class list
- transferred student leaves old class
- transferred student appears in new class
- stats count active enrollments

### Exports
- Excel class filter
- PDF class filter
- current class output

### Import
- no class mappings
- valid mappings
- invalid mappings
- full class
- duplicates
- enrollment failure
- result counts

### Concurrency
- two simultaneous enrollments for same student/year
- two simultaneous enrollments into a near-full class
- different classes do not unnecessarily block each other

## 23. Post-implementation audit

The IDE AI must report:

1. Files changed
2. Files created
3. Files deleted
4. Functions changed
5. Database migration added
6. Index verification result
7. Build result
8. Lint result
9. Tests executed
10. Tests passed/failed
11. Remaining Student.classId reads
12. Remaining Student.classId writes
13. Remaining Student.class relations
14. API contract changes
15. Remaining warnings

Then search the repository for remaining Student.classId business usage.

## 24. Execution order

Implement in exactly this order:

```text
1. Database integrity migration
   ↓
2. Enrollment helper (only if needed)
   ↓
3. Student create/update/transfer/remove
   ↓
4. Student list/detail responses
   ↓
5. Attendance
   ↓
6. Exports
   ↓
7. Import
   ↓
8. Frontend compatibility
   ↓
9. Full tests
   ↓
10. Repository audit
```

After each step:
- run relevant tests/build
- fix only issues caused by that step
- do not introduce unrelated refactors

## 25. Definition of done

Stage 1 is complete only when:

```text
✓ Enrollment is authoritative
✓ Existing 14 students remain correct
✓ Existing 14 enrollments remain correct
✓ No duplicate ACTIVE enrollment exists
✓ Student.classId remains synchronized
✓ Student.classId is not used for membership business queries
✓ Student create works
✓ Student update works
✓ Student transfer works
✓ Student class removal works
✓ Attendance uses Enrollment
✓ Exports use Enrollment
✓ Import creates Enrollment correctly
✓ Capacity is enforced server-side
✓ Concurrent capacity operations are protected
✓ API responses derive current class from Enrollment
✓ No unintended API contract break
✓ No variable mismatch
✓ No parameter mismatch
✓ No undefined variables
✓ No migration-introduced unused imports
✓ Build passes
✓ Lint passes
✓ Relevant tests pass
✓ Database integrity index is verified
```

# FINAL INSTRUCTION TO IDE AI

Read this document completely before editing.

Do not improvise.

Do not redesign the architecture.

Do not add Teacher/Staff models.

Do not remove Student.classId.

Do not remove Enrollment.

Do not redesign Attendance, Exam, Result, or Files.

Do not modify authentication.

Do not redesign Courses.

Do not run destructive database commands.

If the actual repository differs from an assumption here:

1. STOP.
2. Report the exact discrepancy.
3. Show the actual code/schema.
4. Do not silently change the architecture.

If the repository matches:

Proceed exactly in the execution order above and provide the complete post-implementation audit report.
