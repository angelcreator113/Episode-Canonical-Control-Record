| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CB, 2026-09-29, backend and frontend, one plain restart, no migration. Evoni ran it herself with `scripts/deploy-prod.sh`, outside any agent session. Episode-delete coin sync, Episode Money Phase A, the script writer's ledger balance, the `?tab=` sub-tab fix, and T1/T8 (required tasks only from deliverables) go live. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_CA.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `7c0b160680c9b0ff4c66bac65ccf2bc3c17df38f` (#2293),
read 2026-09-29. This is the tree Deploy CB moved production to (§8).

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

**The letter.** This deploy is lettered **CB**. It follows CA
(`F-Deploy-1_Deploy_2026-09-29_CA.md`), the register's last deploy record.

## §0. Evoni's account, as given

**ATTESTED.** The summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it on 2026-09-29:

```
Deploy (Evoni, 2026-09-29, via scripts/deploy-prod.sh)
Tree: 784a2edad1370d444ccb66ac8d083ecfa1652f37 -> 7c0b160680c9b0ff4c66bac65ccf2bc3c17df38f (fast-forward)
Range: 7 commit(s), 42 file(s); PRs: #2283 #2285 #2286 #2287 #2290 #2291 #2293
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T190104Z
vite build: built in 33.37s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 30
/health at 2026-09-29T19:02:10Z: {"status":"healthy","timestamp":"2026-09-29T19:02:10.064Z","uptime":9.091428775,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-29 19:02:08 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-29 19:02:16 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-29 19:02:20 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4654ms
  1|episode- | 2026-09-29 19:02:20 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-29 19:02:20 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 784a2eda 7c0b1606 && echo "ancestor: yes"
ancestor: yes
$ git merge-base --is-ancestor 4e8a94bb 784a2eda && echo "CA end ancestor of CB start: yes"
CA end ancestor of CB start: yes
```

**A step with no record.** CA ends at `4e8a94bb` (CA record §1 and §8). CB
starts at `784a2eda`. The step between them is one commit, docs only:

```
$ git log --oneline 4e8a94bb..784a2eda
784a2edad docs(audit): deploy record CA [skip-automerge] (#2281)
$ git diff --name-only 4e8a94bb 784a2eda
docs/audit/F-Deploy-1_Deploy_2026-09-29_CA.md
$ grep -rln "784a2eda" docs/audit/
docs/audit/F-Deploy-1_Deploy_2026-09-29_CA.md
docs/audit/F-Stats-1_D1_Closing_Note_2026-09-29.md
```

Neither file that names `784a2eda` records a deploy to it. The CA file names
it in its banner as the commit its body merged at. The closing note names it
as its basis.
- **ATTESTED (§0) and CA §6:** the restart count went from 28 at CA to 30
  here. That is two restarts, and CB accounts for one.
- **INFERRED:** production was moved from `4e8a94bb` to `784a2eda`, with one
  restart, between CA and CB, and no deploy record was filed for it. The
  step carries no runtime file, so it changed nothing the app runs.
- **CANNOT-TELL:** how or when production reached `784a2eda`, or what the
  extra restart was. This record does not investigate the host. Only Evoni
  can supply that account; if she does, it belongs in a record of its own
  or a banner here.

## §2. The range — MEASURED

