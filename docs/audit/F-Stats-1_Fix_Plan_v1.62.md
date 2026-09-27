# F-Stats-1 Fix Plan v1.62

*Additive-supersede on v1.61. Mints §65. Records Evoni's ruling on Phase B items 2–7 and the fold of §64.4-R into XK-3. Ratifies XK-4 in the Cross-Keystone Register. Mints no FD, no PE.*

## What changed in v1.62

**RULING (Evoni, 2026-09-27): "adopt all six as suggested, and fold §64.4-R into XK-3".** The six suggestions she adopted are quoted verbatim at §65.1. They are the only things this revision rules; every other clause is MEASURED and says so.

**XK-4 is ratified**: the second shape, a route reaching a child record by a caller-supplied id with no show check. It is admitted to `Cross_Keystone_Register.md` by this revision, as v1.57 admitted XK-3. §65.4.

**§64.4-R is folded into XK-3.** The owner-on-shows remedy and its two gates now live on XK-3's entry. §65.4.

**Item 2's comparison is performed**: the eleven `sync()` sites are v1.60's ten route-level calls plus one in a worker. §65.2.

**Owed from these rulings**: item 3's reach probe (§65.3-P); item 6's transaction fix (§65.6-F). Item 6's ruling names no keystone for its fix, and this revision records that as unspecified.

---

## H1 — Basis

```
$ git rev-parse origin/main
eb674ae4ccd3009246d87acccfc56478d272ac5e
```

MEASURED. Date: 2026-09-27. The newest prior revision is v1.61:

```
$ ls docs/audit | grep -E '^F-Stats-1_Fix_Plan_v1\.6[0-9]\.md$'
F-Stats-1_Fix_Plan_v1.60.md
F-Stats-1_Fix_Plan_v1.61.md
F-Stats-1_Fix_Plan_v1.62.md
```

---

## §65 — Phase B items 2–7, ruled

### §65.1 RULING — Evoni, 2026-09-27

**RULED**, verbatim, in the review chat:

> "adopt all six as suggested, and fold §64.4-R into XK-3"

