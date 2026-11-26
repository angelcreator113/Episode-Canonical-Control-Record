| **PRIME STUDIOS** **F-AUTH-1 — P1: MOVING BEATS OFF A REMOVED SCENE SET IS SWITCHED OFF (AMENDMENT)** *A mounted ADMIN route reached `moveUses` with no freeze check and no episode or set lock, so an accepted or filmed episode's beats, scenes, locations, events, looks and angle labels could all be rewritten through it. The route now refuses every request, unconditionally, before anything reads or writes. The service beneath it is unchanged and still unguarded; detection and reporting are untouched; the guarded repair is a separately held piece of work.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged. Re-derived at the basis, not carried:
  - `grep -rhoE 'FD-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `FD-70`; `grep -roE 'FD-70' docs/audit/ | wc -l` → `198`
  - `grep -rhoE 'XK-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `XK-4`
  - `grep -rhoE 'PE-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `PE-69`
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `0389af38f6bfb847b3f39a3597cf75ca50d9e859` (2026-11-26), plus branch `claude/p1-move-removed-sets-disabled`. Every `file:line` is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's P1 ruling of 2026-11-26. Merging this file with the change it describes is her approval of the text. It is **not** an authorization to deploy (§6).

**Standings used:** RULED (§2); MEASURED (the repository reads of §1 and §3 and the test runs of §5); INFERRED (marked where used).

**Follows:** `F-AUTH-1_S1B_FrozenEpisodeProductionWrites_Amendment_2026-11-26.md` (the freeze model this route sat outside) and `F-AUTH-1_StartPlanRowsSetLiveness_Amendment_2026-11-26.md` (Writer 8, whose §8 recorded the orphan references this route was meant to repair). Both are at the basis.

---

# §1. What was there (MEASURED at the basis)

`POST /api/v1/episodes/:episodeId/move-removed-sets` (`src/routes/episodes.js:1716-1733` at the basis) called `sceneSetUsesService.moveRemovedSetsForEpisode` (`:467-478`), which opened `sequelize.transaction` of its own and called `moveUses` (`:102`) for each move. Measured on that function: **no** `assertNoAcceptedOrFilmedUses`, **no** `filmedAt`, **no** `evaluation_status` read, **no** `lockEpisodes`, and no set-row lock.

With an `episodeId`, `moveUses` writes, for that episode:

| write | citation at the basis |
|---|---|
| `scene_set_episodes` — role/role_name merged into the kept link | `:140-149` |
| `scene_set_episodes` — the old link soft-deleted | `:150-153` |
| `scene_set_episodes` — the link moved | `:154` |
| `scene_plans` — `scene_set_id`, **and `angle_label` set to `NULL`** | `:156` |
| `scene_set_looks` — the event's looks moved | `:163-167` |
| `world_events` — `scene_set_id` | `:169` |
| `scenes` — `scene_set_id` | `:170` |

(The `shows.metadata` defaults, `character_places` and `scene_sets.version_of_set_id` writes are skipped under `if (!episodeId)`, so they were never in this route's reach.)

So every surface S1-B protects — the beats, their scenes, the locations, the event, the looks — plus the angle labels, could be rewritten on an **accepted or filmed** episode by an ADMIN request to a mounted route. S1-B covered the re-plan, the beat save, the synchronisation, Start, Resume and the export's sync; it did not cover this.

**The contrast that makes it a defect rather than a design.** The other caller of `moveUses`, the delete-with-replacement path at `src/routes/sceneSetRoutes.js:1036-1058`, is guarded: `withSetLocks` → `assertNoAcceptedOrFilmedUses` → `moveUses`. Only the per-episode Move route was not. The UI's button (`frontend/src/components/BeatPlan/RemovedSetsBanner.jsx:95` at the basis) was disabled only on `!ready || moving`, with no accepted or filmed gate, and it sent **every** removed set in one request (`:63-65`), so a multi-move was the normal case.

# §2. The decision (RULED)

Evoni, 2026-11-26, on the P1 plan: the endpoint is to **refuse all writes** while the guarded repair is designed. Her terms:

1. An accepted or filmed episode must never have its beats, scenes, locations, events, looks or angle labels modified by this action.
2. The refusal is **unconditional**: no environment flag, feature toggle or alternate route may re-enable the unguarded repair.
3. Authentication, authorization and id-validation precedence are preserved.
4. `moveRemovedSetsForEpisode` is not invoked, and no production write is performed, by this endpoint.
5. `GET /removed-sets` is unchanged.
6. The banner stays visible with its list of affected sets and beat numbers; the button is disabled with a concise explanation. The UI is not silently removed, and the repair is not claimed to work while it is disabled.
7. The existing draft repair returns only once its complete locking and safety requirements are satisfied.

# §3. What the change does (MEASURED on the branch)

`src/routes/episodes.js:1748` — the handler answers **503** with the frozen body `MOVE_REMOVED_SETS_DISABLED` (`:1740-1745`) and nothing else. The service is not required and not called; the route's module no longer references `moveRemovedSetsForEpisode` anywhere but in its explanatory comment. There is no flag to read: **re-enabling is the revert of that block, with the guard in place.**

The middlewares above it are untouched, so a signed-out request is still `401`, a non-admin still `403` with `authorize`'s own body, and a malformed id still `400` — each answered before the refusal is reached.

`GET /:episodeId/removed-sets` (`:1705-1714`) is byte-unchanged.

`frontend/src/components/BeatPlan/RemovedSetsBanner.jsx` keeps every display it had — which sets were removed, which beats point at each, and the filtered replacement lists — and adds one paragraph (`.removed-sets-unavailable`) saying that moving automatically is unavailable while its safety checks are finished, that it could change an episode that has been accepted or filmed, and what to do instead. The button is disabled unconditionally. The now-dead `ready` computation was removed rather than left in place; `moving` is kept, so the error display and a later revert both stay small.

## What this does NOT do, stated plainly

- **The service still exists and is still unguarded.** `moveRemovedSetsForEpisode` and `moveUses` are unchanged by this work: no freeze check, no episode lock, no set lock were added to either. Nothing else calls `moveRemovedSetsForEpisode`.
- **Preserving its tests is not a statement that it is safe to expose.** §5 keeps the merge-and-move assertions by driving `moveUses` directly, because those semantics are correct and the guarded repair will need them. The one case that still calls `moveRemovedSetsForEpisode` exercises its batch validation only, is isolated, and says in its own comment that its freeze and locking protections remain unresolved.
- **The guarded multi-move repair is a separately held piece of work.** Its design is in the P1 plan of 2026-11-26: one transaction via the existing bounded retry, `lockSetReferences` per move (it accepts a caller's transaction; `withSetLocks` owns its own and cannot be nested), moves sorted by ascending `from` id, a chained move refused, then `assertNoAcceptedOrFilmedUses` under those locks, then `moveUses`. Two questions are open and are Evoni's: the cross-move set ordering, and whether a multi-move is atomic as a whole or per move. **No part of it is implemented here.**

# §4. What the operator can still do

**Detection and reporting are operational and untouched.** `sceneSetUsesService.removedSetsForEpisode` (`:215`) still answers `GET /api/v1/episodes/:episodeId/removed-sets`, and `RemovedSetsBanner` — mounted at `frontend/src/components/Episodes/EpisodeScenesTab.jsx:453` — still names each removed set and the beats pointing at it.

**Manual correction remains available for a draft episode:** set each beat's location in the episode's Locations and Beat Plan, then choose Resume setup. That is the recovery the refusal's own message names.

**But Resume does not automatically repair every beat.** MEASURED, and recorded here because it bounds what the manual route can fix: a beat left with `scene_set_id IS NULL` is invisible to all three paths —

- `removedSetsForEpisode` keys on `p.scene_set_id = s.id`, so a NULL-set beat matches no removed set and **the banner never lists it**;
- `episodeLocationsService.checkLocationsStep`'s beat read filters `AND scene_set_id IS NOT NULL` and `locationsStepGaps` filters `.filter((b) => b.scene_set_id)`, so it is **excluded from `staleBeats`**;
- `createScenePlanRows` computes `missing` from the beat numbers already in `scene_plans`, with no set predicate, so a NULL-set beat **counts as existing and Resume never re-creates it**.

Only the Beat Plan editor's `linkBeatSet` can set it, one beat at a time — and on an accepted or filmed episode that is refused 409 `EPISODE_ACCEPTED` by S1-B. **So for a frozen episode there is currently no repair path at all**, which is the same gap the S1-B amendment recorded in its §8. That is a RECORDED GAP, not something this change fixes.

# §5. Tests (MEASURED, `--runInBand`, PostgreSQL 16; CI uses 15)

| suite | result |
|---|---|
| `moveRemovedSetsDisabled` (**new**) | **9/9**, 13.4 s |
| `sceneSetUses` (the sixth file) | **13/13**, 8.4 s (12 at the basis; +1 isolated batch case) |
| `RemovedSetsBanner` (Vitest) | **4/4** |
| `episodes-cluster-tier-promotion` | **95/95** |
| `p2aSceneAdmin` | pass, its 401/403 ladder unchanged |

The new suite pins the refusal on a draft, an accepted, a filmed and an accepted-and-filmed episode, each with a before/after snapshot of the links, beats, **angle labels**, scenes, events and looks showing byte-identical rows; that no database text leaks into the answer; that the ladder above still answers first; that `GET /removed-sets` still reports; and — the negative check — that **neither `moveRemovedSetsForEpisode` nor `moveUses` is ever entered**, across five request bodies including an empty one and a chained one.

**No merge-semantics assertion was lost.** In the sixth file the only assertions removed are the five HTTP status checks on the now-refused route (four `200`s and one `400`); the `400 BAD_REPLACEMENT` is preserved at the service level, and every behavioural assertion — beats repointed, `usesOf` counts, `locationsOf`, the named-role-over-extra precedence and an extra keeping its name — is intact against the real database in a real transaction. `expect(` count: 54 at the basis, 58 on the branch.

**Mutation-checked.** With the unguarded write path restored behind the refusal, **6 tests fail across the two suites**; with the refusal in place, both pass. The refusal cannot silently fall through to the write path.

One self-inflicted failure, recorded because it is a trap for the next session: the CP2 ratchet (`tests/unit/routes/episodes-cluster-tier-promotion.test.js`) counts `\brequireAuth\b` **textually across `episodes.js`, comments included**, so a first draft of the explanatory comment took the count from 117 to 118. The comment was reworded; the ratchet was not touched.

Validation block, all exit 0: `validate-routes`, `lint-silent-catches`, `audit-cost-exposure`, `check-root-junk`; schema agreement `0 new`; step 2 ratchet `0 new`. `vite build` built in 17.9 s. `eslint` clean on every changed file.

# §6. What was not run, and what is not claimed

- **Nothing was deployed.** No migration, no schema change, no production access, no paid provider call. This file is not an authorization to deploy.
- **No historical record was repaired or read.** Beats that already name a removed set are left exactly as they are; this change removes a way to make things worse, and repairs nothing.
- `npm test` whole was not run locally; the CI `Tests` job on the pull request is the evidence.
- No measurement was made of how many real episodes hold orphan references, or whether any accepted or filmed episode does: that needs production access, which was not authorized.
- The 503 is a **temporary** operational state, not a retirement. `410 Gone` was considered and rejected for exactly that reason.

---

**Type:** amendment (a temporary safety restriction and its reason).
**Rules:** nothing. **Mints:** nothing. **Discharges:** nothing — it opens the guarded-repair work as a held dependency.
**Host/AWS/DB/Cognito contact (this session):** none.
**Production standing:** Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1, as restated by `F-Deploy-1_Fix_Plan_v1.56.md`); agent sessions' production access is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`, not by the freeze standing.
