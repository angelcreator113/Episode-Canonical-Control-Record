# F-Stats-1 Fix Plan v1.50
*Additive-supersede on v1.49. Mints §53. Closes v1.49 §52.5's open item. Corrects v1.49 §52.5.*

## What changed in v1.50

**v1.49 §52.5's open item is CLOSED.** All seven mount-unverified instances of
the second shape are now verified. **Every mount is bare** — no middleware between
path and router. **The second shape's ten rulings hold on both tenancy and
reachability.**

**v1.49 §52.5's "conditionally mounted" characterisation is WITHDRAWN.** The
indented mounts sit inside `try`/`catch` **load-failure guards**, not conditionals.
They execute unconditionally unless the `require` throws.

**v1.49 §52.5's mount count is CORRECTED: `/api/v1/episodes` carries 11 routers,
not 3.** The figure came from a truncated grep.

**A prior in-session claim that `evaluation.js`'s root mount was notable is
WITHDRAWN.** **17 routers mount at `/api/v1`.** Root mounting is this
application's norm.

**A method note on how three wrong counts were produced in one session** —
§53.5. All three were caught before the register. **One would have been a
correction to a figure that was already right.**

---

## §53 — mount verification, closed

### §53.1 Basis

Basis `baf80537` (v1.49, #1023). Read from `src/app.js` at that basis via
`git show origin/main:` and `git grep`. No live database contact.

### §53.2 The seven mounts — all bare

v1.49 §52.5 verified `episodes.js`'s mount and left seven instances unverified
across five files. **All five paths are now read:**

| Line | Mount | Instances covered |
|---|---|---|
| 748 | `app.use('/api/v1/wardrobe', wardrobeRoutes)` | `wardrobe.js:173` |
| 817 | `app.use('/api/v1/edit-maps', editMapsRoutes)` | `editMaps.js:104` |
| 1495 | `app.use('/api/v1/wardrobe-events', wardrobeEventRoutes)` | `wardrobeEventRoutes.js:282` |
| 1504 | `app.use('/api/v1/scene-studio-episodes', sceneStudioEpisodeRoutes)` | `sceneStudioEpisodeRoutes.js:139, :148` |
| 1513 | `app.use('/api/v1/feed-posts', feedPostRoutes)` | `feedPostRoutes.js:186, :200` |

**Every one is a bare two-argument mount.** No middleware sits between the path
and the router in any case. **No mount-level tenancy resolution exists on any path
carrying an instance of the second shape.**

**v1.49 §52.5's open item is CLOSED.** The second shape's **10 sites across 9
handlers in 6 files** are mount-verified in full.

### §53.3 The `try`/`catch` pattern — v1.49's wording withdrawn

Three of the five mounts are indented. v1.49 §52.5 recorded
`wardrobeApprovalRoutes` (:756) as *"conditionally"* mounted on the same visual
cue. **The indentation is not a conditional.** The shape is:

```
try {
  const wardrobeEventRoutes = require('./routes/wardrobeEventRoutes');
  app.use('/api/v1/wardrobe-events', wardrobeEventRoutes);
  console.log('✓ Wardrobe Events loaded at /api/v1/wardrobe-events');
} catch (e) {
  console.error('✗ Failed to load Wardrobe Event routes:', e.message);
}
```

**A load-failure guard.** The `app.use` executes unconditionally; the `catch` fires
only if `require` throws. `wardrobeApprovalRoutes` (:756) uses the same pattern.

**Consequence for the record:** there is no deployment configuration in which
these routers are absent while the module loads. **v1.49's implied reachability
qualifier is not owed and is withdrawn.** The instances are as reachable as those
on flush-left mounts.

**Observation, unminted — a fail-open mount pattern.** A route file that throws on
`require` disappears from the API silently: the app starts, logs
`✗ Failed to load`, and serves 404s for that surface. **Availability shape, not a
security one.** Recorded for whoever owns deployment; **F-Deploy-1 is not assessed
and no claim is made on it.**

### §53.4 Two counts corrected

**`/api/v1/episodes` carries 11 routers, not 3.**

| Line | Router | | Line | Router |
|---|---|---|---|---|
| 634 | `episodeRoutes` | | 826 | `scriptParseRoutes` |
| 638 | `timelineDataRoutes` | | 860 | `gameShowRoutes` |
| 756 | `wardrobeApprovalRoutes` | | 938 | `iconCueRoutes` |
| 803 | `scriptGeneratorRoutes` | | 939 | `cursorPathRoutes` |
| 809 | `lalaScriptRoutes` | | 940 | `musicCueRoutes` |
| | | | 941 | `productionPackageRoutes` |

**Express resolves by registration order across all eleven.** If any two define
the same sub-path, the later registration is unreachable and nothing reports it.
`scriptGeneratorRoutes` (:803) and `lalaScriptRoutes` (:809) both concern script
generation on episodes and are the natural first pair to examine. **Not examined
here.**

**Relevant to the second shape:** `gameShows.js` and `scriptGenerator.js` are both
in its 120-file population and both mount on this prefix. Their routes are
`/api/v1/episodes/...` — child-addressed, no tenant — consistent with the shape.
**Neither has been read and neither is counted.**

**Root mounting is the norm, not an exception.** A prior in-session claim treated
`app.use('/api/v1', evaluationRoutes)` as a distinctive mount shape. **17 routers
mount at `/api/v1`**, including `worldEventRoutes`, `worldStudioRoutes`,
`worldRoutes`, `arcRoutes`, `careerGoalRoutes`, `opportunityRoutes`,
`franchiseBrainRoutes` and `todoListRoutes`. **The claim is withdrawn.**

### §53.5 Method note — three wrong counts in one session

Three counts were asserted from truncated or unread output in this session. **All
three were caught before reaching the register.**

| Claim | Actual | How it was produced |
|---|---|---|
| "the ten rulings stand" (mount-verified) | 3 verified, 7 not | One mount read; grep truncated at 15 lines; generalised to ten |
| "`/api/v1/episodes` is mounted three times" | **11** | Same truncated grep, counted as complete |
| "four mounts, and whatever else may share it" | **11** | Speculation appended to a count, then restated as a count |

**The third is the instructive one.** v1.49 recorded three mounts. The in-session
correction to "four" was **a correction to a figure that was itself wrong, made
from a guess, in the direction of a number that was also wrong.** Had it been
drafted, the register would have carried a confident correction replacing one
error with another.

**The failure mode is not arithmetic.** It is narrating a count while reading
output that was cut off, and treating the narration as the measurement. The
distinguishing move in each case was **re-reading the output rather than the
conclusion** — and in the third, refusing to draft until a bare
`git grep -n` returned the lines to be counted.

This joins §28's `Measure-Object -Line` hazard, §43.7's null-control hazard,
§46.4's shape-without-model hazard, §47.6's malformed-probe hazard, and
§52.5's partial-population hazard. **They are one hazard in five costumes: a
result that describes the instrument rather than the subject.**

---

## What this revision does not do

- Does not mint any finding. **The second shape remains unminted, unowned, and
  unnumbered**; v1.48 §51.5's option 3 stands.
- Does not amend XK-2's Cross-Keystone Register entry. Its owed amendments carry
  unchanged from v1.47 §50.3 and §50.5.
- Does not add or remove any instance. **The second shape stands at 9 handlers /
  10 sites / 6 files** per v1.49 §52.4.
- Does not read `gameShows.js` or `scriptGenerator.js`, or count them.
- Does not examine the `scriptGeneratorRoutes` / `lalaScriptRoutes` sub-path
  overlap, or any other collision among the eleven.
- Does not survey the remaining **75 unread destructive sites**; they are not
  asserted clean.
- **Does not measure the read surface.** The reads slice remains owed per
  v1.49 §52.6.
- Does not measure XK-2's ORM-surface extent.
- Does not assess F-Deploy-1, F-AUTH-1, F-Ward-1, or F-Sec-3. The fail-open mount
  pattern is recorded, not assigned.
- Does not disposition any statement. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not propose or evaluate a remedy for either shape.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.50 | 2026-08-15 | **v1.49 §52.5's open item CLOSED.** All seven previously unverified mounts read at `src/app.js`: `/api/v1/wardrobe` (:748), `/api/v1/edit-maps` (:817), `/api/v1/wardrobe-events` (:1495), `/api/v1/scene-studio-episodes` (:1504), `/api/v1/feed-posts` (:1513). **Every one is a bare two-argument mount** — no middleware between path and router, no mount-level tenancy resolution anywhere. **The second shape's 10 sites / 9 handlers / 6 files are mount-verified in full**, on tenancy and reachability both. **v1.49's "conditionally mounted" characterisation WITHDRAWN** — the indented mounts sit inside `try`/`catch` **load-failure guards**; `app.use` executes unconditionally and the `catch` fires only if `require` throws, so no deployment configuration omits them while the module loads. Recorded unminted: a **fail-open mount pattern** — a route file throwing on `require` disappears from the API silently, the app logging `✗ Failed to load` and serving 404s; availability shape, F-Deploy-1 not assessed. **v1.49's mount count CORRECTED 3 → 11**: `/api/v1/episodes` carries `episodeRoutes`, `timelineDataRoutes`, `wardrobeApprovalRoutes`, `scriptGeneratorRoutes`, `lalaScriptRoutes`, `scriptParseRoutes`, `gameShowRoutes`, `iconCueRoutes`, `cursorPathRoutes`, `musicCueRoutes`, `productionPackageRoutes`, resolving by registration order; `scriptGeneratorRoutes` (:803) and `lalaScriptRoutes` (:809) both concern episode script generation and are the natural first collision candidates, **not examined**. `gameShows.js` and `scriptGenerator.js` are in the second shape's population and mount here — **unread, uncounted.** **A prior in-session claim that `evaluation.js`'s root mount was notable is WITHDRAWN — 17 routers mount at `/api/v1`** and root mounting is this application's norm. **§53.5 method note: three wrong counts were asserted in this session and all three caught before the register**, the third being a guessed "correction" to a figure that was already wrong, in the direction of another wrong figure; **the failure mode is narrating a count while reading truncated output**, and the distinguishing move each time was re-reading the output rather than the conclusion. Mints no FD, no XK. No live DB contact. Prod FROZEN, untouched. §53 minted. Basis `baf80537`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.49. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged.
- Mints: **§53**.
- **Closes: v1.49 §52.5's mount-verification open item.** All seven instances
  verified; every mount bare.
- **Corrects v1.49 §52.5:** the `/api/v1/episodes` mount count, **3 → 11**.
- **Withdraws:** v1.49 §52.5's *"conditionally mounted"* characterisation of
  `wardrobeApprovalRoutes`; an in-session claim that `evaluation.js`'s root mount
  was distinctive.
- Records, unminted: the **fail-open mount pattern**; the eleven-router prefix and
  its order-dependent resolution; the `scriptGeneratorRoutes` / `lalaScriptRoutes`
  collision candidate; §53.5's method note.
- Changes **no instance count**. The second shape stands at 9 handlers / 10 sites /
  6 files, unminted and unowned.
- Carries: XK-2's owed amendments; the **reads slice** (v1.49 §52.6); the **75
  unread destructive sites**; §35.5's classes 2–6, unminted and homing-owed; the
  class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3 instance report at
  `wardrobe.js:1233`; `feedPipelineRoutes.js`'s unexplained zero; the three unread
  write sites from v1.48; open items 22, 24, 6; all other items carried from
  v1.49. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: both shapes' homing; XK-2's ORM-surface extent, remedy and sequence
  position; classes 2–6's reach; §39.4 defect 1 (label-only) and defect 3
  (unruled); §44.8; XK-1's remedy and population question.
- Forward-points: `gameShows.js` and `scriptGenerator.js` as second-shape
  population members mounting on `/api/v1/episodes`; the eleven-router collision
  surface. Recorded, not adopted.
- Changes no unit disposition, no PR state, no gate. **The Cross-Keystone Register
  is not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.49; no destructive rewrite. v1.49's body is not
  modified; its corrections live here.
- **Numeral disambiguation:** *XK-1 and XK-2 (Cross-Keystone Register)* are
  unrelated to FD-1/FD-2, §1/§2, or any open item 1/2. §53 is minted in v1.50;
  section numbers and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

v1.49 shipped with seven rulings resting on an unexamined assumption and said so.
**This revision examines it, and the assumption held** — every mount carrying a
second-shape instance is bare, so no middleware resolves tenancy before those
handlers run and the ten rulings stand as recorded.

**Two things v1.49 got wrong are corrected here, and both were cheap to find.**
The indented mounts are `try`/`catch` load guards rather than conditionals, so no
reachability qualifier was ever owed. And `/api/v1/episodes` carries eleven
routers rather than three — a figure that came from a grep cut off at fifteen
lines and was never re-run.

**The method note is the part worth carrying forward.** Three counts were asserted
from truncated output in a single session. The third was the sharpest: a confident
in-session "correction" from three to four, made without re-reading, aimed at a
number that was neither. **Had it been drafted it would have replaced one wrong
figure with another and called that a fix.**

Five hazards are now on this register — `Measure-Object -Line`, null controls,
shape-without-model, malformed probes, partial populations — and this makes a
sixth position for the same failure. **They are one hazard: a result that
describes the instrument rather than the subject.** The remedy has been identical
every time and it is not cleverness. It is re-reading the output instead of the
conclusion, before the conclusion is written down.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `baf80537` (#1023). Predecessor: v1.49.*
*Minted: §53. Closed: v1.49 §52.5's mount-verification item. Corrected: v1.49's `/api/v1/episodes` mount count, 3 → 11. Withdrawn: v1.49's "conditionally mounted" wording. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
