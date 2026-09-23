# F-AUTH-1 — CP6's Item 16 lock and the author-field read gap, MEASURED

**Basis:** `origin/main` at `d5bc5ea9695956ec349328715a69f305f684e0e1` (2026-09-23),
the squash merge of #1700.

**Standing:** MEASURED for every claim read directly from the repository at
this basis. Each carries the command and its raw output, verbatim. Where a
block shows fewer lines than the file holds, the exact range is the command
shown. ATTESTED for the one claim taken from a GitHub issue's text rather
than the repository (§4), labelled at the point made. Nothing here is
INFERRED or RULED.

**What this is.** An evidence note. It records that a structural test lock
from F-AUTH-1 Step 3 CP6 changed, and two places where the filed CP6 record
describes code differently from how the code behaves. It rules nothing,
amends nothing, adds no banner, mints nothing, and edits no filed document
(§6).

Task: #1701. No host, AWS, database, or Cognito contact.

---

## 1. The CP6 structural lock changed — MEASURED

`tests/unit/routes/character-registry-tier-promotion.test.js` is the CP6
structural test for `src/routes/characterRegistry.js`. Two of its locked
assertions changed in one commit, #1700, the basis commit:

```
$ git log --format='%h %ad %s' --date=short -- tests/unit/routes/character-registry-tier-promotion.test.js
d5bc5ea96 2026-09-23 fix(auth): role checks read Cognito groups [skip-automerge] (#1700)
9c5eaa588 2026-05-08 Dev (#652)
```

```
$ git show d5bc5ea9 --stat --format='%h %s' -- tests/unit/routes/character-registry-tier-promotion.test.js
d5bc5ea96 fix(auth): role checks read Cognito groups [skip-automerge] (#1700)

 tests/unit/routes/character-registry-tier-promotion.test.js | 8 ++++++--
 1 file changed, 6 insertions(+), 2 deletions(-)
```

**Before** — at `39eca65a`, the parent of the basis commit:

```
$ git show 39eca65a:tests/unit/routes/character-registry-tier-promotion.test.js | grep -nE "requireAuth.s.*.}|isAuthor.s.*=" 
19:    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
63:      expect(SRC).toMatch(/isAuthor\s*=\s*req\.user\?\.role\s*===\s*'author'/);
```

**After** — at the basis:

```
$ grep -nE "requireAuth.s.*,.s.*userInGroup|isAuthor.s.*=|not.toMatch\(/req" tests/unit/routes/character-registry-tier-promotion.test.js
20:    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*,\s*userInGroup\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
66:      expect(SRC).toMatch(/isAuthor\s*=\s*userInGroup\(req\.user,\s*'admin'\)/);
67:      expect(SRC).not.toMatch(/req\.user\??\.role/);
```

| Lock | Before (`39eca65a`) | After (basis) |
|---|---|---|
| auth import | `{ requireAuth }` | `{ requireAuth, userInGroup }` |
| "Item 16 inspection" author check | `isAuthor = req.user?.role === 'author'` | `isAuthor = userInGroup(req.user, 'admin')` |
| added | — | no `req.user.role` / `req.user?.role` anywhere in the file |

The source line the lock tracks, before and after:

```
$ git show 39eca65a:src/routes/characterRegistry.js | sed -n '643,644p'
    // Filter author-only fields for non-author requests
    const isAuthor = req.user?.role === 'author' || req.user?.role === 'admin';
```

```
$ sed -n '643,652p' src/routes/characterRegistry.js
    // Filter author-only fields unless the caller is in the Cognito admin group.
    // req.user carries groups, never a role; there is no 'author' group.
    const isAuthor = userInGroup(req.user, 'admin');
    const filteredAllowed = isAuthor ? allowed : allowed.filter(f => !AUTHOR_ONLY.includes(f));

    filteredAllowed.forEach(f => { if (req.body[f] !== undefined) character[f] = req.body[f]; });
    await character.save();

    return res.json({ success: true, character });
  } catch (err) {
```

### 1a. The filed document this lock corresponds to — MEASURED

Only one filed document carries the CP6 inspection block. The search reads
the basis tree, so it covers the register as filed and not this note:

```
$ git grep -l "Item 16 escalation inspection result" d5bc5ea9 -- docs/audit
d5bc5ea9:docs/audit/F-AUTH-1_Fix_Plan_v2.37.md
```

