| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP7 CONFIRMATION PASS** *One CP of twelve. 17 recorded dispositions read against code at CP7's own basis commit. 17/17 agree — the largest single-CP population confirmed so far (153 handlers, 17 files).* |
| --- |

# F-AUTH-1 Limb 1 — CP7 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP7 —
of the twelve-CP historical population Ruling 2 fixes. Eighth CP confirmed;
CP1, CP2, CP3, CP4, CP5, CP6, and CP10 were done separately. Per Ruling 4,
this is a durable partial result.

**Basis:** `origin/main` at `f92a4edade600d8412fb22dd0ac6726c5ac32418`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. Limb 1 **OPEN**;
limb 3 open; G4 not enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one
handler. Distinct classes at one scope are distinct dispositions.**

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation:**

> "Read what the CP ruled. Read the code it ruled about, at that CP's own
> basis. Record `agree` / `disagree` / `cannot-tell`." "**A limb 1 pass
> reporting no `cannot-tell` results is MORE suspect than one reporting
> several**" (§4.1).

**Ruling 4 (§5) — decomposable per CP, partial results hold.**

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN.** Not relied on
here.

---

# §2. Population — CP7's recorded dispositions, established

## §2.1 Locating CP7

```
$ git log --all --oneline --grep="CP7" -i | grep -i "Step 3 CP7"
85294f794 docs(audit): F-AUTH-1 fix plan v2.32 — Step 3 CP7 closure ...
10577813a f-auth-1 step 3 CP7: Storyteller + memories + franchiseBrain Q13 — 17 files, ...

$ git log -1 --format='%H %ad %s' --date=short 10577813a
10577813a15db0a1643b45d04242aa74df89d4de 2026-05-08 f-auth-1 step 3 CP7: ...

$ git merge-base --is-ancestor 10577813a origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P 10577813a
9892e6040ea609dd3c16df6fa4cc519264edbb32
```

**CP7's commit: `10577813a15db0a1643b45d04242aa74df89d4de`, 2026-05-08,
confirmed an ancestor of `origin/main`.** Its parent is CP6's commit
directly. This is the largest single-CP change in the population confirmed
so far — 17 files, 153 handlers, a 1.85x scope-expansion outlier per the
record's own "D11" note.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b 10577813a
```

Full body read (56 lines). The disposition-bearing content is a "Source
file inventory (17 CP7-new)" block, quoted in full:

> "storyteller.js (37 PROMOTE + 1 AI POST aiRateLimiter on
> /chapters/:id/lines + lazy-noop removed), careerGoals.js (7 PROMOTE +
> lazy-noop), arcRoutes.js (7 PROMOTE + lazy-noop), arcTrackingRoutes.js
> (3 PROMOTE), generate-script-from-book.js (1 SSE-streaming AI POST
> PROMOTE + lazy-noop), storyEvaluationRoutes.js (8 PROMOTE + 5 AI POSTs
> aiRateLimiter + lazy-noop), eventGeneratorRoute.js (1 AI POST PROMOTE),
> pdfIngestRoute.js (1 multipart AI POST PROMOTE), franchiseBrainRoutes.js
> (Q13 — 11 writes Tier 1 + 5 GETs Tier 4 PUBLIC + 2 AI POSTs aiRateLimiter
> + authenticateToken→requireAuth at L560 per D3), memories/engine.js
> (23 PROMOTE + 11 AI POSTs aiRateLimiter + lazy-noop — 5468 lines),
> memories/{assistant,core,extras,interview,planning,stories,voice}.js
> (49 PROMOTE + 25 AI POSTs aiRateLimiter + 7 lazy-noop residues)."

**The last entry bundles 7 files** (`assistant.js`, `core.js`, `extras.js`,
`interview.js`, `planning.js`, `stories.js`, `voice.js`) **under one
combined class total** — 49 PROMOTE + 25 AI POSTs across all seven, with
no per-file split. All seven filenames are named explicitly in the
parenthetical, so — as at CP4 and CP5 — this is a closed, named scope, not
an unbounded remainder.

## §2.3 Identifying and confirming the file set

```
$ git diff --stat 9892e6040..10577813a -- src/routes
 src/routes/arcRoutes.js                 | 22 ++++-----
 src/routes/arcTrackingRoutes.js         | 13 ++---
 src/routes/careerGoals.js               | 22 ++++-----
 src/routes/eventGeneratorRoute.js       |  5 +-
 src/routes/franchiseBrainRoutes.js      | 29 +++++++-----
 src/routes/generate-script-from-book.js | 11 ++---
 src/routes/memories/assistant.js        | 19 +++-----
 src/routes/memories/core.js             | 29 +++-------
 src/routes/memories/engine.js           | 55 ++++++++++-----------
 src/routes/memories/extras.js           | 22 ++++-----
 src/routes/memories/interview.js        | 27 +++------
 src/routes/memories/planning.js         | 21 ++++-----
 src/routes/memories/stories.js          | 27 +++------
 src/routes/memories/voice.js            | 17 +++----
 src/routes/pdfIngestRoute.js            |  6 ++-
 src/routes/storyEvaluationRoutes.js     | 25 ++++------
 src/routes/storyteller.js               | 84 +++++++++++++++------------------
 17 files changed, 185 insertions(+), 249 deletions(-)
