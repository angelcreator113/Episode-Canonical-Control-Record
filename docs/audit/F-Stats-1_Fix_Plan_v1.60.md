# F-Stats-1 Fix Plan v1.60

*Additive-supersede on v1.59. Mints §63. Rules on exclusion accounting. Discharges four owed items and advances a fifth. Corrects one depth recorded at v1.58. Mints no FD, no XK.*

## What changed in v1.60

**This revision has three subjects and says so.** It discharges obligations (§63.1), makes a ruling (§63.2), and completes a trace (§63.3). Prior revisions in this register are single-subject; this one is not, and the three parts are independent — **any of them may be read without the others, and none is evidence for another.**

**RULING: excluded sites leave Rule 2's remainder. The complement is exhausted at zero, not pending at nineteen.** v1.58 §61.4 recorded that v1.49 and v1.55 accounted for domain exclusions in opposite directions and that the register had chosen no convention. **v1.44 §47.2 is not an accounting rule** — it is an applicability rule, and neither revision was following a source. §63.2 rules, and the basis is v1.55 §58.5's own words: *a handler cannot omit a check against a tenancy that does not exist.* **A remainder counts sites the class could apply to.** The nineteen were never candidates.

**Four owed items discharged, one advanced.** `footage.js`'s read handlers are enumerated — **two, and the file's full surface is seven unauthenticated routes rather than five.** Foreign-key nullability is read across five models: **four paths are guaranteed and `StorytellerMemory`'s two are both nullable.** `RegistryCharacter.js` exists, so v1.59's conditional-association question resolves true. **v1.59 §62.8's false-positive question is closed** — `memories/engine.js:4690` stands alone. **PE #62's overlap is not closed** but its live half is derived: **ten route-level `model.sync()` calls across five files.**

**CORRECTION to v1.58 §61.6.** `Asset` carries `show_id`. `LayerAsset`'s shortest path to tenancy is therefore **one hop, not the two joins recorded** — and the handler at `layers.js:407` took neither path. **This is the first confirmed instance of the error v1.59 §62.6 predicted**, found on the first parent traced.

**Four conditional associations, in four files, are an idiom rather than four defensive one-offs.** `if (models.RegistryCharacter)`, `if (models.CharacterRegistry)`, `if (models.Universe)`, `if (m.ContinuityBeatCharacter)`. **All four resolve true against the current tree.** §63.4.

**Changes no total that is minted.** Shape stands at **40 sites / 39 handlers / 20 files**, unminted. FD tail remains **FD-62**. XK tail remains **XK-3**. This revision mints no FD, no XK, no PE.

---

## §63 — Obligations, a ruling, and a trace

### §63.1 Owed items — four discharged, one advanced

**`footage.js`'s read handlers, owed at v1.58 §61.8.** Two: `:126` `GET /scenes/:episodeId` and `:226` `GET /episodes/:episodeId/assets`. **Neither carries middleware**, and `src/app.js:833` mounts the router bare.

**The surface is therefore seven routes, not five.** v1.58 §61.8 established five mutating declarations and scoped its claim to those, noting reads were unenumerated. **All seven are reachable without authentication.** The two reads return scene and asset data for any caller-named episode.

**Two of them are reads-slice sites, arrived at without opening that program.** v1.49 §52.6 recorded the reads slice as owed and Rule 2 as finding no reads at all. **These two were found by discharging an obligation, not by surveying**, and they are recorded rather than counted — the reads slice remains unopened and unscoped.

**Foreign-key nullability, owed at v1.58 §61.6 and v1.59 §62.6.**

| Model | Foreign key | `allowNull` | `references` declared |
|---|---|---|---|
| `Layer` | `episode_id` | **false** | yes |
| `LayerAsset` | `layer_id` | **false** | yes |
| `Scene` | `episode_id` | **false** | no |
| `SceneFootageLink` | `scene_id` | **false** | no |
| `StorytellerMemory` | `line_id` | **true** | not read |
| `StorytellerMemory` | `character_id` | **true** | not read |

**Four paths are guaranteed.** v1.58 recorded its depths with the caveat that a nullable foreign key admits rows reaching no show at all; for `Layer`, `LayerAsset`, `Scene` and `SceneFootageLink` that caveat is discharged and the depths are real.

