# Venues: the everyday look, event looks, time, season and character homes

Evoni, 2026-10-15: "Each venue needs its everyday look and then its event look. I need to be able to upload the everyday scene set to the character, also the time of day and seasons." Her answers the same day: "upload to the character" means linking a venue to a character as their home; time of day affects every view, season only exterior views.

This is the plan, in the order it ships. Each step is its own PR; steps that add tables or columns deploy through the Deploy workflow after Evoni approves the migration.

## What exists (before step 1)

- **Venue:** a World Location (`world_locations`).
- **Everyday look:** the location's approved base (`world_locations.approved_base_image_url`, set by `approveBase` in `approvedBaseService`; the "Approve" control is `ApprovedBaseRow` in `SceneSetsTab`). One image, undressed. It can be uploaded (`POST /scene-sets/:id/upload-base`) and then approved.
- **Event look:** one row per scene set and event in `scene_set_looks`, made by `startLook` in `venueLookImageService` as a Flux Kontext edit of the approved base. The base is never touched.
- **Time and season:** one `time_of_day` and one `season` per scene set, read by `buildSceneBrief`. `POST /scene-sets/:id/time-variants` and `/season-variants` only add blank WIDE angles named "Morning", "Winter" and so on.
- **Homes:** show-level only (`shows.metadata.scene_defaults.home_set_id`, read by `episodeLocationsService`). Characters (`registry_characters`) have no link to places.

## 1. Everyday look, and uploadable event looks (this PR)

- The approved base is shown as **"Everyday look"** wherever the pages name it (`ApprovedBaseRow`, the Looks row, `EventLookImage`, `SceneBriefConfirm`). Behaviour is unchanged.
- **Upload this look:** beside "Generate this look" (`EventLookImage`), an image of Evoni's own becomes the event's look. Route: `POST /world/:showId/events/:eventId/look/upload` (`uploadLook` in `venueLookImageService`). The set is chosen as for generating: the event's own, else the venue's only set, else she picks one (`CHOOSE_SET`), else one is made. The everyday look is not needed and not touched.
- `scene_set_looks.source` records `generated` or `uploaded`; generating again sets it back to `generated`.

## 2. Time and season variants of the everyday look

- Per venue: five time-of-day images (morning, afternoon, golden hour, evening, night) for every view, and four season images (spring, summer, fall, winter) for exterior views only (the Front zone and outside shots).
- Each is uploaded, or generated as a Kontext re-light of the everyday look so the place itself stays the same. The cost shows first, as for all generation.
- A new table holds them (location, kind time or season, value, image, source, cost, `deleted_at`). The blank "Morning"/"Winter" WIDE angles are retired.

## 3. Character homes

- A character links to their places: home, closet, and optional extras (work, hangout). A new table links `registry_characters` to `world_locations` with a role.
- When an episode needs "home", the character's own home comes first, then the show default.
- Open question for Evoni: whose home an episode needs. Either the show names a lead character (Lala for *Styling Adventures*), or each episode names its main character.

## 4. The right picture, automatically

- The episode's event already gives a date and time. The planner uses the matching time variant, plus the season image for an exterior shot.
- A missing variant falls back to the everyday look and is flagged ("Lala's home has no evening variant"), as missing angles are today.
