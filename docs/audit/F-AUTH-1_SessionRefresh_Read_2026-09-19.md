# F-AUTH-1 — why sessions end on token expiry, read

**Basis:** `origin/main` at `b791439bc2fbb89c683c4073f14f48a9584d1b7c` (2026-09-19).
**Standing:** MEASURED for every claim read directly from the repository at
this basis — command and raw output pasted, verbatim, no elisions; a block
narrower than a cited line range is labelled an excerpt, with the exact
lines it shows stated. INFERRED for any claim about a dependency's runtime
behavior (which error class a library throws, or how a configured option
changes rejection behavior) that is reasoned from that dependency's source
but not confirmed by executing it — labelled INFERRED at the point made,
never upgraded to MEASURED. NOT PERFORMED for anything left undone; some
NOT PERFORMED items are Evoni-gated (need Cognito console or host access
this session does not take), others are simply out of this document's
scope — each says which. This is a read. It mints nothing, rules nothing,
recommends no fix design, and does not edit any filed document.

No host, AWS, database, or Cognito contact. `LOGIN_DISABLED` not touched.

---

## 1. `POST /login` — token fields returned, and whether a Cognito refresh token is among them — MEASURED

```
$ sed -n '96,134p' src/routes/auth.js
```

```
router.post('/login', optionalAuth, loginLimiter, validateLoginRequest, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await cognitoPasswordAuthService.initiatePasswordAuth(email, password);

    // Contract: this endpoint returns exactly these five fields, built from
    // the id token's claims — never the raw Cognito response. No local
    // HS256 token is minted on this path (TokenService.generateTokenPair is
    // not called here).
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
        user: result.user,
      },
    });
  } catch (error) {
    const mapped = COGNITO_LOGIN_ERROR_MAP[error.name];
    // Never log or return the password, the Cognito client secret, or the
    // raw Cognito error object — only the exception name.
    console.error('Login error:', error.name || 'UnknownError');
    if (mapped) {
      return res.status(mapped.status).json({
        error: mapped.error,
        message: mapped.message,
        code: mapped.code,
      });
    }
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed.',
      code: 'AUTH_LOGIN_ERROR',
    });
  }
});
```

`src/routes/auth.js:109-113` — the response `data` object carries five
fields: `accessToken`, `refreshToken`, `expiresIn`, `tokenType`, `user`
(names only; no values recorded).

The upstream source of those fields, `src/services/cognitoPasswordAuthService.js:67-98`:

```
$ sed -n '67,98p' src/services/cognitoPasswordAuthService.js
```

```
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
```

`cognitoPasswordAuthService.js:83` destructures `RefreshToken` straight out
of `response.AuthenticationResult` — the field Cognito's `InitiateAuth`
(`AuthFlow: 'USER_PASSWORD_AUTH'`, line 77) returns. `cognitoPasswordAuthService.js:88`
carries it through as `refreshToken` unmodified. `cognitoPasswordAuthService.js:87`
carries `AccessToken` through as `accessToken` unmodified — the field §2
and §4 below establish is what the frontend actually sends back on later
requests.

**MEASURED: yes, a Cognito-issued refresh token is among the fields
`POST /login` returns** (`refreshToken`, `auth.js:110`), sourced from
Cognito's own `AuthenticationResult.RefreshToken`
(`cognitoPasswordAuthService.js:83,88`), not minted locally — this same
handler's comment (`auth.js:101-104`) states `TokenService.generateTokenPair`
is not called on this path.

## 2. Frontend login handler and the F-Auth-4 interceptor — MEASURED

### 2a. localStorage keys written at login

```
$ sed -n '20,40p' frontend/src/services/authService.js
```

```
        role: 'USER',
      });

      console.log('[authService] Login response received:', response.status);
      console.log('[authService] Response data:', response.data);

      if (response.data.data?.accessToken) {
        const { accessToken, refreshToken, user } = response.data.data;

        console.log('[authService] Storing tokens and user...');
        // Store tokens
        localStorage.setItem('authToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        console.log('[authService] Tokens stored successfully');
        return {
          accessToken,
          refreshToken,
          user,
          success: true,
```

