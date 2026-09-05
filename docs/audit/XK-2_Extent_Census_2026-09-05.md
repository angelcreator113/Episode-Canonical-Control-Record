| **PRIME STUDIOS** **XK-2 — EXTENT CENSUS: THE 20 UNPROBED `:showId` ROUTE FILES** *Records, for each unprobed file, whether the read-scoped-by-showId / write-by-row-id-alone pattern is PRESENT, ABSENT, or CANNOT-TELL. Proposes no disposition. Mints no FD or XK. Does not close XK-2.* |
| --- |

**Document version**

v1.0 — **MEASURED.** Derives the `:showId` route-file population fresh,
subtracts the two files the register already probes, and records one
verdict per remaining file with file:line evidence. **Proposes no
disposition — the XK-2 fix remains owned by F-Stats-1 and unevaluated.
Mints no FD or XK number. Does not close XK-2.**

**Basis:** `origin/main` at `ee334ad566e440763efc1c4a1a49f07182572a15`,
2026-09-05. All reads local `git show`/`grep` against that commit; no
host, AWS, database, or Cognito contact.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Recording only.** Supplies a population census for Evoni's disposition;
does not itself dispose. No FD, XK, or PE number is minted. Prod
**FROZEN**.

---

# §0. Owed-item check

```
$ git show origin/main:docs/audit/Cross_Keystone_Register.md | grep -n "^### XK-2" 
211:### XK-2 — row-scope not enforced in SQL
```

No census file was already on file under `docs/audit/` at this basis
(`ls docs/audit | grep -i "extent.census\|XK-2"` → empty before this
filing). The item is confirmed still owed.

---

# §1. Population, derived fresh — not carried from the register

```
$ grep -rl ":showId" src/routes/ | sort | nl
     1  src/routes/arcRoutes.js
     2  src/routes/careerGoals.js
     3  src/routes/editMaps.js
     4  src/routes/evaluation.js
     5  src/routes/feedEnhancedRoutes.js
     6  src/routes/feedPipelineRoutes.js
     7  src/routes/feedPostRoutes.js
     8  src/routes/gameShows.js
     9  src/routes/onboarding.js
    10  src/routes/opportunityRoutes.js
    11  src/routes/phoneAIRoutes.js
    12  src/routes/phoneMissionRoutes.js
    13  src/routes/phonePlaythroughRoutes.js
    14  src/routes/sceneStudioEpisodeRoutes.js
    15  src/routes/scriptGenerator.js
    16  src/routes/seasonRhythmRoutes.js
    17  src/routes/shows.js
    18  src/routes/uiOverlayRoutes.js
    19  src/routes/wardrobe.js
    20  src/routes/wardrobeEventRoutes.js
    21  src/routes/world.js
    22  src/routes/worldEvents.js
```

**22 files. The count matches the register's own figure — derived fresh
here, not carried from it.** Whether it is the *same 22 files*, and not
merely the same count reached by a similarly-shaped method, is a separate
question this document could not settle — see §4. Subtracting the two
already-probed files (`worldEvents.js`, `arcRoutes.js`) leaves the 20 named
in this task's
title.

**A qualification this derivation surfaced, not resolved by it — see §4.**
The command above matches the literal substring `:showId` anywhere in a
file: comments, SQL bind-parameter names inside `sequelize.query()`, and
local JS variable names all match it, in addition to actual Express route
path parameters. Three of the 22 files carry no genuine `:showId` Express
route parameter at all (§4) — and §4 finds evidence the register's own
method may have been more careful than this literal grep, not the same
method. This document keeps all three in the population as derived here,
rather than quietly excluding them on its own judgment, and records what
was actually found in each.

---

# §2. The two already-probed files — line numbers re-confirmed at this basis

```
$ wc -l src/routes/worldEvents.js src/routes/arcRoutes.js
  4005 src/routes/worldEvents.js
   227 src/routes/arcRoutes.js
```

