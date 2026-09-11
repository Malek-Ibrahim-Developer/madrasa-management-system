# Courses & Classes Module --- Critical Corrections and Robust Fix Plan

## Purpose

This document is a corrective specification for the uploaded:

`courses_module_final_architecture_documentation.md`

The uploaded document presents itself as a final architecture and
complete source-code implementation, but detailed review shows multiple
contradictions between its stated architecture, Prisma schema, migration
script, backend API, and React frontend.

This document does **not** assume the generated implementation is
correct.

Its purpose is to:

1.  identify each concrete problem,
2.  explain why it is dangerous,
3.  define the correct target behavior,
4.  provide implementation rules for the IDE AI,
5.  prevent the IDE AI from repeating the same architectural mistakes.

The uploaded document itself must be treated as the source being
corrected. fileciteturn3file0

------------------------------------------------------------------------

# 1. Critical Rule: Do Not Implement This Document Blindly

The IDE AI must NOT immediately copy the Prisma schema or source code
from the previous document.

Before changing anything, it must inspect the actual project.

Required inspection:

``` text
server/prisma/schema.prisma

Existing Student model
Existing Teacher/Staff model
Existing User model
Existing AcademicYear/Session model
Existing Subject model
Existing File/Document/Upload model
Existing Attendance model
Existing Exam model
Existing Result model
Existing Class/Course model
Existing authentication
Existing authorization
Existing API conventions
Existing frontend API service
Existing frontend Courses/Class page
```

### Mandatory behavior

The IDE AI must first produce:

``` text
EXISTING SCHEMA REPORT
RELATIONSHIP REPORT
DUPLICATE MODEL REPORT
MIGRATION RISK REPORT
API CONTRACT REPORT
```

Then STOP.

It must not modify the schema until the existing architecture is
understood.

------------------------------------------------------------------------

# 2. Issue: Enrollment Is Claimed as the Source of Truth but `Student[]` Is Still Used

## Current problem

The uploaded document says:

> Student strength and capacity limits are determined by active
> Enrollment records.

But the schema still contains:

``` prisma
students Student[]
enrollments Enrollment[]
```

The API then counts:

``` javascript
_count: {
  select: {
    students: true,
    enrollments: true
  }
}
```

and uses:

``` javascript
studentCount: cls._count.students
```

This creates two possible sources of truth.

Source: uploaded final documentation. fileciteturn3file0

## Fix

For the academic-management domain:

``` text
Enrollment = authoritative class membership
```

The current student count must be calculated from:

``` text
Enrollment.status = ACTIVE
```

Example:

``` javascript
const activeEnrollmentCount = await prisma.enrollment.count({
  where: {
    classId: cls.id,
    status: 'ACTIVE',
  },
});
```

If Prisma supports relation counts with filtered relations in the
project's version, use the appropriate filtered relation count.
Otherwise use a dedicated count query.

### Do not use

``` javascript
_count.students
```

as the authoritative capacity count.

------------------------------------------------------------------------

# 3. Issue: Do Not Keep `Class.students` as a Second Source of Truth

The current schema has:

``` prisma
students Student[]
```

while Enrollment also represents:

``` text
Student → Class
```

## Fix

The IDE AI must inspect the existing Student model.

If the existing Student model has:

``` prisma
classId
```

then migration must be performed before removing or deprecating that
relationship.

Target:

``` text
Student
   |
   v
Enrollment
   |
   v
Class
```

The final architecture must have exactly one authoritative mechanism for
current academic class membership.

### Migration rule

Do not delete an existing `Student.classId` field immediately.

Use:

``` text
existing field
    ↓
backfill Enrollment
    ↓
verify counts
    ↓
verify sample students
    ↓
switch application logic
    ↓
only then remove/deprecate legacy field
```

------------------------------------------------------------------------

# 4. Issue: Teacher Has Two Representations

Current schema:

``` prisma
teacher String?
teachers ClassTeacher[]
```

The uploaded document says `ClassTeacher` is authoritative, but the API
and frontend continue using the legacy string. fileciteturn3file0

## Why this is dangerous

This can produce:

