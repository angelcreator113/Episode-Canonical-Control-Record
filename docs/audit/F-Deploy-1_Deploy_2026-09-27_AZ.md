| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AZ, 2026-09-27, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. The first zone can be added on a screen that had none.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_AY.md` (the AY record, filed with this one).
This document follows that one rather than editing it. Basis:
`df51d3b803704e17efd1686bd3546bcc68a34aee` (#2045), the tree Deploy AZ moved
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
- **INFERRED** marks one reading of a screenshot in §5.4, and nothing else.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host, user id, account number or ARN.

The deploy is lettered AZ, continuing after Deploy AY. It is one of three
records (AX to AZ) filed together under Task #2046.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `0c2d2d73` → `df51d3b8`. Frontend only: no backend restart,
  no migration. The steps were `DEVELOPMENT_WORKFLOW.md` §7.3's.
- Backup `~/dist.bak-20260927-pre2045`, taken before the build, holding the
  previous entry `index-CAwZc9Iv.js`.
- The build succeeded. New entry `index-D9PvZP9y.js`.
- The optional rsync to `/var/www/html` followed.
- **Live check:**
  - On closet, a screen with no zones before, a first zone ("Hair", with its icon) was added and kept; the zones count reads 1 (her screenshot).
- Her screenshot also shows a red console error naming `reportAllChanges`
  and reading `Cannot read properties of undefined (reading 'startTime')`,
  from a script with no file name (`VM9295`, `<anonymous>`). Recorded in §5.4.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `0c2d2d73` to `df51d3b8` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 0c2d2d73 df51d3b8
0c2d2d73ef2bce8fee9ce5a483b79c5e6399cea9
df51d3b803704e17efd1686bd3546bcc68a34aee
$ git merge-base --is-ancestor 0c2d2d73 df51d3b8; echo "exit=$?"
exit=0
```

Deploy AY ends at `0c2d2d73` (AY record §1, §8); Deploy AZ begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent 0c2d2d73..df51d3b8
df51d3b80 fix(phone): the first zone can be added on any screen [skip-automerge] (#2045)
$ git diff --name-only 0c2d2d73 df51d3b8 -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/pages/UIOverlaysTab.firstZone.test.jsx
frontend/src/pages/UIOverlaysTab.jsx
$ git diff --name-only 0c2d2d73 df51d3b8 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
$ git diff --name-only 0c2d2d73 df51d3b8 -- . ':!frontend/src'
frontend/e2e/iconDrag/apiStub.js
frontend/e2e/iconDrag/run.cjs
```

One commit, #2045. The code is two files, both under `frontend/src`, one of
them a test, from #2045. Nothing under `src/`, no migration file, no package
manifest or lockfile. The other two files are the browser check,
`frontend/e2e/iconDrag/` (not served).

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AZ.

**MEASURED.** The newest commit in the range is #2045, 14:52:57 UTC on 2026-09-27, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" 0c2d2d73..df51d3b8
df51d3b80 2026-09-27T10:52:57-04:00 fix(phone): the first zone can be added on any screen [skip-automerge] (#2045)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only df51d3b8 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

- #2045 (`df51d3b8`, Task #2044): the zones workspace memoizes the editor's
  links on the active screen (`UIOverlaysTab.jsx`). A screen that had never
  had zones re-rendered in a loop that wiped each new zone; tap, draw and
  Add now each keep the zone. Adds first-zone scenarios to
  `frontend/e2e/iconDrag/`, not served.

### §5.2 The live check, beside the code

**ATTESTED (§0).**
- On closet, a screen with no zones before, a first zone ("Hair", with its icon) was added and kept; the zones count reads 1 (her screenshot).

**MEASURED.** A first zone kept on a screen that had none is #2045's change.

Draw and Add on such a screen, and wallet: **not attested** individually.

### §5.3 Production's path and the backup

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3 (filed by #2031): HTTPS requests reach the box's app on port 3000 through
the load balancer, and the app serves the built frontend from `frontend/dist`.
`DEVELOPMENT_WORKFLOW.md` §7.3 (#2032) gives the steps that follow from it.
The rsync to `/var/www/html` reaches `dev.primepisodes.com` and plain HTTP
only.

**The backup and the build, ATTESTED.** Before the build she backed up
`frontend/dist` to `~/dist.bak-20260927-pre2045`, which holds the previous
entry, `index-CAwZc9Iv.js`. The build produced the new entry
`index-D9PvZP9y.js`. The optional rsync to `/var/www/html` followed.

**Continuity, ATTESTED, across the two records.** The entry this backup holds,
`index-CAwZc9Iv.js`, is the entry Deploy AY built (AY record §0, filed with
this one).

### §5.4 Observed, not ruled: a console error

**ATTESTED (§0).** Her screenshot's browser console shows one red error,
naming `reportAllChanges` and reading `Cannot read properties of undefined
(reading 'startTime')`, from a script shown as `VM9295` / `<anonymous>`, with
no file name. The app's own code shows in the console under its bundle's file
names, such as this deploy's entry `index-D9PvZP9y.js`.

**MEASURED.** No file under `frontend/src` or `src` names `reportAllChanges`:

```
$ git grep -n "reportAllChanges" -- frontend/src src; echo "exit=$?"
exit=1
```

**INFERRED.** The error comes from a browser extension measuring page speed,
not from the app. Nothing here rules on it, and nothing in the app is changed
for it.

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy AZ, production's tree is this record's basis,
`df51d3b8`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
df51d3b803704e17efd1686bd3546bcc68a34aee 2026-09-27 fix(phone): the first zone can be added on any screen [skip-automerge] (#2045)
```

Nothing is merged after it.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5
  state in words;
- does not edit the AY record or any other filed document;
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
- The tree agrees with her account: one commit, the code two files, both under `frontend/src`, one of them a test, no migration, no package change (§2).
- **The live check (§5.2):** On closet, a screen with no zones before, a first zone ("Hair", with its icon) was added and kept; the zones count reads 1 (her screenshot). Draw and Add on such a screen, and wallet: **not attested** individually.
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.3.
- One clause is INFERRED: the console error's source (§5.4). Nothing in this
  document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2046.*
