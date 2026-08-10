# F-Stats-1 Fix Plan v1.33

| | |
|---|---|
| **Predecessor** | v1.32 (`2c9ead22`, #1005). |
| **Basis** | `2c9ead22`. |
| **Author date** | 2026-08-10 |
| **Gate effect** | PARTIAL disposition of `worldEvents.js`: five of seven undispositioned groups, 22 of 63 statements. Zero injection findings. Six finding classes RECORDED, none minted, all homing-owed. One count defect against §28 recorded (Venue/social). §35 minted. No fix evaluated, no gate lifted, no FD minted. Tail unchanged at FD-61. **`worldEvents.js` disposition is NOT complete — 41 statements remain.** |

## What changed in v1.33

- **Five groups dispositioned:** Stories, Distribution, Outfit, Venue/social,
  Financial. 22 statements. Every group's total independently re-derived at
  `2c9ead22` by §28's method.
- **Four of five groups reconcile with §28 exactly.** Venue/social does not —
  §28's arithmetic implies 3 remaining, measurement returns 2. Recorded as an
  open defect at §35.4, not resolved.
- **§28's 61-handler count CONFIRMED** by independent enumeration (§35.1).
- **Zero injection findings across 22 statements.** Every statement is
  parameterized. This is a positive finding and is stated as one.
- **Six finding classes RECORDED, none minted.** Reach is established within
  `worldEvents.js` and nowhere else. Per Cross-Keystone Register §2, a finding
  whose reach is asserted but not established is inadmissible. See §35.5.
- **§35 minted:** the partial disposition record.
- **Deliberately out of scope:** Episode generation (15 statements) and
  Invitations (23) — undispositioned, unopened. Open item 36, carried. XK-1's
  remedy, unevaluated per v1.31 §33.3. The XK-1 population question raised at
  §35.3 — deferred to its own revision.

## §35 — `worldEvents.js` partial disposition

### §35.1 Method and its confirmations

§28's method, unchanged: handler starts by unanchored
`router.(get|post|put|delete|patch|all)\(`; each window bounded by the next
handler's start line minus one; statements counted by
`await (models\.)?sequelize\.query`. No fixed-width windows.

Two of §28's figures were independently re-derived at `2c9ead22`:

| Figure | §28 | This revision | Disposition |
|---|---|---|---|
| `router.*` handlers | 61 | 61 | CONFIRMED |
| Positional EOF | 4005 | 4005 | CONFIRMED |

Line numbers were taken via `Select-String` positional counting. **`Measure-Object
-Line` was not used**, per §28's recorded tooling hazard.

### §35.2 Group dispositions

**Stories — 2 statements, reconciles.**

| Line | Handler | Stmts | Injection | Non-injection findings |
|---|---|---|---|---|
| 3520 | `GET /stories/:storyId` | 1 | CLEAN | `:showId` unused |
| 3538 | `PUT /stories/:storyId` | 1 | CLEAN | `:showId` unused; no `deleted_at` filter, diverging from 3520; empty-body request bumps `updated_at` and returns success |

3538's `UPDATE ... SET ${sets.join(', ')}` is interpolated, but every element of
`sets` is a hardcoded string literal and all values pass through `replacements`.
No request data reaches the SQL text. **Not injectable.**

**Observation, not dispositioned here:** `stories` has no Sequelize model. The
model directory contains no `Story.js`; sixteen `stor*` models exist and none
carries this table. Its soft-delete contract is therefore maintained by hand in
each raw query. **The implication for XK-1's measurement scope is deferred to a
dedicated revision and is not drawn here.**

**Distribution — 3 statements, reconciles.**

| Line | Handler | Stmts | Injection | Non-injection findings |
|---|---|---|---|---|
| 3585 | `GET /episodes/:episodeId/distribution` | 1 | CLEAN | `:showId` unused |
| 3605 | `PUT /episodes/:episodeId/distribution` | 1 | CLEAN | `:showId` unused; no `deleted_at`, diverging from 3585; `JSON.stringify` of an unvalidated body |
| 3638 | `GET /distribution-defaults` | 1 | CLEAN | none |

3638 reads `showId` — it is the record key there. This is the group's internal
control: the parameter is used when it is the target and dropped when it is the
scope.

3605's unvalidated write stores the literal string `"undefined"` on an absent
body; 3585's `JSON.parse` catch then returns `{}`. Failure is silent in both
directions.

**Outfit — 7 statements, reconciles.**

| Line | Handler | Stmts | Injection | Non-injection findings |
|---|---|---|---|---|
| 2675 | `GET .../outfit` | 1 | CLEAN | `showId` destructured, never read; no `deleted_at` on `world_events`; no `QueryTypes.SELECT` |
| 2697 | `PUT .../outfit` | 3 | CLEAN | `showId` drives scoring inputs but scopes neither the event lookup nor the update; `deleted_at` on `wardrobe` only; `SELECT *`; denormalized snapshot with no refresh path |
| 2776 | `GET .../wardrobe-options` | 2 | CLEAN | `showId` scopes `wardrobe`, not `world_events`; same `deleted_at` split |

2697's `IN (:ids)` is safely expanded by Sequelize and guarded against the empty
array by a sentinel UUID.

2697 is the sharpest instance of the scoping class. `showId` reaches
`Show.findByPk`, `detectRepeats`, and `getBrandRelationships` — so an arbitrary
`showId` paired with any `eventId` scores that event against a foreign show's
`required_slots`, repeat history, and brand relationships, and writes the result
to the event. The consequence is functional, not only authorizational.

2776 carries the split inside one handler: `WHERE (show_id = :showId OR show_id
IS NULL)` on `wardrobe`, no scope on `world_events`, eleven lines apart.

**Venue/social — 2 statements measured. DOES NOT RECONCILE. See §35.4.**

| Line | Handler | Stmts | Injection | Non-injection findings |
|---|---|---|---|---|
| 2560 | `POST .../generate-venue` | 1 | CLEAN | **scoped** `AND show_id = :showId`; no `deleted_at`; mutates the loaded row before passing it to the service |
| 2626 | `POST .../generate-social-checklist` | 1 | CLEAN | raw path **scoped**; model fallback `findByPk(eventId)` **unscoped**; two nested bare catches surface genuine errors as 404 |

2626 is the strongest single instance in the pass. The scope check exists at the
primary query and is lost on the fallback path — and the fallback's own comment
names its trigger: *raw SQL first, model may have unmigrated columns*. The path
is reachable precisely on drifted databases.

**Financial — 10 statements, reconciles.** Members are not line-contiguous, per §28.

| Line | Handler | Stmts | Injection | Non-injection findings |
|---|---|---|---|---|
| 2219 | `GET .../affordability` | 2 | CLEAN | `showId` scopes the balance read, not the event lookup; no `deleted_at`; swallowing catch defaults balance to 500 |
| 2252 | `POST .../decline` | 1 | CLEAN | `showId` unused; no `deleted_at` |
| 2278 | `GET /financial-pressure` | 4 | CLEAN | all four scoped and soft-delete filtered; **four independent swallowing catches**; duplicate balance read |
| 2352 | `GET .../financial-forecast` | 2 | CLEAN | both scoped; **fallback preserves the scope check**; catch narrows to SQLSTATE `42703` and rethrows everything else |
| 3730 | `GET /balance` | 1 | CLEAN | scoped; no `deleted_at`; third balance mechanism |

2278 returns `200 OK` when all four queries fail: balance 500, three empty
arrays, a complete and entirely fabricated financial context, with no signal to
the caller. The catch comments — *table may not exist*, *columns may not exist* —
identify production migration drift as the anticipated cause.

2352 is the counter-example. Same anticipated condition, handled by narrowing to
`undefined_column` and rethrowing the rest, with the missing field reconstructed
from present data rather than defaulted. **The correct pattern exists in this
file, seventy lines from the incorrect one.** It also names `is_free` as a column
that may be absent in production — a concrete instance of drift, not a
hypothetical.

### §35.3 The `showId` census

The per-handler pass established the scoping gap by sample. A single probe over
all `LIMIT 1` sites establishes it by census.

| | Count |
|---|---|
| `world_events` lookups scoped `AND show_id = :showId` | 13 |
| `world_events` lookups by `id` alone | 11 |

Scoped: 1702, 1897, 1916, 2364, 2373, 2569, 2637, 2886, 3052, 3169, 3260, 3417, 3765.
Unscoped: 493, 1103, 1207, 1424, 1527, 1665, 2226, 2259, 2681, 2709, 2783.

Full probe output at Appendix A.

**This is a near-even split on one table in one file.** It is not a scattering of
omissions around a convention; there is no convention. Eleven of these sites are
reachable across shows by an authenticated caller.

The census also shows `deleted_at` present on `assets`, `episodes`, `stories`,
and `shows` queries and absent from nearly every `world_events` query — 3765 and
3857 excepted.

### §35.4 Venue/social — count defect against §28

§28 records Venue/social at 5 statements, "less the 2 already dispositioned",
implying 3 remain. Measurement at `2c9ead22` returns **2**: one at 2560, one at
2626.

Neither handler appears on §28's eleven-member no-SQL list. No third
Venue/social handler was identified by route path in the 61-handler enumeration.

**Not resolved here.** Resolution requires re-deriving §28's group membership,
which is its own pass. Recorded so that no downstream document reads
Venue/social as closed at 3.

**Every other group reconciles**, so this is a localized defect and not evidence
against §28's method.

### §35.5 Findings recorded, none minted

Six classes. Each has multiple instances **within `worldEvents.js`** and no
established reach beyond it. Cross-Keystone Register §2 excludes findings whose
reach is asserted but not established, and one file is not establishment.

| # | Class | Instances | Homing status |
|---|---|---|---|
| 1 | Scope parameter as filter, not authorization boundary | 11 unscoped of 24 census sites; in-handler splits at 2697, 2776, 2219; bypass on fallback at 2626 | **OWED.** Not F-Stats-1. Not F-AUTH-1 as scoped — every handler declares `requireAuth` and passes every CP12 grep. |
| 2 | Soft-delete filter maintained by hand in raw queries | 7+ instances, 3 tables, in-handler split at 2697 | OWED. Mechanism differs from XK-1: the column exists and the query omits it. |
| 3 | Swallowing catch producing a fabricated result | 4 at 2278; 1 at 2219; counter-example at 2352 | OWED. |
| 4 | Parallel balance readers, none authoritative | 3 mechanisms: 2219, 2278, 3730 | OWED. Money path; adjacent to open item 6's carved assertions. |
| 5 | Denormalized JSON snapshot with no refresh path | `outfit_pieces` at 2697 | OWED. Same shape as the `canonical_description` copies already on the register. |
| 6 | Model-acquisition idiom drift | 3 idioms across 22 statements | Observation. Low severity. |

**No PE, FD, or XK number is minted for any of these.** Establishing reach
requires a probe across route files, which is not attempted here.

### §35.6 `character_key` — cross-reference, not a finding

`worldEvents.js` contains both halves of the `character_key` split:

| Line | Content |
|---|---|
| 777 | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1` |
| 3833 | comment: *character_key is 'justawoman' (matches episodeCompletionService:176)* |
| 3839 | `WHERE show_id = :showId AND character_key = 'justawoman'` |

Same file, same table, two keys, with an in-file comment acknowledging the
divergence. **This is F-Sec-3's surface.** Recorded here as a line-level
cross-reference because the lines were established during this pass. F-Stats-1
takes no disposition on it.

Both sites lie outside the five dispositioned groups — 777 in Episode
generation, 3839 in a handler past `next-suggestions`.

### §35.7 What this revision does not do

- **Does not complete `worldEvents.js` disposition.** 41 statements remain:
  Episode generation (15), Invitations (23), plus Venue/social's unreconciled
  remainder.
- Does not open Episode generation or Invitations.
- Does not mint any finding at §35.5, or assert reach beyond this file.
- Does not draw the XK-1 population conclusion raised by the Stories
  observation. That is deferred to its own revision.
- Does not resolve §35.4's count defect or re-derive §28's group membership.
- Does not evaluate XK-1's remedy, or touch F-Ward-1 or F-Ward-3.
- Does not close open item 36.
- Does not disturb open item 6's v1.31 carve-out.
- Does not mint an FD, PE, or XK number.
- Does not enumerate prod. Prod remains FROZEN.
- **No live database contact.** Source- and register-derived entirely, via
  `git show origin/main:` at `2c9ead22`.

## Appendix A — `LIMIT 1` census, full probe output

Probe: `git show origin/main:src/routes/worldEvents.js` read into a variable,
then `Select-String -Pattern 'LIMIT\s*1'`, line numbers positional. Run at
`2c9ead22`.
```
493  'SELECT canon_consequences FROM world_events WHERE id = :eventId LIMIT 1'
704  LIMIT 1
777  `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`
1081  'SELECT canon_consequences FROM world_events WHERE id = :eventId LIMIT 1'
1103  'SELECT * FROM world_events WHERE id = :eventId LIMIT 1'
1110  `SELECT s3_url_raw FROM assets WHERE metadata->>'event_id' = :eventId AND asset_type = 'INVITATION_LETTER' ORDER BY created_at DESC LIMIT 1`
1175  WHERE e.id = :eventId LIMIT 1
1207  'SELECT used_in_episode_id FROM world_events WHERE id = :eventId LIMIT 1'
1424  'SELECT invitation_asset_id FROM world_events WHERE id = :eventId LIMIT 1'
1432  'SELECT s3_url_processed FROM assets WHERE id = :id AND deleted_at IS NULL LIMIT 1'
1521  'SELECT * FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1'
1527  'SELECT * FROM world_events WHERE id = :eventId LIMIT 1'
1634  'SELECT s3_url_processed, s3_url_raw FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1'
1665  'SELECT invitation_asset_id FROM world_events WHERE id = :eventId LIMIT 1'
1702  'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
1897  'SELECT id, used_in_episode_id FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
1916  'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
2226  'SELECT * FROM world_events WHERE id = :eventId LIMIT 1'
2235  `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`
2259  'SELECT * FROM world_events WHERE id = :eventId LIMIT 1'
2287  `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`
2321  `SELECT total_income, total_expenses, title FROM episodes WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`
2364  FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1
2373  FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1
2569  'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
2637  'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
2681  'SELECT outfit_pieces, outfit_score, name, prestige, event_type, host_brand, dress_code FROM world_events WHERE id = :eventId LIMIT 1'
2709  'SELECT * FROM world_events WHERE id = :eventId LIMIT 1'
2783  'SELECT * FROM world_events WHERE id = :eventId LIMIT 1'
2886  'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
2942  'SELECT platform, content_category, archetype FROM social_profiles WHERE id = :id LIMIT 1'
3052  'SELECT id, used_in_episode_id, canon_consequences FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
3059  'SELECT id, asset_role, s3_url_processed, metadata FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1'
3105  'SELECT id FROM episode_todo_lists WHERE episode_id = :episodeId LIMIT 1'
3169  'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
3247  ORDER BY created_at DESC LIMIT 1
3260  'SELECT canon_consequences FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
3324  `SELECT id, title, episode_number FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`
3348  `SELECT name, prestige, host_brand FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`
3417  'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1'
3526  'SELECT * FROM stories WHERE id = :storyId AND deleted_at IS NULL LIMIT 1'
3591  `SELECT distribution_metadata FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`
3644  `SELECT distribution_defaults FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1'
3743  `SELECT * FROM world_events WHERE show_id = :showId AND status = 'ready' ORDER BY created_at LIMIT 1`
3765  'SELECT id, name, used_in_episode_id FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1'
3840  LIMIT 1
3857  WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL LIMIT 1
```

Five sites (704, 1175, 3247, 3840, 3857) are continuation lines of multi-line
queries and are not independently classifiable from this probe.

## §11 Plan Version History (UPDATED)

Rows v1.0 through v1.32 carry forward from v1.32 unchanged. Appended:

| v1.33 | 2026-08-10 | `2c9ead22` | PARTIAL disposition of `worldEvents.js`: five of seven groups, 22 of 63 statements, zero injection findings. §28's 61-handler count and 4005 EOF confirmed. Four groups reconcile with §28; Venue/social does not — count defect recorded at §35.4. Six finding classes recorded, none minted, all homing-owed. `character_key` split cross-referenced to F-Sec-3 at §35.6. §35 minted. No FD. |

v1.33 supersedes nothing. It is additive on v1.32. All prior forward direction
stands unchanged.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.32. Tail: **FD-61**.
- Mints: **§35**.
- Closes: nothing.
- Records: five group dispositions; six finding classes, none minted; one count
  defect against §28.
- Carries: **open item 36**, unchanged.
- Defers: the XK-1 population question raised by §35.2's Stories observation, to
a dedicated revision.
- **Numeral disambiguation:** per v1.31 and v1.32, *open item 40 (F-Stats-1)*
  and *open item 23 (F-Stats-1)* are unrelated to *FD-40 (F-Deploy-1)* and to
  §23.1 respectively. First reference in any document carries the origin label
  in full.
- Changes no unit disposition outside the five groups, no PR state, no gate.
- Additive-supersede on v1.32; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).
- **No live database contact.**

