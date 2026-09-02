| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP9 CONFIRMATION PASS** *One CP of twelve. 11 recorded dispositions read against code at CP9's own basis commit. 11/11 agree, matching Measurement v2's count exactly — including a "Tier 4 PUBLIC" file where the actual middleware is Tier 3's factory, preserved verbatim.* |
| --- |

# F-AUTH-1 Limb 1 — CP9 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP9 —
of the twelve-CP historical population Ruling 2 fixes. Tenth CP confirmed;
CP1, CP2, CP3, CP4, CP5, CP6, CP7, CP8, and CP10 were done separately. Per
Ruling 4, this is a durable partial result.

**Basis:** `origin/main` at `f92a4edade600d8412fb22dd0ac6726c5ac32418`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. Limb 1 **OPEN**;
limb 3 open; G4 not enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.
**With this pass, ten of twelve CPs are confirmed** — CP11 and CP12
remain.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one
handler. Distinct classes at one scope are distinct dispositions.**

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation.**

**Ruling 4 (§5) — decomposable per CP, partial results hold.**

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN.** Not relied on
here.

---

# §2. Population — CP9's recorded dispositions, established

## §2.1 Locating CP9

```
$ git log --all --oneline --grep="CP9" -i | grep -i "Step 3 CP9"
1d454111c docs(audit): F-AUTH-1 fix plan v2.34 — Step 3 CP9 closure ...
34f5684e0 f-auth-1 step 3 CP9: Production tooling + layers Q13 — 6 files, ...

$ git log -1 --format='%H %ad %s' --date=short 34f5684e0
34f5684e0b77b613c8e9955e39306c1612020d50 2026-05-08 f-auth-1 step 3 CP9: ...

$ git merge-base --is-ancestor 34f5684e0 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P 34f5684e0
105bc6eb4964fe7456a68bdf54d471ead16a9ac0
```

**CP9's commit: `34f5684e0b77b613c8e9955e39306c1612020d50`, 2026-05-08,
confirmed an ancestor of `origin/main`.** Its parent is CP8's commit
directly. It is also CP10's own parent — already confirmed as an ancestor
of `origin/main` at `F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md` §2.1.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b 34f5684e0
```

Full body read (52 lines). The "Source file inventory (6 CP9-new)" block,
quoted in full:

> "scripts.js (anchor; mixed Tier 1+4 — 4 GETs Tier 4 PUBLIC + 6 writes
> Tier 1 + 5 legacy authenticateToken→requireAuth per D11; surface-
> correction: 10 handlers not 9), layers.js (mixed Tier 1+4 — 2 GETs Tier
> 4 PUBLIC + 7 writes Tier 1; no AI POSTs), scriptGenerator.js (7 Tier 1
> throughout; D3 verified: 0 AI POSTs), scriptAnalysis.js (sub-form b ADD
> — 3 ZERO-middleware handlers; 1 service-mediated AI POST aiRateLimiter),
> textureLayerRoutes.js (sub-form b ADD + mixed Tier 1+4 — 5
> ZERO-middleware handlers; 2 GETs Tier 4 PUBLIC + 2 service-mediated AI
> POSTs aiRateLimiter + 1 non-AI POST), manuscript-export.js (Tier 4
> PUBLIC throughout per D12; F-Auth-3 polymorphic factory
> optionalAuth({ degradeOnInfraFailure: true }) preserved verbatim)."

**`manuscript-export.js`'s entry is a confirmation, not a promotion** — the
same shape as CP3's "2 worldEvents AI POSTs PRESERVED verbatim"
(`F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md` §2.4 row 5): it states a
Tier classification for the file's handlers and reports them unchanged by
CP9, rather than newly assigned. Counted as one disposition on the same
basis CP3's preserved rows were.

## §2.3 Identifying and confirming the file set

```
$ git diff --stat 105bc6eb4..34f5684e0 -- src/routes
 src/routes/layers.js             | 19 +++++++++++--------
 src/routes/manuscript-export.js  |  9 +++++++++
 src/routes/scriptAnalysis.js     | 12 +++++++++---
 src/routes/scriptGenerator.js    | 16 ++++++++--------
 src/routes/scripts.js            | 31 ++++++++++++++++++-------------
 src/routes/textureLayerRoutes.js | 18 +++++++++++++-----
 6 files changed, 68 insertions(+), 37 deletions(-)
