| **PRIME STUDIOS** **F-AUTH-1 — THE PROPERTY MANAGER'S WRITES ARE AN ADMIN'S (AMENDMENT)** *Four write routes under `/api/v1/properties` answered any signed-in account, in any group or none, and three of them acted on whatever World Location their id named: any location could be renamed, given a room and a scene set, or have its metadata replaced. By Evoni's decision of 2026-11-22 the four need a sign-in in the admin group, a property-targeted write refuses an id that is not a property, and a room edit refuses a room that is not that property's.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `9d69c06c976865c93b16185ae1c8f8beec8757eb` (2026-11-22), plus branch `claude/property-manager-admin`. Every `file:line` below is against the basis unless it says "branch".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1, §3 and §4, each with its command or file); INFERRED (marked where used).

---

# §1. What is amended

## The classification as it stood (MEASURED)

`src/routes/propertyRoutes.js` is mounted once, at `/api/v1/properties` (`src/app.js:1777-1778`). It declares nine routes. All nine carried `requireAuth` and no group check.

```
$ git show origin/main:src/routes/propertyRoutes.js | grep -c "authorize("
0
$ git show origin/main:src/routes/propertyRoutes.js | grep -n "middleware/auth"
24:const { requireAuth } = require('../middleware/auth');
$ git show origin/main:src/routes/propertyRoutes.js | grep -c "^router\."
9
```

`tests/unit/routes/cp10-property.test.js` pins the file as "9 handlers all Tier 1": Tier 1 is a sign-in.

## The gap (MEASURED)

| Route | At the basis | What any signed-in account could do |
|---|---|---|
| `POST /` | `src/routes/propertyRoutes.js:83` | Make a property (`location_type: 'property'`, `:103`). |
| `PATCH /:id` | `:153-157` | `WorldLocation.findByPk(req.params.id)` with no test of the row's type: rename, re-describe and merge metadata into **any** World Location. |
| `POST /:id/rooms` | `:182-186`, `:199-228` | The same lookup: make a child location and a scene set under **any** World Location. |
| `PATCH /:id/rooms/:roomId` | `:245-259` | Find `{ id: roomId, parent_location_id: id }` and update it, `metadata` replaced whole: **any** location that has a parent, addressed through that parent. |

- `world_locations` has no owner column (`src/models/WorldLocation.js`; the table as migrated). Every row is shared production data, so a route is either an admin's or anyone's.
- `GET /:id` already refused a location that is not a property (`:140-143`). The three writes that take an id did not make that test.
- An id that is not a UUID reached the database and came back as a 500 carrying the database's own message (MEASURED: the control run in §5, `invalid input syntax for type uuid`).
- The general write guard (`src/middleware/adminWriteGuard.js:94`) does nothing unless `ADMIN_WRITE_GUARD` is set. What it is set to on any server is not established, so it is not relied on.

# §2. The decision (RULED)

Evoni, in the session of 2026-11-22.

> "Decision 1 — Property Manager security PR AUTHORIZED. Create one separate, focused PR using the existing ADMIN middleware. Protect these four routes: POST /api/v1/properties; PATCH /api/v1/properties/:id; POST /api/v1/properties/:id/rooms; PATCH /api/v1/properties/:id/rooms/:roomId. Use requireAuth followed by authorize(['ADMIN']) before mutations or paid work. Do not add an ownership model or another authorization service."

> "Resource-type validation. Use the existing canonical location_type/property classification. For property-targeted actions: Refuse when :id does not identify a property. For room edits, verify the room belongs to that property. Do not allow a room endpoint to modify an unrelated World Location by ID. Keep legitimate ADMIN property and room operations functional. Use established error conventions and controlled 400/404/409 responses as appropriate. Do not invent new property classification rules if the current model is ambiguous; report the ambiguity before implementing that part."

> "Before making the change, inspect and update the existing tier route-count test truthfully. Do not weaken unrelated assertions."

> "Open the PR with all seven CI checks and return it for separate merge authorization. Do not merge or deploy it."

No ownership rule is created. No public contract is created.

# §3. What the change does (MEASURED on the branch)

## Sign-in and group

