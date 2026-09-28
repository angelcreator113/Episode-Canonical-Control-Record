# Character Registry — a read, not a ruling

## Status of this document

**Read-only research for the C1–C8 build** (the Character Registry rulings, Task #2190).
This document recommends nothing and rules nothing. It changes no code, runs no query, and
writes no migration. No database was queried and no host, AWS, database or Cognito contact
was made.

Every claim carries one of two standings:
- **MEASURED**: read from this repository, with a file:line. Schema facts about production cite
  the filed canon capture, `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`
  (cited below as *canon capture*), which lists columns and types only.
- **CANNOT-TELL**: the repository does not settle it. §7 gives read-only SELECTs for Evoni.

Basis for the file:line citations: `origin/main` at
`11ebb5d412367aae74180c1da7db60cb5e1efc35` (2026-09-28, #2188). Line numbers drift. Each
citation is paired with a route, function or component name, which outlasts them.

---

## 1. `registry_characters`: columns, soft delete, status and role fields

### 1.1 Columns: model vs migrations vs canon — MEASURED

- **Model:** `RegistryCharacter` (`src/models/RegistryCharacter.js:20`) declares 201 columns,
  counting the paranoid `deleted_at`.
- **Migrations:** `src/migrations/` creates the table at
  `20260220000004-create-character-registry.js:89`. Replaying the live tree statically with
  `scripts/check-schema-agreement.js` (step 2, which connects to no database) gives 201
  columns.
- **Canon capture:** 201 `registry_characters` rows (lines 1178–1378).
- **Names:** all three sets are identical. No column is model-only, migration-only or
  canon-only. The comparison was run in this session over the checker's `--json` report, the
  model's `rawAttributes`, and the capture.
- **Types:** 21 columns are plain strings (`DataTypes.STRING`) in the model and `USER-DEFINED`
  enum types in the canon capture:
  - `de_body_relationship`, `de_money_behavior`, `de_money_origin_class`,
    `de_money_current_class`, `de_class_gap_direction`, `de_time_orientation`,
    `de_world_belief`, `de_blind_spot_category`, `de_change_capacity`, `de_arc_function`,
    `de_operative_cosmology`, `de_joy_threat_response`
  - `current_city`, `class_origin`, `current_class`, `class_mobility_direction`,
    `family_structure`, `sibling_position`, `relationship_status`, `platform_primary`,
    `follower_tier`

  All within canon capture lines 1178–1378. Every other column's type family agrees.
- **Written but undeclared:** step 1 of the same checker flags writes to undeclared
  `registry_characters` names:
  - `world_exists` (`characterGenerationRoutes.js:81`, `:293`)
  - `sexuality` (`characterRegistry.js:261`; `worldStudio.js:487`, `:1159`, `:1427`, `:1566`,
    `:1711`)
  - `metadata` (`memories/engine.js:4558`; `socialProfileRoutes.js:1699`)
  - `name` (`textureLayerRoutes.js:50`, `:68`)

  These are already in `scripts/schema-agreement.baseline`.

### 1.2 Soft delete — MEASURED

- **The model is paranoid:** `paranoid: true` at `RegistryCharacter.js:647`, with
  `underscored`, `timestamps` and `tableName: 'registry_characters'` at `:644–646`.
  `deleted_at` is in the migration (`20260220000004-create-character-registry.js:82`) and the
  canon capture (line 1271).
- **Soft-deleted rows still hold their key:** the unique index on
  `(registry_id, character_key)` (`20260220000004-create-character-registry.js:206`) is not
  partial. A soft-deleted character still holds its key within its registry.
- **`CharacterRegistry` (the parent) is paranoid too:** `src/models/CharacterRegistry.js:46`.

### 1.3 Status, state and role fields — MEASURED

| Field | Values | Model | Migration / enum | Notes |
|---|---|---|---|---|
| `status` | `draft`, `accepted`, `declined`, `finalized` | `RegistryCharacter.js:63–64` | `enum_registry_characters_status`, `20260220000004:25–27`, column `:136` | Validated at `characterRegistry.js:682` (`PUT /characters/:id` ENUMS), `:770` (`POST /characters/bulk-status`), `:882` (`POST /characters/:id/set-status`). `accepted` is written by `characterRegistry.js:926` (`POST /registries/:id/seed-book1`) and `characterGenerationRoutes.js:174` (`POST /confirm`, new character, commented "keep status field populated for backwards compat"). `declined` is written by `worldStudio.js:1300` (below, §4). |
| `role_type` | `protagonist`, `pressure`, `mirror`, `support`, `shadow`, `special` | `:51–52` | `enum_registry_characters_role_type`, `20260220000004:15–17`, column `:123` | UI labels "Protagonist", "Pressure", "Mirror", "Support", "Shadow", "Special" are `ROLE_CONFIG` in `frontend/src/pages/CharacterRegistryPage.jsx:12–19`. No migration adds a value (no `ALTER TYPE … enum_registry_characters_*` in `src/migrations/`). |
| `role_label` | free text | `:55` | | |
| `depth_level` | `sparked`, `breathing`, `active`, `alive` | `:303–304` | `20260312100000-character-generation-redesign.js` (backfilled from `status`, e.g. `finalized → alive` at `:46`) | UI: `DEPTH_CONFIG`, `CharacterRegistryPage.jsx:21–26`. |
| `appearance_mode` | `on_page`, `composite`, `observed`, `invisible`, `brief` | `:59–60` | | |
| `world` | `book-1`, `lalaverse`, `series-2` | `:46–47` | | Characters from *Before Lala* (`book-1`) share the table. |
| `canon_tier` | free text, `STRING(50)` | `:119` | | |
| `is_alive` | boolean, defaulted true | `:157`; default in `applyDefaults` `:659` | | Story life/death, not a registry state. |
| `social_presence` | boolean | `:360` | `20260312100000:200` | Set true with Feed-link writes (§2). |

None of the fields match C5's states: active, side character, retired, archived.

---

## 2. The Feed link: `registry_characters` ↔ `social_profiles`

### 2.1 Columns — MEASURED

| Link | Model | Migration | Canon capture | FK |
|---|---|---|---|---|
| `registry_characters.feed_profile_id` → `social_profiles.id` (integer PK, `SocialProfile.js:27`) | `INTEGER`, `RegistryCharacter.js:364` | `INTEGER` + FK `ON DELETE SET NULL`, `20260312100000-character-generation-redesign.js:207`; re-added if missing (no FK), `20260313100000-fix-registry-character-columns.js:132` | `integer` (line 1290) | FK in the migration; FK name in `docs/audit/FD31-prod-only-schema-20260601.sql:18645` |
| `social_profiles.registry_character_id` → `registry_characters.id` (UUID) | **`UUID`**, `SocialProfile.js:62` | **`INTEGER`**, `20260308500000-create-social-profiles.js:81`, no FK; no later live migration changes it | **`integer`** (line 1867) | none in the migration |

- **Both directions exist.** There are two links with no rule keeping them in agreement.
- **Model vs schema disagree:** `social_profiles.registry_character_id` is UUID in the model
  and INTEGER in the migration and in canon. Registry ids are UUIDs (`RegistryCharacter.js:21`).
- **A migration that never ran:** `migrations/20260314300000-registry-feed-crosslink.js` (root
  `migrations/` tree) would add the column as UUID with an FK. That tree does not run
  (`CLAUDE.md`: `src/migrations/` is the only migration tree that runs).
- **Associations:**
  - `SocialProfile.belongsTo(RegistryCharacter, { foreignKey: 'registry_character_id', as: 'registryCharacter' })`
    at `SocialProfile.js:8–11`.
  - `RegistryCharacter.hasMany(SocialProfile, { foreignKey: 'registry_character_id', as: 'socialProfiles' })`
    at `src/models/index.js:703–706`.
  - `RegistryCharacter.associate` defines only `registry` (`RegistryCharacter.js:664–670`).
- **CANNOT-TELL:** what Postgres does when a UUID is written to, or joined against, the integer
  column. The repository has no captured run of these paths. The query in §7.3 shows whether
  any row holds a value.

**Other keys, none of which is a link id:**
- `social_presence` (§1.3).
- `social_synced_at` and the copied social block (`celebrity_tier` … `rebrand_history`),
  `RegistryCharacter.js:612–628`: one-way copies with no key.
- `the_mask.feed_profile_is_mask`: a boolean.
- `metadata.social_profile_id`: written by `POST /social-profiles/:id/cross`
  (`socialProfileRoutes.js:1699`), but `metadata` is not a declared or canon column (§1.1).

**Indirect link tables:**
- `character_entanglements` (`character_id` UUID → registry, `profile_id` INTEGER → social;
  `CharacterEntanglement.js:6–28`).
- `social_profile_followers` (`social_profile_id` + `character_key`;
  `SocialProfileFollower.js:18–19`).

### 2.2 Writers of either link — MEASURED

| file:line | Route / function | Writes |
|---|---|---|
| `src/services/feedAutoGeneration.js:60` | `autoCreateFeedProfile` (called only from `characterRegistry.js:303`, `POST /registries/:id/characters`, non-blocking) | `social_profiles.registry_character_id = character.id` (a UUID) |
| `src/routes/characterRegistry.js:309` | `POST /registries/:id/characters` | `feed_profile_id = feedProfile.id` |
| `src/routes/characterRegistry.js:837` | `POST /characters/:id/clone` | `feed_profile_id = null` |
| `src/routes/characterGenerationRoutes.js:238–242` | `POST /confirm-feed` | `feed_profile_id`, `social_presence = true`, `depth_level = 'active'` on the character; it does not set the profile's `registry_character_id` |
| `src/routes/socialProfileRoutes.js:1708–1710` | `POST /:id/cross` | `social_profiles.registry_character_id = registryCharacter.id` (a UUID); only when `registry_id` is in the body. `SocialProfileGenerator.jsx:53` (`crossProfileApi`) posts `{}` |
| `src/services/registrySyncService.js:113–114`, `:150–151` | `syncProfileToRegistry` (called from `socialProfileRoutes.js:1738`, `:1794`, `:1841`; `characterRegistry.js:2561` `sync-social`; `:2574` `sync-all-social`) | `feed_profile_id = p.id`, `social_presence = true`, social fields |
| `src/services/registrySync.js:454–456` | `syncFeedProfileFromRegistry` | `SocialProfile.update(… where registry_character_id)`; no caller found |

`feed_profile_id` is on `characterGrowthRoute.js:298`'s never-writable list. The
`PUT /characters/:id` allow-list (`characterRegistry.js:602`) has no link field.

### 2.3 Joins and matches — MEASURED

**By link, backend:**
- Association include `as: 'registryCharacter'`: `feedPostGeneratorService.js:73–78`
  (`generateEpisodeFeedPosts`).
- Raw `LEFT JOIN registry_characters rc ON rc.id = sp.registry_character_id`:
  `episodeScriptWriterService.js:243–253` (`loadScriptContext`) and
  `storyGenerationService.js:103` (`generateEpisodeStory`).
- `where registry_character_id IN (…)`: `storyEvaluationRoutes.js:535–538` and `:1034–1070`
  (`loadSocialFeedContext`).
- `registrySyncService.js:106`, `:178–181`.
- Profile read by `feed_profile_id`: `characterRegistry.js:1188–1189` (`promote-to-canon`) and
  `:2553–2557` (`sync-social`).
- Depth and flags: `has_feed` at `characterGenerationRoutes.js:339`;
  `characterGenerationService.js:462`.
- Events: `worldEvents.js:184`, `:2458` (`from-profile`). `eventAutomationService.js:145`,
  `:156` (`findHostProfile`) and `:717` copy the link to
  `canon_consequences.automation.host_registry_character_id`.

**By link, frontend:**
- `CharacterProfilePage.jsx:784–785` and `components/CharacterProfile.jsx:577–578` fetch the
  profile by `feed_profile_id`. The tab shows at `CharacterProfilePage.jsx:833`, `:888`.
- "Registry" badge: `CharacterProfilePage.jsx:479`.
- `feed/ProfileCard.jsx:38` links to the registry by `registry_character_id`.
- `utils/eventOrganizer.js:112–113`.

**By name or key:**
- `POST /social-profiles/:id/cross` and `/crossing-preview` build `character_key` from the
  lowercased handle (`socialProfileRoutes.js:1687`, `:1973`), with no collision check, and
  set `display_name = profile.display_name || handle`.
- `autoCreateFeedProfile` derives a handle from `selected_name || display_name`
  (`feedAutoGeneration.js:63–66`).
- `financialFeedService.js:56–66` (`resolveLalaProfile`) matches
  `LOWER(creator_name) LIKE '%lala%'`.
- Follows by `character_key`: `memories/assistant.js:1429–1437`, `memories/engine.js:2106–2112`,
  `characterFollowRoutes.js:54–58`, `characterFollowService.js:157–168`,
  `socialProfileRoutes.js:1045–1152`.
- Frontend follower views match `character_key` against hard-coded protagonists:
  `feed/ProfileDetailPanel.jsx:87`, `:130`, `:372`; `FeedViews.jsx:232`, `:244`.
- No frontend site matches profiles to characters by display name, selected name or handle.

---

## 3. What references a registry character id — MEASURED

This is the input for C6's "nothing references the character" check.

**Soft delete skips every FK action.** The model is paranoid (§1.2), so the removals in §4.1
rows 1–3 set `deleted_at` and no `ON DELETE` action runs. FK actions fire only on the two
hard deletes (§4.1 rows 7 and 10).

### 3.1 Columns

| table.column | Model | Migration (FK, onDelete) | Writer (example) | Reader (example) |
|---|---|---|---|---|
| `storyteller_memories.character_id` | `StorytellerMemory.js:22` | `20260221120000-create-storyteller-memories.js:27` (FK, SET NULL) | `memories/engine.js:4316–4412` (`POST /generate-story`) | `memories/core.js:543` (`GET /characters/:charId/memories`) |
| `character_growth_log.character_id` | `CharacterGrowthLog.js:12` | `20260307120000-scene-proposals-and-character-growth.js:176` (FK, CASCADE) | `characterGrowthRoute.js:188`, `:215` | `storyEvaluationRoutes.js:888` (`loadCharacterGrowthContext`) |
| `calendar_event_attendees.character_id` | `CalendarEventAttendee.js:26` | `20260312200000-story-calendar.js:201` (FK, SET NULL) | `calendarRoutes.js:293` | `calendarRoutes.js:264`, `:335` |
| `calendar_event_ripples.affected_character_id` | `CalendarEventRipple.js:26` | `20260312200000-story-calendar.js:259` (FK, SET NULL) | `calendarRoutes.js:385–389` | CANNOT-TELL (no direct query found) |
| `character_crossings.character_id` | `CharacterCrossing.js:26` | `20260312220000-character-crossings.js:26` (FK, CASCADE) | `characterCrossingRoutes.js:57` | `characterCrossingRoutes.js:32–35`; `sceneProposeRoute.js:126` |
| `character_entanglements.character_id` | `CharacterEntanglement.js:22` | `20260312000000-entanglement-layer.js:43` (FK, CASCADE) | `entanglementRoutes.js:102` | `entanglementRoutes.js:56`; `rippleEngine.js:40` |
| `entanglement_unfollows.character_id` | `EntanglementUnfollow.js:22` | `20260312000000-entanglement-layer.js:215` (FK, CASCADE) | `rippleEngine.js:118` | `entanglementRoutes.js:320` |
| `character_relationships.character_id_a` / `_b` | `CharacterRelationship.js:11`, `:16` | `20260223100000-create-character-relationships.js:18`, `:24` (FK, CASCADE) | `relationships.js:286`; `worldStudio.js:675` (`seedInterCharacterRelationships`) | `relationships.js:45–81`; `sceneEligibilityService.js:110` |
| `universe_characters.registry_character_id` | `UniverseCharacter.js:22` | `20260222200000-create-universe-characters.js:23` (FK, SET NULL) | `characterRegistry.js:1176–1178` (`promote-to-canon`) | same route, `:1168` |
| `book_series.protagonist_id` | `BookSeries.js:31` | `20260222400000-add-career-echo-fields.js:44` (FK, SET NULL) | none found | none found |
| `storyteller_chapters.primary_character_id` | `StorytellerChapter.js:31` | `20260222000001-add-chapter-context-fields.js:19` (FK, SET NULL) | `storyteller.js:356` (`PUT /chapters/:id`) | generic chapter GET |
| `world_characters.registry_character_id` | `WorldCharacter.js:22` | created without an FK, `20260302200000-create-world-characters-intimate-scenes.js:41`; the FK version at `20260302210000-add-world-registry-cross-links.js:13–20` runs only if the column is absent | `worldStudio.js:614` (`syncToRegistry`); `characterGenerator.js:1036` | `worldStudio.js:1083` (`GET /world/characters`) |
| `character_follow_profiles.registry_character_id` | `CharacterFollowProfile.js:20` | `20260622000000-create-character-follow-profiles.js:21` (FK, SET NULL) | `characterFollowService.js:164–168` | `registrySync.js:455` |
| `character_arcs.registry_id` | `CharacterArc.js:16` | `20260314400000-arc-tracking-fields.js:17` (FK, SET NULL) | none; `arcTrackingService.js:58`, `:125` write `character_key` only | CANNOT-TELL |
| `social_profiles.registry_character_id` | `SocialProfile.js:62` (UUID) | `20260308500000-create-social-profiles.js:81` (INTEGER, no FK) | §2.2 | §2.3 |
| `character_therapy_profiles.character_id` | `CharacterTherapyProfile.js:5` | `20260224200000-create-therapy-profiles.js:5` (no FK) | `emotionalImpact.js:161–164` | `thresholdDetection.js:257–268`; `storyHealth.js:347` |
| `therapy_pending_sessions.character_id` | `TherapyPendingSession.js:6` | `20260224400000-create-notification-tables.js:51` (no FK) | `thresholdDetection.js:297–298` | `thresholdDetection.js:163`, `:335` |
| `wardrobe_content_assignments.character_id` | `WardrobeContentAssignment.js:15` | `20260224500000-create-wardrobe-content-assignments.js:29` (comment claims a registry FK; none declared) | `wardrobeLibrary.js:380–385` (body value) | `wardrobeLibrary.js:89`, `:443`; CANNOT-TELL whether the ids are registry ids |
| `character_sparks.registry_character_id` | `CharacterSpark.js:33` | `20260307100000-create-character-sparks-and-story-eval-columns.js:37` (no FK) | none found | none found |
| `intimate_scenes.character_a_id` | no model | `20260302200000-create-world-characters-intimate-scenes.js:104` (no FK; comment says world_characters) | mixed: `characterGenerator.js:1064–1070` (`POST /commit`) inserts a registry id; `worldStudio.js:1978–1991` inserts world_characters ids | `worldStudio.js:1115`, `:1857` |

**Where the FKs come from.** The FK and onDelete values above are read from the migrations.
The canon capture lists columns and types only, so whether each FK exists in production is
CANNOT-TELL from it. Every column above is `uuid` in the canon capture except
`social_profiles.registry_character_id`, which is `integer`.

**An association that is never set up.** `CharacterRelationship.associate` is never called
(`src/models/index.js`; noted at `memories/engine.js:1670`), so its `belongsTo
RegistryCharacter` aliases are not registered.

### 3.2 JSONB keys

| table.column → key | Writer | Reader |
|---|---|---|
| `registry_characters.ghost_characters[].promoted_id` | `characterGenerationRoutes.js:300` (`POST /promote-ghost/:characterId`) | none found |
| `entanglement_events.affected_character_ids[]` | `rippleEngine.js:57`, `:136` (`fireRipple`) | `rippleEngine.js:195–200` (`resolveEvent`) |
| `entanglement_events.scene_proposals[].character_id` | `rippleEngine.js:92–93` | `entanglementRoutes.js:275` |
| `world_state_snapshots.character_states` (object keys) | `tierFeatures.js:493–526`; `worldStudio.js:3384` | `episodeScriptWriterService.js:457` |
| `storyteller_stories.registry_dossiers_used[].id` | `storyEvaluationRoutes.js:1222` (`POST /generate-story-multi`) | `storyEvaluationRoutes.js:1533–1538` (`resolveStoryRegistryId`) |
| `world_events.canon_consequences.automation.host_registry_character_id` | `eventAutomationService.js:717` | `src/utils/eventOrganizer.js:62` |

**CANNOT-TELL (id or name unresolved):**
- `world_locations.associated_characters`: the reader `storyEvaluationRoutes.js:698` looks
  it up by registry id; the writer `memories/engine.js:4430` writes `[characterKey]`.
- `world_events.guest_list[].character_id`: only a migration comment,
  `20260709000000-enrich-locations-and-events.js:102`.
- `world_timeline_events.characters_involved` and `story_threads.characters_involved`:
  migration comments say ids; the writers found write keys or client input.
- `story_texture.registry_id`: `StoryTexture.js:14`.

**Not references to `registry_characters`:**
- `scene_proposals.registry_id` and `character_sparks.registry_id` → `character_registries`.
- `beats.character_id` and `character_clips.character_id` → `character_profiles`.
- `wardrobe.character_id` → `characters`.
- `character_relationships_extended` and `world_characters.relationship_graph` → world ids.
- `registry_characters.relationships_map`, `scene_proposals.proposed_characters` and
  `final_characters` store names.
- `storyteller_chapters.characters_present` and `storyteller_stories.characters_in_scene`
  store `character_key`.

### 3.3 Episode use — MEASURED

No column links an episode to a registry character id.
- `scenes.characters` is JSONB (canon capture line 1621), and `Scene.addCharacter` appends a
  name (`src/models/Scene.js:470–474`).
- `world_events.used_in_episode_id` (canon capture line 2682; `WorldEvent.js:310`) ties an
  event to an episode. The event names its host in `host` (a string) and, when automated,
  `canon_consequences.automation.host_registry_character_id` (§3.2).

"Has episode history" (C5, C6) therefore has no id path today. §7.4 gives name-based and
host-based approximations.

`character_key` is a second, non-UUID link, unique only per `registry_id` (§1.2). It is
used by `character_arcs`, `story_texture`, `social_profile_followers`,
`character_follow_profiles` and chapter and story arrays.

---

## 4. Current removal paths

### 4.1 Backend — MEASURED

Every route below uses `requireAuth` only: no `authorize`, admin-group or ownership check.
Mounts: `characterRegistry` at `/api/v1/character-registry`, `worldStudio` at `/api/v1`, and
`memories` at `/api/v1/memories` (`src/app.js`).

| # | Method + path | file:line | Kind | What stays behind |
|---|---|---|---|---|
| 1 | `DELETE /character-registry/characters/:id` | `characterRegistry.js:721` (`character.destroy()`) | soft (`deleted_at`) | every §3 reference; some raw reads hide them with `rc.deleted_at IS NULL` (`relationships.js:56–57`, `characterRegistry.js:374–375`) |
| 2 | `POST /character-registry/characters/bulk-delete` | `characterRegistry.js:738` (`destroy` at `:749`, up to 100 ids) | soft, bulk | same as 1 |
| 3 | `DELETE /character-registry/registries/:id` | `characterRegistry.js:199` (`registry.destroy()`) | soft, on the registry | characters stay live under a soft-deleted registry. The `hasMany … onDelete: 'CASCADE'` (`CharacterRegistry.js:57–60`) has no `hooks: true`, and the DB cascade (`20260220000004:95–100`) fires only on a hard delete |
| 4 | `POST /character-registry/characters/bulk-status` (`declined`) | `characterRegistry.js:761` | status | nothing removed |
| 5 | `POST /character-registry/characters/:id/set-status` (`declined`) | `characterRegistry.js:875` | status | nothing removed |
| 6 | `POST /world/characters/:id/archive` | `worldStudio.js:1295`; raw `UPDATE registry_characters SET status = 'declined'` at `:1300` | status, via `world_character_id` | registry update errors are logged with `console.warn` and not returned |
| 7 | `DELETE /world/characters/:id` | `worldStudio.js:1842`; `DELETE FROM character_relationships` at `:1852`; `DELETE FROM registry_characters WHERE world_character_id = :id` at `:1855` | **hard**, in one transaction | FK columns cascade or null per §3.1. Columns without an FK and JSONB keys keep the dead id. No `deleted_at` filter, so it also purges soft-deleted rows |
| 8 | Amber `delete_character` action, via `POST /memories/assistant-command` and `/assistant-command-stream` (`requireAuth`, `aiRateLimiter`) | `memories/assistant.js` `executeAssistantAction`; raw `UPDATE registry_characters SET deleted_at = NOW()` at `:665` | soft, raw | same as 1. The guard selects `status` (`:657`) but tests `char?.depth_level === 'alive'` (`:660`), so it never fires |
| 9 | `POST /memories/recycle-bin/restore` (`type: 'character'`) | `memories/assistant.js:1641` | undo: `deleted_at = NULL` | — |
| 10 | `DELETE /memories/recycle-bin/:type/:id` | `memories/assistant.js:1673` (raw `DELETE … WHERE id AND deleted_at IS NOT NULL`) | **hard**, soft-deleted rows only | as 7 |

`force: true` is used on `RegistryCharacter` nowhere. No service in `src/services/` deletes
or declines a registry character. The seeder `down` at
`src/seeders/20260316200000-justawoman-world-characters.js:752` is a hard `bulkDelete`.

### 4.2 Frontend callers — MEASURED

- **Routes 1–5 have no frontend caller.** Searching `frontend/src` for `bulk-delete` on
  `character-registry`, `bulk-status`, `set-status`, and DELETE on
  `character-registry/characters` or `registries` finds none.
- **`WorldStudio.jsx`:**
  - `archiveChar` (`:798`) → route 6: button "Archive" at `:1548`.
  - `deleteChar` (`:808`, `window.confirm('Delete this character permanently?')`) → route 7:
    button "Delete" at `:1550`.
  - These act on `world_characters` ids. A registry row is reached only through
    `world_character_id`.
- **`RecycleBin.jsx`** (route `/recycle-bin`, `App.jsx:572`): "Restore" at `:192–198` →
  route 9; "Delete forever" at `:218–224` → route 10.
- **Amber** (`components/AppAssistant.jsx:14–15`) sends free-text commands (route 8). There
  is no button.
- **Declined characters hidden in some views:** `StoryDashboard.jsx:100` and
  `WriteMode.jsx:508` filter them out.

---

## 5. UI: the Registry page and the character Studio — MEASURED

**Routes** (`frontend/src/App.jsx`):
- `/character-registry` → `CharacterRegistryPage` (lazy at `:119`, route `:448`).
- `/character/:id` → `CharacterProfilePage` (lazy `CharacterProfile` at `:141`, route `:449`).
- `/world-studio` → `WorldStudio` (lazy `:69`, route `:524`).

**Sidebar** (`frontend/src/components/layout/Sidebar.jsx`):
- The WRITE zone's "Characters" item goes to `/character-registry?view=world` (`:64`).
  `CharacterRegistryPage` does not read `view`.
- There is no `/world-studio` item, consistent with `docs/navigation-architecture.md`
  (Mislabels: WorldStudio becomes Character Studio, opened from a selected character).

**`CharacterRegistryPage.jsx`** (201 lines):
- A grid only, with a "+ New Character" header button (`:93`).
- Each card is the `div` in `filtered.map` at `:122–151`; a click navigates to
  `/character/${char.id}`.
- It has no remove, archive or status control.
- A per-card control would sit in the card's header row (from `:129`) or badge row
  (from `:136`), with `stopPropagation` against the card click.
- `CharacterRegistryPage.css` is not imported by any file. It keeps the removed monolith's
  classes (e.g. `.cr-bulk-bar-delete`, `.cr-dossier`).

**`CharacterProfilePage.jsx`** (the per-character page reached from the Registry):
- The left panel is `aside.cp-sidebar` (`:822`), with "← Registry" at `:823`.
- Its action block is `div.cp-sidebar-actions` (`:842–851`): "↑ Deepen" (to `/world-studio`,
  no character id) and "Export" (`onClick={() => {}}`).
- A per-profile control would sit in that block.

**`WorldStudio.jsx`** (the current Studio for world characters):
- The detail toolbar `div.ws4-detail-toolbar` (`:1529–1561`) holds Edit, Deepen, Export,
  Compare, Archive, Delete and Activate.
- Its list rows `.ws4-char-item` (`:1243–1261`) have no actions.
- It is keyed on `world_characters`, not `registry_characters`.

---

## 6. Overlap with F-Reg-2 group 2 (C8) — MEASURED

`docs/audit/F-Reg-2_Fix_Plan_v1.0.md` §4.2's by-file table (`:214–227`) against the files
named in this read:

| Group 2 file | Named here | Status at this basis |
|---|---|---|
| `src/routes/characterRegistry.js` | §1.3, §2, §3, §4 | Open rows fixed: #2179 (`4f2a4baa`), #2181 (`272a9681`). Rows 36, 40 and 41 are excluded by v1.2 R2 (`F-Reg-2_Fix_Plan_v1.2.md:68`). |
| `src/services/registrySync.js` | §2.2, §3.1 | Fixed: #2183 (`9e4a57aa`). |
| `src/routes/characterGenerationRoutes.js` | §1.3, §2, §3.2 | Row 4 fixed: #2186 (`9e36febe`). Row 8 is open: Task #2189, after the enum fix #2188 (`11ebb5d4`). |
| `src/routes/characterGrowthRoute.js` | §2.2, §3.1 | Open (row 12). |
| `src/routes/memories/engine.js` | §1.1, §2.3, §3 | No open site (row 49 excluded). |
| `src/routes/worldStudio.js` | §1.1, §3, §4, §5 | Open (row 60). |
| `src/services/registrySyncService.js` | §2.2 | Open (row 74). |
| `src/routes/consciousness.js`, `memories/interview.js` | not named | Open (rows 42, 43; 50). |
| `src/routes/memories/core.js` | §3.1 | No open site (row 46 excluded). |

C8's condition is that F-Reg-2's `characterRegistry.js` PRs under v1.2 R2 have merged. Both
parts (#2179, #2181) are in `origin/main` at this basis.

---

## 7. Counts — CANNOT-TELL; SELECTs for Evoni

**EVONI-ONLY.** Run these yourself, as the app user, against the database the API uses. No
agent session runs them. All are read-only `SELECT`s. Column names are checked against the
canon capture.

### 7.1 Totals, status and soft-deleted

```sql
SELECT count(*) FILTER (WHERE deleted_at IS NULL)     AS live,
       count(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted
FROM registry_characters;

SELECT r.title, rc.world, rc.status, count(*)
FROM registry_characters rc
JOIN character_registries r ON r.id = rc.registry_id
WHERE rc.deleted_at IS NULL
GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
```

### 7.2 `role_type` and `depth_level` distribution

```sql
SELECT role_type, depth_level, count(*)
FROM registry_characters
WHERE deleted_at IS NULL
GROUP BY 1, 2 ORDER BY 1, 2;
```

### 7.3 Feed match: by link and by name

```sql
-- by link, registry side
SELECT count(*) FILTER (WHERE feed_profile_id IS NOT NULL) AS with_feed_profile_id,
       count(*) FILTER (WHERE social_presence)             AS social_presence_true
FROM registry_characters WHERE deleted_at IS NULL;

-- by link, Feed side (the column is integer in canon; this shows whether anything is stored)
SELECT count(*) AS profiles_with_registry_character_id
FROM social_profiles
WHERE registry_character_id IS NOT NULL AND deleted_at IS NULL;

-- by name (case- and space-insensitive), unlinked pairs
SELECT rc.id, rc.display_name, rc.selected_name, sp.id AS profile_id, sp.handle, sp.display_name AS profile_name
FROM registry_characters rc
JOIN social_profiles sp
  ON lower(trim(sp.display_name)) IN (lower(trim(rc.display_name)), lower(trim(coalesce(rc.selected_name, ''))))
WHERE rc.deleted_at IS NULL AND sp.deleted_at IS NULL
  AND (rc.feed_profile_id IS DISTINCT FROM sp.id)
ORDER BY rc.display_name;
```

### 7.4 Episode use (approximations; there is no id link, §3.3)

```sql
-- characters named in a live scene's characters array
SELECT rc.id, rc.display_name, count(DISTINCT s.episode_id) AS episodes
FROM registry_characters rc
JOIN scenes s ON s.deleted_at IS NULL
 AND (s.characters ? rc.display_name OR s.characters ? coalesce(rc.selected_name, '') OR s.characters ? rc.character_key)
WHERE rc.deleted_at IS NULL
GROUP BY 1, 2 ORDER BY 3 DESC;

-- characters hosting an event that was used in an episode
SELECT rc.id, rc.display_name, count(DISTINCT we.used_in_episode_id) AS episodes
FROM registry_characters rc
JOIN world_events we ON we.deleted_at IS NULL AND we.used_in_episode_id IS NOT NULL
 AND (we.canon_consequences #>> '{automation,host_registry_character_id}' = rc.id::text
      OR lower(trim(we.host)) IN (lower(trim(rc.display_name)), lower(trim(coalesce(rc.selected_name, '')))))
WHERE rc.deleted_at IS NULL
GROUP BY 1, 2 ORDER BY 3 DESC;
```

### 7.5 Likely duplicates by name

```sql
SELECT lower(trim(coalesce(selected_name, display_name))) AS name_key,
       count(*) AS n,
       array_agg(id ORDER BY created_at)          AS ids,
       array_agg(DISTINCT registry_id)            AS registries,
       array_agg(DISTINCT character_key)          AS keys
FROM registry_characters
WHERE deleted_at IS NULL
GROUP BY 1 HAVING count(*) > 1
ORDER BY n DESC, name_key;
```

---

## What this document does not do

- It recommends nothing and rules nothing. C1–C8 are Evoni's rulings (Task #2190).
- It changes no code, doc or migration, and edits nothing under `docs/audit/`.
- It runs no query. §7 is for Evoni to run herself.
- It makes no host, AWS, database or Cognito contact.
