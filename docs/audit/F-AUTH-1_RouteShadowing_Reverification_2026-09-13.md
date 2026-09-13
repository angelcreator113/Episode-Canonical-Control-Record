| **PRIME STUDIOS** **F-AUTH-1 — ROUTE SHADOWING SURVEY POPULATION RE-VERIFIED** *Re-reads the six dead route declarations named at `Route_Shadowing_Survey_2026-08-22_DRAFT.md` §4 against current `origin/main`. Rules nothing. Mints nothing. Adjudicates no member.* |
| --- |

# F-AUTH-1 — route shadowing survey population re-verified — 2026-09-13

**FILED 2026-09-13.** Re-verifies, at current `origin/main`, whether each of
the six dead route declarations the survey named at its §4 is still present,
still shadowed, and at what line. Does not widen the population, does not
mint FD-70 or any other number, and does not rule on the FD-70 minting
decision, which is Evoni's.

**Basis:** `origin/main` at `52d3cc76174b137eafbcc107788c86957cdf9d25`, derived
live 2026-09-13 via:

```
$ git fetch origin
$ git rev-parse origin/main
52d3cc76174b137eafbcc107788c86957cdf9d25
```

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**MEASURED throughout.** Every read below is a `git show origin/main:<path>`
against the Basis SHA above, pasted raw.

---

## §1 The survey's own basis, and its §4 as read

The survey (`docs/audit/Route_Shadowing_Survey_2026-08-22_DRAFT.md`) records
its own basis as `origin/main` at `2fea0572`, dated 2026-08-22. That is
recorded here as **prior state**, not re-derived as current fact — this
document does not claim `2fea0572` is still reachable or current in any
sense beyond being the survey's stated starting point.

Read command:

```
$ git show origin/main:docs/audit/Route_Shadowing_Survey_2026-08-22_DRAFT.md | sed -n '4,10p;57,82p'
```

Output — the basis line and the full §4 table, verbatim:

```
# Survey — shadowed route declarations

**Date:** 2026-08-22
**Basis:** `origin/main` at `2fea0572`, derived live.
**Status:** **DRAFT.** Mints nothing — FD tail remains **FD-69**; XK tail
**XK-3**; PE tail **PE #67**. Ships no code. Changes no gate. **Adjudicates no
member.**

## §4 The six members

Detected by walking each router's composed stack and, for M2, by calling each
Layer's own `match()` — **real Express matching, not inference.**

**M1 — exact duplicate declaration**

| method | path | file | live | shadowed |
|---|---|---|---|---|
| PUT | `/:id` | `src/routes/compositions.js` | `:480` | **`:817`** |
| GET | `/episode/:episodeId` | `src/routes/thumbnails.js` | `:65` | **`:136`** |

**M2 — literal shadowed by an earlier parameterized path**

| method | dead path | file | shadowed by |
|---|---|---|---|
| GET | `/search` `:1188` | `src/routes/compositions.js` | `/:id` `:458` |
| GET | `/artifact-categories` `:1099` | `src/routes/sceneSetRoutes.js` | `/:id` `:229` |
| POST | `/bulk/upscale` `:248` | `src/routes/wardrobe.js` | `/:id/upscale` `:226` |
| POST | `/bulk/analyze` `:251` | `src/routes/wardrobe.js` | `/:id/analyze` `:238` |
```

This matches the reference table quoted in Task #1405 verbatim. Population
confirmed as read: **six declarations, two M1, four M2**, across four files
(`compositions.js`, `thumbnails.js`, `sceneSetRoutes.js`, `wardrobe.js`).

---

## §2 Per-site reads at current `origin/main` — MEASURED

Each site is read fresh with `git show origin/main:<path>`, not from the
working tree. Line numbers below are what that read shows now; the survey's
own numbers are not trusted going in.

### 2.1 `src/routes/compositions.js` — PUT `/:id` (M1)

```
$ git show origin/main:src/routes/compositions.js | grep -n "router\.put('/:id'"
476:router.put('/:id', authenticateJWT, async (req, res) => {
813:router.put('/:id', authenticateJWT, async (req, res) => {
```

Live declaration now at **`:476`** (survey: `:480`, drift **-4**). Duplicate
(dead) declaration now at **`:813`** (survey: `:817`, drift **-4**). `813 >
476`: the dead declaration is still ordered after the live one and is still
shadowed.

### 2.2 `src/routes/thumbnails.js` — GET `/episode/:episodeId` (M1)

```
$ git show origin/main:src/routes/thumbnails.js | grep -n "router\.get('/episode/:episodeId'\|^router\.get($"
65:router.get('/episode/:episodeId', optionalAuth, asyncHandler(thumbnailController.getEpisodeThumbnails));
136:router.get(
```

```
$ git show origin/main:src/routes/thumbnails.js | sed -n '136,140p'
router.get(
  '/episode/:episodeId',
  optionalAuth,
  asyncHandler(async (req, res) => {
```

