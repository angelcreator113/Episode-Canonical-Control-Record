# F-Stats-1 Fix Plan v1.14

## What changed in v1.14
- **§16 (new):** `src/routes/worldEvents.js` structural inventory —
  **112 statements across 48 handlers in 9 groups**, reconciled by two
  independent methods. Fourteen handlers carry no raw SQL and are out of
  scope.
- **§16.1–§16.2:** dispositions for **Core CRUD** (5 convert / 16 withdraw)
  and **Overlays** (15 convert / 10 withdraw, 2 handlers pending). Seven
  groups carried forward.
- **§12.41 (new):** the **schema-drift try/catch class** — the dominant
  reason this file resists conversion. Four-plus sites.
- **§12.42 (new):** **non-uniform convertibility.** Withdrawal rate varies
  from 76% (Core CRUD) to 40% (Overlays) *within one file*. Group-level
  splitting is mandatory, not preferred.
- **§12.35 EXTENDED:** a **`'justawoman'`** read in `worldEvents.js`
  alongside `'lala'` reads in the same file. **P0 consistency drift.**
- **§12.43 (new, CLEARED):** three dynamic-SQL sites and one binding
  inconsistency raised at derivation and cleared on evidence.
- **§12.38 INVERTED:** `.unscoped()` is the **majority** case here, not the
  exception.
- **Open items 22–24.**
- Basis: `5d9be42b`. Mints no FD.

Written **before** any `worldEvents.js` execution and before PR 4a. §15's
PR 4 split is unaffected by this revision.

---

## §16 `worldEvents.js` Structural Inventory (NEW — derived live at `5d9be42b`)

### Count reconciliation

Three counts were taken. **The first was wrong and is recorded so the error
is not repeated.**

| Method | Result |
|---|---|
| `sequelize\.query` grep | 144 |
| minus `QueryTypes` option lines (32, zero overlap with the above) | **112** |
| `await (models\.)?sequelize\.query` call sites, direct | **112** |
| hand-attribution walking interleaved output | 113 ✗ |

The hand-attribution over-counted the Invitations group by one (23, not 24).
It was found by **re-deriving all four windows with the direct call-site
pattern**, not by hunting the discrepancy. Two independent methods agreeing
on 112 settles it.

**The v1.12 and v1.13 figure of 144 is superseded.** It was derived at
`ee5742b1` by the raw grep and carried forward through two revisions without
re-derivation — the exact miscount v1.10 recorded to prevent. `worldEvents.js`
is **112 statements, not 144.**

### Group structure

| Group | Handlers w/ SQL | Statements |
|---|---|---|
| Core CRUD | 7 | 21 |
| Invitations | 9 | 23 |
| Episode generation | 5 | 15 |
| Overlays | 9 | 26 |
| Financial | 5 | 10 |
| Outfit | 4 | 7 |
| Venue/social | 4 | 5 |
| Distribution | 3 | 3 |
| Stories | 2 | 2 |
| **Total** | **48** | **112** |

Sixty-two `router.*` handlers exist; **fourteen carry no raw SQL** and
delegate entirely to services. All handlers are inline `async (req, res)` —
this file uses no controller delegation anywhere.

### Table and model matrix

Twelve tables. Verified live at `5d9be42b`.

| Table | Model | Paranoid |
|---|---|---|
| `world_events` | `WorldEvent` | **yes** |
| `assets` | `Asset` | **yes** |
| `opportunities` | `Opportunity` | **yes** |
| `scene_sets` | `SceneSet` | **yes** |
| `scene_set_episodes` | `SceneSetEpisode` | **yes** |
| `episodes` | `Episode` | no (named scope only) |
| `wardrobe` | `Wardrobe` | no |
| `character_state` | `CharacterState` | no |
| `social_profiles` | `SocialProfile` | no |
| `world_locations` | `WorldLocation` | no |
| `character_state_history` | **none** | — |
| `episode_todo_lists` | **none** | — |
| `stories` | **none** | — |

**Three modelless tables**, all withdrawing under §12.37. `stories` was
confirmed by exclusion: the only `stories`-adjacent model is
`StorytellerStory`, whose `tableName` is `storyteller_stories` — a different
table.

---

## §12.38 INVERTED — `.unscoped()` is the majority case here

`wardrobe.js` had one paranoid model of five, and most statements filtered
`deleted_at` manually. The hazard there was **dropping** an explicit
predicate.

`worldEvents.js` has **five paranoid models of ten**, including the two
highest-volume tables — `world_events` (~60 statements) and `assets` (~20).
Most statements against them carry **no** `deleted_at` predicate. The hazard
here is **failing to add `.unscoped()`**.

