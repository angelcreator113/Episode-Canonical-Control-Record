| **PRIME STUDIOS** **F-STATS-1 NOTE** *`F-Stats-1_Fix_Plan_v1.17.md` says `.unscoped()` "strips only the soft-delete predicate". In Sequelize 6 it does not strip that predicate at all. This note records that, the generated SQL, and the one live call site it broke, which Task #1838 fixes. It rules nothing.* |
| --- |

**Document version**

A new standalone note: not a Fix Plan revision and not an amendment.
Basis: `origin/main` at `724f4eb2f45b10a442fbf9771d29c2863fb5aca8`,
measured 2026-09-25. Every file:line below is at that basis unless a
different SHA is named.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

EVIDENCE NOTE, F-Stats-1. Filed with the code fix it describes (Task
#1838: the `POST /wardrobe/browse-pool` event lookup in
`src/routes/wardrobe.js` uses `paranoid: false` in place of
`.unscoped()`).

- Every claim is **MEASURED** (a read of this repository anyone with a
  clone can repeat) unless it is labelled otherwise.
- It does not edit `F-Stats-1_Fix_Plan_v1.17.md`. A pointer banner is
  added to the top of that file; its body is unedited.
- It mints no FD, XK or PE number and rules nothing.

---

## 1. What v1.17 says

