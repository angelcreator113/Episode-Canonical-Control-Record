# F-Stats-1 §35.5 Classes 2–6 — Reach Probe

| | |
|---|---|
| **Basis** | `origin/main` at `073e57f8c73ca7988c1abd4c5684d14eec947539` (#2071), 2026-09-27, the /wake-up SHA of the session that filed this. Every `file:line` below is at this basis unless it names another. |
| **Type** | Standalone probe. Owed by `F-Stats-1_Fix_Plan_v1.62.md` §65.3 as **§65.3-P**. Rules nothing. Closes nothing. Mints nothing. |
| **Standing** | **MEASURED**: a command and its raw output, reproducible from a clone. **ATTESTED, from a filed document**: the canon schema capture `EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`, Evoni's column listing of the canon database, used for which tables carry `deleted_at` and which columns are `json`/`jsonb`. **INFERRED**, marked where used: what data would make two sites disagree. |
| **Population** | Every `.js` file under `src/routes/`, recursively, including `src/routes/memories/`: the scoping note's method (`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md` §1). 142 files at this basis. |
| **Task** | #2073 |

---

## §0. What is owed, quoted

**v1.62 §65.3**, the ruling and the probe owed (`F-Stats-1_Fix_Plan_v1.62.md:110–116`):

> **RULED:** all five **homed to F-Stats-1** as they stand, recorded as **`worldEvents.js`-only, reach not established**. **Class 4** ("Parallel balance readers, none authoritative", the money path) is **flagged the priority**. **Class 6** ("Model-acquisition idiom drift") **stays an observation**.
>
> **Owed: §65.3-P, the reach probe**, "later", per the ruling. It is agent-doable. It must first re-locate each instance by content, since `worldEvents.js` has changed by +538/−88 lines since v1.33's basis (`F-Stats-1_PhaseB_Items2to7_Decisions_2026-09-27.md`, item 3).
>
> **Disposition:** item 3's homing is done; its reach probe is owed.

**v1.33 §35.5**, the classes as defined (`F-Stats-1_Fix_Plan_v1.33.md:183–193`, basis `2c9ead22`):

> | # | Class | Instances | Homing status |
> |---|---|---|---|
> | 2 | Soft-delete filter maintained by hand in raw queries | 7+ instances, 3 tables, in-handler split at 2697 | OWED. Mechanism differs from XK-1: the column exists and the query omits it. |
> | 3 | Swallowing catch producing a fabricated result | 4 at 2278; 1 at 2219; counter-example at 2352 | OWED. |
> | 4 | Parallel balance readers, none authoritative | 3 mechanisms: 2219, 2278, 3730 | OWED. Money path; adjacent to open item 6's carved assertions. |
> | 5 | Denormalized JSON snapshot with no refresh path | `outfit_pieces` at 2697 | OWED. Same shape as the `canonical_description` copies already on the register. |
> | 6 | Model-acquisition idiom drift | 3 idioms across 22 statements | Observation. Low severity. |
>
> **No PE, FD, or XK number is minted for any of these.** Establishing reach
> requires a probe across route files, which is not attempted here.

(Class 1 is omitted from the quote. It is XK-2, not this document's subject.)

**The 2026-09-14 homing note** (`F-Stats-1_S355_Classes2to6_Homing_2026-09-14.md:496–497`), which carried the classes forward without probing them:

> - Establish reach for any class beyond what the family's own text already
>   records (`worldEvents.js`-only, per v1.33 and v1.41).

That note also carries v1.41 §44.6's new instances, all still in `worldEvents.js` (v1.41 basis `9ed5fb38`): class 2, "5 further in-handler splits; 1109-vs-1307 divergence on one table"; class 3, "1149 (canon write lost), 1214/1221 (approval no-op), 2178/2191 (incomplete canon row echoed as complete), 1718, 1972"; class 5, "1580 whole-JSONB read-modify-write, last-write-wins"; class 6, "`getModels()` vs `req.app.get('models')` vs `require('../models')` across both groups".

---

## §1. Re-location by content — MEASURED

`worldEvents.js` is 4005 lines at `2c9ead22` and 4455 at this basis:

```
$ git show 2c9ead22:src/routes/worldEvents.js | wc -l; git show 073e57f8:src/routes/worldEvents.js | wc -l
4005
4455
```

v1.33's line numbers are handler lines. At `2c9ead22` each cited line is a `router.*` declaration. Each is re-located here by its route path:

```
$ git show 073e57f8:src/routes/worldEvents.js | grep -nE "router\.(get|post|put|delete|patch)\('/world/:showId/(events/:eventId/(affordability|decline|financial-forecast|generate-venue|outfit|wardrobe-options)|financial-pressure|balance|stories/:storyId|episodes/:episodeId/distribution)'"
2660:router.get('/world/:showId/events/:eventId/affordability', requireAuth, async (req, res) => {
2693:router.post('/world/:showId/events/:eventId/decline', requireAuth, async (req, res) => {
2719:router.get('/world/:showId/financial-pressure', requireAuth, async (req, res) => {
2793:router.get('/world/:showId/events/:eventId/financial-forecast', requireAuth, async (req, res) => {
3006:router.post('/world/:showId/events/:eventId/generate-venue', requireAuth, async (req, res) => {
3121:router.get('/world/:showId/events/:eventId/outfit', requireAuth, async (req, res) => {
3143:router.put('/world/:showId/events/:eventId/outfit', requireAuth, async (req, res) => {
3222:router.get('/world/:showId/events/:eventId/wardrobe-options', requireAuth, async (req, res) => {
3960:router.get('/world/:showId/stories/:storyId', requireAuth, async (req, res) => {
3978:router.put('/world/:showId/stories/:storyId', requireAuth, async (req, res) => {
4025:router.get('/world/:showId/episodes/:episodeId/distribution', requireAuth, async (req, res) => {
4045:router.put('/world/:showId/episodes/:episodeId/distribution', requireAuth, async (req, res) => {
4175:router.get('/world/:showId/balance', requireAuth, async (req, res) => {
```

v1.41's line numbers are statement lines at `9ed5fb38`. Each is re-located here by its SQL text (`grep -nF` of the statement's distinctive text at this basis):

| v1.41 line (`9ed5fb38`) | Handler | Now | Statement |
|---|---|---|---|
| 1109 | `re-render-invitation` | 1512 | `SELECT s3_url_raw FROM assets WHERE metadata->>'event_id' = :eventId AND asset_type = 'INVITATION_LETTER' ...` |
| 1149 | `re-render-invitation` | 1552 | `UPDATE world_events SET canon_consequences = jsonb_set(...)` |
| 1214 | `approve-invitation` | 1617 | `UPDATE assets SET approval_status = 'approved', episode_id = :episodeId ...` |
| 1221 | `approve-invitation` | 1624 | `UPDATE assets SET updated_at = NOW() WHERE id = :assetId` |
| 1307 | `invitation-history` | 1709 (`metadata->>'version'` at 1711) | `SELECT id, name, s3_url_processed as image_url ... AND deleted_at IS NULL` |
| 1580 | `edit-invitation-text` | 1983 | `UPDATE assets SET s3_url_processed = :url, metadata = :metadata ...` |
| 1718 | `generate-episode` | 2121 | `SELECT id, name, coin_cost, price, acquisition_type FROM wardrobe ...` |
| 1972 | `bulk-delete` | 2392 | `DELETE FROM world_events WHERE id = :id AND show_id = :showId` |
| 2178 | `from-profile` | 2620 | `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, ...` (22 columns) |
| 2191 | `from-profile` | 2633 | `INSERT INTO world_events (id, show_id, name, event_type, host, description, ...` (11 columns) |

The wardrobe `SELECT` text now occurs three times (2121, 2223, 2339). The one v1.41 cited at 1718 was in `generate-episode`, which is 2121 now. 2223 is v1.41's 1816 (`generate-episode-from-many`), and 2339 is in `regenerate-episode`.

### §1.1 Class 2 — soft-delete filter maintained by hand

`world_events`, `assets`, `stories`, `episodes` and `wardrobe` all carry `deleted_at` in the canon capture (ATTESTED, from a filed document). The v1.33 instances, now. This is an annotated excerpt of `sed -n` on the basis file: line text as it stands, with the handler added in parentheses and long lines shortened where marked `...`. The filtered `GET`s are listed beside the unfiltered writes they diverge from.

```
2700:       'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',                    (decline)
3127:       'SELECT outfit_pieces, outfit_score, name, ... FROM world_events WHERE id = :eventId LIMIT 1',   (outfit GET)
3155:       'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',                    (outfit PUT)
3166:        FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL`,                  (outfit PUT, same handler: the split)
3229:       'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',                    (wardrobe-options)
3240:        FROM wardrobe WHERE (show_id = :showId OR show_id IS NULL) AND deleted_at IS NULL   (wardrobe-options, the split)
3966:       'SELECT * FROM stories WHERE id = :storyId AND deleted_at IS NULL LIMIT 1', (stories GET)
3991:     await models.sequelize.query(`UPDATE stories SET ${sets.join(', ')} WHERE id = :storyId`, { replacements });   (stories PUT)
4031:       `SELECT distribution_metadata FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,  (distribution GET)
4052:       `UPDATE episodes SET distribution_metadata = :metadata, updated_at = NOW() WHERE id = :episodeId`,  (distribution PUT)
```

These are all still present, on three tables: `world_events`, `stories` and `episodes`. The 2697 split (now 3143–3166) and the 2776 split (now 3222–3240) are unchanged in shape. The affordability event lookup (2660 handler) is `SELECT * FROM world_events WHERE id = :eventId LIMIT 1` at 2667. The balance handler's next-event read is at 4188 (§1.3). v1.41's 1109-vs-1307 divergence holds: 1512 has no `deleted_at`; 1709's statement filters it.

**Not re-locatable individually:** v1.41's "5 further in-handler splits". v1.41 does not list them by line, so there is nothing to match. The probe in §2 covers any that remain.

**Also still present:** `generate-venue` (3006). Its lookup at 3015 is `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1`: scoped, as v1.33 recorded, and still without `deleted_at`. It is in the probe's output (§2).

### §1.2 Class 3 — swallowing catch producing a fabricated result

Annotated excerpt, as in §1.1:

```
2673:    let balance = 500; // default                       (affordability)
2681:    } catch { /* use default */ }
2725:    let balance = 500;                                    (financial-pressure: four catches)
2733:    } catch { /* use default */ }
2746:    } catch { /* table may not have status=declined */ }
2756:    } catch { /* table may not exist */ }
2769:    } catch { /* columns may not exist */ }
1557:    } catch { /* non-blocking */ }                        (re-render-invitation: v1.41's 1149, canon write lost)
1620/1627: catch → UPDATE assets SET updated_at ... → catch { /* non-blocking */ }   (approve-invitation: 1214/1221)
2125:    } catch { /* wardrobe table may not exist yet */ }   (generate-episode: v1.41's 1718)
2396:        } catch { /* skip */ }                            (bulk-delete: v1.41's 1972)
```

v1.33's counter-example is still present. `financial-forecast` narrows its catch to SQLSTATE `42703` and rethrows everything else:

```
2810:      if (err?.original?.code !== '42703' && !String(err?.message || '').includes('is_free')) throw err;
```

v1.41's 2178/2191 ladder is now at 2620/2633 in `from-profile`. Its catches log with `console.warn` before falling to the next tier. Only the last tier answers 500. When the minimal insert succeeds, the handler answers 201 with the full `eventData` it meant to write. §2's class 3 probe does not see this instance, because the catches log (see its blind spots).

### §1.3 Class 4 — parallel balance readers

v1.33's three mechanisms, now. This is a summary of the lines, not raw output; §2.3 has the raw probe:

```
2673-2681 (affordability):      SELECT state_json FROM character_state_history ... ; balance = stateJson?.coins ?? 500; catch → 500
2725-2733 (financial-pressure): the same statement and default, repeated
4182 (balance):                 const balance = await getCurrentBalance(models.sequelize, showId);
```

Since v1.33, `financial-forecast` (2793) also reads the balance, through `getCurrentBalance` at 2951. §3 compares every reader.

### §1.4 Class 5 — denormalized JSON snapshot

```
3163:       `SELECT id, name, clothing_category, brand, tier, price, color, is_owned,
3166:        FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL`,
3210:       `UPDATE world_events SET outfit_pieces = :pieces, outfit_score = :score, updated_at = NOW() WHERE id = :eventId`,
```

The outfit PUT (3143) copies the wardrobe rows it reads into `world_events.outfit_pieces`. The outfit GET (3121) and `financial-forecast` (2793) read the copy back. The event `PUT` (584) also accepts `outfit_pieces` from the request body; its field list at 644 names it. No path in this file rewrites the copy from the wardrobe rows when one of them changes. v1.41's 1580 is now 1983: `UPDATE assets SET s3_url_processed = :url, metadata = :metadata`, which writes the whole `metadata` object back.

### §1.5 Class 6 — model-acquisition idioms

All three v1.41 idioms are present in `worldEvents.js` (§2, class 6): `getModels()` 38 times, `req.app.get('models')` (including the optional-chained `req.app?.get?.('models')`) 23 times, and `require('../models')` 25 times. The last count includes the `require` inside `getModels`'s own definition and the `|| require('../models')` fallbacks.

**Every class is re-located; none is missing.** The one instance that can't be matched individually is v1.41's unlisted "5 further in-handler splits" (§1.1).

---

## §2. The probes — MEASURED

Classes 2, 3, 5 and 6 are probed by one script, `s355probe.js`, reproduced in full in Appendix A. It reads each file with `git show <basis>:<path>` and parses it with `acorn`. It prints one line per site, then per-file totals sorted by count. Class 4 is probed by a `git grep` (§2.3). Run from the repository root:

```
$ node s355probe.js 073e57f8 <class>
```

Each class's full site list is in Appendix B.

### §2.1 Class 2 — raw SQL on a soft-delete table that omits `deleted_at`

**Probe.** It takes every string or template literal containing `SELECT` or `UPDATE` (uppercase). For each table named after `FROM`, `JOIN` or `UPDATE`, it checks the table against the canon capture. A site is a literal that names a table carrying `deleted_at` and whose text does not contain `deleted_at` anywhere. `DELETE FROM` is excluded: a hard delete is another shape, recorded at v1.41 as "Hard delete on a soft-deleted table".

**What it misses:**
- a literal that filters `deleted_at` on one table but not on another it joins (it counts as filtered);
- SQL assembled from several literals, or from `${}` fragments such as `relationships.js`'s `${CHAR_JOIN}` (a join inside the fragment is not seen);
- lowercase SQL;
- ORM calls, where paranoid models add the filter themselves and non-paranoid ones do not.

It also cannot tell whether reading a soft-deleted row matters at a given site: a lookup by id straight after a write, say. So every site matches the class's shape, and no site is a defect on that alone.

```
--- files=24 of 142; sites=234
```

| Sites | File |
|---:|---|
| 74 | `src/routes/worldStudio.js` |
| **61** | **`src/routes/worldEvents.js`** |
| 23 | `src/routes/relationships.js` |
| 19 | `src/routes/storyHealth.js` |
| 11 | `src/routes/memories/assistant.js` |
| 6 | `src/routes/tierFeatures.js` |
| 6 | `src/routes/todoListRoutes.js` |
| 5 | `src/routes/world.js` |
| 4 | `src/routes/scriptAnalysis.js` |
| 3 | `src/routes/scenes.js` |
| 3 | `src/routes/storyEvaluationRoutes.js` |
| 2 | `src/routes/arcRoutes.js`, `episodeOrchestrationRoute.js`, `export.js`, `franchiseBrainRoutes.js`, `memories/extras.js`, `shows.js` (2 each) |
| 1 | `src/routes/calendarRoutes.js`, `careerGoals.js`, `characterRegistry.js`, `episodes.js`, `evaluation.js`, `eventGeneratorRoute.js`, `wardrobe.js` (1 each) |
| **234** | **24 files; `worldEvents.js` 61, the other 23 files 173** |

By table: `world_events` 56, `world_characters` 36, `character_relationships` 30, `registry_characters` 27, `storyteller_stories` 10, `intimate_scenes` 10, `assets` 9, `episodes` 6, `episode_todo_lists` 6, `franchise_knowledge` 5, `story_threads` 4, `social_profiles` 4, and the rest at 3 or fewer (Appendix B.1). In `worldEvents.js` the tables are: `world_events` 49, `assets` 7, `episode_todo_lists` 2, `episodes` 1, `social_profiles` 1, `stories` 1.

**Reach: established beyond `worldEvents.js`.** 23 other route files carry the shape. Most of them are in `worldStudio.js`, `relationships.js` and `storyHealth.js`.

### §2.2 Class 3 — a swallowing catch

**Probe.** It takes every `catch` clause and every `.catch(fn)` callback. A site is one whose body contains none of these: `console.error|warn|log|info`, `throw`, `res.status|json|send|sendStatus`, `next(`, `reject(` or `logger.`. In other words, the error is neither logged, rethrown nor answered. Each site is tagged by body:
- `empty-or-comment`: execution continues with whatever value was already set;
- `returns`: returns a value;
- `arrow-value`: `.catch(() => value)`;
- `other`: any other statement, for example an assignment.

**What it misses:**
- A catch that logs and still continues with a made-up value. `from-profile`'s ladder is the worked example (§1.2). The probe's surfacing test is wider than the class's, so this whole family is missed.
- A result fabricated outside the catch, where a default is set before the `try`. The probe finds the catch, but whether the value that survives is "fabricated" or a correct empty result is a read, not a grep.
- It also counts catches whose swallowed error is harmless (a best-effort cleanup, say). So its count is the population the class lives in, not the class itself.

```
--- files=49 of 142; sites=260
```

| Sites | File |
|---:|---|
| **62** | **`src/routes/worldEvents.js`** |
| 22 | `src/routes/memories/engine.js` |
| 17 | `src/routes/storyHealth.js` |
| 12 | `src/routes/socialProfileRoutes.js` |
| 10 | `src/routes/characterAI.js` |
| 9 | `src/routes/storyteller.js`, `worldStudio.js` (9 each) |
| 8 | `src/routes/memories/assistant.js` |
| 6 | `src/routes/onboarding.js`, `sceneProposeRoute.js`, `shows.js`, `wardrobe.js`, `world.js` (6 each) |
| 5 | `src/routes/characterRegistry.js`, `evaluation.js`, `storyEvaluationRoutes.js` (5 each) |
| 4 | `src/routes/memories/interview.js`, `memories/stories.js`, `socialProfileBulkRoutes.js`, `tierFeatures.js`, `uiOverlayRoutes.js` (4 each) |
| 3 | `src/routes/amberDiagnosticRoutes.js`, `amberSessionRoutes.js`, `careerGoals.js`, `episodes.js`, `sceneSetRoutes.js`, `therapy.js`, `wardrobeEventRoutes.js` (3 each) |
| 2 | `src/routes/eventGeneratorRoute.js`, `generate-script-from-book.js`, `scriptParse.js`, `session.js` (2 each) |
| 1 | 17 files, 1 each (Appendix B.2) |
| **260** | **49 files; `worldEvents.js` 62, the other 48 files 198** |

By body: `empty-or-comment` 122, `other` 81, `returns` 29, `arrow-value` 28. In `worldEvents.js`: `other` 29, `empty-or-comment` 23, `arrow-value` 6, `returns` 4. Every class 3 instance in §1.2 except the `from-profile` ladder is in the output (Appendix B.2).

**Reach: the shape is established in 48 other route files.** Whether each of their sites fabricates a result needs a read of each site, which this document does not do.

### §2.3 Class 4 — balance readers

**Probe:**

```
$ git grep -nE "getCurrentBalance\(|FROM financial_transactions|state_json|state_after_json|CharacterState\.find(One|All)\(|FROM character_state\b" 073e57f8 -- src/routes
```

It finds reads of the three places a balance is kept: the ledger (`financial_transactions`, through `getCurrentBalance`), the running balance (`character_state.coins`), and the history snapshot (`character_state_history`).

**What it misses:**
- a balance passed into a service that reads it there: services are outside the population, and §3 reads the one that matters, `financialTransactionService`;
- `character_state` reached by another name;
- a `CharacterState` read that doesn't use `coins`. The probe counts it; §3 separates them.

Raw output, one line per hit (comment lines dropped):

```
src/routes/careerGoals.js:381:      const state = await models.CharacterState.findOne({
src/routes/careerGoals.js:508:    const state = await models.CharacterState.findOne({
src/routes/careerGoals.js:578:      const state = await models.CharacterState.findOne({
src/routes/episodes.js:963:    const state = await CharacterState.findOne({
src/routes/evaluation.js:48:  const rows = await models.CharacterState.findAll({
src/routes/evaluation.js:638:      ledgerBefore = await getCurrentBalance(models.sequelize, show_id);
src/routes/evaluation.js:654:           (id, show_id, season_id, character_key, episode_id, source, deltas_json, state_after_json, notes, created_at)
src/routes/shows.js:417:      getCurrentBalance(sequelize, show.id),
src/routes/shows.js:494:       FROM financial_transactions
src/routes/shows.js:576:    const currentBalance = await getCurrentBalance(sequelize, showId);
src/routes/shows.js:932:       FROM financial_transactions
src/routes/shows.js:943:       FROM financial_transactions
src/routes/shows.js:1042:      getCurrentBalance(sequelize, showId),
src/routes/wardrobe.js:1402:      const state = await models.CharacterState.findOne({
src/routes/wardrobe.js:1423:        const ledgerBefore = await getCurrentBalance(models.sequelize, show_id);
src/routes/wardrobe.js:1565:    const state = await models.CharacterState.findOne({
src/routes/wardrobe.js:1594:    const ledgerBefore = purchases.length > 0 ? await getCurrentBalance(models.sequelize, show_id) : null;
src/routes/wardrobe.js:1701:    const state = await models.CharacterState.findOne({
src/routes/wardrobe.js:1731:    const ledgerBefore = await getCurrentBalance(models.sequelize, show_id);
src/routes/worldEvents.js:1172:        `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
src/routes/worldEvents.js:2676:        `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
src/routes/worldEvents.js:2679:      const stateJson = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
src/routes/worldEvents.js:2728:        `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
src/routes/worldEvents.js:2731:      const stateJson = typeof state?.state_json === 'string' ? JSON.parse(state.state_json) : state?.state_json;
src/routes/worldEvents.js:2951:      getCurrentBalance(models.sequelize, showId),
src/routes/worldEvents.js:4182:    const balance = await getCurrentBalance(models.sequelize, showId);
src/routes/worldEvents.js:4281:       FROM character_state
```

27 hits in 6 files: `worldEvents.js` 8, `wardrobe.js` 6, `shows.js` 6, `evaluation.js` 3, `careerGoals.js` 3, `episodes.js` 1. Four of them are not balance reads: `evaluation.js:654` (an `INSERT` column list) and `shows.js:494`, `932` and `943` (lifetime totals and category breakdowns). §3 separates them.

**Reach: established beyond `worldEvents.js`.** Balance readers sit in five other route files. `worldEvents.js` alone reads all three stores.

### §2.4 Class 5 — a raw write to a JSON column

**Probe.** It takes every `UPDATE t SET col = ...` and `INSERT INTO t (cols)` in a literal. A site is a column that is `json` or `jsonb` in the canon capture.

**What it misses:**
- It cannot tell whether the value written was copied from another row. That is the class's defining test, and it needs a read of where the value came from. So every site is a **candidate**, not an instance.
- ORM writes (`Model.update({...})`, `.create({...})`) are not seen.
- A JSON column written through `jsonb_set` is counted under its column, which is correct, but whole-object versus partial writes are not told apart.

```
--- files=12 of 142; sites=109
```

| Sites | File |
|---:|---|
| 51 | `src/routes/worldStudio.js` |
| **24** | **`src/routes/worldEvents.js`** |
| 6 | `src/routes/templateStudio.js`, `uiOverlayRoutes.js` (6 each) |
| 5 | `src/routes/todoListRoutes.js` |
| 3 | `src/routes/arcRoutes.js`, `opportunityRoutes.js`, `shows.js`, `wardrobe.js` (3 each) |
| 2 | `src/routes/evaluation.js`, `eventGeneratorRoute.js` (2 each) |
| 1 | `src/routes/calendarRoutes.js` |
| **109** | **12 files; `worldEvents.js` 24, the other 11 files 85** |

UPDATE 59 and INSERT 50 in all; in `worldEvents.js`, UPDATE 9 and INSERT 15. Both re-located instances are in the output: `worldEvents.js:3210 UPDATE world_events.outfit_pieces` and `worldEvents.js:1983 UPDATE assets.metadata`.

**Reach: not established.** The probe bounds the population where the class could live: 11 other files. It finds no second copied-snapshot instance, because it cannot see one.

### §2.5 Class 6 — model-acquisition idioms

**Probe.** Per file, it counts `getModels()`, `req.app.get('models')` (with or without optional chaining) and `require('../models')` (any depth, with or without `/index`).

**What it misses:**
- An idiom used inside another's definition counts as both: `getModels` wrapping `require('../models')`, or `req.app.get('models') || require('../models')`. So "2+ idioms" overstates drift where the second idiom is only the first one's fallback.
- A models object passed in as a parameter is not counted.

```
--- files=114 of 142; files using 2+ idioms=30
```

Files by idioms used:
- 84 use one: `require` only 83, `req.app.get` only 1;
- 28 use two;
- 2 use all three: `characterRegistry.js` (`getModels` 37, `req.app.get` 2, `require` 5) and **`worldEvents.js`** (`getModels` 38, `req.app.get` 23, `require` 25).

Each idiom, by the number of files using it: `require` 113, `req.app.get` 17, `getModels` 16. The 30 files are listed in Appendix B.4.

**Reach: established.** Mixed acquisition is in 29 other files. It stays an observation, per v1.62 §65.3.

---

## §3. Class 4 in depth: the balance readers

v1.62 flagged class 4 the priority. The table below takes every balance read §2.3 found, plus the service function most of them call.

### §3.1 The three stores, and what each reader falls back to — MEASURED

`getCurrentBalance` (`src/services/financialTransactionService.js:59`) resolves a balance in three tiers:
1. The sum of `executed` `income`/`reward` minus `expense`/`deduction` rows in `financial_transactions` (`deleted_at IS NULL`).
2. If the ledger has no rows: `getStartingBalance`, which is `shows.metadata.starting_balance` or `DEFAULT_STARTING_BALANCE`, 1900 (`src/utils/financialRates.js:20`).
3. If the ledger query throws: `character_state_history.state_after_json.coins`, read `WHERE ... AND deleted_at IS NULL`, and failing that the starting balance.

| # | Reader | Handler | Store read (table.column) | When absent |
|---|---|---|---|---|
| L1 | `worldEvents.js:2951` | `GET .../financial-forecast` | ledger, via `getCurrentBalance` | tiers 2–3 |
| L2 | `worldEvents.js:4182` | `GET /world/:showId/balance` | ledger, via `getCurrentBalance` | tiers 2–3 |
| L3 | `shows.js:417` | `GET /:id/financial-config` | ledger, via `getCurrentBalance` | tiers 2–3 |
| L4 | `shows.js:576` | `GET /:id/financial-summary` | ledger, via `getCurrentBalance` | tiers 2–3 |
| L5 | `shows.js:1042` | `GET /:id/financial-suggestions` | ledger, via `getCurrentBalance` | tiers 2–3 |
| L6 | `evaluation.js:638` | `POST /characters/:key/state/update` | ledger (`ledgerBefore`, to size the mirror row) | tiers 2–3 |
| L7 | `wardrobe.js:1423`, `1594`, `1731` | `POST /select`, `POST /lock-outfit-atomic`, `POST /purchase` | ledger (`ledgerBefore`) | tiers 2–3 |
| C1 | `wardrobe.js:1402`, `1565`, `1701` | the same three wardrobe handlers | `character_state.coins` (`'lala'`), the spend check | `0` |
| C2 | `worldEvents.js:4281` | `GET .../events/next-suggestions` | `character_state.coins` (`'lala'`) | `500` |
| C3 | `worldEvents.js:1172` | `POST .../generate-script` | `character_state.coins` (`'lala'`), prompt context | `{}` (no coins); swallowing catch |
| C4 | `episodes.js:963` | `POST /:id/generate-beats` | `character_state.coins` (`'lala'`), prompt context | not set |
| C5 | `careerGoals.js:381`, `508`, `578` | goal create, goal sync, `suggest-events` | `character_state[target_metric]` (coins when the goal's metric is coins); `578` reads `.coins` for `coins_min` | no auto value / `synced: 0` / no state |
| C6 | `evaluation.js:48` | `getOrCreateCharacterState` | `character_state` row (coins among its stats) | row created |
| H1 | `worldEvents.js:2676` | `GET .../events/:eventId/affordability` | `character_state_history.state_json.coins` | `500`; swallowing catch |
| H2 | `worldEvents.js:2728` | `GET /world/:showId/financial-pressure` | `character_state_history.state_json.coins` | `500`; swallowing catch |

Not balance readers, though the probe matched them: `shows.js:494/932/943` (lifetime totals and category breakdowns over the ledger) and `evaluation.js:654` (an `INSERT` column list).

**The history snapshot has no `state_json` column.** The migration that creates `character_state_history` declares `state_after_json`, and no migration or model names `state_json`:

```
$ git grep -n "state_json\|state_after_json\|state_before_json" 073e57f8 -- src/migrations src/models
073e57f8:src/migrations/20260218100000-evaluation-system.js:130:      state_after_json: {
```

**ATTESTED, from a filed document:** the canon capture lists `character_state_history`'s eleven columns, among them `state_after_json` and neither `state_json` nor `deleted_at`:

```
$ grep -E "^ character_state_history +\|" docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt | awk -F'|' '{print $2}' | tr -s ' ' | tr '\n' ','
 character_key , created_at , deltas_json , episode_id , evaluation_id , id , notes , season_id , show_id , source , state_after_json ,
```

### §3.2 Can two readers disagree for the same show?

**H1/H2 against every ledger reader: yes.**
- **INFERRED.** In a database shaped like the capture, H1's and H2's `SELECT state_json ...` names a column that does not exist. Postgres rejects it (`42703`, undefined column), the bare catch takes it, and both handlers use 500 for every show.
- The ledger readers (L1–L5) answer the ledger sum, or the starting balance (1900 unless the show sets its own) when the ledger is empty.
- For any show whose ledger balance is not exactly 500, `GET /events/:eventId/affordability` checks the event against 500 while `GET /balance` computes its own `affordability` against the ledger. **The two can give opposite answers for the same event.**
- **MEASURED:** both handlers call the same `checkAffordability` (`worldEvents.js:2684`, `4191`) on different balances.

**H1/H2 is not the only fallback on a missing column.** `getCurrentBalance`'s tier 3 filters `character_state_history` on `deleted_at`, which the capture does not list either. INFERRED: tier 3 would also throw, and fall to the starting balance. It is reached only when the ledger query itself fails.

**C-readers against L-readers: yes, depending on data.**
- **MEASURED:** the two stores are written separately. `character_state.coins` changes through `coinBalanceGuard.changeCoins`/`spendCoins` and the evaluation admin update. The ledger changes through `logTransaction`.
- **MEASURED:** the wardrobe and evaluation handlers write both inside one transaction, and their comments say so (`wardrobe.js:1410–1415`, `evaluation.js:616–624`). Those comments name the earlier drift they fixed: "left `character_state.coins` out of sync with `getCurrentBalance`".
- **INFERRED:** the two can still differ for a show when:
  - its ledger is empty, so L-readers answer the starting balance while `character_state.coins` holds whatever the row was created with;
  - coins were written before the dual writes existed;
  - a writer outside these handlers changes one store only. `episodeCompletionService` calls `changeCoins`; whether it also writes the ledger is not read here.
- The wardrobe handlers read both stores at once (C1 for the spend check, L7 for the mirror row), so a disagreement there is sized by the ledger and gated by `character_state`.

**C-readers against each other:**
- **MEASURED:** when a show has no `character_state` row, the defaults differ: `wardrobe.js` uses 0, `next-suggestions` uses 500, and `generate-script`/`generate-beats` pass no coins at all.
- **INFERRED:** when the row exists, they read the same column and agree.

**L-readers against each other: no.** **MEASURED:** L1–L7 all call the same `getCurrentBalance`, so for one show at one moment they return one value.

**None is authoritative, in the code's own terms.**
- The evaluation comment calls `character_state.coins` and the ledger "the two sources of truth".
- **MEASURED:** no reader in the population reconciles them. `evaluation.js:639` computes `adjustment = newState.coins - ledgerBefore` and writes the difference to the ledger, so the ledger is adjusted to match `character_state`, and only in that handler.

---

## §4. Per-class summary

| Class | Re-located in `worldEvents.js` | Probe sites: `worldEvents.js` | Probe sites: other route files | Reach beyond `worldEvents.js` |
|---|---|---|---|---|
| 2 — soft-delete filter by hand | all v1.33 instances; v1.41's 1109/1307; v1.41's five unlisted splits not individually | 61 | 173 in 23 files | **established** (shape) |
| 3 — swallowing catch, fabricated result | all v1.33 and v1.41 instances; counter-example present | 62 | 198 in 48 files | **the population is established; the fabricated subset needs a read** |
| 4 — parallel balance readers | all three v1.33 mechanisms, plus L1 and C2, C3 | 8 hits, 3 stores | 19 hits in 5 files | **established**; H1/H2 disagree with the ledger for any show not at 500 (INFERRED) |
| 5 — JSON snapshot, no refresh | `outfit_pieces` (3210); v1.41's 1580 (1983) | 24 candidates | 85 candidates in 11 files | **not established**; the grep cannot tell a copied snapshot from a written value |
| 6 — idiom drift | all three idioms | 3 idioms | 29 other files use 2+ | **established**; stays an observation |

---

## §5. What this document does not do

- **Rules nothing.** It does not change any class's homing, priority or standing from v1.62 §65.3.
- **Closes nothing.** §65.3-P is discharged only if a Fix Plan revision says so.
- **Mints nothing.** No FD, PE or XK number, no class or finding.
- **Does not read any probe site as a defect** beyond the class definitions quoted in §0. The probe outputs are sites matching a shape.
- **Changes no code.** It does not touch `src/`, `frontend/`, `tests/` or any workflow file.
- **Makes no live database contact**, and no host, AWS, database or Cognito contact of any kind. The canon capture is a filed document, read from the repository.
- **Does not edit any filed document** in `docs/audit/`, or add a banner to one.
- **Does not read services** beyond `financialTransactionService` and `coinBalanceGuard` for class 4. Other services are outside the population, and their balance reads are not counted.

---

## Appendix A — `s355probe.js`

Run from the repository root with `acorn` resolvable (`NODE_PATH=$PWD/node_modules node s355probe.js 073e57f8 <class>`). Reproduced exactly as run:

```js
// §35.5 classes 2, 3, 5, 6 reach probe. Usage: node s355probe.js <basis> <class>
// Reads every .js file under src/routes/ at <basis> with `git show`; parses
// each with acorn; prints one line per site, then per-file totals.
'use strict';
const { execSync } = require('child_process');
const acorn = require('acorn');

const [basis, cls] = process.argv.slice(2);
const git = (a) => execSync(`git ${a}`, { encoding: 'utf8', maxBuffer: 1 << 28 });
const files = git(`ls-tree -r --name-only ${basis} src/routes`).split('\n').filter(f => f.endsWith('.js')).sort();

// Canon schema, from the filed capture: table -> Map(column -> data_type)
const canon = new Map();
for (const line of git(`show ${basis}:docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`).split('\n')) {
  const p = line.split('|').map(s => s.trim());
  if (p.length < 4 || !/^[a-z_][a-z0-9_]*$/i.test(p[0]) || p[0] === 'table_name') continue;
  if (!canon.has(p[0])) canon.set(p[0], new Map());
  canon.get(p[0]).set(p[1], p[2]);
}
const softDelete = (t) => canon.has(t) && canon.get(t).has('deleted_at');
const isJson = (t, c) => canon.has(t) && /^jsonb?$/.test(canon.get(t).get(c) || '');

function walk(node, fn, parent) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(n => walk(n, fn, node));
    else if (v && typeof v.type === 'string') walk(v, fn, node);
  }
}
const lineOf = (src, pos) => src.slice(0, pos).split('\n').length;
const litText = (n) => n.type === 'Literal' && typeof n.value === 'string' ? n.value
  : n.type === 'TemplateLiteral' ? n.quasis.map(q => q.value.cooked ?? q.value.raw).join('${}') : null;

