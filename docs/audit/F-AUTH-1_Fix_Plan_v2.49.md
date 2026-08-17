| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *P0 mint — the authentication surface issues credentials to anonymous callers.* |
| --- |

**Document version**

v2.49 — **MINTS FD-65 (F-AUTH-1). P0. SHIPS NO CODE.** FD tail advances **FD-64 → FD-65**. **The authentication surface issues signed tokens to unauthenticated callers at two endpoints, and permits those callers to specify their own privileges.** `POST /api/v1/auth/login` performs no credential verification of any kind and reads `groups` and `role` from the request body; `POST /api/v1/auth/test-token` does the same with no rate limiter and no validation middleware. Tokens so obtained satisfy `requireAuth` on **all 95 handlers promoted at `8ba2b95c`** and clear **all 36 `authorize([...])` gates across 11 route files**, including the three on `auditLogs.js`. **Fixing the privilege half without the issuance half looks like a fix and is not.** Derived from git against `origin/main` at `ffe91c3d`. No live database contact, and no request issued to any deployed host.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. **FD-65 (F-AUTH-1)** opens here, **P0**, unremediated. **FD-63** and **FD-64** remain open and are not addressed. Track G3 — OPEN, half supplied, and the reason recorded at v2.48 §5.1 is **superseded at §6 below**. Track G4 — not entered. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# §1. What this mints

**FD-65 (F-AUTH-1) — P0. The authentication surface issues signed tokens to unauthenticated callers, and lets those callers specify their own privileges.**

**Statement.** `src/routes/auth.js` exposes two endpoints that mint signed HS256 tokens without verifying any credential. Both read `groups` and `role` from the request body and place them in the token. A token so obtained is indistinguishable, to every downstream consumer, from one issued after authentication.

**The finding has two halves and they require separate remedies.**

- **Issuance.** Neither endpoint verifies a credential. There is no database lookup, no password comparison, no Cognito call. `POST /login`'s own comment at `:54` states the design: *"For development: accept any password (in production, verify against Cognito)."* The integration is absent.
- **Privilege.** Both endpoints read `groups` and `role` from the caller and sign them into the token unmodified.

**Removing `groups` and `role` from the destructuring remedies only the second half.** An anonymous caller would still receive a valid `['USER','EDITOR']` token, which still satisfies `requireAuth` on all 95 promoted handlers. **The admin tier would be restored and the authenticated tier would remain open. That is the failure mode this finding is written to prevent**, and any remediation proposing only the privilege fix must be rejected against this paragraph.

---

# §2. The evidence

## §2.1 `POST /api/v1/auth/login`

Declared at `src/routes/auth.js:41` with `loginLimiter` and `validateLoginRequest`. **No environment guard.** `src/app.js:424-425` mounts `/api/v1/auth` unconditionally. **This endpoint is reachable in production.**

```js
const { email, password, groups, role } = req.body;          // :43
// ...
// For development: accept any password (in production, verify against Cognito)
if (!password || password.length < 6) { /* 400 */ }          // :54-55
// ...
groups: groups || (role === 'admin' ? ['ADMIN','EDITOR'] : ['USER','EDITOR']),   // :68
const tokens = TokenService.generateTokenPair(user);          // :72
```

**`validateLoginRequest` does not constrain the privilege inputs.** Per `src/middleware/requestValidation.js`, it validates email format against a regex, email length ≤ 254, and password length 6–512. It never inspects `groups` or `role`.

**The rate limiter is the only control.** `loginLimiter` at `:18-25` permits 5 requests per 15 minutes — against an attack requiring one. Its `skip` predicate returns true when `NODE_ENV` is `development` or `test`, so it is **absent in those environments** (§2.3).

## §2.2 `POST /api/v1/auth/test-token`

Declared at `:150` with **no rate limiter and no validation middleware of any kind.** Its only control is an environment check:

```js
if (process.env.NODE_ENV === 'production') { /* 403 AUTH_TEST_NOT_ALLOWED */ }   // :153
const { email, groups, role } = req.body;                                        // :161
const testToken = TokenService.generateTestToken({
  email: email || 'test@episode-metadata.dev',
  groups: groups || ['USER','EDITOR'],
  role: role || 'USER',
});                                                                              // :163-167
```

Its own header comment at `:148` reads **"Remove or secure this in production!"** The guard satisfies that instruction for production only, and leaves the endpoint unthrottled everywhere else.

## §2.3 Environment posture — bounded and unmeasured

**FD-65's statement does not depend on this section. §2.1 establishes the finding under either posture.** What follows bears only on severity — whether `/test-token` is additionally reachable, and whether the rate limit on `/login` is present. A reader who finds the inference below unpersuasive should not thereby doubt §2.1.

**This section states a config-derived inference. It is not a measurement of any running host, and must not be read as one.**

