/**
 * Authentication Middleware — Validates session token from header/cookie
 * and populates req.user and req.session
 */

const AppError = require('../utils/AppError');
const authService = require('../services/authService');

const extractToken = (req) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-session-token']) {
    return req.headers['x-session-token'].trim();
  }
  if (req.cookies && req.cookies['ak_session']) {
    return req.cookies['ak_session'];
  }
  return null;
};

/**
 * Enforce valid authentication
 */
const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401, 'AUTHENTICATION_REQUIRED');
    }

    const authContext = await authService.validateSession(req.prisma, token);
    if (!authContext) {
      throw new AppError('Session expired or revoked. Please log in again.', 401, 'SESSION_INVALID');
    }

    req.user = authContext.user;
    req.session = authContext.session;
    req.rawSessionToken = token;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication: Populates req.user if token is present and valid,
 * but allows unauthenticated access if omitted.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const authContext = await authService.validateSession(req.prisma, token);
      if (authContext) {
        req.user = authContext.user;
        req.session = authContext.session;
        req.rawSessionToken = token;
      }
    }
    next();
  } catch {
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
  extractToken,
};
