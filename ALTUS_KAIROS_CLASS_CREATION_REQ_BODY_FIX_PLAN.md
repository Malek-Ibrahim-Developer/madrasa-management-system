# Altus Kairos — Class Creation `req.body` / POST Payload Fix Plan

## 1. Purpose

This document defines the exact fixes required for the current Class/Course creation failure:

```text
📡 [POST] /api/classes undefined

TypeError: Cannot read properties of undefined (reading 'name')
    at validateClassPayload
    ...
```

The goal is to make the complete request path robust:

```text
Courses.jsx
    ↓
createClass(payload)
    ↓
apiCall(...)
    ↓
fetch(...)
    ↓
Content-Type: application/json
    ↓
Express express.json()
    ↓
req.body
    ↓
validateClassPayload(...)
    ↓
Class creation transaction
```

The current failure occurs before the database/class-creation transaction is reached.

---

# 2. Confirmed Root Cause

The immediate exception is:

```text
Cannot read properties of undefined (reading 'name')
```

The validator accesses properties directly from its argument:

```js
const validateClassPayload = (body) => {
  const errors = {};

  const name = typeof body.name === 'string'
    ? body.name.trim()
    : '';
```

If `req.body` is `undefined`, then:

```js
body.name
```

throws a JavaScript `TypeError`.

The Class POST route calls:

```js
const validation = validateClassPayload(req.body);
```

Therefore the immediate problem is:

```text
req.body === undefined
```

This means the request-body transport/parsing path must be fixed first.

---

# 3. Important Diagnostic Conclusion

Do **not** modify the following areas as the first response to this error:

- Prisma Class model
- AcademicYear relationship
- Enrollment architecture
- Tenant-isolation logic
- Class creation transaction
- Teacher/ClassTeacher relationship
- Database class constraints

Those parts are not yet being reached.

The stack trace proves that execution stops here:

```text
POST /api/classes
    ↓
validateClassPayload(req.body)
    ↓
TypeError
```

The database transaction begins later in `classRoutes.js`, so it is not the source of this particular failure.

---

# 4. Files That Must Be Fixed

Primary files:

1. `src/services/api.js`
2. `server/index.js`
3. `server/src/validators/classValidator.js`
4. `server/src/routes/classRoutes.js`

Secondary verification:

5. `src/pages/Courses.jsx`

The frontend `Courses.jsx` already follows the expected pattern by calling:

```js
createClass(payload)
```

and the API service serializes the payload with:

```js
body: JSON.stringify(classData)
```

Therefore the most important inspection/fix is the implementation of `apiCall()`.

---

# 5. FIX #1 — `src/services/api.js`

## Position

Open:

```text
src/services/api.js
```

Find the central:

```js
apiCall(...)
```

function.

Do not create a second API wrapper. Fix the existing centralized request helper.

---

## Required behavior

For JSON requests, the helper must:

1. Preserve the HTTP method.
2. Preserve the request body.
3. Set `Content-Type: application/json`.
4. Preserve existing headers such as `X-Dev-Role`.
5. Parse JSON responses.
6. Log the request method/path/body consistently during development.

---

## Recommended implementation pattern

Use the existing API base URL and existing authentication/dev-role logic from the project. The important structure should be equivalent to:

```js
async function apiCall(endpoint, options = {}) {
  const method = options.method || 'GET';

  const headers = {
    ...(options.headers || {}),
  };

  // Add JSON content type when a JSON body is present.
  if (options.body !== undefined && options.body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  console.log(`📡 [${method}] ${endpoint}`, options.body);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    method,
    headers,
    body: options.body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
}
```

### Important

If the existing `apiCall()` already contains:

- `X-Dev-Role`
- credentials
- authorization headers
- special error handling
- response handling

do **not** delete them.

Merge the JSON-body fix into the existing implementation.

For example:

```js
const headers = {
  ...existingHeaders,
  ...(options.headers || {}),
};

if (options.body !== undefined && options.body !== null) {
  headers['Content-Type'] = 'application/json';
}
```

The exact existing project behavior must remain intact.

---

# 6. Why `Content-Type` Matters

