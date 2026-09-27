# F-Stats-1 Phase B — Reads Slice, `franchiseBrainRoutes.js`

*Standalone note. Reads every read site in `src/routes/franchiseBrainRoutes.js`
and classifies each under the rule `F-Stats-1_ReadsSlice_episodes_2026-09-27.md`
stated, applied unchanged. Mints nothing, rules nothing, closes nothing.*

## Purpose

`F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md` (#2039) named
`franchiseBrainRoutes.js` as the file after it in the scoping note's §3 table
(`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md`, #2000). This note reads it,
following the two earlier slices' layout. Closing the reads slice still takes
a Fix Plan revision; this note is input to it.

## H1 — Basis

```
$ git rev-parse origin/main
fe56d758d676189d96a596e930142ef608e98e93
```

MEASURED. Date: 2026-09-27. Every `file:line` below is at this SHA unless it
names the scoping note's basis, `7a17a2e7`.

## The rule — cited, applied unchanged

The rule is the episodes.js slice's "The rule" and "Adapted for reads"
(`F-Stats-1_ReadsSlice_episodes_2026-09-27.md:51–94`), not restated here. A
site is an **instance** when (1) the rows it acts on are chosen by an
identifier the caller supplies; (2) the table is show-partitioned; (3) no
tenant value applies at any layer; and (4) the response carries data selected
through the read. A read that only gates is not an instance (a note); "cannot
tell" is reserved for a site whose conditions depend on code not read.
Condition 2 is tested as the calendarRoutes.js slice tested it (its §0.2):
does the table carry a show, directly or through a parent in code.

## §0. The conditions at this basis

### §0.1 Condition 3 — MEASURED

Nothing in the request path supplies a tenant.

- **The mount** (§2): the global layers the earlier slices named, the two
  `/api` rate limiters, and fifteen routers mounted at `/api/v1` before this
  one, none of which has a router-level layer (§2). `attachRBAC`
  (`src/middleware/rbac.js:193`) resolves no show.
- **The router:** no router-level layer (§2). Eleven of its sixteen routes
  carry `requireAuth`; the five GETs carry `optionalAuth` instead, so they
  answer unauthenticated callers too (§2). The file's own header records that
  split as F-AUTH-1's Tier 1 (writes) and Tier 4 (public catalog reads,
  `franchiseBrainRoutes.js:17-20`). Neither middleware resolves a show:

```
$ git show fe56d758:src/middleware/auth.js | grep -n -i "show"; echo "exit=$?"
exit=1
```

- **No handler takes a show.** No route reads a show id from the request, and
  no model read here has a show column (§0.2). `Show` has no owner column to
  check a caller against (the episodes.js slice §"Condition 3").
- **Model scopes:** none of the five models involved defines a `defaultScope`
  (§0.2).

So condition 3 holds for every read in this file. The classifications turn on
conditions 1, 2 and 4, and on whether each site can run at all (§2, §4).

### §0.2 Condition 2 — per table — MEASURED

No table read here carries a show, directly or through a parent in code:

```
$ for m in FranchiseKnowledge BrainDocument MultiProductContent FranchiseTechKnowledge StorytellerStory; do printf "%s show_id=%s defaultScope=%s tableName_line=%s\n" $m "$(git show fe56d758:src/models/$m.js | grep -c show_id)" "$(git show fe56d758:src/models/$m.js | grep -c defaultScope)" "$(git show fe56d758:src/models/$m.js | grep -n tableName | cut -d: -f1)"; done
FranchiseKnowledge show_id=0 defaultScope=0 tableName_line=49
BrainDocument show_id=0 defaultScope=0 tableName_line=23
MultiProductContent show_id=0 defaultScope=0 tableName_line=29
FranchiseTechKnowledge show_id=0 defaultScope=0 tableName_line=46
StorytellerStory show_id=0 defaultScope=0 tableName_line=159
```

Loading the model registry (Script 2, output in §2; no query is issued)
confirms, for the three models it exports, their attributes, that none has an
association, and that none has a default scope. The fourth, `BrainDocument`,
is not exported by the registry at all (§2); its model file is read above.

| Table | Model citation | Carries a show? | Condition 2 |
| --- | --- | --- | --- |
| `franchise_knowledge` | `FranchiseKnowledge.js:49` | No show column; franchise-wide rules, no association | **Not met** |
| `franchise_tech_knowledge` | `FranchiseTechKnowledge.js:46` | No show column, no association | **Not met** |
| `multi_product_content` | `MultiProductContent.js:29` | No show column. `story_id` has no association (`:5`, `associate(_models) {}`) and no foreign key in its migration; the story table it names, `storyteller_stories` (`StorytellerStory.js:159`), has no show column either | **Not met** |
| `brain_documents` | `BrainDocument.js:23` | No show column, no association. No migration under `src/migrations/` creates the table (see below) | **Not met** |

```
$ git grep -n -E "createTable\('(franchise_knowledge|brain_documents|multi_product_content|franchise_tech_knowledge)'" fe56d758 -- src/migrations
fe56d758:src/migrations/20260307200000-create-upgrade-tables.js:10:    await queryInterface.createTable('franchise_tech_knowledge', {
fe56d758:src/migrations/20260307200000-create-upgrade-tables.js:167:    await queryInterface.createTable('multi_product_content', {
fe56d758:src/migrations/20260307210000-create-franchise-knowledge.js:5:    await queryInterface.createTable('franchise_knowledge', {
```

## §1. The probe, re-run and reconciled — MEASURED

```
$ ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('; SQL='\bSELECT\b'; QT='QueryTypes\.SELECT'; REQ='req\.(params|body|query)'; for b in 7a17a2e7 fe56d758; do f=$(git show $b:src/routes/franchiseBrainRoutes.js); echo "$b lines=$(echo "$f" | wc -l) orm=$(echo "$f" | grep -cE "$ORM") select=$(echo "$f" | grep -E "$SQL" | grep -vcE "$QT") req=$(echo "$f" | grep -E "$ORM|$SQL" | grep -vE "$QT" | grep -cE "$REQ")"; done
7a17a2e7 lines=750 orm=16 select=0 req=6
fe56d758 lines=750 orm=16 select=0 req=6
$ git diff --quiet 7a17a2e7 fe56d758 -- src/routes/franchiseBrainRoutes.js && echo identical
identical
$ git log --oneline 7a17a2e7..fe56d758 -- src/routes/franchiseBrainRoutes.js
```

**Reconciliation with the scoping note's 16** (§3 row: `16 0 16 6`): the file is
byte-identical to the note's basis; no site was added, removed or moved. The
16 sites:

```
$ ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('; SQL='\bSELECT\b'; QT='QueryTypes\.SELECT'; git show fe56d758:src/routes/franchiseBrainRoutes.js | grep -nE "$ORM|$SQL" | grep -vE "$QT"
39:    const entries = await db.FranchiseKnowledge.findAll({
170:    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
202:    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
225:    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
241:    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
257:    const entry = await db.FranchiseKnowledge.findByPk(req.params.id);
275:    const amberEntries = await db.FranchiseKnowledge.findAll({
290:    const allEntries = await db.FranchiseKnowledge.findAll({
301:    const mostInjected = await db.FranchiseKnowledge.findAll({
309:    const recentActivity = await db.FranchiseKnowledge.findAll({
457:    const documents = await db.BrainDocument.findAll({
473:    const doc = await db.BrainDocument.findByPk(req.params.id);
493:    const laws = await db.FranchiseKnowledge.findAll({
680:    const content = await db.MultiProductContent.findAll({
697:    const entries = await db.FranchiseKnowledge.findAll({
733:    const entries = await db.FranchiseTechKnowledge.findAll({
```

The six with `req.*` on the same line are `:170`, `:202`, `:225`, `:241`,
`:257` and `:473`. `:39` takes `req.query` filters through a `where` built on
earlier lines (`:32-37`). There is no raw `SELECT`.

## §2. Mount and auth, re-checked at this basis — MEASURED

### The mount

```
$ git show fe56d758:src/app.js | grep -n -E "franchiseBrain|franchise-brain|multi-product"
1259:// Upgrade routes (session briefs, post-gen reviews, writing rhythm, multi-product, tech knowledge)
1270:  const franchiseBrainRoutes = require('./routes/franchiseBrainRoutes');
1271:  app.use('/api/v1', franchiseBrainRoutes);
1280:  app.use('/api/v1/franchise-brain', pdfIngestRoute);
1281:  console.log('✓ PDF Ingest route loaded at /api/v1/franchise-brain');
$ git show fe56d758:src/app.js | sed -n 1268,1275p
// Franchise Brain routes (knowledge management, ingestion, guard)
try {
  const franchiseBrainRoutes = require('./routes/franchiseBrainRoutes');
  app.use('/api/v1', franchiseBrainRoutes);
  console.log('✓ Franchise Brain routes loaded at /api/v1');
} catch (e) {
  console.error('✗ Failed to load Franchise Brain routes:', e.message);
}
```

| Mount | Router | Middleware on the mount | Condition |
| --- | --- | --- | --- |
| `:1271` | `franchiseBrainRoutes` (`routes/franchiseBrainRoutes.js`) | none (bare) | inside `try` (`:1269–1275`): mounted only if the `require` succeeds |

It is mounted at bare `/api/v1`, as the sixteenth of eighteen routers there
(`:756`–`:1262` before it, `:1491` and `:1517` after). `:1280` mounts a
different router, `pdfIngestRoute`, at `/api/v1/franchise-brain`, after this
one.

### What runs before `:1271`

```
$ git show fe56d758:src/app.js | awk 'NR<1271' | grep -n -E "app\.(use|all|get|post|put|delete)\(" | grep -v -E "app\.(use|all|get|post|put|delete)\('/api/v1/[a-z]" | grep -v "^\s*[0-9]*:\s*//"
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
1060:  app.use('/api/v1', arcTrackingRoutes);
1208:  app.use('/admin/queues', requireAuth, authorize(['ADMIN']), queueMonitorRoutes);
1262:  app.use('/api/v1', upgradeRoutes);
```

`:204`–`:275` are the global layers and limiters the earlier slices named;
`:138`, `:360`, `:370` are exact paths; `:869`–`:965` and `:1208` are other
prefixes. None resolves a show. **Fifteen routers are mounted at `/api/v1`
before `:1271`**; Script 1 tests whether any of them answers a franchiseBrain
path first or runs router-level middleware on it.

### Which router answers each path, and auth on each route

Method as in the earlier slices: load the real routers in Node and use
Express's own layer matching. Two scripts, each run from the checkout as
`node <scratch>/<script> <scratch>/<outfile>`; neither is committed. `<repo>`
and `<scratch>` stand for the checkout's and the scratchpad's absolute paths,
and are the only abbreviations in the transcripts.

**Script 1** is the calendarRoutes.js slice's Script 1 with the router under
test, the path prefix and the controls changed:

```js
// Loads franchiseBrainRoutes and every router mounted at /api/v1 before app.js:1271,
// and asks Express's own layers which of them would handle each calendar path (Task #2050).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const path = require('path');
const root = '<repo>/src/routes/';
const earlier = [
  [756, 'markers'], [765, 'export'], [777, 'beats'], [778, 'character-clips'], [779, 'audio-clips'],
  [780, 'animatic'], [803, 'evaluation'], [807, 'world'], [811, 'worldEvents'], [817, 'eventDeliverables'],
  [825, 'worldStudio'], [830, 'careerGoals'], [839, 'arcRoutes'], [1060, 'arcTrackingRoutes'],
  [1262, 'upgradeRoutes'],
];
const U = '00000000-0000-4000-8000-000000000000';
const cal = require(path.join(root, 'franchiseBrainRoutes'));
const calRows = cal.stack.filter(l => l.route).map(l => ({
  m: Object.keys(l.route.methods).map(x => x.toUpperCase()), p: l.route.path,
  mw: l.route.stack.map(s => s.name || '<anon>'),
}));
const calUse = cal.stack.filter(l => !l.route).map(l => l.name || '<anon>');
const out = [];
out.push('franchiseBrain routes ' + calRows.length + '; non-route layers: ' + JSON.stringify(calUse));
calRows.forEach(r => out.push('  ' + r.m.join(',') + ' ' + r.p + ' [' + r.mw.join(', ') + ']'));
// which franchiseBrain route answers each of its own paths first
const self = [];
calRows.forEach(r => {
  const sample = r.p.replace(/:[A-Za-z_]+/g, U);
  for (const m of r.m) {
    const hit = cal.stack.find(l => l.route && l.route.methods[m.toLowerCase()] && l.match(sample));
    if (!hit || hit.route.path !== r.p) self.push(m + ' ' + sample + ' -> ' + (hit ? hit.route.path : null));
  }
});
out.push('franchiseBrain paths answered by a different franchiseBrain route: ' + self.length);
self.forEach(x => out.push('  ' + x));
out.push('control GET /franchise-brain/documents -> ' + (cal.stack.find(l => l.route && l.route.methods.get && l.match('/franchise-brain/documents')) || {route:{path:null}}).route.path);
out.push('control GET /no-such-route -> ' + ((cal.stack.find(l => l.route && l.route.methods.get && l.match('/no-such-route')) || {route:{path:null}}).route.path));
out.push('earlier /api/v1 routers:');
for (const [line, name] of earlier) {
  let r; try { r = require(path.join(root, name)); } catch (e) { out.push('  ' + line + ' ' + name + ' LOAD ERROR ' + e.message.split('\n')[0]); continue; }
  const uses = r.stack.filter(l => !l.route);
  const usesHit = uses.filter(l => l.match('/franchise-brain/entries')).map(l => l.name || '<anon>');
  const routes = r.stack.filter(l => l.route);
  const hits = [];
  for (const c of calRows) {
    const sample = c.p.replace(/:[A-Za-z_]+/g, U);
    for (const m of c.m) {
      const h = routes.find(l => l.route.methods[m.toLowerCase()] && l.match(sample));
      if (h) hits.push(m + ' ' + sample + ' -> ' + h.route.path);
    }
  }
  out.push('  ' + line + ' ' + name + ': routes=' + routes.length + ' nonRouteLayers=' + uses.length + ' nonRouteMatchingFranchiseBrain=' + JSON.stringify(usesHit) + ' routeHits=' + hits.length);
  hits.forEach(h => out.push('    HIT ' + h));
}
// control: the same matcher does find an earlier router's own route
{ const we = require(path.join(root, 'worldEvents')); const first = we.stack.find(l => l.route);
  const sample = first.route.path.replace(/:[A-Za-z_]+/g, U); const m = Object.keys(first.route.methods)[0];
  const h = we.stack.find(l => l.route && l.route.methods[m] && l.match(sample));
  out.push('control worldEvents ' + m.toUpperCase() + ' ' + sample + ' -> ' + (h ? h.route.path : null)); }
require('fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
setTimeout(() => process.exit(0), 50);
```

```
$ cd <repo> && node <scratch>/fb1.js <scratch>/fb1.out >/dev/null 2>&1; echo exit=$?; cat <scratch>/fb1.out
exit=0
franchiseBrain routes 16; non-route layers: []
  GET /franchise-brain/entries [optionalAuth, <anonymous>]
  POST /franchise-brain/seed [requireAuth, <anonymous>]
  POST /franchise-brain/entries [requireAuth, <anonymous>]
  PATCH /franchise-brain/entries/:id/activate [requireAuth, <anonymous>]
  POST /franchise-brain/activate-all [requireAuth, <anonymous>]
  PATCH /franchise-brain/entries/:id [requireAuth, <anonymous>]
  DELETE /franchise-brain/entries/:id [requireAuth, <anonymous>]
  PATCH /franchise-brain/entries/:id/archive [requireAuth, <anonymous>]
  PATCH /franchise-brain/entries/:id/unarchive [requireAuth, <anonymous>]
  GET /franchise-brain/amber-activity [optionalAuth, <anonymous>]
  POST /franchise-brain/ingest-document [requireAuth, <anonymous>, <anonymous>]
  GET /franchise-brain/documents [optionalAuth, <anonymous>]
  GET /franchise-brain/documents/:id [optionalAuth, <anonymous>]
  POST /franchise-brain/guard [requireAuth, <anonymous>]
  POST /franchise-brain/push-from-page [requireAuth, <anonymous>, <anonymous>]
  GET /multi-product/all [optionalAuth, <anonymous>]
franchiseBrain paths answered by a different franchiseBrain route: 0
control GET /franchise-brain/documents -> /franchise-brain/documents
control GET /no-such-route -> null
earlier /api/v1 routers:
  756 markers: routes=7 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  765 export: routes=6 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  777 beats: routes=5 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  778 character-clips: routes=5 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  779 audio-clips: routes=5 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  780 animatic: routes=6 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  803 evaluation: routes=6 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  807 world: routes=4 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  811 worldEvents: routes=63 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  817 eventDeliverables: routes=5 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  825 worldStudio: routes=53 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  830 careerGoals: routes=7 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  839 arcRoutes: routes=7 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  1060 arcTrackingRoutes: routes=3 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=0
  1262 upgradeRoutes: routes=16 nonRouteLayers=0 nonRouteMatchingFranchiseBrain=[] routeHits=1
    HIT GET /multi-product/all -> /multi-product/all
control worldEvents GET /world/00000000-0000-4000-8000-000000000000/events -> /world/:showId/events
```

- **Fifteen of the sixteen paths are answered by this router's own route**
  (0 answered by a different route of its own; the controls resolve a real
  path and reject an undefined one).
- **`GET /multi-product/all` is not.** `upgradeRoutes`, mounted at `:1262`,
  declares the same method and path (`src/routes/upgradeRoutes.js:399`), with
  `requireAuth`. Its handler always responds and never calls `next()`:

```
$ git show fe56d758:src/routes/upgradeRoutes.js | sed -n 399,409p
router.get('/multi-product/all', requireAuth, async (req, res) => {
  try {
    const content = await db.MultiProductContent.findAll({
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return res.json({ content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
$ git show fe56d758:src/routes/upgradeRoutes.js | grep -c "next()"
0
```

  So this file's `GET /multi-product/all` (`:678`) is **never reached**: an
  unauthenticated request gets `upgradeRoutes`' 401, an authenticated one its
  result.
- **No earlier router has a router-level layer**, so nothing of theirs runs
  on a franchiseBrain request.
- **Auth:** 11 routes carry `requireAuth`; 5 GETs carry `optionalAuth` only
  (`/franchise-brain/entries`, `/amber-activity`, `/documents`,
  `/documents/:id`, `/multi-product/all`). No router-level layer. The second
  anonymous function on `/ingest-document` and `/push-from-page` is
  `aiRateLimiter` (`:345`, `:565`).
- **No input validation** on `:id`: no route carries `validateUUIDParam`.

**Script 2** loads the model registry and reports the four models' attributes
and associations. It issues no query (`src/models/index.js` authenticates only
from its exported `authenticate`/`healthCheck`, which the script does not
call):

```js
// Loads the model registry (no query is issued) and reports the attributes and
// associations of the models franchiseBrainRoutes.js reads (Task #2050).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const m = require('<repo>/src/models');
const out = [];
for (const n of ['FranchiseKnowledge', 'BrainDocument', 'MultiProductContent', 'FranchiseTechKnowledge']) {
  const M = m[n];
  if (!M) { out.push(n + ': not exported by src/models (require(...)["' + n + '"] is ' + typeof M + ')'); continue; }
  out.push(n + ' (' + M.getTableName() + '): attributes=' + Object.keys(M.rawAttributes).join(',') + ' | associations=' + (Object.keys(M.associations).join(',') || '(none)') + ' | defaultScope=' + JSON.stringify(M._scope || {}));
}
require('fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
setTimeout(() => process.exit(0), 50);
```

```
$ cd <repo> && node <scratch>/fb2.js <scratch>/fb2.out >/dev/null 2>&1; echo exit=$?; cat <scratch>/fb2.out
exit=0
FranchiseKnowledge (franchise_knowledge): attributes=id,title,content,category,severity,applies_to,always_inject,source_document,source_version,extracted_by,status,superseded_by,review_note,injection_count,last_injected_at,createdAt,updatedAt,deletedAt | associations=(none) | defaultScope={}
BrainDocument: not exported by src/models (require(...)["BrainDocument"] is undefined)
MultiProductContent (multi_product_content): attributes=id,story_id,format,content,headline,emotional_core,book2_seed,status,posted_at,author_note,createdAt,updatedAt,deletedAt | associations=(none) | defaultScope={}
FranchiseTechKnowledge (franchise_tech_knowledge): attributes=id,title,content,category,severity,applies_to,source_document,source_version,status,extracted_by,injection_count,last_injected_at,createdAt,updatedAt,deletedAt | associations=(none) | defaultScope={}
```

**`BrainDocument` is not exported by the model registry.** It is required
into `requiredModels` but is not in the exported `db` object, and no
`module.exports.BrainDocument` line exists:

```
$ grep -n "BrainDocument" src/models/index.js
135:let BrainDocument; // Brain Documents: stores full ingested document text
336:  BrainDocument = require('./BrainDocument')(sequelize, DataTypes);
558:  BrainDocument,
$ awk 'NR>=1700 && NR<=1929' src/models/index.js | grep -c "BrainDocument"
0
$ grep -n -E "^const db = \{|^module.exports = db;" src/models/index.js
1700:const db = {
1929:module.exports = db;
```

So in this file `db.BrainDocument` is `undefined`, and every branch guarded by
it takes its fallback: `GET /franchise-brain/documents` answers an empty list
with "BrainDocument model not available — run migration" (`:454-456`),
`GET /franchise-brain/documents/:id` answers 404 (`:470-472`), and
`POST /franchise-brain/ingest-document` never stores its document
(`:425`). The two `BrainDocument` read sites (`:457`, `:473`) never run.

## §3. The sites — one row each

Paths are relative to `/api/v1`. "Scope" answers condition 3 (never met;
§0.1). "Returns" answers condition 4. Condition 2 fails for every table (§0.2).

| # | Site | Handler | Reads | Id source | Scope | Returns (condition 4) | Auth | Classification — reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `:39` | `GET /franchise-brain/entries` (`:31`) | `FranchiseKnowledge` by optional filters | none: `category`, `status`, `severity` from `req.query` (`:32-37`) are enum filters, not identifiers | none | every matching entry, all of them with no filter (`:44`) | `optionalAuth` | **Not an instance** — condition 2 (`franchise_knowledge` carries no show); condition 1 also fails |
| 2 | `:170` | `PATCH /franchise-brain/entries/:id/activate` (`:168`) | `FranchiseKnowledge` by pk | `req.params.id` | none | the entry after the update (`:173-174`) | `requireAuth` | **Not an instance** — condition 2 |
| 3 | `:202` | `PATCH /franchise-brain/entries/:id` (`:199`) | `FranchiseKnowledge` by pk | `req.params.id` | none | the entry after the update, stored fields included (`:212-213`) | `requireAuth` | **Not an instance** — condition 2 |
| 4 | `:225` | `DELETE /franchise-brain/entries/:id` (`:223`) | `FranchiseKnowledge` by pk | `req.params.id` | none | a message only; 404 if missing (`:226-229`) | `requireAuth` | **Not an instance** — gates the delete; condition 2 also fails. Note: existence |
| 5 | `:241` | `PATCH /franchise-brain/entries/:id/archive` (`:239`) | `FranchiseKnowledge` by pk | `req.params.id` | none | the entry after the update (`:244-245`) | `requireAuth` | **Not an instance** — condition 2 |
| 6 | `:257` | `PATCH /franchise-brain/entries/:id/unarchive` (`:255`) | `FranchiseKnowledge` by pk | `req.params.id` | none | the entry after the update; 400 if not archived (`:259-262`) | `requireAuth` | **Not an instance** — condition 2 |
| 7 | `:275` | `GET /franchise-brain/amber-activity` (`:272`) | `FranchiseKnowledge` where `extracted_by` in two fixed values | none (fixed filter) | none | up to 10 Amber entries' fields and counts (`:315-323`) | `optionalAuth` | **Not an instance** — conditions 1 and 2 |
| 8 | `:290` | as #7 | `FranchiseKnowledge`, `category` and `status` of every row | none | none | counts by category and status (`:324-328`) | `optionalAuth` | **Not an instance** — conditions 1 and 2 |
| 9 | `:301` | as #7 | `FranchiseKnowledge` where `injection_count > 0` | none | none | the ten most-injected entries' id, title, category, counts (`:329`) | `optionalAuth` | **Not an instance** — conditions 1 and 2 |
| 10 | `:309` | as #7 | `FranchiseKnowledge`, 20 most recently updated | none | none | their id, title, category, status, source, times (`:330`) | `optionalAuth` | **Not an instance** — conditions 1 and 2 |
| 11 | `:457` | `GET /franchise-brain/documents` (`:452`) | `BrainDocument`, 100 newest | none | none | never reached: `db.BrainDocument` is undefined, so `:454-456` answers first (§2) | `optionalAuth` | **Not an instance** — the site never runs; conditions 1 and 2 also fail |
| 12 | `:473` | `GET /franchise-brain/documents/:id` (`:468`) | `BrainDocument` by pk | `req.params.id` | none | never reached: `:470-472` answers 404 first (§2) | `optionalAuth` | **Not an instance** — the site never runs; condition 2 also fails |
| 13 | `:493` | `POST /franchise-brain/guard` (`:485`) | `FranchiseKnowledge`, active and critical or always-inject | none (fixed filter) | none | the model's `passed` / `warnings`, from a prompt carrying the laws' titles and content (`:507-525`, `:544`) | `requireAuth` | **Not an instance** — conditions 1 and 2 |
| 14 | `:680` | `GET /multi-product/all` (`:678`) | `MultiProductContent`, 100 newest | none | none | never reached: `upgradeRoutes`' same route answers first (§2) | `optionalAuth` | **Not an instance** — the site never runs; conditions 1 and 2 also fail |
| 15 | `:697` | `buildKnowledgeInjection()` (`:694`), an exported helper, no route | `FranchiseKnowledge`, active and critical or always-inject | none | none | a prompt block of those entries, to its callers (§4) | n/a | **Not an instance** — conditions 1 and 2 |
| 16 | `:733` | `getTechContext()` (`:731`), an exported helper, no route | `FranchiseTechKnowledge`, 20 active | none | none | a prompt block of those entries, to its callers (§4) | n/a | **Not an instance** — conditions 1 and 2 |

### Found by reading, not by the probe

```
$ git show fe56d758:src/routes/franchiseBrainRoutes.js | grep -n -E "\.(count|findOrCreate|max|min|sum|sync|reload)\(|\.get[A-Z][A-Za-z]*\(|sequelize\.query"
62:      existing = await db.FranchiseKnowledge.count();
66:        await db.FranchiseKnowledge.sync();
82:      await db.sequelize.query('DELETE FROM franchise_knowledge');
105:        const queryInterface = db.sequelize.getQueryInterface();
107:        const count = await db.FranchiseKnowledge.count();
118:    await db.sequelize.query(
122:    const finalCount = await db.FranchiseKnowledge.count({ where: { status: 'active' } });
186:    const [, count] = await db.sequelize.query(
```

| # | Where | Form | Id source | Returns | Classification — reason |
| --- | --- | --- | --- | --- | --- |
| R1 | `:62`, `:107`, `:122` | `FranchiseKnowledge.count()` in `POST /franchise-brain/seed` (`:54`, `requireAuth`) | none | counts (`:73-77`, `:123-128`) | **Not an instance** — conditions 1 and 2 |

`:82`, `:118`, `:186` are raw `DELETE` / `UPDATE` statements, writes, not
reads. `:66` is a request-path `FranchiseKnowledge.sync()`, DDL run when the
count fails (observed, not ruled; see "Observed, not ruled").

**Handlers without a probe site:** `POST /franchise-brain/entries` (`:138`),
`POST /franchise-brain/activate-all` (`:184`), `POST /franchise-brain/ingest-document`
(`:345`) and `POST /franchise-brain/push-from-page` (`:565`) create or update
rows and read none (the ingest's `BrainDocument.create` never runs, §2);
`POST /franchise-brain/seed` (`:54`) reads only through R1.

## §4. The helpers the sites depend on — MEASURED

`buildKnowledgeInjection` (#15) and `getTechContext` (#16) are exported and
called from the AI-writing hub; they take no argument, so no caller value
reaches their reads:

```
$ git grep -n -E "buildKnowledgeInjection|getTechContext" fe56d758 -- src ':!src/routes/franchiseBrainRoutes.js'
fe56d758:src/routes/memories/assistant.js:14:let buildKnowledgeInjection, getTechContext;
fe56d758:src/routes/memories/assistant.js:16:  ({ buildKnowledgeInjection, getTechContext } = require('../franchiseBrainRoutes'));
fe56d758:src/routes/memories/assistant.js:17:} catch { buildKnowledgeInjection = null; getTechContext = null; }
fe56d758:src/routes/memories/assistant.js:113:    if (buildKnowledgeInjection) knowledgeBlock += await buildKnowledgeInjection();
fe56d758:src/routes/memories/assistant.js:114:    if (getTechContext) knowledgeBlock += await getTechContext();
fe56d758:src/routes/memories/assistant.js:366:    if (buildKnowledgeInjection) knowledgeBlock += await buildKnowledgeInjection();
fe56d758:src/routes/memories/assistant.js:367:    if (getTechContext) knowledgeBlock += await getTechContext();
fe56d758:src/routes/memories/engine.js:19:let _buildKnowledgeInjection, _getTechContext;
fe56d758:src/routes/memories/engine.js:21:  ({ buildKnowledgeInjection: _buildKnowledgeInjection, getTechContext: _getTechContext } = require('../franchiseBrainRoutes'));
fe56d758:src/routes/memories/engine.js:22:} catch { _buildKnowledgeInjection = null; _getTechContext = null; }
```

No other helper outside this file is called by a site. **Cannot tell:** none.

## §5. Totals

| | Probe sites (16) | Found by reading (1) | All (17) |
| --- | --- | --- | --- |
| **Instances** | **0** | 0 | **0** |
| **Not instances** | **16** | **1** — R1 | **17** |
| **Cannot tell** | 0 | 0 | **0** |

Every table this file reads fails condition 2, so no site can be an instance.
Of the sixteen, three never run at this basis (#11, #12: `BrainDocument` is
not exported; #14: shadowed by `upgradeRoutes`), one only gates (#4), and
eight also fail condition 1 (no caller-supplied identifier: #1, #7–#10, #13,
#15, #16).

**Beside them, for comparison only: the write probe** (v1.49 §52.2's
`\.destroy\(|DELETE FROM`) on this file:

```
$ git show fe56d758:src/routes/franchiseBrainRoutes.js | grep -nE '\.destroy\(|DELETE FROM'
82:      await db.sequelize.query('DELETE FROM franchise_knowledge');
228:    await entry.destroy();
```

`:82` deletes every `franchise_knowledge` row when `seed` is forced; `:228`
destroys the row #4 gates. Both on a table with no show. Recorded as an
observation only.

## Observed, not ruled

- **`BrainDocument` is defined but not exported by `src/models/index.js`**
  (§2), so the Documents endpoints always answer empty or 404, and ingested
  documents are never stored. No migration under `src/migrations/` creates
  `brain_documents` either (§0.2). Whether that table exists in any database
  is not measured here.
- **`GET /multi-product/all` is declared twice** under `/api/v1`: in
  `upgradeRoutes.js:399` (`requireAuth`) and here at `:678` (`optionalAuth`).
  Only the first ever answers (§2).
- **Five public reads.** The five GETs answer unauthenticated callers by
  design (F-AUTH-1 Tier 4, per the file's header), including every franchise
  knowledge entry at `GET /franchise-brain/entries`. That is an auth-tier
  decision already recorded by F-AUTH-1, not a reads-slice instance.
- **A request-path `Model.sync()`** at `:66` (in `seed`, when the table is
  missing). `CLAUDE.md` forbids `Model.sync()`; `PROJECT_CONTEXT.md` §4.5
  counts request-path `sync()` calls. Recorded only.

## What this document does not do

- Mints no FD, XK or PE. Rules nothing. Closes nothing: the reads slice stays
  owed until a Fix Plan revision rules on it.
- Changes no code.
- Does not read any route file other than `franchiseBrainRoutes.js`, except
  `upgradeRoutes.js:399–409`, read only because it answers one of this file's
  paths first. The earlier `/api/v1` routers are loaded only to test mount
  order.
- Does not check whether the routers mounted at `/api/v1` collide with each
  other beyond this file's paths.
- Does not edit any filed document.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito or
  GitHub-settings contact.

**The next file, by the scoping note's counts, not read here.** In the note's
§3 table, `franchiseBrainRoutes.js` (16; 6 with `req.*`) is followed by
`upgradeRoutes.js` (16 sites, 16 ORM, 0 SELECT, 2 with `req.*`), tied at 16.
Which file comes next is not chosen here.

## Footer

**Type:** standalone note, the reads slice's third file. **Rules:** nothing.
**Mints:** nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `fe56d758d676189d96a596e930142ef608e98e93`.*
*Authority: `F-Stats-1_ReadsSlice_episodes_2026-09-27.md` ("The rule",
"Adapted for reads"), applied unchanged; `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md`
(layout, condition-2 test); `F-Stats-1_ReadsSlice_Scoping_2026-09-26.md` §2, §3.
Every `file:line` MEASURED at the basis above unless marked INFERRED. Task: #2050.*
