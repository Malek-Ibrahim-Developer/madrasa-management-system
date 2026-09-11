/**
 * Server-side validation rules for Class payload data
 */
const validateClassPayload = (body) => {
  const errors = {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const section = typeof body.section === 'string' ? body.section.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const capacity = Number(body.capacity);
  const teacher = typeof body.teacher === 'string' ? body.teacher.trim() : '';
  const academicYearId = typeof body.academicYearId === 'string' ? body.academicYearId.trim() : '';

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
      capacity: Number.isInteger(capacity) && capacity > 0 ? capacity : 40,
      teacher: teacher || null,
      academicYearId: academicYearId || null,
    },
  };
};

module.exports = {
  validateClassPayload,
};
