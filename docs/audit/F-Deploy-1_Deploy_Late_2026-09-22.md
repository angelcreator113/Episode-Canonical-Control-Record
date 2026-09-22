| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Three further production deploys late on 2026-09-22, and a backup-directory maintenance pass afterward — all performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_Evening_2026-09-22.md` — this document follows that
one, filed earlier the same day, rather than editing it. Basis:
`origin/main` at `b65defa561b00dacb3f69485b635b488d4e89f6b`, measured
2026-09-22. This basis is later than any of the three deploys below —
it includes PR #1690, merged after Deploy C — but #1690 itself, and the
deploy that will ship it, are outside this record's scope; the issuing
task states plainly that #1690 belongs to a later record.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Two standings appear below, each marked on its own claim, never
upgraded: **ATTESTED** for what only Evoni's own account of the
production host session states, not reproducible from a clone, and
**MEASURED** for what this repository itself shows — a `git log`/`diff`
any clone can reproduce. This document closes no keystone, discharges no
owed item, mints no FD, XK, or PE number, and rules on nothing.

## §1. Identity — all three deploys

**ATTESTED.** Instance `i-02ae7608c531db485`; tree `~/episode-metadata`.
`git status` showed only the four known untracked `.bak` files, unchanged
from the standing observation in `F-Deploy-1_Deploy_Evening_2026-09-22.md`
§1 and the two records it cites. `episode-worker` was stopped throughout
all three deploys. No package, migration, or model change appeared in
any of the three.

## §2. Deploy A — 2026-09-22 ~20:54 UTC, frontend only

**ATTESTED.** Evoni moved the tree from
`1ea3cbebc9153c1277106aaff6f0bddc5facd8ab` to
`b75ec5b9bcc71aec6deef67e5a5d65fda1eb71db`, two commits; no `src/` files
changed; no API restart.

Backup `/var/www/html.bak-20260922-pre1675` (5.8M); served entry
`index-CMShKqCA.js` → `index-JbIfpNTo.js`; a request with
`Host: primepisodes.com` returned HTTP 200. The frontend build took
34.12s.

**MEASURED**, `git log --oneline
1ea3cbebc9153c1277106aaff6f0bddc5facd8ab..b75ec5b9bcc71aec6deef67e5a5d65fda1eb71db`:

```
b75ec5b9b Add venue and scene-set pickers to Event Package (Task #1674) [skip-automerge] (#1675)
49e80628a docs(audit): file the 2026-09-22 evening deploy record [skip-automerge] (#1673)
```

Two commits, matching Evoni's own count. PRs #1673, #1675. `git diff
--stat` over the same range, scoped to `src/`, confirms zero files
changed:

```
(no output)
```

The full (unscoped) diffstat over the same range touches only
`docs/audit/F-Deploy-1_Deploy_Evening_2026-09-22.md` and the two
frontend files PR #1675 changed
(`frontend/src/pages/EventPackagePage.{css,jsx}`) — none under
`src/migrations/` or `package.json`, consistent with Evoni's account of
no API restart.

## §3. Deploy B — 2026-09-22 ~22:21 UTC, frontend only

**ATTESTED.** Evoni moved the tree from
`b75ec5b9bcc71aec6deef67e5a5d65fda1eb71db` to
`92a1baf4c0e25113cd6a6a3360fec0057f0f4c6d`, four commits; no `src/` files
changed; no API restart.

Backup `/var/www/html.bak-20260922-pre1682`; served entry
`index-JbIfpNTo.js` → `index-DF9EvC2j.js`; HTTP 200. The frontend build
took 35.47s.

**MEASURED**, `git log --oneline
b75ec5b9bcc71aec6deef67e5a5d65fda1eb71db..92a1baf4c0e25113cd6a6a3360fec0057f0f4c6d`:

```
92a1baf4c refactor(frontend): Events queue needs an organizer, not a host [skip-automerge] (#1682)
9657941ef docs: record the Prime Studios design doctrine [skip-automerge] (#1680)
b958cf910 docs(flow): record brand-matching and host_brand two-homes observations [skip-automerge] (#1679)
9d34588c8 docs(flow): record the organizer model [skip-automerge] (#1677)
```

Four commits, matching Evoni's own count. PRs #1677, #1679, #1680,
#1682. `git diff --stat` over the same range, scoped to `src/`, confirms
zero files changed:

```
(no output)
```

The full (unscoped) diffstat over the same range touches
`docs/DESIGN_DOCTRINE.md`, `docs/EVENT_EPISODE_FLOW.md`, and four
frontend files (`EventPackagePage.css`, `EventPackagePage.jsx`,
`WorldAdmin.jsx`, `utils/eventReadiness.js`) — none under
`src/migrations/` or `package.json`, consistent with Evoni's account of
no API restart.

## §4. Deploy C — 2026-09-22 ~23:00–23:04 UTC, backend

**ATTESTED.** Evoni moved the tree from
`92a1baf4c0e25113cd6a6a3360fec0057f0f4c6d` to
`70cc93f4acec2912deb6680fc2efdcc95a8d2b7d`, three commits. Five backend
files changed: `src/services/characterSyncService.js`,
`src/services/episodeScriptWriterService.js`,
`src/services/feedActivityService.js`,
`src/services/feedEventPipelineService.js`,
`src/services/storyGenerationService.js`. `node -c` passed on all five;
requiring `feedEventPipelineService` succeeded.

Backup `/var/www/html.bak-20260922-pre1688`; the frontend entry was
unchanged at `index-DF9EvC2j.js`, as no frontend file changed this
deploy; HTTP 200.

`pm2 restart`: restart count 15 → 16, online; `/health` returned 200;
the startup log showed only the OpenSearch fallback and the Node 22 and
AWS SDK v2 notices — the same three familiar notices
`F-Deploy-1_Deploy_Evening_2026-09-22.md` §2 and the records it cites
already record for earlier deploys this week.

After this deploy, Evoni exercised the opportunity pipeline's "Schedule
as Event" action in the application, and it succeeded. See §6 below for
the finding this is related to, by citation only.

**MEASURED**, `git log --oneline
92a1baf4c0e25113cd6a6a3360fec0057f0f4c6d..70cc93f4acec2912deb6680fc2efdcc95a8d2b7d`:

```
70cc93f4a fix(services): give opportunity-path guests a profile link [skip-automerge] (#1688)
a332e6783 docs(flow): record the guest ownership ruling [skip-automerge] (#1687)
afcadb605 docs: read where guest data lives [skip-automerge] (#1684)
```

Three commits, matching Evoni's own count. PRs #1684, #1687, #1688.
`git diff --stat` over the same range, scoped to `src/`, confirms
exactly the five files named above changed, matching Evoni's own count,
and none under `src/migrations/` or `package.json`:

```
 src/services/characterSyncService.js       |  9 +++++++--
 src/services/episodeScriptWriterService.js |  5 ++++-
 src/services/feedActivityService.js        |  5 ++++-
 src/services/feedEventPipelineService.js   | 21 +++++++++++++++++++--
 src/services/storyGenerationService.js     |  5 ++++-
 5 files changed, 38 insertions(+), 7 deletions(-)
```

The full (unscoped) diffstat over the same range also shows
`docs/EVENT_EPISODE_FLOW.md`, the new `docs/GUEST_OWNERSHIP_READ.md`,
and four new test files under `tests/unit/services/` — the docs and
tests PRs #1684/#1687/#1688 each carried alongside the five backend
files.

## §5. Maintenance — 2026-09-22 ~23:10 UTC, backup directories

**ATTESTED.** Fifteen `/var/www/html.bak-*` directories existed on the
box. Nine were deleted, by explicit name: `pre1671`, `pre1669`,
`pre1659`, `pre1649`, `pre1639` (all dated 20260922), `pre1625` and
`pre1606` (20260921), `pre1584` (20260920), and `20260918`.

Six were kept: `pre1688`, `pre1682`, `pre1675` (this record's own three
deploys, §2–§4 above), and the three 2026-09-19 backups — see §6 below
for what those three are kept as evidence of, by citation only.

Disk before the deletions was 90% used with 850M free; after, 89% used
with 896M free.

## §6. Related, by citation only — not re-derived, not ruled on

**The kept 2026-09-19 backups.**
`F-Deploy-1_Deploy_2026-09-20_2026-09-21.md` §4, "The 2026-09-19 backups
and bundle timestamp — not ruled," records three `.bak-20260919*`
directories found already on the box, consistent with an unrecorded
frontend write on 2026-09-19 that no agent session or Fix Plan revision
known to that record's author accounts for — left open there, not ruled
on. §5 above records that the three are still on the box and were kept
in this maintenance pass specifically because they remain the only
physical evidence of that unexplained write. This document does not
re-open, re-verify, or add to that open question; it only records that
the evidence for it still exists, and was deliberately preserved.

**The opportunity-path finding and PR #1688.** §4 above records that
Evoni exercised "Schedule as Event" successfully after Deploy C. PR
#1688 (merged in Deploy C) states in its own body that the function
behind that action, `scheduleOpportunityAsEvent`, referenced a variable
before its own declaration — a temporal-dead-zone `ReferenceError` — on
every call, before the fix that PR's second commit made, meaning the
opportunity-pipeline event-creation path could not create an event at
all prior to this deploy. This document does not re-verify that claim
against the PR's diff or commit history; it is cited here only to relate
Evoni's successful use of the feature after the deploy to the fix that
shipped in it.

## §7. Observations — not findings, not ruled on

- The root filesystem reached 90% used during this session — the first
  time a percentage this high appears in these deploy records. No cause
  is established here.
- Two of the frontend builds across this session ran far slower than
  the roughly 32–35s norm the deploys in this record and
  `F-Deploy-1_Deploy_Evening_2026-09-22.md` otherwise show: one took
  1m13s around 18:36 UTC, and one took 2m20s around 23:00 UTC (during
  Deploy C, §4 above) — both while the disk was at or near 90% used.
  Whether the slow builds and the disk usage are related is not
  established here; both facts are recorded, not connected.

Neither observation above is characterized as a defect, ruled on, or
assigned an owner in this document.

## §8. What this document does not do

This document:

- does not rule on the 2026-09-19 unexplained frontend write §6 cites —
  that question stays open exactly as
  `F-Deploy-1_Deploy_2026-09-20_2026-09-21.md` §4 left it;
- does not re-verify PR #1688's own account of the
  `scheduleOpportunityAsEvent` bug it fixed — cited in §6, not
  re-derived;
- does not establish a cause for either §7 observation — the 90% disk
  reading or the two slow builds — and draws no connection between them
  beyond both being recorded;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision;
- mints no FD, XK, or PE number;
- amends no filed document —
  `F-Deploy-1_Deploy_Evening_2026-09-22.md` and
  `F-Deploy-1_Deploy_2026-09-20_2026-09-21.md` are cited above, not
  edited;
- performs no deploy, database change, backup deletion, or credential
  change of its own, and makes no host, AWS, database, or Cognito
  contact — every ATTESTED claim above is Evoni's own account, taken
  outside any agent session; every MEASURED claim is a repository read
  this filing session performed itself, against `origin/main`, not
  against any host;
- records no secret anywhere above;
- does not cover PR #1690 or its deploy — out of scope for this record,
  per the issuing task, and left for the next one.

## §9. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from the last register tail check
(`F-Deploy-1_Deploy_Evening_2026-09-22.md` §9, itself carried from
`F-Deploy-1_Deploy_2026-09-22.md` §10). Nothing minted here.

## §Standing

§1–§5 each carry an ATTESTED clause (Evoni's own account of actions and
reads made personally, on the production host — not reproducible from a
clone) and, where a commit range is involved (§2–§4), a MEASURED clause
(a `git log`/`diff` read against this repository, reproducible by
anyone with a clone), marked separately, never merged into one standing.
§6 and §7 carry no independent standing beyond the citations and reads
they name. Nothing in this document is labelled RULED. No host, AWS,
database, or Cognito contact was made by the agent session that filed
it — every MEASURED claim above reads this repository only. Production's
freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions
still never touch hosts, AWS, RDS, or Cognito (`CLAUDE.md`), unchanged by
that lift or by this record.