`frontend/src/services/authService.js:31-33` — three keys are written on
successful login: `authToken`, `refreshToken`, `user`. `authService.js:31`
stores `POST /login`'s `accessToken` field (§1 — Cognito's `AccessToken`,
unmodified) under the `authToken` key. (`api.js`'s request interceptor,
`frontend/src/services/api.js:16`, separately also reads a legacy `token`
key as a fallback; nothing in `authService.js` writes that key.)

### 2b. Error codes that trigger refresh vs. wipe

```
$ sed -n '40,132p' frontend/src/services/api.js
```

```
// ✅ RESPONSE INTERCEPTOR — F-Auth-4 Path 1 contract (Track 1, fix plan v2.0 §4.6)
//
// Codes the interceptor acts on:
//  - AUTH_INVALID_FORMAT, AUTH_GROUP_REQUIRED, AUTH_ROLE_REQUIRED — pass-through (LOCKED).
//    These are integration/permission errors, NOT session failures. Surfaced inline
//    so the caller can show "you don't have access" rather than redirecting to /login.
//  - AUTH_INVALID_TOKEN — header present, verifier rejected. Attempt refresh ONCE
//    via the existing /api/v1/auth/refresh path; on success retry the original
//    request, on failure redirect to /login. Single-retry-then-redirect — never loop.
//  - AUTH_REQUIRED, AUTH_MISSING_TOKEN — no session present. Wipe creds, redirect.
//  - 401 with no code / unknown code — treated as session failure for safety.
//  - All other errors — pass through unchanged.

// Inline refresh helper avoids circular import with authService and uses bare axios
// so the refresh request itself bypasses this interceptor (no recursion risk).
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token in storage');
  const baseURL = apiClient.defaults.baseURL || '';
  const res = await axios.post(`${baseURL}/api/v1/auth/refresh`, { refreshToken });
  const newToken = res.data?.data?.accessToken;
  if (!newToken) throw new Error('No accessToken in refresh response');
  localStorage.setItem('authToken', newToken);
  return newToken;
};

const wipeSessionAndRedirect = () => {
  // Skip in DEV — keeps hot-reload from kicking devs to /login on every restart.
  if (import.meta.env.DEV) return;
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
};

const PASS_THROUGH_CODES = new Set([
  'AUTH_INVALID_FORMAT',
  'AUTH_GROUP_REQUIRED',
  'AUTH_ROLE_REQUIRED',
]);

const SESSION_FAIL_CODES = new Set([
  'AUTH_REQUIRED',
  'AUTH_MISSING_TOKEN',
]);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const originalConfig = error.config;

    // LOCKED pass-through — permission/format failures never trigger session-redirect.
    if (code && PASS_THROUGH_CODES.has(code)) {
      return Promise.reject(error);
    }

    if (status === 401 && code === 'AUTH_INVALID_TOKEN') {
      // Single-retry contract: if this request was already retried, redirect.
      if (!originalConfig || originalConfig._retried) {
        wipeSessionAndRedirect();
        return Promise.reject(error);
      }
      // The refresh endpoint itself returning AUTH_INVALID_TOKEN means the
      // refresh token is bad — don't loop, just redirect.
      if (originalConfig.url && originalConfig.url.includes('/api/v1/auth/refresh')) {
        wipeSessionAndRedirect();
        return Promise.reject(error);
      }
      try {
        await refreshAccessToken();
        originalConfig._retried = true;
        // Request interceptor re-reads localStorage and re-attaches the new token.
        return apiClient(originalConfig);
      } catch (_refreshError) {
        wipeSessionAndRedirect();
        return Promise.reject(error);
      }
    }

    if (status === 401 && (!code || SESSION_FAIL_CODES.has(code))) {
      wipeSessionAndRedirect();
      return Promise.reject(error);
    }

    if (import.meta.env.DEV) {
      console.error('API Error:', error.response?.data || error.message);
    }

    return Promise.reject(error);
  }
);
```

`frontend/src/services/api.js:98` — a 401 with `code === 'AUTH_INVALID_TOKEN'`
is the ONLY code that triggers a refresh attempt (`api.js:110-118`, calling
`refreshAccessToken`, `api.js:55-64`). `api.js:121` — `AUTH_REQUIRED`,
`AUTH_MISSING_TOKEN`, or an absent/unrecognized code on a 401 goes straight
to `wipeSessionAndRedirect()` (`api.js:66-73`) with no refresh attempt.
`api.js:75-79` — `AUTH_INVALID_FORMAT`, `AUTH_GROUP_REQUIRED`,
`AUTH_ROLE_REQUIRED` pass through untouched (neither refresh nor wipe).

