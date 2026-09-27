| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AU, 2026-09-26, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. Tap Zones rows attach library icons; Homepage's dock drew them.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AT.md` (the AT record, filed with this one). This document
follows that one rather than editing it. Basis:
`18e7c3488167d30807a3dc4f554060e9649816ef` (#2017), the tree Deploy AU moved
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

The deploy is lettered AU, continuing after Deploy AT. It is one of six
records (AR to AW) filed together under Task #2026.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26):**

- Fast-forward `ccbf6882` → `18e7c348`. Frontend only: no backend restart,
  no migration.
- Backup `~/dist.bak-20260926-pre2017`, taken before the build, holding the
  previous entry `index-DA0Agbs4.js`.
- The build succeeded. New entry `index-DGb4b6e5.js`.
- The optional rsync to `/var/www/html` followed.
- **Live check, from her screenshots:** Homepage's dock drew library icons
  (map, camera, phone) after she picked them in the Tap Zones rows.
- A later image change updating a placed icon: **not attested.**
- #2017 was merged before its CI finished; all five checks later passed on
  `231bec51`.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `ccbf6882` to `18e7c348` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse ccbf6882 18e7c348
ccbf688288065bfc98b668c36e5fc1ef5fed4cd1
18e7c3488167d30807a3dc4f554060e9649816ef
$ git merge-base --is-ancestor ccbf6882 18e7c348; echo "exit=$?"
exit=0
```

Deploy AT ends at `ccbf6882` (AT record §1, §8); Deploy AU begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent ccbf6882..18e7c348
18e7c348 fix(phone): home is never "Unreached", ICON Done saves, no AI panel [skip-automerge] (#2017)
162e4d2d fix(phone): zones workspace attaches library icons and keeps zones in bounds [skip-automerge] (#2015)

$ git diff --name-only ccbf6882 18e7c348 -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/components/IconPlacementMode.jsx
frontend/src/components/PhoneHub.jsx
frontend/src/components/ScreenLinkEditor.jsx
frontend/src/components/phone-editor/ZoneIconPicker.css
frontend/src/components/phone-editor/ZoneIconPicker.jsx
frontend/src/components/phone/ZonesTab.css
frontend/src/components/zonesWorkspace.connect.test.jsx
frontend/src/components/zonesWorkspace.pinned.test.jsx
frontend/src/lib/overlayUtils.js
frontend/src/lib/overlayUtils.zones.test.js
frontend/src/pages/UIOverlaysTab.connect.test.jsx
frontend/src/pages/UIOverlaysTab.css
frontend/src/pages/UIOverlaysTab.homeAndIconSave.test.jsx
frontend/src/pages/UIOverlaysTab.jsx
frontend/src/pages/UIOverlaysTab.zonesWorkspace.pinned.test.jsx

$ git diff --name-only ccbf6882 18e7c348 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
```

Two commits, #2015 and #2017, both code: fifteen files, all under
`frontend/src`, six of them tests. Nothing under `src/`, no migration file,
no package manifest or lockfile.

**#2017's checks, MEASURED.** `231bec51` is the last commit of #2017's
branch before its squash-merge as `18e7c348`:

```
$ git log --oneline -1 231bec51
231bec51 fix(phone): remove the header Preview and Generate All from the Phone Hub [skip-automerge]
$ git branch -r --contains 231bec51
  origin/claude/issue-2016-phone-home-and-cleanup
$ git rev-parse --short origin/claude/issue-2016-phone-home-and-cleanup
231bec51
```

That the five checks passed on it is from GitHub's check runs, which a clone
does not carry; it is recorded here as her account.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AU.

**MEASURED.** The newest commit in the range is #2017, 23:01:41 UTC, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" ccbf6882..18e7c348
18e7c348 2026-09-26T19:01:41-04:00 fix(phone): home is never "Unreached", ICON Done saves, no AI panel [skip-automerge] (#2017)
162e4d2d 2026-09-26T18:49:46-04:00 fix(phone): zones workspace attaches library icons and keeps zones in bounds [skip-automerge] (#2015)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only 18e7c348 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

- #2015 (`162e4d2d`): each Tap Zones row says what the zone draws ("Icon:
  Call", "Custom image", "No icon") and can pick a library icon, saved by
  its key (`ZoneIconPicker`). Screen health names an out-of-bounds zone and
  offers "Move inside". A "● Unsaved" marker shows until the zones are
  saved.
- #2017 (`18e7c348`): the home card reads "★ HOME" instead of "Unreached";
  ICON placements are saved through the same path as tap zones; the AI
  panel, the header Preview button and Generate All are removed.

### §5.2 The live check, beside the code

**ATTESTED (§0).** Homepage's dock drew library icons (map, camera, phone)
after she picked them in the Tap Zones rows.

**MEASURED.** That is #2015's picker in each row, saved by key, drawn
through #2007's resolver (Deploy AS). Deploy AS's placement check, deferred
to this deploy, is this one. An image change reaching a placed icon is not
attested.

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
`frontend/dist` to `~/dist.bak-20260926-pre2017`, which holds the previous entry,
`index-DA0Agbs4.js`. The build produced the new entry `index-DGb4b6e5.js`. The
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

**MEASURED.** After Deploy AU, production's tree is this record's basis,
`18e7c348`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
594714eda6e86747f77226efafbf13977c2d1627 2026-09-26 feat(phone): "+ Add" asks what you're adding [skip-automerge] (#2025)
```

The commits after `18e7c348` up to `594714ed` are deployed by the later records of
this filing (AV and AW), not by Deploy AU.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5.2
  state in words;
- does not edit the AT record or any other filed document;
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
- The tree agrees with her account: two commits, fifteen frontend files the
  only code, no migration, no package change (§2).
- **The live check (§5.2):** library icons drawn in Homepage's dock. A later
  image change reaching a placed icon: not attested.
- #2017's checks passing on `231bec51` is her account; that `231bec51` is
  #2017's last branch commit is MEASURED (§2).
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
