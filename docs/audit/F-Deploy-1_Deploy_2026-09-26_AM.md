| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AM, 2026-09-26, backend and frontend, no migration, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AK.md` (the AK record, #1957). This document
follows that one rather than editing it. Basis:
`baa69a2d945d88c41b745320509aca97e82e52ba` (#1966), the tree Deploy AM moved
production to. `origin/main` at filing is
`70b42b9f4a93d016536feccd9d487286bf8dfbb2`; the two commits between are
documents only (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host
  or running app states, from her pasted terminal output. It cannot be
  reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce, and register documents
  already merged under `docs/audit/`.
- **INFERRED** marks a reading that follows from measured code but was not
  observed. There are two (§4.3, §5.2).

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing.

The deploy is lettered AM. It follows Deploy AL, which moved production from
`7c7f8d48` to `35394cb4`. **AL has no filed record at this basis**: its
record is owed under #1960, and AL's facts here are cited from that issue's
text (GitHub read), not from a register document. This record does not
restate or stand in for it.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26), from her pasted terminal output:**

- SSH login 13:08:10 UTC. Starting HEAD `35394cb4`. The working tree carried
  pre-existing untracked files (`Production`, `sed`, three
  `ecosystem.config.js.bak-*`, `src/routes/auth.js.bak-2026-08-22`); none
  tracked, none touched.
- Fast-forward to `baa69a2d`; no migration files in the range.
- `NODE_ENV=production node scripts/check-pending-migrations.js`: "OK: 0
  pending of 218 migration files checked", exit=0, reading as
  `episode_app_dev`. (The database host it printed is not recorded here.)
- `node -c src/routes/uiOverlayRoutes.js`: parse ok.
- Backend restarted before the frontend swap: pm2 restart 51 → 52, online.
  `/health` 200 on localhost:3000. The listening socket on 3000 is held by
  the pm2 daemon, while the on-disk `.env` says `PORT=3002`.
- Disk at login 89.2% of 7.57 GB; `df -h /` before the build: 90%, 822M
  available. `/var/www/html` 6.0M; eleven existing `html.bak-*` directories.
- `npx vite build`: success, with the known `@keyframes` css-syntax warning
  and a browserslist-age notice. Entry `index-Cd2ISEKu.js` (previously
  `index-BrWEe0ti.js`).
- Backup `/var/www/html.bak-20260926-pre1966`, 6.0M.
- `rsync -a --delete --dry-run` listed one deletion outside `assets/`:
  `index.nginx-debian.html` (nginx's stock page). The real
  `sudo rsync -a --delete frontend/dist/ /var/www/html/` removed it; a copy
  is in the pre1966 backup. The served `index.html` references
  `index-Cd2ISEKu.js`.
- Post-deploy error log: every entry after the startup line came from one
  scanner IP (139.87.112.179), all 404s under `/assets/`, including a
  Log4Shell probe string, plus three `GET /` "Not allowed by CORS" 500s. No
  other path appears.
- Live check, in her words: "yes it works". The check was: a Producer Mode
  skin change persists across reload; Episode 1's Preview Phone shows the
  same skin and the episode's screens.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `35394cb4` to `baa69a2d` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 35394cb4 baa69a2d origin/main HEAD
35394cb4d2653b57717fd67f41082f00819a38f0
baa69a2d945d88c41b745320509aca97e82e52ba
70b42b9f4a93d016536feccd9d487286bf8dfbb2
70b42b9f4a93d016536feccd9d487286bf8dfbb2
$ git merge-base --is-ancestor 35394cb4 baa69a2d; echo "exit=$?"
exit=0
```

