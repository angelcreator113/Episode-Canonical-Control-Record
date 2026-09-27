| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AT, 2026-09-26, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. The Phone Hub is organised in stages: Build, Connect, Content, Preview and Advanced.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AS.md` (the AS record, filed with this one). This document
follows that one rather than editing it. Basis:
`ccbf688288065bfc98b668c36e5fc1ef5fed4cd1` (#2013), the tree Deploy AT moved
production to. `origin/main` at filing is `594714ed` (§8).

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

The deploy is lettered AT, continuing after Deploy AS. It is one of six
records (AR to AW) filed together under Task #2026.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26):**

- Fast-forward `fb4ea42f` → `ccbf6882`. Frontend only: no backend restart,
  no migration.
- Backup `~/dist.bak-20260926-pre2013`, taken before the build, holding the
  previous entry `index-F3utKgx4.js`.
- The build succeeded. New entry `index-DA0Agbs4.js`.
- The optional rsync to `/var/www/html` followed.
- **Live check, from her screenshot:** the Phone Hub showed
  Build · Connect · Content · Preview · Advanced ▾.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `fb4ea42f` to `ccbf6882` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse fb4ea42f ccbf6882
fb4ea42fd2b469922025a5ce35e5df101327efd7
ccbf688288065bfc98b668c36e5fc1ef5fed4cd1
$ git merge-base --is-ancestor fb4ea42f ccbf6882; echo "exit=$?"
exit=0
```

Deploy AS ends at `fb4ea42f` (AS record §1, §8); Deploy AT begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent fb4ea42f..ccbf6882
ccbf6882 feat(phone): the Phone Hub is organised in stages [skip-automerge] (#2013)
9363a33d docs(doctrine): record the phone editing stages [skip-automerge] (#2012)
543b875c fix(phone): selecting an icon keeps the phone's screen and highlights its placements [skip-automerge] (#2011)

$ git diff --name-only fb4ea42f ccbf6882 -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/components/PhoneHub.device.test.jsx
frontend/src/components/PhoneHub.iconSelection.test.jsx
frontend/src/components/PhoneHub.jsx
frontend/src/components/PhoneHubSectionTabs.css
frontend/src/components/PhoneHubSectionTabs.jsx
frontend/src/components/PhoneHubSectionTabs.stages.test.jsx
frontend/src/components/phone/PhoneDevice.jsx
frontend/src/pages/UIOverlaysTab.css
frontend/src/pages/UIOverlaysTab.iconSelection.test.jsx
frontend/src/pages/UIOverlaysTab.jsx
frontend/src/pages/UIOverlaysTab.stages.test.jsx
frontend/src/pages/UIOverlaysTab.tabs.pinned.test.jsx

$ git diff --name-only fb4ea42f ccbf6882 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
```

Three commits. #2012 records doctrine rule 18 (a document). #2011 and #2013
carry the code: twelve files, all under `frontend/src`, six of them tests.
Nothing under `src/`, no migration file, no package manifest or lockfile.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AT.

**MEASURED.** The newest commit in the range is #2013, 22:12:58 UTC, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" fb4ea42f..ccbf6882
ccbf6882 2026-09-26T18:12:58-04:00 feat(phone): the Phone Hub is organised in stages [skip-automerge] (#2013)
9363a33d 2026-09-26T18:02:52-04:00 docs(doctrine): record the phone editing stages [skip-automerge] (#2012)
543b875c 2026-09-26T17:57:30-04:00 fix(phone): selecting an icon keeps the phone's screen and highlights its placements [skip-automerge] (#2011)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only ccbf6882 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

- #2011 (`543b875c`): selecting an icon keeps the phone on the screen it was
  showing and highlights that icon's placements (`PhoneDevice`'s
  `highlightIconKey`).
- #2013 (`ccbf6882`), doctrine rule 18: `PhoneHubSectionTabs` becomes a
  stage row, Build · Connect · Content · Preview · Advanced ▾, with a
  Screens / Icons toggle under Build and Missions under Advanced. The
  Preview stage plays the phone in the device's place.

### §5.2 The live check, beside the code

**ATTESTED (§0).** The Phone Hub showed Build · Connect · Content · Preview ·
Advanced ▾.

**MEASURED.** That is #2013's stage row: the four stage buttons and the
Advanced menu in `PhoneHubSectionTabs`. #2011's highlight is not named in
her account and is not attested here.

### §5.3 Production's path and the backup

**Production's request path.** For the path a request takes to production,
this record cites `F-Deploy-1_Fix_Plan_v1.56.md` (production's path,
confirmed). At this record's filing that revision is **owed and not yet
filed**: no issue for it exists and nothing under `docs/audit/` carries it.
Until it is filed, the path below stands only as Evoni's account.

**ATTESTED (Evoni, as given for Task #2026):** requests reach production
through the load balancer to the box's app on port 3000, which serves
`frontend/dist`. The rsync of the build to `/var/www/html` reaches
`dev.primepisodes.com` and plain HTTP only.

**The backup and the build, ATTESTED.** Before the build she backed up
`frontend/dist` to `~/dist.bak-20260926-pre2013`, which holds the previous entry,
`index-F3utKgx4.js`. The build produced the new entry `index-DA0Agbs4.js`. The
optional rsync to `/var/www/html` followed. From Deploy AS on, the backup is
of `frontend/dist`, taken before the build, because `frontend/dist` is what
production serves.

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy AT, production's tree is this record's basis,
`ccbf6882`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
594714eda6e86747f77226efafbf13977c2d1627 2026-09-26 feat(phone): "+ Add" asks what you're adding [skip-automerge] (#2025)
```

The commits after `ccbf6882` up to `594714ed` are deployed by the later records of
this filing (AU to AW), not by Deploy AT.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5.2
  state in words;
- does not edit the AS record or any other filed document;
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

Unchanged from the AQ record §10. Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately.
- The tree agrees with her account: three commits, twelve frontend files the
  only code, no migration, no package change (§2).
- **The live check (§5.2):** the stage row. #2011's highlight: not
  attested.
- Production's path (§5.3) is Evoni's account only until
  `F-Deploy-1_Fix_Plan_v1.56.md` is filed; this record does not stand in
  for it.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2026.*
