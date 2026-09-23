# F-AUTH-1 — write paths where the caller chooses the columns, MEASURED

**Basis:** `origin/main` at `f8644c945876197c7b0e53d5fb2b62eed1a5ef22` (2026-09-23),
the squash merge of #1710. Every `git grep` below reads that tree; the working tree
was clean at that commit for the model enumeration in §0.9.

**Standing:** MEASURED for every claim, read directly from the repository at this
basis. Each carries its command and raw output, verbatim. Where a line range is
quoted, the range is the command shown. Nothing here is ATTESTED, INFERRED or RULED.

**What this is.** A read. It records every write path at the basis where the
column names written are chosen at runtime, by the request body or by an AI
response, rather than taken from a fixed list in code. **It records reachability,
not risk.** It makes no claim that any path is exploitable, ranks nothing, fixes
nothing, rules nothing, opens no Fix Plan and mints nothing (§7).

**Independence.** Every entry was re-derived at this basis from the instruments in
§0. None is carried forward from a PR body, an issue or an earlier unfiled survey.
The planning chat carried a figure of **21** from an earlier unfiled survey. This
read finds **32 handlers** (§1). How that 21 was counted is not reconstructed here,
so this read does not say whether it counted sites, handlers, or a different
boundary. The difference is recorded, not reconciled.

Task: #1711. No host, AWS, database, or Cognito contact.

---

## 0. Instruments and what they found

### 0.1 Direct `req.body` into a write call — 19 sites

```
$ git grep -nE "\.(update|create|set|upsert|bulkCreate)\(\s*(req\.body|\{\s*\.\.\.req\.body)" f8644c945876197c7b0e53d5fb2b62eed1a5ef22 -- src
src/routes/calendarRoutes.js:233:    await event.update(req.body);
src/routes/calendarRoutes.js:313:    await attendee.update(req.body);
src/routes/characterCrossingRoutes.js:74:    await crossing.update(req.body);
src/routes/feedRelationshipRoutes.js:89:    await rel.update(req.body);
src/routes/tierFeatures.js:215:    const event = await db.RelationshipEvent.create(req.body);
src/routes/tierFeatures.js:235:    await event.update(req.body);
src/routes/tierFeatures.js:366:    const event = await db.WorldTimelineEvent.create(req.body);
src/routes/tierFeatures.js:377:    await event.update(req.body);
src/routes/tierFeatures.js:420:    const location = await db.WorldLocation.create(req.body);
src/routes/tierFeatures.js:431:    await location.update(req.body);
src/routes/tierFeatures.js:470:    const snapshot = await db.WorldStateSnapshot.create(req.body);
src/routes/tierFeatures.js:655:      await pipeline.update(req.body);
src/routes/tierFeatures.js:657:      pipeline = await db.PipelineTracking.create(req.body);
src/routes/tierFeatures.js:676:    await pipeline.update(req.body);
src/routes/tierFeatures.js:829:    const thread = await db.StoryThread.create(req.body);
src/routes/tierFeatures.js:840:    await thread.update(req.body);
src/routes/universe.js:91:    await series.update(req.body);
src/routes/universe.js:128:    await universe.update(req.body);
src/routes/upgradeRoutes.js:386:    const goal = await db.WritingGoal.create({ ...req.body, active: true });
EXIT: 0
```

All 19 are unconstrained: nothing between the handler's opening and the write
filters the keys. They make up paths 1–18 in §1; `tierFeatures.js:655` and `:657`
are one handler.

### 0.2 `Object.assign(target, req.body)` — none

```
$ git grep -nE "Object\.assign\([^,]+,\s*req\.body" f8644c945876197c7b0e53d5fb2b62eed1a5ef22 -- src
EXIT: 1
```

### 0.3 `req.body` taken whole into a local, then written — 24 sites, 10 unconstrained

```
$ git grep -nE "const (updates|body|data|fields|payload|changes|elementData) = req\.body;" f8644c945876197c7b0e53d5fb2b62eed1a5ef22 -- src
src/controllers/audioClipController.js:178:    const updates = req.body;
src/controllers/beatController.js:173:    const updates = req.body;
src/controllers/characterClipController.js:202:    const updates = req.body;
src/controllers/cursorPathController.js:228:  const updates = req.body;
src/controllers/episodeController.js:487:    const updates = req.body;
src/controllers/iconCueController.js:215:  const updates = req.body;
src/controllers/iconSlotController.js:180:  const updates = req.body;
src/controllers/metadataController.js:193:    const updates = req.body;
src/controllers/musicCueController.js:195:  const updates = req.body;
src/controllers/sceneController.js:267:    const updates = req.body;
src/controllers/sceneStudioController.js:459:    const updates = req.body;
src/controllers/thumbnailController.js:187:    const updates = req.body;
src/controllers/wardrobeController.js:612:      const updates = req.body;
src/routes/arcRoutes.js:138:    const updates = req.body; // { tagline, feed_behavior, emotional_arc, etc. }
src/routes/assets.js:1059:    const updates = req.body;
src/routes/careerGoals.js:436:    const updates = req.body;
src/routes/editMaps.js:97:    const updates = req.body;
src/routes/editMaps.js:169:    const updates = req.body;
src/routes/gameShows.js:145:    const elementData = req.body;
src/routes/opportunityRoutes.js:91:    const body = req.body;
src/routes/opportunityRoutes.js:138:    const body = req.body;
src/routes/scriptGenerator.js:45:    const updates = req.body;
src/routes/shows.js:1255:    const updates = req.body;
src/routes/worldEvents.js:541:    const updates = req.body;
EXIT: 0
```

Each was followed to its write. **Unconstrained (10):** `audioClipController.js:178`,
`beatController.js:173`, `characterClipController.js:202`, `editMaps.js:97`, `:169`,
`gameShows.js:145`, `opportunityRoutes.js:91`, `:138`, `scriptGenerator.js:45` and
`shows.js:1255`. These are paths 19–28 in §1. The handler bodies are quoted in §1.

**Constrained (14).** Each writes only the keys in a list fixed in code:

