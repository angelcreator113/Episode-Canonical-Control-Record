# F-Stats-1 Fix Plan v1.49
*Additive-supersede on v1.48. Mints §52. Extends the second shape's instance record. Mints no finding.*

## What changed in v1.49

**A bounded slice was taken under a stated selection rule** — §52.1. The second
shape's population is **120 route files**, which is a program rather than a
session. The rule taken: **destructive writes only.**

**Three new instances, all in `episodes.js`.** The second shape now stands at
**9 handlers, 10 sites, 6 files.**

**`episodes.js:239` is the sharpest instance found in either shape** — a
`force: true` hard delete of every scene on a caller-supplied episode, replaced
from the request body, atomically. §52.3.

**The mount-level hole is closed for three instances and OPEN for seven** —
§52.5. `/api/v1/episodes` is a bare mount with no middleware. **The other five
files' mounts were not read**, and a prior claim that all ten rulings were
mount-verified is **withdrawn**.

**The reads slice is explicitly owed** — §52.6. Rule 2 catches unrecoverable
writes and misses every cross-tenant read, including `wardrobe.js:173`, which is
already an instance of this shape.

---

## §52 — the destructive-write slice

### §52.1 Selection rule, and why one was needed

The second shape's population is **routes that do not carry `:showId`**:

| | Count |
|---|---|
| `.js` files under `src/routes/` | 142 |
| Carrying `:showId` | 22 |
| **Complement — this shape's population** | **120** |

`worldEvents.js` alone took three revisions to disposition. **120 files is a
program.** A survey would either be dishonest about its coverage or take dozens of
sessions.

**Three candidate rules were considered and one taken:**

| Rule | Note |
|---|---|
| Highest-consequence tables | Ties to keystone surfaces with existing owners |
| **Destructive writes only** | **Taken.** Smallest probe, highest per-hit stakes, one-line rule |
| Largest files first | Mechanical, but unrelated to consequence |

**Rule 2's rationale:** a delete on the wrong tenant is unrecoverable in a way a
read is not, and the result is informative either way — if destructive writes
across 120 files are mostly tenant-guarded, the shape is bounded; if not, that is
the finding without needing 120 files of reading.

**Rule 2's cost is stated, not hidden.** It misses every cross-tenant read. See
§52.6.

### §52.2 The slice

Probe: `\.destroy\(|DELETE FROM` — covering `Model.destroy({ where })`,
`instance.destroy()`, and raw SQL, per v1.48 §51.6's finding that a `where`-form
probe misses the dominant ORM form.

| | Sites |
|---|---|
| All of `src/routes/` | 91 |
| In the 22 `:showId` files | 13 |
| **In the 120-file complement** | **78** |

**Destructive writes cluster in routes that do not carry a tenant parameter** —
78 of 91. Recorded as an observation; no causal claim is made.

**Distribution, top of the complement:**

`worldStudio.js` 13 · `storyteller.js` 8 · `sceneSetRoutes.js` 6 ·
`socialProfileRoutes.js` 5 · `tierFeatures.js` 5 · `continuityEngine.js` 4 ·
then `characterRegistry.js`, `stories.js`, `episodes.js`, `compositions.js` at 3
and a long tail.

**Long-tailed — no dominant file**, unlike `worldEvents.js` in the SQL population.

**`episodes.js` was read first, and not because it is largest.** `worldStudio.js`
tops the distribution and is **excluded on principle**: v1.44 §47.2 established it
has no show partition in its addressing at all, across 53 routes. Thirteen
destroys there are almost certainly not instances, and **probing a
non-partitioned domain for a missing tenant manufactures findings** — the error
v1.44 avoided and this revision does not reintroduce. The same caution applies to
`characterRegistry.js`, `universe.js`, and `relationships.js`.

`episodes.js` was chosen because `episodes` is show-partitioned beyond
question — `worldEvents.js` and `shows.js` both scope it — and because three sites
is a completable file.

**75 of the 78 sites are unread.** Not clean, not assessed, not counted.

### §52.3 The three new instances

**`POST /api/v1/episodes/:id/save` — site :239**