```
$ grep -n "^### \*\*§5.48\|^### \*\*§5.51\|^Item 16 escalation inspection result" docs/audit/F-AUTH-1_Fix_Plan_v2.37.md
3174:### **§5.48 — CP6 closure: Character cluster + universe Q13 (LOCKED v2.31, COMPLETE)**
3238:Item 16 escalation inspection result (per D6 lock — "no-escalation" first-time result):
3309:### **§5.51 — Item 16 response-shape vs permission-gate distinction (NEW v2.31)**
```

The section that quotes the old line word for word is **§5.48**, in its
"Item 16 escalation inspection result" block:

```
$ sed -n '3238,3244p' docs/audit/F-AUTH-1_Fix_Plan_v2.37.md
Item 16 escalation inspection result (per D6 lock — "no-escalation" first-time result):

- characterRegistry.js:658 — `const isAuthor = req.user?.role === 'author' || req.user?.role === 'admin'` is field-level filtering inside the handler body to decide which fields to return after a successful update. Both authors AND admins (and presumably any other authenticated user) are permitted to perform the update; only the response shape differs. NOT a permission gate. → Tier 1 default; no Tier 2 escalation needed.

- characterDepthRoutes.js:88 — `function isAuthor(req) { return !!req.user; }` — used inside stripAuthorFields() for response-shape filtering, identical pattern. → Tier 1 default; no Tier 2 escalation needed.

- No authorize(['ADMIN']) calls added anywhere in CP6. Tier 2 disposition not invoked.
```

**§5.51** builds its general distinction on that disposition (§2 below
quotes it; §4 relies on it).

Both sections carry "v2.31" in their headings. The `git grep -l` above shows
v2.37 is the only filed document that carries the block. This note does not
establish whether a separate v2.31 file ever existed.

### 1b. The CP6 confirmation document does not cover this check — MEASURED

`F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md` confirms CP6's handler
counts for this file, but never mentions the `isAuthor` check or Item 16:

```
$ sed -n '110,111p' docs/audit/F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md
| 3 | `characterRegistry.js` | Tier 1 PROMOTE | 36 |
| 4 | `characterRegistry.js` | PRESERVE @ L1882 (Tier 1 + `aiRateLimiter`) | 1 |
```

```
$ grep -cE "isAuthor|Item 16" docs/audit/F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md
0
```

---

## 2. First mismatch: the filed record says "response", the code shapes the write — MEASURED

§5.48 (quoted in §1a) describes the registry check as deciding "which fields
to return after a successful update … only the response shape differs".
§5.51 files the same pattern as "Response-shape filtering":

```
$ sed -n '3309,3315p' docs/audit/F-AUTH-1_Fix_Plan_v2.37.md
### **§5.51 — Item 16 response-shape vs permission-gate distinction (NEW v2.31)**

CP6 D6 inspection produced first-time "no-escalation" result for Item 16 candidates. Architectural distinction locked:

- Permission gate (requires Tier 2 — requireAuth + authorize(['ADMIN'])): handler body refuses to proceed unless req.user has specific role. Pattern: `if (!req.user.groups.includes('ADMIN')) return 403;` OR `if (req.user.role !== 'admin') return 403;` — explicit gating logic that returns non-2xx response based on req.user state.

- Response-shape filtering (Tier 1 sufficient — post-promotion always-resolved): handler body proceeds for all authenticated users; req.user.role / req.user.groups inspection is used only to decide which fields to include in 2xx response (e.g., admins get audit fields, authors get author-only fields, others get baseline fields). Pattern: `const isAuthor = req.user?.role === 'author'; const fields = isAuthor ? AUTHOR_FIELDS : BASELINE_FIELDS;` — response-shape selection, NOT access control.
```

In the code, the check decides which **request fields are written to the
row**, not which fields the response contains:
- `filteredAllowed` is the list of body fields copied onto `character`
  before `character.save()`.
- The handler then returns the whole `character` to every caller, with
  `res.json({ success: true, character })`.

This was true before and after #1700; only the test on `isAuthor` changed.
See §1, `sed -n '643,652p' src/routes/characterRegistry.js`, which is
`PUT /characters/:id`:

```
$ grep -n "router.put('/characters/:id'" src/routes/characterRegistry.js
543:router.put('/characters/:id', requireAuth, express.json(), async (req, res) => {
```

### 2a. Does anything strip the four fields on the way out? — MEASURED: nothing does