**`StorytellerMemory`'s are not.** Both foreign keys are nullable, so **a memory row may exist reaching tenancy by no path.** v1.59 §62.3 recorded three joins as the deepest path in the register; that is the depth **when the path exists**, and this revision qualifies it accordingly. **It is closer to `author_notes`'s no-path-at-all than v1.59 stated** — not identical, because a path exists for rows that populate the key, but not the guaranteed path the depth implied.

**Two models declare `references` and two do not.** `Layer` and `LayerAsset` carry database-level foreign-key constraints; `Scene` and `SceneFootageLink` reach their parents by column name and Sequelize association only. **Recorded, not assessed.**

**The conditional association, owed at v1.59 §62.6.** `src/models/RegistryCharacter.js` exists. **`if (models.RegistryCharacter)` resolves true**, and `StorytellerMemory`'s second association is wired. **What it reaches is a separate question**, answered at §63.3.

**v1.59 §62.8's false-positive question is CLOSED.** Two probes. A targeted pattern over known non-model receivers — `req`, `res`, `socket`, `stream`, `conn`, `client` and others — returned `memories/engine.js:4690` alone. An inverted filter over the full 91, excluding lines whose receiver is `models.`, `db.` or a capitalised identifier, returned nineteen lines, **every one a raw SQL `DELETE FROM` and every one legitimate.**

**`memories/engine.js:4690` stands alone.** No further non-destructive match sits in `src/routes/`. **The complement's true site count is 77**, and v1.59 §62.8's open question is answered rather than carried.

**PE #62's overlap is ADVANCED, not discharged.** The live population is derived: **ten route-level `model.sync()` calls across five files** —

- `continuityEngine.js:39, :40, :41, :42` — four, the last guarded by `if (m.ContinuityBeatCharacter)`
- `franchiseBrainRoutes.js:66`
- `memories/engine.js:2434, :3183, :3470, :3662` — four, all `StoryTaskArc.sync()`
- `sceneSetRoutes.js:52` — `GenerationJob.sync()`

plus `src/models/index.js:1800`, which is `sequelize.sync()` rather than a model sync and is a different operation.

**The overlap cannot be closed from here.** F-App-1 §12.11 enumerates eleven sites; **that list was not read**, and ten against eleven means nothing without both. The item remains owed with its live half on the record.

**A line-number correction.** v1.58 §61.9 cited the `FranchiseKnowledge.sync()` at `franchiseBrainRoutes.js:54`. **`:54` is the route declaration; the sync is at `:66`.** v1.58 is not edited; the correction is recorded here.

**`sceneSetRoutes.js:52` was not recorded by v1.54**, which read that file in full. **This is not a defect in v1.54** — it read for destructive writes under Rule 2, and a sync is neither. **It does establish that the sync class is under-recorded in files this register considers complete**, and that any future census of it cannot rely on prior reads.

### §63.2 RULING — excluded sites leave the remainder

**The question, owed since v1.58 §61.4.** v1.49 excluded four files on principle and left their nineteen sites **in** the population; its remainder is 78 minus 3, with no exclusion subtraction. v1.55 excluded six files by domain and took their nineteen sites **out**; 61 minus 27 equals 34 confirms it. **Same operation, opposite treatment.**

**v1.44 §47.2 does not settle it, because it is not an accounting rule.** Its subject is applicability. `worldStudio.js` has no `:showId` in any of fifty-three routes, so probing there for absent `show_id` terms **would have manufactured a class-1 finding from a file the class cannot apply to.** The revision discarded the target and recorded that **the scoping model was checked before the scoping question was asked.** It says nothing about what happens to a counter.

**So neither v1.49 nor v1.55 diverged from a source rule. There was no source rule.** Each improvised, and they improvised differently. **The register has had an exclusion principle with no accounting attached since v1.44**, and that is the actual defect — not either revision's arithmetic.

**The ruling, and its basis.** v1.55 §58.5 states the principle exactly:

> Excluded is not cleared. These sites are outside the shape's population because the domain they operate on is not show-partitioned — **a handler cannot omit a check against a tenancy that does not exist.** Nothing is asserted about their correctness in any other respect.

**A remainder counts sites the class could apply to.** An excluded site is one the class demonstrably cannot reach, verified per-model with the file-exists guard. It is not unresolved work; it was never a candidate. **Keeping it in the remainder does not undercount work — it miscounts the class.**

**Excluded sites leave the remainder. Rule 2's complement is exhausted at zero.**

