| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Six-step coordinated single-PR plan.* |
| --- |

**Document version**

v2.43 — KEYSTONE REOPENED-QUALIFIED. **Mints FD-63 (F-AUTH-1) — the first FD minted by this series.** Ships no code. Records seven route files named in CP7 and CP9 planning scope that carry no `requireAuth`, no router-level preset, and no Item 15 `// PUBLIC:` marker, and whose 44 write routes reach handlers under the global `optionalAuth` mount at `src/app.js:236`. Establishes that G1 cannot distinguish a promoted route from a never-promoted bare declaration under that mount, and therefore that G1's program-wide zero is observed output rather than proof of closure. **Withdraws §5.71's closure claim for the seven named files only.** Sets Track G5 BLOCKED pending disposition and re-proof; marks Track G3 and Track G4 pending re-validation. Raises XK admission as a question and does not decide it. Derived entirely from git against `origin/main` at `5f79c634`. No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED.** v2.37 §5.71's keystone closure marker stands as historical text and is not edited. Its closure claim is superseded narrowly at §2.4 of this revision. DEPLOYMENT TRACKS: Track G3 self-review — OPEN, and now **pending re-validation** on corrected closure evidence. Track G4 dev verification + soak — **pending re-validation**; not entered. Track G5 prod cutover — **BLOCKED** per §4.2, in addition to the pre-existing structural prod-freeze gate. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# §1. Seven files, forty-four write routes

## §1.1 The reads

Against `origin/main` at `5f79c634`, for `animatic.js`, `compositions.js`, `continuityEngine.js`, `decisions.js`, `footage.js`, `roles.js`, `templateStudio.js`:

- **`requireAuth`: zero occurrences.** `git grep -c` returns no line for any of the seven — the pattern is absent from every file, not merely absent from the route declarations.
- **`router.use`: zero occurrences.** No file-level preset of any middleware. The `calendarRoutes.js` shape recorded at v2.41 §2.2 does not apply here.
- **`// PUBLIC:`: zero occurrences.** No Item 15 rationale comment in any of the seven.
- **Mounts are bare.** `src/app.js` mounts each with no middleware argument: `roles` 687, `compositions` 688, `animatic` 741, `footage` 833, `templateStudio` 883, `decisions` 898, `continuity` 1110.
- **The three indented mounts are `require` guards, not environment gates.** `animatic` (735–744), `decisions` (893–900) and `continuity` (1104–1112) sit inside `try`/`catch` blocks whose `catch` logs a load failure. They mount in every environment.
- **`animatic.js` read directly at its first write route.** `router.post('/scenes/:sceneId/beats/generate', asyncHandler(async (req, res) => {` — path to handler, no middleware slot, no preset above it.

**The governing middleware.** `src/app.js:236` is a bare `app.use(optionalAuth)`, installed ahead of every route mount in the file. `src/middleware/auth.js`'s `buildOptionalAuthMiddleware` sets `req.user = null` and calls `next()` on an absent `Authorization` header, on a malformed bearer token, and on a token rejected by the verifier — expired, bad signature, claim mismatch. A 503 is returned only on a Cognito/JWKS infrastructure failure when `degradeOnInfraFailure` is false. **Anonymous and invalid-token requests reach the handler.** This is the keystone bug as §5.71 itself states it.

**Count.** The 2026-08-16 pre-flight run (`docs/audit/F-AUTH-1_Preflight_Run_2026-08-16.txt`, committed at `5f79c634`) reports Tier 3 per file: `compositions` 12, `continuityEngine` 11, `templateStudio` 7, `roles` 5, `animatic` 4, `footage` 4, `decisions` 1 — **44 write routes.** The run's eighth Tier 3 file, `auth.js` (4), is **excluded from this finding**: it is the login and refresh router, was named in no CP scope, and is correctly unauthenticated.

## §1.2 What the reads rule out

The Step 3 tier model has five members. Four are excluded by direct read:

- **Tier 1** is `requireAuth`. Absent.
- **Tier 2** is `requireAuth + authorize(['ADMIN'])` per the §5.41 universal canonical lock. Contains `requireAuth`. Absent.
- **Tier 3 PRESERVE** is the §5.45 polymorphic factory at named sites — `press.js` L455 + L501, `worldStudio` L2483, `manuscript-export` L132 + L162 + L570. None of the seven.
- **Tier 4 PUBLIC** requires an Item 15 rationale comment. Absent.

