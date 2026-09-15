/**
 * Cognito Password Auth Service
 * Exchanges email/password for Cognito tokens via InitiateAuth
 * (AuthFlow: USER_PASSWORD_AUTH). Issuance only — this file mints no
 * local HS256 token and never calls tokenService.
 */

const crypto = require('crypto');
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

let _client = null;
const getClient = () => {
  if (!_client) {
    _client = new CognitoIdentityProviderClient({
      region: process.env.COGNITO_REGION || 'us-east-1',
    });
  }
  return _client;
};

const getCognitoEnv = () => {
  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.COGNITO_CLIENT_ID?.trim();
  const clientSecret = process.env.COGNITO_CLIENT_SECRET?.trim();
  const missingVariables = [];
  if (!userPoolId) missingVariables.push('COGNITO_USER_POOL_ID');
  if (!clientId) missingVariables.push('COGNITO_CLIENT_ID');
  if (!clientSecret) missingVariables.push('COGNITO_CLIENT_SECRET');
  if (missingVariables.length > 0) {
    const err = new Error('Cognito password-login environment is not configured');
    err.code = 'AUTH_CONFIG_MISSING';
    err.missingVariables = missingVariables;
    throw err;
  }
  return { userPoolId, clientId, clientSecret };
};

/**
 * SECRET_HASH = base64(HMAC_SHA256(key = clientSecret, message = username + clientId))
 * Argument order matters: username then clientId, concatenated with no
 * separator. Reversing it produces a generic Cognito mismatch error that
 * reads identically to a wrong password.
 */
const computeSecretHash = (username, clientId, clientSecret) =>
  crypto
    .createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64');

const decodeIdTokenClaims = (idToken) => {
  const payloadB64 = idToken.split('.')[1];
  const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
};

/**
 * Exchange email/password for Cognito tokens.
 * Throws the raw Cognito SDK error (by `name`) on failure — the route
 * maps `name` to a status/code pair and never returns this error's
 * message or the underlying Cognito response body to the caller.
 */
const initiatePasswordAuth = async (email, password) => {
  const { clientId, clientSecret } = getCognitoEnv();
  const secretHash = computeSecretHash(email, clientId, clientSecret);

  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
      SECRET_HASH: secretHash,
    },
  });

  const response = await getClient().send(command);
  const { AccessToken, RefreshToken, IdToken, ExpiresIn, TokenType } = response.AuthenticationResult;
  const claims = decodeIdTokenClaims(IdToken);

  return {
    accessToken: AccessToken,
    refreshToken: RefreshToken,
    expiresIn: ExpiresIn,
    tokenType: TokenType,
    user: {
      id: claims.sub,
      email: claims.email,
      name: claims.name || claims.email,
      groups: claims['cognito:groups'] || [],
    },
  };
};

module.exports = { initiatePasswordAuth, computeSecretHash };