| Site | Fixed list |
|---|---|
| `cursorPathController.js:228` | `allowedFields` at `:231`, filtered at `:244`, into a parameterised raw `SET` |
| `episodeController.js:487` | `allowedFields` at `:497` |
| `iconCueController.js:215` | `allowedFields` at `:219`, filtered at `:230` |
| `iconSlotController.js:180` | `allowedFields` at `:183`, filtered at `:194` |
| `metadataController.js:193` | `allowedFields` at `:203` |
| `musicCueController.js:195` | `allowedFields` at `:198`, filtered at `:208` |
| `sceneController.js:267` | `allowedUpdates` at `:293`, filtered at `:320` |
| `sceneStudioController.js:459` | `allowed` at `:467` |
| `thumbnailController.js:187` | `allowedFields` at `:197` |
| `wardrobeController.js:612` | fixed camelCase→snake_case `updateData` literal at `:657` |
| `arcRoutes.js:138` | `allowed = ['tagline', 'emotional_arc', 'feed_behavior']` at `:152` |
| `assets.js:1059` | passes to `AssetService.updateAsset`, `allowedFields` at `src/services/AssetService.js:1214`, filtered at `:1227` |
| `careerGoals.js:436` | `allowedFields` at `:440` |
| `worldEvents.js:541` | `allowedFields` at `:546`, into the raw `SET` at `:707` |

### 0.4 Every write call whose argument is a bare variable — 122 sites

```
$ git grep -nE "\.(update|create|bulkCreate|upsert|build|set)\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*[,)]" f8644c945876197c7b0e53d5fb2b62eed1a5ef22 -- src/routes src/controllers src/services | grep -vE "messages\.create|\.set\('|res\.set|headers|Map\(|\.set\([a-zA-Z_]+\s*,|hash\.update|createHash|cache\.set|\.set\(key" | wc -l
122
```

Each variable was traced to its definition within the 80 lines above the call:

- **Definition is `req.body`, taken whole:** 9 sites. They are
  `audioClipController.js:188`, `beatController.js:183`,
  `characterClipController.js:212`, `editMaps.js:104`, `:176`,
  `opportunityRoutes.js:150`, `scriptGenerator.js:52`, `shows.js:1262`, and
  `opportunityRoutes.js:110`. `:110` creates from `data`, and `:106` builds `data`
  as `{ id: uuidv4(), show_id: showId, ...body, … }`. The other §0.3 writes
  (`gameShows.js:147` and `scriptGenerator.js:50`) pass an object literal, so this
  instrument does not match them.
- **`phoneMissionRoutes.js:94`:** writes `value` from `validateMissionPayload(req.body)`.
  That function is a Joi schema closed with `.unknown(false)`
  (`src/services/phoneConditionSchema.js:145`–`:158`). Constrained.
- **`storyteller.js:1023`:** `toCreate` is a literal map with fixed keys (`:1014`).
  Constrained.
- **`textureLayerRoutes.js:76`:** writes `texture`, whose keys come from an AI
  response. Path 31 in §1.
- **Every other site** is built from an object literal with fixed keys, is started
  as `{}` and filled by static property assignment, or is a code-built array
  (`seed.js` constants `:15`, `:104`; `wardrobeLibraryController.js:912` fixed map;
  `beatService.js:432` fixed map; `characterRegistry.js:1056` batch of fixed-key
  `updates`; `worldEvents.js:2355` fixed literal). Computed-key fills of `{}` are
  covered by §0.5.

### 0.5 Computed-key assignment — 67 sites

```
$ git grep -nE "^\s*[a-zA-Z_]+\[[a-zA-Z_]+\]\s*=[^=]" f8644c945876197c7b0e53d5fb2b62eed1a5ef22 -- src/routes src/controllers src/services | wc -l
67
```

Each was read. None puts caller-chosen or AI-chosen keys into a write unfiltered:

- **Iterates a fixed list:** `episodeController.js:517`, `:521`;
  `metadataController.js:227`–`:232`; `sceneController.js:335`;
  `sceneStudioController.js:479`; `thumbnailController.js:208`;
  `careerGoals.js:450`; `characterDepthRoutes.js:260`, `:310`, `:361`, `:408`;
  `characterRegistry.js:1368`, `:1392`, `:1583` (`fields` fixed at `:1573`);
  `worldEvents.js:693`; `AssetService.js:1228`; `beatService.js:392`;
  `registrySync.js:411`; `sceneIdentityService.js:121`, `:123`.
- **`worldStudio.js:1406`** iterates `missing`. `missing` is built at `:1335` as
  `fillable.filter(f => !char[f])`, from the fixed `fillable` list, so the AI
  response supplies values only for names the code chose.
- **Keys inside one JSONB value, not columns:** `characterRegistry.js:1358` and
  `:1798`, the keys of a generated section, stored whole in one fixed JSONB column.
  Also `worldStudio.js:3104`, `graph[idx] = { ...graph[idx], ...req.body }`, which
  goes into the fixed column `relationship_graph` (`:3106`). The body chooses keys
  inside that column's JSON, not which columns are written. These are recorded
  here and are outside the class.
- **The rest** build response objects, counters, image buffers or in-memory
  maps, and do not reach a write.

### 0.6 Spreads within 25 lines after a write call opens — 53 lines

A script listed every `...identifier` that falls within 25 lines after an
`.update(`, `.create(`, `.bulkCreate(`, `.upsert(`, `.build(` or `.findOrCreate(`
opens in `src/routes`, `src/controllers` and `src/services`, excluding
`...req.body` (§0.1). It found 53. Each was read. Beyond the sites already counted:

- **Body-supplied:** `characterGenerationRoutes.js:139` and `:161`
  (`...proposed`, path 30), and `layers.js:452` (`...layer`, path 29).
- **AI-supplied:** `novelIntelligenceRoutes.js:322` and `:335` (`...metadata`,
  path 32).
- **Copies of a stored row:** `sceneStudioController.js:533` and `:635`, which
  spread `obj.toJSON()` of an existing row. Code-built arrays and seeds:
  `amberDiagnosticRoutes.js:281` (findings from the five fixed check functions at
  `:244`–`:249`), `characterRegistry.js:980` (seed literal), `continuityEngine.js:428`
  (seed literal), `worldStudio.js:3349` (seed literal), `evaluation.js:68`
  (`DEFAULT_STATS`). None of these is caller-chosen.
