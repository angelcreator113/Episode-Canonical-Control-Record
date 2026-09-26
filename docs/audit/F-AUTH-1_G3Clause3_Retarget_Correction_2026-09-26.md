| **PRIME STUDIOS** **F-AUTH-1 — GATE G3 CLAUSE 3 — RETARGET CORRECTED: THE ATTRIBUTION MOVES TO THE ROUTE THE APP CALLS** *The #1950 retarget put clause 3's evidence on a route nothing in the app calls. This note records Evoni's finding, corrects the retarget note's §3, and records the new substitution. Mints nothing.* |
| --- |

**Document version**

v1.0: records Evoni's attested production finding on issue #1954 and
corrects `F-AUTH-1_G3Clause3_Retarget_2026-09-26.md` (merged in #1950,
hereafter "the retarget note"). This is a new document because the
retarget note is merged and immutable. It edits no file under
`docs/audit/`.

**Basis:** `origin/main` at `7c7f8d4849e22f99e4d6f43b3f5840bbd83c85f8`,
2026-09-26 (`git rev-parse origin/main`; `git log -1 --format='%ad'
--date=iso-strict origin/main` → `2026-09-25T22:09:26-04:00`). All
`file:line` citations below are at this SHA unless marked otherwise. Code
this change adds is cited by function name, because it has no line at the
basis.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios. The
finding is Evoni's (issue #1954), quoted verbatim at §1. Standing: ATTESTED
as quoted (a production observation reported by Evoni, not measured by
this session).

**Status**

**Correction amendment.** Corrects one statement in the retarget note's §3
and replaces its substitution with a new one. **Mints nothing. Rules
nothing of its own.** It does not re-make, unwind or re-open v2.55 §3's
discharge ruling, v2.57 §2's disposition of it, or anything the retarget
note left to Evoni in its §5. Those stay owed to her.

---

# §1. The finding (ATTESTED, Evoni, after Deploy AK, 2026-09-26, verbatim)

> Production finding, ATTESTED 2026-09-26, after Deploy AK: clause 3's
> retargeted evidence does not work. decision_log is still empty after
> repeated closet loads. The cause is that #1950 added user_id: req.user.id
> to POST /world/:showId/browse-pool (src/routes/world.js:253), but the
> styling game calls POST /api/v1/wardrobe/browse-pool
> (EpisodeWardrobeGameplay.jsx:205). They are different routes. The
> instrumented one is not reached by the app, so the new evidence has the
> same defect as the old: it was never exercised against production, just
> on a different route.
>
> Check whether the wardrobe route also writes to decision_log, whether it
> is auth-gated, and whether anything at all calls the world route. Then
> move the attribution to the route the app actually uses — or instrument
> both if both are live. The amendment in #1950 must be corrected before it
> stands as evidence: it currently claims production-backed attribution
> that does not occur.

> This is the third time the same shape has caught us tonight: the test
> verified the code, the code verified nothing.

# §2. The three checks (MEASURED at basis)

| Question | Answer |
|---|---|
| Does `POST /api/v1/wardrobe/browse-pool` write `decision_log`? | **No.** The handler (`src/routes/wardrobe.js:1059–1329`) has no `DecisionLogger` call and no `INSERT`. |
| Is it auth-gated? | **Yes.** `router.post('/browse-pool', requireAuth, …)` (`src/routes/wardrobe.js:1059`), mounted at `/api/v1/wardrobe` (`src/app.js:749`). |
| Does anything call `POST /world/:showId/browse-pool`? | **Only tests.** It is mounted (`src/app.js:768–769`). No code in `frontend/src`, `src/` or `scripts/` calls it. Its callers are the clause-3 integration test (`tests/integration/f-auth-1-g3-clause3.test.js:127`), the source checks in `tests/unit/utils/decisionLogger.userId.test.js:62` and `tests/unit/routes/world-cluster-tier-promotion.test.js:267`. |

