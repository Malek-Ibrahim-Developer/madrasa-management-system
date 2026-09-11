# Courses & Classes Module --- Robustness Fixes & Solution Plan

## Purpose

This document defines the fixes required to evolve the current **Courses
& Classes Module** from a functional CRUD prototype into a more robust
production-ready module for the Altus Kairos Madrasa Management System.

The current implementation is based on:

-   Prisma database schema
-   Express REST API
-   React frontend
-   `Courses.jsx`
-   `courses.css`
-   `src/services/api.js`

The recommendations below distinguish between: - **Current
implementation:** directly observed in the supplied module
documentation. - **Required improvement:** architectural recommendation
based on the current implementation and the needs of a real
institutional ERP.

------------------------------------------------------------------------

# 1. Executive Summary

The current module successfully provides:

-   Class listing
-   Create/update/delete
-   Search
-   Teacher display
-   Capacity display
-   Student count
-   Responsive UI
-   Add/edit modal
-   Delete confirmation

However, the current model is still centered around a simple `Class`
CRUD record.

For a robust Madrasa ERP, the module should evolve toward:

``` text
Academic Year
      |
      v
Class / Class Offering
      |
      +---- Section
      |
      +---- Teacher Assignments
      |
      +---- Subjects
      |
      +---- Enrollments
      |
      +---- Timetable
      |
      +---- Attendance
      |
      +---- Exams / Results
      |
      +---- Audit History
```

The highest-priority work is:

1.  Authentication and authorization
2.  Backend validation
3.  Safe deletion/archiving
4.  Proper teacher relationships
5.  Academic-year support
6.  Enrollment model
7.  Data integrity and database constraints
8.  Audit logging
9.  Pagination/server-side search
10. Subjects, timetable, attendance and exam integration

------------------------------------------------------------------------

# 2. Current Module Snapshot

## Current Class Model

The supplied schema currently contains:

``` prisma
model Class {
  id        String   @id @default(cuid())
  name      String
  section   String?
  code      String   @unique
  teacher   String?
  capacity  Int      @default(40)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  students    Student[]
  exams       Exam[]
  attendances Attendance[]

  @@map("classes")
}
```

## Current API

``` text
GET    /api/classes
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id
```

## Current Frontend

The React page currently supports:

-   Search
-   Add
-   Edit
-   Delete
-   Refresh
-   Loading state
-   Empty state
-   Capacity progress
-   Desktop table
-   Mobile cards

------------------------------------------------------------------------

# 3. Fix #1 --- Authentication & Authorization

## Problem

The supplied route file does not show authentication or permission
checks.

A class-management API should not assume that every authenticated or
unauthenticated request can perform every operation.

For example:

``` text
Administrator → create/edit/archive
Academic Manager → create/edit
Teacher → view
Other staff → view
```

## Solution

Add authentication middleware before protected routes.

Example architecture:

``` text
Request
  |
  v
Authentication Middleware
  |
  v
User Identity
  |
  v
Authorization Middleware
  |
  v
Class Controller
```

Example:

``` javascript
router.post(
  '/',
  requireAuth,
  requirePermission('classes.create'),
  createClass
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('classes.update'),
  updateClass
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('classes.delete'),
  deleteClass
);
```

## Recommended Permissions

``` text
classes.view
classes.create
classes.update
classes.archive
classes.delete
classes.manage_teachers
classes.manage_capacity
```

## Important

Authorization must be enforced on the server. Hiding buttons in React is
not security.

------------------------------------------------------------------------

# 4. Fix #2 --- Strong Backend Validation

## Problem

The current POST endpoint mainly checks:

``` javascript
if (!name || !code)
```

The frontend performs additional validation, but frontend validation
cannot be trusted as the only protection.

## Solution

Introduce a validation layer.

Use a schema validator such as Zod, Joi, or another project-approved
validation library.

Example conceptual schema:

``` javascript
const classSchema = z.object({
  name: z.string().trim().min(1).max(100),
  section: z.string().trim().max(50).optional(),
  code: z.string().trim().min(1).max(30),
  capacity: z.number().int().positive().max(10000),
  teacherId: z.string().optional()
});
```

Validate:

-   name
-   section
-   code
-   capacity
-   academic year
-   teacher IDs
-   status

## Benefits

The API rejects:

``` text
empty values
negative capacity
invalid data types
excessively long values
malformed IDs
invalid status values
```

------------------------------------------------------------------------

# 5. Fix #3 --- Proper Error Handling

## Problem

The current API returns:

``` javascript
res.status(500).json({
  success: false,
  message: error.message
});
```

This is too generic and can expose internal implementation details.

## Solution

Create centralized error handling.

Example:

``` javascript
app.use(errorHandler);
```

The application should distinguish:

``` text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
500 Internal Server Error
```

Example response:

``` json
{
  "success": false,
  "code": "CLASS_CODE_EXISTS",
  "message": "A class with this code already exists."
}
```

Detailed database errors should remain in server logs.

------------------------------------------------------------------------

# 6. Fix #4 --- Duplicate Class Code on Update

## Problem

POST explicitly checks duplicate codes, while PUT relies on the database
unique constraint.

This can result in an ugly generic error instead of a meaningful
conflict response.

## Solution

Before updating:

``` javascript
const existing = await prisma.class.findFirst({
  where: {
    code,
    NOT: {
      id
    }
  }
});
```

If found:

``` javascript
return res.status(409).json({
  success: false,
  code: 'CLASS_CODE_EXISTS',
  message: `Class with code "${code}" already exists`
});
```

Keep the database `@unique` constraint as the final protection.

------------------------------------------------------------------------

# 7. Fix #5 --- Replace Teacher String With a Relationship

## Current Problem

The schema has:

``` prisma
teacher String?
```

This stores a teacher's name directly in the class.

This causes problems when:

-   teacher names change
-   a teacher leaves
-   multiple teachers teach the class
-   teacher information needs to be reused
-   teacher assignments need history

## Solution

Use a teacher/staff relationship.

At minimum:

``` prisma
model Class {
  id        String @id @default(cuid())
  name      String
  section   String?
  code      String @unique
  capacity  Int    @default(40)

  teacherId String?
  teacher   Teacher? @relation(fields: [teacherId], references: [id])
}
```

However, the better long-term design is an assignment table.

``` prisma
model ClassTeacher {
  id        String @id @default(cuid())
  classId   String
  teacherId String
  role      String?
  startDate DateTime?
  endDate   DateTime?

  class   Class   @relation(fields: [classId], references: [id])
  teacher Teacher @relation(fields: [teacherId], references: [id])

  @@index([classId])
  @@index([teacherId])
}
```

## Why the assignment table is better

It supports:

``` text
Class 8A
  ├── Main Teacher
  ├── Quran Teacher
  └── Assistant Teacher
```

and preserves assignment history.

------------------------------------------------------------------------

# 8. Fix #6 --- Add Academic Year

## Problem

The current Class model does not identify which academic year a class
belongs to.

This becomes problematic when:

``` text
Class 8A — 2025/26
Class 8A — 2026/27
```

need to coexist.

## Solution

Create an academic-year entity.

``` prisma
model AcademicYear {
  id        String   @id @default(cuid())
  name      String   @unique
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)

  classes Class[]
}
```

Then connect Class:

``` prisma
model Class {
  id            String @id @default(cuid())
  name          String
  section       String?
  code          String
  academicYearId String

  academicYear AcademicYear @relation(
    fields: [academicYearId],
    references: [id]
  )
}
```

## Result

The system can preserve:

``` text
2025/26
  Class 8A

2026/27
  Class 8A
```

as separate academic instances.

------------------------------------------------------------------------

# 9. Fix #7 --- Introduce Enrollment

## Problem

The current module only counts students through the class relation:

``` javascript
_count.students
```

A student needs more than a direct class link.

The system should know:

-   when the student joined
-   academic year
-   enrollment status
-   roll number
-   transfer/exit information
-   previous class

## Solution

Create an Enrollment model.

``` prisma
model Enrollment {
  id             String   @id @default(cuid())
  studentId      String
  classId        String
  academicYearId String
  enrollmentDate DateTime @default(now())
  exitDate       DateTime?
  rollNumber     String?
  status         EnrollmentStatus @default(ACTIVE)

  student      Student      @relation(fields: [studentId], references: [id])
  class        Class        @relation(fields: [classId], references: [id])
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id])

  @@index([studentId])
  @@index([classId])
  @@index([academicYearId])
  @@unique([studentId, academicYearId])
}
```

