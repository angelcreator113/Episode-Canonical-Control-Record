# F-Stats-1 Fix Plan v1.43
*Additive-supersede on v1.42. Mints §46. Closes open items 41 and 23.*

## What changed in v1.43

**§35.2's 23 statements are re-passed for convertibility — 17 convert / 6
withdraw.** v1.33 dispositioned five groups for injection and recorded findings,
but ruled convertibility nowhere. Those verdicts now exist.

**`worldEvents.js` is 112 of 112 dispositioned in BOTH senses.** Every statement
carries an injection verdict and a convert/withdraw verdict. **59 convert / 53
withdraw** file-wide.

**§44.8 is no longer load-bearing, and is not ruled.** It asked which sense of
"dispositioned" open item 41's closure condition requires. **Both readings are now
satisfied**, so the question does not need answering for this file. Recorded as
moot-for-`worldEvents.js`, still unruled, still unowned — see §46.5.

**Open item 41 (F-Stats-1) is CLOSED.** Its closure condition — all 112
dispositioned, denominator per v1.36 — is met under either reading.

**Open item 23 (F-Stats-1) is CLOSED.** Restored at v1.40 and re-anchored to the
same remainder at §43.5; that remainder is 0. **This moots v1.40 §43.6's
item-23-versus-item-41 overlap question rather than ruling it** — both close, so
redundancy is no longer a live concern.

**Two verdicts from this session's working notes are RETRACTED and corrected** —
2234 and 2286, ruled Convert before their target table was checked for a model.
It has none. Both are **WITHDRAW**. See §46.4.

**`character_state_history` has no Sequelize model** — the file's second modelless
table after `stories`, and it is on the money path.

**Every one of §35.2's six withdrawals is a schema or model prerequisite, not an
expressibility limit** — §46.3. A withdrawal class distinct from §16's and §44's.

**F-Stats-1 does not close.** This revision completes `worldEvents.js` and assesses
nothing else.

---

## §46 — §35.2's 23 statements, convertibility re-passed

### §46.1 Basis and method