```
$ git grep -n "browse-pool" origin/main -- frontend/src src scripts | grep -v "^origin/main:src/migrations"
origin/main:frontend/src/components/EpisodeWardrobeGameplay.jsx:205:      const res = await api.post('/api/v1/wardrobe/browse-pool', {
origin/main:frontend/src/components/EpisodeWardrobeGameplay.test.jsx:67:    if (url === '/api/v1/wardrobe/browse-pool') {
origin/main:frontend/src/components/EpisodeWardrobeGameplay.test.jsx:240:      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
origin/main:frontend/src/components/EpisodeWardrobeGameplay.test.jsx:263:      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
origin/main:frontend/src/components/EpisodeWardrobeGameplay.test.jsx:302:      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
origin/main:frontend/src/components/EpisodeWardrobeGameplay.test.jsx:333:      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
origin/main:frontend/src/components/EpisodeWardrobeGameplay.test.jsx:369:      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
origin/main:frontend/src/components/EpisodeWardrobeGameplay.test.jsx:467:      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
origin/main:frontend/src/utils/wardrobeReach.js:7: * component sends to POST /wardrobe/browse-pool. This mirrors
origin/main:src/app.js:767:// World Admin routes (dashboard, decisions, browse-pool)
origin/main:src/routes/episodeOrchestrationRoute.js:10: * Beat 6 (Transformation Loop) is wired directly to the wardrobe browse-pool
origin/main:src/routes/wardrobe.js:1056:// POST /api/v1/wardrobe/browse-pool
origin/main:src/routes/wardrobe.js:1059:router.post('/browse-pool', requireAuth, async (req, res) => {
origin/main:src/routes/world.js:7: * POST /api/v1/world/:showId/browse-pool — Generate browse pool for an episode
origin/main:src/routes/world.js:159:// POST /api/v1/world/:showId/browse-pool
origin/main:src/routes/world.js:162:router.post('/world/:showId/browse-pool', requireAuth, async (req, res) => {
origin/main:src/services/wardrobeReach.js:6: * One rule, used by POST /wardrobe/browse-pool (each item's can_select /
origin/main:src/services/wardrobeReach.js:18: * (`req.body.reputation || 0`). browse-pool used `|| 1`, so with no
origin/main:src/utils/wardrobeSlots.js:7: * accessory, bag, outerwear, perfume) so filtering, browse-pool scoring, and
```

The one app call is the wardrobe route. `episodeOrchestrationRoute.js:10`
is a comment; that route inlines its own scoring over `game_wardrobe` and
makes no HTTP call. Only one of the two routes is live, so the
attribution moves; the two are not both instrumented (§4).

# §3. What the retarget note got wrong, and what it got right

**Wrong: the "stronger evidence" line.** The retarget note's §3 says
(`F-AUTH-1_G3Clause3_Retarget_2026-09-26.md:209–211`, at basis):

> What makes it stronger evidence is that its table exists in production.

The table does exist in production. That does not make the evidence
stronger, because **no production code path wrote to it with a user id**.
The substitution the note records (its §3 table, `:181`) put the
attribution on `POST /api/v1/world/:showId/browse-pool`
(`src/routes/world.js:162`, the logging call at `:253`, `user_id` at
`:258`). The app never calls that route (§2). The retargeted test proved
the write on an uncalled route in CI's schema. That has the same defect
as the evidence it replaced: it was never exercised against production.
**For the reader: the retarget note does not describe production-backed
attribution. Its substitution is superseded by §4 below.**

**Also incomplete: §1 row 7.** Row 7 says of the world route *"The only
caller is `world.js:253`"*. That is true of `logBrowsePoolGenerated`'s
caller. The note did not check whether anything called the route itself,
and nothing did.

**Right: "not exercised against production".** The same §3 says, in the
next sentence (`:211–212`): *"**It has not been exercised against
production.** That would be a live write by Evoni, and no agent session
performs one."* That was true and stays true. After Deploy AK Evoni did
exercise it, by loading the closet, and found `decision_log` empty (§1).
That observation is what exposed the wrong route.

**Unchanged:** the retarget note's §1 finding (no write-attribution path
existed anywhere at its basis), its §2 rulings as quoted, its §4 list of
superseded documents, and its §5 owed items. This note corrects only the
§3 substitution and the "stronger evidence" line.

# §4. The new substitution

