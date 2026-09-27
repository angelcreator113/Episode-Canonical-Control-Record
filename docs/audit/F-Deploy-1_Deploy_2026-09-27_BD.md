| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BD, 2026-09-27, backend only, one migration recorded by hand, one plain restart, performed personally by Evoni, outside any agent session. `episode_wardrobe` has a creating migration.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_BC.md` (the BC record, filed with this one).
This document follows that one rather than editing it. Basis:
`7e2ea9ce89e22336a1647d1c951963e810fa9072` (#2089), the tree Deploy BD moved
production to. `origin/main` at filing is `7e2ea9ce` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output. It cannot be
  reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, and register documents
  already merged under `docs/audit/`.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host, user id, account number or ARN.

The deploy is lettered BD, continuing after Deploy BC. It is one of two
records (BC and BD) filed together under Task #2091.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `943b7e65` → `7e2ea9ce`. Backend: the new migration and the
  model only; the rest of the range is documents. The steps were
  `DEVELOPMENT_WORKFLOW.md` §7.1's.
- **Pending-migration check, before:** "1 pending of 219 … FAIL: pending
  migrations. Do not restart.", `exit=1`. Its output's connection line is not
  recorded here.
- **The migration was recorded, not run through the migration command.**
  Evoni did the following as `postgres` in psql, in one transaction:
  - confirmed `to_regclass('public.episode_wardrobe')` returned
    `episode_wardrobe`;
  - inserted the migration's `SequelizeMeta` row (`INSERT 0 1`);
  - confirmed `episode_wardrobe` still held 4 rows;
  - committed.
- **Pending-migration check, after:** 0 pending of 219, `exit=0`.
- `node -c src/models/EpisodeWardrobe.js`: ok.
- A plain `pm2 restart`. The restart count went from 4 to 5; the process is
  online.
- `/health` returned `status` healthy and `database` connected (timestamp
  `2026-09-27T20:17:17Z`).

## §1. Identity and continuity

**ATTESTED.** The tree moved from `943b7e65` to `7e2ea9ce` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 943b7e65 7e2ea9ce
943b7e657227b31964901fa5903ce413814e2bf7
7e2ea9ce89e22336a1647d1c951963e810fa9072
$ git merge-base --is-ancestor 943b7e65 7e2ea9ce; echo "exit=$?"
exit=0
```

Deploy BC ends at `943b7e65` (BC record §1, §8); Deploy BD begins there.

## §2. The range — MEASURED

```
$ git log --first-parent --format="%h %cI %s" 943b7e65..7e2ea9ce
7e2ea9ce8 2026-09-27T16:14:18-04:00 feat(db): a migration that creates episode_wardrobe as production has it [skip-automerge] (#2089)
13ebf99bd 2026-09-27T15:57:49-04:00 docs(audit): F-Ward-1 Fix Plan, scope and first step [skip-automerge] (#2085)
2e1fc1953 2026-09-27T15:51:53-04:00 docs(events): read event draft generation path [skip-automerge] (#2083)
3188fe532 2026-09-27T15:43:12-04:00 docs(audit): open F-Ward-1, scoping [skip-automerge] (#2081)
$ git diff --name-only 943b7e65 7e2ea9ce -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json
src/migrations/20260927000000-create-episode-wardrobe.js
src/models/EpisodeWardrobe.js
$ git diff --name-only 943b7e65 7e2ea9ce -- . ':!frontend/src' ':!docs/audit'
docs/EVENT_DRAFT_READ.md
src/migrations/20260927000000-create-episode-wardrobe.js
src/models/EpisodeWardrobe.js
tests/integration/episodeWardrobeMigration.integration.test.js
tests/unit/scripts/check-schema-agreement.canon.test.js
tests/unit/services/episodeWardrobeApprovalColumns.test.js
```

Four commits: #2081, #2083, #2085 and #2089.
- #2081 and #2085 are register documents only.
- #2083 is `docs/EVENT_DRAFT_READ.md` only.
- #2089 carries the code: the migration
  `src/migrations/20260927000000-create-episode-wardrobe.js` and
  `src/models/EpisodeWardrobe.js`, the only files changed under `src/`,
  `frontend/src` or a package manifest. Its other three files are tests,
  not served.

No frontend file, no package manifest or lockfile.

**Beside her account.** "The new migration and the model only" agrees with
the measurement.

## §3. The time

**ATTESTED.** `/health` answered at `2026-09-27T20:17:17Z`, after the
restart.

**MEASURED.** The newest commit in the range is #2089, 20:14:18 UTC on
2026-09-27 (§2), so the deploy followed it.

## §4. Pre-deploy checks

**ATTESTED.** Before the migration was recorded, the pending-migration check
reported 1 pending of 219 and "Do not restart", `exit=1`. After, it reported
0 pending of 219, `exit=0`. `node -c src/models/EpisodeWardrobe.js`: ok.

