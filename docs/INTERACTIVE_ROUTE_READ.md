# Can the `/interactive` route run at all?

A read, measured at `origin/main` `ab51c70100197788ceb6a8bb53e140516519629a`
(2026-09-23). It changes nothing. Task: #1714.

The register note `docs/audit/F-AUTH-1_RuntimeColumnWrites_Read_MEASURED_2026-09-23.md`
recorded path 23, `POST /{episodes,shows}/:episodeId/interactive`, as unassessed
because "no model file of that name exists". This read re-derives that at the
basis above and answers the question. Code is cited by file and function or
route name. Line numbers are given where a quote needs them and hold at the
basis only.

## Answer

**No, it cannot run.** `InteractiveElement` is not a model anywhere in the
running code. There is no model file, no `sequelize.define`, and no registration
in `src/models/index.js`. `db.InteractiveElement` is therefore `undefined`, and
both handlers in `src/routes/gameShows.js` throw a `TypeError` on their first
line of work. The `catch` turns that into a 500. **Nothing in the frontend calls
either handler.**

**It is a pattern, not one route.** Six model names are referenced but
registered nowhere. Four of them are used unguarded, and all six `gameShows.js`
handlers depend on three of those four. Seven more names are registered but
missing from the object the calling code reads. §4 names each one.

## 1. Is `InteractiveElement` defined anywhere?

```
$ git grep -niE "InteractiveElement|interactive_element" HEAD -- src frontend/src scripts
scripts/verify-schema.js:81:    'interactive_elements',
src/migrations/20260208000001-add-game-show-features.js:23:    //   interactive_elements: true,
src/migrations/20260208000001-add-game-show-features.js:29:    await queryInterface.createTable('interactive_elements', {
src/migrations/20260208000001-add-game-show-features.js:270:    await queryInterface.addIndex('interactive_elements', ['episode_id', 'appears_at']);
src/migrations/20260208000001-add-game-show-features.js:280:    await queryInterface.dropTable('interactive_elements');
src/routes/gameShows.js:125:    const elements = await db.InteractiveElement.findAll({
src/routes/gameShows.js:147:    const element = await db.InteractiveElement.create({
src/services/iconCueGeneratorService.js:157:      if (sceneMetadata.interactive_elements) {
src/services/iconCueGeneratorService.js:158:        for (const element of sceneMetadata.interactive_elements) {
EXIT: 0
```

- **Model file:** none. `src/models/` has no `InteractiveElement.js`.
- **Dynamic definition:** none. No `define('InteractiveElement'` exists anywhere
  in `src/`, and `src/models/index.js` never mentions the name.
- **Table:** the migration `20260208000001-add-game-show-features.js` (in
  `src/migrations/`, the tree that runs) creates the table `interactive_elements`.
  The same migration also creates `layout_templates` and `episode_phases`, and
  `20260208000002-create-lala-formula.js` creates `lala_episode_formulas`. A table
  is not a model, though: nothing maps a Sequelize model onto it.
- **As deployed:** the filed canon schema capture,
  `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`, lists no columns
  for any of those four tables:

  ```
  $ for t in interactive_elements episode_phases layout_templates lala_episode_formulas; do echo "$t: $(grep -cE "^ $t +\|" docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt)"; done
  interactive_elements: 0
  episode_phases: 0
  layout_templates: 0
  lala_episode_formulas: 0
  ```

  That is quoted from a filed document, not measured by this session, and this
  read does not establish why those tables are absent.

**At runtime.** `src/models/index.js` runs no query when it loads, so a probe
loaded it with `DATABASE_URL` pointed at an unreachable local port. The probe
checked the three places a model could be found: the export (`db.X`), its nested
`db.models` map, and Sequelize's own registry (`db.sequelize.models`). The probe
file was deleted afterwards:

```
$ DATABASE_URL=postgres://probe:probe@127.0.0.1:1/probe NODE_ENV=development node ./.models-probe.js
InteractiveElement     db.InteractiveElement: undefined  db.models.InteractiveElement: undefined  sequelize.models.InteractiveElement: undefined
EpisodePhase           db.EpisodePhase: undefined  db.models.EpisodePhase: undefined  sequelize.models.EpisodePhase: undefined
LayoutTemplate         db.LayoutTemplate: undefined  db.models.LayoutTemplate: undefined  sequelize.models.LayoutTemplate: undefined
LalaEpisodeFormula     db.LalaEpisodeFormula: undefined  db.models.LalaEpisodeFormula: undefined  sequelize.models.LalaEpisodeFormula: undefined
PhoneMission           db.PhoneMission: undefined  db.models.PhoneMission: undefined  sequelize.models.PhoneMission: function
PhonePlaythroughState  db.PhonePlaythroughState: undefined  db.models.PhonePlaythroughState: undefined  sequelize.models.PhonePlaythroughState: function
BrainDocument          db.BrainDocument: undefined  db.models.BrainDocument: undefined  sequelize.models.BrainDocument: function
SocialProfileTemplate  db.SocialProfileTemplate: undefined  db.models.SocialProfileTemplate: undefined  sequelize.models.SocialProfileTemplate: undefined
PainPointMemory        db.PainPointMemory: undefined  db.models.PainPointMemory: undefined  sequelize.models.PainPointMemory: undefined
RawFootage             db.RawFootage: undefined  db.models.RawFootage: undefined  sequelize.models.RawFootage: function
CharacterProfile       db.CharacterProfile: function  db.models.CharacterProfile: undefined  sequelize.models.CharacterProfile: function
CharacterState         db.CharacterState: function  db.models.CharacterState: undefined  sequelize.models.CharacterState: function
AssetUsageLog          db.AssetUsageLog: function  db.models.AssetUsageLog: undefined  sequelize.models.AssetUsageLog: function
sequelize.models count: 151
EXIT: 0
```

(Two `dotenv` banner lines, which injected nothing from `.env`, are left out of
this output.)

### What happens when the route is called

`gameShows.js` binds `const db = require('../models')`. Both handlers dereference
`db.InteractiveElement` inside their `try`:

```
$ node -e 'const db={}; try{ db.InteractiveElement.findAll() }catch(e){ console.log(e.constructor.name+": "+e.message) }'
TypeError: Cannot read properties of undefined (reading 'findAll')
```

- **`GET …/:episodeId/interactive`:** the `TypeError` above. The handler's
  `catch` logs `Failed to get interactive elements:` and returns
  **500 `{ error: 'Failed to load elements' }`**.
- **`POST …/:episodeId/interactive`:** the same with `reading 'create'`. It logs
  `Failed to create interactive element:` and returns
  **500 `{ error: 'Failed to create element' }`**.

Every call that gets past `requireAuth` ends in one of these two 500s. Nothing is
read and nothing is written. The body-spread write that path 23 recorded never
reaches a model.

## 2. Route, authentication and callers

**Mount paths.** `src/app.js` mounts `gameShows.js` twice, at `/api/v1/episodes`
and `/api/v1/shows` (the "Game Show routes" block). So each handler has two URLs:

| Handler | URLs |
|---|---|
| `GET /:episodeId/interactive` | `GET /api/v1/episodes/:episodeId/interactive`, `GET /api/v1/shows/:episodeId/interactive` |
| `POST /:episodeId/interactive` | `POST /api/v1/episodes/:episodeId/interactive`, `POST /api/v1/shows/:episodeId/interactive` |

No earlier router on either prefix gets to these requests first. The routers
mounted earlier on `/api/v1/episodes` (`episodes`, `timelineData`,
`wardrobeApproval`, `scriptGenerator`, `lalaScripts`, `scriptParse`) and on
`/api/v1/shows` (`shows`) have no `/:x/interactive`, `/:x/:y` or `*` pattern, and
no `router.use` middleware.

**Authentication.** `requireAuth` on each route. There is no group check, and
`gameShows.js` has no `router.use`.

**Frontend callers: none.**

```
$ grep -rnlE "/interactive" frontend/src
EXIT: 1
```

The other four `gameShows.js` handlers (`/phases`, `/phases/bulk`, `/layouts`)
have no frontend callers either. `grep -rnlE "/phases"` and
`grep -rnlE "/layouts"` over `frontend/src` both return nothing.