**v1.49's 78 was probe output, and the probe over-collects at two levels.** §47.2 established over-collection at the level of whole non-partitioned domains; **v1.59 §62.8 established it independently at the level of non-model receivers**, fifteen revisions apart. Neither class is a Rule 2 site, and neither belongs in a Rule 2 remainder.

**Three bounds, stated so the ruling is not read as more than it is.**

**It clears nothing.** The nineteen carry no correctness claim of any kind, exactly per v1.55 §58.5's final sentence. **They are outside this class and inside no other that has been applied to them.**

**It does not discharge Rule 2's stated cost.** v1.49 §52.6 recorded that Rule 2 finds no reads at all and that a reads slice over the same complement is owed. **The destructive-write complement is exhausted; the reads slice is untouched and unscoped.** Exhausting a slice is not exhausting the surface it was cut from.

**It does not rewrite any prior remainder.** Additive-supersede: v1.49 through v1.59's figures stand as recorded, including v1.58 §61.3's correction of 34 to 37. **The ruling governs forward.**

**On authority.** A Fix Plan revision is the instrument that rules in this register — v1.57 §60.1 records that cross-keystone entries acquire ownership only when a Fix Plan revision ratifies them, and Audit Handoff v22 §2 records F-AUTH-1 v2.38 §1.3 ruling a sequencing question the same way. **This is that instrument, used for the first time on F-Stats-1's own accounting.**

### §63.3 The parent trace — one correction

v1.59 §62.6 recorded that four models reach tenancy through two or three parents and that **every depth in this register is the depth of the first association read.** The untraced parents are traced here.

| Model | Parents | Reaches tenancy |
|---|---|---|
| `LayerAsset` | `Layer`; **`Asset`** | `Layer` at 2 joins; **`Asset` carries `show_id` directly, 1 hop** |
| `StorytellerMemory` | `StorytellerLine`; `RegistryCharacter` | `StorytellerLine` at 2 joins; `RegistryCharacter` **no** |
| `SceneFootageLink` | `Scene`; `ScriptMetadata` | `Scene` at 2 joins; `ScriptMetadata` **no** |
| `StoryCalendarEvent` | `StorytellerLine`; `StoryClockMarker`; `WorldLocation` | `StorytellerLine` at 2 joins; other two **no** |

**CORRECTION to v1.58 §61.6.** `src/models/Asset.js:39` declares `show_id`. **`LayerAsset`'s shortest path to tenancy is one hop, not two joins.** v1.58 recorded two, taken from `belongsTo(models.Layer)` as the first association read.

**The correction makes `layers.js:407` worse rather than better.** A one-hop path to tenancy existed, and the handler took neither it nor the two-join path. **This is the first confirmed instance of the error v1.59 §62.6 predicted** — *where a second parent reaches tenancy by a shorter path, the recorded depth overstates the distance* — and it was found on the first parent traced.

**The one-hop path is not guaranteed.** `Asset.show_id` is `allowNull: true`. **An asset may carry no show**, so the shorter path exists for rows that populate the column and not otherwise. **The correction to the recorded depth stands; the path is qualified.**

**Three parents terminate without reaching tenancy.** `RegistryCharacter` carries no `show_id` across roughly six hundred lines of attributes and associates only to `CharacterRegistry` by `registry_id`. `StoryClockMarker` carries no `show_id` **and declares no `belongsTo` at all.** `WorldLocation` carries no `show_id` and associates to `Universe` by a nullable `universe_id`.

**`WorldLocation` reaches the universe tier, which is above the partition.** v1.57 §60.2 established that `universes` carries no ownership column — it is the tier above `shows` and associates downward only. **A world location therefore reaches no tenancy by that route, and the path does not merely terminate: it terminates above the partition.**

**`StoryCalendarEvent` has three parents and exactly one path.** v1.59 §62.3 recorded it as having three parents and no `show_id`, which is accurate and understated: **one parent reaches tenancy at two joins and two dead-end.** The instance classification is unchanged.

**`ScriptMetadata` was settled at v1.59 §62.6** — it declares no `belongsTo` and carries `script_id` as a bare column. Not re-read.

**What the trace changes and does not change.** One recorded depth is corrected. **No instance classification changes**, no site leaves or joins the shape, and the shape total is unaltered at 40 / 39 / 20. **The value of the trace is that the register's depths are now traced rather than first-read**, for these four models only. **Every other depth in this register remains first-association-only and is not asserted.**

