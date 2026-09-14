# ALTUS KAIROS — Student Module Robustness, Simplification & Customization Fix Plan

## Purpose

This document defines the next corrective phase for the **Student module** in the latest `madrasa-management-system-main(4).zip`.

The objective is NOT to rewrite the Student module.

The objective is to make the existing Student module:

- reliable
- faster
- simpler
- dynamically customizable
- transactionally safe
- historically correct
- easier to maintain
- ready to serve as the architectural reference for the future Teacher module

---

# 1. Product Direction

The intended Altus Kairos philosophy is:

> **Small, stable core data model + institution-defined custom data + dynamic UI.**

The system should not require code changes every time a madrasa/school wants to store another student attribute.

Examples of institution-specific information:

- Blood Group
- Mother Tongue
- Previous School
- Medical Notes
- Hifz Level
- Aadhaar / other ID
- Family-specific information
- Institution-specific admission information

These should generally be handled by the existing **Custom Fields system**, unless an attribute is genuinely required by the ERP's core business logic.

---

# 2. Current Assessment

The Student module already has substantial functionality:

- Student CRUD
- Search
- Filters
- Sorting
- Server-side pagination
- Import/export
- Student profile
- Enrollment integration
- Transfer/withdrawal logic
- Institution/tenant scoping
- Custom fields
- Transactions
- Audit logging
- Capacity checks

However, the current implementation is not yet aligned with the desired product architecture.

Main problems:

1. `Save Changes` can fail in the edit workflow.
2. Student form contains too many hardcoded fields.
3. Custom fields exist but are being used as an addition rather than the primary customization mechanism.
4. Guardian information is implemented as multiple flat Student columns.
5. Blood group and several other attributes are hardcoded.
6. Custom-field persistence happens outside the main student transaction.
7. Student update sends a large payload even when only one field changes.
8. `classId` semantics are not represented cleanly by the frontend.
9. There is no database-level partial unique constraint enforcing one ACTIVE enrollment per student/year.
10. Student list loading performs multiple independent requests.
11. Custom field updates can create many individual database operations.
12. Some existing frontend code contains signs of avoidable complexity/regression risk.

---

# 3. Scope

## P0 — Must fix now

### Reliability

- Fix and diagnose Student `Save Changes`.
- Validate request body.
- Make class assignment/removal semantics explicit.
- Make custom-field save part of the same transaction.
- Preserve existing data when a field is intentionally omitted.
- Improve API error visibility.

### Form simplification

Reduce the default Student form to a small set of core fields.

### Data integrity

Add database-level protection for:

```text
one ACTIVE enrollment
per student
per academic year
```

### Performance

Remove unnecessary duplicate work and optimize custom-field persistence.

---

# 4. P1 — Recommended

- Improve Guardian/Parent data architecture.
- Make custom-field engine more generic for future entities.
- Improve Student list loading.
- Add focused backend and frontend tests.
- Add consistent error codes to the Student update flow.

---

# 5. P2 — Future

Do not implement during this fix:

- Fees
- Exams
- Accounts
- Salary
- Library
- Hostel
- Kitchen
- Teacher UI

The Student architecture must be stabilized first.

---

# 6. Current Student Form Problem

Current `DEFAULT_FORM` contains:

```js
const DEFAULT_FORM = {
  admissionNo: '',
  firstName: '',
  lastName: '',
  fatherName: '',
  motherName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: 'MALE',
  address: '',
  classId: '',
  status: 'ACTIVE',

  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianRelation: '',

  bloodGroup: '',
  nationality: 'Indian',
  idNumber: '',
  previousSchool: '',
  emergencyContact: '',
  medicalNotes: '',
};
```

This is too large for the default Add Student workflow.

It also duplicates the purpose of:

```text
CustomField
CustomFieldValue
```

---

# 7. New Core Student Form

The default Student form should contain only fields that are fundamental to Student identity and current ERP operation.

Recommended:

```js
const DEFAULT_FORM = {
  admissionNo: '',
  firstName: '',
  lastName: '',
  fatherName: '',
  motherName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: 'MALE',
  address: '',
  classId: '',
  status: 'ACTIVE',
  admissionDate: '',
};
```

This keeps the core workflow focused.

---

# 8. Fields to Remove From Default Student Form

Remove these from the default Student Add/Edit UI:

```text
Blood Group
Nationality
ID Number
Previous School
Medical Notes
Emergency Contact
```

They should be created as Custom Fields when the institution needs them.

Example:

```text
Settings
  ↓
Custom Fields
  ↓
Add "Blood Group"
  ↓
Field Type = SELECT
  ↓
Options = A+, A-, B+, B-, O+, O-, AB+, AB-
```

The Student form will automatically render it under Custom Fields.

---

# 9. Guardian / Parent Direction

Do NOT simply delete all guardian functionality without replacing the operational need.

Current model has:

```text
guardianName
guardianPhone
guardianEmail
guardianRelation
emergencyContact
```

This is a flat structure.

The long-term architecture should preferably become:

```text
Student
   │
   └── Contacts / Guardians
          │
          ├── Father
          ├── Mother
          ├── Guardian
          └── Emergency Contact
```

However, a full `StudentContact` / `Guardian` relational model should be a separately approved architectural change.

## Immediate fix

For this phase:

- Keep only the minimum parent information required by the current workflow.
- Do not add more guardian fields.
- Do not create a second complex contact system inside this fix.
- Move institution-specific guardian attributes to Custom Fields where appropriate.

The exact relational Guardian model should be designed before implementation if the institution needs multiple guardians or shared parent records.

---

# 10. Recommended Student Form UX

Instead of:

```text
Basic
Guardian
Additional
Custom Fields
```

use:

```text
Student Information
```

with:

```text
Admission No *
First Name *
Last Name *
Father's Name
Mother's Name
Date of Birth
Gender
Phone
Email
Address
Class
Status
Admission Date
```

Then:

```text
Custom Fields
```

below it or in a separate tab.

If a custom field is required by the institution, it should be visually marked:

```text
Blood Group *
```

without requiring the core Student code to know what "Blood Group" means.

---

# 11. Custom Field Architecture

Current schema:

```prisma
model CustomField {
  id            String    @id @default(cuid())
  institutionId String
  name          String
  fieldKey      String
  fieldType     FieldType
  options       String?
  placeholder   String?
  isRequired    Boolean   @default(false)
  isActive      Boolean   @default(true)
  sortOrder     Int       @default(0)
  section       String    @default("custom")
}
```

and:

```prisma
model CustomFieldValue {
  id            String @id @default(cuid())
  value         String

  customFieldId String
  studentId     String

  @@unique([customFieldId, studentId])
}
```

This is a good foundation.

---

# 12. Important Limitation in Current Custom Field System

Current `CustomFieldValue` is explicitly Student-specific:

```prisma
studentId String
student Student @relation(...)
```

That means the current engine is not yet a universal customization engine.

For the future, it should evolve toward something like:

```text
CustomField
  institutionId
  entityType
  fieldKey
  fieldType
  options
  required
  active
  sortOrder
  section
```

Possible:

```text
entityType =
  STUDENT
  TEACHER
  STAFF
  CLASS
```

But:

> Do not introduce this generalized schema during the immediate Student reliability fix unless required.

First stabilize the current Student implementation.

Then generalize it before building Teacher.

---

# 13. Fix: Custom Fields Must Be Transactional

## Current problem

The Student update does:

```js
await req.prisma.$transaction(async (tx) => {
  // student + enrollment changes
});

if (customFields && typeof customFields === 'object') {
  await saveCustomFieldValues(
    req.prisma,
    req.institutionId,
    req.params.id,
    customFields
  );
}
```

This means:

```text
Student update = committed
Custom field update = fails
```

can produce:

```text
PARTIAL UPDATE
```

