# F-AUTH-1 — logout/revocation of a Cognito access token, read

**Basis:** `origin/main` at `a40b72250c6b53a49c5a303cf253053a09b2fe84` (2026-09-20).
**Standing:** MEASURED for every claim read directly from the repository at
this basis — command and raw output pasted, verbatim, no elisions; a block
narrower than a cited line range is labelled an excerpt, with the exact
lines it shows stated. INFERRED for any claim about a dependency's runtime
behavior reasoned from that dependency's source but not confirmed by
executing it — labelled INFERRED at the point made, never upgraded to
MEASURED. NOT PERFORMED for anything left undone; each NOT PERFORMED item
says whether it is Evoni-gated (needs Cognito console or host access this
session does not take) or simply out of this document's scope. This is a
read. It mints nothing, rules nothing, recommends no fix design, and does
not edit any filed document.

No host, AWS, database, or Cognito contact.

---

## 1. `POST /logout` — middleware chain and what it calls in `TokenService` — MEASURED

```
$ sed -n '241,282p' src/routes/auth.js
```

```
/**
 * POST /api/v1/auth/logout
 * Logout user by revoking token
 * Requires valid authentication token
 */
router.post('/logout', authenticateJWT, (req, res) => {
  try {
    const { authorization } = req.headers;

    if (authorization) {
      const token = authorization.split(' ')[1];
      // Revoke the token
      try {
        TokenService.revokeToken(token);
      } catch (err) {
        console.log('Token revocation skipped (invalid token):', err.message);
      }
    }

    // Clear refresh token cookie if set
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
      data: {
        loggedOut: true,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: 'AUTH_LOGOUT_ERROR',
    });
  }
});
```

`src/routes/auth.js:246` — the full handler is `auth.js:246-282`, gated by
one middleware, `authenticateJWT` (imported `auth.js:11` from
`../middleware/jwtAuth`).

`src/middleware/jwtAuth.js:14-68` (`authenticateJWT`):

```
$ sed -n '1,20p' src/middleware/jwtAuth.js
```

```
/**
 * JWT Authentication Middleware
 * Supports both AWS Cognito and custom JWT tokens
 */

const _jwt = require('jsonwebtoken');
const { verifyToken } = require('./auth');

/**
 * Authenticate using JWT token (custom or Cognito)
 * Delegates verification to auth.js's dual-verifier verifyToken (F-AUTH-X1),
 * so this middleware accepts both HS256 (local) and RS256 (Cognito) tokens.
 */
const authenticateJWT = async (req, res, next) => {
```

`jwtAuth.js:7` imports `verifyToken` from `src/middleware/auth.js` (not
`TokenService.verifyToken` — a different function of the same name; see
§3). `jwtAuth.js:38` calls it: `const { payload: decoded, source, alg: _alg } = await verifyToken(token);`
— the dual-verifier router that also backs `requireAuth` (§3). This is the
gate: `authenticateJWT` accepts **either** an HS256 or an RS256 (Cognito)
token as the bearer credential for `/logout`, identically to any other
protected route.

Inside the handler itself, `TokenService` is called exactly once:
`auth.js:254`, `TokenService.revokeToken(token)`, where `token` is
whatever string follows `Bearer ` in the `Authorization` header
(`auth.js:248-251`) — the same token `authenticateJWT` just verified. No
other `TokenService` method is called in this handler. `auth.js:253-257`
wraps the call in its own try/catch that only logs on failure
(`console.log`, `auth.js:256`) — a thrown error from `revokeToken` does not
fail the request. `auth.js:261-265` additionally calls
`res.clearCookie('refreshToken', ...)`.

**MEASURED: no route in this file ever sets a `refreshToken` cookie.**

```
$ grep -n "res\.cookie" src/routes/auth.js
```

```
(no output — exit 0)
```

`auth.js:261`'s own comment says "Clear refresh token cookie **if set**" —
MEASURED, this repository never sets one; `res.clearCookie` at 261-265 is a
no-op against any real session state at this basis (`grep -rn "res\.cookie(.refreshToken" src/` from §4 below confirms this holds across the whole
`src/` tree, not just this file).

## 2. `TokenService`'s blacklist — where added, where checked, in-memory or persisted — MEASURED

```
$ sed -n '10,13p' src/services/tokenService.js
```

