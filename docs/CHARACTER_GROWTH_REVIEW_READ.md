# What character-growth review can write — a read

## Status of this document

A read, for Evoni to decide whether `POST /api/v1/memories/character-growth/:id/review`
needs a whitelist. It changes no code, adds no whitelist, gates nothing, and
recommends nothing: §7 lists options without choosing. Not filed under
`docs/audit/`; it mints no FD/XK/PE number. Code is cited by name, with a line
number where it helps, read against `origin/main` at
`47f7c00a2bc87009ce784350a72c10cb3e87ee51` (2026-09-23).

Task: #1706. No host, AWS, database, or Cognito contact.

---

## Short answer

- **It can write any column the `RegistryCharacter` model defines.** That's
  about 190 columns, including the four author-only fields and several that
  govern identity and association: `character_key`, `registry_id`, `status`,
  `feed_profile_id`. It cannot change the primary key (`id`), the timestamps,
  or the soft-delete column. Names that aren't model attributes are silently
  ignored (§2).
- **The field name comes from an AI response, stored in a log row, and nothing
  validates it** before the write (§4).
- **Any signed-in user can call it,** on any log row. There's no group check
  and no ownership check (§3).
- **Found along the way:** 10 of the 11 field names the growth engine is built
  around aren't columns on the model. Most of what the growth engine "writes"
  is silently discarded (§2c). Also, nothing in the codebase calls the route
  that creates the log rows (§5).

---

## 1. The route, end to end

**File:** `src/routes/characterGrowthRoute.js`, mounted at `/api/v1/memories`
(`app.js`, the `characterGrowthRoute` mount). It is one of seven routers on
that path.

**Where the log rows come from.** `/review` acts on a `CharacterGrowthLog` row.
The only code in `src/` that creates those rows is `POST /character-growth` in
the same file (the "ROUTE 1" handler). It:

1. loads a `StorytellerStory` and the `RegistryCharacter` rows whose `status`
   is in `['approved', 'edited', 'finalized']`;
2. sends the approved scene text, and those characters' current values, to
   Claude (`claude-sonnet-4-20250514`), asking for `silent_updates` and
   `contradiction_checks`, each carrying a `field` name;
3. applies **silent updates** directly. These go through a whitelist,
   `SILENT_FIELDS = ['voice_notes', 'behavior_pattern', 'arc_summary', 'notes',
   'secret', 'appearance']`. Each is checked with
   `SILENT_FIELDS.includes(update.field)`, logged with `update_type: 'silent'`,
   and written with `character.update(silentChanges)`;
4. logs **contradictions** without applying them. **There is no whitelist
   here.** Any `check` with `is_contradiction && proposed_update` becomes a log
   row with `field_updated: check.field`, `new_value: check.proposed_update`
   and `update_type: 'flagged_contradiction'`. A `_CONTRADICTION_FIELDS` list
   exists in the file, but the leading underscore marks it unused, and nothing
   references it.

**The write in `/review`** ("ROUTE 3", quoted):

```js
router.post('/character-growth/:id/review', requireAuth, async (req, res) => {
  const { decision, modified_value, author_note } = req.body;
  // decision: 'accepted' | 'reverted' | 'modified'

  if (!['accepted', 'reverted', 'modified'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be: accepted | reverted | modified' });
  }

  try {
    const log = await db.CharacterGrowthLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'Growth log not found' });

    const character = await db.RegistryCharacter.findByPk(log.character_id);
    ...
    if (decision === 'accepted') {
      // Apply the proposed update
      await character.update({ [log.field_updated]: log.new_value });
    } else if (decision === 'modified' && modified_value) {
      // Apply the author's version
      await character.update({ [log.field_updated]: modified_value });
      await log.update({ new_value: modified_value });
    }
```

**What constrains the field name at this point: nothing.** `/review` doesn't
check the log's `update_type`, doesn't check `field_updated` against any
list, and doesn't check whether the log was already reviewed. So the same log
can be accepted, and its write applied, more than once. The one constraint is
the storage type: `CharacterGrowthLog.field_updated` is a `STRING(120)`
(`src/models/CharacterGrowthLog.js`).

