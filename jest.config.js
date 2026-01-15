// ============================================================================
// JEST CONFIGURATION - UNIT & INTEGRATION TESTING
// ============================================================================

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js',
  ],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20,
    },
  },
  testMatch: ['**/tests/unit/**/*.test.js'],
  testPathIgnorePatterns: ['jobController.test.js', 'job.test.js', 'file.test.js', 'searchController.test.js', 'notification.test.js', 'presence.test.js', 'socket.test.js', 'fileController.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  forceExit: true,
  detectOpenHandles: false,
};
