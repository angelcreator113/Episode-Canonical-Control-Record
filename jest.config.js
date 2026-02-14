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
      branches: 8,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: [
    'jobController.test.js',
    'job.test.js',
    'file.test.js',
    'searchController.test.js',
    'notification.test.js',
    'presence.test.js',
    'socket.test.js',
    'fileController.test.js',
    'jobs.test.js',
    'files.test.js',
    'notifications.integration.test.js',
    'presence.integration.test.js',
    'activity.integration.test.js',
    'socket.integration.test.js',
    'assets.integration.test.js',
    'phase3a-integration.test.js',
    'scenes.integration.test.js',
    'search.test.js',
    'scene.test.js',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  detectOpenHandles: false,
  maxWorkers: 1,
};
