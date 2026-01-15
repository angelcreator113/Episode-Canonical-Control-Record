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
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  testMatch: ['**/tests/unit/**/*.test.js'],
  testPathIgnorePatterns: ['.*job.test.js', '.*searchController.test.js', '.*notification.test.js', '.*presence.test.js', '.*socket.test.js', '.*file.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  forceExit: true,
  detectOpenHandles: false,
};
