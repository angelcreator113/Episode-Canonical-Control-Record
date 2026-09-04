| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP12 ITEMIZATION** *Itemizes CP12's three aggregate cannot-tell rows to real addresses. Does not confirm, re-derive, or rule. Does not reopen limb 1.* |
| --- |

# F-AUTH-1 Limb 1 — CP12 Itemization

**Document type: evidence, MEASURED.** Itemizes CP12's rows 1, 7, and 9 —
the third and last of the five aggregate `cannot-tell` dispositions limb
1's confirmation sweep left unaddressed. Authorized by Evoni 2026-09-03;
carried forward as owed by `F-AUTH-1_Fix_Plan_v2.69.md` §6 Ruling 1 and §7
item 1, filed `docs(audit): itemize CP12 aggregate cannot-tells`.

**Standing before this document starts: limb 1 is DISCHARGED**
(`F-AUTH-1_Fix_Plan_v2.69.md` §6 Ruling 1, 2026-09-03). That ruling accepted
the five aggregate `cannot-tell`s as unconfirmed under confirm-not-re-derive
and named an itemized audit, under a different instrument, as owed. **This
document is that audit, for the third and last of the five** —
`F-AUTH-1_Limb1_CP2_Itemization_2026-09-03.md` (PR #1219) and
`F-AUTH-1_Limb1_CP3_Itemization_2026-09-04.md` (PR #1227) are the
precedents for shape. It does not perform limb 1 work, does not alter
limb 1's DISCHARGED standing, and does not treat itemization as a
precondition for that discharge. **This is one document, not three** —
CP12's three rows classify one shared 212-route cluster three ways;
splitting by row would mean reading the same cluster three times to
produce tables that would still have to agree with each other.

**Basis:** `origin/main` at `2f61c98740049f4a54cbcc0311ba9725c17446ef`,
2026-09-04.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Itemizes only.** Does not confirm any disposition, does not re-derive or
re-judge any Tier assignment, does not reconcile its own counts against
the recorded aggregates beyond stating each delta, does not mint, close,
or reopen anything. Does not recompute, restate, or compare CP2's or CP3's
deltas as findings.

---

# §1. What is itemized, quoted exactly as recorded

`F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md` §4, rows 1, 7, and 9:

```
$ sed -n '193p;199p;201p' docs/audit/F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md
```

> | 1 | Tier 1, cluster-wide | 20 files | ~115 | No file or line named for
> this class; the 20-file set carries 212 total routes, of which the
> record's own "~155 net edit-touched" figure does not map to specific
> lines. Confirming would require independently classifying which of 212
> routes are CP12's edits versus pre-existing — a re-derivation |
> **cannot-tell** |
>
> | 7 | Tier 4 PUBLIC, cluster-wide | 20 files | ~28 | No file or line
> named; same re-derivation problem as row 1 | **cannot-tell** |
>
> | 9 | AI POST overlay, remainder | 20 files | ~25 | No file or line
> named for this portion; same re-derivation problem as rows 1 and 7 |
> **cannot-tell** |

Same document, §2.2, the commit body's own summary these three sit inside:

> "20 source files modified / 21 in-scope (worldStudio.js zero-edit
> ratified per Q9); ~155 net edit-touched handlers... ~115 Tier 1
> (requireAuth) + 3 Tier 2 (assets ×2 preserved authorize + evaluation
> L136 NEW §5.51 escalation) + 9 Tier 2-equivalent (metadata 5 +
> thumbnails 4 surface-correction) + 2 Tier 3 (press.js polymorphic
> factory PRESERVE) + ~28 Tier 4 PUBLIC bare GETs... + 28 AI POST
> aiRateLimiter overlay."

**Noted, not resolved:** the itemized classes in this summary
(115+3+9+2+28+28 = 185) do not sum to the summary's own stated
"~155 net edit-touched" total. Both figures are the commit body's own
words. This document does not reconcile that internal gap; it is recorded
here because it bears on §7's deltas.

`F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §4.3–§4.5, read at
this basis, restate the same three rows and the same figures, making no
independent addressing or recommendation.

**The three recorded aggregates this itemization checks against: ~115
(Tier 1), ~28 (Tier 4 PUBLIC), ~25 (AI POST overlay remainder) — all
cluster-wide over the same 20 files.**

---

# §2. CP12's basis commit, re-confirmed

Same commit `F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md` §3
established:

```
$ git merge-base --is-ancestor 49e08e04513454fcf283c73e92c9e00d53b2064d origin/main && echo "IS ANCESTOR"
IS ANCESTOR
$ git log -1 --format='%H %ad %P' --date=short 49e08e04513454fcf283c73e92c9e00d53b2064d
49e08e04513454fcf283c73e92c9e00d53b2064d 2026-05-09 acc172f78f913eeee28fa7c26ca8ebb590e547a3
```

**CP12's basis commit: `49e08e04513454fcf283c73e92c9e00d53b2064d`, parent
`acc172f78f913eeee28fa7c26ca8ebb590e547a3`** (CP11's own commit). All
reads below are `git show 49e08e045:<path>` at this SHA.

---

# §3. The 20-file cluster and its 212 routes, established from CP12's own record

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

**20 files, matching the commit's own "20 source files modified" exactly**
— the same command CP12's own confirmation document ran at §2.3, re-run
fresh here.

```
$ for f in assets.js calendarRoutes.js consciousness.js decisionLogs.js editMaps.js episodeScriptWriterRoutes.js evaluation.js imageProcessing.js metadata.js novelIntelligenceRoutes.js pageContent.js phoneAIRoutes.js press.js relationships.js stories.js storyHealth.js therapy.js thumbnails.js tierFeatures.js youtube.js; do
    n=$(git show 49e08e045:src/routes/$f | grep -cE "^router\.(get|post|put|patch|delete)\(")
    echo "$f: $n"
  done
[... 20 lines ...]
TOTAL: 212
```

**212 route declarations, matching the record's own "direct route-
declaration count" of 212 exactly.**

**Whether the diff determines the itemization, the way it did for CP2's
and CP3's aggregates, is answered directly: it determines the file set,
not the class assignment.** A sample check —
`git diff acc172f78..49e08e045 -- src/routes/decisionLogs.js` — shows all
three of that file's routes as clean `optionalAuth` → `requireAuth`
promotions, fully diff-visible, the same shape CP2's and CP3's diffs
showed throughout. But CP12's own confirmation document (§2.2) already
established why this does not generalize across the cluster: these 20
files carry both CP12's own edits and handlers "already correctly Tier'd
from earlier CPs or untouched by this sweep" — the file set totals 212
routes against the record's own "~155 net edit-touched" figure, a gap
neither source resolves to specific lines. **A diff-restricted read would
show only lines this specific commit changed; it would not show a route
whose `requireAuth` was already present before CP12 touched the file at
all — and such routes are still part of the cluster's current state.**
Per the task's own instruction, this document classifies **by the
middleware present at each line as read at CP12's basis — a census of
current state, not a diff of this commit's own edits.** §8 returns to
what this choice means for the deltas in §7.

---

# §4. The census, and the 17 handlers already itemized elsewhere

Reading all 212 routes at `49e08e045` and classifying each by its own
middleware — `aiRateLimiter` present → AI POST; `authorize(` or
`requirePermission(` present → an already-named Tier 2/2-equivalent/Tier 3
class; `requireAuth` alone → Tier 1; nothing (bare, `optionalAuth`, or
`validateUUIDParam`-only) → Tier 4 PUBLIC — **17 of the 212 fall into
classes CP12's own confirmation table already itemized by name** (rows 2,
3, 4, 5, 6, and 8). These are excluded from the three tables in §5, since
they are not part of rows 1, 7, or 9's unitemized scope:

| CP12 row | file(s) | addresses | count |
|---|---|---|---|
| 2 | `assets.js` | `PUT /:id/approve` (934), `PUT /:id/reject` (966) | 2 |
| 3 | `evaluation.js` | `POST /admin/reset-character-stats` (129) | 1 |
| 4 | `metadata.js` | `POST /` (38), `PUT /:id` (46), `POST /:id/add-tags` (54), `POST /:id/set-scenes` (62), `DELETE /:id` (70) | 5 |
| 5 | `thumbnails.js` | `POST /` (33), `PUT /:id` (41), `POST /:id/rate-quality` (49), `DELETE /:id` (57) | 4 |
| 6 | `press.js` | `GET /characters` (456), `GET /characters/:slug` (502) | 2 |
| 8 | `phoneAIRoutes.js`, `episodeScriptWriterRoutes.js` | `POST /add-zones` (76), `POST /fill-content-zone` (186), `POST /:episodeId/generate` (18) | 3 |

**Total excluded: 17**, matching CP12's own row 2+3+4+5+6+8 counts
(2+1+5+4+2+3) exactly.

---

# §5. Itemization — three tables, 195 addressed handlers

## Row 1 — Tier 1 (`requireAuth`) — 142

| # | file | line | method | path |
|---|---|---|---|---|
| 1 | `decisionLogs.js` | 7 | POST | `/` |
| 2 | `decisionLogs.js` | 44 | GET | `/episode/:episodeId` |
| 3 | `decisionLogs.js` | 72 | GET | `/scene/:sceneId` |
| 4 | `pageContent.js` | 29 | PUT | `/:pageName/:constantKey` |
| 5 | `pageContent.js` | 51 | DELETE | `/:pageName/:constantKey` |
| 6 | `imageProcessing.js` | 26 | POST | `/:id/remove-background` |
| 7 | `imageProcessing.js` | 198 | POST | `/:id/enhance` |
| 8 | `imageProcessing.js` | 367 | GET | `/:id/processing-status` |
| 9 | `imageProcessing.js` | 414 | POST | `/:id/reset-processing` |
| 10 | `editMaps.js` | 14 | POST | `/:id/analyze` |
| 11 | `editMaps.js` | 68 | GET | `/:id/edit-map` |
| 12 | `editMaps.js` | 94 | PUT | `/:id` |
| 13 | `editMaps.js` | 118 | GET | `/shows/:showId/characters` |
| 14 | `editMaps.js` | 138 | POST | `/shows/:showId/characters` |
| 15 | `editMaps.js` | 166 | PATCH | `/:id` |
| 16 | `consciousness.js` | 323 | POST | `/save` |
| 17 | `consciousness.js` | 356 | GET | `/:characterId` |
| 18 | `consciousness.js` | 479 | POST | `/interview` |
| 19 | `evaluation.js` | 205 | GET | `/characters/:key/state` |
| 20 | `evaluation.js` | 258 | POST | `/episodes/:id/evaluate` |
| 21 | `evaluation.js` | 423 | POST | `/episodes/:id/override` |
| 22 | `evaluation.js` | 540 | POST | `/episodes/:id/accept` |
| 23 | `evaluation.js` | 580 | POST | `/characters/:key/state/update` |
| 24 | `press.js` | 362 | POST | `/seed-characters` |
| 25 | `press.js` | 532 | POST | `/advance-career` |
| 26 | `novelIntelligenceRoutes.js` | 154 | GET | `/voice-rules/proposed` |
| 27 | `novelIntelligenceRoutes.js` | 171 | POST | `/voice-rules/:id/confirm` |
| 28 | `novelIntelligenceRoutes.js` | 183 | POST | `/voice-rules/:id/dismiss` |
| 29 | `novelIntelligenceRoutes.js` | 195 | GET | `/voice-rules/active` |
| 30 | `novelIntelligenceRoutes.js` | 351 | GET | `/manuscript/metadata/:book_id` |
| 31 | `novelIntelligenceRoutes.js` | 364 | PATCH | `/manuscript/metadata/:id/override` |
| 32 | `novelIntelligenceRoutes.js` | 381 | POST | `/brain/check-duplicate` |
| 33 | `novelIntelligenceRoutes.js` | 433 | POST | `/brain/register-fingerprint` |
| 34 | `novelIntelligenceRoutes.js` | 455 | POST | `/brain/supersede-version` |
| 35 | `episodeScriptWriterRoutes.js` | 51 | GET | `/:episodeId` |
| 36 | `episodeScriptWriterRoutes.js` | 70 | GET | `/:episodeId/version/:version` |
| 37 | `episodeScriptWriterRoutes.js` | 89 | GET | `/:episodeId/latest` |
| 38 | `episodeScriptWriterRoutes.js` | 105 | PUT | `/:scriptId` |
| 39 | `episodeScriptWriterRoutes.js` | 136 | POST | `/:scriptId/lock` |
| 40 | `episodeScriptWriterRoutes.js` | 161 | GET | `/:episodeId/context` |
| 41 | `youtube.js` | 11 | POST | `/analyze` |
| 42 | `youtube.js` | 75 | GET | `/metadata` |
| 43 | `youtube.js` | 113 | GET | `/library` |
| 44 | `youtube.js` | 136 | GET | `/:id/scenes` |
| 45 | `youtube.js` | 179 | GET | `/:id` |
| 46 | `youtube.js` | 208 | DELETE | `/:id` |
| 47 | `youtube.js` | 230 | POST | `/:id/detect-scenes` |
| 48 | `storyHealth.js` | 38 | GET | `/dashboard` |
| 49 | `storyHealth.js` | 145 | GET | `/search` |
| 50 | `storyHealth.js` | 236 | GET | `/versions/chapter/:chapterId` |
| 51 | `storyHealth.js` | 269 | POST | `/versions/chapter/:chapterId` |
| 52 | `storyHealth.js` | 311 | GET | `/versions/:versionId/content` |
| 53 | `storyHealth.js` | 333 | GET | `/therapy-suggestions/:characterKey` |
| 54 | `storyHealth.js` | 469 | GET | `/threads-for-story/:storyNumber` |
| 55 | `storyHealth.js` | 502 | GET | `/story-sparks/:characterKey` |
| 56 | `therapy.js` | 550 | POST | `/session-close` |
| 57 | `therapy.js` | 631 | GET | `/profile/:charId` |
| 58 | `therapy.js` | 656 | GET | `/waiting` |
| 59 | `therapy.js` | 672 | POST | `/clear-waiting/:id` |
| 60 | `relationships.js` | 73 | GET | `/` |
| 61 | `relationships.js` | 104 | GET | `/pending` |
| 62 | `relationships.js` | 126 | GET | `/character/:charId` |
| 63 | `relationships.js` | 151 | GET | `/tree/:registryId` |
| 64 | `relationships.js` | 213 | POST | `/` |
| 65 | `relationships.js` | 531 | POST | `/confirm/:relationshipId` |
| 66 | `relationships.js` | 583 | DELETE | `/dismiss/:relationshipId` |
| 67 | `relationships.js` | 614 | PUT | `/:relId` |
| 68 | `relationships.js` | 675 | DELETE | `/:relId` |
| 69 | `relationships.js` | 694 | GET | `/family-tree/:registryId` |
| 70 | `relationships.js` | 754 | PUT | `/:relId/family` |
| 71 | `stories.js` | 51 | POST | `/` |
| 72 | `stories.js` | 100 | POST | `/auto-save` |
| 73 | `stories.js` | 136 | GET | `/character/:charKey` |
| 74 | `stories.js` | 153 | GET | `/:id` |
| 75 | `stories.js` | 168 | PATCH | `/:id` |
| 76 | `stories.js` | 196 | DELETE | `/:id` |
| 77 | `stories.js` | 212 | POST | `/:id/approve` |
| 78 | `stories.js` | 325 | GET | `/social/character/:charKey` |
| 79 | `stories.js` | 342 | PATCH | `/social/:id` |
| 80 | `stories.js` | 365 | DELETE | `/social/:id` |
| 81 | `stories.js` | 456 | POST | `/assemblies` |
| 82 | `stories.js` | 484 | GET | `/assemblies/character/:charKey` |
| 83 | `stories.js` | 501 | GET | `/assemblies/:id` |
| 84 | `stories.js` | 516 | PATCH | `/assemblies/:id` |
| 85 | `stories.js` | 542 | DELETE | `/assemblies/:id` |
| 86 | `stories.js` | 558 | POST | `/assemblies/:id/compile` |
| 87 | `thumbnails.js` | 75 | POST | `/:id/publish` |
| 88 | `thumbnails.js` | 96 | POST | `/:id/unpublish` |
| 89 | `thumbnails.js` | 116 | POST | `/:id/set-primary` |
| 90 | `tierFeatures.js` | 49 | GET | `/deep-memory-context/:registryId` |
| 91 | `tierFeatures.js` | 201 | GET | `/relationship-events/:relationshipId` |
| 92 | `tierFeatures.js` | 213 | POST | `/relationship-events` |
| 93 | `tierFeatures.js` | 231 | PUT | `/relationship-events/:eventId` |
| 94 | `tierFeatures.js` | 242 | DELETE | `/relationship-events/:eventId` |
| 95 | `tierFeatures.js` | 255 | GET | `/character-arc/:charId` |
| 96 | `tierFeatures.js` | 346 | GET | `/world-timeline` |
| 97 | `tierFeatures.js` | 364 | POST | `/world-timeline` |
| 98 | `tierFeatures.js` | 373 | PUT | `/world-timeline/:eventId` |
| 99 | `tierFeatures.js` | 384 | DELETE | `/world-timeline/:eventId` |
| 100 | `tierFeatures.js` | 397 | GET | `/world-locations` |
| 101 | `tierFeatures.js` | 415 | POST | `/world-locations` |
| 102 | `tierFeatures.js` | 427 | PUT | `/world-locations/:locationId` |
| 103 | `tierFeatures.js` | 438 | DELETE | `/world-locations/:locationId` |
| 104 | `tierFeatures.js` | 451 | GET | `/world-snapshots` |
| 105 | `tierFeatures.js` | 468 | POST | `/world-snapshots` |
| 106 | `tierFeatures.js` | 478 | POST | `/world-snapshots/generate` |
| 107 | `tierFeatures.js` | 540 | DELETE | `/world-snapshots/:snapshotId` |
| 108 | `tierFeatures.js` | 613 | GET | `/pipeline` |
| 109 | `tierFeatures.js` | 648 | POST | `/pipeline` |
| 110 | `tierFeatures.js` | 666 | PUT | `/pipeline/:pipelineId` |
| 111 | `tierFeatures.js` | 687 | GET | `/story-revisions/:storyId` |
| 112 | `tierFeatures.js` | 699 | POST | `/story-revisions` |
| 113 | `tierFeatures.js` | 810 | GET | `/story-threads` |
| 114 | `tierFeatures.js` | 827 | POST | `/story-threads` |
| 115 | `tierFeatures.js` | 836 | PUT | `/story-threads/:threadId` |
| 116 | `tierFeatures.js` | 847 | DELETE | `/story-threads/:threadId` |
| 117 | `assets.js` | 543 | POST | `/labels` |
| 118 | `assets.js` | 576 | POST | `/bulk/delete` |
| 119 | `assets.js` | 607 | POST | `/bulk/process-background` |
| 120 | `assets.js` | 638 | POST | `/bulk/add-labels` |
| 121 | `assets.js` | 676 | POST | `/bulk/change-type` |
| 122 | `assets.js` | 716 | POST | `/search` |
| 123 | `assets.js` | 772 | POST | `/` |
| 124 | `assets.js` | 1000 | PUT | `/:id/process` |
| 125 | `assets.js` | 1033 | POST | `/:id/process-background` |
| 126 | `assets.js` | 1056 | PUT | `/:id` |
| 127 | `assets.js` | 1081 | DELETE | `/:id` |
| 128 | `assets.js` | 1103 | POST | `/:id/labels` |
| 129 | `assets.js` | 1135 | DELETE | `/:id/labels/:labelId` |
| 130 | `assets.js` | 1218 | POST | `/process` |
| 131 | `calendarRoutes.js` | 87 | POST | `/markers` |
| 132 | `calendarRoutes.js` | 123 | PUT | `/markers/:id/set-present` |
| 133 | `calendarRoutes.js` | 183 | POST | `/events` |
| 134 | `calendarRoutes.js` | 228 | PUT | `/events/:id` |
| 135 | `calendarRoutes.js` | 242 | DELETE | `/events/:id` |
| 136 | `calendarRoutes.js` | 279 | POST | `/events/:id/attendees` |
| 137 | `calendarRoutes.js` | 306 | PUT | `/events/:id/attendees/:attendeeId` |
| 138 | `calendarRoutes.js` | 406 | PUT | `/ripples/:id/confirm` |
| 139 | `calendarRoutes.js` | 503 | POST | `/events/:id/spawn-world-event` |
| 140 | `calendarRoutes.js` | 599 | GET | `/events/:id/spawned` |
| 141 | `calendarRoutes.js` | 625 | POST | `/events/:id/auto-spawn` |
| 142 | `calendarRoutes.js` | 699 | POST | `/events/generate-seasonal` |

## Row 7 — Tier 4 PUBLIC (bare) — 28

| # | file | line | method | path |
|---|---|---|---|---|
| 1 | `pageContent.js` | 13 | GET | `/:pageName` |
| 2 | `metadata.js` | 23 | GET | `/` |
| 3 | `metadata.js` | 26 | GET | `/ALL` |
| 4 | `metadata.js` | 29 | GET | `/:id` |
| 5 | `metadata.js` | 32 | GET | `/:id/summary` |
| 6 | `metadata.js` | 35 | GET | `/episode/:episodeId` |
| 7 | `thumbnails.js` | 21 | GET | `/` |
| 8 | `thumbnails.js` | 24 | GET | `/:id` |
| 9 | `thumbnails.js` | 27 | GET | `/:id/url` |
| 10 | `thumbnails.js` | 30 | GET | `/:id/download` |
| 11 | `thumbnails.js` | 65 | GET | `/episode/:episodeId` |
| 12 | `thumbnails.js` | 68 | GET | `/episode/:episodeId/primary` |
| 13 | `thumbnails.js` | 136 | GET | `/episode/:episodeId` |
| 14 | `assets.js` | 76 | GET | `/` |
| 15 | `assets.js` | 245 | GET | `/eligible` |
| 16 | `assets.js` | 349 | GET | `/by-folder` |
| 17 | `assets.js` | 459 | GET | `/approved/:type` |
| 18 | `assets.js` | 497 | GET | `/pending` |
| 19 | `assets.js` | 521 | GET | `/labels` |
| 20 | `assets.js` | 739 | GET | `/:id` |
| 21 | `assets.js` | 1160 | GET | `/:id/usage` |
| 22 | `assets.js` | 1184 | GET | `/:id/download/:type` |
| 23 | `assets.js` | 1323 | GET | `/config/check` |
| 24 | `calendarRoutes.js` | 70 | GET | `/markers` |
| 25 | `calendarRoutes.js` | 156 | GET | `/events` |
| 26 | `calendarRoutes.js` | 260 | GET | `/events/:id/attendees` |
| 27 | `calendarRoutes.js` | 425 | GET | `/simultaneous` |
| 28 | `calendarRoutes.js` | 725 | GET | `/events/feed-templates` |

**Note on rows 20/739 and 21/1160 and 22/1184 in `assets.js`:** these three
carry `validateUUIDParam('id')` but no `requireAuth` or `optionalAuth` —
classified Tier 4 PUBLIC on the same basis as the others (no auth
middleware present), `validateUUIDParam` being a parameter-shape check,
not an authentication gate. Recorded as observed; not judged.

## Row 9 — AI POST overlay remainder — 25

| # | file | line | method | path |
|---|---|---|---|---|
| 1 | `consciousness.js` | 255 | POST | `/generate` |
| 2 | `consciousness.js` | 290 | POST | `/generate-lala` |
| 3 | `consciousness.js` | 390 | POST | `/dilemma-triggers` |
| 4 | `consciousness.js` | 507 | POST | `/interview-next` |
| 5 | `press.js` | 608 | POST | `/generate-post` |
| 6 | `press.js` | 697 | POST | `/generate-scene` |
| 7 | `novelIntelligenceRoutes.js` | 49 | POST | `/signal` |
| 8 | `novelIntelligenceRoutes.js` | 223 | POST | `/manuscript/cascade` |
| 9 | `therapy.js` | 253 | POST | `/session-open` |
| 10 | `therapy.js` | 330 | POST | `/session-respond` |
| 11 | `therapy.js` | 442 | POST | `/reveal` |
| 12 | `therapy.js` | 688 | GET | `/dilemmas` |
| 13 | `therapy.js` | 752 | POST | `/dilemma-profile` |
| 14 | `relationships.js` | 329 | POST | `/generate` |
| 15 | `relationships.js` | 799 | POST | `/generate-family` |
| 16 | `stories.js` | 239 | POST | `/social/import` |
| 17 | `stories.js` | 381 | POST | `/social/:id/detect-lala` |
| 18 | `tierFeatures.js` | 117 | POST | `/continuity-check` |
| 19 | `tierFeatures.js` | 553 | POST | `/franchise-guard-check` |
| 20 | `tierFeatures.js` | 731 | POST | `/plot-hole-detection` |
| 21 | `tierFeatures.js` | 857 | POST | `/dead-thread-detection` |
| 22 | `tierFeatures.js` | 933 | POST | `/generate-chapter-beats` |
| 23 | `tierFeatures.js` | 1052 | POST | `/generate-book-outline` |
| 24 | `calendarRoutes.js` | 326 | POST | `/events/:id/ripples/generate` |
| 25 | `calendarRoutes.js` | 457 | POST | `/auto-detect` |

**Every row in all three tables carries `requireAuth` at that line**
(rows 7's absence of it is what puts a route in that table). Row 9's
routes additionally carry `aiRateLimiter`; none of the three tables'
addresses were re-checked against `authorize(`/`requirePermission(` —
those are precisely §4's excluded 17.

---

# §6. Accounting for all 212

```
Row 1 (Tier 1):                  142
Row 7 (Tier 4 PUBLIC):             28
Row 9 (AI POST remainder):         25
Excluded (rows 2/3/4/5/6/8):       17
                                  ---
TOTAL:                            212
```

**All 212 routes are accounted for — 195 across the three itemized tables,
17 already named by CP12's own confirmation table.** No route was left
unassigned; no table was adjusted to make this total come out even — it
was verified by independent script cross-check before this document was
written, not fitted afterward.

---

# §7. Itemized counts against the recorded aggregates — three MEASURED deltas, not reconciled

```
Row 1 — Tier 1:
  Recorded:  ~115
  Itemized:   142
  Delta:      +27 (itemized exceeds recorded)

Row 7 — Tier 4 PUBLIC:
  Recorded:  ~28
  Itemized:   28
  Delta:       0

Row 9 — AI POST overlay remainder:
  Recorded:  ~25
  Itemized:   25
  Delta:       0
```

**These deltas are recorded, not explained.** Per this task's own
authorization: a MEASURED disagreement between an itemized count and a
recorded aggregate disposition is the same species as the two CP6 counting
errors already ruled on, and CP2's and CP3's own deltas — whether any of
the three warrants anything is Evoni's, not this document's. No attempt is
made here to adjust row 1's table, guess which of its 142 addresses might
be "really" pre-existing rather than CP12's own, or bring the figure down
to ~115. **CP2's and CP3's deltas are not recomputed or restated here** —
each belongs to its own document.

**One structural observation, not an explanation of any delta:** rows 7
and 9 itemized to their recorded figures exactly; row 1 did not. §3
already recorded why this is not incidental — CP12's own confirmation
document states that the 20-file cluster mixes CP12's own edits with
handlers "already correctly Tier'd from earlier CPs or untouched by this
sweep," and a census of current middleware state (which is what this
document performed, per §3) would capture all of the latter category
along with the former. **Whether that structural difference is the whole
explanation for row 1's +27, partial, or coincidental is not determined
by this document.**

---

# §8. Method notes — what three itemizations of three shapes showed

**Which source determined the file set, here: the commit's own diff
(`git diff --stat`), the same as CP2's and CP3's.** `git show 49e08e045
--stat -- src/routes` names the 20 files directly; CP12's own confirmation
document had already run this exact command at its own §2.3, so this is a
re-confirmation, not a new recovery, unlike CP2's row 9 (where the
confirmation document never checked the diff at all).

**Which source determined the itemization, here: neither the diff nor the
prose, but a full census of current middleware state.** This is the
methodological difference from CP2 and CP3, and it follows directly from
CP12's shape rather than from a different technique being tried for its
own sake:

- **CP2** (single row, one cluster): the diff showed the class directly —
  every promoted handler in the unnamed remainder was a fresh
  `optionalAuth`/bare → `requireAuth` change, fully diff-visible, once the
  confirmation document's gap (checking only commit prose, never the diff)
  was found and corrected.
- **CP3** (single row, one cluster, subtraction-derived aggregate): the
  same diff-based recovery generalized for addresses, though the aggregate
  itself was never a directly-stated figure the diff could be checked
  against — only ever a subtraction.
- **CP12** (three rows, one 212-route cluster, only ~155 of which are
  "net edit-touched" by CP12's own account): a diff-restricted read would
  systematically miss any route whose correct middleware predates this
  commit — and CP12's own confirmation document states plainly that such
  routes exist in these 20 files. Itemizing by diff alone here would not
  itemize the aggregate; it would itemize a strict subset of it,
  understating rows 1, 7, and 9 in a way this document could not
  distinguish from a genuine delta. Reading current state at CP12's own
  basis — which is what rows 7 and 9's exact matches suggest was the right
  call for at least two of the three classes — was the approach this
  document used throughout, consistently, not switched between rows.

**What the three together show about aggregate shapes:** a single-row,
single-cluster aggregate (CP2) and a subtraction-derived single-row
aggregate (CP3) both resolved with the diff as the address source and
produced deltas in the tens of handlers. A three-row, shared-cluster
aggregate whose population is explicitly a mix of this-commit and
prior-state handlers (CP12) required abandoning the diff as the
itemization source in favor of a full census, and produced two exact
matches and one large delta in the same document — not three roughly
similar deltas. **Whether a three-row shared-cluster shape is inherently
more or less reliable to itemize than a single-row shape is not something
this document concludes.** What it recorded is narrower: the method that
worked for CP2 and CP3 does not apply unchanged to CP12, CP12's own
confirmation document already said why, and this document's results are
consistent with that stated reason.

---

# §9. What this document does not do

- **Does not confirm any disposition.** This is not a limb 1 confirmation
  pass; it does not apply `agree`/`disagree`/`cannot-tell` to anything.
- **Does not judge whether any address's Tier assignment is correct.**
  Every handler in §5 is listed by address only — file, line, method,
  path — with its class determined solely by which middleware is present
  at that line. No claim is made or implied about whether that middleware
  is the *correct* Tier for any of them.
- **Does not reconcile any of the three §7 deltas.** Recorded and left
  for Evoni.
- **Does not recompute, restate, or compare CP2's or CP3's deltas as
  findings.** §8 compares method across all three CPs; it does not compare
  verdicts.
- **Does not reopen limb 1, alter its DISCHARGED standing, or treat this
  itemization as a precondition for that discharge.** `v2.69` Ruling 1
  already ruled the five accepted as unconfirmed under confirm-not-re-derive;
  this document is the third and last instance of the separate instrument
  that ruling named as owed.
- **Does not state that the itemization set being complete implies
  anything.** Three documents now exist. What follows from that is
  Evoni's, not stated here.
- **Does not mint FD-70 or any other number.** Does not assert that
  anything found here warrants a finding.
- **Does not edit `F-AUTH-1_Limb1_CP12_Confirmation_2026-09-02.md`,
  `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md`, or any other
  filed document.**
- **Does not touch `src/`, `tests/`, or `frontend/`.** Read-only.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Type: evidence, MEASURED. Itemizes CP12's three aggregate rows to 195
addresses (142 Tier 1, 28 Tier 4 PUBLIC, 25 AI POST remainder) plus 17
already named elsewhere in CP12's own table — all 212 routes accounted
for. Records three deltas against ~115/~28/~25; does not reconcile any of
them. Does not confirm, re-derive, or rule. Does not reopen limb 1, which
remains DISCHARGED. No host, AWS, database, or Cognito contact. Prod
FROZEN.*
