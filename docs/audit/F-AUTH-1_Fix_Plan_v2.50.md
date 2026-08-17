| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Remediation adjudication — authorizes a declared-partial fix against FD-65.* |
| --- |

**Document version**

v2.50 — **AUTHORIZES REMEDIATION. MINTS NOTHING. SHIPS NO CODE.** FD tail remains **FD-65 (F-AUTH-1)**; XK tail remains **XK-3**. Authorizes a **declared-partial** remediation of FD-65: deletion of the `POST /api/v1/auth/test-token` route, and removal of caller-supplied `groups` / `role` from `POST /api/v1/auth/login`. **The authorization is bounded at §1 and closes nothing.** Records that **Cognito token issuance has never existed in this codebase** (§2), which reduces all three `/login` remediation options to scheduled projects (§3). **Cites FD-65 (F-AUTH-1), minted at v2.49 and landed on main at `2359cbe6`** — see §9. Derived from git against `origin/main` at `2359cbe6`. No live database contact and no request issued to any deployed host.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. **FD-65 (F-AUTH-1)** remains **OPEN and P0** and is not closed, downgraded, or reprioritised by this revision. **FD-63** and **FD-64** remain open and are not addressed. Track G3 — OPEN, half supplied. Track G4 — not entered. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# §1. What this authorizes

**This section is the authorization. Anything not listed here is not authorized by this revision.**

| # | File | Change | Authorized |
|---:|---|---|:--:|
| 1 | `src/routes/auth.js` | Delete the `POST /test-token` route handler in full (`:145–182`, comment block through closing `});`) | **YES** |
| 2 | `src/routes/auth.js` | Remove `groups` and `role` from the `/login` destructuring at `:43`, and the `groups` / `role` assignments at `:68–69`. **The server-determined default is `groups: ['USER']` and `role: 'USER'`** — not `['USER','EDITOR']`; see the note below | **YES** |
| 3 | `src/services/tokenService.js` | `generateTestToken` — **retained unchanged** (see §5) | **NO — do not delete** |
| 4 | `src/routes/auth.js` | `/login`'s credential verification | **NO — not authorized, see §3** |
| 5 | `src/middleware/auth.js` | HS256 routing, `groups`-from-payload | **NO — XK-shaped, v2.49 §5** |
| 6 | Any environment | `JWT_SECRET` rotation | **NO — v2.49 §7, owner unassigned** |

**Note on change #2's default — `['USER']`, and it is not to be widened.** The implementer will observe that the client sends `['USER','EDITOR']` (`frontend/src/services/authService.js:19`) while this authorization specifies `['USER']`, and may read the narrower value as an oversight. **It is deliberate.** `EDITOR` grants nothing today: no `authorize(['EDITOR'])` exists in `src/routes/`, all 36 gates demand `ADMIN`, and `src/middleware/rbac.js`'s lowercase `'editor'` branch is unreachable because no route file imports that implementation. Issuing `EDITOR` to an anonymous caller therefore pre-clears **a gate that does not exist yet** — so the first `authorize(['EDITOR'])` anyone adds would ship already satisfied for every anonymous caller. That is FD-65's own shape planted for a future reader, inside the document remediating FD-65. **Least privilege applies: `['USER']`. Widening this default is not authorized by this revision.**

**The authorized scope, stated so that a closure revision claiming more is wrong on its face:**

> **This authorization restores the admin tier. It leaves the authenticated tier open and issuance unaddressed.** After both authorized changes ship, an anonymous caller still obtains a valid `['USER','EDITOR']` token from `POST /api/v1/auth/login` and that token still satisfies `requireAuth` on **all 95 handlers promoted at `8ba2b95c`**. **This authorization does not close FD-65, and no closure revision may cite it as having done so.**

**FD-65 remains OPEN and P0 after this remediation ships.** The prohibition above is placed in the authorizing revision rather than left to the closure revision, because that is where it binds.

---

# §2. Cognito token issuance has never existed here

**This is the finding that governs §3, and it corrects a framing under which one `/login` option looked like a fix and the others looked like tradeoffs.**

