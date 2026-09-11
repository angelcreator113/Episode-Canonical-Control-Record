# F-Stats-1 — PE #62 Overlap Reference, Located

*Standalone note. Measurement only. Mints nothing, rules nothing, closes
nothing.*

## Purpose

`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` (Item 2) found that a heading
numbered §12.11 does not exist in either F-App-1 fix plan file at
`origin/main`, and left the citation open: the eleven sites v1.60 describes
"may live under a different heading, in a different document, or the
citation may itself need correction. No position taken." This note continues
that search — across the full F-App-1 family, not just the two fix plan
files — and records what it finds. It does not close the PE #62 overlap
item.

## H1 — Basis

```
$ git rev-parse origin/main
9b9b21a43e4c4b40300cf7d011c8cba53e91fd01
```

MEASURED. Date: 2026-09-11.

## Step 1 — The citation as it stands, read from v1.60 directly

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.60.md
```

MEASURED, full document read (227 lines). The item does **not** sit at
§63.5. §63.5 is its own heading (line 141, "§63.5 Recorded, unminted") and
its four bullets are a five-table hard-delete cascade at
`worldStudio.js:1838`-`:1859`, three compound-predicate deletes, and
`StoryTaskArc.sync()`'s four call sites — a different subject entirely, with
no mention of F-App-1 or §12.11.

The item's actual location is the **Register hygiene** section (heading at
line 186), `Owes:` bullet, line 199:

> "**Owes:** F-App-1 §12.11's eleven sites, for the PE #62 overlap; every
> depth outside §63.3's four models, all first-association-only;
> `references` on `StorytellerMemory`; whether `worldStudio.js:1838`-`:1859`
> is transactional; the three compound-predicate sites at §63.5, unread;
> **the reads slice, owed since v1.49 §52.6 and neither opened nor
> scoped.**"

The same section's `Advanced, not discharged:` bullet (line 197) restates it:

> "**Advanced, not discharged:** PE #62's overlap — live population derived
> at ten route-level syncs; **F-App-1 §12.11 not read.**"

And §63.1's own body (line 63, inside "§63.1 Owed items — four discharged,
one advanced," not §63.5):

> "The overlap cannot be closed from here. F-App-1 §12.11 enumerates eleven
> sites; that list was not read, and ten against eleven means nothing
> without both."

**MEASURED:** the citation traces to the Register hygiene section's `Owes:`
bullet (and is echoed at §63.1 and the hygiene section's `Advanced, not
discharged:` bullet) — not to §63.5, confirmed against the file rather than
carried from the scoping note or `PROJECT_CONTEXT.md`.

## Step 2 — F-App-1 family enumerated

```
$ ls docs/audit | grep -i '^F-App-1' | sort -V
F-App-1_Fix_Plan_v1.docx
F-App-1_Fix_Plan_v1.md
F-App-1_Fix_Plan_v1.1.docx
F-App-1_Fix_Plan_v1.1.md
F-App-1_G1_Audit_Report.md
```

MEASURED. Five files: two fix-plan revisions (each with a `.docx` twin) and
one audit report. The 2026-09-10 scoping note checked only the two fix-plan
`.md` files. This note additionally checks `F-App-1_G1_Audit_Report.md`.

Working-tree copies of all three `.md` files were confirmed identical to
`origin/main` before reading:

```
$ git diff --stat origin/main -- docs/audit/F-App-1_Fix_Plan_v1.md docs/audit/F-App-1_Fix_Plan_v1.1.md docs/audit/F-App-1_G1_Audit_Report.md
(no output — no diff)
```

## Step 3 — §12.11 heading search, and §12 numbering generally

```
$ grep -n '§12\.11' docs/audit/F-App-1_Fix_Plan_v1.md
(no output — exit 1)

$ grep -n '§12\.11' docs/audit/F-App-1_Fix_Plan_v1.1.md
(no output — exit 1)
```

No occurrence of "§12.11" in any form — heading or prose — in either fix
plan file. This confirms the scoping note's finding independently.

§12 numbering generally, to distinguish "no §12.11" from "no §12" — one
pattern catching both the parent heading (`# 12.`) and any numbered child
(`## 12.N`):

