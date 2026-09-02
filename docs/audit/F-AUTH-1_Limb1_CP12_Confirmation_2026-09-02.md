| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP12 CONFIRMATION PASS** *The twelfth and final CP. 9 recorded dispositions read against code at CP12's own basis commit. 6/9 agree, 3/9 cannot-tell — CP12's own record does not decompose the bulk of its ~155 handlers below three large class totals, and this pass does not force it to. With this pass, all twelve CPs are confirmed. Limb 1 discharges.* |
| --- |

# F-AUTH-1 Limb 1 — CP12 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP —
CP12, the keystone-closure CP — of the twelve-CP historical population
Ruling 2 fixes. CP1–CP11 were confirmed separately in eleven prior
documents. **Per Ruling 4, this pass completes limb 1's population: all
twelve CPs are now confirmed, and limb 1 discharges.**

**Basis:** `origin/main` at `f92a4edade600d8412fb22dd0ac6726c5ac32418`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. **Limb 1
DISCHARGES** with this document, per Ruling 4 — every one of CP1–CP12 has
now received a confirmation pass. This does **not** discharge G3, close
F-AUTH-1, or advance limb 3, Dimension 3, or G4 — see §8. Prod **FROZEN**.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one
handler. Where a class total is only partly itemized, the named scopes
are counted plus one for the un-itemized remainder.**

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation:**

> "`cannot-tell` is a first-class outcome... It is the disposition owed
> wherever the CP's basis or rationale is not recoverable, and it must be
> recorded as such rather than resolved by re-derivation." "**A limb 1
> pass reporting no `cannot-tell` results is MORE suspect than one
> reporting several**" (§4.1).

**Ruling 4 (§5) — decomposable per CP, partial results hold:**

> "Limb 1 discharges when all twelve are done, and not before."

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN.** Not relied on
here — this document does not size limb 1 or F-AUTH-1's remaining work.

**`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §1 already anticipated
CP12's shape**, in the course of explaining its own method: *"CP12 names
five §5.21 mixed-tier instances and a class list covering them. The class
list was counted and the five instances treated as its itemization,
because the record does not permit a clean decomposition of which handlers
the named instances cover. The finer reading would have given CP12 twelve
rather than seven."* This pass reaches its own population independently
(§2), and lands closer to that document's own "finer reading" figure than
its filed one — see §2.4.

---

# §2. Population — CP12's recorded dispositions, established

## §2.1 Locating CP12

```
$ git log -1 --format='%H %ad %s' --date=short 49e08e045
49e08e04513454fcf283c73e92c9e00d53b2064d 2026-05-09 F-AUTH-1 Step 3 CP12: Cross-domain sweep — KEYSTONE CLOSURE

