# ALTUS KAIROS — PHASE 2A IMPLEMENTATION BRIEF
## Institution Boundary + Backend Authorization Foundation

**Project:** Madrasa Management System / Altus Kairos  
**Phase:** 2A  
**Purpose:** Harden the foundation before adding more ERP modules.

---

## 1. IMPORTANT DEVELOPMENT RULES

This phase is a **foundation/hardening phase**, not a feature-expansion phase.

Do NOT start implementing Exams, Fees, Accounts, Salary, Library, Hostel, Kitchen, or other large modules in this phase.

Do NOT redesign the existing UI.

Do NOT implement the real login/password authentication UI in this phase.

The existing development-role approach must remain available so Admin/Teacher/etc. behavior can be tested without slowing development.

However, authorization must be enforced on the **backend**, not only hidden in the frontend.

### Core principle

Frontend permission checks are UX.

Backend permission checks are security/authorization.

A hidden sidebar item is NOT protection.

---

# 2. CURRENT ARCHITECTURAL TARGET

Every protected request should eventually follow this conceptual pipeline:

Request
  ↓
Identity / Dev Identity
  ↓
Institution Context
  ↓
Permission Check
  ↓
Module Enabled Check
  ↓
Route
  ↓
Service
  ↓
Institution-scoped database query
  ↓
Response

The real authentication mechanism can be plugged into the Identity layer later.

The business logic must not depend on the future login UI.

---

# 3. PHASE 2A GOALS

This phase has six primary goals:

1. Establish a reliable institution/tenant context.
2. Prevent cross-institution data access.
3. Make backend RBAC authoritative.
4. Make module configuration authoritative on the backend.
5. Make frontend routes respect permissions/modules.
6. Make the architecture ready for future real authentication without rewriting business logic.

---

# 4. NON-NEGOTIABLE INVARIANTS

These rules must hold after this phase.

## 4.1 Institution isolation

Every institution-owned business query must be scoped to the active institution.

Never rely on:

```js
findFirst()
```

without institution scope when the entity is tenant-owned.

Never accept arbitrary:

```text
institutionId
```

from the browser as the authority for tenancy.

The client must NOT be able to switch institutions simply by modifying a request body, query parameter, or URL.

---

## 4.2 Development institution context

During the development-only period, institution context may come from:

```text
DEV_INSTITUTION_ID
```

but only on the server.

Do not accept:

```text
?institutionId=...
```

or:

```json
{
  "institutionId": "..."
}
```

as a trusted institution selector.

The future authenticated identity should eventually provide:

```text
req.user.institutionId
```

or an equivalent server-derived context.

Design the middleware so replacing the dev source with authenticated identity later does not require rewriting services/routes.

---

## 4.3 Permission authority

The backend must determine whether an identity is allowed to perform an operation.

Frontend permission checks must never be considered sufficient security.

Example:

```text
Teacher
  ↓
GET /api/students
  ↓
backend checks permission
  ↓
allow/deny
```

and:

```text
Teacher
  ↓
PUT /api/institution/configuration
  ↓
backend checks SETTINGS_MANAGE
  ↓
403 if unauthorized
```

---

## 4.4 Module authority

If an institution has:

```text
attendanceEnabled = false
```

then:

```text
/attendance
GET attendance APIs
POST attendance APIs
```

must not remain usable merely because someone knows the URL.

The backend must reject disabled-module operations.

Use a consistent error such as:

```text
MODULE_DISABLED
```

with HTTP 403.

---

# 5. DATABASE / TENANT BOUNDARY WORK

## 5.1 AcademicYear

Review and change the model so AcademicYear is properly institution-scoped.

Current architectural problem:

```text
institutionId is optional
name is globally unique
```

The target should be conceptually:

```text
AcademicYear
  institutionId REQUIRED
  name
```

with uniqueness scoped to the institution:

```text
@@unique([institutionId, name])
```

Therefore:

```text
Institution A → 2026-2027
Institution B → 2026-2027
```