The four author-only fields are `de_blind_spot`, `de_blind_spot_evidence`,
`de_blind_spot_crack_condition` and `de_actual_narrative_gap`. The model
lists them in `AUTHOR_ONLY_FIELDS`, with the comment "never returned to
non-author clients". But the model has no `toJSON`, scope, exclusion or hook
that applies that list. It only defines the list and exports it:

```
$ grep -nE "toJSON|defaultScope|addScope|scopes|afterFind|attributes: \{ exclude|AUTHOR_ONLY_FIELDS" src/models/RegistryCharacter.js
12:const AUTHOR_ONLY_FIELDS = [
659:  RegistryCharacter.AUTHOR_ONLY_FIELDS = AUTHOR_ONLY_FIELDS;
664:module.exports.AUTHOR_ONLY_FIELDS = AUTHOR_ONLY_FIELDS;
```

The only code in `src` that uses the list is `characterDepthRoutes.js`. The
registry handler never uses it; its own `AUTHOR_ONLY` array filters the write
only (§2):

```
$ grep -rn "AUTHOR_ONLY_FIELDS\|stripAuthorFields" src --include=*.js
src/models/RegistryCharacter.js:12:const AUTHOR_ONLY_FIELDS = [
src/models/RegistryCharacter.js:659:  RegistryCharacter.AUTHOR_ONLY_FIELDS = AUTHOR_ONLY_FIELDS;
src/models/RegistryCharacter.js:664:module.exports.AUTHOR_ONLY_FIELDS = AUTHOR_ONLY_FIELDS;
src/routes/characterDepthRoutes.js:28:const { AUTHOR_ONLY_FIELDS } = require('../models/RegistryCharacter');
src/routes/characterDepthRoutes.js:75:function stripAuthorFields(obj) {
src/routes/characterDepthRoutes.js:77:  for (const field of AUTHOR_ONLY_FIELDS) {
src/routes/characterDepthRoutes.js:219:    const result = isAuthor(req) ? depth : stripAuthorFields(depth);
src/routes/characterDepthRoutes.js:275:      depth: isAuthor(req) ? depth : stripAuthorFields(depth),
src/routes/characterDepthRoutes.js:422:      depth: isAuthor(req) ? depth : stripAuthorFields(depth),
```

No application-level serializer or middleware touches these fields:

```
$ grep -rnE "de_blind_spot|de_actual_narrative_gap" src/app.js src/middleware
(exit 1)
```

The only `res.json` override in `src` is `captureResponseData` in
`src/middleware/auditLog.js`, mounted app-wide at `src/app.js:249`. It records
the payload and passes it through unchanged:

```
$ grep -rnE "json replacer|res\.json\s*=|addHook\(|sequelize\.addHook|toJSON\s*=|prototype\.toJSON" src --include=*.js
src/middleware/auditLog.js:90:  res.json = function (data) {
src/services/episodeGeneratorService.js:456:  const eventData = typeof event.toJSON === 'function' ? event.toJSON() : event;
src/models/TimelineData.js:93:  TimelineData.prototype.toJSON = function () {
src/models/Scene.js:511:  Scene.prototype.toJSON = function () {
src/models/Show.js:176:  Show.prototype.toJSON = function () {
src/models/EpisodeTemplate.js:446:  EpisodeTemplate.prototype.toJSON = function () {
src/models/EpisodeAsset.js:137:  EpisodeAsset.prototype.toJSON = function () {
src/models/TimelinePlacement.js:309:  TimelinePlacement.prototype.toJSON = function () {
```

```
$ sed -n '87,96p' src/middleware/auditLog.js
const captureResponseData = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    res.locals.responseData = data?.data || data;
    return originalJson.call(this, data);
  };

  next();
};
```

`RegistryCharacter` is not among the models that override `toJSON`. **Neither
the model nor the handler, nor any middleware, strips the four author-only
fields from the `PUT /characters/:id` response.**

---

## 3. Consequence, as measured fact — MEASURED

On `PUT /api/v1/character-registry/characters/:id` (mounted at
`src/app.js:958`, behind `requireAuth`), the four author-only fields have no
read restriction. Any signed-in caller who reaches the handler receives them
in the response, whatever their Cognito groups, and whatever the
write-filter check decided about the request body. This records what the
code does. It does not rule on whether it should.

```
$ grep -n "app.use('/api/v1/character-registry'" src/app.js
958:  app.use('/api/v1/character-registry', characterRegistryRoutes);
1030:  app.use('/api/v1/character-registry', characterSparkRoute);
```

