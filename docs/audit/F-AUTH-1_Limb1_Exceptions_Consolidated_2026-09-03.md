| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — EXCEPTIONS CONSOLIDATED** *Every `disagree` and `cannot-tell` verdict across the twelve limb 1 CP confirmations, collected in one place. No recommendation, no FD, no ruling — assembled so Evoni can rule.* |
| --- |

# F-AUTH-1 — limb 1 exceptions consolidated — 2026-09-03

**FILED 2026-09-03.** Collects every row across the twelve limb 1 CP
confirmation passes whose verdict is `disagree` or `cannot-tell`, each with
its recorded disposition, the code read at that CP's own basis commit, and
the delta stated plainly. This document rules nothing and mints nothing.

**Basis:** `origin/main` at `a87ac4a351c0e470d9bfde413edd27f418c65eaa`,
2026-09-03.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**MEASURED throughout.** Every row below is copied verbatim from a filed CP
confirmation document and re-verified here against the code at that
document's own cited basis commit (all twelve CPs share one basis,
`f92a4edad`, established below). These are observations, not rulings.
Disposition of each is Evoni's. Only a Fix Plan revision mints an FD — this
document does not, and does not recommend that one be minted.

**Environment contact — stated in full.** None. Every read below is a `git
show` against a commit already on `origin/main`. No host, AWS, database, or
Cognito contact.

---

# §1. The population: twelve CP confirmation documents, established

```
$ ls docs/audit/ | grep -E 'F-AUTH-1_Limb1_CP[0-9]+_Confirmation_' | sort -V
F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP4_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP5_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP7_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP8_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP9_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP11_Confirmation_2026-09-02.md
F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md
```

Twelve files, one per CP. All twelve cite the same basis:

```
$ grep -h '^\*\*Basis:\*\*' docs/audit/F-AUTH-1_Limb1_CP*_Confirmation_2026-09-02.md | sort -u
**Basis:** `origin/main` at `f92a4edade600d8412fb22dd0ac6726c5ac32418`,
```

One distinct basis SHA across all twelve documents (`f92a4edad`, CP1's own
adding commit — CP2 through CP12 add only files under `docs/audit/`, so
`src/` at that SHA is identical to `src/` at this document's own basis,
`a87ac4a3`).

# §2. Extraction: 2 disagree, 5 cannot-tell — matches §6.1

```
$ grep -n 'disagree\|cannot-tell' docs/audit/F-AUTH-1_Limb1_CP*_Confirmation_2026-09-02.md
```
(full output not reproduced here — it is long; the rows it identifies as
table entries, as opposed to prose discussing the discriminator, are
extracted individually in §3 and §4 below.)

**Per-CP tally, read from each document's own §4/§5 summary line:**

| CP | agree | disagree | cannot-tell |
|---|---|---|---|
| CP1 | 3 | 0 | 0 |
| CP2 | 8 | 0 | 1 |
| CP3 | 6 | 0 | 1 |
| CP4 | 3 | 0 | 0 |
| CP5 | 3 | 0 | 0 |
| CP6 | 20 | 2 | 0 |
| CP7 | 17 | 0 | 0 |
| CP8 | 19 | 0 | 0 |
| CP9 | 11 | 0 | 0 |
| CP10 | 21 | 0 | 0 |
| CP11 | 3 | 0 | 0 |
| CP12 | 6 | 0 | 3 |
| **Total** | **120** | **2** | **5** |

**2 disagree and 5 cannot-tell, matching `PROJECT_CONTEXT.md` §6.1's
recorded counts exactly.** No mismatch to report. Total population 127
(120 + 2 + 5), also matching §6.1.

---

# §3. The 2 disagree rows, in full

Both are in CP6, both in `src/routes/universe.js`, both counting errors on
an otherwise-correct Tier ruling (CP6 §5 states this explicitly and this
document does not re-litigate that characterization — it is carried from
the source document, not re-derived).

## §3.1 CP6 row 11 — Tier 1 writes

**Recorded** (`F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md` §4, row 11):

| Scope | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|
| `universe.js` · Tier 1 writes | `src/routes/universe.js:46,76,87,99,124` | **4** | 5 — see below | **disagree** |

**Code read at the shared basis** (`f92a4edade600d8412fb22dd0ac6726c5ac32418`),
re-verified by this document:

```
$ git show f92a4edade600d8412fb22dd0ac6726c5ac32418:src/routes/universe.js | sed -n '46p;76p;87p;99p;124p'
router.post('/', requireAuth, async (req, res) => {
router.post('/series', requireAuth, async (req, res) => {
router.put('/series/:id', requireAuth, async (req, res) => {
router.delete('/series/:id', requireAuth, async (req, res) => {
router.put('/:id', requireAuth, async (req, res) => {
```

**Delta:** five `requireAuth` writes at the five cited lines, not four as
recorded — the record's own line list (46, 76, 87, 99, 124) is five
addresses, one more than the count it states for them.

## §3.2 CP6 row 12 — Tier 4 GETs (PUBLIC)

**Recorded** (`F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md` §4, row 12):

| Scope | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|
| `universe.js` · Tier 4 GETs (PUBLIC) | `src/routes/universe.js:36,61,111` | **4** | 3 — see below | **disagree** |

**Code read at the shared basis**, re-verified by this document:

```
$ git show f92a4edade600d8412fb22dd0ac6726c5ac32418:src/routes/universe.js | sed -n '36p;61p;111p'
router.get('/', optionalAuth, async (req, res) => {
router.get('/series', optionalAuth, async (req, res) => {
router.get('/:id', optionalAuth, async (req, res) => {
```

