# F-Stats-1 Fix Plan v1.52
*Additive-supersede on v1.51. Mints §55. Corrects v1.48 §51.2. Mints no finding.*

## What changed in v1.52

**v1.48 §51.2's characterisation of the second shape is CORRECTED.** It reads
*"scope value absent at every layer."* **For 5 of 11 sites that is false at the
model layer** — the tenant column is on the model being read and is never fetched.

**A third variant is recorded** — §55.3. *Tenancy on the model, never fetched.*
Distinct from XK-2 (route param held and dropped) and from the second shape as
characterised (no tenancy anywhere).

**v1.48 §51.4's remedy argument SURVIVES, and its wording does not** — §55.4. The
correction is that a filterable column exists, **not** that a tenant value is in
hand. **No route in either group carries one.**

**An eleventh site is added** — `storyteller.js:280`. The shape now stands at
**10 handlers, 11 sites, 7 files.**

**A method failure at population scale** — §55.6. Seven rulings were made from
route signatures **without reading a single model file.**

---

## §55 — the model layer, unread

### §55.1 How it surfaced

`storyteller.js` was opened as a Rule 2 target: 8 destructive sites, second in the
distribution. Its routes are `/books/:id`, `/chapters/:id`, `/lines/:id` — **no
`:showId`, and no way to tell from the route names whether the domain is
show-partitioned or sits above partitioning like `worldStudio.js`.**

That ambiguity forced a model read. `StorytellerBook` carries `show_id` with
`belongsTo(models.Show)`. **`StorytellerChapter`, `StorytellerLine`,
`StorytellerEcho` and `StorytellerMemory` do not.**

**Partial partitioning at the root only** — and the question it raised applied
backwards to every prior ruling.

### §55.2 The audit of prior rulings

| Site | Model read | `show_id` on model | Status |
|---|---|---|---|
| `wardrobe.js:173` | `episodes` (raw SQL) | **yes** | **corrected** |
| `episodes.js:239` | `Episode` | **yes** | **corrected** |
| `feedPostRoutes.js:186` | `FeedPost` | **yes** | **corrected** |
| `feedPostRoutes.js:200` | `FeedPost` | **yes** | **corrected** |
| **`storyteller.js:280`** | **`StorytellerBook`** | **yes** | **new, this variant** |
| `episodes.js:882` | `EpisodeWardrobeDefault` | no | holds |
| `episodes.js:1142` | `SceneSetEpisode` | no | holds |
| `editMaps.js:104` | `EditMap` | no | holds |
| `sceneStudioEpisodeRoutes.js:139` | `ScenePlan` | no | holds |
| `sceneStudioEpisodeRoutes.js:148` | `ScenePlan` | no | holds |
| `wardrobeEventRoutes.js:282` | `EpisodeWardrobe` | no | holds |

**5 corrected, 6 hold.**

Every "no" was verified twice: the model file was confirmed present in
`src/models/` **before** the empty `show_id` grep was read as a negative. An empty
`git grep` over a nonexistent path returns nothing, and **that ambiguity produced
a false negative earlier in this same session** — a grep over `Book.js`,
`Chapter.js` and `Line.js`, none of which exist under those names.

**`wardrobe.js:173` is the one that matters most.** It is the founding instance of
the second shape, held out of XK-2's count at v1.47 §50.5 **on the grounds that no
scope value existed anywhere.** It reads `episodes`, which carries `show_id`.

**`episodes.js:239` is subtle and is stated precisely.** `Scene` carries no
`show_id` — but the read the destroy depends on is `Episode.findByPk(id)`, and
`Episode` does. **The correction attaches to the read, not the destroy.**

### §55.3 The third variant

| Variant | Tenant value | Tenant column | Status |
|---|---|---|---|
| **XK-2** | in the route, used then dropped | on the model | **minted** |
| **Model-carried, unfetched** | **not in the request** | **on the model, never read** | **recorded here** |
| **No tenancy carried** | not in the request | **not on the model** | recorded v1.48 |

`storyteller.js` illustrates all the depth cases in one file: `StorytellerBook`
carries `show_id` directly; a chapter's tenancy is one join away
(`chapter → book`); a line's is two (`line → chapter → book`).

**The variant is recorded, not minted.** It is not folded into XK-2 and not
separated from the second shape by ruling. **v1.48 §51.5's option 3 continues to
stand for all eleven sites.**

### §55.4 §51.4's remedy argument — survives, restated

v1.48 §51.4 held the second shape separate from XK-2 on a remedy test: XK-2's
candidates *"all assume a tenant value is in hand. None of these handlers has
one."*

**That argument survives the correction.** What §55.2 establishes is that a
**filterable column** exists on five models. It does **not** establish that a
**tenant value** reaches the handler.

