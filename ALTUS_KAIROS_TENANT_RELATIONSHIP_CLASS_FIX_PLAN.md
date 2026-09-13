# ALTUS KAIROS — DEEP INTEGRITY AUDIT & PHASE 2B FIX PLAN
## Tenant Isolation, Class Creation Failure, Relationship Integrity, and Exact Code Changes

**Source audited:** `madrasa-management-system-main(1).zip`  
**Purpose:** Fix the current post-Phase-2A codebase before moving to Enrollment concurrency and Attendance calendar work.  
**Important:** This document is based on the actual uploaded code, not only the Phase 2A walkthrough.

---

# 0. EXECUTIVE SUMMARY

Phase 2A added the correct *middleware-level* concepts:

- institution context
- backend RBAC
- module enforcement
- frontend route protection
- institution-scoped AcademicYear schema
- institution-scoped CustomField schema

However, the codebase is currently in a **partially migrated state**:

1. The schema became tenant-aware, but many queries are still global.
2. Some code still uses Prisma APIs that are no longer valid after changing unique constraints.
3. Several create/update flows can connect records from different institutions.
4. The seed/migration scripts were not fully updated for the new required `AcademicYear.institutionId`.
5. Class creation depends on a current AcademicYear, but the frontend does not send an academicYearId and the backend resolves the current year globally.
6. There is currently no proper AcademicYear management flow in the visible application.
7. Historical relationships can still be destroyed through hard-delete/cascade paths.
8. Student itself has no direct institution ownership, which makes un-enrolled students ambiguous in a multi-tenant system.

**Do not start Phase 2C until the fixes in this document are complete and verified.**

---

# 1. WHY “ADD CLASS” CAN FAIL RIGHT NOW

The current frontend sends:

```js
const payload = {
  ...formData,
  capacity: Number(formData.capacity),
};

await createClass(payload);
```

`formData` contains:

```js
{
  name,
  section,
  code,
  teacher,
  capacity
}
```

It does **not** contain `academicYearId`.

Therefore the backend must automatically resolve a current academic year.

Current backend code in:

`server/src/routes/classRoutes.js` around line 205:

```js
if (!academicYearId) {
  const activeYear = await tx.academicYear.findFirst({
    where: { isCurrent: true }
  });

  if (!activeYear) {
    throw new AppError(
      'An active academic year must be configured before creating a class.',
      409,
      'ACTIVE_ACADEMIC_YEAR_REQUIRED'
    );
  }

  academicYearId = activeYear.id;
}
```

There are multiple problems here.

---

## 1.1 Most likely failure: no current AcademicYear exists after the schema migration

The application has no visible AcademicYear CRUD route/page.

So class creation assumes that some current academic year already exists in the database.

If it does not, every class create request fails with:

```text
409 ACTIVE_ACADEMIC_YEAR_REQUIRED
```

### Why this became especially likely after Phase 2A

The schema changed from a globally unique AcademicYear name to:

```prisma
@@unique([institutionId, name])
```

but `server/src/seed.js` was **not updated correctly**.

Current broken seed code:

```js
const academicYear = await prisma.academicYear.upsert({
  where: { name: '2025-2026' },
  update: { isCurrent: true, institutionId: institution.id },
  create: {
    ...
  },
});
```

`name` is no longer a unique selector.

After regenerating Prisma Client, the correct unique selector is the composite key:

```js
institutionId_name
```

### FIX

Replace the AcademicYear seed block with:

```js
const academicYear = await prisma.academicYear.upsert({
  where: {
    institutionId_name: {
      institutionId: institution.id,
      name: '2025-2026',
    },
  },
  update: {
    isCurrent: true,
    status: 'ACTIVE',
    startDate: new Date('2025-06-01T00:00:00.000Z'),
    endDate: new Date('2026-05-31T23:59:59.999Z'),
  },
  create: {
    institutionId: institution.id,
    name: '2025-2026',
    startDate: new Date('2025-06-01T00:00:00.000Z'),
    endDate: new Date('2026-05-31T23:59:59.999Z'),
    isCurrent: true,
    status: 'ACTIVE',
  },
});
```

File:

```text
server/src/seed.js
```

---

## 1.2 The old academic migration script is now invalid

File:

```text
server/src/scripts/migrate_academic_architecture.js
```

currently creates an AcademicYear without the now-required:

```text
institutionId
```

Example current pattern:

```js
academicYear = await prisma.academicYear.create({
  data: {
    name: '2025-2026',
    startDate: ...,
    endDate: ...,
    isCurrent: true,
  },
});
```

This no longer satisfies the schema.

### FIX

Do not keep this script as a generic global migration.

It must first resolve a specific institution.

Example:

```js
const institution = await prisma.institution.findUnique({
  where: { code: 'ALTUS-MAIN' },
});

if (!institution) {
  throw new Error('Target institution not found');
}

let academicYear = await prisma.academicYear.findUnique({
  where: {
    institutionId_name: {
      institutionId: institution.id,
      name: '2025-2026',
    },
  },
});

if (!academicYear) {
  academicYear = await prisma.academicYear.create({
    data: {
      institutionId: institution.id,
      name: '2025-2026',
      startDate: new Date('2025-06-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T23:59:59.999Z'),
      isCurrent: true,
      status: 'ACTIVE',
    },
  });
}
```

Do not run a global backfill over multiple institutions without an explicit institution mapping strategy.

---

## 1.3 Current class creation resolves the year globally instead of for the current institution

Current code:

```js
tx.academicYear.findFirst({
  where: { isCurrent: true }
});
```

This means Institution A may accidentally use Institution B's current year.

Even if this does not block creation, it can create a **cross-tenant class relationship**.

### REQUIRED FIX

Create:

```text
server/src/services/academicYearService.js
```

with:

```js
const AppError = require('../utils/AppError');

async function getCurrentAcademicYear(prisma, institutionId) {
  if (!institutionId) {
    throw new AppError(
      'Institution context is required',
      401,
      'INSTITUTION_CONTEXT_REQUIRED'
    );
  }

  const years = await prisma.academicYear.findMany({
    where: {
      institutionId,
      isCurrent: true,
      status: 'ACTIVE',
    },
    take: 2,
    orderBy: { startDate: 'desc' },
  });

  if (years.length === 0) {
    throw new AppError(
      'No current academic year is configured for this institution.',
      409,
      'ACTIVE_ACADEMIC_YEAR_REQUIRED'
    );
  }

  if (years.length > 1) {
    throw new AppError(
      'Data integrity conflict: multiple current academic years exist for this institution.',
      409,
      'MULTIPLE_CURRENT_ACADEMIC_YEARS'
    );
  }

  return years[0];
}

async function getAcademicYearForInstitution(prisma, institutionId, academicYearId) {
  const year = await prisma.academicYear.findFirst({
    where: {
      id: academicYearId,
      institutionId,
    },
  });

  if (!year) {
    throw new AppError(
      'Academic year not found for the current institution.',
      404,
      'ACADEMIC_YEAR_NOT_FOUND'
    );
  }

  return year;
}

module.exports = {
  getCurrentAcademicYear,
  getAcademicYearForInstitution,
};
```