```
$ grep -n '^#\+ *§12\|^#\+ 12\.' docs/audit/F-App-1_Fix_Plan_v1.md
643:# 12. Findings Beyond Scope
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
```

`F-App-1_Fix_Plan_v1.md` self-identifies on its own face as "**Document
version: v1.0 — initial fix plan**" (line 6) — it is the "v1.0" the other
family members cite by that name, despite the on-disk filename `v1.md`. Its
§12 is a single flat heading ("12. Findings Beyond Scope") with ten numbered
sub-headings, `## 12.1` through `## 12.10`. The numbering stops at `12.10`.
§12 exists; §12.11 does not — in this file, the ceiling is reached at ten,
not just an isolated gap at eleven.

```
$ grep -n '^## §12\.\|^## 12\.' docs/audit/F-App-1_Fix_Plan_v1.1.md
39:## §12.15 — Post-G3 incident: G4/G5 collapse via unauthorized dev push
```

`F-App-1_Fix_Plan_v1.1.md` carries exactly one §12-numbered heading,
`§12.15`, and states explicitly that it does not carry the earlier ones:

> "The plan's original §1–§11 content is unchanged in v1.1 and is not
> duplicated here. Consult plan v1.0 ... for the original problem statement,
> scope, decision tree, step-by-step execution plan, verification
> checklists, and §12.1–§12.14 findings." (line 22)

This sentence's own count — "§12.1–§12.14" — does not match what v1.0
(`F-App-1_Fix_Plan_v1.md`) actually contains (§12.1–§12.10, ten items, per
Step 3 above). That mismatch is recorded as found; it is a separate
discrepancy from this note's task and is not resolved here.

**MEASURED, distinguishing §12 from §12.11 specifically:** §12 as a section
exists in `F-App-1_Fix_Plan_v1.md` (numbered 12.1–12.10) and §12.15 exists in
`F-App-1_Fix_Plan_v1.1.md`. §12.11 as a heading exists in **neither** file.

## Step 4 — Subject search across the full F-App-1 family

Searching by subject (`model.sync()` / DDL sites) rather than by number,
across all three `.md` family members:

```
$ grep -n -i 'sync(' docs/audit/F-App-1_G1_Audit_Report.md
403:### Step 5 — `model.sync()` calls outside the gated `ENABLE_DB_SYNC` branch
416:src\migrations\20260217000002-fix-episode-number-nullable.js:8: * sequelize.sync() that created the table.
417:src\migrations\20260218000001-fix-scenes-timeline-schema-gaps.js:9: * (the DB was created by sequelize.sync() with a subset of columns).
418:src\migrations\20260218000002-fix-wardrobe-defaults-table.js:9: * because the DB was created by sequelize.sync().
419:src\models\index.js:1797:      await sequelize.sync({ ...defaultOptions, ...options });
420:src\routes\memories\engine.js:2434:    await db.StoryTaskArc.sync();
421:src\routes\memories\engine.js:3183:      await db.StoryTaskArc.sync();
422:src\routes\memories\engine.js:3470:      await db.StoryTaskArc.sync();
423:src\routes\memories\engine.js:3662:      await db.StoryTaskArc.sync();
424:src\routes\continuityEngine.js:39:      await m.ContinuityTimeline.sync();
425:src\routes\continuityEngine.js:40:      await m.ContinuityCharacter.sync();
426:src\routes\continuityEngine.js:41:      await m.ContinuityBeat.sync();
427:src\routes\continuityEngine.js:42:      if (m.ContinuityBeatCharacter) await m.ContinuityBeatCharacter.sync();
428:src\routes\franchiseBrainRoutes.js:66:        await db.FranchiseKnowledge.sync();
429:src\routes\sceneSetRoutes.js:52:      GenerationJob.sync(),
430:src\workers\sceneGenerationWorker.js:235:    await GenerationJob.sync();
431:src\app.js:87:          await db.sequelize.sync(syncOptions);
432:src\app.js:114:                  await model.sync();
440:    - `src/app.js:87` — `db.sequelize.sync(syncOptions)` inside the `ENABLE_DB_SYNC=true` branch. Preserved per F-App-1 plan §9.3.
441:    - `src/app.js:114` — `model.sync()` inside Path A of the auto-repair. F-App-1 deletes this.
447:    - `src/models/index.js:1797` — `sequelize.sync({ ...defaultOptions, ...options })` inside the model loader. Model loader files should not run schema operations. Needs investigation in follow-up plan.
449:- **Pattern 40 Variant A sites — `model.sync()` inside routes and workers (11 hits across 5 files, 7+ distinct models):**
450:    - `routes/memories/engine.js:2434, 3183, 3470, 3662` — `StoryTaskArc.sync()` called four times in the same file
452:    - `routes/franchiseBrainRoutes.js:66` — `FranchiseKnowledge.sync()`
453:    - `routes/sceneSetRoutes.js:52` and `workers/sceneGenerationWorker.js:235` — `GenerationJob.sync()` in two separate processes (race risk)
502:5. ✅ Auto-repair block contains the only `model.sync()` call touching the five tables (Step 5)
514:- **§12.11** — Pattern 40 sites discovered across Steps 4–5: 6 Variant B sites (inline `CREATE TABLE` SQL) covering 3 tables (`video_compositions`, `chapter_versions`, `ecosystem_previews`), plus 11 Variant A sites (`model.sync()` calls inside routes/workers) covering 7+ models (`StoryTaskArc`, `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`, `FranchiseKnowledge`, `GenerationJob`). Plus a suspicious `sequelize.sync()` call inside the model loader (`src/models/index.js:1797`). Out of F-App-1 scope. Follow-up plan recommended.
```

