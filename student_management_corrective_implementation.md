# Student Management — Corrective Implementation Plan
## Server-Side Pagination + Authoritative Enrollment + Integrity Fixes

**Status:** Implementation specification  
**Scope:** Student Management only  
**Do not modify:** Attendance, Courses, Exams, Fees, Authentication, unrelated modules  
**Primary goal:** Correct the current Student implementation without introducing variable, parameter, API-contract, or relation mismatches.

---

# 1. IMPORTANT IMPLEMENTATION RULE

The existing Student implementation is **not considered fully correct** even though the IDE AI reported it as complete.

The IDE AI MUST:

1. Read this document completely before editing.
2. Inspect the existing code before changing it.
3. Preserve existing API contracts unless this document explicitly changes them.
4. Reuse existing project utilities, `AppError`, error middleware, Prisma conventions, and naming conventions.
5. Never invent variable names, Prisma relation names, API fields, or component props.
6. Before every change, verify that the referenced variable/parameter/relation actually exists.
7. Do not make unrelated refactors.
8. Do not modify Attendance or other modules.
9. Do not modify Prisma schema unless explicitly instructed in this document.
10. Do not execute database schema/index creation from application startup.
11. After implementation, run build/tests and report exact results.
12. If an assumption in this document conflicts with the actual repository, STOP and report the conflict instead of guessing.

---

# 2. CURRENT PROBLEMS THAT MUST BE CORRECTED

The current implementation report contains these problems:

### Problem A — Database index is created from `server/index.js`

The current implementation reportedly creates the PostgreSQL partial unique index during application startup.

This is NOT acceptable.

### Problem B — Class sorting still uses legacy `Student.class`

Current code contains:

```js
class: { class: { name: sortOrder } }
```

This can use the legacy Student → Class relationship instead of the authoritative active Enrollment relationship.

### Problem C — Active enrollment query uses `take: 1` without detecting corruption

Current code does:

```js
enrollments: {
  where: {
    status: 'ACTIVE',
    academicYear: { isCurrent: true },
  },
  take: 1,
}
```

This can hide a data-integrity problem where multiple active enrollments exist.

### Problem D — `AppError` architecture may be bypassed

The implementation creates plain `Error` objects and manually assigns:

```js
error.statusCode
error.code
```

The repository's existing `AppError` and error middleware must be used if they already exist.

### Problem E — AbortController loading state can race

An old aborted request can execute `finally` and set:

```js
setLoading(false)
```

while a newer request is still running.

### Problem F — Date range filtering may exclude the selected `dateTo` day

Current code uses:

```js
where.admissionDate.lte = new Date(dateTo)
```

This must be verified against the project's date storage and timezone conventions.

### Problem G — Pagination must handle page becoming invalid

If the current page becomes greater than `totalPages` after filtering/deleting data, the frontend must move to a valid page instead of permanently displaying an empty invalid page.

### Problem H — API sends both `pageSize` and `limit`

The current frontend sends both:

```text
pageSize
limit
```

for the same value.

A single canonical parameter should be used unless backward compatibility requires `limit`.

### Problem I — `totalPages` behavior for zero results must be intentional

Current implementation returns:

```js
Math.ceil(total / parsedPageSize) || 1
```

The frontend/backend contract must explicitly define the zero-result behavior.

---

# 3. FIX 1 — REMOVE DATABASE DDL FROM APPLICATION STARTUP

## File

```text
server/index.js
```

## Required change

Remove any application-startup code that executes:

```sql
CREATE UNIQUE INDEX ...
```

through:

```js
$executeRawUnsafe(...)
```

or equivalent.

Application startup MUST NOT modify database schema/indexes.

## Required architecture

```text
Application startup
      ↓
Connect to database
      ↓
Start server
```

NOT:

```text
Application startup
      ↓
Modify database schema
      ↓
Start server
```

## Important

Do not delete an existing legitimate startup operation unless it is specifically the partial enrollment unique-index creation.

Do not change unrelated startup behavior.

## Database constraint

If the partial unique index is required, it must be introduced through the project's proper database migration mechanism.

However:

**Do NOT automatically create a migration if the repository's migration strategy is unknown.**

