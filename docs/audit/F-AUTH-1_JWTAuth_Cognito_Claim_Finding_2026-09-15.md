# F-AUTH-1 — `jwtAuth.js`'s Cognito Claim and Acceptance Surface, Re-Derived

| | |
|---|---|
| **Type** | New filing. Re-derives every read from source at this task's own basis; does not carry issue #1443's content on trust. |
| **Basis** | `origin/main` at `e940c906bb7bc60dab0b91ea86dc1e6f0f02fa8c`, this session's `/wake-up` basis. |
| **Filing date** | `2026-09-15` — from `date -u +%Y-%m-%d`, run in the filing session's own shell (see command below). |
| **Prior read cited** | Issue #1443, *"read jwtAuth.js's Cognito claim and its acceptance surface"*. |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios. |

```
$ date -u +%Y-%m-%d
2026-09-15
```

---

## 0. Standing note on issue #1443

**Issue #1443 carries zero comments as of this filing** —
`issue_read(method=get_comments, issue_number=1443)` returned `[]`. The
prior read ran and reported in its own session; that report was never
recorded as a comment on the issue itself, which is why the query above
returns empty. This filing does not have that report's text on hand to
quote or diff line-by-line, so every read below is re-derived fresh from
source, per this task's own instruction — not carried from #1443 on trust.
Where #1443's findings are known (from issue #1444's own body, which states
what #1443 found: a nine-route enumeration, the `compositions.js` duplicate
`PUT /:id` left out of its scope), this re-derivation is checked against
those specific points at the relevant section, and **agrees with them in
full** — independently reproduced, not merely uncontradicted.

This document rules nothing, mints no gate change, and closes nothing.

---

## 1. `src/middleware/jwtAuth.js`, whole, line-numbered

```
$ cat -n src/middleware/jwtAuth.js
```

The header, lines 1–4:

```
     1	/**
     2	 * JWT Authentication Middleware
     3	 * Supports both AWS Cognito and custom JWT tokens
     4	 */
```

**The Cognito claim is at line 3**: *"Supports both AWS Cognito and custom
JWT tokens."* A second claim appears at lines 9–11:

```
     9	/**
    10	 * Authenticate using JWT token (custom or Cognito)
    11	 * Tries JWT first, falls back to Cognito
    12	 */
```

**Measured: neither claim is backed by a call in this file.** `authenticateJWT`
(lines 13–67) and `optionalJWTAuth` (lines 73–113) each call exactly one
verification function — `TokenService.verifyToken(token)`, at line 38 and
line 91 respectively. Both are `try`/`catch` blocks around that single call;
neither contains a second, fallback call to any Cognito-specific verifier
(no JWKS fetch, no `aws-jwt-verify`, no `jwks-rsa`, no second `jwt.verify`
with a different key source). **No Cognito verifier is reachable from this
file at this basis.**

---

## 2. `src/services/tokenService.js` — the hard-coded algorithm list

```
$ cat -n src/services/tokenService.js
```

Line 91:

```
    91	        algorithms: ['HS256'],
```

This sits inside `verifyToken` (lines 88–128), whose only signature
verification call is line 100:

```
   100	      const decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);
```

`verifyOptions.algorithms` is fixed at `['HS256']` (line 91) and is never
widened elsewhere in this method. **Confirmed: no Cognito verifier — no
public-key or JWKS-based check — is reachable from `jwtAuth.js` through this
call.** The only key source is `process.env.JWT_SECRET`, a symmetric secret.

---

## 3. Every route gated by `authenticateJWT` or `optionalJWTAuth`

```
$ grep -rn "authenticateJWT\|optionalJWTAuth" --include='*.js' src/
src/middleware/jwtAuth.js:13:const authenticateJWT = async (req, res, next) => {
src/middleware/jwtAuth.js:73:const optionalJWTAuth = async (req, res, next) => {
src/middleware/jwtAuth.js:172:  authenticateJWT,
src/middleware/jwtAuth.js:173:  optionalJWTAuth,
src/routes/compositions.js:21:const { authenticateJWT, requireGroup } = require('../middleware/jwtAuth');
src/routes/compositions.js:476:router.put('/:id', authenticateJWT, async (req, res) => {
src/routes/compositions.js:507:router.put('/:id/approve', authenticateJWT, requireGroup('ADMIN'), async (req, res) => {
src/routes/compositions.js:530:router.put('/:id/primary', authenticateJWT, async (req, res) => {
src/routes/compositions.js:553:router.put('/:id/publish', authenticateJWT, requireGroup('ADMIN'), async (req, res) => {
src/routes/compositions.js:591:router.post('/:id/generate', authenticateJWT, requireGroup('ADMIN'), async (req, res) => {
src/routes/compositions.js:813:router.put('/:id', authenticateJWT, async (req, res) => {
src/routes/compositions.js:882:router.delete('/:id', authenticateJWT, async (req, res) => {
src/routes/auth.js:10:const { authenticateJWT } = require('../middleware/jwtAuth');
src/routes/auth.js:165:router.post('/logout', authenticateJWT, (req, res) => {
src/routes/auth.js:207:router.get('/me', authenticateJWT, (req, res) => {
```

