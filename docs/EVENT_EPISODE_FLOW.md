# Event → Episode Flow

## Status of this document

**Living design authority.** This is not a register document — it is not filed
under `docs/audit/`, it carries no basis-SHA immutability rule, and it is
meant to be edited in place through the normal task loop as the flow it
describes changes. It rules nothing and mints no FD/XK/PE number. Where a
claim below is verified against the code, it says so with a file:line;
where something doesn't resolve from a repo read, it says that instead of
guessing.

Basis for the file:line citations below: `origin/main` at
`c8c4ec8b6a600be2f70f8621630878e6a02d8211` (2026-09-20).

---

## 1. One canonical event record

There is **one** canonical event record: `world_events` (model
`src/models/WorldEvent.js`). Two things feed it and read from it without
being it:

- **The Feed** (`social_profiles`) supplies the host — a `WorldEvent`
  optionally carries `source_profile_id`, a durable FK to `SocialProfile`
  (`src/models/WorldEvent.js:76`, association at `:291-296`:
  `WorldEvent.belongsTo(models.SocialProfile, { foreignKey:
  'source_profile_id', as: 'sourceProfile' })`). The model's own comment
  at `:289-290` calls this FK the durable copy of a legacy JSONB pointer
  (`canon_consequences.automation.host_profile_id`) added by migration
  `20260807`.
- **`feed_posts`** are separate content records, not events. `FeedPost`
  (`src/models/FeedPost.js`, `tableName: 'feed_posts'` at `:74`) carries
  its own `event_id` column (`:14`, nullable UUID) pointing back at the
  `world_events` row a post is about. A post is commentary generated
  *about* an event; it is never the event itself.

`world_events` also carries `used_in_episode_id`, the FK an episode is
reached through (§2 below), and `canon_consequences.automation`, a JSONB
grab-bag that predates several of the durable FKs and still carries
duplicate copies of some of them (host handle/display name, venue,
guest profiles) — read as history, not as the source of truth once a
durable column exists for the same fact.

---

## 2. The canonical sequence

```
HOST → EVENT → EVENT PACKAGE → EVENT READY → GENERATE EPISODE → PRODUCE →
EVALUATE/ACCEPT → AFTERMATH → NEXT EVENT
```

### HOST

A `SocialProfile` row (the Feed). Supplies `handle`, `display_name`,
`content_category`, `archetype`, `follower_tier`, `brand_partnerships`,
`aesthetic_dna`, and (per `src/routes/worldEvents.js:1996`) an optional
`registry_character_id` link into the Character Registry.

### EVENT

`POST /world/:showId/events/from-profile`
(`src/routes/worldEvents.js:1988-2214`) creates a `WorldEvent` from a
`SocialProfile`. It:

- loads the profile (`:1995-1998`);
- derives prestige, cost, strictness, deadline type, dress code, and an
  archetype-driven invitation style (theme/mood/color-palette/floral/
  border) from the profile's `archetype`/`content_category`/
  `aesthetic_dna` (`:2001-2080`);
- finds or creates a venue via `eventAutomationService.findVenue` /
  `.ensureVenueLocation` (`:2004-2018`, service at
  `src/services/eventAutomationService.js:214` and `:271`);
- assembles a guest list via `eventAutomationService.assembleGuestList`
  (`:2024`, service at `src/services/eventAutomationService.js:339`);
- inserts the row (Sequelize `WorldEvent.create`, falling back to two
  tiers of raw SQL if that fails, `:2163-2207`) with **`status: 'draft'`**
  (`:2160`).

`source_profile_id` is set at `:2090` (reconfirmed at this document's
current basis, `a29c1d8c`). This is the Feed's own path into EVENT; a
second, independently-wired path exists — see "EVENT (calendar-driven)"
below. Beyond those two, other writers create events from opportunities
or momentum chains (§4 enumerates them — they also set a status, just not
`'draft'`).

### EVENT (calendar-driven)

