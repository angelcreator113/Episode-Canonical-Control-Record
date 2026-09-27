# How a New Event Draft Is Generated: a read, not a ruling

## Status of this document

**Read-only research, not a decision.** Not filed under `docs/audit/`; rules nothing, recommends
nothing, fixes nothing. It maps how an event started from a Feed creator gets its name,
description, date, time, dress code, category and format, and which of those fields the
wardrobe, evaluation and script code downstream actually reads. No code, constant, migration or
doctrine text was changed; no AI endpoint was called; no host, AWS, database or Cognito contact.

**Basis:** `origin/main` at `943b7e657227b31964901fa5903ce413814e2bf7` (2026-09-27). Every
file:line below is at that SHA and is paired with a stable name (function, route, constant),
per `CLAUDE.md`'s living-doc rule.

**Marks.** **MEASURED** = read in the code at the basis SHA, citation given. **CANNOT-TELL** =
a repo read cannot settle it; the reason is given. Anything unmarked inside a numbered section
is MEASURED by the citation beside it.

Prior art, cited not restated: `docs/EVENT_EPISODE_FLOW.md` (§8(k)/(l) taxonomy, §8(r) roles),
`docs/EVENT_TAXONOMY_PLAN.md`, `docs/EVENT_EDITOR_READ.md`, `docs/DESIGN_DOCTRINE.md`.

---

## 0. Short answers

- **Path:** New Episode → `NewEpisodeChooseHost` → `SocialProfileGenerator` (choose-host) →
  `handleHostEvent` → `POST /api/v1/world/:showId/events/from-profile` → `WorldEvent.create` →
  navigate to `/shows/:showId/events/:eventId` → `EventPackagePage`. (§1)
- **Saved at create, no acceptance:** name (`"Event with <creator>"`), description (a template
  sentence), date (45 days out, flagged auto-scheduled), `event_type: 'invite'`, prestige and the
  terms derived from it, venue, guest list, invitation style. (§1, §3, §6)
- **Not saved at create:** time, dress code, category, format. Each is shown as **Suggested**
  (deterministic tables, no AI) or **Missing** until Evoni accepts. (§6)
- **Name suggestions** are the only AI call in this flow (`suggest-names`, Haiku 4.5). The
  **show name is an input** when the show has one. (§4)
- **Format gates time and dress code:** both suggestions read the *saved* `format`, so they
  show Missing until a format is accepted (dress code can also come from a venue). There is no
  "Waiting for …" state in code. (§6)
- **Downstream readers never read `category` or `format`.** Scoring, browse pool and the
  script generators read `dress_code`, `prestige`, `strictness`, `event_type`, `host_brand`
  and (in some) `dress_code_keywords`. (§7)
- **No column or key named "activity" or "styling brief" exists on `world_events`.** Nearest
  existing homes are listed in §8 without judgement.

---

## 1. The path from choosing a Feed creator to a saved event — MEASURED

