# Courses & Classes Module --- Final Architecture Fixes Before Coding

## Purpose

This document replaces the earlier implementation-first approach.

The previous generated implementation documents contain useful ideas,
but they should **not yet be given to the IDE AI as final implementation
instructions** because the current design still contains conflicting
models and relationships.

The supplied newer documentation still contains examples such as:

``` prisma
teacher String?
```

alongside:

``` prisma
teachers ClassTeacher[]
```

and it still counts:

``` text
students
```

alongside:

``` text
enrollments
```

The newer implementation also makes `academicYearId` optional in one
version while the proposed `Enrollment` requires it. These are exactly
the kinds of inconsistencies that can produce runtime, Prisma, API, and
frontend mismatch errors. fileciteturn2file8 fileciteturn2file13

Therefore:

> **Do not implement the previous generated schema blindly. First
> establish one authoritative domain model based on the actual existing
> project schema.**

------------------------------------------------------------------------

# 1. Primary Goal

Transform the current:

``` text
Simple Class CRUD
```

into:

``` text
Production Academic Structure
```

without breaking existing:

-   Student data
-   Teacher/staff data
-   Attendance
-   Exams
-   Results
-   Users/authentication
-   Files/documents
-   Existing API conventions
-   Existing frontend conventions

The final implementation must have:

-   no duplicate models
-   no duplicate relationships
-   no conflicting field names
-   no `_id` / `id` mismatch
-   no `teacher` / `teacherId` ambiguity
-   no `students` / `enrollments` ambiguity
-   no optional/required relation conflict
-   no unsafe cascade deletion
-   no frontend/backend payload mismatch

------------------------------------------------------------------------

# 2. Current Problems That Must Be Fixed

## 2.1 Teacher duplication

The newer documentation still defines both:

``` prisma
teacher String?
```

and:

``` prisma
teachers ClassTeacher[]
```

This must not remain in the final architecture.

### Final rule

The class must have **one authoritative teacher-assignment system**.

Preferred:

``` text
Class
  |
  +--- ClassTeacher
          |
          +--- Teacher/Staff
```

Remove the legacy `Class.teacher` string after existing data has been
migrated.

Do not keep both systems permanently.

------------------------------------------------------------------------

# 3. Student Enrollment Must Be the Authoritative Source

The newer documentation has both:

``` text
Class.students
```

and:

``` text
Class.enrollments
```

This creates a potential source-of-truth conflict.

### Final rule

For an academic ERP:

``` text
Enrollment = authoritative student/class membership
```

The system should determine current class strength from:

``` text
Enrollment.status = ACTIVE
```

not from an unrelated direct `Student[]` relation.

### Target

``` text
Student
   |
   v
Enrollment
   |
   v
Class
   |
   v
AcademicYear
```

The final architecture should not maintain two independent ways of
deciding which class a student belongs to.

------------------------------------------------------------------------

# 4. Academic Year Must Be Required

The earlier robust implementation correctly proposed:

``` prisma
academicYearId String
```

but the newer "complete" document makes it optional:

``` prisma
academicYearId String?
```

That should be corrected.

### Final rule

Every academic class instance must belong to an academic year.

Target:

``` prisma
academicYearId String
```

with a required relation:

``` prisma
academicYear AcademicYear @relation(
  fields: [academicYearId],
  references: [id]
)
```

This prevents classes from existing without academic context.

------------------------------------------------------------------------

# 5. Academic Year

Before creating a new model, the IDE AI must inspect the existing
project.

If an `AcademicYear`, `Session`, or equivalent model already exists:

> Reuse it.

Do not create another academic-year table.

If no suitable model exists, the target can be:

``` prisma
model AcademicYear {
  id        String   @id @default(cuid())
  name      String   @unique
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)

  classes     Class[]
  enrollments Enrollment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isCurrent])
  @@map("academic_years")
}
```

------------------------------------------------------------------------

# 6. Program Must Be a Separate Concept

Do not use the `Class.name` field to represent every academic concept.

For example:

``` text
"Class 8"
"Hifz Year 1"
"Alim 2"
```

may represent different academic programs.

A stronger structure is:

``` text
Program
   |
   v
Class
   |
   v
Section
```

Potential model:

``` prisma
model Program {
  id          String  @id @default(cuid())
  name        String
  code        String  @unique
  description String?
  isActive    Boolean @default(true)

  classes Class[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
  @@map("programs")
}
```