**Scope:** traced end to end only for `story_calendar_events` rows with
`event_type: 'lalaverse_cultural'`. The same table also carries
`'world_event'`, `'story_event'`, and `'character_event'` rows
(`src/routes/calendarRoutes.js:531-536`'s `typeMap`) — this document does
not resolve whether those three feed EVENT the same way; not ruled in,
not ruled out.

Two UI surfaces reach the same backend pipeline:

- Producer Mode's "Auto-Fill This Month" button
  (`frontend/src/pages/WorldAdmin.jsx:1823-1859`, duplicated verbatim as
  an empty-state call-to-action at `:3313-3335`) calls `POST
  /calendar/events/generate-seasonal`, then `POST
  /calendar/events/:id/auto-spawn` once per calendar event it created.
- Culture & Events' "Create Event" button
  (`frontend/src/pages/CultureEvents.jsx:62-70`, `handleCreateEvent`)
  calls the same `POST /calendar/events/:id/auto-spawn` endpoint
  directly, against a `StoryCalendarEvent` row the page already has in
  hand.

`generate-seasonal` (`src/routes/calendarRoutes.js:699-719`) delegates to
`seasonalEventService.generateSeasonalEvents`
(`src/services/seasonalEventService.js:60`), which creates the
`StoryCalendarEvent` rows this path runs on, each with `event_type:
'lalaverse_cultural'` (`seasonalEventService.js:144`) — the same
`event_type` Culture & Events' own Events tab reads
(`docs/PAGE_INVENTORY.md` §4, cited there, not re-derived here).

`auto-spawn` (`src/routes/calendarRoutes.js:625-693`) loads the
`StoryCalendarEvent` by id and calls
`eventAutomationService.spawnEventsFromCalendar` directly (`:645`) — the
same function §4 already lists as a `status: 'ready'` writer
(`eventAutomationService.js:600`), now with the page that reaches it
identified (see §4's note on that row).

`spawnEventsFromCalendar` (`eventAutomationService.js:478-611`) writes
`source_calendar_event_id` onto the new `WorldEvent` (`:541`) — a real
FK, not an incidental label: `GET /calendar/events/:id/spawned`
(`calendarRoutes.js:599-618`) reads it straight back via
`WorldEvent.findAll({ where: { source_calendar_event_id } })`.

### HOST — recorded two different ways

The two EVENT creation paths record HOST differently, and nothing in
this document — or in either code path — reconciles them:

- **from-profile** writes the durable, top-level
  `WorldEvent.source_profile_id` column (`worldEvents.js:2090`, above).
- **calendar-driven** finds a host via `findHostProfile`
  (`eventAutomationService.js:106-119`, querying `models.SocialProfile`
  — the same model HOST names above) but writes it only to
  `canon_consequences.automation.host_profile_id`
  (`eventAutomationService.js:532`) — the JSONB copy, never the
  top-level column.

So an event's host lives in a different place depending on which door it
came through. Anything that reads `source_profile_id` to find an event's
host — a report, a migration, a future feature — will silently miss
every calendar-spawned event. This is the same class of problem §4
already records for guests (`canon_consequences.automation.guest_profiles`
vs. the separate top-level `guest_list` column) — recorded here at equal
weight, not resolved, same as that one isn't.

### EVENT PACKAGE

Five sub-parts, each verified separately:

**Venue.** `venue_location_id` (durable FK to `WorldLocation`),
`venue_name`, `venue_address` — set by the `from-profile` route
(`:2101-2103`) or by `PUT /world/:showId/events/:eventId`'s
`allowedFields` list (`src/routes/worldEvents.js:312`). A code comment at
`:2097-2100` explains *why* the top-level FK exists alongside the JSONB
copy: without it, "the venue only lives nested in
`canon_consequences.automation` and Overview's Locations card... shows
nothing for feed-profile-spawned events."

**Guests.** Two homes, not one — worth stating plainly since they don't
always agree. `canon_consequences.automation.guest_profiles` is populated
by every event-creation path this document found (e.g.
`src/routes/worldEvents.js:2124`, from `assembleGuestList`). A separate
top-level `guest_list` column exists too, added by migration
`src/migrations/20260709000000-enrich-locations-and-events.js:97-104`
and accepted by the event `PUT` route's `allowedFields`
(`src/routes/worldEvents.js:313`) — but `src/models/WorldEvent.js:64`
flags it in a comment as "may not exist," meaning it isn't in the
Sequelize model's own attribute list. This document does not resolve
which of the two a reader should treat as authoritative when they
disagree; it only records that both exist.

**Invitation.** A four-step pipeline, all in `src/routes/worldEvents.js`:
- generate — `POST .../generate-invitation` (`:1041-1073`), calls
  `invitationGeneratorService.generateInvitation` (`:1056`), requires
  `FAL_KEY` (`:1045-1049`).
- edit — `POST .../edit-invitation-text` (`:1510`), rewrites
  opening/body/closing against the existing asset.
- render — `POST .../re-render-invitation` (`:1093`), re-renders a new
  image over the same background with edited text; also
  `POST .../animate-invitation` (`:1411`) for a video variant.
- approve — `POST .../approve-invitation` (`:1196-1226`), sets
  `assets.approval_status = 'approved'` and stamps the asset's
  `episode_id` from the event's `used_in_episode_id` if one exists yet
  (`:1206-1217`); `POST .../reject-invitation` (`:1271`) is the inverse.

`WorldEvent.invitation_asset_id` (`src/models/WorldEvent.js:67`) is the
event's own pointer to the current invitation asset.

**Requirements.** `WorldEvent.requirements`, a `JSONB` column, default
`{}` (`src/models/WorldEvent.js:183-187`). Accepted by the `PUT` route's
`allowedFields` (`:309`). This document found no dedicated read/write
service for it beyond the generic event `PUT`/`GET` — it appears to be a
free-form field a creator or the AI can populate, not a structured,
independently-validated sub-object like the outfit or invitation are.

**Outfit.** `WorldEvent.outfit_set_id` (UUID) and `outfit_pieces` (JSONB
snapshot) — `src/models/WorldEvent.js:116-127`, with the model's own
comment stating the design intent directly: *"Outfit chosen when the
event is created. The episode reads this through `used_in_episode_id` so
creators only pick wardrobe once (on the event) and every episode that
uses the event inherits it."* The picker is
`GET/PUT /world/:showId/events/:eventId/outfit`
(`src/routes/worldEvents.js:2675-2773`) plus
`GET .../wardrobe-options` (`:2776`) for the browsable list. See §5(b)
for what this endpoint does and does not touch.

### EVENT READY

**This is the section where the issue's own framing does not match what
the code does, and the H1 rule says to write that plainly rather than
restate the assumption.**

There is a computed, non-persisted readiness indicator, in Producer
Mode's event card
(`frontend/src/pages/WorldAdmin.jsx:3184-3231`). It checks four things —
`hasOutfit`, `hasVenue`, `hasScene`, `hasInvite` (`:3197-3200`) — and
renders the label `READY` or `PRE-FLIGHT` (`:3210-3211`) depending on
whether all four are set. Two things worth being precise about:

1. **It checks four of the Event Package's five parts, not five.**
   Guests and Requirements are not among the four checks; only Venue,
   Scene, Invite, and Outfit are.
2. **It does not gate "Generate Episode."** The code's own comment,
   directly above the check (`:3184-3187`), says so:
   *"Pre-flight readiness — what's set vs missing before Generate
   Episode is clicked. **Doesn't block**, but tells the creator at a
   glance what the AI will have to work with."* The "Generate Episode"
   button (`:3256-3276`) is conditioned only on `!linkedEpisode` — not
   yet linked to an episode — with no reference to `allReady` or the
   `checks` array anywhere in its `onClick`. A creator can generate an
   episode from an event showing `PRE-FLIGHT` with all four chips
   unset.

So: "Event Ready," as a gate that blocks episode generation until a
computed condition is met, **does not exist at this basis**. What exists
is an at-a-glance indicator with the same name-in-spirit that is
explicitly documented, in its own code, as advisory only. This document
records that distinction rather than asserting the gate the issue
described, since the acceptance check for this document is a repo read,
not a restatement.

### GENERATE EPISODE

`POST /world/:showId/events/:eventId/generate-episode`
(`src/routes/worldEvents.js:1687-1767`), `POST
.../generate-episode-from-many` (`:1779`, multi-event anchor generation),
and `POST .../regenerate-episode` (`:1889`, clears the old link and
re-runs). All delegate to
`episodeGeneratorService.generateEpisodeFromEvent`
(`src/services/episodeGeneratorService.js:328`), which — among building
the episode, brief, scene plan, and social task list — links any
pre-selected outfit pieces to the new episode (`:790-804`), links any
assets already tagged with the event's id (`:806-848`), and marks the
event used:

```js
// src/services/episodeGeneratorService.js:850-863
await models.WorldEvent.update(
  { status: 'used', used_in_episode_id: episode.id },
  { where: { id: event.id } }
);
```

`used_in_episode_id` is read back by a long list of services to find
"the event behind this episode" — `episodeScriptWriterService.js:108`,
`groundedScriptGeneratorService.js:92`, `financialTransactionService.js:355`,
`scenePlannerService.js:106`, `distributionService.js:89`,
`feedPostGeneratorService.js:39`, `todoListService.js:442,679`,
`episodeCompletionService.js:138`, `storyGenerationService.js:69`,
`wardrobeIntelligenceService.js:826`, `careerPipelineService.js:249,254`,
and the route layer at `worldEvents.js:930,1207,3759`, `episodes.js:932`,
`evaluation.js:281`, `wardrobe.js:172,962,1593`. This is the join key the
entire rest of the pipeline hangs off, once an event has been generated
into an episode.

### PRODUCE

Owned entirely by Episode Detail (`frontend/src/pages/EpisodeDetail.jsx`),
whose tab structure names the stage directly:

```js
// frontend/src/pages/EpisodeDetail.jsx:85-91
{ key: 'production', icon: '🎬', label: 'Production', subs: [
  { key: 'assets', label: 'Assets' },
  { key: 'scenes', label: 'Scenes' },
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'phone', label: 'Phone' },
  { key: 'checklist', label: 'Production Checklist' },
]},
```

### EVALUATE/ACCEPT

Two distinct states, not one — this matters for §4 below.
`POST /episodes/:id/evaluate` (`src/routes/evaluation.js:238`) computes a
score and saves it with `evaluation_status: 'computed'`
(`:380-384`, the exact write) — a preview the creator can still adjust
via `POST /episodes/:id/override` (`:403`, style/tier adjustments) before
accepting. `POST /episodes/:id/accept` (`:520`) is marked deprecated in
its own code comment and proxies to the unified pipeline,
`episodeCompletionService.completeEpisode`
(`src/services/episodeCompletionService.js`), which applies stat deltas,
finalizes financials, and — in the same write —
sets `evaluation_status = 'accepted'` (`:440`). The `/accept` route
itself guards against double-acceptance by checking exactly that value
(`src/routes/evaluation.js:530-532`:
`if (episode.evaluation_status === 'accepted') return
res.status(400)...`).

### AFTERMATH

Three mechanisms, and the honest state of each, since none of them lines
up neatly with "after the episode wraps":

1. **Character sync + opportunity generation** — called from inside
   `generateEpisodeFromEvent` itself
   (`src/services/episodeGeneratorService.js:865-879`), i.e. at
   **generation** time, not after evaluate/accept.
2. **Feed activity** — same location, same timing; see §5(a), which is
   entirely about this mechanism's timing mismatch with its own
   self-description.
3. **Career pipeline cascade** — `careerPipelineService.onEpisodeCompleted`
   (`src/services/careerPipelineService.js:239-336`) advances
   opportunities and career goals, and reads the episode's linked event
   via `used_in_episode_id` (`:249-254`) — the shape of a genuine
   post-completion aftermath step. It is reachable at
   `POST /opportunities/:showId/episode-complete/:episodeId`
   (`src/routes/opportunityRoutes.js:302-309`). **This document found no
   caller of that route anywhere under `frontend/src`** — a grep for
   `episode-complete` across `frontend/src` returns nothing. Whether
   this cascade fires by some path this document didn't find (a script,
   a cron, a manual call) does not resolve from this read; recorded as
   not resolving rather than assumed either way.

### NEXT EVENT

`feedEventPipelineService.suggestNextEvents`
(`src/services/feedEventPipelineService.js:453`) and
`.chainEventFromMomentum` (`:582`, sets `status: 'ready'` on the new
event at `:659` — see §4) generate candidate next events. On the
frontend, `NextEventSuggestionsOverlay`
(`frontend/src/components/Episodes/NextEventSuggestionsOverlay.jsx`)
surfaces ranked suggestions from
`GET /world/:showId/events/next-suggestions` and creates the next
episode via the same `generate-episode-from-many` endpoint GENERATE
EPISODE uses (`:51-58`). Its own auto-open trigger, timing, and
persistence were the subject of a separate, already-shipped task (issue
#1583 / PR #1584) and are not re-described here.

---

## 3. Ownership split

**Producer Mode** (`frontend/src/pages/WorldAdmin.jsx`, self-described in
its own header comment as "Producer Mode Dashboard," `:1-16`) owns the
*lifecycle* view: where every event and episode is, what's ready, what's
next. Its header comment lists seven tabs including "Events Library —
Reusable event catalog (create, edit, inject)" and "Episode Ledger — All
episodes with tier/score/deltas" (`:8-9`) — but that comment is itself
stale against the actual tab set (`:173-175` names a `feed`-group with
three sub-tabs the comment doesn't mention at all — see below). Either
way: a catalog and a ledger, not a single episode's workspace.

**Episode Detail** (`frontend/src/pages/EpisodeDetail.jsx`) owns the work
for *one* episode. Its tabs (§2, PRODUCE) walk Overview → Script →
Production (Assets/Scenes/Wardrobe/Phone/Checklist) → Results
(Evaluation/Story/Distribution) — the same page becomes that episode's
permanent record as each stage's work lands on it, ending in the
Evaluation tab once EVALUATE/ACCEPT has run.

### Lala's Feed, Feed Events, and Events Library — three views, one dataset

Producer Mode's `feed` tab has three sub-tabs
(`frontend/src/pages/WorldAdmin.jsx:173-175`):

```js
{ key: 'feed-timeline', label: "Lala's Feed" },
{ key: 'feed-events', label: 'Feed Events' },
{ key: 'events', label: 'Events Library' },
```

**Lala's Feed** (`subTab === 'feed-timeline'`, `:1800-1804`) embeds
`SocialProfileGenerator` — the component's own header comment names it
plainly: *"SocialProfileGenerator.jsx — The Feed"*
(`frontend/src/pages/SocialProfileGenerator.jsx:2`). **This is where
`from-profile` is reachable from**: the component exports
`createEventFromProfileApi`, which `POST`s
`/world/:showId/events/from-profile` (`:35-36`) — the same route EVENT
(§2) describes. It queries `SocialProfile` rows via `GET /api/v1/social-
profiles` (`fetchProfiles`, `:38`, base path from
`frontend/src/pages/feed/feedConstants.js:5`), and separately fetches the
same events list Feed Events/Events Library use
(`listWorldEventsApi` → `GET /world/:showId/events`, `:33-34`) to
cross-reference which profiles already have an event.

**Feed Events** and **Events Library** query nothing of their own —
both read the single `worldEvents` state array Producer Mode fetches once
via `GET /api/v1/world/:showId/events`
(`src/routes/worldEvents.js:35`, called from
`frontend/src/pages/WorldAdmin.jsx:507`) and then filter client-side:

- Feed Events (`:1807-1814`, description at `:1812`: *"Create events from
  templates or profiles. Complete the details here, then mark ready to
  move to the Events Library."*) shows exactly
  `worldEvents.filter(ev => ev.status === 'draft')` (`:1818`).
- Events Library (`:3048-3053`) explicitly excludes the same set —
  `if (ev.status === 'draft') return false; // Drafts shown in Feed
  Events tab` (`:3051`) — then applies its own status/search sub-filters
  on top.

So the `status` field's `'draft'` value is not just a database default —
it is the literal switch this UI uses to decide which of two tabs an
event appears in. See §4 for what else this document found riding on
`status` beyond the model's own four-value comment.

---

## 4. The readiness distinction

**These are two different things that share a word, and nothing in this
document — or in the flow work this document describes — treats them as
one or rewrites the persisted value to match the computed one.**

### `world_events.status` — persisted, assigned inconsistently

```js
// src/models/WorldEvent.js:207-212
status: {
  type: DataTypes.STRING(20),
  allowNull: false,
  defaultValue: 'draft',
  comment: 'draft | ready | used | archived',
},
```

A free string column, not a Postgres enum — nothing at the database or
model layer restricts it to those four values. Every writer of
`status: 'ready'` found at this basis:

| Writer | Function | Context |
|---|---|---|
| `src/services/feedEventPipelineService.js:424` | `scheduleOpportunityAsEvent` (`:344`) | turning a feed opportunity into a scheduled event |
| `src/services/feedEventPipelineService.js:659` | `chainEventFromMomentum` (`:582`) | chaining a new event off a completed one's momentum |
| `src/services/eventAutomationService.js:600` | `spawnEventsFromCalendar` (`:478`) | calendar-driven event spawning |
| `src/services/careerPipelineService.js:210` | `convertOpportunityToEvent` (`:178`) | promoting a career opportunity to an event |
| `src/routes/eventGeneratorRoute.js:103` | `POST /generate-events` handler (`:25`) | bulk AI-generated event insert |

Five independent writers, four different services plus one route, all
setting the literal string `'ready'` at event-creation time as part of
their own insert — not as a follow-up transition once some condition is
met. None of the four EVENT READY checks (§2) feed into any of these
writes.

**One of these five now has a known page.** The `eventAutomationService.js:600`
row above was listed as a writer with no page attached to it. §2's new
"EVENT (calendar-driven)" subsection traces it to two: Producer Mode's
"Auto-Fill This Month" button and Culture & Events' "Create Event"
button — both call the same `auto-spawn` route, which calls this exact
function. Whether the same gap holds for the other four rows
(`feedEventPipelineService.js`'s two functions, `careerPipelineService.js`'s
`convertOpportunityToEvent`, `eventGeneratorRoute.js`'s `POST
/generate-events`) was not checked here.

The event `PUT` route (`PUT /api/v1/world/:showId/events/:eventId`,
`src/routes/worldEvents.js:284`) accepts `status` as one of its editable
`allowedFields` (`:307`) and one of its `scalarStringFields` (`:345`) —
written straight into a dynamic `SET` clause. It is in
`_requiredStringFields` (`:330`), which this document confirmed (by
reading the full handler body, `:284` through the next `router.`
declaration) means only "must be a non-empty string" — there is no
`['draft','ready','used','archived'].includes(...)` check or equivalent
anywhere in the handler. A creator (or a bug) can `PUT` any string into
`status`, including `'ready'` on an event missing every one of the four
EVENT READY checks, or something outside the four-value comment
entirely.

**"Outside the four-value comment" is not hypothetical — this document
found two more literal values actually written, and a third checked for
but never written:**

- `'filmed'` — `episodeCompletionService.js`'s `completeEpisode`
  (`:122`) overwrites the linked event's `status` a second time, *after*
  GENERATE EPISODE already set it to `'used'` (§2): `// ── 15. Update
  event status to 'filmed' ──` / `` `UPDATE world_events SET status =
  'filmed', ...`` (`:454-458`). So a single event's `status` legitimately
  moves through at least three values across the pipeline —
  `draft`/`ready` → `used` → `filmed` — not the four-state model the
  comment describes.
- `'declined'` — `financialPressureService.js`'s `recordDeclinedInvite`
  (`:88`) sets `status: 'declined'` (`:119`) when Lala can't afford an
  invite's cost.
- `'scripted'` — checked for but never found written. Producer Mode's
  Events Library filter treats it as equivalent to `used`/`filmed`
  (`frontend/src/pages/WorldAdmin.jsx:3052`:
  `eventStatusFilter === 'used' && (ev.status === 'used' || ev.status
  === 'scripted' || ev.status === 'filmed')`), but a repo-wide search for
  `status: 'scripted'` or `status = 'scripted'` in `src/` returns
  nothing. The UI is prepared for a value this document found no writer
  of.

### "Event Ready" (Producer Mode) — computed, not persisted

Described fully in §2. Recomputed from the event's own fields
(`outfit_set_id`/`outfit_pieces`, `venue_location_id`/`venue_name`,
`scene_set_id`, `invitation_asset_id`) on every render of the event card
(`frontend/src/pages/WorldAdmin.jsx:3196-3207`). Never written back to
the database. Does not, at this basis, gate anything — see §2's EVENT
READY section for the code comment stating that directly.

### Convergence is out of scope here

Making the persisted `status` reflect the computed check — or vice
versa — is deliberate future cleanup, not something this document rules
on or that any of the reads above performed. Nothing in this document
changes, proposes changing, or recommends changing `world_events.status`
for any row.

---

## 5. Two open mismatches

Recorded as questions this document does not rule on. Whether either
warrants an audit finding, a Fix Plan item, or no action at all is
Evoni's call.

### (a) `feedActivityService` calls itself post-event; it runs at generation time

`feedActivityService.js`'s own module docstring:

```js
// src/services/feedActivityService.js:3-8
/**
 * Feed Activity Service
 *
 * Generates post-event social media activity from attendee profiles.
 * After an event episode, each attendee generates 1-2 posts about
 * the event based on their archetype and relationship to the host.
```

Its post templates lean on the same framing — `"Last night was
everything..."` (`:21`), `"Still processing last night at {event}..."`
(`:26`). "After," "last night": the service's own description places it
temporally after the event has narratively happened — which, in this
pipeline, would be after PRODUCE and after EVALUATE/ACCEPT, once the
episode telling that story is actually done.

`generatePostEventActivity` is in fact called from inside
`generateEpisodeFromEvent`:

```js
// src/services/episodeGeneratorService.js:881-889
// Generate post-event feed activity
let feedPosts = [];
try {
  const feedActivity = require('./feedActivityService');
  feedPosts = await feedActivity.generatePostEventActivity(event, models);
  ...
```

— i.e. at **GENERATE EPISODE** time, synchronously, in the same function
call that creates the episode, links its outfit and assets, and marks
the event `used`. This document independently confirmed
`episodeCompletionService.js` (the actual EVALUATE/ACCEPT → completion
path) contains no call to `feedActivityService` or
`generatePostEventActivity` at all (grepped the file; no hits) — so the
"after the event" feed posts exist in the database before the episode
they describe has been produced or evaluated, let alone accepted.

This document does not assert this is a bug, does not propose moving the
call, and does not rule on whether it warrants an audit finding — that
determination is named in the issue as Evoni's, not this document's, and
this document leaves it exactly that open.

### (b) Does event-time outfit selection touch the wardrobe money path?

**Answered, from `main`:** no — the event-time outfit flow does not
write to the purchase path.

The money path lives entirely in `src/routes/wardrobe.js`:
`POST /api/v1/wardrobe/browse-pool` (`:945`) computes `can_purchase`
per item against live `character_state.coins` (`:1078,1117-1118`); a
select-time auto-purchase (`:1229-1275`) and the standalone
`POST /api/v1/wardrobe/purchase` (`:1323-1438`) both debit coins with a
direct `UPDATE character_state SET coins = ...` (`:1251`, `:1371`) and
log a `wardrobe_purchase` transaction (`:1256-1258`, `:1377-1385`) plus a
`character_state_history` row (`:1399-1400`) — this is the surface F-Stats-1
and F-Sec-3 both already have findings against.

The event-time outfit picker is a different code path entirely:
`GET /world/:showId/events/:eventId/wardrobe-options`
(`src/routes/worldEvents.js:2776-2814`) reads straight from the
`wardrobe` table (`:2790-2797`, including `is_owned` and `coin_cost` as
plain display fields), and
`PUT /world/:showId/events/:eventId/outfit` (`:2697-2773`) loads the
chosen `wardrobe_ids` by `SELECT ... FROM wardrobe WHERE id IN (:ids)`
(`:2716-2722`), scores the outfit, and writes the snapshot straight to
`world_events.outfit_pieces`/`outfit_score` (`:2762-2766`). No read or
write of `character_state` appears anywhere in either handler, and
neither calls into `wardrobe.js`'s purchase or select-time-purchase
code.

One observation worth recording alongside the answer, without ruling on
it: the event picker does not check `is_owned` before allowing a
selection — an unowned, coin-locked item can be written into
`world_events.outfit_pieces` via this path with no purchase ever
occurring. Whether that's intentional (an outfit *plan* rather than an
owned outfit) or a gap is not something this document decides.

**Open question, recorded but not answered here:** "never calls the
purchase path" is not the same guarantee as "only ever references
clothes Lala owns." If an event can point at an `outfit_set_id` or
`outfit_pieces` entry she never bought, the episode has her wearing
something she can't afford — a canon and economy question (does the
story treat this as an error, a debt, a narrative beat, or nothing at
all?), not a code question this document's reads can settle. Left open.

---

## 6. What this document does not do

- does not change any code, create any migration, or implement any
  stage of this flow;
- does not rule on either mismatch in §5, or on the `status` vs
  "Event Ready" convergence named in §4;
- does not edit anything under `docs/audit/`, and is not itself an
  audit-register document;
- mints no FD, XK, or PE number.
