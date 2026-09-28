| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BK, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session. Suggested names keep their apostrophes, the styling-brief values line up, the fallback description states no guest count, and the CFO audit's AI error rate counts only failed calls.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BJ.md` (the BJ record, filed as #2138,
`577b0da3`), whose deploy this one follows. This document edits no filed
document. Basis: `058e04db4036f96908b92e03c8bf5cac78817de1` (#2146), the tree
Deploy BK moved production to. `origin/main` at filing is `058e04db` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output. It cannot be
  reproduced from a clone.
- **MEASURED** covers what this repository itself shows, and register
  documents already merged under `docs/audit/`. The figures were first read
  through the GitHub MCP tools (`list_commits`, `get_commit`,
  `get_file_contents`) while the session's Bash tool was refused. They were
  then re-measured with local `git` on an unshallowed clone once Bash
  returned, and the `git` output is what is pasted. The two agree.
- **INFERRED** is marked where used (§5.2, §6) and is not upgraded.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
hostname, IP address, key path, account number or ARN.

**The letter.** This deploy is lettered **BK**. BJ ends at `9c303353` (BJ
record §1, §8), and this deploy begins there, so there is no gap between them
(§1).

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-28, about 12:47–12:49 UTC, from her terminal
output):**

- Fast-forward `9c303353` → `058e04db`, 5 commits (#2138, #2142, #2143,
  #2144, #2146), 10 files, 621 insertions, 28 deletions.
- `git status` before the pull: untracked files only (`Production`, `sed`,
  three `ecosystem.config.js.bak` files, `src/routes/auth.js.bak-2026-08-22`);
  nothing tracked modified.
- Her diff of `src/migrations` and every package manifest and lockfile
  printed nothing.
- The pending-migration check, run with `NODE_ENV=production`, read the canon
  instance, database `episode_metadata` as `episode_app_dev`: 0 pending of
  220, exit 0.
- Backup: `frontend/dist` backed up to a timestamped `~/dist-backup-*`
  directory before the build. The vite build succeeded in 34.82 s; only the
  tail of its output was viewed.
- One plain `pm2 restart` of `episode-api-prod-hotfix`; the restart count is
  now 12. `episode-worker` stopped (the standing state).
- `.env` unchanged; `ANTHROPIC_API_KEY` present (count 1; the value was not
  read).
- `/health` at 2026-09-28T12:48:34.363Z: healthy, database connected, uptime
  30.1 s. The out log shows `Ready to accept requests` at 12:48:09 UTC.
- The CFO scheduled audit, 12:48:18–12:48:22 UTC: score 84/100, 1 critical,
  4 warnings. The only critical is `dependency_audit`, 14 critical/high
  vulnerabilities. There is no `cost_watchdog` error-rate finding. This is
  the first audit after #2146. (BJ's audit: 78/100, 2 criticals, including
  `cost_watchdog` at 50.0%.)
- **App check:** on the new build, every styling-brief value starts at the
  same position and each label sits at the top of its row. A name picked
  from Suggest names ("Wearable Experiments Studio Session") shows Edited.

Hostnames, IP addresses, key paths and credentials in her output are not
recorded here.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `9c303353` to `058e04db` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git merge-base --is-ancestor 9c303353 058e04db && echo "ancestor: yes"
ancestor: yes
```

**MEASURED: no gap before this deploy.** BJ's record gives its end, and
production's tree after BJ, as `9c303353` (BJ record §1, §8), which is this
deploy's start. The restart count agrees: BJ left it at 11 (BJ record §6),
and this deploy's single restart reads 12 (§6).

## §2. The range — MEASURED

```
$ git rev-list --count 9c303353..058e04db
5