### 2c. What refresh sends to the server

`api.js:55-64` (`refreshAccessToken`) reads `localStorage.getItem('refreshToken')`
(`api.js:56`) and POSTs it as `{ refreshToken }` (`api.js:59`) to
`${baseURL}/api/v1/auth/refresh`, using the bare `axios` import — not
`apiClient` — so this specific request bypasses the response interceptor
itself (comment, `api.js:53-54`).

### 2d. Test coverage of this path — MEASURED

```
$ sed -n '162,176p' frontend/src/services/api.test.js
```

```
    test('refresh request itself rejects → wipe + redirect', async () => {
      localStorage.setItem('authToken', 'old');
      localStorage.setItem('refreshToken', 'rt-1');

      vi.mocked(axios.post).mockRejectedValue(new Error('network down'));

      const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
      err.config = { url: '/some/endpoint', method: 'get', headers: {} };

      await expect(handler(err)).rejects.toBe(err);

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });
```

This is the closest existing test to the path this document measures, and
it mocks `axios.post` to reject with a generic `Error('network down')`
(`api.test.js:166`) — not with the backend's actual `401 AUTH_REFRESH_FAILED`
response body a real Cognito-refresh-token attempt produces (§3 below). No
test in this file drives a real (or shaped) `/refresh` response through
`refreshAccessToken` and asserts on `AUTH_REFRESH_FAILED` specifically.
MEASURED: this path's specific failure mode is untested, not merely
untraced.

## 3. `POST /refresh` and `POST /validate` — algorithm/token type accepted, and what an RS256 or Cognito refresh token gets back — MEASURED

```
$ sed -n '140,171p' src/routes/auth.js
```

```
router.post('/refresh', optionalAuth, refreshLimiter, validateRefreshRequest, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token required',
        code: 'AUTH_MISSING_REFRESH_TOKEN',
      });
    }

    const newTokens = TokenService.refreshAccessToken(refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: {
        accessToken: newTokens.accessToken,
        tokenType: newTokens.tokenType,
        expiresIn: newTokens.expiresIn,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: error.message,
      code: 'AUTH_REFRESH_FAILED',
    });
  }
});
```

`auth.js:152` calls `TokenService.refreshAccessToken(refreshToken)` directly
— no `alg` discriminator, no Cognito `REFRESH_TOKEN_AUTH` call anywhere in
this handler.

`src/services/tokenService.js:150-176` (`refreshAccessToken`) and
`tokenService.js:88-128` (`verifyToken`, the method it calls at line 152):

```
$ sed -n '88,128p' src/services/tokenService.js
```

```
  static verifyToken(token, type = 'access') {
    try {
      const verifyOptions = {
        algorithms: ['HS256'],
      };

      // In production, enforce issuer and audience. In test, they're optional
      if (process.env.NODE_ENV !== 'test') {
        verifyOptions.issuer = process.env.TOKEN_ISSUER || 'episode-metadata-api';
        verifyOptions.audience = process.env.TOKEN_AUDIENCE || 'episode-metadata-app';
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);

      // Check if token is blacklisted (revoked)
      if (this.tokenBlacklist.has(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Verify token type if specified
      if (type && decoded.type !== type) {
        throw new Error(`Invalid token type. Expected: ${type}, Got: ${decoded.type}`);
      }

      // Verify required claims
      if (!decoded.sub || !decoded.email) {
        throw new Error('Missing required token claims');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token signature');
      } else if (error.message.includes('revoked')) {
        throw error; // Re-throw revoked token error as-is
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
```

`tokenService.js:91` — `algorithms: ['HS256']` is the only algorithm
`jsonwebtoken`'s `jwt.verify` is permitted to accept here; `tokenService.js:100`
verifies against `process.env.JWT_SECRET`, a symmetric secret this codebase
controls — not Cognito's JWKS. `tokenService.js:152` (`refreshAccessToken`)
passes the request body's `refreshToken` straight into this HS256-only
`verifyToken`.