`ecosystem.config.js` sets `NODE_ENV: 'production'` explicitly at `:87`, `:96` and `:124`. `ecosystem.dev.config.js` sets `NODE_ENV: process.env.NODE_ENV || 'development'` at `:13` and **contains no `production` literal anywhere in the file.**

**If** a deployed non-production host runs with `NODE_ENV` unset or set to `development`, then on that host `/test-token`'s guard does not fire **and** `loginLimiter`'s skip predicate returns true — **both endpoints open, neither throttled.** Under `NODE_ENV=production`, `/test-token` returns 403 and `/login` is limited to 5 per 15 minutes.

**What is established:** the two postures and the config that selects between them.
**What is not established:** the runtime `NODE_ENV` of any deployed host. That value is supplied at deploy time and is not in the repository. **No request was issued to any deployed host to determine it, and none should be issued to prod, which is FROZEN.**

**The difference between the two postures is material** — one endpoint behind a rate limit versus two endpoints unthrottled — **and no summary of this document may flatten it into a live-fact claim in either direction.** This is XK-3's *bounded and unmeasured* posture and is adopted deliberately.

## §2.4 What the token reaches

**`requireAuth` accepts it.** `src/middleware/auth.js:509` calls `verifyToken` at `:190`, which reads the `alg` header and routes HS256 to `verifyViaHs256` at `:181` → `tokenService.verifyToken` → `jwt.verify(token, process.env.JWT_SECRET)`. This routing is environment-independent; the `NODE_ENV === 'test'` branch at `:197` is only the unparseable-`alg` fallback. **All 95 handlers promoted at `8ba2b95c` are reached.**

**`authorize` accepts it.** `src/middleware/auth.js:514` assigns `groups: decoded['cognito:groups'] || decoded.groups || []` — **from the token payload.** `authorize` at `:433` tests `req.user.groups.some(...)` against the required list. **36 call sites across 11 route files**, every one importing from `../middleware/auth`:

| File | Gates | | File | Gates |
|---|---:|---|---|---:|
| `cfoAgentRoutes.js` | 9 | | `siteOrganizerRoutes.js` | 3 |
| `templates.js` | 5 | | `designAgentRoutes.js` | 3 |
| `wardrobeApproval.js` | 4 | | `assets.js` | 2 |
| **`auditLogs.js`** | **3** | | `admin.js` | 2 |
| `seed.js` | 3 | | `uiOverlayRoutes.js` | 1 |
| | | | `evaluation.js` | 1 |

`src/middleware/rbac.js:83` defines a second, independent `authorize`. **No file in this population imports it**, and it would not help: its `getUserRole` reads `user.groups` also.

**`auditLogs.js` is named separately because of what it is.** Three of the 36 gates front the audit trail — **the control that would evidence an intrusion is gated by the credential the intrusion supplies.**

The 34/2 split between `authorize(['ADMIN'])` and `authorize(['admin'])` is **v2.37 §60.6's case-sensitive casing split**, which now has a home. Cited, not re-minted.

---

# §3. What FD-65 does to the CP's meaning

**v2.47 §1 records 95 handlers promoted from the global `optionalAuth` fallback to `requireAuth`, and §8 establishes that as the CP's substance. Against an unauthenticated attacker that promotion secures nothing, because the same application issues the credential on request.**

This does not make the CP wrong or wasted. Promotion is a precondition of any authorization model and the work stands. **What it makes wrong is the reading** — that the surface moved from open to closed on 2026-08-17. It moved from *open* to *open to anyone who first calls `/login`*.

**XK-3's `roles.js` tenancy exposure is secondary in the same way**, and so is FD-64's practical severity. Every finding this series has recorded about who may reach a handler is conditioned on a credential that is presently free.

**No revision before this one states that**, and a reader of v2.47 §8 alone would carry the opposite impression.

---

# §4. The instrument discipline

**Three instruments in this series returned correct results that were then recorded as coverage. In each case the instrument's output was true, and in each case it answered a question that had not been asked.**

| Instrument | What it truly reported | What it was read as |
|---|---|---|
| §21's G1 grep (FD-63) | no match for a literal `router.` pattern | the auth surface is clean |
| v2.45 §3.1 enumeration (FD-64 §4) | eight `show_id` derivation sites | `roles.js` has eight handlers |
| v2.46's Tier 3 exclusion (FD-65) | `auth.js` is correctly unauthenticated | `auth.js` is safe to exclude |

**None of these was an error of execution.** G1's zero was accurate for the pattern it contained. Eight derivation sites is the correct count of derivation sites. `auth.js` *is* correctly unauthenticated — a login endpoint must be reachable without a credential. **Each was true of the property measured and silent on the property at issue**, and the gap between those two was closed by a reader rather than by the instrument.

**Stated as a discipline, for successors:**