The frontend sends:

```js
body: JSON.stringify(classData)
```

That produces a JSON string.

For example:

```json
{
  "name": "Hifz",
  "section": "A",
  "code": "HIFZ-A",
  "teacher": "Maulana Zubair",
  "capacity": 40
}
```

The browser sends that string to Express.

Express needs to know that the request body is JSON.

That is why the request should contain:

```http
Content-Type: application/json
```

The backend's:

```js
express.json()
```

middleware can then parse it into:

```js
req.body
```

which becomes:

```js
{
  name: "Hifz",
  section: "A",
  code: "HIFZ-A",
  teacher: "Maulana Zubair",
  capacity: 40
}
```

Without the correct request configuration, the backend can receive no usable parsed body.

---

# 7. FIX #2 — `server/index.js`

## Position

Open:

```text
server/index.js
```

Find the Express application initialization and middleware section.

There must be:

```js
app.use(express.json());
```

and it must be registered **before the API routes**.

Correct ordering:

```js
const express = require('express');

const app = express();

app.use(cors());
app.use(express.json());

// Other middleware
// req.prisma
// dev context
// institution context
// permissions

// API routes
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
```

---

## Incorrect ordering

Do not do:

```js
app.use('/api/classes', classRoutes);

app.use(express.json());
```

because the Class route would execute before JSON parsing middleware.

---

# 8. Recommended JSON Parser Hardening

Use an explicit JSON parser:

```js
app.use(express.json({
  limit: '1mb',
}));
```

The exact limit can follow the project's existing requirements.

The important part is that it remains before the API routes.

---

# 9. Add a Temporary Request-Body Diagnostic

During development, immediately before the API routes, you may temporarily add:

```js
app.use((req, res, next) => {
  if (req.path === '/api/classes' && req.method === 'POST') {
    console.log('🧪 Class POST body:', req.body);
    console.log('🧪 Content-Type:', req.headers['content-type']);
  }

  next();
});
```

Expected output:

```text
🧪 Class POST body: {
  name: 'Hifz',
  section: 'A',
  code: 'HIFZ-A',
  teacher: 'Maulana Zubair',
  capacity: 40
}

🧪 Content-Type: application/json
```

If you instead see:

```text
🧪 Class POST body: undefined
```

then the request parser/request headers are still wrong.

After diagnosing the issue, this temporary logger can be removed or replaced by normal development logging.

---

# 10. FIX #3 — `server/src/validators/classValidator.js`

## Position

Open:

```text
server/src/validators/classValidator.js
```

Find:

```js
const validateClassPayload = (body) => {
```

Change it to:

```js
const validateClassPayload = (body = {}) => {
```

This is a defensive programming fix.

---

## Recommended full validator

The validator should be structured like this:

```js
/**
 * Server-side validation rules for Class payload data
 */
const validateClassPayload = (body = {}) => {
  const errors = {};

  const name =
    typeof body.name === 'string'
      ? body.name.trim()
      : '';

  const section =
    typeof body.section === 'string'
      ? body.section.trim()
      : '';

  const code =
    typeof body.code === 'string'
      ? body.code.trim()
      : '';

  const capacity = Number(body.capacity);

  const teacher =
    typeof body.teacher === 'string'
      ? body.teacher.trim()
      : '';

  const academicYearId =
    typeof body.academicYearId === 'string'
      ? body.academicYearId.trim()
      : '';

  if (!name) {
    errors.name = 'Class name is required';
  } else if (name.length > 100) {
    errors.name = 'Class name must be 100 characters or less';
  }

  if (!code) {
    errors.code = 'Class code is required';
  } else if (code.length > 30) {
    errors.code = 'Class code must be 30 characters or less';
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    errors.capacity = 'Capacity must be a positive integer';
  } else if (capacity > 10000) {
    errors.capacity = 'Capacity is too large';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      name,
      section: section || null,
      code,
      capacity:
        Number.isInteger(capacity) && capacity > 0
          ? capacity
          : 40,
      teacher: teacher || null,
      academicYearId: academicYearId || null,
    },
  };
};

module.exports = {
  validateClassPayload,
};
```

