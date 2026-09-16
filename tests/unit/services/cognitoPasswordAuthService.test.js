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
    const username = 'testuser@example.com';
    const clientId = '1example23456clientid789';
    const clientSecret = 'test-client-secret-value';

    // Independently derived: built here with Node's crypto module directly,
    // NOT by calling computeSecretHash. This is the ONLY thing that makes
    // the assertions below meaningful — if computeSecretHash's fixture were
    // instead produced by calling computeSecretHash itself, a bug in its
    // argument order would reproduce itself in the "expected" value too and
    // no test could ever fail.
    const correctlyOrderedHash = crypto
      .createHmac('sha256', clientSecret)
      .update(username + clientId)
      .digest('base64');
    const reversedOrderHash = crypto
      .createHmac('sha256', clientSecret)
      .update(clientId + username)
      .digest('base64');

    // Fixed here as a regression guard once independence is established
    // above — if this ever needs to change, recompute it from
    // correctlyOrderedHash, not by hand.
    test('sanity: the two independently-computed orderings are not equal', () => {
      expect(correctlyOrderedHash).not.toBe(reversedOrderHash);
    });

    test('matches the independently-computed username+clientId ordering', () => {
      expect(computeSecretHash(username, clientId, clientSecret)).toBe(correctlyOrderedHash);
      expect(correctlyOrderedHash).toBe('r5z71eSu245W5tonWxCLba5o90V2XHb9RFMh3Q1S0bA=');
    });

    test('does NOT match the reversed clientId+username ordering', () => {
      expect(computeSecretHash(username, clientId, clientSecret)).not.toBe(reversedOrderHash);
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

    test('omits SECRET_HASH and does not throw AUTH_CONFIG_MISSING when COGNITO_CLIENT_SECRET is absent', async () => {
      delete process.env.COGNITO_CLIENT_SECRET;
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
          AuthParameters: {
            USERNAME: 'e@example.com',
            PASSWORD: 'pw',
          },
        })
      );
      const sentParams = InitiateAuthCommand.mock.calls[0][0].AuthParameters;
      expect(sentParams).not.toHaveProperty('SECRET_HASH');
    });
  });
});