- **Spread into one JSONB column's value:** `sceneSetRoutes.js:2006`, `:558`,
  `sceneGenerationService.js:782`, where an AI `styleData` goes into
  `visual_language`. Also `memories/core.js:421`, `characterRegistry.js:1848`,
  `careerPipelineService.js:290`–`:292` and the rest of the 53. These are keys
  inside one column, outside the class.

### 0.7 `Object.assign` onto any target — 8 sites

```
$ git grep -nE "Object\.assign\(" f8644c945876197c7b0e53d5fb2b62eed1a5ef22 -- src/routes src/controllers src/services | grep -vE "Object\.assign\(\{\}"
src/routes/assets.js:897:      Object.assign(asset, wardrobeUpdates);
src/services/textureLayerService.js:667:  Object.assign(texture, innerThought, bodyNarrator);
src/services/textureLayerService.js:675:    Object.assign(texture, conflictResult);
src/services/textureLayerService.js:684:    Object.assign(texture, momResult);
src/services/textureLayerService.js:694:    Object.assign(texture, aftermathResult, memoryResult);
src/services/textureLayerService.js:703:    Object.assign(texture, pmResult);
src/services/textureLayerService.js:711:    Object.assign(texture, postResult);
src/services/textureLayerService.js:719:    Object.assign(texture, bleedResult);
```

`assets.js:897` merges `wardrobeUpdates`, whose keys are fixed static assignments
(`:867`–`:893`). Constrained. The seven `textureLayerService.js` sites are path 31.

### 0.8 Raw SQL with an interpolated column list — 18 sites (§5)

### 0.9 Models: attributes, primary key, paranoid

The models were loaded directly from `src/models/*.js` with Sequelize 6.37.8
(`package-lock.json` `node_modules/sequelize` `"version": "6.37.8"`), using a
`Sequelize` instance that never connects. The script ran from the repository root
and was deleted afterwards. `OWN` matches `id`, any `*_id`, any `*_key`, `status`,
`slug` and `deleted_at`:

```
$ node ./.cols-tmp.js <models>   # prints: name | file | attribute count | OWN-matching attributes
AudioClip | AudioClip.js | 11 attrs | id scene_id beat_id status
Beat | Beat.js | 11 attrs | id scene_id character_id status
BookSeries | BookSeries.js | 9 attrs | id universe_id show_id protagonist_id
CalendarEventAttendee | CalendarEventAttendee.js | 10 attrs | id event_id character_id feed_profile_id
CharacterClip | CharacterClip.js | 14 attrs | id scene_id character_id beat_id status
CharacterCrossing | CharacterCrossing.js | 11 attrs | id character_id calendar_event_id
EditMap | EditMap.js | 19 attrs | id episode_id raw_footage_id
FeedProfileRelationship | FeedProfileRelationship.js | 9 attrs | id influencer_a_id influencer_b_id
Layer | Layer.js | 14 attrs | id episode_id deleted_at
ManuscriptMetadata | ManuscriptMetadata.js | 25 attrs | id series_id book_id
Opportunity | Opportunity.js | 47 attrs | id show_id status connector_profile_id event_id episode_id deleted_at
PipelineTracking | PipelineTracking.js | 17 attrs | id story_id book_id chapter_id
RegistryCharacter | RegistryCharacter.js | 197 attrs | id registry_id character_key status feed_profile_id
RelationshipEvent | RelationshipEvent.js | 14 attrs | id relationship_id chapter_id story_id
Show | Show.js | 21 attrs | id slug status
ShowConfig | ShowConfig.js | 6 attrs | id show_id config_key
StoryCalendarEvent | StoryCalendarEvent.js | 25 attrs | id location_id source_line_id series_id
StoryTexture | StoryTexture.js | 51 attrs | id character_key registry_id
StoryThread | StoryThread.js | 17 attrs | id book_id universe_id status introduced_chapter_id resolved_chapter_id last_referenced_chapter_id
Universe | Universe.js | 10 attrs | id slug
WorldLocation | WorldLocation.js | 23 attrs | id universe_id slug parent_location_id first_appearance_chapter_id
WorldStateSnapshot | WorldStateSnapshot.js | 13 attrs | id universe_id book_id chapter_id
WorldTimelineEvent | WorldTimelineEvent.js | 17 attrs | id universe_id book_id chapter_id location_id
WritingGoal | WritingGoal.js | 9 attrs | id
```

A second pass printed the primary key and the approval columns. Every model above
has `pk=id`. `paranoid=true` holds for `Layer`, `Opportunity`, `RegistryCharacter`,
`Show` and `StoryTexture`. The approval columns are:

- `StoryTexture`: `inner_thought_confirmed` through `memory_proposal_confirmed`
  (nine columns), plus `fully_confirmed` and `confirmed_at`;
- `ManuscriptMetadata`: `author_approved` and `approved_at`;
- `CharacterCrossing`: `gap_confirmed`;
- `WritingGoal`: `active`.

No model file named `InteractiveElement` exists:

```
$ grep -rln "InteractiveElement" src/models
EXIT: 1
```

### 0.10 How Sequelize 6.37.8 treats the keys it is given

This governs what "can reach" means in §2. From
`node_modules/sequelize/lib/model.js` (6.37.8):

- **`instance.update(values)`** calls `set(values)`, then saves only
  `_.intersection(fields, this.changed())` (`:2576`–`:2597`). `set` drops any key
  that is not a model attribute (`:2267`–`:2268`, `_isAttribute`).
- **On an existing row, `set` ignores a primary key that already has a value**
  (`:2278`–`:2279`). It also ignores the read-only timestamp attributes
  (`:2281`–`:2282`): `createdAt` and `updatedAt`, plus `deletedAt` for paranoid
  models (`:748`–`:760`). So `update` cannot change `id`, the timestamps, or a
  paranoid model's `deleted_at`. It can change every other attribute it is given.
- **`Model.create(values)`** builds a new record, so neither guard applies.
  `create` can therefore set `id`, the created timestamp (`save` fills it only
  when it is empty, `:2419`–`:2420`) and, on a paranoid model, the soft-delete
  timestamp. The updated timestamp is overwritten with the current time on save
  (`:2416`–`:2417`).
