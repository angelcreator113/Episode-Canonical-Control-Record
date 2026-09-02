| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP2 CONFIRMATION PASS** *One CP of twelve. 9 recorded dispositions read against code at CP2's own basis commit. 8/9 agree, 1/9 cannot-tell — a genuine unitemized remainder, not a weak read.* |
| --- |

# F-AUTH-1 Limb 1 — CP2 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP2 —
of the twelve-CP historical population Ruling 2 fixes. Third CP confirmed;
`F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md` did CP10,
`F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md` did CP1. Per Ruling 4, this
is a durable partial result: limb 1 discharges when all twelve CPs are
confirmed, not before.

**Basis:** `origin/main` at `f92a4edade600d8412fb22dd0ac6726c5ac32418`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. Adjudicates no new
Tier disposition — every row below states whether CP2's own recorded
ruling matches the code CP2 itself produced. Limb 1 **OPEN**; limb 3 open;
G4 not enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one handler:**

> "Limb 1 audits the sweep's rulings — each place a CP recorded a
> disposition." "The denominator is non-uniform by construction."

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set, not
the present surface.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation:**

> "Read what the CP ruled. Read the code it ruled about, at that CP's own
> basis. Record `agree` / `disagree` / `cannot-tell`." "**`cannot-tell` is a
> first-class outcome, not a failure to complete a judgment.** It is the
> disposition owed wherever the CP's basis or rationale is not
> recoverable... and must be recorded as such rather than resolved by
> re-derivation." "**A limb 1 pass reporting no `cannot-tell` results is
> MORE suspect than one reporting several**" (§4.1).

**Ruling 4 (§5) — decomposable per CP, partial results hold:**

> "The CPs closed separately." "Limb 1 discharges when all twelve are
> done, and not before."

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN** and does not size
limb 1. Not relied on here.

**This pass applies Ruling 3 to one CP (CP2), per Ruling 4's decomposition,
against the population Ruling 2 defines.**

---

# §2. Population — CP2's recorded dispositions, established

## §2.1 Locating CP2

```
$ git log --all --oneline --grep="CP2" -i | grep -i "Step 3 CP2"
2f8f4d858 f-auth-1 step 3 CP2: ... (#642)
6e5f17b50 docs(audit): F-AUTH-1 fix plan v2.25 — Step 3 CP2 closure ...
d73599f8e f-auth-1 step 3 CP2: Episodes cluster — 22 files, 227 handlers, ...

$ git merge-base --is-ancestor 2f8f4d858 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR
$ git merge-base --is-ancestor d73599f8e origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git show 2f8f4d858 | git patch-id
eb258eb202acd06421c95c6f4ba60b90748bdd5b 2f8f4d858c2483ed247233a00465714a48be285c
$ git show d73599f8e | git patch-id
eb258eb202acd06421c95c6f4ba60b90748bdd5b d73599f8e78c8e2d509e3e4a902b999f598774ca

$ git log -1 --format='%H %ad %P' --date=short 2f8f4d858
2f8f4d858c2483ed247233a00465714a48be285c 2026-05-07 8f30dfc7e184a5bbb370251e53e6309bf856447e
$ git log -1 --format='%H %ad %P' --date=short d73599f8e
d73599f8e78c8e2d509e3e4a902b999f598774ca 2026-05-07 05cd536dd90703372cb0557b191b023156818ef6
```