Then in `classRoutes.js`:

```js
const {
  getCurrentAcademicYear,
  getAcademicYearForInstitution,
} = require('../services/academicYearService');
```

Replace:

```js
const activeYear = await tx.academicYear.findFirst({
  where: { isCurrent: true }
});
```

with:

```js
const activeYear = await getCurrentAcademicYear(
  tx,
  req.institutionId
);
```

Replace:

```js
const specifiedYear = await tx.academicYear.findUnique({
  where: { id: academicYearId }
});
```

with:

```js
const specifiedYear = await getAcademicYearForInstitution(
  tx,
  req.institutionId,
  academicYearId
);
```

---

## 1.4 Class code is globally unique even though classes belong to an AcademicYear

Current schema:

```prisma
code String @unique
```

This prevents using the same logical code in another academic year.

For example:

```text
2025-2026 → CLS-08-A
2026-2027 → CLS-08-A
```

should normally be allowed.

### RECOMMENDED FIX

Change:

```prisma
code String @unique
```

to:

```prisma
code String
```

and add:

```prisma
@@unique([academicYearId, code])
```

inside `model Class`.

Then change duplicate lookup from:

```js
const existing = await tx.class.findUnique({
  where: { code }
});
```

to:

```js
const existing = await tx.class.findUnique({
  where: {
    academicYearId_code: {
      academicYearId,
      code,
    },
  },
});
```

On update:

```js
const duplicate = await tx.class.findFirst({
  where: {
    academicYearId,
    code,
    NOT: { id: req.params.id },
  },
});
```

This also prevents one institution from blocking another institution's class code indirectly.

---

# 2. IMMEDIATE CLASS CREATION FIX — FULL RECOMMENDED POST HANDLER

Replace the core create logic in:

```text
server/src/routes/classRoutes.js
```

with the following structure:

```js
const {
  getCurrentAcademicYear,
  getAcademicYearForInstitution,
} = require('../services/academicYearService');

router.post(
  '/',
  requirePermission('courses.manage'),
  async (req, res, next) => {
    try {
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

      const newClass = await req.prisma.$transaction(async (tx) => {
        const academicYear = academicYearId
          ? await getAcademicYearForInstitution(
              tx,
              req.institutionId,
              academicYearId
            )
          : await getCurrentAcademicYear(
              tx,
              req.institutionId
            );

        academicYearId = academicYear.id;

        if (academicYear.status !== 'ACTIVE') {
          throw new AppError(
            'Classes can only be created in an active academic year.',
            409,
            'ACADEMIC_YEAR_NOT_ACTIVE'
          );
        }

        const duplicate = await tx.class.findFirst({
          where: {
            academicYearId,
            code,
          },
        });

        if (duplicate) {
          throw new AppError(
            `Class code "${code}" already exists in this academic year`,
            409,
            'CLASS_CODE_EXISTS'
          );
        }

        const created = await tx.class.create({
          data: {
            name,
            section,
            code,
            capacity,
            teacher,
            academicYearId,
            status: 'ACTIVE',
          },
        });

        if (teacher && teacher.trim()) {
          const teacherName = teacher.trim();

          let teacherRecord = await tx.teacher.findFirst({
            where: {
              institutionId: req.institutionId,
              name: teacherName,
              isActive: true,
            },
          });

          if (!teacherRecord) {
            teacherRecord = await tx.teacher.create({
              data: {
                institutionId: req.institutionId,
                name: teacherName,
                isActive: true,
              },
            });
          }

          await tx.classTeacher.upsert({
            where: {
              classId_teacherId: {
                classId: created.id,
                teacherId: teacherRecord.id,
              },
            },
            update: {
              role: 'Main Teacher',
            },
            create: {
              classId: created.id,
              teacherId: teacherRecord.id,
              role: 'Main Teacher',
            },
          });
        }

        await auditService.record(tx, {
          institutionId: req.institutionId,
          action: 'CLASS_CREATED',
          entityType: 'Class',
          entityId: created.id,
          afterData: created,
        });

        return created;
      });

      res.status(201).json({
        success: true,
        data: newClass,
      });
    } catch (error) {
      next(error);
    }
  }
);
```

---

# 3. CLASS LIST / GET / UPDATE / STATUS / DELETE ARE NOT TENANT SAFE

`router.use(requireInstitutionContext)` only creates:

```text
req.institutionId
```

It does not automatically scope Prisma.

Current list query:

```js
req.prisma.class.findMany({
  where,
});
```

can return classes from other institutions.

## FIX: add institution scope to `buildClassWhere`

Change signature:

```js
const buildClassWhere = ({
  search,
  status,
  academicYearId,
  institutionId,
}) => {
```

Initialize:

```js
const where = {
  academicYear: {
    institutionId,
  },
};
```

Call:

```js
const where = buildClassWhere({
  search,
  status,
  academicYearId,
  institutionId: req.institutionId,
});
```

---

## Single class GET

Do not use:

```js
class.findUnique({
  where: { id }
})
```

when tenant ownership is required.

Use:

```js
const classRecord = await req.prisma.class.findFirst({
  where: {
    id: req.params.id,
    academicYear: {
      institutionId: req.institutionId,
    },
  },
  include: {
    academicYear: true,
    teachers: {
      include: { teacher: true },
    },
    _count: {
      select: {
        students: true,
        enrollments: {
          where: { status: 'ACTIVE' },
        },
        teachers: true,
        subjects: true,
      },
    },
  },
});
```

Apply the same tenant filter to:

- PUT
- PATCH status
- DELETE

---

# 4. TEACHER RELATIONSHIP IS NOT PROPERLY MAINTAINED

Current class create/update:

```js
let t = await tx.teacher.findFirst({
  where: { name: teacher.trim() }
});

if (!t) {
  t = await tx.teacher.create({
    data: {
      name: teacher.trim(),
      isActive: true
    }
  });
}
```

Problems:

1. Teacher lookup is global.
2. New teacher is created with `institutionId = null`.
3. A teacher from Institution B can be assigned to a class from Institution A.
4. The legacy `Class.teacher` string duplicates the normalized ClassTeacher relationship.

## REQUIRED FIX

At minimum:

```js
let t = await tx.teacher.findFirst({
  where: {
    institutionId: req.institutionId,
    name: teacher.trim(),
    isActive: true,
  },
});

if (!t) {
  t = await tx.teacher.create({
    data: {
      institutionId: req.institutionId,
      name: teacher.trim(),
      isActive: true,
    },
  });
}
```

---

## Recommended schema hardening

Current:

```prisma
model Teacher {
  institutionId String?
  email         String? @unique
}
```

Recommended:

```prisma
model Teacher {
  id            String  @id @default(cuid())
  institutionId String
  name          String
  email         String?
  phone         String?
  isActive      Boolean @default(true)

  institution Institution @relation(
    fields: [institutionId],
    references: [id],
    onDelete: Restrict
  )

  classes ClassTeacher[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([institutionId, email])
  @@index([institutionId, name])
  @@map("teachers")
}
```