**Route registrations gated by `authenticateJWT`** (excluding the two
`require` lines and the two `module.exports` lines above, which are not
route registrations), mount paths taken from `src/app.js:689`
(`app.use('/api/v1/compositions', compositionRoutes)`) and `src/app.js:426`
(`app.use('/api/v1/auth', authRoutes)`):

| # | File:line | Method | Full path | Extra gate |
|---|---|---|---|---|
| 1 | `src/routes/compositions.js:476` | PUT | `/api/v1/compositions/:id` | — |
| 2 | `src/routes/compositions.js:507` | PUT | `/api/v1/compositions/:id/approve` | `requireGroup('ADMIN')` |
| 3 | `src/routes/compositions.js:530` | PUT | `/api/v1/compositions/:id/primary` | — |
| 4 | `src/routes/compositions.js:553` | PUT | `/api/v1/compositions/:id/publish` | `requireGroup('ADMIN')` |
| 5 | `src/routes/compositions.js:591` | POST | `/api/v1/compositions/:id/generate` | `requireGroup('ADMIN')` |
| 6 | `src/routes/compositions.js:813` | PUT | `/api/v1/compositions/:id` | — |
| 7 | `src/routes/compositions.js:882` | DELETE | `/api/v1/compositions/:id` | — |
| 8 | `src/routes/auth.js:165` | POST | `/api/v1/auth/logout` | — |
| 9 | `src/routes/auth.js:207` | GET | `/api/v1/auth/me` | — |

**Nine route registrations, at this basis.** Row 1 and row 6 register the
same method and path (`PUT /api/v1/compositions/:id`) twice, at lines 476
and 813. Issue #1444's own body names this as something #1443 "left out of
scope" and asks this filing to state what it is, not merely that it exists.
Settled from source:

- **Both registrations are on the same `express.Router()` instance.**
  `src/routes/compositions.js:55` declares the router once
  (`const router = express.Router();`); both `router.put('/:id', ...)`
  calls (lines 476, 813) are calls on that single object; the file exports
  it once (`module.exports = router;`, line 1662); `src/app.js:689` mounts
  it once (`app.use('/api/v1/compositions', compositionRoutes)`). There is
  one router, mounted once, not two routers at different prefixes.
- **Express Router matches middleware in the order they were registered on
  that router.** For two identical `method`+`path` registrations on the
  same router, the first one registered — line 476 — matches and runs for
  every `PUT /api/v1/compositions/:id` request; `next()` is never called
  from within it toward a further match, so the line-813 handler is never
  reached by any request.
- **What each handler does, read from source at
  `compositions.js:476-501` and `compositions.js:813-876`:** line 476's
  handler reads `composition_config` from the body and calls
  `CompositionService.updateComposition(id, composition_config)`; line
  813's handler reads individual asset-id fields (`template_id`,
  `lala_asset_id`, `justawomen_asset_id`, `guest_asset_id`,
  `background_frame_asset_id`) directly off the body and updates the
  `ThumbnailComposition` model's fields itself, resetting
  `approval_status` to `'DRAFT'`.

**Line 476's handler is live; line 813's handler is dead code** — registered
under `authenticateJWT`, present in the file, and unreachable by any
request, because a request matching its route never gets past line 476's
handler first. This is measured from the single-router, single-mount fact
above and from `express`'s own route-matching order, not inferred from
either handler's content.

**`optionalJWTAuth` has zero callers**, confirmed by the same grep: it
appears only at its own definition (line 73) and its own export (line 173)
in `src/middleware/jwtAuth.js`. No route file in `src/` invokes it.

**On #1443's count:** issue #1444's own body refers to a "nine-route list"
attributed to #1443. This re-derivation independently finds nine
registrations at this basis — the count agrees in full. #1443's report
text itself is not on hand to diff its specific file/line/method values
against (§0), only the count and the duplicate's presence, both stated in
#1444's body; on those two points, this re-derivation agrees.

---

## 4. What an RS256 token receives today, traced to source

