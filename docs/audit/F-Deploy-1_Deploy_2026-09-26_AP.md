| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AP, 2026-09-26, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. Preview Phone draws the shared device; the first live navigation check in production.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AO.md` (the AO record, #1988). This document
follows that one rather than editing it. Basis:
`cbb0b9a8645d2a336cc4263536ebb9a20d54688c` (#1991), the tree Deploy AP moved
production to. `origin/main` at filing is the same commit (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host
  or running app states, from her terminal output and screenshots. It cannot
  be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, and register documents
  already merged under `docs/audit/`.
- **INFERRED** marks one reading that is not observed (§5.3).

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host or user id.

The deploy is lettered AP, continuing after Deploy AO of the AO record.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26):**

- Fast-forward `db1aea90` → `cbb0b9a8`. The backend diff printed nothing.
  Frontend only: no backend restart, no migration.
- `npx vite build` succeeded, with the known warnings. Entry
  `index-CT0nSdJK.js` (previously `index-B5upSOuH.js`). The Preview's chunk
  is now `PhonePreviewMode-B9DbBYse.js`.
- Backup `/var/www/html.bak-20260926-pre1991`.
- The rsync dry run listed nothing outside `assets/`. The served
  `index.html` references `index-CT0nSdJK.js`.
- **The first Preview check showed the old device.** The box's
  `ls /var/www/html/assets` listed only `PhonePreviewMode-B9DbBYse.js` for
  the Preview. After a reload, the new Preview loaded.
- **Live check after the reload, from her screenshots:**
  - Producer Mode's Preview drew the shared device: Dynamic Island, side
    buttons, the lavender skin, and the status bar.
  - Tapping the Call icon on "Homepage" opened "calls list". Back appeared.
    The breadcrumb read "Homepage > calls list".
  - The screen name shows twice, on the phone and below it.
  - The episode page's Preview Phone was not checked.
- **The phone's content:** two screens, "Homepage" and "calls list", and one
  icon, "Call", all created by Evoni.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `db1aea90` to `cbb0b9a8` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse db1aea90 cbb0b9a8 origin/main HEAD
db1aea90d61a03b608f4c6fe4d866e0969b5763f
cbb0b9a8645d2a336cc4263536ebb9a20d54688c
cbb0b9a8645d2a336cc4263536ebb9a20d54688c
cbb0b9a8645d2a336cc4263536ebb9a20d54688c
$ git merge-base --is-ancestor db1aea90 cbb0b9a8; echo "exit=$?"
exit=0
```