First inspect:

```text
server/prisma/
prisma/migrations/
package.json
existing migration commands
```

If migrations are already used, create the appropriate migration.

If the project intentionally does not use Prisma migrations, STOP and report the safest repository-compatible method instead of inventing one.

---

# 4. FIX 2 — AUTHORITATIVE CLASS SORTING

## File

```text
server/src/routes/studentRoutes.js
```

Current problematic logic:

```js
const validSortFields = {
  name: { firstName: sortOrder },
  class: { class: { name: sortOrder } },
  ...
};
```

## Required behavior

`sortBy=class` must represent the student's **current active enrollment class**, not the legacy:

```text
Student.class
Student.classId
```

The query must use the actual Prisma relation names from the repository.

## DO NOT GUESS

Before modifying this:

1. Inspect `schema.prisma`.
2. Confirm the exact Student → Enrollment relation name.
3. Confirm the exact Enrollment → Class relation name.
4. Confirm AcademicYear relation name.
5. Confirm Prisma version and supported relation-order syntax.

Then implement the safest supported query.

## If Prisma cannot safely express the required filtered relation sort

Do NOT fake it using `Student.class`.

Instead, choose a repository-compatible approach such as:

- a carefully designed query,
- a separate query strategy,
- or an explicit limitation documented in the implementation.

The final behavior must never silently use legacy Student.class as the source of current membership.

---

# 5. FIX 3 — DO NOT HIDE MULTIPLE ACTIVE ENROLLMENTS

## Files

```text
server/src/routes/studentRoutes.js
```

## Required invariant

For the current academic year:

```text
0 ACTIVE enrollments → student has no current class
1 ACTIVE enrollment  → valid current class
>1 ACTIVE enrollments → data integrity conflict
```

## Do NOT use this as a corruption-hiding mechanism

```js
take: 1
```

when the business operation needs to verify integrity.

## Required implementation

For detail/transfer/membership-critical operations:

```js
const activeEnrollments = await tx.enrollment.findMany({
  where: {
    studentId,
    academicYearId: activeAcademicYear.id,
    status: 'ACTIVE',
  },
});
```

Then:

```js
if (activeEnrollments.length > 1) {
  throw new AppError(
    'Data integrity conflict: Student has multiple active enrollments in the current academic year.',
    409,
    'MULTIPLE_ACTIVE_ENROLLMENTS'
  );
}
```

Use the project's actual `AppError` constructor/signature after inspecting it.

## For list responses

The implementation must not silently hide corruption.

If the list query cannot cheaply detect this for every student, document the chosen strategy and ensure the dedicated student detail/assignment operations detect it.

Do not invent an incompatible query.

---

# 6. FIX 4 — USE EXISTING `AppError` AND ERROR MIDDLEWARE

## Before changing errors

Search the repository for:

```text
class AppError
new AppError
errorHandler
statusCode
```

Determine the existing pattern.

## Required behavior

Do not create ad-hoc errors like:

```js
const error = new Error(...)
error.statusCode = ...
error.code = ...
throw error;
```

if the repository already provides an `AppError`.

Use the existing project's standard error mechanism.

Required error semantics remain:

### No active academic year

```text
HTTP 400
NO_ACTIVE_ACADEMIC_YEAR
```

### Invalid target class

```text
HTTP 422
INVALID_TARGET_CLASS
```

### Capacity exceeded

```text
HTTP 409
CLASS_CAPACITY_EXCEEDED
```

### Multiple active enrollments

```text
HTTP 409
MULTIPLE_ACTIVE_ENROLLMENTS
```

### Concurrent enrollment conflict

```text
HTTP 409
CONCURRENT_ENROLLMENT_CONFLICT
```

Use the repository's actual error middleware rather than creating a second error-handling system.

---

# 7. FIX 5 — MAKE STUDENT FETCHING DETERMINISTIC

## Current issue

Current implementation uses:

```js
enrollments: {
  where: {
    status: 'ACTIVE',
    academicYear: { isCurrent: true },
  },
  take: 1,
}
```

without ordering.

## Required behavior

For authoritative current membership:

1. Query active enrollments for the current academic year.
2. Detect multiple records.
3. Only then derive the current class.