---

# 11. Why the Validator Must Be Defensive

A validator is a trust boundary.

It should not crash simply because the client sends:

```js
undefined
```

or:

```js
null
```

or:

```js
{}
```

Instead, invalid input should produce a controlled validation error.

For example:

```text
400/422
INVALID_REQUEST_BODY
```

rather than:

```text
TypeError: Cannot read properties of undefined
```

This distinction is important for production reliability.

---

# 12. FIX #4 — `server/src/routes/classRoutes.js`

## Position

Open:

```text
server/src/routes/classRoutes.js`

Find:

```js
router.post('/', async (req, res, next) => {
```

At the very beginning of the handler, before calling the validator, add explicit request-body validation.

Recommended:

```js
router.post('/', async (req, res, next) => {
  try {
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

    const validation = validateClassPayload(req.body);

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];

      throw new AppError(
        firstError || 'Validation failed',
        422,
        'VALIDATION_ERROR'
      );
    }

    let {
      name,
      section,
      code,
      capacity,
      teacher,
      academicYearId,
    } = validation.data;

    // Existing transaction continues here...
```

---

# 13. Why Both Route Validation and Validator Defaults Are Needed

These two protections have different responsibilities.

### Route-level protection

```js
if (!req.body || typeof req.body !== 'object') {
  throw new AppError(...);
}
```

answers:

> Is this HTTP request structurally valid?

### Validator-level protection

```js
const validateClassPayload = (body = {}) => {
```

answers:

> Can the validator safely process whatever reaches it?

This creates defense in depth.

---

# 14. DO NOT Add a Fake Default Request Body

Do not do this:

```js
validateClassPayload(req.body || {
  name: '',
  code: '',
  capacity: 40,
});
```

That hides a transport/parsing problem.

The correct architecture is:

```text
Missing body
   ↓
INVALID_REQUEST_BODY
   ↓
Client/API transport bug is visible
```

not:

```text
Missing body
   ↓
Fake default object
   ↓
Validation
```

---

# 15. FIX #5 — `src/pages/Courses.jsx`

## Position

Open:

```text
src/pages/Courses.jsx
```

Find the `handleSubmit()` function.

Verify that the payload passed to:

```js
createClass(payload)
```

is a normal JavaScript object.

The expected pattern is:

```js
const payload = {
  name: formData.name,
  section: formData.section,
  code: formData.code,
  teacher: formData.teacher,
  capacity: Number(formData.capacity),
};

await createClass(payload);
```

Do **not** stringify here if `apiCall()`/`createClass()` already handles JSON serialization.

Correct:

```js
createClass(payload);
```

and:

```js
body: JSON.stringify(classData);
```

inside `api.js`.

---

# 16. Avoid Double JSON Serialization

Do not accidentally create:

```js
createClass(JSON.stringify(payload));
```

because then `createClass()` performs:

```js
JSON.stringify(classData)
```

again.

That can produce an invalid payload such as a JSON string containing another JSON string.

The ownership should be:

```text
Courses.jsx
    ↓
plain JS object
    ↓
createClass()
    ↓
apiCall()
    ↓
JSON.stringify()
    ↓
fetch()
```

---

# 17. Expected Final Request

After the fixes, DevTools → Network → `POST /api/classes` should show:

### Request Headers

```http
Content-Type: application/json
```

### Request Payload

Something similar to:

```json
{
  "name": "Hifz",
  "section": "A",
  "code": "HIFZ-A",
  "teacher": "Maulana Zubair",
  "capacity": 40
}
```

`academicYearId` may be omitted because the backend is designed to resolve the current AcademicYear.

---

# 18. Expected Backend Flow After Fix

The backend should now execute:

```text
POST /api/classes
       ↓
express.json()
       ↓
req.body populated
       ↓
requirePermission
       ↓
requireModuleEnabled
       ↓
requireInstitutionContext
       ↓
validateClassPayload(req.body)
       ↓
validation.data
       ↓
$transaction(...)
       ↓
resolve AcademicYear
       ↓
verify tenant ownership
       ↓
check class-code uniqueness
       ↓
create Class
       ↓
create/upsert Teacher/ClassTeacher
       ↓
audit log
       ↓
200/201 response
```

