| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP6 CONFIRMATION PASS** *One CP of twelve. 22 recorded dispositions read against code at CP6's own basis commit. 20/22 agree, 2/22 disagree — universe.js's Tier 1/Tier 4 split is recorded as 4+4 and reads as 5+3.* |
| --- |

# F-AUTH-1 Limb 1 — CP6 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP6 —
of the twelve-CP historical population Ruling 2 fixes. Seventh CP
confirmed; CP1, CP2, CP3, CP4, CP5, and CP10 were done separately. Per
Ruling 4, this is a durable partial result.

**Basis:** `origin/main` at `f92a4edade600d8412fb22dd0ac6726c5ac32418`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. **This pass finds
two `disagree` verdicts** (§4 rows 11–12) — the first of the seven CPs
confirmed so far to record one. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one
handler. Distinct classes at one scope are distinct dispositions** —
`characterRegistry.js (36 PROMOTE + 1 PRESERVE @ L1882)` is Ruling 1's own
worked example, and CP6 is where it comes from.

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation:**

> "Read what the CP ruled. Read the code it ruled about, at that CP's own
> basis. Record `agree` / `disagree` / `cannot-tell`."

**Ruling 4 (§5) — decomposable per CP, partial results hold.**

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN.** Not relied on
here.

---

# §2. Population — CP6's recorded dispositions, established

## §2.1 Locating CP6

```
$ git log --all --oneline --grep="CP6" -i | grep -i "Step 3 CP6"
ede4376bf docs(audit): F-AUTH-1 fix plan v2.31 — Step 3 CP6 closure ...
9892e6040 f-auth-1 step 3 CP6: Character cluster + universe Q13 — 13 files, ...

$ git log -1 --format='%H %ad %s' --date=short 9892e6040
9892e6040ea609dd3c16df6fa4cc519264edbb32 2026-05-07 f-auth-1 step 3 CP6: ...

$ git merge-base --is-ancestor 9892e6040 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P 9892e6040
1a2d433d069c3e86ecbdad5d900cbf420bcd00e3
```