``` text
Class.teacher = "Ahmed"
ClassTeacher = Yusuf
```

The application cannot reliably know which teacher is correct.

## Fix

The final system must use:

``` text
ClassTeacher
```

as the authoritative assignment relationship.

Remove the legacy `Class.teacher` field from the final architecture.

### Migration

Existing data:

``` text
Class.teacher = "Ahmed"
```

must be converted to:

``` text
Teacher
  id = ...
  name = "Ahmed"

ClassTeacher
  classId = ...
  teacherId = ...
  role = "Main Teacher"
```

Then:

``` text
verify
↓
switch API
↓
switch frontend
↓
remove legacy teacher field
```

Do not keep two authoritative representations.

------------------------------------------------------------------------

# 5. Issue: Teacher Must Reuse Existing Staff/Teacher Identity

The uploaded document creates:

``` prisma
model Teacher
```

without first proving that the real project does not already have:

``` text
Staff
Employee
Teacher
User
StaffProfile
```

Source: uploaded document. fileciteturn3file0

## Fix

The IDE AI must inspect the actual schema.

Decision rules:

``` text
IF Teacher already exists:
    reuse Teacher

ELSE IF Staff represents teaching employees:
    reuse Staff

ELSE IF Employee represents staff:
    use Employee + role/type

ELSE:
    create Teacher only after approval
```

Do not create duplicate identity models.

------------------------------------------------------------------------

# 6. Issue: Academic Year Is Required in Prisma but Optional in API

Schema:

``` prisma
academicYearId String
```

but the validator allows:

``` javascript
academicYearId || null
```

and the POST route automatically creates or selects a default year.

Source: uploaded document. fileciteturn3file0

## Fix

If Class is an academic-year-bound entity:

``` text
academicYearId is required
```

The API must require it.

Validator:

``` javascript
if (!academicYearId) {
  errors.academicYearId = 'Academic year is required';
}
```

Do not silently invent:

``` text
2025-2026
```

inside the class API.

The academic year must be selected by the caller or resolved by an
explicit application-level rule.

### Better API behavior

``` text
POST /classes

{
  "name": "Class 8",
  "academicYearId": "..."
}
```

If the UI wants to default to the current academic year, the UI can
select the current year explicitly.

The backend should still validate the ID.

------------------------------------------------------------------------

# 7. Issue: Hard-Coded Academic Year Is Dangerous

The previous code creates:

``` javascript
name: '2025-2026'
```

inside migration/API logic.

That is not a reusable production design.

## Fix

Migration scripts may use an explicitly configured migration target, but
application API code must not silently create a hard-coded academic
year.

For migration:

``` text
MIGRATION_ACADEMIC_YEAR_ID
```

or a clearly documented migration configuration may be used.

For production API:

``` text
academicYearId must be supplied/resolved from existing application state.
```

------------------------------------------------------------------------

# 8. Issue: Cascade Deletes Can Destroy Historical Data

The uploaded schema contains several:

``` prisma
onDelete: Cascade
```

relationships, including:

``` text
ClassTeacher
ClassSubject
Enrollment
```

and connections to Class, Student, Teacher, AcademicYear.

Source: uploaded document. fileciteturn3file0

## Fix

Historical academic records should not be destroyed because a parent
entity is deleted.

Review each relation individually.

Preferred strategy:

``` text
Class → Enrollment
RESTRICT / NO ACTION
```

``` text
Student → Enrollment
RESTRICT / NO ACTION
```

``` text
AcademicYear → Enrollment
RESTRICT / NO ACTION
```

``` text
Class → Attendance
RESTRICT / NO ACTION
```

``` text
Class → Exam
RESTRICT / NO ACTION
```

Exact Prisma syntax must match the project's actual database provider.

### Important

Do not blindly replace every cascade.

Each relation must be classified:

``` text
Ownership relation
Historical relation
Dependent configuration
Audit relation
```

Then choose the appropriate delete behavior.

------------------------------------------------------------------------

# 9. Issue: Archive Must Be the Normal Lifecycle

The current document already has:

``` text
ARCHIVED
```

but still provides permanent deletion.

Source: uploaded document. fileciteturn3file0

