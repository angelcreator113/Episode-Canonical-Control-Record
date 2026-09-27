| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AS, 2026-09-26, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. Placements draw their icon's current image; the live check waited for Deploy AU.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AR.md` (the AR record, filed with this one). This document
follows that one rather than editing it. Basis:
`fb4ea42fd2b469922025a5ce35e5df101327efd7` (#2007), the tree Deploy AS moved
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

The deploy is lettered AS, continuing after Deploy AR. It is one of six
records (AR to AW) filed together under Task #2026.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26):**

- Fast-forward `a2c75992` → `fb4ea42f`. Frontend only: no backend restart,
  no migration.
- Backup `~/dist.bak-20260926-pre2007`, taken before the build, holding the
  previous entry `index-D4FyuhRI.js`.
- The build succeeded. New entry `index-F3utKgx4.js`.
- The optional rsync to `/var/www/html` followed.
- **Live check:** placement could not be checked until Deploy AU.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `a2c75992` to `fb4ea42f` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse a2c75992 fb4ea42f
a2c75992311a615f8c32ab4c1f1bc24654ae5503
fb4ea42fd2b469922025a5ce35e5df101327efd7
$ git merge-base --is-ancestor a2c75992 fb4ea42f; echo "exit=$?"
exit=0
```

Deploy AR ends at `a2c75992` (AR record §1, §8); Deploy AS begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent a2c75992..fb4ea42f
fb4ea42f fix(phone): placements draw their icon's current image [skip-automerge] (#2007)
12d388b8 docs(doctrine): record the phone icon ruling [skip-automerge] (#2006)

$ git diff --name-only a2c75992 fb4ea42f -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/components/IconPlacementMode.jsx
frontend/src/components/PhoneHub.iconIdentity.test.jsx
frontend/src/components/PhoneHub.jsx
frontend/src/components/PhonePreviewMode.jsx
frontend/src/components/ScreenLinkEditor.jsx
frontend/src/components/phone/PhoneDevice.jsx
frontend/src/components/phone/zoneIcons.pinned.test.jsx
frontend/src/lib/overlayUtils.iconIdentity.test.js
frontend/src/lib/overlayUtils.js
frontend/src/pages/UIOverlaysTab.iconIdentity.test.jsx
frontend/src/pages/UIOverlaysTab.jsx

$ git diff --name-only a2c75992 fb4ea42f -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
```

Two commits. #2006 records doctrine rule 17 (a document). #2007 carries the
code: eleven files, all under `frontend/src`, four of them tests. Nothing
under `src/`, no migration file, no package manifest or lockfile.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AS.

**MEASURED.** The newest commit in the range is #2007, 21:03:51 UTC, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" a2c75992..fb4ea42f
fb4ea42f 2026-09-26T17:03:51-04:00 fix(phone): placements draw their icon's current image [skip-automerge] (#2007)
12d388b8 2026-09-26T16:22:19-04:00 docs(doctrine): record the phone icon ruling [skip-automerge] (#2006)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only fb4ea42f src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

#2007 (`fb4ea42f`), doctrine rule 17: placements store the icon's key.

- `overlayUtils` gains `resolveZoneIconKey`, `resolveZoneIcon` and
  `withResolvedIconKey`. A placement's image is looked up from its icon key
  when it is drawn, so an icon's new image reaches every placement.
- The automatic placement on the home screen (`autoPlaceIconOnHome`) is
  removed. Generate, Remove BG and Change image send no screen-links write.

### §5.2 The live check, beside the code

**ATTESTED (§0).** Placement could not be checked at this deploy. Deploy AU's
record states what her live check showed once it could be.

**MEASURED.** Nothing in the range needed a check here that AU's does not
cover: #2007's drawing path is the one AU's live check exercised.

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
`frontend/dist` to `~/dist.bak-20260926-pre2007`, which holds the previous entry,
`index-D4FyuhRI.js`. The build produced the new entry `index-F3utKgx4.js`. The
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

**MEASURED.** After Deploy AS, production's tree is this record's basis,
`fb4ea42f`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
594714eda6e86747f77226efafbf13977c2d1627 2026-09-26 feat(phone): "+ Add" asks what you're adding [skip-automerge] (#2025)
```

The commits after `fb4ea42f` up to `594714ed` are deployed by the later records of
this filing (AT to AW), not by Deploy AS.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5.2
  state in words;
- does not edit the AR record or any other filed document;
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
- The tree agrees with her account: two commits, #2007's eleven frontend
  files the only code, no migration, no package change (§2).
- **The live check (§5.2):** deferred to Deploy AU, as she states.
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
