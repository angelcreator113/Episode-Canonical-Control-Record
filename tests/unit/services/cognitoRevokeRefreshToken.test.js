/**
 * cognitoPasswordAuthService.revokeRefreshToken — Task #3797
 * (docs/audit/F-AUTH-1_LogoutRevocation_Ruling_2026-11-11.md, option (b)).
 *
 * RevokeToken on the one refresh token the browser held. The SDK is mocked at
 * the boundary: no Cognito, AWS or host contact is made by this file.
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  InitiateAuthCommand: jest.fn((input) => ({ input })),
  RevokeTokenCommand: jest.fn((input) => ({ kind: 'RevokeToken', input })),
  GlobalSignOutCommand: jest.fn((input) => ({ kind: 'GlobalSignOut', input })),
}));

const { RevokeTokenCommand, GlobalSignOutCommand, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { revokeRefreshToken } = require('../../../src/services/cognitoPasswordAuthService');

const TOKEN = 'a-cognito-refresh-token-that-is-long-enough-to-look-like-one';

describe('revokeRefreshToken', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    mockSend.mockReset();
    RevokeTokenCommand.mockClear();
    GlobalSignOutCommand.mockClear();
    InitiateAuthCommand.mockClear();
    process.env = { ...ORIGINAL_ENV, COGNITO_USER_POOL_ID: 'us-east-1_TESTPOOL', COGNITO_CLIENT_ID: '1example23456clientid789' };
    delete process.env.COGNITO_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('sends RevokeToken with the token and the client ID, and nothing else, when the client has no secret', async () => {
    mockSend.mockResolvedValue({});

    await expect(revokeRefreshToken(TOKEN)).resolves.toBeUndefined();

    expect(RevokeTokenCommand).toHaveBeenCalledTimes(1);
    expect(RevokeTokenCommand).toHaveBeenCalledWith({ Token: TOKEN, ClientId: '1example23456clientid789' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].kind).toBe('RevokeToken');
  });

  test('this session only: never GlobalSignOut, and no InitiateAuth', async () => {
    mockSend.mockResolvedValue({});

    await revokeRefreshToken(TOKEN);

    expect(GlobalSignOutCommand).not.toHaveBeenCalled();
    expect(InitiateAuthCommand).not.toHaveBeenCalled();
  });

  test('passes a configured client secret as ClientSecret', async () => {
    process.env.COGNITO_CLIENT_SECRET = 'test-client-secret-value';
    mockSend.mockResolvedValue({});

    await revokeRefreshToken(TOKEN);

    expect(RevokeTokenCommand).toHaveBeenCalledWith({
      Token: TOKEN,
      ClientId: '1example23456clientid789',
      ClientSecret: 'test-client-secret-value',
    });
  });

  test('lets the Cognito error through unchanged, for the caller to log by name', async () => {
    const err = Object.assign(new Error('Token revocation is not enabled'), { name: 'UnsupportedOperationException' });
    mockSend.mockRejectedValue(err);

    await expect(revokeRefreshToken(TOKEN)).rejects.toBe(err);
  });

  test('fails before any call when the client is not configured', async () => {
    delete process.env.COGNITO_CLIENT_ID;

    await expect(revokeRefreshToken(TOKEN)).rejects.toMatchObject({ code: 'AUTH_CONFIG_MISSING' });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
