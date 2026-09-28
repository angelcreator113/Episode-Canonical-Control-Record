| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BT, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. The episode production-workspace items P6 (EpisodeWardrobeTab deleted) and the P5 follow-up (the Scenes-tab feed moment warning) go live; production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-28_BS.md`, whose deploy this one
follows. This document edits no filed document.

Basis: `origin/main` at `cd287a6b09446150d94f3656bac9611b35999030` (#2221),
the tree Deploy BT moved production to (§8).

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

**The letter.** This deploy is lettered **BT**. BS ends at `80fc3ad9` (BS
record §1, §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-28):**

```
Deploy (Evoni, 2026-09-28, via scripts/deploy-prod.sh)
Tree: 80fc3ad95da845a50c021abfb84183c7270ac08e -> cd287a6b09446150d94f3656bac9611b35999030 (fast-forward)
Range: 3 commit(s), 12 file(s); PRs: #2217 #2219 #2221
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260928T233715Z
vite build: built in 33.10s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 21
/health at 2026-09-28T23:38:25Z: {"status":"healthy","timestamp":"2026-09-28T23:38:25.127Z","uptime":6.093867963,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-28 23:38:24 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-28 23:38:32 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-28 23:38:36 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4029ms
  1|episode- | 2026-09-28 23:38:36 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-28 23:38:36 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 80fc3ad9 cd287a6b && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BS ends at `80fc3ad9` (BS record §1, §8), which is this deploy's
start.

## §2. The range — MEASURED

```
$ git rev-list --count 80fc3ad9..cd287a6b
3
$ git log --oneline 80fc3ad9..cd287a6b
cd287a6b0 feat(scenes): warn when beat feed moments were not saved (§8(w) P5) [skip-automerge] (#2221)
893674630 refactor(episodes): delete unmounted EpisodeWardrobeTab (§8(w) P6) [skip-automerge] (#2219)
15c503bec docs(audit): deploy record BS [skip-automerge] (#2217)
$ git diff --shortstat 80fc3ad9 cd287a6b
 12 files changed, 538 insertions(+), 856 deletions(-)
$ git diff --name-only 80fc3ad9 cd287a6b
docs/audit/F-Deploy-1_Deploy_2026-09-28_BS.md
frontend/src/components/Episodes/EpisodeScenesTab.css
frontend/src/components/Episodes/EpisodeScenesTab.jsx
frontend/src/components/Episodes/EpisodeScenesTab.warning.test.jsx
frontend/src/components/Episodes/EpisodeWardrobeTab.css
frontend/src/components/Episodes/EpisodeWardrobeTab.jsx
frontend/src/styles/responsive.css
src/routes/episodeBriefRoutes.js
src/routes/wardrobe.js
src/services/episodeGeneratorService.js
tests/integration/feedMomentBeatSave.integration.test.js
tests/integration/feedMomentMissing.integration.test.js
$ git diff --name-only 80fc3ad9 cd287a6b -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 3 commits, 12 files, the same three PRs, and no
migration or package change.

The runtime files are:
- backend: `episodeBriefRoutes.js`, `episodeGeneratorService.js`
  (`wardrobe.js` changes a comment only);
- frontend: `EpisodeScenesTab.jsx` and `.css`, `responsive.css`, and the two
  deleted `EpisodeWardrobeTab` files, which nothing imported.

The rest are tests and a register record.

## §3. The time

**ATTESTED.** The backup is stamped 23:37:15Z. `Ready to accept requests` is
at 23:38:24, and `/health` answered at 23:38:25Z with uptime 6.1 s.

**MEASURED.** The newest commit in the range is #2221, at 23:34:45 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 80fc3ad9..cd287a6b | head -1
cd287a6b0 2026-09-28T19:34:45-04:00 feat(scenes): warn when beat feed moments were not saved (§8(w) P5) [skip-automerge] (#2221)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0, and Evoni confirmed the
database.

**MEASURED.** The range adds no migration (§2), and the tree holds 220
migration files (`ls src/migrations/*.js | wc -l` → `220`).

## §5. What went live — MEASURED

- **#2219 (`89367463`), Task #2218, `docs/EVENT_EPISODE_FLOW.md` §8(w) P6.**
  - Deletes the unmounted `EpisodeWardrobeTab.jsx` and `.css`.
  - Removes its dead rules from `responsive.css` (the `.ewt-*` drawer blocks
    and section 22).
  - Updates the outfit-score consumer comment in `wardrobe.js` (a comment
    only).
- **#2221 (`cd287a6b`), Task #2216, the §8(w) P5 follow-up.**
  - The generator records its feed-moment save outcome on the episode brief,
    as `event_metadata.feed_moment_save`, with one atomic `jsonb_set`; no new
    column.
  - `GET /api/v1/episode-brief/:episodeId/plan` also returns
    `feed_moment_missing`.
  - Production → Scenes (`EpisodeScenesTab`) names those beats in a warning.
  - Episodes generated before this deploy carry no record, so they show no
    warning.
- **Register only, with no runtime effect:** #2217 (`15c503be`), deploy
  record BS.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, as at BS.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The count
is now 21, one past BS's 20 (BS record §6). `ANTHROPIC_API_KEY` count 1
(value not read). `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2). The new `feed_moment_save` key lives inside the
existing `episode_briefs.event_metadata` JSONB column.

## §8. Basis statement

**MEASURED.** After Deploy BT, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
cd287a6b09446150d94f3656bac9611b35999030 2026-09-28 feat(scenes): warn when beat feed moments were not saved (§8(w) P5) [skip-automerge] (#2221)
$ git rev-parse --is-shallow-repository
false
```

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

- **Continuity:** the tree agrees with the summary (3 commits, 12 files, no
  migration, no package change), with no gap after BS. Production is at
  `origin/main`, `cd287a6b`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 21.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1). Agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
