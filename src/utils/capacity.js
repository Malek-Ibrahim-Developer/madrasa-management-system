/**
 * Capacity information calculation utility
 * Distinguishes true enrollment percentage from visual progress bar fill (capped at 100%)
 */
export const getCapacityInfo = (studentCount = 0, capacity = 0) => {
  const students = Number(studentCount) || 0;
  const maxCapacity = Number(capacity) || 0;

  if (maxCapacity <= 0) {
    return {
      percentage: 0,
      status: 'INVALID',
      remaining: 0,
      overBy: 0,
    };
  }

  const percentage = Math.round((students / maxCapacity) * 100);

  if (students > maxCapacity) {
    return {
      percentage,
      status: 'OVER_CAPACITY',
      remaining: 0,
      overBy: students - maxCapacity,
    };
  }

  if (students === maxCapacity) {
    return {
      percentage: 100,
      status: 'FULL',
      remaining: 0,
      overBy: 0,
    };
  }

  if (percentage >= 80) {
    return {
      percentage,
      status: 'NEAR_CAPACITY',
      remaining: maxCapacity - students,
      overBy: 0,
    };
  }

  return {
    percentage,
    status: 'NORMAL',
    remaining: maxCapacity - students,
    overBy: 0,
  };
};
