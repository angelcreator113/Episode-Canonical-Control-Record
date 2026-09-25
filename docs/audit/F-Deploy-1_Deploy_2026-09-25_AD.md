| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AD, 2026-09-25, backend only, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-24_2026-09-25.md` (the X–AC record). This
document follows that one rather than editing it. Basis: `51e64f3ff6ffec209b0f95bbfa3432eff4562c88`
(#1882), the tree Deploy AD moved production to. `origin/main` at filing
is `608a5d2c499a32eb81a02f1eb12631cb7b9dbb6f`, five commits past the basis
(§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Two standings appear below, each marked on its own claim and
never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production
  host or database states. It cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce.

This document closes no keystone, discharges no owed item, mints no FD,
XK or PE number, and rules on nothing.

The deploy is lettered AD, continuing after Deploy AC of the X–AC record.

## §0. Evoni's account, verbatim

**ATTESTED (Evoni, 2026-09-25, issue #1889):**

> Deploy AD — 2026-09-25 ~16:10 UTC, backend only, no frontend build or bundle backup: 79b9a5e6 → 51e64f3f, nine commits (#1868, #1872, #1873, #1874, #1878, #1879, #1880, #1881, #1882), 15 files under src/, node -c passed on all 15. Restart 42 → 43; health 200. Pre-deploy checks: check-pending-migrations --report-only named episode-control-dev…/episode_metadata as episode_app_dev and showed the same 3 pending of 215; no deleted_at column exists on any of character_therapy_profiles, character_arcs, wardrobe_content_assignments, hair_library, makeup_library or universe_characters (0 rows); hair_library and makeup_library both hold 0 rows, so paranoid: false deletes nothing existing. No migrations in the range. git status showed only the four known .bak files.

The sections below split this account into its claims and set each
beside what the repository measures.

## §1. Identity and continuity

**ATTESTED.**
- The tree moved from `79b9a5e6` to `51e64f3f`.
- `git status` showed only the four known untracked `.bak` files. That
  matches the X–AC record §1.
- No frontend build and no bundle backup.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 79b9a5e6b 51e64f3ff origin/main
79b9a5e6b02426edd38327333cb981e53132e620
51e64f3ff6ffec209b0f95bbfa3432eff4562c88
608a5d2c499a32eb81a02f1eb12631cb7b9dbb6f
$ git merge-base --is-ancestor 79b9a5e6b 51e64f3ff; echo "exit=$?"
exit=0
```

Deploy AC ends at `79b9a5e6b` (X–AC record §8, §11); Deploy AD begins
there.

## §2. Deploy AD — 2026-09-25 ~16:10 UTC, backend only

