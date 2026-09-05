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
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
  // 162 *.test.js files exist under tests/; 142 are collected by testMatch
  // minus testPathIgnorePatterns. Derived fresh via
  // `npx jest --listTests` diffed against `find tests -name '*.test.js'`
  // (both counts and the 20-file diff re-verified at this basis) — the 20
  // uncollected files are:
  //
  //   Outside testMatch (1, not under tests/unit/ or tests/integration/):
  //     tests/api/endpoints.test.js
  //
  //   Dropped by testPathIgnorePatterns below (19), listed in the same
  //   order as the patterns below, so the two read in parallel:
  //     tests/unit/controllers/jobController.test.js
  //     tests/unit/models/job.test.js
  //     tests/unit/models/file.test.js
  //     tests/unit/controllers/searchController.test.js
  //     tests/unit/controllers/notification.test.js
  //     tests/unit/controllers/presence.test.js
  //     tests/unit/controllers/socket.test.js
  //     tests/unit/controllers/fileController.test.js
  //     tests/integration/jobs.test.js
  //     tests/integration/files.test.js
  //     tests/integration/notifications.integration.test.js
  //     tests/integration/presence.integration.test.js
  //     tests/integration/activity.integration.test.js
  //     tests/integration/socket.integration.test.js
  //     tests/integration/assets.integration.test.js
  //     tests/integration/phase3a-integration.test.js
  //     tests/integration/scenes.integration.test.js
  //     tests/integration/search.test.js
  //     tests/unit/controllers/scene.test.js
  //
  // No behavior change: this comment only names what the patterns below
  // already drop and the one file testMatch already excludes.
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