### Important

Do not add this model if an equivalent program/course model already
exists.

------------------------------------------------------------------------

# 7. Class Must Represent an Academic Class Instance

Recommended conceptual model:

``` text
Class
 ├── id
 ├── name
 ├── code
 ├── capacity
 ├── status
 ├── academicYearId
 ├── programId
 ├── createdAt
 ├── updatedAt
 └── archivedAt
```

The exact fields must be reconciled against the existing Prisma schema.

------------------------------------------------------------------------

# 8. Section Should Be Decided Carefully

The current design uses:

``` prisma
section String?
```

This is acceptable if sections are only labels:

``` text
A
B
Boys
Girls
Morning
Evening
```

However, if sections have independent:

-   capacity
-   teachers
-   rooms
-   timetables
-   statuses

then Section should become a real entity.

### Recommended decision

Use:

``` text
Class
  |
  +--- Section
```

only if the business requirements require section-level management.

Do not create a Section table simply for normalization.

------------------------------------------------------------------------

# 9. Teacher / Staff Must Reuse Existing Identity

Do not blindly create:

``` prisma
model Teacher
```

The previous generated documentation invented a Teacher model, but the
actual project may already have:

``` text
Staff
Teacher
Employee
User
StaffProfile
```

The IDE AI must inspect the real schema first. fileciteturn2file11

### Final rule

There must be one authoritative staff/person identity.

Then:

``` text
ClassTeacher
   |
   +--- existing Teacher/Staff entity
```

------------------------------------------------------------------------

# 10. Teacher Assignment

Preferred model:

``` prisma
model ClassTeacher {
  id        String   @id @default(cuid())
  classId   String
  teacherId String
  role      String?
  startDate DateTime?
  endDate   DateTime?

  class   Class   @relation(
    fields: [classId],
    references: [id]
  )

  teacher Teacher @relation(
    fields: [teacherId],
    references: [id]
  )

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([classId, teacherId])
  @@index([classId])
  @@index([teacherId])
}
```

But replace `Teacher` with the project's actual staff/teacher model.

------------------------------------------------------------------------

# 11. Teacher + Subject Assignment Needs More Thought

A class-level teacher assignment alone is insufficient.

Example:

``` text
Class 8A

Quran       → Ustadh Ahmed
Arabic      → Ustadh Yusuf
Fiqh        → Ustadh Bilal
Mathematics → Mr. Ali
```

Therefore the final architecture should support:

``` text
Class
   |
   +--- ClassSubject
           |
           +--- Subject
           |
           +--- Teacher Assignment
```

Possible model:

``` prisma
model ClassSubject {
  id             String @id @default(cuid())
  classId        String
  subjectId      String
  teacherId      String?
  periodsPerWeek Int?

  class   Class   @relation(...)
  subject Subject @relation(...)
  teacher Teacher? @relation(...)

  @@unique([classId, subjectId])
}
```

If multiple teachers can teach the same subject, use a separate:

``` text
ClassSubjectTeacher
```

instead.

The correct choice depends on actual madrasa requirements.

------------------------------------------------------------------------

# 12. Enrollment Model

Enrollment should contain historical membership information.

Target:

``` prisma
enum EnrollmentStatus {
  ACTIVE
  TRANSFERRED
  WITHDRAWN
  COMPLETED
}

model Enrollment {
  id             String           @id @default(cuid())
  studentId      String
  classId        String
  academicYearId String

  enrollmentDate DateTime         @default(now())
  exitDate       DateTime?
  rollNumber     String?
  status         EnrollmentStatus @default(ACTIVE)

  student      Student      @relation(...)
  class        Class        @relation(...)
  academicYear AcademicYear @relation(...)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([studentId])
  @@index([classId])
  @@index([academicYearId])
  @@index([classId, status])
}
```

### Important

The exact relation definitions must match the existing Student model.

------------------------------------------------------------------------

# 13. Enrollment Uniqueness Must Be Defined

Do not blindly add:

``` prisma
@@unique([studentId, academicYearId])
```

without checking business requirements.

If a student is allowed to have multiple concurrent enrollment records
in special programs, that constraint may be too restrictive.

The system should first define:

### Standard case

One active primary enrollment per student per academic year.

### Possible special case

A student may participate in:

``` text
Regular Class
+
Hifz Program
```

simultaneously.

