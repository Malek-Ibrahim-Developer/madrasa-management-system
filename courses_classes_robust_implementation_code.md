# Courses & Classes Module --- Production Fixes With Code

## Purpose

This document converts the previously identified robustness issues into
an implementation-oriented plan with code.

It is written specifically against the supplied current module:

-   `server/prisma/schema.prisma`
-   `server/src/routes/classRoutes.js`
-   `src/services/api.js`
-   `src/pages/Courses.jsx`
-   `src/styles/courses.css`

The supplied module currently uses:

-   React
-   Express
-   Prisma
-   JavaScript/JSX
-   `react-icons`
-   `react-hot-toast`

The current class model contains:

``` text
id
name
section
code
teacher
capacity
createdAt
updatedAt
students
exams
attendances
```

The current API contains:

``` text
GET    /api/classes
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id
```

------------------------------------------------------------------------

# 0. IMPORTANT: ZERO-MISMATCH IMPLEMENTATION RULE

The goal of this document is to prevent the common IDE-AI problem where
one generated file uses:

``` text
teacherId
```

while another uses:

``` text
assignedTeacherId
```

or one file expects:

``` text
classId
```

while another sends:

``` text
courseId
```

## Canonical names for this implementation

Use these names consistently:

``` text
Class
AcademicYear
Enrollment
ClassTeacher
Subject
ClassSubject
AuditLog
```

Canonical identifiers:

``` text
classId
academicYearId
studentId
teacherId
subjectId
userId
```

Canonical class fields:

``` text
id
name
section
code
capacity
status
academicYearId
createdAt
updatedAt
archivedAt
```

Canonical enrollment fields:

``` text
id
studentId
classId
academicYearId
enrollmentDate
exitDate
rollNumber
status
createdAt
updatedAt
```

Canonical API payload:

``` json
{
  "name": "Class 8",
  "section": "A",
  "code": "CLS-08-A",
  "capacity": 40,
  "academicYearId": "..."
}
```

Do NOT rename these fields in one layer only.

------------------------------------------------------------------------

# 1. Before Changing Code --- Required IDE AI Inspection

Before applying any code below, the IDE AI must inspect the existing
project for these models:

``` text
Teacher
Student
User
AcademicYear
Subject
Enrollment
Attendance
Exam
Result
```

Also inspect:

``` text
prisma/schema.prisma
server/src/
src/services/api.js
src/pages/
src/App.jsx
```

## Critical rule

If one of these models already exists:

> Reuse the existing model and its exact field names.

Do not create a duplicate model.

For example, if the project already has:

``` prisma
model Staff
```

and teachers are represented by Staff, do NOT create another `Teacher`
model.

Instead, adapt the relationship to the existing Staff model.

The code in this document assumes a `Teacher` model only where the
supplied documentation does not provide an existing teacher model.

------------------------------------------------------------------------

# 2. Fix Architecture

Target architecture:

``` text
React
  |
  v
src/services/api.js
  |
  v
Express Routes
  |
  +--> Authentication
  |
  +--> Authorization
  |
  +--> Validation
  |
  +--> Controller/Service
  |
  v
Prisma
  |
  v
Database
```

The class domain becomes:

``` text
AcademicYear
      |
      v
Class
 |    |    |
 |    |    +---- ClassTeacher ---- Teacher
 |    |
 |    +--------- ClassSubject ---- Subject
 |
 +-------------- Enrollment ------ Student
```

------------------------------------------------------------------------

# 3. Prisma --- Safe Class Model

## Current weakness

The current model stores teacher as:

``` prisma
teacher String?
```

and has no lifecycle/status or academic year.

## Target Class model

Use this as the target shape:

``` prisma
enum ClassStatus {
  DRAFT
  ACTIVE
  CLOSED
  ARCHIVED
}

model Class {
  id             String      @id @default(cuid())
  name           String
  section        String?
  code           String      @unique
  capacity       Int         @default(40)
  status         ClassStatus @default(ACTIVE)

  academicYearId String
  academicYear   AcademicYear @relation(
    fields: [academicYearId],
    references: [id]
  )

  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  archivedAt     DateTime?

  students       Student[]
  exams          Exam[]
  attendances    Attendance[]

  enrollments    Enrollment[]
  teachers       ClassTeacher[]
  subjects       ClassSubject[]

  @@index([academicYearId])
  @@index([status])
  @@index([name])
  @@map("classes")
}
```

## Important migration note

The supplied current schema has:

``` prisma
teacher String?
```

Do not simply delete this field in production before migrating existing
data.

Migration sequence:

``` text
1. Add new relationship tables/fields.
2. Backfill teacher relationship from old teacher strings if possible.
3. Verify data.
4. Remove old teacher string.
```

------------------------------------------------------------------------

# 4. AcademicYear Model

Add:

``` prisma
model AcademicYear {
  id        String   @id @default(cuid())
  name      String   @unique
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)

  classes      Class[]
  enrollments  Enrollment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isCurrent])
  @@map("academic_years")
}
```

## Example data

``` text
2025-2026
2026-2027
```

The class must always belong to an academic year.

------------------------------------------------------------------------

# 5. Enrollment Model

The current student count is useful, but direct student counting is not
enough for an ERP.

Add:

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

  student      Student      @relation(fields: [studentId], references: [id])
  class        Class        @relation(fields: [classId], references: [id])
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([studentId])
  @@index([classId])
  @@index([academicYearId])
  @@index([classId, status])
  @@unique([studentId, academicYearId])
  @@map("enrollments")
}
```

## Important

The exact `Student` relation must match the existing Student model.

If the current Student model does not yet have:

``` prisma
enrollments Enrollment[]
```

add that relation field.

------------------------------------------------------------------------

# 6. Teacher Assignment

## Preferred design

A class can have multiple teachers.

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

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([classId])
  @@index([teacherId])
  @@unique([classId, teacherId])
  @@map("class_teachers")
}
```

