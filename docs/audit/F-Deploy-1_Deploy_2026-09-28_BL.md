| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BL, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, and the first deploy run with `scripts/deploy-prod.sh`. Event pages show "Waiting for format", calendar-spawned and scheduled events get the creation draft, two AI routes are rate-limited, and manual create keeps its venue, creator and cost.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BK.md` (the BK record, filed as #2147,
`928c47ed`), whose deploy this one follows. This document edits no filed
document. Basis: `c0ebdf1393d66a8260dcf7bd5d2d0016f25e2f4d` (#2162), the tree
Deploy BL moved production to. `origin/main` at filing is `c0ebdf13` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from the script's terminal output. It
  cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows, and register
  documents already merged under `docs/audit/`, read with local `git` on an
  unshallowed clone; the output is pasted.
- **INFERRED** is marked where used (§6) and is not upgraded.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
hostname, IP address, key path, account number or ARN.

**The letter.** This deploy is lettered **BL**. BK ends at `058e04db` (BK
record §1, §8), and this deploy begins there, so there is no gap between them
(§1).

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-28, about 16:27–16:31 UTC, from the output of
`bash /tmp/deploy-prod.sh`):**

- The script was run as a copy taken from `origin/main`
  (`git show origin/main:scripts/deploy-prod.sh > /tmp/deploy-prod.sh`),
  because the box was still at `058e04db` and did not yet carry the script.
  A `git pull` first would have left nothing to deploy.
- Tree: `058e04db` → `c0ebdf13` by fast-forward; 8 commits, 28 files; PRs
  #2147, #2149, #2151, #2153, #2155, #2157, #2159, #2162.
- `git status` before: untracked files only (`Production`, `sed`, three
  `ecosystem.config.js.bak` files, `src/routes/auth.js.bak-2026-08-22`).
- No migration and no package manifest or lockfile in the range.
- Backup: `frontend/dist` → `~/dist-backup-20260928T162742Z`. The vite build
  succeeded in 36.64 s.
- The pending-migration check (the script runs it with `NODE_ENV=production`)
  read database `episode_metadata` as `episode_app_dev` (host hidden by the
  script): 0 pending of 220, exit 0.
- Prompt "Is that the database the API uses?": Evoni answered y.
- `.env`: `ANTHROPIC_API_KEY` count 1 (the value was not read).
- Prompt "Restart now?": Evoni answered y. One plain `pm2 restart` of
  `episode-api-prod-hotfix` (no `--update-env`); the restart count is now
  13. `episode-worker` stopped (the standing state).
- `/health` at 2026-09-28T16:31:08Z: healthy, database connected, uptime
  9.2 s. `Ready to accept requests` at 16:31:06 UTC.
- The CFO scheduled audit, 16:31:14–16:31:19 UTC: score 84/100, 1 critical,
  4 warnings. The detail line under "Critical issues found:" was not
  captured (§5.3).
- Nothing stopped.
- Before starting, Evoni was briefly inside a `psql` session and typed the
  three deploy commands there. Nothing executed (no terminating semicolon);
  she exited and ran them at the shell.
- **App check:** none was supplied with the account (§5.2).

Hostnames, IP addresses, key paths and credentials in her output are not
recorded here.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `058e04db` to `c0ebdf13` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git merge-base --is-ancestor 058e04db c0ebdf13 && echo "ancestor: yes"
ancestor: yes
```

**MEASURED: no gap before this deploy.** BK's record gives its end, and
production's tree after BK, as `058e04db` (BK record §1, §8), which is this
deploy's start. The restart count agrees: BK left it at 12 (BK record §6),
and this deploy's single restart reads 13 (§6).

## §2. The range — MEASURED