If that is required, use a program/class-type distinction rather than an
overly restrictive unique constraint.

------------------------------------------------------------------------

# 14. Student → Class Relationship

Final source of truth:

``` text
Student
   |
   v
Enrollment
   |
   v
Class
```

Avoid using both:

``` text
Student.classId
```

and:

``` text
Enrollment.classId
```

as independent sources of truth.

If the existing Student model already contains a class relation, it must
be carefully migrated.

------------------------------------------------------------------------

# 15. Capacity Must Use Active Enrollments

The newer implementation counts:

``` javascript
_count.students
```

while also having:

``` text
enrollments
```

This must be fixed.

### Final rule

Capacity calculation should be based on:

``` text
Enrollment.status = ACTIVE
```

Conceptually:

``` javascript
const studentCount = await prisma.enrollment.count({
  where: {
    classId,
    status: 'ACTIVE'
  }
});
```

This makes:

``` text
Student Count
Capacity
Enrollment
```

consistent.

------------------------------------------------------------------------

# 16. Capacity States

Use:

``` text
NORMAL
NEAR_CAPACITY
FULL
OVER_CAPACITY
```

Example:

``` text
32 / 40 → 80% → NEAR_CAPACITY
40 / 40 → 100% → FULL
45 / 40 → 112% → OVER_CAPACITY
```

The progress-bar width may be capped at 100%, but the displayed
percentage must not be capped.

------------------------------------------------------------------------

# 17. Enrollment Capacity Enforcement

When adding an enrollment:

``` text
1. Verify class exists.
2. Verify class is ACTIVE.
3. Verify academic year matches.
4. Count ACTIVE enrollments.
5. Compare with capacity.
6. Reject if full unless authorized override is permitted.
7. Create enrollment.
```

This operation must be designed for concurrency.

The IDE AI must first identify the actual database provider before
implementing database-specific locking.

------------------------------------------------------------------------

# 18. Class Status / Lifecycle

Use:

``` text
DRAFT
ACTIVE
CLOSED
ARCHIVED
```

Lifecycle:

``` text
DRAFT
  ↓
ACTIVE
  ↓
CLOSED
  ↓
ARCHIVED
```

Do not use hard deletion as the normal lifecycle operation.

------------------------------------------------------------------------

# 19. Delete Strategy

The newer generated implementation says:

> archive if dependencies exist, permanently delete if empty.

This is better than unrestricted deletion, but it is still not the
preferred default for an ERP. fileciteturn2file13

### Final rule

Normal UI action:

``` text
Archive
```

Permanent deletion:

``` text
Restricted administrator operation
+
dependency checks
+
audit record
+
explicit confirmation
```

Historical academic data should normally remain.

------------------------------------------------------------------------

# 20. Avoid Dangerous Cascade Deletes

The newer schema uses:

``` prisma
onDelete: Cascade
```

on important academic relationships. fileciteturn2file11

This should be reviewed carefully.

For historical ERP records, avoid cascading deletion from:

``` text
Student → Enrollment
Class → Enrollment
Class → Attendance
Class → Exam
Teacher → Assignment
```

unless deletion is explicitly proven safe.

### Preferred approach

Use restrictive deletion:

``` text
RESTRICT
```

or the Prisma/database equivalent supported by the actual provider.

Then archive records rather than deleting parents.

------------------------------------------------------------------------

# 21. Attendance Relationship

Attendance should be connected to the authoritative academic context.

At minimum:

``` text
Attendance
 ├── studentId
 ├── classId / enrollmentId
 ├── date
 └── status
```

The exact design should be reconciled with the existing Attendance
model.

### Preferred conceptual relationship

``` text
Enrollment
   |
   v
Attendance
```

because attendance belongs to the student's enrollment context.

Do not create a second conflicting attendance system.

------------------------------------------------------------------------

# 22. Exam / Result Relationship

Likewise:

``` text
Class
  |
  +--- Exam
          |
          +--- ExamSubject
          |
          +--- Result
```

The exact structure must reuse the existing Exam/Result models.

Do not invent a second Result model if one already exists.

------------------------------------------------------------------------

# 23. Timetable

Target concept:

``` text
Class
Subject
Teacher
Day
Period
Room
```

Potential model:

``` prisma
model TimetableEntry {
  id        String @id @default(cuid())
  classId   String
  subjectId String
  teacherId String
  dayOfWeek Int
  startTime DateTime
  endTime   DateTime
  roomId    String?

  ...
}
```

