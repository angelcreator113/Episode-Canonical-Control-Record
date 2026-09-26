| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AI, 2026-09-26, backend and frontend, with a hand-run migration, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AH.md` (the AH record, filed in the same
commit as this one). This document follows that one rather than editing
it. Basis: `2b2584fbd61b9214fd9c32918724933096c9b2e6` (#1940), the tree
Deploy AI moved production to. `origin/main` at filing is the same
commit, `2b2584fbd61b9214fd9c32918724933096c9b2e6` (§8).

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

The deploy is lettered AI, continuing after Deploy AH of the AH record.
It is the third hand-run migration in this series (§7), after AF's and
AG's, and the first whose `down` cannot undo it (§7.2).

## §0. Evoni's account, verbatim

**ATTESTED (Evoni, 2026-09-26, issue #1944):**

> Deploy AI done. Restart 47 → 48, health `200`. Production at `2b2584fb`.
> Deploy AI — 2026-09-26 ~01:00 UTC, backend and frontend: 95418e94 → 2b2584fb, two commits (#1938, #1940), 9 files under src/, node -c passed on all nine. Migration 20260926000000-dedupe-episode-wardrobe-indexes.js run by hand as postgres before the code: the CLI refused because it still stops at the stale 20260818000000-add-deleted-at-to-decision-logs, so the drops were run directly in one transaction. episode_wardrobe went from 12 indexes to 7 — dropped episode_wardrobe_episode_id_wardrobe_id_key (constraint), episode_wardrobe_episode_id_idx, idx_episode_wardrobe_episode, episode_wardrobe_wardrobe_id_idx and idx_episode_wardrobe_wardrobe; renamed idx_episode_wardrobe_episode_id → episode_wardrobe_episode_id and idx_episode_wardrobe_wardrobe_id → episode_wardrobe_wardrobe_id; SequelizeMeta row inserted. The three locked episode_wardrobe rows were untouched. Backup /var/www/html.bak-20260926-pre1940; build 35.09s; entry index-C_ulLbuu.js; HTTP 200. Restart 47 → 48; health 200.
> Worth noting that the CLI refusal is now a recurring tax: every migration has to go in by hand because of one stale file from August. Clearing those three pending migrations would be worth doing — it's the last piece of the drift.

The last two sentences are Evoni's own assessment; they are recorded as
she gave them, with no ruling (§4.1). Her app-test results and her
statement on the rollback are recorded in §5.1 and §7.2. The sections
below split the account into its claims and set each beside what the
repository measures.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `95418e94` to `2b2584fb`. Evoni's
account gives no `git status` read for this deploy.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 5a60f3278 95418e943 2b2584fbd origin/main HEAD
5a60f3278b3d176a0a7bebc73f907b0945258e08
95418e94347b86dc8ece58602bb81ec5828ef129
2b2584fbd61b9214fd9c32918724933096c9b2e6
2b2584fbd61b9214fd9c32918724933096c9b2e6
2b2584fbd61b9214fd9c32918724933096c9b2e6
$ git merge-base --is-ancestor 95418e943 2b2584fbd; echo "exit=$?"
exit=0
```

Deploy AH ends at `95418e943` (AH record §1, §8); Deploy AI begins
there.

## §2. Deploy AI — 2026-09-26 ~01:00 UTC, backend and frontend, with a migration

