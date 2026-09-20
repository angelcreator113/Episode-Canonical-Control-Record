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
  // Optional: only app clients configured WITH a secret need SECRET_HASH.
  // Absence here is not a misconfiguration -- it means don't send one.
  const clientSecret = process.env.COGNITO_CLIENT_SECRET?.trim() || null;
  const missingVariables = [];
  if (!userPoolId) missingVariables.push('COGNITO_USER_POOL_ID');
  if (!clientId) missingVariables.push('COGNITO_CLIENT_ID');
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
  const authParameters = { USERNAME: email, PASSWORD: password };
  if (clientSecret) {
    authParameters.SECRET_HASH = computeSecretHash(email, clientId, clientSecret);
  } else {
    console.log('[cognitoPasswordAuthService] no secret configured, SECRET_HASH omitted');
  }

  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: authParameters,
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

/**
 * Exchange a Cognito refresh token for a new access token via InitiateAuth
 * (AuthFlow: REFRESH_TOKEN_AUTH). Per F-AUTH-1_Fix_Plan_v2.77.md §7/§8(a):
 * non-rotation contract only — returns exactly { accessToken, expiresIn,
 * tokenType }, never IdToken or RefreshToken.
 *
 * SECRET_HASH for a refresh exchange is keyed on the token's own subject,
 * which this endpoint never receives. Per PR #1472's rule, a secret-less
 * client sends none; a client WITH a secret configured fails closed rather
 * than guess a username.
 */
const refreshWithCognito = async (refreshToken) => {
  const { clientId, clientSecret } = getCognitoEnv();

  if (clientSecret) {
    console.log(
      '[cognitoPasswordAuthService] client secret configured; refresh SECRET_HASH needs the user\'s sub, which this endpoint does not receive — failing closed'
    );
    const err = new Error('Cognito refresh requires a per-user SECRET_HASH, which this endpoint cannot compute');
    err.code = 'AUTH_CONFIG_MISSING';
    throw err;
  }

  const command = new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: clientId,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });

  const response = await getClient().send(command);
  const { AccessToken, ExpiresIn, TokenType } = response.AuthenticationResult;

  return {
    accessToken: AccessToken,
    expiresIn: ExpiresIn,
    tokenType: TokenType,
  };
};

module.exports = { initiatePasswordAuth, computeSecretHash, refreshWithCognito };
