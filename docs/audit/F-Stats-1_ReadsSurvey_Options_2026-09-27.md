# F-Stats-1 Phase B — Reads Survey, Options for Closing Item 1

*Standalone read-and-options note. Sets out, from measured evidence, the ways
F-Stats-1 Phase B item 1 (the reads survey) could close, with what each costs
and proves. Rules nothing, recommends nothing, mints nothing, closes nothing.
The choice is Evoni's, for a Fix Plan revision.*

## Purpose

Five reads slices are filed. Before a sixth, this note asks how the survey
ends: read every remaining file, read only the files that can hold an
instance, or rule the pattern and move to a remedy. It measures what each
path would read and what it would prove, so the ruling revision can choose
with numbers in hand.

## H1 — Basis

```
$ git rev-parse origin/main
574cc9117e9f3564559753f21281f4e569753b70
```

MEASURED. Date: 2026-09-27. Every count below is at this SHA unless it names
another basis. The scoping note's basis is `7a17a2e7`.

## The obligation, quoted

**v1.49 §52.6** (`F-Stats-1_Fix_Plan_v1.49.md:198`), "The reads slice — owed,
and stated so it is not forgotten":

> "A reads slice over the same 120-file complement is owed. The trade taken
> here is deliberate and is recorded as a trade: destructive writes first
> because they are unrecoverable, reads second because they are not."

**The 2026-09-10 note, Item 1**, as the scoping note quotes it
(`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md:48–52`): "To close: open and
survey the read-handler population across the same route files Rule 2
already covers for writes — a repo grep/read exercise, no live system
contact." Marked AGENT-DOABLE.

**The scoping note, §3** (`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md:271`,
`:277–279`): 906 sites in 81 files outside the four v1.44 §47.2 exclusions;
"At 906 sites outside the exclusions, the reads slice is a program, not a
session."

Neither text says what "survey" must cover to close: every site, every file,
or enough to establish the shape. That is the question this note sets out.

## §1. The evidence so far — the five filed slices

Each row is the slice's own §5 totals. "All" counts probe sites plus reads
found by reading.

```
$ for f in episodes calendarRoutes franchiseBrainRoutes upgradeRoutes memoriesCore; do printf "%s: " $f; grep -m1 -E '^\| \*\*Instances\*\*' docs/audit/F-Stats-1_ReadsSlice_${f}_2026-09-27.md; done
episodes: | **Instances** | **13** — #1, 2, 5, 7, 8, 9, 10, 11, 13, 15, 16, 18, 19 | **4** — R1–R4 | **17** |
calendarRoutes: | **Instances** | **6** — #6, 8, 10, 11, 14, 15 | 0 | **6** |
franchiseBrainRoutes: | **Instances** | **0** | 0 | **0** |
upgradeRoutes: | **Instances** | **1** — #2 (latent) | 0 | **1** |
memoriesCore: | **Instances** | **10** — #1, #2, #3, #5, #8, #11, #12, #13, #14, #15 | **2** — R1, R2 | **12** |
```

| File | Slice | Sites (probe + by reading) | Instances | Not instances | Cannot tell | What decided most rows |
| --- | --- | --- | --- | --- | --- | --- |
| `episodes.js` | `F-Stats-1_ReadsSlice_episodes_2026-09-27.md` §5 | 19 + 4 = 23 | **17** | 6 | 0 | `episodes` carries a show; no tenant anywhere. The six not instances are five gates and one read into a write |
| `calendarRoutes.js` | `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md` §5 | 16 + 2 = 18 | **6** | 12 | 0 | Condition 2: the calendar's own tables were found to carry no show. The six instances reach a show through characters (attendees, ripples) and world events |
| `franchiseBrainRoutes.js` | `F-Stats-1_ReadsSlice_franchiseBrainRoutes_2026-09-27.md` §5 | 16 + 1 = 17 | **0** | 17 | 0 | Condition 2: no franchise table carries a show |
| `upgradeRoutes.js` | `F-Stats-1_ReadsSlice_upgradeRoutes_2026-09-27.md` §5 | 16 + 2 = 18 | **1**, latent | 17 | 0 | Condition 2 for most; the one instance (`:56`, a book) is latent because the next read fails (ATTESTED for production) |
| `memories/core.js` | `F-Stats-1_ReadsSlice_memoriesCore_2026-09-27.md` §5 | 15 + 2 = 17 | **12** | 5 | 0 | Condition 2 met for every table (books, chapters, lines, memories, characters); the five not instances only gate |
| **Five files** | | **82 + 11 = 93** | **36** | **57** | **0** | |

**The common finding, in the slices' own terms.** Every slice found condition
3 met at every site: "Nothing in the request path supplies a tenant"
(`…_episodes_…:98`, `…_calendarRoutes_…:54`, `…_franchiseBrainRoutes_…:41`,
`…_upgradeRoutes_…:43`, `…_memoriesCore_…:45`). The episodes.js slice gives
the reason at the data model: "`Show` has no owner, user or account column"
(`…_episodes_…:114`), and the later slices cite it (§0.1 in each). So the
count of instances in a file is decided by conditions 1, 2 and 4 alone: where
a table carries a show and a caller's id chooses the rows, the read is an
instance. None of the five slices found a site where a tenant check applied.

Condition 2 did most of the sorting: in the two files with no instances, and
for most of the not-instances in `upgradeRoutes.js`, the table carried no
show. That is what makes a mechanical pre-sort possible (§3).

## §2. The remaining population — MEASURED

Re-derived at this basis with the scoping note's own method (§1 of that note:
every `.js` under `src/routes/`; the complement is the files whose text does
not contain `:showId`; its §2 probe). The script in §3 does the counting; its
first lines of population output:

```
population at 574cc911: route files 142; carrying :showId 23; complement 119
complement files with >= 1 site: 85 (1053 sites)
  the four v1.44 §47.2 exclusions: 4 files, 147 sites
  read by the five slices: 5 files, 82 sites
  remaining: 76 files, 824 sites
```

| | Files | Sites |
| --- | --- | --- |
| Complement with ≥ 1 site | 85 | 1,053 |
| The four v1.44 §47.2 exclusions | 4 | 147 |
| Read by the five slices | 5 | 82 |
| **Remaining** | **76** | **824** |

This matches the scoping note at its basis: 906 outside the exclusions,
less the five slices' 82 probe sites, is 824. The per-file remaining counts
are in §3's per-file output (second column).