- **`Model.bulkCreate(records)`** builds each record the same way.
- **The soft-delete key depends on the model.** It is the attribute name that
  `set` matches, not the column name. `Opportunity` and `Layer` name the
  attribute `deleted_at`. `RegistryCharacter`, `StoryTexture` and `Show` name it
  `deletedAt`: they are `underscored` (`RegistryCharacter.js:631`,
  `StoryTexture.js:99`, `Show.js:145`), which maps that attribute to the
  `deleted_at` column. On those three models, a body or AI key `deleted_at` is
  dropped as a non-attribute, and the key that reaches the column is
  `deletedAt`.

The two probes below build instances from the real model files with a
`Sequelize` that never connects. They were run from the repository root and
deleted afterwards. `create` builds a new record, so the first probe calls
`build(vals)`. `findByPk` returns a raw, non-new row, so the second builds with
`{ isNewRecord: false, raw: true }` and then calls `set`, which is what
`update` does before it saves:

```
$ node ./.sq-probe.js   # build(vals) on new records; set(vals) on a non-new row
Opportunity: timestamps={"createdAt":"created_at","updatedAt":"updated_at","deletedAt":"deleted_at"} attrs=id,deleted_at,created_at,updated_at
  create build changed: id,deleted_at,created_at,updated_at
  update set changed:   id
Layer: timestamps={"createdAt":"created_at","updatedAt":"updated_at","deletedAt":"deleted_at"} attrs=id,deleted_at,created_at,updated_at
  create build changed: id,deleted_at,created_at,updated_at
  update set changed:   id
RegistryCharacter: timestamps={"createdAt":"createdAt","updatedAt":"updatedAt","deletedAt":"deletedAt"} attrs=id,deletedAt,createdAt,updatedAt
  create build changed: id,deletedAt,createdAt,updatedAt
  update set changed:   id
StoryTexture: timestamps={"createdAt":"createdAt","updatedAt":"updatedAt","deletedAt":"deletedAt"} attrs=id,deletedAt,createdAt,updatedAt
  create build changed: id,deletedAt,createdAt,updatedAt
  update set changed:   id
Show: timestamps={"createdAt":"createdAt","updatedAt":"updatedAt","deletedAt":"deletedAt"} attrs=id,deletedAt,createdAt,updatedAt
  create build changed: id,deletedAt,createdAt,updatedAt
  update set changed:   id
EXIT: 0
```

In that first probe, `update set changed: id` comes from building the row without
`raw`, not from `set`. The second probe builds the row the way `findByPk`
returns it (`raw: true`), then sets `id`, the created and soft-delete timestamps,
and `status`:

```
$ node ./.sq-probe.js   # findByPk-shaped row, then set()
Opportunity update (findByPk-shaped row): id=a deleted_at=null created_at=0 changed=[status]
RegistryCharacter update (findByPk-shaped row): id=a deletedAt=null createdAt=0 changed=[status]
Show update (findByPk-shaped row): id=a deletedAt=null createdAt=0 changed=[status]
EXIT: 0
```

On an existing row, `set` ignores `id` and both timestamps and changes `status`.

---

## 1. The paths

"Auth" lists the middleware in front of the handler, at file level and at route
level. **Group checks:** a count of `authorize(`, `userInGroup`,
`canAccessAuthorFields` and `req.user.groups` found none in any file below, except
`characterGenerationRoutes.js` (path 30). There, `canAccessAuthorFields` gates only
the four author-only fields. The only group check in `src/app.js` is on
`/admin/queues` (`src/app.js:1169`), which does not reach these paths.

```
$ grep -nE "authorize|userInGroup|requireGroup|requireAdmin" src/app.js
232:const { requireAuth, authorize } = require('./middleware/auth');
1169:  app.use('/admin/queues', requireAuth, authorize(['ADMIN']), queueMonitorRoutes);
```

The mount prefixes come from `src/app.js`: `/api/v1/universe` `:1102`,
`/api/v1/calendar` `:1335`, `/api/v1/character-crossings` `:1380`,
`/api/v1/feed-relationships` `:1371`, `/api/v1/tier` `:1304`, `/api/v1` (upgrade)
`:1223`, `/api/v1` (beats, character-clips, audio-clips) `:739`–`:741`,
`/api/v1/shows` `:849`, `/api/v1/episodes` and `/api/v1/shows` (gameShows)
`:861`–`:862`, `/api/v1` (opportunities) `:1478`, `/api/v1/raw-footage` and
`/api/v1/edit-maps` `:817`–`:818`, `/api/v1/episodes` and `/api/v1/templates`
(scriptGenerator) `:804`–`:805`, `/api/v1/layers` `:917`,
`/api/v1/character-generation` `:1295`, `/api/v1/novel` `:1250` and
`/api/v1/texture-layer` `:1407`.

### 1A. Names supplied by the request body — 30 handlers