> **An instrument's correct output is not an answer to a question it was not asked.** Record what was measured, in the instrument's own terms. Then state separately, and as a claim requiring its own support, whether the property measured is the property in question. A count is not a population. An absence of matches is not an absence. A route being correctly unauthenticated is a fact about its reachability and none about its output.

**This is the most transferable result of the work recorded in v2.48 and v2.49**, and it is stated here once rather than three times in passing.

---

# §5. The credential-custody finding — XK-shaped, not admitted

A second, distinct finding was established during this work and is **recorded but not minted**:

- **`requireAuth` accepts a second credential type under separate custody.** HS256 tokens signed with `JWT_SECRET` verify through `tokenService`, in all environments (§2.4). F-AUTH-1's documents describe the surface as Cognito's.
- **`groups` is trusted from the token payload** (`auth.js:514`), so the same key clears all 36 authorization gates.
- **A 64-hex `JWT_SECRET` is committed to a public repository** at `docs/PHASE_3_TASK_1_COMPLETION.md:16`, alongside `TOKEN_ISSUER=episode-metadata-api-dev`. Issuer and audience are not a second factor: `tokenService.js:53-54` and `:96-97` default both to literals present in source.
- The working-tree `.env` does not carry the committed value. **What any deployed host holds is not in the repository and was not probed.**

**The strongest element of this finding is not the exposure. It is that a control ran against it and failed.**

