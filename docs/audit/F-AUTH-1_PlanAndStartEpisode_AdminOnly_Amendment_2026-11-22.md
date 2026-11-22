| **PRIME STUDIOS** **F-AUTH-1 — THE PRODUCTION PLAN AND START EPISODE ARE AN ADMIN'S (AMENDMENT)** *Twenty write routes that change an episode's brief, its beat plan, or start, replace, attach or detach an episode from an event answered any signed-in account. By Evoni's decisions of 2026-11-22 they need a sign-in in the admin group. The general event save stays any signed-in account's, except for the two of its fields that reach an episode; and the title-overlay route's clearing of a stale episode link is an admin's.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `7c5ebf93c72f769ac29eac5c79b9b95cf37a3948` (2026-11-22), plus branch `claude/p1-plan-start-admin`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or its `file:line` at the basis); INFERRED (marked where used).

---

# §1. What is amended

## The routes as they stood (MEASURED)

```
$ git show origin/main:src/routes/episodeBriefRoutes.js | grep -n "^router\.\(put\|post\)" | grep -v "performance-clips\|dressed-angles\|generate-script\|regenerate-beat\|rewrite-line"
102:router.put('/:episodeId', requireAuth, async (req, res) => {
205:router.put('/:episodeId/cover-marks', requireAuth, async (req, res) => {
250:router.put('/:episodeId/self-talk', requireAuth, async (req, res) => {
269:router.post('/:episodeId/lock', requireAuth, async (req, res) => {
283:router.post('/:episodeId/generate-plan', requireAuth, aiRateLimiter, async (req, res) => {
440:router.post('/:episodeId/feed-moments/retry', requireAuth, async (req, res) => {
453:router.put('/:episodeId/plan/:beatNumber', requireAuth, async (req, res) => {
629:router.post('/:episodeId/plan/:beatNumber/lock', requireAuth, async (req, res) => {
645:router.post('/:episodeId/plan/lock-all', requireAuth, async (req, res) => {
657:router.post('/:episodeId/setup/resume', requireAuth, async (req, res) => {
```

The other ten, at the basis:

| Route (under `/api/v1`) | `file:line` at the basis | Middleware at the basis |
| --- | --- | --- |
| `PUT /scene-studio-episodes/:episodeId/beat/:beatNumber/angle` | `src/routes/sceneStudioEpisodeRoutes.js:122` | `requireAuth` |
| `PUT /scene-studio-episodes/:episodeId/beat/:beatNumber/scene-set` | `src/routes/sceneStudioEpisodeRoutes.js:172` | `requireAuth` |
| `POST /world/:showId/events/:eventId/generate-episode` | `src/routes/worldEvents/episodeGenerate.js:30` | `requireAuth, aiRateLimiter` |
| `POST /world/:showId/events/generate-episode-from-many` | `src/routes/worldEvents/episodeBatch.js:45` | `requireAuth, aiRateLimiter` |
| `POST /world/:showId/events/:eventId/regenerate-episode` | `src/routes/worldEvents/episodeBatch.js:253` | `requireAuth, aiRateLimiter` |
| `POST /world/:showId/events/:eventId/inject` | `src/routes/worldEvents/inject.js:119` | `requireAuth` |
| `POST /world/:showId/events/:eventId/scene-set-link` | `src/routes/worldEvents/inject.js:309` | `requireAuth` |
| `POST /world/:showId/events/:eventId/detach-episode` | `src/routes/worldEvents/inject.js:355` | `requireAuth` |
| `POST /world/:showId/events/:eventId/look/generate` | `src/routes/worldEvents/looks.js:134` | `requireAuth, aiRateLimiter, lookIds` |
| `POST /world/:showId/events/:eventId/look/upload` | `src/routes/worldEvents/looks.js:164` | `requireAuth, lookUpload, lookIds` |

Each carried `requireAuth` and no group check: a sign-in in any group, or in none, was enough to change a shared episode's brief or plan, to start or replace an episode, or to attach an event to one.

Two more routes are amended in part:

- **`PUT /api/v1/world/:showId/events/:eventId`** (`src/routes/worldEvents/update.js:178`, `express.json, requireAuth`). Its allowlist (`allowedFields`, `:117-171`) has two fields that reach an episode: `used_in_episode_id` ("Episode linking — set/clear from the episode's event picker", `:136-139`) and `scene_set_id`, whose change moves a linked draft episode's Event location and its unlocked beats (`followSceneSet`, `:613-619`, calling `syncEpisodeEventLocation` of `src/services/eventPlaceSync.js`).
- **`POST /api/v1/world/:showId/episodes/:episodeId/generate-title-overlay`** (`src/routes/worldEvents/overlays.js:516`, `requireAuth, aiRateLimiter`). When the episode is not found it ran `UPDATE world_events SET used_in_episode_id = NULL WHERE used_in_episode_id = :episodeId` (`:534-539`) for any signed-in caller.