**ATTESTED.**
- Two commits (#1938, #1940), 9 files under `src/`.
- `node -c` passed on all nine.
- One migration, run by hand as `postgres` before the code (§7).
- A frontend build (§2.1).
- `pm2 restart`: restart count 47 → 48. `/health` returned 200.

**MEASURED**, `git log --oneline --first-parent 95418e943..2b2584fbd`:

```
2b2584fbd fix(wardrobe): the styling game offers, shows and locks only what Lala can wear [skip-automerge] (#1940)
ccccafff5 fix(coins,wardrobe): coins never go below zero; episode_wardrobe keeps one index of each [skip-automerge] (#1938)
```

```
$ git rev-list --count --first-parent 95418e943..2b2584fbd
2
$ git rev-list --count 95418e943..2b2584fbd
2
```

Two commits, the same two PR numbers, matching Evoni's count.
`git diff --stat 95418e943 2b2584fbd -- src/`:

```
 ...260926000000-dedupe-episode-wardrobe-indexes.js | 290 ++++++++++++++++++
 src/models/EpisodeWardrobe.js                      |   5 +
 src/routes/evaluation.js                           |  20 +-
 src/routes/wardrobe.js                             | 325 ++++++++++++++++++---
 src/routes/worldEvents.js                          |   5 +
 src/services/coinBalanceGuard.js                   | 100 +++++++
 src/services/episodeCompletionService.js           |  48 ++-
 src/services/financialTransactionService.js        |  18 +-
 src/services/wardrobeReach.js                      |  59 ++++
 9 files changed, 811 insertions(+), 59 deletions(-)
```

Nine files, matching Evoni's count. The first line is the migration,
`src/migrations/20260926000000-dedupe-episode-wardrobe-indexes.js`
(truncated by `--stat`); it is one of the nine. `git diff --stat`
scoped to `frontend/`, `src/migrations/`, the package files and
`docs/`:

```
$ git diff --stat 95418e943 2b2584fbd -- frontend/
 .../src/components/EpisodeWardrobeGameplay.jsx     |  44 +++++++--
 .../components/EpisodeWardrobeGameplay.test.jsx    | 104 +++++++++++++++++++++
 frontend/src/utils/wardrobeReach.js                |  44 +++++++++
 frontend/src/utils/wardrobeReach.test.js           |  35 +++++++
 4 files changed, 218 insertions(+), 9 deletions(-)
$ git diff --name-status 95418e943 2b2584fbd -- src/migrations/
A	src/migrations/20260926000000-dedupe-episode-wardrobe-indexes.js
$ git diff --stat 95418e943 2b2584fbd -- package.json package-lock.json frontend/package.json frontend/package-lock.json
$ git diff --stat 95418e943 2b2584fbd -- docs/
$ git ls-tree -r --name-only 95418e943 src/migrations | wc -l
217
$ git ls-tree -r --name-only 2b2584fbd src/migrations | wc -l
218
$ git ls-files src/migrations | wc -l
218
```

Four `frontend/` files, two of them tests; two are source the build
bundles (`EpisodeWardrobeGameplay.jsx`, `utils/wardrobeReach.js`).
Evoni's account gives no `frontend/` file count; it attests a build
(§2.1). One migration file added (status `A`), matching her account;
217 → 218 migration files. No package change. No `docs/` file.

- **`node -c`.** The filing session's worktree is the basis
  (`git diff --name-only 2b2584fbd HEAD` prints nothing before this
  record's commit), and it ran `node -c` on the nine files:

  ```
  $ n=0; for f in src/migrations/20260926000000-dedupe-episode-wardrobe-indexes.js src/models/EpisodeWardrobe.js src/routes/evaluation.js src/routes/wardrobe.js src/routes/worldEvents.js src/services/coinBalanceGuard.js src/services/episodeCompletionService.js src/services/financialTransactionService.js src/services/wardrobeReach.js; do node -c "$f" && n=$((n+1)) && echo "ok $f"; done; echo "all $n ok"
  ok src/migrations/20260926000000-dedupe-episode-wardrobe-indexes.js
  ok src/models/EpisodeWardrobe.js
  ok src/routes/evaluation.js
  ok src/routes/wardrobe.js
  ok src/routes/worldEvents.js
  ok src/services/coinBalanceGuard.js
  ok src/services/episodeCompletionService.js
  ok src/services/financialTransactionService.js
  ok src/services/wardrobeReach.js
  all 9 ok
  ```

  That is a repository read; the host's own `node -c` run is ATTESTED.
- **Outside `src/` and `frontend/`**, the range changes thirteen files
  under `tests/` (#1938: ten; #1940: three) and nothing under
  `scripts/`. `git diff --stat 95418e943 2b2584fbd`: 26 files, 2099
  insertions, 73 deletions. None of these is served.

**Classification**, from each commit's own `git show --stat`:

| Commit | PR | Class | Served files it changes |
|---|---|---|---|
| `ccccafff5` | #1938 | backend and migration | 8 files under `src/`: the migration `src/migrations/20260926000000-dedupe-episode-wardrobe-indexes.js`, `models/EpisodeWardrobe.js`, `routes/evaluation.js`, `routes/wardrobe.js`, `routes/worldEvents.js`, `services/coinBalanceGuard.js` (new), `services/episodeCompletionService.js`, `services/financialTransactionService.js` |
| `2b2584fbd` | #1940 | both | `src/routes/wardrobe.js`, `src/services/wardrobeReach.js` (new); `EpisodeWardrobeGameplay.jsx`, `utils/wardrobeReach.js` (plus 2 frontend test files) |

Per commit, `src/` files are 8 + 2 = 10; `src/routes/wardrobe.js` is
touched by both, giving the net 9. #1938 is the only commit that touches
`src/migrations/`.

**Counts, side by side.**

| Claim | ATTESTED | MEASURED |
|---|---|---|
| Commits | 2 (#1938, #1940) | 2 first-parent, 2 total; the same two PR numbers |
| Files under `src/` | 9 | 9, the migration among them |
| Frontend | a build (§2.1); no file count given | 4 files under `frontend/`, 2 of them tests |
| Migrations | one, `20260926000000-dedupe-episode-wardrobe-indexes.js` | one file added under `src/migrations/`, the same name; 217 → 218 files |
| Packages | not stated | no output for the root or `frontend/` package files |

No count differs.

### §2.1 Frontend

**ATTESTED (Evoni).**
- Backup of the served bundle: `/var/www/html.bak-20260926-pre1940`.
- Frontend build: 35.09s.
- Entry bundle: `index-C_ulLbuu.js`.
- HTTP 200 after the deploy.

**Beside it, from the register.** The AH record §2.1 attests AH's entry
as `index-B-sNqrLl.js`; that is the bundle AI replaced. Both names stay
ATTESTED.

**What the repository cannot confirm.** Bundle hashes are produced by a
build on the host and are not committed, so no read of this repository
confirms the entry name, the build time, the backup path or the HTTP
status. All four stay ATTESTED.

### §2.2 Housekeeping: the pending host restart

**ATTESTED (AF record §2.2; carried as pending by the AG and AH
records).** After AF the box wanted a system restart. Evoni's AI account
does not report it as done. It is recorded here as **still pending**,
with no ruling.

## §3. The time

**ATTESTED:** 2026-09-26 ~01:00 UTC.

**MEASURED:** the end commit `2b2584fbd` (#1940) was committed
2026-09-26 00:52:17 UTC:

```
$ git log -1 --format=%cI 2b2584fbd
2026-09-25T20:52:17-04:00
$ TZ=UTC git log --first-parent --format='%h %cd %s' --date=iso-local 95418e943..2b2584fbd
2b2584fbd 2026-09-26 00:52:17 +0000 fix(wardrobe): the styling game offers, shows and locks only what Lala can wear [skip-automerge] (#1940)
ccccafff5 2026-09-26 00:20:42 +0000 fix(coins,wardrobe): coins never go below zero; episode_wardrobe keeps one index of each [skip-automerge] (#1938)
```

| Deploy | ATTESTED time | MEASURED: committer date of the attested end commit |
|---|---|---|
| AI | 2026-09-26 ~01:00 | `2b2584fbd` 2026-09-26 00:52:17 |

The attested ~01:00 is after that merge. The attested AH lock at
00:39:29 (AH record §5.1) falls between AH (~00:15) and AI (~01:00), so
production was at `95418e94` when those rows were written.

## §4. Pre-deploy checks

### §4.1 `scripts/check-pending-migrations.js` and the CLI

**ATTESTED.** The CLI "refused because it still stops at the stale
20260818000000-add-deleted-at-to-decision-logs"; the migration's effect
was applied by hand (§7). Evoni's account refers to "those three
pending migrations" but reports no `check-pending-migrations` run for
AI, so no count after AI is attested.

**Beside it, from the register.** The AG record §4.1 attests 3 pending
of 217, "the same three".

**MEASURED.**
- The tree goes from 217 to 218 migration files (§2); the one added is
  `20260926000000-dedupe-episode-wardrobe-indexes.js`, whose
  `SequelizeMeta` row Evoni attests she inserted (§7). With that row,
  the pending count has no reason to move from AG's 3; that it is 3 on
  the host is not attested for AI.
- The file the CLI stops at is in the tree:
  `src/migrations/20260818000000-add-deleted-at-to-decision-logs.js`
  (`git ls-files src/migrations | grep 20260818000000`). It sorts ahead
  of `20260926000000`, and sequelize-cli runs pending files in name
  order, stopping at the first failure. `docs/MIGRATION_DRIFT_READ.md`
  §1 ("The pending queue, in run order") records why that file fails
  (`relation "decision_logs" does not exist`) and that
  `20260902000000-create-asset-roles.js` behind it fails too, with
  `20260922000000-add-category-format-to-world-events.js` a guarded
  no-op. Those three are the three still pending.
- **Clearing them is #1942**, "Clear the three pending migrations so the
  CLI runs again (decision_logs retired, asset_roles guarded)", open at
  filing. This record cites it and rules on nothing in it; Evoni's
  "worth doing" (§0) is recorded as her assessment.
- `scripts/check-pending-migrations.js` and `DEVELOPMENT_WORKFLOW.md` are
  unchanged in the range (`git diff --stat 5a60f3278 2b2584fbd --
  scripts/check-pending-migrations.js DEVELOPMENT_WORKFLOW.md` prints
  nothing).

## §5. What went live

**MEASURED**, from the commits' own diffs and messages, lines cited at
`2b2584fbd`. That these are live rests on the ATTESTED deploy (§2).

- **Coins never go below zero (#1938, `ccccafff5`, `Task: #1933`).**
  - `src/services/coinBalanceGuard.js`: `changeCoins` (line 57) writes
    `coins = coins + :delta … WHERE id = :stateId AND (:delta >= 0 OR
    coins + :delta >= 0)` (line 67; doc line 12) and throws
    `InsufficientCoinsError` (class, line 22) when nothing is written.
  - `/select` (`src/routes/wardrobe.js` line 1305) and `/purchase`
    (line 1613) spend through `spendCoins` inside their ledger
    transaction. Episode completion moves coins through `changeCoins`
    (`src/services/episodeCompletionService.js` line 485), after a
    `dryRun` preview (`finalizeEpisodeFinancials`,
    `src/services/financialTransactionService.js` line 333). The
    manual state edit refuses a coins value that is not a whole number
    of at least 0 (`src/routes/evaluation.js`, the
    `/characters/:key/state/update` handler, `INVALID_COINS`).
- **`episode_wardrobe` keeps one index of each (#1938, `Task: #1933`).**
  The migration is §7. `EpisodeWardrobe`'s `indexes` block now names
  the two single-column indexes `episode_wardrobe_episode_id` and
  `episode_wardrobe_wardrobe_id` beside `unique_episode_wardrobe`
  (`src/models/EpisodeWardrobe.js` lines 114–128; comment lines
  111–113).
- **The styling game offers, shows and locks only what Lala can wear
  (#1940, `2b2584fbd`, `Task: #1937`).**
  - One reach rule, `itemReach` (`src/services/wardrobeReach.js` line
    42; frontend mirror `frontend/src/utils/wardrobeReach.js`): owned,
    or coin-locked and affordable, or reputation-locked and qualified.
  - `browse-pool` scores reach with `itemReach` (`src/routes/wardrobe.js`
    line 1049) and tops up the required slots with reachable items
    through `ensureReachableRequiredSlots` (defined line 24, called line
    1218).
  - `POST /wardrobe/lock-outfit-atomic` (line 1412, `requireAuth`)
    checks every piece and the total cost up front (lines 1450–1455),
    spends through the guard (line 1477), and returns `coins_after`
    (line 1545). `lockOutfit`
    (`frontend/src/components/EpisodeWardrobeGameplay.jsx` line 520)
    makes that one request (line 528) and sets the header's balance
    from `coins_after` (line 535).
  - Closet and Search apply the same reach rule (`closetWithReach`).

### §5.1 Post-deploy checks

**ATTESTED (Evoni, 2026-09-26, app test, verbatim):**

> Deploy AI app-test results, ATTESTED 2026-09-26. The COINS header now reads 945, matching the database — the stale-header fix is confirmed live. The locked outfit persists: Outfit Locked with outfit, shoes and jewellery ticked, Getting Ready 3/5. One unexplained change: Synergy now shows 20/100 "Nervous", where immediately after the lock under AH it showed 36/100 "Unsure", with the same three pieces and no re-lock in between. Check whether #1940 or #1938 changed the synergy calculation, and if so whether the new figure is the correct one. Report before changing anything.
> I didn't check the Closet labels — the outfit is locked … Not worth spending the first-ever locked outfit on a label check. Let's leave it.

| Check | Standing |
|---|---|
| The COINS header matches the database (945) | ATTESTED PASS; see the MEASURED note below on what it exercises |
| The locked outfit persists across the deploy (Outfit Locked; Getting Ready 3/5) | ATTESTED PASS |
| The three locked rows untouched by the index cleanup | ATTESTED (§0) |
| Synergy reads 20/100 "Nervous" where AH showed 36/100 "Unsure" | ATTESTED observation; explained below (#1943) |
| Closet labels (#1940) | Deliberately not checked (Evoni's words above); NOT ATTESTED |
| "For This Event" offers the owned Cotton Sundress and White Canvas Sneakers (#1940) | NOT ATTESTED |
| A lock whose total is unaffordable is refused and writes nothing (#1940) | NOT ATTESTED |
| A spend that would take coins below zero is refused (#1938) | NOT ATTESTED |

**Beside the header check, MEASURED.** The header prints `coins`
(`EpisodeWardrobeGameplay.jsx` line 582), which is
`localCoins ?? characterState.coins` (line 194); `localCoins` starts
`null` (line 193), and `characterState` is fetched by `EpisodeDetail`
when the page loads (`frontend/src/pages/EpisodeDetail.jsx` line 333).
So on a fresh page load the header shows the server's balance with or
without #1940. #1940's change is that a **lock** now sets the header
from the server's `coins_after` (line 535); the per-piece lock under AH
did not (AH record §5.1). Evoni's AI read was taken with the outfit
already locked and no new lock or purchase, so it confirms that the
header agrees with the database on load; it does not exercise the
post-lock refresh #1940 adds. The attested "stale-header fix is
confirmed live" is recorded as she gave it and is not upgraded.

**The Synergy change: neither #1938 nor #1940 changed the calculation.
MEASURED at `2b2584fbd`.**

- `calculateSynergy` (`EpisodeWardrobeGameplay.jsx` lines 127–183) is
  a browser formula. Its base term is the average `match_score` × 0.6,
  capped at 35 (lines 132–133); tier harmony is `max(0, 15 −
  variance × 8)` (lines 153–156); coverage is `min(10, pieces × 1.5)`
  (line 168); the total is rounded (line 170). The confidence bands put
  20 in "Nervous" (from 0) and 36 in "Unsure" (from 30) (lines 65–71).
- No commit in the range changed that function, the restore of a locked
  outfit, `GET /wardrobe/outfit/:episode_id`, `getOutfitScore` or
  `wardrobeIntelligenceService`:

  ```
  $ git log --oneline 95418e943..2b2584fbd -L '/^function calculateSynergy/,/^}/:frontend/src/components/EpisodeWardrobeGameplay.jsx' | head -5; echo "exit=$?"
  exit=0
  $ git log --oneline 95418e943..2b2584fbd -L '/outfit\/:episode_id/,+60:src/routes/wardrobe.js' | head -3; echo "exit=$?"
  exit=0
  $ git log --oneline 95418e943..2b2584fbd -L '/^async function getOutfitScore/,+45:src/routes/wardrobe.js' | head -3; echo "exit=$?"
  exit=0
  $ git diff --stat 95418e943 2b2584fbd -- src/services/wardrobeIntelligenceService.js; echo "exit=$?"
  exit=0
  $ git diff 95418e943 2b2584fbd -- frontend/src/components/EpisodeWardrobeGameplay.jsx | grep -c -e 'calculateSynergy' -e 'match_score \* ' -e 'baseAvg'
  0
  ```

  `git diff 95418e943 2b2584fbd -- src/routes/wardrobe.js` has hunks
  only at the requires (old lines 7–17), `browse-pool`, `/select`, the
  new `lock-outfit-atomic` and `/purchase`; the component's diff has
  hunks only at the imports, the reach state, `loadCloset` and
  `closetWithReach`, the closet and search filters, `purchaseItem`'s
  `markOwnedInCloset`, `lockOutfit` and a card label (§5).
- **The explanation is #1943's diagnosis** ("Styling game: a reloaded
  locked outfit scores Synergy without match scores (36 → 20); the
  browser runs a second scoring engine", open at filing), which the
  code agrees with. `match_score` exists only in `browse-pool`'s
  response; no `wardrobe` column holds it
  (`git grep -n match_score 2b2584fbd -- src/models/Wardrobe.js
  src/migrations` finds only a comment in
  `20260720000000-add-outfit-pieces-to-world-events.js`). Straight
  after the lock the slots held the pool's copies, which carry it. On a
  later load the locked outfit is restored from
  `GET /api/v1/wardrobe/outfit/:episode_id`
  (`EpisodeWardrobeGameplay.jsx` lines 276–292), whose query is
  `SELECT w.*` from `episode_wardrobe` joined to `wardrobe`
  (`src/routes/wardrobe.js` lines 126, 140–150), so no piece has a
  `match_score` and the base term is 0. For three pieces of one tier:
  tier harmony 15 + coverage 3 × 1.5 = 4.5 = 19.5, rounded to **20**.
  With a base of about 16 from the pool's scores, the same outfit gave
  **36**. The drop is a reload artefact, not a change in #1938 or
  #1940.
- **Which figure is correct.** Neither 36 nor 20 is the figure
  evaluation uses. Evaluation reads the canonical server scorer:
  `getOutfitScore` (`src/routes/wardrobe.js` line 1761), an adapter
  over `wardrobeIntelligenceService`'s `scoreOutfitForEvent` (lines
  1795–1796), called by evaluation (`src/routes/evaluation.js` lines
  279, 302, `synergy_score` line 312) and by episode completion
  (`src/services/episodeCompletionService.js` lines 252–275), and
  exposed as `GET /api/v1/wardrobe/outfit-score/:episodeId` (line 194).
  The game's own figure goes to `onOutfitComplete` (line 540). So the
  attested 36 and 20 are display figures only; the server's figure for
  this outfit is not attested and not derived here.

This record reports and changes nothing, per Evoni's "Report before
changing anything". It makes no ruling on #1943's ask.

**Carried forward from the AH record §5.1.** The rest remain **NOT
ATTESTED at filing**, and none is inferred:

| PR | What to watch | Standing |
|---|---|---|
| #1929 (AG) | Locked rows write and read back | ATTESTED by AH; the outfit persists across AI (above) |
| #1935 (AH) | Real garment images | ATTESTED by AH |
| #1936 (AH) | Approve, reject, approval-status and suggestions answer without an eager-loading error | NOT ATTESTED |
| #1912 (AF §5.1) | Start Episode lands on Production → Assets | NOT ATTESTED |
| #1914 (AF §5.1) | The Phone tab leads with Preview Phone | NOT ATTESTED |
| #1922 (AF §5.1) | Save draft persists across a reload | NOT ATTESTED |
| #1915 (AF §5.1) | The version routes answer 501 | NOT ATTESTED |
| #1896 (AE §5.1) | Stream events arrive live through nginx, not buffered into one burst | NOT ATTESTED |
| #1896 (AE §5.1) | No doubled updates between live events and the REST refresh | NOT ATTESTED |
| #1900 (AE §5.1) | The Assistant streams, and an AI Writer action returns text | NOT ATTESTED |

Eight checks remain NOT ATTESTED from AH, AF and AE, plus AI's four
listed above. `/health` 200 is a process check; it is not these.

## §6. Restarts

**ATTESTED (Evoni).**

| Restart | Deploy |
|---|---|
| 47 → 48 | AI |

**Beside it, from the register.** AG's restart was 45 → 46 (AG record
§6) and AH's 46 → 47 (AH record §6). AI's 47 → 48 follows with no gap.

## §7. Hand-run schema changes

**ATTESTED (Evoni).** The third hand-run migration in this series:

- **File:** `20260926000000-dedupe-episode-wardrobe-indexes.js`.
- **Run by hand as `postgres`, before the code**, because the CLI stops
  at `20260818000000` (§4.1). **The drops were run directly, in one
  transaction.**
- **12 indexes → 7.**
- **Dropped (five):**
  1. `episode_wardrobe_episode_id_wardrobe_id_key` (constraint)
  2. `episode_wardrobe_episode_id_idx`
  3. `idx_episode_wardrobe_episode`
  4. `episode_wardrobe_wardrobe_id_idx`
  5. `idx_episode_wardrobe_wardrobe`
- **Renamed (two):** `idx_episode_wardrobe_episode_id` →
  `episode_wardrobe_episode_id`; `idx_episode_wardrobe_wardrobe_id` →
  `episode_wardrobe_wardrobe_id`.
- **The `SequelizeMeta` row inserted.**
- **The three locked `episode_wardrobe` rows untouched.**

**Beside it, from the register.** The AG record §7.1 attests the 12
indexes: `episode_id` three times, `wardrobe_id` three times, and
`UNIQUE (episode_id, wardrobe_id)` twice
(`episode_wardrobe_episode_id_wardrobe_id_key` and
`unique_episode_wardrobe`). Those groups hold 2 + 3 + 3 = 8 of the 12;
keeping one of each drops 5, and 12 − 5 = 7 matches her count (the 3
kept plus the 4 indexes outside the groups).

### §7.1 What the file would have done, beside what was done

**MEASURED**, the migration file at `2b2584fbd`:

- **Groups and kept names.** `GROUPS` (lines 67–71): the unique pair
  keeps `unique_episode_wardrobe`, `(episode_id)` keeps
  `episode_wardrobe_episode_id`, `(wardrobe_id)` keeps
  `episode_wardrobe_wardrobe_id`. It groups only exact duplicates, a
  plain btree over exactly those columns (`parseIndexDef`, lines
  82–88), read from `pg_indexes` at run time (`readIndexes`, lines
  90–107, `ORDER BY i.indexname`, line 103).
- **Which member it keeps.** The member already named as the model
  names it; otherwise the first by name, renamed (lines 179, 192–201).
  Constraint-owned members are dropped with `DROP CONSTRAINT IF EXISTS`,
  others with `DROP INDEX IF EXISTS` (lines 125–131).
- **Compared with her run, group by group** (from her attested names):

  | Group | Members (attested) | The file would keep | Evoni kept | End name |
  |---|---|---|---|---|
  | unique pair | `unique_episode_wardrobe`, `episode_wardrobe_episode_id_wardrobe_id_key` | `unique_episode_wardrobe` (model-named) | `unique_episode_wardrobe` | `unique_episode_wardrobe` |
  | `(episode_id)` | `episode_wardrobe_episode_id_idx`, `idx_episode_wardrobe_episode`, `idx_episode_wardrobe_episode_id` | `episode_wardrobe_episode_id_idx` (first by name; none model-named), renamed | `idx_episode_wardrobe_episode_id`, renamed | `episode_wardrobe_episode_id` |
  | `(wardrobe_id)` | `episode_wardrobe_wardrobe_id_idx`, `idx_episode_wardrobe_wardrobe`, `idx_episode_wardrobe_wardrobe_id` | `episode_wardrobe_wardrobe_id_idx` (first by name), renamed | `idx_episode_wardrobe_wardrobe_id`, renamed | `episode_wardrobe_wardrobe_id` |

  The file would have kept a different member of each single-column
  group ("first by name": `pg_indexes.indexname` is type `name`, which
  sorts bytewise, so `e…` before `i…`). Evoni kept the other member and
  dropped the one the file would have kept. **The end state is the
  same:** three kept indexes, under the three names the model declares
  (`src/models/EpisodeWardrobe.js` lines 114–128), and five objects
  dropped. That her kept members were exact duplicates by definition is
  ATTESTED by her choice of drops, not measured; production's index
  definitions were not captured.
- **`tableExists` guard** (lines 147–150): did not apply; production has
  the table (AG record §7, §7.1).

What the repository cannot confirm: the drops, the renames, the index
count before and after, the database role, the transaction, the
`SequelizeMeta` row, or that the three rows were untouched. All stay
ATTESTED. The repository records no hand-run SQL.

### §7.2 Rollback: the migration's `down` will not restore these indexes

**ATTESTED (Evoni, verbatim), stated plainly at her request:**

> because I ran the drops by hand, the migration's `down` has nothing to read and would report 'nothing to restore.' Restoring those five indexes would be a manual job from the list in the record. Worth stating plainly so nobody trusts a rollback that won't happen.

**MEASURED beside it**, the file at `2b2584fbd`:

- `up` writes its own undo record as a **comment on the kept unique
  index**: `RECORD_MARKER = 'Task #1933 index cleanup record: '`
  (line 62), then `COMMENT ON INDEX <kept unique> IS '<marker><JSON of
  dropped, renamed, created>'` (lines 238–241). The record holds each
  dropped object's definition from `pg_get_indexdef` /
  `pg_get_constraintdef` (lines 95, 182–187).
- `down` reads only that comment (lines 256–257). When no index carries
  the marker it logs `no Task #1933 record on any episode_wardrobe
  index; nothing to restore.` and returns (lines 258–260).
- Evoni ran the drops directly rather than through `up`, and her
  account names no `COMMENT` statement. On her account, then, no record
  was written, and `down` would take the lines 258–260 branch and
  restore nothing. That is what she states.

**The manual restore, if one is ever needed**, is the five objects she
dropped, and the two renames reversed:

1. `episode_wardrobe_episode_id_wardrobe_id_key`: a `UNIQUE
   (episode_id, wardrobe_id)` constraint (AG record §7.1)
2. `episode_wardrobe_episode_id_idx`: an index on `(episode_id)`
3. `idx_episode_wardrobe_episode`: an index on `(episode_id)`
4. `episode_wardrobe_wardrobe_id_idx`: an index on `(wardrobe_id)`
5. `idx_episode_wardrobe_wardrobe`: an index on `(wardrobe_id)`

and `episode_wardrobe_episode_id` → `idx_episode_wardrobe_episode_id`,
`episode_wardrobe_wardrobe_id` → `idx_episode_wardrobe_wardrobe_id`.
The column each covers is from the AG record §7.1 group counts and the
names; **production's exact definitions were not captured** (no
`pg_get_indexdef` output is attested or recorded), so this record gives
no SQL for them. Outside the migration itself, nothing under `src/` or
`frontend/src/` names any of the five: a `git grep` at `2b2584fbd` for
the five names over `src` and `frontend/src` finds only
`src/migrations/20260926000000-dedupe-episode-wardrobe-indexes.js`
(header comment lines 9, 16–17; the constant, line 65).

## §8. Basis statement

**MEASURED.** After Deploy AI, production's tree is this record's basis,
`2b2584fbd`. No commit on `origin/main` up to and including `2b2584fbd`
is undeployed, on Evoni's attested list.

**Merged after AI, undeployed** (MEASURED at filing, after
`git fetch origin main`):

```
$ git log --oneline --first-parent 2b2584fbd..origin/main
$ echo "exit=$?"
exit=0
```

No output: `origin/main` is `2b2584fbd` at filing (§1), so nothing has
merged after AI.

## §9. What this document does not do

This document:

- does not rule on which database the running API serves, and
  re-derives no production data;
- does not confirm any fact of the hand-run changes beyond the file's
  own content (§7), and rules on none of them;
- does not rule on the three pending migrations or on #1942, and does
  not rule on #1943; it cites both;
- does not rule on the pending host restart (§2.2);
- does not edit the AH, AG or AF record, `docs/MIGRATION_DRIFT_READ.md`,
  or any migration;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS,
  database or Cognito contact. Every ATTESTED claim above is Evoni's own
  account, taken outside any agent session. Every MEASURED claim is a
  repository read this filing session performed itself; issue titles
  are GitHub reads, with nothing written;
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

Unchanged from the AG and AH records §10. Nothing minted here.

## §Standing

- §1–§4 and §7 each carry an ATTESTED clause and a MEASURED clause,
  marked separately and never merged into one standing.
- No attested count differs from the measurement (§2). The time is
  recorded as attested, with the end commit's merge beside it (§3).
- The hand-run index cleanup is ATTESTED. The file would have kept a
  different member of each single-column group; the end state, three
  indexes under the model's names, is the same (§7.1).
- The migration's `down` would restore nothing after a hand run: Evoni
  attests it, and the file's record-in-a-comment design is MEASURED
  beside it. The manual restore is the five named objects; their exact
  definitions were not captured (§7.2).
- §5.1: the header matching the database and the persisted outfit are
  ATTESTED PASS; the header read does not exercise #1940's post-lock
  refresh (MEASURED). The Synergy change is a reload artefact, not a
  change in #1938 or #1940 (MEASURED, as #1943 diagnoses); evaluation
  reads the server scorer, so 36 and 20 are display figures only.
  #1940's pool, closet and unaffordable-lock checks and #1938's
  below-zero refusal are NOT ATTESTED; the Closet labels were
  deliberately not checked.
- Nothing in this document is labelled RULED, and nothing is INFERRED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
  agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1944.*