### §63.4 Conditional associations — an idiom

**Four, in four files:**

- `StorytellerMemory` — `if (models.RegistryCharacter)`
- `RegistryCharacter:651` — `if (models.CharacterRegistry)`
- `WorldLocation:117` — `if (models.Universe)`
- `continuityEngine.js:42` — `if (m.ContinuityBeatCharacter) await m.ContinuityBeatCharacter.sync()`

**All four resolve true against the current tree**, verified by confirming each model file exists. **None is currently broken.**

**The idiom is worth recording because of how it fails.** An association inside a truth test **compiles away silently when the model is absent.** There is no error, no warning, and no association — a tenancy path simply is not there. **v1.53's guard for reading an empty grep as absence has a runtime analogue**, and the register has not named it: a path established by reading a model file may not exist at runtime if the guard is false.

**Three of the four sit on tenancy paths this register has recorded.** Not adopted, not minted; recorded so a future reader knows the paths at §63.3 are conditional in the source as well as in the schema.

**`models.` and `m.` are both in use** for the model registry within these guards, and `getModels` has two signatures across ten or more route files per v1.59 §62.9. **Recorded together as a registry-access inconsistency; not assessed.**

### §63.5 Recorded, unminted

Surfaced while discharging. **Not adopted, not minted, not admitted.**

- **`worldStudio.js:1838` through `:1859` is a five-table hard-delete cascade** — `character_relationships`, `registry_characters`, `intimate_scenes`, `character_relationships_extended`, `world_characters`, executed as five sequential raw `DELETE` statements. **No transaction is visible in the surrounding lines**, which were not read. **Excluded from Rule 2 by domain per v1.44 §47.2 and untouched by the §63.2 ruling**, which clears nothing. Recorded because a partial failure mid-cascade leaves referential wreckage, and that is not a tenancy question.
- **Three raw-SQL deletes carry compound predicates including a tenant term** — `worldEvents.js:570` and `:1973`, `worldStudio.js:3121`, of the form `WHERE id = :id AND show_id = :showId`. **All three are in the `:showId` cohort and outside this pass entirely.** Recorded because the register has found no clean site since v1.55 §58.4's two, and these are candidates. **No claim is made about them; they are unread.**
- **Ten route-level `model.sync()` calls across five files** (§63.1). **Request-triggered DDL in a codebase whose boot path already executes untransacted DDL** at `src/server.js:146-164`, PE #62. The class is larger than the one site v1.58 §61.9 recorded.
- **`memories/engine.js` calls `StoryTaskArc.sync()` at four separate sites in one file.** Four entry points to the same request-triggered schema create.

### §63.6 Method notes

**A malformed probe of my own, and nothing was concluded from it.** A grep filtering on `tableName|show_id|allowNull|belongsTo` across four model files returned roughly two hundred lines, almost all of them bare `allowNull: true` with no field name — **`allowNull` appears once per attribute, and the filter stripped the attribute names that gave it meaning.** The signal was four `tableName` lines and two associations, buried.

**Re-run with `-B1 -A2`**, which supplies the field name above and the type and nullability below, the same four files answered in twenty lines. **v1.44 §47.6 records the same class** — a malformed probe from which nothing was concluded — **and records it as a hazard the register keeps meeting.** This is another instance and it is recorded on the same terms: **the first probe's output was not used.**

**Reading a line number from a route declaration rather than the site.** v1.58 §61.9 cited `franchiseBrainRoutes.js:54` for a `sync()` that is at `:66`. **The route declaration and the site inside its handler are twelve lines apart**, and the citation named the former. Corrected at §63.1; v1.58 is not edited.

**Read method, stated precisely.** This revision read **five model files at their foreign keys and associations**, four model files at their tenancy columns, and **one register document** (`F-Stats-1_Fix_Plan_v1.44.md`, at §47.2) **and one section of another** (`v1.55` §58.5). **No route file was read.** The `footage.js` and sync findings are grep output, not reads.

---

## What this revision does not do