## §3. A mechanical pre-sort — MEASURED

### What it tests

The same test the calendarRoutes.js slice applied in §0.2: **does a table
carry a show, directly or through a parent in code.** Mechanically, over the
model registry:

- **Directly:** the model has a `show_id` attribute. `shows` itself counts as
  carrying (it is the partition).
- **Through a parent:** a `belongsTo` association, or an attribute
  `references`, to a model that carries one; iterated until nothing changes.

Then each remaining route file is sorted by which models and tables it
reaches, at three widths, because a file can read a show-less table and still
reach a show-carrying one by `include` (calendarRoutes.js #6 reaches its
characters that way):

- **T1, read line:** the model on each probe site's own line; for a raw
  `SELECT`, the tables in `FROM`/`JOIN` within its first six lines. A lower
  bound.
- **T2, code references:** T1, plus every model the file uses in code
  anywhere (`model: X`, `db.X`, `X.<query or write>(`, names destructured
  from the registry) and every table in any `FROM`/`JOIN`.
- **T3, any word:** any model or table name anywhere in the text, comments
  and prompt strings included. An upper bound, inflated by common words
  (`characters`, `scenes`, `shows`).

A file is **SHOW-LESS** at a width when nothing it reaches at that width
carries a show and every probe site is attributed to a registered show-less
model or table (no instance is then possible: condition 2 fails for every
site). **UNSORTED** when nothing carries a show but some site cannot be
attributed. **SHOW-CARRYING** otherwise. Show-carrying is not a finding: it
means only that the file must be read.

### The script and its raw output

Run from the checkout as `node <scratch>/sort.js <basis> <scratch>/sort.out`.
It loads the model registry and reads files with `git show` at the basis; it
issues no query (`src/models/index.js` authenticates only from its exported
`authenticate`/`healthCheck`, which the script does not call). It is not
committed. `<repo>` and `<scratch>` stand for the checkout's and the
scratchpad's absolute paths.

