# F-Stats-1 Phase B — Reads Slice, Opened and Scoped

*Standalone note. Measurement only. Opens v1.49 §52.6's owed reads slice
and scopes it. Mints nothing, rules nothing, closes nothing, reads no site as
an instance.*

## Purpose

`F-Stats-1_Fix_Plan_v1.49.md` §52.6 recorded the reads slice as owed: a
survey of cross-tenant reads over the same route-file complement that §52's
destructive-write slice drew from. The 2026-09-10 owed-items note
(`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md`) lists it as Item 1 and marks
it AGENT-DOABLE. v1.60 records it as "neither opened nor scoped".

This note opens it the way v1.49 took its first bounded slice. It re-derives
the population, states one probe and what the probe misses, counts sites per
file, and names one file to read first. Closing the item still takes a Fix
Plan revision.

## H1 — Basis

```
$ git rev-parse origin/main
7a17a2e740b16ac145f84a5e98133a75e762be4b
```

MEASURED. Date: 2026-09-26. Every count below is at this SHA unless it names
v1.49's basis, `8c7d74af`.

## The obligation, quoted

**v1.49 §52.6** (`F-Stats-1_Fix_Plan_v1.49.md:198`), "The reads slice — owed,
and stated so it is not forgotten":

> "Rule 2 was chosen knowing what it misses. It finds unrecoverable writes and
> no reads at all."

> "`wardrobe.js:173` is a read, it is already a confirmed instance of this
> shape, and Rule 2 would never have found it — it surfaced from v1.47's SQL
> probe. Cross-tenant reads leak canon; they simply do not destroy it."

> "A reads slice over the same 120-file complement is owed."

**v1.49's revision-table row** (`:248`), in part: "§52.6: the reads slice is
owed and the trade is recorded — Rule 2 finds no reads, and `wardrobe.js:173`
is a read that is already an instance."

**The 2026-09-10 note, Item 1** (`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:58`):
v1.60 owes "the reads slice, owed since v1.49 §52.6 and neither opened nor
scoped"; "To close: open and survey the read-handler population across the
same route files Rule 2 already covers for writes — a repo grep/read
exercise, no live system contact." Marked AGENT-DOABLE.

## §1. The population, re-derived — MEASURED

v1.49 §52.1 gives its counts (142 route files, 22 carrying `:showId`, 120 in
the complement) but not the command. The method below reproduces all three at
v1.49's basis, and also reproduces v1.49 §52.2's destructive-write counts (91
in all, 78 in the complement, 13 in the `:showId` files). So this is v1.49's
population.

- **Route files:** every `.js` file under `src/routes/`, recursively,
  including `src/routes/memories/`. A top-level-only count gives 132 at
  `8c7d74af`, not 142.
- **Carrying `:showId`:** the file's text contains the string `:showId`.
- **Complement:** route files not carrying `:showId`.

```
$ for B in 8c7d74af 7a17a2e7; do
    git ls-tree -r --name-only $B src/routes | grep '\.js$' | sort > all_$B.txt
    : > show_$B.txt
    while read f; do git show $B:$f | grep -q ':showId' && echo $f >> show_$B.txt; done < all_$B.txt
    comm -23 all_$B.txt show_$B.txt > comp_$B.txt
    echo "$B total=$(wc -l < all_$B.txt) showId=$(wc -l < show_$B.txt) complement=$(wc -l < comp_$B.txt)"
    # v1.49 §52.2's probe, as a check on the method
    tot=0; cmp=0
    while read f; do n=$(git show $B:$f | grep -cE '\.destroy\(|DELETE FROM'); tot=$((tot+n)); done < all_$B.txt
    while read f; do n=$(git show $B:$f | grep -cE '\.destroy\(|DELETE FROM'); cmp=$((cmp+n)); done < comp_$B.txt
    echo "  destroy/DELETE lines: all=$tot complement=$cmp showId=$((tot-cmp))"
  done
8c7d74af total=142 showId=22 complement=120
  destroy/DELETE lines: all=91 complement=78 showId=13
7a17a2e7 total=142 showId=23 complement=119
  destroy/DELETE lines: all=91 complement=78 showId=13
```

