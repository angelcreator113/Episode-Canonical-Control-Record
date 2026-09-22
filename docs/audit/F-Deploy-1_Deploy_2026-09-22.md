| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Two production deploys on 2026-09-22 — one frontend-and-backend deploy before a manual schema change, one frontend-and-backend deploy after it — the direct-SQL `world_events` column add between them, the post-deploy log observations, and the same-day S3 access-key replacement for `episode-metadata-ci-cd`.* |
| --- |

**Document version**

New record, not a Fix Plan revision. Basis: `origin/main` at
`7c200d159b29254a4921cdbfa1686e71668bd24d`, measured 2026-09-22.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Two standings appear below, each marked on its own claim, never
upgraded: **ATTESTED** for what only Evoni's own account of the production
host, database session, or IAM console states, not reproducible from a
clone, and **MEASURED** for what this repository itself shows — a `git
log`/`diff` any clone can reproduce. This document closes no keystone,
discharges no owed item, mints no FD, XK, or PE number, and rules on
nothing.

## §1. Identity — both deploys

**ATTESTED.** Instance `i-02ae7608c531db485`; tree `~/episode-metadata`.
`git status` showed only the four known untracked `.bak` files, unchanged
from the standing observation in `F-Deploy-1_Deploy_2026-09-20_2026-09-21.md`
§1. `episode-worker` was stopped throughout both deploys.

## §2. Deploy A — 2026-09-22 ~00:50–01:25 UTC, frontend and one backend file

**ATTESTED.** Evoni moved the tree from
`24073cb54d3ce9c266d6a74033bf6d8d4399a8ee` to
`d0babdf801790dd62aa5540c8aaa132e9b9ed97e`, seven commits. Her own `git
diff` showed no package, migration, or model changes; the only `src/` file
touched was `src/routes/worldStudio.js`. `node -c` on that file passed.
Build took 33.35s; `dist` was stamped 01:17.

Backup `/var/www/html.bak-20260922-pre1639` (5.8M); served entry
`index-VzSReGOP.js` → `index-Dn-nVfj9.js`; a request with
`Host: primepisodes.com` returned HTTP 200.

`pm2 restart episode-api-prod-hotfix`: restart count 9 → 10, online;
`/health` returned 200; the startup log showed only the OpenSearch
fallback, Node 22, and AWS SDK v2 notices.

**MEASURED**, `git log --oneline
24073cb54d3ce9c266d6a74033bf6d8d4399a8ee..d0babdf801790dd62aa5540c8aaa132e9b9ed97e`:

```
d0babdf80 fix(routes): correct invalid logged_by value in World->Calendar sync [skip-automerge] (#1639)
7bddf89a2 refactor(frontend): move Lala's Feed out of Producer Mode [skip-automerge] (#1633)
31929a89a docs: record the event taxonomy ruling and schema plan [skip-automerge] (#1637)
e44828996 docs: fix PROJECT_CONTEXT.md's Basis line for #1632 [skip-automerge] (#1636)
6a3bdd9d2 docs: refresh PROJECT_CONTEXT.md §6.5 and §7 [skip-automerge] (#1632)
8e182f50c feat(frontend): New Episode starts at Lala's Feed in choose-host mode [skip-automerge] (#1630)
672f0a5bf docs(audit): file the 2026-09-20/21 deploy record [skip-automerge] (#1629)
```

Seven commits, matching Evoni's own count. PRs #1629, #1630, #1632, #1636,
#1637, #1633, #1639. `git diff --stat` over the same range confirms
exactly one file under `src/` changed and none under `src/migrations/` or
`package.json`:

```
 src/routes/worldStudio.js | 7 +++++--
 1 file changed, 5 insertions(+), 2 deletions(-)
```

## §3. Schema change — 2026-09-22 ~13:00 UTC, direct SQL on the production database

**ATTESTED.** Via `psql` 17.9 on the production box, over SSL.

As the application user `episode_app_dev`: database `episode_metadata`;
`world_events` had 57 rows; `event_date` (`character varying(50)`,
nullable) and `venue_location_id` (`uuid`, nullable) were present;
`category` and `format` were absent. The table's owner is `postgres`, and
the application user cannot alter it. No RDS snapshot was taken, by
Evoni's choice.

Evoni connected as `postgres` (password entered interactively) and ran:

```sql
ALTER TABLE world_events ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS format VARCHAR(50);
```

Verified afterward: both columns `character varying(50)`, nullable; 57
rows still present; `has_column_privilege` for `episode_app_dev` returned
`true` for SELECT, INSERT, and UPDATE on `category`, and UPDATE on
`format`.

