| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AF, 2026-09-25, backend and frontend, with a hand-run migration, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-25_AE.md` (the AE record, #1904). This
document follows that one rather than editing it. Basis: `5d39e9c24fe712bf91bae41500b286b1621d8b9a`
(#1922), the tree Deploy AF moved production to. `origin/main` at filing
is the same commit, `5d39e9c24fe712bf91bae41500b286b1621d8b9a` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Three standings appear below, each marked on its own claim and
never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production
  host or database states. It cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce.
- **NOT ATTESTED** marks a post-deploy check that Evoni's account does
  not report (§5.1). Nothing is inferred in its place.

This document closes no keystone, discharges no owed item, mints no FD,
XK or PE number, and rules on nothing.

The deploy is lettered AF, continuing after Deploy AE of the AE record.
It is the first deploy in this series with a hand-run migration (§7).

## §0. Evoni's account, verbatim

**ATTESTED (Evoni, 2026-09-25, issue #1923):**

> Deploy AF — 2026-09-25 ~21:58 UTC, backend and frontend, with a migration: b67f6ae3 → 5d39e9c2, eight commits (#1903, #1904, #1911, #1912, #1913, #1914, #1915, #1922), 26 files under src/, node -c passed on all 26. Migration 20260925000000-add-draft-columns-to-thumbnail-compositions.js run by hand as postgres before the code, in one transaction: five columns added to thumbnail_compositions (draft_overrides, draft_updated_at, draft_updated_by, has_unsaved_changes, layout_overrides), SequelizeMeta row inserted, all five verified present before COMMIT. After it, the app user read has_unsaved_changes successfully and check-pending-migrations reported 3 pending of 216 — the same three as before. Backup /var/www/html.bak-20260925-pre1922; build 36.02s; entry index-SHpmn_L2.js → index-fBcuWgnP.js; HTTP 200. Restart 44 → 45; health 200. Error log clean.

> Restart 44 → 45, health `200`, clean log — nothing about `thumbnail_compositions`, so the model and the new columns agree.

The second paragraph is Evoni's own reading of the clean log; it is
recorded as she gave it and not upgraded (§9). The sections below split
this account into its claims and set each beside what the repository
measures. Evoni's production reads taken after the deploy are recorded
separately, in §7.1.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `b67f6ae3` to `5d39e9c2`. Evoni's
account gives no `git status` read for this deploy.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse b67f6ae34 5d39e9c24 origin/main
b67f6ae341e3de4cb3fdadcd89e7228799a5de97
5d39e9c24fe712bf91bae41500b286b1621d8b9a
5d39e9c24fe712bf91bae41500b286b1621d8b9a
$ git merge-base --is-ancestor b67f6ae34 5d39e9c24; echo "exit=$?"
exit=0
```

Deploy AE ends at `b67f6ae34` (AE record §1, §8); Deploy AF begins
there.

## §2. Deploy AF — 2026-09-25 ~21:58 UTC, backend and frontend, with a migration

