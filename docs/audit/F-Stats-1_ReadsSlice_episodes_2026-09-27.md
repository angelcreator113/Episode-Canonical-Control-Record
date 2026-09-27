# F-Stats-1 Phase B — Reads Slice, `episodes.js`

*Standalone note. Reads every read site in `src/routes/episodes.js` and
classifies each under one stated rule. Mints nothing, rules nothing, closes
nothing.*

## Purpose

`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md` (the scoping note, #2000) opened
v1.49 §52.6's owed reads slice and named `src/routes/episodes.js` as the first
file to read (§6). This note reads it.

It states v1.49's classification rule, adapts it to reads, and applies it to
every site the scoping note's probe finds, plus the reads the probe misses in
the same handlers. Closing the reads slice still takes a Fix Plan revision.

## H1 — Basis

```
$ git rev-parse origin/main
164977d6e9648c8340418bd1227e84a3b6fce79b
```

MEASURED. Date: 2026-09-27. Every `file:line` below is at this SHA unless it
names v1.49's basis, `8c7d74af`, or the scoping note's basis, `7a17a2e7`.

## The obligation, quoted

**v1.49 §52.6** (`F-Stats-1_Fix_Plan_v1.49.md:198`), "The reads slice — owed,
and stated so it is not forgotten":

> "Rule 2 was chosen knowing what it misses. It finds unrecoverable writes and
> no reads at all."

> "Cross-tenant reads leak canon; they simply do not destroy it."

> "A reads slice over the same 120-file complement is owed."

**The scoping note, §2** (the probe): read sites are lines matching
`\.(findByPk|findOne|findAll|findAndCountAll)\(` (ORM) or `\bSELECT\b` minus
`QueryTypes\.SELECT` (raw SQL); the subset naming `req\.(params|body|query)`
on the same line is "a floor, not a result". "A counted site is a read, not
an instance. Whether it is scoped to the caller's tenant is decided only by
reading it."

**The scoping note, §6:** "**Named: `src/routes/episodes.js`.** 19 read sites
(18 ORM, 1 SELECT); 7 name `req.*` on the same line." It also records that
v1.49 §52.5 verified the mount at v1.49's basis and that the mount "must be
re-verified at the reading's own basis. It is not re-verified here."

## The rule

### v1.49's rule, as it classified `episodes.js`'s write sites

v1.49 §52.3 classified `episodes.js:239`, `:882` and `:1142` (its basis) as
instances of v1.48 §51's second shape. v1.48 §51.2 defines the shape:
routes "addressed by child-entity id", with the scope value "**absent at every
layer**" — "a route contract with no tenant in it". v1.48 §51.4's test: XK-2's
remedies "all assume a tenant value is in hand. **None of these … handlers has
one.**" v1.49 §52.5 adds the mount: "Every ruling in this shape assumes no
mount-level middleware resolves tenancy before the handler runs."

So v1.49 counted a site as an instance when:

1. the rows it acts on are chosen by an identifier the caller supplies;
2. the table is show-partitioned (§52.2: "`episodes` is show-partitioned beyond
   question");
3. no tenant value applies at any layer: route contract, the statement's
   predicate, a prior lookup, router or mount middleware;
4. and, under Rule 2, the statement destroys rows.

### Adapted for reads

Conditions 1–3 are kept word for word. Condition 4 changes from "destroys" to
"leaks":

> **4 (reads).** The response carries data selected through the read: the
> row, any of its fields the caller did not supply, rows fetched by keys the
> read supplies, or values derived from any of these.

Two clarifications, applied to every site the same way:

- **A show taken from the addressed row is not a tenant check.** Reading
  `episode.show_id` from a row the caller chose, then scoping a second read to
  it, scopes the second read to *the episode's* show, not to one the caller is
  entitled to. Condition 3 still holds.
- **A read that only gates is not an instance.** When a read's only visible
  effect is a 404 or an error, the response carries no data selected through
  it; condition 4 fails. The read leaks at most that the row exists. This is
  recorded against each such site as a note, not counted.

**Cannot tell** is reserved for a site whose conditions depend on code this
note did not read. None arose: the two helpers the sites depend on were read
(§4).

### Condition 3 at this basis — MEASURED

Nothing in the request path supplies a tenant:

- **The mounts** (§2): only global middleware (CORS, helmet, body parsers,
  `attachRBAC`, `captureResponseData`) and two `/api` rate limiters run before
  `episodes.js`. `attachRBAC` (`src/middleware/rbac.js:193`) attaches a role
  helper and calls `next()`; it resolves no show.
- **The router:** `episodes.js` has no router-level middleware (0 non-route
  layers, §2).
- **Each handler:** every route carries `requireAuth` (§2).
  `src/middleware/auth.js` (`requireAuth` at `:566`) never mentions a show:

  ```
  $ git show 164977d6:src/middleware/auth.js | grep -n -i "show"
  $
  ```

- **The data model:** `Show` has no owner, user or account column, so there is
  no caller-to-show entitlement to check against:

  ```
  $ git show 164977d6:src/models/Show.js | grep -n -i "user\|owner\|created_by\|account"
  100:        comment: 'Platform distribution config: per-platform templates, hashtags, accounts, brand guidelines',
  ```

  (Line 100 is a column comment about platform accounts, not a tenant.)
- **Model scopes:** no model these sites read defines a `defaultScope`:

  ```
  $ for m in Episode Show TimelineData EpisodeWardrobeDefault CharacterState SceneSetEpisode SceneSet SceneAngle; do
      git show 164977d6:src/models/$m.js | grep -c defaultScope; done | tr '\n' ' '
  0 0 0 0 0 0 0 0
  ```

So condition 3 holds for every read in this file. The classifications below
turn on conditions 1, 2 and 4.

### Condition 2 — the tables — MEASURED

Every table read here carries a show, directly or through its parent:
`episodes.show_id` (`src/models/Episode.js:52`); `assets.show_id`
(`Asset.js:44`); `world_events.show_id` (`WorldEvent.js:17`);
`character_state.show_id` (`CharacterState.js:16`); `scene_sets.show_id`
(`SceneSet.js:70`, nullable); `episode_briefs.show_id` (`EpisodeBrief.js:12`);
and, through an episode or a scene set, `timeline_data.episode_id`
(`TimelineData.js:19`), `episode_wardrobe_defaults.episode_id`
(`EpisodeWardrobeDefault.js:18`), `scene_set_episodes.episode_id`
(`SceneSetEpisode.js:21`), `scene_angles.scene_set_id` (`SceneAngle.js:20`),
`scenes.episode_id` (`Scene.js:16`).

## §1. The probe, re-run and reconciled — MEASURED

```
$ ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('; SQL='\bSELECT\b'; QT='QueryTypes\.SELECT'; REQ='req\.(params|body|query)'
$ for b in 7a17a2e7 164977d6; do f=$(git show $b:src/routes/episodes.js); echo "$b lines=$(echo "$f" | wc -l) orm=$(echo "$f" | grep -cE "$ORM") select=$(echo "$f" | grep -E "$SQL" | grep -vcE "$QT") req=$(echo "$f" | grep -E "$ORM|$SQL" | grep -vE "$QT" | grep -cE "$REQ")"; done
7a17a2e7 lines=1380 orm=18 select=1 req=7
164977d6 lines=1380 orm=18 select=1 req=7
$ git diff --quiet 7a17a2e7 164977d6 -- src/routes/episodes.js && echo identical
identical
$ git log --oneline 7a17a2e7..164977d6 -- src/routes/episodes.js
$
```

**Reconciliation with the scoping note's 19:** the file is byte-identical to
the note's basis. No site was added, removed or moved. The 19 sites:

```
$ git show 164977d6:src/routes/episodes.js | grep -nE "$ORM|$SQL" | grep -vE "$QT"
167:    const episode = await Episode.findByPk(req.params.id, {
187:    const episode = await Episode.findByPk(req.params.id);
219:      const episodeRecord = await Episode.findByPk(id, { transaction: t });
269:        const timelineRecord = await TimelineData.findOne({
311:    const episode = await models.Episode.findByPk(req.params.id, { attributes: ['id', 'deleted_at'] });
362:    const episode = await Episode.findByPk(id);
808:    const defaults = await EpisodeWardrobeDefault.findAll({
869:    const result = await EpisodeWardrobeDefault.findByPk(wardrobeDefault.id, {
945:  const episode = await Episode.findByPk(id);
954:      `SELECT * FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
963:    const state = await CharacterState.findOne({
1070:    const episode = await Episode.findByPk(req.params.episodeId);
1075:    const links = await SceneSetEpisode.findAll({
1115:    const episode = await Episode.findByPk(req.params.episodeId);
1188:    const episode = await Episode.findByPk(req.params.episodeId);
1200:    const sets = await SceneSet.findAll({
1338:    const episode = await Episode.findByPk(req.params.episodeId);
1348:    const sceneSet = await SceneSet.findByPk(sceneSetId);
1353:    const angle = await SceneAngle.findByPk(sceneAngleId);
```

The seven with `req.*` on the same line are `:167`, `:187`, `:311`, `:1070`,
`:1115`, `:1188` and `:1338`. `:808` and `:1075` also take `req.params` but on
the next line.

## §2. Mounts and auth, re-checked at this basis — MEASURED

### The three mounts v1.49 named, and the rest

v1.49 §52.5 recorded three mounts of `/api/v1/episodes` at its basis. They have
moved; eight more routers now share the path:

```
$ for b in 8c7d74af 164977d6; do echo "-- $b"; git show $b:src/app.js | grep -n "app.use('/api/v1/episodes', \(episodeRoutes\|timelineDataRoutes\|wardrobeApprovalRoutes\))"; done
-- 8c7d74af
634:app.use('/api/v1/episodes', episodeRoutes);
638:app.use('/api/v1/episodes', timelineDataRoutes);
756:  app.use('/api/v1/episodes', wardrobeApprovalRoutes);
-- 164977d6
673:app.use('/api/v1/episodes', episodeRoutes);
677:app.use('/api/v1/episodes', timelineDataRoutes);
795:  app.use('/api/v1/episodes', wardrobeApprovalRoutes);
$ git show 164977d6:src/app.js | grep -n "api/v1/episodes"
673:app.use('/api/v1/episodes', episodeRoutes);
677:app.use('/api/v1/episodes', timelineDataRoutes);
795:  app.use('/api/v1/episodes', wardrobeApprovalRoutes);
852:app.use('/api/v1/episodes', scriptGeneratorRoutes);
858:  app.use('/api/v1/episodes', lalaScriptRoutes);
875:  app.use('/api/v1/episodes', scriptParseRoutes);   // POST /api/v1/episodes/:id/parse-script, apply-scene-plan
909:  app.use('/api/v1/episodes', gameShowRoutes);
978:app.use('/api/v1/episodes', iconCueRoutes);
979:app.use('/api/v1/episodes', cursorPathRoutes);
980:app.use('/api/v1/episodes', musicCueRoutes);
981:app.use('/api/v1/episodes', productionPackageRoutes);
1492:  console.log('✓ Todo List loaded at /api/v1/episodes/:episodeId/todo');
1570:  app.use('/api/v1/episodes/:episodeId/phone-state', phonePlaythroughRoutes);
1571:  console.log('✓ Phone playthrough loaded at /api/v1/episodes/:episodeId/phone-state');
1606:      episodes: '/api/v1/episodes',
```

| Mount | Router | Middleware on the mount | Condition |
| --- | --- | --- | --- |
| `:673` | `episodeRoutes` (`routes/episodes.js`, `:472`) | none — bare | none |
| `:677` | `timelineDataRoutes` (`routes/timelineData.js`, `:676`) | none — bare | none |
| `:795` | `wardrobeApprovalRoutes` (`routes/wardrobeApproval.js`) | none — bare | inside `try` (`:793–799`): mounted only if the `require` succeeds |

All three are bare, as v1.49 found `:634` at its basis. The other eight are
recorded for completeness; they are not `episodes.js`'s mounts.
`:1570` is a separate, longer path (`/api/v1/episodes/:episodeId/phone-state`)
and not a mount of `/api/v1/episodes` itself.

### What runs before `:673`

```
$ git show 164977d6:src/app.js | awk 'NR<673' | grep -n "app\.use(\|app\.all("
204:app.use(cors(corsOptions));
211:  app.use((req, res, next) => {
218:app.use(
224:app.use(express.json({ limit: '10mb', type: 'application/json' }));
225:app.use(express.urlencoded({ limit: '10mb', extended: true }));
240:// app.use((req, res, next) => {
246:app.use(attachRBAC);
249:app.use(captureResponseData);
264:app.use('/api', apiLimiter);
275:app.use('/api', (req, res, next) => {
464:app.use('/api/v1/auth', authRoutes);
```

`:211` is development-only request logging; `:218` is helmet; `:240` is a
commented-out dev bypass; `:264` and `:275` are rate limiters; `:464` is a
different path. None resolves a show (condition 3). **`episodeRoutes` is the
first router mounted at `/api/v1/episodes`.**

### Which mount answers each path, and `requireAuth` on each route

Method: load the real routers in Node and use Express's own route matching
(each route layer's `match`). Two scripts, run with `node <script> <outfile>`
from a scratch directory; neither is committed. `<repo>` stands for the
checkout's absolute path.

**Script 1** lists every route in each router mounted at `/api/v1/episodes`,
in mount order, and tests each later router's routes (every `:param` replaced
by a UUID) against `episodes.js`'s routes of the same method:

```js
// Lists every route in the routers mounted at /api/v1/episodes, in app.js
// mount order, with each route's middleware names (Task #2036).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const path = require('path');
const root = '<repo>/src/routes/';
const mounts = [
  [673, 'episodes'], [677, 'timelineData'], [795, 'wardrobeApproval'],
  [852, 'scriptGenerator'], [858, 'lalaScripts'], [875, 'scriptParse'], [909, 'gameShows'],
  [978, 'iconCues'], [979, 'cursorPaths'], [980, 'musicCues'], [981, 'productionPackage'],
];
const out = {};
for (const [line, name] of mounts) {
  let router;
  try { router = require(path.join(root, name)); } catch (e) { out[name] = { line, error: e.message.split('\n')[0] }; continue; }
  const routes = [];
  for (const layer of router.stack || []) {
    if (!layer.route) { routes.push({ use: true, name: layer.name }); continue; }
    const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
    const mw = layer.route.stack.map(s => s.name || '<anon>');
    routes.push({ methods, path: layer.route.path, mw });
  }
  out[name] = { line, routes };
}
require('fs').writeFileSync(process.argv[2], JSON.stringify(out)); setTimeout(() => process.exit(0), 50);
// Shadowing: for each later router's route, build a sample path (every
// :param replaced by a UUID) and ask the episodes router's own layers which
// of its routes, for the same method, would match first.
const shadow = [];
const ep = require(path.join(root, 'episodes'));
const U = '00000000-0000-4000-8000-000000000000';
for (const [line, name] of mounts.slice(1)) {
  let r; try { r = require(path.join(root, name)); } catch (e) { continue; }
  for (const layer of r.stack || []) {
    if (!layer.route) continue;
    const sample = String(layer.route.path).replace(/:[A-Za-z_]+/g, U);
    for (const m of Object.keys(layer.route.methods)) {
      const hit = ep.stack.find(l => l.route && l.route.methods[m] && l.match(sample));
      if (hit) shadow.push({ mount: line, router: name, method: m.toUpperCase(), path: layer.route.path, answeredBy: hit.route.path });
    }
  }
}
require('fs').writeFileSync(process.argv[2] + '.shadow', JSON.stringify(shadow));
```

Its output, read back from the two files it writes:

```
$ node -e '…print each router, its mount line and route count…' routes.json
episodes 673 78 routes
timelineData 677 2 routes
wardrobeApproval 795 4 routes
scriptGenerator 852 7 routes
lalaScripts 858 1 routes
scriptParse 875 3 routes
gameShows 909 6 routes
iconCues 978 15 routes
cursorPaths 979 11 routes
musicCues 980 9 routes
productionPackage 981 6 routes
$ node -e '…print the shadow list length…' routes.json.shadow
shadowed: 0
```

**Script 2** is the control: it checks that the matcher resolves two real
paths and rejects an undefined one, and lists which routes lack `requireAuth`:

```js
process.env.NODE_ENV = 'test';
const ep = require('<repo>/src/routes/episodes');
const U = '00000000-0000-4000-8000-000000000000';
const probe = (m, p) => { const l = ep.stack.find(x => x.route && x.route.methods[m] && x.match(p)); return l ? l.route.path : null; };
const lines = [
  'control GET /' + U + ' -> ' + probe('get', '/' + U),
  'control GET /' + U + '/scene-sets -> ' + probe('get', '/' + U + '/scene-sets'),
  'control GET /' + U + '/no-such-route -> ' + probe('get', '/' + U + '/no-such-route'),
];
const rows = ep.stack.filter(l => l.route).map(l => ({ m: Object.keys(l.route.methods).join(',').toUpperCase(), p: l.route.path, mw: l.route.stack.map(s => s.name || '<anon>') }));
lines.push('routes ' + rows.length + ', with requireAuth ' + rows.filter(r => r.mw.includes('requireAuth')).length);
rows.filter(r => !r.mw.includes('requireAuth')).forEach(r => lines.push('NO requireAuth: ' + r.m + ' ' + r.p + ' [' + r.mw.join(', ') + ']'));
lines.push('non-route layers in episodes router: ' + ep.stack.filter(l => !l.route).length);
require('fs').writeFileSync(process.argv[2], lines.join('\n') + '\n' + JSON.stringify(rows));
setTimeout(() => process.exit(0), 50);
```

Its output (the first five lines of the file; the rest is the route list as JSON):

```
control GET /00000000-0000-4000-8000-000000000000 -> /:id
control GET /00000000-0000-4000-8000-000000000000/scene-sets -> /:episodeId/scene-sets
control GET /00000000-0000-4000-8000-000000000000/no-such-route -> null
routes 78, with requireAuth 78
non-route layers in episodes router: 0
```

- **Every path `episodes.js` defines is answered by `episodes.js`** (`:673`, the
  first mount). The controls show the matcher resolves real paths and rejects
  an undefined one.
- **No route in any later router is answered first by `episodes.js`**: none of
  their 64 routes (2 + 4 + 7 + 1 + 3 + 6 + 15 + 11 + 9 + 6) collides with an `episodes.js` route of the same method. So,
  at this basis, v1.49's registration-order concern does not reach any
  `episodes.js` path. (Whether the later routers collide with *each other* is
  not read here.)
- **`requireAuth` applies to all 78 routes**, and there is no router-level
  middleware. `requireAuth` authenticates; it resolves no show (condition 3).
- **Input validation varies** (recorded, as v1.49 §52.3 recorded it for
  writes): `validateUUIDParam` is on the handlers of `:167`, `:187`, `:219`,
  `:311`, `:1070`, `:1115`, `:1188` and `:1338`, and absent on those of `:362`
  (`POST /:id/thumbnail`), `:808`/`:869` (`/:id/wardrobe-defaults`) and
  `:945` (`POST /:id/generate-beats`).

## §3. The sites — one row each

Paths are relative to `/api/v1/episodes`. "Id source" says where the
identifier comes from. "Scope" answers condition 3 (never met; see "The rule").
"Returns" answers condition 4.

| # | Site | Handler | Reads | Id source | Scope | Returns (condition 4) | Auth | Classification — reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `:167` | `GET /:id/platform` (`:161`) | `Episode` by pk | `req.params.id` | none | `platform`, `width`, `height`, `aspect_ratio` of the row (`:171–176`) | `validateUUIDParam`, `requireAuth` | **Instance** — any episode's platform settings |
| 2 | `:187` | `PUT /:id/platform` (`:181`) | `Episode` by pk | `req.params.id` | none | the row's four platform fields after the update, the stored value wherever the body omits one (`:190–201`) | `validateUUIDParam`, `requireAuth` | **Instance** — echoes stored fields the caller did not send |
| 3 | `:219` | `POST /:id/save` (`:208`) | `Episode` by pk | `id` ← `req.params` (`:214`) | none | `success`, `message`, `timestamp` only (`:291–295`); not found throws | `validateUUIDParam`, `requireAuth` | **Not an instance** — gates the save; no row data returned. Note: existence. (The handler's write at `:239` is v1.49's instance.) |
| 4 | `:269` | `POST /:id/save` (`:208`) | `TimelineData` where `episode_id` | `id` ← `req.params` (`:214`) | none | nothing from the row; it feeds the update (`:274–285`) | as #3 | **Not an instance** — read into a write, not returned |
| 5 | `:311` | `GET /:id/events` (`:306`) | `Episode` by pk (`id`, `deleted_at`) | `req.params.id` | none | the events `listEpisodeEvents(models, episode.id)` returns (`:316–317`) | `validateUUIDParam`, `requireAuth` | **Instance** — its id keys the events read, which reads by episode id alone (§4) |
| 6 | `:362` | `POST /:id/thumbnail` (`:351`) | `Episode` by pk | `id` ← `req.params` (`:356`) | none | `thumbnail_url`, `s3Key`, `s3Bucket`, built from `id` and the upload (`:383–390`) | `requireAuth` (no UUID check) | **Not an instance** — gates the upload; no row data returned. Note: existence |
| 7 | `:808` | `GET /:id/wardrobe-defaults` (`:804`) | `EpisodeWardrobeDefault` where `episode_id`, with `Asset` (outfit) | `req.params.id` (`:809`) | none | every row and its outfit asset's fields (`:810–826`) | `requireAuth` (no UUID check) | **Instance** — any episode's wardrobe defaults and their assets |
| 8 | `:869` | `POST /:id/wardrobe-defaults` (`:840`) | `EpisodeWardrobeDefault` by pk, with `Asset` (outfit) | `wardrobeDefault.id`, derived from the `findOrCreate` on `req.params.id` (`:852–860`); the outfit asset's id from `req.body.outfit_asset_id` (`:843`, `:864`) | none, on either | the row, and the fields of the asset whose id the caller sent (`:870–882`) | `requireAuth` (no UUID check) | **Instance** — returns any asset's fields for a caller-chosen asset id |
| 9 | `:945` | `POST /:id/generate-beats` (`:940`) | `Episode` by pk | `id` ← `req.params` (`:941`) | none | the generated `script`, which on the basic-template path includes `episode.title` (`:989`, `:1046–1053`) | `requireAuth`, `aiRateLimiter` (no UUID check) | **Instance** — the row's title in the returned script |
| 10 | `:954` | `POST /:id/generate-beats` (`:940`) | `world_events` where `used_in_episode_id` (raw SQL) | `id` ← `req.params` (`:955`) | none | `event_name`, and the `script` built from the event (`:979–986`, `:1050`) | as #9 | **Instance** — another show's event, in the script and by name |
| 11 | `:963` | `POST /:id/generate-beats` (`:940`) | `CharacterState` where `show_id`, `character_key: 'lala'` | `show_id` ← the episode row (`:948`) | the episode's own show, derived from the addressed row: not a tenant check | coins and reputation, written into the returned script by the generator (§4) when an event exists | as #9 | **Instance** — the episode's show's character stats in the script |
| 12 | `:1070` | `GET /:episodeId/scene-sets` (`:1062`) | `Episode` by pk | `req.params.episodeId` | none | nothing from the row; 404 if missing (`:1071–1073`) | `validateUUIDParam`, `requireAuth` | **Not an instance** — gates. Note: existence |
| 13 | `:1075` | `GET /:episodeId/scene-sets` (`:1062`) | `SceneSetEpisode` where `episode_id`, with `SceneSet` and `SceneAngle` | `req.params.episodeId` (`:1076`) | none | every linked scene set with its angles (`:1093–1102`) | as #12 | **Instance** — any episode's scene sets, angles and stills |
| 14 | `:1115` | `POST /:episodeId/scene-sets` (`:1107`) | `Episode` by pk | `req.params.episodeId` | none | nothing from the row; 404 if missing | `validateUUIDParam`, `requireAuth` | **Not an instance** — gates the link. Note: existence |
| 15 | `:1188` | `POST /:episodeId/suggest-scenes` (`:1179`) | `Episode` by pk | `req.params.episodeId` | none | a proposal whose `beat_summary` values are the model's output from a prompt carrying the row's `script_content` and `description` (`:1192`, `:1233–1241`, `:1277–1296`); 400 if the row has no script (`:1193–1197`) | `requireAuth`, `aiRateLimiter`, `validateUUIDParam` | **Instance** — the returned summaries are derived from the row's script (that they reflect it is INFERRED: model output) |
| 16 | `:1200` | `POST /:episodeId/suggest-scenes` (`:1179`) | `SceneSet` where `show_id` | `show_id` ← the episode row (`:1201`) | the episode's own show, derived: not a tenant check | `scene_set_name`, `scene_set_thumb` (`base_still_url`), and the set count (`:1276–1295`) | as #15 | **Instance** — the episode's show's scene sets, by name and still |
| 17 | `:1338` | `POST /:episodeId/scenes/from-angle` (`:1330`) | `Episode` by pk | `req.params.episodeId` | none | nothing from the row; 404 if missing | `validateUUIDParam`, `requireAuth` | **Not an instance** — gates. Note: existence |
| 18 | `:1348` | `POST /:episodeId/scenes/from-angle` (`:1330`) | `SceneSet` by pk | `req.body.sceneSetId` (`:1343`) | none; not checked against the episode's show | `sceneSet.name` as the new scene's `location` and in its `title` (`:1365`, `:1373`, `:1376`) | as #17 | **Instance** — any show's scene set, by name |
| 19 | `:1353` | `POST /:episodeId/scenes/from-angle` (`:1330`) | `SceneAngle` by pk | `req.body.sceneAngleId` (`:1343`) | none; not checked against the set at #18 | `angle_name` in the `title`, `still_image_url` as `background_url` (`:1365–1366`, `:1376`) | as #17 | **Instance** — any angle's name and still URL |

### Found by reading, not by the probe

In the same thirteen handlers, four reads the line probe does not count
(§2 of the scoping note names each form):

| # | Where | Form | Id source | Returns | Classification — reason |
| --- | --- | --- | --- | --- | --- |
| R1 | `:852` | `EpisodeWardrobeDefault.findOrCreate` (a read that may create) | `req.params.id`, `req.body.character_name` | for an existing row, that row: its id feeds #8, which returns it (id, timestamps) after the update | **Instance** — selects an existing row on any episode and returns it |
| R2 | `:1133` | `SceneSetEpisode.findOrCreate`, per body id | `req.params.episodeId`, body `sceneSetIds` | `link.id` for each existing link (`:1140–1149`) | **Instance** — returns existing link ids on any episode |
| R3 | `:1358` → `src/models/Scene.js:420` | `Scene.getNextSceneNumber`, a model method (`findOne` ordered by `scene_number`) | `req.params.episodeId` | the new scene's `scene_number` is the episode's highest plus one (`:1364`, `:1376`) | **Instance** — derives a value from another episode's scenes |
| R4 | `:316` → `src/services/episodeEventsService.js:58–115` | a service: `EpisodeBrief.findOne` by `episode_id` (`:64`), `WorldEvent.findAll` by `used_in_episode_id` (`:69`) and by the brief's event id (`:79`) | `episode.id` from #5 | the events and their link flags (`:317`) | **Instance** — reads by episode id alone; counted with #5 |

R4 is outside the scoping note's population (services are not in
`src/routes/`, scoping note §2); it is read here only because #5's
classification depends on it.

**Handlers without a probe site.** Of `episodes.js`'s 78 routes, 16 have their
body in the file and 62 hand off to controllers under `src/controllers/`:

```
$ git show 164977d6:src/routes/episodes.js | grep -cE "async \(req, res\)"
16
```

The 16 are the 13 handlers above; three that only write
(`DELETE /:id/wardrobe-defaults/:character` `:900`,
`DELETE /:episodeId/scene-sets/:setId` `:1154`,
`PATCH /:episodeId/scene-sets/reorder` `:1305`); and `GET /test-create`
(`:26`), which creates a row and reads none. **The 62 controller handlers'
reads are in `src/controllers/`, outside the population, and are not read
here.**

## §4. The two helpers the sites depend on — MEASURED

**`listEpisodeEvents`** (for #5, R4) takes `(models, episodeId)` and scopes
every read by the episode id or ids derived from it; no show:

```
$ git show 164977d6:src/services/episodeEventsService.js | grep -n "listEpisodeEvents\|findAll\|findOne\|where\|show_id"
19: *   stamped_elsewhere — its used_in_episode_id points at another episode
41:      return await WorldEvent.findAll({ ...query, include, attributes });
46:  return WorldEvent.findAll({ ...query, attributes });
58:async function listEpisodeEvents(models, episodeId) {
64:    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId }, attributes: ['id', 'event_id'] });
69:    where: { used_in_episode_id: episodeId },
79:      const briefRows = await findEvents(models, { where: { id: briefEventId } });
97:        stamped_elsewhere: !!anchor.used_in_episode_id && anchor.used_in_episode_id !== episodeId,
103:    events.push({ ...ev, link: { anchor: false, stamped: true, stamped_elsewhere: false } });
115:module.exports = { listEpisodeEvents };
```

**`scriptSkeletonGenerator.generateScriptSkeleton`** (for #11) writes the
character state into the script it returns:

```
$ git show 164977d6:src/utils/scriptSkeletonGenerator.js | grep -n "characterState.reputation\|characterState.coins"
46:  const isBroke = (characterState.coins || 0) < cost;
47:  const isLowRep = (characterState.reputation || 1) <= 3;
90:      lines.push(`Prime: "Welcome back, besties. Last time didn't go our way. Reputation is at ${characterState.reputation || '?'}. But today? We rebuild."`);
131:    if (includeNarration) lines.push(`Prime: "Bestie... we only have ${characterState.coins || '?'} coins. This costs ${cost}. We might go into debt."`);
```

`episodes.js:979–986` calls it only when `:954` found a world event, so #11
leaks only on that path; the classification is by what the site can return.

## §5. Totals

| | Probe sites (19) | Found by reading (4) | All (23) |
| --- | --- | --- | --- |
| **Instances** | **13** — #1, 2, 5, 7, 8, 9, 10, 11, 13, 15, 16, 18, 19 | **4** — R1–R4 | **17** |
| **Not instances** | **6** — #3, 4, 6, 12, 14, 17 | 0 | **6** |
| **Cannot tell** | 0 | 0 | **0** |

The six not-instances are five gates (#3, 6, 12, 14, 17: existence at most)
and one read into a write (#4).

**Beside them, for comparison only: v1.49's write slice on the same file**
(§52.3, at `8c7d74af`): **3 sites, 3 instances** — `:239`, `:882`, `:1142`.
At this basis they are at `:239`, `:904` and `:1162`:

```
$ for b in 8c7d74af 164977d6; do echo "-- $b"; git show $b:src/routes/episodes.js | grep -nE '\.destroy\(|DELETE FROM'; done
-- 8c7d74af
239:        const deletedCount = await Scene.destroy({ where: { episode_id: id }, transaction: t, force: true });
882:    const deleted = await EpisodeWardrobeDefault.destroy({
1142:    const deleted = await SceneSetEpisode.destroy({
-- 164977d6
239:        const deletedCount = await Scene.destroy({ where: { episode_id: id }, transaction: t, force: true });
904:    const deleted = await EpisodeWardrobeDefault.destroy({
1162:    const deleted = await SceneSetEpisode.destroy({
```

Where the two slices meet: v1.49's `:239` sits in `POST /:id/save`, whose
two reads here are not instances (#3, a gate; #4, a read into a write).
v1.49's `:904` shares `episode_wardrobe_defaults` with #7, #8 and R1, and its
`:1162` shares `scene_set_episodes` with #13 and R2. Recorded as an
observation; nothing here is compared as a count of defects.

## What this document does not do

- Mints no FD, XK or PE.
- Rules nothing. Closes nothing: the reads slice stays owed until a Fix Plan
  revision rules on it; the classifications here are its input.
- Changes no code.
- Does not read the 62 controller handlers `episodes.js` hands off to, or any
  route file other than `episodes.js` (the three helpers in §4 and R3 are read
  only because sites here depend on them).
- Does not check whether the routers mounted after `:673` collide with each
  other.
- Does not resolve the scoping note's §5 divergence (`wardrobe.js` outside the
  complement).
- Does not edit any filed document.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito or
  GitHub-settings contact.

**The next file, by the scoping note's counts, not read here.** In the note's
§3 table (sorted by total), the file below `episodes.js` (19) is
`calendarRoutes.js`: 16 sites (15 ORM, 1 SELECT), 8 with `req.*` on the same
line, tied at 16 with `franchiseBrainRoutes.js` (16, 6), which the table lists
next. The largest file not excluded is `sceneSetRoutes.js` (74), which the note
§6 set aside as "not a first slice". Which comes next is not chosen here.

## Footer

**Type:** standalone note, the reads slice's first file. **Rules:** nothing.
**Mints:** nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `164977d6e9648c8340418bd1227e84a3b6fce79b`.*
*Authority: `F-Stats-1_Fix_Plan_v1.49.md` §52 and `F-Stats-1_Fix_Plan_v1.48.md`
§51, read directly; `F-Stats-1_ReadsSlice_Scoping_2026-09-26.md`. Every
`file:line` MEASURED at the basis above unless marked INFERRED. Task: #2036.*