`PUT /feed-posts/:postId` carries no `:showId`, no body `show_id`, and no derived
show context. **Knowing that `FeedPost.show_id` exists tells you what to filter
on; it does not tell you what to filter by.** That value must come from auth
context — `req.user`'s permitted shows — which is a different remedy from XK-2's
*"restate the predicate you already hold."*

**What the correction changes is implementation depth, not remedy nature:**

- **5 sites** — once a tenant is resolved, the filter is direct:
  `findOne({ where: { id, show_id } })`.
- **6 sites** — once a tenant is resolved, the filter needs a join:
  `scene_plan → episode → show`, `episode_wardrobe → episode → show`.

**Both groups require resolving tenancy from something other than the request
path.** That is why they remain one shape and remain separate from XK-2.

**An in-session claim that "XK-2's remedy does apply" to the five is
WITHDRAWN.** It confused the column with the value.

### §55.5 `storyteller.js` — one site read, seven unread

`DELETE /books/:id` (:272–:284):

```
const book = await models.StorytellerBook.findByPk(req.params.id);
if (!book) return res.status(404).json({ error: 'Book not found' });
await book.destroy();
```

`requireAuth`, no tenant parameter, no `show_id` in the read. **Any authenticated
caller holding a book UUID deletes any show's book** — and whatever the model's
associations cascade to. **Cascade behaviour was not read and is not asserted.**

**Seven destructive sites in this file are unread** — :387 (`chapter.destroy()`),
:889 and :1000 (`StorytellerLine.destroy({ where: { chapter_id } })`), :909
(`line.destroy()`), :1174 (`echo.destroy()`), :1378 (`mem.destroy()`), :1521
(`thread.destroy()`, on a model not examined). **Not counted, not asserted clean.**

**Rule 2's remaining population is 75 − 8 + 7 = 74 sites unread**, since this
revision reads one of `storyteller.js`'s eight.

### §55.6 Method note — seven rulings, no model read

**v1.48 and v1.49 ruled seven sites as "no scope value at any layer" without
reading a single model file.** The evidence used was route signatures and handler
bodies. **Neither shows whether the target model carries a tenant column.**

The failure was caught only because `storyteller.js`'s domain was ambiguous enough
to force a model read that no prior file had forced. **`worldStudio.js` was
excluded correctly, but by route inspection — and the same inspection applied to
`feedPostRoutes.js` produced a wrong characterisation.**

**This is §46.4's hazard at population scale.** §46.4 recorded ruling two
statements Convert on statement shape before checking the target had a model, and
cost a revision. **Here the same omission ran across seven rulings in two merged
revisions.**

The generalisable form: **a claim about what a handler could have used requires
reading what was available to it, not only what it did.** Route signature plus
handler body shows what was used. The model layer shows what was there.

This joins §28's `Measure-Object -Line` hazard, §43.7's null controls, §46.4's
shape-without-model, §47.6's malformed probe, §52.5's partial population, §53.5's
three counts, and §54.5's `-c`/`-n` confusion. **Seventh position, same family.**

---

## What this revision does not do

- **Does not mint any finding.** The shape remains unminted, unowned, unnumbered
  across all 11 sites; v1.48 §51.5's option 3 stands.
- Does not separate the third variant into its own finding, or fold it into XK-2.
- Does not amend XK-2's Cross-Keystone Register entry.
- Does not re-open v1.47 §50.5's decision to hold `wardrobe.js:173` out of XK-2's
  count. **The ground stated there is corrected; the decision is not revisited**,
  because §55.4's remedy argument continues to support separation.
- Does not read `storyteller.js`'s seven remaining destructive sites, or assert
  them clean.
- Does not examine cascade behaviour on `StorytellerBook`'s associations.
- Does not identify the model behind `storyteller.js:1521`'s `thread.destroy()`.
- Does not survey the remaining **74 unread destructive sites**.
- Does not measure the reads surface; v1.51 §54.4's instrument question stands.
- Does not measure XK-2's ORM-surface extent.
- Does not propose or evaluate a remedy. **Both shapes' remedies remain
  UNEVALUATED.** §55.4 distinguishes remedy *shapes*; it selects none.
