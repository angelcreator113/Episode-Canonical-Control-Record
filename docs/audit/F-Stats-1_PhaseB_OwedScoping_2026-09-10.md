# F-Stats-1 Phase B — Owed Items Scoping (v1.60)

*Standalone note. Measurement only. Mints nothing, rules nothing, fixes
nothing.*

## Purpose

`PROJECT_CONTEXT.md` §6.5 carries a seven-item "F-Stats-1 owed" list sourced
to `v1.60 §63.5`. Per §8, prose in `PROJECT_CONTEXT.md` describing another
document is never itself authority. This note reads `F-Stats-1_Fix_Plan_v1.60.md`
directly at `origin/main`, quotes what it actually says in its own words, and
itemizes what each owed item would take to close — without closing any of
them.

## H1 — Basis

```
$ git rev-parse origin/main
744e7ec1612402e0831f96ca26538b71e4bb593e
```

MEASURED. Date: 2026-09-10.

## Newest F-Stats-1 authority — confirmed by numeric scan

```
$ ls docs/audit | grep -E '^F-Stats-1_Fix_Plan_v[0-9.]+\.md$' \
  | sed -E 's/^F-Stats-1_Fix_Plan_v([0-9]+)\.([0-9]+)\.md$/\1.\2 &/' \
  | sort -t. -k1,1n -k2,2n | tail -3
1.58 F-Stats-1_Fix_Plan_v1.58.md
1.59 F-Stats-1_Fix_Plan_v1.59.md
1.60 F-Stats-1_Fix_Plan_v1.60.md
```

A field-numeric sort (major, then minor, not lexical — lexical would rank
`v1.6` above `v1.60`) confirms `v1.60` as the newest F-Stats-1 Fix Plan
revision on `origin/main`. MEASURED. No later revision exists in the repo.

## §63.5 read at origin/main

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.60.md
```

MEASURED, full document read. `§63.5` itself is titled **"Recorded,
unminted"** and its own text (lines 141–148) contains exactly four bullets,
none of them the seven-item list §6.5 attributes to it. The seven-item list
in fact draws from two *other* locations in the same document — the
**Register hygiene** section's `Owes:` bullet, and its `Carries forward:`
bullet. This is recorded as a divergence below (see "§6.5 vs v1.60,
divergence").

## Itemization — the seven owed items, quoted and scoped

Each quote is v1.60's own words, under 15 words, with its actual location in
the document (not assumed to be §63.5 just because §6.5 says so).

### Item 1 — Reads slice

> "the reads slice, owed since v1.49 §52.6 and neither opened nor scoped"
> — Register hygiene, `Owes:` bullet

Also: "the reads slice remains unopened and unscoped" (§63.1); "Does not
open, scope, or survey the reads slice" (What this revision does not do).

**Names:** no specific file; a census program parallel to Rule 2's
destructive-write census, but over read handlers, first recorded owed at
v1.49 §52.6 (not itself re-read here — out of scope for this pass).

**To close:** open and survey the read-handler population across the same
route files Rule 2 already covers for writes — a repo grep/read exercise,
no live system contact.

**MARK: AGENT-DOABLE.** Basis: closing it is enumerating and reading route
files already in the repo; nothing in the item's own text names a host, DB,
or ruling as a precondition.

### Item 2 — PE #62 overlap vs F-App-1 §12.11

> "F-App-1 §12.11's eleven sites, for the PE #62 overlap"
> — Register hygiene, `Owes:` bullet

Also §63.1: "The overlap cannot be closed from here. F-App-1 §12.11
enumerates eleven sites; that list was not read."

**Names:** `F-App-1_Fix_Plan` §12.11 (eleven `model.sync()`/DDL sites, per
v1.60's own description), to be compared against v1.60 §63.1's ten
route-level `model.sync()` calls.

**Locations checked at `origin/main`:**

```
$ ls docs/audit | grep -iE '^F-App-1'
F-App-1_Fix_Plan_v1.1.docx
F-App-1_Fix_Plan_v1.1.md
F-App-1_Fix_Plan_v1.docx
F-App-1_Fix_Plan_v1.md
F-App-1_G1_Audit_Report.md