| | v1.49 (`8c7d74af`) | Today (`7a17a2e7`) |
| --- | --- | --- |
| Route files | 142 | 142 |
| Carrying `:showId` | 22 | 23 |
| **Complement** | **120** | **119** |

**The difference, by file:**

```
$ comm -13 all_8c7d74af.txt all_7a17a2e7.txt     # added since v1.49
src/routes/eventDeliverables.js
$ comm -23 all_8c7d74af.txt all_7a17a2e7.txt     # removed since v1.49
src/routes/decisionLogs.js
$ diff show_8c7d74af.txt show_7a17a2e7.txt
4a5
> src/routes/eventDeliverables.js
```

`decisionLogs.js` was in the complement and no longer exists.
`eventDeliverables.js` is new and carries `:showId`, so it joins the 23, not
the complement. Net: 142 files, one more `:showId` file, one fewer complement
file.

**v1.49's exclusions, kept** (per v1.44 §47.2: these domains sit above show
partitioning, and probing them would manufacture findings). All four are
still in the complement today:

- `worldStudio.js`
- `characterRegistry.js`
- `universe.js`
- `relationships.js`

They are counted in §3's table, so the totals match the population, and
marked there. They are not candidates for any slice.

## §2. The probe — stated, with what it misses

The target is **a read that fetches rows by a caller-supplied identifier**.
No line-based probe can tell whether an identifier came from the caller;
that is decided by reading the handler. So the probe has two parts:

- **Read sites (the probe).** Any line that starts a row read:
  - an ORM read: `\.(findByPk|findOne|findAll|findAndCountAll)\(`;
  - a raw SQL read: `\bSELECT\b`, excluding lines matching
    `QueryTypes\.SELECT` (a `{ type: …QueryTypes.SELECT }` option line
    belongs to a query already counted by its `SELECT` text; counting it
    would double-count).
- **A floor, not a result.** The subset of those lines that name
  `req\.(params|body|query)` on the same line, for example
  `findByPk(req.params.id)` or `where: { id: req.body.id }`.

```
ORM='\.(findByPk|findOne|findAll|findAndCountAll)\('
SQL='\bSELECT\b'
QT='QueryTypes\.SELECT'
REQ='req\.(params|body|query)'
# per file f in the complement, at B=7a17a2e7:
#   orm    = git show $B:$f | grep -cE "$ORM"
#   select = git show $B:$f | grep -E "$SQL" | grep -vcE "$QT"
#   req    = git show $B:$f | grep -E "$ORM|$SQL" | grep -vE "$QT" | grep -cE "$REQ"
```

**What the probe misses, plainly:**

- **Reads through helpers.** A handler that passes `req.params.id` into a
  helper, or into a service outside `src/routes/`, has its read counted only
  if the helper is in the same file. Reads in services are not in the
  population at all. The same-line `req.*` column misses the helper case
  every time: the identifier arrives as a function argument.
- **Identifiers built indirectly.** The common idiom
  `const { id } = req.params` followed later by `findByPk(id)` is counted as
  a read site but not in the `req.*` column, because `req` is on another
  line. So the `req.*` column is a floor, not an estimate.
- **Multi-line reads.** A read counts once, on the line that starts it. A
  `where` clause split over several lines is still one site, but the
  `req.*` column sees only the first line.
- **Other read forms.** `.count(`, `.findOrCreate(`, `.max(`, `.sum(`,
  association getters (`episode.getScenes()`) and `scope`d finders are not
  counted.
- **False positives.** `SELECT` in a comment or a prompt string counts as a
  site. A subquery counts again only if its `SELECT` is on its own line.

**Not a claim about tenancy.** A counted site is a read, not an instance.
Whether it is scoped to the caller's tenant is decided only by reading it.

