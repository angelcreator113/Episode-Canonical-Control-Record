# F-AUTH-1 — the AI value interpolated into SQL at `tierFeatures.js:1038`, MEASURED

**Basis:** `origin/main` at `ab51c70100197788ceb6a8bb53e140516519629a` (2026-09-23),
the squash merge of #1712. The working tree was clean at that commit for every
command below.

**Standing:** MEASURED for every claim, except the two labelled otherwise:

- **ATTESTED:** one claim about the canon database's columns (§2.3), quoted from a
  filed schema capture. This session made no database contact.
- **INFERRED:** one claim about PostgreSQL's wire protocol (§3.3), stated from the
  driver's code and the protocol's documented behaviour, not run.

Every MEASURED claim is read from this repository at the basis, or from the
installed `sequelize` 6.37.8 and `pg` 8.20.0 under `node_modules/`, and each
carries its command and raw output. Nothing here is RULED.

**What this is.** A read of one site that
`F-AUTH-1_RuntimeColumnWrites_Read_MEASURED_2026-09-23.md` §5 named as outside
its own question: an AI-supplied **value**, not a column name, placed into SQL
text. It records reachability, not risk. It fixes nothing, rules nothing and
mints nothing (§7).

Task: #1713. No host, AWS, database, or Cognito contact.

---

## Summary

1. **At this basis, the value never reaches SQL.** `db.StorytellerChapter` has no
   `metadata` attribute. So `Model.update` drops the `metadata` key before it
   builds the statement, and the interpolated literal is never sent (§2).
2. **The only frontend caller does not reach the AI call.** `BeatsTab` in
   `NarrativeControlCenter.jsx` sends no `book_id`, and the handler returns 400
   without one (§4).
3. **If a `metadata` attribute were added, the literal would go out verbatim.**
   Nothing escapes it, and a single quote in the AI's prose would end the SQL
   string early. Because this `UPDATE` always carries bound values, the driver
   sends it with the extended protocol, and that protocol takes one statement
   per message (§3).
4. **As a pattern, it is one of 10 unescaped value sites in `src/` outside
   migrations and seeders.** Exactly **one** of them takes a value straight
   from the caller: `FilterService.getFilterOptions`. It puts
   `req.query.episodeId` into SQL text unquoted, and runs the SQL with no bound
   values, which is the protocol that accepts more than one statement (§5).

---

## 1. The statement as built

```
$ sed -n 1029,1041p src/routes/tierFeatures.js
    const result = JSON.parse(raw);

    // Optionally save beats to chapter
    if (chapter_id) {
      await db.StorytellerChapter.update(
        {
          scene_goal: result.chapter_summary || null,
          emotional_state_start: result.emotional_trajectory?.split('→')[0]?.trim() || null,
          emotional_state_end: result.emotional_trajectory?.split('→')[1]?.trim() || null,
          metadata: db.sequelize.literal(`COALESCE(metadata, '{}')::jsonb || '${JSON.stringify({ beat_sheet: result.beats, arc_type: result.chapter_arc_type })}'::jsonb`),
        },
        { where: { id: chapter_id } }
      ).catch(e => console.warn('[tier-features] beat sheet metadata update error:', e?.message));
```

The site interpolates `JSON.stringify({ beat_sheet: result.beats, arc_type:
result.chapter_arc_type })` between single quotes, inside a `sequelize.literal`.
`result` is `JSON.parse` of the AI response (§2).

**Nothing escapes or validates it first.** `JSON.stringify` escapes double quotes
and backslashes. It leaves a single quote as it is:

```
$ node -e 'console.log(JSON.stringify({d:"Lala'"'"'s door; x'"'"'::jsonb; --"}))'
{"d":"Lala's door; x'::jsonb; --"}
EXIT: 0
```

`sequelize.literal` passes its text into the statement as written. A literal is a
`SequelizeMethod`, and for one of those `updateQuery` inlines the value rather
than binding it (`node_modules/sequelize/lib/dialects/abstract/query-generator.js:385`–`:386`).

Any error from this `update` is caught, logged with `console.warn`, and the
handler still returns `{ success: true, ...result }` (`tierFeatures.js:1041`, `:1044`).

---

## 2. Where the value comes from, and why it does not reach SQL

### 2.1 The AI call