$ git merge-base --is-ancestor 49e08e045 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P 49e08e045
acc172f78f913eeee28fa7c26ca8ebb590e547a3
```

**CP12's commit: `49e08e04513454fcf283c73e92c9e00d53b2064d`, 2026-05-09,
confirmed an ancestor of `origin/main`.** Its parent is CP11's commit
directly (confirmed at `F-AUTH-1_Limb1_CP11_Confirmation_2026-09-02.md`).

## §2.2 Source 1 — the code commit's message body, and why it does not
decompose like CP4–CP9's

```
$ git log -1 --format=%b 49e08e045
```

Full body read (54 lines). The opening summary states, in relevant part:

> "20 source files modified / 21 in-scope (worldStudio.js zero-edit
> ratified per Q9); ~155 net edit-touched handlers... ~115 Tier 1
> (requireAuth) + 3 Tier 2 (assets ×2 preserved authorize + evaluation
> L136 NEW §5.51 escalation) + 9 Tier 2-equivalent (metadata 5 +
> thumbnails 4 surface-correction) + 2 Tier 3 (press.js polymorphic
> factory PRESERVE) + ~28 Tier 4 PUBLIC bare GETs... + 28 AI POST
> aiRateLimiter overlay."

**This is qualitatively different from CP4's, CP5's, CP7's, and CP9's
records.** Those CPs each newly promoted *every* handler in each of their
named files — reading a named file in full and counting was itself a
valid confirmation, because the file's entire route table was the CP's
disposition. **CP12 is not that shape.** Its 20 files carry both
edit-touched handlers *and* handlers already correctly Tier'd from earlier
CPs or untouched by this sweep: the file set totals 212 route
declarations by direct count, against the record's own "~155 net
edit-touched" figure — a ~57-handler gap the record does not resolve to
specific lines. Reading a CP12 file in full and counting its routes
therefore does **not** confirm the CP12-specific class totals; it
conflates them with everything the file already carried.

**Three of the six named classes are, however, itemized down to specific
files and, in most cases, specific counts:** `assets ×2 preserved
authorize`, `evaluation L136 NEW escalation`, `metadata 5` +
`thumbnails 4` (Tier 2-equivalent), `press.js polymorphic factory` (Tier
3, 2 instances), and — from a later section — `PE #7 closure:
phoneAIRoutes ×2 + episodeScriptWriterRoutes ×1` (3 of the 28 AI-POST
handlers). **The remaining three classes — Tier 1 (~115), Tier 4 PUBLIC
(~28), and 25 of the 28 AI-POST handlers — are stated only as cluster-wide
totals, with no per-file or per-line breakdown anywhere in the body.**

## §2.3 Identifying the file set

```
$ git diff --stat acc172f78..49e08e045 -- src/routes
 src/routes/assets.js                    | 35 +++++++--------
 src/routes/calendarRoutes.js            | 33 ++++++++-------
 src/routes/consciousness.js             | 23 ++++------
 src/routes/decisionLogs.js              |  8 ++--
 src/routes/editMaps.js                  | 16 ++++---
 src/routes/episodeScriptWriterRoutes.js |  3 +-
 src/routes/evaluation.js                | 21 +++------
 src/routes/imageProcessing.js           | 10 ++---
 src/routes/metadata.js                  | 13 +++---
 src/routes/novelIntelligenceRoutes.js   | 25 +++------
 src/routes/pageContent.js               |  8 ++--
 src/routes/phoneAIRoutes.js             |  5 ++-
 src/routes/press.js                     | 11 ++---
 src/routes/relationships.js             | 36 +++++++---------
 src/routes/stories.js                   | 39 ++++++++---------
 src/routes/storyHealth.js               | 24 ++++-------
 src/routes/therapy.js                   | 25 +++------
 src/routes/thumbnails.js                | 17 ++++----
 src/routes/tierFeatures.js              | 75 +++++++++++++++------------
 src/routes/youtube.js                   | 16 +++----
 20 files changed, 211 insertions(+), 232 deletions(-)
```

**Twenty files, matching the commit body's "20 source files modified"
exactly.** Direct route-declaration count across all twenty: **212** —
against the record's own "~155 net edit-touched handlers," confirming
§2.2's point that not every route in these files is part of CP12's
disposition.

## §2.4 The population: 9 recorded dispositions

| # | scope | class | recorded count | itemized? |
|---|---|---|---|---|
| 1 | 20-file cross-domain sweep | Tier 1 (`requireAuth`) | ~115 | **no** — cluster-wide total only |
| 2 | `assets.js` | Tier 2, preserved `authorize(['ADMIN'])` | 2 | yes — file + count |
| 3 | `evaluation.js` | Tier 2, NEW escalation | 1 | yes — file + line (`L136`) |
| 4 | `metadata.js` | Tier 2-equivalent (`requirePermission`) | 5 | yes — file + count |
| 5 | `thumbnails.js` | Tier 2-equivalent (`requirePermission`) | 4 | yes — file + count |
| 6 | `press.js` | Tier 3, polymorphic factory PRESERVE | 2 | yes — file + count |
| 7 | 20-file cross-domain sweep | Tier 4 PUBLIC (bare GETs) | ~28 | **no** — cluster-wide total only |
| 8 | `phoneAIRoutes.js` + `episodeScriptWriterRoutes.js` | AI POST `aiRateLimiter` ADD (PE #7 closure) | 3 | yes — 2 files + counts |
| 9 | 20-file cross-domain sweep, remainder | AI POST `aiRateLimiter` overlay, unattributed | ~25 | **no** — `28 total − 3 (row 8) = 25`, no scope named |

**This reaches 9, independently, from the commit body alone — closer to
the "twelve" a finer reading would give per Measurement v2's own §1 note
than to that document's filed "seven."** The difference from the "finer"
figure it names (12) is that this pass does not further split the three
unitemized rows (1, 7, 9) into sub-items the way a fully itemized record
would permit — because CP12's record does not name sub-scopes for them,
splitting further here would be inventing itemization the source does not
contain.

---

# §3. CP12's basis commit, on the face

**`49e08e04513454fcf283c73e92c9e00d53b2064d`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
49e08e045:<path>`, and one diff against parent `acc172f78` (CP11's
commit) to confirm the two new `aiRateLimiter` additions, per Ruling 3.