must be allowed.

Do not keep global uniqueness on the academic-year name.

---

## 5.2 Current AcademicYear lookups

Find every query equivalent to:

```js
where: {
  isCurrent: true
}
```

and determine whether it is institution-scoped.

Do NOT globally select:

```js
findFirst({
  where: { isCurrent: true }
})
```

For tenant-owned logic, the query must include the active institution.

Conceptually:

```js
where: {
  institutionId,
  isCurrent: true
}
```

Every affected service/route must be reviewed.

Known important areas include:

- student routes
- class routes
- enrollment service
- attendance service
- import logic
- migration scripts where applicable

Do not blindly modify historical migration scripts if doing so would make them unusable. Distinguish active application code from one-time migration code.

---

# 6. TENANT OWNERSHIP AUDIT

Perform a model-by-model audit.

For every entity, answer:

1. Is it institution-owned?
2. If yes, how is institution ownership proven?
3. Can a query accidentally return another institution's records?
4. Is global uniqueness intentional?
5. Is institutionId direct ownership preferable?
6. Can ownership be derived safely through a parent relationship?

At minimum review:

- Institution
- InstitutionConfiguration
- AcademicYear
- Class
- Enrollment
- Student
- Teacher
- Subject
- Course
- CustomField
- Attendance
- Exam
- Result
- Fee-related entities
- Account-related entities
- Salary-related entities
- Library-related entities
- Hostel-related entities
- Kitchen-related entities
- Role
- User
- AuditLog

Do not add `institutionId` everywhere automatically.

Use direct ownership where it makes the boundary clearer and safer.

For entities whose ownership is naturally derived through a required parent, document the relationship instead.

---

# 7. CUSTOM FIELD TENANCY

Current CustomField architecture must be reviewed carefully.

A field such as:

```text
mother_tongue
```

should not become globally unavailable to another institution merely because another institution already uses the same field key.

The desired architecture should allow:

```text
Institution A → mother_tongue
Institution B → mother_tongue
```

if institution-specific fields are intended.

Review:

- schema
- create
- update
- delete
- list
- student-field rendering
- export/import

Every custom-field query must respect institution ownership.

Do not use global `fieldKey` uniqueness if that conflicts with institution-level customization.

---

# 8. RBAC IMPLEMENTATION

## 8.1 Permission source of truth

Use the existing:

```text
src/config/permissions.js
```

as the frontend/dev-role permission contract.

Do not create random permission strings in individual components.

Permission codes must remain stable.

---

## 8.2 Backend permission middleware

Create/use a backend permission middleware with a clear API such as:

```js
requirePermission('students.view')
requirePermission('students.manage')
requirePermission('settings.view')
requirePermission('settings.manage')
```

Use the project's existing permission naming convention instead of inventing a second convention.

The middleware must obtain the role from server-side identity/context.

Do NOT trust:

```text
req.body.role
```

or a browser-provided role.

---

## 8.3 Development role context

Because real authentication is intentionally deferred, development identity may be represented by the existing development context.

The backend must make the development role actually participate in authorization.

Currently the risk is:

```text
Frontend DevRoleContext
        ≠
Backend authorization identity
```

Fix this.

Changing:

```text
ADMIN → TEACHER
```

in development must cause backend permission checks to behave accordingly.

Do not implement a fake production login.

---

# 9. BACKEND ROUTE PROTECTION

Review every API route.

At minimum review:

```text
/api/institution
/api/students
/api/classes
/api/attendance
/api/custom-fields
/api/export
/api/import
/api/auth
```

For each endpoint document:

```text
HTTP method
route
required permission
required module
institution scope
```

Example:

```text
GET /api/students
Permission: students.view
Module: studentsEnabled
Tenant: required

POST /api/students
Permission: students.manage
Module: studentsEnabled
Tenant: required
```

Do not apply one permission blindly to all endpoints.

Use least privilege.

---

# 10. INSTITUTION SETTINGS API