## 3. The rest of `gameShows.js`

All six handlers in the file reference a model that does not exist:

| Handler | Model it dereferences | Result |
|---|---|---|
| `GET /:episodeId/phases` | `db.EpisodePhase` (the query also includes `db.LayoutTemplate`) | `TypeError`, 500 |
| `POST /:episodeId/phases/bulk` | `db.EpisodePhase.bulkCreate` | `TypeError`, 500 |
| `GET /:showId/layouts` | `db.LayoutTemplate.findAll` | `TypeError`, 500 |
| `POST /:showId/layouts` | `db.LayoutTemplate.create` | `TypeError`, 500 |
| `GET /:episodeId/interactive` | `db.InteractiveElement.findAll` | `TypeError`, 500 |
| `POST /:episodeId/interactive` | `db.InteractiveElement.create` | `TypeError`, 500 |

**The file serves nothing at the basis.** Each handler is reachable at two mount
paths.

## 4. The same pattern elsewhere

**Instrument.** A script read every file under `src/` except `models`,
`migrations` and `seeders`. It resolved what each file binds to the models
module: the top-level export (`require('../models')`, `getModels(req)`, or
`req.app.get('models') || require('../models')`), or the nested `db.models` map
(`const { models } = require('../models')`). It then listed every
`X.ModelName` access and every `{ ModelName } = X` destructure where the name is
not on the object read. `req.app.get('models')` is never set in `src/`
(`grep -rnE "set\(\s*['\"]models['\"]" src` returns nothing), so it always falls
back to `require('../models')`.

The script found 37 references to 13 names, and each was read by hand. The
runtime probe in §1 confirms every name. They fall into three groups.

### 4.1 Not registered anywhere — 6 names

| Name | Where referenced | Guarded? | Result |
|---|---|---|---|
| `InteractiveElement` | `gameShows.js`, 2 handlers | No | 500 (§1) |
| `EpisodePhase` | `gameShows.js`, 2 handlers | No | 500 |
| `LayoutTemplate` | `gameShows.js`, 3 handlers (one via `include`) | No | 500 |
| `LalaEpisodeFormula` | `lalaScripts.js`, `POST /:episodeId/generate-lala-script` (mounted at `/api/v1/episodes`) | No | `db.LalaEpisodeFormula.upsert` throws; the `catch` returns 500 `{ error: 'Failed to generate script' }`. No frontend caller (`grep -rnlE "generate-lala-script" frontend/src` returns nothing). |
| `PainPointMemory` | `sceneProposeRoute.js`, the scene-propose context loader | Yes, `db.PainPointMemory ? … : Promise.resolve([])` | Always the empty branch |
| `SocialProfileTemplate` | `socialProfileRoutes.js`, `/templates` handlers | Yes, `if (db.SocialProfileTemplate)` | Always uses the in-memory `_profileTemplates` fallback. A model file `src/models/SocialProfileTemplate.js` exists, but `index.js` never loads it. |

`PainPointMemory` and `SocialProfileTemplate` are also undefined at runtime (§1's
probe). They are listed with the four because nothing registers them. Unlike the
four, both are guarded, so nothing throws. **Six unregistered names in all: four
unguarded, two guarded.**

### 4.2 Registered with Sequelize, but not on the export the code reads — 4 names

