/**
 * Server-side validation rules for Class payload data
 */
const validateClassPayload = (body = {}) => {
  const errors = {};
  const safeBody = body && typeof body === 'object' ? body : {};

  const name =
    typeof safeBody.name === 'string'
      ? safeBody.name.trim()
      : '';

  const section =
    typeof safeBody.section === 'string'
      ? safeBody.section.trim()
      : '';

  const code =
    typeof safeBody.code === 'string'
      ? safeBody.code.trim()
      : '';

  const capacity = Number(safeBody.capacity);

  const teacher =
    typeof safeBody.teacher === 'string'
      ? safeBody.teacher.trim()
      : '';

  const academicYearId =
    typeof safeBody.academicYearId === 'string'
      ? safeBody.academicYearId.trim()
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