## Fix

Normal UI action:

``` text
Archive
Restore
```

Permanent deletion:

``` text
Restricted admin-only operation
+
dependency verification
+
explicit confirmation
+
audit log
```

The default delete button should not silently decide between physical
deletion and archive.

Better:

``` text
Archive Class
```

and a separate restricted:

``` text
Permanently Delete
```

if the business permits it.

------------------------------------------------------------------------

# 10. Issue: AuditLog Does Not Actually Relate to User

The schema has:

``` prisma
userId String?
```

but does not define a Prisma relation to User.

The architecture diagram nevertheless presents:

``` text
User → AuditLog
```

Source: uploaded document. fileciteturn3file0

## Fix

Inspect the real User model.

If the system has:

``` prisma
model User
```

then create the proper relation.

Concept:

``` prisma
userId String
user   User @relation(
  fields: [userId],
  references: [id]
)
```

Whether `userId` should be nullable depends on the project's
authentication requirements.

For authenticated administrative mutations:

``` text
userId should normally be required.
```

For system jobs:

``` text
actorType = SYSTEM
```

or another explicit mechanism may be used.

Do not silently leave the audit actor disconnected.

------------------------------------------------------------------------

# 11. Issue: Audit Logging Is Silently Ignored

Current code does:

``` javascript
try {
  await prisma.auditLog.create(...)
} catch (e) {
  console.warn('Audit log skipped')
}
```

Source: uploaded document. fileciteturn3file0

## Why this is dangerous

The API can report:

``` text
Class created successfully
```

while the audit record was never written.

## Fix

For critical mutations:

``` text
business mutation
+
audit mutation
```

should execute in the same database transaction where practical.

Concept:

``` javascript
await prisma.$transaction(async (tx) => {
  const created = await tx.class.create(...);

  await tx.auditLog.create({
    data: {
      ...
    },
  });

  return created;
});
```

If audit is mandatory and the audit write fails:

``` text
rollback the operation
```

Do not silently continue.

------------------------------------------------------------------------

# 12. Issue: Audit Actor Is Missing in Actual API Calls

The POST/PUT examples create AuditLog records without a user actor.

Example:

``` javascript
data: {
  action: 'CREATE',
  entity: 'Class',
  entityId: newClass.id,
  newValue: newClass,
}
```

Source: uploaded document. fileciteturn3file0

## Fix

The route must obtain the authenticated user from the existing auth
middleware.

Example concept:

``` javascript
const userId = req.user.id;
```

Then:

``` javascript
userId,
```

must be recorded.

The exact auth property must be discovered from the real project.

Never invent:

`text req.user.id`

if the existing middleware uses another property.

------------------------------------------------------------------------

# 13. Issue: ClassSubject Does Not Assign Teachers

Current:

``` prisma
ClassSubject {
  classId
  subjectId
  periodsPerWeek
}
```

This can represent:

``` text
Class 8 → Quran
```

but not:

``` text
Class 8 → Quran → Teacher Ahmed
```

Source: uploaded document. fileciteturn3file0

## Fix

Inspect the actual subject/teacher requirements.

If one teacher per class-subject:

``` text
ClassSubject
  classId
  subjectId
  teacherId
```

If multiple teachers per subject:

``` text
ClassSubject
   |
   v
ClassSubjectTeacher
```

Example:

``` text
ClassSubject
  |
  +-- Class 8
  +-- Quran
  |
  +-- ClassSubjectTeacher
          |
          +-- Teacher Ahmed
          +-- Teacher Yusuf
```

Do not assume one or multiple teachers until the domain requirement is
confirmed.

------------------------------------------------------------------------

# 14. Issue: Migration Script Assumes Existing Fields

The migration assumes:

``` javascript
student.classId
```

exists.

It also assumes the project can create a new:

``` text
Teacher
```

model.

Source: uploaded document. fileciteturn3file0

## Fix

Migration must be generated from the real current schema.

Required process:

``` text
Inspect actual schema
        ↓
Detect legacy field
        ↓
Generate migration
        ↓
Dry-run / staging
        ↓
Verify
        ↓
Production
```