**Two commits carry CP2's content, both ancestors of `origin/main`, same
patch-id** — this is the CP2 duplicate `F-AUTH-1_Limb1_Measurement_2026-08-22.md`
recorded: *"two commits with byte-identical subjects and identical stat
totals, same patch-id, different parents; the second is the landing of the
first, so CP2 is one disposition set."* `d73599f8e`'s parent is `05cd536dd`
(CP1's commit) — the direct chronological landing, matching the un-suffixed
citation style used for CP1 (`05cd536dd`) and CP10 (`b0a404e7`). `2f8f4d858`
is the same content, squash-merged via PR #642.

**CP2's basis commit: `d73599f8e78c8e2d509e3e4a902b999f598774ca`, 2026-05-07,
confirmed an ancestor of `origin/main`.** Content is identical either way
(patch-id match), so the choice does not affect §4's reads.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b d73599f8e
```

Full body read (57 lines). The disposition-bearing content, quoted in
relevant part:

> "Episodes cluster sweep: 22 files / 227 handlers promoted to Tier 1
> (requireAuth) [222], Tier 2 (requireAuth + authorize(['ADMIN'])) [5],
> Tier 1 + aiRateLimiter [1 new + 5 preserved].
>
> Episodes.js highest-risk file resolved (D5 lock):
> - 11 authenticateToken handlers → requireAuth
> - 2 optionalAuth handlers (lines 313-317 + 372-376) → requireAuth
> - 2 commented-out authenticateToken at lines 400 + 473 uncommented +
>   upgraded to requireAuth (Item 14 lock resolution)
> - 60 bare/no-auth handlers → requireAuth
> - 2 requireAuth + aiRateLimiter AI generators (lines 869, 1108)
>   preserved as reference
>
> Tier 2 admin carve-outs (D1 + D2):
> - wardrobeApproval.js × 4 (approve, reject, bulk-approve,
>   approval-status read) → requireAuth + authorize(['ADMIN'])
> - uiOverlayRoutes.js × 1 (GET /:showId/debug) → admin
>
> Tier 1 + aiRateLimiter (D3): episodeOrchestrationRoute POST
> /generate-episode-orchestration joins worldEvents AI POSTs as
> aiRateLimiter consumer."

**The line numbers cited for the two preserved AI-generator handlers (869,
1108) are pre-fix line numbers**, not lines in `d73599f8e` itself — see
§4 row 5.

## §2.3 Source 2 — the closure document's version block

```
$ git log --all --oneline --diff-filter=A -- "docs/audit/F-AUTH-1_Fix_Plan_v2.25.md"
6e5f17b50 docs(audit): F-AUTH-1 fix plan v2.25 — Step 3 CP2 closure ...

$ git log -1 --format='%H %ad' --date=short 6e5f17b50
6e5f17b50e44396ed3ba71c2ff7249d013c32693 2026-05-07

$ git show 6e5f17b50:docs/audit/F-AUTH-1_Fix_Plan_v2.25.md | sed -n '7p'
```

`v2.25` is CP2's closure document, adding commit `6e5f17b50`. Its
**Document version** block states, in relevant part:

> "v2.25 — Step 3 CP2 (Episodes cluster — 22 files / 227 handlers / 91 new
> tests / 1 session / ~90 min) approved at commit `d73599f8`."

This confirms the basis commit chosen at §2.1 and corroborates the class
totals (22 files, 227 handlers) at the same coarse granularity as the
commit body's opening line — it does not itemize further. Per the rule
applied at the CP1 and CP10 passes: where one source itemizes and the other
states only the class total, the itemization governs. The commit body
itemizes; it governs scope for §2.4.

## §2.4 The population: 9 recorded dispositions

Applying Ruling 1's boundary rule (scope at finest granularity named — file,
not handler; **a class total that is only partly itemized is counted as the
named scopes plus one for the un-itemized remainder**):

| # | scope | class | named lines (pre-fix, per commit body) |
|---|---|---|---|
| 1 | `episodes.js` | 11× `authenticateToken` → `requireAuth` | not individually enumerated |
| 2 | `episodes.js` | 2× `optionalAuth` → `requireAuth` | 313–317, 372–376 |
| 3 | `episodes.js` | 2× commented-out `authenticateToken` uncommented + upgraded | 400, 473 |
| 4 | `episodes.js` | 60× bare/no-auth → `requireAuth` | not individually enumerated |
| 5 | `episodes.js` | 2× `requireAuth + aiRateLimiter` preserved as reference | 869, 1108 |
| 6 | `wardrobeApproval.js` | Tier 2 ADD, 4 named actions | not individually enumerated |
| 7 | `uiOverlayRoutes.js` | Tier 2 ADD (admin), 1 named route | `GET /:showId/debug` |
| 8 | `episodeOrchestrationRoute.js` | Tier 1 + `aiRateLimiter` (NEW) | `POST /generate-episode-orchestration` |
| 9 | **cluster remainder** (the other ~19 files' Tier 1 promotions, plus 3 of the "5 preserved" AI-POST handlers not named above) | Tier 1, unitemized | **none named** |

Rows 1–8 sum to 77 (episodes.js) + 4 (wardrobeApproval) + 1 (uiOverlay) + 1
(episodeOrchestration) = 83 named handlers, against the commit body's own
227-handler cluster total and its "[1 new + 5 preserved]" AI-POST-overlay
figure (row 8 accounts for the 1 new; only 2 of the 5 preserved are named,
at row 5) — **row 9 is not padding; the record itself leaves it unnamed.**

**This reaches 9, independently, from the commit body alone.** It matches
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2's CP2 row (`episodes.js in
5 conversion shapes; wardrobeApproval Tier 2; uiOverlay Tier 2;
episodeOrchestration AI POST; cluster Tier 1 remainder` → **9**), filed
2026-08-23. As with the CP1 and CP10 passes, this pass's population was
built from §2.2/§2.3 before consulting that document's total.

---

# §3. CP2's basis commit, on the face

**`d73599f8e78c8e2d509e3e4a902b999f598774ca`** — found per §2.1, confirmed
an ancestor of `origin/main`, content-identical (patch-id) to `2f8f4d858`
(its PR #642 squash landing). All reads in §4 are `git show
d73599f8e:<path>` against this SHA, and one diff against its parent
`05cd536dd` (CP1's commit) where confirming a *count* or an *absence of
prior auth* required it, per Ruling 3.

---

# §4. Confirmation table — 8 agree, 1 cannot-tell

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `episodes.js` · 11 `authenticateToken`→`requireAuth` | `src/routes/episodes.js` (diff vs `05cd536dd`) | 11 conversions | `git diff 05cd536dd..d73599f8e -- src/routes/episodes.js \| grep -c "^-  authenticateToken,$"` → **11** | **agree** |
| 2 | `episodes.js` · 2 `optionalAuth`→`requireAuth` | `src/routes/episodes.js` (diff, old L180, L197) | 2 conversions | `grep -c "^-  optionalAuth,$"` on the same diff → **2** | **agree** |
| 3 | `episodes.js` · 2 commented-out `authenticateToken` uncommented + upgraded | `src/routes/episodes.js` (diff, old L222, L297) | 2 `// authenticateToken, // ✅ COMMENTED OUT FOR TESTING` lines removed | `grep -c "COMMENTED OUT FOR TESTING"` on the same diff → **2**; 0 `authenticateToken` occurrences remain in `d73599f8e`'s `episodes.js` | **agree** |
| 4 | `episodes.js` · 60 bare/no-auth → `requireAuth` | `src/routes/episodes.js` (diff) | 60 net-new `requireAuth` additions with no removed auth-middleware counterpart | 75 total added `requireAuth` occurrences in the diff, minus the 15 accounted for at rows 1–3 (11+2+2) = **60** | **agree** |
| 5 | `episodes.js` · 2 `requireAuth + aiRateLimiter` preserved as reference | pre-fix `src/routes/episodes.js:876,1116` (parent `05cd536dd`); post-fix `:918,1161` (`d73599f8e`) | Pre-existing, untouched by CP2 | `git show 05cd536dd:src/routes/episodes.js \| grep -n aiRateLimiter` shows the same two handlers already present at L876/L1116 before CP2; `d73599f8e` carries them unchanged at L918/L1161, shifted down by the other insertions earlier in the file. **The commit body's cited lines (869, 1108) are pre-fix line numbers, not `d73599f8e`'s own — noted, not treated as a disagreement, since the underlying claim (2 pre-existing AI-generator handlers, untouched) holds exactly** | **agree** |
| 6 | `wardrobeApproval.js` · Tier 2 ADD, 4 actions | `src/routes/wardrobeApproval.js:12,16,19,22` | `requireAuth, authorize(['ADMIN'])` at approve/reject/approval-status/bulk-approve | All 4 lines carry exactly that pair | **agree** |
| 7 | `uiOverlayRoutes.js` · Tier 2 ADD (admin), 1 route | `src/routes/uiOverlayRoutes.js:219` | `GET /:showId/debug` → `requireAuth, authorize(['ADMIN'])` | Line 219 matches verbatim | **agree** |
| 8 | `episodeOrchestrationRoute.js` · Tier 1 + `aiRateLimiter` (NEW) | `src/routes/episodeOrchestrationRoute.js:132` | `POST /generate-episode-orchestration` → `requireAuth, aiRateLimiter` | Line 132 matches verbatim; sole route in the file | **agree** |
| 9 | cluster Tier 1 remainder (~19 other files, plus 3 of the 5 "preserved" AI-POST handlers) | **none named** | Tier 1 promoted, aggregate only | The commit body states a 227-handler / 222-Tier-1 cluster total but names no file or line for this portion — nothing in either source identifies which of the other ~19 files, or which 3 of the 5 "preserved" AI-POST handlers, this covers. Auditing all 22 files to find them would be re-deriving the sweep, which Ruling 3 excludes | **cannot-tell** |

**8/9 agree. 0 disagree. 1/9 cannot-tell. Cannot-tell rate: 1/9.**

---

# §5. The `cannot-tell` at row 9 is what Ruling 3 asks for, not a shortfall

`v2.68` §4.1 warns that a limb 1 pass reporting **zero** `cannot-tell`
results is *more* suspect than one reporting several, because the pressure
under an unrecoverable basis is to re-derive rather than record the gap.

**Row 9 is exactly that unrecoverable basis, named precisely.** The
commit body itemizes 83 of the cluster's 227 handlers by file and mostly by
line (rows 1–8); it states a 227-handler / 222-Tier-1 aggregate and leaves
the remaining ~144 handlers — spread across roughly 19 files this pass has
not individually named — as a class total with no scope attached. Ruling 3
requires reading *the code the CP ruled about*; a disposition with no named
code to read cannot be confirmed by reading, only by re-auditing the
cluster from scratch, which is the re-derivation Ruling 3 rejects for a
limb 1 pass. **`cannot-tell` is recorded because that is the disposition
the record's own shape produces, not because this pass declined to look.**

**The other eight rows are a clean read for a different reason than CP1's or
CP10's zero.** Every one of them names an exact file and, for six of eight,
an exact line — a string-level check against `d73599f8e`, occasionally
cross-checked against its parent `05cd536dd` where the claim was about a
*change* (rows 1–3) or an *absence of change* (row 5) rather than a
present-tense state. Nothing here was reconstructed from the surrounding
narrative.

**This CP-specific result — 8 agree, 1 cannot-tell — does not predict what
CP3–CP9, CP11, or CP12 will show.** CP1 and CP10 each reported zero
`cannot-tell`, explained on their own terms
(`F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md` §5,
`F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md` §5); CP2's one `cannot-tell`
is explained on its own terms here. The discriminator is read per pass, not
assumed across passes.

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

**Unchanged from `F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP2 only.** CP3–CP9, CP11, and CP12 remain
  unconfirmed (CP1 and CP10 were confirmed separately). Limb 1 stays
  **OPEN** — Ruling 4 requires all twelve.
- **Does not resolve row 9's `cannot-tell`.** Auditing the other ~19 files
  of the Episodes cluster to name the remainder's scope would be a
  re-derivation, which this pass does not perform. The gap is recorded, not
  closed.
- **Does not re-derive or challenge any of CP2's Tier dispositions.** Every
  row above asks whether CP2's own code matches CP2's own recorded claim
  (row 9 excepted, where no claim names a scope to check), not whether the
  claim was the right one to make.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP2 row as authority for this pass's
  population — §2.4 built the population independently and notes where the
  two agree.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work. Ruling 5's withdrawal
  of the `~700` figure is not revisited.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.25.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the CP1/CP10
  confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP2's basis commit `d73599f8e` and its
parent `05cd536dd`. No host, AWS, database, or Cognito contact. No endpoint
exercised. Prod FROZEN.*