Conceptually:

```text
activeEnrollments.length === 0
    → currentClass = null

activeEnrollments.length === 1
    → currentClass = activeEnrollments[0].class

activeEnrollments.length > 1
    → integrity error
```

Do not use:

```js
student.class
```

as a fallback for current membership.

This is especially important because:

```text
Student.classId
```

is now a legacy synchronized field.

---

# 8. FIX 6 — CORRECT RESPONSE NORMALIZATION

The API must derive current membership from active Enrollment.

Expected semantic response:

```js
{
  ...student,
  classId: activeEnrollment?.classId ?? null,
  class: activeEnrollment?.class ?? null
}
```

Important:

```js
?? null
```

is preferred over:

```js
|| null
```

for IDs, because nullish semantics are clearer.

However, preserve the project's existing style if there is a strong reason.

## NEVER do:

```js
classId: student.classId
```

as the authoritative response.

## NEVER do:

```js
class: student.class
```

as the authoritative current class.

---

# 9. FIX 7 — SEARCH/PAGINATION CONTRACT

## Canonical query parameter

Use:

```text
page
pageSize
```

as the canonical frontend/backend parameters.

Do not send both:

```text
pageSize
limit
```

unless the repository has existing clients that require `limit`.

## Backward compatibility

Before removing `limit`:

1. Search the repository for `limit`.
2. Search all frontend calls to `/students`.
3. Search any other services using `getStudents`.

If `limit` is actively required by existing callers:

- keep backend support for `limit`,
- but frontend should use `pageSize`.

Do not break existing consumers.

---

# 10. FIX 8 — PAGINATION EDGE CASES

The frontend must handle:

```text
total = 0
totalPages = 0 or repository-defined equivalent
```

consistently.

The implementation must also handle:

```text
current page > totalPages
```

Example:

```text
Page 2
14 students
10 per page
```

Then after deletion/filter:

```text
5 students
1 page
```

The frontend must automatically move:

```text
page 2 → page 1
```

and refetch.

## Avoid infinite effects

Do not create a `useEffect` loop where:

```text
fetch → setPage → fetch → setPage → ...
```

Use stable conditions.

---

# 11. FIX 9 — ABORTCONTROLLER RACE CONDITION

Current pattern can allow an old request's `finally` block to set loading false while a newer request is active.

## Required pattern

Associate loading completion with the current controller/request.

Conceptually:

```js
const controller = new AbortController();
abortControllerRef.current = controller;

try {
  setLoading(true);

  const result = await getStudents(..., {
    signal: controller.signal,
  });

  if (controller.signal.aborted) return;

  setStudents(...);
} catch (error) {
  if (error.name === 'AbortError') return;

  if (controller.signal.aborted) return;

  // handle real error
} finally {
  if (abortControllerRef.current === controller) {
    setLoading(false);
    abortControllerRef.current = null;
  }
}
```

Adapt this to the existing `apiCall()` implementation.

Do not introduce a second request-management abstraction.

---

# 12. FIX 10 — DATE RANGE FILTER

## Current code

```js
where.admissionDate.lte = new Date(dateTo);
```

This must be verified.

Before changing:

1. Inspect Prisma type for `admissionDate`.
2. Inspect how existing code stores dates.
3. Inspect existing date filtering elsewhere.
4. Determine timezone convention.

## Desired semantic

If a user selects:

```text
From: 01-08-2026
To:   14-08-2026
```

the filter should include the complete `14-08-2026` day.

A safe conceptual approach is:

```text
dateFrom = start of selected day
dateTo   = exclusive start of following day
```

But implement according to the repository's established timezone convention.

Do not introduce timezone bugs.

---

# 13. FIX 11 — AGE FILTER VERIFICATION

The backend currently accepts:

```text
ageMin
ageMax
```

but the documented frontend state does not clearly expose them.

Search the full `Students.jsx` before changing anything.

Then choose one of:

### Option A

Age filters are intentionally supported:

→ expose them correctly in the UI and URL state.

### Option B

Age filters are legacy backend functionality:

→ leave backend compatibility intact and do not expose a broken UI.

