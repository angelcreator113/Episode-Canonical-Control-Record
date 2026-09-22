# Guest Ownership — a read, not a ruling

## Status of this document

**Read-only research, not a decision.** This is not filed under `docs/audit/`, carries no basis-SHA
immutability rule, and rules nothing — it exists so Evoni can choose which guest store is
authoritative with the full picture in front of her, not so this document can choose for her.
Nothing here changes code, runs a query, or writes a migration. Where a claim is verified against the
code it says so with a file:line; where something doesn't resolve from a repo read, it says that
instead of guessing.

Basis for the file:line citations below: `origin/main` at
`92a1baf4c0e25113cd6a6a3360fec0057f0f4c6d` (2026-09-22).

---

## 1. The two homes (cited, not restated)

`docs/EVENT_EPISODE_FLOW.md` §2 EVENT PACKAGE's "Guests" subsection already records that an event's
guests live in two places that don't always agree — `canon_consequences.automation.guest_profiles`
and the separate top-level `guest_list` column — without resolving which is authoritative. §8(b) and
§8(p)'s "Open questions for Evoni" (c) both point back to the same subsection rather than re-deriving
it. This document is the read that subsection's own text calls for: what each store actually holds,
who writes it, who reads it, and where they disagree — re-derived fresh at this document's own basis,
not carried forward from that section's citations (some of which have already drifted; see §2 below).

---

## 2. `world_events.guest_list`

**Shape.** A `JSONB` column, `allowNull: true`, default `[]`. Added by migration
`src/migrations/20260709000000-enrich-locations-and-events.js:97-104`, whose own comment defines the
intended shape: `Array of { character_id, character_name, rsvp_status, plus_one }`. **Not declared in
the Sequelize model** — `src/models/WorldEvent.js:120` carries only a comment, `// guest_list —
migration 20260709 (may not exist)`; there is no `guest_list` attribute in the model's own field list.

**Writers — one real, one explicitly not:**

- `POST /world/:showId/events` (`src/routes/worldEvents.js:364-490`, the core event-creation route)
  destructures `guest_list: _guest_list` from the request body at `:385` and never references
  `_guest_list` again — the underscore-prefix naming this file uses elsewhere for intentionally
  discarded values. **This route never writes `guest_list`, even when a caller sends one.**
- `PUT /world/:showId/events/:eventId` (`worldEvents.js:540-710`) lists `guest_list` in its
  `allowedFields` array (`:559`), and the route builds a raw SQL `UPDATE world_events SET ...`
  (`:706-709`, via `models.sequelize.query`, not a Sequelize model method — so the "not in the
  Sequelize model" gap above doesn't block a write here). But `guest_list` is **not** in the route's
  `jsonFields` set (`:599-602`, which lists `dress_code_keywords`, `canon_consequences`,
  `seeds_future_events`, `required_ui_overlays`, `rewards`, `requirements`, `color_palette` —
  `guest_list` is absent) — so unlike those sibling JSONB columns, a `guest_list` value sent to this
  route is **not** `JSON.stringify`'d before being bound as a raw-query replacement (`:643-645`,
  `:692-693`). Whether the `pg` driver correctly serializes a bound JS array/object into this column
  as-is wasn't verified by execution — this document didn't run anything — but it is the one place in
  the codebase that could put a non-empty value into this column, if any caller ever sends one.
- No other writer was found anywhere in `src/` or `frontend/src/`.

**Readers — exactly one:**

- `src/services/feedPostGeneratorService.js:87-91` — a raw SQL `SELECT guest_list FROM world_events
  WHERE id = :eventId`, defaulting to `[]`. If non-empty, its contents are dropped straight into an AI
  prompt for feed-post generation (`:174`, `EVENT GUEST LIST: ${JSON.stringify(guestList)}`).
- **Zero frontend references.** `grep -rn "guest_list" frontend/src/` returns nothing. Neither the
  Event Package, the Events queue, the invitation, nor any script generator reads this column.