**No Step 3 disposition landed on these 44 routes.** Whether the files were opened during CP execution is *not* established by these reads and is not asserted; what is established is that no disposition is present in them.

## §1.3 `compositions.js` — the decisive instance

CP7's planning scope names it precisely: *"compositions.js no-auth subset (Item 10 — Tier 1 on 22 handlers; jwtAuth subset stays as-is per D20)."* Two instructions.

The file has 19 write routes. Seven carry `authenticateJWT` — 479, 510, 533, 556, 594, 816, 885. Twelve carry nothing — 148, 617, 916, 948, 968, 1114, 1305, 1384, 1419, 1470, 1519, 1621.

**The D20 preservation half is observably present.** Seven of the program-wide 13 preserved `authenticateJWT` instances sit in this file. **The Tier 1 promotion half is observably absent** — `requireAuth` count zero.

This is not a forecast discrepancy. It is one file, one CP, one dual instruction, half executed. It is the strongest single item in this finding and does not depend on any arithmetic against planning estimates.

---

# §2. FD-63 (F-AUTH-1) — G1 cannot see a bare declaration under a global mount

## §2.1 What G1 measures

G1, per §5.71(1), is *"optionalAuth-on-writes program-wide: 0 hits"*, excluding the §5.45 polymorphic factory. The probe matches the literal token `optionalAuth` on write route declarations.

## §2.2 Why zero is not proof

`src/app.js:236` supplies `optionalAuth` to every route mounted after it — that is, to every route in the application. A write route whose declaration carries no middleware at all is therefore an `optionalAuth` route at runtime **and produces no G1 hit**, because the token it greps for is not in the file.

G1's zero is consistent with two distinct states:

1. The route was promoted — `optionalAuth` was removed and `requireAuth` added.
2. The route never carried per-route middleware — nothing was removed, nothing was added, and the global mount governs.

**G1 cannot distinguish them.** The seven files are in state 2 and always were; no re-run of G1 at any point in the program would have reported them.

The global mount is not itself a discovery. It is inventoried — the pre-flight script hardcodes `$PE51_AppGlobalLine = 236` and the 2026-08-16 run confirms it MATCH. What is recorded here is the **interaction**: an inventoried global mount plus a bare declaration produces an unauthenticated write route that the closure probe reports as clean.

Every static instrument in this program shares the limitation. The §7.3 batch probe, v2.41's direct-read sweep, and the pre-flight's five-name windowed matcher all ask what appears *on* a route declaration. None asks what the route *inherits*.

## §2.3 FD-63 (F-AUTH-1) — statement

**FD-63 (F-AUTH-1): the G1 closure probe cannot detect an unauthenticated write route whose declaration carries no middleware, because the global `optionalAuth` mount at `src/app.js:236` supplies the bypass without supplying the token G1 greps for. Forty-four write routes across seven files named in CP7 and CP9 planning scope are in this shape on `origin/main` at `5f79c634`, carrying no Tier 1, Tier 2, Tier 3 or Tier 4 disposition.**

FD tail before this revision: **FD-62 (F-Stats-1)**, per F-Stats-1 Fix Plan v1.60. FD tail after: **FD-63 (F-AUTH-1)**.

**Remedy: not evaluated.** Two candidate directions exist — per-route promotion of the 44, or a probe redesign that measures effective middleware rather than declared tokens — and each has a different cost and a different blast radius. Neither is selected here.

**First mint by this series.** No prior F-AUTH-1 fix plan revision has minted an FD; the series has tracked findings as PE candidates, CP dispositions and Tier classifications. `Cross_Keystone_Register.md` states the governing rule without restricting it by series: *FD numbers are minted only by Fix Plan revisions.* v2.43 is a Fix Plan revision. The mint is made under that rule and the departure from series practice is recorded so a future reader does not read it as an error.

## §2.4 Scope of the withdrawal

**§5.71's closure is withdrawn for the seven named files only. For the remaining swept files, G1's zero stands as observed output, not as closure proof. Withdrawn program-wide is G1's sufficiency as proof of closure. Whether other files share this shape is owed and not asserted.**

