| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AO, 2026-09-26, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. Production's phone held no screens until her first one.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AN.md` (the AN record, #1981). This document
follows that one rather than editing it. Basis:
`db1aea90d61a03b608f4c6fe4d866e0969b5763f` (#1985), the tree Deploy AO moved
production to. `origin/main` at filing is the same commit (§8).

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
database host or user id.

The deploy is lettered AO, continuing after Deploy AN of the AN record.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26):**

- Fast-forward `88a41b85` → `db1aea90`. The backend diff printed nothing.
  Frontend only: no backend restart, no migration.
- `npx vite build` succeeded, with the known warnings. Entry
  `index-B5upSOuH.js` (previously `index-EiwjfLIh.js`).
- Backup `/var/www/html.bak-20260926-pre1985`.
- The rsync dry run listed nothing outside `assets/`. The served
  `index.html` references `index-B5upSOuH.js`.
- **Live check, from her screenshots:** Producer Mode's Phone Hub drew the
  device with the saved lavender skin and the screen "main view", through
  `PhoneDevice`. Screen links, the back button and a map screen were not
  checkable: the phone has one screen.
- **The phone's content, read before her first screen:** production held
  zero rows in `ui_overlay_types` and zero `UI_OVERLAY` assets, for any
  show, soft-deleted rows included. Read with `psql` as `postgres`,
  read-only; neither read's error branch logged anything.
- She then created the screen "main view". `GET /ui-overlays/:showId`
  returned `total: 1, generated_count: 1`.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `88a41b85` to `db1aea90` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 88a41b85 db1aea90 origin/main HEAD
88a41b85c13e3415cdbcf6f5bbd8b41d91d158ae
db1aea90d61a03b608f4c6fe4d866e0969b5763f
db1aea90d61a03b608f4c6fe4d866e0969b5763f
db1aea90d61a03b608f4c6fe4d866e0969b5763f
$ git merge-base --is-ancestor 88a41b85 db1aea90; echo "exit=$?"
exit=0
```

(`HEAD` is this filing session's branch point before this record's commit.)
Deploy AN ends at `88a41b85` (AN record §1, §8); Deploy AO begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent 88a41b85..db1aea90
db1aea90 refactor(phone): extract PhoneDevice from PhoneHub [skip-automerge] (#1985)
567bcc0d docs(workflow): keep pm2's snapshot current across credential changes and reboots [skip-automerge] (#1984)
80852c78 docs(audit): file the deploy record for Deploy AN [skip-automerge] (#1981)
2fa8be01 docs(audit): F-Deploy-1 Fix Plan v1.55, box maintenance and reboot outage [skip-automerge] (#1980)
fa7aa036 docs(doctrine): record the phone device ruling [skip-automerge] (#1979)

$ git diff --name-only 88a41b85 db1aea90 -- src frontend/src package.json frontend/package.json
frontend/src/components/PhoneHub.device.test.jsx
frontend/src/components/PhoneHub.jsx
frontend/src/components/__snapshots__/PhoneHub.device.test.jsx.snap
frontend/src/components/phone/PhoneDevice.jsx
frontend/src/components/phone/PhoneDevice.test.jsx

$ git diff --name-only 88a41b85 db1aea90 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0

$ git diff --name-status 88a41b85 db1aea90
M	DEVELOPMENT_WORKFLOW.md
M	docs/DESIGN_DOCTRINE.md
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AN.md
A	docs/audit/F-Deploy-1_Fix_Plan_v1.55.md
A	frontend/src/components/PhoneHub.device.test.jsx
M	frontend/src/components/PhoneHub.jsx
A	frontend/src/components/__snapshots__/PhoneHub.device.test.jsx.snap
A	frontend/src/components/phone/PhoneDevice.jsx
A	frontend/src/components/phone/PhoneDevice.test.jsx
```

Exactly five commits. #1979, #1980, #1981 and #1984 are documents only;
#1985 carries the code. The only code files are #1985's five under
`frontend/src`: two source files, two tests and one snapshot file. Nothing
under `src/`, no migration file, no package manifest or lockfile.

**Beside her account.** Her empty backend diff agrees with the measurement,
and so does "frontend only, no backend restart": no backend file changed.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AO.