If teachers truly can be global/shared across institutions, document that explicitly and implement global + institution-specific lookup semantics. Do not keep nullable ownership accidentally.

For the current ERP architecture, **institution-owned Teacher is recommended**.

---

# 5. SUBJECT RELATIONSHIP HAS THE SAME PROBLEM

Current:

```prisma
institutionId String?
code          String @unique
```

Recommended:

```prisma
institutionId String
code          String

@@unique([institutionId, code])
```

and:

```prisma
institution Institution @relation(
  fields: [institutionId],
  references: [id],
  onDelete: Restrict
)
```

When assigning a Subject to Class, verify:

```text
Class → AcademicYear → institutionId
Subject → institutionId
```

must match.

Pseudo-code:

```js
const subject = await tx.subject.findFirst({
  where: {
    id: subjectId,
    institutionId: req.institutionId,
  },
});

if (!subject) {
  throw new AppError(
    'Subject not found for the current institution',
    404,
    'SUBJECT_NOT_FOUND'
  );
}
```

---

# 6. STUDENT HAS NO DIRECT INSTITUTION OWNERSHIP

Current Student:

```prisma
model Student {
  id          String @id @default(cuid())
  admissionNo String @unique
  ...
  classId     String?
}
```

There is no:

```text
institutionId
```

A student with no current enrollment therefore has no unambiguous tenant owner.

This is a serious multi-tenant design problem.

## RECOMMENDED FIX

Add:

```prisma
institutionId String
institution   Institution @relation(
  fields: [institutionId],
  references: [id],
  onDelete: Restrict
)
```

to Student.

Institution model:

```prisma
students Student[]
```

Then replace:

```prisma
admissionNo String @unique
```

with:

```prisma
admissionNo String
@@unique([institutionId, admissionNo])
```

Recommended Student core:

```prisma
model Student {
  id            String   @id @default(cuid())
  institutionId String
  admissionNo   String
  firstName     String
  lastName      String
  ...

  institution Institution @relation(
    fields: [institutionId],
    references: [id],
    onDelete: Restrict
  )

  classId String?
  class   Class? @relation(fields: [classId], references: [id])

  attendances       Attendance[]
  results           Result[]
  customFieldValues CustomFieldValue[]
  enrollments       Enrollment[]

  @@unique([institutionId, admissionNo])
  @@index([institutionId, status])
  @@map("students")
}
```

---

# 7. STUDENT ROUTES MUST BECOME TENANT-SCOPED

Current code repeatedly uses:

```js
student.findUnique({
  where: { id }
});
```

and:

```js
student.findUnique({
  where: { admissionNo }
});
```

After adding Student.institutionId, use:

```js
const student = await prisma.student.findFirst({
  where: {
    id: studentId,
    institutionId,
  },
});
```

Admission number lookup:

```js
const existing = await prisma.student.findUnique({
  where: {
    institutionId_admissionNo: {
      institutionId: req.institutionId,
      admissionNo,
    },
  },
});
```

Student creation:

```js
const createdStudent = await tx.student.create({
  data: {
    institutionId: req.institutionId,
    admissionNo,
    firstName,
    lastName,
    ...
  },
});
```

---

# 8. ACTIVE ACADEMIC YEAR LOOKUPS IN STUDENT ROUTES ARE GLOBAL

Current helper:

```js
async function resolveActiveAcademicYear(tx) {
  const activeYear = await tx.academicYear.findFirst({
    where: { isCurrent: true }
  });
  ...
}
```

Change signature:

```js
async function resolveActiveAcademicYear(tx, institutionId) {
```

and query:

```js
const activeYears = await tx.academicYear.findMany({
  where: {
    institutionId,
    isCurrent: true,
    status: 'ACTIVE',
  },
  take: 2,
});

if (activeYears.length === 0) {
  throw new AppError(
    'No active academic year found for this institution',
    409,
    'NO_ACTIVE_ACADEMIC_YEAR'
  );
}

if (activeYears.length > 1) {
  throw new AppError(
    'Multiple current academic years exist for this institution',
    409,
    'MULTIPLE_CURRENT_ACADEMIC_YEARS'
  );
}

return activeYears[0];
```

Call:

```js
const activeAcademicYear = await resolveActiveAcademicYear(
  tx,
  req.institutionId
);
```

Do this everywhere in:

```text
server/src/routes/studentRoutes.js
server/src/routes/classRoutes.js
server/src/routes/importRoutes.js
server/src/services/enrollmentService.js
```

---

# 9. `validateAndLockTargetClass` CAN LOCK A CLASS FROM ANOTHER INSTITUTION

Current raw SQL:

```js
SELECT id, status, "academicYearId", capacity
FROM "classes"
WHERE id = ${targetClassId}
FOR UPDATE
```

It only checks class ID.

Then it compares academicYearId, but the active academic year itself is globally resolved.

## FIX

Because AcademicYear belongs to Institution, verify after the lock:

```js
const targetClasses = await tx.$queryRaw`
  SELECT
    c.id,
    c.status,
    c."academicYearId",
    c.capacity,
    ay."institutionId"
  FROM "classes" c
  JOIN "academic_years" ay
    ON ay.id = c."academicYearId"
  WHERE c.id = ${targetClassId}
  FOR UPDATE OF c
`;

const targetClass = targetClasses[0];

if (!targetClass) {
  throw new AppError(
    'Target class not found',
    404,
    'CLASS_NOT_FOUND'
  );
}

if (targetClass.institutionId !== institutionId) {
  throw new AppError(
    'Target class not found',
    404,
    'CLASS_NOT_FOUND'
  );
}
```

Change helper signature:

```js
validateAndLockTargetClass(
  tx,
  targetClassId,
  activeAcademicYearId,
  institutionId
)
```

Do not return a 403 revealing another institution's resource. A 404 is safer for cross-tenant IDs.

---

# 10. CUSTOM FIELD IMPLEMENTATION IS CURRENTLY BROKEN AFTER PHASE 2A SCHEMA CHANGE

Schema now requires:

```prisma
institutionId String
@@unique([institutionId, fieldKey])
```

but `customFieldRoutes.js` still does:

```js
findUnique({
  where: { fieldKey }
})
```

`fieldKey` is no longer globally unique.

It also creates:

```js
customField.create({
  data: {
    name,
    fieldKey,
    ...
  }
})
```

without required `institutionId`.

This can fail at runtime.

## FIX — GET

Current:

```js
const where = {};
```

Replace:

```js
const where = {
  institutionId: req.institutionId,
};

if (activeOnly === 'true') {
  where.isActive = true;
}
```

---

## FIX — uniqueness check

Replace:

```js
const existing = await req.prisma.customField.findUnique({
  where: { fieldKey }
});
```

with:

```js
const existing = await req.prisma.customField.findUnique({
  where: {
    institutionId_fieldKey: {
      institutionId: req.institutionId,
      fieldKey,
    },
  },
});
```

If a suffix is generated, loop until unique rather than assuming timestamp collision is impossible.

---

## FIX — create

Add:

```js
institutionId: req.institutionId,
```