```
$ git rev-list --count 058e04db..c0ebdf13
8

$ git log --oneline 058e04db..c0ebdf13
c0ebdf139 feat(tooling): add scripts/deploy-prod.sh for Evoni's manual deploy [skip-automerge] (#2162)
11eb37cfe fix(events): manual create saves venue and creator links and cost [skip-automerge] (#2159)
3b4481d0e feat(events): draft events scheduled from the feed pipeline per §8(v) [skip-automerge] (#2157)
5fb077d66 feat(events): draft calendar-spawned events per §8(v) [skip-automerge] (#2155)
47c6f8eab fix(ai): rate-limit Schedule as Event and generate-seasonal [skip-automerge] (#2153)
401834dfa docs(events): read the other event-create paths [skip-automerge] (#2151)
b676f9bfe feat(events): show Waiting for format on time and dress code [skip-automerge] (#2149)
928c47edd docs(audit): file deploy record BK [skip-automerge] (#2147)

$ git diff --shortstat 058e04db c0ebdf13
 28 files changed, 2711 insertions(+), 58 deletions(-)

$ git diff --name-only 058e04db c0ebdf13
.claude/hooks/guard-dangerous-commands.js
.claude/hooks/guard-dangerous-commands.test.js
DEVELOPMENT_WORKFLOW.md
docs/EVENT_CREATE_PATHS_READ.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BK.md
frontend/src/components/QuickEpisodeCreator.jsx
frontend/src/pages/EventPackagePage.basics.test.jsx
frontend/src/pages/EventPackagePage.css
frontend/src/pages/EventPackagePage.jsx
frontend/src/utils/eventBasics.js
frontend/src/utils/eventBasics.test.js
frontend/src/utils/eventReadinessSections.js
frontend/src/utils/eventReadinessSections.test.js
scripts/deploy-prod.sh
src/routes/calendarRoutes.js
src/routes/feedPipelineRoutes.js
src/routes/worldEvents.js
src/services/eventAutomationService.js
src/services/eventConceptDraftService.js
src/services/feedEventPipelineService.js
tests/unit/routes/ai-rate-limits-create-paths.test.js
tests/unit/routes/feed-pipeline-tier-promotion.test.js
tests/unit/routes/worldEvents-manual-create-links.test.js
tests/unit/scripts/deployProdScript.test.js
tests/unit/services/eventAutomationService-calendar-draft.test.js
tests/unit/services/eventAutomationService.guestSelection.test.js
tests/unit/services/eventConceptDraftService.test.js
tests/unit/services/feedEventPipelineService.scheduleDraft.test.js

$ git diff --name-only 058e04db c0ebdf13 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

These agree with her account (§0): eight commits, the same eight PRs,
28 files, no migration and no package change. Five commits change runtime
code (#2149, #2153, #2155, #2157, #2159). #2162 adds tooling
(`scripts/deploy-prod.sh`, the guard hook, their tests and one
`DEVELOPMENT_WORKFLOW.md` paragraph) that the running app does not load.
#2147 (the BK record) and #2151 (`docs/EVENT_CREATE_PATHS_READ.md`) are
documents only.

## §3. The time

**ATTESTED.** 2026-09-28, about 16:27–16:31 UTC. The backup directory is
stamped 16:27:42Z; `Ready to accept requests` at 16:31:06 UTC; `/health`
answered at 16:31:08Z with uptime 9.2 s (§0).

**MEASURED.** The newest commit in the range is #2162, 16:20:13 UTC on
2026-09-28, so the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 058e04db..c0ebdf13 | head -1
c0ebdf139 2026-09-28T12:20:13-04:00 feat(tooling): add scripts/deploy-prod.sh for Evoni's manual deploy [skip-automerge] (#2162)
```

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check against database `episode_metadata` as
`episode_app_dev`: 0 pending of 220, exit 0, and Evoni confirmed at the
script's prompt that this is the database the API uses. `git status`:
untracked files only. The script's own migration and package stops did not
fire.

**MEASURED.** The migration tree holds 220 files at the end of the range, and
the range adds none (§2):

```
$ git ls-tree -r --name-only c0ebdf13 src/migrations | wc -l
220
```

## §5. What went live

### §5.1 The change, MEASURED

Read from each commit's message and patch (`git log`, `git show`):

- **#2149 (`b676f9bf`), Task #2148, doctrine rule 14.** On the event
  package page, time reads "Waiting for format" when no format is saved,
  and dress code does too when there is also no venue dress code. Both
  still count as not ready, with a readiness note
  (`frontend/src/utils/eventBasics.js`, `eventReadinessSections.js`,
  `EventPackagePage`).
- **#2151 (`401834df`), Task #2150.** `docs/EVENT_CREATE_PATHS_READ.md`
  maps the nine event-create paths other than from-profile. Read only; no
  runtime effect.
- **#2153 (`47c6f8ea`), Task #2152.** Schedule as Event
  (`src/routes/feedPipelineRoutes.js`) and generate-seasonal
  (`src/routes/calendarRoutes.js`) both call a model and carried only
  `requireAuth`. Each now has `requireAuth` + `aiRateLimiter`.
- **#2155 (`5fb077d6`), Task #2154.** Calendar auto-spawn
  (`src/services/eventAutomationService.js`) now makes the same single
  creation draft as from-profile (`draftEventConcept`) for each event, one
  after another, with the calendar event's public title, theme and
  description as context and the host creator named as host. A
  calendar-supplied dress code is kept; a null draft leaves spawning as
  before. From-profile's prompt is unchanged.
- **#2157 (`3b4481d0`), Task #2156.** Schedule as Event
  (`src/services/feedEventPipelineService.js`) now makes the same creation
  draft after its venue call, with the opportunity's public title, type and
  brand as context. With a brand the creator keeps from-profile's "started
  from" wording; without one they are the host. The opportunity's name and
  dress code are kept. No profile or a null draft sends the same statement
  as before.
- **#2159 (`11eb37cf`), Task #2158.** `POST /world/:showId/events`
  (`src/routes/worldEvents.js`) now saves `venue_location_id` and
  `source_profile_id` when they name existing rows; an unknown link is
  ignored and the event still saves. `QuickEpisodeCreator` sends its cost
  as `cost_coins`, which the route reads, instead of `cost`, which it never
  did.