## Why a sign-in alone was not enough

- Evoni's admin-only ruling of 2026-10-29 (`F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`: "Prime Studios is an admin-only production environment").
- **The write guard is not relied on.** `src/middleware/adminWriteGuard.js` is mounted on `/api` ahead of every router and refuses a non-admin's write only where `ADMIN_WRITE_GUARD` is set to do so. Not established: what that variable is set to on any server. A route that must be an ADMIN's carries the check itself.
- Seven of the twenty make a paid call or can (INFERRED for `feed-moments/retry` and `regenerate-episode`, from their handlers' callees; the other five carry `aiRateLimiter`). One of the seven, `feed-moments/retry`, has no rate limiter; that is not changed here (§4).

# §2. The decisions (RULED)

Evoni, in the session of 2026-11-22, on the route matrix put to her ("P1" is the name that session used for this change):

> "Cover marks and self-talk are ADMIN-only in P1."

> "For general event edits, scene_set_id requires ADMIN when an episode is currently linked or would become linked through the same operation. Evaluate normalized current and proposed state together under the existing row lock."

> "Preserve the Start Episode offer-decision authorization branch and its tests as defense in depth."

> "Approve the final P1 route matrix and field-sensitive event-edit rules as the implementation scope. Use the existing Cognito ADMIN authorization middleware and the server-side locked comparison of current and proposed event state."

And, of every change in this group:

> "No duplicate authorization infrastructure." "Use server-side enforcement, not UI hiding alone." "Preserve existing ADMIN behavior." "Verify unauthorized mixed-field requests make no partial changes." "Preserve legitimate event-only editing."

Earlier the same day, of the general event save: "protect episode-linking and episode/scene-changing operations rather than indiscriminately blocking every event edit. Enforce this server-side for direct requests, including nested inputs, aliases and indirect service effects."

# §3. What the change does (MEASURED on the branch)

## The twenty routes

Each carries the existing `requireAuth` (401) then `authorize(['ADMIN'])` (403) of `src/middleware/auth.js`, inline, before `aiRateLimiter`, before the upload handling (`lookUpload`) and before the handler. No new role, group, middleware or membership check.

```
$ grep -c "requireAuth, authorize(\['ADMIN'\])" src/routes/episodeBriefRoutes.js src/routes/sceneStudioEpisodeRoutes.js src/routes/worldEvents/episodeGenerate.js src/routes/worldEvents/inject.js src/routes/worldEvents/looks.js
src/routes/episodeBriefRoutes.js:10
src/routes/sceneStudioEpisodeRoutes.js:2
src/routes/worldEvents/episodeGenerate.js:1
src/routes/worldEvents/inject.js:3
src/routes/worldEvents/looks.js:2
```

`src/routes/worldEvents/episodeBatch.js` has three such lines: the two Start routes of §1 and `bulk-delete`, which was an ADMIN's already.

- **What a refusal carries.** The 403 is `authorize`'s own: `{ error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' }`. It is sent before the handler, so nothing is read or written, no AI call is made and no upload is read.
- **Unchanged for an admin.** No handler body of the twenty is changed.
- **The Start Episode offer decision.** `offerActor: { ..., isAdmin: userInGroup(req.user, 'ADMIN') }` in `episodeGenerate.js` and `episodeBatch.js`, the routes' redaction of an offer's terms for someone who cannot decide, and `assertOfferDecision` in `src/services/startOfferDecision.js` are not changed. They are a second layer behind the route's check.

## The event save

`src/routes/worldEvents/update.js`, inside `lockAndCheck`, which both of the handler's write transactions call (the save, and the retry it makes when a column is missing):

- **Where.** After the event row is read under its lock, the 404 and the stale-save check; before the terms lock, the Place lock and the reference checks.
- **What is asked** (`adminOnlyEventChanges`), on the values the handler has already normalized (`unwrapScalar`, `normalizeNullLike`) against the locked row, compared as lower-cased text with none as empty:
  - the link changes when `used_in_episode_id` is sent and differs from the stored value;
  - the place changes when `scene_set_id` is sent and differs from the stored value;
  - the event has an episode now when its stored link is set, or a live episode's event is this one by `episodeEventIdSql` (`src/utils/episodeEventSql.js`), the predicate `syncEpisodeEventLocation` uses, read in the same transaction;
  - it would have one after the save when the link sent (else the stored link) is set.
- **The rule.** An ADMIN is needed when the link changes, or when the place changes and the event has an episode now or would have one after the save. A value sent unchanged is not a change.
- **The refusal.** For a caller who is not in the admin group (`userInGroup(req.user, 'ADMIN')`): `EventPutRefusal(403)`, which rolls the transaction back. Nothing in the request is saved, whatever else it carried. The body is `{ success: false, code: 'AUTH_GROUP_REQUIRED', error, message, fields }`, where both sentences are "Only an admin can link an event to an episode or change the place of an event that has an episode." and `fields` names the fields among the two. It has no episode id, title or terms.
- **One check moved behind the group.** `assertRelinkUnlessStored` runs before the event's lock, locks episodes and can answer with bodies that name an episode. It runs for an admin only; anyone else changing the link is refused under the event's lock, as above.
- **Not changed.** The checks that run before the lock (types, value lists, the scene set's existence, show and version) are as they were. None names an episode. Every other field of the allowlist is any signed-in account's, as before.

## The title overlay

`src/routes/worldEvents/overlays.js`: middleware unchanged. When the episode is not found, a caller who is not in the admin group gets the 404 ("Episode not found — it may have been deleted.") and no link is touched; an admin gets the 404 and the clearing, as before.

## The frontend (display only)

`frontend/src/utils/authGroups.js` gains `adminOnlyMessage(err)`: a 403 with `AUTH_GROUP_REQUIRED` reads as the handler's own sentence when it sent one, else "Only an admin can change the production plan." Ten callers of the routes above show it in place of the bare "Forbidden". It hides nothing and guards nothing; the server is the guard.

## Tests

- New: `tests/integration/p1PlanAdmin.integration.test.js` (the twenty routes: signed out 401; an editor and a viewer 403 with `authorize`'s body, no statement that writes recorded by `tests/helpers/lockTrace.js`, every row of the episode, brief, plan, scenes, set links, events and sets as it was, no AI call, no upload read; an admin not stopped by the check; the title overlay's clearing).
- New: `tests/integration/eventEditAdminFields.integration.test.js` (the event save's rule: each case, with the value plain, as `{ id }` and as `{ value }`, and "none" in each way the route reads it; a mixed save saving nothing; an event linked only through the episode's brief; event-only edits still saved; the 403 ahead of the 409s that name an episode; an admin as before; the missing-column retry).
- Changed, assertions kept: `tests/integration/startEpisodeOfferDecision.integration.test.js`. Its cases about someone who is not an admin reach the handler through a test-only pass of `authorize` (a header honoured by this file's mock alone); new cases assert the plain 403 over HTTP and the service's own refusal.
- Changed, pins: `tests/unit/routes/world-cluster-tier-promotion.test.js` (four route patterns now include `authorize(['ADMIN'])`; the count of AI handlers is kept at 23).
- Changed, the token or mock user only: the suites that drive these routes now ask as an admin (the PR lists them).

# §4. What this amendment does not cover

- **Other writes.** Only the routes of §1 are changed. Among those left as they were: the four script writers (`generate-script`, `regenerate-beat`, `rewrite-line` of `src/routes/episodeBriefRoutes.js` and the event `generate-script`), the performance-clip and dressed-angle writes, the episode location, scene-set, Scene Studio and footage writes, and the episode update, delete and script-lock routes. The session of 2026-11-22 named separate changes for them.
- **The event's other fields.** Its status, deal terms and `canon_consequences` stay any signed-in account's. A non-admin cannot change an episode row through them, but can change what a later admin action reads. Evoni: "Add event status, deal terms and canon_consequences to a separate follow-up permission review."
- **An existing answer that names an episode.** The terms lock of the event save answers a change to a locked field on a started event with 409 and a body that names the episode (`termsLockedBody`). It is as it was, for every field but the two of this amendment, and for an admin.
- **Rate and spending limits.** No limiter or budget is added or changed. `feed-moments/retry` still has no rate limiter.
- **The write guard.** `src/middleware/adminWriteGuard.js` and `ADMIN_WRITE_GUARD` are not changed.
- **Reads.** No `GET` is changed.
- **Stored data.** No row is changed or removed. No migration.
- **A non-admin on these pages.** A signed-in account that is not in the admin group now gets a 403 from these routes, shown as one sentence. No page is hidden.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** the twenty routes of §1 are an ADMIN's; on the event save, a change of `used_in_episode_id`, and a change of `scene_set_id` on an event that has or would have an episode, are an ADMIN's; the title overlay's stale-link clearing is an ADMIN's; on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host or database was contacted for this change. Earlier in the same session, for other work: one read-only Cognito call was attempted for an account inventory Evoni asked for and was refused (UnrecognizedClientException); one request to the development site's `/health` was refused by the session's own network policy before it left; no other AWS call.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