Example:

```js
const field = await req.prisma.customField.create({
  data: {
    institutionId: req.institutionId,
    name,
    fieldKey,
    fieldType,
    options: options ? JSON.stringify(options) : null,
    placeholder: placeholder || null,
    isRequired: Boolean(isRequired),
    section: section || 'custom',
    sortOrder: (maxSort._max.sortOrder || 0) + 1,
  },
});
```

---

## FIX — max sort order must be tenant-scoped

Current:

```js
customField.aggregate({
  _max: { sortOrder: true }
});
```

Replace:

```js
customField.aggregate({
  where: {
    institutionId: req.institutionId,
  },
  _max: {
    sortOrder: true,
  },
});
```

---

## FIX — update/delete/reorder ownership

Before update/delete:

```js
const existing = await req.prisma.customField.findFirst({
  where: {
    id: req.params.id,
    institutionId: req.institutionId,
  },
});
```

For reorder, never blindly update arbitrary IDs.

Validate all IDs belong to the current institution first:

```js
const ids = items.map(item => item.id);

const ownedFields = await req.prisma.customField.findMany({
  where: {
    institutionId: req.institutionId,
    id: { in: ids },
  },
  select: { id: true },
});

if (ownedFields.length !== ids.length) {
  throw new AppError(
    'One or more custom fields do not belong to this institution',
    404,
    'CUSTOM_FIELD_NOT_FOUND'
  );
}
```

---

# 11. `saveCustomFieldValues()` IS CROSS-TENANT UNSAFE

Current:

```js
const fieldDefs = await prisma.customField.findMany({
  where: { isActive: true },
});
```

This loads every institution's active custom fields.

Change helper signature:

```js
async function saveCustomFieldValues(
  prisma,
  institutionId,
  studentId,
  customFields
)
```

Query:

```js
const fieldDefs = await prisma.customField.findMany({
  where: {
    institutionId,
    isActive: true,
  },
});
```

Call:

```js
await saveCustomFieldValues(
  req.prisma,
  req.institutionId,
  newStudent.id,
  customFields
);
```

and same for update.

---

# 12. EXPORT IS CURRENTLY A HIGH-RISK TENANT LEAK

Files:

```text
server/src/routes/exportRoutes.js
```

Current examples:

```js
customField.findMany({
  where: { isActive: true }
});
```

and:

```js
student.findMany({
  where
});
```

No institution boundary.

## FIX

After adding `Student.institutionId`, base student where must include:

```js
const where = {
  institutionId: req.institutionId,
  ...otherFilters,
};
```

Custom fields:

```js
const customFields = await req.prisma.customField.findMany({
  where: {
    institutionId: req.institutionId,
    isActive: true,
  },
  orderBy: { sortOrder: 'asc' },
});
```

Any class filter must verify class ownership:

```js
const classRecord = await req.prisma.class.findFirst({
  where: {
    id: classId,
    academicYear: {
      institutionId: req.institutionId,
    },
  },
});

if (!classRecord) {
  throw new AppError(
    'Class not found',
    404,
    'CLASS_NOT_FOUND'
  );
}
```

---

# 13. IMPORT IS CURRENTLY CROSS-TENANT UNSAFE

Current code loads:

```js
const students = await req.prisma.student.findMany(...)
const classes = await req.prisma.class.findMany(...)
```

globally.

## FIX

Students:

```js
const students = await req.prisma.student.findMany({
  where: {
    institutionId: req.institutionId,
  },
  select: {
    admissionNo: true,
  },
});
```

Classes:

```js
const classes = await req.prisma.class.findMany({
  where: {
    academicYear: {
      institutionId: req.institutionId,
    },
  },
  select: {
    id: true,
    code: true,
    academicYearId: true,
  },
});
```

Current academic year:

```js
const activeAcademicYear = await getCurrentAcademicYear(
  req.prisma,
  req.institutionId
);
```

When creating a Student during import:

```js
data: {
  institutionId: req.institutionId,
  ...
}
```

---

# 14. ENROLLMENT RELATIONSHIPS — WHAT IS GOOD AND WHAT IS NOT

Current authoritative structure:

```text
Student
  ↓
Enrollment
  ↓
Class
  ↓
AcademicYear
  ↓
Institution
```

This is conceptually correct.

However, Enrollment contains:

```text
studentId
classId
academicYearId
```

The database does not itself guarantee:

```text
Enrollment.academicYearId === Enrollment.class.academicYearId
```

The service checks this in some flows, but direct creates elsewhere can bypass it.

## RULE

All Enrollment creation must go through one canonical domain service.

Do not allow routes/import scripts to independently implement enrollment rules.

Target:

```text
Route
  ↓
EnrollmentService
  ↓
locked class + tenant validation
  ↓
uniqueness validation
  ↓
capacity validation
  ↓
create Enrollment
  ↓
sync Student.classId legacy field
```

---

# 15. `getActiveEnrollment()` SILENTLY HIDES DATA CORRUPTION

Current:

```js
return tx.enrollment.findFirst({
  where: {
    studentId,
    academicYearId,
    status: 'ACTIVE',
  },
});
```

If two active enrollments exist, it silently picks one.

Until the database constraint is introduced, use:

```js
async function getActiveEnrollment(
  tx,
  studentId,
  academicYearId
) {
  const active = await tx.enrollment.findMany({
    where: {
      studentId,
      academicYearId,
      status: 'ACTIVE',
    },
    include: {
      class: true,
      academicYear: true,
    },
    take: 2,
  });

  if (active.length > 1) {
    throw new AppError(
      'Data integrity conflict: multiple ACTIVE enrollments exist for the student in the same academic year.',
      409,
      'MULTIPLE_ACTIVE_ENROLLMENTS'
    );
  }

  return active[0] || null;
}
```

The DB-level uniqueness constraint belongs to the following enrollment hardening phase, but corruption detection should be consistent now.

---

# 16. ENROLLMENT SERVICE ALSO NEEDS TENANT CONTEXT

Current functions receive:

```text
studentId
classId
academicYearId
```

but not institutionId.

Recommended function signature:

```js
async function enrollStudent(
  tx,
  {
    institutionId,
    studentId,
    classId,
    academicYearId = null,
    ...
  }
)
```

Student query:

```js
const student = await tx.student.findFirst({
  where: {
    id: studentId,
    institutionId,
  },
});
```

Class query:

```js
const classRecord = await tx.class.findFirst({
  where: {
    id: classId,
    academicYear: {
      institutionId,
    },
  },
  include: {
    academicYear: true,
  },
});
```

Never derive authorization solely from a caller-supplied class ID.

---

# 17. ATTENDANCE RELATIONSHIP IS BETTER, BUT TENANT VALIDATION IS STILL MISSING

Good part:

Attendance now stores:

```text
studentId
classId
enrollmentId
```

and attendance marking resolves an effective Enrollment.

That is the correct historical direction.

However, functions such as:

```js
class.findUnique({
  where: { id: classId }
})
```

must validate:

```text
class.academicYear.institutionId === req.institutionId
```

Recommended service signature:

```js
getDailyAttendance(prisma, {
  institutionId,
  classId,
  date,
})
```

and:

```js
const classRecord = await prisma.class.findFirst({
  where: {
    id: classId,
    academicYear: {
      institutionId,
    },
  },
  include: {
    academicYear: true,
  },
});
```

Apply equivalent institution scope to:

- daily attendance
- mark attendance
- attendance stats
- attendance report
- student attendance history

---

# 18. ATTENDANCE RELATIONAL INVARIANTS

Every Attendance row should satisfy:

```text
Attendance.studentId
    ==
Enrollment.studentId

Attendance.classId
    ==
Enrollment.classId

Attendance date
    falls inside enrollment effective period

Enrollment.academicYearId
    ==
Class.academicYearId
```

New marking code mostly enforces these logically.

Historical rows with:

```text
enrollmentId = null
```

remain transitional.

Do not make `enrollmentId` required until a safe backfill verifies all historical rows.

---

# 19. CLASS TEACHER RELATIONSHIP HAS DUPLICATED STATE

Current Class stores:

```prisma
teacher String?
teachers ClassTeacher[]
```

This means teacher identity exists both as:

```text
Class.teacher string
```

and:

```text
ClassTeacher → Teacher
```

This can drift.

Example:

```text
Class.teacher = "Ahmed"
ClassTeacher → "Yusuf"
```

## RECOMMENDATION

Short term:

- keep `Class.teacher` only as a compatibility/display cache
- always update it together with the Main Teacher relation
- read normalized ClassTeacher first

Long term:

- remove `Class.teacher`
- use `ClassTeacher` as authoritative

When teacher is cleared during class update, current code does not remove the old Main Teacher assignment.

This is a relationship bug.

### FIX

If incoming teacher is empty/null:

```js
await tx.classTeacher.deleteMany({
  where: {
    classId: updated.id,
    role: 'Main Teacher',
  },
});
```

If teacher changes, also ensure the previous Main Teacher link is removed before/updating the new one:

```js
await tx.classTeacher.deleteMany({
  where: {
    classId: updated.id,
    role: 'Main Teacher',
  },
});

await tx.classTeacher.create({
  data: {
    classId: updated.id,
    teacherId: t.id,
    role: 'Main Teacher',
  },
});
```

Because the unique key is `[classId, teacherId]`, merely upserting a new teacher does not remove an old teacher assignment.

---

# 20. CLASS SUBJECT RELATIONSHIP NEEDS SAME-INSTITUTION VALIDATION

`ClassSubject` has:

```text
classId
subjectId
```

but no direct constraint that both belong to the same institution.

Every create/update of ClassSubject must verify both sides.

Conceptually:

```js
const classRecord = await tx.class.findFirst({
  where: {
    id: classId,
    academicYear: {
      institutionId,
    },
  },
});

const subject = await tx.subject.findFirst({
  where: {
    id: subjectId,
    institutionId,
  },
});

if (!classRecord || !subject) {
  throw new AppError(
    'Class or subject not found',
    404,
    'RESOURCE_NOT_FOUND'
  );
}
```

---

# 21. RESULT RELATIONSHIP CAN CROSS INSTITUTIONS

Result currently joins:

```text
Exam
Student
```

but the database does not ensure:

```text
Exam.class.institution
==
Student.institution
```

Before creating Result:

```js
const exam = await tx.exam.findFirst({
  where: {
    id: examId,
    class: {
      academicYear: {
        institutionId,
      },
    },
  },
});

const student = await tx.student.findFirst({
  where: {
    id: studentId,
    institutionId,
  },
});
```

Additionally verify the student was enrolled in the exam's class/year as required by product rules.

---

# 22. DELETE / CASCADE POLICY IS TOO DESTRUCTIVE FOR AN ERP

Current Student relations include cascades through:

- Enrollment
- Attendance
- Result
- CustomFieldValue

`DELETE /api/students/:id` currently hard deletes the student.

For an ERP with historical integrity, hard deletion of a student can destroy:

```text
enrollment history
attendance history
results
custom field values
```

This is not acceptable for normal business deletion.

## REQUIRED PRODUCT RULE

Normal “delete student” should become archive/deactivate.

Example:

```js
await req.prisma.student.update({
  where: {
    id: req.params.id,
  },
  data: {
    status: 'INACTIVE',
  },
});
```

If the student has an active Enrollment, use the canonical withdrawal flow.

Reserve physical deletion for:

- test records
- mistaken records with no historical dependencies
- privileged maintenance procedure

---

# 23. ACADEMIC YEAR DELETE MUST NOT CASCADE HISTORICAL ENROLLMENTS

Current Enrollment:

```prisma
academicYear AcademicYear @relation(
  fields: [academicYearId],
  references: [id],
  onDelete: Cascade
)
```

Deleting an AcademicYear can delete Enrollment history.

Recommended:

```prisma
onDelete: Restrict
```

Similarly strongly consider `Restrict` for historical relationships where deletion would erase evidence.

---

# 24. ATTENDANCE CLASS DELETE CASCADE IS RISKY

Current:

```prisma
class Class @relation(
  fields: [classId],
  references: [id],
  onDelete: Cascade
)
```

Application-level class deletion archives when dependencies exist, which is good.

But DB-level direct delete could still erase attendance.

Recommended historical strategy:

```text
Class with any historical dependency → never physically delete
```

Use:

```prisma
onDelete: Restrict
```

for historical records where practical.

---

# 25. CUSTOM FIELD ERROR HANDLING BYPASSES CENTRAL `AppError`

`customFieldRoutes.js` uses manual:

```js
res.status(500).json(...)
```

instead of `next(error)`.

This creates inconsistent error behavior.

Refactor route handlers to:

```js
router.get('/', ..., async (req, res, next) => {
  try {
    ...
  } catch (error) {
    next(error);
  }
});
```

Use `AppError` for validation/business errors.

---

# 26. CONFIGURATION CONTRACT STILL MISSES `resultsEnabled`

Schema contains:

```prisma
resultsEnabled Boolean @default(false)
```

but:

```text
server/src/services/institutionConfigurationService.js
```

`CONFIG_KEYS` does not contain `resultsEnabled`.

Add:

```js
'resultsEnabled',
```

to `CONFIG_KEYS`.

Also verify frontend settings/context exposes the same key.

---

# 27. CURRENT ACADEMIC YEAR UNIQUENESS IS NOT DB-ENFORCED

The application assumes one current year per institution:

```text
institutionId + isCurrent = one record
```

but schema only has:

```prisma
@@unique([institutionId, name])
```

Two records can both have:

```text
isCurrent = true
```

for the same institution.

Prisma cannot directly model a partial unique index in the normal schema DSL.

Until a proper migration adds the PostgreSQL partial unique constraint, always detect:

```text
0 current years
1 current year
>1 current years → integrity conflict
```

Do not silently use `findFirst()`.

Eventually migration:

```sql
CREATE UNIQUE INDEX "unique_current_academic_year_per_institution"
ON "academic_years" ("institutionId")
WHERE "isCurrent" = true;
```

Do NOT execute this from application startup.

