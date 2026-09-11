/**
 * Enrollment Rules & Effectiveness Utilities
 * Authoritative membership rules across Altus Kairos ERP
 */

/**
 * Standardize a date to UTC midnight (start of day)
 * @param {Date|string} date
 * @returns {Date}
 */
const startOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Standardize a date to UTC 23:59:59.999 (end of day)
 * @param {Date|string} date
 * @returns {Date}
 */
const endOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

/**
 * Validates whether an enrollment record was effective on a target date.
 * Rule: targetDate >= enrollmentDate AND (exitDate IS NULL OR targetDate <= exitDate)
 * 
 * @param {object} enrollment 
 * @param {Date|string} date 
 * @returns {boolean}
 */
function isEnrollmentEffectiveOnDate(enrollment, date) {
  if (!enrollment || !enrollment.enrollmentDate) return false;
  const target = startOfDay(date);
  const start = startOfDay(enrollment.enrollmentDate);

  if (target < start) return false;

  if (enrollment.exitDate) {
    const exit = startOfDay(enrollment.exitDate);
    if (target > exit) return false;
  }

  return true;
}

module.exports = {
  startOfDay,
  endOfDay,
  isEnrollmentEffectiveOnDate,
};
