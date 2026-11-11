# F-AUTH-1 — Logout Revocation, Options for Disposing of the Finding

*Standalone options note. Sets out, from the code at the basis below, what
logout does and does not revoke for Cognito-issued tokens, and four ways to
dispose of the finding filed at
`docs/audit/F-AUTH-1_LogoutRevocation_Read_2026-09-20.md`. A proposal only.
Rules nothing, mints nothing, closes nothing, changes no code and edits no
filed document. The choice is Evoni's.*

*Authoring note: the task asked for `/audit-file`. An agent session cannot
invoke that skill, so this note was written by hand to the form of the merged
options notes in this directory (for example
`F-Stats-1_ReadsSurvey_Options_2026-09-27.md`). That is flagged here and in
the PR for Evoni's review at the gate.*

## Purpose

The 2026-09-20 read measured that a Cognito token survives `POST /logout`.
It recommended nothing, by design. This note re-measures the same facts at
today's basis, states the exposure in time and place, and sets out options
(a) to (d) with what each costs and what it leaves, so a ruling can choose.

## H1 — Basis

```
$ git rev-parse origin/main
38db45d7f658199a3f45bc039173d41128358c4d
```

MEASURED. Date: 2026-11-11. Position taken from the session's wake-up
(`git fetch origin --prune`, then the command above; the repository is not
shallow). Every file:line below is at this SHA.

**Standings used.** MEASURED: read from the repository at the basis, command
and raw output pasted. ATTESTED: Evoni's own reading of something no session
measured, recorded as she gave it. INFERRED: reasoned from a dependency's
documentation or source, not confirmed by running it. UNKNOWN: not recorded
in the repository and not attested.

**Line numbers have moved since the filed read.** `src/routes/auth.js` and
`src/middleware/auth.js` changed between the read's basis (`a40b7225`) and
this one, so the read's citations (`auth.js:246-282` for `/logout`, for
example) are not this note's. Of three other files it cites, two are
byte-identical at both bases and one has changed:

```
$ git diff --stat a40b72250c6b53a49c5a303cf253053a09b2fe84 origin/main -- src/services/tokenService.js src/services/cognitoPasswordAuthService.js frontend/src/services/authService.js
 frontend/src/services/authService.js | 19 +++++--------------
 1 file changed, 5 insertions(+), 14 deletions(-)
```