Never write migration code against an assumed Student model.

------------------------------------------------------------------------

# 15. Issue: Migration Is Not Transaction-Safe

The migration loops through records and performs individual operations.

If it fails halfway:

``` text
some classes migrated
some teachers created
some enrollments created
rest not migrated
```

## Fix

Use a controlled migration strategy.

For smaller datasets:

``` javascript
await prisma.$transaction(async (tx) => {
  ...
});
```

For large datasets:

``` text
batched migration
+
checkpointing
+
idempotency
+
resume capability
+
verification
```

The migration must be safe to run again.

------------------------------------------------------------------------

# 16. Issue: Migration Must Be Idempotent

Running the migration twice must not produce:

``` text
duplicate teachers
duplicate enrollments
duplicate class assignments
```

## Fix

Use stable lookup keys and explicit uniqueness.

For example:

``` text
Teacher identity
Enrollment identity
ClassTeacher identity
```

must have a deterministic matching strategy.

Do not identify teachers only by:

``` text
name
```

if the real system contains duplicate names.

------------------------------------------------------------------------

# 17. Issue: Teacher Matching by Name Is Unsafe

Current migration:

``` javascript
where: { name: teacherName }
```

This can merge two different people:

``` text
Ahmed Khan
Ahmed Khan
```

or fail to distinguish:

``` text
Mohammed Ali
Muhammad Ali
```

## Fix

Use the existing staff/teacher identifier where available.

If only legacy names exist:

``` text
create migration candidates
+
do not silently merge ambiguous people
+
produce a review report
```

Example:

``` text
AMBIGUOUS TEACHER:
"Ahmed Khan"
Possible matches:
- Teacher ID 12
- Teacher ID 47
```

Require manual resolution.

------------------------------------------------------------------------

# 18. Issue: API Search Still Uses Legacy Teacher String

Current search:

``` javascript
{ teacher: { contains: normalizedSearch } }
```

Source: uploaded document. fileciteturn3file0

## Fix

Once `ClassTeacher` becomes authoritative, teacher search should
traverse the actual relation.

Concept:

``` javascript
teachers: {
  some: {
    teacher: {
      name: {
        contains: normalizedSearch,
        mode: 'insensitive'
      }
    }
  }
}
```

Exact Prisma syntax must match the actual existing teacher relation.

------------------------------------------------------------------------

# 19. Issue: Frontend Still Uses `teacher` String

Current form:

``` javascript
teacher: ''
```

and:

``` jsx
<input name="teacher" />
```

Source: uploaded document. fileciteturn3file0

## Fix

Teacher assignment must use a real teacher ID.

Concept:

``` javascript
teacherId: ''
```

or, for multiple teachers:

``` javascript
teacherIds: []
```

The UI should provide a teacher selector based on actual staff records.

Do not allow free-text teacher names to define relational assignments.

------------------------------------------------------------------------

# 20. Issue: Frontend Does Not Include Academic Year

The backend model requires:

`text academicYearId`

but the form state does not contain it.

Source: uploaded document. fileciteturn3file0

## Fix

Form:

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

If Program does not exist in the actual system, do not add `programId`
yet.

The frontend payload must exactly match the final backend contract.

------------------------------------------------------------------------

# 21. Issue: API and Frontend Response Handling Is Ambiguous

The frontend does:

``` javascript
const classList = Array.isArray(response)
  ? response
  : (response?.data || []);
```

This suggests uncertainty about the API response shape.

## Fix

Define one response contract.

Example:

``` json
{
  "success": true,
  "data": [],
  "pagination": {}
}
```

Frontend must consume exactly that contract.

Do not support multiple undocumented response formats unless backward
compatibility is intentionally required.

------------------------------------------------------------------------

# 22. Issue: Pagination Exists in Backend but Is Not Properly Used in Frontend

Backend provides:

``` text
page
limit
total
totalPages
```

but the React component does not maintain page state.

Source: uploaded document. fileciteturn3file0

## Fix

Frontend state:

``` javascript
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(25);
const [pagination, setPagination] = useState({
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1
});
```

Request:

``` javascript
getClasses({
  search: searchTerm,
  status: statusFilter,
  page,
  limit,
});
```

