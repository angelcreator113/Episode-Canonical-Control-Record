| **PRIME STUDIOS** **F-AUTH-1 — P1: MOVING BEATS OFF A REMOVED SCENE SET, GUARDED (AMENDMENT)** *The temporary 503 is lifted. The move now runs in one transaction that takes the complete episode set `FOR UPDATE`, then the events, then the scene set rows deduplicated and each at its strongest mode, re-reads the removed-source membership under those locks, and refuses every accepted or filmed episode before the first write. Any failure rolls the whole batch back. `lockSetReferences` and `withSetLocks` are generalized in place; the guarded delete path is unchanged.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged. Re-derived at the basis, not carried:
  - `grep -rhoE 'FD-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `FD-70`; `grep -roE 'FD-70' docs/audit/ | wc -l` → `200`
  - `grep -rhoE 'XK-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `XK-4`
  - `grep -rhoE 'PE-[0-9]+' docs/audit/ | sort -t- -k2 -n | tail -1` → `PE-69`
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `414706f41bd63d7656cc85f9ce43ed23000f36d4` (2026-11-26), plus branch `claude/p1-guarded-multi-move`. Every `file:line` is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's design rulings and implementation authorization of 2026-11-26. Merging this file with the change it describes is her approval of the text. It is **not** an authorization to deploy (§7).

**Standings used:** RULED (§2); MEASURED (the PostgreSQL behaviour of §3, the repository reads, and the test runs of §5); INFERRED (marked where used).

**Follows and supersedes in part:** `F-AUTH-1_MoveRemovedSetsDisabled_Amendment_2026-11-26.md`, whose temporary restriction this lifts. The reason for that restriction, and the defect it covered, stand as recorded there; what changes is that the route is guarded instead of closed. Also follows `F-AUTH-1_S1B_FrozenEpisodeProductionWrites_Amendment_2026-11-26.md` (the freeze model) and `F-AUTH-1_StartPlanRowsSetLiveness_Amendment_2026-11-26.md` (Writer 8).

---

# §1. What was there (MEASURED at the basis)

The route answered **503 `MOVE_REMOVED_SETS_DISABLED`** unconditionally, because `moveRemovedSetsForEpisode` opened a transaction of its own and called `moveUses` with no freeze check, no episode lock and no set lock. The defect's full write inventory is in the restriction's §1 and is not restated.

# §2. The decisions (RULED)

Evoni, 2026-11-26:

1. **D1 — whole-request atomicity.** One transaction for the complete request. Every move succeeds or the entire request rolls back. No partial success.
2. **D2 — freeze protection.** `assertNoAcceptedOrFilmedUses` across the complete affected reference set, **including episodes linked through events**. Any accepted or filmed episode refuses the entire batch **before any write**, with the existing code and the existing response fields.
3. **D3 — authorization.** ADMIN-only; id validation, authentication, authorization and response precedence preserved.
4. **D4 — stale-read protection.** The removed-source validation moves **inside** the protected transaction and is revalidated after the complete lock set is held. An unlocked read is never the authorization to write.
5. Reject empty batches, duplicate sources, chained moves and invalid replacements, without changing data. Preserve the existing movement, role-merging, event, look and scene behaviour; preserve bounded retries and `409 RETRY`; build no second repair system and no new schema.
6. Her required correction: **do not assume `ORDER BY id` within three CTEs guarantees global lock order**, and do not describe the operation as categorically deadlock-free merely because scene set locks use `NOWAIT`.

# §3. The lock-order question, measured

Her correction was right, and the plan shows why. The former statement was three independent `LockRows` nodes under an `Append`:

```
Append
  CTE gone -> LockRows -> Index Scan …
  CTE repl -> LockRows -> Index Scan …
  CTE vers -> LockRows -> Sort -> Index Scan …
```

`ORDER BY id` orders rows **within** a CTE; it says nothing across the three, and the CTEs' evaluation order is a plan-shape observation, not a guarantee.

Three measurements shape what replaced it:

1. **One statement does lock in ascending order.** `EXPLAIN (COSTS OFF) SELECT id FROM scene_sets WHERE id IN (…) ORDER BY id FOR UPDATE` puts `LockRows` **above** `Sort`, so rows are locked in sorted output order. This is the guarantee the `lockEpisodes` idiom already rests on.
2. **`NOWAIT` cannot wait, so it cannot deadlock.** Two real connections: one held a row `FOR UPDATE`; the other's `NOWAIT` acquisition failed **immediately** with `ERROR: 55P03: could not obtain lock on row in relation "scene_sets"`. `isLockConflict` (`src/utils/episodeLocks.js:101-104`) treats `55P03` as retryable and `withSetLocks` already retries it.
3. **Three modes cannot share one ordered scan.** A locking clause applies per table reference, not per row, so a globally id-ordered acquisition carrying three different strengths is not expressible. The alternative that would give one global order — `FOR UPDATE` on everything — was rejected: it would over-lock replacements and versions and change the concurrency of the guarded delete path.

