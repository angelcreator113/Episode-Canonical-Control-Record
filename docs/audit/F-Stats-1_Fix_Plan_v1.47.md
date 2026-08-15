# F-Stats-1 Fix Plan v1.47
*Additive-supersede on v1.46. Mints §50. Measures XK-2's SQL-side extent. Mints no finding.*

## What changed in v1.47

**XK-2's extent is measured on the SQL-visible surface.** 201 statements across
12 route files. **14 confirmed instances in 5 files, spanning 3 keystones** —
F-Stats-1, F-AUTH-1 (CP7), and F-Ward-1.

**XK-2's Reach is extended from 2 keystones to 3.** `wardrobe.js` is F-Ward-1's
surface and carries three instances.

**The distribution is uneven, and that is the result.** `uiOverlayRoutes.js`
scopes **all 29** of its statements correctly, including two dynamic-`SET`
updates. XK-2 is not universal; some surfaces enforce row scope properly.

**The measured denominator is wrong, and §50.4 says why.** Three instances have a
**Sequelize-scoped read and a raw-SQL unscoped write**. No SQL-text probe can see
the scoped half, and **ten `:showId` route files are ORM-only and unmeasured.**
XK-2 is not a raw-SQL finding.

**One sub-form's wording needs widening; one adjacent shape is held separate** —
§50.5. Neither is minted here.

**An F-Sec-3 instance is reported** — `wardrobe.js:1233` hardcodes
`character_key: 'lala'` on the coin-debit path. §50.7.

---

## §50 — XK-2's SQL-side extent

### §50.1 Basis, population, and probe