`POST /generate-chapter-beats` (`tierFeatures.js:933`) calls
`anthropic.messages.create` with `model: 'claude-sonnet-4-20250514'` and
`max_tokens: 4000` (`:978`–`:980`). The client is `const anthropic = new Anthropic();`
(`:38`). The user prompt (`:984`–`:1023`) is built from:

- **The database:** the book's title, author, theme, tone and POV; each existing
  chapter's title, goal, emotions and conflict; up to 10 characters'
  `display_name`, `character_key`, `core_desire`, `core_wound` and `role_type`;
  and the active threads' `thread_name`.
- **The request body:** `chapter_title` and `scene_context` (`:935`, `:998`–`:999`).

The prompt asks for JSON with `chapter_arc_type` and a `beats` array. Each beat has
`beat_name`, `description` ("what happens in this beat (2-3 sentences)"),
`emotional_arc`, `characters_present` (`["character_key"]`), `threads_advanced`
(`["thread name if applicable"]`) and `scene_brief_seed` (`:1003`–`:1023`).
`result.beats` and `result.chapter_arc_type` are what §1 interpolates.

### 2.2 Can the value be a name?

**Yes.** `threads_advanced` asks for thread names, which come from
`story_threads.thread_name` in the prompt. `description`, `beat_name`,
`emotional_arc` and `scene_brief_seed` are free prose about named characters. The
prompt includes `display_name` for up to 10 characters. Nothing in the prompt or
the code keeps a single quote out of any of these. So a possessive ("Lala's"), a
contraction, or a name that contains an apostrophe can reach the value in the
ordinary course of use. None of that needs an attacker. The body fields
`chapter_title` and `scene_context` are caller text that enters the same prompt.

### 2.3 The key is dropped before any SQL is built

`db` is `require('../models')` (`tierFeatures.js:36`). `models/index.js` registers
`StorytellerChapter = require('./StorytellerChapter')(sequelize)` (`:280`). That
model has no `metadata` attribute:

```
$ grep -nE "metadata" src/models/StorytellerChapter.js
EXIT: 1
```

Static `Model.update` keeps only the keys that are model attributes:
`options.fields = _.intersection(Object.keys(values), Object.keys(this.tableAttributes))`
(`node_modules/sequelize/lib/model.js:1915`, inside `static async update` at `:1887`).

The probe below loads the real model with a `Sequelize` that never connects. It
replaces `sequelize.query` to print what would be sent, and runs the same update
three times, with a plain value, an apostrophe and a separator. It was run from
the repository root and deleted afterwards:

```
$ node ./.sq-probe.js
metadata attr: false undefined
--- plain value
SQL : {
  query: 'UPDATE "storyteller_chapters" SET "scene_goal"=$1,"emotional_state_start"=$2,"emotional_state_end"=$3,"updated_at"=$4 WHERE ("deleted_at" IS NULL AND "id" = $5)',
  bind: [
    'sum',
    'a',
    'b',
    '2026-09-23 12:22:52.442 +00:00',
    '00000000-0000-0000-0000-000000000001'
  ]
}
BIND: undefined
--- apostrophe
SQL : {
  query: 'UPDATE "storyteller_chapters" SET "scene_goal"=$1,"emotional_state_start"=$2,"emotional_state_end"=$3,"updated_at"=$4 WHERE ("deleted_at" IS NULL AND "id" = $5)',
  bind: [
    'sum',
    'a',
    'b',
    '2026-09-23 12:22:52.450 +00:00',
    '00000000-0000-0000-0000-000000000001'
  ]
}
BIND: undefined
--- separator
SQL : {
  query: 'UPDATE "storyteller_chapters" SET "scene_goal"=$1,"emotional_state_start"=$2,"emotional_state_end"=$3,"updated_at"=$4 WHERE ("deleted_at" IS NULL AND "id" = $5)',
  bind: [
    'sum',
    'a',
    'b',
    '2026-09-23 12:22:52.452 +00:00',
    '00000000-0000-0000-0000-000000000001'
  ]
}
BIND: undefined
EXIT: 0
```

**No `metadata` column appears in any of the three statements.** The AI value
reaches the response body (`res.json({ success: true, ...result })`), but not SQL.