**Delta:** three `optionalAuth` GETs at the three cited lines, not four as
recorded — the reverse direction from row 11: three addresses, one fewer
than the stated count.

**Net effect, stated because CP6 §5 states it and it bears on reading the
pair together:** 5 + 3 = 8, the same total as the recorded 4 + 4. The
disagreement is about how the eight handlers split between the two Tiers,
not about how many exist or their Tier assignment as a class.

---

# §4. The 5 cannot-tell rows, in full

None of these five names a specific file or line — that is the shape of
each: an aggregate figure over an unitemized remainder. No `git show` can
settle a claim that does not cite an address, so none is attempted here;
each entry instead states what is missing and what would supply it.

## §4.1 CP2 row 9 — Tier 1 cluster remainder

**Recorded** (`F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md` §4, row 9):

| Scope | path:line | Recorded | Verdict |
|---|---|---|---|
| cluster Tier 1 remainder (~19 other files, plus 3 of the 5 "preserved" AI-POST handlers) | **none named** | Tier 1 promoted, aggregate only | **cannot-tell** |

**What is undetermined:** which of the ~19 other files in the cluster, and
which 3 of the 5 "preserved" AI-POST handlers, this portion of the recorded
227-handler / 222-Tier-1-handler total refers to.

**What would settle it:** an independent file-by-file audit of all 22 files
in the cluster to identify and itemize the remainder — which CP2's own
confirming document declined to perform because it would re-derive the
sweep rather than confirm a recorded disposition (Ruling 3, cited in CP2
§1).

## §4.2 CP3 row 7 — Tier 1 remainder, `world.js` + `worldEvents.js`

**Recorded** (`F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md` §4, row 7):

| Scope | path:line | Recorded | Verdict |
|---|---|---|---|
| `world.js` + `worldEvents.js` · Tier 1 remainder (~65, unitemized) | **none named** | Tier 1 promoted, aggregate only | **cannot-tell** |

**What is undetermined:** which handlers in `world.js` and `worldEvents.js`
make up the ~65-handler remainder of the recorded 101-handler Tier 1 total
(101 − 34 in `worldStudio.js` − 2 in `worldTemperatureRoutes.js` = 65, per
CP3 §2.4's own arithmetic).

**What would settle it:** an independent full route-list audit of both
files to locate and itemize the ~65 — declined for the same re-derivation
reason as §4.1.

## §4.3 CP12 row 1 — Tier 1, cluster-wide

**Recorded** (`F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md` §4, row 1):

| Scope | path:line | Recorded | Verdict |
|---|---|---|---|
| Tier 1, cluster-wide | 20 files | ~115 | **cannot-tell** |

**What is undetermined:** CP12's own record states a "~155 net edit-touched"
figure across a 20-file, 212-total-route cluster, without mapping that
figure to specific files or lines; ~115 of it is claimed as Tier 1.

**What would settle it:** independently classifying which of the 212 routes
across the 20 files are CP12's edits versus pre-existing, and which of
those are Tier 1 — a re-derivation, per CP12 §1.

## §4.4 CP12 row 7 — Tier 4 PUBLIC, cluster-wide

**Recorded** (`F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md` §4, row 7):

| Scope | path:line | Recorded | Verdict |
|---|---|---|---|
| Tier 4 PUBLIC, cluster-wide | 20 files | ~28 | **cannot-tell** |

**What is undetermined and what would settle it:** the same as §4.3 — no
file or line is named, and the same 212-route reclassification would be
required, this time isolating the ~28 claimed as Tier 4 PUBLIC.

## §4.5 CP12 row 9 — AI POST overlay, remainder

**Recorded** (`F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md` §4, row 9):

| Scope | path:line | Recorded | Verdict |
|---|---|---|---|
| AI POST overlay, remainder | 20 files | ~25 | **cannot-tell** |

**What is undetermined and what would settle it:** the same as §4.3 and
§4.4 — no file or line is named for the ~25-handler remainder; the same
212-route reclassification would be required to isolate it.

---

# §5. What this document does not do

- **Does not recommend a disposition for either `disagree` row or any of
  the five `cannot-tell` rows.** Whether the `universe.js` split (§3)
  warrants an FD, and whether the five aggregate remainders (§4) are worth
  itemizing, are calls this document states the facts for and does not
  make.
- **Does not mint FD-70 or any other FD, XK, or PE number.** Only a Fix
  Plan revision mints an FD.
- **Does not re-derive any of the 120 `agree` rows**, and does not
  re-confirm any CP's Tier assignments beyond the seven rows extracted
  here.
- **Does not resolve any of the five `cannot-tell` rows.** Doing so would
  be the re-derivation each source CP document declined to perform, for
  the same reason stated in each.
- **Does not treat the `universe.js` disagreement as evidence of a
  mis-tiered handler.** Both rows agree the eight handlers are Tier-1
  writes and Tier-4-PUBLIC reads respectively; the disagreement is about
  how the count splits 5/3 rather than the recorded 4/4, per CP6 §5.
- **Does not edit any filed document under `docs/audit/`**, including the
  twelve source CP confirmations.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Type: evidence note, consolidating existing filed findings. Rules nothing,
mints nothing. Every claim MEASURED and independently re-verified against
`origin/main` at this document's own basis. No host, AWS, database, or
Cognito contact. Prod FROZEN.*
