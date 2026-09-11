/**
 * Permission Service — Resolves and verifies RBAC permissions for users
 */

/**
 * Check if a user has a specific permission code
 * @param {object} prisma 
 * @param {object} user 
 * @param {string} permissionCode 
 * @returns {Promise<boolean>}
 */
async function userHasPermission(prisma, user, permissionCode) {
  if (!user) return false;

  // Admin wildcard check
  if (user.role && user.role.name === 'Admin') return true;

  // Check pre-loaded permissions on user session
  if (Array.isArray(user.permissions)) {
    if (user.permissions.includes('*') || user.permissions.includes(permissionCode)) {
      return true;
    }
  }

  // Fallback query to database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!dbUser || !dbUser.role) return false;

  const codes = dbUser.role.permissions.map(rp => rp.permission.code);
  return codes.includes('*') || codes.includes(permissionCode);
}

module.exports = {
  userHasPermission,
};
