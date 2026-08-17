| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Surface adjudication close for CP handoff.* |
| --- |

**Document version**

v2.46 — **SURFACE ADJUDICATION COMPLETE.** **Mints nothing.** FD tail remains **FD-63 (F-AUTH-1)**; XK tail remains **XK-3**. Ships no code. Changes no gate. Converts v2.45's enumerated surface into final disposition: **106 handlers — 95 Tier 1, 8 HELD under XK-3, 7 PRESERVE per D20. Zero Tier 4. Zero mixed-tier files.** Records the reads behind the GET adjudication, which v2.45 left owed. Records two observations from those reads that are not this keystone's business. Derived entirely from git against `origin/main` at `d62e3626`. No live database contact.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED** per v2.43 §4.1, unchanged. Track G3 — OPEN, pending re-validation. Track G4 — pending re-validation; not entered. Track G5 — **BLOCKED** per v2.43 §4.2, unchanged. Track G6 — not reached. Prod remains FROZEN; confirm freeze status live before any prod-touching action.*

---

# §1. The disposition

| Group | Handlers | Disposition |
|---|---:|---|
| Writes, 11 files | 61 | **Tier 1** |
| GETs, `req.user`-free, 11 files | 34 | **Tier 1** |
| `roles.js`, all handlers | 8 | **HELD — XK-3** |
| `compositions.js` `authenticateJWT` subset | 7 | **PRESERVE — D20** |
| **Total** | **106** | |

**95 handlers take `requireAuth`. One tier, eleven files, no exemptions and no Item 15 markers.** `roles.js` is not touched by the sweep.

This is the simplest disposition shape the program has produced. §5.21 records 13 mixed-tier instances across CP1–CP12; this surface has none — every in-scope handler in every in-scope file resolves to the same tier.

---

# §2. The GET adjudication

v2.45 §2 recorded 38 GETs and classified none. This section classifies 34 of them. The remaining 4 are `roles.js`'s and are held at §4.

## §2.1 The eligibility test, and why it does not decide

§5.71's G5 test is that Tier 4 PUBLIC GETs must be `req.user`-free. **34 of the 38 pass it.**

- **20 GETs across eight files.** `git grep -n "req.user" origin/main -- src/routes/templateStudio.js src/routes/continuityEngine.js src/routes/animatic.js src/routes/footage.js src/routes/entanglementRoutes.js src/routes/authorNoteRoutes.js src/routes/iconSlots.js src/routes/seasonRhythmRoutes.js` returns **nothing**. No handler in any of those files reads `req.user` — GET or write.
- **10 GETs in `compositions.js` and 4 in `decisions.js`**, recorded `req.user`-free at v2.45 §2.
- **4 GETs in `roles.js`** read `req.user` at `:11`, `:41`, `:71`, `:211` and fail the test. Held separately.

**Passing G5 is necessary for Tier 4, not sufficient.** The test asks whether a handler gates on identity. §9.6 asks a different question — whether the data is published-only — and locks the default: *"Public-by-default is a worse failure mode than auth-by-default for a luxury franchise OS. When in doubt, requireAuth."* §5.71 describes the Tier 4 population as *catalog GETs with rationale comments per Item 15*, published canon of the kind a journalist would see.

**None of the 34 is that.** Each is adjudicated below.

## §2.2 The twenty, by route path

`git grep -n -E "router\.get|seasonRhythmRouter\.get" origin/main --` over the eight files returns:

| File | GET paths |
|---|---|
| `animatic.js` | `:155` `/scenes/:sceneId/composition`, `:217` `/scenes/:sceneId/timeline` |
| `authorNoteRoutes.js` | `:28` `/` |
| `continuityEngine.js` | `:56` `/timelines`, `:75` `/timelines/:id`, `:346` `/timelines/:id/conflicts` |
| `entanglementRoutes.js` | `:52` `/characters/:characterId/entanglements`, `:70` `/profiles/:profileId/orbit`, `:214` `/events`, `:235` `/events/:id`, `:306` `/characters/:characterId/unfollows` |
| `footage.js` | `:126` `/scenes/:episodeId`, `:226` `/episodes/:episodeId/assets` |
| `iconSlots.js` | `:19`, `:29`, `:39` |
| `seasonRhythmRoutes.js` | `:50` `/arc-health/:showId/:episodeNumber`, `:66` `/season-health/:showId` |
| `templateStudio.js` | `:28` `/`, `:109` `/:id` |

