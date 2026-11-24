| **PRIME STUDIOS** **F-AUTH-1 — THE WRITERS OF AN EVENT'S PLACE TAKE THE EPISODE FIRST (C1, PR 2) (AMENDMENT)** *The event edit, scene-set-link, inject, makeEventVersion and makeEveryday locked the event row first and reached an episode row afterwards. They now take the event's linked episodes before the event row, prove under the event's lock that none was linked meanwhile, and take a set's row live only and without waiting. A lost lock is tried again and then answered 409 RETRY. This does not complete Scene Set deletion safety and does not by itself make the delete lock-order change deployable.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `464101267f772bf5eb93cfa203c8d79169513bbb` (2026-11-24), plus the local branch `claude/event-writers-episode-first`. Every `file:line` below is on the branch. The Scene Set delete lock-order change ("PR 1", branch `claude/scene-set-delete-lock-order` at `f7748bea`) is **not** on this branch and is not modified by it.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's authorization of PR 2 of 2026-11-24 and her rulings of the same day, set out in §2 as they were given to this work. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy.

**Standings used:** RULED (§2); MEASURED (the repository reads and local test runs of §1 and §3 to §9, each with its file or command); INFERRED (marked where used).

**The original defect, measured before this work (not by it):** the lock-matrix evidence kept outside the repository at `/root/prime-lock-matrix-evidence/r8-lockab` (its E5 runs, as relayed to this work): the six writers below deadlocking against each other and against the delete's order on main, for example the event edit against inject in 12 of 20 runs with 500s. That evidence was not opened or copied by this work; PR 1's own tests reproduce the same deadlock against the delete (§7).

---

# §1. What was there (MEASURED at the basis)

Six call sites move an event to a scene set and then write, for a draft episode of that event that has no Event location, a location row whose foreign key takes a key-share lock on the episode row (`syncEpisodeEventLocation`, `src/services/eventPlaceSync.js`; `insertEpisodeLink`, `src/services/eventSceneSetLinkService.js`). Each took the event row first:

| Writer | Order at the basis |
|---|---|
| W1 the event edit, `PUT /world/:showId/events/:eventId` (`src/routes/worldEvents/update.js`, `lockAndCheck`) | the relink guard when the link changes (episodes FOR UPDATE, then the event) → the event row → the writes → the sync's insert reaches the episode |
| W2 scene-set-link, `POST …/scene-set-link` (`src/routes/worldEvents/inject.js`; `linkEventSceneSet`) | the Place lock read with no transaction → a transaction → a savepoint: the set read, the event updated, the sync, the link inserted |
| inject, `POST …/inject` | the script save locks its episode FOR UPDATE → `lockLiveEvent` → `linkEventSceneSet` |
| W3 `makeEventVersion` (`src/services/sceneSetVersionService.js`) | its set rows FOR UPDATE, waited for → the event row → the Place lock read with no transaction → the writes → the sync |
| W4 `makeEveryday` with `returnEvent` | the set row FOR UPDATE → the events at it read → the Place lock read with no transaction → one update of the events → the sync per event |

Every other writer of the Place (the Place finalizer and its callers, an acceptance, a clip's attachment, PR 1's delete) takes the episode first. Two orders are a deadlock. Also at the basis: W2 answered a lock conflict inside its savepoint as 200 "could not be linked: <the database's message>"; W3 and W4 answered an unknown error with its own message; inject linked the episode at the set the event had when the route first read it (§4).

# §2. The decisions (RULED)

Evoni's, as given to this work on 2026-11-24:

1. **Option A is kept:** the delete's episode locks stay FOR UPDATE. This change is the writers' correction.
2. **Six sites, one order.** All required episode locks in global ascending id order before the event and set locks; FOR SHARE through `lockEpisodes` for linked episodes, except where a guard already takes them FOR UPDATE (W1's relink guard runs first); inject's union with its own episode before the script save's own lock. Existing helpers are reused; small shared helpers beside them are allowed; no second locking subsystem. After the event lock the linked episodes are read again, and one not held is a rollback and a bounded retry (three tries, the finalizer's pause, outside any transaction) or the retryable answer. After a set row lock, `deleted_at IS NULL` is verified; no new reference to a removed set is committed from these sites, refused with each route's existing code. The Place lock is asked inside the transaction. The filmed-but-not-accepted protection is **not** added here: that gap is recorded and pinned by a test as today's behaviour. Retryable conflicts answer a fixed 409 `RETRY` in the existing shape, never database text. Successful behaviour, bodies, atomicity and permissions are preserved.
3. **Six existing concurrency tests may be rewritten** to the new order (five approved first, the sixth after it was reported): the same two real actors, the new mechanism asserted, the safety assertions kept or strengthened. No other existing assertion changes.
4. **A loosened lock-conflict count is rejected.** The two B1 cases assert exact counts under deterministic statement gates.
5. **Inject's stale-set correction stays in this change**, as an additional defect found in an already authorized writer, with its own regression test.
6. **Reviews before more feature work:** the safety of repeating W1's transaction; the strength of inject's episode locks; the error text of W2 and of the version routes.
7. **`src/utils/*` stays unchanged.** No migration, table, service, worker or queue. Nothing is pushed by this work.

# §3. What the change does (MEASURED on the branch)

## The helpers (`src/services/eventPlaceSync.js`)

- `shareLinkedEpisodes` (`:117`): the events' linked live episodes (`linkedLiveEpisodes`) and any `extra`, in one `lockEpisodes` statement, FOR SHARE. With `exclusive` ids: one `lockEpisodes` call per row in ascending id order, FOR UPDATE for those and FOR SHARE for the rest.
- `assertLinkedEpisodesHeld` (`:145`): after the event rows are locked, a linked live episode this transaction does not hold throws `RetryableConflictError`.
- `holdLiveSet` (`:161`): `SELECT id FROM scene_sets WHERE id = :id AND deleted_at IS NULL FOR KEY SHARE [NOWAIT]`; false when the set is gone.
- `inEpisodeFirstTransaction` (`:177`): `sequelize.transaction(work)`, tried again on 40P01, 55P03 or the plain `RETRY` conflict, `PLACE_FINALIZE_MAX_ATTEMPTS` tries with `finalizePlaceWrite.retryPause` between them; then `RetryableConflictError`.

## The order now

| Writer | Order on the branch |
|---|---|
| W1 (`update.js`) | the relink guard, when it runs → `shareLinkedEpisodes` when the save carries `scene_set_id` (`:605`) → the event row → `assertLinkedEpisodesHeld` (`:610`) → the existing checks, the Place lock among them (already in the transaction) → `holdLiveSet(new set, NOWAIT)` (`:678`) → the writes. Both transactions run in `inEpisodeFirstTransaction` (`:715`, `:790`). |
| W2 (`inject.js:369-372`) | `shareLinkedEpisodes(event, extra: the attached episode)` → `lockLiveEvent` → `assertLinkedEpisodesHeld` → the event's set and attachment read again → the Place lock in the transaction → the savepoint: `holdLiveSet(set, NOWAIT)` (`eventSceneSetLinkService.js:93`) → the writes. The checks before the transaction are kept as early answers. |
| inject (`inject.js:224-241`) | `shareLinkedEpisodes(event, exclusive: its episode)`: its episode FOR UPDATE, any other linked episode FOR SHARE, ascending → the script save (its own FOR UPDATE finds the row held so) → `lockLiveEvent` → `assertLinkedEpisodesHeld` → the event's set read again → the link. `saveEpisodeScript` is not changed. |
| W3 (`sceneSetVersionService.js:119-127`) | `shareLinkedEpisodes` → `lockLiveEvent` → `assertLinkedEpisodesHeld` → both set rows, live only, `ORDER BY id FOR UPDATE NOWAIT` (`takeSetRows`, `:65`) → the existing checks → the Place lock in the transaction → the writes |
| W4 (`:222-251`) | the events at the set read → `shareLinkedEpisodes(all)` → each event, ascending → `assertLinkedEpisodesHeld` → the set row NOWAIT → `holdLiveSet(everyday, NOWAIT)` → the events read again (one not held: retry) → the Place lock in the transaction → the writes |

