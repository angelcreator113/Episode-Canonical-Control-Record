| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP2 ITEMIZATION** *Itemizes CP2's row 9 aggregate cannot-tell to real addresses. Does not confirm, re-derive, or rule. Does not reopen limb 1.* |
| --- |

# F-AUTH-1 Limb 1 — CP2 Itemization

**Document type: evidence, MEASURED.** Itemizes one of the five aggregate
`cannot-tell` dispositions limb 1's confirmation sweep left unaddressed —
CP2's row 9. Authorized by Evoni 2026-09-03; carried forward as owed by
`F-AUTH-1_Fix_Plan_v2.69.md` §6 Ruling 1 and §7 item 1, filed
`docs(audit): itemize CP2 aggregate cannot-tell`.

**Standing before this document starts: limb 1 is DISCHARGED**
(`F-AUTH-1_Fix_Plan_v2.69.md` §6 Ruling 1, 2026-09-03). That ruling accepted
the five aggregate `cannot-tell`s as unconfirmed under confirm-not-re-derive
and named an itemized audit, under a different instrument, as owed. **This
document is that audit, for one of the five.** It does not perform limb 1
work, does not alter limb 1's DISCHARGED standing, and does not treat
itemization as a precondition for that discharge.

**Basis:** `origin/main` at `810c4e0d0bcdc7a45fbc2361a4b7c8fbb04a82e7`,
2026-09-03.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Itemizes only.** Does not confirm any disposition, does not re-derive or
re-judge any Tier assignment, does not reconcile its own count against the
recorded aggregate beyond stating the delta, does not mint, close, or reopen
anything.

---

# §1. What is itemized, quoted exactly as recorded

`F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md` §4, row 9:

```
$ sed -n '217p' docs/audit/F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md
```

> | 9 | cluster Tier 1 remainder (~19 other files, plus 3 of the 5
> "preserved" AI-POST handlers) | **none named** | Tier 1 promoted,
> aggregate only | The commit body states a 227-handler / 222-Tier-1
> cluster total but names no file or line for this portion — nothing in
> either source identifies which of the other ~19 files, or which 3 of the
> 5 "preserved" AI-POST handlers, this covers. Auditing all 22 files to
> find them would be re-deriving the sweep, which Ruling 3 excludes |
> **cannot-tell** |

Same document, §5, the arithmetic that produces the aggregate figure this
itemization checks against:

> "The commit body itemizes 83 of the cluster's 227 handlers by file and
> mostly by line (rows 1–8); it states a 227-handler / 222-Tier-1 aggregate
> and leaves the remaining **~144 handlers** — spread across roughly 19
> files this pass has not individually named — as a class total with no
> scope attached."

