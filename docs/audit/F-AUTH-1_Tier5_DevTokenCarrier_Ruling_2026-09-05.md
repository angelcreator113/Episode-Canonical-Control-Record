| **PRIME STUDIOS** **F-AUTH-1 — TIER 5 DEV-ONLY TOKEN CARRIER RULING (SHAPE A)** *Rules that a dev-server-only frontend route may carry an externally-minted token into `localStorage`. Mints nothing. Does not reopen FD-65. Does not authorize Shape C.* |
| --- |

**Document version**

v1.0 — **RULES SHAPE A.** A dev-server-only route in the frontend, whose
sole function is writing an externally-minted token into `localStorage`,
is permitted under the conditions stated in the ruling below. It is a
carrier, not a source: it mints nothing and calls no backend endpoint.
**Mints nothing. Does not reopen FD-65. Does not authorize a backend
dev-only token endpoint (Shape C), which remains unruled.**

**Basis:** `origin/main` at `c3735bd0c9be02f5d87b12ea7a254dce38e2aa78`,
2026-09-05. All reads local git against that commit; no host, AWS,
database, or Cognito contact.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Ruling. Rules one matter, on Evoni's word.** A dev-only frontend route
carrying an out-of-band-minted token into `localStorage` is permitted,
under the eight conditions stated at §3. No FD, XK, or PE number is
minted. Prod **FROZEN**.

---

# §1. What is being ruled, and against which prior thread

