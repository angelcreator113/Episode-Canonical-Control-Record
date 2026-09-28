| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BM, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh` run from the repository. The CFO detail-line fix, the guard-hook fix and QuickEpisodeCreator's edit cost go live; the script updated itself mid-run.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BL.md` (the BL record, filed as #2163,
`5d0cdc83`), whose deploy this one follows. This document edits no filed
document. Basis: `origin/main` at `9e4a57aa368d6fd5609d7af8813bbb965fd9e947`
(#2183) at filing (§8). Deploy BM moved production to
`1039859f334dc7c8dd899c7b70fc53cce389da7c` (#2170).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states. It cannot be reproduced from a clone.
- **MEASURED** covers what this repository shows, read with local `git` on
  an unshallowed clone; the output is pasted.
- No clause is INFERRED.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
hostname, IP address, key path, account number or ARN.

**The letter.** This deploy is lettered **BM**. BL ends at `c0ebdf13` (BL
record §1, §8), and this deploy begins there (§1).

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-28, about 17:10–17:12 UTC: the script's summary
block, as she supplied it at filing, and her notes on the run):**

- Tree: `c0ebdf1393d66a8260dcf7bd5d2d0016f25e2f4d` →
  `1039859f334dc7c8dd899c7b70fc53cce389da7c` (fast-forward).
- Range: 4 commits, 7 files; PRs #2163, #2165, #2169, #2170. No migration
  or package/lock file.
- Backup: `frontend/dist` → `~/dist-backup-20260928T171050Z`. vite build:
  built in 35.10 s.
- Pending check: `[host hidden]/episode_metadata` as `episode_app_dev`: 0
  pending of 220 (exit 0). Database confirmed: y.
- `ANTHROPIC_API_KEY` count 1 (value not read).
- "Restart now": y. A plain restart; the restart count is now 14.
- `/health` at 2026-09-28T17:11:48Z: healthy, database connected, uptime
  6.2 s. `Ready to accept requests` at 17:11:47.
- CFO audit, 17:11:55–17:12:00: 82/100, 1 critical, 5 warnings (BL: 84/100,
  4 warnings). The detail line was not captured (the old filter, §5.2). The
  new warning is not identified.
- The script ran as `bash scripts/deploy-prod.sh` from the repository, not
  from a `/tmp` copy. It fast-forwarded itself: the old version kept
  running, so the CFO detail lines were still dropped. The fix applies from
  the next deploy.
- A stray "y" was typed during the health wait; it had no effect.
- **App check:** not done.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `c0ebdf13` to `1039859f`.

**MEASURED.** The start is an ancestor of the end:

```
$ git merge-base --is-ancestor c0ebdf13 1039859f && echo "ancestor: yes"
ancestor: yes
```

**MEASURED: no gap before this deploy.** BL's record gives production's tree
after BL as `c0ebdf13` (BL record §1, §8), which is this deploy's start.
Deploy BN begins at `1039859f` (`F-Deploy-1_Deploy_2026-09-28_BN.md` §1),
this deploy's end.

## §2. The range — MEASURED

```
$ git rev-list --count c0ebdf13..1039859f
4
$ git log --oneline c0ebdf13..1039859f
1039859f3 fix(events): QuickEpisodeCreator edit sends cost_coins [skip-automerge] (#2170)
12fc0b3e2 fix(tooling): guard hook allows an assignment that names deploy-prod.sh [skip-automerge] (#2169)
2cb7c6383 fix(tooling): keep CFO critical detail lines in deploy-prod.sh output [skip-automerge] (#2165)
5d0cdc833 docs(audit): file deploy record BL [skip-automerge] (#2163)
$ git diff --shortstat c0ebdf13 1039859f
 7 files changed, 517 insertions(+), 7 deletions(-)
$ git diff --name-only c0ebdf13 1039859f
.claude/hooks/guard-dangerous-commands.js
.claude/hooks/guard-dangerous-commands.test.js
docs/audit/F-Deploy-1_Deploy_2026-09-28_BL.md
frontend/src/components/QuickEpisodeCreator.editCost.test.jsx
frontend/src/components/QuickEpisodeCreator.jsx
scripts/deploy-prod.sh
tests/unit/scripts/deployProdScript.test.js
$ git diff --name-only c0ebdf13 1039859f -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

There are four commits. Their effects:
- **Runtime:** only #2170 (`frontend/src/components/QuickEpisodeCreator.jsx`).
- **Tooling:** #2165 (`scripts/deploy-prod.sh`) and #2169 (the guard hook).
  The running app does not load either.
- **Register only:** #2163 (the BL record).

No migration and no package manifest or lockfile is in the range.

## §3. The time

**ATTESTED.** 2026-09-28, about 17:10–17:12 UTC. The backup is stamped
17:10:50Z, `Ready to accept requests` at 17:11:47, and `/health` answered at
17:11:48Z with uptime 6.2 s (§0). This falls between BL (about 16:27–16:31
UTC, BL record §3) and BN (about 18:11–18:12 UTC, BN record §3).

**MEASURED.** The newest commit in the range is #2170, 17:09:21 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" c0ebdf13..1039859f | head -1
1039859f3 2026-09-28T13:09:21-04:00 fix(events): QuickEpisodeCreator edit sends cost_coins [skip-automerge] (#2170)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** Pending-migration check against `episode_metadata` as
`episode_app_dev`: 0 pending of 220, exit 0. Evoni confirmed at the script's
prompt that this is the database the API uses.

**MEASURED.** The range adds no migration (§2). The tree holds 220 migration
files at `1039859f`, the same count BL and BN read as 0 pending of 220.

## §5. What went live

### §5.1 The change — MEASURED

- **#2170 (`1039859f`), Task #2167.** QuickEpisodeCreator's edit sends
  `cost_coins`. The edit load also reads `cost_coins`: it read `cost`,
  which is never returned, so every event opened at 50 coins.
- **#2165 (`2cb7c638`), Task #2164.** `scripts/deploy-prod.sh`'s CFO filter
  keeps the `→ [agent] msg` detail lines under "Critical issues found:".
- **#2169 (`12fc0b3e`), Task #2166.** The guard hook no longer treats an
  assignment that only names the deploy script as running it. It is agent
  tooling, with no production effect.
- **#2163 (`5d0cdc83`):** the BL record; register only.

### §5.2 The script updated itself — ATTESTED, beside MEASURED

**ATTESTED (§0).** The script was run from the repository and
fast-forwarded itself; the old version kept running, and its CFO lines
dropped the detail line.

**MEASURED.** #2165 is in this range (§2), so the script bash had started was
the pre-#2165 version. BN's summary (`F-Deploy-1_Deploy_2026-09-28_BN.md` §0)
is the first to carry the detail line.

### §5.3 The build, the backup and the live check

**ATTESTED (§0).** `frontend/dist` was backed up to
`~/dist-backup-20260928T171050Z`; vite built in 35.10 s. `/health` was
healthy with the database connected.

**Not done (§0):** QuickEpisodeCreator's edit cost was not checked live.

## §6. Restarts

**ATTESTED (§0).** One plain `pm2 restart` of `episode-api-prod-hotfix`; the
restart count is now 14. `ANTHROPIC_API_KEY` count 1 (value not read).

**MEASURED, against the filed records.** BL left the count at 13 (BL record
§6), and BN's single restart reads 15 (BN record §0). BM's 14 sits between
them, with no gap.

## §7. Schema changes

**MEASURED.** No file under `src/migrations/` changes in the range (§2). No
schema change.

## §8. Basis statement

**MEASURED.**

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
9e4a57aa368d6fd5609d7af8813bbb965fd9e947 2026-09-28 fix(registry): serialize registrySync.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2183)
$ git rev-parse --is-shallow-repository
false
```

GitHub MCP `list_pull_requests` (state open) returned `[]`. Production is
past this deploy's end: BN, BO and BP are filed with this record.

## §9. What this document does not do

- It records no token, email, password, hostname, IP address, key path,
  account number or ARN.
- It edits no filed document.
- It investigates nothing: not the CFO audit's critical, its warnings, or
  `episode-worker`.
- It discharges no owed item, closes no keystone, and mints no FD, XK or PE
  number.
- It performs no deploy, restart, migration or database action, and makes no
  host, AWS, database or Cognito contact. Every ATTESTED claim is Evoni's own
  account.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md
57:### XK-1 — `paranoid` exposure
208:### XK-2 — row-scope not enforced in SQL
289:### XK-3 — no authorization substrate for the tenancy root
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
$ ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v1\.[0-9]+\.md$' | sort -V | tail -1
F-Deploy-1_Fix_Plan_v1.56.md
```

The tails are FD-69, XK-4 (the register's admitted entries) and PE 68.
Nothing is minted here.

## §Standing

- **Continuity:** the tree agrees with Evoni's confirmed range: 4 commits,
  7 files, no migration, no package change (§2). There is no gap after BL
  (§1).
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 14, continuous from BL's 13 to BN's 15 (§6). All ATTESTED from the
  summary block supplied at filing.
- **App check:** not done.
- **CFO:** 82/100 with 5 warnings; the critical is unnamed, because the old
  script ran (§5.2).
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the filing session.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