**Every path is per-resource production tooling** — scene composition, timeline conflicts, character entanglement state, episode footage assets, arc health by show and episode. None serves a published catalogue. **Tier 1.**

**`templateStudio.js:28` was the one candidate and it fails on read.** Read at `:27`–`:49`, `GET /` accepts `status`, `locked`, `format`, `name`, `limit`, `offset` and builds a raw-SQL `WHERE` from whichever are supplied. `status` and `locked` are lifecycle-state fields; a caller filtering by lock state is operating an admin surface, not browsing published output. **Tier 1.**

## §2.3 `compositions.js` — ten GETs, Tier 1

Read at `:66`–`:85`, `GET /api/v1/compositions` destructures `episode_id` and `limit` from the query and builds `const where = {}`. The `episode_id` filter is applied only when the value is present, is not the literal `'default'`, and passes a UUID regex.

**The guard is a filter-skip, not a validation.** A request with no `episode_id`, or with `episode_id=default`, or with any non-UUID string, leaves `where` empty and returns **every composition row in the table with its `compositionAssets` joined** — across all episodes and all shows. Invalid input does not reject; it broadens.

Under the global `optionalAuth` mount and with no per-route middleware, that read is available to an anonymous caller. **Tier 1.** The remaining nine GETs in the file are per-composition or per-episode reads over the same private production data.

## §2.4 `decisions.js` — four GETs, Tier 1

Read at `:64`–`:85`, `GET /` accepts `episode_id`, `scene_id`, `decision_type`, `decision_category`, `was_ai_suggestion`, `limit = 50`, `offset = 0`, all optional, and builds `where` from those supplied. Empty query returns the decision log across every episode and show. The default limit bounds row count per request, not exposure class.

**§9.6 supplies the governing precedent directly.** It rules `decisionAnalytics.js` GETs *"NOT exempt regardless. The caller-supplied user_id filter is a data-leak vector. Apply requireAuth."* `decisions.js` is the same decision surface with five caller-supplied filters. **Tier 1.**

`decisionAnalytics.js` itself is **not dispositioned here** — it carries no write routes, never entered v2.45's twelve-file surface, and is cited only for its ruling.

---

# §3. Two observations from these reads

Neither is an F-AUTH-1 finding. Both are recorded because they were seen in files this CP will edit.

**The unbounded-list idiom is not confined to these files.** `templateStudio.js:28`, `compositions.js:68` and `decisions.js:68` share one shape: optional query filters assembled into a `where` that is empty when none are supplied, returning the full table. It is the standard Sequelize list-endpoint idiom and is likely present wherever that idiom appears. **No measurement was made and none is implied.** It bears on this CP only in that route paths understate exposure — `GET /api/v1/compositions` reads like one episode's data and returns all of them.

**`seasonRhythmRoutes.js` has two further `optionalAuth` sites.** `:50` and `:66` both declare `seasonRhythmRouter.get(..., optionalAuth, ...)`. PE #51's explicit inventory carries `seasonRhythmRoutes.js:16` — the POST — and not these. They are Shape 4 by the same mechanism v2.44 §2.4 records: the router variable is `seasonRhythmRouter`, so §21's case-sensitive `router\.` pattern cannot see them. **Recorded; PE #51 is not amended, per v2.45 §4.2.**

**And a provenance absence, recorded not ruled.** The eight files at §2.2 contain no `req.user` reference at all, writes included. `authorNoteRoutes.js:108` hard-deletes by caller-supplied id and records no actor. Promoting these to Tier 1 authenticates the caller; it does not cause any handler to capture who acted. That is a gap in the code, not in this disposition.

---

# §4. `roles.js` — HELD, unchanged

`src/routes/roles.js` remains **HELD — XK-3 (F-Stats-1 v1.57)**, on v2.45 §3's reasoning without amendment:

- Tenancy derived from `req.query.show_id` / `req.body.show_id` at all eight handlers
- Presence-validated, entitlement never
- `req.user?.show_id` unsettable — no middleware in the codebase assigns it
- Tier 1 promotion authenticates the caller and does not authorize the show