- **No issuance call sites.** `git grep -l "InitiateAuth\|AdminInitiateAuth\|CognitoIdentityProvider" -- src/` returns **nothing**.
- **No issuance dependency.** `package.json` carries `aws-jwt-verify ^5.1.1`, `aws-sdk ^2.1693.0`, and `@aws-sdk/client-s3` / `-sqs` / `-credential-providers` / `s3-request-presigner`. **`@aws-sdk/client-cognito-identity-provider` is absent.**
- **The configuration that exists serves the verifier.** `getCognitoConfig` at `src/middleware/auth.js:82` supplies a user-pool id and client id to `CognitoJwtVerifier`. Cognito **verifies** in this codebase. It has never **issued**.
- **No client-side path either.** `frontend/package.json` carries no Amplify and no Cognito SDK. One file under `frontend/src/` mentions Cognito at all (`pages/PressPublisher.jsx`).

**`/login`'s comment — *"in production, this would integrate with Cognito"* — describes work that was never started, not an integration that regressed.** Every prior reading of that comment in this series, including v2.49 §1's, treated it as a statement about a deferred wiring. It is a statement about an absent one.

---

# §3. The three issuance options, costed

**None is a patch. All three are projects requiring a dependency addition, and one is not what its description suggests.**

| Option | Blast radius | Prerequisite | Available today |
|---|---|---|:--:|
| **A.** Wire `/login` to Cognito server-side | Backend-internal. `frontend/src/services/authService.js` and `api.js`'s refresh interceptor untouched; F-Auth-4's contract preserved | `@aws-sdk/client-cognito-identity-provider` + an `InitiateAuth` flow that does not exist. **Forces a second decision on `/refresh`**, which is TokenService-based today | **No** |
| **B.** Remove `/login`; frontend authenticates to Cognito directly | Rewrites `authService.js` **and** `api.js`'s interceptor — i.e. the F-Auth-4 contract itself | A frontend Cognito SDK that is not installed, plus a full client auth flow | **No** |
| **C.** Gate `/login` to non-production | Production loses its only login path | None | **Mechanically yes** |

**Option C is not *"accept no login path until Cognito lands."* It is *"break the sole existing one,"*** because B's prerequisite does not exist and A's is unbuilt. `frontend/src/services/authService.js:16` is the only login call in the client, and there is no alternative behind it.

**No option is selected by this revision.** §3 exists so that the selection, when made, is made against costed alternatives rather than against the framing §2 corrects.

---

# §4. What the partial buys, and what it does not

**Buys — the admin tier.** Removing `groups` / `role` from `/login`'s inputs closes escalation to `['ADMIN']`, and with it **all 36 `authorize([...])` gates across 11 route files**, including the three fronting `auditLogs.js`. Per v2.49 §2.4 that is the control which would evidence an intrusion; it is restored.

**Buys — one of two anonymous minting endpoints.** `/test-token` ceases to exist.

**Does not buy — the authenticated tier.** `/login` still issues a valid token to an anonymous caller. The default branch yields `['USER','EDITOR']`, which satisfies `requireAuth` on all 95 promoted handlers. **v2.49 §3's statement stands unchanged after this remediation: against an unauthenticated attacker the CP's promotion still secures nothing.**

**Does not buy — anything in v2.49 §5.** The committed `JWT_SECRET` still signs valid tokens and `groups` is still trusted from the payload at `src/middleware/auth.js:514`.

**Backward compatibility, verified — with the evidence, because the claim depends on §1's `['USER']` default rather than on the change alone.**

`frontend/src/services/authService.js:16-21` sends `groups: ['USER','EDITOR'], role: 'USER'` in the login body today. After change #2 the server ignores both fields; the client keeps sending them harmlessly. **The issued token is narrower than today's** — `['USER']` rather than `['USER','EDITOR']` — and that narrowing is inert on both sides:

- **Server side.** No `authorize(['EDITOR'])` exists in `src/routes/`; all 36 gates demand `ADMIN` (34 uppercase, 2 lowercase). `src/middleware/rbac.js:58`'s lowercase `'editor'` check is unreachable from routes, since no route file imports `rbac.js`'s `authorize`. Dropping `EDITOR` from the token removes access to nothing.
- **Client side.** Nothing under `frontend/src/` reads `user.groups`. Every `groups` occurrence in the frontend is an unrelated local variable — chapter grouping, content-zone grouping, memory grouping — or a CSS comment. No component branches on group membership.

**No frontend change is required by change #2, and the F-Auth-4 contract is untouched.**

**v2.49 §1 rejects a remediation *proposing only* the privilege fix.** This revision does not propose it as the fix. It authorizes it as a declared partial, with §1's scope statement as the declaration. Those are different acts and §1 records which one this is.

---

# §5. Remediation instruction — the route and the method are separable

**`POST /api/v1/auth/test-token` has no caller. `TokenService.generateTestToken` does. Deleting both breaks a script.**

- Nothing under `frontend/src/` references the route.
- The `Bearer test-token` occurrences across `scripts/tests/*` are a **literal placeholder string**, not calls to the endpoint.
- `scripts/tests/test-task-1-auth.js:119` calls **`TokenService.generateTestToken()` directly as a service method**, never over HTTP. Line `:220` prints the endpoint's name in a console listing and invokes nothing.