- Does not disposition any statement. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.52 | 2026-08-15 | **v1.48 §51.2's characterisation CORRECTED — "scope value absent at every layer" is false at the model layer for 5 of 11 sites.** Surfaced when `storyteller.js`'s route names (`/books/:id`, `/chapters/:id`, `/lines/:id`) could not resolve whether the domain is show-partitioned, forcing a model read: **`StorytellerBook` carries `show_id` with `belongsTo(Show)`; its chapter, line, echo and memory models do not** — partial partitioning at the root only. Applied backwards: **`wardrobe.js:173` (reads `episodes`), `episodes.js:239` (`Episode.findByPk`), `feedPostRoutes.js` :186 and :200 (`FeedPost.findByPk`) all read models carrying `show_id`.** `wardrobe.js:173` is the founding instance, held out of XK-2's count at v1.47 §50.5 **on the ground that no scope existed anywhere.** Six sites hold — `EpisodeWardrobeDefault`, `SceneSetEpisode`, `EditMap`, `ScenePlan` ×2, `EpisodeWardrobe` carry no `show_id`, each verified by confirming the model file exists **before** reading an empty grep as a negative. **Third variant recorded (§55.3): tenancy on the model, never fetched** — distinct from XK-2 (route param held then dropped) and from no-tenancy-carried; `storyteller.js` shows all depths (book direct, chapter one join, line two). **§55.4: v1.48 §51.4's remedy argument SURVIVES, its wording does not.** A filterable column existing is not a tenant value being in hand — no route in either group carries one, so both require resolving tenancy from auth context; the correction changes filter depth (direct vs join), not remedy nature. **An in-session claim that "XK-2's remedy does apply" to the five is WITHDRAWN** — it confused the column with the value. **Eleventh site added:** `storyteller.js:280`, `findByPk` then `book.destroy()`, no tenant read; cascade behaviour unread. Shape now **10 handlers / 11 sites / 7 files**, still unminted. **Seven of `storyteller.js`'s eight destroys unread**; Rule 2's remaining population 74. **§55.6 method note: seven rulings across two merged revisions were made from route signatures without reading a single model file** — §46.4's hazard at population scale; **a claim about what a handler could have used requires reading what was available to it, not only what it did.** Seventh position in the same hazard family. Mints no FD, no XK. No live DB contact. Prod FROZEN, untouched. §55 minted. Basis `b600f4df`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.51. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged.
- Mints: **§55**.
- Closes: **nothing**.
- **Corrects v1.48 §51.2**'s "absent at every layer" characterisation for 5 of 11
  sites; **restates v1.48 §51.4**'s remedy argument, which survives on its
  substance.
- **Withdraws:** an in-session claim that XK-2's remedy applies to the five
  model-carried sites.
- Adds: **`storyteller.js:280`** as the eleventh site. Shape stands at 10 handlers
  / 11 sites / 7 files, **unminted, unowned, unnumbered.**
- Records: the **third variant** (§55.3); `StorytellerBook`'s root-only
  partitioning; §55.6's method note.
- Owes: `storyteller.js`'s seven unread destructive sites; the model behind
  :1521; cascade behaviour on `StorytellerBook`.
- Carries: XK-2's owed amendments; **74 unread destructive sites**; the reads
  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
  homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3
  instance report at `wardrobe.js:1233`; the eleven-router collision surface and
  fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three
  unread write sites from v1.48; open items 22, 24, 6; all other items carried
  from v1.51. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: both shapes' homing; the third variant's homing; XK-2's ORM-surface
  extent, remedy and sequence position; classes 2–6's reach; §39.4 defect 1 and
  defect 3; §44.8; XK-1's remedy and population question.
- Forward-points: the model layer as a required input to any scope ruling.
  Recorded as method, not adopted as a finding.
- Changes no unit disposition, no PR state, no gate. **The Cross-Keystone Register
  is not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.51; no destructive rewrite. v1.48's and v1.49's bodies
  are not modified; their corrections live here.
- **Numeral disambiguation:** *XK-1 and XK-2 (Cross-Keystone Register)* are
  unrelated to FD-1/FD-2, §1/§2, or any open item 1/2. §55 is minted in v1.52;
  section numbers and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

Two merged revisions characterised eleven sites as having **no tenant value at any
layer.** For five of them the tenant column sits on the model being read, and no
revision checked, because route signatures and handler bodies were treated as
sufficient evidence about what a handler *could* have used.

**They are not.** A handler body shows what was used. **The model layer shows what
was there** — and a claim of the form *"there was nothing available"* is a claim
about availability, which only the model layer answers.

The correction is narrower than it first appears, and that is worth stating
plainly rather than overselling it. **The instances are unchanged**: eleven
handlers still delete or overwrite rows on caller-supplied ids with no tenancy
check. **The remedy argument is unchanged**: none of these routes carries a tenant
value, so all eleven need one resolved from auth context, and XK-2's *"restate the
predicate you already hold"* still does not reach them. What changed is that five
of them can be filtered directly once a tenant is in hand, and six need a join.

**`wardrobe.js:173` is the instructive case.** It founded the second shape at
v1.47 §50.5, held out of XK-2's count because no scope value was thought to exist.
It reads `episodes`, which has carried `show_id` the entire time. **The decision it
grounded still stands on §55.4's argument — but it stood on a fact that was never
checked.**

Seven positions in the hazard family now, and this one has the plainest statement
of the remedy: **read what was available, not only what was used.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `b600f4df` (#1025). Predecessor: v1.51.*
*Minted: §55. Corrected: v1.48 §51.2's characterisation. Restated: v1.48 §51.4's remedy argument. Withdrawn: an in-session remedy-applicability claim. Closed: nothing. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