**What this means together:** the one route that creates most events explicitly discards `guest_list`
on the way in; the one route that could write it doesn't type it the way its sibling JSONB fields are
typed; and the one reader that exists falls back to `[]` whenever it's absent. Nothing in this
document's read confirms whether any row in the real table actually has a non-empty `guest_list` —
that's exactly what §6's count answers, not guesses.

---

## 3. `canon_consequences.automation.guest_profiles`

**Shape.** Not a declared column — a key inside the `canon_consequences` JSONB blob (`WorldEvent.js`'s
one real, modeled JSONB field), under `.automation.guest_profiles`, an array of guest objects. The
shape is **not consistent across writers** — see §6 below; the two implementations that call
`assembleGuestList` write `{ profile_id, handle, display_name, relationship, [archetype,
follower_tier] }` (`src/services/eventAutomationService.js:340-448`, the array pushed at `:374-379`
and `:439-446`); the opportunity-pipeline writer instead writes `{ id, handle, display_name }`
(`src/services/feedEventPipelineService.js:420`) — no `profile_id` key at all.

**Writers — four creation paths, one inheriting from its parent:**

1. `POST /world/:showId/events/from-profile` (`src/routes/worldEvents.js:2293-2295`, writes at
   `:2395`) — calls `eventAutomation.assembleGuestList(profile, fakeCalEvent, models, 6)`, an explicit
   cap of 6, overriding the function's own default.