`src/models/index.js` loads these files and lists them in its internal
`requiredModels` check, so `db.sequelize.models` has them. They are missing from
the `module.exports.X = X` list, which holds 146 names, so `db.X` is `undefined`
(§1's probe).

| Name | Where referenced | Guarded? | Result |
|---|---|---|---|
| `PhoneMission` | `phoneMissionRoutes.js`, mounted at `/api/v1/ui-overlays/:showId/missions` | `GET /` only (`if (!models.PhoneMission)`) | `GET` always returns `{ missions: [] }`. **`POST /`, `PUT /:id` and `DELETE /:id` are unguarded:** they throw and return 500. The frontend calls all four: `MissionEditor` (get, post, put, delete), `EpisodePhoneMissionsTab` (get, put), `usePhonePlayback` (get) and `UIOverlaysTab` (get). |
| `PhonePlaythroughState` | `phonePlaythroughRoutes.js`, `loadOrCreateState`, mounted at `/api/v1/episodes/:episodeId/phone-state` | Yes | It returns `{ error: 'phone playthrough not yet available on this environment' }`, so `GET /`, `POST /tap` and `POST /reset` answer 404. `usePhonePlaythrough` calls `GET`, `/tap` and `/reset`. |
| `BrainDocument` | `franchiseBrainRoutes.js`, the document store and the `/franchise-brain/documents` reads | Yes | Documents are never stored. The reads return `{ documents: [], message: 'BrainDocument model not available — run migration' }`. |
| `RawFootage` | `editMaps.js` | Yes, `db.RawFootage?.findByPk` | Always `undefined` |

### 4.3 On the top-level export, but read from the nested `db.models` map — 3 names

The nested `db.models` map in `index.js` lists 56 models. These three are
not among them, although `db.X` has them:

| Name | Where referenced | Guarded? | Result |
|---|---|---|---|
| `CharacterProfile` | `beatController.js`, `characterClipController.js` (`const { models } = require('../models')`) | Yes, `&& CharacterProfile` | The `character` include is always skipped |
| `CharacterState` | `episodes.js`, `POST /:id/generate-beats` (`const { Episode, CharacterState } = models`) | Inside a `try` whose `catch` is empty (`/* no state yet */`) | `CharacterState.findOne` throws and is swallowed. Generation always runs with `characterState = {}`. |
| `AssetUsageLog` | `sceneController.js` (`const { …, AssetUsageLog } = models`) | Yes, `if (AssetUsageLog)` | The usage log is never written |

### 4.4 Count

- **13 names, 37 references.**
- **4 names registered nowhere and unguarded:** `InteractiveElement`,
  `EpisodePhase`, `LayoutTemplate` and `LalaEpisodeFormula`. Their **7 handlers**
  (6 in `gameShows.js`, 1 in `lalaScripts.js`) always return 500, and no
  frontend code calls any of them.
- **2 names registered nowhere but guarded:** `PainPointMemory` and
  `SocialProfileTemplate`. Each silently takes its fallback.
- **4 names registered but not exported:** `PhoneMission`,
  `PhonePlaythroughState`, `BrainDocument` and `RawFootage`.
  - **3 handlers always return 500, and the frontend calls all three:** the
    `PhoneMission` `POST`, `PUT` and `DELETE`.
  - The rest fall back silently or return 404.
- **3 names exported but read from the nested map:** `CharacterProfile`,
  `CharacterState` and `AssetUsageLog`. Each silently skips its feature.

This read records what the code does at the basis, not what production does.
§1's probe loads the same `index.js` that the server loads.

## 5. Options for Evoni — no recommendation

For the `/interactive` route. §3 applies the same choice to all of
`gameShows.js`, and §4.2 is a separate question.

| Option | What it would take | What it would prevent or enable |
|---|---|---|
| **Define the model** | A new `src/models/InteractiveElement.js` matching the migration's `interactive_elements` columns, registered and exported in `index.js`. For the file to work as a whole, `EpisodePhase` and `LayoutTemplate` need the same. The canon capture lists none of those tables, so the migration would have to run where it has not, and the route has a body-spread write (path 23 in the column-writes note) that would then go live. | It enables game-show interactive elements. It makes path 23's body-chosen columns reachable for real, which is a decision in itself. |
| **Remove the route** | Delete the two `/interactive` handlers, or all six `gameShows.js` handlers and the two mounts in `src/app.js`. No frontend change: nothing calls them. | It removes 500s that nobody receives today, and it removes path 23 from the column-writes register entirely. It gives up the game-show scaffolding, which the migrations would still describe. |
| **Leave it** | Nothing. | Every call keeps returning 500. Nothing is read or written, so path 23 stays unreachable in practice. The dead code stays, and so does the chance that someone adds the model later without looking at path 23. |

## Validation

`/validate` ran before commit. Its raw output is in the PR body.
