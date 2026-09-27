# F-Stats-1 Phase B — Reads Slice, `memories/core.js`

*Standalone note. Reads every read site in `src/routes/memories/core.js` and
classifies each under the rule `F-Stats-1_ReadsSlice_episodes_2026-09-27.md`
stated, applied unchanged. Mints nothing, rules nothing, closes nothing.*

## Purpose

`F-Stats-1_ReadsSlice_upgradeRoutes_2026-09-27.md` (#2054) named
`memories/core.js` as the file after it in the scoping note's §3 table
(`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md`, #2000). This note reads it,
following the earlier slices' layout. Closing the reads slice still takes a
Fix Plan revision; this note is input to it.

## H1 — Basis

```
$ git rev-parse origin/main
b6a99deccce044e886055addb20f4fbe364a6e1b
```

MEASURED. Date: 2026-09-27. Every `file:line` below is at this SHA unless it
names the scoping note's basis, `7a17a2e7`. Unqualified `:N` means
`src/routes/memories/core.js:N`.

## The rule — cited, applied unchanged

The rule is the episodes.js slice's "The rule" and "Adapted for reads"
(`F-Stats-1_ReadsSlice_episodes_2026-09-27.md:51–94`), not restated here. A
site is an **instance** when (1) the rows it acts on are chosen by an
identifier the caller supplies; (2) the table is show-partitioned; (3) no
tenant value applies at any layer; and (4) the response carries data selected
through the read, including values derived from it. A read that only gates is
not an instance (a note); "cannot tell" is reserved for a site whose
conditions depend on code not read. Condition 2 is tested as the
calendarRoutes.js slice tested it (its §0.2): does the table carry a show,
directly or through a parent in code (a foreign key, or a model association).
As in the calendarRoutes.js slice (#10), a read keyed by a value taken from a
caller-chosen row counts as chosen by the caller.

## §0. The conditions at this basis

### §0.1 Condition 3 — MEASURED

Nothing in the request path supplies a tenant.

- **The mount** (§2): the global layers the earlier slices named, the two
  `/api` rate limiters, and thirteen routers mounted at bare `/api/v1` before
  `app.js:1024`. None has a router-level layer or answers any of this file's
  paths (§2). No router is mounted at `/api/v1/memories` before this one.
  `attachRBAC` (`src/middleware/rbac.js:193`) resolves no show.
- **The hub and the router:** `memories/index.js` mounts `core.js` first, at
  `/`, with no layer of its own before it; `core.js` has no router-level
  layer. All ten routes carry `requireAuth`; four add `aiRateLimiter`. Neither
  resolves a show:

```
$ git show b6a99dec:src/middleware/auth.js | grep -n -i "show"; echo "exit=$?"
exit=1
```

- **No handler takes a show.** No route reads a show id from the request, and
  no read filters on one. Every book, chapter, line, memory and character is
  addressed by its own id or by a key taken from a row the caller chose.
  `Show` has no owner column to check a caller against (the episodes.js slice
  §"Condition 3").
- **Model scopes:** none of the models involved defines a `defaultScope`
  (Script 2, §2).

So condition 3 holds for every read in this file.

### §0.2 Condition 2 — per table — MEASURED

Every table this file reads carries a show, directly or through a chain of
model associations:

```
StorytellerMemory (storyteller_memories): show_id=false | *_id=line_id,character_id | associations=line->StorytellerLine BelongsTo(line_id), character->RegistryCharacter BelongsTo(character_id) | defaultScope={}
StorytellerLine (storyteller_lines): show_id=false | *_id=chapter_id | associations=chapter->StorytellerChapter BelongsTo(chapter_id), memories->StorytellerMemory HasMany(line_id) | defaultScope={}
StorytellerChapter (storyteller_chapters): show_id=false | *_id=book_id,primary_character_id | associations=book->StorytellerBook BelongsTo(book_id), lines->StorytellerLine HasMany(chapter_id) | defaultScope={}
StorytellerBook (storyteller_books): show_id=true | *_id=show_id,series_id | associations=show->Show BelongsTo(show_id), chapters->StorytellerChapter HasMany(book_id), series->BookSeries BelongsTo(series_id) | defaultScope={}
RegistryCharacter (registry_characters): show_id=false | *_id=registry_id,feed_profile_id,world_character_id | associations=memories->StorytellerMemory HasMany(character_id), registry->CharacterRegistry BelongsTo(registry_id), socialProfiles->SocialProfile HasMany(registry_character_id), followProfiles->CharacterFollowProfile HasMany(registry_character_id) | defaultScope={}
CharacterRegistry (character_registries): show_id=true | *_id=show_id | associations=show->Show BelongsTo(show_id), characters->RegistryCharacter HasMany(registry_id) | defaultScope={}
BookSeries (book_series): show_id=true | *_id=universe_id,show_id,protagonist_id | associations=universe->Universe BelongsTo(universe_id), books->StorytellerBook HasMany(series_id), show->Show BelongsTo(show_id) | defaultScope={}
Universe (universes): show_id=false | *_id=(none) | associations=series->BookSeries HasMany(universe_id), shows->Show HasMany(universe_id) | defaultScope={}
```

| Table | Model citation | Carries a show? | Condition 2 |
| --- | --- | --- | --- |
| `storyteller_books` | `StorytellerBook.js:135` | **Directly:** `show_id`, `belongsTo(Show)` (`:143`) | **Met** |
| `storyteller_chapters` | `StorytellerChapter.js:124` | **Through its book:** `belongsTo(StorytellerBook)` on `book_id` (`:132`) | **Met** |
| `storyteller_lines` | `StorytellerLine.js:60` | **Through its chapter:** `belongsTo(StorytellerChapter)` on `chapter_id` (`:68`) | **Met** |
| `storyteller_memories` | `StorytellerMemory.js:153` | **Through its line** (`belongsTo(StorytellerLine)`, `:163`) **and, once confirmed, its character** (`belongsTo(RegistryCharacter)`, `:170`) | **Met** |
| `registry_characters` | `RegistryCharacter.js:644` | **Through its registry:** `belongsTo(CharacterRegistry)` on `registry_id` (`:666`); `character_registries` carries `show_id` (`CharacterRegistry.js:51`) | **Met** |

`buildUniverseContext` (§4) also reads `book_series`, which carries
`show_id`, and `universes`, which does not (Script 2).

## §1. The probe, re-run and reconciled — MEASURED

```
$ ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('; SQL='\bSELECT\b'; QT='QueryTypes\.SELECT'; REQ='req\.(params|body|query)'; for b in 7a17a2e7 b6a99dec; do f=$(git show $b:src/routes/memories/core.js); echo "$b lines=$(echo "$f" | wc -l) orm=$(echo "$f" | grep -cE "$ORM") select=$(echo "$f" | grep -E "$SQL" | grep -vcE "$QT") req=$(echo "$f" | grep -E "$ORM|$SQL" | grep -vE "$QT" | grep -cE "$REQ")"; done
7a17a2e7 lines=761 orm=15 select=0 req=0
b6a99dec lines=761 orm=15 select=0 req=0
$ git diff --quiet 7a17a2e7 b6a99dec -- src/routes/memories/core.js && echo identical
identical
$ git log --oneline 7a17a2e7..b6a99dec -- src/routes/memories/core.js
```

**Reconciliation with the scoping note's 15** (§3 row: `15 0 15 0`): the file
is byte-identical to the note's basis; no site was added, removed or moved.
The 15 sites:

```
$ ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('; SQL='\bSELECT\b'; QT='QueryTypes\.SELECT'; git show b6a99dec:src/routes/memories/core.js | grep -nE "$ORM|$SQL" | grep -vE "$QT"
103:    const memories = await StorytellerMemory.findAll({
138:    const line = await StorytellerLine.findByPk(lineId);
161:    const chapter = await StorytellerChapter.findOne({ where: { id: line.chapter_id } });
244:    const book = await StorytellerBook.findByPk(bookId);
250:    const chapters = await StorytellerChapter.findAll({
382:    const memory = await StorytellerMemory.findByPk(memoryId);
392:    const character = await RegistryCharacter.findByPk(character_id);
443:      memory: await StorytellerMemory.findByPk(memoryId),
463:    const memory = await StorytellerMemory.findByPk(memoryId);
495:    const memory = await StorytellerMemory.findByPk(memoryId);
508:    res.json({ memory: await StorytellerMemory.findByPk(memoryId) });
525:    const memories = await StorytellerMemory.findAll({
557:    const book = await StorytellerBook.findByPk(bookId, {
630:    const book = await StorytellerBook.findByPk(bookId, {
660:        const memories = await StorytellerMemory.findAll({
```

None names `req.*` on the same line: every handler destructures its ids from
`req.params` or `req.body` on an earlier line (`const { lineId } = req.params`
and the like). The probe's "floor" of 0 is therefore no signal here; eleven
of the fifteen reads are keyed by a caller value (§3). There is no raw
`SELECT`.

## §2. Mount and auth, re-checked at this basis — MEASURED

### The mount

```
$ git show b6a99dec:src/app.js | grep -n -E "memoriesRoutes|'/api/v1/memories'"
1023:  const memoriesRoutes = require('./routes/memories');
1024:  app.use('/api/v1/memories', memoriesRoutes);
1033:  app.use('/api/v1/memories', scriptFromBook);
1042:  app.use('/api/v1/memories', storyEvaluationRoutes);
1078:  app.use('/api/v1/memories', sceneProposeRoute);
1087:  app.use('/api/v1/memories', characterGrowthRoute);
1096:  app.use('/api/v1/memories', episodeOrchestrationRoute);
1105:  app.use('/api/v1/memories', eventGeneratorRoute);
$ git show b6a99dec:src/app.js | sed -n 1021,1028p
// Memory Bank routes (PNOS Storyteller Memories — Phase 1)
try {
  const memoriesRoutes = require('./routes/memories');
  app.use('/api/v1/memories', memoriesRoutes);
  console.log('✓ Memories routes loaded at /api/v1/memories');
} catch (e) {
  console.error('✗ Failed to load Memories routes:', e.message);
}
```

| Mount | Router | Middleware on the mount | Condition |
| --- | --- | --- | --- |
| `app.js:1024` | `memoriesRoutes` (`routes/memories/index.js`) | none | inside `try` (`:1022–1028`): mounted only if the `require` succeeds |
| `memories/index.js` | `core` (`routes/memories/core.js`), at `/` | none | the hub's first layer |

It is the first of seven routers mounted at `/api/v1/memories`; the other six
(`:1033`–`:1105`) come after it. The hub mounts eight sub-routers, `core`
first:

```
$ git show b6a99dec:src/routes/memories/index.js | grep -n "router.use"
18:router.use('/', require('./core'));          // Memory extraction, confirm, CRUD, scenes
19:router.use('/', require('./interview'));     // Scene interview, narrative intelligence, character interviews
20:router.use('/', require('./voice'));         // Voice sessions, career echoes, chapter drafts
21:router.use('/', require('./stories'));       // Story write/edit/continue/deepen/nudge
22:router.use('/', require('./planning'));      // Prose critique, scene planner, outlines, planner chat
23:router.use('/', require('./assistant'));     // Amber AI assistant, recycle bin
24:router.use('/', require('./engine'));        // Story engine, tasks, generation, pipeline, batch
25:router.use('/', require('./extras'));        // Prose style, dramatic irony, intimate scenes, prompt enhance
```

### What runs before `app.js:1024`

```
$ git show b6a99dec:src/app.js | awk 'NR<1024' | grep -n -E "app\.(use|all|get|post|put|delete)\(" | grep -v -E "app\.(use|all|get|post|put|delete)\('/api/v1/[a-z]" | grep -v "^\s*[0-9]*:\s*//"
138:app.get('/ping', (req, res) => {
204:app.use(cors(corsOptions));
211:  app.use((req, res, next) => {
218:app.use(
224:app.use(express.json({ limit: '10mb', type: 'application/json' }));
225:app.use(express.urlencoded({ limit: '10mb', extended: true }));
246:app.use(attachRBAC);
249:app.use(captureResponseData);
264:app.use('/api', apiLimiter);
275:app.use('/api', (req, res, next) => {
360:app.get('/health', async (req, res) => {
370:app.get('/_diag/health', async (req, res) => {
756:  app.use('/api/v1', markerRoutes);
765:  app.use('/api/v1', exportRoutes);
777:  app.use('/api/v1', beatRoutes);
778:  app.use('/api/v1', characterClipRoutes);
779:  app.use('/api/v1', audioClipRoutes);
780:  app.use('/api/v1', animaticRoutes);
803:app.use('/api/v1', evaluationRoutes);
807:app.use('/api/v1', worldRoutes);
811:app.use('/api/v1', worldEventRoutes);
817:  app.use('/api/v1', eventDeliverableRoutes);
825:app.use('/api/v1', worldStudioRoutes);
830:  app.use('/api/v1', careerGoalRoutes);
839:  app.use('/api/v1', arcRoutes);
869:app.use('/api/scripts', scriptAnalysisRoutes);
882:app.use('/api/footage', footageRoutes);
885:app.use('/api/scene-links', sceneLinksRoutes);
925:  app.use('/api/decision-analytics', decisionAnalyticsRoutes);
965:  app.use('/api/youtube', youtubeRoutes);
```

`:204`–`:275` are the global layers and limiters the earlier slices named;
`:138`, `:360`, `:370` are exact paths; `:869`–`:965` are other prefixes.
None resolves a show. **Thirteen routers are mounted at bare `/api/v1` before
`:1024`**; Script 1 tests whether any of them answers a `/memories/…` path
first or runs router-level middleware on it. Routers mounted at another
`/api/v1/<prefix>` cannot match a `/api/v1/memories/…` path.

### Which router answers each path, and auth on each route

Method as in the earlier slices: load the real routers in Node and use
Express's own layer matching. Two scripts, each run from the checkout as
`node <scratch>/<script> <scratch>/<outfile>`; neither is committed. `<repo>`
and `<scratch>` stand for the checkout's and the scratchpad's absolute paths,
and are the only abbreviations in the transcripts.

**Script 1** is the upgradeRoutes.js slice's Script 1 with the router under
test and the earlier-router list changed, and two additions: it lists the
memories hub's layers in order and checks that `core` is the first layer to
match each of its own paths, and it tests the earlier bare `/api/v1` routers
with each path prefixed by `/memories`, as they would see it:

```js
// Loads memories/core.js, the memories hub (memories/index.js) and every router
// mounted at bare /api/v1 before app.js:1024, and asks Express's own layers
// which of them would handle each core.js path first (Task #2056).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const path = require('path');
const root = '<repo>/src/routes/';
const earlier = [
  [756, 'markers'], [765, 'export'], [777, 'beats'], [778, 'character-clips'], [779, 'audio-clips'],
  [780, 'animatic'], [803, 'evaluation'], [807, 'world'], [811, 'worldEvents'], [817, 'eventDeliverables'],
  [825, 'worldStudio'], [830, 'careerGoals'], [839, 'arcRoutes'],
];
const U = '00000000-0000-4000-8000-000000000000';
const core = require(path.join(root, 'memories/core'));
const hub = require(path.join(root, 'memories'));
const rows = core.stack.filter(l => l.route).map(l => ({
  m: Object.keys(l.route.methods).map(x => x.toUpperCase()), p: l.route.path,
  mw: l.route.stack.map(s => s.name || '<anon>'),
}));
const out = [];
out.push('core routes ' + rows.length + '; non-route layers: ' + JSON.stringify(core.stack.filter(l => !l.route).map(l => l.name || '<anon>')));
rows.forEach(r => out.push('  ' + r.m.join(',') + ' ' + r.p + ' [' + r.mw.join(', ') + ']'));
const self = [];
rows.forEach(r => {
  const sample = r.p.replace(/:[A-Za-z_]+/g, U);
  for (const m of r.m) {
    const hit = core.stack.find(l => l.route && l.route.methods[m.toLowerCase()] && l.match(sample));
    if (!hit || hit.route.path !== r.p) self.push(m + ' ' + sample + ' -> ' + (hit ? hit.route.path : null));
  }
});
out.push('core paths answered by a different core route: ' + self.length);
self.forEach(x => out.push('  ' + x));
out.push('control GET /books/' + U + '/scenes -> ' + (core.stack.find(l => l.route && l.route.methods.get && l.match('/books/' + U + '/scenes')) || { route: { path: null } }).route.path);
out.push('control GET /no-such-route -> ' + (core.stack.find(l => l.route && l.route.methods.get && l.match('/no-such-route')) || { route: { path: null } }).route.path);
// The hub: which of its layers is first to match each core path, and is it core?
out.push('memories hub layers (in order):');
hub.stack.forEach((l, i) => out.push('  ' + i + ' ' + (l.route ? 'route ' + l.route.path : 'use ' + (l.handle === core ? 'core' : (l.name || '<anon>')))));
const notCoreFirst = [];
rows.forEach(r => {
  const sample = r.p.replace(/:[A-Za-z_]+/g, U);
  const first = hub.stack.find(l => l.match(sample));
  if (!first || first.handle !== core) notCoreFirst.push(r.p);
});
out.push('core paths whose first matching hub layer is not core: ' + notCoreFirst.length);
out.push('earlier bare /api/v1 routers (tested with the /memories prefix):');
for (const [line, name] of earlier) {
  let r; try { r = require(path.join(root, name)); } catch (e) { out.push('  ' + line + ' ' + name + ' LOAD ERROR ' + e.message.split('\n')[0]); continue; }
  const uses = r.stack.filter(l => !l.route); const routes = r.stack.filter(l => l.route);
  const hits = []; const useHits = new Set();
  for (const c of rows) {
    const full = '/memories' + c.p.replace(/:[A-Za-z_]+/g, U);
    uses.filter(l => l.match(full)).forEach(l => useHits.add(l.name || '<anon>'));
    for (const m of c.m) {
      const h = routes.find(l => l.route.methods[m.toLowerCase()] && l.match(full));
      if (h) hits.push(m + ' ' + full + ' -> ' + h.route.path);
    }
  }
  out.push('  ' + line + ' ' + name + ': routes=' + routes.length + ' nonRouteLayers=' + uses.length + ' nonRouteMatchingCore=' + JSON.stringify([...useHits]) + ' routeHits=' + hits.length);
  hits.forEach(h => out.push('    HIT ' + h));
}
{ const we = require(path.join(root, 'worldEvents')); const first = we.stack.find(l => l.route);
  const sample = first.route.path.replace(/:[A-Za-z_]+/g, U); const m = Object.keys(first.route.methods)[0];
  const h = we.stack.find(l => l.route && l.route.methods[m] && l.match(sample));
  out.push('control worldEvents ' + m.toUpperCase() + ' ' + sample + ' -> ' + (h ? h.route.path : null)); }
require('fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
setTimeout(() => process.exit(0), 50);
```

```
$ cd <repo> && node <scratch>/mc1.js <scratch>/mc1.out >/dev/null 2>&1; echo exit=$?; cat <scratch>/mc1.out
exit=0
core routes 10; non-route layers: []
  POST /structure-universe [requireAuth, <anonymous>, <anonymous>]
  GET /lines/:lineId/memories [requireAuth, <anonymous>]
  POST /lines/:lineId/extract [requireAuth, <anonymous>, <anonymous>]
  POST /books/:bookId/extract-all [requireAuth, <anonymous>, <anonymous>]
  POST /memories/:memoryId/confirm [requireAuth, <anonymous>]
  POST /memories/:memoryId/dismiss [requireAuth, <anonymous>, <anonymous>]
  PUT /memories/:memoryId [requireAuth, <anonymous>]
  GET /characters/:charId/memories [requireAuth, <anonymous>]
  GET /books/:bookId/memories/pending [requireAuth, <anonymous>]
  GET /books/:bookId/scenes [requireAuth, <anonymous>]
core paths answered by a different core route: 0
control GET /books/00000000-0000-4000-8000-000000000000/scenes -> /books/:bookId/scenes
control GET /no-such-route -> null
memories hub layers (in order):
  0 use core
  1 use router
  2 use router
  3 use router
  4 use router
  5 use router
  6 use router
  7 use router
core paths whose first matching hub layer is not core: 0
earlier bare /api/v1 routers (tested with the /memories prefix):
  756 markers: routes=7 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  765 export: routes=6 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  777 beats: routes=5 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  778 character-clips: routes=5 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  779 audio-clips: routes=5 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  780 animatic: routes=6 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  803 evaluation: routes=6 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  807 world: routes=4 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  811 worldEvents: routes=63 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  817 eventDeliverables: routes=5 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  825 worldStudio: routes=53 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  830 careerGoals: routes=7 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
  839 arcRoutes: routes=7 nonRouteLayers=0 nonRouteMatchingCore=[] routeHits=0
control worldEvents GET /world/00000000-0000-4000-8000-000000000000/events -> /world/:showId/events
```

- **All ten paths are answered by this router's own route** (0 answered by a
  different route of its own; the controls resolve a real path and reject an
  undefined one), and `core` is the first hub layer to match every one.
- **No earlier bare `/api/v1` router answers any of them first**, and none
  has a router-level layer.
- **Auth:** all 10 routes carry `requireAuth`. The second anonymous function
  on `/structure-universe`, `/lines/:lineId/extract`,
  `/books/:bookId/extract-all` and `/memories/:memoryId/dismiss` is
  `aiRateLimiter` (`:31`, `:132`, `:239`, `:459`). No router-level layer.
- **No input validation** on `:lineId`, `:bookId`, `:memoryId` or `:charId`:
  no route carries `validateUUIDParam`.

**Script 2** loads the model registry and reports the eight models' show
columns, foreign keys, associations and default scopes. It issues no query
(`src/models/index.js` authenticates only from its exported
`authenticate`/`healthCheck`, which the script does not call):

```js
// Loads the model registry (no query is issued) and reports, for the models
// memories/core.js and buildUniverseContext read, whether each has a show
// column, its foreign keys, associations and default scope (Task #2056).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const m = require('<repo>/src/models');
const out = [];
for (const n of ['StorytellerMemory', 'StorytellerLine', 'StorytellerChapter', 'StorytellerBook', 'RegistryCharacter', 'CharacterRegistry', 'BookSeries', 'Universe']) {
  const M = m[n];
  if (!M) { out.push(n + ': not exported by src/models'); continue; }
  const a = M.rawAttributes;
  out.push(n + ' (' + M.getTableName() + '): show_id=' + !!a.show_id
    + ' | *_id=' + (Object.keys(a).filter(k => /_id$/.test(k)).join(',') || '(none)')
    + ' | associations=' + (Object.entries(M.associations).map(([k, v]) => k + '->' + v.target.name + ' ' + v.associationType + '(' + v.foreignKey + ')').join(', ') || '(none)')
    + ' | defaultScope=' + JSON.stringify(M._scope || {}));
}
require('fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
setTimeout(() => process.exit(0), 50);
```

```
$ cd <repo> && node <scratch>/mc2.js <scratch>/mc2.out >/dev/null 2>&1; echo exit=$?; cat <scratch>/mc2.out
exit=0
StorytellerMemory (storyteller_memories): show_id=false | *_id=line_id,character_id | associations=line->StorytellerLine BelongsTo(line_id), character->RegistryCharacter BelongsTo(character_id) | defaultScope={}
StorytellerLine (storyteller_lines): show_id=false | *_id=chapter_id | associations=chapter->StorytellerChapter BelongsTo(chapter_id), memories->StorytellerMemory HasMany(line_id) | defaultScope={}
StorytellerChapter (storyteller_chapters): show_id=false | *_id=book_id,primary_character_id | associations=book->StorytellerBook BelongsTo(book_id), lines->StorytellerLine HasMany(chapter_id) | defaultScope={}
StorytellerBook (storyteller_books): show_id=true | *_id=show_id,series_id | associations=show->Show BelongsTo(show_id), chapters->StorytellerChapter HasMany(book_id), series->BookSeries BelongsTo(series_id) | defaultScope={}
RegistryCharacter (registry_characters): show_id=false | *_id=registry_id,feed_profile_id,world_character_id | associations=memories->StorytellerMemory HasMany(character_id), registry->CharacterRegistry BelongsTo(registry_id), socialProfiles->SocialProfile HasMany(registry_character_id), followProfiles->CharacterFollowProfile HasMany(registry_character_id) | defaultScope={}
CharacterRegistry (character_registries): show_id=true | *_id=show_id | associations=show->Show BelongsTo(show_id), characters->RegistryCharacter HasMany(registry_id) | defaultScope={}
BookSeries (book_series): show_id=true | *_id=universe_id,show_id,protagonist_id | associations=universe->Universe BelongsTo(universe_id), books->StorytellerBook HasMany(series_id), show->Show BelongsTo(show_id) | defaultScope={}
Universe (universes): show_id=false | *_id=(none) | associations=series->BookSeries HasMany(universe_id), shows->Show HasMany(universe_id) | defaultScope={}
```

## §3. The sites — one row each

Paths are relative to `/api/v1/memories`. "Scope" answers condition 3 (never
met; §0.1). "Returns" answers condition 4. Condition 2 is met for every table
(§0.2).

| # | Site | Handler | Reads | Id source | Scope | Returns (condition 4) | Auth | Classification — reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `:103` | `GET /lines/:lineId/memories` (`:99`) | `StorytellerMemory` where `line_id`, with `RegistryCharacter` (`character`: `id`, `display_name`, `role_type`) | `req.params.lineId` (`:101`) | none | every memory on that line, each with its character's three fields (`:116`) | `requireAuth` | **Instance** — memories and character names on any show's line, chosen by a caller-supplied line id |
| 2 | `:138` | `POST /lines/:lineId/extract` (`:132`) | `StorytellerLine` by pk | `req.params.lineId` (`:134`) | none | the line's `status` in a 400 (`:145-148`); otherwise the line's `text` goes into the model prompt (`:166`) and the response returns the memories created from the model's output (`:216-220`) | `requireAuth`, `aiRateLimiter` | **Instance** — a show-partitioned line chosen by the caller; its status is returned directly, and memories derived from its text are returned (that they reflect the text is INFERRED: model output). The handler also writes those memories onto the line (`:195-214`) |
| 3 | `:161` | as #2 | `StorytellerChapter` where `id` | `line.chapter_id`, from #2's caller-chosen line | none | its `book_id` goes to `buildUniverseContext` (§4), whose book, series and universe text is prepended to the prompt (`:163`, `:166`); the memories returned are model output from it | as #2 | **Instance** — a chapter reached through a caller-chosen line; values derived from it and its book reach the response (INFERRED: model output) |
| 4 | `:244` | `POST /books/:bookId/extract-all` (`:239`) | `StorytellerBook` by pk | `req.params.bookId` (`:241`) | none | nothing from the row; 404 if missing (`:245-247`) | `requireAuth`, `aiRateLimiter` | **Not an instance** — gates the handler. Note: existence |
| 5 | `:250` | as #4 | `StorytellerChapter` where `book_id`, with their approved or edited `StorytellerLine`s | `req.params.bookId` | none | the id of every eligible line in that book, each with its extraction status and count, and the total (`:311`, `:338`, `:342`, `:347-353`). The handler also sends each line's text to the model and writes memories onto it (`:292`, `:317-336`) | as #4 | **Instance** — any show's line ids and extraction results, chosen by a caller-supplied book id |
| 6 | `:382` | `POST /memories/:memoryId/confirm` (`:373`) | `StorytellerMemory` by pk | `req.params.memoryId` (`:375`) | none | 404 if missing, 409 if already confirmed (`:383-389`); its `type` and `statement` are written into the character (`:417-421`); the response's memory comes from #8 | `requireAuth` | **Not an instance** — gates the confirm (the returning read is #8). Note: existence and confirmed state |
| 7 | `:392` | as #6 | `RegistryCharacter` by pk | `req.body.character_id` (`:376`) | none | 404 if missing (`:393-395`); the response echoes only the caller's `character_id` (`:442-446`) | as #6 | **Not an instance** — gates the write. Note: existence; and the handler then writes into that character (see "Observed, not ruled") |
| 8 | `:443` | as #6 | `StorytellerMemory` by pk, again | `req.params.memoryId` | none | the memory after the update: `line_id`, `type`, `tags`, `source_*` and the rest (`:442-446`) | as #6 | **Instance** — the memory of any show's line, chosen by the caller, returned with fields the caller did not send |
| 9 | `:463` | `POST /memories/:memoryId/dismiss` (`:459`) | `StorytellerMemory` by pk | `req.params.memoryId` (`:461`) | none | 404 if missing, 409 if confirmed (`:464-472`); then `{ dismissed, memory_id }` (`:475`) | `requireAuth`, `aiRateLimiter` | **Not an instance** — gates the hard delete (`:474`). Note: existence and confirmed state |
| 10 | `:495` | `PUT /memories/:memoryId` (`:490`) | `StorytellerMemory` by pk | `req.params.memoryId` (`:492`) | none | 404 if missing (`:496-498`); the response's memory comes from #11 | `requireAuth` | **Not an instance** — gates the update. Note: existence |
| 11 | `:508` | as #10 | `StorytellerMemory` by pk, again | `req.params.memoryId` | none | the memory after `update`, with every field the body did not set (`:508`) | as #10 | **Instance** — any show's memory, chosen by the caller, returned whole |
| 12 | `:525` | `GET /characters/:charId/memories` (`:521`) | `StorytellerMemory` where `character_id`, confirmed | `req.params.charId` (`:523`) | none | every confirmed memory of that character (`:533`) | `requireAuth` | **Instance** — any show's character's memories, chosen by a caller-supplied character id |
| 13 | `:557` | `GET /books/:bookId/memories/pending` (`:549`) | `StorytellerBook` by pk, with chapters → lines → memories → character (`id`, `display_name`, `role_type`) | `req.params.bookId` (`:551`) | none | every memory in the book, each with its chapter's title, the first 100 characters of its line and its character's three fields, plus counts (`:584-609`) | `requireAuth` | **Instance** — any show's book, its memories, chapter titles and line text, chosen by a caller-supplied book id |
| 14 | `:630` | `GET /books/:bookId/scenes` (`:625`) | `StorytellerBook` by pk, with chapters → lines | `req.params.bookId` (`:627`) | none | the chapters' ids resolved from the model's `chapter_index` (`:687-693`, `:733-741`), the count of approved lines (`:750-753`), and scene suggestions that are model output from a prompt carrying the book's title, chapter titles and approved line text (`:643-653`, `:697-702`) | `requireAuth` | **Instance** — any show's chapter ids and counts returned directly, and text derived from its lines (INFERRED: model output), chosen by a caller-supplied book id |
| 15 | `:660` | as #14 | `StorytellerMemory` where `line_id` (each line from #14), confirmed, with `RegistryCharacter` (`display_name`) | line ids from #14's caller-chosen book | none | the count of confirmed memories (`:750-753`); their type, statement, tags and character name go into the prompt (`:669-676`, `:697-702`) | as #14 | **Instance** — memories of a caller-chosen book's lines; a count and model output derived from them reach the response (INFERRED for the model output) |

### Found by reading, not by the probe

```
$ git show b6a99dec:src/routes/memories/core.js | grep -n -E "\.(count|findOrCreate|max|min|sum|sync|reload)\(|\.get[A-Z][A-Za-z]*\(|sequelize\.query"
152:    const existingCount = await StorytellerMemory.count({ where: { line_id: lineId } });
202:          confidence: Math.min(1, Math.max(0, parseFloat(candidate.confidence) || 0)),
265:        const memCount = await StorytellerMemory.count({ where: { line_id: line.id } });
324:              confidence: Math.min(1, Math.max(0, parseFloat(candidate.confidence) || 0)),
```

`:202` and `:324` are `Math.min` / `Math.max`, not reads.

| # | Where | Form | Id source | Returns | Classification — reason |
| --- | --- | --- | --- | --- | --- |
| R1 | `:152` | `StorytellerMemory.count()` in `POST /lines/:lineId/extract` | `req.params.lineId` | the count, in a 409 (`:153-158`) | **Instance** — the number of memories on any show's line, chosen by the caller |
| R2 | `:265` | `StorytellerMemory.count()` per line in `POST /books/:bookId/extract-all` | each line id from #5 | decides which lines are eligible, so which line ids and counts #5 returns (`:266-268`) | **Instance** — as #5: the response's line ids and totals are selected through it |

`POST /structure-universe` (`:31`) reads nothing; it sends the caller's own
text to the model.

## §4. The helpers the sites depend on — MEASURED

- **`buildUniverseContext(bookId, db)`** (`src/utils/universeContext.js:14`),
  called at `:163` (#3's book), `:283` (#4's `bookId`) and `:696` (#14's
  `bookId`). It reads `StorytellerBook` by pk with `BookSeries` and
  `Universe` (`universeContext.js:18-31`) and returns text built from the
  universe's, series' and book's fields (`:35-83`), which the callers prepend
  to their prompts. It takes no tenant and applies none. Its read is keyed by
  a caller-chosen book, so what it contributes to #3, #5 and #14 is part of
  their derived output; it adds no site of its own to the totals.
- **`buildExtractionPrompt`, `buildScenesPrompt`** (`memories/helpers.js:15`,
  `:89`): string builders; they read no table:

```
$ git show b6a99dec:src/routes/memories/helpers.js | awk 'NR>=15 && NR<=143' | grep -c -E "db\.|await|find"
0
```

- **`registrySync.onMemoryConfirmed` / `onPainPointTagged`** (`:425`, `:431`):
  called without `await`, with only a `.catch` that logs, after the
  character update; their results never reach the response. Not read here;
  they add nothing to condition 4 for any site in this file.

**Cannot tell:** none.

## §5. Totals

| | Probe sites (15) | Found by reading (2) | All (17) |
| --- | --- | --- | --- |
| **Instances** | **10** — #1, #2, #3, #5, #8, #11, #12, #13, #14, #15 | **2** — R1, R2 | **12** |
| **Not instances** | **5** — #4, #6, #7, #9, #10 (each only gates) | 0 | **5** |
| **Cannot tell** | 0 | 0 | **0** |

This is the first file in the slice where condition 2 holds for every table:
books carry a show, and chapters, lines, memories and characters reach one
through model associations. With no tenant anywhere (§0.1), every read that
returns data chosen by a caller's id is an instance. The five that are not
instances only gate a write or a delete; each still reveals whether the row
exists, and #6 and #9 whether a memory is confirmed.

**Beside them, for comparison only: the write probe** (v1.49 §52.2's
`\.destroy\(|DELETE FROM`) on this file:

```
$ git show b6a99dec:src/routes/memories/core.js | grep -nE '\.destroy\(|DELETE FROM'
474:    await memory.destroy();
```

`:474` hard-deletes an unconfirmed memory of any show's line, chosen by the
caller (#9 gates it). Recorded as an observation only.

## Observed, not ruled

- **The writes follow the same shape as the reads.** Every write in this file
  is addressed by a caller-supplied id with no tenant:
  - `POST /memories/:memoryId/confirm` appends the memory's statement to any
    character's `extra_fields.memories` (`:417-421`), with `character_id`
    from the body, even when the memory belongs to another show's book.
  - `PUT /memories/:memoryId` sets `character_id` from the body (`:504`), so a
    memory can be pointed at any show's character.
  - `POST /lines/:lineId/extract` and `POST /books/:bookId/extract-all` write
    new memories onto any show's lines (`:195-214`, `:317-336`), and spend AI calls
    doing it.
  - `:474` hard-deletes (above).

  These are writes, outside the reads slice; recorded only.
- **`/memories/:memoryId/dismiss` carries `aiRateLimiter`** (`:459`) though
  it makes no AI call. Recorded only.

## What this document does not do

- Mints no FD, XK or PE. Rules nothing. Closes nothing: the reads slice stays
  owed until a Fix Plan revision rules on it.
- Changes no code.
- Does not read any route file other than `memories/core.js` and the
  hub `memories/index.js`, except the helpers in §4. The earlier `/api/v1`
  routers are loaded only to test mount order.
- Does not read `registrySync` (§4).
- Does not edit any filed document.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito or
  GitHub-settings contact.

**The next file, by the scoping note's order, not read here.** In the note's
§3 table, `memories/core.js` (15; 0 with `req.*`) is followed by
`continuityEngine.js` (14 sites, 14 ORM, 0 SELECT, 10 with `req.*`).

## Footer

**Type:** standalone note, the reads slice's fifth file. **Rules:** nothing.
**Mints:** nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `b6a99deccce044e886055addb20f4fbe364a6e1b`.*
*Authority: `F-Stats-1_ReadsSlice_episodes_2026-09-27.md` ("The rule",
"Adapted for reads"), applied unchanged; `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md`
(layout, condition-2 test, keys taken from a caller-chosen row);
`F-Stats-1_ReadsSlice_upgradeRoutes_2026-09-27.md` (Script 1's form);
`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md` §2, §3. Every `file:line` MEASURED
at the basis above unless marked INFERRED. Task: #2056.*
