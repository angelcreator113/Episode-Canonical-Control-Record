| **PRIME STUDIOS** **F-AUTH-1 — S1-B: AN ACCEPTED OR FILMED EPISODE TAKES NO AUTOMATIC PRODUCTION WRITE (AMENDMENT)** *A re-plan, a beat save, a beat→scene synchronisation, Start Episode, Resume setup and the export's own sync all wrote freely on an accepted or filmed episode. Each now decides the freeze under the episode's `FOR UPDATE` and refuses with its own 409, and Start and Resume put the plan rows and the scene rows in one caller-owned transaction that commits or rolls back together. This file records the merged baseline, so the work that follows it has something to conform to.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged. Re-derived at the basis, not carried:
  - `grep -rhoE 'FD-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `FD-70`; `grep -roE 'FD-70' docs/audit/ | wc -l` → `194`
  - `grep -rhoE 'XK-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `XK-4`
  - `grep -rhoE 'PE-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `PE-69`
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `d4c1c57858194705b8a3025d5bb9fbf25b86ede7` (2026-11-26), the squash merge of PR #3943. Every `file:line` below is at that SHA unless it says "at the pre-merge base", which is `30722668f01c93a169116bb93ebc57596f9769cc`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment. It records decisions Evoni already made and a change already merged; it rules nothing new. Merging this file is her approval of the text as the record.  It is **not** an authorization to deploy (§7).

**Standings used:** RULED (§2, her decisions as given to the work); MEASURED (the repository reads of §1, §3, §4 and §5, and the test runs of §6, each with its command or its `file:line` at a stated SHA); INFERRED (marked where used).

**Follows:** `F-AUTH-1_SceneSetDeleteLockOrder_Amendment_2026-11-24.md` (C1, the delete path's lock order, which this change does not invert) and `F-AUTH-1_ReferenceWritersSetLiveness_Amendment_2026-11-24.md`, whose **§5a** left Writer 8 open as an unresolved reference-liveness dependency. §9 below states which of §5a's terms this baseline has overtaken, and why.

---

# §1. What was there (MEASURED at the pre-merge base `30722668f`)

| Path | How it wrote on an accepted or filmed episode |
|---|---|
| Re-plan (`generateScenePlan`, `src/services/scenePlannerService.js`) | No freeze check. The paid model call ran, then the rows were saved. |
| The beat save (`PUT` beat, `src/routes/episodeBriefRoutes.js`) | The only accepted check lived inside `linkBeatSet` and was reached **solely** under `if (updates.scene_set_id)`. A save of just `director_note`, `shot_type`, `emotional_intent`, `transition_in` or `chosen` went through untouched. |
| `syncBeatScenes` (`src/services/beatScenesService.js`) | No freeze check at all; a direct caller could not be stopped. |
| Start Episode and Resume setup (`src/services/episodeGeneratorService.js`) | `createScenePlanRows` ran **after** Start's main transaction had committed, in autocommit, holding neither the episode nor the event; the beat→scene sync ran separately afterwards. Neither asked whether the episode was accepted or filmed. |
| The export's own sync | Inherited `syncBeatScenes`, so it wrote too. |

**And nothing checked *filmed* at any of them.** `accepted` was read in one place; the existence of raw footage was read in none.

# §2. The decisions (RULED)

Evoni's rulings, as given to this work across 2026-11-25 and 2026-11-26:

1. **Complete freeze coverage.** Every automatic production write path is covered; Start and Resume are not excluded.
2. **Definitions are reused, not redefined.** `accepted` is `episodes.evaluation_status = 'accepted'`. `filmed` is the existing `frozenEpisode.filmedAt` — **any** `episode_raw_clips` row, soft-deleted clips included.
3. **No new mechanism.** No migration, no new column, no status field, no second freeze mechanism, no new permission system, no duplicate status logic.
4. **Option B for Start and Resume:** the episode is taken `FOR UPDATE` at the transaction's entry and the freeze is decided under that lock. *"Do not ship a caller-level check-then-write solution with a known TOCTOU window."*
5. **Codes.** `EPISODE_FROZEN` for the planning paths. The beat save keeps the `EPISODE_ACCEPTED` it has answered since L11. `EXPORT_SCENES_UNVERIFIED` keeps its meaning. `EPISODE_SNAPSHOT_FROZEN` keeps its delete and relink meaning.
6. **Resume's refusal is its own 409**, with nothing persisted — *"Do not silently replace a frozen refusal with HTTP 200"*, and not a 500 carrying service text either (2026-11-26).
7. **Atomicity.** The plan rows and the scene rows commit or roll back together. A failed statement must not leave half of each.
8. **Filming is never refused.** An attach may wait for the planner; it is not turned away.
9. **Test synchronisation may be corrected; test guarantees may not.** *"Do not weaken the freeze guarantee, remove meaningful assertions, increase timeouts to conceal contention, or introduce a second freeze mechanism."* Where a merged suite's commit-signal gate had to move, *"B3's original safety guarantees must not weaken"* — only the trigger may change, and only on separate authorization.

# §3. What the change does (MEASURED at the basis)

## The two helpers the whole change rests on

- `episodeFreeze(sequelize, episodeId, { transaction })` — `src/utils/frozenEpisode.js:179`. One statement reads `evaluation_status` and `MIN(created_at)` over `episode_raw_clips`, and it **takes a transaction**, so the answer is read under whatever lock the caller holds. Returns `{ frozen, accepted, frozenAt }`.
- `frozenWriteRefusal(episodeId, freeze, what, { acceptedCode })` — `:201`. Builds the existing `FrozenEpisodeError` (`:25`, status 409, `toJSON()`, never retryable), choosing the narrower code when the episode is accepted and the caller asks for one.

`filmedAt` (`:50`) is unchanged and remains the authoritative filmed definition.

## Where each guard sits

| Path | Citation at the basis | Behaviour |
|---|---|---|
| Re-plan, early | `scenePlannerService.js:136-137` | Refuses **before the model call**, so a frozen refusal costs nothing. This read is explicitly **not** the decision. |
| Re-plan, the decision | `:432-437` | `lockEpisodes(planDb, [episodeId], { transaction, mode: 'update' })`, then `episodeFreeze` under it, then the refusal. |
| The beat save | `episodeBriefRoutes.js:541-550` | `mode: 'update'` at transaction entry, then the freeze, **before any field is written, for every supported update** — not only a set change. 409 `EPISODE_ACCEPTED` when accepted (`acceptedCode`), else `EPISODE_FROZEN`. The catch maps the refusal at `:563`. |
| `syncBeatScenes` | `beatScenesService.js:277`, `:292` | Checks **internally**, under its own episode lock, so a direct call cannot get round it. Frozen is `held` — never `failed` — with no new reason code, which is why the export's failure branch cannot misfire and `export.js` needed no change. `OUTCOMES` (`:79`) is byte-unchanged. |
| Start and Resume | `episodeGeneratorService.js:260-271` | `planAndSyncUnderEpisodeLock`: one `inEpisodeFirstTransaction`, `lockEpisodes(… mode: 'update')` at `:266`, `episodeFreeze` at `:267`, the refusal at `:268`, the plan rows at `:269` and `syncBeatScenes(… { transaction })` at `:270` — **one unit**. Called at `:1098` (Start) and `:448` (Resume). |
| Resume's route | `episodeBriefRoutes.js:783` | Maps the refusal to **409**, nothing persisted. Before this it fell into the generic catch and answered 500 with the service's message. |

## The transaction, threaded end to end

`createScenePlanRows(episode, event, models, locations = null, { transaction = null } = {})` — `:275`. All four of its database touchpoints join the caller's transaction: the home-sets read (`:294-298`), the existing-beats read (`:313-315`), `loadSetAngles(models.sequelize, …, transaction)` (`:338`, which already took one) and the per-beat `INSERT INTO scene_plans` (`:350-357`).

`syncBeatScenesQuietly(sequelize, episodeId, where, { transaction })` — `beatScenesService.js:362` — gained the fourth parameter and forwards it, so the sync **joins** the caller's transaction (`utils/episodeLocks.inTransaction`, `:114`, joins and never nests) or opens its own exactly as before when none is given.

# §4. Transaction boundaries and response contracts

- Start's main transaction and its commit are **unchanged**. The unit runs after it, as the plan rows always did; what changed is that the plan rows and the sync are now one transaction instead of autocommit plus a separate call.
- Resume refuses **before `setup_status`**, so a refused Resume writes no status either. That is deliberate: a status write is still a write.
- `scenePlanStep` (`:384`) keeps its shape and gains `sync`: `complete` is downgraded to `partial` when the sync reports `unresolved` or `failed`, so a committed Start is never described as complete when the work it needed did not happen — and never as rolled back either.
- Every other success body, reason code and refusal is as it was.

# §5. Locking (MEASURED)

`FOR UPDATE` is taken **at the transaction's entry**, never `FOR SHARE` then upgraded — `lockEpisodes` permits the upgrade (`episodeLocks.js:63`, `MODES` at `:28`, `LOCK_TIMEOUT` `'10s'` at `:27`) and two transactions doing it at once is a deadlock.

**Why `FOR SHARE` was not enough (MEASURED, two real connections):** with `FOR SHARE` on the planner's side, a first raw clip's attach was **not** blocked, committed while the planning transaction was still open, and the plan landed on a just-filmed episode. `attachClip` takes the episode `mode: 'share'` (`src/services/rawClipsService.js:336`) and holds the only `INSERT INTO episode_raw_clips` in `src/` (`:358`), so share against share does not serialize. With `FOR UPDATE` the attach blocked and then committed: **filming waits, and is never refused** (§2.8).

An acceptance already took `SELECT … FOR UPDATE` on the episode (`src/services/episodeCompletionService.js:542`) and re-checks `evaluation_status` under it, so it was always excluded.

Episode-first order is unchanged, and the C1 delete path's order is not inverted. **No model call runs under the lock:** there is no provider call in `createScenePlanRows`, `beatScenesService` or `planLocationsService`, and Start's feed-moment generation stays outside the unit. The unit held `FOR UPDATE` for **19 ms across 32 statements** in the measured run.

# §6. Tests (MEASURED)

Two new suites, **49 cases**, each count from its own run at the basis (`npx jest <file> --runInBand`, `Tests:` line): `tests/integration/frozenEpisodePlanning.integration.test.js` (291 lines, **41** — accepted / filmed / both / draft against every path, every beat-save field, a direct sync held, Resume refusing before `setup_status`, reads still available, a valid export still 202 and an incomplete one still 409, byte-identical snapshots) and `tests/integration/frozenEpisodeConcurrency.integration.test.js` (323 lines, **8**, two real connections with the blocking observed in `pg_stat_activity`). PR #3943's own description says 9 for the second suite; 8 is what the suite runs, and this file is the measurement.

**Rollback, proven properly.** The unit writes plan rows for the missing beats, then the sync's read blocks on a scene row a second connection holds, so the failure lands *after* those writes. Asserted: `status: 'failed'`, `created: 0`, `sync.outcome: 'failed'` with `sync_failed_retryable`, every canonical beat still missing; the rows the unit wrote are gone, each absent beat checked by number; and the pre-existing plan rows and scenes **byte-identical**, not merely equal in number.

**A swallowed per-beat INSERT commits nothing.** `createScenePlanRows` catches each beat's INSERT and carries on, but inside one transaction PostgreSQL aborts on the failed statement, refuses every later one with `25P02`, and discards the lot at COMMIT. Measured: **zero rows survive, not even the beat that inserted cleanly.** There is no partial-commit defect.

**Two merged gates were re-latched, on separate authorization (§2.9), and no assertion, expected response, timeout or lock-order requirement was changed.** Both were dead gates that timed out rather than failing an assertion, and neither is a production defect:

- `placeLockGenerationB3`'s `staleStart` now gates on **Start's own main transaction commit** — its race needs the event to move *before* any beat exists. MEASURED before `resume()`: the pre-merge base left beats 10–12 at the older set; with the unit in place all fourteen already existed, so the event edit's own location sync migrated them and the stale race never happened.
- `sceneSetDeleteLockOrder`'s `startSavingLocations` now gates on **the unit's COMMIT** — its race needs the beats present with the unit's locks released. MEASURED, same database, code the only variable: base **77/77 in 19.0 s**; before the fix **1 failed at 90 016 ms**, 76 passed, 104.0 s. Both of its races were then observed blocking on a real lock (`PR1_OBSERVED_FILE`: `how blocked`, `errors []`, second answer `409 STALE_SOURCE_SET`).

Opposite boundaries for the two gates, because the two races need opposite states. That is the whole of the change to either file.

**CI on the merged head** (`a942e6abc`, run `45823211264`, job `139920553878`): `Test Suites: 1272 passed, 1 skipped of 1273`; `Tests: 17452 passed, 49 skipped of 17501`; **zero failures**; 2880 s. All seven required checks green. Network guard: canaries verified, 0 unexpected external attempts.

**Local, at the head** (`--runInBand`, PostgreSQL 16; CI uses 15): `sceneSetDeleteLockOrder` 77/77; the nine lock-ordering suites 400/400; the seven freeze, episode-first and resume suites 154/154; `beatPlanChosen` 6/6.

# §7. What was not run, and what is not claimed

- **Nothing was deployed.** `main` carries this code; production does not. This file is not an authorization to deploy.
- No migration, no schema change, no production access, no paid provider call.
- The local runs were on PostgreSQL 16; CI's `Tests` job is PostgreSQL 15 and its `A2 constraints` job PostgreSQL 17. All three were green.
- The 19 ms lock duration and the 32-statement count are one measured run, not a bound.
- No claim is made that the freeze is complete against *manual* writes. This change covers the **automatic production write** paths of §1 and nothing else.

# §8. What this does NOT do

- **There is no per-episode correction workflow for a frozen episode.** The only reopen clears `evaluation_status`, `evaluation_json`, `formula_version` and `status` for **every** episode of the show, and nothing unfilms anything. An episode frozen in error is a problem this change does not solve; it is recorded, not fixed.
- **Atomicity changed what a bad beat costs.** It used to lose only itself, because each INSERT was its own implicit transaction; inside the unit it now loses the whole unit, and `failedBeats` reporting is moot there. That is the price of §2.7, accepted knowingly.
- A valid export of a frozen episode still succeeds and an incomplete one is still refused `EXPORT_SCENES_UNVERIFIED`. Nothing is repaired to make it pass.
- `scene_plans.episode_brief_id` is still never populated; `has_saved_work` is still near-constantly true; `sceneLinks.js:24-31`'s column reversal, the name-guarded duplicate index in `20261002160000-add-scenes-scene-plan-id.js:35-38`, and `scene_number_conflict` being reported but not resolved all stand. Recorded here, unfixed.
- **Set liveness is not closed.** Start's plan rows can still name a Scene Set that was removed while the episode was being set up. That is Writer 8, below.

# §9. The baseline Writer 8 must conform to, and what this overtakes in §5a

`F-AUTH-1_ReferenceWritersSetLiveness_Amendment_2026-11-24.md` **§5a** removed Writer 8 from PR 3 and set out its plan. Two of its terms have been overtaken — recorded here rather than by editing it, because the register is append-only:

| §5a said (2026-11-24) | What now holds |
|---|---|
| Writer 8 gets **its own short transaction**, the episode `FOR SHARE`, **a SAVEPOINT per beat**. Its own text offered the alternative: *"move the call **inside** Start's transaction, which would hold the event and the episode already — a larger change to Start's commit boundary, and the reason it is not the default proposal."* | S1-B **took that alternative** and merged it. The call is now inside a caller-owned transaction holding the episode `FOR UPDATE`. An independent nested transaction cannot join it — `inEpisodeFirstTransaction(sequelize, work)` (`src/services/eventPlaceSync.js:196`) takes no transaction and calls `sequelize.transaction(work)` unconditionally — so a nested one would block against the caller's own lock. Evoni's ruling of **2026-11-26** drops the per-beat SAVEPOINTs: a database statement failure rolls back the whole plan-and-scenes unit, and the existing Resume retry is the recovery. |
| The removed-set beat: *"A set that went is **omitted** from its beat, Start's existing answer"* — the beat written, with no set. | Evoni's ruling of **2026-11-26**: the beat is **not written at all**, no `NULL` and no other set is substituted, and the beat is reported with its own reason. Unrelated valid beats are still created in the same successful transaction, and the setup step stays incomplete until every required beat is resolved. |

§5a's third item — the B3 commit-signal gates, *"only if separately authorized"* — was separately authorized and is discharged in §6.

**The contract any Writer 8 integration must preserve**, all citations at the basis:

1. The transaction is the **caller's**: `createScenePlanRows` accepts `{ transaction }` (`:275`) and must not open one.
2. The episode is held `FOR UPDATE` by `planAndSyncUnderEpisodeLock` (`:266`) and the freeze decided under it (`:267-268`). Neither may be removed or weakened to `FOR SHARE`.
3. The plan rows and the sync stay **one unit** (`:269-270`); the sync is not duplicated outside it.
4. All four touchpoints keep the transaction (`:294-298`, `:313-315`, `:338`, `:350-357`). Three of the four are rewritten or removed by the held Writer 8 commit, so this is where the protection regresses **silently** if it is not re-threaded: the signature there takes no options parameter, and JavaScript discards the extra argument without error.
5. `scenePlanStep`'s reporting (`:384`) keeps `sync`, `missing`, `failed` and its completion status.
6. The bounded retry (`eventPlaceSync.js:196`, `PLACE_FINALIZE_MAX_ATTEMPTS`) and the C1 lock order are reused, not replaced.

Writer 8 is held, unmodified, at `aca9790e6ebc8be661b309dfbbb6cbb9f607e9b9`. It was not imported, rebased or cherry-picked for this change. **Its code cites `docs/audit/F-AUTH-1_StartPlanRowsSetLiveness_Amendment_2026-11-25.md`, which does not exist on any ref** — `git log --all --diff-filter=A -- "docs/audit/*StartPlanRowsSetLiveness*"` is empty at the basis. §5a was and is the authority; that citation must be corrected when the work lands.

---

**Type:** amendment (record of a merged change and the decisions behind it).
**Rules:** nothing. **Mints:** nothing. **Discharges:** §5a's third item (the B3 commit-signal gates).
**Host/AWS/DB/Cognito contact (this session):** none.
**Production standing:** Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1, as restated by `F-Deploy-1_Fix_Plan_v1.56.md`); agent sessions' production access is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`, not by the freeze standing.