---

# 19. Important Existing Class Logic to Preserve

Do not replace the existing Class transaction with a simplified implementation.

After the request-body fix, preserve the current architecture around:

- `req.institutionId`
- current AcademicYear resolution
- tenant-scoped AcademicYear lookup
- class ownership
- class-code uniqueness
- Teacher ownership
- ClassTeacher synchronization
- audit logging
- transaction boundary

The current error occurs before those operations.

The objective is to repair the request pipeline, not undo the relationship hardening already implemented.

---

# 20. Additional Important Check — API Helper Logging

The current console output is:

```text
📡 [POST] /api/classes undefined
```

That is highly useful evidence.

Find the logging statement in:

```text
src/services/api.js
```

and verify whether it prints:

```js
options.body
```

If it prints `undefined`, inspect the call site immediately.

`createClass()` should receive a payload:

```js
createClass({
  name,
  section,
  code,
  capacity,
  teacher,
});
```

and then:

```js
body: JSON.stringify(classData)
```

should produce a string.

For example:

```js
console.log(options.body);
```

should show:

```json
{"name":"Hifz","section":"A","code":"HIFZ-A","capacity":40,"teacher":"Maulana Zubair"}
```

If it remains:

```text
undefined
```

then the problem is earlier than `fetch()` and `Courses.jsx` should be inspected.

---

# 21. Debugging Checklist

Perform these checks in this exact order.

## Step 1 — Browser

Before calling the API:

```js
console.log('🧪 createClass payload:', payload);
```

Expected:

```js
{
  name: "...",
  section: "...",
  code: "...",
  capacity: 40,
  teacher: "..."
}
```

---

## Step 2 — API service

Inside `createClass()`:

```js
console.log('🧪 createClass data:', classData);
```

Expected: object.

Then after serialization:

```js
const body = JSON.stringify(classData);

console.log('🧪 serialized body:', body);
```

Expected: JSON string.

---

## Step 3 — Fetch

Verify:

```js
headers['Content-Type'] === 'application/json'
```

and:

```js
body === JSON.stringify(classData)
```

---

## Step 4 — Express

Verify:

```js
app.use(express.json());
```

is before:

```js
app.use('/api/classes', classRoutes);
```

---

## Step 5 — Backend route

Temporarily log:

```js
console.log('🧪 req.body:', req.body);
```

Expected:

```js
{
  name: "...",
  code: "...",
  capacity: 40
}
```

---

## Step 6 — Validator

Verify:

```js
validateClassPayload(req.body)
```

no longer crashes.

---

## Step 7 — Database

Only after the above succeeds should the code reach:

```js
await req.prisma.$transaction(...)
```

At that point, any remaining error will be a separate business/database issue.

---

# 22. Test Cases

The fix is not complete until these cases work.

## Test A — Normal create

Payload:

```json
{
  "name": "Hifz",
  "section": "A",
  "code": "HIFZ-A",
  "capacity": 40,
  "teacher": "Maulana Zubair"
}
```

Expected:

```text
Class created successfully
```

---

## Test B — Missing body

Send:

```http
POST /api/classes
Content-Type: application/json
```

with no body.

Expected:

```json
{
  "success": false,
  "code": "INVALID_REQUEST_BODY",
  "message": "Request body must be a valid JSON object"
}
```

The server must **not crash**.

---

## Test C — Empty JSON object

Send:

```json
{}
```

Expected validation error:

```text
Class name is required
```

or another first validation error.

It must not throw a JavaScript TypeError.

---

## Test D — Invalid JSON

Send malformed JSON.

Expected:

- Express rejects/parses the request as an HTTP error.
- No route-level `TypeError`.
- No database operation.

---

## Test E — Missing Content-Type

This should be handled deliberately.

The frontend must always send:

```http
Content-Type: application/json
```

for JSON requests.

The backend should not depend on accidental browser behavior.

---

## Test F — Existing class code

Use an already-existing code.

Expected:

```text
409
CLASS_CODE_EXISTS
```

