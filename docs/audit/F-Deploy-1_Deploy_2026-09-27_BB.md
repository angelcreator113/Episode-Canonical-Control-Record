| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BB, 2026-09-27, backend only, one plain restart, no migration, performed personally by Evoni, outside any agent session. Deleting a world character is all-or-nothing.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_BA.md` (the BA record, filed with this one).
This document follows that one rather than editing it. Basis:
`073e57f8c73ca7988c1abd4c5684d14eec947539` (#2071), the tree Deploy BB moved
production to. `origin/main` at filing is `073e57f8` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output and screenshots.
  It cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, and register documents
  already merged under `docs/audit/`.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host, user id, account number or ARN.

The deploy is lettered BB, continuing after Deploy BA. It is one of two
records (BA and BB) filed together under Task #2072.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `574cc911` → `073e57f8`. Backend: the diff is
  `src/routes/worldStudio.js` only. The steps were `DEVELOPMENT_WORKFLOW.md`
  §7.1's.
- Pending-migration check: "OK: 0 pending of 218", `exit=0`.
- `node -c src/routes/worldStudio.js`: ok.
- A plain `pm2 restart`, without `--update-env`. The restart count went from
  2 to 3; the process is online.
- **After 10 seconds:** `/health` returned `status` healthy and `database`
  connected (timestamp `2026-09-27T18:32:07Z`).
- No frontend build. An rsync of the unchanged `frontend/dist` ran first; it
  changed nothing.
- **Live character delete: not exercised.** The fix's integration tests
  (#2071) cover it.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `574cc911` to `073e57f8` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 574cc911 073e57f8
574cc9117e9f3564559753f21281f4e569753b70
073e57f8c73ca7988c1abd4c5684d14eec947539
$ git merge-base --is-ancestor 574cc911 073e57f8; echo "exit=$?"
exit=0
```