| Hop | Where | What it does |
|---|---|---|
| Route | `frontend/src/App.jsx:379` | `<Route path="/shows/:showId/new-episode" element={<NewEpisodeChooseHost />} />` |
| Page | `App.jsx:106-109`, `NewEpisodeChooseHost` | `<SocialProfileGenerator chooseHost showId={showId} defaultFeedLayer="lalaverse" />` |
| New creator → event | `frontend/src/pages/SocialProfileGenerator.jsx:398` | `if(chooseHost&&data.profile)await handleHostEvent(data.profile);` (a creator just generated goes straight to event creation) |
| Existing creator → event | `SocialProfileGenerator.jsx:1339` | card's `onHostEvent={handleHostEvent}` |
| Client call | `SocialProfileGenerator.jsx:474-484`, `handleHostEvent` | `createEventFromProfileApi(showId,{profile_id:profile.id,event_template:'Event'})` (`:478`), then `navigate(\`/shows/${showId}/events/${ev.id}\`)` (`:480`) |
| API wrapper | `SocialProfileGenerator.jsx:39-40`, `createEventFromProfileApi` | `POST /api/v1/world/${showId}/events/from-profile` |
| Second caller | `SocialProfileGenerator.jsx:1456-1459`, `createEvent` | same call, same `event_template: 'Event'` |
| Handler | `src/routes/worldEvents.js:2407`, `router.post('/world/:showId/events/from-profile', requireAuth, …)` | builds `eventData` (`:2530-2604`) and saves it with `models.WorldEvent.create(eventData)` (`:2607`); raw-SQL fallbacks at `:2618-2647` |
| Package route | `App.jsx:380` | `<Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />` |
| Package load | `worldEvents.js` single-event GET (`:150-236`) | returns `event`, `sourceProfile`, `startedFromProfile`, `venueLocation` (the venue's `venue_details.dress_code`, `:193-211`) … |
| Package state | `frontend/src/pages/EventPackagePage.jsx:367` | `const basics = resolveEventBasics(event, venueLocation, { suggest: !used, organizer: sourceProfile });` |

The request body carries only `profile_id` and `event_template` (`worldEvents.js:2410`). Both
Feed callers send `event_template: 'Event'`.

---

## 2. Creator/profile fields the handler loads, and where each goes — MEASURED

`models.SocialProfile.findByPk(profile_id, { attributes: [...] })` at `worldEvents.js:2414-2416`
loads exactly: `id, handle, display_name, content_category, archetype, follower_tier,
brand_partnerships, registry_character_id, lala_relevance_score, aesthetic_dna, city,
frequent_venues`.

| Loaded field | Reaches the saved event? | Reaches a prompt? | Citation |
|---|---|---|---|
| `id` | yes: `automation.started_from_profile_id` | no | `:2561`; guest-list exclusion `eventAutomationService.js:408` (`hostProfile.id`) |
| `handle` / `display_name` | yes: `creatorName` in `name` and `description` | no: `suggest-names` does not receive `name` (§4) | `:2526`, `:2532`, `:2527` |
| `content_category` | yes: `description` text, `narrative_stakes` text, `automation.content_category`; also picks venue and social tasks | no | `:2527`, `:2528`, `:2591`, `:2424`, `:2598` |
| `archetype` | yes: invitation style (`theme`, `mood`, palette, florals, border) | no | `:2510`, `:2515-2523` |
| `follower_tier` | yes: `prestige` (mega 8, macro 6, mid 4, else 3), and from prestige `cost_coins`, `strictness`, `deadline_type` | no | `:2420`, `:2447-2449` |
| `brand_partnerships` | yes: `automation.brand_partnerships`; first brand in `narrative_stakes` text | no | `:2470-2474`, `:2563`, `:2528` |
| `aesthetic_dna` | yes: overrides `theme` (`visual_style`) and `color_palette` | no | `:2512`, `:2516-2519` |
| `city`, `frequent_venues` | yes, via venue choice (`venue_location_id`, `venue_name`, `venue_address`, `location_hint`) | no | `findVenue`, `src/services/eventAutomationService.js:225-239` |
| `registry_character_id` | **no**: not read in the handler or in `findVenue`/`assembleGuestList` (grep) | no | — |
| `lala_relevance_score` (host's own) | **no**: `assembleGuestList` orders *candidate guests* by this column (`eventAutomationService.js:505`), not the host's value | no | — |

**Fields read but not loaded.** The `automation` block reads `p.follow_motivation`,
`p.follow_emotion`, `p.follow_trigger`, `p.event_excitement`, `p.lifestyle_claim`,
`p.lifestyle_reality`, `p.lifestyle_gap`, `p.beauty_factor`, `p.beauty_description`,
`p.aesthetic_power` (`worldEvents.js:2581-2590`). All ten are SocialProfile columns
(`src/models/SocialProfile.js:189-219`) but none is in the `attributes` list at `:2415`, so on
this path each is written as its fallback: `null`, or `5` for `event_excitement`, `0` for
`beauty_factor`. MEASURED as code; that the live rows hold those fallbacks is CANNOT-TELL (no
DB read).

No field of the profile reaches any AI prompt on this path: the handler makes no AI call.

---

## 3. The description template — MEASURED

`src/routes/worldEvents.js:2524-2527` (inside the `from-profile` handler):

```js
    // Task #1790: neither the name nor the description says the creator
    // hosts or organizes the event.
    const creatorName = p.display_name || p.handle;
    const descriptionText = `An exclusive ${p.content_category || 'creator'} event with ${creatorName}${venue ? ` at ${venue.name}` : ''}. ${guestList.length > 0 ? `${guestList.length} guests on the list.` : ''}`;
```

It is saved to the `description` column (`:2552`) and copied to
`canon_consequences.automation.description` (`:2573`). The name beside it, `:2532`:

```js
      name: `${event_template || 'Event'} with ${creatorName}`,
```

and the story angle, `:2528`:

```js
    const narrativeText = `This event could ${prestige >= 6 ? 'elevate' : 'establish'} Lala's position in the ${p.content_category || 'creator'} scene. ${sponsorBrand ? `Brand opportunity with ${sponsorBrand}.` : ''}`;
```

In the Event Package, description is "column only. Never suggested"
(`frontend/src/utils/eventBasics.js:332`, `resolveEventBasics` `:354`), so the template text
shows as **Set** the moment the event exists.

Doctrine rule 12, quoted without judgement (`docs/DESIGN_DOCTRINE.md:101-105`):

> **12. Public event description ≠ producer story angle.** The description
> is copy for someone deciding whether to attend: what happens, why go,
> what it feels like. It never restates database facts (guest counts,
> prestige numbers). The story angle is internal and separate.
> *Why:* a database summary is not copy.

---

## 4. The event-name suggestion endpoint — MEASURED

**Endpoint:** `POST /api/v1/world/:showId/events/:eventId/suggest-names`,
`src/routes/worldEvents.js:255` (`requireAuth, aiRateLimiter`). Header comment `:246-253`:
"Writes nothing — Evoni picks one (or types her own) through the existing PUT". Model
`['claude-haiku-4-5-20251001']` (`:337`), two-attempt loop, `max_tokens: 300`.

**Caller:** `EventPackagePage.jsx:637-648`, `fetchNameSuggestions`; opened only by a click
(`openNameSuggest`, `:650`; comment `:179-180`). A picked or typed name is saved by
`saveEventName` → `putEvent({ name: trimmed })` (`:655-671`).

**Inputs, exactly** (`worldEvents.js:270-313`):

- the event row: `SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL` (`:270-273`);
- `hostLine`: `event.host` text, replaced by the linked `SocialProfile` (`display_name`/`handle`
  plus `archetype`) **only when `event.source_profile_id` is set** (`:277-290`);
- `showName`: `models.Show.findByPk(showId, { attributes: ['name'] })` (`:292-296`).

```js
    const facts = [
      showName ? `Show: ${showName}` : null,
      hostLine,
      event.category ? `Category: ${String(event.category).replace(/_/g, ' ')}` : null,
      event.format ? `Format: ${String(event.format).replace(/_/g, ' ')}` : null,
      event.venue_name ? `Venue: ${event.venue_name}` : null,
      event.event_date ? `Date: ${event.event_date}` : null,
      event.event_time ? `Time: ${event.event_time}` : null,
      event.dress_code ? `Dress code: ${event.dress_code}` : null,
      typeof event.prestige === 'number' ? `Prestige: ${event.prestige}/10` : null,
    ].filter(Boolean);

    const factsBlock = facts.length > 0
      ? facts.join('\n')
      : 'No details recorded for this event yet beyond it existing — do not invent any.';
```

(`:300-314`). **Full prompt** (`:316-326`):

```
Suggest three short, creative names for this fictional social event, for a fashion/lifestyle content-creator show.

${factsBlock}

Rules:
- Each name is under 40 characters.
- No quotation marks in the name itself.
- Do not invent facts (a venue, a guest, a theme, a location) the details above don't give you — when details are sparse, lean on tone and whatever you do have (host, category, format) instead of making something up.
- Return three genuinely different options, not three variations on one phrase.

Return ONLY this JSON, no other text:
{"names": ["...", "...", "..."]}
```

Output is stripped of quote marks and cut to 40 characters, at most three (`:383-388`).

**Is the show name an input? Yes.** `Show: ${showName}` is the first fact line whenever the
`shows` row has a `name` (`:292-296`, `:301`).

**Not inputs:** the event's current `name`, `description`, `narrative_stakes`, `event_type`,
guest list, invitation style, and `automation.*` (including `started_from_profile_id` and
`content_category`).

**For a freshly created Feed event specifically:** `from-profile` writes `host: null` and
`source_profile_id: null` (`:2534-2536`), and `category`, `format`, `event_time`, `dress_code`
are unset (§6). So until Evoni accepts something, the facts are the show name, `Venue:`
(if a venue was found or created), `Date:` (the auto date) and `Prestige:`. The Feed creator
appears only once an organizer is accepted: `buildCreatorOrganizerUpdate` writes
`source_profile_id` (`frontend/src/utils/eventOrganizer.js:92`).

Doctrine rule 11, quoted without judgement (`docs/DESIGN_DOCTRINE.md:93-99`):

> **11. Event Name ≠ Episode Title.** The event name is what the event is
> called in Lala's world, written as its organizer would name it. It never
> uses the show name, episode number, "episode", "adventure" or
> "LalaVerse", and uses Lala's name only if she is literally part of the
> event's branding. The episode title comes later and may respond to what
> happened.
> *Why:* the two concepts had been bleeding together.

---

## 5. Every copy of the approved category and format lists — MEASURED

Columns: `world_events.category` STRING(50) nullable, `world_events.format` STRING(50)
nullable, and the separate mechanic axis `event_type` STRING(30) NOT NULL default `'invite'`.

| # | Copy | Governs | Values |
|---|---|---|---|
| 1 | `src/models/WorldEvent.js:46-53`, `category` `validate.isIn` (`:51`) — the only enforcing copy | `category` | `fashion, social, brunch_dining, beauty_wellness, creator_brand, arts_entertainment, luxury_prestige, community_local, travel_destination, personal_relationship` |
| 2 | `WorldEvent.js:54-61`, `format` `validate.isIn` (`:59`) — enforcing | `format` | `cocktail_party, garden_soiree, gallery_opening, gala, brunch, concert, brand_launch, premiere` |
| 3 | `WorldEvent.js:35-40`, `event_type` comment only, no `isIn` | `event_type` | `invite, upgrade, guest, fail_test, deliverable, brand_deal` |
| 4 | `src/migrations/20260922000000-add-category-format-to-world-events.js` — column comments `:31`, `:38`; header `:11-17`; `:20-22` "Enforcement is model-level … not a Postgres ENUM" | `category`, `format` | same 10 / same 8 |
| 5 | `src/migrations/20260219000003-world-events.js:38-43` | `event_type` | same 6 (comment; no constraint) |
| 6 | `frontend/src/constants/eventTaxonomy.json:2-23` | `category`, `format` | same 10 / same 8, same order |
| 7 | `frontend/src/utils/eventTaxonomy.js:24-25`, `EVENT_CATEGORIES` / `EVENT_FORMATS` (derived from #6) → Package selects `EventPackagePage.jsx:111-112`, suggestion filter `eventBasics.js` | `category`, `format` | = #6 |
| 8 | `frontend/src/pages/WorldAdmin.jsx:102`, `EVENT_TYPES` (Producer Mode; it has no category/format picker) | `event_type` | same 6 |
| 9 | `WorldAdmin.jsx:973`, `/events/ai-fix` prompt text | `event_type` | same 6 |
| 10 | `frontend/src/pages/feed/FeedEnhancements.jsx:197-204`, `INVITATION_TYPES` keys | `event_type` | same 6 |
| 11 | Tests: `tests/unit/routes/worldEvents-taxonomy.test.js:14-15`; `frontend/src/utils/eventBasics.test.js:20`; `frontend/src/utils/eventReadinessSections.test.js:207`; `tests/unit/models/WorldEvent.taxonomyMirror.test.js:28-39` asserts #6 equals #1/#2 in content and order | — | = #1/#2 |

**DB ENUM / CHECK:** none in `src/migrations/` for `category`, `format` or `event_type`.
Whether the live database carries one added outside this tree: CANNOT-TELL (no DB read).

**Partial maps that output these values** (every output is inside #1/#2):
`eventBasics.js` `FORMAT_START_TIMES` (`:39-48`), `FORMAT_DRESS_CODES` (`:53-62`),
`CONTENT_CATEGORY_TO_CATEGORY` (`:150-172`), `OPPORTUNITY_TYPE_TO_CATEGORY` /
`OPPORTUNITY_TYPE_TO_FORMAT` (`:176-185`), `NAME_WORDS_TO_CATEGORY` / `NAME_WORDS_TO_FORMAT`
(`:193-211`); `WorldAdmin.jsx:91-98` `TEMPLATE_CATEGORY_MAP`;
`frontend/src/components/QuickEpisodeCreator.jsx:32-70` `EVENT_PRESETS[].format`.

**Disagreements found:**

1. The canonical copies (#1, #2, #4, #6, #7, #11) agree on every value and spelling.
2. `src/routes/eventGeneratorRoute.js` (`POST /api/v1/memories/generate-events`) defines its own
   sets: "CATEGORY SPLIT" `industry / dating / family / social_drama` (`:193-197`) and
   `"event_type": "string — gala, press_day, date, family_obligation, feud, etc."` (`:217`),
   written to `world_events.event_type` via `ev.event_type || ev.event_category || 'invite'`
   (`:100`). Nothing is written to `category` or `format`. The same four-value
   `event_category` set appears in comments at `src/models/HairLibrary.js:52` and
   `src/models/MakeupLibrary.js:50`; `src/routes/episodeOrchestrationRoute.js:258` reads
   `event.event_category`, which is not a `world_events` column.
3. Format words matched against `event_type`, not `format`:
   `src/services/financialTransactionService.js:455`
   (`['gala', 'premiere', 'launch', 'brand_deal'].includes(event.event_type)`) and
   `src/services/wardrobeIntelligenceService.js:595-597` (`gala`, `premiere`, `launch`,
   `after_party`, `opening`, `date`, `dinner`, `coffee`). `launch` and `opening` are not
   canonical spellings (`brand_launch`, `gallery_opening`). The route's own photo-booth check
   uses `format` with `brand_launch` (`worldEvents.js:2878`), so the two checks differ.
4. `QuickEpisodeCreator.jsx` presets carry 7 of the 8 formats (no `premiere`), and its format
   field is a free-text input (`:621`).
5. No suggestion table or template map ever outputs `social` or `personal_relationship`.
6. The PUT `/world/:showId/events/:eventId` allowlist includes `category`, `format` and
   `event_type` (`worldEvents.js:619-620`) and writes raw SQL, so `isIn` does not run on that
   path; `frontend/src/utils/eventTaxonomy.js:16-18` notes this and flags out-of-list values
   (`inList`). How many rows hold out-of-list values: CANNOT-TELL (no DB read).
7. Not the same column: `opportunities.category` in `WorldAdmin.jsx:8308`
   (`fashion, beauty, lifestyle, luxury, entertainment, media`).

---

## 6. Date, time, dress code, category, format: auto-set vs suggested — MEASURED

All suggestion logic is in `frontend/src/utils/eventBasics.js`; its header says
"Everything here is pure and deterministic: no AI call, no I/O, no clock." (`:20`). The Package
renders three states only: `BASICS_STATE_LABEL = { set: 'Set', suggested: 'Suggested', missing: 'Missing' }`
(`EventPackagePage.jsx:115`). A suggestion is written only through "Use this"
(`acceptBasicsSuggestion`, `:412-416` → `saveBasicsField`, `:390-410` → PUT, then reload).

| Field (column) | At create (`from-profile`) | Suggestion | Logic | Depends on |
|---|---|---|---|---|
| **date** (`event_date`) | **Auto-set and saved.** `const eventDateStr = autoScheduledEventDate();` (`worldEvents.js:2486`), `event_date: eventDateStr` (`:2550`), flag `[AUTO_DATE_KEY]: eventDateStr` (`:2569`) | Never suggested (`eventBasics.js:347`, suggestion `null`) | Creation day + 45 days, UTC: `AUTO_SCHEDULE_DAYS = 45` (`src/utils/eventDateDefault.js:23`, `autoScheduledEventDate` `:31-35`). Labelled "auto-scheduled" while the column equals `automation.event_date_auto`; saving any date clears the flag (`EventPackagePage.jsx:395-397`) | none |
| **time** (`event_time`) | **Not set.** `event_time: null` (`worldEvents.js:2551`; Task #1757 comment `:2476-2485`) | Yes | `FORMAT_START_TIMES[event.format]` (`eventBasics.js:39-48`, `suggestEventTime` `:80-85`) | **saved `format`** |
| **dress code** (`dress_code`) | **Not set.** `dress_code: null` (`:2541`); `dress_code_keywords` not written (model default `[]`) | Yes | 1) `FORMAT_DRESS_CODES[ev.format]` (`:53-62`); else 2) the linked venue's `venue_details.dress_code`; then `", elevated"` if prestige ≥ 8 and not already formal (`suggestDressCode` `:100-124`, `ELEVATED_PRESTIGE` `:66`). Prestige alone never suggests | **saved `format`, or a venue dress code**. Venues auto-created by `ensureVenueLocation` (`eventAutomationService.js:273-312`) write no `venue_details`; whether a matched existing venue has one is CANNOT-TELL (data) |
| **category** (`category`) | **Not set** (not a key in `eventData`; no model default) | Yes | first match: organizer's `content_category`; else `automation.content_category` (written at `worldEvents.js:2591`); else `automation.opportunity_type`; else a whole word in the name (`suggestEventCategory` `:249-269`, map `:150-172`). A category outside the map (e.g. `lifestyle`) suggests nothing | none |
| **format** (`format`) | **Not set** | Yes, rarely here | first match: a whole word in the event **name** (`NAME_WORDS_TO_FORMAT` `:202-211`); else `automation.opportunity_type` (`award_show → gala`). Two formats named → nothing (`fromName` `:225-235`). `suggestEventFormat` `:281-293`; the organizer is taken but not read for format | the **name**: `"Event with <creator>"` yields a format only if the creator's name contains a listed word |

**The "format must be accepted first" dependency — present, implicit.**
`eventBasics.js:16-18`: "A suggested but unaccepted format feeds nothing: suggestEventTime and
suggestDressCode read the saved event.format only." `EventPackagePage.jsx:24-26`: "Accepting a
format is what lets the time and dress-code suggestions above appear: the save reloads the
event, and those two read its saved format." Code: `const format = event?.format;`
(`eventBasics.js:81`); `const fromFormat = ev.format ? FORMAT_DRESS_CODES[ev.format] : undefined;`
(`:102`). There is no disabled control and no "Waiting for" state: `frontend/src/` has no
"Waiting for" string outside tests (grep), so time (and dress code without a venue code) shows
**Missing** until a format is saved.

**A second chain, measured from the same code:** format is suggested from words in the *saved
name* (`suggestEventFormat`, `:285`), so accepting an AI-suggested name (§4) that contains, say,
"Gala" makes a format suggestion appear; accepting that format makes the time and dress-code
suggestions appear.

**Row order on the page:** `BASICS_ORDER = ['date', 'time', 'description', 'dressCode']`
(`EventPackagePage.jsx:114`) then Brand, category, format (`:875-878`); the format row sits
below the two rows it unlocks.

**Unaccepted suggestions cannot satisfy readiness:** readiness counts a field only in the
`set` state (`eventBasics.js:21-26`).

Doctrine rule 14, quoted without judgement (`docs/DESIGN_DOCTRINE.md:112-115`):

> **14. Suggestions stay suggestions.** Anything Prime Studios proposes is
> shown as suggested until Evoni accepts it. Field states are Set,
> Suggested, Generating, Missing, or Waiting for <dependency>.
> *Why:* nothing is written as canon silently.

---

## 7. What downstream code reads from the event — MEASURED

**None of the consumers below reads `category` or `format`** (grep for `event.category`,
`event.format` and variants across these files: no hits). `WorldEvent.CURRENT_ATTRIBUTES`
(`src/models/WorldEvent.js:421-437`) leaves both out on purpose (comment `:405-411`).

### 7.1 Outfit scoring / evaluation

| Consumer | Event fields read |
|---|---|
| `eventScoreContext` (`src/services/outfitScoreContext.js:32-43`); callers `scoreEpisodeOutfitForDisplay` (`src/routes/wardrobe.js:226`), `episodeCompletionService.js:263` | passes only `dress_code, prestige, strictness, event_type, host_brand, dress_code_keywords, season` (`season` is not a column) |
| `scoreOutfitForEvent` and helpers (`src/services/wardrobeIntelligenceService.js:682`) | `prestige` (`:692`), `event_type` (`:693`, `:81`, `:588`), `dress_code` (`:82`, `:589`, regex `:597-600`), `host_brand` (`:286`, `:361`, `:734-736`), `season` (`:150`, `:400`), `required_slots` (`:248`, `:392`; injected from `Show.metadata` at `worldEvents.js:3192-3194`), `source_profile_id` (`:552`), `canon_consequences.automation.{host_profile_id, host_handle, host_display_name, host_brand}` (`:548-556`). **`dress_code_keywords`: not read in this file** (grep: 0 hits) |
| `evaluate` (`src/utils/evaluationFormula.js:98`) | `dress_code` (`:204`, `:234`), `prestige` (`:212`, `:220`), `strictness` (`:220`), `deadline` / `deadline_minutes` (`:136`, `:174-181`), `cost` (`:288-291`) |
| completion context (`src/services/episodeCompletionService.js:287-292`) | `prestige`, `cost_coins`, `strictness`, `deadline_type`; also `host_brand` (`:86`), `outfit_pieces` (`:144`), `rewards` (`:335-336`) |
| `src/routes/evaluation.js:283-298` | `SELECT event_type, dress_code, dress_code_keywords, prestige, strictness, host_brand` |

### 7.2 Browse pool

| Consumer | Event fields read |
|---|---|
| `POST /api/v1/wardrobe/browse-pool` (`src/routes/wardrobe.js:1093`) | `WorldEvent.findOne({ attributes: ['name', 'event_type', 'dress_code', 'dress_code_keywords', 'prestige', 'strictness', 'host_brand'] })` (`:1107-1113`); `dress_code` words + `dress_code_keywords` merged (`:1154-1157`), `event_type` (`:1158`), `host_brand` (`:1159`), `prestige` (`:1198`, `:1295-1296`); `name`, `strictness` echoed only |
| `POST /world/:showId/browse-pool` (`src/routes/world.js:162`) | no `world_events` read: parses `[EVENT: k=v …]` from `episode.script_content` (`:201-209`); `generateBrowsePool` reads `dress_code`, `prestige` (`src/utils/browsePoolGenerator.js:167-177`) |
| `getWardrobePool` (`src/routes/episodeOrchestrationRoute.js:27`) | `dress_code_keywords` (`:39`), `event_types`/`event_type` (`:40`), `prestige` (`:41`) |

### 7.3 Script generators

| Consumer | Event fields read |
|---|---|
| `generateEpisodeScript` → `loadScriptContext` / `buildFullPrompt` (`src/services/episodeScriptWriterService.js:634`, `:71`, `:329`) | loads with `CURRENT_ATTRIBUTES` (`:111-119`); prompt block `:419-427`: `name, event_type, prestige, cost_coins, dress_code, host, host_brand, narrative_stakes, career_tier`, plus `career_milestone, fail_consequence, success_unlock`; `canon_consequences.automation.guest_profiles` (`:222-237`); organizer via `source_profile_id` / `automation.host_profile_id` (`:238`, `src/utils/eventOrganizer.js:32-52`); whole event to `getWardrobeIntelligence` (`:166`). Not read: `description`, `location_hint` |
| `generateGroundedScript` → `buildScriptPrompt` (`src/services/groundedScriptGeneratorService.js:56`, `:160`) | `SELECT *` (`:92`); reads `name, prestige, dress_code, cost_coins, narrative_stakes` (`:192`), `invitation_asset_id` (`:193`), `rewards.outcomes` (`:202-206`) |
| `generateScriptSkeleton` (`src/utils/scriptSkeletonGenerator.js:24`) | `name, host_brand, prestige, cost_coins, strictness, deadline_type, dress_code` (default `'elegant'`), `location_hint, browse_pool_bias, narrative_stakes` (`:33-42`) |
| `buildOrchestrationPrompt` (`episodeOrchestrationRoute.js:255-268`) | `name, dress_code, dress_code_keywords, prestige, strictness, host_brand, description`; also `event_category`, `style_aesthetic`, `reputation_score`, `coin_cost` (`:258-265`), none of which is a `world_events` column |

**`canon_consequences` keys read by these consumers:** only `automation.guest_profiles`,
`automation.host_profile_id`, `automation.host_handle`, `automation.host_display_name`,
`automation.host_brand`. Also, outside the three consumer families,
`generateEpisodeFromEvent` (`src/services/episodeGeneratorService.js:431`) reads
`canon_consequences.automation` (`:495-496`, `:786-788`) and `description` (`:707`) when copying
event fields into episode metadata.

---

## 8. Could an existing column or JSON key hold an "activity" or "styling brief" today? — MEASURED, no proposal

**No column or `canon_consequences` key named `activity`/`activities` or `styling_brief` exists
on `world_events`** (model `src/models/WorldEvent.js:11-332`; grep of writers).

Existing free-text homes, as they are:

| Home | Type | Written by | Read by |
|---|---|---|---|
| `description` | TEXT (`WorldEvent.js:72`) | `from-profile` template (§3); `eventAutomationService.js:715`; PUT | `buildOrchestrationPrompt` (`episodeOrchestrationRoute.js:268`), `episodeGeneratorService.js:707`; **not** the three script generators or scorers |
| `narrative_stakes` | TEXT (`:204`) | `from-profile` (`worldEvents.js:2528`) | all three script generators |
| `location_hint` | TEXT (`:109`) | `from-profile` (venue address) | `generateScriptSkeleton` (`:40`) |
| `dress_code` | STRING(200) (`:179`) | not at create on this path; Package / PUT | every scorer, browse pool, script generator (§7) |
| `dress_code_keywords` | JSONB array, default `[]` (`:183`) | PUT allowlist; not written by `from-profile` | `eventScoreContext`, `evaluation.js`, `wardrobe.js` browse-pool, `getWardrobePool`, orchestration prompt |
| `canon_consequences.automation.wardrobe_brief` | the Opportunity's JSONB `{dress_code, brands_required, style_direction, provided_pieces}` (`src/models/Opportunity.js:63`) | only `careerPipelineService.js:230` | no reader of the event's copy found (grep of `src/`, `frontend/src/`) |
| `canon_consequences.automation.dress_code` | string | `eventAutomationService.js:673` (calendar path), from `calendarEvent.activities?.dress_code`; the same value also goes to the `dress_code` column (`:725`) | CANNOT-TELL whether any reader uses the automation copy; none found among §7 consumers |
| `canon_consequences.automation.beauty_description` | text | `from-profile` (`worldEvents.js:2589`; `null` on this path, §2) | none among §7 consumers |
| `invitation_details` | JSONB, comment `'{ tagline, rsvp_by, attire_note, special_instructions, hosted_by }'` (`src/migrations/20260709000000-enrich-locations-and-events.js:107-111`) | none found | none found; **not declared on the model**. Whether the column exists in the live DB: CANNOT-TELL |
| `chain_reason` | TEXT (`:322`) | event-chain pipeline | not among §7 consumers |

`calendarEvent.activities` is a field of the calendar-event source object, not of
`world_events`; only its `.dress_code` is copied over (`eventAutomationService.js:673`).

---

## 9. Could not tell (collected)

- Live values of the ten unloaded profile fields on existing Feed-created events (§2): no DB read.
- Whether a matched existing venue carries `venue_details.dress_code` (§6): data, not code.
- Any live-DB CHECK/ENUM on `category`/`format`/`event_type`, and counts of out-of-list values (§5): no DB read.
- Whether `invitation_details` / `guest_list` columns exist in production (§8): no DB read.