**ATTESTED, from a filed document:** the canon schema capture
`EvidenceNote_Canon_Schema_Capture_2026-09-17.txt` lists 41 columns for
`storyteller_chapters`, and none is named `metadata`:

```
$ grep -cE "^ storyteller_chapters +\|" docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
41
$ grep -E "^ storyteller_chapters +\| metadata" docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
EXIT: 1
```

The migration `20260309000000-tier-features-all.js` touches
`storyteller_chapters` only to add `part_number`, `part_title` and `act_number`
(its header, `:17`).

---

## 3. What a single quote or a separator would do

### 3.1 At this basis

**Nothing, in SQL.** The literal is dropped (§2.3), so neither character reaches a
statement. The probe's apostrophe and separator runs produced the same statement
as the plain run.

### 3.2 If a `metadata` attribute were added to the model

This is recorded because it is the one change that would make the site live. The
same probe, with a `metadata` JSONB attribute added in memory only (no file
changed), prints:

```
$ node ./.sq-probe.js   # metadata attribute added in memory; no file changed
{"query":"UPDATE \"storyteller_chapters\" SET \"scene_goal\"=$1,\"metadata\"=COALESCE(metadata, '{}')::jsonb || '{\"beat_sheet\":[{\"description\":\"Lala's door\"}],\"arc_type\":\"setup\"}'::jsonb,\"updated_at\"=$2 WHERE (\"deleted_at\" IS NULL AND \"id\" = $3)","bind":["sum","2026-09-23 12:23:24.051 +00:00","00000000-0000-0000-0000-000000000001"]}
{"query":"UPDATE \"storyteller_chapters\" SET \"scene_goal\"=$1,\"metadata\"=COALESCE(metadata, '{}')::jsonb || '{\"beat_sheet\":[{\"description\":\"x'::jsonb; SELECT 1; --\"}],\"arc_type\":\"setup\"}'::jsonb,\"updated_at\"=$2 WHERE (\"deleted_at\" IS NULL AND \"id\" = $3)","bind":["sum","2026-09-23 12:23:24.059 +00:00","00000000-0000-0000-0000-000000000001"]}
EXIT: 0
```

- **Single quote:** the literal is inlined verbatim. The quote in `Lala's` ends the
  SQL string at `Lala`. What follows (`s door"}],…`) is then read as SQL, so the
  statement text no longer has the shape the code intended.
- **Separator:** the text after the injected quote is inlined as written,
  `;` included.

### 3.3 How Sequelize sends this statement

The statement is sent **with bound parameters**. `scene_goal`, the two emotion
fields, `updated_at` and the `where` id are always bound (`$1`…`$5` above). Only
the literal is inlined. Sequelize passes the bind array to the driver as
`connection.query(sql, parameters, …)` whenever `parameters.length` is non-zero
(`node_modules/sequelize/lib/dialects/postgres/query.js:47`). The `pg` driver
prepares any query that has values:

```
$ sed -n 35,58p node_modules/pg/lib/query.js
  requiresPreparation() {
    if (this.queryMode === 'extended') {
      return true
    }

    // named queries must always be prepared
    if (this.name) {
      return true
    }
    // always prepare if there are max number of rows expected per
    // portal execution
    if (this.rows) {
      return true
    }
    // don't prepare empty text queries
    if (!this.text) {
      return false
    }
    // prepare if there are values
    if (!this.values) {
      return false
    }
    return this.values.length > 0
  }
```

`updated_at` is always among the bound values, so this `UPDATE` always goes by the
extended protocol.

**INFERRED, not run:** PostgreSQL's extended protocol accepts one SQL command per
Parse message and rejects a string that holds more than one. The simple protocol,
used when there are no values, accepts several (`pg/lib/query.js:60`–`:62` handles
"a multi-statement simple query"). On that reading, a separator here could break
the statement but could not run a second one.

---

## 4. Routes, authentication and callers

- **Route:** `POST /api/v1/tier/generate-chapter-beats`. The handler is
  `tierFeatures.js:933`, mounted by `app.use('/api/v1/tier', tierFeaturesRoutes)`
  (`src/app.js:1304`).
- **Authentication:** `requireAuth` and `aiRateLimiter` on the route. No group
  check: `authorize(`, `userInGroup` and `req.user.groups` do not appear in
  `tierFeatures.js`, as recorded by the earlier read's §1.