**MEASURED: `POST /refresh` accepts only HS256 tokens signed with the
local `JWT_SECRET`. It has no code path that recognizes an RS256 (Cognito)
token or that calls Cognito's `REFRESH_TOKEN_AUTH` flow.** A Cognito
refresh token presented here is not itself an HS256 JWT signed with this
server's `JWT_SECRET`. INFERRED, not executed: by the `jsonwebtoken`
library's documented contract, `jwt.verify` (`tokenService.js:100`)
rejects a token whose signature it cannot verify under the given algorithm
and secret as a `JsonWebTokenError`; that name is caught at
`tokenService.js:121-122` and re-thrown as `Invalid token signature`, then
re-wrapped by `refreshAccessToken`'s own catch (`tokenService.js:173-175`)
as `Token refresh failed: Invalid token signature`. That exception
propagates to the route's catch (`auth.js:163-169`), which returns
**401, `code: 'AUTH_REFRESH_FAILED'`** (`auth.js:168`) — a code the
frontend interceptor (§2b above) does not special-case; it is the caller's
error to handle (see §5, step 6). This 401/`AUTH_REFRESH_FAILED` outcome is
MEASURED from the route's own catch-all (`auth.js:163-169` returns that
code for any thrown error, regardless of message); only the specific
`JsonWebTokenError` characterization of what `jwt.verify` throws is
INFERRED.

`POST /validate` (`auth.js:247-280`), for contrast, also routes through the
same `TokenService.verifyToken` (`auth.js:259`, called with the 1-arg
default `type = 'access'`) — HS256-only, same as `/refresh`. It shares
`/refresh`'s inability to validate a Cognito-issued (RS256) token; an
RS256 access/ID token submitted to `/validate` fails the same
`algorithms: ['HS256']` check and comes back structured the same way: 401,
`code: 'AUTH_INVALID_TOKEN'` (`auth.js:279`, its own catch — not to be
confused with `requireAuth`'s identically-named code in §4, a different
code path).

## 4. `verifyToken` in `src/middleware/auth.js` — error code for an expired RS256 token, with line numbers — MEASURED (code-path structure); INFERRED (library error-class specifics)

This file's dual-verifier router — not to be confused with
`TokenService.verifyToken` (§3, HS256-only, a different module):

```
$ sed -n '175,216p' src/middleware/auth.js
```

```
// F-AUTH-X1: Cognito (RS256) verifier path. Preserves the existing id-token-
// then-access-token fallback so token_use:'access' tokens still verify.
const verifyViaCognito = async (token) => {
  try {
    try {
      const payload = await getIdTokenVerifier().verify(token);
      return { payload, source: 'cognito', alg: 'RS256' };
    } catch (idError) {
      try {
        const payload = await getAccessTokenVerifier().verify(token);
        return { payload, source: 'cognito', alg: 'RS256' };
      } catch (_accessError) {
        throw idError;
      }
    }
  } catch (error) {
    throw wrapVerifierError(error);
  }
};

// F-AUTH-X1: tokenService (HS256) verifier path. The same code path that has
// run under NODE_ENV === 'test' since the F-Auth-3 era — now active in all
// environments per the Phase 2 surface §Q4 routing decision.
const verifyViaHs256 = (token) => {
  try {
    const payload = verifyHs256Token(token);
    return { payload, source: 'local-hs256', alg: 'HS256' };
  } catch (error) {
    throw wrapVerifierError(error);
  }
};

const verifyToken = async (token) => {
  const alg = detectTokenAlgorithm(token);

  if (alg === 'RS256') return verifyViaCognito(token);
  if (alg === 'HS256') return verifyViaHs256(token);

  // Routing fallback for unparseable/missing alg. See Q8 §4 above.
  if (process.env.NODE_ENV === 'test') return verifyViaHs256(token);
  return verifyViaCognito(token);
};
```

MEASURED (code-path structure, `auth.js:177-193`): `verifyViaCognito` tries
the ID-token verifier first (`auth.js:180`, `getIdTokenVerifier()`,
configured `tokenUse: 'id'` at `auth.js:113`). If that call throws, it is
caught as `idError` (`auth.js:182`) and the access-token verifier is tried
instead (`auth.js:184`, `getAccessTokenVerifier()`, configured
`tokenUse: 'access'` at `auth.js:120`). **If the access-token verifier ALSO
throws** (`auth.js:186`, caught as `_accessError`), the function does
**not** propagate `_accessError` — `auth.js:187` re-throws `idError`, the
ID verifier's original rejection, and `_accessError` is discarded entirely.