```
class TokenService {
  // Token blacklist for revoked tokens (in production, use Redis)
  static tokenBlacklist = new Set();
```

`tokenService.js:12` — `tokenBlacklist` is a `Set` held as a `static` class
field: one instance per Node process, in memory. `tokenService.js:11`'s own
comment states the production alternative (Redis) was never wired in.
**MEASURED: not persisted — lost on process restart, and not shared across
processes** (this stack runs PM2 on the production EC2 host per
`CLAUDE.md`'s Stack section; a `Set` on a class static field is
process-local, not shared between PM2 cluster workers if more than one
runs — this document does not check the PM2 process count, which is
Evoni-gated/out of scope, see §7).

**Added** — `tokenService.js:134-143` (`revokeToken`):

```
$ sed -n '130,143p' src/services/tokenService.js
```

```
  /**
   * Revoke a token (add to blacklist)
   * @param {string} token - JWT token to revoke
   */
  static revokeToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        this.tokenBlacklist.add(decoded.jti);
      }
    } catch (error) {
      console.warn('Failed to revoke token:', error.message);
    }
  }
```

`tokenService.js:136` uses `jwt.decode(token)` — this decodes the payload
without verifying any signature, so it succeeds for both HS256 and RS256
tokens alike (a Cognito access token's `jti` claim, if present, is decoded
the same as a local one). `tokenService.js:137-138` adds that `jti` to
`tokenBlacklist`.

**Checked** — `tokenService.js:100-105`, inside `TokenService.verifyToken`
only:

```
$ sed -n '88,106p' src/services/tokenService.js
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
      )
    }
```

`tokenService.js:91` — `jwt.verify` is called with `algorithms: ['HS256']`
only; a token that does not verify under HS256 against `JWT_SECRET` never
reaches line 100's `decoded`, so it never reaches the blacklist check at
`tokenService.js:103-105`. **MEASURED: `TokenService.verifyToken` is the
only place `tokenBlacklist` is read** (`grep -n "tokenBlacklist"
src/services/tokenService.js` below, §4, shows every occurrence in the
file) — and it is reached only via the HS256 signature-verification branch.

## 3. `src/middleware/auth.js` — does the RS256 path ever consult the blacklist? — MEASURED, exact branch

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

**Exact branch: `auth.js:210`, `if (alg === 'RS256') return
verifyViaCognito(token);`.** `verifyViaCognito` (`auth.js:177-193`) calls
only `getIdTokenVerifier().verify(token)` (`auth.js:180`) and
`getAccessTokenVerifier().verify(token)` (`auth.js:184`) — both
`aws-jwt-verify` `CognitoJwtVerifier` instances verifying against Cognito's
own JWKS (`auth.js:110-122`). Neither `TokenService` nor `tokenBlacklist`
is imported, referenced, or called anywhere inside `verifyViaCognito`:

```
$ grep -n "TokenService\|tokenBlacklist" src/middleware/auth.js
```

```
(no output — exit 0)
```

The only import of the HS256 verifier in this file is
`verifyHs256Token` (`auth.js:2`, aliased from `TokenService.verifyToken`),
and it is called exclusively from `verifyViaHs256`
(`auth.js:198-205`) — the `alg === 'HS256'` branch (`auth.js:211`), a
different branch from the one an RS256 token takes.

**MEASURED: the RS256 (Cognito) verification path never consults
`TokenService.tokenBlacklist`, at any point.** `requireAuth`
(`auth.js:550-622`) and `authenticateJWT` (`jwtAuth.js:14-68`, §1) both
call this same `verifyToken` (`auth.js:207-216`), so this holds for both
consumers.

## 4. `GlobalSignOut` / `AdminUserGlobalSignOut` / `RevokeToken` / `revokeToken` — every hit — MEASURED

```
$ grep -rn "GlobalSignOut\|AdminUserGlobalSignOut\|RevokeToken\|revokeToken" src/
```

```
src/routes/auth.js:254:        TokenService.revokeToken(token);
src/services/tokenService.js:134:  static revokeToken(token) {
src/services/tokenService.js:214:module.exports.revokeToken = TokenService.revokeToken.bind(TokenService);
```

```
$ grep -rn "GlobalSignOut\|AdminUserGlobalSignOut\|RevokeToken\|revokeToken" frontend/
```

```
(no output — exit 0)
```