That violates the desired robustness standard.

---

# 14. Required Transaction Structure

The Student update should perform:

```text
BEGIN TRANSACTION
    │
    ├── Validate student
    ├── Validate admission number
    ├── Validate class/enrollment change
    ├── Update enrollment
    ├── Update Student
    ├── Validate custom field definitions
    ├── Save custom field values
    └── Audit
COMMIT
```

If anything fails:

```text
ROLLBACK
```

---

# 15. Replace Custom Field Helper

Current helper:

```js
async function saveCustomFieldValues(prisma, institutionId, studentId, customFields)
```

should be changed to accept the transaction client:

```js
async function saveCustomFieldValues(
  tx,
  institutionId,
  studentId,
  customFields
) {
  const fieldDefs = await tx.customField.findMany({
    where: {
      institutionId,
      isActive: true,
    },
    select: {
      id: true,
      fieldKey: true,
      isRequired: true,
      fieldType: true,
    },
  });

  const keyToDefinition = new Map(
    fieldDefs.map((field) => [field.fieldKey, field])
  );

  const operations = [];

  for (const [key, value] of Object.entries(customFields)) {
    const definition = keyToDefinition.get(key);

    // Unknown custom fields must never be written.
    if (!definition) continue;

    if (value === '' || value === null || value === undefined) {
      operations.push(
        tx.customFieldValue.deleteMany({
          where: {
            customFieldId: definition.id,
            studentId,
          },
        })
      );
      continue;
    }

    operations.push(
      tx.customFieldValue.upsert({
        where: {
          customFieldId_studentId: {
            customFieldId: definition.id,
            studentId,
          },
        },
        create: {
          customFieldId: definition.id,
          studentId,
          value: String(value),
        },
        update: {
          value: String(value),
        },
      })
    );
  }

  if (operations.length > 0) {
    await Promise.all(operations);
  }
}
```

Then call it INSIDE the existing transaction:

```js
await req.prisma.$transaction(async (tx) => {
  // enrollment logic

  await tx.student.update({
    where: {
      id: req.params.id,
    },
    data: studentData,
  });

  if (customFields && typeof customFields === 'object') {
    await saveCustomFieldValues(
      tx,
      req.institutionId,
      req.params.id,
      customFields
    );
  }
});
```

## Important

Do not create a nested:

```js
prisma.$transaction(...)
```

inside the outer transaction.

Use the supplied `tx`.

---

# 16. Required Custom Field Validation

The backend must reject invalid custom field data instead of silently accepting malformed data.

Validate:

### Field belongs to institution

```text
customField.institutionId === req.institutionId
```

### Field is active

```text
isActive === true
```

### Field type

Validate:

```text
TEXT
NUMBER
DATE
SELECT
CHECKBOX
TEXTAREA
```

### SELECT

Submitted value must exist in configured options.

### NUMBER

Submitted value must parse as a valid number.

### DATE

Submitted value must be a valid date.

### CHECKBOX

Accept only the expected boolean representation.

---

# 17. Required Custom Fields

Current `CustomField` already contains:

```prisma
isRequired Boolean @default(false)
```

The Student save flow must actually enforce it.

Example:

```text
Custom Field:
Blood Group
Required:
true
```

Then Student creation/update should fail if no valid value exists.

Error:

```json
{
  "success": false,
  "message": "Blood Group is required",
  "code": "CUSTOM_FIELD_REQUIRED"
}
```

Do not rely only on frontend validation.

---

# 18. Save Changes Failure — First Fix the Payload Contract

Current frontend does:

```js
const payload = {
  ...form,
  customFields: customFieldValues
};
```

The biggest issue is that:

```js
classId
```

uses:

```text
''
```

for no class.

But backend semantics are:

```text
undefined = do not change
null      = explicitly remove class
classId   = assign/transfer
```

These semantics must be preserved.

---

# 19. Fix Frontend Class Payload

Before submitting:

```js
const payload = {
  ...form,
  classId:
    form.classId === ''
      ? null
      : form.classId,
  customFields: customFieldValues,
};
```

However, this should only be used if the form intentionally represents the complete current class selection.

For edit mode, an even safer implementation is:

```js
const payload = {
  ...form,
  classId:
    form.classId === editingStudent?.classId
      ? undefined
      : form.classId === ''
        ? null
        : form.classId,
  customFields: customFieldValues,
};
```

This means:

```text
unchanged class → undefined
remove class → null
new class → class ID
```

This matches the backend contract.

---

# 20. Backend Explicit Request Validation

At the top of POST/PUT:

```js
if (
  !req.body ||
  typeof req.body !== 'object' ||
  Array.isArray(req.body)
) {
  throw new AppError(
    'Request body must be a valid JSON object',
    400,
    'INVALID_REQUEST_BODY'
  );
}
```

This prevents obscure runtime errors.

---

# 21. Improve Save Error Contract

Current frontend catches:

```js
catch (err) {
  toast.error(err.message || 'Operation failed');
}
```

Keep this simple, but backend errors should include stable codes.

Recommended:

```json
{
  "success": false,
  "message": "Student with admission number \"ST-001\" already exists",
  "code": "DUPLICATE_ADMISSION_NO"
}
```

Possible Student update codes:

```text
INVALID_REQUEST_BODY
VALIDATION_ERROR
STUDENT_NOT_FOUND
DUPLICATE_ADMISSION_NO
CLASS_NOT_FOUND
INVALID_TARGET_CLASS
CLASS_CAPACITY_EXCEEDED
ACADEMIC_YEAR_NOT_FOUND
MULTIPLE_ACTIVE_ENROLLMENTS
ACTIVE_ENROLLMENT_CONFLICT
CUSTOM_FIELD_REQUIRED
INVALID_CUSTOM_FIELD_VALUE
CONCURRENT_ENROLLMENT_CONFLICT
```

---

# 22. Do Not Hide the Actual Save Error

During development, add:

```js
catch (err) {
  console.error('Student save failed:', err);
  toast.error(err.message || 'Operation failed');
}
```

Backend logging should include:

```text
PUT /api/students/:id
status
error code
error message
```

Do NOT log sensitive student information unnecessarily.

Do not log:

- passwords
- complete personal documents
- unnecessary medical information

---

# 23. Student Update Should Be Atomic

The desired implementation:

```js
await req.prisma.$transaction(async (tx) => {

  // 1. Resolve academic year only if class operation is requested

  // 2. Validate/lock target class if required

  // 3. Transition old enrollment if required

  // 4. Create new enrollment if required

  // 5. Update Student core fields

  // 6. Save custom fields

  // 7. Record audit event

});
```

No student update should be committed while its custom fields are still pending.

---

# 24. Database Integrity — ACTIVE Enrollment

Current schema:

```prisma
model Enrollment {
  ...

  @@index([studentId])
  @@index([classId])
  @@index([academicYearId])
  @@index([classId, status])
}
```

Application code already detects duplicates.

But database-level enforcement is missing.

---

# 25. Required Partial Unique Index