**MEASURED.** The newest commit in the range, #1985, is 15:33:25 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 88a41b85..db1aea90
db1aea90 2026-09-26T11:33:25-04:00 refactor(phone): extract PhoneDevice from PhoneHub [skip-automerge] (#1985)
567bcc0d 2026-09-26T11:27:26-04:00 docs(workflow): keep pm2's snapshot current across credential changes and reboots [skip-automerge] (#1984)
80852c78 2026-09-26T11:18:12-04:00 docs(audit): file the deploy record for Deploy AN [skip-automerge] (#1981)
2fa8be01 2026-09-26T11:06:26-04:00 docs(audit): F-Deploy-1 Fix Plan v1.55, box maintenance and reboot outage [skip-automerge] (#1980)
fa7aa036 2026-09-26T10:58:01-04:00 docs(doctrine): record the phone device ruling [skip-automerge] (#1979)
```

## §4. Pre-deploy checks

**ATTESTED.** The backend diff printed nothing. She reports no
`check-pending-migrations` run and no `node -c`. Neither applied: no backend
or migration file changed (§2).

**MEASURED.** The migration tree is unchanged from AN's 218 files:

```
$ git ls-tree -r --name-only 88a41b85 src/migrations | wc -l
218
$ git ls-tree -r --name-only db1aea90 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

#1985 (`db1aea90`) is step C1 of `docs/DESIGN_DOCTRINE.md` rule 16. It moves
the phone device block out of `PhoneHub` into the new
`frontend/src/components/phone/PhoneDevice.jsx`, with `ScreenLinkOverlay` and
`PersistentOverlay` beside it. `PhoneHub` renders `<PhoneDevice …/>` in its
place. It adds a characterization test, `PhoneHub.device.test.jsx`, with four
markup snapshots, committed before the move and passing unchanged after it,
and `PhoneDevice.test.jsx`, which drives the same cases through
`PhoneDevice`'s own props. The move is meant to change no markup, class name
or style.

### §5.2 The live check, beside the code

**ATTESTED (§0).** The Phone Hub drew the device, the saved lavender skin and
the one screen, "main view".

**MEASURED.** Drawing a frame, a skin and a screen image exercises
`PhoneDevice`'s frame and image path, the path the characterization test's
first case and first snapshot pin. The skin is #1965's saved skin (AM record
§5.2), which this deploy does not change. Screen links, persistent links, the
back button and a map screen each need a second screen, and none existed, so
those paths are neither attested nor refuted by this check.

**Standing of the live check.** Her screenshots are the attestation. This
record states what they show, in words, and reproduces no value from them.

### §5.3 Production's phone had no screens — ATTESTED, with its effect

**ATTESTED (§0).** Before Evoni created "main view", production held zero
`ui_overlay_types` rows and zero `UI_OVERLAY` assets for any show, deleted
rows included, and neither read logged an error.

**Its effect on earlier checks.** Every earlier production check of the
phone could show only the frame and the skin, because there was no screen to
draw:

- the AM record's live check (§0: a skin that persists across reload, and
  Episode 1's Preview Phone showing "the same skin and the episode's
  screens");
- #1966's episode screens, which that check was exercising (AM record §5.2);
- the THIS EPISODE badge, which the AM record already left "neither attested
  nor refuted" (AM record §5.2).

The skin half of AM's check stands as attested. The "episode's screens" half
had no screen to show. This record states that; it does not edit the AM
record, and it does not re-grade AM's standing.

**After her first screen.** `GET /ui-overlays/:showId` returned
`total: 1, generated_count: 1` (§0). Read against the route at `db1aea90`,
`total` is the count of overlay types and `generated_count` the count of
those with an asset:

```
$ git show db1aea90:src/routes/uiOverlayRoutes.js | sed -n 150,156p
    return res.json({
      success: true,
      data: status,
      generated_count: status.filter(s => s.generated).length,
      total: allTypes.length,
      generation_status: genStatus,
    });
```

One type, one generated: the screen she created, and nothing older.

### §5.4 An empty phone and a failed read look the same — MEASURED, cited not ruled

Both reads behind `GET /ui-overlays/:showId` log and return empty on error.

The overlay types, `getAllOverlayTypes`
(`src/services/uiOverlayService.js:38–65` at `db1aea90`), ends:

```
$ git show db1aea90:src/services/uiOverlayService.js | sed -n 61,65p
  } catch (err) {
    console.error('[UIOverlay] getAllOverlayTypes failed:', err.message);
    return [];
  }
}
```

The assets read (`src/routes/uiOverlayRoutes.js:36–84` at `db1aea90`; the
query at :52–55) starts from `let existing = [];` at :36, and its catch leaves
that empty:

```
$ git show db1aea90:src/routes/uiOverlayRoutes.js | sed -n 82,84p
    } catch (queryErr) {
      console.error('[UIOverlay] Asset query failed:', queryErr.message);
    }
```

So a failed read and an empty phone give the same response: `success: true`,
empty `data`, `total: 0`. Only the server log tells them apart. That is why
§0's "no errors logged by either read" matters: it is what separates "no
screens" from "the read failed". This record cites the pattern; it rules
nothing about changing it.

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy AO, production's tree is this record's basis,
`db1aea90`. At filing, after `git fetch origin --prune`, nothing is merged
after it:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
db1aea90d61a03b608f4c6fe4d866e0969b5763f 2026-09-26 refactor(phone): extract PhoneDevice from PhoneHub [skip-automerge] (#1985)
```

## §9. What this document does not do

This document:

- records no token, email, password, database host or user id, and
  reproduces no value from the screenshots;
- does not rule on the empty-on-error reads (§5.4);
- does not edit the AM record, the AN record or any other filed document,
  and does not re-grade the AM record's standing (§5.3);
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS, database
  or Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session; the database reads of §0 and §5.3 are hers.
  Every MEASURED claim is a repository read this filing session performed
  itself.

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

Unchanged from the AN record §10. Nothing minted here.

## §Standing

- §1, §2, §4, §6 and §7 each carry ATTESTED and MEASURED clauses, marked
  separately and never merged into one standing.
- Every attested fact about the tree agrees with the measurement: five
  commits, #1985's five frontend files the only code, nothing under `src/`,
  no migration, no package change (§2).
- **The live check (§5.2):** the device, the lavender skin and one screen
  drawn through `PhoneDevice`. Links, the back button and a map screen are
  untested, for want of a second screen.
- **The empty phone (§5.3), ATTESTED:** production held no phone screens
  before Evoni's first, so earlier production phone checks could show only
  the frame and the skin. The AM record is cited, not edited.
- **The empty-on-error reads (§5.4), MEASURED:** cited, not ruled.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #1986.*