`docs/audit/F-Stats-1_Fix_Plan_v1.17.md:60-63` (4e gate outcome) and
`:69-78` ("The `.unscoped()` question was answered twice, oppositely").
The file was filed at `67aec76c597ace3dd980d05e6526011cb4455fea`
(2026-08-04, #980); at that SHA the first passage is at `:48-51`, before
the #1836 banner moved it down twelve lines.

> - **4e** — both §12.38 directions live in one PR. [...] `WorldEvent`
>   verified as carrying `paranoid: true` and no other scope, so
>   `.unscoped()` strips only the soft-delete predicate.

> - **`WorldEvent` is paranoid** -> a plain `findOne` appends a predicate
>   that the raw query did not carry -> **`.unscoped()` mandatory.**

```
$ grep -n "strips only\|soft-delete predicate\|mandatory" docs/audit/F-Stats-1_Fix_Plan_v1.17.md
62:  `paranoid: true` and no other scope, so `.unscoped()` strips only the
63:  soft-delete predicate.
75:  the raw query did not carry -> **`.unscoped()` mandatory.**
151:### Reconciliation re-cut (mandatory per §15)
```

(`:151` is an unrelated match.)

v1.17 did not originate the rule. It is §12.33's detection rule and
Decision #21's locked shape in `F-Stats-1_Fix_Plan_v1.11.md` (filed
`d17673103e3e8b455898d113125f990e490f3d72`, 2026-08-02, #964):

```
$ grep -n "the conversion requires\|Named scopes are not a hazard" docs/audit/F-Stats-1_Fix_Plan_v1.11.md
69:the conversion requires `.unscoped()`. If `paranoid: true` and the raw
73:Named scopes are not a hazard. `Episode` carries an `active` scope with
```

## 2. What `.unscoped()` does in Sequelize 6 (MEASURED)

The installed version is Sequelize 6.37.8. `unscoped()` is
`this.scope()` with no arguments: it resets default and named scopes.
The paranoid predicate is added separately, by `_paranoidClause`, on every
`findAll`/`findOne`/`count`, and it is skipped only when the model is not
paranoid or the query passes `paranoid: false`. Scopes play no part in it.

```
$ grep -n "static unscoped\|static _paranoidClause\|options.paranoid === false" node_modules/sequelize/lib/model.js
158:  static _paranoidClause(model, options = {}) {
170:    if (!model.options.timestamps || !model.options.paranoid || options.paranoid === false) {
1029:  static unscoped() {
$ sed -n 1029,1031p node_modules/sequelize/lib/model.js
  static unscoped() {
    return this.scope();
  }
```

**Generated SQL.** The models were loaded with the app's `define`
(`src/config/sequelize.js`, `paranoid: true`) on a Sequelize instance
whose `query()` was stubbed to record the SQL, with no database.
`WorldEvent` carries `paranoid: true`, an empty `defaultScope` and no
named scopes, as v1.17 says. The browse-pool lookup's options
(`attributes`, `where: { used_in_episode_id }`, `raw: true`), both ways:

```
old: WorldEvent.unscoped().findOne(opts)
  SELECT "name", "event_type", "dress_code", "dress_code_keywords", "prestige", "strictness", "host_brand" FROM "world_events" AS "WorldEvent" WHERE ("WorldEvent"."deleted_at" IS NULL AND "WorldEvent"."used_in_episode_id" = 'ep-1') LIMIT 1;
new: WorldEvent.findOne({ ...opts, paranoid: false })
  SELECT "name", "event_type", "dress_code", "dress_code_keywords", "prestige", "strictness", "host_brand" FROM "world_events" AS "WorldEvent" WHERE "WorldEvent"."used_in_episode_id" = 'ep-1' LIMIT 1;
```

So v1.17's statement is wrong in substance. `.unscoped()` clears default
and named scopes and leaves the paranoid predicate in place. Only
`paranoid: false`, per query or per model, removes it.

## 3. Consequence: guidance followed as filed does the opposite

§12.33's purpose was to keep a converted read's row set equal to the raw
query's. For a paranoid model and a raw query with no `deleted_at`
predicate, the prescribed `.unscoped()` does not do that. The converted
call still drops soft-deleted rows. No error, warning or test failure
shows it unless a soft-deleted row exists: the silent divergence §12.33
was minted to prevent.

## 4. The live consequence: browse-pool, 2026-08-03 onward

`d5746ca7bfe08619c7574f523bbedab18a9c11e4` (2026-08-03, F-Stats-1 PR 4e,
#975) converted unit 11. The removed query had no `deleted_at` predicate:

```
$ git show d5746ca7b -- src/routes/wardrobe.js
-      const [evRows] = await models.sequelize.query(`
-        SELECT we.name, we.event_type, we.dress_code, we.dress_code_keywords,
-               we.prestige, we.strictness, we.host_brand
-        FROM world_events we
-        WHERE we.used_in_episode_id = :episode_id
-        LIMIT 1
-      `, { replacements: { episode_id } });
[...]
+      const ev = await models.WorldEvent.unscoped().findOne({
```

The commit message reads: "The raw query carried no deleted_at predicate
and WorldEvent is paranoid, so .unscoped() is mandatory." The intent was
to include soft-deleted events. The effect was to exclude them. Since
then, an episode whose event is soft-deleted gets no event from the
lookup, and browse-pool falls back to its defaults: prestige 5,
strictness 5, empty dress code, event type and host brand
(`src/routes/wardrobe.js`, the "Defaults after lookup" block of
`POST /browse-pool`).

Task #1838 changes that one call to
`WorldEvent.findOne({ ..., paranoid: false })`. Its test,
`tests/unit/routes/wardrobe-browsePool-deletedEvent.test.js`, runs the
real handler against the real model on a stubbed connection. It fails
on the old line with the `deleted_at IS NULL` SQL above and passes on
the new one.

Whether any soft-deleted `world_events` row has an episode that
browse-pool was called for is **not established**: no database was
read.

## 5. The other `.unscoped()` calls in `src/` (MEASURED)

```
$ git grep -n "\.unscoped()" 724f4eb2f45b10a442fbf9771d29c2863fb5aca8 -- src/
724f4eb2f45b10a442fbf9771d29c2863fb5aca8:src/routes/evaluation.js:127:    const showRows = await models.Show.unscoped().findAll({
724f4eb2f45b10a442fbf9771d29c2863fb5aca8:src/routes/memories/engine.js:3541:        const dbArc = await db.StoryTaskArc.unscoped().findOne({ where: { character_key: characterKey } });
724f4eb2f45b10a442fbf9771d29c2863fb5aca8:src/routes/memories/engine.js:3551:      _approvedStories = await db.StorytellerStory.unscoped().findAll({
724f4eb2f45b10a442fbf9771d29c2863fb5aca8:src/routes/wardrobe.js:959:      const ev = await models.WorldEvent.unscoped().findOne({
```

(The `wardrobe.js` line is the call Task #1838 changes.) Each of the other three
models is paranoid (`Show` declares it; `StoryTaskArc` and
`StorytellerStory` inherit it from the `define`), has no default or named
scope, and still generates `deleted_at IS NULL` under `.unscoped()`:

```
Show.unscoped().findAll({ attributes: ['id','name'], order: [['created_at','ASC']] })  [evaluation.js]
  SELECT "id", "name" FROM "shows" AS "Show" WHERE ("Show"."deleted_at" IS NULL) ORDER BY "Show"."created_at" ASC;
StoryTaskArc.unscoped().findOne({ where: { character_key: 'k' } })  [memories/engine.js]
  SELECT "id", "character_key", "display_name", "world", "narrative_spine", "tasks", "created_at", "updated_at", "deleted_at" AS "deletedAt" FROM "story_task_arcs" AS "StoryTaskArc" WHERE ("StoryTaskArc"."deleted_at" IS NULL AND "StoryTaskArc"."character_key" = 'k');
StorytellerStory.unscoped().findAll({ where: { character_key: 'k', status: 'approved' }, order, attributes })  [memories/engine.js]
  SELECT "story_number", "title", "scene_brief", "status" FROM "storyteller_stories" AS "StorytellerStory" WHERE ("StorytellerStory"."deleted_at" IS NULL AND ("StorytellerStory"."character_key" = 'k' AND "StorytellerStory"."status" = 'approved')) ORDER BY "StorytellerStory"."story_number" ASC;
```

| Call | Paranoid | Still filters deleted | What the history shows was meant |
|---|---|---|---|
| `evaluation.js:127` `Show.unscoped().findAll` (`POST /admin/reset-character-stats`) | yes (declared) | yes | Include them. `081e0d989` (2026-08-02, #965) replaced `SELECT id, name FROM shows ORDER BY created_at` per Decision #21. The call-site comment reads "List ALL shows so we can see what's in the DB", which v1.11 §12.33 quotes as the reason. |
| `memories/engine.js:3541` `StoryTaskArc.unscoped().findOne` | yes (inherited) | yes | Escape the predicate. `908f93090` (2026-03-18) body: "Use .unscoped() for StoryTaskArc and StorytellerStory queries (global paranoid: true)". |
| `memories/engine.js:3551` `StorytellerStory.unscoped().findAll` | yes (inherited) | yes | Same commit, same stated reason. |

**One further observation, from a register document.** The canon schema
capture lists eight `story_task_arcs` columns and no `deleted_at`
(`docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt:1953-1960`);
it lists `deleted_at` for `shows` (`:1713`), `storyteller_stories`
(`:2161`) and `world_events` (`:2638`). If the capture reflects
production, the `StoryTaskArc` read selects and filters on a column that
does not exist. The surrounding `try/catch` would log a warning and
leave `existingTasks` empty. This is **INFERRED** from the capture and
the generated SQL; it was not run against a database. Task #1838 does
not change these three calls.

## 6. Relation to `F-Stats-1_CharacterState_Paranoid_Note_2026-09-25.md`

That note (#1832, #1836) records that v1.17's "`CharacterState` is not
paranoid" was inaccurate until the fix is deployed, and that v1.17's
guidance for it ("plain `findOne` correct, `.unscoped()` would be
wrong") holds once it is.

This note narrows the second half. `.unscoped()` on `CharacterState` was
never "wrong" in the sense v1.17 meant. It never removed a predicate.
Before #1832 the predicate stayed in place with or without it; after
#1832 there is no predicate to remove, and `CharacterState` has no
scopes. In both states the call is a no-op. Generated SQL, same stubbed
setup, model file before (`eba35e985^`) and after (this basis) #1832's
commit:

```
before #1832:
findOne:            SELECT "coins" FROM "character_state" AS "CharacterState" WHERE ("CharacterState"."deleted_at" IS NULL AND "CharacterState"."show_id" = 'a') LIMIT 1;
unscoped().findOne: SELECT "coins" FROM "character_state" AS "CharacterState" WHERE ("CharacterState"."deleted_at" IS NULL AND "CharacterState"."show_id" = 'a') LIMIT 1;
after #1832:
findOne:            SELECT "coins" FROM "character_state" AS "CharacterState" WHERE "CharacterState"."show_id" = 'a' LIMIT 1;
unscoped().findOne: SELECT "coins" FROM "character_state" AS "CharacterState" WHERE "CharacterState"."show_id" = 'a' LIMIT 1;
```

The CharacterState note's conclusion that plain `findOne` is correct once
the fix is live stands.

## 7. Where else the rule is written

The same prescription appears in later F-Stats-1 revisions, as
dispositions for `worldEvents.js` statements not yet converted:

```
$ grep -rln "unscoped()" docs/audit/ | sort -V
docs/audit/F-Stats-1_CharacterState_Paranoid_Note_2026-09-25.md
docs/audit/F-Stats-1_Fix_Plan_v1.11.md
docs/audit/F-Stats-1_Fix_Plan_v1.12.md
docs/audit/F-Stats-1_Fix_Plan_v1.13.md
docs/audit/F-Stats-1_Fix_Plan_v1.14.md
docs/audit/F-Stats-1_Fix_Plan_v1.16.md
docs/audit/F-Stats-1_Fix_Plan_v1.17.md
docs/audit/F-Stats-1_Fix_Plan_v1.18.md
docs/audit/F-Stats-1_Fix_Plan_v1.25.md
docs/audit/F-Stats-1_Fix_Plan_v1.41.md
docs/audit/F-Stats-1_Fix_Plan_v1.43.md
```

`v1.41` and `v1.43` carry `Convert` rows whose remedy column reads
`.unscoped()` for `world_events` reads (for example v1.43 `:87`, `:88`,
`:100`). No `.unscoped()` call exists in `src/routes/worldEvents.js` at
this basis (§5's grep). Whether those rows have been executed in some
other form is not established here. Executed as written, each would
repeat §4's defect. This note banners only v1.17, as Task #1838 asks.
Banners on v1.11 and the later revisions are **owed, not filed**.

## 8. What this note does not do

- It does not edit v1.17's body. The banner at the top of that file
  points here and carries nothing.
- It changes no other `.unscoped()` call and no model's `paranoid`
  setting.
- It mints no FD, XK or PE number and rules nothing.
- The filing session made no host, AWS, database or Cognito contact. All
  SQL above was generated offline against a stubbed connection.

---

## Footer

*Type: F-Stats-1 evidence note (MEASURED, one INFERRED observation in
§5, labelled). Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Production's
freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions
still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`). Task: #1838.*