Example status:

``` prisma
enum EnrollmentStatus {
  ACTIVE
  TRANSFERRED
  WITHDRAWN
  COMPLETED
}
```

------------------------------------------------------------------------

# 10. Fix #8 --- Capacity Must Be Enforced

## Problem

Capacity currently acts primarily as a visual indicator.

A class with:

``` text
Capacity = 40
Students = 40
```

should not silently accept student #41 unless the institution explicitly
permits it.

## Solution

Enrollment creation should check active enrollment count.

Conceptually:

``` javascript
const activeCount = await prisma.enrollment.count({
  where: {
    classId,
    status: 'ACTIVE'
  }
});

if (activeCount >= class.capacity) {
  throw new ConflictError('Class is at full capacity');
}
```

If over-enrollment is allowed by policy, require an authorized override.

------------------------------------------------------------------------

# 11. Fix #9 --- Improve Capacity Display

## Problem

Current frontend code caps the percentage at 100:

``` javascript
Math.min(..., 100)
```

Therefore:

``` text
45 / 40
```

appears as:

``` text
100%
```

instead of showing the real over-capacity state.

## Solution

Keep the real percentage:

``` javascript
const percentage = capacity > 0
  ? Math.round((students / capacity) * 100)
  : 0;
```

Then derive status:

``` javascript
if (percentage >= 100) {
  status = 'OVER_CAPACITY';
} else if (percentage >= 80) {
  status = 'NEAR_CAPACITY';
} else {
  status = 'NORMAL';
}
```

UI example:

``` text
45 / 40
112%
Over capacity by 5
```

------------------------------------------------------------------------

# 12. Fix #10 --- Safe Delete / Archive

## Problem

Hard-deleting a class can destroy or break historical relationships
involving:

-   students
-   attendance
-   exams
-   results
-   timetable
-   enrollments

## Recommended Solution

Use soft deletion / archival.

Add:

``` prisma
status ClassStatus @default(ACTIVE)
archivedAt DateTime?
```

Example:

``` prisma
enum ClassStatus {
  ACTIVE
  ARCHIVED
}
```

Instead of:

``` text
DELETE class
```

the normal operation becomes:

``` text
Archive class
```

The UI should say:

> Archive Class

instead of making deletion the normal administrative action.

## Optional Permanent Delete

Permanent deletion should be:

-   restricted to high-level administrators
-   blocked if dependent records exist
-   explicitly confirmed
-   audited

------------------------------------------------------------------------

# 13. Fix #11 --- Add Database Integrity Rules

## Required Constraints

Use database-level constraints wherever possible.

Examples:

``` prisma
code String @unique
```

and indexes:

``` prisma
@@index([academicYearId])
@@index([name])
@@index([status])
```

For relationships:

``` prisma
@@index([classId])
@@index([teacherId])
@@index([studentId])
```

## Important Principle

Application validation and database constraints should work together.

Do not rely on React or Express alone.

------------------------------------------------------------------------

# 14. Fix #12 --- Better Class Code Generation

## Problem

The current frontend generates the code by taking up to five characters
from the class name.

The supplied documentation's example describes a cleaner format such as:

``` text
Class 8 + A → CLS-08A
```

but the current implementation does not actually produce that exact
format.

## Solution

Define one official server-side code-generation rule.

Example:

``` text
Class 1 A → CLS-01-A
Class 8 B → CLS-08-B
Hifz Year 1 Boys → HIFZ-01-BOYS
```

The frontend may preview the code, but the server should be
authoritative.

## Important

If institutions have different naming conventions, make code format
configurable.

------------------------------------------------------------------------

# 15. Fix #13 --- Add Class Status / Lifecycle

## Problem

A class currently has no explicit lifecycle.

## Solution

Add:

``` prisma
enum ClassStatus {
  DRAFT
  ACTIVE
  CLOSED
  ARCHIVED
}
```

Possible lifecycle:

``` text
DRAFT
  ↓
ACTIVE
  ↓
CLOSED
  ↓
ARCHIVED
```

This is safer than deleting historical records.

------------------------------------------------------------------------

# 16. Fix #14 --- Add Audit Logging

## Problem

There is currently no demonstrated record of:

-   who changed a class
-   what changed
-   when it changed