## §3. Sites per file, over the complement — MEASURED

At `7a17a2e7`, over the 119 complement files. Columns: file (under
`src/routes/`), ORM reads, raw SELECTs, total, and the same-line `req.*`
floor. Sorted by total. The four v1.44 §47.2 exclusions are included, so the
totals cover the whole population: `worldStudio.js`,
`characterRegistry.js`, `relationships.js` and `universe.js`.

```
sceneSetRoutes.js                              71    3    74   42
worldStudio.js                                 15   59    74   15
memories/engine.js                             66    0    66    0
socialProfileRoutes.js                         65    0    65   16
characterRegistry.js                           41    2    43   19
storyteller.js                                 43    0    43   18
memories/assistant.js                           0   42    42    0
tierFeatures.js                                39    3    42    5
storyEvaluationRoutes.js                       38    2    40    2
storyHealth.js                                  0   26    26    0
relationships.js                                0   24    24    0
compositions.js                                20    1    21    2
stories.js                                     21    0    21   13
episodes.js                                    18    1    19    7
calendarRoutes.js                              15    1    16    8
franchiseBrainRoutes.js                        16    0    16    6
upgradeRoutes.js                               16    0    16    2
memories/core.js                               15    0    15    0
continuityEngine.js                            14    0    14   10
episodeBriefRoutes.js                          14    0    14    1
novelIntelligenceRoutes.js                     14    0    14    3
wardrobeLibrary.js                             13    1    14    0
sceneProposeRoute.js                           13    0    13    3
feedRelationshipRoutes.js                      12    0    12    3
layers.js                                      12    0    12    0
aiUsageRoutes.js                                1    9    10    0
amberDiagnosticRoutes.js                       10    0    10    3
entanglementRoutes.js                          10    0    10    6
memories/voice.js                              10    0    10    0
templateStudio.js                               0   10    10    0
characterAI.js                                  9    0     9    0
characterGenerationRoutes.js                    9    0     9    3
footage.js                                      8    1     9    0
wardrobeBrands.js                               9    0     9    0
propertyRoutes.js                               8    0     8    4
animatic.js                                     7    0     7    0
episodeScriptWriterRoutes.js                    7    0     7    2
press.js                                        7    0     7    0
sceneLinks.js                                   7    0     7    0
textureLayerRoutes.js                           7    0     7    0
amberSessionRoutes.js                           4    2     6    0
characterCrossingRoutes.js                      6    0     6    3
characterFollowRoutes.js                        6    0     6    0
characterGrowthRoute.js                         6    0     6    1
memories/interview.js                           6    0     6    1
scenes.js                                       0    6     6    0
todoListRoutes.js                               0    6     6    0
universe.js                                     6    0     6    4
auditLogs.js                                    5    0     5    0
cfoAgentRoutes.js                               0    5     5    0
characterDepthRoutes.js                         5    0     5    4
characterGenerator.js                           4    1     5    0
generate-script-from-book.js                    5    0     5    0
memories/extras.js                              4    1     5    0
socialProfileBulkRoutes.js                      5    0     5    3
assets.js                                       4    0     4    0
characterSparkRoute.js                          4    0     4    3
decisions.js                                    4    0     4    1
hairLibraryRoutes.js                            4    0     4    3
imageProcessing.js                              4    0     4    0
makeupLibraryRoutes.js                          4    0     4    3
scriptParse.js                                  4    0     4    0
templates.js                                    4    0     4    0
therapy.js                                      4    0     4    0
undergroundRoutes.js                            4    0     4    1
admin.js                                        0    3     3    0
authorNoteRoutes.js                             3    0     3    2
consciousness.js                                3    0     3    1
episodeOrchestrationRoute.js                    0    3     3    0
eventGeneratorRoute.js                          1    2     3    0
export.js                                       0    3     3    0
lala-scene-detection.js                         3    0     3    2
mirrorFieldRoutes.js                            3    0     3    2
scriptAnalysis.js                               1    2     3    0
session.js                                      3    0     3    0
characters.js                                   2    0     2    1
thumbnailTemplates.js                           2    0     2    0
timelineData.js                                 2    0     2    0
wantFieldRoutes.js                              2    0     2    2
youtube.js                                      1    1     2    0
arcTrackingRoutes.js                            1    0     1    0
feedSchedulerRoutes.js                          1    0     1    0
manuscript-export.js                            1    0     1    0
memories/helpers.js                             1    0     1    0
pageContent.js                                  1    0     1    0
```

