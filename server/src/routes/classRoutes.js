/**
 * Class Routes — Robust CRUD API for class/course management
 */

const express = require('express');
const router = express.Router();
const AppError = require('../utils/AppError');
const { validateClassPayload } = require('../validators/classValidator');

const requirePermission = require('../middleware/requirePermission');
const { requireInstitutionContext } = require('../middleware/institutionContext');
const requireModuleEnabled = require('../middleware/requireModuleEnabled');
const auditService = require('../services/auditService');

router.use(requireInstitutionContext);
router.use(requireModuleEnabled('coursesEnabled'));

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
 * Fetch all classes with pagination, search, status filter, and counts
 */
router.get('/', requirePermission('courses.view'), async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const academicYearId = typeof req.query.academicYearId === 'string' ? req.query.academicYearId : '';

    const where = buildClassWhere({ search, status, academicYearId });

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
      const mainTeacherRecord = cls.teachers.find(t => t.role === 'Main Teacher') || cls.teachers[0];
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
        studentCount: cls._count.enrollments, // Authoritative active enrollment count
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
 * Fetch single class details
 */
router.get('/:id', requirePermission('courses.view'), async (req, res, next) => {
  try {
    const classRecord = await req.prisma.class.findUnique({
      where: { id: req.params.id },
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

    const mainTeacherRecord = classRecord.teachers.find(t => t.role === 'Main Teacher') || classRecord.teachers[0];
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
 * Create a new class inside a transactional boundary
 */
router.post('/', requirePermission('courses.manage'), async (req, res, next) => {
  try {
    const validation = validateClassPayload(req.body);

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      throw new AppError(firstError || 'Validation failed', 422, 'VALIDATION_ERROR');
    }

    let { name, section, code, capacity, teacher, academicYearId } = validation.data;

    // Transactional atomic creation
    const newClass = await req.prisma.$transaction(async (tx) => {
      if (!academicYearId) {
        const activeYear = await tx.academicYear.findFirst({ where: { isCurrent: true } });
        if (!activeYear) {
          throw new AppError(
            'An active academic year must be configured before creating a class.',
            409,
            'ACTIVE_ACADEMIC_YEAR_REQUIRED'
          );
        }
        academicYearId = activeYear.id;
      } else {
        const specifiedYear = await tx.academicYear.findUnique({ where: { id: academicYearId } });
        if (!specifiedYear) {
          throw new AppError('Specified academic year not found', 404, 'ACADEMIC_YEAR_NOT_FOUND');
        }
      }

      const existing = await tx.class.findUnique({ where: { code } });
      if (existing) {
        throw new AppError(`Class with code "${code}" already exists`, 409, 'CLASS_CODE_EXISTS');
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

      // Synchronize Teacher & ClassTeacher model
      if (teacher && teacher.trim()) {
        let t = await tx.teacher.findFirst({ where: { name: teacher.trim() } });
        if (!t) {
          t = await tx.teacher.create({ data: { name: teacher.trim(), isActive: true } });
        }
        await tx.classTeacher.upsert({
          where: { classId_teacherId: { classId: created.id, teacherId: t.id } },
          update: { role: 'Main Teacher' },
          create: { classId: created.id, teacherId: t.id, role: 'Main Teacher' },
        });
      }

      // Write Audit Log
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
 * Update a class inside a transactional boundary
 */
router.put('/:id', requirePermission('courses.manage'), async (req, res, next) => {
  try {
    const validation = validateClassPayload(req.body);

    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      throw new AppError(firstError || 'Validation failed', 422, 'VALIDATION_ERROR');
    }

    let { name, section, code, capacity, teacher, academicYearId } = validation.data;

    const updatedClass = await req.prisma.$transaction(async (tx) => {
      const existingClass = await tx.class.findUnique({
        where: { id: req.params.id },
      });

      if (!existingClass) {
        throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
      }

      if (!academicYearId) {
        academicYearId = existingClass.academicYearId;
      }

      const duplicate = await tx.class.findFirst({
        where: {
          code,
          NOT: { id: req.params.id },
        },
      });

      if (duplicate) {
        throw new AppError(`Class with code "${code}" already exists`, 409, 'CLASS_CODE_EXISTS');
      }

      const updated = await tx.class.update({
        where: { id: req.params.id },
        data: {
          name,
          section,
          code,
          capacity,
          teacher,
          academicYearId,
        },
      });

      // Synchronize Teacher & ClassTeacher model
      if (teacher && teacher.trim()) {
        let t = await tx.teacher.findFirst({ where: { name: teacher.trim() } });
        if (!t) {
          t = await tx.teacher.create({ data: { name: teacher.trim(), isActive: true } });
        }
        await tx.classTeacher.upsert({
          where: { classId_teacherId: { classId: updated.id, teacherId: t.id } },
          update: { role: 'Main Teacher' },
          create: { classId: updated.id, teacherId: t.id, role: 'Main Teacher' },
        });
      }

      // Write Audit Log
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
 */
router.patch('/:id/status', requirePermission('courses.manage'), async (req, res, next) => {
  try {
    const allowedStatuses = ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'];
    const status = typeof req.body.status === 'string' ? req.body.status : '';

    if (!allowedStatuses.includes(status)) {
      throw new AppError('Invalid class status', 422, 'INVALID_CLASS_STATUS');
    }

    const existingClass = await req.prisma.class.findUnique({
      where: { id: req.params.id },
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
 */
router.delete('/:id', requirePermission('courses.manage'), async (req, res, next) => {
  try {
    const existingClass = await req.prisma.class.findUnique({
      where: { id: req.params.id },
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
