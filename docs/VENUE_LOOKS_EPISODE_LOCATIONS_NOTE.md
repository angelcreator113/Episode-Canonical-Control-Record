# Venue looks and episode locations: design note

Evoni's rulings L1–L6 (2026-10-02) are recorded verbatim in
`docs/EVENT_EPISODE_FLOW.md` §8(hh). This note reads today's code against
them and asks what the build needs settled. **Nothing is built yet.** Code
is cited by function or component name; read at `origin/main` `a63eb7b8`.

## 1. What exists today

**The event's look.** No single field holds how a venue is dressed for an
event.
- The Scene Brief's event layer (`sceneBriefService.buildSceneBrief`,
  event from `loadBriefEvent`) writes four lines, all labelled "From
  event":
  - `concept` "Event": "Dressed for <name>, themed "<theme>"", plus the
    first sentence of `description`;
  - `setup`: from `format`;
  - `decor_colours`: the first four `color_palette` entries, "only in décor
    and props, never on the building";
  - `mood`.
- The event also gives the environment its `time` (from `event_time`) and
  `season` (from `event_date`).
- `theme`, `mood` and `color_palette` have no editor in the Event Package
  or the event editor.
- `canon_consequences.automation.venue_theme` has no editor either. Only
  the opportunity pipeline (`generateUniqueVenue`, an AI sentence) and the
  WorldAdmin templates write it. It reaches scene images only as a venue
  set's description fallback (`venueDraftSet`).
- `location_hint` is edited in WorldAdmin and read by the scene planner,
  not shown in the Event Package.
- Lighting comes only from the place's style guide and the time-of-day
  text.
- With an approved base at the venue, the brief switches to
  `event_dressing`: an edit of that base with the event lines only (S6).
- The brief's rules already forbid people ("an empty space with no
  people…"), and the shot layer adds "Space for characters" (L1's last
  sentence holds today).

**The Place section** (`EventPackagePage`):
- **Venue picker:** text rows with a search box (name or city), and
  "Create New Location".
- **Scene-set picker:** `orderSceneSetsForEvent`, with the venue's own sets
  first.
  - Each row is text only: name, type, and "no image yet".
  - There are no thumbnails, no search box and no angle preview.
- **"Create a scene set for <venue>":** creates an EVENT_LOCATION set at the
  venue, selects it, and opens its base brief (S7). Evoni never leaves the
  page, so the "stays inside, returns selected" half of L2 holds today.
- The WorldAdmin event editor's set grid has thumbnails but no search.

**Home and closet.** No show stores a home or closet set.
- At Start Episode, `createScenePlanRows` takes the home set with
  `SELECT … WHERE scene_type = 'HOME_BASE' … LIMIT 1`. The query has no
  show filter and no order, so it can take another show's home.
- No closet set is ever picked.
- `shows.metadata.lala_home` holds an address for travel costs only
  (`utils/lalaHome`).

**Start Episode and the episode's sets.**
- `generateEpisodeFromEvent` writes 14 `scene_plans` rows:
  - beats 1–9 and 13–14 get the home set;
  - beats 10–12 get the event's set.
- It links `[event set, home set]` in `scene_set_episodes` with `sort_order`
  0 and 1.
- The junction has no role. Any number of sets can be linked
  (`EpisodeScenesTab` "Assign Set"). "Primary" is only `sort_order = 0`.
- There is no locations step.

**Beats** (`constants/canonicalBeats`, `CANONICAL_BEATS`). There are 14
beats, each with a `typical_location`:
- HOME_BASE: 1–6, 13–14;
- TRANSITION: 7, 9, 10;
- CLOSET: 8;
- EVENT_LOCATION: 11–12.

Start Episode assigns sets by phase, not by `typical_location`. So beat 8
(Transformation Loop) gets the home set, and beat 10 (Event Travel) gets the
venue set. No beat is called "arrival": beat 10 is the nearest.

**Scene planning.**
- `scenePlannerService.generateScenePlan` (an AI call, from
  `POST /episode-brief/:id/generate-plan`) uses every show set whose
  generation is complete, listing only complete angles that have images.
- It deletes the episode's plan rows, locked ones included, and recreates
  them.
- `ScenePlannerPage` shows each beat's set image or "No scene assigned".
  Its Edit buttons do nothing.
- `PUT …/beat/:n/scene-set` (in `sceneStudioEpisodeRoutes`) picks the
  angle whose `beat_affinity` includes the beat. No frontend calls it.

**Angles** (`SceneAngle`):
- `angle_label` is free text; `VALID_ANGLE_LABELS` (WIDE, ESTABLISHING,
  DOORWAY, CLOSET, VANITY…) is enforced only by `suggest-angles`.
- `beat_affinity` is a list of beat numbers. suggest-angles' prompt asks for
  beats 1–5 while its filter keeps 1–10, which matches neither each other
  nor the 14 beats.
- An angle can be uploaded (`POST /scene-sets/:id/angles/:angleId/upload`)
  or generated (`…/generate`, from its brief).

**Readiness.** Nothing blocks on a missing image.
- `EpisodeProductionChecklist`'s "Venue image generated" checks only that
  the event has a set, not an image.
- The Event Package's `place.scene_set` is a warning, not a gate.

## 2. What the rulings need that the code lacks

- **L1:** an Event Venue Look on the event, with:
  - seven parts, including reference images;
  - a "Draft from event details" (an AI call, Haiku, budget-gated);
  - Auto-drafted and Edited labels;
  - lines in the brief's event layer, replacing or joining
    concept/décor/mood.