Because only ACTIVE rows must be unique, add:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_enrollment_per_year"
ON "enrollments" ("studentId", "academicYearId")
WHERE "status" = 'ACTIVE';
```

This guarantees:

```text
Student A + Academic Year 2026 + ACTIVE
```

cannot exist twice.

Historical rows such as:

```text
TRANSFERRED
WITHDRAWN
COMPLETED
```

remain allowed.

---

# 26. Important Database Instruction

Do NOT add runtime DDL such as:

```js
prisma.$executeRawUnsafe(`
  CREATE UNIQUE INDEX ...
`);
```

inside:

```text
server/index.js
```

or request handlers.

The index is a database schema operation.

Apply it once through the approved database/schema deployment workflow.

After applying:

```bash
npx prisma db push
```

may be used for the normal Prisma schema synchronization workflow, but the partial PostgreSQL index itself must be verified separately because Prisma schema syntax does not directly express this partial unique constraint in the current model.

---

# 27. Enrollment Error Handling

The application already has:

```js
if (
  error.code === 'P2002' &&
  error.meta?.target?.includes('enrollments')
) {
  return next(
    new AppError(
      'Concurrent enrollment conflict: Student already has an active enrollment in this academic year',
      409,
      'CONCURRENT_ENROLLMENT_CONFLICT'
    )
  );
}
```

Keep this behavior.

After the partial unique index is added, it becomes an actual database-backed guarantee.

---

# 28. Student `classId` Remains Compatibility Data

Do not turn:

```text
Student.classId
```

back into the authoritative enrollment relationship.

Authoritative relationship:

```text
Enrollment
```

Therefore:

```text
Student.classId
```

must remain synchronized compatibility data.

Business decisions must use:

```text
Enrollment
```

not merely:

```text
Student.classId
```

---

# 29. Student Status and Enrollment

Do not allow arbitrary status changes to silently corrupt enrollment.

Example:

```text
Student status = INACTIVE
Active Enrollment = still ACTIVE
```

is potentially inconsistent.

The implementation must define and enforce the intended behavior.

For now:

- `WITHDRAWN` should use the withdrawal flow.
- Transfer should use enrollment transfer logic.
- Normal profile edits should not silently rewrite historical enrollment.
- Status changes that affect active membership should be validated.

Do not solve this by simply deleting enrollments.

---

# 30. Performance — Current Student Page

Current `Students.jsx` performs:

```js
useEffect(() => { fetchStudents(); }, [fetchStudents]);

useEffect(() => {
  fetchClasses();
  fetchCustomFields();
}, [fetchClasses, fetchCustomFields]);
```

This means initial page loading requires multiple requests:

```text
GET /students
GET /classes
GET /custom-fields
```

These are independent, so they can run concurrently, which is good.

Do not combine them into a huge endpoint merely for theoretical optimization.

Instead:

- keep requests parallel
- avoid repeated requests
- cache stable reference data where appropriate

---

# 31. Custom Fields Should Not Be Refetched Unnecessarily

Custom fields change much less frequently than student list data.

Potential future improvement:

```text
InstitutionContext / CustomFieldContext
```

could cache field definitions.

But this is P1.

For the immediate fix:

- do not refetch custom fields after every student save
- fetch once when opening/initializing the module
- refresh only after Custom Fields Manager changes the definitions

---

# 32. Student List Backend Performance

The standard Student query includes active enrollments.

This is reasonable.

However, verify that:

```text
institutionId
status
academicYear
studentId
classId
```

have useful indexes.

Current schema already has:

```prisma
@@index([institutionId, status])
```

on Student.

Enrollment has:

```prisma
@@index([studentId])
@@index([classId])
@@index([academicYearId])
@@index([classId, status])
```

The partial active enrollment index will also improve the critical integrity lookup.

---

# 33. Do Not Optimize by Removing Integrity Checks

Bad optimization:

```text
Remove enrollment verification
```

or:

```text
Stop tenant filtering
```

or:

```text
Remove transaction
```

or:

```text
Return Student.classId without checking Enrollment
```

These are unacceptable.

Performance improvements must preserve correctness.

---

# 34. Reduce Custom Field Database Operations

Current implementation builds one Prisma operation per submitted field.

That is acceptable for a small number of fields but can become expensive.

Immediate safe improvement:

```js
await Promise.all(operations);
```

inside the same transaction client, as shown earlier.

Do not create a separate transaction per field.

Future optimization can use a more specialized batch strategy if profiling shows the need.

---

# 35. Student Edit Payload Strategy

For the immediate fix, a complete edit payload is acceptable.

But the backend should treat fields explicitly.

Example:

```js
...(fatherName !== undefined && {
  fatherName: fatherName ? fatherName.trim() : null,
})
```

This pattern is correct because it distinguishes:

```text
undefined = not supplied
''        = clear field
value     = update field
```

Do not replace this with:

```js
fatherName || null
```

for every field because that can unintentionally overwrite data.

---

# 36. Required Frontend Form Simplification

Remove the Additional tab from the Student form.

Current:

```jsx
{/* Additional Tab */}
{modalTab === 'additional' && (
  ...
)}
```

This entire hardcoded section should be removed once those attributes are migrated/represented through Custom Fields.

The UI should not have a permanent "Additional" tab containing institution-specific attributes.

---

# 37. Custom Field Tab

Keep:

```jsx
{customFields.map(field => (
  ...
))}
```

This becomes the primary mechanism for optional institution-specific student data.

The form should dynamically render:

```text
Text
Number
Date
Select
Checkbox
Textarea
```

based on:

```text
field.fieldType
```

---

# 38. Custom Field Section Support

Current schema has:

```prisma
section String @default("custom")
```

This should eventually support sections such as:

```text
Academic
Family
Identity
Medical
Other
```

Then the Student form can render:

```text
Custom Information