Basis `2d45b6d1` (#1020). Source-derived via `git show origin/main:` and
`git grep`. No live database contact.

**Population.** 22 route files carry `:showId`. Of the 21 other than
`worldEvents.js`, **11 carry raw SQL and 10 are ORM-only.**

| File | Stmts | | File | Stmts |
|---|---|---|---|---|
| `uiOverlayRoutes.js` | 29 | | `evaluation.js` | 3 |
| `shows.js` | 22 | | `phonePlaythroughRoutes.js` | 3 |
| `wardrobe.js` | 12 | | `careerGoals.js` | 1 |
| `world.js` | 8 | | `phoneAIRoutes.js` | 1 |
| `arcRoutes.js` | 5 | | `phoneMissionRoutes.js` | 1 |
| `opportunityRoutes.js` | 4 | | **Subtotal** | **89** |

Plus `worldEvents.js`'s 112: **201 statements probed.**

**Probe.** `git grep -n -E "WHERE\s+[a-z]*\.?id\s*=\s*:"` — upgraded from XK-2's
original floor to tolerate spacing variance and table aliases.

**Probe validated against a positive control.** Run over `arcRoutes.js`, it
re-found both known instances at :158 and :209. **A probe that cannot re-find
known positives proves nothing by its nulls** — §43.7's discipline, applied
before the results were relied on. It also caught `wardrobe.js:173`'s aliased
`WHERE e.id`, which the original probe could not see.

**Still a floor.** Predicates wrapped across lines mid-`WHERE` will not match.

### §50.2 Results

| File | Stmts | Instances | Keystone |
|---|---|---|---|
| `worldEvents.js` | 112 | **7** | F-Stats-1 |
| `uiOverlayRoutes.js` | 29 | **0 — verified scoped** | — |
| `shows.js` | 22 | **1** | unassigned |
| `wardrobe.js` | 12 | **3** | F-Ward-1 |
| `world.js` | 8 | 0 hits — **not verified** | — |
| `arcRoutes.js` | 5 | **2** | F-AUTH-1 (CP7) |
| `opportunityRoutes.js` | 4 | 0 — verified scoped | — |
| `evaluation.js` | 3 | **1** | F-AUTH-1 (CP7) |
| `phonePlaythroughRoutes.js` | 3 | 0 — verified scoped | — |
| `careerGoals.js` / `phoneAIRoutes.js` / `phoneMissionRoutes.js` | 3 | 0 (1 verified scoped) | — |
| **Total** | **201** | **14 in 5 files** | **3 keystones** |

**"Verified scoped" and "0 hits" are different results and are not merged.**
`uiOverlayRoutes.js` returned twelve by-id predicates and **every one carried
`AND show_id = :showId`** — positive evidence of correct scoping across a
29-statement file, including the dynamic-`SET` updates at :572 and :914 where the
scope is most easily lost. `world.js` returned nothing, which is absence of
evidence, not evidence of absence.

**New instances, this measurement:**

| File | Line | Read | Write |
|---|---|---|---|
| `shows.js` | 832 | `SELECT id, metadata::text FROM assets WHERE show_id = :showId AND ...` (:799) | `UPDATE assets SET metadata = :meta::jsonb WHERE id = :id` |
| `evaluation.js` | 628 | `CharacterState.findAll({ where: { show_id, character_key } })` (:47, via helper) | `UPDATE character_state SET ... WHERE id = :stateId` |
| `wardrobe.js` | 1251 | `CharacterState.findOne({ where: { show_id, character_key: 'lala' } })` (:1232) | `UPDATE character_state SET coins = coins - :cost WHERE id = :id` |
| `wardrobe.js` | 1874 | `Wardrobe.findAll({ where: { show_id: showId, deleted_at: null } })` (:1843) | `UPDATE wardrobe SET event_types = CAST(:types AS jsonb) WHERE id = :id` |
| `wardrobe.js` | 1334 | — | `SELECT * FROM wardrobe WHERE id = :wardrobe_id AND deleted_at IS NULL` |

All satisfy the three tests: the route or body supplies a scope value, the handler
demonstrably holds it, and the target table is show-partitioned.

### §50.3 Reach — three keystones

| Keystone | Surface | Instances |
|---|---|---|
| F-Stats-1 | `worldEvents.js` | 1837, 1910, 1911, 1229, 1271, 1605, 1510 |
| F-AUTH-1 | `arcRoutes.js`, `evaluation.js` (both CP7) | :158, :209, :628 |
| **F-Ward-1** | **`wardrobe.js`** | **:1251, :1334, :1874** |

`shows.js:832` is a confirmed instance whose keystone assignment **was not
determined** and is not asserted.

**XK-2's CKR Reach column reads "F-Stats-1, F-AUTH-1" and is now understated.**
This revision measures; **it does not amend the entry.** CKR §6 requires a Fix
Plan revision to ratify a status change, and widening a Reach column on a
measurement whose own denominator is known wrong (§50.4) would harden a figure
that is still moving. Recorded as owed.

### §50.4 The denominator is wrong, and the finding is not a raw-SQL finding

**Three of the fourteen instances cross the ORM/SQL boundary** — `evaluation.js`
:628, `wardrobe.js` :1251 and :1874. In each, the **scoped read is a Sequelize
call** and the **unscoped write is raw SQL**.

Two consequences:

1. **No SQL-text probe can see the scoped half.** The invariant these writes trust
   is established in ORM code the probe never examines. The probe finds these
   only because their *writes* are raw.
2. **A handler written entirely in the ORM can carry XK-2 identically.** A
   `findByPk(id)` followed by an `update()` on the returned row, with `showId`
   sitting unused, is the same defect with no SQL to grep.

**Ten of the 22 `:showId` route files carry no raw SQL at all** — `editMaps.js`,
`feedEnhancedRoutes.js`, `feedPipelineRoutes.js`, `feedPostRoutes.js`,
`gameShows.js`, `onboarding.js`, `scriptGenerator.js`, `sceneStudioEpisodeRoutes.js`,
`seasonRhythmRoutes.js`, `wardrobeEventRoutes.js`. **They are unmeasured, and
nothing here says they are clean.**

**201 is the SQL-visible portion of the surface, not the surface.** Any statement
of XK-2's extent that cites this number must carry that qualifier.

### §50.5 One sub-form widened, one shape held separate

**`wardrobe.js:1334` — within sub-form 3, whose wording is too narrow.**
`POST /purchase` takes `show_id` **from `req.body`**, validates it present, and
then reads `SELECT * FROM wardrobe WHERE id = :wardrobe_id` without it. The
defect is identical to sub-form 3 ("route scope parameters entirely unread"): a
scope value is held and not applied. **Only the source differs — body rather than
path.** The sub-form's wording says *route* and should say *available scope
value*. **Recorded as a wording defect in XK-2's entry, not amended here.**

**`wardrobe.js:173` — a distinct shape, NOT folded into XK-2.**
`GET /outfit-score/:episodeId` carries **no scope parameter at any layer** — not
in the path, not in the body. Its read joins `episodes` to `world_events` and
returns another show's event context to any authenticated caller holding an
episode UUID.

XK-2's instances all involve a scope value that exists and is dropped. **This is a
route that was never given one.** Whether "never scoped" and "scoped then dropped"
are one finding is a real question, and **answering it by absorption rather than
by ruling would repeat the error v1.45 corrected.** Recorded as a candidate shape,
unowned, unminted, and not counted among the 14.

This is the distinction v1.44 §47.2 drew when it discarded `worldStudio.js`: a
file with no show partition in its addressing cannot omit a scope term. The
difference here is that `wardrobe.js` **does** carry `:showId` on other routes,
so within one file some routes are partitioned and some are not.

### §50.6 Observations recorded, none minted

- **Transactions exist, in three places.** `evaluation.js` (~:620),
  `wardrobe.js` (~:1247 and ~:1869) each wrap multi-write sequences in
  `models.sequelize.transaction`. Two are money-path; one is a bulk update loop.
  **This is the correct pattern and it is worth stating as a positive** —
  `worldEvents.js` carried none across 112 statements. *A prior characterisation
  that transactions appear only on the money path is withdrawn; the third site is
  not.*
- **Atomicity is not authorization.** `wardrobe.js:1874`'s loop is atomic and
  unscoped. A transaction around the wrong rows still writes the wrong rows.
- **`evaluation.js:45`'s helper swallows read failures** —
  `.catch(() => [])` falls through to auto-seeding a fresh `character_state` row.
  A transient error silently creates state rather than finding it, on the Edit
  Stats path with a ledger mirror downstream. Class 3.
- **`shows.js:799` filters JSONB by text pattern** —
  `metadata::text LIKE '%"is_home": true%'`. Fragile against key ordering and
  whitespace; a convertibility withdraw basis.
- **Convertibility withdraw bases observed outside `worldEvents.js`**:
  `shows.js:832` (`::jsonb` cast), `wardrobe.js:1874` (`CAST(... AS jsonb)`, with
  a comment naming Sequelize's JSONB serialisation as the reason),
  `wardrobe.js:173` (LEFT JOIN + aliased projection). **No file other than
  `worldEvents.js` is dispositioned and none is dispositioned here.**
- **`character_state_history` is written at `evaluation.js` ~:631.** It remains
  the modelless table recorded at v1.43 §46.3, on the money path.

### §50.7 F-Sec-3 instance report

**`wardrobe.js:1233` hardcodes `character_key: 'lala'`** in the
`CharacterState.findOne` that gates the inline coin purchase. The balance check
and the debit at :1251 both operate on the `'lala'` row.

`evaluation.js` ~:601 states the counterpart in-band:

> *"The 'key === lala' gate was also dropped: 'justawoman' is the canonical key
> writers actually use, so the old check meant no ledger mirror ever fired for the
> real character."*

**Wardrobe purchases debit the row that episode-completion does not credit.** That
is the `character_key` drift P0, on a money path, with a live line number.

**F-Sec-3 owns this and it is queued last in the locked sequence.** Reported for
whoever executes it; **not minted, not assigned, and F-Sec-3's scope is not
assessed.** No remedy is proposed and none is implied.

---

## What this revision does not do

- **Does not amend XK-2's Cross-Keystone Register entry.** Its Reach column,
  sub-form wording, and extent statement are all recorded as owed at §50.3 and
  §50.5 and are unchanged on the register.
- Does not mint any finding class, FD, PE, or XK number.
- Does not fold `wardrobe.js:173` into XK-2, or rule on whether "never scoped"
  and "scoped then dropped" are one finding.
- Does not measure the ORM-only surface. **Ten `:showId` files are unexamined and
  are not asserted clean.**
- Does not verify `world.js`, `careerGoals.js`, or `phoneMissionRoutes.js`;
  their nulls are absence of evidence.
- Does not disposition any statement in any file. **No file other than
  `worldEvents.js` is dispositioned, and this revision dispositions nothing.**
- Does not determine `shows.js`'s keystone assignment.
- Does not assess or reopen F-AUTH-1, F-Ward-1, or F-Sec-3. Their surfaces are
  cited; their scopes, tracks and gates are untouched.
- Does not propose or evaluate a remedy for XK-2 or for the `character_key`
  drift. **XK-2's fix remains UNEVALUATED per CKR §5.**
- Does not establish reach for §35.5's classes 2–6.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.47 | 2026-08-15 | **XK-2's SQL-side extent measured — 201 statements across 12 route files, 14 confirmed instances in 5 files, 3 keystones.** New instances: `shows.js:832`, `evaluation.js:628`, `wardrobe.js` :1251/:1334/:1874. **Reach extends to F-Ward-1** via `wardrobe.js`; `evaluation.js` joins `arcRoutes.js` under F-AUTH-1's CP7; `shows.js`'s keystone assignment not determined. **The distribution is uneven and that is the result** — `uiOverlayRoutes.js` scopes all 29 statements correctly including two dynamic-`SET` updates. **"Verified scoped" and "0 hits" are recorded as different results**; `world.js`'s null is absence of evidence. **Probe validated against a positive control** (re-found both known `arcRoutes.js` instances) per §43.7's discipline, and upgraded to catch aliased predicates — it found `wardrobe.js:173`'s `WHERE e.id`, invisible to XK-2's original floor probe. **§50.4: the denominator is wrong and XK-2 is not a raw-SQL finding.** Three instances have a Sequelize-scoped read and a raw-SQL unscoped write, so no SQL-text probe sees the scoped half; an all-ORM handler carries the defect identically; **ten `:showId` files are ORM-only and unmeasured, and are not asserted clean.** **§50.5: sub-form 3's wording is too narrow** — `wardrobe.js:1334` takes `show_id` from `req.body`, validates it, and drops it, so the wording should read *available scope value* not *route scope parameter*. **`wardrobe.js:173` is held SEPARATE and not counted** — `GET /outfit-score/:episodeId` carries no scope parameter at any layer; folding "never scoped" into "scoped then dropped" by absorption rather than ruling would repeat the error v1.45 corrected. **XK-2's CKR entry is NOT amended**; Reach, sub-form wording and extent are recorded as owed. **§50.7 F-Sec-3 instance report:** `wardrobe.js:1233` hardcodes `character_key: 'lala'` on the coin-debit path while `evaluation.js` ~:601 records `'justawoman'` as canonical — wardrobe purchases debit the row episode-completion does not credit. Three transaction sites recorded as a positive; a prior "money-path only" characterisation withdrawn. Mints no FD. No live DB contact. Prod FROZEN, untouched. §50 minted. Basis `2d45b6d1`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.46. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged — this revision mints no XK number.
- Mints: **§50**.
- Closes: **nothing**.
- Measures: **XK-2's SQL-visible extent** — 201 statements, 14 instances, 5 files,
  3 keystones.
- Records as owed, unamended: XK-2's **Reach column** (understated at two
  keystones); **sub-form 3's wording**; the entry's **extent statement**. All three
  require a Fix Plan revision ratifying a CKR change per CKR §6, and none is taken
  here.
- Records, unminted: `wardrobe.js:173`'s distinct shape (§50.5); the observations
  at §50.6; the **F-Sec-3 instance report** at §50.7.
- Carries: §35.5's classes 2–6, unminted and homing-owed; the class 2 candidate at
  `opportunityRoutes.js:258`; open items 22, 24, 6; all other items carried from
  v1.46. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: XK-2's ORM-surface extent, its remedy, and its sequence position;
  `wardrobe.js:173`'s homing; classes 2–6's reach; §39.4 defect 1 (label-only) and
  defect 3 (unruled); §44.8 (satisfied for `worldEvents.js`, unruled generally);
  XK-1's remedy and population question.
- Forward-points: the ten ORM-only `:showId` files, as the unmeasured remainder of
  XK-2's surface. Recorded, not adopted.
- Changes no unit disposition, no PR state, no gate. `worldEvents.js`'s 112
  dispositions stand unaltered. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.46; no destructive rewrite. **The Cross-Keystone
  Register is not modified by this revision.**
- **Numeral disambiguation:** *XK-2 (Cross-Keystone Register)* is unrelated to
  FD-2, PE #2, §2, or any keystone's open item 2. F-AUTH-1's **CP7** and **CP12**
  belong to F-AUTH-1's register. §50 is minted in v1.47; section numbers and their
  minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

XK-2 was minted on two files. It is now measured on twelve, and it is in five —
`worldEvents.js`, `arcRoutes.js`, `shows.js`, `evaluation.js`, `wardrobe.js` —
across three keystones including F-Ward-1, which the entry does not name.

**The most useful result is the negative one.** `uiOverlayRoutes.js` carries 29
raw statements and scopes every by-id predicate it issues, including the two
built with dynamic `SET` clauses. **XK-2 is not what this codebase does; it is
what some of it does.** A finding that were universal would be a convention. This
one is a divergence, which means there is a correct pattern already in the
codebase to point a remedy at.

**The measurement also disproves its own denominator.** Three instances scope in
Sequelize and write in raw SQL, so the probe that found them cannot see what makes
them safe or unsafe on the read side — and ten `:showId` route files carry no raw
SQL at all. **XK-2 is a scope-discipline finding that happens to be visible in
SQL.** 201 statements is the portion that could be seen, not the portion that
exists.

Two things this revision deliberately did not do. It did not widen XK-2's entry,
because the entry should be amended once against a settled extent rather than
twice against a moving one. And it did not fold `wardrobe.js:173` into the
finding, because "the route was never scoped" is a different claim from "the scope
was dropped," and the difference between measuring and absorbing is the difference
v1.45 was written to correct.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `2d45b6d1` (#1020). Predecessor: v1.46.*
*Minted: §50. Measured: XK-2's SQL-visible extent. Closed: nothing. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