## If Teacher already exists

Reuse the existing Teacher model.

Do NOT create:

``` prisma
model Teacher
```

if one already exists.

------------------------------------------------------------------------

# 7. Subject Model

``` prisma
model Subject {
  id          String  @id @default(cuid())
  name        String
  code        String  @unique
  description String?
  isActive    Boolean @default(true)

  classes ClassSubject[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
  @@map("subjects")
}
```

------------------------------------------------------------------------

# 8. ClassSubject Model

``` prisma
model ClassSubject {
  id        String @id @default(cuid())
  classId   String
  subjectId String

  periodsPerWeek Int?

  class   Class   @relation(fields: [classId], references: [id])
  subject Subject @relation(fields: [subjectId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([classId, subjectId])
  @@index([classId])
  @@index([subjectId])
  @@map("class_subjects")
}
```

------------------------------------------------------------------------

# 9. AuditLog Model

``` prisma
model AuditLog {
  id       String @id @default(cuid())
  userId   String
  action   String
  entity   String
  entityId String

  oldValue Json?
  newValue Json?

  createdAt DateTime @default(now())

  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

The `userId` relation should be connected to the project's existing
authentication/user model.

------------------------------------------------------------------------

# 10. Prisma Migration

After schema changes:

``` bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name robust_courses_classes
npx prisma generate
```

For production:

``` bash
npx prisma migrate deploy
npx prisma generate
```

## Mandatory check

Do not continue until:

``` bash
npx prisma validate
```

passes successfully.

------------------------------------------------------------------------

# 11. Backend Validation

## Recommended file

``` text
server/src/validators/classValidator.js
```

Example:

``` javascript
const validateClassPayload = (body) => {
  const errors = {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const section =
    typeof body.section === 'string' ? body.section.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const capacity = Number(body.capacity);
  const academicYearId =
    typeof body.academicYearId === 'string'
      ? body.academicYearId.trim()
      : '';

  if (!name) {
    errors.name = 'Class name is required';
  }

  if (name.length > 100) {
    errors.name = 'Class name must be 100 characters or less';
  }

  if (!code) {
    errors.code = 'Class code is required';
  }

  if (code.length > 30) {
    errors.code = 'Class code must be 30 characters or less';
  }

  if (!academicYearId) {
    errors.academicYearId = 'Academic year is required';
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    errors.capacity = 'Capacity must be a positive integer';
  }

  if (capacity > 10000) {
    errors.capacity = 'Capacity is too large';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      name,
      section: section || null,
      code,
      capacity,
      academicYearId
    }
  };
};

module.exports = {
  validateClassPayload
};
```

------------------------------------------------------------------------

# 12. Centralized Backend Error Class

Create:

``` text
server/src/utils/AppError.js
```

``` javascript
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = AppError;
```

------------------------------------------------------------------------

# 13. Central Error Handler

Create:

``` text
server/src/middleware/errorHandler.js
```

``` javascript
const errorHandler = (error, req, res, next) => {
  console.error('[ERROR]', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    code: error.code || 'INTERNAL_ERROR',
    message:
      statusCode >= 500
        ? 'An unexpected server error occurred'
        : error.message
  });
};

module.exports = errorHandler;
```

Register it after routes:

``` javascript
app.use(errorHandler);
```

------------------------------------------------------------------------

# 14. Robust Class Routes

Recommended file:

``` text
server/src/routes/classRoutes.js
```

The following implementation keeps the API field names consistent.

``` javascript
const express = require('express');
const router = express.Router();

const AppError = require('../utils/AppError');
const {
  validateClassPayload
} = require('../validators/classValidator');

const buildClassWhere = ({ search, status, academicYearId }) => {
  const where = {};

  if (status) {
    where.status = status;
  }

  if (academicYearId) {
    where.academicYearId = academicYearId;
  }

  if (search) {
    const normalizedSearch = search.trim();

    if (normalizedSearch) {
      where.OR = [
        {
          name: {
            contains: normalizedSearch,
            mode: 'insensitive'
          }
        },
        {
          code: {
            contains: normalizedSearch,
            mode: 'insensitive'
          }
        },
        {
          section: {
            contains: normalizedSearch,
            mode: 'insensitive'
          }
        }
      ];
    }
  }

  return where;
};

