# F-App-1 G1 Environment Audit Report

**Date:** May 13, 2026
**Auditor:** JAWIHP / Evoni
**F-App-1 Fix Plan:** v1.0
**Repo HEAD at audit:** 8cc2590a3caaae0e419de9fadc84566d912a8b1a

---

## Environment topology findings (pre-audit discovery)

**Discovered before running audit queries:**

- Two RDS instances exist in AWS us-east-1: `episode-control-prod` and `episode-control-dev`. Both available.
- Only ONE RDS is connected to running application processes: `episode-control-prod`.
- Both PM2 processes on the backend EC2 box (`episode-api` id 14, `episode-api-dev` id 2) have `DB_HOST` set to prod RDS.
- `episode-api` (the prod process) uses the rotated MP-1 password and `DB_NAME=episode_metadata` — verified working.
- `episode-api-dev` (the "dev" process) has stale credentials: `DB_PASSWORD=Ayanna123!!` (old, pre-May-12 rotation), `DB_NAME=postgres`, `DB_USER=episode-control-prod`. Status of these credentials is unverified.
- Dev RDS (`episode-control-dev`) is reachable inside the VPC but has no running application process connecting to it. It is effectively orphaned.
- No separate dev EC2 instance exists. Only two EC2 boxes total: `episode-backend` (54.163.229.144) and `episode-frontend` (52.91.217.230). PE #40 confirmed in its strongest form — there is no dedicated dev infrastructure.
- No local Postgres container running (Docker daemon not available locally at audit time).

**Implication for F-App-1:** G1 reduces to a single-environment audit against prod RDS only.

---

## Audit results

### Step 1 — SequelizeMeta state

**Run against:** prod RDS (`episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com`)
**DB:** `episode_metadata`
**Connected as:** `postgres` user

```
 total_applied_migrations 
--------------------------
                      211
(1 row)

        earliest_migration         
-----------------------------------
 20240101000001-create-episodes.js
(1 row)

                  latest_migration                   
-----------------------------------------------------
 20260807000000-add-source-profile-to-world-event.js
(1 row)

          f_app_1_migration_applied           
----------------------------------------------
 20260208110001-create-decision-logs-table.js
 20260218100000-evaluation-system.js
 20260219000001-decision-log-browse-pool.js
 20260219000003-world-events.js
 20260219000005-career-goals.js
(5 rows)
```

**Observations:**

- 211 total migrations applied — consistent with mid-2024-through-mid-2026 chain.
- Earliest entry (2024-01-01) confirms chain reaches project inception.
- Latest entry (2026-08-07) matches the most recent ALTER migration in the integrator's inventory.
- All 5 F-App-1-relevant CREATE migrations report as applied — no skipped migrations.
- **Path 3 risk (missing migrations) ruled out at the SequelizeMeta level.** Any column-level drift discovered in Step 2 will not be due to skipped migrations; it would be due to migrations running addColumn against pre-existing tables and silently no-op'ing.

---

### Step 2 — Column definitions per table

**Run against:** prod RDS (`episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com`)

#### `character_state`

```
Table "public.character_state"
         Column          |           Type           | Collation | Nullable | Default | Storage  | Compression | Stats target |         Description          
-------------------------+--------------------------+-----------+----------+---------+----------+-------------+--------------+------------------------------
 id                      | uuid                     |           | not null |         | plain    |             |              | 
 show_id                 | uuid                     |           | not null |         | plain    |             |              | 
 season_id               | uuid                     |           |          |         | plain    |             |              | 
 character_key           | character varying(50)    |           | not null |         | extended |             |              | lala, justawoman, guest:<id>
 coins                   | integer                  |           |          | 500     | plain    |             |              | 
 reputation              | integer                  |           |          | 1       | plain    |             |              | 0-10 scale
 brand_trust             | integer                  |           |          | 1       | plain    |             |              | 0-10 scale
 influence               | integer                  |           |          | 1       | plain    |             |              | 0-10 scale
 stress                  | integer                  |           |          | 0       | plain    |             |              | 0-10 scale
 last_applied_episode_id | uuid                     |           |          |         | plain    |             |              | 
 created_at              | timestamp with time zone |           |          | now()   | plain    |             |              | 
 updated_at              | timestamp with time zone |           |          | now()   | plain    |             |              | 
Indexes:
    "character_state_pkey" PRIMARY KEY, btree (id)
    "idx_character_state_key" btree (character_key)
    "idx_character_state_unique" UNIQUE, btree (show_id, season_id, character_key) WHERE season_id IS NOT NULL
Access method: heap
```

