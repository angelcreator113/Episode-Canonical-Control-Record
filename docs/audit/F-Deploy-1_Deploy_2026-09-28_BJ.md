| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BJ, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session. A new event started from a Feed creator arrives with a drafted name and a read-only Event concept section, and the Package no longer infers category or format from the name.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BI.md` (the BI record, filed as #2130,
`fc75e20d`), whose deploy this one follows. The most recently filed record is
`F-Deploy-1_Deploy_2026-09-27_BH.md` (#2131, `1c028294`). This document
edits neither. Basis: `9c303353cb466f98a35b8cd6816961567149736e` (#2137), the
tree Deploy BJ moved production to. `origin/main` at filing is `9c303353`
(§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output. It cannot be
  reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, and register documents
  already merged under `docs/audit/`.
- **INFERRED** is marked where used (§5.2, §6) and is not upgraded.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
hostname, IP address, key path, account number or ARN.

**The letter.** This deploy is lettered **BJ**. BI ends at `28d14ff9` (BI
record §1, §8), and this deploy begins there, so there is no gap between them
(§1).

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-28, about 11:47–11:49 UTC, from her terminal
output):**

- Fast-forward `28d14ff9d4218b9e11b77eba0ffb6cdaa661d9d1` →
  `9c303353cb466f98a35b8cd6816961567149736e`, 5 commits, 15 files: PRs
  #2130, #2131, #2133, #2136, #2137.
- `git status` before the pull: untracked files only, the same files as at
  BI; nothing tracked modified.
- The range holds no migration and no package manifest or lockfile change:
  her diff of those paths printed nothing.
- Backup: `frontend/dist` backed up before the build. The vite build
  succeeded in 33.12s.
- The pending-migration check, run with `NODE_ENV=production`, read the canon
  instance, database `episode_metadata` as `episode_app_dev`: 0 pending of
  220, exit 0.
- `ANTHROPIC_API_KEY` present in `.env` (count 1; the value was not read).
  `.env` unchanged.
- One plain `pm2 restart` of `episode-api-prod-hotfix`; the restart count is
  now 11. `episode-worker` stopped (the standing state, as at BI).
- `/health`: the first curl, about 5 s after the restart, returned nothing
  (the process was still starting). The second, at 11:48:50Z, returned
  healthy, database connected, uptime 36.7 s. The out log shows `Ready to
  accept requests` at 11:48:19 UTC.
- After the restart, the CFO scheduled audit logged `cost_watchdog` at a
  50.0% error rate and `dependency_audit` at 14 critical/high
  vulnerabilities. Noted, not investigated.
- A grep of the error log for `eventConceptDraft` returned nothing.
- **App check:** a new event created from a Feed creator showed a drafted
  name, every Basics field labelled Auto-drafted, and the Event concept
  section. Picking a suggested name turned the name Edited.

Hostnames, IP addresses, key paths and credentials in her output are not
recorded here.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `28d14ff9` to `9c303353` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git merge-base --is-ancestor 28d14ff9 9c303353 && echo "ancestor: yes"
ancestor: yes
```

**MEASURED: no gap before this deploy.** BI's record gives its end, and
production's tree after BI, as `28d14ff9` (BI record §1, §8), which is this
deploy's start. The restart count agrees: BI left it at 10 (BI record §6),
and this deploy's single restart reads 11 (§6).

## §2. The range — MEASURED

```
$ git rev-list --count 28d14ff9..9c303353
5

$ git log --oneline 28d14ff9d4218b9e11b77eba0ffb6cdaa661d9d1..9c303353cb466f98a35b8cd6816961567149736e
9c303353c feat(events): draft the event name last from the concept per §8(u) R3 [skip-automerge] (#2137)
f4ee2c30c refactor(events): stop inferring category and format from the name per §8(u) R3 [skip-automerge] (#2136)
b207a1429 feat(events): show drafted concept and styling brief in the Package [skip-automerge] (#2133)
1c0282941 docs(audit): file deploy record BH [skip-automerge] (#2131)
fc75e20d9 docs(audit): file deploy record BI [skip-automerge] (#2130)

$ git diff --shortstat 28d14ff9 9c303353
 15 files changed, 1461 insertions(+), 86 deletions(-)

$ git diff --name-only 28d14ff9 9c303353
docs/audit/F-Deploy-1_Deploy_2026-09-27_BH.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BI.md
frontend/src/components/EventConceptSection.jsx
frontend/src/pages/EventPackagePage.concept.test.jsx
frontend/src/pages/EventPackagePage.css
frontend/src/pages/EventPackagePage.jsx
frontend/src/pages/EventPackagePage.name.test.jsx
frontend/src/utils/eventBasics.js
frontend/src/utils/eventBasics.test.js
src/routes/worldEvents.js
src/services/eventConceptDraftService.js
src/utils/suggestNamesFraming.js
tests/unit/routes/worldEvents-from-profile-concept-draft.test.js
tests/unit/services/eventConceptDraftService.test.js
tests/unit/utils/suggestNamesFraming.test.js

$ git diff --name-only 28d14ff9 9c303353 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
```

