# Which model validations the `world_events` writes bypass, MEASURED

**Basis:** `origin/main` at `380a2b2b6ed9dd46ed20506f9c8bf5b1913dc66f` (2026-09-24),
the squash merge of #1783. Every `git grep` below reads that tree, and the working
tree was clean at that commit.

**Standing:** MEASURED for every claim unless it is marked INFERRED. Each MEASURED
claim is read directly from the repository at this basis and carries its command and
raw output. INFERRED claims say why they could not be measured. Nothing here is
ATTESTED or RULED.

**What this is.** A read. For every validation the `WorldEvent` model declares, it
records which write paths enforce it at runtime and which bypass it. It then asks the
same question, in outline, for the other models that declare validations. **It records
what the code permits against what the model claims. It records reachability, not
risk.** It fixes nothing, rules nothing, mints nothing (§7).

**Keystone.** This read belongs to no keystone. It is not keystone evidence, and it
sits outside the locked sequence by Evoni's waiver on Task #1784. If a keystone later
claims it, an amendment can say so.

**The hypothesis tested** (Task #1784, from PR #1781's step 4): "`PUT
/world/:showId/events/:eventId` bypasses the model's validations because it writes
with raw SQL; POST create enforces them because it uses `WorldEvent.create`." §1 gives
the verdict per path.

Task: #1784. No host, AWS, database, or Cognito contact.

---

## 0. Instruments and what they found

### 0.1 The rules `WorldEvent` declares: two `isIn`, seven `allowNull: false`

```
$ git grep -nE "validate:|allowNull: false|isIn|len:" 380a2b2b6 -- src/models/WorldEvent.js
380a2b2b6:src/models/WorldEvent.js:19:      allowNull: false,
380a2b2b6:src/models/WorldEvent.js:33:      allowNull: false,
380a2b2b6:src/models/WorldEvent.js:37:      allowNull: false,
380a2b2b6:src/models/WorldEvent.js:43:    // backfill on existing rows. isIn is skipped by Sequelize on a null
380a2b2b6:src/models/WorldEvent.js:50:      validate: {
380a2b2b6:src/models/WorldEvent.js:51:        isIn: [['fashion', 'social', 'brunch_dining', 'beauty_wellness', 'creator_brand', 'arts_entertainment', 'luxury_prestige', 'community_local', 'travel_destination', 'personal_relationship']],
380a2b2b6:src/models/WorldEvent.js:58:      validate: {
380a2b2b6:src/models/WorldEvent.js:59:        isIn: [['cocktail_party', 'garden_soiree', 'gallery_opening', 'gala', 'brunch', 'concert', 'brand_launch', 'premiere']],
380a2b2b6:src/models/WorldEvent.js:137:      allowNull: false,
380a2b2b6:src/models/WorldEvent.js:143:      allowNull: false,
380a2b2b6:src/models/WorldEvent.js:148:      allowNull: false,
380a2b2b6:src/models/WorldEvent.js:265:      allowNull: false,
```

- **The `validate` rules.** There are two: `category` (line 50, `isIn`, 10 values) and
  `format` (line 58, `isIn`, 8 values).
- **The `allowNull: false` attributes.** There are seven: `show_id` (19), `name` (33),
  `event_type` (37), `prestige` (137), `cost_coins` (143), `strictness` (148) and
  `status` (265). They were read by opening each line's attribute.
- **Value sets that live only in comments.** Some attributes list values in a `comment`
  with no `validate`:
  - `event_type` "invite | upgrade | guest | fail_test | deliverable | brand_deal"
  - `status` "draft | ready | used | archived"
  - `prestige` and `strictness` "1-10"

  A comment is not a rule. Sequelize ignores it and nothing enforces it. These sets are
  not in the matrix (§2). §5 returns to them.

### 0.2 What the schema itself enforces (migrations)

```
$ grep -ln "createTable('world_events'\|createTable(\"world_events\"\|CREATE TABLE.*world_events" src/migrations/*
src/migrations/20260219000003-world-events.js
```

- **The create migration** declares `allowNull: false` on `show_id`, `name`,
  `event_type`, `prestige`, `cost_coins`, `strictness` and `status`. Those are the same
  seven columns (lines 20–22, 34–40, 55–68, 149–151 of that migration).
- **The migration that added `category` and `format`**
  (`20260922000000-add-category-format-to-world-events.js`) adds both as nullable
  `STRING(50)`, with no CHECK and no ENUM. Its header records the choice:

  > Enforcement is model-level (WorldEvent.js validate: isIn), not a Postgres ENUM, per
  > Evoni's own ruling: expanding either list later is an application-code change, not a
  > migration.

- **No CHECK constraint exists on `world_events`:** `grep -rn "CHECK\|addConstraint"`
  over the `world_events` migrations prints nothing.

**INFERRED:** that the live schema matches these migrations. No database was read. The
2026-09-17 canon capture cited by `docs/EVENT_EDITOR_READ.md` §2 records `strictness` as
`NOT NULL`, which is consistent, but this read did not re-check the capture.

### 0.3 Every write to `world_events` (outside migrations)

**Raw INSERT: 11 sites.**

```
$ git grep -n "INSERT INTO world_events" 380a2b2b6 -- src ":!src/migrations"
380a2b2b6:src/routes/calendarRoutes.js:584:
380a2b2b6:src/routes/eventGeneratorRoute.js:124:
380a2b2b6:src/routes/worldEvents.js:490:
380a2b2b6:src/routes/worldEvents.js:1170:
380a2b2b6:src/routes/worldEvents.js:2540:
380a2b2b6:src/routes/worldEvents.js:2553:
380a2b2b6:src/services/careerPipelineService.js:224:
380a2b2b6:src/services/eventAutomationService.js:641:
380a2b2b6:src/services/eventAutomationService.js:661:
380a2b2b6:src/services/feedEventPipelineService.js:451:
380a2b2b6:src/services/feedEventPipelineService.js:694:
count: 11
```

(Each line's SQL text is trimmed after the line number.)

**Raw UPDATE: 25 sites in 10 files.**

```
$ git grep -n "UPDATE world_events" 380a2b2b6 -- src ":!src/migrations"
src/routes/worldEvents.js:751:      const updateSql = `UPDATE world_events SET ${setClauses.join(', ')} WHERE id = :eventId AND show_id = :showId`;
src/routes/worldEvents.js:812:              `UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :eventId AND show_id = :showId`,
src/routes/worldEvents.js:829:              `UPDATE world_events SET ${coreClauses.join(', ')} WHERE id = :eventId AND show_id = :showId`,
src/routes/worldEvents.js:876:        `UPDATE world_events SET deleted_at = NOW() WHERE id = :eventId AND show_id = :showId`,
src/routes/worldEvents.js:970:        `UPDATE world_events SET used_in_episode_id = :episodeId, times_used = COALESCE(times_used, 0) + 1, status = 'used', …
src/routes/worldEvents.js:975:        `UPDATE world_events SET used_in_episode_id = :episodeId, status = 'used', updated_at = NOW() WHERE id = :eventId`,
src/routes/worldEvents.js:1020:            `UPDATE world_events SET scene_set_id = :ssId, updated_at = NOW() WHERE id = :eventId`,
src/routes/worldEvents.js:1480:        `UPDATE world_events SET canon_consequences = jsonb_set(
src/routes/worldEvents.js:1560:      'UPDATE world_events SET invitation_asset_id = :assetId, updated_at = NOW() WHERE id = :eventId',
src/routes/worldEvents.js:2000:        'UPDATE world_events SET invitation_asset_id = NULL, updated_at = NOW() WHERE id = :eventId',
src/routes/worldEvents.js:2172:          `UPDATE world_events SET used_in_episode_id = :episodeId, status = 'used', updated_at = NOW() WHERE id = :evId`,
src/routes/worldEvents.js:2253:      await models.sequelize.query('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :eventId', …
src/routes/worldEvents.js:3129:      `UPDATE world_events SET outfit_pieces = :pieces, outfit_score = :score, updated_at = NOW() WHERE id = :eventId`,
src/routes/worldEvents.js:3461:      'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
src/routes/worldEvents.js:3699:          `UPDATE world_events SET used_in_episode_id = NULL
src/routes/worldEvents.js:3825:      `UPDATE world_events SET required_ui_overlays = :overlays, updated_at = NOW() WHERE id = :eventId AND show_id = :showId`,
src/services/episodeCompletionService.js:458:        `UPDATE world_events SET status = 'filmed', updated_at = NOW() WHERE id = :id`,
src/services/episodeGeneratorService.js:903:        `UPDATE world_events SET status = 'used', used_in_episode_id = :episodeId, times_used = COALESCE(times_used, 0) + 1, …
src/services/feedActivityService.js:107:        'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
src/services/feedEngagementService.js:304:        'UPDATE world_events SET momentum_score = :momentum, updated_at = NOW() WHERE id = :id',
src/services/feedEventPipelineService.js:714:      'UPDATE world_events SET seeds_future_events = :seeds, updated_at = NOW() WHERE id = :id',
src/services/financialPressureService.js:118:      'UPDATE world_events SET status = :status, canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
src/services/invitationGeneratorService.js:391:        `UPDATE world_events SET canon_consequences = jsonb_set(
src/services/socialChecklistService.js:341:      'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
src/services/venueGenerationService.js:212:        'UPDATE world_events SET scene_set_id = :sceneSetId, updated_at = NOW() WHERE id = :eventId',
count: 25 in 10 files
```

(The `380a2b2b6:` prefix is trimmed, and three long lines are cut at `…`.)

Task #1784 carried "26 sites in 10 non-migration files" from filing time. That
filing-time grep did not exclude `src/migrations/`, where
`20260807000000-add-source-profile-to-world-event.js` also matches. At this basis the
non-migration count is **25**.

**Model calls: 5 `create` sites and 2 static `update` sites.**

```
$ git grep -nE "WorldEvent\.(create|update|bulkCreate|upsert|findOrCreate)\(" 380a2b2b6 -- src ":!src/migrations"
src/routes/calendarRoutes.js:548:      const worldEvent = await WorldEvent.create({
src/routes/worldEvents.js:451:      const event = await models.WorldEvent.create({
src/routes/worldEvents.js:2527:        event = await models.WorldEvent.create(eventData);
src/services/careerPipelineService.js:221:    event = await WorldEvent.create(eventData);
src/services/episodeGeneratorService.js:897:      await models.WorldEvent.update(
src/services/eventAutomationService.js:637:        const event = await models.WorldEvent.create(eventData);
src/services/feedActivityService.js:101:      await models.WorldEvent.update(
```

**Instance saves.** No instance `save`/`update` runs on a loaded `WorldEvent` row. Every
`WorldEvent.findByPk/findOne/findAll` site (12) was checked for `.save(`/`.update(` on
the loaded variable, and none has one. The only `event.update(...)` in the files that
load a `WorldEvent` is `calendarRoutes.js:234`, and that updates a
`StoryCalendarEvent`, not a `WorldEvent`.

### 0.4 Which Sequelize calls run model validators (Sequelize 6.37.8, from source)

```
$ grep -n '"version"' node_modules/sequelize/package.json
4:  "version": "6.37.8",
$ grep -nE "async save\(|static async create\(|static async update\(|static async bulkCreate\(|validate: true|options.validate|await this.validate\(|\.validate\(\{|instance.validate\(" node_modules/sequelize/lib/model.js
1360:  static async create(values, options) {
1490:      validate: true
1508:    if (options.validate) {
1509:      await instance.validate(options);
1542:  static async bulkCreate(records, options = {}) {
1604:            await instance.validate(validateOptions);
1887:  static async update(values, options) {
1898:      validate: true,
1925:    if (options.validate) {
2355:  async save(options) {
2368:      validate: true
2425:    if (options.validate) {
2426:      await this.validate(options);
```

- **`save`, and therefore `create`, which is `build(...).save()`,** defaults to
  `validate: true` (line 2368) and validates before writing (2425–2426).
- **Static `update`** defaults to `validate: true` (1898). It builds a throwaway instance
  and validates only the keys being written: it sets `options.skip` to every other
  attribute (1925–1932).
- **`bulkCreate`** sets no `validate` default (1542–1560). It validates each record only
  when the caller passes `validate: true` (1602–1604).
- **`sequelize.query`** (`lib/sequelize.js:237`) has no validation step.
  `grep -nE "validate" node_modules/sequelize/lib/sequelize.js` finds only line 607,
  `Sequelize.prototype.validate = Sequelize.prototype.authenticate`, which is a
  connection check.

### 0.5 Local check, no database

The URL points at a closed port. A call that validates must reject a bad `format` with a
validation error before any connection attempt. A call that does not validate reaches
the connection step and fails there instead. The real `src/models/WorldEvent.js` was
loaded.

```
$ NODE_PATH=$PWD/node_modules node valcheck.js
instance.validate() => ValidationError: Validation isIn on format failed
Model.create(bad) => ValidationError: Validation isIn on format failed
Model.update({format: bad}) [static] => ValidationError: Validation isIn on format failed
Model.update({format: bad}, {validate:false}) => SequelizeConnectionRefusedError (reached the connection step)
Model.bulkCreate([bad]) [default] => SequelizeConnectionRefusedError (reached the connection step)
Model.bulkCreate([bad], {validate:true}) => AggregateError (bulk validation):
sequelize.query(UPDATE ... :format) => SequelizeConnectionRefusedError (reached the connection step)
EXIT: 0
```

`valcheck.js` was a scratch script outside the repository. Its whole logic is the seven
calls named on the left, run against `bad = { show_id, name: 'x', format:
'rooftop_rave' }`.

---

## 1. The hypothesis, per path

**Verdict: confirmed for the PUT and for POST create. "Create enforces" is false on two
of the other create paths. On those two, a validation error is swallowed and the row is
written by raw SQL instead. At this basis that does not reach `category` or `format`,
because neither path writes them.**

| Path | How it writes | Validates? | Verdict |
|---|---|---|---|
| **PUT `/world/:showId/events/:eventId`** (`worldEvents.js:566`; SQL at 751, retry at 812/829) | `sequelize.query` with a dynamic `SET` from `allowedFields` | **No.** `category` and `format` are in `scalarStringFields` (line 628), which checks only `typeof val === 'string'`. | **Bypasses. Confirmed.** Any string up to `varchar(50)` is stored. |
| **POST `/world/:showId/events`** (`worldEvents.js:388`; create at 451) | `models.WorldEvent.create`, **not** in a try/catch that falls back. An error reaches the outer catch and returns 500. The raw INSERT at 490 runs only when `models.WorldEvent` is falsy. | **Yes.** | **Enforces. Confirmed.** A bad value fails as a 500, not a 400. |
| **POST `…/events/from-profile`** (`worldEvents.js`; create at 2527) | `WorldEvent.create` inside `try { … } catch (createErr) { console.warn('WorldEvent.create failed, using raw SQL:' …); event = null; }`, then a raw INSERT (2540). If that fails, a minimal raw INSERT follows (2553). | **Swallowed.** `catch (createErr)` takes any error, a validation error included, and retries raw. | **Create does not enforce on this path.** Its `eventData` and both INSERT column lists carry neither `category` nor `format`, so at this basis the two `isIn` columns stay NULL. The seven NOT NULL columns fall to the database (§0.2). |
| **`eventAutomationService.spawnEventsFromCalendar`** (create at 637) | `WorldEvent.create` inside `try`. `catch (createErr)` logs `[EventAutomation] Failed to create event`, then runs a minimal raw INSERT (661). | **Swallowed**, as above. | **Create does not enforce on this path.** Its `eventData` keys are `id show_id name event_type host host_brand description prestige cost_coins strictness deadline_type location_hint venue_name venue_address event_date event_time dress_code narrative_stakes canon_consequences status`, with no `category` or `format`. The same holds for both INSERTs (641, 661). |
| **`careerPipelineService`** (create at 221) | `if (WorldEvent) { event = await WorldEvent.create(eventData); } else { raw INSERT (224) }`. It is **not** a catch-fallback: an error from `create` propagates. | **Yes.** | **Enforces.** The task named this path as a fallback. It is a model-absent branch, not a catch. |
| **`calendarRoutes` spawn-world-event** (create at 548) | `if (WorldEvent) { create …; return res.status(201)… }`, then a raw INSERT (584) marked "Fallback: raw SQL if WorldEvent model not available". | **Yes**, on the model branch. | **Enforces.** It is a model-absent branch, and the raw INSERT writes neither `category` nor `format`. |
| **`eventGeneratorRoute`** (INSERT at 124), **bulk-seed** (`worldEvents.js:1170`), **`feedEventPipelineService`** (451, 694) | Raw INSERT only. No model call. | **No.** | **Bypasses by construction**, but none writes `category` or `format`. The only raw INSERT that names them is `worldEvents.js:502`, POST's model-absent branch. |
| **Static `WorldEvent.update`**: `feedActivityService.js:101`, `episodeGeneratorService.js:897` | `if (models.WorldEvent) { WorldEvent.update(...) } else { raw UPDATE }` | **Yes** (default `validate: true`, §0.4), but only on the keys written: `canon_consequences`, and `status` with `used_in_episode_id`. No rule covers those keys. | **Enforces, trivially.** They write no validated column. |
| The other 23 raw UPDATEs (§0.3) | `sequelize.query` | **No.** | **Bypasses by construction.** None writes `category` or `format`. `status` is written with `'used'` (970, 975, 2172, 903), `'filmed'` (`episodeCompletionService.js:458`) and `'declined'` (`financialPressureService.js:118`), all non-null. |

**Can the model-absent branches run?** **INFERRED: not while the app is up.**
`src/models/index.js` loads `WorldEvent` at line 373, inside the single `try` whose
`catch` (419–422) logs "Error loading models" and rethrows. A failure to load
`WorldEvent` therefore stops the model index from loading at all. Nothing was executed
to confirm this.

---

## 2. The matrix: `WorldEvent` rules × write paths

Legend:
- **E**: enforced, by the model before the write.
- **DB**: not enforced by the app, but the schema's `NOT NULL` would reject it (§0.2;
  the live schema is INFERRED).
- **B**: bypassed; a value the model forbids can be stored.
- **—**: not written by that path.

Paths marked **[req]** take the value from a request body. Paths marked **[AI]** take it
from an AI response (as in `F-AUTH-1_RuntimeColumnWrites_Read_MEASURED_2026-09-23.md`).

| Path | `category` isIn | `format` isIn | 7 × `allowNull: false` |
|---|---|---|---|
| PUT `…/events/:eventId` **[req]**, and **[AI]** through the client (§5.3) | **B** | **B** | DB, only for keys the body sends as `''`/`null` (`normalizeNullLike` turns them into NULL) |
| POST `…/events` **[req]** | E | E | E |
| POST `…/events/from-profile`: model branch | — (NULL) | — (NULL) | E |
| POST `…/events/from-profile`: after a swallowed create error | — | — | DB |
| `eventAutomationService`: model branch **[AI]** for its text fields | — | — | E |
| `eventAutomationService`: after a swallowed create error | — | — | DB |
| `careerPipelineService` (model branch) | — | — | E |
| `calendarRoutes` spawn (model branch) **[req]** | — | — | E |
| `eventGeneratorRoute` INSERT **[AI]** | — | — | DB |
| bulk-seed INSERT **[req]** | — | — | DB |
| `feedEventPipelineService` INSERTs | — | — | DB |
| Static `update` sites (2) | — | — | E (keys written only) |
| Other raw UPDATEs (23) | — | — | DB, for `status` |

**What the matrix says:**
- **The seven `NOT NULL` rules are enforced on every path**, by the model or by the
  schema. The app-level bypass costs nothing for them, provided the live schema matches
  the migrations (INFERRED).
- **The two `isIn` rules exist only in the app**, and exactly one path bypasses them: the
  PUT.

---

## 3. Request- and AI-supplied values into the PUT

The PUT stores whatever string a client sends for `category` or `format`. The in-app
callers that send either field are:

- **`EventPackagePage`** (`saveBasicsField`, Task #1780). It sends values from a picker
  built from the mirrored `isIn` lists, so they are always in range.
- **`QuickEpisodeCreator`** (edit mode). It sends `format` from `EVENT_PRESETS`, which are
  all in range. The "Custom Event" preset sends `''`, which becomes NULL.
- **WorldAdmin `handleBulkEnhance` [AI].** It PUTs every key the AI returns whose value is
  empty on the list row (`if (v && !ev[k]) toSave[k] = v;`, `WorldAdmin.jsx:1136`). The
  list row never carries `category` or `format`, because they are not in
  `WorldEvent.CURRENT_ATTRIBUTES` (instrument: `grep -n "CURRENT_ATTRIBUTES = \[" -A16
  src/models/WorldEvent.js | grep -c "'category'\|'format'"` prints `0`). So an AI answer
  containing either key, in range or not, is sent. The prompt does not ask for them. This
  path is **reachable, not observed**.
- **WorldAdmin's other edit paths** (the modal's `saveable` lists, the form's
  `saveEvent`, `applyAiFix`) do not send `category` or `format` at this basis.

A direct PUT from any authenticated client can store any string. The route is
`requireAuth`, not admin-gated.

---

## 4. The other models that declare validations (outline)

```
$ git grep -l "validate:" 380a2b2b6 -- src/models | sort
… 22 files (listed below with WorldEvent.js)
```

Excluding `WorldEvent.js`, **21 models** declare attribute-level `validate` rules.
- **Registration:** all 21 have an explicit `tableName` and are registered in
  `src/models/index.js`.
- **False positive checked:** `Scene.js:107` holds a commented-out `validate` on
  `layout`. Scene's other rules are live.
- **Raw writers:** for each table, `git grep -niE "(INSERT INTO|UPDATE)\s+[\"\`]?<table>[\"\`]?\b" 380a2b2b6 -- src ':!src/migrations'`.

| Model (table) | Rules, short | Raw-SQL writers |
|---|---|---|
| **StorytellerMemory** (`storyteller_memories`) | `type` isIn (15 values); `statement` notEmpty; `confidence` 0–1 | **2**: `routes/memories/assistant.js:1554`; `routes/worldStudio.js:2286` |
| **Scene** (`scenes`) | `scene_number` min 1; `title` len; `duration_seconds` min 0; `scene_type`, `production_status` isIn; `assets` custom; `ai_confidence_score` 0–1 | **5**: `sceneController.js:416`; `sceneStudioController.js:193`, `:215`, `:1264`; `scriptsService.js:688` |
| **Show** (`shows`) | `name` len + notEmpty; `slug` len | **4**: `routes/shows.js:261`; `uiOverlayRoutes.js:538`; `distributionService.js:305`; `financialTransactionService.js:178` |
| ActivityLog, AssetLabel, AudioClip, Beat, CharacterClip, CompositionOutput, DecisionPattern, EpisodeTemplate, Layer, LayerAsset, Marker, MetadataStorage, ProcessingQueue, SceneAsset, Thumbnail, UserDecision, WardrobeLibrary, WardrobeUsageHistory | various (isIn, ranges, regex, notEmpty) | **0** |

**The three models with raw writers, read one by one:**

- **`storyteller_memories`: a bypass reached by AI output.** The column is a plain
  `STRING(100)` in its create migration
  (`20260221120000-create-storyteller-memories.js:39–42`) and in the model. There is no
  ENUM and no CHECK, so nothing below the app rejects a bad value.
  - `assistant.js:1554` **[AI]** inserts `type: String(m.type).slice(0, 100)` from a model
    reply, with no check against the 15-value list. It skips empty statements and clamps
    `confidence` to 0–1, which matches the other two rules.
  - `worldStudio.js:2286` **[AI]** inserts `type: mem.memory_type || 'character_dynamic'`
    and `confidence: mem.confidence || 0.8`, with neither a list check nor a clamp. Its
    prompt asks for `belief|constraint|character_dynamic|pain_point`, all of which are in
    the list. What the model returns is not checked.
- **`scenes`: partly.**
  - `sceneController.js:416` writes `scene_number = i + 1`, which is always at least 1.
  - `scriptsService.js:688` inserts `scene_number` and `duration_seconds` from parsed
    script data without a model check. It also names columns `name` and `type`, while the
    model's attributes are `title` and `scene_type`. That mismatch was not checked against
    any schema here.
  - `sceneStudioController.js` writes `background_url`, `canvas_settings` and `mood`,
    which have no rules.
- **`shows`: no validated column is bypassed in practice.** `shows.js:261` inserts a
  fixed `name` and a generated `slug`, and the other three writers touch unvalidated
  columns.

Not examined here: `bulkCreate` calls on these models without `validate: true`, and
static `update` calls with `validate: false`. Both would also skip validation (§0.4).

---

## 5. Options, weighed without a recommendation

Each option is described with its cost. None is chosen.

### 5.1 Route-level checks built from the model's own `rawAttributes`

The PUT (and any other raw writer) would call a small helper that runs the model's
`isIn` lists, for example `WorldEvent.rawAttributes.category.validate.isIn[0]`, before
writing.
- **For:** fast to add. It keeps the single source of the values in the model. It needs
  no migration.
- **Cost:**
  - It is a second place the rules are *applied*, with its own drift risk. A rule added to
    the model is only as enforced as the list of callers that remember the helper.
  - Every raw path needs its own call.
  - For `category` and `format` the only such path is the PUT (§2). For
    `storyteller_memories` it is two more (§4).

### 5.2 Moving writes back onto the model

The PUT would become `event.update(fields)` on a loaded instance, or a static `update`.
The raw INSERTs would become `create`.
- **For:** one enforcement point, the model, and the default behaviour of every Sequelize
  write call (§0.4).
- **Cost:**
  - It may break what the raw fallbacks exist to do. What each guards, read from its own
    comments and code:
    - **The PUT's core-field retry** (`worldEvents.js:774–835`) exists for a missing
      column. It retries with core fields only when the error text contains "does not
      exist" or "column".
    - **`from-profile`'s full-then-minimal INSERTs** (2540, 2553) are commented "Minimal
      fallback — only guaranteed columns".
    - **`eventAutomationService`'s minimal INSERT** (661) is commented "Try raw SQL as
      last resort — minimal columns".
    - **The model-absent branches** (POST 490, `careerPipelineService`, `calendarRoutes`,
      the two static-update sites) guard a model that failed to load, which §1 infers
      cannot happen while the app is up.
  - Moving to the model also changes the PUT's merge behaviour for `canon_consequences`,
    which is a read-modify-write under `SELECT … FOR UPDATE` (`worldEvents.js:752–768`).
    That merge would have to be kept deliberately.

### 5.3 Database CHECK constraints

For example, `CHECK (category IS NULL OR category IN (…))` and the same for `format`.
- **For:** the only enforcement nothing in the app can bypass. Raw SQL, a future path, a
  script and a console session all hit it.
- **Cost:**
  - **Each needs a new migration** under `src/migrations/`, which Evoni runs.
  - **It reverses a recorded choice.** The category/format migration records Evoni's
    ruling that enforcement is model-level "not a Postgres ENUM … expanding either list
    later is an application-code change, not a migration" (§0.2). A CHECK carries the
    same cost as an ENUM on that point: widening the list becomes a migration again.
  - **Existing out-of-range rows must be counted first.** Adding a CHECK fails if any row
    violates it, unless the constraint is added `NOT VALID`, which leaves old rows
    unchecked. The read-only SQL for Evoni is below; it was not run.
  - **It turns a silent problem into a visible error.** Which paths would start failing:
    - **For `category`/`format`, only the PUT**, and only for a body carrying an
      out-of-range value. No fallback path fails, because none writes these columns
      (§1). Of the in-app callers (§3), only **WorldAdmin Bulk Enhance** can send one,
      from AI output. Its per-event `try { … } catch {}` (`WorldAdmin.jsx:1143`) would
      swallow the 500. The whole PUT for that event would then be lost, including the
      in-range fields in the same body, still with no message. So the error becomes
      visible in the server log, not in the UI.
    - **For `storyteller_memories.type`, both AI writers:**
      - `assistant.js:1554` sits inside a per-line `try … catch (e) { console.error('Memory
        extraction failed for line …') }`. A bad type would abort the remaining memories
        for that line, log, and move on to the next line.
      - `worldStudio.js:2286` has `.catch(e => console.warn('[world-studio] memory insert
        error:' …))`. The memory would be dropped with a warning.
    - **The comment-only value sets (§0.1) are not rules.** A CHECK built from them would
      enforce something the model never declared. Code writes `status` values outside
      that comment's list, `'filmed'` and `'declined'` (§1), so such a CHECK would break
      Complete Episode and Decline Invite. They are named here only so that no one builds
      a constraint from a comment.

Read-only SQL for Evoni, not run:

```sql
-- world_events: rows a CHECK on the two declared isIn rules would reject.
SELECT
  count(*) FILTER (WHERE category IS NOT NULL AND category NOT IN
    ('fashion','social','brunch_dining','beauty_wellness','creator_brand','arts_entertainment',
     'luxury_prestige','community_local','travel_destination','personal_relationship')) AS category_out_of_range,
  count(*) FILTER (WHERE format IS NOT NULL AND format NOT IN
    ('cocktail_party','garden_soiree','gallery_opening','gala','brunch','concert','brand_launch','premiere')) AS format_out_of_range
FROM world_events;          -- all rows, soft-deleted included: a CHECK applies to every row

-- storyteller_memories: rows outside the model's 15-value type list.
SELECT type, count(*)
FROM storyteller_memories
WHERE type NOT IN ('goal','preference','relationship','belief','event','constraint','transformation',
                   'pain_point','character_dynamic','belief_shift','therapy_opening','dramatic_irony',
                   'open_mystery','foreshadow_seed','prose_style_anchor')
GROUP BY type ORDER BY count(*) DESC;
```

---

## 6. Related, by citation only

- **`docs/audit/F-AUTH-1_RuntimeColumnWrites_Read_MEASURED_2026-09-23.md`** (#1710).
  This read's model, and the same class of question one level down: that read records
  which columns a caller can choose; this one records which declared values a write can
  bypass. Not restated, not re-derived.
- **PR #1781's step 4** (Task #1780). It first reported that the PUT does not enforce
  `category`/`format` and that POST does. §1 confirms both and adds the fallback paths.
- **`docs/EVENT_EDITOR_REMOVAL_READ.md`** (#1779), §5.3. It names Bulk Enhance's
  save-without-review, which §3 and §5.3 rely on for the Bulk Enhance path.

None of these is edited, discharged or ruled on here.

---

## 7. What this read does not do

- It does not fix anything, change code, or add a migration.
- It does not recommend an option (§5). The choice is Evoni's.
- It rules nothing, discharges no owed item, and mints no FD, XK or PE number.
- It claims no keystone.
- It does not query the database. Unmeasured:
  - whether the live schema matches the migrations (§0.2);
  - how many rows are already out of range (§5.3 SQL);
  - whether Bulk Enhance has ever sent `category` or `format` (§3).
- It does not examine `bulkCreate` or `validate: false` calls on the other 21 models
  (§4).
- It makes no host, AWS, database or Cognito contact. The Sequelize behaviour in §0.5 was
  checked with the local library against a closed port.

---

## Footer

*Type: MEASURED read. Rules: nothing. Mints: nothing. Discharges: nothing. Keystone:
none. Host/AWS/DB/Cognito contact by the filing session: none. Production's freeze is
lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS,
RDS or Cognito (`CLAUDE.md`). Task: #1784.*
