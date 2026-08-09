| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Six-step coordinated single-PR plan.* |
| --- |

**Document version**

v2.40 — §7 STATIC PRECONDITION SWEEP. Mints nothing. Ships no code. Changes no gate; Track G3 remains OPEN. Records a static precondition sweep of §7.3, §7.4, and §7.5 against origin/main at `22cb4b38`: all statically checkable preconditions pass. Confirms F34's disposition. Supplies the first direct evidence that sub-forms (b) and (c) were swept. Records two surface corrections. Closes the v2.39 §3.3 question on G4/G5/G6 staleness. Supersedes v2.37 on the gate-table G6 closure clause. Records a documentation gap in the G5/G6 failure paths without filling it. The CP12-G4 probe gap from v2.39 §2.4 is untouched and remains open. No PE, FD, or XK numbers minted. Derived entirely from git against origin/main at `22cb4b38`. No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP CLOSED at CP12 (see v2.37 §5.71 keystone closure marker). DEPLOYMENT TRACKS OPEN: Track G3 self-review (PARTIALLY DISCHARGED — blocked on the CP12-G4 probe gap, v2.39 §2.4) → Track G4 dev verification + soak → Track G5 prod cutover → Track G6 post-deploy soak. Track labels per v2.38 §2.2 forward definitions. Track G5 is gated on the prod freeze — a structural gate external to this keystone, not an F-AUTH-1 prerequisite.*

---

# §1. §7 static precondition sweep

## §1.1 What was done, and what it is not

v2.37 §7 is the Post-Deploy Verification Checklist, run on dev during Track G4 and again on prod after Track G5 cutover. Its assertions are behavioural — authenticated request 200, unauthenticated 401 — and require a running server.

Several §7 items nonetheless have a **static precondition**: whether the named route declares auth middleware at all. A route with no auth declaration on main cannot return 401 at G4. Checking those preconditions now costs nothing and surfaces failures a full deploy-and-soak cycle early — material, since v2.37's G4 failure path requires a fresh two-hour soak.

**This sweep does not discharge §7.** It establishes that the statically checkable items *can* pass. Every 200/401 assertion remains owed at Track G4.

Runtime-only, not attempted: **§7.1** (boot behaviour under valid, missing, and placeholder env vars), **§7.2** (optionalAuth error semantics, Cognito-unavailability simulation, 503 codes), **§7.6** (BookEditor `beforeunload`, frontend interceptor paths).

## §1.2 Method

For each named file, route declarations were listed from `origin/main` and inspected for `requireAuth` in the middleware chain. Where a file's route declarations span multiple lines, the file was read directly instead.

## §1.3 Results — §7.3 sweep (a)

Nine route files named in §7.3.

| File | Result |
|---|---|
| `storyteller.js` | PASS — no mutation route lacking `requireAuth` |
| `characterRegistry.js` | PASS — same |
| `careerGoals.js` | PASS — same |
| `uiOverlayRoutes.js` | PASS — same |
| `calendarRoutes.js` | PASS — same |
| `wardrobe.js` | PASS — same, covering the `:895` `/select` and `:970` `/purchase` routes §7.3 names |
| `evaluation.js` | PASS — same, covering the Stats-save route §7.3 names at `:587` |
| `franchiseBrainRoutes.js` | PASS — **11** mutation routes, every one declaring `requireAuth`. See §2. |
| `episodes.js` | Covered under §1.4 below |

**`franchiseBrainRoutes.js` is the only franchise-brain route file on main.** Its 11 mutation routes are: `POST /franchise-brain/seed`, `POST /entries`, `PATCH /entries/:id/activate`, `POST /activate-all`, `PATCH /entries/:id`, `DELETE /entries/:id`, `PATCH /entries/:id/archive`, `PATCH /entries/:id/unarchive`, `POST /ingest-document`, `POST /guard`, `POST /push-from-page`. The two AI POSTs — `ingest-document` and `push-from-page` — additionally carry `aiRateLimiter` at the canonical chain position (auth first, rate limit second), per the v2.37 §5.43 reference model.

## §1.4 Results — §7.4 sweep (b)