| | Files | ORM | SELECT | **Total** | `req.*` same line |
| --- | --- | --- | --- | --- | --- |
| Complement, with ≥ 1 site | 85 | 833 | 220 | **1,053** | 230 |
| Complement, excluding the four | 81 | 771 | 135 | **906** | 192 |

34 of the 119 complement files have no site.

**The distribution is long-tailed**, as v1.49 §52.2 found for destructive
writes. Two files not excluded carry 74 and 66 sites (`sceneSetRoutes.js`,
`memories/engine.js`). 37 files carry 5 or fewer. **At 906 sites outside the
exclusions, the reads slice is a program, not a session**, which is what v1.49
§52.1 said of 120 files for the destructive-write shape.

## §4. `wardrobe.js:173` — resolved at its basis and traced

§52.6's line number is at v1.49's basis. It is the same line at v1.47's
basis, `2d45b6d1`, where v1.47 §50 first recorded it:

```
$ git show 8c7d74af:src/routes/wardrobe.js | sed -n 161,175p
router.get('/outfit-score/:episodeId', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not available' });

    // Get the episode's event context from world_events
    const [episodes] = await models.sequelize.query(
      `SELECT e.*, we.name as event_name, we.event_type, we.dress_code,
              we.dress_code_keywords, we.prestige, we.strictness, we.host_brand
       FROM episodes e
       LEFT JOIN world_events we ON we.used_in_episode_id = e.id
       WHERE e.id = :episodeId`,
      { replacements: { episodeId } }
    );
```

**At `8c7d74af`, `:173` is `WHERE e.id = :episodeId`** in a raw SELECT in
`GET /outfit-score/:episodeId`. The id comes from `req.params` two statements
earlier.

**Today the site has moved.** #1952 (`76bffe6a`, "the styling game shows the
server's outfit score, draft and locked") removed that query and moved the
episode read into a helper in the same file:

```
$ git log --oneline -S"WHERE e.id = :episodeId" 8c7d74af..7a17a2e7 -- src/routes/wardrobe.js
76bffe6a fix(wardrobe): the styling game shows the server's outfit score, draft and locked [skip-automerge] (#1952)
$ git show 7a17a2e7:src/routes/wardrobe.js | sed -n '207p;213,215p;264,271p'
async function scoreEpisodeOutfitForDisplay(models, { episodeId, eventId = null, pieceIds = null }) {
  const [episodes] = await sequelize.query(
    'SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId } }
router.get('/outfit-score/:episodeId', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const eventId = typeof req.query.event_id === 'string' && req.query.event_id ? req.query.event_id : null;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not available' });

    const { status, body } = await scoreEpisodeOutfitForDisplay(models, { episodeId, eventId });
```

The read is now `wardrobe.js:214`, inside `scoreEpisodeOutfitForDisplay`
(`:207`). The handler at `:264` passes it `req.params.episodeId`. The query
now also selects `show_id`. Whether the helper checks it against the caller
is not read here.

**Does the probe find it?**

```
$ for B in 8c7d74af 7a17a2e7; do echo "-- $B"; git show $B:src/routes/wardrobe.js \
    | grep -nE "$ORM|$SQL" | grep -vE "$QT" | awk -F: '$1>=160 && $1<=260'; done
-- 8c7d74af
169:      `SELECT e.*, we.name as event_name, we.event_type, we.dress_code,
-- 7a17a2e7
214:    'SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
248:    `SELECT w.id, w.name
```