**The check.** `tokenService.verifyToken` calls `jwt.verify` (line 100)
with `algorithms: ['HS256']` fixed at line 91. The installed `jsonwebtoken`
package is version `9.0.3` (`node_modules/jsonwebtoken/package.json`,
matching the `^9.0.2` pin in `package.json:86`). Its algorithm-mismatch
check, `node_modules/jsonwebtoken/verify.js:144-146`:

```
   144	    if (options.algorithms.indexOf(decodedToken.header.alg) === -1) {
   145	      return done(new JsonWebTokenError('invalid algorithm'));
   146	    }
```

An RS256-signed token carries `"alg":"RS256"` in its header. `'RS256'` is
not present in `['HS256']`, so this check fails and `jwt.verify` calls back
with a `JsonWebTokenError('invalid algorithm')` before any signature bytes
are checked.

**The remap.** `tokenService.js`'s `catch` block, lines 118–127:

```
   118	    } catch (error) {
   119	      if (error.name === 'TokenExpiredError') {
   120	        throw new Error('Token has expired');
   121	      } else if (error.name === 'JsonWebTokenError') {
   122	        throw new Error('Invalid token signature');
   123	      } else if (error.message.includes('revoked')) {
   124	        throw error; // Re-throw revoked token error as-is
   125	      }
   126	      throw new Error(`Token verification failed: ${error.message}`);
   127	    }
```

The `JsonWebTokenError('invalid algorithm')` thrown by the library has
`error.name === 'JsonWebTokenError'`, so line 122 fires: a new, generic
`Error` is thrown with the message `'Invalid token signature'`. The original
`'invalid algorithm'` message and the library's error type are both
discarded at this point.

**The response.** `jwtAuth.js`'s `catch (jwtError)` block, lines 52–58:

```
    52	    } catch (jwtError) {
    53	      // JWT verification failed
    54	      return res.status(401).json({
    55	        error: 'Unauthorized',
    56	        message: jwtError.message,
    57	        code: 'AUTH_INVALID_TOKEN',
    58	      });
    59	    }
```

`jwtError.message` is `'Invalid token signature'` (from the remap above).

**Observable outcome, as code, today:** a request presenting a
well-formed RS256 token to any route in §3's table receives
**HTTP 401**, body `{"error":"Unauthorized","message":"Invalid token
signature","code":"AUTH_INVALID_TOKEN"}`. The status and code are identical
to what a request with a tampered or wrong-secret HS256 token would also
receive — a caller cannot distinguish "wrong algorithm" from "bad signature"
from this response alone, because the algorithm-mismatch case is remapped to
the same signature-error message at `tokenService.js:122`.

---

## 5. History: was the Cognito claim ever accompanied by a verifier call?

```
$ git log --oneline -- src/middleware/jwtAuth.js
c9a065b60 fix: add format:check script and format all files with prettier
9329b2b5e ✅ PHASE 5 COMPLETE: Fix navigation menu, login redirect, and soft-delete filtering

$ git log -S "Cognito" --oneline -- src/middleware/jwtAuth.js
9329b2b5e ✅ PHASE 5 COMPLETE: Fix navigation menu, login redirect, and soft-delete filtering
```

**Measured, not inferred: the file has exactly two commits touching it, and
both instruments agree on the same single commit, `9329b2b5e`, as the one
that introduced the string `"Cognito"`.** `git log --diff-filter=A --oneline
-- src/middleware/jwtAuth.js` returns the same commit, `9329b2b5e`,
confirming it is also the file's addition commit in this repository's
history (this clone was unshallowed for this session's `/wake-up`; no
truncated history bounds this result).

`git show 9329b2b5e:src/middleware/jwtAuth.js`, checked directly: at this
commit the file already carries all three Cognito mentions found in §1
(lines 3, 10, 11 in the current file), and a case-insensitive search of
that commit's full file body for `cognito|jwks|verifier` matches only those
three comment lines — no call, import, or reference to any Cognito-specific
verification mechanism exists in the file at its addition commit.

The second and only other commit, `c9a065b60`, changes a single line in
this file (`git diff 9329b2b5e c9a065b60 -- src/middleware/jwtAuth.js`): an
arrow-function parenthesization change inside `requireGroup`
(`g => groups.includes(g)` to `(g) => groups.includes(g)`), attributed in
that commit's message to a Prettier formatting pass. It touches neither the
header comments nor `authenticateJWT`/`optionalJWTAuth`'s bodies.

**Finding, stated as measured:** the Cognito claim was present at the file's
own creation commit with no accompanying Cognito verifier call anywhere in
that commit's version of the file, and no subsequent commit added one. The
claim was aspirational from the first commit onward. This re-derivation's
own instruments (both `git log` forms and a direct read of the addition
commit) independently reach this result; where #1443's account describes
the same expectation, this agrees with it.

