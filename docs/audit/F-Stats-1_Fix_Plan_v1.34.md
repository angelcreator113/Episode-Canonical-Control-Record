# F-Stats-1 Fix Plan v1.34

| | |
|---|---|
| **Predecessor** | v1.33 (`101cac3d`, #1006). |
| **Basis** | `c4782084`. |
| **Author date** | 2026-08-10 |
| **Gate effect** | v1.33 §35.3 is CORRECTED: the read census understated both counts, and the write surface was never measured. Corrected figures: 29 reads (16 scoped / 13 unscoped), 20 writes (7 scoped / 10 unscoped id-keyed / 2 show-only / 1 episode-keyed). §35.5 finding class 1's severity is RESTATED as write-side. v1.33's Appendix A is superseded as an exhibit. No group disposition changes. No fix evaluated, no gate lifted, no FD minted. Tail unchanged at FD-61. |

## What changed in v1.34

- **v1.33 §35.3's counts are corrected.** 13 scoped / 11 unscoped becomes
	**16 scoped / 13 unscoped**. Cause: the probe keyed on `LIMIT\s*1`. See §36.1.
- **The write surface is measured for the first time.** Twenty raw writes against
	`world_events`; ten are unscoped, two of those to `canon_consequences`. v1.33
	measured no writes at all. See §36.2.
- **§35.5 finding class 1 is RESTATED.** Its severity is write-side, not
	read-side. The class itself is unchanged and remains unminted. See §36.3.
- **v1.33's Appendix A is superseded as an exhibit**, not deleted. See §36.4.
- **v1.33 is not otherwise disturbed.** Five group dispositions, §28's
	confirmations, the §35.4 Venue/social count defect, the §35.6 `character_key`
	cross-reference, and finding classes 2–6 all stand unchanged.
- **§36 minted:** the correction record.
- **Deliberately out of scope:** Episode generation and Invitations remain
	undispositioned. Open item 36, carried. XK-1's remedy and the XK-1 population
	question, both still deferred.

## §36 — correction to v1.33 §35.3

### §36.1 What v1.33 stated, and why it was wrong

v1.33 §35.3 states, at lines 145–149 of the merged artifact:

| | v1.33 | Correct |
|---|---|---|
| `world_events` lookups scoped `AND show_id = :showId` | 13 | **16** |
| `world_events` lookups by `id` alone | 11 | **13** |

**The probe was keyed on `LIMIT\s*1`.** That is a syntactic accident of how a
query is written, not a property of the access. It excludes every read without a
`LIMIT` clause, and — as §36.2 shows — it excludes every write.

Three scoped reads were invisible to it: **570** (a `DELETE`), **600**, **767**.
One unscoped read was likewise invisible: **531**, a `SELECT *` with neither
`LIMIT` nor scope.

One further site, **1081**, appeared in v1.33's Appendix A listing but was
omitted from both site lists in §35.3's prose. That is a transcription error at
the point where the appendix was split into the two lists, not a probe defect.

**Corrected read census — 29 sites.**

Scoped: 570, 600, 767, 1702, 1897, 1916, 2364, 2373, 2569, 2637, 2886, 3052,
3169, 3260, 3417, 3765.

Unscoped: 493, 531, 1081, 1103, 1207, 1424, 1527, 1665, 2226, 2259, 2681, 2709,
2783.

**Completeness check.** A whitespace-tolerant match across joined lines
(`FROM\s+world_events\s+WHERE\s+id\s*=\s*:eventId`) returns 29, identical to the
literal single-line match. **No multi-line lookup escapes the probe.** v1.33
performed no such check.

### §36.2 The write surface — measured for the first time

v1.33 measured reads only. The probe's `LIMIT` dependency made this structurally
inevitable: no `UPDATE` or `DELETE` carries a `LIMIT` clause in this file.

Probe: `(UPDATE|DELETE FROM) world_events`. Twenty sites.

| Class | Count | Sites |
|---|---|---|
| Scoped `AND show_id = :showId` | 7 | 458, 501, 518, 565, 570, 1973, 3466 |
| Unscoped, `id`-keyed | 10 | 659, 664, 709, 1150, 1230, 1670, 1838, 1910, 2764, 3096 |
| Show-scoped, no `id` (mass delete) | 2 | 1957, 1964 |
| Episode-keyed, unscoped | 1 | 3334 |

Three sites required individual inspection rather than line-matching: **1150**
(multi-line `jsonb_set`, confirmed unscoped), **3334** (keyed on
`used_in_episode_id`, not an id lookup), **1081** (single-line, confirmed
unscoped, per §36.1).

**Ten unscoped writes.** Holding only an event id, an authenticated caller may
mark an event used (659, 664, 1838), clear its episode link (1910), attach a
scene set (709), set or clear its invitation asset (1230, 1670), overwrite its
outfit and score (2764), and **rewrite `canon_consequences` (1150, 3096)**.

`canon_consequences` is canon state. Both writes to it are unscoped.

**The destructive operations are the ones that carry the check.** 565
soft-deletes and 570 hard-deletes, both `AND show_id = :showId`. 1973's targeted
delete is scoped. 1957 and 1964 are show-scoped mass deletes. Scoping was
applied where deletion made the risk legible and omitted from routine mutation.

**Total: 49 raw access sites against one table in one file.** Reads split near
evenly, 16 to 13. Writes run 7 scoped against 10 unscoped, plus 3 keyed
otherwise.

### §36.3 §35.5 finding class 1 — severity restated

v1.33 §35.5 records finding class 1 as *scope parameter as filter, not
authorization boundary*, with instance evidence drawn entirely from reads.

**The class is unchanged. Its severity is restated.**

The read finding is cross-show information disclosure. The write finding is
cross-show mutation, including of canon state. These are not the same
consequence, and v1.33's evidence supported only the first.

Restated instance record:

> Reads: 13 unscoped of 29. **Writes: 10 unscoped of 20, including two to
> `canon_consequences`.** In-handler splits at 2697, 2776, 2219; scope lost on
> the model fallback at 2626.

**The class remains UNMINTED and homing-owed.** Reach is still established within
one file only; Cross-Keystone Register §2 is not satisfied by this correction.
Nothing here admits an XK entry.

**It remains outside F-AUTH-1 as scoped.** Every one of these handlers declares
`requireAuth` and passes every CP12 verification grep. Authentication is present
throughout; authorization is what is absent.

### §36.4 v1.33's Appendix A — superseded as an exhibit

v1.33's Appendix A is titled *`LIMIT 1` census, full probe output*. It is a
faithful record of what that probe returned. It is **not** a census of
`world_events` access, and it should not be read as one.

**It is superseded as an exhibit by §36.1 and §36.2's site lists.** Per
additive-supersede it is neither deleted nor edited; v1.33's body stands as
merged. A reader arriving at v1.33 Appendix A must read this section.

**Recorded so the narrow probe is not re-used:** keying on `LIMIT\s*1` measures
query formatting, not data access.

### §36.5 What this revision does not do

- Does not change any group disposition. All five stand as recorded at v1.33 §35.2.
- Does not mint finding class 1, or any other class, or assert reach beyond
	`worldEvents.js`.
- Does not complete `worldEvents.js` disposition. 41 statements remain.
- Does not resolve v1.33 §35.4's Venue/social count defect.
- Does not draw the XK-1 population conclusion, still deferred.
- Does not disposition the `character_key` split at v1.33 §35.6.
- Does not evaluate XK-1's remedy, or touch F-Ward-1 or F-Ward-3.
- Does not close open item 36.
- Does not mint an FD, PE, or XK number.
- Does not enumerate prod. Prod remains FROZEN.
- **No live database contact.** Source- and register-derived entirely, via
	`git show origin/main:` at `c4782084`.

## §11 Plan Version History (UPDATED)

Rows v1.0 through v1.33 carry forward from v1.33 unchanged. Appended:

| v1.34 | 2026-08-10 | `c4782084` | v1.33 §35.3 CORRECTED: read census 13/11 → 16/13; the probe keyed on `LIMIT\s*1`, a syntactic accident excluding un-LIMITed reads and all writes. Write surface measured for the first time — 20 sites, 10 unscoped id-keyed, 2 to `canon_consequences`. §35.5 class 1 severity restated as write-side; class remains unminted. v1.33 Appendix A superseded as an exhibit. No disposition changes. §36 minted. No FD. |

v1.34 supersedes v1.33 **on §35.3's counts, on the completeness of its census,
and on §35.5 class 1's severity statement only.** All other v1.33 forward
direction stands unchanged.

## Register hygiene

- **Mints no FD.** Tail: **FD-61**.
- Mints: **§36**.
- Corrects: v1.33 §35.3's read counts; the omission of the write surface.
- Restates: v1.33 §35.5 finding class 1's severity.
- Supersedes as exhibit: v1.33 Appendix A.
- Carries: **open item 36**, unchanged.
- Defers: the XK-1 population question; v1.33 §35.4's count defect.
- **Numeral disambiguation:** per v1.31–v1.33, *open item 40 (F-Stats-1)* and
	*open item 23 (F-Stats-1)* are unrelated to *FD-40 (F-Deploy-1)* and to §23.1
	respectively.
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.33; no destructive rewrite. v1.33's body stands as
	merged at `101cac3d`.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).