| File | Result |
|---|---|
| `outfitSets.js` | PASS — all 5 routes declare `requireAuth`; import present |
| `episodes.js` | PASS — the three episode-outfit routes (GET, POST, DELETE) each declare `requireAuth` after `validateUUIDParam` |

§7.4 names the `episodes.js` routes as lines 101, 109, and 117. The routes are identifiable by shape at a shifted offset; the line numbers in §7.4 are stale but the routes are covered. This revision does not restate corrected line numbers for them, because a line reference in a checklist is stale by design against a moving file.

## §1.5 Results — §7.5 sweep (c)

`episodeOrchestrationRoute.js` — **PASS.** `router.post('/generate-episode-orchestration', requireAuth, aiRateLimiter, ...)`. §7.5 gives the line as 135; it is at 130. See §4.

## §1.6 Probe limitation — on the record

The §7.3 batch sweep matched **single-line** `router.<verb>(` declarations and reported any such declaration lacking `requireAuth`. Six of the nine files were checked this way and returned nothing.

`episodes.js` uses a multi-line declaration style and was therefore read directly rather than swept. **A §7.3 file using that same multi-line style would report a false clean under the batch probe.** The six files in the batch were not individually read to rule this out.

Six-for-six silence is consistent with a swept codebase. It is not proof. A reader wanting certainty on those six should read them directly.

---

# §2. F34 — disposition confirmed

F34 was unauthenticated destructive writes on `/franchise-brain/*`. A hotfix was offered on 2026-05-01 and **declined** per Decision #34 to preserve audit discipline, on the recorded understanding that F34 closes automatically inside Step 3 sub-form (a). Audit handoff v8 §4.1 reaffirmed this; v2.37 §2 restates it: *"No separate F34 hotfix ships. The exposure window is being closed, not patched around."*

**Every mutation route on `franchiseBrainRoutes.js` now declares `requireAuth`** (§1.3). No route remains that permits the exposure F34 named.

This is a static confirmation. The 200/401 assertion at §7.3 — *"franchiseBrainRoutes.js all 10 mutation routes: authenticated 200, unauth 401. F34 closed"* — is still owed at Track G4. What this revision establishes is that the code no longer contains the exposure, not that the deployed behaviour has been observed.

---

# §3. Sub-forms (b) and (c) — first direct evidence

**Sub-form (b)** is routes with *no* auth middleware declared at all — `outfitSets.js`, and `episodes.js` at the routes §7.4 names. **Sub-form (c)** is explicit `optionalAuth` on mutation routes — `episodeOrchestrationRoute.js`.

The CP12 verification greps could not reach sub-form (b). A probe searching for `optionalAuth` cannot match a route that declares no middleware; the absence is structurally invisible to it. CP12-G1 through CP12-G6, and the five-of-six re-run recorded at v2.39 §1.2, therefore carry **no evidence either way** about sub-form (b).

§1.4 and §1.5 supply that evidence: all five `outfitSets.js` routes, all three named `episodes.js` routes, and the `episodeOrchestrationRoute.js` route declare `requireAuth` explicitly.

**This is the first direct evidence in the register that sub-forms (b) and (c) were swept.** Static only; the runtime assertions remain owed at G4.

---

# §4. Surface corrections

Two corrections to v2.37 §7 text, recorded per the v2.37 §5.50 surface-correction discipline. Both are within the routine band; neither indicates a defect.

| §7 text | Observed at `22cb4b38` |
|---|---|
| §7.3 — franchiseBrainRoutes.js "all 10 mutation routes" | **11** mutation routes |
| §7.5 — episodeOrchestrationRoute.js ":135" | Route declared at **:130** |

Neither changes any gate. The §7 checkboxes remain unchecked.

---

# §5. v2.39 §3.3 — CLOSED

v2.39 §3.3 left open whether the gate-table G4, G5, and G6 rows carry the same staleness v2.39 §3.1 found in the G3 row, on the reasoning that *"their wording predates the program's expansion by the same margin."*

**Assessed and closed. They do not.** The margin is not what matters.

The G3 row broke because it named an **artifact the program never produced**: *"every commit in the PR read end-to-end"* presupposes a single PR. F-AUTH-1 shipped as 12 backend CPs plus one Track 7 mini-CP across 38 pushes. The phrase has no referent.