/**
 * GET /api/classes
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 25, 1),
      100
    );

    const search =
      typeof req.query.search === 'string'
        ? req.query.search
        : '';

    const status =
      typeof req.query.status === 'string'
        ? req.query.status
        : '';

    const academicYearId =
      typeof req.query.academicYearId === 'string'
        ? req.query.academicYearId
        : '';

    const where = buildClassWhere({
      search,
      status,
      academicYearId
    });

    const [classes, total] = await Promise.all([
      req.prisma.class.findMany({
        where,
        include: {
          _count: {
            select: {
              students: true,
              enrollments: true,
              teachers: true,
              subjects: true
            }
          },
          academicYear: true
        },
        orderBy: [
          {
            name: 'asc'
          },
          {
            section: 'asc'
          }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      req.prisma.class.count({
        where
      })
    ]);

    const data = classes.map((classRecord) => ({
      id: classRecord.id,
      name: classRecord.name,
      section: classRecord.section,
      code: classRecord.code,
      capacity: classRecord.capacity,
      status: classRecord.status,
      academicYearId: classRecord.academicYearId,
      academicYear: classRecord.academicYear,
      studentCount: classRecord._count.students,
      enrollmentCount: classRecord._count.enrollments,
      teacherCount: classRecord._count.teachers,
      subjectCount: classRecord._count.subjects,
      createdAt: classRecord.createdAt,
      updatedAt: classRecord.updatedAt,
      archivedAt: classRecord.archivedAt
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/classes/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const classRecord = await req.prisma.class.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        academicYear: true,
        _count: {
          select: {
            students: true,
            enrollments: true,
            teachers: true,
            subjects: true
          }
        }
      }
    });

    if (!classRecord) {
      throw new AppError(
        'Class not found',
        404,
        'CLASS_NOT_FOUND'
      );
    }

    res.json({
      success: true,
      data: {
        id: classRecord.id,
        name: classRecord.name,
        section: classRecord.section,
        code: classRecord.code,
        capacity: classRecord.capacity,
        status: classRecord.status,
        academicYearId: classRecord.academicYearId,
        academicYear: classRecord.academicYear,
        studentCount: classRecord._count.students,
        enrollmentCount: classRecord._count.enrollments,
        teacherCount: classRecord._count.teachers,
        subjectCount: classRecord._count.subjects,
        createdAt: classRecord.createdAt,
        updatedAt: classRecord.updatedAt,
        archivedAt: classRecord.archivedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/classes
 */
