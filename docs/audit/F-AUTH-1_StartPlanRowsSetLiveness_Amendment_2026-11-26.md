| **PRIME STUDIOS** **F-AUTH-1 — WRITER 8 / START'S PLAN ROWS NAME LIVE SCENE SETS, INSIDE S1-B'S UNIT (C2, AMENDMENT)** *Start Episode's and Resume setup's plan rows were written holding no set row, so a Scene Set delete that committed in between left the beat naming the removed set. The beats now take every set they name live-only and NOWAIT inside S1-B's caller-owned transaction, after the episode's `FOR UPDATE` and its freeze check; a beat whose selected set has gone is not written and not substituted, and is reported as unresolved while every unrelated beat is created in the same successful transaction. Writer 8's own transaction, its `FOR SHARE` lock and its per-beat SAVEPOINTs are not integrated.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged. Re-derived at the basis, not carried:
  - `grep -rhoE 'FD-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `FD-70`; `grep -roE 'FD-70' docs/audit/ | wc -l` → `196`
  - `grep -rhoE 'XK-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `XK-4`
  - `grep -rhoE 'PE-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `PE-69`
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `8c83530a49ee1a435af454aa518a4bf248cc65d7` (2026-11-26), plus branch `claude/w8-start-plan-rows-set-liveness`. Every `file:line` below is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's rulings of 2026-11-26. Merging this file with the change it describes is her approval of the text. It is **not** an authorization to deploy (§7).

**Standings used:** RULED (§2); MEASURED (the repository reads of §3 and §4 and the test runs of §6, each with its command or `file:line`); INFERRED (marked where used).

**Follows:**
- `F-AUTH-1_S1B_FrozenEpisodeProductionWrites_Amendment_2026-11-26.md` — **the architectural authority.** Its §9 states the contract this change had to conform to, and names this work as what must follow.
- `F-AUTH-1_ReferenceWritersSetLiveness_Amendment_2026-11-24.md` **§5a**, which removed Writer 8 from PR 3, pinned the defect as `RECORDED GAP (W8, UNRESOLVED)` and set out its plan. Two of its terms were overtaken; the S1-B amendment's §9 records that, and §2 below restates it.

**A citation that does not resolve.** The held Writer 8 branch (`aca9790e6`) carries a code comment citing `docs/audit/F-AUTH-1_StartPlanRowsSetLiveness_Amendment_2026-11-25.md`. **That file exists on no ref** — at the basis, `git log --all --diff-filter=A -- "docs/audit/*StartPlanRowsSetLiveness*"` is empty. §5a was and is the authority. The integrated code carries no such citation; this file, dated 2026-11-26, is the record.

---

# §1. What was there (MEASURED at the basis)

`createScenePlanRows` ran inside S1-B's caller-owned transaction under the episode's `FOR UPDATE`, but it **held no set row**. The sets were last read when the locations were resolved, in a different statement and sometimes a different transaction. A Scene Set delete that committed in between left the beat naming the removed set: the foreign key on `scene_plans.scene_set_id` is satisfied by the soft-deleted row, and nothing waited for it.

`referenceWritersSetLiveness.integration.test.js` carried this as `RECORDED GAP (W8, UNRESOLVED)`, a case that **asserted the defect** — at least one returned row and one committed row naming the removed set — and said in the same breath that no other writer may add to that set.

Two paths reached it differently, which matters for §4:
- **Resume** reads its locations through `episodeLocationsService.listLocations`, whose statement joins `scene_sets s ON s.id = l.scene_set_id AND s.deleted_at IS NULL` (`:148` at the basis). A set already removed is therefore **absent from the episode's Locations**, and those beats were written with no set at all.
- **Start** takes its locations from the request, validated earlier, so a set removed between that validation and the inserts **was still named** — the live case for the liveness pass.

# §2. The decisions (RULED)

Evoni's rulings of 2026-11-26, as given to this work:

1. **A caller-provided transaction is required** for `createScenePlanRows`.
2. The caller's episode **`FOR UPDATE`** and its **freeze checks** are preserved.
3. Writer 8's live-set protection is integrated **through the existing `holdLiveSets`**.
4. **Episode-first, ascending** set locking and **NOWAIT** behaviour are preserved.
5. A removed set is **rejected**, with no silent substitution of `NULL` or another set.
6. The existing **plan-and-scene transaction atomicity** is preserved.
7. Writer 8's **independent transaction, weaker `FOR SHARE` lock and per-beat SAVEPOINTs are removed.**
8. The existing **transaction-aware scene synchronisation** is reused.
9. **Incomplete setup reporting and Resume recovery** are preserved.
10. **No duplicate locking, retry or freeze system** is introduced.

Superseding §5a of 2026-11-24, as the S1-B amendment §9 records: its default proposal was Writer 8's *own* short transaction with the episode `FOR SHARE` and **a SAVEPOINT per beat**; S1-B took the alternative §5a itself offered ("move the call inside Start's transaction"), and ruling 7 drops the savepoints. And §5a said a set that went would be **omitted** from its beat; ruling 5 replaces that — the beat is not written at all.

# §3. What the change does (MEASURED on the branch)

## The transaction is the caller's, and required

`createScenePlanRows(episode, event, models, locations = null, { transaction = null } = {})` (`src/services/episodeGeneratorService.js:280`) throws when it is called without one (`:289`). Required, not defaulted: the set rows held below would be released as each statement ended, so the liveness guarantee would be decorative, and the plan rows could not roll back together with the scene rows. The only production caller is `planAndSyncUnderEpisodeLock` (`:265`), which holds the episode `FOR UPDATE` (`:271`), decides the freeze under it, and runs `syncBeatScenes(..., { transaction })` (`:275`) in the same transaction — all unchanged by this work.

## Every set the missing beats name is held, live-only and NOWAIT

`:381-391`. The distinct set ids the **missing** beats would be placed at are resolved through `placeBeat`, then taken with the existing `holdLiveSets` (`src/services/eventPlaceSync.js:180`, which sorts the ids itself and delegates to `holdLiveSet`, `:161`, whose statement is `SELECT id FROM scene_sets WHERE id = :id AND deleted_at IS NULL FOR KEY SHARE NOWAIT`). Each pass asks only for the ids not already known to be gone, so every live set ends held and every removed one is named. The episode is already held, so NOWAIT is the correct choice by `holdLiveSets`' own rule, and a set row is never waited for while an episode row is held — the delete path's order (C1), uninverted.

## A removed set is refused, not substituted

`:407-410`. A beat whose placed set is in the gone set is **not inserted**: it is recorded in `failedBeats` with `REMOVED_SET_BEAT_REASON` (`:24`) and the loop moves on, so every unrelated beat is still created in that same successful transaction. Nothing is turned into a locationless beat and nothing is moved to another set. A beat with **no location at all** remains a different case and is still written with no set, exactly as before.

## Four cases, kept apart

| condition | how it is told apart | result |
|---|---|---|
| the set was removed | `holdLiveSet` answers **false** — the live row is not there | the beat is unresolved with its reason; the others commit |
| the set row is held by another transaction | a live row raises **`55P03`** (or `40P01`) — never a false answer | the whole unit is left to the caller's bounded retry |
| retries exhausted | `RetryableConflictError` after `PLACE_FINALIZE_MAX_ATTEMPTS` in `inEpisodeFirstTransaction` (`eventPlaceSync.js:196`) | nothing written; the step is not complete |
| any other statement failure | the transaction aborts | the **whole** plan-and-scenes unit rolls back |

**A lock conflict is therefore never read as a removal.** No new retry, locking or freeze mechanism was added: the bounded retry is the Place finalizer's, already there.

## What is NOT integrated

Writer 8's `inEpisodeFirstTransaction` **inside** the function (it takes no transaction and calls `sequelize.transaction(work)` unconditionally, so it could not join the caller's and would block against the caller's own lock), its `lockEpisodes(..., mode: 'share')`, and its per-beat `SAVEPOINT` / `RELEASE` / `ROLLBACK TO SAVEPOINT`. Writer 8's branch was **not** imported, rebased or cherry-picked; it stays at `aca9790e6`.

# §4. Reporting, and recovery

`scenePlanStep` is unchanged. An unresolved beat appears in `failed` with its reason and in `missing`, so the step reads `partial` (or `failed` when nothing exists) and `setup_status.complete` is false — the setup stays incomplete until every required beat is resolved. A rolled-back unit is reported by the callers exactly as before: `scenePlanRows: []`, a failed sync, and the step not complete. **Resume then makes the beats that are still missing**, because the function only ever inserts `missing` ones; the beats already there are left alone.

# §5. Why B3 now distinguishes planning locks from the locations finalization

`placeLockGenerationB3.integration.test.js:1280`. One merged assertion counted **every transaction that locks a `scene_sets` row** and required exactly one — a faithful proxy for "the locations finalization was tried once, not retried" only while the finalizer was the single writer taking set rows. Since this change the **plan unit holds set rows too**, so that count read 2 and the case failed.

The filter now identifies the finalization by **what it holds** — the event row *and* the set rows together, which only the finalizer takes — rather than by how its SQL is written. MEASURED from the trace: the plan unit takes `episodes FOR UPDATE`, the freeze read, then each named set `FOR KEY SHARE NOWAIT`, then the `scene_plans` inserts, and **never locks `world_events`**; the finalization takes `episodes FOR SHARE`, `world_events FOR UPDATE`, then the set rows. The two are separable by their locks alone.

**Nothing was weakened.** The expected count is still exactly one; the lock-order, response-code precedence, retry (`expect(pause).not.toHaveBeenCalled()`), deadlock (`expect(lockErrors(trace.records)).toEqual([])`) assertions and every timeout are untouched. The case was **strengthened**: it now also asserts that the planning transaction is present, holds set rows, holds no event row, carries the `scene_plans` inserts, and is a different transaction from the finalization — so a filter that matched nothing, or matched the plan unit instead, could no longer satisfy the count.

# §6. Tests (MEASURED, `--runInBand`, PostgreSQL 16; CI uses 15)

| suite | result |
|---|---|
| `startPlanRowsSetLiveness` (**new**, 13 cases) | **13/13**, 32.9 s |
| `referenceWritersSetLiveness` | **54/54**, 36.3 s |
| `placeLockGenerationB3` | **60/60**, 9.1 s |
| B1, B2, B3, `sceneSetDeleteLockOrder`, `lockOrderMatrix`, `lockOrderTrace`, `placeLock`, `placeLockFinalizer`, `placeLockStrict` | **423/423**, 91.1 s |
| `startPlanRowsSetLiveness`, `frozenEpisodePlanning`, `frozenEpisodeConcurrency`, `eventWritersEpisodeFirst`, `episodeLocations`, `eventPlaceSync`, `setupResume`, `beatPlanChosen`, `startTransaction`, `scenePlanGuard` | **181/181**, 83.3 s |

The new suite proves: a removed set takes no new beat reference on Start's path, with the beat named and the others committed; the same invariant on Resume, by the Locations read that drops it; a locationless beat still written with no set; **a live set row held by another transaction is never reported as removed** — the unit loses to the lock, writes nothing, and the very next resume makes every beat; an accepted and a filmed episode each refused 409 `EPISODE_FROZEN` **before any set row is taken**; the freeze answering ahead of the removed set, so response precedence is unchanged; a first raw clip holding the episode `FOR SHARE` is **not** refused, and the unit that waited for it then reads the episode as filmed and refuses; a **real** statement failure rolling back every row the unit wrote with the prior beats and scenes byte-identical, then recovering; the lock order episode-first then sets ascending, live-only and NOWAIT, with the plan rows and scene rows in one transaction; and the no-transaction refusal writing nothing.

**Mutation-checked.** With the removed-set pre-check deleted, the Start case fails. The rollback case uses a real failure — another connection holds one of the episode's `scenes` rows, so the sync is cancelled by the 10 s lock timeout. An **injected mock rejection was tried first and proved nothing**: the statement never reaches PostgreSQL, the transaction is never aborted, and the swallowed per-beat catch lets the rest commit. That is recorded because it is the difference between a test that proves atomicity and one that only appears to.

The unit suite's six direct calls now pass the caller's transaction as a sentinel token, and the double was changed so the token cannot be vacuous: the suite asserts the token reached **every** statement, and the set-liveness read is told apart from the home-set lookup (`FOR KEY SHARE`) so a removed set can be modelled instead of every set reading live.

Validation block, all exit 0: `validate-routes`, `lint-silent-catches`, `audit-cost-exposure`, `check-root-junk`; schema agreement `0 new`; step 2 ratchet `0 new`. `eslint` clean on all five changed files.

# §7. What was not run, and what is not claimed

- **Nothing was deployed.** No migration, no schema change, no production access, no paid provider call. This file is not an authorization to deploy.
- `npm test` whole was not run locally; the CI `Tests` job on the pull request is the evidence.
- The local runs were on PostgreSQL 16. CI's `Tests` job is 15 and its `A2 constraints` job 17.
- The hold is `FOR KEY SHARE`, which keeps a set row from being removed while the beats are written. It does **not** make the beat's placement correct for any other reason, and it says nothing about a set removed before the locations were chosen.

# §8. What this does NOT do

- **It does not recover existing orphan references.** A beat that already names a removed set, written before this change, is left as it is. Nothing in this work repairs history.
- **The W7 divergence stands, deliberately.** `scenePlannerService.generateScenePlan` saves such a beat with no set, while Start and Resume now refuse to write it. Writer 8 recorded that divergence as intentional; it is recorded here because the document it cited does not exist.
- **`failedBeats` now carries two meanings:** "the INSERT failed" and "intentionally not attempted". Both appear in the step's `failed` array with distinct reason text; `scenePlanStep` needed no change, and no reason code was added to `beatScenesService`'s frozen `REASON_CODES`.
- A beat with no location at all is still written with no set. That is not a liveness question and is unchanged.
- The S1-B limitations stand: there is still **no per-episode correction workflow** for a frozen episode, and a bad beat still costs the whole unit.

---

**Type:** amendment (C2 / Writer 8 integration against the S1-B baseline).
**Rules:** nothing. **Mints:** nothing. **Discharges:** the `RECORDED GAP (W8, UNRESOLVED)` case and the §5a Writer 8 dependency of `F-AUTH-1_ReferenceWritersSetLiveness_Amendment_2026-11-24.md`.
**Host/AWS/DB/Cognito contact (this session):** none.
**Production standing:** Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1, as restated by `F-Deploy-1_Fix_Plan_v1.56.md`); agent sessions' production access is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`, not by the freeze standing.