## Solution

Create an audit-log system.

Example:

``` prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  entity    String
  entityId  String
  oldValue  Json?
  newValue  Json?
  createdAt DateTime @default(now())

  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
}
```

Example history:

``` text
13 Aug 2026
Admin
Updated Class 8A

Teacher:
Ahmed Khan → Yusuf Ali
```

Audit logging is especially important for an institutional ERP.

------------------------------------------------------------------------

# 17. Fix #15 --- Add Subjects

## Problem

The current model doesn't distinguish between a class and the
subjects/courses taught within that class.

## Solution

Create:

``` prisma
model Subject {
  id          String @id @default(cuid())
  name        String
  code        String @unique
  description String?
  isActive    Boolean @default(true)
}
```

Then connect classes and subjects:

``` prisma
model ClassSubject {
  id        String @id @default(cuid())
  classId   String
  subjectId String

  class   Class   @relation(fields: [classId], references: [id])
  subject Subject @relation(fields: [subjectId], references: [id])

  @@unique([classId, subjectId])
}
```

Later, teacher assignment can be attached to the class-subject
relationship.

------------------------------------------------------------------------

# 18. Fix #16 --- Add Teacher Assignment Per Subject

Instead of:

``` text
Class 8A → Teacher Ahmed
```

the system can support:

``` text
Class 8A
  Quran → Ustadh Ahmed
  Arabic → Ustadh Yusuf
  Fiqh → Ustadh Bilal
  Mathematics → Mr. Ali
```

Recommended structure:

``` text
ClassSubject
   |
   +--- teacherId
   |
   +--- periodsPerWeek
```

or a dedicated assignment model if multiple teachers are required.

------------------------------------------------------------------------

# 19. Fix #17 --- Timetable Integration

A robust academic module should eventually support:

``` text
Class
Subject
Teacher
Day
Period
Room
```

Example:

``` prisma
model TimetableEntry {
  id        String @id @default(cuid())
  classId   String
  subjectId String
  teacherId String
  dayOfWeek Int
  startTime DateTime
  endTime   DateTime
  room      String?
}
```

The exact schema should be adapted to the project's existing timetable
architecture.

------------------------------------------------------------------------

# 20. Fix #18 --- Pagination

## Problem

Current GET uses:

``` javascript
findMany()
```

with no pagination.

## Solution

Add:

``` text
GET /api/classes?page=1&limit=25
```

Response:

``` json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 120,
    "totalPages": 5
  }
}
```

------------------------------------------------------------------------

# 21. Fix #19 --- Server-Side Search and Filtering

## Problem

Search currently happens in React:

``` javascript
classes.filter(...)
```

This requires all classes to already be downloaded.

## Solution

Move searching to the API.

Example:

``` text
GET /api/classes?search=hifz
GET /api/classes?status=ACTIVE
GET /api/classes?academicYearId=...
GET /api/classes?teacherId=...
```

The backend then builds the Prisma query.

This becomes important as data grows.

------------------------------------------------------------------------

# 22. Fix #20 --- Better Filtering

Add filters for:

``` text
Academic Year
Status
Section
Teacher
Capacity Status
Program
```

Example:

``` text
All
Active
Archived
Near Capacity
Over Capacity
```

------------------------------------------------------------------------

# 23. Fix #21 --- Bulk Operations

For real institutional use, administrators should not have to create
every class manually.

Add future support for:

-   Bulk class creation
-   Duplicate class structure
-   CSV import
-   Excel import
-   Bulk archive
-   Bulk teacher assignment
-   Bulk subject assignment

Example:

``` text
Create Classes
----------------
Class 1 A
Class 1 B
Class 2 A
Class 2 B
Class 3 A
Class 3 B
```

------------------------------------------------------------------------

# 24. Fix #22 --- Accessibility

The UI should eventually support:

-   keyboard navigation
-   proper focus management
-   accessible modal behavior
-   `aria-label` on icon-only buttons
-   visible focus states
-   screen-reader-friendly error messages
-   sufficient contrast
-   ESC to close modals

Example:

``` jsx
<button
  aria-label="Edit Class"
  title="Edit Class"
>
  <MdEdit />
</button>
```

------------------------------------------------------------------------

# 25. Fix #23 --- Loading and Mutation States