**CP6's commit: `9892e6040ea609dd3c16df6fa4cc519264edbb32`, 2026-05-07,
confirmed an ancestor of `origin/main`.** Its parent is CP5's commit
directly.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b 9892e6040
```

Full body read (55 lines). The disposition-bearing content is a
"Source file inventory (13)" block, quoted in full:

> "characters.js (2 ADD), character-clips.js (5 ADD + TESTING banner
> removed), characterRegistry.js (36 PROMOTE + 1 PRESERVE @ L1882 + dual
> lazy-noop removed), characterAI.js (5 PROMOTE), characterFollowRoutes.js
> (7 PROMOTE + 3-level nested fallback removed), characterSparkRoute.js
> (5 PROMOTE + 1 AI POST), characterGrowthRoute.js (4 PROMOTE + 1 AI
> POST), universe.js (4 writes Tier 1 + 4 GETs Tier 4 PUBLIC — §5.21
> mixed-tier 2nd instance), characterGenerator.js (7 PROMOTE + 3 AI POSTs
> surface-corrected), characterDepthRoutes.js (5 PROMOTE + 2 AI POSTs
> surface-corrected), characterGenerationRoutes.js (6 PROMOTE router.use +
> 1 AI POST surface-corrected), wantFieldRoutes.js (2 PROMOTE router.use +
> 1 AI POST surface-corrected), characterCrossingRoutes.js (6 PROMOTE
> router.use + 1 AI POST surface-corrected)."

**This inventory line is the finest-granularity source for every row in
§2.4** — it names each of the 13 files and, for most, the internal
Tier-1/AI-POST split. Later "Surface-corrections logged" paragraphs revise
four of the counts (`characterGenerator.js`, `characterDepthRoutes.js`,
`characterGenerationRoutes.js`, `characterCrossingRoutes.js`,
`wantFieldRoutes.js`) to their final, as-landed figures — the inventory
line already reflects those corrected numbers.

## §2.3 The population: 22 recorded dispositions

Applying Ruling 1's own worked rule (distinct classes at one scope are
distinct dispositions) to every file the inventory itemizes:

| # | scope | class | recorded count |
|---|---|---|---|
| 1 | `characters.js` | Tier 1 ADD | 2 |
| 2 | `character-clips.js` | Tier 1 ADD | 5 |
| 3 | `characterRegistry.js` | Tier 1 PROMOTE | 36 |
| 4 | `characterRegistry.js` | PRESERVE @ L1882 (Tier 1 + `aiRateLimiter`) | 1 |
| 5 | `characterAI.js` | Tier 1 + `aiRateLimiter` (all 5 handlers share this class — no split named) | 5 |
| 6 | `characterFollowRoutes.js` | Tier 1 PROMOTE | 7 |
| 7 | `characterSparkRoute.js` | Tier 1 PROMOTE (base) | 4 |
| 8 | `characterSparkRoute.js` | Tier 1 + `aiRateLimiter` | 1 |
| 9 | `characterGrowthRoute.js` | Tier 1 PROMOTE (base) | 3 |
| 10 | `characterGrowthRoute.js` | Tier 1 + `aiRateLimiter` | 1 |
| 11 | `universe.js` | Tier 1 writes | **4** |
| 12 | `universe.js` | Tier 4 GETs (PUBLIC) | **4** |
| 13 | `characterGenerator.js` | Tier 1 PROMOTE (base) | 4 |
| 14 | `characterGenerator.js` | Tier 1 + `aiRateLimiter` | 3 |
| 15 | `characterDepthRoutes.js` | Tier 1 PROMOTE (base) | 3 |
| 16 | `characterDepthRoutes.js` | Tier 1 + `aiRateLimiter` | 2 |
| 17 | `characterGenerationRoutes.js` | Tier 1 via `router.use` (base) | 5 |
| 18 | `characterGenerationRoutes.js` | Tier 1 + `aiRateLimiter` | 1 |
| 19 | `wantFieldRoutes.js` | Tier 1 via `router.use` (base) | 1 |
| 20 | `wantFieldRoutes.js` | Tier 1 + `aiRateLimiter` | 1 |
| 21 | `characterCrossingRoutes.js` | Tier 1 via `router.use` (base) | 5 |
| 22 | `characterCrossingRoutes.js` | Tier 1 + `aiRateLimiter` | 1 |

**Rows 5's "no split" call is deliberate, not an omission.** All five of
`characterAI.js`'s handlers carry `aiRateLimiter` (confirmed at §4 row 5) —
where 100% of a scope's handlers share one class, Ruling 1's "distinct
classes at one scope are distinct dispositions" has nothing to distinguish,
so it is one disposition, not two.

**This reaches 22, independently, from the commit body alone.** It matches
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2's CP6 row (`13 files, each
with its own class mix` → **22**), filed 2026-08-23. As with the prior
passes, this pass's population was built from §2.2 before consulting that
document's total.

---

# §3. CP6's basis commit, on the face

**`9892e6040ea609dd3c16df6fa4cc519264edbb32`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
9892e6040:<path>` against this SHA, per Ruling 3.

---