2. `eventAutomationService.spawnEventsFromCalendar` (`src/services/eventAutomationService.js:479-542`,
   writes at `:541`) — the calendar-driven path (`docs/EVENT_EPISODE_FLOW.md` §2's "EVENT
   (calendar-driven)"). Calls the same `assembleGuestList`, with `maxGuests` defaulting to 8
   (`eventAutomationService.js:480`) unless its caller overrides it. The one caller found,
   `POST /calendar/events/:id/auto-spawn` (`src/routes/calendarRoutes.js:637-650`), reads
   `max_guests` from its own request body, defaulting to 8 if absent — and WorldAdmin's "Auto-Fill
   This Month" button (`frontend/src/pages/WorldAdmin.jsx`, per `docs/EVENT_EPISODE_FLOW.md` §2)
   sends `max_guests: 6`.
3. The opportunity pipeline (`src/services/feedEventPipelineService.js:368-424`, writes at `:420`) —
   its **own, separate** guest-selection query (`:374-380`, raw SQL: `social_profiles` where
   `lala_relevance_score >= 3`, `ORDER BY RANDOM() LIMIT 6`), not `assembleGuestList`. This is a third,
   independent implementation of "pick some guests," with different selection logic (no relationship
   or category weighting, no archetype/tier diversity pass) and a different output shape (§6).
4. Momentum-chain follow-up events (`feedEventPipelineService.js:596-649`, writes at `:646`) don't
   select guests at all — they inherit the **parent** event's own `guest_profiles`, sliced to 6
   (`:607`, `:646`). A chain event's guest list is only ever as good, and only ever the same shape, as
   whichever of the three paths above created its parent.

**Readers, by consumer** (item 2's mapping):

| Consumer | `guest_list` | `guest_profiles` |
|---|---|---|
| **Event Package** (`frontend/src/pages/EventPackagePage.jsx`) | No | Yes — `:171`, the People section's Guests list, display-only (`<ul>`, no add/remove/reorder control) |
| **Events queue** (`frontend/src/pages/WorldAdmin.jsx`, the Events-tab card `computeEventState` drives) | No | **No** — the queue card itself reads neither store. A separate "Edit details" modal, opened from the card's overflow menu, reads `guest_profiles` read-only (`:3402-3410`, chips with no editing control) |
| **Invitation** (`src/services/invitationCompositingService.js`) | No | Yes — `:300-301`, up to 3 guest names woven into the invitation's prose paragraph |
| **Script generators** | No | Mixed — `src/services/episodeScriptWriterService.js:221` reads `guest_profiles[].profile_id` to pull Character Registry depth into the script prompt; `src/services/episodeGeneratorService.js:739-740` feeds it to `generateFeedMoments`, and `:782-784` builds a `guest_names` list for AI social-task context; `src/utils/scriptSkeletonGenerator.js` has **zero** guest references — the lighter draft-skeleton path doesn't use guests at all |
| **Evaluation** (`src/routes/evaluation.js`) | No | **No** — zero guest references found anywhere in that file |

Other readers found, not in the issue's named consumer list: `src/services/storyGenerationService.js:89`
(`profile_id`s → Character Registry depth for story-generation context, same pattern as the script
writer); `src/services/feedMomentsService.js:150,374` (guest names for feed-moment post text);
`src/services/characterSyncService.js:151-186` (post-episode relationship sync — see §5);
`src/services/feedActivityService.js:74-89` (simulated feed posts per guest, keyed on
`guest.profile_id`); `src/services/socialChecklistService.js:280-281` (`guest_names` for a social-task
checklist context); `src/routes/calendarRoutes.js:667` (`guest_count: auto.guest_profiles?.length`,
a count only, in a calendar-event summary endpoint); and three more WorldAdmin.jsx display sites
outside the Events queue proper — the Episodes tab's linked-event preview (`:1726,1731`), the
season-planning "Draft Events" panel's guest count (`:1957`), and
`frontend/src/pages/EpisodeTodoPage.jsx:264-270` (the Episode Todo page's own Guest List display).

---

## 4. Does either store link to a Social Profile?

**`guest_profiles`: yes, but only when the writer sets it, and not every writer does.** Every
`assembleGuestList`-sourced guest carries `profile_id` (§3's writers 1 and 2) — a real
`SocialProfile.id`. `src/services/characterSyncService.js:151-186` is the mechanism that turns that
link into an actual relationship effect: for each guest with a `profile_id` (`:154`, `if
(!guest.profile_id) continue;`), it loads that `SocialProfile`, appends the event to
`full_profile.attended_events`, recalculates the profile's auto-state, and calls `profile.update(...)`
(`:178`) — so a `guest_profiles` entry with a `profile_id` **does** carry a real, persisted
relationship with Lala's world after the episode airs. But the opportunity-pipeline writer (§3, writer
3) stores `id`, not `profile_id` — every guest it writes has `guest.profile_id === undefined`, so
`characterSyncService`'s guard silently skips them (`continue`), and the same gap silently drops them
from `storyGenerationService.js:89`'s and `episodeScriptWriterService.js:221`'s Character Registry
lookups (both `.filter(Boolean)` on `.map(g => g.profile_id)`), and produces a feed post with
`profile_id: undefined` in `feedActivityService.js:81`. See §6.

**`guest_list`: no evidence either way.** Its migration-comment shape (`character_id, character_name,
rsvp_status, plus_one`) names a `character_id`, not a `profile_id` or `SocialProfile` reference at
all — and per §2, no code path in this repository was found to ever populate it with real data to
check. Whether a `character_id` there would mean a Character Registry row (`RegistryCharacter`, a
different model from `SocialProfile`) or something else is not established by any writer, because
there effectively isn't one.

---

## 5. Default guest counts, and can Evoni edit them today?

| Creation path | Default count | Selection logic |
|---|---|---|
| From-profile (`worldEvents.js:2295`) | 6 (explicit override) | `assembleGuestList` — direct relationships first, then category/archetype/tier-diversity scoring |
| Calendar-driven, via `auto-spawn` (`calendarRoutes.js:637`) | 8 unless the caller overrides; WorldAdmin's Auto-Fill button sends 6 | Same `assembleGuestList` |
| Opportunity pipeline (`feedEventPipelineService.js:379`) | 6 (hardcoded `LIMIT 6`) | Own raw SQL: `lala_relevance_score >= 3`, random order — no relationship or diversity weighting |
| Momentum-chain follow-up (`feedEventPipelineService.js:607,646`) | Whatever the parent had, capped to 6 | Inherited, not selected |

**Editing today: no path found.** No add/remove/reorder control exists anywhere in
`frontend/src/` — the Event Package's Guests list (§3) is a plain `<ul>`; the Events-queue
Edit-details modal's guest section (§3) is plain `<span>` chips; the Episode Todo page's is the same.
No dedicated guest-management endpoint exists in `src/routes/` (`grep`'d for
`add`/`remove`/`Guest`/`Picker` patterns across both trees — the only hits were the migration, a
prompt-instruction string, and the reads already listed above). Guests are entirely
auto-assembled once at event-creation time by whichever of the four paths in §3 created the event, and
displayed read-only from then on, everywhere this document found them shown.

---

## 6. Where the two stores — and their own writers — disagree in code

- **The two columns disagree by construction, not by accident.** `guest_list` is explicitly discarded
  at creation (§2) while `guest_profiles` is populated by every creation path (§3) — so if both are
  ever non-empty on the same row, `guest_list` most likely got there through the PUT route's
  untyped pass-through (§2), a completely separate write from whatever populated `guest_profiles` at
  creation. Nothing keeps them in sync; nothing was designed to.
- **`guest_profiles` disagrees with itself, key-to-key.** Two implementations (`assembleGuestList`,
  used by writers 1 and 2 in §3) key each guest as `profile_id`; a third, independent implementation
  (the opportunity pipeline, writer 3) keys the same concept as `id`. Every downstream reader that
  needs the link — `characterSyncService.js:154`, `storyGenerationService.js:89`,
  `episodeScriptWriterService.js:221`, `feedActivityService.js:81` — reads `.profile_id` specifically,
  so every guest written via the opportunity pipeline (and any momentum-chain event descended from
  one, since writer 4 just inherits) silently drops out of relationship-sync, Character Registry
  depth, and gets a broken `profile_id: undefined` on its simulated feed post — with no error, no log
  line calling it out, just an absent key that `.filter(Boolean)` or `if (!guest.profile_id) continue`
  quietly steps over.
- **Readers that use only `display_name`/`handle`** (the Event Package list, the invitation prose, the
  Events-queue Edit-details modal, feed-moment text, the social checklist) are unaffected by the
  `id`/`profile_id` mismatch — they never look for the link, only the name.

---

## 7. What a production count would answer, and the SQL to run it

**What it would answer:** how many events actually have a non-empty `guest_list` at all (§2's read
suggests it should be close to zero, but that's an inference from the writers, not a count); how many
have a non-empty `guest_profiles`; how many have both non-empty (which would only happen via the PUT
route's `guest_list` path landing on an event `assembleGuestList` or the opportunity pipeline also
populated); and how many disagree in guest **count** between the two — a simple, robust proxy, since
comparing exact membership is complicated by §6's `id`/`profile_id` key mismatch.

**Read-only SQL for Evoni to run — not run by this document:**

```sql
-- 1. Fill counts for each store
SELECT
  COUNT(*) AS total_events,
  COUNT(*) FILTER (
    WHERE jsonb_array_length(COALESCE(guest_list, '[]'::jsonb)) > 0
  ) AS guest_list_filled,
  COUNT(*) FILTER (
    WHERE jsonb_array_length(COALESCE(canon_consequences -> 'automation' -> 'guest_profiles', '[]'::jsonb)) > 0
  ) AS guest_profiles_filled,
  COUNT(*) FILTER (
    WHERE jsonb_array_length(COALESCE(guest_list, '[]'::jsonb)) > 0
      AND jsonb_array_length(COALESCE(canon_consequences -> 'automation' -> 'guest_profiles', '[]'::jsonb)) > 0
  ) AS both_filled,
  COUNT(*) FILTER (
    WHERE jsonb_array_length(COALESCE(guest_list, '[]'::jsonb)) = 0
      AND jsonb_array_length(COALESCE(canon_consequences -> 'automation' -> 'guest_profiles', '[]'::jsonb)) = 0
  ) AS neither_filled
FROM world_events
WHERE deleted_at IS NULL;

-- 2. How many disagree, by guest COUNT (not exact membership — see §6)
SELECT COUNT(*) AS guest_count_disagrees
FROM world_events
WHERE deleted_at IS NULL
  AND jsonb_array_length(COALESCE(guest_list, '[]'::jsonb))
   != jsonb_array_length(COALESCE(canon_consequences -> 'automation' -> 'guest_profiles', '[]'::jsonb));

-- 3. A sample of disagreeing rows, for a manual look
SELECT
  id, name, status, created_at,
  jsonb_array_length(COALESCE(guest_list, '[]'::jsonb)) AS guest_list_count,
  jsonb_array_length(COALESCE(canon_consequences -> 'automation' -> 'guest_profiles', '[]'::jsonb)) AS guest_profiles_count
FROM world_events
WHERE deleted_at IS NULL
  AND jsonb_array_length(COALESCE(guest_list, '[]'::jsonb))
   != jsonb_array_length(COALESCE(canon_consequences -> 'automation' -> 'guest_profiles', '[]'::jsonb))
ORDER BY created_at DESC
LIMIT 20;

-- 4. Among guest_profiles entries, how many are missing the profile_id
--    key entirely (the §6 id/profile_id mismatch) — counts guest OBJECTS,
--    not events, across the whole table
SELECT
  COUNT(*) AS total_guest_entries,
  COUNT(*) FILTER (WHERE guest ? 'profile_id') AS has_profile_id,
  COUNT(*) FILTER (WHERE NOT (guest ? 'profile_id')) AS missing_profile_id
FROM world_events,
     jsonb_array_elements(COALESCE(canon_consequences -> 'automation' -> 'guest_profiles', '[]'::jsonb)) AS guest
WHERE deleted_at IS NULL;
```

Not run against any database by this document or this agent session — no host, AWS, database, or
Cognito contact was made.

---

## 8. Options for Evoni — not a recommendation

These are presented as options, in no particular order; this document does not rank them.

**(a) `guest_profiles` becomes the sole authority; `guest_list` is retired.** §2's read already shows
`guest_list` is functionally unused by every path but the PUT route's untyped pass-through, and §7's
SQL would confirm whether any real row disagrees. Retiring it would mean: dropping it from the PUT
route's `allowedFields`, and (separately, a schema decision) eventually removing the column via a new
migration — neither done by this document.

**(b) `guest_list` becomes the authority, on its originally-intended shape.** The migration's own
comment (`{ character_id, character_name, rsvp_status, plus_one }`) describes a genuinely different
model than `guest_profiles` — RSVP status and a plus-one, tied to Character Registry rows rather than
Social Profiles. Making this the real store would mean building the creation-time writer it currently
lacks (§2), deciding whether `character_id` should in fact be a `profile_id` (§4), and migrating every
consumer in §3's table off `guest_profiles`.

**(c) Keep both, but define which wins when they disagree — the same question §4's guest problem and
§8(p)'s host-two-homes problem in `docs/EVENT_EPISODE_FLOW.md` both left open for their own fields.**
Cheaper than (a) or (b), but leaves the `id`/`profile_id` mismatch (§6) unresolved, and leaves every
future reader needing to know which of two shapes it might see.

**(d) A featured-guests field, on top of whichever store wins.** §5 found no path that distinguishes
"invited" from "the story actually used this guest" — every `guest_profiles` entry is presented the
same. If §8(p)'s FEATURED ATTENDEES role (three to five Feed creators the story uses) is meant to be a
narrower, curated subset rather than the full assembled list, it may need a field neither store has
today — e.g. a per-guest story reason, or a boolean/rank marking which of the assembled guests are
"featured" for this particular episode. Whether that's a new key on the winning store's existing guest
objects, or its own separate structure, is not decided here.

---

## 9. What this document does not do

It does not choose an authority, run any query against a database, write a migration, change any
route or component, or resolve the `id`/`profile_id` naming mismatch it found. It mints no FD/XK/PE
number and rules nothing.
