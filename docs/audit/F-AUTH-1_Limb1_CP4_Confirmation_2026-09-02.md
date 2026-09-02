| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP4 CONFIRMATION PASS** *One CP of twelve. 3 recorded dispositions read against code at CP4's own basis commit. 3/3 agree — explained, because the "unitemized" bucket names a complete, fully-enumerable scope, unlike CP2's and CP3's remainders.* |
| --- |

# F-AUTH-1 Limb 1 — CP4 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP4 —
of the twelve-CP historical population Ruling 2 fixes. Fifth CP confirmed;
CP1, CP2, CP3, and CP10 were done separately
(`F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md`,
`F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md`,
`F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md`,
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

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one handler.**
**"Where a class total is only partly itemized, the named scopes are
counted plus one for the un-itemized remainder."** **"Zero-count classes
are not counted"** (`Tier 2/3/4/5: 0 handlers` records absence, not
judgment).

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation:**

> "Read what the CP ruled. Read the code it ruled about, at that CP's own
> basis. Record `agree` / `disagree` / `cannot-tell`." "**`cannot-tell` is a
> first-class outcome**." "**A limb 1 pass reporting no `cannot-tell`
> results is MORE suspect than one reporting several**" (§4.1).

**Ruling 4 (§5) — decomposable per CP, partial results hold.**

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN.** Not relied on
here.

---

# §2. Population — CP4's recorded dispositions, established

## §2.1 Locating CP4

```
$ git log --all --oneline --grep="CP4" -i | grep -i "Step 3 CP4"
0ad2c6913 docs(audit): F-AUTH-1 fix plan v2.28 — Step 3 CP4 closure ...
5c13531ed f-auth-1 step 3 CP4: Scene cluster — 6 files, 126 handlers, ...

$ git log -1 --format='%H %ad %s' --date=short 5c13531ed
5c13531ede675f86b78fdcfde70e6fe63fe38020 2026-05-07 f-auth-1 step 3 CP4: ...

$ git merge-base --is-ancestor 5c13531ed origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P 5c13531ed
3e4478148 (f-auth-1 track 7 mini-CP: WorldStudio.jsx 15 mutation sites — apiClient migration, CP3 regression window closed)
```

**CP4's commit: `5c13531ede675f86b78fdcfde70e6fe63fe38020`, 2026-05-07,
confirmed an ancestor of `origin/main`.** Its parent is a Track 7 mini-CP
(`3e4478148`), not CP3 directly — CP3's own record noted this frontend
mini-CP needed to land first (`F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md`
§2.2). CP4 itself touches only backend route files.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b 5c13531ed
```

Full body read (38 lines). The disposition-bearing content, quoted in
relevant part:

> "Scene cluster sweep: 6 files / 126 handlers / pure Tier 1 disposition.
> Tier 1 (requireAuth) [113 handlers], Tier 1 + aiRateLimiter (NEW
> promotions per worldEvents reference model) [13 handlers]. Tier 2/3/4/5:
> 0 handlers (Scene cluster is creator-owned production tooling without
> admin subset, public catalog, or env-gated mounts).
>
> AI POST reference model application (13 handlers ...):
> - sceneProposeRoute.js:203 (POST /propose-scene) — ADD requireAuth +
>   aiRateLimiter
> - sceneSetRoutes.js × 12 sites — ADD requireAuth + aiRateLimiter (lines
>   576, 661, 924, 965, 1139, 1165, 1444, 1698, 1856, 1859, 1862, 2019)"

**The commit body itself names "6 files"** but the 113-handler Tier 1
bucket is not itemized by file in this source.

## §2.3 Source 2 — the closure document's version block

```
$ git log --all --oneline --diff-filter=A -- "docs/audit/F-AUTH-1_Fix_Plan_v2.28.md"
0ad2c6913 docs(audit): F-AUTH-1 fix plan v2.28 — Step 3 CP4 closure ...