Deploy BA ends at `574cc911` (BA record §1, §8); Deploy BB begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent 574cc911..073e57f8
073e57f8c fix(world): deleting a character is all-or-nothing [skip-automerge] (#2071)
50798e5e5 docs(audit): F-Stats-1 Fix Plan v1.62, Phase B items 2–7 ruled; XK-4 ratified [skip-automerge] (#2069)
eb674ae4c docs(audit): F-Stats-1 Phase B items 2–7, decisions needed [skip-automerge] (#2067)
9cd42acb9 docs(context): F-Stats-1 item 1 closed; §64.4-R owed [skip-automerge] (#2065)
32852ddd1 docs(audit): amend the calendarRoutes.js reads slice for the sourceLine path [skip-automerge] (#2063)
70331bac8 docs(audit): F-Stats-1 Fix Plan v1.61, reads survey closed on five slices [skip-automerge] (#2061)
d650b254d docs(audit): F-Stats-1 reads survey, options for closing item 1 [skip-automerge] (#2059)
$ git diff --name-only 574cc911 073e57f8 -- src frontend/src src/migrations package.json frontend/package.json
src/routes/worldStudio.js
$ git diff --name-only 574cc911 073e57f8 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
src/routes/worldStudio.js
exit=0
$ git diff --name-only 574cc911 073e57f8 -- . ':!frontend/src' ':!docs/audit'
PROJECT_CONTEXT.md
scripts/silent-catches.baseline
src/routes/worldStudio.js
tests/integration/worldCharacterDelete.integration.test.js
```

Seven commits: #2059, #2061, #2063, #2065, #2067, #2069 and #2071. #2059,
#2061, #2063, #2067 and #2069 are register documents only; #2065 is
`PROJECT_CONTEXT.md` only. #2071 carries the code: `src/routes/worldStudio.js`,
the only file changed under `src/`, `frontend/src` or a package manifest.
Its other two files are a test and the silent-catch lint baseline (neither
served). No frontend file, no migration file, no package manifest or
lockfile.

**Beside her account.** "`src/routes/worldStudio.js` only" agrees with the
measurement.

## §3. The time

**ATTESTED.** `/health` answered at `2026-09-27T18:32:07Z`, after the
restart.

**MEASURED.** The newest commit in the range is #2071, 18:30:58 UTC on
2026-09-27, so the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 574cc911..073e57f8
073e57f8c 2026-09-27T14:30:58-04:00 fix(world): deleting a character is all-or-nothing [skip-automerge] (#2071)
50798e5e5 2026-09-27T14:18:50-04:00 docs(audit): F-Stats-1 Fix Plan v1.62, Phase B items 2–7 ruled; XK-4 ratified [skip-automerge] (#2069)
eb674ae4c 2026-09-27T13:59:46-04:00 docs(audit): F-Stats-1 Phase B items 2–7, decisions needed [skip-automerge] (#2067)
9cd42acb9 2026-09-27T13:55:47-04:00 docs(context): F-Stats-1 item 1 closed; §64.4-R owed [skip-automerge] (#2065)
32852ddd1 2026-09-27T13:41:42-04:00 docs(audit): amend the calendarRoutes.js reads slice for the sourceLine path [skip-automerge] (#2063)
70331bac8 2026-09-27T13:30:20-04:00 docs(audit): F-Stats-1 Fix Plan v1.61, reads survey closed on five slices [skip-automerge] (#2061)
d650b254d 2026-09-27T13:21:50-04:00 docs(audit): F-Stats-1 reads survey, options for closing item 1 [skip-automerge] (#2059)
```

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check: "OK: 0 pending of 218", `exit=0`.
`node -c src/routes/worldStudio.js`: ok.

**MEASURED.** The migration tree holds 218 files at the end of the range,
matching the check's total:

```
$ git ls-tree -r --name-only 073e57f8 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

#2071 (`073e57f8`, Task #2070), `fix(world)`, F-Stats-1 Fix Plan v1.62
§65.6-F: `DELETE /world/characters/:id` runs its deletes in one
`sequelize.transaction`, with nothing caught inside it. A failure part-way
rolls the whole delete back, and the route answers 500 with a logged error.
The `character_relationships_extended` delete runs only where that table
exists (`to_regclass`).

```
$ git show 073e57f8:src/routes/worldStudio.js | grep -n "router.delete('/world/characters/:id'\|sequelize.transaction(async\|to_regclass\|delete character failed"
1841:router.delete('/world/characters/:id', requireAuth, async (req, res) => {
1843:    await sequelize.transaction(async (transaction) => {
1859:      const [ext] = await Q(req, 'SELECT to_regclass(:name) AS t',
1869:    console.error('[world-studio] delete character failed; rolled back:', err.message);
```

### §5.2 The live check, beside the code

**ATTESTED (§0).** After the restart, `/health` returned `status` healthy
and `database` connected. The process is online at restart count 3.

**MEASURED.** A healthy answer after the restart shows the app started with
#2071's `worldStudio.js` loaded without error; it does not exercise the
delete route.

**Not exercised live:** a character delete, on success or on failure. The
fix's integration tests (`tests/integration/worldCharacterDelete.integration.test.js`,
#2071) cover both, against a database built by the migration tree, not
production.

### §5.3 Production's path, and no frontend build

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3: HTTPS requests reach the box's app on port 3000 through the load
balancer. `DEVELOPMENT_WORKFLOW.md` §7.1 gives the backend steps: the
pending-migration check before the restart.

**No frontend build, ATTESTED and MEASURED.** Her account names no build.
No file under `frontend/src` changed (§2). The rsync of the unchanged
`frontend/dist` that ran first changed nothing (ATTESTED).

## §6. Restarts

**ATTESTED.** One restart: a plain `pm2 restart`, without `--update-env`;
the restart count went from 2 to 3, and the process is online.

**MEASURED.** A backend file changed (§2), so a restart was needed for it to
take effect. No `.env` or credential change is in the range.

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 218.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy BB, production's tree is this record's basis,
`073e57f8`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
073e57f8c73ca7988c1abd4c5684d14eec947539 2026-09-27 fix(world): deleting a character is all-or-nothing [skip-automerge] (#2071)
```

Nothing is merged after it.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from her output beyond what §0 and §5
  state in words;
- does not edit the BA record or any other filed document;
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
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md
$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from the AZ record §10. Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately.
- The tree agrees with her account: seven commits, the backend change
  `src/routes/worldStudio.js` only, from #2071; no frontend file, no
  migration, no package change (§2).
- **The live check (§5.2):** after a plain restart (2 → 3, online),
  `/health` returned healthy with the database connected. A live character
  delete: **not exercised**; #2071's integration tests cover it.
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.1.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2072.*
