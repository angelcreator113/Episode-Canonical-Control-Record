| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AK, 2026-09-26, backend and frontend, no migration, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AJ.md` (the AJ record, #1953). This
document follows that one rather than editing it. Basis:
`7c7f8d4849e22f99e4d6f43b3f5840bbd83c85f8` (#1953), the tree Deploy AK
moved production to. `origin/main` at filing is the same commit (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Three standings appear below, each marked on its own claim and
never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production
  host, database or running app states. It cannot be reproduced from a
  clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce, and register
  documents already merged under `docs/audit/`.
- **NOT ATTESTED** marks a post-deploy check that Evoni's account does
  not report (§5.3). Nothing is inferred in its place.

This document closes no keystone, discharges no owed item, mints no FD,
XK or PE number, and rules on nothing. It does not correct the G3
clause 3 amendment; the correction is owed under #1954 (§5.2).

The deploy is lettered AK, continuing after Deploy AJ of the AJ record.
It is the first deploy in this series to delete application files
(§2), and the first whose restart was, on her account, run twice (§6).

## §0. Evoni's account, verbatim

**ATTESTED (Evoni, 2026-09-26, the deploy):**

> Deploy AK done. Restart 49 → 50, health 200. Production at 7c7f8d48.
> Deploy AK — 2026-09-26 ~02:15 UTC, backend and frontend, no migration: 272586ea → 7c7f8d48, three commits (#1950, #1952, #1953). Nine files changed under src/, two of them deletions (src/models/DecisionLog.js and src/routes/decisionLogs.js, removed by #1950); node -c passed on all seven surviving files and reported MODULE_NOT_FOUND for the two deleted paths, which is expected. Backup /var/www/html.bak-20260926-pre1952; build 37.00s; entry index-BrWEe0ti.js; HTTP 200. The first pm2 restart command did not execute — only the sleep/check ran, and the count stayed at 49 with the new frontend already served against the old backend; the restart was then run and the count went 49 → 50, health 200. GET /api/v1/decision-logs returned 404 while still on the old code, so that observation does not attest the retirement; it needs re-checking now the new code is live.

**ATTESTED (Evoni, 2026-09-26, app test):**

> Synergy: 87. The server's score, in the console, from the locked outfit — exactly the number the scorer returns and the one evaluation uses. One scorer, one number. That's #1943 confirmed live.
> Deploy AK app-test results, ATTESTED 2026-09-26. #1943 confirmed live: the locked outfit now logs "Synergy: 87", the server's score, where the browser formula gave 36 immediately after locking and 20 after a reload. One scorer, one number. Clause 3 not yet exercised: decision_log is still empty because browse-pool has not been called since the deploy — the locked outfit restores its look rather than loading the pool.

**ATTESTED (Evoni, 2026-09-26, production finding; issue #1954):**

> Production finding, ATTESTED 2026-09-26, after Deploy AK: clause 3's retargeted evidence does not work. decision_log is still empty after repeated closet loads. The cause is that #1950 added user_id: req.user.id to POST /world/:showId/browse-pool (src/routes/world.js:253), but the styling game calls POST /api/v1/wardrobe/browse-pool (EpisodeWardrobeGameplay.jsx:205). They are different routes. The instrumented one is not reached by the app, so the new evidence has the same defect as the old: it was never exercised against production, just on a different route. [… full text on issue #1954]
> This is the third time the same shape has caught us tonight: the test verified the code, the code verified nothing.

**ATTESTED (Evoni, 2026-09-26, the retirement re-checked):**

> Deploy AK, further attested 2026-09-26: with the new code running (restart 50), GET and POST to /api/v1/decision-logs both return 404. The plural route and its model are gone. This supersedes the earlier 404 observation, which was taken while the old code was still serving and attested nothing.

**ATTESTED (Evoni, 2026-09-26, closing):**

> That's AK fully checked: the outfit score at 87, the route retired, and the clause-3 attribution shipped but not firing — which #1954 now covers.

The elision "[… full text on issue #1954]" is Evoni's own; the rest of
that finding, and her ask, are on issue #1954 and are not reproduced
here. Her closing sentences ("That's #1943 confirmed live", "This is the
third time …", "That's AK fully checked …") are her own assessment; they
are recorded as she gave them, with no ruling (§9). The sections below
split the account into its claims and set each beside what the
repository measures.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `272586ea` to `7c7f8d48`. Evoni's
account gives no `git status` read for this deploy.

**MEASURED.** All SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 272586eae 18f48c5da 76bffe6a1 7c7f8d484 origin/main HEAD
272586eae2741442c7a1cab92a3941aff3821149
18f48c5da913e1a6b78d1d7b51e4b8b85e73d77a
76bffe6a1d5555938b57b1d7d119244d08f9852c
7c7f8d4849e22f99e4d6f43b3f5840bbd83c85f8
7c7f8d4849e22f99e4d6f43b3f5840bbd83c85f8
7c7f8d4849e22f99e4d6f43b3f5840bbd83c85f8
$ git merge-base --is-ancestor 272586eae 7c7f8d484; echo "exit=$?"
exit=0
```

