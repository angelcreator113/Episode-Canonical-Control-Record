# Every Other Event-Create Path: a read, not a ruling

## Status of this document

**Read-only research, not a decision.** Not filed under `docs/audit/`; rules nothing, recommends
nothing, fixes nothing. It maps every code path other than `from-profile` that inserts a
`world_events` row: what starts it, what it writes, whether it already calls a model, how many
rows one trigger can create, and whether the creation draft's inputs exist there. It is the
companion to `docs/EVENT_DRAFT_READ.md`, which maps `from-profile` itself. No code was changed;
no AI endpoint was called; no host, AWS, database or Cognito contact.

**Basis:** `origin/main` at `b676f9bfe825e53d63a60b1cda3bd8e14643dc8f` (2026-09-28). Every
file:line below is at that SHA and is paired with a stable name (function, route, constant,
button label), per `CLAUDE.md`'s living-doc rule.

**Marks.** **MEASURED** = read in the code at the basis SHA, citation given. **CANNOT-TELL** =
a repo read cannot settle it; the reason is given. Anything unmarked inside a numbered section
is MEASURED by the citation beside it.

Task: #2150. Prior art, cited not restated: `docs/EVENT_DRAFT_READ.md`,
`docs/EVENT_EPISODE_FLOW.md` §8(u)/§8(v), `src/services/eventConceptDraftService.js`
(`draftEventConcept`).

---

## 0. Short answers

- **Nine insert paths outside `from-profile`,** in six files (§1). Five have a live button in
  the app; four have no frontend caller at this basis (§1, "UI caller").
- **No path is scheduled.** Every insert is reached only from an HTTP route behind
  `requireAuth`; no timer, cron job or job queue calls any of the create functions, and no
  service calls a create route over HTTP (§3.1).
- **Batch sizes.** Seven paths create **one** event per request. The exceptions:
  `POST /memories/generate-events` creates **24** per request (one Sonnet call; no UI caller);
  `POST /world/:showId/events/bulk-seed` creates **one per array entry, uncapped** (no AI; no UI
  caller); calendar `auto-spawn` creates **up to 3** per request (server cap; every UI caller
  sends 1). The one live multi-event button is **"Auto-Fill This Month"**: one Sonnet call
  makes calendar events (asked for 3, not capped server-side), then one `auto-spawn` request
  per calendar event, **sequentially**, each creating one world event (§3.2).
- **AI already at create:** `generate-events` (Sonnet 4.6, one call for the whole batch);
  `feed-pipeline … /schedule` and `feed-enhanced … /chain` (Haiku 4.5, one call per event, for
  a one-sentence venue line in `location_hint`). The "Auto-Fill This Month" button's first step
  (`generate-seasonal`, Sonnet 4.6) calls a model, but to make calendar events, not world
  events. The others make no model call (§2).
- **`aiRateLimiter`:** only `generate-events` and the `chain` route carry it. The `schedule`
  route calls Haiku without it; `generate-seasonal` calls Sonnet without it (§2).
- **Draft inputs.** Only the calendar path (`spawnEventsFromCalendar`) has a loaded creator
  profile with every field the draft reads, and a venue name. Every path's route has a
  `userId` (`req.user`), but no service path is passed it (§5).
- **Manual creation leaves category and format empty** (the form has no input for either), and
  its venue link, creator link and invitation-style fields are sent but **not written** at
  create (§4).

---

## 1. The insert sites

Found with (run at the basis; output abridged to the non-model, non-comment lines):

