# F-Stats-1 Phase B — Reads Slice, `calendarRoutes.js`, Amendment 1: the `sourceLine` path

**Amends:** `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md` (filed by
#2039, Task #2038). That document is not edited. This amendment sits beside
it and is read with it.

**Owed by:** `F-Stats-1_Fix_Plan_v1.61.md` §64.4 ("An additive amendment to
the calendarRoutes.js slice is owed for the sourceLine path it did not
check", Evoni's ruling, §64.1). Identified by
`F-Stats-1_ReadsSurvey_Options_2026-09-27.md` §4. The path itself was traced
earlier by `F-Stats-1_Fix_Plan_v1.60.md` §63.3 ("`StoryCalendarEvent` has
three parents and exactly one path"; "`StorytellerLine` at 2 joins").

**Naming:** the register's convention for amending a single filed note, the
note's own name with `_Amd1` before the date, as
`F-AUTH-1_AIValueInSQL_TierFeatures_Read_Amd1_MEASURED_2026-09-23.md` amends
`F-AUTH-1_AIValueInSQL_TierFeatures_Read_MEASURED_2026-09-23.md`.

**Basis:** two SHAs.

- **the amended slice's basis:** `98dd2e3a` (as the slice states);
- **this amendment's own basis:** `origin/main` below.

**Standing:** MEASURED unless marked INFERRED or ATTESTED. Rules nothing.

Task: #2062. No host, AWS, database, or Cognito contact.

---

## H1 — Basis

```
$ git rev-parse origin/main
70331bac8ba24bc573a1f7a81aa6da75da1aa624
```

Nothing the slice read has changed between its basis and this one:

```
$ git diff --stat 98dd2e3a 70331bac -- src/routes/calendarRoutes.js src/models/StoryCalendarEvent.js src/models/StorytellerLine.js src/models/StorytellerChapter.js src/models/StorytellerBook.js src/models/CalendarEventAttendee.js src/models/CalendarEventRipple.js; echo "exit=$?"
exit=0
```

(No output, exit 0: the files are identical.) So every `calendarRoutes.js:N`
the slice cites is the same line here, and is cited as the slice cites it.

## §1. The path, link by link — MEASURED

**Event → line.** `StoryCalendarEvent` `belongsTo` `StorytellerLine` on
`source_line_id`, as `sourceLine`; the key is **nullable**:

```
$ git show 70331bac:src/models/StoryCalendarEvent.js | grep -n -E "belongsTo\(models.StorytellerLine|foreignKey: 'source_line_id'|as: 'sourceLine'"
18:      StoryCalendarEvent.belongsTo(models.StorytellerLine, {
19:        foreignKey: 'source_line_id',
20:        as: 'sourceLine',
$ git show 70331bac:src/models/StoryCalendarEvent.js | sed -n 98,101p
    source_line_id: {
      type:      DataTypes.UUID,
      allowNull: true,
    },
```

**Line → chapter.** `belongsTo` `StorytellerChapter` on `chapter_id`, not null:

```
$ git show 70331bac:src/models/StorytellerLine.js | grep -n "belongsTo(models.StorytellerChapter"
68:    StorytellerLine.belongsTo(models.StorytellerChapter, { foreignKey: 'chapter_id', as: 'chapter' });
$ git show 70331bac:src/models/StorytellerLine.js | sed -n 11,14p
    chapter_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
```

**Chapter → book.** `belongsTo` `StorytellerBook` on `book_id`, not null:

```
$ git show 70331bac:src/models/StorytellerChapter.js | grep -n "belongsTo(models.StorytellerBook"
132:    StorytellerChapter.belongsTo(models.StorytellerBook, { foreignKey: 'book_id', as: 'book' });
$ git show 70331bac:src/models/StorytellerChapter.js | sed -n 11,14p
    book_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
```

**Book → show.** `show_id`, and `belongsTo` `Show`; the column is nullable:

```
$ git show 70331bac:src/models/StorytellerBook.js | sed -n 11,14p
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
$ git show 70331bac:src/models/StorytellerBook.js | grep -n "belongsTo(models.Show"
143:    StorytellerBook.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
```

| Link | Key | Nullable | Citation |
| --- | --- | --- | --- |
| event → line | `source_line_id` | **yes** | `StoryCalendarEvent.js:18–21`, `:98–101` |
| line → chapter | `chapter_id` | no | `StorytellerLine.js:68`, `:11–14` |
| chapter → book | `book_id` | no | `StorytellerChapter.js:132`, `:11–14` |
| book → show | `show_id` | yes | `StorytellerBook.js:143`, `:11–14` |

**Which events have the path:** those with a `source_line_id`. From the line
onward every key is required except the book's own `show_id`, which the
slice's test already treats as a show wherever a table carries it (the
memories/core.js and upgradeRoutes.js slices count `storyteller_books` as
carrying a show on the same column).

**Two tables reach events by `event_id`**, so the path extends to them:

```
$ git show 70331bac:src/models/CalendarEventAttendee.js | sed -n 6,8p
      CalendarEventAttendee.belongsTo(models.StoryCalendarEvent, {
        foreignKey: 'event_id',
        as: 'event',
$ git show 70331bac:src/models/CalendarEventRipple.js | sed -n 6,8p
      CalendarEventRipple.belongsTo(models.StoryCalendarEvent, {
        foreignKey: 'event_id',
        as: 'event',
```

## §2. The slice's test, applied unchanged — MEASURED

The slice's §0.2 applies "does the table carry a show, directly or through a
parent in code" **per table**. Where a table's parent is reached by a nullable
key, the slice records the per-table result in this form (its §0.2 table):

```
$ grep -n -E "^\| .calendar_event_(attendees|ripples)." docs/audit/F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md
136:| `calendar_event_attendees` | `CalendarEventAttendee.js:22` (`event_id`), `:26` (`character_id`, nullable), `:30` (`feed_profile_id`), `:57` | Not through `event_id`. Through `character_id` → `registry_characters.registry_id` (`RegistryCharacter.js:26`) → `character_registries.show_id` (`CharacterRegistry.js:18`, nullable) | **Met for rows with a `character_id`**; not for feed-profile-only rows |
137:| `calendar_event_ripples` | `CalendarEventRipple.js:22` (`event_id`), `:26` (`affected_character_id`, nullable), `:60` | As attendees, through `affected_character_id` | **Met for rows with an `affected_character_id`** |
```

and for `story_calendar_events` it recorded:

```
$ grep -n -E "^\| .story_calendar_events." docs/audit/F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md
135:| `story_calendar_events` | `StoryCalendarEvent.js:106` (`series_id`), `:134` | No `show_id`; `series_id` has no parent | **Not met** |
```

**Re-applied with the `sourceLine` parent**, in the slice's own form:

| Table | Carries a show? | Condition 2, as filed | Condition 2, re-applied |
| --- | --- | --- | --- |
| `story_calendar_events` | Through `source_line_id` → line → chapter → book (§1). `series_id` still has no parent, as the slice found | Not met | **Met for events with a `source_line_id`** |
| `calendar_event_attendees` | As filed through `character_id`; **also** through `event_id` for attendees of an event with a `source_line_id` | Met for rows with a `character_id` | **Met for rows with a `character_id`, or whose event has a `source_line_id`** |
| `calendar_event_ripples` | As filed through `affected_character_id`; **also** through `event_id` likewise | Met for rows with an `affected_character_id` | **Met for rows with an `affected_character_id`, or whose event has a `source_line_id`** |
| `story_clock_markers` | Unchanged: no `show_id`, no `belongsTo` (v1.60 §63.3) | Not met | Not met |

This is the slice's own per-table form, "Met for rows with …", used for the
nullable key it did check. **No per-row variant is introduced**: the form is
the slice's.

## §3. The rows, re-read

Every row of the slice's §3 that reads `story_calendar_events`, or whose
condition 2 depended on it. Columns: the slice's classification as filed; the
test re-applied (§2); the reason. The rest of each row (site, handler, id
source, scope, what it returns, auth) is the slice's, unchanged.

| # | Site | As filed | Re-applied | Reason |
| --- | --- | --- | --- | --- |
| 3 | `:171` `GET /events` | Not an instance — condition 2 | **Instance** — when the caller supplies `series_id` or `story_position`, for events with a `source_line_id` | Condition 2 is now met for sourced events. **Condition 1, which the slice did not need to decide:** `series_id` and `story_position` are identifiers the caller supplies (`calendarRoutes.js:161`, `:163`), and when supplied they choose the rows. When no identifier is supplied every event is returned, the shape the slice's #12 classifies as condition 1 not met. The response carries each event's stored fields (`:171–176`) |
| 4 | `:232` `PUT /events/:id` | Not an instance — condition 2 | **Instance** — for an event with a `source_line_id` | Caller-supplied id; condition 2 now met; returns the event after the update, with fields the caller did not send (`:234–235`) |
| 5 | `:246` `DELETE /events/:id` | Not an instance — gates the delete; condition 2 also fails | **Not an instance** — gates the delete | Unchanged classification; only the secondary reason falls away (condition 2 is met for sourced events). Note: existence |
| 7 | `:283` `POST /events/:id/attendees` | Not an instance — gates the insert; condition 2 also fails | **Not an instance** — gates the insert | As #5. Note: existence |
| 9 | `:331` `POST /events/:id/ripples/generate` | Not an instance — condition 2 | **Instance** — for an event with a `source_line_id` | Condition 2 now met; the row's `title`, `what_world_knows` and `what_only_we_know` go into the prompt and the returned threads are model output from it (`:362–365`), as for the slice's #10 (that the output reflects them is INFERRED: model output) |
| 12 | `:433` `GET /simultaneous` | Not an instance — condition 1 | **Not an instance** — condition 1 | Unchanged: a time window, not an identifier. Its "unfiltered" note stands |
| 13 | `:511` `POST /events/:id/spawn-world-event` | Not an instance — condition 2 | **Instance** — for an event with a `source_line_id` | Condition 2 now met for the event (`world_locations` still carries none); the response carries `calendar_event_title` and a world event copied from the row (`:548–568`, `:575`) |
| 16 | `:646` `POST /events/:id/auto-spawn` | Not an instance — condition 2 | **Instance** — for an event with a `source_line_id` | Condition 2 now met; the response carries `source.title` and events built from the row (`:689`, `:700`) |
| R1 | `:723` → `seasonalEventService.js:73` | Not an instance — conditions 1 and 2 | **Not an instance** — condition 1 | Unchanged classification: a month window, not an identifier. Condition 2 is now met for sourced events, so only condition 1 decides it |
| 6, 8 | attendees | Instance — for attendee rows with a `character_id` | **Instance** — for attendee rows with a `character_id`, or whose event has a `source_line_id` | Classification unchanged; its reach widens with §2's attendee row |
| 10, 11 | ripples | Instance — for rows with a character / `affected_character_id` | **Instance** — as filed, or for ripples whose event has a `source_line_id` | Classification unchanged; reach widens as for #6, #8 |

**Rows left untouched:** #1 and #2 (`story_clock_markers`, still no show),
#14 and #15 (`world_events`, carrying `show_id` directly), and R2 (condition
1 and its helper tables). None reads `story_calendar_events` for its
classification. #3's include of the marker changes nothing.

## §4. Totals

**The slice as filed** (its §5):

```
$ grep -n -E "^\| \*\*(Instances|Not instances|Cannot tell)\*\*" docs/audit/F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md
579:| **Instances** | **6** — #6, 8, 10, 11, 14, 15 | 0 | **6** |
580:| **Not instances** | **10** — #1, 2, 3, 4, 5, 7, 9, 12, 13, 16 | **2** — R1, R2 | **12** |
581:| **Cannot tell** | 0 | 0 | **0** |
```

**As amended:**

| | Probe sites (16) | Found by reading (2) | All (18) |
| --- | --- | --- | --- |
| **Instances** | **11** — #3, 4, 6, 8, 9, 10, 11, 13, 14, 15, 16 | 0 | **11** |
| **Not instances** | **5** — #1, 2, 5, 7, 12 | **2** — R1, R2 | **7** |
| **Cannot tell** | 0 | 0 | **0** |

Five rows move from not-instance to instance: #3, #4, #9, #13, #16.

**The survey, as arithmetic only.** v1.61 §64.2 records 36 instances across
the five slices, of which the calendar slice's 6. Amended: 36 − 6 + 11 =
**41**.

**v1.61's ruling text is unchanged** ("closes on the five filed reads slices
(36 instances)"). Whether the amended count affects it is for Evoni. The
pattern the ruling names, that nothing on the request path supplies a tenant
and shows have no owner, is not altered by a change in the count: every
re-classification here follows from condition 2, and condition 3 was already
met at every site (the slice's §0.1).

## §5. Carried — ATTESTED

From `F-Stats-1_Fix_Plan_v1.61.md` §64.3: `story_calendar_events` held **0
rows** in production on 2026-09-27 (Evoni's own read-only query, quoted
there). **This changes no classification.** The slices classify code, not
data: the five instances added here are reads the code performs on any event
with a `source_line_id`, whether or not one exists today.

## What this document does not do

- **Edits no filed document.** The calendar slice and v1.61 are unchanged.
- **Rules nothing.** Whether 41 replaces 36 anywhere is Evoni's. Mints no FD,
  XK or PE.
- Re-reads only the rows in §3; every other row of the slice stands as filed.
- Introduces no per-row test: §2 uses the slice's own per-table form.
- Changes no code.
- No live database contact. No prod-box or dev-box contact. No AWS, Cognito or
  GitHub-settings contact.

## Footer

**Type:** amendment to a filed note (Amendment 1). **Rules:** nothing.
**Mints:** nothing — no FD, no XK, no PE. **Host/AWS/DB contact:** none by
this session. Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md`
§1); agent sessions still never touch hosts, AWS, RDS or Cognito
(`CLAUDE.md`).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `70331bac8ba24bc573a1f7a81aa6da75da1aa624`.*
*Authority: `F-Stats-1_Fix_Plan_v1.61.md` §64.1, §64.4; `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md`
(the test, §0.2, applied unchanged); `F-Stats-1_ReadsSlice_episodes_2026-09-27.md`
("The rule", "Adapted for reads"). Task: #2062.*
