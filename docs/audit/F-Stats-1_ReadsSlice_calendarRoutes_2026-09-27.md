# F-Stats-1 Phase B — Reads Slice, `calendarRoutes.js`

*Standalone note. Reads every read site in `src/routes/calendarRoutes.js` and
classifies each under the rule `F-Stats-1_ReadsSlice_episodes_2026-09-27.md`
stated, applied unchanged. Mints nothing, rules nothing, closes nothing.*

## Purpose

`F-Stats-1_ReadsSlice_episodes_2026-09-27.md` (the episodes.js slice, #2036)
read the first file the scoping note named, and closed by naming
`calendarRoutes.js` as the file below it in the scoping note's §3 table. This
note reads that file, following the episodes.js slice's layout.

Closing the reads slice still takes a Fix Plan revision. This note is input to
it, as the episodes.js slice was.

## H1 — Basis

```
$ git rev-parse origin/main
98dd2e3a3220e7d5dd2042262df58e91e509e67b
```

MEASURED. Date: 2026-09-27. Every `file:line` below is at this SHA unless it
names the scoping note's basis, `7a17a2e7`, or the episodes.js slice's
basis, `164977d6`.

## The rule — cited, applied unchanged

The rule is the one in the episodes.js slice, "The rule" and "Adapted for
reads" (`F-Stats-1_ReadsSlice_episodes_2026-09-27.md:51–94`). It is not
restated here. In short, a site is an **instance** when all four conditions
hold:

1. the rows it acts on are chosen by an identifier the caller supplies;
2. the table is show-partitioned;
3. no tenant value applies at any layer;
4. (reads) the response carries data selected through the read.

It also has two clarifications: a show taken from the addressed row is not a
tenant check, and a read that only gates is not an instance but is recorded as
a note. "Cannot tell" is reserved for a site whose conditions depend on code
this note did not read.

The episodes.js slice applied condition 2 by asking whether each table
"carries a show, directly or through its parent" (its "Condition 2"). This
note applies the same test. It does not widen it, for example to a `series_id`
with no parent in code (§0.2).

## §0. The conditions at this basis

### §0.1 Condition 3 — MEASURED

Nothing in the request path supplies a tenant.

- **The mount** (§2): only global middleware and the two `/api` rate limiters
  run before it. They are the same layers the episodes.js slice listed, now at
  the same `app.js` lines. `attachRBAC` (`src/middleware/rbac.js:193`) resolves
  no show. No router mounted at `/api/v1` before it has a router-level layer
  (§2), so none runs on a calendar request.
- **The router:** one router-level layer, `router.use(requireAuth)`
  (`calendarRoutes.js:41`), and nothing else (§2).
- **`requireAuth`** (`src/middleware/auth.js:566`) never mentions a show, and
  `Show` has no owner column:

  ```
  $ git show 98dd2e3a:src/middleware/auth.js | grep -n -i "show"; echo "exit=$?"
  exit=1
  $ git show 98dd2e3a:src/middleware/auth.js | grep -n -E "^const requireAuth"
  566:const requireAuth = async (req, res, next) => {
  $ git show 98dd2e3a:src/models/Show.js | grep -n -i "user\|owner\|created_by\|account"
  100:        comment: 'Platform distribution config: per-platform templates, hashtags, accounts, brand guidelines',
  ```

  (Line 100 is a column comment, as the episodes.js slice recorded.)
- **Model scopes:** none of the models these sites or their helpers read
  defines a `defaultScope`:

  ```
  $ for m in StoryClockMarker StoryCalendarEvent CalendarEventAttendee CalendarEventRipple RegistryCharacter CharacterRegistry WorldLocation WorldEvent SocialProfile; do
      git show 98dd2e3a:src/models/$m.js | grep -c defaultScope; done | tr '\n' ' '
  0 0 0 0 0 0 0 0 0
  ```

- **No handler takes a tenant.** Three handlers take a `show_id` in the body
  (`:516–523`, `:649`, `:716`). Each writes it onto the rows it creates. None
  uses it to select a row (§3 #13, #16; R1, R2).

So condition 3 holds for every read in this file. The classifications turn
on conditions 1, 2 and 4.

### §0.2 Condition 2 — per table — MEASURED

The calendar's own four tables have no `show_id`. The two that carry a
partition column carry `series_id`, a nullable UUID. No foreign key, model
association or other code gives it a parent:

```
$ for m in StoryClockMarker StoryCalendarEvent CalendarEventAttendee CalendarEventRipple; do printf "%s show_id=%s series_id_line=%s tableName_line=%s\n" $m "$(git show 98dd2e3a:src/models/$m.js | grep -c show_id)" "$(git show 98dd2e3a:src/models/$m.js | grep -n 'series_id' | cut -d: -f1 | tr '\n' ,)" "$(git show 98dd2e3a:src/models/$m.js | grep -n tableName | cut -d: -f1)"; done
StoryClockMarker show_id=0 series_id_line=39, tableName_line=46
StoryCalendarEvent show_id=0 series_id_line=106, tableName_line=134
CalendarEventAttendee show_id=0 series_id_line= tableName_line=57
CalendarEventRipple show_id=0 series_id_line= tableName_line=60
$ git show 98dd2e3a:src/migrations/20260312200000-story-calendar.js | sed -n '64,68p;163,166p'
      series_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Scoped to novel or show; never cross',
      },
      series_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
```

Loading the model registry confirms the associations (script in §2, Script 2;
no query is issued):

```
StoryClockMarker: show_id=false series_id=true associations=events
StoryCalendarEvent: show_id=false series_id=true associations=marker,attendees,ripples,sourceLine,location,spawnedEvents
CalendarEventAttendee: show_id=false series_id=false associations=event,character
CalendarEventRipple: show_id=false series_id=false associations=event,affectedCharacter
```

The migration's column comment says what `series_id` is for ("novel or
show"). Code does not say which, and nothing joins it to `shows` or
`book_series`. **Whether stored `series_id` values are show ids can only be
settled against data, and this note makes no database contact.** Under the
episodes.js slice's test the column is not a show, and it has no parent.

| Table | Model citation | Carries a show? | Condition 2 |
| --- | --- | --- | --- |
| `story_clock_markers` | `StoryClockMarker.js:39` (`series_id`), `:46` | No `show_id`; `series_id` has no parent | **Not met** |
| `story_calendar_events` | `StoryCalendarEvent.js:106` (`series_id`), `:134` | No `show_id`; `series_id` has no parent | **Not met** |
| `calendar_event_attendees` | `CalendarEventAttendee.js:22` (`event_id`), `:26` (`character_id`, nullable), `:30` (`feed_profile_id`), `:57` | Not through `event_id`. Through `character_id` → `registry_characters.registry_id` (`RegistryCharacter.js:26`) → `character_registries.show_id` (`CharacterRegistry.js:18`, nullable) | **Met for rows with a `character_id`**; not for feed-profile-only rows |
| `calendar_event_ripples` | `CalendarEventRipple.js:22` (`event_id`), `:26` (`affected_character_id`, nullable), `:60` | As attendees, through `affected_character_id` | **Met for rows with an `affected_character_id`** |
| `registry_characters` | `RegistryCharacter.js:26`, `:644` | Through its registry, `CharacterRegistry.js:18` | **Met** |
| `world_events` | `WorldEvent.js:17` (`show_id`) | Directly | **Met** |
| `world_locations` | `WorldLocation.js:11` (`universe_id`) | No; a universe, not a show | **Not met** |
| `social_profiles` (helpers only) | `SocialProfile.js:28` (`series_id`, INTEGER), `:223` | No `show_id` | **Not met** |

```
$ git show 98dd2e3a:src/models/CharacterRegistry.js | sed -n 18,21p
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
$ git show 98dd2e3a:src/models/WorldLocation.js | sed -n 11,12p
    universe_id: {
      type: DataTypes.UUID,
$ git show 98dd2e3a:src/models/WorldEvent.js | sed -n 17,18p
    show_id: {
      type: DataTypes.UUID,
```

## §1. The probe, re-run and reconciled — MEASURED

```
$ ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('; SQL='\bSELECT\b'; QT='QueryTypes\.SELECT'; REQ='req\.(params|body|query)'
$ for b in 7a17a2e7 98dd2e3a; do f=$(git show $b:src/routes/calendarRoutes.js); echo "$b lines=$(echo "$f" | wc -l) orm=$(echo "$f" | grep -cE "$ORM") select=$(echo "$f" | grep -E "$SQL" | grep -vcE "$QT") req=$(echo "$f" | grep -E "$ORM|$SQL" | grep -vE "$QT" | grep -cE "$REQ")"; done
7a17a2e7 lines=755 orm=15 select=1 req=8
98dd2e3a lines=755 orm=15 select=1 req=8
$ git diff --quiet 7a17a2e7 98dd2e3a -- src/routes/calendarRoutes.js && echo identical
identical
$ git log --oneline 7a17a2e7..98dd2e3a -- src/routes/calendarRoutes.js
$
```

**Reconciliation with the scoping note's 16** (§3 row: `15 1 16 8`): the file
is byte-identical to the note's basis, and no site was added, removed or
moved. The 16 sites:

```
$ git show 98dd2e3a:src/routes/calendarRoutes.js | grep -nE "$ORM|$SQL" | grep -vE "$QT"
76:    const markers = await StoryClockMarker.findAll({
130:      const marker = await StoryClockMarker.findByPk(req.params.id, { transaction, lock: true });
171:    const events = await StoryCalendarEvent.findAll({
232:    const event = await StoryCalendarEvent.findByPk(req.params.id);
246:    const event = await StoryCalendarEvent.findByPk(req.params.id);
264:    const attendees = await CalendarEventAttendee.findAll({
283:    const event = await StoryCalendarEvent.findByPk(req.params.id);
310:    const attendee = await CalendarEventAttendee.findOne({
331:    const event = await StoryCalendarEvent.findByPk(req.params.id);
335:    const attendees = await CalendarEventAttendee.findAll({
410:    const ripple = await CalendarEventRipple.findByPk(req.params.id);
433:    const events = await StoryCalendarEvent.findAll({
511:    const calendarEvent = await StoryCalendarEvent.findByPk(req.params.id, {
615:      const events = await models.WorldEvent.findAll({
626:      `SELECT * FROM world_events WHERE source_calendar_event_id = :id ORDER BY created_at DESC`,
646:    const calendarEvent = await StoryCalendarEvent.findByPk(req.params.id);
```

The eight with `req.*` on the same line are `:130`, `:232`, `:246`, `:283`,
`:331`, `:410`, `:511` and `:646`. `:264`, `:310`, `:615` and `:626` also take
`req.params` on the next line (`:265`, `:311`, `:616`, `:627`). `:76` and
`:171` take `req.query` filters through a `where` built on earlier lines. The
one `SELECT` (`:626`) is a real read, not a comment or prompt string.

## §2. Mount and auth, re-checked at this basis — MEASURED

### The mount

```
$ git show 98dd2e3a:src/app.js | grep -n -E "calendar"
1373:  const calendarRoutes = require('./routes/calendarRoutes');
1374:  app.use('/api/v1/calendar', calendarRoutes);
1375:  console.log('✓ Calendar routes loaded at /api/v1/calendar');
$ git show 98dd2e3a:src/app.js | sed -n 1371,1378p
// Story Calendar — temporal spine
try {
  const calendarRoutes = require('./routes/calendarRoutes');
  app.use('/api/v1/calendar', calendarRoutes);
  console.log('✓ Calendar routes loaded at /api/v1/calendar');
} catch (e) {
  console.error('✗ Failed to load Calendar routes:', e.message);
}
```

| Mount | Router | Middleware on the mount | Condition |
| --- | --- | --- | --- |
| `:1374` | `calendarRoutes` (`routes/calendarRoutes.js`) | none (bare) | inside `try` (`:1372–1378`), under the "FEED NERVOUS SYSTEM ROUTES" banner: mounted only if the `require` succeeds |

It is the only mount of `/api/v1/calendar`, and no `app.get`/`app.post`/…
names that path.

### What runs before `:1374`

Every `app.use`/`app.all`/verb call before `:1374` whose path is not a
different `/api/v1/<name>` prefix:

```
$ git show 98dd2e3a:src/app.js | awk 'NR<1374' | grep -n -E "app\.(use|all|get|post|put|delete)\(" | grep -v -E "app\.(use|all|get|post|put|delete)\('/api/v1/[a-z]" | grep -v "^\s*[0-9]*:\s*//"
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
1271:  app.use('/api/v1', franchiseBrainRoutes);
```

`:204`–`:275` are the global layers the episodes.js slice named (CORS,
development-only logging, helmet, body parsers, `attachRBAC`,
`captureResponseData`, two `/api` rate limiters). `:138`, `:360` and `:370`
are exact paths, and `:869`–`:965` and `:1208` are other prefixes. None of
these touches `/api/v1/calendar` except the global layers and limiters, and
none resolves a show.

**Sixteen routers are mounted at `/api/v1` itself before `:1374`.** Express
enters each of them for every `/api/v1/calendar/...` request. So each could
answer a calendar path first, or run router-level middleware on it. Script 1
below tests both.

### Which router answers each path, and `requireAuth` on each route

Method, as in the episodes.js slice: load the real routers in Node and use
Express's own layer matching (`layer.match`). Every `:param` becomes a UUID.
Two scripts, run with `node <script> <outfile>` from the repo root. Both live
in the session scratchpad and neither is committed. `<repo>` stands for the
checkout's absolute path.

**Script 1** loads `calendarRoutes` and lists its routes with each route's
middleware and the router's non-route layers. It then checks that each
calendar path is answered by its own route. Finally, for each of the sixteen
`/api/v1` routers mounted earlier, it counts non-route layers matching
`/calendar/events` and routes of the same method matching
`/calendar<path>`:

```js
// Loads calendarRoutes and every router mounted at /api/v1 before app.js:1374,
// and asks Express's own layers which of them would handle each calendar path (Task #2038).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const path = require('path');
const root = '<repo>/src/routes/';
const earlier = [
  [756, 'markers'], [765, 'export'], [777, 'beats'], [778, 'character-clips'], [779, 'audio-clips'],
  [780, 'animatic'], [803, 'evaluation'], [807, 'world'], [811, 'worldEvents'], [817, 'eventDeliverables'],
  [825, 'worldStudio'], [830, 'careerGoals'], [839, 'arcRoutes'], [1060, 'arcTrackingRoutes'],
  [1262, 'upgradeRoutes'], [1271, 'franchiseBrainRoutes'],
];
const U = '00000000-0000-4000-8000-000000000000';
const cal = require(path.join(root, 'calendarRoutes'));
const calRows = cal.stack.filter(l => l.route).map(l => ({
  m: Object.keys(l.route.methods).map(x => x.toUpperCase()), p: l.route.path,
  mw: l.route.stack.map(s => s.name || '<anon>'),
}));
const calUse = cal.stack.filter(l => !l.route).map(l => l.name || '<anon>');
const out = [];
out.push('calendar routes ' + calRows.length + '; non-route layers: ' + JSON.stringify(calUse));
calRows.forEach(r => out.push('  ' + r.m.join(',') + ' ' + r.p + ' [' + r.mw.join(', ') + ']'));
// which calendar route answers each calendar path first (its own order)
const self = [];
calRows.forEach(r => {
  const sample = r.p.replace(/:[A-Za-z_]+/g, U);
  for (const m of r.m) {
    const hit = cal.stack.find(l => l.route && l.route.methods[m.toLowerCase()] && l.match(sample));
    if (!hit || hit.route.path !== r.p) self.push(m + ' ' + sample + ' -> ' + (hit ? hit.route.path : null));
  }
});
out.push('calendar paths answered by a different calendar route: ' + self.length);
self.forEach(x => out.push('  ' + x));
out.push('control GET /events/feed-templates -> ' + (cal.stack.find(l => l.route && l.route.methods.get && l.match('/events/feed-templates')) || {route:{path:null}}).route.path);
out.push('control GET /no-such-route -> ' + ((cal.stack.find(l => l.route && l.route.methods.get && l.match('/no-such-route')) || {route:{path:null}}).route.path));
out.push('earlier /api/v1 routers:');
for (const [line, name] of earlier) {
  let r; try { r = require(path.join(root, name)); } catch (e) { out.push('  ' + line + ' ' + name + ' LOAD ERROR ' + e.message.split('\n')[0]); continue; }
  const uses = r.stack.filter(l => !l.route);
  const usesHit = uses.filter(l => l.match('/calendar/events')).map(l => l.name || '<anon>');
  const routes = r.stack.filter(l => l.route);
  const hits = [];
  for (const c of calRows) {
    const sample = '/calendar' + c.p.replace(/:[A-Za-z_]+/g, U);
    for (const m of c.m) {
      const h = routes.find(l => l.route.methods[m.toLowerCase()] && l.match(sample));
      if (h) hits.push(m + ' ' + sample + ' -> ' + h.route.path);
    }
  }
  out.push('  ' + line + ' ' + name + ': routes=' + routes.length + ' nonRouteLayers=' + uses.length + ' nonRouteMatchingCalendar=' + JSON.stringify(usesHit) + ' routeHits=' + hits.length);
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

Its output, the whole file it writes:

```
$ node cal1.js cal1.out >/dev/null 2>&1; echo exit=$?; cat cal1.out
exit=0
calendar routes 19; non-route layers: ["requireAuth"]
  GET /markers [<anonymous>]
  POST /markers [requireAuth, <anonymous>]
  PUT /markers/:id/set-present [requireAuth, <anonymous>]
  GET /events [<anonymous>]
  POST /events [requireAuth, <anonymous>]
  PUT /events/:id [requireAuth, <anonymous>]
  DELETE /events/:id [requireAuth, <anonymous>]
  GET /events/:id/attendees [<anonymous>]
  POST /events/:id/attendees [requireAuth, <anonymous>]
  PUT /events/:id/attendees/:attendeeId [requireAuth, <anonymous>]
  POST /events/:id/ripples/generate [requireAuth, <anonymous>, <anonymous>]
  PUT /ripples/:id/confirm [requireAuth, <anonymous>]
  GET /simultaneous [<anonymous>]
  POST /auto-detect [requireAuth, <anonymous>, <anonymous>]
  POST /events/:id/spawn-world-event [requireAuth, <anonymous>]
  GET /events/:id/spawned [requireAuth, <anonymous>]
  POST /events/:id/auto-spawn [requireAuth, <anonymous>]
  POST /events/generate-seasonal [requireAuth, <anonymous>]
  GET /events/feed-templates [<anonymous>]
calendar paths answered by a different calendar route: 0
control GET /events/feed-templates -> /events/feed-templates
control GET /no-such-route -> null
earlier /api/v1 routers:
  756 markers: routes=7 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  765 export: routes=6 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  777 beats: routes=5 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  778 character-clips: routes=5 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  779 audio-clips: routes=5 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  780 animatic: routes=6 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  803 evaluation: routes=6 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  807 world: routes=4 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  811 worldEvents: routes=63 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  817 eventDeliverables: routes=5 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  825 worldStudio: routes=53 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  830 careerGoals: routes=7 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  839 arcRoutes: routes=7 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  1060 arcTrackingRoutes: routes=3 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  1262 upgradeRoutes: routes=16 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
  1271 franchiseBrainRoutes: routes=16 nonRouteLayers=0 nonRouteMatchingCalendar=[] routeHits=0
control worldEvents GET /world/00000000-0000-4000-8000-000000000000/events -> /world/:showId/events
```

**Script 2** loads the model registry and reports the attributes and
associations §0.2 relies on. It issues no query: `src/models/index.js`
constructs Sequelize and calls `authenticate()` only from its exported
`authenticate`/`healthCheck` helpers (`:1770`, `:1906`), which the script does
not call. The session has no database variables set.

```js
// Loads the model registry (no query is issued) and reports the attributes
// and associations the calendar sites depend on (Task #2038).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const m = require('<repo>/src/models');
const out = [];
out.push('WorldEvent has source_calendar_event_id attribute: ' + !!m.WorldEvent.rawAttributes.source_calendar_event_id);
for (const n of ['StoryClockMarker', 'StoryCalendarEvent', 'CalendarEventAttendee', 'CalendarEventRipple']) {
  const a = m[n].rawAttributes;
  out.push(n + ': show_id=' + !!a.show_id + ' series_id=' + !!a.series_id + ' associations=' + Object.keys(m[n].associations).join(','));
}
out.push('RegistryCharacter associations: ' + Object.keys(m.RegistryCharacter.associations).join(','));
require('fs').writeFileSync(process.argv[2], out.join('\n') + '\n');
setTimeout(() => process.exit(0), 50);
```

```
$ node cal2.js cal2.out >/dev/null 2>&1; echo exit=$?; cat cal2.out
exit=0
WorldEvent has source_calendar_event_id attribute: true
StoryClockMarker: show_id=false series_id=true associations=events
StoryCalendarEvent: show_id=false series_id=true associations=marker,attendees,ripples,sourceLine,location,spawnedEvents
CalendarEventAttendee: show_id=false series_id=false associations=event,character
CalendarEventRipple: show_id=false series_id=false associations=event,affectedCharacter
RegistryCharacter associations: memories,registry,socialProfiles,followProfiles
```

`WorldEvent.js` does not declare `source_calendar_event_id`. The comment at
`:99` says "may not exist". The attribute is injected by
`StoryCalendarEvent`'s `hasMany(WorldEvent, { foreignKey:
'source_calendar_event_id' })` (`StoryCalendarEvent.js:28–31`), so the
`where` at `:616` and the create at `:565` both carry it. Whether the column
exists in any database (migration `20260711000000`) is not measured here.

What the scripts establish:

- **Every path `calendarRoutes.js` defines is answered by its own route**
  (0 answered by a different calendar route). The controls show the matcher
  resolves a real path and rejects an undefined one. **No earlier `/api/v1`
  router answers any calendar path**: 0 route hits across their 214 routes
  (7 + 6 + 5 + 5 + 5 + 6 + 6 + 4 + 63 + 5 + 53 + 7 + 7 + 3 + 16 + 16), and a
  control shows the same matcher does resolve an earlier router's own path.
  **None of the sixteen has a router-level layer**, so nothing of theirs runs
  on a calendar request.
- **`requireAuth` applies to all 19 routes**, through the router-level
  `router.use(requireAuth)` (`:41`), the router's only non-route layer. 14
  routes also name it on the route. The five that rely only on the
  router-level layer are the GETs `/markers`, `/events`,
  `/events/:id/attendees`, `/simultaneous` and `/events/feed-templates`. The
  second anonymous function on `/events/:id/ripples/generate` and
  `/auto-detect` is `aiRateLimiter` (`:327`, `:458`).
- **The file's header comment is stale**: `:10–32` lists 15 routes; the router
  has 19. This is recorded only; it changes no classification.
- **No input validation** on any `:id`: no route carries `validateUUIDParam`,
  as the list above shows. (The episodes.js slice recorded this the same way.)

## §3. The sites — one row each

Paths are relative to `/api/v1/calendar`. "Id source" says where the
identifier comes from. "Scope" answers condition 3 (never met; §0.1).
"Returns" answers condition 4. Condition 2 is per table, from §0.2.

| # | Site | Handler | Reads | Id source | Scope | Returns (condition 4) | Auth | Classification — reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `:76` | `GET /markers` (`:71`) | `StoryClockMarker` where optional `series_id` | `req.query.series_id` (`:75`), optional | none | every matching marker (`:80`); all markers when the filter is omitted | `requireAuth` (router) | **Not an instance** — condition 2: `story_clock_markers` carries no show (§0.2) |
| 2 | `:130` | `PUT /markers/:id/set-present` (`:124`) | `StoryClockMarker` by pk, locked | `req.params.id` | none | the marker after the update (`:141`) | `requireAuth` | **Not an instance** — condition 2 (§0.2) |
| 3 | `:171` | `GET /events` (`:157`) | `StoryCalendarEvent` by optional filters, with `StoryClockMarker` (`marker`) | `req.query.series_id`, `story_position`, and four non-identifier filters (`:161–169`), all optional | none | every matching event with its marker's `id`, `name`, `sequence_order` (`:171–176`); all events when no filter is given | `requireAuth` (router) | **Not an instance** — condition 2: neither table carries a show |
| 4 | `:232` | `PUT /events/:id` (`:229`) | `StoryCalendarEvent` by pk | `req.params.id` | none | the event after `update(req.body)`, stored fields included (`:234–235`) | `requireAuth` | **Not an instance** — condition 2 |
| 5 | `:246` | `DELETE /events/:id` (`:243`) | `StoryCalendarEvent` by pk | `req.params.id` | none | `success`, `message` only; 404 if missing (`:247–249`) | `requireAuth` | **Not an instance** — gates the delete; condition 2 also fails. Note: existence |
| 6 | `:264` | `GET /events/:id/attendees` (`:261`) | `CalendarEventAttendee` where `event_id`, with `RegistryCharacter` (`character`: `id`, `selected_name`, `display_name`, `role_type`) | `req.params.id` (`:265`) | none | every attendee row on that event, with its character's four fields (`:264–272`) | `requireAuth` (router) | **Instance** — for attendee rows with a `character_id`, which carry a show through the character (§0.2). The response returns those characters' names and role type, chosen through a caller-supplied event id |
| 7 | `:283` | `POST /events/:id/attendees` (`:280`) | `StoryCalendarEvent` by pk | `req.params.id` | none | the created attendee, built from `req.params.id` and the body (`:293–299`); 404 if missing | `requireAuth` | **Not an instance** — gates the insert; condition 2 also fails. Note: existence |
| 8 | `:310` | `PUT /events/:id/attendees/:attendeeId` (`:307`) | `CalendarEventAttendee` where `id` and `event_id` | `req.params.attendeeId`, `req.params.id` (`:311`) | none (the `event_id` pairing is a consistency check between two caller values, not a tenant) | the attendee after `update(req.body)`: `character_id`, `what_they_experienced`, `author_note` and the rest wherever the body omits them (`:314–315`) | `requireAuth` | **Instance** — for an attendee with a `character_id` (§0.2). Returns a character's stored experience and notes the caller did not send |
| 9 | `:331` | `POST /events/:id/ripples/generate` (`:327`) | `StoryCalendarEvent` by pk | `req.params.id` | none | nothing from the row directly. Its `title`, `what_world_knows` and `what_only_we_know` go into the model prompt (`:362–365`), and the returned `proposed_thread`s are model output | `requireAuth`, `aiRateLimiter` | **Not an instance** — condition 2: `story_calendar_events` carries no show |
| 10 | `:335` | `POST /events/:id/ripples/generate` (`:327`) | `CalendarEventAttendee` where `event_id`, with the full `RegistryCharacter` | `event.id` from #9, i.e. `req.params.id` | none | ripples whose `affected_character_id` is an attendee's `character_id`, resolved by matching the model's name to the character's `selected_name`/`display_name` (`:387–389`), and whose `proposed_thread` is model output from a prompt carrying the characters' names and `what_they_experienced` (`:345–348`, `:367–368`), returned at `:399` | as #9 | **Instance** — character ids and derived text from show-partitioned characters (that the text reflects them is INFERRED: model output) |
| 11 | `:410` | `PUT /ripples/:id/confirm` (`:407`) | `CalendarEventRipple` by pk | `req.params.id` | none | the ripple after the flag is set, including `affected_character_id` and `proposed_thread` (`:412–414`) | `requireAuth` | **Instance** — for a ripple with an `affected_character_id` (§0.2). Returns its stored thread about that character |
| 12 | `:433` | `GET /simultaneous` (`:426`) | `StoryCalendarEvent` by time window, with `CalendarEventAttendee` and `RegistryCharacter` | none: `req.query.datetime` (`:429`) is a moment, not an identifier | none | every event active at that moment, each with its attendees and their characters' four fields (`:433–450`) | `requireAuth` (router) | **Not an instance** — condition 1: no rows are chosen by a caller-supplied identifier. Note: the response is unfiltered by series or show (see "Observed, not ruled") |
| 13 | `:511` | `POST /events/:id/spawn-world-event` (`:504`) | `StoryCalendarEvent` by pk, with `WorldLocation` (`location`) | `req.params.id` | none | `calendar_event_title` (`:575`), and a new world event whose `name`, `description`, `venue_*`, `location_hint`, `prestige` and `narrative_stakes` are copied from the row and its location (`:548–568`) | `requireAuth` | **Not an instance** — condition 2: neither `story_calendar_events` nor `world_locations` carries a show. The body's `show_id` (`:523`) is only written (`:549`) |
| 14 | `:615` | `GET /events/:id/spawned` (`:611`) | `WorldEvent` where `source_calendar_event_id` | `req.params.id` (`:616`) | none | every matching world event's `id`, `name`, `event_type`, `status`, `prestige`, `cost_coins`, `created_at` (`:620–622`) | `requireAuth` | **Instance** — world events of any show, listed by a caller-chosen calendar event id |
| 15 | `:626` | `GET /events/:id/spawned` (`:611`), fallback | raw `SELECT *` from `world_events` where `source_calendar_event_id` | `req.params.id` (`:627`) | none | every column of every matching world event (`:629`) | as #14 | **Instance** — as #14, all columns. Reached only when `models.WorldEvent` is falsy (`:614`). `src/models/index.js:373` registers it with no condition, so the branch is INFERRED unreachable at this basis. Classified, like the episodes.js slice, by what the site can return |
| 16 | `:646` | `POST /events/:id/auto-spawn` (`:640`) | `StoryCalendarEvent` by pk | `req.params.id` | none | `source.title` (`:689`, `:700`), and created events built from the row (`title`, `what_world_knows`, `what_only_we_know`, `activities`) by the helper (R2) | `requireAuth` | **Not an instance** — condition 2: `story_calendar_events` carries no show. The body's `show_id` (`:649`) is only written (`eventAutomationService.js:710`) |

### Found by reading, not by the probe

`calendarRoutes.js` has no probe-missed read form of its own: no `.count(`,
`.findOrCreate(`, association getter or other `sequelize.query` read. Its
other `sequelize.query` (`:583`) is an `INSERT`:

```
$ git show 98dd2e3a:src/routes/calendarRoutes.js | grep -n -E "\.(count|findOrCreate|max|min|sum|reload)\(|\.get[A-Z][A-Za-z]*\(|sequelize\.query|require\('\.\./(services|utils)"
39:const { withAutoScheduledDate } = require('../utils/eventDateDefault');
563:        prestige: req.body.prestige || Math.min(10, (calendarEvent.severity_level || 5) + 2),
583:    await models.sequelize.query(
625:    const [events] = await models.sequelize.query(
652:    const eventAutomation = require('../services/eventAutomationService');
653:    const requestedCount = Math.min(3, parseInt(event_count) || 1);
721:    const seasonalService = require('../services/seasonalEventService');
741:  const seasonalService = require('../services/seasonalEventService');
742:  const month = req.query.month !== undefined ? parseInt(req.query.month) : new Date().getMonth();
743:  const relevant = seasonalService.getRelevantTemplates(month);
```

(`:563` and `:653` are `Math.min`, not reads.) Two handlers read through
services outside `src/routes/`, which the probe does not see (scoping note
§2):

| # | Where | Form | Id source | Returns | Classification — reason |
| --- | --- | --- | --- | --- | --- |
| R1 | `:723` → `src/services/seasonalEventService.js:73` | `StoryCalendarEvent.findAll` where `event_type: 'lalaverse_cultural'` and a month window (`:73–82`) | none: `month`, `year` from the body are a window, not an identifier | existing titles feed the prompt and the de-duplication (`:83`, `:97`, `:136`). The response carries the newly created events (`:161`) | **Not an instance** — condition 1 (no identifier) and condition 2 (`story_calendar_events`). The body's `show_id` is passed in (`:723`) and never used by the function (`:60–161`) |
| R2 | `:660` → `src/services/eventAutomationService.js` `spawnEventsFromCalendar` (`:577`) | ten helper reads: `SocialProfile.findAll` (`:130`, `:149`, `:464`, `:501`), `SocialProfileRelationship.findAll` (`:425`), `WorldLocation.findOne` (`:227`, `:241`, `:253`, `:260`, `:281`) | none from the caller: fixed filters (status, feed layer, tier, venue type), the calendar row's own fields, and ids taken from other rows (the host's `frequent_venues`, relationship ids) | the host's name and handle, venue name and address, and guest names, in the created events and `details` (`:671–682`) | **Not an instance** — condition 1 (rows not chosen by a caller-supplied identifier) and condition 2 (`social_profiles`, `world_locations` carry no show) |

```
$ git show 98dd2e3a:src/services/eventAutomationService.js | grep -n -E "\.(count|findOrCreate|max|min|sum)\(|\.get[A-Z][A-Za-z]*\(|sequelize\.query|findAll|findOne|findByPk"
130:    candidates = await SocialProfile.findAll({
149:    candidates = await SocialProfile.findAll({
190:    score += Math.min(10, Math.round((p.lala_relevance_score || 0)));
227:      const hostVenue = await WorldLocation.findOne({
241:      const cityVenue = await WorldLocation.findOne({
253:  let venue = await WorldLocation.findOne({
260:    venue = await WorldLocation.findOne({
281:    const existing = await WorldLocation.findOne({
425:      const relationships = (await SocialProfileRelationship.findAll({
464:        const relatedProfiles = await SocialProfile.findAll({
501:    const candidatePool = await SocialProfile.findAll({
506:      limit: Math.max(20, maxGuests * 3),
638:    const prestige = Math.min(10, (calendarEvent.severity_level || 5) + Math.floor(Math.random() * 3));
643:    const strictness = Math.min(10, prestige + Math.floor(Math.random() * 2));
737:        await models.sequelize.query(
757:        await models.sequelize.query(
$ git show 98dd2e3a:src/services/seasonalEventService.js | grep -n -E "findAll|findOne|findByPk|findOrCreate|count\(|SELECT|show_id|showId"
55: * @param {string} showId
60:async function generateSeasonalEvents(month, showId, models, options = {}) {
73:  const existing = await StoryCalendarEvent.findAll({
```

(`eventAutomationService.js:737` and `:757` open `INSERT INTO world_events`
statements, `:738` and `:758`. `seasonalEventService.js` names `showId` only
in its JSDoc and signature.)

**Handlers without a probe site.** All 19 routes have their body in the
file; 14 hold the 16 sites. The other five: `POST /markers` (`:88`) and
`POST /events` (`:184`) create rows and read none; `POST /auto-detect`
(`:458`) calls the model only; `GET /events/feed-templates` (`:740`) returns
static templates; and `POST /events/generate-seasonal` (`:714`) reads only
through R1.

## §4. The helpers the sites depend on — MEASURED

- **`eventAutomationService.spawnEventsFromCalendar`** (#16, R2): read at the
  lines in R2. Its only use of `showId` is the `show_id` written onto created
  events (`:710`, and the raw-SQL fallbacks `:737`/`:757`). No read is
  filtered by it. It calls `episodeGeneratorService.buildSocialTasks`
  (`:677`), whose body issues no query (`Array.prototype.find` only).
- **`seasonalEventService.generateSeasonalEvents`** (R1): read at `:60–161`.
  It makes one read (`:73`) and ignores `showId`.
- **`withAutoScheduledDate`** (`utils/eventDateDefault.js`, #13): no model or
  query. `git show 98dd2e3a:src/utils/eventDateDefault.js | grep -n -E
  "require\(|find|query"` prints nothing.

No classification here is **cannot tell**. Every helper a site depends on was
read.

## §5. Totals

| | Probe sites (16) | Found by reading (2) | All (18) |
| --- | --- | --- | --- |
| **Instances** | **6** — #6, 8, 10, 11, 14, 15 | 0 | **6** |
| **Not instances** | **10** — #1, 2, 3, 4, 5, 7, 9, 12, 13, 16 | **2** — R1, R2 | **12** |
| **Cannot tell** | 0 | 0 | **0** |

Of the probe's 16, **6 are instances**: #6, 8, 10, 11, 14, 15. **10 are not**.

Why the ten are not instances:

- **Condition 2** (no show on `story_clock_markers` or
  `story_calendar_events`): #1, 2, 3, 4, 9, 13, 16.
- **Gates** (existence at most, and condition 2 also fails): #5, 7.
- **Condition 1** (a time window, not an identifier): #12.

Four of the six instances (#6, 8, 10, 11) turn on one reading in §0.2:
attendee and ripple rows carry a show through their character. Two (#14, 15)
read `world_events`, which carries `show_id` directly.

**Beside them, for comparison only: the write probe** (v1.49 §52.2's
`\.destroy\(|DELETE FROM`) on this file finds one site:

```
$ git show 98dd2e3a:src/routes/calendarRoutes.js | grep -nE '\.destroy\(|DELETE FROM'
248:    await event.destroy();
```

`:248` destroys the row #5 gates, in `story_calendar_events` (condition 2
not met under this note's reading). Recorded as an observation only.

## Observed, not ruled

- **`series_id` decides much of this file.** If a later reading, with the
  data, established that `series_id` holds show ids, condition 2 would change
  for `story_clock_markers` and `story_calendar_events`. #1–4, #9, #13 and #16
  would then need re-reading. This note does not make that reading. It needs
  the database, and it would widen the episodes.js slice's test.
- **The rule does not reach unfiltered reads.** #12, and #1 and #3 with no
  filter, return every row in their tables to any authenticated caller.
  Condition 1 cannot hold where no identifier is supplied. Whether that shape
  belongs in the reads slice is for the Fix Plan revision; it is not decided
  here.
- **#8's pairing** (`id` and `event_id` both from the caller) is a
  consistency check, not a tenant. It is recorded so a later reader does not
  mistake it for scoping.

## What this document does not do

- Mints no FD, XK or PE.
- Rules nothing. Closes nothing. The reads slice stays owed until a Fix Plan
  revision rules on it; the classifications here are its input.
- Changes no code.
- Does not read any route file other than `calendarRoutes.js`. The two
  services in R1/R2 and the one util in §4 are read only because sites here
  depend on them. The earlier `/api/v1` routers are loaded only to test mount
  order (§2), not read.
- Does not check whether the sixteen earlier `/api/v1` routers collide with
  each other.
- Does not settle what `series_id` refers to, and makes no data claim.
- Does not edit any filed document.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito
  or GitHub-settings contact.

**The next file, by the scoping note's counts, not read here.** In the note's
§3 table (sorted by total), `calendarRoutes.js` (16; 8 with `req.*`) is
followed by `franchiseBrainRoutes.js`: 16 sites (16 ORM, 0 SELECT), 6 with
`req.*` on the same line, tied at 16. The table lists it next.
`upgradeRoutes.js` (16, 2) follows it. Which file comes next is not chosen
here.

## Footer

**Type:** standalone note, the reads slice's second file. **Rules:** nothing.
**Mints:** nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1). Agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `98dd2e3a3220e7d5dd2042262df58e91e509e67b`.*
*Authority: `F-Stats-1_ReadsSlice_episodes_2026-09-27.md` ("The rule",
"Adapted for reads"), applied unchanged; `F-Stats-1_ReadsSlice_Scoping_2026-09-26.md`
§2, §3. Every `file:line` MEASURED at the basis above unless marked INFERRED.
Task: #2038.*