$ grep -n '^## 12\.' docs/audit/F-App-1_Fix_Plan_v1.md
647:## 12.1 — v8 line range for F-App-1 is stale
651:## 12.2 — `character_state` UNIQUE constraint covers wrong rows
655:## 12.3 — Singular `decision_log` vs plural `decision_logs` split
659:## 12.4 — Auto-repair is a third schema variant, not a stale snapshot
663:## 12.5 — Multi-table migrations defeat single-table tracing
667:## 12.6 — `career_goals` has structural name drift, not just column drift
671:## 12.7 — `bootstrap-sequelize-meta.js` existence implies dev RDS schema regression history
675:## 12.8 — Auto-repair is actively manufacturing new drift
679:## 12.9 — `character_state_history.evaluation_id` column is migration-only
683:## 12.10 — `character_state_history` uses ENUM type that auto-repair downgrades to VARCHAR

$ grep -n '^## §12\.\|^## 12\.' docs/audit/F-App-1_Fix_Plan_v1.1.md
39:## §12.15 — Post-G3 incident: G4/G5 collapse via unauthorized dev push
```

MEASURED: `F-App-1_Fix_Plan_v1.md`'s §12 numbering runs 12.1–12.10;
`F-App-1_Fix_Plan_v1.1.md` (additive-supersede on v1.md) adds only §12.15.
No heading numbered §12.11 exists in either file at `origin/main`. This is
recorded as found; it is not resolved here — the eleven sites v1.60
describes may live under a different heading, in a different document, or
the citation may itself need correction. No position taken.

**To close:** locate the eleven sites F-App-1 actually enumerates (heading
number as cited was not found), read them, and compare against v1.60
§63.1's ten. Repo-only.

**MARK: AGENT-DOABLE**, with the located-heading caveat above. Basis: both
documents are in-repo; no host/DB/ruling is named as a precondition, but the
named section could not be confirmed to exist under that number.

### Item 3 — §35.5 classes 2–6 homing

> "§35.5's classes 2-6, unminted and homing-owed"
> — Register hygiene, `Carries forward:` bullet (**not** the `Owes:` bullet
> — see divergence note)

**Names:** `worldEvents.js`, per §35.5's own text at the revision that
minted it (`F-Stats-1_Fix_Plan_v1.33.md`):

```
$ grep -l '§35\.5' docs/audit/F-Stats-1_Fix_Plan_v1.*.md | head -1
docs/audit/F-Stats-1_Fix_Plan_v1.33.md
```

v1.33 §35.5 ("Findings recorded, none minted") records six classes found
**within `worldEvents.js` only**, states "no established reach beyond it,"
and its own closing line reads: "Establishing reach requires a probe across
route files, which is not attempted here." Classes 2–6 are marked `OWED`
(class 6 is "Observation. Low severity," not `OWED` like 2–5); class 1 is
marked "Not F-Stats-1."

**To close:** run the cross-route-file probe §35.5 itself names as
unattempted, for classes 2–6, to establish or bound reach beyond
`worldEvents.js`. Repo-only.

**MARK: AGENT-DOABLE.** Basis: v1.33's own text names the missing step as
"a probe across route files" — a repo grep/read exercise, no host/DB/ruling
named.

### Item 4 — Second-shape mint decision

> "Shape stands at 40 / 39 / 20, unminted; v1.48 §51.5 option 3 stands"
> — Register hygiene bullet; also "the shape instances, unminted" (`Carries
> forward:` bullet)

**The phrase "second-shape mint decision" does not appear anywhere in
v1.60**, verbatim or near-verbatim (checked: `grep -n
"second-shape\|second shape" v1.60.md` returns no match). §6.5's label is
PROJECT_CONTEXT.md's own paraphrase, not the plan's wording — flagged as a
divergence, not corrected here (see below).

**Names:** no file; a register-level decision on whether to mint the 40
sites / 39 handlers / 20 files shape total, per v1.48 §51.5's option 3
(not re-read here — out of scope for this pass).

**To close:** requires a decision on whether and how to mint the shape —
this is not a repo read, it is a ruling on how the register should treat an
already-measured total.

**MARK: EVONI-RULED.** Basis: not §6.5's "Evoni rules" parenthetical — this
note's own sourcing rule declines to treat that prose as authority, so it
cannot supply the basis for a mark either. **v1.60 itself does not name who
or what gates this decision**; it states only that the shape "stands...
unminted" and that "v1.48 §51.5 option 3 stands," neither of which says a
ruling is required or by whom. What v1.60 *does* establish, in its own
words, is what minting requires in this register: "a Fix Plan revision is
the instrument that rules in this register" (§63.2, "On authority"), used
there "for the first time on F-Stats-1's own accounting." Minting the shape
total is exactly that kind of accounting decision — and this note is
explicitly barred from being that instrument ("Mint no FD, PE, or XK. Do
not rule the second-shape mint decision or any other item," per this
issue's own scope). So the mark stands on v1.60's own account of how the
register rules on itself, not on §6.5's naming of who does it.

### Item 5 — StorytellerMemory references

> "Two models declare `references` and two do not... Recorded, not
> assessed."
> — §63.1

**Names:** `StorytellerMemory`'s two foreign keys (`line_id`,
`character_id`); v1.60 §63.1 records both as `allowNull: true` and their
`references` declarations as "not read." The comparison set is `Layer` and
`LayerAsset` (declare `references`) versus `Scene` and `SceneFootageLink`
(do not), per §63.1's table.

**To close:** read `StorytellerMemory`'s model file for `references`
declarations on its two foreign keys, matching the method already applied
to the other four models in §63.1's table. Repo-only.

**MARK: AGENT-DOABLE.** Basis: identical method to what §63.1 already
performed on four sibling models — a model-file read, no host/DB/ruling
named.

### Item 6 — `worldStudio.js:1838`–`:1859` transactionality

> "No transaction is visible in the surrounding lines, which were not
> read."
> — §63.5 (the section's actual text — this item is the one genuinely
> sourced there)

**Names:** `worldStudio.js:1838`–`:1859`. Read at `origin/main`:

```
$ git show origin/main:src/routes/worldStudio.js | sed -n '1828,1869p'
```

Line 1829 declares `router.delete('/world/characters/:id', requireAuth,
async (req, res) => {`. Lines 1838–1859 (five sequential raw
`sequelize.query(... DELETE ...)` calls against `character_relationships`,
`registry_characters`, `intimate_scenes`, `character_relationships_extended`,
and `world_characters`) each carry an independent `.catch(e =>
console.warn(...))` — no `sequelize.transaction()`, `BEGIN`, or shared
transaction object appears anywhere in the handler body as read (lines
1829–1861, the full route declaration through its closing `});`).

**MEASURED, within the handler body only** — v1.60's own text scopes its
claim to "the surrounding lines, which were not read," and this pass read
only the handler itself, not files or functions it might call into (e.g.
`Q()`, `sequelize`) that could theoretically wrap a transaction elsewhere.
No claim is made beyond what the lines show.

**To close (assess, not just read):** confirm no transaction wrapper exists
in `Q()` or any shared helper the handler calls, and reach a disposition on
whether the cascade is safe. The read itself (above) is repo-only; a full
transactionality assessment is also repo-only, provided no live DB
reproduction is required to characterize the risk.

**MARK: AGENT-DOABLE.** Basis: nothing in v1.60's description of this item
names a host, DB, or ruling as a precondition — it names unread lines,
which are in the repo.

### Item 7 — Three unread compound-predicate sites

> "the three compound-predicate sites at §63.5, unread"
> — Register hygiene, `Owes:` bullet (§63.5 itself: "No claim is made about
> them; they are unread.")

**Names:** `worldEvents.js:570`, `worldEvents.js:1973`,
`worldStudio.js:3121`. Read at `origin/main`:

```
$ git show origin/main:src/routes/worldEvents.js | grep -n \
  "DELETE FROM world_events WHERE id"