(`HEAD` is this filing session's worktree before this record's commit.)
Deploy AJ ends at `272586eae` (AJ record §1, §8); Deploy AK begins
there.

## §2. Deploy AK — 2026-09-26 ~02:15 UTC, backend and frontend

**ATTESTED.**
- Three commits (#1950, #1952, #1953).
- Nine files changed under `src/`, two of them deletions:
  `src/models/DecisionLog.js` and `src/routes/decisionLogs.js`, removed
  by #1950.
- `node -c` passed on all seven surviving files and reported
  `MODULE_NOT_FOUND` for the two deleted paths.
- No migration.
- A frontend build (§2.1).
- `pm2 restart`: the first command did not execute; the second took the
  count 49 → 50 (§6). `/health` returned 200.

**MEASURED**, `git log --oneline --first-parent 272586eae..7c7f8d484`:

```
7c7f8d484 docs(audit): file the deploy record for Deploy AJ [skip-automerge] (#1953)
76bffe6a1 fix(wardrobe): the styling game shows the server's outfit score, draft and locked [skip-automerge] (#1952)
18f48c5da fix(decision-log): browse pool records who generated it; retire /decision-logs [skip-automerge] (#1950)
```

```
$ git rev-list --count --first-parent 272586eae..7c7f8d484
3
$ git rev-list --count 272586eae..7c7f8d484
3
```

Three commits, the same three PR numbers, matching Evoni's count. The
whole range, by status:

```
$ git diff --name-status 272586eae 7c7f8d484
A	docs/audit/F-AUTH-1_G3Clause3_Retarget_2026-09-26.md
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AJ.md
M	frontend/src/components/EpisodeWardrobeGameplay.jsx
M	frontend/src/components/EpisodeWardrobeGameplay.test.jsx
M	scripts/silent-catches.baseline
M	src/app.js
D	src/models/DecisionLog.js
M	src/models/index.js
D	src/routes/decisionLogs.js
M	src/routes/wardrobe.js
M	src/routes/world.js
M	src/services/episodeCompletionService.js
A	src/services/outfitScoreContext.js
M	src/utils/decisionLogger.js
M	tests/integration/f-auth-1-g3-clause3.test.js
D	tests/unit/routes/cp12-decisionLogs-tier.test.js
M	tests/unit/routes/wardrobe-cluster-tier-promotion.test.js
A	tests/unit/routes/wardrobe-outfitScore-display.test.js
A	tests/unit/utils/decisionLogger.userId.test.js
```

`git diff --stat 272586eae 7c7f8d484 -- src/`:

```
 src/app.js                               |   9 --
 src/models/DecisionLog.js                |  94 ------------------
 src/models/index.js                      |   6 +-
 src/routes/decisionLogs.js               |  94 ------------------
 src/routes/wardrobe.js                   | 161 ++++++++++++++++++++++++-------
 src/routes/world.js                      |   3 +
 src/services/episodeCompletionService.js |  28 ++----
 src/services/outfitScoreContext.js       | 111 +++++++++++++++++++++
 src/utils/decisionLogger.js              |   6 +-
 9 files changed, 257 insertions(+), 255 deletions(-)
```

- **Nine `src/` files: 2 deleted (`D`), 1 added (`A`), 6 modified
  (`M`).** The two deletions are the two Evoni names. The added file is
  `src/services/outfitScoreContext.js` (#1952); her account counts it
  among the seven survivors without naming it.
- **Migrations.** No file under `src/migrations/` changes:

  ```
  $ git ls-tree -r --name-only 272586eae src/migrations | wc -l
  218
  $ git ls-tree -r --name-only 7c7f8d484 src/migrations | wc -l
  218
  $ git diff --name-status 272586eae 7c7f8d484 -- src/migrations; echo "exit=$?"
  exit=0
  ```

  218 → 218, none added, removed or edited, matching "no migration".
- **`frontend/`**, `git diff --stat 272586eae 7c7f8d484 -- frontend/`:

  ```
   .../src/components/EpisodeWardrobeGameplay.jsx     | 281 ++++++++++-----------
   .../components/EpisodeWardrobeGameplay.test.jsx    | 240 +++++++++++++++++-
   2 files changed, 372 insertions(+), 149 deletions(-)
  ```

  Two files, one of them a test; one is source the build bundles
  (`EpisodeWardrobeGameplay.jsx`, #1952). Her account gives no
  `frontend/` file count; it attests a build (§2.1).
- **Packages.** `git diff --stat 272586eae 7c7f8d484 -- package.json
  package-lock.json frontend/package.json frontend/package-lock.json`
  prints nothing.
- **`scripts/`**: one line removed from `scripts/silent-catches.baseline`
  (#1952), the stale entry for `episodeCompletionService.js`'s removed
  `catch { /* no-op — authenticity signal just doesn't fire */ }`. Not
  served.
- **`docs/`**: the G3 clause 3 amendment
  `docs/audit/F-AUTH-1_G3Clause3_Retarget_2026-09-26.md` (#1950, 272
  lines) and the AJ record (#1953, 722 lines). Not served.
- **`tests/`**: seven files (#1950: the clause-3 integration test
  rewritten, `cp12-decisionLogs-tier.test.js` deleted,
  `decisionLogger.userId.test.js` added; #1952:
  `wardrobe-outfitScore-display.test.js` added,
  `wardrobe-cluster-tier-promotion.test.js` modified). Not served.
- `git diff --stat 272586eae 7c7f8d484 | tail -1`:
  ` 19 files changed, 2168 insertions(+), 533 deletions(-)`.
- **`node -c`.** The filing session's worktree is the basis
  (`git diff --name-only 7c7f8d484 HEAD` prints nothing, `exit=0`,
  before this record's commit). It ran `node -c` on the seven surviving
  files:

  ```
  $ n=0; for f in src/app.js src/models/index.js src/routes/wardrobe.js src/routes/world.js src/services/episodeCompletionService.js src/services/outfitScoreContext.js src/utils/decisionLogger.js; do node -c "$f" && n=$((n+1)) && echo "ok $f"; done; echo "all $n ok"
  ok src/app.js
  ok src/models/index.js
  ok src/routes/wardrobe.js
  ok src/routes/world.js
  ok src/services/episodeCompletionService.js
  ok src/services/outfitScoreContext.js
  ok src/utils/decisionLogger.js
  all 7 ok
  ```

  and on the two deleted paths:

  ```
  $ node -c src/models/DecisionLog.js 2>&1 | grep -E "^Error|code:"; node -c src/models/DecisionLog.js >/dev/null 2>&1; echo "exit=$?"
  Error: Cannot find module '/home/user/Episode-Canonical-Control-Record/.claude/worktrees/agent-a8a2be37f102d221b/src/models/DecisionLog.js'
    code: 'MODULE_NOT_FOUND',
  exit=1
  $ node -c src/routes/decisionLogs.js 2>&1 | grep -E "^Error|code:"; node -c src/routes/decisionLogs.js >/dev/null 2>&1; echo "exit=$?"
  Error: Cannot find module '/home/user/Episode-Canonical-Control-Record/.claude/worktrees/agent-a8a2be37f102d221b/src/routes/decisionLogs.js'
    code: 'MODULE_NOT_FOUND',
  exit=1
  ```

  The same result Evoni reports: seven pass, the two deleted paths are
  `MODULE_NOT_FOUND`. That is a repository read; the host's own run is
  ATTESTED.
- **No surviving reference to the retired files.** `git grep -n -e
  'decision-logs' -e 'DecisionLog\b' -e 'routes/decisionLogs' 7c7f8d484
  -- src frontend/src` finds only header comments in
  `src/migrations/20260818000000-add-deleted-at-to-decision-logs.js`
  (lines 10, 12, 13, 43); no `require` of either deleted path remains.

**Classification**, from each commit's own `git show --stat`:

| Commit | PR | Class | Files it changes |
|---|---|---|---|
| `18f48c5da` | #1950 | backend | `src/app.js`, `src/models/index.js`, `src/routes/world.js`, `src/utils/decisionLogger.js`; deletes `src/models/DecisionLog.js`, `src/routes/decisionLogs.js` (plus the clause 3 amendment and 3 test files, not served) |
| `76bffe6a1` | #1952 | both | `src/routes/wardrobe.js`, `src/services/episodeCompletionService.js`, `src/services/outfitScoreContext.js` (new); `frontend/src/components/EpisodeWardrobeGameplay.jsx` (plus `scripts/silent-catches.baseline` and 3 test files, not served) |
| `7c7f8d484` | #1953 | docs | `docs/audit/F-Deploy-1_Deploy_2026-09-26_AJ.md` (not served) |

Per commit, `src/` files are 6 + 3 = 9; no file is touched by both.

**Counts, side by side.**

| Claim | ATTESTED | MEASURED |
|---|---|---|
| Commits | 3 (#1950, #1952, #1953) | 3 first-parent, 3 total; the same three PR numbers |
| Files under `src/` | 9, two deletions | 9: 2 `D`, 1 `A` (`outfitScoreContext.js`), 6 `M` |
| `node -c` | 7 pass; 2 `MODULE_NOT_FOUND` | 7 pass; 2 `MODULE_NOT_FOUND` |
| Migration | none | 0 files under `src/migrations/` change; 218 → 218 |
| Frontend | a build; no file count given | 2 files under `frontend/`, 1 of them a test |
| Packages | not stated | no output for the root or `frontend/` package files |

No count differs.

### §2.1 Frontend

**ATTESTED (Evoni).**
- Backup of the served bundle: `/var/www/html.bak-20260926-pre1952`.
- Frontend build: 37.00s.
- Entry bundle: `index-BrWEe0ti.js`.
- HTTP 200 after the deploy.

**Beside it, from the register.** AJ had no frontend build (AJ record
§2.1), so the bundle AK replaced is AI's, whose entry the AI record §2.1
attests as `index-C_ulLbuu.js`. Both names stay ATTESTED.

**What the repository cannot confirm.** Bundle hashes are produced by a
build on the host and are not committed, so no read of this repository
confirms the entry name, the build time, the backup path or the HTTP
status. All four stay ATTESTED.

### §2.2 Housekeeping: the pending host restart

**ATTESTED (AF record §2.2; carried as pending by the AG, AH, AI and AJ
records).** After AF the box wanted a system restart. Evoni's AK account
does not report it as done. It is recorded here as **still pending**,
with no ruling.

## §3. The time

**ATTESTED:** 2026-09-26 ~02:15 UTC.

**MEASURED:** all three commits were committed before 02:15:

```
$ TZ=UTC git log --first-parent --format='%h %cd %s' --date=iso-local 272586eae..7c7f8d484
7c7f8d484 2026-09-26 02:09:26 +0000 docs(audit): file the deploy record for Deploy AJ [skip-automerge] (#1953)
76bffe6a1 2026-09-26 02:02:28 +0000 fix(wardrobe): the styling game shows the server's outfit score, draft and locked [skip-automerge] (#1952)
18f48c5da 2026-09-26 01:49:57 +0000 fix(decision-log): browse pool records who generated it; retire /decision-logs [skip-automerge] (#1950)
```

| Deploy | ATTESTED time | MEASURED: committer date of the attested end commit |
|---|---|---|
| AK | 2026-09-26 ~02:15 | `7c7f8d484` 2026-09-26 02:09:26 |

The attested ~02:15 is after the end commit's merge, so the account and
the measurement agree. **Beside it, from GitHub (read, not written).**
PR #1952 was merged at 02:02:29 UTC and #1953 at 02:09:26. Issue #1954
(the clause-3 finding) was created at 02:31:07 and issue #1955 (this
record's task) at 02:33:14, so the deploy and the app test fell between
02:09:26 and 02:31:07.

## §4. Pre-deploy checks

### §4.1 `scripts/check-pending-migrations.js`

**ATTESTED.** Evoni's AK account reports no run of the check. The last
attested count is AJ's "OK: 0 pending of 218 migration files checked"
(AJ record §4.1).

**MEASURED.** The range changes no file under `src/migrations/` (§2),
so the tree still holds the same 218 files AJ's check covered, and the
ledger rows AJ attests are not touched by any file in the range. That
the count is still 0 on the host after AK is not attested; nothing in
the range gives it a reason to move. `scripts/check-pending-migrations.js`
and `DEVELOPMENT_WORKFLOW.md` are unchanged in the range
(`git diff --stat 272586eae 7c7f8d484 --
scripts/check-pending-migrations.js DEVELOPMENT_WORKFLOW.md` prints
nothing).

## §5. What went live

**MEASURED**, from the commits' own diffs and messages, lines cited at
`7c7f8d484`. That these are in production rests on the ATTESTED deploy
(§2).

- **The plural `/api/v1/decision-logs` surface is retired (#1950,
  `18f48c5da`, `Task: #1942`).** The mount is gone from `src/app.js`
  (at `272586eae` it was `app.use('/api/v1/decision-logs',
  decisionLogsRoutes)`, line 918, inside a `try` at lines 916–922);
  `src/routes/decisionLogs.js` and `src/models/DecisionLog.js` are
  deleted, and `DecisionLog` is no longer declared, loaded, required or
  exported by `src/models/index.js`.
- **The world browse-pool passes the signed-in user's id to the
  `decision_log` write (#1950).** `POST /world/:showId/browse-pool`
  (`src/routes/world.js` line 162, `requireAuth`) calls
  `logger.logBrowsePoolGenerated` (line 253) with `user_id: req.user.id`
  (line 258, no fallback); `logBrowsePoolGenerated`
  (`src/utils/decisionLogger.js` line 233) passes it through. Whether
  this route is reached by the app is §5.2.
- **The styling game shows the server's outfit score, draft and locked
  (#1952, `76bffe6a1`, `Task: #1943`).**
  - `GET /api/v1/wardrobe/outfit-score/:episodeId[?event_id=]`
    (`src/routes/wardrobe.js` line 263, `requireAuth`) scores the
    episode's approved links and reports `pending`; `POST
    /api/v1/wardrobe/outfit-score/:episodeId` (line 282, `requireAuth`,
    read-only) scores a draft `{ wardrobe_ids, event_id }`. Both go
    through `scoreEpisodeOutfitForDisplay` (line 206).
  - `src/services/outfitScoreContext.js` (new) builds the event, Lala's
    state and the arc stage for both completion and display.
  - `CONFIDENCE_LEVELS` (`src/routes/wardrobe.js` lines 1796–1802) now
    carries Lala's line per band.
  - In `EpisodeWardrobeGameplay.jsx`, `calculateSynergy` is removed; one
    effect GETs the locked score or POSTs the draft (lines 372–373), and
    the locked banner renders `Synergy: {synergy.total}/100 —
    {synergy.confidence.emoji} {synergy.confidence.label}` (line 608).
- **The AJ record (#1953, `7c7f8d484`, `Task: #1949`).** Not served.

### §5.1 `/api/v1/decision-logs`: which observation discriminates

**ATTESTED.** On the old code, `GET /api/v1/decision-logs` returned 404,
and Evoni states that this "does not attest the retirement". With the
new code running (restart 50), `GET` and `POST` to
`/api/v1/decision-logs` both returned 404; she states this supersedes
the earlier observation.

**MEASURED, at `272586eae` (the old code).** `src/routes/decisionLogs.js`
defined three routes and no others:

```
$ git show 272586eae:src/routes/decisionLogs.js | grep -n -e 'router\.' -e 'require' -e 'module.exports'
1:const express = require('express');
3:const { DecisionLog } = require('../models');
4:const { requireAuth } = require('../middleware/auth');
7:router.post('/', requireAuth, async (req, res) => {
44:router.get('/episode/:episodeId', requireAuth, async (req, res) => {
72:router.get('/scene/:sceneId', requireAuth, async (req, res) => {
94:module.exports = router;
```

- **A `GET` to the bare path matched nothing on the old code either.**
  The router had no `GET /`, so the request fell through the mount
  (`src/app.js` line 918) to the end of the stack: the SPA catch-all
  (`app.get('/{*splat}', …)`, line 1686) skips any path starting
  `/api/` (lines 1690–1698), and `app.use(notFoundHandler)` (line 1748)
  answers with `NotFoundError`, status 404
  (`src/middleware/errorHandler.js` lines 55–59, 173–176). None of the
  routers mounted at `/api/v1` ahead of it carries router-level
  middleware (`git grep -n -E "router\.(use|all)\("` over the eighteen
  route files `src/app.js` mounts at `/api/v1` prints nothing,
  `exit=1`), and no param or wildcard mount matches the path. So
  `GET /api/v1/decision-logs` answered 404 before #1950 and after it.
  Evoni's first 404 is therefore uninformative on the code, as she
  states; her superseding `GET` 404 is likewise not discriminating on
  its own.
- **A `POST` to the bare path did match on the old code.** `POST /` was
  `requireAuth`-gated (line 7). Without an `Authorization` header,
  `requireAuth` answers 401 `AUTH_REQUIRED`
  (`src/middleware/auth.js` lines 566–573 at `272586eae`). With a valid
  token, the handler ran `DecisionLog.create` and answered 201 or, from
  its `catch`, 500 (lines 19–40); the migration header records that
  `POST /api/v1/decision-logs` "has returned 500" in production
  (`src/migrations/20260818000000-add-deleted-at-to-decision-logs.js`
  line 13). No path through the old code returned 404 for a `POST` to
  the bare path.
- **At `7c7f8d484` (the new code)** there is no mount, file or model
  (§5), so both `GET` and `POST` fall to `notFoundHandler`: 404.

**So her superseding `POST` 404 is the discriminating observation**:
it could not have been produced by the old code, authenticated or not,
and it is what the new code produces. Evoni's account does not say
whether her `POST` carried a token; either way the old code would not
have answered 404. The `GET` 404 is consistent with the new code but
does not distinguish it. That the retirement is live rests on the
ATTESTED `POST` 404 and the ATTESTED restart to 50.

### §5.2 G3 clause 3: the attribution shipped on a route the app does not call

**ATTESTED.** `decision_log` is still empty after the deploy, and
"after repeated closet loads"; her diagnosis is that #1950 instrumented
`POST /world/:showId/browse-pool` while the styling game calls
`POST /api/v1/wardrobe/browse-pool`. Her earlier app-test statement,
that `decision_log` was empty "because browse-pool has not been called
since the deploy", is superseded in her own later finding by the
repeated closet loads and the route diagnosis. Both are recorded as she
gave them.

**MEASURED at `7c7f8d484`**, the route facts #1954 tabulates:

| Question | Answer, with citation |
|---|---|
| Does `POST /api/v1/wardrobe/browse-pool` write `decision_log`? | **No.** The handler runs from `src/routes/wardrobe.js` line 1059 to the next route at line 1336 (`router.post('/select', …)`); `sed -n '1059,1335p' src/routes/wardrobe.js \| grep -n -i -e 'decision' -e 'INSERT' -e 'logger'` prints nothing (`exit=1`), and `git grep -n decision_log 7c7f8d484 -- src/routes/wardrobe.js` prints nothing (`exit=1`). |
| Is it auth-gated? | **Yes.** `router.post('/browse-pool', requireAuth, async (req, res) => {` (line 1059). |
| Is the world route mounted? | **Yes.** `src/app.js` lines 768–769: `const worldRoutes = trackRouteLoad('world', () => require('./routes/world'));` and `app.use('/api/v1', worldRoutes);`. The route is `src/routes/world.js` line 162. |
| Does anything outside tests call the world route? | **No.** `git grep -n -e "/browse-pool" 7c7f8d484 -- frontend/src src scripts` (test files excluded) finds only comments (`frontend/src/utils/wardrobeReach.js` line 7, `src/routes/world.js` lines 7 and 159, `src/services/wardrobeReach.js` line 6, `src/routes/wardrobe.js` line 1056), the two route definitions, and one call: `frontend/src/components/EpisodeWardrobeGameplay.jsx` line 205, `api.post('/api/v1/wardrobe/browse-pool', …`. |
| What does the game call? | `POST /api/v1/wardrobe/browse-pool` (`EpisodeWardrobeGameplay.jsx` line 205), the uninstrumented route. |

The tests that name the world path are
`tests/integration/f-auth-1-g3-clause3.test.js` (it `POST`s
`/api/v1/world/${showId}/browse-pool`, line 127) and two unit files
that match the route's source text rather than calling it over HTTP
(`tests/unit/routes/world-cluster-tier-promotion.test.js` lines
267–268; `tests/unit/utils/decisionLogger.userId.test.js` lines 62,
68). #1954's table counts "three unit tests"; this record's `git grep`
finds the two named here plus `wardrobe-browsePool-deletedEvent.test.js`
and `wardrobe-styling-reach.test.js`, which name `browse-pool` but test
the wardrobe route. The difference is one of counting; it is recorded,
not settled.

**Her line citation, beside the file.** Evoni cites
`src/routes/world.js:253`. At `7c7f8d484` line 253 is the
`await logger.logBrowsePoolGenerated({` call; the added
`user_id: req.user.id` is line 258, and the route itself is line 162.
The citation names the write the attribution rides on; the difference
is recorded, not amended.

**The amendment, cited, not corrected.**
`docs/audit/F-AUTH-1_G3Clause3_Retarget_2026-09-26.md` (merged in #1950)
§3, "What it still does not prove", reads at lines 209–211: "It runs
against CI's migrated schema, like its predecessor. What makes it
stronger evidence is that its table exists in production. **It has not
been exercised against production.**" The last sentence stands on
Evoni's finding. The sentence before it is what #1954 corrects: the
table exists in production, but no production path writes it, so the
substitution is not stronger evidence as deployed. (Line 139's
"stronger evidence" is inside Evoni's quoted ruling in §2 and is not
the line #1954 names.) The correction is owed as a new register file
under #1954 (its ask, item 4); this record does not make it, and does
not edit the amendment.

What the repository cannot confirm: that `decision_log` is empty in
production, how many closet loads were made, or which route production
received. All stay ATTESTED.

### §5.3 Post-deploy checks

**ATTESTED.** `/health` 200 and restart 49 → 50 (§6); HTTP 200 on the
frontend (§2.1); the outfit score (below); the retirement (§5.1); the
clause-3 finding (§5.2).

| Check | Standing |
|---|---|
| #1952: the locked outfit shows the server's score, 87 | ATTESTED PASS ("That's #1943 confirmed live"); see below |
| #1950: `GET` and `POST` `/api/v1/decision-logs` answer 404 on the new code | ATTESTED; the `POST` is the discriminating observation (§5.1) |
| #1950: a browse-pool generation writes `decision_log.user_id` in production | ATTESTED NOT FIRING: `decision_log` empty; the instrumented route is not the one the app calls (§5.2, #1954) |
| #1952: the locked score is the same before and after a reload | NOT ATTESTED as a separate read (her 87 is one read of the locked outfit) |
| #1952: a draft's score updates about 350 ms after an equip | NOT ATTESTED |
| #1952: a locked outfit with pieces awaiting approval shows the "not counted yet" note | NOT ATTESTED |

**Beside the 87, MEASURED.**
- **PR #1952's worked example** (PR body, "What changes for the
  player"; a GitHub read): "For three luxury pieces at a prestige 7–9
  event with no other signals, the server scores **87**". The attested
  87 equals that figure. The PR's example is the PR's own computation
  under "no other signals", and this record does not re-derive it; the
  production figure also depends on Lala's state and the arc stage,
  which are not attested. That the two agree is recorded, not
  explained.
- **The label.** 87 ≥ 85, so `CONFIDENCE_LEVELS`
  (`src/routes/wardrobe.js` line 1801: `{ min: 85, label: 'Slaying',
  emoji: '👑', … lala: "They're not ready for me." }`) puts it in
  **"Slaying"**, and the locked banner would read
  `Synergy: 87/100 — 👑 Slaying` (`EpisodeWardrobeGameplay.jsx` line
  608). Evoni reported the number only; the label is MEASURED from the
  code, not attested.
- **"In the console" / "logs".** The component prints the score in the
  locked banner (line 608); none of its `console.*` calls (lines 295,
  384, 532) prints a score. What surface Evoni read "Synergy: 87" from
  is not stated beyond her words, and this record does not infer it.
- **"The one evaluation uses."** The GET scores with `approvedOnly`, as
  completion does (`scoreEpisodeOutfitForDisplay`, line 233), through
  the context `outfitScoreContext.js` builds for both (#1952 body, item
  2). That production's evaluation would score this outfit 87 is her
  statement and is not re-derived.
- **36 and 20.** The browser figures she cites are the AI record's §5.1
  observations, explained there as `calculateSynergy`'s reload artefact.
  `calculateSynergy` is removed at `7c7f8d484` (§5).

**Carried forward from the AJ record §5.1.** AK's account reports none
of them. They remain **NOT ATTESTED at filing**, and none is inferred:

| PR | What to watch | Standing |
|---|---|---|
| #1940 (AI) | "For This Event" offers the owned Cotton Sundress and White Canvas Sneakers | NOT ATTESTED (her closet loads are attested for `decision_log` only; no offer is reported) |
| #1940 (AI) | A lock whose total is unaffordable is refused and writes nothing | NOT ATTESTED |
| #1940 (AI) | Closet labels | Deliberately not checked (AI record §5.1); NOT ATTESTED |
| #1938 (AI) | A spend that would take coins below zero is refused | NOT ATTESTED |
| #1936 (AH) | Approve, reject, approval-status and suggestions answer without an eager-loading error | NOT ATTESTED |
| #1912 (AF §5.1) | Start Episode lands on Production → Assets | NOT ATTESTED |
| #1914 (AF §5.1) | The Phone tab leads with Preview Phone | NOT ATTESTED |
| #1922 (AF §5.1) | Save draft persists across a reload | NOT ATTESTED |
| #1915 (AF §5.1) | The version routes answer 501 | NOT ATTESTED |
| #1896 (AE §5.1) | Stream events arrive live through nginx, not buffered into one burst | NOT ATTESTED |
| #1896 (AE §5.1) | No doubled updates between live events and the REST refresh | NOT ATTESTED |
| #1900 (AE §5.1) | The Assistant streams, and an AI Writer action returns text | NOT ATTESTED |

Twelve carried checks, none attested by AK, plus the three #1952 checks
above. The persisted locked outfit (AI) is consistent with her reading a
locked outfit's score after AK, but she does not state it as a check,
and it is not upgraded here. `/health` 200 is a process check; it is not
these.

## §6. Restarts

**ATTESTED (Evoni).**

| Restart | Deploy |
|---|---|
| first command: did not execute; count stayed 49 | AK |
| 49 → 50 | AK |

In her words, "only the sleep/check ran, and the count stayed at 49 with
the new frontend already served against the old backend; the restart
was then run".

**Beside it, from the register.** AI's restart was 47 → 48 (AI record
§6) and AJ's 48 → 49 (AJ record §6). AK's 49 → 50 follows with no gap;
the failed first command added no restart, on her account.

### §6.1 The window: new frontend, old backend

**ATTESTED.** For a period between the frontend build and the second
restart, the new bundle (`index-BrWEe0ti.js`) was served while the
process still ran `272586eae`'s backend. Its length is not stated.

**MEASURED: what the new frontend calls that the old backend lacked.**
The frontend diff adds exactly two request lines, both in the scoring
effect:

```
$ git diff 272586eae 7c7f8d484 -- frontend/src/components/EpisodeWardrobeGameplay.jsx | grep -E "^[-+].*api\.(get|post|put|patch|delete)"
+          ? await api.get(`/api/v1/wardrobe/outfit-score/${episodeId}${eventId ? `?event_id=${encodeURIComponent(eventId)}` : ''}`, opts)
+          : await api.post(`/api/v1/wardrobe/outfit-score/${episodeId}`, { wardrobe_ids: ids, ...(eventId ? { event_id: eventId } : {}) }, opts);
$ git grep -n "outfit-score" 272586eae -- src/routes/wardrobe.js
272586eae:src/routes/wardrobe.js:191:// GET /api/v1/wardrobe/outfit-score/:episodeId
272586eae:src/routes/wardrobe.js:194:router.get('/outfit-score/:episodeId', requireAuth, async (req, res) => {
```

The component's other calls (`browse-pool`, `outfit/:episodeId`, the
wardrobe list, `episodes/:id/todo`, `outfit-history`, `purchase`,
`lock-outfit-atomic`) are unchanged by the diff and existed for the old
bundle.

- **A draft score (`POST /api/v1/wardrobe/outfit-score/:episodeId`,
  added by #1952, `src/routes/wardrobe.js` line 282 at `7c7f8d484`)**
  had no route on the old backend; it fell to `notFoundHandler`, 404.
  The component's `catch` logs `Outfit score failed:` and sets the
  panel to its error state (`EpisodeWardrobeGameplay.jsx` lines
  383–385). PR #1952's own "Failing on main" note says the same of its
  test run: "main has no POST route, so the request 404s anyway".
- **A locked score (`GET …/outfit-score/:episodeId`)** had a route on
  the old backend (line 194 at `272586eae`), but the old handler
  ignores `?event_id=`, picks the event by an unordered `LEFT JOIN
  world_events` (lines 201–208), calls `getOutfitScore(models,
  episodeId, event)` with no character state, arc stage or
  `approvedOnly` (line 221), and returns no `pending`. Its
  `CONFIDENCE_LEVELS` (line 1713 at `272586eae`) carry no `lala` line,
  so the new panel would show no line from it (line 641 at
  `7c7f8d484` renders `confidence.lala` only when present). A locked
  outfit read during the window could therefore show a different
  number from the new code's for the same outfit. #1952's body lists
  these as "The GET's behaviour changed".
- **The `/decision-logs` observation** fell in the same window: her
  first `GET` 404 was taken "while still on the old code" (§5.1).

Whether any request was made during the window, and what it showed, is
not attested beyond the `GET /api/v1/decision-logs` 404. Her 87 was read
after the restart to 50, on her account. This record makes no ruling on
the restart procedure.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2). The deleted
`DecisionLog` model named the table `decision_logs` (`tableName`, line
63 at `272586eae`), which the AJ record §7 attests does not exist in
production; the retained `decision_log` table (singular) is untouched
by the range. No schema change is recorded or implied.

## §8. Basis statement

**MEASURED.** After Deploy AK, production's tree is this record's basis,
`7c7f8d484`. No commit on `origin/main` up to and including `7c7f8d484`
is undeployed, on Evoni's attested list.

**Merged after AK, undeployed** (MEASURED at filing, after
`git fetch origin main`):

```
$ git log --oneline --first-parent 7c7f8d484..origin/main; echo "exit=$?"
exit=0
```

No output: `origin/main` is `7c7f8d484` at filing (§1), so nothing has
merged after AK. #1954 (the clause-3 retarget to the wardrobe route) is
open at filing with no PR merged. (GitHub read, nothing written.)

## §9. What this document does not do

This document:

- does not correct `docs/audit/F-AUTH-1_G3Clause3_Retarget_2026-09-26.md`
  or rule on whether G3 clause 3's evidence stands. It cites the
  amendment's §3 and #1954, which owns the correction;
- does not rule on #1954's ask (moving the attribution, retiring or
  keeping the world route), on #1942, #1943 or #1951;
- does not rule on whether #1943 is "confirmed live". That is her
  assessment, recorded in §0; the 87 and its agreement with PR #1952's
  worked example are recorded beside it (§5.3);
- does not rule on the restart procedure or the window (§6.1), or on the
  pending host restart (§2.2);
- does not rule on the migration identity, which the AJ record §9
  records as unfixed;
- does not edit the AJ, AI, AH, AG or AF record, the clause 3
  amendment, `docs/MIGRATION_DRIFT_READ.md`, or any migration;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS,
  database or Cognito contact. Every ATTESTED claim above is Evoni's own
  account, taken outside any agent session. Every MEASURED claim is a
  repository read this filing session performed itself; PR and issue
  states, bodies and times are GitHub reads, with nothing written;
- records no secret anywhere above.

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

Unchanged from the AI and AJ records §10. Nothing minted here.

## §Standing

- §1–§4, §6 and §7 each carry an ATTESTED clause and a MEASURED clause,
  marked separately and never merged into one standing.
- Every attested count agrees with the measurement (§2): 3 commits, 9
  `src/` files (2 deleted, 1 added, 6 modified), `node -c` 7 pass and 2
  `MODULE_NOT_FOUND`, no migration file (218 → 218). The added
  `outfitScoreContext.js` is among her seven survivors, unnamed.
- The time agrees: ~02:15 is after the last merge (02:09:26) (§3).
- **The retirement (§5.1):** on the old code `GET /api/v1/decision-logs`
  already hit `notFoundHandler` (404), since the router had only
  `POST /`, `GET /episode/:episodeId` and `GET /scene/:sceneId`; only
  the `POST` discriminates (old: 401 unauthenticated, 201/500
  authenticated; new: 404). Her superseding `POST` 404 is the
  discriminating observation.
- **#1943 (§5.3):** the attested 87 equals PR #1952's worked example
  (not re-derived) and falls in "Slaying" (≥ 85), a label she did not
  report. No `console.*` in the component prints the score; the banner
  renders it.
- **Clause 3 (§5.2):** the attribution is on `POST
  /world/:showId/browse-pool`, which nothing outside tests calls; the
  game calls `POST /api/v1/wardrobe/browse-pool`, which is
  `requireAuth`-gated and writes no `decision_log`. Her `world.js:253`
  is the logger call; `user_id` is line 258. The amendment's §3
  "stronger evidence" line is what #1954 corrects; not corrected here.
- **The restart window (§6.1):** a draft score would have 404'd on the
  old backend; a locked score would have come from the old GET, with a
  different event choice, no approved-only filter and no Lala line.
  ATTESTED that the window occurred; no ruling.
- Twelve carried checks and three new #1952 checks remain NOT ATTESTED
  (§5.3).
- Nothing in this document is labelled RULED, and nothing is INFERRED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
  agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1955.*