**Where the value comes from:**
- On `accepted`: the log's `new_value`, which is the AI's `proposed_update`.
- On `modified`: the caller's `modified_value` from the request body.

So the AI chooses the field and the caller can choose the value.

**Table:** `registry_characters` (the `RegistryCharacter` model: `tableName:
'registry_characters'`, `underscored: true`, `timestamps: true`,
`paranoid: true`).

---

## 2. Which columns it can reach

### 2a. How Sequelize treats `update({ [name]: value })` here

Sequelize is `^6.37.7` in `package.json` (6.37.8 installed). To answer this I
ran an offline probe against the real model definition, with Sequelize's query
layer stubbed so no database was contacted. For each name it records whether
an UPDATE is issued and what it sets:

```
sequelize 6.37.8 | attributes: 197 | deletedAt attr: undefined | paranoid: true
wound                        -> UPDATE SET ["wound",…]           WHERE {"id": …}
voice_notes                  -> no UPDATE issued
psychology                   -> no UPDATE issued
not_a_column                 -> no UPDATE issued
de_blind_spot                -> UPDATE SET ["de_blind_spot",…]   WHERE {"id": …}
status                       -> UPDATE SET ["status",…]          WHERE {"id": …}
registry_id                  -> UPDATE SET ["registry_id",…]     WHERE {"id": …}
id                           -> no UPDATE issued
deletedAt                    -> no UPDATE issued
deleted_at                   -> no UPDATE issued
createdAt                    -> no UPDATE issued
feed_profile_id              -> UPDATE SET ["feed_profile_id",…] WHERE {"id": …}
character_key                -> UPDATE SET ["character_key",…]   WHERE {"id": …}
```

(Each SET list also carried `updatedAt`, plus fields the probe's test instance
marked as changed. That's an artefact of building the instance without a
database. A row loaded with `findByPk` sends only the changed field and
`updatedAt`.)

### 2b. Answers

- **Any column, or only some?** Any attribute the model defines, which is
  about 190 columns excluding `id` and the three timestamps. It can't change
  the primary key, `created_at`, `updated_at` or `deleted_at`: those names
  issue no UPDATE. A name that isn't a model attribute is silently ignored:
  no error and no write. The route still returns `character_updated: true`
  and marks the log as reviewed. Columns that exist in the table but not in
  the model are also unreachable. For example, `world_character_id` is used
  by `worldStudio.js` raw SQL but isn't defined on the model.
- **The four author-only fields?** Yes. `de_blind_spot`,
  `de_blind_spot_evidence`, `de_blind_spot_crack_condition` and
  `de_actual_narrative_gap` are model attributes. #1700 and #1704 gated every
  other path that writes caller-supplied values to them (the registry `PUT`,
  the depth `PUT` and `/confirm`, and `character-generation/confirm`) to the
  admin group. This path is still open to any signed-in user.
- **Anything governing access, ownership or identity?** The model has no
  per-user owner column (no `user_id`, `owner_id` or `created_by`), so there's
  no row-level ownership to take over. Reachable columns that do govern
  identity or association:
  - `character_key`: the character's slug, used as its identity across the
    system (CLAUDE.md: "`characterKey` is the slug").
  - `registry_id`: which registry, and so which book or world, the character
    belongs to (a UUID, `allowNull: false`).
  - `status`: an ENUM of `draft`, `accepted`, `declined`, `finalized`. The
    depth routes refuse to edit a `finalized` character, so setting or
    clearing `finalized` changes whether other routes will write to it.
  - `feed_profile_id`: the link to the character's social profile.

  A value of the wrong type for its column (a non-UUID into `registry_id`, a
  value outside the `status` ENUM) is rejected by Postgres. The route then
  returns 500, and the character is unchanged. A correctly shaped value is
  written.

