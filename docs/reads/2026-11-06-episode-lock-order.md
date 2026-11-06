# Episode-first lock order (A1.1, 2026-11-06)

**Status:** implemented in the A1.1 PR (transaction and locking safety for the Start snapshot). A1.2, the freeze enforcement, is planned separately and is not part of this change.

## The rule

**Corrected in A1.3-0 (see the amendment below).** The order as first written here (slots before world events) did not match the code: the swap, the move to the next season, and making or creating a special all lock the world event before the special and the slot. The canonical order is:

> **E** (existing episodes, in id order, through `lockEpisodes` in `src/utils/episodeLocks.js`) → **W** (world events) → **P** (specials and two-parters) → **S** (slots; several slots always in id order) → **A** (show arcs) → **X** (briefs, offers, spending lines, price snapshots, clips, scene plans) → **L** (the ledger: `shows`, `character_state`, `financial_transactions`).
>
> Rows a transaction inserts itself (E\*) may come anywhere: no other transaction can hold them.

The two known exceptions are listed in the amendment under "Known deviations".

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

## Amendment: A1.3-0 (2026-11-06)

**What changed in code:**

| # | Where | Before | Now |
|---|---|---|---|
| C1 | `rawClipsService.attachClip`, `rawClipRoutes` | a take could attach to an episode deleted while it uploaded (R1; reproduced: 201, the row saved) | under the episode's `FOR SHARE` lock: an idempotent replay of the same clip first, then 409 `CLIP_EPISODE_DELETED` when the episode is missing or deleted; nothing is inserted. The route then deletes that upload's own objects, best effort (below) |
| C3 | `seasonSpecials.updateSpecial` (event change) | E → **P → W** (`takeEvent`): against the swap of the same event, a `40P01` deadlock (reproduced) | E → **W** (the new event, locked before the special) → P; `takeEvent`'s own lock then finds the event held |
| C4 | `seasonSlotService.pencilEventIn` | target slot, then the slot holding the event: two pencils swapping events between two slots deadlocked (reproduced) | both slots in one statement, `ORDER BY id`, then the holder is checked again; a different holder is 409 `SEASON_CHANGED_RETRY`, nothing written |
| C4b | `seasonLoader.loadSlots(lock: true)` (season setup), `seasonSpecials.createTwoParter` | setup locked every slot `ORDER BY slot_number`: against a pencil moving an event to a later slot, a deadlock (reproduced) | every multi-slot lock is `ORDER BY id`; the rows callers see are still in slot-number order |
| C2 | `seasonSlotService.assignOnStartIn` | — | **no code change.** Measured: `LIMIT 1 FOR UPDATE` is already correct under contention. Postgres locks rows until the limit is met (Limit over LockRows): a slot another Start filled while this one waited fails the re-check and is skipped, and the next open slot is locked and returned. "No slot" is therefore decided under the lock. The races are kept as regression tests |

**The C2 boundary:** Start's slot assignment is still its own transaction after the Start commits. A failure there is still the non-fatal "failed `season_slot` setup step". **Start is not atomic until A1.3b.**

**The refused take's clean-up (C1):**
- It deletes only keys under that upload's own folder (`episodes/<episode>/raw-clips/<clip>/`), whose clip id the upload minted, one exact key at a time, never a prefix or a listing.
- It deletes nothing when any raw clip row, removed ones included, references the clip id or a key.
- A failed delete never hides the 409. It is logged as one line per key: `[raw-clip-orphan] {"episode_id","clip_id","key","reason","at"}`.
- A retried `complete` after the refusal returns the same 409 and does not clean up again. A process restart loses the upload entry; a new `complete` then gets "upload not found", as before.
- **Those log lines are best-effort:** the API's pm2 logs (`ecosystem.config.js`) have no documented rotation, retention or off-box shipping. Recovery does not depend on them.
- **`scripts/maintenance/list-raw-clip-orphans.js`** is read-only (S3 `ListObjectsV2` and `ListMultipartUploads`, a `SELECT` on `episode_raw_clips`, optional log files). It classifies each clip folder as `referenced`, `in_progress_or_recent` (newer than a 48 h grace window, or an open multipart upload), `refused_logged`, or `candidate_unreferenced`. The grace window is a classification rule, not proof; a missing row is never enough on its own; it says "candidate", never "orphan", and it never deletes.
- **After a revert:** objects already deleted stay deleted (they belonged to refused uploads of deleted episodes); the log lines remain. Reverting restores the code paths only.

**Matrix rows (the order each transaction takes now):**