Basis `3dae11fe` (v1.42, #1015). Source-derived via
`git show origin/main:src/routes/worldEvents.js`, with model existence checked by
`git ls-tree` and `git grep` against `src/models/`.

§28's method, unchanged. Every one of §35.2's five group bands was read at source
rather than inferred from §35.2's findings columns. **That distinction matters
here:** §35.2's findings were written to record safety, and while several happen
to name convertibility-relevant facts (`SELECT *`, `IN (:ids)`, the denormalized
snapshot), they are not a convertibility record and were not treated as one.

**Model existence was checked, not assumed.** §35.2's Stories observation — that
`stories` has no model — established that a table appearing in raw SQL implies
nothing about ORM reachability. Every target table in this pass was checked.

### §46.2 Verdicts

**Stories — 2 statements**

| Line | Statement | C/W | Basis |
|---|---|---|---|
| 3525 | `SELECT * FROM stories WHERE id AND deleted_at IS NULL LIMIT 1` | **WITHDRAW** | **`stories` has no model.** No `Story.js`; sixteen `stor*` models, none carries this table |
| 3551 | `UPDATE stories SET ${sets.join(', ')} WHERE id` | **WITHDRAW** | Same modelless basis; dynamic `SET` assembled at runtime |

3551's dynamic `SET` would be withdrawable on §16.1's Decision #23 precedent
independently. The modelless basis reaches it first.

**Distribution — 3 statements**

| Line | Statement | C/W | Basis |
|---|---|---|---|
| 3590 | `SELECT distribution_metadata FROM episodes WHERE id AND deleted_at IS NULL LIMIT 1` | **Convert** | Single column; `Episode.js` confirmed |
| 3611 | `UPDATE episodes SET distribution_metadata = :metadata, updated_at WHERE id` | **Convert** | Single scalar column; `JSON.stringify` into a replacement |
| 3643 | `SELECT distribution_defaults FROM shows WHERE id AND deleted_at IS NULL LIMIT 1` | **Convert** | Single column; `Show.js` confirmed |

The cleanest group in the file. 3564 and 3623 carry zero statements, delegating to
`distributionService` — consistent with the census.

**Venue/social — 2 statements**

| Line | Statement | C/W | Basis |
|---|---|---|---|
| 2568 | `SELECT * FROM world_events WHERE id AND show_id LIMIT 1` | **Convert** — `.unscoped()` | Scoped; `SELECT *` on drifted table |
| 2636 | `SELECT * FROM world_events WHERE id AND show_id LIMIT 1` | **Convert** — `.unscoped()` | Byte-identical to 2568 |

Same shape as 1701 and 1915, both ruled Convert at §44.3. §35.2's characterisation
of 2626 as the strongest scoping instance is confirmed at source: the raw path
**is** scoped and the model fallback is not. **A conversion must preserve scope on
both branches.**

**Outfit — 6 statements**

| Line | Statement | C/W | Basis |
|---|---|---|---|
| 2680 | `SELECT outfit_pieces, outfit_score, name, prestige, event_type, host_brand, dress_code FROM world_events WHERE id LIMIT 1` | **Convert** | Explicit 7-column projection |
| 2708 | `SELECT * FROM world_events WHERE id LIMIT 1` | **Convert** — `.unscoped()` | `SELECT *` |
| 2716 | `SELECT ...18 columns FROM wardrobe WHERE id IN (:ids) AND deleted_at IS NULL` | **Convert** | `IN (:ids)` safely expanded per §35.2; sentinel-UUID guard on empty array |
| 2763 | `UPDATE world_events SET outfit_pieces = :pieces, outfit_score = :score, updated_at WHERE id` | **Convert** | Two whole JSONB columns via replacements — **not** a partial-path update |
| 2782 | `SELECT * FROM world_events WHERE id LIMIT 1` | **Convert** — `.unscoped()` | Byte-identical to 2708 |
| 2790 | `SELECT ...18 columns FROM wardrobe WHERE (show_id = :showId OR show_id IS NULL) AND deleted_at IS NULL ORDER BY tier DESC, name ASC` | **Convert** | `Op.or`; **static** ORDER BY, unlike §16.1's dynamic-ORDER-BY withdrawal |

**2763 does not withdraw on the denormalized-snapshot finding.** §35.2's class-5
instance is a data-modelling defect — pieces copied into `world_events`, never
refreshed when `wardrobe` changes. It is not a convertibility blocker:
`Model.update()` expresses two whole-column JSONB writes directly. **Contrast
1149**, which withdrew because `jsonb_set` addresses a path *inside* a column.

**Financial — 10 statements**

| Line | Statement | C/W | Basis |
|---|---|---|---|
| 2225 | `SELECT * FROM world_events WHERE id LIMIT 1` | **Convert** — `.unscoped()` | `SELECT *` |
| 2234 | `SELECT state_json FROM character_state_history WHERE show_id ORDER BY created_at DESC LIMIT 1` | **WITHDRAW** | **`character_state_history` has no model** |
| 2258 | `SELECT * FROM world_events WHERE id LIMIT 1` | **Convert** — `.unscoped()` | Byte-identical to 2225 |
| 2286 | `SELECT state_json FROM character_state_history WHERE show_id ORDER BY created_at DESC LIMIT 1` | **WITHDRAW** | Byte-identical to 2234; same modelless basis |
| 2297 | `SELECT name, canon_consequences FROM world_events WHERE show_id AND status='declined' AND deleted_at IS NULL` | **Convert** | Explicit projection, scoped, soft-delete filtered |
| 2310 | `SELECT name, status, payment_amount FROM opportunities WHERE show_id AND deleted_at IS NULL AND status IN (...)` | **Convert** | `Op.in` with literal array; **`Opportunity.js` confirmed** |
| 2320 | `SELECT total_income, total_expenses, title FROM episodes WHERE show_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10` | **Convert** | Explicit projection, scoped, static ORDER BY + LIMIT |
| 2361 | `SELECT ...12 columns incl. is_free FROM world_events WHERE id AND show_id LIMIT 1` | **WITHDRAW** | Tier 1 of a **column-existence-conditional pair** |
| 2370 | Same minus `is_free`, reconstructed in JS from `is_paid === 'free'` | **WITHDRAW** | Tier 2; the pair exists because the column set is unknown |
| 3742 | `SELECT * FROM world_events WHERE show_id AND status='ready' ORDER BY created_at LIMIT 1` | **Convert** — `.unscoped()` | Scoped, static ORDER BY + LIMIT |

**2361/2370 withdraw for the opposite reason to 1149.** §35.2 correctly named 2352
the counter-example: it narrows to SQLSTATE `42703`, rethrows everything else, and
reconstructs the missing field from present data. **Correct error handling does not
make it convertible.** A Sequelize model declares its attributes statically;
converting means choosing one column set, which is the choice this code exists to
avoid. **The prerequisite is schema convergence, not an ORM call.**

### §46.3 Every §35.2 withdrawal is a prerequisite, not a limit

| Lines | Basis | Kind |
|---|---|---|
| 3525, 3551 | `stories` has no model | Model prerequisite |
| 2234, 2286 | `character_state_history` has no model | Model prerequisite |
| 2361, 2370 | Column set unknown at runtime | Schema prerequisite |

**None is an expressibility limit.** §16 and §44 withdrew statements Sequelize
*cannot express* — JOINs, aliased projections, jsonb-operator predicates,
`jsonb_set` partial paths, partial-index upserts, dynamic ORDER BY. **Every
withdrawal in this pass says something different: the ORM cannot reach the table
because the model or the column set does not exist yet.**

That is a distinct withdrawal class, and it is **F-Ward-1's kind of work sitting
inside F-Stats-1's surface**. Recorded; no ownership claimed and no reach
asserted beyond this file.

**Two modelless tables**: `stories` and `character_state_history`. Both carry
canon. Both are Pattern 42 — raw-SQL-as-canon, the same shape as `character_state`
recorded at F-Ward-1. `character_state_history` is on the money path.

**Finding class 4 is sharpened.** §35.2 recorded *"parallel balance readers, none
authoritative"* across 2219, 2278, 3730. At source: 2234 and 2286 are
byte-identical reads of a **modelless** table, and 3730's balance does not come
from a statement at all — it is `getCurrentBalance(models.sequelize, showId)` in
`financialTransactionService`. **The third mechanism is outside this file.** Cross-
file reach, recorded, unminted.

### §46.4 Retraction — 2234 and 2286

Both were ruled **Convert** in this session's working notes on statement shape
alone — single column, scoped, static ORDER BY, `LIMIT 1`. The verdict was reached
**before the target table was checked for a model.** It has none.

**Both are WITHDRAW.** The Convert verdicts are retracted; neither reached the
register.

The check that caught it is the one §35.2's Stories observation exists to force: a
table in raw SQL implies nothing about ORM reachability. **Statement shape is
necessary and not sufficient for a Convert verdict; model existence is the other
half**, and it is invisible in the statement.

This joins the accumulated method-hazard set alongside §28's window and
`Measure-Object` hazards, §36.4's probe hazard, §39.5's prose-population hazard,
§40.6's fit-to-authority hazard, §41.5's four, §42.6's table-beats-prose hazard,
§43.7's null-control hazard, and §45.6's carve-out-omission hazard.

### §46.5 §44.8 — satisfied on both readings, not ruled

§44.8 asked what constitutes disposition, and v1.42 §45.5 recorded that open item
41's figure was **0 or 23** depending on the answer.

**It is 0 under both readings.** This revision supplies the convertibility
verdicts the second reading required, so the ambiguity no longer has a
consequence for `worldEvents.js`.

**The question is NOT ruled.** No ownership is claimed and the register is not
told which sense governs. It remains open for any future file, where the cheaper
resolution may not be available.

**Recorded as a method note.** When a definitional ambiguity blocks a figure,
**satisfying both readings can be cheaper than resolving the definition** — here,
six source reads against a scoping decision about what the keystone is for. That
is not always the right trade, and it is not offered as a general rule. It was the
right one at this size.

### §46.6 Final accounting

| Group | Stmts | Convert | Withdraw | Withdrawal |
|---|---|---|---|---|
| Core CRUD | 21 | 5 | 16 | 76% |
| Episode generation | 15 | 7 | 8 | 53% |
| Invitations | 23 | 12 | 11 | 48% |
| Overlays | 26 | 14 | 12 | 46% |
| Financial | 10 | 6 | 4 | 40% |
| Stories | 2 | 0 | 2 | 100% |
| Distribution | 3 | 3 | 0 | 0% |
| Outfit | 7 | 7 | 0 | 0% |
| Venue/social | 5 | 5 | 0 | 0% |
| **Total** | **112** | **59** | **53** | **47%** |

**Both orphans are Convert**, so §39.4 defect 1 remains label-only: Outfit is
7/0 and Venue/social 5/0 under either assignment. **Defect 1 affects no figure in
this table.**

**Outstanding: 0, in both senses.**

### §46.7 Closures

**Open item 41 (F-Stats-1) — CLOSED.** Minted to make an undispositioned surface
visible to the register. Closure condition: all 112 dispositioned, denominator per
v1.36. Met under either reading of §44.8. Figure history: 41 (inherited,
v1.33–v1.37) → 45 (v1.38) → 43 (v1.39) → 5 (v1.41) → 0 or 23 (v1.42) → **0**.

**Open item 23 (F-Stats-1) — CLOSED.** Minted at v1.14, ruled never-minted at
v1.32, restored at v1.40, substance re-anchored at §43.5 to the same remainder.
That remainder is 0. Its closing instruction — *"Re-derive live; the group totals
in §16 are the basis, not the dispositions"* — was correct throughout: §16's
totals held across five re-derivations, and the dispositions were what moved.

**v1.40 §43.6's overlap question is MOOTED, not ruled.** It asked whether item 23
and item 41 track the same substance and whether one is redundant. Both closure
conditions are met, so both close and the redundancy question has no consequence.
**Had either remained open, the question would still be owed.**

---

## What this revision does not do

- **Does not close F-Stats-1.** `worldEvents.js` is complete; the keystone is not
  assessed and other open items are carried unchanged.
- Does not rule §44.8. It is satisfied on both readings for this file and remains
  open for any other.
- Does not resolve §39.4 defect 1. Both orphans are Convert; the labels remain
  undetermined and affect no figure.
- Does not resolve §39.4 defect 3 (site 570), still unruled.
- Does not close open item 22, 24, or 6.
- Does not mint any finding class, or assert reach beyond `worldEvents.js` —
  including the `financialTransactionService` balance mechanism recorded at §46.3.
- Does not evaluate or apply any conversion. **A `Convert` verdict is a
  convertibility ruling, not a fix. 59 statements are ruled convertible; none is
  converted.**
- Does not create a model for `stories` or `character_state_history`, or assign
  ownership for doing so.
- Does not disturb §16.1, §16.2, §35.2, §44 or §45's dispositions. §35.2's
  injection verdicts and findings stand unaltered; this revision adds a column it
  did not carry.
- Does not disposition the `character_key` split at §35.6 / §12.35. F-Sec-3's
  surface, queued last in sequence.
- Does not draw the XK-1 population conclusion, though the two modelless tables
  bear on its scope.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN and this revision confers no
  authority to touch it.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.43 | 2026-08-13 | **§35.2's 23 statements re-passed for convertibility — 17 convert / 6 withdraw.** `worldEvents.js` is now **112 of 112 dispositioned in BOTH senses**, 59 convert / 53 withdraw file-wide (47% withdrawal). **Open item 41 CLOSED** — closure condition met under either reading of §44.8; figure history 41 → 45 → 43 → 5 → 0-or-23 → **0**. **Open item 23 CLOSED** — restored at v1.40, re-anchored at §43.5 to the same remainder, which is 0. **v1.40 §43.6's overlap question MOOTED, not ruled.** **§44.8 satisfied on both readings, NOT ruled** — it remains open for any future file (§46.5). **2234 and 2286 RETRACTED from Convert to WITHDRAW** (§46.4): ruled on statement shape before the target table was checked for a model, and **`character_state_history` has none** — the file's second modelless table after `stories`, and it is on the money path. **Every §35.2 withdrawal is a schema or model prerequisite, not an expressibility limit** (§46.3) — a class distinct from §16's and §44's JOINs, jsonb operators, `jsonb_set` paths and dynamic ORDER BY; F-Ward-1's kind of work inside F-Stats-1's surface. Finding class 4 sharpened: two byte-identical modelless balance reads plus a third mechanism in `financialTransactionService`, outside this file. 2763 does NOT withdraw on the denormalized-snapshot finding — whole-column JSONB writes convert; only partial-path updates like 1149 do not. Both defect-1 orphans are Convert, so defect 1 affects no figure. **F-Stats-1 does not close.** Mints no FD. No live DB contact. Prod FROZEN, untouched. §46 minted. Basis `3dae11fe`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.42. Tail: **FD-61**.
- Mints: **§46**.
- **Closes: open item 41 (F-Stats-1); open item 23 (F-Stats-1).**
- Dispositions: **§35.2's 23 statements for convertibility** — 17 convert / 6
  withdraw. Their injection verdicts are unaltered.
- Retracts: **2234 and 2286's Convert verdicts**, corrected to WITHDRAW (§46.4).
  Neither reached the register.
- Moots: **v1.40 §43.6's item-23-versus-item-41 overlap question**, not ruled.
- Records: `character_state_history` as **modelless** (Pattern 42, second instance
  in this file); the prerequisite-versus-limit withdrawal distinction (§46.3);
  finding class 4's cross-file third mechanism; §46.4's method hazard.
- Carries: open item 22 (unassigned); open item 24 (open); open item 6 (v1.31
  carve-out stands); all other items carried from v1.42.
- Defers: §39.4 defect 1 (open, label-only, affects no figure); §39.4 defect 3
  (unruled); §44.8 (satisfied here, unruled generally); XK-1's remedy; the XK-1
  population question.
- Forward-points: the two modelless tables, to whichever keystone owns model
  creation. Recorded, not adopted, no reach asserted.
- Changes no PR state, no gate. Unit 19's withdrawal stands.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.42; no destructive rewrite.
- **Numeral disambiguation:** *open items 23 and 41 (F-Stats-1)*, closed here, are
  unrelated to FD-23 / FD-41 (F-Deploy-1) and to §23.1 / §41. §46 is minted in
  v1.43; section numbers and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

`worldEvents.js` entered the register at v1.14 as 144 statements, was corrected to
112 in the same revision, and has now been dispositioned in full: **112 of 112,
in both senses, 59 convert and 53 withdraw.**

**Zero injection findings across all 112.** Every statement parameterized —
including three JSONB paths, two `IN (:ids)` expansions, a `jsonb_set` with an
explicit cast, and a dynamic `SET` built from hardcoded literals. **The exposure in
this file is not injection.**

**Forty-seven percent of it cannot be converted**, and the reasons divide cleanly.
Most are expressibility: JOINs, aliased projections, jsonb-operator predicates,
partial-index upserts. **Six are not** — they are statements whose tables have no
model, or whose column set is unknown at runtime. Those six do not need a better
ORM call. They need a schema.

Where the file is exposed is authorization and delete discipline: 25 of 38
statements in the two largest groups carrying no scope term, three handlers whose
route scope parameters are decorative, five hand-rolled `deleted_at` writes against
paranoid models, three hard `DELETE`s on a soft-deleted table, and drift ladders
that degrade a write and report success. **Six finding classes remain unminted and
homing-owed.** Their reach is established within one file and nowhere else, and
Cross-Keystone Register §2 continues to exclude them on that basis. **That homing
decision is now the largest thing this surface is waiting on.**

**Open items 41 and 23 are closed.** F-Stats-1 is not. What this revision closes
is one file — the one §16 called the largest remaining F-Stats-1 work, and the one
that has occupied the register since v1.14.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `3dae11fe` (#1015). Predecessor: v1.42.*
*Minted: §46. Dispositioned: §35.2's 23 statements for convertibility. Closed: open items 41 and 23. Retracted: 2234, 2286 Convert → WITHDRAW. Mints no FD. Tail: FD-61. [skip-automerge]*