Academic
----------------
Hifz Level
Previous School

Family
----------------
Mother Tongue
Family ID

Medical
----------------
Blood Group
Allergies
```

This is a better long-term customization UX.

Do not hardcode these sections into Student code.

---

# 39. Custom Field Required Validation

Frontend should mark required fields:

```jsx
{field.isRequired && (
  <span className="required-star"> *</span>
)}
```

Backend must enforce the requirement independently.

Frontend validation is UX.

Backend validation is authority.

---

# 40. Student Create Flow

Target:

```text
User clicks Add Student
        ↓
Small core form
        ↓
Optional institution-defined Custom Fields
        ↓
Submit
        ↓
Backend validates
        ↓
Transaction
   ├── Student
   ├── Enrollment
   ├── Custom Fields
   └── Audit
        ↓
COMMIT
```

If any step fails:

```text
ROLLBACK
```

---

# 41. Student Edit Flow

Target:

```text
Edit Student
      ↓
Load current core data
      ↓
Load custom field values
      ↓
User changes one/more fields
      ↓
Save Changes
      ↓
Backend validates
      ↓
Transaction
      ├── Core data
      ├── Enrollment if changed
      ├── Custom fields
      └── Audit
      ↓
COMMIT
      ↓
Return updated Student
```

---

# 42. Exact Save Changes Acceptance Test

Take an existing student.

Change only:

```text
Phone
```

Click:

```text
Save Changes
```

Expected:

```text
200 OK
Student updated successfully
```

Verify:

- phone changed
- name unchanged
- class unchanged
- enrollment unchanged
- custom fields unchanged
- no duplicate enrollment created

---

# 43. Class Change Acceptance Test

Student currently:

```text
Class A
```

Change to:

```text
Class B
```

Expected:

```text
Class A enrollment → TRANSFERRED
Class B enrollment → ACTIVE
Student.classId → Class B
```

No duplicate ACTIVE enrollment.

---

# 44. Class Removal Acceptance Test

Student currently:

```text
Class A
```

Select:

```text
No Class
```

Expected:

```text
Class A enrollment → WITHDRAWN
Student.classId → null
```

No ACTIVE enrollment remains for current academic year.

---

# 45. Unchanged Class Acceptance Test

Student currently:

```text
Class A
```

Edit only:

```text
Phone
```

Expected:

```text
No new enrollment
No transfer
No withdrawal
```

This is important because the frontend must send:

```text
classId = undefined
```

when class was not changed.

---

# 46. Custom Field Acceptance Test

Create custom field:

```text
Blood Group
SELECT
Required = true
```

Options:

```text
A+
A-
B+
B-
O+
O-
AB+
AB-
```

Add student.

Select:

```text
B+
```

Save.

Expected:

```text
CustomFieldValue = B+
```

---

# 47. Custom Field Invalid Value Test

Send:

```text
Blood Group = "INVALID"
```

Expected:

```text
400
INVALID_CUSTOM_FIELD_VALUE
```

The server must reject it.

---

# 48. Custom Field Transaction Test

Simulate:

```text
Student core update succeeds
Custom field save fails
```

Expected final state:

```text
Student core update = ROLLBACK
Custom field update = ROLLBACK
```

No partial data.

---

# 49. Required Custom Field Test

Required field:

```text
Blood Group
```

Leave empty.

Expected:

```text
400
CUSTOM_FIELD_REQUIRED
```

No Student should be created/updated.

---

# 50. Duplicate Admission Test

Attempt:

```text
Admission No = existing value
```

Expected:

```text
409
DUPLICATE_ADMISSION_NO
```

No partial update.

---

# 51. Tenant Isolation Test

Attempt to update a Student belonging to another institution.

Expected:

```text
404 STUDENT_NOT_FOUND
```

Do not reveal that another institution's student exists.

---

# 52. Concurrency Test

Two requests attempt to enroll the same student simultaneously.

Expected:

```text
One succeeds
One receives 409
```

After the database partial unique index is installed, this becomes database-backed.

---

# 53. Performance Acceptance Test

Measure before/after.

At minimum verify:

```text
Student list initial load
Student search
Student edit
Student save
Custom field save
Student profile
```

Do not call the system "faster" without comparing actual request timings.

---

# 54. Frontend Loading Improvements

Avoid unnecessary duplicate `fetchStudents()` calls.

Current:

```js
await updateStudent(...);
setShowModal(false);
resetForm();
fetchStudents();
```

This is acceptable.

But make it:

```js
await updateStudent(...);