---

# 28. RECOMMENDED TENANT OWNERSHIP MODEL

Use the following architecture.

```text
Institution
│
├── InstitutionConfiguration
├── AcademicYear
│   └── Class
│       ├── ClassTeacher
│       ├── ClassSubject
│       ├── Exam
│       └── Enrollment
│           └── Attendance
│
├── Student
├── Teacher
├── Subject
├── CustomField
├── User
├── Role
└── AuditLog
```

### Direct institution ownership recommended for:

```text
AcademicYear
Student
Teacher
Subject
CustomField
User
Role
AuditLog
```

### Ownership derived through parent is acceptable for:

```text
Class → AcademicYear
Enrollment → Class/AcademicYear + Student
Attendance → Enrollment
Exam → Class
Result → Exam + Student
ClassTeacher → Class + Teacher
ClassSubject → Class + Subject
CustomFieldValue → CustomField + Student
```

But every cross-link must verify that both parent sides belong to the same institution.

---

# 29. PROPOSED SCHEMA PATCH

This is the target direction, not a blind copy/paste migration.

```prisma
model Institution {
  id          String @id @default(cuid())
  name        String
  code        String @unique
  ...

  configuration InstitutionConfiguration?
  academicYears AcademicYear[]
  students      Student[]
  teachers      Teacher[]
  subjects      Subject[]
  customFields  CustomField[]
  users         User[]
  roles         Role[]
  auditLogs     AuditLog[]
}

model AcademicYear {
  id            String @id @default(cuid())
  institutionId String
  name          String
  startDate     DateTime
  endDate       DateTime
  isCurrent     Boolean @default(false)
  status        String  @default("ACTIVE")

  institution Institution @relation(
    fields: [institutionId],
    references: [id],
    onDelete: Restrict
  )

  classes     Class[]
  enrollments Enrollment[]

  @@unique([institutionId, name])
  @@index([institutionId, isCurrent])
}

model Student {
  id            String @id @default(cuid())
  institutionId String
  admissionNo   String
  ...

  institution Institution @relation(
    fields: [institutionId],
    references: [id],
    onDelete: Restrict
  )

  classId String?
  class   Class? @relation(fields: [classId], references: [id])

  @@unique([institutionId, admissionNo])
  @@index([institutionId, status])
}

model Teacher {
  id            String @id @default(cuid())
  institutionId String
  name          String
  email         String?
  ...

  institution Institution @relation(
    fields: [institutionId],
    references: [id],
    onDelete: Restrict
  )

  @@unique([institutionId, email])
  @@index([institutionId, name])
}

model Subject {
  id            String @id @default(cuid())
  institutionId String
  name          String
  code          String
  ...

  institution Institution @relation(
    fields: [institutionId],
    references: [id],
    onDelete: Restrict
  )

  @@unique([institutionId, code])
}

model Class {
  id             String @id @default(cuid())
  name           String
  section        String?
  code           String
  ...
  academicYearId String
  academicYear   AcademicYear @relation(
    fields: [academicYearId],
    references: [id],
    onDelete: Restrict
  )

  @@unique([academicYearId, code])
  @@index([academicYearId, status])
}

model Enrollment {
  ...
  class Class @relation(
    fields: [classId],
    references: [id],
    onDelete: Restrict
  )

  academicYear AcademicYear @relation(
    fields: [academicYearId],
    references: [id],
    onDelete: Restrict
  )
}
```

Before making required nullable fields non-null in a real populated DB, perform a backfill and validation first.

---

# 30. SAFE BACKFILL ORDER

Do not immediately change optional tenant fields to required without data preparation.

Recommended order:

### Step A

Add Student.institutionId as nullable temporarily:

```prisma
institutionId String?
```

### Step B

Backfill students from authoritative enrollment/class/year.

Pseudo-code:

```js
const students = await prisma.student.findMany({
  include: {
    enrollments: {
      include: {
        academicYear: true,
      },
      orderBy: {
        enrollmentDate: 'desc',
      },
    },
  },
});

for (const student of students) {
  const institutionIds = [
    ...new Set(
      student.enrollments
        .map(e => e.academicYear?.institutionId)
        .filter(Boolean)
    ),
  ];

  if (institutionIds.length === 1) {
    await prisma.student.update({
      where: { id: student.id },
      data: { institutionId: institutionIds[0] },
    });
  } else if (institutionIds.length === 0) {
    // Must be resolved manually or by an explicit default-institution rule.
  } else {
    throw new Error(
      `Student ${student.id} has cross-institution enrollment history`
    );
  }
}
```

### Step C

Backfill Teacher from classes/classTeacher.

### Step D

Backfill Subject from class assignments.

### Step E

Verify no NULL ownership remains.

### Step F

Make fields required.

### Step G

Change unique constraints.

Do not silently assign ambiguous records to a random institution.

---

# 31. CLASS CREATION FRONTEND IMPROVEMENT

Even after backend fix, the frontend should surface the real server error.

Current `apiCall` already reads:

```js
data.message
```

which matches the centralized error handler.

Add special UX for missing academic year:

```js
catch (error) {
  console.error('Error saving class:', error);

  if (
    error.message
      ?.toLowerCase()
      .includes('academic year')
  ) {
    toast.error(
      'No active academic year is configured. Configure the current academic year before adding a class.'
    );
  } else {
    toast.error(
      error.message || 'Failed to save class'
    );
  }
}
```

Better long-term: return structured error codes from `apiCall`.

Example:

```js
if (!response.ok) {
  const error = new Error(
    data.message || `HTTP ${response.status}`
  );

  error.code = data.code;
  error.status = response.status;
  error.payload = data;

  throw error;
}
```

Then:

```js
if (error.code === 'ACTIVE_ACADEMIC_YEAR_REQUIRED') {
  ...
}
```

---

# 32. ADD A MINIMAL ACADEMIC YEAR API BEFORE DEPENDING ON HIDDEN DB STATE

Class creation should not depend forever on manually seeded DB state.

Create:

```text
server/src/routes/academicYearRoutes.js
```

Minimum endpoints:

```text
GET  /api/academic-years
POST /api/academic-years
PATCH /api/academic-years/:id/current
```

Permissions can initially use:

```text
settings.view
settings.manage
```

until dedicated academic-year permissions are introduced.

### GET

Tenant scope:

```js
const years = await req.prisma.academicYear.findMany({
  where: {
    institutionId: req.institutionId,
  },
  orderBy: {
    startDate: 'desc',
  },
});
```

### POST

Create with:

```js
institutionId: req.institutionId
```

### Mark current

Do it transactionally:

```js
await req.prisma.$transaction(async tx => {
  const year = await tx.academicYear.findFirst({
    where: {
      id: req.params.id,
      institutionId: req.institutionId,
    },
  });

  if (!year) {
    throw new AppError(
      'Academic year not found',
      404,
      'ACADEMIC_YEAR_NOT_FOUND'
    );
  }

  await tx.academicYear.updateMany({
    where: {
      institutionId: req.institutionId,
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });

  await tx.academicYear.update({
    where: { id: year.id },
    data: {
      isCurrent: true,
      status: 'ACTIVE',
    },
  });
});
```

