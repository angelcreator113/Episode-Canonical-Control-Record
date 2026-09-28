| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BS, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. F-Reg-2 fix group 2's memories/interview.js and worldStudio.js sites, and the episode production-workspace fixes P3, P4 and P5, go live; production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-28_BR.md`, whose deploy this one
follows. This document edits no filed document.

Basis: `origin/main` at `80fc3ad95da845a50c021abfb84183c7270ac08e` (#2215),
the tree Deploy BS moved production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED** covers the script's summary block as Evoni pasted it.
- **MEASURED** covers what this repository shows, with output pasted.

Nothing is upgraded. This document closes no keystone, discharges no owed
item, mints no FD, XK or PE number, and rules on nothing.

It records no token, email, password, hostname, IP address, key path, account
number or ARN. The shell prompt after the pasted block named the host, so it
is not reproduced.

**The letter.** This deploy is lettered **BS**. BR ends at `3c41e368` (BR
record §1, §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-28):**

```
Deploy (Evoni, 2026-09-28, via scripts/deploy-prod.sh)
Tree: 3c41e368d4351e8d9571f7f166b51e672f482f2f -> 80fc3ad95da845a50c021abfb84183c7270ac08e (fast-forward)
Range: 8 commit(s), 18 file(s); PRs: #2199 #2203 #2204 #2206 #2209 #2211 #2214 #2215
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260928T230340Z
vite build: built in 35.41s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 20
/health at 2026-09-28T23:04:41Z: {"status":"healthy","timestamp":"2026-09-28T23:04:41.937Z","uptime":6.139361064,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-28 23:04:39 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-28 23:04:48 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-28 23:04:53 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4499ms
  1|episode- | 2026-09-28 23:04:53 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-28 23:04:53 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 3c41e368 80fc3ad9 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BR ends at `3c41e368` (BR record §1, §8), which is this deploy's
start.

## §2. The range — MEASURED

```
$ git rev-list --count 3c41e368..80fc3ad9
8
$ git log --oneline 3c41e368..80fc3ad9
80fc3ad95 fix(feed): beat step persists or reports its failure (§8(w) P5) [skip-automerge] (#2215)
1cdb5dbe9 fix(timeline): honor the requested episode_id (§8(w) P4) [skip-automerge] (#2214)
e39dbca58 fix(episodes): regenerate keeps the old episode until the new one exists (§8(w) P3) [skip-automerge] (#2211)
058a62bed docs(episodes): record production-workspace rulings P1–P9 [skip-automerge] (#2209)
12e0352b7 fix(registry): serialize worldStudio.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2206)
f39a77c90 docs(episodes): read the production workspace [skip-automerge] (#2204)
5b3ffd500 fix(registry): serialize memories/interview.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2203)
5090ee59d docs(audit): file deploy records BQ and BR [skip-automerge] (#2199)
$ git diff --shortstat 3c41e368 80fc3ad9
 18 files changed, 1631 insertions(+), 81 deletions(-)
$ git diff --name-only 3c41e368 80fc3ad9
docs/DESIGN_DOCTRINE.md
docs/EPISODE_PRODUCTION_READ.md
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BQ.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BR.md
frontend/src/pages/StudioTimelinePage.jsx
frontend/src/pages/StudioTimelinePage.test.jsx
frontend/src/pages/TimelineEditor.jsx
frontend/src/pages/TimelineEditor.test.jsx
src/routes/memories/interview.js
src/routes/worldEvents.js
src/routes/worldStudio.js
src/services/episodeGeneratorService.js
tests/integration/feedMomentBeatSave.integration.test.js
tests/integration/regenerateEpisodeSafe.integration.test.js
tests/integration/registryRmwGroup2Interview.integration.test.js
tests/integration/registryRmwGroup2WorldStudio.integration.test.js
tests/unit/routes/worldEvents-one-event-one-episode.test.js
$ git diff --name-only 3c41e368 80fc3ad9 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 8 commits, 18 files, the same eight PRs, and no
migration or package change.

The runtime files are:
- backend: `memories/interview.js`, `worldEvents.js`, `worldStudio.js`,
  `episodeGeneratorService.js`;
- frontend: `StudioTimelinePage.jsx`, `TimelineEditor.jsx`.

The rest are tests, living docs and register records.

## §3. The time

**ATTESTED.** The backup is stamped 23:03:40Z. `Ready to accept requests` is
at 23:04:39, and `/health` answered at 23:04:41Z with uptime 6.1 s.

**MEASURED.** The newest commit in the range is #2215, at 22:31:12 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 3c41e368..80fc3ad9 | head -1
80fc3ad95 2026-09-28T18:31:12-04:00 fix(feed): beat step persists or reports its failure (§8(w) P5) [skip-automerge] (#2215)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0, and Evoni confirmed the
database.

**MEASURED.** The range adds no migration (§2), and the tree holds 220
migration files (`ls src/migrations/*.js | wc -l` → `220`).

## §5. What went live — MEASURED

- **#2203 (`5b3ffd50`), Task #2201, F-Reg-2 fix group 2 (v1.2 R2), row 50.**
  POST `/memories/character-interview-save-progress` sets
  `extra_fields.interview_progress` in one atomic `jsonb_set` UPDATE.
- **#2206 (`12e0352b`), Task #2205, row 60.** `backfillRelationshipsMap` in
  `worldStudio.js` reads, unions and writes `relationships_map` under a row
  lock (`SELECT … FOR UPDATE` in a transaction).
- **#2211 (`e39dbca5`), Task #2210, `docs/EVENT_EPISODE_FLOW.md` §8(w) P3.**
  `regenerate-episode` no longer unlinks the event or soft-deletes the old
  episode before generating. The generator takes `replacingEpisodeId`, and it
  supersedes the old episode and relinks the event inside the transaction that
  creates the new one.
- **#2214 (`1cdb5dbe`), Task #2212, §8(w) P4.** `StudioTimelinePage` honours
  `?episode_id=`. `TimelineEditor` shows an error for an unknown episode
  instead of a placeholder timeline.
- **#2215 (`80fc3ad9`), Task #2213, §8(w) P5.** The generator's feed-moment
  step writes each beat's `feed_moment` onto its `scene_plans` row, and
  reports failures in `feedMomentSave`.
- **Docs and register only, with no runtime effect:**
  - #2204 (`f39a77c9`, Task #2202): `docs/EPISODE_PRODUCTION_READ.md`.
  - #2209 (`058a62be`, Task #2207): rulings P1–P9 in `EVENT_EPISODE_FLOW.md`
    §8(w) and doctrine rule 19.
  - #2199 (`5090ee59`): deploy records BQ and BR.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, as at BR.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The count
is now 20, one past BR's 19 (BR record §6). `ANTHROPIC_API_KEY` count 1
(value not read). `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BS, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
80fc3ad95da845a50c021abfb84183c7270ac08e 2026-09-28 fix(feed): beat step persists or reports its failure (§8(w) P5) [skip-automerge] (#2215)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It discharges nothing and mints nothing.
- It makes no host, AWS, database or Cognito contact.

## §10. Tails

Re-derived at this basis, with the same commands as the BQ record §10: FD-69,
XK-4 and PE 68. Nothing is minted here.

## §Standing

- **Continuity:** the tree agrees with the summary (8 commits, 18 files, no
  migration, no package change), with no gap after BR. Production is at
  `origin/main`, `80fc3ad9`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 20.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1). Agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