**The six suggestions adopted**, verbatim as set out in the review chat the same day. Each was written against `F-Stats-1_PhaseB_Items2to7_Decisions_2026-09-27.md` (PR #2067):

- **Item 2:** "accept that bullet as the list meant, compare its 11 `model.sync()` sites with v1.60's 10, and record the 6 inline `CREATE TABLE` sites as observed, outside this item."
- **Item 3:** "home all five to F-Stats-1 as they stand, recorded as `worldEvents.js`-only with reach not established. Flag class 4 (money) as the priority, keep class 6 as an observation only, and owe the reach probe later."
- **Item 4:** "**mint it as XK-4.** It's the best-evidenced finding on the register now, and it's distinct from XK-2. Note that its remedy depends on XK-3 (no owner on shows), and fold §64.4-R into XK-3." The shape, as the suggestion describes it: "A route reaches a child record by id with no show check. That's the 40/39/20 write finding, and now the 40 read instances as well."
- **Item 5:** "**close on the read.** Record it as accepted for now, revisitable after the fix cycle."
- **Item 6:** "**rule it a defect and owe a fix now.** Wrap the five deletes in one transaction so they succeed or fail together. It's small, in one handler, and needs no schema change, so it's allowed during the fix cycle."
- **Item 7:** "record the two as \"scoped to a caller-asserted show, bounded by XK-3\", which is the honest version. Record the third as not show-scoped, and note that correction to v1.60 additively."

**Nothing else is ruled.** Where a suggestion leaves a point open, the sections below say so and do not fill it.

### §65.2 Item 2 — the eleven `sync()` sites

**RULED:** `F-App-1_G1_Audit_Report.md:514` is the list v1.60 cited as "F-App-1 §12.11".

**The comparison — MEASURED.** The list names "11 Variant A sites (`model.sync()` calls inside routes/workers) covering 7+ models" and "6 Variant B sites (inline `CREATE TABLE` SQL) covering 3 tables":

```
$ sed -n 514p docs/audit/F-App-1_G1_Audit_Report.md
- **§12.11** — Pattern 40 sites discovered across Steps 4–5: 6 Variant B sites (inline `CREATE TABLE` SQL) covering 3 tables (`video_compositions`, `chapter_versions`, `ecosystem_previews`), plus 11 Variant A sites (`model.sync()` calls inside routes/workers) covering 7+ models (`StoryTaskArc`, `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`, `FranchiseKnowledge`, `GenerationJob`). Plus a suspicious `sequelize.sync()` call inside the model loader (`src/models/index.js:1797`). Out of F-App-1 scope. Follow-up plan recommended.
```

At this basis, the `model.sync()` calls in `src/routes/` and `src/workers/`, then the `sequelize.sync()` calls:

```
$ git grep -n -E "\.sync\(" origin/main -- src/routes src/workers
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
origin/main:src/workers/sceneGenerationWorker.js:235:    await GenerationJob.sync();
$ git grep -n -E "sequelize\.sync\(" origin/main -- src/models/index.js src/app.js
origin/main:src/app.js:87:          await db.sequelize.sync(syncOptions);
origin/main:src/models/index.js:1804:      await sequelize.sync({ ...defaultOptions, ...options });
```

- **Ten** are in `src/routes/`, the ten v1.60 §63.1 counted (at shifted lines).
- **One** is in a worker, `src/workers/sceneGenerationWorker.js:235` (`GenerationJob.sync()`). v1.60 counted route-level calls only, so it did not count this one.
- **Ten plus one is eleven**, over seven models: `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`, `FranchiseKnowledge`, `StoryTaskArc`, `GenerationJob`. That is the audit report's model list.
- The two `sequelize.sync()` calls (`src/models/index.js`, `src/app.js`) are a different operation, as v1.60 §63.1 recorded for the first.

The eleven are matched by model set and by count at this basis. The audit report's own line numbers were not stated, so the match is not line-for-line (INFERRED: the same eleven).

**Observed, outside this item** (RULED to be recorded so): the inline `CREATE TABLE` sites. The audit report counted 6 over 3 tables; at this basis, in `src/routes/`, `src/services/` and `src/workers/`, there are 4 over the same 3 tables:

```
$ git grep -n "CREATE TABLE" origin/main -- src/routes src/services src/workers
origin/main:src/routes/admin.js:53:      CREATE TABLE IF NOT EXISTS video_compositions (
origin/main:src/routes/storyHealth.js:244:      CREATE TABLE IF NOT EXISTS chapter_versions (
origin/main:src/routes/storyHealth.js:276:      CREATE TABLE IF NOT EXISTS chapter_versions (
origin/main:src/routes/worldStudio.js:320:    CREATE TABLE IF NOT EXISTS ecosystem_previews (
```

**Disposition:** the citation is resolved and the comparison is done. The scoping note's "To close" for item 2 ("locate the eleven sites … read them, and compare against v1.60 §63.1's ten") is met. The adopted suggestion does not say "close", so this revision records the criterion met and leaves the word to Evoni.

### §65.3 Item 3 — §35.5 classes 2–6

**RULED:** all five **homed to F-Stats-1** as they stand, recorded as **`worldEvents.js`-only, reach not established**. **Class 4** ("Parallel balance readers, none authoritative", the money path) is **flagged the priority**. **Class 6** ("Model-acquisition idiom drift") **stays an observation**.

**Owed: §65.3-P, the reach probe**, "later", per the ruling. It is agent-doable. It must first re-locate each instance by content, since `worldEvents.js` has changed by +538/−88 lines since v1.33's basis (`F-Stats-1_PhaseB_Items2to7_Decisions_2026-09-27.md`, item 3).

**Disposition:** item 3's homing is done; its reach probe is owed.

### §65.4 Item 4 — XK-4 ratified; §64.4-R folded into XK-3

**RULED:** the second shape is minted as **XK-4**; its remedy depends on XK-3; §64.4-R is folded into XK-3.

**Admission against the register's §2 criteria — MEASURED:**

```
$ sed -n 23,34p docs/audit/Cross_Keystone_Register.md
## §2 Admission criteria

An entry is admitted when **all** hold:

1. The finding is upstream of two or more keystones in the locked sequence, or
   sits outside the sequence entirely (boot path, pipeline, workstation).
2. It does not resolve by work inside any single keystone.
3. A Fix Plan revision ratifies its admission.

Not admitted: single-keystone residue (belongs to that keystone),
production-environment observations (belong to `Session_PE_Roster.md`), and
findings whose reach is asserted but not established.
```

1. **Upstream of two or more keystones.** v1.48 §51.5's own note on option 1: "Reach spans F-Ward-1 and touches an F-AUTH-1-tracked route; CKR §2 criterion 1 appears satisfiable on the same grounds XK-2 used." The shape's sites also sit in F-Stats-1's populations. Reach: F-Stats-1, F-Ward-1, F-AUTH-1.
2. **Does not resolve inside one keystone.** Its remedy depends on XK-3 (RULED), itself a cross-keystone entry.
3. **Ratified by a Fix Plan revision.** This one.

The register's exclusion "findings whose reach is asserted but not established" does not apply. The write shape is measured across 20 files at 40 sites / 39 handlers (v1.59 §62; unchanged at v1.60, v1.61), and the read instances across five files (§65.4 below).

**Extent, as the adopted suggestion describes it: writes and reads.**
- **Writes:** 40 sites / 39 handlers / 20 files (v1.59 §62).
- **Reads:** v1.61 §64.2 records 36 across five slices. `F-Stats-1_ReadsSlice_calendarRoutes_Amd1_2026-09-27.md` §4 records 40 as arithmetic, and the adopted suggestion says "the 40 read instances".
- **v1.61 §64.4 kept the read instances out of the shape's total.** This ruling brings them under XK-4 by the suggestion's words. The two counts stay separate: XK-4's entry records both and sums neither.

**Distinct from XK-2**, per v1.48 §51.4: "Two findings that share a symptom and not a remedy are two findings." XK-2 is a scope present and dropped; XK-4 is a scope absent at every layer.

**The fold.** §64.4-R, "give shows an owner, and check it on the request path", gated on the fix cycle ending and on Evoni's multi-user decision (v1.61 §64.1), is **one item with XK-3**. XK-3's own text reads "no user↔show relation exists, so `show_id` is caller-asserted and unverifiable". The address §64.4-R now points to XK-3, whose entry carries the two gates and v1.61 §64.4's recorded dependencies by banner. **XK-3's body is not edited**, per the register's §6.

The register edits, all additive: a row in §4's table, an XK-4 entry, an admission footer line, and a dated banner above XK-3's entry. They are in this PR, as v1.57's were for XK-3.

**Disposition:** item 4 is closed by the mint.

### §65.5 Item 5 — `StorytellerMemory` `references`

**RULED:** closed on the read (`F-Stats-1_StorytellerMemory_References_2026-09-10.md`: "neither foreign key declares a `references` key"). The absence is **accepted for now, revisitable after the fix cycle**.

```
$ git show origin/main:src/models/StorytellerMemory.js | grep -c references
0
```

**Disposition:** item 5 is closed.

### §65.6 Item 6 — the character-delete cascade

**RULED:** the non-transactional five-delete cascade is **a defect**, and **a fix is owed now**: the five deletes wrapped in one transaction so they succeed or fail together.

**The site at this basis — MEASURED:**

```
$ git show origin/main:src/routes/worldStudio.js | grep -n -E "router.delete\('/world/characters/:id',|DELETE FROM (character_relationships WHERE|registry_characters WHERE world_character_id|intimate_scenes WHERE character_a_id|character_relationships_extended WHERE character_id = :id|world_characters WHERE id)"
1835:router.delete('/world/characters/:id', requireAuth, async (req, res) => {
1844:        `DELETE FROM character_relationships WHERE character_id_a = :rcId OR character_id_b = :rcId`,
1850:      `DELETE FROM registry_characters WHERE world_character_id = :id`,
1855:      `DELETE FROM intimate_scenes WHERE character_a_id = :id OR character_b_id = :id`,
1860:      `DELETE FROM character_relationships_extended WHERE character_id = :id OR related_character_id = :id`,
1865:      `DELETE FROM world_characters WHERE id = :id`,
```

**Owed: §65.6-F**, the transaction fix. The adopted suggestion says it "needs no schema change, so it's allowed during the fix cycle". It is agent-doable in one handler; testing it needs the backend test database.

**Unspecified by the ruling: which keystone carries the fix.** The file is excluded from F-Stats-1's populations by domain (v1.44 §47.2), and v1.60 §63.2 records that the exclusion "clears nothing". This revision records the fix as owed at §65.6-F and does not choose a keystone.

**Disposition:** item 6 is closed as a ruling; the fix is owed.

### §65.7 Item 7 — the three compound-predicate sites

**RULED:**
- The two `worldEvents.js` deletes are recorded as **"scoped to a caller-asserted show, bounded by XK-3"**.
- The `worldStudio.js` delete is recorded as **not show-scoped**.

At this basis — MEASURED:

```
$ git show origin/main:src/routes/worldEvents.js | grep -n -E "DELETE FROM world_events WHERE id = :(eventId|id) AND show_id = :showId"
953:        `DELETE FROM world_events WHERE id = :eventId AND show_id = :showId`,
2392:            'DELETE FROM world_events WHERE id = :id AND show_id = :showId',
$ git show origin/main:src/routes/worldStudio.js | grep -n "DELETE FROM character_relationships_extended WHERE id = :relId AND character_id = :cid"
3127:        `DELETE FROM character_relationships_extended WHERE id = :relId AND character_id = :cid`,
```

**CORRECTION to v1.60 §63.5**, additive, per the ruling. §63.5 described three raw-SQL deletes as "of the form `WHERE id = :id AND show_id = :showId`" and "All three are in the `:showId` cohort". The third, then `worldStudio.js:3121`, now `:3127`, has no `show_id`: its predicate is `id = :relId AND character_id = :cid` (`F-Stats-1_CompoundPredicates_Read_2026-09-16.md`, "MISMATCH"). v1.60 is not edited.

**Not recorded as verified scoped.** v1.55 §58.4's two VERIFIED SCOPED sites stand as filed. The ruling records these two differently and does not revisit §58.4.

**Disposition:** item 7 is closed.

---

## What this revision does not do

- **Rules nothing beyond §65.1's quoted words.**
- **Mints no FD, no PE.** Mints **XK-4** by ratification. FD tail remains **FD-62**; XK tail becomes **XK-4**.
- **Does not declare Phase B closed**, and does not say "close" for item 2 where the ruling did not.
- **Does not choose a keystone for §65.6-F**, and does not write the fix.
- **Does not run §65.3-P.**
- Does not sum XK-4's write and read counts, and does not revisit v1.61 §64.4's separation beyond the ruling's words.
- **Does not edit** v1.60, v1.61 or any other filed document in place. The Cross-Keystone Register receives additive rows, an entry, a footer line and one banner, per its §6.
- Does not evaluate any XK remedy. XK-3's and XK-4's fixes stay **UNEVALUATED**.
- **No live database contact by any agent session. No prod-box or dev-box contact.** Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

---

## §11 Plan Version History (UPDATED)

| v1.62 | 2026-09-27 | **RULES (Evoni): "adopt all six as suggested, and fold §64.4-R into XK-3".** The six adopted suggestions are quoted verbatim at §65.1; nothing else is ruled. **Item 2 (§65.2):** the audit report's line 514 is the cited list. The comparison is MEASURED: eleven `model.sync()` sites = v1.60's ten route-level calls + `sceneGenerationWorker.js:235`, the same seven models. Inline `CREATE TABLE` sites are recorded as observed, outside the item (4 over 3 tables at this basis; the report said 6). The closing criterion is met, and the word "close" is left to Evoni. **Item 3 (§65.3):** classes 2–6 homed to F-Stats-1, `worldEvents.js`-only, reach not established. Class 4 (money) is the priority, class 6 stays an observation, and **§65.3-P reach probe owed**. **Item 4 (§65.4):** **XK-4 RATIFIED**, the second shape, writes 40 / 39 / 20 plus the read instances (36 ruled at v1.61, 40 as amended), counted separately. Admitted against CKR §2, with its remedy dependent on XK-3. **§64.4-R FOLDED into XK-3** by banner. **Item 5 (§65.5):** closed on the read; the absence of `references` is accepted for now, revisitable after the fix cycle. **Item 6 (§65.6):** the non-transactional character-delete cascade is a **defect**; **§65.6-F transaction fix owed now**, with its keystone unspecified by the ruling. **Item 7 (§65.7):** two `worldEvents.js` deletes recorded "scoped to a caller-asserted show, bounded by XK-3"; the `worldStudio.js` delete recorded not show-scoped; **CORRECTION to v1.60 §63.5** recorded additively. Mints XK-4; no FD, no PE. No agent database contact. §65 minted. Basis `eb674ae4`. |

## Register hygiene

- **RULES** (§65.1, Evoni): items 2–7 as adopted; §64.4-R folded into XK-3.
- **Mints:** §65; **XK-4** (ratified; `Cross_Keystone_Register.md` §4). No FD (tail **FD-62**), no PE.
- **Closes:** items 4, 5, 6 (as a ruling) and 7. Item 3's homing is done. Item 2's closing criterion is met, with the word left to Evoni.
- **Owes, new:** §65.3-P (item 3's reach probe, later); §65.6-F (item 6's transaction fix, now; keystone unspecified).
- **Moves:** §64.4-R → XK-3 (one item; gates and dependencies carried by banner).
- **Corrects:** v1.60 §63.5's description of the third compound-predicate site (§65.7). v1.60 is not edited.
- Carries forward from v1.61: everything not named above.
- Additive-supersede on v1.61; no destructive rewrite.
- **Numeral disambiguation:** *§65* is unrelated to FD-65 and PE #65. **XK-4** is a Cross-Keystone number, unrelated to any FD, PE or open item 4. "Item 4" here is Phase B item 4 (`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`). **§65.3-P** and **§65.6-F** are addresses for owed work, not findings.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

**Six items that had waited since 2026-09-10 are ruled in one revision**, on notes that were already filed. None needed more reading. What they needed was someone to decide.

**The register's biggest finding now has a number.** The second shape was held for fourteen revisions under "record and defer". It is now XK-4, and its remedy is XK-3: a show with an owner, checked on the request path. That remedy waits behind the fix cycle and a decision about users. One small fix does not wait: five deletes that should succeed or fail together.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `eb674ae4ccd3009246d87acccfc56478d272ac5e`. Predecessor: v1.61.*
*Minted: §65; XK-4 (ratified). Ruled (Evoni): items 2–7 as adopted; §64.4-R folded into XK-3. Owed: §65.3-P; §65.6-F. Corrected: v1.60 §63.5 (third site). Mints no FD, no PE. Tail: FD-62. XK tail: XK-4. Task: #2068. [skip-automerge]*