```

**Six files, matching the commit body's "6 CP9-new" count exactly.**
`manuscript-export.js`'s diff is `+9/-0` — additions only, consistent with
"preserved verbatim" (a comment-block update, no functional change).

## §2.4 The population: 11 recorded dispositions

| # | scope | class | recorded count |
|---|---|---|---|
| 1 | `scripts.js` | Tier 1 writes | 6 |
| 2 | `scripts.js` | Tier 4 GETs (PUBLIC, no middleware at all) | 4 |
| 3 | `layers.js` | Tier 1 writes | 7 |
| 4 | `layers.js` | Tier 4 GETs (PUBLIC, `optionalAuth`) | 2 |
| 5 | `scriptGenerator.js` | Tier 1 throughout | 7 |
| 6 | `scriptAnalysis.js` | Tier 1 (base, ADD from zero-middleware) | 2 |
| 7 | `scriptAnalysis.js` | Tier 1 + `aiRateLimiter` (ADD from zero-middleware) | 1 |
| 8 | `textureLayerRoutes.js` | Tier 4 GETs (PUBLIC, `optionalAuth`) | 2 |
| 9 | `textureLayerRoutes.js` | Tier 1 (base, ADD from zero-middleware) | 1 |
| 10 | `textureLayerRoutes.js` | Tier 1 + `aiRateLimiter` (ADD from zero-middleware) | 2 |
| 11 | `manuscript-export.js` | Tier 4 PUBLIC, preserved (`optionalAuth({ degradeOnInfraFailure: true })`) | 3 |

**This reaches 11, independently, from the commit body alone.** It matches
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2's CP9 row (`5 files
itemized` → **11**), filed 2026-08-23 — even though this pass counts six
file-scopes rather than five in its own breakdown (§2.2 explains why
`manuscript-export.js` is counted as a preserved disposition rather than a
promotion, which may be the same distinction behind Measurement v2's "5
files" phrasing). As with the prior passes, this pass's population was
built from §2.2/§2.3 before consulting that document's total.

---

# §3. CP9's basis commit, on the face

**`34f5684e0b77b613c8e9955e39306c1612020d50`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
34f5684e0:<path>` across the six files at §2.3, per Ruling 3.

---

# §4. Confirmation table — 11/11

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `scripts.js` · Tier 1 writes | `src/routes/scripts.js:24,34,41,48,55,65` | 6 | `POST /bulk-delete`, `PATCH /:scriptId`, `DELETE /:scriptId`, `POST /:scriptId/set-primary`, `POST /:scriptId/restore`, `POST /:scriptId/parse-scenes` — all `requireAuth` | **agree** |
| 2 | `scripts.js` · Tier 4 GETs | `src/routes/scripts.js:20,21,31,62` | 4 | `GET /`, `GET /search`, `GET /:scriptId`, `GET /:scriptId/history` — all carry **no** auth middleware at all (bare `asyncHandler`), explicitly commented `// PUBLIC: ... Tier 4; no req.user consumption` | **agree** |
| 3 | `layers.js` · Tier 1 writes | `src/routes/layers.js:97,159,211,242,329,395,426` | 7 | 7 routes, all `requireAuth` | **agree** |
| 4 | `layers.js` · Tier 4 GETs | `src/routes/layers.js:13,57` | 2 | `GET /`, `GET /:id`, both `optionalAuth` | **agree** |
| 5 | `scriptGenerator.js` · Tier 1 throughout | `src/routes/scriptGenerator.js` | 7 | 7 routes, all `requireAuth`, 0 `aiRateLimiter` | **agree** |
| 6 | `scriptAnalysis.js` · Tier 1 (base) | `src/routes/scriptAnalysis.js:127,152` | 2 | `GET /:scriptId/metadata`, `PUT /:scriptId/ai-analysis`, both `requireAuth` | **agree** |
| 7 | `scriptAnalysis.js` · Tier 1 + `aiRateLimiter` | `src/routes/scriptAnalysis.js:35` | 1 | `POST /:scriptId/analyze` carries `requireAuth, aiRateLimiter` | **agree** |
| 8 | `textureLayerRoutes.js` · Tier 4 GETs | `src/routes/textureLayerRoutes.js:206,222` | 2 | `GET /:characterKey/:storyNumber`, `GET /:characterKey`, both `optionalAuth` | **agree** |
| 9 | `textureLayerRoutes.js` · Tier 1 (base) | `src/routes/textureLayerRoutes.js:104` | 1 | `POST /confirm/:storyNumber` carries `requireAuth`, no `aiRateLimiter` | **agree** |
| 10 | `textureLayerRoutes.js` · Tier 1 + `aiRateLimiter` | `src/routes/textureLayerRoutes.js:18,167` | 2 | `POST /generate`, `POST /regenerate/:storyNumber/:layer`, both `requireAuth, aiRateLimiter` | **agree** |
| 11 | `manuscript-export.js` · Tier 4 PUBLIC, preserved | `src/routes/manuscript-export.js:132,162,570` | 3 | All three GETs carry `optionalAuth({ degradeOnInfraFailure: true })` verbatim; diff vs parent `105bc6eb4` shows only comment-line additions, no functional change | **agree** |

