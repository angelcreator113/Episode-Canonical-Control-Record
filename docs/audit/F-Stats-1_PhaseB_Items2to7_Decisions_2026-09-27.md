# F-Stats-1 Phase B — Items 2–7: the Decisions Each Needs

*Standalone decisions note. For each of Phase B items 2–7: what its filed
note found, whether the code it cites has changed, and the decision a Fix
Plan revision would need from Evoni to close or advance it, so several can
be ruled in one revision. Rules nothing, recommends nothing, mints nothing,
closes nothing.*

## Purpose

v1.61 closed item 1. Items 2–7 each have a standalone note filed between
2026-09-10 and 2026-09-16, and none has been ruled on. The next step for
each is a decision, not more reading. This note puts each decision in one
place, as a question, with what it depends on.

## H1 — Basis

```
$ git rev-parse origin/main
32852ddd105b33b39698cd19ad24fff69a2ea4d5
```

MEASURED. Date: 2026-09-27. The newest F-Stats-1 authority is v1.61:

```
$ ls docs/audit | grep -E '^F-Stats-1_Fix_Plan_v1\.6[0-9]\.md$'
F-Stats-1_Fix_Plan_v1.60.md
F-Stats-1_Fix_Plan_v1.61.md
```

v1.61 §64.5 records items 2–7 open and unchanged, each note closing nothing
or not closing its item by its own statement:

```
$ grep -n -E "^\| [2-7] \|.*open, unchanged" docs/audit/F-Stats-1_Fix_Plan_v1.61.md
194:| 2 | PE #62 overlap vs F-App-1 §12.11 | `F-Stats-1_PE62_Overlap_Location_2026-09-11.md` | open, unchanged |
195:| 3 | §35.5 classes 2–6 homing | `F-Stats-1_S355_Classes2to6_Homing_2026-09-14.md` | open, unchanged |
196:| 4 | Second-shape mint decision (Evoni-ruled) | `F-Stats-1_ShapeMint_Options_2026-09-10.md` | open, unchanged |
197:| 5 | `StorytellerMemory` `references` | `F-Stats-1_StorytellerMemory_References_2026-09-10.md` | open, unchanged |
198:| 6 | `worldStudio.js:1838`–`:1859` transactionality | `F-Stats-1_WorldStudio_Transactionality_2026-09-10.md` | open, unchanged |
199:| 7 | Three unread compound-predicate sites | `F-Stats-1_CompoundPredicates_Read_2026-09-16.md` | open, unchanged |
```

The items are scoped in `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`
§"Itemization" (each quoted below from there).

---

## Item 2 — PE #62 overlap vs F-App-1 §12.11

**Scoping** (`…_PhaseB_OwedScoping_2026-09-10.md` Item 2): "F-App-1 §12.11's
eleven sites, for the PE #62 overlap"; v1.60 §63.1: "The overlap cannot be
closed from here. F-App-1 §12.11 enumerates eleven sites; that list was not
read."

**Filed note:** `F-Stats-1_PE62_Overlap_Location_2026-09-11.md` (basis
`9b9b21a4`).

**What it found:** no fix-plan heading §12.11 exists. The eleven sites are
"Located, as a candidate — under the same number, in a different document of
the family; never promoted to a fix-plan heading": a bullet in
`F-App-1_G1_Audit_Report.md:514`. "This is a candidate, not a ruling." The
comparison against v1.60 §63.1's ten "is the next step, not this one."

**Changed since its basis:** the audit report line is unchanged; the ten
route-level `sync()` calls v1.60 §63.1 counted are all still present, at
shifted lines:

```
$ sed -n 514p docs/audit/F-App-1_G1_Audit_Report.md
- **§12.11** — Pattern 40 sites discovered across Steps 4–5: 6 Variant B sites (inline `CREATE TABLE` SQL) covering 3 tables (`video_compositions`, `chapter_versions`, `ecosystem_previews`), plus 11 Variant A sites (`model.sync()` calls inside routes/workers) covering 7+ models (`StoryTaskArc`, `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`, `FranchiseKnowledge`, `GenerationJob`). Plus a suspicious `sequelize.sync()` call inside the model loader (`src/models/index.js:1797`). Out of F-App-1 scope. Follow-up plan recommended.
$ git grep -n -E "\.sync\(" origin/main -- src/routes
origin/main:src/routes/continuityEngine.js:40:      await m.ContinuityTimeline.sync();
origin/main:src/routes/continuityEngine.js:41:      await m.ContinuityCharacter.sync();
origin/main:src/routes/continuityEngine.js:42:      await m.ContinuityBeat.sync();
origin/main:src/routes/continuityEngine.js:43:      if (m.ContinuityBeatCharacter) await m.ContinuityBeatCharacter.sync();
origin/main:src/routes/franchiseBrainRoutes.js:66:        await db.FranchiseKnowledge.sync();
origin/main:src/routes/memories/engine.js:2452:    await db.StoryTaskArc.sync();
origin/main:src/routes/memories/engine.js:3205:      await db.StoryTaskArc.sync();
origin/main:src/routes/memories/engine.js:3494:      await db.StoryTaskArc.sync();
origin/main:src/routes/memories/engine.js:3695:      await db.StoryTaskArc.sync();
origin/main:src/routes/sceneSetRoutes.js:52:      GenerationJob.sync(),
```

The candidate names 11 Variant A (`model.sync()`) sites over seven models,
plus 6 Variant B (inline `CREATE TABLE`) sites and a `sequelize.sync()` in the
model loader. v1.60's ten are Variant A only.

**The decision, as a question:** *Is `F-App-1_G1_Audit_Report.md:514` the
"F-App-1 §12.11" v1.60 cites?* If so, the item becomes a site-by-site
comparison of its eleven Variant A sites against v1.60's ten.

**Options (unranked):**
- accept the candidate as the cited list;
- rule the citation mistaken, and restate the item against the ten measured
  sites alone;