Do not remove an existing API parameter without checking consumers.

---

# 14. FIX 12 — PRESERVE EXISTING ENROLLMENT ARCHITECTURE

The Student module must follow:

```text
AcademicYear
      ↓
Class
      ↓
ACTIVE Enrollment
      ↓
Student
```

Current class membership MUST come from:

```text
Enrollment.status = ACTIVE
Enrollment.academicYear = current academic year
```

The legacy:

```text
Student.classId
Student.class
```

may remain for compatibility but must not become the source of truth.

---

# 15. FIX 13 — DO NOT CHANGE CREATE/TRANSFER SEMANTICS

The corrective work is NOT permission to redesign student creation/transfer.

Preserve the existing approved Stage 1 behavior:

### New student + class

```text
validate academic year
validate class
lock target class
validate capacity
create Student
create ACTIVE Enrollment
synchronize legacy Student.classId
```

### New student without class

```text
create Student
do not create Enrollment
```

### Same class

```text
no duplicate Enrollment
```

### Transfer

```text
old ACTIVE → TRANSFERRED
new ACTIVE → target class
Student.classId → synchronized
```

### Remove class

```text
ACTIVE → WITHDRAWN
Student.classId → null
```

### Multiple active enrollments

```text
409 conflict
rollback
```

Do not change these semantics during pagination/UX correction.

---

# 16. FIX 14 — CAPACITY CONCURRENCY MUST REMAIN SAFE

If the repository already implements:

```sql
SELECT id
FROM "classes"
WHERE id = ...
FOR UPDATE
```

for capacity validation, preserve it.

The intended sequence is:

```text
BEGIN TRANSACTION
      ↓
LOCK target Class row
      ↓
COUNT ACTIVE enrollments
      ↓
validate capacity
      ↓
create enrollment
      ↓
COMMIT
```

Do not remove the row lock.

Do not move the capacity count outside the transaction.

---

# 17. FIX 15 — DO NOT CREATE A SECOND API CONTRACT

The existing API should remain:

```text
GET /api/students
```

with query parameters for:

```text
page
pageSize
search
classId
status
gender
bloodGroup
dateFrom
dateTo
sortBy
sortOrder
```

Only retain additional parameters if they already exist and are used.

Response should remain structurally compatible:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  }
}
```

If existing consumers require `limit`, preserve it in the response only if necessary.

Do not arbitrarily rename:

```text
data
pagination
pageSize
totalPages
```

---

# 18. FRONTEND URL STATE

URL state should remain synchronized for:

```text
page
pageSize
search
classId
status
gender
bloodGroup
dateFrom
dateTo
sortBy
sortOrder
```

When a filter/search/sort changes:

```text
page → 1
```

When only pagination changes:

```text
page → requested page
```

Do not reset page unnecessarily.

---

# 19. FILTER + SEARCH + PAGINATION BEHAVIOR

Required behavior:

```text
User types search
       ↓
300ms debounce
       ↓
cancel previous request
       ↓
page = 1
       ↓
GET /api/students?search=...
       ↓
server filters database
       ↓