This makes class creation a real product flow instead of relying on seed state.

---

# 33. RELATIONSHIP INTEGRITY MATRIX

| Relationship | Current State | Risk | Required Rule |
|---|---|---|---|
| Institution → AcademicYear | Good schema | Queries global | Always filter `institutionId` |
| AcademicYear → Class | Required | Class ID queries global | Verify year belongs to current institution |
| Institution → Student | Missing | Un-enrolled student has no tenant | Add direct ownership |
| Institution → Teacher | Optional | Cross-tenant teacher assignment | Make required or explicit global model |
| Institution → Subject | Optional | Cross-tenant subject assignment | Make required or explicit global model |
| Institution → CustomField | Good schema | Routes not updated | Scope every query/create |
| Student → Enrollment | Good concept | Multiple ACTIVE possible | Detect now; DB constraint later |
| Enrollment → AcademicYear/Class | Duplicated year link | Can mismatch | Canonical service validation |
| Student → Class legacy | Compatibility only | Can drift | Never query as authority |
| Class → Teacher string | Legacy duplicate | Can drift from ClassTeacher | Normalize around ClassTeacher |
| ClassTeacher | Good join | No same-tenant guarantee | Validate both sides |
| ClassSubject | Good join | No same-tenant guarantee | Validate both sides |
| Attendance → Enrollment | Good direction | enrollmentId nullable | Backfill then require |
| Attendance → Student/Class | Redundant | Can disagree with enrollment | Validate invariant |
| Exam → Class | Good | Tenant derived | Tenant-scope via class/year |
| Result → Exam + Student | Good join | Can cross tenants | Verify both sides same tenant |
| CustomFieldValue | Good join | Can connect wrong tenant | Verify Student + Field same institution |
| AuditLog → Institution | Optional | okay for system logs | Business logs must record institution |

---

# 34. CRITICAL BUG: CUSTOM FIELD CREATE CAN FAIL RIGHT NOW

This is independent from the class issue and should be fixed before calling Phase 2A stable.

Schema requires:

```text
CustomField.institutionId
```

but create route does not provide it.

Also:

```text
findUnique({ fieldKey })
```

is incompatible with composite uniqueness.

This should be treated as **P0/P1 depending on whether Custom Fields are currently used**.

---

# 35. CRITICAL BUG: CURRENT SEED IS NOT ALIGNED WITH CURRENT PRISMA UNIQUE KEY

File:

```text
server/src/seed.js
```

uses:

```js
where: { name: '2025-2026' }
```

for AcademicYear upsert.

After:

```prisma
@@unique([institutionId, name])
```

this must become:

```js
where: {
  institutionId_name: {
    institutionId: institution.id,
    name: '2025-2026',
  },
}
```

This is a concrete post-Phase-2A regression.

---

# 36. EXISTING SEED TEACHERS ARE NOT NORMALIZED

Seed creates classes with:

```text
teacher: "Maulana ..."
```

but does not consistently create matching institution-owned Teacher and ClassTeacher rows in the current seed section.

Update seed so each sample class:

1. creates/fetches Teacher for institution
2. creates Class
3. creates ClassTeacher Main Teacher relation

Do not leave normalized and legacy teacher state divergent.

---

# 37. PERMISSION NAMING HAS TWO DIFFERENT SYSTEMS

Runtime Phase 2A permission map uses:

```text
courses.view
courses.manage
students.edit
students.delete
settings.view
settings.manage
```

Seeded DB Permission rows use older names such as:

```text
classes.view
classes.create
students.update
students.archive
configuration.view
configuration.update
```

This will become a production RBAC bug when real authentication is enabled.

## FIX

Make the seed use exactly the same canonical permission codes as:

```text
server/src/config/permissions.js
```

Ideally export a server permission list and seed from that source.

Example:

```js
const { PERMISSIONS } = require('./config/permissions');

const permissionCodes = Object.values(PERMISSIONS);
```

Then seed descriptions separately if needed.

Do not maintain two independent permission vocabularies.

---

# 38. PRODUCTION AUTH NOTE

Current `X-Dev-Role` handling is disabled in production, which is correct.

Do not change that.

Future flow:

```text
auth middleware
  ↓
req.user
  ↓
req.user.institutionId
  ↓
institutionContext
  ↓
requirePermission
```

No need to build the real login UI now.

---

# 39. IMPLEMENTATION ORDER

Do the changes in this order.

## Batch 1 — Make class creation work safely

1. Fix `server/src/seed.js`
2. Fix old academic migration script
3. Add `academicYearService.js`
4. Scope class create to institution
5. Scope class list/get/update/status/delete
6. Fix Teacher institution scope
7. Decide/migrate class code uniqueness to academic-year scope
8. Add minimal AcademicYear API if no current-year management exists
9. Test Add Class

## Batch 2 — Fix immediate Phase 2A regressions

1. Fix CustomField composite unique queries
2. Add institutionId to CustomField create
3. Scope reorder/update/delete/list
4. Add `resultsEnabled` to config contract
5. Align seed permission codes

## Batch 3 — Introduce direct Student tenant ownership

1. Add nullable Student.institutionId
2. Backfill deterministically
3. detect ambiguous students
4. make required
5. scope admissionNo uniqueness
6. update all Student CRUD/import/export queries

## Batch 4 — Teacher/Subject ownership

1. Backfill teacher institution
2. make Teacher.institutionId required
3. scope Teacher email uniqueness if needed
4. backfill Subject institution
5. make Subject.institutionId required
6. scope Subject code uniqueness

## Batch 5 — Query isolation audit

Audit every:

```text
findUnique
findFirst
findMany
update
delete
updateMany
deleteMany
count
aggregate
groupBy
$queryRaw
```

for tenant-owned entities.

## Batch 6 — Relationship hardening

1. ClassTeacher same-tenant validation
2. ClassSubject same-tenant validation
3. Result same-tenant validation
4. CustomFieldValue same-tenant validation
5. Enrollment service gets institutionId
6. Attendance service gets institutionId
7. archive instead of destructive Student delete
8. change dangerous historical cascades to Restrict where appropriate

---

# 40. TEST PLAN FOR THE “ADD CLASS” BUG

## Test 1 — No current AcademicYear

Set institution with no current year.

POST:

```http
POST /api/classes
X-Dev-Role: ADMIN
```

Body:

```json
{
  "name": "Class 11",
  "section": "A",
  "code": "CLS-11-A",
  "capacity": 40,
  "teacher": "Maulana Ahmed"
}
```

Expected:

```text
409 ACTIVE_ACADEMIC_YEAR_REQUIRED
```

Clear message, not generic 500.

---

## Test 2 — Current year exists in another institution only

Institution A has no current year.  
Institution B has a current year.

Request from Institution A.

Expected:

```text
409 ACTIVE_ACADEMIC_YEAR_REQUIRED
```

It must NOT attach Institution B's year.

---

## Test 3 — Correct current year exists

Institution A current year exists.

Expected:

```text
201
```

Then verify:

```text
Class.academicYear.institutionId === Institution A
Teacher.institutionId === Institution A
ClassTeacher links same-institution Teacher
AuditLog.institutionId === Institution A
```

---

## Test 4 — duplicate code in same year

Create same code again.

Expected:

```text
409 CLASS_CODE_EXISTS
```

---

## Test 5 — same code in another academic year

If the schema is changed to:

```prisma
@@unique([academicYearId, code])
```

the same code should be allowed in another year.

---

## Test 6 — specified AcademicYear from another institution

Send:

```json
{
  "academicYearId": "<institution-B-year-id>"
}
```

from Institution A.

Expected:

```text
404 ACADEMIC_YEAR_NOT_FOUND
```

Do not reveal cross-tenant resource details.

---

## Test 7 — teacher name exists in another institution

Institution B has:

```text
Maulana Ahmed
```

Institution A creates class with same teacher name.

Expected:

- reuse only Institution A teacher if one exists
- otherwise create Institution A teacher
- never attach B teacher

---

# 41. CROSS-TENANT IDOR TEST PLAN

Create:

```text
Institution A
  Student A
  Class A
  Teacher A
  Subject A
  CustomField A

Institution B
  Student B
  Class B
  Teacher B
  Subject B
  CustomField B
```

Under Institution A context attempt:

```text
GET /api/classes/<B-class>
PUT /api/classes/<B-class>
PATCH /api/classes/<B-class>/status
DELETE /api/classes/<B-class>

GET /api/students/<B-student>
PUT /api/students/<B-student>
DELETE /api/students/<B-student>

PUT /api/custom-fields/<B-field>
DELETE /api/custom-fields/<B-field>

export with B class id
import using B class code
attendance with B class id
```

Every operation must behave as not found/forbidden according to policy.

Preferred cross-tenant resource-ID response:

```text
404
```

to avoid resource enumeration.

---

# 42. RELATIONSHIP VERIFICATION SCRIPT

Create a one-time diagnostic script:

```text
server/src/scripts/verify_relationship_integrity.js
```

It should detect:

### Classes with cross/missing tenant year

```js
const classes = await prisma.class.findMany({
  include: {
    academicYear: true,
    teachers: {
      include: {
        teacher: true,
      },
    },
    subjects: {
      include: {
        subject: true,
      },
    },
  },
});
```

Check:

```text
class.academicYear exists
classTeacher.teacher.institutionId == class.academicYear.institutionId
classSubject.subject.institutionId == class.academicYear.institutionId
```

### Enrollment invariants

For every enrollment:

```text
enrollment.class.academicYearId == enrollment.academicYearId
student.institutionId == enrollment.academicYear.institutionId
```

### Attendance invariants

If enrollmentId exists:

```text
attendance.studentId == enrollment.studentId
attendance.classId == enrollment.classId
```

### Custom fields

```text
customFieldValue.student.institutionId
==
customFieldValue.customField.institutionId
```

### Results

```text
result.student.institutionId
==
result.exam.class.academicYear.institutionId
```

The script must only report problems by default.

Do not auto-repair ambiguous data.

---

# 43. DO NOT AUTO-FIX AMBIGUOUS RELATIONSHIPS

Examples:

```text
Student has enrollments in two institutions
Teacher linked to classes from two institutions
Subject linked to classes from two institutions
```

Do NOT choose a random institution.

Report the record IDs and stop migration for those records.

This protects historical integrity.

---

# 44. ACCEPTANCE CRITERIA FOR THIS FIX PHASE

## Class creation

- [ ] Add Class works with a valid current academic year.
- [ ] Missing current year gives explicit 409.
- [ ] Current year is resolved by institution.
- [ ] Foreign institution year cannot be supplied.
- [ ] Teacher assignment is institution-safe.
- [ ] Duplicate class code policy is year-aware.
- [ ] Seed works with the current Prisma schema.

## Tenant isolation

- [ ] Class CRUD is tenant-scoped.
- [ ] Student CRUD is tenant-scoped.
- [ ] CustomField CRUD is tenant-scoped.
- [ ] Import is tenant-scoped.
- [ ] Export is tenant-scoped.
- [ ] Attendance is tenant-scoped.
- [ ] Enrollment service validates institution ownership.

## Relationships

- [ ] Student has unambiguous institution ownership.
- [ ] Teacher has unambiguous institution ownership.
- [ ] Subject has unambiguous institution ownership.
- [ ] ClassTeacher cannot cross tenants.
- [ ] ClassSubject cannot cross tenants.
- [ ] Enrollment class/year are consistent.
- [ ] Attendance student/class/enrollment are consistent.
- [ ] Result cannot join different institutions.
- [ ] CustomFieldValue cannot join different institutions.
- [ ] Legacy Student.classId remains compatibility-only.

## Historical safety

- [ ] Normal student removal does not hard-delete historical records.
- [ ] AcademicYear deletion cannot silently erase enrollments.
- [ ] Classes with history are archived, not deleted.
- [ ] Ambiguous data is reported, not silently repaired.

## Configuration / RBAC

- [ ] `resultsEnabled` contract is consistent.
- [ ] Seeded permission codes match runtime permission codes.
- [ ] X-Dev-Role remains development-only.

---

# 45. VERIFICATION COMMANDS

After implementation:

```bash
cd server
npm install
npx prisma format
npx prisma validate
npx prisma generate
npm run db:push
npm run db:seed
npm start
```

Then frontend:

```bash
cd ..
npm install
npm run build
```

Do not claim success unless each command is actually executed.

---

# 46. IMPORTANT DB-PUSH WARNING

Because this project currently uses:

```text
prisma db push
```

be careful with:

- changing unique constraints
- making nullable fields required
- adding institutionId
- replacing global unique keys

Backfill first.

Do not use:

```text
--accept-data-loss
```

blindly.

If Prisma warns about destructive changes, inspect the existing data before proceeding.

---

# 47. PHASE BOUNDARY

This document should complete **Tenant & Relationship Integrity Hardening**.

Do NOT yet implement the full next-phase items:

```text
partial unique ACTIVE Enrollment DB index
full capacity concurrency architecture
working-day calendar
holiday engine
attendance denominator redesign
```

Those should follow after tenant isolation and relationship integrity are proven.

---

# 48. FINAL IMPLEMENTER INSTRUCTION

Before editing:

1. read the actual current file
2. understand existing callers
3. do not overwrite unrelated work
4. preserve Phase 2A RBAC/module behavior
5. never trust client institutionId
6. never use global current AcademicYear
7. never connect two records before proving they belong to the same institution
8. do not auto-repair ambiguous data
9. do not claim relationship integrity until the verification script/tests pass
10. test Add Class specifically before calling the phase complete

The immediate priority is:

```text
Fix Add Class
    ↓
Fix AcademicYear resolution
    ↓
Fix CustomField Phase-2A regressions
    ↓
Establish direct Student/Teacher/Subject ownership
    ↓
Scope every tenant query
    ↓
Verify all cross-entity relationships
```

Only after this passes should the project move to Enrollment concurrency/DB constraints.
