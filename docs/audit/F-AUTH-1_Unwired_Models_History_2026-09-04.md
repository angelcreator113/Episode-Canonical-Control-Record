| **PRIME STUDIOS** **F-AUTH-1 — UNWIRED MODELS HISTORY** *Traces the git history of the six models `F-AUTH-1_Models_Subset_Enumeration_2026-09-04.md` found unwired or guard-referenced. Records history. Does not judge, rule, or fix.* |
| --- |

# F-AUTH-1 — Unwired Models History

**Document type: evidence, MEASURED.** Supplies material for a ruling on
the six models `F-AUTH-1_Models_Subset_Enumeration_2026-09-04.md` (PR
#1241) found unwired: `ScriptEditHistory`, `ScriptLearningProfile`,
`ScriptSuggestion`, `ShowArc`, `UiOverlayType` (never referenced anywhere
in `src/` outside their own file and `index.js`), and
`SocialProfileTemplate` (unregistered by all three of `index.js`'s
mechanisms, referenced once behind a guard). That enumeration
characterized nothing as a defect; this document does not either. It
does not conclude any model is dead code, abandoned, or missing wiring —
those conclusions are Evoni's. Authorized 2026-09-04, filed `docs(audit):
trace history of six unwired models`.

**Author:** Claude — Prime Studios. Repo-only read; no ruling.

**Status:** Evidence. Records history. Does not judge, rule, mint, or
recommend action.

---

# §1. Basis

```
$ git rev-parse origin/main
c0307604eb93ae0ae2ded0bed9e2a0631926194a
```

`origin/main` at `c0307604e`, 2026-09-04. Every read below is at this
SHA.

---

# §2. Current state, re-confirmed against the enumeration

```
$ for name in ScriptEditHistory ScriptLearningProfile ScriptSuggestion ShowArc UiOverlayType SocialProfileTemplate; do
    echo "$name: $(ls src/models/$name.js 2>&1), index.js mentions: $(grep -c "$name" src/models/index.js)"
  done
ScriptEditHistory: src/models/ScriptEditHistory.js, index.js mentions: 4
ScriptLearningProfile: src/models/ScriptLearningProfile.js, index.js mentions: 4
ScriptSuggestion: src/models/ScriptSuggestion.js, index.js mentions: 4
ShowArc: src/models/ShowArc.js, index.js mentions: 6
UiOverlayType: src/models/UiOverlayType.js, index.js mentions: 0
SocialProfileTemplate: src/models/SocialProfileTemplate.js, index.js mentions: 0

$ grep -c "SocialProfileTemplate" src/routes/socialProfileRoutes.js
9
```

All six files still exist; `index.js` mention counts and
`SocialProfileTemplate`'s guarded reference are unchanged from the
enumeration. Nothing to report and stop on — proceeding.

---

# §3. Adding commits

**Four distinct events cover the six models** (three of the six were
added together):

```
$ git log --diff-filter=A --format='%H %ad %s' --date=short -- src/models/ScriptEditHistory.js
7ae309f217268a8b7b357e4e20ff483b56bc884f 2026-02-08 feat: Week 4 Days 1-3.9 - Complete Lala Production System

$ git log --diff-filter=A --format='%H %ad %s' --date=short -- src/models/ScriptLearningProfile.js
7ae309f217268a8b7b357e4e20ff483b56bc884f 2026-02-08 feat: Week 4 Days 1-3.9 - Complete Lala Production System

$ git log --diff-filter=A --format='%H %ad %s' --date=short -- src/models/ScriptSuggestion.js
7ae309f217268a8b7b357e4e20ff483b56bc884f 2026-02-08 feat: Week 4 Days 1-3.9 - Complete Lala Production System

$ git log --diff-filter=A --format='%H %ad %s' --date=short -- src/models/ShowArc.js
204a8c67a5ddc536784f8e6a190ef260d31a5c7f 2026-04-11 Claude/enhance lala event feed m np vp (#522)

$ git log --diff-filter=A --format='%H %ad %s' --date=short -- src/models/UiOverlayType.js
35ba9c2a83fec8a9e5ec4cd57e6524e83b341083 2026-04-11 Fix overlay images, add overlay management, fix deploy script (#515)

$ git log --diff-filter=A --format='%H %ad %s' --date=short -- src/models/SocialProfileTemplate.js
fd52684319b0b7e4f3c69b24e57e7869cadf2e99 2026-03-16 Claude/fix feed generation v eo br (#253)
```

**Scope of each adding commit** (`git show --stat`, file count from
`git show --name-only`):

| Commit | Date | Subject | Files | +/- |
|---|---|---|---|---|
| `7ae309f2` | 2026-02-08 | `feat: Week 4 Days 1-3.9 - Complete Lala Production System` | 134 | +31963/-216 |
| `204a8c67` | 2026-04-11 | `Claude/enhance lala event feed m np vp (#522)` | 14 | +1445/-51 |
| `35ba9c2a` | 2026-04-11 | `Fix overlay images, add overlay management, fix deploy script (#515)` | 6 | +922/-57 |
| `fd526843` | 2026-03-16 | `Claude/fix feed generation v eo br (#253)` | 8 | +1946/-137 |

`7ae309f2` is large and broad — 52 `frontend/src` files, 10 `src/models`,
9 `src/routes`, 8 `src/migrations`, 7 `backend/src`, plus one each of
`src/services`, `src/controllers`. The three `Script*` models were three
of ten model files it added, alongside
`src/controllers/scriptsController.js`, `src/routes/scripts.js`,
`src/services/scriptsService.js`, and six other model files
(`CharacterProfile`, `DecisionLog`, `EditMap`, `LayerAsset`,
`ScriptTemplate`, `ShowConfig`).

`204a8c67` (`ShowArc`) also touched `src/routes/arcRoutes.js`,
`src/routes/careerGoals.js`, `src/routes/feedPostRoutes.js`,
`src/routes/uiOverlayRoutes.js`, `src/routes/worldEvents.js`,
`src/services/arcProgressionService.js`,
`src/services/uiOverlayService.js`, and `src/models/WorldEvent.js`.

`35ba9c2a` (`UiOverlayType`) touched only three application files besides
the model: `src/routes/uiOverlayRoutes.js`, `src/services/uiOverlayService.js`,
and one migration.

`fd526843` (`SocialProfileTemplate`) touched `src/routes/feedSchedulerRoutes.js`,
`src/routes/socialProfileRoutes.js`, `src/services/feedScheduler.js`, and
one migration, besides the model.

---

# §4. Registration timeline for the three `Script*` models

The three models created by `7ae309f2` were given
`module.exports.<Name> = <Name>` lines in that same commit:

```
$ git show 7ae309f217268a8b7b357e4e20ff483b56bc884f -- src/models/index.js | grep -n "Script"
137:+let ShowConfig, ScriptTemplate, ScriptLearningProfile, ScriptEditHistory, ScriptSuggestion;
148:+  // Script Generator models
150:+  ScriptTemplate = require('./ScriptTemplate')(sequelize);
151:+  ScriptLearningProfile = require('./ScriptLearningProfile')(sequelize);
152:+  ScriptEditHistory = require('./ScriptEditHistory')(sequelize);
153:+  ScriptSuggestion = require('./ScriptSuggestion')(sequelize);
...
205:+module.exports.ScriptTemplate = ScriptTemplate;
206:+module.exports.ScriptLearningProfile = ScriptLearningProfile;
207:+module.exports.ScriptEditHistory = ScriptEditHistory;
208:+module.exports.ScriptSuggestion = ScriptSuggestion;
```

They were **not** added to `requiredModels` at that time. A month later:

```
$ git show --format='%H %ad %s' --date=short --no-patch 0357ee48bf9631d3d496484b69f549e6dd982bf3
0357ee48bf9631d3d496484b69f549e6dd982bf3 2026-03-07 fix: audit model registration — add missing requiredModels, exports, and new sprint models

$ git show 0357ee48bf9631d3d496484b69f549e6dd982bf3 -- src/models/index.js | grep -n "Script"
8:      ShowConfig, ScriptTemplate, ScriptLearningProfile, ScriptEditHistory,
9:      ScriptSuggestion, TimelineData, LalaverseBrand, WardrobeBrandTag,
57:+  ScriptTemplate,
58:+  ScriptLearningProfile,
59:+  ScriptEditHistory,
60:+  ScriptSuggestion,
```

`0357ee48` (7 files, 353 insertions) added these three (and
`ScriptTemplate`) to `requiredModels` — the commit's own subject names
this as fixing "missing requiredModels, exports." Neither commit added
any of the three to `db.models`; no later commit does either (§6).

---

# §5. Migration-file presence

`src/migrations/` is, per this repo's own convention, the only migration
tree that runs.

```
$ grep -rl "script_edit_history\|script_learning_profiles\|script_suggestions" src/migrations/
(no output)

$ ls src/migrations/ | grep -i showarc
20260723000003-create-show-arcs.js

$ git show --name-only --format='' 35ba9c2a83fec8a9e5ec4cd57e6524e83b341083 | grep -i migration
20260723000002-overlay-lifecycle.js

$ git show --name-only --format='' fd52684319b0b7e4f3c69b24e57e7869cadf2e99 | grep -i migration
src/migrations/20260623000000-create-social-profile-templates.js
```

`ScriptEditHistory`, `ScriptLearningProfile`, and `ScriptSuggestion` each
declare a `tableName` (`script_edit_history`, `script_learning_profiles`,
`script_suggestions` respectively — read directly from each model file)
but no migration in `src/migrations/` creates any of the three tables, by
either table name or filename. `ShowArc`, `UiOverlayType`, and
`SocialProfileTemplate` each have a migration present in the tree.
Whether an unmigrated table's absence from the tree means the table
never existed, existed before this migration tree was adopted, or
something else, is not determined here — that would require reading the
database, which this document does not do.

---

# §6. `git log -S` — did any reference disappear?

```
$ git log -S'ScriptEditHistory' --format='%H %ad %s' --date=short -- src/
0357ee48bf9631d3d496484b69f549e6dd982bf3 2026-03-07 fix: audit model registration — add missing requiredModels, exports, and new sprint models
7ae309f217268a8b7b357e4e20ff483b56bc884f 2026-02-08 feat: Week 4 Days 1-3.9 - Complete Lala Production System

$ git log -S'ScriptLearningProfile' --format='%H %ad %s' --date=short -- src/
0357ee48bf9631d3d496484b69f549e6dd982bf3 2026-03-07 fix: audit model registration — add missing requiredModels, exports, and new sprint models
7ae309f217268a8b7b357e4e20ff483b56bc884f 2026-02-08 feat: Week 4 Days 1-3.9 - Complete Lala Production System

$ git log -S'ScriptSuggestion' --format='%H %ad %s' --date=short -- src/
0357ee48bf9631d3d496484b69f549e6dd982bf3 2026-03-07 fix: audit model registration — add missing requiredModels, exports, and new sprint models
7ae309f217268a8b7b357e4e20ff483b56bc884f 2026-02-08 feat: Week 4 Days 1-3.9 - Complete Lala Production System

$ git log -S'ShowArc' --format='%H %ad %s' --date=short -- src/
204a8c67a5ddc536784f8e6a190ef260d31a5c7f 2026-04-11 Claude/enhance lala event feed m np vp (#522)

$ git log -S'UiOverlayType' --format='%H %ad %s' --date=short -- src/
35ba9c2a83fec8a9e5ec4cd57e6524e83b341083 2026-04-11 Fix overlay images, add overlay management, fix deploy script (#515)

$ git log -S'SocialProfileTemplate' --format='%H %ad %s' --date=short -- src/
fd52684319b0b7e4f3c69b24e57e7869cadf2e99 2026-03-16 Claude/fix feed generation v eo br (#253)
3b0ff5beb0650db830907f3ef63cd6f18d0384c5 2026-03-16 Add 7 feed improvements: performance, reliability, and UX
```

For `ScriptEditHistory`, `ScriptLearningProfile`, and `ScriptSuggestion`:
exactly the two commits already discussed (§3, §4), both additions —
each diff line matching the name is a `+`, none a `-` (checked directly
in each commit's diff). No route, service, or other model file's
`.associate()` method has ever contained any of these three names at any
point `git log -S` can see.

For `ShowArc` and `UiOverlayType`: exactly one commit each — the adding
commit itself. No later commit touched the name's count in `src/` at
all.

For `SocialProfileTemplate`: two commits, both dated 2026-03-16.
`3b0ff5beb0650` ("Add 7 feed improvements...") is where
`src/models/SocialProfileTemplate.js`, its migration, and the guarded
route code first appear, per that commit's own file list. `fd52684319`
("Claude/fix feed generation v eo br (#253)") is a single-parent commit
whose own diff contains the same additions and whose message body
concatenates multiple `* ...` sub-messages, one of which is "Add 7 feed
improvements..." verbatim — consistent with a squash-merge landing
commit reproducing a feature branch's change, with the branch's own
commit (`3b0ff5be`) still reachable in this repository's history. Both
are recorded rather than one being picked as *the* commit.

---

# §7. `SocialProfileTemplate` — the guard and the model arrived together

```
$ git show fd52684319b0b7e4f3c69b24e57e7869cadf2e99 -- src/routes/socialProfileRoutes.js | grep -n "SocialProfileTemplate"
660:+// Templates stored in DB when SocialProfileTemplate model is available, otherwise in-memory fallback
666:+  if (db.SocialProfileTemplate) {
668:+      const templates = await db.SocialProfileTemplate.findAll({ order: [['created_at', 'DESC']] });
680:+    if (db.SocialProfileTemplate) {
...
```

Every line of the guard (`if (db.SocialProfileTemplate)`, four
occurrences, and the comment stating the fallback) is a `+` addition in
the same commit that adds the model file and its migration — the guard
did not arrive later. The commit message's own sub-section (quoted
verbatim, from the "Add 7 feed improvements" part of the body) states:

> "5. Move templates to database — new SocialProfileTemplate model with
> migration. Falls back to in-memory when table doesn't exist yet.
> Templates now persist across server restarts."

The model, its migration, and the guard were written as one unit,
described in the commit's own words as a fallback for a table that
"doesn't exist yet." Whether the table now exists, and whether that
changes anything about the guard or the registration gap, is not
determined here — no database was read.

---

# §8. `UiOverlayType` — the table it names is queried, not through it

`35ba9c2a`, the commit that added `UiOverlayType.js`, also added a
migration (`ui_overlay_types` table) and touched
`src/services/uiOverlayService.js`. That file's own commit-message
description (quoted verbatim):

> "New infrastructure:
> - Migration: ui_overlay_types table (show_id, type_key, name, category,
>   beat, description, prompt, sort_order) with paranoid soft-delete
> - Model: UiOverlayType with Sequelize paranoid mode
> - Service: getAllOverlayTypes() merges hardcoded defaults + DB custom types"

At this document's basis, `getAllOverlayTypes()` still queries the table
directly:

```
$ grep -n "getAllOverlayTypes\|ui_overlay_types" src/services/uiOverlayService.js
6: * All overlay/screen types are defined per-show in the ui_overlay_types table.
38:async function getAllOverlayTypes(showId, models) {
43:       FROM ui_overlay_types WHERE show_id = :showId AND deleted_at IS NULL
```

The service reads the same table the model's migration created, by raw
SQL (`models.sequelize.query(...)`), not through the Sequelize model
object — consistent with `UiOverlayType` never appearing in any of
`index.js`'s three mechanisms (§3, `F-AUTH-1_Models_Subset_Enumeration_2026-09-04.md`
§4) and never being referenced by name anywhere outside its own file.
The table the model represents is in active use; the model object is
not.

---

# §9. Classification, as an observation

| Model | Observation |
|---|---|
| `ScriptEditHistory` | **Never referenced** outside `index.js` and its own file, at any point in history. Registered via `module.exports` from creation (Feb 8); added to `requiredModels` a month later (Mar 7, described as fixing a registration gap); never in `db.models`. No migration creates its table. |
| `ScriptLearningProfile` | Same as `ScriptEditHistory` — same two commits, same pattern, no migration. |
| `ScriptSuggestion` | Same as `ScriptEditHistory` — same two commits, same pattern, no migration. |
| `ShowArc` | **Never referenced** outside `index.js` and its own file. Registered via `requiredModels` and `module.exports` in its one and only commit; never in `db.models`. A migration for its table exists. |
| `UiOverlayType` | **Never referenced** by name anywhere outside its own file, and never registered by any of `index.js`'s three mechanisms, in its one and only commit or since. The table it names is queried directly by `uiOverlayService.js`, unchanged at this basis, but never through the model object (§8). A migration for its table exists. |
| `SocialProfileTemplate` | **Referenced once, continuously, behind a guard that arrived in the same commit as the model** (§7) — not referenced-then-dropped, not never-referenced. Never registered by any of `index.js`'s three mechanisms, in either of the two commits that touch it or since. A migration for its table exists. |

No model in this document shows a referenced-then-dropped pattern; none
required a "cannot-tell" disposition — `git log -S` returned a clean,
countable answer for all six.

---

# §10. What this document does not do

- **Does not conclude any model is dead code, abandoned, or a missing
  feature.** §9's observations are what history shows, not a verdict.
- **Does not infer intent from any commit message beyond quoting it.**
  §7 and §8 quote verbatim; no interpretation of "falls back" or
  "doesn't exist yet" beyond the words themselves.
- **Does not recommend deletion, wiring, or any other action** for any
  of the six models.
- **Does not determine whether any unmigrated table (§5) ever existed**,
  or whether `ui_overlay_types` or the `social_profile_templates` table
  named in §7/§8 currently exists. No host, AWS, or database contact was
  made.
- **Does not edit `src/`, `index.js`, or any filed document.** Read-only
  throughout.
- **Does not mint FD-70 or any number.**
- **Does not rule on anything.** This is evidence; standing MEASURED
  throughout.

*Type: evidence. Rules nothing. Mints nothing. No host, AWS, database, or
Cognito contact. Prod FROZEN.*
