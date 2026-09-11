/**
 * Storage Service — localStorage wrapper for Altus Kairos
 * All keys are prefixed with 'ak_' to avoid collisions.
 */

const PREFIX = 'ak_';

/**
 * Retrieve a value from localStorage by key.
 * Automatically prefixes the key and JSON-parses the stored value.
 * @param {string} key - The storage key (without prefix)
 * @returns {*} The parsed value, or null if not found
 */
export function get(key) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[StorageService] Error reading key "${key}":`, error);
    return null;
  }
}

/**
 * Set a value in localStorage.
 * Automatically prefixes the key and JSON-stringifies the value.
 * @param {string} key - The storage key (without prefix)
 * @param {*} value - The value to store
 */
export function set(key, value) {
  try {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`[StorageService] Error writing key "${key}":`, error);
  }
}

/**
 * Remove a single key from localStorage.
 * @param {string} key - The storage key (without prefix)
 */
export function remove(key) {
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
  } catch (error) {
    console.error(`[StorageService] Error removing key "${key}":`, error);
  }
}

/**
 * Clear all Altus Kairos keys (ak_ prefixed) from localStorage.
 * Leaves other applications' data untouched.
 */
export function clear() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('[StorageService] Error clearing storage:', error);
  }
}

/**
 * Initialize default/mock data on first application load.
 * Checks for the 'ak_initialized' flag to avoid re-seeding.
 * @param {Function} seedCallback - A callback that performs the actual seeding
 */
export function initializeData(seedCallback) {
  if (get('initialized')) return;

  try {
    if (typeof seedCallback === 'function') {
      seedCallback();
    }
    set('initialized', true);
    console.info('[StorageService] Initial data seeded successfully.');
  } catch (error) {
    console.error('[StorageService] Error during data initialization:', error);
  }
}

const storageService = { get, set, remove, clear, initializeData };
export default storageService;
