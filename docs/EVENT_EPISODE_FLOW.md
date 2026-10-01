# Event → Episode Flow

## Status of this document

**Living design authority.** This is not a register document — it is not filed
under `docs/audit/`, it carries no basis-SHA immutability rule, and it is
meant to be edited in place through the normal task loop as the flow it
describes changes. It rules nothing and mints no FD/XK/PE number. Where a
claim below is verified against the code, it says so with a file:line;
where something doesn't resolve from a repo read, it says that instead of
guessing. New citations added to this document cite by stable name
(component, function, `TABS` key) with any line number paired alongside
it, not by line number alone — existing file:line-only citations above
predate this rule and are converted opportunistically when their section
is next edited, not swept in one pass.

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

### Lala's Feed and Events — two views, one dataset

Producer Mode's `feed` tab has two sub-tabs
(`frontend/src/pages/WorldAdmin.jsx:172-175`):

```js
{ key: 'feed-timeline', label: "Lala's Feed" },
{ key: 'events', label: 'Events' },
```

(Until PR #1590, Feed Events and Events Library were two separate
sub-tabs here; that PR merged them into the single `events` sub-tab
above. This section describes the merged structure as of this basis,
superseding this document's own earlier text about a three-tab split.)

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
same events list the Events sub-tab uses
(`listWorldEventsApi` → `GET /world/:showId/events`, `:33-34`) to
cross-reference which profiles already have an event.

**Events** (`subTab === 'events'`, `:1808` onward) queries nothing of its
own — it reads the single `worldEvents` state array Producer Mode fetches
once via `GET /api/v1/world/:showId/events`
(`src/routes/worldEvents.js:35`, called from
`frontend/src/pages/WorldAdmin.jsx:508`), unfiltered by status at fetch
time. Every event — draft included — lists here; `status` is now a
client-side filter control on top of that one list, not a boundary
between tabs:

- The header stats line (`:1813-1819`) leads with `{worldEvents.length}
  events` — the full count, drafts included.
- A row of filter chips (`:2464-2482`) — All, Draft, Ready, Used, Filmed,
  Declined, one per status value something actually writes (§4) — sets
  `eventStatusFilter`.
- The grid's own filter (`:3050`) is exactly
  `eventStatusFilter === 'all' || ev.status === eventStatusFilter`: no
  hard exclusion for any status; `'all'` shows everything.

So the `status` field's values are still the literal vocabulary this UI
reads — but as of this basis they select a filter chip within one tab,
not which of two tabs an event appears in. See §4 for what else this
document found riding on `status` beyond the model's own four-value
comment.

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
- `'scripted'` — checked for but never found written. Until PR #1590,
  Producer Mode's Events Library filter treated it as equivalent to
  `used`/`filmed`; that PR replaced the grouped filter with literal
  per-status chips (§3) and dropped the `'scripted'` grouping along with
  it — there is no `'scripted'` chip, and nothing in
  `frontend/src/pages/WorldAdmin.jsx` gives that value any special UI
  treatment as of this basis. A repo-wide search for `status: 'scripted'`
  or `status = 'scripted'` in `src/`, re-run at this basis, still returns
  nothing. The value remains one this document found no writer of — and
  now no reader of either.

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

---

## 7. Decisions (Evoni, 2026-09-21)

**These are product rulings, not verified facts.** Each one is recorded as
Evoni stated it, followed by this document's own re-derivation of where
current code already agrees or conflicts. Basis for the code citations in
this section: `origin/main` at `c3ecff3ea5a579fa6169442603fca3530883c72f`
(2026-09-21) — a later basis than §§1–6 above, which are not re-walked
here.

**1. The chain.** WORLD STATE → EVENT HOST → EVENT PACKAGE → START EPISODE
→ EPISODE PLAN → SCRIPT → PRODUCE → REVIEW → EVALUATE → ACCEPT →
AFTERMATH → NEXT EVENT.

Code: §2's chain (`HOST → EVENT → EVENT PACKAGE → EVENT READY → GENERATE
EPISODE → PRODUCE → EVALUATE/ACCEPT → AFTERMATH → NEXT EVENT`) is close
but not the same list. Three differences, not reconciled here: (a) no
distinct WORLD STATE stage exists ahead of HOST in the code's own
sequence; (b) EPISODE PLAN and SCRIPT are not separate stages in the
current tab flow — see item 7 below; (c) EVENT READY (§2's computed,
non-gating indicator) and REVIEW/EVALUATE (§2's EVALUATE/ACCEPT, a
genuine two-state gate) are not the same kind of thing, and this ruling's
chain does not carry EVENT READY forward at all.

**2. No blank SAL episodes.** New Episode starts at
`/shows/:showId/new-episode` (the Feed in choose-host mode, step 1).
Existing blank-creation routes are redirected later, not deleted now.

Code: `/shows/:showId/new-episode` does not exist in
`frontend/src/App.jsx`'s route table at this basis — this names a route
not yet built. Blank-creation entry points found, none event-gated:

- `POST /api/v1/episodes` (`episodeController.createEpisode`,
  `src/routes/episodes.js:306-310`) — no `event_id`/host requirement in
  the route itself.
- `/episodes/create` → `CreateEpisode.jsx` (`frontend/src/App.jsx:345`),
  which calls the route above via `episodeService.createEpisode`
  (`frontend/src/services/episodeService.js:43-45`).
- `/shows/:showId/quick-episode` → `QuickEpisodeCreator.jsx`
  (`frontend/src/App.jsx:360`), whose own header comment
  (`frontend/src/components/QuickEpisodeCreator.jsx:1-15`) describes a
  different, self-contained path: "creates episode + event + injects
  event + generates script skeleton" in one submit, calling
  `POST /api/v1/episodes` (`:349`) and
  `POST /api/v1/world/:showId/events/:eventId/inject` (`:341,382`)
  directly rather than going through EVENT PACKAGE or GENERATE EPISODE at
  all. The same component also mounts at `/episodes/:episodeId/edit`
  (`App.jsx:346`) for edit mode.

**3. Templates repeat; events happen; episodes record what happened.** A
WorldEvent is one occurrence and starts at most one episode. Supersedes
the earlier "events are reusable" rule.

Code: reusable/inject language is still live, not just in stale comments.
Found:
- Comment: `frontend/src/pages/WorldAdmin.jsx:9` — "Events Library —
  Reusable event catalog (create, edit, inject)" (already flagged stale
  against the tab set by §3 above, for a different reason).
- Comment: `src/migrations/20260219000003-world-events.js:4-5` — "Creates
  world_events table for the reusable event catalog. Events can be
  injected into episodes and feed the evaluation system." This is the
  March-era design the migration itself still documents.
- Column: `WorldEvent.times_used` (`src/models/WorldEvent.js:217`),
  incremented on every injection — a counter has no reason to exist for a
  fact that can only ever be 0 or 1.
- Route: `POST /api/v1/world/:showId/events/:eventId/inject`
  (`src/routes/worldEvents.js:588-662`) sets `used_in_episode_id`,
  `status`, and increments `times_used` unconditionally on every call
  (`:656-663`) — no check for an existing `used_in_episode_id` before
  overwriting it. Calling it twice on the same event with two different
  `episode_id` values re-points the event at the second episode; nothing
  in this route rejects that.
- **Live UI features that reassign, not just old code.**
  `WorldAdmin.jsx`'s event-detail modal has a "Reassign" action that
  calls this same `/inject` endpoint to move an event's
  `used_in_episode_id` from one episode to another (`:918-934`,
  `:810-811`), and a bulk swap that reassigns two events between two
  episodes in one action (`:749-750`, both events' `used_in_episode_id`
  set to the other's episode). These are reachable buttons, not dead
  code — the clearest present-tense conflict with "at most one episode."

**Old data may break the rule (owed, not investigated further here — see
§9).** The `/inject` route's lack of a re-link guard means any
`WorldEvent` this route (or the Reassign/swap actions) touched more than
once already carries a `used_in_episode_id` that no longer matches its
full history — a live code path, not a hypothetical one from the March
design doc.

**4. Event Package page.** `/shows/:showId/events/:eventId`, one page for
create and edit, sections: Basics, People, Place, Invitation, Style &
Deliverables, Review. Create Event opens it instead of the modal. The
Event Package chooses only the event location; Episode → Scenes chooses
all other locations.

Code: no such route exists in `frontend/src/App.jsx` at this basis, and
no "Event Package" component was found — nothing to conflict with since
nothing occupies the name yet. The six named sections map loosely, not
one-to-one, onto §2's five existing EVENT PACKAGE parts (Venue, Guests,
Invitation, Requirements, Outfit) — People/Place split what §2 calls
Venue+Guests differently, and Requirements has no obvious home in the
six-section list. Left for whoever builds the page.

**5. One home per truth — ownership table.** Event Host
(`source_profile_id`), Venue (`WorldLocation`), Visual venue (`SceneSet`),
Invitation, Outfit (`outfit_set_id`). Guests: canonical representation
OPEN. Display names are derived, not separately editable.

Code: matches §1 and §2 closely, field for field —
`WorldEvent.source_profile_id` (`src/models/WorldEvent.js:76`, `:291-296`
association) for Host; `venue_location_id` (§2 Venue) for Venue;
`WorldEvent.scene_set_id` (`src/models/WorldEvent.js:61`, association
`:264`) for Visual venue; `invitation_asset_id` (§2 Invitation,
`WorldEvent.js:67`) for Invitation; `outfit_set_id`/`outfit_pieces` (§2
Outfit, `WorldEvent.js:116-127`) for Outfit. Guests remaining OPEN matches
§2's own finding that guests have two homes, not one
(`canon_consequences.automation.guest_profiles` vs. the separate
`guest_list` column) — this ruling does not resolve that, and neither did
§2.

**6. "Generate Episode" becomes "Start Episode." Read-only once started.**
Services reading the event snapshot instead of the live row deferred to
F-Stats-1 Phase B.

Code: the current button is literally labeled "Generate Episode"
(§2 GENERATE EPISODE, `frontend/src/pages/WorldAdmin.jsx:3256-3276`) — the
rename has not happened. Read-only has not happened either, and this is
more than a naming gap: item 3's Reassign/swap actions actively rewrite
`used_in_episode_id` on events already marked `used`, and the event `PUT`
route's `allowedFields` (§4 above, `worldEvents.js:307`) has no
status-conditioned gate — nothing in `WorldAdmin.jsx` disables an event's
edit fields once `status === 'used'` (checked: every `status === 'used'`
reference in that file is a count, filter, or badge, not a `disabled`
condition). An event stays editable, and reassignable, after it starts an
episode.

**7. Episode Plan precedes the script.** Context, title, wardrobe,
locations, scene plan. "Write Script" with "Generate Draft" inside.

Code: `EpisodeDetail.jsx`'s tab order is Overview → Script → Production
(§2 PRODUCE, `frontend/src/pages/EpisodeDetail.jsx:82-97`) — no distinct
"Episode Plan" step sits between them. A "Scene Planner" page exists
(`frontend/src/pages/ScenePlannerPage.jsx`, route
`/episodes/:episodeId/plan`, `App.jsx:372`) but is not wired into the
Overview→Script→Production flow — it is a standalone route this document
found no in-flow link to. `EpisodeScriptTab.jsx` calls
`POST /api/v1/episode-brief/:episodeId/generate-script` (`:200`) but has
no "Write Script" or "Generate Draft" labels at this basis (grepped the
file; no hits) — the UI copy this ruling names does not exist yet.

**8. Source vs presentation.** The Event Package owns source facts;
Episode Production owns how they appear. Presentation never re-creates a
source fact.

Code: agrees with the one clear example already in this document. The
Outfit model comment states the design intent directly — "Outfit chosen
when the event is created. The episode reads this through
`used_in_episode_id` so creators only pick wardrobe once (on the event)
and every episode that uses the event inherits it" (§2 Outfit,
`WorldEvent.js:116-127`). That is source-owns-fact,
presentation-only-reads, exactly as this ruling states it — for outfit.
This document did not check whether every other EVENT PACKAGE part
(venue, invitation, guests) holds the same property at production time;
only outfit's comment states it this plainly.

**9. Open = orient. Continue = move forward.**

Code: **conflicts.** `EpisodeCard.jsx`'s "Open" button
(`frontend/src/components/EpisodeCard.jsx:109`) navigates to
`/episodes/:episodeId` with no query string. `EpisodeDetail.jsx`'s own
header comment calls `EpisodeOverviewTab` "the default tab"
(`frontend/src/pages/EpisodeDetail.jsx:7`), but the component's actual
default is `useState(searchParams.get('tab') || 'checklist')`
(`:66`) — with no `?tab=` param, "Open" lands on Production → Production
Checklist, not Overview. The comment and the code disagree with each
other, and the code disagrees with this ruling. No "Continue" labeled
control was found to check against the second half of the ruling.

**10. Definitions.** Episode To-Do Overlays (audience-facing, authored in
Assets); Episode Run Sheet (producer tracker, EpisodeTodoPage); Lala's
Phone (the phone system) with Preview Phone as its preview action; Create
Thumbnail (target decided after `docs/THUMBNAIL_SYSTEM.md`, not yet).

Code: **agrees, as of the immediately preceding commit.**
`EpisodeAssetsTab.jsx:258` reads "Episode To-Do Overlays" with the
subheading "Show/game overlays the audience sees during the episode — not
the production checklist" (`:261`) — the audience/production distinction
this ruling draws, in the code's own words.
`EpisodeTodoPage.jsx` titles itself "Episode Run Sheet" (`:140`, loading
and empty states at `:103,108`). `EpisodeDetail.jsx` labels the button
"Preview Phone" (`:851,854`) and comments describe it as the phone
player's trigger (`:17,842,1013`). `UIOverlaysTab.jsx` names itself "Phone
Hub" in its header comment (`:2`) and on-page heading (`:1294`). All four
were renamed/split by the immediately preceding commit on this branch's
basis (`c3ecff3ea refactor(frontend): separate Episode Run Sheet from
To-Do Overlays, rename Preview Phone [skip-automerge] (#1606)`) — this
ruling's naming and that commit are the same work. `docs/THUMBNAIL_SYSTEM.md`
exists, matching the "decided after" plan. One thing not yet open: the
"Create Thumbnail" button already has a target —
`/episodes/:id/scene-composer` (`EpisodeDetail.jsx:476`) — so the code
has moved past "not yet" on the destination even though the ruling frames
it as still pending.

**Amended — Task #1615, Evoni's ruling, 2026-09-21.** "Episode To-Do
Overlays (audience-facing...)" is corrected: the lists are **Lala's**,
and she sees them on her phone — consistent with the persistent-phone
rule (§8(h)/(i)) and with beat 9's canonical `surface` ("Lala's Phone",
`diegetic: true`; the to-do/reminder beat). Only their *presentation
styling* — how they're rendered for the audience watching the show — is
the show's. `EpisodeAssetsTab.jsx:261`'s own subheading, "Show/game
overlays the audience sees during the episode," describes the styling
layer accurately but reads as if the audience is the intended perceiver
of the list itself, which this amendment corrects: Lala is.

**11. Money: Event Review shows a budget forecast only. Only acceptance
mutates balances.**

Code: no "Event Review" page or component was found at this basis — the
forecast-only surface this ruling names does not exist yet, so nothing
conflicts with that half directly. But "only acceptance mutates balances"
already conflicts with a live path: wardrobe's select-time auto-purchase
(§5(b) above, `src/routes/wardrobe.js:1229-1275`) and the standalone
purchase endpoint (`:1323-1438`) both debit `character_state.coins`
immediately (`:1251,1371`), independent of any episode's
evaluate/accept state. The event-time outfit picker itself does not touch
money (§5(b), confirmed no read/write of `character_state` in either of
its handlers) — so within EVENT PACKAGE specifically, this ruling holds;
the conflict is in the wider wardrobe purchase flow the ruling does not
mention.

**12. Aftermath orchestration at Accept belongs to F-Stats-1 Phase B.**

Code: agrees with what §2's own AFTERMATH section and §5(a) already
record, and does not resolve the mismatch either document leaves open.
Character sync, opportunity generation, and feed activity all fire from
inside `generateEpisodeFromEvent` at **generation** time
(`src/services/episodeGeneratorService.js:865-889`), not at
evaluate/accept. `careerPipelineService.onEpisodeCompleted`
(`src/services/careerPipelineService.js:239-336`) is the one mechanism
shaped like genuine post-completion aftermath, reachable at
`POST /opportunities/:showId/episode-complete/:episodeId`
(`src/routes/opportunityRoutes.js:302-309`) — and §2 already recorded
finding no caller of that route anywhere under `frontend/src`, re-checked
here with the same negative result. This ruling assigns the real
orchestration work to F-Stats-1 Phase B rather than asking this document
to resolve the existing mismatch, which is consistent with §5(a)'s own
choice not to rule on it.

**13. Creative laws (Evoni): stats are felt, never stated; failure stays
elegant; nothing resets.**

Code: the show-brain franchise-laws seeder
(`src/seeders/20260312800000-show-brain-franchise-laws.js`) states
related but not identically-worded rules. Stats: "Stats are NEVER
displayed raw as a dashboard... The viewer feels it but never sees a
number. This is the most powerful layer" (`:197,210`, Stat System entry)
— a close match for "felt, never stated." Failure: "Failure episodes must
never be softened. Failure has weight or the world has no rules." (`:536`,
Locked Canon Rules) — related to "elegant" but not the same word choice;
"never softened" is about weight/consequence, "elegant" is about how it's
delivered, and this document does not treat them as interchangeable.
Resets: the seeder states a narrower rule, not a universal one — Dream
Fund "accumulates... never resets mid-season" (`:238`, Show Economy entry)
and `character_state` is "per-show, not per-episode — one row tracks
cumulative progression" (`:537`, Locked Canon Rules) — both support the
spirit of "nothing resets" within their own scope, but neither states it
as a general law the way this ruling does.

---

## 8. Open decisions

Recorded as open. This document does not choose between them.

**(a) The canonical 14-beat structure — RESOLVED (Evoni, 2026-09-21, Task
#1609).** The show-brain seeder's names and order are canon.
`episodeGeneratorService.js`'s `phase` and `emotional_intent` fields
survive as a layer on top of the canonical beats, mapped by content, not
by position — proposed mapping pending Evoni's approval, not yet
committed to code; see the open item (d) below and PR #1610's body for
the full table. Single source of truth: `src/constants/canonicalBeats.js`
(`CANONICAL_BEATS`, names/order/`typical_location`/description copied
verbatim from `scenePlannerService.js`'s pre-existing `BEAT_STRUCTURE`,
which already matched the seeder exactly). `scenePlannerService.js` now
imports it (`const { CANONICAL_BEATS: BEAT_STRUCTURE } =
require('../constants/canonicalBeats')`) — a pure refactor, no behavior
change. `episodeGeneratorService.js`'s `BEAT_TEMPLATES` is **not yet**
converted to import it; it still writes its own narrative names
(`The Notification`, `The Decision`, ...) into `scene_plans.beat_name` at
generation time (`episodeGeneratorService.js:633-649`) until the mapping
below is approved and a follow-up task converts it and
`feedMomentsService.js` together, so the two are never briefly out of
sync with each other.

**Beat 5 corrected — Task #1611, Evoni's ruling 2026-09-21.** Beat 5
("Reveal") is the invitation/opportunity reveal — "Lala reads the mail.
Audience sees her unfiltered reaction" (seeder, verbatim) — not an outfit
reveal. `scenePlannerService.js`'s pre-#1610 `BEAT_STRUCTURE`, copied
verbatim into `canonicalBeats.js` by #1610 without independently
re-checking it against the seeder, had beat 5 at `typical_location:
'CLOSET'` with description "The outfit/look reveal — wardrobe becomes
part of the narrative." Same name and position as the seeder's beat 5,
different content — #1610 verified names/order matched and didn't check
descriptions past that. Corrected in `canonicalBeats.js` (`description`,
`typical_location`); `scenePlannerService.js` needed no direct edit since
it already reads both fields from the shared module (confirmed: grepped
the file for every `beat`/`BEAT` reference — no beat-5-specific or
`CLOSET`-specific special case exists there). This changes which scene
set new scene plans assign to beat 5 going forward: `typical_location`
drives `generateScenePlan`'s AI prompt (`scenePlannerService.js:148`),
so beat 5 now prompts toward a `HOME_BASE`-type scene set instead of
`CLOSET` for episodes generated after this task. No stored `scene_plans`
rows are migrated.

The three-way comparison that led to this ruling, kept for the record:

| Beat | `episodeGeneratorService.js` `BEAT_TEMPLATES` (`:253-267`) | `scenePlannerService.js` `BEAT_STRUCTURE` (`:22-37`) | show-brain seeder, Episode Architecture (`20260312800000-show-brain-franchise-laws.js:254-269`) |
|---|---|---|---|
| 1 | The Notification | Opening Ritual | Opening Ritual |
| 2 | The Decision | Login Sequence | Login Sequence |
| 3 | The Closet | Welcome | Welcome |
| 4 | Getting Ready | Interruption Pulse 1 | Interruption Pulse #1 |
| 5 | The Post | Reveal | Reveal |
| 6 | The Arrival | Strategic Reaction | Strategic Reaction |
| 7 | The Room Read | Interruption Pulse 2 | Interruption Pulse #2 |
| 8 | The Encounter | Transformation Loop | Transformation Loop |
| 9 | The Main Event | Reminder/Deadline | Reminder / Deadline Pulse |
| 10 | The Complication | Event Travel | Event Travel |
| 11 | The Content Moment | Event Outcome | Event Outcome |
| 12 | The Exit | Deliverable Creation | Deliverable Creation |
| 13 | The Aftermath | Recap Panel | Recap Panel |
| 14 | The Recap | Cliffhanger | Cliffhanger |

`scenePlannerService.js`'s `BEAT_STRUCTURE` and the show-brain seeder's
14-beat list are the same structure — same 14 names, same order, same
screen-state/production-mechanic framing (headphones, login overlay,
transformation loop, deliverable export). `episodeGeneratorService.js`'s
`BEAT_TEMPLATES` is a different structure entirely: a plain narrative
"before/during/after" arc (Notification → Decision → Closet → ... →
Recap) with no reference to login rituals, screen states, or the
show-brain's UI mechanics, carrying its own `phase` and `emotional_intent`
fields the other two don't have. Both were called "14 beats" / "14-beat
structure" in their own code; they did not describe the same 14 things.
The ruling above picks the first two (already identical) as canon.

**(b) Guests' canonical representation.** Left OPEN by decision 5. §2
already records the two existing homes
(`canon_consequences.automation.guest_profiles` vs. the top-level
`guest_list` column, itself flagged in `WorldEvent.js:64` as possibly not
in the Sequelize model) without resolving which should be authoritative;
this document does not resolve it either.

**(c) Brand/entity hosts — RESOLVED (Evoni, 2026-09-22; see (p) below).**
Not addressed by any decision above or by any code this document found.
`source_profile_id` (item 5) points at `SocialProfile`, which §2's HOST
section describes entirely in creator-profile terms (handle,
`content_category`, `archetype`, `follower_tier`) — whether a brand or
other non-creator entity can be a host through the same column, or needs
a different one, is open. **Resolved, not deleted — see (p) below: an
organizer is a creator or a brand, `host_brand` is the interim storage
for the brand case, and §2's HOST section above (a `SocialProfile` row,
full stop) is now incomplete rather than wrong — it describes the
creator-organizer path only.**