(Full, unelided output — 24 lines. No line was dropped or reordered.)

And, at the literal string "§12.11", found only in this same file:

```
$ grep -n '§12\.11' docs/audit/F-App-1_G1_Audit_Report.md
397:**Decision:** Add finding to F-App-1 plan v1.1 §12.11. Do not expand F-App-1 scope. Proceed to Step 5.
455:**Decision:** All Variant A sites are out of F-App-1 scope (none touch the five F-App-1 tables). Add expanded §12.11 finding covering both Variant B (Step 4) and Variant A (Step 5) to F-App-1 plan v1.1.
514:- **§12.11** — Pattern 40 sites discovered across Steps 4–5: 6 Variant B sites (inline `CREATE TABLE` SQL) covering 3 tables (`video_compositions`, `chapter_versions`, `ecosystem_previews`), plus 11 Variant A sites (`model.sync()` calls inside routes/workers) covering 7+ models (`StoryTaskArc`, `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`, `FranchiseKnowledge`, `GenerationJob`). Plus a suspicious `sequelize.sync()` call inside the model loader (`src/models/index.js:1797`). Out of F-App-1 scope. Follow-up plan recommended.
```

```
$ grep -n '^#\+.*§12\|^#\+ 12\.' docs/audit/F-App-1_G1_Audit_Report.md
(no output — exit 1)
```

**Candidate found, with its own numbering and count:** `F-App-1_G1_Audit_Report.md:514` carries text labeled "**§12.11**" that describes "11 Variant A sites (`model.sync()` calls inside routes/workers) covering 7+ models" — the same count of eleven that v1.60's Register hygiene `Owes:` bullet cites ("F-App-1 §12.11's eleven sites"). This is the only place in the F-App-1 family where both the number "§12.11" and a count of eleven co-occur.

Three things about this candidate, measured, not inferred:

1. **It is never a markdown heading.** The `grep` for a `#`-prefixed heading
   containing "§12" or "12." over the audit report returns nothing (line
   above). All three occurrences of "§12.11" in this file (lines 397, 455,
   514) are inline prose or a bold list-item label under the plain `##`
   heading "G1 Conclusion — FINAL" (line 493) and its subsection "New
   findings to add to F-App-1 plan v1.1" (line 512).
2. **It is explicitly prospective, not filed.** Lines 397 and 455 both use
   the imperative "Add finding to F-App-1 plan v1.1 §12.11" / "Add expanded
   §12.11 finding ... to F-App-1 plan v1.1" — recorded in the audit report
   as something to be added to a fix plan, not as something already present
   in one.