| # | Route | Handler / write | Names supplied by | Auth | Model |
|---|---|---|---|---|---|
| 1 | `PUT /api/v1/universe/series/:id` | `universe.js:87` / `:91` `series.update(req.body)` | body, whole | `requireAuth` (route) | `BookSeries` |
| 2 | `PUT /api/v1/universe/:id` | `universe.js:124` / `:128` `universe.update(req.body)` | body, whole | `requireAuth` (route) | `Universe` |
| 3 | `PUT /api/v1/calendar/events/:id` | `calendarRoutes.js:228` / `:233` | body, whole | `router.use(requireAuth)` `:40` + route | `StoryCalendarEvent` |
| 4 | `PUT /api/v1/calendar/events/:id/attendees/:attendeeId` | `calendarRoutes.js:306` / `:313` | body, whole | `router.use(requireAuth)` `:40` + route | `CalendarEventAttendee` |
| 5 | `PUT /api/v1/character-crossings/:id` | `characterCrossingRoutes.js:69` / `:74` | body, whole | `router.use(requireAuth)` `:21` | `CharacterCrossing` |
| 6 | `PUT /api/v1/feed-relationships/:id` | `feedRelationshipRoutes.js:84` / `:89` | body, whole | `router.use(requireAuth)` `:22` | `FeedProfileRelationship` |
| 7 | `POST /api/v1/tier/relationship-events` | `tierFeatures.js:213` / `:215` create | body, whole | `requireAuth` (route) | `RelationshipEvent` |
| 8 | `PUT /api/v1/tier/relationship-events/:eventId` | `tierFeatures.js:231` / `:235` | body, whole | `requireAuth` (route) | `RelationshipEvent` |
| 9 | `POST /api/v1/tier/world-timeline` | `tierFeatures.js:364` / `:366` create | body, whole | `requireAuth` (route) | `WorldTimelineEvent` |
| 10 | `PUT /api/v1/tier/world-timeline/:eventId` | `tierFeatures.js:373` / `:377` | body, whole | `requireAuth` (route) | `WorldTimelineEvent` |
| 11 | `POST /api/v1/tier/world-locations` | `tierFeatures.js:415` / `:420` create | body, whole | `requireAuth` (route) | `WorldLocation` |
| 12 | `PUT /api/v1/tier/world-locations/:locationId` | `tierFeatures.js:427` / `:431` | body, whole | `requireAuth` (route) | `WorldLocation` |
| 13 | `POST /api/v1/tier/world-snapshots` | `tierFeatures.js:468` / `:470` create | body, whole | `requireAuth` (route) | `WorldStateSnapshot` |
| 14 | `POST /api/v1/tier/pipeline` | `tierFeatures.js:648` / `:655` update or `:657` create | body, whole | `requireAuth` (route) | `PipelineTracking` |
| 15 | `PUT /api/v1/tier/pipeline/:pipelineId` | `tierFeatures.js:666` / `:676` | body, whole | `requireAuth` (route) | `PipelineTracking` |
| 16 | `POST /api/v1/tier/story-threads` | `tierFeatures.js:827` / `:829` create | body, whole | `requireAuth` (route) | `StoryThread` |
| 17 | `PUT /api/v1/tier/story-threads/:threadId` | `tierFeatures.js:836` / `:840` | body, whole | `requireAuth` (route) | `StoryThread` |
| 18 | `PATCH /api/v1/writing-rhythm/goal` | `upgradeRoutes.js:383` / `:386` create `{ ...req.body, active: true }` | body, whole; `active` fixed after the spread | `requireAuth` (route) | `WritingGoal` |
| 19 | `PATCH /api/v1/audio-clips/:id` | `routes/audio-clips.js:23` → `audioClipController.updateAudioClip` `:175` / `:188` | body, whole (`:178`) | `requireAuth` (route) | `AudioClip` |
| 20 | `PATCH /api/v1/beats/:id` | `routes/beats.js:22` → `beatController.updateBeat` `:170` / `:183` | body, whole (`:173`) | `requireAuth` (route) | `Beat` |
| 21 | `PATCH /api/v1/character-clips/:id` | `routes/character-clips.js:23` → `characterClipController.updateCharacterClip` `:199` / `:212` | body, whole (`:202`) | `requireAuth` (route) | `CharacterClip` |
| 22 | `PUT /api/v1/shows/:id` | `shows.js:1251` / `:1262` `show.update(updates)` | body, whole (`:1255`) | `requireAuth` (route) | `Show` |
| 23 | `POST /api/v1/{episodes,shows}/:episodeId/interactive` | `gameShows.js:142` / `:147` create `{ episode_id, ...elementData }` | body, whole (`:145`), spread after `episode_id` | `requireAuth` (route) | `db.InteractiveElement`, **no model file of that name exists (§0.9)**, so the call is on no registered model |
| 24 | `POST /api/v1/opportunities/:showId` | `opportunityRoutes.js:87` / `:110` create `data` | body, whole (`:91`), spread after `id` and `show_id` (`:106`) | `requireAuth` (route) | `Opportunity` |
| 25 | `PUT /api/v1/opportunities/:showId/:id` | `opportunityRoutes.js:134` / `:150` `opp.update(body)` | body, whole (`:138`) | `requireAuth` (route) | `Opportunity` |
| 26 | `PUT /api/v1/{raw-footage,edit-maps}/:id` | `editMaps.js:94` / `:104` | body, whole (`:97`) | `requireAuth` (route) | `EditMap` |
| 27 | `PATCH /api/v1/{raw-footage,edit-maps}/:id` | `editMaps.js:166` / `:176` | body, whole (`:169`) | `requireAuth` (route) | `EditMap` |
| 28 | `PUT /api/v1/{episodes,templates}/:showId/config` | `scriptGenerator.js:42` / `:50` create `{ show_id, ...updates }` or `:52` update | body, whole (`:45`) | `requireAuth` (route) | `ShowConfig` |
| 29 | `POST /api/v1/layers/bulk-create` | `layers.js:426` / `:452` `bulkCreate` of `{ ...layer, episode_id }` | each element of body `layers`; `episode_id` fixed after the spread from body `episode_id`, checked to exist (`:438`) | `requireAuth` (route) | `Layer` |
| 30 | `POST /api/v1/character-generation/confirm` | `characterGenerationRoutes.js:108` / `:139` update `{ ...proposed, depth_level }` or `:160` create `{ ...proposed, registry_id, depth_level, status: 'accepted' }` | body `proposed`, whole | `router.use(requireAuth)` `:38`; the four author-only fields stripped for non-admins (`:121`–`:123`) | `RegistryCharacter` |

The handler bodies behind rows 19–22 and 26–28 (source at the basis):

```
$ sed -n 1251,1262p src/routes/shows.js
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const Show = getShow();
    const { id } = req.params;
    const updates = req.body;

    const show = await Show.findByPk(id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    await show.update(updates);

$ sed -n 42,52p src/routes/scriptGenerator.js
router.put('/:showId/config', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const updates = req.body;

    let config = await db.ShowConfig.findOne({ where: { show_id: showId } });

    if (!config) {
      config = await db.ShowConfig.create({ show_id: showId, ...updates });
    } else {
      await config.update(updates);
```

The three clip/beat controllers (`audioClipController.js:175`–`:188`,
`beatController.js:170`–`:183`, `characterClipController.js:199`–`:212`) and
`editMaps.js:94`–`:104` and `:166`–`:176` share one shape: `const updates =
req.body;`, then `findByPk(id)`, a 404 if missing, and `update(updates)`, with
nothing in between.

### 1B. Names supplied by an AI response — 2 handlers