- widen the item to cover both variants (the 6 inline `CREATE TABLE` sites
  and the loader's `sequelize.sync()` too).

**Needs first:** nothing. **Afterwards:** agent-doable, repo-only.

## Item 3 — §35.5 classes 2–6 homing

**Scoping** (Item 3): "§35.5's classes 2-6, unminted and homing-owed"; "To
close: run the cross-route-file probe §35.5 itself names as unattempted, for
classes 2–6, to establish or bound reach beyond `worldEvents.js`."

**Filed note:** `F-Stats-1_S355_Classes2to6_Homing_2026-09-14.md` (basis
`900d6e16`).

**What it found:** the five classes, quoted from v1.33 §35.5, each
**UNHOMED**, all still `worldEvents.js`-only:

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.33.md | sed -n 186,190p
| 2 | Soft-delete filter maintained by hand in raw queries | 7+ instances, 3 tables, in-handler split at 2697 | OWED. Mechanism differs from XK-1: the column exists and the query omits it. |
| 3 | Swallowing catch producing a fabricated result | 4 at 2278; 1 at 2219; counter-example at 2352 | OWED. |
| 4 | Parallel balance readers, none authoritative | 3 mechanisms: 2219, 2278, 3730 | OWED. Money path; adjacent to open item 6's carved assertions. |
| 5 | Denormalized JSON snapshot with no refresh path | `outfit_pieces` at 2697 | OWED. Same shape as the `canonical_description` copies already on the register. |
| 6 | Model-acquisition idiom drift | 3 idioms across 22 statements | Observation. Low severity. |
```

Class 4's re-examination since v1.33 is "cannot-tell"; class 6 keeps its
"Observation. Low severity" standing. The note "Does not … Recommend a homing
option (F-Stats-1, F-AUTH-1, a new Cross-Keystone Register entry, or any
other keystone)" and "Does not … Establish reach for any class".

**Changed since its basis:** `worldEvents.js` has changed substantially:

```
$ git diff --stat 900d6e16 origin/main -- src/routes/worldEvents.js
 src/routes/worldEvents.js | 626 +++++++++++++++++++++++++++++++++++++++-------
 1 file changed, 538 insertions(+), 88 deletions(-)
```

So v1.33's and v1.41's line numbers for these classes cannot be carried to
this basis; every instance would have to be re-located by content before a
reach probe. Not re-located here.

**The decision, as a question:** *Should classes 2–6 be homed as they stand
(`worldEvents.js`-only), or should the reach probe v1.33 named run first?
And where does each belong?*

**Options (unranked), from the note's own list:** home to F-Stats-1; to
F-AUTH-1; as a new Cross-Keystone Register entry; to another keystone. Each
can be taken per class, and with or without the reach probe first.

**Needs first:** nothing to rule; the reach probe, if chosen, is
agent-doable and would come before homing. **Afterwards:** agent-doable
(probe and re-location); the homing itself is the ruling.

## Item 4 — Second-shape mint decision

**Scoping** (Item 4): "Shape stands at 40 / 39 / 20, unminted; v1.48 §51.5
option 3 stands"; "MARK: EVONI-RULED".

**Filed note:** `F-Stats-1_ShapeMint_Options_2026-09-10.md` (basis
`42147b6a`).

**What it found:** v1.48 §51.5 offers exactly three options, quoted there:
(1) "Mint as its own XK entry"; (2) "Widen XK-2 to cover both", "Rejected by
§51.4's remedy test, but recorded because it is the cheaper register
outcome"; (3) "Record and defer", "Taken here". The shape reached 40 / 39 /
20 at v1.59 and is unchanged at v1.60. Minting needs a Fix Plan revision
(v1.60 §63.2, "On authority").

**Changed since its basis:** no code is cited. In the register, v1.61
closed the reads survey and did not mint the shape or add the read
instances to it (v1.61 §64.4, "Unchanged by this revision"). One fact the
note did not cover, recorded here without a position: **XK-3**, "no user↔show
relation exists, so show_id is caller-asserted and unverifiable", was minted
and is owned by F-Stats-1 since v1.57, after §51.5 was written (v1.48):

```
$ grep -n -E "^\| XK-[123] " docs/audit/Cross_Keystone_Register.md | cut -c1-220
50:| XK-1 | `paranoid` exposure — 48 model tables inherit `paranoid` with no `deleted_at` column | F-Stats-1, F-Ward-1, F-Ward-3 | OWNED (F-Stats-1 v1.31) | UNEVALUATED |
51:| XK-2 | Row-scope not enforced in SQL — scope parameter present in the route, used for a read, dropped at the write | F-Stats-1, F-AUTH-1 | OWNED (F-Stats-1 v1.46) | UNEVALUATED |
52:| XK-3 | No authorization substrate for the tenancy root — no user↔show relation exists, so `show_id` is caller-asserted and unverifiable | F-AUTH-1, F-Stats-1 | OWNED (F-Stats-1 v1.57) | UNEVALUATED |
317:| XK-3 Gate 1 | `shows` has no ownership column, at creation or in any ALTER | `src/models/Show.js`; `src/migrations/20260109132556-create-shows.js`; `scripts/migrations/fix-shows-schema.sql`; `create-shows-only.sql`
318:| XK-3 Gate 2 | no resource-scoped authorization tier exists | `src/middleware/auth.js` direct read; `authorize` = `verifyGroup` by its own comment; 30 call sites all pass `admin`/`ADMIN` |
319:| XK-3 Gate 3 | **OPEN** — principal population unmeasured | requires live DB; prod FROZEN |
320:| XK-3 Gate 4 | no model declares a User association; no `User` model exists | 40-hit grep over `src/models/*.js`, zero associations; `git ls-tree` on `src/models` |
```

**The decision, as a question:** *Which of §51.5's three options holds now:
mint the shape as its own XK (the next number is XK-4), widen XK-2, or keep
record-and-defer?* Where XK-3 fits is part of the same question and is not
answered here.

**Options (unranked):** §51.5's three, as quoted.

**Needs first:** nothing measurable; a mint is a Cross-Keystone Register
action ratified by a Fix Plan revision (v1.57 §60.1, per the note).
**Afterwards:** register work only, agent-doable.

## Item 5 — `StorytellerMemory` `references`

**Scoping** (Item 5): read `StorytellerMemory`'s model file for `references`
on `line_id` and `character_id`, "matching the method already applied to the
other four models in §63.1's table."

**Filed note:** `F-Stats-1_StorytellerMemory_References_2026-09-10.md`
(basis `5cf6ef4e`).

**What it found:** the read is done. "Neither foreign key declares a
`references` key"; both are `allowNull: true`; the four siblings re-derive
exactly as §63.1 recorded. It "Takes no position on whether a missing or
present `references` declaration … is correct, a defect, or in need of a
fix."

**Changed since its basis:**

```
$ git diff --stat 5cf6ef4e origin/main -- src/models/StorytellerMemory.js; echo "exit=$?"
exit=0
$ git show origin/main:src/models/StorytellerMemory.js | grep -c references
0
```

Unchanged; still no `references` in the file.

**The decision, as a question:** *With the read performed, does item 5
close as measured, or does the missing `references` need a disposition (a
defect to fix, or accepted as is)?*

**Options (unranked):** close on the read; rule the absence a defect and
owe a fix; rule it accepted. A fix would add a foreign-key constraint, which
is a schema change under the locked sequence's standing rule
(`PROJECT_CONTEXT.md` §6.1) and reaches canon by F-Deploy-1 v1.51's path.

**Needs first:** nothing. **Afterwards:** closure is register-only; a fix,
if ruled, is agent-doable code gated by the schema rule.

## Item 6 — `worldStudio.js` character-delete cascade transactionality

**Scoping** (Item 6): v1.60 §63.5, "No transaction is visible in the
surrounding lines, which were not read."

**Filed note:** `F-Stats-1_WorldStudio_Transactionality_2026-09-10.md`
(basis `0a0ff3ed`).

**What it found:** "no — for all five" writes: five raw `sequelize.query`
deletes, no transaction; writes 1–4 swallow errors with `.catch`, write 5
does not ("Asymmetry recorded, not assessed"). It "Does not close this owed
item … whether that absence constitutes a defect, and any remedy, remain
open."

**Changed since its basis:** the file changed slightly and the cascade moved
six lines; it is the same five statements, still with no transaction in the
handler:

```
$ git diff --stat 0a0ff3ed origin/main -- src/routes/worldStudio.js
 src/routes/worldStudio.js | 15 ++++++++++++---
 1 file changed, 12 insertions(+), 3 deletions(-)
$ git show origin/main:src/routes/worldStudio.js | grep -n -E "router.delete\('/world/characters/:id',|DELETE FROM (character_relationships WHERE|registry_characters WHERE world_character_id|intimate_scenes WHERE character_a_id|character_relationships_extended WHERE character_id = :id|world_characters WHERE id)"
1835:router.delete('/world/characters/:id', requireAuth, async (req, res) => {
1844:        `DELETE FROM character_relationships WHERE character_id_a = :rcId OR character_id_b = :rcId`,
1850:      `DELETE FROM registry_characters WHERE world_character_id = :id`,
1855:      `DELETE FROM intimate_scenes WHERE character_a_id = :id OR character_b_id = :id`,
1860:      `DELETE FROM character_relationships_extended WHERE character_id = :id OR related_character_id = :id`,
1865:      `DELETE FROM world_characters WHERE id = :id`,
$ git show origin/main:src/routes/worldStudio.js | sed -n 1835,1870p | grep -c -E "transaction|BEGIN|commit|rollback"
0
```

(The cascade was at `:1838`–`:1859`; it is now at `:1844`–`:1865`, in a
handler starting at `:1835`.)

**The decision, as a question:** *Is the non-transactional cascade a defect
to fix, and where is it owed? And does the error-handling asymmetry matter?*

**Options (unranked):** rule it a defect and owe a fix (a transaction around
the five deletes); record it as accepted; home it elsewhere. Context: the
file is excluded from F-Stats-1's populations by domain (v1.44 §47.2), and
v1.60 §63.2 records that exclusion "clears nothing".

**Needs first:** nothing. **Afterwards:** a fix, if ruled, is agent-doable
code in one handler; testing it needs the backend test database.

## Item 7 — Three compound-predicate sites

**Scoping** (Item 7): "the three compound-predicate sites at §63.5, unread";
v1.60 §63.5 called them "candidates" for "the first clean sites since v1.55
§58.4".

**Filed note:** `F-Stats-1_CompoundPredicates_Read_2026-09-16.md` (basis
`4831d426`).

**What it found:** two sites match §63.5's description and one does not.
- **`worldEvents.js` (then `:570`):** `id = :eventId AND show_id = :showId`,
  both from URL path parameters.
- **`worldEvents.js` (then `:1973`):** `id = :id AND show_id = :showId`, with
  ids from `req.body.ids` and `show_id` from the path.
- **`worldStudio.js` (then `:3121`):** `id = :relId AND character_id = :cid`,
  "MISMATCH — no `show_id` present".

It "Does not assess the tenancy-check correctness of any of the three sites".

**Changed since its basis:** the files changed; the three statements are
unchanged in text, at new lines:

```
$ git show origin/main:src/routes/worldEvents.js | grep -n -E "DELETE FROM world_events WHERE id = :(eventId|id) AND show_id = :showId"
953:        `DELETE FROM world_events WHERE id = :eventId AND show_id = :showId`,
2392:            'DELETE FROM world_events WHERE id = :id AND show_id = :showId',
$ git show origin/main:src/routes/worldStudio.js | grep -n "DELETE FROM character_relationships_extended WHERE id = :relId AND character_id = :cid"
3127:        `DELETE FROM character_relationships_extended WHERE id = :relId AND character_id = :cid`,
```

**The standard the question turns on.** v1.55 §58.4 recorded two deletes as
"VERIFIED SCOPED" because "Both take the tenant from the route path and use
it." The two `worldEvents.js` sites take `show_id` from the route path. XK-3
(above) records that such a `show_id` is "caller-asserted and unverifiable".

**The decision, as a question:** *Do the two `worldEvents.js` sites count as
verified scoped under v1.55 §58.4's standard? And how is the
`worldStudio.js` site recorded, given §63.5 described it as carrying a
tenant term and it does not?*

**Options (unranked):** record the two as verified scoped on §58.4's terms;
record them as scoped to a caller-asserted show, bounded by XK-3; leave them
unassessed. For the third: correct §63.5's characterization in the ruling
revision; or record the mismatch only.

**Needs first:** nothing. **Afterwards:** register-only.

---

## Summary

| Item | What's decided | Needed first | Effort after the ruling (INFERRED) |
| --- | --- | --- | --- |
| 2 | Whether `F-App-1_G1_Audit_Report.md:514` is the cited §12.11, and what the comparison covers | nothing | small: one repo comparison of 11 against 10 sites |
| 3 | Home classes 2–6 as they stand, or probe reach first; and where each goes | nothing (a probe, if chosen, comes before homing) | medium if probed: re-locate instances by content, then a probe across route files; small if homed as they stand |
| 4 | §51.5's option: mint (XK-4), widen XK-2, or keep deferring | nothing | small: register work only |
| 5 | Close on the read, or rule the missing `references` a defect | nothing | none to close; a fix is small code but a schema change, gated by the locked sequence's rule |
| 6 | Whether the non-transactional cascade is a defect, and where it is owed | nothing | small code if ruled a defect (one handler), plus a test |
| 7 | Whether two sites count as verified scoped under §58.4, given XK-3; how the third is recorded | nothing | none: register only |

No decision here needs a live read that only Evoni can run, and none depends
on another item's ruling. Items 4 and 7 both touch XK-3, so ruling them
together keeps their wording consistent; that is an observation, not a
dependency.

## What this document does not do

- **Rules nothing. Recommends nothing:** no option is preferred, ranked or
  characterized as cheaper or safer beyond what the filed notes say.
- Mints no FD, XK or PE. Closes no item.
- Does not re-locate item 3's instances in the changed `worldEvents.js`.
- Does not compare item 2's eleven sites with the ten.
- Does not assess any site's correctness.
- Edits no filed document. Changes no code.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito or
  GitHub-settings contact.

## Footer

**Type:** standalone decisions note. **Rules:** nothing. **Mints:**
nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none. Production's
freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still
never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `32852ddd105b33b39698cd19ad24fff69a2ea4d5`.*
*Authority: `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` (items); the six
filed item notes named above; `F-Stats-1_Fix_Plan_v1.61.md` §64.5;
`Cross_Keystone_Register.md` (XK rows); `F-Stats-1_Fix_Plan_v1.55.md` §58.4.
Every claim MEASURED at the basis above unless marked INFERRED. Task: #2066.*