- **The probe finds the site** when run on `wardrobe.js`: at `:169` (the line
  the statement starts on; `:173` is its `WHERE`) at v1.49's basis, and at
  `:214` today.
- **The same-line `req.*` floor misses it at both bases.** At `8c7d74af` the
  id is destructured two lines up. Today it arrives as a helper argument.
  This is §2's two blind spots in one site.
- **The probe over the complement never reaches it.** See §5.

## §5. A divergence: `wardrobe.js` is not in the complement

`wardrobe.js` carries `:showId` at v1.49's basis (`GET /outfit-history/:showId`,
`:1578` there) and today (`:1989`). It is one of the 22, and now the 23:

```
$ grep -c 'src/routes/wardrobe.js' show_8c7d74af.txt show_7a17a2e7.txt
show_8c7d74af.txt:1
show_7a17a2e7.txt:1
```

So **the one read instance §52.6 cites sits outside the 120-file population
§52.6 names for the reads slice.** A reads slice over the complement, as
written, cannot find it. File membership is decided by whether a file carries
`:showId` anywhere, not per handler; `GET /outfit-score/:episodeId` carries
no scope parameter even though its file does.

v1.47 §50 held `wardrobe.js:173` "SEPARATE and not counted" from XK-2, as a
handler with no scope parameter at any layer. **This note takes no position**
on whether the reads slice's population should be the complement as §52.6
says, per handler rather than per file, or all 142 files. That is a question
for the Fix Plan revision that rules on the slice. Recorded, not resolved.

## §6. The first bounded slice: `episodes.js`

**Named: `src/routes/episodes.js`.** 19 read sites (18 ORM, 1 SELECT); 7 name
`req.*` on the same line. At `7a17a2e7` the file has 1,380 lines.

**Why this file:**

- **The two slices meet on one file.** v1.49's destructive-write slice read
  `episodes.js` first (3 sites, 3 instances, including `:239`, "the sharpest
  instance in either shape"). Reading its reads next gives the first file
  where both slices can be compared.
- **Its mount was verified at v1.49's basis.** v1.49 §52.5 recorded
  `src/app.js:634` as a bare mount for `episodes.js`, at `8c7d74af`. A guard
  at the mount would invalidate instances, so this precondition was already
  checked once. It must be re-verified at the reading's own basis. It is not
  re-verified here.
- **The episode carries the tenant.** Episodes belong to a show (`show_id`),
  so a read by caller-supplied episode id is the plainest form of the shape.
- **19 sites is a single session.** The larger non-excluded files
  (`sceneSetRoutes.js` at 74, `memories/engine.js` at 66,
  `socialProfileRoutes.js` at 65) are not a first slice.

**Its sites are not read here.** Reading them as instances, or as scoped, is
the next task.

## What this document does not do

- Mints no FD, XK or PE.
- Rules nothing. Closes nothing: the reads slice stays owed until a Fix Plan
  revision rules on it.
- Reads no site as an instance, or as scoped. A counted site is a read, not a
  finding.
- Does not resolve §5's divergence (`wardrobe.js` outside the complement).
- Does not read `scoreEpisodeOutfitForDisplay`'s use of `show_id`.
- Does not re-verify `episodes.js`'s mount at this basis.
- Does not probe services outside `src/routes/`.
- Does not edit any filed document.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito
  or GitHub-settings contact.

## Footer

**Type:** standalone scoping note. **Rules:** nothing. **Mints:** nothing — no
FD, no XK, no PE. **Host/AWS/DB contact:** none. Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts,
AWS, RDS or Cognito (`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-26. Basis: `origin/main` at `7a17a2e740b16ac145f84a5e98133a75e762be4b`.*
*Authority: `F-Stats-1_Fix_Plan_v1.49.md` §52 and the 2026-09-10 owed-items
note, read directly. Every count MEASURED at the basis above or at
`8c7d74af` where named. Task: #1998.*