| # | Route | Handler / write | Names supplied by | Auth | Model |
|---|---|---|---|---|---|
| 31 | `POST /api/v1/texture-layer/generate` | `textureLayerRoutes.js:18` / `:76` `db.StoryTexture.create(texture)` | `generateTextureLayer` (`src/services/textureLayerService.js:638`) starts `texture` as `{ story_number, character_key, registry_id }` (`:650`–`:654`). It then `Object.assign`s AI results over it (`:667`–`:719`). Five generators return `JSON.parse(raw)` of the model's text, with whatever keys it produced: `generateConflictScene` `:250`, `generatePrivateMoment` `:336`, `generateOnlineSelfPost` `:388`, `generateMomToneInsert` `:480` and `generateMemoryProposal` `:573`. The other generators return fixed keys (`:191`, `:293`, `:431`, `:526`). Only `amber_notes` and `amber_read_at` are set after the merges (`:726`–`:727`). | `requireAuth`, `aiRateLimiter` (route) | `StoryTexture` |
| 32 | `POST /api/v1/novel/manuscript/cascade` | `novelIntelligenceRoutes.js:223` / `:321` `existing.update({ ...metadata, … })` or `:329` `ManuscriptMetadata.create({ series_id, book_id, …, ...metadata })` | `metadata = JSON.parse(response.content[0].text …)` (`:313`), whole. In the update branch it is spread first, and five fixed keys follow (`:322`–`:327`). In the create branch it is spread **last** (`:335`). | `requireAuth`, `aiRateLimiter` (route) | `ManuscriptMetadata` |

### 1C. Count

**32 handlers**: 30 body-supplied, 2 AI-supplied. They hold **36 write sites**:

- 19 from §0.1;
- 11 behind the §0.3 definitions: `audioClipController.js:188`,
  `beatController.js:183`, `characterClipController.js:212`, `shows.js:1262`,
  `gameShows.js:147`, `opportunityRoutes.js:110`, `:150`, `editMaps.js:104`,
  `:176`, `scriptGenerator.js:50` and `:52`;
- `characterGenerationRoutes.js:139` and `:160`;
- `layers.js:452`;
- `textureLayerRoutes.js:76`;
- `novelIntelligenceRoutes.js:321` and `:329`.

Path 23 is recorded because its names are body-supplied. At this basis the call
targets `db.InteractiveElement`, and no model file of that name exists. This read
does not say what that call does at runtime.

---

## 2. Paths that can reach an ownership, association or identity column

"Can reach" means the column is an attribute of the model (§0.9), nothing on the
path removes it, and Sequelize accepts it for that kind of write (§0.10). **On
`update`, `id` and a paranoid model's soft-delete column are not reachable. On
`create`, they are.** The soft-delete column is `deleted_at`; the key that reaches it
is `deleted_at` or `deletedAt` depending on the model (§0.10). Where a fixed key follows the spread, the body's value is overwritten
and that column is not listed.

| # | Route | Columns reachable |
|---|---|---|
| 1 | `PUT /universe/series/:id` | `universe_id`, `show_id`, `protagonist_id` |
| 2 | `PUT /universe/:id` | `slug` |
| 3 | `PUT /calendar/events/:id` | `series_id`, `location_id`, `source_line_id` |
| 4 | `PUT /calendar/events/:id/attendees/:attendeeId` | `event_id`, `character_id`, `feed_profile_id` |
| 5 | `PUT /character-crossings/:id` | `character_id`, `calendar_event_id` |
| 6 | `PUT /feed-relationships/:id` | `influencer_a_id`, `influencer_b_id` |
| 7 | `POST /tier/relationship-events` | `id`, `relationship_id`, `chapter_id`, `story_id` |
| 8 | `PUT /tier/relationship-events/:eventId` | `relationship_id`, `chapter_id`, `story_id` |
| 9 | `POST /tier/world-timeline` | `id`, `universe_id`, `book_id`, `chapter_id`, `location_id` |
| 10 | `PUT /tier/world-timeline/:eventId` | `universe_id`, `book_id`, `chapter_id`, `location_id` |
| 11 | `POST /tier/world-locations` | `id`, `universe_id`, `slug`, `parent_location_id`, `first_appearance_chapter_id` |
| 12 | `PUT /tier/world-locations/:locationId` | `universe_id`, `slug`, `parent_location_id`, `first_appearance_chapter_id` |
| 13 | `POST /tier/world-snapshots` | `id`, `universe_id`, `book_id`, `chapter_id` |
| 14 | `POST /tier/pipeline` | create: `id`, `story_id`, `book_id`, `chapter_id`; update: `story_id`, `book_id`, `chapter_id` |
| 15 | `PUT /tier/pipeline/:pipelineId` | `story_id`, `book_id`, `chapter_id` |
| 16 | `POST /tier/story-threads` | `id`, `book_id`, `universe_id`, `status`, `introduced_chapter_id`, `resolved_chapter_id`, `last_referenced_chapter_id` |
| 17 | `PUT /tier/story-threads/:threadId` | the same, less `id` |
| 18 | `PATCH /writing-rhythm/goal` | `id` (`active` fixed after the spread) |
| 19 | `PATCH /audio-clips/:id` | `scene_id`, `beat_id`, `status` |
| 20 | `PATCH /beats/:id` | `scene_id`, `character_id`, `status` |
| 21 | `PATCH /character-clips/:id` | `scene_id`, `character_id`, `beat_id`, `status` |
| 22 | `PUT /shows/:id` | `slug`, `status` |
| 23 | `POST /{episodes,shows}/:episodeId/interactive` | not assessed. The call is on no registered model (§1C). Its literal puts body keys after `episode_id`. |
| 24 | `POST /opportunities/:showId` | `id` and `show_id` (both overridden by the body, because `...body` follows them at `:106`), `status`, `connector_profile_id`, `event_id`, `episode_id`, `deleted_at` |
| 25 | `PUT /opportunities/:showId/:id` | `show_id`, `status`, `connector_profile_id`, `event_id`, `episode_id` |
| 26, 27 | `PUT` / `PATCH /{raw-footage,edit-maps}/:id` | `episode_id`, `raw_footage_id` |
| 28 | `PUT /{episodes,templates}/:showId/config` | create: `id`, `show_id` (overridden by the body, because `...updates` follows it at `:50`), `config_key`; update: `show_id`, `config_key` |
| 29 | `POST /layers/bulk-create` | `id`, `deleted_at` (`episode_id` fixed after the spread) |
| 30 | `POST /character-generation/confirm` | update: `registry_id`, `character_key`, `status`, `feed_profile_id`; create: `id`, `character_key`, `feed_profile_id`, and `deleted_at` via the key `deletedAt` (§0.10) (`registry_id` and `status` fixed after the spread, `:162`–`:164`) |
| 31 | `POST /texture-layer/generate` (AI) | `id`, `character_key`, `registry_id`, and `deleted_at` via the key `deletedAt` (§0.10). Also the approval columns `*_confirmed`, `fully_confirmed` and `confirmed_at` (§0.9); none is set after the merges. |
| 32 | `POST /novel/manuscript/cascade` (AI) | update: `series_id`, `book_id`, `approved_at` (`author_approved` fixed after the spread); create: `id`, `series_id`, `book_id`, `author_approved`, `approved_at` (the spread is last, `:335`) |

