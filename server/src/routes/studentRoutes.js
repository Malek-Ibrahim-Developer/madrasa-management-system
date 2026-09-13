/**
 * Student Routes — Enhanced CRUD API with custom fields, advanced filters, sorting,
 * Authoritative Enrollment Architecture, and Server-Side Pagination.
 * Altus Kairos — Tenant & Relationship Integrity Hardening
 */

const express = require('express');
const router = express.Router();
const AppError = require('../utils/AppError');

const requirePermission = require('../middleware/requirePermission');
const { requireInstitutionContext } = require('../middleware/institutionContext');
const requireModuleEnabled = require('../middleware/requireModuleEnabled');
const { getCurrentAcademicYear } = require('../services/academicYearService');

// All student routes require institution context and students module
router.use(requireInstitutionContext);
router.use(requireModuleEnabled('studentsEnabled'));

/**
 * Helper to resolve active academic year for the institution
 */
async function resolveActiveAcademicYear(tx, institutionId) {
  return await getCurrentAcademicYear(tx, institutionId);
}

/**
 * Helper to validate & row-lock target class strictly scoped to institution
 */
async function validateAndLockTargetClass(tx, targetClassId, activeAcademicYearId, institutionId) {
  const targetClasses = await tx.$queryRaw`
    SELECT
      c.id,
      c.status,
      c."academicYearId",
      c.capacity,
      ay."institutionId"
    FROM "classes" c
    JOIN "academic_years" ay ON ay.id = c."academicYearId"
    WHERE c.id = ${targetClassId}
    FOR UPDATE OF c
  `;

  const targetClass = targetClasses[0];
  if (!targetClass || targetClass.institutionId !== institutionId) {
    throw new AppError('Target class not found', 404, 'CLASS_NOT_FOUND');
  }

  if (targetClass.status !== 'ACTIVE' || targetClass.academicYearId !== activeAcademicYearId) {
    throw new AppError(
      'Target class is invalid, inactive, or belongs to a different academic year',
      422,
      'INVALID_TARGET_CLASS'
    );
  }

  const activeCount = await tx.enrollment.count({
    where: { classId: targetClassId, status: 'ACTIVE' },
  });
  if (activeCount >= targetClass.capacity) {
    throw new AppError('Class capacity limit reached. Cannot enroll student.', 409, 'CLASS_CAPACITY_EXCEEDED');
  }
  return targetClass;
}

/**
 * Helper to fetch a student with deterministic active enrollment mapping & corruption detection
 */
async function getDeterministicStudent(prisma, studentId, institutionId) {
  let activeAcademicYear = null;
  try {
    activeAcademicYear = await getCurrentAcademicYear(prisma, institutionId);
  } catch (err) {
    // If no active year is configured, still allow reading student metadata
    activeAcademicYear = null;
  }

  const rawStudent = await prisma.student.findFirst({
    where: {
      id: studentId,
      institutionId,
    },
    include: {
      customFieldValues: {
        where: {
          customField: { institutionId },
        },
        include: {
          customField: {
            select: { id: true, fieldKey: true, name: true, fieldType: true, section: true },
          },
        },
      },
    },
  });

  if (!rawStudent) return null;

  let activeEnrollment = null;
  if (activeAcademicYear) {
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        studentId,
        academicYearId: activeAcademicYear.id,
        status: 'ACTIVE',
      },
      include: { class: { select: { id: true, name: true, code: true } } },
    });

    if (activeEnrollments.length > 1) {
      throw new AppError(
        'Data integrity conflict: Student has multiple active enrollments in the current academic year.',
        409,
        'MULTIPLE_ACTIVE_ENROLLMENTS'
      );
    }

    activeEnrollment = activeEnrollments[0] ?? null;
  }

  const currentClass = activeEnrollment?.class ?? null;

  return {
    ...rawStudent,
    classId: activeEnrollment?.classId ?? null,
    class: currentClass,
  };
}

/**
 * GET /api/students
 * Fetch students with search, advanced filters, sorting, pagination strictly scoped to current institution
 */