server returns requested page
```

Never load all students and filter them in React.

---

# 20. REQUIRED VERIFICATION

After implementation, the IDE AI MUST run:

```bash
npm run build
```

and any existing backend tests.

It must also verify:

### Case 1

```text
14 students
pageSize=10
```

Expected:

```text
page 1 → 10
page 2 → 4
```

### Case 2

Search:

```text
search=Ahmed
```

Expected:

```text
only matching records
pagination recalculated
page reset to 1
```

### Case 3

Class filter:

```text
classId=<class>
```

Expected:

```text
only students with ACTIVE Enrollment
for the current AcademicYear
```

### Case 4

Sort by class.

Expected:

```text
current active Enrollment class
```

not legacy Student.class.

### Case 5

Student with zero active enrollment.

Expected:

```text
classId = null
class = null
```

### Case 6

Student with multiple active enrollments.

Expected:

```text
MULTIPLE_ACTIVE_ENROLLMENTS
HTTP 409
```

for membership-critical operations.

### Case 7

Delete/filter causes page to become invalid.

Expected:

```text
page automatically corrected
```

### Case 8

Rapid search:

```text
A
Ah
Ahm
Ahme
Ahmed
```

Expected:

```text
stale requests cancelled
latest result wins
loading state remains correct
```

### Case 9

Date range.

Expected:

```text
dateTo includes the entire selected day
```

according to project timezone convention.

### Case 10

Class capacity.

Expected:

```text
concurrent enrollment requests cannot exceed capacity
```

---

# 21. FILE SCOPE

## Allowed to change

Only if required:

```text
server/src/routes/studentRoutes.js
src/services/api.js
src/pages/Students.jsx
src/styles/students.css
server/index.js
database migration files (ONLY if the repository migration strategy supports them)
```

## Do NOT change

```text
Attendance
Courses
Exams
Fees
Accounts
Salary
Authentication
Authorization
Unrelated Prisma models
Unrelated routes
Unrelated CSS
```

If another file is required, STOP and report:

```text
File:
Reason:
Exact change:
Why existing files cannot solve it:
```

Do not silently modify additional files.

---

# 22. NO VARIABLE / PARAMETER / RELATION MISMATCH RULE

Before every code edit:

### Variables

Verify the variable exists in the same scope.

### Functions

Verify the function signature before changing callers.

### API

Verify:

```text
frontend parameter
    ↓
api.js parameter
    ↓
HTTP query parameter
    ↓
backend req.query parameter
```

must match.

### Prisma relations

Verify actual names in:

```text
schema.prisma
```

Never assume:

```text
class
enrollments
academicYear
```

unless they actually exist with those names.

### Response fields

Verify:

```text
backend response
    ↓
frontend property access
```

before modifying either side.

---

# 23. DO NOT USE `||` TO HIDE DATA INTEGRITY PROBLEMS

Avoid patterns like:

```js
activeEnrollment?.class || student.class
```

for authoritative current membership.

That silently falls back to legacy data.

Correct semantic:

```text
ACTIVE Enrollment exists
    ↓
use it

No ACTIVE Enrollment
    ↓
current class = null

Multiple ACTIVE Enrollment
    ↓
integrity conflict
```

The legacy Student.class relation is NOT an authoritative fallback.

---

# 24. FINAL DEFINITION OF DONE

The Student Management implementation is considered complete only when:

- [ ] No database DDL runs during application startup.
- [ ] Proper database migration strategy is respected.
- [ ] Current class membership comes from ACTIVE Enrollment.
- [ ] Legacy Student.class is not used for membership decisions.
- [ ] Class sorting does not use legacy Student.class.
- [ ] Multiple ACTIVE enrollments are not hidden by `take: 1`.
- [ ] Existing AppError/error middleware is used.
- [ ] Pagination is server-side.
- [ ] Search is server-side.
- [ ] Search is debounced.
- [ ] Stale requests are cancelled safely.
- [ ] Loading state cannot be incorrectly cleared by an old request.
- [ ] Filters reset pagination correctly.
- [ ] Invalid pages are corrected.
- [ ] Date ranges include the selected end date correctly.
- [ ] API parameter names are consistent.
- [ ] Existing consumers of `limit` are not broken.
- [ ] Mobile student cards work.
- [ ] Student modal scroll containment works.
- [ ] Desktop pagination works.
- [ ] Mobile pagination works.
- [ ] Build passes.
- [ ] Relevant tests pass.
- [ ] No unrelated files were modified.
- [ ] No new variable/parameter/relation mismatches exist.

---

# 25. REQUIRED FINAL REPORT FROM IDE AI

After implementation, do NOT simply say:

> "Implementation complete."

Return this exact structure:

```text
IMPLEMENTATION REPORT

1. Files changed
2. Files intentionally not changed
3. Database migration/index handling
4. Student membership architecture
5. Pagination implementation
6. Search implementation
7. Sorting implementation
8. Filter implementation
9. AbortController/loading behavior
10. Date filtering behavior
11. Error handling
12. Multiple-active-enrollment handling
13. API contract
14. Build result
15. Test result
16. Remaining known limitations
17. Any deviation from this specification
```

If there is any deviation, explain it before claiming completion.

---

# END OF SPECIFICATION