**Every path in §1 except path 23 can reach at least one column in this table.**
Beyond these, each path can reach every other attribute of its model. That
includes `RegistryCharacter`'s other 190-odd columns on path 30 (197 attributes,
§0.9). For non-admins, the only ones removed there are the four author-only fields.

---

## 3. AI-supplied paths, marked separately

Two paths take their column names from an AI response rather than from the
caller: **31** (`/texture-layer/generate` → `StoryTexture`) and **32**
(`/novel/manuscript/cascade` → `ManuscriptMetadata`). In both, the model's
parsed JSON is merged into the write object without a key filter (§1B). The
caller supplies the prompt inputs, not the keys.

Outside the class, and recorded only so the boundary is visible: several AI
responses fill **values** for names the code chose. Examples are
`worldStudio.js:1406` (§0.5), `characterRegistry.js:1368`, `:1392` and `:1583`,
and `textureLayerRoutes.js` `/regenerate` (its `layerFieldMap` is fixed, `:171`).
Several put AI keys **inside one JSONB column**: `sceneSetRoutes.js:2006`, `:558`
and `sceneGenerationService.js:782` (§0.6).

The character-growth review path, where the AI-chosen `log.field_updated` named
the column, was of this kind until #1710 (§6).

---

## 4. Checked and found constrained

| Instrument | Sites read | In the class | Constrained / outside the class |
|---|---|---|---|
| §0.1 direct `req.body` | 19 | 19 | 0 |
| §0.2 `Object.assign(…, req.body)` | 0 | 0 | 0 |
| §0.3 `const X = req.body` | 24 | 10 | **14** fixed-list |
| §0.4 bare-variable writes | 122 | 10 (9 body, 1 AI; overlaps §0.3) | **112**: fixed literal, static fill, closed Joi schema or code-built array |
| §0.5 computed-key assignment | 67 | 0 | **67**: fixed-list iteration, JSONB-internal keys, or no write |
| §0.6 spreads near a write | 53 | 5 new sites (paths 29, 30, 32) | **48**: stored-row copies, seeds, JSONB values, or already counted |
| §0.7 `Object.assign` | 8 | 7 (path 31) | **1** (`assets.js:897`) |
| §5 raw SQL column lists | 18 | 0 | **18** fixed-list |

The instruments overlap: one site can appear in more than one row. The counts
record what was read. They do not add up to a total of distinct sites.

**Where this read did not look:** `src/models` hooks and instance methods other
than `file.js` (§5); `src/scripts`, `scripts/` and migrations; and writes through a
query builder other than Sequelize and `pg`. A write whose argument is built more
than 80 lines above the call and matched none of the other instruments would also
be missed. Every instrument ran over `src/routes`, `src/controllers` and
`src/services`. §0.1–§0.3 and §5 ran over all of `src`.

---

## 5. Does any raw SQL build a column name from unchecked input?

**No.** At this basis, every raw SQL statement that interpolates a column list
builds it from names fixed in code. Values go in as bound parameters. The input
chooses only which of the fixed names appear.