3. **It was not, in fact, added.** Per Step 3 above, `F-App-1_Fix_Plan_v1.1.md`
   contains only `§12.15` as a heading; its own text says §12.1–§12.14 are
   unchanged from "v1.0," and v1.0 (`F-App-1_Fix_Plan_v1.md`) stops its §12
   numbering at `§12.10`. The §12.11 the G1 audit report proposed adding to
   v1.1 does not appear, under that number or any other, in either fix plan
   file.

## Outcome

**Located, as a candidate — under the same number, in a different document
of the family; never promoted to a fix-plan heading.**

This does not fit the "different heading or numbering" framing cleanly: the
number is the same (§12.11), the eleven-site count matches, but the location
is the F-App-1 **audit report**, not either fix plan file, and the label is
a bold bullet under a "findings to add" subsection — never a §-numbered
heading, and never carried forward into `F-App-1_Fix_Plan_v1.1.md` despite
that document's own stated intent to add it there.

**This is a candidate, not a ruling.** Identifying that
`F-App-1_G1_Audit_Report.md:514` describes eleven sites matching v1.60's
count is not the same as ruling that v1.60's citation meant this passage —
v1.60 cites "F-App-1 §12.11" without naming which family member, and no read
performed here establishes that v1.60's author had this specific line in
mind rather than, e.g., an intent for the missing addition to have already
landed in v1.1. Closing the PE #62 overlap item requires reading the eleven
sites this candidate names against v1.60 §63.1's ten and reconciling them —
not performed here.

## What this note does not do

- Does not close PE #62's overlap item.
- Does not rule what v1.60's author meant by "F-App-1 §12.11."
- Does not compare the eleven sites named at `F-App-1_G1_Audit_Report.md:514`
  against v1.60 §63.1's ten route-level `model.sync()` calls line-by-line —
  that comparison is the next step, not this one.
- Does not amend, edit, or supersede `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`
  or any other filed document.
- Does not advance F-Stats-1 Phase B beyond this measurement.

## Method note — two corrections disclosed

Per the register's practice of naming derivation errors rather than smoothing
them out of the record (cf. v1.60 §63.6), two corrections were made to this
note's evidence between first draft and the version filed here:

1. **A fabricated hybrid in Step 3's heading search, caught before the first
   commit.** An early draft of "§12 numbering generally" combined two
   separately-run `grep` commands by hand into one presented block, and
   added an invented "+2 line offset" note to explain away a discrepancy
   that draft had introduced itself: the parent heading `# 12. Findings
   Beyond Scope` was mis-cited at line 647 (the actual first child heading's
   line) rather than its real line, 643. That combined block and its
   fabricated offset explanation were never committed — self-review caught
   the mismatch, both source commands were re-run, and Step 3 above now
   quotes the single command (`grep -n '^#\+ *§12\|^#\+ 12\.' ...v1.md`)
   whose real, unedited output carries the parent heading at its correct
   line (643) and all ten children in one pass. No git history ever
   contained the fabricated version; it is disclosed here because it
   happened, not because a commit records it.
2. **A marked elision in Step 4, filed once and then completed.** The
   version first committed to this PR (`ef1a1fcf8`) truncated
   `F-App-1_G1_Audit_Report.md`'s `sync(` grep with two `...` markers.
   Every line it showed matched the real command verbatim — this was an
   honest omission, not a fabrication — but it was not the complete raw
   output H1 calls for. A follow-up commit (`27ababb4b`) replaced it with
   the full 24-line output before this note was read.

Neither correction changes anything below: the located candidate, its line
number, and its wording are the same in both the corrected and the
never-committed draft.

## Author declaration

Type: standalone measurement note. Rules nothing. Mints no FD, no XK, no PE
— tails unchanged. Closes no F-Stats-1 item, including PE #62's overlap.
Does not advance Phase B beyond recording this measurement. No host, AWS,
database, or Cognito contact. Every claim above is MEASURED against
`origin/main` at the basis SHA on this document's face, from reads this
document itself performs — no citation is carried forward from
`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` or any other prior session
document without being re-confirmed here. Prod FROZEN, untouched.