**11/11 agree. 0 disagree. 0 cannot-tell. Cannot-tell rate: 0/11.**

**One naming note, not a disagreement.** `scripts.js`'s "Tier 4 PUBLIC"
GETs carry no middleware at all, while `layers.js`'s and
`textureLayerRoutes.js`'s "Tier 4 PUBLIC" GETs carry `optionalAuth`, and
`manuscript-export.js`'s carries `optionalAuth({ degradeOnInfraFailure:
true })` (Tier 3's factory shape). All three are consistent with the
record's own framing of "Tier 4 PUBLIC" as a *reachability* class (no
`req.user` consumption gates the read) rather than a single literal
middleware signature — the record itself flags the third case explicitly
("F-Auth-3 polymorphic factory ... preserved verbatim"). This is recorded
as an observation, not a disagreement, since the record does not claim a
uniform implementation for the class.

---

# §5. Zero `cannot-tell`, on the smallest population confirmed so far

`v2.68` §4.1's discriminator concerns unexplained zeros. CP9's 0/11 holds
for the same reason CP4's, CP5's, CP7's, and CP8's did: all six files are
named, all were read in full, every claim was checked against a raw,
line-level middleware read rather than an aggregate count alone (unlike
CP4's/CP5's/CP8's counts-only checks, CP9's small file sizes — the largest
is `layers.js` at well under 500 lines — meant every row could be verified
by reading the actual route definitions directly, not by subtraction).

**This is also the first CP since CP1 with a population this close in size
to Measurement v2's own count without an explicit divergence needing
explanation** (CP3 diverged +2, CP7 diverged −1, CP8 diverged −2). CP9's
11 matches 11 exactly, though this pass's own scope-breakdown (six file
scopes) differs from the "5 files itemized" phrasing in Measurement v2's
row — see §2.4.

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

**Unchanged from `F-AUTH-1_Limb1_CP8_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP9 only.** CP11 and CP12 remain unconfirmed —
  the last two of twelve. Limb 1 stays **OPEN** — Ruling 4 requires all
  twelve.
- **Does not re-derive or challenge any of CP9's Tier dispositions.** Every
  row above asks whether CP9's own code matches CP9's own recorded claim.
- **Does not resolve the "Tier 4 PUBLIC" naming variation** (bare vs
  `optionalAuth` vs `optionalAuth({degradeOnInfraFailure:true})`) into a
  single canonical implementation — it is recorded as consistent with the
  record's own reachability framing, not adjudicated further.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP9 row as authority for this pass's
  population.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.34.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the CP1/CP2/CP3/CP4/CP5/CP6/CP7/CP8/CP10
  confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP9's basis commit `34f5684e0`. No host,
AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
