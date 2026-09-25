| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AG, 2026-09-25, backend only, with a hand-run migration, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-25_AF.md` (the AF record, #1925). This
document follows that one rather than editing it. Basis: `5a60f3278b3d176a0a7bebc73f907b0945258e08`
(#1929), the tree Deploy AG moved production to. `origin/main` at filing
is the same commit, `5a60f3278b3d176a0a7bebc73f907b0945258e08` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Three standings appear below, each marked on its own claim and
never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production
  host, database or running app states. It cannot be reproduced from a
  clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce.
- **NOT ATTESTED** marks a post-deploy check that Evoni's account does
  not report (§5.1). Nothing is inferred in its place.

This document closes no keystone, discharges no owed item, mints no FD,
XK or PE number, and rules on nothing.

The deploy is lettered AG, continuing after Deploy AF of the AF record.
It is the second deploy in a row with a hand-run migration (§7); AF's
was the first.

## §0. Evoni's account, verbatim

**ATTESTED (Evoni, 2026-09-25, issue #1930):**

> Deploy AG done. Restart 45 → 46, health `200`, all 13 files parse, 217 migration files with the same three pending.
> Deploy AG — 2026-09-25 ~23:50 UTC, backend only, no frontend build or bundle backup: 5d39e9c2 → 5a60f327, two commits (#1925, #1929), 13 files under src/, node -c passed on all 13. Migration 20260925000001-add-approval-columns-to-episode-wardrobe.js run by hand as postgres before the code, in one transaction: five columns added to episode_wardrobe (approval_status, approved_by, approved_at, rejection_reason, deleted_at), SequelizeMeta row inserted, table verified at 16 columns before COMMIT. No backfill ran because the table holds 0 rows. After it, check-pending-migrations reported 3 pending of 217 — the same three. Restart 45 → 46; health 200.

**Also ATTESTED earlier the same day (Evoni, 2026-09-25, PR #1929
comment), as issue #1930 quotes it:**

> episode_wardrobe holds 0 rows across 0 episodes.

Two further accounts, given after the deploy on issue #1930, are
recorded in their own sections: the index read (§7.1) and the app-test
results (§5.1). The sections below split the account into its claims
and set each beside what the repository measures.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `5d39e9c2` to `5a60f327`. Evoni's
account gives no `git status` read for this deploy.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 5d39e9c24 5a60f3278 origin/main
5d39e9c24fe712bf91bae41500b286b1621d8b9a
5a60f3278b3d176a0a7bebc73f907b0945258e08
5a60f3278b3d176a0a7bebc73f907b0945258e08
$ git merge-base --is-ancestor 5d39e9c24 5a60f3278; echo "exit=$?"
exit=0
```

Deploy AF ends at `5d39e9c24` (AF record §1, §8); Deploy AG begins
there.

## §2. Deploy AG — 2026-09-25 ~23:50 UTC, backend only, with a migration