$ git log -1 --format='%H %ad' --date=short 0ad2c6913
0ad2c6913fe69d4c574153879d7b650e152fcb5e 2026-05-07

$ git show 0ad2c6913:docs/audit/F-AUTH-1_Fix_Plan_v2.28.md | sed -n '7p'
```

`v2.28` is CP4's closure document, adding commit `0ad2c6913`. Its
**Document version** block corroborates the 6-file / 126-handler total and
the 13-handler AI POST figure (naming the ADD shape and both files) at the
same granularity as the commit body — it adds no further per-file
breakdown of the 113-handler Tier 1 bucket either.

## §2.4 Identifying the 6 files — a mechanical step, not a judgment

Neither source names all six files by filename in one place (the commit
body names two of them — `sceneProposeRoute.js`, `sceneSetRoutes.js` — via
the AI POST itemization). The complete file list is recovered
deterministically from the commit's own diff, not inferred or guessed:

```
$ git diff --stat 3e4478148..5c13531ed -- src/routes
 src/routes/sceneLibrary.js      |  12 ++--
 src/routes/sceneLinks.js        |   9 +--
 src/routes/sceneProposeRoute.js |  15 +++--
 src/routes/sceneSetRoutes.js    | 143 ++++++++++++++++++++--------------------
 src/routes/sceneTemplates.js    |  11 ++--
 src/routes/scenes.js            |  71 ++++++++++----------
 6 files changed, 134 insertions(+), 127 deletions(-)
```

**Six files, matching the commit body's own count.** Locating which files a
commit touched is a mechanical, deterministic read (`git diff --stat`), not
a re-derivation of any Tier judgment — the judgment (Tier 1, `requireAuth`)
is still read from the code, not decided by this pass. This is the basis
for §4's treatment of the 113-handler bucket as confirmable rather than
`cannot-tell` — see §5.

## §2.5 The population: 3 recorded dispositions

| # | scope | class | named detail |
|---|---|---|---|
| 1 | 6-file Scene cluster (`sceneLibrary.js`, `sceneLinks.js`, `sceneProposeRoute.js`, `sceneSetRoutes.js`, `sceneTemplates.js`, `scenes.js`) | Tier 1 (`requireAuth`), 113 handlers | aggregate total, no per-file breakdown |
| 2 | `sceneProposeRoute.js` | Tier 1 + `aiRateLimiter` ADD | 1 handler, line 203 |
| 3 | `sceneSetRoutes.js` | Tier 1 + `aiRateLimiter` ADD | 12 handlers, lines 576, 661, 924, 965, 1139, 1165, 1444, 1698, 1856, 1859, 1862, 2019 |

**Tier 2/3/4/5 (0 handlers) is not counted**, per Ruling 1's zero-count
rule — it records an absence, not a judgment.

**This reaches 3, independently, from the commit body alone.** It matches
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2's CP4 row (`Tier 1 [113];
sceneProposeRoute AI POST; sceneSetRoutes ×12` → **3**), filed 2026-08-23.
As with the CP1/CP2/CP10 passes, this pass's population was built from
§2.2/§2.3 before consulting that document's total.

---

# §3. CP4's basis commit, on the face

**`5c13531ede675f86b78fdcfde70e6fe63fe38020`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
5c13531ed:<path>` against this SHA, across the six files identified at
§2.4, per Ruling 3.

---