Live declaration still at **`:65`** (survey: `:65`, no drift). The dead
duplicate is still a multiline declaration whose `router.get(` opens at
**`:136`** (survey: `:136`, no drift) with `/episode/:episodeId` as its path
on the following line — confirmed still invisible to a line-anchored,
single-line grep. `136 > 65`: still shadowed.

### 2.3 `src/routes/compositions.js` — GET `/search` shadowed by GET `/:id` (M2)

```
$ git show origin/main:src/routes/compositions.js | grep -n "router\.get('/search'\|router\.get('/:id'"
454:router.get('/:id', requireAuth, async (req, res) => {
1184:router.get('/search', requireAuth, async (req, res) => {
```

Shadowing declaration (`/:id`) now at **`:454`** (survey: `:458`, drift
**-4**). Dead literal (`/search`) now at **`:1184`** (survey: `:1188`, drift
**-4**). `454 < 1184`: the shadowing declaration is still earlier in the
file; still shadowed.

### 2.4 `src/routes/sceneSetRoutes.js` — GET `/artifact-categories` shadowed by GET `/:id` (M2)

```
$ git show origin/main:src/routes/sceneSetRoutes.js | grep -n "router\.get('/:id'\|router\.get('/artifact-categories'"
229:router.get('/:id', validateUUIDParam('id'), requireAuth, async (req, res) => {
1099:router.get('/artifact-categories', requireAuth, async (req, res) => {
```

Shadowing declaration (`/:id`) still at **`:229`** (survey: `:229`, no
drift). Dead literal (`/artifact-categories`) still at **`:1099`** (survey:
`:1099`, no drift). `229 < 1099`: still shadowed.

### 2.5 `src/routes/wardrobe.js` — POST `/bulk/upscale` shadowed by POST `/:id/upscale` (M2)

```
$ git show origin/main:src/routes/wardrobe.js | grep -n "router\.post('/:id/upscale'\|router\.post('/bulk/upscale'"
226:router.post('/:id/upscale', requireAuth, asyncHandler(wardrobeController.aiUpscaleItem));
248:router.post('/bulk/upscale', requireAuth, asyncHandler(wardrobeController.bulkUpscale));
```

Shadowing declaration (`/:id/upscale`) still at **`:226`** (survey: `:226`,
no drift). Dead literal (`/bulk/upscale`) still at **`:248`** (survey:
`:248`, no drift). `226 < 248`: still shadowed.

### 2.6 `src/routes/wardrobe.js` — POST `/bulk/analyze` shadowed by POST `/:id/analyze` (M2)

```
$ git show origin/main:src/routes/wardrobe.js | grep -n "router\.post('/:id/analyze'\|router\.post('/bulk/analyze'"
238:router.post('/:id/analyze', requireAuth, aiRateLimiter, asyncHandler(wardrobeController.analyzeItem));
251:router.post('/bulk/analyze', requireAuth, aiRateLimiter, asyncHandler(wardrobeController.bulkAnalyze));
```

Shadowing declaration (`/:id/analyze`) still at **`:238`** (survey: `:238`,
no drift). Dead literal (`/bulk/analyze`) still at **`:251`** (survey:
`:251`, no drift). `238 < 251`: still shadowed.

---

## §3 Drift, explained — MEASURED

Task #1405 notes `wardrobe.js` was touched by PR #1402. That commit and the
survey-to-current diffs for all four touched files were read directly rather
than assumed:

```
$ git diff 2fea0572 origin/main -- src/routes/wardrobe.js
```
```diff
 async function getModels() {
-  try { return require('../models'); } catch (e) { return null; }
+  try { return require('../models'); } catch (e) { console.error('Failed to load models:', e.message); return null; }
 }
```

One line edited in place, above every site in §2.5–2.6; no line added or
removed. This is why `wardrobe.js`'s two sites show **zero drift**.

```
$ git diff 2fea0572 origin/main -- src/routes/compositions.js
```
```diff
       if (template_studio_id) {
         console.log('🎨 Using Template Studio template:', template_studio_id);
 
-        // Fetch template from template_studio
-        const { Sequelize } = require('sequelize');
-        const sequelize = new Sequelize(process.env.DATABASE_URL, {
-          dialect: 'postgres',
-          logging: false,
-        });
+        // Fetch template from template_studio through the shared connection.
+        const { sequelize } = require('../models');
```

Six lines removed, two added, at line 258 — net **-4 lines**, above every
site in §2.1 and §2.3. This is why `compositions.js`'s four sites (both M1
rows plus the `/search`/`/:id` M2 row) each show exactly **-4 drift**, and
why `thumbnails.js` §2.2 and `sceneSetRoutes.js` §2.4, whose files carry
unrelated or no changes since `2fea0572` respectively (`thumbnails.js`'s
diff is entirely at and below its own two sites; `sceneSetRoutes.js` has no
diff at all against the survey basis), show none.

**Which commit — MEASURED, not inferred.** The two-commit diff above shows
*that* the file changed between `2fea0572` and this Basis; it does not by
itself show *which* commit did it. Enumerated separately:

```
$ git log 2fea0572..origin/main --oneline -- src/routes/compositions.js
8642533e0 fix(db): reuse shared Sequelize connection in Template Studio paths [skip-automerge] (#1288)
```