router.post('/', async (req, res, next) => {
  try {
    const validation = validateClassPayload(req.body);

    if (!validation.valid) {
      throw new AppError(
        'Validation failed',
        422,
        'VALIDATION_ERROR'
      );
    }

    const {
      name,
      section,
      code,
      capacity,
      academicYearId
    } = validation.data;

    const academicYear =
      await req.prisma.academicYear.findUnique({
        where: {
          id: academicYearId
        }
      });

    if (!academicYear) {
      throw new AppError(
        'Academic year not found',
        404,
        'ACADEMIC_YEAR_NOT_FOUND'
      );
    }

    const existing = await req.prisma.class.findUnique({
      where: {
        code
      }
    });

    if (existing) {
      throw new AppError(
        `Class with code "${code}" already exists`,
        409,
        'CLASS_CODE_EXISTS'
      );
    }

    const newClass = await req.prisma.class.create({
      data: {
        name,
        section,
        code,
        capacity,
        academicYearId,
        status: 'ACTIVE'
      }
    });

    res.status(201).json({
      success: true,
      data: newClass
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/classes/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const validation = validateClassPayload(req.body);

    if (!validation.valid) {
      throw new AppError(
        'Validation failed',
        422,
        'VALIDATION_ERROR'
      );
    }

    const existingClass =
      await req.prisma.class.findUnique({
        where: {
          id: req.params.id
        }
      });

    if (!existingClass) {
      throw new AppError(
        'Class not found',
        404,
        'CLASS_NOT_FOUND'
      );
    }

    const {
      name,
      section,
      code,
      capacity,
      academicYearId
    } = validation.data;

    const academicYear =
      await req.prisma.academicYear.findUnique({
        where: {
          id: academicYearId
        }
      });

    if (!academicYear) {
      throw new AppError(
        'Academic year not found',
        404,
        'ACADEMIC_YEAR_NOT_FOUND'
      );
    }

    const duplicate =
      await req.prisma.class.findFirst({
        where: {
          code,
          NOT: {
            id: req.params.id
          }
        }
      });

    if (duplicate) {
      throw new AppError(
        `Class with code "${code}" already exists`,
        409,
        'CLASS_CODE_EXISTS'
      );
    }

    const updatedClass =
      await req.prisma.class.update({
        where: {
          id: req.params.id
        },
        data: {
          name,
          section,
          code,
          capacity,
          academicYearId
        }
      });

    res.json({
      success: true,
      data: updatedClass
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/classes/:id/status
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const allowedStatuses = [
      'DRAFT',
      'ACTIVE',
      'CLOSED',
      'ARCHIVED'
    ];

    const status =
      typeof req.body.status === 'string'
        ? req.body.status
        : '';

    if (!allowedStatuses.includes(status)) {
      throw new AppError(
        'Invalid class status',
        422,
        'INVALID_CLASS_STATUS'
      );
    }

    const existingClass =
      await req.prisma.class.findUnique({
        where: {
          id: req.params.id
        }
      });

    if (!existingClass) {
      throw new AppError(
        'Class not found',
        404,
        'CLASS_NOT_FOUND'
      );
    }

    const updatedClass =
      await req.prisma.class.update({
        where: {
          id: req.params.id
        },
        data: {
          status,
          archivedAt:
            status === 'ARCHIVED'
              ? new Date()
              : null
        }
      });

    res.json({
      success: true,
      data: updatedClass
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/classes/:id
 *
 * Permanent deletion is intentionally restricted.
 * Normal UI should use PATCH /:id/status with ARCHIVED.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const existingClass =
      await req.prisma.class.findUnique({
        where: {
          id: req.params.id
        },
        include: {
          _count: {
            select: {
              students: true,
              enrollments: true,
              exams: true,
              attendances: true,
              teachers: true,
              subjects: true
            }
          }
        }
      });

    if (!existingClass) {
      throw new AppError(
        'Class not found',
        404,
        'CLASS_NOT_FOUND'
      );
    }

    const hasDependencies =
      existingClass._count.students > 0 ||
      existingClass._count.enrollments > 0 ||
      existingClass._count.exams > 0 ||
      existingClass._count.attendances > 0 ||
      existingClass._count.teachers > 0 ||
      existingClass._count.subjects > 0;

    if (hasDependencies) {
      throw new AppError(
        'Class cannot be permanently deleted because related records exist. Archive the class instead.',
        409,
        'CLASS_HAS_DEPENDENCIES'
      );
    }

    await req.prisma.class.delete({
      where: {
        id: req.params.id
      }
    });

    res.json({
      success: true,
      message: 'Class permanently deleted'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

------------------------------------------------------------------------

# 15. IMPORTANT: Route Ordering

Keep:

``` javascript
router.get('/:id', ...)
```

after any fixed routes if you add routes such as:

``` text
/archive
/statistics
/bulk
```

Otherwise `/:id` can accidentally capture those paths.

Recommended structure:

``` text
GET    /
POST   /
GET    /statistics
POST   /bulk
GET    /:id
PUT    /:id
PATCH  /:id/status
DELETE /:id
```

------------------------------------------------------------------------

# 16. Authentication Middleware

The exact implementation depends on the existing authentication system.

Do not invent a new authentication system if the project already has
one.

The final route structure should look like:

``` javascript
router.get(
  '/',
  requireAuth,
  requirePermission('classes.view'),
  getClasses
);

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

router.patch(
  '/:id/status',
  requireAuth,
  requirePermission('classes.archive'),
  updateClassStatus
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('classes.delete'),
  deleteClass
);
```

Use the project's existing middleware names if they already exist.

------------------------------------------------------------------------

# 17. Enrollment Capacity-Safe API

Create an enrollment service or route.

Example:

``` javascript
const AppError = require('../utils/AppError');

const enrollStudent = async ({
  prisma,
  studentId,
  classId,
  academicYearId,
  rollNumber
}) => {
  return prisma.$transaction(async (tx) => {
    const classRecord = await tx.class.findUnique({
      where: {
        id: classId
      }
    });

    if (!classRecord) {
      throw new AppError(
        'Class not found',
        404,
        'CLASS_NOT_FOUND'
      );
    }

    if (classRecord.status !== 'ACTIVE') {
      throw new AppError(
        'Students cannot be enrolled into an inactive class',
        409,
        'CLASS_NOT_ACTIVE'
      );
    }

    const activeEnrollmentCount =
      await tx.enrollment.count({
        where: {
          classId,
          status: 'ACTIVE'
        }
      });

    if (activeEnrollmentCount >= classRecord.capacity) {
      throw new AppError(
        'Class is at full capacity',
        409,
        'CLASS_FULL'
      );
    }

    const existingEnrollment =
      await tx.enrollment.findFirst({
        where: {
          studentId,
          academicYearId,
          status: 'ACTIVE'
        }
      });

    if (existingEnrollment) {
      throw new AppError(
        'Student is already actively enrolled for this academic year',
        409,
        'STUDENT_ALREADY_ENROLLED'
      );
    }

    return tx.enrollment.create({
      data: {
        studentId,
        classId,
        academicYearId,
        rollNumber: rollNumber || null,
        status: 'ACTIVE'
      }
    });
  });
};

module.exports = {
  enrollStudent
};
```

## Important concurrency note

The exact capacity-locking strategy depends on the database provider.

A transaction alone does not automatically guarantee that two concurrent
enrollment requests cannot both pass a count check.

If strict capacity enforcement is required, use a database-specific
concurrency strategy after confirming whether the project uses
PostgreSQL, MySQL, SQLite, MongoDB, etc.

Do not let IDE AI invent a locking mechanism without checking the actual
database provider.

------------------------------------------------------------------------

# 18. Class Code Generator

Create:

``` text
src/utils/classCode.js
```

``` javascript
export const generateClassCode = (name, section = '') => {
  const normalizedName = String(name || '')
    .trim()
    .toUpperCase();

  const normalizedSection = String(section || '')
    .trim()
    .toUpperCase();

  const numberMatch = normalizedName.match(/\d+/);

  const classNumber = numberMatch
    ? numberMatch[0].padStart(2, '0')
    : '';

  const namePrefix = normalizedName
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);

  if (classNumber && normalizedSection) {
    return `CLS-${classNumber}-${normalizedSection
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 5)}`;
  }

  if (classNumber) {
    return `CLS-${classNumber}`;
  }

  if (namePrefix) {
    return `CLS-${namePrefix}`;
  }

  return '';
};
```

Examples:

``` text
Class 8 + A → CLS-08-A
Class 10 + B → CLS-10-B
Hifz Year 1 + Boys → CLS-01-BOYS
```

The backend must still verify uniqueness.

------------------------------------------------------------------------

# 19. Frontend API Service

Replace the class API section with consistent functions:

``` javascript
const getQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
};

export async function getClasses(params = {}) {
  return apiCall(`/classes${getQueryString(params)}`);
}

export async function getClassById(id) {
  return apiCall(`/classes/${id}`);
}

export async function createClass(classData) {
  return apiCall('/classes', {
    method: 'POST',
    body: JSON.stringify(classData)
  });
}

export async function updateClass(id, classData) {
  return apiCall(`/classes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(classData)
  });
}

export async function updateClassStatus(id, status) {
  return apiCall(`/classes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function deleteClass(id) {
  return apiCall(`/classes/${id}`, {
    method: 'DELETE'
  });
}
```

## Critical rule

Use:

``` text
id
```

everywhere.

Do not mix:

``` text
_id
id
classId
```

for the same class record.

If the actual database uses Prisma `id`, the frontend should use:

``` javascript
classRecord.id
```

------------------------------------------------------------------------

# 20. Frontend Class Form State

Use one canonical state:

``` javascript
const initialFormState = {
  name: '',
  section: '',
  code: '',
  capacity: 40,
  academicYearId: ''
};
```

Do not use:

``` text
teacher
teacherName
teacherId
assignedTeacher
```

in the class form unless teacher assignment is actually being
implemented in that form.

Teacher assignment should eventually use the dedicated `ClassTeacher`
API.

------------------------------------------------------------------------

# 21. Improved Courses Component State

``` javascript
const [classes, setClasses] = useState([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);

const [searchTerm, setSearchTerm] = useState('');
const [page, setPage] = useState(1);
const [limit] = useState(25);
const [totalPages, setTotalPages] = useState(1);

const [statusFilter, setStatusFilter] = useState('');
const [academicYearId, setAcademicYearId] = useState('');

const [isModalOpen, setIsModalOpen] = useState(false);
const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

const [selectedClass, setSelectedClass] = useState(null);
const [formData, setFormData] = useState(initialFormState);

const [isSubmitting, setIsSubmitting] = useState(false);
```

------------------------------------------------------------------------

# 22. Server-Side Class Loading

``` javascript
const fetchClasses = useCallback(
  async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await getClasses({
        page,
        limit,
        search: searchTerm,
        status: statusFilter,
        academicYearId
      });

      const data = Array.isArray(response)
        ? response
        : response?.data || [];

      setClasses(data);

      if (response?.pagination) {
        setTotalPages(response.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error(
        error?.message || 'Failed to load classes'
      );
      setClasses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  },
  [
    page,
    limit,
    searchTerm,
    statusFilter,
    academicYearId
  ]
);
```

------------------------------------------------------------------------

# 23. Important API Response Compatibility

The current backend documentation returns:

``` json
{
  "success": true,
  "data": [...]
}
```

The improved API adds:

``` json
{
  "success": true,
  "data": [...],
  "pagination": {...}
}
```

Therefore the frontend should always use:

``` javascript
response?.data || []
```

for the list.

Do not change the backend to return:

`text classes`

while the frontend expects:

`text data`

Pick one contract and keep it everywhere.

------------------------------------------------------------------------

# 24. Remove Client-Side Filtering

The old code uses:

``` javascript
const filteredClasses = useMemo(() => {
  return classes.filter(...)
}, [classes, searchTerm]);
```

Once server-side search is implemented, remove this.

The API should receive:

`text search status academicYearId page limit`

and return the already filtered result.

------------------------------------------------------------------------

# 25. Capacity Utility

Create:

``` text
src/utils/capacity.js
```

``` javascript
export const getCapacityInfo = (
  studentCount = 0,
  capacity = 0
) => {
  const students = Number(studentCount) || 0;
  const maxCapacity = Number(capacity) || 0;

  if (maxCapacity <= 0) {
    return {
      percentage: 0,
      status: 'INVALID',
      remaining: 0,
      overBy: 0
    };
  }

  const percentage = Math.round(
    (students / maxCapacity) * 100
  );

  if (students > maxCapacity) {
    return {
      percentage,
      status: 'OVER_CAPACITY',
      remaining: 0,
      overBy: students - maxCapacity
    };
  }

  if (students === maxCapacity) {
    return {
      percentage: 100,
      status: 'FULL',
      remaining: 0,
      overBy: 0
    };
  }

  if (percentage >= 80) {
    return {
      percentage,
      status: 'NEAR_CAPACITY',
      remaining: maxCapacity - students,
      overBy: 0
    };
  }

  return {
    percentage,
    status: 'NORMAL',
    remaining: maxCapacity - students,
    overBy: 0
  };
};
```

------------------------------------------------------------------------

# 26. Capacity UI

Use:

``` javascript
const capacityInfo = getCapacityInfo(
  classRecord.studentCount,
  classRecord.capacity
);
```

Then:

``` jsx
<div className="capacity-header">
  <span className="students-count">
    {classRecord.studentCount} / {classRecord.capacity}
  </span>

  <span
    className={`capacity-percentage ${capacityInfo.status}`}
  >
    {capacityInfo.percentage}%
  </span>
</div>

<div className="capacity-bar-bg">
  <div
    className={`capacity-bar-fill ${capacityInfo.status}`}
    style={{
      width: `${Math.min(capacityInfo.percentage, 100)}%`
    }}
  />
</div>

{capacityInfo.status === 'OVER_CAPACITY' && (
  <small className="capacity-warning">
    Over capacity by {capacityInfo.overBy}
  </small>
)}
```

Notice the distinction:

``` text
Displayed percentage = real percentage
Progress bar width = capped at 100
```

This prevents the old information-loss problem.

------------------------------------------------------------------------

# 27. Archive Instead of Delete in Normal UI

Instead of:

``` javascript
await deleteClass(id);
```

normal administration should use:

``` javascript
await updateClassStatus(id, 'ARCHIVED');
```

Then:

``` javascript
toast.success('Class archived successfully');
```

Permanent delete should be a restricted administrative operation.

------------------------------------------------------------------------

# 28. Delete Confirmation Text

Change the normal action from:

``` text
Delete Class
```

to:

``` text
Archive Class
```

Example:

``` jsx
<h2>Archive Class</h2>

<p>
  Are you sure you want to archive{' '}
  <strong>
    {selectedClass?.name}
    {selectedClass?.section
      ? ` ${selectedClass.section}`
      : ''}
  </strong>?
  Historical student, attendance, and examination records
  will be preserved.
</p>
```

------------------------------------------------------------------------

# 29. Academic Year Form

The Add/Edit class form must include:

``` jsx
<div className="form-group">
  <label htmlFor="academicYearId">
    Academic Year
    <span className="required">*</span>
  </label>

  <select
    id="academicYearId"
    name="academicYearId"
    value={formData.academicYearId}
    onChange={handleInputChange}
    required
  >
    <option value="">
      Select academic year
    </option>

    {academicYears.map((academicYear) => (
      <option
        key={academicYear.id}
        value={academicYear.id}
      >
        {academicYear.name}
      </option>
    ))}
  </select>
</div>
```

The `academicYears` data should come from the existing academic-year
API.

Do not hardcode academic years.

------------------------------------------------------------------------

# 30. Audit Logging

Create a reusable function:

``` javascript
const createAuditLog = async ({
  prisma,
  userId,
  action,
  entity,
  entityId,
  oldValue = null,
  newValue = null
}) => {
  return prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      oldValue,
      newValue
    }
  });
};

module.exports = {
  createAuditLog
};
```

Example after update:

``` javascript
await createAuditLog({
  prisma: req.prisma,
  userId: req.user.id,
  action: 'UPDATE',
  entity: 'Class',
  entityId: updatedClass.id,
  oldValue: existingClass,
  newValue: updatedClass
});
```

Use the actual authenticated-user property from the existing
authentication middleware.

Do not assume it is `req.user.id` if the current project uses another
property.

------------------------------------------------------------------------

# 31. Transaction for Update + Audit

When the operation requires both database update and audit creation:

``` javascript
const result = await req.prisma.$transaction(
  async (tx) => {
    const updatedClass =
      await tx.class.update({
        where: {
          id: req.params.id
        },
        data: {
          name,
          section,
          code,
          capacity,
          academicYearId
        }
      });

    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'Class',
        entityId: updatedClass.id,
        oldValue: existingClass,
        newValue: updatedClass
      }
    });

    return updatedClass;
  }
);
```

Again, adapt only the authenticated user property to the existing
project.

------------------------------------------------------------------------

# 32. Class Statistics Endpoint

Add:

``` text
GET /api/classes/:id/statistics
```

Response:

``` json
{
  "success": true,
  "data": {
    "studentCount": 35,
    "capacity": 40,
    "remainingSeats": 5,
    "capacityPercentage": 88,
    "teacherCount": 3,
    "subjectCount": 7
  }
}
```

Backend:

``` javascript
router.get('/:id/statistics', async (req, res, next) => {
  try {
    const classRecord =
      await req.prisma.class.findUnique({
        where: {
          id: req.params.id
        },
        include: {
          _count: {
            select: {
              students: true,
              teachers: true,
              subjects: true
            }
          }
        }
      });

    if (!classRecord) {
      throw new AppError(
        'Class not found',
        404,
        'CLASS_NOT_FOUND'
      );
    }

    const studentCount =
      classRecord._count.students;

    const capacity = classRecord.capacity;

    const capacityPercentage =
      capacity > 0
        ? Math.round(
            (studentCount / capacity) * 100
          )
        : 0;

    res.json({
      success: true,
      data: {
        studentCount,
        capacity,
        remainingSeats: Math.max(
          capacity - studentCount,
          0
        ),
        capacityPercentage,
        teacherCount:
          classRecord._count.teachers,
        subjectCount:
          classRecord._count.subjects
      }
    });
  } catch (error) {
    next(error);
  }
});
```

## Route-order note

If using:

``` text
/:id/statistics
```

define it before a generic nested route that could capture `statistics`.

------------------------------------------------------------------------

# 33. Frontend File Structure

Recommended final structure:

``` text
src/
├── pages/
│   └── Courses/
│       ├── Courses.jsx
│       └── components/
│           ├── CoursesHeader.jsx
│           ├── CoursesToolbar.jsx
│           ├── CoursesTable.jsx
│           ├── CourseMobileCard.jsx
│           ├── CourseFormModal.jsx
│           ├── ArchiveClassModal.jsx
│           └── CapacityIndicator.jsx
│
├── services/
│   └── api.js
│
├── utils/
│   ├── classCode.js
│   └── capacity.js
│
└── styles/
    └── courses.css
```

This is optional.

If the project is small, keeping `Courses.jsx` together is acceptable.

Do not split the component unless the project benefits from it.

------------------------------------------------------------------------

# 34. Accessibility Fixes

Icon-only buttons should have:

``` jsx
<button
  type="button"
  aria-label={`Edit ${classRecord.name}`}
  title="Edit Class"
  onClick={() => openEditModal(classRecord)}
>
  <MdEdit />
</button>
```

Delete/archive:

``` jsx
<button
  type="button"
  aria-label={`Archive ${classRecord.name}`}
  title="Archive Class"
  onClick={() => openArchiveModal(classRecord)}
>
  <MdDelete />
</button>
```

Modal should support:

``` text
ESC
focus trap
return focus to triggering button
```

Use an established modal library if the project already has one.

------------------------------------------------------------------------

# 35. React Form Validation

Frontend validation should provide immediate feedback, but backend
validation remains authoritative.

Example:

``` javascript
const validateForm = () => {
  const errors = {};

  if (!formData.name.trim()) {
    errors.name = 'Class name is required';
  }

  if (!formData.code.trim()) {
    errors.code = 'Class code is required';
  }

  if (!formData.academicYearId) {
    errors.academicYearId =
      'Academic year is required';
  }

  if (
    !Number.isInteger(Number(formData.capacity)) ||
    Number(formData.capacity) <= 0
  ) {
    errors.capacity =
      'Capacity must be a positive integer';
  }

  setFormErrors(errors);

  return Object.keys(errors).length === 0;
};
```

------------------------------------------------------------------------

# 36. Numeric Capacity Handling

Avoid this:

``` javascript
parseInt(value) || 0
```

because it silently converts invalid input into zero.

Use:

``` javascript
const handleInputChange = (event) => {
  const {
    name,
    value
  } = event.target;

  setFormData((previous) => ({
    ...previous,
    [name]:
      name === 'capacity'
        ? value
        : value
  }));
};
```

Then convert and validate on submit:

``` javascript
const payload = {
  ...formData,
  capacity: Number(formData.capacity)
};
```

This keeps the input value stable while the user is typing.

------------------------------------------------------------------------

# 37. Consistent ID Handling

The current code supports:

``` javascript
cls._id || cls.id
```

That suggests legacy Mongo/Mongoose compatibility.

If the actual system is Prisma:

Use:

``` javascript
classRecord.id
```

everywhere.

Example:

``` jsx
<tr key={classRecord.id}>
```

and:

``` javascript
await updateClass(
  selectedClass.id,
  payload
);
```

Do not continue mixing `_id` and `id` unless the entire backend actually
supports both.

------------------------------------------------------------------------

# 38. API Contract

The class API should use this contract.

## GET

``` text
GET /api/classes?page=1&limit=25&search=Class&status=ACTIVE&academicYearId=YEAR_ID
```

Response:

``` json
{
  "success": true,
  "data": [
    {
      "id": "class_id",
      "name": "Class 8",
      "section": "A",
      "code": "CLS-08-A",
      "capacity": 40,
      "status": "ACTIVE",
      "academicYearId": "year_id",
      "studentCount": 32,
      "teacherCount": 2,
      "subjectCount": 6
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  }
}
```

## POST

``` json
{
  "name": "Class 8",
  "section": "A",
  "code": "CLS-08-A",
  "capacity": 40,
  "academicYearId": "year_id"
}
```

## PUT

Same payload.

## PATCH status

``` json
{
  "status": "ARCHIVED"
}
```

------------------------------------------------------------------------

# 39. Error Contract

All errors should follow:

``` json
{
  "success": false,
  "code": "CLASS_NOT_FOUND",
  "message": "Class not found"
}
```

Examples:

``` text
CLASS_NOT_FOUND
CLASS_CODE_EXISTS
ACADEMIC_YEAR_NOT_FOUND
CLASS_HAS_DEPENDENCIES
CLASS_FULL
CLASS_NOT_ACTIVE
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
```

Do not make the frontend depend on raw database error strings.

------------------------------------------------------------------------

# 40. Testing Checklist

The IDE AI should create tests for:

## Create

``` text
[ ] valid class creates successfully
[ ] empty name rejected
[ ] empty code rejected
[ ] invalid capacity rejected
[ ] missing academic year rejected
[ ] duplicate code returns 409
```

## Update

``` text
[ ] valid update succeeds
[ ] unknown class returns 404
[ ] duplicate code returns 409
[ ] invalid capacity rejected
[ ] invalid academic year rejected
```

## Archive

``` text
[ ] active class can be archived
[ ] archivedAt is populated
[ ] archived class is not returned when filtering ACTIVE
```

## Delete

``` text
[ ] unknown class returns 404
[ ] class with dependencies cannot be permanently deleted
[ ] class without dependencies can be permanently deleted
```

## Search

``` text
[ ] search by name
[ ] search by code
[ ] search by section
[ ] pagination works
[ ] status filter works
[ ] academic year filter works
```

## Capacity

``` text
[ ] normal class
[ ] 80% class
[ ] full class
[ ] over-capacity class
[ ] zero/invalid capacity
```

------------------------------------------------------------------------

# 41. Migration Safety Checklist

Before modifying the existing production database:

``` text
[ ] Backup database
[ ] Inspect current schema
[ ] Inspect Student relations
[ ] Inspect Teacher/Staff model
[ ] Inspect authentication User model
[ ] Inspect Attendance relations
[ ] Inspect Exam relations
[ ] Inspect existing Class records
[ ] Inspect duplicate class codes
[ ] Inspect null/invalid capacities
[ ] Decide academic-year mapping for existing classes
[ ] Decide how old teacher strings map to teacher IDs
```

Only then run the migration.

------------------------------------------------------------------------

# 42. Variable/Parameter Consistency Matrix

This matrix must be followed across Prisma, API, backend, frontend and
forms.

  Concept                     Canonical name
  --------------------------- ------------------
  Class primary key           `id`
  Academic year primary key   `academicYearId`
  Student reference           `studentId`
  Teacher reference           `teacherId`
  Subject reference           `subjectId`
  Class reference             `classId`
  Class name                  `name`
  Section                     `section`
  Class code                  `code`
  Capacity                    `capacity`
  Class status                `status`
  Student count               `studentCount`
  Enrollment status           `status`
  Enrollment date             `enrollmentDate`
  Exit date                   `exitDate`
  Roll number                 `rollNumber`

Do not introduce aliases such as:

``` text
courseId
classID
class_id
teacherID
teacherName
studentTotal
maxStudents
```

unless there is a strong existing project convention requiring them.

------------------------------------------------------------------------

# 43. IDE AI Rules To Prevent Mismatches

Give the IDE AI these rules before implementation:

``` text
1. Inspect the existing Prisma schema before editing it.
2. Reuse existing models instead of creating duplicates.
3. Reuse existing authentication middleware.
4. Reuse existing API client conventions.
5. Never rename an existing field without updating every reference.
6. Search the entire repository for every renamed variable.
7. Keep API request and response contracts synchronized.
8. Keep Prisma relation names synchronized with include/select names.
9. Run Prisma validation after schema changes.
10. Run the frontend build after frontend changes.
11. Run the backend tests after API changes.
12. Do not invent model names or middleware names.
13. Do not mix `_id` and `id`.
14. Do not mix `teacher`, `teacherName`, and `teacherId`.
15. Do not mix `course`, `class`, and `classId`.
16. Do not silently change unrelated modules.
17. Make one migration at a time.
18. Do not delete old data during migration unless explicitly instructed.
19. Before removing a field, migrate its data.
20. After every phase, report changed files and validation results.
```

------------------------------------------------------------------------

# 44. Recommended IDE AI Implementation Prompt

Paste this into the IDE AI before asking it to implement the changes:

``` text
You are modifying an existing Madrasa Management System.

The target module is Courses & Classes.

IMPORTANT:
Do not start coding immediately.

FIRST:
1. Inspect the entire existing Prisma schema.
2. Find the existing Student model.
3. Find the existing Teacher/Staff model.
4. Find the existing User/authentication model.
5. Find existing Attendance, Exam and Result relations.
6. Find existing AcademicYear/Session models.
7. Find the existing API client implementation.
8. Find existing authentication and authorization middleware.
9. Find all references to the Class model.
10. Find whether the project uses Prisma id, Mongo _id, or another identifier.

Do not create duplicate models.

Before changing anything, produce a compatibility report containing:
- Existing model names
- Existing primary keys
- Existing relation names
- Existing route conventions
- Existing authentication middleware
- Existing error-handling middleware
- Existing API response format

Then implement the Courses & Classes robustness upgrade.

Canonical names for new code:
- Class
- AcademicYear
- Enrollment
- ClassTeacher
- Subject
- ClassSubject
- AuditLog
- classId
- academicYearId
- studentId
- teacherId
- subjectId
- userId

Do not use _id unless the existing project's actual database contract requires it.

Requirements:
1. Add backend validation.
2. Add centralized error handling if not already present.
3. Add proper 404 and 409 handling.
4. Add academic-year support.
5. Replace plain teacher-name storage with a proper existing Teacher/Staff relationship where possible.
6. Add Enrollment.
7. Add ClassTeacher.
8. Add Subject/ClassSubject.
9. Add Class status/lifecycle.
10. Replace normal hard deletion with archive.
11. Block permanent deletion when dependent records exist.
12. Add audit logging using the existing User model.
13. Add server-side pagination.
14. Add server-side search.
15. Add status and academic-year filters.
16. Add proper capacity status handling.
17. Prevent enrollment beyond capacity according to the database's actual concurrency capabilities.
18. Keep API request/response field names synchronized.
19. Update frontend API service.
20. Update Courses.jsx.
21. Preserve existing visual design unless a change is required.
22. Preserve existing route `/courses`.
23. Do not break unrelated modules.

After implementation:
- Run `npx prisma format`
- Run `npx prisma validate`
- Run the appropriate migration command
- Run backend tests
- Run frontend lint
- Run frontend build
- Search the repository for old field names
- Search for `_id` references related to classes
- Search for old teacher string references
- Verify every API parameter matches its backend counterpart

If any existing model differs from the assumptions in this task, STOP and adapt the implementation to the existing model rather than creating a duplicate.

Do not claim completion until the project builds successfully.
```

------------------------------------------------------------------------

# 45. Implementation Order

Do not ask the IDE AI to change everything in one uncontrolled
operation.

Use this order:

## Step 1

``` text
Schema inspection
```

## Step 2

``` text
AcademicYear + Class status
```

## Step 3

``` text
Enrollment
```

## Step 4

``` text
Teacher relationship
```

## Step 5

``` text
Subject + ClassSubject
```

## Step 6

``` text
Validation + errors
```

## Step 7

``` text
Safe archive/delete
```

## Step 8

``` text
Audit logs
```

## Step 9

``` text
Pagination + search + filters
```

## Step 10

``` text
Frontend adaptation
```

## Step 11

``` text
Tests
```

## Step 12

``` text
Build + migration verification
```

This staged approach is much safer than giving an IDE AI one enormous
instruction and letting it modify the entire project at once.

------------------------------------------------------------------------

# 46. Final Definition of Done

The module is considered robust only when:

``` text
[ ] Prisma schema validates
[ ] Database migration succeeds
[ ] Existing data is preserved
[ ] Authentication is enforced
[ ] Permissions are enforced
[ ] Backend validation works
[ ] Duplicate codes return 409
[ ] Missing classes return 404
[ ] Errors use a consistent contract
[ ] Academic years work
[ ] Teacher relationships work
[ ] Enrollment works
[ ] Capacity rules work
[ ] Classes can be archived
[ ] Dangerous deletion is protected
[ ] Audit logs are recorded
[ ] Subjects can be attached
[ ] Pagination works
[ ] Search works server-side
[ ] Filters work
[ ] React build succeeds
[ ] Backend tests pass
[ ] No `_id`/`id` mismatch exists
[ ] No teacherName/teacherId mismatch exists
[ ] No class/course naming mismatch exists
[ ] API request/response contracts match
[ ] Existing `/courses` route still works
[ ] Existing unrelated modules still work
```

------------------------------------------------------------------------

# 47. Final Principle

The purpose of this implementation is not simply to make the existing
page more complicated.

The goal is to transform:

``` text
Simple Class CRUD
```

into:

``` text
Academic Class Management
```

with:

``` text
Academic Year
      |
      v
Class
 ├── Section
 ├── Teachers
 ├── Subjects
 ├── Enrollments
 ├── Capacity
 ├── Timetable
 ├── Attendance
 ├── Exams
 ├── Results
 └── Audit History
```

The existing React UI is a usable starting point. The major robustness
work belongs in the data model, API contracts, validation, permissions,
lifecycle management and historical data handling.