`authorize(['ADMIN'])` directly after `requireAuth` on the four routes, and `authorize` added to the import. The existing `requireAuth` (401) and `authorize` (403, `AUTH_GROUP_REQUIRED`) of `src/middleware/auth.js`: no new middleware, role, group, table, endpoint, migration or helper for authorization.

```
$ grep -c "authorize(\['ADMIN'\])" src/routes/propertyRoutes.js
4
```

Unchanged, a sign-in still: `GET /templates`, `GET /style-presets`, `GET /`, `GET /:id`, and `POST /:id/rooms/:roomId/generate-empty`. The last was read before it was left: it reads the property, the room and the room's scene set, builds a prompt from a template in memory and answers with it (`:268-312`); it writes no row and calls no provider.

## The classification rule used (the existing one)

- **A property** is a `world_locations` row whose `location_type` is `'property'`. That is the test the file already made: the list (`:58`), `GET /:id` (`:141`), and what `POST /` writes (`:103`). The DREAM seed's "Lala's Home" row is written with the same type (`src/services/lalaHomeLocation.js:24`, used at `src/routes/worldStudio.js:3371`).
- **A room** is a row whose `parent_location_id` is that property. That is the existing query of the room edit (`:248-250`). `POST /:id/rooms` writes a room as `location_type: 'interior'` (`:203`), which is also the column's default and the type of most other locations, so the type says nothing about being a room; no test of the room's type is added.

## What each write now answers

One function in the file, `propertyForWrite`, serves `PATCH /:id` and `POST /:id/rooms`:

