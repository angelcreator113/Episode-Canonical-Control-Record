/**
 * Global test setup and teardown
 * Initializes test environment, mocks, and utilities
 */

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:Ayanna123@localhost:5432/episode_metadata_test';
process.env.LOG_LEVEL = 'error';
process.env.AWS_REGION = 'us-east-1';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long-for-security';
process.env.TOKEN_ISSUER = 'episode-metadata-api';
process.env.TOKEN_AUDIENCE = 'episode-metadata-app';

// Mock uuid to avoid ESM parse errors (uuid v10+ is ESM-only)
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
  v1: jest.fn(() => 'test-uuid-v1'),
  v5: jest.fn(() => 'test-uuid-v5'),
  validate: jest.fn(() => true),
  NIL: '00000000-0000-0000-0000-000000000000',
}));

// Mock AWS SDK before any imports
jest.mock('aws-sdk', () => ({
  CognitoIdentityServiceProvider: jest.fn(() => ({
    getSigningCertificate: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Certificate: `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKvvNVYNwznTMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjMwMTAxMDAwMDAwWhcNMjQwMTAxMDAwMDAwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEA2a2rwplb2eaLJZz4vvvB3l5dJC0vZqM5VCcTuBQYbC9xR3t5V4cQzZqy
-----END CERTIFICATE-----`,
      }),
    }),
  })),
  S3: jest.fn(() => ({
    getSignedUrl: jest.fn((op, params, cb) => cb(null, 'https://mock-s3-url')),
  })),
  SQS: jest.fn(() => ({
    sendMessage: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ MessageId: 'mock-id' }),
    }),
  })),
  SecretsManager: jest.fn(() => ({
    getSecretValue: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ user_pool_id: 'us-east-1_test123' }),
      }),
    }),
  })),
}));

// Custom matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () => `expected ${received} to be a valid UUID`,
    };
  },
  toHaveHttpStatus(response, expectedStatus) {
    const pass = response.statusCode === expectedStatus || response.status === expectedStatus;
    return {
      pass,
      message: () => `expected response to have status ${expectedStatus}`,
    };
  },
  toBeAuthError(received) {
    const pass = received.message && received.message.includes('auth');
    return {
      pass,
      message: () => `expected ${received.message} to be an auth error`,
    };
  },
});

// Import tokenService for proper token generation
const { generateToken } = require('../src/services/tokenService');

// Global test utilities
global.testUtils = {
  /**
   * Generate mock JWT token with custom claims
   * Now uses real tokenService to create properly signed tokens
   */
  generateMockToken: (userId = 'test-user', groups = ['viewer'], expiry = null) => {
    const user = {
      id: userId,
      email: `${userId}@test.com`,
      groups: groups,
      role: groups.includes('admin') ? 'ADMIN' : groups.includes('editor') ? 'EDITOR' : 'USER',
    };
    
    // If expiry is provided and it's in the past, create an expired token
    if (expiry && expiry < Date.now()) {
      // Create a token with very short expiry
      const oldEnv = process.env.JWT_EXPIRY;
      process.env.JWT_EXPIRY = '1ms';
      const token = generateToken(user);
      process.env.JWT_EXPIRY = oldEnv;
      return token;
    }
    
    return generateToken(user);
  },

  /**
   * Create mock request object
   */
  createMockRequest: (overrides = {}) => ({
    headers: {},
    query: {},
    params: {},
    body: {},
    user: null,
    ip: '127.0.0.1',
    get: jest.fn(),
    ...overrides,
  }),

  /**
   * Create mock response object
   */
  createMockResponse: () => {
    const res = {
      statusCode: 200,
      _data: null,
      status: jest.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(function (data) {
        this._data = data;
        return this;
      }),
      send: jest.fn(function (data) {
        this._data = data;
        return this;
      }),
    };
    return res;
  },

  /**
   * Create mock next function
   */
  createMockNext: () => jest.fn(),

  /**
   * Sample Episode data for testing
   */
  sampleEpisode: () => ({
    showName: 'Styling Adventures w Lala',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: 'The Beginning',
    airDate: new Date('2024-01-01'),
    plotSummary: 'Test episode',
    director: 'Test Director',
    writer: 'Test Writer',
    durationMinutes: 30,
    rating: 8.5,
    genre: 'Comedy',
    processingStatus: 'pending',
  }),

  /**
   * Sample Thumbnail data
   */
  sampleThumbnail: () => ({
    episodeId: 1,
    s3Bucket: 'test-bucket',
    s3Key: 'test/thumbnail.jpg',
    fileSizeBytes: 102400,
    mimeType: 'image/jpeg',
    widthPixels: 1280,
    heightPixels: 720,
    thumbnailType: 'primary',
    qualityRating: 'high',
  }),

  /**
   * Sample Metadata
   */
  sampleMetadata: () => ({
    episodeId: 1,
    extractedText: 'Test transcript',
    tags: ['comedy', 'fashion'],
    categories: ['entertainment'],
    processingDurationSeconds: 120,
  }),

  /**
   * Sample ProcessingQueue job
   */
  sampleJob: () => ({
    episodeId: 1,
    jobType: 'thumbnail_generation',
    status: 'pending',
    jobConfig: { quality: 'high' },
  }),
};

// Global test timeout
jest.setTimeout(15000);

// Suppress console during tests if needed
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}