The G4, G5, and G6 rows name no delivery artifact. They describe **deployed behaviour**: deploy backend to dev, boot-test under three env-var conditions, run the §7 checklist, exercise a two-hour soak; deploy to prod and exercise six named surfaces for thirty minutes; leave the server up overnight and re-exercise. A one-PR program and a twelve-CP program produce the same deployed artifact, so this wording reads identically either way.

**The G3 staleness was specific to that row's dependence on delivery shape, not systemic to the gate table.**

The §1 static sweep does not bear on this. §1 verified route declarations; this section assesses gate-row wording. They are independent.

---

# §6. Gate-table G6 closure clause — SUPERSEDED

Per additive-supersede: v2.37's body is frozen and is not edited. The clause below remains in v2.37 as evidence.

The gate-table **G6 row** reads, in part: *"If clean, declare F-AUTH-1 closed. Tier 1 fix queue (F-App-1, F-Stats-1, F-Ward-1, F-Reg-2, F-Ward-3, F-Sec-3, F-Franchise-1) is now unblocked."*

That describes a blocking relationship **v2.38 §1.3 superseded**. Option A ratified that keystones whose work does not ship mutation routes onto an unauthenticated surface may proceed in parallel with F-AUTH-1's open deployment tracks. F-App-1 shipped 2026-05-14; F-Stats-1 Phase B is live at v1.31. Neither waited for G6, and v2.38 ruled that correct.

**Forward: the queue is not gated on G6.** Per-keystone adjudication under v2.38 §1.3 governs. Keystones that *do* ship mutation routes onto an unauthenticated surface remain bound by Tier 0 precedence and must verify against the CP12-G1 condition.

The rest of the G6 row — overnight soak, morning re-exercise of the G5 surfaces — stands unaffected.

---

# §7. G5 and G6 failure paths — GAP RECORDED, NOT FILLED

v2.37 documents failure paths for G3 and G4 explicitly: *"G3 fails — self-review found a bug or a missing test. Return to G2,"* and for G4, a diagnosis path with the requirement that a fresh two-hour soak run in full, with an explicit instruction not to partial-credit an interrupted soak.

**G5 and G6 have no stated failure path.** G5 is the prod cutover. If the thirty-minute exercise surfaces a problem, v2.37 does not say what happens — no rollback procedure, no revert target, no criterion for abandoning versus proceeding.

This matters more than a documentation gap normally would, because **prod is FROZEN**. A rollback on a frozen prod is not a mechanical revert; it is a second unplanned prod-touching action taken under time pressure after a failure.

**This revision records the gap and does not fill it.** A rollback procedure for a frozen prod is a decision with its own gate, not documentation cleanup. Same posture as CP12-G4 at v2.39 §2.2: naming a gap is honest; inventing a procedure to close it is not.

**What is owed:** a revision that either states G5/G6 failure paths, or records an explicit decision that G5 proceeds without one.

---

# §8. CP12-G4 probe gap — UNCHANGED

The CP12-G4 probe gap recorded at v2.39 §2.4 is untouched by this revision. No canonical probe is supplied, none is guessed, and no waiver is offered.

**Track G3 remains OPEN on that ground and on v2.39 §1.3's unattempted clauses.**

---

# §9. What this revision does not do

- Does not ship code, change any unit disposition, or alter any PR state.
- Does not change any gate. **Track G3 remains OPEN; Track G4 is not entered.**
- Does not discharge §7. Every 200/401 assertion remains owed at Track G4.
- Does not attempt §7.1, §7.2, or §7.6 — runtime-only.
- Does not supply, guess at, or run a probe for CP12-G4.
- Does not supply a G5 or G6 failure path (§7).
- Does not re-audit CP1–CP12 disposition judgments.
- Does not mint PE, FD, or XK numbers.
- Does not claim or open a prod window.
- **No live database contact.** Derived entirely from git against origin/main at `22cb4b38`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `22cb4b38`. Predecessor: v2.39.*
*Type: §7 static precondition sweep. Supersedes v2.37 on the gate-table G6 closure clause. Closes v2.39 §3.3. Mints nothing. Ships nothing. Changes no gate.*