| `:id` | Answer | Written |
|---|---|---|
| a property | as before | as before |
| a location that is not a property | 400 `{ "success": false, "error": "This location is not a property" }`, the body `GET /:id` gives (`:142`) | nothing; no room, no scene set |
| a UUID no location has | 404 `{ "success": false, "error": "Property not found" }`, as before | nothing |
| not a UUID | the same 404 (was a 500 with the database's message) | nothing |

`PATCH /:id/rooms/:roomId` first reads `:id` and goes on only when it is a property; then the existing query. Everything else is the existing 404 `{ "success": false, "error": "Room not found in this property" }`, nothing written: `:id` not a property (a city with its district, a home that is an `'interior'` with its room, a venue, a room); a room of another property; a location that is no child of this property; the property itself as `:roomId`; an unknown id; an id that is not a UUID (was a 500).

## What is kept exactly

- `PATCH /:id` still **merges** `metadata` into the row's, and still writes `property_type`, `style_guide` and `floor_plan` into `metadata` (not into the columns of those names).
- `PATCH /:id/rooms/:roomId` still **replaces** `metadata` whole. This is a hazard for an admin too (a partial body drops the room's other metadata, such as the `scene_set_id` "Fill in Lala's home" stores there). It is recorded here, not changed.
- For an admin on a property and its room, every success body and status is as before; `name is required` is still a 400.

## The page (display only; the server is the guard)

`frontend/src/pages/PropertyManager.jsx` calls three of the routes: the list, create-property and add-room. Nothing in `frontend/src` calls either `PATCH`.

- A create-property or add-room that the server refuses with 403 `AUTH_GROUP_REQUIRED` now shows "Only an admin can add or change properties and rooms." through the existing `adminOnlyMessage` (`frontend/src/utils/authGroups.js`). At the basis it showed the request library's "Request failed with status code 403" (`frontend/src/pages/PropertyManager.jsx:63`, `:73`).
- The page is otherwise unchanged. `/property-manager` is not wrapped in `<AdminOnly>` (`frontend/src/App.jsx:507`); someone who is not an admin still opens it, sees the list, and sees both forms with their buttons enabled. Routing and controls are not changed here.

# §4. What is left for Evoni (the ambiguity; nothing was invented)

1. **A home that "Fill in Lala's home" makes is not a property.** When no location is at her address, `fillLalaHome` inserts the house as `location_type` `'interior'` under the city row, and its rooms as `'interior'` children of the house (`src/services/characterPlacesService.js:322-325`, `:336-338`). The seed's "Lala's Home" is a `'property'` (`src/services/lalaHomeLocation.js:24`). So "Lala's home" is a property or not depending on which ran first. A house that is an `'interior'` was never in the Property Manager's list and `GET /:id` already answered it 400; the four writes now refuse it too (`PATCH /:id` and `POST /:id/rooms` 400, the room edit 404). Whether that house should be a property is hers to say; no rule was added to treat it as one.
2. **A room has no type of its own.** The room edit accepts any child of a property. A location of another kind whose parent was set to a property (World Foundation's location edit accepts `parent_location_id`, `src/routes/worldStudio.js:3286`) is a "room" to this route.
3. **The type can be changed elsewhere.** `PUT /api/v1/world/locations/:id` accepts `location_type` (`src/routes/worldStudio.js:3286`), and `POST /api/v1/world/locations` accepts any (`:3247-3257`). A row is a property for as long as its type says so.
4. **Property fields live in two places.** The Property Manager's routes keep `property_type`, `style_guide` and `floor_plan` in `metadata`; World Foundation's keep them in the columns of those names (`src/routes/worldStudio.js:3286`). Not changed.

# §5. Tests

- `tests/integration/propertyManagerAdmin.integration.test.js` (45 cases; 38 on a migrated test database through the real app, 7 source pins). Each of the four writes signed out (401) and as a viewer, an editor and an account in no group (403 `AUTH_GROUP_REQUIRED`), with every `world_locations` and `scene_sets` row of the database, every column, the same afterwards. An admin: makes a property; edits one (metadata merged, the three fields mapped into it, type and city untouched); adds a room (parent, universe and city from the property, and its scene set); edits the room (metadata replaced whole, type and parent untouched). Refused for an admin, nothing written: a venue, a city, a room and an `'interior'` home as `:id` on `PATCH /:id` and `POST /:id/rooms`; the room edit through a city, an `'interior'` home, a room or a venue as `:id`, and on a property with another property's room, a venue, a district, another property or the property itself as `:roomId`; unknown ids and ids that are not UUIDs on all three. The reads still answer an editor. After every case: no call to the Anthropic or Replicate clients, to `axios`, to the S3 client, or to `fetch`.
- **Control.** With `src/routes/propertyRoutes.js` as on `origin/main` and the test file unchanged, 23 of the 45 fail (the 5 pins of the admin chain, the 4 non-admin cases, 8 non-property ids, 2 room edits through a parent that is not a property, 4 ids that are not UUIDs); with the branch's file, 45 pass.
- `tests/unit/routes/cp10-property.test.js`: the import pin is now `{ requireAuth, authorize }`; the four writes are pinned with `requireAuth` then `authorize(['ADMIN'])`; the five others are pinned as `requireAuth` then the handler (tightened, so an added check would fail them); one new count: nine routes, nine with `requireAuth` first, four with the admin chain, four `authorize(` in the file.
- `tests/unit/routes/droppedWrites.sites.test.js`: the one case that drives `POST /:id/rooms` now asks as an admin and its stubbed parent is a property. Its assertions are unchanged.
- `tests/integration/locationDreamCity.integration.test.js`: its three property-route calls now carry an admin token; the editor token stays on its `/world/locations` calls. Its assertions are unchanged.
- `frontend/src/pages/PropertyManager.test.jsx`: three new cases (a 403 on create-property and on add-room shows the sentence; any other failure keeps its own message). The six that were there are unchanged.
- `src/config/writeGuardManifest.js` lists the writes that are **not** an admin's. None of these four is or should be there; the file is not changed.

# §6. What this amendment does not cover

- **An ownership model.** None exists and none is added.
- **`POST /:id/rooms/:roomId/generate-empty`**: a sign-in still, with no test that `:id` is a property. It writes nothing and calls no provider.
- **The room edit's metadata**, still replaced whole (§3).
- **The other writers of World Locations**: World Foundation's location routes, events made from a profile, story generation, the feed scheduler and "Fill in Lala's home". Unchanged here and under a separate, read-only audit.
- **`ADMIN_WRITE_GUARD`**: not relied on, and what it is set to anywhere is not established.
- **Live data.** No server's rows were read. Whether the rows on any server are typed as the code expects (which homes are `'property'`, which rooms are children of one) is not known.
- **The page for someone who is not an admin**: still opens, with its forms enabled (§3).
- **Stored rows.** None is changed or removed.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server, and no route was called on one.

---

**Type:** amendment.
**Rules:** the four routes of §1 are an ADMIN's; a property-targeted write refuses an id that is not a property and a room edit refuses a room that is not that property's, on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
