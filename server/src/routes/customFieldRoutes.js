/**
 * Custom Fields Routes — CRUD for admin-defined dynamic fields
 * Altus Kairos — Tenant & Relationship Integrity Hardening
 */

const express = require('express');
const router = express.Router();
const AppError = require('../utils/AppError');

const requirePermission = require('../middleware/requirePermission');
const { requireInstitutionContext } = require('../middleware/institutionContext');
const requireModuleEnabled = require('../middleware/requireModuleEnabled');
const auditService = require('../services/auditService');

router.use(requireInstitutionContext);
router.use(requireModuleEnabled('studentsEnabled'));

/**
 * Helper: Generate a URL-safe slug from a field name
 * "Blood Group" → "blood_group"
 */
function generateFieldKey(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * GET /api/custom-fields
 * List all custom field definitions for the current institution
 */
router.get('/', requirePermission('students.view'), async (req, res, next) => {
  try {
    const { activeOnly } = req.query;

    const where = {
      institutionId: req.institutionId,
    };

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const fields = await req.prisma.customField.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ success: true, data: fields });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/custom-fields
 * Create a new custom field definition scoped to current institution
 */
router.post('/', requirePermission('students.edit'), async (req, res, next) => {
  try {
    const { name, fieldType, options, placeholder, isRequired, section } = req.body;

    if (!name || !name.trim() || !fieldType) {
      throw new AppError('Field name and type are required', 400, 'VALIDATION_ERROR');
    }

    const validTypes = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'TEXTAREA'];
    if (!validTypes.includes(fieldType)) {
      throw new AppError(`Invalid field type. Must be one of: ${validTypes.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    if (fieldType === 'SELECT' && (!options || !Array.isArray(options) || options.length < 1)) {
      throw new AppError('SELECT field type requires at least one option', 400, 'VALIDATION_ERROR');
    }

    // Generate unique field key within this institution
    let baseKey = generateFieldKey(name.trim());
    let fieldKey = baseKey;
    let attempt = 0;

    while (true) {
      const existing = await req.prisma.customField.findUnique({
        where: {
          institutionId_fieldKey: {
            institutionId: req.institutionId,
            fieldKey,
          },
        },
      });

      if (!existing) break;
      attempt++;
      fieldKey = `${baseKey}_${attempt}`;
    }

    // Get max sortOrder for auto-ordering within this institution
    const maxSort = await req.prisma.customField.aggregate({
      where: {
        institutionId: req.institutionId,
      },
      _max: { sortOrder: true },
    });

    const field = await req.prisma.customField.create({
      data: {
        institutionId: req.institutionId,
        name: name.trim(),
        fieldKey,
        fieldType,
        options: options ? JSON.stringify(options) : null,
        placeholder: placeholder ? placeholder.trim() : null,
        isRequired: Boolean(isRequired),
        section: section ? section.trim() : 'custom',
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    });

    await auditService.record(req.prisma, {
      institutionId: req.institutionId,
      action: 'CUSTOM_FIELD_CREATED',
      entityType: 'CustomField',
      entityId: field.id,
      afterData: field,
    });

    res.status(201).json({ success: true, data: field });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/custom-fields/:id
 * Update a custom field definition ensuring institution ownership
 */
router.put('/:id', requirePermission('students.edit'), async (req, res, next) => {
  try {
    const { name, fieldType, options, placeholder, isRequired, isActive, section } = req.body;

    const existing = await req.prisma.customField.findFirst({
      where: {
        id: req.params.id,
        institutionId: req.institutionId,
      },
    });

    if (!existing) {
      throw new AppError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    if (fieldType) {
      const validTypes = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'TEXTAREA'];
      if (!validTypes.includes(fieldType)) {
        throw new AppError(`Invalid field type. Must be one of: ${validTypes.join(', ')}`, 400, 'VALIDATION_ERROR');
      }
    }

    const field = await req.prisma.customField.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(fieldType !== undefined && { fieldType }),
        ...(options !== undefined && { options: options ? JSON.stringify(options) : null }),
        ...(placeholder !== undefined && { placeholder: placeholder ? placeholder.trim() : null }),
        ...(isRequired !== undefined && { isRequired: Boolean(isRequired) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(section !== undefined && { section: section ? section.trim() : 'custom' }),
      },
    });

    await auditService.record(req.prisma, {
      institutionId: req.institutionId,
      action: 'CUSTOM_FIELD_UPDATED',
      entityType: 'CustomField',
      entityId: field.id,
      beforeData: existing,
      afterData: field,
    });

    res.json({ success: true, data: field });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/custom-fields/reorder/batch
 * Reorder fields validating all IDs belong to the current institution
 */
router.put('/reorder/batch', requirePermission('students.edit'), async (req, res, next) => {
  try {
    const { items } = req.body; // [{ id: "...", sortOrder: 0 }, ...]

    if (!items || !Array.isArray(items)) {
      throw new AppError('items array is required', 400, 'VALIDATION_ERROR');
    }

    const ids = items.map((item) => item.id).filter(Boolean);

    // Verify all IDs belong to the current institution
    const ownedFields = await req.prisma.customField.findMany({
      where: {
        institutionId: req.institutionId,
        id: { in: ids },
      },
      select: { id: true },
    });

    if (ownedFields.length !== ids.length) {
      throw new AppError('One or more custom fields do not belong to this institution', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    // Update inside transaction
    await req.prisma.$transaction(
      items.map((item) =>
        req.prisma.customField.update({
          where: { id: item.id },
          data: { sortOrder: Number(item.sortOrder) || 0 },
        })
      )
    );

    res.json({ success: true, message: 'Fields reordered' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/custom-fields/:id
 * Delete a custom field ensuring institution ownership
 */
router.delete('/:id', requirePermission('students.delete'), async (req, res, next) => {
  try {
    const existing = await req.prisma.customField.findFirst({
      where: {
        id: req.params.id,
        institutionId: req.institutionId,
      },
    });

    if (!existing) {
      throw new AppError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    await req.prisma.customField.delete({
      where: { id: req.params.id },
    });

    await auditService.record(req.prisma, {
      institutionId: req.institutionId,
      action: 'CUSTOM_FIELD_DELETED',
      entityType: 'CustomField',
      entityId: existing.id,
      beforeData: existing,
    });

    res.json({
      success: true,
      message: `Custom field "${existing.name}" deleted`,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
