| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AJ, 2026-09-26, backend only, with the first `db:migrate` run through the CLI since the app user changed, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AI.md` (the AI record, #1947). This
document follows that one rather than editing it. Basis:
`272586eae2741442c7a1cab92a3941aff3821149` (#1947), the tree Deploy AJ
moved production to. `origin/main` at filing is the same commit (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Three standings appear below, each marked on its own claim and
never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production
  host, database or running app states. It cannot be reproduced from a
  clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce, and register
  documents already merged under `docs/audit/`.
- **NOT ATTESTED** marks a post-deploy check that Evoni's account does
  not report (§5.1). Nothing is inferred in its place.

This document closes no keystone, discharges no owed item, mints no FD,
XK or PE number, and rules on nothing.

The deploy is lettered AJ, continuing after Deploy AI of the AI record.
It is the first deploy in this series whose migrations went in through
`sequelize-cli db:migrate` rather than by hand (§7), and after it the
pending check reports 0 (§4.1).

## §0. Evoni's account, verbatim

**ATTESTED (Evoni, 2026-09-26, issue #1949):**

> Zero pending of 218. The drift is gone — the first clean migration state since 12 July, when the app user switched and nothing could migrate any more.
> Restart 48 → 49, health `200`. Production at `272586ea`.
> Deploy AJ — 2026-09-26 ~01:30 UTC, backend only, no frontend build: 2b2584fb → 272586ea, two commits (#1945, #1947), 2 files under src/, both migration files, node -c passed on both. Then db:migrate was run as postgres via DB_USER=postgres DB_PASSWORD=… for the one command, because the CLI reads DB_USER from .env and ignores PGUSER: a first attempt as episode_app_dev failed with "must be owner of table asset_roles". All three pending migrations then ran. 20260818000000 logged "decision_logs does not exist here; nothing to add deleted_at to. Skipped" and recorded itself. 20260902000000 adopted the existing asset_roles, added deleted_at, and created no indexes — each was already served by asset_roles_show_id_role_key_key, idx_asset_roles_show and idx_asset_roles_key. 20260922000000 recorded itself with no changes. check-pending-migrations then reported "OK: 0 pending of 218 migration files checked", the first clean state since the app user changed on 2026-07-12. Restart 48 → 49; health 200.
> That closes the thing that started this whole chain twenty-six hours ago: a migration that wouldn't run, which turned out to be a permissions wall, which turned out to be hiding seven weeks of drift, which turned out to be hiding five months of broken paths.

**ATTESTED (Evoni, 2026-09-26, confirmation for this record, verbatim):**

> Confirmed for the AJ record, ATTESTED 2026-09-26: all three migrations are recorded in SequelizeMeta — 20260818000000-add-deleted-at-to-decision-logs.js, 20260902000000-create-asset-roles.js and 20260922000000-add-category-format-to-world-events.js. SequelizeMeta holds 227 rows against 218 files in the tree, so nine recorded names have no matching file; check-pending-migrations ignores those by design. The first attempt as episode_app_dev is no longer inferred either way: the end state is all three recorded, however they got there.
> The 227-versus-218 gap is worth a line in the record too — nine recorded migrations whose files no longer exist, presumably from the dead trees the drift read mentions. Harmless, since the check only looks for files without rows, but it's part of the same history.
> That's the drift closed. What's left is the identity fix, and #1942 and #1943 landing.

The password in the `db:migrate` command is elided in her account
(`DB_PASSWORD=…`) and is not recorded here. Her closing sentences ("That
closes the thing …", "That's the drift closed", "What's left is …") are
her own assessment; they are recorded as she gave them, with no ruling
(§9). The sections below split the account into its claims and set each
beside what the repository measures.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `2b2584fb` to `272586ea`. Evoni's
account gives no `git status` read for this deploy.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 2b2584fbd 0e30ccef9 272586eae origin/main HEAD
2b2584fbd61b9214fd9c32918724933096c9b2e6
0e30ccef9fb5a2ac406ed483aca2825269f823f5
272586eae2741442c7a1cab92a3941aff3821149
272586eae2741442c7a1cab92a3941aff3821149
272586eae2741442c7a1cab92a3941aff3821149
$ git merge-base --is-ancestor 2b2584fbd 272586eae; echo "exit=$?"
exit=0
```

(`HEAD` is this filing session's worktree before this record's commit.)
Deploy AI ends at `2b2584fbd` (AI record §1, §8); Deploy AJ begins
there.

## §2. Deploy AJ — 2026-09-26 ~01:30 UTC, backend only

