| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BV, 2026-09-29, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. The money and deal rulings' first fixes go live: D5 (the suggester skips used and deleted events), D4 (the terms lock enforced server-side), D3 (an outfit lock no longer makes finalize skip) and D2 (finalize and complete transactional and idempotent); production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_BU.md`, whose deploy this one
follows. This document edits no filed document.

Basis: `origin/main` at `faf81971c16e93a6b38a7ab187c35a98036a5613` (#2236),
read 2026-09-29, the tree Deploy BV moved production to (§8).

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

**The letter.** This deploy is lettered **BV**. BU ends at `fb596c0c` (BU
record §1, §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-29):**

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: fb596c0c644434de196df5b44fd1acf89f45c4d3 -> faf81971c16e93a6b38a7ab187c35a98036a5613 (fast-forward)
Range: 6 commit(s), 25 file(s); PRs: #2226 #2232 #2233 #2234 #2235 #2236
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T020719Z
vite build: built in 35.75s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 23
/health at 2026-09-29T02:08:26Z: {"status":"healthy","timestamp":"2026-09-29T02:08:26.047Z","uptime":6.16897011,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 02:08:25 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 02:08:33 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 02:08:38 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4559ms
  1|episode- | 2026-09-29 02:08:38 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 02:08:38 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor fb596c0c faf81971 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BU ends at `fb596c0c` (BU record §1, §8), which is this deploy's
start.

## §2. The range — MEASURED

```
$ git rev-list --count fb596c0c..faf81971
6
$ git log --oneline fb596c0c..faf81971
faf81971c fix(money): finalize and complete are transactional and idempotent (§8(x) D2) [skip-automerge] (#2236)
11fa41f39 fix(money): an outfit lock no longer makes finalize skip the episode (§8(x) D3) [skip-automerge] (#2235)
3987f63dd fix(events): enforce the terms lock server-side (§8(x) D4, §8(w) P9) [skip-automerge] (#2234)
765d4646d fix(events): the next-event suggester skips used and deleted events (§8(x) D5) [skip-automerge] (#2233)
68a5deb5a docs(events): record money and deal rulings D1–D11 [skip-automerge] (#2232)
9a4a23eac docs(audit): deploy record BU [skip-automerge] (#2226)
$ git diff --shortstat fb596c0c faf81971
 25 files changed, 1452 insertions(+), 206 deletions(-)
$ git diff --name-only fb596c0c faf81971
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_BU.md
frontend/src/components/Episodes/EpisodeOverviewTab.jsx
frontend/src/components/Episodes/EpisodeOverviewTab.termsLock.test.jsx
frontend/src/pages/WorldAdmin.jsx
src/routes/careerGoals.js
src/routes/episodeBriefRoutes.js
src/routes/worldEvents.js
src/services/episodeCompletionService.js
src/services/financialTransactionService.js
src/utils/eventTermsLock.js
src/utils/withTransaction.js
tests/integration/eventTermsLock.integration.test.js
tests/integration/finalizeCompleteTransaction.integration.test.js
tests/integration/lockOutfitFinalize.integration.test.js
tests/integration/suggestEventsSkipsUsed.integration.test.js
tests/unit/routes/wardrobe-outfitScore-display.test.js
tests/unit/routes/worldEvents-one-event-one-episode.test.js
tests/unit/services/characterSyncService.eventOutcome.test.js
tests/unit/services/episodeCompletionService.careerHook.test.js
tests/unit/services/episodeCompletionService.characterKey.test.js
tests/unit/services/episodeCompletionService.coins.test.js
tests/unit/services/episodeCompletionService.deliverables.test.js
tests/unit/services/episodeCompletionService.look.test.js
tests/unit/services/financialTransactionService.dryRun.test.js
$ git diff --name-only fb596c0c faf81971 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 6 commits, 25 files, the same six PRs, and no
migration or package change.

The runtime files are:
- backend: `careerGoals.js`, `episodeBriefRoutes.js`, `worldEvents.js`,
  `episodeCompletionService.js`, `financialTransactionService.js`,
  `eventTermsLock.js` (new) and `withTransaction.js` (new);
- frontend: `EpisodeOverviewTab.jsx` and `WorldAdmin.jsx`.

The rest are tests, a living doc and a register record.

## §3. The time

**ATTESTED.** The backup is stamped 02:07:19Z. `Ready to accept requests` is
at 02:08:25, and `/health` answered at 02:08:26Z with uptime 6.2 s.

**MEASURED.** The newest commit in the range is #2236, at 02:04:30 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" fb596c0c..faf81971 | head -1
faf81971c 2026-09-28T22:04:30-04:00 fix(money): finalize and complete are transactional and idempotent (§8(x) D2) [skip-automerge] (#2236)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0, and Evoni confirmed the
database.

**MEASURED.** The range adds no migration (§2), and the tree holds 220
migration files (`ls src/migrations/*.js | wc -l` → `220`).

## §5. What went live — MEASURED

- **#2233 (`765d4646`), Task #2231, `docs/EVENT_EPISODE_FLOW.md` §8(x) D5.**
  `GET /world/:showId/suggest-events` (`careerGoals.js`) no longer returns
  events used by an episode or soft-deleted. Unmet access requirements stay
  a score weight, and a malformed requirements value no longer fails the
  route.
- **#2234 (`3987f63d`), Task #2230, §8(x) D4 and §8(w) P9.**
  - Once an event has started a live episode (`eventTermsLock.js`: a live
    brief naming it, else a live `used_in_episode_id`), the event PUT, inject
    and the brief PUT refuse, with 409 `EVENT_TERMS_LOCKED`, changes to its
    access requirements, compensation, restrictions and episode link.
  - Resending those fields unchanged still saves.
  - WorldAdmin's swap and the AI-fix reassign are refused for started events
    (Evoni: no relink action for now).
  - The episode overview and WorldAdmin show the refusal in plain words.
- **#2235 (`11fa41f3`), Task #2229, §8(x) D3.**
  - An outfit lock's ledger rows (`metadata.flow = 'lock_outfit'`) no longer
    count as "already finalized".
  - Finalize skips pieces the lock already bought for the episode.
- **#2236 (`faf81971`), Task #2228, §8(x) D2.**
  - `finalizeEpisodeFinancials` runs in a transaction under a lock on the
    episode row.
  - `completeEpisode` runs its money and state steps (10c–15) in one
    transaction and re-checks `accepted` under the lock.
  - A failure rolls back, and a retry or concurrent call books nothing twice.
- **Docs and register only, with no runtime effect:**
  - #2232 (`68a5deb5`, Task #2227): §8(x), the money and deal rulings D1–D11.
  - #2226 (`9a4a23ea`): deploy record BU.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, as at BU.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The count
is now 23, one past BU's 22 (BU record §6). `ANTHROPIC_API_KEY` count 1
(value not read). `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BV, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
faf81971c16e93a6b38a7ab187c35a98036a5613 2026-09-28 fix(money): finalize and complete are transactional and idempotent (§8(x) D2) [skip-automerge] (#2236)
$ git rev-parse --is-shallow-repository
false
```

The `%ad` date is the author date in the committer's zone (UTC−4); the
commit landed at 02:04:30 UTC on 2026-09-29 (§3).

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It files no register note for D1–D3; §8(x) records that one is owed.
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

- **Continuity:** the tree agrees with the summary (6 commits, 25 files, no
  migration, no package change), with no gap after BU. Production is at
  `origin/main`, `faf81971`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 23.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