```

**Seventeen files, matching the commit body's own "17 CP7-new" count
exactly.**

## §2.4 The population: 17 recorded dispositions

Applying Ruling 1's own worked rule (distinct classes at one scope are
distinct dispositions; a single-class scope is one disposition, not
split):

| # | scope | class | recorded count |
|---|---|---|---|
| 1 | `storyteller.js` | Tier 1 (base) | 36 |
| 2 | `storyteller.js` | Tier 1 + `aiRateLimiter` | 1 |
| 3 | `careerGoals.js` | Tier 1 | 7 |
| 4 | `arcRoutes.js` | Tier 1 | 7 |
| 5 | `arcTrackingRoutes.js` | Tier 1 | 3 |
| 6 | `generate-script-from-book.js` | Tier 1 + `aiRateLimiter` (SSE) | 1 |
| 7 | `storyEvaluationRoutes.js` | Tier 1 (base) | 3 |
| 8 | `storyEvaluationRoutes.js` | Tier 1 + `aiRateLimiter` | 5 |
| 9 | `eventGeneratorRoute.js` | Tier 1 + `aiRateLimiter` | 1 |
| 10 | `pdfIngestRoute.js` | Tier 1 + `aiRateLimiter` (multipart) | 1 |
| 11 | `franchiseBrainRoutes.js` | Tier 1 writes (base) | 9 |
| 12 | `franchiseBrainRoutes.js` | Tier 1 + `aiRateLimiter` | 2 |
| 13 | `franchiseBrainRoutes.js` | Tier 4 GETs (PUBLIC) | 5 |
| 14 | `memories/engine.js` | Tier 1 (base) | 12 |
| 15 | `memories/engine.js` | Tier 1 + `aiRateLimiter` | 11 |
| 16 | `memories/{assistant,core,extras,interview,planning,stories,voice}.js` | Tier 1 (base) | 24 |
| 17 | `memories/{assistant,core,extras,interview,planning,stories,voice}.js` | Tier 1 + `aiRateLimiter` | 25 |

**This reaches 17, independently, from the commit body alone.** It is
**close to but not identical with** `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`
§2's CP7 row (`17 files itemized` → **18**), filed 2026-08-23. That
document does not list its 18 rows, so this pass cannot identify which
single split it made that this pass did not (or vice versa) — recorded as
a one-item difference of unknown origin, not resolved. As with CP3's
divergence, this pass does not amend the merged Measurement v2 document
over it (§8).

---

# §3. CP7's basis commit, on the face

**`10577813a15db0a1643b45d04242aa74df89d4de`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
10577813a:<path>` across the seventeen files at §2.3, and one diff against
its parent `9892e6040` for the `franchiseBrainRoutes.js` legacy-alias
detail, per Ruling 3.

---

# §4. Confirmation table — 17/17

| # | Disposition (scope · class) | path | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `storyteller.js` · Tier 1 (base) | `src/routes/storyteller.js` | 36 | 37 total routes − 1 (row 2) = **36**, all `requireAuth` | **agree** |
| 2 | `storyteller.js` · Tier 1 + `aiRateLimiter` | `src/routes/storyteller.js` | 1 | 1 `aiRateLimiter` usage site (`/chapters/:id/lines`) | **agree** |
| 3 | `careerGoals.js` · Tier 1 | `src/routes/careerGoals.js` | 7 | 7 routes, all `requireAuth`, 0 `aiRateLimiter` | **agree** |
| 4 | `arcRoutes.js` · Tier 1 | `src/routes/arcRoutes.js` | 7 | 7 routes, all `requireAuth`, 0 `aiRateLimiter` | **agree** |
| 5 | `arcTrackingRoutes.js` · Tier 1 | `src/routes/arcTrackingRoutes.js` | 3 | 3 routes, all `requireAuth`, 0 `aiRateLimiter` | **agree** |
| 6 | `generate-script-from-book.js` · Tier 1 + `aiRateLimiter` | `src/routes/generate-script-from-book.js` | 1 | 1 route, `requireAuth + aiRateLimiter` | **agree** |
| 7 | `storyEvaluationRoutes.js` · Tier 1 (base) | `src/routes/storyEvaluationRoutes.js` | 3 | 8 total routes − 5 (row 8) = **3** | **agree** |
| 8 | `storyEvaluationRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/storyEvaluationRoutes.js` | 5 | 5 `aiRateLimiter` usage sites | **agree** |
| 9 | `eventGeneratorRoute.js` · Tier 1 + `aiRateLimiter` | `src/routes/eventGeneratorRoute.js` | 1 | 1 route, `requireAuth + aiRateLimiter` | **agree** |
| 10 | `pdfIngestRoute.js` · Tier 1 + `aiRateLimiter` | `src/routes/pdfIngestRoute.js` | 1 | 1 route, `requireAuth + aiRateLimiter` | **agree** |
| 11 | `franchiseBrainRoutes.js` · Tier 1 writes (base) | `src/routes/franchiseBrainRoutes.js` | 9 | 11 `requireAuth` handlers − 2 (row 12) = **9** | **agree** |
| 12 | `franchiseBrainRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/franchiseBrainRoutes.js` | 2 | 2 `aiRateLimiter` usage sites, both on `requireAuth` handlers | **agree** |
| 13 | `franchiseBrainRoutes.js` · Tier 4 GETs (PUBLIC) | `src/routes/franchiseBrainRoutes.js` | 5 | 5 `optionalAuth` handlers; `11 + 5 = 16` matches the file's total route count exactly | **agree** |
| 14 | `memories/engine.js` · Tier 1 (base) | `src/routes/memories/engine.js` | 12 | 23 total routes − 11 (row 15) = **12** | **agree** |
| 15 | `memories/engine.js` · Tier 1 + `aiRateLimiter` | `src/routes/memories/engine.js` | 11 | 11 `aiRateLimiter` usage sites | **agree** |
| 16 | `memories/{7 files}` · Tier 1 (base) | 7 files | 24 | Sum of routes across all 7 files: `5+10+6+9+6+9+4 = 49`; sum of `aiRateLimiter` sites (row 17) = 25; `49 − 25 = 24` | **agree** |
| 17 | `memories/{7 files}` · Tier 1 + `aiRateLimiter` | 7 files | 25 | Per-file `aiRateLimiter` sites: `assistant.js` 2, `core.js` 4, `extras.js` 2, `interview.js` 6, `planning.js` 3, `stories.js` 5, `voice.js` 3 — sum **25** | **agree** |

