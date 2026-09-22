# Event Taxonomy: Drift Check, Format List, Vocabulary Map, Migration Shape

**Task #1635.** Docs only — no code, no migration file, no data changed, no query run
against a live database. Records Evoni's ruling (2026-09-22, `docs/EVENT_EPISODE_FLOW.md`
§8(k)) that `world_events.event_type` stays the mechanic and events gain `category`
(ten values, settled) and `format` (not yet settled), and plans the schema change the
ruling requires before anyone writes it.

**Basis:** `origin/main` at `6a3bdd9d27d1f5c9f05223d7999b724f5d76f7f8` (2026-09-21).

---

## 1. Drift check — `world_events` against the 2026-09-17 canon capture

**Required first, per the ruling: if `world_events` differs between its migrations and
canon, this plan stops here and reports rather than proposing a migration against an
unverified shape.**

**Every migration touching `world_events`, MEASURED:**

```
$ grep -rl "world_events" src/migrations/ | sort
src/migrations/20260219000003-world-events.js
src/migrations/20260219000004-world-events-career-fields.js
src/migrations/20260630000000-add-scene-set-id-to-world-events.js
src/migrations/20260701000000-add-host-to-world-events.js
src/migrations/20260703000000-add-invitation-fields-to-world-events.js
src/migrations/20260709000000-enrich-locations-and-events.js
src/migrations/20260711000000-add-source-calendar-to-world-events.js
src/migrations/20260719000000-career-pipeline-links.js
src/migrations/20260720000000-add-outfit-pieces-to-world-events.js
src/migrations/20260723000000-enhance-feed-events.js
src/migrations/20260804000000-add-outfit-to-world-event.js
src/migrations/20260805000000-episode-brief-outfit-set-and-event-uniqueness.js
src/migrations/20260807000000-add-source-profile-to-world-event.js
```

Twelve migrations. Each was read in full for its `up()` block's `createTable`/`addColumn`
calls against `world_events` (`20260723000000-enhance-feed-events.js` also touches
`feed_posts`, not counted here; `20260719000000-career-pipeline-links.js` also touches
`opportunities`/`career_goals`, not counted here; `20260805000000-episode-brief-outfit-set-and-event-uniqueness.js`
touches `episode_briefs` and adds a unique index on `world_events.used_in_episode_id`, no
new column). Combined, unique column set from the migration tree, sorted:

```
arc_id, border_style, browse_pool_bias, browse_pool_size, canon_consequences,
career_milestone, career_tier, chain_position, chain_reason, color_palette, cost_coins,
created_at, deadline_minutes, deadline_type, deleted_at, description, dress_code,
dress_code_keywords, event_date, event_time, event_type, fail_consequence, floral_style,
guest_list, host, host_brand, id, invitation_asset_id, invitation_details, is_paid,
location_hint, momentum_score, mood, name, narrative_stakes, opportunity_id,
outfit_pieces, outfit_score, outfit_set_id, overlay_template, parent_event_id,
payment_amount, prestige, required_ui_overlays, requirements, rewards, scene_set_id,
season_id, seeds_future_events, show_id, source_calendar_event_id, source_profile_id,
status, strictness, success_unlock, theme, times_used, updated_at, used_in_episode_id,
venue_address, venue_location_id, venue_name
```

**62 columns**, hand-extracted from each migration's `createTable`/`addColumn` calls above
(no single grep produces this list — each of the twelve files was read in full and its
column names collected by hand, since some columns are added conditionally behind
`describeTable` guards and grep alone can't distinguish a real `addColumn` call from a
comment mentioning the same word).

**Canon's `world_events` columns, MEASURED against `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`:**

```
$ grep -c "^ world_events " docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
62

$ grep "^ world_events " docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2}' | sort
arc_id
border_style
browse_pool_bias
browse_pool_size
canon_consequences
career_milestone
career_tier
chain_position
chain_reason
color_palette
cost_coins
created_at
deadline_minutes
deadline_type
deleted_at
description
dress_code
dress_code_keywords
event_date
event_time
event_type
fail_consequence
floral_style
guest_list
host
host_brand
id
invitation_asset_id
invitation_details
is_paid
location_hint
momentum_score
mood
name
narrative_stakes
opportunity_id
outfit_pieces
outfit_score
outfit_set_id
overlay_template
parent_event_id
payment_amount
prestige
required_ui_overlays
requirements
rewards
scene_set_id
season_id
seeds_future_events
show_id
source_calendar_event_id
source_profile_id
status
strictness
success_unlock
theme
times_used
updated_at
used_in_episode_id
venue_address
venue_location_id
venue_name
```