router.get('/', requirePermission('students.view'), async (req, res, next) => {
  try {
    const {
      search, classId, status, gender, bloodGroup,
      dateFrom, dateTo, ageMin, ageMax,
      sortBy = 'createdAt', sortOrder = 'desc',
      page = 1, pageSize, limit,
    } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedPageSize = Math.min(Math.max(parseInt(pageSize || limit || 25, 10) || 25, 1), 100);
    const skip = (parsedPage - 1) * parsedPageSize;
    const normalizedSortOrder = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    let students = [];
    let total = 0;

    if (sortBy === 'class') {
      const direction = normalizedSortOrder === 'asc' ? 'ASC' : 'DESC';
      const conditions = [];
      const queryParams = [];
      let paramIdx = 1;

      // Strict institution isolation in raw query
      conditions.push(`s."institutionId" = $${paramIdx}`);
      queryParams.push(req.institutionId);
      paramIdx++;

      if (search) {
        conditions.push(`(
          s."firstName" ILIKE $${paramIdx} OR
          s."lastName" ILIKE $${paramIdx} OR
          s."admissionNo" ILIKE $${paramIdx} OR
          s."fatherName" ILIKE $${paramIdx} OR
          s."guardianName" ILIKE $${paramIdx} OR
          s."phone" ILIKE $${paramIdx}
        )`);
        queryParams.push(`%${search}%`);
        paramIdx++;
      }

      if (classId) {
        conditions.push(`EXISTS (
          SELECT 1 FROM "enrollments" e_filt
          JOIN "academic_years" ay_filt ON ay_filt.id = e_filt."academicYearId"
          WHERE e_filt."studentId" = s.id
            AND e_filt."classId" = $${paramIdx}
            AND e_filt."status" = 'ACTIVE'
            AND ay_filt."isCurrent" = true
            AND ay_filt."institutionId" = $1
        )`);
        queryParams.push(classId);
        paramIdx++;
      }

      if (status) {
        conditions.push(`s."status" = $${paramIdx}::"StudentStatus"`);
        queryParams.push(status);
        paramIdx++;
      }

      if (gender) {
        conditions.push(`s."gender" = $${paramIdx}::"Gender"`);
        queryParams.push(gender);
        paramIdx++;
      }

      if (bloodGroup) {
        conditions.push(`s."bloodGroup" = $${paramIdx}`);
        queryParams.push(bloodGroup);
        paramIdx++;
      }

      if (dateFrom) {
        conditions.push(`s."admissionDate" >= $${paramIdx}::timestamp`);
        queryParams.push(new Date(dateFrom).toISOString());
        paramIdx++;
      }

      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setUTCHours(23, 59, 59, 999);
        conditions.push(`s."admissionDate" <= $${paramIdx}::timestamp`);
        queryParams.push(endOfDay.toISOString());
        paramIdx++;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM "students" s
        ${whereClause}
      `;

      const dataSql = `
        SELECT s.id
        FROM "students" s
        LEFT JOIN "enrollments" e ON e."studentId" = s.id AND e."status" = 'ACTIVE'
        LEFT JOIN "academic_years" ay ON ay.id = e."academicYearId" AND ay."isCurrent" = true AND ay."institutionId" = $1
        LEFT JOIN "classes" c ON c.id = e."classId"
        ${whereClause}
        ORDER BY c.name ${direction} NULLS LAST, s.id ASC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `;
      const dataParams = [...queryParams, parsedPageSize, skip];

      const [countRes, idRows] = await Promise.all([
        req.prisma.$queryRawUnsafe(countSql, ...queryParams),
        req.prisma.$queryRawUnsafe(dataSql, ...dataParams),
      ]);

      total = countRes[0]?.total || 0;
      const orderedIds = idRows.map((r) => r.id);

      if (orderedIds.length > 0) {
        const rawStudents = await req.prisma.student.findMany({
          where: {
            id: { in: orderedIds },
            institutionId: req.institutionId,
          },
          include: {
            enrollments: {
              where: {
                status: 'ACTIVE',
                academicYear: { isCurrent: true, institutionId: req.institutionId },
              },
              include: { class: { select: { id: true, name: true, code: true } } },
              take: 2,
            },
          },
        });

        const idMap = new Map(rawStudents.map((s) => [s.id, s]));
        students = orderedIds.map((id) => idMap.get(id)).filter(Boolean);
      }
    } else {
      // Standard Prisma query strictly scoped to current institution
      const where = {
        institutionId: req.institutionId,
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { admissionNo: { contains: search, mode: 'insensitive' } },
          { fatherName: { contains: search, mode: 'insensitive' } },
          { guardianName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (classId) {
        where.enrollments = {
          some: {
            classId,
            status: 'ACTIVE',
            academicYear: { isCurrent: true, institutionId: req.institutionId },
          },
        };
      }

      if (status) where.status = status;
      if (gender) where.gender = gender;
      if (bloodGroup) where.bloodGroup = bloodGroup;

      if (dateFrom || dateTo) {
        where.admissionDate = {};
        if (dateFrom) where.admissionDate.gte = new Date(dateFrom);
        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setUTCHours(23, 59, 59, 999);
          where.admissionDate.lte = endOfDay;
        }
      }

      if (ageMin || ageMax) {
        where.dateOfBirth = {};
        const today = new Date();
        if (ageMax) {
          const minDOB = new Date(today.getFullYear() - parseInt(ageMax, 10) - 1, today.getMonth(), today.getDate());
          where.dateOfBirth.gte = minDOB;
        }
        if (ageMin) {
          const maxDOB = new Date(today.getFullYear() - parseInt(ageMin, 10), today.getMonth(), today.getDate());
          where.dateOfBirth.lte = maxDOB;
        }
      }

      let primarySort = { createdAt: normalizedSortOrder };
      const validSortFields = {
        name: { firstName: normalizedSortOrder },
        admissionDate: { admissionDate: normalizedSortOrder },
        admissionNo: { admissionNo: normalizedSortOrder },
        status: { status: normalizedSortOrder },
        createdAt: { createdAt: normalizedSortOrder },
      };
      if (validSortFields[sortBy]) {
        primarySort = validSortFields[sortBy];
      }
      const orderBy = [primarySort, { id: 'asc' }];

      const [rawStudents, count] = await Promise.all([
        req.prisma.student.findMany({
          where,
          include: {
            enrollments: {
              where: {
                status: 'ACTIVE',
                academicYear: { isCurrent: true, institutionId: req.institutionId },
              },
              include: { class: { select: { id: true, name: true, code: true } } },
              take: 2,
            },
          },
          orderBy,
          skip,
          take: parsedPageSize,
        }),
        req.prisma.student.count({ where }),
      ]);

      students = rawStudents;
      total = count;
    }

    const mappedData = students.map((s) => {
      const activeEnrollments = s.enrollments || [];
      if (activeEnrollments.length > 1) {
        console.warn(`[DATA CORRUPTION] Student ${s.id} (${s.firstName} ${s.lastName}) has ${activeEnrollments.length} ACTIVE enrollments in the current academic year.`);
      }

      const activeEnrollment = activeEnrollments[0] ?? null;
      const currentClass = activeEnrollment?.class ?? null;

      return {
        ...s,
        classId: activeEnrollment?.classId ?? null,
        class: currentClass,
        _hasIntegrityConflict: activeEnrollments.length > 1,
      };
    });

    const totalPages = total > 0 ? Math.ceil(total / parsedPageSize) : 0;

    res.json({
      success: true,
      data: mappedData,
      pagination: {
        page: parsedPage,
        pageSize: parsedPageSize,
        limit: parsedPageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/students/:id
 * Fetch single student ensuring institution ownership
 */
router.get('/:id', requirePermission('students.view'), async (req, res, next) => {
  try {
    const student = await getDeterministicStudent(req.prisma, req.params.id, req.institutionId);

    if (!student) {
      throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
    }

    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/students
 * Transactional creation + capacity validation + active enrollment creation with tenant scoping
 */
router.post('/', requirePermission('students.create'), async (req, res, next) => {
  try {
    const {
      admissionNo, firstName, lastName, fatherName, motherName,
      email, phone, dateOfBirth, gender, address,
      admissionDate, classId, status,
      guardianName, guardianPhone, guardianEmail, guardianRelation,
      bloodGroup, nationality, idNumber, previousSchool,
      emergencyContact, medicalNotes,
      customFields,
    } = req.body;

    if (!admissionNo || !firstName || !lastName) {
      throw new AppError('Admission number, first name, and last name are required', 400, 'VALIDATION_ERROR');
    }

    const trimmedAdmissionNo = admissionNo.trim();

    // Check duplicate admissionNo within this institution
    const existing = await req.prisma.student.findUnique({
      where: {
        institutionId_admissionNo: {
          institutionId: req.institutionId,
          admissionNo: trimmedAdmissionNo,
        },
      },
    });
    if (existing) {
      throw new AppError(`Student with admission number "${trimmedAdmissionNo}" already exists`, 409, 'DUPLICATE_ADMISSION_NO');
    }

    // Transactional atomic execution
    const newStudent = await req.prisma.$transaction(async (tx) => {
      let activeAcademicYear = null;

      if (classId) {
        activeAcademicYear = await resolveActiveAcademicYear(tx, req.institutionId);
        await validateAndLockTargetClass(tx, classId, activeAcademicYear.id, req.institutionId);
      }

      // Create student record with explicit institutionId
      const createdStudent = await tx.student.create({
        data: {
          institutionId: req.institutionId,
          admissionNo: trimmedAdmissionNo,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fatherName: fatherName ? fatherName.trim() : null,
          motherName: motherName ? motherName.trim() : null,
          email: email ? email.trim() : null,
          phone: phone ? phone.trim() : null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || 'MALE',
          address: address ? address.trim() : null,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          classId: classId || null,
          status: status || 'ACTIVE',
          guardianName: guardianName ? guardianName.trim() : null,
          guardianPhone: guardianPhone ? guardianPhone.trim() : null,
          guardianEmail: guardianEmail ? guardianEmail.trim() : null,
          guardianRelation: guardianRelation ? guardianRelation.trim() : null,
          bloodGroup: bloodGroup || null,
          nationality: nationality || 'Indian',
          idNumber: idNumber ? idNumber.trim() : null,
          previousSchool: previousSchool ? previousSchool.trim() : null,
          emergencyContact: emergencyContact ? emergencyContact.trim() : null,
          medicalNotes: medicalNotes ? medicalNotes.trim() : null,
        },
      });

      // Create active enrollment if classId provided
      if (classId && activeAcademicYear) {
        await tx.enrollment.create({
          data: {
            studentId: createdStudent.id,
            classId,
            academicYearId: activeAcademicYear.id,
            status: 'ACTIVE',
            enrollmentDate: admissionDate ? new Date(admissionDate) : new Date(),
          },
        });
      }

      return createdStudent;
    });

    // Save custom field values if provided
    if (customFields && typeof customFields === 'object') {
      await saveCustomFieldValues(req.prisma, req.institutionId, newStudent.id, customFields);
    }

    const full = await getDeterministicStudent(req.prisma, newStudent.id, req.institutionId);
    res.status(201).json({ success: true, data: full });
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('enrollments')) {
      return next(new AppError('Concurrent enrollment conflict: Student already has an active enrollment in this academic year', 409, 'CONCURRENT_ENROLLMENT_CONFLICT'));
    }
    next(error);
  }
});

/**
 * PUT /api/students/:id
 * Transactional update with explicit classId handling & institution scoping
 */
router.put('/:id', requirePermission('students.edit'), async (req, res, next) => {
  try {
    const {
      admissionNo, firstName, lastName, fatherName, motherName,
      email, phone, dateOfBirth, gender, address,
      admissionDate, classId, status,
      guardianName, guardianPhone, guardianEmail, guardianRelation,
      bloodGroup, nationality, idNumber, previousSchool,
      emergencyContact, medicalNotes,
      customFields,
    } = req.body;

    const existingStudent = await req.prisma.student.findFirst({
      where: {
        id: req.params.id,
        institutionId: req.institutionId,
      },
    });
    if (!existingStudent) {
      throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
    }

    const trimmedAdmissionNo = admissionNo ? admissionNo.trim() : null;

    // Check admission number uniqueness within this institution
    if (trimmedAdmissionNo && trimmedAdmissionNo !== existingStudent.admissionNo) {
      const duplicate = await req.prisma.student.findUnique({
        where: {
          institutionId_admissionNo: {
            institutionId: req.institutionId,
            admissionNo: trimmedAdmissionNo,
          },
        },
      });
      if (duplicate) {
        throw new AppError(`Admission number "${trimmedAdmissionNo}" is already taken`, 409, 'DUPLICATE_ADMISSION_NO');
      }
    }

    await req.prisma.$transaction(async (tx) => {
      // Handle class membership updates strictly based on classId value
      if (classId !== undefined) {
        if (classId === null) {
          // Explicit Class Removal
          let activeAcademicYear = null;
          try {
            activeAcademicYear = await getCurrentAcademicYear(tx, req.institutionId);
          } catch {
            activeAcademicYear = null;
          }

          if (activeAcademicYear) {
            const activeEnrollments = await tx.enrollment.findMany({
              where: {
                studentId: req.params.id,
                academicYearId: activeAcademicYear.id,
                status: 'ACTIVE',
              },
            });

            if (activeEnrollments.length > 1) {
              throw new AppError(
                'Data integrity conflict: Student has multiple active enrollments in the current academic year.',
                409,
                'MULTIPLE_ACTIVE_ENROLLMENTS'
              );
            }

            const currentActive = activeEnrollments[0];
            if (currentActive) {
              await tx.enrollment.update({
                where: { id: currentActive.id },
                data: {
                  status: 'WITHDRAWN',
                  exitDate: new Date(),
                },
              });
            }
          }
          await tx.student.update({
            where: { id: req.params.id },
            data: { classId: null },
          });
        } else {
          // Explicit Assignment or Transfer to target class
          const activeAcademicYear = await resolveActiveAcademicYear(tx, req.institutionId);

          const activeEnrollments = await tx.enrollment.findMany({
            where: {
              studentId: req.params.id,
              academicYearId: activeAcademicYear.id,
              status: 'ACTIVE',
            },
          });

          if (activeEnrollments.length > 1) {
            throw new AppError(
              'Data integrity conflict: Student has multiple active enrollments in the current academic year.',
              409,
              'MULTIPLE_ACTIVE_ENROLLMENTS'
            );
          }

          const currentActive = activeEnrollments[0];

          if (currentActive && currentActive.classId === classId) {
            // Same class — sync legacy classId
            await tx.student.update({
              where: { id: req.params.id },
              data: { classId },
            });
          } else {
            // Target Class & Capacity Validation with Row Lock
            await validateAndLockTargetClass(tx, classId, activeAcademicYear.id, req.institutionId);

            if (currentActive) {
              await tx.enrollment.update({
                where: { id: currentActive.id },
                data: {
                  status: 'TRANSFERRED',
                  exitDate: new Date(),
                },
              });
            }

            await tx.enrollment.create({
              data: {
                studentId: req.params.id,
                classId,
                academicYearId: activeAcademicYear.id,
                status: 'ACTIVE',
                enrollmentDate: admissionDate ? new Date(admissionDate) : new Date(),
              },
            });

            await tx.student.update({
              where: { id: req.params.id },
              data: { classId },
            });
          }
        }
      }

      // Update student metadata fields
      await tx.student.update({
        where: { id: req.params.id },
        data: {
          ...(trimmedAdmissionNo && { admissionNo: trimmedAdmissionNo }),
          ...(firstName && { firstName: firstName.trim() }),
          ...(lastName && { lastName: lastName.trim() }),
          ...(fatherName !== undefined && { fatherName: fatherName ? fatherName.trim() : null }),
          ...(motherName !== undefined && { motherName: motherName ? motherName.trim() : null }),
          ...(email !== undefined && { email: email ? email.trim() : null }),
          ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
          ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
          ...(gender && { gender }),
          ...(address !== undefined && { address: address ? address.trim() : null }),
          ...(admissionDate && { admissionDate: new Date(admissionDate) }),
          ...(status && { status }),
          ...(guardianName !== undefined && { guardianName: guardianName ? guardianName.trim() : null }),
          ...(guardianPhone !== undefined && { guardianPhone: guardianPhone ? guardianPhone.trim() : null }),
          ...(guardianEmail !== undefined && { guardianEmail: guardianEmail ? guardianEmail.trim() : null }),
          ...(guardianRelation !== undefined && { guardianRelation: guardianRelation ? guardianRelation.trim() : null }),
          ...(bloodGroup !== undefined && { bloodGroup: bloodGroup || null }),
          ...(nationality !== undefined && { nationality: nationality || null }),
          ...(idNumber !== undefined && { idNumber: idNumber ? idNumber.trim() : null }),
          ...(previousSchool !== undefined && { previousSchool: previousSchool ? previousSchool.trim() : null }),
          ...(emergencyContact !== undefined && { emergencyContact: emergencyContact ? emergencyContact.trim() : null }),
          ...(medicalNotes !== undefined && { medicalNotes: medicalNotes ? medicalNotes.trim() : null }),
        },
      });
    });

    if (customFields && typeof customFields === 'object') {
      await saveCustomFieldValues(req.prisma, req.institutionId, req.params.id, customFields);
    }

    const updatedStudent = await getDeterministicStudent(req.prisma, req.params.id, req.institutionId);
    res.json({ success: true, data: updatedStudent });
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('enrollments')) {
      return next(new AppError('Concurrent enrollment conflict: Student already has an active enrollment in this academic year', 409, 'CONCURRENT_ENROLLMENT_CONFLICT'));
    }
    next(error);
  }
});

/**
 * DELETE /api/students/:id
 * Deactivates student if historical relations exist to protect ERP integrity; physical delete only for zero-history records
 */
router.delete('/:id', requirePermission('students.delete'), async (req, res, next) => {
  try {
    const existing = await req.prisma.student.findFirst({
      where: {
        id: req.params.id,
        institutionId: req.institutionId,
      },
      include: {
        _count: {
          select: {
            enrollments: true,
            attendances: true,
            results: true,
          },
        },
      },
    });

    if (!existing) {
      throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
    }

    const hasHistory =
      existing._count.enrollments > 0 ||
      existing._count.attendances > 0 ||
      existing._count.results > 0;

    if (hasHistory) {
      // Historical safety: Archive/deactivate rather than hard deleting
      await req.prisma.$transaction(async (tx) => {
        await tx.enrollment.updateMany({
          where: { studentId: req.params.id, status: 'ACTIVE' },
          data: { status: 'WITHDRAWN', exitDate: new Date() },
        });

        await tx.student.update({
          where: { id: req.params.id },
          data: { status: 'INACTIVE', classId: null },
        });
      });

      return res.json({
        success: true,
        archived: true,
        message: `Student "${existing.firstName} ${existing.lastName}" has linked historical records and was marked INACTIVE instead of deleted.`,
      });
    }

    await req.prisma.student.delete({ where: { id: req.params.id } });

    res.json({
      success: true,
      message: `Student "${existing.firstName} ${existing.lastName}" deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper: Save custom field values for a student scoped to institution
 */
async function saveCustomFieldValues(prisma, institutionId, studentId, customFields) {
  const fieldDefs = await prisma.customField.findMany({
    where: { institutionId, isActive: true },
  });

  const keyToId = {};
  for (const f of fieldDefs) {
    keyToId[f.fieldKey] = f.id;
  }

  const ops = [];
  for (const [key, value] of Object.entries(customFields)) {
    const fieldId = keyToId[key];
    if (!fieldId) continue;

    if (value === '' || value === null || value === undefined) {
      ops.push(
        prisma.customFieldValue.deleteMany({
          where: { customFieldId: fieldId, studentId },
        })
      );
    } else {
      ops.push(
        prisma.customFieldValue.upsert({
          where: {
            customFieldId_studentId: { customFieldId: fieldId, studentId },
          },
          create: {
            customFieldId: fieldId,
            studentId,
            value: String(value),
          },
          update: {
            value: String(value),
          },
        })
      );
    }
  }

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }
}

module.exports = router;