### 2c. The growth engine's own field names mostly don't exist

Of the 11 names the growth engine is built around, **only `wound` is a
`RegistryCharacter` attribute**. There are six silent fields (`voice_notes`,
`behavior_pattern`, `arc_summary`, `notes`, `secret`, `appearance`) and five
contradiction fields named in the prompt (`wound`, `psychology`,
`relationship_to_jaw`, `world_exists`, `pain_point_category`). Checked by
grepping the model for each name as a top-level attribute: `wound` 1, the
other ten 0. So:
- every silent update is logged, and then discarded by Sequelize;
- every accepted contradiction on any field except `wound` is marked
  "reviewed", with `character_updated: true`, and discarded;
- `wound` is a `JSONB` column, and the AI's `proposed_update` is a string.

The growth prompt also reads fields that aren't model attributes
(`c.character_type`, `c.psychology`, `c.voice_notes`, `c.arc_summary`,
`c.relationship_to_jaw`, `c.behavior_pattern`), so the AI is mostly shown
"not documented".

Separately, `POST /character-growth` selects characters whose `status` is in
`['approved', 'edited', 'finalized']`. The model's `status` ENUM is `draft`,
`accepted`, `declined`, `finalized`. So only `finalized` characters are ever
evolved, and the growth route then skips any character whose `depth_level` is
`alive`.

These are functional findings, not authorization ones. They mean the route
writes far less than its design intends, but they don't limit what a stray
field name *could* reach (§2b).

---

## 3. Who may call it

- `POST /character-growth/:id/review` carries `requireAuth` and nothing else:
  no `authorize(...)`, no `userInGroup`, no check of who created the log or
  which registry the character belongs to. **Any signed-in Cognito user, in
  any group or none, can review any log row by id.**
- `POST /character-growth` (which creates the rows) carries `requireAuth,
  aiRateLimiter`. It's also open to any signed-in user.
- `GET /character-growth/flagged` and `GET /character-growth/history/:characterId`
  carry `requireAuth`.
- These auth shapes are locked by `tests/unit/routes/character-growth-tier-promotion.test.js`
  (F-AUTH-1 CP6).
- For context: Evoni has confirmed that self-signup is off, so "any signed-in
  user" means accounts created by an admin. At present that's Evoni.

---

## 4. Where the field name comes from, and what a wrong value would do

**Origin:** the model's JSON reply to `POST /character-growth`, at
`growthData.character_updates[].contradiction_checks[].field`. It's parsed
with `JSON.parse` after stripping code fences, and stored verbatim as
`CharacterGrowthLog.field_updated`.

**Validation before use:**
- Silent updates are checked against `SILENT_FIELDS` before logging and
  before writing.
- Contradictions are never checked, neither when logged nor at `/review`.
  The prompt *asks* for one of five names, but nothing enforces it.

**What a wrong or hostile value would do:**
- **A name that isn't a column** (the common case; see §2c): nothing is
  written, and the log is marked reviewed as if it had been.
- **The name of a real column** (for example `registry_id`, `character_key`,
  `status`, `de_blind_spot`): on `accepted` that column is set to the AI's
  `proposed_update`. On `modified` it's set to the caller's `modified_value`.
  Postgres then either accepts the value or rejects its type (a 500, with
  nothing written).
- **How a hostile value could arrive:** the AI's reply is shaped by the scene
  text, the plot-memory and character-revelation proposals, and the
  character's current values. All of these are writable by signed-in users
  through other routes. That's a prompt-injection path from story content to
  a chosen column name. It still needs someone to accept the flag.
  `StoryProposer` shows each flag's `field_updated`, previous value, new value
  and reasoning before its "Update registry" button (§5), so a reviewer who
  reads the flag sees the column name. Nothing stops an accept sent directly
  to the API.
- **Direct creation:** no route lets a caller create a `CharacterGrowthLog`
  row with a field name of their choosing. The only writer is the AI path
  above; `admin.js`'s `POST /query` allows `SELECT` statements only.