- **#2162 (`c0ebdf13`), Task #2161.** `scripts/deploy-prod.sh`, the script
  this deploy ran, plus the guard-hook rule that blocks agent sessions from
  executing it. No runtime effect on the app.
- **#2147 (`928c47ed`):** the BK record; register only, no runtime effect.

### §5.2 The live check

**ATTESTED (§0).** `/health` healthy, database connected, and the CFO audit
ran.

**Not attested:** no app check was supplied with the account (the "App
checks" line of her account was left to be filled in). So none of the
following has been seen live:
- "Waiting for format" on an event with no format (#2149);
- the rate limiter on either route (#2153);
- a creation draft on a calendar-spawned or scheduled event (#2155, #2157);
- a manual event keeping its venue and creator links, or a Quick Episode
  cost saving (#2159).

An app check given later is recorded in a new document or an additive
banner, not by editing this one.

### §5.3 The build, the backup and the script

**ATTESTED.** `frontend/dist` was backed up to
`~/dist-backup-20260928T162742Z` before the build, and the build succeeded in
36.64 s. Whether BI's two standing warnings (BI record §5.3) printed is not
attested.

**MEASURED: why the CFO critical's detail was not captured.** The CFO agent
prints its criticals' detail on lines without the `[CFO]` tag, and the
script keeps only tagged lines:

```
$ grep -nE "Critical issues found|  → \[" src/services/cfoAgent.js
689:      console.log('[CFO] 🚨 Critical issues found:');
691:        console.log(`  → [${f.agent}] ${f.msg}`);

$ grep -n 'since_ready | grep' scripts/deploy-prod.sh
301:  CFO_LINES="$(since_ready | grep '\[CFO\]' | redact || true)"
```

So this deploy's single critical is not named. BK's single critical, with
the same score and counts, was `dependency_audit` (BK record §0). Treating
BL's as the same would be INFERRED, and this record does not do so. Fixing
the script's filter is not done here.

For production's request path, this record cites
`F-Deploy-1_Fix_Plan_v1.56.md`, the newest Fix Plan revision in the register
(§10).

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`; the
restart count is now 13. `episode-worker` stopped, as at BK. This deploy did
not touch it, and whether it should be running is not a finding of this
record. `.env` unchanged; `ANTHROPIC_API_KEY` present (count 1, value not
read).

**INFERRED.** An uptime of 9.2 s at 16:31:08Z puts the process start at about
16:30:59 UTC. That is consistent with `Ready to accept requests` at 16:31:06
and with the CFO audit starting at 16:31:14, about 15 s after the start
estimate (BK's landed about 9–14 s after its own; BK record §6).

**MEASURED.** Backend files changed (§2), so a restart was needed for them to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:**
- BI took it to 10 (BI record §6).
- BJ took it to 11 (BJ record §6).
- BK took it to 12 (BK record §6).
- BL took it to 13.

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 220.

**MEASURED.** No file under `src/migrations/` changes in the range (§2, §4).
#2155 and #2157 write drafted values into existing `world_events` columns and
the existing `automation` JSON; #2159 writes the existing
`venue_location_id` and `source_profile_id` columns. No schema change.

## §8. Basis statement

**MEASURED.** After Deploy BL, production's tree is this record's basis,
`c0ebdf13`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
c0ebdf1393d66a8260dcf7bd5d2d0016f25e2f4d 2026-09-28 feat(tooling): add scripts/deploy-prod.sh for Evoni's manual deploy [skip-automerge] (#2162)

$ git rev-parse --is-shallow-repository
false
```

Nothing is merged after it. The GitHub MCP `list_pull_requests` (state open)
returned `[]`.

## §9. What this document does not do

This document:

- records no token, email, password, hostname, IP address, key path, account
  number or ARN, and does not record the `ANTHROPIC_API_KEY` value (which was
  not read);
- does not edit the BK or any other filed document;
- does not name, investigate or rule on the CFO audit's critical or its four
  warnings, or on `episode-worker` (§5.3, §6);
- does not change `scripts/deploy-prod.sh` (§5.3);
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, restart, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS, database
  or Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session. Every MEASURED claim is a repository read this
  filing session performed itself.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68

$ ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v1\.[0-9]+\.md$' | sort -V | tail -1
F-Deploy-1_Fix_Plan_v1.56.md
```

Nothing minted here.

## §Standing

- §0 is ATTESTED; §1, §2, §4 and §5.3 carry MEASURED clauses beside it; §6
  carries one INFERRED clause.
- The tree agrees with her account: eight commits, 28 files, 2,711
  insertions, 58 deletions, no migration, no package change (§2). No gap
  after BK (§1).
- The first deploy run with `scripts/deploy-prod.sh`. Nothing stopped; both
  prompts were answered y by Evoni (§0).
- **The live check (§5.2):** `/health` healthy and connected (ATTESTED). No
  app check of the five runtime changes was supplied.
- The CFO audit's one critical is unnamed because the script drops untagged
  detail lines (§5.3, MEASURED); its four warnings are noted, not
  investigated.
- `episode-worker` stopped, the standing state (§6); noted, not
  investigated.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