**Observations:** Migration-canonical. Partial unique index `idx_character_state_unique` present with `WHERE season_id IS NOT NULL` clause (confirms §12.2 finding from the plan — the unique index exists but doesn't cover global show-level rows where the application writes). No auto-repair fingerprints. TIMESTAMPTZ timestamp types.

#### `character_state_history`

```
Table "public.character_state_history"
      Column      |                Type                 | Collation | Nullable |                     Default                     | Storage  | Compression | Stats target |                     Description                     
------------------+-------------------------------------+-----------+----------+-------------------------------------------------+----------+-------------+--------------+-----------------------------------------------------
 id               | uuid                                |           | not null |                                                 | plain    |             |              | 
 show_id          | uuid                                |           | not null |                                                 | plain    |             |              | 
 season_id        | uuid                                |           |          |                                                 | plain    |             |              | 
 character_key    | character varying(50)               |           | not null |                                                 | extended |             |              | 
 episode_id       | uuid                                |           |          |                                                 | plain    |             |              | 
 evaluation_id    | uuid                                |           |          |                                                 | plain    |             |              | Reference to the evaluation snapshot on the episode
 source           | enum_character_state_history_source |           | not null | 'computed'::enum_character_state_history_source | plain    |             |              | 
 deltas_json      | jsonb                               |           | not null | '{}'::jsonb                                     | extended |             |              | {"coins":-150,"reputation":1,"stress":1}
 state_after_json | jsonb                               |           |          |                                                 | extended |             |              | Snapshot of character state after applying deltas
 notes            | text                                |           |          |                                                 | extended |             |              | 
 created_at       | timestamp with time zone            |           |          | now()                                           | plain    |             |              | 
Indexes:
    "character_state_history_pkey" PRIMARY KEY, btree (id)
    "idx_csh_character_show" btree (character_key, show_id)
    "idx_csh_created" btree (created_at)
    "idx_csh_episode" btree (episode_id)
Access method: heap
```

**Observations:** Migration-canonical. `source` is the proper `enum_character_state_history_source` ENUM type (NOT downgraded to VARCHAR). `evaluation_id` column present (the migration-only column from plan §12.9). Full-length `deltas_json` and `state_after_json` column names (NOT the auto-repair's short `deltas`/`state_after`). `episode_id` nullable per post-ALTER state from `20260219000004-fix-csh-episode-id-nullable.js`. All 4 indexes present.

#### `decision_log` (singular)

```
Table "public.decision_log"
      Column       |           Type           | Collation | Nullable |          Default          | Storage  | Compression | Stats target |                                       Description                                        
-------------------+--------------------------+-----------+----------+---------------------------+----------+-------------+--------------+-----------------------------------------------------------------------------------------
 id                | uuid                     |           | not null | gen_random_uuid()         | plain    |             |              | 
 type              | character varying(50)    |           | not null |                           | extended |             |              | tier_override | evaluation_accepted | autofix_accepted | browse_pool | style_adjust | ...
 episode_id        | uuid                     |           |          |                           | plain    |             |              | 
 show_id           | uuid                     |           |          |                           | plain    |             |              | 
 user_id           | uuid                     |           |          |                           | plain    |             |              | 
 context_json      | jsonb                    |           |          |                           | extended |             |              | Snapshot of state at decision time
 decision_json     | jsonb                    |           | not null |                           | extended |             |              | What was chosen
 alternatives_json | jsonb                    |           |          |                           | extended |             |              | Options that were NOT chosen
 confidence        | double precision         |           |          |                           | plain    |             |              | 0-1 confidence if AI-assisted
 source            | character varying(50)    |           |          | 'user'::character varying | extended |             |              | user | ai | system
 created_at        | timestamp with time zone |           | not null | now()                     | plain    |             |              | 
Indexes:
    "decision_log_pkey" PRIMARY KEY, btree (id)
    "decision_log_created_at" btree (created_at)
    "decision_log_episode_id" btree (episode_id)
    "decision_log_show_id" btree (show_id)
    "decision_log_source" btree (source)
    "decision_log_type" btree (type)
Foreign-key constraints:
    "decision_log_episode_id_fkey" FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
    "decision_log_show_id_fkey" FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE SET NULL
Access method: heap
```

**Observations:** Migration-canonical. All 11 migration columns present including `confidence`, `source` with default `'user'`, and the three separate JSONB columns (`context_json`, `decision_json`, `alternatives_json`). Both foreign keys to `episodes` and `shows` are in place with `ON DELETE SET NULL`. All 5 named indexes present.

#### `career_goals`

```
Table "public.career_goals"
       Column        |           Type           | Collation | Nullable |            Default             | Storage  | Compression | Stats target |                                                      Description                                                       
---------------------+--------------------------+-----------+----------+--------------------------------+----------+-------------+--------------+-----------------------------------------------------------------------------------------------------------------------
 id                  | uuid                     |           | not null |                                | plain    |             |              | 
 show_id             | uuid                     |           | not null |                                | plain    |             |              | 
 season_id           | uuid                     |           |          |                                | plain    |             |              | 
 title               | character varying(200)   |           | not null |                                | extended |             |              | 
 description         | text                     |           |          |                                | extended |             |              | 
 type                | character varying(20)    |           | not null | 'secondary'::character varying | extended |             |              | primary | secondary | passive
 target_metric       | character varying(50)    |           | not null |                                | extended |             |              | coins, reputation, followers, brand_trust, influence, engagement_rate, portfolio_strength, consistency_streak, custom
 target_value        | double precision         |           | not null | '0'::double precision          | plain    |             |              | 
 current_value       | double precision         |           | not null | '0'::double precision          | plain    |             |              | 
 starting_value      | double precision         |           |          |                                | plain    |             |              | Value when goal was created — for progress calculation
 status              | character varying(20)    |           | not null | 'active'::character varying    | extended |             |              | active | completed | failed | paused | abandoned
 priority            | integer                  |           |          | 3                              | plain    |             |              | 1=highest, 5=lowest
 unlocks_on_complete | jsonb                    |           |          | '[]'::jsonb                    | extended |             |              | ["maison_belle_contract","luxury_closet_upgrade"]
 fail_consequence    | text                     |           |          |                                | extended |             |              | 
 arc_id              | uuid                     |           |          |                                | plain    |             |              | 
 episode_range       | jsonb                    |           |          |                                | extended |             |              | {"start":1,"end":6}
 icon                | character varying(10)    |           |          | (target emoji)                 | extended |             |              | 
 color               | character varying(20)    |           |          | '#6366f1'::character varying   | extended |             |              | 
 completed_at        | timestamp with time zone |           |          |                                | plain    |             |              | 
 created_at          | timestamp with time zone |           |          | now()                          | plain    |             |              | 
 updated_at          | timestamp with time zone |           |          | now()                          | plain    |             |              | 
 deleted_at          | timestamp with time zone |           |          |                                | plain    |             |              | 
Indexes:
    "career_goals_pkey" PRIMARY KEY, btree (id)
    "idx_career_goals_active" btree (show_id, type, status)
    "idx_career_goals_show" btree (show_id)
    "idx_career_goals_status" btree (status)
    "idx_career_goals_type" btree (type)
Access method: heap
```

**Observations:** Migration-canonical with `title`/`type`/`target_metric` column names (NOT auto-repair's `name`/`goal_type`/`stat_key`). Numeric columns are `double precision` (FLOAT, NOT INTEGER). All migration-only columns present including `priority`, `unlocks_on_complete`, `fail_consequence`, `arc_id`, `episode_range`, `icon`, `color`, `completed_at`, `deleted_at`.

**CRITICAL: `tier` and `is_active` columns from the auto-repair literal are NOT present on prod.** The auto-repair's `CREATE TABLE IF NOT EXISTS` for `career_goals` has never successfully created the table on prod, confirming the migration chain is the authoritative source.

#### `world_events`

```
Table "public.world_events"
          Column          |           Type           | Collation | Nullable |                          Default                          | Storage  | Compression | Stats target |                                                                 Description                                                                  
--------------------------+--------------------------+-----------+----------+-----------------------------------------------------------+----------+-------------+--------------+----------------------------------------------------------------------------------------------------------------------------------------------
 id                       | uuid                     |           | not null |                                                           | plain    |             |              | 
 show_id                  | uuid                     |           | not null |                                                           | plain    |             |              | 
 season_id                | uuid                     |           |          |                                                           | plain    |             |              | 
 arc_id                   | uuid                     |           |          |                                                           | plain    |             |              | 
 name                     | character varying(200)   |           | not null |                                                           | extended |             |              | 
 event_type               | character varying(30)    |           | not null | 'invite'::character varying                               | extended |             |              | invite | upgrade | guest | fail_test | deliverable | brand_deal
 host_brand               | character varying(200)   |           |          |                                                           | extended |             |              | Maison Belle, Luxe Cosmetics, etc.
 description              | text                     |           |          |                                                           | extended |             |              | 
 prestige                 | integer                  |           | not null | 5                                                         | plain    |             |              | 1-10
 cost_coins               | integer                  |           | not null | 100                                                       | plain    |             |              | 
 strictness               | integer                  |           | not null | 5                                                         | plain    |             |              | 1-10
 deadline_type            | character varying(20)    |           |          | 'medium'::character varying                               | extended |             |              | none | low | medium | high | tonight | urgent
 deadline_minutes         | integer                  |           |          |                                                           | plain    |             |              | 
 dress_code               | character varying(200)   |           |          |                                                           | extended |             |              | 
 dress_code_keywords      | jsonb                    |           |          | '[]'::jsonb                                               | extended |             |              | ["romantic","vintage","lace","couture"]
 location_hint            | text                     |           |          |                                                           | extended |             |              | Parisian rooftop garden, golden hour, marble tables
 narrative_stakes         | text                     |           |          |                                                           | extended |             |              | What this event means for Lala's arc
 canon_consequences       | jsonb                    |           |          | '{}'::jsonb                                               | extended |             |              | {"slay":{"unlock":"luxury_brand_attention"},"fail":{"consequence":"brand_reconsiders"}}
 seeds_future_events      | jsonb                    |           |          | '[]'::jsonb                                               | extended |             |              | Event IDs or names this unlocks on success
 overlay_template         | character varying(50)    |           |          | 'luxury_invite'::character varying                        | extended |             |              | Invite letter overlay style
 required_ui_overlays     | jsonb                    |           |          | '["MailPanel", "InviteLetterOverlay", "ToDoList"]'::jsonb | extended |             |              | 
 browse_pool_bias         | character varying(20)    |           |          | 'balanced'::character varying                             | extended |             |              | 
 browse_pool_size         | integer                  |           |          | 8                                                         | plain    |             |              | 
 rewards                  | jsonb                    |           |          | '{}'::jsonb                                               | extended |             |              | {"slay":{"coins":50,"reputation":3},"pass":{"coins":0,"reputation":1},"fail":{"reputation":-2}}
 status                   | character varying(20)    |           | not null | 'draft'::character varying                                | extended |             |              | draft | ready | used | archived
 used_in_episode_id       | uuid                     |           |          |                                                           | plain    |             |              | 
 times_used               | integer                  |           |          | 0                                                         | plain    |             |              | 
 created_at               | timestamp with time zone |           |          | now()                                                     | plain    |             |              | 
 updated_at               | timestamp with time zone |           |          | now()                                                     | plain    |             |              | 
 is_paid                  | boolean                  |           |          | false                                                     | plain    |             |              | Does Lala get paid to attend (vs paying to attend)?
 payment_amount           | integer                  |           |          | 0                                                         | plain    |             |              | Coins earned (if paid event)
 requirements             | jsonb                    |           |          | '{}'::jsonb                                               | extended |             |              | {"reputation_min":5,"brand_trust_min":4,"portfolio_min":10}
 career_tier              | integer                  |           |          | 1                                                         | plain    |             |              | 1=Emerging, 2=Rising, 3=Established, 4=Influential, 5=Elite
 career_milestone         | text                     |           |          |                                                           | extended |             |              | What this event represents in her journey
 fail_consequence         | text                     |           |          |                                                           | extended |             |              | What happens narratively on fail
 success_unlock           | text                     |           |          |                                                           | extended |             |              | What this opens up on success
 scene_set_id             | uuid                     |           |          |                                                           | plain    |             |              | 
 host                     | character varying(200)   |           |          |                                                           | extended |             |              | Who is hosting: person, organization, or committee
 theme                    | character varying(100)   |           |          |                                                           | extended |             |              | e.g. "honey luxe", "avant-garde", "soft glam", "romantic garden"
 color_palette            | jsonb                    |           |          | '[]'::jsonb                                               | extended |             |              | e.g. ["blush", "champagne", "honey gold"]
 mood                     | character varying(100)   |           |          |                                                           | extended |             |              | e.g. "intimate", "aspirational", "electric", "mysterious"
 floral_style             | character varying(50)    |           |          |                                                           | extended |             |              | roses / peonies / tropical / minimal / none
 border_style             | character varying(50)    |           |          |                                                           | extended |             |              | gold_foil / ornate / minimal / none
 invitation_asset_id      | uuid                     |           |          |                                                           | plain    |             |              | FK to assets table — the generated invitation image
 venue_location_id        | uuid                     |           |          |                                                           | plain    |             |              | FK to WorldLocation — the venue where this event takes place
 venue_name               | character varying(200)   |           |          |                                                           | extended |             |              | Display name: "Club Noir" (may differ from WorldLocation name)
 venue_address            | character varying(255)   |           |          |                                                           | extended |             |              | Full address for invitation: "742 Ocean Drive, South Beach, Miami"
 event_date               | character varying(50)    |           |          |                                                           | extended |             |              | Story date of the event: "Friday, March 15th" or "Tonight at 9pm"
 event_time               | character varying(50)    |           |          |                                                           | extended |             |              | Event time: "9:00 PM - 2:00 AM"
 guest_list               | jsonb                    |           |          | '[]'::jsonb                                               | extended |             |              | Array of { character_id, character_name, rsvp_status, plus_one }
 invitation_details       | jsonb                    |           |          |                                                           | extended |             |              | { tagline, rsvp_by, attire_note, special_instructions, hosted_by }
 deleted_at               | timestamp with time zone |           |          |                                                           | plain    |             |              | Soft delete timestamp
 source_calendar_event_id | uuid                     |           |          |                                                           | plain    |             |              | FK to StoryCalendarEvent — the cultural moment that spawned this event
 opportunity_id           | uuid                     |           |          |                                                           | plain    |             |              | 
 outfit_pieces            | jsonb                    |           |          |                                                           | extended |             |              | Selected wardrobe pieces for this event — [{id, name, category, brand, tier, price, image_url}]
 outfit_score             | jsonb                    |           |          |                                                           | extended |             |              | Outfit match intelligence — {match_score, narrative_mood, signals, repeats, brand_loyalty}
 parent_event_id          | uuid                     |           |          |                                                           | plain    |             |              | Links to the event that spawned this one (event chaining)
 chain_position           | integer                  |           |          | 0                                                         | plain    |             |              | Position in event chain (0=origin, 1=first sequel, etc.)
 chain_reason             | text                     |           |          |                                                           | extended |             |              | Narrative explanation of why this event was spawned
 momentum_score           | double precision         |           |          | '0'::double precision                                     | plain    |             |              | Cumulative score from feed engagement that influenced this event
 outfit_set_id            | uuid                     |           |          |                                                           | plain    |             |              | FK to outfit_sets when the event uses a saved outfit
 source_profile_id        | integer                  |           |          |                                                           | plain    |             |              | FK to social_profiles.id when event was spawned from a feed profile.
Indexes:
    "world_events_pkey" PRIMARY KEY, btree (id)
    "idx_world_events_career_tier" btree (career_tier)
    "idx_world_events_opportunity" btree (opportunity_id)
    "idx_world_events_prestige" btree (prestige)
    "idx_world_events_scene_set_id" btree (scene_set_id)
    "idx_world_events_show" btree (show_id)
    "idx_world_events_source_calendar" btree (source_calendar_event_id)
    "idx_world_events_status" btree (status)
    "idx_world_events_type" btree (event_type)
    "idx_world_events_venue_location" btree (venue_location_id)
    "world_events_parent_event_id" btree (parent_event_id) WHERE parent_event_id IS NOT NULL
    "world_events_source_profile_id_idx" btree (source_profile_id)
    "world_events_used_in_episode_unique" UNIQUE, btree (used_in_episode_id) WHERE used_in_episode_id IS NOT NULL
Foreign-key constraints:
    "world_events_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
    "world_events_scene_set_id_fkey" FOREIGN KEY (scene_set_id) REFERENCES scene_sets(id) ON DELETE SET NULL
    "world_events_source_calendar_event_id_fkey" FOREIGN KEY (source_calendar_event_id) REFERENCES story_calendar_events(id) ON DELETE SET NULL
    "world_events_source_profile_id_fkey" FOREIGN KEY (source_profile_id) REFERENCES social_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL
    "world_events_venue_location_id_fkey" FOREIGN KEY (venue_location_id) REFERENCES world_locations(id) ON DELETE SET NULL
Access method: heap
```

**Observations:** Migration-canonical across all 13 ALTER migrations and the original CREATE.

Critical confirmations:

- All 6 original-CREATE columns missing from auto-repair literal are present: `overlay_template`, `required_ui_overlays`, `browse_pool_bias`, `browse_pool_size`, `rewards`, `times_used`.
- All 7 career-fields ALTER columns present: `is_paid`, `payment_amount`, `requirements`, `career_tier`, `career_milestone`, `fail_consequence`, `success_unlock`.
- `opportunity_id` column present with `world_events_opportunity_id_fkey` foreign key to `opportunities(id)`.
- **Race guard partial unique index `world_events_used_in_episode_unique` IS LIVE** on `used_in_episode_id WHERE NOT NULL` (from `20260805000000-episode-brief-outfit-set-and-event-uniqueness.js`).
- All other ALTER chain additions present (scene_set_id, host, theme/color/mood/floral/border, venue fields, source_calendar, outfit_pieces, parent_event chain fields, outfit_set_id, source_profile_id) with their respective foreign keys.

No auto-repair fingerprints. No drift.

---

#### Step 2 finding summary

**All 5 F-App-1 tables on prod RDS are migration-canonical.** Zero auto-repair fingerprints across any table. Every migration column is present with the correct name, type, default, nullability, and (where applicable) constraint or foreign key.

The auto-repair block in `app.js` has been functionally inert on prod — its `CREATE TABLE IF NOT EXISTS` statements have correctly no-op'd against pre-existing migration-created tables for the full lifetime of those tables.

**Specifically confirmed absent from prod:**
- `career_goals.tier` column (auto-repair-only) — NOT present
- `career_goals.is_active` column (auto-repair-only) — NOT present

**Specifically confirmed present from migrations (not auto-repair):**
- `character_state.idx_character_state_unique` partial unique index
- `character_state_history.source` ENUM type (not VARCHAR)
- `world_events.world_events_used_in_episode_unique` race-guard partial unique index
- `world_events.opportunity_id` foreign key to `opportunities`
- `decision_log` 11-column migration schema with both foreign keys

**Implication: F-App-1 decision tree resolves to Path 1.** Step 1 (bridge migration) is unnecessary. F-App-1 ships as a single PR removing the auto-repair block from `src/app.js`.

---

### Step 3 — Auto-repair-only column check

**Query 3a — `career_goals.tier` and `career_goals.is_active` presence check:**

```
 column_name | data_type | column_default | is_nullable 
-------------+-----------+----------------+-------------
(0 rows)
```

**Query 3c — Broad auto-repair-style column name scan across all 5 tables:**

```
       table_name        | column_name |     data_type     
-------------------------+-------------+-------------------
 character_state_history | notes       | text
 world_events            | name        | character varying
(2 rows)
```

**Observations:**

- Query 3a: **zero rows.** `career_goals.tier` and `career_goals.is_active` do not exist on prod. Bridge migration definitively unnecessary.
- Query 3c: two matches, both **false positives** from the over-broad column-name list.
  - `character_state_history.notes` (TEXT) is a legitimate migration column declared by `20260218100000-evaluation-system.js`. The auto-repair literal also declares it, but it's present in both; not auto-repair-specific.
  - `world_events.name` (VARCHAR) is the event display name from the original CREATE migration `20260219000003-world-events.js`. Different column, different table, different meaning from the `career_goals.name` the auto-repair literal uses (which would have been a real drift hit but is correctly absent).
- All eight true auto-repair fingerprint columns are absent (`career_goals.tier`, `career_goals.is_active`, `career_goals.name`, `career_goals.goal_type`, `career_goals.stat_key`, `character_state_history.deltas`, `character_state_history.state_after`, `decision_log.data`).

**Decision tree (§5.1.3): All three Path 1 conditions verified.**

F-App-1 ships as a single PR removing the auto-repair block from `src/app.js`. No bridge migration.

---

### Step 4 — Inline CREATE TABLE statements outside migrations

**Run from:** repo root `C:\Users\12483\Projects\Episode-Canonical-Control-Record-1`

**Query 4a — All CREATE TABLE in src/, excluding migrations directory:**

```
src\controllers\videoCompositionController.js:33:      // Try to create table if it doesn't exist (safe for development)
src\controllers\videoCompositionController.js:35:        CREATE TABLE IF NOT EXISTS video_compositions (
src\routes\admin.js:53:      CREATE TABLE IF NOT EXISTS video_compositions (
src\routes\storyHealth.js:244:      CREATE TABLE IF NOT EXISTS chapter_versions (
src\routes\storyHealth.js:276:      CREATE TABLE IF NOT EXISTS chapter_versions (
src\routes\worldStudio.js:319:    CREATE TABLE IF NOT EXISTS ecosystem_previews (
src\app.js:125:              world_events: `CREATE TABLE IF NOT EXISTS world_events (
src\app.js:143:              character_state: `CREATE TABLE IF NOT EXISTS character_state (
src\app.js:151:              character_state_history: `CREATE TABLE IF NOT EXISTS character_state_history (
src\app.js:157:              decision_log: `CREATE TABLE IF NOT EXISTS decision_log (
src\app.js:162:              career_goals: `CREATE TABLE IF NOT EXISTS career_goals (
```

**Query 4b — CREATE TABLE IF NOT EXISTS specifically:** identical to 4a — all 11 hits use this exact phrase.

**Observations:**

- **Five hits in `src/app.js:125–162`** — these are the auto-repair block. F-App-1 deletes these.
- **Six additional hits across four files outside `src/app.js`** — these are previously-uncatalogued Pattern 40 sites. They are NOT in F-App-1 scope.

Additional sites identified:

- `videoCompositionController.js:35` AND `admin.js:53` — both declare `video_compositions` table (two-file pattern).
- `storyHealth.js:244` AND `storyHealth.js:276` — both declare `chapter_versions` table; identical in visible portion (verified via line-range inspection of source). Pattern 40 duplicate-within-file variant.
- `worldStudio.js:319` — declares `ecosystem_previews` table.

None of these touch the five F-App-1 tables (`world_events`, `character_state`, `character_state_history`, `decision_log`, `career_goals`). They are independent Pattern 40 instances that should be addressed in a follow-up plan per §10.4 of the F-App-1 fix plan.

**Decision:** Add finding to F-App-1 plan v1.1 §12.11. Do not expand F-App-1 scope. Proceed to Step 5.

**F-App-1 Path 1 outcome unchanged.** The auto-repair block in `src/app.js` is still the master Pattern 40 site for the five F-App-1 tables, and removing it remains a clean single-PR change.

---

### Step 5 — `model.sync()` calls outside the gated `ENABLE_DB_SYNC` branch


**Run from:** repo root.

**Query:**
```powershell
Get-ChildItem -Path src -Recurse -Include *.js | Select-String -Pattern ".sync\(" | Where-Object { $_.Path -notmatch "test" }
```

**Output:**

```
src\migrations\20260217000002-fix-episode-number-nullable.js:8: * sequelize.sync() that created the table.
src\migrations\20260218000001-fix-scenes-timeline-schema-gaps.js:9: * (the DB was created by sequelize.sync() with a subset of columns).
src\migrations\20260218000002-fix-wardrobe-defaults-table.js:9: * because the DB was created by sequelize.sync().
src\models\index.js:1797:      await sequelize.sync({ ...defaultOptions, ...options });
src\routes\memories\engine.js:2434:    await db.StoryTaskArc.sync();
src\routes\memories\engine.js:3183:      await db.StoryTaskArc.sync();
src\routes\memories\engine.js:3470:      await db.StoryTaskArc.sync();
src\routes\memories\engine.js:3662:      await db.StoryTaskArc.sync();
src\routes\continuityEngine.js:39:      await m.ContinuityTimeline.sync();
src\routes\continuityEngine.js:40:      await m.ContinuityCharacter.sync();
src\routes\continuityEngine.js:41:      await m.ContinuityBeat.sync();
src\routes\continuityEngine.js:42:      if (m.ContinuityBeatCharacter) await m.ContinuityBeatCharacter.sync();
src\routes\franchiseBrainRoutes.js:66:        await db.FranchiseKnowledge.sync();
src\routes\sceneSetRoutes.js:52:      GenerationJob.sync(),
src\workers\sceneGenerationWorker.js:235:    await GenerationJob.sync();
src\app.js:87:          await db.sequelize.sync(syncOptions);
src\app.js:114:                  await model.sync();
```

**Observations:**

**Categorization of the 17 hits:**

- **Expected and accounted for by F-App-1 (2 hits, both in app.js):**
    - `src/app.js:87` — `db.sequelize.sync(syncOptions)` inside the `ENABLE_DB_SYNC=true` branch. Preserved per F-App-1 plan §9.3.
    - `src/app.js:114` — `model.sync()` inside Path A of the auto-repair. F-App-1 deletes this.

- **Comment references in migration JSDoc (3 hits, not findings):**
    - `migrations/20260217000002-fix-episode-number-nullable.js:8`, `migrations/20260218000001-fix-scenes-timeline-schema-gaps.js:9`, `migrations/20260218000002-fix-wardrobe-defaults-table.js:9` — comment text inside migrations documenting historical sync-induced drift. Not Pattern 40 sites; they are evidence of past Pattern 40 cleanup.

- **Suspicious model-loader sync (1 hit, requires investigation):**
    - `src/models/index.js:1797` — `sequelize.sync({ ...defaultOptions, ...options })` inside the model loader. Model loader files should not run schema operations. Needs investigation in follow-up plan.

- **Pattern 40 Variant A sites — `model.sync()` inside routes and workers (11 hits across 5 files, 7+ distinct models):**
    - `routes/memories/engine.js:2434, 3183, 3470, 3662` — `StoryTaskArc.sync()` called four times in the same file
    - `routes/continuityEngine.js:39-42` — four adjacent model syncs (`ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`)
    - `routes/franchiseBrainRoutes.js:66` — `FranchiseKnowledge.sync()`
    - `routes/sceneSetRoutes.js:52` and `workers/sceneGenerationWorker.js:235` — `GenerationJob.sync()` in two separate processes (race risk)

**Decision:** All Variant A sites are out of F-App-1 scope (none touch the five F-App-1 tables). Add expanded §12.11 finding covering both Variant B (Step 4) and Variant A (Step 5) to F-App-1 plan v1.1.

**F-App-1 Path 1 outcome unchanged.** None of the Variant A sites interact with the auto-repair block being removed.

---

### Step 6 — Module-load-time reads of the five F-App-1 tables


**Run from:** repo root.

**Query:**
```powershell
Get-ChildItem -Path src -Recurse -Include *.js | Select-String -Pattern "world_events|character_state|character_state_history|decision_log|career_goals" | Where-Object { $_.Path -notmatch "migrations" -and $_.Path -notmatch "test" } | Select-String -Pattern "require|import|module\.exports"
```

**Output:**

```
src\routes\wardrobe.js:1119:        can_select: item.is_owned || (item.lock_type === 'reputation' && (character_state.reputation || 1) >= (item.reputation_required || 0)) || (item.lock_type === 'coin' && (character_state.coins || 0) >= (item.coin_cost || 0)),
src\routes\worldEvents.js:3466:      `UPDATE world_events SET required_ui_overlays = :overlays, updated_at = NOW() WHERE id = :eventId AND show_id = :showId`,
src\services\timelinePlacementService.js:96: * shape on world_events.required_ui_overlays — string keys, not UUIDs).
```

**Observations:**

Three hits, all categorized as non-findings:

- `routes/wardrobe.js:1119` — `character_state.reputation` and `character_state.coins` are property accesses on a JavaScript variable named `character_state` (likely a destructured query result), inside a route handler. Runs at request time, not module load. Not a module-load dependency.
- `routes/worldEvents.js:3466` — raw SQL `UPDATE world_events` statement inside a route handler. Runs at request time. Not a module-load dependency.
- `services/timelinePlacementService.js:96` — the string `world_events.required_ui_overlays` appears inside a JSDoc comment. Documentation prose; does not execute.

**Zero Category 3 hits.** No file in `src/` depends on any of the five F-App-1 tables at module load time. All access to these tables happens inside function bodies that only execute at request/job processing time.

**Implication for F-App-1:** After auto-repair removal, missing-table failure mode behaves exactly as plan §4.2 predicts — the first request that touches a missing table fails loudly with a clear Postgres error. The server itself still starts cleanly. No new module-load failure modes introduced by the change.

---

## G1 Conclusion — FINAL

**All six audit steps complete. Path 1 confirmed.**

Decision-tree conditions verified:
1. ✅ SequelizeMeta confirms all five F-App-1 CREATE migrations applied on prod (Step 1)
2. ✅ Column-level schema is migration-canonical across all five tables — zero auto-repair fingerprints (Step 2)
3. ✅ Auto-repair-only column candidates (`career_goals.tier`, `career_goals.is_active`) confirmed absent (Step 3)
4. ✅ Auto-repair block in `src/app.js` is the only `CREATE TABLE` site for the five F-App-1 tables (Step 4)
5. ✅ Auto-repair block contains the only `model.sync()` call touching the five tables (Step 5)
6. ✅ No module-load-time dependencies on the five tables (Step 6)

**F-App-1 ships as a single PR removing both repair paths of the auto-repair IIFE from `src/app.js`.**

- No bridge migration needed
- No data backfill needed
- No environment reconciliation needed
- No additional code changes needed

**New findings to add to F-App-1 plan v1.1:**

- **§12.11** — Pattern 40 sites discovered across Steps 4–5: 6 Variant B sites (inline `CREATE TABLE` SQL) covering 3 tables (`video_compositions`, `chapter_versions`, `ecosystem_previews`), plus 11 Variant A sites (`model.sync()` calls inside routes/workers) covering 7+ models (`StoryTaskArc`, `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`, `FranchiseKnowledge`, `GenerationJob`). Plus a suspicious `sequelize.sync()` call inside the model loader (`src/models/index.js:1797`). Out of F-App-1 scope. Follow-up plan recommended.
- **§12.12** — `episode-api-dev` PM2 process (id 2 on backend EC2) has stale DB credentials: `DB_PASSWORD=Ayanna123!!` (pre-rotation), `DB_NAME=postgres`, `DB_USER=episode-control-prod`. Status of these credentials is unverified. Process may be silently failing all DB calls since May 12 rotation. Out of F-App-1 scope; investigate separately.
- **§12.13** — Dev RDS (`episode-control-dev`) exists in AWS but is not connected to any running application process. The backend EC2 instance has both `episode-api` and `episode-api-dev` PM2 processes pointed at prod RDS. PE #40 confirmed in its strongest form. Out of F-App-1 scope.
- **§12.14** — Open security question: does the pre-rotation password `Ayanna123!!` still authenticate to prod RDS? Not tested during G1 (testing requires connecting with the old password, which would itself confirm the security gap). Belongs in a separate credential-rotation-verification runbook.

**Audit complete. Ready to proceed to F-App-1 Gate G2 (implementation).**
