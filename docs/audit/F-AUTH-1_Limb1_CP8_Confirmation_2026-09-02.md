| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP8 CONFIRMATION PASS** *One CP of twelve. 19 recorded Tier dispositions read against code at CP8's own basis commit. 19/19 agree. Two content-gate middlewares named in the record are excluded from the count as non-Tier — explained, and likely the source of the divergence from Measurement v2's 21.* |
| --- |

# F-AUTH-1 Limb 1 — CP8 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP8 —
of the twelve-CP historical population Ruling 2 fixes. Ninth CP confirmed;
CP1, CP2, CP3, CP4, CP5, CP6, CP7, and CP10 were done separately. Per
Ruling 4, this is a durable partial result.

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
handler. Distinct classes at one scope are distinct dispositions** — but
the disposition being audited is the **Tier** assignment (Tier 1–5 per the
`v2.23` §5.2 matrix). A supplementary, orthogonal middleware layered on top
of an already-determined Tier is not itself a Tier disposition.

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation.**

**Ruling 4 (§5) — decomposable per CP, partial results hold.**

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN.** Not relied on
here.

---

# §2. Population — CP8's recorded dispositions, established

## §2.1 Locating CP8

```
$ git log --all --oneline --grep="CP8" -i | grep -i "Step 3 CP8"
a9af78b12 docs(audit): F-AUTH-1 fix plan v2.33 — Step 3 CP8 closure ...
105bc6eb4 f-auth-1 step 3 CP8: Social-feeds — 9 files, 90 promotions, ...

$ git log -1 --format='%H %ad %s' --date=short 105bc6eb4
105bc6eb4964fe7456a68bdf54d471ead16a9ac0 2026-05-08 f-auth-1 step 3 CP8: ...

$ git merge-base --is-ancestor 105bc6eb4 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P 105bc6eb4
10577813a15db0a1643b45d04242aa74df89d4de
```

**CP8's commit: `105bc6eb4964fe7456a68bdf54d471ead16a9ac0`, 2026-05-08,
confirmed an ancestor of `origin/main`.** Its parent is CP7's commit
directly.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b 105bc6eb4
```

Full body read (48 lines). The "Source file inventory (9 CP8-new)" block,
quoted in full:

> "socialProfileRoutes.js (anchor; mixed Tier 1+4 — 36 Tier 1 + 3 GETs Tier
> 4 PUBLIC + 8 guardJustAWomanRecord preserved + 2 AI POSTs aiRateLimiter +
> generateRateLimits in-handler preserved + lazy-noop removed),
> socialProfileBulkRoutes.js (9 Tier 1 + 5 AI POSTs aiRateLimiter +
> lazy-noop; surface-correction: 9 not 8), feedSchedulerRoutes.js (13 Tier
> 1 + 3 service-mediated AI POSTs aiRateLimiter per D3 + lazy-noop;
> surface-correction: 13 not 11), feedPostRoutes.js (mixed Tier 1+4 — 3
> GETs Tier 4 PUBLIC + 2 Tier 1 + 1 service-mediated AI POST),
> feedEnhancedRoutes.js (10 Tier 1 + 2 service-mediated AI POSTs per D3;
> surface-correction: 10 not 8), feedRelationshipRoutes.js (8 Tier 1
> router.use + 2 service-mediated AI POSTs aiRateLimiter inline per D3),
> feedPipelineRoutes.js (3 Tier 1 + 1 service-mediated AI POST aiRateLimiter
> per D3), mirrorFieldRoutes.js (3 Tier 1 router.use + 1 direct AI POST
> aiRateLimiter inline), undergroundRoutes.js (3 Tier 1 router.use; no AI
> POSTs)."

**Two named items are not Tier assignments.** `guardJustAWomanRecord` (a
record-content gate — "locks `is_justawoman_record === true` rows with
403," per the "Custom middleware preservation" section later in the same
body) and `generateRateLimits` (an in-handler IP rate limiter) are both
layered *on top of* handlers already counted in the 36-handler Tier 1
figure — confirmed at §4 row 3, where one handler (`/:id/regenerate`)
carries `aiRateLimiter` **and** `guardJustAWomanRecord` simultaneously,
showing these are independent overlay attributes, not alternate Tier
classes. §2.4 excludes both from the population, for the same reason
CP1's and CP10's lazy-noop-fallback removals and CP5's custom-middleware
preservations were excluded from their populations: verified as present,
but not themselves a Tier disposition.

## §2.3 Identifying and confirming the file set

```
$ git diff --stat 10577813a..105bc6eb4 -- src/routes
 src/routes/feedEnhancedRoutes.js      | 23 ++++-----
 src/routes/feedPipelineRoutes.js      |  9 ++--
 src/routes/feedPostRoutes.js          | 13 ++++--
 src/routes/feedRelationshipRoutes.js  |  9 ++--
 src/routes/feedSchedulerRoutes.js     | 35 ++++++--------
 src/routes/mirrorFieldRoutes.js       |  7 +--
 src/routes/socialProfileBulkRoutes.js | 27 +++++------
 src/routes/socialProfileRoutes.js     | 87 ++++++++++++++++++-----------------
 src/routes/undergroundRoutes.js       |  4 +-
 9 files changed, 107 insertions(+), 107 deletions(-)
