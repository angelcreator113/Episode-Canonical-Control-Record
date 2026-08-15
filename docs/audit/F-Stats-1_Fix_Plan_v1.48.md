# F-Stats-1 Fix Plan v1.48
*Additive-supersede on v1.47. Mints §51. Records a second scope shape. Mints no finding.*

## What changed in v1.48

**The ORM-surface probe did not measure XK-2's extent. It found a different
shape.** Six handlers, seven sites, five files: **routes addressed by a
child-entity id with no tenant parameter at any layer.**

**This is the shape v1.47 §50.5 held separate**, on one instance. It now has
seven, and the case for holding it separate is stronger, not weaker — §51.4.

**No finding is minted.** Same posture v1.44 took with class 1: measure first,
home deliberately after. Three options recorded at §51.5, none taken.

**XK-2's ORM-surface extent remains UNMEASURED.** The probe found no XK-2
instances in the ORM-only files, and **that is not evidence they are absent** —
§51.6.

**A method note: the obvious probe would have missed 8 of 9 write sites** —
§51.6. `instance.update()` and `instance.destroy()` carry no `where` clause;
Sequelize generates the predicate from the instance's primary key.

**An F-AUTH-1 adjacency is reported, not claimed** — `editMaps.js`'s route
already carries a PE #9 candidate marker. §51.3.

---

## §51 — the second shape: routes not tenant-addressable

### §51.1 Basis, population, method