§5.71's body is not edited. It remains intact as historical text and is superseded only to the extent stated in the sentence above, per additive-supersede.

**The owed question, stated.** This finding rests on eight files surfaced by one script run over `src/routes`. The pre-flight's PE #52 candidate set is 120 files and 853 write routes. Whether bare-declaration-under-global-mount routes exist outside the eight is **unmeasured**. It is owed. It is not asserted in either direction.

---

# §3. CP7 and CP9 closure accounting

Recorded as context, and explicitly weaker evidence than §1.

## §3.1 CP7 (§5.53)

Planning scope: 28 files / ~160 handlers, naming `decisions.js`, `continuityEngine.js`, `templateStudio.js` and `compositions.js` among them. Closure records **17 source files modified**, 153 handlers, 148 promotions, and names five CP-audited files not touched per §9.13 Rule 6 — `sceneProposeRoute.js`, `episodeOrchestrationRoute.js`, `characterGrowthRoute.js`, `memories/index.js`, `memories/helpers.js`. That accounts for 22 of 28.

## §3.2 CP9 (§5.61)

Planning scope: 19 files / ~84 handlers, naming `roles.js`, `footage.js` and `animatic.js`. Closure records **6 source files modified**, 37 handlers, and a Tier 1 outcome naming `scriptGenerator` and `scriptAnalysis`. No not-touched list is given.

## §3.3 What this does not establish

**Planning scope is a forecast and forecasts move.** CP7 ran as a declared D11 scope-expansion outlier. A file named in a plan and absent from a closure count may have been redistributed, re-dispositioned, or deferred by a mechanism this revision has not read.

**No CP7 or CP9 surface report exists on `origin/main`.** `docs/audit/` contains surface reports for F-Deploy-1, F-Sec-3 and F-Stats-1 only. If a per-CP re-disposition was recorded, it is not in a document reachable from main.

The finding at §1 does not depend on this section. §1 is a set of facts about current source; §3 is an accounting note that is consistent with them.

---

# §4. Track and gate effects

## §4.1 Keystone status — REOPENED-QUALIFIED

F-AUTH-1 moves from CLOSED to **REOPENED-QUALIFIED**. The qualification is §2.4's scope sentence and nothing wider. The ~95–100 files the sweep touched, the ~700–750 handlers tier-classified, the 77 legacy alias conversions and the 2,390-test backend baseline are not disturbed by this revision.

## §4.2 Track G5 — BLOCKED

**Track G5 prod cutover is BLOCKED pending disposition of the 44 routes and re-proof of closure by an instrument that measures effective middleware.**

This is a second gate, independent of and additional to the pre-existing structural prod-freeze gate recorded at v2.41 and v2.42.

The reasoning is v2.42 §3.4's adopted discipline — *doubt at the gate extends the gate*. G5 is the point past which failure handling becomes incident response rather than gate mechanics. Cutting over on a keystone believed closed, with 44 unauthenticated write routes on unconditional mounts — including hard `DELETE` handlers in `compositions.js`, `templateStudio.js` and `footage.js` — is the condition that discipline exists to prevent.

## §4.3 Tracks G3 and G4 — pending re-validation

Track G3's self-review and Track G4's dev verification are downstream of closure evidence that §2.4 qualifies. Both are marked **pending re-validation**. Neither is discharged, and Track G4 is not entered.

v2.42 §2.3's two unattempted clauses — the qualitative audit pass over ~700 disposition judgments, and the production-readiness assessment for G4 — remain open and are unaffected except that this finding is now an input to the first of them.

---

# §5. XK admission — raised, not decided

`Cross_Keystone_Register.md` already carries an F-AUTH-1 row against XK-3: *"`src/middleware/auth.js` — the tier model has no resource-scoped member."* FD-63 (F-AUTH-1) concerns the same file from a different direction — not the tier model's shape but the global mount's fallback behaviour.

**Whether FD-63 (F-AUTH-1) warrants XK admission is raised here and not decided.** XK admission requires a ratifying Fix Plan revision and its own reasoning about whether the finding crosses keystones or merely touches a shared file. This revision does not mint an XK. XK tail remains **XK-3**.