```
$ git grep -nE "(SET|INSERT INTO[^(]*\()\s*\\\$\{" f8644c945876197c7b0e53d5fb2b62eed1a5ef22 -- src
src/controllers/cursorPathController.js:269:      SET ${setClause.join(', ')}
src/controllers/iconCueController.js:258:      SET ${setClause.join(', ')}
src/controllers/iconSlotController.js:218:      SET ${setClause.join(', ')}
src/controllers/musicCueController.js:231:      SET ${setClause.join(', ')}
src/controllers/sceneStudioController.js:1264:        `UPDATE scenes SET ${setClauses.join(', ')} WHERE id = :id AND deleted_at IS NULL`,
src/controllers/videoCompositionController.js:237:         SET ${updateFields.join(', ')}
src/models/file.js:149:      SET ${updates.join(', ')}
src/routes/templateStudio.js:330:      SET ${updates.join(', ')}
src/routes/uiOverlayRoutes.js:572:      `UPDATE assets SET ${setClauses.join(', ')} WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
src/routes/uiOverlayRoutes.js:914:      `UPDATE ui_overlay_types SET ${sets.join(', ')} WHERE id = :typeId AND show_id = :showId AND deleted_at IS NULL`,
src/routes/worldEvents.js:707:        `UPDATE world_events SET ${setClauses.join(', ')} WHERE id = :eventId AND show_id = :showId`,
src/routes/worldEvents.js:767:              `UPDATE world_events SET ${coreClauses.join(', ')} WHERE id = :eventId AND show_id = :showId`,
src/routes/worldEvents.js:3820:    await models.sequelize.query(`UPDATE stories SET ${sets.join(', ')} WHERE id = :storyId`, { replacements });
src/routes/worldStudio.js:1147:    await sequelize.query(`UPDATE world_characters SET ${updates.join(', ')} WHERE id = :id`, { replacements: rep, type: sequelize.QueryTypes.UPDATE });
src/routes/worldStudio.js:1411:        `UPDATE world_characters SET ${updates.join(', ')}, updated_at = NOW() WHERE id = :id`,
src/routes/worldStudio.js:3094:          `UPDATE character_relationships_extended SET ${updates.join(', ')} WHERE id = :relId AND character_id = :cid`,
src/services/scriptsService.js:293:         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
src/services/todoListService.js:526:      `UPDATE episode_todo_lists SET ${updateParts.join(', ')} WHERE episode_id = :episodeId`,
```

Each list was read back to where it is built:

| Site | Column names come from |
|---|---|
| `cursorPathController.js:269` | `allowedFields.includes(key)` (`:244`) |
| `iconCueController.js:258` | `allowedFields.includes(key)` (`:230`) |
| `iconSlotController.js:218` | `allowedFields.includes(key)` (`:194`) |
| `musicCueController.js:231` | `allowedFields.includes(key)` (`:208`) |
| `sceneStudioController.js:1264` | literals `mood`, `background_url`, `updated_at` (`:1257`–`:1262`) |
| `videoCompositionController.js:237` | literals `name`, `settings`, `updated_at` |
| `models/file.js:149` | `allowedFields.includes(snakeKey)` (`:132`) |
| `templateStudio.js:330` | one literal per destructured body field (e.g. `:300`, `:315`) |
| `uiOverlayRoutes.js:572` | literals `updated_at`, `metadata`, `name` (`:559`–`:567`) |
| `uiOverlayRoutes.js:914` | one literal per destructured body field (e.g. `opens_screen`, `is_home`, `:895`–`:898`) |
| `worldEvents.js:707`, `:767` | `allowedFields` (`:546`), filtered at `:693` |
| `worldEvents.js:3820` | literals `content`, `word_count`, `title`, `status`, `updated_at` (`:3815`–`:3818`) |
| `worldStudio.js:1147` | fixed `fields` array (`:1129`–`:1139`), looked up with `req.body[f]` |
| `worldStudio.js:1411` | `missing`, filtered from the fixed `fillable` (`:1335`); AI supplies values only |
| `worldStudio.js:3094` | fixed `extFields` (`:3080`–`:3083`) |
| `scriptsService.js:293` | `allowedFields.includes(key)` (`:278`) |
| `todoListService.js:526` | literals `tasks`, `asset_id`, `asset_url`, `event_id`, `status`, `updated_at` (`:516`–`:519`), plus `social_tasks` (`:522`) |

Noted outside the question, because it is a **value** interpolated into SQL, not
a column name: `tierFeatures.js:1038` puts `JSON.stringify(...)` of an AI
response (`result.beats`, `result.chapter_arc_type`) inside
`sequelize.literal(\`… '${…}'::jsonb\`)`. The column, `metadata`, is fixed. This
read records it and does not assess it.

---

## 6. Related, by citation only

- **#1710** (`f8644c94`, this basis), "whitelist and gate character-growth review
  writes". It closed one path of this shape. `POST
  /api/v1/memories/character-growth/:id/review` wrote the column named by the
  stored, AI-chosen `log.field_updated`. It now writes only from
  `REVIEW_WRITABLE_FIELDS = ['wound']`, and only for admins:

  ```
  $ git show f8644c945876197c7b0e53d5fb2b62eed1a5ef22:src/routes/characterGrowthRoute.js | grep -nE "REVIEW_WRITABLE_FIELDS =|userInGroup\(req.user"
  291:const REVIEW_WRITABLE_FIELDS = ['wound'];
  315:    if (!userInGroup(req.user, 'admin')) {
  EXIT: 0
  ```

  It is not counted in §1.
- **#1704** (`47f7c00a`), "gate the author-only character fields". It narrowed
  path 30 without closing it. `characterGenerationRoutes.js:121`–`:123` strips the
  four author-only fields from `proposed` for non-admins. Every other
  `RegistryCharacter` column stays reachable (§2, row 30).
- **Filed F-AUTH-1 documents on this class: none.** A search of the register
  finds no F-AUTH-1 document that describes runtime-chosen write columns:

  ```
  $ git grep -liE 'mass[- ]assign|update\(req\.body\)|create\(req\.body\)|caller[- ]chosen|runtime-chosen|chosen at runtime|field_updated' f8644c945876197c7b0e53d5fb2b62eed1a5ef22 -- docs/audit
  docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt
  docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
  docs/audit/F-AUTH-1_Fix_Plan_v2.51.md
  docs/audit/F-Stats-1_Fix_Plan_v1.48.md
  docs/audit/FD31-prod-only-schema-20260601.sql
  EXIT: 0
  ```

  The F-AUTH-1 hit, `F-AUTH-1_Fix_Plan_v2.51.md:40`, matches "caller-chosen"
  about login-token groups, not about write columns. The two schema captures and
  the FD31 SQL match the column name `field_updated`. **The one register passage
  on this shape is F-Stats-1, not F-AUTH-1.** `F-Stats-1_Fix_Plan_v1.48.md` §51.3
  lists `editMaps.js:104` (path 26 here) as "`findByPk(id)` then
  `update(req.body)` — **no field allowlist**" (`:79`). It says the
  "mass-assignment `update(req.body)`" is "orthogonal to which principal is
  admitted" and not covered by F-AUTH-1's PE #9 marker (`:97`). This read cites
  that passage and does not extend it.

---

## 7. What this read does not do

- **It records reachability, not risk.** It makes no claim that any path is
  exploitable, reached in practice, or worse than any other. It does not rank the
  paths.
- **No fix.** No code is changed; no path is closed or narrowed.
- **No ruling.** Nothing here decides which columns any path should accept, or
  who may call it.
- **No Fix Plan** is opened or amended, and no filed document is edited.
- **Mints nothing**: no FD, XK or PE.

---

## Footer

- **Type:** standalone evidence note (MEASURED), F-AUTH-1 family.
- **Rules:** nothing.
- **Mints:** nothing — no FD, XK, or PE.
- **Host / AWS / database / Cognito contact:** none. Every claim above reads
  this repository at the basis, plus the installed Sequelize 6.37.8 source under
  `node_modules/` for §0.10.
- **Production:** production's freeze is lifted
  (`F-Deploy-1_Fix_Plan_v1.53.md` §1). Agent sessions still never touch
  hosts, AWS, RDS, or Cognito (`CLAUDE.md`), unchanged by that lift or by
  this note.
