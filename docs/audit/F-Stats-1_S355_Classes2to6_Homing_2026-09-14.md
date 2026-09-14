# F-Stats-1 §35.5 Classes 2–6 — Homing, Located

| | |
|---|---|
| **Basis** | `origin/main` at `900d6e16f57b3c2bb29cf79c65fa01bb800ae083`, 2026-09-13 (date of that commit; this read performed 2026-09-14). |
| **Type** | Standalone note. Mints nothing. Rules nothing. Recommends no homing option. Does not close the item. |
| **Standing** | MEASURED for every read performed in this document. Anything drawn from a predecessor document is labelled **carried** and cited to its source, never upgraded past that source's own standing. |
| **Scope** | `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 3 — "§35.5's classes 2–6 homing" — locate-and-record only. |

---

## §1. Locating §35.5 across the family

```
$ ls docs/audit | grep -E '^F-Stats-1_'
F-Stats-1_CharacterState_Canon_Verification_2026-06-08_DRAFT.md
F-Stats-1_Fix_Plan_v1.0.docx
F-Stats-1_Fix_Plan_v1.0.md
F-Stats-1_Fix_Plan_v1.1.docx
F-Stats-1_Fix_Plan_v1.1.md
F-Stats-1_Fix_Plan_v1.10.md
... (v1.2 through v1.60, one file per revision) ...
F-Stats-1_Fix_Plan_v1.60.md
F-Stats-1_PE62_Overlap_Location_2026-09-11.md
F-Stats-1_PhaseA_G1_Audit.docx
F-Stats-1_PhaseA_G1_Audit.md
F-Stats-1_PhaseB_G1_Planning.md
F-Stats-1_PhaseB_Gate_Reconciliation_2026-06-28.md
F-Stats-1_PhaseB_OwedScoping_2026-09-10.md
F-Stats-1_ShapeMint_Options_2026-09-10.md
F-Stats-1_StorytellerMemory_References_2026-09-10.md
F-Stats-1_Surface_Reverification_2026-07-21.md
F-Stats-1_WorldStudio_Transactionality_2026-09-10.md
```

```
$ grep -n '35\.5' docs/audit/F-Stats-1_*.md
```
Full output is long (34 hits across 12 files: v1.33, v1.34, v1.35, v1.41,
v1.44, v1.45, v1.46, v1.47, v1.48, v1.49, v1.50–v1.60's Register-hygiene
lines, and `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`). The hits relevant
to classes 2–6 specifically (as opposed to class 1, which has its own
homing history — see §2 below) are quoted where they matter in §3.

**§2. Supplier, not restaters — the distinction applied**

Per the supplied-at / last-restated method (`v25_Owed_Index_Amd8_2026-08-27.md`
§H4: *"Sec 3's source column names where a disposition last appears, not
what supplied it... One column cannot hold both"*), this document separates
**where §35.5's six classes were first stated, in their own words** from
**where later revisions only mention them**.

**Supplied at `F-Stats-1_Fix_Plan_v1.33.md` §35.5, "Findings recorded, none
minted."** That section's own closing line (v1.33:219) is explicit: *"Does
not mint any finding at §35.5, or assert reach beyond this file."* The six
classes' descriptive text — the words quoted per class in §3 below — appear
nowhere else in the family in that form. This is confirmed by
`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 3 (carried, cited below),
which independently names v1.33 as the minting revision via the same probe:

```
$ grep -l '§35\.5' docs/audit/F-Stats-1_Fix_Plan_v1.*.md | head -1
docs/audit/F-Stats-1_Fix_Plan_v1.33.md
```

