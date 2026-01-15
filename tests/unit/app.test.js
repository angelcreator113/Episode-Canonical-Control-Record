// ============================================================================
// EXAMPLE UNIT TEST
// ============================================================================
// Tests for core application functionality
// Run with: npm run test:unit

// Set dummy AWS credentials to prevent credential provider errors
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';

// Mock AWS credential providers
jest.mock('@aws-sdk/credential-providers', () => ({
  fromIni: jest.fn(() => jest.fn().mockResolvedValue({
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  })),
  fromEnv: jest.fn(() => jest.fn().mockResolvedValue({
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  })),
}));

// Mock AWS SDK before app loads
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('aws-sdk', () => ({
  CognitoIdentityServiceProvider: jest.fn(() => ({
    getSigningCertificate: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Certificate: `-----BEGIN CERTIFICATE-----
test
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
}));

describe('Health Check Endpoint', () => {
  let app;

  beforeAll(() => {
    app = require('../../src/app');
  });

  it('should return healthy status', (done) => {
    const request = require('supertest');
    request(app)
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'healthy');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('version');
      })
      .end(done);
  });
});
