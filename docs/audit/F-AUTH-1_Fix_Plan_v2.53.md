| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Authorizes F-Auth-5. Changes no gate.* |
| --- |

**Document version**

v2.53 — **AUTHORIZES F-Auth-5. CHANGES NO GATE. MINTS NOTHING. SHIPS NO CODE.** FD tail remains **FD-65 (F-AUTH-1)**; XK tail remains **XK-3**. Authorizes the `req.user?.sub` → `req.user?.id` reconciliation at **six sites**, per v1.5 §4.6's fix spec, with line numbers verified against `b3b8442c` rather than copied (§1). **Corrects v1.5 §4.6's premise forward**: the drift is not prospective, it has been live since `7ae309f2` (2026-02-08), three months before v1.5 was written (§2). **Rewrites v1.5's verification step 1**, which passes on two nulls and would have marked Gate G3 clause 3 met against the broken state (§1.1). Records the seventh instance of the v2.51 §4 pattern — the first in the founding document — alongside the counter-example in the same document (§3). **Authorizes F-Auth-5 only. Not Step 6, not Step 6b.** Derived from git against `origin/main` at `b3b8442c`. No live database contact and no request issued to any deployed host.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. **FD-65 (F-AUTH-1)** — **OPEN, P0**. **FD-63** and **FD-64** remain open. **Gate G3 — NOT DISCHARGED**; clause 3 unmet per v2.52 §1. Track G4 — precondition not satisfied. Track G3 — OPEN. Track G5 — **BLOCKED** per v2.43 §4.2. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# PART I — THE AUTHORIZATION

# §1. What this authorizes

**This section is the authorization. Anything not listed here is not authorized by this revision.**

**Direction: normalize on `req.user?.id`.** This is not an open model question. v1.5 §4.6 settles it — other call sites read `req.user.id`, *"the value the auth middleware maps from `sub` onto the user object"* — and `src/middleware/auth.js` confirms it: all three middlewares assign `id: decoded.sub` and no `sub` key exists (v2.52 §1.2).

**All six line numbers below were verified against `b3b8442c`. Five match v1.5's pre-flight inventory; one had drifted.**

| # | Site | Change | Authorized |
|---:|---|---|:--:|
| 1 | `src/routes/decisionLogs.js:22` | `user_id: req.user?.sub` → `req.user?.id` | **YES** |
| 2 | `src/controllers/cursorPathController.js:22` | `userId: req.user?.sub` → `req.user?.id` | **YES** |
| 3 | `src/controllers/iconCueController.js:22` | `userId: req.user?.sub` → `req.user?.id` | **YES** |
| 4 | `src/controllers/musicCueController.js:20` | `userId: req.user?.sub` → `req.user?.id` | **YES** |
| 5 | `src/controllers/productionPackageController.js:22` | `userId: req.user?.sub` → `req.user?.id` | **YES** |
| 6 | `src/routes/thumbnails.js:81` | replace the whole line with `const userId = req.user.id;` — see below | **YES** |
| — | Step 6b — remove the duplicate `authenticateToken` | | **NO — separable, v2.52 §1.3** |
| — | CZ-5 | | **NO — already done, v2.52 §1.3** |
| — | Any change to `src/middleware/auth.js` | | **NO** |
| — | The Gate G3 clause 3 test | specified at §1.1 | **N/A — not authorized here and requires no authorization; see §1.1** |

**Site 6 carries a special case, and its premise drifted.** v1.5 instructs replacing the fallback chain `req.user?.sub || req.user?.id || 'system'` outright, on the ground that the fallback is dead code because the route is gated. **v1.5 states that gate as `authenticateToken` at `:76`. On `b3b8442c` the gate is `requireAuth` at `:77`**, in a multi-line declaration spanning `:75–78`. **The conclusion survives the drift** — `requireAuth` equally guarantees `req.user` is non-null by the time `:81` executes, since it returns 401 otherwise — **but the instruction is authorized on the verified premise, not the cited one.**

**Line-number drift, recorded:** v1.5 cites `src/routes/thumbnails.js:80`; the site is at `:81`. All five other citations are exact.

## §1.1 The verification test — v1.5's step 1 is insufficient and is rewritten here

**v1.5 §4.6 states verification step 1 as:**

> *Authenticated POST to a `/decision-logs` route succeeds and the persisted `user_id` field matches the value other authenticated routes write for the same user.*

**That test passes on the broken state.** If `decisionLogs` writes `undefined` and a sibling route also writes `undefined`, the two "match". **Written as specified, it would go green against the defect it exists to catch, and Gate G3 clause 3 would read as met while the data loss continued.**

**Corrected form. The test must assert all three:**

