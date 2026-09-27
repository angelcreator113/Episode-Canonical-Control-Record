| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AW, 2026-09-27, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. Connect has one editor, and "+ Add" asks what you're adding.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_AV.md` (the AV record, filed with this one). This document
follows that one rather than editing it. Basis:
`594714eda6e86747f77226efafbf13977c2d1627` (#2025), the tree Deploy AW moved
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

The deploy is lettered AW, continuing after Deploy AV. It is one of six
records (AR to AW) filed together under Task #2026.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `e8b1b2eb` → `594714ed`. Frontend only: no backend restart,
  no migration.
- Backup `~/dist.bak-20260927-pre2025`, taken before the build, holding the
  previous entry `index-D8H84cyu.js`.
- The build succeeded. New entry `index-3lqfFZXF.js`.
- The optional rsync to `/var/www/html` followed.
- **Live check, from her screenshots:** Connect has one editor; the zone
  rows show "Icon: Camera" and "Icon: Phone"; Homepage's Screen Health reads
  "Ready"; the dock icons are in place.
- Make Row and the align tools' results looked misaligned: **open**, a
  separate task.
- Remove BG's result: **not attested.**

## §1. Identity and continuity

**ATTESTED.** The tree moved from `e8b1b2eb` to `594714ed` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse e8b1b2eb 594714ed
e8b1b2ebc0a76f6e653a1c006916342b0ee52359
594714eda6e86747f77226efafbf13977c2d1627
$ git merge-base --is-ancestor e8b1b2eb 594714ed; echo "exit=$?"
exit=0
```

Deploy AV ends at `e8b1b2eb` (AV record §1, §8); Deploy AW begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent e8b1b2eb..594714ed
594714ed feat(phone): "+ Add" asks what you're adding [skip-automerge] (#2025)
cbaac77c feat(phone): one Connect editor, with no Tap / Icon toggle [skip-automerge] (#2023)
3d3287f9 feat(phone): the TAP editor gains ICON mode's abilities [skip-automerge] (#2022)

$ git diff --name-only e8b1b2eb 594714ed -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/components/IconPlacementMode.drag.test.jsx
frontend/src/components/IconPlacementMode.jsx
frontend/src/components/ScreenLinkEditor.jsx
frontend/src/components/connectAbilities.pinned.test.jsx
frontend/src/components/connectEditor.drag.test.jsx
frontend/src/components/connectEditor.tap.test.jsx
frontend/src/components/phone/ZonesTab.css
frontend/src/components/phone/homeGrid.js
frontend/src/components/zonesWorkspace.connect.test.jsx
frontend/src/components/zonesWorkspace.pinned.test.jsx
frontend/src/pages/UIOverlaysTab.addChooser.test.jsx
frontend/src/pages/UIOverlaysTab.addKeys.pinned.test.jsx
frontend/src/pages/UIOverlaysTab.connect.test.jsx
frontend/src/pages/UIOverlaysTab.connectAbilities.pinned.test.jsx
frontend/src/pages/UIOverlaysTab.connectEditor.test.jsx
frontend/src/pages/UIOverlaysTab.css
frontend/src/pages/UIOverlaysTab.homeAndIconSave.test.jsx
frontend/src/pages/UIOverlaysTab.iconIdentity.test.jsx
frontend/src/pages/UIOverlaysTab.iconSelection.test.jsx
frontend/src/pages/UIOverlaysTab.jsx
frontend/src/pages/UIOverlaysTab.oneEditor.test.jsx
frontend/src/pages/UIOverlaysTab.stages.test.jsx
frontend/src/pages/UIOverlaysTab.tabs.pinned.test.jsx
frontend/src/styles/design-tokens.css

$ git diff --name-only e8b1b2eb 594714ed -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
```

Three commits, #2022, #2023 and #2025, all code: twenty-four files, all
under `frontend/src`, seventeen of them tests. Nothing under `src/`, no
migration file, no package manifest or lockfile.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AW.

**MEASURED.** The newest commit in the range is #2025, 01:25:41 UTC on 2026-09-27, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" e8b1b2eb..594714ed
594714ed 2026-09-26T21:25:41-04:00 feat(phone): "+ Add" asks what you're adding [skip-automerge] (#2025)
cbaac77c 2026-09-26T21:05:00-04:00 feat(phone): one Connect editor, with no Tap / Icon toggle [skip-automerge] (#2023)
3d3287f9 2026-09-26T20:10:01-04:00 feat(phone): the TAP editor gains ICON mode's abilities [skip-automerge] (#2022)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only 594714ed src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

- #2022 (`3d3287f9`): the tap-zone editor (`ScreenLinkEditor`) gains ICON
  mode's abilities: tap to place a library icon, Multi Select, Make Row,
  Make Column, Snap Selected and Auto Layout, and a Snap toggle, off by
  default.
- #2023 (`cbaac77c`): one Connect editor. The Tap / Icon toggle is removed
  and `IconPlacementMode` is deleted. The panel reads "Zones (n)"; "Pin to
  all screens" and "Delete N Selected" move into the one editor.
- #2025 (`594714ed`): "+ Add" asks Screen, Icon or Content Area; the create
  form shows the key; Batch Upload and the frame move to "More"; an icon's
  detail panel shows its background as Original, Removing…, Removed or
  Failed, with Retry.

### §5.2 The live check, beside the code

**ATTESTED (§0).** One editor in Connect, rows reading "Icon: Camera" and
"Icon: Phone", Homepage's Screen Health "Ready", and the dock icons in place.

**MEASURED.** Each matches the range: one editor is #2023; the row's icon
line is #2015's (Deploy AU), kept by #2023; "Ready" is screen health with no
issue.

**Open, not a finding of this record:** Make Row and the align tools looked
misaligned in her screenshot. It is a separate task, not yet filed. **Not
attested:** #2025's chooser and Remove BG's background state.

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
`frontend/dist` to `~/dist.bak-20260927-pre2025`, which holds the previous entry,
`index-D8H84cyu.js`. The build produced the new entry `index-3lqfFZXF.js`. The
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

**MEASURED.** After Deploy AW, production's tree is this record's basis,
`594714ed`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
594714eda6e86747f77226efafbf13977c2d1627 2026-09-26 feat(phone): "+ Add" asks what you're adding [skip-automerge] (#2025)
```

Nothing is merged after it.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5.2
  state in words;
- does not edit the AV record or any other filed document;
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
- The tree agrees with her account: three commits, twenty-four frontend
  files the only code, no migration, no package change (§2).
- **The live check (§5.2):** one editor, the rows' icon lines, "Ready", the
  dock. Make Row / align misalignment: open, a separate task. #2025's
  chooser and Remove BG: not attested.
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