- **No live database contact.**

## Forward Statement

v1.34 is the plan-of-record.

**v1.33 understated the finding.** A reader taking 13/11 as the measurement gets
a milder picture than the code supports. The corrected figure is 49 access sites,
of which 23 carry no show scope, and the unscoped set includes ten writes.

**Finding class 1's severity is write-side.** Two unscoped writes to
`canon_consequences` are the sharpest instance. The class remains unminted and
homing-owed.

**`worldEvents.js` disposition remains PARTIAL.** 22 of 63 statements. 41 remain:
Episode generation (15), Invitations (23), and Venue/social's unreconciled
remainder.

**Open item 6 is CLOSED with carve-out** per v1.31 §33.2. **XK-1 is owned and
unremedied.** **One workstation hazard remains live** per v1.29: §31's boot-path
inline DDL makes `npm start` and `npm run dev` unsafe pending PE #62.

After F-Stats-1 closes: **F-Ward-1 next**, under XK-1's recorded
reciprocal-reference obligation.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-10. Main at `c4782084`. Predecessor: v1.33 (`101cac3d`, #1006).* 
*Minted: §36. Corrected: v1.33 §35.3. Restated: v1.33 §35.5 class 1. Superseded as exhibit: v1.33 Appendix A. Carried: open item 36. Mints no FD. Tail: FD-61. [skip-automerge]*