Five commits: three code (#2133, #2136, #2137) and two register-only (#2130,
#2131, the BI and BH records). Fifteen files: three under `src/`, seven under
`frontend/src`, three backend tests, and two register documents. Six of the
fifteen are tests. No migration file, no package manifest or lockfile.

## §3. The time

**ATTESTED.** 2026-09-28, about 11:47–11:49 UTC. `Ready to accept requests`
at 11:48:19 UTC; `/health` answered at 11:48:50Z with uptime 36.7 s (§0).

**MEASURED.** The newest commit in the range is #2137, 11:40:43 UTC on
2026-09-28, so the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 28d14ff9..9c303353 | head -1
9c303353c 2026-09-28T07:40:43-04:00 feat(events): draft the event name last from the concept per §8(u) R3 [skip-automerge] (#2137)
```

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check with `NODE_ENV=production`, against the
canon instance, database `episode_metadata` as `episode_app_dev`: 0 pending of
220, exit 0. `git status`: untracked files only.

**MEASURED.** The migration tree holds 220 files at the end of the range, and
the range adds none (§2):

```
$ git ls-tree -r --name-only 9c303353 src/migrations | wc -l
220
```

## §5. What went live

### §5.1 The change, MEASURED

The last three steps of the event-generation workstream
(`docs/EVENT_EPISODE_FLOW.md` §8(u); `docs/DESIGN_DOCTRINE.md` rule 14):

- #2133 (`b207a142`), step 4b: a read-only "Event concept" section after
  Basics in the Event Package (`EventConceptSection`), subtitled "For
  planning; not shown to guests". It shows `automation.concept`,
  `automation.activity`, the `dress_code_keywords` column and
  `automation.styling_brief`. Concept, activity and brief read
  "Auto-drafted · AI draft"; keywords read Auto-drafted or Edited against
  their saved copy; "Drafted with the original dress code." shows when the
  dress code reads Edited. An event with no draft shows no section.
- #2136 (`f4ee2c30`), step 3b (§8(u) R3): `suggestEventCategory` and
  `suggestEventFormat` (`frontend/src/utils/eventBasics.js`) no longer read
  the event name. `NAME_WORDS_TO_CATEGORY`, `NAME_WORDS_TO_FORMAT` and
  `fromName` are deleted. A format suggestion now comes only from
  `automation.opportunity_type`, so events with no draft and no opportunity
  type get no format suggestion, and their time and dress code show Missing
  until a format is picked.
- #2137 (`9c303353`), step 5 (§8(u) R1, R3, R9): the creation draft's one
  call (`draftEventConcept`) also returns a name, as its last field. A name
  that is empty, 40 characters or longer, or equal to "Event with
  <creator>" is dropped with a warning, never truncated; double quotes are
  stripped anywhere, and single quotes only when they wrap the whole name.
  `from-profile` saves a valid name with `auto_drafted.name` and
  `drafted_values.name`, and otherwise keeps "Event with <creator>". The
  suggest-names framing (`buildSuggestNamesFraming`) uses the drafted concept
  in place of the description. The Basics Name row reads "Auto-drafted · AI
  draft", then "Edited" once changed.
- #2130, #2131: the BI and BH records; register only, no runtime effect.

### §5.2 The live check, beside the code

**ATTESTED (§0).** A new Feed-creator event showed a drafted name, every
Basics field labelled Auto-drafted, and the Event concept section. Picking
a suggested name turned the name Edited.
`/health` healthy, database connected. The error log holds no
`eventConceptDraft` line.

**MEASURED.** The drafted name and its turn to Edited are #2137: a picked
name is saved through the event PUT (`saveEventName`), and the Name row
compares the saved name with `drafted_values.name` (`draftStateOf`). The
Event concept section is #2133. In `src/services/eventConceptDraftService.js`,
the draft's own rate limit, a dropped name, invalid styling, and a dropped
category, format or time each call `console.warn`; an unusable reply, an
unparseable one, or a failed call calls `console.error`. A draft with every
field valid logs nothing, and so does the skip when `ANTHROPIC_API_KEY` is
absent.

**INFERRED.** Node writes `console.warn` and `console.error` to stderr,
which pm2 keeps in the error log, so an empty `eventConceptDraft` grep means
the drafts in the grepped window dropped nothing and did not fail. That fits
the app check: a drafted name and every Basics field Auto-drafted is a draft
with every field valid.

**Not attested:**
- which suggested name was picked;
- the extent of the grepped error-log window;
- which Basics fields the checked event had (the account says every one was
  Auto-drafted).

### §5.3 The build and the backup

**ATTESTED.** `frontend/dist` was backed up before the build; the build
succeeded in 33.12 s. Her account names no warnings. BI's two warnings (stale
browserslist data; "Unexpected @keyframes") predate BI's range (BI record
§5.3); whether they printed here is not attested.

For production's request path, this record cites
`F-Deploy-1_Fix_Plan_v1.56.md`.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`; the
restart count is now 11. The first `/health` curl, about 5 s after the
restart, returned nothing; the second, at 11:48:50Z, returned healthy.
`episode-worker` stopped, as at BI; this deploy did not touch it, and whether
it should be running is not a finding of this record. `.env` unchanged;
`ANTHROPIC_API_KEY` present (count 1, value not read).

**INFERRED.** The empty first curl reflects startup time, not a failure:
`Ready to accept requests` is at 11:48:19 UTC, and an uptime of 36.7 s at
11:48:50Z puts the process start at about 11:48:13 UTC.

**MEASURED.** Backend files changed (§2), so a restart was needed for them to
take effect. No `.env` or credential change is in the range.

**The CFO audit.** **ATTESTED:** after the restart, the scheduled audit
logged `cost_watchdog` at a 50.0% error rate and `dependency_audit` at 14
critical/high vulnerabilities; noted, not investigated. **MEASURED:** these
come from `src/services/cfoAgent.js`, whose scheduler runs a first audit
10 s after it starts (`setTimeout(scheduledRun, 10000)`). Neither
`cfoAgent.js` nor `cfoAgentRoutes.js` changes in the range:

```
$ git diff 28d14ff9 9c303353 --stat -- src/services/cfoAgent.js src/routes/cfoAgentRoutes.js
(no output)
```

What the two figures measure, and whether they are new, is not established
here.

**The restart chain across the records:**
- BG took the count from 7 to 8 (BG record §6).
- BH took it from 8 to 9 (BH record).
- BI took it to 10 (BI record §6).
- BJ took it to 11.

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 220.

**MEASURED.** No file under `src/migrations/` changes in the range (§2, §4).
The drafted name is saved to the existing `name` column. Its
`auto_drafted.name` and `drafted_values.name` entries sit inside the existing
`canon_consequences` JSONB. No schema change.

## §8. Basis statement

**MEASURED.** After Deploy BJ, production's tree is this record's basis,
`9c303353`. At filing, after `git fetch origin`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
9c303353cb466f98a35b8cd6816961567149736e 2026-09-28 feat(events): draft the event name last from the concept per §8(u) R3 [skip-automerge] (#2137)
```

Nothing is merged after it.

## §9. What this document does not do

This document:

- records no token, email, password, hostname, IP address, key path, account
  number or ARN, and does not record the `ANTHROPIC_API_KEY` value (which was
  not read);
- does not edit the BI, BH or any other filed document;
- does not investigate or rule on the CFO audit's figures or on
  `episode-worker` (§6);
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
```

Nothing minted here.

## §Standing

- §0 is ATTESTED; §1, §2 and §4 carry MEASURED clauses beside it; §5.2 and
  §6 carry one INFERRED clause each.
- The tree agrees with her account: five commits, fifteen files, no
  migration, no package change (§2). No gap after BI (§1).
- **The live check (§5.2):** a drafted name, every Basics field
  Auto-drafted, and the Event concept section on a new Feed-creator event.
  `/health` was healthy and connected on the second curl, and the error log
  has no `eventConceptDraft` line. Picking a suggested name turned the name
  Edited (ATTESTED).
- The CFO audit's `cost_watchdog` 50.0% error rate and `dependency_audit`
  14 critical/high are noted, not investigated; the code that reports them
  is unchanged in the range (§6).
- `episode-worker` stopped, the standing state (§6); noted, not
  investigated.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
