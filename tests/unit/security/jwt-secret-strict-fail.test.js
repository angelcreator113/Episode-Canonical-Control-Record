// ============================================================================
// F-SOCKET-1 STRUCTURAL TEST — JWT_SECRET strict-fail at module load
// ============================================================================
// Verifies SocketService.js eliminates the pre-fix hardcoded
// `process.env.JWT_SECRET || 'your-secret-key'` fallback (P0 production
// exposure per F-AUTH-1 fix plan v2.29 §10.2).
//
// Post-fix behavior contract:
//   - If JWT_SECRET unset AND NODE_ENV !== 'test' → throws at module load
//   - If JWT_SECRET unset AND NODE_ENV === 'test' → loads cleanly (carve-out
//     for test infra; tests/setup.js may delete the env var to verify
//     downstream module behavior)
//   - If JWT_SECRET set (regardless of NODE_ENV) → loads cleanly
//
// All 3 tests properly restore process.env.JWT_SECRET and process.env.NODE_ENV
// after each run + apply jest.resetModules() before re-requiring SocketService
// to ensure module-load logic re-fires.

describe('F-SOCKET-1: JWT_SECRET strict-fail at module load', () => {
  test('SocketService throws when JWT_SECRET unset and NODE_ENV === production', () => {
    const originalSecret = process.env.JWT_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    expect(() => require('../../../src/services/SocketService')).toThrow(
      /JWT_SECRET environment variable must be set/,
    );
    process.env.JWT_SECRET = originalSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('SocketService loads cleanly when NODE_ENV === test (test-env carve-out)', () => {
    // Sentinel: test environment continues to work even if JWT_SECRET absent,
    // so test infra (and tests that delete JWT_SECRET to verify downstream
    // behavior) can require SocketService without throwing.
    const originalSecret = process.env.JWT_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    expect(() => require('../../../src/services/SocketService')).not.toThrow();
    process.env.JWT_SECRET = originalSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('SocketService loads cleanly when JWT_SECRET set and NODE_ENV === production', () => {
    const originalSecret = process.env.JWT_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'real-jwt-secret-at-least-32-characters-long';
    jest.resetModules();
    expect(() => require('../../../src/services/SocketService')).not.toThrow();
    process.env.JWT_SECRET = originalSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });
});
