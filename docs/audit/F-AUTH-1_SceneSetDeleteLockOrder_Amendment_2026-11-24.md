| **PRIME STUDIOS** **F-AUTH-1 — THE SCENE SET DELETE PATH TAKES ITS LOCKS IN THE PLACE ORDER (C1, PR 1) (AMENDMENT)** *Deleting a scene set, with a replacement or "delete anyway", now runs every check and every write in one transaction that holds the set's references: every affected episode, then its events, then the set rows. An accepted or a filmed episode that uses the set keeps it. A lock conflict is tried again and then answered as a retry; no answer of this route carries the database's text. **Not deployable without PR 2:** until the four event-first writers change, this order deadlocks against them.* |
| --- |

**Document version**

v1.2 (2026-11-24, on the same unmerged branch, after `main` at `748c3d1e35eea4b02667d8590cc80d0f216f02ba` was merged into it by an ordinary merge: adds §11, the four KNOWN INCOMPATIBILITY tests corrected on Evoni's authorization now that C1 PR 2 (#3938) is on main; §7 and §8 are left as written at v1.1, as the record of the dependency when it was open). v1.1 (v1.0 was this file at `3f252c3d`, on the same unmerged branch; the scene generation guard in §2, §4 and §9, and the generate-venue symptom in §9 and §10, are what changed). This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `e286cfdd2e4a5edb2ebf34112a0890de9c9d7901` (2026-11-24; Foundation A, #3926, Generations B1, B2 and B3 merged; nothing deployed), plus branch `claude/scene-set-delete-lock-order`. Every `file:line` below is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's authorization of "PR 1" of 2026-11-24, whose terms are set out in §2 as they were given to this work. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy, and §7 says why this change must not be deployed alone.

**Standings used:** RULED (§2); MEASURED (the repository reads and local test runs of §1, §3 to §6, §9 and §10, each with its file or command); INFERRED (marked where used).

**Follows:** `F-AUTH-1_PlaceLockFoundationA_Amendment_2026-11-23.md` (the strict Place lock, `finalizePlaceWrite`, `lockedEventsAt` and `acceptedEpisodeUses` taking a transaction) and `F-AUTH-1_PlaceLockGenerationB3_Amendment_2026-11-23.md`, whose §4c left "the delete route's side" open.

**Reference used, not committed:** a scratch prototype (a patch with environment switches, and its scratch tests, rounds 3 to 7) kept outside the repository by another session. It was read as a design reference. §6 lists every difference between it and this change.

---

# §1. What was there (MEASURED at the basis)

`DELETE /api/v1/scene-sets/:id` (`src/routes/sceneSetRoutes.js:1005-1060` at the basis):

1. Read the set; read the approved-base refusal; read `lockedEventsAt` (409 `PLACE_LOCKED`). Three reads, each on its own, with no lock.
2. With `replacement_id`: one transaction of `moveUses` (eleven update statements over `scene_set_episodes`, `scene_plans`, `scene_set_looks`, `world_events`, `scenes`, `shows`, `character_places`, `scene_sets`) and `set.destroy`. Nothing was locked first.
3. Without: `countUses` (a read), 409 `SET_IN_USE` unless `confirm_orphan=true`, then a transaction of `set.destroy`, `releaseVersions`, `dropRemovedSetLinks`.
4. Any other error went to `sendFail`, which answers the error's own message: a deadlock answered 500 with "deadlock detected".

So: an acceptance, a first clip or another writer could commit between the reads and the writes; the writes took episode-keyed, event and set rows in the order of their statements, which is no writer's order; a set an accepted episode used directly (a location, a beat or a scene row, with no event held at it) could be deleted or have its uses moved; and so could a set a filmed episode used. The soft delete took only a plain update's lock on the set row, which a key-share lock does not conflict with (B3 amendment §4c).

# §2. The decisions (RULED)

Evoni authorized PR 1 on 2026-11-24 as one change. Her terms, as given to this work:

**The order, in one transaction per attempt.**
1. A discovery read of the complete reference set: the events at the set; the episodes linked to those events (`linkedLiveEpisodes`); the episodes with live location, beat or scene rows at the set; the set's version rows.
2. Every affected episode, direct or event-linked, locked exclusively, in one globally ascending id order, through `lockEpisodes` as it exists.
3. Each affected event through `lockLiveEvent`, ascending.
4. The set rows in one statement, NOWAIT: the set being removed `FOR UPDATE`; the replacement `FOR KEY SHARE` with `deleted_at IS NULL`; version rows `FOR NO KEY UPDATE`. `SET LOCAL lock_timeout` as the existing convention.
5. The reference set read again in the transaction. If it names an episode or an event not held: roll back, pause outside any transaction with the existing pause (250 ms), try again in a new transaction with the larger set; at most three tries. A held lock is never upgraded in place.
6. Checks under the locks, in this order: the approved-base refusal; locked events (409 `PLACE_LOCKED` with `locked_events`); accepted uses (409 `EPISODE_ACCEPTED`, naming the episodes by number); filmed uses (409 `EPISODE_SNAPSHOT_FROZEN`, the existing convention, soft-deleted clips counting as today). Both kinds of delete are refused for accepted or filmed uses. `SET_IN_USE` and `confirm_orphan` for draft, unfilmed uses are unchanged.
7. `moveUses` or the orphan statements, unchanged, then `set.destroy`, in that transaction.
8. Lock conflicts after the bounded tries: the existing 409 `RETRY`. Any other database error: a fixed sentence, its class logged; no raw PostgreSQL or ORM text in any response of this route.

**Standing terms.** The helpers are exported and parameterised so that the later correction of "Move my beats" (C2) can reuse them with an episode scope. `moveRemovedSetsForEpisode` and its route are not changed. Not in scope, and several of them held: PR 2 (the event-first writers), PR 3, the active-generation refusal on delete, claim-side generation rules, a late base on a removed set, editor-clip references, the acceptance guard, two-part acceptance, S1, recovery; no change to `placeLock.js`, `eventEpisodeLink.js` or `episodeLocks.js`; no migration; no authorization change; no frontend change unless the Scene Sets page could not show the new refusals.

**The scene generation guard (her ruling on review of this change, as given to this work).** The database's generation guard stays authoritative. The delete route must not pass the trigger's raw sentence through: it maps that one known condition (SQLSTATE 23514 with the prefix "scene generation guard: ") to a fixed sentence of its own at the existing status (500), and keeps the generic sentence for unrelated database failures.

**To be stated, not fixed.** With exclusive episode locks, PR 1 alone deadlocks against today's event-first writers when the writer goes first. PR 1 must not be deployed without PR 2. The incompatibility is to be reproduced in the tests as it is, not hidden, and the exclusive lock is not to be weakened to make it disappear.

**Also recorded today (her decision).** The event edit and scene-set-link change the Place of a filmed, not accepted episode's event today. It is recorded against PR 2 / S1 (§8), not implemented.

# §3. What was verified before the code was written (MEASURED)

- **`lockEpisodes` acquires in ascending order in one call.** Its statement is `SELECT id FROM episodes WHERE id IN (:ids) ORDER BY id FOR UPDATE` (`src/utils/episodeLocks.js`): the rows are locked as the sorted rows are returned, and `id` never changes, so one call with every id is one ascending acquisition. One call is used; no second helper was written. (INFERRED from PostgreSQL's documented behaviour of a locking clause over `ORDER BY`; the tests observe that each of the five episodes is held, not the order inside the statement.)
- **`lockLiveEvent`** locks one event row `FOR UPDATE` and throws `EVENT_DELETED` for a deleted one (`src/utils/eventEpisodeLink.js`).
- **`lockedEventsAt` and `acceptedEpisodeUses`** already take a transaction (Foundation A). `filmedAt` takes one (`src/utils/frozenEpisode.js`).
- **`approvedBase.baseReplaceRefusal`** takes a transaction; the route's `refuseApprovedBase` wrapper did not pass one.
- **The Scene Sets page** already shows the server's `error` for a failed delete (`frontend/src/pages/SceneSetsTab.jsx`, the delete handler's `showToast(... err.response?.data?.error ...)`), and handles `SET_IN_USE` by its code. No frontend file is changed.
- **Nothing in the three shared helpers had to change.** `placeLock.js`, `eventEpisodeLink.js` and `episodeLocks.js` are byte-identical to the basis.

# §4. What the change does (MEASURED on the branch)

## The helpers (`src/services/sceneSetUsesService.js`)

- **`setReferences(sequelize, setId, { episodeId, transaction })`** (`:343`). A read: `{ direct, events, viaEvent, versions, episodes, episodeId }`, each a sorted list of ids; `episodes` is `direct` and `viaEvent` together. With `episodeId` it is that episode's rows and the events stamped with it (the scope `moveUses` already has), and no versions.
- **`lockSetReferences(sequelize, { setId, replacementId, episodeId, transaction })`** (`:373`). Steps 1 to 5 of §2 in the caller's new transaction: the read; `SET LOCAL lock_timeout`; `lockEpisodes(all, update)`; `lockLiveEvent` per event, ascending; one statement for the set rows; the read again. Resolves `{ refs, grown, replacementHeld }`. `grown` is true when the second read names an episode this transaction does not hold `FOR UPDATE` (`holdsEpisode`), an event it did not lock, or a version it did not lock. A replacement is locked only when `replacementId` is a scene set id other than the set itself; anything else locks none and is left to the caller to refuse, so the existing refusals keep their order.
- **`withSetLocks(sequelize, { setId, replacementId, episodeId }, work)`** (`:407`). Per attempt: a new transaction, `lockSetReferences`, then `work({ transaction, refs, attempt, replacementHeld })`, committed when it resolves. A grown set, a lock conflict anywhere (`isLockConflict`: 40P01, 55P03), a `RetryableConflictError`, or an event deleted since discovery (`EVENT_DELETED`): rolled back, then `finalizePlaceWrite.retryPause.sleep(PLACE_FINALIZE_RETRY_DELAY_MS)` outside any transaction, then again; `PLACE_FINALIZE_MAX_ATTEMPTS` (3) tries, then `RetryableConflictError`. Any other error is thrown as it is after the rollback.
- **`assertNoAcceptedOrFilmedUses(sequelize, setId, { refs, transaction })`** (`:444`). Among the episodes in `refs`: an accepted one throws `SceneSetUsesError` 409 `EPISODE_ACCEPTED` with `.episodes`; else a filmed one throws `FrozenEpisodeError` `EPISODE_SNAPSHOT_FROZEN` with `episode_id` and `frozen_at`. Accepted is asked first.
- **`acceptedEpisodeUses`** (`:266`) gains `linkedEpisodeIds`: episodes that use the set through an event are asked too. Without it the function is as it was.

## The route (`src/routes/sceneSetRoutes.js:1016`)

One `withSetLocks` call. Inside the work, in this order: the set still there (404 if another request deleted it meanwhile); the approved base; `lockedEventsAt`; `assertNoAcceptedOrFilmedUses`; then, with a replacement, `moveUses` and `set.destroy`; without, `countUses`, 409 `SET_IN_USE` unless `confirm_orphan`, then `set.destroy`, `releaseVersions`, `dropRemovedSetLinks`. Every read and write takes the transaction. The statements of `moveUses`, `releaseVersions` and `dropRemovedSetLinks` are unchanged.

## The answers

| Case | Before | Now |
|---|---|---|
| Deleted; `SET_IN_USE`; approved base; `PLACE_LOCKED`; a bad replacement (itself, not an id, not found, removed, another show's, a version) | | The same status and body, read under the locks. |
| An accepted episode uses the set directly (location, beat or scene row) | deleted, or its uses moved | 409 `{ success: false, code: 'EPISODE_ACCEPTED', error: 'Episode 12 "Title" is accepted and uses this scene set: it stays. Nothing was changed.', episodes: [{ id, episode_number, title }] }` |
| A filmed episode uses the set, directly or through an event held at it | deleted, or its uses moved | 409 `{ success: false, code: 'EPISODE_SNAPSHOT_FROZEN', error: 'Episode 12 "Title" has been filmed (since 2026-11-24) and uses this scene set: it stays. Nothing was changed.', episode_id, frozen_at }` |
| Those two, with no choice made (neither a replacement nor "delete anyway") | 409 `SET_IN_USE` | the refusal above (it is asked before the uses are counted) |
| A lock conflict that outlasts three tries | 500 with the database's message | 409 `{ success: false, code: 'RETRY', error: 'Someone else changed this at the same moment. Nothing was saved: try again.' }` |
| The scene generation guard refuses the removal (below) | 500 with the trigger's sentence, which names row ids | 500 `{ success: false, error: 'This scene set, or one of its angles, has a generation that is in flight or whose outcome is not known yet: it cannot be deleted until that is settled. Nothing was changed.' }` |
| Any other failure | 500 with the error's message | 500 `{ success: false, error: 'The scene set could not be deleted. Nothing was changed.' }`; one error line with the set id and the error's class |
| The set deleted by another request while this one waited | (it ran on the stale row) | 404 `Scene set not found` |

A deleted episode's rows do not hold a set, unless the deleted episode was filmed (its clips are its history, as `frozenEpisode.js` treats them everywhere).

## The scene generation guard

An existing database protection (migration `20261108210100`, a trigger): it refuses the removal of a set, or of a set with an angle, whose generation is in flight or whose outcome is uncertain, by raising SQLSTATE 23514 with a message that begins "scene generation guard: " and names row ids. It is not changed and it stays the authority: the route does not ask the question itself, and it is the trigger that stops the delete, inside the delete's transaction, which is rolled back.

What changed is only how the route answers it. Three versions on this branch:
1. v1.0 of this change (`3f39f904`) answered every non-lock failure with the generic fixed sentence, the guard's refusal included. That lost the one thing the user needs to know (a generation is unsettled), and `sceneGenerationLegacyCompat` pins the guard's refusal on this route.
2. `e74c2ff6` passed the guard's own sentence through (`sendFail`), as before PR 1. That kept the meaning but sent the trigger's text, with row ids, against §2's "no raw PostgreSQL text in any response of this route".
3. Now (`isGenerationGuardRefusal` and `DELETE_REFUSED_BY_GENERATION_GUARD`, `src/routes/sceneSetRoutes.js`): the refusal is recognised by its SQLSTATE and its prefix together and answered with the route's own sentence, at 500 as it always was. An ordinary check-constraint failure shares the SQLSTATE and not the prefix: it gets the generic sentence. Neither is tried again.

**Recorded, not changed:** the other scene-set routes the guard can refuse (the angle delete and status routes, the generate and regenerate routes) and generate-venue still relay the guard's text in their 500. That is outside this change.

# §5. The lock order

Episodes `FOR UPDATE` ascending (one statement), events `FOR UPDATE` ascending (one statement each), set rows NOWAIT (one statement), then the writes. It is the Place finalizer's order (episodes, event, set rows), with the episodes exclusive instead of shared, and for every event at the set instead of one. Waits happen only on episode and event rows, always in that order; a set row is never waited for.

Against the writers that already take that order (the finalizer's callers of B1, B2 and B3, the Locations save's own transaction, an acceptance, a clip's attachment), no cycle can form: each takes an episode row before an event row before a set row. That is observed in §9 for each, in both orders.

# §6. Differences from the scratch prototype

1. **No switches.** The prototype read `C1C2_LEVEL`, `C1C2_EPISODE_LOCK`, `C1C2_ORDER`, `C1C2_GEN_REFUSE`, `C1C2_MOVE_GUARD`, `C1C2_MOVE_RECHECK`, `C1C2_CLAIM_RULES`. None exists here; the route has one path.
2. **Episode locks.** The prototype's default locked direct episodes `FOR UPDATE` and event-linked ones `FOR SHARE`, in two statements; its `all-update` + `global` mode locked every episode exclusively, one statement per id. Here every episode is exclusive, in one `lockEpisodes` call (§3).
3. **`grown`** asks that every episode in the second read is held `FOR UPDATE`; the prototype accepted any mode for event-linked ones.
4. **An event deleted between discovery and its lock** is a retry here; in the prototype `lockLiveEvent`'s error left the helper and became a 500.
5. **The replacement id** is given to the lock statement only when it is an id other than the set's own. The prototype refused a malformed id in the route before anything else, which would have moved that 400 ahead of the approved-base and `PLACE_LOCKED` answers.
6. **`assertNoAcceptedOrFilmedUses`** covers event-linked episodes always (the prototype only in `all-update`), filters to the episodes in `refs` (so an episode scope works unchanged), names the episodes by number and title, and returns them. The prototype's message was "An accepted episode uses this set".
7. **`acceptedEpisodeUses`** takes `linkedEpisodeIds`; the prototype did not extend it.
8. **The approved-base read** takes the transaction; the prototype's did not.
9. **`refs`** carries `episodes` and `episodeId`; `work` also receives `replacementHeld`.
10. **`SET LOCAL lock_timeout`** is the first statement after the discovery read, before any lock; the prototype set it after the episode locks.
11. **The route's messages** for `PLACE_LOCKED` and `SET_IN_USE` are the existing ones, word for word; the prototype shortened both.
12. **Errors.** A failure that is not a lock conflict answers the fixed sentence; the prototype rethrew to `sendFail`.
13. **Not taken from the prototype at all:** `moveRemovedSetsLocked` and every change to `moveRemovedSetsForEpisode`, `removedSetsForEpisode` and the move route (C2); `holdLiveSet`, `shareLinkedEpisodes`, `assertLinkedEpisodesHeld` and the changes to the event edit, scene-set-link, `linkEventSceneSet`, `makeEventVersion` and `makeEveryday` (PR 2); the generation refusal on delete and the claim-side rules.

# §7. The PR 2 dependency: NOT DEPLOYABLE WITHOUT PR 2

**MEASURED (four tests, each a real deadlock held open on both sides).** Four writers lock the event row first and reach the episode row afterwards: when the episode has no Event location row, `syncEpisodeEventLocation` (or `linkEventSceneSet`) inserts one, and that insert's foreign key takes a key-share lock on the episode row, which conflicts with the delete's `FOR UPDATE`. The delete holds the episode and waits for the event; the writer holds the event and waits for the episode.

| Writer first | Observed on this code |
|---|---|
| Event edit (`PUT /world/:showId/events/:eventId`, a set change) | one 40P01; the delete is the victim (at its event lock), pauses once, succeeds on its second try; the edit answers 200 |
| `POST …/scene-set-link` (a chosen set) | the same |
| `makeEventVersion` | the same |
| `makeEveryday` (the event returned) | the same |

In each the user sees two successes about one second late (PostgreSQL's `deadlock_timeout`), and no database text. That is the outcome with one deadlock; under load, a delete can lose three times and answer 409 `RETRY`, and PostgreSQL may choose the writer as the victim, whose routes are not changed here and answer 500 with the database's message (INFERRED: not observed in these runs, where the delete was the victim every time). With the delete first, the same four writers wait and no deadlock forms (observed).

So this change is correct against every writer that takes the Place order and incompatible with the four that do not. **It must be deployed with PR 2, never before it.**

# §8. The PR 2 change list (analysis; nothing here is implemented)

**The rule for each writer:** before the event row is locked, `lockEpisodes(linkedLiveEpisodes(event), { mode: 'share' })` in id order; after the event row is locked, read the linked episodes again and stop with a retryable conflict if one is not held (the link changed); and for any set the write will reference, the uniform set rule `SELECT id FROM scene_sets WHERE id = :id AND deleted_at IS NULL FOR KEY SHARE` (`NOWAIT` when an event row is already held), refusing when no row comes back. A lock conflict answers the retryable 409.

| Writer | Function | Order today (MEASURED) | Order needed |
|---|---|---|---|
| Event edit | `PUT /world/:showId/events/:eventId`, `src/routes/worldEvents/update.js:597` (`loadScopedEvent(..., lock: true)`), sync at `:682` | event row `FOR UPDATE`; `UPDATE world_events`; `syncEpisodeEventLocation` (a link insert or update, beats) | when `scene_set_id` is in the request: linked episodes `FOR SHARE`; the event row; linked episodes re-checked; the new set by the set rule (`NOWAIT`), `INVALID_SCENE_SET_ID` on no row; then as today. Its catch maps a lock conflict to 409 `RETRY`. |
| scene-set-link | `POST …/scene-set-link`, `src/routes/worldEvents/inject.js`; `linkEventSceneSet`, `src/services/eventSceneSetLinkService.js:69` (event update at `:96`, sync at `:99`) | Place lock read outside the transaction; in a savepoint: the set read; `UPDATE world_events`; sync; the link insert | linked episodes and the target episode `FOR SHARE`; `lockLiveEvent`; re-check; the event's set read again under the lock; the Place lock asked again in the transaction; the set by the set rule (`NOWAIT`) → "needs reconnecting" on no row; then as today. A lock conflict leaves the function as a retryable conflict (today it is swallowed into "could not be linked" with the database's message). |
| `makeEventVersion` | `src/services/sceneSetVersionService.js:84` (set `FOR UPDATE` at `:91`, everyday at `:95`, event `FOR UPDATE` at `:117`, update at `:150`, sync at `:153`) | set rows `FOR UPDATE` (waited for); the event row; `isPlaceLocked` outside the transaction; `UPDATE world_events`; sync | linked episodes `FOR SHARE`; the event row; re-check; then the set rows `FOR UPDATE NOWAIT`; `isPlaceLocked` in the transaction; then as today. A lock conflict is 409 `RETRY`. |
| `makeEveryday` (`returnEvent`) | `:169` (set `FOR UPDATE` at `:173`, update at `:204`, sync at `:207`) | the set row `FOR UPDATE`; the events at it read; `isPlaceLocked` outside the transaction; one `UPDATE world_events` for all; sync per event | the events at the set read; their linked episodes `FOR SHARE`; each event (`lockLiveEvent`, ascending); re-check; the set row `FOR UPDATE NOWAIT`; the events read again (one not held: retry); the everyday set by the set rule (`NOWAIT`), a refusal when it is gone; `isPlaceLocked` in the transaction; then as today. |

Source: the prototype's PR 2 part and its round 4 (the incompatible cells: 40P01 in 8 of 24 with PR 1's order alone, none with the writers changed). The prototype's `shareLinkedEpisodes`, `assertLinkedEpisodesHeld` and `holdLiveSet` are the three small helpers PR 2 would add; `withSetLocks` is not needed by those writers.

**The recorded gap (Evoni, 2026-11-24): a filmed, not accepted episode's event can still have its Place changed.**
- *Observed today (two tests, §9):* on an event whose episode has a raw clip and is not accepted, `PUT …/events/:id` with another `scene_set_id` answers 200 and moves the event and the episode's Event location; `POST …/scene-set-link` with a chosen set answers 200 and moves the event.
- *Affected writers:* the event edit, scene-set-link, `makeEventVersion`, `makeEveryday`, the Locations save's event move, and the generation paths that link an event to a set (they all ask the Place lock, which is about acceptance, and none asks whether the episode was filmed).
- *Expected protection:* a filmed episode's Place is part of its snapshot: the same refusal as this delete's, 409 `EPISODE_SNAPSHOT_FROZEN`.
- *Reusable:* `filmedAt` and `FrozenEpisodeError` (`src/utils/frozenEpisode.js`), the snapshot-freeze convention of `src/utils/snapshotFreeze.js`, and, under PR 2's locks, a check over `linkedLiveEpisodes` like `assertNoAcceptedOrFilmedUses`.
- *Where it belongs:* PR 2 (the writers take the episode lock there, which is what makes the check race-free against a first clip) or S1. Not implemented here.

# §9. Tests (MEASURED, local)

On a private, migrated local PostgreSQL test database, through the real app and services. The image provider, the storage and the model are doubles. No test sends DDL. The network guard reports 0 external attempts. "Real lock" below: two real writers, one held open at a statement by the lock trace's gate with its locks really held, or a real row lock held by another transaction; "injected": one statement made to throw.

`tests/integration/sceneSetDeleteLockOrder.integration.test.js` (77 cases):

- **Unchanged behaviour (6).** A set nothing uses; `SET_IN_USE` with its exact body; "delete anyway" (uses left, a link no beat uses dropped, versions released); a replacement (every kind of use moved, with the exact counts); the four bad-replacement answers; the approved base first.
- **The order (3, real locks).** Five episodes (two direct, two through events, one both), three events and a version: one episode statement naming all five, the events ascending, one set-row statement, no write before it; each row probed from another session at the strength claimed. A reference set that grows after discovery: rolled back with nothing written, one pause with no session inside a transaction, a second transaction holding the larger set. A set that keeps growing: three tries, two pauses, 409 `RETRY`.
- **Accepted and filmed (18).** For each kind of delete: an accepted episode using the set as a location, as a beat, as a scene row (`EPISODE_ACCEPTED`, exact body); an accepted episode linked through an event (`PLACE_LOCKED`); a filmed one for each direct use and through an event, and with only a removed clip (`EPISODE_SNAPSHOT_FROZEN`). After each refusal a comparison of every event's set, every location, beat (set, angle, locked, chosen), scene row (set, angle, background), look, show default, character place, set and version row, episode evaluation and clip: identical. The order of the refusals; deleted episodes.
- **Held rows and failures (21).** The set row, or the replacement's, held and let go during the pause: deleted on try two. Held throughout, for each kind of delete: three tries, two pauses, none inside a transaction, 409 `RETRY`, nothing changed. A lock timeout at the episode lock, and a deadlock reported inside the writes [injected]: `RETRY`, never the database's words. A failure injected at each of `moveUses`' eleven statements and at `set.destroy`, and at each of the three orphan statements: 500 with the fixed sentence, every row as it was, not tried again, the class logged.
- **Two deletes (4, real locks).** Opposite deletes of sets with separate episodes (the second steps back at the set row, then `BAD_REPLACEMENT`) and with one episode (the second waits, then `BAD_REPLACEMENT`); a delete of the set another delete is moving uses to (`SET_IN_USE`, with the moved uses); the same set twice (404). No 40P01.
- **The Place-order writers, both orders each (5 tests, 10 races, real locks).** The Locations save that leaves the event's set; the one that moves it; Start's locations write; an uploaded look; generate-venue. The writer first: the delete waits (or steps back once from a set row) and then moves the uses, the writer's included. The delete first: the writer waits, then answers `STALE_SOURCE_SET` (generate-venue: with `generated_not_saved`), and the state is the delete's alone. No 40P01.
- **Acceptance (6, real locks).** A real `completeEpisode` first, on a direct and on an event-linked episode: the delete waits, then `EPISODE_ACCEPTED` or `PLACE_LOCKED`, Place rows identical. The delete first: the acceptance waits, then succeeds. A real two-part completion, both orders. The gap of a real two-part completion (stopped just after Part 1's commit): the event's set stays by either delete, nothing changes; and the **known gap** of §10.
- **The first clip (4, real locks).** `createClip` first, direct and event-linked: the delete waits, then `EPISODE_SNAPSHOT_FROZEN`, nothing changed but the clip. The delete first: the clip waits, then attaches.
- **The generation guard (2, injected; in the "held rows and failures" group, which makes it 23).** The guard's error as the trigger raises it: 500 with the route's own sentence, nothing of the trigger's text, its ids or the SQLSTATE, every row as it was, not tried again; the same case fails against `e74c2ff6`'s route (run once to confirm, then restored). An ordinary 23514 without the prefix: the generic sentence.
- **KNOWN INCOMPATIBILITY (5).** §7's four, and the delete first against the same writers.
- **RECORDED GAP (2).** §8's two.

**Serial outcome.** For the races, the end state is asserted as the particular rows each serial order leaves (the event's set, the episode's locations, the set removed, uses left), not by replaying both serial orders on a twin fixture.

**Not covered:** "Generate this look" (B2) racing the delete. On these fixtures its start opens no finalization (it answered 200 without taking the event row), so there was no race to hold open; the uploaded look covers B2's finalization with a link.

**An existing suite changed:** `tests/integration/placeLockGenerationB3.integration.test.js` (60 cases, was 59). Its last describe ran the real delete route inside Start's locations write. The route now waits for that write, so: the two cases named KNOWN REMAINING RACE are rewritten to the closed outcome (a removal in flight when Start begins: Start waits, then its write finds the set removed and saves nothing; a removal arriving after the write's check: it waits, then "delete anyway" removes the set); one case is added (the route during the write waits for it); and the three cases that show the write's own check remove the set by a statement where the route can no longer get in (the extra case still uses the route).

Also run on that database and passing: `placeLockStrict` (53), `sceneSetsAudit7` (7), `p2aSceneAdmin` (335), `p2bSceneSetAdmin` (243), `placeLockGenerationB1` (56), `placeLockGenerationB2` (69), `placeLockFinalizer` (52), `looksFixes4` (6, 1 skipped as before). The unit directory: 745 suites, 11287 tests.

**Not run locally, by the rule that a local run sends no DDL** (CI runs them): `sceneSetUses`, `sceneRoutesAudit3`, `approvedBase`, `venuePhoto`, `sceneGenerationLegacyCompat`. They were read against this change: their deletes are of sets used by draft, unfilmed episodes or by nothing, and assert `SET_IN_USE`, the moved counts, the bad-replacement answers and the approved-base refusal, none of which changes (INFERRED from reading, not run). One was edited, by reading: `sceneGenerationLegacyCompat` asserted the guard's raw sentence on two set deletes; those two now assert the route's fixed sentence and that no trigger text, id or database word is sent (its other guard assertions, on routes not changed here, are as they were). `sceneGenerationGuards` and `sceneGenerationPlannedFlows` were read: neither asserts the guard's sentence on `DELETE /scene-sets/:id`.

**Frontend:** no file changed; the Vitest suite was not run for this change.

**One intermittent failure, identified.** 25 further runs without load passed; under CPU load 3 of 10 runs failed, always the generate-venue case, "generate-venue first": generate-venue answered 500 `{ outcome: 'failed', error: 'Instance could not be reloaded because it does not exist anymore (find call returned null)' }`. After its finalization commits, the route reloads the set (`src/routes/worldEvents/venue.js`, `attached.reload()`); a delete that was waiting for that finalization can commit first, and the reload of a removed set throws. It is a behaviour of the generate-venue route, which this change does not touch, and it was possible before this change; the delete now queues directly behind the finalization, which makes it likelier. The assertion is not weakened and the route is not changed: it awaits a decision (§10).

# §10. Known remaining gaps and limits

- **Not deployable alone (§7).**
- **The two-part gap.** Between Part 1's committed acceptance and Part 2's, a set that only Part 2 uses directly (not the event's) can be deleted: Part 2 is neither accepted nor filmed yet. Observed (§9). Closing it is the two-part acceptance work, not this change.
- **The acceptance guard.** An acceptance does not itself check that the episode's sets are live; it waits for a delete that holds the episode and then accepts the episode as the delete left it (with "delete anyway", on a removed set).
- **Start's beat rows.** `createScenePlanRows` runs after Start's commit, outside any of these locks, on sets checked before the commit (B3 amendment §4c). A delete that commits in between leaves new beats on a removed set. Unchanged.
- **A look row left on a removed set.** `moveUses` moves an event's look only with its event; "delete anyway" moves nothing. A look can stay on a removed set. Unchanged.
- **Editor clips.** Only raw clips (`episode_raw_clips`) make an episode filmed here, as everywhere. References from the editor's own clips are not checked.
- **Generation against deletion.** A set whose base or angle is being generated can be deleted; a base that finishes afterwards is written to a removed set. The refusal and the claim-side rules are held work.
- **Writers of references that take no lock.** The beat editor's save, `linkBeatSet`, Start's beats, the show's scene defaults and characters' places write a reference to a set without the set rule of §8. A delete does not wait for them and they do not see an uncommitted delete: such a reference can be committed to a set as it is removed. "Delete anyway" and `moveUses` then run on what they read under their own locks; a reference committed after their read is left on the removed set.
- **"Move my beats"** (`moveRemovedSetsForEpisode`) is unchanged: it still writes with no lock and no accepted or filmed check (C2).
- **Deleted, filmed episodes** hold a set their live rows still name. That follows `frozenEpisode.js`; it was not ruled on separately.
- **generate-venue answers 500 with the ORM's text when a delete commits just after its save** (§9). The base was generated, paid for and saved, and the delete then moved the event to the replacement. Not changed here; the test case that meets it fails intermittently until it is.
- **The live schema and the running processes were not verified.** No server was contacted. **No migration; no stored row is changed.**

# §11. The four KNOWN INCOMPATIBILITY tests, corrected (added in v1.2; RULED by Evoni, 2026-11-24; MEASURED)

**Why.** §7 recorded that this delete, with its exclusive episode locks, deadlocks against the four event-first writers in one ordering, and pinned that as four tests asserting exactly one 40P01. C1 PR 2 (#3938, merged to `main` at `748c3d1e`) corrected those writers: they now take the event's linked episodes first, then the event row, then set rows without waiting (`docs/audit/F-AUTH-1_EventWritersEpisodeFirst_Amendment_2026-11-24.md`). On that `main`, merged into this branch, the deadlock the four tests asserted no longer occurs. Evoni authorized correcting those four tests, and only those, to assert the corrected behaviour, keeping the two real actors and the deterministic gates and not reducing any of them to "the deadlock count is zero". Nothing else in the file changed; the fifth case of the describe (the delete first against the same four writers), the accepted and filmed cases, the RECORDED GAP cases and every other test are as at v1.1.

**What stays the same in all four.** The same two actors (the writer through its real route or service; the real `DELETE /scene-sets/:id`); the same gate (the writer runs until it holds the event row, the delete starts, the test waits until exactly one backend is waiting on a lock); the same fixtures (an episode with no Event-location row; for `makeEveryday`, the version made first and its location row removed).

**The shared helper.** `deadlock(name, writer, target, query)`, which returned `{ a, b, errors, victim }`, became `takeTurns(…)`, which also records the statement the waiting backend is in (from `pg_stat_activity`, read before the gate opens) and the delete's transactions from the lock trace. Two assertion helpers used by all four:

- `expectTurnsTaken(out)`: `out.errors` is `[]` (no 40P01 and no 55P03); `out.victim` is undefined; the statement the delete waited in matches `SELECT id FROM episodes WHERE id IN … FOR UPDATE` (it waited for the episode row the writer holds); the retry pause was not called; the delete ran exactly one transaction, which committed and did not roll back.
- `expectOnlyThese(before, after, …)`: the suite's own full snapshot before the race and after it may differ only in the named rows (the one event's `scene_set_id`, the removed set's `deleted_at`, the one new location row, the version link where the case has one); beats, scenes, looks, show defaults, character places, episodes and clips are deep-equal.

The old assertions, verbatim, and the new ones, per test:

| Test | Old (v1.1) | New (v1.2) |
|---|---|---|
| W1, the event edit. Title was "…a deadlock is raised (40P01); the delete is its victim, tries again after its pause and succeeds…"; now "…the edit and the delete take turns; no deadlock, no victim, no retry; the edit succeeds, then the delete with a replacement succeeds; the event and its episode are at the edit's set; no database text in either answer" | `expect(out.errors).toEqual(['40P01'])`; `expect(out.victim.sql).toMatch(/world_events/)`; `expect(out.a.status).toBe(200)`; `expect(out.b.status).toBe(200)`; `expect(pause.mock.calls).toEqual([[DELAY]])`; no `deadlock` in either body; event at `w.t`; links `[{ scene_set_id: w.t, role: 'event' }]`; `removedAt(w.s)` not null | `expectTurnsTaken(out)`; a 200 with `success: true`; b 200 with `{ success: true, message: 'Scene set deleted; its uses moved to the replacement' }` and `moved` all zero (events, locations, beats, scenes); no `deadlock` and no database text in the bodies; event at `w.t`; the same links; `removedAt(w.s)` not null; `liveRefs(w.s).total` 0; the episode still `pending`; `expectOnlyThese(…)` |
| W2, scene-set-link. Title was "…the same deadlock; the delete is the victim and succeeds on its second try"; now "…the link and the delete take turns; no deadlock, no victim, no retry; the link answers linked, then the delete with a replacement succeeds; the event and its episode are at the chosen set" | `['40P01']`; a 200; b 200; `pause.mock.calls` `[[DELAY]]`; event at `w.t` | `expectTurnsTaken(out)`; a 200 with `scene_set: { status: 'linked', scene_set_id: w.t }`; b 200 with the replacement message and `moved` all zero; no `deadlock`; event at `w.t`; links at `w.t`; `removedAt(w.s)` not null; `liveRefs(w.s).total` 0; still `pending`; `expectOnlyThese(…)` |
| W3, `makeEventVersion`. Title now "…the version and the delete take turns; no deadlock, no victim, no retry; the version is made and holds the event, then "delete anyway" removes the old set with nothing left on it" | `['40P01']`; `if (!out.a.ok) throw out.a.error`; b 200; `[[DELAY]]`; event at `w.t` | `expectTurnsTaken(out)`; a ok; b 200 with `{ success: true, message: 'Scene set deleted', links_dropped: 0 }` and `uses_left.total` 0; no database text; event at `w.t`; links at `w.t`; `removedAt(w.s)` not null; `liveRefs(w.s).total` 0; still `pending`; `expectOnlyThese(…, versions: { [w.t]: w.r })` |
| W4, `makeEveryday` with the event returned. Title now "…the return and the delete take turns; no deadlock, no victim, no retry; the event returns to the everyday set, then "delete anyway" removes the former version with nothing left on it" | `['40P01']`; a ok; b 200; `[[DELAY]]`; event at `w.r` | `expectTurnsTaken(out)`; a ok; b 200 with the "delete anyway" message, `links_dropped: 0`, `uses_left.total` 0; no database text; event at `w.r`; links at `w.r`; `removedAt(w.t)` not null; `liveRefs(w.t).total` 0; still `pending`; `expectOnlyThese(…, versions: { [w.t]: null })` |

**Rationale.** Before PR 2 the writer took the event row first and reached the episode row afterwards, the delete took the episode first, and the two deadlocked (40P01, the delete the victim, one retry pause). With PR 2 the writer takes its linked episodes FOR SHARE before the event row; the delete, wanting those episodes FOR UPDATE, waits for the writer's commit and then runs once. So `['40P01']`, the victim's statement and the one pause are replaced by: no lock error, no victim, the delete seen waiting in its episode statement, no pause, one committed transaction. The outcomes are kept and tightened to each answer's body; `moved` all zero (W1, W2) and `uses_left.total` 0 (W3, W4) show the delete ran after the writer's commit and found nothing left on the old set, so nothing is left pointing at a removed set; the snapshot comparison shows no partial commit. These four fixtures have no accepted or filmed episode, so there is no refusal to assert in them; each asserts the episode is still a draft and that the show's episodes and clips are unchanged, and the suite's own accepted and filmed cases, untouched, carry those protections. One assertion tried in a first scratch version and removed before this file: that the writer's COMMIT record precedes the delete's first lock record in the lock trace; trace order is the order statements resolve in the test process, not the database's order, and it failed once in three runs; the delete's own report (`moved` / `uses_left`) replaced it.

**Measured** (private scratch trees, evidence in `/root/pr2-evidence/combo-r10/`: `OLD-NEW-RATIONALE.md`, `partA-four-tests.patch`, the original file, raw jest output): on PR 2 at `d90467ab` merged with this branch at `f7748bea`, the corrected suite 77 of 77 in five consecutive runs; on PR 2 at `574d471d` (its final source) merged the same way, 77 of 77 in three runs; unmodified, the four cases observed `[]` where they asserted `['40P01']` (73 of 77). The results on this branch's new head, after the merge of `main` at `748c3d1e`, are in §12 when run.

---

**Type:** amendment.
**Rules:** the Scene Set delete path takes every affected episode exclusively, then its events, then the set rows, in one transaction per attempt, and refuses accepted and filmed uses under those locks; on Evoni's authorization and terms set out in §2. Not deployable without PR 2 (§7). **Mints:** nothing (no FD, XK or PE number). **Discharges:** the delete-route side left open by the B3 amendment's §4c, for the orderings its tests named; nothing else.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
