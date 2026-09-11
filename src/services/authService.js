/**
 * Auth Service — authentication & session management for Altus Kairos
 */

import storageService from './storageService';

/* ------------------------------------------------------------------ */
/*  Default Users                                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_USERS = [
  {
    id: 'USR001',
    name: 'Ibrahim Malek',
    email: 'admin@altuskairos.com',
    password: 'admin123',
    role: 'admin',
    avatar: null,
    phone: '+91 9876543210',
    joinDate: '2024-01-15',
  },
  {
    id: 'USR002',
    name: 'Ahmad Khan',
    email: 'teacher@altuskairos.com',
    password: 'teacher123',
    role: 'teacher',
    avatar: null,
    department: 'Islamic Studies',
    phone: '+91 9876543211',
    joinDate: '2024-03-01',
  },
  {
    id: 'USR003',
    name: 'Yusuf Ali',
    email: 'accountant@altuskairos.com',
    password: 'accountant123',
    role: 'accountant',
    avatar: null,
    phone: '+91 9876543212',
    joinDate: '2024-02-10',
  },
  {
    id: 'USR004',
    name: 'Bilal Ahmed',
    email: 'librarian@altuskairos.com',
    password: 'librarian123',
    role: 'librarian',
    avatar: null,
    phone: '+91 9876543213',
    joinDate: '2024-04-20',
  },
  {
    id: 'USR005',
    name: 'Hamza Siddiqui',
    email: 'warden@altuskairos.com',
    password: 'warden123',
    role: 'warden',
    avatar: null,
    phone: '+91 9876543214',
    joinDate: '2024-05-05',
  },
];

/* ------------------------------------------------------------------ */
/*  User Seeding                                                       */
/* ------------------------------------------------------------------ */

/**
 * Seed the default user accounts into localStorage.
 * Called once during first-time initialization.
 */
export function seedDefaultUsers() {
  storageService.set('users', DEFAULT_USERS);
  console.info('[AuthService] Default users seeded.');
}

/* ------------------------------------------------------------------ */
/*  Authentication                                                     */
/* ------------------------------------------------------------------ */

/**
 * Strip sensitive fields before returning a user object.
 */
function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

/**
 * Authenticate a user by email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Object} The authenticated user (without password)
 * @throws {Error} If credentials are invalid
 */
export function authenticate(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const users = storageService.get('users') || [];

  const user = users.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password
  );

  if (!user) {
    throw new Error('Invalid email or password. Please try again.');
  }

  return sanitizeUser(user);
}

/* ------------------------------------------------------------------ */
/*  Session Management                                                 */
/* ------------------------------------------------------------------ */

/**
 * Generate a cryptographically-inspired random session token.
 * Falls back to Math.random if crypto API is unavailable.
 */
function generateToken() {
  try {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return (
      Math.random().toString(36).substring(2) +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2)
    );
  }
}

/**
 * Create a new session for the authenticated user.
 * Stores the session token, user data, and creation timestamp.
 * @param {Object} user - The sanitized user object
 * @returns {Object} The session object
 */
export function createSession(user) {
  const session = {
    token: generateToken(),
    user,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };

  storageService.set('session', session);
  return session;
}

/**
 * Retrieve the current session from localStorage.
 * @returns {Object|null} The session object, or null
 */
export function getSession() {
  return storageService.get('session');
}

/**
 * Clear the current session (log out).
 */
export function clearSession() {
  storageService.remove('session');
}

/**
 * Check whether a valid session currently exists.
 * @returns {boolean}
 */
export function isSessionValid() {
  const session = getSession();
  if (!session || !session.token || !session.user) return false;

  // Session is structurally valid — could add expiry logic here
  return true;
}

const authService = {
  seedDefaultUsers,
  authenticate,
  createSession,
  getSession,
  clearSession,
  isSessionValid,
};

export default authService;