---

## 5. Frontend callers

- **`/review` is called by `StoryProposer`** (`pages/StoryProposer.jsx`,
  `reviewGrowthFlagApi`, from its `reviewFlag(flagId, decision)`). Each flag
  shows its character, `field_updated`, previous value, new value and growth
  source, with two buttons: "Update registry" (`accepted`) and "Keep
  original" (`reverted`). It never sends `modified` or `modified_value`.
  `StoryProposer` is the `/scene-proposer` route, which is **URL-only**: no
  sidebar entry and no in-app link (`docs/SIDEBAR_PROPOSAL.md` §3).
- **`GET /character-growth/flagged`** is called by `StoryProposer` and by
  `StoryDashboard` (`components/StoryDashboard.jsx`). `StoryDashboard` is
  rendered only by `/universe/story-dashboard`, also URL-only.
- **Nothing calls `POST /character-growth`**, the route that creates log
  rows: no frontend code, no backend code, no service. Unless it's called
  directly (a script or API client), there are no new rows for `/review` to
  act on. This read can't tell how many rows the table already holds.

---

## 6. F-AUTH-1 register coverage

The register covers this route's **authentication shape** only. Nothing in
it addresses the unvalidated field name.
- `F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md`, rows 9–10:
  `characterGrowthRoute.js` "Tier 1 PROMOTE (base)", 3 handlers, and "Tier 1
  + `aiRateLimiter`", 1 handler.
- `F-AUTH-1_Fix_Plan_v2.37.md`, §5.48 "CP6 closure": lists
  `characterGrowthRoute.js` among the 13 modified files (line 3180).
- `F-AUTH-1_Fix_Plan_v2.37.md`, at line 3402: names it among "5 CP-audited
  files NOT touched". The two lines of the same filed document read
  differently. This read records that and doesn't resolve it.
- `F-AUTH-1_Fix_Plan_v2.37.md` line 2505 and `F-Stats-1_Fix_Plan_v1.59.md`
  line 182: record the shared `/api/v1/memories` mount stack.

No filed document mentions `field_updated`, `_CONTRADICTION_FIELDS`, or a
whitelist for this route.

---

## 7. Options for Evoni — no recommendation

| Option | What it would cost | What it would prevent |
|---|---|---|
| **A. Whitelist the writable fields** in `/review`, and at log creation: refuse or skip any `field_updated` not on a list (e.g. the unused `_CONTRADICTION_FIELDS`) | Small code change. The list must be real columns: of the 11 intended names only `wound` exists (§2c), so the whitelist would currently allow almost nothing unless the model or list is corrected first | Stops the route writing any column outside the list, including the four author-only fields and `registry_id`, `character_key`, `status` and `feed_profile_id` |
| **B. Gate the route** to the admin group (`authorize(['ADMIN'])` or `userInGroup`, as #1700 and #1704 did) | Small. `StoryProposer` would work only for admins, which today is Evoni | Stops non-admins accepting flags. Doesn't stop an admin accepting an AI-chosen field name, so the column reach in §2b remains |
| **C. Remove the route** (or the whole growth review flow) | Loses the review step for contradictions. Given §2c and §5 (nothing creates new rows; most fields are discarded), little working behaviour depends on it today | Removes the write path entirely |
| **D. Leave it** | Nothing now | Nothing. The reach in §2b stays open to any signed-in user, limited in practice by the lack of new log rows (§5) and by who can sign in (§3) |

A and B combine. Either A or C would also want a decision on the functional
findings in §2c, since fixing the field names would turn this route from
"mostly discards" into "writes what the AI names".

---

## What this read does not do

- doesn't change code, add a whitelist, or gate anything;
- doesn't recommend an option;
- doesn't edit anything under `docs/audit/`, and isn't a register document;
- mints no FD, XK, or PE number;
- made no host, AWS, database, or Cognito contact. The §2a probe ran against
  the model definition with the query layer stubbed.