**The guarantee this change actually supports**, stated as it is:

| class | mode | ordering | deadlock risk |
|---|---|---|---|
| episodes | `FOR UPDATE`, **waited** | global, by id, one statement | none — same order for every writer |
| events | `FOR UPDATE`, **waited** | global, by id, iterated ascending | none — same order for every writer |
| scene sets | three modes, **all `NOWAIT`** | ascending within each mode group, **not** global across groups | none **because nothing waits** — a conflict is `55P03` at once |

So the waited locks are globally ordered and the unwaited ones cannot form a wait cycle. **That is not a claim that the operation is categorically deadlock-free**: it is a claim about these three classes as they are taken here, and §5's cases measure the real orders rather than assert it. The residual cost of `NOWAIT` is not deadlock but **retry exhaustion under contention**, which surfaces as the existing `409 RETRY`.

# §4. What the change does (MEASURED on the branch)

## The generalized locker

`lockSetReferences(sequelize, { setId, setIds, replacementId, replacementIds, episodeId, transaction })` — `src/services/sceneSetUsesService.js:373`. `setId`/`replacementId` remain the one-element shorthands, so the guarded delete path's call site is **unchanged**. In order:

1. `setReferences` for **every** source, before any lock; union the episodes and the events.
2. `SET LOCAL lock_timeout = '10s'`.
3. **The complete episode set** `FOR UPDATE`, one statement, ascending (`lockEpisodes`).
4. **The complete event set**, `lockLiveEvent` per event, ascending.
5. **The scene set rows**, deduplicated across the source, version and replacement roles and acquired **once** at the strongest required mode — precedence `FOR UPDATE` > `FOR NO KEY UPDATE` > `FOR KEY SHARE` — in three statements over **disjoint** id sets, strongest first, each `ORDER BY id … NOWAIT` (`:426-435`).
6. Re-read every source's references; `grown` when any episode, event or version named is not held.

**Why the dedup is not cosmetic.** Across N moves an id can appear in two roles — a replacement that is also a version of some source, or a source that is a version of another source. Locking it twice at different strengths is a **lock upgrade after another row is already held**, which is the deadlock shape. Deduplication removes the possibility rather than ordering around it. §5 pins it with a case and a mutation.

## The guarded batch

`moveRemovedSetsForEpisode` — `:554`. Validated before anything is read or locked (empty batch, non-uuid source or replacement, duplicate source, chained move → `400 BAD_REPLACEMENT`, nothing touched). Then, inside one `withSetLocks` transaction:

1. **D4:** `removedSetsForEpisode(…, { transaction })` re-read **under the locks** — the function gained an optional transaction (`:215`) for exactly this. The episode and its events are already held `FOR UPDATE`, so no other transaction can move this episode's references meanwhile.
2. **D2:** `assertNoAcceptedOrFilmedUses` for **every** move, over that move's complete reference set, **before the first write**.
3. The moves, ascending by source, through the unchanged `moveUses`.

One commit, or one rollback of everything (D1).

## The route

`src/routes/episodes.js:1717`. The 503 block is replaced by the restored handler with the **full** error ladder, copied from the guarded delete path: `SceneSetUsesError` → its own status and code, with `episodes` when present; `isFrozenEpisodeError` → `409 err.toJSON()`; `RetryableConflictError` → `409 RETRY`; anything else → 500. **The pre-restriction handler caught only `SceneSetUsesError`**, so the freeze's `FrozenEpisodeError` would have become a 500 — that is fixed here, not inherited. `GET /removed-sets` and the three middlewares are unchanged (D3).

## The banner

`frontend/src/components/BeatPlan/RemovedSetsBanner.jsx` — the unavailable paragraph is gone, the readiness gate and the enabled button are back, and a refusal is shown in the server's own words. A `RETRY` adds one sentence telling her nothing was changed and to choose Move my beats again, instead of a dead end.

# §5. Tests (MEASURED, `--runInBand`, PostgreSQL 16; CI uses 15)

**`tests/integration/moveRemovedSetsDisabled.integration.test.js` is deliberately deleted**, and its protection is not dropped but strengthened. It could only show that a route which did nothing changed nothing. Its replacement, `moveRemovedSetsGuarded.integration.test.js` (**23 cases**), proves the refusal on an accepted episode, a filmed one, an episode reachable only through an event, and a multi-move where one episode is frozen — each with a before/after snapshot of links, beats, **angle labels**, scenes, events and looks.

