| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP3 CONFIRMATION PASS** *One CP of twelve. 7 recorded dispositions read against code at CP3's own basis commit. 6/7 agree, 1/7 cannot-tell. Population diverges from the prior Measurement v2 total — recorded and explained, not forced to match.* |
| --- |

# F-AUTH-1 Limb 1 — CP3 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP3 —
of the twelve-CP historical population Ruling 2 fixes. Fourth CP confirmed;
CP1, CP2, and CP10 were done separately
(`F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md`,
`F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md`,
`F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md`). Per Ruling 4, this is a
durable partial result.

**Basis:** `origin/main` at `f92a4edade600d8412fb22dd0ac6726c5ac32418`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. Adjudicates no new
Tier disposition. Limb 1 **OPEN**; limb 3 open; G4 not enterable; ASSESSMENT
NOT COMPLETED. Prod **FROZEN**.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one handler:**

> "Limb 1 audits the sweep's rulings — each place a CP recorded a
> disposition." **"Distinct classes at one scope are distinct
> dispositions."** `characterRegistry.js (36 PROMOTE + 1 PRESERVE @ L1882)`
> is two. "Collapsing them because they share a file would count the file,
> not the ruling."

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation:**

> "Read what the CP ruled. Read the code it ruled about, at that CP's own
> basis. Record `agree` / `disagree` / `cannot-tell`." "**`cannot-tell` is a
> first-class outcome**." "**A limb 1 pass reporting no `cannot-tell`
> results is MORE suspect than one reporting several**" (§4.1).

**Ruling 4 (§5) — decomposable per CP, partial results hold.**

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN.** Not relied on
here.

**This pass applies Ruling 3 to one CP (CP3), per Ruling 4's decomposition,
against the population Ruling 2 defines — and, per Ruling 1's own worked
example, applies the distinct-classes-at-one-scope rule to every scope
CP3's record itemizes, not only to the scopes a prior document happened to
separate out. §2.4 explains where this produces a different count than
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`.**

---

# §2. Population — CP3's recorded dispositions, established

## §2.1 Locating CP3

```
$ git log --all --oneline --grep="CP3" -i | grep -i "Step 3 CP3"
5b031d9e7 docs(audit): F-AUTH-1 fix plan v2.26 — Step 3 CP3 closure ...
61f8a6587 f-auth-1 step 3 CP3: World cluster — 4 files, 120 handlers, ...

$ git log -1 --format='%H %ad %s' --date=short 61f8a6587
61f8a6587601f482e1100e7a2abe61c8cc38ca64 2026-05-07 f-auth-1 step 3 CP3: ...

$ git merge-base --is-ancestor 61f8a6587 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P 61f8a6587
d73599f8e78c8e2d509e3e4a902b999f598774ca
```

**CP3's commit: `61f8a6587601f482e1100e7a2abe61c8cc38ca64`, 2026-05-07,
confirmed an ancestor of `origin/main`.** Its parent is CP2's commit
(`d73599f8e`) — consistent with CP1/CP2/CP10's direct-chain citation style.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b 61f8a6587
```

Full body read (48 lines). The disposition-bearing content, quoted in
relevant part:

> "World cluster sweep: 4 files / 120 handlers across mixed disposition:
> Tier 1 (requireAuth) [101 incl. 2 partial AI POST promotions], Tier 3
> (optionalAuth + degradeOnInfraFailure) [1: worldStudio.js:2483
> generate-ecosystem-preview], Tier 4 (plain optionalAuth + PUBLIC) [18:
> worldStudio.js GET handlers]. 2 worldEvents AI POSTs at lines 748 + 1779
> (post-edit) PRESERVED verbatim (already requireAuth + aiRateLimiter).
> ...
> Anomaly 5 amendment (v2.25 §5.5 supersession): worldTemperatureRoutes.js
> has 2 handlers (NOT zero as v2.25 §5.5 stated). Custom router var
> (worldTempRouter) hid handlers from standard grep. Both handlers Tier 1
> promoted at CP3.
> ...
> Architectural findings ... worldEvents AI POST count correction: 5 → 4
> (split: 2 already correct + 2 partial promoted to uniform requireAuth +
> aiRateLimiter)."

**The commit body itemizes worldEvents.js's 4 AI POSTs into two distinct
classes** — 2 already-correct/preserved, 2 partial-promoted — not as one
undifferentiated group of 4.

## §2.3 Source 2 — the closure document's version block

