| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Closure of the v2.50 §1 remediation. Closes no finding.* |
| --- |

**Document version**

v2.51 — **CLOSES THE REMEDIATION AUTHORIZED AT v2.50 §1. DOES NOT CLOSE FD-65. MINTS NOTHING.** FD tail remains **FD-65 (F-AUTH-1)**; XK tail remains **XK-3**. The declared-partial remediation shipped at **`75ac05f0`** (PR #1044): `POST /api/v1/auth/test-token` deleted, and `POST /api/v1/auth/login` no longer reads `groups` or `role` from the request body. **FD-65 remains OPEN and P0. The authenticated tier is still open: an anonymous caller still obtains a valid `['USER']` token from `/login` that satisfies `requireAuth` on all 95 handlers promoted at `8ba2b95c`. Issuance is unaddressed and no option under v2.50 §3 was selected.** Discharges v2.50 §7's six obligations (§2), corrects v2.50 §5 forward in two places (§3), and states the absence-claim rule (§4). Derived from git against `origin/main` at `75ac05f0`. No live database contact and no request issued to any deployed host.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. **FD-65 (F-AUTH-1)** — **OPEN, P0**, partially remediated. **FD-63** and **FD-64** remain open and are not addressed. **Gate G3 — minimum met at `436a8772`; discharge NOT RULED by this revision** (§5). Track G4 — not entered, and its stated precondition turns on that ruling. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# §1. What shipped

Merged at **`75ac05f0`** (PR #1044), squashed, from `claude/f-auth-1-fd65-partial`. Basis `912b646d`. **2 files changed, 21 insertions, 53 deletions.**

| Change | File | Effect |
|---|---|---|
| **#1** | `src/routes/auth.js` | `POST /api/v1/auth/test-token` deleted — the JSDoc block through the route's closing `});` |
| **#2** | `src/routes/auth.js` | `/login` no longer destructures `groups` / `role` from `req.body`; the issued token carries `groups: ['USER']`, `role: 'USER'` |
| **footprint** | `tests/integration/auth.integration.test.js` | the test-token block, which asserted **200**, replaced by a **404** guard |

**Verified on `origin/main`:** `git grep -c "test-token" -- src/routes/auth.js` returns **no match**. The route is absent from the shipped surface.

**`TokenService.generateTestToken` was retained**, per v2.50 §1 #3, at `tokenService.js:184` and `:215`.

**The `['USER']` default was applied as authorized**, not `['USER','EDITOR']`. Per v2.50 §1's note: `EDITOR` gates nothing today, and issuing it would pre-clear a gate that does not yet exist.

---

# §2. Discharge of v2.50 §7's six obligations

**1. FD-65 remains open.** It does. **This revision closes the remediation authorized at v2.50 §1 and closes no finding.** v2.50 §1 states that no closure revision may cite that authorization as having closed FD-65; this revision does not, and records the prohibition as satisfied rather than merely unviolated.

**2. The authenticated tier is still open.** `POST /api/v1/auth/login` still performs no credential verification. An anonymous caller supplying any email of valid form and any password of six characters receives a validly-signed HS256 token. That token carries `['USER']` rather than caller-chosen groups, and it still satisfies `requireAuth` on **all 95 handlers promoted at `8ba2b95c`**. **v2.49 §3's statement is unchanged by this remediation: against an unauthenticated attacker the CP's promotion still secures nothing.**

**3. No issuance option was selected, and none was selected by anyone.** v2.50 §3 costed three options — wire `/login` to Cognito, remove it in favour of a client-side flow, or gate it to non-production — and selected none. No selection has been made since. **The decision remains open and unowned.** v2.50 §2's finding stands: Cognito token issuance has never existed in this codebase, so all three remain projects requiring a dependency addition.

**4. The route/method split held — and v2.50 §5's enumeration did not.** `generateTestToken` survives and `scripts/tests/test-task-1-auth.js` is untouched and passing. **But §5's supporting enumeration was wrong in both directions, and §3 below records the corrections.**

**5. v2.50 §6's narrowing is now fact rather than projection.** `/test-token` does not exist in any environment, and the `NODE_ENV === 'production'` guard at the former `auth.js:153` went with it. **The remaining environment-dependent difference is whether `loginLimiter` is active, on one endpoint.** v2.49 §2.3 is not to be cited unqualified: its two-endpoint posture describes a surface that no longer exists. **What has not changed is that the live `NODE_ENV` of any deployed host remains unmeasured.** The inference narrowed; it was not discharged.

**6. Test coverage — partial, and the gap is on the half that most needs it.**

| Change | Coverage | Where |
|---|---|---|
| #1 — route deleted | **Yes** — 404 guard, asserting no handler is mounted, sending `role: 'ADMIN'` as the payload that made it dangerous | `tests/integration/auth.integration.test.js:282` |
| #2 — `['USER']` default | **None** | — |

**Nothing asserts that an anonymous `POST /login` sending `groups: ['ADMIN']` fails to yield an ADMIN token.** That is the assertion the privilege half most needs — it is the direct negative of the escalation FD-65 records — and it does not exist. The change is covered only transitively, by 89 tests across six suites that pass with it in place.

**This is recorded as a gap, not papered over, and §6 owes it forward.** It is cheap: one request, one assertion on the returned token's `groups`.

---

# §3. Corrections to v2.50 §5

**Both corrections are made forward. No in-place edit to v2.50 is proposed, and v2.50 §5 stands as written.**

**Correction 1 — "has no caller" was false.** v2.50 §5 states *"`POST /api/v1/auth/test-token` has no caller."* One executable caller existed: `tests/integration/auth.integration.test.js`, whose test-token block posted to the route and asserted **200**. Executing v2.50 §1 change #1 alone therefore left the build red — the failure was `Expected: 200 / Received: 404`.

**Correction 2 — `generateTestToken`'s consumers were under-counted.** v2.50 §5 names one consumer, `scripts/tests/test-task-1-auth.js:119`. There are more: `tests/unit/services/tokenService.test.js:182-205` holds a describe block with five further call sites. (`scripts/tests/test-search-history-quick.js:13` is a same-named local function and is not a consumer.) **This made v2.50 §1 #3's "do not delete" ruling more load-bearing than its own evidence showed** — the ruling was right and its support was thin.

**Both errors have one cause.** The caller search was run as `git grep … | head -20`. The output reached the limit and was truncated, and **the truncation left no trace in the result.** Nothing distinguished "these are all the matches" from "these are the first twenty."

**The remediation was not made wrong by this**, and no part of §1 requires revision: the route still had to go, and the method still had to stay. What was wrong was the premise's support and the scope's completeness — §1's enumeration omitted an edit that change #1 made unavoidable.

---

# §4. The absence-claim rule

**v2.49 §4 records three instruments that returned true results later read as coverage. This remediation produced a fourth, and it differs in kind.**

| # | Instrument | Failure |
|---:|---|---|
| 1 | §21's G1 grep | complete output, read as answering a broader question |
| 2 | v2.45 §3.1 enumeration | complete output, read as answering a broader question |
| 3 | v2.46's Tier 3 exclusion | complete output, read as answering a broader question |
| **4** | **v2.50 §5's caller search** | **incomplete output that presented as complete** |

**The first three are failures of instrument selection. The fourth is a failure of output integrity between a correct instrument and its reader.** The grep pattern was right; the pipe truncated it, and the truncation was invisible. The remedies differ accordingly: the first three want better-chosen patterns, the fourth wants a prohibition.

> **A search establishing that nothing exists may not be paged, limited, or truncated.** Absence of a match and absence of a *displayed* match are indistinguishable in the output, so any limit converts a finding into a guess without marking it as one.

## §4.1 Showing the search is not sufficient

**All four instruments above were auditable and all four were wrong.** §21's G1 was published and case-blind. The preflight's patterns were published and missed `router.use`. The `head -20` was reproducible and truncated. **Reproducibility transfers the method; it does not transfer the blindness**, and in an absence claim the blindness is the entire risk.

> **An absence claim must state the search *and what that search cannot see*.**

v2.50 §5 could have read: *grepped for the literal route path; would not catch a caller constructing the URL dynamically, a caller matched only by a different pattern, or anything beyond the display limit.* A reader would then have somewhere to look rather than an assurance to rely on.

**This is v2.49 §4's own rule applied prospectively.** §4 requires recording what the instrument measured in the instrument's own terms; for claims of absence, those terms necessarily include the instrument's blind spots. **v2.44's four miss shapes are the worked example, written retroactively** — they are precisely the enumeration of G1's blindness, produced after something had already slipped through. **The discipline is producing that enumeration at the moment the absence claim is made.**

## §4.2 The cost of additive-supersede is not uniform

v2.50 §5 has been on `main` since `912b646d` and is false in two places. It is corrected at §3, forward, per the register's discipline. **Between those two points `main` held a document asserting an absence that did not hold, and a reader in that window had no signal.**

**That cost is accepted and the discipline is still right** — in-place editing of landed revisions would be worse, and corrections are necessarily later than the errors they correct. **But the cost is not uniform across claim types.** A miscount degrades gracefully: a reader who recomputes finds the true number. An absence claim does not degrade at all — it is load-bearing until corrected, invites reliance rather than recomputation, and in this instance was the premise an authorization rested on. **This is the first instance in the series where that gap was operationally visible rather than theoretical, and it is recorded for that reason.**

---

# §5. Gate G3 — the evidence, and a ruling owed

**This section reports evidence. It does not rule Gate G3 discharged, and no reader may take it as having done so.**

Discharging a gate is an adjudication, not a report, and this revision's whole subject is the difference between the two — §2 and §7 spend their length distinguishing remediation-closure from finding-closure. A closure revision that reports on shipped code and then quietly discharges a gate on its author's own judgment would commit, in miniature, the error it was written to prevent. **The ruling is owed and is recorded as owed at §6 item 7.**

**The evidence, in full:**

**Gate G3's minimum — one authenticated and one unauthenticated test per sub-form — appears met on `main` at `436a8772`.** Both halves exist for all four miss shapes. **89 tests across six suites pass**, verified against `origin/main` at `75ac05f0`.

**The authenticated half carries a negative control**, and that control is what makes it load-bearing. Four assertions of *"not 401"* prove nothing unless a 401 is reachable on the same request shape: a `requireAuth` degraded to accept-anything would leave all four green. A structurally valid HS256 token signed with the wrong secret is therefore asserted to return **401 with code `AUTH_INVALID_TOKEN`** — the verifier-rejection code, emitted only after `verifyToken` has run and thrown, and distinct from `AUTH_REQUIRED` and `AUTH_INVALID_FORMAT`, which never reach the verifier at all.

**Track G4's stated precondition at v2.47 §4.1 is *"the minimum is met."*** On the evidence above it appears met. **Whether that discharges G3, and therefore whether G4's precondition is satisfied, is the ruling owed at §6 item 7.** This revision does not enter G4 and does not treat the precondition as satisfied.

## §5.1 Two permanent errors in the commit record

**`436a8772` — the squash title is wrong in three ways.** It reads *"Gate G3 unauthenticated half - 5 suites, 61 tests across 4 miss shapes … [skip-automerge]"*. The commit shipped **both halves**, **66 tests**, and the `[skip-automerge]` token leaked into the merge subject. The title was authored when the branch held only the unauthenticated half; `34e5e6e3` added the authenticated half and the negative control to the same branch before merge, and the title was not revised.

**`f032a1d9` — carries the superseded Cognito-mock claim** in its message, asserting that G3's authenticated half required a mocked verifier because TokenService does not authenticate `requireAuth` routes. v2.49 §6 establishes that as false.

**Both are permanent.** Commit messages on `main` cannot be corrected without rewriting history, which is not proposed. **The corrected text did reach `main` in the file itself** — the false claim was removed from `tests/integration/f-auth-1-fd63.test.js` before #1041 merged, so no reader of the working tree encounters it. **Only the commit log carries it**, and this section is where a reader of that log is directed.

---

# §6. Owed forward

1. **The `/login` privilege-half test** (§2, obligation 6). An anonymous `POST /api/v1/auth/login` sending `groups: ['ADMIN']` must be asserted not to yield a token carrying `ADMIN`. Currently uncovered.
2. **The issuance decision** (§2, obligation 3). Unowned. FD-65 cannot close without it.
3. **v2.49 §5's credential-custody finding** — recorded as XK-shaped, still not admitted, and unaffected by this remediation. The committed `JWT_SECRET` still signs valid tokens; `groups` is still trusted from the payload at `src/middleware/auth.js:514`.
4. **`JWT_SECRET` rotation** — still ownerless per v2.49 §7, and still preceded by an environment read nobody has taken.
5. **FD-63's probe half** — §21's G1 still cannot detect three of the four miss shapes. v2.47 §5's statement is unchanged.
6. **FD-64** — the `roles.js` / `AssetRoleService` casing defect and the missing `where` are both unremediated on `main`.
7. **The Gate G3 discharge ruling** (§5). The evidence is complete and recorded; the adjudication is not this revision's to make. **Until it is ruled, Gate G3 is not discharged and Track G4's precondition is not satisfied** — irrespective of how strongly the evidence points.

---

# §7. Numeral disambiguation

- **FD-65 (F-AUTH-1)** is **not closed** by this revision. FD tail remains **FD-65**. **FD-63** and **FD-64** are open and untouched.
- **"Closure"** in this revision's title refers to the **v2.50 §1 remediation**, not to any finding. The two are distinguished throughout and §2 obligation 1 states the distinction explicitly.
- **Gate G3** is F-AUTH-1's v1.5 six-gate sequence. Its **minimum is met on the evidence at §5; its discharge is NOT ruled here** and is owed at §6 item 7. **Track G3** is the deployment track and remains OPEN. **Track G4** is not entered.
- **"Minimum met"** and **"discharged"** are different states. §5 reports the first. Only a ruling establishes the second.
- **"Discharge" is used in two senses and they are not the same act.** v2.50 §7's **obligations** are discharged by this revision (§2) — an obligation is discharged by being *answered*, including by answering "no coverage exists." **Gate G3's discharge** is an adjudication (§5) — a gate is discharged by being *ruled*, and evidence however strong does not rule it.
- **Instruments 1–4** at §4 extend v2.49 §4's set of three. The fourth is a different sub-shape, not a fourth example of the same one.
- **XK tail remains XK-3.** §6 item 3 records an unadmitted finding; that is not a mint.

---

# §8. What this revision establishes

- **The v2.50 §1 remediation shipped at `75ac05f0` and is complete as authorized** (§1).
- **FD-65 remains OPEN and P0. The authenticated tier is still open on all 95 promoted handlers, and issuance is unaddressed with no option selected by anyone** (§2).
- **All six of v2.50 §7's obligations are discharged**, one of them by recording a coverage gap rather than coverage (§2).
- **v2.50 §5 was wrong in two places, from one cause: a caller search truncated by `| head -20`, with the truncation invisible in the output** (§3).
- **A search establishing that nothing exists may not be paged, limited, or truncated** (§4).
- **An absence claim must state the search and what that search cannot see** — reproducibility transfers the method, not the blindness (§4.1).
- **Additive-supersede's cost is accepted but is not uniform: absence claims do not degrade gracefully, and this is the first operationally visible instance** (§4.2).
- **Gate G3's minimum is met on the evidence at `436a8772`, with a negative control that makes its authenticated assertions load-bearing. Its discharge is not ruled here and is owed** (§5, §6 item 7).
- **Two commit-message errors are permanent and are named here** (§5.1).

---

# §9. What this revision does not do

- **Ships no code.** The code it closes shipped at `75ac05f0`, before this revision.
- **Closes no finding.** Not FD-65, not FD-63, not FD-64. **Mints nothing** — no FD, no XK, no PE.
- Does not select an issuance option, assign an owner to that decision, or authorize any further change to `src/routes/auth.js`.
- Does not supply the `/login` privilege-half test it records as owed (§6 item 1).
- Does not admit v2.49 §5's credential-custody finding, or authorize `JWT_SECRET` rotation.
- **Does not rule Gate G3 discharged** (§5). It reports the evidence and records the ruling as owed. Does not enter **Track G4** or treat its precondition as satisfied. **Track G5 remains BLOCKED.**
- Does not edit any prior revision's body. §3 corrects v2.50 §5 **forward**; §2 obligation 5 narrows v2.49 §2.3 **forward**. Both prior texts stand as written.
- Does not rewrite history to correct the commit messages at `436a8772` and `f032a1d9` (§5.1).
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact and no request issued to any deployed host.** Derived from git against `origin/main` at `75ac05f0`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-17. Main at `75ac05f0`. Predecessor: v2.50.*
*Type: Closure of the v2.50 §1 remediation — the v2.47 slot in the adjudicate → ship → close cycle. Discharges v2.50 §7's six obligations, one by recording a coverage gap. Corrects v2.50 §5 forward in two places and states the absence-claim rule. Reports Gate G3's minimum as met and records its discharge as an owed ruling, not made here. Records two permanent commit-message errors. Closes no finding. Mints no FD, no XK, no PE. Tail: FD-65, OPEN, P0. XK tail: XK-3. Changes no gate. No live database contact. [skip-automerge]*