1. The persisted `user_id` is **non-null and not the string `'undefined'`**.
2. It **equals `req.user.id` as the middleware sets it** — not a sibling route's write, and **not the `sub` claim directly**. Today the middleware maps `id: decoded.sub`, so the two coincide; **the assertion is against the middleware-mapped field, not against the claim.**
3. An **anonymous** request to the same route does not persist a row at all (the route is `requireAuth`-gated).

**Assertion 2 is the load-bearing one, and its wording is deliberate.** Equality against a sibling compares two values that may both be wrong. Equality against `decoded.sub` would be correct today and wrong after any remapping — **which is precisely the scenario v1.5 §4.6 imagined and the reason F-Auth-5 exists.** A test that hardcodes the claim as ground truth reintroduces the coupling this fix removes. **Ground truth is the middleware-mapped field**, whatever it is mapped from.

**v1.5's step 2 is retained as written** — *"Authenticated POST to `/thumbnails/:id/publish` succeeds and persists `user_id` (not `'system'`)"* — and should additionally assert equality with the principal, for the same reason.

**v1.5's step 3 is retained with its scope stated**, per v2.51 §4.1: the verification grep is `grep -rnE "req\.user\??\.sub" src/` and must return zero outside test fixtures and `middleware/auth.js`. **It cannot see** a call site that destructures (`const { sub } = req.user`), one that indexes (`req.user['sub']`), or one outside `src/`. None is known to exist; none was searched for.

**The test's status, stated in three parts so its presence here is not misread.**

1. **Specified here, for correctness.** The authorization would otherwise ship a fix whose verification is defined only in a document that defines it wrongly.
2. **Not authorized here.** §1's table marks it **N/A**, not YES. Nothing in §1 grants permission to write it.
3. **Not requiring authorization at all.** Per **v2.52 §3**, it discharges a ledger obligation — Gate G3 clause 3, carried at v2.52 §6 item 1 — and ledger work needs no authorizing revision.

**A future reader must not take this section's presence inside §1 as evidence that tests require authorizing.** That is the opposite of what v2.52 §3 established, and the two rules are reconciled here for the first time in practice: **specification and authorization are different acts, and this is the former.** A revision may specify work it has no power to permit and no need to permit.

---

# PART II — CORRECTIONS

# §2. Correction to v1.5 §4.6, forward

**v1.5 §4.6 frames F-Auth-5 as a latent contract drift. It was already a live defect when written.**

> *Both resolve to the same Cognito subject identifier today, but the contract has drifted… The moment the middleware mapping changes (e.g., to a numeric internal ID, or to a UUID indirection layer for a multi-tenant change), `decisionLogs.js` silently writes the wrong value with no test failure.*

**Both do not resolve to the same identifier, and did not when that was written.** `req.user` has never carried a `sub` key — no commit in `src/middleware/` ever added or removed one (v2.52 §1.2). `req.user?.sub` has evaluated to `undefined` since `decisionLogs.js` was created at **`7ae309f2` (2026-02-08)**. **v1.5 landed at `da58e93f` (2026-05-03)** — three months later.

**The consequence is not conditional on a future mapping change. It is present and has been for six months of code age.** *"Silently writes the wrong value with no test failure"* is an accurate description of the state at the time of writing, phrased as a prediction.

**This correction is made forward. v1.5 §4.6 stands as written**, and its fix spec is otherwise sound — the six-site enumeration is exact and the direction is right. **What changes is the character of the work**: not preventive hygiene against a hypothetical, but remediation of a defect that has been discarding actor attribution.

**What is not established**, unchanged from v2.52 §1.2: no database was contacted, prod is FROZEN, and how many rows exist or what their `user_id` columns hold is **unmeasured**. The six-month figure is a claim about code age.

---

# PART III — DISCIPLINE

# §3. The seventh instance — and the counter-example beside it

**v2.52 §4.1 records six instances of a claim answering a narrower question than it is read as answering. This is the seventh, and it is the earliest: it is in the founding document, and everything downstream inherited it.**

v1.5 §4.6's *"Both resolve to the same Cognito subject identifier today"* is the kind of statement that reads as verified and was not. **Every subsequent treatment of F-Auth-5 — including its scheduling as a one-line fold-in with *"negligible"* PR-scope cost — rests on it.** Had the sentence been checked, F-Auth-5 would have been a defect remediation rather than a hygiene item, and would plausibly not have been deferred.

**And in the same section, the opposite.** v1.5 §4.6 also states:

> *Codebase uses optional chaining; the literal-form grep returns 0 hits and is incorrect. Use the regex form: `grep -rnE "req\.user\??\.sub" src/`*