The frontend sends Cognito's **access** token as the bearer credential —
MEASURED (§1, §2a): `authService.js:31` stores `POST /login`'s
`accessToken` field under the `authToken` key, and `api.js:16`'s request
interceptor reads `authToken` for `Authorization: Bearer <token>`. Walking
what happens when that access token has expired and reaches
`verifyViaCognito`:

1. The ID-token verifier (`auth.js:180`) validates a token whose own
   `token_use` claim is `'access'` against a verifier configured for
   `tokenUse: 'id'` (`auth.js:113`). **INFERRED, not executed**: per
   `aws-jwt-verify`'s `tokenUse` option, this verifier rejects the token on
   the `token_use` mismatch — a claim-validation rejection, not
   necessarily (and not confirmed here by running it) an expiry-specific
   one. This becomes `idError` (`auth.js:182`).
2. The access-token verifier (`auth.js:184`) then validates the same token
   against `tokenUse: 'access'` (`auth.js:120`) — the correct
   configuration for this token. **INFERRED, not executed**: because the
   token has actually expired, this verifier is expected to reject it too,
   for the reason `aws-jwt-verify@^5.1.1` names `JwtExpiredError`
   (`node_modules/aws-jwt-verify/dist/cjs/error.js:63` —
   `class JwtExpiredError extends JwtInvalidClaimError`, read from the
   installed package, not from executing it). This rejection is caught as
   `_accessError` (`auth.js:186`) and never used.
3. `auth.js:187` throws `idError` — the ID verifier's token_use-mismatch
   rejection from step 1, **not** the access verifier's expiry rejection
   from step 2. This — not `JwtExpiredError` — is the error
   `verifyViaCognito` (and therefore `verifyToken`, called from
   `auth.js:210`) actually returns to `requireAuth` for an expired access
   token. Which precise error class `idError` is (a `JwtInvalidClaimError`
   subtype, by the same INFERRED reasoning as step 1) is not confirmed by
   execution in this read.

`requireAuth` (`auth.js:550-622`, the middleware CLAUDE.md's Conventions
section names for protected writes) is the consumer:

```
$ sed -n '571,621p' src/middleware/auth.js
```

```
  try {
    const { payload: decoded, source, alg } = await verifyToken(parts[1]);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      groups: decoded['cognito:groups'] || decoded.groups || [],
      tokenUse: decoded.token_use,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
      source, // F-AUTH-X1: 'cognito' | 'local-hs256' — observability only
      raw: decoded,
    };
    maybeAuthDebug(req, source, alg, decoded && decoded.sub);
    return next();
  } catch (error) {
    const configResponse = respondToAuthConfigError(error, req, res, 'requireAuth');
    if (configResponse) return configResponse;
    const infraCause = findCognitoInfraCause(error);
    if (infraCause) {
      // Inherits F-Auth-3 structured log + 503 contract from optionalAuth.
      // requireAuth is strict — no degradeOnInfraFailure option.
      console.error('[F-Auth-3] cognito_unreachable', {
        name: infraCause.name,
        code: infraCause.code,
        message: error.message,
        path: req.path,
        method: req.method,
        degraded: false,
      });
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service is temporarily unavailable',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
    }
    // F-Auth-4: token-rejection emits AUTH_INVALID_TOKEN so the frontend
    // interceptor can attempt refresh-once-then-redirect (per fix plan §4.6).
    // Cause is logged server-side; client sees a generic message — no verifier
    // internals leak.
    console.log('[F-Auth-4] requireAuth: token rejected', {
      message: error.message,
      path: req.path,
      method: req.method,
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'The provided token is invalid or expired.',
      code: 'AUTH_INVALID_TOKEN',
    });
  }
```

The two gates `idError` (wrapped via `wrapVerifierError`, `auth.js:191,132-136`)
passes through before reaching the final `AUTH_INVALID_TOKEN` return at
`auth.js:616-620`:

1. `respondToAuthConfigError` (`auth.js:587`) → `findAuthConfigCause`
   (`auth.js:341-348`) walks `error.cause` for `code === 'AUTH_CONFIG_MISSING'`
   only. MEASURED from the check's own condition: neither a `token_use`
   claim rejection nor an expiry rejection carries that code — does not
   match, regardless of which of the two candidate error classes `idError`
   actually is.