| | Superseded (retarget note §3) | Now |
|---|---|---|
| Route | `POST /api/v1/world/:showId/browse-pool` (`src/routes/world.js:162`). Called only by tests. | `POST /api/v1/wardrobe/browse-pool` (`src/routes/wardrobe.js:1059`, `requireAuth`), called by the styling game's closet: `EpisodeWardrobeGameplay`'s `loadPool` (`frontend/src/components/EpisodeWardrobeGameplay.jsx:205`) |
| Write | `logBrowsePoolGenerated` call at `world.js:253`, `user_id: req.user.id` (`:258`) | new helper `recordBrowsePoolGenerated` in `src/routes/wardrobe.js`, called before both of the handler's pool responses (the empty-closet response at basis `:1113` and the pool response at basis `:1308`). It passes `user_id: req.user.id` with no fallback, the episode and show ids, `pool_size`, `total_items`, `has_wardrobe`, and `source: 'styling_game'`, to `DecisionLogger.logBrowsePoolGenerated` (`src/utils/decisionLogger.js:233`), then `INSERT INTO decision_log` (`:148`) |
| Table | `decision_log` | `decision_log`, unchanged (`user_id` uuid, nullable; created by the live migration `src/migrations/20260219000001-decision-log-browse-pool.js`) |
| Test | `tests/integration/f-auth-1-g3-clause3.test.js`, posting to the world route | the same file (filename kept; the Fix Plan revisions cite it by name), now posting the body `loadPool` sends to `POST /api/v1/wardrobe/browse-pool`, with the same three assertions read from the table |

`logBrowsePoolGenerated` gains an optional `source` parameter. It defaults
to `'evaluate_page'`, the label the world route has always written, so
that route's rows are unchanged. The wardrobe route passes
`'styling_game'`. The world route keeps its `user_id: req.user.id`; it is
not retired here (§6).

**The write is awaited, and it does not break the pool.** The row is
committed before the response is sent, so the integration test can read
it without a sleep. `DecisionLogger.log` already catches a failed INSERT.
Its log for that case is raised from `console.log('Decision buffered: …')`
(`src/utils/decisionLogger.js:119`) to `console.error`, and the message
now says the entry is lost if its per-request instance is discarded. The
route instances always are discarded. Anything else thrown while
recording is caught in `recordBrowsePoolGenerated` and logged with
`console.error`. In either case the pool response keeps its body and its
status.

The test and its results (it fails on the basis code and passes on the
change) are in the PR that carries this note. A register document records
what was ruled and found; the PR's CI run is the evidence of record.

# §5. Exercising it in production (NOT YET EXERCISED)

**Clause 3's evidence on the new route has not been exercised against
production.** It is exercised only when Evoni, after this change deploys:

1. opens the styling game's closet once while signed in (any episode's
   wardrobe step; that load is `POST /api/v1/wardrobe/browse-pool`), then
2. reads the newest row:
   `SELECT user_id, created_at, source FROM decision_log ORDER BY created_at DESC LIMIT 1;`
   and compares `user_id` with the `id` that `GET /api/v1/auth/me` returns
   for the same session.

A row with `source = 'styling_game'`, a `created_at` from the closet load
and `user_id` equal to `/auth/me`'s `id` is the production evidence. If
there is no row, or `user_id` is NULL, the substitution has failed again.
In that case the PM2 error log will carry a `[DecisionLogger] decision_log
write failed` or `[wardrobe] browse-pool decision_log write failed` line
giving the reason. Until Evoni runs this check, this note is in the same
standing as the retarget note: tested in CI's schema, not exercised in
production.

# §6. The world route: a proposal, not a ruling

`POST /api/v1/world/:showId/browse-pool` has no caller outside tests at
basis (§2), and the history shows it never had one:

- It was added in `f76d42e84` (2026-02-18, *"World Admin dashboard + Browse
  Pool + Decision Logger"*). The `WorldAdmin.jsx` added in the same commit
  calls only `/world/:showId/history` and `/world/:showId/decisions`:

  ```
  $ git show f76d42e84:frontend/src/pages/WorldAdmin.jsx | grep -n "browse\|/world/"
  72:        const histRes = await api.get(`/api/v1/world/${showId}/history`);
  78:        const decRes = await api.get(`/api/v1/world/${showId}/decisions`);
  ```

- The styling game was built one day later, in `832fb6723` (2026-02-19),
  and called `/api/v1/wardrobe/browse-pool` from its first version.
  Every commit that has added or removed the string `browse-pool` under
  `frontend/` concerns the wardrobe route or a comment:

  ```
  $ git log --format='%h %ad %s' --date=short -S "browse-pool" origin/main -- frontend
  76bffe6a1 2026-09-25 fix(wardrobe): the styling game shows the server's outfit score, draft and locked [skip-automerge] (#1952)
  2b2584fbd 2026-09-25 fix(wardrobe): the styling game offers, shows and locks only what Lala can wear [skip-automerge] (#1940)
  732246135 2026-09-25 fix(wardrobe): the episode styling game shows the real garment images [skip-automerge] (#1935)
  9ac19f536 2026-03-13 feat: major platform update — component restructuring, new agents, story health, relationship engine, feed pairing prep
  dd809f88f 2026-03-06 feat: StoryEvaluationEngine (light theme), evaluate endpoints, AssetLibraries, EpisodeOrchestration tabs, event generator route
  832fb6723 2026-02-19 feat: Episode Wardrobe Gameplay  browse-pool/select/purchase routes + Browse & Select tab in EpisodeDetail
  ```

  `832fb6723` adds the wardrobe call. `dd809f88f` adds, and `9ac19f536`
  removes, a doc comment in `EpisodeOrchestrationTab.jsx` (*"Beat 6
  wardrobe panel shows actual inventory items pulled from browse-pool"*).
  The other three are wardrobe-route fixes.

- **The `source: 'evaluate_page'` label is not evidence of a caller.**
  `EvaluateEpisode.jsx` has never contained `browse-pool`:

  ```
  $ git log --format='%h' -S "browse-pool" origin/main -- frontend/src/pages/EvaluateEpisode.jsx | wc -l
  0
  ```

  The label was hard-coded in `f76d42e84` into five of the logger's
  convenience methods at once (`src/utils/decisionLogger.js:184, 198, 244,
  259, 273` at basis). That looks like one label copied across the
  methods; nothing shows the evaluate page ever generating a browse pool
  (INFERRED from the history above).

**Proposal (for Evoni's ruling; nothing is retired here):** retire `POST
/api/v1/world/:showId/browse-pool` and the `src/utils/browsePoolGenerator.js`
it alone loads, and remove the two unit source-checks that name it. Its
`decision_log` write is the one #1950 instrumented. With the wardrobe route
now writing, it is a second writer that no user reaches. Keeping it costs
little at runtime (it stays auth-gated), but it is the kind of uncalled,
tested surface that misled #1950, and it keeps a second browse-pool
algorithm alive beside the one the game uses. The GET routes
`/world/:showId/decisions` and `/stats`, which Producer Mode reads, are
live and are not part of this proposal.

# §7. Owed, recorded not taken

- **Evoni:** the §5 production check after deploy, and the result as an
  attestation. Until then clause 3's evidence is still not exercised in
  production.
- **Evoni:** a ruling on the §6 proposal (retire or keep the world route).
- **Evoni (carried from the retarget note §5, unchanged):** whether v2.55
  §3's discharge stands on the evidence; what replaces the v1.5 steps that
  name `/decision-logs`; whether to add pointer banners. A pointer banner on
  the retarget note to this correction is also for her to decide. This
  filing adds none.
- **Visible side effect, recorded:** Producer Mode's decision list
  (`GET /world/:showId/decisions`, read by `WorldAdmin`) and `/stats` read
  `decision_log`. From deploy they show one `browse_pool_generated` row per
  closet load.

---

*Type: correction amendment and finding note. Records Evoni's attested
finding (§1), corrects the retarget note's §3 (§3), and records one
substitution (§4). Rules nothing of its own. Mints nothing: no FD, XK or
PE number, and no Fix Plan version. No host, AWS, database or Cognito
contact by the filing session, other than a throwaway local Postgres
cluster on the session's own container for the test run. Production's
freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still
never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Filing date: 2026-09-26. Basis: `origin/main` at
`7c7f8d4849e22f99e4d6f43b3f5840bbd83c85f8`. Task: #1954; cites #1950
(the retarget note) and #1942.*