**ATTESTED.**
- Two commits (#1925, #1929), 13 files under `src/`.
- `node -c` passed on all 13.
- One migration, run by hand before the code (§7).
- No frontend build and no bundle backup.
- `pm2 restart`: restart count 45 → 46. `/health` returned 200.

**MEASURED**, `git log --oneline --first-parent 5d39e9c24..5a60f3278`:

```
5a60f3278 fix(wardrobe): episode_wardrobe gets its approval columns, so an episode can have a look of its own [skip-automerge] (#1929)
ab0fad5be docs(audit): file the deploy record for Deploy AF [skip-automerge] (#1925)
```

```
$ git rev-list --count --first-parent 5d39e9c24..5a60f3278
2
$ git rev-list --count 5d39e9c24..5a60f3278
2
```

Two commits, the same two PR numbers, matching Evoni's count.
`git diff --stat 5d39e9c24 5a60f3278 -- src/`:

```
 src/controllers/wardrobeController.js              |  22 ++--
 ...001-add-approval-columns-to-episode-wardrobe.js | 135 +++++++++++++++++++++
 src/models/EpisodeWardrobe.js                      |  26 ++--
 src/routes/wardrobe.js                             |  74 ++++++++---
 src/routes/wardrobeEventRoutes.js                  |  44 ++++---
 src/routes/world.js                                |   2 +-
 src/services/episodeCompletionService.js           | 108 +++++++++++++----
 src/services/episodeGeneratorService.js            |  16 ++-
 src/services/episodeScriptWriterService.js         |   2 +-
 src/services/episodeWardrobeLinks.js               |  49 ++++++++
 src/services/groundedScriptGeneratorService.js     |   2 +-
 src/services/todoListService.js                    |   2 +-
 src/services/wardrobeIntelligenceService.js        |   5 +-
 13 files changed, 401 insertions(+), 86 deletions(-)
```

Thirteen files, matching Evoni's count. The second line is the
migration, `src/migrations/20260925000001-add-approval-columns-to-episode-wardrobe.js`
(truncated by `--stat`); it is one of the 13. `git diff --stat`
scoped to `frontend/`, `src/migrations/`, `package.json`/`package-lock.json`
and `docs/`:

```
$ git diff --stat 5d39e9c24 5a60f3278 -- frontend/
$ echo "exit=$?"
exit=0
$ git diff --stat 5d39e9c24 5a60f3278 -- src/migrations/
 ...001-add-approval-columns-to-episode-wardrobe.js | 135 +++++++++++++++++++++
 1 file changed, 135 insertions(+)
$ git diff --name-status 5d39e9c24 5a60f3278 -- src/migrations/
A	src/migrations/20260925000001-add-approval-columns-to-episode-wardrobe.js
$ git diff --stat 5d39e9c24 5a60f3278 -- package.json package-lock.json
$ echo "exit=$?"
exit=0
$ git diff --stat 5d39e9c24 5a60f3278 -- docs/
 docs/audit/F-Deploy-1_Deploy_2026-09-25_AF.md | 614 ++++++++++++++++++++++++++
 1 file changed, 614 insertions(+)
$ git ls-tree -r --name-only 5d39e9c24 src/migrations | wc -l
216
$ git ls-files src/migrations | wc -l
217
```

No `frontend/` file changes, which agrees with the attested "backend
only, no frontend build or bundle backup". One migration file added
(status `A`), matching Evoni's account; the tree goes from 216 migration
files at `5d39e9c24` to 217 at the basis (§4.1, §7). No package change.
One `docs/` file, the AF record itself (#1925).

- **`node -c`.** The filing session ran `node -c` on the same 13 files
  in its own clone (`git diff --name-only 5a60f3278 HEAD` is empty, so
  its copies are the basis's): the run over all 13 ended `all 13 ok`.
  That is a repository read; the host's own `node -c` run is ATTESTED.
- **Outside `src/`, `frontend/` and `docs/`**, the range changes three
  files under `scripts/` (`check-schema-agreement.js`,
  `schema-agreement-step2.baseline`, `silent-catches.baseline`; all
  #1929) and seven files under `tests/` (one helper,
  `tests/unit/helpers/episodeWardrobeTable.js`, and six test files; all
  #1929). `git diff --stat 5d39e9c24 5a60f3278`: 24 files, 1988
  insertions, 106 deletions. None of these is served.

**Classification**, from each commit's own `git show --stat`:

| Commit | PR | Class | Served files it changes |
|---|---|---|---|
| `ab0fad5be` | #1925 | docs | `docs/audit/F-Deploy-1_Deploy_2026-09-25_AF.md` (not served) |
| `5a60f3278` | #1929 | backend and migration | all 13 files under `src/`, one of them the migration `src/migrations/20260925000001-add-approval-columns-to-episode-wardrobe.js`; the others are `controllers/wardrobeController.js`, `models/EpisodeWardrobe.js`, `routes/wardrobe.js`, `routes/wardrobeEventRoutes.js`, `routes/world.js`, `services/episodeCompletionService.js`, `episodeGeneratorService.js`, `episodeScriptWriterService.js`, `episodeWardrobeLinks.js` (new), `groundedScriptGeneratorService.js`, `todoListService.js`, `wardrobeIntelligenceService.js` |

#1925 touches no `src/` or `frontend/` file, so the net 13 is #1929's
13. #1929 is the only commit that touches `src/migrations/`.

**Counts, side by side.**

| Claim | ATTESTED | MEASURED |
|---|---|---|
| Commits | 2 (#1925, #1929) | 2 first-parent, 2 total; the same two PR numbers |
| Files under `src/` | 13 | 13, the migration among them |
| Frontend | none: "no frontend build or bundle backup" | 0 files under `frontend/` |
| Migrations | one, `20260925000001-add-approval-columns-to-episode-wardrobe.js`; 217 migration files | one file added under `src/migrations/`, the same name; 216 → 217 files |
| Packages | not stated | no output for `package.json`/`package-lock.json` |

No count differs.

### §2.1 Frontend

**ATTESTED (Evoni).** No frontend build and no bundle backup. The served
bundle is therefore AF's, whose entry name the AF record §2.1 attests as
`index-fBcuWgnP.js`; that name stays ATTESTED.

**MEASURED.** The range changes no `frontend/` file (§2), so there was
nothing for a build to pick up.

### §2.2 Housekeeping: the pending host restart

**ATTESTED (AF record §2.2).** After AF the box wanted a system restart,
recorded there as a pending host action with no ruling.

Evoni's AG account (§0) does not report that restart as done. It is
recorded here as **still pending**, with no ruling. The filing session
does not act on it and measures nothing here; the repository holds no
record of the host's package or reboot state.

## §3. The time

**ATTESTED:** 2026-09-25 ~23:50 UTC.

**MEASURED:** the end commit `5a60f3278` (#1929) was committed
2026-09-25 22:48:51 UTC:

```
$ git log -1 --format=%cI 5a60f3278
2026-09-25T18:48:51-04:00
$ TZ=UTC git log --first-parent --format='%h %cd %s' --date=iso-local 5d39e9c24..5a60f3278
5a60f3278 2026-09-25 22:48:51 +0000 fix(wardrobe): episode_wardrobe gets its approval columns, so an episode can have a look of its own [skip-automerge] (#1929)
ab0fad5be 2026-09-25 22:39:28 +0000 docs(audit): file the deploy record for Deploy AF [skip-automerge] (#1925)
```

| Deploy | ATTESTED time | MEASURED: committer date of the attested end commit |
|---|---|---|
| AG | 2026-09-25 ~23:50 | `5a60f3278` 2026-09-25 22:48:51 |

The attested ~23:50 is after that merge.

## §4. Pre-deploy checks

### §4.1 `scripts/check-pending-migrations.js`

**ATTESTED.** After the migration (§7) the check reported 3 pending of
217, "the same three". Evoni's account does not state the flag or the
target the check printed for this run.

**Beside it, from the register.** The AF record §4.1 attests 3 pending
of 216; the AD and AE records §4.1 each attest the same 3 pending of 215.

**MEASURED**, as far as the repository goes:

- The tree has 216 migration files at `5d39e9c24` and 217 at the basis
  (§2). The one added is
  `20260925000001-add-approval-columns-to-episode-wardrobe.js` (#1929),
  the file Evoni attests she ran by hand and recorded in `SequelizeMeta`
  (§7). So the total went from 216 to 217 because this migration was
  added, and with it recorded, the pending count is unchanged at 3. The
  same three remain pending; which three they are is ATTESTED (AD/AE
  records §4.1), not measured here.
- `scripts/check-pending-migrations.js` and `DEVELOPMENT_WORKFLOW.md`
  are unchanged in the range (`git diff --stat 5d39e9c24 5a60f3278 --
  DEVELOPMENT_WORKFLOW.md scripts/check-pending-migrations.js` prints
  nothing).

**What the target names.** As in the AD, AE and AF records §4.1, the
target the check prints is the script's own config, not the running
API's (`DEVELOPMENT_WORKFLOW.md` §7, production-box row, unchanged in
the range):

> the 2026-09-25 pending-migration check named canon only for the script's own config, not the running API's.

This record applies that wording to this run as well, and does not rule
on which database the running API serves.

## §5. What went live

**MEASURED**, from the commits' own diffs and messages, lines cited at
`5a60f3278`. That these are live rests on the ATTESTED deploy (§2). The
PR numbers are the merged PRs; the task numbers are from each commit
body.

- **The AF record (#1925, `ab0fad5be`, `Task: #1923`).**
  `docs/audit/F-Deploy-1_Deploy_2026-09-25_AF.md`, 614 lines added. Not
  served.
- **`episode_wardrobe` gets its approval columns (#1929, `5a60f3278`,
  `Task: #1924`).**
  - **The table matches the model.** `EpisodeWardrobe`
    (`src/models/EpisodeWardrobe.js`, `tableName: 'episode_wardrobe'`,
    line 100) declares twelve attributes (lines 12–97) and maps three
    timestamps (`created_at`, `updated_at`, `deleted_at`, lines 105–108):
    fifteen columns. Of those, the attested pre-deploy eleven (§7) held
    eleven minus `times_worn` = ten; the other five
    (`approval_status`, `approved_by`, `approved_at`, `rejection_reason`,
    `deleted_at`) are the migration's five (§7). So every column the
    model names is in the 16-column table Evoni attests. The sixteenth,
    `times_worn`, is a table column the model does not declare; an
    undeclared column is never named in a model query, so it does not
    break one.
  - **`EpisodeWardrobe` is paranoid.** `timestamps: true`,
    `deletedAt: 'deleted_at'`, `paranoid: true` (lines 105–109; comment
    lines 101–104: Evoni's ruling (a)).
  - **Start's copy writes approved rows.** `generateEpisodeFromEvent`'s
    copy of the event's `outfit_pieces` calls `linkEpisodeWardrobe` with
    `approval_status: 'approved'` and `approved_at`
    (`src/services/episodeGeneratorService.js` lines 905–911; comment
    lines 901–904: "Until the approval columns existed every one of
    these writes failed here"). Its catch now logs with `console.error`
    (was `console.warn`). `linkEpisodeWardrobe`
    (`src/services/episodeWardrobeLinks.js` line 36) reads with
    `paranoid: false` and restores a soft-deleted pair instead of
    re-creating it into the unique pair (lines 38–45).
  - **`/wardrobe/select` writes approved picks.** `POST /wardrobe/select`
    (`src/routes/wardrobe.js` line 1210) inserts with
    `approval_status = 'approved'` and `approved_at = NOW()` (line 1296);
    `ON CONFLICT (episode_id, wardrobe_id)` (line 1297) approves the pair
    and clears `deleted_at` (line 1301). It still refuses an unowned item
    with 400 "Item is not owned — cannot select a locked item"
    (line 1284).
  - **Evaluation reads the approved look, falls back with a label, and
    logs.** `loadEpisodeLook` (`src/services/episodeCompletionService.js`
    line 159) reads `episode_wardrobe` rows with
    `approval_status = 'approved' AND deleted_at IS NULL`; a failing
    look query logs with `console.error` (line 174) instead of the
    silent catch the diff removes. With no approved look and
    `EVENT_PIECES_FALLBACK = true` (line 135) it returns the event's
    pieces with `source: 'event_pieces'` and the label "scored on the
    event's pieces" (lines 136, 177–180); otherwise `source: 'none'`
    (lines 182–183). The outfit match uses the same choice: the event's
    pieces or `{ approvedOnly: true }` (line 273), and its catch logs
    (line 282). `getOutfitScore` gains `approvedOnly` and `pieces`
    (`src/routes/wardrobe.js` line 1526; `loadEventPieceRows`, line
    1489; the `approval_status` filter, line 1536).
  - **Step 2 compares no-table models against canon.** In
    `scripts/check-schema-agreement.js`, a model whose table no live
    migration creates (NOTABLE or ALTERONLY) is now compared with the
    canon capture, default
    `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`
    (line 167; `--step2-capture`, line 168), keyed
    `canon-missing-column` (lines 82–93, 1509). The step-2 baseline adds
    26 lines and drops the key `EpisodeWardrobe - no-table`
    (tab-separated in the file); no
    `EpisodeWardrobe` key remains in it. Not served.
  - **lock-outfit is transactional.** `POST
    /:episodeId/lock-outfit` (`src/routes/wardrobeEventRoutes.js` line
    279) runs the soft delete and the re-link in one
    `sequelize.transaction` (line 297), re-linking through
    `linkEpisodeWardrobe` (line 304).
  - Raw reads of `episode_wardrobe` filter `ew.deleted_at IS NULL`
    (e.g. `src/routes/wardrobe.js` lines 114, 1535, 1637).

### §5.1 Post-deploy checks

Evoni's deploy account (§0) attests `/health` 200 and the restart. Her
app-test results, given afterwards on issue #1930, are recorded below
verbatim and as ATTESTED.

**ATTESTED (Evoni, 2026-09-25, issue #1930 comment, verbatim):**

> AG app-test results, ATTESTED 2026-09-25. Step 1, the event appears: PASS — Production → Wardrobe no longer shows "No events linked". Step 2, the game renders: PASS — EpisodeWardrobeGameplay renders with all seven slots (body, top, bottom, shoes, accessories, jewelry, perfume), the closet, per-item match scores, Outfit Synergy and Lala's confidence line. This is the first time it has been reachable since #534 on 2026-04-13. Step 3, a pick writes a row: BLOCKED, not failed — no item could be locked because all 45 wardrobe items have is_owned = false and the Sage Corset Lace-Up Halter Midi costs 385 coins against this show's 350, so the UI showed "Need 385 coins". episode_wardrobe still holds 0 rows. Step 4, read-back: not reached. The blockage is the subject of #1932; nothing about the AG deploy failed.
>
> Also observed and filed: the styling game renders no images at all, only emoji (#1931).

**ATTESTED correction (Evoni, 2026-09-25, before this record merged, verbatim).** It supersedes the ownership clause of step 3 above; the quote above is kept as given.

> Correction to the attested read, 2026-09-25: "all 45 wardrobe items are unowned" was wrong — that counted every show. For show 9bd0655f (Styling Adventures with Lala): 10 basic items owned with lock_type 'none' at 0 coins, 4 mid coin-locked items owned, 1 luxury owned — 15 owned in total. No row has an empty tier, so the WorldAdmin edit-form bug has not touched this show. The seed evidently did run here. #1932's premise needs revising: the starting closet exists, and the styling game is usable today. The blocked lock in the AG app test was only because Evoni opened a 385-coin item against 350 coins.

| Step | What was checked | Standing |
|---|---|---|
| 1 | Production → Wardrobe shows the event | ATTESTED PASS |
| 2 | The styling game is reachable and renders | ATTESTED PASS |
| 3 | A locked pick writes the first `episode_wardrobe` row | ATTESTED BLOCKED, not failed: the item tried (Sage Corset, 385 coins) was out of reach against 350 coins. Per the correction, 15 of the show's items are owned. `episode_wardrobe` still holds 0 rows; a lock from owned items is not yet attested |
| 4 | The row reads back as the episode's look | Not reached; NOT ATTESTED |
| — | The styling game renders no images, only emoji | ATTESTED observation, filed as #1931; no ruling here |

**Why there were zero rows (PR #1929 comment).** The styling game was
unreachable from #534 (`4a07fa2ea`, 2026-04-13) until Deploy AF: it
renders only when `selectedEvent` is set, and the events effect that
sets it was gated off the Wardrobe tab until #1913 (AF). Zero rows is
what an unreachable game produces. Step 2 above is the first attested
render since.

**Beside step 3, MEASURED.** `POST /wardrobe/select` refuses an item
that is neither owned, affordable (coin lock) nor qualified (reputation
lock) with 400 before any write (`src/routes/wardrobe.js`, the
`is_owned` check near line 1283). A 385-coin item against 350 coins is
refused there. Owned items pass that check at 0 cost. The seed's owned
BASIC items include a dress (Cotton Sundress), a top and bottom (Everyday
White Tee, High-Rise Black Jeans) and shoes (White Canvas Sneakers), so
a lockable look exists at 0 coins (`SEED_WARDROBE`, `src/routes/wardrobe.js`).
This record makes no ruling on the coin or ownership state.

**Carried forward from the AF record §5.1 and the AE record §5.1.** AG's
step 1 attests AF's "Production → Wardrobe shows the episode's event"
(#1913). That check is now **ATTESTED**, in this record; the AF record
is not edited. The rest remain **NOT ATTESTED at filing**, and none is
inferred:

| PR | What to watch | Standing |
|---|---|---|
| #1913 (AF §5.1) | Production → Wardrobe shows the episode's event | ATTESTED by AG step 1 |
| #1912 (AF §5.1) | Start Episode lands on Production → Assets | NOT ATTESTED |
| #1914 (AF §5.1) | The Phone tab leads with Preview Phone | NOT ATTESTED |
| #1922 (AF §5.1) | Save draft persists across a reload | NOT ATTESTED |
| #1915 (AF §5.1) | The version routes answer 501 | NOT ATTESTED |
| #1896 (AE §5.1, carried by AF) | Stream events arrive live through nginx, not buffered into one burst | NOT ATTESTED |
| #1896 (AE §5.1, carried by AF) | No doubled updates between live events and the REST refresh | NOT ATTESTED |
| #1900 (AE §5.1, carried by AF) | The Assistant streams, and an AI Writer action returns text | NOT ATTESTED |
| #1929 (AG) | A locked pick writes the first `episode_wardrobe` row, and it reads back as the episode's look | NOT ATTESTED (step 3 BLOCKED, step 4 not reached) |

Seven checks remain NOT ATTESTED from AF and AE, plus AG's own write
and read-back. `/health` 200 is a process check; it is not these.

## §6. Restarts

**ATTESTED (Evoni).**

| Restart | Deploy |
|---|---|
| 45 → 46 | AG |

**Beside it, from the register.** Deploy AF's restart was 44 → 45 (AF
record §6). AG's 45 → 46 follows it with no gap.

## §7. Hand-run schema changes

**ATTESTED (Evoni).** The second hand-run migration in this series:

- **File:** `20260925000001-add-approval-columns-to-episode-wardrobe.js`.
- **Run by hand as `postgres`.**
- **Before the code**, in **one transaction**.
- **Five columns added** to `episode_wardrobe`: `approval_status`,
  `approved_by`, `approved_at`, `rejection_reason`, `deleted_at`.
- **The `SequelizeMeta` row inserted.**
- **Table verified at 16 columns before `COMMIT`.**
- **No backfill ran**, because the table holds 0 rows.
- **`check-pending-migrations`** then reported 3 pending of 217, "the
  same three" (§4.1).

**MEASURED**, the migration file at `5a60f3278`:

| Column | Type in the file | Nullability / default | Lines |
|---|---|---|---|
| `approval_status` | `Sequelize.STRING(50)` | `allowNull: true`, `defaultValue: 'pending'` | 55–60 |
| `approved_by` | `Sequelize.STRING(255)` | `allowNull: true` | 61–65 |
| `approved_at` | `Sequelize.DATE` | `allowNull: true` | 66–70 |
| `rejection_reason` | `Sequelize.TEXT` | `allowNull: true` | 71–75 |
| `deleted_at` | `Sequelize.DATE` | `allowNull: true` | 76–80 |

- **Five columns.** The file's five are the five Evoni names, with the
  same names. `EpisodeWardrobe` declares the first four with the same
  types (`src/models/EpisodeWardrobe.js` lines 77–97) and maps the
  fifth as `deletedAt` (line 108). Evoni's account gives no column
  types, so the types above are the file's, not attested.
- **11 + 5 = 16.** The attested pre-deploy read (AF record §7.1; the
  same eleven quoted in #1929's commit body and the migration header,
  lines 6–8) is exactly 11 columns: `id`, `episode_id`, `wardrobe_id`,
  `scene`, `scene_id`, `notes`, `worn_at`, `times_worn`,
  `is_episode_favorite`, `created_at`, `updated_at`. None of the five
  is among them, so each `addColumn` runs (each is guarded by
  `describeTable`, lines 94, 97–111), and 11 + 5 = 16 matches her
  "table verified at 16 columns".
- **The backfill touched nothing.** The only data change is
  `UPDATE episode_wardrobe SET approval_status = 'approved' WHERE
  approval_status IS NULL OR approval_status = 'pending'` (lines
  114–118), run only when this run added `approval_status` (lines 96,
  113). On a table of 0 rows (ATTESTED, PR #1929 comment) it updates no
  row. That is consistent with her "No backfill ran because the table
  holds 0 rows": whether she executed that `UPDATE` against zero rows or
  skipped it, no row changes. Which statements she ran is not measured.
- **The `tableExists` guard.** `up` returns without change, after a
  `console.warn`, when `episode_wardrobe` does not exist (lines 90–93);
  `down` does the same (lines 125–128). It was added for CI's fresh
  database, where no live migration creates the table (PR #1929
  comment). It did not apply in production: production has the table,
  as the attested 11-column read and the attested 16-column
  verification both show.
- **Pending 216 → 217.** This file is the one migration the range adds
  (§2); recorded in `SequelizeMeta`, it moves the total from 216 to 217
  and leaves the pending count at 3, the same three (§4.1).
- The header states the deploy order: "run this migration, then deploy
  the code" (line 47).

What the repository cannot confirm: that the columns exist in
production, the database role used, the transaction, the
`SequelizeMeta` row, the 16-column verification or the row count. All
stay ATTESTED. The repository records no hand-run SQL.

### §7.1 Production read after AG: `episode_wardrobe`'s constraints and indexes

**ATTESTED (Evoni, 2026-09-25, issue #1930 comment).**

- `UNIQUE (episode_id, wardrobe_id)` exists twice on `episode_wardrobe`:
  `episode_wardrobe_episode_id_wardrobe_id_key` and
  `unique_episode_wardrobe`. So `/wardrobe/select`'s
  `ON CONFLICT (episode_id, wardrobe_id)` has the constraint it needs.
  #1929 had only inferred it from that clause; this is the measurement
  on the host.
- The table has 12 indexes, several of them duplicates: `episode_id` is
  indexed three times, `wardrobe_id` three times, and the two unique
  constraints are identical. Evoni, verbatim: "accumulated cruft rather
  than a problem — worth a cleanup task eventually, not now."

**MEASURED**, beside it, only what the basis declares:
`EpisodeWardrobe` declares a unique index on `['episode_id',
'wardrobe_id']` named `unique_episode_wardrobe` and plain indexes on
`episode_id` and `wardrobe_id` (`src/models/EpisodeWardrobe.js` lines
111–123). `/wardrobe/select`'s conflict target is
`ON CONFLICT (episode_id, wardrobe_id)` (`src/routes/wardrobe.js`
line 1297); `linkEpisodeWardrobe`'s header names the same dependence
(`src/services/episodeWardrobeLinks.js` lines 9–10).

This record makes no ruling and changes nothing. The cleanup is not
filed.

## §8. Basis statement

**MEASURED.** After Deploy AG, production's tree is this record's basis,
`5a60f3278`. No commit on `origin/main` up to and including `5a60f3278`
is undeployed, on Evoni's attested list.

**Merged after AG, undeployed** (MEASURED at filing):

```
$ git log --oneline --first-parent 5a60f3278..origin/main
```

No output: `origin/main` is `5a60f3278` at filing (§1), so nothing has
merged after AG.

## §9. What this document does not do

This document:

- does not rule on which database the running API serves (§4.1), and
  re-derives no production data;
- does not confirm any fact of the hand-run migration beyond the file's
  own content (§7), or the constraint and index read (§7.1), and rules
  on none of them;
- does not rule on the pending host restart (§2.2), and does not act on
  it;
- does not rule on any §5.1 check, on the coin or ownership state
  (#1932, whose premise the correction revises), or on the missing
  images (#1931), beyond citing the issues;
- does not file the index cleanup (§7.1);
- does not edit the AF record, the AE record, `DEVELOPMENT_WORKFLOW.md`
  or any migration. Every document named above is cited, not edited.
  AF's #1913 check is recorded as attested here, not there;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS,
  database or Cognito contact. Every ATTESTED claim above is Evoni's own
  account, taken outside any agent session. Every MEASURED claim is a
  repository read this filing session performed itself, not against any
  host;
- records no secret anywhere above.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from the AF record §10. Nothing minted here.

## §Standing

- §1–§4 and §7 each carry an ATTESTED clause and a MEASURED clause,
  marked separately and never merged into one standing:
  - ATTESTED: Evoni's own account of actions taken personally on the
    production host, database and running app, not reproducible from a
    clone;
  - MEASURED: a read of this repository, reproducible by anyone with a
    clone.
- No attested count differs from the measurement (§2). The time is
  recorded as attested, with the end commit's merge beside it (§3).
- The hand-run migration is ATTESTED; the file's five columns and types
  are MEASURED beside it and match her five names; 11 + 5 = 16 matches
  her verified count; the backfill touches no row on the attested 0
  rows; the `tableExists` guard did not apply in production (§7).
- §2.1 and §2.2 are ATTESTED only; the host restart is still pending.
- §5 is MEASURED for what the code does; that it is live rests on §2.
  §5.1's app-test steps 1 and 2 are ATTESTED PASS, step 3 is ATTESTED
  BLOCKED (not failed; an out-of-reach 385-coin item, per Evoni's
  correction), step 4 was not reached. AF's #1913 check
  is ATTESTED by step 1; the other seven carried checks are NOT
  ATTESTED at filing.
- §7.1's constraint and index read is ATTESTED, with no ruling.
- Nothing in this document is labelled RULED, and nothing is INFERRED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
  agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1930.*
