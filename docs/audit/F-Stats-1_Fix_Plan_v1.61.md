# F-Stats-1 Fix Plan v1.61

*Additive-supersede on v1.60. Mints §64. Records Evoni's ruling closing Phase B item 1, the reads survey, on the five filed slices. Names one new owed item and one owed amendment. Mints no FD, no XK, no PE.*

## What changed in v1.61

**RULING (Evoni, 2026-09-27): Phase B item 1 closes on the five filed reads slices.** The ruling is quoted verbatim at §64.1 and is the only thing this revision rules. Every other clause is MEASURED from filed documents or ATTESTED from Evoni's own production queries, and says so.

**The survey closes on evidence, not on coverage.** Five route files were read (93 sites, **36 instances**). **76 files and 824 sites were not surveyed**, and this revision records them as *not surveyed*, not as clear. §64.4.

**The remedy leaves the survey and becomes its own owed item**: giving shows an owner and checking it on the request path, gated on the fix cycle ending and on Evoni's decision about multiple users. §64.4.

**One additive amendment is owed** to the calendarRoutes.js slice, for the `sourceLine` path its §0.2 did not check. §64.4.

**Phase B items 2–7 are unchanged.** §64.5.

---

## H1 — Basis

```
$ git rev-parse origin/main
d650b254d03ad442b560ad7a43c0e500a37c5414
```

MEASURED. Date: 2026-09-27. Every `file:line` below is at this SHA. The newest prior revision is v1.60; no revision has been filed since it:

```
$ ls docs/audit | grep -E '^F-Stats-1_Fix_Plan_v1\.(5[89]|6[0-9])\.md$'
F-Stats-1_Fix_Plan_v1.58.md
F-Stats-1_Fix_Plan_v1.59.md
F-Stats-1_Fix_Plan_v1.60.md
F-Stats-1_Fix_Plan_v1.61.md
```

---

## §64 — The reads survey, closed on five slices

### §64.1 RULING — Evoni, 2026-09-27

**RULED.** Adopted by Evoni in the review chat on 2026-09-27, verbatim:

> "F-Stats-1 Phase B item 1 closes on the five filed reads slices (36 instances). They establish the pattern: nothing on the request path supplies a tenant, and shows have no owner. The remaining files are not surveyed. The remedy, giving shows an owner and checking it on the request path, becomes a later item, gated on the fix cycle ending and on my decision about multiple users. An additive amendment to the calendarRoutes.js slice is owed for the sourceLine path it did not check."

