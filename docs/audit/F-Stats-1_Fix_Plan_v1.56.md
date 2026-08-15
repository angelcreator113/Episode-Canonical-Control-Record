# F-Stats-1 Fix Plan v1.56

*Additive-supersede on v1.55. Mints §59 and **FD-62**. Reads no new files. Changes no shape total.*

## What changed in v1.56

**FD-62 is minted.** The fourth sub-form recorded at v1.55 §58.3 — *predicate carries a
tenant term; the term is caller-supplied* — and its three instance applications are
lifted out of the unminted shape and given a register number.

**This is an ownership overlay, not a population change.** The shape stands where
v1.55 left it: **30 sites, 29 handlers, 11 files**, still unminted, unowned and
unnumbered as a whole. Rule 2's remaining population is **34**, unchanged. FD-62
cross-references three of the thirty. **It does not remove them and it does not add
to them.**

**Nothing else is minted, closed, or lifted.** No files were read for this revision.
Every fact below is carried from v1.55 §58 and re-cited, not re-derived.

**Why these three and not the other twenty-seven.** Two reasons, both recorded at
v1.55 and neither of them a count: the sites are **reachable destructive
cross-tenant writes**, and the sub-form **invalidates the instrument** that cleared
every predicate-shape-matched site in this pass. The first argues for ownership now.
The second does not become more accurate by reading thirty-four more sites.

**The shape's own mint question is not answered here.** v1.48 §51.5 option 3 stands
for the remaining twenty-seven. This revision splits one part off; it does not
resolve the rest.

---

## §59 — FD-62

### §59.1 The mint

> **FD-62 — A tenant term in a destructive predicate does not establish tenancy.**
>
> **Clause A (method).** A `where` clause naming a partition column establishes that
> the column is filtered on. It does not establish that the value filtered on was
> authorized. Where the value originates in the request body and is validated for
> presence only, the predicate is tenanted and the operation is not scoped.
> **Provenance must be read at the handler. It cannot be matched by pattern.**
>
> **Clause B (instances).** Three destructive handlers on main exhibit Clause A:
> `hairLibraryRoutes.js:194`, `makeupLibraryRoutes.js:192`, `wardrobe.js:859`.

**Register position.** FD tail advances **FD-61 → FD-62**. XK tail unchanged at
**XK-2**. FD-62 is minted by this Fix Plan revision, which is the only instrument
that mints FD numbers.

**Vehicle rationale.** FD, not XK. The defect class is Rule 2 tenancy scoping in
handler predicates, which is the active F-Stats-1 defect lens. File overlap with a
queued keystone does not by itself force cross-keystone classification.

### §59.2 Clause A — the method finding

The construction, identical at all three sites:

```
const { show_id, replace_existing = false } = req.body;
if (!show_id) return res.status(400).json({ error: 'show_id required' });
...
if (replace_existing) {
  await db.HairLibrary.destroy({ where: { show_id } });
}
```

**These sites pass every test this pass has applied.** A grep for a scope term in a
destructive predicate marks them clean. The column is correct. The value is
whatever the caller named.

**Third independent arrival.** Clause A is the same conclusion reached at §54.4 from
509 unauditable read sites, and at §55.6 from a model layer nobody had opened. §58.3
reached it from a predicate that names the right column and the wrong value. **Three
different surfaces, one conclusion:** a surface that cannot be read
handler-by-handler cannot be verified by pattern either.

**Consequence for every prior clearance in this pass.** Any site cleared on
predicate shape is **shape-cleared, not provenance-cleared.** This is not an
assertion that any such site is defective. It is a statement about what the
clearance established. **The distinction is recorded; the re-reading it implies is
not scheduled here and is not asserted to be owed in full.**

**Consequence for future automated passes.** An automated pass over this surface
must resolve the tenant's provenance, not its presence. Recorded at v1.55 §58.7
defect 2 and carried into the mint.

### §59.3 Clause B — the three sites

| Site | Route | Model | Tenant source | Blast radius |
|---|---|---|---|---|
| `hairLibraryRoutes.js:194` | `POST /hair-library/generate` | `HairLibrary` | `req.body.show_id` | named show's whole catalogue |
| `makeupLibraryRoutes.js:192` | `POST /makeup-library/generate` | `MakeupLibrary` | `req.body.show_id` | named show's whole catalogue |
| `wardrobe.js:859` | `POST /wardrobe/seed` | `Wardrobe` | `req.body.show_id` | named show's **seeded items only** |