```js
// Pre-sort for the reads survey (Task #2058). Loads the model registry (no query
// is issued), decides for every registered model whether its table carries a
// show, then sorts each remaining complement route file at the basis by the
// models and tables it names. Run from the checkout:
//   node <scratch>/sort.js <basis> <outfile>
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const { execSync } = require('child_process');
const fs = require('fs');
const B = process.argv[2];
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 64 << 20 });
const db = require('<repo>/src/models');
const out = [];

// ── 1. Models: which tables carry a show ─────────────────────────────────────
// Directly: a show_id attribute. Through a parent: a belongsTo association, or
// an attribute `references`, to a model already carrying one. `shows` itself
// counts as carrying (it is the partition). Iterated to a fixed point.
const models = Object.values(db).filter(v => v && v.rawAttributes && typeof v.getTableName === 'function');
const byName = new Map(models.map(M => [M.name, M]));
const tableOf = (M) => { const t = M.getTableName(); return typeof t === 'string' ? t : t.tableName; };
const byTable = new Map(models.map(M => [tableOf(M), M]));
const carries = new Map(); // model name -> reason
models.forEach(M => {
  if (M.rawAttributes.show_id) carries.set(M.name, 'show_id');
  if (tableOf(M) === 'shows') carries.set(M.name, 'is shows');
});
const parents = (M) => {
  const p = [];
  Object.values(M.associations || {}).forEach(a => { if (a.associationType === 'BelongsTo') p.push([a.target.name, 'belongsTo ' + a.target.name + ' (' + a.foreignKey + ')']); });
  Object.entries(M.rawAttributes).forEach(([k, a]) => {
    const r = a.references && a.references.model; if (!r) return;
    const name = typeof r === 'string' ? (byTable.get(r) || {}).name : (r.name || (byTable.get(r.tableName) || {}).name);
    if (name) p.push([name, 'references ' + name + ' (' + k + ')']);
  });
  return p;
};
for (let changed = true; changed;) {
  changed = false;
  models.forEach(M => {
    if (carries.has(M.name)) return;
    const hit = parents(M).find(([n]) => carries.has(n));
    if (hit) { carries.set(M.name, 'via ' + hit[1]); changed = true; }
  });
}
const direct = [...carries.values()].filter(r => r === 'show_id' || r === 'is shows').length;
out.push(`models registered: ${models.length}; carry a show: ${carries.size} (directly ${direct}, through a parent ${carries.size - direct}); show-less: ${models.length - carries.size}`);
const files = sh(`git ls-tree --name-only ${B} src/models/`).split('\n').filter(f => f.endsWith('.js') && !f.endsWith('/index.js')).map(f => f.replace('src/models/', '').replace(/\.js$/, ''));
out.push(`model files under src/models (index.js aside): ${files.length}; with no registered model of that name: ${files.filter(f => !byName.has(f)).join(', ')}`);
out.push('carry a show:');
[...carries.entries()].sort().forEach(([n, r]) => out.push(`  ${n} (${tableOf(byName.get(n))}): ${r}`));
out.push('show-less:');
models.filter(M => !carries.has(M.name)).map(M => M.name).sort().forEach(n => out.push(`  ${n} (${tableOf(byName.get(n))})`));

// ── 2. The population at the basis (the scoping note's §1 method) ────────────
const all = sh(`git ls-tree -r --name-only ${B} src/routes`).split('\n').filter(f => f.endsWith('.js')).sort();
const text = new Map(all.map(f => [f, sh(`git show ${B}:${f}`)]));
const comp = all.filter(f => !text.get(f).includes(':showId'));
const EXCLUDED = ['worldStudio.js', 'characterRegistry.js', 'universe.js', 'relationships.js'].map(f => 'src/routes/' + f);
const READ = ['episodes.js', 'calendarRoutes.js', 'franchiseBrainRoutes.js', 'upgradeRoutes.js', 'memories/core.js'].map(f => 'src/routes/' + f);
const ORM = /\.(findByPk|findOne|findAll|findAndCountAll)\(/;
const SQL = /\bSELECT\b/; const QT = /QueryTypes\.SELECT/;
const sites = (t) => t.split('\n').map((l, i) => [i, l]).filter(([, l]) => ORM.test(l) || (SQL.test(l) && !QT.test(l)));
out.push(`\npopulation at ${B}: route files ${all.length}; carrying :showId ${all.length - comp.length}; complement ${comp.length}`);
const withSites = comp.filter(f => sites(text.get(f)).length > 0);
const sum = (fs_) => fs_.reduce((s, f) => s + sites(text.get(f)).length, 0);
out.push(`complement files with >= 1 site: ${withSites.length} (${sum(withSites)} sites)`);
const ex = withSites.filter(f => EXCLUDED.includes(f));
const rd = withSites.filter(f => READ.includes(f));
const rem = withSites.filter(f => !EXCLUDED.includes(f) && !READ.includes(f));
out.push(`  the four v1.44 §47.2 exclusions: ${ex.length} files, ${sum(ex)} sites`);
out.push(`  read by the five slices: ${rd.length} files, ${sum(rd)} sites`);
out.push(`  remaining: ${rem.length} files, ${sum(rem)} sites`);

// ── 3. Sort the remaining files, three ways ──────────────────────────────────
// For each file, the show-carrying models and tables it reaches, measured at
// three widths:
//   T1 read line : the model on each probe site's own line, and the tables a
//                  raw SELECT names in FROM/JOIN within its first six lines.
//                  A lower bound: it misses includes (calendarRoutes.js #6
//                  reaches its characters by include).
//   T2 code refs : T1, plus every model the file uses in code anywhere
//                  (`model: X`, `db.X` / `models.X`, `X.<query or write>(`,
//                  names destructured from the registry) and every table in
//                  any FROM/JOIN in the file.
//   T3 any word  : any model or table name anywhere in the text, comments and
//                  prompt strings included. An upper bound.
// A file is SHOW-LESS at a width when nothing it reaches at that width carries
// a show and every probe site is attributed to a registered show-less model or
// table; UNSORTED when nothing carries a show but a site cannot be attributed;
// otherwise SHOW-CARRYING.
const showSet = new Set(carries.keys());
const modelOfTable = (tb) => (byTable.get(tb) || {}).name;
const word = (w) => new RegExp('\\b' + w + '\\b');
const QUERY = 'findByPk|findOne|findAll|findAndCountAll|count|findOrCreate|create|bulkCreate|update|destroy|upsert|sum|max|min|increment|decrement|restore';
const rows = [];
const classify = (f) => {
  const t = text.get(f); const lines = t.split('\n');
  const t1 = new Set(); const unattributed = [];
  sites(t).forEach(([i, l]) => {
    const m = l.match(/(\w+)\.(findByPk|findOne|findAll|findAndCountAll)\(/);
    if (m) { if (byName.has(m[1])) t1.add(m[1]); else unattributed.push(`:${i + 1} receiver ${m[1]}`); return; }
    const win = lines.slice(i, i + 6).join(' ');
    const tabs = [...win.matchAll(/\b(?:FROM|JOIN)\s+"?([a-z_][a-z0-9_]*)"?/gi)].map(x => x[1]);
    tabs.forEach(x => { if (modelOfTable(x)) t1.add(modelOfTable(x)); });
    if (!tabs.length || tabs.some(x => !modelOfTable(x))) unattributed.push(`:${i + 1} SELECT ${tabs.join(',') || '(no table found)'}`);
  });
  const t2 = new Set(t1);
  for (const x of t.matchAll(/\bmodel:\s*(?:db\.|models\.)?(\w+)/g)) if (byName.has(x[1])) t2.add(x[1]);
  for (const x of t.matchAll(/\b(?:db|models)\.(\w+)\b/g)) if (byName.has(x[1])) t2.add(x[1]);
  for (const x of t.matchAll(new RegExp('\\b(\\w+)\\.(?:' + QUERY + ')\\(', 'g'))) if (byName.has(x[1])) t2.add(x[1]);
  for (const x of t.matchAll(/const\s*\{([^}]*)\}\s*=\s*(?:db|models|require\([^)]*models[^)]*\))/g)) x[1].split(',').map(s => s.split(':').pop().trim()).forEach(n => { if (byName.has(n)) t2.add(n); });
  for (const x of t.matchAll(/\b(?:FROM|JOIN)\s+"?([a-z_][a-z0-9_]*)"?/gi)) if (modelOfTable(x[1])) t2.add(modelOfTable(x[1]));
  const t3 = new Set(t2);
  models.forEach(M => { if (word(M.name).test(t) || word(tableOf(M)).test(t)) t3.add(M.name); });
  const cls = (set) => ([...set].some(n => showSet.has(n)) ? 'SHOW-CARRYING' : unattributed.length ? 'UNSORTED' : 'SHOW-LESS');
  rows.push({ f: f.replace('src/routes/', ''), n: sites(t).length, c1: cls(t1), c2: cls(t2), c3: cls(t3),
    show2: [...t2].filter(n => showSet.has(n)).sort(), unattributed });
};
rem.forEach(classify);
// The same sort over the five files already read, as a check against them.
const remRows = rows.length; rd.forEach(classify);
const checkRows = rows.splice(remRows);
out.push('');
out.push('check: the same sort over the five files the slices read (T1 / T2 / T3; show-carrying models at T2):');
checkRows.forEach(x => out.push(`  ${x.f.padEnd(32)} ${String(x.n).padStart(3)}  ${x.c1.padEnd(13)} ${x.c2.padEnd(13)} ${x.c3.padEnd(13)}  ${x.show2.join(', ')}${x.unattributed.length ? `  [unattributed: ${x.unattributed.join('; ')}]` : ''}`));
out.push('');
out.push('width         SHOW-LESS          UNSORTED           SHOW-CARRYING');
for (const k of ['c1', 'c2', 'c3']) {
  const agg = (c) => { const r = rows.filter(x => x[k] === c); return `${String(r.length).padStart(2)} files ${String(r.reduce((s, x) => s + x.n, 0)).padStart(3)} sites`; };
  out.push(`${({ c1: 'T1 read line ', c2: 'T2 code refs ', c3: 'T3 any word  ' })[k]} ${agg('SHOW-LESS')}   ${agg('UNSORTED')}   ${agg('SHOW-CARRYING')}`);
}
out.push('');
out.push('per file (sites; T1 / T2 / T3; show-carrying models at T2; unattributed sites):');
rows.sort((a, b) => b.n - a.n || a.f.localeCompare(b.f)).forEach(x => out.push(
  `  ${x.f.padEnd(32)} ${String(x.n).padStart(3)}  ${x.c1.padEnd(13)} ${x.c2.padEnd(13)} ${x.c3.padEnd(13)}` +
  (x.show2.length ? `  ${x.show2.slice(0, 5).join(', ')}${x.show2.length > 5 ? ` +${x.show2.length - 5}` : ''}` : '') +
  (x.unattributed.length ? `  [unattributed: ${x.unattributed.slice(0, 3).join('; ')}${x.unattributed.length > 3 ? ` +${x.unattributed.length - 3}` : ''}]` : '')));
fs.writeFileSync(process.argv[3], out.join('\n') + '\n');
setTimeout(() => process.exit(0), 50);
```

```
$ cd <repo> && node <scratch>/sort.js 574cc911 <scratch>/sort.out >/dev/null 2>&1; echo exit=$?; cat <scratch>/sort.out
exit=0
models registered: 148; carry a show: 100 (directly 33, through a parent 67); show-less: 48
model files under src/models (index.js aside): 153; with no registered model of that name: BrainDocument, SocialProfileTemplate, UiOverlayType, file, job
carry a show:
  AIEditPlan (ai_edit_plans): via belongsTo Episode (episode_id)
  AIRevision (ai_revisions): via belongsTo AIEditPlan (original_plan_id)
  Asset (assets): show_id
  AssetRole (asset_roles): show_id
  AssetUsageLog (asset_usage_log): via belongsTo Asset (asset_id)
  AudioClip (audio_clips): via belongsTo Scene (scene_id)
  Beat (beats): via belongsTo Scene (scene_id)
  BookSeries (book_series): show_id
  CalendarEventAttendee (calendar_event_attendees): via belongsTo StoryCalendarEvent (event_id)
  CalendarEventRipple (calendar_event_ripples): via belongsTo StoryCalendarEvent (event_id)
  CareerGoal (career_goals): show_id
  Character (characters): show_id
  CharacterArc (character_arcs): via belongsTo RegistryCharacter (registry_id)
  CharacterClip (character_clips): via belongsTo Scene (scene_id)
  CharacterCrossing (character_crossings): via belongsTo RegistryCharacter (character_id)
  CharacterEntanglement (character_entanglements): via belongsTo RegistryCharacter (character_id)
  CharacterFollowProfile (character_follow_profiles): via belongsTo RegistryCharacter (registry_character_id)
  CharacterGrowthLog (character_growth_log): via belongsTo RegistryCharacter (character_id)
  CharacterProfile (character_profiles): show_id
  CharacterRegistry (character_registries): show_id
  CharacterRelationship (character_relationships): via references RegistryCharacter (character_id_a)
  CharacterState (character_state): show_id
  CompositionAsset (composition_assets): via belongsTo ThumbnailComposition (composition_id)
  CompositionOutput (composition_outputs): via belongsTo ThumbnailComposition (composition_id)
  ContinuityBeat (continuity_beats): via belongsTo ContinuityTimeline (timeline_id)
  ContinuityBeatCharacter (continuity_beat_characters): via references ContinuityBeat (beat_id)
  ContinuityCharacter (continuity_characters): via belongsTo ContinuityTimeline (timeline_id)
  ContinuityTimeline (continuity_timelines): show_id
  EditMap (edit_maps): via belongsTo Episode (episode_id)
  EditingDecision (editing_decisions): via belongsTo Episode (episode_id)
  EntanglementEvent (entanglement_events): via belongsTo SocialProfile (profile_id)
  EntanglementUnfollow (entanglement_unfollows): via belongsTo RegistryCharacter (character_id)
  Episode (episodes): show_id
  EpisodeAsset (episode_assets): via belongsTo Episode (episode_id)
  EpisodeBrief (episode_briefs): show_id
  EpisodeScene (episode_scenes): via belongsTo SceneLibrary (scene_library_id)
  EpisodeScript (episode_scripts): show_id
  EpisodeWardrobe (episode_wardrobe): via belongsTo Episode (episode_id)
  EpisodeWardrobeDefault (episode_wardrobe_defaults): via belongsTo Episode (episode_id)
  EventDeliverable (event_deliverables): via belongsTo WorldEvent (event_id)
  FeedMoment (feed_moments): show_id
  FeedPost (feed_posts): show_id
  FeedProfileRelationship (feed_profile_relationships): via belongsTo SocialProfile (influencer_a_id)
  FileStorage (FileStorages): via belongsTo Episode (episode_id)
  GenerationJob (generation_jobs): via belongsTo SceneSet (scene_set_id)
  HairLibrary (hair_library): show_id
  LalaEmergenceScene (lala_emergence_scenes): via belongsTo StorytellerLine (line_id)
  Layer (layers): via belongsTo Episode (episode_id)
  LayerAsset (layer_assets): via belongsTo Layer (layer_id)
  MakeupLibrary (makeup_library): show_id
  Marker (markers): via belongsTo Episode (episode_id)
  MetadataStorage (metadata_storage): via belongsTo Episode (episode_id)
  Opportunity (opportunities): show_id
  OutfitSetItems (outfit_set_items): via belongsTo WardrobeLibrary (outfit_set_id)
  PhoneMission (phone_missions): show_id
  PhonePlaythroughState (phone_playthrough_state): show_id
  ProcessingQueue (processing_queue): via belongsTo Episode (episode_id)
  RegistryCharacter (registry_characters): via belongsTo CharacterRegistry (registry_id)
  RelationshipEvent (relationship_events): via belongsTo CharacterRelationship (relationship_id)
  Scene (scenes): via belongsTo Episode (episode_id)
  SceneAngle (scene_angles): via belongsTo SceneSet (scene_set_id)
  SceneAsset (scene_assets): via belongsTo Scene (scene_id)
  SceneFootageLink (scene_footage_links): via belongsTo ScriptMetadata (script_metadata_id)
  SceneLayerConfiguration (scene_layer_configuration): via belongsTo Scene (scene_id)
  SceneLibrary (scene_library): show_id
  SceneObjectVariant (scene_object_variants): via belongsTo Scene (scene_id)
  ScenePlan (scene_plans): via belongsTo Episode (episode_id)
  SceneProposal (scene_proposals): via belongsTo StorytellerBook (book_id)
  SceneSet (scene_sets): show_id
  SceneSetEpisode (scene_set_episodes): via belongsTo SceneSet (scene_set_id)
  ScriptLearningProfile (script_learning_profiles): show_id
  ScriptMetadata (script_metadata): via references EpisodeScript (script_id)
  Show (shows): is shows
  ShowArc (show_arcs): show_id
  ShowAsset (show_assets): show_id
  ShowConfig (show_configs): show_id
  SocialProfile (social_profiles): via belongsTo RegistryCharacter (registry_character_id)
  SocialProfileFollower (social_profile_followers): via belongsTo SocialProfile (social_profile_id)
  SocialProfileRelationship (social_profile_relationships): via belongsTo SocialProfile (source_profile_id)
  StoryCalendarEvent (story_calendar_events): via belongsTo StorytellerLine (source_line_id)
  StorytellerBook (storyteller_books): show_id
  StorytellerChapter (storyteller_chapters): via belongsTo StorytellerBook (book_id)
  StorytellerEcho (storyteller_echoes): via belongsTo StorytellerBook (book_id)
  StorytellerLine (storyteller_lines): via belongsTo StorytellerChapter (chapter_id)
  StorytellerMemory (storyteller_memories): via belongsTo StorytellerLine (line_id)
  Thumbnail (thumbnails): via belongsTo Episode (episodeId)
  ThumbnailComposition (thumbnail_compositions): via belongsTo Episode (episode_id)
  ThumbnailTemplate (thumbnail_templates): show_id
  TimelineData (timeline_data): via references Episode (episode_id)
  TimelinePlacement (timeline_placements): via belongsTo Episode (episode_id)
  UniverseCharacter (universe_characters): via belongsTo RegistryCharacter (registry_character_id)
  UserDecision (user_decisions): via belongsTo Episode (episode_id)
  VideoProcessingJob (video_processing_jobs): via belongsTo Episode (episode_id)
  Wardrobe (wardrobe): show_id
  WardrobeBrandTag (wardrobe_brand_tags): show_id
  WardrobeLibrary (wardrobe_library): show_id
  WardrobeLibraryReferences (wardrobe_library_references): via belongsTo WardrobeLibrary (library_item_id)
  WardrobeUsageHistory (wardrobe_usage_history): show_id
  WorldCharacter (world_characters): via belongsTo RegistryCharacter (registry_character_id)
  WorldEvent (world_events): show_id
show-less:
  AITrainingData (ai_training_data)
  AIUsageLog (ai_usage_logs)
  ActivityLog (activity_logs)
  AmberFinding (amber_findings)
  AmberScanRun (amber_scan_runs)
  AmberTaskQueue (amber_task_queue)
  AssetLabel (asset_labels)
  AuthorNote (author_notes)
  BrainFingerprint (brain_fingerprints)
  BulkImportJob (bulk_import_jobs)
  CharacterSpark (character_sparks)
  CharacterTherapyProfile (character_therapy_profiles)
  DecisionPattern (decision_patterns)
  EpisodeTemplate (episode_templates)
  FranchiseKnowledge (franchise_knowledge)
  FranchiseTechKnowledge (franchise_tech_knowledge)
  LalaverseBrand (lalaverse_brands)
  LayerPreset (layer_presets)
  ManuscriptMetadata (manuscript_metadata)
  MultiProductContent (multi_product_content)
  NovelAssembly (novel_assemblies)
  OutfitSet (outfit_sets)
  PageContent (page_content)
  PipelineTracking (pipeline_tracking)
  PostGenerationReview (post_generation_reviews)
  PressCareer (press_careers)
  SceneTemplate (scene_templates)
  ScriptEditHistory (script_edit_history)
  ScriptSuggestion (script_suggestions)
  ScriptTemplate (script_templates)
  SessionBrief (session_briefs)
  SocialMediaImport (social_media_imports)
  StoryClockMarker (story_clock_markers)
  StoryRevision (story_revisions)
  StoryTaskArc (story_task_arcs)
  StoryTexture (story_texture)
  StoryThread (story_threads)
  StorytellerStory (storyteller_stories)
  TherapyPendingSession (therapy_pending_sessions)
  Universe (universes)
  VoiceRule (voice_rules)
  VoiceSignal (voice_signals)
  WardrobeContentAssignment (wardrobe_content_assignments)
  WorldLocation (world_locations)
  WorldStateSnapshot (world_state_snapshots)
  WorldTimelineEvent (world_timeline_events)
  WritingGoal (writing_goals)
  WritingRhythm (writing_rhythm)

population at 574cc911: route files 142; carrying :showId 23; complement 119
complement files with >= 1 site: 85 (1053 sites)
  the four v1.44 §47.2 exclusions: 4 files, 147 sites
  read by the five slices: 5 files, 82 sites
  remaining: 76 files, 824 sites

check: the same sort over the five files the slices read (T1 / T2 / T3; show-carrying models at T2):
  calendarRoutes.js                 16  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CalendarEventAttendee, CalendarEventRipple, RegistryCharacter, StoryCalendarEvent, WorldEvent
  episodes.js                       19  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Asset, CharacterState, Episode, EpisodeWardrobeDefault, Scene, SceneAngle, SceneSet, SceneSetEpisode, TimelineData, WorldEvent
  franchiseBrainRoutes.js           16  UNSORTED      UNSORTED      SHOW-CARRYING    [unattributed: :457 receiver BrainDocument; :473 receiver BrainDocument]
  memories/core.js                  15  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter, StorytellerBook, StorytellerChapter, StorytellerLine, StorytellerMemory
  upgradeRoutes.js                  16  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterGrowthLog, StorytellerBook

width         SHOW-LESS          UNSORTED           SHOW-CARRYING
T1 read line  10 files  50 sites    5 files  35 sites   61 files 739 sites
T2 code refs   8 files  44 sites    4 files  25 sites   64 files 755 sites
T3 any word    4 files  15 sites    1 files  10 sites   71 files 799 sites

per file (sites; T1 / T2 / T3; show-carrying models at T2; unattributed sites):
  sceneSetRoutes.js                 74  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Episode, GenerationJob, SceneAngle, ScenePlan, SceneSet +4
  memories/engine.js                66  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterFollowProfile, CharacterGrowthLog, CharacterRegistry, CharacterRelationship, RegistryCharacter +6  [unattributed: :4659 SELECT (no table found)]
  socialProfileRoutes.js            65  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterEntanglement, CharacterFollowProfile, CharacterRegistry, EntanglementEvent, EntanglementUnfollow +4  [unattributed: :1542 receiver model; :2750 receiver SocialProfileTemplate; :2824 receiver SocialProfileTemplate]
  storyteller.js                    43  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  StoryCalendarEvent, StorytellerBook, StorytellerChapter, StorytellerEcho, StorytellerLine +1
  memories/assistant.js             42  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterFollowProfile, CharacterRegistry, CharacterRelationship, ContinuityBeat, FeedProfileRelationship +7  [unattributed: :769 SELECT (no table found)]
  tierFeatures.js                   42  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterGrowthLog, CharacterRelationship, RegistryCharacter, RelationshipEvent, StorytellerBook +3
  storyEvaluationRoutes.js          40  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterCrossing, CharacterGrowthLog, CharacterRelationship, ContinuityBeat, ContinuityCharacter +9  [unattributed: :371 SELECT (no table found)]
  storyHealth.js                    26  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter, StorytellerBook  [unattributed: :46 SELECT (no table found); :206 SELECT timeline_events; :256 SELECT chapter_versions +5]
  compositions.js                   21  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Asset, CompositionAsset, CompositionOutput, Episode, EpisodeAsset +3  [unattributed: :248 SELECT template_studio]
  stories.js                        21  SHOW-LESS     SHOW-LESS     SHOW-CARRYING
  continuityEngine.js               14  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  ContinuityBeat, ContinuityBeatCharacter, ContinuityCharacter, ContinuityTimeline
  episodeBriefRoutes.js             14  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Episode, EpisodeBrief, ScenePlan, SceneSet
  novelIntelligenceRoutes.js        14  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  StorytellerLine
  wardrobeLibrary.js                14  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Episode, Show, StorytellerChapter, StorytellerLine, Wardrobe +3  [unattributed: :93 SELECT (no table found); :106 SELECT (no table found); :401 SELECT (no table found) +3]
  sceneProposeRoute.js              13  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterCrossing, CharacterGrowthLog, CharacterRelationship, ContinuityBeat, RegistryCharacter +2  [unattributed: :116 receiver PainPointMemory]
  feedRelationshipRoutes.js         12  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterEntanglement, FeedProfileRelationship, RegistryCharacter, SocialProfile, SocialProfileRelationship
  layers.js                         12  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Asset, Episode, Layer, LayerAsset
  aiUsageRoutes.js                  10  UNSORTED      UNSORTED      UNSORTED       [unattributed: :44 SELECT (no table found); :86 SELECT (no table found); :123 SELECT (no table found) +1]
  amberDiagnosticRoutes.js          10  UNSORTED      SHOW-CARRYING SHOW-CARRYING  RegistryCharacter, StorytellerLine, StorytellerMemory  [unattributed: :58 SELECT (no table found); :129 SELECT (no table found); :161 SELECT (no table found)]
  entanglementRoutes.js             10  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterEntanglement, EntanglementEvent, EntanglementUnfollow, RegistryCharacter, SocialProfile +1
  memories/voice.js                 10  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter, StorytellerBook, StorytellerChapter, StorytellerLine, StorytellerMemory
  templateStudio.js                 10  UNSORTED      UNSORTED      SHOW-CARRYING  [unattributed: :67 SELECT (no table found); :82 SELECT template_studio; :121 SELECT template_studio +7]
  characterAI.js                     9  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterRegistry, CharacterRelationship, RegistryCharacter, StorytellerBook, StorytellerLine +1
  characterGenerationRoutes.js       9  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterEntanglement, CharacterRegistry, RegistryCharacter, SocialProfile, StorytellerBook
  footage.js                         9  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Asset, Episode, EpisodeAsset, Scene
  wardrobeBrands.js                  9  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  WardrobeBrandTag
  propertyRoutes.js                  8  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  SceneAngle, SceneSet
  animatic.js                        7  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  AudioClip, Scene
  episodeScriptWriterRoutes.js       7  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Beat, Episode, EpisodeBrief, EpisodeScript
  press.js                           7  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterRegistry, RegistryCharacter, Show  [unattributed: :459 SELECT (no table found); :508 SELECT (no table found); :541 SELECT (no table found)]
  sceneLinks.js                      7  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Scene, SceneFootageLink, ScriptMetadata
  textureLayerRoutes.js              7  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter
  amberSessionRoutes.js              6  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterRelationship, RegistryCharacter, SocialProfile, StorytellerBook, StorytellerChapter +2  [unattributed: :92 SELECT (no table found); :107 SELECT (no table found); :127 SELECT (no table found) +1]
  characterCrossingRoutes.js         6  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterCrossing, RegistryCharacter
  characterFollowRoutes.js           6  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterFollowProfile, RegistryCharacter, SocialProfile, SocialProfileFollower
  characterGrowthRoute.js            6  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterGrowthLog, RegistryCharacter
  memories/interview.js              6  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter, StorytellerLine, WardrobeLibrary
  scenes.js                          6  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Scene  [unattributed: :42 SELECT (no table found); :47 SELECT information_schema; :48 SELECT information_schema]
  todoListRoutes.js                  6  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Asset, WorldEvent  [unattributed: :82 SELECT episode_todo_lists; :157 SELECT episode_todo_lists; :295 SELECT episode_todo_lists +1]
  auditLogs.js                       5  SHOW-LESS     SHOW-LESS     SHOW-LESS    
  cfoAgentRoutes.js                  5  SHOW-LESS     SHOW-LESS     SHOW-LESS    
  characterDepthRoutes.js            5  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterRegistry, RegistryCharacter
  characterGenerator.js              5  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterRegistry, CharacterRelationship, RegistryCharacter, WorldCharacter
  generate-script-from-book.js       5  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter, StorytellerBook, StorytellerChapter, StorytellerLine
  memories/extras.js                 5  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  StorytellerMemory, WorldCharacter
  socialProfileBulkRoutes.js         5  SHOW-LESS     SHOW-CARRYING SHOW-CARRYING  SocialProfile
  assets.js                          4  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Asset
  characterSparkRoute.js             4  SHOW-LESS     SHOW-LESS     SHOW-LESS    
  decisions.js                       4  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Episode, Scene, UserDecision
  hairLibraryRoutes.js               4  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  HairLibrary
  imageProcessing.js                 4  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Asset
  makeupLibraryRoutes.js             4  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  MakeupLibrary
  scriptParse.js                     4  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Episode, EpisodeScene, EpisodeScript, Scene
  templates.js                       4  SHOW-LESS     SHOW-LESS     SHOW-CARRYING
  therapy.js                         4  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter, StorytellerMemory
  undergroundRoutes.js               4  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterEntanglement, SocialProfile
  admin.js                           3  UNSORTED      UNSORTED      SHOW-CARRYING  [unattributed: :28 SELECT (no table found); :31 SELECT (no table found); :34 SELECT (no table found)]
  authorNoteRoutes.js                3  SHOW-LESS     SHOW-LESS     SHOW-CARRYING
  consciousness.js                   3  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter
  episodeOrchestrationRoute.js       3  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Episode, WorldEvent  [unattributed: :33 SELECT game_wardrobe; :308 SELECT (no table found)]
  eventGeneratorRoute.js             3  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  WorldEvent
  export.js                          3  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Episode, Scene, TimelineData
  lala-scene-detection.js            3  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  LalaEmergenceScene, StorytellerBook, StorytellerChapter, StorytellerLine
  mirrorFieldRoutes.js               3  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  SocialProfile
  scriptAnalysis.js                  3  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  EpisodeScript, ScriptMetadata
  session.js                         3  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  StorytellerBook, StorytellerChapter, StorytellerLine
  characters.js                      2  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  Character
  thumbnailTemplates.js              2  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  ThumbnailTemplate
  timelineData.js                    2  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  TimelineData
  wantFieldRoutes.js                 2  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  CharacterEntanglement, RegistryCharacter, SocialProfile
  youtube.js                         2  UNSORTED      UNSORTED      SHOW-CARRYING  [unattributed: :139 SELECT (no table found)]
  arcTrackingRoutes.js               1  SHOW-LESS     SHOW-LESS     SHOW-CARRYING
  feedSchedulerRoutes.js             1  SHOW-LESS     SHOW-CARRYING SHOW-CARRYING  SocialProfile
  manuscript-export.js               1  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  StorytellerBook, StorytellerChapter, StorytellerLine
  memories/helpers.js                1  SHOW-CARRYING SHOW-CARRYING SHOW-CARRYING  RegistryCharacter
  pageContent.js                     1  SHOW-LESS     SHOW-LESS     SHOW-LESS    
```

### What the output says

| Width | Show-less | Unsorted | Show-carrying |
| --- | --- | --- | --- |
| T1, read line | 10 files, 50 sites | 5 files, 35 sites | 61 files, 739 sites |
| **T2, code references** | **8 files, 44 sites** | **4 files, 25 sites** | **64 files, 755 sites** |
| T3, any word | 4 files, 15 sites | 1 file, 10 sites | 71 files, 799 sites |

- **The registry:** 148 registered models; 100 carry a show (33 directly, 67
  through a parent), 48 do not.
- **At T2**, the eight show-less files are `stories.js` (21), `auditLogs.js`
  (5), `cfoAgentRoutes.js` (5), `characterSparkRoute.js` (4), `templates.js`
  (4), `authorNoteRoutes.js` (3), `arcTrackingRoutes.js` (1) and
  `pageContent.js` (1). The four **unsorted** files, named as the task asks,
  are `aiUsageRoutes.js` (10), `templateStudio.js` (10), `admin.js` (3) and
  `youtube.js` (2): each has a raw `SELECT` whose table the script cannot
  resolve to a registered model.
- **The check against the five slices** (the "check:" lines): the three
  files with instances and `upgradeRoutes.js` all sort as show-carrying;
  `franchiseBrainRoutes.js` sorts as unsorted (its `BrainDocument` reads are
  unattributable, the model not being registered). No file the slices found
  instances in sorts as show-less, at any width.

**The pre-sort narrows little.** At T2 it removes 8 files and 44 sites, about
5% of the remaining sites. 64 files carry a show-carrying model somewhere,
which is what one would expect from §1: most of the product's data belongs
to a show.

### What the pre-sort cannot see

- **Nullable parents.** A table that reaches a show through a nullable key
  carries one only for rows where the key is set (calendarRoutes.js #6 and #8
  classify "for attendee rows with a `character_id`"). The pre-sort marks
  such a table as carrying; only a reading says which rows.
- **Keys with no association.** A column that names a show-carrying row
  without a `belongsTo` or `references` (the upgradeRoutes.js slice's
  `storyteller_stories.character_key`, `written_back_chapter_id`) does not
  count, as in the slices.
- **Foreign keys declared only in migrations.** The test reads the model
  registry; a foreign key that exists only in a migration file is not seen.
- **Unregistered models.** Five files under `src/models/` define no
  registered model by their name (the "model files" line of the output):
  `BrainDocument`, `SocialProfileTemplate`, `UiOverlayType`, `file` and
  `job`. Reads of a model the registry does not load are unattributable and
  push a file toward UNSORTED, never toward SHOW-LESS.
- **Reads outside the file.** Helpers and services outside `src/routes/` are
  not in the population at all (the scoping note §2); the pre-sort inherits
  that limit.

## §4. Observed, not ruled: one table the pre-sort and a filed slice disagree on

The registry test marks `story_calendar_events` as carrying a show through
its `sourceLine` association (`StoryCalendarEvent` → `StorytellerLine` →
chapter → book → show; the "carry a show" list above). The calendarRoutes.js
slice's §0.2 tested only the table's `series_id` column and recorded
condition 2 as not met for it, though its own Script 2 output lists
`sourceLine` among the associations:

```
$ grep -n -E "sourceLine|series_id. a nullable|No foreign key, model" docs/audit/F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md
95:partition column carry `series_id`, a nullable UUID. No foreign key, model
121:StoryCalendarEvent: show_id=false series_id=true associations=marker,attendees,ripples,sourceLine,location,spawnedEvents
435:StoryCalendarEvent: show_id=false series_id=true associations=marker,attendees,ripples,sourceLine,location,spawnedEvents
$ grep -n -E "foreignKey: 'source_line_id'|source_line_id: \{" src/models/StoryCalendarEvent.js
19:        foreignKey: 'source_line_id',
98:    source_line_id: {
```

Under the slice's own test (a foreign key or model association), events with
a `source_line_id` reach a show, so some of its condition-2 rows would read
differently for those events. This note does not re-classify them: the slice
is filed and immutable, and a correction would be an amendment. Recorded so
the ruling revision can decide whether one is owed.

## §5. The options

"Remaining" is §2's 76 files and 824 sites. Costs in sites and files are
MEASURED from §2–§3. Time is **INFERRED** from today's pace: four slices
(calendarRoutes.js, franchiseBrainRoutes.js, upgradeRoutes.js,
memories/core.js; 63 probe sites) were filed in one session day, and the
largest remaining files are far bigger (`sceneSetRoutes.js` 74,
`memories/engine.js` 66, `socialProfileRoutes.js` 65).

### (A) Full survey

- **Reads:** all 76 remaining files, 824 probe sites, slice by slice, as the
  five were read.
- **Proves:** a per-site classification of the whole population outside the
  exclusions, with every instance located by `file:line`. It is the only
  option that yields a complete instance list, and the only one that would
  find a site where a tenant check does apply, if one exists.
- **Cannot prove:** anything outside the probe (reads in services, helpers in
  other files, reads through association getters), or anything about the
  four excluded files.
- **Largest risk:** duration. At today's pace (INFERRED) it is on the order of
  twenty session days, while the survey's likely answer is already visible in
  §1. The code also moves under a long survey: files read early can change
  before the last is filed.
- **Depends on:** nothing else in the locked sequence to *do*. Its result
  still leaves the remedy to a later ruling.
- **Closure text a revision would carry:** "Item 1 closes on the full survey:
  N files, M sites, I instances, located in the filed slices listed. The
  remedy is a separate item."

### (B) Sorted survey

- **Reads:** the files §3 leaves SHOW-CARRYING or UNSORTED at the chosen
  width. At T2: 68 files, 780 sites. The 8 SHOW-LESS files (44 sites) are
  recorded as closed by condition 2 on §3's evidence, without a reading.
- **Proves:** the same as (A) for the files read; for the rest, that no
  instance is possible *under the registry test*.
- **Cannot prove:** that the registry test is complete (§3, "What the
  pre-sort cannot see"): a migration-only foreign key or an unregistered
  model could hide a show-carrying table in a SHOW-LESS file. And §4 shows
  the test and a filed slice can disagree.
- **Largest risk:** it saves little. About 95% of (A)'s sites remain, so its
  duration is close to (A)'s (INFERRED).
- **Depends on:** a ruling that the registry test is an acceptable basis for
  closing files unread. Nothing else in the locked sequence.
- **Closure text:** "Item 1 closes on a sorted survey: files that reach no
  show-carrying model under the registry test (list, at `<basis>`) are closed
  by condition 2 without reading; the remaining N files were read in the
  filed slices listed, with I instances."

### (C) Structural

- **Reads:** no further files.
- **Proves:** from §1, that the shape is general where data belongs to a
  show: five files, 93 sites, 36 instances, and no tenant check at any site,
  for one reason recorded at the data model (`Show` has no owner). It moves
  the remedy into a fix item: give shows an owner, and check it once on the
  request path (shared middleware or a scoped query layer), so that every
  read, in files read or not, is covered by the same check.
- **Cannot prove:** where the instances are. There is no per-site list, so a
  fix cannot be verified site by site against a survey; it would be verified
  by its own tests. It also cannot say whether any unread file already
  checks a tenant in a way the five did not (none of the five did).
- **Largest risk:** a structural fix applied without a site list can miss
  reads that bypass the shared layer (raw SQL, services, helpers), the same
  places the probe cannot see. And giving shows an owner is a schema change.
- **Depends on:**
  - the locked sequence's standing rule, "no feature additions, schema
    redesigns, or 'optimize later' during the fix cycle"
    (`PROJECT_CONTEXT.md` §6.1, "Locked sequence"): an owner column on
    `shows` is a schema change, so the remedy needs that rule's waiver or a
    ruling that it is a fix, not a redesign;
  - F-Deploy-1 v1.51's schema-fork ruling (new schema reaches canon only by
    the owed reconciliation path);
  - F-AUTH-1's tiers: the Tier 4 public reads (for example
    franchiseBrainRoutes.js's five `optionalAuth` GETs) answer
    unauthenticated callers by design, so an owner check has to say what
    applies there;
  - a decision about users: with one operator, every show has the same owner
    and the check changes nothing today (INFERRED from the product being
    solo-operated, `CLAUDE.md` "What this is"). The fix matters once there is
    more than one user, which is a product decision, not an audit one;
  - F-Franchise-1 / Director Brain for the four excluded files: franchise
    tables sit above shows (v1.44 §47.2) and an owner on shows does not
    reach them.
- **Closure text:** "Item 1 closes as established by the five filed slices
  (list): the second shape holds wherever data carries a show, because
  nothing on the request path supplies a tenant and `Show` has no owner. No
  further files are read. The remedy is carried as item N: an owner on
  shows, checked on the request path."

### (D) Sorted survey plus structural

- **Reads:** as (B): 68 files, 780 sites at T2.
- **Proves:** as (B) for evidence, and gives (C)'s fix a site list to verify
  against: every located instance becomes a test case for the owner check.
- **Cannot prove:** as (B) for the files closed unread.
- **Largest risk:** it carries (B)'s duration and (C)'s schema dependency.
  If the fix lands first, the survey measures code that is changing under it.
- **Depends on:** everything (B) and (C) depend on.
- **Closure text:** "Item 1 closes on a sorted survey (as B), and the remedy
  is carried as item N (as C); item N's verification cites the survey's
  instances."

### Side by side

| | Files read | Sites read | Instance list | Covers unread code | Needs a schema change | Needs a user decision |
| --- | --- | --- | --- | --- | --- | --- |
| (A) Full | 76 | 824 | complete (probe scope) | no | no (for the survey) | no (for the survey) |
| (B) Sorted, T2 | 68 | 780 | complete for files read | no | no | no |
| (C) Structural | 0 | 0 | none beyond §1 | yes, if the fix is complete | yes | yes |
| (D) Sorted + structural | 68 | 780 | complete for files read | yes, if the fix is complete | yes | yes |

## What this document does not do

- Rules nothing. Recommends no option. Mints no FD, XK or PE. Closes nothing:
  item 1 stays owed until a Fix Plan revision rules.
- Does not re-classify any site in a filed slice (§4 is recorded only).
- Changes no code.
- Does not read any route file's handlers; §3's sort reads the files'
  text mechanically.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito or
  GitHub-settings contact.

## Footer

**Type:** standalone read-and-options note. **Rules:** nothing.
**Mints:** nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `574cc9117e9f3564559753f21281f4e569753b70`.*
*Authority: `F-Stats-1_Fix_Plan_v1.49.md` §52.6; `F-Stats-1_ReadsSlice_Scoping_2026-09-26.md`;
the five filed slices named in §1. Every count MEASURED at the basis above
unless marked INFERRED or ATTESTED. Task: #2058.*