---

## 6. `POST /login`'s current status, and whether a token can be obtained today

```
$ grep -n "login" src/routes/auth.js
3: * Handles login, token refresh, and token validation
19:const loginLimiter = rateLimit({
21:  max: 5, // 5 login attempts per 15 minutes
22:  message: 'Too many login attempts, please try again later',
38: * POST /api/v1/auth/login
42:router.post('/login', optionalAuth, loginLimiter, validateLoginRequest, async (req, res) => {
50:  // decision about whether password login should exist at all, given Cognito
54:    message: 'Password login is disabled.',
```

`src/routes/auth.js:42-59`, quoted:

```
    42	router.post('/login', optionalAuth, loginLimiter, validateLoginRequest, async (req, res) => {
    43	  // FD-65 ISSUANCE HALF, closed 2026-08-22. This route issued a signed token
    44	  // to any caller supplying a well-formed email and any 6-character password;
    45	  // no credential was ever verified. v2.49 minted FD-65 with two halves and
    46	  // v2.50 closed only the privilege half (75ac05f0, caller-supplied
    47	  // groups/role removed), explicitly leaving this one open at P0.
    48	  //
    49	  // Disabled rather than repaired: implementing real verification is a
    50	  // decision about whether password login should exist at all, given Cognito
    51	  // is the actual authentication path. Fails closed until that is ruled.
    52	  return res.status(401).json({
    53	    error: 'Unauthorized',
    54	    message: 'Password login is disabled.',
    55	    code: 'AUTH_LOGIN_DISABLED',
    56	  });
    57	  try {
    58	    const { email, password } = req.body;
    59	  } ...
```

**`POST /api/v1/auth/login` returns HTTP 401 unconditionally**, before any
of the code below the early `return` (lines 57 onward) executes. Measured:
the handler issues no token under any input at this basis.

**Frontend, direct-Cognito-path search:**

```
$ grep -rn "amplify\|Amplify\|CognitoUser\|cognito\|idToken\|accessToken" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' frontend/src/
frontend/src/components/Culture/AwardsMediaTab.jsx:3: * The power structures that cover and amplify cultural events
frontend/src/services/api.js:60:  const newToken = res.data?.data?.accessToken;
frontend/src/services/api.js:61:  if (!newToken) throw new Error('No accessToken in refresh response');
frontend/src/services/api.test.js:109:        data: { data: { accessToken: 'new-token' } },
frontend/src/services/authService.js:11:   * Returns: { accessToken, refreshToken, user }
frontend/src/services/authService.js:26:      if (response.data.data?.accessToken) {
frontend/src/services/authService.js:27:        const { accessToken, refreshToken, user } = response.data.data;
frontend/src/services/authService.js:31:        localStorage.setItem('authToken', accessToken);
frontend/src/services/authService.js:37:          accessToken,
frontend/src/services/authService.js:132:      if (response.data.data?.accessToken) {
frontend/src/services/authService.js:133:        const { accessToken } = response.data.data;
frontend/src/services/authService.js:134:        localStorage.setItem('authToken', accessToken);
frontend/src/services/authService.js:135:        return accessToken;
frontend/src/data/dreamCities.js:83:  { layer: 'Media networks', icon: '📡', color: '#c9a84c', whatItDoes: 'Amplify moments, create narrative, control memory', feedsInto: 'Algorithms — what gets covered gets boosted' },
frontend/src/pages/SocialPersonality.jsx:45:  { type: 'Supportive', triggers: "Other creator's success, community moments, good news", feedLook: 'Encouragement, congratulations, amplifying others — generous presence', traits: 'High community orientation + low drama sensitivity + high authenticity', shift: 'When the Supportive character stops celebrating someone she used to celebrate, the audience clocks it immediately.' },
frontend/src/pages/WorldInfrastructure.jsx:140:  { layer: 'Media networks',  icon: '📡', color: '#c9a84c', whatItDoes: 'Amplify moments, create narrative, control memory',                 feedsInto: 'Algorithms — what gets covered gets boosted' },
```

```
$ grep -n "cognito\|amplify" frontend/package.json
(no output — zero matches)
```

**No `cognito`, `Amplify`, or `CognitoUser` match anywhere in `frontend/src`
or `frontend/package.json`.** Every `accessToken`/`idToken`-shaped match is
either an unrelated word ("amplify" inside prose copy) or part of
`frontend/src/services/authService.js`'s and `api.js`'s handling of a token
issued by `POST /api/v1/auth/login` — confirmed by reading
`authService.js:14-20`, whose `login()` method posts to
`'/api/v1/auth/login'` and reads `response.data.data.accessToken` from that
same endpoint's response shape.