Then render pagination controls.

------------------------------------------------------------------------

# 23. Issue: Capacity Uses Wrong Count

Current UI uses:

``` javascript
cls.studentCount
```

but backend derives it from:

`text students`

not active enrollments.

Source: uploaded document. fileciteturn3file0

## Fix

Backend should return:

``` json
{
  "activeEnrollmentCount": 32,
  "capacity": 40
}
```

Frontend should display:

``` text
32 / 40
```

Do not use ambiguous:

`text studentCount`

if it is actually active enrollment count.

Better canonical field:

`text activeEnrollmentCount`

------------------------------------------------------------------------

# 24. Issue: Capacity Enforcement Is Missing

Displaying capacity is not the same as enforcing it.

## Fix

Enrollment creation must check:

``` text
activeEnrollmentCount < class.capacity
```

unless the system has an explicit authorized override.

The check must happen on the backend.

Never trust frontend capacity checks.

------------------------------------------------------------------------

# 25. Issue: Race Conditions Around Capacity

Two users could simultaneously enroll students:

``` text
Student A → sees 39/40
Student B → sees 39/40
both enroll
→ 41/40
```

## Fix

Use a database transaction and provider-appropriate concurrency control.

The IDE AI must inspect the actual database provider and implement a
safe strategy rather than pretending a simple count query is atomic.

------------------------------------------------------------------------

# 26. Issue: Files/Documents Are Missing

The uploaded final document contains no proper file/document
relationship design.

Source: uploaded document. fileciteturn3file0

## Fix

First inspect the existing project for:

``` text
File
Document
Upload
Media
Attachment
Storage
```

Then integrate with the existing system.

Potential target:

``` text
Student
   |
   +--- StudentDocument

Teacher/Staff
   |
   +--- StaffDocument

Class
   |
   +--- ClassDocument
```

or a generic attachment model if the existing architecture already uses
one.

Do not create a generic polymorphic file system without understanding
the existing storage/security architecture.

------------------------------------------------------------------------

# 27. File Security Requirements

Documents may include sensitive institutional records.

The final file architecture must define:

``` text
upload permission
view permission
download permission
delete permission
ownership
storage key
mime type
file size
created by
created at
```

Do not expose private documents through public URLs without
authorization.

------------------------------------------------------------------------

# 28. Issue: No Clear Program/Academic Structure

The current Class model uses:

``` text
name
section
```

and examples such as:

``` text
Class 8
Hifz Year 1
```

Source: uploaded document. fileciteturn3file0

## Fix

Before introducing `Program`, inspect the actual madrasa domain.

Possible target:

``` text
Program
   ↓
Class
   ↓
Section
```

But:

> Do not create Program simply because it looks architecturally cleaner.

Create it only if the real system needs to distinguish programs such as:

``` text
Hifz
Alim
Nazra
General Studies
```

If the existing system already has a similar concept, reuse it.

------------------------------------------------------------------------

# 29. Issue: Section Is Only a String

Current:

``` prisma
section String?
```

This may be sufficient.

Do not automatically normalize it.

## Decision rule

Keep:

``` text
section String
```

if it is merely a label.

Create:

``` text
Section
```

entity only if sections require independent:

``` text
capacity
teacher
room
timetable
status
```

------------------------------------------------------------------------

# 30. Issue: Exam and Attendance Relations Are Assumed

The Class model includes:

``` prisma
exams Exam[]
attendances Attendance[]
```

but this document does not establish whether those existing models are
compatible with the proposed architecture.

Source: uploaded document. fileciteturn3file0

## Fix

Inspect the actual models.

Do not modify Attendance/Exam relationships until their current design
is understood.

The final class architecture must integrate with existing records
without breaking historical data.

------------------------------------------------------------------------

# 31. Issue: Class Lifecycle Is Under-Specified

Current enum:

``` text
DRAFT
ACTIVE
CLOSED
ARCHIVED
```

is reasonable, but transition rules are missing.

## Fix

Define valid transitions:

``` text
DRAFT → ACTIVE
ACTIVE → CLOSED
ACTIVE → ARCHIVED
CLOSED → ARCHIVED
ARCHIVED → ACTIVE
```

