# Episode-first lock order (A1.1, 2026-11-06)

**Status:** implemented in the A1.1 PR (transaction and locking safety for the Start snapshot). A1.2, the freeze enforcement, is planned separately and is not part of this change.

## The rule

Every transaction that writes an episode's Start snapshot (`episodes.season_context`) or attaches a raw clip locks in this order:

1. **The episode rows**, in id order, through `lockEpisodes` (`src/utils/episodeLocks.js`).
2. Then slots, specials and two-parters.
3. Then world events.
4. Then show arcs and the ledger (`shows`).

**How `lockEpisodes` behaves:**
- It needs the caller's transaction and never opens one. The app has no CLS, so a nested `sequelize.transaction()` would be a second connection.
- It sets `SET LOCAL lock_timeout = '10s'`, which ends with the transaction.
- It remembers what the transaction holds, so locking the same episode again is free.

**Lock modes:**
- Snapshot writers lock `FOR UPDATE`.
- A raw clip's attachment (`rawClipsService.createClip`) locks `FOR SHARE`. Two uploads therefore never wait on each other, while an upload and a snapshot write take turns.

**Lock conflicts:** a deadlock (`40P01`) or a lock wait that timed out (`55P03`) rolls the whole transaction back. The season and specials routes answer 409 `RETRY`; a clip attachment tries again twice before a 503.

## Transactions that lock an episode

| Transaction | Order | Change in A1.1 |
|---|---|---|
| `episodeCompletionService.completeEpisode` | episode, then show (ledger) | unchanged |
| `financialTransactionService.finalizeEpisodeFinancials` (with a transaction) | episode, then show (ledger) | unchanged |
| `termsReopenService` (reopen) | episode, then world event | unchanged |
| `episodeEstimateBackfill.applyEpisodeEstimate`, `beat14Opportunity`, `youtubeThumbnailService` | episode only | unchanged |
| `voiceStudioService` (approvals) | episode `FOR SHARE` | unchanged |
| `seasonSlotService.placeEpisodeIn` (and `placeEpisode`) | was slot, then episode; **now** episode, then slot | reordered |
| `seasonSlotService.assignOnStart` | had no transaction at Start; **now** one transaction, the new episode first | new transaction |
| `seasonIntentionService.saveIntention` | slot write and snapshot were separate writes; **now** one transaction: episode, slot, snapshot, Brief | atomic |
| `seasonIntentionService.draftIntention` | as `saveIntention`; the model is asked **before** the transaction opens | atomic |
| `seasonSetupService.updateSetup` | was arc and slots, then episodes; **now** the started drafts' episodes first | reordered |
| `seasonSetupService.applyPlacement` | **now** the placed episodes first | reordered |
| `seasonFullSpecials.swapIntoSlot` | was world event, special, slot, then episode (the opposite of a terms reopen: a deadlock); **now** episode first | reordered |
| `seasonFullSpecials.moveToNextSeason` | was world event, special, then the special's episode (`unmirror`, then `placeEpisodeIn`): the opposite of a terms reopen; **now** episode first | reordered (amendment) |
| `seasonSpecials.updateSpecial` | was special, then episode; **now** episode first | reordered |
| `seasonSpecials.createTwoParter` | Part 1's episode is now locked before the slots are written, and its slot read again under the lock | reordered |
| `seasonSpecials.removeTwoParter`, `startPartTwo` | was two-parter, then episode; **now** Part 1's episode first. Part 2's new episode is made by the transaction itself. | reordered |
| `episodeGeneratorService.generateEpisodeFromEvent` (Start) | was the event, then (regenerate) the replaced episode; **now** the replaced episode first, re-checked under the locks; a first Start is unchanged | reordered (follow-up) |
| `rawClipsService.createClip` | was a single INSERT, no lock; **now** the episode `FOR SHARE`, then `INSERT … ON CONFLICT (id) DO NOTHING` | new |

## How a reordered transaction checks itself

A transaction that only learns its episode from rows it locks later:

1. reads those rows without a lock;
2. locks the episode;
3. takes its existing locks;
4. checks that the episode it now finds is one it locked (`assertEpisodesLocked`).

If someone moved it in between, the transaction stops with 409 `SEASON_CHANGED_RETRY` before writing anything.

## Start regeneration (A1.1 completion, follow-up PR)

Start Episode's own transaction (`episodeGeneratorService.generateEpisodeFromEvent`) used to lock the source world event first (`FOR UPDATE`). On a regenerate, it then soft-deleted the replaced episode (`UPDATE episodes … deleted_at`), which is event first, then episode.

- **Before A1.1,** `swapIntoSlot` and `moveToNextSeason` also locked event before episode. They could deadlock with a terms reopen, but not with Start.
- **With A1.1's first PR (#3725),** they lock episode first, so the conflict moved: they could deadlock with Start regeneration of the same special's episode. A local test reproduced it (`40P01`).