**Same count (62), and comparing this sorted list against the migration-derived set above,
name for name: identical, both directions.** No column appears in one list and not the
other.

**No drift.** All 62 column names match exactly, both directions — nothing in canon that
the migrations don't account for, nothing in the migrations that canon lacks. Spot-checked
types on the columns most relevant to this plan: canon's `event_type` is
`character varying`, `is_nullable = NO` — matches the migration (`STRING(30)`,
`allowNull: false`) and the model (`src/models/WorldEvent.js:35-40`, same type/nullability,
`comment: 'invite | upgrade | guest | fail_test | deliverable | brand_deal'`). Canon's
`status` and `host`/`host_brand` also match their migration definitions on type and
nullability. A full type-for-type diff of all 62 columns was not performed — the name-set
match plus these spot checks is the evidence this plan proceeds on; a future session adding
the actual migration should re-verify types for any column it touches directly, per this
repo's own convention (mention is not carriage).

**Conclusion: the plan does not stop here. `world_events` is safe to add columns to
without first reconciling drift — there is none to reconcile.**

---

## 2. Format list — proposed, not decided

Evoni's ruling names three existing sources of format-like values as a head start. Read
fresh:

**QuickEpisodeCreator's own presets** (`frontend/src/components/QuickEpisodeCreator.jsx:25-64`),
whose object key is confusingly named `event_type` even though the values are clearly
formats, not mechanics:

```
cocktail, garden, gallery, gala, brunch, concert, brand_launch
```

**This is a live, MEASURED bug, not just a naming collision.** `handlePresetSelect`
(`:265-266`) does `setEventType(preset.event_type)`, and the resulting `eventType` state is
sent as `event_type` in the `POST` body at three call sites (`:310`, `:327`, `:366`) — every
event created through this component's presets writes a format string (`'cocktail'`,
`'gala'`, …) into the real `event_type` column, not one of its six documented mechanic
values. This is exactly the confusion Evoni's ruling resolves; once `format` exists, these
presets' values belong there, and the component should stop writing them into `event_type`.

**The photo-booth check** (`src/routes/worldEvents.js:2450-2456`):

```js
// Photo booth only fires on events where it makes narrative sense —
// galas, premieres, launch parties. Detected from event_type or the
// dress code mentioning "red carpet".
const photoBoothPrompt = (event.dress_code || '').toLowerCase();
const wantsPhotoBooth = ['gala', 'premiere', 'launch', 'brand_deal'].includes(event.event_type)
  || photoBoothPrompt.includes('red carpet') || photoBoothPrompt.includes('photo');
```

