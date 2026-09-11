# Attendance Module — Authoritative Enrollment Architecture & Robust Implementation Plan

## 0. Purpose

This is the implementation specification for hardening the Attendance module.

It is based on the actual Prisma schema and current `attendanceRoutes.js` supplied in the audit. The current `Attendance` model has `studentId`, `classId`, `date`, `status`, and `remarks`, with `@@unique([studentId, date])`. The current `Enrollment` model contains `studentId`, `classId`, `academicYearId`, `enrollmentDate`, `exitDate`, and `status`. fileciteturn8file0

The main goal is:

```text
AcademicYear
     ↓
Class
     ↓
Enrollment
     ↓
Student
     ↓
Attendance
```

Attendance must preserve the enrollment context that was valid on the attendance date.

---

# 1. NON-NEGOTIABLE RULES

1. Read this entire document before editing.
2. Inspect the actual repository before changing code.
3. Reuse existing models, middleware, authentication, and API conventions.
4. Do not create duplicate Student, Class, Enrollment, AcademicYear, or Attendance models.
5. Never use `Student.classId` to determine Attendance membership.
6. Do not use only `Enrollment.status === 'ACTIVE'` for historical attendance.
7. Historical membership must be determined by enrollment effective dates.
8. Never silently overwrite historical attendance with another class/enrollment.
9. Never delete existing attendance data during migration.
10. Never run destructive `prisma db push`, reset, truncate, or mass-delete commands.
11. Never execute schema/index DDL from application startup.
12. Reuse the existing `AppError` and centralized error middleware.
13. Preserve existing Attendance endpoint contracts unless this document explicitly changes behavior.
14. Keep frontend/backend parameter names synchronized.
15. Do not guess relation names, field names, or database column mappings.
16. If actual repository behavior conflicts with this document, STOP and report the exact conflict.

---

# 2. TARGET ATTENDANCE ARCHITECTURE

Current membership:

```text
Enrollment.status = ACTIVE
```

Historical membership:

```text
Enrollment.enrollmentDate <= attendanceDate
AND
(
  Enrollment.exitDate IS NULL
  OR attendanceDate < Enrollment.exitDate
)
```

Therefore Attendance must resolve the Enrollment that was effective on the attendance date.

Do not use current `ACTIVE` status alone for historical reports.

---

# 3. ATTENDANCE → ENROLLMENT RELATION

The current Attendance model does not explicitly identify the enrollment that justified an attendance record. This creates historical ambiguity during transfers. The audit confirms that the current model instead stores `studentId + classId + date` and uses `@@unique([studentId, date])`. fileciteturn8file0

## Required target

Add an explicit:

```prisma
enrollmentId
```

relation to `Enrollment`.

During migration it must initially be nullable so existing rows can be backfilled safely.

Conceptually:

```prisma
enrollmentId String?
enrollment Enrollment? @relation(
  fields: [enrollmentId],
  references: [id],
  onDelete: Restrict
)

@@index([enrollmentId])
```

Do not blindly copy this syntax. Verify the exact Prisma relation and database mapping first.

---

# 4. SAFE MIGRATION SEQUENCE

Because existing Attendance rows already exist:

### Phase A

Add nullable `enrollmentId`.

### Phase B

Backfill every Attendance row.

For each record:

```text
Attendance.studentId
Attendance.classId
Attendance.date
```

find exactly one Enrollment satisfying:

```text
Enrollment.studentId = Attendance.studentId
Enrollment.classId = Attendance.classId
Attendance.date >= Enrollment.enrollmentDate
AND
(
  Enrollment.exitDate IS NULL
  OR Attendance.date < Enrollment.exitDate
)
```

Also verify that the Enrollment belongs to the AcademicYear associated with the class.

### Outcomes

Exactly one match:

```text
Attendance.enrollmentId = Enrollment.id
```

Zero matches:

```text
STOP
```

More than one match:

```text
STOP
```

Do not guess or silently repair ambiguous historical records.

---

# 5. EXISTING DATA MUST BE PRESERVED

The migration may only add the correct Enrollment reference.

It must not:

- delete Attendance rows
- change Attendance status
- change Attendance date
- rewrite historical class context
- merge records automatically

Before migration, report:

```text
Attendance total rows
Rows with no matching Enrollment
Rows with multiple matching Enrollments
Rows with student/class mismatch
Duplicate student/date groups
```