If business requirements permit other transitions, explicitly document
them.

Prevent invalid transitions such as:

``` text
ARCHIVED → DRAFT
```

unless intentionally supported.

------------------------------------------------------------------------

# 32. Issue: Permanent Delete Must Check All Dependencies

The current delete route checks a selected set of counts.

Source: uploaded document. fileciteturn3file0

## Fix

Do not maintain a fragile manually updated dependency list as the only
safety mechanism.

Use:

``` text
database referential integrity
+
archive-first policy
+
explicit dependency checks
```

The final design should make accidental physical deletion structurally
difficult.

------------------------------------------------------------------------

# 33. Issue: No Explicit Transaction Around Multi-Entity Class Creation

Creating a class and then syncing teacher can result in:

``` text
Class created
Teacher sync fails
ClassTeacher missing
```

because the sync is wrapped in a swallowed try/catch.

Source: uploaded document. fileciteturn3file0

## Fix

If teacher assignment is part of class creation:

``` text
Class
+
ClassTeacher
+
AuditLog
```

should be performed transactionally.

If teacher assignment is intentionally separate:

``` text
Create Class
↓
Assign Teacher
```

then the API should make that explicit.

Do not pretend it is atomic while silently skipping part of it.

------------------------------------------------------------------------

# 34. Issue: Error Handling Hides Important Failures

The current code uses warnings such as:

``` javascript
console.warn('ClassTeacher sync skipped')
```

Source: uploaded document. fileciteturn3file0

## Fix

Errors must be classified:

``` text
Expected validation error
Expected conflict
Database integrity error
External storage error
Unexpected programming error
```

Critical relationship failures must reach the error handler and normally
fail the transaction.

------------------------------------------------------------------------

# 35. Issue: Validation Does Not Match the Database Contract

Validator currently returns:

``` javascript
academicYearId: academicYearId || null
```

while Prisma requires it.

Source: uploaded document. fileciteturn3file0

## Fix

Validation should mirror the actual database/API contract exactly.

For every required Prisma/API field:

``` text
required in frontend
required in backend validator
required in service
required in database
```

No layer should disagree.

------------------------------------------------------------------------

# 36. Canonical Naming Contract

The final implementation must establish one naming contract.

Use:

``` text
classId
academicYearId
programId
sectionId
studentId
teacherId
subjectId
enrollmentId
fileId
documentId
userId
```

Avoid:

``` text
classID
teacherID
studentID
courseId
teacherName
```

unless an existing project convention requires a different name.

The IDE AI must not rename fields casually.

------------------------------------------------------------------------

# 37. API Contract

Final class create request should conceptually be:

``` json
{
  "name": "Class 8",
  "section": "A",
  "code": "CLS-08-A",
  "capacity": 40,
  "academicYearId": "..."
}
```

Teacher assignment should be separate:

``` http
POST /classes/:classId/teachers
```

with:

``` json
{
  "teacherId": "...",
  "role": "MAIN"
}
```

Subject assignment should be separate:

``` http
POST /classes/:classId/subjects
```

with:

``` json
{
  "subjectId": "...",
  "periodsPerWeek": 5
}
```

Exact routes must be adapted to existing project conventions.

------------------------------------------------------------------------

# 38. Recommended API Structure

## Classes

``` text
GET    /api/classes
POST   /api/classes
GET    /api/classes/:id
PUT    /api/classes/:id
PATCH  /api/classes/:id/status
```

## Enrollment

``` text
GET    /api/classes/:id/enrollments
POST   /api/classes/:id/enrollments
PATCH  /api/classes/:id/enrollments/:enrollmentId
```

## Teachers

``` text
GET    /api/classes/:id/teachers
POST   /api/classes/:id/teachers
DELETE /api/classes/:id/teachers/:teacherId
```

## Subjects

``` text
GET    /api/classes/:id/subjects
POST   /api/classes/:id/subjects
DELETE /api/classes/:id/subjects/:subjectId
```

## Documents

