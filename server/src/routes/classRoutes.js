/**
 * Class Routes — Robust CRUD API for class/course management
 * Altus Kairos — Tenant & Relationship Integrity Hardening
 */

const express = require('express');
const router = express.Router();
const AppError = require('../utils/AppError');
const { validateClassPayload } = require('../validators/classValidator');

const requirePermission = require('../middleware/requirePermission');
const { requireInstitutionContext } = require('../middleware/institutionContext');
const requireModuleEnabled = require('../middleware/requireModuleEnabled');
const auditService = require('../services/auditService');
const {
  getCurrentAcademicYear,
  getAcademicYearForInstitution,
} = require('../services/academicYearService');

router.use(requireInstitutionContext);
router.use(requireModuleEnabled('coursesEnabled'));

/**
 * Builds where clause strictly scoped to the active institution
 */
const buildClassWhere = ({ search, status, academicYearId, institutionId }) => {
  const where = {
    academicYear: {
      institutionId,
    },
  };

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
        { name: { contains: normalizedSearch, mode: 'insensitive' } },
        { code: { contains: normalizedSearch, mode: 'insensitive' } },
        { section: { contains: normalizedSearch, mode: 'insensitive' } },
        { teacher: { contains: normalizedSearch, mode: 'insensitive' } },
        {
          teachers: {
            some: {
              teacher: {
                name: { contains: normalizedSearch, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }
  }

  return where;
};

/**
 * GET /api/classes
 * Fetch all classes for current institution with pagination, search, status filter, and counts
 */
router.get('/', requirePermission('courses.view'), async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const academicYearId = typeof req.query.academicYearId === 'string' ? req.query.academicYearId : '';

    const where = buildClassWhere({
      search,
      status,
      academicYearId,
      institutionId: req.institutionId,
    });

    const [classes, total] = await Promise.all([
      req.prisma.class.findMany({
        where,
        include: {
          academicYear: true,
          teachers: {
            include: { teacher: true },
          },
          _count: {
            select: {
              students: true,
              enrollments: { where: { status: 'ACTIVE' } },
              teachers: true,
              subjects: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }, { section: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      req.prisma.class.count({ where }),
    ]);

    const data = classes.map((cls) => {
      const mainTeacherRecord = cls.teachers.find((t) => t.role === 'Main Teacher') || cls.teachers[0];
      const assignedTeacherName = mainTeacherRecord?.teacher?.name || cls.teacher || null;

      return {
        id: cls.id,
        name: cls.name,
        section: cls.section,
        code: cls.code,
        teacher: assignedTeacherName,
        capacity: cls.capacity,
        status: cls.status,
        academicYearId: cls.academicYearId,
        academicYear: cls.academicYear,
        studentCount: cls._count.enrollments,
        enrollmentCount: cls._count.enrollments,
        teacherCount: cls._count.teachers,
        subjectCount: cls._count.subjects,
        createdAt: cls.createdAt,
        updatedAt: cls.updatedAt,
        archivedAt: cls.archivedAt,
      };
    });

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/classes/:id
 * Fetch single class details ensuring institution scope
 */
router.get('/:id', requirePermission('courses.view'), async (req, res, next) => {
  try {
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
            enrollments: { where: { status: 'ACTIVE' } },
            teachers: true,
            subjects: true,
          },
        },
      },
    });

    if (!classRecord) {
      throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
    }

    const mainTeacherRecord = classRecord.teachers.find((t) => t.role === 'Main Teacher') || classRecord.teachers[0];
    const assignedTeacherName = mainTeacherRecord?.teacher?.name || classRecord.teacher || null;

    res.json({
      success: true,
      data: {
        id: classRecord.id,
        name: classRecord.name,
        section: classRecord.section,
        code: classRecord.code,
        teacher: assignedTeacherName,
        capacity: classRecord.capacity,
        status: classRecord.status,
        academicYearId: classRecord.academicYearId,
        academicYear: classRecord.academicYear,
        studentCount: classRecord._count.enrollments,
        enrollmentCount: classRecord._count.enrollments,
        teacherCount: classRecord._count.teachers,
        subjectCount: classRecord._count.subjects,
        createdAt: classRecord.createdAt,
        updatedAt: classRecord.updatedAt,
        archivedAt: classRecord.archivedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/classes
 * Create a new class inside a transactional boundary with institution-scoped AcademicYear resolution
 */
router.post('/', requirePermission('courses.manage'), async (req, res, next) => {
  try {
    const contentLength = req.headers['content-length'];
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body) ||
      contentLength === '0' ||
      !contentLength
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
      throw new AppError(firstError || 'Validation failed', 422, 'VALIDATION_ERROR');
    }

    let { name, section, code, capacity, teacher, academicYearId } = validation.data;

    const newClass = await req.prisma.$transaction(async (tx) => {
      // Resolve AcademicYear strictly for the current institution
      const academicYear = academicYearId
        ? await getAcademicYearForInstitution(tx, req.institutionId, academicYearId)
        : await getCurrentAcademicYear(tx, req.institutionId);

      academicYearId = academicYear.id;

      if (academicYear.status !== 'ACTIVE') {
        throw new AppError(
          'Classes can only be created in an active academic year.',
          409,
          'ACADEMIC_YEAR_NOT_ACTIVE'
        );
      }

      // Check code uniqueness within academic year
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

      // Synchronize normalized Teacher & ClassTeacher for the institution
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
          update: { role: 'Main Teacher' },
          create: {
            classId: created.id,
            teacherId: teacherRecord.id,
            role: 'Main Teacher',
          },
        });
      }

      // Audit Log
      await auditService.record(tx, {
        institutionId: req.institutionId,
        action: 'CLASS_CREATED',
        entityType: 'Class',
        entityId: created.id,
        afterData: created,
      });

      return created;
    });

    res.status(201).json({ success: true, data: newClass });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/classes/:id
 * Update a class inside a transactional boundary with institution scope and teacher normalization
 */
router.put('/:id', requirePermission('courses.manage'), async (req, res, next) => {
  try {
    const contentLength = req.headers['content-length'];
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body) ||
      contentLength === '0' ||
      !contentLength
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
      throw new AppError(firstError || 'Validation failed', 422, 'VALIDATION_ERROR');
    }

    let { name, section, code, capacity, teacher, academicYearId } = validation.data;

    const updatedClass = await req.prisma.$transaction(async (tx) => {
      const existingClass = await tx.class.findFirst({
        where: {
          id: req.params.id,
          academicYear: {
            institutionId: req.institutionId,
          },
        },
      });

      if (!existingClass) {
        throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
      }

      if (academicYearId) {
        await getAcademicYearForInstitution(tx, req.institutionId, academicYearId);
      } else {
        academicYearId = existingClass.academicYearId;
      }

      // Check code uniqueness within academic year (excluding current class)
      const duplicate = await tx.class.findFirst({
        where: {
          academicYearId,
          code,
          NOT: { id: req.params.id },
        },
      });

      if (duplicate) {
        throw new AppError(
          `Class with code "${code}" already exists in this academic year`,
          409,
          'CLASS_CODE_EXISTS'
        );
      }

      const updated = await tx.class.update({
        where: { id: req.params.id },
        data: {
          name,
          section,
          code,
          capacity,
          teacher: teacher || null,
          academicYearId,
        },
      });

      // Synchronize normalized Main Teacher relationship
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

        // Delete any existing Main Teacher assignment for this class to prevent multiple main teachers
        await tx.classTeacher.deleteMany({
          where: {
            classId: updated.id,
            role: 'Main Teacher',
          },
        });

        await tx.classTeacher.create({
          data: {
            classId: updated.id,
            teacherId: teacherRecord.id,
            role: 'Main Teacher',
          },
        });
      } else {
        // Teacher cleared — remove previous Main Teacher assignment
        await tx.classTeacher.deleteMany({
          where: {
            classId: updated.id,
            role: 'Main Teacher',
          },
        });
      }

      // Audit Log
      await auditService.record(tx, {
        institutionId: req.institutionId,
        action: 'CLASS_UPDATED',
        entityType: 'Class',
        entityId: updated.id,
        beforeData: existingClass,
        afterData: updated,
      });

      return updated;
    });

    res.json({ success: true, data: updatedClass });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/classes/:id/status
 * Update status with institution scope
 */
router.patch('/:id/status', requirePermission('courses.manage'), async (req, res, next) => {
  try {
    const allowedStatuses = ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'];
    const status = typeof req.body.status === 'string' ? req.body.status : '';

    if (!allowedStatuses.includes(status)) {
      throw new AppError('Invalid class status', 422, 'INVALID_CLASS_STATUS');
    }

    const existingClass = await req.prisma.class.findFirst({
      where: {
        id: req.params.id,
        academicYear: {
          institutionId: req.institutionId,
        },
      },
    });

    if (!existingClass) {
      throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
    }

    const updatedClass = await req.prisma.class.update({
      where: { id: req.params.id },
      data: {
        status,
        archivedAt: status === 'ARCHIVED' ? new Date() : null,
      },
    });

    res.json({ success: true, data: updatedClass });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/classes/:id
 * Delete or archive class ensuring institution scope
 */
router.delete('/:id', requirePermission('courses.manage'), async (req, res, next) => {
  try {
    const existingClass = await req.prisma.class.findFirst({
      where: {
        id: req.params.id,
        academicYear: {
          institutionId: req.institutionId,
        },
      },
      include: {
        _count: {
          select: {
            students: true,
            enrollments: true,
            exams: true,
            attendances: true,
            teachers: true,
            subjects: true,
          },
        },
      },
    });

    if (!existingClass) {
      throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
    }

    const hasDependencies =
      existingClass._count.students > 0 ||
      existingClass._count.enrollments > 0 ||
      existingClass._count.exams > 0 ||
      existingClass._count.attendances > 0 ||
      existingClass._count.teachers > 0 ||
      existingClass._count.subjects > 0;

    if (hasDependencies) {
      const archived = await req.prisma.class.update({
        where: { id: req.params.id },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        archived: true,
        message: 'Class has linked records and was archived instead of permanently deleted.',
        data: archived,
      });
    }

    await req.prisma.class.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Class permanently deleted',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
