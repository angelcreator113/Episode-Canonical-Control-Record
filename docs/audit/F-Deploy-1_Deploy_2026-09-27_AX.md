| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AX, 2026-09-27, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. Make Row and the other layout tools line zones up by their centres.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_AW.md` (the AW record). This document follows
that one rather than editing it. Basis:
`061c3737addbd9b56ad4cb2484760974ab527137` (#2033), the tree Deploy AX moved
production to. `origin/main` at filing is `df51d3b8` (§8).

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

The deploy is lettered AX, continuing after Deploy AW. It is one of three
records (AX to AZ) filed together under Task #2046.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `594714ed` → `061c3737`. Frontend only: no backend restart,
  no migration. The steps were `DEVELOPMENT_WORKFLOW.md` §7.3's.
- Backup `~/dist.bak-20260927-pre2033`, taken before the build, holding the
  previous entry `index-3lqfFZXF.js`.
- The build succeeded. New entry `index-CovCtrE9.js`.
- The optional rsync to `/var/www/html` followed.
- **Live check:**
  - On Homepage, Make Row put the dock zones on one centre line. Her words: "it works".

## §1. Identity and continuity

**ATTESTED.** The tree moved from `594714ed` to `061c3737` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 594714ed 061c3737
594714eda6e86747f77226efafbf13977c2d1627
061c3737addbd9b56ad4cb2484760974ab527137
$ git merge-base --is-ancestor 594714ed 061c3737; echo "exit=$?"
exit=0
```

Deploy AW ends at `594714ed` (AW record §1, §8); Deploy AX begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent 594714ed..061c3737
061c3737a fix(phone): layout tools align zones by their centres [skip-automerge] (#2033)
95f2cf582 docs(workflow): frontend deploys back up and build frontend/dist [skip-automerge] (#2032)
8bce496b1 docs(audit): F-Deploy-1 Fix Plan v1.56, production's request path confirmed [skip-automerge] (#2031)
ef8be2232 docs(audit): file deploy records AR–AW [skip-automerge] (#2027)
$ git diff --name-only 594714ed 061c3737 -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/components/ScreenLinkEditor.jsx
frontend/src/components/connectEditor.tap.test.jsx
frontend/src/components/connectLayoutTools.test.jsx
frontend/src/components/phone/homeGrid.js
$ git diff --name-only 594714ed 061c3737 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
$ git diff --name-only 594714ed 061c3737 -- . ':!frontend/src'
DEVELOPMENT_WORKFLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-26_AR.md
docs/audit/F-Deploy-1_Deploy_2026-09-26_AS.md
docs/audit/F-Deploy-1_Deploy_2026-09-26_AT.md
docs/audit/F-Deploy-1_Deploy_2026-09-26_AU.md
docs/audit/F-Deploy-1_Deploy_2026-09-27_AV.md
docs/audit/F-Deploy-1_Deploy_2026-09-27_AW.md
docs/audit/F-Deploy-1_Fix_Plan_v1.56.md
frontend/e2e/layoutTools/apiStub.js
frontend/e2e/layoutTools/run.cjs
```

Four commits, #2027, #2031, #2032 and #2033. The code is four files, all under
`frontend/src`, two of them tests, from #2033. Nothing under `src/`, no
migration file, no package manifest or lockfile. The other ten files are
documents and the browser check: the six deploy records AR to AW and Fix Plan
v1.56 under `docs/audit/`, `DEVELOPMENT_WORKFLOW.md`, and
`frontend/e2e/layoutTools/` (two files, not served).

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AX.

**MEASURED.** The newest commit in the range is #2033, 02:47:40 UTC on 2026-09-27, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" 594714ed..061c3737
061c3737a 2026-09-26T22:47:40-04:00 fix(phone): layout tools align zones by their centres [skip-automerge] (#2033)
95f2cf582 2026-09-26T22:34:03-04:00 docs(workflow): frontend deploys back up and build frontend/dist [skip-automerge] (#2032)
8bce496b1 2026-09-26T22:23:32-04:00 docs(audit): F-Deploy-1 Fix Plan v1.56, production's request path confirmed [skip-automerge] (#2031)
ef8be2232 2026-09-26T22:08:37-04:00 docs(audit): file deploy records AR–AW [skip-automerge] (#2027)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only 061c3737 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

- #2027 (`ef8be223`): deploy records AR to AW, under `docs/audit/`. Not
  served.
- #2031 (`8bce496b`): `F-Deploy-1_Fix_Plan_v1.56.md`, production's request
  path confirmed. Not served.
- #2032 (`95f2cf58`): `DEVELOPMENT_WORKFLOW.md` §7.3, the frontend deploy
  steps. Not served.
- #2033 (`061c3737`, Task #2030): Connect's layout tools act on zone centres.
  Make Row and Make Column put centres on one line, one home-grid step
  apart; Align C, Dist H / V, Equal Size and Snap to Grid use centres; Align
  L / R keep edges (`ScreenLinkEditor.jsx`, `phone/homeGrid.js`). Adds
  `frontend/e2e/layoutTools/`, not served.

### §5.2 The live check, beside the code

**ATTESTED (§0).**
- On Homepage, Make Row put the dock zones on one centre line. Her words: "it works".

**MEASURED.** Make Row on centres is #2033's change. The AW record §5.2 left Make Row and
the align tools' misalignment **open**, as a separate task; #2033 is that
task's fix (Task #2030). This record does not edit the AW record.

The other layout tools (Align, Dist, Equal Size, Snap to Grid): **not attested.**

### §5.3 Production's path and the backup

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3 (filed by #2031): HTTPS requests reach the box's app on port 3000 through
the load balancer, and the app serves the built frontend from `frontend/dist`.
`DEVELOPMENT_WORKFLOW.md` §7.3 (#2032) gives the steps that follow from it.
The rsync to `/var/www/html` reaches `dev.primepisodes.com` and plain HTTP
only.

**The backup and the build, ATTESTED.** Before the build she backed up
`frontend/dist` to `~/dist.bak-20260927-pre2033`, which holds the previous
entry, `index-3lqfFZXF.js`. The build produced the new entry
`index-CovCtrE9.js`. The optional rsync to `/var/www/html` followed.

**Continuity, MEASURED from the register.** The entry this backup holds,
`index-3lqfFZXF.js`, is the entry Deploy AW built (AW record §0, §5.3).

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy AX, production's tree is this record's basis,
`061c3737`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
df51d3b803704e17efd1686bd3546bcc68a34aee 2026-09-27 fix(phone): the first zone can be added on any screen [skip-automerge] (#2045)
```

`df51d3b8` is Deploy AZ's tree (AZ record, filed with this one); Deploy AX's tree, `061c3737`, is its ancestor.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5
  state in words;
- does not edit the AW record or any other filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
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

Unchanged from the AW record §10. Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately.
- The tree agrees with her account: four commits, the code four files, all under `frontend/src`, two of them tests, no migration, no package change (§2).
- **The live check (§5.2):** On Homepage, Make Row put the dock zones on one centre line. Her words: "it works". The other layout tools (Align, Dist, Equal Size, Snap to Grid): **not attested.**
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.3.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2046.*
