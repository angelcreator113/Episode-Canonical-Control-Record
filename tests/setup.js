/**
 * Global test setup and teardown
 * Initializes test environment, mocks, and utilities
 */

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/episode_metadata_test';
process.env.LOG_LEVEL = 'error';
process.env.AWS_REGION = 'us-east-1';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123';

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

// Global test utilities
global.testUtils = {
  /**
   * Generate mock JWT token with custom claims
   */
  generateMockToken: (userId = 'test-user', groups = ['viewer']) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
      sub: userId,
      email: `${userId}@test.com`,
      'cognito:groups': groups,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64');
    return `${header}.${payload}.test-signature`;
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
