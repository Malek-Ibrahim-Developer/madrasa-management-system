/**
 * Authentication Service — Server-side authentication, session lifecycle,
 * and One-Device / One-Session enforcement.
 */

const AppError = require('../utils/AppError');
const { verifyPassword, hashToken, generateSessionToken } = require('../utils/password');
const auditService = require('./auditService');

const SESSION_DURATION_DAYS = 7;

/**
 * Authenticate user credentials and create a single active session,
 * revoking any existing sessions for this user (One-Device / One-Session).
 */
async function login(prisma, {
  email,
  password,
  deviceId = 'web-client',
  ipAddress = null,
  userAgent = null,
}) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Find user with role & permissions
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      institution: true,
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // 2. Verify password hash
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // 3. Generate raw session token & token hash
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  // 4. Atomic One-Device / One-Session policy inside transaction
  await prisma.$transaction(async (tx) => {
    // Revoke any previous active sessions for this user
    await tx.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Create the new active session
    await tx.session.create({
      data: {
        userId: user.id,
        deviceId,
        tokenHash,
        expiresAt,
      },
    });

    // Record login in audit log
    await auditService.record(tx, {
      institutionId: user.institutionId,
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });
  });

  // 5. Sanitize permissions and user profile
  const permissions = (user.role?.permissions || []).map(rp => rp.permission.code);

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role ? { id: user.role.id, name: user.role.name } : null,
    permissions,
    institution: user.institution ? { id: user.institution.id, name: user.institution.name } : null,
  };

  return {
    user: safeUser,
    token: rawToken,
    expiresAt,
  };
}

/**
 * Validate a session token, ensuring it is unexpired and unrevoked
 */
async function validateSession(prisma, rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = hashToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          institution: true,
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (new Date() > new Date(session.expiresAt)) return null;
  if (!session.user.isActive) return null;

  // Touch lastSeenAt asynchronously
  prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  }).catch(() => {});

  const permissions = (session.user.role?.permissions || []).map(rp => rp.permission.code);

  return {
    session,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone,
      role: session.user.role ? { id: session.user.role.id, name: session.user.role.name } : null,
      permissions,
      institution: session.user.institution ? { id: session.user.institution.id, name: session.user.institution.name } : null,
    },
  };
}

/**
 * Revoke the current active session
 */
async function logout(prisma, rawToken, actor = null) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);

  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

module.exports = {
  login,
  validateSession,
  logout,
};