---

# §4. Confirmation table — 6 agree, 3 cannot-tell

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | Tier 1, cluster-wide | 20 files | ~115 | No file or line named for this class; the 20-file set carries 212 total routes, of which the record's own "~155 net edit-touched" figure does not map to specific lines. Confirming would require independently classifying which of 212 routes are CP12's edits versus pre-existing — a re-derivation | **cannot-tell** |
| 2 | `assets.js` · Tier 2 preserved | `src/routes/assets.js:934,966` | 2 | `PUT /:id/approve`, `PUT /:id/reject`, both `requireAuth, authorize(['ADMIN'])` | **agree** |
| 3 | `evaluation.js` · Tier 2 NEW escalation | `src/routes/evaluation.js:129` | 1, at claimed L136 | `POST /admin/reset-character-stats` carries `requireAuth, authorize(['ADMIN'])` at **L129**, not L136 as stated — the only `authorize(` call in the file, so the claim's *count* and *file* are correct; only the cited line number is off by 7 | **agree** (line-number note, not a disagreement about the disposition — see §5) |
| 4 | `metadata.js` · Tier 2-equivalent | `src/routes/metadata.js:38,46,54,62,70` | 5 | `POST /`, `PUT /:id`, `POST /:id/add-tags`, `POST /:id/set-scenes`, `DELETE /:id` all carry `requireAuth, requirePermission('metadata', <verb>)` | **agree** |
| 5 | `thumbnails.js` · Tier 2-equivalent | `src/routes/thumbnails.js:33,41,49,57` | 4 | `POST /`, `PUT /:id`, `POST /:id/rate-quality`, `DELETE /:id` all carry `requireAuth, requirePermission('thumbnails', <verb>)` | **agree** |
| 6 | `press.js` · Tier 3 factory PRESERVE | `src/routes/press.js:456,502` | 2 | `GET /characters`, `GET /characters/:slug`, both `optionalAuth({ degradeOnInfraFailure: true })` | **agree** |
| 7 | Tier 4 PUBLIC, cluster-wide | 20 files | ~28 | No file or line named; same re-derivation problem as row 1 | **cannot-tell** |
| 8 | AI POST ADD (PE #7 closure) | `src/routes/phoneAIRoutes.js:76,186`; `src/routes/episodeScriptWriterRoutes.js:18` | 3 | All three carry `requireAuth, aiRateLimiter`; diff vs parent `acc172f78` shows all three `aiRateLimiter` references as pure additions (no prior occurrence) | **agree** |
| 9 | AI POST overlay, remainder | 20 files | ~25 | No file or line named for this portion; same re-derivation problem as rows 1 and 7 | **cannot-tell** |

**6/9 agree. 0 disagree. 3/9 cannot-tell. Cannot-tell rate: 3/9.**

---

# §5. The line-number note at row 3

`evaluation.js`'s single `authorize(` call is at line 129 in the file as
it stands at `49e08e045`; the commit body cites `L136`. This pass treats
it as a diff-basis or mid-edit line reference (the same shape seen at
CP2's `episodes.js`, CP3's `worldEvents.js`, and CP7's
`franchiseBrainRoutes.js` — each also cited a line number that had shifted
by the time of the final commit) rather than a disagreement about the
disposition itself: the file, the count (1), and the middleware
(`authorize(['ADMIN'])`) all match exactly; only the specific line number
is stale.

---

# §6. The three `cannot-tell` rows, and why forcing them to `agree` would
be the failure mode Ruling 3 warns about

`v2.68` §4.1: *"A limb 1 pass reporting no `cannot-tell` results is MORE
suspect than one reporting several... At an unrecoverable CP basis the
pressure is to re-derive in order to resolve it, and that drift produces
cleaner output."*

**CP12 is that unrecoverable basis, named precisely rather than
gestured at.** Rows 1, 7, and 9 together account for `~115 + ~28 + ~25 =
~168` of CP12's disposition — the majority of it — and none of the three
has a file or line named anywhere in the commit body. The only way to turn
these into `agree` rows would be to independently classify, across 212
routes in 20 files, which ones CP12 itself touched — which is not reading
what CP12 ruled, it is re-running the sweep's own classification work from
scratch. **Ruling 3 draws that line explicitly**, and this pass holds it
even on the CP that would most reward crossing it: had this pass instead
reported 9/9 agree by treating "read the file, count the routes, and
assume the totals reconcile" as sufficient, that would be exactly the
"drift that looks like rigor" §4.1 warns about.

**The six `agree` rows are not weaker for it.** Every one names an exact
file and, for five of six, an exact line or line set; each was checked as
a direct string-level read (row 8 additionally against a diff, to confirm
the `aiRateLimiter` additions were genuinely new). The itemized third of
CP12's record is confirmable in full; the unitemized two-thirds is not,
and this pass does not paper over that difference.

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

**Unchanged from `F-AUTH-1_Limb1_CP11_Confirmation_2026-09-02.md`'s own
read (56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §8. What this document does not do — and what limb 1's completion does
not do

- **Discharges limb 1's population, per Ruling 4** — CP1 through CP12 have
  each received one confirmation pass
  (`F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md` through
  `F-AUTH-1_Limb1_CP11_Confirmation_2026-09-02.md`, plus this document).
  **This does not, by itself, close G3, discharge F-AUTH-1, or resolve
  limb 3.** `Prime_Studios_Audit_Handoff_v25.md` §3 records limb 3 as
  **open, ASSESSMENT NOT COMPLETED**; Dimension 3 as **NOT PERFORMED**;
  G4 as **never entered, not enterable**. None of that changes here. Limb
  1's own scope was always narrower than G3 — Ruling 3 says so on its
  face ("Does not perform limb 1... or adjudicate any Tier disposition"
  applies to every one of these twelve documents equally).
- **Does not resolve the three `cannot-tell` rows.** Rows 1, 7, and 9
  remain genuinely unconfirmed by this pass's own account; closing them
  would require either a more granular record than CP12 filed, or a
  re-derivation this pass declines to perform.
- **Does not re-derive or challenge any of CP12's checkable Tier
  dispositions.** Rows 2–6 and 8 ask whether CP12's own code matches
  CP12's own recorded claim; none is second-guessed.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP12 row (7) as authority for this
  pass's population (9) — §2.4 built the population independently,
  landing between that document's filed figure and the "finer reading"
  (12) its own §1 names as the alternative.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1 or F-AUTH-1's remaining work**, and does not
  revisit Ruling 5's withdrawal of the `~700` figure.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including CP12's own closure
  document, `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or any
  of the eleven prior confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All
reads local git at `f92a4edad`, against CP12's basis commit `49e08e045`
and its parent `acc172f78`. No host, AWS, database, or Cognito contact.
No endpoint exercised. Prod FROZEN.*