- **Mints no FD.** FD tail remains **FD-62**. Mints no XK; tail remains **XK-3**. Mints no PE.
- Does not mint the shape. **v1.48 §51.5 option 3 stands** across all 40 sites.
- **Does not clear the nineteen excluded sites** (§63.2), and asserts nothing about their correctness in any respect.
- **Does not open, scope, or survey the reads slice**, owed since v1.49 §52.6. The two `footage.js` reads are recorded, not counted.
- Does not rewrite any prior revision's remainder, and does not edit v1.58 or v1.59.
- Does not close PE #62's overlap; F-App-1 §12.11 was not read.
- Does not trace any parent beyond the four models at §63.3. **Every other depth in this register remains first-association-only.**
- Does not read `references` declarations on `StorytellerMemory`, and does not assess the two models lacking them.
- Does not read the lines surrounding `worldStudio.js:1838`-`:1859`, and **makes no claim about whether that cascade is transactional**.
- Does not read `worldEvents.js:570`, `:1973` or `worldStudio.js:3121`.
- Does not assess F-AUTH-1. `footage.js`'s two read handlers extend a report and are not a claim.
- Does not amend XK-1, XK-2 or XK-3. Their bodies are untouched.
- Does not disposition any statement or any file, and does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.60 | 2026-08-16 | **RULES on exclusion accounting; discharges four owed items and advances a fifth; corrects one depth recorded at v1.58.** Three independent subjects, stated as such — **none is evidence for another.** **§63.2 RULING: excluded sites LEAVE Rule 2's remainder, and the complement is EXHAUSTED AT ZERO, not pending at nineteen.** v1.58 §61.4 recorded the v1.49-versus-v1.55 inconsistency and that no convention had been chosen; **v1.44 §47.2 turns out not to be an accounting rule at all** — its subject is *applicability*, recording that probing `worldStudio.js` would have **manufactured a class-1 finding from a file the class cannot apply to** — so **neither revision diverged from a source rule, because there was none**, and the register has had an exclusion principle with no accounting attached since v1.44. **The basis is v1.55 §58.5's own words: a handler cannot omit a check against a tenancy that does not exist.** A remainder counts sites the class *could* apply to; an excluded site was never a candidate, so **keeping it in does not undercount work — it miscounts the class.** v1.49's 78 was probe output, and **the probe over-collects at two levels — whole non-partitioned domains (§47.2) and non-model receivers (v1.59 §62.8)** — established independently, fifteen revisions apart. **Three bounds:** it **clears nothing** (the nineteen carry no correctness claim in any respect); it **does not discharge Rule 2's stated cost**, since **the reads slice remains owed, untouched and unscoped** and exhausting a slice is not exhausting the surface it was cut from; and it **rewrites no prior remainder** — additive-supersede, v1.58 §61.3's 34-to-37 correction included. **Authority:** a Fix Plan revision is this register's ruling instrument, per v1.57 §60.1 and Audit Handoff v22 §2's record of F-AUTH-1 v2.38 §1.3; **first use on F-Stats-1's own accounting.** **§63.1 four discharges, one advance:** `footage.js`'s reads are **`:126` and `:226`, neither carrying middleware**, so **the surface is SEVEN unauthenticated routes rather than five**, extending v1.58 §61.8 — and **two reads-slice sites were arrived at without opening that program**, recorded not counted. **FK nullability: `Layer`, `LayerAsset`, `Scene` and `SceneFootageLink` are all `allowNull: false`, so four depths are GUARANTEED**; **`StorytellerMemory`'s `line_id` and `character_id` are BOTH nullable**, so v1.59 §62.3's three-join deepest path is **the depth when the path exists**, closer to `author_notes` than stated. `Layer` and `LayerAsset` declare `references`; `Scene` and `SceneFootageLink` do not. **`RegistryCharacter.js` exists**, so v1.59's conditional resolves true. **v1.59 §62.8's false-positive question is CLOSED** by two probes — a known-receiver pattern and an inverted filter over all 91, the latter returning nineteen lines **every one a legitimate raw `DELETE FROM`** — so **`memories/engine.js:4690` stands alone and the complement's true count is 77.** **PE #62's overlap is ADVANCED not discharged** — live population **ten route-level `model.sync()` calls across five files** (`continuityEngine.js` :39-:42, `franchiseBrainRoutes.js:66`, `memories/engine.js` :2434/:3183/:3470/:3662, `sceneSetRoutes.js:52`), plus `models/index.js:1800` which is `sequelize.sync()` and a different operation; **F-App-1 §12.11's eleven were not read and ten-against-eleven means nothing without both lists.** **Line-number correction: v1.58 §61.9 cited `franchiseBrainRoutes.js:54`; the sync is at `:66`, `:54` being the route declaration.** **`sceneSetRoutes.js:52` was not recorded by v1.54, which read that file in full** — **not a defect**, since v1.54 read for destructive writes, but it establishes that **the sync class is under-recorded in files this register considers complete.** **§63.3 CORRECTION to v1.58 §61.6: `Asset.js:39` declares `show_id`, so `LayerAsset`'s shortest path is ONE HOP, not the two joins recorded** — and **the correction makes `layers.js:407` worse**, because a one-hop path existed and the handler took neither it nor the two-join path. **First confirmed instance of the error v1.59 §62.6 predicted, found on the first parent traced.** **The hop is not guaranteed** — `Asset.show_id` is nullable. **Three parents terminate:** `RegistryCharacter` (no `show_id` in ~600 lines, associates only to `CharacterRegistry`), `StoryClockMarker` (**no `show_id` and no `belongsTo` at all**), `WorldLocation` (associates to `Universe` by nullable `universe_id`, and **v1.57 §60.2 established `universes` carries no ownership column, so that path terminates ABOVE the partition**). **`StoryCalendarEvent` has three parents and exactly one path** — v1.59 §62.3's "three parents and no `show_id`" was accurate and understated. **No instance classification changes; the shape is unaltered at 40 / 39 / 20**, and **every depth outside these four models remains first-association-only and is not asserted.** **§63.4: four conditional associations in four files are an IDIOM** — `if (models.RegistryCharacter)`, `if (models.CharacterRegistry)`, `if (models.Universe)`, `if (m.ContinuityBeatCharacter)` — **all four resolve true**, none broken, **but an association inside a truth test compiles away SILENTLY when the model is absent**: no error, no warning, no association. **v1.53's empty-grep guard has a runtime analogue the register has not named**, and three of the four sit on paths recorded at §63.3. `models.` and `m.` both in use, alongside v1.59 §62.9's two `getModels` signatures. **§63.5 recorded, unminted:** **`worldStudio.js:1838`-`:1859` is a five-table hard-delete cascade** in five sequential raw statements with **no transaction visible in lines not read** — domain-excluded and **untouched by the §63.2 ruling, which clears nothing**; **three compound-predicate deletes carrying a tenant term** at `worldEvents.js:570`/`:1973` and `worldStudio.js:3121`, **in the `:showId` cohort, unread, candidates for the first clean sites since v1.55 §58.4**; and **`memories/engine.js` calls `StoryTaskArc.sync()` at four separate sites in one file.** **§63.6 method notes:** **a malformed probe of my own** — filtering on `allowNull` without field context returned ~200 near-useless lines because **`allowNull` appears once per attribute and the filter stripped the names that gave it meaning**; re-run with `-B1 -A2` the same four files answered in twenty lines, **v1.44 §47.6's hazard class reproduced, and nothing was concluded from the first output**; and **a line number read from a route declaration rather than the site**, twelve lines apart. **Read method: five model files at their FKs and associations, four at their tenancy columns, one register document at §47.2 and one section of another; NO route file was read** — the `footage.js` and sync findings are grep output, not reads. Mints no FD, no XK, no PE. No live DB contact. Prod FROZEN, untouched. §63 minted. Basis `5f7ee6b4`. |