2. `findCognitoInfraCause` (`auth.js:589`, defined `auth.js:331-339`) walks
   `error.cause` against two fixed sets:
   ```
   $ sed -n '311,326p' src/middleware/auth.js
   const COGNITO_INFRA_ERROR_NAMES = new Set([
     'FetchError',
     'NonRetryableFetchError',
     'JwksNotAvailableInCacheError',
     'WaitPeriodNotYetEndedJwkError',
   ]);

   const NETWORK_INFRA_ERROR_CODES = new Set([
     'ECONNREFUSED',
     'ETIMEDOUT',
     'ENOTFOUND',
     'EAI_AGAIN',
     'ECONNRESET',
     'EHOSTUNREACH',
     'ENETUNREACH',
   ]);
   ```
   MEASURED: neither a claim-mismatch rejection nor `JwtExpiredError` is a
   member of `COGNITO_INFRA_ERROR_NAMES` (`auth.js:311-316`) — these four
   names are JWKS-fetch/cache failures, not token-content rejections — and
   neither carries a `.code` in `NETWORK_INFRA_ERROR_CODES`
   (`auth.js:318-326`). This holds independent of which of the two
   candidate error classes `idError` actually is.
3. Falls through both gates to `auth.js:616-620`.

**MEASURED: an expired Cognito access token reaching `requireAuth`
produces 401, `code: 'AUTH_INVALID_TOKEN'`** — not `AUTH_REQUIRED` — and
this conclusion is robust to the `idError`/`_accessError` correction above,
because neither gate discriminates on expiry vs. claim-mismatch; both are
name/code lookups against fixed infra-only sets. The diagnosis's second
possibility (expiry misrouted to `AUTH_REQUIRED`, which skips refresh per
§2b) is measured NOT the case for `requireAuth`. `authenticateToken`
(`auth.js:222-289`), a second, differently-shaped middleware in the same
file, reaches the same `AUTH_INVALID_TOKEN` code by a shorter path with no
infra/config gates (`auth.js:268-281`) — consistent, not contradictory.
NOT PERFORMED IN THIS READ (repo-derivable; simply out of this document's
scope, not Evoni-gated): which of these two middlewares — or `optionalAuth`
(`auth.js:291-456`, a third) — actually guards each protected route at
this basis is not enumerated in this document; CLAUDE.md's Conventions
section names `requireAuth` as the one writes should use, and this
document takes that as the load-bearing path.

## 5. The end-to-end path — MEASURED, step by step

1. A Cognito access token, minted at `POST /login`
   (`src/routes/auth.js:96-134`, §1) and stored as `authToken`
   (`authService.js:31`, §2a), expires. (The pool's configured token
   lifetime — NOT PERFORMED, Evoni-gated: no Cognito console access from
   this session.)
2. The next request carrying that token in `Authorization: Bearer <token>`
   reaches `requireAuth` (`src/middleware/auth.js:550-622`). `verifyToken`
   (`auth.js:207-216`) routes the access token as RS256 to
   `verifyViaCognito` (`auth.js:177-193`). MEASURED (code-path structure,
   §4): the ID-token verifier is tried first (`auth.js:180`) and, on
   failure, the access-token verifier is tried (`auth.js:184`); when both
   fail, it is the ID verifier's rejection (`idError`, `auth.js:182`) that
   gets re-thrown (`auth.js:187`) — **not** the access verifier's own
   rejection (`auth.js:186`, `_accessError`, discarded). INFERRED, not
   executed (§4): the ID verifier rejects on a `token_use` claim mismatch
   (configured `tokenUse: 'id'`, `auth.js:113`, against an access token);
   the discarded access-verifier rejection is the one expected to be
   `aws-jwt-verify`'s `JwtExpiredError`
   (`node_modules/aws-jwt-verify/dist/cjs/error.js:63`, package `^5.1.1`
   per `package.json`).
