/**
 * Password & Token Security Utilities
 * Secure cryptographic hashing and timing-safe verification
 */

const crypto = require('crypto');

/**
 * Hash a plain text password using scrypt with a unique random salt
 * @param {string} password 
 * @returns {Promise<string>}
 */
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify a plain text password against a stored scrypt hash
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {Promise<boolean>}
 */
function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    if (!storedHash || typeof storedHash !== 'string') return resolve(false);
    const parts = storedHash.split(':');
    if (parts.length !== 2) return resolve(false);

    const [salt, key] = parts;
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      try {
        const keyBuffer = Buffer.from(key, 'hex');
        resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Compute a SHA-256 hash of a session token for secure database storage
 * @param {string} token 
 * @returns {string}
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure random session token
 * @returns {string}
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashToken,
  generateSessionToken,
};