# §4. Confirmation table — 3/3

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | 6-file cluster · Tier 1 (113 handlers), 0 Tier 2/3/4/5 | all six files, in full | 113 `requireAuth`-only handlers; zero `authorize(`, zero `optionalAuth` anywhere in the cluster | Route counts: `sceneLibrary.js` 5, `sceneLinks.js` 4, `sceneProposeRoute.js` 6, `sceneSetRoutes.js` 70, `sceneTemplates.js` 5, `scenes.js` 36 — sum **126**, matching the commit body's total exactly. `126 − 13 (row 2+3) = 113`. `grep -c "authorize("` and `grep -c "optionalAuth"` are **0** in every one of the six files | **agree** |
| 2 | `sceneProposeRoute.js` · Tier 1 + `aiRateLimiter` ADD (1) | `src/routes/sceneProposeRoute.js:203` | `POST /propose-scene` → `requireAuth, aiRateLimiter` | Line 203 matches verbatim; sole `aiRateLimiter` usage site in the file (1 import + 1 usage) | **agree** |
| 3 | `sceneSetRoutes.js` · Tier 1 + `aiRateLimiter` ADD (12) | `src/routes/sceneSetRoutes.js:576,661,924,965,1139,1165,1444,1698,1856,1859,1862,2019` | `requireAuth, aiRateLimiter` at all 12 named lines | `grep -n aiRateLimiter` returns exactly these 12 lines (plus the import) — **every line number matches verbatim, no drift** | **agree** |

**3/3 agree. 0 disagree. 0 cannot-tell. Cannot-tell rate: 0/3.**

---

# §5. Zero `cannot-tell` here is a different shape than CP1's or CP10's zero

`v2.68` §4.1: a limb 1 pass reporting zero `cannot-tell` is more suspect
than one reporting several, because the pressure under an unrecoverable
basis is to fill the gap by re-deriving rather than recording it.

**Row 1 of this pass looks, at first glance, like the kind of unitemized
aggregate that CP2's row 9 and CP3's row 7 recorded as `cannot-tell` — a
class total (113 handlers) with no per-file breakdown.** The reason it is
not treated the same way here is a scope difference, not a laxer standard:

- **CP2's remainder** covered handlers in roughly 19 of the cluster's 22
  files — files the CP's own itemization never named at all, leaving no
  deterministic way to know which files carried the remainder without
  auditing the whole 22-file cluster from scratch (a re-derivation).
- **CP3's remainder** covered `world.js` and `worldEvents.js` jointly, with
  no split between the two and no line numbers in either source.
- **CP4's "113" is different in kind: the commit body itself states "6
  files," and `git diff --stat` against the commit's own parent
  deterministically recovers exactly those six** — not a superset, not a
  guess, the complete and only set of files this commit touched. Reading
  all six in full (3,673 lines total) and counting is retrieval bounded by
  the record's own stated scope, not an audit of a larger, unnamed
  population.

**The distinction Ruling 3 draws is between reading code the record points
to and re-judging code the record does not mention.** CP4's record points
to "6 files" as a closed set; this pass located that set mechanically and
read all of it. CP2's and CP3's records point to a subset within a larger,
partially-named cluster, where the *rest* is genuinely unaddressed by
either source.

**This CP-specific zero does not predict CP5–CP9, CP11, or CP12.** Each
prior pass explained its own cannot-tell rate — CP1 and CP10 at 0,
CP2 at 1/9, CP3 at 1/7 — on its own terms; CP4's 0/3 is explained here on
its own terms.

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

**Unchanged from `F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP4 only.** CP5–CP9, CP11, and CP12 remain
  unconfirmed. Limb 1 stays **OPEN** — Ruling 4 requires all twelve.
- **Does not re-derive or challenge any of CP4's Tier dispositions.** Every
  row above asks whether CP4's own code matches CP4's own recorded claim.
- **Does not treat the §2.4 file-list recovery as license to do the same
  for a cluster the record does not fully name.** CP4's method works
  because the commit body itself states a closed file count ("6 files")
  that the diff then locates exactly; it is not a general license to
  enumerate a cluster's files independently when the record's own count is
  larger or unstated.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP4 row as authority for this pass's
  population — §2.5 built the population independently and notes where the
  two agree.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.28.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the CP1/CP2/CP3/CP10
  confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP4's basis commit `5c13531ed`. No host,
AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
