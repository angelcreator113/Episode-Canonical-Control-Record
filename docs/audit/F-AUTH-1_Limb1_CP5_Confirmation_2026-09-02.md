| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP5 CONFIRMATION PASS** *One CP of twelve. 3 recorded dispositions read against code at CP5's own basis commit. 3/3 agree — including a security-relevant Item 16 dev-bypass removal, verified by diff.* |
| --- |

# F-AUTH-1 Limb 1 — CP5 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP5 —
of the twelve-CP historical population Ruling 2 fixes. Sixth CP confirmed;
CP1, CP2, CP3, CP4, and CP10 were done separately
(`F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md`,
`F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md`,
`F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md`,
`F-AUTH-1_Limb1_CP4_Confirmation_2026-09-02.md`,
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
**Zero-count classes are not counted. A class total that is only partly
itemized is counted as the named scopes plus one for the un-itemized
remainder — but where the record itself frames a change as its own action
(not merely a Tier assignment), it is a distinct disposition.**

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

# §2. Population — CP5's recorded dispositions, established

## §2.1 Locating CP5

```
$ git log --all --oneline --grep="CP5" -i | grep -i "Step 3 CP5"
0b9e11e30 docs(audit): F-AUTH-1 fix plan v2.29 — Step 3 CP5 closure ...
1a2d433d0 f-auth-1 step 3 CP5: Wardrobe cluster — 7 files, 86 handlers, ...

$ git log -1 --format='%H %ad %s' --date=short 1a2d433d0
1a2d433d069c3e86ecbdad5d900cbf420bcd00e3 2026-05-07 f-auth-1 step 3 CP5: ...

$ git merge-base --is-ancestor 1a2d433d0 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P 1a2d433d0
5c13531ede675f86b78fdcfde70e6fe63fe38020
```

**CP5's commit: `1a2d433d069c3e86ecbdad5d900cbf420bcd00e3`, 2026-05-07,
confirmed an ancestor of `origin/main`.** Its parent is CP4's commit
directly — no intervening Track 7 mini-CP.

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b 1a2d433d0
```

Full body read (65 lines). The disposition-bearing content, quoted in
relevant part:

> "Wardrobe cluster sweep: 7 files / 86 handlers / pure Tier 1 disposition.
> Tier 1 (requireAuth) [74 handlers], Tier 1 + aiRateLimiter (NEW
> promotions per worldEvents reference model) [12 handlers]. Tier 2/3/4/5:
> 0 handlers.
>
> AI POST reference model application (12 handlers ...):
> - wardrobe.js × 8 (lines 211, 225, 228, 234, 241, 247, 250, 1774
>   pre-edit) — ADD requireAuth + aiRateLimiter
> - wardrobeLibrary.js × 1 (line 157 pre-edit) — ADD
> - wardrobeBrands.js × 1 (line 335 pre-edit) — ADD
> - hairLibraryRoutes.js × 1 (line 136 pre-edit) — ADD
> - makeupLibraryRoutes.js × 1 (line 134 pre-edit) — ADD
>
> Item 16 closure (ESCALATED — wardrobeLibrary.js dev-mode auth-bypass
> eliminated):
> - Removed `const isDevelopment = process.env.NODE_ENV === 'development';`
> - Removed `authMiddleware` const block with dev-user injection
> - 5 handlers escalated from authMiddleware to requireAuth
> - Net effect: dev-mode auth-bypass eliminated; all 5 affected handlers
>   (and indeed all 25 handlers in the file) require valid auth in ALL
>   environments post-CP5
>
> outfitSets.js audit §4.1(b) sub-form closure:
> - ADD requireAuth import to outfitSets.js
> - 5 routes wrapped with requireAuth (GET / + GET /:id + POST / +
>   PUT /:id + DELETE /:id)"

**`outfitSets.js`'s 5 routes are one of the 7 cluster files** (confirmed at
§2.3), not a separate scope outside the 86-handler total — its narrative
paragraph explains *why* (closing a pre-existing audit sub-form), not a
disposition distinct from the aggregate Tier 1 bucket.

## §2.3 Identifying the 7 files

```
$ git diff --stat 5c13531ed..1a2d433d0 -- src/routes
 src/routes/hairLibraryRoutes.js   | 15 ++++----
 src/routes/makeupLibraryRoutes.js | 15 ++++----
 src/routes/outfitSets.js          | 11 +++---
 src/routes/wardrobe.js            | 77 ++++++++++++++++++---------------------
 src/routes/wardrobeBrands.js      | 21 +++++------
 src/routes/wardrobeEventRoutes.js |  8 ++--
 src/routes/wardrobeLibrary.js     | 71 ++++++++++++++----------------------
 7 files changed, 98 insertions(+), 120 deletions(-)
```

**Seven files, matching the commit body's own count.** `wardrobeEventRoutes.js`
is the one file the commit body's prose never names directly (it carries
no AI POST or Item 16 content); it is included in the 74-handler Tier 1
aggregate. Same method as `F-AUTH-1_Limb1_CP4_Confirmation_2026-09-02.md`
§2.4: a mechanical `git diff --stat` against the commit's own stated parent
recovers the complete, closed file list the commit body's "7 files" already
names — not a re-derivation of any Tier judgment.

## §2.4 The population: 3 recorded dispositions

| # | scope | class | named detail |
|---|---|---|---|
| 1 | 7-file Wardrobe cluster | Tier 1 (`requireAuth`), 74 handlers | aggregate total, no per-file breakdown |
| 2 | 5 files (`wardrobe.js`, `wardrobeLibrary.js`, `wardrobeBrands.js`, `hairLibraryRoutes.js`, `makeupLibraryRoutes.js`) | Tier 1 + `aiRateLimiter` ADD, 12 handlers | itemized per file: 8+1+1+1+1, pre-edit line numbers named |
| 3 | `wardrobeLibrary.js` | Item 16 escalation — dev-mode `authMiddleware` bypass removed, 5 handlers → `requireAuth` | named code removed (`isDevelopment`, `authMiddleware` block) |

**Tier 2/3/4/5 (0 handlers) is not counted**, per Ruling 1's zero-count
rule.

**This reaches 3, independently, from the commit body alone.** It matches
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2's CP5 row (`Tier 1 [74];
AI POST [12]; Item 16 escalation` → **3**), filed 2026-08-23. As with the
CP1/CP2/CP4/CP10 passes, this pass's population was built from §2.2/§2.3
before consulting that document's total.

---

# §3. CP5's basis commit, on the face

**`1a2d433d069c3e86ecbdad5d900cbf420bcd00e3`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
1a2d433d0:<path>` across the seven files at §2.3, and one diff against its
parent `5c13531ed` (CP4's commit) for row 3's escalation claim, per
Ruling 3.

---

# §4. Confirmation table — 3/3

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | 7-file cluster · Tier 1 (74), 0 Tier 2/3/4/5 | all seven files, in full | 74 `requireAuth`-only handlers; zero `authorize(`, zero `optionalAuth` anywhere | Route counts: `hairLibraryRoutes.js` 6, `makeupLibraryRoutes.js` 6, `outfitSets.js` 5, `wardrobe.js` 34, `wardrobeBrands.js` 7, `wardrobeEventRoutes.js` 3, `wardrobeLibrary.js` 25 — sum **86**, matching the commit body exactly. `86 − 12 (row 2) = 74`. `authorize(` and `optionalAuth` are **0** across all seven files | **agree** |
| 2 | AI POST ADD (12) | `wardrobe.js` (8), `wardrobeLibrary.js:140` (1), `wardrobeBrands.js` (1), `hairLibraryRoutes.js` (1), `makeupLibraryRoutes.js` (1) | `requireAuth, aiRateLimiter` at the named files | `aiRateLimiter` usage-site counts (excl. import lines): `wardrobe.js` 8, `wardrobeLibrary.js` 1, `wardrobeBrands.js` 1, `hairLibraryRoutes.js` 1, `makeupLibraryRoutes.js` 1 — **matches the per-file split exactly** | **agree** |
| 3 | `wardrobeLibrary.js` · Item 16 escalation (5) | `wardrobeLibrary.js` (diff vs `5c13531ed`) | `isDevelopment`/`authMiddleware` dev-bypass block removed; 5 named routes (`/:id/usage`, `/:id/usage/shows`, `/:id/usage/timeline`, `/:id/track-view`, `/:id/track-selection`) escalated to `requireAuth` | `grep -n "isDevelopment\|authMiddleware\|NODE_ENV"` on `1a2d433d0`'s `wardrobeLibrary.js` → **0 matches** (fully removed); diff vs `5c13531ed` shows exactly the `isDevelopment` const, the `authMiddleware` block, and the 5 named routes' `authMiddleware`→(removed) transition; all 25 routes in the file now carry `requireAuth` (26 mentions = 25 routes + 1 import) | **agree** |

**3/3 agree. 0 disagree. 0 cannot-tell. Cannot-tell rate: 0/3.**

---

# §5. Zero `cannot-tell`, and why it holds here the same way it held at CP4

`v2.68` §4.1: a limb 1 pass reporting zero `cannot-tell` is more suspect
than one reporting several, absent an explanation specific to the record's
own shape.

**Row 1's 74-handler aggregate is confirmable for the same structural
reason as CP4's row 1** (`F-AUTH-1_Limb1_CP4_Confirmation_2026-09-02.md`
§5): the commit body names a closed "7 files" scope, `git diff --stat`
against the stated parent recovers exactly those seven, and all seven are
small enough (3,613 lines total) to read in full. This is retrieval bounded
by the record's own stated scope, not an audit of files the record never
named.

**Row 3 is the one claim in this CP that is about a *change*, not a
present-tense state** — "escalated from `authMiddleware` to `requireAuth`,"
"dev-mode auth-bypass eliminated." Confirming it required the diff against
`5c13531ed`, not only a read of `1a2d433d0` alone: a single-commit read
would show five `requireAuth` handlers among many others and could not, by
itself, distinguish "always was `requireAuth`" from "escalated from a
dev-bypass this CP removed." The diff resolves that distinction directly —
the removed lines are exactly the `isDevelopment` const and the
`authMiddleware` block the commit body names.

**This CP-specific zero does not predict CP6–CP9, CP11, or CP12.** CP2 and
CP3 each recorded a `cannot-tell`, explained on their own terms; CP1, CP4,
and now CP5 recorded zero, each explained on its own terms here and in
their own documents.

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

**Unchanged from `F-AUTH-1_Limb1_CP4_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP5 only.** CP6–CP9, CP11, and CP12 remain
  unconfirmed. Limb 1 stays **OPEN** — Ruling 4 requires all twelve.
- **Does not re-derive or challenge any of CP5's Tier dispositions.** Every
  row above asks whether CP5's own code matches CP5's own recorded claim.
- **Does not treat the Item 16 escalation as a fresh security finding.**
  It confirms CP5's own recorded remediation of a pre-existing dev-mode
  bypass; it does not assess whether other files carry a similar pattern.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP5 row as authority for this pass's
  population — §2.4 built the population independently and notes where the
  two agree.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including `F-AUTH-1_Fix_Plan_v2.29.md`,
  `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the CP1/CP2/CP3/CP4/CP10
  confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP5's basis commit `1a2d433d0` and its
parent `5c13531ed`. No host, AWS, database, or Cognito contact. No endpoint
exercised. Prod FROZEN.*
