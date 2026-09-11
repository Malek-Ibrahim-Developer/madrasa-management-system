/**
 * Auth Routes — Server-side authentication endpoints
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { requireAuth, extractToken } = require('../middleware/authMiddleware');

/**
 * POST /api/auth/login
 * Authenticates user credentials, revokes previous sessions, sets cookie and returns profile
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, deviceId } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    const authResult = await authService.login(req.prisma, {
      email,
      password,
      deviceId: deviceId || 'web-client',
      ipAddress,
      userAgent,
    });

    // Set secure HttpOnly cookie
    res.cookie('ak_session', authResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: authResult.expiresAt,
    });

    res.json({
      success: true,
      data: authResult,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Revokes the active session
 */
router.post('/logout', async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      await authService.logout(req.prisma, token);
    }

    res.clearCookie('ak_session');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile and permissions
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

module.exports = router;
