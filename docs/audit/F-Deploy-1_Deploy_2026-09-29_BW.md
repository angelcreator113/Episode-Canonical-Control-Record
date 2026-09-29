| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BW, 2026-09-29, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. The fix for D2's milestone and feed-post regression goes live (#2254), with D1 PR 1's ledger helpers (not yet called) and whole-coin rounding at the ledger; production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_BV.md`, whose deploy this one
follows. This document edits no filed document.

Basis: `origin/main` at `ff38e0c9fd9722ff69132374be3848109c09c449` (#2254),
read 2026-09-29, the tree Deploy BW moved production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED** covers the script's summary block as Evoni pasted it.
- **MEASURED** covers what this repository shows, with output pasted.
- **INFERRED** is marked where used.

Nothing is upgraded. This document closes no keystone, discharges no owed
item, mints no FD, XK or PE number, and rules on nothing.

It records no token, email, password, hostname, IP address, key path, account
number or ARN.

**The letter.** This deploy is lettered **BW**. BV ends at `faf81971` (BV
record §1, §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-29):**

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: faf81971c16e93a6b38a7ab187c35a98036a5613 -> ff38e0c9fd9722ff69132374be3848109c09c449 (fast-forward)
Range: 7 commit(s), 11 file(s); PRs: #2237 #2239 #2241 #2243 #2245 #2251 #2254
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T122948Z
vite build: built in 38.30s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 24
/health at 2026-09-29T12:30:54Z: {"status":"healthy","timestamp":"2026-09-29T12:30:53.984Z","uptime":6.188661384,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 12:30:53 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 12:31:01 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 12:31:07 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 5902ms
  1|episode- | 2026-09-29 12:31:07 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 12:31:07 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor faf81971 ff38e0c9 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BV ends at `faf81971` (BV record §1, §8), which is this deploy's
start.

## §2. The range — MEASURED

```
$ git rev-list --count faf81971..ff38e0c9
7
$ git log --oneline faf81971..ff38e0c9
ff38e0c9f fix(money): milestone payouts book, and feed posts no longer abort finalize's transaction [skip-automerge] (#2254)
e78643304 feat(money): coinLedgerSync, character_state.coins recomputed from the ledger (D1 PR 1) [skip-automerge] (#2251)
8e2e129fc docs: record §8(y) Prime Coins rulings Q1–Q9 and doctrine [skip-automerge] (#2245)
b4926262e docs: D1 design note, character_state.coins as a cached copy of the ledger [skip-automerge] (#2243)
1d57bf2c4 docs(audit): F-Reg-2 Fix Plan v1.3 [skip-automerge] (#2241)
656252dcf docs(audit): register note on money-path rulings D1–D3 [skip-automerge] (#2239)
4b2b1e7c0 docs(audit): deploy record BV [skip-automerge] (#2237)
$ git diff --shortstat faf81971 ff38e0c9
 11 files changed, 1854 insertions(+), 14 deletions(-)
$ git diff --name-only faf81971 ff38e0c9
docs/COINS_LEDGER_CACHE_DESIGN.md
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_BV.md
docs/audit/F-Reg-2_Fix_Plan_v1.3.md
docs/audit/F-Stats-1_MoneyPath_Rulings_Note_2026-09-29.md
src/services/coinLedgerSync.js
src/services/financialTransactionService.js
src/utils/wholeCoins.js
tests/integration/coinLedgerSync.integration.test.js
tests/integration/milestonePayout.integration.test.js
tests/unit/services/coinLedgerSync.test.js
$ git diff --name-only faf81971 ff38e0c9 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 7 commits, 11 files, the same seven PRs, and no
migration or package change.

The runtime files are all backend:
- `financialTransactionService.js`;
- `coinLedgerSync.js` (new);
- `wholeCoins.js` (new).

The rest are tests, living docs and register records.

## §3. The time

**ATTESTED.** The backup is stamped 12:29:48Z. `Ready to accept requests` is
at 12:30:53, and `/health` answered at 12:30:54Z with uptime 6.2 s.

**MEASURED.** The newest commit in the range is #2254, at 12:21:30 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" faf81971..ff38e0c9 | head -1
ff38e0c9f 2026-09-29T08:21:30-04:00 fix(money): milestone payouts book, and feed posts no longer abort finalize's transaction [skip-automerge] (#2254)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0, and Evoni confirmed the
database.

**MEASURED.** The range adds no migration (§2), and the tree holds 220
migration files (`ls src/migrations/*.js | wc -l` → `220`).

## §5. What went live — MEASURED

- **#2254 (`ff38e0c9`), Task #2252.** Two faults in the tail of
  `finalizeEpisodeFinancials`. D2 (#2236, live since BV) made both fatal.
  - **Milestone payouts.** `checkMilestones` wrote the goal's slug id into
    `financial_transactions.source_id`, a uuid column.
    - Before D2, the payout was silently never booked, while the goal was
      still marked reached.
    - From BV, the failure aborted the finalize.
    - Now the id is kept in `metadata.goal_id`, and `source_id` is set only
      for a uuid id.
  - **Feed posts.** The milestone and big-spend posts (≥ 2000) ran inside the
    money transaction. `resolveLalaProfile` queries `social_profiles.show_id`,
    which the canon capture does not have, and swallows the error, leaving
    the transaction aborted.
    - From BV, a standalone finalize with a milestone or big spend committed
      nothing while reporting success, and Complete failed with a 500.
    - The posts now run after commit, on an ordinary connection, as before D2.
- **#2251 (`e7864330`), Task #2246, D1 PR 1.**
  - `coinLedgerSync.js` (`syncCoinsFromLedger`, `spendFromLedger`) is **not
    called by any route at this tree**.
  - Two changes are live:
    - `logTransaction` and finalize's `addTx` book whole coins, rounded half
      away from zero (§8(y) Q7).
    - `seedStartingBalance` accepts a transaction. Without one it behaves as
      before.
- **Docs and register only, with no runtime effect:**
  - #2237: deploy record BV.
  - #2239: F-Stats-1 money-path rulings note.
  - #2241: F-Reg-2 Fix Plan v1.3.
  - #2243: the D1 design note.
  - #2245: §8(y), the Prime Coins rulings.

**INFERRED, from the code at this tree.** From BW, milestone payouts are
booked to the ledger for the first time. `completeEpisode` still moves
`character_state.coins` by `coinDeltaFrom`, which leaves them out, as it
leaves out `event_reward`. So each payout widens the gap between the two
balances until D1 PR 2 (#2255, held until the reconciliation is applied) is
deployed. The reconciliation's approval list takes this into account
(#2250).

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, as at BV.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The count
is now 24, one past BV's 23 (BV record §6). `ANTHROPIC_API_KEY` count 1
(value not read). `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BW, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
ff38e0c9fd9722ff69132374be3848109c09c449 2026-09-29 fix(money): milestone payouts book, and feed posts no longer abort finalize's transaction [skip-automerge] (#2254)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It records no result of the post-deploy money check owed since BV (the
  F-Stats-1 register note §4). That result goes on the BV record as a banner
  when Evoni supplies it.
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

- **Continuity:** the tree agrees with the summary (7 commits, 11 files, no
  migration, no package change), with no gap after BV. Production is at
  `origin/main`, `ff38e0c9`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 24.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