```
$ git log --all --oneline --diff-filter=A -- "docs/audit/F-AUTH-1_Fix_Plan_v2.26.md"
5b031d9e7 docs(audit): F-AUTH-1 fix plan v2.26 — Step 3 CP3 closure ...

$ git log -1 --format='%H %ad' --date=short 5b031d9e7
5b031d9e7dddb280c5c935b77ed20b2794fd0e82 2026-05-07

$ git show 5b031d9e7:docs/audit/F-AUTH-1_Fix_Plan_v2.26.md | sed -n '7p'
```

`v2.26` is CP3's closure document, adding commit `5b031d9e7`. Its
**Document version** block states, in relevant part:

> "v2.26 — Step 3 CP3 (World cluster — 4 files / 120 handlers / 42 new
> tests / 1 session / ~75 min) approved at commit `61f8a658`. Mixed Tier
> 1+3+4 within single file (NEW v2.26 §9.11 architectural primitive):
> worldStudio.js — 1 Tier 3 + 18 Tier 4 GETs + 34 Tier 1 mutations. ...
> WorldEvents reference model uniform state: 4 AI POSTs all requireAuth +
> aiRateLimiter post-CP3 (was 2 + 2 partial)."

**This is the finer of the two sources for `worldStudio.js`** — it names
the file's Tier 1 mutation count (34) alongside its Tier 3 (1) and Tier 4
(18) counts, at the same specificity, in the same sentence. It corroborates
the commit body's 2-preserved/2-promoted split for `worldEvents.js`.

## §2.4 The population: 7 recorded dispositions — and where it diverges from Measurement v2

Applying Ruling 1's own worked rule — **"distinct classes at one scope are
distinct dispositions," per its `characterRegistry.js` example** —
uniformly to every scope both sources name:

| # | scope | class | named detail |
|---|---|---|---|
| 1 | `worldTemperatureRoutes.js` | Tier 1 ADD | 2 handlers, `worldTempRouter.get`/`.post` |
| 2 | `worldStudio.js` | Tier 3 | 1 handler, `POST /world/generate-ecosystem-preview` |
| 3 | `worldStudio.js` | Tier 4 (PUBLIC) | 18 GET handlers |
| 4 | `worldStudio.js` | Tier 1 (mutations) | 34 handlers |
| 5 | `worldEvents.js` | AI POST, PRESERVED verbatim | 2 handlers, already `requireAuth + aiRateLimiter` |
| 6 | `worldEvents.js` | AI POST, promoted `optionalAuth`→`requireAuth` | 2 handlers, `aiRateLimiter` already present |
| 7 | `world.js` + `worldEvents.js` | Tier 1 remainder (unitemized) | ~65 handlers, no scope named beyond the two files |