setShowModal(false);
resetForm();

await fetchStudents();
```

This makes the refresh lifecycle explicit.

Do not trigger a second fetch through another effect unless necessary.

---

# 55. Error Handling Improvement

Use one consistent error extraction helper.

Example:

```js
function getApiErrorMessage(error, fallback = 'Operation failed') {
  return error?.message || fallback;
}
```

Then:

```js
catch (err) {
  console.error('Student save failed:', err);
  toast.error(
    getApiErrorMessage(err, 'Failed to save student')
  );
}
```

Do not expose raw database errors to users.

---

# 56. Important Existing Bug/Code-Smell to Verify

The current Students JSX contains a suspicious duplicate closing tag around the class filter in the inspected source:

```jsx
<select
  className="filter-select desktop-only-filter"
  ...
>
  ...
</select>
</select>
```

This must be verified in the actual file before implementation.

If the duplicate exists in the current working source, remove only the extra closing tag.

Do not rewrite the filter toolbar.

---

# 57. API Layer

Current:

```js
export async function updateStudent(id, studentData) {
  return apiCall(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(studentData),
  });
}
```

This is acceptable.

Do not change it unless the actual runtime error demonstrates an API-layer problem.

The central `apiCall()` already:

```js
headers['Content-Type'] = 'application/json';
```

when a body exists.

Express already has:

```js
app.use(express.json({
  limit: '1mb',
}));
```

before Student routes.

Therefore the earlier `req.body === undefined` issue seen on Classes is NOT automatically the cause of the current Student Save failure.

Diagnose the Student failure from the actual response/log before changing API infrastructure.

---

# 58. Do Not Make These Unrelated Changes

During this Student fix, do NOT modify:

```text
Courses pagination
Classes business logic
Attendance business rules
Authentication
Fees
Exams
Dashboard
Sidebar
Institution configuration
RBAC architecture
```

unless a verified dependency requires it.

---

# 59. Implementation Order

## P0.1 — Reproduce Save Changes

First reproduce:

```text
Open student
Edit phone/name/etc.
Save Changes
```

Capture:

```text
Browser console
Network request
Request payload
HTTP status
Response body
Server console
```

Do not guess the failure.

---

## P0.2 — Fix request/body contract

Add:

```js
INVALID_REQUEST_BODY
```

guard.

Verify API response.

---

## P0.3 — Fix classId semantics

Implement:

```text
undefined = unchanged
null = remove
id = assign/transfer
```

---

## P0.4 — Make custom fields transactional

Move custom field saving into the same transaction.

---

## P0.5 — Add custom field validation

Implement:

```text
required
type
select options
number
date
checkbox
institution ownership
```

---

## P0.6 — Simplify Student form

Remove hardcoded:

```text
Blood Group
Nationality
ID Number
Previous School
Medical Notes
Emergency Contact
```

from the default form.

---

## P0.7 — DB enrollment constraint

Apply:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_enrollment_per_year"
ON "enrollments" ("studentId", "academicYearId")
WHERE "status" = 'ACTIVE';
```