---

# 6. FINAL ATTENDANCE RELATION

After successful backfill, the target concept is:

```text
Attendance
 ├── studentId
 ├── classId
 ├── enrollmentId  ← historical authority
 ├── date
 ├── status
 └── remarks
```

Keep `studentId` and `classId` temporarily if existing API consumers require them.

The authoritative historical relationship is:

```text
Attendance.enrollmentId
        ↓
Enrollment
        ↓
Student + Class + AcademicYear
```

Do not remove legacy columns until all repository consumers are migrated and verified.

---

# 7. KEEP ONE ATTENDANCE PER STUDENT PER BUSINESS DATE

Keep:

```prisma
@@unique([studentId, date])
```

unless the actual application requirements prove a different business rule is required.

The new `enrollmentId` does not replace this uniqueness rule.

---

# 8. TRANSFER SAFETY

Example:

```text
Aug 01 → Class 8A / Enrollment E1
Aug 10 → transfer to Class 8B / Enrollment E2
Aug 15 → Class 8B / Enrollment E2
```

Expected:

```text
Aug 01 Attendance → E1 / Class 8A
Aug 15 Attendance → E2 / Class 8B
```

If a request attempts to mark Aug 01 using Class 8B:

```text
REJECT
```

Never update the historical record's class/enrollment.

Use an appropriate `409` business error such as:

```text
ATTENDANCE_ENROLLMENT_MISMATCH
```

---

# 9. ATTENDANCE DATE SEMANTICS

Attendance uses a business calendar date.

Canonical API format:

```text
YYYY-MM-DD
```

Example:

```text
2026-08-14
```

Do not mix browser-local timestamps, UTC timestamps, and server-local timestamps for the same business date.

Normalize date-only values consistently at the backend boundary.

---

# 10. FRONTEND DATE HANDLING

Do not use:

```js
new Date().toISOString().split('T')[0]
```

as the source of the displayed business date.

Use a reusable date-only helper consistent with the application's established timezone convention.

The API should receive:

```text
YYYY-MM-DD
```

not a full timestamp from the date picker.

---

# 11. GET `/api/attendance`

Required inputs:

```text
classId
date
```

Validate:

1. class exists
2. date is valid
3. class has an AcademicYear
4. determine enrollments effective on the requested date
5. return only students who belonged to that class on that date

For historical dates, use enrollment effective dates, not merely `status: ACTIVE`.

---

# 12. DAILY MEMBERSHIP QUERY

Never use:

```js
where: { classId }
```

on `Student`.

Never use only:

```js
status: 'ACTIVE'
```

for historical attendance.

Membership must be equivalent to:

```text
student belongs to selected class
AND
enrollment is effective on requested date
AND
enrollment belongs to the class AcademicYear
```

Use actual repository relation syntax.

---

# 13. DAILY ATTENDANCE RECORDS

After the migration, prefer `Attendance.enrollmentId` as the historical membership reference.

For each eligible student:

```json
{
  "studentId": "...",
  "studentName": "...",
  "admissionNo": "...",
  "status": "PRESENT",
  "remarks": "...",
  "id": "..."
}
```

If no Attendance row exists:

```json
{
  "status": null,
  "remarks": null,
  "id": null
}
```

`null` in the response means UNMARKED, not ABSENT.

---

# 14. POST `/api/attendance/mark`

Preserve the existing request shape:

```json
{
  "classId": "...",
  "date": "YYYY-MM-DD",
  "records": [
    {
      "studentId": "...",
      "status": "PRESENT",
      "remarks": "..."
    }
  ]
}
```

Before writing:

1. Validate class.
2. Resolve class AcademicYear.
3. Validate date.
4. Validate every student ID.
5. Resolve the Enrollment effective on that date.
6. Verify it belongs to the selected class.
7. Reject students not enrolled in the class on that date.
8. Reject duplicate student IDs within the request.
9. Validate status values.
10. Execute writes inside one transaction.

---

# 15. NEVER TRUST REQUEST `classId` BY ITSELF

Do not do:

```js
create: {
  studentId: record.studentId,
  classId
}
```

without first validating the student's effective Enrollment.

The server must establish the academic context.

---

# 16. SAFE UPSERT

The current implementation upserts by:

```text
studentId + date
```

Keep this uniqueness key if it matches the existing business rule.

Before updating an existing Attendance record:

```text
existing.enrollmentId
```

must match:

```text
resolvedEnrollment.id
```

If it does not:

```text
409 ATTENDANCE_ENROLLMENT_MISMATCH
```

and do not modify the old record.

This is the protection against transfer-related historical corruption identified in the audit. fileciteturn9file2

---

# 17. CLEAR / UNMARK

The current frontend filters out null status, which makes unmarking impossible. fileciteturn9file9

Required behavior:

```text
PRESENT
ABSENT
LATE
EXCUSED
UNMARKED
```

UNMARKED means:

```text
no Attendance row
```

When clearing an existing record:

```text
DELETE that Attendance row
```

inside the same transaction after validating its enrollment context.

If no row exists:

```text
no-op
```

Do not create a nullable enum status.

---

# 18. PARTIAL ATTENDANCE

Never interpret:

```text
UNMARKED
```

as:

```text
ABSENT
```

Example:

```text
40 eligible
10 PRESENT
30 UNMARKED
```

must remain:

```text
present = 10
absent = 0
unmarked = 30
```

---

# 19. MONTHLY STATISTICS

The current implementation uses the current active enrollment count as the denominator for every day. This is incorrect when enrollment changes during the month. fileciteturn9file2

For every date:

```text
eligibleStudents =
students whose Enrollment was effective
for the requested class on that date
```

Then:

```text
marked =
PRESENT + ABSENT + LATE + EXCUSED

unmarked =
eligibleStudents - marked
```

Never allow negative `unmarked`.

If:

```text
marked > eligibleStudents
```

treat it as an integrity conflict.

---

# 20. DAILY PERCENTAGE

Use:

```text
(PRESENT + LATE + EXCUSED)
/
eligibleStudents
× 100
```

ABSENT is not attendance.

UNMARKED is not ABSENT.

---

# 21. MONTHLY AVERAGE MUST BE WEIGHTED

Do not calculate:

```js
sumPercentage / totalWorkingDays
```

because daily denominators can differ.

Use:

```text
monthlyAttendancePercentage =
total attended student-days
/
total eligible student-days
× 100
```

where:

```text
attended =
PRESENT + LATE + EXCUSED
```

This handles students joining, withdrawing, and transferring during the month.

---

# 22. WORKING-DAY RULE

The supplied schema does not show a Holiday/WorkingDay model.

Do not invent one in this Attendance fix.

Inspect the existing repository for an established calendar/holiday service. If none exists, preserve the current attendance-date semantics and clearly document what dates are included.

Do not silently assume every weekday is a working day.

---

# 23. STUDENT HISTORY

`GET /api/attendance/student/:studentId` must:

1. Validate student exists.
2. Respect requested month/year.
3. Return historical Attendance records.
4. Preserve historical class/enrollment context.
5. Never reinterpret old Attendance using current `Student.classId`.

---

# 24. DATE-RANGE REPORT

`GET /api/attendance/report` must not use:

```js
where: { classId }
```

on Student.

For the requested date range, determine which students had an effective Enrollment in that class during the relevant dates.

A student who transferred out should remain represented for the period in which they belonged to the class.

A student who joined later should not be treated as a member before their enrollment date.

---

# 25. PERFORMANCE

Do not introduce N+1 queries such as:

```text
for each student → query Enrollment
```

or:

```text
for each Attendance → query Enrollment
```

Use batch Prisma queries or safe SQL when necessary.

---

# 26. TRANSACTION BOUNDARIES

Attendance marking must use:

```js
req.prisma.$transaction(async (tx) => {
  ...
});
```

The transaction must cover:

```text
membership validation
+
existing attendance validation
+
create/update/delete
```

Do not perform a membership check outside the transaction and assume it cannot change.

---

# 27. CONCURRENCY

The existing:

```text
studentId + date
```

unique constraint remains the final duplicate safeguard.

A real unique conflict must return an appropriate HTTP 409.

Do not label unrelated database errors as concurrency errors.

---

# 28. ERROR HANDLING

The current Attendance routes bypass the application's `AppError` middleware. fileciteturn9file9

Change Attendance routes to the existing architecture:

```js
next(error)
```

with:

```text
AppError
central error middleware
```

Useful business codes:

```text
CLASS_NOT_FOUND
INVALID_ATTENDANCE_DATE
STUDENT_NOT_FOUND
STUDENT_NOT_ENROLLED_IN_CLASS
ATTENDANCE_ENROLLMENT_MISMATCH
DUPLICATE_STUDENT_IN_REQUEST
INVALID_ATTENDANCE_STATUS
ATTENDANCE_INTEGRITY_CONFLICT
```

Reuse existing equivalent codes if already defined.

Do not create duplicate error middleware.

---

# 29. AUTHORIZATION

Inspect and reuse the existing authentication/authorization middleware.

Attendance permissions must be enforced on the backend.

Do not rely on the frontend hiding buttons.

Do not invent a new permission system.

---

# 30. API CONTRACT

Preserve:

```text
classId
studentId
date
dateFrom
dateTo
month
year
status
remarks
records
```

Do not introduce inconsistent aliases such as:

```text
classID
studentID
courseId
attendanceDateString
```

Search all callers before changing any response field.

---

# 31. ATTENDANCE UX — ERP DESIGN SYSTEM

The current Attendance CSS defines an Indigo palette that conflicts with the ERP's existing design system. fileciteturn9file9

Remove Attendance-specific hardcoded primary colors.

Reuse existing ERP CSS tokens.

Do not hardcode a new color system.

---

# 32. CLASS SELECTOR

Replace the old-looking native dropdown styling with the existing reusable ERP control pattern if one exists.

Requirements:

- clear selected state
- keyboard accessible
- mobile friendly
- consistent height/radius
- loading state
- empty state
- disabled state
- searchable if class volume requires it

Do not create a second unrelated select system.

---

# 33. DATE CONTROL

Use an ERP-consistent date selector.

A useful layout is:

```text
Previous day | Date | Today | Next day
```

if compatible with the existing design.

Displayed dates must use the same date-only semantics as the API.

---

# 34. DESKTOP ATTENDANCE GRID

Desktop should clearly show:

```text
Student
Admission No
Status
Remarks
```

Requirements:

- clean header
- readable row height
- clear status states
- no unnecessary horizontal overflow
- visible save state
- usable keyboard navigation where practical

---

# 35. MOBILE ATTENDANCE

Do not use:

```css
.attendance-table tbody tr {
  display: block;
}
```

as the main mobile architecture.

Use dedicated responsive student cards or another controlled mobile layout.

Each card should show:

```text
Student
Admission No
Status
Remarks
```

Status buttons must remain usable at:

```text
768px
480px
360px
```

---

# 36. SAVE BAR

The current fixed save bar can overlap the sidebar/content and obscure rows. fileciteturn9file9

Use a layout-aware sticky/fixed strategy that respects:

```text
ERP shell
sidebar
mobile viewport
safe area
scroll container
```

Attendance rows must never be hidden behind the save controls.

---

# 37. SAVE STATES

The UI should distinguish:

```text
No changes
Unsaved changes
Saving...
Saved
Save failed
```

Disable duplicate submissions while saving.

If saving fails:

```text
keep unsaved state
show error
do not silently clear the grid
```

---

# 38. LOADING / EMPTY / ERROR

Provide:

```text
Loading attendance...
```

and:

```text
No students are enrolled in this class for the selected date.
```

When records are unmarked, display:

```text
UNMARKED
```

not ABSENT.

Use the ERP's existing toast/error presentation.

---

# 39. FILE SCOPE

Expected:

```text
server/prisma/schema.prisma
server/src/routes/attendanceRoutes.js
src/pages/Attendance.jsx
src/services/api.js
src/styles/attendance.css
```

Potentially:

```text
server/src/utils/AppError.js
server/src/middleware/*
```

only if existing architecture requires it.

Do not touch unrelated modules.

---

# 40. MIGRATION STRATEGY

The repository currently has no Prisma migration directory and uses `prisma db push`.

Therefore:

1. Do not pretend a migration history exists.
2. Inspect actual PostgreSQL column names.
3. Verify existing Attendance row count.
4. Add nullable `enrollmentId`.
5. Backfill existing rows.
6. Verify 100% mapping.
7. Only then make the relation required if the deployment workflow can do so safely.
8. Add indexes.
9. Run Prisma validation/generate.
10. Build and test.

If safe staged migration is not possible with the repository's current deployment workflow:

```text
STOP
REPORT THE BLOCKER
DO NOT FORCE THE SCHEMA
```

---

# 41. REQUIRED PRE-IMPLEMENTATION DATA CHECK

Before schema changes, collect:

```text
Attendance total rows
Attendance rows with invalid studentId
Attendance rows with invalid classId
Attendance rows where Student.classId differs from Attendance.classId
Attendance rows without exactly one matching historical Enrollment
Duplicate student/date groups
Enrollment date/exit-date anomalies
```

Do not repair data automatically during this check.

---

# 42. REQUIRED TEST MATRIX

## Daily

- valid class/date
- invalid class
- invalid date
- no students
- unmarked students
- already marked students

## Membership

- current active student
- student in another class
- withdrawn student
- transferred student
- historical class membership
- legacy `Student.classId` mismatch

## Marking

- PRESENT
- ABSENT
- LATE
- EXCUSED
- clear existing attendance
- duplicate student in request
- invalid student
- invalid class/student combination
- concurrent requests

## Transfer history

Test:

```text
Class A
   ↓
transfer
   ↓
Class B
```

Verify old Attendance remains associated with Class A/Enrollment A and new Attendance with Class B/Enrollment B.

## Statistics

- stable enrollment
- join mid-month
- withdraw mid-month
- transfer mid-month
- partial marking
- fully marked day
- no attendance
- no negative unmarked
- weighted monthly percentage

## Reports

- date range
- transfer during range
- historical member no longer current
- current member not present during earlier range

## UX

Test:

```text
1366px
1024px
768px
480px
360px
```

and:

- class selector
- date selector
- scrolling
- save bar
- status buttons
- loading
- error
- empty state

---

# 43. DEFINITION OF DONE

Attendance is complete only when:

```text
[ ] Attendance has authoritative Enrollment context
[ ] Historical Attendance cannot accidentally change class context
[ ] Student.classId is never used for Attendance membership
[ ] Historical enrollment dates are respected
[ ] Current membership is respected
[ ] Attendance marking validates membership
[ ] Invalid student/class combinations are rejected
[ ] Clear/unmark works
[ ] Duplicate attendance is prevented
[ ] Concurrency is handled
[ ] Monthly denominator is date-aware
[ ] Monthly percentage is weighted
[ ] Unmarked is distinct from absent
[ ] Historical reports respect enrollment periods
[ ] Date handling is deterministic
[ ] AppError middleware is used
[ ] Authorization is enforced
[ ] ERP design tokens are used
[ ] Desktop layout is clean
[ ] Mobile layout is dedicated and usable
[ ] Save bar never blocks rows
[ ] API/frontend contracts match
[ ] Existing data is preserved
[ ] Existing Attendance rows are mapped to Enrollment
[ ] Prisma validation passes
[ ] Build passes
[ ] Backend tests pass
[ ] Frontend tests pass where available
[ ] No unrelated modules changed
```

---

# 44. REQUIRED FINAL REPORT

Return exactly:

```text
FINAL ATTENDANCE IMPLEMENTATION REPORT

1. Files changed
2. Files created
3. Files intentionally not changed
4. Exact Prisma schema changes
5. Database migration/deployment method
6. Existing Attendance row count
7. Historical Enrollment backfill result
8. Unmapped/conflicting Attendance rows
9. Attendance membership algorithm
10. Transfer/history protection
11. Attendance marking validation
12. Clear/unmark behavior
13. Duplicate/concurrency protection
14. Monthly statistics algorithm
15. Date/timezone strategy
16. Error handling
17. Authorization handling
18. API contract
19. Frontend UX changes
20. Mobile verification
21. Build result
22. Tests executed
23. Tests passed/failed
24. Remaining Student.classId Attendance references
25. Remaining limitation
26. Any deviation from this specification
```

Do not claim:

```text
Remaining limitation: None
```

unless every required verification has actually been performed.

---

# 45. IMPLEMENTATION ORDER

Implement in this order:

```text
1. Repository/data inspection
        ↓
2. Attendance data-integrity audit
        ↓
3. Attendance → Enrollment schema preparation
        ↓
4. Existing Attendance backfill
        ↓
5. Backfill verification
        ↓
6. Attendance API hardening
        ↓
7. Statistics/report redesign
        ↓
8. API/frontend contract fixes
        ↓
9. Attendance UX
        ↓
10. Transfer/history tests
        ↓
11. Concurrency tests
        ↓
12. Prisma validation + build
        ↓
13. Final repository search
```

**Do not start with CSS. Data integrity comes first.**

# END OF SPECIFICATION
