# F-Stats-1 Fix Plan v1.12

## What changed in v1.12
- **§14 (new cut):** `src/routes/wardrobe.js` inventory — 35 units derived
  live, **25 convert, 10 withdraw, 0 deferred**.
- **§12.34 (new):** hard-DELETE and manual soft-delete coexist on `wardrobe`.
  The two conversion shapes are not interchangeable.
- **§12.35 (new):** `character_key = 'lala'` literal on four coin-affecting
  statements — evidence for F-Sec-3.
- **§12.36 (new, CLEARED):** `${where}` template interpolation is a
  hardcoded ternary, not an injection surface. Recorded so it is not
  re-flagged.
- **§12.37 (new):** `character_state_history` remains modelless. Decision
  #19's blocker extends to a second file.
- **§12.38 (new):** `WorldEvent` is paranoid *and* its `Episode` association
  is directional. Both directions of §12.33 are live in one file.
- **Decisions #22–#25:** withdrawal groups and the §12.34 shape lock.
- **§13 amendment:** unit 3 CLOSED — converted at `081e0d98` (#965).
  `evaluation.js` is **7 of 7**.
- **Open items 17–19.**
- **§11:** v1.12 row added.
- Basis: `081e0d98`. Mints no FD.

Written **before** PR 4 execution, like v1.8 and v1.10. Execution is a
separate session per the standing Forward Statement rule.

---

## §13 CLOSED — `evaluation.js` complete

Unit 3 converted at `081e0d98` (#965) per Decision #21, using
`Show.unscoped().findAll()` with `attributes` limited to `id, name` and
`.get({ plain: true })` per §12.29a. The now-unused
`const { sequelize } = models;` destructure was removed from that handler;
unit 1's `models.sequelize.literal` lives in `getOrCreateCharacterState` and
is unaffected.

| # | Statement | Final |
|---|---|---|
| 1 | SELECT `character_state`, literal sort | Converted (#963) |
| 2 | INSERT `character_state` | Converted (#963) |
| 3 | SELECT `id, name FROM shows` | **Converted (#965)** |
| 4 | `COUNT(*)` `character_state` | Converted (#963) |
| 5 | `COUNT(*)` `episodes` | Converted (#963) |
| 6 | UPDATE `character_state` | Converted (#963) |
| 7 | UPDATE `episodes` | Converted (#963) |

**7 of 7.** First file in F-Stats-1 Phase B to convert completely. §13 is
closed and takes no further amendments.

---

## §14 PR 4 Conversion Inventory (NEW — derived live at `081e0d98`)

**Target: `src/routes/wardrobe.js`.** Thirty-five raw statements.
**25 in scope, 10 withdrawn, 0 deferred.**

### Derivation note

A `sequelize.query` grep returns **35** matches and a `QueryTypes` grep
returns **zero**. Unlike `evaluation.js`, this file uses the destructuring
form exclusively — `const [rows] = await models.sequelize.query(...)` — so
there are no option lines inflating the count. The v1.10 miscount trap does
not apply here. **35 matches equal 35 statements.**

Binding is uniform: every statement uses `models.sequelize`, never a bare
`sequelize`.

### Tables in scope

Six tables, five of which have models:

| Table | Model | Paranoid | §12.33 direction |
|---|---|---|---|
| `wardrobe` | `Wardrobe` | no | must write `deleted_at: null` explicitly |
| `episode_wardrobe` | `EpisodeWardrobe` | no | same |
| `episodes` | `Episode` | no (named scope only) | same |
| `character_state` | `CharacterState` | no | none — raw SQL does not filter |
| `world_events` | `WorldEvent` | **yes** | `.unscoped()` where raw SQL does not filter |
| `character_state_history` | **none** | — | withdrawn, §12.37 |

All verified live at `081e0d98`. Note the inversion against `evaluation.js`:
there, the hazard was a paranoid model silently *shrinking* a row set. Here,
four of five models are non-paranoid and most statements filter `deleted_at`
manually, so the dominant hazard is a dropped predicate silently *widening*
one. See §12.38.

### Inventory

| # | Table | Statement | Disposition |
|---|---|---|---|
| 1 | `wardrobe` | GROUP BY aggregate, `${where}` | Convert — §12.36, explicit `deleted_at` |
| 2 | `information_schema` | table-existence probe | **WITHDRAWN — Decision #23** |
| 3 | `episode_wardrobe` ⋈ `wardrobe` | JOIN + correlated subquery | **WITHDRAWN — Decision #23** |
| 4 | `wardrobe` | `parent_item_id IN (:itemIds)` | Convert — `Op.in`, explicit `deleted_at` |
| 5 | `episodes` ⋈ `world_events` | LEFT JOIN on `used_in_episode_id` | **WITHDRAWN — Decision #24** |
| 6 | `wardrobe` | SELECT `id, price`, `${where}` | Convert — §12.36 |
| 7 | `wardrobe` | UPDATE `coin_cost` (in loop) | Convert |
| 8 | `wardrobe` | **hard DELETE** | Convert — §12.34, Decision #25 |
| 9 | `wardrobe` | SELECT `id` by name | Convert — explicit `deleted_at` |
| 10 | `wardrobe` | INSERT seed item (~24 columns) | Convert — `.create()` |
| 11 | `world_events` | SELECT, **no `deleted_at` filter** | Convert — **`.unscoped()` required** |
| 12 | `wardrobe` | SELECT visible/owned | Convert — explicit `deleted_at` |
| 13 | `wardrobe` | SELECT lock fields by id | Convert — explicit `deleted_at` |
| 14 | `character_state` | SELECT `id, coins` — **`'lala'` literal** | Convert — §12.35, key verbatim |
| 15 | `character_state` | UPDATE `coins = coins - :cost`, `transaction: t` | **WITHDRAWN — Decision #22** |
| 16 | `wardrobe` | UPDATE `is_owned` | Convert |
| 17 | `episode_wardrobe` | INSERT ... ON CONFLICT DO UPDATE | **WITHDRAWN — Decision #23** |
| 18 | `wardrobe` | UPDATE `times_worn = COALESCE(...)+1` | Convert — `.increment()` or literal |
| 19 | `wardrobe` | SELECT * by id | Convert — explicit `deleted_at` |
| 20 | `character_state` | SELECT * — **`'lala'` literal** | Convert — §12.35, key verbatim |
| 21 | `character_state` | UPDATE `coins`, `transaction: t` | **WITHDRAWN — Decision #22** |
| 22 | `wardrobe` | UPDATE `is_owned` | Convert |
| 23 | `character_state_history` | INSERT (with `id`) | **WITHDRAWN — Decision #22, §12.37** |
| 24 | `character_state_history` | INSERT (without `id`) | **WITHDRAWN — Decision #22, §12.37** |
| 25 | `episode_wardrobe` ⋈ `wardrobe` | JOIN by episode | Convert — declared belongsToMany |
| 26 | 4-table JOIN | aliased projection across `ew`/`w`/`e`/`we` | **WITHDRAWN — Decision #23** |
| 27 | `wardrobe` | SELECT by `parent_item_id` | Convert — explicit `deleted_at` |
| 28 | `wardrobe` | UPDATE link attachment | Convert — explicit `deleted_at` |
| 29 | `wardrobe` | SELECT parent fields | Convert — explicit `deleted_at` |
| 30 | `wardrobe` | INSERT attachment piece | Convert — `.create()` |
| 31 | `wardrobe` | UPDATE clear parent | Convert — explicit `deleted_at` |
| 32 | `wardrobe` | **UPDATE `deleted_at = NOW()`** — manual soft-delete | Convert — §12.34, Decision #25 |
| 33 | `wardrobe` | UPDATE `is_set`/`set_name` | Convert — explicit `deleted_at` |
| 34 | `wardrobe` | SELECT for auto-tagging | Convert — explicit `deleted_at` |
| 35 | `wardrobe` | UPDATE `CAST(:types AS jsonb)`, `transaction: t` | **WITHDRAWN — Decision #22** |

**Execution order is NOT specified in this revision.** Twenty-five units in
one PR exceeds anything F-Stats-1 has shipped. See open item 17.

---

## §12.34 — hard-DELETE and soft-delete coexist on `wardrobe` (NEW)

Unit 8 issues `DELETE FROM wardrobe WHERE show_id = :show_id AND name IN
(:names)` — a physical row removal, inside the seeder's reset path.

Unit 32 issues `UPDATE wardrobe SET deleted_at = NOW() WHERE id = :pieceId
...` — a manual soft-delete, on the attachment-piece removal path.

Both target the same table in the same file. Because `Wardrobe` is **not**
registered `paranoid: true`, Sequelize's `.destroy()` maps to a physical
`DELETE`, not to a `deleted_at` write. The two conversions are therefore
**not interchangeable**, and the mapping is counter-intuitive:

- Unit 8 (hard DELETE) → `Wardrobe.destroy({ where: ... })`
- Unit 32 (soft-delete) → `Wardrobe.update({ deleted_at: new Date() }, { where: ... })`

Reversing them would silently convert a soft-delete into permanent data loss
on a user's wardrobe, or leave seeder rows physically present where the code
expects them gone. Neither would raise an error and neither is visible in a
syntax check.

Locked by Decision #25.

---

## §12.35 — `character_key = 'lala'` on coin-affecting statements (NEW)

Four statements embed the literal `'lala'` rather than accepting a key
parameter:

| # | Statement | Effect |
|---|---|---|
| 14 | `SELECT id, coins FROM character_state ... character_key = 'lala'` | reads balance before a deduction |
| 20 | `SELECT * FROM character_state ... character_key = 'lala'` | reads balance before a purchase |
| 23 | `INSERT INTO character_state_history ... 'lala' ...` | ledger row, `source = 'wardrobe_purchase'` |
| 24 | `INSERT INTO character_state_history ... 'lala' ...` | ledger row, `source = 'manual'` |

All four sit on currency paths. Units 14 and 20 read the balance that a
subsequent `UPDATE` deducts from.

This is the user-facing half of the character_key drift surface. **Per
Decision #12 the literal passes through verbatim** — F-Stats-1 does not
normalize it, and the conversions preserve it exactly. Recorded here as
evidence for F-Sec-3's canonical-key sweep, the same treatment §12.32
received for the `'justawoman'` canonicality comment.

Ownership: **F-Sec-3**, forward-pointer only. No F-Stats-1 action.

---

## §12.36 — `${where}` interpolation, CLEARED (NEW)

Units 1 and 6 build SQL by template-literal interpolation rather than
through `replacements`:

```
FROM wardrobe ${where}
```

This was flagged at inventory as a possible injection surface and **cleared
on live evidence**. Both `where` values are ternaries between hardcoded
string constants:

```js
const where = show_id ? 'WHERE (show_id = :show_id OR show_id IS NULL) AND deleted_at IS NULL' : 'WHERE deleted_at IS NULL';
const where = show_id ? 'AND (show_id = :show_id OR show_id IS NULL)' : '';
```

`show_id` selects *which* constant; its value still binds through
`replacements` and never enters the string. No user input reaches the
concatenation. **Not an injection surface.**

Recorded as a cleared finding so that a future inventory pass does not
re-flag it and repeat the derivation.

---

## §12.37 — `character_state_history` remains modelless (NEW)

Decision #19 withdrew `evaluation.js` unit 10 on the grounds that
`character_state_history` has no Sequelize model. That blocker is **not
file-local**. Units 23 and 24 of `wardrobe.js` insert into the same table and
are withdrawn on the same grounds.

Re-verified at `081e0d98`: no `CharacterStateHistory` in
`src/models/index.js`, no model file matching `History` under `src/models`.

The two inserts also carry **different column lists** — unit 23 supplies `id`
explicitly, unit 24 omits it and relies on a column default. Recorded because
any future model creation must accommodate both call shapes.

Creating the model remains open item 13 from v1.10, still unassigned, still
most plausibly F-Franchise-1's given the `source` ENUM's constants-as-canon
shape.

---

## §12.38 — `WorldEvent`: paranoid *and* directionally associated (NEW)

`WorldEvent` is registered `paranoid: true`. It is the only paranoid model
among `wardrobe.js`'s six tables, and it produces both of §12.33's failure
directions in one file:

**Direction A — unit 11.** `SELECT ... FROM world_events we WHERE
we.used_in_episode_id = :episode_id LIMIT 1` carries no `deleted_at`
predicate. A plain `WorldEvent.findOne()` would append one and could return
nothing where the raw query returned a row. **`.unscoped()` is mandatory.**

**Direction B — unit 5.** `FROM episodes e LEFT JOIN world_events we ON
we.used_in_episode_id = e.id`. The association exists but runs the wrong way:
`WorldEvent.belongsTo(models.Episode, { foreignKey: 'used_in_episode_id', as:
'usedInEpisode' })`. There is no visible `Episode.hasMany(WorldEvent)`
inverse, so the JOIN cannot be traversed from `Episode` through `include`.
Withdrawn by Decision #24.

**Additional uncertainty, recorded not resolved.** `WorldEvent.associate()`
contains a comment stating that some associations are *disabled until
migrations run on the DB* (venue_location_id, opportunity_id). Whether the
`Episode` association sits inside or outside that conditional was not
determinable from the derivation read. This does not change unit 5's
withdrawal — a directional mismatch withdraws it either way — but it is
recorded as open item 18 because it bears on any future attempt to convert
`worldEvents.js`, where `WorldEvent` is the primary table.

Ownership: **F-Stats-1.** Discharged for `wardrobe.js` by unit 11's
`.unscoped()` requirement and unit 5's withdrawal. Carried forward for
`worldEvents.js`.

---

## §9 Decisions Locked (Decisions #22–#25 ADDED)

Decisions #1–#21 unchanged.

### Decision #22 — transaction-block and modelless withdrawals

Units **15, 21, 35** carry `transaction: t` and sit inside
`models.sequelize.transaction(async (t) => { ... })` blocks. Units **23 and
24** sit in the same blocks *and* target a modelless table.

All five are withdrawn. **The transaction blocks stay wholly raw.**

This extends Decision #19's reasoning without modification: converting
individual statements inside a transaction block while leaving siblings raw
produces a block with two binding conventions and no safety gain. Units 23
and 24 are additionally blocked by §12.37.

**Locked: 2026-08-02.**

### Decision #23 — unexpressible-shape withdrawals

Units **2, 3, 17, 26** are withdrawn because the ORM cannot express their
shape without `sequelize.literal`, at which point the conversion is raw SQL
wearing an ORM wrapper — no injection safety gained, readability lost, and
response-identity risk introduced.

- **Unit 2** — `SELECT 1 FROM information_schema.tables`. A catalog probe.
  No model exists or should exist.
- **Unit 3** — a correlated `COUNT(*)` subquery projected as
  `attachment_count`, inside a JOIN.
- **Unit 17** — `INSERT ... ON CONFLICT (episode_id, wardrobe_id) DO UPDATE
  SET updated_at = NOW()`. Sequelize's `.upsert()` has different
  conflict-target semantics on composite keys; forcing it risks changing
  behavior on a write path.
- **Unit 26** — a four-table JOIN with every column aliased
  (`e.id as episode_id`, `w.name as item_name`, ...). Reproducing the
  projection through `include` + `attributes` is achievable but the
  response-identity risk is high and the benefit is nil.

**Locked: 2026-08-02.**

### Decision #24 — unit 5 withdrawn on directional association

`Episode` → `WorldEvent` cannot be traversed; only the inverse is declared.
See §12.38 Direction B. Withdrawn rather than deferred: the finding is
determinate, and a deferral would leave a unit with no disposition for a
future session to rediscover.

**Locked: 2026-08-02.**

### Decision #25 — units 8 and 32 conversion shapes locked explicitly

Per §12.34, and stated as executable shapes because the mapping is
counter-intuitive:

```js
// Unit 8 — hard DELETE
await models.Wardrobe.destroy({
  where: { show_id, name: { [Op.in]: SEED_WARDROBE.map(i => i.name) } },
});

// Unit 32 — manual soft-delete
await models.Wardrobe.update(
  { deleted_at: new Date() },
  { where: { id: pieceId, parent_item_id: parentId, deleted_at: null } },
);
```

`Wardrobe` is non-paranoid, so `.destroy()` issues a physical `DELETE` and
carries no `deleted_at` semantics. Unit 32 must **not** use `.destroy()`.

**Locked: 2026-08-02.**

---

## Open items

Items 1, 2, 3, 6, 7, 8, 9, 11, 12, 13, 15, 16 carried unchanged from v1.11.
Item 14 closed at v1.11. **Item 3 partially discharged** — `wardrobe.js` is
now inventoried; `worldEvents.js` (144 statements) remains.

17. **NEW:** PR 4 execution order and split are unspecified. Twenty-five
    units in one PR exceeds anything F-Stats-1 has shipped (PR 1 carried 14).
    A v1.13 must specify the split before execution. Natural seams from §14:
    the seeder path (units 7–10), the purchase paths (13, 14, 16, 19, 20, 22),
    and the attachment paths (27–34) are largely independent.
18. **NEW:** whether `WorldEvent.belongsTo(models.Episode, ...)` sits inside
    the *disabled-until-migrations* conditional in `WorldEvent.associate()`
    was not determined. Immaterial to unit 5's withdrawal; material to
    `worldEvents.js`, where `WorldEvent` is the primary table.
19. **NEW:** unit 18 converts `times_worn = COALESCE(times_worn, 0) + 1`.
    `.increment()` and `sequelize.literal` differ in NULL handling —
    `.increment()` on a NULL column yields NULL in Postgres, where
    `COALESCE` yields 1. The shape must be verified at execution, not
    assumed.

**Open item 6 remains open and is now four merges old.** Nothing to date
exercises a request against any converted handler or compares response
bodies. PRs 1, 2, 3, and #965 have all shipped under that condition. It
should not still be open when F-Stats-1 closes.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0-v1.2 | 2026-05-14 | Initial plan through S12.19; Decision #8. |
| v1.3 | 2026-07-22 | Decisions #10-#12; S12.21-S12.23; S13 PR 1 inventory (19 units). |
| v1.4 | 2026-07-24 | S13 re-cut 17/16; S12.24; Decision #13. Basis 544cb9ad. |
| v1.5 | 2026-08-01 | Decision #14; S12.25 response-shape hazard class; S12.26; S13 14/14. Basis a61d4913. |
| v1.6 | 2026-08-01 | S12.27 live-schema verification; open items 4, 5 CLOSED. Basis 4bfc3115. |
| v1.7 | 2026-08-01 | S12.28; Decision #15; S12.26 correction; PR 2 inventory. Basis 96ab0a97. |
| v1.8 | 2026-08-01 | Decisions #16, #17; PR 2 execution order. Basis 1d167277. |
| v1.9 | 2026-08-01 | S12.29 PR 2 departures; S12.25 correction; PR 2 execution record; open item 10 CLOSED. Basis 0dd0b9ff. |
| v1.10 | 2026-08-01 | S13 PR 3 inventory (10 units, 7 in scope); Decisions #18-#20; S12.28 extended to a third site; S12.30, S12.31, S12.32; open items 11-14. Basis ee5742b1. |
| v1.11 | 2026-08-02 | §12.33 paranoid-model class, owned and closed; Decision #21; §13 PR 3 execution record; open item 14 CLOSED; open items 15, 16. Basis `ce953f57`. |
| v1.12 | 2026-08-02 | §14 `wardrobe.js` inventory (35 units, 25 in scope); §12.34–§12.38; Decisions #22–#25; §13 CLOSED at 7 of 7; open items 17–19. Basis `081e0d98`. |

v1.12 supersedes v1.11 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.11.
- Mints: Decisions #22–#25, §12.34, §12.35, §12.36, §12.37, §12.38, §14
  `wardrobe.js` inventory, open items 17–19.
- Closes: §13 (`evaluation.js` 7 of 7), §12.34, §12.36, §12.38 (for
  `wardrobe.js`).
- Forward-points: §12.35 to F-Sec-3; §12.37 to open item 13.
- Partially discharges: open item 3.
- No live-database contact. No prod-box contact. No dev-box contact. All
  conclusions derive from committed files read via `git show origin/main:`.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.12 is the plan-of-record. **PR 4 is inventoried but NOT gated** — unlike
PR 3 at v1.10, the execution order and split are unspecified. Twenty-five
units is larger than any PR F-Stats-1 has shipped, and §14's disposition
column carries three units (8, 18, 32) whose shapes are locked or flagged
precisely because a mechanical reading gets them wrong.

`wardrobe.js` produced five new findings from a single derivation pass, one
of which (§12.36) was raised and cleared within the pass. That is the third
consecutive file where derivation surfaced material the preceding revision
could not have known.

`worldEvents.js` remains: **144 raw statements, primary table paranoid**, and
§12.28's densest surface. It is larger than everything F-Stats-1 has
converted and inventoried combined. It will need its own inventory session
and almost certainly several execution PRs.

**No file is inventoried in the same session as its execution.** Unchanged
since v1.10 and reaffirmed here.

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-02. Main at `081e0d98` (#965). Predecessor: v1.11.*
*Minted: Decisions #22–#25, §12.34–§12.38, §14 inventory, open items 17–19. Closed: §13, §12.34, §12.36, §12.38. No FD numbers. [skip-automerge]*