The request-body fix must not change this behavior.

---

# 23. Recommended Error Contract

The final API behavior should distinguish errors.

### Invalid HTTP body

```json
{
  "success": false,
  "code": "INVALID_REQUEST_BODY",
  "message": "Request body must be a valid JSON object"
}
```

### Invalid class fields

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Class name is required"
}
```

### Duplicate class code

```json
{
  "success": false,
  "code": "CLASS_CODE_EXISTS",
  "message": "Class with code \"HIFZ-A\" already exists"
}
```

### Unexpected server error

```json
{
  "success": false,
  "code": "INTERNAL_ERROR",
  "message": "An unexpected server error occurred"
}
```

This keeps transport, validation, business, and infrastructure failures distinguishable.

---

# 24. What NOT to Do

Do not:

### 1. Disable validation

```js
// Don't remove validateClassPayload()
```

### 2. Put database logic into `Courses.jsx`

The frontend should only construct and submit the payload.

### 3. Hardcode an AcademicYear in the frontend

The backend remains responsible for resolving the active year.

### 4. Create a second API helper

Fix the centralized `apiCall()`.

### 5. Hide `req.body === undefined`

Do not silently convert it into a fake payload.

### 6. Catch the TypeError and return 500

The correct response should identify invalid request structure.

### 7. Modify Prisma to solve this error

No schema change is required for this particular failure.

---

# 25. Definition of Done

The fix is complete only when all of these are true:

- [ ] `Courses.jsx` sends a plain JavaScript payload object.
- [ ] `createClass()` receives that object.
- [ ] `createClass()` serializes it exactly once.
- [ ] `apiCall()` preserves `options.body`.
- [ ] `apiCall()` sets `Content-Type: application/json`.
- [ ] `express.json()` executes before `/api/classes`.
- [ ] `req.body` is populated.
- [ ] `validateClassPayload()` cannot crash on undefined input.
- [ ] `/api/classes` explicitly rejects malformed/missing body.
- [ ] Valid payload reaches the transaction.
- [ ] Existing tenant/AcademicYear/class/teacher logic remains intact.
- [ ] Missing body returns a controlled error.
- [ ] Empty object returns a validation error.
- [ ] Duplicate class code still returns 409.
- [ ] No database record is created for invalid requests.

---

# 26. Final Architecture

After implementation, the robust request boundary should be:

```text
                 FRONTEND
                     │
                     ▼
             Courses.jsx
                     │
             plain JS object
                     │
                     ▼
              createClass()
                     │
             JSON.stringify()
                     │
                     ▼
                apiCall()
                     │
          Content-Type: JSON
                     │
                     ▼
                  fetch()
                     │
════════════════════════════════════
                 HTTP
════════════════════════════════════
                     │
                     ▼
             express.json()
                     │
                     ▼
                 req.body
                     │
                     ▼
          Request-body guard
                     │
                     ▼
        validateClassPayload()
                     │
                     ▼
          validation.data
                     │
                     ▼
              permission/
             module/context
                     │
                     ▼
              $transaction
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
     AcademicYear  Class     Teacher
          │          │          │
          └──────────┼──────────┘
                     ▼
              ClassTeacher
                     │
                     ▼
                 AuditLog
                     │
                     ▼
               API Response
```

This is the correct boundary to establish before investigating any further Class/AcademicYear/relationship issues.

---

# 27. Priority Order

Implement in this order:

### P0 — Must fix

1. `src/services/api.js`
   - preserve request body
   - set JSON Content-Type

2. `server/index.js`
   - ensure `express.json()` is before API routes

3. `server/src/validators/classValidator.js`
   - defensive `body = {}`

4. `server/src/routes/classRoutes.js`
   - explicit invalid-body guard

### P1 — Verify

5. `src/pages/Courses.jsx`
   - verify payload is a plain object
   - verify no double serialization

### P2 — Test

6. Normal Class creation
7. Empty body
8. Missing body
9. Invalid JSON
10. Duplicate class code
11. Tenant/AcademicYear behavior

Only after P0/P1/P2 pass should further Class relationship hardening be resumed.