- **L2:** thumbnails, search and an angle preview in the Place picker.
- **L3:**
  - show defaults for home and closet;
  - an Episode Locations step at Start Episode;
  - "create a set there and return to the step".
- **L4:** the planner mapping beats to each location's angles by kind, and
  a per-beat "<angle> missing: Upload image / Generate angle" action.
- **L5:** readiness flags for missing images (the checklist item counts a
  set, not an image).
- **L6:** a role on each of the episode's sets, chosen in the step and
  editable while the episode is a draft.

## 3. Questions for Evoni

1. **Where the look lives.** Is the look a new JSON column on
   `world_events` (`venue_look`), one per event? Or a separate table, so it
   can carry history and reference images? (Recommended: a JSON column,
   with images stored as asset IDs.)
2. **Its parts as fields.** Should the seven parts be named fields (overall
   look, décor and colours, lighting and time, event areas, signage, must
   include, must avoid)? Is "must include/avoid" two fields?
3. **Existing fields.** `theme`, `mood` and `color_palette` already feed the
   brief, and `venue_theme` and `location_hint` describe the venue. Does the
   look replace them in the brief, keeping the old fields only as the
   draft's inputs? Or do they stay as separate lines?
4. **Lighting and time.** The brief's `time` line comes from `event_time`
   today. Does the look's "lighting and time" replace it, or add to it?
5. **Event areas.** Are these named spaces within the venue (bar, runway,
   VIP)? Should each become a suggested angle for the venue's set (see
   L4)?
6. **Reference images.** Are they sent to image generation (as Flux
   Kontext references), or only shown to Evoni? How many per event?
7. **Draft inputs.** L1 names host, description, activity and dress code.
   Should the venue's own description and style guide, and the event's
   prestige, also go in? Or should the look stay strictly about dressing
   the place for this occasion?
8. **Redraft.** As with intentions, should an Edited look be replaced only
   after a confirm? Should drafting be per part, keeping parts Evoni edited
   (like A9's purposes)?
9. **Locking.** Does the look lock with the terms at Start Episode, or stay
   editable while the episode is a draft (as A9 does for intentions)?
10. **Where Evoni edits it.** Is that the Event Package's Place section,
    under the venue and scene set? Is it also shown, read-only, in the
    Episode Locations step?
11. **Picker preview (L2).** Should the angle preview be a strip of the
    set's angle thumbnails inside the picker row, or a side panel for the
    highlighted set? Should search cover only names, or also the venue and
    type?
12. **Show defaults (L3).** Do home and closet live in `shows.metadata` or
    in their own columns? Are they set in Show settings, or by "Make
    default" on a set in Scene Sets? With no default, should the step ask
    rather than pick (the current `LIMIT 1` picks blindly across shows)?
13. **The step's place in Start Episode.** Should it be a screen between
    the event's readiness and the start, so nothing is created until it's
    confirmed? Or should Start Episode create the episode, then open the
    step on it?
14. **"Creating a new set there".** Does that open the base brief (S2/S3)
    with this event, and pay for the image there? Or only create the set
    and return, leaving images for later (L5)?
15. **Roles (L6).** Is the role list fixed (home, closet, event, extra) with
    a free name for extras ("car", "café")? Can an episode have two event
    sets, or two extras of the same kind?
16. **Changing a set while the episode is a draft (L6).** Should the beats
    planned on the old set move to the new one by role? Should locked plan
    rows stay?
17. **Beat-to-angle mapping (L4).** Should the beats' `typical_location`
    become the role (HOME_BASE→home, CLOSET→closet, EVENT_LOCATION→event)?
    How is TRANSITION (beats 7, 9, 10) mapped: the event's exterior or
    entrance, an extra "car", or home? Is "arrival" beat 10 (Event Travel)?
18. **Angle kinds.** L4 needs "entrance", "exterior" and "main interior" as
    kinds the planner can ask for. Should these be fixed angle labels
    (ESTABLISHING = exterior, DOORWAY = entrance, WIDE = main interior), or
    a new `angle_kind` field beside the free label?
19. **The missing-angle action (L4).** Does "Generate angle" create the
    angle record and open its brief, then generate? Does "Upload image"
    create it from the file? Where does it show: on the beat in the
    planner, in the Episode Locations step, or both?
20. **The planner's rewrite.** `generateScenePlan` deletes locked rows
    today. Should it keep locked rows and plan only the rest? (Recommended,
    and it needs fixing for L6's "change while draft" anyway.)
21. **Readiness (L5).** What counts as ready: every planned beat has an
    angle with an image? Where is it flagged: the production checklist, the
    Overview, the planner? It never blocks.
22. **Order of work.** Proposed: (a) L3/L6 roles and defaults with the
    step, which also fixes the cross-show home pick; (b) L1 the look and
    its brief lines; (c) L2 the picker; (d) L4 the planner mapping and
    missing-angle actions; (e) L5 readiness. Is that the order Evoni wants,
    or should the look (L1) come first?

## 4. Found while reading (not asked; for the record)

- **The home set is chosen across shows.** `createScenePlanRows`'
  `HOME_BASE … LIMIT 1` has no show filter and no order. L3 replaces it,
  but until then a show can be given another show's home.
- **The planner deletes locked rows** (`generateScenePlan`), and
  `ScenePlannerPage`'s Edit buttons have no handler.
- **The production checklist's "Venue image generated"** is true whenever
  the event has a set, with or without an image.
- **suggest-angles' beat numbers** (1–5 in the prompt, 1–10 in the filter)
  match neither each other nor the 14 beats.
