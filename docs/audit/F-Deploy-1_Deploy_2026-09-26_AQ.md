| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AQ, 2026-09-26, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. The Episode tab's embedded phone saves nothing; Preview Phone saves. Both read from the live database.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AP.md` (the AP record, #1993). This document
follows that one rather than editing it. Basis:
`d49fc74396b299fa264784f11c481a7a4c4ab036` (#1995), the tree Deploy AQ moved
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
database host or user id. Episode 1 is named, not identified by id.

The deploy is lettered AQ, continuing after Deploy AP of the AP record.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26):**

- Fast-forward `cbb0b9a8` → `d49fc743`. The backend diff printed nothing.
  Frontend only: no backend restart, no migration.
- The build succeeded. Entry `index-D4FyuhRI.js` (previously
  `index-CT0nSdJK.js`).
- Backup `/var/www/html.bak-20260926-pre1995`.
- The rsync dry run listed nothing outside `assets/`. The served
  `index.html` references `index-D4FyuhRI.js`.
- **Live check, after a reload, from her screenshots:** Episode 1 →
  Production → Lala's Phone shows the embedded phone on the left and the
  tab's content on the right. Tapping Call opened "calls list", and Back
  appeared. The screen's name shows once, on the device.
- **The no-save reading.** She read Episode 1's `phone_playthrough_state`
  row before and after the taps in the embedded phone (`psql` as `postgres`,
  read-only). Both times: `updated_at` `2026-09-25 17:36:52.35+00`,
  `last_screen_id` empty.
- **The saving path.** She then pressed Preview Phone and tapped Call there.
  The same read showed `updated_at` `2026-09-26 18:51:00.83+00` and
  `last_screen_id` `calls_list`.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `cbb0b9a8` to `d49fc743` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse cbb0b9a8 d49fc743 origin/main HEAD
cbb0b9a8645d2a336cc4263536ebb9a20d54688c
d49fc74396b299fa264784f11c481a7a4c4ab036
d49fc74396b299fa264784f11c481a7a4c4ab036
d49fc74396b299fa264784f11c481a7a4c4ab036
$ git merge-base --is-ancestor cbb0b9a8 d49fc743; echo "exit=$?"
exit=0
```

(`HEAD` is this filing session's branch point before this record's commit.)
Deploy AP ends at `cbb0b9a8` (AP record §1, §8); Deploy AQ begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent cbb0b9a8..d49fc743
d49fc743 feat(phone): the Episode tab shows the same phone, embedded and non-authoring [skip-automerge] (#1995)
101ededf docs(audit): file the deploy record for Deploy AP [skip-automerge] (#1993)

$ git diff --name-only cbb0b9a8 d49fc743 -- src frontend/src package.json frontend/package.json
frontend/src/components/Episodes/EpisodeLalasPhoneTab.css
frontend/src/components/Episodes/EpisodeLalasPhoneTab.embedded.test.jsx
frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx
frontend/src/components/Episodes/EpisodeLalasPhoneTab.test.jsx
frontend/src/components/PhonePreviewMode.jsx

$ git diff --name-only cbb0b9a8 d49fc743 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0

$ git diff --name-status cbb0b9a8 d49fc743
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AP.md
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.css
A	frontend/src/components/Episodes/EpisodeLalasPhoneTab.embedded.test.jsx
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.test.jsx
M	frontend/src/components/PhonePreviewMode.jsx
```

Exactly two commits. #1993 is a document only (the AP record). #1995
carries the code: five files, all under `frontend/src`, two of them tests.
Nothing under `src/`, no migration file, no package manifest or lockfile.

**Beside her account.** Her empty backend diff agrees with the measurement,
and so does "frontend only, no backend restart": no backend file changed.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AQ. Her
Preview Phone reading, `2026-09-26 18:51:00.83+00`, followed the deploy.

