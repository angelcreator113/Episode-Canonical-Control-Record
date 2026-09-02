| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP10 CONFIRMATION PASS** *One CP of twelve. 21 recorded dispositions read against code at CP10's own basis commit. 21/21 agree. Zero cannot-tell, explained per v2.68 §4.1.* |
| --- |

# F-AUTH-1 Limb 1 — CP10 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP10 —
of the twelve-CP historical population Ruling 2 fixes. **Does not perform
limb 1 for any other CP.** Per Ruling 4, this is a durable partial result:
limb 1 discharges when all twelve CPs are confirmed, not before.

**Basis:** `origin/main` at `3babe69043cd21fef3f2537c89290b2135f77de4`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. Adjudicates no new
Tier disposition — every row below states whether CP10's own recorded
ruling matches the code CP10 itself produced. Limb 1 **OPEN**; limb 3 open;
G4 not enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one handler:**

> "Limb 1 audits the sweep's rulings — each place a CP recorded a
> disposition." "The denominator is non-uniform by construction."

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set, not
the present surface:**

> "Deriving the historical population is bounded, mechanical, and remains
> unperformed. It requires git history rather than the working tree —
> enumerate the declarations touched across the CP1–CP12 commit range."

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation:**

> "Read what the CP ruled. Read the code it ruled about, at that CP's own
> basis. Record `agree` / `disagree` / `cannot-tell`." "`cannot-tell` is a
> first-class outcome, not a failure to complete a judgment." "**A limb 1
> pass reporting no `cannot-tell` results is MORE suspect than one reporting
> several**" (§4.1).

**Ruling 4 (§5) — decomposable per CP, partial results hold:**

> "The CPs closed separately. A completed CP1 audit is a real result whether
> or not CP2 follows." "Limb 1 discharges when all twelve are done, and not
> before."

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN** and does not size
limb 1. Not relied on here.

**This pass applies Ruling 3 to one CP (CP10), per Ruling 4's decomposition,
against the population Ruling 2 defines.**

---

# §2. Population — CP10's recorded dispositions, established

## §2.1 Locating CP10

```
$ git log --all --oneline --grep="CP10" -i | grep "Step 3 CP10"
b0a404e77 F-AUTH-1 Step 3 CP10: Admin/internal cluster — penultimate CP

$ git merge-base --is-ancestor b0a404e77 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR
```

**CP10's commit: `b0a404e77765efbbb75b4fb4ebebf44fe0b83d5f`, 2026-05-08,
confirmed an ancestor of `origin/main` at this basis.** This is **CP10's
basis commit** for §4 below — the code CP10 itself produced, per Ruling 3
("the code it ruled about, at that CP's own basis").

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b b0a404e77
```

Full body read (142 lines). The `Files modified (20):` block is the
finest-granularity statement of what CP10 did, organized by work package
(WP):

```
Files modified (20):
  WP1 lazy-noop removal: opportunityRoutes.js
  WP2 legacy alias conversion (33 instances): admin, jobs, files, search, processing, auditLogs, templates
  WP3 Tier 1 ADD: aiUsageRoutes (7), session (1), propertyRoutes (9), search (1 GET /), processing (7 GETs), amberSession (4), amberDiagnostic (8), upgradeRoutes (16), opportunityRoutes (9)
  WP4 Tier 2 ADD per §5.3 + §5.51: siteOrganizerRoutes (3), designAgentRoutes (3), auditLogs (1 PROMOTE), templates (2 PROMOTE), cfoAgentRoutes (9 domain-semantic Tier 2 per §5.51 amendment), admin.js (2 PRESERVED lowercase verbatim per casing gate option c)
  WP5 verify processing.js requirePermission preservation (4 handlers, no edit)
  WP6 seed.js Tier 5+2 (3 inside + app.js env-gate)
  WP7 AI POST aiRateLimiter D3-verified: upgradeRoutes (5), amberDiagnosticRoutes (1)
  WP8 queue-monitor mount-line auth at app.js:1262
```

## §2.3 Source 2 — the closure document's version block

```
$ git log -1 --format='%H %ad %s' --date=short 928473a67
928473a6775f04609277288b76afd6a33ec9be34 2026-05-08 docs(audit): F-AUTH-1 fix plan v2.35