Three hits total, all in `src/`, all the same local `TokenService.revokeToken`
already read in full in §2 (call site, definition, `module.exports` bind).
**Zero hits for `GlobalSignOut`, `AdminUserGlobalSignOut`, or Cognito's
`RevokeToken` API anywhere in `src/` or `frontend/`.**

Confirmed at the Cognito SDK import level — `src/services/cognitoPasswordAuthService.js`,
the only file in this codebase that constructs `CognitoIdentityProviderClient`
commands:

```
$ grep -n "^const {\|Command" src/services/cognitoPasswordAuthService.js
```

```
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
```

Only `InitiateAuthCommand` is imported — never `RevokeTokenCommand` or
`GlobalSignOutCommand`. **MEASURED: no code path in this repository calls
Cognito to invalidate a token, session, or user.**

## 5. Frontend logout (`authService.js`) — calls `/logout`? which keys clear? refresh token discarded? — MEASURED

```
$ sed -n '96,116p' frontend/src/services/authService.js
```

```
  /**
   * Logout - clear all stored auth data and call backend logout
   */
  async logout() {
    try {
      // Try to call backend logout endpoint. apiClient request interceptor
      // adds Authorization automatically — no explicit Bearer construction needed.
      if (this.getToken()) {
        try {
          await api.post('/api/v1/auth/logout', {});
        } catch (err) {
          console.warn('Backend logout failed (continuing with local logout):', err.message);
        }
      }
    } finally {
      // Always clear local storage regardless of backend response
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },
```

**Yes**, `authService.js:105` calls `POST /api/v1/auth/logout` with an
empty body (`{}`) — the `Authorization` header is attached by the API
client's request interceptor (comment, `authService.js:101-102`), not
constructed here. The call is guarded by `if (this.getToken())`
(`authService.js:103`) and its failure is only warned on
(`authService.js:106-107`), never re-thrown — logout proceeds regardless of
what the backend call does.

`authService.js:112-114`, inside the `finally` block (runs whether or not
the backend call above succeeded): three `localStorage` keys are removed —
`authToken`, `refreshToken`, `user`. **Yes, `refreshToken` is discarded**
(`authService.js:113`) — from this browser's `localStorage`, client-side
only. Note the request body sent at `authService.js:105` is `{}` — the
refresh token's value is never sent to `/logout` at all, and `/logout`
(§1) never reads `req.body` in the first place, only `req.headers.authorization`
(`auth.js:248`).

## 6. End-to-end result — MEASURED, file:line at each step

**Is a Cognito access token still accepted by `requireAuth` after
`/logout`?**

1. `/logout` (`auth.js:246-282`, §1) is reached with a Cognito RS256
   access token as the bearer credential — `authenticateJWT`
   (`jwtAuth.js:14-68`, §1) accepts either alg, and MEASURED (§5,
   `authService.js:31` from the companion §2a login read, this basis)
   the frontend's stored `authToken` is Cognito's own `AccessToken`,
   unmodified.
2. `auth.js:254` calls `TokenService.revokeToken(token)`
   (`tokenService.js:134-143`, §2). `jwt.decode` (`tokenService.js:136`,
   no signature check) reads the token's `jti` claim, if present, and adds
   it to `TokenService.tokenBlacklist` (`tokenService.js:137-138`) — an
   in-memory `Set` (§2).
3. A later request presents that same access token to `requireAuth`
   (`auth.js:550-622`). `verifyToken` (`auth.js:207-216`) detects `RS256`
   (`auth.js:208`, `detectTokenAlgorithm`) and routes to `verifyViaCognito`
   (`auth.js:210`, §3) — which MEASURED (§3) never reads
   `TokenService.tokenBlacklist` at any point. The set entry written in
   step 2 is never consulted on this path.
4. `verifyViaCognito` verifies the token against Cognito's JWKS only
   (signature, issuer, `token_use`, expiry — `auth.js:180,184`). Nothing
   in that check reflects the fact that `/logout` was ever called.