`F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §4.1, read at this
basis:

```
$ grep -n -A15 "^## §4.1\|CP2" docs/audit/F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md | grep -A15 "cannot-tell" | head -20
```

That document restates CP2's row 9 as one of the five `cannot-tell`
dispositions, cites the same "~19 files… not individually named" language,
and makes no recommendation and mints nothing — consistent with what §1
quotes above, no independent addressing performed there either.

**The recorded aggregate this itemization checks against: ~144 handlers,
across ~19 files, of which 3 of 5 "preserved" AI-POST handlers are a named
subset.**

---

# §2. CP2's basis commit, re-confirmed

Same commit `F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md` §3 established:

```
$ git merge-base --is-ancestor d73599f8e78c8e2d509e3e4a902b999f598774ca origin/main && echo "IS ANCESTOR"
IS ANCESTOR
$ git log -1 --format='%H %ad %P' --date=short d73599f8e78c8e2d509e3e4a902b999f598774ca
d73599f8e78c8e2d509e3e4a902b999f598774ca 2026-05-07 05cd536dd90703372cb0557b191b023156818ef6
```

**CP2's basis commit: `d73599f8e78c8e2d509e3e4a902b999f598774ca`, parent
`05cd536dd90703372cb0557b191b023156818ef6`.** All reads below are `git
show d73599f8e:<path>` at this SHA, or `git diff 05cd536dd..d73599f8e --
<path>` for what changed.

---

# §3. The file set, established from CP2's own commit — not a fresh sweep

**CP2's own confirmation pass checked only the commit message's prose for
file names** (§2.2/§2.3 of that document) and correctly found none there.
**It did not check the commit's own diff**, which is a different part of
the same record — the actual patch CP2's commit applied, not an independent
re-sweep of `src/`.

```
$ git show d73599f8e78c8e2d509e3e4a902b999f598774ca --stat --format="" -- src/routes/ | awk '{print $1}' | grep -v "^$"
src/routes/cursorPaths.js
src/routes/episodeBriefRoutes.js
src/routes/episodeOrchestrationRoute.js
src/routes/episodeScriptWriterRoutes.js
src/routes/episodes.js
src/routes/gameShows.js
src/routes/iconCues.js
src/routes/lala-scene-detection.js
src/routes/lalaScripts.js
src/routes/musicCues.js
src/routes/onboarding.js
src/routes/phoneAIRoutes.js
src/routes/phoneMissionRoutes.js
src/routes/phonePlaythroughRoutes.js
src/routes/productionPackage.js
src/routes/sceneStudioEpisodeRoutes.js
src/routes/scriptParse.js
src/routes/shows.js
src/routes/timelineData.js
src/routes/todoListRoutes.js
src/routes/uiOverlayRoutes.js
src/routes/wardrobeApproval.js
22
```

**22 files, matching the commit's own "22 files" claim exactly.** Four are
already named and itemized at CP2 Confirmation §4 rows 1–8:
`episodes.js`, `wardrobeApproval.js`, `uiOverlayRoutes.js`,
`episodeOrchestrationRoute.js`. **The remaining 18 are row 9's file set:**

```
cursorPaths.js, episodeBriefRoutes.js, episodeScriptWriterRoutes.js,
gameShows.js, iconCues.js, lala-scene-detection.js, lalaScripts.js,
musicCues.js, onboarding.js, phoneAIRoutes.js, phoneMissionRoutes.js,
phonePlaythroughRoutes.js, productionPackage.js,
sceneStudioEpisodeRoutes.js, scriptParse.js, shows.js, timelineData.js,
todoListRoutes.js
```

**18 files, not ~19** — within the record's own "roughly 19," not a
disagreement with it.

---

# §4. Itemization — 118 promoted handlers, 18 files

For each file: every `router.<method>(` declaration whose middleware
changed in this commit (`git diff 05cd536dd..d73599f8e -- <path>`), read at
`d73599f8e`. Prior middleware is read at the parent `05cd536dd` where the
diff shows a replacement; "bare" means no auth middleware present at either
commit until this one.

## cursorPaths.js — 11, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 19 | POST | `/:episodeId/cursor-paths/generate` |
| 2 | 29 | POST | `/:episodeId/cursor-paths/regenerate` |
| 3 | 43 | GET | `/:episodeId/cursor-paths` |
| 4 | 53 | GET | `/:episodeId/cursor-paths/:pathId` |
| 5 | 63 | POST | `/:episodeId/cursor-paths` |
| 6 | 73 | PUT | `/:episodeId/cursor-paths/:pathId` |
| 7 | 83 | DELETE | `/:episodeId/cursor-paths/:pathId` |
| 8 | 97 | POST | `/:episodeId/cursor-paths/:pathId/approve` |
| 9 | 107 | POST | `/:episodeId/cursor-paths/:pathId/reject` |
| 10 | 117 | POST | `/:episodeId/cursor-paths/approve-all` |
| 11 | 131 | GET | `/:episodeId/cursor-paths/export` |

## episodeBriefRoutes.js — 8 promoted, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 17 | GET | `/:episodeId` |
| 2 | 45 | PUT | `/:episodeId` |
| 3 | 77 | POST | `/:episodeId/lock` |
| 4 | 122 | GET | `/:episodeId/plan` |
| 5 | 143 | PUT | `/:episodeId/plan/:beatNumber` |
| 6 | 175 | POST | `/:episodeId/plan/:beatNumber/lock` |
| 7 | 191 | POST | `/:episodeId/plan/lock-all` |
| 8 | 303 | GET | `/:episodeId/script-context` |

Three further handlers in this file are **preserved, not promoted** — see
§5.

## episodeScriptWriterRoutes.js — 7, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 17 | POST | `/:episodeId/generate` |
| 2 | 50 | GET | `/:episodeId` |
| 3 | 69 | GET | `/:episodeId/version/:version` |
| 4 | 88 | GET | `/:episodeId/latest` |
| 5 | 104 | PUT | `/:scriptId` |
| 6 | 135 | POST | `/:scriptId/lock` |
| 7 | 160 | GET | `/:episodeId/context` |

## gameShows.js — 6, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 10 | GET | `/:episodeId/phases` |
| 2 | 37 | POST | `/:episodeId/phases/bulk` |
| 3 | 75 | GET | `/:showId/layouts` |
| 4 | 95 | POST | `/:showId/layouts` |
| 5 | 121 | GET | `/:episodeId/interactive` |
| 6 | 142 | POST | `/:episodeId/interactive` |

## iconCues.js — 15, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 25 | POST | `/:episodeId/icon-cues/generate` |
| 2 | 35 | POST | `/:episodeId/icon-cues/regenerate` |
| 3 | 50 | GET | `/:episodeId/icon-cues` |
| 4 | 60 | GET | `/:episodeId/icon-cues/:cueId` |
| 5 | 70 | POST | `/:episodeId/icon-cues` |
| 6 | 80 | PUT | `/:episodeId/icon-cues/:cueId` |
| 7 | 90 | DELETE | `/:episodeId/icon-cues/:cueId` |
| 8 | 104 | POST | `/:episodeId/icon-cues/:cueId/approve` |
| 9 | 114 | POST | `/:episodeId/icon-cues/:cueId/reject` |
| 10 | 124 | POST | `/:episodeId/icon-cues/approve-all` |
| 11 | 134 | POST | `/:episodeId/icon-cues/reject-all` |
| 12 | 148 | GET | `/:episodeId/icon-cues/anchors` |
| 13 | 158 | POST | `/:episodeId/icon-cues/:cueId/set-anchor` |
| 14 | 168 | DELETE | `/:episodeId/icon-cues/:cueId/remove-anchor` |
| 15 | 183 | GET | `/:episodeId/icon-cues/export` |

## lala-scene-detection.js — 3, prior locally-defined `optionalAuth` fallback

| # | line | method | path |
|---|---|---|---|
| 1 | 108 | GET | `/book/:bookId` |
| 2 | 133 | PUT | `/:sceneId` |
| 3 | 161 | POST | `/backfill/:bookId` |

Prior middleware in this file was a locally-defined `optionalAuth` fallback
(`authModule.optionalAuth || authModule.authenticate || ((req,res,next)=>
next())`), removed by this commit — the "lazy-noop fallback removed" item
the commit body names, not the shared `middleware/auth` `optionalAuth`.

## lalaScripts.js — 1, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 10 | POST | `/:episodeId/generate-lala-script` |

## musicCues.js — 9, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 19 | POST | `/:episodeId/music-cues/generate` |
| 2 | 33 | GET | `/:episodeId/music-cues` |
| 3 | 43 | GET | `/:episodeId/music-cues/:cueId` |
| 4 | 53 | POST | `/:episodeId/music-cues` |
| 5 | 63 | PUT | `/:episodeId/music-cues/:cueId` |
| 6 | 73 | DELETE | `/:episodeId/music-cues/:cueId` |
| 7 | 87 | POST | `/:episodeId/music-cues/:cueId/approve` |
| 8 | 97 | POST | `/:episodeId/music-cues/approve-all` |
| 9 | 111 | GET | `/:episodeId/music-cues/export` |

## onboarding.js — 5, prior locally-defined `optionalAuth` fallback

| # | line | method | path |
|---|---|---|---|
| 1 | 128 | POST | `/start` |
| 2 | 179 | POST | `/respond` |
| 3 | 240 | POST | `/confirm` |
| 4 | 392 | GET | `/status/:showId` |
| 5 | 499 | POST | `/session-state` |

Same fallback pattern as `lala-scene-detection.js`, removed by this commit.

## phoneAIRoutes.js — 2, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 75 | POST | `/add-zones` |
| 2 | 185 | POST | `/fill-content-zone` |

## phoneMissionRoutes.js — 4, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 18 | GET | `/` |
| 2 | 63 | POST | `/` |
| 3 | 83 | PUT | `/:id` |
| 4 | 106 | DELETE | `/:id` |

## phonePlaythroughRoutes.js — 4, prior `authenticate` (not `optionalAuth`)

| # | line | method | path |
|---|---|---|---|
| 1 | 100 | GET | `/` |
| 2 | 119 | POST | `/tap` |
| 3 | 221 | POST | `/reset` |
| 4 | 244 | POST | `/complete` |

**Noted as observed, not smoothed over:** this file's prior middleware was
a distinct `authenticate` function, not the shared `middleware/auth`
`optionalAuth` every other file in this table carried. Recorded exactly as
found; no claim about what `authenticate` enforced is made here.

## productionPackage.js — 6, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 19 | POST | `/:episodeId/production-package/generate` |
| 2 | 29 | GET | `/:episodeId/production-package/latest` |
| 3 | 39 | GET | `/:episodeId/production-package/versions` |
| 4 | 49 | GET | `/:episodeId/production-package/:packageId` |
| 5 | 59 | GET | `/:episodeId/production-package/:packageId/download` |
| 6 | 69 | DELETE | `/:episodeId/production-package/:packageId` |

## sceneStudioEpisodeRoutes.js — 5, prior `optionalAuth`

| # | line | method | path |
|---|---|---|---|
| 1 | 19 | GET | `/:episodeId/visual-sequence` |
| 2 | 122 | PUT | `/:episodeId/beat/:beatNumber/angle` |
| 3 | 172 | PUT | `/:episodeId/beat/:beatNumber/scene-set` |
| 4 | 243 | GET | `/:showId/available-sets` |
| 5 | 296 | GET | `/:episodeId/sets` |

## scriptParse.js — 3, prior locally-defined `optionalAuth` fallback

| # | line | method | path |
|---|---|---|---|
| 1 | 38 | POST | `/parse` |
| 2 | 82 | POST | `/:id/parse-script` |
| 3 | 174 | POST | `/:id/apply-scene-plan` |

Same fallback pattern as `lala-scene-detection.js` and `onboarding.js`,
removed by this commit.

## shows.js — 18, prior bare/no-auth

| # | line | method | path |
|---|---|---|---|
| 1 | 58 | POST | `/:id/cover-image` |
| 2 | 127 | GET | `/` |
| 3 | 217 | GET | `/:id` |
| 4 | 303 | POST | `/` |
| 5 | 404 | GET | `/:id/financial-config` |
| 6 | 442 | PUT | `/:id/financial-config` |
| 7 | 478 | GET | `/:id/financial-summary` |
| 8 | 621 | POST | `/:id/seed-finance-apps` |
| 9 | 870 | POST | `/:id/redecorate-finance-app` |
| 10 | 918 | GET | `/:id/financial-breakdowns` |
| 11 | 1030 | GET | `/:id/financial-suggestions` |
| 12 | 1191 | POST | `/:id/seed-balance` |
| 13 | 1228 | PUT | `/:id/wardrobe-config` |
| 14 | 1252 | PUT | `/:id` |
| 15 | 1282 | DELETE | `/:id` |
| 16 | 1311 | GET | `/:id/config` |
| 17 | 1353 | GET | `/:id/template` |
| 18 | 1438 | GET | `/:id/wardrobe` |

## timelineData.js — 2, prior bare/no-auth

| # | line | method | path |
|---|---|---|---|
| 1 | 16 | GET | `/:episodeId/timeline-data` |
| 2 | 40 | PUT | `/:episodeId/timeline-data` |

## todoListRoutes.js — 9, prior locally-defined `optionalAuth` fallback

| # | line | method | path |
|---|---|---|---|
| 1 | 17 | POST | `/episodes/:episodeId/todo/generate` |
| 2 | 38 | POST | `/episodes/:episodeId/todo/generate-career` |
| 3 | 58 | GET | `/episodes/:episodeId/todo` |
| 4 | 75 | POST | `/episodes/:episodeId/todo/complete/:slot` |
| 5 | 130 | POST | `/episodes/:episodeId/todo/save-selection` |
| 6 | 151 | POST | `/episodes/:episodeId/todo/lock` |
| 7 | 271 | POST | `/episodes/:episodeId/todo/unlock` |
| 8 | 288 | POST | `/episodes/:episodeId/todo/complete-social/:slot` |
| 9 | 328 | GET | `/episodes/:episodeId/todo/social` |

Same fallback pattern as `lala-scene-detection.js`, `onboarding.js`, and
`scriptParse.js`, removed by this commit.

**Total: 118 promoted handlers across 18 files** (11+8+7+6+15+3+1+9+5+2+4+4+6+5+3+18+2+9).

---

# §5. The 3 of 5 "preserved" AI-POST handlers — located

Row 9 also covers "3 of the 5 'preserved' AI-POST handlers not named
above." Preserved means untouched by CP2's commit, so these do not appear
in the diff §4 was built from — a different search was needed: which of
the 18 files carry the `aiRateLimiter` middleware at CP2's own basis,
whether touched by this commit or not.

```
$ for f in cursorPaths.js episodeBriefRoutes.js episodeScriptWriterRoutes.js gameShows.js iconCues.js lala-scene-detection.js lalaScripts.js musicCues.js onboarding.js phoneAIRoutes.js phoneMissionRoutes.js phonePlaythroughRoutes.js productionPackage.js sceneStudioEpisodeRoutes.js scriptParse.js shows.js timelineData.js todoListRoutes.js; do
    n=$(git show d73599f8e78c8e2d509e3e4a902b999f598774ca:src/routes/$f | grep -c "aiRateLimiter")
    if [ "$n" != "0" ]; then echo "$f: $n"; fi
  done
episodeBriefRoutes.js: 4
```

One file, four occurrences (one is the `require` statement). The three
route-level occurrences:

```
$ git show d73599f8e78c8e2d509e3e4a902b999f598774ca:src/routes/episodeBriefRoutes.js | grep -n "aiRateLimiter"
11:const { aiRateLimiter } = require('../middleware/aiRateLimiter');
91:router.post('/:episodeId/generate-plan', requireAuth, aiRateLimiter, async (req, res) => {
202:router.post('/:episodeId/generate-script', requireAuth, aiRateLimiter, async (req, res) => {
245:router.post('/:episodeId/rewrite-line', requireAuth, aiRateLimiter, async (req, res) => {
```

**Confirmed preserved, not promoted** — byte-identical at CP2's basis and
its parent:

```
$ git show 05cd536dd90703372cb0557b191b023156818ef6:src/routes/episodeBriefRoutes.js | grep -n "aiRateLimiter\|generate-plan\|generate-script\|rewrite-line"
11:const { aiRateLimiter } = require('../middleware/aiRateLimiter');
91:router.post('/:episodeId/generate-plan', requireAuth, aiRateLimiter, async (req, res) => {
202:router.post('/:episodeId/generate-script', requireAuth, aiRateLimiter, async (req, res) => {
245:router.post('/:episodeId/rewrite-line', requireAuth, aiRateLimiter, async (req, res) => {
```

Identical lines at both commits — these three handlers already carried
`requireAuth, aiRateLimiter` before CP2's commit and are untouched by it,
exactly matching row 9's "preserved" description.

| # | line | method | path |
|---|---|---|---|
| 1 | 91 | POST | `/:episodeId/generate-plan` |
| 2 | 202 | POST | `/:episodeId/generate-script` |
| 3 | 245 | POST | `/:episodeId/rewrite-line` |

**No other file among the 18 carries `aiRateLimiter` at this basis.** The
"3 of 5" figure is fully accounted for by this one file; the search
covered all 18, not a subset.

---

# §6. Itemized count against the recorded aggregate — a MEASURED delta, not reconciled

```
Recorded (CP2 Confirmation §5, arithmetic):  ~144 handlers, ~19 files
Itemized here:                                121 handlers, 18 files
  118 promoted (§4) + 3 preserved (§5)
Delta:                                         23 handlers short of ~144
```

**This delta is recorded, not explained.** Per this task's own
authorization: a MEASURED disagreement between an itemized count and a
recorded aggregate disposition is the same species as the two CP6 counting
errors already ruled on, and whether it warrants anything is Evoni's, not
this document's. No attempt is made here to locate the missing ~23, guess
at which files might account for them, or adjust either figure toward the
other.

**One structural observation, not an explanation of the delta:** the
18-file, 118-handler count in §4 is drawn from the commit's own diff, which
by construction can only show handlers whose middleware *changed* in this
commit. The 3 preserved handlers in §5 were found by a different method —
searching for `aiRateLimiter` — because "preserved" means unchanged, and an
unchanged line produces no diff. **Whether the remaining delta reflects a
similar category of handler invisible to a diff-based read, an imprecision
in the recorded `~144` figure's own arithmetic, or something else is not
determined by this document.**

---

# §7. What this document does not do

- **Does not confirm any disposition.** This is not a limb 1 confirmation
  pass; it does not apply `agree`/`disagree`/`cannot-tell` to anything.
- **Does not judge whether any address's Tier assignment is correct.**
  Every handler in §4 and §5 is listed by address only — file, line,
  method, path, and prior middleware as read. No claim is made or implied
  about whether `requireAuth` (or the preserved `requireAuth,
  aiRateLimiter`) is the *correct* Tier for any of them.
- **Does not reconcile the §6 delta.** Recorded and left for Evoni.
- **Does not reopen limb 1, alter its DISCHARGED standing, or treat this
  itemization as a precondition for that discharge.** `v2.69` Ruling 1
  already ruled the five accepted as unconfirmed under confirm-not-re-derive;
  this document is the separate instrument that ruling named as owed.
- **Does not mint FD-70 or any other number.** Does not assert that
  anything found here warrants a finding.
- **Does not edit `F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md`,
  `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md`, or any other
  filed document.**
- **Does not touch `src/`, `tests/`, or `frontend/`.** Read-only.
- **Does not perform CP3's or CP12's itemization.** Separate documents,
  no ordering dependency between them.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Type: evidence, MEASURED. Itemizes CP2's row 9 to 121 addresses (118
promoted, 3 preserved) against a recorded ~144. Records the delta; does not
reconcile it. Does not confirm, re-derive, or rule. Does not reopen limb 1,
which remains DISCHARGED. No host, AWS, database, or Cognito contact. Prod
FROZEN.*