```

**Nine files, matching the commit body's "9 CP8-new" count exactly.**

## §2.4 The population: 19 recorded Tier dispositions

| # | scope | class | recorded count |
|---|---|---|---|
| 1 | `socialProfileRoutes.js` | Tier 1 (base) | 34 |
| 2 | `socialProfileRoutes.js` | Tier 1 + `aiRateLimiter` | 2 |
| 3 | `socialProfileRoutes.js` | Tier 4 GETs (PUBLIC) | 3 |
| 4 | `socialProfileBulkRoutes.js` | Tier 1 (base) | 4 |
| 5 | `socialProfileBulkRoutes.js` | Tier 1 + `aiRateLimiter` | 5 |
| 6 | `feedSchedulerRoutes.js` | Tier 1 (base) | 10 |
| 7 | `feedSchedulerRoutes.js` | Tier 1 + `aiRateLimiter` | 3 |
| 8 | `feedPostRoutes.js` | Tier 4 GETs (PUBLIC) | 3 |
| 9 | `feedPostRoutes.js` | Tier 1 (base) | 2 |
| 10 | `feedPostRoutes.js` | Tier 1 + `aiRateLimiter` | 1 |
| 11 | `feedEnhancedRoutes.js` | Tier 1 (base) | 8 |
| 12 | `feedEnhancedRoutes.js` | Tier 1 + `aiRateLimiter` | 2 |
| 13 | `feedRelationshipRoutes.js` | Tier 1 via `router.use` (base) | 6 |
| 14 | `feedRelationshipRoutes.js` | Tier 1 + `aiRateLimiter` | 2 |
| 15 | `feedPipelineRoutes.js` | Tier 1 (base) | 2 |
| 16 | `feedPipelineRoutes.js` | Tier 1 + `aiRateLimiter` | 1 |
| 17 | `mirrorFieldRoutes.js` | Tier 1 via `router.use` (base) | 2 |
| 18 | `mirrorFieldRoutes.js` | Tier 1 + `aiRateLimiter` | 1 |
| 19 | `undergroundRoutes.js` | Tier 1 via `router.use` (no AI split — none present) | 3 |

**This reaches 19, independently, from the commit body's Tier claims
alone.** It does **not** match `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`
§2's CP8 row (`9 files itemized` → **21**), filed 2026-08-23. That
document does not itemize its 21 rows. **The gap is exactly 2 — the same
number of named-but-non-Tier items this pass excludes** (`guardJustAWomanRecord`,
`generateRateLimits`). This pass's best account of the divergence is that
Measurement v2 counted those two as separate dispositions where this pass
does not; it cannot confirm that account without Measurement v2's own
itemized list, so it is offered as the most likely explanation, not a
correction.

---

# §3. CP8's basis commit, on the face

**`105bc6eb4964fe7456a68bdf54d471ead16a9ac0`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
105bc6eb4:<path>` across the nine files at §2.3, per Ruling 3.

---

# §4. Confirmation table — 19/19