**`wardrobe.js:859` is narrower and is recorded as such.** Its predicate also filters
`name` against the `SEED_WARDROBE` constants. A caller can wipe another show's
seeded items, not its whole catalogue. The operation is a seeder and re-seeding on
`clear_existing` is intended behaviour; **the defect is purely whose show is
re-seeded.**

**The two `/generate` handlers destroy canon and rebuild it from model output**, with
`JSON.parse` on the response as the only validation. Same destroy-then-regenerate
structure as `sceneSetRoutes.js:632`, without `force: true`. Carried from v1.55
§58.8, unminted there, now inside FD-62's instance record as a property of the
operation — **not as a separate finding.**

**A guard that reasons one step short.** Both `/generate` handlers check
`replace_existing` and 409 if the catalogue already holds four or more items, naming
the flag needed to override. **Someone reasoned carefully about accidental overwrite
and not at all about whose catalogue it is** — the `sceneSetRoutes.js:1006` shape in
a different dimension.

**The defect was duplicated at authorship, not drifted into.** The hair and makeup
files are near-identical: same structure, same guard, same gap, differing only in a
default `count` (8 vs 7) and their physical-descriptor fields.

### §59.4 Reachability — stated, not assessed

**On main, all three routes carry `requireAuth`**, consistent with all 30 shape
instances and both verified-scoped sites. FD-62 is therefore **authenticated
cross-tenant escalation** as the code reads on main: a caller authenticated against
one show can name another show's id.

**Three things are deliberately not claimed:**

1. **The deployed surface is not assessed.** Whether `origin/dev` and the running
   prod surface match main on these files is unestablished. PE #14 owns the
   `origin/main..origin/dev` divergence; per F-AUTH-1 v2.38 §1.2 per-file inspection
   is owed at Track G4. **FD-62 makes no claim about deployed behaviour.**
2. **F-AUTH-1 is not assessed.** Backend is CLOSED at CP12 per v2.38 §1.4; Tracks
   G3–G6 are open. FD-62 neither depends on nor comments on that disposition.
3. **Practical present exposure is not measured.** Structural reachability is a
   property of the handler. Whether any account population exists that could
   exercise it is a question this register has never measured and does not measure
   here. **The finding is structural. It is not downgraded by an unmeasured
   account population and it is not inflated by one.**

### §59.5 Ownership overlay — anti-double-count

> **Population unchanged; FD ownership overlay only; do not add +3 to shape totals.**

**The shape remains 30 sites / 29 handlers / 11 files.** The three FD-62 instances
are **cross-referenced ownership**, not a reassignment out of the population.

**Why the shape does not drop to 27.** The 30/29/11 figure is a population and yield
series running across v1.44–v1.55. Subtracting sites on the grounds that ownership
was later assigned would break time-series comparability and corrupt the yield
arithmetic retroactively. **A site's membership in the shape is a measurement fact.
Its ownership is a register fact. They are independent.**

**Reading rule for anyone reconciling totals.** Shape total 30 **includes**
`hairLibraryRoutes.js:194`, `makeupLibraryRoutes.js:192` and `wardrobe.js:859`.
FD-62 owns those three. **30 + 3 = 33 is wrong. The correct total is 30.**

### §59.6 Exposure inheritance — `wardrobe.js:859`

**`wardrobe.js` is a queued-keystone surface.** F-Ward-1 (episode_wardrobe migration)
and F-Ward-3 (plural outfit-set controller deletion) are both queued and both land on
wardrobe surfaces.

**`wardrobe.js:859` is marked exposure-inherited by the F-Ward-1 and F-Ward-3
remediation tracks.** Same notation class as v22 Sec 3's XK-1 exposure inheritance.

**This does not reclassify the finding vehicle.** FD-62 remains an F-Stats-1 register
entry. Inheritance records that a remediation track other than this one will touch
the site, so that whoever executes those tracks reads FD-62 before altering the
handler. **It transfers no ownership and creates no dependency in either direction.**