``` text
GET    /api/classes/:id/documents
POST   /api/classes/:id/documents
DELETE /api/classes/:id/documents/:documentId
```

These endpoints are architectural recommendations, not permission to
create duplicate APIs.

------------------------------------------------------------------------

# 39. Final Relationship Rules

The final system must have:

``` text
AcademicYear
   |
   v
Class
   |
   +---- Enrollment ----> Student
   |
   +---- ClassTeacher --> Existing Teacher/Staff
   |
   +---- ClassSubject --> Subject
   |
   +---- Attendance
   |
   +---- Exam
   |
   +---- Result
   |
   +---- Documents
```

And:

``` text
User
 |
 +---- AuditLog
```

The exact relation names and model names must come from the real
project.

------------------------------------------------------------------------

# 40. Migration Safety Checklist

Before production migration:

``` text
[ ] Database backup exists
[ ] Current schema captured
[ ] Current row counts captured
[ ] Current class count captured
[ ] Current student count captured
[ ] Current teacher/staff count captured
[ ] Existing class/student relationships exported
[ ] Legacy teacher strings exported
[ ] Existing files/documents preserved
[ ] Migration tested on staging
[ ] Migration is idempotent
[ ] Migration can be resumed
[ ] Post-migration counts verified
[ ] Sample records verified
[ ] Old API tested
[ ] New API tested
[ ] Rollback strategy documented
```

------------------------------------------------------------------------

# 41. Verification Matrix

## Database

``` text
[ ] prisma validate passes
[ ] prisma generate passes
[ ] migration succeeds
[ ] no duplicate models
[ ] no orphan foreign keys
[ ] no destructive cascades
```

## Backend

``` text
[ ] create class
[ ] update class
[ ] archive class
[ ] restore class
[ ] assign teacher
[ ] assign subject
[ ] enroll student
[ ] transfer student
[ ] withdraw student
[ ] capacity enforcement
[ ] audit logging
[ ] authorization
```

## Frontend

``` text
[ ] academic year selector
[ ] teacher selector
[ ] class creation
[ ] class editing
[ ] teacher assignment
[ ] subject assignment
[ ] enrollment count
[ ] pagination
[ ] search
[ ] filters
[ ] archive
[ ] restore
[ ] errors
```

------------------------------------------------------------------------

# 42. IDE AI Anti-Mistake Rules

The following rules are mandatory.

### Rule 1

Never trust the previous generated document as proof that a model
exists.

### Rule 2

Never create a model before searching the repository for an equivalent
model.

### Rule 3

Never create a relationship before inspecting both sides.

### Rule 4

Never change a Prisma field without finding every code reference to it.

### Rule 5

Never use a legacy string field as a relational source of truth.

### Rule 6

Never count two different relationships as if they represented the same
thing.

### Rule 7

Never use `onDelete: Cascade` for historical academic data without
explicit approval.

### Rule 8

Never swallow relationship or audit failures.

### Rule 9

Never hard-code an academic year inside normal application CRUD.

### Rule 10

Never write a migration against an assumed schema.

### Rule 11

Never remove a legacy field before backfill and verification.

### Rule 12

Never implement frontend and backend independently.

The API contract must be finalized first.

------------------------------------------------------------------------

# 43. Required IDE AI Workflow

The IDE AI must follow this exact order.

## Step 1 --- Inspect

``` text
Read actual schema.prisma.
```

## Step 2 --- Search

Search the repository for:

``` text
model Student
model Teacher
model Staff
model User
model AcademicYear
model Session
model Subject
model Enrollment
model Attendance
model Exam
model Result
model File
model Document
```

## Step 3 --- Map

Create:

``` text
CURRENT RELATIONSHIP MAP
```

## Step 4 --- Detect

Create:

``` text
DUPLICATE / CONFLICT REPORT
```

## Step 5 --- Propose

Create:

``` text
TARGET RELATIONSHIP MAP
```

## Step 6 --- Stop

Do not modify code yet.

Wait for approval.

## Step 7 --- Schema

Only after approval:

``` text
Prisma changes
Migration
Backfill
Verification
```

## Step 8 --- Backend

Implement:

``` text
Services
Validation
Transactions
Routes
Authorization
Audit
```

