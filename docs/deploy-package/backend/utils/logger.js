/**
 * Logger Utility
 * Simple logging wrapper for the application
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

const logger = {
  error: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(`[ERROR] ${message}`, meta);
    }
  },

  warn: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(`[WARN] ${message}`, meta);
    }
  },

  info: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(`[INFO] ${message}`, meta);
    }
  },

  debug: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(`[DEBUG] ${message}`, meta);
    }
  },
};

module.exports = logger;