```
Episode.findByPk(id, { transaction: t })                                    // unscoped
Scene.destroy({ where: { episode_id: id }, transaction: t, force: true })   // hard delete
Scene.bulkCreate(scenes.map(...))                                           // from req.body
```

**`force: true` bypasses paranoid.** Every scene on the episode — titles,
durations, background URLs, character lists — is **permanently removed** and
replaced from the request body. There is no `deleted_at` row to recover from.

Compare `wardrobeEventRoutes.js:282`, v1.48's sharpest: that destroys **link**
rows, recoverable by re-locking an outfit. **This destroys content.**

Route: `validateUUIDParam('id')`, `requireAuth`, **no tenant parameter**.

This is v1.48 §51.6 note 2 exactly — **atomicity around the wrong rows.** The
destroy-and-recreate is correctly transactional and correctly wrong-tenant. A
transaction guarantees all-or-nothing; it does not guarantee whose.

**`DELETE /:id/wardrobe-defaults/:character` — site :882**

`EpisodeWardrobeDefault.destroy({ where: { episode_id, character_name } })` on two
caller-supplied path params. One row, no `force`, recoverable if the model is
paranoid. `episode_wardrobe_defaults` is on **XK-1's reach list** under F-Ward-1.

**`DELETE /:episodeId/scene-sets/:setId` — site :1142**

`SceneSetEpisode.destroy({ where: { episode_id, scene_set_id } })`. A junction
row, recoverable by re-linking. This is the table `worldEvents.js`'s inject
handler writes with a partial-index upsert — §16.1 statements 5 and 8, both
WITHDRAW.

**Input validation is inconsistent within this one file.** :239 has
`validateUUIDParam('id')`; :882 has none; :1142 validates `episodeId` and not
`setId`. **The same unevenness the audit has recorded at the scoping and
field-allowlist layers, now at the input-validation layer.**

### §52.4 The record so far

| File | Handlers | Sites |
|---|---|---|
| `episodes.js` | 3 | 3 |
| `feedPostRoutes.js` | 2 | 2 |
| `sceneStudioEpisodeRoutes.js` | 1 | 2 |
| `wardrobe.js` | 1 | 1 |
| `wardrobeEventRoutes.js` | 1 | 1 |
| `editMaps.js` | 1 | 1 |
| **Total** | **9** | **10** |