3. `requireAuth`'s catch (`auth.js:586-621`) passes `idError` (wrapped via
   `wrapVerifierError`, `auth.js:191,132-136`) through the config-error
   gate (`auth.js:587`, no match) and the infra gate (`auth.js:589`, no
   match — §4 above, a conclusion that holds regardless of which of the
   two candidate error classes `idError` actually is), then returns
   **401, `code: 'AUTH_INVALID_TOKEN'`** (`auth.js:616-620`).
4. The frontend response interceptor (`frontend/src/services/api.js:98`)
   matches on `status === 401 && code === 'AUTH_INVALID_TOKEN'`. Since the
   request has not yet been retried and its URL is not `/api/v1/auth/refresh`
   (`api.js:100,106`), it calls `refreshAccessToken()` (`api.js:55-64`, §2c).
5. `refreshAccessToken` reads `refreshToken` from `localStorage`
   (`api.js:56`, written at login by `authService.js:32`, §2a) — the
   Cognito-issued refresh token from §1 — and POSTs
   `{ refreshToken }` to `POST /api/v1/auth/refresh` (`api.js:59`).
6. `POST /refresh` (`auth.js:140-171`, §3) calls
   `TokenService.refreshAccessToken` (`auth.js:152`), which calls
   `TokenService.verifyToken(refreshToken, 'refresh')`
   (`src/services/tokenService.js:152`) — HS256-only, against the local
   `JWT_SECRET` (`tokenService.js:91,100`). The Cognito refresh token is
   not a valid HS256-signed JWT under that secret. INFERRED, not executed
   (§3): `jwt.verify` rejects it as `JsonWebTokenError`, re-thrown as
   `Invalid token signature` (`tokenService.js:121-122`), re-wrapped as
   `Token refresh failed: Invalid token signature`
   (`tokenService.js:173-175`). MEASURED: whatever the thrown message, the
   route's catch (`auth.js:163-169`) returns **401,
   `code: 'AUTH_REFRESH_FAILED'`** (`auth.js:168`) for any error
   `TokenService.refreshAccessToken` throws.
7. Back in the frontend, this rejects the `axios.post` call inside
   `refreshAccessToken` (step 5); that rejection is caught by the
   interceptor's own `catch (_refreshError)` (`api.js:115-118`), which
   calls `wipeSessionAndRedirect()` (`api.js:66-73`) — clearing
   `authToken`, `token`, `refreshToken` from `localStorage` and setting
   `window.location.href = '/login'` (`api.js:72`).

**End state, MEASURED: every session ends within one request of the
Cognito access token's expiry**, because step 6 can never succeed — `/refresh`
has no branch that accepts what `/login` (§1) actually hands the client.
This is the diagnosis's first possibility, confirmed; the second
(expiry read back as `AUTH_REQUIRED`) is measured not the case for
`requireAuth` (§4).

## 6. Not performed

- **Actual token lifetime in the Cognito user pool/app client** — Evoni-gated.
  Not repo-derivable; requires Cognito console access, which this session
  does not have and does not take (no host, AWS, database, or Cognito
  contact, per this document's opening line).
- **Live reproduction** (minting a real expired Cognito token and observing
  the wire response) — not performed. §5 is derived entirely by static
  code reading, cited file:line, with library-behavior specifics marked
  INFERRED where not executed; this document's no-Cognito-contact
  constraint (opening line) rules out running the verifiers live, not
  merely a scheduling choice.
- **Enumeration of every route's auth middleware choice**
  (`requireAuth` vs. `authenticateToken` vs. `optionalAuth`) — not
  performed in this read. This is repo-derivable (a grep across route
  files would answer it) and simply out of this document's scope; not
  Evoni-gated. Noted as open in §4.
- **Fix design.** No `REFRESH_TOKEN_AUTH` implementation, no ruling on
  ruling (b)/FD-65 history, no recommendation. That is the decision this
  document exists to inform, not to make — excluded by this document's
  own Standing statement, not by any access restriction.

---

## Closing — mints nothing, rules nothing, recommends nothing

- **Mints nothing.** No FD, no XK, no PE. This is a standalone read, not a
  Fix Plan revision.
- **Rules nothing.** Whether to add a Cognito `REFRESH_TOKEN_AUTH` path to
  `/refresh`, or any other remedy, is not decided here.
- **Recommends nothing.** No fix design is proposed.
- Only Evoni's written ruling, or a ratifying revision, disposes of this.

No host, AWS, database, or Cognito contact. Prod FROZEN.