MEASURED. `tokenService.js` and `cognitoPasswordAuthService.js` do not appear:
they are unchanged. The frontend's `authService.js` changed in its logging
only (the login and refresh messages no longer print the response or the
error object, Task #1976), which moved its line numbers; §1.5 re-reads its
logout at this basis. The filed read is not edited; this note stands beside
it.

## §1. What the code does at this basis — MEASURED

### 1.1 `POST /logout`

```
$ nl -ba src/routes/auth.js | sed -n '279,298p'
   279	router.post('/logout', authenticateJWT, (req, res) => {
   280	  try {
   281	    const { authorization } = req.headers;
   282	
   283	    if (authorization) {
   284	      const token = authorization.split(' ')[1];
   285	      // Revoke the token
   286	      try {
   287	        TokenService.revokeToken(token);
   288	      } catch (err) {
   289	        console.log('Token revocation skipped (invalid token):', err.message);
   290	      }
   291	    }
   292	
   293	    // Clear refresh token cookie if set
   294	    res.clearCookie('refreshToken', {
   295	      httpOnly: true,
   296	      secure: process.env.NODE_ENV === 'production',
   297	      sameSite: 'strict',
   298	    });
```

MEASURED. `/logout` (`src/routes/auth.js:279`) runs behind `authenticateJWT`,
takes the bearer token from the `Authorization` header (`:281-284`), calls
`TokenService.revokeToken(token)` (`:287`) and clears a `refreshToken` cookie
(`:294-298`). It does not read `req.body`, so it never sees the refresh
token, and it makes no call to Cognito.

### 1.2 `TokenService.tokenBlacklist`: where it is written and where it is read

```
$ nl -ba src/services/tokenService.js | sed -n '12p;100,105p;134,143p'
    12	  static tokenBlacklist = new Set();
   100	      const decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);
   101	
   102	      // Check if token is blacklisted (revoked)
   103	      if (this.tokenBlacklist.has(decoded.jti)) {
   104	        throw new Error('Token has been revoked');
   105	      }
   134	  static revokeToken(token) {
   135	    try {
   136	      const decoded = jwt.decode(token);
   137	      if (decoded && decoded.jti) {
   138	        this.tokenBlacklist.add(decoded.jti);
   139	      }
   140	    } catch (error) {
   141	      console.warn('Failed to revoke token:', error.message);
   142	    }
   143	  }
```

MEASURED. The blacklist is a static in-memory `Set`
(`src/services/tokenService.js:12`). `revokeToken` decodes the token without
verifying it and adds its `jti`, if it has one (`:136-138`). The only read is
inside `TokenService.verifyToken` (`:103`), after an HS256 `jwt.verify`
(`:100`).

Every mention of the set in `src`:

```
$ grep -rn 'tokenBlacklist' src --include=*.js
src/services/tokenService.js:12:  static tokenBlacklist = new Set();
src/services/tokenService.js:103:      if (this.tokenBlacklist.has(decoded.jti)) {
src/services/tokenService.js:138:        this.tokenBlacklist.add(decoded.jti);
```

And every caller of the HS256 verifier or the revoke function outside that
file:

```
$ grep -rn 'verifyHs256Token\|TokenService.verifyToken\|TokenService.revokeToken' src --include=*.js | grep -v '^src/services/tokenService.js'
src/middleware/auth.js:2:const { verifyToken: verifyHs256Token } = require('../services/tokenService');
src/middleware/auth.js:212:    const payload = verifyHs256Token(token);
src/routes/auth.js:287:        TokenService.revokeToken(token);
src/routes/auth.js:360:    const decoded = TokenService.verifyToken(token);
```

MEASURED. The set is read in one place only, on the HS256 path.

### 1.3 Does `verifyViaCognito` consult it?

```
$ nl -ba src/middleware/auth.js | sed -n '117,121p;188,205p;219,228p'
   117	const getAccessTokenVerifier = () => {
   118	  if (_accessTokenVerifier) return _accessTokenVerifier;
   119	  const { userPoolId, clientId } = getCognitoConfig();
   120	  _accessTokenVerifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId });
   121	  return _accessTokenVerifier;
   188	const verifyViaCognito = async (token) => {
   189	  try {
   190	    try {
   191	      const payload = await getIdTokenVerifier().verify(token);
   192	      return { payload, source: 'cognito', alg: 'RS256' };
   193	    } catch (idError) {
   194	      try {
   195	        const payload = await getAccessTokenVerifier().verify(token);
   196	        return { payload, source: 'cognito', alg: 'RS256' };
   197	      } catch (accessError) {
   198	        if (!findCognitoInfraCause(idError) && findCognitoInfraCause(accessError)) throw accessError;
   199	        throw idError;
   200	      }
   201	    }
   202	  } catch (error) {
   203	    throw wrapVerifierError(error);
   204	  }
   205	};
   219	const verifyToken = async (token) => {
   220	  const alg = detectTokenAlgorithm(token);
   221	
   222	  if (alg === 'RS256') return verifyViaCognito(token);
   223	  if (alg === 'HS256') return verifyViaHs256(token);
   224	
   225	  // Routing fallback for unparseable/missing alg. See Q8 §4 above.
   226	  if (process.env.NODE_ENV === 'test') return verifyViaHs256(token);
   227	  return verifyViaCognito(token);
   228	};
```

MEASURED: no. `verifyToken` (`src/middleware/auth.js:219`) sends an RS256
token to `verifyViaCognito` (`:222`), which tries the ID-token verifier
(`:191`) and then the access-token verifier (`:195`), both
`CognitoJwtVerifier` instances (`:120` for the access one). Nothing in that
function, or anywhere in the two middleware files, mentions the blacklist or
a `jti`:

```
$ grep -c 'tokenBlacklist\|jti' src/middleware/auth.js src/middleware/jwtAuth.js
src/middleware/auth.js:0
src/middleware/jwtAuth.js:0
```

MEASURED (zero matches in both files). Two consequences follow from the code
alone: a Cognito token's `jti` written by `/logout` is never looked up again,
and an RS256 **ID** token is accepted on the same path as an access token.

### 1.4 `/refresh` and Cognito refresh tokens

```
$ nl -ba src/routes/auth.js | sed -n '201,203p;213,225p'
   201	router.post('/refresh', optionalAuth, refreshLimiter, validateRefreshRequest, async (req, res) => {
   202	  try {
   203	    const { refreshToken } = req.body;
   213	    const result = await cognitoPasswordAuthService.refreshWithCognito(refreshToken);
   214	
   215	    // Contract: exactly these three fields (v2.77 ruling 3) — never idToken,
   216	    // never refreshToken (non-rotation design; see §7).
   217	    return res.status(200).json({
   218	      success: true,
   219	      message: 'Token refreshed',
   220	      data: {
   221	        accessToken: result.accessToken,
   222	        expiresIn: result.expiresIn,
   223	        tokenType: result.tokenType,
   224	      },
   225	    });
```

```
$ nl -ba src/services/cognitoPasswordAuthService.js | sed -n '9,12p;123,136p'
     9	const {
    10	  CognitoIdentityProviderClient,
    11	  InitiateAuthCommand,
    12	} = require('@aws-sdk/client-cognito-identity-provider');
   123	  const command = new InitiateAuthCommand({
   124	    AuthFlow: 'REFRESH_TOKEN_AUTH',
   125	    ClientId: clientId,
   126	    AuthParameters: { REFRESH_TOKEN: refreshToken },
   127	  });
   128	
   129	  const response = await getClient().send(command);
   130	  const { AccessToken, ExpiresIn, TokenType } = response.AuthenticationResult;
   131	
   132	  return {
   133	    accessToken: AccessToken,
   134	    expiresIn: ExpiresIn,
   135	    tokenType: TokenType,
   136	  };
```

MEASURED. `/refresh` (`src/routes/auth.js:201`) passes the body's
`refreshToken` to `refreshWithCognito` (`:213`), which sends it to Cognito's
`InitiateAuth` with `AuthFlow: 'REFRESH_TOKEN_AUTH'`
(`src/services/cognitoPasswordAuthService.js:123-127`). The response carries
a new access token and no new refresh token (`:215-224`): the same refresh
token is used again each time. The service imports `InitiateAuthCommand` and
nothing else from the Cognito client (`:9-12`).

No Cognito revocation call exists in the backend or the frontend:

```
$ grep -rnE 'GlobalSignOut|AdminUserGlobalSignOut|RevokeTokenCommand' src frontend/src --include=*.js --include=*.jsx | wc -l
0
```

MEASURED (zero).

### 1.5 The frontend on logout

```
$ nl -ba frontend/src/services/authService.js | sed -n '26,27p;89,105p'
    26	        localStorage.setItem('authToken', accessToken);
    27	        localStorage.setItem('refreshToken', refreshToken);
    89	  async logout() {
    90	    try {
    91	      // Try to call backend logout endpoint. apiClient request interceptor
    92	      // adds Authorization automatically — no explicit Bearer construction needed.
    93	      if (this.getToken()) {
    94	        try {
    95	          await api.post('/api/v1/auth/logout', {});
    96	        } catch (err) {
    97	          console.warn('Backend logout failed (continuing with local logout):', err.message);
    98	        }
    99	      }
   100	    } finally {
   101	      // Always clear local storage regardless of backend response
   102	      localStorage.removeItem('authToken');
   103	      localStorage.removeItem('refreshToken');
   104	      localStorage.removeItem('user');
   105	    }
```

```
$ nl -ba frontend/src/utils/authSession.js | sed -n '84,91p'; grep -n "getItem('authToken')" frontend/src/services/api.js
    84	export const wipeSessionAndRedirect = () => {
    85	  // Skip in DEV — keeps hot-reload from kicking devs to /login on every restart.
    86	  if (import.meta.env.DEV) return;
    87	  localStorage.removeItem('authToken');
    88	  localStorage.removeItem('token');
    89	  localStorage.removeItem('refreshToken');
    90	  window.location.href = '/login';
    91	};
19:    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
```

MEASURED. On login the frontend stores Cognito's access token as `authToken`
and the refresh token as `refreshToken` in `localStorage`
(`frontend/src/services/authService.js:26-27`). `logout()` posts an empty
body to `/api/v1/auth/logout` (`:95`) and then removes `authToken`,
`refreshToken` and `user` from this browser's `localStorage` (`:102-104`),
whether or not the backend call succeeded. A failed refresh does the same
through `wipeSessionAndRedirect` (`frontend/src/utils/authSession.js:84-91`).
Removing a copy from one browser is not a revocation.

The API takes a token from the `Authorization` header only:

```
$ grep -rnE 'req\.query\.(token|access_token|authToken)|req\.cookies\.(token|authToken|accessToken)' src --include=*.js | wc -l
0
```

MEASURED (zero routes read a token from the query string or a cookie).

## §2. The exposure

**What stays usable after logout, and for how long.**

| Token | After `/logout` | For how long |
|---|---|---|
| Cognito access token | Still accepted by `requireAuth`, `authenticateJWT` and `optionalAuth` (§1.3) | Until its own expiry: **1 hour** from issue (ATTESTED) |
| Cognito ID token | Accepted on the same path (§1.3) | **1 hour** from issue (ATTESTED) |
| Cognito refresh token | Still exchangeable at `/refresh` for new access tokens (§1.4) | **30 days** from login (ATTESTED) |
| A local HS256 token, if one exists | Refused by the blacklist (§1.2) | Until the API process restarts, when the in-memory set is empty again |

So the practical window is the refresh token's: someone holding a copy of it
can keep minting fresh one-hour access tokens for up to 30 days after the
user logged out.

**Where the lifetimes come from.** Evoni read the app client's settings in
the Cognito console on 2026-11-10 and gave them in the session:

| Field | Value as read |
|---|---|
| Access token expiration | 1 hour |
| ID token expiration | 1 hour |
| Refresh token expiration | 30 days |
| Advanced authentication settings | "Enable token revocation" is listed |
| Client secret | none |

**Standing: ATTESTED**, not MEASURED: no session read them, and this note's
task forbids contacting Cognito. No pool or client identifier is recorded
here. One caution on the fourth row: it is read from a panel that lists the
settings that are on; the client's Edit page shows it as a ticked box, and
that confirmation has not been taken.

The register already held part of this. `F-AUTH-1_Fix_Plan_v2.77.md` records
Evoni's earlier reading, also ATTESTED:

```
$ nl -ba docs/audit/F-AUTH-1_Fix_Plan_v2.77.md | sed -n '409,417p'
   409	| field | value as read |
   410	|---|---|
   411	| `RefreshTokenRotation` | **null / not configured** |
   412	| `RefreshTokenValidity` | **30** — unit **omitted** (Evoni: the default, days) |
   413	| `AccessTokenValidity` | **null / omitted** — unit **omitted** |
   414	| `IdTokenValidity` | **null / omitted** — unit **omitted** |
   415	| `ExplicitAuthFlows` | **`ALLOW_ADMIN_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`, `ALLOW_USER_PASSWORD_AUTH`** |
   416	
   417	**Standing: ATTESTED.** Not MEASURED — no instrument in this repository
```

MEASURED (that these lines are in the register). The earlier reading had the
refresh figure with its unit omitted and no access-token figure; the
2026-11-10 reading supplies both. Nothing in the repository records the
app client's `EnableTokenRevocation` setting:

```
$ git grep -n 'EnableTokenRevocation' origin/main | wc -l
0
```

MEASURED (zero).

**From where.** The token works from anywhere that can reach the API over
HTTPS. It has to be presented in an `Authorization` header (§1.5), so the
realistic ways to hold a copy are the ones that read a browser's
`localStorage` or a request in flight: a script injected into the page, a
shared or compromised computer, a browser extension, or a copy made before
logout. It also works on the dev site, which signs in against the same pool
and client:

```
$ grep -n 'production.s\*\* pool and app client\|Who can sign in' docs/runbooks/dev-environment.md | cut -c1-230
69:| Cognito | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` and `COGNITO_REGION` in `app.env` are **production's** pool and app client (Evoni, 2026-11-10; no dev pool). The client has no secret, so the box holds none. Login is serv
108:| Who can sign in | Every user of production's Cognito pool (self sign-up is off). |
```

MEASURED (the runbook records it). A token issued through production is
accepted by dev and the other way round, because both verify against the
same pool and client.

**What the finding is not.** A user who logs out in their own browser is
logged out of that browser: its copies are gone (§1.5). The finding is about
a copy that exists somewhere else.

## §3. Two facts the options rest on

**The API process and the in-memory set.**

```
$ nl -ba ecosystem.config.js | sed -n '91,96p'
    91	      name: 'episode-api-prod-hotfix',
    92	      script: '/home/ubuntu/episode-metadata/src/server.js',
    93	      cwd: '/home/ubuntu/episode-metadata',
    94	      interpreter: 'node',
    95	      interpreter_args: '',
    96	      instances: 1,
```

MEASURED. The production manifest runs one API process. An in-memory set
lives in that one process and is empty after every restart; a deploy
restarts the API (`docs/runbooks/deploy-workflow.md` §1). The dev box runs
its own separate process.

**What the installed libraries offer.**

```
$ ls node_modules/@aws-sdk/client-cognito-identity-provider/dist-types/commands 2>/dev/null | grep -E '^(RevokeToken|GlobalSignOut)Command' ; grep -m1 '"version"' node_modules/@aws-sdk/client-cognito-identity-provider/package.json; grep -m1 '"version"' node_modules/aws-jwt-verify/package.json; echo "files in aws-jwt-verify mentioning revocation: $(grep -rliE 'revok|revoc' node_modules/aws-jwt-verify/dist 2>/dev/null | wc -l)"
GlobalSignOutCommand.d.ts
RevokeTokenCommand.d.ts
  "version": "3.1133.0",
  "version": "5.1.1",
files in aws-jwt-verify mentioning revocation: 0
```

INFERRED, from the copy installed in the working checkout's `node_modules`,
which the basis does not pin to the byte: the Cognito client already in
`package.json` ships `RevokeTokenCommand` and `GlobalSignOutCommand`, and
`aws-jwt-verify` has no revocation check in it. That matches how
`CognitoJwtVerifier` works: it checks a token's signature, issuer, audience,
use and expiry against Cognito's public keys, locally, and never asks Cognito
whether the token has been revoked.

**Cognito's own behaviour, as its documentation describes it** (INFERRED;
not run):

- `RevokeToken` takes a refresh token and the client ID. It ends that refresh
  token and marks the access and ID tokens issued from it as revoked **for
  Cognito's own APIs**. It works only when token revocation is enabled on
  the client.
- A revoked access token is still a validly signed JWT. A service that
  verifies locally, as this API does, goes on accepting it until it expires.
- `GlobalSignOut` takes an access token and ends every refresh token the
  user has, on every device.
- Access tokens carry a `jti`, and, on a client with revocation enabled, an
  `origin_jti` shared by every token minted from the same refresh token.
- An access token's lifetime can be set from 5 minutes to 1 day.

## §4. The options

### (a) Accept and document

Leave the code as it is. Record, in the register and wherever sessions are
described to users, that logging out clears this browser and does not end
the session at Cognito.

- **Cost:** a ruling and a paragraph. No code, no settings.
- **Infra:** none.
- **Residual risk:** all of §2. A copied refresh token works for up to 30
  days after logout; a copied access token for up to 1 hour.
- **Also leaves:** the `/logout` handler's docstring and its
  `TokenService.revokeToken` call (`src/routes/auth.js:276`, `:287`) saying
  "revoking" for a token type they do not revoke.

### (b) Revoke the refresh token at Cognito on logout

`/logout` calls Cognito so the refresh token stops working.

- **What changes:** the frontend sends its refresh token in the `/logout`
  body (today it sends `{}`, §1.5); the handler calls `RevokeTokenCommand`
  with it. Or the handler calls `GlobalSignOutCommand` with the access token
  it already has, which needs no frontend change and signs the user out of
  every device.
- **Cost:** small. One backend handler, one frontend call, tests with the
  Cognito client stubbed. A decision is needed on what `/logout` answers
  when Cognito is unreachable; the frontend clears its copies either way.
- **Infra:** none new. Both calls need only the client ID the service
  already holds, and the client has no secret (ATTESTED). It depends on
  token revocation being enabled on the client (ATTESTED as listed; see the
  caution in §2).
- **Effect on the refresh token:** dead at once. `/refresh` gets Cognito's
  refusal.
- **Effect on a locally verified access token:** none. §3: the API never
  asks Cognito, so an access or ID token already issued keeps working until
  it expires.
- **Residual risk:** up to 1 hour for a copied access or ID token. The
  30-day window closes.

### (c) A server-side denylist by `jti` in `verifyViaCognito`

`/logout` records the token's `jti`; `verifyViaCognito` refuses a token
whose `jti` is recorded.

- **What changes:** a lookup added to the RS256 path in
  `src/middleware/auth.js` (§1.3), for ID tokens as well as access tokens,
  since both are accepted there. Each entry can be dropped once the token
  would have expired anyway.
- **Cost, with the in-memory set that exists:** small to write, and weak.
  The set empties on every restart, and every deploy restarts the API (§3),
  so a token denied before a deploy is accepted again after it. The dev box
  has its own process and its own set, and accepts the same tokens (§2).
- **Cost, done properly:** a store that outlives a restart and is shared by
  every process that verifies tokens.

```
$ ls src/config/redis.js && grep -n 'redis' package.json
src/config/redis.js
99:    "redis": "^5.10.0",
```

  MEASURED: the repository has a Redis client configuration and the package
  installed. Using it puts a network lookup on every authenticated request
  and makes sign-in depend on that store. A ruling would have to say what
  happens when the store is down: accept the token (the denylist silently
  stops working) or refuse it (an outage of the store logs everyone out).
- **Infra:** a durable shared store for the denylist, reachable from
  production and from dev.
- **What it does not do alone:** a `jti` identifies one access token. The
  refresh token still mints new ones, each with a new `jti` the list has
  never seen. Denying by `origin_jti` would cover every token from the same
  refresh token (INFERRED, §3), but only until the entry is dropped, and the
  refresh token itself would still be live at Cognito. In practice (c) is an
  addition to (b), not a replacement.
- **Residual risk with (b) and a durable store:** none of §2's windows.
  With the in-memory set: the window reopens at each restart.

### (d) A shorter access-token lifetime, alone or with (b)

Set the access and ID token expiration on the app client below 1 hour.

- **What changes:** a setting on the Cognito app client, which is Evoni's to
  change (a Cognito client change is gated). No code.
- **Cost:** the frontend refreshes more often. It already refreshes on its
  own (`authService.refreshToken`, `frontend/src/services/authService.js:111-134`),
  one refresh at a time (`frontend/src/utils/authSession.js:78-81`). At 15
  minutes that is four exchanges an hour for each open session, against a
  refresh limit of 10 a minute. A refresh that fails logs the user out
  (`authService.js:131`), so a Cognito hiccup is felt sooner than it is at 1
  hour.
- **Infra:** none.
- **Alone:** it shortens the access-token window and leaves the refresh
  token's 30 days untouched. A holder of the refresh token is not affected.
  Alone it does not dispose of the finding.
- **With (b):** after logout the refresh token is dead at once and any
  copied access token dies within the new lifetime.
- **Residual risk with (b):** the chosen lifetime, for example 15 minutes,
  and no more.

### Side by side

| | Code | Settings | New infra | Refresh token after logout | Access token after logout |
|---|---|---|---|---|---|
| (a) accept | none | none | none | 30 days | 1 hour |
| (b) revoke at Cognito | small | none (needs revocation enabled) | none | dead | 1 hour |
| (c) denylist, in memory | small | none | none | 30 days unless with (b) | refused until the next restart |
| (c) denylist, durable store | medium | none | a shared store | 30 days unless with (b) | refused |
| (d) shorter lifetime alone | none | one | none | 30 days | the new lifetime |
| (b) + (d) | small | one | none | dead | the new lifetime |
| (b) + (c) durable | medium | none | a shared store | dead | refused |

### Recommendation (the author's; it rules nothing)

**(b), with (d) at 15 minutes once (b) is in.** (b) closes the 30-day window,
which is nearly all of the exposure, for a small change and no new
infrastructure. (d) then cuts the remaining window from an hour to minutes
with one setting. (c) is the only option that refuses a copied access token
at once, and it buys that by putting a shared store on every authenticated
request; for an application with a handful of accounts that is more
machinery, and more ways to lock everyone out, than a 15-minute window
warrants. Within (b), `RevokeToken` on the one refresh token fits "log out of
this browser"; `GlobalSignOut` fits "log out everywhere" and is the simpler
change. Which of those "logout" means here is a product decision, not a
technical one.

This recommendation rests on two ATTESTED readings (the lifetimes, and
revocation being enabled) and on INFERRED Cognito behaviour (§3). Neither
has been run.

## What this document does not do

- **Rules nothing.** It disposes of nothing in the filed read.
- **Edits no filed document** and changes no code.
- **Proves nothing live.** No token was logged out and replayed; no Cognito,
  AWS, host or database call was made for it. Cognito's behaviour in §3 is
  from its documentation.
- **Does not measure the Cognito settings.** §2's table is Evoni's reading.
- **Does not design the change.** Each option is described far enough to
  price it, not to build it.
- **Does not look at token theft itself** (how a copy could be made), only
  at what a copy can do after logout.

## The questions for Evoni's ruling

1. **Disposition.** Which of these disposes of the finding: (a) accept and
   document; (b); (b) with (d); (b) with (c); or another combination?
2. **If (b): which call?** `RevokeToken` on the session's own refresh token
   (logout ends this browser's session only, and the frontend must send the
   refresh token), or `GlobalSignOut` (logout ends the user's sessions on
   every device)?
3. **If (b): when Cognito cannot be reached,** does `/logout` still answer
   success once the browser's copies are cleared, or report that the session
   could not be ended?
4. **If (d): what lifetime** for the access and ID tokens? And is the change
   to the app client made before or after (b) ships?
5. **If (c): which store,** and when it is down, are tokens accepted or
   refused?
6. **The revocation setting.** Will Evoni confirm from the app client's Edit
   page that "Enable token revocation" is ticked, so (b) rests on a
   confirmed reading?
7. **The dev site** shares the pool and client (§2). Is it in scope of
   whatever is ruled, or accepted as it is?

Only Evoni's written ruling, or a ratifying Fix Plan revision, disposes of
the finding.

## Footer

**Type:** standalone options note. **Rules:** nothing. **Mints:** nothing —
no FD, no XK, no PE. **Host/AWS/DB/Cognito contact:** none.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-11-11. Basis: `origin/main` at `38db45d7f658199a3f45bc039173d41128358c4d`.*
*Authority: `F-AUTH-1_LogoutRevocation_Read_2026-09-20.md` (the finding);
`F-AUTH-1_Fix_Plan_v2.77.md` (the `/refresh` rulings and the earlier
attested client reading). Every code claim MEASURED at the basis above;
ATTESTED, INFERRED and UNKNOWN marked where they apply. Task: #3794.*