**Measured: `POST /login` is the only issuance path this repository's
frontend calls, and it is unconditionally disabled** (§6, above). No direct
Cognito path (hosted-UI redirect, `Amplify.Auth`, or a Cognito SDK call)
appears in `frontend/src` or `frontend/package.json` at this basis. Per
issue #1443's own instruction on this point, a grep miss alone does not
establish absence of a hosted-UI redirect that might live only in
environment/config rather than code — this task does not search outside
`frontend/src` and `frontend/package.json` for such a redirect and does not
claim a stronger result than the two greps pasted above support.

---

## 7. Findings, stated as measured facts

**(a) Claim origin — measured, §5.** The Cognito claim in `jwtAuth.js`'s
header and function comments (lines 3, 10, 11) was present at the file's
addition commit (`9329b2b5e`) with no Cognito verifier call anywhere in that
commit's body, and the file's only other commit (`c9a065b60`) is an
unrelated formatting change. Not a cannot-tell: both `git log` instruments
and a direct read of the addition commit agree.

**(b) What is reachable today — measured, §3–4, §6.** Nine
`authenticateJWT`-gated route registrations exist at this basis (§3's
table); of the two identical `PUT /api/v1/compositions/:id` registrations
(lines 476, 813, on the single router mounted once at
`/api/v1/compositions`), line 476's handler is the one that runs for every
matching request and line 813's handler is unreachable dead code (§3).
`TokenService.verifyToken` accepts only HS256 signatures (§2); an
RS256-signed token presented to any of the reachable registrations
receives HTTP 401 with code `AUTH_INVALID_TOKEN` and message `"Invalid
token signature"` (§4). `POST /api/v1/auth/login` — the only
token-issuance path this repository's frontend calls — returns HTTP 401
unconditionally (§6); no direct Cognito path was found in `frontend/src` or
`frontend/package.json` (§6). This document makes no statement about what
must happen before what, and states no ordering or disposition; the above
is the state of the code at this basis.

**(c) Error-code finding — measured, §4.** The distinct
`JsonWebTokenError('invalid algorithm')` the `jsonwebtoken` library raises
for an algorithm mismatch (`node_modules/jsonwebtoken/verify.js:144-146`)
is caught by `tokenService.js:121-122`'s `error.name === 'JsonWebTokenError'`
branch and rethrown as a generic `Error('Invalid token signature')` —
the same message and error shape a wrong-secret or tampered HS256 token
would also produce from that same branch. The two failure modes are not
distinguishable from the HTTP response alone.

**(d) Dead-code findings — measured, §3.** Two, both `authenticateJWT`-gated:
`optionalJWTAuth` is exported from `src/middleware/jwtAuth.js` (line 173)
and has zero call sites in any route file under `src/`, confirmed by the
same grep that enumerated §3's table. Separately, `compositions.js:813`'s
`PUT /:id` handler is registered on the same router as `compositions.js:476`'s
`PUT /:id` handler, mounted once at `/api/v1/compositions` (§3); Express
matches the first-registered handler for every request, so line 813's
handler is present in the file and gated by `authenticateJWT`, but
unreachable by any request.

**(e) Relation to issue #1443.** #1443 asked for this exact set of reads
(its own steps 1–7 map to this document's §1, §2, §3, §4, §5, §6 in the
same order). #1443's report ran and was returned in its own session but was
never recorded as a comment on the issue (§0), so this document does not
have that report's text to diff line-by-line against. Where #1444's own
body states what #1443 found — a nine-route count, and the
`compositions.js` duplicate `PUT /:id` left out of #1443's scope — this
re-derivation agrees on the count and settles the duplicate's disposition
that #1443 had left open (§3): one handler live, one dead, not merely
"present." No drift from #1443 is identified on any point this
re-derivation can check.

**(f) What this document does.** This document rules nothing, mints no
FD/XK/PE number, changes no gate, and closes nothing — including FD-65's
open issuance half, F-AUTH-1's standing, or any question about what
sequencing is correct for Cognito adoption. It records what is true of
`jwtAuth.js`, `tokenService.js`, `src/routes/auth.js`, and the frontend at
this task's own basis, with commands and raw output pasted per H1.

---

*Type: new filing, F-AUTH-1-adjacent. Re-derives issue #1443's read list
from source at basis `e940c906bb7bc60dab0b91ea86dc1e6f0f02fa8c`. No host,
AWS, database, or Cognito contact. No code change. Rules nothing, mints
nothing, closes nothing.*