- **What must be sent to reach the site:** `book_id` (else 400 at `:936`) and
  `chapter_id` (else the `update` is skipped at `:1032`).
- **Frontend callers: one, and it cannot reach the AI call.** It is `BeatsTab` in
  `frontend/src/pages/NarrativeControlCenter.jsx` (line 928), routed at
  `/narrative-control` (`frontend/src/App.jsx`). It sends `{ story_id, chapter_id,
  arc_position }` with no `book_id`, so the handler returns 400 before the AI call:

  ```
  $ grep -rnE "chapter-beats|chapterBeats" frontend/src
  frontend/src/pages/NarrativeControlCenter.jsx:928:      const data = await fetchJSON(`${API}/tier/generate-chapter-beats`, {
  ```

  A direct caller that sends `book_id` and `chapter_id` reaches the AI call and
  the `update`. Per §2.3, the `update` writes only the three named fields.

---

## 5. Every other site that interpolates a value into SQL text

The earlier read answered the column-name question (its §5). This section answers
the value question.

### 5.1 Instruments

1. `literal(` with a template interpolation:
   ```
   $ git grep -nE 'literal\(\s*`[^`]*\$\{' ab51c70100197788ceb6a8bb53e140516519629a -- src
   src/controllers/wardrobeLibraryController.js:1417:          models.sequelize.literal(`similarity(name, ${models.sequelize.escape(name)}) > 0.7`)
   src/controllers/wardrobeLibraryController.js:1442:            models.sequelize.literal(`similarity(name, ${models.sequelize.escape(name || '')})`),
   src/routes/sceneSetRoutes.js:1364:        where: sequelize.literal(`event_compatibility @> '${JSON.stringify([beatNumber])}'::jsonb`),
   src/routes/sceneSetRoutes.js:1368:          where: sequelize.literal(`"angles"."beat_affinity" @> '${JSON.stringify([beatNumber])}'::jsonb`),
   src/routes/tierFeatures.js:1038:          metadata: db.sequelize.literal(`COALESCE(metadata, '{}')::jsonb || '${JSON.stringify({ beat_sheet: result.beats, arc_type: result.chapter_arc_type })}'::jsonb`),
   src/services/episodeGeneratorService.js:862:            models.sequelize.literal(`metadata->>'event_id' = '${eventId.replace(/'/g, "''")}'`),
   EXIT: 0
   ```
2. **Any interpolation opened inside a single quote:**
   `git grep -nE "'\$\{" <basis> -- src` found 31 lines. After dropping one log
   message (`rbac.js:100`), one CSS string (`ThumbnailGeneratorService.js:579`)
   and two ffmpeg concat lines (`videoRenderer.js:515`, `:521`), the SQL lines are:
   - `tierFeatures.js:90`, `:1038`;
   - `sceneSetRoutes.js:1364`, `:1368`;
   - `ImageProcessingService.js:102`, `:103`, `:124`;
   - `episodeGeneratorService.js:862`;
   - `models/job.js:329`;
   - `ErrorRecovery.js:92`;
   - 17 lines in six migrations and one seeder (§5.3).
3. **Unquoted interpolation after an SQL operator:**
   `git grep -nE "(LIMIT|OFFSET|IN \(|ARRAY\[|INTERVAL|= |> |< )\s*\$\{" <basis> -- src`,
   leaving out `$${…}` placeholders and log strings. The SQL hits are
   `tierFeatures.js:90`, `worldStudio.js:1078` and `FilterService.js:227`.
4. **A scan of every SQL-shaped template literal in `src/` for its interpolations**
   found 268, of which 174 remain after dropping `$${paramIndex}`-style
   placeholders, `.join(` column lists and table-name identifiers. Each of the 174
   was read. Beyond the sites above, they are identifiers, fixed fragments, or AI
   prompt text:
   - identifiers: sort columns, `tableName`, `c.conname`;
   - fixed fragments: `where` builders that add only `:named` placeholders, and
     `dateTrunc` chosen from a fixed map (`decisionAnalyticsService.js:94`–`:99`);
   - AI prompt text that happens to contain SQL words, not SQL.

   This scanner is not a JavaScript parser. It missed the two `sceneSetRoutes.js`
   literals that instruments 1 and 2 found, so instruments 1–3 are the ones this
   count rests on.
5. **String concatenation into `literal(` or `query(`:**
   `git grep -nE "(literal|query)\(\s*['\"][^'\"]*['\"]\s*\+" <basis> -- src`
   returned nothing (EXIT: 1). The one concatenated SQL fragment,
   `templateStudio.js:60`, joins `$n` placeholder conditions (`:45`–`:56`).

### 5.2 The sites, outside migrations and seeders — 10 unescaped, 4 escaped

**Unescaped values placed in SQL text:**

| # | Site | Value | Origin | Reachable from a request? |
|---|---|---|---|---|
| 1 | `tierFeatures.js:1038` | `JSON.stringify` of AI beats | AI response (§2) | Only via the AI's output, and **never emitted at this basis** (§2.3) |
| 2 | `tierFeatures.js:90` | `'${id}'` for each of `charIds` | `RegistryCharacter.id` of rows found by `registry_id` and `character_key` (`:57`–`:62`) | The ids are database UUIDs, not caller text |
| 3, 4 | `sceneSetRoutes.js:1364`, `:1368` | `JSON.stringify([beatNumber])` | `parseInt(req.params.beatNumber, 10)` (`:1336`) | Caller-supplied, but always a number or `NaN` (which stringifies as `null`). Only in the fallback after `Op.contains` throws (`:1359`). |
| 5, 6 | `ImageProcessingService.js:102`, `:103` | `JSON.stringify` of thumbnail and webp URLs | Built from `THUMBNAIL_SIZES` keys, the server-generated `assetId` (`AssetService.js:297`, `uuidv4()`), the bucket and the region | No caller text |
| 7 | **`FilterService.js:227`**, used at `:233`, `:241`, `:249`, `:257`, `:267` | `AND tc.episode_id = ${episodeId}`, **unquoted** | `req.query.episodeId`, passed straight through by `GET /api/v1/compositions/search/filters/options` (`compositions.js:1251`–`:1254`), with no validation | **Yes: caller text, unescaped, unquoted** |
| 8 | `models/job.js:329` | `INTERVAL '${daysOld} days'` | `Job.cleanup(daysOld = 30)`. Its only caller is `ErrorRecovery.cleanupOldJobs(daysOld = 30)` (`ErrorRecovery.js:281`–`:283`), and nothing in `src/` calls `cleanupOldJobs` | No caller in `src/` |
| 9 | `ErrorRecovery.js:92` | `INTERVAL '${hours} hours'` | `getFailureRate(hours = 24)`, with no caller in `src/` | No caller in `src/` |
| 10 | `worldStudio.js:1078` | `${intimate_eligible === 'true'}` | A boolean computed from `req.query` | Only `true` or `false` can appear |

**Site 7, measured further.** It is the only one in the table where a caller's
own text reaches SQL unchanged:

- `FilterService` requires `{ pool }` from `src/db.js` (`FilterService.js:3`), a
  plain `pg` `Pool` (`src/db.js:1`–`:3`).
- It runs all five statements as `pool.query(formatsQuery)` and so on, **with no
  values** (`FilterService.js:272`–`:276`). By §3.3's driver code, a query with
  no values is not prepared. It goes by the simple protocol.
- The route is `requireAuth` only, with no group check (`compositions.js:1251`).
  `/search/filters/options` has three path segments, so none of the router's
  earlier `GET` patterns match it first. Those are `/`, `/episode/:episodeId`,
  `/:id`, `/:id/versions`, `/:id/versions/:versionNumber`,
  `/:id/versions/:versionA/compare/:versionB`, `/:id/version-stats` and `/search`.
- **No frontend code calls it:**
  ```
  $ grep -rnE "filters/options" frontend/src
  EXIT: 1
  ```

**Escaped values** (quote-doubling or `sequelize.escape`):

| Site | Value | Escape |
|---|---|---|
| `ImageProcessingService.js:124` | `error.message` | `.replace(/'/g, "''")` |
| `episodeGeneratorService.js:862` | `eventId` | `.replace(/'/g, "''")` |
| `wardrobeLibraryController.js:1270`, `:1275` | search `query` | `models.sequelize.escape(query)` |
| `wardrobeLibraryController.js:1417`, `:1442` | `name` | `models.sequelize.escape(name)` |

### 5.3 Migrations and seeders — 17 lines

The 17 lines are:

- `20260217000001-fix-wardrobe-schema-gaps.js:22`;
- `20260218000001-fix-scenes-timeline-schema-gaps.js:22`, `:33`;
- `20260218000002-fix-wardrobe-defaults-table.js:25`;
- `20260311140000-fix-amber-timestamp-columns.js:18`, `:36`;
- `20260312300000-character-depth-engine.js:20`;
- `20260621000000-add-dossier-fields-to-world-characters.js:29`;
- `20260725000000-unify-dream-cities.js:24`, `:39`, `:48`, `:63`, `:67`, `:84`;
- `seeders/20260316200000-justawoman-world-characters.js:65`, `:66`, `:81`.

They interpolate constants declared in the same file (for example `tables` at
`fix-amber-timestamp-columns.js:12`, `cityMap` and `infraMap` in
`unify-dream-cities.js`, `columns` in `add-dossier-fields…js:6`) or ids read or
generated during the run (`REGISTRY_ID`, `showId` at the seeder's `:51`–`:61`).
They run under `sequelize db:migrate` or seed. No request reaches them.

### 5.4 One site or a pattern?

**It is a pattern, but only one site in it takes the caller's text.**
Unescaped value interpolation appears at 10 sites outside migrations. For 8 of
them, what is interpolated is fixed by the code: a database id, a number, a
boolean, a code-built URL, or a function with no caller. Site 1, this issue's
site, is AI-supplied and not emitted. Site 7 (`FilterService.getFilterOptions`)
is the one where a caller's own text reaches SQL unquoted and unescaped, by the
protocol that accepts more than one statement.

This read records site 7's reachability and does not assess it further. It is
outside #1713's site.

---

## 6. Options for Evoni — no recommendation

These are for **this site** (`tierFeatures.js:1038`). Site 7 is a separate site,
and choosing an option here decides nothing about it.

| Option | What it would take | What it would change |
|---|---|---|
| **Parameterise the value** | Replace the literal with a bound value, for example a `:beatSheet` replacement cast `::jsonb` or `sequelize.fn`/`cast`. On its own it still writes nothing, because `metadata` is not a model attribute (§2.3). To make the write land, it would also need a `metadata` attribute on `StorytellerChapter`, and a new migration if the column is absent, as the ATTESTED capture records. | The value would never be inlined, so quotes and separators in prose would be data. The beat sheet would be stored for the first time, which it is not at this basis. |
| **Escape it** | Wrap the string in `sequelize.escape(...)` (one line). The same caveat applies: without the attribute, nothing is written. | Quotes would be doubled. The site would stay a string-built literal, but a correctly escaped one. |
| **Constrain what the AI may return** | Validate `result.beats` against a schema and reject or strip values containing `'` or `;`. | This cannot remove apostrophes without damaging the prose. `description` and `beat_name` are meant to contain them (§2.2). It would narrow what reaches the site, not change how the site builds SQL. |
| **Leave it** | Nothing. | At this basis, the value is not emitted and the only frontend caller stops at 400. The site becomes live the day a `metadata` attribute is added to `StorytellerChapter`, and it would go live unescaped (§3.2). |

---

## 7. What this read does not do

- **It records reachability, not risk.** It makes no claim about likelihood or
  exploitability, for this site or for §5's sites, site 7 included.
- **No fix.** No code is changed. It ran no statement against any database.
- **No ruling, no Fix Plan, no number minted.** No filed document is edited.

---

## Footer

- **Type:** standalone evidence note (MEASURED), F-AUTH-1 family.
- **Rules:** nothing.
- **Mints:** nothing — no FD, XK, or PE.
- **Host / AWS / database / Cognito contact:** none. Every claim reads this
  repository at the basis or the installed `node_modules`, except the ATTESTED
  schema line (§2.3), quoted from a filed capture, and the INFERRED protocol line
  (§3.3).
- **Production:** production's freeze is lifted
  (`F-Deploy-1_Fix_Plan_v1.53.md` §1). Agent sessions still never touch
  hosts, AWS, RDS, or Cognito (`CLAUDE.md`), unchanged by that lift or by
  this note.