**(d) The old-beat → canonical-beat content mapping (Task #1609).**
Opened by resolving (a). `episodeGeneratorService.js`'s `phase` and
`emotional_intent` fields, and `feedMomentsService.js`'s
`BEAT_PHONE_MOMENTS` phone-moment content, were both built against the
*old* narrative order (`episodeGeneratorService`'s `BEAT_TEMPLATES`
positions), not the canonical one — matching by position instead of
content would put the wrong emotional intent, and the wrong phone
moment, on the wrong canonical beat (e.g. canonical beat 3 "Welcome" is
not an outfit beat; the old position 3 "The Closet" was). A proposed
beat-by-beat mapping (content-matched, nulls where no genuine legacy
equivalent exists, covering `phase`/`emotional_intent`/phone-moment
content together as one table) was worked out in PR #1610's body for
Evoni's approval. `feedMomentsService.js` also hardcodes beat position in
three more places beyond `BEAT_PHONE_MOMENTS` — an unconditional
purchase-decision moment at position 3 (`:143-176`, display-only, no
`character_state`/coin mutation — confirmed by reading the call chain
into `feedPostGeneratorService.js:347` and `FeedMoment.financial_context`)
and two before/during/after splits keyed on `beat.beat <= 5`/`<= 12`
(`:117-128`, `:250`, `:338`) — all of which assume the old position
semantics and need the same content-based fix, not a positional one.
**Converted — Task #1613, see (g) below.** Both files now import
`canonicalBeats.js`; the four position-hardcodes are gone.

**(e) Every canonical beat carries nine fields (Task #1611).** Rule: each
of the 14 entries in `src/constants/canonicalBeats.js` records `name`,
`narrative_purpose`, `typical_location`, `screen_action`, `actor`,
`surface`, `diegetic`, `phase`, and `emotional_intent` — sourced by name
or ruled directly by Evoni, not invented. `actor`, `surface`, and
`diegetic` use three distinct states, never collapsed: `null` = not yet
decided; the string `'none'` = decided, intentionally nothing; any other
value = decided. As of the second follow-up ruling below, every field on
every beat is decided (a value or an explicit `'none'`) except
`typical_location`, which stays proposed-not-sourced for all 14. See (f)
below for the rule that makes `actor` and `diegetic` independent axes
rather than one. Sourcing:

- `name`/`typical_location`/`description` — pre-existing fields
  `scenePlannerService.js`'s AI prompt actually reads; unchanged from
  #1610 except beat 5 (above).
- `narrative_purpose` — the seeder's own `desc` text, verbatim, for all
  14 beats. Added as its own field rather than folded into `description`
  because three more beats' existing `description` text (authored before
  either #1610 or #1611, for the AI prompt) reads differently in
  substance from the seeder's own words — not contradictions on the
  scale of beat 5, but real differences, left uncorrected here since only
  beat 5 was in this task's scope: beat 2 ("Checking phone/social —
  receives the episode catalyst" vs. the seeder's "Login overlay →
  typing animation → Enter. World loads." — a phone-check framing versus
  a whole-episode meta/loading-screen framing, not obviously the same
  mechanism); beat 11 ("what happens when Lala arrives and performs" vs.
  the seeder's "the evaluation resolves. Pass or fail. Stats update." —
  a live-performance framing versus a scoring/results framing); beat 13
  ("audience engagement moment" vs. the seeder's "cinematic stat card.
  Coins changed..." — the existing text doesn't mention the stat-card UI
  moment the seeder names directly). Recorded here as found, not
  resolved.
- `typical_location` was never seeder-sourced for **any** beat, not only
  beat 5 — the seeder
  (`20260312800000-show-brain-franchise-laws.js:254-269`) has no location
  field at all. Every value in `canonicalBeats.js` (all 14, beat 5
  included) is carried from `scenePlannerService.js`'s own pre-existing,
  unattributed `BEAT_STRUCTURE` — proposed, not sourced from the seeder
  as this decision's own framing assumed going in.
- Beat naming also drifts from the seeder in punctuation for three beats
  — seeder: "Interruption Pulse #1", "Interruption Pulse #2", "Reminder /
  Deadline Pulse"; code `name` field (unchanged, matches #1610): 
  "Interruption Pulse 1", "Interruption Pulse 2", "Reminder/Deadline".
  Same beats, same order, punctuation only — not corrected here since it
  isn't beat 5 and changing `name` would change
  `scenePlannerService.js`'s live AI-prompt text for those beats, outside
  this task's no-other-behavior-change scope. Recorded, not resolved.
- `screen_action` — the `ui` field from `episodeScriptWriterService.js`'s
  and `groundedScriptGeneratorService.js`'s own `BEAT_TEMPLATES` dicts,
  confirmed identical for all 14 beats at this basis (compared line by
  line) — no disagreement to record between the two.
- `actor`, `surface`, `diegetic` — nothing in the codebase names any of
  these concepts for beats; all three are ruled directly by Evoni,
  2026-09-21, across two follow-up commits to Task #1611 (the first
  filled `surface`/`diegetic` for 6 of 14 beats and added `actor`; the
  second filled the remaining 8 cells — `actor` for beats 9–14, `diegetic`
  for beat 3). Every beat now carries all three, a value or an explicit
  `'none'`. Two values changed from the session's original (unapproved)
  first-commit proposal once the actor/diegetic axes were separated out:
  beat 5's `diegetic` flips from `false` to `true` (JustAWoman is the
  *actor* who clicks — Lala still perceives the *result*, the same
  letter, just shown enlarged for the audience); beat 8's `diegetic`
  flips from `true` to `false` (JustAWoman chooses in the Closet UI; Lala
  only perceives the outcome — wearing it — not the choosing itself).
  Beat 14's `surface` also changed, from the session's original proposed
  `'None'` to `'Audience Overlay'`. Beat 5's `description` — "the physical
  letter shows on screen" — is Evoni's own wording, her ruling,
  2026-09-21; not this document's, not either PR's.
- `phase`/`emotional_intent` — for beats 4, 6, 8, 10, 11, 12, 13: the
  content-matched mapping from PR #1610's body (from
  `episodeGeneratorService.js`'s `BEAT_TEMPLATES`, matched by content,
  never by position) — beat 10 paired with legacy "The Arrival" (during /
  awe_or_intimidation), dropped by the session in the first #1611 commit
  and restored in the second once Evoni caught the omission. For beats 1,
  2, 3, 5, 7, 9, 14: no legacy match existed in that mapping (all were
  `null`); Evoni supplied these seven directly, across the same two
  follow-up rulings as `actor` — not derived from
  `episodeGeneratorService.js` at all. None of this is adopted by
  `episodeGeneratorService.js` itself yet — see (d) above.

**(f) The SAL interaction law (Evoni, 2026-09-21).** JustAWoman may act
through the show's interface layer without Lala perceiving it; Lala
experiences the canonical consequences as events in her world. Three
layers, plus a fourth state for beats with no screen presentation at all:

| Layer | Surfaces | Who acts |
|---|---|---|
| Host Environment | Host Environment | JustAWoman |
| Interface | Audience Overlay, Closet UI | Either — presented to the audience or operated by JustAWoman; not automatically perceived by Lala |
| Lala's World | Lala's Phone, Lala's Environment | Diegetic to Lala by construction — these are the surfaces where a presented result is something she perceives |
| *(no surface)* | `'none'` | — |

This is what makes `actor` and `diegetic` independent rather than
redundant: `actor` says who *performs* the screen action (JustAWoman,
Lala, or no one); `diegetic` says whether Lala *perceives the result*.
Beat 5 (actor `justawoman`, surface Audience Overlay, diegetic `true`)
and beat 8 (actor `justawoman`, surface Closet UI, diegetic `false`) are
both JustAWoman-acted Interface-layer beats that land on opposite sides
of `diegetic` — the law is what makes both readings coherent rather than
contradictory.

**(g) Generation converted to canonical beats (Task #1613).**
`episodeGeneratorService.js`'s `BEAT_TEMPLATES` now derives from
`canonicalBeats.js` (`CANONICAL_BEATS.map(...)`, same field shape —
`beat`/`label`/`phase`/`emotional_intent`/`description` — so the
`scene_plans` insert, the `generateFeedMoments` call, and the brief
response it feeds all carry canonical names automatically). Both writers
of `scene_plans` (this file and `scenePlannerService.js`, since #1610)
now write canonical `beat_name` values for new episodes; existing rows
keep whatever they were generated with — no migration. The one frontend
consumer of the brief's returned `beats` field,
`frontend/src/pages/WorldAdmin.jsx:4997-5014` ("14 Beats Timeline"),
reads `beat.label`/`beat.description`/`beat.phase`/`beat.emotional_intent`
generically — no hardcoded old-name assumption found, so it displays
canonical content automatically, no frontend change needed.

`feedMomentsService.js` now imports `canonicalBeats.js`'s `phase` for
all three of its former position-based before/during/after splits
(`:117-128` trigger-profile selection, `:309` content-template
selection, `:397` JustAWoman's own dialogue selection) and re-keys
`BEAT_PHONE_MOMENTS` by canonical beat, proposed against each beat's own
`actor`/`surface`/`diegetic` (full table and reasoning in PR #1614's
body): moments proposed for beats 4, 6, 7, 12 (7 authored fresh, no
legacy equivalent existed); explicit `null` — not a guessed default —
for the others. Two things Task #1613 got proposed but wrong, corrected
by Evoni's ruling the same PR, second commit (h) below: the
purchase-decision moment (removed, not moved to beat 8 — it was never a
Lala moment) and beats 10/13 (restored, not dropped — see (h)).

**Owed, not touched by Task #1613/#1614** (still on their own beat
lists, per explicit scope): `episodeScriptWriterService.js`'s and
`groundedScriptGeneratorService.js`'s local `BEAT_TEMPLATES` fallback
dicts (§8(e) above — already agree with canonical names/order, used
only when a stored `scene_plans` row lacks `beat_name`, so no urgency);
`src/utils/scriptBeatParser.js`'s own `BEAT_TYPES` (§8(a)'s original
research — a genuinely different, fourth structure, confirmed to never
reach evaluation).

**(h) Lala's phone is persistent; some overlays transition (Evoni,
2026-09-21, Task #1614).** Two corrections to (g)'s proposal, and one
new standing rule:

1. **The purchase-decision moment is removed from `feedMomentsService.js`**,
   not relocated. It was proposed at canonical beat 8 in (g) above on the
   reasoning that beat 8's `actor` (justawoman) and content (choosing the
   outfit) matched — but the moment itself is JustAWoman seeing the cost
   as she chooses the look, never something Lala perceives, so it does
   not belong in a service whose entire purpose is what Lala herself sees.
   **Owed:** show the cost in the closet UI at beat 8 instead — a
   JustAWoman-facing element, not a `feedMomentsService` phone moment.
   Not designed or implemented here.
2. **Beats 10 and 13's legacy phone moments are restored** ("who posted
   from the venue already?"; "phone blowing up"). (g)'s proposal had
   dropped both, reading their rendered surface's `diegetic: false`
   literally. Overridden by the standing rule below.
3. **Standing rule:** Lala's phone is visible for the whole show. Most
   icons live on it. Some overlays move between the phone and full
   screen depending on the transition — beat 5 is the clearest case: the
   invitation notification lives on her phone; tapping it lets the
   letter fill the screen. `surface` as a single fixed value per beat
   (§8(e)) cannot express a transition — it needs a start and an end
   (phone → full screen), not yet modeled in `canonicalBeats.js`.
   **Per-beat phone states for all 14 beats, and the `surface`
   start/end model, are owed as a separate task** — not redesigned in
   Task #1614. Until that task lands, `BEAT_PHONE_MOMENTS`'s beats 10 and
   13 restored above are correct in outcome (Lala does see these) but
   not yet expressed through an updated `surface` value. **The `surface`
   start/end model itself landed in Task #1615, below; `BEAT_PHONE_MOMENTS`
   in `feedMomentsService.js` was not touched by that task and still
   describes beats 10/13 without reference to it — see (i).**