**Authorized: delete the route (§1 #1). Not authorized: delete the method (§1 #3).**

**v2.49 §7 lists `generateTestToken` as part of FD-65's fix surface. That remains correct** — the method is where `/login`'s caller-supplied-privilege pattern is replicated, and any issuance remediation under §3 must revisit it. **It is not a deletion list, and this section exists because it can be read as one.**

---

# §6. Effect on v2.49 §2.3's environment posture

**The authorized remediation partly retires the inference recorded at v2.49 §2.3, and a reader taking the two documents together will otherwise over-weight it.**

v2.49 §2.3 records two environment postures turning on `NODE_ENV`: under `production`, `/test-token` returns 403 and `/login` is rate-limited; under `development` or unset, `/test-token`'s guard does not fire **and** `loginLimiter`'s skip predicate returns true.

**After change #1 ships, `/test-token` does not exist in any environment.** The `NODE_ENV === 'production'` guard at `auth.js:153` goes with it. **The remaining severity difference collapses to a single question — whether `loginLimiter` is active — on a single endpoint.**

**What does not change:** the live `NODE_ENV` of any deployed host remains unmeasured, and v2.49 §2.3's *bounded and unmeasured* posture continues to apply to what remains. **The inference narrows; it is not discharged.**

---

# §7. What the closure revision must do

The closure revision — the v2.47 slot in the v2.46 → code → v2.47 cycle this revision opens — is bound by the following and may not proceed without them:

1. **State that FD-65 remains open**, per §1. A closure revision reporting this remediation as closing FD-65 contradicts its authorization.
2. **Report the authenticated tier as still open**, in the terms of §4, and not in terms that permit "the auth surface is remediated."
3. **Record whether an issuance option under §3 was selected**, or that none was, and by whom.
4. **Verify the route/method split at §5 held** — that `generateTestToken` survives and `scripts/tests/test-task-1-auth.js` still runs.
5. **Restate §6's narrowing** rather than citing v2.49 §2.3 unqualified.
6. **Carry test coverage or record its absence**, per the Gate G3 discipline v2.47 §4 established. Two handlers change; an anonymous request to a deleted route should 404, and an anonymous `/login` sending `groups: ['ADMIN']` should not yield an `ADMIN` token.

---

# §8. Recorded, not addressed

- **`/login` sets a 30-day `refreshToken` cookie** (`auth.js:75-81`) on a request that verified nothing. Change #2 does not touch it. It falls to §3's selected option.
- **`/refresh` is TokenService-based** (`tokenService.js:152`) and is the path `frontend/src/services/api.js:59` depends on. Option A forces a decision here; this revision authorizes none.
- **The `role === 'admin'` lowercase branch** at `auth.js:68` disappears with change #2, incidentally retiring one side of v2.37 §60.6's casing split at this site only. The 34/2 split across the 36 gates is unaffected.
- **FD-63, FD-64, XK-3, and v2.49 §5's credential-custody finding** are unaddressed and unchanged.

---

# §9. Basis and merge-order dependency

**This revision cites FD-65 (F-AUTH-1), minted at v2.49 and now present in `origin/main` at `2359cbe6`.**

Basis is `2359cbe6`. PR **#1041** (v2.48, mints FD-64) merged at `436a8772`; PR **#1042** (v2.49, mints FD-65) merged at `2359cbe6`.

**The required merge order, v2.48 → v2.49 → v2.50, was honoured.** v2.49 §6 supersedes v2.48 §5.1, and FD-65 was present in `main` before this revision's authorization could rely on it. The dependency is satisfied.

**The pre-merge licence to update this revision's basis line and this section in place was exercised here.** This is a correction to an unlanded document, not an edit to a prior revision's body, and does not engage the additive-supersede discipline.

**That licence expires at merge, and expires completely.** Once this revision is in `main`, its basis line and this section are a landed body like any other. Any subsequent correction to them is a **v2.51 matter and must be made forward**, under the same additive-supersede discipline that governs §2's and §6's corrections to v2.49. **There is no window in which an in-place edit to a merged revision is permitted by this paragraph or any other.**

---

# §10. What this revision establishes

- **A declared-partial remediation of FD-65 is authorized, bounded by §1's table**, and by a scope statement that closes nothing.
- **FD-65 remains OPEN and P0. No closure revision may cite this authorization as closing it** (§1).
- **Cognito token issuance has never existed in this codebase** — no call sites, no dependency, no client SDK. The `/login` comment describes absent work, not regressed work (§2).
- **All three `/login` issuance options are projects requiring a dependency addition; Option C breaks the sole existing login path rather than deferring one** (§3).
- **The partial restores the admin tier and all 36 gates including `auditLogs.js`, and leaves the authenticated tier open on all 95 promoted handlers** (§4).
- **Change #2 is backward-compatible with the current frontend and does not touch the F-Auth-4 contract** (§4).
- **The `/test-token` route has no caller; `generateTestToken` has one. The route is authorized for deletion, the method is not** (§5).
- **Deleting `/test-token` narrows v2.49 §2.3's environment inference to the rate-limit question on one endpoint, and does not discharge it** (§6).
- **The closure revision's obligations are fixed in advance at §7.**

---

# §11. What this revision does not do

- **Ships no code.** Authorization is not execution; nothing at §1 has been performed.
- **Mints nothing.** No FD, no XK, no PE. FD tail remains **FD-65**; XK tail remains **XK-3**.
- **Does not close, downgrade, or reprioritise FD-65**, and forbids a closure revision from doing so on this authorization's basis (§1).
- Does not close or address **FD-63**, **FD-64**, **XK-3**, or v2.49 §5's credential-custody finding.
- **Does not select an issuance option** (§3), authorize credential verification on `/login`, or authorize any change to `/refresh`.
- Does not authorize any change to `src/middleware/auth.js`, including the HS256 routing and `groups`-from-payload design.
- **Does not authorize `JWT_SECRET` rotation**, which remains ownerless per v2.49 §7.
- Does not edit any prior revision's body. §2 corrects v2.49 §1's reading of the `/login` comment **forward**; §6 narrows v2.49 §2.3 **forward**. Both prior texts stand as written.
- Does not supply Gate G3's authenticated half. **Track G4 is not entered. Track G5 remains BLOCKED.**
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact and no request issued to any deployed host.** Derived from git against `origin/main` at `2359cbe6`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-17. Main at `2359cbe6`. Predecessor: v2.49.*
*Type: Remediation adjudication — the v2.46 slot in the adjudicate → ship → close cycle. Authorizes a declared-partial fix against FD-65, bounded at §1 and closing nothing. Records that Cognito issuance has never existed and costs the three `/login` options as projects. Fixes the closure revision's obligations in advance. Ships no code. Mints no FD, no XK, no PE. Tail: FD-65. XK tail: XK-3. Changes no gate. Cites FD-65 landed on main — see §9. No live database contact. [skip-automerge]*