**The default conversion shape differs by file.** A reviewer carrying
`wardrobe.js` habits into `worldEvents.js` gets it backwards on the majority
of statements, silently.

Worse, both directions occur **within a single handler**.
`POST /:eventId/approve-overlay` statement 1 reads `world_events` with no
`deleted_at` filter (needs `.unscoped()`); statement 2 reads `assets` *with*
`deleted_at IS NULL` (default scope correct, `.unscoped()` must be omitted).
Two adjacent statements, opposite requirements, no error either way.

This is the sharpest per-statement hazard in the file.

---

## §12.41 — the schema-drift try/catch class (NEW)

The dominant reason `worldEvents.js` resists conversion. Sites found:

1. `PUT /world/:showId/events/:eventId` — full UPDATE, catch, parse the
   missing-column name out of the Postgres error text, rebuild a reduced
   clause list, retry, then stash the dropped fields into
   `canon_consequences.automation`.
2. `DELETE /world/:showId/events/:eventId` — `UPDATE ... SET deleted_at =
   NOW()` in the try, `DELETE FROM world_events` in the catch.
3. `POST /:eventId/inject` — `UPDATE world_events` with `times_used` in the
   try, without it in the catch.
4. `POST /:eventId/approve-overlay` — `UPDATE assets` with
   `approval_status` in the try, without it in the catch.
5. `POST /generate-overlay/:overlayType` — two `INSERT INTO assets`
   variants, same pair shape.

Plus bare `catch { /* columns may not exist */ }` swallows on several
`assets` writes.

### Why these are unconvertible

The recovery depends on the **raw driver error shape**. `Model.update()` and
`Model.create()` throw Sequelize-wrapped errors; site 1 literally parses the
message text to learn which column is missing. Converting either half of a
pair changes which errors reach the catch. Converting both changes the
recovery semantics. This is the Decision #23 class — the ORM cannot express
the shape — arriving through error handling rather than through SQL syntax.

### Site 2 deserves a specific note

`WorldEvent` **is** paranoid. `.destroy()` would soft-delete correctly and
would never fall through to permanent removal. The hard-delete fallback
exists to cover a `deleted_at` column that the model declaration says is
always there.

**A schema difference silently escalates a recoverable delete into a
permanent one.** The correct remedy is to delete the fallback. That is a
**fix**, not a conversion, and F-Stats-1 does not fix — same discipline
that preserved §12.30's swallowed `.catch()` verbatim. Recorded for whoever
owns it.

Ownership: **unassigned.** Not F-Stats-1's to remedy. See open item 22.

---

## §12.42 — non-uniform convertibility (NEW)

Withdrawal rates differ by more than a factor of three **inside one file**:

| Group | Statements | Convert | Withdraw | Withdrawal rate |
|---|---|---|---|---|
| Core CRUD | 21 | 5 | 16 | **76%** |
| Overlays | 26 | 15 | 10 | **40%** (2 handlers pending) |

For comparison: `wardrobe.js` withdrew 29% overall, `evaluation.js` 30%.

The cause is structural, not incidental. Core CRUD is where §12.41's
schema-drift pairs, the dynamic SET clauses, and the JOIN-heavy list query
live. Overlays are mostly straight single-table reads in the
`QueryTypes.SELECT` form.

**Consequence: `worldEvents.js` must be split by group, and the groups are
not interchangeable.** A single PR spanning Core CRUD and Overlays would mix
a 76%-withdrawal surface with a 40% one and obscure both. Per-group PRs also
keep each PR's dominant hazard legible — schema-drift pairs in one,
`.unscoped()` direction in another.

Ownership: **F-Stats-1**, closed by this revision's group structure.

---

## §12.35 EXTENDED — `'justawoman'` in `worldEvents.js` (P0)

`GET /world/:showId/events/next-suggestions`:

```sql
SELECT coins, reputation, brand_trust, influence, stress
FROM character_state
WHERE show_id = :showId AND character_key = 'justawoman'
LIMIT 1
```

`POST /world/:showId/events/:eventId/generate-script`, **same file**:

```sql
SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1
```

Both read character state for the same show. They read **different rows**.

### Classification

**P0 consistency drift. Not an injection risk** — both literals are
hardcoded, no user input is involved.

This is a **read-side** site, which distinguishes it from the write-side
drift recorded previously. The user-visible consequence is not a lost delta:
it is that event suggestions are computed against a **different balance**
than Edit Stats displays. Same root cause, different surface class.

`wardrobe.js` units 14, 20, 23, 24 all use `'lala'`. `worldEvents.js` uses
both. The two keys now provably coexist **within a single route file**.