## Register hygiene

- **RULES** (§63.2): excluded sites leave Rule 2's remainder. **The complement is exhausted at zero.** The nineteen v1.49 exclusions are outside the class and **carry no correctness claim of any kind.**
- **Mints no FD.** Tail: **FD-62**. Mints no XK; tail **XK-3**. Mints no PE.
- Mints: **§63**.
- Closes: **v1.59 §62.8's false-positive question** — `memories/engine.js:4690` stands alone; the complement's true site count is **77**.
- **Corrects:** v1.58 §61.6's recorded depth for `LayerAsset` — one hop via `Asset`, not two joins via `Layer` (§63.3). v1.58 §61.9's line number for the `FranchiseKnowledge` sync — `:66`, not `:54` (§63.1). **Neither prior revision is edited.**
- **Qualifies:** v1.59 §62.3's three-join depth for `StorytellerMemory`, both foreign keys being nullable (§63.1).
- **Extends:** v1.58 §61.8's `footage.js` surface from five declarations to **seven routes**, reads included (§63.1).
- Changes **no** unit disposition, no instance classification, no shape total. Shape stands at **40 / 39 / 20**, unminted; v1.48 §51.5 option 3 stands.
- **Discharged:** `footage.js`'s `router.get` handlers; foreign-key nullability across five models; the `if (models.RegistryCharacter)` runtime question; v1.59 §62.8's false-positive sweep.
- **Advanced, not discharged:** PE #62's overlap — live population derived at ten route-level syncs; **F-App-1 §12.11 not read.**
- Records: the seven-route `footage.js` surface (§63.1); the ruling and its three bounds (§63.2); the parent trace and its correction (§63.3); conditional associations as an idiom with a silent failure mode (§63.4); four unminted observations (§63.5); two method notes (§63.6).
- **Owes:** F-App-1 §12.11's eleven sites, for the PE #62 overlap; every depth outside §63.3's four models, all first-association-only; `references` on `StorytellerMemory`; whether `worldStudio.js:1838`-`:1859` is transactional; the three compound-predicate sites at §63.5, unread; **the reads slice, owed since v1.49 §52.6 and neither opened nor scoped.**
- Carries forward, unchanged from v1.59: the shape instances, unminted; XK-3's remedy and Gate 3's measurement; FD-62's remedy, unevaluated; XK-2's owed amendments; v1.51 §54.4's instrument question; §35.5's classes 2-6, unminted and homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`; the eleven-router collision surface and fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three unread write sites from v1.48; open items 22, 24, 6; `compositions.js:896`'s `authenticateJWT`, reported for F-AUTH-1; `SEED_WARDROBE` as JS-constants-as-canon; §60.6's five observations and their homing; §60.7's unexplained pathspec defect; all other items carried from v1.59. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: everything deferred at v1.59, unchanged.
- Forward-points: nothing new.
- Changes no unit disposition, no PR state, no gate.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod remains FROZEN.
- Additive-supersede on v1.59; no destructive rewrite.
- **Numeral disambiguation:** *§63* is unrelated to FD-63, PE #63, or open item 63. The **nineteen** ruled on at §63.2 are **v1.49's exclusion set**, not v1.55's identically-sized set — v1.58 §61.4 records that collision. **`:54` and `:66`** in `franchiseBrainRoutes.js` are a route declaration and a sync site respectively (§63.1). **§47.2 is v1.44's; §63.2 rules on it and does not amend it.**
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

**The register ruled on itself for the first time, and the finding was that there was nothing to follow.** v1.58 framed the exclusion inconsistency as two revisions disagreeing. Reading v1.44 §47.2 showed neither was wrong about a rule, because the rule was about *applicability* and had no accounting attached. **Two revisions improvised in opposite directions across six revisions of arithmetic, and the register carried both.**

**Zero is a stronger number than nineteen and a weaker claim.** The complement is exhausted because the nineteen were never in the class — not because anything about them is settled. **Nothing about them is settled.** They are five tables deep in an untransacted cascade at `worldStudio.js:1838` and nobody has looked, and the ruling explicitly does not license anyone to stop looking.

**One correction came out of tracing a single second parent.** `Asset` carries `show_id`, so `layers.js:407` had a one-hop path to tenancy and took a two-join path it also did not complete. v1.59 predicted the class of error and this is the first confirmed member. **Four models are now traced and every other depth in this register is still the depth of whichever association was read first** — which is a statement about the register's method, not about the code.

**The conditional-association idiom is the quiet one.** Four files wrap an association in a truth test, and all four currently resolve true. **A tenancy path that disappears without an error when a model fails to load is not a path**, and the register has been recording these as though the source guaranteed what the schema does.

**The reads slice is still owed, and it is still a program.** Two of its sites arrived today by accident, on a file already reported for having no authentication at all. **v1.49 §52.6 wrote the obligation down so it would be owed in the register rather than in someone's memory of a session.** Eleven revisions later it is still owed, and it is still written down.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-16. Main at `5f7ee6b4` (#1031). Predecessor: v1.59 (PR #1033, open). v1.58 also open at PR #1032.*
*Minted: §63. Ruled: excluded sites leave Rule 2's remainder; complement exhausted at zero. Corrected: `LayerAsset` depth (v1.58 §61.6); `franchiseBrainRoutes.js` sync line number (v1.58 §61.9). Closed: v1.59 §62.8's false-positive question. Read: five model files at their foreign keys, four at their tenancy columns, two register documents. No route file read. Mints no FD, no PE, no XK. Tail: FD-62. XK tail: XK-3. [skip-automerge]*