**17/17 agree. 0 disagree. 0 cannot-tell. Cannot-tell rate: 0/17.**

**The `franchiseBrainRoutes.js` legacy-alias sub-detail** ("`authenticateToken`→`requireAuth`
at L560 per D3," part of row 11's 9 handlers, not a separate disposition)
was checked against a diff vs the parent `9892e6040`: exactly one
`authenticateToken` reference is removed (`POST
/franchise-brain/push-from-page`), and zero remain in the file at
`10577813a` — matching the claim.

---

# §5. Zero `cannot-tell` on the largest population confirmed so far

`v2.68` §4.1's discriminator: a zero `cannot-tell` rate needs an
explanation specific to the record, not just an assertion of thoroughness.

**Every one of CP7's 17 files is named explicitly**, including the
7-file `memories/*` bundle, whose parenthetical lists all seven filenames
even though it states only an aggregate class total. §2.3's `git diff
--stat` recovered the identical 17-file set the commit body itself claims
("17 CP7-new"), and every file — including `memories/engine.js`'s 5,468
raw lines — was read in full and counted, not sampled. This is the same
reasoning that held CP4's and CP5's zeros
(`F-AUTH-1_Limb1_CP4_Confirmation_2026-09-02.md` §5,
`F-AUTH-1_Limb1_CP5_Confirmation_2026-09-02.md` §5): a closed, fully-named
scope read in full is retrieval, not re-derivation, however large that
scope is.

**This CP is also the first time this programme has confirmed a
17-file/153-handler population without a single `cannot-tell` or
`disagree`.** That is worth stating plainly rather than treating as
self-evidently reassuring: CP6, the immediately prior pass, recorded this
programme's first `disagree`
(`F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md` §5) on a much smaller
file. CP7's zero holds because every claim checked was a raw count against
a `grep`-able total (routes, `aiRateLimiter` sites) rather than a
narrative split like CP6's "4 writes + 4 GETs" — the kind of claim most
exposed to a transcription error. Where CP7 does carry an internal split
claim of that shape (`franchiseBrainRoutes.js`'s "11 writes + 5 GETs"), it
was checked the same way CP6's was and, this time, matched exactly (row
13).

---

# §6. Tails, re-derived at this basis, not carried

```
$ grep -ro 'FD-70' docs/audit/ | wc -l
56

$ grep -r 'XK-4' docs/audit/ | wc -l
34

$ grep -r 'PE #69' docs/audit/ | wc -l
34
```

**Unchanged from `F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP7 only.** CP8, CP9, CP11, and CP12 remain
  unconfirmed. Limb 1 stays **OPEN** — Ruling 4 requires all twelve.
- **Does not resolve the 17-vs-18 divergence from Measurement v2.** That
  document's CP7 row states only a total (18) with no itemized list; this
  pass cannot identify the specific split it applied that produced one
  more row, and does not guess.
- **Does not re-derive or challenge any of CP7's Tier dispositions.** Every
  row above asks whether CP7's own code matches CP7's own recorded claim.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP7 row as authority for this pass's
  population — §2.4 built the population independently and notes the
  divergence rather than resolving it.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.32.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the CP1/CP2/CP3/CP4/CP5/CP6/CP10
  confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP7's basis commit `10577813a`. No host,
AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