The institution configuration endpoints must be protected.

Examples:

```text
GET  /api/institution/configuration
PUT  /api/institution/configuration

GET  /api/institution/profile
PUT  /api/institution/profile
```

Expected authorization:

```text
GET → SETTINGS_VIEW
PUT → SETTINGS_MANAGE
```

Use the server-derived institution context.

Never accept an arbitrary institution ID from the client.

---

# 11. MODULE ENFORCEMENT MIDDLEWARE

Create a reusable middleware/service-level mechanism.

Conceptually:

```js
requireModuleEnabled('attendanceEnabled')
```

Expected behavior:

```text
configuration flag = true
→ continue

configuration flag = false
→ 403 MODULE_DISABLED
```

Do not duplicate this logic in every route.

Use the institution configuration service as the source of truth.

The middleware must retrieve configuration for the current institution, not a random institution.

---

# 12. WHICH MODULES MUST BE WIRED

At minimum wire the modules already represented by configuration:

```text
studentsEnabled
coursesEnabled
attendanceEnabled
examsEnabled
feesEnabled
accountsEnabled
salaryEnabled
libraryEnabled
hostelEnabled
kitchenEnabled
```

For modules whose actual backend routes do not exist yet:

- do not invent fake APIs
- document the future enforcement point
- make the frontend route behavior consistent
- do not build the module itself in Phase 2A

---

# 13. FRONTEND ROUTE AUTHORIZATION

The existing:

```text
ProtectedRoute.jsx
```

must be evaluated and actually integrated where appropriate.

Do not rely only on Sidebar filtering.

The route layer should support concepts such as:

```jsx
<ProtectedRoute permission="settings.view">
  <InstitutionSettings />
</ProtectedRoute>
```

and module-aware routing where appropriate.

A user must not gain access simply by manually typing:

```text
/settings
```

or:

```text
/attendance
```

into the browser.

---

# 14. SIDEBAR

Keep the existing sidebar design.

Its filtering should remain:

```text
permission allowed
AND
module enabled
```

Do not duplicate permission definitions.

Use the centralized permission configuration.

The sidebar is a UX layer, while route/backend guards are enforcement layers.

---

# 15. INSTITUTION CONTEXT

`InstitutionContext` should be the frontend source of truth for institution configuration.

It should:

- load configuration
- expose loading state
- expose error state
- expose configuration
- provide refresh functionality if needed
- avoid scattered configuration fetches

Do not make individual components independently fetch institution configuration unless there is a strong reason.

---

# 16. CONFIGURATION CONTRACT

Standardize the configuration keys between:

```text
Prisma schema
backend service
backend API
frontend InstitutionContext
settings UI
sidebar/module definitions
```

Pay special attention to:

```text
resultsEnabled
```

and every other schema key.

There must not be a situation where:

```text
database supports a flag
backend returns it
frontend silently ignores it
settings cannot edit it
```

Use one canonical list/contract where practical.

---

# 17. SETTINGS UPDATE BEHAVIOR

The current frontend updates configuration and profile separately.

Review whether the settings screen should use one backend transactional operation.

Preferred final architecture:

```text
PUT /api/institution/settings
        ↓
transaction
        ├── update profile
        └── update configuration
```

If separate endpoints are intentionally retained, the UI must not falsely imply that both succeeded if one failed.

Do not hide partial failure.

---

# 18. VALIDATION

Server-side validation is mandatory.

Validate:

### Institution profile

- name
- email
- phone
- address
- logoUrl
- description
- any other editable profile field

Use explicit allowlists and appropriate type/format validation.

### Configuration

Validate:

- booleans are actually booleans
- `attendanceLockDays` is an integer
- range is valid
- unknown configuration keys are rejected or safely ignored according to the established API contract

Do not rely only on React/client validation.

---

# 19. ERROR CONTRACT

Use the existing centralized:

```text
AppError
errorHandler
```

architecture.

Standardize errors such as:

```text
AUTH_REQUIRED
FORBIDDEN
INSTITUTION_CONTEXT_REQUIRED
MODULE_DISABLED
VALIDATION_ERROR
RESOURCE_NOT_FOUND
DATA_INTEGRITY_CONFLICT
```

Do not expose internal stack traces or Prisma internals to the client.

Expected unauthorized behavior:

```text
401 → no valid identity/context
403 → identity exists but operation is forbidden
```

Keep this distinction consistent.

---

# 20. AUDIT LOGGING

Review institution settings mutations and authorization-sensitive operations.

For important mutations, audit records should contain the correct:

```text
institutionId
user/actor
action
entityType
entityId
beforeData
afterData
```

Fix any route/service calls that use outdated argument names such as:

```text
entity
oldValue
newValue
```

when the audit service expects:

```text
entityType
beforeData
afterData
```

Do not silently lose audit information.

---

# 21. CRITICAL AUDIT FAILURE POLICY

Decide and document whether critical audit writes are:

```text
best-effort
```

or:

```text
mandatory
```

For compliance-grade state changes, prefer:

```text
business mutation
+
audit mutation
```

inside the same transaction.

If the audit write fails:

```text
ROLLBACK
```

for operations where audit integrity is mandatory.

Do not make every low-value log transactionally critical without reason.

---

# 22. DO NOT BREAK ENROLLMENT ARCHITECTURE

Do not redesign Enrollment in this phase.

However, while adding institution scoping, preserve these existing rules:

### Active membership

A student has at most one ACTIVE Enrollment for a given AcademicYear.

### Transfer

Old enrollment:

```text
TRANSFERRED
exitDate set
```

New enrollment:

```text
ACTIVE
```

### Withdrawal

Active enrollment becomes:

```text
WITHDRAWN
exitDate set
```

### Student.classId

Keep it only as synchronized legacy compatibility state.

Never make it the authoritative source for academic membership.

---

# 23. DO NOT SOLVE CAPACITY CONCURRENCY IN THIS PHASE

Capacity race conditions were identified in the audit.

They are important, but they belong to the next hardening phase.

Document them clearly for Phase 2B:

```text
Enrollment uniqueness
Capacity concurrency
Database constraints
```

Do not create a half-finished concurrency solution here unless required by a tenant-boundary change.

---

# 24. DO NOT ADD STARTUP DDL

Do NOT add:

```js
prisma.$executeRawUnsafe(...)
```

or equivalent startup database schema mutation.

Database constraints must eventually be introduced through proper migration/schema management.

The project currently has a `db push` development workflow, so migration adoption must be handled deliberately rather than by silently inserting startup DDL.

---

# 25. QUERY AUDIT

Search the codebase for:

```text
findFirst
findUnique
findMany
update
delete
count
aggregate
groupBy
```

and inspect tenant-owned queries.

Red flags:

```js
prisma.student.findMany()
```

when institution filtering is required.

Also red flags:

```js
findFirst({
  where: {
    isCurrent: true
  }
})
```

without institution scope.

Every mutation must verify that the target resource belongs to the current institution.

---

# 26. IDOR / CROSS-TENANT TESTING

Explicitly test scenarios like:

```text
Institution A
Student A

Institution B
Student B
```

Then attempt from Institution A context:

```text
GET Student B
PUT Student B
DELETE Student B
GET Class B
GET Attendance B
GET CustomField B
UPDATE Institution B
```

Every unauthorized cross-tenant operation must fail.

Do not only test normal UI flows.

Test direct API access.

---

# 27. DEV ROLE TEST MATRIX

At minimum test:

### ADMIN

Should be able to:

- access permitted modules
- view settings
- modify settings
- perform administrative operations according to permissions

### TEACHER

Should NOT be able to:

- modify institution configuration
- modify institution profile
- access settings through direct URL if permission is absent
- call restricted settings API directly

Should be able to access only the modules/operations explicitly granted.

### ACCOUNTANT

Should primarily see/use finance permissions.