| # | Disposition (scope · class) | path | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `socialProfileRoutes.js` · Tier 1 (base) | `src/routes/socialProfileRoutes.js` | 34 | 39 total routes − 3 (row 3, `optionalAuth`) − 2 (row 2) = **34** | **agree** |
| 2 | `socialProfileRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/socialProfileRoutes.js:296,1540` | 2 | `POST /generate` and `POST /:id/regenerate` both carry `aiRateLimiter` | **agree** |
| 3 | `socialProfileRoutes.js` · Tier 4 GETs (PUBLIC) | `src/routes/socialProfileRoutes.js:969,1290,2678` | 3 | `GET /`, `GET /:id/followers`, `GET /:id` all carry `optionalAuth` | **agree** |
| 4 | `socialProfileBulkRoutes.js` · Tier 1 (base) | `src/routes/socialProfileBulkRoutes.js` | 4 | 9 total routes − 5 (row 5) = **4** | **agree** |
| 5 | `socialProfileBulkRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/socialProfileBulkRoutes.js` | 5 | 5 `aiRateLimiter` usage sites | **agree** |
| 6 | `feedSchedulerRoutes.js` · Tier 1 (base) | `src/routes/feedSchedulerRoutes.js` | 10 | 13 total routes − 3 (row 7) = **10** | **agree** |
| 7 | `feedSchedulerRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/feedSchedulerRoutes.js` | 3 | 3 `aiRateLimiter` usage sites | **agree** |
| 8 | `feedPostRoutes.js` · Tier 4 GETs (PUBLIC) | `src/routes/feedPostRoutes.js` | 3 | 3 `optionalAuth` handlers | **agree** |
| 9 | `feedPostRoutes.js` · Tier 1 (base) | `src/routes/feedPostRoutes.js` | 2 | 3 `requireAuth` handlers − 1 (row 10) = **2** | **agree** |
| 10 | `feedPostRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/feedPostRoutes.js` | 1 | 1 `aiRateLimiter` usage site, on a `requireAuth` handler | **agree** |
| 11 | `feedEnhancedRoutes.js` · Tier 1 (base) | `src/routes/feedEnhancedRoutes.js` | 8 | 10 total routes − 2 (row 12) = **8** | **agree** |
| 12 | `feedEnhancedRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/feedEnhancedRoutes.js` | 2 | 2 `aiRateLimiter` usage sites | **agree** |
| 13 | `feedRelationshipRoutes.js` · Tier 1 via `router.use` (base) | `src/routes/feedRelationshipRoutes.js` | 6 | `router.use(requireAuth)` present; 8 total routes − 2 (row 14) = **6** | **agree** |
| 14 | `feedRelationshipRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/feedRelationshipRoutes.js` | 2 | 2 `aiRateLimiter` usage sites | **agree** |
| 15 | `feedPipelineRoutes.js` · Tier 1 (base) | `src/routes/feedPipelineRoutes.js` | 2 | 3 total routes − 1 (row 16) = **2** | **agree** |
| 16 | `feedPipelineRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/feedPipelineRoutes.js` | 1 | 1 `aiRateLimiter` usage site | **agree** |
| 17 | `mirrorFieldRoutes.js` · Tier 1 via `router.use` (base) | `src/routes/mirrorFieldRoutes.js` | 2 | `router.use(requireAuth)` present; 3 total routes − 1 (row 18) = **2** | **agree** |
| 18 | `mirrorFieldRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/mirrorFieldRoutes.js` | 1 | 1 `aiRateLimiter` usage site | **agree** |
| 19 | `undergroundRoutes.js` · Tier 1 via `router.use` | `src/routes/undergroundRoutes.js` | 3 | `router.use(requireAuth)` present; 3 total routes; 0 `aiRateLimiter` | **agree** |

**19/19 agree. 0 disagree. 0 cannot-tell. Cannot-tell rate: 0/19.**

**Both excluded items confirmed present, for completeness, not as
population rows:** `guardJustAWomanRecord` appears at exactly 8 handler
sites in `socialProfileRoutes.js` (lines 1346, 1360, 1447, 1493, 1540,
1687, 2305, 2333 — matching the record's "8" exactly), and
`generateRateLimits` is defined and called once, at `POST /generate`
(line 296, the same handler as row 2's first `aiRateLimiter` site).

---

# §5. Zero `cannot-tell`, and the exclusion that produced the count

`v2.68` §4.1's discriminator concerns unexplained zeros; this pass's
0/19 holds for the same reason CP4's, CP5's, and CP7's did — every claim
checked against a raw `grep`-able count across a fully-named, fully-read
file set, no unnamed remainder.

**The more consequential judgment call in this pass is §2.2's exclusion,
not §4's verdicts.** Treating `guardJustAWomanRecord` and
`generateRateLimits` as non-Tier is not a new rule invented for CP8 — it
follows the same principle CP1's and CP10's lazy-noop-removal exclusions
and CP5's custom-middleware-preservation notes already applied: a
disposition this programme audits is a **Tier** assignment, and a
middleware that sits alongside an already-determined Tier (confirmed at
row 2/3's overlap: `/:id/regenerate` carries both `aiRateLimiter` and
`guardJustAWomanRecord`) is evidence about the handler, not a competing
Tier claim about it. The 19-vs-21 gap this produces relative to
Measurement v2 is recorded at §2.4 as the likely, not confirmed, cause.

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

**Unchanged from `F-AUTH-1_Limb1_CP7_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP8 only.** CP9, CP11, and CP12 remain
  unconfirmed. Limb 1 stays **OPEN** — Ruling 4 requires all twelve.
- **Does not resolve the 19-vs-21 divergence from Measurement v2 with
  certainty.** §2.4 and §5 give the most likely explanation (two excluded
  non-Tier middlewares); it is not verified against that document's own
  itemization, which does not exist in filed form.
- **Does not re-derive or challenge any of CP8's Tier dispositions.** Every
  row above asks whether CP8's own code matches CP8's own recorded claim.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP8 row as authority for this pass's
  population.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.33.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the CP1/CP2/CP3/CP4/CP5/CP6/CP7/CP10
  confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP8's basis commit `105bc6eb4`. No host,
AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