# §4. Confirmation table — 20 agree, 2 disagree

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `characters.js` · Tier 1 ADD | `src/routes/characters.js:6,20` | 2 handlers | `GET /` and `GET /:id`, both `requireAuth` | **agree** |
| 2 | `character-clips.js` · Tier 1 ADD | `src/routes/character-clips.js:18,19,22,23,24` | 5 handlers | All 5 `requireAuth` | **agree** |
| 3 | `characterRegistry.js` · Tier 1 PROMOTE | `src/routes/characterRegistry.js` | 36 handlers | 37 total routes − 1 (row 4) = **36** | **agree** |
| 4 | `characterRegistry.js` · PRESERVE @ L1882 | `src/routes/characterRegistry.js:1882` | `POST /characters/:id/deep-profile/generate` → `requireAuth, aiRateLimiter`, verbatim preserved | Line 1882 matches exactly | **agree** |
| 5 | `characterAI.js` · Tier 1 + `aiRateLimiter` | `src/routes/characterAI.js:397,478,537,641,717` | 5 handlers, all AI | All 5 `POST` handlers carry `requireAuth, aiRateLimiter` — `write-scene`, `character-monologue`, `build-profile`, `suggest-gaps`, `what-happens-next` | **agree** |
| 6 | `characterFollowRoutes.js` · Tier 1 PROMOTE | `src/routes/characterFollowRoutes.js:14,30,42,74,95,144,176` | 7 handlers | All 7 `requireAuth` | **agree** |
| 7 | `characterSparkRoute.js` · Tier 1 (base) | `src/routes/characterSparkRoute.js` | 4 handlers | 5 total − 1 (row 8) = **4** | **agree** |
| 8 | `characterSparkRoute.js` · Tier 1 + `aiRateLimiter` | `src/routes/characterSparkRoute.js:99` | 1 handler | `POST /sparks/:id/prefill` carries `requireAuth, aiRateLimiter` | **agree** |
| 9 | `characterGrowthRoute.js` · Tier 1 (base) | `src/routes/characterGrowthRoute.js` | 3 handlers | 4 total − 1 (row 10) = **3** | **agree** |
| 10 | `characterGrowthRoute.js` · Tier 1 + `aiRateLimiter` | `src/routes/characterGrowthRoute.js:62` | 1 handler | `POST /character-growth` carries `requireAuth, aiRateLimiter` | **agree** |
| 11 | `universe.js` · Tier 1 writes | `src/routes/universe.js:46,76,87,99,124` | **4** | `POST /` (46), `POST /series` (76), `PUT /series/:id` (87), `DELETE /series/:id` (99), `PUT /:id` (124) — all `requireAuth` — **5**, not 4 | **disagree** |
| 12 | `universe.js` · Tier 4 GETs (PUBLIC) | `src/routes/universe.js:36,61,111` | **4** | `GET /` (36), `GET /series` (61), `GET /:id` (111) — all `optionalAuth` — **3**, not 4 | **disagree** |
| 13 | `characterGenerator.js` · Tier 1 (base) | `src/routes/characterGenerator.js` | 4 handlers | 7 total − 3 (row 14) = **4** | **agree** |
| 14 | `characterGenerator.js` · Tier 1 + `aiRateLimiter` | `src/routes/characterGenerator.js:634,743,1198` | 3 handlers | `propose-seeds`, `generate-batch`, `rewrite-field` all carry `requireAuth, aiRateLimiter` | **agree** |
| 15 | `characterDepthRoutes.js` · Tier 1 (base) | `src/routes/characterDepthRoutes.js` | 3 handlers | 5 total − 2 (row 16) = **3** | **agree** |
| 16 | `characterDepthRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/characterDepthRoutes.js:287,328` | 2 handlers | `/:charId/generate` and `/:charId/generate/:dimension` both carry `requireAuth, aiRateLimiter` | **agree** |
| 17 | `characterGenerationRoutes.js` · Tier 1 (base) | `src/routes/characterGenerationRoutes.js:33` (`router.use`) | 5 handlers | `router.use(requireAuth)` at L33 covers 6 route handlers; 5 without `aiRateLimiter` (row 18 has the 6th) | **agree** |
| 18 | `characterGenerationRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/characterGenerationRoutes.js:44` | 1 handler | `POST /generate` carries `aiRateLimiter`, with `requireAuth` applied at the mount-level `router.use` | **agree** |
| 19 | `wantFieldRoutes.js` · Tier 1 (base) | `src/routes/wantFieldRoutes.js:17` (`router.use`) | 1 handler | `router.use(requireAuth)` at L17 covers 2 route handlers; 1 without `aiRateLimiter` | **agree** |
| 20 | `wantFieldRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/wantFieldRoutes.js:43` | 1 handler | `POST /:id/unfollow-thread` carries `aiRateLimiter`, `requireAuth` via mount | **agree** |
| 21 | `characterCrossingRoutes.js` · Tier 1 (base) | `src/routes/characterCrossingRoutes.js:21` (`router.use`) | 5 handlers | `router.use(requireAuth)` at L21 covers 6 route handlers; 5 without `aiRateLimiter` | **agree** |
| 22 | `characterCrossingRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/characterCrossingRoutes.js:83` | 1 handler | `POST /:id/propose-gap` carries `aiRateLimiter`, `requireAuth` via mount | **agree** |

**20/22 agree. 2/22 disagree (rows 11–12). 0/22 cannot-tell. Disagree
rate: 2/22. Cannot-tell rate: 0/22.**

---

# §5. The two `disagree` rows, in full

**`universe.js` reads as 5 write handlers on `requireAuth` and 3 GET
handlers on `optionalAuth` — not the recorded 4 and 4.** All 8 routes,
read in full at `src/routes/universe.js:36–124`:

```
36:  router.get('/', optionalAuth, ...)              — read
46:  router.post('/', requireAuth, ...)               — write
61:  router.get('/series', optionalAuth, ...)          — read
76:  router.post('/series', requireAuth, ...)          — write
87:  router.put('/series/:id', requireAuth, ...)       — write
99:  router.delete('/series/:id', requireAuth, ...)    — write
111: router.get('/:id', optionalAuth, ...)             — read
124: router.put('/:id', requireAuth, ...)              — write
```

**Five writes** (`POST /`, `POST /series`, `PUT /series/:id`, `DELETE
/series/:id`, `PUT /:id`), **three reads** (`GET /`, `GET /series`, `GET
/:id`). The total (8 handlers) and the qualitative shape (a genuine mixed
Tier 1 + Tier 4 file, `v2.31`'s "2nd cumulative §5.21 instance") are both
correct — **only the internal split is wrong.** This was checked against
`9892e6040` itself (no diff needed; the claim is about the landed state,
not a change), and the file is small enough (135 lines, 8 routes) that a
miscount is not plausible from a partial read.

**This is not treated as a disagreement about the Tier ruling itself.**
Every one of the eight handlers carries the middleware the record's
overall framing implies for its HTTP verb — writes get `requireAuth`,
reads get `optionalAuth` — and nothing here suggests any handler is
mis-tiered. **The disagreement is narrowly about the count**: the record's
"4 writes + 4 GETs" does not match the file's actual 5-write/3-GET
composition. Recorded as `disagree` rather than downgraded to a
note, because Ruling 3 asks this pass to state what it found against what
was claimed, not to characterize how much the discrepancy matters.

**This is the first `disagree` this limb 1 programme has recorded**, across
CP1, CP2, CP3, CP4, CP5, CP6, and CP10. Six of seven passes recorded zero
`disagree`; this is not evidence those passes were lenient — each explained
its own zero on its own terms (§5 of each document) — but it is the first
case where a specific, checkable count in the record does not hold up
against the code.

---

# §6. Zero `cannot-tell`, on the other twenty rows

`v2.68` §4.1's discriminator concerns `cannot-tell`, not `disagree` — a
suspiciously low `cannot-tell` rate signals possible re-derivation drift.
**This pass's 0/22 `cannot-tell` holds for the same reason CP4's and CP5's
zeros held** (`F-AUTH-1_Limb1_CP4_Confirmation_2026-09-02.md` §5,
`F-AUTH-1_Limb1_CP5_Confirmation_2026-09-02.md` §5): every one of the 13
files is named, and CP6's inventory line is unusually granular — naming
per-file counts and, for 8 of the 13 files, exact line numbers for the AI
POST subset. There was no unnamed remainder to leave as `cannot-tell` in
this CP's record, unlike CP2's and CP3's.

**The `disagree` at rows 11–12 does not reflect a weaker read elsewhere.**
It surfaced because `universe.js` is the one file this pass checked line-
by-line against a numeric claim precise enough to be falsifiable (`4
writes + 4 GETs`) rather than only a total; the other files' claims were
equally precise and held.

---

# §7. Tails, re-derived at this basis, not carried

```
$ grep -ro 'FD-70' docs/audit/ | wc -l
56

$ grep -r 'XK-4' docs/audit/ | wc -l
34

$ grep -r 'PE #69' docs/audit/ | wc -l
34
```

**Unchanged from `F-AUTH-1_Limb1_CP5_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §8. What this document does not do

- **Performs limb 1 for CP6 only.** CP7–CP9, CP11, and CP12 remain
  unconfirmed. Limb 1 stays **OPEN** — Ruling 4 requires all twelve.
- **Does not correct `universe.js`'s recorded count.** Rows 11–12 are
  recorded as `disagree`, with the observed split stated plainly; this
  pass does not edit `F-AUTH-1_Fix_Plan_v2.31.md` (a merged document) or
  propose a fix. Whether the miscount is consequential is left to whoever
  reads this finding next.
- **Does not treat the `disagree` as evidence any handler is mis-tiered.**
  Both writes and reads in `universe.js` carry the middleware their verb
  implies; only the record's internal 4/4 split is wrong.
- **Does not re-derive or challenge any other CP6 Tier disposition.** Every
  other row asks whether CP6's own code matches CP6's own recorded claim.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP6 row as authority for this pass's
  population — §2.3 built the population independently and notes where the
  two agree.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.31.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the CP1/CP2/CP3/CP4/CP5/CP10
  confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP6's basis commit `9892e6040`. No host,
AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
