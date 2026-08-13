# F-Stats-1 Fix Plan v1.42
*Additive-supersede on v1.41. Mints §45. Dispositions the final 5 statements.*

## What changed in v1.42

**The last 5 outstanding statements are DISPOSITIONED.** §16.2's two pending
Overlays handlers (3 statements) and the two orphans at 2846 and 3764. **3 convert
/ 2 withdraw, zero injection findings.**

**`worldEvents.js` is 112 of 112 dispositioned in the injection sense.** Every
statement in the file now carries an injection verdict and recorded findings.

**Open item 41's figure cannot be stated as one number, and the item does NOT
close.** Under §44.8's unruled question the answer is **0 or 23**:

- **Injection reading:** 112 of 112 dispositioned. Outstanding **0**.
- **Convertibility reading:** 89 of 112 carry a convert/withdraw verdict.
  Outstanding **23** — §35.2's five groups, which v1.33 never ruled.

**§44.8's question is now load-bearing.** It was raised at v1.41 as a hygiene
matter. It is now the only thing standing between open item 41 and closure.

**§16.2's carve-out basis is unrecorded and unexplained** — §45.4. Neither pending
handler contains anything that would have blocked a v1.14 verdict.

**A pattern is recorded at §45.6: §16.2's two carve-outs have each now been
omitted from a sum**, in different revisions, in opposite directions.

---

## §45 — the final 5, dispositioned

### §45.1 Basis and method