But this is **not final code** until the existing timetable/room models
are inspected.

------------------------------------------------------------------------

# 24. Files / Documents --- Missing Area

The previous implementation did not properly design file relationships.

This must be included before final implementation.

Potential document architecture:

``` text
File
 |
 +--- FileAttachment
          |
          +--- Student
          +--- Teacher/Staff
          +--- Class
          +--- User
```

Example:

``` text
Student
  ├── Profile Photo
  ├── Birth Certificate
  ├── ID Document
  └── Admission Document

Teacher
  ├── Profile Photo
  ├── ID Document
  ├── Qualification Certificate
  └── Employment Document
```

------------------------------------------------------------------------

# 25. File Model --- Do Not Implement Until Existing Storage Is Inspected

If the project already has a file/upload/document model, reuse it.

If not, a generic model may look like:

``` prisma
model File {
  id           String   @id @default(cuid())
  fileName     String
  storageKey   String
  mimeType     String
  size         Int
  uploadedById String
  createdAt    DateTime @default(now())

  @@index([uploadedById])
}
```

Then:

``` prisma
model FileAttachment {
  id           String @id @default(cuid())
  fileId       String
  entityType   String
  entityId     String
  documentType String?

  file File @relation(
    fields: [fileId],
    references: [id]
  )

  @@index([entityType, entityId])
  @@index([fileId])
}
```

### Important warning

A generic `entityType/entityId` attachment model sacrifices
database-level foreign-key integrity.

If the project requires strict relational integrity, use dedicated
attachment relations instead:

``` text
StudentDocument
TeacherDocument
ClassDocument
```

The correct approach depends on the existing file-storage architecture.

------------------------------------------------------------------------

# 26. File Storage Security

The file system should also define:

``` text
Who can upload?
Who can view?
Who can download?
Who can delete?
```

Documents such as identity documents should not be exposed through
public URLs without authorization.

The final implementation must inspect the project's existing storage
provider and access-control system.

------------------------------------------------------------------------

# 27. Audit Log

Audit logs must identify:

``` text
who
what
which record
before
after
when
```

Concept:

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

But `userId` must connect to the actual existing User model.

------------------------------------------------------------------------

# 28. Audit Logging Must Not Be Silently Ignored

The newer generated code contains:

``` javascript
try {
  await req.prisma.auditLog.create(...)
} catch (e) {
  console.warn('Audit log write skipped')
}
```

This is not appropriate if audit history is required.
fileciteturn2file13

For critical operations:

``` text
Database change
+
Audit record
```

should be part of the same transaction where possible.

If the audit record cannot be written, the operation should normally
fail rather than silently claim success.

------------------------------------------------------------------------

# 29. Authentication / Authorization

Before adding permissions, inspect the existing authentication
architecture.

Do not create a second:

``` text
User
Role
Permission
```

system.

Final class permissions should conceptually include:

``` text
classes.view
classes.create
classes.update
classes.archive
classes.delete
classes.manageTeachers
classes.manageSubjects
classes.manageEnrollments
```

Use the existing project's actual permission system.

------------------------------------------------------------------------

# 30. API Design

Final API should be consistent.

Core:

``` text
GET    /api/classes
POST   /api/classes
GET    /api/classes/:id
PUT    /api/classes/:id
PATCH  /api/classes/:id/status
```

Enrollment:

``` text
GET    /api/classes/:id/enrollments
POST   /api/classes/:id/enrollments
PATCH  /api/classes/:id/enrollments/:enrollmentId
```

Teachers:

``` text
GET    /api/classes/:id/teachers
POST   /api/classes/:id/teachers
DELETE /api/classes/:id/teachers/:teacherId
```

Subjects:

``` text
GET    /api/classes/:id/subjects
POST   /api/classes/:id/subjects
DELETE /api/classes/:id/subjects/:subjectId
```

Files:

``` text
GET    /api/classes/:id/documents
POST   /api/classes/:id/documents
DELETE /api/classes/:id/documents/:documentId
```

Only create endpoints that fit the existing API conventions.

------------------------------------------------------------------------

# 31. API Contract Must Be Written Before Frontend Coding

Class create/update payload:

``` json
{
  "name": "Class 8",
  "section": "A",
  "code": "CLS-08-A",
  "capacity": 40,
  "academicYearId": "academic_year_id",
  "programId": "program_id"
}
```