`issue #1254` (*"locate and report the Tier 5 dev token endpoint
proposal"*) first surfaced the question this ruling answers: it was a
read-only report, established that the register never actually pairs the
literal term "Tier 5" with an auth/token endpoint (that label is exclusive
to `seed.js`'s env-gated mount classification), found the closest existing
candidate (`POST /api/v1/auth/test-token`) already deleted per FD-65's
remedy, and closed by naming eight discrete choices a ruling would have to
decide — none of them ruled at the time.

**`issue #1256` used "Tier 5" in an unrelated sense.** That issue's own
report (the PE #65 execution sequence, Cognito Branch B) never uses the
term "Tier 5" itself; its subject is a *backend* Cognito pool cutover, not
a frontend token carrier. The two threads are independent — this ruling
answers `#1254`'s question, not anything from `#1256`.

**This ruling resolves the question as Shape A: a frontend-only carrier.**
It does not evaluate or foreclose Shape C (a backend dev-only token
*issuance* endpoint) — `#1254`'s own report named that as a separate,
undecided disposition, and it remains so.

---

# §2. Evidence this ruling's clauses rest on, re-verified fresh at this basis

**Cited, not restated as this document's own findings.**

```
$ git show origin/main:src/services/tokenService.js | grep -n "JWT_EXPIRY\|JWT_REFRESH_EXPIRY"
32:      type === 'refresh' ? process.env.JWT_REFRESH_EXPIRY || '7d' : process.env.JWT_EXPIRY || '1h';
```

Confirms clause 7: the expiry is read from `process.env` inside
`generateToken`, at call time — every mint reads whatever is in the
environment of the process that runs it, not a compiled-in default. A
laptop-local `JWT_EXPIRY` genuinely changes nothing shared.

```
$ git show origin/main:src/app.js | grep -n "frontendDistPath\|express.static" | head -3
1593:const frontendDistPath = path.join(__dirname, '../frontend/dist');
1602:if (fs.existsSync(frontendDistPath) && fs.existsSync(indexHtmlPath)) {

$ git show origin/main:src/app.js | sed -n '1654,1655p'
    express.static(frontendDistPath, {
```

Confirms clause 5: the backend serves `frontend/dist` directly
(`express.static(frontendDistPath, ...)` at `:1655`), so anything Vite
copies into `dist` at build time — everything under `frontend/public/`
included — is reachable through the backend's own port, not only through
the Vite dev server.

```
$ git show origin/main:src/routes/auth.js | sed -n '42,56p'
router.post('/login', optionalAuth, loginLimiter, validateLoginRequest, async (req, res) => {
  // FD-65 ISSUANCE HALF, closed 2026-08-22. ...
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Password login is disabled.',
    code: 'AUTH_LOGIN_DISABLED',
  });
  try {
```

Confirms clause 3: `/login` still returns `401 AUTH_LOGIN_DISABLED`
unconditionally — the return fires before any environment check, in every
environment — unchanged since `F-AUTH-1_Fix_Plan_v2.67.md` closed FD-65's
issuance half as CLOSED-BY-REMOVAL.

**All three checked at this basis and unchanged from what the ruling
assumed.** Nothing here required stopping to report a drift.

---

# §3. The ruling

**Approved by Evoni, transcribed verbatim. No word altered.**

> **RULING — Tier 5 dev-only token carrier (Shape A)**
>
> 1. A dev-server-only route is permitted in the frontend for the sole
>    purpose of writing an externally-minted token into localStorage.
>
> 2. It is a CARRIER, not a SOURCE. It mints nothing, calls no backend
>    endpoint, and creates no new way to obtain a token. The token is
>    minted out of band on the laptop via tokenService and carried in.
>
> 3. Therefore it does not touch FD-65. POST /api/v1/auth/login continues
>    to return 401 AUTH_LOGIN_DISABLED unconditionally, on every
>    environment, unchanged. This ruling does not reopen FD-65 and does
>    not authorize a backend dev-only token endpoint (Shape C), which
>    remains unruled.
>
> 4. Gate: the route must not exist in a production build. The gate
>    mechanism is to be derived from vite.config.js and the router at
>    implementation time, not assumed. Whatever it is, it must be
>    fail-closed — if the gate cannot be evaluated, the route is absent.
>
> 5. Not in frontend/public/. That directory copies into dist
>    unconditionally, and dist is served by the backend on :3002.
>
> 6. Scope: local development and LAN access to a laptop dev server only.
>    Not to be deployed to the dev box or anywhere else. And the token
>    carried must be minted under a local-only JWT_SECRET.
>
> 7. Token lifetime. tokenService reads JWT_EXPIRY from env at mint time
>    (default 1h). A laptop-local JWT_EXPIRY is permitted and does not
>    change any shared configuration. It must not be set on any deployed
>    environment. A longer local expiry is the answer to the re-minting
>    problem; a backend token endpoint is not.
>
> 8. URL exposure. The token is carried in the URL fragment, so it does
>    not reach server logs or the proxy. It does reach browser history on
>    both devices and whatever channel is used to send the URL. On a LAN,
>    with a token minted under a local-only secret against a local
>    database, this is accepted. It is not accepted for any token minted
>    against a shared secret or any deployed environment.
>
> *Provenance: this ruling's wording was proposed by the drafting session
> and approved by Evoni, not composed by her. Approval is not authorship.
> Two clauses (7 and 8) and the closing sentence of clause 6 were added in
> a second pass, after Evoni raised the token-lifetime and URL-exposure
> questions as genuinely open rather than let the first pass's silence on
> them stand. Disclosed per the same test `F-AUTH-1_Fix_Plan_v2.69.md`'s
> Ruling 2 note and correction banner apply.*

---

# §4. What this ruling does not do

- **Does not authorize Shape C** (a backend dev-only token *issuance*
  endpoint). `#1254`'s own report named it a separate, unselected
  candidate; this ruling leaves it exactly as unruled as it found it.
- **Does not reopen FD-65.** Clause 3 states this on its own face; `/login`
  remains `401 AUTH_LOGIN_DISABLED` unconditionally, confirmed at §2.
- **Does not derive the frontend build-mode gate mechanism.** Clause 4
  requires fail-closed and explicitly defers *how* — that derivation is
  the implementation task's first step, not performed here. If no clean
  fail-closed gate exists in this build setup, that is a finding the
  implementation task returns to Evoni, not one this ruling anticipates
  or forecloses.
- **Does not resolve whether `/refresh` extends the carrier's usable
  window.** Access tokens default to 1h, refresh tokens to 7d, but
  `/refresh` is HS256-only and expects a refresh token the carrier would
  also have to carry — and nothing in this session or its predecessors has
  traced whether the frontend's own interceptor actually exercises that
  path for a carried-in (rather than logged-in) session. Not assumed to
  rescue the 1h number. Owed to a separate read, not performed here.
- **Does not authorize, scaffold, or implement the Shape A route itself.**
  Ruling and implementation are different acts, same discipline this
  register applies elsewhere (`F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md`
  §4 states the identical principle for a different remedy).
- **Does not mint** an FD, XK, or PE number.
- **Does not edit** `F-AUTH-1_Fix_Plan_v2.67.md`, `src/routes/auth.js`,
  `src/services/tokenService.js`, or any other filed document or source
  file. All stay as they are.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-09-05. Basis `origin/main` at `c3735bd0c`. Rules Shape A;
authorizes no implementation. Mints nothing. No AWS call issued. No
deployed host contacted. No workflow dispatched. Prod FROZEN.*