```
$ git rev-list --count 784a2eda..7c0b1606
7
$ git log --oneline 784a2eda..7c0b1606
7c0b16068 fix(tasks): only accepted deliverables make a social task required (T1, T8) [skip-automerge] (#2293)
319ea6426 fix(script): the writer's money context reads the ledger in Prime Coins [skip-automerge] (#2290)
51efae934 fix(world-admin): ?tab=<main tab> opens a sub-tab [skip-automerge] (#2291)
1978f2b27 feat(money): Episode Money Phase A, read-only, from the ledger [skip-automerge] (#2287)
2b5250665 fix(coins): episode delete and restore sync coins (M6) [skip-automerge] (#2286)
0d883491c docs(audit): D1 closed; CA app check recorded [skip-automerge] (#2285)
d667f89c4 docs(audit): D1 closing note [skip-automerge] (#2283)
$ git diff --shortstat 784a2eda 7c0b1606
 42 files changed, 2368 insertions(+), 127 deletions(-)
$ git diff --name-only 784a2eda 7c0b1606
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_CA.md
docs/audit/F-Stats-1_D1_Closed_Ruling_2026-09-29.md
docs/audit/F-Stats-1_D1_Closing_Note_2026-09-29.md
frontend/src/components/EpisodeTasksPanel.jsx
frontend/src/components/Episodes/EpisodeMoneyTab.css
frontend/src/components/Episodes/EpisodeMoneyTab.jsx
frontend/src/components/Episodes/EpisodeMoneyTab.test.jsx
frontend/src/components/Episodes/EpisodeTodoList.jsx
frontend/src/components/OverlayApprovalPanel.jsx
frontend/src/components/SocialTaskBadge.css
frontend/src/components/SocialTaskBadge.jsx
frontend/src/pages/EpisodeDetail.css
frontend/src/pages/EpisodeDetail.jsx
frontend/src/pages/EpisodeDetail.money.test.jsx
frontend/src/pages/EpisodeTodoPage.jsx
frontend/src/pages/WorldAdmin.episodeLedgerMoney.test.jsx
frontend/src/pages/WorldAdmin.episodeLedgerTaskSource.test.jsx
frontend/src/pages/WorldAdmin.jsx
frontend/src/pages/WorldAdmin.tabSubtab.test.jsx
frontend/src/utils/socialTaskSource.js
src/controllers/episodeController.js
src/models/Episode.js
src/routes/todoListRoutes.js
src/routes/worldEvents.js
src/services/coinLedgerSync.js
src/services/episodeCompletionService.js
src/services/episodeGeneratorService.js
src/services/episodeMoneyService.js
src/services/episodeScriptWriterService.js
src/services/financialTransactionService.js
src/services/socialChecklistService.js
src/services/todoListService.js
src/utils/socialTaskSource.js
tests/integration/episodeDeleteSyncsCoins.integration.test.js
tests/integration/episodeMoney.integration.test.js
tests/integration/scriptWriterLedgerBalance.integration.test.js
tests/integration/socialTasksRequiredFromDeliverables.integration.test.js
tests/unit/routes/world-cluster-tier-promotion.test.js
tests/unit/services/episodeCompletionService.socialStress.test.js
tests/unit/services/eventOrganizer.readers.test.js
tests/unit/utils/socialTaskSource.test.js
$ git diff --name-only 784a2eda 7c0b1606 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

The measured range matches the summary: 7 commits, 42 files, the same seven PRs, and no
migration or package change.

The runtime files are:
- **backend:**
  - `episodeController.js`, `Episode.js`;
  - `todoListRoutes.js`, `worldEvents.js`;
  - `coinLedgerSync.js`, `episodeCompletionService.js`, `episodeGeneratorService.js`, `episodeMoneyService.js` (new), `episodeScriptWriterService.js`, `financialTransactionService.js`, `socialChecklistService.js`, `todoListService.js`;
  - `src/utils/socialTaskSource.js` (new);
- **frontend:**
  - `EpisodeTasksPanel.jsx`, `EpisodeMoneyTab.jsx` and its CSS (new), `EpisodeTodoList.jsx`, `OverlayApprovalPanel.jsx`, `SocialTaskBadge.jsx` and its CSS (new);
  - `EpisodeDetail.jsx` and its CSS, `EpisodeTodoPage.jsx`, `WorldAdmin.jsx`;
  - `frontend/src/utils/socialTaskSource.js` (new).

The rest are tests, one living doc (`docs/EVENT_EPISODE_FLOW.md`) and three
register documents.

## §3. The time

**ATTESTED.** The backup is stamped 19:01:04Z. `Ready to accept requests` is
at 19:02:08. `/health` answered at 19:02:10Z with an uptime of 9.1 s.

**MEASURED.** The newest commit in the range is #2293, at 18:46:17 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 784a2eda..7c0b1606 | head -1
7c0b16068 2026-09-29T14:46:17-04:00 fix(tasks): only accepted deliverables make a social task required (T1, T8) [skip-automerge] (#2293)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 of 220 migrations pending, exit 0, and Evoni confirmed
the database.

**MEASURED.** The range adds no migration (§2). The tree holds 220 migration
files: `git ls-tree -r --name-only 7c0b1606 src/migrations | grep -c '\.js$'`
returns `220`.

## §5. What went live — MEASURED

- **#2286 (`2b525066`), Task #2284: deleting or restoring an episode syncs
  Lala's coins (§8(aa) M6).**
  - `Episode.softDelete` and `restore` set `deleted_at` inside a
    transaction and call `syncCoinsAfterEpisodeChange` (`coinLedgerSync.js`).
  - The hard delete in `episodeController.js` and the supersede in
    `episodeGeneratorService.js` do the same.
  - A deleted episode's ledger rows stop counting, and the cached coins
    follow in the same transaction.
- **#2287 (`1978f2b2`), Task #2278: Episode Money Phase A.** Read-only, from
  the ledger.
  - A new route, `GET /world/:showId/episodes/:episodeId/money`
    (`getEpisodeMoney`, `episodeMoneyService.js`), and a Money sub-tab on
    Episode Detail (`EpisodeMoneyTab`).
  - A balance chip on Episode Detail.
  - The Episode Ledger's totals and per-episode P&L in WorldAdmin now read
    `/financial-summary`'s `by_episode` instead of the `episodes.total_*`
    columns (§8(aa) M4).
- **#2290 (`319ea642`), Task #2288:** the script writer's money context
  reads the ledger. Its section 4 uses `getCurrentBalance` and the episode's
  counted ledger rows, stated in Prime Coins.
- **#2291 (`51efae93`), Task #2289:** WorldAdmin's `?tab=<main tab>` also
  opens that tab's first sub-tab, so `?tab=episodes` lands on the Episode
  Ledger.
- **#2293 (`7c0b1606`), Task #2292: T1 and T8 (§8(bb)).**
  - **T1:** only an accepted deliverable (an `event_deliverables` row) makes
    a social task required. Generated tasks are goals or optional ideas, and
    the automatic "Sponsored Post 1/2 (required)" is removed.
  - Stored episodes keep their tasks. Every display labels each task's
    source and shows "required" only when a deliverable is behind it
    (`SocialTaskBadge`).
  - **T8:** `computeSocialTaskBonuses` counts a task as required only when
    it has a `deliverable_id`. An older `required: true` alone no longer
    changes Lala's stress.
- **Docs and register only, with no runtime effect:** #2283 (the D1 closing
  note) and #2285 (D1 closed; CA app check recorded). #2293 also records T8
  verbatim in `docs/EVENT_EPISODE_FLOW.md` §8(bb).

**Not in this tree.** T2 (one task list, #2294) is not in the range. It
carries a migration, `20260929190000-add-event-deliverables-owed-to.js`,
which is not at `7c0b1606`. The 220 files in §4 do not include it.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, the same as at CA.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The
restart count is now 30, two past CA's 28 (CA record §6); §1 covers the
unrecorded step. `ANTHROPIC_API_KEY` count 1 (value not read).
`episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy CB, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
7c0b160680c9b0ff4c66bac65ccf2bc3c17df38f 2026-09-29 fix(tasks): only accepted deliverables make a social task required (T1, T8) [skip-automerge] (#2293)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It does not investigate the unrecorded step in §1.
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

- **Continuity:** the tree matches the summary (7 commits, 42 files, no
  migration, no package change). Production is at `origin/main`,
  `7c0b1606`.
- **Gap:** one docs-only step, `4e8a94bb` → `784a2eda` (#2281), has no
  deploy record. The restart count suggests one unrecorded restart
  (INFERRED, §1).
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 30.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **Live here:** episode-delete coin sync (M6), Episode Money Phase A (M4),
  the script writer's ledger balance, the `?tab=` sub-tab fix, and T1/T8.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