570:        `DELETE FROM world_events WHERE id = :eventId AND show_id = :showId`,
1973:            'DELETE FROM world_events WHERE id = :id AND show_id = :showId',

$ git show origin/main:src/routes/worldStudio.js | sed -n '3110,3125p'
```

- **`worldEvents.js:570`** — inside a try/catch soft-delete-then-hard-delete
  fallback (`UPDATE ... SET deleted_at = NOW() ... WHERE id = :eventId AND
  show_id = :showId`, falling back on error to the cited `DELETE`). Compound
  predicate confirmed present, line number confirmed exact.
- **`worldEvents.js:1973`** — inside a per-id loop (`for (const id of
  ids)`), each iteration wrapped in its own try/catch with a swallowing
  `catch { /* skip */ }`. Compound predicate confirmed present, line number
  confirmed exact.
- **`worldStudio.js:3121`** — inside `router.delete('/world/characters/:id/relationships/:relId'`
  (declared at `:3110`), `DELETE FROM character_relationships_extended
  WHERE id = :relId AND character_id = :cid`. Compound predicate confirmed
  present, line number confirmed exact.

All three line numbers cited in v1.60 match the current `origin/main` tree
exactly — no drift. **No claim is made about the tenancy-check correctness
of any of the three** — reading confirms what is at the location; it does
not assess it, matching v1.60's own scope for this item.

**MARK: AGENT-DOABLE.** Basis: three specific file:line locations, already
in the repo, read above without host/DB contact.

## §6.5 vs v1.60, divergence (recorded, not resolved)

`PROJECT_CONTEXT.md` §6.5 attributes all seven items to a single source,
`v1.60 §63.5`. Reading v1.60 directly shows:

- **§63.5 itself** (the section, lines 141–148) contains four bullets: the
  `worldStudio.js:1838`–`:1859` cascade, the three compound-predicate sites,
  the ten `model.sync()` sites, and `StoryTaskArc.sync()`'s four sites in
  one file. Of the seven items in §6.5's list, **only Item 6 and Item 7**
  draw their content from this section's own text.
- **Items 1, 2, 5** (reads slice; PE #62 vs F-App-1 §12.11; StorytellerMemory
  references) trace instead to the **Register hygiene** section's `Owes:`
  bullet — a different location in the same document.
- **Item 3** (§35.5 classes 2–6 homing) traces to the **Carries forward**
  bullet, not `Owes:` and not §63.5.
- **Item 4** (second-shape mint decision) does not appear verbatim or
  near-verbatim anywhere in v1.60; its nearest textual basis is "Shape
  stands at 40 / 39 / 20, unminted; v1.48 §51.5 option 3 stands," which
  does not use the phrase "second-shape" or "mint decision."

This is recorded as a fact about where §6.5's paraphrase points versus
where v1.60's own text actually sits. **No position is taken on whether
§6.5's seven-item list is wrong** — every item it names is genuinely owed
per v1.60, just not uniformly at the citation given.

## What this note does not do

- Does not open, scope, or survey the reads slice.
- Does not read F-App-1's eleven sites or compare them against v1.60's ten.
- Does not run the §35.5 cross-route-file reach probe.
- Does not rule the second-shape mint decision, or take a position on it.
- Does not read `StorytellerMemory`'s `references` declarations.
- Does not assess whether `worldStudio.js:1838`–`:1859` is transactional
  beyond what the handler body itself shows; does not read `Q()` or any
  shared helper.
- Does not assess the tenancy-check correctness of `worldEvents.js:570`,
  `:1973`, or `worldStudio.js:3121`.
- Proposes no order of work and no remedy.
- Mints no FD, XK, or PE.
- Does not resolve the §6.5-vs-v1.60 divergence recorded above.
- No live database contact. No prod-box contact. No dev-box contact. No
  AWS, Cognito, or GitHub-settings contact.

## Footer

**Type:** standalone scoping note. **Rules:** nothing. **Mints:** nothing —
no FD, no XK, no PE. **Host/AWS/DB contact:** none. **Prod FROZEN**,
untouched.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-10. Basis: `origin/main` at `744e7ec1612402e0831f96ca26538b71e4bb593e`.*
*Authority: `F-Stats-1_Fix_Plan_v1.60.md`, read directly, MEASURED. `PROJECT_CONTEXT.md`
§6.5 is prose about that document, not authority, per §8; its seven-item list is
recorded and located against v1.60's own text, with one divergence noted and left
unresolved.*