$ git show 928473a67:docs/audit/F-AUTH-1_Fix_Plan_v2.35.md | sed -n '6p'
```

`v2.35` is CP10's closure document, adding commit `928473a67`. Its
**Document version** block (line 6, one paragraph) states CP10's classes at
cluster granularity, unitemized within each class: `~85 Tier 1`, `23 Tier 2
['ADMIN']`, `2 Tier 2 ['admin'] preserved`, `4 Tier 2-equivalent`, `3 Tier
5+Tier 2`, `3 Tier 2 mount-line`, `6 AI POST overlay`, `7 PRESERVE`. **This
source is coarser than the commit body** — it names classes and totals but
not, at this specific location, the per-file scopes. Per Ruling 3's
counting rule (`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §1, applying
Ruling 1): **where one source itemizes a class into named scopes and the
other states only its total, the itemization governs.** The commit body
itemizes; the version block's line 6 does not. The commit body is read as
governing scope for §2.4.

**§5.62 of the same document** (`### **§5.62 — CP10 closure: Admin/internal
cluster (LOCKED v2.35, COMPLETE)**`, a body section distinct from the
version block) corroborates the commit body's file-level scopes with
matching per-file breakdowns and is used below only to corroborate, not as
one of Ruling 3's two named sources.

## §2.4 The population: 21 recorded dispositions

Applying Ruling 1's boundary rule (scope at finest granularity named; class
totals that are itemized are counted by their itemization, not their total;
approximate counts stay approximate) to the commit body's WP list:

| WP | class | named scopes | count |
|---|---|---|---|
| WP3 | Tier 1 ADD | 9 named routes | **9** |
| WP4 | Tier 2 ADD | 6 named scopes | **6** |
| WP5 | Tier 2-equivalent preserved, verified | processing.js | **1** |
| WP6 | Tier 5 + Tier 2 combined gate | seed.js + app.js mount | **1** |
| WP7 | AI POST `aiRateLimiter` overlay | 2 named files | **2** |
| WP8 | Tier 2 at mount line | app.js:1262 | **1** |
| WP8 (PRESERVE) | Bull Board sub-router untouched | queue-monitor.js | **1** |
| | | **Total** | **21** |

**WP1 and WP2 are not counted as separate dispositions.** WP1 (lazy-noop
removal at `opportunityRoutes.js`) and WP3's `opportunityRoutes (9)` Tier 1
item describe the same outcome at the same scope — removing the fail-open
fallback *is* the Tier 1 assignment, confirmed at §4 row 9. WP2 (legacy
alias conversion, 33 instances, 7 files) changes an alias
(`authenticateToken`/`authenticate` → `requireAuth`) without changing Tier —
both aliases are already Tier-1-equivalent — so it is not itself a Tier
disposition under Ruling 1; §4 rows that depend on WP2's output (search.js,
processing.js) note it where relevant.

