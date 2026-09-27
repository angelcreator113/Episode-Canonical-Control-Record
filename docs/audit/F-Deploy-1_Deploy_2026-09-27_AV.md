| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AV, 2026-09-27, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. Icons can be dragged with a mouse; the jump on release is snap-to-grid.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AU.md` (the AU record, filed with this one). This document
follows that one rather than editing it. Basis:
`e8b1b2ebc0a76f6e653a1c006916342b0ee52359` (#2019), the tree Deploy AV moved
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

The deploy is lettered AV, continuing after Deploy AU. It is one of six
records (AR to AW) filed together under Task #2026.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `18e7c348` → `e8b1b2eb`. Frontend only: no backend restart,
  no migration.
- Backup `~/dist.bak-20260927-pre2019`, taken before the build, holding the
  previous entry `index-DGb4b6e5.js`.
- The build succeeded. New entry `index-D8H84cyu.js`.
- The optional rsync to `/var/www/html` followed.
- **Live check:** dragging and clicking icons worked on a laptop. A small
  jump on release was measured in Chromium as snap-to-grid on release (Snap
  defaulted on in ICON mode), not a fault.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `18e7c348` to `e8b1b2eb` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 18e7c348 e8b1b2eb
18e7c3488167d30807a3dc4f554060e9649816ef
e8b1b2ebc0a76f6e653a1c006916342b0ee52359
$ git merge-base --is-ancestor 18e7c348 e8b1b2eb; echo "exit=$?"
exit=0
```

Deploy AU ends at `18e7c348` (AU record §1, §8); Deploy AV begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent 18e7c348..e8b1b2eb
e8b1b2eb fix(phone): icons can be dragged with a mouse [skip-automerge] (#2019)

$ git diff --name-only 18e7c348 e8b1b2eb -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/components/IconPlacementMode.drag.test.jsx
frontend/src/components/IconPlacementMode.jsx

$ git diff --name-only 18e7c348 e8b1b2eb -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
```

One commit, #2019: two files under `frontend/src`, one of them a test.
Nothing under `src/`, no migration file, no package manifest or lockfile.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AV. Her backup is named for 2026-09-27.

**MEASURED.** The newest commit in the range is #2019, 23:25:01 UTC on 2026-09-26, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" 18e7c348..e8b1b2eb
e8b1b2eb 2026-09-26T19:25:01-04:00 fix(phone): icons can be dragged with a mouse [skip-automerge] (#2019)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only e8b1b2eb src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

#2019 (`e8b1b2eb`): `IconPlacementMode`'s drag. Pointer capture moves to the
container, a press only becomes a drag past a 0.5-point threshold, and the
click that follows a drag is suppressed. A Chromium script,
`frontend/e2e/iconDrag/`, drives the drag in a real browser.

### §5.2 The live check, beside the code

**ATTESTED (§0).** Dragging and clicking icons worked on a laptop; the small
jump on release was measured in Chromium as snap-to-grid on release.

**MEASURED.** At `e8b1b2eb`, ICON mode's Snap is on unless it was turned
off, and a drag with Snap on snaps the icon when it is released:

```
$ git show e8b1b2eb:frontend/src/components/IconPlacementMode.jsx | grep -n "phone_hub_icon_grid_snap') !== '0'\|dragging && gridSnap"
108:      return localStorage.getItem('phone_hub_icon_grid_snap') !== '0';
289:    if (dragging && gridSnap && (!press || press.moved)) {
```

ICON mode was later removed (#2023, Deploy AW). The one editor's Snap
defaults to off:

```
$ git show 594714ed:frontend/src/pages/UIOverlaysTab.jsx | grep -n "getItem('screenLinkEditor.iconGridSnap')"
132:    try { return localStorage.getItem('screenLinkEditor.iconGridSnap') === '1'; } catch (err) { console.warn('[UIOverlaysTab] localStorage unavailable:', err.message); return false; }
```

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
`frontend/dist` to `~/dist.bak-20260927-pre2019`, which holds the previous entry,
`index-DGb4b6e5.js`. The build produced the new entry `index-D8H84cyu.js`. The
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

**MEASURED.** After Deploy AV, production's tree is this record's basis,
`e8b1b2eb`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
594714eda6e86747f77226efafbf13977c2d1627 2026-09-26 feat(phone): "+ Add" asks what you're adding [skip-automerge] (#2025)
```

The commits after `e8b1b2eb` up to `594714ed` are deployed by the later records of
this filing (AW), not by Deploy AV.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5.2
  state in words;
- does not edit the AU record or any other filed document;
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
- The tree agrees with her account: one commit, two frontend files, no
  migration, no package change (§2).
- **The live check (§5.2):** drag and click worked; the jump on release is
  ICON mode's Snap, on by default at this deploy (MEASURED), and gone with
  ICON mode at Deploy AW.
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