**ATTESTED.**
- Nine commits (#1868, #1872, #1873, #1874, #1878, #1879, #1880, #1881,
  #1882), 15 files under `src/`.
- `node -c` passed on all 15.
- `pm2 restart`: restart count 42 → 43. `/health` returned 200.
- No migrations in the range.

**MEASURED**, `git log --oneline --first-parent 79b9a5e6b..51e64f3ff`:

```
51e64f3ff docs(workflow): §7's production-box row reflects the lifted freeze [skip-automerge] (#1882)
246cf38c1 fix(routes): hair and makeup replace-generate validates first, then runs in one transaction [skip-automerge] (#1881)
d319bb967 ci: model-vs-migration columns run as a ratchet [skip-automerge] (#1880)
196df046a fix(models): writes store the values they send — seven dropped columns declared (#1870 step 1) [skip-automerge] (#1879)
b440ae989 fix(events): the relationship stage's selection rules [skip-automerge] (#1878)
7f63ca8fd fix(models): six paranoid models whose tables have no deleted_at [skip-automerge] (#1874)
a2e83b8f1 ci: the schema-agreement check runs as a ratchet [skip-automerge] (#1873)
0a0f15931 docs(audit): file the deploy record for Deploys X–AC [skip-automerge] (#1872)
37512e1b6 docs: read where code disagrees with the schema [skip-automerge] (#1868)
```

```
$ git rev-list --count --first-parent 79b9a5e6b..51e64f3ff
9
$ git rev-list --count 79b9a5e6b..51e64f3ff
9
```

Nine commits, the same nine PR numbers, matching Evoni's count.
`git diff --stat 79b9a5e6b 51e64f3ff -- src/`:

```
 src/models/CharacterArc.js              |   5 ++
 src/models/CharacterTherapyProfile.js   |   5 ++
 src/models/HairLibrary.js               |  12 ++++
 src/models/MakeupLibrary.js             |  12 ++++
 src/models/Opportunity.js               |   3 +
 src/models/RegistryCharacter.js         |   5 ++
 src/models/SceneSet.js                  |   4 ++
 src/models/StorytellerBook.js           |  13 ++++
 src/models/ThumbnailComposition.js      |  16 +++++
 src/models/UniverseCharacter.js         |   5 ++
 src/models/WardrobeContentAssignment.js |   6 ++
 src/models/WorldEvent.js                |  15 ++++-
 src/routes/hairLibraryRoutes.js         | 103 ++++++++++++++++++++++++------
 src/routes/makeupLibraryRoutes.js       | 107 +++++++++++++++++++++++++-------
 src/services/eventAutomationService.js  |  78 ++++++++++++++++-------
 15 files changed, 325 insertions(+), 64 deletions(-)
```

Fifteen files, matching Evoni's count. `git diff --stat`, scoped to
`frontend/` and to `src/migrations/`:

```
$ git diff --stat 79b9a5e6b 51e64f3ff -- frontend/
$ echo "exit=$?"
exit=0
$ git diff --stat 79b9a5e6b 51e64f3ff -- src/migrations/
$ echo "exit=$?"
exit=0
```

No output for either: no frontend change, consistent with no frontend
build; no migration in the range, matching Evoni's account. The tree at
the basis still has 215 migration files:

```
$ git ls-files src/migrations | wc -l
215
```

- **`node -c`.** The filing session ran `node -c` on the same 15 files
  in its own clone (`git diff --name-only 51e64f3ff HEAD` over them is
  empty, so its copies are the basis's): each printed nothing and was
  followed by `ok <file>`, 15 of 15. That is a repository read; the
  host's own `node -c` run is ATTESTED.
- **Packages.** The whole range changes `package.json` and
  `package-lock.json` by one line each, both the pinned `@babel/parser`
  devDependency, and only #1873 touches them:

```
$ git diff 79b9a5e6b 51e64f3ff -- package.json package-lock.json
diff --git a/package-lock.json b/package-lock.json
index 28738925f..4d4ceb84f 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -57,6 +57,7 @@
         "winston-cloudwatch": "^6.2.0"
       },
       "devDependencies": {
+        "@babel/parser": "7.29.0",
         "cross-env": "^10.1.0",
         "eslint": "^8.55.0",
         "eslint-config-prettier": "^9.1.2",
diff --git a/package.json b/package.json
index 176734b9e..aa548323a 100644
--- a/package.json
+++ b/package.json
@@ -106,6 +106,7 @@
     "winston-cloudwatch": "^6.2.0"
   },
   "devDependencies": {
+    "@babel/parser": "7.29.0",
     "cross-env": "^10.1.0",
     "eslint": "^8.55.0",
     "eslint-config-prettier": "^9.1.2",
$ git log --format='%h %s' 79b9a5e6b..51e64f3ff -- package.json package-lock.json
a2e83b8f1 ci: the schema-agreement check runs as a ratchet [skip-automerge] (#1873)
```

  It is a devDependency (`package.json:109` at `51e64f3ff`) used by
  `scripts/check-schema-agreement.js`; no runtime dependency changed.
  Whether an install was run on the host is not attested and is not
  inferred here.
- **Outside `src/`**, the range changes docs (#1868, #1872, #1882),
  `scripts/check-schema-agreement.js` and its two baselines (#1868,
  #1873, #1880), `.github/workflows/validate.yml` and
  `.claude/skills/validate/SKILL.md` (#1873, #1880), and tests (#1874,
  #1878, #1879, #1881). `git diff --stat 79b9a5e6b 51e64f3ff`: 32 files,
  4242 insertions, 69 deletions. None of these is served.

**Counts, side by side.**

| Claim | ATTESTED | MEASURED |
|---|---|---|
| Commits | 9 (#1868, #1872, #1873, #1874, #1878, #1879, #1880, #1881, #1882) | 9 first-parent, 9 total; the same nine PR numbers |
| Files under `src/` | 15 | 15 |
| Frontend | none (no build, no bundle backup) | no output under `frontend/` |
| Migrations | none in the range | no output under `src/migrations/` |

No count differs.

## §3. The time

**ATTESTED:** 2026-09-25 ~16:10 UTC.

**MEASURED:** the end commit `51e64f3ff` (#1882) was committed
2026-09-25 15:13:05 UTC:

```
$ git log -1 --format=%cI 51e64f3ff
2026-09-25T11:13:05-04:00
$ TZ=UTC git log --first-parent --format='%h %cd %s' --date=iso-local 79b9a5e6b..51e64f3ff
51e64f3ff 2026-09-25 15:13:05 +0000 docs(workflow): §7's production-box row reflects the lifted freeze [skip-automerge] (#1882)
246cf38c1 2026-09-25 15:09:58 +0000 fix(routes): hair and makeup replace-generate validates first, then runs in one transaction [skip-automerge] (#1881)
d319bb967 2026-09-25 15:07:00 +0000 ci: model-vs-migration columns run as a ratchet [skip-automerge] (#1880)
196df046a 2026-09-25 14:59:30 +0000 fix(models): writes store the values they send — seven dropped columns declared (#1870 step 1) [skip-automerge] (#1879)
b440ae989 2026-09-25 14:47:58 +0000 fix(events): the relationship stage's selection rules [skip-automerge] (#1878)
7f63ca8fd 2026-09-25 14:40:19 +0000 fix(models): six paranoid models whose tables have no deleted_at [skip-automerge] (#1874)
a2e83b8f1 2026-09-25 14:37:09 +0000 ci: the schema-agreement check runs as a ratchet [skip-automerge] (#1873)
0a0f15931 2026-09-25 14:28:48 +0000 docs(audit): file the deploy record for Deploys X–AC [skip-automerge] (#1872)
37512e1b6 2026-09-25 14:18:08 +0000 docs: read where code disagrees with the schema [skip-automerge] (#1868)
```

| Deploy | ATTESTED time | MEASURED: committer date of the attested end commit |
|---|---|---|
| AD | 2026-09-25 ~16:10 | `51e64f3ff` 2026-09-25 15:13:05 |

The attested ~16:10 is after that merge.

## §4. Pre-deploy checks

### §4.1 `scripts/check-pending-migrations.js --report-only`

**ATTESTED.** Before the restart the check ran with `--report-only`. It
named `episode-control-dev…/episode_metadata` as `episode_app_dev` and
showed the same 3 pending of 215 files as the first run (X–AC record
§8.1).

**What the target names.** The target the check prints is the script's
own config, not the running API's. That is the wording #1882 put in
`DEVELOPMENT_WORKFLOW.md` §7, production-box row (line 245 at
`51e64f3ff`):

> the 2026-09-25 pending-migration check named canon only for the script's own config, not the running API's.

The same row marks the `.env` premise "**Not re-verified since the v1.53
lift**". This record applies that wording to this second run as well: the
target it names is the one the script's config resolves to on the host.

**MEASURED**, only as far as the script goes:
`scripts/check-pending-migrations.js` at `51e64f3ff` connects with
"dotenv .env plus the src/config/sequelize.js block for the current
NODE_ENV" (header comment, line 20), builds its ledger reader from
`config[env]` (lines 114–116), and prints the target as
`NODE_ENV=<env> → <host>:<port>/<database> as <username>` (line 105).
It reads no state from the running API process. With `--report-only` it
exits 0 despite pending files (lines 15, 92). This record does not rule
on which database the running API serves.

### §4.2 The two database reads

**ATTESTED (Evoni).** Recorded as the results she obtained, with no
ruling on what they mean:

1. **No `deleted_at` column** exists on any of
   `character_therapy_profiles`, `character_arcs`,
   `wardrobe_content_assignments`, `hair_library`, `makeup_library` or
   `universe_characters` (0 rows returned).
2. **`hair_library` and `makeup_library` both hold 0 rows**, so
   `paranoid: false` deletes nothing existing.

**What these two reads are.** They are the measurements of production
that the repository could not make for itself:

- `docs/SCHEMA_AGREEMENT_READ.md` §2.1 (#1868) marks the same six tables'
  `deleted_at` as **ABSENT** from the 2026-09-17 canon capture, a
  capture-based finding, and says "The first six are MEASURED absent in
  the capture" (line 267 at `51e64f3ff`). Read 1 is Evoni's own read of
  the live database for the same six tables.
- `docs/audit/Paranoid_Exposure_SixModels_Note_2026-09-25.md` §3 (#1874)
  says whether either library table holds rows "is not measured here",
  that the tables are "**INFERRED** to be empty", and that "The read-only
  count query in the PR for Task #1869 settles it" (lines 156–160 at
  `51e64f3ff`). Read 2 is that count.

With these two reads, both claims stand as ATTESTED facts about
production on 2026-09-25, before the restart. Neither source document is
edited; each keeps its own standing as filed.

**MEASURED**, the models the reads bear on: at `51e64f3ff` each of the
six sets `paranoid: false`:

```
$ git grep -n "paranoid: false" 51e64f3ff -- src/models/CharacterArc.js src/models/CharacterTherapyProfile.js src/models/HairLibrary.js src/models/MakeupLibrary.js src/models/UniverseCharacter.js src/models/WardrobeContentAssignment.js
51e64f3ff:src/models/CharacterArc.js:59:    paranoid: false,
51e64f3ff:src/models/CharacterTherapyProfile.js:23:    paranoid: false,
51e64f3ff:src/models/HairLibrary.js:111:      paranoid: false,
51e64f3ff:src/models/MakeupLibrary.js:119:      paranoid: false,
51e64f3ff:src/models/UniverseCharacter.js:85:    paranoid: false,
51e64f3ff:src/models/WardrobeContentAssignment.js:30:    paranoid: false,
```

## §5. What went live

**MEASURED**, from the commits' own diffs and messages at `51e64f3ff`.
That these are live rests on the ATTESTED deploy (§2).

- **The relationship stage under #1866's rules (#1878, `b440ae989`,
  `Task: #1866`).** `assembleGuestList` in
  `src/services/eventAutomationService.js`: a `secret_link` never
  invites (line 411); `direction` NULL reads as `'mutual'` (line 412);
  only mutual or host-to-guest direction invites (lines 413–415, and the
  where clause, lines 436–441); rows are ordered `id ASC` with no
  `drama_level` ordering and no row limit (line 445; comment line 419),
  and eligibility applies before `maxGuests` (line 471). Deploy AC
  (#1867) made this stage query the real columns; AD adds the selection
  rules.
- **Hair and makeup libraries working for the first time (#1874,
  `7f63ca8fd`; #1881, `246cf38c1`).** #1874 sets `paranoid: false` on
  both (`HairLibrary.js:111`, `MakeupLibrary.js:119`) and maps
  `is_justAWoman_style` to its real column with
  `field: 'is_justAWoman_style'` (`HairLibrary.js:82`,
  `MakeupLibrary.js:85`). Its note says "after this change the two
  libraries work for the first time" (§3, line 150). #1881 makes `POST /generate`
  with `replace_existing` validate the parsed response before any
  destroy, then run the destroy and every create in one
  `db.sequelize.transaction` (`hairLibraryRoutes.js:262–267`,
  `makeupLibraryRoutes.js:262–267`). With §4.2's read 2, the destroy that
  `paranoid: false` turns into a real `DELETE` had no existing rows to
  remove at deploy time (ATTESTED).
- **Seven dropped-write sites declared (#1879, `196df046a`,
  `Task: #1870`).** The commit subject says "seven dropped columns
  declared"; its body names seven write sites and declares 13 columns on
  six models: `WorldEvent` `theme`, `mood`, `color_palette`,
  `floral_style`, `border_style` (from `WorldEvent.js:137`);
  `StorytellerBook` `current_arc_stage`, `arc_stage_scores`
  (`StorytellerBook.js:126`, `:130`); `ThumbnailComposition`
  `include_justawomaninherprime`, `justawomaninherprime_position`,
  `approval_status` (from `ThumbnailComposition.js:58`);
  `Opportunity.career_goal_id` (`Opportunity.js:89`);
  `RegistryCharacter.world_character_id` (`RegistryCharacter.js:633`);
  `SceneSet.canvas_settings` (`SceneSet.js:112`).
  `docs/SCHEMA_AGREEMENT_READ.md` §6 counts them as "(7 sites)" (line 358). Both
  counts are stated; no migration is added (the commit body: "no
  migration: the columns exist").
- **`/arc-stage` stores its `establishment` fallback.** At `51e64f3ff`,
  `calculateArcStage` in `src/routes/sceneProposeRoute.js` queries
  `StorytellerStory` by `book_id`/`arc_stage` (lines 81–84) and, on
  error, returns `{ stage: 'establishment', scores: {}, total: 0 }`
  (line 100). `POST /arc-stage` then writes
  `{ current_arc_stage: stage, arc_stage_scores: scores }` to
  `StorytellerBook` (lines 484–487). `docs/SCHEMA_AGREEMENT_READ.md`
  §1.1 records that the read "fails: column does not exist" (line 151)
  and that, before #1879, the update "issues no SQL" (line 191). With
  #1879's declarations, the update now carries both columns, so the
  route stores the fallback. Issue #1883 names this first:
  "`/arc-stage` now **stores** that fallback". Its fix merged after AD,
  as #1895 (`8a5ea42b9`, first-parent on `origin/main`), which makes
  `/arc-stage` answer 501 and write nothing when no stage is computed.
  `sceneProposeRoute.js` is unchanged between `51e64f3ff` and
  `348a02334`; #1895 is the first commit after the basis to change it.
  #1895 is not in AD (§8). Until a deploy carries it, production
  stores the fallback when this route is called. Whether it has been
  called is not attested and not inferred.

## §6. Restarts

**ATTESTED (Evoni).**

| Restart | Deploy |
|---|---|
| 42 → 43 | AD |

**Beside it, from the register.** Deploy AC's restart was 41 → 42
(X–AC record §8, §10). AD's 42 → 43 follows it with no gap.

## §7. Hand-run schema changes

**ATTESTED.** None in this deploy. **MEASURED:** no file under
`src/migrations/` changes in the range (§2).

## §8. Basis statement

**MEASURED.** After Deploy AD, production's tree is this record's basis,
`51e64f3ff`. No commit on `origin/main` up to and including `51e64f3ff`
is undeployed, on Evoni's attested list.

`origin/main` has moved past the basis since. **Merged after AD,
undeployed** (MEASURED at filing):

```
$ git log --oneline --first-parent 51e64f3ff..origin/main
608a5d2c4 fix(feed): bulk-job and scheduler streams authenticate [skip-automerge] (#1896)
8a5ea42b9 fix: hidden schema failures stop hiding (#1870 step 2) [skip-automerge] (#1895)
784866ef5 feat(frontend): Event Package suggests category and format [skip-automerge] (#1892)
348a02334 fix(feed): a taken handle is refused before generation, and Autofill never hands one back [skip-automerge] (#1891)
f7d452e74 fix(routes): approving an entanglement proposal creates its StoryTeller line [skip-automerge] (#1890)
```

Five commits, measured at `origin/main` = `608a5d2c4`. #1892 and #1896
change `frontend/` only; the next deploy needs a frontend build.

## §9. What this document does not do

This document:

- does not rule on what any database result in §4.2 means, or on which
  database the running API serves (§4.1), and re-derives no production
  data;
- does not edit `docs/SCHEMA_AGREEMENT_READ.md`,
  `Paranoid_Exposure_SixModels_Note_2026-09-25.md`,
  `DEVELOPMENT_WORKFLOW.md` or the X–AC record. Every document named
  above is cited, not edited;
- does not rule on #1883 or on whether `/arc-stage` has been called;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, database read or change, workflow dispatch, or
  credential change of its own, and makes no host, AWS, database or
  Cognito contact. Every ATTESTED claim above is Evoni's own account,
  taken outside any agent session. Every MEASURED claim is a repository
  read this filing session performed itself, not against any host;
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

Unchanged from the X–AC record §14. Nothing minted here.

## §Standing

- §1–§4 each carry an ATTESTED clause and a MEASURED clause, marked
  separately and never merged into one standing:
  - ATTESTED: Evoni's own account of actions taken personally on the
    production host and database, not reproducible from a clone;
  - MEASURED: a read of this repository, reproducible by anyone with a
    clone.
- No attested count differs from the measurement (§2). The time is
  recorded as attested, with the end commit's merge beside it (§3).
- §4.2 is ATTESTED for the database results.
- §5 is MEASURED for what the code does; that it is live rests on §2.
- Nothing in this document is labelled RULED, and nothing is INFERRED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
  agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1889.*
