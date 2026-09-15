/**
 * cognitoPasswordAuthService — Task #1456
 *
 * InitiateAuth (USER_PASSWORD_AUTH) exchange, SECRET_HASH computation, and
 * Cognito exception propagation. The SDK is mocked at the boundary
 * (@aws-sdk/client-cognito-identity-provider) — no real Cognito, AWS, or
 * host contact is made by this file.
 */

const crypto = require('crypto');

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  InitiateAuthCommand: jest.fn((input) => ({ input })),
}));

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  computeSecretHash,
  initiatePasswordAuth,
} = require('../../../src/services/cognitoPasswordAuthService');

const buildIdToken = (claims) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.signature`;
};

describe('cognitoPasswordAuthService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    mockSend.mockReset();
    CognitoIdentityProviderClient.mockClear();
    InitiateAuthCommand.mockClear();
    process.env = {
      ...ORIGINAL_ENV,
      COGNITO_USER_POOL_ID: 'us-east-1_TESTPOOL',
      COGNITO_CLIENT_ID: '1example23456clientid789',
      COGNITO_CLIENT_SECRET: 'test-client-secret-value',
      COGNITO_REGION: 'us-east-1',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('computeSecretHash', () => {
    test('HMAC-SHA256(key=clientSecret, message=username+clientId), base64 — known fixture', () => {
      const result = computeSecretHash(
        'testuser@example.com',
        '1example23456clientid789',
        'test-client-secret-value'
      );

      expect(result).toBe('r5z71eSu245W5tonWxCLba5o90V2XHb9RFMh3Q1S0bA=');
    });

    test('argument order matters — username+clientId is not clientId+username', () => {
      const correctOrder = computeSecretHash(
        'testuser@example.com',
        '1example23456clientid789',
        'test-client-secret-value'
      );
      const reversedOrder = crypto
        .createHmac('sha256', 'test-client-secret-value')
        .update('1example23456clientid789' + 'testuser@example.com')
        .digest('base64');

      expect(correctOrder).not.toBe(reversedOrder);
    });
  });

  describe('initiatePasswordAuth', () => {
    test('successful exchange returns exactly the pinned fields, built from the id token claims', async () => {
      mockSend.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'access-token-value',
          RefreshToken: 'refresh-token-value',
          IdToken: buildIdToken({
            sub: 'cognito-user-id',
            email: 'user@example.com',
            name: 'Test User',
            'cognito:groups': ['EDITOR', 'ADMIN'],
          }),
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      });

      const result = await initiatePasswordAuth('user@example.com', 'correct-password');

      expect(result).toEqual({
        accessToken: 'access-token-value',
        refreshToken: 'refresh-token-value',
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          id: 'cognito-user-id',
          email: 'user@example.com',
          name: 'Test User',
          groups: ['EDITOR', 'ADMIN'],
        },
      });
      expect(Object.keys(result).sort()).toEqual(
        ['accessToken', 'expiresIn', 'refreshToken', 'tokenType', 'user'].sort()
      );
    });

    test('invokes InitiateAuth with AuthFlow USER_PASSWORD_AUTH and a SECRET_HASH', async () => {
      mockSend.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'a',
          RefreshToken: 'r',
          IdToken: buildIdToken({ sub: 's', email: 'e@example.com', name: 'N' }),
          ExpiresIn: 60,
          TokenType: 'Bearer',
        },
      });

      await initiatePasswordAuth('e@example.com', 'pw');

      expect(InitiateAuthCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: '1example23456clientid789',
          AuthParameters: expect.objectContaining({
            USERNAME: 'e@example.com',
            PASSWORD: 'pw',
            SECRET_HASH: expect.any(String),
          }),
        })
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test.each([
      ['NotAuthorizedException'],
      ['UserNotFoundException'],
      ['UserNotConfirmedException'],
      ['PasswordResetRequiredException'],
      ['TooManyRequestsException'],
      ['LimitExceededException'],
    ])('propagates %s from the SDK unchanged by name', async (exceptionName) => {
      const sdkError = new Error('Cognito says no');
      sdkError.name = exceptionName;
      mockSend.mockRejectedValue(sdkError);

      await expect(initiatePasswordAuth('user@example.com', 'wrong')).rejects.toMatchObject({
        name: exceptionName,
      });
    });

    test('throws AUTH_CONFIG_MISSING when Cognito env vars are absent, without calling the SDK', async () => {
      delete process.env.COGNITO_CLIENT_ID;

      await expect(initiatePasswordAuth('user@example.com', 'pw')).rejects.toMatchObject({
        code: 'AUTH_CONFIG_MISSING',
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