Must not inherit unrelated administrative permissions accidentally.

### Other development roles

Verify their permission sets from the centralized permission map.

---

# 28. MODULE TEST MATRIX

For every enabled/disabled module:

```text
Module enabled
→ sidebar visible if permission allows
→ route accessible if permission allows
→ API accessible if permission allows

Module disabled
→ sidebar hidden
→ route blocked
→ API returns 403 MODULE_DISABLED
```

Test both:

```text
permission = allowed
module = disabled
```

and:

```text
permission = denied
module = enabled
```

Both must deny access.

---

# 29. NO SECURITY THROUGH UI

These are NOT security mechanisms:

```text
hidden sidebar item
disabled button
React conditional rendering
frontend role variable
frontend localStorage
```

They improve UX.

Actual enforcement must happen on the server.

---

# 30. LOCAL STORAGE WARNING

The development role may be persisted in localStorage for convenience.

That is acceptable only as a development mechanism.

Do not treat a localStorage role as a production security credential.

The future real authentication layer must replace the trust boundary.

---

# 31. FILE / ARCHITECTURE CLEANUP

There are duplicate context paths:

```text
src/context/
src/contexts/
```

Review and choose one canonical location.

Prefer one source of implementation.

If compatibility re-exports are retained, document why.

Do not leave duplicate independent implementations.

---

# 32. EXPECTED FILES / AREAS

Likely files to modify or create:

```text
server/
  prisma/schema.prisma

  src/
    middleware/
      devContext.js
      institutionContext.js
      requirePermission.js
      requireModuleEnabled.js

    services/
      institutionConfigurationService.js
      academicYearService.js

    routes/
      institutionRoutes.js
      studentRoutes.js
      classRoutes.js
      attendanceRoutes.js
      customFieldRoutes.js
      exportRoutes.js
      importRoutes.js

src/
  config/
    permissions.js

  contexts/
    DevRoleContext.jsx
    InstitutionContext.jsx

  components/common/
    ProtectedRoute.jsx

  components/layout/
    Sidebar.jsx
    DevRoleSwitcher.jsx

  pages/
    InstitutionSettings.jsx

  App.jsx
```

This is a target area list, not permission to create unnecessary files.

Reuse existing architecture where it is sound.

---

# 33. API CONTRACT EXAMPLES

Use the actual project naming convention, but the conceptual contract should be:

### Unauthorized

```http
401
```

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication required"
  }
}
```

### Forbidden

```http
403
```

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action"
  }
}
```

### Disabled module

```http
403
```

```json
{
  "error": {
    "code": "MODULE_DISABLED",
    "message": "This module is disabled for the institution"
  }
}
```

Do not expose sensitive implementation details.

---

# 34. ACCEPTANCE CRITERIA

Phase 2A is NOT complete until all of the following are true.

## Institution

- [ ] Institution context is server-derived.
- [ ] Client cannot select arbitrary institution ID.
- [ ] Institution settings are institution-scoped.
- [ ] AcademicYear is institution-scoped.
- [ ] Current-year queries are institution-scoped.
- [ ] Tenant-owned queries have been audited.

## RBAC

- [ ] Backend permissions are enforced.
- [ ] Frontend permissions are only UX protection.
- [ ] Dev role affects backend authorization.
- [ ] Settings API requires correct permission.
- [ ] Direct API calls cannot bypass RBAC.

## Modules

- [ ] Module flags affect navigation.
- [ ] Module flags affect frontend routes.
- [ ] Module flags affect backend operations.
- [ ] Disabled module returns `403 MODULE_DISABLED`.

## Frontend

- [ ] Direct `/settings` access is guarded.
- [ ] Direct module URLs are guarded.
- [ ] Sidebar and route rules use centralized configuration.
- [ ] Duplicate context implementations are resolved.

## Validation/errors

- [ ] Server-side validation exists.
- [ ] 401 vs 403 is consistent.
- [ ] Module-disabled errors are consistent.
- [ ] No internal stack traces leak.