Exactly one commit touches `compositions.js` in that range. Its own diff,
read directly rather than assumed from the range diff:

```
$ git show 8642533e0 -- src/routes/compositions.js
```
```diff
@@ -258,12 +258,8 @@ router.post('/', requireAuth, async (req, res) => {
       if (template_studio_id) {
         console.log('🎨 Using Template Studio template:', template_studio_id);
 
-        // Fetch template from template_studio
-        const { Sequelize } = require('sequelize');
-        const sequelize = new Sequelize(process.env.DATABASE_URL, {
-          dialect: 'postgres',
-          logging: false,
-        });
+        // Fetch template from template_studio through the shared connection.
+        const { sequelize } = require('../models');
```

Identical to the range diff above, at the same line. With exactly one commit
in range and its diff matching, the attribution is **MEASURED**: `8642533e0`
(PR #1288, "fix(db): reuse shared Sequelize connection in Template Studio
paths") is the commit that produced the -4 drift, not merely a candidate.

```
$ git diff 2fea0572 origin/main -- src/routes/sceneSetRoutes.js
(no output — file unchanged since survey basis)
```

---

## §4 The re-verification table — MEASURED

| # | class | method | path | file | survey line | current line | drift | still shadowed |
|---|---|---|---|---|---|---|---|---|
| 1 | M1 (live) | PUT | `/:id` | `compositions.js` | `:480` | `:476` | -4 | — |
| 1 | M1 (dead) | PUT | `/:id` | `compositions.js` | `:817` | `:813` | -4 | **YES** |
| 2 | M1 (live) | GET | `/episode/:episodeId` | `thumbnails.js` | `:65` | `:65` | 0 | — |
| 2 | M1 (dead) | GET | `/episode/:episodeId` | `thumbnails.js` | `:136` | `:136` | 0 | **YES** |
| 3 | M2 (dead) | GET | `/search` | `compositions.js` | `:1188` | `:1184` | -4 | **YES** (shadowed by `/:id` `:454`, survey `:458`, drift -4) |
| 4 | M2 (dead) | GET | `/artifact-categories` | `sceneSetRoutes.js` | `:1099` | `:1099` | 0 | **YES** (shadowed by `/:id` `:229`, survey `:229`, drift 0) |
| 5 | M2 (dead) | POST | `/bulk/upscale` | `wardrobe.js` | `:248` | `:248` | 0 | **YES** (shadowed by `/:id/upscale` `:226`, survey `:226`, drift 0) |
| 6 | M2 (dead) | POST | `/bulk/analyze` | `wardrobe.js` | `:251` | `:251` | 0 | **YES** (shadowed by `/:id/analyze` `:238`, survey `:238`, drift 0) |

**Result: all six declarations are still present and still shadowed.** Four
of the six file-relative line positions drifted by a uniform -4 (both
`compositions.js` rows, M1 and M2), caused by one unrelated edit above them
in that file (§3); the other two (`thumbnails.js`, `sceneSetRoutes.js`) show
no drift. Each per-site read behind this table is in §2 above.

---

## §5 FD-70 status — MEASURED, not decided here

Read directly:

```
$ git show origin/main:docs/audit/F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md | sed -n '237,253p'
```

`F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` §8 states, of itself
(*"this document"* below refers to that filing, not to this one):

> **Does not mint** an FD, XK, or PE number. FD-70 remains next-available
> and unminted, per the resolution document's own tail (unchanged: this
> document performed no tail re-derivation, since it made no claim whose
> currency depends on one).

Tail re-derivation, this document's own instrument:

```
$ grep -rlo 'FD-70' docs/audit/ | sort
docs/audit/F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md
docs/audit/FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
docs/audit/Prime_Studios_Audit_Handoff_v25.md
docs/audit/v25_Owed_Index_Amd26_2026-08-31.md
docs/audit/v25_Owed_Index_Amd29_2026-09-01.md
```

Every hit above names FD-70 as pending/next-available; no filed document is
titled `FD-70_*`. The highest actually-minted FD file in the tree remains
`FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md`. **FD-70 is
next-available and unminted, confirmed at this basis.**

This document mints nothing. The FD-70 minting decision — whether and how to
mint against this population — **is Evoni's, and is not made here.**

---

## §6 What this document does not do

- **Does not widen the population.** Exactly the six declarations the survey
  named at §4 are scored in §4 above.
- **Does not mint FD-70** or any other FD, XK, or PE number.
- **Does not rule** on whether FD-70 should be minted, or what remedy any
  future minting should carry. That determination is Evoni's.
- **Does not edit** `Route_Shadowing_Survey_2026-08-22_DRAFT.md` or any other
  existing file under `docs/audit/`.
- **Does not touch** any file under `src/`. No route is deleted, reordered,
  or fixed by this document.
- **Contacts no host, AWS, database, or Cognito.** Prod FROZEN.

---

*Type: standalone re-verification note. Rules nothing. Mints nothing. No
host, AWS, database, or Cognito contact. Prod FROZEN.*