Basis `e01c3b26` (v1.47, #1021). Source-derived via `git show origin/main:` and
`git grep`. No live database contact.

**Population.** The ten `:showId` route files carrying no raw SQL, recorded
unmeasured at v1.47 §50.4. Nine carry ORM calls; `feedPipelineRoutes.js` returns
zero for both raw SQL and the ORM-call probe and is **unexplained, not clean.**

| File | ORM calls | | File | ORM calls |
|---|---|---|---|---|
| `onboarding.js` | 15 | | `wardrobeEventRoutes.js` | 10 |
| `scriptGenerator.js` | 12 | | `editMaps.js` | 9 |
| `sceneStudioEpisodeRoutes.js` | 11 | | `feedPostRoutes.js` | 8 |
| `gameShows.js` | 5 | | `feedEnhancedRoutes.js` | 3 |
| `seasonRhythmRoutes.js` | 1 | | **Total** | **74** |

**74 calls is a reading problem, not a probing problem**, and the write-form probe
was used only to locate candidates. **Every ruling below rests on reading the
handler**, because the scope question lives in where the instance came from and no
grep can see that.

**Write-form probe:** `\.(update|destroy|increment|decrement)\(` returned **9
sites**. Six were read. **Three were not** — `editMaps.js:176`,
`sceneStudioEpisodeRoutes.js:201`, `scriptGenerator.js:52`. They are expected to
match the pattern and are **not counted**, because seven verified is worth more
than ten with three assumed.

### §51.2 The shape

| | XK-2 | This shape |
|---|---|---|
| Route addressing | carries `:showId` | addressed by child-entity id |
| Scope value | present, held, **dropped at the write** | **absent at every layer** |
| Visible as | a `WHERE` clause missing a term | a route contract with no tenant in it |
| Remedy shape | restate the predicate | **change the route contract** |

XK-2's instances all involve a scope value that exists and is not applied. **These
routes were never given one.** `PUT /api/v1/feed-posts/:postId` has nowhere to put
a tenant check without changing its signature or adding a lookup it does not
currently perform.

### §51.3 Instances — 6 handlers, 7 sites, 5 files

| # | Site | Route | Mechanism |
|---|---|---|---|
| 1 | `wardrobe.js:173` | `GET /outfit-score/:episodeId` | Unscoped read; `episodes` LEFT JOIN `world_events` returns another show's event context |
| 2 | `wardrobeEventRoutes.js:282` | `POST /:episodeId/lock-outfit` | `EpisodeWardrobe.destroy({ where: { episode_id } })` — **destructive**, any episode UUID |
| 3 | `editMaps.js:104` | `PUT /edit-maps/:id` | `findByPk(id)` then `update(req.body)` — **no field allowlist** |
| 4 | `feedPostRoutes.js:186` | `PUT /feed-posts/:postId` | `findByPk` then `update(allowlisted)` |
| 5 | `feedPostRoutes.js:200` | `DELETE /feed-posts/:postId` | `findByPk` then `destroy()` |
| 6–7 | `sceneStudioEpisodeRoutes.js:139, :148` | `PUT /:episodeId/beat/:beatNumber/angle` | `ScenePlan.findOne({ where: { episode_id, beat_number } })` scopes to the beat, not the tenant; `SceneAngle.findByPk(angle_id)` takes a body id unscoped |

**Sites 6 and 7 are two writes in one handler**, counted as sites rather than as
two defects.

**Site 2 is the most consequential.** It deletes every outfit link for a
caller-supplied episode id, then rebuilds them from body-supplied `wardrobe_ids`
via `Wardrobe.findByPk(wardrobeId)` — **also unscoped**. One show's outfit links
can be wiped and repopulated with another show's wardrobe items. `episode_wardrobe`
is **F-Ward-1's Pattern 40b table**, the one with no migration anywhere.

**Site 3 carries an F-AUTH-1 marker, reported not claimed.** The comment above
the route reads: *"Lambda-callback: requires service-account JWT issued for Lambda
exec context (PE #9 candidate per CP12 §5.59 5-way)."* **That is F-AUTH-1's
question — which principal may call this route — and it is already tracked.** It
does not cover the unscoped `findByPk` or the mass-assignment `update(req.body)`,
which are orthogonal to which principal is admitted. **F-AUTH-1's scope is not
assessed and no claim is made on PE #9.**

**Surfaces touched:** F-Ward-1 (`wardrobe.js`, `wardrobeEventRoutes.js` — the
latter writing F-Ward-1's own table); F-AUTH-1 adjacency at `editMaps.js`;
`feedPostRoutes.js` and `sceneStudioEpisodeRoutes.js` **unassigned, and not
asserted otherwise.**

### §51.4 Why it is held separate

v1.47 §50.5 declined to fold `wardrobe.js:173` into XK-2 on one instance. **Seven
instances strengthen that, and here is the test that decides it.**

**A remedy for XK-2 does not fix these.** XK-2's remedy candidates — restating the
scope predicate on every write, a repository-layer scoping helper, row-level
security — all assume a tenant value is in hand. **None of these six handlers has
one.** Applying XK-2's remedy to `PUT /feed-posts/:postId` produces nothing,
because there is no `showId` to put in the predicate.

Fixing these requires deciding **where the tenant comes from**: a route-signature
change, a derived lookup (`post → show`), or a middleware that resolves tenancy
from the child id. That is a different piece of work with a different cost and a
different blast radius.

**Two findings that share a symptom and not a remedy are two findings.** Folding
them would produce a single entry whose remedy field could not be filled.

*Recorded as the argument for separation, not as a ruling.* The ruling is §51.5's.

### §51.5 Homing — recorded, not decided

| Option | Note |
|---|---|
| 1. Mint as its own XK entry | Reach spans F-Ward-1 and touches an F-AUTH-1-tracked route; CKR §2 criterion 1 appears satisfiable on the same grounds XK-2 used |
| 2. Widen XK-2 to cover both | Rejected by §51.4's remedy test, but recorded because it is the cheaper register outcome |
| 3. Record and defer | **Taken here** |

**Option 3 is taken for the same reason v1.44 took it for class 1:** minting is a
Cross-Keystone Register action taken once, and the extent here is seven verified
sites with three unread and a population that was selected as *the files XK-2's
probe could not see* — not as a survey of where this shape lives. **This shape's
own extent has not been measured on its own terms.**

Nothing here is minted, no number is issued, no ownership is claimed.

### §51.6 Method notes

**1. The obvious probe would have missed 8 of 9 sites.** The natural instrument
for an ORM scope defect is a search for `where` clauses containing `id` and not
`show_id`. **Eight of the nine write sites carry no `where` clause at all** —
`instance.update()` and `instance.destroy()` generate the predicate from the
instance's primary key, so the source contains `await post.update(updates)` and
nothing else.

This was predicted before the probe was built, which is why a **write-form** probe
was used to locate candidates and **every ruling rests on reading the handler.**
Had a `where`-form probe been run and its nulls trusted, it would have reported
this surface as clean.

**A probe that cannot see the dominant form of the thing it searches for reports
its own shape.** This joins §43.7's null-control hazard and §47.6's
malformed-probe hazard; it is the same family, caught before rather than after.

**2. Absence of XK-2 instances here is not evidence of absence.** The probe found
no XK-2 instances in these files. **XK-2 needs a route carrying `:showId`, and
these handlers are addressed by child-entity ids** — so the population was
structurally unlikely to contain them. **XK-2's ORM-surface extent remains
unmeasured**, and v1.47 §50.4's statement stands unchanged.

**3. Field-level discipline is present; tenancy-level discipline is absent.**
`feedPostRoutes.js:186` applies a 22-field allowlist before writing.
`sceneStudioEpisodeRoutes.js` checks `plan.locked` and refuses with 409.
`uiOverlayRoutes.js` scopes all 29 of its statements (v1.47 §50.2). **The care is
real and it is applied at the field and state layers.** `editMaps.js:104` has
neither allowlist nor scope. **This is a precise statement of what the codebase is
and is not careful about, and it is offered as characterisation rather than
criticism.**

**4. Recorded, unminted:** `sceneStudioEpisodeRoutes.js` :139 and :148 are two
sequential `plan.update()` calls with no transaction; a failure between them
leaves the angle changed and `scene_context` stale. `feedPipelineRoutes.js`
carries `:showId` and returns zero for both probes — **unexplained**.

---

## What this revision does not do

- **Does not mint any finding.** The shape is recorded, unnamed in the register,
  unowned, and unnumbered.
- Does not amend XK-2's Cross-Keystone Register entry. Its Reach, sub-form
  wording and extent statement remain owed per v1.47 §50.3 and §50.5.
- Does not fold this shape into XK-2, or rule that it is separate. §51.4 states
  the argument; §51.5 declines the ruling.
- **Does not measure XK-2's ORM-surface extent.** It remains unmeasured.
- Does not measure this shape's own extent. The population probed was selected as
  the files XK-2's probe could not see.
- Does not read `editMaps.js:176`, `sceneStudioEpisodeRoutes.js:201`, or
  `scriptGenerator.js:52`; they are not counted.
- Does not examine `feedPipelineRoutes.js`'s zero result.
- Does not assess, reopen, or claim anything about F-AUTH-1, PE #9, F-Ward-1, or
  F-Sec-3. Surfaces are cited; scopes, tracks and gates are untouched.
- Does not disposition any statement. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not propose or evaluate a remedy for either shape.
- Does not establish reach for §35.5's classes 2–6.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.48 | 2026-08-15 | **The ORM-surface probe found a second shape, not XK-2's extent** — *routes addressed by a child-entity id with no tenant parameter at any layer*: **6 handlers, 7 sites, 5 files.** Sites: `wardrobe.js:173`; `wardrobeEventRoutes.js:282` (`EpisodeWardrobe.destroy({where:{episode_id}})` — destructive, then rebuilds from body-supplied ids via an unscoped `Wardrobe.findByPk`; F-Ward-1's Pattern 40b table); `editMaps.js:104` (`findByPk` + `update(req.body)`, no allowlist; route already carries a **PE #9 candidate** marker per CP12 §5.59 — F-AUTH-1's question, reported not claimed); `feedPostRoutes.js` :186 and :200; `sceneStudioEpisodeRoutes.js` :139/:148. **This is v1.47 §50.5's held-separate shape at seven instances.** **§51.4's remedy test is the argument for separation:** XK-2's remedy candidates all assume a tenant value is in hand and **none of these handlers has one**, so a single entry's remedy field could not be filled. **Not minted** — three options recorded at §51.5, option 3 (record and defer) taken, same posture v1.44 took with class 1; the population probed was selected as *the files XK-2's probe could not see*, so this shape's own extent is unmeasured. **§51.6 method note: the obvious probe would have missed 8 of 9 write sites** — `instance.update()` / `instance.destroy()` carry no `where` clause, Sequelize generates the predicate from the primary key; a write-form probe was used to locate candidates and **every ruling rests on reading the handler.** **Absence of XK-2 instances here is not evidence of absence** — XK-2 requires a route carrying `:showId` and these are child-addressed; **XK-2's ORM-surface extent remains unmeasured** and v1.47 §50.4 stands. Recorded: field-level discipline present (22-field allowlist, `plan.locked` 409) and tenancy-level absent; two sequential `plan.update()` calls with no transaction; `feedPipelineRoutes.js` returns zero for both probes, unexplained. Three write sites unread and uncounted. Mints no FD, no XK. No live DB contact. Prod FROZEN, untouched. §51 minted. Basis `e01c3b26`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.47. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged.
- Mints: **§51**.
- Closes: **nothing**.
- Records, unminted and unowned: the **second scope shape** — routes addressed by
  a child-entity id with no tenant parameter — at 6 handlers / 7 sites / 5 files.
- Records: §51.4's remedy-test argument for separation; §51.5's three homing
  options with option 3 taken; §51.6's four method notes.
- Reports, not claimed: the **PE #9 candidate marker** at `editMaps.js`, already
  tracked by F-AUTH-1 per CP12 §5.59.
- Carries: XK-2's owed amendments (Reach, sub-form 3 wording, extent statement)
  per v1.47; §35.5's classes 2–6, unminted and homing-owed; the class 2 candidate
  at `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`
  per v1.47 §50.7; open items 22, 24, 6; all other items carried from v1.47. Open
  items 41 and 23 remain **CLOSED** per v1.43.
- Defers: this shape's homing and its own extent; **XK-2's ORM-surface extent**;
  XK-2's remedy and sequence position; classes 2–6's reach; §39.4 defect 1
  (label-only) and defect 3 (unruled); §44.8 (satisfied for `worldEvents.js`,
  unruled generally); XK-1's remedy and population question.
- Forward-points: the three unread write sites; `feedPipelineRoutes.js`'s
  unexplained zero. Recorded, not adopted.
- Changes no unit disposition, no PR state, no gate. `worldEvents.js`'s 112
  dispositions stand unaltered. **The Cross-Keystone Register is not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.47; no destructive rewrite.
- **Numeral disambiguation:** *XK-2 (Cross-Keystone Register)* is unrelated to
  FD-2, §2, or any open item 2. **PE #9 and CP12 §5.59 belong to F-AUTH-1's
  register.** §51 is minted in v1.48; section numbers and their minting revision
  numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

The ORM probe was run to measure XK-2's extent on the surface XK-2's own probe
could not see. **It did not find XK-2. It found something else**, and the
difference between those two outcomes is the whole content of this revision.

XK-2 is a scope value dropped between a read and a write. This shape is a route
with no scope value to drop. They look alike in a diff and they are not alike in a
remedy: **you can fix XK-2 by writing a predicate, and you cannot fix
`PUT /feed-posts/:postId` that way, because there is nothing to put in it.** That
is why v1.47 held one instance out of the count, and why seven instances make the
case stronger rather than making it time to merge them.

**The measurement's honest limits are worth stating twice.** This population was
chosen because XK-2's probe was blind to it — not because it was where this shape
lives. Seven sites is what was found in ten files selected for a different reason.
And XK-2's ORM-surface extent is exactly as unmeasured now as it was before, since
a route addressed by a child id cannot carry XK-2 at all.

**What the codebase shows, across both passes, is uneven care rather than
absent care.** A 22-field allowlist, a `plan.locked` guard returning 409, and 29
correctly scoped statements in `uiOverlayRoutes.js` sit beside a destroy on a
caller-supplied episode id. The discipline is real at the field and state layers
and missing at the tenancy layer. **That is a fixable shape of problem, and it
suggests the remedy is a convention rather than a hundred individual patches.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `e01c3b26` (#1021). Predecessor: v1.47.*
*Minted: §51. Recorded: a second scope shape, unowned and unnumbered. Closed: nothing. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