**The separate depth-route finding, by citation.** The description of #1700
("For the register — authorization gap, out of scope here") records that
`characterDepthRoutes`' `isAuthor(req)` returns `!!req.user`. It says this
lets any signed-in user read and write the four author-only fields through
that route's `GET /:charId`, `PUT /:charId`, `POST /:charId/generate` and
`POST /:charId/confirm`. That finding is cited here, not re-derived. This
note measures only the function itself and its three call sites at the
basis (the call sites are the `stripAuthorFields` lines in §2a):

```
$ grep -nE "function isAuthor|return !!req.user" src/routes/characterDepthRoutes.js
83:function isAuthor(req) {
84:  return !!req.user;
```

§5.48 (quoted in §1a) filed this function as "response-shape filtering,
identical pattern".

---

## 4. Second mismatch: §5.51's permission-gate pattern and where the fix put it — MEASURED, plus one ATTESTED claim

§5.51 (quoted in §2) names `if (req.user.role !== 'admin') return 403;` as the
pattern of a **permission gate**, one that "requires Tier 2 — requireAuth +
authorize(['ADMIN'])", which puts the admin check on the route.

`searchController.reindexActivities` carried exactly that pattern before
#1700:

```
$ git show 39eca65a:src/controllers/searchController.js | sed -n '574,577p'
exports.reindexActivities = async (req, res) => {
  try {
    // Check admin role (adjust based on your auth implementation)
    if (req.user?.role !== 'admin') {
```

At the basis the check is still inside the handler, now reading the Cognito
group. The route still carries `requireAuth` only, with no
`authorize(['ADMIN'])`:

```
$ sed -n '575,586p' src/controllers/searchController.js
exports.reindexActivities = async (req, res) => {
  try {
    // Admin only: req.user carries Cognito groups, never a role
    if (!userInGroup(req.user, 'admin')) {
      logger.warn('Unauthorized reindex attempt', { userId: req.user?.id });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only admins can reindex activities',
      });
    }

```

```
$ grep -nE "reindex" src/routes/search.js
56: * POST /api/v1/search/reindex
60:router.post('/reindex', requireAuth, searchController.reindexActivities);
```

**ATTESTED** (from GitHub, not the repository): the task that produced #1700,
issue #1699, set the scope. Its "Do not" line reads "change authorize(),
requireGroup(), rbac.js, or any route mounting". So the fix stayed in the
handler.

Both facts are recorded as they stand: the filed §5.51 names the route as
this pattern's place, and the code keeps it in the handler. This note does
not rule on which should hold.

---

## 5. Re-derived instruments — MEASURED

```
$ git rev-parse origin/main
d5bc5ea9695956ec349328715a69f305f684e0e1
```

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
d5bc5ea9695956ec349328715a69f305f684e0e1 2026-09-23 fix(auth): role checks read Cognito groups [skip-automerge] (#1700)
```

Every other count in this note is a command above with its output. None is
carried from a pull request's description.

---

## 6. What this note does not do

- **No amendment.** `F-AUTH-1_Fix_Plan_v2.37.md` §5.48 and §5.51, and
  `F-AUTH-1_Limb1_CP6_Confirmation_2026-09-02.md`, are neither edited nor
  superseded. This is not a Fix Plan revision.
- **No banner** is prepended to any filed document.
- **No ruling** on whether §5.48 or §5.51 should be corrected, whether the
  registry `PUT` response should strip the four fields, whether
  `characterDepthRoutes`' `isAuthor` should change, or whether
  `reindexActivities`' check belongs on the route.
- **No fix.** No code, test, route or data changes.
- **Nothing minted.** No FD, XK or PE number.

An amendment to the Fix Plan, or a banner on the sections this note
measures, may be owed. That is Evoni's to direct.

---

## Footer

- **Type:** standalone evidence note (MEASURED), F-AUTH-1 family.
- **Rules:** nothing.
- **Mints:** nothing — no FD, XK, or PE.
- **Host / AWS / database / Cognito contact:** none. Every claim above reads
  this repository at the basis, except the one ATTESTED line in §4, which
  quotes GitHub issue #1699.
- **Production:** production's freeze is lifted
  (`F-Deploy-1_Fix_Plan_v1.53.md` §1). Agent sessions still never touch
  hosts, AWS, RDS, or Cognito (`CLAUDE.md`), unchanged by that lift or by
  this note.
