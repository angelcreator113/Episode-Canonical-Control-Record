| **PRIME STUDIOS** **F-AUTH-1 — THE PLACE LOCK, FOUNDATION A: ANY LINKED EPISODE ACCEPTED LOCKS THE PLACE, AND THE FINALIZER HELPER (AMENDMENT)** *The Place lock asked one episode. It now asks every live episode the event is linked to. A helper that commits a Place write only while the Place is not locked is added, and no route calls it yet. No generation path is protected by this change.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `5f440588260f22c587ca1542877834d7e4036b81` (2026-11-23), plus branch `claude/place-lock-foundation-a`. Every `file:line` below is against that basis unless it says "on the branch".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's authorization of 2026-11-23, quoted in §2. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy (§2, §5).

**Standings used:** RULED (§2, in Evoni's words); MEASURED (the repository reads and the local test runs in §1, §3 and §6, each with its command or file); INFERRED (marked where used).

---

# §1. What was there (MEASURED)

## The rule asked one episode

`src/utils/placeLock.js:18-31`, `isPlaceLocked(sequelize, eventId, { transaction })`: the episode the terms lock names (`findTermsLockEpisode`, `src/utils/eventTermsLock.js:80-92`: the newest live Brief naming the event whose episode is live, else the live episode the event is stamped on), else the `used_in_episode_id` stamp; locked when that one episode is live and `evaluation_status = 'accepted'`.

An event can be linked to more than one live episode. The two links that exist are the event's own stamp (`world_events.used_in_episode_id`) and a Brief naming it (`episode_briefs.event_id`); `episode_briefs.episode_id` is unique, so an episode has one Brief. The old rule read one of the linked episodes and never the others:

| State | The one episode the old rule asked | Old answer |
|---|---|---|
| A two-part special, Part 1 accepted and Part 2 not. Part 2's Brief copies `event_id` and is the newer Brief. | Part 2 (a draft) | open |
| The event is stamped on accepted episode A, and draft B's Brief names it. | B (a draft) | open |
| Accepted A's Brief and draft B's newer Brief both name the event, no stamp. | B (a draft) | open |

The first is a real window inside one call: a two-part completion accepts Part 1 in its own transaction and commits, then accepts Part 2 with a bare `UPDATE` (`src/services/seasonSpecials.js:838`). The suite of §6 holds that window open and reads it.

## Who asks the rule

```
$ git grep -n "isPlaceLocked" origin/main -- src | grep -v "src/utils/placeLock.js"
```

Thirteen call sites in eight files, none changed by this amendment except `sceneSetUsesService.js`:

| Caller | At the basis | What it does with the answer |
|---|---|---|
| Event `PUT`, a changed `scene_set_id` | `src/routes/worldEvents/update.js:658-659` | 409 `PLACE_LOCKED` |
| `POST …/scene-set-link` with a chosen set | `src/routes/worldEvents/inject.js:328-329` | 409 `PLACE_LOCKED` |
| Event read (`placeLocked`) | `src/routes/worldEvents/read.js:244` | the flag |
| `startLook`, `uploadLook`, `eventLook` | `src/services/venueLookImageService.js:208, 303, 378` | 409 `PLACE_LOCKED`; `editable` |
| `loadLookEvent` (venue look save and draft) | `src/services/venueLookService.js:188` | 409 `VENUE_LOOK_LOCKED`; `editable` |
| `versionOptions`, `makeEventVersion`, `makeEveryday`, `versionsForSets` | `src/services/sceneSetVersionService.js:79, 130, 200, 245` | `events[].locked`; 409 `PLACE_LOCKED` |
| `lockedEventsAt` (Scene Set delete, `src/routes/sceneSetRoutes.js:1016`) | `src/services/sceneSetUsesService.js:252` | 409 `PLACE_LOCKED` with `locked_events` |
| `lockedEventsAtLocation` (World Location delete, merged 2026-11-22) | `src/services/approvedBaseService.js:258` | 409 `PLACE_LOCKED` with `locked_events` |

`POST …/generate-venue` (`src/routes/worldEvents/venue.js:84`) does not ask the rule at the basis. A Place check for it is in a separate, unmerged pull request and is not part of this change.

## The read is not a lock

Every caller above reads the rule and then writes. Between the read and the write an acceptance can commit. For the routes that save in one short transaction that window is small; for the paid generation paths it is as long as the generation. Nothing at the basis serialises a Place write with acceptance.

# §2. The decisions (RULED)

Evoni, 2026-11-23, authorizing this change:

> "Foundation A is authorized for implementation in its own PR. Reuse the existing helpers and preserve the agreed lock order, retries and strict Place-lock behaviour. Do not merge or deploy without separate authorization."

> "Before beginning Foundation A, verify its proposed file scope and tests against current main, and identify any overlaps with merged code. Report unexpected changes before expanding scope."

Her earlier rulings that this change carries out, in her words:

> "APPROVE the policy that an event is locked when ANY canonically linked live episode is accepted. Include primary, non-primary and two-part-special relationships."

> "APPROVE bounded, in-process retries for retryable database locking failures after paid generation. The retry may repeat only the short database finalization transaction. Never repeat provider generation, storage upload or paid work. Recheck the Place lock on every retry. Stop on a genuine refusal or non-retryable error."

> "If the event's Scene Set changed since generation began, refuse the stale finalization. Do not overwrite a newer choice. Compare the source Set ID again under the event lock."

> "Do not automatically lock featured-guest editing merely because the Place is locked."

No ownership rule is created. No public contract is created. No route gains a guard.

# §3. What the change does (MEASURED on the branch)

## The strict rule

`isPlaceLocked` keeps its name, its signature and its export (callers read it at call time; `tests/integration/eventLookUpload.integration.test.js` spies on the export). It is now: any episode of `linkedLiveEpisodes` accepted.

The linked episodes are read in one place, `linkedLiveEpisodes(sequelize, eventId, { transaction })` in `src/utils/eventEpisodeLink.js`, returning `[{ id, evaluation_status }]` in id order:

```sql
SELECT e.id, e.evaluation_status
  FROM episodes e
 WHERE e.deleted_at IS NULL
   AND (e.id = (SELECT w.used_in_episode_id FROM world_events w WHERE w.id = :eventId)
        OR e.id IN (SELECT b.episode_id FROM episode_briefs b WHERE b.event_id = :eventId AND b.deleted_at IS NULL))
 ORDER BY e.id
```

The stamp covers a non-primary event; the Brief covers the primary event and both parts of a two-part special. There is no `season_specials` lookup, and it is not built on `episodeEventIdSql`. A soft-deleted episode, and a soft-deleted Brief, link nothing.

**It is never weaker than the old rule.** The one episode the old rule asked is the newest live Brief's live episode (a member of the Brief branch) or the live stamped episode (the stamp branch). So wherever the old rule answered locked, that episode is among the linked ones and is accepted, and the new rule answers locked. The suite of §6 asserts both: the old rule written out again agrees state by state, and the old rule's episode is among the linked episodes in every state.

**Three states lock that did not** (the table of §1). In each, every caller of §1 now refuses or reports locked, with the code it already used. Nothing a caller answers has a new shape or a new code.

**One legitimate workflow is newly refused.** When a draft episode's Brief names an event that is also linked to an accepted episode, an ADMIN can no longer change that event's place (its scene set, its venue look, its look image, its set's event version, or delete its set or location) while working on the draft. Before, the draft's status decided. That is the ruling's plain reading, and it is the cost of it.

**The World Location delete** (merged the day before, `deleteWorldLocation`) can only refuse more, never less: an event at the location in one of the three states is now answered 409 `PLACE_LOCKED`, where it was answered 409 `LOCATION_IN_USE` (a live event at a location always blocked the delete). No delete that was refused is now allowed. Its suite passes unchanged.

## The terms lock is unchanged

`findTermsLockEpisode` still names one episode, the same one; a terms reopen relies on it. Its row gains one column, `evaluation_status` (its Brief `SELECT`, and `findLiveLinkedEpisode` when asked with `withEvaluationStatus: true`). `findLiveLinkedEpisode` without that option returns exactly what it did: Start readiness passes its row on as it is (`src/services/startReadinessService.js:54-58`), and that answer must not change.

## The guest controls do not follow the wider lock

`frontend/src/pages/EventPackagePage.jsx` locked the featured-guest controls with `castLocked = used && placeLocked`. `placeLocked` is now true in more states, so the page no longer uses it for guests:

```
castLocked = used && termsLockedBy?.evaluation_status === 'accepted'
```

The event read (`src/routes/worldEvents/read.js`, `loadEventPayload`) adds `evaluation_status` to `termsLockedBy`. This reproduces the old `placeLocked` in every state: the old rule was "the terms-lock episode, else the stamp, is live and accepted", and `findTermsLockEpisode` already falls back to the live stamped episode, so the old rule is exactly "the terms-lock episode is accepted". `used` is true whenever `termsLockedBy` is set. The suite reads the route in all thirteen states and compares. The read's `usedInEpisode` is not used for this: it is `Episode.findByPk`, which also returns a soft-deleted episode, and the old rule did not lock on one.

Who sees the new field: the same signed-in accounts that already read `usedInEpisode.evaluation_status` on this route. It is the status of one more episode only when the terms-lock episode is not the stamped one.

`placeLocked` still locks the Place section, in the new states too.

## The finalizer helper

`finalizePlaceWrite(sequelize, eventId, { sourceSetId, work, maxAttempts = 3 })`, exported from `src/utils/placeLock.js`. It is not a service, and **no route calls it in this change**: the test suite is its only caller.

Each attempt is one transaction:

1. read the linked live episodes (no lock);
2. `lockEpisodes(…, { mode: 'share' })`: the episodes, in id order, `FOR SHARE` (the existing helper, which also sets the existing `lock_timeout`);
3. `SET LOCAL lock_timeout` to the existing `LOCK_TIMEOUT` (10 s). `lockEpisodes` sets none when there is nothing to lock, and the wait for the event row was then unbounded;
4. `lockLiveEvent`: the event row `FOR UPDATE`. A deleted or missing event ends here;
5. read the links again. One that is not held means a link appeared since step 1: roll back and start again (locking it now would be event-first);
6. the strict `isPlaceLocked`, in the transaction;
7. when `sourceSetId` is given, the event's `scene_set_id` read under the lock must still be it. `undefined` skips the check; `null` is a real value ("the event had no set");
8. `work({ transaction, event })`, once, then commit.

It resolves `{ outcome, code, attempts, … }`, and the outcome codes are exported (`PLACE_FINALIZE_OUTCOMES`):

| Outcome | With | `work` |
|---|---|---|
| `OK` | `value` (what `work` returned) | called once in the committed attempt |
| `PLACE_LOCKED` | `message` | not called |
| `STALE_SOURCE_SET` | `message`, `source_set_id`, `scene_set_id` | not called |
| `EVENT_DELETED` | `message` | not called |
| `PLACE_FINALIZE_RETRY_EXHAUSTED` | `message`, `last_conflict` | nothing saved |

A lock conflict (Postgres 40P01 or 55P03, or a `RetryableConflictError`) and a changed link are tried again, up to three attempts in all, and every attempt repeats steps 1 to 7. The three refusals stop at once. Any other error is rolled back and thrown, with no retry. The helper calls no provider and no storage and returns no HTTP answer: a caller decides what to say.

`work` is given the transaction, and every statement in it must use it: the app has no CLS, so a statement without it runs on another connection, outside the locks. The helper documents this; it cannot enforce it.

One option is a test seam: `lockTimeout`, the wait of step 3. It defaults to `LOCK_TIMEOUT`, accepts only a plain value such as `300ms`, and no caller should pass it.

## The lock order, and why the episodes are locked FOR SHARE

Episodes first, in id order, then the event row: the order `src/utils/episodeLocks.js` states for every writer of an episode. An acceptance locks its episode `FOR UPDATE` (`src/services/episodeCompletionService.js:542`) and Part 2 of a two-parter is accepted by a bare `UPDATE`; both conflict with `FOR SHARE`, so an acceptance and a finalization take turns, whichever is first.

The mode is `FOR SHARE`, and not `FOR UPDATE`, because of the event-first writers. The event `PUT` locks the event row and then, changing the scene set, inserts the episode's Event location (`scene_set_episodes`); that insert's foreign-key check takes `FOR KEY SHARE` on the episode row. `FOR KEY SHARE` does not conflict with `FOR SHARE`, so the finalizer holding the episode does not block that insert, and the two cannot wait on each other in a cycle; `FOR UPDATE` on the episode would conflict with it and could. Measured in both orders (§6): no deadlock, and the finalizer that runs second sees the changed set and answers `STALE_SOURCE_SET`.

## Two small reads beside it

`src/services/sceneSetUsesService.js`:
- `lockedEventsAt(sequelize, setId, { transaction } = {})` now reads inside a caller's transaction when given one. Its one caller passes none and is unchanged.
- `acceptedEpisodeUses(sequelize, setId, { transaction } = {})`: the accepted live episodes that use a set as an episode location, on a plan beat or on a scene row, `[{ id, episode_number, title }]`. It has **no caller** in this change. It is a read and locks nothing.

# §4. What this change does not touch

No migration, table, endpoint, lock service, permission model or cleanup worker. No route gains a guard, and no generation code is changed. `src/routes/worldEvents/venue.js`, `src/routes/sceneSetRoutes.js`, the generation services, the acceptance code (`episodeCompletionService.js`, `seasonSpecials.js`) and the saved-scene freeze are as they were.

Two comments still describe the one-episode rule and are left, because their files are outside this change: `src/services/venueLookService.js:185-187`, and the docs outside the register that quote L13.

Two private copies of a similar linked-episode query remain: `linkedEpisodeIds` in `src/utils/frozenEpisode.js` (which also counts deleted episodes and removed Briefs, on purpose) and `linkedEpisodesOf` in `src/services/termsReopenService.js` (the same rows as the new one, with other columns). Neither is refactored here.

# §5. What Foundation A does NOT do

- **No generation path is protected yet.** No route uses the helper. The race between a paid generation and an acceptance, in `generate-venue` and in the other paid Place paths, is exactly as open after this change as before it. It closes only when those paths finalize through the helper ("Generation B").
- **A must not be deployed alone as if it closed that race.** The minimum deployment unit for the generation race is the unmerged `generate-venue` Place check, plus A, plus B. Deployed alone, A changes the rule (the three states) and nothing else.
- **The existing acceptance-against-event-writer deadlocks remain.** A completion locks the episode and then the event row; an event-first writer that later needs the episode can still meet it in a cycle. A adds no such cycle (§3) and removes none. That is a later change ("C1").
- **Nothing here freezes saved scenes.** Scene rows, beats and set images of an accepted episode are not locked by this rule. That is the separate saved-scene work ("S1").
- **Two-part acceptance itself is unchanged.** The window between Part 1 and Part 2 is now reported as locked; it is still two commits.
- **`acceptedEpisodeUses` protects nothing yet.** It has no caller.

# §6. Tests (MEASURED, local)

On a private, migrated local PostgreSQL test database, through the real app. No test sends DDL, and none calls a provider or the object storage.

- `tests/integration/placeLockStrict.integration.test.js` (53 cases). Thirteen states as rows in the shape the real writers leave, each read with the old rule written out again and with the new rule, outside and inside a transaction; the old rule's episode among the linked episodes in every state; a two-part special made by the real season routes and Start Episode, then Part 1 marked accepted by a row write (the real window is held open in the next suite); every caller of §1 through its real route or service, as an ADMIN, in each of the three new states that carry a stamp: the code it already used, nothing changed, nothing generated or stored; the read flags; the event read's new field and Start readiness's unchanged answer; the guest rule compared with the old Place lock in all thirteen states; `lockedEventsAt` in a transaction; `acceptedEpisodeUses` for each of the three use tables.
- `tests/integration/placeLockFinalizer.integration.test.js` (27 cases). Each outcome; the lock order from a statement trace; the bounded wait with no linked episode; a link that appears between the read and the locks; a real 55P03 and the retry; a real completion (`completeEpisode`) in both orders, for a primary event and for an event linked by its stamp alone; a real two-part completion held in its window by a `FOR SHARE` lock on Part 2, and a finalization ahead of one; the real event `PUT` with its insert, in both orders. Waits are seen in `pg_stat_activity`, not slept for. The network guard records no attempt by the helper.
- Frontend: `EventPackagePage.featureGuests.test.jsx` (13) and `EventPackagePage.placeLock.test.jsx` (3). The fixtures now carry what the read returns (`termsLockedBy.evaluation_status`); the guest controls stay open in the three new states while the Place is locked, and lock on the terms-lock episode's acceptance.
- **Control.** With `src/utils/placeLock.js` put back to the basis, 32 of the 53 strict cases fail; with the page put back to the basis, 3 of the 16 frontend cases fail.

**Limits of the tests.**
- A second event stamped on an episode whose own primary event is stamped too cannot be stored: the unique index `world_events_used_in_episode_unique` allows one stamp per episode. And a completion refuses an episode whose Brief names another event that is not stamped on it (409 `EPISODE_EVENT_LINK_INCONSISTENT`). So the real-acceptance races for "a non-primary event" use an event linked by its stamp alone, on an episode with no Brief. The rule itself is tested on the non-primary row shape.
- Several existing suites that touch these callers run a migration's `up()` in their own setup (`placeLock`, `venueLook`, `venueLookImage`, `sceneSetVersions`, `eventLookUpload`, `injectSceneSetLink`, `lockOrderMatrix`, `lockOrderTrace`, `seasonSpecials`). They were not run locally for this change, by the rule that a local run sends no DDL; CI runs them.

# §7. Limits of the change

- **The helper serialises only with writers that lock the episode row or the event row.** A writer that changes a Place through neither is not ordered against it.
- **The rule is a read wherever it is called without the helper.** Every caller of §1 still reads and then writes.
- **A caller's `work` is trusted** to use the transaction it is given and to do database writes only.
- **Retry exhaustion means nothing was saved.** What a caller does with work it already paid for is that caller's decision, in a later change.
- **The live schema and the running processes were not verified.** The tables, columns and indexes above are read from `src/migrations` and from a local database built by them. No server was contacted.
- **Stored rows.** None is changed. No migration.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** an event's Place is locked when any live episode it is linked to is accepted, and `finalizePlaceWrite` is the helper a Place write will be committed through, on Evoni's authorization and rulings quoted in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