**Nothing else in this revision is ruled.** The options this ruling chose among are set out, unranked, in `F-Stats-1_ReadsSurvey_Options_2026-09-27.md` §5 (PR #2059). The ruling takes the full survey's evidence as far as it was read (the five slices) and the structural option's remedy; the options document calls that combination by neither letter, and this revision does not name it one.

**On authority.** The scoping note recorded that closing the slice takes "the Fix Plan revision that rules on the slice" (`F-Stats-1_ReadsSlice_Scoping_2026-09-26.md:377`), and each slice repeats it ("Closing the reads slice still takes a Fix Plan revision"). This is that revision.

### §64.2 The evidence the ruling closes on — MEASURED

**The obligation.** v1.49 §52.6: "A reads slice over the same 120-file complement is owed." The 2026-09-10 note's Item 1: "To close: open and survey the read-handler population across the same route files Rule 2 already covers for writes" (`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:70–72`).

**The five filed slices**, each from its own §5:

```
$ for f in episodes calendarRoutes franchiseBrainRoutes upgradeRoutes memoriesCore; do printf "%s: " $f; grep -m1 -E '^\| \*\*Instances\*\*' docs/audit/F-Stats-1_ReadsSlice_${f}_2026-09-27.md; done
episodes: | **Instances** | **13** — #1, 2, 5, 7, 8, 9, 10, 11, 13, 15, 16, 18, 19 | **4** — R1–R4 | **17** |
calendarRoutes: | **Instances** | **6** — #6, 8, 10, 11, 14, 15 | 0 | **6** |
franchiseBrainRoutes: | **Instances** | **0** | 0 | **0** |
upgradeRoutes: | **Instances** | **1** — #2 (latent) | 0 | **1** |
memoriesCore: | **Instances** | **10** — #1, #2, #3, #5, #8, #11, #12, #13, #14, #15 | **2** — R1, R2 | **12** |
```

| File | Filed slice | Sites (probe + by reading) | Instances |
|---|---|---|---|
| `episodes.js` | `F-Stats-1_ReadsSlice_episodes_2026-09-27.md` | 19 + 4 | **17** |
| `calendarRoutes.js` | `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md` | 16 + 2 | **6** |
| `franchiseBrainRoutes.js` | `F-Stats-1_ReadsSlice_franchiseBrainRoutes_2026-09-27.md` | 16 + 1 | **0** |
| `upgradeRoutes.js` | `F-Stats-1_ReadsSlice_upgradeRoutes_2026-09-27.md` | 16 + 2 | **1**, latent |
| `memories/core.js` | `F-Stats-1_ReadsSlice_memoriesCore_2026-09-27.md` | 15 + 2 | **12** |
| **Five files** | | **82 + 11 = 93** | **36** |

**The common finding, in the slices' own words.** Every slice records condition 3 met at every site: "Nothing in the request path supplies a tenant."

```
$ grep -n -H "Nothing in the request path supplies a tenant" docs/audit/F-Stats-1_ReadsSlice_*_2026-09-27.md
docs/audit/F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md:54:Nothing in the request path supplies a tenant.
docs/audit/F-Stats-1_ReadsSlice_episodes_2026-09-27.md:98:Nothing in the request path supplies a tenant:
docs/audit/F-Stats-1_ReadsSlice_franchiseBrainRoutes_2026-09-27.md:41:Nothing in the request path supplies a tenant.
docs/audit/F-Stats-1_ReadsSlice_memoriesCore_2026-09-27.md:45:Nothing in the request path supplies a tenant.
docs/audit/F-Stats-1_ReadsSlice_upgradeRoutes_2026-09-27.md:43:Nothing in the request path supplies a tenant.
```

The episodes.js slice records the reason at the data model:

```
$ grep -n "Show. has no owner, user or account column" docs/audit/F-Stats-1_ReadsSlice_episodes_2026-09-27.md
114:- **The data model:** `Show` has no owner, user or account column, so there is
```

**The options document** (`F-Stats-1_ReadsSurvey_Options_2026-09-27.md`, PR #2059) measured what was not read and what a mechanical pre-sort could remove:

```
$ grep -n -E "^\| \*\*Remaining\*\*|^\| \*\*T2, code references\*\*|^- \*\*The registry:\*\*|^\*\*The pre-sort narrows little.\*\*" docs/audit/F-Stats-1_ReadsSurvey_Options_2026-09-27.md
106:| **Remaining** | **76** | **824** |
556:| **T2, code references** | **8 files, 44 sites** | **4 files, 25 sites** | **64 files, 755 sites** |
559:- **The registry:** 148 registered models; 100 carry a show (33 directly, 67
574:**The pre-sort narrows little.** At T2 it removes 8 files and 44 sites, about
```

- **Remaining, not surveyed:** 76 files, 824 probe sites, outside the four v1.44 §47.2 exclusions (147 sites, which stay excluded per v1.60 §63.2's applicability reading).
- **Pre-sort:** at its middle width, 8 files (44 sites) reach no show-carrying model, 4 (25 sites) cannot be sorted, and 64 (755 sites) reach at least one. It removes about 5% of the remaining sites. None of the five read files with instances sorts as show-less.

### §64.3 Carried facts — ATTESTED (Evoni, production, 2026-09-27)

Both queries were run by Evoni herself against the production database, read-only, outside any agent session. No agent session contacted a database. The host and credentials are not recorded.

**`upgradeRoutes.js`'s one instance is latent in production.** `storyteller_stories` has no `book_id` column there, so the read after the instance (`upgradeRoutes.js:57`) fails whenever it runs. Evoni's query and output, as recorded in the slice:

```
$ grep -n -E "ATTESTED for production \(Evoni|psql -W|^ column_name|\(0 rows\)" docs/audit/F-Stats-1_ReadsSlice_upgradeRoutes_2026-09-27.md
523:**ATTESTED for production (Evoni, 2026-09-27, pasted in the review chat).**
532:$ psql -W -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'storyteller_stories' AND column_name = 'book_id';"
534: column_name
536:(0 rows)
672:  `storyteller_stories.book_id` exists is ATTESTED for production (Evoni's
```

**The calendar's two own tables are empty in production.** Evoni's query and output, verbatim as given in the review chat (psql as `postgres`, read-only):

```
SELECT 'markers' t, count(*) n, count(series_id) with_series, count(*) FILTER (WHERE series_id IN (SELECT id FROM shows)) matching_shows FROM story_clock_markers UNION ALL SELECT 'events', count(*), count(series_id), count(*) FILTER (WHERE series_id IN (SELECT id FROM shows)) FROM story_calendar_events;
    t    | n | with_series | matching_shows
---------+---+-------------+----------------
 markers | 0 |           0 |              0
 events  | 0 |           0 |              0
(2 rows)
```

`story_clock_markers` and `story_calendar_events` held 0 rows. **Recorded as a fact about production on that date; it changes no classification.** The slices classify code, not data (`…_upgradeRoutes_…`: "The rule is applied to the code, not to database state").

### §64.4 Consequences — recorded

**Item 1 is CLOSED** on §64.1's ruling.

**The remaining files are NOT SURVEYED, and are not clear.** 76 files and 824 probe sites (§64.2) carry no classification of any kind. **No absence of instances is asserted for any of them.** The four v1.44 §47.2 exclusions remain excluded and are likewise unclassified.

**A new owed item: the shows-owner remedy.** Named here as **§64.4-R** so it has an address; not an FD, XK or PE.

- **What:** give shows an owner, and check it on the request path.
- **Gates (RULED, §64.1):** (1) the fix cycle ending; (2) Evoni's decision about multiple users. Until both hold, the item is owed and not startable.
- **Known dependencies (MEASURED from the options document §5 (C), not ruled here):**
  - an owner column on `shows` is a schema change, which the locked sequence's standing rule excludes during the fix cycle ("no feature additions, schema redesigns, or 'optimize later'", `PROJECT_CONTEXT.md` §6.1), and which reaches canon only by F-Deploy-1 v1.51's reconciliation path;
  - F-AUTH-1's Tier 4 public reads answer unauthenticated callers by design (for example `franchiseBrainRoutes.js`'s five `optionalAuth` GETs), so an owner check must say what applies there;
  - the four excluded files sit above shows (v1.44 §47.2), where an owner on shows does not reach.
- **What the options document records it cannot prove:** without a per-site survey, a fix is verified by its own tests, not against a site list, and a shared check can miss reads that bypass it (raw SQL, services, helpers). Recorded, not ruled.

**An owed amendment: `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md`, additive, for the `sourceLine` path.** The options document §4 records that `story_calendar_events` reaches a show through its `sourceLine` association (event → line → chapter → book → show), which the slice's §0.2 did not test, though its own Script 2 output lists `sourceLine`:

```
$ grep -n -E "series_id., a nullable|StoryCalendarEvent: show_id=false" docs/audit/F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md
95:partition column carry `series_id`, a nullable UUID. No foreign key, model
121:StoryCalendarEvent: show_id=false series_id=true associations=marker,attendees,ripples,sourceLine,location,spawnedEvents
435:StoryCalendarEvent: show_id=false series_id=true associations=marker,attendees,ripples,sourceLine,location,spawnedEvents
$ grep -n "StoryCalendarEvent" docs/audit/F-Stats-1_Fix_Plan_v1.60.md | head -2
106:| `StoryCalendarEvent` | `StorytellerLine`; `StoryClockMarker`; `WorldLocation` | `StorytellerLine` at 2 joins; other two **no** |
118:**`StoryCalendarEvent` has three parents and exactly one path.** v1.59 §62.3 recorded it as having three parents and no `show_id`, which is accurate and understated: **one parent reaches tenancy at two joins and two dead-end.** The instance classification is unchanged.
```

**v1.60 §63.3 had already traced the same path** ("`StoryCalendarEvent` has three parents and exactly one path"; "`StorytellerLine` at 2 joins"). The calendar slice did not cite it. The amendment is owed as an additive banner or amendment note, per the register's immutability rule; the slice is not edited. **What it would change is not asserted here**: the path exists for events with a `source_line_id` (the key is nullable per v1.60 §63.3's table), and §64.3 records that production held no events on 2026-09-27.

**Unchanged by this revision:** the write shape stands at **40 sites / 39 handlers / 20 files**, unminted (v1.60); v1.48 §51.5 option 3 stands. The 36 read instances are recorded in their slices and are not added to that total.

### §64.5 The other Phase B items — open, unchanged

The 2026-09-10 note itemizes seven owed items (`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` §"Itemization"):

```
$ grep -n -E "^### Item [0-9]" docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md
58:### Item 1 — Reads slice
78:### Item 2 — PE #62 overlap vs F-App-1 §12.11
131:### Item 3 — §35.5 classes 2–6 homing
160:### Item 4 — Second-shape mint decision
195:### Item 5 — StorytellerMemory references
215:### Item 6 — `worldStudio.js:1838`–`:1859` transactionality
253:### Item 7 — Three unread compound-predicate sites
```

Items 2–7 each have a standalone note filed since v1.60. **By its own statement each note either closes nothing or does not close its item (item 4's rules nothing and takes no option), and no Fix Plan revision has ruled on any of them:**

```
$ for f in PE62_Overlap_Location_2026-09-11 S355_Classes2to6_Homing_2026-09-14 ShapeMint_Options_2026-09-10 StorytellerMemory_References_2026-09-10 WorldStudio_Transactionality_2026-09-10 CompoundPredicates_Read_2026-09-16; do echo "$f: $(sed -n 1,8p docs/audit/F-Stats-1_$f.md | tr '\n' ' ' | grep -o -i -E '(closes nothing|does not close[^.|]*|takes no option|rules nothing)' | sort -u | paste -sd ';' -)"; done
PE62_Overlap_Location_2026-09-11: closes nothing;rules nothing
S355_Classes2to6_Homing_2026-09-14: Does not close the item;Rules nothing
ShapeMint_Options_2026-09-10: Takes no option;rules nothing
StorytellerMemory_References_2026-09-10: Does not close Item 5;rules nothing
WorldStudio_Transactionality_2026-09-10: Rules nothing;closes nothing
CompoundPredicates_Read_2026-09-16: closes nothing;rules nothing
```

| Item | Subject | Filed note | Status after v1.61 |
|---|---|---|---|
| 2 | PE #62 overlap vs F-App-1 §12.11 | `F-Stats-1_PE62_Overlap_Location_2026-09-11.md` | open, unchanged |
| 3 | §35.5 classes 2–6 homing | `F-Stats-1_S355_Classes2to6_Homing_2026-09-14.md` | open, unchanged |
| 4 | Second-shape mint decision (Evoni-ruled) | `F-Stats-1_ShapeMint_Options_2026-09-10.md` | open, unchanged |
| 5 | `StorytellerMemory` `references` | `F-Stats-1_StorytellerMemory_References_2026-09-10.md` | open, unchanged |
| 6 | `worldStudio.js:1838`–`:1859` transactionality | `F-Stats-1_WorldStudio_Transactionality_2026-09-10.md` | open, unchanged |
| 7 | Three unread compound-predicate sites | `F-Stats-1_CompoundPredicates_Read_2026-09-16.md` | open, unchanged |

**§64.1's ruling changes none of them.** In particular it does not take item 4's mint decision: the second shape stays unminted.

### §64.6 Read method

This revision read: `F-Stats-1_Fix_Plan_v1.60.md` (shape, §63.3, footer); `F-Stats-1_Fix_Plan_v1.49.md` §52.6; `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` (items); the reads scoping note; the five slices' §5 totals and the cited lines; the options document; the six item notes' own status lines. **No route file and no model file was read.** Every quoted command above was run at the basis; the two ATTESTED queries were Evoni's.

---

## What this revision does not do

- **Rules nothing beyond §64.1's quoted words.**
- **Mints no FD.** FD tail remains **FD-62**. Mints no XK; tail remains **XK-3**. Mints no PE. §64.4-R is an owed item's address, not a finding.
- **Does not assert any unread file clear.** The 76 remaining files and the four exclusions carry no classification.
- **Does not start the §64.4-R remedy**, waive the locked sequence's schema rule, or decide anything about multiple users.
- **Does not amend the calendarRoutes.js slice**; the amendment is owed, not written.
- Does not re-classify any site in any filed slice.
- Does not mint the second shape or add the 36 read instances to its total. v1.48 §51.5 option 3 stands.
- Does not rule, close or advance Phase B items 2–7.
- Does not edit v1.60 or any other filed document.
- **No live database contact by any agent session. No prod-box or dev-box contact.** Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

---

## §11 Plan Version History (UPDATED)

| v1.61 | 2026-09-27 | **RULES (Evoni): Phase B item 1 CLOSES on the five filed reads slices — 36 instances.** Ruling quoted verbatim at §64.1; nothing else ruled. **Evidence (MEASURED, §64.2):** `episodes.js` 17, `calendarRoutes.js` 6, `franchiseBrainRoutes.js` 0, `upgradeRoutes.js` 1 latent, `memories/core.js` 12 — 93 sites read; every slice records **"Nothing in the request path supplies a tenant"**, and the episodes.js slice records **`Show` has no owner, user or account column**. The options document (PR #2059) measured **76 files, 824 sites not surveyed** and a pre-sort that removes about 5% of them. **ATTESTED (§64.3, Evoni's own production queries, 2026-09-27):** `storyteller_stories` has no `book_id`, so `upgradeRoutes.js`'s instance is latent in production; `story_clock_markers` and `story_calendar_events` held **0 rows**. **Consequences (§64.4):** item 1 CLOSED; **the remaining files are NOT SURVEYED, not clear**; **§64.4-R owed** — an owner on shows, checked on the request path, **gated on the fix cycle ending and on Evoni's multi-user decision**, with its known dependencies (schema change under the locked sequence; F-AUTH-1 Tier 4 public reads; the excluded franchise files); **an additive amendment to the calendarRoutes.js slice owed** for the `sourceLine` path, which **v1.60 §63.3 had already traced**. **§64.5:** items 2–7 open, unchanged; item 4's mint decision not taken. Shape unchanged at 40 / 39 / 20, unminted. Mints no FD, no XK, no PE. No agent database contact. §64 minted. Basis `d650b254`. |

## Register hygiene

- **RULES** (§64.1, Evoni): Phase B item 1 closes on the five filed reads slices.
- **Mints no FD.** Tail: **FD-62**. Mints no XK; tail **XK-3**. Mints no PE.
- Mints: **§64**.
- **Closes:** Phase B item 1, the reads slice, owed since v1.49 §52.6.
- **Owes, new:** §64.4-R, the shows-owner remedy, gated twice; an additive amendment to `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md` for the `sourceLine` path.
- **Records:** 76 files and 824 sites as not surveyed, not clear; two ATTESTED production facts (§64.3).
- Carries forward, unchanged from v1.60: Phase B items 2–7; the shape instances, unminted; everything else v1.60 carried, except the reads slice, now closed.
- Changes no unit disposition, no instance classification, no shape total.
- Additive-supersede on v1.60; no destructive rewrite.
- **Numeral disambiguation:** *§64* is unrelated to FD-64, PE #64 or open item 64. **§64.4-R** is an address for an owed item, not a finding number. The **36** are read instances across five slices, not shape sites.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

**The reads slice was owed for twelve revisions and closes in one ruling, on five files.** It closes on what the five show, not on having read everything: nothing on the request path supplies a tenant, because a show has no owner to check. Reading the other seventy-six files would locate more instances of the same fact. The ruling takes the fact and moves to its remedy.

**The survey's end is not a clean bill.** Seventy-six files and 824 sites are recorded as not surveyed, and the register says so in those words. The remedy is gated behind the fix cycle and a product decision about users, so the unread files stay unread and the fact stays true until then.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `d650b254d03ad442b560ad7a43c0e500a37c5414`. Predecessor: v1.60.*
*Minted: §64. Ruled (Evoni): Phase B item 1 closes on the five filed reads slices. Owed: §64.4-R; the calendarRoutes.js slice amendment. Read: register documents only; no route or model file read. Mints no FD, no PE, no XK. Tail: FD-62. XK tail: XK-3. Task: #2060. [skip-automerge]*