`worldEvents.js` — all seven cited lines resolve at this basis:
1229 (`await models.sequelize.query(`), 1271 (`router.post('/world/:showId/events/:eventId/reject-invitation'...`),
1510 (`.../edit-invitation-text'...`), 1605 (`.../unlink-invitation'...`),
1837 (`await models.sequelize.query(`), 1910 (`UPDATE world_events SET
used_in_episode_id = NULL WHERE id = :eventId`), 1911 (`UPDATE episodes SET
deleted_at = NOW() WHERE id = :episodeId AND deleted_at IS NULL`).

`arcRoutes.js` — both cited lines resolve: 158 (`'UPDATE show_arcs SET
phases = :phases, updated_at = NOW() WHERE id = :id'`), 209
(`progression_log = :log, updated_at = NOW() WHERE id = :id`).

**No renumbering. Both files unchanged from what the register cites.**

---

# §3. The 20 unprobed files — one verdict each

**Method.** For each file, every route declaring (or, via a
`mergeParams: true` parent mount, inheriting) a `:showId` parameter was
read in full. Every `UPDATE`/`DELETE`/instance `.update()`/`.destroy()`/
`.save()` inside those handlers was checked for whether its own scoping
condition includes `show_id`/`showId`, or whether the row id it acts on
was itself obtained from a query already scoped by `show_id` within the
same request (safe — not the XK-2 mechanism) versus supplied directly by
the caller with no ownership check (the mechanism, or its "caller-supplied
FK" sub-form). Where the actual write happens inside a `services/*`
function called from the route and that function's own body was not read
as part of this census (scope: `src/routes/**`), the verdict is
CANNOT-TELL — not resolved by assuming either way.

| File | Verdict | Evidence |
|---|---|---|
| `careerGoals.js` | ABSENT | `:433` `PUT .../goals/:goalId` and `:481` `DELETE .../goals/:goalId` both scope the write `{ id: goalId, show_id: showId }` directly. `:533/:538` (`goals/sync`) call `goal.update()` on instances obtained from `CareerGoal.findAll({ where: { show_id: showId, ... } })` (`:518`) — the id driving the write is server-derived from a same-request scoped read, not caller-supplied. |
| `editMaps.js` | ABSENT | `:118` GET and `:138` POST (create) only use `:showId`; both scope by `show_id: showId`. The file's only update (`:176`, `editMap.update()`) is on an unrelated `PATCH /:id` route carrying no `showId` at all. |
| `evaluation.js` | ABSENT — **and see §4**: this file declares no `:showId` Express route parameter anywhere; its only related write (`:628`, `UPDATE character_state ... WHERE id = :stateId`) is reached via `POST /characters/:key/state/update`, whose `show_id` comes from `req.body`, not a route path. |
| `feedEnhancedRoutes.js` | CANNOT-TELL | `:74` (`POST /:showId/chain/:eventId`) and `:131` (`POST /:showId/moments/:episodeId/persist`) pass `req.params.showId` into `chainEventFromMomentum()` and `persistFeedMoments()` in `src/services/feedEventPipelineService.js` / `feedPostGeneratorService.js`. No write is visible in this route file; whether those service functions scope their own writes by show_id is not determined here (out of this census's `src/routes/**` scope). |
| `feedPipelineRoutes.js` | CANNOT-TELL | `:10` (`generate-opportunities`) and `:23` (`schedule/:opportunityId`) both delegate entirely to `generateOpportunitiesFromFeed()` / `scheduleOpportunityAsEvent()` in `feedEventPipelineService.js`. Same reason as above. |
| `feedPostRoutes.js` | ABSENT | The only `:showId` route (`:94`, `GET .../timeline`) is read-only. `PUT`/`DELETE /:postId` (`:169`, `:195`) is a separate route carrying no `showId`. |
| `gameShows.js` | ABSENT | `:75` GET and `:95` POST (create) only; no update/destroy by row id. |
| `onboarding.js` | ABSENT | The only `:showId` route (`:392`, `GET /status/:showId`) is read-only. |
| `opportunityRoutes.js` | CANNOT-TELL | `:134` PUT and `:250` DELETE scope their own writes correctly (`findOne({ id, show_id: showId })` then `.update()`, or `WHERE id = :id AND show_id = :showId`) — ABSENT for those two sites. But `:164` (`advance`) calls `onOpportunityAdvanced(id, to_status, models)` (`careerPipelineService.js`) with **no `showId` passed at all**, and `:230` (`to-event`) delegates its entire write to `convertOpportunityToEvent(id, showId, models)` in the same service. Neither service body was read (out of scope) — file verdict follows the least-resolved site. |
| `phoneAIRoutes.js` | ABSENT | No database write anywhere in the file — `POST /add-zones` only calls the Anthropic API and returns a proposal; the client applies it through the already-probed `/screen-links` route in `uiOverlayRoutes.js` (see below). |
| `phoneMissionRoutes.js` | ABSENT | `showId` is inherited via `express.Router({ mergeParams: true })` under the app.js mount `/api/v1/ui-overlays/:showId/missions`. `PUT`/`DELETE /:id` (`:83`, `:106`) both `findOne({ id, show_id: req.params.showId, deleted_at: null })` before `.update()`/`.destroy()` on that instance — safe. |
| `phonePlaythroughRoutes.js` | ABSENT — **and see §4**: mounted at `/api/v1/episodes/:episodeId/phone-state` (no `:showId` anywhere in the mount). `showId` is derived server-side (`:48`, `episode.show_id` from a `SELECT ... FROM episodes WHERE id = :episodeId`). All three writes (`:211`, `:235`, `:253`) are `state.save()` on an instance loaded/created scoped by `user_id` + `episode_id` (`:41-52`) — safe. |
| `sceneStudioEpisodeRoutes.js` | ABSENT | The only `:showId` route (`:243`, `GET /available-sets`) is read-only. `plan.update()` sites (`:139`, `:148`, `:201`) are on a separate `:episodeId`-keyed route. |
| `scriptGenerator.js` | ABSENT | `:42` `PUT /:showId/config` does `findOne({ show_id: showId })` then `config.update()` on that instance, or creates fresh with `show_id: showId` — safe either branch. |
| `seasonRhythmRoutes.js` | ABSENT | Both `:showId` routes (`:50`, `:66`) are GET-only. |
| `shows.js` | **PRESENT** — **and see §4**: this file's own route param is `:id`, not `:showId` (`router.get('/:id', ...)` etc.); `showId` is a local variable (`const showId = show.id`). Kept in population per the grep-derived method. Site: `:826-832`, `POST /:id/seed-finance-apps` — a `SELECT id ... FROM assets WHERE show_id = :showId ... LIMIT 1` (`:799-803`) finds a home-screen asset, then `UPDATE assets SET metadata = ... WHERE id = :id` (`:832`) writes it back keyed on that asset's own id alone, no `show_id` in the write's own WHERE clause. The id is server-derived from the same-request scoped read, not caller-supplied — matches the register's existing "Scope cached at the write" sub-form (`worldEvents.js` 1837/1910/1911; `arcRoutes.js` :158/:209). All other writes in the file (`:457`, `:1240`, `:1263`/`:1292`, `:1207`, `:20-32` of the redecorate handler) are either the Show instance updating itself by its own `:id`, or explicitly `WHERE show_id = :showId` in the SQL — ABSENT for those sites. |
| `uiOverlayRoutes.js` | ABSENT | 24 `:showId` routes, the largest file in the population. Every raw-SQL `UPDATE`/`DELETE`/`INSERT` site checked (`:304`, `:387/:393`, `:538`, `:572`, `:596`, `:637`, `:709`, `:739`, `:832`, `:902`, `:914`, `:932`, `:943`, `:962`) includes `show_id = :showId` (or, at `:538`, is the show updating its own row by `id = :showId`) in its own WHERE clause. The one ORM `.destroy()` (`:486`) scopes by a show-id-embedded key (`page_name: `phone_hub_${showId}``). No unscoped write found. |
| `wardrobe.js` | **PRESENT** | `:1812-1816`, `POST /:showId/auto-tag-event-types`: `Wardrobe.findAll({ where: { show_id: showId, deleted_at: null }, raw: true })` reads the show's items; `:1874`, inside the `!dryRun` branch, writes each changed row with `UPDATE wardrobe SET event_types = ... WHERE id = :id` — **no `show_id` in the write's own WHERE clause.** The id (`i.id`) is carried from the scoped `raw: true` read, not caller-supplied — same "Scope cached at the write" sub-form as `shows.js` above. |
| `wardrobeEventRoutes.js` | ABSENT | The only `:showId` route (`:182`, `POST /suggest`) calls the Anthropic API and returns a suggestion; it performs no database write. The file's actual writes (`:282` `.destroy()`, `:289` `.create()`) are on a separate `/:episodeId/lock-outfit` route carrying no `showId`. |
| `world.js` | **PRESENT** | `:162`, `POST /world/:showId/browse-pool`: `episode_id` arrives from `req.body` (`:166`) and is used at `:199` to look up the episode and, if provided, at `:241-244` to `models.Episode.update({ browse_pool_json: result }, { where: { id: episode_id } })` — **no `show_id` check anywhere in this handler that the looked-up episode actually belongs to `showId`.** This is the register's other named sub-form, "Caller-supplied FK written unvalidated" (previously only `worldEvents.js` :1229) — a second instance, in a file the register had not yet probed. |

**Tally: 3 PRESENT (`shows.js`, `wardrobe.js`, `world.js`), 3 CANNOT-TELL
(`feedEnhancedRoutes.js`, `feedPipelineRoutes.js`, `opportunityRoutes.js`),
14 ABSENT.** `evaluation.js` is counted ABSENT, not CANNOT-TELL:
CANNOT-TELL is reserved for a file where the mechanism might be present
but this census can't determine it (the three service-delegation cases
above); `evaluation.js` has no `:showId` route parameter for the
mechanism to attach to in the first place, which this census can
determine fully from the route file alone. That file's population
membership is a separate question, flagged at §4, not folded into its
verdict.

**The three cannot-tells are one fact, not three.** Every one of them
resolves to the same sentence: the write happens inside a `services/*`
function this census did not read, because its stated scope is
`src/routes/**`. That is a boundary of this census's own method, not a
property of `feedEnhancedRoutes.js`, `feedPipelineRoutes.js`, or
`opportunityRoutes.js` individually — nothing about those three files
makes them harder to determine than any other file that happens to
delegate its write to a service. A later reader should take "3
cannot-tells" as "1 known blind spot, 3 files behind it," not as three
separately-undeterminable properties. Resolving them means reading
`src/services/feedEventPipelineService.js`, `feedPostGeneratorService.js`,
and `careerPipelineService.js` — out of this census's scope, not out of
reach.

**Cannot-tell is still a first-class result here, not a gap in the
method.** A route layer built heavily on service delegation should produce
exactly this: a known, named scope boundary with files behind it, not
zero. A census that came back with zero cannot-tells would be the signal
to distrust, not this one.

---

# §4. Population-membership ambiguity — a finding this census surfaced

**Three of the 22 files matching the literal `:showId` grep (`evaluation.js`,
`phonePlaythroughRoutes.js`, `shows.js`) declare no genuine Express
`:showId` route parameter anywhere** — locally, or inherited via a
`mergeParams: true` parent mount. Each matches the grep for a different,
coincidental reason:

- `evaluation.js` (`:636`): `:showId` is a Sequelize replacement-parameter
  name inside a raw `INSERT` — its actual routes take `show_id` from
  `req.body`, not any route path.
- `phonePlaythroughRoutes.js` (`:30`, `:66` and others): its mount is
  `/api/v1/episodes/:episodeId/phone-state` — `showId` is a local variable
  derived from an `episodes` table lookup keyed by `:episodeId`.
- `shows.js` (`:485` and throughout): its own route parameter is `:id`
  (`router.get('/:id', ...)`) — `showId` is a local variable
  (`const showId = show.id`) for readability in SQL replacements.

**Checked, not just asserted:** whether this census's "22" and the
register's "22" are the same 22 files, or two different sets that happen
to have the same size.

```
$ git show origin/main:docs/audit/F-Stats-1_Fix_Plan_v1.44.md | sed -n '55,74p'
```

§47.1 of that document (the revision that first established "22 route
files carry `:showId`; that is the population") records that its own
method was **route-path-aware, not a blind string grep**: its §47.2
explicitly excludes `worldStudio.js` (52 `sequelize.query` sites, the
second-largest in the file) from the population *"because it has no
`:showId` in any of its 53 routes"* — the scoping model was checked
before the file was probed, specifically to avoid manufacturing a finding
from a file the class cannot apply to. `F-Stats-1_Fix_Plan_v1.49.md` §52.5
repeats the same population figure (*"120 route files, 22 carrying
`:showId`"*) and again excludes `worldStudio.js` "on principle," alongside
`characterRegistry.js`, `universe.js`, and `relationships.js`, for the same
reason.

**This is evidence, not proof, and it doesn't fully resolve the
question.** A method careful enough to exclude `worldStudio.js` for
having zero `:showId` anywhere in its routes would plausibly apply the
same test to `evaluation.js` and `phonePlaythroughRoutes.js` (also zero,
by the same test) and exclude them too — which would mean the register's
22 is NOT the same set as this census's naive-grep 22, and the count
matching is more coincidence than agreement. `shows.js` is a closer call
than either: unlike `worldStudio.js`, it addresses shows directly by their
own primary key (`:id`) and `showId` is only ever a local variable name —
whether the register's method would count that as "carrying `:showId`" the
way it counted `arcRoutes.js` or `worldEvents.js` is not established by
anything read here. **No document found in this repository enumerates the
register's 22 files by name** (`F-Stats-1_Fix_Plan_v1.44.md`,
`v1.45.md`, `v1.46.md`, `v1.49.md` and `Cross_Keystone_Register.md` were
checked; none lists them). Without that list, this census cannot confirm
or rule out that its population and the register's are the same files
under different derivations. **This is itself a cannot-tell, about the
population rather than about any single file's pattern:** the numeric
agreement at §1 should be read as "this census's grep reproduces the
register's stated count," not as "two independent methods confirm the
same 22 files."

---

# §5. What this document does not do

- **Proposes no disposition.** The XK-2 fix remains owned by F-Stats-1 and
  unevaluated, per the register's own "Fix: unevaluated" note.
- **Does not close XK-2.** Extent measured for the previously-unprobed
  files; the register's own severity and prod-carve-out language at
  `Cross_Keystone_Register.md` §XK-2 is untouched.
- **Does not mint** an FD or XK number.
- **Does not resolve the population-membership ambiguity at §4** — names
  it, does not adjudicate which sense of "the 22" the register intended.
- **Does not resolve the three CANNOT-TELLs** by reading into
  `src/services/**` — out of this census's stated scope
  (`src/routes/**`, read-only). A future document may.
- **Does not edit** `Cross_Keystone_Register.md` or any other filed
  document. This is an additive-supersede census only; the register's own
  entry stays as filed.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-09-05. Basis `origin/main` at `ee334ad566e`. Measures
extent only; proposes no disposition; mints no FD or XK; does not close
XK-2. No AWS call issued. No deployed host contacted. No workflow
dispatched. Prod FROZEN.*
