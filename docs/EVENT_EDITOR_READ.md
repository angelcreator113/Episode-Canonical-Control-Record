# What the Old Event Editor Still Owns: a read, not a ruling

## Status of this document

**Read-only research, not a decision.** This is not filed under `docs/audit/` and rules nothing.
It exists so Evoni can decide how the Event Package takes over from the old WorldAdmin editor
with a full list of what the old editor still does. It does not decide that for her. Nothing
here changes code, runs a query against any database, or writes a migration. Claims checked
against the code give a name and a file:line. Where a repo read can't settle something, this
document says so.

Basis for the file:line citations below: `origin/main` at
`abd12b28c0d46dba3993550aedd0dc649b758ed7` (2026-09-23). Line numbers are paired with a stable
name (component, function, route, or UI label) per `CLAUDE.md`'s living-doc rule, because the
line numbers will drift.

Prior art is cited here, not restated: `docs/EVENT_EPISODE_FLOW.md` §2 EVENT PACKAGE and §7
rulings 4, 5 and 8, plus §8(p) on organizers; `docs/GUEST_OWNERSHIP_READ.md` on the two guest
stores; `docs/EVENT_TAXONOMY_PLAN.md` on `category`/`format`; `docs/WARDROBE_OWNERSHIP_READ.md`
§1.2 and §4.1 on the event outfit.

---

## 0. Short answers

**"The old editor" is really two editors, and they save differently.** Both are in
`frontend/src/pages/WorldAdmin.jsx`:

- **The Edit details modal** (`eventDetailModal`, rendered at `:3277` onward). It opens from the
  Events card's overflow menu "Edit details" (`:3144`), from the Event Package's own "Edit
  details" button (`EventPackagePage.jsx:223`, `openEditor`, through the `?tab=events&event=<id>`
  deep link that WorldAdmin handles at `:511-523`), and from two other cards (`:1970`, `:2260`).
  This is the editor Evoni actually reaches.
- **The event form** (`editingEvent`/`eventForm`, rendered at `:2550-3080`). Its `saveEvent`
  (`:569`) creates events. It edits an existing event only when opened through `openEditEvent`
  (`:559`), and the only caller of `openEditEvent` is the "✏️ Edit" button on a sequence warning
  (`:2394`).

**Step 5, the question Evoni reads first: yes, an old-editor save can silently undo newer
Event Package work today.** The main path is the Edit details modal's **💾 Save** button
(`WorldAdmin.jsx:4290-4331`). It does not send the full event. It does send the event's entire
`canon_consequences` object, rebuilt from the copy of the event the modal opened with. The PUT
route replaces that JSONB column wholesale (`worldEvents.js:599-601`, `:643-645`, `:707`). So
the save overwrites everything in `canon_consequences` with the modal's copy, including the
Event Package's featured-guest and story-role edits in `automation.guest_profiles`. The same
save also sends that copy's `host`, `venue_name`, `venue_address`, `scene_set_id` and `name`.
It never sends `venue_location_id`, `source_profile_id`, outfit fields or `invitation_asset_id`.
Details and two concrete scenarios are in §5.

**Fabricated values:** the modal fills blanks at render time. It shows a date of today + 14
days, a time chosen from prestige, a dress code chosen from the host's content category (or
`'chic'`), and cost, strictness and deadline chosen from prestige. **Mark Ready** and **💾
Save** then write those values to the row. See §2.

**Complete-looking but empty: yes.** The fields affected are date, time, dress code, and
(only when they are null) cost, strictness and deadline. Readiness counts none of them. See §3.

**AI Enhance** fills up to 12 fields in one action and saves them immediately, with no review
step. It can also overwrite a description or narrative stakes you already wrote, whenever the
AI's version is longer. See §4.

---

## 1. Every field the old editor can set, and whether the Event Package can

The Event Package writes through five actions only. All of them are `PUT
/world/:showId/events/:eventId` calls in `frontend/src/pages/EventPackagePage.jsx`:

- `selectHost`: `:225`
- `saveGuestProfiles`: `:249`
- `saveEventName`: `:326`
- `chooseVenue`: `:364`
- `chooseSceneSet`: `:428`

It also has the shared `InvitationButton` (`:756`) and Start Episode (`handleStartEpisode`,
`:468`). Everything else on the page is read-only display.

In the table, "Form" means the event form (`eventForm`) and "Modal" means the Edit details
modal (`md`).