The current UI has a loading state, but a more robust version should
distinguish:

``` text
Initial page loading
Refreshing
Creating
Updating
Archiving
Deleting
```

Do not allow duplicate submissions.

For example:

``` text
Saving...
```

should disable the submit action until the request completes.

------------------------------------------------------------------------

# 26. Fix #24 --- Avoid Stale State After Mutations

The current implementation calls:

``` javascript
fetchClasses();
```

after mutations.

This works, but a more advanced architecture can update the local cache
or use a data-fetching library.

Recommended options depend on the project's existing architecture:

``` text
React Query / TanStack Query
```

or an existing application-level data store.

Benefits:

-   caching
-   invalidation
-   refetching
-   mutation states
-   stale-data handling

Do not introduce another state-management library if the project already
has an established pattern.

------------------------------------------------------------------------

# 27. Fix #25 --- API Service Error Normalization

Current frontend code accesses:

``` javascript
error.response?.data?.message
```

which suggests assumptions about the HTTP client.

The API service should normalize errors so components do not need to
know the transport-layer structure.

Example:

``` javascript
try {
  await createClass(data);
} catch (error) {
  toast.error(error.message);
}
```

The service layer should convert backend responses into consistent
application errors.

------------------------------------------------------------------------

# 28. Fix #26 --- Not Found Handling

The PUT and DELETE APIs should distinguish:

``` text
Class exists
```

from:

``` text
Class does not exist
```

For example:

``` text
404 CLASS_NOT_FOUND
```

instead of a generic 500 response.

------------------------------------------------------------------------

# 29. Fix #27 --- Transaction Safety

Some operations will eventually involve multiple records.

For example:

``` text
Create Class
+
Assign Teacher
+
Assign Subjects
+
Create Timetable
```

These should use database transactions where atomicity is required.

Conceptually:

``` javascript
await prisma.$transaction(async (tx) => {
  // create class
  // create assignments
  // create subjects
});
```

If one operation fails, the entire transaction should roll back.

------------------------------------------------------------------------

# 30. Fix #28 --- Concurrency Protection

Consider two administrators enrolling students simultaneously.

Both might see:

``` text
39 / 40
```

and both attempt to add a student.

Without appropriate transaction/locking strategy, the class can end up
at:

``` text
41 / 40
```

if over-capacity isn't intentionally allowed.

Capacity enforcement should therefore happen inside a transaction or
another concurrency-safe mechanism.

------------------------------------------------------------------------

# 31. Fix #29 --- Separate Domain Concepts

The name "Courses & Classes" currently combines several concepts.

Recommended conceptual model:

``` text
Program
  |
  +--- Class
        |
        +--- Section
        |
        +--- Subject
        |
        +--- Teacher Assignment
        |
        +--- Enrollment
```

For example:

``` text
Program:
Hifz Program

Class:
Hifz Year 2

Section:
Boys

Subjects:
Quran
Tajweed
Arabic
```

This gives the system room to support different madrasa structures.

------------------------------------------------------------------------

# 32. Recommended Target Architecture

A stronger target structure is:

``` text
AcademicYear
     |
     v
Program
     |
     v
Class
     |
     +------ Section
     |
     +------ ClassTeacher
     |
     +------ ClassSubject
     |          |
     |          +------ Teacher
     |          +------ Subject
     |
     +------ Enrollment
     |          |
     |          +------ Student
     |
     +------ Timetable
     |
     +------ Attendance
     |
     +------ Exam
     |
     +------ Result
     |
     +------ AuditLog
```

------------------------------------------------------------------------

# 33. Recommended API Structure

Instead of keeping everything in one large route file forever, move
toward:

``` text
/api/classes
/api/classes/:id
/api/classes/:id/teachers
/api/classes/:id/subjects
/api/classes/:id/students
/api/classes/:id/enrollments
/api/classes/:id/timetable
/api/classes/:id/archive
```

Potential endpoints:

``` text
GET    /api/classes
POST   /api/classes
GET    /api/classes/:id
PUT    /api/classes/:id
PATCH  /api/classes/:id/status
POST   /api/classes/:id/archive
GET    /api/classes/:id/students
GET    /api/classes/:id/teachers
GET    /api/classes/:id/subjects
```

Exact endpoint design should follow the existing project's conventions.

------------------------------------------------------------------------