### Handling

**Decision #12 holds without modification.** Any conversion touching either
read passes the literal through **verbatim**. F-Stats-1 does not normalize,
does not parameterize, does not "fix while we're in there."

Cross-link: this **expands F-Sec-3's surface coverage to a user-facing
suggestion path.** F-Sec-3's canonical-key sweep must account for read sites
that feed UI recommendations, not only write sites that apply deltas.

Ownership: **F-Sec-3.** Forward-pointer only.

---

## §12.43 — raised and cleared at derivation (NEW)

Recorded so a future inventory pass does not re-flag them. Same convention as
§12.36.

**Three dynamic-SQL sites, all safe:**

1. `PUT /events/:eventId` — `setClauses.push(\`${field} = :${field}\`)`
   interpolates a variable, but `field` survives only if it passes
   whitelist `Set` membership. `coreClauses` re-parses and re-checks against
   a second whitelist.
2. `PUT /stories/:storyId` — clauses are hardcoded string literals inside
   `if` blocks. No interpolation at all.
3. `GET /events` — accumulating `query` string. `sortCol` is checked against
   a `validSorts` array; `sortOrder` is a strict ASC/DESC ternary; all filter
   values bind through `replacements`.

**No injection surface at any of the three.** All three still withdraw, on
shape grounds, not safety grounds.

**One binding inconsistency, cosmetic:** the Overlays and Venue/social groups
call `sequelize.query` on a bare `sequelize`; everything else uses
`models.sequelize`. Every bare binding resolves from
`const { sequelize } = models;` inside the handler. Same object, same
connection. Identical to the `evaluation.js` finding at v1.10.

**One structural note, not a defect:** seven handlers resolve models via
`req.app?.get?.('models') || require('../models')` rather than the file's
plain helper. Two resolution paths coexist. Presumed equivalent; not
verified. See open item 24.

---

## §16.1 Core CRUD — DISPOSITIONED

| Handler | Stmts | Convert | Withdraw | Basis |
|---|---|---|---|---|
| `GET /events` | 1 | 0 | 1 | LEFT JOIN, aliased projection, dynamic ORDER BY — Decision #23 class |
| `POST /events` | 2 | 2 | 0 | INSERT + read; `.unscoped()` on the read |
| `PUT /events/:eventId` | 5 | 0 | 5 | §12.41 site 1 |
| `DELETE /events/:eventId` | 2 | 0 | 2 | §12.41 site 2 |
| `POST /:eventId/inject` | 8 | 2 | 6 | see below |
| `POST /:eventId/generate-script` | 2 | 2 | 0 | one `.unscoped()` read; one `character_state` read carrying `'lala'` verbatim |
| `POST /events/bulk-seed` | 1 | 1 | 0 | bulk INSERT |
| **Total** | **21** | **5** | **16** | **76% withdrawal** |

### `POST /:eventId/inject` detail

| # | Statement | Call |
|---|---|---|
| 1 | `SELECT * FROM world_events` | Convert — `.unscoped()` |
| 2 | `UPDATE world_events` with `times_used` | WITHDRAW — §12.41 site 3 |
| 3 | `UPDATE world_events` without `times_used` | WITHDRAW — same pair |
| 4 | `UPDATE assets` in a swallowing catch | WITHDRAW — §12.41 |
| 5 | `INSERT scene_set_episodes ... ON CONFLICT (...) WHERE deleted_at IS NULL DO NOTHING` | WITHDRAW — partial-index upsert |
| 6 | `SELECT ss.id FROM scene_sets JOIN world_locations ... ILIKE` | WITHDRAW — JOIN |
| 7 | `UPDATE world_events SET scene_set_id` | Convert |
| 8 | `INSERT scene_set_episodes` (same shape as 5) | WITHDRAW |

Statements 5 and 8 exceed `wardrobe.js` unit 17's difficulty: Sequelize's
`.upsert()` cannot express a **partial-index** conflict target.

---

## §16.2 Overlays — DISPOSITIONED (2 handlers pending)

| Handler | Stmts | Convert | Withdraw |
|---|---|---|---|
| `POST /generate-overlay/:overlayType` | 5 | 2 | 3 |
| `POST /:eventId/approve-overlay` | 8 | 3 | 5 |
| `POST /:eventId/re-render-overlay` | 2 | 2 | 0 |
| `GET /overlay-tasks/:overlayType` | 2 | 1 | 1 |
| `GET /overlay-history/:overlayType` | 1 | 0 | 1 |
| `POST /:episodeId/generate-title-overlay` | 4 | 4 | 0 |
| `GET /:eventId/overlay-suggestions` | 1 | 1 | 0 |
| `PUT /:eventId/overlay-selections` | 1 | pending | — |
| `POST /:eventId/reject-overlay` | 2 | pending | — |
| **Subtotal (7 dispositioned)** | **23** | **13** | **10** |