Adds two format-shaped values not in the presets list: `premiere`, `launch` (distinct from
the preset's `brand_launch`). Also mixes in `brand_deal`, which *is* one of the six real
`event_type` mechanic values — this check currently reads one column expecting two
different vocabularies at once, which is only not-broken today because no code path
actually writes `'gala'`/`'premiere'`/`'launch'` into `event_type` except the buggy preset
path above (for `'gala'` only; `'premiere'` and `'launch'` alone, without `brand_launch`,
appear to be currently unreachable through any writer this plan found).

**The Events-tab "Feed event templates" grid** (`frontend/src/pages/WorldAdmin.jsx:2095-2108`,
twelve hardcoded template objects) uses its own `category` field for card color-coding only
— not sent to the backend directly, but tucked into `canon_consequences.automation.category`
(a JSONB blob) at creation time (`:2176`). Its twelve `name` values are event *concepts*
("Creator Roast Night," "Fashion Mystery Box," …), not formats — none maps cleanly onto a
format list, but its `category` field (`creator_economy`, `fashion`, `beauty`, `creative`,
`music`, `lifestyle`) is one more input to §3's mapping below, and its hardcoded `event_type: 'invite'`
(`:2165`) is correctly a mechanic value, unlike the QuickEpisodeCreator bug above.

**Proposed format list, drawing on all three sources — a draft table for Evoni's approval,
not a decision:**

| Proposed `format` value | Sourced from | Notes |
|---|---|---|
| `cocktail_party` | QuickEpisodeCreator `cocktail` | Renamed from the bare preset value to read as a value, not a mechanic-shaped word |
| `garden_soiree` | QuickEpisodeCreator `garden` | |
| `gallery_opening` | QuickEpisodeCreator `gallery` | |
| `gala` | QuickEpisodeCreator `gala`; photo-booth check `gala` | Two sources agree |
| `brunch` | QuickEpisodeCreator `brunch` | Distinct from the `brunch_dining` *category* — a brunch can be any category's format in principle, though in practice it will mostly co-occur with `brunch_dining` |
| `concert` | QuickEpisodeCreator `concert` | |
| `brand_launch` | QuickEpisodeCreator `brand_launch` | |
| `premiere` | photo-booth check `premiere` | No current writer produces this value — proposed on the strength of the read check alone |
| `red_carpet` | photo-booth check's `dress_code` string match, not its `event_type` list | The check's own second detection path (`dress_code` mentioning "red carpet") suggests this deserves to be a first-class format value rather than a text-match fallback |

**Explicitly not proposed here:** a value for every one of the twelve Events-tab template
names — they read as event *concepts*, several per format (e.g. "Creator Roast Night" and
"Creator Speed Dating" are both plausibly `panel_or_show`-shaped, not obviously the same
format as each other either) — assigning each of the twelve a format is real creative work
this plan does not do. **This table is nine candidate values, explicitly marked
undecided. Evoni chooses, edits, adds, or replaces any of them.**

---

## 3. Category vocabulary mapping

**The ten settled categories** (`docs/EVENT_EPISODE_FLOW.md` §8(k)): `fashion`, `social`,
`brunch_dining`, `beauty_wellness`, `creator_brand`, `arts_entertainment`,
`luxury_prestige`, `community_local`, `travel_destination`, `personal_relationship`.

### 3.1 The five `cultural_category` variants

Five separate, MEASURED enumerations, none identical to any other:

**(a)** `CAT_COLORS` — identical in `frontend/src/components/Culture/EventsTab.jsx:9-16`
and `frontend/src/pages/CulturalCalendar.jsx:42-49`: `fashion`, `beauty`, `entertainment`,
`lifestyle`, `community`, `technology` (6).

**(b)** `DREAM_CITIES.categories` (`EventsTab.jsx:18-24`): `fashion`, `beauty`,
`entertainment`, `music`, `technology`, `lifestyle`, `community` (7 — adds `music` to (a)'s
set).

**(c)** `seasonalEventService.js`'s documented enum comment (`:105`):
`fashion|beauty|music|art|creator_economy|lifestyle|nightlife|charity` (8).

**(d)** `CATEGORY_TO_CONTENT` (`src/services/eventAutomationService.js:23-34`): `fashion`,
`beauty`, `music`, `art`, `food`, `nightlife`, `fitness`, `tech`, `film`, `charity` (10).

**(e)** `CATEGORY_TO_VENUE` (`eventAutomationService.js:37-46`): `fashion`, `beauty`,
`music`, `art`, `food`, `nightlife`, `fitness`, `film` (8 — same file as (d), missing `tech`
and `charity`, otherwise identical to (d)).

**Not counted as a sixth variant, but related:** `EVENT_TEMPLATES` in the same file
(`:49-74`) only has four category keys plus a `default` (`fashion`, `beauty`, `music`,
`art`) — a subset of (d)/(e), not a new vocabulary.

### 3.2 Other category-like vocabularies named in the issue

**`SocialProfile.content_category`** — free-text `STRING(100)` (`src/models/SocialProfile.js:36`,
no fixed enum on the column itself), but `CONTENT_CATEGORIES`
(`src/services/characterFollowService.js:7-13`) is the vocabulary the AI-generation prompt
constrains it to: `fashion`, `beauty`, `lifestyle`, `motherhood`, `family`, `faith`,
`fitness`, `relationships`, `luxury`, `entrepreneurship`, `cooking`, `home`,
`mental health`, `travel`, `music`, `comedy`, `gossip`, `drama`, `adult content`,
`sex work`, `onlyfans`, `finance`, `tech`, `gaming`, `crypto`, `sports`, `politics`,
`art`, `education`, `wellness` (30 — by far the largest).

**`Opportunity.category`** — free-text `STRING(50)`, documented in a code comment
(`src/models/Opportunity.js:25-28`): `fashion`, `beauty`, `lifestyle`, `luxury`,
`entertainment`, `media`, `tech` (7).

### 3.3 Found while investigating, not named in the issue's list

The Events-tab template grid's own `category` field (§2 above,
`WorldAdmin.jsx:2095-2108`): `creator_economy`, `fashion`, `beauty`, `creative`, `music`,
`lifestyle` (6). Included here since it is exactly the kind of category-shaped vocabulary
the issue asks this plan to map, even though the issue's own list of three named sources
didn't name it.

### 3.4 Full mapping table

