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

**(a) The schema target.** `organizer_type` with `organizer_profile_id`
and `organizer_brand_id`, replacing free-text `host_brand` with a link to
`lalaverse_brands`. This is a production schema change — hers to decide
and run, not this document's or this task's to propose as a migration
file. Recorded here as proposed, not planned.

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
