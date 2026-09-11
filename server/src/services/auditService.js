/**
 * Audit Service — Records immutable compliance and state changes
 */

/**
 * Record an audit log entry inside a transactional boundary
 * @param {object} tx - Prisma transaction client
 * @param {object} params
 * @param {string} [params.institutionId]
 * @param {string} [params.userId]
 * @param {string} params.action - e.g. 'STUDENT_ENROLLED', 'STUDENT_TRANSFERRED', 'STUDENT_WITHDRAWN'
 * @param {string} params.entityType - e.g. 'Enrollment', 'Student', 'Attendance'
 * @param {string} [params.entityId]
 * @param {object} [params.beforeData]
 * @param {object} [params.afterData]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 */
async function record(tx, {
  institutionId = null,
  userId = null,
  action,
  entityType,
  entityId = null,
  beforeData = null,
  afterData = null,
  ipAddress = null,
  userAgent = null,
}) {
  if (!tx || !action || !entityType) return null;

  try {
    return await tx.auditLog.create({
      data: {
        institutionId,
        userId,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        beforeData: beforeData ? JSON.parse(JSON.stringify(beforeData)) : null,
        afterData: afterData ? JSON.parse(JSON.stringify(afterData)) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('AuditLog write error (non-fatal):', error.message);
    return null;
  }
}

module.exports = {
  record,
};