**This is 7, not the 5 `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2
recorded for CP3** (`worldTemperature Tier 1; Tier 1 remainder; worldStudio
Tier 3; worldStudio Tier 4 GETs; worldEvents PRESERVED`). **The divergence
is at two rows, and both are cases where a later-read source (§2.3's
version block, for row 4; the commit body's own "Architectural findings"
section, for rows 5–6) itemizes a class the earlier 5-item count folded
into a coarser bucket:**

- **Row 4** (`worldStudio.js` Tier 1 mutations, 34) is named at the same
  specificity as its Tier 3 and Tier 4 siblings — same sentence, same
  itemized triple, in both sources. Measurement v2 folded it into "Tier 1
  remainder" instead of giving it its own row, even though nothing
  distinguishes its itemization from the Tier 3/Tier 4 rows it did split
  out.
- **Rows 5–6** (`worldEvents.js`'s 4 AI POSTs) are stated in the commit
  body itself as two classes — "2 already correct" and "2 partial
  promoted" — not as one class of 4. Measurement v2's "worldEvents
  PRESERVED" row names only the preserved half.

**Recorded as a finding, not resolved as a dispute.** Both counts apply
Ruling 1's boundary rule; they differ in how finely that rule was applied
to CP3's specific record. This pass does not amend
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, which is a merged document —
see §7.

---

# §3. CP3's basis commit, on the face

**`61f8a6587601f482e1100e7a2abe61c8cc38ca64`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
61f8a6587:<path>` against this SHA, and one diff against its parent
`d73599f8e` (CP2's commit) for row 6, where the claim was about a change
(`optionalAuth`→`requireAuth`), per Ruling 3.

---

# §4. Confirmation table — 6 agree, 1 cannot-tell

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `worldTemperatureRoutes.js` · Tier 1 ADD (2) | `src/routes/worldTemperatureRoutes.js:15,33` | `requireAuth` on both `worldTempRouter` handlers | Both lines carry `requireAuth`; router is declared as `worldTempRouter = express.Router()`, matching the "custom router var hid handlers" claim | **agree** |
| 2 | `worldStudio.js` · Tier 3 (1) | `src/routes/worldStudio.js:2483` | `POST /world/generate-ecosystem-preview` → `optionalAuth({ degradeOnInfraFailure: true })` | Line 2483 matches verbatim | **agree** |
| 3 | `worldStudio.js` · Tier 4 GETs (18) | `src/routes/worldStudio.js` | 18 plain `optionalAuth` handlers | 53 total routes; 34 `requireAuth` + 1 `degradeOnInfraFailure` (row 2) + 18 remaining `optionalAuth` occurrences = **18** | **agree** |
| 4 | `worldStudio.js` · Tier 1 mutations (34) | `src/routes/worldStudio.js` | 34 `requireAuth` handlers | `grep -c "requireAuth"` among the 53 route definitions → **34** | **agree** |
| 5 | `worldEvents.js` · 2 AI POSTs PRESERVED verbatim | `src/routes/worldEvents.js:748,1779` | `requireAuth + aiRateLimiter`, unchanged by CP3 | Both lines carry that pair (`generate-script` L748, `generate-episode-from-many` L1779); diff vs parent `d73599f8e` shows neither line touched | **agree** |
| 6 | `worldEvents.js` · 2 AI POSTs promoted `optionalAuth`→`requireAuth` | `src/routes/worldEvents.js:1687,1889` | `optionalAuth, aiRateLimiter` → `requireAuth, aiRateLimiter` | Diff vs parent shows exactly these two lines (`generate-episode` L1687, `regenerate-episode` L1889) changing only the first token; `aiRateLimiter` unchanged on both | **agree** |
| 7 | `world.js` + `worldEvents.js` · Tier 1 remainder (~65, unitemized) | **none named** | Tier 1 promoted, aggregate only | Neither source names a file:line for this portion of the 101-handler Tier 1 total (101 − 34 `worldStudio.js` − 2 `worldTemperatureRoutes.js` = 65). Auditing both files' full route lists to locate them would be re-deriving the sweep | **cannot-tell** |

**6/7 agree. 0 disagree. 1/7 cannot-tell. Cannot-tell rate: 1/7.**

---

# §5. The `cannot-tell` at row 7, and why finer itemization did not remove it

`v2.68` §4.1's discriminator: a limb 1 pass reporting zero `cannot-tell` is
more suspect than one reporting several, because the pressure under an
unrecoverable basis is to fill the gap by re-deriving rather than recording
it.

**This pass itemized CP3's record more finely than `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`
did (§2.4) and the `cannot-tell` did not go away — it moved to a smaller,
better-named gap.** Where Measurement v2's coarser "Tier 1 remainder" row
would have covered `worldStudio.js`'s 34 mutations *and* the ~65 handlers
in `world.js`/`worldEvents.js` under one unconfirmable bucket, finer
itemization confirmed the 34 (row 4, both sources name it) and left only
the genuinely unnamed ~65 as `cannot-tell` (row 7). **A finer read produced
a smaller `cannot-tell`, not a cleaner zero** — which is the direction
§4.1 treats as trustworthy: the gap shrank because more of the record
turned out to be checkable, not because this pass declined to look at the
remainder.

**Rows 5 and 6 were the one place a single-commit read would have
under-confirmed.** Reading `worldEvents.js` at `61f8a6587` alone shows four
uniform `requireAuth + aiRateLimiter` handlers with no visible distinction
between "always correct" and "fixed by this CP" — the two classes only
separate on a diff against the parent. Both were checked that way rather
than assumed.

**This CP-specific result does not predict CP4–CP9, CP11, or CP12.** Each
prior pass (CP1, CP2, CP10) explained its own cannot-tell rate on its own
terms; CP3's is explained here on its own terms, arrived at by the same
method, not a target.

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

**Unchanged from `F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP3 only.** CP4–CP9, CP11, and CP12 remain
  unconfirmed. Limb 1 stays **OPEN** — Ruling 4 requires all twelve.
- **Does not resolve row 7's `cannot-tell`.** Auditing `world.js` and
  `worldEvents.js`'s remaining Tier 1 handlers to name the remainder's
  scope would be a re-derivation, which this pass does not perform.
- **Does not amend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`.** §2.4's
  7-versus-5 divergence is recorded as a finding on this document's own
  face; the merged Measurement v2 document is untouched, per the register's
  in-place-amendment rule (a substantive correction mints the next
  document, it does not edit a merged one).
- **Does not re-derive or challenge any of CP3's Tier dispositions.** Every
  row above asks whether CP3's own code matches CP3's own recorded claim
  (row 7 excepted, where no claim names a scope to check).
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.26.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the CP1/CP2/CP10
  confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP3's basis commit `61f8a6587` and its
parent `d73599f8e`. No host, AWS, database, or Cognito contact. No endpoint
exercised. Prod FROZEN.*