Not changed, traced as already episode-first: `approveInvitation`, `makeSpecial`, `createSpecial`, `startPartTwo`, the brief route, Start Episode, the finalizer's callers.

## Response and transaction-boundary changes

| Route | Case | Before | Now |
|---|---|---|---|
| W1 | a lost lock, after three tries | 500 "Failed to update event" | 409 `{ success: false, error: 'Someone else changed this at the same moment. Nothing was saved: try again.', code: 'RETRY' }` |
| W1 | the new set removed under the lock | (its uncommitted removal was not seen) | 400 `INVALID_SCENE_SET_ID`, the existing "does not exist" body |
| W1 | both of its transactions | run once | run up to three times (§6 A) |
| W2 | a lock conflict in the savepoint | 200 `needs_reconnecting`, "could not be linked: <database text>" | 409 `RETRY`; the outer transaction rolled back (the event's move too) |
| W2 | any other failure in the savepoint | 200 `needs_reconnecting` with the database's text | 200 `needs_reconnecting`, reason "The scene set could not be linked. Try again, or choose a scene set."; the class logged |
| W2 | the event deleted meanwhile | (not locked) | 404 `Event not found` |
| W2 | the Place lock and the attachment | read before the transaction | read again inside it, under the locks |
| inject | a lost lock, after three tries | 500 | 409 `RETRY` |
| inject | the transaction | run once | run up to three times |
| inject | the episode's location | at the set read before the transaction | at the set the event has under its lock (§4) |
| W3, W4 | a lock conflict | 500 with the database's message | 409 `{ success: false, code: 'RETRY', error }` |
| the version routes (`sendVersionError`) | an unknown error | 500 with the error's message | 500 "The scene set version could not be read or changed. Nothing was changed."; the class logged |

**A new transient outcome for W3 and W4.** They take their set rows without waiting. A set row another transaction holds, or is writing at that instant (generate-venue's own writes to its set after its save), is a 55P03: rolled back, paused, tried again; three in a row is 409 `RETRY`. Its frequency was not measured: no sweep was run (§9).

# §4. Inject's stale set (an additional defect found in an authorized writer)

`POST …/inject` read the event before its transaction and passed that row to `linkEventSceneSet`, which links the episode at `event.scene_set_id`. An event moved by another request between that read and inject's event lock left the episode with an Event location at the set the event had left. Found by the new suite's first run; present at the basis.

Now, after `lockLiveEvent`, the event's `scene_set_id` is read in the transaction and that value is given to the link. Tested: inject held after it locked its episode; a real event edit moves the event and commits; inject then links the episode at the new set; no row names the old one. Against the basis's `inject.js` the case fails (the link is made at the old set): `/root/pr2-evidence/new-suite/inject-stale-set-main-inject.*`.

# §5. The six existing tests rewritten

All held two real writers against each other on real PostgreSQL before, and do now. What changed is the mechanism each pinned.

| # | Test (suite) | Old assertion, and the order it pinned | New assertion | Kept or strengthened |
|---|---|---|---|---|
| 1 | "makeEventVersion holding the set and waiting for the event the save holds" (B3) | the version seen waiting for the event **while holding set B**; `55P03` records `toHaveLength(1)` (the save's NOWAIT on B); one pause; the save refused `STALE_SOURCE_SET` | the version waits for the event row; both its set rows can be locked by another session while it waits; `lockErrors` `[]`; no pause; the save 200, then the version; the event at B, B a version of C, the episode's locations | no 40P01; both outcomes; final state of one serial order |
| 2 | "the same against a save that leaves the event's set" (B3) | as 1, the save `STALE` | as 1; the save 200, then the version moves the event | the same |
| 3 | "the save holding the event row and its set rows first: makeEventVersion waits for the set row holding nothing" (B3) | a wait on `%FROM scene_sets%…%FOR UPDATE%` | the version waits for the event row, nothing waits for a set row; no lock error. Added: another episode's Locations save really holding the set row FOR KEY SHARE: the version gets exactly one 55P03 (not a wait), one pause, and commits on its second try | no lock conflict in the first arrangement; a real NOWAIT conflict asserted exactly in the second |
| 4 | "makeEveryday … holding the version and waiting for the event the save holds", two parts (B3) | one 55P03 and the save `STALE`; then a wait on the set row | it waits for the event row both times, holding no set row; no lock error; the save 200; the event returned to the everyday set; the version link cleared | the same |
| 5 | "the save holding the event row and the set row first: makeEventVersion waits for the set row holding nothing … no lock conflict" (B1) | a wait on the set row; `lockErrors` `[]` | see below | `lockErrors` `[]` exactly, as before |
| 6 | "the save holding the event row while makeEventVersion holds the set row and waits for the event: … the save steps back" (B1) | `55P03` `toHaveLength(1)` and exactly one pause (the save stepping back from the set row the version held) | see below | no 40P01; both outcomes; final state |

**Cases 5 and 6, gated exactly.** generate-venue goes on writing its set's row after its save commits (the description review), and the version's NOWAIT set lock could meet one of those writes by timing. So the version is held by a second statement gate from the moment it has the event row until generate-venue has answered. Asserted, the same in both: the version waits for the event row; nothing waits for a set row; another session can lock the everyday set; generate-venue answers 200 `generated` and its save is committed whole (a base, not yet a version) before the version writes; then the version commits; `lockErrors` is exactly `[]` and there is no pause; no database text in the response; the set is that event's version with the saved base; the event is held at it; one provider call. The ordering in which the version loses its NOWAIT lock to one of those writes is not a case of its own: those writes are single autocommit statements, and the trace's gate pauses a statement after it has run, when its lock is already released (§9).

Why each old assertion is obsolete: none of the three mechanisms (the version holding a set row while it waits for the event; the save stepping back from that row; the version waiting for a set row) exists under the new order.

**Repeats.** Each corrected describe was run 20 times by name: the two B1 cases 20 of 20 clean; the four B3 cases (with a fifth, unchanged case of that describe) 20 of 20 clean. Raw results: `/root/pr2-evidence/six-tests-repeats/`. Before and after, for the first five: `/root/pr2-evidence/five-tests/` (they pass on the basis's sources and fail on the implementation, tests unmodified). The sixth: `/root/pr2-evidence/sixth-test/`.

# §6. The three reviews

**A. Repeating W1's transaction.** The repeated unit is `lockAndCheck`, `noteNonPrimary`, the update, `assertStillNoObligations` and `followSceneSet` (and the same in the core-fields transaction). Read for each callee: does it write, and does every query take the transaction.

| Callee | Writes | Takes the transaction | Per-attempt state |
|---|---|---|---|
| `assertEventRelinkAllowed`, `assertEpisodeAcceptsEventLink` (`utils/frozenEpisode.js`) | no | yes | none |
| `assertSecondaryAttach` (`episodeSecondaryEvents.js:374`) → `classifyLink` (`:277`), `assertNoObligations` (`:361`), `eventObligations` (`:122`), `filmedAt` | no | yes | sets the route's `secondaryAttach`, which is reset at the start of each call |
| `loadScopedEvent` (`utils/eventScope.js:37`), `adminOnlyEventChanges`, `refuseEventReferences` (`update.js`) | no | yes | none |
| `findTermsLockEpisode`, `readTermsReopen` (`utils/eventTermsLock.js:86`, `:108`) | no | yes | none |
| `isPlaceLocked` | no | yes | none |
| `noteNonPrimary` | no | yes | `carriedBefore`, set to null at its start |
| the update; `syncEpisodeEventLocation` | yes | yes | none |

`replacements.canon_consequences` is computed from the stored row inside the transaction on every attempt. Nothing in the unit calls storage, a provider or the model, writes outside the transaction, or registers a hook; the deal-type and terms re-drafts run after it, once. `secondaryEventsOf`, `episodeLinkState` and `count`, called by those helpers, were read at their call sites only (they are passed the transaction). Nothing was found that makes a repeat unsafe.

**B. Inject's lock strength.** Its own episode must be FOR UPDATE (the script save takes it so). The event's other linked episodes need only FOR SHARE: they can receive a location row. `lockEpisodes` takes one mode per statement, so the union is taken one row per call in ascending id order, each in the mode it needs from the first; no row is shared and then strengthened. `episodeLocks.js` is not changed. Tested with real locks for the target's id lowest, in the middle and highest: the pass is ascending; the target refuses a share lock; another gives a share lock (a clip upload's) and refuses an exclusive one; the script save's own FOR UPDATE then runs on a row already held so. **Through the route the union with other linked episodes cannot be reached:** the terms lock refuses an event another episode already holds before any lock is taken. So that test is on the helper the route calls, and says so.

**C. Error text.** W2: a lock conflict leaves `linkEventSceneSet` and is 409 `RETRY` with nothing committed (tested with 55P03 and 40P01 injected at the link insert). Any other failure there keeps the 200 `needs_reconnecting` answer with a fixed reason; `linkEventSceneSet` has two callers (inject and scene-set-link), and the one merged test that reads the reason (`injectSceneSetLink`, CI-only) matches `/could not be linked/`, which the fixed sentence still satisfies; it was not edited. The version routes: fixed sentences for a lock conflict and for an unknown error (tested); no test was found pinning the old text.

# §7. Concurrency results

**In the repository's suite** (`tests/integration/eventWritersEpisodeFirst.integration.test.js`, 63 cases; MEASURED): no 40P01 in any case. The lock order of each writer by trace; W4 with three episodes through two events (one episode statement before any event lock); writer against writer on one event in both orders (W1, W2 and W3 with each other and themselves; W4 against W1 and W3; two relinking edits); inject against W1, W2 and W3 in both orders, two injects, W4 against inject; an episode linked after discovery (one rollback, one pause with no session in a transaction, the second try holds it; on every try: 409 `RETRY`, nothing written); the destination set held (three tries, two pauses, the retryable answer, nothing changed) and removed (each route's existing refusal; no event or location on a removed set); accepted episodes (409 `PLACE_LOCKED`, W2's decided inside the transaction with its early check passed; a real `completeEpisode` racing W1 and W3 in both orders); the filmed gap pinned; W2's savepoint; the version routes; a Locations save and generate-venue against W1 and W3 in both orders; Start Episode against W1.

**The delete's order in that suite is SIMULATED**, and labelled so: a raw session takes the affected episodes FOR UPDATE ascending, the events FOR UPDATE ascending and the set row FOR UPDATE NOWAIT, removes the set and commits. Against it, W1, W2, W3 and inject in both arrival orders: no 40P01; the writer waits for the episode row.

**The real combination** (MEASURED on a throwaway, never committed local merge of this branch with `claude/scene-set-delete-lock-order` at `f7748bea`; the merge was automatic; evidence in `/root/pr2-evidence/combo/`):
- PR 1's 77-case suite, **unmodified**, three runs: 73 pass and the same 4 fail each time: its four KNOWN INCOMPATIBILITY cases (the event edit, scene-set-link, makeEventVersion, makeEveryday, the writer first). Each fails at `expect(out.errors).toEqual(['40P01'])` with `[]` received: against the real delete, with the writer first and held at the event row, there is no deadlock and no lock error at all. Its "delete first" case against the same four writers passes as before.
- This change's suite on the combination: 63 of 63. `placeLockGenerationB3` as merged: 60 of 60.

**Reasoned, not observed:** that no ordering of these six writers, the finalizer's callers and the real delete can deadlock, since each takes episodes, then events, then set rows without waiting. Only the orderings above were run.

# §8. What this does NOT do

Required for Scene Set deletion to be safe, and not done here (the coordinated C2 / PR 3 and S1 work):

- **References inserted after a delete by the remaining writers.** The beat editor's save, `linkBeatSet`, Start's beat rows, the other link and scene writers take no set lock and do not check the set is live under one.
- **A brief created after discovery**, `startPartTwo` included: a new episode linked to an event after a writer or the delete has locked the episodes it knew of is caught by these six writers' re-check, and by nothing else.
- **The raw clip insert that takes no lock**, as carried forward to this work from the lock-matrix findings. It was not examined here (`rawClipsService.createClip`, the one path read, attaches under a share lock on its episode).
- **Looks, characters' places and show defaults** reference a set without a foreign key and without the set rule.
- **The check-to-delete race of an old base image's file** (the base-image amendment's known remaining race).
- **The filmed, not accepted gap on these writers.** A filmed episode's event is still moved by the event edit, scene-set-link and makeEventVersion: pinned in the new suite as today's behaviour, labelled RECORDED GAP.
- **Saved scenes** are not frozen or synchronised (S1).
- **PR 2 does not complete Scene Set deletion safety and does not by itself make the delete lock-order change deployable**: the combination was run only as far as §7 says.
- **PR 1's four KNOWN INCOMPATIBILITY tests** assert the deadlock this change removes. They need rewriting on PR 1's branch, which this work did not touch. Proposed, for separate approval: in each of the four, `expect(out.errors).toEqual(['40P01'])` → `expect(out.errors).toEqual([])`; `expect(pause.mock.calls).toEqual([[DELAY]])` → `expect(pause).not.toHaveBeenCalled()`; the victim assertion of the first removed; the statuses and final rows kept as they are; the describe and titles renamed from "KNOWN INCOMPATIBILITY … a deadlock is raised" to the writers taking turns.

# §9. Tests, and what was not run

On a private, migrated local PostgreSQL test database. Providers, storage and the model are doubles. No test sends DDL. The network guard reports 0 external attempts.

- New suite: 63 of 63 (several runs). **Before the change**, with the six source files put back to the basis for one run: 34 failed and 26 passed of the 60 cases the suite then had (`/root/pr2-evidence/new-suite/before-main-sources.*`).
- `placeLockGenerationB1` 56 of 56 and `placeLockGenerationB3` 59 of 59, three full runs each on the final head; `placeLockGenerationB2` 69; `placeLockFinalizer` 52; `placeLockStrict` 53; earlier on this branch: `p1PlanAdmin` 85, `p2bSceneSetAdmin` 243, `baseSaveLiveSet` 15, `baseImageStillUsed` 30, `eventPlaceSync` 6, `sceneSetsAudit7` 7.
- The unit directory: 745 suites, 11287 tests. A static guard there (`lockOrderStatic`) pins how many event-row lock statements each file has; W3 uses `lockLiveEvent` so that count is unchanged, and the guard was not edited.

**Not done, of what was asked:**
- The combined tree as a separate scratch worktree: the worktree guard refuses git on another worktree, so the merge was made, uncommitted, in this work's own worktree and aborted.
- Each of the six sites against the REAL delete with a replacement and with "delete anyway", in both orders, three runs a cell: only what PR 1's own suite holds was run (the four writers, writer first and delete first, three runs). Inject against the real delete was not run.
- The jittered sweeps (ten runs an ordered pair): not run. No frequency is claimed anywhere in this document.
- Removed-set liveness against the real delete after a writer waited: run only against the simulated order.
- Of the new suite's asked scenarios: Start Episode against W3, a look upload against W1 and W3, and each W4 pair as its own named case are absent; the finalizer and inject races assert no deadlock, no 500 and a consistent end state rather than each exact outcome, because the second writer's order past the gate is not itself gated.
- The version losing its NOWAIT lock to one of generate-venue's writes after its save, as its own deterministic case (§5).
- CI-only suites whose setup sends DDL were not run: `injectSceneSetLink` and `injectVenueSceneSet` (read for the link reason: §6 C; not read line by line beyond that).

---

**Type:** amendment.
**Rules:** the six writers of an event's Place take the linked episodes before the event row and a set's row live only and without waiting; a lost lock is retried and then answered 409 RETRY; six existing concurrency tests follow the new order; inject links at the set the event has under its lock; on Evoni's authorization and rulings set out in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