**Every later hit for classes 2–6 specifically is a mention, not a
restatement, with one partial exception.** `F-Stats-1_Fix_Plan_v1.41.md`
§44.6 (v1.41:238–244) restates classes 2, 3, 5, and 6 by name and records
**new instances of each — still inside `worldEvents.js`** — but its own
text at v1.41:233–236 disclaims reach: *"No class is minted, no reach
beyond `worldEvents.js` is asserted, and no ownership is claimed... two
groups in one file is not establishment."* This is carriage of new
*instances*, not a restatement that changes the class's own words or its
homing status. Every other hit from v1.42 onward (v1.46:198, v1.46:225,
v1.46:271, v1.47:232, v1.47:257, and the "Carries forward" bullet
repeated verbatim in v1.48 through v1.60) names "classes 2–6" as a group
inside a longer carried-items list — a mention, per the mention-is-not-
carriage rule, not a restatement of any individual class's content.

---

## §3. Classes 2–6, quoted and dispositioned

All five quotes below are from the supplying revision's table,
`F-Stats-1_Fix_Plan_v1.33.md` lines 183–190 (`### §35.5 Findings recorded,
none minted`):

```
183	| # | Class | Instances | Homing status |
184	|---|---|---|---|
185	| 1 | Scope parameter as filter, not authorization boundary | 11 unscoped of 24 census sites; in-handler splits at 2697, 2776, 2219; bypass on fallback at 2626 | **OWED.** Not F-Stats-1. Not F-AUTH-1 as scoped — every handler declares `requireAuth` and passes every CP12 grep. |
186	| 2 | Soft-delete filter maintained by hand in raw queries | 7+ instances, 3 tables, in-handler split at 2697 | OWED. Mechanism differs from XK-1: the column exists and the query omits it. |
187	| 3 | Swallowing catch producing a fabricated result | 4 at 2278; 1 at 2219; counter-example at 2352 | OWED. |
188	| 4 | Parallel balance readers, none authoritative | 3 mechanisms: 2219, 2278, 3730 | OWED. Money path; adjacent to open item 6's carved assertions. |
189	| 5 | Denormalized JSON snapshot with no refresh path | `outfit_pieces` at 2697 | OWED. Same shape as the `canonical_description` copies already on the register. |
190	| 6 | Model-acquisition idiom drift | 3 idioms across 22 statements | Observation. Low severity. |
```

Class 1 is included above only for context (it is not this document's
subject — it was minted as **XK-2** at `F-Stats-1_Fix_Plan_v1.46.md` §49,
per that revision's Forward Statement: *"It has a number now. XK-2 — row-
scope not enforced in SQL"*). Classes 2–6 are this document's subject.

### Class 2 — "Soft-delete filter maintained by hand in raw queries"

> v1.33:186 — *"Soft-delete filter maintained by hand in raw queries | 7+
> instances, 3 tables, in-handler split at 2697 | OWED. Mechanism differs
> from XK-1: the column exists and the query omits it."*

New instances (still `worldEvents.js`-only) recorded at v1.41:241: *"5
further in-handler splits; 1109-vs-1307 divergence on one table."* No
revision establishes reach beyond `worldEvents.js`, mints a finding
number, or homes it to a keystone. **UNHOMED.**

### Class 3 — "Swallowing catch producing a fabricated result"

> v1.33:187 — *"Swallowing catch producing a fabricated result | 4 at
> 2278; 1 at 2219; counter-example at 2352 | OWED."*

New instances (still `worldEvents.js`-only) at v1.41:242: *"1149 (canon
write lost), 1214/1221 (approval no-op), 2178/2191 (incomplete canon row
echoed as complete), 1718, 1972."* No reach probe, mint, or homing
disposition in any later revision. **UNHOMED.**

### Class 4 — "Parallel balance readers, none authoritative"

> v1.33:188 — *"Parallel balance readers, none authoritative | 3
> mechanisms: 2219, 2278, 3730 | OWED. Money path; adjacent to open item
> 6's carved assertions."*

No later revision records a new instance of class 4 specifically — it is
absent from v1.41 §44.6's per-class instance table (which lists 1, 2, 3,
5, 6 but not 4) and absent from every subsequent revision's body text; it
survives only inside the "classes 2–6" group mention repeated in the
Register-hygiene "Carries forward" bullets from v1.46 onward. **UNHOMED**;
whether its instance count or reach has been re-examined since v1.33 is
**cannot-tell** from the family's text — the only evidence either way is
its absence from v1.41's per-class list, which is silence, not a
negative finding.