**No `F-Ward-*` artifact exists in `docs/audit/`** as of v22 Sec 3. The inheritance
notation has no document to point at yet and is recorded here so that it exists when
one is created.

### §59.7 Remedy — owed, unevaluated

**FD-62 proposes no remedy and evaluates none.** Consistent with v1.55: both shapes'
remedies remain UNEVALUATED.

**Minting is ownership, not resolution.** What FD-62 changes is that the three sites
are numbered, attributable, and citable by a remediation track. What it does not
change is that no fix has been designed, costed, or sequenced.

**Recorded as owed:** FD-62 remedy evaluation. Not scheduled here.

---

## What this revision does not do

- **Reads no files.** Every fact is carried from v1.55 §58 and re-cited.
- **Does not mint the shape.** The remaining twenty-seven sites are unminted,
  unowned, unnumbered. v1.48 §51.5 option 3 stands.
- **Does not change any total.** Shape 30/29/11; Rule 2 remainder 34.
- Does not read the remaining **34 destructive sites**; they are not asserted clean.
- Does not re-read or re-clear any site cleared on predicate shape in v1.44–v1.55.
  §59.2 records what those clearances established; it schedules nothing.
- Does not propose or evaluate a remedy for FD-62 or for either shape.
- Does not resolve the unexplained probe behaviour at v1.55 §58.7 defect 1.
- Does not amend XK-2's Cross-Keystone Register entry. **The Cross-Keystone Register
  is not modified.**
- Does not assess F-AUTH-1, `authenticateJWT`, PE #9, or PE #14.
- Does not assess the deployed surface on `origin/dev` or on prod.
- Does not measure the reads surface; v1.51 §54.4's instrument question stands.
- Does not disposition any statement or any file.
- Does not mint a PE or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.56 | 2026-08-15 | **Mints FD-62 — a tenant term in a destructive predicate does not establish tenancy.** Two clauses, one mint. **Clause A (method):** a `where` clause naming a partition column establishes that the column is filtered on, not that the value was authorized; where the value comes from `req.body` and is presence-validated only, the predicate is tenanted and the operation is unscoped — **provenance must be read at the handler, not matched by pattern.** Third independent arrival at §54.4's and §55.6's conclusion. Consequence recorded: every site cleared on predicate shape in v1.44–v1.55 is **shape-cleared, not provenance-cleared** — a statement about what the clearance established, **not** an assertion that any such site is defective, and no re-reading is scheduled. **Clause B (instances):** `hairLibraryRoutes.js:194`, `makeupLibraryRoutes.js:192`, `wardrobe.js:859`. Both `/generate` handlers take `show_id` from the body and on `replace_existing` delete that show's whole catalogue, rebuilding from model output with `JSON.parse` as sole validation; `wardrobe.js:859` is the same shape narrowed by a `name IN (SEED_WARDROBE)` filter, so the defect is purely whose show is re-seeded. Both `/generate` handlers 409 at four or more catalogue items — **careful reasoning about accidental overwrite, none about ownership.** Hair and makeup are near-identical, differing in a default count: **duplicated at authorship, not drifted.** **§59.4 reachability stated, not assessed:** all three carry `requireAuth` on main, so this is authenticated cross-tenant escalation as main reads; the deployed surface is **not** assessed (PE #14 owns the divergence, per-file inspection owed at Track G4), F-AUTH-1 is **not** assessed, and practical present exposure is **not** measured — the finding is structural and neither downgraded nor inflated by an unmeasured account population. **§59.5 ownership overlay:** *Population unchanged; FD ownership overlay only; do not add +3 to shape totals.* Shape stays **30 sites / 29 handlers / 11 files** and **includes** the three FD-62 sites; Rule 2 remainder **34**. Subtracting to 27 would break the v1.44–v1.55 population and yield series — **shape membership is a measurement fact, ownership is a register fact, and they are independent.** **§59.6:** `wardrobe.js:859` marked **exposure-inherited** by F-Ward-1 / F-Ward-3 remediation tracks, XK-1 notation class, **vehicle unchanged** — inheritance transfers no ownership and creates no dependency; no `F-Ward-*` artifact exists to point at. **§59.7:** remedy owed, **UNEVALUATED**; minting is ownership, not resolution. Reads no files. Closes nothing. Mints no PE, no XK. FD tail **FD-62**. XK tail XK-2. No live DB contact. Prod FROZEN, untouched. §59 minted. Basis `5c5fa08f`. |