| Transaction | Order |
|---|---|
| Start (first) | W → E\* → X → W (stamp, already held) → X → O. Then its own transaction: E\* → P or S (one slot, `LIMIT 1 FOR UPDATE`) |
| Start (regenerate) | E(old) → W → E(old) UPDATE → L (coin sync) → W (held). Then E\* → S or P |
| Swap (`swapIntoSlot`), move to next season | E → W → P → S |
| Make or create special (`takeEvent`) | W → S (clear the pencil) → P (clear other specials) |
| Update special, event change | E → W → P → S (`takeEvent`) → P |
| Pencil (`pencilEventIn`) | W (the event, C4c) → S, S (one statement, id order) → P (clear specials) |
| Apply placement (`applyPlacement`) | E (placed episodes) → W (pencilled events, id order, C4c) → S → X (snapshot Brief) → S → P |
| Two-parter (`createTwoParter`) | E (Part 1) → S, S (id order) → S UPDATE → P (clear, insert) |
| Season setup (`updateSetup`) | E (started drafts) → A → S (every slot, id order) → E snapshots (held) |
| Placement, intention save | E → S → X |
| Event `PUT` relink (A1.2c) | E (linked and target) → W → X |
| Brief `PUT` naming an event (A1.2a + A1.2c) | E → W → X (brief) |
| Clip attach | E `FOR SHARE` → X |
| Episode delete (A1.2c) | E → E UPDATE → L |
| Inject (A1.2c) | E (script save) → W → W UPDATE → X |

**C4c (authorized 2026-11-06, the reproduced swap-against-pencil deadlock):**
- **Before:** the swap took W(event) → P(its special) → S(target slot); a pencil of the same event into the same slot took S(target) → S(holder) → P (clearing the event from its special). Each held what the other needed: `40P01` in both orders (reproduced on `bb8450eb`). Apply placement had the same cycle against the swap, through its own pencils.
- **Now:** `pencilEventIn` locks the event (W) first: W → S → P. The swap, the move to the next season, and making, creating or updating a special all lock the event first too, so writers of one event queue on it. In the swap and the move, the event is already held.
- **Apply placement** (`seasonSetupService.applyPlacement`) locks all the events it pencils, in id order, before any slot. Without this, an episode's slot placed first would be held while its pencil waited on an event the swap held (S → W against W → S). Measured: with the pencil change alone, that race still gave `40P01`.
- **Unchanged:** a pencil of an event that has started, or is archived, is refused as before. It now waits for an in-flight Start, inject or relink of that event, then is refused. The A1.2a and A1.2c guards lock E before W and never wait on a slot or special, so they form no cycle with the pencil.

**Known deviations (no cycle):**
- **A → S** in season setup: the arc, then its slots. No transaction takes a slot, then an arc.
- **S → P** in `takeEvent`, `pencilEventIn` and `createTwoParter`: they write slots, then clear the event from specials. Every one except `createTwoParter` takes the event (W) first, so on one event they take turns there. `createTwoParter` takes E → S (both slots, id order) → P with no event lock. The special it would clear cannot exist, because an event is in a slot or a special, never both. Read-only check: no cycle found; it is now in the lock trace.
- **Specials multi-row lock:** `seasonSpecials.specialRows({ lock: true })` (`FOR UPDATE OF sp ORDER BY after_slot_number`) has **no caller** that passes `lock: true`. It cannot deadlock today. If it is ever used, it must lock by id first.
- **The move to the next season** updates the slot it leaves, then pencils the next season's open slot: two slots, in two statements, not in id order. Read-only check: no transaction locks the next season's slot and then this season's, so no cycle found. Not changed.

**How the order is proven (C6):**
- **`tests/helpers/lockTrace.js`** wraps `sequelize.query` for a test. It records each statement with its Sequelize transaction id (with `START TRANSACTION`, `COMMIT` and `ROLLBACK`), explicit row locks by table (including `FOR UPDATE OF <alias>`), every `UPDATE` and `DELETE` as an implicit row lock, and for a multi-row lock the ids it returned. Model writes are captured too: they also go through `sequelize.query`.
- **`tests/integration/lockOrderTrace.integration.test.js`** runs each real path (Start, regenerate, swap, make, create and update special, pencil, placement, intention, setup, clip attach, and the delete, event `PUT`, Brief `PUT` and inject routes) and checks every transaction against the order above. Rows a transaction inserted, rows it already holds, and X rows keyed by an episode it holds FOR UPDATE (every writer of those locks the episode first) are left out. Every multi-row lock must be `ORDER BY id`.
- **What the trace cannot see:** locks taken by triggers; `FOR KEY SHARE` locks from foreign-key checks; the order Postgres takes rows inside one statement (so a multi-row lock without `ORDER BY id` is flagged); other processes; and SQL outside Sequelize (a static check finds none in the traced files).
- **`tests/integration/lockOrderMatrix.integration.test.js`** holds one transaction just after its lock, starts the other, then lets the first go: T5–T8a, T9 and T9a (C4c), and Start against each writer, in both orders. No `40P01` or `55P03`, and the season stays consistent.
- **`tests/unit/guards/lockOrderStatic.test.js`** is a coarse ratchet over where `src/` locks these tables. It is not the proof.
