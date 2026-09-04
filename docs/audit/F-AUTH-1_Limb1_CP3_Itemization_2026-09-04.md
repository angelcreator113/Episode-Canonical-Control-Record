| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP3 ITEMIZATION** *Itemizes CP3's row 7 aggregate cannot-tell to real addresses. Does not confirm, re-derive, or rule. Does not reopen limb 1.* |
| --- |

# F-AUTH-1 Limb 1 — CP3 Itemization

**Document type: evidence, MEASURED.** Itemizes CP3's row 7 — one of the
five aggregate `cannot-tell` dispositions limb 1's confirmation sweep left
unaddressed. Authorized by Evoni 2026-09-03; carried forward as owed by
`F-AUTH-1_Fix_Plan_v2.69.md` §6 Ruling 1 and §7 item 1, filed
`docs(audit): itemize CP3 aggregate cannot-tell`.

**Standing before this document starts: limb 1 is DISCHARGED**
(`F-AUTH-1_Fix_Plan_v2.69.md` §6 Ruling 1, 2026-09-03). That ruling accepted
the five aggregate `cannot-tell`s as unconfirmed under confirm-not-re-derive
and named an itemized audit, under a different instrument, as owed. **This
document is that audit, for a second of the five** —
`F-AUTH-1_Limb1_CP2_Itemization_2026-09-03.md` (PR #1219) is the precedent
for shape. It does not perform limb 1 work, does not alter limb 1's
DISCHARGED standing, and does not treat itemization as a precondition for
that discharge.

**Basis:** `origin/main` at `0de670384cef9c441a224b1512e60aa3406f5422`,
2026-09-04.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Itemizes only.** Does not confirm any disposition, does not re-derive or
re-judge any Tier assignment, does not reconcile its own count against the
recorded aggregate beyond stating the delta, does not mint, close, or reopen
anything. Does not recompute or restate CP2's 23-handler delta.

---

# §1. What is itemized, quoted exactly as recorded

`F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md` §4, row 7:

```
$ sed -n '204p' docs/audit/F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md
```

> | 7 | `world.js` + `worldEvents.js` · Tier 1 remainder (~65, unitemized) |
> **none named** | Tier 1 promoted, aggregate only | Neither source names
> a file:line for this portion of the 101-handler Tier 1 total (101 − 34
> `worldStudio.js` − 2 `worldTemperatureRoutes.js` = 65). Auditing both
> files' full route lists to locate them would be re-deriving the sweep |
> **cannot-tell** |

`F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §4.2, read at this
basis:

```
$ grep -n -A12 "§4.2" docs/audit/F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md | head -15
```

That document restates CP3's row 7 as one of the five `cannot-tell`
dispositions, cites the same "~65... unitemized" language and the same
subtraction, and makes no independent addressing or recommendation.

**The recorded aggregate this itemization checks against: ~65 handlers,
across `world.js` and `worldEvents.js`, derived by subtraction from a
101-handler Tier 1 total.**

---

# §2. How the ~65 was derived, and which source determines the set here

CP3 §2.2 (commit message body, 48 lines, full read) states the cluster
total directly:

> "World cluster sweep: 4 files / 120 handlers across mixed disposition:
> Tier 1 (requireAuth) [101 incl. 2 partial AI POST promotions], Tier 3
> [...] Tier 4 [...]."

CP3 §2.3 (the closure document, `v2.26`) corroborates `worldStudio.js`'s
34/1/18 split at the same specificity as the commit body, but **neither
source names a file or line for the ~65 remainder.** The confirmation
document's own arithmetic — `101 − 34 (worldStudio.js) − 2
(worldTemperatureRoutes.js) = 65` — is subtraction against the cluster
total, not a read of named addresses. **This is a different shape from
CP2's row 9**, where the aggregate was stated directly as "the other ~19
files' Tier 1 promotions" with no total-minus-named arithmetic — CP3's ~65
is a remainder figure, CP2's ~19-files description was already a
(vaguer) direct characterization of the scope.

**Whether the commit's own diff names the handlers anyway, independent of
what the confirmation document's two sources say in prose, is the same
question CP2's itemization answered — checked fresh here, not assumed:**

```
$ git show 61f8a6587601f482e1100e7a2abe61c8cc38ca64 --stat --format="" -- src/routes/
 src/routes/world.js                  |  16 ++---
 src/routes/worldEvents.js            | 136 ++++++++++++++++-------------------
 src/routes/worldStudio.js            |  95 +++++++++++++-----------
 src/routes/worldTemperatureRoutes.js |   6 +-
 4 files changed, 124 insertions(+), 129 deletions(-)
```

**4 files, matching the commit's own "4 files" claim.** `worldStudio.js`
and `worldTemperatureRoutes.js` are already itemized at CP3 Confirmation §4
rows 1–4. **`world.js` and `worldEvents.js` — row 7's named scope — are
the commit's own diff, not a fresh sweep of `src/`.** As with CP2, the
commit's diff names real addresses the confirmation document's prose-only
reads did not surface. Unlike CP2, this does not fully replace the
subtraction: the ~65 figure is not itself repeated anywhere as a directly
stated total the diff could be checked against — it is only ever recovered
by CP3's own subtraction. **The diff determines the addresses; the
subtraction determines the count being checked against.** Both are used
here, for different purposes, and neither supersedes the other.

---

# §3. CP3's basis commit, re-confirmed

Same commit `F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md` §3 established:

```
$ git merge-base --is-ancestor 61f8a6587601f482e1100e7a2abe61c8cc38ca64 origin/main && echo "IS ANCESTOR"
IS ANCESTOR
$ git log -1 --format='%H %ad %P' --date=short 61f8a6587601f482e1100e7a2abe61c8cc38ca64
61f8a6587601f482e1100e7a2abe61c8cc38ca64 2026-05-07 d73599f8e78c8e2d509e3e4a902b999f598774ca
```

**CP3's basis commit: `61f8a6587601f482e1100e7a2abe61c8cc38ca64`, parent
`d73599f8e78c8e2d509e3e4a902b999f598774ca`** (CP2's own commit). All reads
below are `git show 61f8a6587:<path>` at this SHA, or `git diff
d73599f8e..61f8a6587 -- <path>` for what changed.

---

# §4. Itemization — 61 promoted handlers, 2 files

For each file: every `router.<method>(` declaration whose middleware
changed in this commit (`git diff d73599f8e..61f8a6587 -- <path>`), read at
`61f8a6587`. All promotions in both files are `optionalAuth` → `requireAuth`
(the shared `middleware/auth` `optionalAuth`, imported directly — no
locally-defined fallback pattern in either file, unlike several of CP2's).

## world.js — 4, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 34 | GET | `/world/:showId/history` |
| 2 | 66 | GET | `/world/:showId/decisions` |
| 3 | 101 | GET | `/world/:showId/stats` |
| 4 | 162 | POST | `/world/:showId/browse-pool` |

## worldEvents.js — 57, prior `optionalAuth`

**Excludes** the 2 handlers already named and confirmed at CP3 Confirmation
§4 row 6 (`generate-episode` L1687, `regenerate-episode` L1889) and the 2
preserved, untouched handlers at row 5 (`generate-script` L748,
`generate-episode-from-many` L1779) — neither is part of row 7's
unitemized scope.

| # | line | method | path |
|---|---|---|---|
| 1 | 35 | GET | `/world/:showId/events` |
| 2 | 121 | POST | `/world/:showId/events` |
| 3 | 284 | PUT | `/world/:showId/events/:eventId` |
| 4 | 556 | DELETE | `/world/:showId/events/:eventId` |
| 5 | 588 | POST | `/world/:showId/events/:eventId/inject` |
| 6 | 828 | POST | `/world/:showId/events/bulk-seed` |
| 7 | 898 | POST | `/world/:showId/events/ai-fix` |
| 8 | 1041 | POST | `/world/:showId/events/:eventId/generate-invitation` |
| 9 | 1076 | GET | `/world/:showId/events/:eventId/invitation-text` |
| 10 | 1093 | POST | `/world/:showId/events/:eventId/re-render-invitation` |
| 11 | 1164 | GET | `/world/:showId/events/:eventId/invitation` |
| 12 | 1196 | POST | `/world/:showId/events/:eventId/approve-invitation` |
| 13 | 1271 | POST | `/world/:showId/events/:eventId/reject-invitation` |
| 14 | 1301 | GET | `/world/:showId/events/:eventId/invitation-history` |
| 15 | 1330 | POST | `/world/:showId/events/batch-generate-invitations` |
| 16 | 1391 | GET | `/world/:showId/events/:eventId/invitation-pdf` |
| 17 | 1411 | POST | `/world/:showId/events/:eventId/animate-invitation` |
| 18 | 1477 | GET | `/world/:showId/events/:eventId/animate-invitation/:jobId` |
| 19 | 1510 | POST | `/world/:showId/events/:eventId/edit-invitation-text` |
| 20 | 1605 | POST | `/world/:showId/events/:eventId/unlink-invitation` |
| 21 | 1627 | DELETE | `/world/:showId/events/:eventId/invitation/:assetId` |
| 22 | 1946 | POST | `/world/:showId/events/bulk-delete` |
| 23 | 1988 | POST | `/world/:showId/events/from-profile` |
| 24 | 2219 | GET | `/world/:showId/events/:eventId/affordability` |
| 25 | 2252 | POST | `/world/:showId/events/:eventId/decline` |
| 26 | 2278 | GET | `/world/:showId/financial-pressure` |
| 27 | 2352 | GET | `/world/:showId/events/:eventId/financial-forecast` |
| 28 | 2560 | POST | `/world/:showId/events/:eventId/generate-venue` |
| 29 | 2626 | POST | `/world/:showId/events/:eventId/generate-social-checklist` |
| 30 | 2675 | GET | `/world/:showId/events/:eventId/outfit` |
| 31 | 2697 | PUT | `/world/:showId/events/:eventId/outfit` |
| 32 | 2776 | GET | `/world/:showId/events/:eventId/wardrobe-options` |
| 33 | 2836 | GET | `/world/:showId/events/:eventId/feed-activity` |
| 34 | 2878 | POST | `/world/:showId/events/:eventId/generate-overlay/:overlayType` |
| 35 | 3041 | POST | `/world/:showId/events/:eventId/approve-overlay` |
| 36 | 3132 | POST | `/world/:showId/events/:eventId/reject-overlay` |
| 37 | 3157 | POST | `/world/:showId/events/:eventId/re-render-overlay` |
| 38 | 3236 | GET | `/world/:showId/events/:eventId/overlay-tasks/:overlayType` |
| 39 | 3278 | GET | `/world/:showId/events/:eventId/overlay-history/:overlayType` |
| 40 | 3316 | POST | `/world/:showId/episodes/:episodeId/generate-title-overlay` |
| 41 | 3411 | GET | `/world/:showId/events/:eventId/overlay-suggestions` |
| 42 | 3459 | PUT | `/world/:showId/events/:eventId/overlay-selections` |
| 43 | 3481 | POST | `/world/:showId/episodes/:episodeId/generate-story` |
| 44 | 3502 | GET | `/world/:showId/stories` |
| 45 | 3520 | GET | `/world/:showId/stories/:storyId` |
| 46 | 3538 | PUT | `/world/:showId/stories/:storyId` |
| 47 | 3564 | POST | `/world/:showId/episodes/:episodeId/generate-distribution` |
| 48 | 3585 | GET | `/world/:showId/episodes/:episodeId/distribution` |
| 49 | 3605 | PUT | `/world/:showId/episodes/:episodeId/distribution` |
| 50 | 3623 | PUT | `/world/:showId/distribution-defaults` |
| 51 | 3638 | GET | `/world/:showId/distribution-defaults` |
| 52 | 3662 | POST | `/world/:showId/episodes/:episodeId/complete` |
| 53 | 3688 | POST | `/world/:showId/episodes/:episodeId/finalize-financials` |
| 54 | 3710 | GET | `/world/:showId/financial-ledger` |
| 55 | 3730 | GET | `/world/:showId/balance` |
| 56 | 3756 | POST | `/world/:showId/events/:eventId/generate-lists` |
| 57 | 3825 | GET | `/world/:showId/events/next-suggestions` |

**Total: 61 addressed handlers across 2 files** (4 + 57).

---

# §5. Itemized count against the recorded aggregate — a MEASURED delta, not reconciled

```
Recorded (CP3 Confirmation §4 row 7, arithmetic):  ~65 handlers, 2 files
Itemized here:                                      61 handlers, 2 files
  4 (world.js) + 57 (worldEvents.js, row 5/6 excluded)
Delta:                                                4 handlers short of ~65
```

**This delta is recorded, not explained.** Per this task's own
authorization: a MEASURED disagreement between an itemized count and a
recorded aggregate disposition is the same species as the two CP6 counting
errors already ruled on and CP2's own 23-handler delta, and whether it
warrants anything is Evoni's, not this document's. No attempt is made here
to locate the missing 4, guess which lines might account for them, or
adjust either figure toward the other. **CP2's delta is not recomputed or
restated here** — it belongs to its own document.

**One structural observation, not an explanation of the delta:** the
recorded `101 − 34 − 2 = 65` arithmetic does not itself subtract row 6's 2
already-named `worldEvents.js` promotions, even though those are
separately confirmed with their own addresses and are not part of row 7's
"none named" scope by that same confirmation table's own account. **Whether
the recorded ~65 was meant to include or exclude row 6's 2 is not resolved
here** — this document itemizes against the figure exactly as recorded,
and notes the ambiguity rather than picking a reading.

---

# §6. Method notes — CP3's shape against CP2's

**The diff-based recovery generalized, but only for the addresses — not
for the count to check them against.** CP2's row 9 aggregate (~144) was
itself only ever stated as a derived figure (`227 − 83 = 144`) in that
confirmation document's own §5, not as a directly-named total; the same is
true here (`101 − 34 − 2 = 65`). In both cases, the commit's own diff
(`git show <basis> --stat`, then per-file `git diff <parent>..<basis>`)
named real file/line addresses that neither confirmation document's prose
sources surfaced, because both confirmation passes checked only the commit
*message* and the closure document's *version block* — never the commit's
own diff — for file names.

**What did not generalize: CP3 has no "preserved-but-invisible-to-diff"
handlers requiring a second search method.** CP2 needed a distinct
`aiRateLimiter`-grep pass to find 3 preserved AI-POST handlers the diff
structurally could not show (unchanged lines produce no diff). CP3's
row 5 (2 preserved AI-POSTs) and row 6 (2 promoted AI-POSTs) were already
fully named and confirmed by CP3's own confirmation document at §4 —
nothing preserved-but-unnamed remained for this document to locate by a
second method. **CP3's itemization required only the one technique
(commit diff, filtered by file).**

**For CP12:** if CP12's aggregate is also a subtraction from a stated
cluster total rather than a directly-named scope, the same two-step check
applies — read the commit's own diff for the addresses, and treat the
confirmation document's arithmetic (not a directly-stated figure) as the
count to itemize against, expecting the same kind of unreconciled delta
this document and CP2's both produced. **A delta on a subtraction-derived
aggregate may carry different weight than one on a directly-stated
aggregate** — precisely because the recorded figure itself already carries
one layer of derivation before any itemization touches it. This document
takes no position on whether that matters; it is left for whoever reads
both deltas together.

---

# §7. What this document does not do

- **Does not confirm any disposition.** This is not a limb 1 confirmation
  pass; it does not apply `agree`/`disagree`/`cannot-tell` to anything.
- **Does not judge whether any address's Tier assignment is correct.**
  Every handler in §4 is listed by address only — file, line, method,
  path, and prior middleware as read. No claim is made or implied about
  whether `requireAuth` is the *correct* Tier for any of them.
- **Does not reconcile the §5 delta.** Recorded and left for Evoni.
- **Does not recompute or restate CP2's 23-handler delta**
  (`F-AUTH-1_Limb1_CP2_Itemization_2026-09-03.md` §6). That document's
  figure stands on its own.
- **Does not reopen limb 1, alter its DISCHARGED standing, or treat this
  itemization as a precondition for that discharge.** `v2.69` Ruling 1
  already ruled the five accepted as unconfirmed under confirm-not-re-derive;
  this document is a second instance of the separate instrument that ruling
  named as owed.
- **Does not mint FD-70 or any other number.** Does not assert that
  anything found here warrants a finding.
- **Does not edit `F-AUTH-1_Limb1_CP3_Confirmation_2026-09-02.md`,
  `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md`, or any other
  filed document.**
- **Does not touch `src/`, `tests/`, or `frontend/`.** Read-only.
- **Does not perform CP12's itemization.** A separate document, no
  ordering dependency.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Type: evidence, MEASURED. Itemizes CP3's row 7 to 61 addresses (4 in
`world.js`, 57 in `worldEvents.js`) against a recorded ~65. Records the
delta; does not reconcile it. Does not confirm, re-derive, or rule. Does
not reopen limb 1, which remains DISCHARGED. No host, AWS, database, or
Cognito contact. Prod FROZEN.*