(`HEAD` is this filing session's branch point before this record's commit.)
Deploy AK ended at `7c7f8d48` (AK record §1, §8). The start of AM,
`35394cb4`, is AL's attested end per #1960; the AL record is not filed.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent 35394cb4..baa69a2d
baa69a2d fix(phone): Preview Phone shows the episode's screens, overrides included [skip-automerge] (#1966)
f8d1fb7a fix(phone): one saved skin for Lala's Phone [skip-automerge] (#1965)
15cf3b1e docs(doctrine): record the 2026-09-26 rules [skip-automerge] (#1963)
8c4b19b5 docs(context): refresh basis, §0, §6.5, §10 [skip-automerge] (#1961)

$ git diff --name-status 35394cb4 baa69a2d -- src/ frontend/src/ src/migrations/ package.json frontend/package.json
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.css
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.test.jsx
A	frontend/src/hooks/usePhonePlayback.episodeScreens.test.js
M	frontend/src/hooks/usePhonePlayback.js
A	frontend/src/hooks/usePhonePlayback.test.js
M	frontend/src/pages/UIOverlaysTab.jsx
M	src/routes/uiOverlayRoutes.js

$ git diff --name-status 35394cb4 baa69a2d -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
$ git ls-tree -r --name-only 35394cb4 src/migrations | wc -l
218
$ git ls-tree -r --name-only baa69a2d src/migrations | wc -l
218
```

Exactly four commits: #1961 and #1963 are documents only
(`PROJECT_CONTEXT.md`, `docs/DESIGN_DOCTRINE.md`); #1965 and #1966 carry the
code. One backend file (`src/routes/uiOverlayRoutes.js`) and seven frontend
files change, three of the seven being tests. No migration file and no
package manifest or lockfile changes; 218 → 218 migration files.

The full range, for completeness:

```
$ git diff --stat 35394cb4 baa69a2d | tail -1
 13 files changed, 431 insertions(+), 19 deletions(-)
$ git diff --name-status 35394cb4 baa69a2d
M	PROJECT_CONTEXT.md
M	docs/DESIGN_DOCTRINE.md
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.css
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx
M	frontend/src/components/Episodes/EpisodeLalasPhoneTab.test.jsx
A	frontend/src/hooks/usePhonePlayback.episodeScreens.test.js
M	frontend/src/hooks/usePhonePlayback.js
A	frontend/src/hooks/usePhonePlayback.test.js
M	frontend/src/pages/UIOverlaysTab.jsx
M	src/routes/uiOverlayRoutes.js
M	tests/unit/routes/episodes-cluster-tier-promotion.test.js
A	tests/unit/routes/uiOverlay-episodeOverride.test.js
A	tests/unit/routes/uiOverlay-phoneSkin.test.js
```

**Beside her account.** "No migration files in the range" agrees with the
measurement. Her one `node -c` names the one backend file the range changes.

## §3. The time

**ATTESTED:** SSH login 13:08:10 UTC.

**MEASURED:** all four commits were committed before it (committer times,
UTC-4):

```
$ git log --first-parent --format="%h %cI %s" 35394cb4..baa69a2d
baa69a2d 2026-09-26T08:43:28-04:00 fix(phone): Preview Phone shows the episode's screens, overrides included [
f8d1fb7a 2026-09-26T08:39:22-04:00 fix(phone): one saved skin for Lala's Phone [skip-automerge] (#1965)
15cf3b1e 2026-09-26T05:41:18-04:00 docs(doctrine): record the 2026-09-26 rules [skip-automerge] (#1963)
8c4b19b5 2026-09-26T05:15:06-04:00 docs(context): refresh basis, §0, §6.5, §10 [skip-automerge] (#1961)
```

The last, `baa69a2d`, is 12:43:28 UTC, about 25 minutes before her login.

## §4. Pre-deploy checks

### §4.1 `scripts/check-pending-migrations.js`

**ATTESTED.** "OK: 0 pending of 218 migration files checked", exit=0, read as
`episode_app_dev`.

**MEASURED.** The range changes no file under `src/migrations/` (§2), so the
218 files are the same 218 the AJ record §4.1 attests a clean check over.
The check reading as `episode_app_dev` is a read; the migration identity
`PROJECT_CONTEXT.md` §0 item 11 records as unfixed concerns running
migrations, which AM did not do.

### §4.2 `node -c`

**ATTESTED.** Parse ok on `src/routes/uiOverlayRoutes.js`.

**MEASURED.** The same file at `baa69a2d` parses here too:

```
$ git show baa69a2d:src/routes/uiOverlayRoutes.js > uiOverlayRoutes.baa69a2d.js && node -c uiOverlayRoutes.baa69a2d.js; echo "exit=$?"
exit=0
```

### §4.3 The port

**ATTESTED.** `/health` 200 on localhost:3000; the socket on 3000 is held by
the pm2 daemon; the on-disk `.env` says `PORT=3002`. Recorded as she gave
it; nothing ruled.

**MEASURED, beside it.** The repository's pm2 config sets `PORT: 3000` for
the production app, `episode-api-prod-hotfix`, in both `env` and
`env_production` (`ecosystem.config.js:71`, `:85`, `:94` at `baa69a2d`).
`src/server.js:19` reads `process.env.PORT || 3000`; `src/server.js:7` and
`src/app.js:9` call `require('dotenv').config()` with no options.

**INFERRED.** dotenv's default does not overwrite a variable already set in
the environment, so a process started from that pm2 config would listen on
3000 whatever `.env` says. That the running process was started from this
file's current contents is not measured.

### §4.4 Disk

**ATTESTED.** 89.2% of 7.57 GB at login; 90% with 822M available before the
build. A `vite build` and a 6.0M backup ran against that margin.

**Beside it, from the register.** `F-Deploy-1_Fix_Plan_v1.54.md` §4 attests
82% used and 1.4G available later the same day, after cache cleanup; that
cleanup and v1.54's owed deletion (§6 there) are outside this deploy and
not recorded here.

## §5. What went live

### §5.1 The change, MEASURED

- **#1965, `f8d1fb7a`:** Lala's Phone's skin is saved per show on the server.
  `PUT /ui-overlays/:showId/phone-skin` (`requireAuth`, validated) upserts a
  `PageContent` `PHONE_SKIN` row; `GET /ui-overlays/:showId/frame` returns
  `phone_skin`. Producer Mode reads the skin from `/frame` and saves changes
  to the server, with a one-time carry-over of the old browser value.
- **#1966, `baa69a2d`:** the Episode's Preview Phone fetches
  `GET /ui-overlays/:showId?episode_id=`, so it plays the episode's screens;
  the list response carries `is_episode_override`, and the Lala's Phone tab
  marks override screens THIS EPISODE.

### §5.2 Post-deploy checks

**ATTESTED.** pm2 restart 51 → 52, online; `/health` 200; the served
`index.html` references `index-Cd2ISEKu.js`; her live check, "yes it works"
(§0).

**Beside the live check, MEASURED.** It exercises both code PRs: the skin
persisting across reload is #1965's server save and `/frame` read; the
Preview showing the same skin is `usePhonePlayback` reading `phone_skin`
(`frontend/src/hooks/usePhonePlayback.js:56` at `baa69a2d`); the Preview
showing the episode's screens is #1966's `?episode_id=`
(`usePhonePlayback.js:47-48`). Her account does not say whether Episode 1
has any override screen, so the THIS EPISODE badge is not attested either
way.

**The error log, ATTESTED; the CORS 500s, cited not ruled.** Her log shows
three `GET /` "Not allowed by CORS" 500s. At `baa69a2d`, the CORS origin
callback rejects an unlisted origin with
`callback(new Error('Not allowed by CORS'))` (`src/app.js:193`), after
logging `❌ CORS Rejected - Origin:` (`:192`). That error carries no status;
`errorHandler` (`src/app.js:1742`) falls through to its default 500
(`src/middleware/errorHandler.js:156-158`). **INFERRED:** these three 500s are
that path, the same class as the "Not allowed by CORS" 500 that #1960's
issue text records before Deploy AL. Which origin was rejected is in the out
log's `CORS Rejected` line, which her account does not quote.

**The scanner, ATTESTED.** The remaining entries came from one IP, all 404s
under `/assets/`, including a Log4Shell probe string. Recorded as she gave
it; nothing ruled.

### §5.3 Frontend

**ATTESTED.** Build succeeded; entry `index-Cd2ISEKu.js`, previously
`index-BrWEe0ti.js`. Backup `html.bak-20260926-pre1966` taken before the
swap.

**Beside it, from the register.** `index-BrWEe0ti.js` is the entry the AK
record §2.1 attests; #1960's issue text states AL had no frontend build, so
AK's bundle was still being served until AM.

**The nginx page.** The `--delete` sync removed `index.nginx-debian.html`,
nginx's stock page, which the build does not produce; a copy is in the
pre1966 backup. Recorded as a fact; nothing ruled about restoring it.

## §6. Restarts

**ATTESTED.** Backend restarted before the frontend swap; pm2 restart
51 → 52, online.

**Beside it.** AK's restart was 49 → 50 (AK record §0, §6); #1960's issue
text gives AL's as 50 → 51. AM's 51 → 52 continues that count.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes; 218 → 218 (§2). #1965
stores the skin as a `PageContent` row, an existing table, with no schema
change.

## §8. Basis statement

**MEASURED.** After Deploy AM, production's tree is this record's basis,
`baa69a2d`. Merged after AM, undeployed (at filing, after
`git fetch origin main`):

```
$ git log --first-parent --format="%h %cI %s" baa69a2d..origin/main
70b42b9f 2026-09-26T09:55:56-04:00 docs(phone): read the two phone renderers [skip-automerge] (#1971)
f240f3af 2026-09-26T09:40:48-04:00 docs(audit): F-Deploy-1 Fix Plan v1.54, retire three box directories [skip-
$ git diff --name-status baa69a2d origin/main
A	docs/PHONE_RENDERER_READ.md
A	docs/audit/F-Deploy-1_Fix_Plan_v1.54.md
```

Both are documents; neither changes what production runs.

## §9. What this document does not do

This document:

- does not stand in for the AL record, owed under #1960; AL's facts appear
  only as that issue's text;
- does not rule on the port disagreement (§4.3), the nginx page's removal
  (§5.3), the CORS 500s or the scanner (§5.2), or the disk margin (§4.4);
- does not record v1.54's directory deletion or the later cache cleanup;
- does not rule on the migration identity (`PROJECT_CONTEXT.md` §0 item 11);
- does not edit the AK record, v1.54, or any other filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS,
  database or Cognito contact. Every ATTESTED claim is Evoni's own account,
  taken outside any agent session. Every MEASURED claim is a repository
  read this filing session performed itself; issue text is a GitHub read,
  with nothing written;
- records no secret and no database host.

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

Unchanged from the AK record §10. Nothing minted here.

## §Standing

- §1–§7 each carry ATTESTED and MEASURED clauses, marked separately and never
  merged into one standing.
- Every attested count agrees with the measurement: four commits, one
  backend file (the one `node -c` names), no migration file (218 → 218), no
  package change (§2, §4.1, §4.2, §7).
- The time agrees: the last merge (12:43:28 UTC) precedes her 13:08:10 UTC
  login (§3).
- Two readings are INFERRED and marked: pm2's `PORT: 3000` taking precedence
  over `.env` (§4.3), and the CORS 500s being `src/app.js:193`'s rejection
  reaching `errorHandler`'s default (§5.2).
- The THIS EPISODE badge is neither attested nor refuted (§5.2).
- AL's facts are #1960's issue text, not a filed record.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #1968.*
