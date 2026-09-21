# Script pipeline census

Task #1617. A census, not a build: every code path touching
`scene_plans`, episode script storage, script-text evaluation, and
downstream "which beat is this" consumers, recorded from reading code
only. No data queries were run — where the answer depends on what's
actually in the database, that's stated explicitly as a question a query
would need to answer, not answered here. No code changes. No schema
proposed. Basis: `main` at the SHA this branch forked from
(`claude/issue-1617-script-pipeline-census`).

See `docs/EVENT_EPISODE_FLOW.md` §8(j) for Evoni's ruling this census is
measured against: canonical beats are the generation contract, the script
is the performance of it. Nothing below implements that ruling — this
document is the gap between it and what the code does today.

---

## 1. The generation contract

Recorded in `docs/EVENT_EPISODE_FLOW.md` §8(j) (Task #1617, 2026-09-21):
canonical beats are the contract; Generate Script instantiates all 14
canonical beats from the Episode Plan/Event Package/episode state; every
generated script beat keeps its canonical beat number/key; the script
generator does not invent its own beats. Not implemented anywhere yet —
sections 2-5 below record how far current code is from that.

---

## 2. `scene_plans` — every writer, and the duplicate-set question

`ScenePlan` (`src/models/ScenePlan.js`) / `scene_plans` table. Fields
used by writers below: `beat_number`, `beat_name`, `emotional_intent`,
`scene_set_id`, `scene_context`, `sort_order`, `locked`, `ai_suggested`.

**Writer A — `scenePlannerService.generateScenePlan`**
(`src/services/scenePlannerService.js`). Destroy-then-recreate, in that
order:
- `:220` `await ScenePlan.destroy({ where: { episode_id: episodeId }, force: true });`
- `:239` `await ScenePlan.bulkCreate(rows);`

Safe against its own repeated calls — a second call for the same
`episode_id` clears the first call's rows before inserting new ones. No
duplicate-set risk from this writer alone.

Called from exactly one route: `src/routes/episodeBriefRoutes.js:91-118`,
`POST /:episodeId/generate-plan` → `:107`
`generateScenePlan(episodeId, episode.show_id, brief.toJSON(), { save: true })`.

**Writer B — `episodeGeneratorService.js:610-660`**, the inline "Create
Scene Plan (14 beats)" step inside episode generation. Loops
`BEAT_TEMPLATES` and does a raw `INSERT INTO scene_plans` per beat with a
fresh UUID each time (`:625-645`) — **no delete-first step, no
upsert, no existence check.** Runs once per call to whatever generates
the episode (confirmed caller: `generateEpisodeFromEvent`, invoked by
`worldEvents.js`'s episode-generation routes, see below).

**Duplicate-set question — answered from code, not data:** Writer B has
no guard against being called twice for the same `episode_id`. Whether
that ever actually happens depends on whether any live code path calls
`generateEpisodeFromEvent` (or otherwise re-enters Writer B) for an
`episode_id` that already has rows, which this census did not find — the
one path that regenerates an episode
(`worldEvents.js:1889-1943`, `POST .../regenerate-episode`) soft-deletes
the *old* episode row and creates a *new* `episode_id` for the
regeneration, so Writer B's fresh INSERTs land against a new,
previously-empty `episode_id`, not a duplicate set on the same one. A
data query would need to confirm: (a) no other caller of
`generateEpisodeFromEvent` reuses an existing `episode_id`, and (b) no
`scene_plans` rows exist today with the same `episode_id` appearing more
than 14 times (that would mean this guard has already been bypassed by
something this census didn't find).

**Orphaned-row question — answered from code:** `regenerate-episode`
(`worldEvents.js:1930-1936`) explicitly does *not* cascade-delete the old
episode's briefs/wardrobe/scene-plan rows, by comment:
> "We intentionally don't cascade-delete briefs / wardrobe / scene-plan
> because Sequelize paranoid will mask them via the same deleted_at and
> they'll be hidden from queries."

So every regeneration leaves the previous episode's 14 `scene_plans` rows
in the table, invisible through normal (paranoid-filtered) joins but
physically present, `episode_id`-keyed to a soft-deleted episode. Over
repeated regenerations of the same event, these accumulate. A data query
would need to confirm how many such orphaned rows currently exist.

**Readers only (not writers), for completeness:**
`src/routes/sceneSetRoutes.js:2408` — `SELECT ... FROM scene_plans sp` —
a read, not a writer.

**Lock/unlock (mutates existing rows, doesn't create/delete):**
- `episodeBriefRoutes.js:175-187` `POST /:episodeId/plan/:beatNumber/lock`
  — toggles `locked` on one row.
- `episodeBriefRoutes.js:191-198` `POST /:episodeId/plan/lock-all` —
  `ScenePlan.update({ locked: true }, { where: { episode_id } })`.

---

## 3. Script storage — every generator, what it writes, what it reads

Two storage locations exist for the script itself:

- **`episodes.script_content`** — flat text column on `Episode`. The
  older, simpler location. **This is the only field `evaluation.js`
  reads** (§4).
- **`episode_scripts` table / `EpisodeScript` model** — versioned,
  structured storage: `script_json` (array of beat objects) +
  a rendered `script_text`. Newer, more structured, not read by
  evaluation.

Four code paths write one or the other (a fifth reads-and-writes
`beat_outline`, a related but distinct field — see below):

**Generator 1 — `episodeScriptWriterService.generateEpisodeScript`**
(`src/services/episodeScriptWriterService.js:603`). Attempts to write a
versioned `EpisodeScript` row (`:653` `EpisodeScript.create({...})`),
then syncs `episode.script_content` for backwards compatibility
(`:689-692`, comment: "Also save to episode.script_content for backwards
compat"). **Correction (Task #1622, superseding the "already versions
scripts" claim this section made before):** issue #1619 found that
canon's live `episode_scripts` table matches neither of its two
`createTable` migrations and has no `script_text`/`script_json` columns
at all — the two fields this `EpisodeScript.create()` call sends. That
call is not wrapped in its own try/catch inside `generateEpisodeScript`;
a failure there propagates uncaught out of the function, meaning the
`:689-692` `episode.script_content` sync two lines later is never
reached either. The route that calls this generator
(`episodeScriptWriterRoutes.js:18-47`) does wrap the call in try/catch,
so the failure is not silent — it surfaces as a 500 response and a
`console.error` log — but as of #1619's finding, **this is the generator
most likely to be non-functional against production today**, not the
one other sections could safely assume already versions scripts. Reads:
the file's own header comment states its output is "Structured
script_json + rendered script_text" (`:16`); `loadScriptContext`
(exported alongside it, `:802`) is its context loader — not read in full
this census, flagged as a follow-up if the design work needs its exact
inputs. Called from exactly one route: `src/routes/episodeScriptWriterRoutes.js:36`.

**Generator 2 — `groundedScriptGeneratorService.generateGroundedScript`**
(`src/services/groundedScriptGeneratorService.js:56`). Does **not**
persist anything itself — grepped the file for
`script_content|EpisodeScript|\.update\(|\.create\(` and found nothing
but its own AI call (`:141`). Its caller,
`src/routes/episodeBriefRoutes.js:200-241` (`POST
/:episodeId/generate-script`), does the persisting, and only to
`episode.script_content` (`:224-234`) — **no `EpisodeScript` row is
created by this pipeline.** This is the generator whose route sits next
to the scene-plan lock/generate routes in `episodeBriefRoutes.js`, i.e.
the pipeline that's closest, today, to reading the Episode Plan /
`scene_plans` rows before writing a script — not yet confirmed whether it
actually reads `scene_plans` (not read in full this census; flagged as a
follow-up, since §8(j)'s ruling makes this the most load-bearing
generator to get right).

**Generator 3 — the script skeleton generator**
(`src/utils/scriptSkeletonGenerator.js:generateScriptSkeleton`). Takes a
raw `world_event` record (+ optional `characterState`/`intent`) — no
`scene_plans` or `canonicalBeats.js` dependency at all. Writes `##
BEAT: SNAKE_CASE_NAME` headers (`OPENING_RITUAL`, `CREATOR_WELCOME`, ...)
— its own independent beat vocabulary, matched by
`src/utils/scriptBeatParser.js`'s `BEAT_TYPES` reader (§5). Invoked
inline from `worldEvents.js` in three places — `:742-803` (`POST
.../generate-script`, a full skeleton write to `episode.script_content`
at `:803`), and inline inside `:1690-1746` (episode generation's optional
`draft_script`) and `:1852-1857` (`generate-episode-from-many`).

**Generator 4 (tag injection, not a full generator) — `worldEvents.js`'s
`/inject` route.** `:627` reads `episode.script_content`, appends
`[EVENT:]`/`[LOCATION_HINT:]` tags, `:654` writes it back
(`episode.update({ script_content: script.trim() })`). A fourth writer of
the same flat field, simpler than the other three — pure tag injection,
not beat generation.

**A fifth, related-but-distinct field:** `episode_briefs.beat_outline`
(JSONB, added by migration
`20260805000000-episode-brief-outfit-set-and-event-uniqueness.js`).
Migration comment: "AI-drafted beat outline at generate time:
`[{ beat_number, summary, dramatic_function }]`. Feeds the Suggest-Scenes
flow before any script exists." Not `scene_plans`, not
`episodes.script_content`, not `EpisodeScript` — a separate JSONB blob on
the brief, read directly by `EpisodeOverviewTab.jsx:308`
(`brief?.beat_outline`) for its "AI beat outline" panel (§5).

**Summary table:**

| Writer | Persists to | Creates `EpisodeScript`? | Reads `scene_plans`? |
|---|---|---|---|
| `episodeScriptWriterService.generateEpisodeScript` | Attempts `EpisodeScript`, likely fails against canon (#1619); `episode.script_content` sync is unreached if it does | Attempts, likely fails | Not confirmed — follow-up |
| `groundedScriptGeneratorService.generateGroundedScript` (via `episodeBriefRoutes.js`) | `episode.script_content` only | No | Not confirmed — follow-up |
| `scriptSkeletonGenerator.generateScriptSkeleton` (via `worldEvents.js`, 3 call sites) | `episode.script_content` only | No | No — reads raw `world_event` only |
| `worldEvents.js` `/inject` | `episode.script_content` only (tag append) | No | No |

Three of the four writers can overwrite `episode.script_content`
independently, with no versioning, no lock, and no mutual awareness of
which one ran last or what beat structure it used. **Task #1622**
closed the silent-loss risk that follows from that, without a schema
change: each of those three (`episodeScriptWriterService.generateEpisodeScript`,
`groundedScriptGeneratorService.generateGroundedScript`,
`scriptSkeletonGenerator.generateScriptSkeleton`) now refuses to replace
a non-empty `episode.script_content` unless the request carries an
explicit `confirmOverwrite: true` flag, returning `409
SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED` otherwise
(`src/utils/scriptOverwriteGuard.js`). The fourth, `/inject`, was left
unguarded on purpose — it modifies only its own `[EVENT:]`/
`[LOCATION_HINT:]` tag lines and preserves the rest of the script, so it
isn't the silent full-content-loss risk the other three are. This still
doesn't version anything — declining an overwrite loses nothing, but
confirming one still discards the prior text permanently, exactly as
before.

---

## 4. Evaluation's script-text dependencies — must-preserve for any format change

`src/routes/evaluation.js:255` — `const scriptContent = episode.script_content || '';`
Evaluation reads **only** `episodes.script_content`. It never reads
`EpisodeScript.script_json`/`script_text`, `scene_plans`, or
`episode_briefs.beat_outline`.

Grepped the whole file for `scriptContent\.match|script_content` —
exactly three hits, all load-bearing:

**`parseEventTag(scriptContent)`** (`:80-96`) — regex
`/\[EVENT:\s*(.+?)\]/i`, then parses `key="value"` / `key=value` pairs
out of the tag body into an object, numeric-coercing where possible.

**`parseIntentTag(scriptContent)`** (`:97-104`) — regex
`/\[EPISODE_INTENT:\s*"?([^"\]]+)"?\]/i`.

**`:255`** — the read of `episode.script_content` itself, feeding both
functions above.

These two tags — `[EVENT: key="value" ...]` and `[EPISODE_INTENT:
"..."]` — are **the entire script-text surface evaluation depends on.**
`evaluationFormula.js`'s `evaluate({state, event, style, intent, bonuses})`
(`:80-124`) takes already-parsed structured params; it does not itself
touch script text, so it imposes no additional format constraint beyond
what `evaluation.js` extracts.

**Must-preserve, in plain terms:** whatever a future script format looks
like, as long as it contains a `[EVENT: ...]` tag with the same key=value
grammar and an `[EPISODE_INTENT: "..."]` tag somewhere in the text
evaluation reads, scoring is unaffected. Beat structure, headers,
dialogue format, and everything else in `script_content` is free to
change without touching evaluation, *provided* these two tags survive in
this exact shape, in whatever field evaluation is pointed at (today,
`episode.script_content` specifically — pointing evaluation at a
different field is itself a change this census flags but does not
recommend).

---

## 5. Downstream consumers — how each identifies "which beat" today

**`scriptBeatParser.parseScript`** (`src/utils/scriptBeatParser.js`),
called from three routes in `src/routes/scriptParse.js`:
- `POST /api/v1/scripts/parse` — raw text in, Scene Plan JSON out, no
  persistence.
- `POST /api/v1/episodes/:id/parse-script` — reads
  `episode.script_content`, falls back to `EpisodeScript.content` if
  empty, no persistence.
- `POST /api/v1/episodes/:id/apply-scene-plan` — same read, but
  **creates rows in the `Scene`/`EpisodeScene` model** (`:265`
  `Scene.create(sceneData)`) — a **third** scene-shaped table, distinct
  from `scene_plans`/`ScenePlan`. Each created `Scene.metadata` JSONB
  stores `beat_type` (SNAKE_CASE, from `scriptBeatParser`'s own
  `BEAT_TYPES`) and `generated_from: 'script_beat_parser'`. Identifies
  "which beat" by **parse order and SNAKE_CASE label** (`opening_ritual`,
  `creator_welcome`, ...) matched against `scriptSkeletonGenerator.js`'s
  `## BEAT: SNAKE_CASE` headers — entirely independent of
  `canonicalBeats.js`'s numbering.

**`ScenePlannerPage.jsx`** (`:237`) — reads/locks `scene_plans` rows via
`beat.beat_number`, calling the lock route from §2. Identifies "which
beat" by the `ScenePlan.beat_number` field directly.

**`EpisodeScriptWriterPage.jsx`** (`:61-64, 277-279`) — reads
`activeScript.script_json` (the `EpisodeScript` array from Generator 1,
§3), each entry `beat.beat_number`/`beat.beat_name`, with a **local
fallback dict** `BEAT_NAMES[beat.beat_number - 1]` used when
`beat_name` is absent — a frontend-only beat-name list, separate from
every other one in this document.

**`EpisodeScriptTab.jsx`** — the most independent consumer found.
Ships its **own** client-side script-text parser, `parseScriptIntoBeats()`
(`:35-54`), regex-matching `## BEAT:` headers exactly like
`scriptBeatParser.js` does on the backend — a **third, separate
implementation** of the same parsing logic, with no shared code between
frontend and backend. Also ships its **own** hardcoded `BEAT_NAMES`
array (`:18-33`, 14 entries with icon/color, names matching the
canonical beat names) — a sixth beat-name list in the codebase. Falls
back to even splitting the script into 14 chunks by line count
(`:48-53`) if no `## BEAT:` headers are found at all. Cross-references
`scene_plans` rows by `scenePlan?.find(p => p.beat_number === beat.number)`
(`:100`) — note the property name mismatch: the parsed object uses
`beat.number`, `ScenePlan` rows use `beat_number`; the code handles this
correctly today by naming both sides explicitly, but it's a naming
inconsistency worth flagging for any refactor.

**`EpisodeOverviewTab.jsx`** (`:308, 916-923`) — reads
`brief?.beat_outline` directly (the `episode_briefs.beat_outline` JSONB
field from §3) for its "AI beat outline" panel. Identifies "which beat"
by `beat.beat_number` with a fallback to array index + 1
(`` `Beat ${beat.beat_number || i + 1}` ``).

**`SceneSuggestionReview.jsx`** — reads a `proposal.beats` array whose
shape (`{ beat_number, beat_summary, scene_set_id, ... }`) comes from
`POST /api/v1/episodes/:episodeId/suggest-scenes`
(`src/routes/episodes.js:1153-1282`). **This route is a sixth,
previously-unrecorded independent beat source:** it sends
`episode.script_content` to a fresh Claude call with the instruction
"Break the script into 3-12 beats (one major story moment per beat)"
(`:1205`) and gets back an AI-invented beat count and boundaries, wholly
unrelated to the 14 canonical beats, to `scene_plans`, or to any other
vocabulary in this document. It does not mutate anything (per its own
code comment, `:1157`) — purely a same-request proposal for scene-set
matching, discarded if not approved.

**`NarrativeControlCenter.jsx`'s "Beats" tab** (`:918-1057`, "Chapter
beat generation & book outline") — reads a `beats`/`beats.beats` state
from `/tier/generate-book-outline`-adjacent endpoints. **Excluded from
this census as homonymous, not related:** this is the JustAWoman memoir
novel's Story Engine chapter-beat concept, a completely different
product surface from SAL episode script beats. Recorded here only so a
future reader doesn't mistake it for a seventh SAL beat vocabulary.

**`CharacterClip.beat_id`** (`src/models/CharacterClip.js:36-46`) —
nullable UUID FK, `references: { model: 'beats', key: 'id' }`. Confirmed
by reading the field definition in full: this targets a `beats` table
belonging to the separate Phase 2.5 Animatic System, **not**
`canonicalBeats.js` and **not** `scene_plans`. Grepped
`CharacterClip.js`/`characterClipController.js` for
`beat_number|scene_plan_id|ScenePlan` — no matches. Character Clips has
no linkage today to the canonical beat numbering or to `scene_plans`.

**Timeline** (`src/routes/timelineData.js`, `src/models/TimelineData.js`)
— grepped both for any `beat`-related term (case-insensitive) — no
matches in either file. Timeline has no beat linkage found in this
census; if one exists, it's not in these two files.

**Phone / overlays** (`src/services/phoneRuntime.js`,
`frontend/src/lib/phoneRuntime.js`) — both expose a generic
`resolveKey('beat_number', ctx)` passthrough (backend and frontend
mirror each other). Neither hardcodes or depends on any specific beat
vocabulary; they read whatever `beatNumber`/`episodeBeat` is already on
the context object handed to them, sourced elsewhere.

**Downstream-consumer summary — six independent identification schemes
found:**

| Consumer | Identifies "which beat" by |
|---|---|
| `scriptBeatParser`/`apply-scene-plan` → `Scene.metadata` | Parse order + SNAKE_CASE label from `## BEAT:` headers |
| `ScenePlannerPage.jsx` | `ScenePlan.beat_number` (direct) |
| `EpisodeScriptWriterPage.jsx` | `EpisodeScript.script_json[].beat_number`, name via local `BEAT_NAMES` fallback |
| `EpisodeScriptTab.jsx` | Its own regex parse of `## BEAT:` headers + its own `BEAT_NAMES`, cross-referenced to `scene_plans` by number |
| `EpisodeOverviewTab.jsx` | `episode_briefs.beat_outline[].beat_number` |
| `SceneSuggestionReview.jsx` (via `suggest-scenes`) | AI-invented 3-12 beat segmentation, no persistence, no relation to canonical numbering |

---

## 6. Open design questions

Not answered here, per this task's scope.

1. Should the 14 `ScenePlan` rows become the episode's beat spine — one
   row per canonical beat, carrying location/scene set — with the script
   filling each row in, rather than the script inventing its own beats?
   Or should scene plans be created *from* a finished script instead?
   (Evoni's own framing, explicitly provisional: "worth deciding after we
   see how things actually behave, not before.")
2. If `scene_plans` becomes the spine, what happens to Writer B's
   guardless raw-INSERT path (§2) and to the orphaned rows regeneration
   already leaves behind? Does becoming the spine imply Writer B needs a
   delete-first step like Writer A's, or does the spine relationship
   itself remove the need for Writer B to exist as a separate path?
3. Of the two script storage locations (§3) — flat `episode.script_content`
   vs. versioned `EpisodeScript.script_json`/`script_text` — does the
   generation-contract ruling (§8(j)) imply consolidating on one? Three
   of four writers use the flat field only; only one writer produces a
   versioned row. Evaluation is pinned to the flat field today (§4) —
   does that pin move, or does the flat field stay the evaluation-facing
   projection regardless of what else changes?
4. Given §4's finding that only two tags (`[EVENT:]`, `[EPISODE_INTENT:]`)
   are load-bearing for evaluation, and everything else in script text is
   free to change — what should a script beat's on-the-wire
   representation carry, if it's to keep its canonical beat number/key
   per the §8(j) ruling? A header convention like the existing `##
   BEAT:` pattern, extended to carry a canonical number instead of (or
   alongside) a SNAKE_CASE name? Something structured instead of
   text-embedded?
5. `scriptBeatParser`'s SNAKE_CASE `BEAT_TYPES` and
   `scriptSkeletonGenerator`'s matching headers are a self-consistent
   writer/reader pair today, independent of `canonicalBeats.js`. Does
   bringing them under the canonical contract mean remapping their 12
   types onto the 14 canonical beats (not a 1:1 count), replacing them
   outright, or leaving this pair as one valid rendering *of* the
   canonical beats (satisfying §8(j) by carrying the canonical number
   alongside the existing SNAKE_CASE name, rather than replacing it)?
6. `EpisodeScriptTab.jsx`'s independent frontend parser and `BEAT_NAMES`
   list (§5) duplicate backend logic with no shared source. If the script
   format changes, this file needs a matching change with nothing to
   enforce that today. Does closing that gap mean the frontend consumes
   parsed beats from an API instead of parsing script text itself?
7. `suggest-scenes` (§5) deliberately invents its own beat count (3-12,
   AI-chosen) for scene-set matching and persists nothing. Is that
   independence intentional and fine to keep as-is (a lightweight,
   throwaway proposal tool), or should it also read the 14 canonical
   beats once they're the contract, so its scene-set suggestions line up
   1:1 with `scene_plans` rows instead of an AI-chosen count that may not
   match?
8. `episode_briefs.beat_outline` (§3) is an AI-drafted beat outline
   captured *before* any script exists, in its own JSONB shape
   (`beat_number, summary, dramatic_function`) distinct from both
   `scene_plans` and the script. Does this become redundant once the 14
   canonical beats are instantiated at Episode Plan time (per §8(j)), or
   does it serve a genuinely different purpose (a lighter-weight preview
   before the heavier scene-plan/script machinery runs) worth keeping
   alongside the spine?
9. Three of four script writers (§3) can overwrite
   `episode.script_content` independently with no versioning and no lock.
   Does structuring script beats around the canonical spine also imply
   resolving this — e.g. all writers going through one entry point — or
   is that a separate concern from the beat-structure question this
   census was scoped to?