**MEASURED.** The migration tree holds 219 files at the end of the range. It
held 218 at BC's end (BC record §4); #2089 added one:

```
$ git ls-tree -r --name-only 7e2ea9ce src/migrations | wc -l
219
```

**Beside it.** The check stopping the deploy at 1 pending, with "Do not
restart", is §7.1's guard doing what it is for. The restart followed only
after the check read 0.

## §5. What went live

### §5.1 The change, MEASURED

#2089 (`7e2ea9ce`, Task #2087), `feat(db)`, F-Ward-1 Fix Plan v1.0 O1 and O2:

- `20260927000000-create-episode-wardrobe.js` creates `episode_wardrobe` as
  Evoni read production on 2026-09-27, wherever the table is missing: 16
  columns, 5 constraints and 7 indexes. Where the table exists, it logs and
  changes nothing. Its `down` does nothing.
- `EpisodeWardrobe` declares `times_worn` (INTEGER, NOT NULL, default 1).

```
$ git show 7e2ea9ce:src/migrations/20260927000000-create-episode-wardrobe.js | grep -n "tableExists\|async down\|CREATE TABLE IF NOT EXISTS"
36:  CREATE TABLE IF NOT EXISTS public.episode_wardrobe (
79:      if (await queryInterface.tableExists(TABLE, { transaction })) {
104:  async down() {
$ git show 7e2ea9ce:src/models/EpisodeWardrobe.js | grep -n "times_worn"
71:      // F-Ward-1 Fix Plan v1.0 O2 (Task #2087): production has times_worn
74:      times_worn: {
```

### §5.2 The migration in production, beside the code

**ATTESTED (§0).** The migration was **recorded** as run, by inserting its
`SequelizeMeta` row. It was not run through the migration command.

**So the migration's own "already exists; changing nothing" branch never ran
in production.** The evidence that production is unchanged is Evoni's check
in the same transaction:
- the table was present (`to_regclass` returned `episode_wardrobe`);
- it still held 4 rows.

This is how the AG and AI records worded their hand-run migrations. It
records what was done, not what the migration would have done.

**MEASURED, beside it.** Had the migration run, its first step
(`src/migrations/20260927000000-create-episode-wardrobe.js:79`) would have
found the table and returned before any DDL. Recording it therefore leaves
production where running it would have.

### §5.3 The live check, beside the code

**ATTESTED (§0).** After the restart, `/health` returned `status` healthy
and `database` connected. The process is online at restart count 5.

**MEASURED.** A healthy answer after the restart shows that the app started
with the model's new `times_worn` attribute. Production has that column,
NOT NULL, default 1 (`F-Ward-1_Fix_Plan_v1.0.md` §2.1, ATTESTED).

**Not exercised live:** a styling-game pick or an outfit lock writing to
`episode_wardrobe` after the restart.

### §5.4 Production's path, and no frontend build

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3. `DEVELOPMENT_WORKFLOW.md` §7.1 gives the backend steps: the
pending-migration check before the restart. **No frontend build:** her
account names none, and no file under `frontend/src` changed (§2).

## §6. Restarts

**ATTESTED.** One restart: a plain `pm2 restart`. The restart count went
from 4 to 5, and the process is online.

**MEASURED.** A backend file changed (§2), so a restart was needed for it to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:** BB 2 → 3, BC 3 → 4 (BC record §6),
BD 4 → 5.

## §7. Schema changes

**ATTESTED.** No DDL. One `SequelizeMeta` row was inserted by hand for
`20260927000000-create-episode-wardrobe.js`, and `episode_wardrobe` was
checked present with 4 rows (§0, §5.2).

**MEASURED.** One migration file is added in the range (§2). The migration
count moves from 218 to 219 (§4).

## §8. Basis statement

**MEASURED.** After Deploy BD, production's tree is this record's basis,
`7e2ea9ce`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
7e2ea9ce89e22336a1647d1c951963e810fa9072 2026-09-27 feat(db): a migration that creates episode_wardrobe as production has it [skip-automerge] (#2089)
```

Nothing is merged after it.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and records the pending check's results, not its connection line;
- does not edit the BC record or any other filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone. Whether F-Ward-1's O1 and O2 are done
  is for a Fix Plan revision to record;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, restart, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS, database
  or Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session. Every MEASURED claim is a repository read this
  filing session performed itself.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md
$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately.
- The tree agrees with her account: four commits; the backend change is the
  migration and `src/models/EpisodeWardrobe.js`, from #2089; no frontend file,
  no package change (§2).
- **The migration (§5.2):** recorded by hand in production, not run. The
  table was present with 4 rows (ATTESTED); the migration's code would have
  changed nothing there (MEASURED).
- **The live check (§5.3):** after a plain restart (4 → 5, online),
  `/health` returned healthy with the database connected. An
  `episode_wardrobe` write after the restart: **not exercised**.
- Production's path is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the steps
  from `DEVELOPMENT_WORKFLOW.md` §7.1.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2091.*