**Verified against `b3b8442c`: the literal form matches 0 files; the regex form matches 6.** That is an instrument's blind spot documented prospectively, with the correct instrument supplied — **exactly what v2.51 §4.1 requires, written in May, three months before this series articulated the rule.**

**The two sit in the same section of the same document, and the contrast is the lesson.** The plan already contained the discipline. What failed was not its absence but that later revisions read the plan's *citations* — v2.47 §4.1's one-clause quotation of G3 — rather than the plan. **A discipline in a document nobody re-reads is a discipline that does not run.**

---

# PART IV — CONSEQUENCE AND CLOSING

# §4. What this unblocks, and what it does not

**Executing §1 makes Gate G3 clause 3 meetable.** The test at §1.1 fails today and passes after. Writing it then discharges v2.52 §6 item 1, and G3's four clauses become 1 evidenced, 2 met, 3 met, 4 met — **at which point the discharge ruling withheld at v2.52 §1.1 can be re-made against the full text.**

**It does not discharge G3.** That is a ruling, not a consequence, and remains v2.52 §6 item 4.

**It does not touch FD-65.** The issuance half is unaffected; FD-65 remains OPEN and P0.

**It does not close the `req.user?.sub` defect as a finding.** v2.52 §6 item 3 records it unminted. Remediating it and minting it are different acts, and this revision does the first only.

# §5. Numeral disambiguation

- **F-Auth-5** is a sub-step of Step 6 per `v1.5:31`. **This revision authorizes F-Auth-5 and nothing else** — not Step 6, not **Step 6b** (`auth.js:484`), not CZ-5 (already done).
- **Gate G3 clause 3** is the gate condition. **v2.52 §6 item 1** is the ledger entry for its test. **§1.1 above** is the test's specification. Three different things.
- **The seventh instance** at §3 extends v2.52 §4.1's six. It is the earliest, not the latest.
- **FD tail remains FD-65**; **XK tail remains XK-3.** Nothing is minted. **Changes no gate.**

# §6. What this revision establishes

- **F-Auth-5 is authorized at six sites, direction settled on `req.user?.id`, line numbers verified against `b3b8442c`** (§1).
- **`thumbnails.js` is at `:81`, not v1.5's `:80`, and its gate is `requireAuth` at `:77`, not `authenticateToken` at `:76`. The dead-fallback conclusion survives the drift** (§1).
- **v1.5's verification step 1 passes on two nulls and is rewritten**; the corrected test asserts non-null, equality with **`req.user.id` as the middleware sets it** — not with the `sub` claim, which would survive today and fail after any remapping — and no anonymous write (§1.1).
- **v1.5 §4.6's premise is corrected forward: the drift was live, not prospective, and had been for three months when v1.5 was written** (§2).
- **The seventh instance of the v2.51 §4 pattern is the earliest and sits in the founding document; the same section contains a prospectively-documented blind spot, which is the counter-example** (§3).
- **Executing this makes clause 3 meetable. It discharges nothing by itself** (§4).

# §7. What this revision does not do

- **Ships no code. Mints nothing. Changes no gate.**
- **Does not authorize Step 6, Step 6b, or any change to `src/middleware/auth.js`** (§1).
- **Does not discharge Gate G3** or re-make the ruling withheld at v2.52 §1.1.
- **Does not mint the `req.user?.sub` defect** (v2.52 §6 item 3) or propose its FD number.
- Does not close FD-63, FD-64 or FD-65. **FD-65 remains OPEN and P0.**
- Does not enter **Track G4**, whose precondition remains unsatisfied. **Track G5 remains BLOCKED.**
- Does not measure any database row, and makes no claim about how many `decision_logs` rows exist or what they contain (§2).
- Does not edit any prior revision's body. §2 corrects v1.5 §4.6 **forward**; §1.1 supersedes its verification step **forward**.
- Does not settle v1.5 §6.1's six-versus-seven gate discrepancy (v2.52 §7).
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact and no request issued to any deployed host.** Derived from git against `origin/main` at `b3b8442c`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-18. Main at `b3b8442c`. Predecessor: v2.52.*
*Type: Authorization — the v2.50 slot in the adjudicate → ship → close cycle. Authorizes F-Auth-5 at six verified sites and nothing else. Rewrites v1.5's verification step 1, which passes on two nulls. Corrects v1.5 §4.6's premise forward: the drift was live, not prospective. Records the seventh instance of the v2.51 §4 pattern and the counter-example beside it. Ships no code. Changes no gate. Mints no FD, no XK, no PE. Tail: FD-65, OPEN, P0. XK tail: XK-3. No live database contact. [skip-automerge]*