const SURFACES = /console\.(error|warn|log|info)|\bthrow\b|res\.(status|json|send|sendStatus)|\bnext\(|\breject\(|logger\./;
const IDIOMS = {
  getModels: /\bgetModels\(\)/g,
  appGet: /req\.app(\?\.|\.)get(\?\.)?\(\s*['"]models['"]\s*\)/g,
  require: /require\(\s*['"](\.\.\/)+models(\/index(\.js)?)?['"]\s*\)/g,
};

const perFile = [];
for (const f of files) {
  const src = git(`show ${basis}:${f}`);
  const sites = [];
  if (cls === '6') {
    const counts = {};
    for (const [k, re] of Object.entries(IDIOMS)) counts[k] = (src.match(re) || []).length;
    const used = Object.keys(counts).filter(k => counts[k] > 0);
    if (used.length) perFile.push({ f, n: used.length, detail: used.map(k => `${k}=${counts[k]}`).join(' ') });
    continue;
  }
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true }); }
  catch (e) { console.log(`PARSE-FAIL ${f}: ${e.message}`); continue; }
  walk(ast, (n) => {
    if (cls === '2' || cls === '5') {
      const t = litText(n);
      if (!t) return;
      if (cls === '2' && /\b(SELECT|UPDATE)\b/.test(t)) {
        const re = /\b(DELETE\s+FROM|FROM|JOIN|UPDATE)\s+"?([a-z_][a-z0-9_]*)"?/g;
        let m;
        const seen = new Set();
        while ((m = re.exec(t))) {
          if (/^DELETE/.test(m[1]) || seen.has(m[2])) continue;
          seen.add(m[2]);
          if (softDelete(m[2]) && !/deleted_at/i.test(t)) sites.push(`${f}:${lineOf(src, n.start)} ${m[2]}`);
        }
      }
      if (cls === '5') {
        let m;
        const up = /\bUPDATE\s+"?([a-z_][a-z0-9_]*)"?\s+SET\s+([\s\S]*?)(\bWHERE\b|$)/g;
        while ((m = up.exec(t))) {
          const table = m[1];
          for (const a of m[2].matchAll(/"?([a-z_][a-z0-9_]*)"?\s*=/g)) {
            if (isJson(table, a[1])) sites.push(`${f}:${lineOf(src, n.start)} UPDATE ${table}.${a[1]}`);
          }
        }
        const ins = /\bINSERT\s+INTO\s+"?([a-z_][a-z0-9_]*)"?\s*\(([^)]*)\)/g;
        while ((m = ins.exec(t))) {
          for (const c of m[2].split(',').map(s => s.trim().replace(/"/g, ''))) {
            if (isJson(m[1], c)) sites.push(`${f}:${lineOf(src, n.start)} INSERT ${m[1]}.${c}`);
          }
        }
      }
    }
    if (cls === '3') {
      let body = null;
      if (n.type === 'CatchClause') body = n.body;
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed &&
          n.callee.property.name === 'catch' && n.arguments[0] && /Function/.test(n.arguments[0].type)) body = n.arguments[0].body;
      if (!body) return;
      const text = src.slice(body.start, body.end);
      if (SURFACES.test(text)) return;
      const inner = body.type === 'BlockStatement' ? body.body : null;
      const kind = inner === null ? 'arrow-value'
        : inner.length === 0 ? 'empty-or-comment'
        : inner.some(s => s.type === 'ReturnStatement') ? 'returns'
        : 'other';
      sites.push(`${f}:${lineOf(src, n.start)} ${kind}`);
    }
  });
  sites.forEach(s => console.log(s));
  if (sites.length) perFile.push({ f, n: sites.length });
}
console.log('--- per file');
perFile.sort((a, b) => b.n - a.n || a.f.localeCompare(b.f)).forEach(p => console.log(`${String(p.n).padStart(4)} ${p.f}${p.detail ? '  ' + p.detail : ''}`));
const total = perFile.reduce((s, p) => s + p.n, 0);
console.log(`--- files=${perFile.length} of ${files.length}; ${cls === '6' ? 'files using 2+ idioms=' + perFile.filter(p => p.n >= 2).length : 'sites=' + total}`);
```

## Appendix B — full probe output, sorted

Each site is `file:line` (the line where the literal, catch or call starts) plus a tag. Sorted by file, then line.

### B.1 Class 2 — sites (file:line table)

<details><summary>234 lines</summary>

```
src/routes/arcRoutes.js:158 show_arcs
src/routes/arcRoutes.js:208 show_arcs
src/routes/calendarRoutes.js:626 world_events
src/routes/careerGoals.js:593 world_events
src/routes/characterRegistry.js:1506 world_characters
src/routes/episodeOrchestrationRoute.js:154 world_events
src/routes/episodeOrchestrationRoute.js:218 episodes
src/routes/episodes.js:954 world_events
src/routes/evaluation.js:284 world_events
src/routes/eventGeneratorRoute.js:43 world_events
src/routes/export.js:61 episodes
src/routes/export.js:73 scenes
src/routes/franchiseBrainRoutes.js:119 franchise_knowledge
src/routes/franchiseBrainRoutes.js:187 franchise_knowledge
src/routes/memories/assistant.js:1029 franchise_knowledge
src/routes/memories/assistant.js:1205 franchise_knowledge
src/routes/memories/assistant.js:1226 franchise_knowledge
src/routes/memories/assistant.js:1315 character_relationships
src/routes/memories/assistant.js:1315 registry_characters
src/routes/memories/assistant.js:1325 character_relationships
src/routes/memories/assistant.js:1325 registry_characters
src/routes/memories/assistant.js:1370 character_relationships
src/routes/memories/assistant.js:1399 social_profiles
src/routes/memories/assistant.js:1430 social_profiles
src/routes/memories/assistant.js:1468 social_profiles
src/routes/memories/extras.js:179 world_characters
src/routes/memories/extras.js:321 world_characters
src/routes/relationships.js:86 character_relationships
src/routes/relationships.js:108 character_relationships
src/routes/relationships.js:132 character_relationships
src/routes/relationships.js:175 character_relationships
src/routes/relationships.js:243 registry_characters
src/routes/relationships.js:247 registry_characters
src/routes/relationships.js:263 character_relationships
src/routes/relationships.js:312 character_relationships
src/routes/relationships.js:356 character_relationships
src/routes/relationships.js:509 character_relationships
src/routes/relationships.js:538 character_relationships
src/routes/relationships.js:538 registry_characters
src/routes/relationships.js:558 character_relationships
src/routes/relationships.js:565 character_relationships
src/routes/relationships.js:589 character_relationships
src/routes/relationships.js:625 character_relationships
src/routes/relationships.js:657 character_relationships
src/routes/relationships.js:717 character_relationships
src/routes/relationships.js:728 character_relationships
src/routes/relationships.js:761 character_relationships
src/routes/relationships.js:781 character_relationships
src/routes/relationships.js:824 character_relationships
src/routes/relationships.js:945 character_relationships
src/routes/scenes.js:59 scenes
src/routes/scenes.js:63 scenes
src/routes/scenes.js:93 scenes
src/routes/scriptAnalysis.js:42 episode_scripts
src/routes/scriptAnalysis.js:98 episode_scripts
src/routes/scriptAnalysis.js:159 episode_scripts
src/routes/scriptAnalysis.js:171 episode_scripts
src/routes/shows.js:268 shows
src/routes/shows.js:833 assets
src/routes/storyEvaluationRoutes.js:515 character_relationships
src/routes/storyEvaluationRoutes.js:515 registry_characters
src/routes/storyEvaluationRoutes.js:515 relationship_events
src/routes/storyHealth.js:45 storyteller_stories
src/routes/storyHealth.js:57 storyteller_stories
src/routes/storyHealth.js:69 storyteller_stories
src/routes/storyHealth.js:80 storyteller_stories
src/routes/storyHealth.js:95 story_threads
src/routes/storyHealth.js:108 storyteller_stories
src/routes/storyHealth.js:119 storyteller_stories
src/routes/storyHealth.js:161 registry_characters
src/routes/storyHealth.js:172 storyteller_stories
src/routes/storyHealth.js:183 world_locations
src/routes/storyHealth.js:194 story_threads
src/routes/storyHealth.js:216 storyteller_books
src/routes/storyHealth.js:344 registry_characters
src/routes/storyHealth.js:355 storyteller_stories
src/routes/storyHealth.js:365 story_threads
src/routes/storyHealth.js:481 story_threads
src/routes/storyHealth.js:513 registry_characters
src/routes/storyHealth.js:513 storyteller_stories
src/routes/storyHealth.js:569 storyteller_stories
src/routes/tierFeatures.js:75 character_relationships
src/routes/tierFeatures.js:75 registry_characters
src/routes/tierFeatures.js:75 relationship_events
src/routes/tierFeatures.js:276 character_relationships
src/routes/tierFeatures.js:276 registry_characters
src/routes/tierFeatures.js:276 relationship_events
src/routes/todoListRoutes.js:103 episode_todo_lists
src/routes/todoListRoutes.js:108 episode_todo_lists
src/routes/todoListRoutes.js:170 world_events
src/routes/todoListRoutes.js:194 episode_todo_lists
src/routes/todoListRoutes.js:215 assets
src/routes/todoListRoutes.js:308 episode_todo_lists
src/routes/wardrobe.js:2285 wardrobe
src/routes/world.js:42 episodes
src/routes/world.js:109 episodes
src/routes/world.js:133 episodes
src/routes/world.js:183 wardrobe
src/routes/world.js:190 wardrobe
src/routes/worldEvents.js:569 world_events
src/routes/worldEvents.js:612 world_events
src/routes/worldEvents.js:801 world_events
src/routes/worldEvents.js:816 world_events
src/routes/worldEvents.js:843 world_events
src/routes/worldEvents.js:876 world_events
src/routes/worldEvents.js:884 world_events
src/routes/worldEvents.js:901 world_events
src/routes/worldEvents.js:914 world_events
src/routes/worldEvents.js:983 world_events
src/routes/worldEvents.js:1042 world_events
src/routes/worldEvents.js:1047 world_events
src/routes/worldEvents.js:1092 world_events
src/routes/worldEvents.js:1150 world_events
src/routes/worldEvents.js:1483 world_events
src/routes/worldEvents.js:1505 world_events
src/routes/worldEvents.js:1512 assets
src/routes/worldEvents.js:1552 world_events
src/routes/worldEvents.js:1609 world_events
src/routes/worldEvents.js:1617 assets
src/routes/worldEvents.js:1624 assets
src/routes/worldEvents.js:1632 world_events
src/routes/worldEvents.js:1748 world_events
src/routes/worldEvents.js:1826 world_events
src/routes/worldEvents.js:1929 world_events
src/routes/worldEvents.js:1983 assets
src/routes/worldEvents.js:2016 assets
src/routes/worldEvents.js:2067 world_events
src/routes/worldEvents.js:2072 world_events
src/routes/worldEvents.js:2104 world_events
src/routes/worldEvents.js:2202 world_events
src/routes/worldEvents.js:2244 world_events
src/routes/worldEvents.js:2312 world_events
src/routes/worldEvents.js:2325 world_events
src/routes/worldEvents.js:2331 world_events
src/routes/worldEvents.js:2667 world_events
src/routes/worldEvents.js:2700 world_events
src/routes/worldEvents.js:2803 world_events
src/routes/worldEvents.js:2812 world_events
src/routes/worldEvents.js:3015 world_events
src/routes/worldEvents.js:3083 world_events
src/routes/worldEvents.js:3127 world_events
src/routes/worldEvents.js:3155 world_events
src/routes/worldEvents.js:3210 world_events
src/routes/worldEvents.js:3229 world_events
src/routes/worldEvents.js:3292 world_events
src/routes/worldEvents.js:3332 world_events
src/routes/worldEvents.js:3388 social_profiles
src/routes/worldEvents.js:3498 world_events
src/routes/worldEvents.js:3515 assets
src/routes/worldEvents.js:3521 assets
src/routes/worldEvents.js:3542 world_events
src/routes/worldEvents.js:3551 episode_todo_lists
src/routes/worldEvents.js:3556 episode_todo_lists
src/routes/worldEvents.js:3615 world_events
src/routes/worldEvents.js:3706 world_events
src/routes/worldEvents.js:3857 world_events
src/routes/worldEvents.js:3906 world_events
src/routes/worldEvents.js:3991 stories
src/routes/worldEvents.js:4052 episodes
src/routes/worldEvents.js:4188 world_events
src/routes/worldStudio.js:370 character_registries
src/routes/worldStudio.js:614 world_characters
src/routes/worldStudio.js:665 character_relationships
src/routes/worldStudio.js:756 character_relationships
src/routes/worldStudio.js:844 registry_characters
src/routes/worldStudio.js:860 registry_characters
src/routes/worldStudio.js:912 world_characters
src/routes/worldStudio.js:1081 registry_characters
src/routes/worldStudio.js:1081 world_characters
src/routes/worldStudio.js:1097 world_characters
src/routes/worldStudio.js:1104 registry_characters
src/routes/worldStudio.js:1113 intimate_scenes
src/routes/worldStudio.js:1147 world_characters
src/routes/worldStudio.js:1148 world_characters
src/routes/worldStudio.js:1154 registry_characters
src/routes/worldStudio.js:1160 registry_characters
src/routes/worldStudio.js:1284 world_characters
src/routes/worldStudio.js:1287 registry_characters
src/routes/worldStudio.js:1297 world_characters
src/routes/worldStudio.js:1300 registry_characters
src/routes/worldStudio.js:1313 world_characters
src/routes/worldStudio.js:1411 world_characters
src/routes/worldStudio.js:1417 world_characters
src/routes/worldStudio.js:1421 registry_characters
src/routes/worldStudio.js:1428 registry_characters
src/routes/worldStudio.js:1554 world_characters
src/routes/worldStudio.js:1558 registry_characters
src/routes/worldStudio.js:1567 registry_characters
src/routes/worldStudio.js:1677 registry_characters
src/routes/worldStudio.js:1696 registry_characters
src/routes/worldStudio.js:1696 world_characters
src/routes/worldStudio.js:1712 registry_characters
src/routes/worldStudio.js:1848 registry_characters
src/routes/worldStudio.js:1881 world_characters
src/routes/worldStudio.js:1917 world_character_batches
src/routes/worldStudio.js:1955 intimate_scenes
src/routes/worldStudio.js:1955 world_characters
src/routes/worldStudio.js:1991 world_characters
src/routes/worldStudio.js:1993 world_characters
src/routes/worldStudio.js:1999 intimate_scenes
src/routes/worldStudio.js:2133 intimate_scenes
src/routes/worldStudio.js:2154 intimate_scenes
src/routes/worldStudio.js:2167 intimate_scenes
src/routes/worldStudio.js:2170 world_characters
src/routes/worldStudio.js:2172 world_characters
src/routes/worldStudio.js:2175 scene_continuations
src/routes/worldStudio.js:2189 intimate_scenes
src/routes/worldStudio.js:2198 storyteller_chapters
src/routes/worldStudio.js:2230 character_relationships
src/routes/worldStudio.js:2235 world_characters
src/routes/worldStudio.js:2251 continuity_beats
src/routes/worldStudio.js:2251 continuity_timelines
src/routes/worldStudio.js:2299 intimate_scenes
src/routes/worldStudio.js:2346 intimate_scenes
src/routes/worldStudio.js:2355 intimate_scenes
src/routes/worldStudio.js:2382 scene_continuations
src/routes/worldStudio.js:2395 scene_continuations
src/routes/worldStudio.js:2400 storyteller_lines
src/routes/worldStudio.js:2411 scene_continuations
src/routes/worldStudio.js:2521 world_characters
src/routes/worldStudio.js:2835 world_characters
src/routes/worldStudio.js:2876 character_relationships
src/routes/worldStudio.js:2913 world_characters
src/routes/worldStudio.js:2976 world_characters
src/routes/worldStudio.js:3002 world_characters
src/routes/worldStudio.js:3064 world_characters
src/routes/worldStudio.js:3076 world_characters
src/routes/worldStudio.js:3108 world_characters
src/routes/worldStudio.js:3121 world_characters
src/routes/worldStudio.js:3137 world_characters
src/routes/worldStudio.js:3155 world_locations
src/routes/worldStudio.js:3490 world_characters
src/routes/worldStudio.js:3525 world_characters
src/routes/worldStudio.js:3600 world_characters
--- per file
  74 src/routes/worldStudio.js
  61 src/routes/worldEvents.js
  23 src/routes/relationships.js
  19 src/routes/storyHealth.js
  11 src/routes/memories/assistant.js
   6 src/routes/tierFeatures.js
   6 src/routes/todoListRoutes.js
   5 src/routes/world.js
   4 src/routes/scriptAnalysis.js
   3 src/routes/scenes.js
   3 src/routes/storyEvaluationRoutes.js
   2 src/routes/arcRoutes.js
   2 src/routes/episodeOrchestrationRoute.js
   2 src/routes/export.js
   2 src/routes/franchiseBrainRoutes.js
   2 src/routes/memories/extras.js
   2 src/routes/shows.js
   1 src/routes/calendarRoutes.js
   1 src/routes/careerGoals.js
   1 src/routes/characterRegistry.js
   1 src/routes/episodes.js
   1 src/routes/evaluation.js
   1 src/routes/eventGeneratorRoute.js
   1 src/routes/wardrobe.js
--- files=24 of 142; sites=234
```

</details>

### B.2 Class 3 — sites (file:line kind)

<details><summary>260 lines</summary>

```
src/routes/admin.js:14 returns
src/routes/amberDiagnosticRoutes.js:218 other
src/routes/amberDiagnosticRoutes.js:339 returns
src/routes/amberDiagnosticRoutes.js:372 returns
src/routes/amberSessionRoutes.js:170 empty-or-comment
src/routes/amberSessionRoutes.js:181 empty-or-comment
src/routes/amberSessionRoutes.js:189 empty-or-comment
src/routes/assets.js:886 empty-or-comment
src/routes/careerGoals.js:90 empty-or-comment
src/routes/careerGoals.js:387 empty-or-comment
src/routes/careerGoals.js:589 empty-or-comment
src/routes/characterAI.js:95 empty-or-comment
src/routes/characterAI.js:109 empty-or-comment
src/routes/characterAI.js:150 empty-or-comment
src/routes/characterAI.js:162 empty-or-comment
src/routes/characterAI.js:176 empty-or-comment
src/routes/characterAI.js:186 empty-or-comment
src/routes/characterAI.js:331 returns
src/routes/characterAI.js:633 other
src/routes/characterAI.js:721 other
src/routes/characterAI.js:801 other
src/routes/characterFollowRoutes.js:127 other
src/routes/characterRegistry.js:20 empty-or-comment
src/routes/characterRegistry.js:1204 empty-or-comment
src/routes/characterRegistry.js:1527 empty-or-comment
src/routes/characterRegistry.js:2220 other
src/routes/characterRegistry.js:2348 other
src/routes/consciousness.js:584 other
src/routes/continuityEngine.js:25 other
src/routes/episodeBriefRoutes.js:274 returns
src/routes/episodeScriptWriterRoutes.js:157 empty-or-comment
src/routes/episodes.js:938 other
src/routes/episodes.js:958 empty-or-comment
src/routes/episodes.js:975 empty-or-comment
src/routes/evaluation.js:40 returns
src/routes/evaluation.js:48 arrow-value
src/routes/evaluation.js:294 other
src/routes/evaluation.js:300 empty-or-comment
src/routes/evaluation.js:371 empty-or-comment
src/routes/eventGeneratorRoute.js:173 empty-or-comment
src/routes/eventGeneratorRoute.js:189 empty-or-comment
src/routes/feedSchedulerRoutes.js:184 other
src/routes/generate-script-from-book.js:41 returns
src/routes/generate-script-from-book.js:89 returns
src/routes/memories/assistant.js:17 other
src/routes/memories/assistant.js:22 other
src/routes/memories/assistant.js:490 empty-or-comment
src/routes/memories/assistant.js:963 empty-or-comment
src/routes/memories/assistant.js:1146 returns
src/routes/memories/assistant.js:1277 returns
src/routes/memories/assistant.js:1453 empty-or-comment
src/routes/memories/assistant.js:1549 other
src/routes/memories/core.js:15 other
src/routes/memories/engine.js:17 other
src/routes/memories/engine.js:22 other
src/routes/memories/engine.js:27 other
src/routes/memories/engine.js:88 empty-or-comment
src/routes/memories/engine.js:131 other
src/routes/memories/engine.js:246 other
src/routes/memories/engine.js:1446 other
src/routes/memories/engine.js:2147 returns
src/routes/memories/engine.js:3119 arrow-value
src/routes/memories/engine.js:3251 empty-or-comment
src/routes/memories/engine.js:3336 arrow-value
src/routes/memories/engine.js:3944 empty-or-comment
src/routes/memories/engine.js:4251 other
src/routes/memories/engine.js:4304 returns
src/routes/memories/engine.js:4423 arrow-value
src/routes/memories/engine.js:4603 other
src/routes/memories/engine.js:4659 arrow-value
src/routes/memories/engine.js:4664 arrow-value
src/routes/memories/engine.js:4680 empty-or-comment
src/routes/memories/engine.js:4720 other
src/routes/memories/engine.js:4816 other
src/routes/memories/engine.js:4979 other
src/routes/memories/interview.js:275 empty-or-comment
src/routes/memories/interview.js:766 empty-or-comment
src/routes/memories/interview.js:996 other
src/routes/memories/interview.js:1133 empty-or-comment
src/routes/memories/stories.js:17 other
src/routes/memories/stories.js:928 other
src/routes/memories/stories.js:999 other
src/routes/memories/stories.js:1093 other
src/routes/memories/voice.js:208 empty-or-comment
src/routes/novelIntelligenceRoutes.js:81 other
src/routes/onboarding.js:149 other
src/routes/onboarding.js:214 other
src/routes/onboarding.js:409 arrow-value
src/routes/onboarding.js:417 arrow-value
src/routes/onboarding.js:421 arrow-value
src/routes/onboarding.js:516 arrow-value
src/routes/phoneAIRoutes.js:203 empty-or-comment
src/routes/phonePlaythroughRoutes.js:71 empty-or-comment
src/routes/press.js:44 other
src/routes/sceneProposeRoute.js:116 arrow-value
src/routes/sceneProposeRoute.js:119 arrow-value
src/routes/sceneProposeRoute.js:122 arrow-value
src/routes/sceneProposeRoute.js:126 arrow-value
src/routes/sceneProposeRoute.js:198 other
src/routes/sceneProposeRoute.js:233 empty-or-comment
src/routes/sceneSetRoutes.js:501 empty-or-comment
src/routes/sceneSetRoutes.js:1605 empty-or-comment
src/routes/sceneSetRoutes.js:1709 other
src/routes/sceneStudioEpisodeRoutes.js:214 empty-or-comment
src/routes/scriptParse.js:116 empty-or-comment
src/routes/scriptParse.js:206 empty-or-comment
src/routes/session.js:51 empty-or-comment
src/routes/session.js:63 empty-or-comment
src/routes/shows.js:701 empty-or-comment
src/routes/shows.js:1001 empty-or-comment
src/routes/shows.js:1108 empty-or-comment
src/routes/shows.js:1135 empty-or-comment
src/routes/shows.js:1169 empty-or-comment
src/routes/shows.js:1209 empty-or-comment
src/routes/socialProfileBulkRoutes.js:56 returns
src/routes/socialProfileBulkRoutes.js:726 other
src/routes/socialProfileBulkRoutes.js:819 returns
src/routes/socialProfileBulkRoutes.js:880 empty-or-comment
src/routes/socialProfileRoutes.js:498 arrow-value
src/routes/socialProfileRoutes.js:510 arrow-value
src/routes/socialProfileRoutes.js:520 arrow-value
src/routes/socialProfileRoutes.js:1730 empty-or-comment
src/routes/socialProfileRoutes.js:1795 empty-or-comment
src/routes/socialProfileRoutes.js:1842 empty-or-comment
src/routes/socialProfileRoutes.js:2149 empty-or-comment
src/routes/socialProfileRoutes.js:2203 empty-or-comment
src/routes/socialProfileRoutes.js:2297 empty-or-comment
src/routes/socialProfileRoutes.js:2752 empty-or-comment
src/routes/socialProfileRoutes.js:2799 empty-or-comment
src/routes/socialProfileRoutes.js:2858 empty-or-comment
src/routes/storyEvaluationRoutes.js:530 empty-or-comment
src/routes/storyEvaluationRoutes.js:544 empty-or-comment
src/routes/storyEvaluationRoutes.js:1061 empty-or-comment
src/routes/storyEvaluationRoutes.js:1357 empty-or-comment
src/routes/storyEvaluationRoutes.js:1369 empty-or-comment
src/routes/storyHealth.js:31 returns
src/routes/storyHealth.js:103 empty-or-comment
src/routes/storyHealth.js:116 empty-or-comment
src/routes/storyHealth.js:168 empty-or-comment
src/routes/storyHealth.js:179 empty-or-comment
src/routes/storyHealth.js:190 empty-or-comment
src/routes/storyHealth.js:201 empty-or-comment
src/routes/storyHealth.js:212 empty-or-comment
src/routes/storyHealth.js:223 empty-or-comment
src/routes/storyHealth.js:352 empty-or-comment
src/routes/storyHealth.js:372 empty-or-comment
src/routes/storyHealth.js:384 empty-or-comment
src/routes/storyHealth.js:489 empty-or-comment
src/routes/storyHealth.js:530 empty-or-comment
src/routes/storyHealth.js:547 empty-or-comment
src/routes/storyHealth.js:565 empty-or-comment
src/routes/storyHealth.js:586 empty-or-comment
src/routes/storyteller.js:34 other
src/routes/storyteller.js:39 other
src/routes/storyteller.js:44 other
src/routes/storyteller.js:495 other
src/routes/storyteller.js:577 returns
src/routes/storyteller.js:634 returns
src/routes/storyteller.js:706 returns
src/routes/storyteller.js:1279 empty-or-comment
src/routes/storyteller.js:1293 empty-or-comment
src/routes/therapy.js:26 other
src/routes/therapy.js:31 other
src/routes/therapy.js:36 other
src/routes/tierFeatures.js:74 arrow-value
src/routes/tierFeatures.js:88 arrow-value
src/routes/tierFeatures.js:275 arrow-value
src/routes/tierFeatures.js:972 empty-or-comment
src/routes/uiOverlayRoutes.js:58 empty-or-comment
src/routes/uiOverlayRoutes.js:707 empty-or-comment
src/routes/uiOverlayRoutes.js:742 empty-or-comment
src/routes/uiOverlayRoutes.js:809 empty-or-comment
src/routes/upgradeRoutes.js:236 other
src/routes/wardrobe.js:172 returns
src/routes/wardrobe.js:1050 returns
src/routes/wardrobe.js:1495 empty-or-comment
src/routes/wardrobe.js:1820 returns
src/routes/wardrobe.js:2233 returns
src/routes/wardrobe.js:2242 returns
src/routes/wardrobeBrands.js:38 other
src/routes/wardrobeEventRoutes.js:74 empty-or-comment
src/routes/wardrobeEventRoutes.js:220 empty-or-comment
src/routes/wardrobeEventRoutes.js:263 empty-or-comment
src/routes/world.js:24 other
src/routes/world.js:27 other
src/routes/world.js:129 empty-or-comment
src/routes/world.js:187 other
src/routes/world.js:192 empty-or-comment
src/routes/world.js:222 empty-or-comment
src/routes/worldEvents.js:152 other
src/routes/worldEvents.js:155 other
src/routes/worldEvents.js:158 other
src/routes/worldEvents.js:169 arrow-value
src/routes/worldEvents.js:188 arrow-value
src/routes/worldEvents.js:215 arrow-value
src/routes/worldEvents.js:223 arrow-value
src/routes/worldEvents.js:279 arrow-value
src/routes/worldEvents.js:292 arrow-value
src/routes/worldEvents.js:465 empty-or-comment
src/routes/worldEvents.js:951 other
src/routes/worldEvents.js:1045 other
src/routes/worldEvents.js:1060 empty-or-comment
src/routes/worldEvents.js:1129 other
src/routes/worldEvents.js:1184 empty-or-comment
src/routes/worldEvents.js:1405 other
src/routes/worldEvents.js:1546 empty-or-comment
src/routes/worldEvents.js:1557 empty-or-comment
src/routes/worldEvents.js:1620 other
src/routes/worldEvents.js:1627 empty-or-comment
src/routes/worldEvents.js:1687 other
src/routes/worldEvents.js:2108 other
src/routes/worldEvents.js:2125 empty-or-comment
src/routes/worldEvents.js:2227 empty-or-comment
src/routes/worldEvents.js:2248 other
src/routes/worldEvents.js:2343 empty-or-comment
src/routes/worldEvents.js:2396 empty-or-comment
src/routes/worldEvents.js:2436 empty-or-comment
src/routes/worldEvents.js:2444 empty-or-comment
src/routes/worldEvents.js:2597 returns
src/routes/worldEvents.js:2681 empty-or-comment
src/routes/worldEvents.js:2706 other
src/routes/worldEvents.js:2733 empty-or-comment
src/routes/worldEvents.js:2746 empty-or-comment
src/routes/worldEvents.js:2756 empty-or-comment
src/routes/worldEvents.js:2769 empty-or-comment
src/routes/worldEvents.js:2828 returns
src/routes/worldEvents.js:2833 returns
src/routes/worldEvents.js:2919 returns
src/routes/worldEvents.js:3033 empty-or-comment
src/routes/worldEvents.js:3049 other
src/routes/worldEvents.js:3087 other
src/routes/worldEvents.js:3092 empty-or-comment
src/routes/worldEvents.js:3099 other
src/routes/worldEvents.js:3309 empty-or-comment
src/routes/worldEvents.js:3338 other
src/routes/worldEvents.js:3344 other
src/routes/worldEvents.js:3394 other
src/routes/worldEvents.js:3519 other
src/routes/worldEvents.js:3528 other
src/routes/worldEvents.js:3589 other
src/routes/worldEvents.js:3711 other
src/routes/worldEvents.js:3784 empty-or-comment
src/routes/worldEvents.js:3833 empty-or-comment
src/routes/worldEvents.js:3863 other
src/routes/worldEvents.js:3866 other
src/routes/worldEvents.js:3874 other
src/routes/worldEvents.js:4036 other
src/routes/worldEvents.js:4089 other
src/routes/worldEvents.js:4192 empty-or-comment
src/routes/worldEvents.js:4225 other
src/routes/worldEvents.js:4236 other
src/routes/worldStudio.js:79 returns
src/routes/worldStudio.js:85 returns
src/routes/worldStudio.js:369 arrow-value
src/routes/worldStudio.js:1108 empty-or-comment
src/routes/worldStudio.js:1822 other
src/routes/worldStudio.js:3185 empty-or-comment
src/routes/worldStudio.js:3196 empty-or-comment
src/routes/worldStudio.js:3210 empty-or-comment
src/routes/worldStudio.js:3349 arrow-value
--- per file
  62 src/routes/worldEvents.js
  22 src/routes/memories/engine.js
  17 src/routes/storyHealth.js
  12 src/routes/socialProfileRoutes.js
  10 src/routes/characterAI.js
   9 src/routes/storyteller.js
   9 src/routes/worldStudio.js
   8 src/routes/memories/assistant.js
   6 src/routes/onboarding.js
   6 src/routes/sceneProposeRoute.js
   6 src/routes/shows.js
   6 src/routes/wardrobe.js
   6 src/routes/world.js
   5 src/routes/characterRegistry.js
   5 src/routes/evaluation.js
   5 src/routes/storyEvaluationRoutes.js
   4 src/routes/memories/interview.js
   4 src/routes/memories/stories.js
   4 src/routes/socialProfileBulkRoutes.js
   4 src/routes/tierFeatures.js
   4 src/routes/uiOverlayRoutes.js
   3 src/routes/amberDiagnosticRoutes.js
   3 src/routes/amberSessionRoutes.js
   3 src/routes/careerGoals.js
   3 src/routes/episodes.js
   3 src/routes/sceneSetRoutes.js
   3 src/routes/therapy.js
   3 src/routes/wardrobeEventRoutes.js
   2 src/routes/eventGeneratorRoute.js
   2 src/routes/generate-script-from-book.js
   2 src/routes/scriptParse.js
   2 src/routes/session.js
   1 src/routes/admin.js
   1 src/routes/assets.js
   1 src/routes/characterFollowRoutes.js
   1 src/routes/consciousness.js
   1 src/routes/continuityEngine.js
   1 src/routes/episodeBriefRoutes.js
   1 src/routes/episodeScriptWriterRoutes.js
   1 src/routes/feedSchedulerRoutes.js
   1 src/routes/memories/core.js
   1 src/routes/memories/voice.js
   1 src/routes/novelIntelligenceRoutes.js
   1 src/routes/phoneAIRoutes.js
   1 src/routes/phonePlaythroughRoutes.js
   1 src/routes/press.js
   1 src/routes/sceneStudioEpisodeRoutes.js
   1 src/routes/upgradeRoutes.js
   1 src/routes/wardrobeBrands.js
--- files=49 of 142; sites=260
```

</details>

### B.3 Class 5 — candidates (file:line op table.column)

<details><summary>109 lines</summary>

```
src/routes/arcRoutes.js:158 UPDATE show_arcs.phases
src/routes/arcRoutes.js:208 UPDATE show_arcs.phases
src/routes/arcRoutes.js:208 UPDATE show_arcs.progression_log
src/routes/calendarRoutes.js:584 INSERT world_events.canon_consequences
src/routes/evaluation.js:653 INSERT character_state_history.deltas_json
src/routes/evaluation.js:653 INSERT character_state_history.state_after_json
src/routes/eventGeneratorRoute.js:124 INSERT world_events.canon_consequences
src/routes/eventGeneratorRoute.js:124 INSERT world_events.dress_code_keywords
src/routes/opportunityRoutes.js:113 INSERT opportunities.deliverables
src/routes/opportunityRoutes.js:113 INSERT opportunities.status_history
src/routes/opportunityRoutes.js:113 INSERT opportunities.wardrobe_brief
src/routes/shows.js:750 INSERT assets.metadata
src/routes/shows.js:771 INSERT assets.metadata
src/routes/shows.js:833 UPDATE assets.metadata
src/routes/templateStudio.js:188 INSERT template_studio.canvas_config
src/routes/templateStudio.js:188 INSERT template_studio.role_slots
src/routes/templateStudio.js:188 INSERT template_studio.safe_zones
src/routes/templateStudio.js:440 INSERT template_studio.canvas_config
src/routes/templateStudio.js:440 INSERT template_studio.role_slots
src/routes/templateStudio.js:440 INSERT template_studio.safe_zones
src/routes/todoListRoutes.js:103 UPDATE episode_todo_lists.social_tasks
src/routes/todoListRoutes.js:103 UPDATE episode_todo_lists.tasks
src/routes/todoListRoutes.js:108 UPDATE episode_todo_lists.tasks
src/routes/todoListRoutes.js:139 UPDATE episode_todo_lists.tasks
src/routes/todoListRoutes.js:308 UPDATE episode_todo_lists.social_tasks
src/routes/uiOverlayRoutes.js:319 INSERT assets.metadata
src/routes/uiOverlayRoutes.js:402 INSERT assets.metadata
src/routes/uiOverlayRoutes.js:635 UPDATE assets.metadata
src/routes/uiOverlayRoutes.js:676 UPDATE assets.metadata
src/routes/uiOverlayRoutes.js:748 UPDATE assets.metadata
src/routes/uiOverlayRoutes.js:778 UPDATE assets.metadata
src/routes/wardrobe.js:1768 INSERT character_state_history.deltas_json
src/routes/wardrobe.js:1782 INSERT character_state_history.deltas_json
src/routes/wardrobe.js:2285 UPDATE wardrobe.event_types
src/routes/worldEvents.js:508 INSERT world_events.canon_consequences
src/routes/worldEvents.js:508 INSERT world_events.dress_code_keywords
src/routes/worldEvents.js:508 INSERT world_events.required_ui_overlays
src/routes/worldEvents.js:508 INSERT world_events.requirements
src/routes/worldEvents.js:508 INSERT world_events.rewards
src/routes/worldEvents.js:508 INSERT world_events.seeds_future_events
src/routes/worldEvents.js:884 UPDATE world_events.canon_consequences
src/routes/worldEvents.js:1242 INSERT world_events.canon_consequences
src/routes/worldEvents.js:1242 INSERT world_events.requirements
src/routes/worldEvents.js:1552 UPDATE world_events.canon_consequences
src/routes/worldEvents.js:1983 UPDATE assets.metadata
src/routes/worldEvents.js:2620 INSERT world_events.canon_consequences
src/routes/worldEvents.js:2633 INSERT world_events.canon_consequences
src/routes/worldEvents.js:3210 UPDATE world_events.outfit_pieces
src/routes/worldEvents.js:3210 UPDATE world_events.outfit_score
src/routes/worldEvents.js:3447 INSERT assets.metadata
src/routes/worldEvents.js:3461 INSERT assets.metadata
src/routes/worldEvents.js:3542 UPDATE world_events.canon_consequences
src/routes/worldEvents.js:3556 UPDATE episode_todo_lists.tasks
src/routes/worldEvents.js:3562 INSERT episode_todo_lists.tasks
src/routes/worldEvents.js:3654 INSERT assets.metadata
src/routes/worldEvents.js:3824 INSERT assets.metadata
src/routes/worldEvents.js:3906 UPDATE world_events.required_ui_overlays
src/routes/worldEvents.js:4052 UPDATE episodes.distribution_metadata
src/routes/worldStudio.js:335 INSERT ecosystem_previews.characters
src/routes/worldStudio.js:488 INSERT registry_characters.aesthetic_dna
src/routes/worldStudio.js:488 INSERT registry_characters.career_status
src/routes/worldStudio.js:488 INSERT registry_characters.evolution_tracking
src/routes/worldStudio.js:488 INSERT registry_characters.extra_fields
src/routes/worldStudio.js:488 INSERT registry_characters.name_options
src/routes/worldStudio.js:488 INSERT registry_characters.personality_matrix
src/routes/worldStudio.js:488 INSERT registry_characters.relationships_map
src/routes/worldStudio.js:488 INSERT registry_characters.story_presence
src/routes/worldStudio.js:488 INSERT registry_characters.voice_signature
src/routes/worldStudio.js:860 UPDATE registry_characters.relationships_map
src/routes/worldStudio.js:999 INSERT world_character_batches.world_context
src/routes/worldStudio.js:1160 UPDATE registry_characters.aesthetic_dna
src/routes/worldStudio.js:1160 UPDATE registry_characters.career_status
src/routes/worldStudio.js:1160 UPDATE registry_characters.evolution_tracking
src/routes/worldStudio.js:1160 UPDATE registry_characters.extra_fields
src/routes/worldStudio.js:1160 UPDATE registry_characters.personality_matrix
src/routes/worldStudio.js:1160 UPDATE registry_characters.relationships_map
src/routes/worldStudio.js:1160 UPDATE registry_characters.story_presence
src/routes/worldStudio.js:1160 UPDATE registry_characters.voice_signature
src/routes/worldStudio.js:1428 UPDATE registry_characters.aesthetic_dna
src/routes/worldStudio.js:1428 UPDATE registry_characters.career_status
src/routes/worldStudio.js:1428 UPDATE registry_characters.evolution_tracking
src/routes/worldStudio.js:1428 UPDATE registry_characters.extra_fields
src/routes/worldStudio.js:1428 UPDATE registry_characters.personality_matrix
src/routes/worldStudio.js:1428 UPDATE registry_characters.relationships_map
src/routes/worldStudio.js:1428 UPDATE registry_characters.story_presence
src/routes/worldStudio.js:1428 UPDATE registry_characters.voice_signature
src/routes/worldStudio.js:1567 UPDATE registry_characters.aesthetic_dna
src/routes/worldStudio.js:1567 UPDATE registry_characters.career_status
src/routes/worldStudio.js:1567 UPDATE registry_characters.evolution_tracking
src/routes/worldStudio.js:1567 UPDATE registry_characters.extra_fields
src/routes/worldStudio.js:1567 UPDATE registry_characters.personality_matrix
src/routes/worldStudio.js:1567 UPDATE registry_characters.relationships_map
src/routes/worldStudio.js:1567 UPDATE registry_characters.story_presence
src/routes/worldStudio.js:1567 UPDATE registry_characters.voice_signature
src/routes/worldStudio.js:1712 UPDATE registry_characters.aesthetic_dna
src/routes/worldStudio.js:1712 UPDATE registry_characters.career_status
src/routes/worldStudio.js:1712 UPDATE registry_characters.evolution_tracking
src/routes/worldStudio.js:1712 UPDATE registry_characters.extra_fields
src/routes/worldStudio.js:1712 UPDATE registry_characters.personality_matrix
src/routes/worldStudio.js:1712 UPDATE registry_characters.relationships_map
src/routes/worldStudio.js:1712 UPDATE registry_characters.story_presence
src/routes/worldStudio.js:1712 UPDATE registry_characters.voice_signature
src/routes/worldStudio.js:2709 INSERT world_character_batches.world_context
src/routes/worldStudio.js:3064 UPDATE world_characters.relationship_graph
src/routes/worldStudio.js:3108 UPDATE world_characters.relationship_graph
src/routes/worldStudio.js:3137 UPDATE world_characters.relationship_graph
src/routes/worldStudio.js:3256 INSERT world_locations.associated_characters
src/routes/worldStudio.js:3256 INSERT world_locations.metadata
src/routes/worldStudio.js:3256 INSERT world_locations.sensory_details
--- per file
  51 src/routes/worldStudio.js
  24 src/routes/worldEvents.js
   6 src/routes/templateStudio.js
   6 src/routes/uiOverlayRoutes.js
   5 src/routes/todoListRoutes.js
   3 src/routes/arcRoutes.js
   3 src/routes/opportunityRoutes.js
   3 src/routes/shows.js
   3 src/routes/wardrobe.js
   2 src/routes/evaluation.js
   2 src/routes/eventGeneratorRoute.js
   1 src/routes/calendarRoutes.js
--- files=12 of 142; sites=109
```

</details>

### B.4 Class 6 — files and idiom counts

<details><summary>30 files with 2+ idioms; all 114 files listed</summary>

```
--- per file
   3 src/routes/characterRegistry.js  getModels=37 appGet=2 require=5
   3 src/routes/worldEvents.js  getModels=38 appGet=23 require=25
   2 src/routes/admin.js  getModels=2 require=1
   2 src/routes/authorNoteRoutes.js  appGet=1 require=1
   2 src/routes/calendarRoutes.js  appGet=1 require=1
   2 src/routes/careerGoals.js  getModels=8 require=1
   2 src/routes/characterCrossingRoutes.js  appGet=1 require=1
   2 src/routes/characterGenerationRoutes.js  appGet=1 require=1
   2 src/routes/continuityEngine.js  getModels=17 require=1
   2 src/routes/entanglementRoutes.js  appGet=1 require=1
   2 src/routes/evaluation.js  getModels=7 require=1
   2 src/routes/eventDeliverables.js  getModels=6 require=1
   2 src/routes/feedRelationshipRoutes.js  appGet=1 require=1
   2 src/routes/feedSchedulerRoutes.js  appGet=7 require=7
   2 src/routes/mirrorFieldRoutes.js  appGet=1 require=1
   2 src/routes/pageContent.js  appGet=1 require=1
   2 src/routes/press.js  getModels=6 require=1
   2 src/routes/propertyRoutes.js  getModels=8 require=1
   2 src/routes/socialProfileBulkRoutes.js  getModels=8 require=1
   2 src/routes/storyHealth.js  getModels=9 require=1
   2 src/routes/storyteller.js  getModels=37 require=5
   2 src/routes/templateStudio.js  getModels=10 require=1
   2 src/routes/todoListRoutes.js  appGet=10 require=10
   2 src/routes/undergroundRoutes.js  appGet=1 require=1
   2 src/routes/wantFieldRoutes.js  appGet=1 require=1
   2 src/routes/wardrobe.js  getModels=17 require=1
   2 src/routes/wardrobeBrands.js  getModels=8 require=1
   2 src/routes/wardrobeLibrary.js  appGet=3 require=5
   2 src/routes/world.js  getModels=5 require=1
   2 src/routes/worldTemperatureRoutes.js  appGet=2 require=2
   1 src/routes/aiUsageRoutes.js  require=1
   1 src/routes/amberDiagnosticRoutes.js  require=1
   1 src/routes/amberSessionRoutes.js  require=1
   1 src/routes/animatic.js  require=1
   1 src/routes/arcRoutes.js  require=7
   1 src/routes/arcTrackingRoutes.js  require=3
   1 src/routes/assets.js  require=1
   1 src/routes/auditLogs.js  require=1
   1 src/routes/cfoAgentRoutes.js  require=1
   1 src/routes/characterAI.js  require=1
   1 src/routes/characterDepthRoutes.js  require=1
   1 src/routes/characterFollowRoutes.js  require=7
   1 src/routes/characterGenerator.js  require=4
   1 src/routes/characterGrowthRoute.js  require=1
   1 src/routes/characters.js  require=1
   1 src/routes/characterSparkRoute.js  require=1
   1 src/routes/compositions.js  require=2
   1 src/routes/consciousness.js  require=3
   1 src/routes/decisions.js  require=1
   1 src/routes/editMaps.js  require=1
   1 src/routes/episodeBriefRoutes.js  require=3
   1 src/routes/episodeOrchestrationRoute.js  require=2
   1 src/routes/episodes.js  require=16
   1 src/routes/episodeScriptWriterRoutes.js  require=8
   1 src/routes/eventGeneratorRoute.js  require=1
   1 src/routes/export.js  require=1
   1 src/routes/feedEnhancedRoutes.js  require=10
   1 src/routes/feedPipelineRoutes.js  require=3
   1 src/routes/feedPostRoutes.js  require=6
   1 src/routes/footage.js  require=4
   1 src/routes/franchiseBrainRoutes.js  require=1
   1 src/routes/gameShows.js  require=1
   1 src/routes/generate-script-from-book.js  require=1
   1 src/routes/hairLibraryRoutes.js  require=6
   1 src/routes/imageProcessing.js  require=1
   1 src/routes/lala-scene-detection.js  require=3
   1 src/routes/lalaScripts.js  require=1
   1 src/routes/layers.js  require=1
   1 src/routes/makeupLibraryRoutes.js  require=6
   1 src/routes/manuscript-export.js  require=3
   1 src/routes/memories/assistant.js  require=1
   1 src/routes/memories/core.js  require=1
   1 src/routes/memories/engine.js  require=32
   1 src/routes/memories/extras.js  require=1
   1 src/routes/memories/helpers.js  require=1
   1 src/routes/memories/interview.js  require=1
   1 src/routes/memories/planning.js  require=1
   1 src/routes/memories/stories.js  require=1
   1 src/routes/memories/voice.js  require=1
   1 src/routes/novelIntelligenceRoutes.js  require=1
   1 src/routes/onboarding.js  require=3
   1 src/routes/opportunityRoutes.js  require=1
   1 src/routes/pdfIngestRoute.js  require=1
   1 src/routes/phoneAIRoutes.js  require=1
   1 src/routes/phoneMissionRoutes.js  require=4
   1 src/routes/phonePlaythroughRoutes.js  require=4
   1 src/routes/relationships.js  require=1
   1 src/routes/sceneLinks.js  require=1
   1 src/routes/sceneProposeRoute.js  require=1
   1 src/routes/scenes.js  require=2
   1 src/routes/sceneSetRoutes.js  require=12
   1 src/routes/sceneStudioEpisodeRoutes.js  require=1
   1 src/routes/scriptAnalysis.js  require=1
   1 src/routes/scriptGenerator.js  require=1
   1 src/routes/scriptParse.js  require=4
   1 src/routes/seasonRhythmRoutes.js  require=1
   1 src/routes/seed.js  require=1
   1 src/routes/session.js  require=1
   1 src/routes/shows.js  require=7
   1 src/routes/socialProfileRoutes.js  require=41
   1 src/routes/stories.js  require=18
   1 src/routes/storyEvaluationRoutes.js  require=1
   1 src/routes/templates.js  require=1
   1 src/routes/textureLayerRoutes.js  require=1
   1 src/routes/therapy.js  appGet=9
   1 src/routes/thumbnailTemplates.js  require=1
   1 src/routes/tierFeatures.js  require=1
   1 src/routes/timelineData.js  require=2
   1 src/routes/uiOverlayRoutes.js  require=25
   1 src/routes/universe.js  require=1
   1 src/routes/upgradeRoutes.js  require=1
   1 src/routes/wardrobeEventRoutes.js  require=3
   1 src/routes/worldStudio.js  require=3
   1 src/routes/youtube.js  require=1
--- files=114 of 142; files using 2+ idioms=30
```

</details>

---

*Type: standalone probe (§65.3-P). Rules: nothing. Mints: nothing. Closes: nothing. Host/AWS/DB/Cognito contact: none. Basis: `073e57f8`. Task: #2073. [skip-automerge]*