The final payload must match the actual final Prisma model.

Do not allow:

``` text
teacher
teacherName
teacherId
assignedTeacherId
```

to represent the same concept.

------------------------------------------------------------------------

# 32. Frontend Must Match API

The newer documentation has a mismatch where backend supports:

``` text
academicYearId
```

but the frontend form still uses:

``` text
name
section
code
teacher
capacity
```

This must be corrected before implementation. fileciteturn2file15

Final form state should exactly mirror the class API contract.

Example:

``` javascript
const initialFormState = {
  name: '',
  section: '',
  code: '',
  capacity: 40,
  academicYearId: '',
  programId: ''
};
```

Teacher assignment should be handled through its own relationship UI
rather than a plain text `teacher` field.

------------------------------------------------------------------------

# 33. Pagination

Use:

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
    "total": 100,
    "totalPages": 4
  }
}
```

Frontend must actually implement:

``` text
page
limit
totalPages
```

not just receive pagination metadata.

------------------------------------------------------------------------

# 34. Search and Filters

Server-side filters:

``` text
search
status
academicYearId
programId
section
teacherId
```

The backend should query the database.

The frontend should not download every class and then perform all
filtering locally.

------------------------------------------------------------------------

# 35. Data Source Consistency

The final module must have one source of truth for each concept.

  Concept              Source of Truth
  -------------------- -------------------------------
  Student membership   Enrollment
  Class teacher        ClassTeacher
  Subject assignment   ClassSubject
  Academic context     AcademicYear
  Class lifecycle      Class.status
  Files                Existing File/Document system
  User identity        Existing User/Auth system
  Audit history        AuditLog
  Capacity             Class.capacity
  Current strength     Active Enrollment count

This table should be treated as an architectural contract.

------------------------------------------------------------------------

# 36. No Duplicate Concepts

Do not have:

``` text
Class.teacher
+
ClassTeacher
```

Do not have:

``` text
Student.classId
+
Enrollment.classId
```

as independent authoritative fields.

Do not have:

``` text
Teacher
+
Staff
```

representing the same employee unless there is a clear domain
distinction.

Do not have:

``` text
File
+
Document
+
Upload
```

for the same storage concept without a clear reason.

------------------------------------------------------------------------

# 37. Migration Strategy

Never replace the current schema in one destructive operation.

Required process:

``` text
1. Inspect current schema
2. Inspect production/current data
3. Create compatibility plan
4. Add new fields/models
5. Backfill data
6. Verify relationships
7. Update API
8. Update frontend
9. Remove legacy fields only after verification
```

For teacher migration:

``` text
Old:
Class.teacher = "Ahmed Khan"

New:
ClassTeacher
  classId = ...
  teacherId = ...
```

Do not delete `Class.teacher` until migration is verified.

------------------------------------------------------------------------

# 38. IDE AI Must Inspect Before Coding

The IDE AI must first report:

``` text
Existing models:
Existing relations:
Existing IDs:
Existing authentication:
Existing file storage:
Existing Student model:
Existing Teacher/Staff model:
Existing AcademicYear model:
Existing Attendance model:
Existing Exam model:
Existing Result model:
Existing API conventions:
```

Then it must produce:

``` text
RELATIONSHIP COMPATIBILITY REPORT
```

before modifying any file.

------------------------------------------------------------------------

# 39. IDE AI Must NOT Invent Models

Rules:

``` text
IF Teacher exists:
    reuse it

IF Staff represents teachers:
    use Staff

IF AcademicYear exists:
    reuse it

IF Session represents academic year:
    reuse Session

IF File/Document system exists:
    reuse it

IF User exists:
    connect AuditLog to it

IF Enrollment exists:
    extend/reuse it

IF Subject exists:
    reuse it