**MEASURED.** The newest commit in the range, #1995, is 18:24:15 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" cbb0b9a8..d49fc743
d49fc743 2026-09-26T14:24:15-04:00 feat(phone): the Episode tab shows the same phone, embedded and non-authoring [skip-automerge] (#1995)
101ededf 2026-09-26T13:36:10-04:00 docs(audit): file the deploy record for Deploy AP [skip-automerge] (#1993)
```

## §4. Pre-deploy checks

**ATTESTED.** The backend diff printed nothing. She reports no
`check-pending-migrations` run and no `node -c`. Neither applied: no backend
or migration file changed (§2).

**MEASURED.** The migration tree is unchanged from AP's 218 files:

```
$ git ls-tree -r --name-only cbb0b9a8 src/migrations | wc -l
218
$ git ls-tree -r --name-only d49fc743 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

#1995 (`d49fc743`) is step C3 of `docs/DESIGN_DOCTRINE.md` rule 16.

- `PhonePreviewMode` gains an `embedded` prop, default false. When true it
  draws no backdrop, no Close button and no ESC listener, and sits in its
  container. The screen-name line below the device is removed in both
  modes, since the device shows the name.
- `EpisodeLalasPhoneTab` becomes two panes. The left pane is
  `<PhonePreviewMode embedded>` with `playthrough={null}` and `missions={[]}`,
  fed only by the tab's own GETs: the episode's screens (filtered to
  generated screens with an image) and a new read-only
  `GET /api/v1/ui-overlays/:showId/frame`. The right pane is the tab's
  previous content. An "Edit in Phone Studio" link goes to the show's Phone
  Hub.
- The tab does not use `usePhonePlayback` and never calls `/phone-state`.
  Preview Phone still calls `onPreview`, which starts `usePhonePlayback` on
  the episode page.

### §5.2 The live check, beside the code

**ATTESTED (§0).** After a reload, the Episode tab showed the embedded phone
beside the tab's content; a tap on Call opened "calls list", Back appeared,
and the name showed once, on the device.

**MEASURED.** Each observation matches a path in #1995: the two-pane layout
is `EpisodeLalasPhoneTab`'s new `.lalas-phone-panes` grid; the tap routing,
Back and breadcrumb are `PhonePreviewMode`'s runtime, now embedded; the name
shows once because the line below the device was removed.

**Standing of the live check.** Her screenshots are the attestation. This
record states what they show, in words, and reproduces no value from them.

### §5.3 The no-save proof — ATTESTED, with why a count was not enough

**ATTESTED (§0).** Two readings of Episode 1's `phone_playthrough_state`
row, one before and one after the taps in the embedded phone, were identical:

| | `updated_at` | `last_screen_id` |
| --- | --- | --- |
| before the embedded taps | `2026-09-25 17:36:52.35+00` | empty |
| after the embedded taps | `2026-09-25 17:36:52.35+00` | empty |
| after a tap in Preview Phone | `2026-09-26 18:51:00.83+00` | `calls_list` |

The embedded phone left the row untouched. Preview Phone, the saving path,
moved `updated_at` to the day of the deploy and recorded the screen the tap
navigated to.

**Why a row count would not have shown a save, MEASURED.** The playthrough
route keeps one row per user and episode. It looks the row up by
`user_id` and `episode_id` and creates it only if none exists; a tap then
updates that same row, setting `last_screen_id` and saving:

```
$ git show d49fc743:src/routes/phonePlaythroughRoutes.js | sed -n 41,43p
  let state = await models.PhonePlaythroughState.findOne({
    where: { user_id: userId, episode_id: episodeId, deleted_at: null },
  });
$ git show d49fc743:src/routes/phonePlaythroughRoutes.js | sed -n 209,211p
    if (effects.navigate) state.last_screen_id = effects.navigate;
    if (episodeNowComplete && !state.completed_at) state.completed_at = new Date();
    await state.save();
```

A row already existed for Episode 1 (its `updated_at` is from 2026-09-25),
so a save would have changed `updated_at` and `last_screen_id`, not the
number of rows. Her reading of those two columns is the check that could
have shown a save, and it showed none.

**The code's guarantee, MEASURED.** `EpisodeLalasPhoneTab.embedded.test.jsx`
(added in #1995, run in CI) taps a zone, presses Back and Reset in the
embedded phone, and asserts that no request containing `/phone-state` and
no POST, PUT, PATCH or DELETE is sent, and that `usePhonePlayback` is not
called. The live reading agrees with it against the real database.

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy AQ, production's tree is this record's basis,
`d49fc743`. At filing, after `git fetch origin --prune`, nothing is merged
after it:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
d49fc74396b299fa264784f11c481a7a4c4ab036 2026-09-26 feat(phone): the Episode tab shows the same phone, embedded and non-authoring [skip-automerge] (#1995)
```

## §9. What this document does not do

This document:

- records no token, email, password, database host or user id, and
  reproduces no value from the screenshots beyond the two columns of §5.3;
- does not edit the AP record or any other filed document;
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

Unchanged from the AP record §10. Nothing minted here.

## §Standing

- §1, §2, §4, §6 and §7 each carry ATTESTED and MEASURED clauses, marked
  separately and never merged into one standing.
- Every attested fact about the tree agrees with the measurement: two
  commits, #1995's five frontend files the only code, nothing under `src/`,
  no migration, no package change (§2).
- **The live check (§5.2):** the embedded phone beside the tab's content, a
  tap to "calls list", Back, and the name shown once.
- **The no-save proof (§5.3), ATTESTED:** the embedded phone's taps left
  Episode 1's playthrough row unchanged; a tap in Preview Phone changed it.
  Why the two columns, not a row count, are the check is MEASURED from the
  route.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #1996.*
