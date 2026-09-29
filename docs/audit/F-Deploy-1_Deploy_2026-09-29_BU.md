| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BU, 2026-09-29, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. The Scenes-tab "Retry feed moments" action (the §8(w) P5 follow-up) goes live; production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-28_BT.md`, whose deploy this one
follows. This document edits no filed document.

Basis: `origin/main` at `fb596c0c644434de196df5b44fd1acf89f45c4d3` (#2225),
read 2026-09-29, the tree Deploy BU moved production to (§8).

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

**The letter.** This deploy is lettered **BU**. BT ends at `cd287a6b` (BT
record §1, §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-29):**

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: cd287a6b09446150d94f3656bac9611b35999030 -> fb596c0c644434de196df5b44fd1acf89f45c4d3 (fast-forward)
Range: 3 commit(s), 11 file(s); PRs: #2222 #2224 #2225
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T004824Z
vite build: built in 33.40s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 22
/health at 2026-09-29T00:49:32Z: {"status":"healthy","timestamp":"2026-09-29T00:49:32.170Z","uptime":6.118765201,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 00:49:29 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 00:49:38 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 00:49:44 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 5838ms
  1|episode- | 2026-09-29 00:49:44 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 00:49:44 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor cd287a6b fb596c0c && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BT ends at `cd287a6b` (BT record §1, §8), which is this deploy's
start.

## §2. The range — MEASURED

```
$ git rev-list --count cd287a6b..fb596c0c
3
$ git log --oneline cd287a6b..fb596c0c
fb596c0c6 feat(scenes): retry unsaved beat feed moments (§8(w) P5) [skip-automerge] (#2225)
eeb710af8 docs(events): read terms, deals and the money path [skip-automerge] (#2224)
06b645644 docs(audit): deploy record BT [skip-automerge] (#2222)
$ git diff --shortstat cd287a6b fb596c0c
 11 files changed, 1287 insertions(+), 41 deletions(-)
$ git diff --name-only cd287a6b fb596c0c
docs/EVENT_TERMS_MONEY_READ.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BT.md
frontend/src/components/Episodes/EpisodeScenesTab.css
frontend/src/components/Episodes/EpisodeScenesTab.jsx
frontend/src/components/Episodes/EpisodeScenesTab.warning.test.jsx
src/routes/episodeBriefRoutes.js
src/services/episodeGeneratorService.js
src/services/feedMomentSaveService.js
src/services/feedMomentsService.js
tests/integration/feedMomentRetry.integration.test.js
tests/unit/routes/episodes-cluster-tier-promotion.test.js
$ git diff --name-only cd287a6b fb596c0c -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 3 commits, 11 files, the same three PRs, and no
migration or package change.

The runtime files are:
- backend: `episodeBriefRoutes.js`, `episodeGeneratorService.js`,
  `feedMomentSaveService.js` (new) and `feedMomentsService.js`;
- frontend: `EpisodeScenesTab.jsx` and `.css`.

The rest are tests, a living doc and a register record.

## §3. The time

**ATTESTED.** The backup is stamped 00:48:24Z. `Ready to accept requests` is
at 00:49:29, and `/health` answered at 00:49:32Z with uptime 6.1 s.

**MEASURED.** The newest commit in the range is #2225, at 00:37:29 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" cd287a6b..fb596c0c | head -1
fb596c0c6 2026-09-28T20:37:29-04:00 feat(scenes): retry unsaved beat feed moments (§8(w) P5) [skip-automerge] (#2225)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0, and Evoni confirmed the
database.

**MEASURED.** The range adds no migration (§2), and the tree holds 220
migration files (`ls src/migrations/*.js | wc -l` → `220`).

## §5. What went live — MEASURED

- **#2225 (`fb596c0c`), Task #2220, the §8(w) P5 follow-up.**
  - `POST /api/v1/episode-brief/:episodeId/feed-moments/retry`
    (`requireAuth`) re-runs the feed moment save for the beats the brief
    records as failed that still have no moment, and only those.
  - `generateFeedMoments` takes `onlyBeats`: those beats are generated
    without rolling their likelihood again.
  - The retry runs in one transaction under a lock on the brief row, with a
    savepoint per beat, and rewrites `event_metadata.feed_moment_save` in the
    same transaction.
  - The per-beat save, the brief record write and the missing-beats check
    move into `feedMomentSaveService`, shared by the generator, the plan
    route and the retry.
  - Production → Scenes (`EpisodeScenesTab`) gains a "Retry feed moments"
    button in its warning.
  - It makes no AI call.
- **Docs and register only, with no runtime effect:**
  - #2224 (`eeb710af`, Task #2223): `docs/EVENT_TERMS_MONEY_READ.md`.
  - #2222 (`06b64564`): deploy record BT.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, as at BT.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The count
is now 22, one past BT's 21 (BT record §6). `ANTHROPIC_API_KEY` count 1
(value not read). `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2). The retry reads and rewrites the existing
`episode_briefs.event_metadata` JSONB key `feed_moment_save`.

## §8. Basis statement

**MEASURED.** After Deploy BU, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
fb596c0c644434de196df5b44fd1acf89f45c4d3 2026-09-28 feat(scenes): retry unsaved beat feed moments (§8(w) P5) [skip-automerge] (#2225)
$ git rev-parse --is-shallow-repository
false
```

The `%ad` date is the author date in the committer's zone (UTC−4); the
commit landed at 00:37:29 UTC on 2026-09-29 (§3).

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It discharges nothing and mints nothing.
- It makes no host, AWS, database or Cognito contact.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md | tail -1
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

The tails are FD-69, XK-4 and PE 68. Nothing is minted here.

## §Standing

- **Continuity:** the tree agrees with the summary (3 commits, 11 files, no
  migration, no package change), with no gap after BT. Production is at
  `origin/main`, `fb596c0c`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 22.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