### Class 5 — "Denormalized JSON snapshot with no refresh path"

> v1.33:189 — *"Denormalized JSON snapshot with no refresh path |
> `outfit_pieces` at 2697 | OWED. Same shape as the `canonical_description`
> copies already on the register."*

A new instance (still `worldEvents.js`-only) at v1.41:243: *"1580
whole-JSONB read-modify-write, last-write-wins."* No reach probe, mint, or
homing disposition follows. **UNHOMED.**

### Class 6 — "Model-acquisition idiom drift"

> v1.33:190 — *"Model-acquisition idiom drift | 3 idioms across 22
> statements | Observation. Low severity."*

Note this class alone is recorded as an **Observation**, not `OWED`, at
its own supplying line — a disposition this document carries and does not
upgrade. A new instance (still `worldEvents.js`-only) at v1.41:244:
*"`getModels()` vs `req.app.get('models')` vs `require('../models')`
across both groups."* No later revision homes it or changes its
Observation standing. **UNHOMED** in the same sense as classes 2, 3, and
5 — no keystone or register entry claims it — while its own text
continues to mark it lower severity than the other four.

---

## §4. The citation path is the "Carries forward" bullet, not §63.5

`F-Stats-1_Fix_Plan_v1.60.md`'s Register-hygiene section carries this
item's text in its **`Carries forward:`** bullet (v1.60:200): *"...v1.51
§54.4's instrument question; §35.5's classes 2-6, unminted and homing-owed;
the class 2 candidate at `opportunityRoutes.js:258`..."* — **carried**,
cited to that file directly; this document does not independently re-walk
v1.60's own text beyond quoting the bullet already quoted by its source.

Per `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 3 (carried; that
document is the instrument that scoped this item and is cited, not
re-derived, here): *"'§35.5's classes 2-6, unminted and homing-owed' —
Register hygiene, `Carries forward:` bullet (**not** the `Owes:` bullet —
see divergence note)"* (`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:133–135`).
**This is the item's citation path** — the `Carries forward:` bullet, not
a §63.5 heading. This document does not assert that a `§63.5` exists or
does not exist in `v1.60`; it was not searched for, since the citation
path was already established by the carried source above and re-deriving
it was not this document's task.

---

## §5. Closing — what this document does and does not do

**Does:**
- Locate §35.5 in the F-Stats-1 family (§1).
- Identify the supplying revision (`v1.33` §35.5) and distinguish it from
  every later mention or partial restatement of new instances (§2).
- Quote each of classes 2–6 in the supplying revision's own words,
  line-numbered, and record a disposition — UNHOMED for classes 2, 3, and
  5; UNHOMED with a cannot-tell note on re-examination for class 4;
  UNHOMED (Observation-standing preserved) for class 6 (§3).
- Record the v1.60 citation path as the `Carries forward:` bullet, per
  the carried `OwedScoping` item 3 note (§4).

**Does not:**
- Mint any finding, FD, XK, or PE number.
- Rule anything, or resolve any of the five UNHOMED dispositions above.
- Recommend a homing option (F-Stats-1, F-AUTH-1, a new Cross-Keystone
  Register entry, or any other keystone) for any of classes 2–6.
- Close `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 3, or any part
  of it. **Only an F-Stats-1 Fix Plan revision closes it** — newest
  authority remains `v1.60`, unchanged by this document.
- Establish reach for any class beyond what the family's own text already
  records (`worldEvents.js`-only, per v1.33 and v1.41).
- Edit `v1.60` or any other filed document in `docs/audit/`, or add a
  banner to one.
- Touch `src/`, `frontend/`, `tests/`, or any workflow file.
- Make any host, AWS, database, or Cognito contact. **No live database
  contact. Prod FROZEN, untouched, not addressed by this document.**

---

*Type: standalone locate-and-record note. Rules: nothing. Mints: nothing.
Host/AWS/DB/Cognito contact: none. Prod FROZEN. [skip-automerge]*