```

No duplicate model creation.

------------------------------------------------------------------------

# 40. Canonical Naming Contract

Use these names unless the existing project already has an established
name that must be preserved:

``` text
classId
academicYearId
programId
sectionId
studentId
teacherId
subjectId
enrollmentId
documentId
fileId
userId
```

Class fields:

``` text
id
name
code
capacity
status
academicYearId
programId
createdAt
updatedAt
archivedAt
```

Enrollment fields:

``` text
id
studentId
classId
academicYearId
enrollmentDate
exitDate
rollNumber
status
```

Never randomly introduce:

``` text
classID
class_id
courseId
teacherID
teacherName
studentTotal
maxStudents
```

------------------------------------------------------------------------

# 41. Required Verification After Every Phase

After schema changes:

``` bash
npx prisma format
npx prisma validate
npx prisma generate
```

After backend changes:

``` text
Run backend tests
```

After frontend changes:

``` bash
npm run lint
npm run build
```

If the project uses different scripts, use its actual scripts.

------------------------------------------------------------------------

# 42. Repository-Wide Mismatch Search

After migration, search the entire repository for old concepts:

``` text
teacher:
teacherName
teacherID
_id
courseId
classID
studentCount
students
```

This is not to blindly replace every occurrence.

Each occurrence must be reviewed.

For example:

``` text
Student.students
```

may be unrelated.

------------------------------------------------------------------------

# 43. Testing Requirements

## Database

``` text
[ ] Prisma validates
[ ] migration succeeds
[ ] existing records remain intact
[ ] relations resolve correctly
[ ] no duplicate models
```

## Class

``` text
[ ] create
[ ] update
[ ] archive
[ ] restore
[ ] restricted delete
[ ] duplicate code
[ ] invalid capacity
[ ] missing academic year
```

## Enrollment

``` text
[ ] enroll
[ ] transfer
[ ] withdraw
[ ] complete
[ ] capacity limit
[ ] duplicate enrollment handling
```

## Teacher

``` text
[ ] assign
[ ] unassign
[ ] multiple teachers
[ ] role assignment
[ ] historical assignment
```

## Subjects

``` text
[ ] assign subject
[ ] remove subject
[ ] prevent duplicate assignment
[ ] assign teacher to subject where required
```

## Files

``` text
[ ] upload
[ ] retrieve
[ ] permission check
[ ] delete
[ ] metadata validation
[ ] storage failure handling
```

## Audit

``` text
[ ] create logged
[ ] update logged
[ ] archive logged
[ ] enrollment changes logged
[ ] teacher changes logged
[ ] subject changes logged
```

------------------------------------------------------------------------

# 44. Final Target Architecture

The target should be:

``` text
                         User
                          |
                    Roles / Permissions
                          |
                       AuditLog
                          |
          ┌───────────────┴────────────────┐
          |                                |
       Student                         Teacher/Staff
          |                                |
          |                                |
          v                                v
     Enrollment                     ClassTeacher
          |                                |
          └──────────────┬─────────────────┘
                         |
                         v
                  AcademicYear
                         |
                         v
                      Program
                         |
                         v
                       Class
                         |
            ┌────────────┼────────────┐
            |            |            |
            v            v            v
         Section    ClassSubject   Timetable
                         |
                         v
                      Subject
                         |
                         v
                 Attendance / Exam
                         |
                         v
                       Result


Student / Teacher / Class / User
             |
             v
      File / Document System
```

This is a **target architecture**, not permission to create every model
immediately.

Existing project models must be reused wherever equivalent models
already exist.

------------------------------------------------------------------------

# 45. Implementation Order

Do NOT implement everything at once.

## Phase 0 --- Discovery

``` text
Inspect actual Prisma schema
Inspect existing relations
Inspect auth
Inspect file storage
Inspect API architecture
```

## Phase 1 --- Domain Model

``` text
AcademicYear
Program
Class
Section decision
Teacher/Staff relationship
Enrollment
Subject
```

## Phase 2 --- Data Integrity

``` text
Constraints
Indexes
Safe deletion
Status lifecycle
Migration/backfill
```

## Phase 3 --- Backend

``` text
Validation
Class CRUD
Enrollment APIs
Teacher APIs
Subject APIs
Document APIs
Audit logging
Permissions
```

## Phase 4 --- Frontend

``` text
Class list
Filters
Pagination
Add/Edit
Teacher assignment
Subject assignment
Enrollment
Archive/restore
Documents
```

## Phase 5 --- Integration

``` text
Attendance
Exam
Result
Timetable
```

## Phase 6 --- Verification

``` text
Prisma validation
Backend tests
Frontend lint
Frontend build
Repository mismatch search
Migration verification
```

------------------------------------------------------------------------

# 46. Final IDE AI Prompt

Use this prompt only after providing the IDE AI with this document:

``` text
You are modifying an existing Madrasa Management System.

DO NOT IMPLEMENT ANYTHING YET.