$ git log --oneline 9c303353..058e04db
058e04db4 fix(cfo): count only failed calls in the AI error rate [skip-automerge] (#2146)
adbbec057 fix(events): drop guest count from fallback description per rule 12 [skip-automerge] (#2144)
bdca68dc5 fix(events): align styling-brief values [skip-automerge] (#2143)
36b93eedd fix(events): keep apostrophes in suggested names [skip-automerge] (#2142)
577b0da39 docs(audit): file deploy record BJ [skip-automerge] (#2138)

$ git diff --shortstat 9c303353 058e04db
 10 files changed, 621 insertions(+), 28 deletions(-)

$ git diff --name-only 9c303353 058e04db
docs/audit/F-Deploy-1_Deploy_2026-09-28_BJ.md
frontend/src/pages/EventPackagePage.css
src/routes/worldEvents.js
src/services/cfoAgent.js
src/services/eventConceptDraftService.js
src/utils/cleanEventName.js
tests/unit/routes/worldEvents-from-profile-concept-draft.test.js
tests/unit/routes/worldEvents-suggest-names-cleanup.test.js
tests/unit/services/cfoAgent-errorRate.test.js
tests/unit/utils/cleanEventName.test.js

$ git diff --name-only 9c303353 058e04db -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
```

These agree with her account (§0): five commits, ten files, 621 insertions,
28 deletions. Four code commits (#2142, #2143, #2144, #2146) and one register-only commit
(#2138, the BJ record). Of the ten files, four are under `src/`, one under
`frontend/src`, four are backend tests, and one is a register document. None
is under `src/migrations/`, and none is a package manifest or lockfile.

## §3. The time

**ATTESTED.** 2026-09-28, about 12:47–12:49 UTC. `Ready to accept requests`
at 12:48:09 UTC; `/health` answered at 12:48:34.363Z with uptime 30.1 s (§0).

**MEASURED.** The newest commit in the range is #2146, 12:40:41 UTC on
2026-09-28, so the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 9c303353..058e04db | head -1
058e04db4 2026-09-28T08:40:41-04:00 fix(cfo): count only failed calls in the AI error rate [skip-automerge] (#2146)
```

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check with `NODE_ENV=production`, against the
canon instance, database `episode_metadata` as `episode_app_dev`: 0 pending of
220, exit 0. `git status`: untracked files only.

**MEASURED.** The migration tree holds 220 files at the end of the range, and
the range adds none (§2):

```
$ git ls-tree -r --name-only 058e04db src/migrations | wc -l
220
```

## §5. What went live

### §5.1 The change, MEASURED

Read from each commit's patch (`get_commit`, detail `full_patch`):

- **#2142 (`36b93eed`), Task #2139.** A new `cleanEventName`
  (`src/utils/cleanEventName.js`) is now the one quotation-mark cleanup for
  AI-written event names. It strips double quotes, straight and curly,
  anywhere. It strips single quotes only when they wrap the whole name, so
  an apostrophe inside it is kept. It collapses whitespace. The creation
  draft (`parseName` in `eventConceptDraftService.js`) uses it in place of
  its own `stripNameQuotes`, and so does the suggest-names handler in
  `src/routes/worldEvents.js`, which used to strip every single quote. The
  handler's 40-character cut and three-name cap are unchanged.
- **#2143 (`bdca68dc`), Task #2140.** `.epp-concept-brief` in
  `EventPackagePage.css` becomes one two-column grid
  (`minmax(96px, max-content) 1fr`). Each row takes its columns from it
  (`subgrid`) and aligns to the top (`align-items: start`). Before this,
  each row sized its own label column, so wider labels pushed their values
  right. At 480 px and below the brief is one column.
- **#2144 (`adbbec05`), Task #2141, doctrine rule 12.** The `from-profile`
  template description drops its `"<N> guests on the list."` sentence. The
  guest list itself (`automation.guest_profiles`) is unchanged.
- **#2146 (`058e04db`), Task #2145.** In `costWatchdog`
  (`src/services/cfoAgent.js`), the error-rate query changes from
  `COUNT(*)::int AS errors, COUNT(*) FILTER (WHERE NOT is_error)::int AS
  successes` to `COUNT(*) FILTER (WHERE is_error)::int AS errors,
  COUNT(*)::int AS total`. The rate is now `errorRatePct`: errors over
  total, 0 with no calls. The old code counted every call as an error, so
  the rate could never read below 50%. The `> 5` critical threshold, the
  −20 score, and the message are unchanged.
- **#2138 (`577b0da3`):** the BJ record; register only, no runtime effect.

### §5.2 The live check, beside the code

**ATTESTED (§0).** Styling-brief values all start at one position, with
each label at the top of its row. A name picked from Suggest names shows
Edited. `/health` healthy, database connected. The CFO audit raised no
`cost_watchdog` error-rate finding.

**MEASURED.** The alignment is #2143's `subgrid` and `align-items: start`
(§5.1). A picked name turning Edited is BJ's #2137 behaviour (BJ record
§5.2), not a change in this range. What this range changes for suggested
names is the quote cleanup (#2142).

**INFERRED.** The missing `cost_watchdog` finding fits #2146. Under the old
query the rate was errors ÷ (errors + successes), where errors was every
call and successes the calls with `is_error` false. That comes to exactly
50% only when every call had `is_error` false. So BJ's 50.0% is consistent
with a week of no failed calls (to one decimal place) and did not measure
failures. Under the new query, the same week reads near 0%, below the 5%
threshold. The 78 → 84 score change is not decomposed here, since the audit
combines several sub-agents.

**Not attested:**
- whether the picked name "Wearable Experiments Studio Session" contained
  a quotation mark before cleanup. It has no apostrophe, so the check does
  not show #2142's apostrophe keeping;
- any live check of #2144's description change;
- what the four CFO warnings were;
- warnings in the vite build (only the tail was viewed).

### §5.3 The build and the backup

**ATTESTED.** `frontend/dist` was backed up to a timestamped directory
before the build, and the build succeeded in 34.82 s. Only the tail was
viewed, so whether BI's two standing warnings (BI record §5.3) printed is
not attested.

For production's request path, this record cites
`F-Deploy-1_Fix_Plan_v1.56.md`, the newest Fix Plan revision in the register
(§10).

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`; the
restart count is now 12. `episode-worker` stopped, as at BJ. This deploy did
not touch it, and whether it should be running is not a finding of this
record. `.env` unchanged; `ANTHROPIC_API_KEY` present (count 1, value not
read).

**INFERRED.** An uptime of 30.1 s at 12:48:34.363Z puts the process start at
about 12:48:04 UTC. That is consistent with `Ready to accept requests` at
12:48:09 and with the CFO audit at 12:48:18. The scheduler runs its first
audit 10 s after start (BJ record §6), and the audit lands about 9–14 s
after the start estimate.

**MEASURED.** Backend files changed (§2), so a restart was needed for them to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:**
- BH took it from 8 to 9 (BH record).
- BI took it to 10 (BI record §6).
- BJ took it to 11 (BJ record §6).
- BK took it to 12.

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 220.

**MEASURED.** No file under `src/migrations/` changes in the range (§2, §4).
#2146 changes a read query on the existing `ai_usage_logs.is_error` column.
#2142 and #2144 change string handling only. No schema change.

## §8. Basis statement

**MEASURED.** After Deploy BK, production's tree is this record's basis,
`058e04db`. At filing, after `git fetch origin --prune` and `git fetch
--unshallow origin main`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
058e04db4036f96908b92e03c8bf5cac78817de1 2026-09-28 fix(cfo): count only failed calls in the AI error rate [skip-automerge] (#2146)

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
- does not edit the BJ or any other filed document;
- does not investigate or rule on the CFO audit's `dependency_audit` figure,
  its four warnings, or `episode-worker` (§5.2, §6);
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

- §0 is ATTESTED; §1, §2 and §4 carry MEASURED clauses beside it; §5.2 and
  §6 carry one INFERRED clause each.
- The tree agrees with her account: five commits, ten files, 621 insertions,
  28 deletions, no migration, no package change (§2). No gap after BJ (§1).
- **The live check (§5.2):** styling-brief values aligned with each label at
  the top of its row, a picked suggested name showing Edited, `/health`
  healthy and connected, and no `cost_watchdog` error-rate finding in the
  first audit after #2146 (ATTESTED).
- The CFO audit's `dependency_audit` 14 critical/high and its four warnings
  are noted, not investigated.
- `episode-worker` stopped, the standing state (§6); noted, not
  investigated.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