Withdrawals are jsonb-operator predicates (`metadata->>'event_id'` in
`WHERE`), §12.41 pairs, and `episode_todo_lists` modelless writes.

**`GET /events/next-suggestions` (2 statements, Venue/social group)** is
dispositioned early because it carries §12.35's `'justawoman'` site: both
convert, literal verbatim.

---

## Open items

Items 1, 2, 3, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18, 19, 20, 21 carried from
v1.13. Item 3 is **further discharged** — `worldEvents.js` is now
inventoried; only its dispositions are incomplete.

22. **NEW:** §12.41's `DELETE /events/:eventId` hard-delete fallback is
    **unassigned**. A schema difference escalates a soft delete to permanent
    removal on a paranoid model. F-Stats-1 records it and does not remedy it.
23. **NEW:** seven of nine `worldEvents.js` groups remain undispositioned —
    Invitations (23), Episode generation (15), Financial (10), Outfit (7),
    Venue/social (5 less the 2 above), Distribution (3), Stories (2). Plus
    two Overlays handlers. **Re-derive live**; the group totals in §16 are
    the basis, not the dispositions.
24. **NEW:** the dual model-resolution paths
    (`req.app.get('models')` vs `require('../models')`) are presumed
    equivalent and were not verified. Material only if the two can return
    different `sequelize` instances.

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
| v1.11 | 2026-08-02 | S12.33 paranoid-model class, owned and closed; Decision #21; S13 PR 3 execution record; open item 14 CLOSED; open items 15, 16. Basis ce953f57. |
| v1.12 | 2026-08-02 | S14 wardrobe.js inventory (35 units, 25 in scope); S12.34-S12.38; Decisions #22-#25; S13 CLOSED at 7 of 7; open items 17-19. Basis 081e0d98. |
| v1.13 | 2026-08-03 | S15 PR 4 six-way split (25 of 25 allocated); Decision #26; S12.39 mixed handlers; S12.40 runtime-coverage finding; open item 17 CLOSED; open items 20, 21. Basis 5a8de23c. |
| v1.14 | 2026-08-03 | §16 `worldEvents.js` inventory — **112 statements, not 144**; §12.41 schema-drift class; §12.42 non-uniform convertibility; §12.35 extended (`'justawoman'`, P0); §12.43 cleared findings; §12.38 inverted; Core CRUD and Overlays dispositioned; open items 22–24. Basis `5d9be42b`. |

v1.14 supersedes v1.13 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.13.
- Mints: §16 inventory, §16.1, §16.2, §12.41, §12.42, §12.43, open items
  22–24.
- Extends: §12.35 (`'justawoman'` read site), §12.37 (two further modelless
  tables), §12.38 (inversion).
- Closes: §12.42, §12.43.
- Corrects: the `worldEvents.js` statement count carried in v1.12 and v1.13.
  **144 is superseded by 112.**
- Forward-points: §12.35 to F-Sec-3; §12.41 site 2 to open item 22.
- No live-database contact. No prod-box contact. No dev-box contact. All
  conclusions derive from committed files read via `git show origin/main:`,
  `git grep`, and `git ls-tree`.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.14 is the plan-of-record. **No `worldEvents.js` execution is gated by this
revision.** Two groups of nine are dispositioned; §15's PR 4 split for
`wardrobe.js` is unaffected and PR 4a remains the next executable work.

Three things this revision establishes:

**The file is smaller than recorded and harder than expected.** 112
statements, not 144 — but Core CRUD withdraws at 76% against `wardrobe.js`'s
29% overall. Fewer statements, far fewer convertible ones.

**Convertibility is not a property of the file.** §12.42's three-fold spread
between groups means any per-file estimate is meaningless here. Groups must
be dispositioned and shipped independently.

**The count error is the lesson.** 144 was derived once at `ee5742b1` and
carried through v1.12 and v1.13 unchallenged, by the exact mechanism v1.10
recorded to prevent. It was corrected only because the inventory re-derived
it. **A figure that has not been re-derived at the current basis is not
evidence, however many revisions have repeated it.**

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-03. Main at `5d9be42b` (#968). Predecessor: v1.13.*
*Minted: §16, §16.1, §16.2, §12.41, §12.42, §12.43, open items 22–24. Extended: §12.35, §12.37, §12.38. Corrected: `worldEvents.js` count 144 → 112. No FD numbers. [skip-automerge]*