Basis `17a35d3b` (v1.41, #1014). Source-derived via
`git show origin/main:src/routes/worldEvents.js`. §28's method, unchanged; every
handler window read in full and bounded by the next handler's start line.

`generate-lists`'s window was re-read to its close at 3805 to confirm 3764 is its
only statement, rather than relying on the earlier membership-oriented read of the
same band.

### §45.2 Dispositions

**`POST /:eventId/reject-overlay` (3132) — 2 statements** *(§16.2 carve-out)*

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 3139 | `UPDATE assets SET approval_status='rejected', deleted_at=NOW(), updated_at=NOW() WHERE id` | CLEAN | **WITHDRAW** | Hand-rolled soft delete on a paranoid model — §12.41 / XK-1 class |
| 3144 | `UPDATE assets SET deleted_at=NOW(), updated_at=NOW() WHERE id` | CLEAN | **WITHDRAW** | Tier-2 fallback, same basis |

**`PUT /:eventId/overlay-selections` (3459) — 1 statement** *(§16.2 carve-out)*

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 3465 | `UPDATE world_events SET required_ui_overlays = :overlays, updated_at = NOW() WHERE id AND show_id` | CLEAN | **Convert** | Single scalar column, **scoped**, `JSON.stringify` into a replacement |

**`GET /:eventId/feed-activity` (2836) — 1 statement** *(orphan)*

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 2846 | `SELECT id, name, canon_consequences FROM world_events WHERE id` | CLEAN | **Convert** | Single table, explicit projection |

**`POST /:eventId/generate-lists` (3756) — 1 statement** *(orphan)*

| Line | Statement | Inj. | C/W | Basis |
|---|---|---|---|---|
| 3764 | `SELECT id, name, used_in_episode_id FROM world_events WHERE id AND show_id AND deleted_at IS NULL LIMIT 1` | CLEAN | **Convert** | Explicit projection, **scoped**, soft-delete filtered. Cleanest of the five. |

**3 convert / 2 withdraw. Zero injection findings.**

### §45.3 Findings

- **3139/3144 duplicate `reject-invitation` (1271) almost exactly.** Same table,
  same columns, same two-tier ladder, same hand-rolled `deleted_at`, same
  `assetId`-from-body-only with both route scope parameters unused. Two handlers
  ~1,870 lines apart with identical substance and identical defects. **Fourth and
  fifth instances of the hand-rolled soft delete; third instance of decorative
  route scope parameters** (§44.7's sub-form).
- **The single difference between them is the model-acquisition idiom** —
  `req.app?.get?.('models') || require('../models')` at 3132 versus
  `await getModels()` at 1271. That is **open item 24's exact subject**: the dual
  model-resolution paths, presumed equivalent and never verified. Recorded as a
  further instance; item 24 is not closed and no verification is attempted.
- **3465 has no rows-affected check.** A non-existent or foreign `eventId` returns
  `success: true` with `${selected_overlays.length} overlays selected`. The scope
  clause makes the write safe and leaves the response wrong.
- **3465's `selected_overlays` is unvalidated.** `JSON.stringify(undefined)`
  yields `undefined`, the same shape §35.2 recorded at 3605 storing the literal
  string `"undefined"`. Here the response line dereferences `.length` and throws
  first, so an absent body 500s rather than corrupting the column. **The column is
  protected by statement ordering, not by validation.**
- **2846 sits behind an `if (models.WorldEvent)` ORM branch** with raw SQL as
  fallback over the same columns — Pattern 42's third instance, alongside
  `wardrobe.js:1291` and `WorldEvent.js:57`. Unscoped; `showId` never
  destructured.
- **2846 and 3764 are the two orphans of §39.4 defect 1.** Both now carry
  verdicts. **Defect 1 remains open and remains label-only**: which group each
  belongs to is undetermined, and no disposition depends on it.

### §45.4 §16.2's carve-out basis is unrecorded

§16.2 marked `PUT /overlay-selections` and `POST /reject-overlay` **`pending`**
at v1.14 and dispositioned the other seven Overlays handlers. **No reason is
recorded, in §16.2 or anywhere since.**

Read at source, neither handler is difficult. 3465 is a single scoped scalar
update. 3132 is two statements in a two-tier ladder — the simplest handler in the
group. Both are **less complex than several §16.2 dispositioned in the same pass**;
`approve-overlay` carried 8 statements and was ruled.

**Nothing in either handler would have blocked a v1.14 verdict.** This revision
records the carve-out's basis as **unrecorded and unexplained** rather than
inventing one. No ownership claimed; nothing turns on it now that both are
dispositioned.

### §45.5 The accounting, under both readings

**Injection reading — every statement carries an injection verdict:**

| | Stmts |
|---|---|
| §16.1 Core CRUD | 21 |
| §16.2 Overlays (7 handlers) | 23 |
| §16.2 `next-suggestions` (V/S, early) | 2 |
| §35.2 Stories / Distribution / Outfit rows / V/S / Financial | 23 |
| §44 Episode generation | 15 |
| §44 Invitations | 23 |
| **§45 (this revision)** | **5** |
| **Total** | **112** |

**Outstanding: 0.**

**Convertibility reading — statements carrying a convert/withdraw verdict:**

| Source | Stmts | Convert | Withdraw |
|---|---|---|---|
| §16.1 Core CRUD | 21 | 5 | 16 |
| §16.2 Overlays (7 handlers) | 23 | 13 | 10 |
| §16.2 `next-suggestions` | 2 | 2 | 0 |
| §44 Episode generation | 15 | 7 | 8 |
| §44 Invitations | 23 | 12 | 11 |
| **§45** | **5** | **3** | **2** |
| **Total with verdicts** | **89** | **42** | **47** |

**Outstanding: 23** — §35.2's Stories (2), Distribution (3), Outfit rows (6),
Venue/social (2), Financial (10). v1.33 rules convertibility nowhere; a probe for
`onvert` / `ithdraw` across it returns zero.

**Completed groups, both senses:**

| Group | Stmts | Convert | Withdraw | Withdrawal |
|---|---|---|---|---|
| Core CRUD | 21 | 5 | 16 | 76% |
| **Overlays (now complete)** | **26** | **14** | **12** | **46%** |
| Episode generation | 15 | 7 | 8 | 53% |
| Invitations | 23 | 12 | 11 | 48% |

**Open item 41's figure is 0 or 23 depending on §44.8's ruling.** The item **does
not close** and is **not renumbered**. A figure that cannot be stated as one
number is itself the reason the ruling is now owed rather than optional.

### §45.6 Method note — §16.2's carve-outs have each been dropped from a sum

§16.2 carries **two** carve-outs: two handlers left `pending` (3 statements), and
`next-suggestions` dispositioned early (2 statements, Venue/social group).

**Each has now been omitted from a sum, in a different revision, in the opposite
direction:**

- **v1.38** omitted the *pending* pair from the outstanding side. Item 41's figure
  undercounted outstanding work; corrected 41 → 45.
- **This revision's drafting** omitted the *early-dispositioned* pair from the
  verdict-bearing side, stating 87 where the figure is 89. Caught pre-write and
  corrected here.

The mechanism is §41.5 hazard 2 — *a carve-out named in prose is not a carve-out
carried in arithmetic* — recurring against the same section that generated it.
**§16.2's subtotal row reads "Subtotal (7 dispositioned) — 23" against a group of
26, and its early disposition of 3825 sits in a paragraph below the table.**
Neither is visible to anyone summing the table.

**Any sum touching Overlays must account for both carve-outs explicitly.** That is
now stated where a summer will find it.

---

## What this revision does not do

- Does not close open item 41. Its figure is 0 or 23 pending §44.8; it is not
  renumbered.
- **Does not rule §44.8.** What constitutes disposition remains unruled, and no
  ownership is claimed.
- Does not disposition §35.2's 23 statements for convertibility. That is the work
  §44.8's ruling would or would not require.
- Does not resolve §39.4 defect 1. Both orphans are dispositioned; their group
  labels remain undetermined and nothing depends on them.
- Does not resolve §39.4 defect 3 (site 570), still unruled.
- Does not close open item 23, or rule on its overlap with open item 41.
- Does not close open item 24, or verify the dual model-resolution paths.
- Does not adopt open item 22's substance.
- Does not mint any finding class, or assert reach beyond `worldEvents.js`.
- Does not evaluate or apply any conversion. **A `Convert` verdict is a
  convertibility ruling, not a fix.**
- Does not disturb §16.1, §16.2, §35.2 or §44's dispositions.
- Does not disposition the `character_key` split at §35.6 / §12.35. F-Sec-3's
  surface, queued last in sequence.
- Does not draw the XK-1 population conclusion, though 3139 and 3144 are further
  instances of its subject.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN and this revision confers no
  authority to touch it.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.42 | 2026-08-13 | **The final 5 statements DISPOSITIONED — 3 convert / 2 withdraw, zero injection findings.** §16.2's two pending Overlays handlers (`reject-overlay` 3139/3144 WITHDRAW, hand-rolled `deleted_at` on a paranoid model; `overlay-selections` 3465 Convert, scoped single scalar) and both §39.4 defect-1 orphans (2846 Convert; 3764 Convert, scoped and soft-delete filtered). **`worldEvents.js` is 112 of 112 dispositioned in the injection sense.** **Open item 41's figure cannot be stated as one number and the item does NOT close**: under the injection reading outstanding is **0**; under the convertibility reading **89 of 112** carry a convert/withdraw verdict and outstanding is **23** — §35.2's five groups, which v1.33 never ruled. **§44.8's question is now load-bearing**, the only thing between item 41 and closure. Overlays complete at 26 (14 convert / 12 withdraw). **§16.2's carve-out basis recorded as unrecorded and unexplained (§45.4)** — neither pending handler contains anything that would have blocked a v1.14 verdict, and both are simpler than several §16.2 ruled in the same pass. 3139/3144 near-duplicate `reject-invitation` 1281/1286, differing only in the model-acquisition idiom — **open item 24's subject**, recorded as a further instance, not closed. **Method note §45.6: §16.2's two carve-outs have each now been dropped from a sum** — the pending pair at v1.38 (undercounting outstanding, corrected 41 → 45) and the early-dispositioned pair in this revision's drafting (stating 87 where the figure is 89, caught pre-write). Mints no FD. No live DB contact. Prod FROZEN, untouched. §45 minted. Basis `17a35d3b`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.41. Tail: **FD-61**.
- Mints: **§45**.
- Dispositions: **the final 5 statements** — 3139, 3144, 3465, 2846, 3764.
- Closes: **nothing**. Open item 41 does not close; see §45.5.
- Corrects: **open item 41's figure**, from 5 to **0 or 23 pending §44.8**.
- Records: §16.2's carve-out basis as **unrecorded and unexplained** (§45.4); a
  further instance of **open item 24's** subject (§45.3); the carve-out
  omission pattern (§45.6).
- Raises: **§44.8 is now load-bearing** rather than hygiene. Still unruled, still
  unowned.
- Carries: **open item 41** (OPEN, figure ruling-dependent, denominator 112);
  **open item 23** (OPEN, substance re-anchored to this accounting); open item 22
  (unassigned); open item 24 (open, new instance recorded); open item 6 (v1.31
  carve-out stands); all other items carried from v1.41.
- Defers: §39.4 defect 1 (open, label-only, nothing depends on it); §39.4 defect 3
  (unruled); XK-1's remedy; the XK-1 population question; the item 23 / item 41
  overlap; §44.8's ruling.
- Forward-points: nothing new.
- Changes no PR state, no gate. Unit 19's withdrawal stands.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.41; no destructive rewrite.
- **Numeral disambiguation:** *open item 41 (F-Stats-1)* is unrelated to *FD-41
  (F-Deploy-1)* and to any §41. *Open items 22, 23, 24 (F-Stats-1)* are unrelated
  to FD-22/23/24 and to §22 / §23.1 / §24. §45 is minted in v1.42; section numbers
  and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

`worldEvents.js` has been the F-Stats-1 executable surface since §16 inventoried
it at v1.14 and corrected 144 → 112. **Every one of those 112 statements now
carries a disposition.**

**Zero injection findings across all 112.** Every statement parameterized —
including three JSONB paths, an `IN (:ids)` expansion, a `jsonb_set` with an
explicit cast, and a dynamic `SET` clause built from hardcoded literals. Across
one of the largest route files in the codebase, **the exposure is not injection.**

Where the file is exposed is authorization and delete discipline: statements
carrying no scope term, three handlers whose route scope parameters are
decorative, five hand-rolled `deleted_at` writes against paranoid models, three
hard `DELETE`s on a soft-deleted table, and drift ladders that degrade a write and
report success. **Six finding classes remain unminted and homing-owed**, their
severity now on the record.

**Open item 41 does not close, and the reason is worth stating precisely.** The
counting is finished. What is not finished is the definition: v1.33 dispositioned
five groups without ruling convertibility, and no revision has said whether that
constitutes disposition. Under one reading the item is closable today; under the
other, 23 statements remain. **The register cannot state its own remainder until
it says what it is counting.**

That ruling is the next thing this keystone needs. It requires no source access,
no measurement, and no further reads — only a decision.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `17a35d3b` (#1014). Predecessor: v1.41.*
*Minted: §45. Dispositioned: the final 5 statements. Closed: nothing. Corrected: open item 41's figure, to 0 or 23 pending §44.8. Mints no FD. Tail: FD-61. [skip-automerge]*
