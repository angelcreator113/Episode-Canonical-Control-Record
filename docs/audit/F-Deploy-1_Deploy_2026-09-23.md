| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Four production deploys — one late on 2026-09-22, not filed at the time, and three on 2026-09-23 — and the read-only production schema check that preceded Deploy B, all performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_Late_2026-09-22.md` — this document follows that
one rather than editing it. Basis: `origin/main` at
`5dc8a484bb72008a2f2788fda3be1804f1853a1c`, measured 2026-09-23. That
basis is the tree Deploy C (§6) moved production to; no commit on
`origin/main` falls after it.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Two standings appear below, each marked on its own claim, never
upgraded: **ATTESTED** for what only Evoni's own account of the
production host and database sessions states, not reproducible from a
clone, and **MEASURED** for what this repository itself shows — a
`git log`/`diff`/`grep` any clone can reproduce. This document closes no
keystone, discharges no owed item, mints no FD, XK, or PE number, and
rules on nothing.

## §1. Identity — Deploys A, B and C

**ATTESTED.** Instance `i-02ae7608c531db485`; tree `~/episode-metadata`.
`git status` showed only the four known untracked `.bak` files, unchanged
from the standing observation in `F-Deploy-1_Deploy_Late_2026-09-22.md`
§1 and the records it cites. `episode-worker` was stopped throughout
all three deploys. No package or migration change appeared in any of
the three. Deploy 0 (§2) carries only the identity facts its own
section states.

**MEASURED.** None of the four commit ranges below (§2, §3, §5, §6)
touches `src/migrations/`, `package.json`, or `package-lock.json`; each
command scoped to those paths printed nothing.

## §2. Deploy 0 — 2026-09-22 ~23:44–23:46 UTC, frontend only

**ATTESTED — from Evoni's session transcript, not a contemporaneous
record** (see §8). Evoni moved the tree from
`70cc93f4acec2912deb6680fc2efdcc95a8d2b7d` to
`1233d054170531f8e36eb43fd3b2467e059963e5`, two commits (#1690 and
#1692); no backend `src/` files changed; no API restart. `git status`
showed only the four known untracked `.bak` files.

Backup `/var/www/html.bak-20260923-pre1690` (5.8M); served entry
`index-DF9EvC2j.js` → `index-Bgcn9YAH.js`; a request with
`Host: primepisodes.com` returned HTTP 200. The frontend build took
33.95s. Disk: 890M free before and after.

The transcript as supplied does not state the instance, the tree path,
or `episode-worker`'s state for this deploy; this record does not carry
them over from §1.

**MEASURED**, `git log --oneline
70cc93f4acec2912deb6680fc2efdcc95a8d2b7d..1233d054170531f8e36eb43fd3b2467e059963e5`:

```
1233d0541 docs(audit): file the 2026-09-22 late deploy record [skip-automerge] (#1692)
b65defa56 feat(frontend): mark featured attendees with story roles [skip-automerge] (#1690)
```

Two commits (`git rev-list --count` over the range: `2`), matching
Evoni's own count. PRs #1690, #1692. `git diff --stat` over the same
range, scoped to `src/`, confirms zero files changed:

```
(no output)
```

Scoped to `src/migrations package.json package-lock.json`: no output.
The full (unscoped) diffstat:

```
 docs/audit/F-Deploy-1_Deploy_Late_2026-09-22.md | 280 ++++++++++++++++++++++++
 frontend/src/pages/EventPackagePage.css         |  57 ++++-
 frontend/src/pages/EventPackagePage.jsx         | 219 +++++++++++++++++-
 3 files changed, 548 insertions(+), 8 deletions(-)
```

— consistent with Evoni's account of a frontend-only deploy with no API
restart. The starting tree and entry match where
`F-Deploy-1_Deploy_Late_2026-09-22.md` §4 leaves production
(`70cc93f4`, `index-DF9EvC2j.js`); the ending tree and entry match where
Deploy A (§3) begins (`1233d054`, `index-Bgcn9YAH.js`). The restart
counts are consistent with no restart between them: 15 → 16 at the Late
record's Deploy C, 16 → 17 at Deploy A.

## §3. Deploy A — 2026-09-23 ~05:52–05:56 UTC, frontend and backend

**ATTESTED.** Evoni moved the tree from
`1233d054170531f8e36eb43fd3b2467e059963e5` to
`9f04c821d5fc6224613e824f0fda63a40a7f5534`, five commits. Four backend
files changed: `searchController.js`, `middleware/auth.js`,
`characterRegistry.js`, `episodeScriptWriterService.js`. `node -c`
passed on all four; requiring `middleware/auth` listed its exports,
including `userInGroup`.

Backup `/var/www/html.bak-20260923-pre1700`; served entry
`index-Bgcn9YAH.js` → `index-C1gwTz-E.js`; a request with
`Host: primepisodes.com` returned HTTP 200. The frontend build took
32.40s.

`pm2 restart`: restart count 16 → 17, online; `/health` returned 200;
the startup log showed only the OpenSearch fallback and the Node 22 and
AWS SDK v2 notices — the three familiar notices
`F-Deploy-1_Deploy_Late_2026-09-22.md` §4 already records.

Afterwards Evoni opened `/admin` in the application and it rendered with
its tools index, and opened World Dashboard from `UniversePage`. Both
are the doorways this deploy added (PR #1698, below).

**MEASURED**, `git log --oneline
1233d054170531f8e36eb43fd3b2467e059963e5..9f04c821d5fc6224613e824f0fda63a40a7f5534`:

```
9f04c821d docs(audit): file a note on CP6's Item 16 lock and the author-field read gap [skip-automerge] (#1702)
d5bc5ea96 fix(auth): role checks read Cognito groups [skip-automerge] (#1700)
39eca65aa feat(frontend): admin tools index and World Dashboard doorway [skip-automerge] (#1698)
0f443641d docs: propose the sidebar grouping [skip-automerge] (#1696)
6bf43c87c feat(services): scripts use featured attendees [skip-automerge] (#1694)
```

Five commits (`git rev-list --count` over the range: `5`), matching
Evoni's own count. PRs #1694, #1696, #1698, #1700, #1702. `git diff
--stat` over the same range, scoped to `src/`:

```
 src/controllers/searchController.js        |  5 +++--
 src/middleware/auth.js                     | 17 +++++++++++++++++
 src/routes/characterRegistry.js            |  7 ++++---
 src/services/episodeScriptWriterService.js | 24 ++++++++++++++++++++++--
 4 files changed, 46 insertions(+), 7 deletions(-)
```

Exactly the four files Evoni named. `userInGroup` appears in
`src/middleware/auth.js`'s `module.exports` at `9f04c821` (line 647),
consistent with her account of the require. Scoped to
`src/migrations package.json package-lock.json`: no output.

Outside `src/`, the range touches `docs/SIDEBAR_PROPOSAL.md`,
`docs/audit/F-AUTH-1_CP6_Item16Lock_AuthorFieldReadGap_MEASURED_2026-09-23.md`,
seven files under `frontend/src/` (`AdminPanel.jsx`, `AuditLog.jsx`,
`TemplateManagement.jsx`, `UniversePage.jsx`, `styles/AdminPanel.css`,
`utils/authGroups.js`, `utils/authGroups.test.js`), and five test files
under `tests/unit/` — consistent with Evoni's account of a frontend
build in this deploy.

## §4. Production schema check — 2026-09-23 ~13:36 UTC, read-only

**ATTESTED.** Via `psql`, as the application user on database
`episode_metadata`, over SSL, read-only, before Deploy B (§5):

- `phone_missions` has 14 columns; `phone_playthrough_state` has 12.
- `SequelizeMeta` records all four Phone Hub migrations:
  `20260730000000-create-phone-playthrough-state`,
  `20260731000000-create-phone-missions`,
  `20260801000000-add-reward-actions-to-missions`,
  `20260802000000-add-completed-mission-ids-to-playthrough`.

**MEASURED.** All four migration files exist in this repository's only
running migration tree at the basis:

```
$ ls src/migrations | grep -E "2026073[01]|2026080[12]"
20260730000000-create-phone-playthrough-state.js
20260731000000-create-phone-missions.js
20260801000000-add-reward-actions-to-missions.js
20260802000000-add-completed-mission-ids-to-playthrough.js
```

This record does not re-derive the column counts from those files; the
counts above are Evoni's reading of production, recorded as given.

## §5. Deploy B — 2026-09-23 ~13:40–13:43 UTC, backend

**ATTESTED.** Evoni moved the tree from
`9f04c821d5fc6224613e824f0fda63a40a7f5534` to
`ae7d6623ba607236754d1e6dedd56e4f035943cf`, ten commits. Ten backend
files changed: `middleware/authorOnlyFields.js` (new),
`models/index.js`, `characterDepthRoutes.js`,
`characterGenerationRoutes.js`, `characterGrowthRoute.js`,
`characterRegistry.js`, `compositions.js`, `memories/engine.js`,
`worldStudio.js`, `services/FilterService.js`. `node -c` passed on all
ten; requiring `authorOnlyFields` listed four exports.

Backup `/var/www/html.bak-20260923-pre1722`; the frontend entry was
unchanged at `index-C1gwTz-E.js`, as no frontend source changed this
deploy; HTTP 200. The frontend build took 32.73s.

`pm2 restart`: restart count 17 → 18, online; `/health` returned 200;
the startup log showed only the three familiar notices (§3).

A read-only log check afterwards found no error mentioning the new
middleware, the phone models, or the filter service after the restart.

**MEASURED**, `git log --oneline
9f04c821d5fc6224613e824f0fda63a40a7f5534..ae7d6623ba607236754d1e6dedd56e4f035943cf`:

```
ae7d6623b fix(models): export PhoneMission and PhonePlaythroughState [skip-automerge] (#1722)
947619a6d docs(audit): amend the runtime value-write read — an eleventh site [skip-automerge] (#1721)
c7fb58171 fix(services): parameterise the filter-options queries [skip-automerge] (#1718)
1cc4a688f docs: read whether the /interactive route can run [skip-automerge] (#1716)
c4b77ccb8 docs(audit): read the AI value interpolated into SQL [skip-automerge] (#1715)
ab51c7010 docs(audit): read the runtime-chosen column write paths [skip-automerge] (#1712)
f8644c945 fix(auth): whitelist and gate character-growth review writes [skip-automerge] (#1710)
715cf0527 docs: read what character-growth review can write [skip-automerge] (#1708)
60492c188 fix(auth): close the remaining author-field read leaks [skip-automerge] (#1707)
47f7c00a2 fix(auth): gate the author-only character fields [skip-automerge] (#1704)
```

Ten commits (`git rev-list --count` over the range: `10`), matching
Evoni's own count. PRs #1704, #1707, #1708, #1710, #1712, #1715, #1716,
#1718, #1721, #1722. Five of them are the fixes this deploy carried:

| PR | Commit | Backend files (`git show --name-only`, `src/` only) |
|---|---|---|
| #1704 | `47f7c00a2` | `src/middleware/authorOnlyFields.js`, `src/routes/characterDepthRoutes.js`, `src/routes/characterGenerationRoutes.js`, `src/routes/characterRegistry.js` |
| #1707 | `60492c188` | `src/routes/memories/engine.js`, `src/routes/worldStudio.js` |
| #1710 | `f8644c945` | `src/routes/characterGrowthRoute.js` |
| #1718 | `c7fb58171` | `src/routes/compositions.js`, `src/services/FilterService.js` |
| #1722 | `ae7d6623b` | `src/models/index.js` |

The other five (#1708, #1712, #1715, #1716, #1721) are reads and
register filings; they change no file under `src/`. `git diff --stat`
over the range, scoped to `src/`:

```
 src/middleware/authorOnlyFields.js      | 55 +++++++++++++++++++++++++++++++++
 src/models/index.js                     |  4 +++
 src/routes/characterDepthRoutes.js      | 45 +++++++++++++++------------
 src/routes/characterGenerationRoutes.js | 17 ++++++++--
 src/routes/characterGrowthRoute.js      | 37 ++++++++++++++++++++++
 src/routes/characterRegistry.js         |  7 +++++
 src/routes/compositions.js              |  7 +++++
 src/routes/memories/engine.js           |  9 ++++--
 src/routes/worldStudio.js               |  8 ++++-
 src/services/FilterService.js           | 30 +++++++++---------
 10 files changed, 180 insertions(+), 39 deletions(-)
```

Exactly the ten files Evoni named. `src/middleware/authorOnlyFields.js`
at `ae7d6623` exports four names (`AUTHOR_ONLY_FIELDS`,
`canAccessAuthorFields`, `stripAuthorOnlyFields`,
`hideAuthorOnlyFieldsFromNonAdmins`), consistent with her account of the
require. Scoped to `src/migrations package.json package-lock.json`: no
output. Outside `src/`, the range touches only `docs/` (the five reads
and filings) and six test files under `tests/unit/` — no file under
`frontend/`, consistent with the unchanged served entry.

## §6. Deploy C — 2026-09-23 ~14:20 UTC, frontend only

**ATTESTED.** Evoni moved the tree from
`ae7d6623ba607236754d1e6dedd56e4f035943cf` to
`5dc8a484bb72008a2f2788fda3be1804f1853a1c`, one commit; no backend
`src/` files changed; no API restart.

Backup `/var/www/html.bak-20260923-pre1724`; served entry
`index-C1gwTz-E.js` → `index-BRI34et4.js`; HTTP 200. The frontend build
took 31.91s.

**MEASURED**, `git log --oneline
ae7d6623ba607236754d1e6dedd56e4f035943cf..5dc8a484bb72008a2f2788fda3be1804f1853a1c`:

```
5dc8a484b fix(frontend): repair the dead navigation links [skip-automerge] (#1724)
```

One commit, matching Evoni's own count. PR #1724. `git diff --stat`
over the same range, scoped to `src/`, confirms zero files changed:

```
(no output)
```

Scoped to `src/migrations package.json package-lock.json`: no output.
Outside `src/`, the range touches thirteen files, all under
`frontend/src/` — consistent with Evoni's account of no API restart.

## §7. Related, by citation only — not re-derived, not ruled on

**The records this one follows.** `F-Deploy-1_Deploy_Late_2026-09-22.md`
(filed by #1692), and through it `F-Deploy-1_Deploy_Evening_2026-09-22.md`,
`F-Deploy-1_Deploy_2026-09-22.md`,
`F-Deploy-1_Deploy_2026-09-20_2026-09-21.md` and
`F-Deploy-1_Deploy_2026-09-20.md`. None is edited here.

**The filed reads Deploy B's fixes answer.** Each pairing below is
MEASURED only to this extent: the read's own basis precedes the fix, and
the read names the code the fix changed. What each read holds is not
restated here, and no read is thereby discharged.

| Fix | Read it relates to |
|---|---|
| #1704 | `docs/audit/F-AUTH-1_CP6_Item16Lock_AuthorFieldReadGap_MEASURED_2026-09-23.md` (basis `d5bc5ea9`, #1700; shipped in Deploy A), §2a and §3 |
| #1707 | the same note, through #1704: Task #1705's own text states the two routes #1707 filters were reported by #1704. The note itself names neither route (`grep -n "story-engine-add-character\|re-sync"` over it prints nothing) |
| #1710 | `docs/CHARACTER_GROWTH_REVIEW_READ.md` (basis `47f7c00a`, #1704; outside `docs/audit/`), §7 |
| #1718 | `docs/audit/F-AUTH-1_AIValueInSQL_TierFeatures_Read_MEASURED_2026-09-23.md` (basis `ab51c701`, #1712), which names `FilterService.getFilterOptions`; read with its amendment `docs/audit/F-AUTH-1_AIValueInSQL_TierFeatures_Read_Amd1_MEASURED_2026-09-23.md` (basis `c7fb5817`, #1718 itself), whose §4 records the count after #1718 |
| #1722 | `docs/INTERACTIVE_ROUTE_READ.md` (basis `ab51c701`; outside `docs/audit/`), §4.2 |

`docs/audit/F-AUTH-1_RuntimeColumnWrites_Read_MEASURED_2026-09-23.md`
(basis `f8644c94`, #1710) is filed after #1710 and cites it; its path 23
is where `docs/INTERACTIVE_ROUTE_READ.md` begins. It is listed for
completeness; no Deploy B fix is paired to it here. The #1707 pairing
rests on one ATTESTED line — an issue's text, not the repository.

## §8. Observations — not findings, not ruled on

- **ATTESTED (Evoni).** Deploy B was the first deploy to run a
  production schema check before deploying (§4), and that check was what
  cleared #1722 to ship: exporting `PhoneMission` and
  `PhonePlaythroughState` makes routes query those tables, so their
  existence in production was the precondition.
- **MEASURED, for context only.** Two earlier deploy records hold `psql`
  sessions on the production database:
  `F-Deploy-1_Deploy_2026-09-22.md` §3 (a schema change by direct SQL)
  and `F-Deploy-1_Deploy_Evening_2026-09-22.md` §3 (a data change). Both
  are recorded as changes; neither is recorded as a read-only check made
  before a deploy. This record does not rule on "first" beyond that.
- **Deploy 0 was not filed at the time.** It is recorded in §2 as
  ATTESTED from Evoni's session transcript, supplied after the fact,
  not from a contemporaneous deploy record. The Late record left #1690's
  deploy "for the next one"; this is that record.
- **The gap was found by measurement, not reported.** This filing
  session found it by comparing served entry names across the filed
  records: `F-Deploy-1_Deploy_Late_2026-09-22.md` §4 leaves production
  at `index-DF9EvC2j.js`, while Deploy A's attested starting entry was
  `index-Bgcn9YAH.js`, and `git log` between the two trees held two
  commits no record covered (§2's MEASURED block). Evoni did not report
  the gap; she supplied §2's facts once the session raised it.
- **A date in a name.** Deploy 0's backup is named
  `html.bak-20260923-pre1690`, while its time is 2026-09-22 ~23:44 UTC.
  Both are recorded as given; this record does not reconcile them.

None of the observations above is characterized as a defect, ruled on,
or assigned an owner in this document.

## §9. What this document does not do

This document:

- does not treat Deploy 0 (§2) as contemporaneously recorded — it is
  attested from a transcript after the fact, and says so (§8);
- does not re-derive the production column counts in §4 from the
  migration files — they are Evoni's reading, recorded as given;
- does not restate or re-verify any read cited in §7, and does not
  discharge any of them — a fix shipping is not a ruling that a read's
  question is closed;
- does not rule on whether Deploy B's schema check was the first (§8);
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision;
- makes no fix, and mints no FD, XK, or PE number;
- amends no filed document — every document named above is cited, not
  edited;
- performs no deploy, database read or change, or credential change of
  its own, and makes no host, AWS, database, or Cognito contact — every
  ATTESTED claim above is Evoni's own account, taken outside any agent
  session; every MEASURED claim is a repository read this filing session
  performed itself, against `origin/main`, not against any host;
- records no secret anywhere above.

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

Unchanged from `F-Deploy-1_Deploy_Late_2026-09-22.md` §9. Nothing
minted here.

## §Standing

§1–§6 each carry an ATTESTED clause (Evoni's own account of actions and
reads made personally, on the production host or database — not
reproducible from a clone; §2's from a transcript, as it says) and a MEASURED clause (a read of this
repository, reproducible by anyone with a clone), marked separately,
never merged into one standing. §7 carries no standing beyond the
citations and reads it names, plus the one ATTESTED line it marks. §8
marks each observation's standing on the observation. Nothing in this
document is labelled RULED. No host, AWS, database, or Cognito contact
was made by the agent session that filed it. Production's freeze is
lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never
touch hosts, AWS, RDS, or Cognito (`CLAUDE.md`), unchanged by that lift
or by this record.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1725.*