**ATTESTED.**
- Two commits (#1945, #1947), 2 files under `src/`, both migration files.
- `node -c` passed on both.
- No frontend build.
- `db:migrate` run once as `postgres` after a failed first attempt as
  `episode_app_dev` (§7).
- `pm2 restart`: restart count 48 → 49. `/health` returned 200.

**MEASURED**, `git log --oneline --first-parent 2b2584fbd..272586eae`:

```
272586eae docs(audit): file the deploy records for Deploy AH and AI [skip-automerge] (#1947)
0e30ccef9 fix(migrations): the decision_logs and asset_roles migrations no longer stop the CLI [skip-automerge] (#1945)
```

```
$ git rev-list --count --first-parent 2b2584fbd..272586eae
2
$ git rev-list --count 2b2584fbd..272586eae
2
```

Two commits, the same two PR numbers, matching Evoni's count.
`git diff --stat 2b2584fbd 272586eae -- src/`:

```
 ...260818000000-add-deleted-at-to-decision-logs.js |  40 +++-
 .../20260902000000-create-asset-roles.js           | 242 ++++++++++++++-------
 2 files changed, 203 insertions(+), 79 deletions(-)
```

Two files, both under `src/migrations/`, matching Evoni's count and her
"both migration files". The whole range, by status:

```
$ git diff --name-status 2b2584fbd 272586eae
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AH.md
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AI.md
M	src/migrations/20260818000000-add-deleted-at-to-decision-logs.js
M	src/migrations/20260902000000-create-asset-roles.js
A	tests/unit/migrations/clear-pending-migrations-1942.test.js
$ git diff --stat 2b2584fbd 272586eae -- frontend/
$ git diff --stat 2b2584fbd 272586eae -- package.json package-lock.json frontend/package.json frontend/package-lock.json
$ git diff --stat 2b2584fbd 272586eae -- scripts/
$ git diff --stat 2b2584fbd 272586eae | tail -1
 5 files changed, 1609 insertions(+), 79 deletions(-)
$ git ls-tree -r --name-only 2b2584fbd src/migrations | wc -l
218
$ git ls-tree -r --name-only 272586eae src/migrations | wc -l
218
```

- **The two `src/` files are modified (status `M`), not added.** No
  migration file is added or removed: 218 at both ends. The three
  pending names were already in the tree at `2b2584fbd` (AI record §4.1);
  #1945 edited two of them in place, and `20260922000000` is unchanged.
- **No `frontend/` file** changes, matching "no frontend build". No
  package change. Nothing under `scripts/`.
- **`docs/`**: the AH and AI records (#1947), 499 and 645 lines added.
  Not served.
- **`tests/`**: one file,
  `tests/unit/migrations/clear-pending-migrations-1942.test.js` (#1945,
  262 lines). Not served.
- **`node -c`.** The filing session's worktree is the basis
  (`git diff --name-only 272586eae HEAD` prints nothing before this
  record's commit), and it ran `node -c` on the two files:

  ```
  $ n=0; for f in src/migrations/20260818000000-add-deleted-at-to-decision-logs.js src/migrations/20260902000000-create-asset-roles.js; do node -c "$f" && n=$((n+1)) && echo "ok $f"; done; echo "all $n ok"
  ok src/migrations/20260818000000-add-deleted-at-to-decision-logs.js
  ok src/migrations/20260902000000-create-asset-roles.js
  all 2 ok
  ```

  That is a repository read; the host's own `node -c` run is ATTESTED.

**Classification**, from each commit's own `git show --stat`:

| Commit | PR | Class | Files it changes |
|---|---|---|---|
| `0e30ccef9` | #1945 | migration | `src/migrations/20260818000000-add-deleted-at-to-decision-logs.js`, `src/migrations/20260902000000-create-asset-roles.js` (plus 1 test file, not served) |
| `272586eae` | #1947 | docs | `docs/audit/F-Deploy-1_Deploy_2026-09-26_AH.md`, `docs/audit/F-Deploy-1_Deploy_2026-09-26_AI.md` (not served) |

Neither commit touches any other file under `src/`. The two migration
files are read only by `sequelize-cli`, not by the running app, so the
restart serves no changed application code; what AJ changes in
production is the schema and the ledger (§7).

**Counts, side by side.**

| Claim | ATTESTED | MEASURED |
|---|---|---|
| Commits | 2 (#1945, #1947) | 2 first-parent, 2 total; the same two PR numbers |
| Files under `src/` | 2, both migration files | 2, both under `src/migrations/`, both modified |
| Frontend | no build | 0 files under `frontend/` |
| Migration files in the tree | 218 (her check output) | 218 at `272586eae`; 218 → 218 across the range |
| Packages | not stated | no output for the root or `frontend/` package files |

No count differs.

### §2.1 Frontend

**ATTESTED.** No frontend build. **MEASURED.** No `frontend/` file
changes in the range (§2). The served bundle is therefore still AI's,
whose entry the AI record §2.1 attests as `index-C_ulLbuu.js`; that name
stays ATTESTED.

### §2.2 Housekeeping: the pending host restart

**ATTESTED (AF record §2.2; carried as pending by the AG, AH and AI
records).** After AF the box wanted a system restart. Evoni's AJ account
does not report it as done. It is recorded here as **still pending**,
with no ruling.

## §3. The time

**ATTESTED:** 2026-09-26 ~01:30 UTC.

**MEASURED:** the two commits were committed, and the two PRs merged,
after 01:30:

```
$ TZ=UTC git log --first-parent --format='%h %cd %s' --date=iso-local 2b2584fbd..272586eae
272586eae 2026-09-26 01:37:21 +0000 docs(audit): file the deploy records for Deploy AH and AI [skip-automerge] (#1947)
0e30ccef9 2026-09-26 01:33:01 +0000 fix(migrations): the decision_logs and asset_roles migrations no longer stop the CLI [skip-automerge] (#1945)
```

| Deploy | ATTESTED time | MEASURED: committer date of the attested end commit |
|---|---|---|
| AJ | 2026-09-26 ~01:30 | `272586eae` 2026-09-26 01:37:21 |

**This is the one place the account and the measurement differ.** In the
AH and AI records the attested time falls after the end commit's merge.
Here ~01:30 is **before** it: production could not have been checked out
at `272586ea` until 01:37:21, nor could #1945's migration files be on
the host before 01:33:01. The deploy therefore began at 01:37:21 or
later.

**Beside it, from GitHub (read, not written).** PR #1945 was merged at
2026-09-26 01:33:02 UTC and #1947 at 01:37:21. Issue #1949, which
carries Evoni's AJ summary, was created at 01:44:28. So the deploy fell
between 01:37:21 and about 01:44. That is within a loose reading of the
"~" of ~01:30 but not a strict one; it is noted here, and the attested
time is not amended.

## §4. Pre-deploy checks

### §4.1 `scripts/check-pending-migrations.js`

**ATTESTED.** After the `db:migrate` run, the check reported "OK: 0
pending of 218 migration files checked". Evoni's account names no run of
the check before the migration for AJ.

**Beside it, from the register.** The AG record §4.1 attests 3 pending
of 217; the AI record §4.1 records that no count after AI is attested,
with the same three still pending on the measurement.

**MEASURED**, `scripts/check-pending-migrations.js` at `272586eae`:
- Her quoted line is the script's own success line:
  `` log(`[pending-migrations] OK: 0 pending of ${ordered.length} migration files checked.`) ``
  (line 84), printed only when no file lacks a row (lines 80–85).
- `ordered` is the basenames of `src/migrations/*.js` (lines 35–40,
  80). The tree has 218 (§2), which is the attested denominator.
- "Ledger rows with no matching file are ignored" (header, line 25):
  `pending` is the files with no row (line 81); rows with no file are
  never counted. That is the "by design" in Evoni's confirmation, and
  it is why 227 rows against 218 files still reports 0 (§7.3).
- The script and `DEVELOPMENT_WORKFLOW.md` are unchanged in the range
  (`git diff --stat 2b2584fbd 272586eae --
  scripts/check-pending-migrations.js DEVELOPMENT_WORKFLOW.md` prints
  nothing).

### §4.2 "The first clean state since 12 July"

**ATTESTED.** "The first clean migration state since 12 July, when the
app user switched and nothing could migrate any more"; "the first clean
state since the app user changed on 2026-07-12".

**MEASURED beside it, from the register.**
- **The date of the switch agrees.** `F-Deploy-1_Fix_Plan_v1.34.md`
  (author date 2026-07-12) records production's `.env` flipped to
  `episode_app_dev` in the 2026-07-11/12 window, and "143/143 public
  tables postgres-owned". `docs/MIGRATION_DRIFT_READ.md` §4 cites the
  same, and its Summary item 1 dates the break 2026-07-12.
- **The pending count, on the drift read's account, was 0 until
  2026-08-18, not only until 07-12.** The drift read's Summary item 1:
  "SequelizeMeta already had 219 rows on 2026-07-12. Nothing was pending
  until `20260818000000` was added on 2026-08-18." Its §4 answer
  (INFERRED there): "The ledger then sat unchanged, with nothing
  pending, until 08-18". `20260818000000` was added to the tree in
  `956697c01`, 2026-08-18.
- So, set against the register: **07-12** is when the CLI lost the
  ability to run any migration that alters an existing table (the
  identity), and **08-18** is when the first file went pending on the
  tree. AJ is the first `db:migrate` recorded in the register to execute
  a migration since 07-12 (drift read Summary item 1: "No migration has
  run through the CLI since"). And 0 pending is the first clean count on
  the tree since 08-18. `scripts/check-pending-migrations.js` itself did
  not exist before the 09-24/25 period (#1864; `F-Deploy-1_Deploy_2026-09-24_2026-09-25.md`
  §8.1 records its first run), so no earlier clean *check output*
  exists.
- This is a difference of dating, recorded beside her words; her words
  are not amended.
- Her closing account (§0) speaks of "seven weeks of drift". Beside it,
  the drift read's Summary item 1 opens "Correction to the premise:
  there was no seven-week outage that began on 7 August" and dates the
  break to 07-12 and the first pending file to 08-18. Her phrase is her
  assessment and is recorded, not ruled on.

## §5. What went live

**MEASURED**, from the commits' own diffs and messages, lines cited at
`272586eae`. That these are in production rests on the ATTESTED deploy
(§2) and the ATTESTED migration run (§7).

- **The decision_logs and asset_roles migrations no longer stop the CLI
  (#1945, `0e30ccef9`, `Task: #1942`).**
  - `20260818000000-add-deleted-at-to-decision-logs.js`: `up` returns
    after a log when `decision_logs` is absent (lines 50–53), skips when
    the column is already there (lines 54–58), and otherwise adds it as
    before (lines 59–62). The header records Evoni's ruling (b) (lines
    30–35).
  - `20260902000000-create-asset-roles.js`: `up` runs in one
    transaction (line 94). With the table absent it creates it and the
    three indexes (lines 97–169). With it present it adopts it (line
    172), adds `deleted_at` if missing (lines 173–179), and creates each
    index only if `equivalentIndex` finds none (lines 181–191). `down`
    drops the table only when it holds no rows (lines 195–207).
  - `20260922000000-add-category-format-to-world-events.js` is not in
    the range; it is already guarded (`describeTable`, lines 26–40).
- **The AH and AI records (#1947, `272586eae`, `Task: #1944`).** Not
  served.

**Not in AJ.** #1945 is items 2–4 of #1942 only. Item 1, retiring the
plural `/api/v1/decision-logs` route and `DecisionLog` model and moving
the F-AUTH-1 G3 clause-3 test, was split off under Evoni's ruling (a)
(PR #1945 body). It is PR #1950, "fix(decision-log): browse pool records
who generated it; retire /decision-logs", **open, unmerged at filing**.
#1943 (the styling game's second scoring engine) has no merged PR at
filing. Neither is deployed. Issue #1942 is open at filing. (GitHub
reads, nothing written.)

### §5.1 Post-deploy checks

**ATTESTED.** `/health` 200 and restart 48 → 49 (§6); the pending check
0 of 218 (§4.1); the three `SequelizeMeta` rows (§7). Evoni's account
reports **no app test for AJ**.

| Check | Standing |
|---|---|
| All three pending migrations recorded in `SequelizeMeta` | ATTESTED (§7) |
| `check-pending-migrations`: 0 pending of 218 | ATTESTED (§4.1) |
| `asset_roles` gained `deleted_at`, and no index was added | ATTESTED (§7.2) |
| An app test after AJ | none reported; NOT ATTESTED |

**MEASURED beside it.** AJ changes no application code the process
serves (§2), so no app behaviour is expected to change. The `AssetRole`
model sets `timestamps: false`, so, per PR #1945's body, Sequelize never
names `deleted_at` for it, and the added column changes no query it
issues; that is the PR's reading, cited, and not re-derived here. The
`decision_logs` route keeps answering 500 until #1950 lands (PR #1945
body, "For Evoni after merge").

**Carried forward from the AI record §5.1.** None is attested by AJ.
They remain **NOT ATTESTED at filing**, and none is inferred:

| PR | What to watch | Standing |
|---|---|---|
| #1940 (AI) | "For This Event" offers the owned Cotton Sundress and White Canvas Sneakers | NOT ATTESTED |
| #1940 (AI) | A lock whose total is unaffordable is refused and writes nothing | NOT ATTESTED |
| #1940 (AI) | Closet labels | Deliberately not checked (AI record §5.1); NOT ATTESTED |
| #1938 (AI) | A spend that would take coins below zero is refused | NOT ATTESTED |
| #1936 (AH) | Approve, reject, approval-status and suggestions answer without an eager-loading error | NOT ATTESTED |
| #1912 (AF §5.1) | Start Episode lands on Production → Assets | NOT ATTESTED |
| #1914 (AF §5.1) | The Phone tab leads with Preview Phone | NOT ATTESTED |
| #1922 (AF §5.1) | Save draft persists across a reload | NOT ATTESTED |
| #1915 (AF §5.1) | The version routes answer 501 | NOT ATTESTED |
| #1896 (AE §5.1) | Stream events arrive live through nginx, not buffered into one burst | NOT ATTESTED |
| #1896 (AE §5.1) | No doubled updates between live events and the REST refresh | NOT ATTESTED |
| #1900 (AE §5.1) | The Assistant streams, and an AI Writer action returns text | NOT ATTESTED |

Twelve checks: AI's four and the eight the AI record carried from AH,
AF and AE. #1929's write and read-back and #1935's images stay ATTESTED
by AH, and the persisted outfit by AI; AJ adds nothing to them.
`/health` 200 is a process check; it is not these.

## §6. Restarts

**ATTESTED (Evoni).**

| Restart | Deploy |
|---|---|
| 48 → 49 | AJ |

**Beside it, from the register.** AH's restart was 46 → 47 (AH record
§6) and AI's 47 → 48 (AI record §6). AJ's 48 → 49 follows with no gap.

## §7. Schema changes: `db:migrate` through the CLI

**ATTESTED (Evoni).**
- **Identity.** `db:migrate` was run once as `postgres`, by setting
  `DB_USER=postgres DB_PASSWORD=…` for that one command, "because the
  CLI reads DB_USER from .env and ignores PGUSER".
- **A first attempt as `episode_app_dev`** failed with "must be owner of
  table asset_roles".
- **All three pending migrations then ran**, and all three are recorded
  in `SequelizeMeta`: `20260818000000-add-deleted-at-to-decision-logs.js`,
  `20260902000000-create-asset-roles.js`,
  `20260922000000-add-category-format-to-world-events.js`.
- **Per file:**
  - `20260818000000` logged "decision_logs does not exist here; nothing
    to add deleted_at to. Skipped" and recorded itself.
  - `20260902000000` adopted the existing `asset_roles`, added
    `deleted_at`, and created no indexes: each was already served by
    `asset_roles_show_id_role_key_key`, `idx_asset_roles_show` and
    `idx_asset_roles_key`.
  - `20260922000000` recorded itself with no changes.
- **How the three got recorded** across the two attempts is, in her
  words, "no longer inferred either way: the end state is all three
  recorded, however they got there."
- `SequelizeMeta` holds 227 rows against 218 files (§7.3).

### §7.1 The CLI's credentials: `DB_USER`, not `PGUSER`

**MEASURED**, consistent with her account:
- `.sequelizerc` points the CLI's config at `src/config/sequelize.js`
  (line 4).
- That file loads `.env` with `require('dotenv').config()` (line 10).
  Its `production` block takes "discrete DB_* env vars only" (comment,
  line 141): `username: process.env.DB_USER || process.env.DB_USERNAME`
  and `password: process.env.DB_PASSWORD` (lines 149–150); host,
  database and port are `DB_HOST`, `DB_NAME`/`DB_DATABASE` and `DB_PORT`
  (lines 151–153). The `development` and `test` blocks fall back to the
  same `DB_*` names (lines 87–91, 121–125).
- Nothing in the config reads `PGUSER` or `PGPASSWORD`:

  ```
  $ git grep -n -e 'PGUSER' -e 'PGPASSWORD' 272586eae -- src/config .sequelizerc; echo "exit=$?"
  exit=1
  ```

  With `DB_USER` set in `.env`, the config always hands Sequelize an
  explicit username, so a `PGUSER` in the shell has nothing to fill.
- **Why a `DB_USER` on the command line wins over `.env`.** `dotenv`
  does not overwrite a variable already present in `process.env` unless
  called with `{ override: true }`, and line 10 passes no options. The
  filing session read this in the locally installed `dotenv` 17.3.1
  (`node_modules/dotenv/lib/main.js`, `populate`: an already-defined
  key is overwritten only when `override === true`); `package.json`
  declares `"dotenv": "^17.3.1"`. The host's installed version is not
  read here.
- `docs/MIGRATION_DRIFT_READ.md` §4 records that no separate migration
  identity exists: `.sequelizerc` → `src/config/sequelize.js`, the
  `production` block "`DB_*` only".

**Beside the failed first attempt.** In run order the CLI reaches
`20260818000000` first; with `decision_logs` absent it returns before
any DDL (lines 50–53), so it needs no ownership. The next file,
`20260902000000`, adopts the table and calls `addColumn` on
`asset_roles` (line 175), which needs owner rights. v1.34 records
"143/143 public tables postgres-owned", and the drift read's Summary
item 1 says `episode_app_dev` "owns no tables". So "must be owner of
table asset_roles" is the error the file order predicts for a run as
`episode_app_dev`. Whether the first attempt recorded
`20260818000000` before failing is not attested and is not derived here;
Evoni states the end state instead.

### §7.2 The log lines, beside the files

**MEASURED**, at `272586eae`. Each attested log line is one the file
prints; the files prefix every line with `[migration <timestamp>]`
(`LOG`, `20260818000000…` line 38, `20260902000000…` line 61), which
her account omits.

| Attested | File, line | Printed text at `272586eae` |
|---|---|---|
| 20260818000000 "decision_logs does not exist here; nothing to add deleted_at to. Skipped" | `20260818000000-add-deleted-at-to-decision-logs.js` line 51 | `` `${LOG} ${TABLE} does not exist here; nothing to add deleted_at to. Skipped (Task #1942).` `` |
| 20260902000000 "adopted the existing asset_roles" | `20260902000000-create-asset-roles.js` line 172 | `` `${LOG} ${TABLE} already exists; adopting it (Task #1942).` `` |
| "added deleted_at" | line 176 | `` `${LOG} added ${TABLE}.deleted_at.` `` |
| "created no indexes — each was already served by …" | line 185 | `` `${LOG} ${ix.name}: already served by ${found.name}; not created.` `` |
| 20260922000000 "recorded itself with no changes" | `20260922000000-add-category-format-to-world-events.js` lines 26–40 | no log line of its own; each `addColumn` runs only if `describeTable` lacks the column |

Her quotation of line 51 stops at "Skipped"; the file continues "
(Task #1942)." That is a truncation of the same line, not a different
one.

**The "already served by" branch.** `INDEXES` (lines 63–67) wants
`uq_asset_roles_show_role_key` (UNIQUE on `show_id, role_key`, partial
on `deleted_at IS NULL`), `idx_asset_roles_show_id` (`show_id`) and
`idx_asset_roles_role_key` (`role_key`). `equivalentIndex` (lines
75–87) returns an existing index of the same name, or else a non-primary
index over the same columns in the same order with the same uniqueness
that is not itself partial (lines 78–86). A full unique index therefore
serves the partial unique one (header, lines 50–52). When one is found,
line 185 logs it and no index is created (line 186, `continue`).

**The three names production reported are the names
`scripts/migrations/add-asset-roles-table.sql` creates** (a dead tree;
drift read §3 lists it as one of three candidate creators of the table):

| `INDEXES` entry (line) | Served by (attested) | Where the name comes from |
|---|---|---|
| `uq_asset_roles_show_role_key` (64) | `asset_roles_show_id_role_key_key` | `add-asset-roles-table.sql` line 23, `UNIQUE(show_id, role_key)` inside `CREATE TABLE IF NOT EXISTS asset_roles` (line 10). An unnamed table constraint gets PostgreSQL's default name `<table>_<columns>_key`, i.e. `asset_roles_show_id_role_key_key`. |
| `idx_asset_roles_show_id` (65) | `idx_asset_roles_show` | `add-asset-roles-table.sql` line 26, `CREATE INDEX idx_asset_roles_show ON asset_roles(show_id);` |
| `idx_asset_roles_role_key` (66) | `idx_asset_roles_key` | `add-asset-roles-table.sql` line 27, `CREATE INDEX idx_asset_roles_key ON asset_roles(role_key);` |

That the names match is MEASURED. It is consistent with that script
having created production's `asset_roles` indexes. The drift read §3
(INFERRED there) notes that production has lacked `assets.role_key`,
which the same script adds (line 30), so it "probably did not run there
in full". This record does not settle which creator built the table.

**The rehearsal (PR #1945 body, cited, not re-run).** The PR records a
run by the parent session on a throwaway local PostgreSQL 16 cluster,
not production. It built `asset_roles` in production's attested 12-column
shape, with the indexes the SQL script creates and one row, and no
`decision_logs`. It called each file's `up` directly through a harness;
the PR states that `sequelize-cli db:migrate` end to end and
`20260922000000` were **not** run. Its run 1 printed the same lines
Evoni attests: "decision_logs does not exist here; nothing to add
deleted_at to. Skipped (Task #1942).", "asset_roles already exists;
adopting it", "added asset_roles.deleted_at.", and "already served by
asset_roles_show_id_role_key_key", "… by idx_asset_roles_show", "… by
idx_asset_roles_key". AJ's production run is the first run of the files
through the CLI that the register records.

What the repository cannot confirm: the two attempts, the identity of
each, the error text, the log output, the `deleted_at` column, the
index set after the run, or the `SequelizeMeta` rows. All stay ATTESTED.
The repository records no production migration output.

### §7.3 227 rows against 218 files

**ATTESTED.** `SequelizeMeta` holds 227 rows against 218 files; nine
recorded names have no matching file, "presumably from the dead trees
the drift read mentions".

**MEASURED, beside the presumption, respectfully: eight of the nine are
not from the dead trees.** The register already names the nine and
resolves each one.

- `docs/MIGRATION_DRIFT_READ.md` §1 (lines 34–45) lists them as
  "Recorded, not in the tree: nine rows whose files were later renamed
  or deleted":

  ```
  20260208000000-create-lala-formula
  20260306100000-create-episode-orchestration-tables
  20260307140000-create-franchise-knowledge
  20260311200000-create-story-calendar-system
  20260315000000-add-relationship-engine-columns
  20260315100000-add-expanded-world-character-columns
  20260320000000-create-scene-sets-and-angles
  20260627000000-add-base-still-url
  20260710000000-create-generation-jobs
  ```

  "So 210 + 9 = 219."
- `docs/audit/v25_Owed_Index_Amd23_2026-08-30.md` §Y2 resolves the same
  nine against all four migration roots: **six re-dated** into
  `src/migrations/` under a new timestamp (for example
  `20260315000000-add-relationship-engine-columns` →
  `src/migrations/20260615000000-add-relationship-engine-columns.js`),
  **one** exact match **outside the configured path**
  (`20260627000000-add-base-still-url` →
  `migrations/20260627000000-add-base-still-url.js`, a dead tree), and
  **two sourceless** (`create-episode-orchestration-tables`,
  `create-story-calendar-system`). So Evoni's presumption holds for one
  of the nine, `add-base-still-url`, whose only file is in the dead tree
  `migrations/`. The other eight are rows for files renamed or removed
  in the live tree.
- **The nine are exactly the rows of the 09-17 capture with no file at
  `272586eae`.** The filing session diffed
  `docs/audit/EvidenceNote_Canon_SequelizeMeta_2026-09-17.txt` (219
  rows) against `git ls-tree -r --name-only 272586eae src/migrations`
  (218 files):

  ```
  rows in the 09-17 capture: 219
  files at 272586eae: 218
  rows not in tree:
  20260208000000-create-lala-formula.js
  20260306100000-create-episode-orchestration-tables.js
  20260307140000-create-franchise-knowledge.js
  20260311200000-create-story-calendar-system.js
  20260315000000-add-relationship-engine-columns.js
  20260315100000-add-expanded-world-character-columns.js
  20260320000000-create-scene-sets-and-angles.js
  20260627000000-add-base-still-url.js
  20260710000000-create-generation-jobs.js
  files not in 09-17 rows:
  20260818000000-add-deleted-at-to-decision-logs.js
  20260902000000-create-asset-roles.js
  20260902000001-add-role-key-to-assets.js
  20260922000000-add-category-format-to-world-events.js
  20260924000000-add-event-terms.js
  20260925000000-add-draft-columns-to-thumbnail-compositions.js
  20260925000001-add-approval-columns-to-episode-wardrobe.js
  20260926000000-dedupe-episode-wardrobe-indexes.js
  ```

  (Rows read from the capture's data lines; files are the tree's
  basenames; `comm` over the two sorted lists.) Amd23 §Y2 had recorded
  the ledger half as "REPORTED, not filed"; the 09-17 capture has since
  been filed, and it carries all nine names.

**The arithmetic, step by step.** 219 rows at 09-17 = 210 files in the
tree + the nine. Each of the eight files added to the tree since has a
row recorded in the register:

| Step | Row added | Where the register records it | Rows | Files in tree |
|---|---|---|---|---|
| 09-17 capture | — | `EvidenceNote_Canon_SequelizeMeta_2026-09-17.txt` | 219 | 210 recorded + 5 unrecorded (drift read §1) |
| 09-24 | `20260924000000-add-event-terms.js` | 09-24/25 record §9.3 (ATTESTED); drift read §1 ("makes 220") | 220 | 215 |
| before Deploy Y | `20260902000001-add-role-key-to-assets.js` | 09-24/25 record §9.1 (ATTESTED), confirmed by §8.1's 3 pending of 215 not naming it | 221 | 215 |
| AF | `20260925000000-add-draft-columns-to-thumbnail-compositions.js` | AF record §0, §7 (ATTESTED); 3 pending of 216 | 222 | 216 |
| AG | `20260925000001-add-approval-columns-to-episode-wardrobe.js` | AG record §0, §7 (ATTESTED); 3 pending of 217 | 223 | 217 |
| AI | `20260926000000-dedupe-episode-wardrobe-indexes.js` | AI record §7 (ATTESTED: "SequelizeMeta row inserted"); no pending count after AI | 224 | 218 |
| AJ | the three pending files | this record §7 (ATTESTED) | 227 | 218 |

218 files + 9 = 227, the attested row count. Every step is recorded in
the register. Two limits, stated rather than inferred:
- **AI's row** has no pending count of its own (AI record §4.1). AJ's 0
  of 218 is the first attested check that covers it.
- **That today's nine are the same nine** rests on the arithmetic and
  the 09-17 capture. No `SequelizeMeta` listing has been filed since
  09-17. 227 = 219 + 8 exactly is what the table above predicts, but a
  row removed and a row added between captures would net to the same
  count; that is not attested and is not ruled out here.

**Harmless to the check, as she says.** The check ignores rows with no
file (§4.1, line 25). Beside that, and not ruled on here: Amd22 §X7.2
and Amd23 §Y2 recorded that re-dated files "will run again under the new
ones" on a database that ran them under the old names; that is a
different question from the pending count, and this record does not
reopen it.

## §8. Basis statement

**MEASURED.** After Deploy AJ, production's tree is this record's basis,
`272586eae`. No commit on `origin/main` up to and including `272586eae`
is undeployed, on Evoni's attested list.

**Merged after AJ, undeployed** (MEASURED at filing, after
`git fetch origin main`):

```
$ git log --oneline --first-parent 272586eae..origin/main; echo "exit=$?"
exit=0
```

No output: `origin/main` is `272586eae` at filing (§1), so nothing has
merged after AJ. #1950 (#1942's item 1) is open and unmerged, and #1943
has no PR merged (§5).

## §9. What this document does not do

This document:

- does not rule on the migration identity. `episode_app_dev` owns no
  tables (drift read §4; v1.34, "143/143 public tables postgres-owned"),
  and running the CLI as `postgres` for one command does not change
  that. #1942 and PR #1945 each state it is out of their scope. Evoni
  names "the identity fix" as what is left; this record cites it and
  rules on nothing in it;
- does not rule on #1942, #1943 or PR #1950, and does not rule on
  whether "the drift" is closed. That is her assessment, recorded in §0;
- does not rule on which creator built production's `asset_roles`
  (§7.2), or on the re-dated files of Amd22 §X7.2 / Amd23 §Y2 (§7.3);
- does not rule on the pending host restart (§2.2);
- does not edit the AI, AH, AG or AF record,
  `docs/MIGRATION_DRIFT_READ.md`, or any migration;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS,
  database or Cognito contact. Every ATTESTED claim above is Evoni's own
  account, taken outside any agent session. Every MEASURED claim is a
  repository read this filing session performed itself; PR and issue
  states, bodies and times are GitHub reads, with nothing written;
- records no secret anywhere above. The password in her `db:migrate`
  command is elided in her account and here.

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

Unchanged from the AH and AI records §10. Nothing minted here.

## §Standing

- §1–§4 and §7 each carry an ATTESTED clause and a MEASURED clause,
  marked separately and never merged into one standing.
- Every attested count agrees with the measurement (§2): 2 commits, 2
  `src/` files, both migration files, 218 migration files, no frontend
  file.
- **The time differs.** The attested ~01:30 is before both merges
  (01:33:01 and 01:37:21), so the deploy began at 01:37:21 or later; it
  is recorded as attested, with the merges beside it (§3).
- **"The first clean state since 12 July"**: 07-12 is when the identity
  switched (register-confirmed). On the drift read's account the pending
  count stayed 0 until 08-18, so 0 pending is the first clean count since
  08-18, and AJ's run is the first CLI migration since 07-12 (§4.2).
- The `DB_USER`-not-`PGUSER` account agrees with the config (§7.1). The
  attested log lines are lines the two files print; the three index
  names are the names `scripts/migrations/add-asset-roles-table.sql`
  creates (§7.2).
- **227 against 218**: the nine are named in the drift read §1 and
  resolved in Amd23 §Y2 (six re-dated, one in the dead tree
  `migrations/`, two sourceless); the presumption "from the dead trees"
  holds for one of the nine. The arithmetic 218 + 9 = 227 is traced
  through the register; that today's nine are the 09-17 nine is not
  independently captured (§7.3).
- §5.1: no app test was reported for AJ. Twelve carried checks remain
  NOT ATTESTED.
- The migration identity is not fixed and not ruled on (§9).
- Nothing in this document is labelled RULED, and nothing is INFERRED
  by this record; INFERRED statements quoted from the drift read are
  marked as such there.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
  agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1949.*