```
$ grep -rnE "WorldEvent\.(create|bulkCreate|findOrCreate|upsert)\b|INSERT INTO world_events" src --include=*.js | grep -v /migrations/
src/services/feedEventPipelineService.js:486:    `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, description,
src/services/feedEventPipelineService.js:746:    `INSERT INTO world_events (id, show_id, name, event_type, host, description,
src/services/eventAutomationService.js:734:        const event = await models.WorldEvent.create(eventData);
src/services/eventAutomationService.js:738:          `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, description,
src/services/eventAutomationService.js:758:          `INSERT INTO world_events (id, show_id, name, event_type, host, description, prestige, cost_coins, strictness,
src/services/careerPipelineService.js:246:    event = await WorldEvent.create(eventData);
src/services/careerPipelineService.js:249:      `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, prestige, description,
src/routes/calendarRoutes.js:548:      const worldEvent = await WorldEvent.create({
src/routes/calendarRoutes.js:584:      `INSERT INTO world_events (id, show_id, name, event_type, description, location_hint, source_calendar_event_id, event_date, canon_consequences, status, created_at, updated_at)
src/routes/eventGeneratorRoute.js:124:        `INSERT INTO world_events
src/routes/worldEvents.js:479:      const event = await models.WorldEvent.create({
src/routes/worldEvents.js:518:      `INSERT INTO world_events
src/routes/worldEvents.js:1252:        `INSERT INTO world_events
src/routes/worldEvents.js:2672:        event = await models.WorldEvent.create(eventData);   ← from-profile, excluded
```

A wider search (`INSERT INTO world_events` or `WorldEvent.create`, anywhere outside
`node_modules`, `migrations`, `frontend` and `tests`, including `scripts/`) finds no other
file. No `queryInterface.bulkInsert('world_events', …)` exists outside migrations. The
`WorldEvent` model has no `beforeCreate`/`afterCreate` hooks (`src/models/WorldEvent.js`).

| # | Path | Route → function | Insert (file:line) | UI caller (button) |
|---|---|---|---|---|
| A | Manual create | `POST /api/v1/world/:showId/events` (`worldEvents.js:416`) | `worldEvents.js:479`; raw-SQL fallback `:518` | WorldAdmin "+ Create Manually" → `saveEvent` (`WorldAdmin.jsx:2902`, `:658`); WorldAdmin Feed template "Create This Event" (`WorldAdmin.jsx:3310`, `:3345`); `QuickEpisodeCreator` (`QuickEpisodeCreator.jsx:333`, `:373`) |
| B | Bulk seed | `POST /api/v1/world/:showId/events/bulk-seed` (`worldEvents.js:1233`) | `worldEvents.js:1252` (raw SQL only) | none found (`grep -rn bulk-seed frontend/src` → no caller) |
| C | Calendar auto-spawn | `POST /api/v1/calendar/events/:id/auto-spawn` (`calendarRoutes.js:640`) → `spawnEventsFromCalendar` (`eventAutomationService.js:577`) | `eventAutomationService.js:734`; fallbacks `:738`, `:758` | WorldAdmin "Auto-Fill This Month" (`WorldAdmin.jsx:2001`, `:2890`; label `:2019`, `:2900`); `CulturalCalendar` "🎉 Create Event" (`CulturalCalendar.jsx:297`, `:481`); `CultureEvents` `handleCreateEvent` (`CultureEvents.jsx:66`) |
| D | Calendar spawn (single) | `POST /api/v1/calendar/events/:id/spawn-world-event` (`calendarRoutes.js:504`) | `calendarRoutes.js:548`; fallback `:584` | none found |
| E | Opportunity → event | `POST /api/v1/opportunities/:showId/:id/to-event` (`opportunityRoutes.js:219`) → `convertOpportunityToEvent` (`careerPipelineService.js:195`) | `careerPipelineService.js:246`; fallback `:249` | none found (`grep -rn to-event frontend/src` → no caller) |
| F | Opportunity → event (feed pipeline) | `POST /api/v1/feed-pipeline/:showId/schedule/:opportunityId` (`feedPipelineRoutes.js:23`) → `scheduleOpportunityAsEvent` (`feedEventPipelineService.js:375`) | `feedEventPipelineService.js:486` (raw SQL only) | WorldAdmin "📅 Schedule as Event", twice (`WorldAdmin.jsx:3227`/`:3231`; `toEvent` `:8272`/`:8343`) |
| G | Chain from momentum | `POST /api/v1/feed-enhanced/:showId/chain/:eventId` (`feedEnhancedRoutes.js:74`) → `chainEventFromMomentum` (`feedEventPipelineService.js:657`) | `feedEventPipelineService.js:746` (raw SQL only) | `EventFeedDashboard` "Chain" (`EventFeedDashboard.jsx:237`, `:141`), route `/shows/:showId/feed-dashboard` (`App.jsx:395`) |
| H | Event library generator | `POST /api/v1/memories/generate-events` (`eventGeneratorRoute.js:26`, mounted `app.js:1105`) | `eventGeneratorRoute.js:124` (raw SQL only) | none live: `seedEvents` (`WorldAdmin.jsx:702`) calls it, but nothing references `seedEvents` (`grep -n "seedEvents\b"` → only its definition) |
| I | Seasonal auto-fill (two steps) | "Auto-Fill This Month" = `POST /api/v1/calendar/events/generate-seasonal` (`calendarRoutes.js:714`, makes **calendar** events) then path C once per calendar event | — (its world events are path C's) | WorldAdmin "Auto-Fill This Month" (`WorldAdmin.jsx:1989`, `:2885`) |

Row I is listed because it is the one live button that creates several world events in one
press; its inserts are path C's.

Note on the model: `WorldEvent.create` drops any key the model does not declare. The declared
attributes (`src/models/WorldEvent.js`) include `venue_location_id`, `venue_name`,
`venue_address`, `opportunity_id`, `source_profile_id`, `restrictions`, `theme`, `mood`,
`color_palette`, `floral_style`, `border_style`; they do **not** include
`source_calendar_event_id` (comment at `WorldEvent.js:109`: "may not exist").

---

## 2. Per-path table

"Auto" = `canon_consequences.automation`. "Fallback" = a raw-SQL `INSERT` used when the model
is missing or its create throws.

| # | Trigger | `requireAuth` / `aiRateLimiter` | Columns written at create | Description comes from | AI call at create (model) | Raw-SQL fallback | Writes `automation` |
|---|---|---|---|---|---|---|---|
| A | User click | yes / no (`worldEvents.js:416`) | Whatever the body carries among: `show_id, season_id, arc_id, name, event_type, category, format, host, host_brand, description, prestige, cost_coins, strictness, deadline_type, deadline_minutes, dress_code, dress_code_keywords, location_hint, narrative_stakes, event_date, event_time, canon_consequences, seeds_future_events, overlay_template, required_ui_overlays, browse_pool_bias, browse_pool_size, rewards, is_paid, payment_amount, requirements, career_tier, career_milestone, fail_consequence, success_unlock, scene_set_id, parent_event_id, chain_position, chain_reason`, `status: 'draft'` (`:479-510`) | The request body (`description \|\| null`, `:487`); the Feed-template button sends the template's `desc` (`WorldAdmin.jsx:3314`) | none | yes, `:518` (model missing only) | only what the body sends, plus `event_date_auto` when no date was sent (`withAutoScheduledDate`, `:447`) |
| B | Request (no UI) | yes / no (`:1233`) | `name, event_type, host, host_brand, description, prestige, cost_coins, strictness, deadline_type, dress_code, location_hint, narrative_stakes, browse_pool_bias, browse_pool_size, is_paid, payment_amount, requirements, career_tier, career_milestone, fail_consequence, success_unlock, event_date, canon_consequences`, `status: 'ready'` (`:1252-1296`) | Each array entry's `description` (`:1279`) | none | raw SQL is the only path | `event_date_auto` only, when no date (`:1250`) |
| C | User click | yes / no (`calendarRoutes.js:640`) | `id, show_id, name, event_type, host, host_brand (null), description, prestige, cost_coins, strictness, deadline_type, location_hint, venue_name, venue_address, event_date, event_time (null), dress_code, narrative_stakes, canon_consequences`, `status: 'ready'` (`eventAutomationService.js:708-729`). Not `venue_location_id` (only in automation, `:661`) | Template: `` `${calendarEvent.title} — ${calendarEvent.what_world_knows \|\| eventName}` `` (`:715`); the name is a random pick from `EVENT_TEMPLATES` (`generateEventName`, `:555`) | none | yes, two: `:738` (model missing), `:758` (create threw; status `'draft'`) | yes: host ids/handle/name, venue id/name/address, `guest_profiles`, `source_calendar_event_id`, `social_tasks`, date copy and `event_date_auto`, terms (`:654-706`) |
| D | Request (no UI) | yes / no (`:504`) | `show_id, name, event_type, host, host_brand, description, venue_location_id, venue_name, venue_address, event_date, event_time, canon_consequences, location_hint, dress_code, prestige, narrative_stakes, scene_set_id`, `status: 'draft'`; `source_calendar_event_id` is passed but not a declared attribute, so `WorldEvent.create` drops it (`:548-568`; §1 note) | `req.body.description \|\| calendarEvent.what_world_knows \|\| calendarEvent.title` (`:554`) | none | yes, `:584` (model missing; this one does write `source_calendar_event_id`) | `event_date_auto` only, when no date (`:542`) |
| E | Request (no UI) | yes / no (`opportunityRoutes.js:219`) | `id, show_id, name, event_type, host, host_brand, prestige, description, narrative_stakes, location_hint, dress_code, opportunity_id, restrictions, is_paid, payment_amount, event_date, canon_consequences`, `status: 'ready'` (`careerPipelineService.js:207-242`) | `opp.narrative_stakes \|\| \`${opp.opportunity_type} opportunity: ${opp.name}\`` (`:215`) | none | yes, `:249` (model missing) | yes: `source: 'opportunity'`, opportunity id/type, brand, connector handle, wardrobe brief, payment, milestone, goal id, `event_date_auto` (`:223-242`) |
| F | User click | yes / **no** (`feedPipelineRoutes.js:23`) | `id, show_id, name, event_type, host, host_brand, description, prestige, cost_coins, strictness, deadline_type, dress_code, location_hint, narrative_stakes, event_date, canon_consequences, restrictions, is_paid, payment_amount`, `status: 'ready'` (`feedEventPipelineService.js:448-495`) | `opp.narrative_stakes \|\| config.narrative_template` (`:455`) | **yes, Haiku 4.5** (`generateUniqueVenue`, `:173-211`, model `:190`): one call per event, for `location_hint` (`:404`, `:461`); skipped when no API key, random pool pick on error | raw SQL is the only path | yes: `source: 'opportunity_pipeline'`, opportunity id/type, host handle/name/`host_profile_id`, `venue_theme`, `guest_profiles`, date copy and `event_date_auto`, milestone (`:463-477`) |
| G | User click | yes / yes (`feedEnhancedRoutes.js:74`) | `id, show_id, name, event_type, host, description, prestige, cost_coins, strictness, deadline_type, dress_code (null), location_hint, narrative_stakes, event_date, canon_consequences, seeds_future_events, parent_event_id, chain_position, chain_reason, momentum_score`, `status: 'ready'` (`feedEventPipelineService.js:704-757`) | `CHAIN_NARRATIVES[type]` template, else `` `Follow-up to "${parent.name}" driven by feed momentum.` `` (`:689-698`, `:710`) | **yes, Haiku 4.5** (`generateUniqueVenue`, `:718`): one call per event, for `location_hint` | raw SQL is the only path | yes: `source: 'event_chain'`, parent id/name, chain position, host handle, `guest_profiles` (from parent), `momentum_driven`, `event_date_auto` (`:720-731`) |
| H | Request (no live UI) | yes / yes (`eventGeneratorRoute.js:26`) | `id, show_id, name, event_type, host_brand, description, prestige, cost_coins, strictness, dress_code, dress_code_keywords, location_hint, event_date, canon_consequences`, `status: 'ready'` (`:94-112`, `:124-134`) | The model's own `description` per event (`:102`; prompt asks for "2-3 sentences", `:218`) | **yes, Sonnet 4.6**, one call for the whole batch (`MODELS`, `:23`; call `:60`) | raw SQL is the only path (`ON CONFLICT DO NOTHING`) | `event_date_auto` only (`:93`, `:97`) |
| I (step 1) | User click | yes / **no** (`calendarRoutes.js:714`) | — (creates `StoryCalendarEvent` rows, `seasonalEventService.js:142`) | — | **yes, Sonnet 4.6** (`generateSeasonalEvents`, `seasonalEventService.js:60`, model `:87`), one call | — | — |

Also MEASURED, beside the table:

- **H deletes before it inserts.** With `replace_existing: true` the route runs
  `DELETE FROM world_events WHERE show_id = :show_id` (`eventGeneratorRoute.js:114-119`), a
  hard delete, before inserting the new 24. The dead `seedEvents` sends `replace_existing: true`
  whenever the show already has events (`WorldAdmin.jsx:707-709`).
- **A's `status` is always `'draft'`** (`:509`); the Feed-template button's `status: 'draft'`
  in its body (`WorldAdmin.jsx:3327`) is not read by the route.

---

## 3. Automatic paths: how many per trigger, how often

### 3.1 Nothing runs on a schedule

MEASURED. The callers of every create function are HTTP routes only:

```
$ grep -rn "spawnEventsFromCalendar" src | grep -v eventAutomationService.js
src/routes/calendarRoutes.js:660:      events = await eventAutomation.spawnEventsFromCalendar(
$ grep -rn "convertOpportunityToEvent(\|scheduleOpportunityAsEvent(\|chainEventFromMomentum(" src --include=*.js | grep -v "^src/services/"
src/routes/feedEnhancedRoutes.js:81:    const result = await chainEventFromMomentum(
src/routes/feedPipelineRoutes.js:27:    const result = await scheduleOpportunityAsEvent(req.params.opportunityId, req.params.showId, models);
src/routes/opportunityRoutes.js:227:    const result = await convertOpportunityToEvent(id, showId, models);
$ grep -rn "convertOpportunityToEvent(\|scheduleOpportunityAsEvent(\|chainEventFromMomentum(" src/services --include=*.js | grep -v "async function"
(no output)
```

The files in `src/` that start timers (`setInterval`, `node-cron`, `cron.schedule`):
`feedScheduler.js`, `JobQueueService.js`, `cfoAgent.js`, `routes/worldStudio.js`,
`routes/socialProfileBulkRoutes.js`, `routes/memories/engine.js`. None of them contains
`spawnEventsFromCalendar`, `convertOpportunityToEvent`, `scheduleOpportunityAsEvent`,
`chainEventFromMomentum`, `generateSeasonalEvents` or `INSERT INTO world_events` (per-file grep,
empty). No service calls a create route over HTTP (grep for `localhost`/`axios`/`fetch` to
these routes: empty). So every path's frequency is "when someone presses its button (or sends
its request)", and paths B, D, E and H have no button.

### 3.2 Per trigger

| # | Events per request | Per button press | Model calls per press |
|---|---|---|---|
| A | 1 | 1 | 0 |
| B | `events.length`, **no cap** (`worldEvents.js:1246`) | — (no UI) | 0 |
| C | `event_count`, capped at **3** (`Math.min(3, …)`, `calendarRoutes.js:653`); one loop iteration per event (`eventAutomationService.js:582`) | 1 (every UI caller sends `event_count: 1`: `WorldAdmin.jsx:2002`, `:2890`; `CulturalCalendar.jsx:297`; `CultureEvents.jsx:66`) | 0 |
| D | 1 | — (no UI) | 0 |
| E | 1 | — (no UI) | 0 |
| F | 1 | 1 (no loop in either caller: `WorldAdmin.jsx:3224-3229`, `:8269-8272`) | 1 Haiku |
| G | 1; chain depth capped at 5 (`feedEventPipelineService.js:669`) | 1 | 1 Haiku |
| H | the model's array length; the prompt asks for **exactly 24** (`eventGeneratorRoute.js:191`, `:228`); inserted one by one (`:122`) | — (no live UI) | 1 Sonnet |
| I | step 1 makes calendar events; step 2 is one path-C request per calendar event created, awaited one after another (`for … await`, `WorldAdmin.jsx:1998-2008`, `:2888-2892`) | **one world event per calendar event created** | 1 Sonnet (step 1) + 0 |

For I, how many calendar events step 1 creates: the UI asks for `count: 3`
(`WorldAdmin.jsx:1989`, `:2885`); the route passes `count` through with no cap
(`calendarRoutes.js:716`); the service asks the model for `${count}` events and creates one per
returned item, skipping titles that already exist that month (`seasonalEventService.js:91`,
`:134-158`). **CANNOT-TELL** how many the model returns on a given press (it is the model's
array length); the requested number is 3.

---

## 4. Manual creation: what the user supplies, what stays empty

Path A has three callers. MEASURED against the route's destructuring
(`worldEvents.js:419-439`) and its create (`:479-510`):

**WorldAdmin "+ Create Manually"** (`EMPTY_EVENT`, `WorldAdmin.jsx:131-163`; `saveEvent`,
`:653-658`). The form binds: `name, event_type, host, host_brand, description, prestige,
cost_coins, strictness, deadline_type, deadline_minutes, dress_code, dress_code_keywords,
location_hint, narrative_stakes, browse_pool_bias, browse_pool_size, is_paid, payment_amount,
career_tier, career_milestone, fail_consequence, success_unlock, rewards, requirements,
scene_set_id, venue_location_id, venue_name, venue_address, event_date, event_time,
parent_event_id, chain_position, chain_reason, seeds_future_events, required_ui_overlays,
source_profile_id` (the `eventForm.<field>` bindings in `WorldAdmin.jsx`).

- **Written** if filled: every field above except those in the next bullet.
- **Sent but not written at create:**
  - `venue_location_id`, `venue_name`, `venue_address`: the route reads them
    (`:435`) and resolves a venue name and address (`:454-476`), but the create writes neither
    column; only the resolved address reaches the row, as `location_hint` (`:492`), and the
    venue's scene set as `scene_set_id` (`:505`). `resolvedVenueName` is never written.
  - `source_profile_id` (the creator link): not in the route's destructuring.
  - `theme`, `color_palette`, `mood`, `floral_style`, `border_style` (in `EMPTY_EVENT`,
    `:153`): not in the route's destructuring.
  - `is_free`: sent by `toEventSubmitData` (`:643`, `:646`), not read by the route (it does set
    `cost_coins` to 0 for free events before sending, `:647`).
- **Always empty at create:** `category` and `format` (the form has no input for either: no
  `eventForm.category` or `eventForm.format` binding); `venue_location_id`, `venue_name`,
  `venue_address`, `source_profile_id` (above); `outfit_set_id`, `outfit_pieces`,
  `invitation_asset_id`, `restrictions`, `opportunity_id`; `canon_consequences.automation`
  except `event_date_auto`.

**WorldAdmin Feed template "Create This Event"** (`WorldAdmin.jsx:3310-3327`). Sends: `name`
(the template's), `event_type: 'invite'`, `category` (`TEMPLATE_CATEGORY_MAP`, `:91`, or null),
`description` and `narrative_stakes` (both the template's `desc`), `prestige: 5`,
`cost_coins: 150`, `dress_code: null`, `location_hint` (the template's `venue_theme`),
`canon_consequences.automation.{venue_theme, energy, category}`. Empty: `format`, `host`,
`event_time`, `dress_code`, every venue column, the creator link.

**`QuickEpisodeCreator`** (create mode `:373-387`; edit mode with no event `:333-347`). Sends:
`name`, `event_type: 'invite'`, `format`, `dress_code`, `dress_code_keywords`, `prestige`,
`strictness`, `is_paid: false`, `host_brand`, `narrative_stakes`, plus `invite_type`, `cost`,
`location`, `show_id`. Of those, `invite_type`, `cost` and `location` are not read by the route
(not in `:419-439`), so `cost_coins` takes the route default 100 (`:421`). Empty: `category`,
`description`, `host`, `event_date` (then auto-scheduled, `:447`), `event_time`, every venue
column, the creator link.

---

## 5. `draftEventConcept`'s inputs on each path

What the draft reads, MEASURED in `src/services/eventConceptDraftService.js`:
`draftEventConcept(profile, context)` (`:307`). From the profile, `buildDraftPrompt` (`:108`)
reads `display_name` or `handle`, `content_category` and `archetype`; from the context,
`venueName`. `context.userId` is only the rate-limit key (`takeDraftSlot`, `:311-315`; the
window and limit are `AI_RATE_LIMIT_WINDOW_MS` / `AI_RATE_LIMIT_PER_IP`, `:79-80`). Model:
Haiku 4.5 (`MODELS`, `:43`). `from-profile` passes the Feed creator's row, the linked venue's
name and `req.user?.id` (`worldEvents.js:2547`).

| # | Creator profile (the four fields) | Venue name | `userId` | Missing |
|---|---|---|---|---|
| A | **No.** Nothing loads a profile; `source_profile_id` is dropped at create (§4); `host` is free text | **Partly.** `resolvedVenueName` exists in the handler when a `venue_location_id` or `venue_name` is sent (`:454-461`), but is not saved | yes (`req.user`, route has `requireAuth`) | profile |
| B | No | No (only `location_hint`) | yes (route) | profile, venue |
| C | **Yes.** `findHostProfile` loads `SocialProfile` with `handle, display_name, content_category, archetype` (`eventAutomationService.js:130-153`); may be null when no host matches (`:584-585`) | **Yes**, `venueName` (`:623`), found or auto-created (`:612-622`) | route has it (`calendarRoutes.js:640`), but `spawnEventsFromCalendar` is not passed it (`:660-662`) | `userId` plumbing; profile when no host matches |
| D | No (`host` is from the body) | Yes (`venue?.name \|\| calendarEvent.location_name`, `calendarRoutes.js:556`) | yes (route) | profile |
| E | **No row.** `convertOpportunityToEvent` loads no profile; the opportunity has `connector_profile_id` (`Opportunity.js:41`) but the function does not read it | `opp.venue_name` (`careerPipelineService.js:217`, saved as `location_hint`) | route has it; the service is not passed it (`opportunityRoutes.js:227`) | profile row (id available on the opportunity), `userId` plumbing |
| F | **Id only.** `opp.connector_profile_id` is read (`feedEventPipelineService.js:413`, `:470`) but the profile row is not loaded; `assembleGuestList` is given `{ id }` only (`:417`) | **No name.** `location_hint` is the Haiku venue *description* (`:404`), not a venue name | route has it; the service is not passed it (`feedPipelineRoutes.js:27`) | profile row, venue name, `userId` plumbing |
| G | No (parent's `host_handle` only, `:726`) | No name (Haiku description, `:718`) | route has it; not passed (`feedEnhancedRoutes.js:81`) | profile, venue name, `userId` plumbing |
| H | No | No name (model's `location_hint`) | yes (route) | profile, venue |

---

## 6. Could not tell (collected)

- **How many calendar events "Auto-Fill This Month" creates per press** (§3.2, row I): the
  request asks for 3, nothing caps it, and the count is the model's reply length.
- **Whether paths B, D, E and H are called from outside this repository** (a script, a
  bookmarklet, another client): a repo read shows only that no file here calls them.
- **Whether `generateUniqueVenue`'s and `generateSeasonalEvents`' model calls are recorded by
  `aiCostTracker`:** neither file references it (`grep -n aiCostTracker` → empty); whether the
  SDK is wrapped elsewhere at runtime was not traced. Not asked by #2150; noted because it bears
  on the cost question.

---

*Type: read. Rules nothing. Recommends nothing. Changes no code. No AI endpoint called; no
host, AWS, database or Cognito contact.*