## Audit

- [ ] Audit argument contracts are consistent.
- [ ] Institution ID is recorded.
- [ ] Important settings mutations are auditable.
- [ ] Critical audit failure policy is explicit.

---

# 35. TEST PLAN

Before declaring completion, run:

## Backend

```text
npm install
npm run prisma:validate
npm run build
```

or the exact scripts actually defined by the repository.

Also run syntax/lint checks if configured.

## Frontend

```text
npm install
npm run build
```

and lint/type checks if configured.

Do not report a check as passed unless it was actually executed.

---

# 36. MANUAL SECURITY TESTS

Test:

```text
1. Admin → settings
2. Teacher → settings
3. Teacher → direct /settings
4. Teacher → direct settings API
5. Attendance enabled → access
6. Attendance disabled → UI hidden
7. Attendance disabled → direct URL
8. Attendance disabled → direct API
9. Institution A → Institution B student ID
10. Institution A → Institution B class ID
11. Institution A → Institution B custom field ID
12. Institution A → Institution B configuration update
```

Expected:

```text
allowed only when BOTH:
permission = allowed
module = enabled (where applicable)
```

and:

```text
tenant ownership = current institution
```

---

# 37. GIT WORKFLOW

Before editing:

```bash
git status
git branch
```

Create a dedicated branch:

```text
phase-2a-institution-rbac-foundation
```

Make focused commits.

Suggested commit groups:

```text
1. Fix institution/AcademicYear tenancy boundary
2. Add backend institution context
3. Add backend RBAC enforcement
4. Add module enforcement
5. Protect frontend routes
6. Normalize configuration contract
7. Fix audit integration
8. Add tests
```

Do not mix unrelated UI redesigns into these commits.

---

# 38. IMPLEMENTATION STYLE

Follow existing project conventions.

Do not:

- rewrite the whole backend
- replace Prisma with another ORM
- introduce a new state-management library unnecessarily
- redesign the dashboard
- create fake authentication
- add startup DDL
- duplicate business logic between routes
- trust browser-supplied institution IDs
- trust browser-supplied roles
- silently repair corrupted academic data

Prefer:

```text
small reusable middleware
small focused services
centralized permission definitions
centralized institution context
explicit validation
explicit error codes
transaction boundaries
```

---

# 39. FINAL DELIVERABLE

When implementation is complete, provide a concise implementation report containing:

```text
Files changed
Files created
Database changes
New middleware
New permissions
Module enforcement behavior
Frontend route behavior
Institution-scoping changes
Tests executed
Tests passed
Tests not executable and why
Known remaining risks
Phase 2B recommendations
```

Do not claim production readiness if any critical acceptance criterion remains incomplete.

---

# 40. PHASE 2B PREVIEW

After Phase 2A passes, the next hardening phase should address:

```text
Enrollment uniqueness
↓
Database-level ACTIVE enrollment constraint
↓
Capacity concurrency
↓
Transfer/withdraw integrity
↓
Attendance enrollmentId finalization
↓
Historical attendance integrity
↓
Working-day/calendar model
↓
Import/export integrity
```

Do not implement those as part of Phase 2A unless a dependency genuinely requires it.

---

# FINAL INSTRUCTION TO THE IMPLEMENTING AI

Read the existing repository before making changes.

Do not assume that the architecture described here already exists exactly as specified.

Preserve working code.

Before modifying a file, understand its current callers and dependencies.

When changing a Prisma relationship or unique constraint, inspect every affected query and mutation.

When adding institution filtering, verify that every affected route/service still works with the new relationship.

When adding RBAC, verify both frontend and direct API behavior.

When adding module enforcement, verify both frontend route access and backend API access.

Do not silently fix unrelated issues.

At the end, run the repository's real validation/build/test commands and report the actual results.

The goal of Phase 2A is:

**Make Institution Context + Tenant Isolation + Backend Authorization + Module Enforcement structurally correct, without implementing real login UI and without starting new ERP modules.**
