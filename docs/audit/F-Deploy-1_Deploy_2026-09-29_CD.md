| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CD, 2026-09-29, backend and frontend, one plain restart, no migration. Evoni ran it herself with `scripts/deploy-prod.sh`, outside any agent session. T4 (Career Checklist Regenerate replaces its image), T5 (task edits go to the episode's copy after Start Episode) and the guard-hook fix go live. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_CC.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `f90af0b6563866232e9554e3222bbbe3335bb459` (#2305),
read 2026-09-29. This is the tree Deploy CD moved production to (§8).

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

**The letter.** This deploy is lettered **CD**. It follows CC
(`F-Deploy-1_Deploy_2026-09-29_CC.md`), the register's last deploy record.

## §0. Evoni's account, as given

**ATTESTED.** The summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it on 2026-09-29:

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: 38a85be9c9c7e8dc9735cdf932e4e16e5ebfc0c9 -> f90af0b6563866232e9554e3222bbbe3335bb459 (fast-forward)
Range: 4 commit(s), 16 file(s); PRs: #2298 #2301 #2302 #2305
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T203307Z
vite build: built in 33.74s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 221 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 32
/health at 2026-09-29T20:33:57Z: {"status":"healthy","timestamp":"2026-09-29T20:33:57.832Z","uptime":6.146668149,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 20:33:57 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 20:34:05 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 20:34:10 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 5035ms
  1|episode- | 2026-09-29 20:34:10 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 20:34:10 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 38a85be9 f90af0b6 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CC ends at `38a85be9` (CC record §1 and §8), and that is where
this deploy starts.

**The restart count is continuous (ATTESTED):** CC left it at 31 (CC
record §0), and CD's single restart brings it to 32.

## §2. The range — MEASURED

```
$ git rev-list --count 38a85be9..f90af0b6
4
$ git log --oneline 38a85be9..f90af0b6
f90af0b65 fix(tasks): after Start Episode, task edits go to the episode's copy (T5) [skip-automerge] (#2305)
7697b7e0c fix(tasks): Career Checklist Regenerate replaces its image (T4) [skip-automerge] (#2302)
afb974ed7 fix(guard): a git commit message naming the deploy script is allowed [skip-automerge] (#2301)
97cf15a80 docs(audit): deploy record CC [skip-automerge] (#2298)
$ git diff --shortstat 38a85be9 f90af0b6
 16 files changed, 917 insertions(+), 42 deletions(-)
$ git diff --name-only 38a85be9 f90af0b6
.claude/hooks/guard-dangerous-commands.js
.claude/hooks/guard-dangerous-commands.test.js
docs/audit/F-Deploy-1_Deploy_2026-09-29_CC.md
frontend/src/components/Episodes/EpisodeTodoList.jsx
frontend/src/components/Episodes/EpisodeTodoList.oneList.test.jsx
frontend/src/components/OverlayApprovalPanel.jsx
frontend/src/pages/WorldAdmin.jsx
src/routes/todoListRoutes.js
src/routes/worldEvents.js
src/services/episodeTaskCopyService.js
src/services/socialChecklistService.js
src/services/todoListService.js
tests/integration/careerChecklistRegenerate.integration.test.js
tests/integration/taskEditsEpisodeCopy.integration.test.js
tests/unit/services/episodeTaskCopyService.test.js
tests/unit/services/todoListService.careerAsset.test.js
$ git diff --name-only 38a85be9 f90af0b6 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 4 commits, 16 files, the same four PRs, and no
migration or package change.

The runtime files are:
- **backend:** `todoListRoutes.js`, `worldEvents.js`,
  `episodeTaskCopyService.js` (new), `socialChecklistService.js`,
  `todoListService.js`;
- **frontend:** `EpisodeTodoList.jsx`, `OverlayApprovalPanel.jsx`,
  `WorldAdmin.jsx`.

The guard hook (`.claude/hooks/`) runs only in agent sessions, not in the
app. The rest are tests and one register document (CC).

## §3. The time

**ATTESTED.** The backup is stamped 20:33:07Z. `Ready to accept requests` is
at 20:33:57. `/health` answered at 20:33:57Z with an uptime of 6.1 s.

**MEASURED.** The newest commit in the range is #2305, at 20:14:36 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 38a85be9..f90af0b6 | head -1
f90af0b65 2026-09-29T16:14:36-04:00 fix(tasks): after Start Episode, task edits go to the episode's copy (T5) [skip-automerge] (#2305)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 of 221 migrations pending, exit 0, and Evoni confirmed
the database.

**MEASURED.** The range adds no migration (§2). The tree holds 221 migration
files: `git ls-tree -r --name-only f90af0b6 src/migrations | grep -c '\.js$'`
returns `221`, the same as CC.

## §5. What went live — MEASURED

- **#2302 (`7697b7e0`), Task #2300: T4's remainder (§8(bb)).**
  - Career Checklist Regenerate now updates the episode's
    `UI.OVERLAY.CAREER_LIST` asset in place instead of adding a row, and
    creates one only when there is none.
  - `GET /todo/social` returns `career_asset_url`, so the saved image
    reloads.
- **#2305 (`f90af0b6`), Task #2304: T5 (§8(bb)).**
  - After Start Episode (`findTermsLockEpisode`), the social-task edit
    paths read and write the episode's copy
    (`episode_todo_lists.social_tasks`), keeping completion for tasks that
    carry over. Those paths are approve-overlay (social),
    generate-social-checklist and `GET overlay-tasks/social`.
  - Before Start Episode, the event's copy is edited as before.
- **#2301 (`afb974ed`), Task #2299:** the agent-session guard hook allows a
  git commit message that names the deploy script. It has no runtime effect
  on the app.
- **Register only:** #2298 (deploy record CC).

**Not in this tree.** T6 (#2306, PR #2308) and T7 (#2307, PR #2309) are
open, not merged, at filing.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, the same as at CC.

## §6. Restarts

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 32.
- `ANTHROPIC_API_KEY` count 1 (value not read).
- `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy CD, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
f90af0b6563866232e9554e3222bbbe3335bb459 2026-09-29 fix(tasks): after Start Episode, task edits go to the episode's copy (T5) [skip-automerge] (#2305)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
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

- **Continuity:** the tree agrees with the summary (4 commits, 16 files, no
  migration, no package change), with no gap after CC. Production is at
  `origin/main`, `f90af0b6`.
- **Deploy:** 0 pending of 221; `/health` healthy and connected; restart
  count 32.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **Live here:** T4's remainder and T5. T6 and T7 are not in this tree.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
