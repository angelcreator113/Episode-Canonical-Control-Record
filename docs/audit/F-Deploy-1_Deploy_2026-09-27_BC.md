| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BC, 2026-09-27, backend only, one plain restart, no migration, performed personally by Evoni, outside any agent session. The affordability and financial-pressure handlers read the ledger balance.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_BB.md` (the BB record). This document follows
that one rather than editing it. Basis:
`943b7e657227b31964901fa5903ce413814e2bf7` (#2079), the tree Deploy BC moved
production to. `origin/main` at filing is `a0c795d6` (§8).

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

The deploy is lettered BC, continuing after Deploy BB. It is one of two
records (BC and BD) filed together under Task #2091.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `073e57f8` → `943b7e65`. Backend. The steps were
  `DEVELOPMENT_WORKFLOW.md` §7.1's.
- The two expected backend files changed.
- Pending-migration check: 0 pending of 218, `exit=0`. Its output's
  connection line is not recorded here.
- `node -c` on both files: ok.
- A plain `pm2 restart`. The restart count went from 3 to 4; the process is
  online.
- `/health` returned `status` healthy and `database` connected (timestamp
  `2026-09-27T19:24:21Z`).
- **Live balance check: not exercised.** #2079's integration tests cover it.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `073e57f8` to `943b7e65` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 073e57f8 943b7e65
073e57f8c73ca7988c1abd4c5684d14eec947539
943b7e657227b31964901fa5903ce413814e2bf7
$ git merge-base --is-ancestor 073e57f8 943b7e65; echo "exit=$?"
exit=0
```

Deploy BB ends at `073e57f8` (BB record §1, §8); Deploy BC begins there.

## §2. The range — MEASURED

```
$ git log --first-parent --format="%h %cI %s" 073e57f8..943b7e65
943b7e657 2026-09-27T15:21:31-04:00 fix(world): affordability and financial-pressure read the ledger balance [skip-automerge] (#2079)
368781a62 2026-09-27T15:04:36-04:00 docs(audit): F-Stats-1 Fix Plan v1.63, Phase B complete; state_json fix owed [skip-automerge] (#2077)
b71444dd0 2026-09-27T14:56:03-04:00 docs(audit): file deploy records BA and BB [skip-automerge] (#2074)
19bbd8e86 2026-09-27T14:52:36-04:00 docs(audit): F-Stats-1 §35.5 classes 2–6, reach probe [skip-automerge] (#2075)
$ git diff --name-only 073e57f8 943b7e65 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json
src/routes/worldEvents.js
src/services/financialPressureService.js
$ git diff --name-only 073e57f8 943b7e65 -- . ':!frontend/src' ':!docs/audit'
PROJECT_CONTEXT.md
scripts/silent-catches.baseline
src/routes/worldEvents.js
src/services/financialPressureService.js
tests/integration/financialBalance.integration.test.js
```

Four commits: #2074, #2075, #2077 and #2079.
- #2074 and #2075 are register documents only.
- #2077 is a register document plus `PROJECT_CONTEXT.md`.
- #2079 carries the code: `src/routes/worldEvents.js` and
  `src/services/financialPressureService.js`, the only files changed under
  `src/`, `frontend/src` or a package manifest. Its other two files are an
  integration test and the silent-catch lint baseline, neither served.

No frontend file, no migration file, no package manifest or lockfile.

**Beside her account.** "The two expected backend files" agrees with the
measurement.

## §3. The time

**ATTESTED.** `/health` answered at `2026-09-27T19:24:21Z`, after the
restart.

**MEASURED.** The newest commit in the range is #2079, 19:21:31 UTC on
2026-09-27 (§2), so the deploy followed it.

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check: 0 pending of 218, `exit=0`. `node -c`
on both files: ok.

**MEASURED.** The migration tree holds 218 files at the end of the range,
matching the check's total:

```
$ git ls-tree -r --name-only 943b7e65 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

#2079 (`943b7e65`, Task #2078), `fix(world)`, F-Stats-1 Fix Plan v1.63
§66.3-F:

- `GET /world/:showId/events/:eventId/affordability` and
  `GET /world/:showId/financial-pressure` take their balance from
  `getCurrentBalance`, the source `GET /balance` uses. Before, they read
  `character_state_history.state_json`, a column that does not exist, and
  fell back to 500.
- Their balance-read catches are gone, and each outer catch logs.
- `financial-pressure`'s three fallback queries log their errors.
- `financialPressureService.js`'s unused `logTransaction` is removed.

```
$ git show 943b7e65:src/routes/worldEvents.js | grep -n "getCurrentBalance(models.sequelize, showId)\|\[affordability\] failed\|financial-pressure\] .* failed"
2677:    const balance = await getCurrentBalance(models.sequelize, showId);
2684:    console.error('[affordability] failed:', err.message);
2726:    const balance = await getCurrentBalance(models.sequelize, showId);
2741:      console.error('[financial-pressure] declined invites query failed:', err.message);
2754:      console.error('[financial-pressure] opportunities query failed:', err.message);
2770:      console.error('[financial-pressure] episode financials query failed:', err.message);
2954:      getCurrentBalance(models.sequelize, showId),
4185:    const balance = await getCurrentBalance(models.sequelize, showId);
$ git show 943b7e65:src/services/financialPressureService.js | grep -c "logTransaction"
0
```

### §5.2 The live check, beside the code

**ATTESTED (§0).** After the restart, `/health` returned `status` healthy
and `database` connected. The process is online at restart count 4.

**MEASURED.** A healthy answer after the restart shows that the app started
with #2079's files loaded. It does not exercise either handler.

**Not exercised live:** an affordability or financial-pressure request. The
fix's integration tests (`tests/integration/financialBalance.integration.test.js`,
#2079) cover both, against a database built by the migration tree, not
production.

### §5.3 Production's path, and no frontend build

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3: HTTPS requests reach the box's app on port 3000 through the load
balancer. `DEVELOPMENT_WORKFLOW.md` §7.1 gives the backend steps: the
pending-migration check before the restart.

**No frontend build.** Her account names none, and no file under
`frontend/src` changed (§2).

## §6. Restarts

**ATTESTED.** One restart: a plain `pm2 restart`. The restart count went
from 3 to 4, and the process is online.

**MEASURED.** A backend file changed (§2), so a restart was needed for it to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:**
- BB took the count from 2 to 3 (BB record §6).
- BC took it from 3 to 4.
- BD takes it from 4 to 5 (the BD record, filed with this one).

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 218.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy BC, production's tree was this record's basis,
`943b7e65`, until Deploy BD. At filing, after `git fetch origin --prune`,
`origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
a0c795d67dab21afa3e45d068d4ccc6926102873 2026-09-27 fix(events): drop show name from suggest-names prompt [skip-automerge] (#2090)
$ git log --first-parent --format="%h %cI %s" 7e2ea9ce..origin/main
a0c795d67 2026-09-27T16:24:50-04:00 fix(events): drop show name from suggest-names prompt [skip-automerge] (#2090)
$ git diff --name-only 7e2ea9ce origin/main
src/routes/worldEvents.js
```

Deploy BD's end is `7e2ea9ce` (the BD record). One commit merged after it, #2090, a backend change to `src/routes/worldEvents.js`; no deploy record at filing says it has reached production.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and records the pending check's result, not its connection line;
- does not edit the BB record or any other filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
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
- The tree agrees with her account: four commits; the backend change is
  `src/routes/worldEvents.js` and `src/services/financialPressureService.js`,
  from #2079; no frontend file, no migration, no package change (§2).
- **The live check (§5.2):** after a plain restart (3 → 4, online),
  `/health` returned healthy with the database connected. A live
  affordability or financial-pressure request: **not exercised**; #2079's
  integration tests cover it.
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.1.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2091.*
