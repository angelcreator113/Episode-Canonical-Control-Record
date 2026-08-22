const fs = require('fs');
const path = require('path');

const mockCognitoVerify = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({ verify: mockCognitoVerify })),
  },
}));

const rs256Token = () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: 'fd68-test' })}.sig`;
};

const loadVerifyToken = ({ nodeEnv, userPoolId, clientId }) => {
  process.env.NODE_ENV = nodeEnv;
  process.env.COGNITO_USER_POOL_ID = userPoolId;
  process.env.COGNITO_CLIENT_ID = clientId;
  jest.resetModules();
  return require('../../../src/middleware/auth').verifyToken;
};

describe('FD-68 Half 2 — exact Cognito placeholder policy', () => {
  const originalEnv = {
    nodeEnv: process.env.NODE_ENV,
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    clientId: process.env.COGNITO_CLIENT_ID,
  };

  beforeEach(() => {
    mockCognitoVerify.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.nodeEnv;
    if (originalEnv.userPoolId === undefined) delete process.env.COGNITO_USER_POOL_ID;
    else process.env.COGNITO_USER_POOL_ID = originalEnv.userPoolId;
    if (originalEnv.clientId === undefined) delete process.env.COGNITO_CLIENT_ID;
    else process.env.COGNITO_CLIENT_ID = originalEnv.clientId;
    jest.resetModules();
  });

  test.each([
    ['COGNITO_USER_POOL_ID', ' us-east-1_XXXXXXXXX ', 'real-client-id'],
    ['COGNITO_CLIENT_ID', 'us-east-1_realPool1', ' xxxxxxxxxxxxxxxxxxxxxxxxxx '],
  ])('rejects the exact %s placeholder outside tests', async (variable, userPoolId, clientId) => {
    const verifyToken = loadVerifyToken({ nodeEnv: 'production', userPoolId, clientId });

    await expect(verifyToken(rs256Token())).rejects.toMatchObject({
      cause: {
        code: 'AUTH_CONFIG_MISSING',
        missingVariables: [variable],
      },
    });
    expect(mockCognitoVerify).not.toHaveBeenCalled();
  });

  test('accepts nearby valid values outside tests', async () => {
    mockCognitoVerify.mockResolvedValue({ sub: 'fd68-test', token_use: 'id' });
    const verifyToken = loadVerifyToken({
      nodeEnv: 'production',
      userPoolId: 'us-east-1_test123',
      clientId: 'test-client-id',
    });

    await expect(verifyToken(rs256Token())).resolves.toMatchObject({
      source: 'cognito',
      payload: { sub: 'fd68-test' },
    });
  });

  test('exempts exact placeholders in test mode', async () => {
    mockCognitoVerify.mockResolvedValue({ sub: 'fd68-test', token_use: 'id' });
    const verifyToken = loadVerifyToken({
      nodeEnv: 'test',
      userPoolId: 'us-east-1_XXXXXXXXX',
      clientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
    });

    await expect(verifyToken(rs256Token())).resolves.toMatchObject({ source: 'cognito' });
  });

  test('.env.example contains blank Cognito fields and no rejected literals', () => {
    const example = fs.readFileSync(path.join(__dirname, '..', '..', '..', '.env.example'), 'utf8');

    expect(example).toMatch(/^COGNITO_USER_POOL_ID=\r?$/m);
    expect(example).toMatch(/^COGNITO_CLIENT_ID=\r?$/m);
    expect(example).toMatch(/^COGNITO_CLIENT_SECRET=\r?$/m);
    expect(example).not.toContain('us-east-1_XXXXXXXXX');
    expect(example).not.toContain('xxxxxxxxxxxxxxxxxxxxxxxxxx');
  });
});