# 34. Recommended Frontend Structure

The current `Courses.jsx` contains a lot of responsibilities.

As the module grows, consider splitting it:

``` text
pages/
  Courses/
    Courses.jsx
    components/
      CoursesHeader.jsx
      CoursesToolbar.jsx
      CoursesTable.jsx
      CourseMobileCard.jsx
      CourseFormModal.jsx
      DeleteClassModal.jsx
      CapacityIndicator.jsx
    hooks/
      useClasses.js
    utils/
      classCode.js
      capacity.js
```

This prevents one large component from becoming difficult to maintain.

------------------------------------------------------------------------

# 35. Recommended Implementation Phases

## Phase 1 --- Production Safety

Implement first:

``` text
1. Authentication
2. Authorization
3. Backend validation
4. Centralized errors
5. 404 handling
6. Duplicate conflict handling
7. Database constraints
8. Safe archive/delete
```

## Phase 2 --- Correct Data Model

Then:

``` text
9. Academic Year
10. Teacher relation
11. Enrollment
12. Class status
13. Section structure
```

## Phase 3 --- Academic Features

Then:

``` text
14. Subjects
15. Teacher-subject assignment
16. Timetable
17. Attendance integration
18. Exams/results integration
```

## Phase 4 --- Scale

Then:

``` text
19. Pagination
20. Server-side search
21. Filtering
22. Caching/data fetching
23. Bulk operations
```

## Phase 5 --- Governance

Finally:

``` text
24. Audit logs
25. Import/export
26. Advanced permissions
27. Reporting
28. Accessibility improvements
```

------------------------------------------------------------------------

# 36. What Should NOT Be Done

Do not simply add more fields to the existing `Class` table to solve
everything.

Avoid turning this into:

``` text
Class
  teacherName
  teacher2
  subject1
  subject2
  student1
  student2
  academicYear
  ...
```

That creates an unmaintainable database.

Use proper relational entities.

------------------------------------------------------------------------

# 37. Minimum Production-Ready Definition

Before calling the module production-ready, it should at minimum have:

### Security

-   Authentication
-   Role/permission checks
-   Protected mutation endpoints

### Data

-   Academic year
-   Proper teacher relationship
-   Enrollment
-   Class status
-   Database constraints

### Validation

-   Backend validation
-   Duplicate handling
-   Type validation
-   Capacity validation

### Safety

-   Archive instead of casual hard delete
-   Dependency checks
-   Transaction safety
-   Concurrency-safe enrollment

### API

-   Consistent errors
-   404 handling
-   409 conflicts
-   Pagination
-   Server-side search

### Governance

-   Audit logs

### Academic integration

-   Subjects
-   Teacher assignments
-   Attendance
-   Exams/results
-   Timetable

------------------------------------------------------------------------

# 38. Final Recommended Data Model

A strong long-term foundation could look conceptually like:

``` text
User
 |
 +--- Role
 |
 +--- Permission
 |
 +--- AuditLog


AcademicYear
 |
 +--- Program
       |
       +--- Class
             |
             +--- Section
             |
             +--- ClassTeacher
             |      |
             |      +--- Teacher
             |
             +--- ClassSubject
             |      |
             |      +--- Subject
             |
             +--- Enrollment
             |      |
             |      +--- Student
             |
             +--- TimetableEntry
             |
             +--- Attendance
             |
             +--- Exam
                    |
                    +--- Result
```

This architecture gives the Courses & Classes module a strong foundation
for the rest of the Madrasa Management System.

------------------------------------------------------------------------

# 39. Final Assessment

The current implementation should **not be discarded**.

It is a useful first version of the UI and basic CRUD layer.

The recommended strategy is:

``` text
Current Module
      |
      v
Harden API + Security
      |
      v
Fix Database Relationships
      |
      v
Add Academic Year + Enrollment
      |
      v
Add Subjects + Teachers
      |
      v
Integrate Attendance / Exams / Timetable
      |
      v
Add Audit + Reporting + Scale
      |
      v
Production-Ready Courses & Classes Module
```

The most important principle is:

> **Do not treat a class as just a row in a table. Treat it as an
> academic entity that exists within an academic year, contains
> sections, has teacher/subject assignments, has student enrollments,
> and generates historical records such as attendance and examination
> data.**