First inspect the entire existing project.

Inspect:
1. Prisma schema
2. Student model
3. Teacher/Staff model
4. User/authentication model
5. AcademicYear/Session model
6. Program/Course model
7. Section model
8. Subject model
9. Enrollment model
10. Attendance model
11. Exam model
12. Result model
13. File/Document/Upload system
14. Authentication middleware
15. Authorization middleware
16. API client
17. Existing Courses/Class code
18. All references to Class

Produce a compatibility report before modifying code.

The compatibility report must identify:
- existing model names
- existing primary keys
- existing foreign keys
- existing relation names
- existing API routes
- existing request/response formats
- existing authentication mechanism
- existing authorization mechanism
- existing file storage
- existing naming conventions

CRITICAL RULES:

1. Never create a duplicate model.
2. Never create a duplicate relationship.
3. Reuse existing Student, Teacher/Staff, User, File, AcademicYear, Subject, Attendance, Exam and Result models where applicable.
4. Do not assume a Teacher model exists.
5. Do not assume a File model exists.
6. Do not assume AcademicYear exists.
7. Do not assume Student.classId should remain.
8. Do not maintain two sources of truth for student enrollment.
9. Do not maintain both Class.teacher and ClassTeacher as authoritative systems.
10. Do not use cascade deletion for historical academic data without proving it is safe.
11. Do not make academicYearId optional if Class is an academic-year-bound entity.
12. Do not implement code until the relationship map is approved.
13. Keep API parameter names synchronized with Prisma field names.
14. Do not mix id and _id.
15. Do not mix teacher, teacherName and teacherId.
16. Do not mix classId, classID and courseId.
17. Do not silently modify unrelated modules.
18. Do not delete existing data.
19. Do not remove legacy fields until migration/backfill has been verified.
20. After every phase, run validation/build/tests.

The final target is:

AcademicYear
  -> Program
    -> Class
      -> Section
      -> Enrollment -> Student
      -> ClassTeacher -> existing Teacher/Staff
      -> ClassSubject -> Subject
      -> Timetable
      -> Attendance
      -> Exam
      -> Result

Files/Documents must be integrated with the existing file-storage architecture.

AuditLog must connect to the existing authenticated User model.

Enrollment must become the authoritative source for active class membership.

Capacity must be calculated from ACTIVE enrollments.

Normal class deletion must be replaced by archive.

Permanent deletion must be restricted and dependency-safe.

Do not implement the target architecture blindly.
Adapt it to the actual existing project schema.

After discovery, show the proposed final relationship diagram and exact Prisma changes.

STOP and wait for approval before making schema changes.
```

------------------------------------------------------------------------

# 47. Definition of Done

The architecture is ready for implementation only when:

``` text
[ ] Existing schema inspected
[ ] Existing Student relation understood
[ ] Existing Teacher/Staff relation understood
[ ] Existing User/auth understood
[ ] Existing File system understood
[ ] Existing AcademicYear/Session understood
[ ] Existing Subject understood
[ ] Existing Attendance understood
[ ] Existing Exam/Result understood

[ ] One authoritative Class model
[ ] One authoritative Enrollment model
[ ] One authoritative Teacher/Staff identity
[ ] One authoritative Subject model
[ ] One authoritative File/Document system
[ ] Academic year is correctly enforced
[ ] Student membership source of truth defined
[ ] Teacher assignment source of truth defined
[ ] No unsafe cascade deletion
[ ] Archive strategy defined
[ ] Audit strategy defined
[ ] API contracts defined
[ ] Frontend contracts defined
[ ] Migration strategy defined
[ ] Tests defined
```

------------------------------------------------------------------------

# 48. Final Rule

The previous documents should now be treated as **reference material,
not final implementation code**.

The correct next step is:

``` text
ACTUAL PROJECT SCHEMA
        ↓
DISCOVERY / COMPATIBILITY REPORT
        ↓
FINAL RELATIONSHIP DESIGN
        ↓
FINAL PRISMA SCHEMA
        ↓
MIGRATION PLAN
        ↓
BACKEND
        ↓
FRONTEND
        ↓
TESTING
```

Do not skip the discovery step.

The goal is not to produce the largest possible schema.

The goal is to produce the **smallest correct schema that fits the
existing Madrasa Management System without duplicate models, conflicting
relationships, destructive cascades, or API/frontend mismatches.**