**(i) `surface` transitions and the persistent-phone rename (Evoni,
2026-09-21, Task #1615).** Applies the standing rule from (h)(3) to
`canonicalBeats.js` itself:

- **`surface` can now be an ordered transition.** A beat's `surface` is
  either one of the named surfaces below, the string `'none'`, or an
  object `{ start, end }` naming two surfaces a presentation moves
  between. Only beat 5 uses this so far: `{ start: "Lala's Phone", end:
  'Full Screen' }` — the notification lives on her phone; tapping it lets
  the letter fill the screen.
- **`'Audience Overlay'` renamed to `'Full Screen'`.** The old name
  implied "for the audience specifically," which wasn't true even before
  this task — beat 13's stat card and beats 1-2's opening/login framing
  were never about the audience as a category, just about a presentation
  with no phone frame around it. Applies to beats 1 *(unchanged, "Host
  Environment," not this surface)*, 2, 13, 14 — all now `'Full Screen'`.
- **`'Closet UI'` folded into `"Lala's Phone"`.** The closet is an app on
  it, per this ruling. `'Closet UI'` no longer exists as a surface value
  anywhere in `canonicalBeats.js`.
- **Six beats changed**, per Evoni's explicit per-beat rulings (every
  other beat's fields are unchanged from the merged state):
  - **Beat 2** (Login Sequence) — `'Full Screen'`, `diegetic: false`
    (rename only; JustAWoman entering her world, not diegetic to Lala).
  - **Beat 5** (Reveal) — `{ start: "Lala's Phone", end: 'Full Screen' }`,
    `actor: 'justawoman'`, `diegetic: true` (transition modeled; actor
    and diegetic unchanged from the merged state).
  - **Beat 8** (Transformation Loop) — `"Lala's Phone"` (was `'Closet
    UI'`), **`diegetic: true`** (was `false`) — the one real behavioral
    reversal here: JustAWoman chooses, but Lala now sees her closet too
    and believes she is choosing.
  - **Beat 9** (Reminder/Deadline) — `"Lala's Phone"` (was `'Audience
    Overlay'`), **`diegetic: true`** (was `false`) — the to-do list is
    Lala's; she sees it on her phone (see the amended Definition, item
    10 above).
  - **Beat 10** (Event Travel) — `"Lala's Phone"` (was `'Audience
    Overlay'`), **`diegetic: true`** (was `false`) — the travel icon is
    on her phone; it reads like her maps. Supersedes the #1611/#1613
    reasoning that split the rendered icon (non-diegetic) from an
    underlying diegetic travel fact — under the persistent-phone rule
    there is no such split; the icon itself is what she sees.
  - **Beat 13** (Recap Panel) — `'Full Screen'` (rename only; `diegetic:
    false` unchanged — stats are felt, never stated).
  - **Beat 14** (Cliffhanger) — `'Full Screen'` (rename only; `diegetic:
    false` unchanged).
- **`typical_location` untouched.** It governs scene-set assignment (a
  physical-location concept for `scenePlannerService.js`'s AI prompt),
  independent of the phone/screen `surface` concept — out of this task's
  scope, including for beat 8, whose `typical_location` stays `'CLOSET'`.
- **No code reads `surface` today.** Grepped the whole repository for
  `.surface` (no hits in `src/` or `frontend/src/`) and for the literal
  strings `"Audience Overlay"`/`"Closet UI"` (5 files). Of those: this
  file's own §8(e)/(h)/(i) prose (historical references, left as-is —
  they describe what a past ruling said, not live code);
  `feedMomentsService.js`'s code comments from Task #1614 (`:95,99,104`)
  describe beats 5/8/9 using the pre-rename names — stale after this
  task, **not fixed here** (out of scope: `feedMomentsService.js` is not
  a file this task touches); `frontend/src/pages/WorldAdmin.jsx:4110`'s
  `{ id: 'closet_ui', name: 'Closet UI', icon: '🚪' }` is an unrelated,
  independent list of selectable episode-overlay asset types (Mail
  Panel, Wardrobe List, Career List, ...) that coincidentally shares the
  phrase — confirmed not a `canonicalBeats.js` consumer; the show-brain
  seeder's own Screen States section (`20260312800000-show-brain-
  franchise-laws.js:382`, `GAMEPLAY: 'Closet UI active...'`) is a
  different "Screen States" concept (IDLE/ALERT/GAMEPLAY/...) for the
  Editor Brain, also coincidental, and the seeder is off-limits regardless.

**(j) Canonical beats are the generation contract; the script is the
performance of it (Evoni, 2026-09-21, Task #1617).** `canonicalBeats.js`
holds structure and rules, never episode content — nothing about it
changes under this ruling. What it settles is the relationship between
that contract and the script:

- **Generate Script instantiates all 14 canonical beats** from the
  Episode Plan, the Event Package, and current episode state. It does not
  invent its own beat count or boundaries.
- **Every generated script beat keeps its canonical beat number and key.**
  Downstream consumers — Scene Planning, the Phone, overlays, Character
  Clips — read that number/key to know which canonical beat a given piece
  of script fulfills, rather than re-deriving "which beat this is" from
  prose, position, or a parallel naming scheme.
- **The script generator does not invent its own beats.** Any script-side
  structure (headers, tags, segmentation) is a rendering of the 14
  canonical beats, not a competing beat count.

This is a relationship ruling, not a schema change — no code changes
under this task. `docs/SCRIPT_PIPELINE.md` (Task #1617) is the census of
every place in the current codebase that does *not* yet follow this
relationship: multiple independent beat vocabularies and multiple writers
of the same beat-shaped storage, none of them aware of each other or of
this rule. That census records the gap; it does not close it.

**(k) `event_type` stays the mechanic; events gain `category` and `format`
(Evoni, 2026-09-22, Task #1635).** `world_events.event_type`
(`invite | upgrade | guest | fail_test | deliverable | brand_deal`) keeps
its existing meaning — no separate "purpose" field is added alongside it.
Two new fields are ruled instead:

- **`category`** — one of ten, settled: `fashion`, `social`,
  `brunch_dining`, `beauty_wellness`, `creator_brand`,
  `arts_entertainment`, `luxury_prestige`, `community_local`,
  `travel_destination`, `personal_relationship`.
- **`format`** — eight, settled (Evoni, 2026-09-22): `cocktail_party`,
  `garden_soiree`, `gallery_opening`, `gala`, `brunch`, `concert`,
  `brand_launch`, `premiere`. Drawn from `docs/EVENT_TAXONOMY_PLAN.md`'s
  draft table (Task #1635), which proposed a ninth value, `red_carpet`,
  drawn from the photo-booth check's own dress-code text match —
  **explicitly rejected.** Evoni's own reasoning: `red_carpet` stays a
  dress-code/presentation attribute, not a format, because promoting it
  would recreate exactly the ambiguity this taxonomy exists to remove —
  "Fashion category + Premiere format + red-carpet dress code" and
  "Luxury & Prestige category + Gala format + red-carpet dress code" both
  read cleanly; a `red_carpet` format would leave no way to tell whether a
  given event is a `premiere` or a `red_carpet`, the "two homes for one
  truth" problem again. Evoni's own examples, each field doing exactly one
  job:

  | `event_type` | `category` | `format` |
  |---|---|---|
  | `invite` | `fashion` | `gala` |
  | `brand_deal` | `beauty_wellness` | `brand_launch` |
  | `invite` | `brunch_dining` | `brunch` |

  `event_type` = why/mechanically how Lala is involved; `category` = what
  social/industry world the event belongs to; `format` = what kind of
  gathering it physically is. Expanding either list later (per Evoni:
  "we can add formats deliberately when SAL actually needs them," not
  because unrelated code happens to contain a similar word) is an
  application-code change to the model's `validate: { isIn: [...] }`, not
  a migration — the reason `STRING` was chosen over a Postgres `ENUM`.

Two things had to happen before any migration was written, both named by
Evoni directly: a drift check on `world_events` against the 2026-09-17
canon capture (three other tables have already turned out to differ
between production and this repo's migrations — a migration written blind
against the repo could fail on production or land on the wrong shape) —
performed in `docs/EVENT_TAXONOMY_PLAN.md` §1, no drift found — and
Evoni's approval of the format list above. Task #1640 adds the columns and
wires the three known call sites (`QuickEpisodeCreator.jsx`, the
photo-booth check, the Events-tab template grid) to use them.

**(l) Producer Mode and Lala's Feed answer different questions (Evoni,
2026-09-22, Task #1631).** Producer Mode answers what is in production,
what is blocked, and what happens next. Lala's Feed answers who exists in
Lala's social world. On this ruling, the Feed is not a Producer Mode
sub-tab — it is its own destination, reached from the Sidebar
(`frontend/src/components/layout/Sidebar.jsx`, FRANCHISE zone) and opening
on the LalaVerse feed with the feed-layer switcher still available. New
Episode (§8(j)'s generation contract has no bearing on this) continues to
open the Feed in choose-host mode (`SocialProfileGenerator`'s `chooseHost`
prop, Task #1628) rather than the standalone destination — choosing a host
is a step inside episode creation, not a detour to browse the Feed.
Producer Mode's own "Feed & Events" tab is renamed "Events"; the
Feed → Opportunities → Events pipeline and everything else on that view is
unchanged. `?tab=feed-timeline` (and the old bare `?tab=feed`) redirect to
the standalone Feed rather than resolving to a local tab that no longer
exists.

**(m) Producer Mode → Events is a queue of event packages, not an event
editor (Evoni, 2026-09-22, Task #1648).** Editing an event's own fields
belongs entirely on the Event Package page
(`/shows/:showId/events/:eventId`, `EventPackagePage.jsx`, §7 decision 4);
this tab's job is to tell a creator which event needs attention next, not
to let them edit one in place.

Each event card is reduced to a computed state, not the grab-bag of
independent chips/buttons §2's EVENT READY section already found doing
too many unrelated jobs at once (linked-episode status, feed activity
preview, four readiness chips, and seven action buttons on one card).
Five states, computed client-side from existing fields — no schema
change, no new persisted status value alongside `world_events.status`'s
existing free-string column (§4 already documents that column as
inconsistently written; this ruling does not touch it or attempt to
reconcile the two):

- **Needs Host** — no `source_profile_id` *and* no
  `canon_consequences.automation.host_profile_id`. The two-homes-for-host
  problem §2's "HOST — recorded two different ways" section already
  found (`from-profile` writes the durable column; calendar-driven writes
  only the JSONB copy) means both have to be checked, or every
  calendar-spawned event misreports as hostless even though it has one.
- **Needs Setup** — a host exists; `computeEventReadiness` (from
  `../utils/eventReadiness`, §7 decision 4's shared helper) reports
  incomplete.
- **Ready** — `computeEventReadiness` reports complete; not yet used.
- **Used** — `used_in_episode_id` set, or `status` is `used`/`filmed`.
- **Archived** — `status` is `declined`/`archived`.

Each card gets exactly one primary action, matched to its state (Needs
Host → Choose Host, Needs Setup → Continue Setup, Ready → Start Episode —
all three open the Event Package page; Used → Open Episode; Archived →
View). Every other action a card carried before this ruling — Edit,
Copy, the invitation and outfit pickers, Regenerate Episode, Delete —
moves into a per-card overflow menu; the feed activity preview is
removed from the card entirely (it answers "who posted about this
event," which is the Feed's question per decision (l) above, not
Producer Mode's). Auto-Reorder (episode sequencing) moves off this tab
onto the Episodes tab's Season Arc view — event creation and episode
sequencing are different jobs that happened to share a screen.

*Later (Evoni, 2026-09-30; Task #2363):* Auto-Reorder is removed from the
Season Arc view too. It moved started events to other episodes through
`/inject`, which the terms lock (§8(x) D4) refuses; reordering belongs to
future slots only, and a tool for that is a separate design.

The header becomes a filter bar over the five states (`All · Needs Host
· Needs Setup · Ready · Used · Archived`) plus **+ New Event** (opens
`/shows/:showId/new-episode`, the existing choose-host flow) and a
header overflow menu for the tab's own admin actions (Templates,
Enhance, Delete Drafts, Delete All). The Feed → Opportunities → Events
pipeline section elsewhere on this tab is unchanged.

Not yet code at the point this entry is written — Task #1648 is the
implementation.

**(n) Scene-set decisions (Evoni, 2026-09-22, Task #1660).** Nine rulings,
each followed by this document's own re-derivation of where current code
agrees or conflicts. Basis for the code citations in this entry:
`origin/main` at `8e078addf12fb244f2fd15db9d347faa7a837e3b` (2026-09-22) —
a later basis than §§1–6/§7 above, which are not re-walked here.

**1. Choose a place once.** The World Location chosen in the Event Package
drives the event's scene set, its map pin, and the episode's coverage. No
later step asks for the venue again.

Code: partially agrees. The `from-profile`-adjacent event-create route,
`POST /world/:showId/events`, already auto-derives `WorldEvent.scene_set_id`
from `venue_location_id` when a `scene_set_id` isn't explicitly passed, by
looking up an existing `SceneSet` row whose `world_location_id` matches the
venue (`src/routes/worldEvents.js:241-257`, assigned at `:287`) — but only
at creation; editing `venue_location_id` later via the event `PUT` route
does not re-derive `scene_set_id`. The FK this depends on is real:
`SceneSet.world_location_id` (`src/models/SceneSet.js:71`, association
`:28-34`: `SceneSet.belongsTo(WorldLocation, ...)`; inverse
`WorldLocation.hasMany(SceneSet, ...)`, `src/models/WorldLocation.js:131-136`).
A second, independent auto-match exists at episode-linking time, keyed on
`location_hint` text rather than `venue_location_id` — a different
mechanism (`worldEvents.js:788-806`). Conflicts: the map pin does not read
`WorldLocation.coordinates` at all. The interactive map,
`frontend/src/components/DreamMap.jsx`, positions pins from a static
per-city `x`/`y` array matched to `WorldLocation` rows by index within a
city grouping (`DREAM_CITIES`, `:25-91`; `matchedLoc = cityLocs[pi]`,
`:352`) — `WorldLocation.coordinates` (`WorldLocation.js:75-80`) is never
read for this. A separate, unrelated phone-UI code comment
(`frontend/src/components/ContentZoneEditor.jsx:646-648`) claims pin
positions come from `coordinates`, but that's a different "world_map"
content zone, not this map. No later step re-asks for venue, confirmed:
`scenePlannerService.js` reads the event's `scene_set_id`, not its venue
(§8(n)(4) below), and `EpisodeOverviewTab.jsx:74-284` only displays
`venue_location_id` read-only.

**2. Hierarchy: World Location → Scene Set → Angle → scene plan row (one
per canonical beat) → scenes and character clips.**

Code: partially agrees. `WorldLocation → SceneSet` (`SceneSet.world_location_id`,
above) and `SceneSet → SceneAngle` (`SceneSet.hasMany(SceneAngle, {
foreignKey: 'scene_set_id', as: 'angles' })`, `SceneSet.js:7-10`; inverse
`SceneAngle.belongsTo(SceneSet, ...)`, `src/models/SceneAngle.js:7-10`) are
both real associations — "Angle" is already a first-class model, named
`SceneAngle` (table `scene_angles`). `ScenePlan` (table `scene_plans`,
`src/models/ScenePlan.js`) is the one-row-per-beat object (`episode_id` +
`beat_number` unique, `:49-51`), pointing at `SceneSet` by FK but at
`SceneAngle` only by a matching label string (`angle_label`, `:16-17`) —
`ScenePlan` has no association to `SceneAngle` at all (`:54-58`). Conflicts:
nothing downstream points back at `ScenePlan`. `Scene` (table `scenes`) has
its own direct FKs to `SceneSet` and `SceneAngle`
(`Scene.js:378-389`, associations `src/models/index.js:934-955`), with no
`scene_plan_id` column anywhere in the schema (confirmed: repo-wide grep
across `src/models` and `src/migrations` returns nothing).
`CharacterClip.belongsTo(Scene, ...)` and optionally a separate `Beat`
model — script-level beats, not `ScenePlan` rows
(`CharacterClip.js:155-166`). So `Scene`/`CharacterClip` and `ScenePlan`
are two disconnected sibling branches today, both independently pointing
at `SceneSet`/`SceneAngle`, not the single chain this ruling describes.

**3. Refinement of the earlier Episode Plan decision.** Before the script,
the plan fixes which location each beat uses (coverage); after the script,
the scene planner assigns angles and shots. This refines, not reverses,
§7 decision 7 ("Episode Plan precedes the script").

Code: agrees with §7 decision 7's own already-recorded finding, unchanged
at this basis — no distinct "Episode Plan" tab sits between Overview and
Script in `EpisodeDetail.jsx`'s tab order (`:82-97`), and
`ScenePlannerPage.jsx` (route `/episodes/:episodeId/plan`, `App.jsx:392`)
is reached only via links from the Production Checklist
(`EpisodeProductionChecklist.jsx:309-315,416-421`), not a dedicated flow
step. Conflicts with the before/after split this ruling proposes: today,
fixing which location a beat uses and assigning its angle/shot happen in
the same step, not two. `generateScenePlan` (`scenePlannerService.js:77`)
is called from exactly one route (`POST /:episodeId/generate-plan`,
`src/routes/episodeBriefRoutes.js:92-119`), separate from script
generation (`POST /:episodeId/generate-script`, `:203-248`, which never
calls `generateScenePlan` and has no guard requiring a plan to exist
first) — so plan-then-script ordering is a UI convention
(`EpisodeProductionChecklist.jsx`'s required `scene_plan` checklist item,
`:43,322-325,400-415`), not an enforced sequence. Within the plan step
itself, one Claude call returns each beat's `scene_set_id`, `angle_label`,
and `shot_type` together (`scenePlannerService.js:200-215`), and the one
edit endpoint (`PUT /:episodeId/plan/:beatNumber`,
`episodeBriefRoutes.js:144-172`) accepts all three as one `updatable` set
behind a single per-beat lock — there is no separate "lock location" step
distinct from "assign angle" as this ruling's before/after split implies.
This ruling is Evoni's design intent for how the two should split; today's
code has not yet made that split — it refines the plan/script boundary
§7 decision 7 already established, without contradicting it.

**4. Coverage is deterministic, with no AI:** each beat's `typical_location`
from `canonicalBeats.js`, matched to the show's default set for that role,
or to the event's `scene_set_id` for EVENT_LOCATION.

Code: conflicts outright. `generateScenePlan` calls an LLM
(`claude-sonnet-4-6`, `scenePlannerService.js:11-19`) to choose the scene
set per beat: it builds a prompt embedding the full 14-beat list and every
available scene set (`:112-172`) and parses the model's JSON response
directly into each beat's `scene_set_id` (`:176-215`). `typical_location`
is used only as descriptive text inside that prompt (`` `${b.number}.
${b.name} (typical: ${b.typical_location}) — ${b.description}` ``, `:148`)
— confirmed by grep as its only reference in `src/` outside
`canonicalBeats.js` itself; no code matches it programmatically to a
show's default set. The event's `scene_set_id` is passed into the prompt
only as a suggestion for beats 10-12 ("use this for EVENT beats 10-12,"
`:106,122`), with no enforced assignment — the model can choose
differently, and the only post-response check is that the returned ID
exists among the show's scene sets (`:201-215`), not that it matches the
event.

**5. Each show has one default scene set per role (HOME_BASE, CLOSET,
TRANSITION). Record which field holds a set's role today, and whether any
"default" marking exists. The mechanism is open.**

Code: the role field exists — `SceneSet.scene_type`, an ENUM of
`HOME_BASE | CLOSET | EVENT_LOCATION | TRANSITION | OTHER`
(`SceneSet.js:73-76`) — but no default-marking mechanism exists at all: no
`is_default` column (grepped), no unique index on `(show_id, scene_type)`
(`SceneSet.js:109-116`'s `indexes` has none), no settings table.
`loadAvailableSceneSets` (`scenePlannerService.js:30-72`) loads every
complete scene set for the show with no role-default filter — the model
picks freely among all of them (see decision 4 above). The mechanism
stays open, as this ruling states.

**6. The scene planner refines the 14 rows in place and never deletes and
recreates them, so manual choices survive. Record, citing code, that it
currently deletes and recreates.**

Code: confirmed — delete-then-recreate is exactly what happens today, the
one behavior this decision set names for future correction. Inside
`generateScenePlan`, under `if (save)`:
`ScenePlan.destroy({ where: { episode_id: episodeId }, force: true })`
hard-deletes every existing row for the episode
(`scenePlannerService.js:220`), then a fresh set of 14 rows is built
(`:222-237`) and inserted via `ScenePlan.bulkCreate(rows)` (`:239`) — with
no reference to any prior row's `locked` state or manual edits. There is
no separate "regenerate" function; `generateScenePlan` is the only writer
of `scene_plans`, for both first generation and any later re-generation
(module exports only `{ generateScenePlan, getScenePlanForScriptGenerator,
BEAT_STRUCTURE }`, `:288`) — so a locked beat is destroyed and rebuilt
exactly like an unlocked one on every re-run.

**7. Episode readiness means each beat's required angle exists. Only
missing angles are offered for generation.**

Code: not yet built. `SceneAngle` is a real model (`generation_status`,
`beat_affinity` JSONB array, `angle_label`, `still_image_url` —
`SceneAngle.js`), and `SceneSet.angleForBeat(beatNumber)`
(`SceneSet.js:46-51`) already picks an angle by `beat_affinity` match,
with `SceneSet.isReady` (`:60-64`) true if any angle is complete — but
that's set-level, not per-beat. No episode-level readiness check is keyed
on per-beat angle existence anywhere in the repo (grepped "readiness"
across `src/` and `frontend/src/`; every hit is either the
already-documented event-level `computeEventReadiness` or unrelated). The
closest existing thing, `EpisodeProductionChecklist.jsx`'s Scene Plan
check, only checks `scene_plan.length > 0` and whether all beats are
locked (`:213-221`) — nothing about angles. `GET
/:episodeId/script-context`'s own `ready` computation is `context.every(b
=> b.locked)` (`episodeBriefRoutes.js:310-324`) — locked, not
angle-complete.

**8. The Scenes tab becomes the beat filmstrip, reusing the existing
filmstrip endpoint; adding another set is the exception, not the main
path.**

Code: partially agrees. The filmstrip endpoint exists exactly as
described — `GET /episode/:episodeId/filmstrip`
(`src/routes/sceneSetRoutes.js:2398-2435`) already returns all 14 beat
slots (filled or empty) joined from `scene_plans`/`scene_sets`/
`scene_angles`, with `image_url`, `shot_type`, `emotional_intent`, and a
`has_scene`/`covered` flag per beat (`:2404-2431`) — precisely the shape a
beat filmstrip needs. But it has no current caller: grepped `/filmstrip`
across `frontend/src`, nothing fetches it; `SceneSetsTab.jsx:2320`
declares a `filmstrip` state variable whose setter is never called
elsewhere in the file (vestigial). The Scenes tab this decision would
replace — `EpisodeScenesTab.jsx` (mounted at `EpisodeDetail.jsx:88,719`,
not `EpisodeAssetsTab.jsx`) — is a different UI today: it manages
`Scene`/`SceneSet` linking directly (list/link/unlink scene sets,
list/create/delete `Scene` rows from angles, `:17-35`), with no read of
`scene_plans` and no call into the filmstrip endpoint.

**9. Variants over duplicate sets: a place keeps one set, with
time-of-day, seasonal and mood variants. Later work.**

Code: confirmed no variant concept exists yet, as expected for later
work. `SceneSet` has `time_of_day` and `season` as plain, unstructured
scalar columns (`SceneSet.js:106-107`) and `mood_tags` as a JSONB tag
array (`:81`) — no self-referencing FK, no `variant_of_scene_set_id`, no
grouping concept (grepped "variant" in `SceneSet.js`, zero hits).

**Open questions for Evoni**

**(a)** Beats 1 and 2 happen in JustAWoman's space and the interface, not
Lala's world. What is their coverage — a Host Environment set, or none?

**(b)** `typical_location` values were inherited from the old scene
planner, not sourced from the seeder (§8(e) above). List all 14 so Evoni
can confirm them before coverage depends on them — source:
`src/constants/canonicalBeats.js`, each beat's `typical_location` field:

| Beat | Name | `typical_location` |
|---|---|---|
| 1 | Opening Ritual | `HOME_BASE` |
| 2 | Login Sequence | `HOME_BASE` |
| 3 | Welcome | `HOME_BASE` |
| 4 | Interruption Pulse 1 | `HOME_BASE` |
| 5 | Reveal | `HOME_BASE` |
| 6 | Strategic Reaction | `HOME_BASE` |
| 7 | Interruption Pulse 2 | `TRANSITION` |
| 8 | Transformation Loop | `CLOSET` |
| 9 | Reminder/Deadline | `TRANSITION` |
| 10 | Event Travel | `TRANSITION` |
| 11 | Event Outcome | `EVENT_LOCATION` |
| 12 | Deliverable Creation | `EVENT_LOCATION` |
| 13 | Recap Panel | `HOME_BASE` |
| 14 | Cliffhanger | `HOME_BASE` |

**(c)** How a show marks its default set per role.

**Evoni's rulings on (a) and (c) (2026-09-22).** Recorded as her rulings,
not this document's own inference. `canonicalBeats.js` itself is not
changed by this PR — these rulings land in code with the coverage build
the nine rulings above describe, not here.

- **(a) resolved.** Beats 1 and 2 get a new location role,
  `HOST_ENVIRONMENT` — JustAWoman's own space, distinct from Lala's
  `HOME_BASE`. This needs a Scene Library set of its own, the same as
  Lala's bedroom and closet — a real set to create, once.
- **Beats 7 and 9 have no default location.** Unlike the other twelve
  entries in (b)'s table above, which stand as defaults, beats 7
  ("Interruption Pulse 2") and 9 ("Reminder/Deadline") take an explicit
  "decided per episode" value instead of a fixed one — chosen from what
  the script actually does, not proposed ahead of it. Coverage leaves
  these two beats open before the script exists, and fills them once the
  script shows where Lala is. This is a third, explicit state for
  `typical_location`, the same pattern the file header's `null`/`'none'`/
  value convention already uses for `actor`/`surface`/`diegetic`
  (§8(e)/(f) above, `canonicalBeats.js:64-70`): "decided to be flexible"
  and "not decided yet" have to look different, not collapse into one
  blank value.
- **Every beat's default is only a default.** Ruling 6 above (the scene
  planner refines rows in place, manual choices survive) already means a
  per-episode change to any beat's location — not only beats 7 and 9 —
  survives regeneration once that refine-in-place behavior is built.
  Beats 7 and 9 are simply the two beats with no default to override in
  the first place.

MERGE: still requires Evoni's explicit go — this addendum records her
answers; it doesn't itself close the PR.

**(o) SAL is composited; production coverage replaces scene coverage
(Evoni, 2026-09-22, Task #1664).** Corrects (a) above — see the marked
correction below, not a silent replacement.

**1. SAL is composited, like a gameplay stream.** Three layers can be on
screen at once: Host Environment (JustAWoman's persistent player frame
and her real-world background), the Interface (login, Closet UI,
notifications, HUD), and Lala's World (bedroom, closet, event
locations). JustAWoman is never inside Lala's scene; Lala never
perceives JustAWoman or the interface. This is the same three-layer
split §8(f)'s SAL interaction law already names (Host Environment /
Interface / Lala's World, `canonicalBeats.js:64-70`'s `surface` values)
and the same beat-by-beat `actor`/`surface`/`diegetic` table §8(e)
records — not restated here, only composited: where §8(f) established
that a beat's `actor` and `diegetic` are independent axes, this ruling
adds that the layers those axes describe are not exclusive states a beat
occupies one at a time, but simultaneous tracks a composited frame can
show together.

**2. Production coverage replaces scene coverage.** Each beat has four
independent indicators, each `required`, `not required`, or `decided per
episode` (the same three-state pattern (b)/(c)'s addendum above already
uses for `typical_location`, not a new convention):

| Indicator | What it is |
|---|---|
| Environment | The Lala's World set — what (n)/(b) above called `typical_location` |
| Host performance | A JustAWoman performance clip |
| Character performance | A Lala performance clip |
| Interface | A UI or overlay asset |

A beat is covered only when every indicator marked `required` for that
beat is met — not when any one of the four is met, and not when the old
single `typical_location` value alone is set.

**3. Correction to (a) above.** **(a)'s original wording — "Beats 1 and 2
get a new location role, `HOST_ENVIRONMENT`... a real set to create,
once" — is corrected, not deleted, by this ruling:** `HOST_ENVIRONMENT`
is not a *location* Beats 1 and 2 occupy. It is JustAWoman's frame,
present across the whole episode as the Host Environment layer (item 1
above), not a per-beat coverage value. Under production coverage (item
2), Beats 1 and 2's actual requirements are: both beats require a
JustAWoman performance clip (Host performance — headphones on for Beat
1, the login for Beat 2, matching each beat's own `actor: 'justawoman'`,
`canonicalBeats.js:85,98`); Beat 2 additionally requires the login
Interface asset (matching its `screen_action: 'LOGIN'`,
`canonicalBeats.js:97`). The Host Environment *set* itself is still
needed — not as Beats 1-2's Environment indicator, but as the constant
background of JustAWoman's frame, independent of which beat is playing.

**4. Open question for Evoni.** During Beats 1 and 2, what does Lala's
World show — her home establishing shot, a loading state, or nothing
yet? Not decided here.

**5. The four indicators can draw on data that already exists.** No new
storage is proposed by this ruling. The Interface and Host performance
indicators can draw on the beat table's own `surface` and `actor` values
(§8(e)/(i), `canonicalBeats.js`); the Character performance indicator can
draw on the existing character-clip system (`CharacterClip`, belonging
to `Scene`, `src/models/CharacterClip.js:155-166` — cited at (n) item 2
above). Mapping from these existing fields to the four indicators happens
in the coverage build this decision set describes, not in this document.

**(p) Organizer decisions (Evoni, 2026-09-22, Task #1676).** Resolves (c)
above. Six rulings, each followed by this document's own re-derivation of
where current code agrees or conflicts. Basis for the code citations in
this entry: `origin/main` at `b75ec5b9bcc71aec6deef67e5a5d65fda1eb71db`
(2026-09-22) — a later basis than §§1–6/§7 above, which are not re-walked
here.

**1. Four roles per event.** The ORGANIZER puts the event on and is
required. The HOST or FACE is an optional person fronting it. FEATURED
ATTENDEES are the three to five Feed creators the story actually uses.
LALA'S ROLE says why she is there — invited guest, paid creator,
collaborator.

*Code agreement/conflict:* none of the four are named fields anywhere in
`WorldEvent` (`src/models/WorldEvent.js`). The closest existing fields
conflate them: `host` (`STRING(200)`, comment "Host character name or
entity", `:62-66`) and `host_brand` (`STRING(200)`, comment "Maison
Belle, Luxe Cosmetics, etc.", `:67-71`) together read as one undivided
organizer-or-face slot, not two. `source_profile_id` (`:132`) is the
creator-organizer link; the guest homes item (b) above already records
(`canon_consequences.automation.guest_profiles`, populated by
`assembleGuestList`, `src/services/eventAutomationService.js:340`, and
the separate top-level `guest_list` column) are the closest existing
analog to featured attendees, but scoped differently:
`assembleGuestList`'s own `maxGuests` default is `8`
(`eventAutomationService.js:340`), not three to five, and nothing in
code distinguishes a smaller "featured" subset the story actually uses
from the full invited list. Lala's role has no field at all — no code
this document found names why Lala attends a given event.

**2. An organizer is a creator or a brand.** A creator organizer is a
`SocialProfile`. A brand organizer is a `LalaverseBrand`
(`src/models/LalaverseBrand.js`, table `lalaverse_brands`). A
brand-hosted event with no person attached is valid and complete.

*Code agreement/conflict:* agrees in practice, not in framing. The core
event-creation route, `POST /world/:showId/events`
(`src/routes/worldEvents.js:364-490`), requires only `name`
(`:386`) — `host`, `host_brand`, and `source_profile_id` (which this
route doesn't even destructure from the body) are all optional, so a
brand-hosted event with `host_brand` set and no profile link is already
code-valid today; nothing rejects it. But §2's HOST section (above)
still describes HOST entirely as "a `SocialProfile` row" — the framing
this ruling corrects, not the runtime behavior. `LalaverseBrand` is a
real, registered model (`src/models/index.js:316,511,1750,1999`) but has
no association to `WorldEvent` anywhere in `src/models/WorldEvent.js` or
`src/models/index.js` — it is a standalone brand registry today, not
linked to events by any FK.

**3. The Events queue's "Needs Host" is wrong for brand-hosted events —
it becomes "Needs Organizer."** Satisfied by either a linked profile or
a linked brand.

*Code agreement/conflict:* conflicts as designed. §8(m) above ("Producer
Mode → Events is a queue of event packages") specified **Needs Host** as
"no `source_profile_id` *and* no
`canon_consequences.automation.host_profile_id`" — and the shipped
implementation matches that spec exactly:
`computeEventState`/`EVENT_QUEUE_STATES` in
`frontend/src/utils/eventReadiness.js:97-125` checks `hasHost =
!!ev.source_profile_id || !!ev.canon_consequences?.automation
?.host_profile_id` (`:120`) and returns `'needs_host'` when neither is
set (`:121`) — `host_brand` is never consulted. A brand-hosted event
that sets only `host_brand` (ruling 2) has neither a `source_profile_id`
nor an `automation.host_profile_id`, so this check marks it
**Needs Host** — every brand-hosted event, without exception, since
`host_brand` carries no other signal this function reads. Renaming the
state and widening the check to accept a linked brand (once one exists,
per ruling 6/open question (a)) is not built by this ruling — only
recorded as wrong today.

**4. Feed creators at a brand's event are attendees, not hosts.** The
system must not describe a creator as hosting an event a brand puts on.

*Code agreement/conflict:* no violation found — this document did not
find code that labels a guest/attendee as a host. This is a preventative
rule for future work (e.g. ruling 5's second New Episode path), not a
correction of an existing mislabel.

**5. New Episode gains a second starting path later: choose a brand
opportunity instead of a creator.** Recorded as intended, not built.

*Code agreement/conflict:* today there is exactly one path.
`NewEpisodeChooseHost` (`frontend/src/App.jsx:106-109`) is the entire
`/shows/:showId/new-episode` route; it unconditionally renders
`<SocialProfileGenerator chooseHost showId={showId}
defaultFeedLayer="lalaverse" />` — a creator-choosing flow with no
branch, mode, or prop for a brand-opportunity start.

**6. Interim storage, until a schema change.** `source_profile_id` for
creator-hosted events, `host_brand` for brand-hosted ones, both presented
as Organizer. `host_brand` is free text today (`WorldEvent.js:67-71`,
`STRING(200)`, no FK, no `validate`); `lalaverse_brands` exists as a real
table (ruling 2) but nothing links the two.

*What reads `host_brand` today* — every site this document found,
`event.host_brand` (or the equivalent local name) as a plain string,
grouped by what the read is for. A schema change from free text to a
brand link (open question (a)) touches all of these, not just the
column:

- *String-equality / substring brand-matching* — would need the most
  rework, since each compares `host_brand` against another free-text
  field rather than an id:
  - Outfit/wardrobe scoring: `event.host_brand === item.brand_alignment`
    in `episodeOrchestrationRoute.js:68`; `item.brand ===
    event.host_brand` in `wardrobeIntelligenceService.js:286-288` and
    `:361-363`; `hostBrand = event.host_brand || automation.host_brand`
    then compared against wardrobe brands in
    `wardrobeIntelligenceService.js:556` and `:734-736`; a lower-cased
    substring match in `episodeCompletionService.js:84`; a lower-cased
    `brandLower` built from `host_brand` in `routes/wardrobe.js:1007`
    and matched against item aesthetic tags at `wardrobe.js:1051`.
  - Brand continuity across episodes: `prevHostBrand && e.host_brand ===
    prevHostBrand` in `routes/worldEvents.js:4218-4220`, fed by a raw SQL
    `SELECT ... host_brand ...` at `:4125` and `prevEvent?.host_brand` at
    `:4134`.
  - Invitation style-reference lookup, the most structural read: `WHERE
    e.host_brand = :brand` in `invitationGeneratorService.js:193`,
    gated by `if (!event.host_brand) return null` at `:187`, replacing
    `:brand` with `event.host_brand` at `:198` — an exact-string SQL
    match against every other event's `host_brand`, used to find the
    most recent invitation from "the same" brand.
- *AI prompt / generated-copy text* — reads the string for display, would
  need a brand name resolved from an id instead:
  `episodeOrchestrationRoute.js:266`, `episodeScriptWriterService.js:405`,
  `distributionService.js:147`, `episodeGeneratorService.js:512`,
  `financialTransactionService.js:476`, `todoListService.js:617`,
  `invitationCompositingService.js:310` and `:394`,
  `scriptSkeletonGenerator.js:34`, `invitationGeneratorService.js:344`
  and `:360`.
- *Copied forward into another home* — reads `host_brand` off the event
  and writes it into a second place, which then has its own independent
  readers: `canon_consequences.automation.host_brand`
  (`worldEvents.js:2391`, written; read back at
  `frontend/src/components/Episodes/EpisodeOverviewTab.jsx:721,723` for
  display, and via `event.host_brand || automation.host_brand` fallback
  chains in `episodeGeneratorService.js:779`,
  `wardrobeIntelligenceService.js:556`, and
  `socialChecklistService.js:277`); the invitation asset's own metadata
  (`invitationGeneratorService.js:240`); a scene-generation snapshot,
  `event_metadata.host_brand` (`episodeGeneratorService.js:656`); an
  evaluation context, `eventContext.host_brand = we.host_brand`
  (`routes/evaluation.js:294`, from a raw SQL read at `:280`); a
  brand-opportunity candidate list, `brandSources` in
  `characterSyncService.js:226`; a wardrobe event-context object
  (`routes/wardrobe.js:170,185` from SQL, and the request-body fallback
  chain at `:950,973,984,1182`); a social-task-builder context,
  `hostBrand = context.host_brand || hostProfile?.host_brand || null`
  (`episodeGeneratorService.js:156` — the `hostProfile?.host_brand`
  branch reads a field `SocialProfile` does not have, per
  `src/models/index.js`'s model list, so only the `context.host_brand`
  branch is ever live); story-generation context, a raw SQL `SELECT ...
  host_brand ...` in `storyGenerationService.js:67`.
- *Frontend display and editing* — reads the string to show or let a
  creator type it: `frontend/src/pages/EventPackagePage.jsx:439` (Basics
  section, read-only); `frontend/src/pages/WorldAdmin.jsx:1119` (CSV
  export), `:2680` and `:3378` (controlled inputs, read the current value
  to display it and to build the AI revise-suggestion prompt at `:3594`
  and `:3604`), `:3292` (event-detail modal load, `event.host_brand ||
  automation.host_brand` fallback), `:3645` (derives a fallback `host`
  display string from `host_brand` when `host` is empty);
  `frontend/src/components/QuickEpisodeCreator.jsx:229` (populates form
  state from a loaded event); `frontend/src/components/
  EpisodeWardrobeGameplay.jsx:209,506` (wardrobe-gameplay context and an
  event tag chip).

**Observation (Evoni, 2026-09-22), not a ruling.** Two follow-on notes on
ruling 6's reader list above:

1. Brand matching today is exact string or lower-cased substring
   comparison, with no normalization, across the invitation style lookup
   (`invitationGeneratorService.js:193,198`), wardrobe scoring
   (`episodeOrchestrationRoute.js:68`, `wardrobeIntelligenceService.js:
   286-288,361-363,556,734-736`, `wardrobe.js:1007,1051`), the
   episode-completion brand-trust bonus (`episodeCompletionService.js:84`),
   and cross-episode brand continuity (`worldEvents.js:4218-4220`). A
   spelling or spacing difference between two `host_brand` values that
   read as "the same" brand to a person silently breaks every one of
   these matches — none of them normalize or fuzzy-match.
2. `host_brand` is copied into
   `canon_consequences.automation.host_brand` (`worldEvents.js:2391`),
   with its own independent readers and `||` fallback chains
   (`EpisodeOverviewTab.jsx:721,723`, `episodeGeneratorService.js:779`,
   `wardrobeIntelligenceService.js:556`, `socialChecklistService.js:277`)
   — the same two-homes pattern this document already records for host
   (§2 "HOST — recorded two different ways"), venue (§2 EVENT PACKAGE's
   "Venue" subsection — the top-level FK alongside the JSONB copy), and
   guests (§2 EVENT PACKAGE's "Guests" subsection). Cited, not re-argued.

**Open questions for Evoni:**

**(a) The schema target — RESOLVED (Evoni, 2026-09-24; see (r) below).**
`organizer_type` with `organizer_profile_id`
and `organizer_brand_id`, replacing free-text `host_brand` with a link to
`lalaverse_brands`. This is a production schema change — hers to decide
and run, not this document's or this task's to propose as a migration
file. Recorded here as proposed, not planned. **Resolved, not deleted —
see (r) below: the target is recorded as intended, not built, and adds
`host_face_profile_id` and `sponsor_brand_id` to the three fields named
here.**

**(b) Is Lala's role a fixed list or free text?** Not decided here.

**(c) Do featured attendees resolve the existing two-homes guest problem,
or wait for it? — RESOLVED (Evoni, 2026-09-22; see (q) below).** §2 EVENT
PACKAGE's "Guests" subsection above already records that problem
(`canon_consequences.automation.guest_profiles` vs. the top-level
`guest_list` column, neither ruled authoritative) — cited here, not
restated. Whether "featured attendees" becomes a third home, a view over
one of the two existing ones, or the occasion to finally pick one, is not
decided here. **Resolved, not deleted — see (q) below: `guest_profiles`
is the authority, `guest_list` is retired, and featured attendees are a
narrower concept layered on top of `guest_profiles`, not a third home.**

**(q) Guest ownership (Evoni, 2026-09-22, Task #1685).** Resolves §8(p)
open question (c) above. Read that grounds this ruling:
`docs/GUEST_OWNERSHIP_READ.md` — cited throughout, not restated.

**1. `guest_profiles` is the authority; `world_events.guest_list` is
retired.** Every writer and every reader `docs/GUEST_OWNERSHIP_READ.md`
§3 found already uses `guest_profiles` — nothing needs to migrate.
`guest_list` is retired as of this ruling: that read's §2 already found
it functionally dead (the main creation route explicitly discards it;
its one possible writer is the PUT route's untyped pass-through, and its
one reader is `feedPostGeneratorService.js`). This ruling settles that
remaining code as not sanctioned going forward — removing `guest_list`
from the PUT route's `allowedFields` and retiring
`feedPostGeneratorService.js`'s read of it is a later task, not done by
this ruling. Dropping the column itself is a production schema change —
Evoni's to decide and run, not proposed as a migration here.

**2. A guest's Social Profile link is what lets it accumulate a
relationship with Lala; a guest without one cannot.**
`docs/GUEST_OWNERSHIP_READ.md` §4/§6 already found the mechanism
(`characterSyncService.js`'s post-episode relationship-state update,
gated on each guest's `profile_id`) and the gap: the opportunity-pipeline
writer stores that same link under the key `id` instead, so every guest
it creates silently carries no relationship — no error, just an absent
key every `profile_id`-reading consumer steps over. Cited for detail,
not restated; fixing the writer is Task #1686, tracked separately from
this docs-only ruling.

**3. Featured attendees are not the same as everyone invited.** The
three to five Feed creators a story actually uses (§8(p) ruling 1's
FEATURED ATTENDEES role) are a narrower, curated concept than the full
assembled guest list `guest_profiles` holds — every entry today is
presented identically; nothing distinguishes an invited guest from a
featured one. Marking them (a per-guest flag, rank, or story reason) is
a later task, not this one.

**(r) The four event roles (Evoni, 2026-09-24, Task #1767).** Extends
§8(p) Organizer decisions above and resolves its open question (a).
Docs only: no code, no migration.

**1. Four event roles, distinct.** The ORGANIZER owns the event and is
required. The HOST or FACE is the optional person who publicly fronts it.
The SPONSOR optionally funds or backs it. The FEATURED ATTENDEES are the
three to five the story uses (§8(q) ruling 3). A creator can organize an
event a brand sponsors, and neither role is the other.

*Note on §8(p) ruling 1.* This revises §8(p) ruling 1, whose four roles
included LALA'S ROLE and no sponsor; ruling 1's text is left as filed.
LALA'S ROLE stays, recorded as a property of Lala's attendance rather
than an event role. Evoni's reason: the four event roles describe the
event (who owns, fronts, funds and features in it), while Lala's role
describes her relationship to it, and the event exists whether or not
she attends. So there are four event roles plus Lala's role. Whether
Lala's role is a fixed list or free text is still §8(p) open question
(b), which stays open.

**2. The schema target, recorded as intended and not built.**

- `organizer_type`: creator, brand or organization;
- `organizer_profile_id`;
- `organizer_brand_id`;
- `host_face_profile_id`;
- `sponsor_brand_id`.

Brands link to `lalaverse_brands` (the `LalaverseBrand` model); people
link to social profiles (`SocialProfile`). No new brand table. This is a
production schema change, Evoni's to plan and run; no migration is
proposed here.

**3. Why a real link rather than free text.** A link is what connects an
event to:

- brand relationship history;
- career progression;
- previous collaborations;
- wardrobe-brand alignment;
- invitations;
- gifting and payouts;
- future opportunities.

§8(p) ruling 6's list of what reads `host_brand` today (roughly 40 sites)
is why this is a project with its own plan, not a field rename. The list
covers string matching in wardrobe scoring, invitation lookup, completion
and continuity; AI prompt text; and the copied-forward homes. Cited, not
restated.

**4. What holds until then.**

- *Interim storage:* `source_profile_id` for a creator organizer and
  `host_brand` for a brand organizer, both presented as Organizer. This
  is §8(p) ruling 6. The Event Package applies it through Change
  Organizer (PR #1762: `buildCreatorOrganizerUpdate` and
  `buildBrandOrganizerUpdate` in `frontend/src/utils/eventOrganizer.js`).
- *A brand and a creator cannot both be set, because the row would
  contradict itself.* PR #1762 built the behaviour: choosing one kind in
  the Package clears the other in both homes. Its stated reason was
  display, since `resolveEventOrganizer` lets the brand win. The reason
  recorded here, that the row would contradict itself, is part of this
  ruling. Rows saved before #1762, and the old editor's writes, can still
  hold both.
- *No honest home for a host or face.* PR #1762's "Host or face" section
  records why: `host` mirrors the creator's name, and `automation.host_*`
  and `source_profile_id` are the creator organizer. The field in point 2
  is where it would go.
- *Display:* the Events queue card shows the same organizer
  (`resolveEventOrganizer`) since PR #1764 (Task #1763). That PR moved
  the display; it set no storage rule.

**5. The sponsor after PR #1766 — a consequence, not a ruling.** The
sponsor is kept, not lost, but it is not an event role and has no field
of its own. On events created from a creator's profile (the from-profile
route, `POST /world/:showId/events/from-profile`), it lives in three
places:

- the creator's own `brand_partnerships` (`social_profiles`);
- a copy on the event under
  `canon_consequences.automation.brand_partnerships`;
- the event's narrative text ("Brand opportunity with <brand>.").

Two limits:

- Events created before PR #1766 still hold the sponsor in `host_brand`
  and still display it as the organizer.
- Calendar-spawned events (`spawnEventsFromCalendar`,
  `src/services/eventAutomationService.js`) still write the sponsor as
  organizer.

Nothing was backfilled.

**(s) Deliverables and the social package (Evoni, 2026-09-24, Task
#1772).** Docs only: no code, and neither system is built by this entry.

**1. LALA'S DELIVERABLES** are what a brand or organizer requires of her
inside the story: a tagged post, a story, an appearance. They belong to
the event, they affect her career and relationships, and they are canon.

**2. THE SHOW'S SOCIAL PACKAGE** is what Prime Studios publishes to
promote an episode: thumbnails, titles, descriptions, short-form clips,
captions, schedules. It belongs to the episode's distribution and is not
canon. Nothing in it happens inside LalaVerse.

**3. They may share assets, and neither is the other.** A venue image, a
wardrobe cutout or a clip can serve both. Completing one never completes
the other: Lala posting her tagged story does not publish the episode's
Reel, and publishing the Reel does not satisfy the brand.

**4. What exists today.**

*Lala's deliverables: no dedicated field on the event.* `WorldEvent`
(`src/models/WorldEvent.js`) has no deliverables column. What exists is
scattered:

- `requirements`, a free-form JSONB object on the event. The Event
  Package (`EventPackagePage`) lists its entries as "Requirements" under
  its "Style & Deliverables" section. Nothing defines which keys it holds,
  and nothing marks an entry as a deliverable or tracks it as done.
  **Resolved, not deleted — see (t) below: #1810 renamed that section
  "Style & Requirements"; (t) item 1 names what it holds as access
  requirements, a different kind of term from deliverables.**
- `canon_consequences.automation.social_tasks`, Lala's in-story posting
  tasks ("Post outfit details… tag <brand>", "Tease the <brand>
  collaboration without disclosing deliverables"). `buildSocialTasks`
  (`src/services/episodeGeneratorService.js`) writes them. At episode
  generation they are copied into `episode_todo_lists.social_tasks`, and
  `generateSocialChecklist` (`src/services/socialChecklistService.js`)
  renders them as a checklist image. These are closer to a to-do list
  than to a brand's contract: generated from the event type, outfit and
  guests, not from what an organizer asked for.
- `Opportunity.deliverables` (`src/models/Opportunity.js`, JSONB
  `[{type, description, due_date, completed}]`) is the one real
  deliverables structure, with per-type defaults in `opportunityRoutes.js`
  (for example `brand_deal`: sponsored content, story mentions, engagement
  targets). It lives on the career opportunity, not the event, and
  neither `convertOpportunityToEvent` (`careerPipelineService.js`) nor
  `scheduleOpportunityAsEvent` (`feedEventPipelineService.js`) carries it
  onto the event it creates.
- `event_type` includes `deliverable` and `brand_deal` as mechanics
  (`WorldEvent.js` comment), which name the kind of event, not what is
  owed.

So a brand's actual requirements of Lala have no home on the event, and
nothing records whether she met them.

*The show's social package: distribution metadata is built; the package
is not.* `Episode.distribution_metadata` (`src/models/Episode.js`, JSONB,
"Per-platform distribution: titles, descriptions, hashtags, schedule per
platform") is read and written by `GET` and `PUT
/world/:showId/episodes/:episodeId/distribution` and filled by `POST
…/generate-distribution` (`src/routes/worldEvents.js`), which calls
`generateDistribution` (`src/services/distributionService.js`, an AI call
for YouTube, TikTok, Instagram and Facebook). `EpisodeDistributionTab`
(`frontend/src/components/Episodes/EpisodeDistributionTab.jsx`) edits
title, caption, thumbnail, hashtags, schedule, status, URL and aspect
ratio per platform. Thumbnails have their own system
(`docs/THUMBNAIL_SYSTEM.md`, §7 decision 10). What is not built: any
store of short-form clips, stills or teasers for an episode, or anything
that proposes them.

**5. Intended, not built: a social package derived from the script's
canonical beats.** The beats are where the moments worth clipping are
(the invitation reveal, the transformation, the arrival, the
cliffhanger), so the package should be proposed from them rather than
found by scrubbing the finished video. This depends on Generate Script
instantiating the 14 canonical beats with their numbers and keys, which
§8(j) rules and `docs/SCRIPT_PIPELINE.md` records as not yet true of the
code.

**6. Ordering.** The social package follows production, because that is
when the assets exist. Some of its text (titles, descriptions, a
thumbnail concept) can be drafted earlier, from the script.

**7. Why this ruling exists.** The two have been, or can easily be,
conflated, and keeping them apart prevents a shared store forming.

- *The same distinction was drawn once before.* §7 decision 10 separated
  the Episode Run Sheet (the producer's tracker, `EpisodeTodoPage`) from
  the Episode To-Do Overlays, and its Task #1615 amendment settled that
  those lists are Lala's, seen on her phone, with only their presentation
  styling belonging to the show. That is the same line, inside LalaVerse
  versus Prime Studios' own work, drawn for production tracking. This
  entry draws it for publishing. It is the second time the distinction has
  needed drawing.
- *The word "social" is on both sides.* Lala's in-story posting tasks are
  called `social_tasks` and render as a "social checklist"; the show's
  publishing work is what this entry calls the social package. The
  shared name is the likeliest place for one store to start holding both.

**(t) The deliverables doctrine (Evoni, 2026-09-24, Task #1812).** Builds
on (s) above. Docs only: nothing is built, no schema is proposed, and no
field is named as the home of any term. The read that grounds it is
`docs/DELIVERABLES_READ.md`, cited by section, not restated.

**1. Four kinds of term, each distinct.**
- **ACCESS REQUIREMENTS** are what Lala must have or do to take part.
- **DELIVERABLES** are what she promises to produce.
- **RESTRICTIONS** are what she agrees not to do.
- **COMPENSATION** is what she receives.

Together they are the terms of an opportunity. They do not share one
field. (The read's §5 sorts today's fields into the first three and
places `rewards` in none of them; this ruling names compensation as the
fourth.)

**2. Ownership.** An `Opportunity` proposes terms; the Event Package
(`EventPackagePage`) owns the accepted terms; Start Episode snapshots
them. An episode never reaches back to a live opportunity to find what is
owed. An event created without an opportunity (from-profile, calendar,
manual) gets its terms in the Event Package directly.

**3. Deliverables are not tasks.** A deliverable says what Lala owes;
social and production tasks say what work fulfils it. One deliverable may
produce several tasks. Today's social tasks (`buildSocialTasks`, copied
into `episode_todo_lists.social_tasks`) are generated from the event type,
outfit and guests rather than from any ask (read §1.4 and §5), and so are
not deliveries.

**4. Fulfilment is its own lifecycle, not a flag.** These are distinct
states:
- an event happened;
- an episode completed;
- a deliverable was completed;
- submitted;
- approved;
- payment earned;
- payment received.

Completing an episode never means deliverables were fulfilled.

**5. Deliverable load is separate from difficulty.** Difficulty measures
how demanding the event is; load measures how much Lala owes. Difficulty
follows
`docs/audit/F-Stats-1_EventDifficulty_ProjectedVsCanonical_Decision_2026-09-24.md`
(projected for planning only; canonical uses only accepted values). Load
is computed from accepted deliverables only, never from today's
social-task count, and it cannot be computed until deliverables exist.
The read's §6 records that the two share no input today.

**6. What fulfilment feeds:** payment settlement, brand relationships,
career outcomes and evaluation. As a consequence, per the read's §0 and
§3, none of those reads a deliverable today: every writer of stats, brand
trust, coins, profile state and career goals was checked, and none reads
`Opportunity.deliverables`, `content_requirements` or
`WorldEvent.requirements` as a delivery signal.

**7. Intended, not built, and each needing its own decision:**
- per-brand relationships with their own history, separate from the
  global `brand_trust` score;
- separating contractual pay from performance reward. This would change
  what Lala earns today.

**8. Already done, by citation.** The Event Package's "Style &
Requirements" heading and the "Brand deal content fee" ledger line
(`financialTransactionService`) both shipped in #1810. The read's §4 and
§0 hold what they replaced.
**Superseded in part, not deleted (Evoni, 2026-09-24, Task #1814):**
slice 1a renamed that heading "Style" (the outfit only). Access
requirements are shown and edited only in the Event Package's Terms area,
so each term has one place. The ledger line is unchanged.

**9. Build order, as intent** (Evoni has set it; none of it is built):
1. opportunity terms carry to the event;
2. the Event Package edits them;
3. Start Episode snapshots them;
4. fulfilment is recorded.

Then phone and production, then money, then brand relationships and
evaluation.

**10. The read's seven questions.** These are the rulings on
`docs/DELIVERABLES_READ.md` §7. The read itself is not edited.

| Read §7 question | Answered by | What remains open |
|---|---|---|
| 1. Should delivering move anything? | Item 6: yes. Fulfilment feeds pay, brand relationships, career and evaluation. Item 9 puts recording fulfilment before those consequences. | Which stats and scores move, and by how much. |
| 2. Where do an event's deliverables live? | Item 2: the opportunity proposes, the Event Package owns, and events with no opportunity set terms there directly. | The storage itself (no field is named here). |
| 3. What is `requirements`? | Item 1: what it holds today (stat thresholds) is an access requirement. The heading was renamed (item 8). | Whether access requirements widen beyond stat thresholds (dress code, invitation, brands worn). |
| 4. Are social tasks Lala's deliverables? | Item 3: no. Tasks are the work that fulfils a deliverable, and today's generated tasks are not deliveries. | Whether today's generated tasks remain alongside tasks derived from deliverables. |
| 5. Requirements, deliverables and restrictions: three categories, each with its own home? | Item 1: four kinds, adding compensation, never sharing one field. | Where each lives (no field is named here). |
| 6. Deliverable load | Item 5: separate from difficulty, computed from accepted deliverables only, and not until they exist. | How it is computed and shown. |
| 7. Two misleading labels | Item 8: both renamed in #1810. | Nothing. |

**(u) Event generation rulings (Evoni, 2026-09-27, Task #2088).** Docs
only: no code is changed by this entry. The basis is
`docs/EVENT_DRAFT_READ.md` (merged as `2e1fc195`), cited, not restated.
Recorded from `origin/main` at `2063168c397d11e79929a52c3a69ed27baf0d77d`.
Rule 14 of `docs/DESIGN_DOCTRINE.md` is amended by the same task.

**R1 Auto-draft:** as rule 14 (amended).

**R2 Readiness:** auto-drafted fields count toward Event Ready, including
organizer and invitation when they were created as part of the draft. No
special exceptions.

**R3 Order:** creator → concept → description/activity → category and
format → time, dress code, styling → name. The name describes the
finished concept and is never used to infer category or format.

**R4 Formats:** add workout_class, masterclass, workshop, dinner,
showcase, preview, pop_up, retreat, meetup, run_club, performance,
photoshoot, tasting, panel, competition to the existing 8. Note:
wellness_session may be considered later.

**R5** The same taxonomy task fixes the event_type checks that use
non-canonical format words ("launch", "opening") in
financialTransactionService.js and wardrobeIntelligenceService.js (see
EVENT_DRAFT_READ.md §5, disagreement 3).

**R6 Categories:** add `fitness` as its own category. Content category
`fitness` maps to `fitness`; content category `lifestyle` maps to
`community_local`.

**R7 Styling:** dress_code and dress_code_keywords remain the canonical
scoring inputs and are filled at creation. Add a styling_brief that
reuses the wardrobe-brief concept (not necessarily
Opportunity.wardrobe_brief's exact shape), with at least activity,
formality, function_requirements, avoid, style_direction; environment and
footwear_requirements may be included.

**R8 Description contract:** "The public event description explains why
the event exists, what attendees will actually do, the setting/atmosphere,
and what guests should expect. It contains no database stats, evaluation
language, or private story consequences."

**R9 Name prompt:** replace the "fashion/lifestyle content-creator show"
framing with the organizer's niche and the event concept, e.g. "Name this
fictional event for a luxury fitness creator hosting a sunset sculpt
workout and recovery social." The show name is never an input (rule 11).

**R10** New formats get start-time and dress-code defaults, set in task 1.

**(v) The creation draft's cost, scope and storage (Evoni, 2026-09-28, Task
#2122).**

**1. AI call at creation:** yes, on Haiku 4.5, and it must never block
creation. If the call fails, hits the rate limit or is refused by
`aiCostTracker`, the event saves with today's template fields and no draft.
The rate limit applies to the draft call only, never to the route. I agree a
"Draft this event" button would bring back the checklist that R1 removed.

**2. Scope of step 1:** `from-profile` only. It's the path the read mapped.
The calendar, opportunity and manual paths become a later task once the draft
shape has settled.

**3. Storage (adopted):** the concept and activity are stored as
`canon_consequences.automation.concept` and `.activity`, with no migration; a
column can come later if something needs to query them.

**4. Provenance (adopted):** step 1 writes
`canon_consequences.automation.auto_drafted`, a map from each drafted field to
its source (e.g. `{ description: 'ai_draft' }`), so step 4 can show
"Auto-drafted · <source>" and flip an entry to Edited when Evoni changes the
field.

**5. Rate limit (adopted):** `aiRateLimiter` is route middleware and answers
429, so it is not mounted on `from-profile`; the draft has its own small
per-user check that skips the draft instead of failing the route.
`aiCostTracker`'s budget refusal is caught the same way.

**(w) Episode production workspace rulings (Evoni, 2026-09-28, Task
#2207).** Docs only: no code is changed by this entry. The basis is
`docs/EPISODE_PRODUCTION_READ.md` (Task #2202, merged as `f39a77c9` in
#2204), cited, not restated. Recorded verbatim. P1 is also rule 19 of
`docs/DESIGN_DOCTRINE.md`.

**P1.** Once Start Episode is pressed, the Episode becomes the production
workspace; ordinary production work should never require leaving the
Episode.

**P2.** Use episode_briefs.event_id as the canonical Episode → Source Event
link; migrate readers toward listEpisodeEvents and do not add another
event-link column.

**P3.** Fix first. Regenerate must be transactional/safe: create and
validate the replacement episode before unlinking the event or
deleting/superseding the existing episode.

**P4.** Fix second. Timeline Editor must always honor the requested
episode_id and must never fall back to or display another episode's
timeline.

**P5.** Fix third. The feed-moment beat step must persist successfully or
surface a clear save error; silent failure is not acceptable.

**P6.** Delete the unmounted EpisodeWardrobeTab.jsx and its unsafe
arbitrary-wardrobe fallback; maintain one canonical episode-level Wardrobe
implementation.

**P7.** Production becomes Assets · Scenes · Character Clips · Wardrobe ·
Lala's Phone · Checklist; Character Clips gets its own episode-production
tab for Lala and JustAWoman footage.

**P8.** Episode Lala's Phone uses the same canonical phone system, derives
required phone moments from each beat's surface, shows readiness by beat,
and moves Missions under Advanced.

**P9.** Once an event has started an episode, accepted Terms are locked
server-side; edits to requirements, compensation/payment,
deliverables/restrictions, and source-event linkage must be rejected
through ordinary event-edit routes rather than relying on the UI lock
alone.

**Episode visuals and copy rulings (Evoni, 2026-09-30, Task #2386).**
Recorded verbatim, continuing the numbering. The basis is a read of the
overlays, title card, episode description and Distribution code at
`b7d80aa5`, summarised in Task #2386. Not yet built: each is its own PR,
after the image cost-tracking fix.

**P10.** An event's approved invitation is an episode overlay: tagged as
the episode's invitation overlay, shown in that episode's overlays and
placed on the invitation beat, whether approved before or after Start
Episode. Regenerating and approving a new one replaces it. The Phone Hub
keeps show-wide overlays only; an episode's Lala's Phone shows show-wide
plus that episode's own.

**P11.** An episode title can be approved. Approving it offers "Design
title card" with its cost shown. The card uses the show's image style and
the event's visual direction, so the invitation and title look like one
production, and it belongs to that episode. Changing an approved title
marks the card outdated and offers a redesign.

**P11 amendment** (Evoni, 2026-09-30). Recorded verbatim:

> The episode title card is a title overlay: the title set in real typefaces (never AI-rendered letters), styled from the event's visual direction (fonts, palette, gold/foil/shadow effects), with the episode number small beneath, rendered as a transparent PNG. An optional soft translucent backing band (20–40% opacity) can be switched on for readability. Approving the title offers 2–3 lettering style variants to choose from, at no image cost; an optional AI-generated decorative flourish behind the letters is offered separately with its cost shown. The current framed card remains available as a full-screen card option.

What was built (`episodeTitleOverlayService`; the episode page's title
panel, `EpisodeTitleCard`):

- **Letters.** node-canvas sets the title in the invitation's typefaces,
  Cormorant Garamond and Libre Baskerville. When they are not installed,
  the invitation service's serif fallback is used.
- **Image.** A 1920×1080 transparent PNG with the episode number small
  beneath.
- **Look**, from the source event's visual direction:
  - its theme sets the finish: gold foil, rose-gold foil, ink or sage;
  - its palette sets the accent.
- **Three lettering variants**, offered after approval with previews and
  no image call: Classic serif, Editorial italic and Engraved capitals.
- **Band.** The optional band runs from 20 to 40% (default 30%).
- **Flourish.** The flourish is the one image call, with its estimate
  shown first. It is an ornament generated in gold on black, keyed to
  transparency, and drawn behind the letters. It can be removed.
- **Storage.** The overlay is the episode's `title_overlay_*` columns plus
  an assets row with role `UI.OVERLAY.EPISODE_TITLE_TEXT`. Like the card,
  it is outdated when the title changes.
- **Framed card.** The card is unchanged and is offered as "Full-screen
  framed card".

**P12.** Each episode has a viewer teaser, separate from the event
description (guest copy, rule 12): mystery-driven, never revealing the
outcome, the hook in the first 150 characters. It's auto-drafted at Start
Episode from the event's concept and description, labelled Auto-drafted,
and editable. Distribution drafts platform copy from the teaser.

**P13.** The existing episode description remains the internal synopsis
of what happens.

**P14** (Evoni, 2026-09-30, Task #2395). Recorded verbatim. Not yet built.

> An episode's task list can be approved; approving offers "Design task-list overlay" (cost shown) in the event's visual direction; it becomes an episode overlay placed on the tasks/deadline beat, replacing an earlier one.

**P14's four choices, accepted** (Evoni, 2026-09-30: "I accept P14's four
choices."). The build (Task #2395) made them without a ruling; they are
now ruled:

1. The list counts as approved while its content matches what was
   approved; ticking tasks is not a change.
2. The overlay type is the show's own task-list type if it has one,
   otherwise `TodoListOverlay`.
3. The background is portrait, because beat 9 shows on Lala's Phone.
4. With no source event, it uses the invitation's default look.

**P15** (Evoni, 2026-09-30). Recorded verbatim:

> Production gains an Overlays tab holding every on-screen piece of the episode: the title overlay and full-screen framed card, the invitation, and the task-list overlay, each with its preview, status (approved, outdated, not made), placed beat, and actions with costs shown; the show-wide overlays the episode uses are listed read-only with a link to the Phone Hub. The banner shows a small title status chip that opens the tab instead of the card image.

What was built (`episodeOverlaysService`, `GET /api/v1/episodes/:id/overlays`;
the episode page's Production → Overlays sub-tab, `EpisodeOverlaysTab`; the
banner's `EpisodeTitleChip`):

- **One read for the tab.** The route returns four pieces: the title
  overlay, the full-screen framed card, the invitation and the task-list
  overlay. It composes the states their own services already return
  (`getTitleCardState`, `loadEpisodeInvitationOverlay`,
  `getTaskListOverlayState`). Each piece carries its preview, status,
  placed beat and the cost of its paid action. The route only reads;
  every action stays on the piece's own route.
- **Status.** A piece is *not made* with no current piece and *outdated*
  when it was made for content that has since changed (the title, the
  task list). Otherwise it is *approved*. The invitation has no saved
  outdated state (the terms-reopen relock offer is transient), so it is
  approved or not made (choice 1 below, accepted).
- **Placed beat.** This is read from the piece's live
  `timeline_placements` row, where `episodeBeatPlacement` writes the beat
  number and name. The task list falls back to its asset's beat metadata.
  The tab shows "Placed on Beat N: Name", or "Not placed" with the beat
  the piece goes on. Saving the title overlay places it on Beat 1, and a
  restyle moves the placement to the new overlay. The framed card is not
  placed (choice 2 below, as ruled).
- **Actions with costs.**
  - The title pieces use the title panel (`EpisodeTitleCard`): approve,
    lettering styles and band at no cost, the flourish and the framed card
    with their estimates.
  - The task list uses `EpisodeTaskListOverlay`: approve, and design with
    its estimate.
  - The invitation is made in its Event Package. The tab links there and
    shows the generate or regenerate estimate, priced from the
    invitation's image options.
- **Show-wide overlays.** The overlays the episode uses come from the
  Lala's Phone read (`GET /api/v1/ui-overlays/:showId?episode_id=`), keeping
  only those that are made and are not the episode's own. They are listed
  read-only, with "Edit in the Phone Hub" linking to the show's Phone Hub.
- **Banner chip.** The title card strip under the banner is replaced by a
  chip, "Title · Approved / Outdated / Not made", which opens Production →
  Overlays (`?tab=overlays`). It shows the title overlay's status, or the
  framed card's when only the card was made (choice 3 below, accepted). It
  sits on its own line, so it shows at 375px.

**P15's three choices, ruled** (Evoni, 2026-09-30: "P15 choices: 1 and 3
accepted. 2: the title overlay is placed on Beat 1 (the opening); the
framed card stays unplaced unless I place it."):

1. The invitation shows approved or not made; it has no outdated state.
2. The title overlay is placed on Beat 1 (the opening). The framed card
   stays unplaced unless Evoni places it.
3. The banner chip shows the title overlay's status, or the framed card's
   when only the card was made.

**(x) Money and deal rulings (Evoni, 2026-09-29, Task #2227).** Docs
only: no code is changed by this entry. The basis is
`docs/EVENT_TERMS_MONEY_READ.md` (Task #2223, merged as `eeb710af` in
#2224), cited, not restated. Recorded verbatim.

**D1.** Yes. The transaction ledger is the authoritative balance;
character_state.coins is a cached copy, always recomputed from the ledger.

**D2.** Yes. Finalize and Complete run in one database transaction and are
idempotent: a retry never doubles rewards and never leaves a half-finished
state.

**D3.** Yes. A wardrobe outfit lock never causes finalize to skip entry
cost, payment or rewards.

**D4.** Yes. The terms lock is enforced server-side in every route that can
change locked terms or the episode link (event PUT, inject, brief edit, and
the shared PUT used by WorldAdmin and the overview), keyed on the episode
link per §8(w) P2.

**D5.** Yes. The next-event suggester never returns used or deleted
events; access requirements stay a weight, not a hard gate.

**D6.** Yes. Deliverables keep manual advancement for now; money is tied to
their status only in the deal build.

**D7.** Yes. Adopt the eight deal types (self-funded, invited/comped,
gifted, paid appearance, paid deliverables, appearance + deliverables,
performance/creator booking, brand partnership), stored on the event.

**D8.** Yes. Payout timing for new deals only: appearance fee on
attendance, content fee on an approved deliverable, bonus on evaluation,
gifted value recorded but not paid in coins. Existing events keep today's
behaviour.

**D9.** Yes. Pricing numbers live in a data table Evoni can tune, not in
code.

**D10.** Yes. Events created from opportunities pay according to their
deal type instead of always being unpaid.

**D11.** Defer. Per-brand relationships come later; brand trust stays one
number for now.

**Where these stand:**
- **Filed as fixes:**
  - D2 → #2228
  - D3 → #2229
  - D4 → #2230, which also implements §8(w) P9
  - D5 → #2231
- **D1** is recorded; no fix is filed for it here.
- **D6–D10** belong to the deal build and are not filed yet.
- **D11** is deferred.

**Register note owed.** D1–D3 rule on the F-Stats-1 money path. They
touch:
- the Class 4 "parallel balance readers, none authoritative" item, whose
  priority is at `docs/audit/F-Stats-1_Fix_Plan_v1.62.md:112`;
- the reach probe `docs/audit/F-Stats-1_S355_ReachProbe_2026-09-27.md` §3.

These rulings are recorded here, in a living doc, and not in the register.
A register note that cites them is owed, filed through `/audit-file`. No
file under `docs/audit/` is edited by this entry.

**(y) Prime Coins rulings (Evoni, 2026-09-29, Task #2244).** Docs only:
no code is changed by this entry. Q1–Q7 answer the seven questions in
`docs/COINS_LEDGER_CACHE_DESIGN.md` §7 (Task #2242, merged as `b4926262`
in #2243). That note is cited, not restated. Evoni added Q8 and Q9. The
answers are recorded verbatim.

**Q1.** 1900, once per new show. Use the show's starting_balance setting,
defaulting to 1900. This is Lala's one-time starting bankroll;
character_state should mirror the ledger rather than independently starting
coins at 500.

**Q2.** Yes. In the one-time reconciliation, any show missing its seed
transaction should receive its starting-balance seed first, then have its
balance recomputed, so we don't accidentally erase its original bankroll.

**Q3.** Lala only. Prime Coins are Lala's career economy at the show level.
Other characters can have editable story stats, but they should not own or
modify this ledger. If we later want other characters to have money, that
should be a deliberately separate character-economy system.

**Q4.** Every Lala row shows the same balance. The ledger is the authority,
so duplicate/legacy Lala state rows cannot disagree about coins. Longer
term, investigate why multiple Lala rows can exist rather than treating
duplicates as normal.

**Q5.** Admin Reset stops touching coins. Resetting character/story state
should not give Lala 500 or erase career money. If needed, create a
separate, explicit Reset Career Economy action with a strong confirmation,
because that resets the financial history/balance.

**Q6.** Yes. Finalize must enforce the same insufficient-funds protection
as Complete. No path should be able to spend Lala below zero merely because
it entered the ledger through a different workflow.

**Q7.** Whole Prime Coins, consistently rounded. Use half-away-from-zero at
the ledger boundary if fractional amounts can currently occur, and use the
reconciliation query to determine whether existing cents need migration.
Going forward, the game economy transacts in whole Prime Coins unless a
real reason for fractional coins is found.

**Q8.** Lala's coin balance persists between episodes. An accepted
episode's ending ledger balance is the next episode's starting balance.
There is no per-episode reset or refill.

**Q9.** The one-time reconciliation is proposed per show and applied only
after Evoni approves each show's balance.

**Doctrine.** Prime Coins are Lala's persistent career economy. Each new
show/career receives one configurable starting balance. After that initial
seed, Lala's balance changes only through recorded economic activity:
career earnings, event compensation, deliverables, rewards, purchases,
event costs and other explicit transactions. Episode boundaries never reset
the balance. The ledger is the financial authority; character state mirrors
it.

**How the answers map to the note's questions.** Each answer is matched by
content, and none conflicts with the question it answers:

| Answer | Note §7 question |
|---|---|
| Q1 | starting balance |
| Q2 | seeding unseeded ledgers in the reconciliation |
| Q3 | coins for keys other than `lala` |
| Q4 | several `lala` rows per show |
| Q5 | the admin reset |
| Q6 | a standalone Finalize going below zero |
| Q7 | rounding |

Q8 and Q9 have no question in the note; Evoni added them.

**Where these stand:**
- The rulings are recorded here.
- D1's build follows `docs/COINS_LEDGER_CACHE_DESIGN.md` §10: five PRs,
  with the reconciliation last and gated on Q9. It is not filed by this
  entry.
- **Owed, unfiled:**
  - Q4's investigation into why several Lala rows can exist.
  - Q5's optional Reset Career Economy action.
- **Held:** the deal-type design note (D6–D10) waits on Evoni's
  go-ahead, because payouts depend on the ledger design.

**(z) LalaVerse economy laws (Evoni, 2026-09-29, Task #2253).** Docs only:
no code is changed by this entry. The subsections are:
- **(z-1)** a read-only inventory of the currency-like fields and labels, as
  the code stands;
- **(z-2)** Evoni's laws and doctrine, verbatim, with her final wording for
  Law 0 and the doctrine (given before this entry was pushed);
- **(z-3)** a proposed map from each law to where it is built.

Standing labels:
- **MEASURED**: read from the code at the basis below, cited by name, with
  a line where useful.
- **INFERRED**: a conclusion drawn from reading code, not from running it.
- **RULED**: an earlier ruling, cited.

Basis: `origin/main` at `e786433046fada8562befd1691fff70917d322c4` (#2251,
D1 PR 1). At this basis, D1's later PRs (#2247–#2250) are not merged. Two
balances exist:
- the ledger (`financial_transactions`, read by `getCurrentBalance`);
- `character_state.coins`, which the spend guards check.

**(z-1) Currency inventory (MEASURED unless marked)**

*The balance itself.*

| Field | What it does | Lala spends or earns it? |
|---|---|---|
| `character_state.coins` | Checked by the spend guards and many prompts. Moved by deltas (`coinBalanceGuard`), set by the manual edit and the admin reset (500), seeded at 500 | It is the balance, as a cached copy (D1) |
| Ledger balance (`getCurrentBalance`) | Sum of executed, live `financial_transactions`. Shown by the Finance tab, `/balance`, the forecast and the phone's Money Balance | It is the balance (D1: the authority) |
| `shows.metadata.starting_balance` (default `DEFAULT_STARTING_BALANCE` 1900) | Seeds the ledger's `seed` row | Earned once (§8(y) Q1) |
| `episodes.total_income`, `total_expenses`, `financial_score` | Per-episode summary written by finalize and Complete. The script writer calls `income − expenses` "balance" | Not spendable: a summary |

*Things Lala spends.*

| Field | Where it is charged | Notes |
|---|---|---|
| `world_events.cost_coins` | Finalize, as `event_entry` | Not charged when `is_paid` is true (`normalizePaidFreeFlags`). `is_free` has no column. |
| `EVENT_EXTRAS` (drinks, valet, photo booth) | Finalize, every event, one `styling_extras` row | Charged for paid and free events alike. The forecast's photo-booth rule differs from finalize's. |
| `wardrobe.coin_cost` | `/wardrobe/select`, `/lock-outfit-atomic`, `/purchase`, for unowned `coin`-locked pieces | Moves both balances in one transaction and sets `is_owned` |
| `wardrobe.price` (retail, DECIMAL) | Finalize, as `coin_cost \|\| price` for unowned, non-gifted, non-borrowed pieces not bought through the lock | The outfit snapshot (`PUT /world/:showId/events/:eventId/outfit`) stores `price` but not `coin_cost`, so **retail `price` is what finalize charges** |
| `wardrobe.rental_price` | Finalize, as `wardrobe_rental`, when `acquisition_type` is `rented` | **No writer exists**, and the snapshot omits it. A rented piece is charged full `price` as `wardrobe_purchase`: the rental path is dead. |
| Tier reward on FAIL (−25) | Complete, `tier_reward` as an expense | |
| `manual_adjustment` (negative) | The Characters-tab edit | |

INFERRED: a piece bought through `/select` or `/purchase` can be charged
again at finalize.
- Those ledger rows carry no `episode_id`.
- Finalize excludes only the lock's rows (`flow = 'lock_outfit'`).
- Finalize reads `is_owned` from the snapshot, frozen when the outfit was
  saved.

*Things Lala earns.*

| Field | Where it is paid | Notes |
|---|---|---|
| `world_events.payment_amount` with `is_paid` | Finalize, `event_payment` | Events made from opportunities are always `is_paid: false` (`compensationFromOpportunity`), so their pay is recorded but not paid |
| Brand-deal content fee | Finalize, `content_revenue`: 10% of the payment for `event_type` `brand_deal` | Nothing is delivered or checked for it |
| `SOCIAL_TASK_REWARDS` × `TIMING_MULTIPLIERS` | Finalize, `social_task_reward`, for tasks marked completed | `viral_bonus` is defined but unused |
| Tier rewards (`tierCoinRewards`) | Complete, `tier_reward` | |
| Paid bonus | Complete, `tier_paid_bonus` | Keyed on raw `cost_coins > 0`, even for paid events whose entry cost is not charged. The forecast keys on the charged cost. |
| `world_events.rewards.coins` | Complete, `event_reward`, on slay or pass | Ledger only until D1 PR 2: `coinDeltaFrom` leaves it out |
| Milestone `reward_coins` | Finalize, `checkMilestones` | The insert has always failed: #2252, unmerged at this basis |
| `manual_adjustment` (positive) | The Characters-tab edit | |

*Not spendable, but labelled as coins or money.*

| Field or label | What it actually is |
|---|---|
| `price_estimate` | AI output only (`wardrobeLibrary.js`). It becomes the default `price` (minimum 150) and `coin_cost`, so it is charged **indirectly** |
| `wardrobe.resale_value` | Unused |
| `evaluationFormula` coin delta (`computeStatDeltas`, `applyDeltas`) | A preview. Complete overwrites it. |
| EvaluateEpisode override costs ("Coins −50", "Coins −100") | Never charged: Complete re-runs `evaluate` without overrides |
| The financial forecast (`/financial-forecast`), `checkAffordability`, `episodeGeneratorService.calculateFinancials` | Estimates. Each prices outfits and extras differently from finalize. |
| `requirements.coins_min` ("🪙 Coins min") | A suggester weight (§8(x) D5), never charged |
| Career goals with `target_metric` `coins` | Progress only |
| Opportunity `payment_amount`, `expenses`, `net_value`, `payment_status` | Pipeline display. Moving to `paid` sets `payment_status` only; no ledger row. |
| `outfit_score.outfit_cost`, the closet's owned and unowned value | Display. `outfit_cost` sums `price` including owned pieces, and feeds the "Dropped N coins" big-spend post. |
| `CONTENT_REVENUE_PER_PRESTIGE` | Unused |
| Profile money fields (`monthly_earnings_range`, `income_breakdown`, `money_behavior_*`) | Characterisation |
| `AIUsageLog.cost_usd`, `EpisodeScript.generation_cost` | Real USD API cost, not game money |

*UI and prompt wording.*
- **`$` shown for coin amounts:**
  - `EpisodeScriptWriterPage` ("(`$`…)", with a `DollarSign` icon, on the episode net);
  - the script-writer, wardrobe-intelligence, distribution, episode-generator and feed-pipeline prompts;
  - opportunity pay in WorldAdmin (the same field on events is labelled "coins").
- **The same `wardrobe.price` in two units:** shown with `$` in WorldAdmin, OutfitCalendar, EpisodeAssetsTab, ShowWardrobeTab, ShowInsightsTab, UniversePage and the phone's WardrobePriceRenderer, but charged as coins at finalize.
- **Coin labels on things that are not spent or earned as labelled:**
  - "Total Event Budget 🪙" sums `cost_coins`, including paid events whose entry cost is never charged, and leaves out extras and wardrobe;
  - "🪙 Coins min";
  - the override "Coins −50" and "Coins −100";
  - `🪙 {cost_coins}` on paid events;
  - "Lala earns coins for attending", which is true only with `is_paid`.
- **One balance, five names:** "🪙 Balance", "Coins", "💰 … coins", "Money Balance", "Wealth". Some read the ledger and some read `character_state.coins`. "Prime Coins" appears only in ShowSettings' economy-model list.
- **Real USD, correctly labelled `$`:** AI cost (CFOAgent, AICostTracker), location price level, the CreateEpisode placeholder.

**(z-2) The laws — Evoni, 2026-09-29, recorded verbatim**

**Law 0.** Prime Coins are the LalaVerse's only currency; money and Prime
Coins are the same thing. Anything not spendable (retail value, gift value,
pending pay, difficulty) is never called coins. One Prime Coin feels like $1.

1. Lala receives one starting bankroll per show/career.
2. Her balance persists across every episode.
3. Every change in spendable coins comes through the ledger.
4. Purchased things cost money once.
5. Owned things do not cost money to reuse.
6. Gifted, borrowed, rented, comped and purchased are financially distinct.
7. Event expenses are itemized rather than represented by one mysterious cost.
8. Contracted earnings come from accepted Event Terms/deliverables.
9. Pending income is not spendable income.
10. Gifts/assets have value but are not cash.
11. No ordinary action can take Lala below zero.
12. Episode completion never resets money.
13. Every transaction points back to the thing that caused it.
14. The script/Phone/Recap may use financial state as story context.

**Doctrine.** Money in the LalaVerse should behave like money in Lala's
life: finite, persistent, earned, spent, saved, gifted, owed and invested.
Prime Coins are not merely a score; they are a canonical resource whose
history tells part of Lala's career story.

**(z-3) Where each law is built — proposed, for Evoni's approval**

The build names are the ones Evoni listed. "Wardrobe-economy build" and
"event-budget build" are not filed. The inventory rows each law answers
are named.

| Law | Where it is built | What the inventory shows it must change |
|---|---|---|
| 0 | Every build relabels its own surfaces: wardrobe-economy (`price` is retail value, not coins), event-budget ("Total Event Budget", `cost_coins` on paid events), the deal build (pending pay), story use (the `$` prompts) | `$` for coins, `price` in two units, and five names for one balance (z-1, wording) |
| 1 | Already ruled: §8(y) Q1, Q2. Built by D1 PRs 1 and 4, and PR 5 for existing shows (Q9) | 500 vs 1900 seeds |
| 2 | Already ruled: §8(y) Q8. D1 PR 2, with a test | — |
| 3 | Already ruled: §8(x) D1. D1 PRs 1–4. The deal build for opportunity "paid" | Opportunity `payment_status: 'paid'` writes no ledger row |
| 4 | Wardrobe-economy build. Already ruled in part: §8(x) D3, for pieces the lock bought | Finalize charges retail `price`; a `/select` or `/purchase` piece can be charged again (INFERRED) |
| 5 | Wardrobe-economy build | Finalize reads `is_owned` from a snapshot frozen at outfit save |
| 6 | Wardrobe-economy build (rented, gifted, borrowed, purchased). The deal build for comped (§8(x) D7, "invited/comped") | `rental_price` has no writer; rented pieces pay full `price` |
| 7 | Event-budget build | One `styling_extras` row for drinks, valet and photo booth; the forecast's rules differ from finalize's; the paid bonus keys on an uncharged cost |
| 8 | Deal build: §8(x) D6–D10, with payout timing in D8 and opportunity events in D10 | Opportunity events are always unpaid; the brand-deal content fee needs no deliverable |
| 9 | Deal build: §8(x) D8 | Opportunity "paid" is a status only |
| 10 | Wardrobe-economy build. Already ruled for deals: §8(x) D8, "gifted value recorded but not paid in coins" | `resale_value` is unused; the closet's value sums `price` |
| 11 | Already ruled: Task #1933, §8(y) Q6. D1 PR 2 (Complete, Finalize), PR 3 (wardrobe), PR 4 (manual edit) | — |
| 12 | Already ruled: §8(y) Q8 and Q5 (Admin Reset stops touching coins). D1 PRs 2 and 4 | — |
| 13 | D1 PRs 3–4, #2252 (milestone rows), and a later audit of every writer | `/select` and `/purchase` rows carry no `episode_id`; milestone rows carry the goal id in metadata only |
| 14 | Story use | The script writer reports the episode net as "Balance: $…", not the ledger balance |

**Where this stands:**
- The laws and doctrine are recorded.
- The map in (z-3) is a proposal, not a ruling.
- The wardrobe-economy and event-budget builds are not filed.
- The deal-type design note stays held until Evoni says go.

**(aa) Episode money rulings (Evoni, 2026-09-29, Task #2259).** Docs only:
no code is changed by this entry. Recorded verbatim. It builds on §8(x) D1,
§8(y) and §8(z).

**M1.** Episode money appears in three places: a Production Money tab, a
compact card on the episode Overview, and a balance chip in the episode
header. This extends §8(w) P7's tab list.

**M2.** Planned amounts never enter the ledger; only posted transactions
do. The Money tab shows planned, pending and posted separately.

**M3.** Every ledger row created during an episode's production records
that episode's id.

**M4.** Prime Bank is the permanent financial history and can filter by
episode; Episode Money is a view of the ledger, not a separate ledger.

**M5.** Build order: Phase A (read-only Money tab, header chip, posted
rows, expected terms) after D1's reconciliation is applied; Phase B
(financial plan, pending and receivables, itemised event budget) in the
deal build; Phase C (wardrobe-driven projections, Money Recap, Prime Bank
episode filter) with the wardrobe economy.

**M6.** Once an episode or show is deleted, it no longer affects Lala's
money. Ledger rows tied to a deleted episode or show stay as history but are
excluded from the balance; the balance is recomputed as if that episode never
happened.

(M6 was ruled by Evoni later on 2026-09-29, with the per-show reconciliation
decisions, and added here; Task #2267.)

**Event spending (Evoni, 2026-09-30).** Recorded verbatim in §8(cc) (the
event cost split). For the Money tab: event spending (drinks, valet, photo
booth and other things Lala chooses during the event) lives in the
episode's Money tab, editable until Complete, each line quantity × unit
price, auto-drafted from the event's extras as suggestions, and charged at
Complete like other costs. Terms costs stay in the Event Package and lock
at Start Episode.

**Where these stand:**
- M3 is added to D1 PR 3 (#2248). There, the wardrobe select, lock-outfit and
  purchase ledger rows record `episode_id` when the spend happens in an
  episode's context, with a test.
- Phases A–C are not filed.
- Phase A waits on D1's reconciliation (#2250).
- M6 is built into D1's ledger sum (#2267). Both `getCurrentBalance` and
  `syncCoinsFromLedger` leave out rows whose episode is no longer live.

**(bb) Task rulings (Evoni, 2026-09-29, Task #2262).** Docs only: no code
is changed by this entry. The basis is `docs/TASK_LISTS_READ.md` (Task
#2256, PR #2261), cited, not restated. The rulings are recorded verbatim.

**T1.** Only accepted host or brand deliverables can be required. Generated
social tasks are Lala's goals or optional ideas, never required; the
automatic "Sponsored Post 1/2 (required)" is removed.

**T2.** One task list, with a source on every item: host requirement, brand
deliverable, Lala's goal, or optional idea. The Career Checklist, phone
overlays and Run Sheet are views of it.

**T3.** Coins never come from ticking a task. Contract pay follows
deliverable status (Law 8). Whether finishing a goal affects story stats is
decided in the deal design.

**T4.** The Career Checklist is saved and reloaded; it shows saved tasks,
and Regenerate replaces its image instead of adding another asset row. The
AI never invents deliverables; it may only suggest goals and ideas, clearly
marked.

**T5.** After Start Episode, task edits go to the episode's copy.

**T6.** Regenerating an episode keeps completion flags for tasks that carry
over.

T6 ruling (Evoni, 2026-09-29, Task #2306): "Regenerate starts from the
replaced episode's task list as it stands, keeping its edits and completion
flags, and adds any required deliverable task the event's accepted terms
include that the list lacks. It does not restore deleted goals or ideas or
generate new ones; fresh ideas come from the Career Checklist's Regenerate."

**T7.** Wardrobe-list completion comes from Lala's actual wardrobe choices,
with no manual toggle that gets silently overwritten.

**T8** (Evoni, 2026-09-29, Task #2292). "The automatic +1 stress penalty at
episode completion applies only when a required social task is traceable to
an accepted required deliverable. A legacy/template social task whose only
basis is required: true does not change Lala's stress. Those tasks may still
appear on the Run Sheet or affect production completeness, but they do not
create a character-state consequence unless they represent a canonical
obligation."

Completion-rate effects on reputation and influence stay unchanged for now.
Under T3 they are decided in the deal design. They are the ±1 reputation at
≥80% or <30% completion and the +1 influence at ≥90%, both in
`computeSocialTaskBonuses` (`src/services/episodeCompletionService.js`).

**Where these stand:**
- T3 is filed as a fix: #2263.
- T1 and T8 are built under #2292. `computeSocialTaskBonuses` counts a task
  as required only when it carries a `deliverable_id` stamped from an
  accepted deliverable.
- T2 is built in part under #2294, following Evoni's decisions of 2026-09-29:
  - a new `event_deliverables.owed_to` column (host or brand), set in the
    Event Package form, so a deliverable is a host requirement or a brand
    deliverable;
  - the one list is `episode_todo_lists.social_tasks`, holding the
    deliverables, social goals and ideas, and career goals and ideas; the
    wardrobe list stays separate (T7);
  - the Run Sheet and the Career Checklist are views of it;
  - the phone view is a later slice, #2295.
- T4's remainder is built under #2300 (PR #2302): Regenerate replaces the
  Career Checklist's image, and the saved image reloads. T2 had already
  saved and reloaded the list, and T1/T2 had kept the AI to goals and ideas.
- T5 is built under #2304 (PR #2305): after Start Episode, task edits go to
  the episode's copy.
- T6 is built under #2306, following the ruling above.
- T7 is filed as #2307.
- T3's contract pay by deliverable status belongs to the deal build (§8(z)
  Law 8).

**(cc) Deal answers (Evoni, 2026-09-29).** Docs only: no code is changed by
this entry. These are Evoni's answers to the open questions of
`docs/DEAL_DESIGN.md` §10 (Task #2310, PR #2312). That note is cited, not
restated. The answers are recorded verbatim; the note's §10 records the same
answers against each question.

**Taken as recommended:** "Q1–Q3, Q5–Q7, Q9–Q11, Q14–Q16: take the
recommendations as written. Q8: done by #2313."

**Q4.** "Adopt five Career Rate Anchors—Emerging, Rising, Established,
Influential and Elite. Rates are baselines, not fixed payouts. Actual
compensation is assembled from deal type, deliverables, rights,
restrictions, urgency and other canonical deal terms. Self-funded, comped
and gifted opportunities do not create cash income; gifted/comped value is
recorded separately."

Starting anchors (Prime Coins): Paid appearance 150/250/450/650/900; Reel
75/125/225/325/450; 3 Stories 35/60/110/160/225; Brand partnership base
—/500/900/1,300/1,800; Performance/creator booking 100/200/400/600/850.
Premiums apply only to the component they affect: rush 48h +10%, 24h +20%;
usage 30d +15%, 90d +25%; exclusivity 7d +10%, 30d +25%, 90d +40%;
paid-ad/whitelisting a separate premium; travel is reimbursement, not
income; gifted product is non-cash value.

**Q12 (changed).** "A SLAY does not automatically create Prime Coins. A
performance bonus is paid only when the accepted deal explicitly contains
one; SLAY can trigger that contractual bonus. The generic tier reward
(+150/+75/+25/−25) is retired for all completions from this ruling on; no
episode has been completed, so no balance has included it."

**Q13.** "B, with aggregation. Canonical career goals and accepted
deliverables may affect character state; optional ideas never do.
Deliverables contribute to an episode/event outcome rather than granting a
stat point independently for every completed task."

**Follow-up rulings (Evoni, 2026-09-29),** on the two points
`DEAL_DESIGN.md` §11.2 had left open:
- "event_reward retires with the tier reward (Law 8: money only from
  accepted terms; legacy events keep payment_amount)."
- "tier_paid_bonus retires too (Q12)."

Both retire with the tier reward in the payout PR (§8 PR 5).

**Deal PR 3 ruling (Evoni, 2026-09-30), "replacing the earlier draft
answers".** Recorded verbatim, on the pricing rules `DEAL_DESIGN.md` §10.2
lists. The earlier draft answers were never recorded as a ruling; this is
the first and only record of Evoni's answers on these points.

> 1. Modified. A Brand Partnership Base is its own guaranteed deal component, not an appearance fee. Required deliverables are priced on top. If the partnership also requires Lala to attend/appear, the Paid Appearance anchor is added separately.
> 2. Yes, with correction. Deliverables use a fixed typed list: Reel, Story Set (3), Post, Photo Set, Other. Reel and Story Set receive automatic Career Rate Anchors in V1; Post, Photo Set and Other are manually priced. Appearance is not a deliverable—it is a separate deal component with its own payout trigger. No pricing behavior may depend on guessing words from free text.
> 3. Additive. Multiple premiums affecting the same component are added, not compounded. +10% rush and +15% usage = +25%. A premium applies only to the component it affects and never increases unrelated components.
> 4. Yes, with the full mapping. Paid Appearance starts with the Appearance anchor; Paid Deliverables with deliverable fees; Appearance + Deliverables with both; Performance Booking with the Performance anchor plus separately required deliverables; Brand Partnership with the Partnership Base plus required deliverables and an Appearance component only when appearance is actually required. Self-funded and invited/comped produce no income. Gifted produces no cash income but records gifted value.
> 5. Later PR. Store and seed the versioned rate tables now so pricing is data-driven. Build the admin rate editor separately after the pricing and payout flow works end-to-end.
> 6. "Other" never receives an automatic price. It shows "Price required", and the terms cannot lock (Start Episode refuses) until it has one. Missing is missing.

`DEAL_DESIGN.md` §12 says what this changes, and deal build PR 3 (Task
#2341) builds it, including one guarded migration for point 1.

**Follow-up (Evoni, 2026-09-30),** on the three choices PR 3 put to her:
"Deal PR 3: I accept all three of your choices (wider Start Episode check;
the form should make "No fee (0)" one click; performance_fee its own
column; old deliverables untyped until chosen)." `DEAL_DESIGN.md` §12
records what each means.

**Deal PR 4 and PR 5 answers (Evoni, 2026-09-30),** on the two points
deal build PR 4 (Task #2365) put to her. Recorded verbatim;
`DEAL_DESIGN.md` §10.3 says what each builds:

> 1. Partnership base and performance fee are paid at Complete, each under its own ledger name; one guarded migration extends the payout unique index. Ship it in the same deploy as #2303.
> 2. Draft extras (and the first Propose terms) add an "Entry / ticket" cost: for self-funded deals, paid by Lala at the event's cost_coins, labelled "Auto-drafted · from event cost"; for invited/comped deals, the same line comped by the host. Elsewhere cost_coins stays difficulty only.

**Deal bonus ruling (Evoni, 2026-09-30),** on the shape deal build PR 5
(Task #2368) proposed for `bonus_terms`. Recorded verbatim;
`DEAL_DESIGN.md` §13 records what PR 5 builds:

> A deal bonus is stored as amounts by evaluation tier, e.g. { slay: 200, pass: 100 }; it pays only the amount for the tier reached; FAIL never pays; editable under Deal price until Start Episode.

**Reopen terms ruling (Evoni, 2026-09-30).** Recorded verbatim. It
answers what happens when an event's terms, locked at Start Episode (D4,
`findTermsLockEpisode`), need to change. Not yet built (Task #2378); the
build follows the CQ deploy.

> An event's locked terms can be reopened by Evoni only while its episode is a draft, has no ledger rows except wardrobe purchases, and every deliverable is still pending; with confirmation; saving relocks and records the reopen in the event's history. The brief's terms snapshot, deliverable stamping, deliverable tasks, estimated money and the affordability warning rebuild automatically on save. Invitation and script regeneration are offered, not forced, with a reminder when the terms mention money.

Her answers to the proposal's questions (summarised, not verbatim): yes to
the proposed test; invitation and script regeneration are offered, not
forced, with a reminder such as "Terms changed; the invitation mentions
money. Regenerate?".

**Invitation ruling (Evoni, 2026-09-30).** Recorded verbatim. It says
what the event invitation states about the deal; Task #2375 builds it
(`describeInvitationMoney` in `invitationCompositingService`).

> The invitation states the deal in the host's voice, in Prime Coins: what Lala is paid (fees, and each deliverable with its fee), what she pays (entry, if self-funded), what is covered and by whom (host or brand), and any bonus with its amount. Comped and gifted events say so without price talk.

**Follow-up (Evoni, 2026-09-30),** on the three choices #2375 put to her:
"I accept all three invitation choices (covered costs without amounts;
comped/gifted without fees or bonus; Lala's other costs left out)." What
each means:
1. A cost the host or brand covers is named with who covers it, without
   its amount.
2. A comped or gifted event names its deliverables without fees and states
   no bonus.
3. Costs Lala pays, other than a self-funded deal's entry, are not stated
   on the invitation.

**D12 and T9 (Evoni, 2026-09-30, Task #2395).** Recorded verbatim. D12
continues the D series of §8(x); T9 continues the T series of §8(bb). Not
yet built.

> D12. Propose terms drafts deliverables from the deal type, scaled to the job: comped/invited/gifted none required; paid appearance attendance only, optionally one Story set; paid deliverables 1–3 pieces, more at higher tiers or fees; brand partnership a package (Reel + Story set, a Post at higher tiers). Auto-drafted, editable, priced from the rate anchors.

> T9. Lala's goal tasks scale with the event: 2–3 for small or low-key events, 4–6 for major ones; no fixed template lists.

**T9 follow-up (Evoni, 2026-09-30).** Recorded verbatim. It answers the
question the T9 build raised (the Start Episode goals and the Career
Checklist were each limited separately, so a major event could show up to
12 of Lala's own tasks):

> The 2–3 / 4–6 limit applies to Lala's combined goal list (Start Episode goals plus Career Checklist); deliverables don't count toward it.

**T9 second follow-up (Evoni, 2026-09-30).** Recorded verbatim. It
answers what the combined limit left open: a well-described event reached
its maximum at Start Episode, so the Career Checklist had no room.

> Start Episode writes the lower goal count (2 for small or low-key events, 4 for major ones), leaving room for the Career Checklist up to the maximum.

**Event cost split (Evoni, 2026-09-30).** Recorded verbatim. It divides
the itemised event costs of deal build PR 4 (Task #2365; answer 2 above)
into terms costs and event spending; the money side is also noted in
§8(aa). Not yet built.

> Event costs split in two. Terms costs (entry, ticket, travel, anything the deal itself involves) stay in the Event Package and lock at Start Episode. Event spending (drinks, valet, photo booth and other things Lala chooses during the event) lives in the episode's Money tab, editable until Complete, each line quantity × unit price, auto-drafted from the event's extras as suggestions, charged at Complete like other costs.

**D13, D14 and D15 (Evoni, 2026-09-30).** Recorded verbatim. They continue
the D series of §8(x). Not yet built; to be designed first, in
`docs/DEAL_COMPONENTS_DESIGN.md`, which asks Evoni numbered questions.

> D13. Choosing the deal terms drafts the whole Terms section automatically: deliverables sized to the job (D12), their prices from the rate anchors, costs and who covers them, and a suggested bonus where the deal usually has one; all Auto-drafted and editable until the lock. Deliverable drafts also suggest Lala's relationship goals (e.g. a co-styled moment or follow-up with a guest brand), filed as goals, not deliverables.

> D14. A deal can combine components: Evoni ticks what it includes (paid to appear, paid for content, partnership base, performance fee, gifted items, entry covered), and the deal's label is derived from the combination. Write a short design note on replacing the single deal_type (migration, existing events, payouts, invitation wording), with numbered questions for me.

> D15. Deliverables use real influencer formats, each with a platform and quantity and a plain one-line description: Instagram Reel, TikTok video, GRWM video, Instagram Stories (×N), carousel post, Go Live, link in bio (days), try-on/haul video, content for the brand (UGC). Labels read naturally ("1 TikTok GRWM, 3 Instagram Stories"); "Story Set (3)" is renamed "Instagram Stories (×3)". Rate anchors for the new formats start as proportions of the Reel anchor for my approval: TikTok 1.0×, GRWM 1.2×, carousel 0.6×, Go Live 1.5×, try-on/haul 1.0×, UGC 0.8× (usage priced on top), link in bio 0.3× per 7 days. The Tasks list uses the same format names.

**Answers on D12, the costs and the D13–D15 design (Evoni, 2026-09-30).**
Recorded verbatim.

> D12's six choices: accepted as built (D13–D15 supersede the drafting).

> glam and styling stay terms costs.

> The extras migration plan for the cost split: accepted as proposed.

The answers to the 13 questions of `docs/DEAL_COMPONENTS_DESIGN.md`,
verbatim (the note's §8 lists the questions and §9 what each answer
changes):

> 1. Components are independent: gifted does not imply entry covered, and a performance booking does not imply paid content. Drafting may pre-tick "entry covered" when gifted is ticked, as a suggestion.
> 2. Label style for other combinations: yes, join the parts.
> 3. A cash deal without "entry covered" drafts no entry line; only self-funded deals draft an entry Lala pays.
> 4. A partnership base can be ticked without paid content (a retainer).
> 5. Suggested bonus on partnerships and performance bookings only: slay 20%, pass 10% of the cash total.
> 6. Relationship goals count toward T9's limit; at most 2 per event.
> 7. Travel and accommodation are drafted only when the event's location data says Lala travels; with no data, none are drafted.
> 8. "Post" becomes a new format, "Instagram post" (single photo), at 0.5× the Reel anchor.
> 9. Rounding to the nearest 5 and the new anchor table: approved.
> 10. Instagram Stories for N slides: the 3-slide anchor ÷ 3 × N, rounded to the nearest 5.
> 11. Link in bio is priced per started week.
> 12. The same format costs the same on every platform, for now.
> 13. Changing components re-drafts only what's still Auto-drafted, without asking.

**D13 travel (Evoni, 2026-09-30), verbatim:**

> Lala's home is 246 Olddy Paveway Ln, Echo Park, Los Angeles; store it as a show setting (address, neighbourhood Echo Park, city Los Angeles). Travel and accommodation are drafted only when an event's location is outside Los Angeles (fallback: category travel_destination); those lines are drafted with no amount and show "Price required" (never 0), so the price is set or comped before Start Episode. Getting around within Los Angeles (rides, valet) is event spending, not travel.

Built with D13:
- The home is stored as `shows.metadata.lala_home` and edited in Show
  Settings → Config ("Lala's home").
- An event's city is its venue's World Location city, read up the parent
  chain. When either city is unknown, the category is the fallback.
- `event_costs.amount` may be null ("Price required"). Start Episode
  refuses while a line Lala pays has none; a comped line needs no price.

**Where these stand:**
- The answers are recorded here and in `docs/DEAL_DESIGN.md` §10. §11 of
  that note says what they change in the design:
  - pricing becomes rate anchors by component and tier;
  - a bonus exists only in a deal that contains one;
  - the tier reward is retired, and the event reward and paid bonus with
    it;
  - stats aggregate.
- Q8 is built by #2313 (PR #2315).
- The deal build starts at `DEAL_DESIGN.md` §8 PR 1 (the schema).
- Retiring the tier reward joins the payout PR (§8 PR 5), per Evoni.
- The Deal PR 3 ruling (2026-09-30) is built by deal build PR 3 (Task
  #2341); the admin rate editor is a later PR, per its point 5.
- Answer 2 of 2026-09-30 (the drafted entry line) is built by deal build PR
  4 (Task #2365); answer 1 (the partnership base and performance fee at
  Complete) by PR 5, with its migration in the same deploy as #2303.
- The Reopen terms ruling (2026-09-30) is built after the CQ deploy (Task
  #2378).
- The invitation ruling (2026-09-30) is built by Task #2375.
- D12 and T9 (2026-09-30) are built after P10–P12 (Task #2395); the T9
  follow-up is built into the T9 PR.
- The event cost split (2026-09-30) is built after the D12/T9/P14 batch.
- D13, D14 and D15 (2026-09-30) are designed in
  `docs/DEAL_COMPONENTS_DESIGN.md`, answered the same day, and built in
  its order (the event cost split before D13's drafting).
- S1–S6 (2026-09-30, §8(dd)) are built after D13, one PR each; the scene
  model comparison is held until S1–S4 ship.

**Pricing ruling (Evoni, 2026-10-01).** Recorded verbatim:

> Deal prices use Lala's own career tier (her rate card), not the event's tier. A smaller event either meets her rate or doesn't book her.

What was built, with three fixes from the Terms screen of the Wearable
Experiments Studio Session (Echo Park):

1. **Prices at Lala's tier.** `dealPricingService.lalaPricingTier` reads
   Lala's tier from her reputation (`careerTierFromReputation`, the bands
   `getAccessibleCareerTier` uses). `draftTerms` prices every component and
   deliverable at it, through `draftDeliverablesForDeal`'s `priceTier` and
   `proposeTerms`'s `tier`.
   - The event's own tier still sizes the job (D12's drafted deliverables).
   - With no `character_state` row for Lala, the event's tier prices the
     deal, as before.
   - Both choices were accepted by Evoni (2026-10-01: "I accept your other
     two choices (sizing by the event's tier, prices by Lala's tier; fall
     back to the event's tier when no reputation is on record).").
2. **No "pricing vnull".**
   - A deliverable drafted with its price now counts as priced, so the
     deal records the card's `pricing_version` on its first draft.
   - A draft with no recorded version reads "Auto-drafted · pricing".
3. **"Auto-drafted" once.** A drafted, priced deliverable reads one note,
   "Auto-drafted · from deal · pricing v<N>" (`deliverableNotes`). An
   edited fee on an edited row reads Edited once.
4. **No travel from Echo Park.**
   - **The cause.** In the LalaVerse, Echo Park is one of the DREAM cities,
     so the World Studio seed gives its venues `city: 'Echo Park'`. Lala's
     home was stored as city Los Angeles, neighbourhood Echo Park, so the
     city comparison drafted travel.
   - **The correction** (Evoni, 2026-10-01), recorded verbatim:

     > Lala's home city is Echo Park, one of the five DREAM cities in the LalaVerse (not Los Angeles). Her home is 246 Olddy Paveway Ln, Echo Park. The DREAM cities (Echo Park, Dazzle District, Radiance Row, Ascent Tower, Maverick Harbor) are separate cities, each with its own streets, shops, restaurants and venues. An event inside Echo Park is local: getting there is event spending, never travel. An event in any other DREAM city drafts travel (and accommodation where a stay makes sense), with no amount and "Price required".

     It corrects D13's "Echo Park, Los Angeles" (§8(cc) D13 travel,
     2026-09-30), which stays recorded as it was given.
   - **Accommodation** (Evoni, 2026-10-01), added to the DREAM-cities
     ruling and recorded verbatim:

     > Between DREAM cities, travel is drafted but accommodation is not; a stay is added only when Lala decides (Evoni adds the line). For an event in a city outside the five DREAM cities, once such cities exist, travel and accommodation are both drafted, with no amount and 'Price required'.
   - **The fix.**
     - Migration `20261001210000` sets the stored home to city Echo Park,
       neighbourhood empty, address kept. It changes each `lala_home` whose
       city is Los Angeles and neighbourhood Echo Park; others are left.
     - `lalaTravelsFor` compares the venue's city (or, with no city known,
       its district) with the home city. An Echo Park venue is home; a
       venue in Dazzle District, Radiance Row, Ascent Tower or Maverick
       Harbor drafts travel only, with no amount. A venue in a city outside
       the five (`isDreamCity`, `DREAM_CITIES`) drafts travel and
       accommodation, both with no amount.
     - Re-drafting drops a drafted accommodation line that is still at its
       drafted value once the destination is a DREAM city. A stay Evoni
       added by hand is hers, and stays.
     - INFERRED: a venue with no known place falls back to the
       travel_destination category, which drafts both lines, as D13 built
       it.
     - The Show Settings help text says the same.
     - A stored home neighbourhood still counts as home, so a show not yet
       migrated keeps Echo Park local.

**(dd) Scene image rulings (Evoni, 2026-09-30).** Recorded verbatim; built
after D13, one PR each.

> S1. Every scene image is generated from one Scene Brief with three layers:
> the place (permanent: the World Location's architecture, materials,
> layout, equipment, approved reference images, and its district for
> neighbourhood and window views; map display colours never recolour
> buildings); the event (temporary: the explicitly chosen event's concept,
> activity setup, colours as décor and props); the shot (camera, required
> visible features, clear space for character overlays). Environment (time,
> weather, season) applies throughout. No people are generated.
>
> S2. The Scene Brief is shown before any paid generation, each line
> labelled "From venue", "From event", or "Your override", with missing
> essentials flagged.
>
> S3. Generating for an event requires choosing that event explicitly;
> never the first match.
>
> S4. Remove the injected generic instructions ("feminine aesthetic", "soft
> natural lighting"); lighting comes from the brief.
>
> S5. Venue generation saves the full brief and the world_location_id, and
> never overwrites a location's style guide.
>
> S6. A recurring location keeps one approved permanent base image;
> event-dressed versions are made from it, so the place stays recognisable
> across episodes.
>
> Hold the scene model comparison until S1–S4 ship.

**What the code does today: the review's claims, checked.** The checks were
read at `origin/main` `69ec4ac2` (2026-10-01), by function name, with line
numbers at that SHA. Each is MEASURED unless marked otherwise.

1. **No single brief: true.** Each path builds its own prompt string.
   - `sceneGenerationService.buildPrompt` (`:116`) reads only the scene set
     itself: its name, `canonical_description`, `time_of_day`, `season` and
     `visual_language.room_properties`, plus a camera modifier.
   - `generateAngle` prepends the camera direction (a second time), the
     spec's state ambient and the anchor objects.
   - `cropAndOutpaint` and `generateGptImageStill` each add their own
     prefix.
   - Venue generation (`venueGenerationService.buildVenueIdentity` and
     `generateVenueImages`) writes its own interior and exterior templates
     from event fields.
2. **Map display colours recolouring buildings: not found.**
   - The map colours are frontend styling constants (`DreamMap`), and
     `WorldLocation` has no colour field.
   - No prompt reads a map, city or district colour.
   - What does override a place's look today is hard-coded text: the
     venue category look-up in `buildVenueIdentity` (for example "cozy
     salon with neon signs, pink walls"). S1's rule still stands for the
     brief to come.
3. **World Location data unused: true.**
   - Neither the scene services nor the venue service read a World
     Location's `style_guide`, `floor_plan`, `sensory_details`,
     `venue_details`, district or parent.
   - The only references used are the scene set's own `base_still_url`
     and `style_reference_url`; the Flux text-to-image path ignores the
     latter.
   - The venue path's "neighbourhood" is parsed from the address string,
     defaulting to "creative district".
   - The WINDOW angle says only "Show what is visible beyond the glass."
4. **First matching event: partly true.**
   - `loadEventContext` (`:852`) takes the scene set's first event with
     `LIMIT 1` and no order (its `scene_set_episodes` fallback likewise).
   - But `buildPrompt` never reads it: its parameter is `_eventContext`,
     unused. So no event information reaches a scene-set prompt at all
     today.
   - Venue generation (`POST /world/:showId/events/:eventId/generate-venue`)
     does use the event named in its URL.
   - Related first-match choices:
     - creating an event with only `venue_location_id` links the first
       scene set at that location (`SceneSet.findOne`, no order);
     - event automation picks a venue location by heuristics
       (`eventAutomationService`).
5. **"feminine aesthetic" / "soft natural lighting": true.**
   - `buildPrompt` (`:186`) appends "Photorealistic cinematic quality.
     Pinterest-worthy feminine aesthetic. Soft natural lighting." to every
     base, angle, outpaint, refined regeneration, preview and stored
     prompt, and to the model comparison's sets.
   - `buildVideoPrompt` adds "Maintain warm soft natural lighting."
   - Other fixed lighting and style text, whatever the brief:
     - the `ANGLE_MODIFIERS` lighting (CLOSET "Soft warm glow", VANITY
       "Soft glamour lighting", WINDOW "Natural golden light streaming
       in");
     - the venue templates' "magical, aspirational", "alive and
       aspirational" and "cinematic and aspirational";
     - the description writer's "LalaVerse aesthetic: feminine,
       aspirational, warm tones…" (`sceneSetRoutes`), which lands in
       `canonical_description`;
     - a WorldAdmin event template's `venue_theme`.
6. **People: the claim as stated is wrong; it is weaker than claimed.**
   - `buildPrompt` opens with "Empty room, no people, …", and the venue
     prompts say "No text, no logos, no people."
   - But `NEGATIVE_PROMPT` ("person, people, human…") is never sent to a
     provider.
   - Some positive text invites people: the ACTION angle's "as if someone
     just walked through it"; the venue's "where fashion creators and
     influencers gather — make it feel alive" and "valet area".
7. **No brief before paid generation: true.**
   - "AI Generate" (`SceneSetsTab`) and the venue buttons (`WorldAdmin`)
     generate with no confirm step, and "Mark Ready" triggers venue
     generation itself.
   - A preview-prompt route exists (`GET /scene-sets/:id/preview-prompt`),
     but its frontend handler is wired to no button.
   - The only confirm step is the ADMIN model comparison's cost estimate.
8. **Venue generation saves no brief or location: true.**
   - Its `SceneSet.create` writes name, type, a one-line
     `canonical_description`, `base_still_url`, `show_id` and status.
   - There is no `world_location_id`, no stored prompt, and no angle
     prompts.
9. **Style guide overwritten: true.**
   - `generateVenueImages` replaces the whole of `world_locations.style_guide`
     with `{ venue_url, generated_for_event }` whenever the event's
     automation names a `venue_location_id`.
   - That wipes any materials, palette or architecture recorded there.
10. **No approved permanent base: true.**
    - There is no approved flag on scene sets, angles or locations.
    - `base_still_url` is replaced by any regeneration, by promote-to-base
      and by Scene Studio restyle.
    - The generate-base 409 guard checks `base_runway_seed`, which an AI
      base writes as null, so it never fires after one.
    - Venue generation makes a new scene set and new text-to-image stills
      per event.
    - Angles do derive from their own set's base (crop and outpaint, or
      edits), but only within one set.
11. **Environment: partly true.**
    - Time and season reach scene-set prompts as fixed sentences.
    - Venue prompts get only a 3-way time of day.
    - Weather appears nowhere.

**What S2 built** (Task #2395):

- **The brief, shown.** `POST /api/v1/scene-sets/:id/brief` (requireAuth,
  read-only) returns the brief a generation would send, with its prompt.
  - It covers the base (no `angle_id`), one angle (`angle_id`, the same
    `angleBriefOptions` as `generateAngle`), or the artifact-review
    regenerate (`refine`, the same `refinedBriefOptions` as
    `regenerateAngleRefined`). So what is shown is what is sent.
  - An edited, unsaved description can be shown (`canonical_description`)
    without being saved.
  - The base's estimate comes from its model's rate. An angle has none:
    INFERRED, its provider path (crop and outpaint, or full generation) is
    chosen at generation time.
- **Before every paid scene-set generation.** `SceneBriefConfirm` opens
  first. That covers "AI Generate", regenerate base, generate angle
  (including the automatic one after adding an angle), generate all
  angles, regenerate with a new description (cascade), and the artifact
  review's regenerate.
  - Each line is labelled "From venue", "From event" or "Your override".
    With no event chosen, the event layer reads "No event chosen" (S3 adds
    the choice).
  - Missing essentials are listed at the top and flagged on their lines.
    INFERRED: they do not block generating.
  - A line can be edited (it becomes "Your override"), removed when it is
    not essential, or reset. Confirming sends the overrides.
- **Overrides travel with the generation.** The generate-base, angle
  generate, generate-all-angles, cascade (through its job payload) and
  angle regenerate routes take `overrides` ({ line key: text }), checked
  by `readBriefOverrides`. The base keeps them on
  `base_generation.brief.overrides`; its angles inherit them, and a base
  regenerated with none given keeps its last ones.
- INFERRED scope: venue generation (`venueGenerationService`) does not
  build a Scene Brief yet, so it gets one with S5; mood and time variants
  and Scene Studio's object and background calls do not use the brief.

**S7, ruled** (Evoni, 2026-10-01), recorded verbatim; built with S3 and S5:

> S7. The Event Package's Place section lets Evoni choose a scene set for the event (the venue's own sets listed first) or create one for the venue. Creating opens the Scene Brief with this event chosen (S3) and the venue's World Location linked (S5), shows the cost, then generates the base. After Start Episode the chosen set is shown read-only with a link to it.

**What S3 built** (Task #2395):

- **The event is chosen on the base brief.** `POST /scene-sets/:id/brief`,
  `generate-base` and `cascade-regenerate` take `event_id`, checked by
  `readBriefEvent`:
  - an id must be an event of the set's show (else 404), and anything
    else but null is refused (400) before anything is generated;
  - null is no event;
  - not given, the base keeps the event its last brief was made for
    (`base_generation.brief.event_id`), as it keeps its overrides (S2).
    That event was chosen explicitly too.
- **Never the first match.** An event that uses the set
  (`world_events.scene_set_id`) does not put itself in the brief; only
  `event_id` does. The S1 loader (`loadEventContext`, `LIMIT 1`) was already
  gone; S3 keeps it so with a test.
- **Angles follow their base.** An angle's brief takes its base's event;
  an `event_id` sent with an angle is not taken. The cascade's job carries
  the event chosen, and its angles inherit it from the base.
- **The choice on the brief.** `SceneBriefConfirm` shows an Event choice on
  a base brief: "No event" and the show's events, by date (undated last).
  - It opens on the event passed in (S7 passes the Event Package's), else
    the base's own, else none.
  - Choosing re-asks the brief; confirming hands the choice to the
    generation.
  - An angle's brief says it takes its base's event, with no choice.
  - On the Scene Sets page, generate, regenerate and cascade send the
    event chosen (null for none).

**What S5 built** (Task #2395):

- **Venue generation is made from Scene Briefs.**
  `venueGenerationService.prepareVenueBriefs` builds two briefs for the
  event named in the route (S3) at the event's venue World Location
  (`venue_location_id`, else its automation copy):
  - the interior, the set's base (WIDE);
  - the exterior, an ESTABLISHING angle whose camera is the street-side
    facade (`EXTERIOR_CAMERA`).

  Overrides apply to both, except a camera override, which is the
  interior's. The old prompt templates and the category look-up are no
  longer sent. `buildVenueIdentity` is still exported and is no longer
  called; S4 removes it with the other generic text.
- **It saves the full brief and the `world_location_id`.** The new scene
  set keeps:
  - its World Location;
  - `base_generation.brief` (the interior's) and
    `base_generation.exterior_brief`;
  - the prompts sent: `base_runway_prompt`, and each angle's
    `runway_prompt`.

  The set's description is the location's own. Only a venue whose location
  has no description takes the event template's venue theme as the set's
  description.
- **It never writes the location's style guide.** The old replacement of
  `world_locations.style_guide` with `{ venue_url, generated_for_event }`
  is gone.
- **The brief before it is paid for (S2).**
  - `POST /world/:showId/events/:eventId/venue-brief` (requireAuth,
    read-only) returns both briefs and the estimate for the two images.
  - `generate-venue` takes the confirmed `overrides` and now has
    `aiRateLimiter`.
  - In the event editor, "Generate Venue Images" opens the venue's brief
    and generates on confirm.
  - For a linked scene set with no image, the button opens that set's base
    brief with this event chosen, and generates its base. The old call
    there was skipped because the event already had a scene set.
- **Mark Ready no longer starts a paid generation by itself.** With no
  venue, it opens the venue's brief. RULED (Evoni, 2026-10-01): "Mark
  Ready opening the venue brief is accepted."

**What S7 built** (Task #2395):

- **Choosing.** In the Event Package's Place section, "Choose scene set" /
  "Change scene set" open a picker of every scene set of the show
  (`orderSceneSetsForEvent`).
  - The venue's own sets come first, under "At <venue>": its World
    Location's, event locations first, then by name. The show's other sets
    follow, by name; a set with no image says so.
  - `GET /scene-sets` returns every show's sets, so another show's set is
    left out unless it is at the venue.
  - Choosing saves the event's `scene_set_id`.
  - Before S7 the picker listed only the venue's own sets, and only once a
    venue was set. A set can now be chosen with no venue; one is created
    only for a venue.
- **Creating one for the venue.** "Create a scene set for <venue>" (named
  after the venue, editable) creates an EVENT_LOCATION set at the venue's
  World Location (S5) and chooses it for the event.
  - Its base brief then opens with this event chosen (S3) and the cost.
    The base is generated on confirm, with the event chosen there.
  - Cancelling keeps the set chosen and generates nothing.
- **After Start Episode.** The chosen set is shown read-only: its name
  links to it, with no Change. The link opens Producer Mode → Assets →
  Scene Sets on that set (`?tab=scene-sets&set=<id>`, outlined).
  - The link shows before Start Episode too.
  - An unknown set says it was not found.
- **No set by matching.** Creating an event with a `venue_location_id` no
  longer links the first scene set found at that location
  (`SceneSet.findOne`, no order); a set named in the request is kept.

**What S4 built** (Task #2395). S1 had already taken the generic text out
of every scene-set image prompt (the brief is the whole prompt). S4 removes
what was left:

- `LALAVERSE_VISUAL_ANCHOR` ("Final Fantasy softness, Pinterest-core
  femininity…") and `ANGLE_MODIFIERS`, whose CLOSET, VANITY and WINDOW
  lines carried fixed lighting. Neither was sent any more. Each angle's
  camera is the brief's (`SHOT_CAMERAS`), with no lighting.
- The angle video prompt (`buildVideoPrompt`) said "Maintain warm soft
  natural lighting". It now says "Keep the lighting of the image".
- The description writer (`POST /scene-sets/ai-describe`) asked for "the
  LalaVerse aesthetic: feminine, aspirational, warm tones, soft textures,
  Pinterest-worthy"; its text becomes the place's description. It now
  asks for the place as it is, with no style, mood or lighting not given.
- Venue generation's category look-up and templates (`buildVenueIdentity`,
  unused since S5).
- **Scene Studio** (S4 extended, Evoni 2026-10-01: "Extend S4 to Scene
  Studio's object generation before it merges").
  - Object generation drops its style anchor (`OBJECT_STYLE_ANCHOR`:
    "Final Fantasy softness, Pinterest-core femininity…", warm neutral and
    pastel colours). An object is what was asked for, plus any style
    hints given, with even, neutral lighting. INFERRED: so it takes the
    lighting of the scene it is placed in.
  - Its background prompt drops "Pinterest-core femininity, luxury
    lifestyle, warm tones".
- `tests/unit/services/sceneGenericText.test.js` keeps that text out of
  the brief, scene-set generation, venue generation, the scene-set
  routes, and Scene Studio's object service and controller.

**Not changed** (INFERRED scope; each is a separate path):
- The restyle, mood and season variants are presets chosen explicitly.
- `NEGATIVE_PROMPT` is never sent.
- WorldAdmin's event template `venue_theme` is template text Evoni picks.
  It reaches a venue only as the set's description when the location has
  none (S5).

**S6, Evoni's answers** (2026-10-01), recorded verbatim:

> 1. The approved base lives on the World Location (a field naming its approved base image); migration accepted.
> 2. Event-dressed versions are made by editing the approved base with only the event layer, using Flux Kontext by default, priced and shown in the brief; revisit after the model comparison.
> 3. Regenerate, promote-to-base and restyle refuse to replace an approved base until Evoni un-approves it.
> 4. Nothing is approved automatically; Evoni approves each base from Scene Sets.

**What S6 built** (Task #2395):

- **The approved base (answer 1).** Migration `20261001220000` adds
  `world_locations.approved_base_scene_set_id`, `approved_base_image_url`
  and `approved_base_at`. All three are nullable, with no default and no
  backfill (answer 4).
- **Approving (answer 4).**
  - `POST /scene-sets/:id/approve-base` approves a set's base for its
    World Location. It needs a location and a base image.
  - A location keeps one approved base: approving another set's is refused
    (409) until the first is un-approved.
  - `DELETE /scene-sets/:id/approve-base` un-approves it.
  - Scene Sets shows the row on each card (`ApprovedBaseRow`):
    - "Approve as the location's base";
    - "Approved base" with Un-approve;
    - on another set at an approved location, "Event versions here are
      made from this location's approved base".
  - `GET /scene-sets` and `GET /scene-sets/:id` carry `base_approved` and
    `location_approved_base`.
- **Event-dressed versions (answer 2).** A base brief at a location with
  an approved base, with an event chosen (S3), for another set, has mode
  `event_dressing`.
  - Its prompt sends the rules, the keep-the-place instruction
    (`DRESSING_KEEP`) and only the event layer.
  - The generation edits the approved base image with Flux Kontext
    (`SCENE_DRESSING_MODEL`, `fal-ai/flux-pro/kontext`). It is recorded
    on `base_generation` with that model and the brief.
  - The brief shows "Made from this location's approved base image" with
    the image, and is priced from Kontext's rate.
  - Venue generation (S5) does the same for its interior. Its exterior is
    still generated in full.
  - RULED (Evoni, 2026-10-01, accepting the build's choices: "uploads
    refused over an approved base; no event = full generation; the
    approved set is never dressed"):
    - with no event chosen, a base is generated in full;
    - the approved set's own brief is never a dressed version.
  - The model is revisited after the model comparison (answer 2).
- **Never replaced while approved (answer 3).** These are refused with a
  409 naming the location while the set's base is approved:
  - regenerate base (`generate-base`), the cascade, promote-to-base;
  - Scene Studio's restyle (`regenerate-background`);
  - upload-base. RULED (Evoni, 2026-10-01): uploads are refused over an
    approved base.

  `generateBaseScene` refuses as well (`ApprovedBaseError`), which covers
  the worker. The card hides "Replace Base Image" and "Use … as Base"
  while approved.

**The scene model comparison (held).** `sceneModelComparisonService`, the
`/scene-sets/model-comparison` and `/scene-sets/base-models` routes (ADMIN),
and the frontend's `SceneModelComparison` (with `BaseModelSelect`) in
`SceneSetsTab` (#2401). Held means not run and not extended; the per-set
base model choice it shares with base generation stays.


**(ee) Wardrobe rulings (Evoni, 2026-10-01).** Recorded verbatim; built one
PR each:

> W1. Wardrobe pieces can be linked as a matching set; choosing the set equips every piece in its own slot at once, and the set shows as one look. Pieces stay individually choosable.
>
> W2. Accessories and jewellery allow several pieces at once; body (dress or top+bottom) and shoes stay single.
>
> W3. Full Closet still doesn't show all my pieces after #2382. Compare every wardrobe item for the show against what the Full Closet renders, list the missing ones with their stored category, and fix.

**W3, what the code shows and what was built.** MEASURED from the code
unless marked. No production data was read: the filing session has no
database access.

- **What the Full Closet reads.** The Full Closet and the World Admin
  wardrobe tab both read `GET /api/v1/wardrobe?show_id=`. That covers the
  show's own items and show-less ones, with `deleted_at` null. The Full
  Closet reads every page; World Admin reads one page of 200. So a piece
  World Admin lists is one the Full Closet also fetches.
- **Why pieces looked missing** (INFERRED; each could hide a piece):
  - The Full Closet showed one category group at a time (Body, Top,
    Bottom, Shoes, Accessories, Jewelry, Perfume, Other). The groups were
    switched by icon-only buttons, with no total and no "all" view.
  - It loaded once per page view, so a piece added since then did not
    appear until a reload.
  - A failed load showed an empty group, with no error.
  - The list endpoint paged by `created_at` alone. Pieces sharing a
    timestamp had no defined order across pages. A local probe of 450 tied
    rows did not reproduce a gap, but the order is not guaranteed.
- **The fix.**
  - The Full Closet opens on **All**: every piece at once. Each card shows
    its stored category and the group it falls in ("Mini Skirt · Bottom",
    "costume piece · Other").
  - The group switches show their counts.
  - The header reads "N of T pieces", where T is the server's total. It
    turns red, with "some did not load", when fewer arrived.
  - The closet reloads each time it opens.
  - A failed load says so, with Try again.
  - The list endpoint breaks ties by `id`, on the ORM path and the raw-SQL
    fallback alike.
- **Listing the missing pieces.** The All view now lists every piece the
  closet holds, with its stored category. A piece still missing from it is
  not in `GET /api/v1/wardrobe` for the show. It either belongs to another
  show (`wardrobe.show_id`), is deleted, or exists only in
  `wardrobe_library`. Those can be read only on the database, which agent
  sessions never touch.

**W2, what was built** (`EpisodeWardrobeGameplay`, `closetGrouping`
`MULTI_SLOTS`):

- **Several pieces.** Accessories (accessory and bag) and Jewelry hold
  several pieces at once. Choosing another piece adds it beside the ones
  already worn.
  - Each piece has its own ✕, and one comes off without the others.
  - The slot reads "· N pieces" and stays open to "+ Add another".
- **Single slots.** Body (dress, or top and bottom) and shoes stay single:
  a second pair of shoes replaces the first. INFERRED: Perfume stays
  single too, since the ruling names only accessories and jewellery.
- **Saving.** The lock sends every piece; the server already linked any
  number. A locked outfit restores every accessory and jewellery piece.
  A draft saved with one piece there still loads (`normalizeSlots`).
  Lala Suggests picks one piece per slot, as before.
- INFERRED: no cap per slot. The outfit score endpoint's 20-piece draft
  cap (`MAX_DRAFT_PIECES`) still applies to the whole outfit.

**W1, what was built.**

- **A matching set.** A matching set is the pieces sharing
  `wardrobe.outfit_set_id`, named by `outfit_set_name`. Both columns are
  from migration `20260217000001`, so W1 adds no migration.
  - `POST /api/v1/wardrobe/matching-sets` (`{ show_id, name, wardrobe_ids }`,
    at least two pieces) links pieces.
  - `PUT /api/v1/wardrobe/matching-sets/:setId` renames the set, or
    replaces its pieces; pieces left out are unlinked.
  - `DELETE /api/v1/wardrobe/matching-sets/:setId` unlinks every piece and
    keeps the pieces.
  - All three are requireAuth.
  - INFERRED: a piece is in one set at most; linking it into another moves
    it.
- **Linking pieces.** World Admin's wardrobe "Create set" (select pieces,
  then 👗 Create set) now links them as a matching set. Each linked piece
  shows "🔗 <set name>".
  - It still writes the outfit calendar's set (`/api/v1/outfit-sets`), and
    a failure there does not undo the link.
  - That table is created only by a dead migration tree (`migrations/`),
    so the matching set does not depend on it.
- **In the styling game.** The Full Closet has a **Sets** group: one card
  per set, with its pieces.
  - "Wear the set" equips every selectable piece in its own slot at once,
    through the same rule as one piece (`equipInto`). The set's separates
    replace a dress, and its jewellery adds to Jewelry.
  - A locked piece, or one with no game slot, is left out, and the message
    names it.
  - Two or more pieces of a set worn show as one look: "Look: <set name>".
  - Each piece stays choosable on its own, and its card shows the set it
    belongs to.
- **Old outfit sets** (Evoni, 2026-10-01, a read-only query on
  production): "the outfit_sets table exists with 0 rows. No copy
  needed." So no set made before W1 is lost, and no copy was built.

**Choices accepted** (Evoni, 2026-10-01): "I accept all your choices
(unknown venue city drafts travel and accommodation; perfume single; no
cap; one set per piece; sets need two pieces)." So these are no longer
INFERRED:
- the category fallback for an unknown venue city drafts both lines
  (§8(cc));
- Perfume stays single (W2);
- there is no per-slot cap (W2);
- a piece is in one matching set at most, and a set has at least two
  pieces (W1).
---

**(ff) Season Arc (Evoni, 2026-10-01).** Recorded verbatim. Nothing is
built yet. The read of today's code is `docs/SEASON_ARC_READ.md`; the
design note, with open questions, is `docs/SEASON_ARC_DESIGN_NOTE.md`.

> A1. Season Arc is Prime Studios' plan for where Lala's career and story go across a season. Events say what's next, episodes say what happened, Season Arc says where it's all going.
>
> A2. A season has 24 episode slots in three phases: Foundation (1–8), Ascension (9–16), Legacy (17–24). The Season Arc page centres on this roadmap, each slot showing its state: done, in production, event ready, needs an event.
>
> A3. Each future slot can carry an intention: story purpose, career focus, desired pressure, the story thread it continues, and the outcome range hoped for. Intentions are auto-drafted from the phase and the season so far, labelled, and editable.
>
> A4. The next slot's intention, with Lala's current state (balance, goals, narrative debt, recent formats, people and places), drives next-event suggestions and avoids repetition. The Event Package shows a small read-only Season Context block (season, phase, slot, purpose). Season Arc provides intent; the Event Package owns the event's facts.
>
> A5. Start Episode snapshots the season context onto the episode. The Overview shows its season position and purpose, and the script generator receives that context.
>
> A6. Accepting a completed episode updates the season: it records the actual outcome on its slot, updates career goals, story threads and narrative debt, checks whether a phase boundary is reached (checkPhaseTransition, currently never called), and readies the next slot.
>
> A7. Only future slots can be reordered or re-planned; a slot whose episode has started is locked to that episode.
>
> A8. A Planning Insights view compares planned pressure with actual results per slot. Season money (spend, income, balance trend) comes from the ledger only, never from cost_coins.

**Answers (Evoni, 2026-10-01)** to the design note's questions, recorded
verbatim. The question numbers are `docs/SEASON_ARC_DESIGN_NOTE.md` §3's.
Q4 and Q9–Q15 follow below.

> Q1 Yes: the existing "Soft Luxury Ascension" season is Season 1; my current episode is slot 1.
>
> Q2 Remove Extend; phase boundaries can shift within the 24, only across slots that haven't started.
>
> Q3 Episode numbers restart each season, shown "S1 · E7"; the show-wide count stays internal.
>
> Q5 Yes: an event can be pencilled into a future slot and moved freely; it locks at Start Episode.
>
> Q6 Ask first: at a phase boundary show a summary of the phase completed and what changes, and Evoni confirms.
>
> Q7 Pressure is Low · Medium · High · Peak. Desired is set in the slot's intention; actual is derived from the evaluation tier, the episode's money net and the stress change.
>
> Q8 A repeat is the same format, host/brand or venue within the last 3 episodes; it warns, never blocks.

**Answers, second set (Evoni, 2026-10-01)**, verbatim: "I accept your
recommendations for Q4 and Q9–Q15 as written." The recommendations she
accepted, as written:

> Q4 Existing episodes: fill slots in `episode_number` order, counting your current episode as slot 1. List any other existing episode for you to place or leave unslotted, rather than guess.
>
> Q9 Story threads: you create and name them; drafts are offered from `seeds_future_events`. Acceptance can mark one "advanced", and only you close one.
>
> Q10 Outcome range: a tier range (e.g. "pass to slay") that also sets the brief's `designed_intent` and `allowed_outcomes` at Start Episode, so there's one source.
>
> Q11 Goals on acceptance: replace "+1 to every goal" with each goal set from what it measures. Coins come from the ledger, other stats from Lala's state after the episode; custom goals are left unchanged.
>
> Q12 Drafting cost: draft only the next open slot, on acceptance and on demand, not all 24 at once.
>
> Q13 Planning Insights' money: per slot, with phase totals. The balance trend counts every ledger row, so deals and purchases between episodes show.
>
> Q14 `cost_coins` elsewhere: take the Episode Ledger's `cost_coins` tag out in the Insights PR. Leave the other `cost_coins` uses for a separate ruling.
>
> Q15 Season-health score: fold it into Planning Insights as one line, using the slot outcome ranges instead of the fixed 1/4/2/1 targets.

Every question in the design note is now answered.

**Build choices accepted (Evoni, 2026-10-01)**, Season Arc PR 4, verbatim:
"PR 4 choices accepted: the pressure formula as described; passive goals
and untracked-stat goals left unchanged." So these are no longer INFERRED:
- **Actual pressure (Q7)** is `derivePressure` (`seasonSlotService`): the
  tier gives slay 0 · pass 1 · safe 2 · fail 3 points; a money loss adds 1
  (2 below −1000); a stress rise of 2 or more adds 1 (2 at 4 or more).
  0–1 is Low, 2–3 Medium, 4–5 High, 6 or more Peak.
- **Goals on acceptance (Q11)** leave passive goals (such as "never let
  coins drop below 100") and goals whose metric Lala's state does not carry
  (followers, engagement rate, portfolio strength, consistency streak)
  unchanged, as well as custom goals.

**Build choice accepted (Evoni, 2026-10-01)**, Season Arc PR 5, verbatim:
"PR 5: designed intent at the top of the range is accepted." So at Start
Episode a slot's outcome range sets the brief's `designed_intent` to the
top of the range and `allowed_outcomes` to every tier in it (for "pass to
slay": slay, with pass and slay allowed); no longer INFERRED.

**Build choices accepted (Evoni, 2026-10-01)**, Season Arc PR 6, verbatim:
"PR 6 choices accepted as described (estimated pressure, the weights,
debt shown but not scored yet)." So these are no longer INFERRED:
- **Estimated pressure** (`seasonSuggestionService.estimatePressure`), an
  event's likely pressure before it runs: prestige above Lala's reputation
  (+1 for 1–2, +2 for 3 or more), a dress code strictness of 7 or more
  (+1), an unpaid cost above half her balance (+1); 0 Low, 1 Medium, 2–3
  High, 4 or more Peak.
- **The weights** in next-event suggestions: fits the slot's planned
  pressure +12 (one step off +4, else a warning); serves the slot's career
  focus +8; moves an active goal +5; each Q8 repeat (format, host or
  brand, venue within the last three episodes) −6 with a warning, never a
  block.
- **Narrative debt** is shown with the suggestions but not scored yet.

**Build choices (Evoni, 2026-10-01)**, Season Arc PR 7 (story threads),
verbatim: "1) a closed thread can be reopened by Evoni (with confirm),
keeping its history; 2) accepted; 3) accepted; 4) accepted. Build reopen
into PR 7." The four choices as put to her, with her rulings:
1. **Reopen.** Proposed: closing is final. Ruled: Evoni can reopen a
   closed thread, after a confirm, and it keeps its history. Built as
   `storyThreadService.reopenThread`: the thread returns to "advanced" if
   an accepted episode had advanced it, else to "open"; `closed_at` and
   the last advance are kept and `reopened_at` is set.
2. **An "advanced" thread can still be chosen** for later slots, so one
   thread runs across several episodes. Accepted.
3. **Drafts come from the seeds of the show's live episodes' briefs**
   (`narrative_chain.seeds_future_events`, deleted episodes left out); a
   seed already made into a thread is not offered again. Accepted.
4. **A thread can be renamed or re-described at any time.** Accepted.

**Build choices accepted (Evoni, 2026-10-01)**, Season Arc PR 8 (Planning
Insights), verbatim: "PR 8 choices accepted (Evoni, 2026-10-01), record
all five in §8(ff)." So these are no longer INFERRED:
1. **A deal keeps "Difficulty N"** in the Episode Ledger's event
   reference. It reads `cost_coins` but is not money; only the 🪙
   `cost_coins` tag is removed (Q14).
2. **The balance trend returns the newest 300 ledger rows**
   (`planningInsightsService.TREND_LIMIT`); the running balance still
   counts every row.
3. **Slots with no plan and no result are counted per phase** ("6 slots
   with nothing planned yet"), not listed.
4. **The season-health line (Q15)** counts accepted episodes whose slot
   had a planned outcome range, and how many of those landed inside it;
   accepted episodes without a range are counted separately.
5. **The old season-health route** (`GET
   /api/v1/season-rhythm/season-health/:showId`, the 1/4/2/1 grade) stays
   on the backend; the page no longer calls it.

**(gg) Episode Money, Phase B (Evoni, 2026-10-01).** Recorded verbatim.
Nothing is built yet. Phase B of §8(aa) M5; it builds on M1–M6 and the
event spending ruling (§8(aa), §8(cc)). The design note, reading today's
code against these rulings, with open questions, is
`docs/EPISODE_MONEY_PHASE_B_NOTE.md`.

> MB1. Every money line of an episode (deal payouts, deliverable fees, bonus, terms costs, event spending) shows one state: Planned (from the accepted terms or spending lines, its trigger not yet reached), Pending (its trigger reached but not yet posted, e.g. a deliverable submitted awaiting approval), or Posted (a ledger row exists, linked by its source).
>
> MB2. Each line shows its trigger ("at Complete", "on approval", "if SLAY"), who pays or covers it, and its amount. Planned and Pending never enter the ledger or the balance (M2).
>
> MB3. The Money tab shows the episode's projected net (posted + pending + planned) and Lala's projected balance after the episode, beside her actual balance. The header chip stays the actual balance.
>
> MB4. If the projected balance would go below zero, or event spending exceeds what Lala has, the Money tab and Start Episode/Complete warn early with the shortfall; existing refusals at Complete stay.
>
> MB5. The episode Overview gets a Money card (M1): actual net so far, projected net, and how many lines are still planned or pending.
>
> MB6. After Complete, a reconciliation view compares planned with posted per line and highlights differences (a bonus not earned, a spending line changed).

**Answers (Evoni, 2026-10-01)** to the design note's questions, verbatim:

> Q1, Q2, Q4–Q9: accept your recommendations as written.
> Q3: each tier's bonus is its own line, but conditional bonuses are not counted in the projection; show them as "+ up to X if SLAY" (or the tier named) beside the projected net.
> Q10: the Overview's ledger list is replaced by the Money card with a "See all in Money →" link; the Money tab is the one full view.

The recommendations accepted for Q1, Q2 and Q4–Q9 are in the note's §3,
as written there. Q3 differs from its recommendation: no bonus tier is
counted in the projection, the brief's `designed_intent` included.

**Build choices accepted (Evoni, 2026-10-01)**, Phase B PR 1, verbatim:
"PR 1 choices accepted (Evoni, 2026-10-01): "Not earned" for unreached
bonus tiers after Complete; "Covered" as its own state for comped costs."
So, beside MB1's Planned, Pending and Posted (`episodeMoneyLines.STATES`):
- **Not earned:** after Complete, a bonus tier that was not reached (no
  row was booked for it) shows "Not earned", struck through and outside
  every total.
- **Covered:** a terms cost the host or brand comps is listed with its own
  state, "Covered by <host or brand> (amount)", at 0 to Lala and outside
  every total.
---

## 9. Owed before enforcement

Located, not investigated beyond locating them, per this issue's scope.

- **Venue-name drift against `WorldLocation`.** `venue_name` is written
  as a plain string copy of `venue.name` at event-creation time in at
  least four places (`src/routes/worldEvents.js:2102,2122,2180-2183,2595`)
  and again editable independently via the event `PUT` route's
  `allowedFields` (`:312,347`). Nothing found ties `venue_name` back to
  `WorldLocation.name` after creation — if a location is renamed, or an
  event's `venue_name` is edited directly, the two can drift with no
  reconciliation mechanism. Not counted; only located.
- **`WorldEvent` rows linked to more than one episode.** No database read
  was performed (none was available or in scope). Located instead as a
  live code path: the `/inject` route (item 3 above,
  `src/routes/worldEvents.js:588-662`) has no guard against being called
  twice on the same event with two different `episode_id` values, and
  `WorldAdmin.jsx`'s Reassign and swap actions (`:918-934`, `:749-750`)
  call it for exactly that purpose. Any event either path has touched
  more than once now carries a `used_in_episode_id` pointing at only the
  most recent episode, with the earlier link gone from the row (though
  `times_used`, `WorldEvent.js:217`, would still show more than one use).
  Counting actual rows in this state is owed, not done here.
- **What the Events-tab template cards are.** Located: a hardcoded
  literal array in `frontend/src/pages/WorldAdmin.jsx:2051-2066` — three
  objects (Creator Roast Night, Fashion Mystery Box, Creator Speed
  Dating; `:2053-2055`), each with `name`/`category`/`icon`/`desc`/
  `energy`/`venue_theme` fields. No `EventTemplate` model exists in
  `src/models/` at this basis (checked). Clicking one calls
  `POST /api/v1/world/:showId/events` directly (comment at `:2119`:
  "Create world event directly from template — no calendar middleware")
  to spawn a single `WorldEvent` — the card itself is not persisted or
  reusable in the database sense; only its three hardcoded definitions in
  this component are. Whether these are meant to become the reusable
  templates decision 3 implies exist somewhere, or are something else
  entirely, is not decided here.