**Surfaces:** F-Ward-1 (`wardrobe.js`, `wardrobeEventRoutes.js`,
`episodes.js`'s `episode_wardrobe_defaults`); an F-AUTH-1 adjacency at
`editMaps.js` (PE #9 candidate marker, reported at v1.48 §51.3, not claimed);
`feedPostRoutes.js`, `sceneStudioEpisodeRoutes.js`, and `episodes.js`'s other two
sites **unassigned and not asserted otherwise.**

**Still unminted, unowned, unnumbered.** v1.48 §51.5's option 3 stands.

### §52.5 Mount verification — 3 closed, 7 OPEN

**Every ruling in this shape assumes no mount-level middleware resolves tenancy
before the handler runs.** That assumption was unexamined across v1.48's seven
instances and was checked here.

**Verified:**

```
src/app.js:634   app.use('/api/v1/episodes', episodeRoutes);
```

**A bare mount.** No middleware between path and router. **`episodes.js`'s three
instances are mount-verified.**

**NOT verified — and a prior claim is withdrawn.** In session, after reading the
above, this author stated that "the ten rulings stand." **That was wrong.** The
grep matched `episodes` heavily and was truncated at fifteen lines before any
`feed-posts` or `edit-maps` mount line could appear. **One mount was read and ten
rulings were generalised from it.**

**Seven instances remain mount-unverified** — those in `wardrobe.js`,
`wardrobeEventRoutes.js`, `editMaps.js`, `feedPostRoutes.js`, and
`sceneStudioEpisodeRoutes.js`. **A mount-level guard on any of those paths would
invalidate its instances**, and none has been ruled out. Recorded as owed.

**Method note.** This is the session's recurring failure in a new position: a
check that covered part of a population, reported as covering the population. It
joins §28's `Measure-Object -Line` hazard, §43.7's null-control hazard, §46.4's
shape-without-model hazard, and §47.6's malformed-probe hazard. **Caught by
re-reading the output rather than the conclusion.**

**Observation, unminted:** `/api/v1/episodes` is mounted **three times** —
`episodeRoutes` (:634), `timelineDataRoutes` (:638), and `wardrobeApprovalRoutes`
(:756, conditionally). Express resolves by registration order, so a path collision
between these routers resolves silently to whichever registered first.
`timelineData.js` is among the ten files the pre-push validator flags for missing
`try`/`catch`. **Not assessed; recorded for whoever owns that surface.**

### §52.6 The reads slice — owed, and stated so it is not forgotten

**Rule 2 was chosen knowing what it misses.** It finds unrecoverable writes and
**no reads at all**.

That gap is not hypothetical: **`wardrobe.js:173` is a read**, it is already a
confirmed instance of this shape, and Rule 2 would never have found it — it
surfaced from v1.47's SQL probe. Cross-tenant reads leak canon; they simply do not
destroy it.

**A reads slice over the same 120-file complement is owed.** The trade taken here
is deliberate and is recorded as a trade: **destructive writes first because they
are unrecoverable, reads second because they are not.** Neither this revision nor
v1.48 measures the read surface.

---

## What this revision does not do

- **Does not mint any finding.** The second shape remains unnamed in the register,
  unowned, and unnumbered. v1.48 §51.5's option 3 stands.
- Does not amend XK-2's Cross-Keystone Register entry. Its owed amendments carry
  unchanged from v1.47 §50.3 and §50.5.
- Does not rule whether this shape and XK-2 are one finding. v1.48 §51.4 states
  the argument for separation; no ruling is taken.
- **Does not survey the 120-file complement.** 75 of 78 destructive sites are
  unread and are **not asserted clean.**
- Does not probe `worldStudio.js`, `characterRegistry.js`, `universe.js`, or
  `relationships.js` for this shape. Their domains sit above show partitioning
  per v1.44 §47.2 and probing them would manufacture findings.
- **Does not measure the read surface.** §52.6.
- **Does not verify seven instances' mount configurations.** §52.5.
- Does not assess the triple mount at `/api/v1/episodes`, or
  `wardrobeApprovalRoutes`' mount condition.
- Does not measure XK-2's ORM-surface extent; it remains unmeasured per
  v1.47 §50.4 and v1.48 §51.6.
- Does not assess, reopen, or claim anything about F-AUTH-1, PE #9, F-Ward-1, or
  F-Sec-3.
- Does not disposition any statement. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not propose or evaluate a remedy for either shape.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.49 | 2026-08-15 | **A bounded slice taken under a stated rule** — the second shape's population is **120 route files** (142 total, 22 carrying `:showId`), which is a program not a session; **Rule 2 taken: destructive writes only**, chosen because a wrong-tenant delete is unrecoverable and the result informs either way. Probe `\.destroy\(|DELETE FROM` returns **91 sites in `src/routes/`, 78 in the complement, 13 in the `:showId` files** — destructive writes cluster in routes carrying no tenant parameter. Distribution long-tailed, no dominant file. **`worldStudio.js` (13, top of distribution) excluded on principle** per v1.44 §47.2 — probing a non-partitioned domain manufactures findings; same for `characterRegistry.js`, `universe.js`, `relationships.js`. **`episodes.js` read: 3 sites, 3 instances.** **`episodes.js:239` is the sharpest instance in either shape** — `Scene.destroy({ where: { episode_id: id }, force: true })` hard-deletes every scene on a caller-supplied episode and `bulkCreate`s replacements from `req.body`, atomically; `force: true` bypasses paranoid so there is no `deleted_at` to recover from; **atomicity around the wrong rows** per v1.48 §51.6 note 2. Also :882 (`EpisodeWardrobeDefault`, on XK-1's reach list) and :1142 (`SceneSetEpisode`, the §16.1 partial-index-upsert table). **Input validation inconsistent within one file** — `validateUUIDParam` on :239, absent on :882, partial on :1142. **Second shape now at 9 handlers / 10 sites / 6 files.** **§52.5 mount verification: 3 closed, 7 OPEN.** `src/app.js:634` is a bare mount, closing the hole for `episodes.js`. **A prior in-session claim that all ten rulings were mount-verified is WITHDRAWN** — the grep was truncated at fifteen lines and one mount was generalised to ten; the other five files' mounts are unread and a guard on any would invalidate its instances. Observation: `/api/v1/episodes` is mounted **three times** (:634, :638, :756 conditional), resolving by registration order. **§52.6: the reads slice is owed and the trade is recorded** — Rule 2 finds no reads, and `wardrobe.js:173` is a read that is already an instance. 75 of 78 sites unread and not asserted clean. Mints no FD, no XK. No live DB contact. Prod FROZEN, untouched. §52 minted. Basis `8c7d74af`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.48. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged.
- Mints: **§52**.
- Closes: **nothing**.
- Extends: the **second scope shape**'s instance record to 9 handlers / 10 sites /
  6 files. Still unminted, unowned, unnumbered.
- Records: §52.1's selection rule and its stated cost; §52.5's mount verification
  and the **withdrawal** of the all-ten claim; §52.5's triple-mount observation;
  §52.3's input-validation inconsistency.
- **Withdraws:** an in-session claim that all ten of the second shape's rulings
  were mount-verified. **Three are; seven are not.**
- Owes, explicitly: the **reads slice** over the same complement (§52.6); mount
  verification for seven instances (§52.5); the 75 unread destructive sites.
- Carries: XK-2's owed amendments (Reach, sub-form 3 wording, extent statement);
  §35.5's classes 2–6, unminted and homing-owed; the class 2 candidate at
  `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`;
  the three unread write sites and `feedPipelineRoutes.js`'s unexplained zero from
  v1.48; open items 22, 24, 6; all other items carried from v1.48. Open items 41
  and 23 remain **CLOSED** per v1.43.
- Defers: both shapes' homing; XK-2's ORM-surface extent, remedy and sequence
  position; classes 2–6's reach; §39.4 defect 1 (label-only) and defect 3
  (unruled); §44.8; XK-1's remedy and population question.
- Forward-points: the triple mount at `/api/v1/episodes`; `wardrobeApprovalRoutes`'
  mount condition. Recorded, not adopted.
- Changes no unit disposition, no PR state, no gate. **The Cross-Keystone Register
  is not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.48; no destructive rewrite.
- **Numeral disambiguation:** *XK-1 and XK-2 (Cross-Keystone Register)* are
  unrelated to FD-1/FD-2, §1/§2, or any open item 1/2. **PE #9 and CP12 §5.59
  belong to F-AUTH-1's register.** §52 is minted in v1.49; section numbers and
  their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

The second shape's population is 120 files. **This revision reads three sites in
one of them**, under a rule stated before the reading started, and says so rather
than presenting ten instances as a measurement.

**What the slice found is worth the narrowness.** `episodes.js:239` hard-deletes
every scene on any episode UUID an authenticated caller supplies, replaces them
from the request body, and does it inside a transaction. The transaction is
correct. The UUID validation is correct. The auth is correct. **The only thing
missing is any notion of whose episode it is** — and that is the shape, stated as
cleanly as it has been stated anywhere.

**The mount check is the more useful methodological result.** Ten rulings rested
on an assumption nobody had examined; one mount was read and the conclusion was
generalised to all of them within the same session. Three are verified. **Seven
are not, and saying so is the difference between a record and a claim.**

Rule 2 was chosen for what it catches. **It catches nothing that only reads**, and
`wardrobe.js:173` — an instance of this shape found by a different probe entirely —
is the standing proof that the read surface holds instances Rule 2 will never
return. That slice is owed, and it is written here so that it is owed in the
register rather than in someone's memory of this session.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `8c7d74af` (#1022). Predecessor: v1.48.*
*Minted: §52. Extended: the second shape's instance record. Withdrawn: an in-session mount-verification claim. Closed: nothing. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