**This reaches 21, independently, from the commit body alone.** It matches
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2's CP10 row (`WP3 across 9
routes + remainder; WP4 across 6; WP6; AI POSTs; processing.js Tier 2-equiv;
queue-monitor mount-line; PRESERVE` → **21**), filed 2026-08-23, itself a
MEASURED, merged document using the same two sources. **The two counts
corroborate rather than one citing the other** — this pass's population was
built from §2.2/§2.3 before consulting that document's total.

**The one soft point:** which item Measurement v2's single word "PRESERVE"
names is not stated there. This pass assigns it to the Bull Board
sub-router (queue-monitor.js), the one preservation claim in the commit body
not already absorbed into a WP1–WP8 row (WP4's admin.js-preserved item is
already counted in WP4's 6). §4 row 21 confirms the underlying code fact
either way; only the cross-reference to Measurement v2's phrasing is this
pass's inference.

---

# §3. CP10's basis commit, on the face

**`b0a404e77765efbbb75b4fb4ebebf44fe0b83d5f`** — found per §2.1's command,
confirmed an ancestor of `origin/main` at this document's basis. All reads
in §4 are `git show b0a404e77:<path>` against this SHA, per Ruling 3.

---

# §4. Confirmation table — 21/21

Each row: CP10's recorded disposition, the file:line read at
`b0a404e77`, the recorded tier, what the code shows, and the verdict.

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `aiUsageRoutes.js` · Tier 1 ADD (7) | `src/routes/aiUsageRoutes.js:38,82,119,148,175,191,295` | 7× `requireAuth` | 7 GET routes, each `requireAuth`, no others | **agree** |
| 2 | `session.js` · Tier 1 ADD (1) | `src/routes/session.js:13` | 1× `requireAuth` | `GET /brief`, `requireAuth` | **agree** |
| 3 | `propertyRoutes.js` · Tier 1 ADD (9) | `src/routes/propertyRoutes.js:38,45,53,82,118,149,178,234,257` | 9× `requireAuth` | 9 routes, each `requireAuth` | **agree** |
| 4 | `search.js` · Tier 1 ADD (1 new) + WP2 remainder (9 alias-converted) = 10 total | `src/routes/search.js:17,24,31,38,46,53,60,68,75,82` | 1 new + 9 converted, all `requireAuth` | 10 routes, each `requireAuth` (matches `Fix_Plan_v2.35.md` §5.62 Tier 1 total of 10 for this file) | **agree** |
| 5 | `processing.js` · Tier 1 ADD, GETs (7) | `src/routes/processing.js:22,25,28,31,34,37,40` | 7× `requireAuth` | 7 GET routes, each `requireAuth` | **agree** |
| 6 | `amberSessionRoutes.js` · Tier 1 ADD (4) | `src/routes/amberSessionRoutes.js:287,309,355,433` | 4× `requireAuth` | 4 routes, each `requireAuth` (2 also carry preserved rate-limiters, not a Tier claim) | **agree** |
| 7 | `amberDiagnosticRoutes.js` · Tier 1 ADD (8, incl. 1 AI-POST overlay) | `src/routes/amberDiagnosticRoutes.js:378,389,416,443,475,533,545,558` | 8× `requireAuth` | 8 routes, each `requireAuth`; L475 also carries `aiRateLimiter` (row 19) | **agree** |
| 8 | `upgradeRoutes.js` · Tier 1 ADD (16, incl. 5 AI-POST overlay) | `src/routes/upgradeRoutes.js:43,149,165,265,276,291,318,383,399,411,510,522,544,563,583,623` | 16× `requireAuth` | 16 routes, each `requireAuth`; 5 also carry `aiRateLimiter` (row 18) | **agree** |
| 9 | `opportunityRoutes.js` · Tier 1 ADD (9), replacing lazy-noop fallback (WP1) | `src/routes/opportunityRoutes.js:57,87,134,164,230,250,272,302,325` | 9× `requireAuth` | 9 routes, each `requireAuth`; diff vs parent `34f5684e0b` confirms the prior `optionalAuth \|\| ((req,res,next)=>next())` fallback is gone, not just renamed | **agree** |
| 10 | `siteOrganizerRoutes.js` · Tier 2 ADD (3) | `src/routes/siteOrganizerRoutes.js:13,23,33` | 3× `requireAuth, authorize(['ADMIN'])` | 3 routes, each pair present; diff vs parent shows all 3 had no auth middleware before CP10 | **agree** |
| 11 | `designAgentRoutes.js` · Tier 2 ADD (3) | `src/routes/designAgentRoutes.js:7,15,23` | 3× `requireAuth, authorize(['ADMIN'])` | 3 routes, each pair present; diff confirms prior state had no auth middleware | **agree** |
| 12 | `auditLogs.js` · Tier 2 PROMOTE (1, `GET /`) | `src/routes/auditLogs.js:18` | 1 promotion to `requireAuth, authorize(['ADMIN'])` | `GET /` at L18 carries the pair; diff vs parent shows this route had **no auth middleware at all** before CP10 (the other 2 routes in this file were alias-converted `authenticate`→`requireAuth`, already Tier 2, not a promotion) | **agree** |
| 13 | `templates.js` · Tier 2 PROMOTE (2, `GET /`, `GET /:id`) | `src/routes/templates.js:21,45` | 2 promotions to `requireAuth, authorize(['ADMIN'])` | Both routes carry the pair; diff vs parent shows both had **no auth middleware** before CP10 (the 3 mutate routes were alias-converted, already Tier 2) | **agree** |
| 14 | `cfoAgentRoutes.js` · Tier 2 domain-semantic escalation (9) | `src/routes/cfoAgentRoutes.js:10,21,39,104,109,114,122,128,133` | 9× `requireAuth, authorize(['ADMIN'])`, newly added | All 9 routes carry the pair; diff vs parent shows **all 9 had no auth middleware at all** before CP10 — a full-file escalation, not a partial promote | **agree** |
| 15 | `admin.js` · Tier 2 lowercase preserved verbatim (2) | `src/routes/admin.js:20,48` | `authenticateToken`→`requireAuth` alias conversion; `authorize(['admin'])` (lowercase) left unchanged | Both routes: `requireAuth, authorize(['admin'])`; diff vs parent confirms only the first token changed, casing untouched | **agree** |
| 16 | `processing.js` · Tier 2-equivalent, verified/preserved (4) | `src/routes/processing.js:43-48,51-56,59-64,67-72` | `requireAuth, requirePermission('processing', <verb>)` at the 4 mutate handlers, no new edit beyond alias | POST `/`, PUT `/:id`, POST `/:id/retry`, DELETE `/:id` each carry exactly that pair | **agree** |
| 17 | `seed.js` mount + handlers · Tier 5 + Tier 2 combined gate | `src/app.js:1027-1028`; `src/routes/seed.js:166,207,249` | Mount wrapped in `if (process.env.NODE_ENV !== 'production')`; 3 handlers inside carry `requireAuth, authorize(['ADMIN'])` | `app.js:1027` `if (process.env.NODE_ENV !== 'production') { app.use('/api/v1/seed', seedRoutes); }`; all 3 `seed.js` routes carry the Tier 2 pair | **agree** |
| 18 | `upgradeRoutes.js` · AI POST `aiRateLimiter` overlay (5) | `src/routes/upgradeRoutes.js:43,165,411,583,623` | 5 named handlers carry `requireAuth, aiRateLimiter` | All 5 lines carry both middlewares | **agree** |
| 19 | `amberDiagnosticRoutes.js` · AI POST `aiRateLimiter` overlay (1) | `src/routes/amberDiagnosticRoutes.js:475` | `POST /findings/:id/execute` carries `requireAuth, aiRateLimiter` | Line 475 carries both | **agree** |
| 20 | queue-monitor mount · Tier 2 at MOUNT LINE | `src/app.js:1262` | `app.use('/admin/queues', requireAuth, authorize(['ADMIN']), queueMonitorRoutes)` | Line 1262 matches verbatim | **agree** |
| 21 | queue-monitor Bull Board sub-router · PRESERVE (untouched) | `src/routes/queue-monitor.js` (whole file, 94 lines) | Auth applied only at the mount line (row 20); sub-router carries no auth of its own, including its `/stats` and `/recent` JSON routes | File read in full: no `requireAuth`, `authorize`, or any auth import present anywhere in `queue-monitor.js` | **agree** |

**21/21 agree. 0 disagree. 0 cannot-tell. Cannot-tell rate: 0/21.**

---

# §5. Zero `cannot-tell` is reported, and the discriminator is answered

`v2.68` §4.1: *"A limb 1 pass reporting no `cannot-tell` results is MORE
suspect than one reporting several."* `F-AUTH-1_Limb1_Measurement_v2`'s §4.1
answers the same signal for its own zero by distinguishing **retrieval**
(reading a record that states dispositions) from **re-derivation**
(reconstructing a disposition the record never stated). The same
distinction applies here, in a stronger form specific to a CP10-shaped
record:

- **Every disposition in §4 names an exact file and, for 20 of 21 rows, an
  exact line or line set**, stated by CP10's own commit body — not
  inferred from reading the diff cold. The confirmation is: does the named
  file, at the named line, at CP10's own basis commit, carry the named
  middleware chain. That is a direct string-level read, not a judgment
  call about intent.
- **Where the claim was relative** (a "PROMOTE" or "domain-semantic
  escalation," meaning the code changed from unauthenticated to Tier 2, not
  merely that it currently reads Tier 2) — rows 12, 13, 14, 15 — this pass
  went one step further than a single `git show` and read the diff against
  CP10's parent (`34f5684e0b`) to confirm the *before* state the claim
  implies, rather than accepting the *after* state alone as sufficient.
  That is the one place a single-commit read would have been too weak to
  distinguish "correctly promoted" from "already there," and it is why
  rows 12–15 cite the diff explicitly rather than only `b0a404e77`.
- **What would have produced a `cannot-tell` here** is a disposition
  described only in prose, at cluster or file granularity, without a line
  number recoverable from either source — the shape several other CPs take
  (per Measurement v2 §2's rows for CP1, CP4, CP5, Track 7). **CP10's
  record does not take that shape.** It is the CP with the most granular
  commit body in the population (a `Files modified (20):` block organized
  by work package, naming files and often line numbers directly), which is
  a property of CP10's own record, not of how this pass read it.

**This zero is explained, not clean, and the explanation is CP10-specific:
it does not predict what CP1–CP9, CP11, or CP12 will show, and no claim is
made about them here.**

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

**Unchanged from `v25_Owed_Index_Amd30_2026-09-01.md`'s own post-filing
prediction (56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`,
or `PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP10 only.** CP1–CP9, CP11, and CP12 remain
  unconfirmed. Limb 1 stays **OPEN** — Ruling 4 requires all twelve.
- **Does not re-derive or challenge any of CP10's Tier dispositions.** Every
  row above asks whether CP10's own code matches CP10's own recorded
  claim, not whether the claim was the right one to make.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP10 row as authority for this
  pass's population — §2.4 built the population independently and notes
  where the two agree.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work. Ruling 5's withdrawal
  of the `~700` figure is not revisited.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.35.md`,
  `v2.68`, or `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `3babe6904`, against CP10's basis commit `b0a404e7` and its
parent `34f5684e0`. No host, AWS, database, or Cognito contact. No endpoint
exercised. Prod FROZEN.*