## Forward Statement

v1.33 is the plan-of-record.

**`worldEvents.js` disposition is PARTIAL.** Five groups closed, 22 of 63
statements. **41 remain**: Episode generation (15), Invitations (23), and
Venue/social's unreconciled remainder. No downstream document may read this file
as dispositioned.

**Zero injection findings in 22 statements.** Every statement parameterized,
including the dynamic `SET` at 3538 and the `IN (:ids)` at 2697.

**Six finding classes are recorded and none is minted.** Their reach is
established within one file. Establishing it further requires a route-file-wide
probe, which is the natural next step and is not taken here.

**The §35.4 count defect stands open** against §28's Venue/social total.

**The XK-1 population question is deferred** to a dedicated revision.

**Open item 6 is CLOSED with carve-out** per v1.31 §33.2. **XK-1 is owned and
unremedied.** **One workstation hazard remains live** per v1.29: §31's boot-path
inline DDL makes `npm start` and `npm run dev` unsafe pending PE #62.

After F-Stats-1 closes: **F-Ward-1 next**, under XK-1's recorded
reciprocal-reference obligation. F-Ward-3 inherits `outfit_sets` /
`outfit_set_items` under the same obligation.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-10. Main at `2c9ead22`. Predecessor: v1.32.*
*Minted: §35. Recorded: five group dispositions, six unminted finding classes, one §28 count defect. Deferred: XK-1 population question. Carried: open item 36. Mints no FD. Tail: FD-61. [skip-automerge]*