## Step 9 --- Frontend

Implement:

``` text
API service
State
Forms
Selectors
Pagination
Relations
```

## Step 10 --- Test

Run:

``` text
Prisma validation
Backend tests
Frontend lint
Frontend build
Integration tests
```

------------------------------------------------------------------------

# 44. Mandatory First Prompt for the IDE AI

Use the following prompt before allowing it to change any code:

``` text
DO NOT MODIFY ANY FILE YET.

You are working on an existing Madrasa Management System.

The previous AI-generated Courses & Classes documentation contains architectural contradictions and must NOT be treated as authoritative code.

First inspect the real repository.

You MUST inspect:

- server/prisma/schema.prisma
- Student model
- Teacher model
- Staff model
- User model
- AcademicYear/Session model
- Subject model
- Enrollment model
- Attendance model
- Exam model
- Result model
- File/Document/Upload model
- existing Class/Course model
- authentication middleware
- authorization middleware
- existing class APIs
- existing frontend API service
- existing Courses/Class page

Then produce FOUR reports:

1. CURRENT DATABASE RELATIONSHIP MAP
2. DUPLICATE/CONFLICT REPORT
3. MIGRATION RISK REPORT
4. TARGET RELATIONSHIP PROPOSAL

Specifically check for:

- Class.teacher vs ClassTeacher
- Student.classId vs Enrollment
- Student[] vs Enrollment[]
- Teacher vs Staff vs User
- AcademicYear vs Session
- File vs Document vs Upload
- Subject assignment
- Attendance relation
- Exam relation
- Result relation
- AuditLog → User
- dangerous cascade deletes
- hard-coded academic years
- legacy fields
- API/frontend naming mismatches

DO NOT CREATE:
- a new Teacher model
- a new Student model
- a new User model
- a new File model
- a new AcademicYear model
- a new Subject model
- a new Enrollment model

unless you have first proven that the project does not already contain an equivalent.

For every proposed new model, explicitly state:
- why it is needed
- what existing model was checked
- why reuse is not possible

For every proposed relation, explicitly state:
- parent model
- child model
- foreign key
- cardinality
- delete behavior
- why the relation is necessary

For every legacy field that should be removed, explicitly state:
- current usage count
- repository references
- migration strategy
- verification strategy
- removal condition

DO NOT implement anything until this report is complete and approved.
```

------------------------------------------------------------------------

# 45. Definition of Done

This module is not considered robust until:

``` text
[ ] Actual schema inspected
[ ] Actual Student model inspected
[ ] Actual Teacher/Staff model inspected
[ ] Actual User model inspected
[ ] Actual File system inspected
[ ] Actual AcademicYear/Session inspected
[ ] Actual Subject inspected
[ ] Actual Attendance inspected
[ ] Actual Exam inspected
[ ] Actual Result inspected

[ ] Enrollment is authoritative
[ ] Teacher assignment is relational
[ ] No duplicate teacher source
[ ] No duplicate enrollment source
[ ] AcademicYear contract is consistent
[ ] No unsafe historical cascades
[ ] AuditLog has a real actor relation
[ ] Audit failures are handled correctly
[ ] File relationships are defined
[ ] Subject-teacher assignment is defined
[ ] Capacity is based on active enrollments
[ ] Capacity is concurrency-safe
[ ] Migration is idempotent
[ ] Migration is verified
[ ] API contract is fixed
[ ] Frontend matches API
[ ] Permissions are enforced
[ ] Tests pass
```

------------------------------------------------------------------------

# 46. Final Principle

The problem is not that the previous AI-generated document has no good
ideas.

The problem is that it presents **partially correct ideas as a fully
verified final implementation**.

The correct engineering approach is:

``` text
Never trust generated architecture blindly.

Inspect.
Compare.
Map.
Find contradictions.
Verify existing relations.
Design the target.
Migrate safely.
Then code.
```

The IDE AI should be treated as an implementation assistant, not as the
authority on the existing application's architecture.

The real repository is the authority. The actual database schema is the
authority. Existing production data is the authority.

This document is the correction layer that forces the implementation
process to respect those facts.
