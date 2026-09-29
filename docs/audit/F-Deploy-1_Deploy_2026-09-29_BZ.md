| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BZ, 2026-09-29, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. D1 PR 2 goes live: Complete and Finalize sync Lala's coins from the ledger. Two register PRs ride along. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_BY.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `8257ed538d0690433e2167c63c6aeef7cd5423ca` (#2255),
read 2026-09-29. This is the tree Deploy BZ moved production to (§8).

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
account number or ARN.

**The letter.** This deploy is lettered **BZ**. BY ends at `9f1abfd9` (BY
record §1 and §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED.** The summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it on 2026-09-29:

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: 9f1abfd9d86eedfe998ec5436e415900028f5827 -> 8257ed538d0690433e2167c63c6aeef7cd5423ca (fast-forward)
Range: 3 commit(s), 16 file(s); PRs: #2255 #2270 #2271
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T141858Z
vite build: built in 34.26s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 27
/health at 2026-09-29T14:20:08Z: {"status":"healthy","timestamp":"2026-09-29T14:20:08.283Z","uptime":9.20509598,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 14:20:07 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 14:20:15 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 14:20:19 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4182ms
  1|episode- | 2026-09-29 14:20:19 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 14:20:19 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 9f1abfd9 8257ed53 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BY ends at `9f1abfd9` (BY record §1 and §8), and that is where
this deploy starts.

## §2. The range — MEASURED

```
$ git rev-list --count 9f1abfd9..8257ed53
3
$ git log --oneline 9f1abfd9..8257ed53
8257ed538 feat(money): Complete and Finalize sync coins from the ledger inside D2's transaction (D1 PR 2) [skip-automerge] (#2255)
fc8b82eac docs(audit): register note on D1's reconciliation read and per-show decisions [skip-automerge] (#2271)
a6595323a docs(audit): deploy record BX [skip-automerge] (#2270)
$ git diff --shortstat 9f1abfd9 8257ed53
 16 files changed, 736 insertions(+), 95 deletions(-)
$ git diff --name-only 9f1abfd9 8257ed53
docs/audit/F-Deploy-1_Deploy_2026-09-29_BX.md
docs/audit/F-Stats-1_D1_ReconciliationRead_2026-09-29.md
src/routes/worldEvents.js
src/services/coinLedgerSync.js
src/services/episodeCompletionService.js
src/services/financialTransactionService.js
tests/integration/completeFinalizeCoinSync.integration.test.js
tests/integration/finalizeCompleteTransaction.integration.test.js
tests/unit/routes/wardrobe-outfitScore-display.test.js
tests/unit/services/characterSyncService.eventOutcome.test.js
tests/unit/services/episodeCompletionService.careerHook.test.js
tests/unit/services/episodeCompletionService.characterKey.test.js
tests/unit/services/episodeCompletionService.coins.test.js
tests/unit/services/episodeCompletionService.deliverables.test.js
tests/unit/services/episodeCompletionService.look.test.js
tests/unit/services/financialTransactionService.dryRun.test.js
$ git diff --name-only 9f1abfd9 8257ed53 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 3 commits, 16 files, the same three PRs, and
no migration or package change.

The runtime files are backend only: `worldEvents.js`, `coinLedgerSync.js`,
`episodeCompletionService.js` and `financialTransactionService.js`. No
frontend file is in the range. The rest are tests and two register
documents.

## §3. The time

**ATTESTED.** The backup is stamped 14:18:58Z. `Ready to accept requests` is
at 14:20:07. `/health` answered at 14:20:08Z with an uptime of 9.2 s.

**MEASURED.** The newest commit in the range is #2255, at 14:18:15 UTC, so
the deploy followed it by under a minute:

```
$ git log --first-parent --format="%h %cI %s" 9f1abfd9..8257ed53 | head -1
8257ed538 2026-09-29T10:18:15-04:00 feat(money): Complete and Finalize sync coins from the ledger inside D2's transaction (D1 PR 2) [skip-automerge] (#2255)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 of 220 migrations pending, exit 0, and Evoni confirmed
the database.

**MEASURED.** The range adds no migration (§2). The tree holds 220 migration
files: `git ls-tree -r --name-only 8257ed53 src/migrations | grep -c '\.js$'`
returns `220`.

## §5. What went live — MEASURED

- **#2255 (`8257ed53`), Task #2247, D1 PR 2.**
  - `completeEpisode` and `finalizeEpisodeFinancials` write Lala's coins by
    syncing them from the ledger (`syncCoinsFromLedger`), inside D2's
    transaction, after their last ledger row. Complete reads the balance
    first through the new `lockLedgerBalance`.
  - §8(y) Q6: a Complete or Finalize that would take Lala below zero is
    refused, and writes nothing. The finalize route answers it with the
    same 400 as Complete (`InsufficientCoinsError`).
- **Register only, with no runtime effect:**
  - #2270: deploy record BX.
  - #2271: the register note on D1's reconciliation read.

**Not in this tree.** D1 PRs 3–4 (#2248, #2249) are not built.

**The order: PR 2 went live before the apply.** Evoni's earlier ruling held
#2255 until PR 5's apply had run (ruling "(a)"). That order was not kept:
#2255 merged (the squash commit is authored by `angelcreator113`) and went
live at BZ, and the reconciliation apply ran afterwards (ATTESTED, Evoni,
2026-09-29). This record does not re-rule the order.

**Why it mattered — INFERRED, from the code at this tree.** On show
`9bd0655f-…`, a Complete or Finalize between BZ and the apply would have
booked that episode's rows and synced Lala's coins from the ledger. Those
rows are not in the approval, so after the four voids the ledger would have
summed to 1900 plus that episode's net, and unless the net was 0 the apply
would have refused, writing nothing.

**What happened in between.**
- **ATTESTED** (Evoni, 2026-09-29): no ledger rows were added between BZ and
  the apply.
- **Consistent with it, from her pasted dry-run and apply responses** (the
  reconciliation register note, `F-Stats-1_D1_ReconciliationApplied_2026-09-29.md`):
  - `coins_before` was 560 in both responses. That is the cache value Q-A
    read before any of this, so neither Complete nor Finalize had synced
    the cache since; both do (§5).
  - Neither run was refused. The apply refuses unless the ledger sums to
    exactly 1900 after the four voids, so any counted row added in between
    netted to 0.
  - The responses alone do not exclude a row that nets to 0 or one that
    does not count; the "no rows added" is Evoni's attestation.
- **Outcome:** show `9bd0655f-…` went from 560 to 1900; the four
  `wardrobe_purchase` rows (285 + 385 + 385 + 385 = 1,440) were voided;
  nothing was refused.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, the same as at BY.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The
restart count is now 27, one past BY's 26 (BY record §6).
`ANTHROPIC_API_KEY` count 1 (value not read). `episode-worker` is not
reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BZ, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
8257ed538d0690433e2167c63c6aeef7cd5423ca 2026-09-29 feat(money): Complete and Finalize sync coins from the ledger inside D2's transaction (D1 PR 2) [skip-automerge] (#2255)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It records the reconciliation outcome only as far as it bears on this
  deploy's order (§5); the full record is the reconciliation register note.
- It re-rules nothing about the #2255 hold.
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

- **Continuity:** the tree agrees with the summary (3 commits, 16 files, no
  migration, no package change), with no gap after BY. Production is at
  `origin/main`, `8257ed53`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 27.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **Reconciliation:** PR 2 went live here, before the apply. The apply then
  ran and was not refused: show `9bd0655f-…` 560 → 1900, four rows voided.
  No ledger rows were added in between (ATTESTED; consistent with both
  responses, §5).
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