## Register hygiene

- **Mints FD-62.** FD tail advances **FD-61 → FD-62**. First FD minted by F-Stats-1
  since v1.1; v1.1–v1.55 minted none.
- **XK tail: XK-2**, unchanged. Mints no XK, no PE.
- Mints: **§59**.
- Closes: **nothing**.
- **Changes no total.** Shape **30 / 29 / 11**, unchanged. Rule 2 remainder **34**,
  unchanged. **FD-62 is an ownership overlay; do not add +3.**
- Records: FD-62's two clauses (§59.1–§59.3); reachability stated and not assessed
  (§59.4); the anti-double-count reading rule (§59.5); `wardrobe.js:859`'s exposure
  inheritance by F-Ward-1 / F-Ward-3 (§59.6); remedy owed and unevaluated (§59.7).
- Carries forward, unchanged from v1.55: the twenty-seven remaining shape instances,
  unminted; **34 unread destructive sites**; XK-2's owed amendments; the reads
  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
  homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3
  instance report at `wardrobe.js:1233`; the eleven-router collision surface and
  fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three
  unread write sites from v1.48; tenancy paths owed from v1.53 and v1.54; open items
  22, 24, 6; `compositions.js:896`'s `authenticateJWT`, reported for F-AUTH-1 and
  not claimed; `SEED_WARDROBE` as JS-constants-as-canon, not adopted; all other items
  carried from v1.55. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: FD-62's remedy; all variants' homing; XK-2's ORM-surface extent, remedy and
  sequence position; classes 2–6's reach; §39.4 defect 1 and defect 3; §44.8; XK-1's
  remedy and population question; v1.55 §58.7 defect 1's unexplained null.
- Forward-points: nothing new.
- Changes no unit disposition, no PR state, no gate. **The Cross-Keystone Register is
  not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod remains
  FROZEN.
- Additive-supersede on v1.55; no destructive rewrite.
- **Numeral disambiguation:** *FD-62* is unrelated to §62 (does not exist), open item
  62, or **PE #62** (the boot-path inline DDL hazard at `src/server.js:146–164`). *§59*
  is minted in v1.56; section numbers and their minting revision numbers do not
  correspond. *XK-1 and XK-2* are unrelated to FD-1/FD-2.
  `F-Deploy-1_Fix_Plan_v1.31.md` and `F-Stats-1_Fix_Plan_v1.31.md` both exist; bare
  version numbers in this series require the keystone prefix.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

**Fifty-four revisions minted no finding, and this one mints a finding that reads no
files.** Both are the same discipline. The register does not mint on partial evidence,
and it does not withhold a number from evidence that is complete because the
surrounding population is not.

**What made these three separable was never the count.** It was that the sub-form
invalidates the instrument. A finding about the count gets more accurate as the
population closes. A finding about the method does not — it gets more expensive to
retrofit, because every clearance issued under the old method inherits the doubt the
moment it is recorded and not before.

**The three sites are the cheaper half of the mint.** They are reachable destructive
cross-tenant writes and they were sitting unowned, which meant no remediation track
could cite them and no gate could reference them. That is now fixed by a number and
nothing else. **No remedy is designed. Nothing is safer than it was yesterday.**

**Twenty-seven remain unminted and thirty-four remain unread.** The shape's own mint
question is exactly where v1.48 §51.5 left it. This revision took one part off the
top; it did not answer the rest, and the falling marginal yield that argues for
finishing the pass argues for it just as strongly today as it did at v1.55.

**Clause A's uncomfortable consequence is stated and left standing.** Every
predicate-shape clearance in this pass is now known to have established less than it
appeared to. **Nothing is scheduled against that**, because scheduling it would be a
decision about the pass's remaining shape, and this revision does not make one.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `5c5fa08f` (#1029). Predecessor: v1.55.*
*Minted: §59, **FD-62**. Read: no files. Closed: nothing. Mints no PE, no XK. Tail: **FD-62**. XK tail: XK-2. [skip-automerge]*