**ATTESTED.**
- Eight commits (#1903, #1904, #1911, #1912, #1913, #1914, #1915,
  #1922), 26 files under `src/`.
- `node -c` passed on all 26.
- One migration, run by hand before the code (§7).
- `pm2 restart`: restart count 44 → 45. `/health` returned 200. Error
  log clean.

**MEASURED**, `git log --oneline --first-parent b67f6ae34..5d39e9c24`:

```
5d39e9c24 fix(schema-check): step 1 sees writes through a loaded record, and Save draft stops keeping nothing [skip-automerge] (#1922)
3030cbd16 fix(compositions): version history refuses cleanly while composition_versions is undecided [skip-automerge] (#1915)
2bbd46c5f feat(episodes): the Phone tab is Lala's Phone, not Missions [skip-automerge] (#1914)
b1958b778 fix(episodes): the episode knows its source event, and Start Episode guarantees the link [skip-automerge] (#1913)
243a1d6bc fix(frontend): Start Episode lands on Production Assets [skip-automerge] (#1912)
ea86e3e19 fix(feed): every path that creates or renames a social profile refuses a taken handle [skip-automerge] (#1911)
e1db21759 docs(audit): file the deploy record for Deploy AE [skip-automerge] (#1904)
1f7d80fa2 fix(models): approving a composition keeps who approved it and when, and edits bump current_version [skip-automerge] (#1903)
```

```
$ git rev-list --count --first-parent b67f6ae34..5d39e9c24
8
$ git rev-list --count b67f6ae34..5d39e9c24
8
```

Eight commits, the same eight PR numbers, matching Evoni's count.
`git diff --stat b67f6ae34 5d39e9c24 -- src/`:

```
 src/controllers/episodeAssetsController.js         |   3 +
 src/controllers/episodeController.js               |   2 +
 src/controllers/jobController.js                   |   5 +-
 ...-add-draft-columns-to-thumbnail-compositions.js |  89 ++++++++
 src/models/Asset.js                                |   7 +
 src/models/EpisodeWardrobe.js                      |   9 +
 src/models/RegistryCharacter.js                    |   9 +
 src/models/ThumbnailComposition.js                 |  49 +++++
 src/routes/characterCrossingRoutes.js              |  15 +-
 src/routes/characterGenerationRoutes.js            |  11 +
 src/routes/compositions.js                         |  73 ++++--
 src/routes/episodes.js                             |  22 ++
 src/routes/feedSchedulerRoutes.js                  |   7 +-
 src/routes/socialProfileBulkRoutes.js              | 110 ++++++---
 src/routes/socialProfileRoutes.js                  |  70 +++---
 src/services/AssetService.js                       |  29 ++-
 src/services/CompositionService.js                 |  10 +-
 src/services/FilterService.js                      |  25 ++-
 src/services/VersioningService.js                  |  12 +
 src/services/compositionDraftColumns.js            |  65 ++++++
 src/services/compositionVersionsGuard.js           |  45 ++++
 src/services/episodeEventsService.js               | 115 ++++++++++
 src/services/episodeGeneratorService.js            | 245 ++++++++++++---------
 src/services/feedAutoGeneration.js                 |  21 +-
 src/services/feedScheduler.js                      |  38 +++-
 src/utils/socialProfileHandle.js                   |  93 ++++++++
 26 files changed, 945 insertions(+), 234 deletions(-)
```

Twenty-six files, matching Evoni's count. The fourth line is the
migration, `src/migrations/20260925000000-add-draft-columns-to-thumbnail-compositions.js`
(truncated by `--stat`); it is one of the 26. `git diff --stat
b67f6ae34 5d39e9c24 -- frontend/`:

```
 .../src/components/Episodes/EpisodeAssetsTab.jsx   |   8 +-
 .../components/Episodes/EpisodeLalasPhoneTab.css   | 251 +++++++++++++++++++++
 .../components/Episodes/EpisodeLalasPhoneTab.jsx   | 233 +++++++++++++++++++
 .../Episodes/EpisodeLalasPhoneTab.test.jsx         | 226 +++++++++++++++++++
 .../src/components/Episodes/EpisodeOverviewTab.jsx |  20 +-
 .../Episodes/EpisodePhoneMissionsTab.jsx           |  17 +-
 .../Episodes/EpisodeProductionChecklist.jsx        |   7 +-
 .../Episodes/episodeEventReaders.test.jsx          |  53 +++++
 frontend/src/components/FeedBulkImport.jsx         |  15 +-
 frontend/src/pages/EpisodeDetail.jsx               |  47 ++--
 frontend/src/pages/EpisodeDetail.test.jsx          |  40 +++-
 frontend/src/pages/EpisodeDetail.wardrobe.test.jsx | 140 ++++++++++++
 frontend/src/pages/EventPackagePage.jsx            |   6 +-
 .../pages/EventPackagePage.startEpisode.test.jsx   | 112 +++++++++
 frontend/src/pages/WorldAdmin.jsx                  |   8 +-
 frontend/src/pages/WorldAdmin.openEpisode.test.jsx |  68 ++++++
 frontend/src/services/episodeEventsApi.js          |  19 ++
 17 files changed, 1213 insertions(+), 57 deletions(-)
```

Seventeen files, six of them tests (`*.test.jsx`:
`EpisodeLalasPhoneTab.test.jsx`, `episodeEventReaders.test.jsx`,
`EpisodeDetail.test.jsx`, `EpisodeDetail.wardrobe.test.jsx`,
`EventPackagePage.startEpisode.test.jsx`,
`WorldAdmin.openEpisode.test.jsx`); eleven are source that the build
bundles. Evoni's account gives no `frontend/` file count; it attests a
build (§2.1). `git diff --stat` scoped to `src/migrations/`, to
`package.json`/`package-lock.json`, and to `docs/`:

```
$ git diff --stat b67f6ae34 5d39e9c24 -- src/migrations/
 ...-add-draft-columns-to-thumbnail-compositions.js | 89 ++++++++++++++++++++++
 1 file changed, 89 insertions(+)
$ git diff --name-status b67f6ae34 5d39e9c24 -- src/migrations/
A	src/migrations/20260925000000-add-draft-columns-to-thumbnail-compositions.js
$ git diff --stat b67f6ae34 5d39e9c24 -- package.json package-lock.json
$ echo "exit=$?"
exit=0
$ git diff --stat b67f6ae34 5d39e9c24 -- docs/
 docs/audit/F-Deploy-1_Deploy_2026-09-25_AE.md | 483 ++++++++++++++++++++++++++
 1 file changed, 483 insertions(+)
$ git ls-tree -r --name-only b67f6ae34 src/migrations | wc -l
215
$ git ls-files src/migrations | wc -l
216
```

One migration file added (status `A`), matching Evoni's account; the
tree goes from 215 migration files at `b67f6ae34` to 216 at the basis
(§7). No package change. One `docs/` file, the AE record itself
(#1904).

- **`node -c`.** The filing session ran `node -c` on the same 26 files
  in its own clone (`git diff --name-only 5d39e9c24 HEAD` is empty, so
  its copies are the basis's): the run over all 26 ended `all 26 ok`.
  That is a repository read; the host's own `node -c` run is ATTESTED.
- **Outside `src/`, `frontend/` and `docs/`**, the range changes four
  files under `scripts/` (`check-schema-agreement.js`,
  `schema-agreement.baseline`, `schema-agreement-step2.baseline`,
  `silent-catches.baseline`; #1903, #1913, #1922) and seventeen files
  under `tests/` (one fixture, one helper, fifteen test files; #1903,
  #1911, #1913, #1915, #1922). `git diff --stat b67f6ae34 5d39e9c24`:
  65 files, 4469 insertions, 345 deletions. None of these is served.

**Classification**, from each commit's own `git show --stat`:

| Commit | PR | Class | Served files it changes |
|---|---|---|---|
| `1f7d80fa2` | #1903 | backend | `src/models/ThumbnailComposition.js`, `src/services/CompositionService.js` |
| `e1db21759` | #1904 | docs | `docs/audit/F-Deploy-1_Deploy_2026-09-25_AE.md` (not served) |
| `ea86e3e19` | #1911 | both | 7 files under `src/` (`characterGenerationRoutes.js`, `feedSchedulerRoutes.js`, `socialProfileBulkRoutes.js`, `socialProfileRoutes.js`, `feedAutoGeneration.js`, `feedScheduler.js`, `utils/socialProfileHandle.js`); `frontend/src/components/FeedBulkImport.jsx` |
| `243a1d6bc` | #1912 | frontend | `EventPackagePage.jsx`, `WorldAdmin.jsx` (plus 3 test files) |
| `b1958b778` | #1913 | both | `src/routes/episodes.js`, `src/services/episodeEventsService.js`, `src/services/episodeGeneratorService.js`; `EpisodeAssetsTab.jsx`, `EpisodeOverviewTab.jsx`, `EpisodeProductionChecklist.jsx`, `EpisodeDetail.jsx`, `services/episodeEventsApi.js` (plus 2 test files) |
| `2bbd46c5f` | #1914 | frontend | `EpisodeLalasPhoneTab.jsx`, `.css`, `EpisodePhoneMissionsTab.jsx`, `EpisodeDetail.jsx` (plus 1 test file) |
| `3030cbd16` | #1915 | backend | `src/routes/compositions.js`, `src/services/FilterService.js`, `src/services/VersioningService.js`, `src/services/compositionVersionsGuard.js` |
| `5d39e9c24` | #1922 | backend and migration | 12 files under `src/`, one of them the migration `src/migrations/20260925000000-add-draft-columns-to-thumbnail-compositions.js`; the others are `episodeAssetsController.js`, `episodeController.js`, `jobController.js`, `models/Asset.js`, `models/EpisodeWardrobe.js`, `models/RegistryCharacter.js`, `models/ThumbnailComposition.js`, `characterCrossingRoutes.js`, `compositions.js`, `AssetService.js`, `compositionDraftColumns.js` |

Per commit, `src/` files are 2 + 7 + 3 + 4 + 12 = 28;
`ThumbnailComposition.js` (#1903, #1922) and `compositions.js` (#1915,
#1922) are each touched twice, giving the net 26. Per commit,
`frontend/` files are 1 + 5 + 7 + 6 = 19 (tests included);
`EpisodeDetail.jsx` (#1913, #1914) and `EpisodeDetail.test.jsx` (#1912,
#1914) are each touched twice, giving the net 17. #1922 is the only
commit that touches `src/migrations/`.

**Counts, side by side.**

| Claim | ATTESTED | MEASURED |
|---|---|---|
| Commits | 8 (#1903, #1904, #1911, #1912, #1913, #1914, #1915, #1922) | 8 first-parent, 8 total; the same eight PR numbers |
| Files under `src/` | 26 | 26, the migration among them |
| Frontend | a build (§2.1); no file count given | 17 files under `frontend/`, 6 of them tests |
| Migrations | one, `20260925000000-add-draft-columns-to-thumbnail-compositions.js` | one file added under `src/migrations/`, the same name; 215 → 216 files |
| Packages | not stated | no output for `package.json`/`package-lock.json` |

No count differs.

### §2.1 Frontend

**ATTESTED (Evoni).**
- Backup of the served bundle: `/var/www/html.bak-20260925-pre1922`.
- Frontend build: 36.02s.
- Entry bundle: `index-SHpmn_L2.js` → `index-fBcuWgnP.js`.
- HTTP 200 after the deploy.

**Beside it, from the register.** The AE record §2.1 attests AE's entry
bundle as `index-DKapwGXl.js` → `index-SHpmn_L2.js`; AF's attested
starting name is AE's attested ending name. Both halves of that are
ATTESTED.

**What the repository cannot confirm.** Bundle hashes are produced by a
build on the host and are not committed (`frontend/dist/` is not in the
tree), so no read of this repository confirms either entry name, the
build time, the backup path or the HTTP status. All four stay ATTESTED.

### §2.2 Housekeeping: a pending host restart

**ATTESTED (Evoni).** The box wants a system restart. Recorded as a
pending host action, with no ruling. The filing session does not act on
it and measures nothing here; the repository holds no record of the
host's package or reboot state.

## §3. The time

**ATTESTED:** 2026-09-25 ~21:58 UTC.

**MEASURED:** the end commit `5d39e9c24` (#1922) was committed
2026-09-25 21:27:37 UTC:

```
$ git log -1 --format=%cI 5d39e9c24
2026-09-25T17:27:37-04:00
$ TZ=UTC git log --first-parent --format='%h %cd %s' --date=iso-local b67f6ae34..5d39e9c24
5d39e9c24 2026-09-25 21:27:37 +0000 fix(schema-check): step 1 sees writes through a loaded record, and Save draft stops keeping nothing [skip-automerge] (#1922)
3030cbd16 2026-09-25 19:00:00 +0000 fix(compositions): version history refuses cleanly while composition_versions is undecided [skip-automerge] (#1915)
2bbd46c5f 2026-09-25 18:54:40 +0000 feat(episodes): the Phone tab is Lala's Phone, not Missions [skip-automerge] (#1914)
b1958b778 2026-09-25 18:49:57 +0000 fix(episodes): the episode knows its source event, and Start Episode guarantees the link [skip-automerge] (#1913)
243a1d6bc 2026-09-25 18:45:47 +0000 fix(frontend): Start Episode lands on Production Assets [skip-automerge] (#1912)
ea86e3e19 2026-09-25 18:23:58 +0000 fix(feed): every path that creates or renames a social profile refuses a taken handle [skip-automerge] (#1911)
e1db21759 2026-09-25 17:57:24 +0000 docs(audit): file the deploy record for Deploy AE [skip-automerge] (#1904)
1f7d80fa2 2026-09-25 17:52:32 +0000 fix(models): approving a composition keeps who approved it and when, and edits bump current_version [skip-automerge] (#1903)
```

| Deploy | ATTESTED time | MEASURED: committer date of the attested end commit |
|---|---|---|
| AF | 2026-09-25 ~21:58 | `5d39e9c24` 2026-09-25 21:27:37 |

The attested ~21:58 is after that merge.

## §4. Pre-deploy checks

### §4.1 `scripts/check-pending-migrations.js`

**ATTESTED.** After the migration (§7) the check reported 3 pending of
216, "the same three as before". Evoni's account does not state the
flag or the target the check printed for this run.

**Beside it, from the register.** The AD record §4.1 and the AE record
§4.1 each attest the same 3 pending of 215.

**MEASURED**, as far as the repository goes:

- The tree has 215 migration files at `b67f6ae34` and 216 at the basis
  (§2). The one added is
  `20260925000000-add-draft-columns-to-thumbnail-compositions.js`
  (#1922), the file Evoni attests she ran by hand and recorded in
  `SequelizeMeta` (§7). So the total went from 215 to 216 because this
  migration was added, and with it recorded, the pending count is
  unchanged at 3. The same three remain pending; which three they are is
  ATTESTED (AD/AE records §4.1), not measured here.
- `scripts/check-pending-migrations.js` and `DEVELOPMENT_WORKFLOW.md`
  are unchanged in the range (`git diff --stat b67f6ae34 5d39e9c24 --
  DEVELOPMENT_WORKFLOW.md scripts/check-pending-migrations.js` prints
  nothing). The script connects with "dotenv .env plus the
  src/config/sequelize.js block for the current NODE_ENV" (header
  comment, line 20), builds its ledger reader from `config[env]` (lines
  114–116), and prints the target as
  `NODE_ENV=<env> → <host>:<port>/<database> as <username>` (line 105).

**What the target names.** The target the check prints is the script's
own config, not the running API's. That is the wording the AD and AE
records §4.1 quote from `DEVELOPMENT_WORKFLOW.md` §7, production-box row
(line 245, unchanged at `5d39e9c24`):

> the 2026-09-25 pending-migration check named canon only for the script's own config, not the running API's.

This record applies that wording to this run as well. It does not rule
on which database the running API serves; that the app user could read
the new column (§7) is ATTESTED.

## §5. What went live

**MEASURED**, from the commits' own diffs and messages, lines cited at
`5d39e9c24`. That these are live rests on the ATTESTED deploy (§2). The
PR numbers are the merged PRs; the task numbers are from each commit
body.

- **Approving a composition keeps who and when; edits bump
  `current_version` (#1903, `1f7d80fa2`, `Task: #1897`).**
  `ThumbnailComposition` declares `approved_by` (STRING) and
  `approved_at` (DATE) (`src/models/ThumbnailComposition.js` lines
  78–85; comment lines 73–77). `CompositionService.updateComposition`
  increments `current_version` (`src/services/CompositionService.js`
  line 428; comment lines 425–427: "`version` is undeclared, so writing
  it was dropped"). The commit body: "Per Evoni's ruling (2026-09-25),
  `version` stays undeclared."
- **The AE record (#1904, `e1db21759`, `Task: #1901`).**
  `docs/audit/F-Deploy-1_Deploy_2026-09-25_AE.md`, 483 lines added. Not
  served.
- **Every path that creates or renames a social profile refuses a taken
  handle; the bulk overwrite is gone (#1911, `ea86e3e19`,
  `Task: #1893`).** `findHandleHolder` moves to
  `src/utils/socialProfileHandle.js` (line 48) with an `excludeId`
  option (lines 53–54) and a `handleTakenBody` 409 shape (line 76).
  Callers: `POST /generate` and autofill in
  `src/routes/socialProfileRoutes.js` (lines 345–347, 748); `PUT /:id`
  and `PATCH /:id` through `refuseTakenRename` (lines 304–315, called at
  1763 and 1810), which excludes the profile's own id; `POST
  /confirm-feed` in `src/routes/characterGenerationRoutes.js` (lines
  219–223); bulk generate in `src/routes/socialProfileBulkRoutes.js`
  (checks at lines 110 and 200, skipped items reported by
  `skippedResult`, line 100; "a plain create. The old findOrCreate
  reused an existing …", line 156); `feedScheduler` (line 532) and
  `feedAutoGeneration` (line 87). The commit body: "the !created update
  branch is removed", and "Known limit: a race window remains between
  check and insert (no unique index on social_profiles.handle)."
- **Start → Assets and Open → Overview (#1912, `243a1d6bc`,
  `Task: #1905`).** `EventPackagePage.jsx` navigates to
  `/episodes/${ep.id}?tab=assets` after Start (line 817).
  `WorldAdmin.jsx` navigates to `?tab=overview` from the events queue
  card for a used event (line 2756) and from the blueprint panel's Open
  Episode (line 5166). The commit body: "EpisodeDetail's default tab
  stays 'checklist'."
- **One episode–event reader, the Wardrobe gate fix, and a transactional
  Start (#1913, `b1958b778`, `Task: #1906`).** New
  `GET /api/v1/episodes/:id/events` with `requireAuth`
  (`src/routes/episodes.js` line 306), backed by `listEpisodeEvents`
  (`src/services/episodeEventsService.js` line 58; the anchor from
  `EpisodeBrief.event_id`, line 64; additional events by
  `used_in_episode_id`, line 69). In `EpisodeDetail.jsx` the Wardrobe
  effect is gated on `tabKey !== 'production.wardrobe'` (line 312) and
  reads `getEpisodeEvents` (line 320). `generateEpisodeFromEvent`
  creates the Episode, the Brief and the event stamp in one
  `models.sequelize.transaction` (`src/services/episodeGeneratorService.js`
  line 623; stamp at line 713); `stampEventUsed` throws when the UPDATE
  matches no row (lines 413–420).
- **Lala's Phone (#1914, `2bbd46c5f`, `Task: #1908`).** Production →
  Phone renders `EpisodeLalasPhoneTab` with `onPreview={phone.start}`
  (`EpisodeDetail.jsx` lines 840–841; lazy import, line 19). The tab
  leads with the Preview Phone button
  (`frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx` lines
  129–131), reads `/api/v1/ui-overlays/:showId?episode_id=` (line 35)
  and `/api/v1/feed-enhanced/:showId/moments/:episodeId` (line 44),
  shows "Requirements appear once beats exist" (line 220), and keeps
  `EpisodePhoneMissionsTab` as a section (import, line 5). It does not
  call `GET /api/v1/episodes/:id/phone-state` (comment, line 19).
- **The version-history 501 guard (#1915, `3030cbd16`,
  `Task: #1910`).** `src/services/compositionVersionsGuard.js` holds
  `COMPOSITION_VERSIONS_IN_CANON = false` (line 24) and throws with
  status 501 and code `COMPOSITION_VERSIONS_UNDECIDED` (lines 26–35).
  Every `VersioningService` method calls it first
  (`src/services/VersioningService.js` lines 21, 60, 92, 149, 249, 271,
  298). The five version routes map it to 501 through
  `versionRouteError` (`src/routes/compositions.js` lines 985–990;
  routes at lines 996, 1019, 1047, 1077, 1110). `FilterService` selects
  `NULL` for `version_count` and `last_version_date`
  (`src/services/FilterService.js` lines 157–158).
- **The loaded-record check, Save draft's migration and guard, and the
  `version_history` save fix (#1922, `5d39e9c24`, `Task: #1909`).**
  - Step 1 of `scripts/check-schema-agreement.js` now checks
    `x.update(...)` and `x.attr = …; x.save()` on loaded records (commit
    body; not served).
  - The migration
    `src/migrations/20260925000000-add-draft-columns-to-thumbnail-compositions.js`
    (§7), and `ThumbnailComposition` declares the same five columns
    (`src/models/ThumbnailComposition.js` lines 157–177; comment lines
    150–156: "run it BEFORE deploying this declaration").
  - `POST /:id/save-draft` and `POST /:id/apply-draft` answer 501
    `DRAFT_COLUMNS_MISSING` while `draftColumnsReady` is false
    (`src/routes/compositions.js` lines 1447–1448, 1502–1503);
    `draftColumnsReady` reads the table with `describeTable` and
    memoises a true answer (`src/services/compositionDraftColumns.js`
    lines 47–54, code line 59).
  - apply-draft builds a new `version_history` object instead of editing
    the loaded one (`src/routes/compositions.js` lines 1537–1551, written
    at line 1560).
  - The loaded-record sites the extended step 1 reported are declared or
    their writes removed, per the commit body: among them
    `ThumbnailComposition.published_at` (model line 90),
    `EpisodeWardrobe.is_episode_favorite` (`src/models/EpisodeWardrobe.js`
    line 66), `Asset.s3_key_processed` and three `RegistryCharacter`
    columns.

### §5.1 Post-deploy checks not attested

The PRs named behaviour that production had never shown. Evoni's
account (§0) attests the HTTP 200, `/health` 200, a clean error log, and
the app user's read of `has_unsaved_changes` (§7). It attests none of
the first-time behaviours below. Each is **NOT ATTESTED at filing**, and
none is inferred:

| PR | What to watch | Standing |
|---|---|---|
| #1912 | Start Episode lands on Production → Assets | NOT ATTESTED |
| #1913 | Production → Wardrobe shows the episode's event | NOT ATTESTED |
| #1914 | The Phone tab leads with Preview Phone | NOT ATTESTED |
| #1922 | Save draft persists across a reload | NOT ATTESTED |
| #1915 | The version routes answer 501 | NOT ATTESTED |
| #1896 (carried from the AE record §5.1) | Stream events arrive live through nginx, not buffered into one burst | NOT ATTESTED |
| #1896 (carried from the AE record §5.1) | No doubled updates between live events and the REST refresh | NOT ATTESTED |
| #1900 (carried from the AE record §5.1) | The Assistant streams, and an AI Writer action returns text | NOT ATTESTED |

The HTTP 200, `/health` 200 and clean log of §2 are page and process
checks; they are not these.

## §6. Restarts

**ATTESTED (Evoni).**

| Restart | Deploy |
|---|---|
| 44 → 45 | AF |

**Beside it, from the register.** Deploy AE's restart was 43 → 44 (AE
record §6). AF's 44 → 45 follows it with no gap.

## §7. Hand-run schema changes

**ATTESTED (Evoni).** The first hand-run migration in this series:

- **File:** `20260925000000-add-draft-columns-to-thumbnail-compositions.js`.
- **Run by hand as `postgres`.**
- **Before the code**, in **one transaction**.
- **Five columns added** to `thumbnail_compositions`: `draft_overrides`,
  `draft_updated_at`, `draft_updated_by`, `has_unsaved_changes`,
  `layout_overrides`.
- **The `SequelizeMeta` row inserted.**
- **All five verified present before `COMMIT`.**
- **Afterwards**, the app user read `has_unsaved_changes` successfully.
- **`check-pending-migrations`** then reported 3 pending of 216, "the
  same three as before" (§4.1).

**MEASURED**, the migration file at `5d39e9c24`:

| Column | Type in the file | Nullability / default | Lines |
|---|---|---|---|
| `draft_overrides` | `Sequelize.JSONB` | `allowNull: true` | 34–38 |
| `draft_updated_at` | `Sequelize.DATE` | `allowNull: true` | 39–43 |
| `draft_updated_by` | `Sequelize.STRING(255)` | `allowNull: true` | 44–48 |
| `has_unsaved_changes` | `Sequelize.BOOLEAN` | `allowNull: false`, `defaultValue: false` | 49–54 |
| `layout_overrides` | `Sequelize.JSONB` | `allowNull: true` | 55–59 |

The file's five columns are the five Evoni names, with the same names.
`up` adds each with `addColumn` only when `describeTable` does not
already show it (lines 63–81); `down` removes them (lines 83–88). The
header states the deploy order: "run this migration, then deploy the
code" (line 28). `ThumbnailComposition` declares the same five with the
same types (`src/models/ThumbnailComposition.js` lines 157–177). Evoni's
account gives no column types, so the types above are the file's, not
attested.

What the repository cannot confirm: that the columns exist in
production, the database role used, the transaction, the
`SequelizeMeta` row, or the app user's read. All stay ATTESTED. The
repository records no hand-run SQL; which statements Evoni ran is not
measured.

### §7.1 Production reads after AF

**ATTESTED (Evoni, 2026-09-25, after the deploy).** Three read-only
production reads, each recorded with the issue that acts on it and no
ruling beyond that citation:

| Read | ATTESTED result | Acted on by |
|---|---|---|
| `episode_wardrobe` columns | Exactly 11: `id`, `episode_id`, `wardrobe_id`, `scene`, `scene_id`, `notes`, `worn_at`, `times_worn`, `is_episode_favorite`, `created_at`, `updated_at`. `approval_status`, `approved_by`, `approved_at` and `rejection_reason` are all absent. | #1924 |
| `to_regclass('public.composition_versions')` | null | #1910 / PR #1915 |
| `thumbnail_compositions` rows with a non-null `version` | zero | #1897 / PR #1903 |

**MEASURED**, beside each, only what the basis declares:

- `EpisodeWardrobe` (`src/models/EpisodeWardrobe.js`, `tableName:
  'episode_wardrobe'`, line 104) declares `approval_status`,
  `approved_by`, `approved_at` and `rejection_reason` (lines 71, 77, 82,
  87) and, since #1922, `is_episode_favorite` (line 66).
- `COMPOSITION_VERSIONS_IN_CANON` is `false` at the basis
  (`src/services/compositionVersionsGuard.js` line 24; §5).
- `ThumbnailComposition` declares `current_version` (line 119) and no
  `version` attribute; #1903 left `version` undeclared by Evoni's ruling
  (§5).

This record does not rule on any of the three; the issues above do.

## §8. Basis statement

**MEASURED.** After Deploy AF, production's tree is this record's basis,
`5d39e9c24`. No commit on `origin/main` up to and including `5d39e9c24`
is undeployed, on Evoni's attested list.

**Merged after AF, undeployed** (MEASURED at filing):

```
$ git log --oneline --first-parent 5d39e9c24..origin/main
```

No output: `origin/main` is `5d39e9c24` at filing (§1), so nothing has
merged after AF.

## §9. What this document does not do

This document:

- does not rule on which database the running API serves (§4.1), and
  re-derives no production data;
- does not upgrade Evoni's reading of the clean log ("so the model and
  the new columns agree", §0) beyond ATTESTED;
- does not confirm any bundle hash, backup path, build time or HTTP
  status (§2.1), or any fact of the hand-run migration beyond the file's
  own content (§7), and rules on none of them;
- does not rule on the pending host restart (§2.2), and does not act on
  it;
- does not rule on any §5.1 check, or on any §7.1 read beyond citing the
  issue that acts on it;
- does not edit the AE record, the AD record, `DEVELOPMENT_WORKFLOW.md`
  or any migration. Every document named above is cited, not edited;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS,
  database or Cognito contact. Every ATTESTED claim above is Evoni's own
  account, taken outside any agent session. Every MEASURED claim is a
  repository read this filing session performed itself, not against any
  host;
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

Unchanged from the AE record §10. Nothing minted here.

## §Standing

- §1–§4 and §7 each carry an ATTESTED clause and a MEASURED clause,
  marked separately and never merged into one standing:
  - ATTESTED: Evoni's own account of actions taken personally on the
    production host and database, not reproducible from a clone;
  - MEASURED: a read of this repository, reproducible by anyone with a
    clone.
- No attested count differs from the measurement (§2). The time is
  recorded as attested, with the end commit's merge beside it (§3).
- The hand-run migration is ATTESTED; the file's five columns and types
  are MEASURED beside it and match her five names (§7).
- §2.1 and §2.2 are ATTESTED only; the repository cannot confirm them.
- §5 is MEASURED for what the code does; that it is live rests on §2.
  §5.1's checks are NOT ATTESTED at filing.
- §7.1's three reads are ATTESTED, each cited to the issue that acts on
  it.
- Nothing in this document is labelled RULED, and nothing is INFERRED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
  agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1923.*
