| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BX, 2026-09-29, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. §8(bb) T3 goes live: ticked social tasks no longer pay coins. Five docs and register PRs ride along. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_BW.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `e93de3d5b5ae7d1d6b2c0d840833ebcc95a615f3` (#2265),
read 2026-09-29. This is the tree Deploy BX moved production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: the script's summary block, as Evoni pasted it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email, password, hostname, IP address, key path,
account number or ARN. The shell prompt after the pasted block named the
host, so it is not reproduced.

**The letter.** This deploy is lettered **BX**. BW ends at `ff38e0c9` (BW
record §1 and §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED.** The summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it on 2026-09-29:

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: ff38e0c9fd9722ff69132374be3848109c09c449 -> e93de3d5b5ae7d1d6b2c0d840833ebcc95a615f3 (fast-forward)
Range: 6 commit(s), 7 file(s); PRs: #2257 #2258 #2260 #2261 #2264 #2265
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T135039Z
vite build: built in 35.58s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 25
/health at 2026-09-29T13:51:30Z: {"status":"healthy","timestamp":"2026-09-29T13:51:30.212Z","uptime":6.181060383,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 13:51:29 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 13:51:37 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 13:51:42 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4642ms
  1|episode- | 2026-09-29 13:51:42 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 13:51:42 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor ff38e0c9 e93de3d5 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BW ends at `ff38e0c9` (BW record §1 and §8), and that is where
this deploy starts.

## §2. The range — MEASURED

```
$ git rev-list --count ff38e0c9..e93de3d5
6
$ git log --oneline ff38e0c9..e93de3d5
e93de3d5b fix(money): coins never come from ticking a task (§8(bb) T3) [skip-automerge] (#2265)
acbd38618 docs: record §8(bb) Task rulings T1–T7 [skip-automerge] (#2264)
f9b827812 docs(tasks): read every task list [skip-automerge] (#2261)
60d52c66a docs: record §8(aa) Episode money rulings M1–M5 [skip-automerge] (#2260)
2ba5e2ebd docs(audit): deploy record BW [skip-automerge] (#2258)
18831f8d0 docs: record §8(z) LalaVerse economy laws, with a currency inventory and law-to-build map [skip-automerge] (#2257)
$ git diff --shortstat ff38e0c9 e93de3d5
 7 files changed, 833 insertions(+), 85 deletions(-)
$ git diff --name-only ff38e0c9 e93de3d5
docs/EVENT_EPISODE_FLOW.md
docs/TASK_LISTS_READ.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_BW.md
frontend/src/pages/WorldAdmin.jsx
src/routes/worldEvents.js
src/services/financialTransactionService.js
tests/integration/noCoinsForTasks.integration.test.js
$ git diff --name-only ff38e0c9 e93de3d5 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 6 commits, 7 files, the same six PRs, and no
migration or package change.

The runtime files are:
- backend: `financialTransactionService.js`, `worldEvents.js`;
- frontend: `WorldAdmin.jsx`.

The rest are a test, living docs and a register record.

## §3. The time

**ATTESTED.** The backup is stamped 13:50:39Z. `Ready to accept requests` is
at 13:51:29. `/health` answered at 13:51:30Z with an uptime of 6.2 s.

**MEASURED.** The newest commit in the range is #2265, at 13:44:50 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" ff38e0c9..e93de3d5 | head -1
e93de3d5b 2026-09-29T09:44:50-04:00 fix(money): coins never come from ticking a task (§8(bb) T3) [skip-automerge] (#2265)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 of 220 migrations pending, exit 0, and Evoni confirmed
the database.

**MEASURED.** The range adds no migration (§2). The tree holds 220 migration
files: `git ls-tree -r --name-only e93de3d5 src/migrations | grep -c '\.js$'`
returns `220`.

## §5. What went live — MEASURED

- **#2265 (`e93de3d5`), Task #2263, §8(bb) T3.**
  - `finalizeEpisodeFinancials` no longer books `social_task_reward` rows
    for completed social tasks. `SOCIAL_TASK_REWARDS`, `TIMING_MULTIPLIERS`
    and `calculateSocialTaskRewards` are removed.
  - The financial forecast no longer projects task income, and WorldAdmin's
    "Tasks: +N" forecast line is gone.
  - Two things are unchanged: `completeEpisode`'s social-task stat effects
    (T3 leaves them to the deal design), and past `social_task_reward` rows,
    which stay as history.
- **Docs and register only, with no runtime effect:**
  - #2257: §8(z), the economy laws.
  - #2258: deploy record BW.
  - #2260: §8(aa), M1–M5.
  - #2261: `docs/TASK_LISTS_READ.md`.
  - #2264: §8(bb), T1–T7.

**INFERRED, from the code at this tree.** From BX onward, an episode earns
nothing for ticked social tasks. Its finalize net, and so its coins, is
lower than before by the rewards those ticks used to pay.

**Not in this tree.** None of the following is live yet:
- §8(aa) M6, the deleted-episode filter (#2268, open);
- D1 PR 5, the reconciliation apply action (unmerged);
- D1 PRs 2–4 (#2255 held; PRs 3–4 not built).

The reconciliation of the live show waits on a later deploy.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, the same as at BW.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The
restart count is now 25, one past BW's 24 (BW record §6).
`ANTHROPIC_API_KEY` count 1 (value not read). `episode-worker` is not
reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BX, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
e93de3d5b5ae7d1d6b2c0d840833ebcc95a615f3 2026-09-29 fix(money): coins never come from ticking a task (§8(bb) T3) [skip-automerge] (#2265)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It records no reconciliation result. The apply is Evoni's, after PR 5 is
  deployed.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

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

- **Continuity:** the tree agrees with the summary (6 commits, 7 files, no
  migration, no package change), with no gap after BW. Production is at
  `origin/main`, `e93de3d5`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 25.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