**The hold is the operative CP instruction.** `roles.js` is not edited by the sweep. Its four GETs are the only ones of the 38 that fail §5.71's G5 test, and its four writes are the only in-scope writes not taking Tier 1.

This revision does not amend XK-3, does not mint an FD, and does not convert the hold into a tier disposition.

---

# §5. What the CP inherits

**One operation.** Apply `requireAuth` to all 95 in-scope handlers across eleven files: `animatic.js`, `authorNoteRoutes.js`, `compositions.js`, `continuityEngine.js`, `decisions.js`, `entanglementRoutes.js`, `footage.js`, `iconSlots.js`, `luxuryFilterRoutes.js`, `seasonRhythmRoutes.js`, `templateStudio.js`. Leave `roles.js` and `compositions.js`'s seven `authenticateJWT` handlers untouched.

**Four shapes to edit, not one.** Per v2.44 §2: bare declarations take an added middleware argument; `entanglementRoutes.js:40` and `authorNoteRoutes.js:18` are `router.use(optionalAuth)` preset migrations per the §5.41 v2.37 sub-discipline; `iconSlots.js` sites are multi-line; `luxuryFilterRoutes.js` and `seasonRhythmRoutes.js` are inline swaps on a non-`router` variable.

**Verification cannot use §21's G1 alone.** FD-63 (F-AUTH-1) records that it cannot see three of the four shapes, and v2.45 §4.1 records that its zero does not discharge PE #51. A `requireAuth`-presence count per file is the minimum honest check.

---

# §6. Gate effects — none

Track G5 remains **BLOCKED** per v2.43 §4.2. Tracks G3 and G4 remain **pending re-validation** per v2.43 §4.3; Track G4 is not entered. v2.43 §4.1's REOPENED-QUALIFIED status is unchanged.

**Adjudication is not remediation.** Every one of the 95 handlers is in the same state after this revision as before it. The gate moves when the code does.

---

# §7. Numeral disambiguation

- **Tier 1–Tier 4** in this document are Step 3 disposition tiers. **Shape 1–Shape 4** are v2.44's enumeration of why §21's G1 misses a route. A handler has one of each and they do not correspond.
- **G5** appears in two senses and both are used here: **§5.71's G5** is the Tier-4-PUBLIC verification grep (§2.1); **Track G5** is the prod-cutover gate (§6). Written in full at each use.
- **XK-3 Gate 3** is the Cross-Keystone Register's admission gate, unrelated to both.
- **FD-63 (F-AUTH-1)** is v2.43's mint and is not re-minted. **FD-62 (F-Stats-1)** is a different finding in a different series.
- **D20** is the `authenticateJWT` preservation discipline. **D11** is CP7's scope-expansion outlier. Unrelated.

---

# §8. What this revision does not do

- Does not ship code, change any unit disposition already made, or alter any PR state.
- Does not mint an FD, an XK, or a PE. FD tail **FD-63 (F-AUTH-1)**; XK tail **XK-3**.
- Does not amend XK-3, the Cross-Keystone Register, PE #51, or D20.
- Does not edit any prior revision's body.
- Does not disposition `decisionAnalytics.js` or any file outside v2.45's twelve (§2.4).
- Does not measure the unbounded-list idiom beyond the three files read (§3).
- Does not read `AssetRoleService`, or any handler body beyond the sites cited.
- Does not verify the `compositions.js` route-order hazard recorded at v2.45 §2.
- Does not change any gate. Track G5 remains blocked; Track G4 is not entered.
- Does not claim or open a prod window. **Prod remains FROZEN; confirm freeze status live before any prod-touching action.**
- **No live database contact.** Derived entirely from git against `origin/main` at `d62e3626`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-17. Main at `d62e3626`. Predecessor: v2.45.*
*Type: Surface adjudication close. 106 handlers = 95 Tier 1 + 8 HELD (XK-3) + 7 PRESERVE (D20). Zero Tier 4, zero mixed-tier files. Mints no FD, no XK, no PE. Tail: FD-63. XK tail: XK-3. Ships no code. Changes no gate. No live database contact. [skip-automerge]*