---

# §6. Numeral disambiguation

Per `Cross_Keystone_Register.md` §3, imported items retain their origin label in full on first reference.

- **FD-63 (F-AUTH-1)** is minted here. It is unrelated to **§63 (F-Stats-1)**, minted at F-Stats-1 Fix Plan v1.60 — that revision's own disambiguation block anticipated this collision and it now materialises. It is unrelated to **PE #63**, which does not exist, and to open item 63 in any series.
- **FD-62 (F-Stats-1)** and **PE #62 (F-App-1 residue)** are distinct items sharing a numeral.
- **G1–G6** in this document are the §21 / §5.71 verification greps. They are not the **Gate 1 … Gate 6** sequence of any other keystone, and not F-Deploy-1's G-numbered phases.
- **Tier 1–Tier 4** are Step 3 disposition tiers. The pre-flight script's **Tier 1 / Tier 2 / Tier 3** are script-detection confidence bands over PE #52 candidates and are a different scheme with an overlapping vocabulary. §1.1's count of 44 uses the script's Tier 3; §1.2's exclusions use the Step 3 tiers.

---

# §7. What this revision establishes

- **FD-63 (F-AUTH-1) minted** — G1 cannot detect a bare write declaration governed by the global `optionalAuth` mount (§2.3).
- **44 write routes across 7 files carry no Step 3 disposition** and reach handlers with `req.user = null` on absent and rejected tokens (§1.1, §1.2).
- **`compositions.js` executed half of a dual CP7 instruction** — D20 preservation present, Tier 1 promotion absent (§1.3).
- **§5.71's closure withdrawn for the seven named files only**; G1's sufficiency as proof withdrawn program-wide (§2.4).
- **Keystone REOPENED-QUALIFIED** (§4.1). **Track G5 BLOCKED** (§4.2). **Tracks G3 and G4 pending re-validation** (§4.3).
- **Recorded:** `docs/audit/F-AUTH-1_Preflight_Run_2026-08-16.txt` is a dated evidence snapshot whose PE #51 and PE #52 baselines were set 2026-05-21, before CP12 closure. Its commit message names "Tier 3 at 48 routes across 8 files" and should not be read as a work list without §1.1's exclusion of `auth.js` and §6's tier disambiguation.

**Method note.** The reads at §1 were reached through a sequence in which eight prior hypotheses about this surface were formed and then falsified by direct file reads — a probe-script defect, a candidate-set filter gap, a verb miscount in a frontend inventory, a line-number transposition, a `// PUBLIC:` explanation, a router-preset explanation, an environment-gate explanation, and a mis-scoped reading of an F-Stats-1 coordinate. Each died on contact with the file. The finding recorded here is what survived that process, and its load-bearing claims are single-command reproducible against `5f79c634`. The failure mode in all eight was the same — asserting from a grep fragment before establishing what the artifact was for — and it is the same mode F-Stats-1 v1.59 §62.10 records as recurring.

---

# §8. What this revision does not do

- Does not ship code, change any unit disposition, or alter any PR state.
- Does not edit §5.71's body, or any prior revision's body. The withdrawal at §2.4 is additive-supersede.
- Does not disturb the sweep's touched-file results, handler counts, conversion counts, or test baseline.
- Does not evaluate a remedy for FD-63 (F-AUTH-1) (§2.3).
- Does not assert that files outside the eight share this shape. **Owed, unmeasured** (§2.4).
- Does not assert that the seven files were never opened during CP execution — only that no disposition is present in them (§1.2).
- Does not read the CP7 or CP9 surface reports; none exists on main (§3.3).
- Does not mint an XK. XK tail remains **XK-3**. Admission raised at §5, not decided.
- Does not mint a PE.
- Does not enter Track G4 or discharge any Track G3 clause.
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact.** Derived entirely from git against `origin/main` at `5f79c634`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-16. Main at `5f79c634`. Predecessor: v2.42.*
*Type: Keystone reopened-qualified + first FD mint by this series. Withdraws §5.71's closure for seven named files. Mints **FD-63 (F-AUTH-1)**. Tail: FD-63. XK tail: XK-3. Mints no PE. Ships no code. Blocks Track G5. No live database contact. [skip-automerge]*