**And it proves "before any write", not "written then rolled back".** A snapshot cannot tell those apart, because the rollback erases both. The accepted case therefore also asserts, from the `lockTrace` records, that **not one** write or insert statement against `scene_set_episodes`, `scene_plans`, `scenes`, `world_events` or `scene_set_looks` was ever sent.

| suite | result |
|---|---|
| `moveRemovedSetsGuarded` (**new**, replaces the 503 suite) | **23/23** |
| `sceneSetUses` | **13/13** |
| `RemovedSetsBanner` (Vitest) | **7/7** |
| with `referenceWritersSetLiveness`, `p2aSceneAdmin`, `p1PlanAdmin`, `episodes-cluster-tier-promotion` | **605/605**, 78.3 s |

Real-connection cases: a source row held by another transaction → `409 RETRY` in well under the 10 s lock timeout, nothing written (the `NOWAIT` claim of §3, measured); two **opposite-order overlapping batches** → no 500, no deadlock, one succeeds and no beat is left on a removed set; a **concurrent removal of the replacement** → 200, 400 or 409, and on 200 no beat names a removed set; an **acceptance racing the batch** → either refused with nothing written or committed onto a live set, never both; a **real failure on the last move** → every earlier move rolled back, angle labels included; the lock order read from the trace — episodes, then events, then scene sets, classes never going backwards, every set statement `NOWAIT` and `ORDER BY id`, no `40P01`.

**Mutation-checked, four ways:** removing the freeze loop fails **4** cases; taking the scene set rows before the episodes and events fails the lock-order case; removing the dedup fails the two-roles case; and moving the freeze asserts **after** the writes fails the accepted case — which is the mutation that justifies the trace assertion, since the snapshot alone survives it.

The guarded delete path is unchanged and proved so: `sceneSetUses`, `p2aSceneAdmin` and the nine lock-ordering suites pass, and a case drives the single-set shorthand through `withSetLocks` and asserts the delete path's own return shape (`refs`, `replacementHeld`, `attempt`).

Validation block all exit 0; schema agreement `0 new`; step 2 ratchet `0 new`; `eslint` clean on every changed file.

# §6. One correction worth recording

The "reached only through an event" case was first written by repointing `world_events.used_in_episode_id` at an accepted episode. It **passed the move** (200), because `setReferences` scopes events by `used_in_episode_id = :episodeId`, so repointing takes the event out of the named episode's own reference set and the accepted episode becomes unreachable. The case now models the real link that `utils/eventEpisodeLink.linkedLiveEpisodes` documents — an accepted episode with a **live brief naming the same event**, the two-part special — and refuses as it should. Recorded because the first version looked like a passing guard and was not.

# §7. What was not run, and what is not claimed

- **Nothing was deployed.** No migration, no schema change, no production access, no paid provider call. This file is not an authorization to deploy.
- `npm test` whole was not run locally; the CI `Tests` job on the pull request is the evidence.
- The local runs were on PostgreSQL 16; CI's `Tests` job is 15 and `A2 constraints` 17.
- **No historical repair.** A beat that already names a removed set is left exactly as it is; this gives the operator a safe tool, it does not sweep anything.
- The deadlock claim is bounded as §3 states. Retry exhaustion under heavy contention is a real outcome and answers `409 RETRY`.

# §8. What this does NOT do

- **One frozen episode fails the whole batch.** D1 and D2 together: the banner sends every removed set at once, so an operator with one frozen episode among several cannot move any of them. Correct, and a real cost.
- **The wider reference set can refuse a draft episode's move** because a different accepted episode shares its event — the two-part special of §6. The existing `episodes` response field names which episode.
- **A beat left with a NULL scene set is still invisible** to the removed-sets listing, the locations gap check and Resume's missing-beat calculation, so this tool cannot offer it and a frozen episode still has no repair path. Recorded in the S1-B amendment §8 and the restriction's §4; Resume NULL-set recovery remains a separate held item.
- **Mode precedence is now load-bearing.** A future lock class must be inserted at the correct strength, or the dedup would silently weaken a lock.

---

**Type:** amendment (a temporary restriction lifted, and the guard that replaces it).
**Rules:** nothing. **Mints:** nothing. **Discharges:** the guarded-repair dependency opened by `F-AUTH-1_MoveRemovedSetsDisabled_Amendment_2026-11-26.md`.
**Host/AWS/DB/Cognito contact (this session):** none.
**Production standing:** Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1, as restated by `F-Deploy-1_Fix_Plan_v1.56.md`); agent sessions' production access is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`, not by the freeze standing.
