| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CE, 2026-09-29, backend and frontend, one plain restart, no migration. Evoni ran it herself with `scripts/deploy-prod.sh`, outside any agent session. Five changes go live: T6 (Regenerate keeps the replaced episode's task list), T7 (wardrobe-list completion comes from the outfit), the paid-bonus gate (#2315) and `opportunity_id` on scheduled Opportunity events (#2316), plus the deal design note, which is docs only. Production reaches origin/main. The CFO's dependency count rose from 14 to 15 with no package change.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_CD.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `8e210132e473104c1bf5f3c2ea8945d4812ea839` (#2316),
read 2026-09-29. This is the tree Deploy CE moved production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: the script's summary, as Evoni pasted it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email, password, hostname, IP address, key path,
account number or ARN. The database host is `[host hidden]`, as Evoni
pasted it.

**The letter.** This deploy is lettered **CE**. It follows CD
(`F-Deploy-1_Deploy_2026-09-29_CD.md`), the register's last deploy record.

## §0. Evoni's account, as given

**ATTESTED.** The CE summary, as Evoni pasted it on 2026-09-29:

```
CE summary (Evoni, 2026-09-29, via scripts/deploy-prod.sh):
Tree: f90af0b6563866232e9554e3222bbbe3335bb459 -> 8e210132e473104c1bf5f3c2ea8945d4812ea839 (fast-forward)
Range: 6 commit(s), 19 file(s); PRs: #2308 #2309 #2311 #2312 #2315 #2316
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260929T215757Z
vite build: built in 34.34s
Pending: [host hidden]/episode_metadata as episode_app_dev — 0 pending of 221 (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 33
/health 2026-09-29T21:58:56Z: healthy, database connected, uptime 6.1s. Ready 21:58:55.
CFO 21:59:03–21:59:07: 84/100, 1 critical, 4 warnings; → [dependency_audit] 15 critical/high security vulnerabilities found (was 14 at CD).
App check: not supplied.
```

**This summary is shorter than CD's.** The `/health` JSON, the Ready line
and the CFO log lines are given in summary form, not verbatim. They are
recorded as given.

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor f90af0b6 8e210132 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CD ends at `f90af0b6` (CD record §1 and §8), and that is where
this deploy starts.

**The restart count is continuous (ATTESTED):** CD left it at 32 (CD
record §6), and CE's single restart brings it to 33.

## §2. The range — MEASURED

```
$ git rev-list --count f90af0b6..8e210132
6
$ git log --oneline f90af0b6..8e210132
8e210132e fix(events): scheduleOpportunityAsEvent writes opportunity_id on the event [skip-automerge] (#2316)
41e72813a fix(money): Complete gates the paid bonus on the normalised entry cost [skip-automerge] (#2315)
689a86e93 docs(deals): deal design note [skip-automerge] (#2312)
ea378395f docs(audit): deploy record CD [skip-automerge] (#2311)
6a0947b54 fix(tasks): wardrobe-list completion comes from the outfit, no manual toggle (T7) [skip-automerge] (#2309)
31e6e5d9b fix(tasks): Regenerate starts from the replaced episode's task list (T6) [skip-automerge] (#2308)
$ git diff --shortstat f90af0b6 8e210132
 19 files changed, 1350 insertions(+), 49 deletions(-)
$ git diff --name-only f90af0b6 8e210132
docs/DEAL_DESIGN.md
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_CD.md
frontend/src/pages/EpisodeTodoPage.jsx
frontend/src/pages/EpisodeTodoPage.wardrobeDerived.test.jsx
src/routes/todoListRoutes.js
src/services/episodeCompletionService.js
src/services/episodeGeneratorService.js
src/services/feedEventPipelineService.js
src/services/financialTransactionService.js
src/services/todoListService.js
src/utils/paidFreeFlags.js
src/utils/socialTaskSource.js
tests/integration/paidBonusNormalisedGate.integration.test.js
tests/integration/regenerateKeepsTaskList.integration.test.js
tests/integration/wardrobeCompletionDerived.integration.test.js
tests/unit/services/feedEventPipelineService.scheduleDraft.test.js
tests/unit/services/feedEventPipelineService.scheduleOpportunityAsEvent.test.js
tests/unit/utils/socialTaskSource.test.js
$ git diff --name-only f90af0b6 8e210132 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 6 commits, 19 files, the same six PRs, and no
migration or package change.

The runtime files are:
- **backend:** `todoListRoutes.js`, `episodeCompletionService.js`,
  `episodeGeneratorService.js`, `feedEventPipelineService.js`,
  `financialTransactionService.js`, `todoListService.js`, and two utils:
  `paidFreeFlags.js` (new) and `socialTaskSource.js`;
- **frontend:** `EpisodeTodoPage.jsx`.

The rest are tests, two living docs and one register document (CD).

## §3. The time

**ATTESTED.** The backup is stamped 21:57:57Z, and the app was ready at
21:58:55. `/health` answered at 21:58:56Z with an uptime of 6.1 s.

**MEASURED.** The newest commit in the range is #2316, at 21:51:45 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" f90af0b6..8e210132 | head -1
8e210132e 2026-09-29T17:51:45-04:00 fix(events): scheduleOpportunityAsEvent writes opportunity_id on the event [skip-automerge] (#2316)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 of 221 migrations pending, exit 0, and Evoni confirmed
the database.

**MEASURED.** The range adds no migration (§2). The tree holds 221 migration
files: `git ls-tree -r --name-only 8e210132 src/migrations | grep -c '\.js$'`
returns `221`, the same as CD.

## §5. What went live — MEASURED

- **#2308 (`31e6e5d9`), Task #2306: T6 (§8(bb)).**
  - Regenerate starts from the replaced episode's task list as it stands,
    keeping its edits and completion flags.
  - It adds any required deliverable task that the event's accepted terms
    include and the list lacks (`withMissingRequiredDeliverables`).
  - It restores no deleted goal or idea and generates none.
- **#2309 (`6a0947b5`), Task #2307: T7 (§8(bb)).**
  - A wardrobe-list task's completion comes from the outfit, and rejected
    pieces do not count.
  - `complete/:slot` answers 409 `WARDROBE_COMPLETION_DERIVED` for a
    wardrobe slot.
  - The Run Sheet's wardrobe rows are read-only.
- **#2315 (`41e72813`), Task #2313: the paid-bonus gate.**
  - Complete now books `tier_paid_bonus` only when the normalised entry
    cost is above 0 (`normalizePaidFreeFlags`, now in
    `src/utils/paidFreeFlags.js`), matching the forecast.
  - A paid event with `cost_coins > 0` no longer gets the bonus.
- **#2316 (`8e210132`), Task #2314.**
  - `scheduleOpportunityAsEvent` writes `world_events.opportunity_id`.
- **Docs and register only:**
  - #2312: `docs/DEAL_DESIGN.md`, the deal design note;
  - #2311: deploy record CD.

**Not in this tree.** None of the following is merged at filing:
- the career-tier fix (Task #2317, PR #2320);
- the deal answers, §8(cc) (Task #2318);
- deal build PR 1, the schema (Task #2319).

## §6. Restarts

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 33.
- `ANTHROPIC_API_KEY` count 1 (value not read).
- `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy CE, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
8e210132e473104c1bf5f3c2ea8945d4812ea839 2026-09-29 fix(events): scheduleOpportunityAsEvent writes opportunity_id on the event [skip-automerge] (#2316)
$ git rev-parse --is-shallow-repository
false
```

## §9. The dependency count, 14 → 15

**ATTESTED (§0; CD record §0).** The CFO's `dependency_audit` reported 14
critical/high vulnerabilities at CD and 15 at CE. The score is 84/100 at
both.

**MEASURED.** No package file changed between CD's tree and CE's tree. The
root lockfile last changed at #1873, on 2026-09-25:

```
$ git diff --quiet f90af0b6 8e210132 -- package.json package-lock.json && echo "root package files unchanged CD->CE"
root package files unchanged CD->CE
$ git log -1 --format='%h %cI %s' -- package-lock.json
a2e83b8f1 2026-09-25T10:37:09-04:00 ci: the schema-agreement check runs as a ratchet [skip-automerge] (#1873)
```

**MEASURED: what the count is.** `dependencyAudit` in
`src/services/cfoAgent.js` runs `npm audit --json` in the repository root
and adds `critical` and `high` from `metadata.vulnerabilities`. It does not
audit `frontend/`.

In this session, the root audit restricted to production dependencies gives
exactly 15:

```
$ npm audit --omit=dev --json   # root; npm 10.9.7, node v22.22.2, 2026-09-29 ~22:00Z
{"info":0,"low":1,"moderate":8,"high":15,"critical":0,"total":24}   critical+high = 15
```

Without `--omit=dev` the same root audit gives 20.

**INFERRED.** Production's count equals the root production-only audit.
This is consistent with npm omitting dev dependencies when
`NODE_ENV=production`, but the production command was not observed.

**INFERRED.** The rise from 14 to 15 is a new advisory against a package
already in the lockfile, not a code change: the lockfile did not change, and
npm audit reads the live advisory database. The findings are listed in the
dependency-audit task, not here (§10).

## §10. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding beyond identifying what the count measures
  (§9).
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §11. Tails — re-derived, not carried

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

- **Continuity:** the tree agrees with the summary (6 commits, 19 files, no
  migration, no package change), with no gap after CD. Production is at
  `origin/main`, `8e210132`.
- **Deploy:** 0 pending of 221; `/health` healthy and connected; restart
  count 33.
- **CFO:** 84/100, 1 critical, 4 warnings. The dependency count is 15 (it
  was 14), with no package change (§9).
- **Live here:** T6, T7, the paid-bonus gate and `opportunity_id` on
  scheduled Opportunity events.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