The repository's migration file
`src/migrations/20260922000000-add-category-format-to-world-events.js`
(present in Deploy B's range, §4 below) was **not** run by the migration
tool for this change, and the migration-tracking table was not touched.
The live schema now matches what that migration would produce, but the
tool's own record of what has run does not reflect it.

## §4. Deploy B — 2026-09-22 ~13:40–13:48 UTC, frontend and backend

**ATTESTED.** Evoni moved the tree from
`d0babdf801790dd62aa5540c8aaa132e9b9ed97e` to
`7c200d159b29254a4921cdbfa1686e71668bd24d`, five commits. Her own package
and migration diff showed exactly one file — the migration named in §3,
already applied by that point. Nine `src/` files changed.

`node -c` passed on all nine changed backend files; requiring
`src/models/WorldEvent` succeeded. Build took 31.86s; `dist` was stamped
13:44.

Backup `/var/www/html.bak-20260922-pre1649` (5.8M); served entry
`index-Dn-nVfj9.js` → `index-DptWIZp2.js`; HTTP 200.

`pm2 restart episode-api-prod-hotfix`: restart count 10 → 11, online;
`/health` returned 200; the startup log showed only the three familiar
notices.

**MEASURED**, `git log --oneline
d0babdf801790dd62aa5540c8aaa132e9b9ed97e..7c200d159b29254a4921cdbfa1686e71668bd24d`:

```
7c200d159 refactor(frontend): Events tab as a queue of event packages [skip-automerge] (#1649)
a433477a7 fix(models): declare WorldEvent date, time and venue fields [skip-automerge] (#1647)
7d5b65983 feat(frontend): Event Package page with summaries and readiness [skip-automerge] (#1643)
ea1744934 fix(services): use the host's city and venues for event venues [skip-automerge] (#1645)
c37fbaca3 feat: add category and format to world_events, wire known call sites [skip-automerge] (#1641)
```

Five commits, matching Evoni's own count. PRs #1641, #1645, #1643, #1647,
#1649. `git diff --stat` over the same range confirms exactly nine `src/`
files changed, and exactly one file under `src/migrations/` (none under
`package.json`):

```
 src/migrations/20260922000000-add-category-format-to-world-events.js |  48 ++++++++
 src/models/WorldEvent.js                                             |  90 +++++++++++++-
 src/routes/calendarRoutes.js                                         |   3 +
 src/routes/wardrobeEventRoutes.js                                    |  13 +-
 src/routes/worldEvents.js                                            | 133 ++++++++++++++++++---
 src/services/careerPipelineService.js                                |   7 +-
 src/services/episodeScriptWriterService.js                           |   7 ++
 src/services/eventAutomationService.js                                |   5 +-
 src/services/feedPostGeneratorService.js                             |   7 +-
 9 files changed, 289 insertions(+), 24 deletions(-)
```

```
 src/migrations/20260922000000-add-category-format-to-world-events.js | 48 ++++++++++++++++++++++
 1 file changed, 48 insertions(+)
```

## §5. Log observations — 2026-09-22, after Deploy B

**ATTESTED.** No error mentioning `category` or `format` appeared after
the 13:48 restart.

13 occurrences of `ActivityLog insert failed: column "action_type" of
relation "activity_logs" does not exist`, first seen 2026-09-21 21:54 —
**after** the log check recorded in
`F-Deploy-1_Deploy_2026-09-20_2026-09-21.md` §5. That prior check ran
after Deploy 3 finished (21:38:34 UTC) and found no `"column … does not
exist"` error in any file under `logs/` at the time it ran. This record
takes that as established: the prior check was accurate for what it
observed at the time it ran; this specific error began after that check,
not before it, so its absence there is not a miss.

One failure (two log lines) at 2026-09-22 13:25:54: `[world-map] Upload
error: InvalidAccessKeyId`. See §6.

## §6. S3 credential replacement — 2026-09-22 ~14:40 UTC

**ATTESTED**, from the production host and the AWS IAM console.

The production `.env` contains no AWS key settings — the names present
are `AWS_REGION`, `AWS_ACCOUNT_ID`, `S3_PRIMARY_BUCKET`,
`S3_THUMBNAILS_BUCKET`. `ecosystem.config.js` contains no AWS key either.

`~/.aws/credentials`, dated 2026-02-18, profile `[default]`, held a key ID
ending `RVGV`.

IAM console: two users exist, `episode-metadata-ci-cd` and `evoni-admin`;
neither holds a key ending `RVGV`. `episode-metadata-ci-cd` was created
2026-01-01; its then-current key was 134 days old, last used 129 days
ago. Its policies: `AmazonEC2ContainerRegistryPowerUser` and
`AmazonECS_FullAccess` (AWS managed), plus inline
`EpisodeMetadataS3Access`, `S3AccessPolicy`, `S3AIBucketsAccess`,
`SQSVideoProcessingAccess`.

A second access key was created for `episode-metadata-ci-cd`, described
"prod-box 2026-09-22", stored in Evoni's password manager.

Backup made: `~/.aws/credentials.bak-20260922`. The credentials file was
updated to a key ID ending `LGXO`; an STS identity check returned
`user/episode-metadata-ci-cd`.

`pm2 restart episode-api-prod-hotfix`: restart count 11 → 12, online;
`/health` returned 200. The world-map upload from §5 was retried and
succeeded; no new `InvalidAccessKeyId` or `AccessDenied` error appeared
afterward.

## §7. Related, by citation only — not re-derived, not ruled on

**The `activity_logs` errors (§5) and PE #43–#47.**
`docs/audit/Session_PE_Roster.md` PE #43–#47 (filed 2026-05-15) document
the same family of defect — a column or relation missing on live prod
RDS that a model or write path expects. None of PE #43–#47 names
`activity_logs.action_type`; this is a new instance of that pattern, not
a recurrence of any of the five roster entries. Cited for the pattern
only.

**The deleted key (§6) and F-Deploy-1's credential-exposure record.**
`docs/audit/F-Deploy-1_Incident_pm2jlist_SecretExposure_2026-06-30.md`
independently identified a leaked AWS IAM access key ending `RVGV` as
already dead — matching neither of the two live IAM users' keys at the
time — and recorded it as "deleted / already-rotated" on 2026-06-30. The
key replaced in §6 above, read from `~/.aws/credentials` dated
2026-02-18, also ends `RVGV`. This record does not re-verify beyond the
matching last four characters that the two are the same key, and takes
no further position — it notes the match and stops there.

**The migration's direct-SQL method (§3) and FD-66.**
`docs/audit/FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md`
§7.1 records the ruled direction that migrations are the single source
of schema truth, and that a baseline migration reconciling the deployed
schema against the migration history is owed before that direction's
remaining open items are closed. §3's `ALTER TABLE`, run directly and not
through the migration tool, is exactly the kind of schema change that
divergence work will need to account for: the live schema now matches
`20260922000000-add-category-format-to-world-events.js`, but the
migration-tracking table does not record it as applied. This record does
not rule on whether this specific divergence is in scope of FD-66's
baseline work — that is FD-66's own document to state.

## §8. Observations — not findings, not ruled on

- `event_date` is stored as `character varying(50)`, not a date/timestamp
  type (confirmed again in §3's read).
- `world_events` is owned by `postgres`; the application user
  `episode_app_dev` cannot alter it and could not have made §3's change
  itself.
- `episode-metadata-ci-cd` holds `AmazonEC2ContainerRegistryPowerUser` and
  `AmazonECS_FullAccess` in addition to its S3/SQS inline policies — ECS
  and ECR permissions beyond anything this deploy record's own actions
  used.

None of the three above is characterized as a defect, ruled on, or
assigned an owner here.

## §9. What this document does not do

This document:

- does not rule on whether §3's schema change is in scope of FD-66's
  owed baseline migration, or on any other open question FD-66 or
  PE #43–#47 carry;
- does not confirm that the key identified in §6 is the same key
  `F-Deploy-1_Incident_pm2jlist_SecretExposure_2026-06-30.md` found dead
  — only that their last four characters match;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision;
- mints no FD, XK, or PE number;
- amends no filed document —
  `F-Deploy-1_Deploy_2026-09-20_2026-09-21.md`,
  `F-Deploy-1_Incident_pm2jlist_SecretExposure_2026-06-30.md`, and
  `FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md` are cited
  above, not edited;
- performs no deploy, database change, or credential change of its own,
  and makes no host, AWS, database, or Cognito contact — every ATTESTED
  claim above is Evoni's own account, taken outside any agent session;
  every MEASURED claim is a repository read this filing session
  performed itself, against `origin/main`, not against any host;
- records no secret and no account number anywhere above — key IDs
  appear only by their last four characters.

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

Unchanged from the last register tail check this session found
(`F-Deploy-1_Deploy_2026-09-20_2026-09-21.md` §8). Nothing minted here.

## §Standing

§1–§6 each carry an ATTESTED clause (Evoni's own account of actions and
reads made personally, on the production host, in the production
database session, or in the AWS IAM console — not reproducible from a
clone) and, where a commit range is involved, a MEASURED clause (a `git
log`/`diff` read against this repository, reproducible by anyone with a
clone), marked separately, never merged into one standing. §7 and §8
carry no independent standing beyond the citations and reads they name.
Nothing in this document is labelled RULED. No host, AWS, database, or
Cognito contact was made by the agent session that filed it — every
MEASURED claim above reads this repository only. Production's freeze is
lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never
touch hosts, AWS, RDS, or Cognito (`CLAUDE.md`), unchanged by that lift or
by this record.