The file landed at `9fd1a6ce` (2026-02-14), in the same commit as `GITHUB_REPOSITORY_AUDIT.md` — which rates credential exposure 🔴 CRITICAL and whose rotation item is still marked ⚠️ open. Three months later, `3ac07d36` (#665, 2026-05-11), titled *"redact plaintext credentials from documentation"*, touched **thirteen files including that audit itself** and **did not touch the file holding the key.**

**That is the difference between "nobody looked" and "someone looked and the control failed."** The second is worse in a specific way: a purpose-built redaction pass creates a reasonable belief that documentation is clean, and that belief is now three months old and wrong. Any successor evaluating this finding should treat #665's coverage as unverified rather than as prior assurance.

**Why it is not minted here.** XK admission requires a ratifying revision, and **this revision is minting a P0**. Sharing that billing would slow the item that must move fastest and would attach XK's admission machinery — gates, population question, cross-keystone sign-off — to a document whose purpose is FD-65.

**Why XK and not FD, when it is minted.** Its remedy spans three surfaces — rotation (deploy), routing (should HS256 reach `requireAuth` at all), and design (`groups` from payload). **No single keystone contains all three.** That is the structural argument XK-3 makes for itself.

**FD-65 does not resolve it.** Remediating both endpoints at §2.1 and §2.2 leaves the committed secret signing valid tokens and leaves `groups` trusted from the payload. **The two findings are independent and neither closes the other.**

---

# §6. Correction to v2.48 §5.1, and to what inherited it

**Subordinate to §1–§5. Recorded here because it is owed, not because it is comparable in weight.**

**v2.48 §5.1 states that Gate G3's authenticated half "requires a mocked Cognito verifier this suite does not have," and that `auth.integration.test.js` cannot supply it because TokenService "is the `jwtAuth.js` path per D20 and does not authenticate `requireAuth` routes." That is wrong.**

`middleware/auth.js:2` imports `verifyToken` from `tokenService` as `verifyHs256Token`, and `verifyToken:190` routes HS256 tokens to it. **A TokenService-minted token authenticates a `requireAuth` route.** Verified by probe: an HS256 token presented to `POST /api/v1/decisions` returned **400 with a handler-level validation error**, not 401 — the request passed `requireAuth` and reached the handler.

**Consequence for Gate G3.** The authenticated half needs no Cognito mock and no new infrastructure. It is a token per sub-form and an assertion that `req.user` is populated. **G3's blocker as stated at v2.48 §5.1 does not exist.** G3 remains undischarged only because the tests are unwritten.

**A related mechanism, recorded so it is not re-derived:** `verifyToken` is module-local at `:190` and `requireAuth` calls it by closure at `:509`. `jest.mock` on the export cannot intercept that call, and mocking the module would replace `requireAuth` itself. Any future mocking must be placed at a require boundary — `aws-jwt-verify` or `../services/tokenService`.

**What inherited the error.** The false claim appears in the header comment of `tests/integration/f-auth-1-fd63.test.js`, in **v2.48 §5.1**, in **PR #1041's body**, and in the commit message of **`f032a1d9`**. The test comment is correctable in code. **The commit message is not, and will carry the false claim in history permanently.** It is named here rather than left implicit; this section is its supersession.

---

# §7. Recorded, not addressed

- **`TokenService.generateTestToken`** (`tokenService.js:184`) is the third element of FD-65's fix surface. It defaults `groups` to `['USER','EDITOR']` and accepts overrides.
- **`/login` sets a 30-day `refreshToken` cookie** (`auth.js:75-81`) on a request that verified nothing.
- **The `role === 'admin'` branch at `auth.js:68`** grants `['ADMIN','EDITOR']` on a lowercase literal, while 34 of 36 gates demand uppercase `ADMIN`. Two spellings, three conventions, one surface.
- **Rotation is a write, and a prod-touching one.** `JWT_SECRET` rotation invalidates every live HS256 token and may break F-Auth-4's refresh contract. Per v2.42 §3.4's *doubt at the gate*, establishing what each environment holds precedes any rotation decision. **Owner: unassigned, and deliberately so.** The rotation decision belongs to the ratifying revision that admits the §5 finding; until that revision exists there is no gate to hold it and no owner to carry it, and this document does not create either. The environment read that must precede it is an infrastructure action on live hosts, reserved to JAWIHP / Evoni and not delegated here.
- **FD-63, FD-64 and XK-3 are unaddressed here** and none is closed, amended, or reprioritised by this revision.

---

# §8. Numeral disambiguation

- **FD-65 (F-AUTH-1)** is minted here, **P0**. **FD-64** (v2.48) and **FD-63** (v2.43) are open and unrelated in subject. FD tail: **FD-65**.
- **XK tail remains XK-3.** §5 mints no XK. The credential-custody finding is *recorded as XK-shaped and not admitted*; those are different states and §5 says which applies.
- **The two halves at §1** — issuance and privilege — are FD-65's internal partition. They are **not** miss shapes, edit shapes, or Tier levels, and do not correspond to v2.44 §2 or v2.47 §1.
- **Gate G3** at §6 is F-AUTH-1's v1.5 six-gate sequence. **Track G3** at Status is the deployment track.
- **P0** is the register's severity class, not a Tier.
- **v2.37 §60.6** is the casing split, cited at §2.4 and not re-minted.

---

# §9. What this revision establishes

- **FD-65 (F-AUTH-1) is minted, P0**: two endpoints issue signed tokens to unauthenticated callers and accept caller-specified `groups` and `role` (§1, §2.1, §2.2).
- **`/login` has no environment guard and is reachable in production**; the rate limiter is its only control, at 5 per 15 minutes against a one-request attack (§2.1).
- **`/test-token` has no rate limiter and no validation middleware**; its only control is `NODE_ENV === 'production'` (§2.2).
- **Two environment postures exist and the config selects between them. Which posture any deployed host is in is unmeasured and was not probed** (§2.3).
- **Such a token reaches all 95 promoted handlers and all 36 authorization gates across 11 files, including three on `auditLogs.js`** (§2.4).
- **Fixing privilege without issuance restores the admin tier and leaves the authenticated tier open** (§1).
- **The CP's remediation secures nothing against an unauthenticated attacker; the work stands, the reading of it does not** (§3).
- **Three instruments returned true results that were recorded as coverage. The discipline is stated at §4.**
- **The credential-custody finding is XK-shaped, recorded, not admitted, and is not resolved by FD-65** (§5).
- **v2.48 §5.1's Cognito-mock claim is false; Gate G3's authenticated half has no infrastructure blocker** (§6).

---

# §10. What this revision does not do

- **Ships no code.** Does not remediate FD-65, edit `src/routes/auth.js`, `src/services/tokenService.js`, or any middleware.
- **Issues no request to any deployed host.** The §6 probe ran locally against `src/app.js` under Jest. §2.3's posture is derived from config files, not from a live host.
- Does not close, amend, or reprioritise **FD-63**, **FD-64**, or **XK-3**.
- Does not mint an XK or a PE. **XK tail remains XK-3.** §5 is a recording, not an admission.
- Does not rotate, propose rotating, or authorise rotating any credential (§7).
- Does not supply Gate G3's authenticated half. **Track G4 is not entered. Track G5 remains BLOCKED.**
- Does not edit any prior revision's body. §3 and §6 correct **forward**; v2.47 §8 and v2.48 §5.1 stand as written and are superseded here.
- Does not amend `tests/integration/f-auth-1-fd63.test.js`, PR #1041, or the commit message at `f032a1d9`, whose inherited false claim is named at §6.
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact.** Derived from git against `origin/main` at `ffe91c3d`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-17. Main at `ffe91c3d`. Predecessor: v2.48.*
*Type: P0 mint. Ships no code. Mints FD-65 (F-AUTH-1) — the authentication surface issues signed tokens to unauthenticated callers at two endpoints and permits caller-specified privileges. Records the CP-meaning correction, the instrument discipline, the credential-custody finding as XK-shaped and not admitted, and supersedes v2.48 §5.1. Mints no XK, no PE. Tail: FD-65. XK tail: XK-3. Changes no gate. No live database contact. [skip-automerge]*