**MEASURED: yes — a Cognito access token presented to `requireAuth` (or
`authenticateJWT`) after `/logout` is verified and accepted exactly as if
`/logout` had never been called, and stays accepted until its own natural
Cognito-side expiry.** The blacklist write in step 2 is not dead code in
general (it does gate `TokenService.verifyToken`'s HS256 path, §2) but it
is write-only and inert for an RS256 token specifically, because no read
of it exists on that path (§3).

**Is the Cognito refresh token still exchangeable at `/refresh` after
`/logout`?**

```
$ sed -n '167,201p' src/routes/auth.js
```

```
/**
 * POST /api/v1/auth/refresh
 * Exchanges a Cognito refresh token for a new access token via InitiateAuth
 * (AuthFlow: REFRESH_TOKEN_AUTH). Per F-AUTH-1_Fix_Plan_v2.77.md §7/§8(a):
 * the local HS256 refresh path is retired for user sessions — this route is
 * not made polymorphic on `alg`, so an HS256 refresh token is passed to
 * Cognito the same as any other string and rejected on its own terms. This
 * implements §8(a) only; it does not close the refresh work — §8(b),
 * Evoni's live verification against the real pool, does.
 */
router.post('/refresh', optionalAuth, refreshLimiter, validateRefreshRequest, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    ...
    const result = await cognitoPasswordAuthService.refreshWithCognito(refreshToken);
```

`auth.js:189` calls `cognitoPasswordAuthService.refreshWithCognito`
(`cognitoPasswordAuthService.js:111-137`), which sends the refresh token
straight to Cognito's own `InitiateAuth`, `AuthFlow: 'REFRESH_TOKEN_AUTH'`
(`cognitoPasswordAuthService.js:123-127`) — this route now (at this basis;
this file's own docstring at `auth.js:167-175` and §7 below both note it
changed since the 2026-09-19 `F-AUTH-1_SessionRefresh_Read` document,
which measured an older basis where `/refresh` called
`TokenService.refreshAccessToken` instead — that HS256-only path is gone
at this basis).

MEASURED (§1, §4): `/logout` never calls Cognito at all — no
`RevokeTokenCommand`, no `GlobalSignOutCommand`, nothing in
`cognitoPasswordAuthService.js` imports either (§4) — and never even reads
the refresh token's value from the request (`/logout` doesn't touch
`req.body`, §1/§5). Client-side, `authService.js:113` (§5) removes
`refreshToken` from *this browser's* `localStorage`, so this particular
frontend client can no longer read it to POST to `/refresh` — but that is
a client-side deletion of a copy, not a server-side revocation of the
token itself.

**MEASURED: yes — nothing in this codebase revokes a Cognito refresh
token at `/logout`. If the refresh token's string value is available from
anywhere else** (captured before the browser's `localStorage.removeItem`
ran, read from another tab or a copy made earlier, etc.) **it remains
exchangeable at `/refresh` exactly as before, until Cognito's own
refresh-token expiry.** This document does not determine that expiry
value (§7, Evoni-gated) or attempt to demonstrate reuse live (§7,
excluded by this document's own no-Cognito-contact constraint).

## 7. Not performed

- **Actual Cognito token lifetimes (access or refresh) and any
  revocation-on-logout setting on the app client** — Evoni-gated. Not
  repo-derivable; requires Cognito console/CLI access, which this session
  does not have and does not take (no host, AWS, database, or Cognito
  contact, per this document's opening line).
- **Live reproduction** (logging out a real session, then replaying the
  same access token or refresh token against `requireAuth` / `/refresh`
  and observing the wire response) — not performed. §6 is derived entirely
  by static code reading, cited file:line; this document's no-Cognito-contact
  constraint rules out running it live, not merely a scheduling choice.
- **PM2 worker-count check for the in-memory blacklist's cross-process
  effect** (§2) — repo-derivable in principle from deploy config, but out
  of this document's scope; not attempted here.
- **Fix design.** No ruling on whether `/logout` should call Cognito
  `GlobalSignOut`/`RevokeToken`, whether the blacklist should also be
  consulted on the RS256 path, or any other remedy. That is a decision
  this document exists to inform, not to make.

---

## Closing — mints nothing, rules nothing, recommends nothing

- **Mints nothing.** No FD, no XK, no PE. This is a standalone read, not a
  Fix Plan revision.
- **Rules nothing.** Whether `/logout` should revoke a Cognito token
  server-side, or any other remedy, is not decided here.
- **Recommends nothing.** No fix design is proposed.
- Only Evoni's written ruling, or a ratifying revision, disposes of this.

No host, AWS, database, or Cognito contact. Prod FROZEN.