Verify in PostgreSQL.

---

## P0.8 — Performance pass

Measure:

```text
GET students
GET student
PUT student
custom field operations
```

Optimize only measured bottlenecks.

---

## P0.9 — Regression test

Run all Student tests before touching Teacher.

---

# 60. Definition of Done

Student module is ready for Teacher development only when:

### Reliability

- [ ] Save Changes works.
- [ ] Add Student works.
- [ ] Edit Student works.
- [ ] Delete/archive works.
- [ ] Errors have meaningful messages/codes.
- [ ] No partial student/custom-field saves.

### Data integrity

- [ ] One ACTIVE enrollment per student/year is database-enforced.
- [ ] Transfer preserves history.
- [ ] Withdrawal preserves history.
- [ ] Class removal is explicit.
- [ ] Tenant isolation remains intact.
- [ ] Capacity validation remains intact.

### UX

- [ ] Add Student form is short.
- [ ] No unnecessary Additional tab.
- [ ] Custom fields render dynamically.
- [ ] Required custom fields are clear.
- [ ] Search/filter/pagination still work.
- [ ] Student profile still works.

### Customization

- [ ] Institution can create custom fields.
- [ ] Student UI renders them automatically.
- [ ] Required fields are enforced server-side.
- [ ] SELECT options are enforced server-side.
- [ ] Unknown fields cannot be written.

### Performance

- [ ] No unnecessary duplicate fetches.
- [ ] Student save has acceptable response time.
- [ ] Custom field save does not create unnecessary transactions.
- [ ] No integrity checks were removed to improve speed.

---

# 61. Architectural End State

The Student module should eventually look like:

```text
                     STUDENT
                        │
            ┌───────────┴───────────┐
            │                       │
       CORE DATA              CUSTOM DATA
            │                       │
     Admission No             Institution-defined
     Name                      fields
     DOB
     Gender
     Contact
     Address
     Status
            │                       │
            └───────────┬───────────┘
                        ↓
                  ENROLLMENT
                        ↓
                    CLASS
                        ↓
                ACADEMIC YEAR
```

And future Teacher should use the same philosophy:

```text
                     TEACHER
                        │
            ┌───────────┴───────────┐
            │                       │
       CORE DATA              CUSTOM DATA
            │                       │
            └───────────┬───────────┘
                        ↓
                 ASSIGNMENTS
                        ↓
                Class / Subject
```

This is the foundation for a genuinely dynamic ERP.

---

# 62. Final Instruction

**Do not rewrite Students.jsx or studentRoutes.js from scratch.**

Implement this in small, verifiable changes.

The required order is:

```text
Reproduce Save Failure
        ↓
Fix Exact Failure
        ↓
Fix classId Semantics
        ↓
Transactional Custom Fields
        ↓
Custom Field Validation
        ↓
Simplify Student Form
        ↓
DB Enrollment Constraint
        ↓
Performance Verification
        ↓
Full Student Regression
        ↓
STUDENT MODULE FREEZE
        ↓
Teacher Architecture
```

The most important product rule remains:

> **Core fields should be minimal and stable. Institution-specific information belongs in the customization system.**

And the most important engineering rule remains:

> **Fix the defect without changing unrelated working behavior.**
