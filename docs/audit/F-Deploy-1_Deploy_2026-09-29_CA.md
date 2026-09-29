| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CA, 2026-09-29, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. D1 PRs 3 and 4 go live: the wardrobe spends, the manual edit, the admin reset and the seed paths go through the ledger. Every balance display reads the ledger. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_BZ.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `4e8a94bbdf0ca8db70968d7fc1517188d812e2d5` (#2280),
read 2026-09-29. This is the tree Deploy CA moved production to (§8).

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
account number or ARN. The shell prompt after the pasted block named the
host, so it is not reproduced.

**The letter.** This deploy is lettered **CA**. The register went from AZ
to BA (`F-Deploy-1_Deploy_2026-09-27_AZ.md`, `…_BA.md`), so CA follows BZ.
BZ ends at `8257ed53` (BZ record §1 and §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED.** The summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it on 2026-09-29:

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: 8257ed538d0690433e2167c63c6aeef7cd5423ca -> 4e8a94bbdf0ca8db70968d7fc1517188d812e2d5 (fast-forward)
Range: 6 commit(s), 23 file(s); PRs: #2274 #2275 #2276 #2277 #2279 #2280
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T162021Z
vite build: built in 32.57s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 28
/health at 2026-09-29T16:21:30Z: {"status":"healthy","timestamp":"2026-09-29T16:21:30.541Z","uptime":6.271453166,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 16:21:30 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 16:21:38 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 16:21:42 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4709ms
  1|episode- | 2026-09-29 16:21:42 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 16:21:42 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 8257ed53 4e8a94bb && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BZ ends at `8257ed53` (BZ record §1 and §8), and that is where
this deploy starts.

## §2. The range — MEASURED

```
$ git rev-list --count 8257ed53..4e8a94bb
6
$ git log --oneline 8257ed53..4e8a94bb
4e8a94bbd feat(money): manual edit, admin reset and seeding go through the ledger (D1 PR 4) [skip-automerge] (#2280)
27fe77916 feat(money): wardrobe spends go through the ledger (D1 PR 3) [skip-automerge] (#2279)
33fedf27c fix(coins): every balance display reads the ledger [skip-automerge] (#2277)
e79b1a67e fix(episodes): Tasks & Details toggle collapses [skip-automerge] (#2276)
e1e31695d docs(audit): register note on D1's reconciliation apply [skip-automerge] (#2275)
5a3614e7a docs(audit): deploy records BY and BZ [skip-automerge] (#2274)
$ git diff --shortstat 8257ed53 4e8a94bb
 23 files changed, 2039 insertions(+), 323 deletions(-)
$ git diff --name-only 8257ed53 4e8a94bb
docs/audit/F-Deploy-1_Deploy_2026-09-29_BY.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_BZ.md
docs/audit/F-Stats-1_D1_ReconciliationApplied_2026-09-29.md
frontend/src/components/EpisodeTasksPanel.jsx
frontend/src/components/EpisodeTasksPanel.test.jsx
frontend/src/components/EpisodeWardrobeGameplay.jsx
frontend/src/components/Episodes/EpisodeOverviewTab.jsx
frontend/src/components/Show/ShowInsightsTab.jsx
frontend/src/pages/ShowSettings.jsx
frontend/src/pages/ShowSettings.resetStats.test.jsx
frontend/src/pages/WorldAdmin.jsx
src/routes/evaluation.js
src/routes/shows.js
src/routes/wardrobe.js
src/routes/wardrobeEventRoutes.js
src/routes/worldEvents.js
src/services/episodeCompletionService.js
src/services/financialTransactionService.js
tests/integration/balanceDisplays.integration.test.js
tests/integration/manualEditSeeding.integration.test.js
tests/integration/wardrobeLedgerSpends.integration.test.js
tests/unit/routes/coin-spend-guard.test.js
tests/unit/routes/wardrobe-styling-reach.test.js
$ git diff --name-only 8257ed53 4e8a94bb -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 6 commits, 23 files, the same six PRs, and no
migration or package change.

The runtime files are:
- backend: `evaluation.js`, `shows.js`, `wardrobe.js`,
  `wardrobeEventRoutes.js`, `worldEvents.js`, `episodeCompletionService.js`,
  `financialTransactionService.js`;
- frontend: `EpisodeTasksPanel.jsx`, `EpisodeWardrobeGameplay.jsx`,
  `EpisodeOverviewTab.jsx`, `ShowInsightsTab.jsx`, `ShowSettings.jsx`,
  `WorldAdmin.jsx`.

The rest are tests and three register documents.

## §3. The time

**ATTESTED.** The backup is stamped 16:20:21Z. `Ready to accept requests` is
at 16:21:30. `/health` answered at 16:21:30Z with an uptime of 6.3 s.

**MEASURED.** The newest commit in the range is #2280, at 16:13:44 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 8257ed53..4e8a94bb | head -1
4e8a94bbd 2026-09-29T12:13:44-04:00 feat(money): manual edit, admin reset and seeding go through the ledger (D1 PR 4) [skip-automerge] (#2280)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 of 220 migrations pending, exit 0, and Evoni confirmed
the database.

**MEASURED.** The range adds no migration (§2). The tree holds 220 migration
files: `git ls-tree -r --name-only 4e8a94bb src/migrations | grep -c '\.js$'`
returns `220`.

## §5. What went live — MEASURED

- **#2277 (`33fedf27`), Task #2273: every balance display reads the ledger.**
  - Every display of Lala's coins shows `getCurrentBalance`, the counted
    ledger (§8(aa) M6), in whole coins. `GET /characters/lala/state` and the
    next-event suggestions report it instead of `character_state.coins`.
  - The finance summary, breakdowns and financial ledger totals count only
    rows that count; the ledger marks each row `counted`.
  - Two fixes on the way: `/financial-summary` no longer fails for a show
    with an episode, and `GET /events/next-suggestions` is no longer
    swallowed by `/events/:eventId`.
- **#2279 (`27fe7791`), Task #2248, D1 PR 3: the wardrobe spends.**
  - `/select`, `/lock-outfit-atomic` and `/purchase` check the ledger under
    the show lock, book their rows and sync the cached coins, in one
    transaction.
  - §8(aa) M3: a spend in an episode records the episode's id.
  - §8(z) Law 4: finalize does not charge again for a piece the ledger shows
    as bought.
- **#2280 (`4e8a94bb`), Task #2249, D1 PR 4: the manual edit, the admin
  reset and seeding.**
  - A Lala coin edit books a `manual_adjustment` against the ledger under
    the lock and syncs. A coin change on any other key is refused (§8(y) Q3).
  - The admin reset leaves coins alone (Q5); ShowSettings' reset no longer
    sends coins 500.
  - A new `lala` row starts at the ledger balance (Q1); a show that does not
    exist gets no row.
- **#2276 (`e79b1a67`), Task #2272:** the Episodes ledger's "Tasks &
  Details" panel opens and closes.
- **Docs and register only, with no runtime effect:** #2274 (deploy records
  BY and BZ) and #2275 (the reconciliation apply note).

**INFERRED, from the code at this tree.** From CA on, every writer of Lala's
coins goes through the ledger and syncs the cache, and every display reads
the ledger. D1 PR 2 went live at BZ and PR 5 at BY (those records).

**Show `9bd0655f-…`.** The reconciliation set its ledger and its cache to
1900 (`F-Stats-1_D1_ReconciliationApplied_2026-09-29.md`).
- INFERRED: if nothing was booked since, every display now shows 1900.
- CANNOT-TELL: whether anything was booked on that show between the apply
  and this deploy. This record does not investigate production.

**Not in this tree.** The Episode Ledger's totals and per-episode P&L still
read the `episodes.total_*` columns; Evoni placed that in Episode Money
Phase A (#2278).

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, the same as at BZ.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The
restart count is now 28, one past BZ's 27 (BZ record §6).
`ANTHROPIC_API_KEY` count 1 (value not read). `episode-worker` is not
reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy CA, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
4e8a94bbdf0ca8db70968d7fc1517188d812e2d5 2026-09-29 feat(money): manual edit, admin reset and seeding go through the ledger (D1 PR 4) [skip-automerge] (#2280)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It records no production balance after the deploy.
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

- **Continuity:** the tree agrees with the summary (6 commits, 23 files, no
  migration, no package change), with no gap after BZ. Production is at
  `origin/main`, `4e8a94bb`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 28.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **D1:** PRs 3 and 4 are live here; with PR 2 (BZ) and PR 5 (BY), every
  coin writer and display in the ledger design goes through the ledger
  (INFERRED, §5).
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
