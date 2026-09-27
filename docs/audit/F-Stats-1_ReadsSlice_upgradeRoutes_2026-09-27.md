# F-Stats-1 Phase B — Reads Slice, `upgradeRoutes.js`

*Standalone note. Reads every read site in `src/routes/upgradeRoutes.js` and
classifies each under the rule `F-Stats-1_ReadsSlice_episodes_2026-09-27.md`
stated, applied unchanged. Mints nothing, rules nothing, closes nothing.*

## Purpose

`F-Stats-1_ReadsSlice_franchiseBrainRoutes_2026-09-27.md` (#2051) named
`upgradeRoutes.js` as the file after it in the scoping note's §3 table
(`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md`, #2000), tied at 16 sites. This
note reads it, following the three earlier slices' layout. Closing the reads
slice still takes a Fix Plan revision; this note is input to it.

## H1 — Basis

```
$ git rev-parse origin/main
c245c2f4857276e345ee43d2a84dd3f6a1879728
```

MEASURED. Date: 2026-09-27. Every `file:line` below is at this SHA unless it
names the scoping note's basis, `7a17a2e7`.

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
directly or through a parent in code (a foreign key in its migration, or a
model association).

## §0. The conditions at this basis

### §0.1 Condition 3 — MEASURED

Nothing in the request path supplies a tenant.

- **The mount** (§2): the global layers the earlier slices named, the two
  `/api` rate limiters, fourteen routers mounted at bare `/api/v1` before this
  one and `session.js` at `/api/v1/session` (`app.js:1015`). None of them has
  a router-level layer, and none answers any of this file's paths (§2).
  `attachRBAC` (`src/middleware/rbac.js:193`) resolves no show.
- **The router:** no router-level layer. All sixteen routes carry
  `requireAuth`; the five AI routes add `aiRateLimiter` (`:43`, `:165`,
  `:411`, `:583`, `:623`). Neither resolves a show:

```
$ git show c245c2f4:src/middleware/auth.js | grep -n -i "show"; echo "exit=$?"
exit=1
```

- **No handler takes a show.** No route reads a show id from the request.
  The one read of a table that carries a show column (`storyteller_books`,
  `:56`) is by primary key alone. `Show` has no owner column to check a caller
  against (the episodes.js slice §"Condition 3").
- **Model scopes:** none of the ten models involved defines a `defaultScope`
  (Script 2, §2).

So condition 3 holds for every read in this file. The classifications turn on
conditions 1, 2 and 4.

### §0.2 Condition 2 — per table — MEASURED

```
$ for m in FranchiseTechKnowledge StorytellerBook StorytellerStory CharacterGrowthLog PostGenerationReview SessionBrief FranchiseKnowledge WritingRhythm WritingGoal MultiProductContent; do printf "%s show_id=%s defaultScope=%s tableName_line=%s\n" $m "$(git show c245c2f4:src/models/$m.js | grep -c show_id)" "$(git show c245c2f4:src/models/$m.js | grep -c defaultScope)" "$(git show c245c2f4:src/models/$m.js | grep -n tableName | cut -d: -f1)"; done
FranchiseTechKnowledge show_id=0 defaultScope=0 tableName_line=46
StorytellerBook show_id=2 defaultScope=0 tableName_line=135
StorytellerStory show_id=0 defaultScope=0 tableName_line=159
CharacterGrowthLog show_id=0 defaultScope=0 tableName_line=61
PostGenerationReview show_id=0 defaultScope=0 tableName_line=21
SessionBrief show_id=0 defaultScope=0 tableName_line=17
FranchiseKnowledge show_id=0 defaultScope=0 tableName_line=49
WritingRhythm show_id=0 defaultScope=0 tableName_line=18
WritingGoal show_id=0 defaultScope=0 tableName_line=23
MultiProductContent show_id=0 defaultScope=0 tableName_line=29
```

Loading the model registry (Script 2, output in §2; no query is issued)
confirms every model is exported, and gives each one's associations. The
parents that matter:

```
$ git show c245c2f4:src/models/StorytellerBook.js | sed -n '11,14p;143p'
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    StorytellerBook.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
$ git show c245c2f4:src/models/CharacterGrowthLog.js | sed -n 69,72p
    CharacterGrowthLog.belongsTo(models.RegistryCharacter, {
      foreignKey: 'character_id',
      as: 'character',
    });
$ git show c245c2f4:src/models/RegistryCharacter.js | grep -n -E "registry_id: \{|tableName|foreignKey: 'registry_id'"
26:    registry_id: {
644:    tableName: 'registry_characters',
667:        foreignKey: 'registry_id',
$ git show c245c2f4:src/models/CharacterRegistry.js | grep -n -E "show_id: \{|tableName"
18:    show_id: {
43:    tableName: 'character_registries',
```

| Table | Model citation | Carries a show? | Condition 2 |
| --- | --- | --- | --- |
| `storyteller_books` | `StorytellerBook.js:135` | **Yes, directly:** `show_id` (`:11`), `belongsTo(Show)` (`:143`) | **Met** |
| `character_growth_log` | `CharacterGrowthLog.js:61` | **Yes, through a parent:** `character_id` → `RegistryCharacter` (`:69-72`) → `registry_id` → `CharacterRegistry`, which carries `show_id` | **Met** |
| `storyteller_stories` | `StorytellerStory.js:159` | No show column, no `book_id`, no association (Script 2), and its migration declares no foreign key to a show-carrying table (below). Two columns name show-carrying rows without a foreign key or association: `character_key`, a slug, and `written_back_chapter_id`, a UUID (see "Observed, not ruled") | **Not met** (by the test as the calendarRoutes.js slice applied it) |
| `post_generation_reviews` | `PostGenerationReview.js:21` | No show column, no association. `story_id` is an `INTEGER` (`:10`) with no foreign key; the story ids it names are UUIDs | **Not met** |
| `multi_product_content` | `MultiProductContent.js:29` | No show column, no association. `story_id` is an `INTEGER` (`:9`) with no foreign key, as the franchiseBrainRoutes.js slice recorded | **Not met** |
| `session_briefs` | `SessionBrief.js:17` | No show column, no association | **Not met** |
| `franchise_tech_knowledge` | `FranchiseTechKnowledge.js:46` | No show column, no association | **Not met** |
| `franchise_knowledge` | `FranchiseKnowledge.js:49` | No show column, no association | **Not met** |
| `writing_rhythm` | `WritingRhythm.js:18` | No show column, no association | **Not met** |
| `writing_goals` | `WritingGoal.js:23` | No show column, no association | **Not met** |

The migrations that create the tables this file reads, and every column the
running tree adds to `storyteller_stories`:

```
$ git grep -n -E "createTable\('(storyteller_books|storyteller_stories|character_growth_log|post_generation_reviews|multi_product_content|session_briefs|franchise_tech_knowledge|franchise_knowledge|writing_rhythm|writing_goals)'" c245c2f4 -- src/migrations
c245c2f4:src/migrations/20260220000003-create-storyteller-books.js:6:    await queryInterface.createTable('storyteller_books', {
c245c2f4:src/migrations/20260302120000-story-social-assembler.js:10:    await queryInterface.createTable('storyteller_stories', {
c245c2f4:src/migrations/20260307120000-scene-proposals-and-character-growth.js:170:    await queryInterface.createTable('character_growth_log', {
c245c2f4:src/migrations/20260307200000-create-upgrade-tables.js:10:    await queryInterface.createTable('franchise_tech_knowledge', {
c245c2f4:src/migrations/20260307200000-create-upgrade-tables.js:56:    await queryInterface.createTable('session_briefs', {
c245c2f4:src/migrations/20260307200000-create-upgrade-tables.js:87:    await queryInterface.createTable('post_generation_reviews', {
c245c2f4:src/migrations/20260307200000-create-upgrade-tables.js:127:    await queryInterface.createTable('writing_rhythm', {
c245c2f4:src/migrations/20260307200000-create-upgrade-tables.js:147:    await queryInterface.createTable('writing_goals', {
c245c2f4:src/migrations/20260307200000-create-upgrade-tables.js:167:    await queryInterface.createTable('multi_product_content', {
c245c2f4:src/migrations/20260307210000-create-franchise-knowledge.js:5:    await queryInterface.createTable('franchise_knowledge', {
$ git show c245c2f4:src/migrations/20260302120000-story-social-assembler.js | awk 'NR>=10 && NR<=112' | grep -c -E "references"
0
$ git grep -n -E "addColumn\('storyteller_stories'" c245c2f4 -- src/migrations
c245c2f4:src/migrations/20260307100000-create-character-sparks-and-story-eval-columns.js:77:        await queryInterface.addColumn('storyteller_stories', col, {
c245c2f4:src/migrations/20260309000000-tier-features-all.js:166:      await queryInterface.addColumn('storyteller_stories', 'pipeline_step', {
c245c2f4:src/migrations/20260309000000-tier-features-all.js:171:      await queryInterface.addColumn('storyteller_stories', 'franchise_guard_result', {
c245c2f4:src/migrations/20260309000000-tier-features-all.js:176:      await queryInterface.addColumn('storyteller_stories', 'continuity_check_result', {
c245c2f4:src/migrations/20260316000000-add-enrichment-status-to-stories.js:5:    await queryInterface.addColumn('storyteller_stories', 'enrichment_status', {
$ git show c245c2f4:src/migrations/20260307100000-create-character-sparks-and-story-eval-columns.js | grep -n -E "^\s+\['[a-z_]+'," | sed -n '1,20p'
59:      ['tone_dial',                    Sequelize.STRING(50)],
60:      ['characters_in_scene',          Sequelize.JSONB],
61:      ['registry_dossiers_used',       Sequelize.JSONB],
62:      ['scene_brief',                  Sequelize.TEXT],
63:      ['story_a',                      Sequelize.TEXT],
64:      ['story_b',                      Sequelize.TEXT],
65:      ['story_c',                      Sequelize.TEXT],
66:      ['evaluation_result',            Sequelize.JSONB],
67:      ['plot_memory_proposal',         Sequelize.JSONB],
68:      ['character_revelation_proposal', Sequelize.JSONB],
69:      ['registry_update_proposals',    Sequelize.JSONB],
70:      ['memory_confirmed_at',          Sequelize.DATE],
71:      ['written_back_at',              Sequelize.DATE],
72:      ['written_back_chapter_id',      Sequelize.UUID],
$ git show c245c2f4:src/migrations/20260307200000-create-upgrade-tables.js | sed -n '89,92p;169,172p'
      story_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'The storyteller_story that was reviewed',
      story_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'The approved scene this was generated from',
```

`storyteller_stories`' creating migration declares no `references` in the
table body (`:10`–`:112`; its indexes follow at `:114`), and no migration
adds a `book_id` column to it: the five `addColumn` sites above add
`pipeline_step`, `franchise_guard_result`, `continuity_check_result`,
`enrichment_status`, and the fourteen columns listed.

## §1. The probe, re-run and reconciled — MEASURED

```
$ ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('; SQL='\bSELECT\b'; QT='QueryTypes\.SELECT'; REQ='req\.(params|body|query)'; for b in 7a17a2e7 c245c2f4; do f=$(git show $b:src/routes/upgradeRoutes.js); echo "$b lines=$(echo "$f" | wc -l) orm=$(echo "$f" | grep -cE "$ORM") select=$(echo "$f" | grep -E "$SQL" | grep -vcE "$QT") req=$(echo "$f" | grep -E "$ORM|$SQL" | grep -vE "$QT" | grep -cE "$REQ")"; done
7a17a2e7 lines=663 orm=16 select=0 req=2
c245c2f4 lines=663 orm=16 select=0 req=2
$ git diff --quiet 7a17a2e7 c245c2f4 -- src/routes/upgradeRoutes.js && echo identical
identical
$ git log --oneline 7a17a2e7..c245c2f4 -- src/routes/upgradeRoutes.js
```

**Reconciliation with the scoping note's 16** (§3 row: `16 0 16 2`): the file
is byte-identical to the note's basis; no site was added, removed or moved.
The 16 sites:

```
$ ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('; SQL='\bSELECT\b'; QT='QueryTypes\.SELECT'; git show c245c2f4:src/routes/upgradeRoutes.js | grep -nE "$ORM|$SQL" | grep -vE "$QT"
48:    const techEntries = db.FranchiseTechKnowledge ? await db.FranchiseTechKnowledge.findAll({
56:      const book = db.StorytellerBook ? await db.StorytellerBook.findByPk(book_id) : null;
57:      const recentStories = db.StorytellerStory ? await db.StorytellerStory.findAll({
62:      const recentGrowth = db.CharacterGrowthLog ? await db.CharacterGrowthLog.findAll({
152:    const brief = await db.SessionBrief.findOne({ order: [['created_at', 'DESC']] });
170:    const story = await db.StorytellerStory.findByPk(story_id);
177:    const laws = await db.FranchiseKnowledge.findAll({
267:    const review = await db.PostGenerationReview.findByPk(req.params.id);
278:    const reviews = await db.PostGenerationReview.findAll({
320:    const goal = await db.WritingGoal.findOne({ where: { active: true } });
326:    const sessions = await db.WritingRhythm.findAll({
401:    const content = await db.MultiProductContent.findAll({
415:    const story = await db.StorytellerStory.findByPk(storyId);
512:    const content = await db.MultiProductContent.findAll({
525:    const item = await db.MultiProductContent.findByPk(req.params.contentId);
574:    const entries = await db.FranchiseTechKnowledge.findAll({
```

The two with `req.*` on the same line are `:267` and `:525`. Four more take a
caller value bound on an earlier line: `:56` and `:57` (`book_id`, from
`req.body` at `:44`), `:170` (`story_id`, `:166`), `:415` (`storyId`,
`:412`); `:512` names `req.params` inside its `where` on `:513`; `:574` takes
`req.query` filters (`:564`). There is no raw `SELECT`.

## §2. Mount and auth, re-checked at this basis — MEASURED

### The mount

```
$ git show c245c2f4:src/app.js | grep -n -E "upgradeRoutes"
1261:  const upgradeRoutes = require('./routes/upgradeRoutes');
1262:  app.use('/api/v1', upgradeRoutes);
$ git show c245c2f4:src/app.js | sed -n 1258,1266p

// Upgrade routes (session briefs, post-gen reviews, writing rhythm, multi-product, tech knowledge)
try {
  const upgradeRoutes = require('./routes/upgradeRoutes');
  app.use('/api/v1', upgradeRoutes);
  console.log('✓ Upgrade routes loaded at /api/v1');
} catch (e) {
  console.error('✗ Failed to load Upgrade routes:', e.message);
}
```

| Mount | Router | Middleware on the mount | Condition |
| --- | --- | --- | --- |
| `:1262` | `upgradeRoutes` (`routes/upgradeRoutes.js`) | none (bare) | inside `try` (`:1259–1266`): mounted only if the `require` succeeds |

It is mounted at bare `/api/v1`, as the fifteenth of eighteen routers there
(`:756`–`:1060` before it, `:1271`, `:1491` and `:1517` after):

```
$ git show c245c2f4:src/app.js | grep -n -E "app\.use\('/api/v1',"
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
1060:  app.use('/api/v1', arcTrackingRoutes);
1262:  app.use('/api/v1', upgradeRoutes);
1271:  app.use('/api/v1', franchiseBrainRoutes);
1491:  app.use('/api/v1', todoListRoutes);
1517:  app.use('/api/v1', opportunityRoutes);
```

One router mounted earlier has a prefix that covers one of this file's path
families, `/session`:

```
$ git show c245c2f4:src/app.js | grep -n -E "'/api/v1/(session|reviews|writing-rhythm|multi-product|tech-knowledge)"
1015:  app.use('/api/v1/session', sessionRoutes);
$ git show c245c2f4:src/routes/session.js | grep -n -E "router\.(get|post|put|patch|delete|use)\("
13:router.get('/brief', requireAuth, async (req, res) => {
```

### What runs before `:1262`

```
$ git show c245c2f4:src/app.js | awk 'NR<1262' | grep -n -E "app\.(use|all|get|post|put|delete)\(" | grep -v -E "app\.(use|all|get|post|put|delete)\('/api/v1/[a-z]" | grep -v "^\s*[0-9]*:\s*//"
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
```

`:204`–`:275` are the global layers and limiters the earlier slices named;
`:138`, `:360`, `:370` are exact paths; `:869`–`:965` and `:1208` are other
prefixes. None resolves a show. **Fourteen routers are mounted at bare
`/api/v1` before `:1262`**, and `session.js` at `/api/v1/session`; Script 1
tests whether any of them answers one of this file's paths first or runs
router-level middleware on it.

### Which router answers each path, and auth on each route

Method as in the earlier slices: load the real routers in Node and use
Express's own layer matching. Two scripts, each run from the checkout as
`node <scratch>/<script> <scratch>/<outfile>`; neither is committed. `<repo>`
and `<scratch>` stand for the checkout's and the scratchpad's absolute paths,
and are the only abbreviations in the transcripts.

**Script 1** is the franchiseBrainRoutes.js slice's Script 1 with the router
under test and the earlier-router list changed, and one addition: the
`session.js` router is tested against this file's `/session` paths with that
prefix stripped, as Express does for a prefixed mount:

```js
// Loads upgradeRoutes and every router mounted before app.js:1262 whose prefix
// covers one of its paths (the fourteen at bare /api/v1, and session.js at
// /api/v1/session, :1015), and asks Express's own layers which of them would
// handle each upgradeRoutes path first (Task #2052).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const path = require('path');
const root = '<repo>/src/routes/';
const earlier = [
  [756, 'markers'], [765, 'export'], [777, 'beats'], [778, 'character-clips'], [779, 'audio-clips'],
  [780, 'animatic'], [803, 'evaluation'], [807, 'world'], [811, 'worldEvents'], [817, 'eventDeliverables'],
  [825, 'worldStudio'], [830, 'careerGoals'], [839, 'arcRoutes'], [1060, 'arcTrackingRoutes'],
];
const U = '00000000-0000-4000-8000-000000000000';
const up = require(path.join(root, 'upgradeRoutes'));
const rows = up.stack.filter(l => l.route).map(l => ({
  m: Object.keys(l.route.methods).map(x => x.toUpperCase()), p: l.route.path,
  mw: l.route.stack.map(s => s.name || '<anon>'),
}));
const use = up.stack.filter(l => !l.route).map(l => l.name || '<anon>');
const out = [];
out.push('upgrade routes ' + rows.length + '; non-route layers: ' + JSON.stringify(use));
rows.forEach(r => out.push('  ' + r.m.join(',') + ' ' + r.p + ' [' + r.mw.join(', ') + ']'));
const self = [];
rows.forEach(r => {
  const sample = r.p.replace(/:[A-Za-z_]+/g, U);
  for (const m of r.m) {
    const hit = up.stack.find(l => l.route && l.route.methods[m.toLowerCase()] && l.match(sample));
    if (!hit || hit.route.path !== r.p) self.push(m + ' ' + sample + ' -> ' + (hit ? hit.route.path : null));
  }
});
out.push('upgrade paths answered by a different upgrade route: ' + self.length);
self.forEach(x => out.push('  ' + x));
out.push('control GET /multi-product/all -> ' + (up.stack.find(l => l.route && l.route.methods.get && l.match('/multi-product/all')) || {route:{path:null}}).route.path);
out.push('control GET /no-such-route -> ' + ((up.stack.find(l => l.route && l.route.methods.get && l.match('/no-such-route')) || {route:{path:null}}).route.path));
function test(label, r, strip) {
  const uses = r.stack.filter(l => !l.route);
  const routes = r.stack.filter(l => l.route);
  const hits = []; const useHits = new Set();
  for (const c of rows) {
    if (strip && !c.p.startsWith(strip)) continue;
    const sample = c.p.replace(/:[A-Za-z_]+/g, U);
    const sub = strip ? (sample.slice(strip.length) || '/') : sample;
    uses.filter(l => l.match(sub)).forEach(l => useHits.add(l.name || '<anon>'));
    for (const m of c.m) {
      const h = routes.find(l => l.route.methods[m.toLowerCase()] && l.match(sub));
      if (h) hits.push(m + ' ' + sample + ' -> ' + (strip || '') + h.route.path);
    }
  }
  out.push('  ' + label + ': routes=' + routes.length + ' nonRouteLayers=' + uses.length + ' nonRouteMatchingUpgrade=' + JSON.stringify([...useHits]) + ' routeHits=' + hits.length);
  hits.forEach(h => out.push('    HIT ' + h));
}
out.push('earlier /api/v1 routers:');
for (const [line, name] of earlier) {
  let r; try { r = require(path.join(root, name)); } catch (e) { out.push('  ' + line + ' ' + name + ' LOAD ERROR ' + e.message.split('\n')[0]); continue; }
  test(line + ' ' + name, r, null);
}
out.push('earlier /api/v1/session router:');
test('1015 session (prefix /session)', require(path.join(root, 'session')), '/session');
{ const we = require(path.join(root, 'worldEvents')); const first = we.stack.find(l => l.route);
  const sample = first.route.path.replace(/:[A-Za-z_]+/g, U); const m = Object.keys(first.route.methods)[0];
  const h = we.stack.find(l => l.route && l.route.methods[m] && l.match(sample));
  out.push('control worldEvents ' + m.toUpperCase() + ' ' + sample + ' -> ' + (h ? h.route.path : null)); }
require('fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
setTimeout(() => process.exit(0), 50);
```

```
$ cd <repo> && node <scratch>/up1.js <scratch>/up1.out >/dev/null 2>&1; echo exit=$?; cat <scratch>/up1.out
exit=0
upgrade routes 16; non-route layers: []
  POST /session/brief [requireAuth, <anonymous>, <anonymous>]
  GET /session/brief/latest [requireAuth, <anonymous>]
  POST /reviews/post-generation [requireAuth, <anonymous>, <anonymous>]
  POST /reviews/:id/acknowledge [requireAuth, <anonymous>]
  GET /reviews/unacknowledged [requireAuth, <anonymous>]
  POST /writing-rhythm/log [requireAuth, <anonymous>]
  GET /writing-rhythm/stats [requireAuth, <anonymous>]
  PATCH /writing-rhythm/goal [requireAuth, <anonymous>]
  GET /multi-product/all [requireAuth, <anonymous>]
  POST /multi-product/:storyId/generate [requireAuth, <anonymous>, <anonymous>]
  GET /multi-product/:storyId [requireAuth, <anonymous>]
  PATCH /multi-product/:contentId/status [requireAuth, <anonymous>]
  POST /tech-knowledge/entries [requireAuth, <anonymous>]
  GET /tech-knowledge/entries [requireAuth, <anonymous>]
  POST /tech-knowledge/ingest-document [requireAuth, <anonymous>, <anonymous>]
  POST /tech-knowledge/extract-conversation [requireAuth, <anonymous>, <anonymous>]
upgrade paths answered by a different upgrade route: 0
control GET /multi-product/all -> /multi-product/all
control GET /no-such-route -> null
earlier /api/v1 routers:
  756 markers: routes=7 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  765 export: routes=6 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  777 beats: routes=5 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  778 character-clips: routes=5 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  779 audio-clips: routes=5 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  780 animatic: routes=6 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  803 evaluation: routes=6 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  807 world: routes=4 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  811 worldEvents: routes=63 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  817 eventDeliverables: routes=5 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  825 worldStudio: routes=53 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  830 careerGoals: routes=7 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  839 arcRoutes: routes=7 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
  1060 arcTrackingRoutes: routes=3 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
earlier /api/v1/session router:
  1015 session (prefix /session): routes=1 nonRouteLayers=0 nonRouteMatchingUpgrade=[] routeHits=0
control worldEvents GET /world/00000000-0000-4000-8000-000000000000/events -> /world/:showId/events
```

- **All sixteen paths are answered by this router's own route** (0 answered
  by a different route of its own; the controls resolve a real path and
  reject an undefined one).
- **No earlier router answers any of them first**, and none has a
  router-level layer. `session.js`'s one route is `GET /brief`
  (`session.js:13`), an exact path: it does not match `POST /session/brief`
  (another method) or `GET /session/brief/latest` (another path).
- **This router answers `GET /multi-product/all` for the whole app**: it is
  mounted before `franchiseBrainRoutes` (`:1271`), whose own
  `GET /multi-product/all` is therefore never reached (as the
  franchiseBrainRoutes.js slice recorded).
- **Auth:** all 16 routes carry `requireAuth`. The second anonymous function
  on the five AI routes is `aiRateLimiter` (`:43`, `:165`, `:411`, `:583`,
  `:623`). No router-level layer.
- **No input validation** on `:id`, `:storyId` or `:contentId`: no route
  carries `validateUUIDParam`.

**Script 2** loads the model registry and reports the ten models' attributes
and associations, and builds (does not run) the SQL for the `:57` read. It
issues no query (`src/models/index.js` authenticates only from its exported
`authenticate`/`healthCheck`, which the script does not call; building a
statement with the query generator sends nothing):

```js
// Loads the model registry (no query is issued) and reports the attributes and
// associations of the models upgradeRoutes.js reads, and the SQL Sequelize
// builds for the :57 read, without running it (Task #2052).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const m = require('<repo>/src/models');
const { Op } = require('<repo>/node_modules/sequelize');
const out = [];
for (const n of ['FranchiseTechKnowledge', 'StorytellerBook', 'StorytellerStory', 'CharacterGrowthLog', 'PostGenerationReview',
  'SessionBrief', 'FranchiseKnowledge', 'WritingRhythm', 'WritingGoal', 'MultiProductContent']) {
  const M = m[n];
  if (!M) { out.push(n + ': not exported by src/models'); continue; }
  const a = M.rawAttributes;
  out.push(n + ' (' + M.getTableName() + '): show_id=' + !!a.show_id + ' book_id=' + !!a.book_id
    + (a.story_id ? ' story_id=' + a.story_id.type.key : '') + ' id=' + a.id.type.key
    + ' | associations=' + (Object.entries(M.associations).map(([k, v]) => k + '->' + v.target.name).join(',') || '(none)')
    + ' | defaultScope=' + JSON.stringify(M._scope || {}));
}
const S = m.StorytellerStory;
const sql = m.sequelize.getQueryInterface().queryGenerator.selectQuery(S.getTableName(), {
  where: { book_id: '00000000-0000-4000-8000-000000000000', status: { [Op.in]: ['evaluated', 'written_back'] } },
  order: [['updated_at', 'DESC']], limit: 5,
}, S);
out.push(':57 SQL (built, not run): ' + sql);
require('fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
setTimeout(() => process.exit(0), 50);
```

```
$ cd <repo> && node <scratch>/up2.js <scratch>/up2.out >/dev/null 2>&1; echo exit=$?; cat <scratch>/up2.out
exit=0
FranchiseTechKnowledge (franchise_tech_knowledge): show_id=false book_id=false id=INTEGER | associations=(none) | defaultScope={}
StorytellerBook (storyteller_books): show_id=true book_id=false id=UUID | associations=show->Show,chapters->StorytellerChapter,series->BookSeries | defaultScope={}
StorytellerStory (storyteller_stories): show_id=false book_id=false id=UUID | associations=(none) | defaultScope={}
CharacterGrowthLog (character_growth_log): show_id=false book_id=false story_id=UUID id=INTEGER | associations=character->RegistryCharacter,sceneProposal->SceneProposal | defaultScope={}
PostGenerationReview (post_generation_reviews): show_id=false book_id=false story_id=INTEGER id=INTEGER | associations=(none) | defaultScope={}
SessionBrief (session_briefs): show_id=false book_id=false id=INTEGER | associations=(none) | defaultScope={}
FranchiseKnowledge (franchise_knowledge): show_id=false book_id=false id=INTEGER | associations=(none) | defaultScope={}
WritingRhythm (writing_rhythm): show_id=false book_id=false id=INTEGER | associations=(none) | defaultScope={}
WritingGoal (writing_goals): show_id=false book_id=false id=INTEGER | associations=(none) | defaultScope={}
MultiProductContent (multi_product_content): show_id=false book_id=false story_id=INTEGER id=INTEGER | associations=(none) | defaultScope={}
:57 SQL (built, not run): SELECT * FROM "storyteller_stories" AS "StorytellerStory" WHERE "StorytellerStory"."book_id" = '00000000-0000-4000-8000-000000000000' AND "StorytellerStory"."status" IN ('evaluated', 'written_back') ORDER BY "StorytellerStory"."updated_at" DESC LIMIT 5;
```

**The `:57` read names a column that does not exist in the code.** It filters
`storyteller_stories` by `book_id`; the model has no such attribute, no
migration adds one (§0.2), and Sequelize passes the key through unchecked into
`WHERE "StorytellerStory"."book_id" = …`. Whenever the caller sends a
`book_id`, `:57` runs right after `:56`, and a database built by the running
migration tree rejects the statement, so the handler answers 500 with the
error message (`:143-145`) instead of a brief. That the live databases lack
the column is **INFERRED** from the migration tree; this session contacted no
database.

**ATTESTED for one database (Evoni, 2026-09-27, pasted in the review chat).**
Evoni ran this on the EC2 host, from its `episode-metadata` checkout, against
the database its `.env` names (`DB_HOST`, `DB_PORT`, `DB_NAME`; user
`postgres`; SSL required). The paste does not say which environment that is,
and the host and credentials are not recorded here:

```
$ psql -W -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'storyteller_stories' AND column_name = 'book_id';"
Password:
 column_name
-------------
(0 rows)
```

So in that database the column is absent, and `:57` fails whenever it runs.
Any other database stays INFERRED.

## §3. The sites — one row each

Paths are relative to `/api/v1`. "Scope" answers condition 3 (never met;
§0.1). "Returns" answers condition 4. Condition 2 is per table, from §0.2.

| # | Site | Handler | Reads | Id source | Scope | Returns (condition 4) | Auth | Classification — reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `:48` | `POST /session/brief` (`:43`) | `FranchiseTechKnowledge`, every active entry | none (fixed filter) | none | the entries' titles and content go into the model prompt (`:93`); the brief is model output (`:131`, `:140`) | `requireAuth`, `aiRateLimiter` | **Not an instance** — conditions 1 and 2 |
| 2 | `:56` | as #1 | `StorytellerBook` by pk | `req.body.book_id` (`:44`) | none | the book's `current_arc_stage` and `arc_stage_scores` (`:67-68`) go into `storySnapshot`, which goes into the prompt (`:96`); the returned `brief_text` is model output from it (`:131`, `:140`). The snapshot is also stored in the new `session_briefs` row (`:137`), which `GET /session/brief/latest` returns whole to any signed-in caller (#5) | `requireAuth`, `aiRateLimiter` | **Instance** — a show-partitioned book chosen by a caller-supplied id, with no tenant check; values derived from it reach the response (that the brief text reflects them is INFERRED: model output). **Latent at this basis:** whenever `book_id` is sent, `:57` fails first and the handler answers 500 (§2: ATTESTED for the database Evoni checked, INFERRED for any other), so the response carries nothing yet. The rule is applied to the code, not to database state |
| 3 | `:57` | as #1 | `StorytellerStory` where `book_id` and a status | `req.body.book_id` (`:44`) | none | five stories' `scene_type`, `tone_dial`, `status` and the first 80 characters of `scene_brief`, into the prompt and the stored snapshot (`:69-74`) | as #1 | **Not an instance** — condition 2 (`storyteller_stories` carries no show). The filter names a column the model and migrations lack (§2) |
| 4 | `:62` | as #1 | `CharacterGrowthLog`, five unreviewed contradiction flags | none (fixed filter) | none | a count only (`:75`), into the prompt and the stored snapshot | as #1 | **Not an instance** — condition 1. `character_growth_log` carries a show through its character (§0.2), but no caller value chooses the rows |
| 5 | `:152` | `GET /session/brief/latest` (`:149`) | `SessionBrief`, the newest | none | none | the whole brief, including `story_snapshot` and `pending_builds` (`:155`); the handler also writes `used_at` (`:154`) | `requireAuth` | **Not an instance** — conditions 1 and 2 (`session_briefs` carries no show). Note: it returns whichever brief is newest, including a book's arc stage and scores copied into it by #2 (see "Observed, not ruled") |
| 6 | `:170` | `POST /reviews/post-generation` (`:165`) | `StorytellerStory` by pk | `req.body.story_id` (`:166`) | none | the model's violations and warnings, which quote lines of the story (`:250-257`); the story text is stored in the new review (`:242`) | `requireAuth`, `aiRateLimiter` | **Not an instance** — condition 2 |
| 7 | `:177` | as #6 | `FranchiseKnowledge`, active and critical | none (fixed filter) | none | into the prompt (`:191`); a count stored (`:246`) | as #6 | **Not an instance** — conditions 1 and 2 |
| 8 | `:267` | `POST /reviews/:id/acknowledge` (`:265`) | `PostGenerationReview` by pk | `req.params.id` | none | `{ ok: true }` only; 404 if missing (`:268-270`) | `requireAuth` | **Not an instance** — gates the update; condition 2 also fails. Note: existence |
| 9 | `:278` | `GET /reviews/unacknowledged` (`:276`) | `PostGenerationReview`, every unacknowledged | none | none | every such review, with the reviewed text (`:282`) | `requireAuth` | **Not an instance** — conditions 1 and 2 |
| 10 | `:320` | `GET /writing-rhythm/stats` (`:318`) | `WritingGoal`, the active one | none | none | the goal's targets (`:367-373`) | `requireAuth` | **Not an instance** — conditions 1 and 2 |
| 11 | `:326` | as #10 | `WritingRhythm`, last 30 days | none (a date window) | none | streak, totals and 14 sessions (`:355-375`) | as #10 | **Not an instance** — conditions 1 and 2 |
| 12 | `:401` | `GET /multi-product/all` (`:399`) | `MultiProductContent`, 100 newest | none | none | every row (`:405`) | `requireAuth` | **Not an instance** — conditions 1 and 2 |
| 13 | `:415` | `POST /multi-product/:storyId/generate` (`:411`) | `StorytellerStory` by pk | `req.params.storyId` (`:412`) | none | model output in five formats from a prompt carrying the scene's approved text, plot memory and revelation (`:418-431`, `:498-503`) | `requireAuth`, `aiRateLimiter` | **Not an instance** — condition 2 |
| 14 | `:512` | `GET /multi-product/:storyId` (`:510`) | `MultiProductContent` where `story_id` | `req.params.storyId` (`:513`) | none | every matching row (`:516`) | `requireAuth` | **Not an instance** — condition 2. Note: `story_id` is an `INTEGER`; a UUID story id cannot match it (see "Observed, not ruled") |
| 15 | `:525` | `PATCH /multi-product/:contentId/status` (`:522`) | `MultiProductContent` by pk | `req.params.contentId` | none | the row after the update (`:527-528`) | `requireAuth` | **Not an instance** — condition 2 |
| 16 | `:574` | `GET /tech-knowledge/entries` (`:563`) | `FranchiseTechKnowledge` by optional filters | none: `category`, `status`, `search` from `req.query` (`:564-573`) are filters and a search term, not identifiers | none | every matching entry (`:577`) | `requireAuth` | **Not an instance** — conditions 1 and 2 |

### Found by reading, not by the probe

```
$ git show c245c2f4:src/routes/upgradeRoutes.js | grep -n -E "\.(count|findOrCreate|max|min|sum|sync|reload)\(|\.get[A-Z][A-Za-z]*\(|sequelize\.query"
85:    const unreviewedCount = await db.PostGenerationReview.count({
296:    const [session, created] = await db.WritingRhythm.findOrCreate({
324:    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
341:        checkDate.setDate(checkDate.getDate() - 1);
344:        checkDate.setDate(checkDate.getDate() - 1);
352:    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
372:        on_track: thisWeek.length >= Math.ceil((goal.target_sessions || 3) * (new Date().getDay() / 7)),
```

`:324`, `:341`, `:344`, `:352` and `:372` are `Date` methods, not reads.

| # | Where | Form | Id source | Returns | Classification — reason |
| --- | --- | --- | --- | --- | --- |
| R1 | `:85` | `PostGenerationReview.count()` in `POST /session/brief` | none (fixed filter) | a count, into the prompt (`:101`) | **Not an instance** — conditions 1 and 2 |
| R2 | `:296` | `WritingRhythm.findOrCreate()` in `POST /writing-rhythm/log` (`:291`, `requireAuth`) | none: today's date (`:295`) | the day's session row (`:312`) | **Not an instance** — conditions 1 and 2 |

**Handlers without a probe site:** `PATCH /writing-rhythm/goal` (`:383`),
`POST /tech-knowledge/entries` (`:544`), `POST /tech-knowledge/ingest-document`
(`:583`) and `POST /tech-knowledge/extract-conversation` (`:623`) create or
update rows and read none.

## §4. The helpers the sites depend on — MEASURED

The only helper is `extractAIText` (`:32`), in this file; it reads no table.
No site calls a helper outside this file. **Cannot tell:** none.

## §5. Totals

| | Probe sites (16) | Found by reading (2) | All (18) |
| --- | --- | --- | --- |
| **Instances** | **1** — #2 (latent) | 0 | **1** |
| **Not instances** | **15** | **2** — R1, R2 | **17** |
| **Cannot tell** | 0 | 0 | **0** |

The one instance is `:56`, the only read of a table that carries a show
directly, chosen by a caller-supplied id. It is latent at this basis: the
read after it (`:57`) fails whenever it runs: ATTESTED for the database
Evoni checked, INFERRED for any other (§2).
Of the fifteen not instances, one reads a show-carrying table with no
caller-chosen rows (#4), one only gates (#8), and the rest read tables with no
show.

**Beside them, for comparison only: the write probe** (v1.49 §52.2's
`\.destroy\(|DELETE FROM`) on this file:

```
$ git show c245c2f4:src/routes/upgradeRoutes.js | grep -nE '\.destroy\(|DELETE FROM'; echo "exit=$?"
exit=1
```

None.

## Observed, not ruled

- **The session brief fails whenever a `book_id` is sent** (§2): `:57`
  filters `storyteller_stories` by a `book_id` column that neither the model
  nor any migration defines. Without a `book_id` the brief runs with an empty
  story snapshot. The instance at `:56` becomes live the moment `:57` is fixed
  or the column appears.
- **`story_id` is an `INTEGER` in `post_generation_reviews` and
  `multi_product_content`**, but story ids are UUIDs
  (`20260302120000-story-social-assembler.js:10-15`). The handlers store
  `parseInt(story_id)` (`:241`, `:488`), which is `NaN` for a UUID starting
  with a letter and the UUID's leading digits otherwise, and
  `GET /multi-product/:storyId` (#14) compares the integer column with the
  caller's UUID. So a review or content row cannot be traced back to its story,
  and unrelated stories can share a `story_id`. What the database does with
  `NaN` or the comparison is INFERRED, not measured.
- **`GET /session/brief/latest` returns the newest brief of anyone**, whole,
  to any signed-in caller, and marks it used. A brief made with a `book_id`
  would carry that book's arc stage and scores (#2, #5). `session_briefs` has
  no owner or show column.
- **Two `storyteller_stories` columns name show-carrying rows with no
  foreign key or association:** `character_key` (a slug; registry characters
  carry a show through their registry) and `written_back_chapter_id` (a
  chapter id; chapters belong to books). The calendarRoutes.js slice's test
  counts neither as a parent, so condition 2 is recorded as not met for #3,
  #6 and #13. `written_back_chapter_id` is written in one place and read for
  no join:

```
$ git grep -n "written_back_chapter_id" c245c2f4 -- src ':!src/migrations'
c245c2f4:src/models/StorytellerStory.js:137:    written_back_chapter_id: {
c245c2f4:src/routes/storyEvaluationRoutes.js:1601:    story.written_back_chapter_id = chapter_id;
```

  Whether an unassociated key should count as a parent is for the ruling
  revision. If it did, #6 and #13 (a story chosen by a caller-supplied id,
  derived text returned) would need re-reading.

## What this document does not do

- Mints no FD, XK or PE. Rules nothing. Closes nothing: the reads slice stays
  owed until a Fix Plan revision rules on it.
- Changes no code.
- Does not read any route file other than `upgradeRoutes.js`, except
  `session.js`'s route list, read only because its mount covers this file's
  `/session` paths. The earlier `/api/v1` routers are loaded only to test
  mount order.
- Does not check whether the routers mounted at `/api/v1` collide with each
  other beyond this file's paths.
- Does not measure any database: this session contacted none. Whether
  `storyteller_stories.book_id` exists is ATTESTED for the one database Evoni
  checked (§2) and INFERRED from the migration tree for any other.
- Does not edit any filed document.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito or
  GitHub-settings contact.

**The next file, by the scoping note's order, not read here.** In the note's
§3 table, `upgradeRoutes.js` (16; 2 with `req.*`) is followed by
`memories/core.js` (15 sites, 15 ORM, 0 SELECT, 0 with `req.*`).

## Footer

**Type:** standalone note, the reads slice's fourth file. **Rules:** nothing.
**Mints:** nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `c245c2f4857276e345ee43d2a84dd3f6a1879728`.*
*Authority: `F-Stats-1_ReadsSlice_episodes_2026-09-27.md` ("The rule",
"Adapted for reads"), applied unchanged; `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md`
(layout, condition-2 test); `F-Stats-1_ReadsSlice_franchiseBrainRoutes_2026-09-27.md`
(Script 1's form); `F-Stats-1_ReadsSlice_Scoping_2026-09-26.md` §2, §3.
Every `file:line` MEASURED at the basis above unless marked INFERRED or ATTESTED. Task: #2052.*