Every distinct value found across all seven vocabularies above (3.1's five, plus
`content_category`, `Opportunity.category`, plus 3.3's template grid), mapped onto the ten
settled categories. **Values found in more than one vocabulary are listed once.**

| Found value | → Category | Confidence |
|---|---|---|
| `fashion` | `fashion` | Direct |
| `beauty` | `beauty_wellness` | Direct |
| `wellness` | `beauty_wellness` | Direct |
| `fitness` | `beauty_wellness` | Reasonable |
| `entertainment` | `arts_entertainment` | Direct |
| `music` | `arts_entertainment` | Direct |
| `art` | `arts_entertainment` | Direct |
| `film` | `arts_entertainment` | Direct |
| `comedy` | `arts_entertainment` | Reasonable |
| `creative` | `arts_entertainment` | Reasonable — but see `creator_economy` below, easy to confuse |
| `community` | `community_local` | Direct |
| `charity` | `community_local` | Reasonable |
| `creator_economy` | `creator_brand` | Direct |
| `entrepreneurship` | `creator_brand` | Reasonable |
| `media` | `creator_brand` | Borderline — could also read as `arts_entertainment` |
| `luxury` | `luxury_prestige` | Direct |
| `nightlife` | `social` | Reasonable |
| `food` | `brunch_dining` | Reasonable |
| `cooking` | `brunch_dining` | Reasonable |
| `travel` | `travel_destination` | Direct |
| `motherhood` | `personal_relationship` | Reasonable |
| `family` | `personal_relationship` | Reasonable |
| `relationships` | `personal_relationship` | Direct |
| `lifestyle` | **No clean fit** | **Flagged** — too broad; spans `community_local`, `personal_relationship`, and `travel_destination` depending on context, and appears in 4 of the 7 vocabularies (3.1(a), (b), (c); `Opportunity.category`) |
| `technology` / `tech` | **No clean fit** | **Flagged** — no category is tech-adjacent; appears in 3.1(a), (b), (d), and `Opportunity.category` |
| `gossip` | **No clean fit** | **Flagged** — a content *tone*, not an event category |
| `drama` | **No clean fit** | **Flagged** — same as `gossip` |
| `home` | **No clean fit** | **Flagged** |
| `faith` | **No clean fit** | **Flagged** |
| `mental health` | **No clean fit** | **Flagged** — closest is `beauty_wellness`, but that category reads as event/venue-oriented (spas, salons), not a health-content category |
| `adult content` | **No clean fit** | **Flagged** |
| `sex work` | **No clean fit** | **Flagged** |
| `onlyfans` | **No clean fit** | **Flagged** |
| `finance` | **No clean fit** | **Flagged** — closest is `luxury_prestige` for wealth-signaling content, but finance content itself isn't an event category |
| `crypto` | **No clean fit** | **Flagged** |
| `gaming` | **No clean fit** | **Flagged** |
| `sports` | **No clean fit** | **Flagged** |
| `politics` | **No clean fit** | **Flagged** |
| `education` | **No clean fit** | **Flagged** |

**12 of the roughly 38 distinct values found have no clean fit among the ten categories.**
Most of the misfits come from `content_category` (3.2) — expected, since that vocabulary
describes a *creator's whole content niche*, a broader concept than *what kind of event a
show host attends*, and was never designed against these ten categories. This plan does not
choose a resolution for any flagged value (drop it, add an eleventh category, map it to the
nearest neighbor anyway) — that is Evoni's call, the same as the format list in §2.

---

## 4. Migration shape

**Not written here — this plan lays out the shape and the type trade-off, and names it
Evoni's choice, per the issue's own scope.**

**Columns:** two new columns on `world_events`:

| Column | Purpose |
|---|---|
| `category` | One of the ten settled values (§8(k)) |
| `format` | One of the format-list values, once §2's draft is approved |

**Type — STRING with model-level validation, or ENUM. Trade-off, not a choice:**

| | `STRING` + model `validate: { isIn: [...] }` | Postgres `ENUM` |
|---|---|---|
| Adding a new value later | A code change only (edit the `isIn` array) — no migration | A migration is required (`ALTER TYPE ... ADD VALUE`), and Postgres cannot run that inside the same transaction as other schema changes in the same migration file |
| Precedent in this codebase | The existing convention for `event_type` and `status` on this exact table — both `STRING` with a comment, no `validate` block currently, matching `src/models/WorldEvent.js:35-40`, `:207` | `ENUM` **is** used elsewhere in this codebase — MEASURED: `grep -rl "Sequelize.ENUM\|DataTypes.ENUM" src/migrations/ src/models/` returns 85 files, so it is not unprecedented here, just not this table's own convention so far |
| Enforcement | Only as strong as whatever calls `.validate()` — raw SQL or a bulk `INSERT` bypasses it entirely, same as `event_type`'s comment-only enforcement today | Enforced by Postgres itself at the column level, for every write path including raw SQL |
| Cost of the format list changing after this ships | Low — the format list is explicitly undecided (§2); if Evoni adds a tenth value next month, `STRING` absorbs it free | Higher — every addition is its own migration |

**Recommendation: `STRING` with model-level `validate: { isIn: [...] }`, matching this
table's own existing convention for `event_type` and `status`, and because `format`'s own
vocabulary is explicitly not yet settled (§2) — the column most likely to need a value added
soon is the worst candidate for `ENUM`'s slower-to-extend shape.** Stated as a
recommendation, not a decision — it is Evoni's choice per the issue's own scope.

**Nullability:** both `allowNull: true`, no default. Neither category nor format can be
correctly inferred for existing rows (§3.4's mapping is a proposal for *code paths*, not a
backfill rule for *stored data* — a `nightlife` value found in a vocabulary is not the same
claim as "this specific existing event was a nightlife event"). A `NOT NULL` constraint
would require a backfill decision this plan does not make.

**Existing rows:** left `NULL` on both columns. No backfill, no data migration, no query
against any table — per the issue's own Do-not. If a later task decides to backfill from
`canon_consequences.automation.category` (§2's finding: the Events-tab template grid already
writes a category-like value there, for the events it created) or from another guessable
signal, that is a separate, later decision.

---

## 5. Follow-on code sites

**Not implemented here — listed for whichever task performs the migration.**

- **`frontend/src/components/QuickEpisodeCreator.jsx`** (§2): the preset's `event_type`
  field should be renamed to a `format` field, and `handlePresetSelect`/the three `POST`
  call sites (`:265-266`, `:310`, `:327`, `:366`) should stop writing preset values into
  `event_type` and start writing them into `format`. This is a real bug fix, not just a
  taxonomy follow-on — today, every event created through these presets writes a bogus
  value into `event_type`.
- **`src/routes/worldEvents.js:2450-2456`**, the photo-booth check: `['gala', 'premiere', 'launch', 'brand_deal'].includes(event.event_type)`
  should split into two checks once `format` exists — `['gala', 'premiere', 'launch'].includes(event.format)`
  (or whichever of §2's proposed values Evoni approves) for the format-shaped values, and a
  separate `event.event_type === 'brand_deal'` check for the one real mechanic value
  currently mixed into the same array.
- **`frontend/src/pages/WorldAdmin.jsx:2163-2180`**, the Events-tab template grid's
  creation `POST`: currently tucks `template.category` into
  `canon_consequences.automation.category` (a JSONB blob); once the real `category` column
  exists, this should send `category: template.category` directly (after §3.4's mapping
  resolves which of the template grid's six category values maps to which of the ten
  settled ones — `creative` and `creator_economy` are the two ambiguous ones in that
  mapping).
- **`src/routes/worldEvents.js`'s `POST /:showId/events` creation route** (not line-cited
  here — not read in this pass) should accept `category` and `format` in its request body
  once the columns exist, the same way it already accepts `event_type`.
- **Any route or service reading `world_events` for display or filtering** (the Events tab
  itself, `frontend/src/pages/WorldAdmin.jsx`'s events list; the financial-forecast endpoint
  at `worldEvents.js:2450` already read above) is a candidate to surface the new columns
  once populated — not enumerated exhaustively here, since this plan's own scope is the
  schema change, not a UI redesign.
- **This plan does not claim its own list above is exhaustive.** A full grep for every
  `event_type`/`category` read site across `src/` and `frontend/src/` was not performed;
  the sites above were found in the course of §1-§3's own research, not by a dedicated
  call-site census the way `docs/SCRIPT_PIPELINE.md` did for beats.

---

## What this plan does not do

- Does not write a migration file, alter any table, or run any query against a database.
- Does not choose a format list — §2's table is a draft for Evoni's approval.
- Does not resolve any of §3.4's twelve flagged category values.
- Does not choose between `STRING` and `ENUM` — §4 recommends `STRING`, states why, and
  names the choice Evoni's.
- Does not implement any of §5's follow-on code sites.
- Makes no host, AWS, database, or Cognito contact. Every claim above is either MEASURED
  (grep/read against this repository, reproducible from a clone) or explicitly marked as
  a proposal, a recommendation, or Evoni's own ruling, quoted.