(`HEAD` is this filing session's branch point before this record's commit.)
Deploy AO ends at `db1aea90` (AO record §1, §8); Deploy AP begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent db1aea90..cbb0b9a8
cbb0b9a8 refactor(phone): Preview draws through PhoneDevice [skip-automerge] (#1991)
39caf9e8 refactor(phone): shared phone styles in their own module [skip-automerge] (#1989)
e0c793df docs(audit): file the deploy record for Deploy AO [skip-automerge] (#1988)

$ git diff --name-only db1aea90 cbb0b9a8 -- src frontend/src package.json frontend/package.json
frontend/src/components/ContentZoneEditor.jsx
frontend/src/components/PhoneHub.jsx
frontend/src/components/PhonePreviewMode.behaviour.test.jsx
frontend/src/components/PhonePreviewMode.device.test.jsx
frontend/src/components/PhonePreviewMode.jsx
frontend/src/components/ScreenLinkEditor.jsx
frontend/src/components/phone/PhoneDevice.jsx
frontend/src/components/phone/PhoneDevice.test.jsx
frontend/src/components/phone/PhoneFrame.css
frontend/src/components/phone/PhoneFrame.jsx
frontend/src/components/phone/ScreenThumbnailStrip.jsx
frontend/src/components/phone/ZonesTab.css
frontend/src/components/phone/phoneStyle.js
frontend/src/hooks/usePhonePlayback.frameUrl.test.js
frontend/src/hooks/usePhonePlayback.js
frontend/src/pages/EpisodeDetail.jsx
frontend/src/pages/UIOverlaysTab.jsx

$ git diff --name-only db1aea90 cbb0b9a8 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0

$ git diff --name-status db1aea90 cbb0b9a8
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AO.md
M	frontend/src/components/ContentZoneEditor.jsx
M	frontend/src/components/PhoneHub.jsx
A	frontend/src/components/PhonePreviewMode.behaviour.test.jsx
A	frontend/src/components/PhonePreviewMode.device.test.jsx
M	frontend/src/components/PhonePreviewMode.jsx
M	frontend/src/components/ScreenLinkEditor.jsx
M	frontend/src/components/phone/PhoneDevice.jsx
M	frontend/src/components/phone/PhoneDevice.test.jsx
A	frontend/src/components/phone/PhoneFrame.css
M	frontend/src/components/phone/PhoneFrame.jsx
M	frontend/src/components/phone/ScreenThumbnailStrip.jsx
M	frontend/src/components/phone/ZonesTab.css
A	frontend/src/components/phone/phoneStyle.js
A	frontend/src/hooks/usePhonePlayback.frameUrl.test.js
M	frontend/src/hooks/usePhonePlayback.js
M	frontend/src/pages/EpisodeDetail.jsx
M	frontend/src/pages/UIOverlaysTab.jsx
```

Exactly three commits. #1988 is a document only (the AO record). #1989 and
#1991 carry the code: seventeen files, all under `frontend/src`, three of
them touched by both (`PhonePreviewMode.jsx`, `phone/PhoneDevice.jsx`,
`phone/PhoneFrame.jsx`). Nothing under `src/`, no migration file, no package
manifest or lockfile.

**Beside her account.** Her empty backend diff agrees with the measurement,
and so does "frontend only, no backend restart": no backend file changed.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AP.

**MEASURED.** The newest commit in the range, #1991, is 16:39:30 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" db1aea90..cbb0b9a8
cbb0b9a8 2026-09-26T12:39:30-04:00 refactor(phone): Preview draws through PhoneDevice [skip-automerge] (#1991)
39caf9e8 2026-09-26T12:20:27-04:00 refactor(phone): shared phone styles in their own module [skip-automerge] (#1989)
e0c793df 2026-09-26T12:11:54-04:00 docs(audit): file the deploy record for Deploy AO [skip-automerge] (#1988)
```

## §4. Pre-deploy checks

**ATTESTED.** The backend diff printed nothing. She reports no
`check-pending-migrations` run and no `node -c`. Neither applied: no backend
or migration file changed (§2).

**MEASURED.** The migration tree is unchanged from AO's 218 files:

```
$ git ls-tree -r --name-only db1aea90 src/migrations | wc -l
218
$ git ls-tree -r --name-only cbb0b9a8 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

Two code PRs, steps C2a and C2 of `docs/DESIGN_DOCTRINE.md` rule 16:

- **#1989 (`39caf9e8`), C2a.** `PHONE_SKINS` and `getScreenImageStyle` move
  unchanged into the new `frontend/src/components/phone/phoneStyle.js`. The
  phone components import them from there, and `PhoneHub` re-exports both.
  `PhoneHub`'s unused `frameLoaded` state is removed. Nothing drawn changes.
- **#1991 (`cbb0b9a8`), C2.** `PhonePreviewMode` draws the phone through
  `PhoneDevice`, the device Producer Mode draws, and keeps its own runtime in
  a tap layer on top (status bar, back, `opens_screen`, the condition-filtered
  tap zones, home). Its hand-drawn body, notch and home bar are removed. The
  `.phone-hub-frame` width rules move from `ZonesTab.css` to the new
  `phone/PhoneFrame.css`, imported by `PhoneFrame.jsx`. `PhoneDevice` gains
  three optional props (`tapLayer`, `episodeId`, `contentInteractive`) that
  `PhoneHub` does not pass. Both places that open the Preview now pass the
  custom frame URL.

### §5.2 The live check, beside the code

**ATTESTED (§0).** After a reload, Producer Mode's Preview drew the shared
device, and a tap on "Call" opened "calls list", with Back and the
breadcrumb "Homepage > calls list".

**MEASURED.** Each observation matches a path in #1991:

- **The device.** The Dynamic Island and side buttons are drawn by
  `PhoneFrame`'s built-in frame, which the Preview reaches through
  `PhoneDevice`. The old Preview drew neither.
- **The tap.** The Call icon is a tap zone in the Preview's own tap layer,
  routed through `handleZoneTap` and `phoneRuntime`, as before C2. That it
  opened "calls list" through the shared device is the first production check
  of the Preview's tap routing on top of `PhoneDevice`.
- **Back and the breadcrumb.** Back appears once there is history; the
  breadcrumb lists the screens visited. Both are the Preview's own, unchanged
  by C2, and pinned by `PhonePreviewMode.behaviour.test.jsx`, which passed
  before and after C2.
- **The name twice.** `PhoneDevice` overlays the screen's name on the
  built-in frame, as it does in Producer Mode; the Preview also prints the
  name below the phone. C2 kept both. It is known and is not fixed here.

**Not checked.** The episode page's Preview Phone (§0). That is where the
frame-width move in #1991 matters most, since `ZonesTab.css` loaded only on
Producer Mode's page. It is neither attested nor refuted here.

**This is the first production check with more than one screen.** The AO
record left links, the back button and navigation untested because the phone
had one screen (AO record §5.2). With two screens and a link between them,
navigation and Back are attested here, in the Preview.

**Standing of the live check.** Her screenshots are the attestation. This
record states what they show, in words, and reproduces no value from them.

### §5.3 The stale tab — ATTESTED, with one INFERRED reading

**ATTESTED (§0).** The first Preview check, after the swap, showed the old
device. The box's assets held only the new Preview chunk,
`PhonePreviewMode-B9DbBYse.js`. After a reload, the new Preview loaded.

**INFERRED, not observed.** The tab was open from before the deploy and
still held the old Preview code, which alone explains the old device. The
service worker may have contributed by serving a cached old chunk: at
`cbb0b9a8`, `frontend/public/sw.js` fetches page navigations network-first
and serves `/assets/*` cache-first.

```
$ git show cbb0b9a8:frontend/public/sw.js | sed -n 5,8p
 *   - Navigation (HTML) → network-first (always get fresh index.html)
 *   - Hashed assets (/assets/*) → cache-first (content-hashed by Vite)
 *   - API calls → network-first (fall through to cache if offline)
 *   - Story content saved explicitly via postMessage from the app
```

It is registered in production builds only
(`frontend/src/main.jsx:106–116` at `cbb0b9a8`). Which of the two readings
applied is not in her account.

**The caution, for future live checks:** reload the page before checking a
frontend deploy.

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy AP, production's tree is this record's basis,
`cbb0b9a8`. At filing, after `git fetch origin --prune`, nothing is merged
after it:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
cbb0b9a8645d2a336cc4263536ebb9a20d54688c 2026-09-26 refactor(phone): Preview draws through PhoneDevice [skip-automerge] (#1991)
```

## §9. What this document does not do

This document:

- records no token, email, password, database host or user id, and
  reproduces no value from the screenshots;
- does not rule on the service worker's caching (§5.3), or on the name
  shown twice (§5.2);
- does not edit the AO record or any other filed document;
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

Unchanged from the AO record §10. Nothing minted here.

## §Standing

- §1, §2, §4, §6 and §7 each carry ATTESTED and MEASURED clauses, marked
  separately and never merged into one standing.
- Every attested fact about the tree agrees with the measurement: three
  commits, seventeen frontend files the only code, nothing under `src/`, no
  migration, no package change (§2).
- **The live check (§5.2):** the shared device in Producer Mode's Preview,
  and the first production navigation: a tap to a second screen, Back, and
  the breadcrumb. The episode page's Preview was not checked.
- **The stale tab (§5.3):** ATTESTED that the first check showed the old
  device and a reload fixed it. One reading is INFERRED and marked: the tab
  predated the deploy, with the service worker a possible contributor.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #1992.*
