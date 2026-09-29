| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BY, 2026-09-29, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. §8(aa) M6 (deleted episodes no longer count) and D1 PR 5 (the reconciliation apply action) go live.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_BX.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `8257ed538d0690433e2167c63c6aeef7cd5423ca` (#2255),
read 2026-09-29. Deploy BY moved production to `9f1abfd9` (§8). Deploy BZ
then moved it on to `8257ed53`; that is recorded in
`F-Deploy-1_Deploy_2026-09-29_BZ.md`, filed alongside this one.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: the script's summary block, as Evoni pasted it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.
- **CANNOT-TELL**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email, password, hostname, IP address, key path,
account number or ARN.

**The letter.** This deploy is lettered **BY**. BX ends at `e93de3d5` (BX
record §1 and §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED.** The summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it on 2026-09-29:

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: e93de3d5b5ae7d1d6b2c0d840833ebcc95a615f3 -> 9f1abfd9d86eedfe998ec5436e415900028f5827 (fast-forward)
Range: 2 commit(s), 11 file(s); PRs: #2268 #2269
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T140334Z
vite build: built in 36.05s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 26
/health at 2026-09-29T14:04:41Z: {"status":"healthy","timestamp":"2026-09-29T14:04:41.372Z","uptime":6.103197277,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 14:04:40 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 14:04:48 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 14:04:52 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 3787ms
  1|episode- | 2026-09-29 14:04:52 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 14:04:52 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor e93de3d5 9f1abfd9 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BX ends at `e93de3d5` (BX record §1 and §8), and that is where
this deploy starts.

## §2. The range — MEASURED

```
$ git rev-list --count e93de3d5..9f1abfd9
2
$ git log --oneline e93de3d5..9f1abfd9
9f1abfd9d feat(money): D1 reconciliation apply action, per approved show (D1 PR 5) [skip-automerge] (#2269)
6bc934deb feat(money): deleted episodes no longer affect Lala's balance (§8(aa) M6) [skip-automerge] (#2268)
$ git diff --shortstat e93de3d5 9f1abfd9
 11 files changed, 539 insertions(+), 7 deletions(-)
$ git diff --name-only e93de3d5 9f1abfd9
docs/EVENT_EPISODE_FLOW.md
src/app.js
src/config/d1ReconciliationApprovals.js
src/routes/coinReconciliationRoutes.js
src/services/coinLedgerSync.js
src/services/coinReconciliation.js
src/services/financialTransactionService.js
src/utils/ledgerBalanceFilter.js
tests/integration/coinLedgerSync.integration.test.js
tests/integration/coinReconciliation.integration.test.js
tests/unit/config/d1ReconciliationApprovals.test.js
$ git diff --name-only e93de3d5 9f1abfd9 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 2 commits, 11 files, the same two PRs, and no
migration or package change.

The runtime files are backend only: `app.js`,
`d1ReconciliationApprovals.js`, `coinReconciliationRoutes.js`,
`coinLedgerSync.js`, `coinReconciliation.js`,
`financialTransactionService.js` and `ledgerBalanceFilter.js`. No frontend
file is in the range; the frontend was rebuilt from an unchanged source.
The rest are tests and a living doc.

## §3. The time

**ATTESTED.** The backup is stamped 14:03:34Z. `Ready to accept requests` is
at 14:04:40. `/health` answered at 14:04:41Z with an uptime of 6.1 s.

**MEASURED.** The newest commit in the range is #2269, at 14:02:14 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" e93de3d5..9f1abfd9 | head -1
9f1abfd9d 2026-09-29T10:02:14-04:00 feat(money): D1 reconciliation apply action, per approved show (D1 PR 5) [skip-automerge] (#2269)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 of 220 migrations pending, exit 0, and Evoni confirmed
the database.

**MEASURED.** The range adds no migration (§2). The tree holds 220 migration
files: `git ls-tree -r --name-only 9f1abfd9 src/migrations | grep -c '\.js$'`
returns `220`.

## §5. What went live — MEASURED

- **#2268 (`6bc934de`), Task #2267, §8(aa) M6.**
  - `countedLedgerRows` (`src/utils/ledgerBalanceFilter.js`) excludes ledger
    rows whose `episode_id` names no live episode (soft-deleted or gone).
    Rows with no episode still count. `getCurrentBalance` and
    `syncCoinsFromLedger` sum only the rows it counts.
  - The rows themselves stay, as history.
- **#2269 (`9f1abfd9`), Task #2250, D1 PR 5.**
  - `POST /api/v1/admin/coins/reconcile` (`coinReconciliationRoutes.js`,
    `requireAuth` + `authorize(['ADMIN'])`), backed by
    `applyReconciliation` (`coinReconciliation.js`).
  - It applies only the checked-in approvals
    (`d1ReconciliationApprovals.js`): show `9bd0655f-…` at 1900, with the
    four test wardrobe purchases voided (the reconciliation register note
    §3–§4).
  - It dry-runs by default. A real apply needs
    `confirm: 'apply-d1-approvals'`. It voids by status and metadata,
    deletes nothing, and refuses unless the ledger then sums to exactly the
    approved balance.

**Not in this tree.** D1 PR 2 (#2255) is not live at BY; Deploy BZ carries
it. D1 PRs 3–4 are not built.

**CANNOT-TELL:** whether the dry run or the apply has been run. Nothing in
the summary reports it, and this record does not investigate production.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, the same as at BX.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The
restart count is now 26, one past BX's 25 (BX record §6).
`ANTHROPIC_API_KEY` count 1 (value not read). `episode-worker` is not
reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BY, production's tree was `9f1abfd9`:

```
$ git log -1 --format='%H %s' 9f1abfd9
9f1abfd9d86eedfe998ec5436e415900028f5827 feat(money): D1 reconciliation apply action, per approved show (D1 PR 5) [skip-automerge] (#2269)
```

It was not `origin/main` for long: Deploy BZ followed within the hour (BZ
record).

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It records no reconciliation result. The dry run and the apply are
  Evoni's.
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

- **Continuity:** the tree agrees with the summary (2 commits, 11 files, no
  migration, no package change), with no gap after BX. Production reached
  `9f1abfd9`, and BZ then moved it on.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 26.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **Reconciliation:** the apply action is live; whether it has run is
  CANNOT-TELL.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
