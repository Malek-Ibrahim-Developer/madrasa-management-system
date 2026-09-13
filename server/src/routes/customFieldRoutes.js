/**
 * Custom Fields Routes — CRUD for admin-defined dynamic fields
 */

const express = require('express');
const router = express.Router();

const requirePermission = require('../middleware/requirePermission');
const { requireInstitutionContext } = require('../middleware/institutionContext');
const requireModuleEnabled = require('../middleware/requireModuleEnabled');

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
 * List all custom field definitions (optionally filter by active only)
 */
router.get('/', requirePermission('students.view'), async (req, res) => {
  try {
    const { activeOnly } = req.query;

    const where = {};
    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const fields = await req.prisma.customField.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ success: true, data: fields });
  } catch (error) {
    console.error('[GET /custom-fields]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/custom-fields
 * Create a new custom field definition
 */
router.post('/', requirePermission('students.edit'), async (req, res) => {
  try {
    const { name, fieldType, options, placeholder, isRequired, section } = req.body;

    if (!name || !fieldType) {
      return res.status(400).json({
        success: false,
        message: 'Field name and type are required',
      });
    }

    // Validate fieldType
    const validTypes = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'TEXTAREA'];
    if (!validTypes.includes(fieldType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid field type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // SELECT type requires options
    if (fieldType === 'SELECT' && (!options || !Array.isArray(options) || options.length < 1)) {
      return res.status(400).json({
        success: false,
        message: 'SELECT field type requires at least one option',
      });
    }

    // Generate unique field key
    let fieldKey = generateFieldKey(name);
    const existing = await req.prisma.customField.findUnique({ where: { fieldKey } });
    if (existing) {
      fieldKey = `${fieldKey}_${Date.now().toString(36)}`;
    }

    // Get max sortOrder for auto-ordering
    const maxSort = await req.prisma.customField.aggregate({
      _max: { sortOrder: true },
    });

    const field = await req.prisma.customField.create({
      data: {
        name,
        fieldKey,
        fieldType,
        options: options ? JSON.stringify(options) : null,
        placeholder: placeholder || null,
        isRequired: isRequired || false,
        section: section || 'custom',
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    });

    res.status(201).json({ success: true, data: field });
  } catch (error) {
    console.error('[POST /custom-fields]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/custom-fields/:id
 * Update a custom field definition
 */
router.put('/:id', requirePermission('students.edit'), async (req, res) => {
  try {
    const { name, fieldType, options, placeholder, isRequired, isActive, section } = req.body;

    const existing = await req.prisma.customField.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Custom field not found' });
    }

    const field = await req.prisma.customField.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(fieldType !== undefined && { fieldType }),
        ...(options !== undefined && { options: options ? JSON.stringify(options) : null }),
        ...(placeholder !== undefined && { placeholder: placeholder || null }),
        ...(isRequired !== undefined && { isRequired }),
        ...(isActive !== undefined && { isActive }),
        ...(section !== undefined && { section }),
      },
    });

    res.json({ success: true, data: field });
  } catch (error) {
    console.error('[PUT /custom-fields/:id]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/custom-fields/reorder
 * Reorder fields by providing an array of { id, sortOrder }
 */
router.put('/reorder/batch', requirePermission('students.edit'), async (req, res) => {
  try {
    const { items } = req.body; // [{ id: "...", sortOrder: 0 }, ...]

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'items array is required',
      });
    }

    // Update all in a transaction
    await req.prisma.$transaction(
      items.map((item) =>
        req.prisma.customField.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    res.json({ success: true, message: 'Fields reordered' });
  } catch (error) {
    console.error('[PUT /custom-fields/reorder]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/custom-fields/:id
 * Delete a custom field and all its values
 */
router.delete('/:id', requirePermission('students.delete'), async (req, res) => {
  try {
    const existing = await req.prisma.customField.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Custom field not found' });
    }

    // Cascade delete handles values automatically
    await req.prisma.customField.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: `Custom field "${existing.name}" deleted`,
    });
  } catch (error) {
    console.error('[DELETE /custom-fields/:id]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