**Now:**
- **The order:** a regenerate locks the episode it replaces **before** the event (episode-first). Then it re-checks, under both locks, that the episode is still the event's live episode, in the same show.
- **If not:** if it was live and linked when the regenerate began but has been deleted or unlinked since, the regenerate stops with 409 `START_TARGET_CHANGED`. Nothing is created or changed.
- **Already deleted before the regenerate began:** the behaviour is the same as before.
- **A second regenerate of the same episode** waits on the first, then is refused, as before.
- **Errors:** the regenerate route answers a retryable conflict (`START_TARGET_CHANGED`, a deadlock or a lock timeout) with 409 instead of 500.
- **Unchanged:** a first Start (no replaced episode), episode generation, snapshot contents, scoring and rewards.

## Paths checked with these changes

| Pair | Order now | Result |
|---|---|---|
| Start regenerate against the swap or the move | both take the replaced/special episode first | no cycle (tested; `40P01` before) |
| Start regenerate against a terms reopen | episode, then event, on both | no cycle |
| Start regenerate against completion of the same episode | both lock the episode first; completion then takes the ledger, then the event, Start the event, then the ledger | the episode lock excludes the other entirely: no cycle |
| Start regenerate against setup, placement, intention saves, clip attachment | the episode first on every one | no cycle |
| Ledger writers (`bookContentFee`, the manual coin edit, episode delete or restore) | the ledger, then rows in `financial_transactions` (no foreign key to `episodes`) or the episode first | no episode lock taken after the ledger: no cycle |

**Foreign-key inserts:** an INSERT into a table with a foreign key to `episodes` takes a key-share lock on the episode row, and that conflicts with `FOR UPDATE`. On the paths above, those inserts are for the transaction's own new episode, or happen in transactions that hold no slot, event or ledger lock first, so they only wait; they do not form a cycle.

**Still open, as separate follow-ups:**
- re-keying green screen when a multipart retry finds its clip;
- duplicate clips from a re-sent one-request upload.

## Raw-clip identity

**How clip ids are made:**
- **Multipart upload:** the id is made once, when the upload begins, and kept for the upload. A repeated `complete` already returns the same answer from memory.
- **One-request upload:** each request makes a new id and a new S3 key, so it is a separate upload.

**What the database enforces:** only the primary key on `id`. No migration was needed.

**When the id is already taken:**
- The row is returned only when it is the **same upload**: the same episode and the same `s3_key_raw`.
- Any other row with that id is refused (409). It is never treated as a duplicate.
- A row removed in between is also refused (409).

**What this fixes:** a `complete` retried after a failure *after* the INSERT (for example in the take extras) used to hit the primary key and fail. It now finds its own row.

## Start's season slot

The slot assignment is now one transaction, so a failure leaves no slot half-assigned. It is still never fatal to Start, and no longer silent:
- **On failure,** Start records a failed `season_slot` step in `episodes.setup_status`.
- **On screen,** the Production checklist's "Setup did not finish" banner shows the reason and says to place the episode from the Season Roadmap.
- **On placement** (`placeEpisodeIn`), the step is marked complete.

## Tests

- **`tests/integration/episodeLockSafety.integration.test.js`:**
  - lock-timeout scoping;
  - writers needing a transaction;
  - rollback when the snapshot fails (save and draft);
  - the model asked outside any transaction;
  - a clip and a save in both orders;
  - two uploads, and a clip waiting for a held episode;
  - clip identity;
  - the swap-against-reopen and move-to-next-season-against-reopen deadlocks;
  - setup edits against intention saves;
  - Start's assignment rolling back, and the setup step being cleared.

  The swap test reproduces a `40P01` deadlock on the code before A1.1, and the move test on the PR's first commit (`91cfa7d3`).
- **`tests/integration/startRegenerateLocks.integration.test.js`:**
  - Start regeneration against the swap and against the move, with the real Start held inside its transaction;
  - two regenerates of the same episode;
  - an episode deleted while its regenerate waited;
  - a forced failure rolling back;
  - a plain regenerate of a special's episode, and a first Start.

  On the code before the Start fix (`e88978e9`), both deadlock tests give `40P01`, and the deleted-episode test sees the regenerate go ahead.
- **Unit tests:**
  - `tests/unit/utils/episodeLocks.test.js`: the helper's rules;
  - `tests/unit/services/rawClipsService.test.js`: the share lock, retries and identity;
  - `tests/unit/services/episodeGeneratorService.startTransaction.test.js`: Start's slot step.
- **Frontend:** `EpisodeProductionChecklist.setup.test.jsx`, the banner.