| Field | Old editor: where | Event Package can set it? |
|---|---|---|
| `name` | Form; Modal header input (`:3375`) | **Yes** (`saveEventName`) |
| `event_type` | Form (`:2675`); Modal icon select (`:3372`) | No: **old editor only** |
| `category`, `format` | Neither editor. Set only at creation by the feed-template "create" button (`:2177-2195`, `TEMPLATE_CATEGORY_MAP` `:82`) | No: displayed only (`EventPackagePage.jsx` Basics). **Nobody can edit these after creation.** |
| `host` (free text) | Form (`:2679`); Modal (`:3384`) | Only together with `source_profile_id`, through Change Host (`selectHost`). Free-text host is **old editor only** |
| `source_profile_id` | No control in either. The form carries it along from the list row (see §5) | **Yes**, the only UI writer |
| `host_brand` | Form (`:2680`); Modal (`:3385`) | No: **old editor only**. The Event Package's organizer line reads it (`resolveEventOrganizer`, `eventReadiness.js:68`) |
| `description` | Form (`:3074`); Modal (`:3757`) | No: **old editor only** |
| `prestige`, `cost_coins`, `strictness` | Form (`:2681-2683`); Modal (`:3419-3421`) | No: **old editor only** (displayed in Style & Deliverables) |
| `deadline_type` | Form (`:2686`); Modal (`:3422`) | No: **old editor only** |
| `deadline_minutes` | Form only (`:2695`) | No: **old editor only** |
| `dress_code`, `dress_code_keywords` | Form (`:2701-2720`); Modal (`:3386`, `:3703-3707`) | No: **old editor only** (dress code displayed) |
| `browse_pool_bias`, `browse_pool_size` | Form only (`:2727-2737`) | No: **old editor only** |
| `is_paid`, `payment_amount` | Form (`:2761`, `:2769`); Modal Payment select (`:3554-3567`) and amount (`:3573`) | No: **old editor only** |
| `is_free` | Modal's "Free entry" option sends `is_free` (`:3561`) | No. **Not a column** (absent from the 2026-09-17 canon capture's `world_events` rows and from every migration) and not in the PUT allowlist (`worldEvents.js:546-578`). The modal's lone `{ is_free }` PUT gets the route's 400 "No valid fields to update" (`:699`). Only `cost_coins: 0` sticks. |
| `career_tier` | Form (`:2751`); Modal (`:3426`) | No: **old editor only** |
| `narrative_stakes`, `career_milestone`, `fail_consequence`, `success_unlock`, `location_hint` | Form (`:2772-2776`); Modal (`:3745-3761`) | No: **old editor only** |
| `venue_location_id` | Form's World Location picker (`:2591`) | **Yes** (`chooseVenue`, the only path Evoni's #1674 amendment allows) |
| `venue_name`, `venue_address` (typed) | Form (`:2620`, `:2626`); Modal (`:3391-3392`) | Only as a side effect of picking a location (`chooseVenue`). Typing a venue name with no location is **old editor only** |
| `event_date`, `event_time` | Form (`:2636`, `:2642`); Modal (`:3395-3396`) | No: **old editor only** (displayed in Basics) |
| `scene_set_id` | Form picker (`:2651`); Modal pick/clear/remove (`:3366`, `:3468`, `:3497`, `:3503`) and generate-venue (`:3478`, `:3533`) | **Yes** (`chooseSceneSet`, limited to the chosen venue's location) |
| `theme`, `mood`, `color_palette`, `floral_style`, `border_style` | Form and Modal, both through `InvitationStyleFields` (`:2745`, `:3721-3731`) | No: **old editor only** |
| `parent_event_id`, `chain_position`, `chain_reason`, `seeds_future_events` | Form only, Narrative Chain block (`:2786-2830`) | No: **old editor only** |
| `required_ui_overlays` | Form overlay chips (`:2846` onward); Modal through `PUT .../overlay-selections` (`:4016`) | No: **old editor only** |
| `rewards`, `requirements` | Form only, Rewards & Requirements block (`:3006-3070`) | No: **old editor only** (requirements displayed) |
| `outfit_pieces` | WorldAdmin's outfit picker (card `:3162`, Modal "Pick Outfit" `:3946`; saves through `PUT .../outfit` `:4818`) | No: displayed only ("N pieces chosen"). **Old editor only.** `docs/WARDROBE_OWNERSHIP_READ.md` §1.2 covers the store. |
| `outfit_set_id` | No UI anywhere (`grep -rn outfit_set_id frontend/src` finds only the readiness check at `eventReadiness.js:91`) | No. It is allowlisted in the PUT, but nobody sets it |
| `canon_consequences.automation.guest_profiles` | Modal shows it read-only as chips (`:3399-3416`) | **Yes**: feature, story role, add from feed (`toggleFeatured` `:269`, `setGuestStoryRole` `:280`, `addGuestFromFeed` `:285`) |
| `canon_consequences.automation.social_tasks` | Modal "regenerate" (`:4102`); Mark Ready (`:4227`) | No: **old editor only** |
| Invitation (asset, text) | Modal `InvitationButton` (`:3736`) | **Yes**: the same component (`EventPackagePage.jsx:756`) |
| `status` draft→ready | Modal **Mark Ready** (`:4188-4266`); card status override (`changeEventStatus` `:666`, draft/ready only) | No: **old editor only** |
| `status` → declined | Modal **Decline Invite** (`POST .../decline`, `:4179`) | No: **old editor only** |
| `used_in_episode_id` | Modal episode link chips (`injectEvent` `:1177`, called at `:4155`); **Complete Episode** (`:4270`) | Start Episode only (`handleStartEpisode`) |
| Delete | Modal Delete (`:4173`) | No |

**The create form accepts values that `POST` then throws away.** `POST /world/:showId/events`
(`worldEvents.js:365`) destructures `venue_location_id`, `venue_name`, `venue_address`,
`event_date`, `event_time` and `guest_list` (`:384-385`). Its `WorldEvent.create` call
(`:421-449`) writes none of them. It also never writes the five invitation-style fields, which
it doesn't destructure at all. The venue lookup only feeds `location_hint` and `scene_set_id`
(`:395-418`). So a venue, date, time or invitation style typed into **+ Create** is lost. It
survives only if it is typed again later through an edit path.

---

## 2. Values the editor makes up at render time

Everything in this section is in the Edit details modal's hydration block
(`WorldAdmin.jsx:3277-3316`, the comment "Hydrate missing fields from automation data + derive
from context"). The modal renders `md`, not the stored row. For each field, `md` takes the
column, then the `canon_consequences.automation` copy, then a made-up value.

| Field | Made up from | Rule (`:line`) | Ever saved? |
|---|---|---|---|
| `event_date` | Today's date | `new Date()` + 14 days (`derivedDate`, `:3291-3294`, `:3302`) | **Yes.** Mark Ready sends `event_date: md.event_date` (`:4214`). 💾 Save sends it as a column and also copies it into `automation.event_date` (`:4291-4303`). The date input itself saves only when changed (`:3395`). |
| `event_time` | Prestige | ≥7 → `20:00`, ≥4 → `19:00`, else `18:00` (`:3303`) | **Yes**, by Mark Ready (`:4214`) and 💾 Save (`:4291`, `:4299`) |
| `dress_code` | `automation.content_category` | `categoryDressCodes` lookup, falling back to `'chic'` (`:3283-3289`, `:3304`) | **Yes**, by Mark Ready (`:4212`) and 💾 Save. Also by `updateField` on blur (`:3386`) if the input is only focused and left. |
| `cost_coins` | Prestige | ≥8 → 500, ≥6 → 300, ≥4 → 150, else 50, **only when the column is null** (`??`, `:3307`) | **Yes**, by Mark Ready (`:4216`) and 💾 Save. Rarely applies: the model default is 100 and `POST` defaults it too (`worldEvents.js:370`). |
| `strictness` | Prestige | `min(10, prestige + 1)`, only when null (`:3308`) | **Yes**, same paths. Rarely applies: the canon capture has `strictness` as `NOT NULL`. |
| `deadline_type` | Prestige | ≥8 → `urgent`, ≥5 → `medium`, else `low` (`:3309`) | **Yes**, same paths |
| `host` | Automation copy (`host_display_name` or `host_handle`) | `:3298` | **Yes**. Mark Ready and 💾 Save promote the copy into the `host` column. This value is copied, not made up. |
| `host_brand`, `venue_name`, `venue_address`, `description`, `narrative_stakes`, `theme`, `mood`, `color_palette`, `floral_style`, `border_style`, `dress_code_keywords` | Automation copy only | `:3299-3315` | The same promotion by Mark Ready (a subset) and 💾 Save. These are copied, not made up. |

Two more derivations happen at the moment the user clicks, not at render time:

- **AI Enhance's host fallback** (`:3648-3654`). If the AI returns no host, the modal sets
  `host` to `` `${host_brand} Events` ``, or to the event name up to the first "—". This is
  saved at once (§4).
- **The form's overlay "auto-suggest"** (`autoSuggest`, `:2877-2885`). It builds
  `required_ui_overlays` from prestige, `career_milestone` and `event_type`. This value is
  saved only when the user clicks the form's Save, so it is reviewed.

The form (`eventForm`) itself makes nothing up from the event. Its only defaults are
`EMPTY_EVENT`'s constants (`:122-151`, e.g. `cost_coins: 100`, `prestige: 5`). Those apply to
new events, and on edits they fill keys the list row lacks (§5).

The modal's **Invite Preview** (`EventInvitePreview`, `frontend/src/pages/feed/FeedEnhancements.jsx:219`)
gets `md` (`WorldAdmin.jsx:3717`). So it shows the made-up date. It also defaults
`event_excitement` to 5 (`:223`). Both are display only.

---

## 3. Can an event look complete in the editor while the row is empty?

**Yes.** In the Edit details modal:

- **`event_date` always shows a value.** A blank row shows today + 14.
- **`event_time` always shows a value.** A blank row shows a time chosen from prestige.
- **`dress_code` always shows a value.** A blank row shows at least `'chic'`.
- **`cost_coins`, `strictness` and `deadline_type`** show a made-up value when they are null.

Venue, host and the invitation-style fields also fill in from the `automation` copy. That copy
is real saved data, not made up. But it sits outside the columns, and the Event Package labels
it "saved copy" (`resolveEventVenueAndDate`, `eventReadiness.js:30`).

**Readiness counts none of the made-up fields.** `computeEventReadiness` (`eventReadiness.js:88`)
checks only outfit, venue, scene and invite. `computeEventState` (`:143`) adds the organizer
check (`resolveEventOrganizer`: brand, or a linked creator). Both run on the stored row: the
Events card calls them on `worldEvents` entries (`WorldAdmin.jsx:3116`, `:3120`), and the Event
Package calls them on the `GET` response (`EventPackagePage.jsx:199`). So a made-up date or
dress code never turns a readiness chip green.

The one thing that does rely on made-up values is **Mark Ready's own required-field check**
(`WorldAdmin.jsx:4188-4198`). It tests `md`, so "Event Date" and "Dress Code" can never be
reported missing. Only Host, Venue Name and Description can fail it. The confirm dialog does
show the made-up date and the host (`:4206`). It does not show the made-up time, dress code,
cost, strictness or deadline that it is about to save.

The reverse can happen too. The list `GET` does not return `theme`, `mood`, `color_palette`,
`floral_style` or `border_style` (they are not in `WorldEvent.CURRENT_ATTRIBUTES`,
`src/models/WorldEvent.js:380-394`). So the modal can show those fields empty, or show the
automation copy, while the row holds a value. This lasts until the first save in that modal
merges the full row back in (`updateField` `:3317-3329`, which spreads `res.data.event` from the
route's `SELECT *`, `worldEvents.js:779-782`).

---

## 4. The AI enhancement paths

There are four. Only the first is the modal's button.

**(a) Modal "✨ AI Enhance"** (`WorldAdmin.jsx:3578-3699`). One click does the following:

- Sends the event to `POST /world/:showId/events/ai-fix` (`worldEvents.js:1159`, Sonnet 4.6;
  the route writes nothing).
- Fills any field the AI returns wherever `md`'s value is empty (`:3637-3644`).
- **Replaces `description` and `narrative_stakes` whenever the AI's text is longer than the
  existing text** (`:3645-3647`), even if you wrote the existing text.
- Applies the host fallback (§2).
- **PUTs every changed field in the `saveable` list right away** (`:3658-3668`). The fields are
  `name`, `event_type`, `host`, `host_brand`, `description`, `prestige`, `cost_coins`,
  `strictness`, `deadline_type`, `dress_code`, `dress_code_keywords`, `location_hint`,
  `narrative_stakes`, `career_milestone`, `career_tier`, `fail_consequence`, `success_unlock`,
  `is_paid`, `is_free`, `payment_amount`, `browse_pool_bias`, `venue_name`, `venue_address`,
  `event_date` and `event_time`. The prompt asks for 12 of them (`emptyFields`, `:3583-3595`).
- If that batch fails, it retries one field at a time (`:3673-3682`).

**Saved without review: yes.** The "review the filled fields" toast (`:3685`) appears after the
write. Because `md` already holds the made-up date, time and dress code, those count as "not
empty": the AI won't fill them, and AI Enhance won't save them. One more effect: after the save,
the local `worldEvents` entry becomes `{ ...ev, ...serverData, ...merged }` (`:3671`). That puts
the AI's non-saveable keys and the made-up values into the in-memory list the rest of the page
reads, until the next reload.

**(b) Bulk AI Enhance** (`handleBulkEnhance`, `:1082-1113`). It runs on up to 10 events that
lack a description, narrative stakes or host. For each event, it PUTs **every key the AI returns**
whose value is empty on the list row (`:1097-1103`). There is no key allowlist on the client, so
the only filter is the route's own allowlist. There is no review. Keys the list row never has,
such as `theme` or `category`, always count as empty, so an AI value for them would overwrite a
stored one. The prompt doesn't ask for those keys. This was not observed happening.

**(c) Form "✨ AI Revise"** (`handleAiRevise`, `:1026-1073`) and **gap "✨ AI Create"**
(`handleAiGenerateForGap`, `:871`, then "+ Create" at `:2427-2442`). Both only put values into
the form. **They are reviewed:** nothing is saved until the user clicks the form's Save or
Create.

**(d) AI Fix "Apply"** (`applyAiFix`, `:929-1003`). One suggestion at a time, applied by click,
changing `event_type`, `name`, `prestige`, `dress_code`, `dress_code_keywords` or `cost_coins`.
It saves through `PUT` with `{ ...ev, ...updates }` (`:994`), the full-row spread described in §5.

---

## 5. Fields the Event Package sets that the old editor doesn't know about: can an old-editor save undo them?

### What the PUT does with what it's sent

`PUT /world/:showId/events/:eventId` (`src/routes/worldEvents.js:530`) loops over `allowedFields`
(`:546-578`) and writes only keys that are present. **A key that is left out is never touched**
(`if (updates[field] !== undefined)`, `:622`). A key that is present is written as-is. Empty
strings and `'null'` become SQL `NULL` (`normalizeNullLike`, `:604-611`). JSONB fields in
`jsonFields` (`:599-601`, which includes `canon_consequences`) are `JSON.stringify`'d (`:643-645`)
and bound as `canon_consequences = :canon_consequences` in one `UPDATE ... SET` (`:707`).
**That is a wholesale replace, not a merge.** `EventPackagePage.jsx`'s own `saveGuestProfiles`
comment (`:241-248`) says the same, and it works around this by always sending the full
`canon_consequences` with only `guest_profiles` swapped.

### Where each editor's copy of the event comes from

Both old editors start from WorldAdmin's `worldEvents` list, fetched once per WorldAdmin mount
by `loadData` (`WorldAdmin.jsx:541`, run from the effect at `:442`). The list comes from `GET
/world/:showId/events` (`worldEvents.js:37`), which selects
`attributes: WorldEvent.CURRENT_ATTRIBUTES` (`:61`; list at `WorldEvent.js:380-394`).

- **That list includes** `name`, `host`, `host_brand`, `venue_location_id`, `venue_name`,
  `venue_address`, `event_date`, `event_time`, `scene_set_id`, `source_profile_id`,
  `invitation_asset_id`, `outfit_set_id`, `outfit_pieces`, `canon_consequences`, `status`,
  `used_in_episode_id`, and the rest of the scoring, narrative and chain columns.
- **It excludes** `category`, `format`, `theme`, `mood`, `color_palette`, `floral_style`,
  `border_style`, `guest_list`, `invitation_details` and `source_calendar_event_id`. It also
  excludes `is_free`, which does not exist.

(The comment on the single-event `GET` at `worldEvents.js:122-130`, which says the list
"excludes venue_name/venue_address/event_date/event_time", is stale. Task #1646 added those
five venue and date fields to `CURRENT_ATTRIBUTES`.)

The Event Package instead reads `GET /world/:showId/events/:eventId` (`worldEvents.js:132`, `SELECT *`).

WorldAdmin (`/shows/:id/world`) and the Event Package (`/shows/:showId/events/:eventId`) are
separate routes (`frontend/src/App.jsx:377`, `:380`). Moving between them in one browser tab
remounts WorldAdmin, which refetches the list. So in a single tab, **the copy is fresh when the
modal opens**. It goes stale in two ways:

- **(i)** something writes the row while the modal is open;
- **(ii)** WorldAdmin's list is older than an Event Package edit made in another tab or window.
  WorldAdmin does not refetch on focus; the only manual refresh is 🔄 Refresh at `:1365`.

### Every old-editor write path, and exactly which keys it sends

| Path | Keys sent | Sends `canon_consequences`? |
|---|---|---|
| **P1. Modal field edits**: `updateField` (`:3317`), `updateMultipleFields` (`:3330`) | Only the one field touched, or only the changed invitation-style keys | No |
| **P2. Modal 💾 Save** (`:4290-4331`) | Every key in its `saveable` list that is not null/undefined on `md` (`:4291-4295`): `name`, `event_type`, `host`, `host_brand`, `description`, `prestige`, `cost_coins`, `strictness`, `deadline_type`, `dress_code`, `dress_code_keywords`, `location_hint`, `narrative_stakes`, `career_milestone`, `career_tier`, `fail_consequence`, `success_unlock`, `is_paid`, `is_free` (dropped by the allowlist), `payment_amount`, `browse_pool_bias`, **`scene_set_id`**, **`venue_name`**, **`venue_address`**, `event_date`, `event_time` | **Yes, the whole object:** `{ ...md.canon_consequences, automation: { ...md.canon_consequences.automation, ...18 hydrated fields } }` (`:4297-4303`). The fallback PUT (`:4318-4322`) sends it again, plus `name`, `host`, `description`, `prestige` and `status`. |
| **P3. Modal Mark Ready** (`fieldsToSave`, `:4210-4218`) | `status`, `host`, `host_brand`, `dress_code`, `venue_name`, `venue_address`, `event_date`, `event_time`, `description`, `narrative_stakes`, `cost_coins`, `strictness`, `deadline_type` | No |
| **P4. Modal AI Enhance** (`:3658-3668`) | Changed keys from its `saveable` list only | No |
| **P5. Form edit Save**: `saveEvent` (`:569-607`), after `openEditEvent` (`:559-567`) | `{ ...EMPTY_EVENT, ...listRow }`, so **every allowlisted key the list row has**, including `canon_consequences`, `source_profile_id`, `venue_location_id`, `venue_*`, `scene_set_id`, `outfit_set_id`, `outfit_pieces`, `status` and `used_in_episode_id`. Also sends **`EMPTY_EVENT`'s blanks for `theme`/`mood`/`floral_style`/`border_style`/`color_palette`**, because the list row never has those keys | Yes, the whole object |
| **P6. AI Fix Apply** (`applyAiFix`, `:994`) | `{ ...listRow, ...updates }`: the same as P5 without the `EMPTY_EVENT` blanks | Yes, the whole object |
| **P7. Bulk AI Enhance** (`:1102`) | Only keys that are empty on the list row | Only if the AI returns one, and only when the row's is empty |

### P5 and P6 usually fail, and when they don't, they overwrite

`outfit_pieces` is in `allowedFields` but **not** in `jsonFields`, so it reaches Sequelize's
`injectReplacements` as a raw JS array. Sequelize formats named replacements with
`format = true` (`node_modules/sequelize/lib/utils/sql.js:133`). That turns an array into a bare
comma list (`sql-string.js:5`, `:51`) and throws on an object element (`:54`). Run locally, no
database:

```
$ NODE_PATH=/home/user/Episode-Canonical-Control-Record/node_modules node -e "
const { injectReplacements } = require('sequelize/lib/utils/sql');
const { Sequelize } = require('sequelize');
const d = new Sequelize('postgres://x@localhost/x', { logging: false }).dialect;
const sql = 'UPDATE world_events SET outfit_pieces = :outfit_pieces, parent_event_id = :parent_event_id WHERE id = :eventId';
for (const v of [null, [], [{ id: 'w1', name: 'Silk Slip' }]]) {
  try { console.log(JSON.stringify(v), '=>', injectReplacements(sql, d, { outfit_pieces: v, parent_event_id: null, eventId: 'e1' })); }
  catch (e) { console.log(JSON.stringify(v), '=> THROWS:', e.message.split('\n')[0]); }
}"
null => UPDATE world_events SET outfit_pieces = NULL, parent_event_id = NULL WHERE id = 'e1'
[] => UPDATE world_events SET outfit_pieces = , parent_event_id = NULL WHERE id = 'e1'
[{"id":"w1","name":"Silk Slip"}] => THROWS: Invalid value { id: 'w1', name: 'Silk Slip' }
EXIT: 0
```

(Sequelize 6.37.8, the version in `package-lock.json`.)

What that means for P5 and P6:

- **`outfit_pieces` is `[]` or a list of pieces.** The `UPDATE` is malformed SQL or throws.
  Neither error text contains `does not exist` or `column`, so the column-missing retry
  (`worldEvents.js:712`) is skipped. The route returns 500 and **nothing is written**.
  `[]` is what `WorldEvent.create` gives every model-created event (model default,
  `WorldEvent.js:179`, `outfit_pieces`). A list of pieces is what `PUT .../outfit` writes
  (`worldEvents.js:3037-3040`).
- **`outfit_pieces` is `NULL`.** This covers rows created by raw `INSERT` paths that don't list
  the column (e.g. `feedEventPipelineService.js:444`, `eventAutomationService.js:611`,
  `worldEvents.js:2450`) when the database default is `NULL` (migration
  `20260720000000-add-outfit-pieces-to-world-events.js` adds the column with
  `defaultValue: null`; the later `20260804000000` only adds it if missing). Here the save
  **succeeds**. It rewrites `canon_consequences`, `source_profile_id`, `venue_location_id`,
  `venue_name`, `venue_address`, `scene_set_id`, `name`, `host`, `status` and
  `used_in_episode_id` to the list-row values. For P5, it also **sets `theme`, `mood`,
  `floral_style` and `border_style` to NULL and `color_palette` to `[]` on every successful
  save, stale or not**, because the form never loaded them.
- **Edge case:** if a piece's inspected text happened to contain the word "column", the
  "Invalid value" error would take the retry branch (`:712-777`). That branch rewrites
  `canon_consequences` (a `coreFields` member, `:718-727`) from the stale copy.

**Can't be settled from a repo read:** how many real rows have `outfit_pieces IS NULL`. That
depends on which migration created the column on RDS and which paths created each row. A
`SELECT count(*) FILTER (WHERE outfit_pieces IS NULL) FROM world_events WHERE deleted_at IS NULL`
would answer it. This document ran nothing.

### Per Event Package-owned field: would an old-editor save undo it?

"Stale" means the Event Package wrote the field after the modal's or list's copy was taken.

| Event Package field | P1 | P2 💾 Save | P3 Mark Ready | P5 / P6 (only when `outfit_pieces` is NULL) |
|---|---|---|---|---|
| `automation.guest_profiles` (featured, story_role, added guests) | Safe | **Overwritten with the stale copy** | Safe | **Overwritten with the stale copy** |
| `venue_location_id` | Safe | Safe (not sent) | Safe | **Overwritten with the stale copy** |
| `venue_name`, `venue_address` | Only if typed | **Overwritten with the stale copy.** The FK stays new, so the name no longer matches the linked location | **Same as P2** | **Overwritten with the stale copy** |
| `source_profile_id` | Safe | Safe (not sent) | Safe | **Overwritten with the stale copy** |
| `host` (Change Host writes it) | Only if typed | **Overwritten with the stale copy or the automation copy.** It can then disagree with `source_profile_id` | **Same as P2** | **Overwritten with the stale copy** |
| `scene_set_id` | Only via its own controls | **Overwritten with the stale copy if non-null.** A null is skipped (`:4294`), so it never unlinks | Safe | **Overwritten with the stale copy** |
| `name` (Suggest names) | Only if typed | **Overwritten with the stale copy** | Safe | **Overwritten with the stale copy** |
| Invitation: `invitation_asset_id` | Safe | Safe: not in the PUT allowlist | Safe | Safe: not in the allowlist |
| Invitation: `canon_consequences.invitation_text` | Safe | **Overwritten with the stale copy** (see scenario A) | Safe | **Overwritten with the stale copy** |
| `outfit_pieces` / `outfit_set_id` (set in WorldAdmin, not the Event Package) | Safe | Safe (not sent) | Safe | **Overwritten with the stale copy** |
| `category`, `format` | Safe | Safe (not sent) | Safe | Safe: the list row doesn't have them, so they are omitted |

### Can it happen today? Yes. Two concrete scenarios

**Scenario A: one tab, no Event Package involved, reproducible from the modal alone.**

1. Open an event's Edit details. `md.canon_consequences` is the list copy.
2. Click the modal's invitation button (`InvitationButton`, `WorldAdmin.jsx:3736`).
   `generateInvitation` writes the new text into `canon_consequences.invitation_text` on the
   server with `jsonb_set` (`src/services/invitationGeneratorService.js:388-398`, reached from
   `POST .../generate-invitation`, `worldEvents.js:1302`, `:1317-1318`). The modal's
   `onGenerated` patches only `invitation_url` and `invitation_asset_id` into its state
   (`:3737`). `loadData()` refreshes `worldEvents`, not `eventDetailModal`.
3. Click 💾 Save. P2 sends the pre-generation `canon_consequences`, which replaces the row's.
   `invitation_text` is gone. `GET .../invitation-text` (`worldEvents.js:1337-1347`) now
   returns `null` or the old text. The re-render route's own `jsonb_set` (`:1411`) is
   overwritten in the same way.

**Scenario B: Event Package guest work undone.**

1. WorldAdmin's Events tab is loaded in one tab or window.
2. In another, the Event Package features a guest and sets a story role (`saveGuestProfiles`,
   which PUTs the full `canon_consequences`).
3. Back in the first tab, the list is not refetched. Open that event's Edit details and click
   💾 Save.
4. P2 replaces `canon_consequences` with the copy taken in step 1. The `featured` and
   `story_role` flags are gone. So is any guest added from the feed.
5. The same save also puts back the old `venue_name`, `venue_address`, `host` and
   `scene_set_id` (if non-null) and `name`. `venue_location_id` and `source_profile_id` keep
   the Event Package's values, so the pairs now disagree.

This needs the two surfaces open at once. Within one tab, going from the Event Package to "Edit
details" remounts WorldAdmin and refetches, so the modal starts from the Event Package's latest
write, and a Save right after that loses nothing of the Event Package's.

**What P2 writes even when nothing is stale:** the made-up `event_date`, `event_time` and
`dress_code` (and the rare `cost_coins`, `strictness` and `deadline_type`), into both the
columns and `automation`. After that save, the Event Package's Basics shows the made-up date as a
real column value, no longer marked "saved copy".

---

## 6. A proposed order for moving the remaining fields (no recommendation on whether)

This is ordered so each step removes a dependency the next one would otherwise hit. It is not a
plan anyone has approved.

**0. Before any section moves: a merge-safe `canon_consequences` write.** Both surfaces
replace the whole JSONB column (§5). The Event Package guards against this on its own side;
P2, P5 and P6 do not.

- *Would need:* a server-side merge (`jsonb_set` or `||`) or a per-key endpoint, so a stale
  full-object PUT can't undo someone else's key. Alternatively, stop the old modal's 💾 Save from
  sending `canon_consequences`.
- *Open question for Evoni:* whether the `automation` copy should keep being written at all,
  given that §8(p) and `resolveEventVenueAndDate` treat it as a legacy fallback.

**1. Place (the rest of it).** The Event Package already owns `venue_location_id`, the
location-derived name and address, and `scene_set_id`. What's left is typed venue name and
address (modal, form) and `location_hint`.

- *Would need:* a ruling on whether a typed venue with no World Location is still allowed. The
  #1674 amendment says selecting a venue always sets the FK. Also a `location_hint` field.

**2. People (the rest of it).** The Event Package owns host (`source_profile_id` + `host`) and
guests. What's left is `host_brand` and free-text `host`.

- *Would need:* a brand input (§8(p) makes the brand the organizer when one is set). Also a
  decision on whether free-text `host` survives alongside Change Host.

**3. Basics.** Covers `event_type`, `event_date`, `event_time` and `description`, plus
`category` and `format`, which today nobody can edit after creation.

- *Would need:* date and time inputs that write the columns. The Event Package would show
  "Not set" where the modal shows today + 14.
- `category`/`format` selects would also need the model's `isIn` lists
  (`docs/EVENT_TAXONOMY_PLAN.md`).

**4. Style & Deliverables.** Covers `dress_code`, `dress_code_keywords`, `prestige`,
`strictness`, `deadline_type`, `deadline_minutes`, `cost_coins`, `is_paid`, `payment_amount`,
`requirements`, `rewards`, `browse_pool_bias`, `browse_pool_size`, and the outfit.

- *Would need:* editors for each. The outfit picker would need extracting from WorldAdmin
  (state from `:225`, modal from `:4534`), or linking to it.
- *Open question for Evoni:* the modal's "Free entry" option writes an `is_free` field that has
  no column.

**5. Invitation style.** Covers `theme`, `mood`, `color_palette`, `floral_style` and
`border_style`.

- *Would need:* `InvitationStyleFields` (`InvitationGenerator.jsx:533`) can be reused as it is.
  The single-event `GET` already returns these columns; the list `GET` does not.

**6. Review / narrative.** Covers `narrative_stakes`, `career_milestone`, `career_tier`,
`fail_consequence`, `success_unlock`, the narrative chain (`parent_event_id`, `chain_position`,
`chain_reason`, `seeds_future_events`) and `required_ui_overlays`.

- *Would need:* editors for each. The overlays could reuse `PUT .../overlay-selections`.

**7. Lifecycle actions.** Covers Mark Ready, Decline Invite, the episode link / Complete
Episode, the social-checklist regenerate, and Delete.

- *Would need:* a decision on Mark Ready's save-hydrated-fields behaviour (§2, §3) before it's
  copied anywhere. The draft/ready override already exists on the card.

**8. AI Enhance.** Covers the modal button and Bulk Enhance.

- *Would need:* a decision on the review step (§4). Today both save without one, and the modal
  can replace longer text you wrote.

Whichever order is chosen, P5 and P6 (the full-row spreads) stay live until the form's edit
path and `applyAiFix` are changed or removed. They are a separate risk from the sections.

---

## 7. What this document does not do

- It does not change code, remove anything from the old editor, or choose which surface owns
  any field.
- It does not recommend whether to move any section, or whether to keep the made-up defaults.
- It does not query the database. The count of rows with `outfit_pieces IS NULL`, which
  decides how often P5 and P6 succeed, is unmeasured. So is whether any row's
  `canon_consequences` has already lost guest or invitation data to P2.
- It does not re-derive the guest-store question (`docs/GUEST_OWNERSHIP_READ.md`), the wardrobe
  stores (`docs/WARDROBE_OWNERSHIP_READ.md`), or the taxonomy (`docs/EVENT_TAXONOMY_PLAN.md`).
- It did not run the app, Postgres or any route. The Sequelize behaviour in §5 was checked with
  the local library only. The exact Postgres error text for the `[]` case was not observed; it
  is a syntax error by construction.
