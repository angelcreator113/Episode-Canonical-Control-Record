-- ============================================================================
-- FD-31 PRESERVATION ARTIFACT - episode-control-prod full schema (schema-only)
-- ============================================================================
-- Captured 2026-06-01 via pg_dump --schema-only --no-owner --no-privileges
--   from episode-control-prod (PG 17.6, EMPTY instance, 171 tables, zero rows).
--
-- PURPOSE: Preserves the definitions of the 37 prod-only tables per the FD-31
--   reconciliation canon decision (Reconciliation Pre-Flight Plan Sec 4.3 / 5.2):
--   canon = episode-control-dev; prod-only schemas NOT ported; definitions
--   PRESERVED. This file is that preservation artifact (dump + this file are the
--   two preservation homes the decision requires).
--
-- *** DO NOT RUN THIS FILE. *** It is a parked record, not a migration. It is
--   never applied to any database. Running it would recreate the forked schema
--   the reconciliation deliberately did not port.
--
-- The 37 prod-only tables (in -prod, NOT on canon -dev) per the 2026-05-31 diff:
--   ~28 AI-video-editing feature tables + 9 stragglers (character_profiles,
--   character_clips, decision_logs, user_decisions, episode_phases, show_configs,
--   layout_templates, lala_episode_timeline, lala_friend_archetypes) flagged in
--   Sec 5.2 for classification at the post-audit rebuild (feature-table vs
--   canon-fork). Origin context for 8 of the feature tables also exists as
--   committed code: migrations-node-pg-migrate/20260205000001-add-ai-editing-tables.js
--
-- The other 134 tables are canon tables that also exist on -prod; they are here
--   only because this is a full-instance schema dump. The prod-only 37 are the
--   subject of preservation; the rest are incidental.
-- ============================================================================

--
-- PostgreSQL database dump
--

\restrict JS6PAFSeOmkyV4jEef1bHb3stnquVnJopFTdA50wBxsTrSGQSa6d4UJf7aeFG3y

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Debian 17.10-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: asset_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_category AS ENUM (
    'wardrobe_outfit',
    'wardrobe_accessory',
    'wardrobe_shoes',
    'wardrobe_hairstyle',
    'wardrobe_pose',
    'background',
    'ui_element',
    'prop',
    'overlay',
    'music',
    'sfx'
);


--
-- Name: entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entity_type AS ENUM (
    'character',
    'creator',
    'prop',
    'environment'
);


--
-- Name: enum_FileStorages_file_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_FileStorages_file_type" AS ENUM (
    'video',
    'image',
    'script'
);


--
-- Name: enum_FileStorages_indexing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_FileStorages_indexing_status" AS ENUM (
    'pending',
    'indexed',
    'failed'
);


--
-- Name: enum_FileStorages_upload_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_FileStorages_upload_status" AS ENUM (
    'pending',
    'completed',
    'failed'
);


--
-- Name: enum_activity_logs_actionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_activity_logs_actionType" AS ENUM (
    'view',
    'create',
    'edit',
    'delete',
    'download',
    'upload'
);


--
-- Name: enum_activity_logs_resourceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_activity_logs_resourceType" AS ENUM (
    'episode',
    'thumbnail',
    'metadata',
    'processing'
);


--
-- Name: enum_amber_findings_fix_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_amber_findings_fix_category AS ENUM (
    'code_change',
    'database_cleanup',
    'config_update',
    'content_correction',
    'navigation_fix',
    'style_fix'
);


--
-- Name: enum_amber_findings_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_amber_findings_severity AS ENUM (
    'critical',
    'high',
    'medium',
    'low',
    'info'
);


--
-- Name: enum_amber_findings_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_amber_findings_status AS ENUM (
    'detected',
    'surfaced',
    'approved',
    'dismissed',
    'executing',
    'applied',
    'failed',
    'escalated'
);


--
-- Name: enum_amber_findings_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_amber_findings_type AS ENUM (
    'broken_route',
    'mobile_layout',
    'duplicate_brain_entry',
    'missing_model_registration',
    'unapproved_memory',
    'franchise_law_violation',
    'narrative_gap',
    'database_inconsistency',
    'performance',
    'security',
    'feature_opportunity',
    'other'
);


--
-- Name: enum_amber_scan_runs_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_amber_scan_runs_status AS ENUM (
    'running',
    'completed',
    'failed'
);


--
-- Name: enum_amber_task_queue_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_amber_task_queue_priority AS ENUM (
    'urgent',
    'high',
    'medium',
    'low'
);


--
-- Name: enum_amber_task_queue_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_amber_task_queue_status AS ENUM (
    'backlog',
    'ready',
    'in_progress',
    'done',
    'cancelled'
);


--
-- Name: enum_amber_task_queue_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_amber_task_queue_type AS ENUM (
    'feature',
    'fix',
    'decision',
    'content',
    'research'
);


--
-- Name: enum_arc_function; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_arc_function AS ENUM (
    'arc',
    'fixed',
    'both'
);


--
-- Name: enum_assets_asset_group; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_assets_asset_group AS ENUM (
    'LALA',
    'SHOW',
    'GUEST',
    'EPISODE',
    'WARDROBE'
);


--
-- Name: enum_assets_asset_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_assets_asset_scope AS ENUM (
    'GLOBAL',
    'SHOW',
    'EPISODE'
);


--
-- Name: enum_assets_purpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_assets_purpose AS ENUM (
    'MAIN',
    'TITLE',
    'ICON',
    'BACKGROUND'
);


--
-- Name: enum_audio_clips_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_audio_clips_status AS ENUM (
    'tts',
    'temp_recording',
    'final',
    'needs_replacement'
);


--
-- Name: enum_audio_clips_track_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_audio_clips_track_type AS ENUM (
    'dialogue',
    'ambience',
    'music',
    'sfx',
    'foley'
);


--
-- Name: enum_author_notes_created_by; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_author_notes_created_by AS ENUM (
    'evoni',
    'amber'
);


--
-- Name: enum_author_notes_entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_author_notes_entity_type AS ENUM (
    'feed_profile',
    'character',
    'entanglement',
    'calendar_event',
    'relationship',
    'crossing'
);


--
-- Name: enum_author_notes_note_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_author_notes_note_type AS ENUM (
    'intent',
    'watch',
    'plant',
    'amber_context',
    'private'
);


--
-- Name: enum_beats_beat_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_beats_beat_type AS ENUM (
    'dialogue',
    'ui_action',
    'sfx',
    'music',
    'cta',
    'transition'
);


--
-- Name: enum_beats_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_beats_status AS ENUM (
    'draft',
    'locked',
    'approved'
);


--
-- Name: enum_blind_spot_cat_de; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_blind_spot_cat_de AS ENUM (
    'impact',
    'pattern',
    'motivation',
    'strength',
    'wound'
);


--
-- Name: enum_body_relationship; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_body_relationship AS ENUM (
    'currency',
    'discipline',
    'burden',
    'stranger',
    'home',
    'evidence'
);


--
-- Name: enum_brain_fingerprints_brain_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_brain_fingerprints_brain_type AS ENUM (
    'story',
    'tech',
    'show',
    'voice'
);


--
-- Name: enum_brain_fingerprints_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_brain_fingerprints_status AS ENUM (
    'active',
    'superseded',
    'duplicate_blocked'
);


--
-- Name: enum_calendar_event_attendees_attendee_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_calendar_event_attendees_attendee_type AS ENUM (
    'confirmed',
    'no_show',
    'uninvited_arrival',
    'watched_live',
    'heard_about_it'
);


--
-- Name: enum_calendar_event_ripples_deep_profile_dimension; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_calendar_event_ripples_deep_profile_dimension AS ENUM (
    'ambition',
    'desire',
    'visibility',
    'grief',
    'class',
    'body',
    'habits',
    'belonging'
);


--
-- Name: enum_calendar_event_ripples_ripple_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_calendar_event_ripples_ripple_type AS ENUM (
    'witnessed',
    'heard_secondhand',
    'affected_by_outcome',
    'doesnt_know_yet'
);


--
-- Name: enum_change_capacity_de; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_change_capacity_de AS ENUM (
    'highly_rigid',
    'conditionally_open',
    'cyclically_mobile',
    'highly_fluid',
    'fixed_by_choice'
);


--
-- Name: enum_character_clips_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_clips_role AS ENUM (
    'dialogue',
    'reaction',
    'idle',
    'transition',
    'placeholder'
);


--
-- Name: enum_character_clips_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_clips_status AS ENUM (
    'placeholder',
    'generated',
    'approved',
    'needs_regen'
);


--
-- Name: enum_character_entanglements_dimension; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_entanglements_dimension AS ENUM (
    'ambition_identity',
    'the_body',
    'class_money',
    'religion_meaning',
    'race_culture',
    'sexuality_desire',
    'family_architecture',
    'friendship_loyalty',
    'habits_rituals',
    'speech_silence',
    'grief_loss',
    'politics_justice',
    'the_unseen',
    'life_stage'
);


--
-- Name: enum_character_entanglements_directionality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_entanglements_directionality AS ENUM (
    'character_knows',
    'mutual',
    'neither'
);


--
-- Name: enum_character_entanglements_entanglement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_entanglements_entanglement_type AS ENUM (
    'knows_in_real_life',
    'writes_about',
    'identity_anchor'
);


--
-- Name: enum_character_entanglements_intensity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_entanglements_intensity AS ENUM (
    'peripheral',
    'moderate',
    'significant',
    'identity_anchor'
);


--
-- Name: enum_character_entanglements_want_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_entanglements_want_category AS ENUM (
    'to_become',
    'to_have',
    'to_destroy',
    'to_be_seen_by',
    'to_escape',
    'to_protect',
    'to_understand'
);


--
-- Name: enum_character_growth_log_author_decision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_growth_log_author_decision AS ENUM (
    'accepted',
    'reverted',
    'modified'
);


--
-- Name: enum_character_growth_log_update_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_growth_log_update_type AS ENUM (
    'silent',
    'flagged_contradiction'
);


--
-- Name: enum_character_registries_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_registries_status AS ENUM (
    'draft',
    'active',
    'locked'
);


--
-- Name: enum_character_state_history_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_character_state_history_source AS ENUM (
    'computed',
    'override',
    'manual',
    'wardrobe_purchase',
    'financial'
);


--
-- Name: enum_class_gap_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_class_gap_direction AS ENUM (
    'up',
    'down',
    'stable'
);


--
-- Name: enum_continuity_timelines_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_continuity_timelines_status AS ENUM (
    'draft',
    'active',
    'locked'
);


--
-- Name: enum_entanglement_events_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_entanglement_events_event_type AS ENUM (
    'post',
    'collab',
    'callout',
    'rebrand',
    'scandal',
    'silence',
    'disappearance',
    'state_change'
);


--
-- Name: enum_entanglement_events_new_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_entanglement_events_new_state AS ENUM (
    'rising',
    'peaking',
    'plateauing',
    'controversial',
    'cancelled',
    'reinventing',
    'gone_dark',
    'posthumous'
);


--
-- Name: enum_entanglement_events_previous_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_entanglement_events_previous_state AS ENUM (
    'rising',
    'peaking',
    'plateauing',
    'controversial',
    'cancelled',
    'reinventing',
    'gone_dark',
    'posthumous'
);


--
-- Name: enum_entanglement_unfollows_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_entanglement_unfollows_reason AS ENUM (
    'disillusionment',
    'protection',
    'growth',
    'conflict',
    'drama'
);


--
-- Name: enum_entanglement_unfollows_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_entanglement_unfollows_visibility AS ENUM (
    'public',
    'private',
    'unnoticed'
);


--
-- Name: enum_episode_briefs_designed_intent; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_episode_briefs_designed_intent AS ENUM (
    'slay',
    'pass',
    'safe',
    'fail'
);


--
-- Name: enum_episode_briefs_episode_archetype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_episode_briefs_episode_archetype AS ENUM (
    'Trial',
    'Temptation',
    'Breakdown',
    'Redemption',
    'Showcase',
    'Rising',
    'Pressure',
    'Cliffhanger'
);


--
-- Name: enum_episode_briefs_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_episode_briefs_status AS ENUM (
    'draft',
    'locked'
);


--
-- Name: enum_episode_scenes_scene_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_episode_scenes_scene_type AS ENUM (
    'intro',
    'main',
    'transition',
    'outro'
);


--
-- Name: enum_episode_scenes_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_episode_scenes_type AS ENUM (
    'clip',
    'note'
);


--
-- Name: enum_episode_templates_default_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_episode_templates_default_status AS ENUM (
    'draft',
    'published',
    'archived',
    'pending'
);


--
-- Name: enum_episode_todo_lists_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_episode_todo_lists_status AS ENUM (
    'draft',
    'generated',
    'locked'
);


--
-- Name: enum_episodes_processing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_episodes_processing_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


--
-- Name: enum_feed_profile_relationships_relationship_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_feed_profile_relationships_relationship_type AS ENUM (
    'collab',
    'beef',
    'copy_cat',
    'mentor',
    'public_shade',
    'silent_alliance',
    'former_friends',
    'competitors',
    'orbit'
);


--
-- Name: enum_franchise_knowledge_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_franchise_knowledge_category AS ENUM (
    'character',
    'narrative',
    'locked_decision',
    'franchise_law',
    'technical',
    'brand',
    'world'
);


--
-- Name: enum_franchise_knowledge_extracted_by; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_franchise_knowledge_extracted_by AS ENUM (
    'document_ingestion',
    'conversation_extraction',
    'direct_entry',
    'system'
);


--
-- Name: enum_franchise_knowledge_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_franchise_knowledge_severity AS ENUM (
    'critical',
    'important',
    'context'
);


--
-- Name: enum_franchise_knowledge_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_franchise_knowledge_status AS ENUM (
    'pending_review',
    'active',
    'superseded',
    'archived'
);


--
-- Name: enum_franchise_tech_knowledge_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_franchise_tech_knowledge_category AS ENUM (
    'deployed_system',
    'route_registry',
    'schema',
    'architecture_rule',
    'build_pattern',
    'pending_build',
    'integration'
);


--
-- Name: enum_franchise_tech_knowledge_extracted_by; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_franchise_tech_knowledge_extracted_by AS ENUM (
    'document_ingestion',
    'conversation_extraction',
    'direct_entry',
    'system'
);


--
-- Name: enum_franchise_tech_knowledge_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_franchise_tech_knowledge_severity AS ENUM (
    'critical',
    'important',
    'context'
);


--
-- Name: enum_franchise_tech_knowledge_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_franchise_tech_knowledge_status AS ENUM (
    'active',
    'pending_review',
    'superseded',
    'archived'
);


--
-- Name: enum_generation_jobs_job_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_generation_jobs_job_type AS ENUM (
    'generate_base',
    'generate_angle',
    'regenerate_angle',
    'cascade_regenerate',
    'generate_angle_video'
);


--
-- Name: enum_generation_jobs_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_generation_jobs_status AS ENUM (
    'queued',
    'processing',
    'completed',
    'failed'
);


--
-- Name: enum_joy_threat_response; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_joy_threat_response AS ENUM (
    'fight',
    'grieve',
    'deny'
);


--
-- Name: enum_money_behavior; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_money_behavior AS ENUM (
    'hoarder',
    'compulsive_giver',
    'spend_to_feel',
    'deprivation_guilt',
    'control',
    'performs_wealth',
    'performs_poverty'
);


--
-- Name: enum_money_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_money_class AS ENUM (
    'poverty',
    'working_class',
    'middle_class',
    'upper_middle',
    'wealthy',
    'ultra_wealthy'
);


--
-- Name: enum_multi_product_content_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_multi_product_content_format AS ENUM (
    'instagram_caption',
    'tiktok_concept',
    'howto_lesson',
    'bestie_newsletter',
    'behind_the_scenes'
);


--
-- Name: enum_multi_product_content_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_multi_product_content_status AS ENUM (
    'draft',
    'approved',
    'posted',
    'archived'
);


--
-- Name: enum_operative_cosmology_de; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_operative_cosmology_de AS ENUM (
    'deserving',
    'contractual',
    'indifferent',
    'relational',
    'authored'
);


--
-- Name: enum_processing_queue_job_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_processing_queue_job_type AS ENUM (
    'thumbnail_generation',
    'metadata_extraction',
    'transcription'
);


--
-- Name: enum_processing_queue_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_processing_queue_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


--
-- Name: enum_processing_queues_jobType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_processing_queues_jobType" AS ENUM (
    'thumbnail_generation',
    'metadata_extraction',
    'transcription'
);


--
-- Name: enum_processing_queues_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_processing_queues_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


--
-- Name: enum_registry_characters_appearance_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_appearance_mode AS ENUM (
    'on_page',
    'composite',
    'observed',
    'invisible',
    'brief'
);


--
-- Name: enum_registry_characters_blind_spot_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_blind_spot_category AS ENUM (
    'self_assessment',
    'motivation',
    'impact',
    'pattern',
    'relationship',
    'wound',
    'unknown'
);


--
-- Name: enum_registry_characters_change_capacity_v2; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_change_capacity_v2 AS ENUM (
    'rigid',
    'slow',
    'conditional',
    'fluid',
    'ready',
    'unknown'
);


--
-- Name: enum_registry_characters_class_mobility_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_class_mobility_direction AS ENUM (
    'ascending',
    'descending',
    'stable',
    'volatile',
    'unknown'
);


--
-- Name: enum_registry_characters_class_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_class_origin AS ENUM (
    'poverty',
    'working_class',
    'lower_middle',
    'middle_class',
    'upper_middle',
    'wealthy',
    'old_money',
    'unknown'
);


--
-- Name: enum_registry_characters_current_city; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_current_city AS ENUM (
    'nova_prime',
    'velour_city',
    'the_drift',
    'solenne',
    'cascade_row',
    'outside_lalaverse',
    'unknown'
);


--
-- Name: enum_registry_characters_current_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_current_class AS ENUM (
    'poverty',
    'working_class',
    'lower_middle',
    'middle_class',
    'upper_middle',
    'wealthy',
    'old_money',
    'unknown'
);


--
-- Name: enum_registry_characters_depth_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_depth_level AS ENUM (
    'sparked',
    'breathing',
    'active',
    'alive'
);


--
-- Name: enum_registry_characters_family_structure; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_family_structure AS ENUM (
    'two_parents_intact',
    'single_mother',
    'single_father',
    'raised_by_grandparents',
    'raised_by_other_relatives',
    'blended_family',
    'foster_or_adopted',
    'effectively_alone',
    'unknown'
);


--
-- Name: enum_registry_characters_follower_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_follower_tier AS ENUM (
    'ghost',
    'micro',
    'mid',
    'macro',
    'mega',
    'unknown'
);


--
-- Name: enum_registry_characters_foreclosed_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_foreclosed_category AS ENUM (
    'love',
    'safety',
    'belonging',
    'success',
    'rest',
    'joy',
    'visibility',
    'being_known',
    'being_chosen',
    'starting_over',
    'none',
    'unknown'
);


--
-- Name: enum_registry_characters_joy_accessibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_joy_accessibility AS ENUM (
    'freely_accessible',
    'conditional',
    'buried',
    'forgotten',
    'unknown'
);


--
-- Name: enum_registry_characters_luck_belief; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_luck_belief AS ENUM (
    'merit_based',
    'rigged',
    'divinely_ordered',
    'random',
    'relational',
    'chaotic',
    'unknown'
);


--
-- Name: enum_registry_characters_money_behavior_pattern; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_money_behavior_pattern AS ENUM (
    'hoarder',
    'compulsive_giver',
    'spends_to_feel_powerful',
    'deprives_out_of_guilt',
    'uses_money_to_control',
    'performs_wealth',
    'balanced',
    'unknown'
);


--
-- Name: enum_registry_characters_narrative_gap_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_narrative_gap_type AS ENUM (
    'villain_misidentified',
    'hero_exaggerated',
    'wound_mislocated',
    'cause_reversed',
    'timeline_collapsed',
    'significance_inverted',
    'none_yet',
    'unknown'
);


--
-- Name: enum_registry_characters_operative_cosmology_v2; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_operative_cosmology_v2 AS ENUM (
    'merit_based',
    'rigged',
    'divinely_ordered',
    'random',
    'relational',
    'unknown'
);


--
-- Name: enum_registry_characters_platform_primary; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_platform_primary AS ENUM (
    'lalaverse_main',
    'multi_platform',
    'live_first',
    'archive_heavy',
    'unknown'
);


--
-- Name: enum_registry_characters_relationship_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_relationship_status AS ENUM (
    'single',
    'dating',
    'committed',
    'married',
    'separated',
    'divorced',
    'widowed',
    'complicated',
    'unknown'
);


--
-- Name: enum_registry_characters_role_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_role_type AS ENUM (
    'protagonist',
    'pressure',
    'mirror',
    'support',
    'shadow',
    'special'
);


--
-- Name: enum_registry_characters_sibling_position; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_sibling_position AS ENUM (
    'only_child',
    'oldest',
    'middle',
    'youngest',
    'unknown'
);


--
-- Name: enum_registry_characters_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_status AS ENUM (
    'draft',
    'accepted',
    'declined',
    'finalized'
);


--
-- Name: enum_registry_characters_time_orientation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_time_orientation AS ENUM (
    'past_anchored',
    'future_obsessed',
    'impulsive_present',
    'waiting'
);


--
-- Name: enum_registry_characters_time_orientation_v2; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_registry_characters_time_orientation_v2 AS ENUM (
    'past_anchored',
    'future_focused',
    'present_impulsive',
    'suspended',
    'cyclical',
    'unknown'
);


--
-- Name: enum_scene_angles_depth_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_angles_depth_status AS ENUM (
    'pending',
    'generating',
    'complete',
    'failed'
);


--
-- Name: enum_scene_angles_generation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_angles_generation_status AS ENUM (
    'pending',
    'generating',
    'complete',
    'failed'
);


--
-- Name: enum_scene_footage_links_match_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_footage_links_match_type AS ENUM (
    'auto',
    'manual',
    'suggested'
);


--
-- Name: enum_scene_library_processing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_library_processing_status AS ENUM (
    'uploading',
    'processing',
    'ready',
    'failed'
);


--
-- Name: enum_scene_plans_shot_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_plans_shot_type AS ENUM (
    'establishing',
    'medium',
    'close',
    'tracking',
    'cutaway',
    'transition'
);


--
-- Name: enum_scene_plans_transition_in; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_plans_transition_in AS ENUM (
    'cut',
    'glow',
    'push',
    'wipe',
    'dissolve',
    'none'
);


--
-- Name: enum_scene_proposals_arc_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_proposals_arc_stage AS ENUM (
    'establishment',
    'pressure',
    'crisis',
    'integration'
);


--
-- Name: enum_scene_proposals_scene_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_proposals_scene_type AS ENUM (
    'production_breakdown',
    'creator_study',
    'interior_reckoning',
    'david_mirror',
    'paying_man_pressure',
    'bestie_moment',
    'lala_seed',
    'general'
);


--
-- Name: enum_scene_proposals_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_proposals_status AS ENUM (
    'proposed',
    'adjusted',
    'accepted',
    'dismissed',
    'generated'
);


--
-- Name: enum_scene_proposals_suggested_tone; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_proposals_suggested_tone AS ENUM (
    'longing',
    'tension',
    'sensual',
    'explicit',
    'aftermath'
);


--
-- Name: enum_scene_sets_generation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_sets_generation_status AS ENUM (
    'pending',
    'generating',
    'complete',
    'failed'
);


--
-- Name: enum_scene_sets_scene_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_sets_scene_type AS ENUM (
    'HOME_BASE',
    'CLOSET',
    'EVENT_LOCATION',
    'TRANSITION',
    'OTHER'
);


--
-- Name: enum_scene_sets_status_value; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_scene_sets_status_value AS ENUM (
    'humble',
    'aspirational',
    'elite',
    'intimidating'
);


--
-- Name: enum_shows_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_shows_status AS ENUM (
    'active',
    'archived',
    'cancelled',
    'in_development'
);


--
-- Name: enum_social_profile_relationships_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profile_relationships_direction AS ENUM (
    'mutual',
    'source_to_target',
    'target_to_source'
);


--
-- Name: enum_social_profile_relationships_public_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profile_relationships_public_visibility AS ENUM (
    'public',
    'rumored',
    'hidden'
);


--
-- Name: enum_social_profile_relationships_relationship_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profile_relationships_relationship_type AS ENUM (
    'collab',
    'rival',
    'couple',
    'ex',
    'baby_daddy',
    'baby_mama',
    'bestie',
    'mentor',
    'copycat',
    'shade',
    'situationship',
    'family',
    'management',
    'feud',
    'secret_link'
);


--
-- Name: enum_social_profiles_archetype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_archetype AS ENUM (
    'polished_curator',
    'messy_transparent',
    'soft_life',
    'explicitly_paid',
    'overnight_rise',
    'cautionary',
    'the_peer',
    'the_watcher',
    'chaos_creator',
    'community_builder'
);


--
-- Name: enum_social_profiles_career_pressure; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_career_pressure AS ENUM (
    'ahead',
    'level',
    'behind',
    'different_lane'
);


--
-- Name: enum_social_profiles_city; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_city AS ENUM (
    'nova_prime',
    'velour_city',
    'the_drift',
    'solenne',
    'cascade_row',
    'dazzle_district',
    'radiance_row',
    'echo_park',
    'ascent_tower',
    'maverick_harbor'
);


--
-- Name: enum_social_profiles_current_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_current_state AS ENUM (
    'rising',
    'peaking',
    'plateauing',
    'controversial',
    'cancelled',
    'reinventing',
    'gone_dark',
    'posthumous'
);


--
-- Name: enum_social_profiles_current_trajectory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_current_trajectory AS ENUM (
    'rising',
    'plateauing',
    'unraveling',
    'pivoting',
    'silent',
    'viral_moment'
);


--
-- Name: enum_social_profiles_feed_layer; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_feed_layer AS ENUM (
    'real_world',
    'lalaverse'
);


--
-- Name: enum_social_profiles_follower_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_follower_tier AS ENUM (
    'micro',
    'mid',
    'macro',
    'mega'
);


--
-- Name: enum_social_profiles_justawoman_mirror; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_justawoman_mirror AS ENUM (
    'ambition',
    'desire_unnamed',
    'visibility_wound',
    'grief',
    'class',
    'body',
    'habits',
    'belonging',
    'shadow',
    'integration'
);


--
-- Name: enum_social_profiles_lala_relationship; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_lala_relationship AS ENUM (
    'direct',
    'aware',
    'one_sided',
    'mutual_unaware',
    'competitive',
    'justawoman'
);


--
-- Name: enum_social_profiles_platform; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_platform AS ENUM (
    'tiktok',
    'instagram',
    'youtube',
    'twitter',
    'onlyfans',
    'twitch',
    'substack',
    'multi'
);


--
-- Name: enum_social_profiles_previous_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_previous_state AS ENUM (
    'rising',
    'peaking',
    'plateauing',
    'controversial',
    'cancelled',
    'reinventing',
    'gone_dark',
    'posthumous'
);


--
-- Name: enum_social_profiles_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_status AS ENUM (
    'draft',
    'generated',
    'finalized',
    'crossed',
    'archived'
);


--
-- Name: enum_social_profiles_visibility_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_social_profiles_visibility_tier AS ENUM (
    'public',
    'semi_private',
    'underground'
);


--
-- Name: enum_story_calendar_events_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_story_calendar_events_event_type AS ENUM (
    'world_event',
    'story_event',
    'character_event',
    'lalaverse_cultural'
);


--
-- Name: enum_story_calendar_events_logged_by; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_story_calendar_events_logged_by AS ENUM (
    'evoni',
    'amber',
    'system'
);


--
-- Name: enum_story_calendar_events_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_story_calendar_events_visibility AS ENUM (
    'public',
    'private',
    'underground'
);


--
-- Name: enum_story_texture_conflict_resolution_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_story_texture_conflict_resolution_type AS ENUM (
    'deflected',
    'deferred',
    'exploded',
    'absorbed',
    'weaponized'
);


--
-- Name: enum_story_texture_inner_thought_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_story_texture_inner_thought_type AS ENUM (
    'filed_thought',
    'loud_secret',
    'revision'
);


--
-- Name: enum_story_texture_memory_proposal_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_story_texture_memory_proposal_type AS ENUM (
    'keeps',
    'buries',
    'revises'
);


--
-- Name: enum_story_texture_post_platform; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_story_texture_post_platform AS ENUM (
    'instagram',
    'tiktok',
    'youtube',
    'twitter'
);


--
-- Name: enum_storyteller_books_current_arc_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_storyteller_books_current_arc_stage AS ENUM (
    'establishment',
    'pressure',
    'crisis',
    'integration'
);


--
-- Name: enum_storyteller_books_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_storyteller_books_status AS ENUM (
    'draft',
    'in_review',
    'locked'
);


--
-- Name: enum_storyteller_lines_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_storyteller_lines_status AS ENUM (
    'pending',
    'approved',
    'edited',
    'rejected'
);


--
-- Name: enum_thumbnails_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_thumbnails_format AS ENUM (
    'thumbnail',
    'poster',
    'cover'
);


--
-- Name: enum_thumbnails_mimeType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_thumbnails_mimeType" AS ENUM (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
);


--
-- Name: enum_thumbnails_qualityRating; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_thumbnails_qualityRating" AS ENUM (
    'low',
    'medium',
    'high',
    'excellent'
);


--
-- Name: enum_thumbnails_thumbnailType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_thumbnails_thumbnailType" AS ENUM (
    'primary',
    'cover',
    'poster',
    'frame'
);


--
-- Name: enum_time_orientation_de; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_time_orientation_de AS ENUM (
    'past_anchored',
    'future_oriented',
    'present_impulsive',
    'perpetual_waiter',
    'cyclical'
);


--
-- Name: enum_timeline_placements_attachment_point; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_timeline_placements_attachment_point AS ENUM (
    'scene-start',
    'scene-end',
    'scene-middle',
    'custom'
);


--
-- Name: enum_timeline_placements_placement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_timeline_placements_placement_type AS ENUM (
    'asset',
    'wardrobe',
    'audio'
);


--
-- Name: enum_timeline_placements_visual_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_timeline_placements_visual_role AS ENUM (
    'primary-visual',
    'overlay'
);


--
-- Name: enum_voice_rules_rule_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_voice_rules_rule_type AS ENUM (
    'opening_phrase',
    'closing_phrase',
    'address_pattern',
    'scene_opening',
    'scene_closing',
    'dialogue_pattern',
    'interior_monologue',
    'tonal_constraint',
    'structural_pattern'
);


--
-- Name: enum_voice_rules_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_voice_rules_status AS ENUM (
    'proposed',
    'active',
    'paused',
    'superseded'
);


--
-- Name: enum_voice_signals_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_voice_signals_status AS ENUM (
    'raw',
    'analyzed',
    'grouped',
    'promoted',
    'dismissed'
);


--
-- Name: enum_world_belief; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_world_belief AS ENUM (
    'random',
    'rigged',
    'effort',
    'divine',
    'strategy'
);


--
-- Name: enum_writing_goals_cadence; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_writing_goals_cadence AS ENUM (
    'daily',
    'weekdays',
    '3_per_week',
    'burst'
);


--
-- Name: enum_writing_goals_goal_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_writing_goals_goal_type AS ENUM (
    'daily',
    'weekly',
    'arc_stage',
    'book'
);


--
-- Name: transformation_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transformation_stage AS ENUM (
    'before',
    'during',
    'after',
    'neutral'
);


--
-- Name: calculate_scene_duration(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_scene_duration(scene_uuid uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
         DECLARE
           max_duration DECIMAL(10,2);
         BEGIN
           SELECT MAX(
             COALESCE(
               (sa.metadata->>'trim_end')::DECIMAL,
               a.duration_seconds
             ) - COALESCE(
               (sa.metadata->>'trim_start')::DECIMAL,
               0
             )
           )
           INTO max_duration
           FROM scene_assets sa
           JOIN assets a ON sa.asset_id = a.id
           WHERE sa.scene_id = scene_uuid
             AND sa.role LIKE 'CLIP.%'
             AND a.asset_type = 'video';
           
           RETURN max_duration;
         END;
         $$;


--
-- Name: check_scene_complete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_scene_complete(scene_uuid uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
         BEGIN
           RETURN EXISTS(
             SELECT 1 FROM scene_assets 
             WHERE scene_id = scene_uuid AND role LIKE 'BG.%'
           ) AND EXISTS(
             SELECT 1 FROM scene_assets 
             WHERE scene_id = scene_uuid AND role LIKE 'CLIP.%'
           );
         END;
         $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    "userId" character varying(255) NOT NULL,
    "actionType" public."enum_activity_logs_actionType" NOT NULL,
    "resourceType" public."enum_activity_logs_resourceType" NOT NULL,
    "resourceId" character varying(255) NOT NULL,
    "oldValues" json,
    "newValues" json,
    "ipAddress" character varying(45),
    "userAgent" character varying(512),
    "timestamp" timestamp with time zone
);


--
-- Name: COLUMN activity_logs."userId"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.activity_logs."userId" IS 'Cognito user ID';


--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: ai_edit_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_edit_plans (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    edit_structure jsonb NOT NULL,
    overall_confidence_score numeric(3,2) DEFAULT 0 NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    generated_by character varying(100) DEFAULT 'claude-sonnet-4'::character varying NOT NULL,
    generation_prompt text,
    user_feedback text,
    approved_at timestamp with time zone,
    approved_by character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN ai_edit_plans.edit_structure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_edit_plans.edit_structure IS 'Complete timeline with clips, transitions, layers';


--
-- Name: COLUMN ai_edit_plans.overall_confidence_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_edit_plans.overall_confidence_score IS 'AI confidence 0.00-1.00';


--
-- Name: COLUMN ai_edit_plans.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_edit_plans.status IS 'draft | awaiting_approval | approved | rejected';


--
-- Name: COLUMN ai_edit_plans.generation_prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_edit_plans.generation_prompt IS 'Prompt used to generate this plan';


--
-- Name: COLUMN ai_edit_plans.user_feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_edit_plans.user_feedback IS 'User feedback if rejected';


--
-- Name: ai_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_interactions (
    id uuid NOT NULL,
    episode_id uuid,
    character_id uuid,
    trigger_time numeric(10,3),
    interaction_type character varying(50),
    ai_dialogue text,
    visual_treatment character varying(50),
    voice_sample_id uuid,
    created_at timestamp with time zone
);


--
-- Name: COLUMN ai_interactions.character_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_interactions.character_id IS 'The AI character (e.g., Lala)';


--
-- Name: COLUMN ai_interactions.trigger_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_interactions.trigger_time IS 'When does AI activate';


--
-- Name: COLUMN ai_interactions.interaction_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_interactions.interaction_type IS 'advice, challenge, feedback, system_message';


--
-- Name: COLUMN ai_interactions.ai_dialogue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_interactions.ai_dialogue IS 'What AI says (can be text-to-speech)';


--
-- Name: COLUMN ai_interactions.visual_treatment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_interactions.visual_treatment IS 'hologram, screen_overlay, avatar, voice_only';


--
-- Name: COLUMN ai_interactions.voice_sample_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_interactions.voice_sample_id IS 'Pre-recorded or synthesized voice';


--
-- Name: ai_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_revisions (
    id uuid NOT NULL,
    original_plan_id uuid NOT NULL,
    revision_number integer NOT NULL,
    feedback_type character varying(100) NOT NULL,
    user_feedback_text text NOT NULL,
    revised_plan jsonb NOT NULL,
    confidence_score_before numeric(3,2) NOT NULL,
    confidence_score_after numeric(3,2) NOT NULL,
    changes_summary text,
    created_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN ai_revisions.revision_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_revisions.revision_number IS 'Incremental revision number (1, 2, 3)';


--
-- Name: COLUMN ai_revisions.feedback_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_revisions.feedback_type IS 'pacing_too_slow | transitions_jarring | wrong_clips | etc.';


--
-- Name: COLUMN ai_revisions.revised_plan; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_revisions.revised_plan IS 'New edit structure based on feedback';


--
-- Name: COLUMN ai_revisions.changes_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_revisions.changes_summary IS 'AI explanation of what changed';


--
-- Name: ai_training_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_training_data (
    id uuid NOT NULL,
    video_id character varying(255) NOT NULL,
    source_type character varying(50) NOT NULL,
    video_title character varying(500),
    video_url text,
    s3_key character varying(500),
    duration_seconds integer,
    avg_clip_duration numeric(5,2),
    total_clips integer,
    pacing_rhythm character varying(50),
    transition_patterns jsonb,
    overlay_usage jsonb,
    text_style jsonb,
    music_presence boolean DEFAULT false,
    is_user_style boolean DEFAULT false NOT NULL,
    analyzed_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN ai_training_data.video_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.video_id IS 'YouTube video ID or internal identifier';


--
-- Name: COLUMN ai_training_data.source_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.source_type IS 'youtube_user | youtube_inspiration | manual_upload';


--
-- Name: COLUMN ai_training_data.s3_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.s3_key IS 'S3 key if downloaded';


--
-- Name: COLUMN ai_training_data.avg_clip_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.avg_clip_duration IS 'Average clip duration in seconds';


--
-- Name: COLUMN ai_training_data.pacing_rhythm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.pacing_rhythm IS 'fast | medium | slow | dynamic';


--
-- Name: COLUMN ai_training_data.transition_patterns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.transition_patterns IS 'Cut, dissolve, wipe frequencies';


--
-- Name: COLUMN ai_training_data.overlay_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.overlay_usage IS 'How overlays are used';


--
-- Name: COLUMN ai_training_data.text_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.text_style IS 'Font, size, animation patterns';


--
-- Name: COLUMN ai_training_data.is_user_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_training_data.is_user_style IS 'Is this the user''s own content?';


--
-- Name: ai_usage_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_logs (
    id integer NOT NULL,
    route_name character varying(200),
    model_name character varying(100) NOT NULL,
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    cache_creation_input_tokens integer DEFAULT 0,
    cache_read_input_tokens integer DEFAULT 0,
    cost_usd numeric(10,6) DEFAULT 0,
    duration_ms integer,
    is_error boolean DEFAULT false,
    error_type character varying(100),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_usage_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_usage_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_usage_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_usage_logs_id_seq OWNED BY public.ai_usage_logs.id;


--
-- Name: amber_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amber_findings (
    id uuid NOT NULL,
    type public.enum_amber_findings_type NOT NULL,
    severity public.enum_amber_findings_severity DEFAULT 'medium'::public.enum_amber_findings_severity NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    evidence text,
    affected_file character varying(500),
    affected_route character varying(500),
    affected_table character varying(200),
    affected_page character varying(200),
    proposed_fix text,
    proposed_diff text,
    fix_confidence integer,
    fix_category public.enum_amber_findings_fix_category,
    auto_approve_eligible boolean DEFAULT false NOT NULL,
    auto_approve_category character varying(100),
    status public.enum_amber_findings_status DEFAULT 'detected'::public.enum_amber_findings_status NOT NULL,
    execution_log text,
    execution_result jsonb,
    applied_at timestamp with time zone,
    applied_diff text,
    amber_verdict text,
    surfaced_in_chat boolean DEFAULT false,
    urgent boolean DEFAULT false,
    detected_by character varying(100) DEFAULT 'diagnostic_scan'::character varying,
    scan_run_id uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN amber_findings.auto_approve_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.amber_findings.auto_approve_category IS 'Category slug for Level 2 auto-approve when unlocked';


--
-- Name: amber_scan_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amber_scan_runs (
    id uuid NOT NULL,
    trigger character varying(100) NOT NULL,
    status public.enum_amber_scan_runs_status DEFAULT 'running'::public.enum_amber_scan_runs_status,
    findings_count integer DEFAULT 0,
    critical_count integer DEFAULT 0,
    checks_run jsonb,
    duration_ms integer,
    error text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: amber_task_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amber_task_queue (
    id uuid NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    type public.enum_amber_task_queue_type DEFAULT 'feature'::public.enum_amber_task_queue_type,
    priority public.enum_amber_task_queue_priority DEFAULT 'medium'::public.enum_amber_task_queue_priority,
    status public.enum_amber_task_queue_status DEFAULT 'backlog'::public.enum_amber_task_queue_status,
    source character varying(200),
    linked_finding_id uuid,
    spec text,
    spec_approved boolean DEFAULT false,
    amber_notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: asset_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_labels (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7) DEFAULT '#6366f1'::character varying NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: asset_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_roles (
    id uuid NOT NULL,
    show_id uuid,
    role_key character varying(100) NOT NULL,
    role_label character varying(255) NOT NULL,
    category character varying(100),
    icon character varying(50),
    color character varying(20),
    is_required boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    description text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN asset_roles.role_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_roles.role_key IS 'Immutable identifier (HOST, GUEST_1, etc.)';


--
-- Name: COLUMN asset_roles.role_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_roles.role_label IS 'Editable display name';


--
-- Name: COLUMN asset_roles.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_roles.category IS 'Characters, UI Icons, UI Chrome, Branding, Background';


--
-- Name: COLUMN asset_roles.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_roles.icon IS 'Emoji or icon code for UI display';


--
-- Name: COLUMN asset_roles.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_roles.color IS 'Hex color for UI display';


--
-- Name: COLUMN asset_roles.is_required; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_roles.is_required IS 'Must be filled for composer export';


--
-- Name: asset_usage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_usage_log (
    id uuid NOT NULL,
    asset_id uuid NOT NULL,
    episode_id uuid,
    scene_id uuid,
    context character varying(100),
    used_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN asset_usage_log.context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.asset_usage_log.context IS 'Usage context: scene_background, scene_character, timeline_overlay, etc.';


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid NOT NULL,
    asset_type character varying(100) NOT NULL,
    asset_role character varying(255),
    asset_group public.enum_assets_asset_group,
    asset_scope public.enum_assets_asset_scope DEFAULT 'GLOBAL'::public.enum_assets_asset_scope,
    show_id uuid,
    episode_id uuid,
    purpose public.enum_assets_purpose,
    allowed_uses text[] DEFAULT ARRAY[]::text[],
    is_global boolean DEFAULT false NOT NULL,
    name character varying(255),
    s3_url_raw text,
    s3_url_processed text,
    s3_key_raw text,
    file_name character varying(500),
    content_type character varying(100),
    media_type character varying(100),
    width integer,
    height integer,
    file_size_bytes integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    category character varying(50),
    entity_type character varying(50),
    character_name character varying(100),
    outfit_name character varying(255),
    outfit_era character varying(100),
    transformation_stage character varying(50),
    first_used_episode_id uuid,
    usage_count integer DEFAULT 0,
    color_palette jsonb,
    mood_tags text[],
    location_name character varying(255),
    location_version integer,
    introduced_episode_id uuid,
    active_from_episode integer,
    active_to_episode integer,
    file_hash character varying(64),
    approval_status character varying(50)
);


--
-- Name: COLUMN assets.asset_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.asset_type IS 'Legacy type field - kept for backward compatibility';


--
-- Name: COLUMN assets.asset_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.asset_role IS 'Canonical role - hierarchical (e.g., CHAR.HOST.LALA, UI.ICON.CLOSET)';


--
-- Name: COLUMN assets.asset_group; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.asset_group IS 'Identity bucket - which brand/entity this asset belongs to';


--
-- Name: COLUMN assets.asset_scope; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.asset_scope IS 'Scope of asset availability - GLOBAL, SHOW, or EPISODE';


--
-- Name: COLUMN assets.show_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.show_id IS 'Show ID if asset_scope is SHOW';


--
-- Name: COLUMN assets.episode_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.episode_id IS 'Episode ID if asset_scope is EPISODE';


--
-- Name: COLUMN assets.purpose; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.purpose IS 'Category - what kind of asset this is';


--
-- Name: COLUMN assets.allowed_uses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.allowed_uses IS 'What this asset CAN be used for';


--
-- Name: COLUMN assets.is_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.is_global IS 'Available globally vs scoped to show/episode';


--
-- Name: COLUMN assets.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.deleted_at IS 'Soft delete timestamp';


--
-- Name: COLUMN assets.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assets.category IS 'Asset category: background, raw_footage, wardrobe, prop, graphic, text, audio, b_roll';


--
-- Name: audio_clips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio_clips (
    id uuid NOT NULL,
    scene_id uuid NOT NULL,
    beat_id uuid,
    track_type public.enum_audio_clips_track_type NOT NULL,
    start_time double precision NOT NULL,
    duration double precision NOT NULL,
    url text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    status public.enum_audio_clips_status DEFAULT 'tts'::public.enum_audio_clips_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE audio_clips; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audio_clips IS 'Audio tracks: dialogue (TTSâ†’VO), ambience, music, SFX';


--
-- Name: COLUMN audio_clips.scene_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_clips.scene_id IS 'Scene this audio clip belongs to';


--
-- Name: COLUMN audio_clips.beat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_clips.beat_id IS 'Optional link to dialogue beat';


--
-- Name: COLUMN audio_clips.track_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_clips.track_type IS 'Track type: dialogue, ambience, music, sfx, foley';


--
-- Name: COLUMN audio_clips.start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_clips.start_time IS 'Scene-relative start time in seconds';


--
-- Name: COLUMN audio_clips.duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_clips.duration IS 'Duration in seconds';


--
-- Name: COLUMN audio_clips.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_clips.url IS 'S3 URL to audio file';


--
-- Name: COLUMN audio_clips.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_clips.metadata IS 'Flexible JSONB: {volume, source, voice, fade_in, fade_out, waveform_data}';


--
-- Name: COLUMN audio_clips.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audio_clips.status IS 'Audio status: tts, temp_recording, final, needs_replacement';


--
-- Name: author_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.author_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type public.enum_author_notes_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    note_text text NOT NULL,
    note_type public.enum_author_notes_note_type NOT NULL,
    visible_to_amber boolean DEFAULT true,
    created_by public.enum_author_notes_created_by NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN author_notes.entity_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.author_notes.entity_id IS 'Polymorphic; no DB-level FK constraint; enforce in application layer';


--
-- Name: beats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beats (
    id uuid NOT NULL,
    scene_id uuid NOT NULL,
    beat_type public.enum_beats_beat_type NOT NULL,
    character_id uuid,
    label character varying(500) NOT NULL,
    start_time double precision NOT NULL,
    duration double precision NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    status public.enum_beats_status DEFAULT 'draft'::public.enum_beats_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE beats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.beats IS 'Auto-generated timing beats linking script to timeline';


--
-- Name: COLUMN beats.scene_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beats.scene_id IS 'Scene this beat belongs to';


--
-- Name: COLUMN beats.beat_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beats.beat_type IS 'Type of beat: dialogue, ui_action, sfx, music, cta, transition';


--
-- Name: COLUMN beats.character_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beats.character_id IS 'Optional character reference (can link to character_profiles)';


--
-- Name: COLUMN beats.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beats.label IS 'Human-readable label: "LaLa asks question", "Subscribe CTA"';


--
-- Name: COLUMN beats.start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beats.start_time IS 'Scene-relative start time in seconds';


--
-- Name: COLUMN beats.duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beats.duration IS 'Duration in seconds';


--
-- Name: COLUMN beats.payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beats.payload IS 'Flexible JSONB: {line, emotion, script_line_id, notes}';


--
-- Name: COLUMN beats.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beats.status IS 'Beat status: draft, locked, approved';


--
-- Name: book_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_series (
    id uuid NOT NULL,
    universe_id uuid NOT NULL,
    show_id uuid,
    name character varying(255) NOT NULL,
    description text,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    protagonist_id uuid
);


--
-- Name: COLUMN book_series.show_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.book_series.show_id IS 'Optional â€” series may expand a specific show';


--
-- Name: COLUMN book_series.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.book_series.name IS 'e.g. Becoming Prime';


--
-- Name: COLUMN book_series.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.book_series.description IS 'What story does this series tell? Emotional focus, timeline.';


--
-- Name: COLUMN book_series.order_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.book_series.order_index IS 'Order within the universe';


--
-- Name: COLUMN book_series.protagonist_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.book_series.protagonist_id IS 'Who this series follows. Series 1 = JustAWoman. Series 2 = Lala.';


--
-- Name: brain_fingerprints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_fingerprints (
    id integer NOT NULL,
    brain_type public.enum_brain_fingerprints_brain_type NOT NULL,
    series_id integer,
    entry_id integer NOT NULL,
    content_hash character varying(64) NOT NULL,
    title_hash character varying(64),
    source_document character varying(200),
    source_version character varying(20),
    status public.enum_brain_fingerprints_status DEFAULT 'active'::public.enum_brain_fingerprints_status,
    superseded_by integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: brain_fingerprints_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brain_fingerprints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brain_fingerprints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brain_fingerprints_id_seq OWNED BY public.brain_fingerprints.id;


--
-- Name: bulk_import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_import_jobs (
    id integer NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    completed integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    candidates jsonb DEFAULT '[]'::jsonb NOT NULL,
    results jsonb DEFAULT '[]'::jsonb NOT NULL,
    character_context jsonb,
    character_key character varying(100),
    series_id integer,
    error_message text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: COLUMN bulk_import_jobs.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bulk_import_jobs.status IS 'pending | processing | completed | failed';


--
-- Name: COLUMN bulk_import_jobs.candidates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bulk_import_jobs.candidates IS 'Array of { handle, platform, vibe_sentence } objects';


--
-- Name: COLUMN bulk_import_jobs.results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bulk_import_jobs.results IS 'Array of { handle, platform, status, profile_id, error } results';


--
-- Name: COLUMN bulk_import_jobs.character_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bulk_import_jobs.character_context IS 'Protagonist context used for generation';


--
-- Name: COLUMN bulk_import_jobs.character_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bulk_import_jobs.character_key IS 'Which protagonist initiated this import';


--
-- Name: bulk_import_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bulk_import_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bulk_import_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bulk_import_jobs_id_seq OWNED BY public.bulk_import_jobs.id;


--
-- Name: calendar_event_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_event_attendees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    character_id uuid,
    feed_profile_id uuid,
    attendee_type public.enum_calendar_event_attendees_attendee_type NOT NULL,
    knew_about_event_before boolean,
    left_early boolean DEFAULT false,
    what_they_experienced text,
    author_note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN calendar_event_attendees.feed_profile_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calendar_event_attendees.feed_profile_id IS 'FK to social_profiles; UUID reference for polymorphic lookup';


--
-- Name: calendar_event_ripples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_event_ripples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    affected_character_id uuid,
    affected_feed_profile_id uuid,
    ripple_type public.enum_calendar_event_ripples_ripple_type NOT NULL,
    deep_profile_dimension public.enum_calendar_event_ripples_deep_profile_dimension,
    intensity integer,
    proposed_thread text,
    thread_confirmed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN calendar_event_ripples.intensity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calendar_event_ripples.intensity IS '1â€“10 scale';


--
-- Name: COLUMN calendar_event_ripples.proposed_thread; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calendar_event_ripples.proposed_thread IS 'Amber generates via Claude. 2â€“3 sentence story thread.';


--
-- Name: COLUMN calendar_event_ripples.thread_confirmed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calendar_event_ripples.thread_confirmed IS 'Evoni must confirm before canon';


--
-- Name: career_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_goals (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    season_id uuid,
    title character varying(200) NOT NULL,
    description text,
    type character varying(20) DEFAULT 'secondary'::character varying NOT NULL,
    target_metric character varying(50) NOT NULL,
    target_value double precision DEFAULT '0'::double precision NOT NULL,
    current_value double precision DEFAULT '0'::double precision NOT NULL,
    starting_value double precision,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    priority integer DEFAULT 3,
    unlocks_on_complete jsonb DEFAULT '[]'::jsonb,
    fail_consequence text,
    arc_id uuid,
    episode_range jsonb,
    icon character varying(10) DEFAULT 'ðŸŽ¯'::character varying,
    color character varying(20) DEFAULT '#6366f1'::character varying,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN career_goals.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.career_goals.type IS 'primary | secondary | passive';


--
-- Name: COLUMN career_goals.target_metric; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.career_goals.target_metric IS 'coins, reputation, followers, brand_trust, influence, engagement_rate, portfolio_strength, consistency_streak, custom';


--
-- Name: COLUMN career_goals.starting_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.career_goals.starting_value IS 'Value when goal was created â€” for progress calculation';


--
-- Name: COLUMN career_goals.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.career_goals.status IS 'active | completed | failed | paused | abandoned';


--
-- Name: COLUMN career_goals.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.career_goals.priority IS '1=highest, 5=lowest';


--
-- Name: COLUMN career_goals.unlocks_on_complete; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.career_goals.unlocks_on_complete IS '["maison_belle_contract","luxury_closet_upgrade"]';


--
-- Name: COLUMN career_goals.episode_range; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.career_goals.episode_range IS '{"start":1,"end":6}';


--
-- Name: character_arcs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_arcs (
    id uuid NOT NULL,
    character_key character varying(100) NOT NULL,
    registry_id uuid,
    wound_clock integer DEFAULT 75 NOT NULL,
    stakes_level integer DEFAULT 1 NOT NULL,
    visibility_score integer DEFAULT 20 NOT NULL,
    david_silence_counter integer DEFAULT 0 NOT NULL,
    phone_appearances integer DEFAULT 0 NOT NULL,
    bleed_generated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN character_arcs.wound_clock; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_arcs.wound_clock IS 'Starts at 75 â€” she has been trying for years before Book 1.';


--
-- Name: COLUMN character_arcs.stakes_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_arcs.stakes_level IS '1-10. Escalates across the arc. Injected into generation prompts.';


--
-- Name: COLUMN character_arcs.visibility_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_arcs.visibility_score IS '0-100. How seen she feels at this arc position.';


--
-- Name: COLUMN character_arcs.david_silence_counter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_arcs.david_silence_counter IS 'Increments when JustAWoman has an intimate or charged moment with someone other than David.';


--
-- Name: COLUMN character_arcs.phone_appearances; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_arcs.phone_appearances IS 'Tracks how many times the recurring object (her phone) has appeared. Weight increases per appearance.';


--
-- Name: character_clips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_clips (
    id uuid NOT NULL,
    scene_id uuid NOT NULL,
    character_id uuid NOT NULL,
    beat_id uuid,
    role public.enum_character_clips_role NOT NULL,
    start_time double precision NOT NULL,
    duration double precision NOT NULL,
    video_url text,
    expression character varying(100),
    animation_type character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb,
    status public.enum_character_clips_status DEFAULT 'placeholder'::public.enum_character_clips_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE character_clips; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.character_clips IS 'Video clips for each character, enabling per-character editing';


--
-- Name: COLUMN character_clips.scene_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.scene_id IS 'Scene this clip belongs to';


--
-- Name: COLUMN character_clips.character_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.character_id IS 'Character ID (can link to character_profiles)';


--
-- Name: COLUMN character_clips.beat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.beat_id IS 'Optional link to script beat';


--
-- Name: COLUMN character_clips.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.role IS 'Clip role: dialogue (speaking), reaction (responding), idle (listening), transition (movement), placeholder';


--
-- Name: COLUMN character_clips.start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.start_time IS 'Scene-relative start time in seconds';


--
-- Name: COLUMN character_clips.duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.duration IS 'Duration in seconds';


--
-- Name: COLUMN character_clips.video_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.video_url IS 'S3 URL to video clip (NULL for placeholders)';


--
-- Name: COLUMN character_clips.expression; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.expression IS 'Expression: interested, skeptical, amused, neutral, excited';


--
-- Name: COLUMN character_clips.animation_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.animation_type IS 'For idle clips: listening, thinking, reacting';


--
-- Name: COLUMN character_clips.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.metadata IS 'Flexible JSONB: {trim_in, hold_frames, effects, generation_params}';


--
-- Name: COLUMN character_clips.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_clips.status IS 'Clip status: placeholder, generated, approved, needs_regen';


--
-- Name: character_crossings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_crossings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    crossing_date uuid,
    calendar_event_id uuid,
    trigger text,
    initial_feed_state character varying(100),
    performance_gap_score integer,
    gap_proposed_by_amber text,
    gap_confirmed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN character_crossings.crossing_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_crossings.crossing_date IS 'Story position at time of crossing';


--
-- Name: COLUMN character_crossings.trigger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_crossings.trigger IS 'What caused them to go public';


--
-- Name: COLUMN character_crossings.initial_feed_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_crossings.initial_feed_state IS 'Their public persona at time of crossing';


--
-- Name: COLUMN character_crossings.performance_gap_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_crossings.performance_gap_score IS '0â€“100; Amber proposes, Evoni confirms';


--
-- Name: COLUMN character_crossings.gap_proposed_by_amber; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_crossings.gap_proposed_by_amber IS 'Amber''s reasoning paragraph';


--
-- Name: character_entanglements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_entanglements (
    id uuid NOT NULL,
    character_id uuid NOT NULL,
    profile_id integer NOT NULL,
    dimension public.enum_character_entanglements_dimension NOT NULL,
    intensity public.enum_character_entanglements_intensity DEFAULT 'peripheral'::public.enum_character_entanglements_intensity NOT NULL,
    directionality public.enum_character_entanglements_directionality DEFAULT 'character_knows'::public.enum_character_entanglements_directionality NOT NULL,
    entanglement_type public.enum_character_entanglements_entanglement_type NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    turbulence_flag boolean DEFAULT false NOT NULL,
    turbulence_reason text,
    amber_proposed boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    what_they_want text,
    want_category public.enum_character_entanglements_want_category
);


--
-- Name: COLUMN character_entanglements.what_they_want; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_entanglements.what_they_want IS 'Freeform; author-written or Amber-proposed';


--
-- Name: character_follow_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_follow_profiles (
    id integer NOT NULL,
    character_key character varying(100) NOT NULL,
    character_name character varying(200) NOT NULL,
    registry_character_id uuid,
    category_affinity jsonb DEFAULT '{}'::jsonb NOT NULL,
    archetype_affinity jsonb DEFAULT '{}'::jsonb NOT NULL,
    motivation_weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    drama_bonus double precision DEFAULT '0.05'::double precision NOT NULL,
    adult_penalty double precision DEFAULT '-0.1'::double precision NOT NULL,
    same_platform_bonus jsonb DEFAULT '{}'::jsonb NOT NULL,
    follower_tier_affinity jsonb DEFAULT '{"mid": 0.7, "mega": 0.65, "macro": 0.75, "micro": 0.6}'::jsonb NOT NULL,
    base_follow_threshold double precision DEFAULT '0.35'::double precision NOT NULL,
    consumption_style character varying(50),
    consumption_context text,
    has_social_presence boolean DEFAULT false NOT NULL,
    generated_from_dna boolean DEFAULT false NOT NULL,
    generation_reasoning text,
    hand_tuned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN character_follow_profiles.character_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.character_key IS 'Matches registry_characters.character_key';


--
-- Name: COLUMN character_follow_profiles.category_affinity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.category_affinity IS 'Content category weights 0-1: { fashion: 0.8, drama: 0.9, ... }';


--
-- Name: COLUMN character_follow_profiles.archetype_affinity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.archetype_affinity IS 'Creator archetype weights 0-1: { polished_curator: 0.7, chaos_creator: 0.3, ... }';


--
-- Name: COLUMN character_follow_profiles.motivation_weights; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.motivation_weights IS 'Follow motivation weights: { identity, aspiration, entertainment, information, parasocial }';


--
-- Name: COLUMN character_follow_profiles.drama_bonus; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.drama_bonus IS 'How much drama pulls them in beyond their baseline';


--
-- Name: COLUMN character_follow_profiles.adult_penalty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.adult_penalty IS 'Adjustment for adult content (negative = avoids, near-zero = unfazed)';


--
-- Name: COLUMN character_follow_profiles.same_platform_bonus; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.same_platform_bonus IS 'Platform preference boosts: { instagram: 0.08, tiktok: 0.05, ... }';


--
-- Name: COLUMN character_follow_profiles.follower_tier_affinity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.follower_tier_affinity IS 'Preference for creator size: { micro, mid, macro, mega }';


--
-- Name: COLUMN character_follow_profiles.base_follow_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.base_follow_threshold IS 'Minimum probability score to auto-follow (0-1)';


--
-- Name: COLUMN character_follow_profiles.consumption_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.consumption_style IS 'How they consume: late_night_scroller, passive_observer, active_engager, hate_watcher, study_mode, share_with_friends';


--
-- Name: COLUMN character_follow_profiles.consumption_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.consumption_context IS 'Narrative description of how/when they consume content';


--
-- Name: COLUMN character_follow_profiles.has_social_presence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.has_social_presence IS 'Whether this character posts/creates (vs just consumes)';


--
-- Name: COLUMN character_follow_profiles.generated_from_dna; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.generated_from_dna IS 'Whether this profile was AI-generated from character DNA';


--
-- Name: COLUMN character_follow_profiles.generation_reasoning; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.generation_reasoning IS 'Claude reasoning for why these affinities were chosen';


--
-- Name: COLUMN character_follow_profiles.hand_tuned; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_follow_profiles.hand_tuned IS 'Whether the author has manually adjusted any weights';


--
-- Name: character_follow_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.character_follow_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: character_follow_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.character_follow_profiles_id_seq OWNED BY public.character_follow_profiles.id;


--
-- Name: character_growth_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_growth_log (
    id integer NOT NULL,
    character_id uuid NOT NULL,
    story_id uuid,
    scene_proposal_id integer,
    field_updated character varying(120) NOT NULL,
    previous_value text,
    new_value text NOT NULL,
    update_type public.enum_character_growth_log_update_type DEFAULT 'silent'::public.enum_character_growth_log_update_type,
    growth_source text,
    author_reviewed boolean DEFAULT false,
    author_decision public.enum_character_growth_log_author_decision,
    author_note text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN character_growth_log.story_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_growth_log.story_id IS 'The story that triggered this growth update';


--
-- Name: COLUMN character_growth_log.update_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_growth_log.update_type IS 'silent = applied automatically | flagged = author must review';


--
-- Name: COLUMN character_growth_log.growth_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_growth_log.growth_source IS 'What in the scene triggered this growth â€” specific revelation or behavior';


--
-- Name: character_growth_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.character_growth_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: character_growth_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.character_growth_log_id_seq OWNED BY public.character_growth_log.id;


--
-- Name: character_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_profiles (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    character_name character varying(255) NOT NULL,
    editing_style jsonb DEFAULT '{"pacing": "medium", "cut_on_breath": false, "cut_on_emphasis": true, "overlay_behavior": "minimal", "preferred_framing": "medium", "reaction_frequency": 0.5}'::jsonb,
    voice_embedding jsonb,
    face_embeddings jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN character_profiles.editing_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_profiles.editing_style IS 'Per-character editing style preferences';


--
-- Name: COLUMN character_profiles.voice_embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_profiles.voice_embedding IS 'Voice signature for diarization';


--
-- Name: COLUMN character_profiles.face_embeddings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_profiles.face_embeddings IS 'Face signatures for recognition';


--
-- Name: character_registries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_registries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid,
    title character varying(255) NOT NULL,
    book_tag character varying(100),
    description text,
    core_rule text,
    status public.enum_character_registries_status DEFAULT 'draft'::public.enum_character_registries_status,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN character_registries.book_tag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_registries.book_tag IS 'e.g. "Book 1 Â· Before Lala"';


--
-- Name: COLUMN character_registries.core_rule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_registries.core_rule IS 'Guiding principle displayed at bottom of overview';


--
-- Name: character_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_relationships (
    id uuid NOT NULL,
    show_id uuid,
    book_id uuid,
    layer character varying(20) DEFAULT 'real_world'::character varying NOT NULL,
    source_name character varying(120) NOT NULL,
    target_name character varying(120) NOT NULL,
    relationship_type character varying(40) DEFAULT 'knows'::character varying NOT NULL,
    direction character varying(10) DEFAULT 'both'::character varying NOT NULL,
    label character varying(60),
    subtext character varying(200),
    source_knows text,
    target_knows text,
    reader_knows text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    appears_in jsonb DEFAULT '[]'::jsonb,
    intensity integer DEFAULT 3 NOT NULL,
    notes text,
    source_x double precision DEFAULT '0'::double precision,
    source_y double precision DEFAULT '0'::double precision,
    target_x double precision DEFAULT '0'::double precision,
    target_y double precision DEFAULT '0'::double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    family_role character varying(120) DEFAULT NULL::character varying,
    is_blood_relation boolean DEFAULT false NOT NULL,
    is_romantic boolean DEFAULT false NOT NULL,
    conflict_summary text,
    knows_about_connection boolean DEFAULT false NOT NULL,
    situation text,
    tension_state character varying(80),
    pain_point_category character varying(100),
    lala_mirror text,
    career_echo_potential text,
    confirmed boolean DEFAULT true NOT NULL,
    role_tag character varying(50) DEFAULT NULL::character varying,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN character_relationships.layer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.layer IS 'real_world | lalaverse';


--
-- Name: COLUMN character_relationships.direction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.direction IS 'both | source_to_target | target_to_source';


--
-- Name: COLUMN character_relationships.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.status IS 'active | dormant | broken | secret';


--
-- Name: COLUMN character_relationships.appears_in; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.appears_in IS 'Array of chapter slugs / scene ids';


--
-- Name: COLUMN character_relationships.intensity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.intensity IS '1-5 emotional weight';


--
-- Name: COLUMN character_relationships.family_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.family_role IS 'mother | father | sister | brother | aunt | uncle | cousin | grandmother | etc.';


--
-- Name: COLUMN character_relationships.is_blood_relation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.is_blood_relation IS 'true = biological family. false = found family, step, or chosen.';


--
-- Name: COLUMN character_relationships.is_romantic; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.is_romantic IS 'Explicit romantic flag â€” enables filtering independent of relationship_type label.';


--
-- Name: COLUMN character_relationships.conflict_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.conflict_summary IS 'The conflict between character A and character B â€” independent of Lala.';


--
-- Name: COLUMN character_relationships.knows_about_connection; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.knows_about_connection IS 'Does character B know about character A''s connection to Lala / JustAWoman?';


--
-- Name: COLUMN character_relationships.role_tag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_relationships.role_tag IS 'ally | detractor | mentor | dependency | rival | partner | family | neutral';


--
-- Name: character_sparks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_sparks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    desire_line text NOT NULL,
    wound text NOT NULL,
    prefill_result jsonb,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    registry_character_id uuid,
    registry_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN character_sparks.desire_line; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_sparks.desire_line IS 'What they want â€” one sentence';


--
-- Name: COLUMN character_sparks.wound; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_sparks.wound IS 'What broke them â€” one sentence';


--
-- Name: COLUMN character_sparks.prefill_result; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_sparks.prefill_result IS 'Claude Opus 4.5 pre-fill expansion (full character DNA)';


--
-- Name: COLUMN character_sparks.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_sparks.status IS 'draft | prefilled | committed';


--
-- Name: COLUMN character_sparks.registry_character_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_sparks.registry_character_id IS 'Links to registry_characters once committed';


--
-- Name: COLUMN character_sparks.registry_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_sparks.registry_id IS 'Target character registry';


--
-- Name: character_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_state (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    season_id uuid,
    character_key character varying(50) NOT NULL,
    coins integer DEFAULT 500,
    reputation integer DEFAULT 1,
    brand_trust integer DEFAULT 1,
    influence integer DEFAULT 1,
    stress integer DEFAULT 0,
    last_applied_episode_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN character_state.character_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_state.character_key IS 'lala, justawoman, guest:<id>';


--
-- Name: COLUMN character_state.reputation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_state.reputation IS '0-10 scale';


--
-- Name: COLUMN character_state.brand_trust; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_state.brand_trust IS '0-10 scale';


--
-- Name: COLUMN character_state.influence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_state.influence IS '0-10 scale';


--
-- Name: COLUMN character_state.stress; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_state.stress IS '0-10 scale';


--
-- Name: character_state_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_state_history (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    season_id uuid,
    character_key character varying(50) NOT NULL,
    episode_id uuid,
    evaluation_id uuid,
    source public.enum_character_state_history_source DEFAULT 'computed'::public.enum_character_state_history_source NOT NULL,
    deltas_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    state_after_json jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN character_state_history.evaluation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_state_history.evaluation_id IS 'Reference to the evaluation snapshot on the episode';


--
-- Name: COLUMN character_state_history.deltas_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_state_history.deltas_json IS '{"coins":-150,"reputation":1,"stress":1}';


--
-- Name: COLUMN character_state_history.state_after_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.character_state_history.state_after_json IS 'Snapshot of character state after applying deltas';


--
-- Name: character_therapy_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_therapy_profiles (
    id uuid NOT NULL,
    character_id uuid NOT NULL,
    emotional_state jsonb DEFAULT '{}'::jsonb,
    baseline jsonb DEFAULT '{}'::jsonb,
    known jsonb DEFAULT '[]'::jsonb,
    sensed jsonb DEFAULT '[]'::jsonb,
    never_knows jsonb DEFAULT '[]'::jsonb,
    deja_vu_events jsonb DEFAULT '[]'::jsonb,
    primary_defense character varying(255) DEFAULT 'rationalize'::character varying,
    sessions_completed integer DEFAULT 0,
    session_log_history jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characters (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    role character varying(50) NOT NULL,
    display_name character varying(255),
    avatar_asset_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN characters.show_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characters.show_id IS 'Associated show';


--
-- Name: COLUMN characters.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characters.name IS 'Character name';


--
-- Name: COLUMN characters.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characters.role IS 'Character role (e.g. main, supporting, extra)';


--
-- Name: COLUMN characters.display_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characters.display_name IS 'Optional display name override';


--
-- Name: COLUMN characters.avatar_asset_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characters.avatar_asset_id IS 'Reference to avatar asset';


--
-- Name: COLUMN characters.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characters.metadata IS 'Additional character metadata';


--
-- Name: composition_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composition_assets (
    id uuid NOT NULL,
    composition_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    asset_role character varying(100) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN composition_assets.asset_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_assets.asset_role IS 'Role this asset plays in the composition (e.g., BG.MAIN, CHAR.HOST.PRIMARY)';


--
-- Name: composition_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composition_outputs (
    id uuid NOT NULL,
    composition_id uuid NOT NULL,
    format character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'PROCESSING'::character varying NOT NULL,
    image_url text,
    width integer,
    height integer,
    file_size integer,
    error_message text,
    generated_at timestamp with time zone,
    generated_by character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN composition_outputs.format; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.format IS 'Output format identifier (e.g., YOUTUBE, INSTAGRAM_FEED, YOUTUBE_1920x1080)';


--
-- Name: COLUMN composition_outputs.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.status IS 'Generation status: PROCESSING, READY, FAILED';


--
-- Name: COLUMN composition_outputs.image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.image_url IS 'S3 URL or CDN path to generated thumbnail image';


--
-- Name: COLUMN composition_outputs.width; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.width IS 'Image width in pixels';


--
-- Name: COLUMN composition_outputs.height; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.height IS 'Image height in pixels';


--
-- Name: COLUMN composition_outputs.file_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.file_size IS 'File size in bytes';


--
-- Name: COLUMN composition_outputs.error_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.error_message IS 'Error details if status is FAILED';


--
-- Name: COLUMN composition_outputs.generated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.generated_at IS 'Timestamp when output was successfully generated';


--
-- Name: COLUMN composition_outputs.generated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.composition_outputs.generated_by IS 'User who triggered generation';


--
-- Name: continuity_beat_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.continuity_beat_characters (
    id uuid NOT NULL,
    beat_id uuid NOT NULL,
    character_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: continuity_beats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.continuity_beats (
    id uuid NOT NULL,
    timeline_id uuid NOT NULL,
    beat_number integer DEFAULT 1 NOT NULL,
    name character varying(500) NOT NULL,
    location character varying(500) NOT NULL,
    time_tag character varying(255),
    note text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: continuity_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.continuity_characters (
    id uuid NOT NULL,
    timeline_id uuid NOT NULL,
    character_key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(255),
    color character varying(20) DEFAULT '#5b7fff'::character varying NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: continuity_timelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.continuity_timelines (
    id uuid NOT NULL,
    show_id uuid,
    title character varying(255) DEFAULT 'Untitled Timeline'::character varying NOT NULL,
    description text,
    season_tag character varying(100),
    status public.enum_continuity_timelines_status DEFAULT 'draft'::public.enum_continuity_timelines_status,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: decision_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decision_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(50) NOT NULL,
    episode_id uuid,
    show_id uuid,
    user_id uuid,
    context_json jsonb,
    decision_json jsonb NOT NULL,
    alternatives_json jsonb,
    confidence double precision,
    source character varying(50) DEFAULT 'user'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN decision_log.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_log.type IS 'tier_override | evaluation_accepted | autofix_accepted | browse_pool | style_adjust | â€¦';


--
-- Name: COLUMN decision_log.context_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_log.context_json IS 'Snapshot of state at decision time';


--
-- Name: COLUMN decision_log.decision_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_log.decision_json IS 'What was chosen';


--
-- Name: COLUMN decision_log.alternatives_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_log.alternatives_json IS 'Options that were NOT chosen';


--
-- Name: COLUMN decision_log.confidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_log.confidence IS '0-1 confidence if AI-assisted';


--
-- Name: COLUMN decision_log.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_log.source IS 'user | ai | system';


--
-- Name: decision_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decision_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid,
    scene_id uuid,
    user_id character varying(255),
    action_type character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    action_data jsonb,
    context_data jsonb,
    "timestamp" timestamp with time zone,
    created_at timestamp with time zone
);


--
-- Name: COLUMN decision_logs.action_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_logs.action_type IS 'ASSET_POSITIONED, LAYER_CREATED, TIMING_SET, etc.';


--
-- Name: COLUMN decision_logs.entity_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_logs.entity_type IS 'asset, layer, scene, episode';


--
-- Name: COLUMN decision_logs.action_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_logs.action_data IS 'Details of what was done (position, timing, etc.)';


--
-- Name: COLUMN decision_logs.context_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.decision_logs.context_data IS 'Scene type, asset type, script context, etc.';


--
-- Name: decision_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decision_patterns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pattern_type character varying(100) NOT NULL,
    pattern_category character varying(50) NOT NULL,
    pattern_data jsonb NOT NULL,
    sample_count integer DEFAULT 0 NOT NULL,
    confidence_score numeric(3,2) NOT NULL,
    last_updated timestamp with time zone DEFAULT now(),
    first_detected timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ecosystem_previews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecosystem_previews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    preview_id character varying(255) NOT NULL,
    world_tag character varying(100) DEFAULT 'lalaverse'::character varying NOT NULL,
    characters jsonb DEFAULT '[]'::jsonb NOT NULL,
    generation_notes text DEFAULT ''::text,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: edit_maps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edit_maps (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    raw_footage_id uuid,
    analysis_version character varying(50) DEFAULT '1.0'::character varying,
    transcript jsonb DEFAULT '[]'::jsonb,
    speaker_segments jsonb DEFAULT '[]'::jsonb,
    audio_events jsonb DEFAULT '{}'::jsonb,
    character_presence jsonb DEFAULT '[]'::jsonb,
    active_speaker_timeline jsonb DEFAULT '[]'::jsonb,
    scene_boundaries jsonb DEFAULT '[]'::jsonb,
    b_roll_opportunities jsonb DEFAULT '[]'::jsonb,
    suggested_cuts jsonb DEFAULT '[]'::jsonb,
    duration_seconds integer,
    processing_status character varying(50) DEFAULT 'pending'::character varying,
    processing_started_at timestamp with time zone,
    processing_completed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN edit_maps.transcript; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.transcript IS 'Word-level timestamps from ASR';


--
-- Name: COLUMN edit_maps.speaker_segments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.speaker_segments IS 'Diarization: who spoke when';


--
-- Name: COLUMN edit_maps.audio_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.audio_events IS 'Non-speech: laughter, music, silence';


--
-- Name: COLUMN edit_maps.character_presence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.character_presence IS 'Who is visible on screen when';


--
-- Name: COLUMN edit_maps.active_speaker_timeline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.active_speaker_timeline IS 'Voice linked to person tracks';


--
-- Name: COLUMN edit_maps.scene_boundaries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.scene_boundaries IS 'Auto-detected cuts and scene changes';


--
-- Name: COLUMN edit_maps.b_roll_opportunities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.b_roll_opportunities IS 'Moments where overlays work';


--
-- Name: COLUMN edit_maps.suggested_cuts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.suggested_cuts IS 'Natural edit points (breaths, pauses)';


--
-- Name: COLUMN edit_maps.duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.duration_seconds IS 'Total video duration';


--
-- Name: COLUMN edit_maps.processing_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edit_maps.processing_status IS 'pending, processing, completed, failed';


--
-- Name: editing_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.editing_decisions (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    scene_id uuid,
    action_type character varying(100) NOT NULL,
    before_state jsonb NOT NULL,
    after_state jsonb NOT NULL,
    context jsonb,
    ai_suggested boolean DEFAULT false NOT NULL,
    user_id character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN editing_decisions.action_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.editing_decisions.action_type IS 'TRIM_CLIP | REORDER_CLIPS | SELECT_TAKE | CHANGE_TRANSITION | etc.';


--
-- Name: COLUMN editing_decisions.before_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.editing_decisions.before_state IS 'State before user action';


--
-- Name: COLUMN editing_decisions.after_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.editing_decisions.after_state IS 'State after user action';


--
-- Name: COLUMN editing_decisions.context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.editing_decisions.context IS 'Scene type, energy level, timing context';


--
-- Name: COLUMN editing_decisions.ai_suggested; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.editing_decisions.ai_suggested IS 'Was this action originally suggested by AI?';


--
-- Name: entanglement_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entanglement_events (
    id uuid NOT NULL,
    profile_id integer NOT NULL,
    event_type public.enum_entanglement_events_event_type NOT NULL,
    previous_state public.enum_entanglement_events_previous_state,
    new_state public.enum_entanglement_events_new_state,
    affected_character_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    affected_dimensions jsonb DEFAULT '[]'::jsonb NOT NULL,
    scene_proposals jsonb,
    description text,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN entanglement_events.scene_proposals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entanglement_events.scene_proposals IS 'Array of { character_id, brief, approved } objects';


--
-- Name: entanglement_unfollows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entanglement_unfollows (
    id uuid NOT NULL,
    character_id uuid NOT NULL,
    profile_id integer NOT NULL,
    reason public.enum_entanglement_unfollows_reason,
    story_timestamp text,
    noticed_by jsonb DEFAULT '[]'::jsonb NOT NULL,
    visibility public.enum_entanglement_unfollows_visibility DEFAULT 'unnoticed'::public.enum_entanglement_unfollows_visibility NOT NULL,
    amber_proposed_reason text,
    author_confirmed boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN entanglement_unfollows.story_timestamp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entanglement_unfollows.story_timestamp IS 'e.g. "Chapter 3, after the salon scene" â€” narrative position';


--
-- Name: episode_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    folder character varying(100),
    sort_order integer DEFAULT 0,
    tags text[],
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: episode_briefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_briefs (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    show_id uuid,
    arc_number integer,
    position_in_arc integer,
    episode_archetype public.enum_episode_briefs_episode_archetype,
    narrative_purpose text,
    designed_intent public.enum_episode_briefs_designed_intent,
    allowed_outcomes jsonb DEFAULT '[]'::jsonb,
    forward_hook text,
    lala_state_snapshot jsonb,
    event_id uuid,
    event_difficulty jsonb,
    status public.enum_episode_briefs_status DEFAULT 'draft'::public.enum_episode_briefs_status NOT NULL,
    ai_generated_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    outfit_set_id uuid,
    beat_outline jsonb DEFAULT '[]'::jsonb,
    invitation_asset_id uuid,
    season_id uuid,
    arc_id uuid,
    narrative_chain jsonb DEFAULT '{}'::jsonb,
    canon_consequences jsonb DEFAULT '{}'::jsonb,
    career_context jsonb DEFAULT '{}'::jsonb,
    event_metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: COLUMN episode_briefs.outfit_set_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.outfit_set_id IS 'OutfitSet that drove this episode, copied from the event at generate time';


--
-- Name: COLUMN episode_briefs.beat_outline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.beat_outline IS 'AI-drafted beat outline at generate time: [{ beat_number, summary, dramatic_function }]. Feeds the Suggest-Scenes flow before any script exists.';


--
-- Name: COLUMN episode_briefs.invitation_asset_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.invitation_asset_id IS 'Direct FK to assets â€” invite asset chosen at event time';


--
-- Name: COLUMN episode_briefs.season_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.season_id IS 'Snapshotted from event at generate time';


--
-- Name: COLUMN episode_briefs.arc_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.arc_id IS 'Snapshotted from event at generate time';


--
-- Name: COLUMN episode_briefs.narrative_chain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.narrative_chain IS '{ parent_event_id, chain_position, chain_reason, seeds_future_events } from event';


--
-- Name: COLUMN episode_briefs.canon_consequences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.canon_consequences IS 'Full canon_consequences object snapshotted from event';


--
-- Name: COLUMN episode_briefs.career_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.career_context IS '{ career_tier, career_milestone, fail_consequence, success_unlock }';


--
-- Name: COLUMN episode_briefs.event_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_briefs.event_metadata IS '{ rewards, requirements, browse_pool_bias, browse_pool_size, overlay_template, required_ui_overlays }';


--
-- Name: episode_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_phases (
    id uuid NOT NULL,
    episode_id uuid,
    phase_name character varying(100),
    start_time numeric(10,3),
    end_time numeric(10,3),
    layout_template_id uuid,
    active_characters jsonb,
    phase_config jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN episode_phases.phase_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_phases.phase_name IS 'intro, gameplay, ai_interaction, photoshoot, outro';


--
-- Name: COLUMN episode_phases.active_characters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_phases.active_characters IS 'Which characters are visible/active';


--
-- Name: COLUMN episode_phases.phase_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_phases.phase_config IS 'Phase-specific settings';


--
-- Name: episode_scenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_scenes (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    scene_library_id uuid NOT NULL,
    scene_order integer DEFAULT 0 NOT NULL,
    trim_start numeric(10,3),
    trim_end numeric(10,3),
    scene_type public.enum_episode_scenes_scene_type DEFAULT 'main'::public.enum_episode_scenes_scene_type,
    episode_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type public.enum_episode_scenes_type DEFAULT 'clip'::public.enum_episode_scenes_type NOT NULL,
    manual_duration_seconds numeric(10,3),
    title_override character varying(500),
    note_text text,
    added_by character varying(255),
    last_edited_at timestamp with time zone
);


--
-- Name: COLUMN episode_scenes.episode_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.episode_id IS 'Episode this scene is assigned to';


--
-- Name: COLUMN episode_scenes.scene_library_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.scene_library_id IS 'Reference to the scene in the library (nullable for notes)';


--
-- Name: COLUMN episode_scenes.scene_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.scene_order IS 'Order/sequence of scene in episode';


--
-- Name: COLUMN episode_scenes.trim_start; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.trim_start IS 'Episode-specific trim start time in seconds';


--
-- Name: COLUMN episode_scenes.trim_end; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.trim_end IS 'Episode-specific trim end time in seconds';


--
-- Name: COLUMN episode_scenes.scene_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.scene_type IS 'Episode-specific scene type/context';


--
-- Name: COLUMN episode_scenes.episode_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.episode_notes IS 'Episode-specific notes for this scene';


--
-- Name: COLUMN episode_scenes.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.type IS 'Type of sequence item: clip from library or manual note';


--
-- Name: COLUMN episode_scenes.manual_duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.manual_duration_seconds IS 'Manual duration for notes or missing clips';


--
-- Name: COLUMN episode_scenes.title_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.title_override IS 'Override title for this sequence item';


--
-- Name: COLUMN episode_scenes.note_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.note_text IS 'Text content for note-type items';


--
-- Name: COLUMN episode_scenes.added_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.added_by IS 'User who added this item to the sequence';


--
-- Name: COLUMN episode_scenes.last_edited_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_scenes.last_edited_at IS 'Last time this item was edited';


--
-- Name: episode_scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_scripts (
    id integer NOT NULL,
    episode_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    content text NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    created_by character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: episode_scripts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.episode_scripts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: episode_scripts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.episode_scripts_id_seq OWNED BY public.episode_scripts.id;


--
-- Name: episode_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_templates (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255),
    description text DEFAULT ''::text,
    default_status public.enum_episode_templates_default_status DEFAULT 'draft'::public.enum_episode_templates_default_status NOT NULL,
    default_categories jsonb DEFAULT '[]'::jsonb NOT NULL,
    default_duration integer,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    icon character varying(100) DEFAULT 'ðŸ“º'::character varying,
    color character varying(50) DEFAULT '#667eea'::character varying,
    sort_order integer DEFAULT 0 NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_system_template boolean DEFAULT false NOT NULL,
    created_by uuid,
    updated_by uuid,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: episode_todo_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_todo_lists (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    show_id uuid,
    event_id uuid,
    tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    asset_id uuid,
    asset_url text,
    generated_by character varying(50) DEFAULT 'ai'::character varying,
    status public.enum_episode_todo_lists_status DEFAULT 'draft'::public.enum_episode_todo_lists_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    social_tasks jsonb DEFAULT '[]'::jsonb,
    financial_summary jsonb
);


--
-- Name: COLUMN episode_todo_lists.event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_todo_lists.event_id IS 'The world_event this list was generated from';


--
-- Name: COLUMN episode_todo_lists.tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_todo_lists.tasks IS 'Array of task objects, one per wardrobe slot';


--
-- Name: COLUMN episode_todo_lists.asset_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_todo_lists.asset_id IS 'The generated PNG overlay asset';


--
-- Name: COLUMN episode_todo_lists.asset_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_todo_lists.asset_url IS 'S3 URL of the to-do list PNG';


--
-- Name: COLUMN episode_todo_lists.generated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_todo_lists.generated_by IS 'ai or manual';


--
-- Name: COLUMN episode_todo_lists.social_tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_todo_lists.social_tasks IS 'Social media content tasks: [{slot, label, description, required, completed, platform, timing}]';


--
-- Name: COLUMN episode_todo_lists.financial_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_todo_lists.financial_summary IS '{ total_outfit_cost, event_income, event_expense, content_revenue, net_profit }';


--
-- Name: episode_wardrobe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_wardrobe (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    wardrobe_id uuid NOT NULL,
    scene_id uuid,
    scene character varying(255),
    worn_at timestamp with time zone NOT NULL,
    notes text,
    approval_status character varying(50) DEFAULT 'pending'::character varying,
    approved_by character varying(255),
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN episode_wardrobe.scene_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_wardrobe.scene_id IS 'Link to specific scene where wardrobe was used';


--
-- Name: COLUMN episode_wardrobe.scene; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_wardrobe.scene IS 'Scene description/name (legacy text field - use scene_id instead)';


--
-- Name: COLUMN episode_wardrobe.worn_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_wardrobe.worn_at IS 'When this item was linked to the episode';


--
-- Name: COLUMN episode_wardrobe.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_wardrobe.notes IS 'Episode-specific notes about wearing this item';


--
-- Name: COLUMN episode_wardrobe.approval_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_wardrobe.approval_status IS 'Approval status: pending, approved, rejected';


--
-- Name: COLUMN episode_wardrobe.approved_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_wardrobe.approved_by IS 'User who approved this item';


--
-- Name: COLUMN episode_wardrobe.approved_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_wardrobe.approved_at IS 'When this item was approved';


--
-- Name: COLUMN episode_wardrobe.rejection_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episode_wardrobe.rejection_reason IS 'Reason for rejection if applicable';


--
-- Name: episode_wardrobe_defaults; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episode_wardrobe_defaults (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    character_name character varying(100) NOT NULL,
    default_outfit_asset_id uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episodes (
    id uuid NOT NULL,
    show_name character varying(255),
    season_number integer,
    episode_number integer,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'draft'::character varying,
    episode_title character varying(255),
    air_date timestamp with time zone,
    plot_summary text,
    director character varying(255),
    writer character varying(255),
    duration_minutes integer,
    rating numeric(3,1),
    genre character varying(255),
    thumbnail_url character varying(512),
    poster_url character varying(512),
    video_url character varying(512),
    raw_video_s3_key character varying(512),
    processed_video_s3_key character varying(512),
    metadata_json_s3_key character varying(512),
    processing_status public.enum_episodes_processing_status DEFAULT 'pending'::public.enum_episodes_processing_status NOT NULL,
    show_id uuid,
    upload_date timestamp with time zone,
    last_modified timestamp with time zone,
    deleted_at timestamp with time zone,
    categories json DEFAULT '[]'::json,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    current_ai_edit_plan_id uuid,
    platform character varying(20) DEFAULT 'youtube'::character varying,
    width integer DEFAULT 1920,
    height integer DEFAULT 1080,
    aspect_ratio character varying(10) DEFAULT '16:9'::character varying,
    script_content text,
    evaluation_json jsonb,
    evaluation_status character varying(20) DEFAULT NULL::character varying,
    formula_version character varying(20),
    browse_pool_json jsonb,
    total_income numeric(10,2) DEFAULT 0,
    total_expenses numeric(10,2) DEFAULT 0,
    financial_score integer,
    distribution_metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: COLUMN episodes.categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.categories IS 'Array of category/tag strings for the episode';


--
-- Name: COLUMN episodes.current_ai_edit_plan_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.current_ai_edit_plan_id IS 'Reference to the current AI edit plan for this episode';


--
-- Name: COLUMN episodes.evaluation_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.evaluation_json IS 'Stores score, tier, style_scores, overrides, stat_deltas';


--
-- Name: COLUMN episodes.evaluation_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.evaluation_status IS 'null | computed | accepted';


--
-- Name: COLUMN episodes.formula_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.formula_version IS 'e.g. v1.0';


--
-- Name: COLUMN episodes.browse_pool_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.browse_pool_json IS 'Generated closet-browse pool for this episode';


--
-- Name: COLUMN episodes.total_income; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.total_income IS 'Total income from event payments + brand deals + content revenue';


--
-- Name: COLUMN episodes.total_expenses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.total_expenses IS 'Total expenses: outfit costs + event costs + beauty/styling';


--
-- Name: COLUMN episodes.financial_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.episodes.financial_score IS 'Financial intelligence score 0-10';


--
-- Name: feed_moments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_moments (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    episode_id uuid NOT NULL,
    event_id uuid,
    beat_number integer NOT NULL,
    beat_context text,
    trigger_profile_id integer,
    trigger_handle character varying(100),
    trigger_action character varying(100),
    phone_screen_type character varying(30),
    screen_content text,
    screen_image_desc text,
    asset_type character varying(50),
    asset_role character varying(80),
    justawoman_line text,
    justawoman_action character varying(200),
    lala_line text,
    lala_internal text,
    direction text,
    financial_context jsonb,
    emotional_shift character varying(50),
    behavior_change text,
    feeds_into_beat integer,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: feed_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_posts (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    episode_id uuid,
    event_id uuid,
    opportunity_id uuid,
    social_profile_id integer,
    poster_handle character varying(100) NOT NULL,
    poster_display_name character varying(200),
    poster_platform character varying(30) DEFAULT 'instagram'::character varying,
    post_type character varying(30) DEFAULT 'post'::character varying NOT NULL,
    content_text text,
    image_description text,
    image_url text,
    likes integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    shares integer DEFAULT 0,
    sample_comments jsonb DEFAULT '[]'::jsonb,
    posted_at timestamp with time zone,
    timeline_position character varying(30),
    narrative_function character varying(50),
    lala_reaction text,
    lala_internal_thought text,
    emotional_impact character varying(50),
    ai_generated boolean DEFAULT true NOT NULL,
    generation_model character varying(60),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    is_viral boolean DEFAULT false NOT NULL,
    viral_reach integer DEFAULT 0,
    engagement_velocity double precision DEFAULT '0'::double precision,
    trending_topic character varying(100),
    thread_id uuid,
    parent_post_id uuid,
    ripple_effect jsonb,
    audience_sentiment character varying(30),
    poster_creator_name character varying(200)
);


--
-- Name: COLUMN feed_posts.viral_reach; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feed_posts.viral_reach IS 'Extended reach beyond normal followers when post goes viral';


--
-- Name: COLUMN feed_posts.engagement_velocity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feed_posts.engagement_velocity IS 'Rate of engagement growth (likes+comments per hour in first 24h)';


--
-- Name: COLUMN feed_posts.trending_topic; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feed_posts.trending_topic IS 'Hashtag or topic this post contributed to trending';


--
-- Name: COLUMN feed_posts.thread_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feed_posts.thread_id IS 'Groups reply chains â€” all posts in a thread share the same thread_id';


--
-- Name: COLUMN feed_posts.parent_post_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feed_posts.parent_post_id IS 'Direct reply to another post (self-referencing FK)';


--
-- Name: COLUMN feed_posts.ripple_effect; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feed_posts.ripple_effect IS 'How this post rippled: { spawned_posts, relationship_shifts, opportunity_triggers }';


--
-- Name: COLUMN feed_posts.audience_sentiment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feed_posts.audience_sentiment IS 'supportive | divided | hostile | curious | indifferent';


--
-- Name: feed_profile_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_profile_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    influencer_a_id integer NOT NULL,
    influencer_b_id integer NOT NULL,
    relationship_type public.enum_feed_profile_relationships_relationship_type NOT NULL,
    is_public boolean DEFAULT true,
    story_position uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN feed_profile_relationships.is_public; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feed_profile_relationships.is_public IS 'Does the story world know about this relationship';


--
-- Name: financial_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_transactions (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    episode_id uuid,
    event_id uuid,
    type character varying(30) NOT NULL,
    category character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    source_type character varying(50),
    source_id uuid,
    source_name character varying(255),
    balance_before numeric(10,2),
    balance_after numeric(10,2),
    metadata jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'executed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: franchise_knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.franchise_knowledge (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    category public.enum_franchise_knowledge_category DEFAULT 'narrative'::public.enum_franchise_knowledge_category,
    severity public.enum_franchise_knowledge_severity DEFAULT 'important'::public.enum_franchise_knowledge_severity,
    applies_to jsonb DEFAULT '[]'::jsonb,
    always_inject boolean DEFAULT false,
    source_document character varying(200),
    source_version character varying(20),
    extracted_by public.enum_franchise_knowledge_extracted_by DEFAULT 'direct_entry'::public.enum_franchise_knowledge_extracted_by,
    status public.enum_franchise_knowledge_status DEFAULT 'pending_review'::public.enum_franchise_knowledge_status,
    superseded_by integer,
    review_note text,
    injection_count integer DEFAULT 0,
    last_injected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: franchise_knowledge_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.franchise_knowledge_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: franchise_knowledge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.franchise_knowledge_id_seq OWNED BY public.franchise_knowledge.id;


--
-- Name: franchise_tech_knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.franchise_tech_knowledge (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    category public.enum_franchise_tech_knowledge_category DEFAULT 'deployed_system'::public.enum_franchise_tech_knowledge_category,
    severity public.enum_franchise_tech_knowledge_severity DEFAULT 'important'::public.enum_franchise_tech_knowledge_severity,
    applies_to jsonb DEFAULT '[]'::jsonb,
    source_document character varying(100),
    source_version character varying(20),
    status public.enum_franchise_tech_knowledge_status DEFAULT 'active'::public.enum_franchise_tech_knowledge_status,
    extracted_by public.enum_franchise_tech_knowledge_extracted_by DEFAULT 'direct_entry'::public.enum_franchise_tech_knowledge_extracted_by,
    injection_count integer DEFAULT 0,
    last_injected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN franchise_tech_knowledge.applies_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.franchise_tech_knowledge.applies_to IS 'Tags: system names, route prefixes, table names';


--
-- Name: franchise_tech_knowledge_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.franchise_tech_knowledge_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: franchise_tech_knowledge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.franchise_tech_knowledge_id_seq OWNED BY public.franchise_tech_knowledge.id;


--
-- Name: generation_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generation_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type public.enum_generation_jobs_job_type NOT NULL,
    status public.enum_generation_jobs_status DEFAULT 'queued'::public.enum_generation_jobs_status NOT NULL,
    scene_set_id uuid NOT NULL,
    scene_angle_id uuid,
    payload jsonb DEFAULT '{}'::jsonb,
    result jsonb,
    error text,
    priority integer DEFAULT 0 NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN generation_jobs.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.generation_jobs.priority IS 'Higher = higher priority. Default 0.';


--
-- Name: hair_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hair_library (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    vibe_tags jsonb DEFAULT '[]'::jsonb,
    occasion_tags jsonb DEFAULT '[]'::jsonb,
    event_types jsonb DEFAULT '[]'::jsonb,
    reference_photo_url character varying(255),
    color_state character varying(255),
    length character varying(255),
    texture character varying(255),
    career_echo_potential text,
    "is_justAWoman_style" boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: interactive_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interactive_elements (
    id uuid NOT NULL,
    episode_id uuid,
    appears_at numeric(10,3),
    disappears_at numeric(10,3),
    element_type character varying(50),
    content jsonb,
    screen_position jsonb,
    ui_style jsonb,
    requires_input boolean DEFAULT false,
    auto_advance_after integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN interactive_elements.appears_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.interactive_elements.appears_at IS 'When does this element appear in timeline';


--
-- Name: COLUMN interactive_elements.element_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.interactive_elements.element_type IS 'fashion_choice, prompt, poll, button, overlay';


--
-- Name: COLUMN interactive_elements.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.interactive_elements.content IS 'Element-specific data';


--
-- Name: COLUMN interactive_elements.screen_position; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.interactive_elements.screen_position IS 'Where on screen (x, y, width, height as percentages)';


--
-- Name: COLUMN interactive_elements.ui_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.interactive_elements.ui_style IS 'CSS-like styling for the element';


--
-- Name: COLUMN interactive_elements.requires_input; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.interactive_elements.requires_input IS 'Does this pause until user interacts?';


--
-- Name: COLUMN interactive_elements.auto_advance_after; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.interactive_elements.auto_advance_after IS 'Auto-advance after N seconds if no input';


--
-- Name: intimate_scenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intimate_scenes (
    id uuid NOT NULL,
    character_a_id uuid NOT NULL,
    character_b_id uuid,
    character_a_name character varying(255) NOT NULL,
    character_b_name character varying(255),
    book_id uuid,
    chapter_id uuid,
    scene_type character varying(100) NOT NULL,
    location text,
    world_context text,
    emotional_state_a text,
    emotional_state_b text,
    career_stage character varying(50),
    trigger_tension character varying(50),
    approach_text text,
    scene_text text,
    aftermath_text text,
    full_text text,
    word_count integer,
    intensity character varying(50),
    relationship_shift text,
    tension_updated boolean DEFAULT false,
    new_tension_state character varying(50),
    scene_logged boolean DEFAULT false,
    memory_extracted boolean DEFAULT false,
    continuation_generated boolean DEFAULT false,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: lala_cash_grab_quests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lala_cash_grab_quests (
    id uuid NOT NULL,
    episode_id uuid,
    quest_type character varying(100),
    quest_text text,
    coin_reward integer,
    time_cost_seconds integer,
    player_choice character varying(50),
    created_at timestamp with time zone
);


--
-- Name: lala_emergence_scenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lala_emergence_scenes (
    id uuid NOT NULL,
    line_id uuid NOT NULL,
    chapter_id uuid NOT NULL,
    book_id uuid NOT NULL,
    line_order integer,
    line_content text NOT NULL,
    chapter_title character varying(255),
    emotional_context text,
    scene_type character varying(50) DEFAULT 'lala_emergence'::character varying NOT NULL,
    confirmed boolean DEFAULT false NOT NULL,
    notes text,
    canon_tier character varying(20) DEFAULT 'proto'::character varying NOT NULL,
    detection_method character varying(20) DEFAULT 'auto'::character varying NOT NULL,
    franchise_anchor boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: lala_episode_formulas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lala_episode_formulas (
    id uuid NOT NULL,
    episode_id uuid,
    opening_ritual jsonb DEFAULT '{"lala_line": "Bestie, come style me  I''m ready for a new slay. Logging in", "emotional_vibe": null}'::jsonb,
    interruption jsonb DEFAULT '{"type": null, "content": null}'::jsonb,
    reveal jsonb DEFAULT '{"event_theme": null, "why_it_matters": null}'::jsonb,
    intention jsonb DEFAULT '{"how_she_wants_to_feel": null, "identity_stepping_into": null}'::jsonb,
    transformation jsonb DEFAULT '{"final_touch": null, "outfit_vibe": null, "shoe_energy": null, "accessory_vibe": null, "signature_detail": null}'::jsonb,
    payoff jsonb DEFAULT '{"emotion_affirmed": null, "fantasy_unlocked": null, "what_this_look_makes_you_feel": null}'::jsonb,
    invitation jsonb DEFAULT '{"call_to_action": null, "audience_action": null}'::jsonb,
    cliffhanger jsonb DEFAULT '{"hint_content": null, "tease_for_next": null}'::jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: lala_episode_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lala_episode_timeline (
    id uuid NOT NULL,
    episode_id uuid,
    beats jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: lala_friend_archetypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lala_friend_archetypes (
    id uuid NOT NULL,
    episode_id uuid,
    archetype character varying(50),
    character_name character varying(255),
    dialogue_moments jsonb,
    created_at timestamp with time zone
);


--
-- Name: lala_micro_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lala_micro_goals (
    id uuid NOT NULL,
    episode_id uuid,
    goal_category character varying(50),
    goal_text text,
    status character varying(50) DEFAULT 'active'::character varying,
    visible_to_audience boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: lalaverse_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lalaverse_brands (
    id uuid NOT NULL,
    slug character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255) DEFAULT 'lalaverse'::character varying,
    category character varying(255),
    description text,
    aesthetic text,
    niche text,
    founder text,
    press_angle text,
    contact_name character varying(255),
    contact_email character varying(255),
    partnership_status character varying(255),
    website character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: layer_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layer_assets (
    id uuid NOT NULL,
    layer_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    position_x integer DEFAULT 0,
    position_y integer DEFAULT 0,
    width integer,
    height integer,
    rotation numeric(5,2) DEFAULT 0,
    scale_x numeric(3,2) DEFAULT 1,
    scale_y numeric(3,2) DEFAULT 1,
    opacity numeric(3,2) DEFAULT 1,
    start_time numeric(10,3),
    duration numeric(10,3),
    order_index integer,
    in_point_seconds numeric(10,2) DEFAULT 0,
    out_point_seconds numeric(10,2),
    transition_in character varying(50) DEFAULT 'none'::character varying,
    transition_out character varying(50) DEFAULT 'none'::character varying,
    animation_type character varying(50),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN layer_assets.position_x; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.position_x IS 'X coordinate in pixels';


--
-- Name: COLUMN layer_assets.position_y; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.position_y IS 'Y coordinate in pixels';


--
-- Name: COLUMN layer_assets.width; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.width IS 'Width in pixels, null for original size';


--
-- Name: COLUMN layer_assets.height; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.height IS 'Height in pixels, null for original size';


--
-- Name: COLUMN layer_assets.rotation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.rotation IS 'Rotation in degrees (0-360)';


--
-- Name: COLUMN layer_assets.scale_x; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.scale_x IS 'Horizontal scale multiplier';


--
-- Name: COLUMN layer_assets.scale_y; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.scale_y IS 'Vertical scale multiplier';


--
-- Name: COLUMN layer_assets.opacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.opacity IS 'Asset-level opacity override';


--
-- Name: COLUMN layer_assets.start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.start_time IS 'When asset appears in timeline (seconds)';


--
-- Name: COLUMN layer_assets.duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.duration IS 'How long asset shows (seconds)';


--
-- Name: COLUMN layer_assets.order_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.order_index IS 'Order within layer for rendering sequence';


--
-- Name: COLUMN layer_assets.in_point_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.in_point_seconds IS 'When asset appears in timeline (seconds)';


--
-- Name: COLUMN layer_assets.out_point_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.out_point_seconds IS 'When asset disappears from timeline (seconds)';


--
-- Name: COLUMN layer_assets.transition_in; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.transition_in IS 'Fade-in, slide-in, zoom-in, none';


--
-- Name: COLUMN layer_assets.transition_out; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.transition_out IS 'Fade-out, slide-out, zoom-out, none';


--
-- Name: COLUMN layer_assets.animation_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.animation_type IS 'Pan, zoom, rotate, none';


--
-- Name: COLUMN layer_assets.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_assets.metadata IS 'Crop, filters, effects, animations, etc.';


--
-- Name: layer_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layer_presets (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    layer_template jsonb NOT NULL,
    placeholders jsonb,
    preview_url text,
    is_system_preset boolean DEFAULT false NOT NULL,
    times_used integer DEFAULT 0 NOT NULL,
    created_by character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN layer_presets.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_presets.category IS 'intro | main_content | product_showcase | outro';


--
-- Name: COLUMN layer_presets.layer_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_presets.layer_template IS '5-layer template with placeholders';


--
-- Name: COLUMN layer_presets.placeholders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_presets.placeholders IS 'List of placeholders (BACKGROUND_IMAGE, MAIN_CLIP, etc.)';


--
-- Name: COLUMN layer_presets.is_system_preset; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layer_presets.is_system_preset IS 'True if built-in, false if user-created';


--
-- Name: layers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layers (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    layer_number integer NOT NULL,
    layer_type character varying(50) NOT NULL,
    name character varying(255),
    is_visible boolean DEFAULT true,
    is_locked boolean DEFAULT false,
    opacity numeric(3,2) DEFAULT 1,
    blend_mode character varying(50) DEFAULT 'normal'::character varying,
    z_index integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN layers.layer_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layers.layer_number IS '1-5 (bottom to top)';


--
-- Name: COLUMN layers.z_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layers.z_index IS 'Fine-tuned ordering within same layer_number';


--
-- Name: COLUMN layers.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layers.metadata IS 'Flexible storage for layer-specific settings';


--
-- Name: layout_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layout_templates (
    id uuid NOT NULL,
    show_id uuid,
    name character varying(255),
    layout_type character varying(50),
    regions jsonb,
    transition_in character varying(50),
    transition_out character varying(50),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN layout_templates.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layout_templates.name IS 'e.g., "Twitch Gameplay Layout", "Photoshoot Reveal Layout"';


--
-- Name: COLUMN layout_templates.layout_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layout_templates.layout_type IS 'twitch, split_screen, picture_in_picture, full_screen, cinematic';


--
-- Name: COLUMN layout_templates.regions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layout_templates.regions IS 'Screen regions and what goes in them';


--
-- Name: COLUMN layout_templates.transition_in; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.layout_templates.transition_in IS 'How to transition into this layout';


--
-- Name: makeup_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.makeup_library (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    mood_tag character varying(255),
    occasion_tags jsonb DEFAULT '[]'::jsonb,
    event_types jsonb DEFAULT '[]'::jsonb,
    aesthetic_tags jsonb DEFAULT '[]'::jsonb,
    skin_finish character varying(255),
    eye_look character varying(255),
    lip_look character varying(255),
    reference_photo_url character varying(255),
    career_echo_potential text,
    "is_justAWoman_style" boolean DEFAULT false,
    featured_brand character varying(255),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: manuscript_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manuscript_metadata (
    id integer NOT NULL,
    series_id integer,
    book_id integer NOT NULL,
    stories_included integer DEFAULT 0,
    book_title character varying(300),
    tagline text,
    amazon_description text,
    one_line_logline text,
    section_establishment character varying(300),
    section_pressure character varying(300),
    section_crisis character varying(300),
    section_integration character varying(300),
    table_of_contents jsonb DEFAULT '[]'::jsonb,
    dominant_themes jsonb DEFAULT '[]'::jsonb,
    recurring_motifs jsonb DEFAULT '[]'::jsonb,
    pain_point_summary jsonb DEFAULT '[]'::jsonb,
    lala_seed_count integer DEFAULT 0,
    lala_seed_moments jsonb DEFAULT '[]'::jsonb,
    generated_at timestamp with time zone,
    generation_model character varying(60),
    author_approved boolean DEFAULT false,
    approved_at timestamp with time zone,
    author_overrides jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: manuscript_metadata_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.manuscript_metadata_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: manuscript_metadata_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.manuscript_metadata_id_seq OWNED BY public.manuscript_metadata.id;


--
-- Name: markers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.markers (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    scene_id uuid,
    timecode numeric(10,2) NOT NULL,
    title character varying(255),
    marker_type character varying(50) DEFAULT 'note'::character varying NOT NULL,
    category character varying(50),
    tags text[] DEFAULT ARRAY[]::text[],
    color character varying(7) DEFAULT '#3B82F6'::character varying NOT NULL,
    description text,
    scene_relative_timecode numeric(10,2),
    deliverable_id character varying(100),
    fulfillment_checkpoint boolean DEFAULT false NOT NULL,
    created_by character varying(255),
    updated_by character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN markers.episode_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.episode_id IS 'Episode this marker belongs to';


--
-- Name: COLUMN markers.scene_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.scene_id IS 'Optional scene reference';


--
-- Name: COLUMN markers.timecode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.timecode IS 'Absolute time in seconds from episode start';


--
-- Name: COLUMN markers.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.title IS 'Marker title or label';


--
-- Name: COLUMN markers.marker_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.marker_type IS 'Type of marker';


--
-- Name: COLUMN markers.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.category IS 'User-defined category for grouping';


--
-- Name: COLUMN markers.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.tags IS 'Array of tags';


--
-- Name: COLUMN markers.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.color IS 'Hex color code for display';


--
-- Name: COLUMN markers.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.description IS 'Extended description or notes';


--
-- Name: COLUMN markers.scene_relative_timecode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.scene_relative_timecode IS 'Position within referenced scene (auto-calculated)';


--
-- Name: COLUMN markers.deliverable_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.deliverable_id IS 'External deliverable tracking ID';


--
-- Name: COLUMN markers.fulfillment_checkpoint; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.markers.fulfillment_checkpoint IS 'Marks fulfillment milestones';


--
-- Name: metadata_storage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_storage (
    id integer NOT NULL,
    "episodeId" uuid NOT NULL,
    "extractedText" text,
    "scenesDetected" json,
    "sentimentAnalysis" json,
    "visualObjects" json,
    transcription text,
    tags json,
    categories json,
    "extractionTimestamp" timestamp with time zone,
    "processingDurationSeconds" integer
);


--
-- Name: metadata_storage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metadata_storage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metadata_storage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metadata_storage_id_seq OWNED BY public.metadata_storage.id;


--
-- Name: multi_product_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.multi_product_content (
    id integer NOT NULL,
    story_id integer NOT NULL,
    format public.enum_multi_product_content_format NOT NULL,
    content text NOT NULL,
    headline character varying(200),
    emotional_core text,
    book2_seed boolean DEFAULT false,
    status public.enum_multi_product_content_status DEFAULT 'draft'::public.enum_multi_product_content_status,
    posted_at timestamp with time zone,
    author_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN multi_product_content.story_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.multi_product_content.story_id IS 'The approved scene this was generated from';


--
-- Name: COLUMN multi_product_content.emotional_core; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.multi_product_content.emotional_core IS 'The scene emotion this content is drawing from';


--
-- Name: COLUMN multi_product_content.book2_seed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.multi_product_content.book2_seed IS 'True if this howto_lesson is a Book 2 coaching realization seed';


--
-- Name: multi_product_content_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.multi_product_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: multi_product_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.multi_product_content_id_seq OWNED BY public.multi_product_content.id;


--
-- Name: novel_assemblies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.novel_assemblies (
    id uuid NOT NULL,
    title character varying(500) NOT NULL,
    character_key character varying(50) NOT NULL,
    story_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    social_import_ids jsonb DEFAULT '[]'::jsonb,
    assembly_order jsonb,
    emotional_curve jsonb,
    total_word_count integer,
    chapter_breaks jsonb,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    compiled_text text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN novel_assemblies.story_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.novel_assemblies.story_ids IS 'Ordered array of story UUIDs included in this assembly';


--
-- Name: COLUMN novel_assemblies.social_import_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.novel_assemblies.social_import_ids IS 'Social import UUIDs woven in';


--
-- Name: COLUMN novel_assemblies.assembly_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.novel_assemblies.assembly_order IS 'Custom ordering: [{type: "story"|"import", id: uuid, position: int}]';


--
-- Name: COLUMN novel_assemblies.emotional_curve; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.novel_assemblies.emotional_curve IS 'Computed emotional arc data for visualization';


--
-- Name: COLUMN novel_assemblies.chapter_breaks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.novel_assemblies.chapter_breaks IS 'Where chapter breaks fall in the assembly';


--
-- Name: COLUMN novel_assemblies.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.novel_assemblies.status IS 'draft, assembling, review, published';


--
-- Name: COLUMN novel_assemblies.compiled_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.novel_assemblies.compiled_text IS 'Full compiled novel text (cached)';


--
-- Name: COLUMN novel_assemblies.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.novel_assemblies.metadata IS 'Additional metadata: themes, settings, timeline coverage';


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunities (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    opportunity_type character varying(50) NOT NULL,
    category character varying(50),
    status character varying(30) DEFAULT 'offered'::character varying NOT NULL,
    status_history jsonb DEFAULT '[]'::jsonb,
    brand_or_company character varying(200),
    contact_name character varying(200),
    connector_profile_id integer,
    connector_handle character varying(100),
    connection_story text,
    venue_name character varying(200),
    venue_address text,
    offer_date date,
    response_deadline date,
    booking_date date,
    shoot_date date,
    publish_date date,
    payment_amount numeric(10,2) DEFAULT 0,
    payment_type character varying(50),
    payment_status character varying(30) DEFAULT 'pending'::character varying,
    expenses numeric(10,2) DEFAULT 0,
    net_value numeric(10,2) DEFAULT 0,
    deliverables jsonb DEFAULT '[]'::jsonb,
    wardrobe_brief jsonb,
    content_requirements jsonb DEFAULT '[]'::jsonb,
    exclusivity text,
    prestige integer DEFAULT 5,
    career_impact text,
    career_milestone character varying(200),
    unlocks jsonb DEFAULT '[]'::jsonb,
    reputation_risk text,
    narrative_stakes text,
    what_lala_wants text,
    what_could_go_wrong text,
    emotional_arc character varying(100),
    season character varying(50),
    calendar_window character varying(100),
    event_id uuid,
    episode_id uuid,
    feed_reactions jsonb DEFAULT '[]'::jsonb,
    social_boost integer DEFAULT 0,
    content_generated jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    career_goal_id uuid,
    career_tier integer DEFAULT 1,
    fail_consequence text,
    success_unlock text
);


--
-- Name: outfit_set_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outfit_set_items (
    id integer NOT NULL,
    outfit_set_id integer,
    wardrobe_item_id integer,
    "position" integer DEFAULT 0 NOT NULL,
    layer character varying(50),
    is_optional boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN outfit_set_items.layer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.outfit_set_items.layer IS 'base, mid, outer, accessory';


--
-- Name: outfit_set_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.outfit_set_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: outfit_set_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.outfit_set_items_id_seq OWNED BY public.outfit_set_items.id;


--
-- Name: outfit_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outfit_sets (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "character" character varying(255),
    occasion character varying(255),
    season character varying(255),
    items json DEFAULT '[]'::json,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: outfit_sets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.outfit_sets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: outfit_sets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.outfit_sets_id_seq OWNED BY public.outfit_sets.id;


--
-- Name: page_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_content (
    id uuid NOT NULL,
    page_name character varying(100) NOT NULL,
    constant_key character varying(100) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: phone_missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_missions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid NOT NULL,
    episode_id uuid,
    name character varying(200) NOT NULL,
    description text,
    icon_url character varying(500),
    start_condition jsonb,
    objectives jsonb DEFAULT '[]'::jsonb NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    reward_actions jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: phone_playthrough_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_playthrough_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(255) NOT NULL,
    episode_id uuid NOT NULL,
    show_id uuid NOT NULL,
    state_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    visited_screens text[] DEFAULT ARRAY[]::text[] NOT NULL,
    last_screen_id character varying(255),
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    completed_mission_ids text[] DEFAULT ARRAY[]::text[] NOT NULL
);


--
-- Name: pipeline_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id uuid NOT NULL,
    book_id uuid,
    chapter_id uuid,
    current_step character varying(50) DEFAULT 'brief'::character varying NOT NULL,
    step_brief jsonb DEFAULT '{}'::jsonb,
    step_generate jsonb DEFAULT '{}'::jsonb,
    step_read jsonb DEFAULT '{}'::jsonb,
    step_evaluate jsonb DEFAULT '{}'::jsonb,
    step_memory jsonb DEFAULT '{}'::jsonb,
    step_registry jsonb DEFAULT '{}'::jsonb,
    step_write_back jsonb DEFAULT '{}'::jsonb,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: post_generation_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_generation_reviews (
    id integer NOT NULL,
    story_id integer NOT NULL,
    approved_version_reviewed text NOT NULL,
    violations jsonb DEFAULT '[]'::jsonb,
    warnings jsonb DEFAULT '[]'::jsonb,
    passed boolean DEFAULT true,
    knowledge_entries_checked integer DEFAULT 0,
    review_note text,
    author_acknowledged boolean DEFAULT false,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN post_generation_reviews.story_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.post_generation_reviews.story_id IS 'The storyteller_story that was reviewed';


--
-- Name: COLUMN post_generation_reviews.approved_version_reviewed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.post_generation_reviews.approved_version_reviewed IS 'The exact text that was reviewed';


--
-- Name: COLUMN post_generation_reviews.violations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.post_generation_reviews.violations IS 'Franchise law violations found in the output';


--
-- Name: COLUMN post_generation_reviews.warnings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.post_generation_reviews.warnings IS 'Non-critical flags worth author attention';


--
-- Name: COLUMN post_generation_reviews.passed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.post_generation_reviews.passed IS 'True if no critical violations found';


--
-- Name: post_generation_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.post_generation_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: post_generation_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.post_generation_reviews_id_seq OWNED BY public.post_generation_reviews.id;


--
-- Name: press_careers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.press_careers (
    id uuid NOT NULL,
    character_slug character varying(255) NOT NULL,
    current_stage integer DEFAULT 1,
    stage_history jsonb DEFAULT '[]'::jsonb,
    sessions_completed integer DEFAULT 0,
    content_generated integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: processing_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processing_queue (
    id integer NOT NULL,
    episode_id uuid,
    job_type public.enum_processing_queue_job_type NOT NULL,
    status public.enum_processing_queue_status DEFAULT 'pending'::public.enum_processing_queue_status,
    sqs_message_id character varying(255),
    sqs_receipt_handle character varying(1024),
    job_config json,
    error_message text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    created_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);


--
-- Name: COLUMN processing_queue.job_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.job_type IS 'Type of processing job';


--
-- Name: COLUMN processing_queue.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.status IS 'Current job status';


--
-- Name: COLUMN processing_queue.sqs_message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.sqs_message_id IS 'SQS message ID for job';


--
-- Name: COLUMN processing_queue.sqs_receipt_handle; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.sqs_receipt_handle IS 'SQS receipt handle for acknowledgment';


--
-- Name: COLUMN processing_queue.job_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.job_config IS 'Configuration parameters for the job';


--
-- Name: COLUMN processing_queue.error_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.error_message IS 'Error message if job failed';


--
-- Name: COLUMN processing_queue.retry_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.retry_count IS 'Number of times job has been retried';


--
-- Name: COLUMN processing_queue.max_retries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.max_retries IS 'Maximum number of retries allowed';


--
-- Name: COLUMN processing_queue.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.created_at IS 'When job was created';


--
-- Name: COLUMN processing_queue.started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.started_at IS 'When job processing started';


--
-- Name: COLUMN processing_queue.completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processing_queue.completed_at IS 'When job completed (success or failure)';


--
-- Name: processing_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.processing_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: processing_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.processing_queue_id_seq OWNED BY public.processing_queue.id;


--
-- Name: processing_queues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processing_queues (
    id integer NOT NULL,
    "episodeId" uuid NOT NULL,
    "jobType" public."enum_processing_queues_jobType" NOT NULL,
    status public.enum_processing_queues_status DEFAULT 'pending'::public.enum_processing_queues_status NOT NULL,
    "sqsMessageId" character varying(255),
    "sqsReceiptHandle" character varying(1024),
    "jobConfig" json,
    "errorMessage" text,
    "retryCount" integer DEFAULT 0,
    "maxRetries" integer DEFAULT 3,
    "createdAt" timestamp with time zone,
    "startedAt" timestamp with time zone,
    "completedAt" timestamp with time zone
);


--
-- Name: processing_queues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.processing_queues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: processing_queues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.processing_queues_id_seq OWNED BY public.processing_queues.id;


--
-- Name: raw_footage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_footage (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    s3_key character varying(1000) NOT NULL,
    file_size bigint,
    duration_seconds integer,
    upload_purpose character varying(100),
    character_visible jsonb,
    intended_scene_id uuid,
    recording_context jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: COLUMN raw_footage.s3_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_footage.s3_key IS 'S3 path to video file';


--
-- Name: COLUMN raw_footage.file_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_footage.file_size IS 'File size in bytes';


--
-- Name: COLUMN raw_footage.duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_footage.duration_seconds IS 'Video duration';


--
-- Name: COLUMN raw_footage.upload_purpose; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_footage.upload_purpose IS 'Why was this uploaded? (main_footage, b_roll, audio_only, reference)';


--
-- Name: COLUMN raw_footage.character_visible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_footage.character_visible IS 'Which characters are in this footage';


--
-- Name: COLUMN raw_footage.intended_scene_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_footage.intended_scene_id IS 'Which scene this belongs to (user-specified)';


--
-- Name: COLUMN raw_footage.recording_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_footage.recording_context IS 'Camera, location, lighting, etc.';


--
-- Name: registry_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registry_characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    registry_id uuid NOT NULL,
    character_key character varying(100) NOT NULL,
    icon character varying(20),
    display_name character varying(255) NOT NULL,
    subtitle character varying(255),
    role_type public.enum_registry_characters_role_type DEFAULT 'pressure'::public.enum_registry_characters_role_type,
    role_label character varying(255),
    appearance_mode public.enum_registry_characters_appearance_mode DEFAULT 'on_page'::public.enum_registry_characters_appearance_mode,
    status public.enum_registry_characters_status DEFAULT 'draft'::public.enum_registry_characters_status,
    core_belief text,
    pressure_type text,
    pressure_quote character varying(500),
    personality text,
    job_options text,
    description text,
    name_options jsonb,
    selected_name character varying(255),
    personality_matrix jsonb,
    extra_fields jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    canon_tier character varying(50),
    first_appearance character varying(255),
    era_introduced character varying(100),
    creator character varying(255),
    core_desire text,
    core_fear text,
    core_wound text,
    mask_persona text,
    truth_persona text,
    character_archetype character varying(100),
    signature_trait text,
    emotional_baseline character varying(100),
    aesthetic_dna jsonb,
    career_status jsonb,
    relationships_map jsonb,
    story_presence jsonb,
    voice_signature jsonb,
    evolution_tracking jsonb,
    wound_depth double precision DEFAULT '0'::double precision,
    belief_pressured text,
    emotional_function text,
    writer_notes text,
    world_character_id uuid,
    gender character varying(80) DEFAULT NULL::character varying,
    ethnicity character varying(150) DEFAULT NULL::character varying,
    species character varying(150) DEFAULT 'human'::character varying,
    is_alive boolean DEFAULT true NOT NULL,
    death_date date,
    death_cause text,
    death_impact text,
    living_context jsonb,
    hidden_want text,
    deep_profile jsonb DEFAULT '{}'::jsonb,
    therapy_primary_defense text,
    therapy_emotional_state jsonb,
    therapy_baseline jsonb,
    pronouns character varying(255),
    depth_level public.enum_registry_characters_depth_level,
    want_architecture jsonb,
    wound jsonb,
    the_mask jsonb,
    living_state jsonb,
    triggers jsonb,
    blind_spot text,
    change_capacity jsonb,
    self_narrative text,
    operative_cosmology text,
    foreclosed_possibility text,
    experience_of_joy text,
    time_orientation public.enum_registry_characters_time_orientation,
    dilemma jsonb,
    social_presence boolean,
    feed_profile_id integer,
    ghost_characters jsonb,
    family_tree jsonb,
    belonging_map jsonb,
    generation_context jsonb,
    prose_overview text,
    performing_publicly boolean DEFAULT false,
    dimensions_performed jsonb DEFAULT '[]'::jsonb,
    dimensions_hidden jsonb DEFAULT '[]'::jsonb,
    de_body_relationship public.enum_body_relationship,
    de_body_currency integer,
    de_body_control integer,
    de_body_comfort integer,
    de_body_history text,
    de_money_behavior public.enum_money_behavior,
    de_money_origin_class public.enum_money_class,
    de_money_current_class public.enum_money_class,
    de_class_gap_direction public.enum_class_gap_direction,
    de_money_wound text,
    de_time_orientation public.enum_time_orientation_de,
    de_time_wound text,
    de_world_belief public.enum_world_belief,
    de_circumstance_advantages text,
    de_circumstance_disadvantages text,
    de_luck_interpretation integer,
    de_circumstance_wound text,
    de_self_narrative_origin text,
    de_self_narrative_turning_point text,
    de_self_narrative_villain text,
    de_actual_narrative_gap text,
    de_therapy_target text,
    de_blind_spot_category public.enum_blind_spot_cat_de,
    de_blind_spot text,
    de_blind_spot_evidence text,
    de_blind_spot_crack_condition text,
    de_change_capacity public.enum_change_capacity_de,
    de_change_capacity_score integer,
    de_change_condition text,
    de_change_witness text,
    de_arc_function public.enum_arc_function,
    de_operative_cosmology public.enum_operative_cosmology_de,
    de_stated_religion text,
    de_cosmology_conflict text,
    de_meaning_making_style text,
    de_foreclosed_possibilities jsonb,
    de_foreclosure_origins jsonb,
    de_foreclosure_visibility jsonb,
    de_crack_conditions jsonb,
    de_joy_trigger text,
    de_joy_body_location text,
    de_joy_origin text,
    de_forbidden_joy text,
    de_joy_threat_response public.enum_joy_threat_response,
    de_joy_current_access integer,
    body_relationship text,
    body_history text,
    body_currency text,
    body_control_pattern text,
    money_behavior_pattern public.enum_registry_characters_money_behavior_pattern,
    money_behavior_note text,
    time_orientation_v2 public.enum_registry_characters_time_orientation_v2,
    time_orientation_note text,
    change_capacity_v2 public.enum_registry_characters_change_capacity_v2,
    change_conditions text,
    change_blocker text,
    circumstance_advantages text,
    circumstance_disadvantages text,
    luck_belief public.enum_registry_characters_luck_belief,
    luck_belief_vs_stated text,
    actual_narrative text,
    narrative_gap_type public.enum_registry_characters_narrative_gap_type,
    blind_spot_category public.enum_registry_characters_blind_spot_category,
    blind_spot_visible_to uuid[],
    operative_cosmology_v2 public.enum_registry_characters_operative_cosmology_v2,
    cosmology_vs_stated_religion text,
    foreclosed_category public.enum_registry_characters_foreclosed_category,
    foreclosure_origin text,
    foreclosure_vs_stated_want text,
    joy_source text,
    joy_accessibility public.enum_registry_characters_joy_accessibility,
    joy_vs_ambition text,
    portrait_url text,
    age integer,
    birth_year integer,
    cultural_background text,
    nationality text,
    first_language text,
    hometown text,
    current_city public.enum_registry_characters_current_city,
    city_migration_history text,
    class_origin public.enum_registry_characters_class_origin,
    current_class public.enum_registry_characters_current_class,
    class_mobility_direction public.enum_registry_characters_class_mobility_direction,
    family_structure public.enum_registry_characters_family_structure,
    parents_status text,
    sibling_position public.enum_registry_characters_sibling_position,
    sibling_count integer,
    relationship_status public.enum_registry_characters_relationship_status,
    has_children boolean,
    children_ages text,
    education_experience text,
    career_history text,
    years_posting integer,
    physical_presence text,
    demographic_voice_signature text,
    platform_primary public.enum_registry_characters_platform_primary,
    follower_tier public.enum_registry_characters_follower_tier,
    intimate_eligible boolean DEFAULT false NOT NULL,
    celebrity_tier character varying(20),
    platform_presences jsonb,
    public_persona text,
    private_reality text,
    primary_income_source character varying(100),
    income_breakdown jsonb,
    monthly_earnings_range character varying(50),
    clout_score integer,
    drama_magnet boolean,
    social_leverage text,
    content_category character varying(100),
    brand_partnerships jsonb,
    controversy_history jsonb,
    secret_connections jsonb,
    rebrand_history jsonb,
    social_synced_at timestamp with time zone
);


--
-- Name: COLUMN registry_characters.character_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.character_key IS 'Slug-style key, e.g. "husband", "witness"';


--
-- Name: COLUMN registry_characters.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.icon IS 'Emoji icon, e.g. ðŸ”¥';


--
-- Name: COLUMN registry_characters.display_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.display_name IS 'e.g. "The Husband"';


--
-- Name: COLUMN registry_characters.subtitle; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.subtitle IS 'e.g. "The Husband" under selected name';


--
-- Name: COLUMN registry_characters.role_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.role_label IS 'e.g. "Pressure Character Â· Private Marriage Thread"';


--
-- Name: COLUMN registry_characters.pressure_quote; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.pressure_quote IS 'The belief pill quote';


--
-- Name: COLUMN registry_characters.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.description IS 'Page header description paragraph';


--
-- Name: COLUMN registry_characters.name_options; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.name_options IS 'Array of name strings to choose from';


--
-- Name: COLUMN registry_characters.personality_matrix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.personality_matrix IS 'Array of {dimension, value} rows';


--
-- Name: COLUMN registry_characters.extra_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.extra_fields IS 'Flexible additional fields (e.g. Algorithm craft note)';


--
-- Name: COLUMN registry_characters.canon_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.canon_tier IS 'Core Canon / Licensed / Minor';


--
-- Name: COLUMN registry_characters.first_appearance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.first_appearance IS 'Book / Episode of first appearance';


--
-- Name: COLUMN registry_characters.era_introduced; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.era_introduced IS 'Narrative era when introduced';


--
-- Name: COLUMN registry_characters.creator; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.creator IS 'Original creator (You or Licensed Creator)';


--
-- Name: COLUMN registry_characters.core_desire; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.core_desire IS 'What they want most';


--
-- Name: COLUMN registry_characters.core_fear; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.core_fear IS 'What threatens them most';


--
-- Name: COLUMN registry_characters.core_wound; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.core_wound IS 'Backstory scar';


--
-- Name: COLUMN registry_characters.mask_persona; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.mask_persona IS 'How they appear publicly';


--
-- Name: COLUMN registry_characters.truth_persona; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.truth_persona IS 'Who they actually are';


--
-- Name: COLUMN registry_characters.character_archetype; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.character_archetype IS 'Strategist, Dreamer, Performer, etc.';


--
-- Name: COLUMN registry_characters.signature_trait; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.signature_trait IS 'One unforgettable behavior';


--
-- Name: COLUMN registry_characters.emotional_baseline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.emotional_baseline IS 'Confident, guarded, restless, etc.';


--
-- Name: COLUMN registry_characters.aesthetic_dna; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.aesthetic_dna IS '{ era_aesthetic, color_palette, signature_silhouette, signature_accessories, glam_energy, visual_evolution_notes }';


--
-- Name: COLUMN registry_characters.career_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.career_status IS '{ profession, career_goal, reputation_level, brand_relationships, financial_status, public_recognition, ongoing_arc }';


--
-- Name: COLUMN registry_characters.relationships_map; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.relationships_map IS '{ allies, rivals, mentors, love_interests, business_partners, dynamic_notes }';


--
-- Name: COLUMN registry_characters.story_presence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.story_presence IS '{ appears_in_books, appears_in_shows, appears_in_series, current_story_status, unresolved_threads, future_potential }';


--
-- Name: COLUMN registry_characters.voice_signature; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.voice_signature IS '{ speech_pattern, vocabulary_tone, catchphrases, internal_monologue_style, emotional_reactivity }';


--
-- Name: COLUMN registry_characters.evolution_tracking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.evolution_tracking IS '{ version_history, era_changes, personality_shifts, reputation_milestones, visual_transformations }';


--
-- Name: COLUMN registry_characters.wound_depth; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.wound_depth IS '0-10 scale. Increments with pain points and therapy activations.';


--
-- Name: COLUMN registry_characters.belief_pressured; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.belief_pressured IS 'The belief this character puts pressure on in the protagonist.';


--
-- Name: COLUMN registry_characters.emotional_function; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.emotional_function IS 'Running emotional state log. Updated by therapy sessions.';


--
-- Name: COLUMN registry_characters.writer_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.writer_notes IS 'Timestamped notes from therapy, memory, story, and pain point events.';


--
-- Name: COLUMN registry_characters.gender; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.gender IS 'woman | man | non-binary | genderfluid | agender | custom string';


--
-- Name: COLUMN registry_characters.ethnicity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.ethnicity IS 'Open text â€” not constrained to a fixed vocabulary';


--
-- Name: COLUMN registry_characters.species; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.species IS 'human | AI entity | digital being | hybrid | LalaVerse-specific race';


--
-- Name: COLUMN registry_characters.is_alive; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.is_alive IS 'false = deceased â€” affects relationship states and story threading';


--
-- Name: COLUMN registry_characters.death_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.death_date IS 'In-world date of death (not real-world date)';


--
-- Name: COLUMN registry_characters.death_cause; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.death_cause IS 'How the character died â€” in-world narrative';


--
-- Name: COLUMN registry_characters.death_impact; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.death_impact IS 'Ripple effect: who is affected, how relationships shift, story consequences';


--
-- Name: COLUMN registry_characters.depth_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.depth_level IS 'Lifecycle depth indicator. Replaces status as the depth signal. Characters never finalize â€” they deepen.';


--
-- Name: COLUMN registry_characters.want_architecture; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.want_architecture IS '{ surface_want, real_want, forbidden_want } â€” three levels that contradict each other';


--
-- Name: COLUMN registry_characters.wound; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.wound IS '{ description, origin_period, deep_profile_dimensions_affected[], downstream_effects }';


--
-- Name: COLUMN registry_characters.the_mask; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.the_mask IS '{ description, divergence_map[], feed_profile_is_mask }';


--
-- Name: COLUMN registry_characters.living_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.living_state IS 'Current story state â€” inferred at creation, updated as story progresses';


--
-- Name: COLUMN registry_characters.triggers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.triggers IS 'Array of 3-5 specific conditions that destabilize this character. Checked against Feed events.';


--
-- Name: COLUMN registry_characters.blind_spot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.blind_spot IS 'Author-only. Something true about this character they cannot see. Never shown in character view.';


--
-- Name: COLUMN registry_characters.change_capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.change_capacity IS '{ mobility: rigid|fluid|conditional, conditions_for_change, armor_type }';


--
-- Name: COLUMN registry_characters.self_narrative; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.self_narrative IS 'The story this character tells themselves. Almost always partially wrong.';


--
-- Name: COLUMN registry_characters.operative_cosmology; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.operative_cosmology IS 'How this character understands why things happen. Not stated religion â€” actual meaning-making logic.';


--
-- Name: COLUMN registry_characters.foreclosed_possibility; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.foreclosed_possibility IS 'What this character has secretly given up on. Usually invisible even to themselves.';


--
-- Name: COLUMN registry_characters.experience_of_joy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.experience_of_joy IS 'What makes this person fully alive â€” not happy, alive. As specific as the wound.';


--
-- Name: COLUMN registry_characters.time_orientation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.time_orientation IS 'Personal relationship to time that shapes every decision.';


--
-- Name: COLUMN registry_characters.dilemma; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.dilemma IS '{ central_tension, option_a, option_b, what_both_cost } â€” seeded from wound + want at creation';


--
-- Name: COLUMN registry_characters.social_presence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.social_presence IS 'Does this character exist online? Inferred at creation, can be overridden.';


--
-- Name: COLUMN registry_characters.feed_profile_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.feed_profile_id IS 'FK to social_profiles.id â€” set when social_presence = true and Feed profile is created';


--
-- Name: COLUMN registry_characters.ghost_characters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.ghost_characters IS 'Array of { name, mentioned_in, mention_count, promoted } â€” characters referenced but not yet in registry';


--
-- Name: COLUMN registry_characters.family_tree; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.family_tree IS 'Full family generation output â€” members, dynamics, generational wound, social presence per member';


--
-- Name: COLUMN registry_characters.belonging_map; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.belonging_map IS 'Groups, communities, institutions â€” including exclusions. Separate from individual relationships.';


--
-- Name: COLUMN registry_characters.generation_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.generation_context IS '{ world_id, book_id, generated_at, generation_version } â€” what context shaped this character';


--
-- Name: COLUMN registry_characters.prose_overview; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.prose_overview IS 'Auto-generated narrative bio paragraph in italic voice. Generated at creation.';


--
-- Name: COLUMN registry_characters.dimensions_performed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.dimensions_performed IS 'Array of Deep Profile dimension strings being performed publicly';


--
-- Name: COLUMN registry_characters.dimensions_hidden; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.dimensions_hidden IS 'Array of dimensions being hidden';


--
-- Name: COLUMN registry_characters.intimate_eligible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.registry_characters.intimate_eligible IS 'Whether this character is eligible for intimate scene generation.';


--
-- Name: relationship_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relationship_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    relationship_id uuid NOT NULL,
    event_type character varying(80) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    chapter_id uuid,
    story_id uuid,
    story_date character varying(100),
    tension_before integer,
    tension_after integer,
    relationship_stage character varying(80),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: scene_angles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_angles (
    id uuid NOT NULL,
    scene_set_id uuid NOT NULL,
    angle_name character varying(255) NOT NULL,
    angle_label character varying(50) NOT NULL,
    beat_affinity jsonb DEFAULT '[]'::jsonb,
    mood character varying(255),
    runway_prompt text,
    runway_seed character varying(255),
    runway_job_id character varying(255),
    generation_status public.enum_scene_angles_generation_status DEFAULT 'pending'::public.enum_scene_angles_generation_status NOT NULL,
    generation_cost numeric(10,4) DEFAULT 0,
    still_image_url text,
    video_clip_url text,
    thumbnail_url text,
    control_value integer,
    vulnerability_value integer,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    depth_map_url text,
    depth_status public.enum_scene_angles_depth_status
);


--
-- Name: COLUMN scene_angles.angle_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.angle_name IS 'e.g. "Wide Morning", "Vanity Close", "Window Silhouette"';


--
-- Name: COLUMN scene_angles.beat_affinity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.beat_affinity IS 'e.g. [1, 2, 3] â€” Beat numbers this angle naturally serves.';


--
-- Name: COLUMN scene_angles.mood; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.mood IS 'morning | tense | celebratory | intimate | triumphant | neutral';


--
-- Name: COLUMN scene_angles.runway_prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.runway_prompt IS 'base_runway_prompt + angle modifier. What was actually sent to RunwayML.';


--
-- Name: COLUMN scene_angles.runway_seed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.runway_seed IS 'Angle-specific seed. Variation of base set seed.';


--
-- Name: COLUMN scene_angles.runway_job_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.runway_job_id IS 'RunwayML task ID for polling generation status.';


--
-- Name: COLUMN scene_angles.still_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.still_image_url IS 'S3 URL â€” still frame. Used for script/book reference.';


--
-- Name: COLUMN scene_angles.video_clip_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.video_clip_url IS 'S3 URL â€” short video clip. Used for show playback.';


--
-- Name: COLUMN scene_angles.thumbnail_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.thumbnail_url IS 'S3 URL â€” small preview. Used for library browsing.';


--
-- Name: COLUMN scene_angles.control_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.control_value IS '1-10. How much control/agency the angle conveys.';


--
-- Name: COLUMN scene_angles.vulnerability_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_angles.vulnerability_value IS '1-10. How exposed/vulnerable the angle feels.';


--
-- Name: scene_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_assets (
    id uuid NOT NULL,
    scene_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    usage_type character varying(50) DEFAULT 'overlay'::character varying NOT NULL,
    start_timecode character varying(20),
    end_timecode character varying(20),
    layer_order integer DEFAULT 0 NOT NULL,
    opacity numeric(3,2) DEFAULT 1 NOT NULL,
    "position" jsonb DEFAULT '{"x": 0, "y": 0, "width": "100%", "height": "100%"}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    asset_role character varying(50),
    character_name character varying(100),
    position_x integer,
    position_y integer,
    scale numeric(5,2) DEFAULT 1,
    z_index integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    rotation numeric(6,2) DEFAULT 0 NOT NULL,
    width integer,
    height integer,
    is_visible boolean DEFAULT true NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    object_type character varying(50) DEFAULT 'image'::character varying NOT NULL,
    object_label character varying(255),
    flip_x boolean DEFAULT false NOT NULL,
    flip_y boolean DEFAULT false NOT NULL,
    crop_data jsonb,
    style_data jsonb,
    group_id uuid,
    variant_group_id uuid,
    variant_label character varying(100),
    is_active_variant boolean DEFAULT true NOT NULL,
    scene_set_id uuid,
    scene_angle_id uuid
);


--
-- Name: COLUMN scene_assets.rotation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.rotation IS 'Rotation in degrees (0-360)';


--
-- Name: COLUMN scene_assets.width; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.width IS 'Pixel width on canvas';


--
-- Name: COLUMN scene_assets.height; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.height IS 'Pixel height on canvas';


--
-- Name: COLUMN scene_assets.is_visible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.is_visible IS 'Whether object is visible on canvas';


--
-- Name: COLUMN scene_assets.is_locked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.is_locked IS 'Whether object is locked from editing';


--
-- Name: COLUMN scene_assets.object_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.object_type IS 'Object type: image, video, text, shape, overlay, decor';


--
-- Name: COLUMN scene_assets.object_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.object_label IS 'User-facing name (e.g., "Chandelier", "Wall Art")';


--
-- Name: COLUMN scene_assets.flip_x; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.flip_x IS 'Horizontal flip';


--
-- Name: COLUMN scene_assets.flip_y; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.flip_y IS 'Vertical flip';


--
-- Name: COLUMN scene_assets.crop_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.crop_data IS 'Crop rectangle: { x, y, width, height }';


--
-- Name: COLUMN scene_assets.style_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.style_data IS 'Style properties: { fill, stroke, strokeWidth, fontSize, fontFamily, textContent, shadow }';


--
-- Name: COLUMN scene_assets.group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.group_id IS 'Group ID for grouped objects';


--
-- Name: COLUMN scene_assets.variant_group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.variant_group_id IS 'Links objects that are variants of each other';


--
-- Name: COLUMN scene_assets.variant_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.variant_label IS 'Variant label: "open", "closed", "day", "night"';


--
-- Name: COLUMN scene_assets.is_active_variant; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.is_active_variant IS 'Only one variant per group is active/visible';


--
-- Name: COLUMN scene_assets.scene_set_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.scene_set_id IS 'Scene set this object belongs to (alternative to scene_id)';


--
-- Name: COLUMN scene_assets.scene_angle_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_assets.scene_angle_id IS 'Which angle this object is placed on (for angle-specific objects)';


--
-- Name: scene_continuations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_continuations (
    id uuid NOT NULL,
    scene_id uuid NOT NULL,
    continuation_type character varying(50) NOT NULL,
    text text NOT NULL,
    word_count integer,
    chapter_id uuid,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: scene_footage_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_footage_links (
    id uuid NOT NULL,
    script_metadata_id uuid NOT NULL,
    scene_id uuid NOT NULL,
    match_type public.enum_scene_footage_links_match_type DEFAULT 'manual'::public.enum_scene_footage_links_match_type NOT NULL,
    confidence_score numeric(3,2),
    notes text,
    created_at timestamp with time zone NOT NULL,
    created_by character varying(255)
);


--
-- Name: COLUMN scene_footage_links.confidence_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_footage_links.confidence_score IS 'Confidence score for auto-matching (0.00-1.00)';


--
-- Name: COLUMN scene_footage_links.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_footage_links.created_by IS 'User ID who created the link';


--
-- Name: scene_layer_configuration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_layer_configuration (
    id uuid NOT NULL,
    scene_id uuid NOT NULL,
    layers jsonb NOT NULL,
    composite_complexity character varying(50) DEFAULT 'medium'::character varying NOT NULL,
    estimated_render_time_seconds integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN scene_layer_configuration.layers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_layer_configuration.layers IS '5-layer structure with placeholders or actual content';


--
-- Name: COLUMN scene_layer_configuration.composite_complexity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_layer_configuration.composite_complexity IS 'simple | medium | complex';


--
-- Name: scene_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_library (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    video_asset_url text,
    thumbnail_url text,
    title character varying(255),
    description text,
    characters character varying(255)[] DEFAULT (ARRAY[]::character varying[])::character varying(255)[],
    tags character varying(255)[] DEFAULT (ARRAY[]::character varying[])::character varying(255)[],
    duration_seconds numeric(10,3),
    resolution character varying(50),
    file_size_bytes bigint,
    processing_status public.enum_scene_library_processing_status DEFAULT 'uploading'::public.enum_scene_library_processing_status NOT NULL,
    processing_error text,
    s3_key text,
    created_by character varying(255),
    updated_by character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: COLUMN scene_library.show_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.show_id IS 'Show this scene belongs to';


--
-- Name: COLUMN scene_library.video_asset_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.video_asset_url IS 'S3 URL to the video file';


--
-- Name: COLUMN scene_library.thumbnail_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.thumbnail_url IS 'S3 URL to the thumbnail';


--
-- Name: COLUMN scene_library.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.title IS 'Scene title/name';


--
-- Name: COLUMN scene_library.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.description IS 'Scene description';


--
-- Name: COLUMN scene_library.characters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.characters IS 'Characters appearing in this scene';


--
-- Name: COLUMN scene_library.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.tags IS 'Tags for organization (intro clip, b-roll, transition, etc.)';


--
-- Name: COLUMN scene_library.duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.duration_seconds IS 'Video duration in seconds (auto-extracted)';


--
-- Name: COLUMN scene_library.resolution; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.resolution IS 'Video resolution (e.g., 1920x1080)';


--
-- Name: COLUMN scene_library.file_size_bytes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.file_size_bytes IS 'File size in bytes';


--
-- Name: COLUMN scene_library.processing_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.processing_status IS 'Processing status of the video';


--
-- Name: COLUMN scene_library.processing_error; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.processing_error IS 'Error message if processing failed';


--
-- Name: COLUMN scene_library.s3_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.s3_key IS 'S3 object key for the video file';


--
-- Name: COLUMN scene_library.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.created_by IS 'User who created this scene';


--
-- Name: COLUMN scene_library.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_library.updated_by IS 'User who last updated this scene';


--
-- Name: scene_object_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_object_variants (
    id uuid NOT NULL,
    scene_id uuid NOT NULL,
    variant_group_name character varying(255) NOT NULL,
    active_variant_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN scene_object_variants.variant_group_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_object_variants.variant_group_name IS 'Human-readable group name: "Curtains", "Chandelier Style", "Lighting Mood"';


--
-- Name: COLUMN scene_object_variants.active_variant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_object_variants.active_variant_id IS 'Which variant is currently shown';


--
-- Name: COLUMN scene_object_variants.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_object_variants.metadata IS 'Extra configuration for the variant group';


--
-- Name: scene_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_plans (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    episode_brief_id uuid,
    beat_number integer NOT NULL,
    beat_name character varying(255),
    scene_set_id uuid,
    angle_label character varying(50),
    shot_type public.enum_scene_plans_shot_type,
    emotional_intent text,
    transition_in public.enum_scene_plans_transition_in DEFAULT 'cut'::public.enum_scene_plans_transition_in,
    scene_context text,
    director_note text,
    locked boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    ai_suggested boolean DEFAULT false NOT NULL,
    ai_confidence double precision,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    feed_moment jsonb,
    script_lines jsonb
);


--
-- Name: scene_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_proposals (
    id integer NOT NULL,
    book_id uuid,
    chapter_id uuid,
    registry_id uuid,
    arc_stage public.enum_scene_proposals_arc_stage,
    arc_stage_score jsonb,
    wounds_unaddressed jsonb,
    tensions_unresolved jsonb,
    recent_beats jsonb,
    recent_revelations jsonb,
    scene_type public.enum_scene_proposals_scene_type DEFAULT 'general'::public.enum_scene_proposals_scene_type NOT NULL,
    proposed_characters jsonb DEFAULT '[]'::jsonb NOT NULL,
    emotional_stakes text,
    arc_function text,
    scene_brief text NOT NULL,
    why_these_characters text,
    suggested_tone public.enum_scene_proposals_suggested_tone DEFAULT 'tension'::public.enum_scene_proposals_suggested_tone,
    lala_seed_potential boolean DEFAULT false,
    status public.enum_scene_proposals_status DEFAULT 'proposed'::public.enum_scene_proposals_status,
    author_edits jsonb,
    final_brief text,
    final_characters jsonb,
    story_id uuid,
    raw_proposal jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN scene_proposals.arc_stage_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.arc_stage_score IS 'Counts of approved scenes per arc stage at time of proposal';


--
-- Name: COLUMN scene_proposals.wounds_unaddressed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.wounds_unaddressed IS 'Character wounds not touched in recent scenes â€” drove character selection';


--
-- Name: COLUMN scene_proposals.tensions_unresolved; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.tensions_unresolved IS 'Relationship tension states that fed this proposal';


--
-- Name: COLUMN scene_proposals.recent_beats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.recent_beats IS 'Last N continuity beats read before generation';


--
-- Name: COLUMN scene_proposals.recent_revelations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.recent_revelations IS 'Recent character revelation memories that informed the proposal';


--
-- Name: COLUMN scene_proposals.proposed_characters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.proposed_characters IS 'Array of { character_id, character_name, role_in_scene, why_now }';


--
-- Name: COLUMN scene_proposals.emotional_stakes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.emotional_stakes IS 'What is actually at stake emotionally â€” not plot, feeling';


--
-- Name: COLUMN scene_proposals.arc_function; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.arc_function IS 'What this scene advances in the arc â€” what changes because of it';


--
-- Name: COLUMN scene_proposals.scene_brief; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.scene_brief IS 'The fully written scene brief â€” editable by author before firing';


--
-- Name: COLUMN scene_proposals.why_these_characters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.why_these_characters IS 'System reasoning â€” why this cast at this moment in the arc';


--
-- Name: COLUMN scene_proposals.lala_seed_potential; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.lala_seed_potential IS 'System flagged this as a likely Lala emergence moment';


--
-- Name: COLUMN scene_proposals.author_edits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.author_edits IS 'What the author changed before accepting â€” brief edits, character swaps';


--
-- Name: COLUMN scene_proposals.final_brief; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.final_brief IS 'The brief actually sent to generation â€” original or author-edited';


--
-- Name: COLUMN scene_proposals.final_characters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.final_characters IS 'Final character list after author adjustments';


--
-- Name: COLUMN scene_proposals.story_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_proposals.story_id IS 'Set when this proposal fires into the story engine';


--
-- Name: scene_proposals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scene_proposals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scene_proposals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scene_proposals_id_seq OWNED BY public.scene_proposals.id;


--
-- Name: scene_set_episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_set_episodes (
    id uuid NOT NULL,
    scene_set_id uuid NOT NULL,
    episode_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: scene_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_sets (
    id uuid NOT NULL,
    universe_id uuid,
    show_id uuid,
    name character varying(255) NOT NULL,
    scene_type public.enum_scene_sets_scene_type NOT NULL,
    canonical_description text,
    script_context text,
    visual_language jsonb DEFAULT '{}'::jsonb,
    aesthetic_tags jsonb DEFAULT '[]'::jsonb,
    mood_tags jsonb DEFAULT '[]'::jsonb,
    base_runway_prompt text,
    base_runway_seed character varying(255),
    base_runway_model character varying(255) DEFAULT 'gen3a_turbo'::character varying,
    generation_status public.enum_scene_sets_generation_status DEFAULT 'pending'::public.enum_scene_sets_generation_status NOT NULL,
    generation_cost numeric(10,4) DEFAULT 0,
    tier_requirement integer DEFAULT 0 NOT NULL,
    is_franchise_asset boolean DEFAULT false NOT NULL,
    is_unlocked boolean DEFAULT true NOT NULL,
    event_compatibility jsonb DEFAULT '[]'::jsonb,
    status_value public.enum_scene_sets_status_value,
    intimacy_value integer,
    spectacle_value integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    canvas_settings jsonb,
    world_location_id uuid,
    time_of_day character varying(20) DEFAULT NULL::character varying,
    season character varying(20) DEFAULT NULL::character varying,
    scene_spec jsonb,
    room_type character varying(50) DEFAULT NULL::character varying,
    room_connections jsonb,
    room_layout_template character varying(100) DEFAULT NULL::character varying,
    empty_room_url text
);


--
-- Name: COLUMN scene_sets.universe_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.universe_id IS 'Null = not yet assigned to universe. Set for franchise-level scenes.';


--
-- Name: COLUMN scene_sets.show_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.show_id IS 'Null = franchise asset available to all shows. Set for show-specific scenes.';


--
-- Name: COLUMN scene_sets.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.name IS 'e.g. "Lala''s Bedroom â€” Morning Light"';


--
-- Name: COLUMN scene_sets.scene_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.scene_type IS 'Determines which episode beats this scene serves.';


--
-- Name: COLUMN scene_sets.canonical_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.canonical_description IS 'JAWIHP prose. Feeds: RunwayML prompt, script generator context, StoryTeller chapter drafts.';


--
-- Name: COLUMN scene_sets.script_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.script_context IS 'Shorter version of canonical_description for script generator inline use.';


--
-- Name: COLUMN scene_sets.visual_language; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.visual_language IS 'Stores the LalaVerse visual anchor: color_language, material_language, emotional_tone, forbidden_elements.';


--
-- Name: COLUMN scene_sets.aesthetic_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.aesthetic_tags IS 'e.g. ["soft-feminine", "morning-light", "lived-in", "aspirational"]';


--
-- Name: COLUMN scene_sets.mood_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.mood_tags IS 'e.g. ["morning", "calm", "intentional"]';


--
-- Name: COLUMN scene_sets.base_runway_prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.base_runway_prompt IS 'Foundation prompt all angles build from. Derived from canonical_description.';


--
-- Name: COLUMN scene_sets.base_runway_seed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.base_runway_seed IS 'LOCKED on first successful generation. Never overwrite. Keeps room consistent.';


--
-- Name: COLUMN scene_sets.base_runway_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.base_runway_model IS 'RunwayML model used for base generation.';


--
-- Name: COLUMN scene_sets.generation_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.generation_cost IS 'Cumulative RunwayML API spend for this set.';


--
-- Name: COLUMN scene_sets.tier_requirement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.tier_requirement IS 'Minimum rep level to unlock this location. 0 = always available.';


--
-- Name: COLUMN scene_sets.is_franchise_asset; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.is_franchise_asset IS 'True = available to all LalaVerse shows. False = this show only.';


--
-- Name: COLUMN scene_sets.is_unlocked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.is_unlocked IS 'Runtime unlock state based on Lala''s current tier.';


--
-- Name: COLUMN scene_sets.event_compatibility; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.event_compatibility IS 'Event types this location works for, e.g. ["gallery", "gala", "showroom"].';


--
-- Name: COLUMN scene_sets.status_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.status_value IS 'What entering this space signals about Lala''s position.';


--
-- Name: COLUMN scene_sets.intimacy_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.intimacy_value IS '1-10. How private/personal this space feels.';


--
-- Name: COLUMN scene_sets.spectacle_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.spectacle_value IS '1-10. How visually impressive/dramatic this space is.';


--
-- Name: COLUMN scene_sets.canvas_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.canvas_settings IS 'Scene Studio canvas settings for this scene set';


--
-- Name: COLUMN scene_sets.world_location_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.world_location_id IS 'FK to world_locations â€” narrative source for this visual environment';


--
-- Name: COLUMN scene_sets.time_of_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.time_of_day IS 'Default time of day for generation: morning, afternoon, golden_hour, evening, night';


--
-- Name: COLUMN scene_sets.season; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.season IS 'Default season for generation: spring, summer, fall, winter';


--
-- Name: COLUMN scene_sets.scene_spec; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.scene_spec IS 'SceneSpec â€” room layout, zones, objects with continuity rules, camera contracts, and room states';


--
-- Name: COLUMN scene_sets.room_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.room_type IS 'Room type within a property: bedroom, closet, bathroom, living_room, kitchen, hallway, terrace';


--
-- Name: COLUMN scene_sets.room_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.room_connections IS 'Connections to other rooms: [{ object_id, target_scene_set_id, connection_type: "door"|"archway"|"open" }]';


--
-- Name: COLUMN scene_sets.room_layout_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.room_layout_template IS 'Empty room layout template ID used for this room';


--
-- Name: COLUMN scene_sets.empty_room_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_sets.empty_room_url IS 'URL to the empty room base image (before decoration)';


--
-- Name: scene_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scene_templates (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    scene_type character varying(50) DEFAULT 'main'::character varying,
    mood character varying(50),
    location character varying(255),
    duration_seconds integer,
    structure jsonb DEFAULT '{}'::jsonb,
    default_settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    is_public boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN scene_templates.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_templates.created_by IS 'User who created this template';


--
-- Name: COLUMN scene_templates.is_public; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scene_templates.is_public IS 'Whether this template is available to all users';


--
-- Name: scenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenes (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    scene_number integer,
    title character varying(255),
    description text,
    duration_seconds numeric(10,2),
    location character varying(255),
    notes text,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    ai_scene_detected boolean DEFAULT false NOT NULL,
    ai_confidence_score double precision,
    ai_suggested_title character varying(255),
    ai_suggested_description text,
    ai_suggested_tags jsonb DEFAULT '[]'::jsonb,
    ai_metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    thumbnail_id integer,
    assets jsonb DEFAULT '{}'::jsonb,
    scene_type character varying(50),
    production_status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    mood character varying(100),
    characters jsonb DEFAULT '[]'::jsonb,
    props jsonb DEFAULT '[]'::jsonb,
    camera_angles jsonb DEFAULT '[]'::jsonb,
    lighting character varying(100),
    audio_notes text,
    is_locked boolean DEFAULT false NOT NULL,
    trim_start_seconds numeric(10,3),
    trim_end_seconds numeric(10,3),
    script_notes text,
    start_timecode character varying(20),
    end_timecode character varying(20),
    locked_at timestamp with time zone,
    locked_by character varying(255),
    created_by character varying(255),
    updated_by character varying(255),
    raw_footage_s3_key character varying(500),
    layout jsonb,
    duration_auto boolean DEFAULT true NOT NULL,
    ui_elements jsonb DEFAULT '[]'::jsonb,
    dialogue_clips jsonb DEFAULT '[]'::jsonb,
    background_url character varying(1000),
    canvas_settings jsonb,
    scene_set_id uuid,
    scene_angle_id uuid,
    CONSTRAINT scenes_duration_check CHECK (((duration_seconds IS NULL) OR (duration_seconds >= (0)::numeric)))
);


--
-- Name: COLUMN scenes.duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scenes.duration_seconds IS 'Scene duration in seconds (manual or auto-calculated from clips)';


--
-- Name: COLUMN scenes.assets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scenes.assets IS 'Asset references: {lala_outfit_id, guest_asset_id, background_id, ui_elements[]}';


--
-- Name: COLUMN scenes.layout; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scenes.layout IS 'JSONB: Spatial layout data for composition (canvas settings, default positions)';


--
-- Name: COLUMN scenes.duration_auto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scenes.duration_auto IS 'If true, duration is auto-calculated from longest clip';


--
-- Name: COLUMN scenes.background_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scenes.background_url IS 'URL of the background image/video for scene composition';


--
-- Name: COLUMN scenes.canvas_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scenes.canvas_settings IS 'Scene Studio canvas settings: { zoom, panX, panY, gridVisible, snapEnabled, backgroundColor, statePresets }';


--
-- Name: script_edit_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.script_edit_history (
    id uuid NOT NULL,
    script_id uuid,
    edit_data json,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: script_learning_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.script_learning_profiles (
    id uuid NOT NULL,
    show_id uuid,
    profile_data json,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: script_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.script_metadata (
    id uuid NOT NULL,
    script_id integer NOT NULL,
    scene_id character varying(100) NOT NULL,
    scene_type character varying(50) NOT NULL,
    duration_target_seconds integer,
    energy_level character varying(50),
    estimated_clips_needed integer,
    visual_requirements jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: COLUMN script_metadata.scene_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.script_metadata.scene_id IS 'Scene identifier from script (e.g., INTRO, MAIN-1)';


--
-- Name: COLUMN script_metadata.scene_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.script_metadata.scene_type IS 'intro | main | transition | outro';


--
-- Name: COLUMN script_metadata.duration_target_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.script_metadata.duration_target_seconds IS 'AI-suggested duration';


--
-- Name: COLUMN script_metadata.energy_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.script_metadata.energy_level IS 'high | medium | low';


--
-- Name: COLUMN script_metadata.estimated_clips_needed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.script_metadata.estimated_clips_needed IS 'How many clips AI estimates are needed';


--
-- Name: COLUMN script_metadata.visual_requirements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.script_metadata.visual_requirements IS 'Suggested visuals (wardrobe, B-roll, etc.)';


--
-- Name: script_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.script_suggestions (
    id uuid NOT NULL,
    script_id uuid,
    suggestion_text text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: script_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.script_templates (
    id uuid NOT NULL,
    name character varying(255),
    content text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: session_briefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_briefs (
    id integer NOT NULL,
    brief_text text NOT NULL,
    tech_snapshot jsonb,
    story_snapshot jsonb,
    pending_builds jsonb,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN session_briefs.brief_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_briefs.brief_text IS 'The full session brief â€” what the assistant knows walking in';


--
-- Name: COLUMN session_briefs.tech_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_briefs.tech_snapshot IS 'State of deployed systems at time of brief generation';


--
-- Name: COLUMN session_briefs.story_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_briefs.story_snapshot IS 'Arc stage, scene counts, recent character changes';


--
-- Name: COLUMN session_briefs.pending_builds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_briefs.pending_builds IS 'What is next in the build queue';


--
-- Name: session_briefs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.session_briefs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_briefs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.session_briefs_id_seq OWNED BY public.session_briefs.id;


--
-- Name: show_arcs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.show_arcs (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    arc_number integer DEFAULT 1 NOT NULL,
    title character varying(200) NOT NULL,
    tagline character varying(300),
    description text,
    season_number integer DEFAULT 1,
    episode_start integer DEFAULT 1 NOT NULL,
    episode_end integer DEFAULT 24 NOT NULL,
    phases jsonb DEFAULT '"[]"'::jsonb NOT NULL,
    current_phase integer DEFAULT 1 NOT NULL,
    current_episode integer,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    narrative_debt jsonb DEFAULT '"[]"'::jsonb NOT NULL,
    progression_log jsonb DEFAULT '"[]"'::jsonb NOT NULL,
    emotional_temperature character varying(30),
    icon character varying(10) DEFAULT 'ðŸ“–'::character varying,
    color character varying(20) DEFAULT '#B8962E'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: show_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.show_assets (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    usage_context text,
    display_order integer,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN show_assets.usage_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.show_assets.usage_context IS 'How this asset is used in the show context';


--
-- Name: COLUMN show_assets.display_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.show_assets.display_order IS 'Order for displaying assets';


--
-- Name: COLUMN show_assets.is_primary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.show_assets.is_primary IS 'Is this the primary asset for this show';


--
-- Name: show_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.show_configs (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    config_key character varying(255) NOT NULL,
    config_value json,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: shows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shows (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    slug character varying(255) NOT NULL,
    genre character varying(255),
    status public.enum_shows_status DEFAULT 'active'::public.enum_shows_status NOT NULL,
    creator_name character varying(255),
    network character varying(255),
    episode_count integer DEFAULT 0,
    season_count integer DEFAULT 1,
    premiere_date timestamp with time zone,
    metadata json DEFAULT '{}'::json,
    is_active boolean DEFAULT true,
    cover_image_url text,
    cover_s3_key character varying(512),
    icon character varying(10) DEFAULT 'ðŸ“º'::character varying,
    color character varying(7) DEFAULT '#667eea'::character varying,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    universe_id uuid,
    era_name character varying(100),
    era_description text,
    distribution_defaults jsonb DEFAULT '{}'::jsonb,
    style_prefix text
);


--
-- Name: COLUMN shows.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.id IS 'Unique show identifier';


--
-- Name: COLUMN shows.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.name IS 'Show name';


--
-- Name: COLUMN shows.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.description IS 'Show description/synopsis';


--
-- Name: COLUMN shows.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.slug IS 'URL-friendly show identifier';


--
-- Name: COLUMN shows.genre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.genre IS 'Show genre (comma-separated)';


--
-- Name: COLUMN shows.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.status IS 'Current show status';


--
-- Name: COLUMN shows.creator_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.creator_name IS 'Creator or producer name';


--
-- Name: COLUMN shows.network; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.network IS 'Network or platform name';


--
-- Name: COLUMN shows.episode_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.episode_count IS 'Total number of episodes';


--
-- Name: COLUMN shows.season_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.season_count IS 'Number of seasons';


--
-- Name: COLUMN shows.premiere_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.premiere_date IS 'Show premiere date';


--
-- Name: COLUMN shows.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.metadata IS 'Additional metadata (ratings, awards, etc)';


--
-- Name: COLUMN shows.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.is_active IS 'Whether the show is active';


--
-- Name: COLUMN shows.cover_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.cover_image_url IS 'Public URL for show cover image (portrait 2:3 ratio)';


--
-- Name: COLUMN shows.cover_s3_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.cover_s3_key IS 'S3 key for show cover image';


--
-- Name: COLUMN shows.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.icon IS 'Emoji icon for show';


--
-- Name: COLUMN shows.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.color IS 'Brand color for show (hex)';


--
-- Name: COLUMN shows.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.deleted_at IS 'Soft delete timestamp';


--
-- Name: COLUMN shows.era_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.era_name IS 'e.g. Soft Luxury Era, Prime Era';


--
-- Name: COLUMN shows.era_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.era_description IS 'Tone, aesthetic, and vibe for this era';


--
-- Name: COLUMN shows.style_prefix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shows.style_prefix IS 'Per-show design language prefix for AI image generation prompts';


--
-- Name: social_media_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_media_imports (
    id uuid NOT NULL,
    character_key character varying(50) NOT NULL,
    platform character varying(50) NOT NULL,
    source_url text,
    raw_content text NOT NULL,
    detected_voice character varying(100),
    lala_detected boolean DEFAULT false,
    lala_markers jsonb,
    parsed_content jsonb,
    emotional_tags jsonb,
    canon_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    assigned_story_id uuid,
    import_batch character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN social_media_imports.platform; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.platform IS 'instagram, twitter, tiktok, youtube, reddit, custom';


--
-- Name: COLUMN social_media_imports.raw_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.raw_content IS 'Original pasted/imported content';


--
-- Name: COLUMN social_media_imports.detected_voice; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.detected_voice IS 'AI-detected voice/persona';


--
-- Name: COLUMN social_media_imports.lala_detected; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.lala_detected IS 'Whether Lala emergence was detected';


--
-- Name: COLUMN social_media_imports.lala_markers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.lala_markers IS 'Array of Lala emergence markers found';


--
-- Name: COLUMN social_media_imports.parsed_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.parsed_content IS 'AI-parsed structured content';


--
-- Name: COLUMN social_media_imports.emotional_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.emotional_tags IS 'Array of emotional tone tags';


--
-- Name: COLUMN social_media_imports.canon_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.canon_status IS 'pending, canon, rejected, archived';


--
-- Name: COLUMN social_media_imports.assigned_story_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.assigned_story_id IS 'Link to story this import feeds into';


--
-- Name: COLUMN social_media_imports.import_batch; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_media_imports.import_batch IS 'Batch identifier for bulk imports';


--
-- Name: social_profile_followers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_profile_followers (
    id integer NOT NULL,
    social_profile_id integer NOT NULL,
    character_key character varying(100) NOT NULL,
    character_name character varying(200) NOT NULL,
    follow_context text,
    emotional_reaction text,
    influence_type character varying(50),
    influence_level integer DEFAULT 5,
    discovered_in character varying(200),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    follow_motivation character varying(50),
    follow_probability double precision,
    auto_generated boolean DEFAULT false
);


--
-- Name: COLUMN social_profile_followers.character_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.character_key IS 'Protagonist key (e.g. justawoman, lala) â€” not FK to registry, these are story protagonists';


--
-- Name: COLUMN social_profile_followers.character_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.character_name IS 'Display name of the character at time of follow';


--
-- Name: COLUMN social_profile_followers.follow_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.follow_context IS 'Why this character follows them â€” jealousy, aspiration, hate-watching, etc.';


--
-- Name: COLUMN social_profile_followers.emotional_reaction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.emotional_reaction IS 'What this profile triggers in that specific character';


--
-- Name: COLUMN social_profile_followers.influence_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.influence_type IS 'aspiration | envy | comfort | obsession | competition | mirror | escape';


--
-- Name: COLUMN social_profile_followers.influence_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.influence_level IS '1-10: how much this profile affects the character''s decisions/mood';


--
-- Name: COLUMN social_profile_followers.discovered_in; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.discovered_in IS 'Story context where this character found this profile (chapter, scene, etc.)';


--
-- Name: COLUMN social_profile_followers.follow_motivation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.follow_motivation IS 'identity|aspiration|entertainment|information|social_proof|personal|parasocial';


--
-- Name: COLUMN social_profile_followers.follow_probability; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.follow_probability IS '0.0-1.0 â€” computed probability this character would follow this creator';


--
-- Name: COLUMN social_profile_followers.auto_generated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profile_followers.auto_generated IS 'Whether this follow was auto-assigned by the follow engine vs manual';


--
-- Name: social_profile_followers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.social_profile_followers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_profile_followers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.social_profile_followers_id_seq OWNED BY public.social_profile_followers.id;


--
-- Name: social_profile_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_profile_relationships (
    id integer NOT NULL,
    source_profile_id integer NOT NULL,
    target_profile_id integer NOT NULL,
    relationship_type public.enum_social_profile_relationships_relationship_type NOT NULL,
    direction public.enum_social_profile_relationships_direction DEFAULT 'mutual'::public.enum_social_profile_relationships_direction,
    drama_level integer DEFAULT 0,
    public_visibility public.enum_social_profile_relationships_public_visibility DEFAULT 'public'::public.enum_social_profile_relationships_public_visibility,
    description text,
    timeline_notes text,
    narrative_function text,
    auto_generated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: social_profile_relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.social_profile_relationships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_profile_relationships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.social_profile_relationships_id_seq OWNED BY public.social_profile_relationships.id;


--
-- Name: social_profile_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_profile_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text DEFAULT ''::text,
    template_data jsonb DEFAULT '{}'::jsonb,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: social_profile_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.social_profile_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_profile_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.social_profile_templates_id_seq OWNED BY public.social_profile_templates.id;


--
-- Name: social_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_profiles (
    id integer NOT NULL,
    series_id integer,
    handle character varying(100) NOT NULL,
    platform public.enum_social_profiles_platform NOT NULL,
    vibe_sentence text NOT NULL,
    display_name character varying(200),
    follower_tier public.enum_social_profiles_follower_tier,
    follower_count_approx character varying(50),
    content_category character varying(100),
    archetype public.enum_social_profiles_archetype,
    content_persona text,
    real_signal text,
    posting_voice text,
    comment_energy text,
    adult_content_present boolean DEFAULT false,
    adult_content_type text,
    adult_content_framing text,
    parasocial_function text,
    emotional_activation character varying(200),
    watch_reason text,
    what_it_costs_her text,
    current_trajectory public.enum_social_profiles_current_trajectory DEFAULT 'plateauing'::public.enum_social_profiles_current_trajectory,
    trajectory_detail text,
    moment_log jsonb DEFAULT '[]'::jsonb,
    sample_captions jsonb DEFAULT '[]'::jsonb,
    sample_comments jsonb DEFAULT '[]'::jsonb,
    pinned_post text,
    lala_relevance_score integer DEFAULT 0,
    lala_relevance_reason text,
    book_relevance jsonb DEFAULT '[]'::jsonb,
    world_exists boolean DEFAULT false,
    crossing_trigger text,
    crossing_mechanism text,
    crossed_at timestamp with time zone,
    registry_character_id integer,
    status public.enum_social_profiles_status DEFAULT 'draft'::public.enum_social_profiles_status,
    generation_model character varying(60),
    full_profile jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    post_frequency character varying(100),
    engagement_rate character varying(50),
    platform_metrics jsonb DEFAULT '{}'::jsonb,
    geographic_base character varying(200),
    geographic_cluster character varying(100),
    age_range character varying(30),
    relationship_status character varying(100),
    known_associates jsonb DEFAULT '[]'::jsonb,
    revenue_streams jsonb DEFAULT '[]'::jsonb,
    brand_partnerships jsonb DEFAULT '[]'::jsonb,
    audience_demographics jsonb DEFAULT '{}'::jsonb,
    aesthetic_dna jsonb DEFAULT '{}'::jsonb,
    controversy_history jsonb DEFAULT '[]'::jsonb,
    collab_style text,
    influencer_tier_detail text,
    current_state public.enum_social_profiles_current_state,
    previous_state public.enum_social_profiles_previous_state,
    state_changed_at timestamp with time zone,
    justawoman_mirror public.enum_social_profiles_justawoman_mirror,
    mirror_proposed_by_amber text,
    mirror_confirmed boolean DEFAULT false,
    mirror_confirmed_at timestamp with time zone,
    visibility_tier public.enum_social_profiles_visibility_tier DEFAULT 'public'::public.enum_social_profiles_visibility_tier,
    feed_layer public.enum_social_profiles_feed_layer DEFAULT 'real_world'::public.enum_social_profiles_feed_layer NOT NULL,
    city public.enum_social_profiles_city,
    lala_relationship public.enum_social_profiles_lala_relationship,
    career_pressure public.enum_social_profiles_career_pressure,
    mirror_profile_id integer,
    is_justawoman_record boolean DEFAULT false NOT NULL,
    lalaverse_cap_exempt boolean DEFAULT false NOT NULL,
    platform_presences jsonb DEFAULT '{}'::jsonb,
    public_persona text,
    private_reality text,
    front_platform character varying(50),
    real_platform character varying(50),
    celebrity_tier character varying(20) DEFAULT 'accessible'::character varying,
    primary_income_source character varying(100),
    income_breakdown jsonb DEFAULT '{}'::jsonb,
    monthly_earnings_range character varying(50),
    clout_score integer DEFAULT 0,
    drama_magnet boolean DEFAULT false,
    secret_connections jsonb DEFAULT '[]'::jsonb,
    platform_bans jsonb DEFAULT '[]'::jsonb,
    rebrand_history jsonb DEFAULT '[]'::jsonb,
    follow_motivation character varying(30),
    follow_emotion character varying(30),
    follow_trigger text,
    event_excitement integer,
    lifestyle_claim text,
    lifestyle_reality text,
    lifestyle_gap character varying(100),
    beauty_factor integer,
    beauty_description text,
    aesthetic_power text,
    creator_name character varying(200),
    home_location_id uuid,
    frequent_venues jsonb DEFAULT '[]'::jsonb
);


--
-- Name: COLUMN social_profiles.mirror_proposed_by_amber; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.social_profiles.mirror_proposed_by_amber IS 'Amber''s reasoning, 2 sentences';


--
-- Name: social_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.social_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.social_profiles_id_seq OWNED BY public.social_profiles.id;


--
-- Name: stories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stories (
    id uuid NOT NULL,
    show_id uuid,
    episode_id uuid,
    event_id uuid,
    title character varying(500) NOT NULL,
    subtitle character varying(500),
    content text,
    summary text,
    word_count integer DEFAULT 0,
    format character varying(30) DEFAULT 'short_story'::character varying NOT NULL,
    pov_character character varying(100) DEFAULT 'lala'::character varying,
    pov_type character varying(20) DEFAULT 'third_limited'::character varying,
    source_type character varying(20) DEFAULT 'episode'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    generation_model character varying(60),
    generation_tokens integer,
    context_snapshot jsonb DEFAULT '{}'::jsonb,
    published_at timestamp with time zone,
    published_to jsonb DEFAULT '[]'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: story_calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    event_type public.enum_story_calendar_events_event_type NOT NULL,
    start_datetime timestamp with time zone NOT NULL,
    end_datetime timestamp with time zone,
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(255),
    location_name character varying(255),
    location_address text,
    lalaverse_district character varying(255),
    visibility public.enum_story_calendar_events_visibility DEFAULT 'public'::public.enum_story_calendar_events_visibility,
    what_world_knows text,
    what_only_we_know text,
    logged_by public.enum_story_calendar_events_logged_by,
    source_line_id uuid,
    story_position uuid,
    series_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    severity_level character varying(50),
    cultural_category character varying(100),
    activities jsonb,
    phrases jsonb,
    is_micro_event boolean DEFAULT false,
    location_id uuid
);


--
-- Name: COLUMN story_calendar_events.start_datetime; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.start_datetime IS 'Full story-time timestamp in year 8385';


--
-- Name: COLUMN story_calendar_events.recurrence_pattern; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.recurrence_pattern IS 'Format: ''annual:03-15''';


--
-- Name: COLUMN story_calendar_events.lalaverse_district; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.lalaverse_district IS 'e.g. ''The Velvet District''';


--
-- Name: COLUMN story_calendar_events.what_world_knows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.what_world_knows IS 'Public version of this event';


--
-- Name: COLUMN story_calendar_events.what_only_we_know; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.what_only_we_know IS 'Author layer â€” the actual truth';


--
-- Name: COLUMN story_calendar_events.severity_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.severity_level IS 'major | largest_event | awards_peak | null';


--
-- Name: COLUMN story_calendar_events.cultural_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.cultural_category IS 'fashion, beauty, lifestyle, entrepreneur, music, nightlife, awards, etc.';


--
-- Name: COLUMN story_calendar_events.activities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.activities IS 'Array of activity strings for this event';


--
-- Name: COLUMN story_calendar_events.phrases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.phrases IS 'Array of iconic phrase strings for this event';


--
-- Name: COLUMN story_calendar_events.is_micro_event; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.is_micro_event IS 'True for floating events with no fixed month';


--
-- Name: COLUMN story_calendar_events.location_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_calendar_events.location_id IS 'FK to WorldLocation â€” links calendar event to a specific location';


--
-- Name: story_clock_markers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_clock_markers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    calendar_date timestamp with time zone,
    sequence_order integer DEFAULT 0 NOT NULL,
    is_present boolean DEFAULT false,
    series_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN story_clock_markers.calendar_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_clock_markers.calendar_date IS 'Actual story-time date (year 8385 calendar)';


--
-- Name: COLUMN story_clock_markers.sequence_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_clock_markers.sequence_order IS 'Lower = earlier in the story';


--
-- Name: COLUMN story_clock_markers.is_present; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_clock_markers.is_present IS 'Only one true at a time per series_id; enforce in API';


--
-- Name: COLUMN story_clock_markers.series_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_clock_markers.series_id IS 'Scoped to novel or show; never cross';


--
-- Name: story_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id uuid NOT NULL,
    revision_number integer DEFAULT 1 NOT NULL,
    text text NOT NULL,
    word_count integer,
    revision_type character varying(50) DEFAULT 'edit'::character varying NOT NULL,
    revision_source character varying(50),
    change_summary text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: story_task_arcs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_task_arcs (
    id uuid NOT NULL,
    character_key character varying(50) NOT NULL,
    display_name character varying(255),
    world character varying(50),
    narrative_spine jsonb,
    tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: story_texture; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_texture (
    id uuid NOT NULL,
    story_number integer NOT NULL,
    character_key character varying(255) NOT NULL,
    registry_id uuid,
    inner_thought_type public.enum_story_texture_inner_thought_type,
    inner_thought_text text,
    inner_thought_confirmed boolean DEFAULT false,
    conflict_eligible boolean DEFAULT false,
    conflict_trigger text,
    conflict_surface_text text,
    conflict_subtext text,
    conflict_silence_beat text,
    conflict_resolution_type public.enum_story_texture_conflict_resolution_type,
    conflict_confirmed boolean DEFAULT false,
    body_narrator_text text,
    body_narrator_confirmed boolean DEFAULT false,
    private_moment_eligible boolean DEFAULT false,
    private_moment_setting character varying(255),
    private_moment_held_thing text,
    private_moment_sensory_anchor text,
    private_moment_text text,
    private_moment_confirmed boolean DEFAULT false,
    post_text text,
    post_platform public.enum_story_texture_post_platform,
    post_audience_bestie text,
    post_audience_paying_man text,
    post_audience_competitive_woman text,
    post_confirmed boolean DEFAULT false,
    bleed_text text,
    bleed_confirmed boolean DEFAULT false,
    phone_appeared boolean DEFAULT false,
    phone_context text,
    amber_notes jsonb,
    amber_read_at timestamp with time zone,
    fully_confirmed boolean DEFAULT false,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    mom_tone_eligible boolean DEFAULT false,
    mom_tone_trigger text,
    mom_tone_text text,
    mom_tone_child character varying(255),
    mom_tone_confirmed boolean DEFAULT false,
    aftermath_eligible boolean DEFAULT false,
    aftermath_line_text text,
    aftermath_confirmed boolean DEFAULT false,
    memory_proposal_type public.enum_story_texture_memory_proposal_type,
    memory_proposal_detail text,
    memory_proposal_text text,
    memory_proposal_confirmed boolean DEFAULT false,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN story_texture.inner_thought_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.inner_thought_text IS 'Italicized interior insert. Appears after charged moment in story.';


--
-- Name: COLUMN story_texture.conflict_trigger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.conflict_trigger IS 'The specific thing that started it 3 minutes ago.';


--
-- Name: COLUMN story_texture.conflict_surface_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.conflict_surface_text IS 'What they are arguing about on the surface.';


--
-- Name: COLUMN story_texture.conflict_subtext; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.conflict_subtext IS 'What each character is actually fighting about underneath.';


--
-- Name: COLUMN story_texture.conflict_silence_beat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.conflict_silence_beat IS 'The moment where someone stops talking.';


--
-- Name: COLUMN story_texture.body_narrator_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.body_narrator_text IS 'What her body knows before she does.';


--
-- Name: COLUMN story_texture.private_moment_eligible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.private_moment_eligible IS 'True if this story is the chapter position point for a private moment.';


--
-- Name: COLUMN story_texture.private_moment_held_thing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.private_moment_held_thing IS 'What she is not doing yet. What she is waiting to do.';


--
-- Name: COLUMN story_texture.private_moment_sensory_anchor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.private_moment_sensory_anchor IS 'One specific physical detail. No metaphors.';


--
-- Name: COLUMN story_texture.private_moment_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.private_moment_text IS 'Full private moment. Ends without completing.';


--
-- Name: COLUMN story_texture.post_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.post_text IS 'What she posted. Sounds like confidence. Reader knows what is underneath.';


--
-- Name: COLUMN story_texture.post_audience_bestie; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.post_audience_bestie IS 'How the bestie who felt seen received this post.';


--
-- Name: COLUMN story_texture.post_audience_paying_man; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.post_audience_paying_man IS 'How the man who opened his wallet received this post.';


--
-- Name: COLUMN story_texture.post_audience_competitive_woman; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.post_audience_competitive_woman IS 'How the woman who felt competitive received this post.';


--
-- Name: COLUMN story_texture.bleed_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.bleed_text IS 'Story 47 only. Lala voice bleeding through JustAWoman narrative.';


--
-- Name: COLUMN story_texture.phone_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.phone_context IS 'How the phone appeared in this story. Weight increases with each appearance.';


--
-- Name: COLUMN story_texture.amber_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.amber_notes IS 'What Amber noticed. Array of { type, note } objects.';


--
-- Name: COLUMN story_texture.fully_confirmed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.story_texture.fully_confirmed IS 'True when author has confirmed all applicable texture layers.';


--
-- Name: story_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_id uuid,
    universe_id uuid,
    thread_name character varying(255) NOT NULL,
    description text,
    thread_type character varying(80) DEFAULT 'subplot'::character varying NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    introduced_chapter_id uuid,
    resolved_chapter_id uuid,
    characters_involved jsonb DEFAULT '[]'::jsonb,
    key_events jsonb DEFAULT '[]'::jsonb,
    last_referenced_chapter_id uuid,
    chapters_since_last_reference integer DEFAULT 0,
    tension_level integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: storyteller_books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storyteller_books (
    id uuid NOT NULL,
    show_id uuid,
    character_name character varying(255),
    season_label character varying(100),
    week_label character varying(100),
    title character varying(500),
    subtitle character varying(500),
    status public.enum_storyteller_books_status DEFAULT 'draft'::public.enum_storyteller_books_status NOT NULL,
    compiled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    series_id uuid,
    era_name character varying(100),
    era_description text,
    primary_pov character varying(50),
    timeline_position character varying(50),
    description text,
    canon_status character varying(50) DEFAULT 'draft'::character varying,
    front_matter jsonb,
    back_matter jsonb,
    author_name character varying(255),
    deleted_at timestamp with time zone,
    book_type character varying(20) DEFAULT 'standard'::character varying,
    character_key character varying(50),
    world_id character varying(20),
    current_arc_stage public.enum_storyteller_books_current_arc_stage DEFAULT 'establishment'::public.enum_storyteller_books_current_arc_stage,
    arc_stage_scores jsonb DEFAULT '{"crisis": 0, "pressure": 0, "integration": 0, "establishment": 0}'::jsonb,
    book1_throughline jsonb
);


--
-- Name: COLUMN storyteller_books.series_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.series_id IS 'Which series does this book belong to';


--
-- Name: COLUMN storyteller_books.primary_pov; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.primary_pov IS 'First Person / Close Third / Multi';


--
-- Name: COLUMN storyteller_books.timeline_position; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.timeline_position IS 'Pre-Show / Early Show / Prime Era / Legacy';


--
-- Name: COLUMN storyteller_books.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.description IS 'Book description / synopsis';


--
-- Name: COLUMN storyteller_books.front_matter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.front_matter IS 'Front matter: { dedication, epigraph, foreword, preface, copyright }';


--
-- Name: COLUMN storyteller_books.back_matter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.back_matter IS 'Back matter: { appendix, glossary, bibliography, notes, about_author, acknowledgments }';


--
-- Name: COLUMN storyteller_books.author_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.author_name IS 'Author display name for title page and About the Author';


--
-- Name: COLUMN storyteller_books.book_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.book_type IS 'standard | story_engine';


--
-- Name: COLUMN storyteller_books.character_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.character_key IS 'Matches CHARACTER_DNA key: justawoman, david, dana, lala, chloe, jade';


--
-- Name: COLUMN storyteller_books.world_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.world_id IS 'book1 or lalaverse';


--
-- Name: COLUMN storyteller_books.arc_stage_scores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.arc_stage_scores IS 'Count of approved scenes per arc stage â€” drives Scene Proposer intelligence';


--
-- Name: COLUMN storyteller_books.book1_throughline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_books.book1_throughline IS 'Franchise Bible context injected into scene proposer â€” production gap, creator mirror, identity protection';


--
-- Name: storyteller_chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storyteller_chapters (
    id uuid NOT NULL,
    book_id uuid NOT NULL,
    chapter_number integer NOT NULL,
    title character varying(500) NOT NULL,
    badge character varying(255),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    primary_character_id uuid,
    characters_present jsonb DEFAULT '[]'::jsonb,
    pov character varying(50) DEFAULT 'first_person'::character varying,
    scene_goal text,
    emotional_state_start text,
    emotional_state_end text,
    theme character varying(255),
    chapter_notes text,
    interview_answers jsonb,
    pnos_act character varying(20) DEFAULT NULL::character varying,
    question_direction character varying(20),
    exit_emotion character varying(50),
    exit_emotion_note text,
    emotional_temperature integer,
    draft_prose text,
    chapter_type character varying(50) DEFAULT 'chapter'::character varying,
    part_number integer,
    part_title character varying(255),
    deleted_at timestamp with time zone,
    story_number integer,
    story_phase character varying(20),
    story_type character varying(20),
    task_brief jsonb,
    word_count integer DEFAULT 0,
    consistency_checked boolean DEFAULT false,
    new_character_introduced character varying(100),
    tone text,
    setting text,
    conflict text,
    stakes text,
    hooks text
);


--
-- Name: COLUMN storyteller_chapters.primary_character_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.primary_character_id IS 'Primary character this chapter focuses on';


--
-- Name: COLUMN storyteller_chapters.characters_present; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.characters_present IS 'Array of registry_character UUIDs present in this chapter';


--
-- Name: COLUMN storyteller_chapters.pov; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.pov IS 'first_person | close_third | multi_pov | lala_voice';


--
-- Name: COLUMN storyteller_chapters.scene_goal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.scene_goal IS 'What must happen in this chapter â€” the narrative purpose';


--
-- Name: COLUMN storyteller_chapters.emotional_state_start; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.emotional_state_start IS 'Where the primary character begins emotionally';


--
-- Name: COLUMN storyteller_chapters.emotional_state_end; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.emotional_state_end IS 'Where the primary character ends emotionally';


--
-- Name: COLUMN storyteller_chapters.theme; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.theme IS 'The chapter core theme â€” e.g. Admiration turning into self-comparison';


--
-- Name: COLUMN storyteller_chapters.chapter_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.chapter_notes IS 'Private writer notes â€” never included in export';


--
-- Name: COLUMN storyteller_chapters.pnos_act; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.pnos_act IS 'PNOS act: act_1 | act_2 | act_3 | act_4 | act_5';


--
-- Name: COLUMN storyteller_chapters.chapter_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.chapter_type IS 'prologue | chapter | interlude | epilogue | afterword';


--
-- Name: COLUMN storyteller_chapters.part_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.part_number IS 'Groups chapters into Parts/Acts (1 = Part I, 2 = Part II, etc.)';


--
-- Name: COLUMN storyteller_chapters.part_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.part_title IS 'Display title for the Part/Act grouping';


--
-- Name: COLUMN storyteller_chapters.story_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.story_number IS '1-50 arc position';


--
-- Name: COLUMN storyteller_chapters.story_phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.story_phase IS 'establishment | pressure | crisis | integration';


--
-- Name: COLUMN storyteller_chapters.story_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.story_type IS 'internal | collision | wrong_win';


--
-- Name: COLUMN storyteller_chapters.task_brief; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.task_brief IS 'Full task brief JSON from generate-story-tasks';


--
-- Name: COLUMN storyteller_chapters.new_character_introduced; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_chapters.new_character_introduced IS 'Name of new character introduced in this story, if any';


--
-- Name: storyteller_echoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storyteller_echoes (
    id uuid NOT NULL,
    book_id uuid NOT NULL,
    source_chapter_id uuid,
    source_line_id uuid,
    source_line_content text,
    target_chapter_id uuid,
    note text NOT NULL,
    landing_note text,
    status character varying(20) DEFAULT 'planted'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN storyteller_echoes.source_line_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_echoes.source_line_content IS 'Snapshot of line at time of planting';


--
-- Name: COLUMN storyteller_echoes.note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_echoes.note IS 'What this plants â€” narrative seed description';


--
-- Name: COLUMN storyteller_echoes.landing_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_echoes.landing_note IS 'How it should feel when it lands';


--
-- Name: COLUMN storyteller_echoes.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_echoes.status IS 'planted | landed | orphaned';


--
-- Name: COLUMN storyteller_echoes.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_echoes.deleted_at IS 'Soft delete (global paranoid: true)';


--
-- Name: storyteller_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storyteller_lines (
    id uuid NOT NULL,
    chapter_id uuid NOT NULL,
    group_label character varying(255),
    text text NOT NULL,
    status public.enum_storyteller_lines_status DEFAULT 'pending'::public.enum_storyteller_lines_status NOT NULL,
    source_tags json,
    confidence double precision,
    original_text text,
    edited_at timestamp with time zone,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    voice_type character varying(50) DEFAULT 'unattributed'::character varying,
    voice_confidence double precision,
    voice_confirmed boolean DEFAULT false,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN storyteller_lines.group_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_lines.group_label IS 'e.g. "Arc Summary", "Character Shift Detected", "Relationship Thread"';


--
-- Name: COLUMN storyteller_lines.source_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_lines.source_tags IS 'Array of source tag strings, e.g. ["voice Â· feb 14", "goal entry"]';


--
-- Name: COLUMN storyteller_lines.original_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_lines.original_text IS 'Original text before user edit';


--
-- Name: storyteller_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storyteller_memories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    line_id uuid NOT NULL,
    character_id uuid,
    type character varying(100) NOT NULL,
    statement text NOT NULL,
    confidence numeric(4,3) DEFAULT 0 NOT NULL,
    confirmed boolean DEFAULT false NOT NULL,
    protected boolean DEFAULT false NOT NULL,
    source_type character varying(100),
    source_ref character varying(255),
    tags jsonb DEFAULT '[]'::jsonb,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category character varying(100),
    coaching_angle text,
    career_echo_content_type character varying(100),
    career_echo_title character varying(255),
    career_echo_description text,
    career_echo_lala_impact text,
    career_echo_confirmed boolean DEFAULT false
);


--
-- Name: COLUMN storyteller_memories.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_memories.category IS 'Pain point category: comparison_spiral | visibility_gap | identity_drift | financial_risk | consistency_collapse | clarity_deficit | external_validation | restart_cycle';


--
-- Name: COLUMN storyteller_memories.coaching_angle; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_memories.coaching_angle IS 'What a coach would say to someone experiencing this pain point. Auto-generated. Never shown in manuscript.';


--
-- Name: COLUMN storyteller_memories.career_echo_content_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_memories.career_echo_content_type IS 'What this pain point becomes in the world: post | framework | coaching_offer | video | podcast | book_chapter | course | null';


--
-- Name: COLUMN storyteller_memories.career_echo_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_memories.career_echo_title IS 'Title of the content this becomes. e.g. "The Comparison Spiral Framework"';


--
-- Name: COLUMN storyteller_memories.career_echo_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_memories.career_echo_description IS 'What this content looks like in JustAWoman''s world. How Lala might encounter it.';


--
-- Name: COLUMN storyteller_memories.career_echo_lala_impact; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_memories.career_echo_lala_impact IS 'How this content lands for Lala in Series 2. What it shifts for her. Never shown to JustAWoman.';


--
-- Name: COLUMN storyteller_memories.career_echo_confirmed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_memories.career_echo_confirmed IS 'Author has confirmed this echo is canon â€” it will appear in Series 2.';


--
-- Name: storyteller_stories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storyteller_stories (
    id uuid NOT NULL,
    character_key character varying(50) NOT NULL,
    story_number integer NOT NULL,
    title character varying(500) NOT NULL,
    text text NOT NULL,
    phase character varying(50),
    story_type character varying(50),
    word_count integer,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    task_brief jsonb,
    consistency_result jsonb,
    therapy_memories jsonb,
    new_character boolean DEFAULT false,
    new_character_name character varying(255),
    new_character_role character varying(255),
    opening_line text,
    editor_notes text,
    version integer DEFAULT 1,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    tone_dial character varying(50),
    characters_in_scene jsonb,
    registry_dossiers_used jsonb,
    scene_brief text,
    story_a text,
    story_b text,
    story_c text,
    evaluation_result jsonb,
    plot_memory_proposal jsonb,
    character_revelation_proposal jsonb,
    registry_update_proposals jsonb,
    memory_confirmed_at timestamp with time zone,
    written_back_at timestamp with time zone,
    written_back_chapter_id uuid,
    pipeline_step character varying(50) DEFAULT NULL::character varying,
    franchise_guard_result jsonb,
    continuity_check_result jsonb,
    enrichment_status jsonb
);


--
-- Name: COLUMN storyteller_stories.character_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_stories.character_key IS 'justawoman, david, dana, chloe, jade, lala';


--
-- Name: COLUMN storyteller_stories.story_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_stories.story_number IS '1-50 within the arc';


--
-- Name: COLUMN storyteller_stories.phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_stories.phase IS 'establishment, pressure, crisis, integration';


--
-- Name: COLUMN storyteller_stories.story_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_stories.story_type IS 'internal, collision, wrong_win';


--
-- Name: COLUMN storyteller_stories.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_stories.status IS 'draft, approved, rejected, published';


--
-- Name: COLUMN storyteller_stories.task_brief; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_stories.task_brief IS 'Original task brief from story engine';


--
-- Name: COLUMN storyteller_stories.consistency_result; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_stories.consistency_result IS 'Last consistency check result';


--
-- Name: COLUMN storyteller_stories.therapy_memories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.storyteller_stories.therapy_memories IS 'Extracted therapy memories';


--
-- Name: therapy_pending_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapy_pending_sessions (
    id uuid NOT NULL,
    character_id uuid NOT NULL,
    character_name character varying(255),
    character_slug character varying(255),
    character_type character varying(255),
    knock_message text,
    wound text,
    emotional_state jsonb,
    trigger_dimension character varying(255),
    trigger_value integer,
    status character varying(255) DEFAULT 'waiting'::character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: thumbnail_compositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thumbnail_compositions (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    template_id uuid,
    name character varying(255),
    description text,
    background_frame_asset_id uuid,
    lala_asset_id uuid,
    guest_asset_id uuid,
    justawomen_asset_id uuid,
    justawomaninherprime_asset_id uuid,
    selected_formats jsonb DEFAULT '[]'::jsonb,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    current_version integer DEFAULT 1,
    version_history jsonb DEFAULT '{}'::jsonb,
    last_modified_by character varying(100),
    modification_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_primary boolean DEFAULT false,
    composition_config jsonb DEFAULT '{}'::jsonb,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN thumbnail_compositions.is_primary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_compositions.is_primary IS 'Whether this is the primary/canonical composition for the episode';


--
-- Name: COLUMN thumbnail_compositions.composition_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_compositions.composition_config IS 'Stores visibility toggles, text field values, and per-composition overrides';


--
-- Name: COLUMN thumbnail_compositions.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_compositions.deleted_at IS 'Soft delete timestamp - null means record is active';


--
-- Name: thumbnail_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thumbnail_templates (
    id uuid NOT NULL,
    show_id uuid,
    name character varying(200) NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    required_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    optional_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    conditional_roles jsonb DEFAULT '{}'::jsonb NOT NULL,
    paired_roles jsonb DEFAULT '{}'::jsonb NOT NULL,
    layout_config jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN thumbnail_templates.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.id IS 'Template ID';


--
-- Name: COLUMN thumbnail_templates.show_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.show_id IS 'Show ID if show-specific, NULL for global templates';


--
-- Name: COLUMN thumbnail_templates.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.name IS 'Display name: Styling Adventures v1';


--
-- Name: COLUMN thumbnail_templates.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.description IS 'Template description';


--
-- Name: COLUMN thumbnail_templates.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.version IS 'Template version number';


--
-- Name: COLUMN thumbnail_templates.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.is_active IS 'Whether template is active';


--
-- Name: COLUMN thumbnail_templates.required_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.required_roles IS 'Array of required asset roles';


--
-- Name: COLUMN thumbnail_templates.optional_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.optional_roles IS 'Array of optional asset roles';


--
-- Name: COLUMN thumbnail_templates.conditional_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.conditional_roles IS 'Conditional role logic: {role: {if: condition, required: boolean}}';


--
-- Name: COLUMN thumbnail_templates.paired_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.paired_roles IS 'Paired roles that must be used together';


--
-- Name: COLUMN thumbnail_templates.layout_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.thumbnail_templates.layout_config IS 'Layer configuration for rendering';


--
-- Name: thumbnails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thumbnails (
    id integer NOT NULL,
    "episodeId" uuid NOT NULL,
    "s3Bucket" character varying(255) NOT NULL,
    "s3Key" character varying(512) NOT NULL,
    "fileSizeBytes" bigint,
    "mimeType" public."enum_thumbnails_mimeType" DEFAULT 'image/jpeg'::public."enum_thumbnails_mimeType",
    "widthPixels" integer,
    "heightPixels" integer,
    format public.enum_thumbnails_format DEFAULT 'thumbnail'::public.enum_thumbnails_format,
    "thumbnailType" public."enum_thumbnails_thumbnailType" DEFAULT 'primary'::public."enum_thumbnails_thumbnailType",
    "positionSeconds" numeric(10,2),
    "generatedAt" timestamp with time zone,
    "qualityRating" public."enum_thumbnails_qualityRating",
    url character varying(1024),
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: thumbnails_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.thumbnails_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: thumbnails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.thumbnails_id_seq OWNED BY public.thumbnails.id;


--
-- Name: timeline_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timeline_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid NOT NULL,
    beats jsonb DEFAULT '[]'::jsonb,
    markers jsonb DEFAULT '[]'::jsonb,
    audio_clips jsonb DEFAULT '[]'::jsonb,
    character_clips jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    keyframes jsonb DEFAULT '[]'::jsonb
);


--
-- Name: COLUMN timeline_data.keyframes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_data.keyframes IS 'Array of keyframe objects for element animations';


--
-- Name: timeline_placements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timeline_placements (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    placement_type public.enum_timeline_placements_placement_type NOT NULL,
    asset_id uuid,
    wardrobe_item_id uuid,
    scene_id uuid,
    attachment_point public.enum_timeline_placements_attachment_point DEFAULT 'scene-start'::public.enum_timeline_placements_attachment_point,
    offset_seconds numeric(10,3) DEFAULT 0,
    absolute_timestamp numeric(10,3),
    track_number integer DEFAULT 2 NOT NULL,
    duration numeric(10,3),
    z_index integer DEFAULT 10,
    properties jsonb DEFAULT '{}'::jsonb,
    "character" character varying(100),
    label character varying(255),
    visual_role public.enum_timeline_placements_visual_role DEFAULT 'overlay'::public.enum_timeline_placements_visual_role NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN timeline_placements.episode_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.episode_id IS 'Episode this placement belongs to';


--
-- Name: COLUMN timeline_placements.placement_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.placement_type IS 'Type of item being placed';


--
-- Name: COLUMN timeline_placements.asset_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.asset_id IS 'Asset reference (for asset placements)';


--
-- Name: COLUMN timeline_placements.wardrobe_item_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.wardrobe_item_id IS 'Wardrobe reference (for wardrobe placements)';


--
-- Name: COLUMN timeline_placements.scene_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.scene_id IS 'Scene this placement is attached to (null for time-based)';


--
-- Name: COLUMN timeline_placements.attachment_point; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.attachment_point IS 'Where in the scene this attaches';


--
-- Name: COLUMN timeline_placements.offset_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.offset_seconds IS 'Offset from attachment point (seconds)';


--
-- Name: COLUMN timeline_placements.absolute_timestamp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.absolute_timestamp IS 'Absolute time in episode (for time-based placements)';


--
-- Name: COLUMN timeline_placements.track_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.track_number IS 'Timeline track (1=scenes, 2=assets, 3=audio)';


--
-- Name: COLUMN timeline_placements.duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.duration IS 'Display duration (seconds, null for wardrobe events)';


--
-- Name: COLUMN timeline_placements.z_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.z_index IS 'Layering order within track';


--
-- Name: COLUMN timeline_placements.properties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.properties IS 'Custom properties (opacity, position, effects, etc.)';


--
-- Name: COLUMN timeline_placements."character"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements."character" IS 'Character name (for wardrobe placements)';


--
-- Name: COLUMN timeline_placements.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.label IS 'User-friendly label for this placement';


--
-- Name: COLUMN timeline_placements.visual_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_placements.visual_role IS 'Visual hierarchy: primary-visual (replaces main video) or overlay (layers on top)';


--
-- Name: ui_overlay_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ui_overlay_types (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    type_key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(50) DEFAULT 'icon'::character varying NOT NULL,
    beat character varying(100),
    description text,
    prompt text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    lifecycle character varying(20) DEFAULT 'permanent'::character varying NOT NULL,
    opens_screen character varying(100),
    is_home boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN ui_overlay_types.show_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.show_id IS 'Show this overlay type belongs to';


--
-- Name: COLUMN ui_overlay_types.type_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.type_key IS 'Unique key within show (e.g., phone_icon, custom_frame_1)';


--
-- Name: COLUMN ui_overlay_types.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.category IS 'frame or icon';


--
-- Name: COLUMN ui_overlay_types.beat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.beat IS 'Episode beat reference (e.g., Beat 3, Various)';


--
-- Name: COLUMN ui_overlay_types.prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.prompt IS 'Image generation prompt';


--
-- Name: COLUMN ui_overlay_types.sort_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.sort_order IS 'Display order (lower = first)';


--
-- Name: COLUMN ui_overlay_types.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.deleted_at IS 'Soft delete timestamp';


--
-- Name: COLUMN ui_overlay_types.lifecycle; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.lifecycle IS 'permanent â€” generated once, reused forever | per_episode â€” new version each episode | variant â€” base frame permanent, content changes';


--
-- Name: COLUMN ui_overlay_types.opens_screen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.opens_screen IS 'type_key of the screen this icon navigates to (same show)';


--
-- Name: COLUMN ui_overlay_types.is_home; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ui_overlay_types.is_home IS 'Whether this screen is the phone home screen (only one per show)';


--
-- Name: universe_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.universe_characters (
    id uuid NOT NULL,
    universe_id uuid NOT NULL,
    registry_character_id uuid,
    name character varying(255) NOT NULL,
    type character varying(50),
    canon_tier character varying(50) DEFAULT 'supporting_canon'::character varying,
    role text,
    first_appeared timestamp with time zone,
    first_book_id uuid,
    first_show_id uuid,
    status character varying(50) DEFAULT 'active'::character varying,
    portrait_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    world_exists boolean DEFAULT true
);


--
-- Name: COLUMN universe_characters.registry_character_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.registry_character_id IS 'Links back to the registry character that was promoted';


--
-- Name: COLUMN universe_characters.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.name IS 'Canonical name at universe level';


--
-- Name: COLUMN universe_characters.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.type IS 'pressure | mirror | support | shadow | special | protagonist';


--
-- Name: COLUMN universe_characters.canon_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.canon_tier IS 'core_canon | supporting_canon | minor_canon';


--
-- Name: COLUMN universe_characters.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.role IS 'Universe-level role description';


--
-- Name: COLUMN universe_characters.first_appeared; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.first_appeared IS 'When this character first appeared in canon';


--
-- Name: COLUMN universe_characters.first_book_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.first_book_id IS 'First book this character appeared in';


--
-- Name: COLUMN universe_characters.first_show_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.first_show_id IS 'First show this character appeared in';


--
-- Name: COLUMN universe_characters.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.status IS 'active | evolving | archived';


--
-- Name: COLUMN universe_characters.portrait_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.portrait_url IS 'S3 URL for 2D/3D character portrait';


--
-- Name: COLUMN universe_characters.world_exists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universe_characters.world_exists IS 'TRUE = exists in the world (canon eligible). FALSE = psychological force only (PNOS registry only).';


--
-- Name: universes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.universes (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    core_themes jsonb DEFAULT '[]'::jsonb,
    world_rules text,
    pnos_beliefs text,
    narrative_economy text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    book1_character_creation_open boolean DEFAULT false,
    lalaverse_character_creation_open boolean DEFAULT false
);


--
-- Name: COLUMN universes.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universes.slug IS 'e.g. lalaverse';


--
-- Name: COLUMN universes.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universes.description IS 'Top-level philosophy. What is this world about?';


--
-- Name: COLUMN universes.core_themes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universes.core_themes IS 'Array of theme strings e.g. ["identity","ambition","becoming"]';


--
-- Name: COLUMN universes.world_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universes.world_rules IS 'Cause & effect, consequence echoes, universe laws';


--
-- Name: COLUMN universes.pnos_beliefs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universes.pnos_beliefs IS 'PNOS belief system â€” the psychological operating system';


--
-- Name: COLUMN universes.narrative_economy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universes.narrative_economy IS 'Prime Coins, Dream Fund, reputation mechanics';


--
-- Name: COLUMN universes.book1_character_creation_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universes.book1_character_creation_open IS 'Whether Book1 world accepts new characters';


--
-- Name: COLUMN universes.lalaverse_character_creation_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.universes.lalaverse_character_creation_open IS 'Whether LalaVerse world accepts new characters';


--
-- Name: upload_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_logs (
    id uuid NOT NULL,
    user_id character varying(255),
    episode_id uuid,
    raw_footage_id uuid,
    file_type character varying(50),
    file_size bigint,
    upload_duration_ms integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone
);


--
-- Name: COLUMN upload_logs.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_logs.user_id IS 'User who uploaded';


--
-- Name: COLUMN upload_logs.file_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_logs.file_type IS 'mp4, mov, mkv, etc.';


--
-- Name: COLUMN upload_logs.file_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_logs.file_size IS 'File size in bytes';


--
-- Name: COLUMN upload_logs.upload_duration_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_logs.upload_duration_ms IS 'How long upload took';


--
-- Name: COLUMN upload_logs.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.upload_logs.metadata IS 'Additional upload metadata';


--
-- Name: user_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_id uuid,
    scene_id uuid,
    decision_type character varying(100) NOT NULL,
    decision_category character varying(50) NOT NULL,
    chosen_option jsonb NOT NULL,
    rejected_options jsonb,
    was_ai_suggestion boolean DEFAULT false,
    ai_confidence_score numeric(3,2),
    user_rating integer,
    user_notes text,
    context_data jsonb,
    "timestamp" timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    created_by character varying(255),
    CONSTRAINT user_rating_check CHECK (((user_rating >= 1) AND (user_rating <= 5)))
);


--
-- Name: video_processing_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_processing_jobs (
    id uuid NOT NULL,
    episode_id uuid NOT NULL,
    edit_plan_id uuid NOT NULL,
    status character varying(50) DEFAULT 'queued'::character varying NOT NULL,
    processing_method character varying(50) NOT NULL,
    complexity_score numeric(3,2),
    estimated_duration_seconds integer,
    processing_duration_seconds integer,
    progress_percentage integer DEFAULT 0 NOT NULL,
    output_s3_key character varying(500),
    output_url text,
    error_message text,
    lambda_request_id character varying(255),
    ec2_instance_id character varying(255),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN video_processing_jobs.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_processing_jobs.status IS 'queued | processing | completed | failed | cancelled';


--
-- Name: COLUMN video_processing_jobs.processing_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_processing_jobs.processing_method IS 'lambda | ec2';


--
-- Name: COLUMN video_processing_jobs.complexity_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_processing_jobs.complexity_score IS 'Estimated complexity (0.00-1.00)';


--
-- Name: COLUMN video_processing_jobs.estimated_duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_processing_jobs.estimated_duration_seconds IS 'Estimated processing time';


--
-- Name: COLUMN video_processing_jobs.processing_duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_processing_jobs.processing_duration_seconds IS 'Actual processing time (calculated by trigger)';


--
-- Name: COLUMN video_processing_jobs.progress_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_processing_jobs.progress_percentage IS '0-100';


--
-- Name: COLUMN video_processing_jobs.output_s3_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_processing_jobs.output_s3_key IS 'S3 key of final rendered video';


--
-- Name: COLUMN video_processing_jobs.output_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_processing_jobs.output_url IS 'Presigned URL for final video';


--
-- Name: voice_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_rules (
    id integer NOT NULL,
    series_id integer,
    character_name character varying(100),
    rule_text text NOT NULL,
    rule_type public.enum_voice_rules_rule_type DEFAULT 'dialogue_pattern'::public.enum_voice_rules_rule_type,
    example_original text,
    example_edited text,
    signal_count integer DEFAULT 1,
    confirmed_by_author boolean DEFAULT false,
    confirmed_at timestamp with time zone,
    injection_count integer DEFAULT 0,
    last_injected_at timestamp with time zone,
    status public.enum_voice_rules_status DEFAULT 'proposed'::public.enum_voice_rules_status,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: voice_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voice_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voice_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voice_rules_id_seq OWNED BY public.voice_rules.id;


--
-- Name: voice_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_signals (
    id integer NOT NULL,
    series_id integer,
    book_id integer,
    chapter_id integer,
    line_id integer,
    original_text text NOT NULL,
    edited_text text NOT NULL,
    diff_summary text,
    scene_context character varying(100),
    pattern_tag character varying(100),
    pattern_confidence double precision DEFAULT '0'::double precision,
    proposed_rule_id integer,
    status public.enum_voice_signals_status DEFAULT 'raw'::public.enum_voice_signals_status,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: voice_signals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voice_signals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voice_signals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voice_signals_id_seq OWNED BY public.voice_signals.id;


--
-- Name: wardrobe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wardrobe (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    "character" character varying(255),
    character_id uuid,
    clothing_category character varying(50) NOT NULL,
    description text,
    s3_key character varying(500),
    s3_url text,
    s3_key_processed character varying(500),
    s3_url_processed text,
    thumbnail_url text,
    brand character varying(255),
    price numeric(10,2),
    purchase_link text,
    website character varying(255),
    color character varying(100),
    size character varying(50),
    season character varying(50),
    occasion character varying(100),
    outfit_set_id character varying(255),
    outfit_set_name character varying(255),
    scene_description text,
    outfit_notes text,
    times_worn integer DEFAULT 0,
    last_worn_date date,
    tags jsonb DEFAULT '[]'::jsonb,
    notes text,
    is_favorite boolean DEFAULT false,
    library_item_id integer,
    show_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    tier character varying(20) DEFAULT 'basic'::character varying,
    lock_type character varying(30) DEFAULT 'none'::character varying,
    unlock_requirement jsonb DEFAULT '{}'::jsonb,
    is_owned boolean DEFAULT false,
    is_visible boolean DEFAULT true,
    era_alignment character varying(50),
    aesthetic_tags jsonb DEFAULT '[]'::jsonb,
    event_types jsonb DEFAULT '[]'::jsonb,
    outfit_match_weight integer DEFAULT 5,
    coin_cost integer DEFAULT 0,
    reputation_required integer DEFAULT 0,
    influence_required integer DEFAULT 0,
    season_unlock_episode integer,
    lala_reaction_own text,
    lala_reaction_locked text,
    lala_reaction_reject text,
    acquisition_type character varying(30) DEFAULT 'purchased'::character varying,
    rental_price numeric(10,2),
    resale_value numeric(10,2),
    parent_item_id uuid,
    attachment_type character varying(50),
    is_set boolean DEFAULT false NOT NULL,
    set_name character varying(255),
    s3_key_regenerated character varying(500),
    s3_url_regenerated text,
    regeneration_status character varying(20),
    regeneration_error text,
    regenerated_at timestamp with time zone,
    primary_image_variant character varying(20),
    s3_key_bg_pink character varying(500),
    s3_url_bg_pink text,
    s3_key_bg_blue character varying(500),
    s3_url_bg_blue text,
    s3_key_bg_teal character varying(500),
    s3_url_bg_teal text
);


--
-- Name: COLUMN wardrobe.tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.tier IS 'basic | mid | luxury | elite';


--
-- Name: COLUMN wardrobe.lock_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.lock_type IS 'none | coin | reputation | brand_exclusive | dream_fund | season_drop | influence';


--
-- Name: COLUMN wardrobe.unlock_requirement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.unlock_requirement IS '{"coins":2500} or {"reputation_min":7} or {"episode_min":12}';


--
-- Name: COLUMN wardrobe.is_owned; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.is_owned IS 'Does Lala currently own this item?';


--
-- Name: COLUMN wardrobe.is_visible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.is_visible IS 'Is this visible in the closet (even if locked)?';


--
-- Name: COLUMN wardrobe.era_alignment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.era_alignment IS 'foundation | glow_up | luxury | prime | legacy';


--
-- Name: COLUMN wardrobe.aesthetic_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.aesthetic_tags IS '["romantic","soft","elegant","bold","edgy","cozy","couture"]';


--
-- Name: COLUMN wardrobe.event_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.event_types IS '["gala","brand_shoot","casual","garden","editorial"]';


--
-- Name: COLUMN wardrobe.outfit_match_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.outfit_match_weight IS 'How much this contributes to outfit match score (1-10)';


--
-- Name: COLUMN wardrobe.coin_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.coin_cost IS 'Cost in Prime Coins to purchase/unlock';


--
-- Name: COLUMN wardrobe.reputation_required; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.reputation_required IS 'Minimum reputation to unlock';


--
-- Name: COLUMN wardrobe.influence_required; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.influence_required IS 'Minimum influence to unlock';


--
-- Name: COLUMN wardrobe.season_unlock_episode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.season_unlock_episode IS 'Episode number when this item drops (season_drop lock)';


--
-- Name: COLUMN wardrobe.lala_reaction_own; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.lala_reaction_own IS 'What Lala says when she owns it and selects it';


--
-- Name: COLUMN wardrobe.lala_reaction_locked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.lala_reaction_locked IS 'What Lala says when she sees it but can''t have it';


--
-- Name: COLUMN wardrobe.lala_reaction_reject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.lala_reaction_reject IS 'What Lala says when she rejects it during browse';


--
-- Name: COLUMN wardrobe.acquisition_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.acquisition_type IS 'purchased | gifted | borrowed | rented | custom | vintage';


--
-- Name: COLUMN wardrobe.rental_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.rental_price IS 'Cost to borrow for one event (in coins)';


--
-- Name: COLUMN wardrobe.resale_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.resale_value IS 'What Lala can sell it for after wearing';


--
-- Name: COLUMN wardrobe.parent_item_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.parent_item_id IS 'Parent item this piece attaches to (null = standalone item)';


--
-- Name: COLUMN wardrobe.attachment_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.attachment_type IS 'Type of attachment: belt, brooch, collar, sleeve, chain, earring, necklace, bracelet, ring, bag, scarf, pin, etc.';


--
-- Name: COLUMN wardrobe.is_set; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.is_set IS 'Whether this item is a matching set parent (jewelry set, dress ensemble)';


--
-- Name: COLUMN wardrobe.set_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.set_name IS 'Name of the matching set this piece belongs to';


--
-- Name: COLUMN wardrobe.s3_key_regenerated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.s3_key_regenerated IS 'S3 key for AI-regenerated product-shot variant';


--
-- Name: COLUMN wardrobe.s3_url_regenerated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.s3_url_regenerated IS 'Full S3 URL for AI-regenerated product-shot variant';


--
-- Name: COLUMN wardrobe.regeneration_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.regeneration_status IS 'Status of product-shot regeneration: pending | success | failed';


--
-- Name: COLUMN wardrobe.regeneration_error; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.regeneration_error IS 'Error message when regeneration_status = failed (HTTP status + body)';


--
-- Name: COLUMN wardrobe.regenerated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.regenerated_at IS 'Timestamp of most recent successful regeneration';


--
-- Name: COLUMN wardrobe.primary_image_variant; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.primary_image_variant IS 'User-selected preferred variant: original | processed | regenerated (NULL = auto, latest wins)';


--
-- Name: COLUMN wardrobe.s3_key_bg_pink; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.s3_key_bg_pink IS 'S3 key for pastel-pink backdrop variant';


--
-- Name: COLUMN wardrobe.s3_url_bg_pink; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.s3_url_bg_pink IS 'Full S3 URL for pastel-pink backdrop variant';


--
-- Name: COLUMN wardrobe.s3_key_bg_blue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.s3_key_bg_blue IS 'S3 key for baby-blue backdrop variant';


--
-- Name: COLUMN wardrobe.s3_url_bg_blue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.s3_url_bg_blue IS 'Full S3 URL for baby-blue backdrop variant';


--
-- Name: COLUMN wardrobe.s3_key_bg_teal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.s3_key_bg_teal IS 'S3 key for teal-green backdrop variant';


--
-- Name: COLUMN wardrobe.s3_url_bg_teal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe.s3_url_bg_teal IS 'Full S3 URL for teal-green backdrop variant';


--
-- Name: wardrobe_brand_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wardrobe_brand_tags (
    id uuid NOT NULL,
    wardrobe_item_id uuid NOT NULL,
    wardrobe_item_name character varying(255),
    brand_id uuid NOT NULL,
    show_id uuid,
    chapter_id uuid,
    event_name character varying(255),
    scene_summary text,
    coverage_status character varying(255) DEFAULT 'uncovered'::character varying,
    coverage_content text,
    coverage_author character varying(255),
    coverage_url character varying(255),
    coverage_generated timestamp with time zone,
    coverage_published timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: wardrobe_content_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wardrobe_content_assignments (
    id uuid NOT NULL,
    library_item_id integer NOT NULL,
    content_type character varying(255) NOT NULL,
    content_id uuid NOT NULL,
    scene_context text,
    character_id uuid,
    character_name character varying(255),
    narrative_function character varying(255),
    press_triggered boolean DEFAULT false,
    press_tag_id uuid,
    removed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: COLUMN wardrobe_content_assignments.library_item_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_content_assignments.library_item_id IS 'FK â†’ wardrobe_library.id';


--
-- Name: COLUMN wardrobe_content_assignments.content_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_content_assignments.content_type IS 'episode | chapter | scene_line | press | social';


--
-- Name: COLUMN wardrobe_content_assignments.content_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_content_assignments.content_id IS 'UUID of the target content';


--
-- Name: COLUMN wardrobe_content_assignments.scene_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_content_assignments.scene_context IS 'What is this piece doing in this moment';


--
-- Name: COLUMN wardrobe_content_assignments.character_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_content_assignments.character_id IS 'FK â†’ registry_characters.id';


--
-- Name: COLUMN wardrobe_content_assignments.narrative_function; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_content_assignments.narrative_function IS 'establishes_status | marks_transition | reveals_interior | continuity_anchor | brand_moment';


--
-- Name: COLUMN wardrobe_content_assignments.press_tag_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_content_assignments.press_tag_id IS 'FK â†’ wardrobe_brand_tags.id if press was triggered';


--
-- Name: wardrobe_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wardrobe_library (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) NOT NULL,
    item_type character varying(100),
    image_url text NOT NULL,
    thumbnail_url text,
    s3_key character varying(500),
    default_character character varying(255),
    default_occasion character varying(255),
    default_season character varying(100),
    color character varying(100),
    tags jsonb DEFAULT '[]'::jsonb,
    website text,
    price numeric(10,2),
    vendor character varying(255),
    show_id uuid,
    total_usage_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    view_count integer DEFAULT 0 NOT NULL,
    selection_count integer DEFAULT 0 NOT NULL,
    created_by character varying(255),
    updated_by character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN wardrobe_library.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_library.type IS 'item or set';


--
-- Name: COLUMN wardrobe_library.item_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_library.item_type IS 'top, bottom, dress, shoes, accessory, etc.';


--
-- Name: wardrobe_library_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wardrobe_library_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wardrobe_library_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wardrobe_library_id_seq OWNED BY public.wardrobe_library.id;


--
-- Name: wardrobe_library_references; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wardrobe_library_references (
    id integer NOT NULL,
    library_item_id integer,
    s3_key character varying(500) NOT NULL,
    reference_count integer DEFAULT 1 NOT NULL,
    file_size bigint,
    content_type character varying(100),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: wardrobe_library_references_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wardrobe_library_references_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wardrobe_library_references_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wardrobe_library_references_id_seq OWNED BY public.wardrobe_library_references.id;


--
-- Name: wardrobe_usage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wardrobe_usage_history (
    id integer NOT NULL,
    library_item_id integer,
    episode_id uuid,
    scene_id uuid,
    show_id uuid,
    usage_type character varying(50) NOT NULL,
    "character" character varying(255),
    occasion character varying(255),
    user_id character varying(255),
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN wardrobe_usage_history.usage_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wardrobe_usage_history.usage_type IS 'assigned, viewed, selected, approved, rejected, removed';


--
-- Name: wardrobe_usage_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wardrobe_usage_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wardrobe_usage_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wardrobe_usage_history_id_seq OWNED BY public.wardrobe_usage_history.id;


--
-- Name: world_character_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.world_character_batches (
    id uuid NOT NULL,
    show_id uuid,
    series_label character varying(100),
    world_context jsonb,
    character_count integer DEFAULT 0,
    generation_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: world_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.world_characters (
    id uuid NOT NULL,
    batch_id uuid,
    registry_character_id uuid,
    name character varying(255) NOT NULL,
    age_range character varying(50),
    occupation character varying(255),
    world_location character varying(255),
    character_type character varying(100) NOT NULL,
    intimate_eligible boolean DEFAULT false,
    aesthetic text,
    signature text,
    surface_want text,
    real_want text,
    what_they_want_from_lala text,
    how_they_meet text,
    dynamic text,
    tension_type character varying(100),
    intimate_style text,
    intimate_dynamic text,
    what_lala_feels text,
    arc_role text,
    exit_reason text,
    status character varying(50) DEFAULT 'draft'::character varying,
    current_tension character varying(50) DEFAULT 'Stable'::character varying,
    career_echo_connection boolean DEFAULT false,
    career_echo_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    sexuality character varying(100),
    attracted_to text,
    how_they_love text,
    desire_they_wont_admit text,
    relationship_graph jsonb,
    family_layer text,
    origin_story text,
    public_persona text,
    private_reality text,
    relationship_status character varying(100),
    committed_to character varying(255),
    moral_code text,
    fidelity_pattern text,
    gender character varying(50),
    world_tag character varying(100),
    core_fear text,
    character_archetype character varying(100),
    emotional_baseline character varying(100),
    at_their_best text,
    at_their_worst text,
    color_palette character varying(255),
    signature_silhouette text,
    signature_accessories text,
    glam_energy character varying(50),
    speech_pattern text,
    vocabulary_tone text,
    catchphrases text,
    internal_monologue_style text,
    career_goal text
);


--
-- Name: world_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.world_events (
    id uuid NOT NULL,
    show_id uuid NOT NULL,
    season_id uuid,
    arc_id uuid,
    name character varying(200) NOT NULL,
    event_type character varying(30) DEFAULT 'invite'::character varying NOT NULL,
    host_brand character varying(200),
    description text,
    prestige integer DEFAULT 5 NOT NULL,
    cost_coins integer DEFAULT 100 NOT NULL,
    strictness integer DEFAULT 5 NOT NULL,
    deadline_type character varying(20) DEFAULT 'medium'::character varying,
    deadline_minutes integer,
    dress_code character varying(200),
    dress_code_keywords jsonb DEFAULT '[]'::jsonb,
    location_hint text,
    narrative_stakes text,
    canon_consequences jsonb DEFAULT '{}'::jsonb,
    seeds_future_events jsonb DEFAULT '[]'::jsonb,
    overlay_template character varying(50) DEFAULT 'luxury_invite'::character varying,
    required_ui_overlays jsonb DEFAULT '["MailPanel", "InviteLetterOverlay", "ToDoList"]'::jsonb,
    browse_pool_bias character varying(20) DEFAULT 'balanced'::character varying,
    browse_pool_size integer DEFAULT 8,
    rewards jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    used_in_episode_id uuid,
    times_used integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_paid boolean DEFAULT false,
    payment_amount integer DEFAULT 0,
    requirements jsonb DEFAULT '{}'::jsonb,
    career_tier integer DEFAULT 1,
    career_milestone text,
    fail_consequence text,
    success_unlock text,
    scene_set_id uuid,
    host character varying(200),
    theme character varying(100),
    color_palette jsonb DEFAULT '[]'::jsonb,
    mood character varying(100),
    floral_style character varying(50),
    border_style character varying(50),
    invitation_asset_id uuid,
    venue_location_id uuid,
    venue_name character varying(200),
    venue_address character varying(255),
    event_date character varying(50),
    event_time character varying(50),
    guest_list jsonb DEFAULT '[]'::jsonb,
    invitation_details jsonb,
    deleted_at timestamp with time zone,
    source_calendar_event_id uuid,
    opportunity_id uuid,
    outfit_pieces jsonb,
    outfit_score jsonb,
    parent_event_id uuid,
    chain_position integer DEFAULT 0,
    chain_reason text,
    momentum_score double precision DEFAULT '0'::double precision,
    outfit_set_id uuid,
    source_profile_id integer
);


--
-- Name: COLUMN world_events.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.event_type IS 'invite | upgrade | guest | fail_test | deliverable | brand_deal';


--
-- Name: COLUMN world_events.host_brand; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.host_brand IS 'Maison Belle, Luxe Cosmetics, etc.';


--
-- Name: COLUMN world_events.prestige; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.prestige IS '1-10';


--
-- Name: COLUMN world_events.strictness; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.strictness IS '1-10';


--
-- Name: COLUMN world_events.deadline_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.deadline_type IS 'none | low | medium | high | tonight | urgent';


--
-- Name: COLUMN world_events.dress_code_keywords; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.dress_code_keywords IS '["romantic","vintage","lace","couture"]';


--
-- Name: COLUMN world_events.location_hint; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.location_hint IS 'Parisian rooftop garden, golden hour, marble tables';


--
-- Name: COLUMN world_events.narrative_stakes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.narrative_stakes IS 'What this event means for Lala''s arc';


--
-- Name: COLUMN world_events.canon_consequences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.canon_consequences IS '{"slay":{"unlock":"luxury_brand_attention"},"fail":{"consequence":"brand_reconsiders"}}';


--
-- Name: COLUMN world_events.seeds_future_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.seeds_future_events IS 'Event IDs or names this unlocks on success';


--
-- Name: COLUMN world_events.overlay_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.overlay_template IS 'Invite letter overlay style';


--
-- Name: COLUMN world_events.rewards; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.rewards IS '{"slay":{"coins":50,"reputation":3},"pass":{"coins":0,"reputation":1},"fail":{"reputation":-2}}';


--
-- Name: COLUMN world_events.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.status IS 'draft | ready | used | archived';


--
-- Name: COLUMN world_events.is_paid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.is_paid IS 'Does Lala get paid to attend (vs paying to attend)?';


--
-- Name: COLUMN world_events.payment_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.payment_amount IS 'Coins earned (if paid event)';


--
-- Name: COLUMN world_events.requirements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.requirements IS '{"reputation_min":5,"brand_trust_min":4,"portfolio_min":10}';


--
-- Name: COLUMN world_events.career_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.career_tier IS '1=Emerging, 2=Rising, 3=Established, 4=Influential, 5=Elite';


--
-- Name: COLUMN world_events.career_milestone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.career_milestone IS 'What this event represents in her journey';


--
-- Name: COLUMN world_events.fail_consequence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.fail_consequence IS 'What happens narratively on fail';


--
-- Name: COLUMN world_events.success_unlock; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.success_unlock IS 'What this opens up on success';


--
-- Name: COLUMN world_events.host; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.host IS 'Who is hosting: person, organization, or committee';


--
-- Name: COLUMN world_events.theme; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.theme IS 'e.g. "honey luxe", "avant-garde", "soft glam", "romantic garden"';


--
-- Name: COLUMN world_events.color_palette; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.color_palette IS 'e.g. ["blush", "champagne", "honey gold"]';


--
-- Name: COLUMN world_events.mood; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.mood IS 'e.g. "intimate", "aspirational", "electric", "mysterious"';


--
-- Name: COLUMN world_events.floral_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.floral_style IS 'roses / peonies / tropical / minimal / none';


--
-- Name: COLUMN world_events.border_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.border_style IS 'gold_foil / ornate / minimal / none';


--
-- Name: COLUMN world_events.invitation_asset_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.invitation_asset_id IS 'FK to assets table â€” the generated invitation image';


--
-- Name: COLUMN world_events.venue_location_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.venue_location_id IS 'FK to WorldLocation â€” the venue where this event takes place';


--
-- Name: COLUMN world_events.venue_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.venue_name IS 'Display name: "Club Noir" (may differ from WorldLocation name)';


--
-- Name: COLUMN world_events.venue_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.venue_address IS 'Full address for invitation: "742 Ocean Drive, South Beach, Miami"';


--
-- Name: COLUMN world_events.event_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.event_date IS 'Story date of the event: "Friday, March 15th" or "Tonight at 9pm"';


--
-- Name: COLUMN world_events.event_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.event_time IS 'Event time: "9:00 PM - 2:00 AM"';


--
-- Name: COLUMN world_events.guest_list; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.guest_list IS 'Array of { character_id, character_name, rsvp_status, plus_one }';


--
-- Name: COLUMN world_events.invitation_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.invitation_details IS '{ tagline, rsvp_by, attire_note, special_instructions, hosted_by }';


--
-- Name: COLUMN world_events.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.deleted_at IS 'Soft delete timestamp';


--
-- Name: COLUMN world_events.source_calendar_event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.source_calendar_event_id IS 'FK to StoryCalendarEvent â€” the cultural moment that spawned this event';


--
-- Name: COLUMN world_events.outfit_pieces; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.outfit_pieces IS 'Selected wardrobe pieces for this event â€” [{id, name, category, brand, tier, price, image_url}]';


--
-- Name: COLUMN world_events.outfit_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.outfit_score IS 'Outfit match intelligence â€” {match_score, narrative_mood, signals, repeats, brand_loyalty}';


--
-- Name: COLUMN world_events.parent_event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.parent_event_id IS 'Links to the event that spawned this one (event chaining)';


--
-- Name: COLUMN world_events.chain_position; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.chain_position IS 'Position in event chain (0=origin, 1=first sequel, etc.)';


--
-- Name: COLUMN world_events.chain_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.chain_reason IS 'Narrative explanation of why this event was spawned';


--
-- Name: COLUMN world_events.momentum_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.momentum_score IS 'Cumulative score from feed engagement that influenced this event';


--
-- Name: COLUMN world_events.outfit_set_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.outfit_set_id IS 'FK to outfit_sets when the event uses a saved outfit';


--
-- Name: COLUMN world_events.source_profile_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_events.source_profile_id IS 'FK to social_profiles.id when event was spawned from a feed profile. Mirrors canon_consequences.automation.host_profile_id but is queryable.';


--
-- Name: world_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.world_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    universe_id uuid,
    name character varying(255) NOT NULL,
    slug character varying(100),
    description text,
    location_type character varying(80) DEFAULT 'interior'::character varying NOT NULL,
    parent_location_id uuid,
    sensory_details jsonb DEFAULT '{}'::jsonb,
    narrative_role character varying(100),
    associated_characters jsonb DEFAULT '[]'::jsonb,
    first_appearance_chapter_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    style_guide jsonb,
    floor_plan jsonb,
    property_type character varying(50) DEFAULT NULL::character varying,
    street_address character varying(255),
    city character varying(100),
    district character varying(100),
    coordinates jsonb,
    venue_type character varying(50),
    venue_details jsonb
);


--
-- Name: COLUMN world_locations.style_guide; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.style_guide IS 'Property style guide â€” materials, palette, hardware, architecture that cascades to child rooms';


--
-- Name: COLUMN world_locations.floor_plan; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.floor_plan IS 'Floor plan data â€” room connections, doorway links, spatial relationships';


--
-- Name: COLUMN world_locations.property_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.property_type IS 'Property classification: penthouse, mansion, apartment, townhouse, studio, etc.';


--
-- Name: COLUMN world_locations.street_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.street_address IS 'Street address: "742 Ocean Drive"';


--
-- Name: COLUMN world_locations.city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.city IS 'City name: "Miami"';


--
-- Name: COLUMN world_locations.district; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.district IS 'Neighborhood/district: "South Beach"';


--
-- Name: COLUMN world_locations.coordinates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.coordinates IS '{ lat, lng } for map placement';


--
-- Name: COLUMN world_locations.venue_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.venue_type IS 'Business type: restaurant, club, cafe, salon, gallery, shopping, gym, studio';


--
-- Name: COLUMN world_locations.venue_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.world_locations.venue_details IS '{ hours, price_level, capacity, dress_code, vibe_tags }';


--
-- Name: world_state_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.world_state_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    universe_id uuid,
    book_id uuid,
    chapter_id uuid,
    snapshot_label character varying(255) NOT NULL,
    character_states jsonb DEFAULT '{}'::jsonb,
    relationship_states jsonb DEFAULT '{}'::jsonb,
    active_threads jsonb DEFAULT '[]'::jsonb,
    world_facts jsonb DEFAULT '[]'::jsonb,
    timeline_position integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: world_timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.world_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    universe_id uuid,
    book_id uuid,
    chapter_id uuid,
    event_name character varying(255) NOT NULL,
    event_description text,
    story_date character varying(100),
    sort_order integer DEFAULT 0 NOT NULL,
    event_type character varying(80) DEFAULT 'plot'::character varying NOT NULL,
    characters_involved jsonb DEFAULT '[]'::jsonb,
    location_id uuid,
    impact_level character varying(30) DEFAULT 'minor'::character varying,
    consequences jsonb DEFAULT '[]'::jsonb,
    is_canon boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: writing_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.writing_goals (
    id integer NOT NULL,
    goal_type public.enum_writing_goals_goal_type DEFAULT 'weekly'::public.enum_writing_goals_goal_type,
    target_scenes integer,
    target_words integer,
    target_sessions integer,
    cadence public.enum_writing_goals_cadence DEFAULT 'weekdays'::public.enum_writing_goals_cadence,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: writing_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.writing_goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: writing_goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.writing_goals_id_seq OWNED BY public.writing_goals.id;


--
-- Name: writing_rhythm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.writing_rhythm (
    id integer NOT NULL,
    session_date date NOT NULL,
    scenes_proposed integer DEFAULT 0,
    scenes_generated integer DEFAULT 0,
    scenes_approved integer DEFAULT 0,
    words_written integer DEFAULT 0,
    arc_stage character varying(30),
    session_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN writing_rhythm.session_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.writing_rhythm.session_date IS 'The date of the writing session';


--
-- Name: writing_rhythm_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.writing_rhythm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: writing_rhythm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.writing_rhythm_id_seq OWNED BY public.writing_rhythm.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: ai_usage_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_logs_id_seq'::regclass);


--
-- Name: brain_fingerprints id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_fingerprints ALTER COLUMN id SET DEFAULT nextval('public.brain_fingerprints_id_seq'::regclass);


--
-- Name: bulk_import_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_jobs ALTER COLUMN id SET DEFAULT nextval('public.bulk_import_jobs_id_seq'::regclass);


--
-- Name: character_follow_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_follow_profiles ALTER COLUMN id SET DEFAULT nextval('public.character_follow_profiles_id_seq'::regclass);


--
-- Name: character_growth_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_growth_log ALTER COLUMN id SET DEFAULT nextval('public.character_growth_log_id_seq'::regclass);


--
-- Name: episode_scripts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_scripts ALTER COLUMN id SET DEFAULT nextval('public.episode_scripts_id_seq'::regclass);


--
-- Name: franchise_knowledge id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_knowledge ALTER COLUMN id SET DEFAULT nextval('public.franchise_knowledge_id_seq'::regclass);


--
-- Name: franchise_tech_knowledge id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_tech_knowledge ALTER COLUMN id SET DEFAULT nextval('public.franchise_tech_knowledge_id_seq'::regclass);


--
-- Name: manuscript_metadata id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_metadata ALTER COLUMN id SET DEFAULT nextval('public.manuscript_metadata_id_seq'::regclass);


--
-- Name: metadata_storage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_storage ALTER COLUMN id SET DEFAULT nextval('public.metadata_storage_id_seq'::regclass);


--
-- Name: multi_product_content id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_product_content ALTER COLUMN id SET DEFAULT nextval('public.multi_product_content_id_seq'::regclass);


--
-- Name: outfit_set_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_set_items ALTER COLUMN id SET DEFAULT nextval('public.outfit_set_items_id_seq'::regclass);


--
-- Name: outfit_sets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_sets ALTER COLUMN id SET DEFAULT nextval('public.outfit_sets_id_seq'::regclass);


--
-- Name: post_generation_reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_generation_reviews ALTER COLUMN id SET DEFAULT nextval('public.post_generation_reviews_id_seq'::regclass);


--
-- Name: processing_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queue ALTER COLUMN id SET DEFAULT nextval('public.processing_queue_id_seq'::regclass);


--
-- Name: processing_queues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queues ALTER COLUMN id SET DEFAULT nextval('public.processing_queues_id_seq'::regclass);


--
-- Name: scene_proposals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_proposals ALTER COLUMN id SET DEFAULT nextval('public.scene_proposals_id_seq'::regclass);


--
-- Name: session_briefs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_briefs ALTER COLUMN id SET DEFAULT nextval('public.session_briefs_id_seq'::regclass);


--
-- Name: social_profile_followers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_followers ALTER COLUMN id SET DEFAULT nextval('public.social_profile_followers_id_seq'::regclass);


--
-- Name: social_profile_relationships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_relationships ALTER COLUMN id SET DEFAULT nextval('public.social_profile_relationships_id_seq'::regclass);


--
-- Name: social_profile_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_templates ALTER COLUMN id SET DEFAULT nextval('public.social_profile_templates_id_seq'::regclass);


--
-- Name: social_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profiles ALTER COLUMN id SET DEFAULT nextval('public.social_profiles_id_seq'::regclass);


--
-- Name: thumbnails id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnails ALTER COLUMN id SET DEFAULT nextval('public.thumbnails_id_seq'::regclass);


--
-- Name: voice_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_rules ALTER COLUMN id SET DEFAULT nextval('public.voice_rules_id_seq'::regclass);


--
-- Name: voice_signals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_signals ALTER COLUMN id SET DEFAULT nextval('public.voice_signals_id_seq'::regclass);


--
-- Name: wardrobe_library id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_library ALTER COLUMN id SET DEFAULT nextval('public.wardrobe_library_id_seq'::regclass);


--
-- Name: wardrobe_library_references id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_library_references ALTER COLUMN id SET DEFAULT nextval('public.wardrobe_library_references_id_seq'::regclass);


--
-- Name: wardrobe_usage_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_usage_history ALTER COLUMN id SET DEFAULT nextval('public.wardrobe_usage_history_id_seq'::regclass);


--
-- Name: writing_goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.writing_goals ALTER COLUMN id SET DEFAULT nextval('public.writing_goals_id_seq'::regclass);


--
-- Name: writing_rhythm id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.writing_rhythm ALTER COLUMN id SET DEFAULT nextval('public.writing_rhythm_id_seq'::regclass);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_edit_plans ai_edit_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_edit_plans
    ADD CONSTRAINT ai_edit_plans_pkey PRIMARY KEY (id);


--
-- Name: ai_interactions ai_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interactions
    ADD CONSTRAINT ai_interactions_pkey PRIMARY KEY (id);


--
-- Name: ai_revisions ai_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_revisions
    ADD CONSTRAINT ai_revisions_pkey PRIMARY KEY (id);


--
-- Name: ai_training_data ai_training_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_training_data
    ADD CONSTRAINT ai_training_data_pkey PRIMARY KEY (id);


--
-- Name: ai_training_data ai_training_data_video_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_training_data
    ADD CONSTRAINT ai_training_data_video_id_key UNIQUE (video_id);


--
-- Name: ai_usage_logs ai_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: amber_findings amber_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amber_findings
    ADD CONSTRAINT amber_findings_pkey PRIMARY KEY (id);


--
-- Name: amber_scan_runs amber_scan_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amber_scan_runs
    ADD CONSTRAINT amber_scan_runs_pkey PRIMARY KEY (id);


--
-- Name: amber_task_queue amber_task_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amber_task_queue
    ADD CONSTRAINT amber_task_queue_pkey PRIMARY KEY (id);


--
-- Name: asset_labels asset_labels_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_labels
    ADD CONSTRAINT asset_labels_name_key UNIQUE (name);


--
-- Name: asset_labels asset_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_labels
    ADD CONSTRAINT asset_labels_pkey PRIMARY KEY (id);


--
-- Name: asset_roles asset_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_roles
    ADD CONSTRAINT asset_roles_pkey PRIMARY KEY (id);


--
-- Name: asset_usage_log asset_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usage_log
    ADD CONSTRAINT asset_usage_log_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audio_clips audio_clips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_clips
    ADD CONSTRAINT audio_clips_pkey PRIMARY KEY (id);


--
-- Name: author_notes author_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.author_notes
    ADD CONSTRAINT author_notes_pkey PRIMARY KEY (id);


--
-- Name: beats beats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beats
    ADD CONSTRAINT beats_pkey PRIMARY KEY (id);


--
-- Name: book_series book_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_series
    ADD CONSTRAINT book_series_pkey PRIMARY KEY (id);


--
-- Name: brain_fingerprints brain_fingerprints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_fingerprints
    ADD CONSTRAINT brain_fingerprints_pkey PRIMARY KEY (id);


--
-- Name: bulk_import_jobs bulk_import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_jobs
    ADD CONSTRAINT bulk_import_jobs_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_attendees calendar_event_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_ripples calendar_event_ripples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_ripples
    ADD CONSTRAINT calendar_event_ripples_pkey PRIMARY KEY (id);


--
-- Name: career_goals career_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_goals
    ADD CONSTRAINT career_goals_pkey PRIMARY KEY (id);


--
-- Name: character_arcs character_arcs_character_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_arcs
    ADD CONSTRAINT character_arcs_character_key_key UNIQUE (character_key);


--
-- Name: character_arcs character_arcs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_arcs
    ADD CONSTRAINT character_arcs_pkey PRIMARY KEY (id);


--
-- Name: character_clips character_clips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_clips
    ADD CONSTRAINT character_clips_pkey PRIMARY KEY (id);


--
-- Name: character_crossings character_crossings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_crossings
    ADD CONSTRAINT character_crossings_pkey PRIMARY KEY (id);


--
-- Name: character_entanglements character_entanglements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_entanglements
    ADD CONSTRAINT character_entanglements_pkey PRIMARY KEY (id);


--
-- Name: character_follow_profiles character_follow_profiles_character_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_follow_profiles
    ADD CONSTRAINT character_follow_profiles_character_key_key UNIQUE (character_key);


--
-- Name: character_follow_profiles character_follow_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_follow_profiles
    ADD CONSTRAINT character_follow_profiles_pkey PRIMARY KEY (id);


--
-- Name: character_growth_log character_growth_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_growth_log
    ADD CONSTRAINT character_growth_log_pkey PRIMARY KEY (id);


--
-- Name: character_profiles character_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_profiles
    ADD CONSTRAINT character_profiles_pkey PRIMARY KEY (id);


--
-- Name: character_registries character_registries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_registries
    ADD CONSTRAINT character_registries_pkey PRIMARY KEY (id);


--
-- Name: character_relationships character_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_relationships
    ADD CONSTRAINT character_relationships_pkey PRIMARY KEY (id);


--
-- Name: character_sparks character_sparks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_sparks
    ADD CONSTRAINT character_sparks_pkey PRIMARY KEY (id);


--
-- Name: character_state_history character_state_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_state_history
    ADD CONSTRAINT character_state_history_pkey PRIMARY KEY (id);


--
-- Name: character_state character_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_state
    ADD CONSTRAINT character_state_pkey PRIMARY KEY (id);


--
-- Name: character_therapy_profiles character_therapy_profiles_character_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_therapy_profiles
    ADD CONSTRAINT character_therapy_profiles_character_id_key UNIQUE (character_id);


--
-- Name: character_therapy_profiles character_therapy_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_therapy_profiles
    ADD CONSTRAINT character_therapy_profiles_pkey PRIMARY KEY (id);


--
-- Name: characters characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);


--
-- Name: composition_assets composition_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_assets
    ADD CONSTRAINT composition_assets_pkey PRIMARY KEY (id);


--
-- Name: composition_outputs composition_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_outputs
    ADD CONSTRAINT composition_outputs_pkey PRIMARY KEY (id);


--
-- Name: continuity_beat_characters continuity_beat_characters_beat_id_character_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_beat_characters
    ADD CONSTRAINT continuity_beat_characters_beat_id_character_id_key UNIQUE (beat_id, character_id);


--
-- Name: continuity_beat_characters continuity_beat_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_beat_characters
    ADD CONSTRAINT continuity_beat_characters_pkey PRIMARY KEY (id);


--
-- Name: continuity_beats continuity_beats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_beats
    ADD CONSTRAINT continuity_beats_pkey PRIMARY KEY (id);


--
-- Name: continuity_characters continuity_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_characters
    ADD CONSTRAINT continuity_characters_pkey PRIMARY KEY (id);


--
-- Name: continuity_timelines continuity_timelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_timelines
    ADD CONSTRAINT continuity_timelines_pkey PRIMARY KEY (id);


--
-- Name: decision_log decision_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_log
    ADD CONSTRAINT decision_log_pkey PRIMARY KEY (id);


--
-- Name: decision_logs decision_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_logs
    ADD CONSTRAINT decision_logs_pkey PRIMARY KEY (id);


--
-- Name: decision_patterns decision_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_patterns
    ADD CONSTRAINT decision_patterns_pkey PRIMARY KEY (id);


--
-- Name: ecosystem_previews ecosystem_previews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecosystem_previews
    ADD CONSTRAINT ecosystem_previews_pkey PRIMARY KEY (id);


--
-- Name: ecosystem_previews ecosystem_previews_preview_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecosystem_previews
    ADD CONSTRAINT ecosystem_previews_preview_id_key UNIQUE (preview_id);


--
-- Name: edit_maps edit_maps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edit_maps
    ADD CONSTRAINT edit_maps_pkey PRIMARY KEY (id);


--
-- Name: editing_decisions editing_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.editing_decisions
    ADD CONSTRAINT editing_decisions_pkey PRIMARY KEY (id);


--
-- Name: entanglement_events entanglement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entanglement_events
    ADD CONSTRAINT entanglement_events_pkey PRIMARY KEY (id);


--
-- Name: entanglement_unfollows entanglement_unfollows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entanglement_unfollows
    ADD CONSTRAINT entanglement_unfollows_pkey PRIMARY KEY (id);


--
-- Name: episode_assets episode_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_assets
    ADD CONSTRAINT episode_assets_pkey PRIMARY KEY (id);


--
-- Name: episode_briefs episode_briefs_episode_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_briefs
    ADD CONSTRAINT episode_briefs_episode_id_key UNIQUE (episode_id);


--
-- Name: episode_briefs episode_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_briefs
    ADD CONSTRAINT episode_briefs_pkey PRIMARY KEY (id);


--
-- Name: episode_phases episode_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_phases
    ADD CONSTRAINT episode_phases_pkey PRIMARY KEY (id);


--
-- Name: episode_scenes episode_scenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_scenes
    ADD CONSTRAINT episode_scenes_pkey PRIMARY KEY (id);


--
-- Name: episode_scripts episode_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_scripts
    ADD CONSTRAINT episode_scripts_pkey PRIMARY KEY (id);


--
-- Name: episode_templates episode_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_templates
    ADD CONSTRAINT episode_templates_pkey PRIMARY KEY (id);


--
-- Name: episode_templates episode_templates_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_templates
    ADD CONSTRAINT episode_templates_slug_key UNIQUE (slug);


--
-- Name: episode_todo_lists episode_todo_lists_episode_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_todo_lists
    ADD CONSTRAINT episode_todo_lists_episode_id_key UNIQUE (episode_id);


--
-- Name: episode_todo_lists episode_todo_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_todo_lists
    ADD CONSTRAINT episode_todo_lists_pkey PRIMARY KEY (id);


--
-- Name: episode_wardrobe_defaults episode_wardrobe_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_wardrobe_defaults
    ADD CONSTRAINT episode_wardrobe_defaults_pkey PRIMARY KEY (id);


--
-- Name: episode_wardrobe episode_wardrobe_episode_id_wardrobe_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_episode_id_wardrobe_id_key UNIQUE (episode_id, wardrobe_id);


--
-- Name: episode_wardrobe episode_wardrobe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_pkey PRIMARY KEY (id);


--
-- Name: episodes episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_pkey PRIMARY KEY (id);


--
-- Name: feed_moments feed_moments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_moments
    ADD CONSTRAINT feed_moments_pkey PRIMARY KEY (id);


--
-- Name: feed_posts feed_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_pkey PRIMARY KEY (id);


--
-- Name: feed_profile_relationships feed_profile_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_profile_relationships
    ADD CONSTRAINT feed_profile_relationships_pkey PRIMARY KEY (id);


--
-- Name: financial_transactions financial_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_pkey PRIMARY KEY (id);


--
-- Name: franchise_knowledge franchise_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_knowledge
    ADD CONSTRAINT franchise_knowledge_pkey PRIMARY KEY (id);


--
-- Name: franchise_tech_knowledge franchise_tech_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_tech_knowledge
    ADD CONSTRAINT franchise_tech_knowledge_pkey PRIMARY KEY (id);


--
-- Name: generation_jobs generation_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_jobs
    ADD CONSTRAINT generation_jobs_pkey PRIMARY KEY (id);


--
-- Name: hair_library hair_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hair_library
    ADD CONSTRAINT hair_library_pkey PRIMARY KEY (id);


--
-- Name: interactive_elements interactive_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactive_elements
    ADD CONSTRAINT interactive_elements_pkey PRIMARY KEY (id);


--
-- Name: intimate_scenes intimate_scenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intimate_scenes
    ADD CONSTRAINT intimate_scenes_pkey PRIMARY KEY (id);


--
-- Name: lala_cash_grab_quests lala_cash_grab_quests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_cash_grab_quests
    ADD CONSTRAINT lala_cash_grab_quests_pkey PRIMARY KEY (id);


--
-- Name: lala_emergence_scenes lala_emergence_scenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_emergence_scenes
    ADD CONSTRAINT lala_emergence_scenes_pkey PRIMARY KEY (id);


--
-- Name: lala_episode_formulas lala_episode_formulas_episode_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_episode_formulas
    ADD CONSTRAINT lala_episode_formulas_episode_id_key UNIQUE (episode_id);


--
-- Name: lala_episode_formulas lala_episode_formulas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_episode_formulas
    ADD CONSTRAINT lala_episode_formulas_pkey PRIMARY KEY (id);


--
-- Name: lala_episode_timeline lala_episode_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_episode_timeline
    ADD CONSTRAINT lala_episode_timeline_pkey PRIMARY KEY (id);


--
-- Name: lala_friend_archetypes lala_friend_archetypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_friend_archetypes
    ADD CONSTRAINT lala_friend_archetypes_pkey PRIMARY KEY (id);


--
-- Name: lala_micro_goals lala_micro_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_micro_goals
    ADD CONSTRAINT lala_micro_goals_pkey PRIMARY KEY (id);


--
-- Name: lalaverse_brands lalaverse_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lalaverse_brands
    ADD CONSTRAINT lalaverse_brands_pkey PRIMARY KEY (id);


--
-- Name: lalaverse_brands lalaverse_brands_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lalaverse_brands
    ADD CONSTRAINT lalaverse_brands_slug_key UNIQUE (slug);


--
-- Name: layer_assets layer_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layer_assets
    ADD CONSTRAINT layer_assets_pkey PRIMARY KEY (id);


--
-- Name: layer_presets layer_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layer_presets
    ADD CONSTRAINT layer_presets_pkey PRIMARY KEY (id);


--
-- Name: layers layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layers
    ADD CONSTRAINT layers_pkey PRIMARY KEY (id);


--
-- Name: layout_templates layout_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_templates
    ADD CONSTRAINT layout_templates_pkey PRIMARY KEY (id);


--
-- Name: makeup_library makeup_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.makeup_library
    ADD CONSTRAINT makeup_library_pkey PRIMARY KEY (id);


--
-- Name: manuscript_metadata manuscript_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manuscript_metadata
    ADD CONSTRAINT manuscript_metadata_pkey PRIMARY KEY (id);


--
-- Name: markers markers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markers
    ADD CONSTRAINT markers_pkey PRIMARY KEY (id);


--
-- Name: metadata_storage metadata_storage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_storage
    ADD CONSTRAINT metadata_storage_pkey PRIMARY KEY (id);


--
-- Name: multi_product_content multi_product_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_product_content
    ADD CONSTRAINT multi_product_content_pkey PRIMARY KEY (id);


--
-- Name: novel_assemblies novel_assemblies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novel_assemblies
    ADD CONSTRAINT novel_assemblies_pkey PRIMARY KEY (id);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: outfit_set_items outfit_set_items_outfit_set_id_wardrobe_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_set_items
    ADD CONSTRAINT outfit_set_items_outfit_set_id_wardrobe_item_id_key UNIQUE (outfit_set_id, wardrobe_item_id);


--
-- Name: outfit_set_items outfit_set_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_set_items
    ADD CONSTRAINT outfit_set_items_pkey PRIMARY KEY (id);


--
-- Name: outfit_sets outfit_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_sets
    ADD CONSTRAINT outfit_sets_pkey PRIMARY KEY (id);


--
-- Name: page_content page_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_content
    ADD CONSTRAINT page_content_pkey PRIMARY KEY (id);


--
-- Name: phone_missions phone_missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_missions
    ADD CONSTRAINT phone_missions_pkey PRIMARY KEY (id);


--
-- Name: phone_playthrough_state phone_playthrough_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_playthrough_state
    ADD CONSTRAINT phone_playthrough_state_pkey PRIMARY KEY (id);


--
-- Name: pipeline_tracking pipeline_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_tracking
    ADD CONSTRAINT pipeline_tracking_pkey PRIMARY KEY (id);


--
-- Name: post_generation_reviews post_generation_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_generation_reviews
    ADD CONSTRAINT post_generation_reviews_pkey PRIMARY KEY (id);


--
-- Name: press_careers press_careers_character_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.press_careers
    ADD CONSTRAINT press_careers_character_slug_key UNIQUE (character_slug);


--
-- Name: press_careers press_careers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.press_careers
    ADD CONSTRAINT press_careers_pkey PRIMARY KEY (id);


--
-- Name: processing_queue processing_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queue
    ADD CONSTRAINT processing_queue_pkey PRIMARY KEY (id);


--
-- Name: processing_queue processing_queue_sqs_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queue
    ADD CONSTRAINT processing_queue_sqs_message_id_key UNIQUE (sqs_message_id);


--
-- Name: processing_queues processing_queues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queues
    ADD CONSTRAINT processing_queues_pkey PRIMARY KEY (id);


--
-- Name: processing_queues processing_queues_sqsMessageId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queues
    ADD CONSTRAINT "processing_queues_sqsMessageId_key" UNIQUE ("sqsMessageId");


--
-- Name: raw_footage raw_footage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_footage
    ADD CONSTRAINT raw_footage_pkey PRIMARY KEY (id);


--
-- Name: registry_characters registry_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registry_characters
    ADD CONSTRAINT registry_characters_pkey PRIMARY KEY (id);


--
-- Name: relationship_events relationship_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_events
    ADD CONSTRAINT relationship_events_pkey PRIMARY KEY (id);


--
-- Name: scene_angles scene_angles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_angles
    ADD CONSTRAINT scene_angles_pkey PRIMARY KEY (id);


--
-- Name: scene_assets scene_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_pkey PRIMARY KEY (id);


--
-- Name: scene_continuations scene_continuations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_continuations
    ADD CONSTRAINT scene_continuations_pkey PRIMARY KEY (id);


--
-- Name: scene_footage_links scene_footage_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_footage_links
    ADD CONSTRAINT scene_footage_links_pkey PRIMARY KEY (id);


--
-- Name: scene_layer_configuration scene_layer_configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_layer_configuration
    ADD CONSTRAINT scene_layer_configuration_pkey PRIMARY KEY (id);


--
-- Name: scene_layer_configuration scene_layer_configuration_scene_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_layer_configuration
    ADD CONSTRAINT scene_layer_configuration_scene_id_key UNIQUE (scene_id);


--
-- Name: scene_library scene_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_library
    ADD CONSTRAINT scene_library_pkey PRIMARY KEY (id);


--
-- Name: scene_object_variants scene_object_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_object_variants
    ADD CONSTRAINT scene_object_variants_pkey PRIMARY KEY (id);


--
-- Name: scene_plans scene_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_plans
    ADD CONSTRAINT scene_plans_pkey PRIMARY KEY (id);


--
-- Name: scene_proposals scene_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_proposals
    ADD CONSTRAINT scene_proposals_pkey PRIMARY KEY (id);


--
-- Name: scene_set_episodes scene_set_episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_set_episodes
    ADD CONSTRAINT scene_set_episodes_pkey PRIMARY KEY (id);


--
-- Name: scene_set_episodes scene_set_episodes_scene_set_id_episode_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_set_episodes
    ADD CONSTRAINT scene_set_episodes_scene_set_id_episode_id_key UNIQUE (scene_set_id, episode_id);


--
-- Name: scene_sets scene_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_sets
    ADD CONSTRAINT scene_sets_pkey PRIMARY KEY (id);


--
-- Name: scene_templates scene_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_templates
    ADD CONSTRAINT scene_templates_pkey PRIMARY KEY (id);


--
-- Name: scenes scenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT scenes_pkey PRIMARY KEY (id);


--
-- Name: script_edit_history script_edit_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_edit_history
    ADD CONSTRAINT script_edit_history_pkey PRIMARY KEY (id);


--
-- Name: script_learning_profiles script_learning_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_learning_profiles
    ADD CONSTRAINT script_learning_profiles_pkey PRIMARY KEY (id);


--
-- Name: script_metadata script_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_metadata
    ADD CONSTRAINT script_metadata_pkey PRIMARY KEY (id);


--
-- Name: script_suggestions script_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_suggestions
    ADD CONSTRAINT script_suggestions_pkey PRIMARY KEY (id);


--
-- Name: script_templates script_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_templates
    ADD CONSTRAINT script_templates_pkey PRIMARY KEY (id);


--
-- Name: session_briefs session_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_briefs
    ADD CONSTRAINT session_briefs_pkey PRIMARY KEY (id);


--
-- Name: show_arcs show_arcs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.show_arcs
    ADD CONSTRAINT show_arcs_pkey PRIMARY KEY (id);


--
-- Name: show_assets show_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.show_assets
    ADD CONSTRAINT show_assets_pkey PRIMARY KEY (id);


--
-- Name: show_assets show_assets_show_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.show_assets
    ADD CONSTRAINT show_assets_show_id_asset_id_key UNIQUE (show_id, asset_id);


--
-- Name: show_configs show_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.show_configs
    ADD CONSTRAINT show_configs_pkey PRIMARY KEY (id);


--
-- Name: shows shows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_pkey PRIMARY KEY (id);


--
-- Name: social_media_imports social_media_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_media_imports
    ADD CONSTRAINT social_media_imports_pkey PRIMARY KEY (id);


--
-- Name: social_profile_followers social_profile_followers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_followers
    ADD CONSTRAINT social_profile_followers_pkey PRIMARY KEY (id);


--
-- Name: social_profile_relationships social_profile_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_relationships
    ADD CONSTRAINT social_profile_relationships_pkey PRIMARY KEY (id);


--
-- Name: social_profile_templates social_profile_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_templates
    ADD CONSTRAINT social_profile_templates_pkey PRIMARY KEY (id);


--
-- Name: social_profiles social_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profiles
    ADD CONSTRAINT social_profiles_pkey PRIMARY KEY (id);


--
-- Name: stories stories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);


--
-- Name: story_calendar_events story_calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_calendar_events
    ADD CONSTRAINT story_calendar_events_pkey PRIMARY KEY (id);


--
-- Name: story_clock_markers story_clock_markers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_clock_markers
    ADD CONSTRAINT story_clock_markers_pkey PRIMARY KEY (id);


--
-- Name: story_revisions story_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_revisions
    ADD CONSTRAINT story_revisions_pkey PRIMARY KEY (id);


--
-- Name: story_task_arcs story_task_arcs_character_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_task_arcs
    ADD CONSTRAINT story_task_arcs_character_key_key UNIQUE (character_key);


--
-- Name: story_task_arcs story_task_arcs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_task_arcs
    ADD CONSTRAINT story_task_arcs_pkey PRIMARY KEY (id);


--
-- Name: story_texture story_texture_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_texture
    ADD CONSTRAINT story_texture_pkey PRIMARY KEY (id);


--
-- Name: story_threads story_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_threads
    ADD CONSTRAINT story_threads_pkey PRIMARY KEY (id);


--
-- Name: storyteller_books storyteller_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_books
    ADD CONSTRAINT storyteller_books_pkey PRIMARY KEY (id);


--
-- Name: storyteller_chapters storyteller_chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_chapters
    ADD CONSTRAINT storyteller_chapters_pkey PRIMARY KEY (id);


--
-- Name: storyteller_echoes storyteller_echoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_echoes
    ADD CONSTRAINT storyteller_echoes_pkey PRIMARY KEY (id);


--
-- Name: storyteller_lines storyteller_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_lines
    ADD CONSTRAINT storyteller_lines_pkey PRIMARY KEY (id);


--
-- Name: storyteller_memories storyteller_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_memories
    ADD CONSTRAINT storyteller_memories_pkey PRIMARY KEY (id);


--
-- Name: storyteller_stories storyteller_stories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_stories
    ADD CONSTRAINT storyteller_stories_pkey PRIMARY KEY (id);


--
-- Name: therapy_pending_sessions therapy_pending_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapy_pending_sessions
    ADD CONSTRAINT therapy_pending_sessions_pkey PRIMARY KEY (id);


--
-- Name: thumbnail_compositions thumbnail_compositions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnail_compositions
    ADD CONSTRAINT thumbnail_compositions_pkey PRIMARY KEY (id);


--
-- Name: thumbnail_templates thumbnail_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnail_templates
    ADD CONSTRAINT thumbnail_templates_pkey PRIMARY KEY (id);


--
-- Name: thumbnails thumbnails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnails
    ADD CONSTRAINT thumbnails_pkey PRIMARY KEY (id);


--
-- Name: thumbnails thumbnails_s3Key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnails
    ADD CONSTRAINT "thumbnails_s3Key_key" UNIQUE ("s3Key");


--
-- Name: timeline_data timeline_data_episode_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_data
    ADD CONSTRAINT timeline_data_episode_id_key UNIQUE (episode_id);


--
-- Name: timeline_data timeline_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_data
    ADD CONSTRAINT timeline_data_pkey PRIMARY KEY (id);


--
-- Name: timeline_placements timeline_placements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_pkey PRIMARY KEY (id);


--
-- Name: ui_overlay_types ui_overlay_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_overlay_types
    ADD CONSTRAINT ui_overlay_types_pkey PRIMARY KEY (id);


--
-- Name: scene_footage_links unique_scene_footage; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_footage_links
    ADD CONSTRAINT unique_scene_footage UNIQUE (scene_id);


--
-- Name: universe_characters universe_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universe_characters
    ADD CONSTRAINT universe_characters_pkey PRIMARY KEY (id);


--
-- Name: universes universes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universes
    ADD CONSTRAINT universes_pkey PRIMARY KEY (id);


--
-- Name: universes universes_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universes
    ADD CONSTRAINT universes_slug_key UNIQUE (slug);


--
-- Name: upload_logs upload_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_logs
    ADD CONSTRAINT upload_logs_pkey PRIMARY KEY (id);


--
-- Name: user_decisions user_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_decisions
    ADD CONSTRAINT user_decisions_pkey PRIMARY KEY (id);


--
-- Name: video_processing_jobs video_processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_processing_jobs
    ADD CONSTRAINT video_processing_jobs_pkey PRIMARY KEY (id);


--
-- Name: voice_rules voice_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_rules
    ADD CONSTRAINT voice_rules_pkey PRIMARY KEY (id);


--
-- Name: voice_signals voice_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_signals
    ADD CONSTRAINT voice_signals_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_brand_tags wardrobe_brand_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_brand_tags
    ADD CONSTRAINT wardrobe_brand_tags_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_content_assignments wardrobe_content_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_content_assignments
    ADD CONSTRAINT wardrobe_content_assignments_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_library wardrobe_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_library
    ADD CONSTRAINT wardrobe_library_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_library_references wardrobe_library_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_library_references
    ADD CONSTRAINT wardrobe_library_references_pkey PRIMARY KEY (id);


--
-- Name: wardrobe wardrobe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe
    ADD CONSTRAINT wardrobe_pkey PRIMARY KEY (id);


--
-- Name: wardrobe_usage_history wardrobe_usage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_pkey PRIMARY KEY (id);


--
-- Name: world_character_batches world_character_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_character_batches
    ADD CONSTRAINT world_character_batches_pkey PRIMARY KEY (id);


--
-- Name: world_characters world_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_characters
    ADD CONSTRAINT world_characters_pkey PRIMARY KEY (id);


--
-- Name: world_events world_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_events
    ADD CONSTRAINT world_events_pkey PRIMARY KEY (id);


--
-- Name: world_locations world_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_locations
    ADD CONSTRAINT world_locations_pkey PRIMARY KEY (id);


--
-- Name: world_state_snapshots world_state_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_state_snapshots
    ADD CONSTRAINT world_state_snapshots_pkey PRIMARY KEY (id);


--
-- Name: world_timeline_events world_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_timeline_events
    ADD CONSTRAINT world_timeline_events_pkey PRIMARY KEY (id);


--
-- Name: writing_goals writing_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.writing_goals
    ADD CONSTRAINT writing_goals_pkey PRIMARY KEY (id);


--
-- Name: writing_rhythm writing_rhythm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.writing_rhythm
    ADD CONSTRAINT writing_rhythm_pkey PRIMARY KEY (id);


--
-- Name: ai_interactions_episode_id_trigger_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_interactions_episode_id_trigger_time ON public.ai_interactions USING btree (episode_id, trigger_time);


--
-- Name: ai_usage_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_logs_created_at ON public.ai_usage_logs USING btree (created_at);


--
-- Name: ai_usage_logs_model_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_logs_model_name ON public.ai_usage_logs USING btree (model_name);


--
-- Name: ai_usage_logs_route_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_logs_route_name ON public.ai_usage_logs USING btree (route_name);


--
-- Name: amber_findings_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amber_findings_severity ON public.amber_findings USING btree (severity);


--
-- Name: amber_findings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amber_findings_status ON public.amber_findings USING btree (status);


--
-- Name: amber_findings_surfaced_in_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amber_findings_surfaced_in_chat ON public.amber_findings USING btree (surfaced_in_chat);


--
-- Name: amber_findings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amber_findings_type ON public.amber_findings USING btree (type);


--
-- Name: amber_findings_urgent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amber_findings_urgent ON public.amber_findings USING btree (urgent);


--
-- Name: amber_task_queue_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amber_task_queue_priority ON public.amber_task_queue USING btree (priority);


--
-- Name: amber_task_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amber_task_queue_status ON public.amber_task_queue USING btree (status);


--
-- Name: asset_roles_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_roles_role_key ON public.asset_roles USING btree (role_key);


--
-- Name: asset_roles_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_roles_show_id ON public.asset_roles USING btree (show_id);


--
-- Name: asset_roles_show_id_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX asset_roles_show_id_role_key ON public.asset_roles USING btree (show_id, role_key);


--
-- Name: assets_asset_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_asset_group ON public.assets USING btree (asset_group);


--
-- Name: assets_asset_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_asset_scope ON public.assets USING btree (asset_scope);


--
-- Name: assets_asset_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_asset_type ON public.assets USING btree (asset_type);


--
-- Name: assets_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_category_idx ON public.assets USING btree (category);


--
-- Name: assets_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_deleted_at ON public.assets USING btree (deleted_at);


--
-- Name: assets_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_episode_id ON public.assets USING btree (episode_id);


--
-- Name: assets_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_show_id ON public.assets USING btree (show_id);


--
-- Name: author_notes_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX author_notes_created_by ON public.author_notes USING btree (created_by);


--
-- Name: author_notes_entity_type_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX author_notes_entity_type_entity_id ON public.author_notes USING btree (entity_type, entity_id);


--
-- Name: author_notes_note_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX author_notes_note_type ON public.author_notes USING btree (note_type);


--
-- Name: author_notes_visible_to_amber; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX author_notes_visible_to_amber ON public.author_notes USING btree (visible_to_amber);


--
-- Name: bij_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bij_status_idx ON public.bulk_import_jobs USING btree (status);


--
-- Name: book_series_show_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_series_show_id_idx ON public.book_series USING btree (show_id);


--
-- Name: book_series_universe_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_series_universe_id_idx ON public.book_series USING btree (universe_id);


--
-- Name: calendar_event_attendees_attendee_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_attendees_attendee_type ON public.calendar_event_attendees USING btree (attendee_type);


--
-- Name: calendar_event_attendees_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_attendees_character_id ON public.calendar_event_attendees USING btree (character_id);


--
-- Name: calendar_event_attendees_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_attendees_event_id ON public.calendar_event_attendees USING btree (event_id);


--
-- Name: calendar_event_attendees_feed_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_attendees_feed_profile_id ON public.calendar_event_attendees USING btree (feed_profile_id);


--
-- Name: calendar_event_ripples_affected_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_ripples_affected_character_id ON public.calendar_event_ripples USING btree (affected_character_id);


--
-- Name: calendar_event_ripples_affected_feed_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_ripples_affected_feed_profile_id ON public.calendar_event_ripples USING btree (affected_feed_profile_id);


--
-- Name: calendar_event_ripples_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_ripples_event_id ON public.calendar_event_ripples USING btree (event_id);


--
-- Name: calendar_event_ripples_ripple_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_ripples_ripple_type ON public.calendar_event_ripples USING btree (ripple_type);


--
-- Name: calendar_event_ripples_thread_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_event_ripples_thread_confirmed ON public.calendar_event_ripples USING btree (thread_confirmed);


--
-- Name: ce_unique_char_profile_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ce_unique_char_profile_type ON public.character_entanglements USING btree (character_id, profile_id, entanglement_type);


--
-- Name: character_crossings_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_crossings_character_id ON public.character_crossings USING btree (character_id);


--
-- Name: character_crossings_gap_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_crossings_gap_confirmed ON public.character_crossings USING btree (gap_confirmed);


--
-- Name: character_crossings_performance_gap_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_crossings_performance_gap_score ON public.character_crossings USING btree (performance_gap_score);


--
-- Name: character_entanglements_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_entanglements_character_id ON public.character_entanglements USING btree (character_id);


--
-- Name: character_entanglements_entanglement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_entanglements_entanglement_type ON public.character_entanglements USING btree (entanglement_type);


--
-- Name: character_entanglements_intensity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_entanglements_intensity ON public.character_entanglements USING btree (intensity);


--
-- Name: character_entanglements_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_entanglements_is_active ON public.character_entanglements USING btree (is_active);


--
-- Name: character_entanglements_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_entanglements_profile_id ON public.character_entanglements USING btree (profile_id);


--
-- Name: character_entanglements_turbulence_flag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_entanglements_turbulence_flag ON public.character_entanglements USING btree (turbulence_flag);


--
-- Name: character_follow_profiles_character_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX character_follow_profiles_character_key ON public.character_follow_profiles USING btree (character_key);


--
-- Name: character_follow_profiles_registry_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_follow_profiles_registry_character_id ON public.character_follow_profiles USING btree (registry_character_id);


--
-- Name: character_growth_log_author_reviewed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_growth_log_author_reviewed ON public.character_growth_log USING btree (author_reviewed);


--
-- Name: character_growth_log_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_growth_log_character_id ON public.character_growth_log USING btree (character_id);


--
-- Name: character_growth_log_update_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_growth_log_update_type ON public.character_growth_log USING btree (update_type);


--
-- Name: character_profiles_character_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_profiles_character_name ON public.character_profiles USING btree (character_name);


--
-- Name: character_profiles_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_profiles_show_id ON public.character_profiles USING btree (show_id);


--
-- Name: character_registries_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_registries_show_id ON public.character_registries USING btree (show_id);


--
-- Name: character_registries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_registries_status ON public.character_registries USING btree (status);


--
-- Name: character_relationships_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_relationships_book_id ON public.character_relationships USING btree (book_id);


--
-- Name: character_relationships_layer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_relationships_layer ON public.character_relationships USING btree (layer);


--
-- Name: character_relationships_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_relationships_show_id ON public.character_relationships USING btree (show_id);


--
-- Name: character_relationships_source_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_relationships_source_name ON public.character_relationships USING btree (source_name);


--
-- Name: character_relationships_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_relationships_status ON public.character_relationships USING btree (status);


--
-- Name: character_relationships_target_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX character_relationships_target_name ON public.character_relationships USING btree (target_name);


--
-- Name: composition_assets_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX composition_assets_asset_id ON public.composition_assets USING btree (asset_id);


--
-- Name: composition_assets_asset_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX composition_assets_asset_role ON public.composition_assets USING btree (asset_role);


--
-- Name: composition_assets_composition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX composition_assets_composition_id ON public.composition_assets USING btree (composition_id);


--
-- Name: composition_assets_composition_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX composition_assets_composition_role_unique ON public.composition_assets USING btree (composition_id, asset_role);


--
-- Name: composition_outputs_composition_format_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX composition_outputs_composition_format_unique ON public.composition_outputs USING btree (composition_id, format);


--
-- Name: decision_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_log_created_at ON public.decision_log USING btree (created_at);


--
-- Name: decision_log_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_log_episode_id ON public.decision_log USING btree (episode_id);


--
-- Name: decision_log_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_log_show_id ON public.decision_log USING btree (show_id);


--
-- Name: decision_log_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_log_source ON public.decision_log USING btree (source);


--
-- Name: decision_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_log_type ON public.decision_log USING btree (type);


--
-- Name: decision_patterns_confidence_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_patterns_confidence_score ON public.decision_patterns USING btree (confidence_score);


--
-- Name: decision_patterns_pattern_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_patterns_pattern_category ON public.decision_patterns USING btree (pattern_category);


--
-- Name: decision_patterns_pattern_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_patterns_pattern_type ON public.decision_patterns USING btree (pattern_type);


--
-- Name: decision_patterns_sample_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decision_patterns_sample_count ON public.decision_patterns USING btree (sample_count);


--
-- Name: edit_maps_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX edit_maps_episode_id ON public.edit_maps USING btree (episode_id);


--
-- Name: edit_maps_processing_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX edit_maps_processing_status ON public.edit_maps USING btree (processing_status);


--
-- Name: edit_maps_raw_footage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX edit_maps_raw_footage_id ON public.edit_maps USING btree (raw_footage_id);


--
-- Name: entanglement_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entanglement_events_created_at ON public.entanglement_events USING btree (created_at);


--
-- Name: entanglement_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entanglement_events_event_type ON public.entanglement_events USING btree (event_type);


--
-- Name: entanglement_events_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entanglement_events_profile_id ON public.entanglement_events USING btree (profile_id);


--
-- Name: entanglement_events_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entanglement_events_resolved ON public.entanglement_events USING btree (resolved);


--
-- Name: entanglement_unfollows_author_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entanglement_unfollows_author_confirmed ON public.entanglement_unfollows USING btree (author_confirmed);


--
-- Name: entanglement_unfollows_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entanglement_unfollows_character_id ON public.entanglement_unfollows USING btree (character_id);


--
-- Name: entanglement_unfollows_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entanglement_unfollows_profile_id ON public.entanglement_unfollows USING btree (profile_id);


--
-- Name: entanglement_unfollows_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entanglement_unfollows_visibility ON public.entanglement_unfollows USING btree (visibility);


--
-- Name: episode_phases_episode_id_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_phases_episode_id_start_time ON public.episode_phases USING btree (episode_id, start_time);


--
-- Name: episode_scenes_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_scenes_episode_id ON public.episode_scenes USING btree (episode_id);


--
-- Name: episode_scenes_episode_id_scene_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_scenes_episode_id_scene_order ON public.episode_scenes USING btree (episode_id, scene_order);


--
-- Name: episode_scenes_scene_library_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_scenes_scene_library_id ON public.episode_scenes USING btree (scene_library_id);


--
-- Name: episode_templates_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_templates_created_by_idx ON public.episode_templates USING btree (created_by);


--
-- Name: episode_templates_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_templates_is_active_idx ON public.episode_templates USING btree (is_active);


--
-- Name: episode_templates_is_default_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_templates_is_default_idx ON public.episode_templates USING btree (is_default);


--
-- Name: episode_templates_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX episode_templates_name_unique ON public.episode_templates USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: episode_templates_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX episode_templates_slug_unique ON public.episode_templates USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: episode_templates_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_templates_sort_order_idx ON public.episode_templates USING btree (sort_order);


--
-- Name: episode_templates_usage_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_templates_usage_count_idx ON public.episode_templates USING btree (usage_count);


--
-- Name: episode_wardrobe_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_wardrobe_episode_id ON public.episode_wardrobe USING btree (episode_id);


--
-- Name: episode_wardrobe_wardrobe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episode_wardrobe_wardrobe_id ON public.episode_wardrobe USING btree (wardrobe_id);


--
-- Name: eu_unique_char_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX eu_unique_char_profile ON public.entanglement_unfollows USING btree (character_id, profile_id);


--
-- Name: feed_moments_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_moments_episode_id ON public.feed_moments USING btree (episode_id);


--
-- Name: feed_moments_episode_id_beat_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_moments_episode_id_beat_number ON public.feed_moments USING btree (episode_id, beat_number);


--
-- Name: feed_moments_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_moments_event_id ON public.feed_moments USING btree (event_id) WHERE (event_id IS NOT NULL);


--
-- Name: feed_posts_is_viral; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_posts_is_viral ON public.feed_posts USING btree (is_viral) WHERE (is_viral = true);


--
-- Name: feed_posts_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_posts_thread_id ON public.feed_posts USING btree (thread_id) WHERE (thread_id IS NOT NULL);


--
-- Name: feed_posts_trending_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_posts_trending_topic ON public.feed_posts USING btree (trending_topic) WHERE (trending_topic IS NOT NULL);


--
-- Name: feed_profile_relationships_influencer_a_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_profile_relationships_influencer_a_id ON public.feed_profile_relationships USING btree (influencer_a_id);


--
-- Name: feed_profile_relationships_influencer_b_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_profile_relationships_influencer_b_id ON public.feed_profile_relationships USING btree (influencer_b_id);


--
-- Name: feed_profile_relationships_relationship_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_profile_relationships_relationship_type ON public.feed_profile_relationships USING btree (relationship_type);


--
-- Name: feed_profile_relationships_story_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_profile_relationships_story_position ON public.feed_profile_relationships USING btree (story_position);


--
-- Name: franchise_tech_knowledge_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX franchise_tech_knowledge_category ON public.franchise_tech_knowledge USING btree (category);


--
-- Name: franchise_tech_knowledge_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX franchise_tech_knowledge_status ON public.franchise_tech_knowledge USING btree (status);


--
-- Name: hair_library_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hair_library_show_id ON public.hair_library USING btree (show_id);


--
-- Name: idx_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_type ON public.activity_logs USING btree ("actionType");


--
-- Name: idx_air_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_air_date ON public.episodes USING btree (air_date);


--
-- Name: idx_asset_usage_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_usage_asset ON public.asset_usage_log USING btree (asset_id);


--
-- Name: idx_asset_usage_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_usage_episode ON public.asset_usage_log USING btree (episode_id);


--
-- Name: idx_asset_usage_scene; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_usage_scene ON public.asset_usage_log USING btree (scene_id);


--
-- Name: idx_assets_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_character ON public.assets USING btree (character_name) WHERE (character_name IS NOT NULL);


--
-- Name: idx_assets_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_entity_type ON public.assets USING btree (entity_type);


--
-- Name: idx_assets_file_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_file_hash ON public.assets USING btree (file_hash) WHERE (file_hash IS NOT NULL);


--
-- Name: idx_assets_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_location ON public.assets USING btree (location_name, location_version) WHERE (location_name IS NOT NULL);


--
-- Name: idx_assets_overlay_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_overlay_episode ON public.assets USING btree (asset_type, show_id, episode_id) WHERE (((asset_type)::text = 'UI_OVERLAY'::text) AND (deleted_at IS NULL));


--
-- Name: idx_assets_show_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_show_category ON public.assets USING btree (show_id, category);


--
-- Name: idx_audio_clips_beat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audio_clips_beat ON public.audio_clips USING btree (beat_id) WHERE (beat_id IS NOT NULL);


--
-- Name: idx_audio_clips_scene; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audio_clips_scene ON public.audio_clips USING btree (scene_id);


--
-- Name: idx_audio_clips_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audio_clips_status ON public.audio_clips USING btree (status);


--
-- Name: idx_audio_clips_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audio_clips_time ON public.audio_clips USING btree (scene_id, start_time);


--
-- Name: idx_audio_clips_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audio_clips_type ON public.audio_clips USING btree (track_type);


--
-- Name: idx_beats_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beats_character ON public.beats USING btree (character_id) WHERE (character_id IS NOT NULL);


--
-- Name: idx_beats_scene; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beats_scene ON public.beats USING btree (scene_id);


--
-- Name: idx_beats_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beats_status ON public.beats USING btree (status);


--
-- Name: idx_beats_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beats_time ON public.beats USING btree (scene_id, start_time);


--
-- Name: idx_beats_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beats_type ON public.beats USING btree (beat_type);


--
-- Name: idx_brain_fingerprints_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_fingerprints_hash ON public.brain_fingerprints USING btree (brain_type, content_hash);


--
-- Name: idx_brain_fingerprints_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brain_fingerprints_source ON public.brain_fingerprints USING btree (brain_type, series_id, source_document, source_version);


--
-- Name: idx_calendar_events_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_location ON public.story_calendar_events USING btree (location_id);


--
-- Name: idx_career_goals_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_goals_active ON public.career_goals USING btree (show_id, type, status);


--
-- Name: idx_career_goals_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_goals_show ON public.career_goals USING btree (show_id);


--
-- Name: idx_career_goals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_goals_status ON public.career_goals USING btree (status);


--
-- Name: idx_career_goals_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_goals_type ON public.career_goals USING btree (type);


--
-- Name: idx_char_rel_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_char_rel_confirmed ON public.character_relationships USING btree (confirmed);


--
-- Name: idx_character_clips_beat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_clips_beat ON public.character_clips USING btree (beat_id) WHERE (beat_id IS NOT NULL);


--
-- Name: idx_character_clips_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_clips_character ON public.character_clips USING btree (character_id);


--
-- Name: idx_character_clips_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_clips_role ON public.character_clips USING btree (role);


--
-- Name: idx_character_clips_scene; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_clips_scene ON public.character_clips USING btree (scene_id);


--
-- Name: idx_character_clips_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_clips_status ON public.character_clips USING btree (status);


--
-- Name: idx_character_clips_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_clips_time ON public.character_clips USING btree (scene_id, start_time);


--
-- Name: idx_character_state_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_state_key ON public.character_state USING btree (character_key);


--
-- Name: idx_character_state_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_character_state_unique ON public.character_state USING btree (show_id, season_id, character_key) WHERE (season_id IS NOT NULL);


--
-- Name: idx_characters_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characters_show_id ON public.characters USING btree (show_id);


--
-- Name: idx_composition_outputs_composition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composition_outputs_composition_id ON public.composition_outputs USING btree (composition_id);


--
-- Name: idx_composition_outputs_format; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composition_outputs_format ON public.composition_outputs USING btree (format);


--
-- Name: idx_composition_outputs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_composition_outputs_status ON public.composition_outputs USING btree (status);


--
-- Name: idx_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_created_at ON public.processing_queues USING btree ("createdAt");


--
-- Name: idx_csh_character_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csh_character_show ON public.character_state_history USING btree (character_key, show_id);


--
-- Name: idx_csh_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csh_created ON public.character_state_history USING btree (created_at);


--
-- Name: idx_csh_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csh_episode ON public.character_state_history USING btree (episode_id);


--
-- Name: idx_decision_logs_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_decision_logs_action_type ON public.decision_logs USING btree (action_type);


--
-- Name: idx_decision_logs_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_decision_logs_episode ON public.decision_logs USING btree (episode_id);


--
-- Name: idx_decision_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_decision_logs_timestamp ON public.decision_logs USING btree ("timestamp");


--
-- Name: idx_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deleted_at ON public.episodes USING btree (deleted_at);


--
-- Name: idx_episode_assets_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_assets_asset_id ON public.episode_assets USING btree (asset_id);


--
-- Name: idx_episode_assets_episode_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_episode_assets_episode_asset ON public.episode_assets USING btree (episode_id, asset_id);


--
-- Name: idx_episode_assets_episode_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_assets_episode_folder ON public.episode_assets USING btree (episode_id, folder);


--
-- Name: idx_episode_assets_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_assets_episode_id ON public.episode_assets USING btree (episode_id);


--
-- Name: idx_episode_briefs_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_briefs_episode_id ON public.episode_briefs USING btree (episode_id);


--
-- Name: idx_episode_briefs_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_briefs_show_id ON public.episode_briefs USING btree (show_id);


--
-- Name: idx_episode_briefs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_briefs_status ON public.episode_briefs USING btree (status);


--
-- Name: idx_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_id ON public.thumbnails USING btree ("episodeId");


--
-- Name: idx_episode_scenes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_scenes_type ON public.episode_scenes USING btree (type);


--
-- Name: idx_episode_scripts_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_scripts_episode_id ON public.episode_scripts USING btree (episode_id);


--
-- Name: idx_episode_scripts_episode_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_episode_scripts_episode_version ON public.episode_scripts USING btree (episode_id, version);


--
-- Name: idx_episode_scripts_is_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_scripts_is_current ON public.episode_scripts USING btree (is_current);


--
-- Name: idx_episode_scripts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_scripts_status ON public.episode_scripts USING btree (status);


--
-- Name: idx_episode_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_status ON public.processing_queues USING btree ("episodeId", status);


--
-- Name: idx_episode_todo_lists_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_todo_lists_episode_id ON public.episode_todo_lists USING btree (episode_id);


--
-- Name: idx_episodes_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episodes_platform ON public.episodes USING btree (platform);


--
-- Name: idx_feed_posts_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_posts_episode ON public.feed_posts USING btree (episode_id);


--
-- Name: idx_feed_posts_function; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_posts_function ON public.feed_posts USING btree (narrative_function);


--
-- Name: idx_feed_posts_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_posts_profile ON public.feed_posts USING btree (social_profile_id);


--
-- Name: idx_feed_posts_timeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_posts_timeline ON public.feed_posts USING btree (show_id, posted_at);


--
-- Name: idx_fk_always_inject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fk_always_inject ON public.franchise_knowledge USING btree (always_inject) WHERE (always_inject = true);


--
-- Name: idx_fk_status_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fk_status_severity ON public.franchise_knowledge USING btree (status, severity);


--
-- Name: idx_ft_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ft_created ON public.financial_transactions USING btree (created_at);


--
-- Name: idx_ft_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ft_episode ON public.financial_transactions USING btree (episode_id);


--
-- Name: idx_ft_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ft_event ON public.financial_transactions USING btree (event_id);


--
-- Name: idx_ft_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ft_show ON public.financial_transactions USING btree (show_id);


--
-- Name: idx_ft_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ft_status ON public.financial_transactions USING btree (status);


--
-- Name: idx_generation_jobs_scene_set_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generation_jobs_scene_set_status ON public.generation_jobs USING btree (scene_set_id, status);


--
-- Name: idx_generation_jobs_status_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generation_jobs_status_priority ON public.generation_jobs USING btree (status, priority);


--
-- Name: idx_is_book; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_book ON public.intimate_scenes USING btree (book_id);


--
-- Name: idx_is_char_a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_char_a ON public.intimate_scenes USING btree (character_a_id);


--
-- Name: idx_is_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_status ON public.intimate_scenes USING btree (status);


--
-- Name: idx_is_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_type ON public.intimate_scenes USING btree (scene_type);


--
-- Name: idx_job_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_status ON public.processing_queues USING btree ("jobType", status);


--
-- Name: idx_markers_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markers_category ON public.markers USING btree (category);


--
-- Name: idx_markers_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markers_episode ON public.markers USING btree (episode_id);


--
-- Name: idx_markers_scene; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markers_scene ON public.markers USING btree (scene_id);


--
-- Name: idx_markers_timecode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markers_timecode ON public.markers USING btree (episode_id, timecode);


--
-- Name: idx_markers_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markers_type ON public.markers USING btree (marker_type);


--
-- Name: idx_metadata_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_episode_id ON public.metadata_storage USING btree ("episodeId");


--
-- Name: idx_novel_char_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_novel_char_key ON public.novel_assemblies USING btree (character_key);


--
-- Name: idx_novel_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_novel_status ON public.novel_assemblies USING btree (status);


--
-- Name: idx_opportunities_career_goal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunities_career_goal ON public.opportunities USING btree (career_goal_id);


--
-- Name: idx_phone_missions_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phone_missions_episode ON public.phone_missions USING btree (episode_id);


--
-- Name: idx_phone_missions_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phone_missions_show ON public.phone_missions USING btree (show_id);


--
-- Name: idx_phone_playthrough_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phone_playthrough_episode ON public.phone_playthrough_state USING btree (episode_id);


--
-- Name: idx_phone_playthrough_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phone_playthrough_show ON public.phone_playthrough_state USING btree (show_id);


--
-- Name: idx_pipeline_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_step ON public.pipeline_tracking USING btree (current_step);


--
-- Name: idx_pipeline_story; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_story ON public.pipeline_tracking USING btree (story_id);


--
-- Name: idx_processing_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processing_status ON public.episodes USING btree (processing_status);


--
-- Name: idx_rc_world_char; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rc_world_char ON public.registry_characters USING btree (world_character_id);


--
-- Name: idx_rel_events_relationship; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rel_events_relationship ON public.relationship_events USING btree (relationship_id);


--
-- Name: idx_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource ON public.activity_logs USING btree ("resourceType", "resourceId");


--
-- Name: idx_sc_scene; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sc_scene ON public.scene_continuations USING btree (scene_id);


--
-- Name: idx_scene_angles_gen_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_angles_gen_status ON public.scene_angles USING btree (generation_status);


--
-- Name: idx_scene_angles_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_angles_label ON public.scene_angles USING btree (angle_label);


--
-- Name: idx_scene_angles_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_angles_set_id ON public.scene_angles USING btree (scene_set_id);


--
-- Name: idx_scene_assets_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_assets_group_id ON public.scene_assets USING btree (group_id);


--
-- Name: idx_scene_assets_is_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_assets_is_visible ON public.scene_assets USING btree (is_visible);


--
-- Name: idx_scene_assets_object_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_assets_object_type ON public.scene_assets USING btree (object_type);


--
-- Name: idx_scene_assets_scene_angle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_assets_scene_angle_id ON public.scene_assets USING btree (scene_angle_id);


--
-- Name: idx_scene_assets_scene_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_assets_scene_set_id ON public.scene_assets USING btree (scene_set_id);


--
-- Name: idx_scene_assets_variant_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_assets_variant_group_id ON public.scene_assets USING btree (variant_group_id);


--
-- Name: idx_scene_object_variants_active_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_object_variants_active_variant_id ON public.scene_object_variants USING btree (active_variant_id);


--
-- Name: idx_scene_object_variants_scene_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_object_variants_scene_id ON public.scene_object_variants USING btree (scene_id);


--
-- Name: idx_scene_plans_episode_beat; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_scene_plans_episode_beat ON public.scene_plans USING btree (episode_id, beat_number);


--
-- Name: idx_scene_plans_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_plans_episode_id ON public.scene_plans USING btree (episode_id);


--
-- Name: idx_scene_plans_scene_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_plans_scene_set_id ON public.scene_plans USING btree (scene_set_id);


--
-- Name: idx_scene_sets_franchise; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_sets_franchise ON public.scene_sets USING btree (is_franchise_asset);


--
-- Name: idx_scene_sets_gen_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_sets_gen_status ON public.scene_sets USING btree (generation_status);


--
-- Name: idx_scene_sets_scene_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_sets_scene_type ON public.scene_sets USING btree (scene_type);


--
-- Name: idx_scene_sets_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_sets_show_id ON public.scene_sets USING btree (show_id);


--
-- Name: idx_scene_sets_universe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_sets_universe_id ON public.scene_sets USING btree (universe_id);


--
-- Name: idx_scene_sets_world_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scene_sets_world_location ON public.scene_sets USING btree (world_location_id);


--
-- Name: idx_scenes_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenes_episode_id ON public.scenes USING btree (episode_id);


--
-- Name: idx_scenes_scene_angle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenes_scene_angle_id ON public.scenes USING btree (scene_angle_id);


--
-- Name: idx_scenes_scene_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenes_scene_number ON public.scenes USING btree (scene_number);


--
-- Name: idx_scenes_scene_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenes_scene_set_id ON public.scenes USING btree (scene_set_id);


--
-- Name: idx_scenes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenes_status ON public.scenes USING btree (status);


--
-- Name: idx_scenes_thumbnail_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenes_thumbnail_id ON public.scenes USING btree (thumbnail_id);


--
-- Name: idx_script_metadata_scene_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_script_metadata_scene_type ON public.script_metadata USING btree (scene_type);


--
-- Name: idx_script_metadata_script_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_script_metadata_script_id ON public.script_metadata USING btree (script_id);


--
-- Name: idx_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_show_id ON public.episodes USING btree (show_id);


--
-- Name: idx_show_season_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_show_season_episode ON public.episodes USING btree (show_name, season_number, episode_number);


--
-- Name: idx_social_canon_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_canon_status ON public.social_media_imports USING btree (canon_status);


--
-- Name: idx_social_char_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_char_key ON public.social_media_imports USING btree (character_key);


--
-- Name: idx_social_lala; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_lala ON public.social_media_imports USING btree (lala_detected);


--
-- Name: idx_social_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_platform ON public.social_media_imports USING btree (platform);


--
-- Name: idx_social_profiles_archetype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_profiles_archetype ON public.social_profiles USING btree (archetype, status);


--
-- Name: idx_social_profiles_handle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_profiles_handle ON public.social_profiles USING btree (handle, platform);


--
-- Name: idx_social_profiles_series; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_profiles_series ON public.social_profiles USING btree (series_id, status);


--
-- Name: idx_sqs_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sqs_message_id ON public.processing_queues USING btree ("sqsMessageId");


--
-- Name: idx_stories_char_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stories_char_key ON public.storyteller_stories USING btree (character_key);


--
-- Name: idx_stories_char_num; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_stories_char_num ON public.storyteller_stories USING btree (character_key, story_number);


--
-- Name: idx_stories_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stories_episode ON public.stories USING btree (episode_id);


--
-- Name: idx_stories_format; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stories_format ON public.stories USING btree (format);


--
-- Name: idx_stories_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stories_phase ON public.storyteller_stories USING btree (phase);


--
-- Name: idx_stories_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stories_show ON public.stories USING btree (show_id);


--
-- Name: idx_stories_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stories_status ON public.storyteller_stories USING btree (status);


--
-- Name: idx_story_revisions_story; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_revisions_story ON public.story_revisions USING btree (story_id);


--
-- Name: idx_story_threads_book; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_threads_book ON public.story_threads USING btree (book_id);


--
-- Name: idx_story_threads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_threads_status ON public.story_threads USING btree (status);


--
-- Name: idx_storyteller_memories_character_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storyteller_memories_character_confirmed ON public.storyteller_memories USING btree (character_id, confirmed);


--
-- Name: idx_storyteller_memories_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storyteller_memories_character_id ON public.storyteller_memories USING btree (character_id);


--
-- Name: idx_storyteller_memories_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storyteller_memories_confirmed ON public.storyteller_memories USING btree (confirmed);


--
-- Name: idx_storyteller_memories_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storyteller_memories_line_id ON public.storyteller_memories USING btree (line_id);


--
-- Name: idx_thumbnail_compositions_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thumbnail_compositions_deleted_at ON public.thumbnail_compositions USING btree (deleted_at);


--
-- Name: idx_thumbnail_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thumbnail_episode_id ON public.thumbnails USING btree ("episodeId");


--
-- Name: idx_thumbnail_s3_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_thumbnail_s3_key ON public.thumbnails USING btree ("s3Key");


--
-- Name: idx_thumbnail_type_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thumbnail_type_episode ON public.thumbnails USING btree ("thumbnailType", "episodeId");


--
-- Name: idx_timeline_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_timeline_episode ON public.timeline_data USING btree (episode_id);


--
-- Name: idx_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timestamp ON public.activity_logs USING btree ("timestamp");


--
-- Name: idx_user_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_timestamp ON public.activity_logs USING btree ("userId", "timestamp");


--
-- Name: idx_voice_rules_series; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_rules_series ON public.voice_rules USING btree (series_id, character_name, status);


--
-- Name: idx_voice_signals_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_signals_pattern ON public.voice_signals USING btree (series_id, pattern_tag, status);


--
-- Name: idx_wardrobe_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_character_id ON public.wardrobe USING btree (character_id);


--
-- Name: idx_wardrobe_clothing_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_clothing_category ON public.wardrobe USING btree (clothing_category);


--
-- Name: idx_wardrobe_defaults_episode_character; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_wardrobe_defaults_episode_character ON public.episode_wardrobe_defaults USING btree (episode_id, character_name);


--
-- Name: idx_wardrobe_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_deleted_at ON public.wardrobe USING btree (deleted_at);


--
-- Name: idx_wardrobe_era; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_era ON public.wardrobe USING btree (era_alignment);


--
-- Name: idx_wardrobe_is_favorite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_is_favorite ON public.wardrobe USING btree (is_favorite);


--
-- Name: idx_wardrobe_is_owned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_is_owned ON public.wardrobe USING btree (is_owned);


--
-- Name: idx_wardrobe_lock_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_lock_type ON public.wardrobe USING btree (lock_type);


--
-- Name: idx_wardrobe_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_show_id ON public.wardrobe USING btree (show_id);


--
-- Name: idx_wardrobe_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wardrobe_tier ON public.wardrobe USING btree (tier);


--
-- Name: idx_wc_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wc_batch ON public.world_characters USING btree (batch_id);


--
-- Name: idx_wc_intimate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wc_intimate ON public.world_characters USING btree (intimate_eligible);


--
-- Name: idx_wc_registry_char; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wc_registry_char ON public.world_characters USING btree (registry_character_id);


--
-- Name: idx_wc_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wc_status ON public.world_characters USING btree (status);


--
-- Name: idx_wc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wc_type ON public.world_characters USING btree (character_type);


--
-- Name: idx_world_events_career_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_career_tier ON public.world_events USING btree (career_tier);


--
-- Name: idx_world_events_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_opportunity ON public.world_events USING btree (opportunity_id);


--
-- Name: idx_world_events_prestige; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_prestige ON public.world_events USING btree (prestige);


--
-- Name: idx_world_events_scene_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_scene_set_id ON public.world_events USING btree (scene_set_id);


--
-- Name: idx_world_events_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_show ON public.world_events USING btree (show_id);


--
-- Name: idx_world_events_source_calendar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_source_calendar ON public.world_events USING btree (source_calendar_event_id);


--
-- Name: idx_world_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_status ON public.world_events USING btree (status);


--
-- Name: idx_world_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_type ON public.world_events USING btree (event_type);


--
-- Name: idx_world_events_venue_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_events_venue_location ON public.world_events USING btree (venue_location_id);


--
-- Name: idx_world_locations_universe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_locations_universe ON public.world_locations USING btree (universe_id);


--
-- Name: idx_world_snapshots_chapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_snapshots_chapter ON public.world_state_snapshots USING btree (chapter_id);


--
-- Name: idx_world_timeline_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_timeline_sort ON public.world_timeline_events USING btree (sort_order);


--
-- Name: idx_world_timeline_universe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_world_timeline_universe ON public.world_timeline_events USING btree (universe_id);


--
-- Name: interactive_elements_episode_id_appears_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interactive_elements_episode_id_appears_at ON public.interactive_elements USING btree (episode_id, appears_at);


--
-- Name: lala_cash_grab_quests_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_cash_grab_quests_episode_id ON public.lala_cash_grab_quests USING btree (episode_id);


--
-- Name: lala_emergence_scenes_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_emergence_scenes_book_id ON public.lala_emergence_scenes USING btree (book_id);


--
-- Name: lala_emergence_scenes_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_emergence_scenes_chapter_id ON public.lala_emergence_scenes USING btree (chapter_id);


--
-- Name: lala_emergence_scenes_confirmed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_emergence_scenes_confirmed ON public.lala_emergence_scenes USING btree (confirmed);


--
-- Name: lala_emergence_scenes_franchise_anchor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_emergence_scenes_franchise_anchor ON public.lala_emergence_scenes USING btree (franchise_anchor);


--
-- Name: lala_emergence_scenes_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lala_emergence_scenes_line_id ON public.lala_emergence_scenes USING btree (line_id);


--
-- Name: lala_episode_formulas_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_episode_formulas_episode_id ON public.lala_episode_formulas USING btree (episode_id);


--
-- Name: lala_episode_timeline_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_episode_timeline_episode_id ON public.lala_episode_timeline USING btree (episode_id);


--
-- Name: lala_friend_archetypes_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_friend_archetypes_episode_id ON public.lala_friend_archetypes USING btree (episode_id);


--
-- Name: lala_micro_goals_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lala_micro_goals_episode_id ON public.lala_micro_goals USING btree (episode_id);


--
-- Name: layer_assets_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layer_assets_asset_id ON public.layer_assets USING btree (asset_id);


--
-- Name: layer_assets_layer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layer_assets_layer_id ON public.layer_assets USING btree (layer_id);


--
-- Name: layer_assets_layer_id_order_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layer_assets_layer_id_order_index ON public.layer_assets USING btree (layer_id, order_index);


--
-- Name: layers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layers_deleted_at ON public.layers USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: layers_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layers_episode_id ON public.layers USING btree (episode_id);


--
-- Name: layers_episode_id_layer_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layers_episode_id_layer_number ON public.layers USING btree (episode_id, layer_number);


--
-- Name: layout_templates_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layout_templates_show_id ON public.layout_templates USING btree (show_id);


--
-- Name: makeup_library_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX makeup_library_show_id ON public.makeup_library USING btree (show_id);


--
-- Name: multi_product_content_format; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX multi_product_content_format ON public.multi_product_content USING btree (format);


--
-- Name: multi_product_content_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX multi_product_content_status ON public.multi_product_content USING btree (status);


--
-- Name: multi_product_content_story_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX multi_product_content_story_id ON public.multi_product_content USING btree (story_id);


--
-- Name: outfit_set_items_outfit_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outfit_set_items_outfit_set_id ON public.outfit_set_items USING btree (outfit_set_id);


--
-- Name: outfit_set_items_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX outfit_set_items_unique ON public.outfit_set_items USING btree (outfit_set_id, wardrobe_item_id);


--
-- Name: outfit_set_items_wardrobe_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outfit_set_items_wardrobe_item_id ON public.outfit_set_items USING btree (wardrobe_item_id);


--
-- Name: page_content_page_constant_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX page_content_page_constant_unique ON public.page_content USING btree (page_name, constant_key);


--
-- Name: page_content_page_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_content_page_name_idx ON public.page_content USING btree (page_name);


--
-- Name: post_generation_reviews_author_acknowledged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_generation_reviews_author_acknowledged ON public.post_generation_reviews USING btree (author_acknowledged);


--
-- Name: post_generation_reviews_passed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_generation_reviews_passed ON public.post_generation_reviews USING btree (passed);


--
-- Name: post_generation_reviews_story_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_generation_reviews_story_id ON public.post_generation_reviews USING btree (story_id);


--
-- Name: raw_footage_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_footage_episode_id ON public.raw_footage USING btree (episode_id);


--
-- Name: raw_footage_upload_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_footage_upload_purpose ON public.raw_footage USING btree (upload_purpose);


--
-- Name: registry_characters_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registry_characters_deleted_at_idx ON public.registry_characters USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: registry_characters_depth_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registry_characters_depth_level ON public.registry_characters USING btree (depth_level);


--
-- Name: registry_characters_feed_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registry_characters_feed_profile_id ON public.registry_characters USING btree (feed_profile_id);


--
-- Name: registry_characters_registry_id_character_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX registry_characters_registry_id_character_key ON public.registry_characters USING btree (registry_id, character_key);


--
-- Name: registry_characters_registry_id_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registry_characters_registry_id_sort_order ON public.registry_characters USING btree (registry_id, sort_order);


--
-- Name: registry_characters_social_presence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registry_characters_social_presence ON public.registry_characters USING btree (social_presence);


--
-- Name: registry_characters_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registry_characters_status ON public.registry_characters USING btree (status);


--
-- Name: registry_characters_time_orientation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registry_characters_time_orientation ON public.registry_characters USING btree (time_orientation);


--
-- Name: scene_footage_links_match_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_footage_links_match_type ON public.scene_footage_links USING btree (match_type);


--
-- Name: scene_footage_links_scene_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_footage_links_scene_id ON public.scene_footage_links USING btree (scene_id);


--
-- Name: scene_footage_links_script_metadata_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_footage_links_script_metadata_id ON public.scene_footage_links USING btree (script_metadata_id);


--
-- Name: scene_library_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_library_created_at ON public.scene_library USING btree (created_at);


--
-- Name: scene_library_processing_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_library_processing_status ON public.scene_library USING btree (processing_status);


--
-- Name: scene_library_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_library_show_id ON public.scene_library USING btree (show_id);


--
-- Name: scene_proposals_arc_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_proposals_arc_stage ON public.scene_proposals USING btree (arc_stage);


--
-- Name: scene_proposals_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_proposals_book_id ON public.scene_proposals USING btree (book_id);


--
-- Name: scene_proposals_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_proposals_chapter_id ON public.scene_proposals USING btree (chapter_id);


--
-- Name: scene_proposals_scene_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_proposals_scene_type ON public.scene_proposals USING btree (scene_type);


--
-- Name: scene_proposals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_proposals_status ON public.scene_proposals USING btree (status);


--
-- Name: scene_templates_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_templates_created_by ON public.scene_templates USING btree (created_by);


--
-- Name: scene_templates_is_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_templates_is_public ON public.scene_templates USING btree (is_public);


--
-- Name: scene_templates_scene_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scene_templates_scene_type ON public.scene_templates USING btree (scene_type);


--
-- Name: show_arcs_show_id_arc_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX show_arcs_show_id_arc_number ON public.show_arcs USING btree (show_id, arc_number);


--
-- Name: show_arcs_show_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX show_arcs_show_id_status ON public.show_arcs USING btree (show_id, status);


--
-- Name: show_assets_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX show_assets_asset_id ON public.show_assets USING btree (asset_id);


--
-- Name: show_assets_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX show_assets_show_id ON public.show_assets USING btree (show_id);


--
-- Name: show_assets_show_id_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX show_assets_show_id_asset_id ON public.show_assets USING btree (show_id, asset_id) WHERE (deleted_at IS NULL);


--
-- Name: shows_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shows_name_unique_active ON public.shows USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: shows_slug_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shows_slug_unique_active ON public.shows USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: shows_universe_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shows_universe_id_idx ON public.shows USING btree (universe_id);


--
-- Name: social_profile_relationships_relationship_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX social_profile_relationships_relationship_type ON public.social_profile_relationships USING btree (relationship_type);


--
-- Name: social_profile_relationships_source_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX social_profile_relationships_source_profile_id ON public.social_profile_relationships USING btree (source_profile_id);


--
-- Name: social_profile_relationships_target_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX social_profile_relationships_target_profile_id ON public.social_profile_relationships USING btree (target_profile_id);


--
-- Name: sp_geo_cluster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sp_geo_cluster ON public.social_profiles USING btree (geographic_cluster);


--
-- Name: spf_character_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spf_character_key_idx ON public.social_profile_followers USING btree (character_key);


--
-- Name: spf_profile_character_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX spf_profile_character_unique ON public.social_profile_followers USING btree (social_profile_id, character_key);


--
-- Name: spr_unique_pair_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX spr_unique_pair_type ON public.social_profile_relationships USING btree (source_profile_id, target_profile_id, relationship_type);


--
-- Name: story_calendar_events_cultural_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_calendar_events_cultural_category ON public.story_calendar_events USING btree (cultural_category);


--
-- Name: story_calendar_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_calendar_events_event_type ON public.story_calendar_events USING btree (event_type);


--
-- Name: story_calendar_events_lalaverse_district; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_calendar_events_lalaverse_district ON public.story_calendar_events USING btree (lalaverse_district);


--
-- Name: story_calendar_events_logged_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_calendar_events_logged_by ON public.story_calendar_events USING btree (logged_by);


--
-- Name: story_calendar_events_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_calendar_events_series_id ON public.story_calendar_events USING btree (series_id);


--
-- Name: story_calendar_events_start_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_calendar_events_start_datetime ON public.story_calendar_events USING btree (start_datetime);


--
-- Name: story_calendar_events_story_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_calendar_events_story_position ON public.story_calendar_events USING btree (story_position);


--
-- Name: story_calendar_events_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_calendar_events_visibility ON public.story_calendar_events USING btree (visibility);


--
-- Name: story_clock_markers_calendar_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_clock_markers_calendar_date ON public.story_clock_markers USING btree (calendar_date);


--
-- Name: story_clock_markers_is_present; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_clock_markers_is_present ON public.story_clock_markers USING btree (is_present);


--
-- Name: story_clock_markers_sequence_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_clock_markers_sequence_order ON public.story_clock_markers USING btree (sequence_order);


--
-- Name: story_clock_markers_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_clock_markers_series_id ON public.story_clock_markers USING btree (series_id);


--
-- Name: story_texture_character_key_story_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_texture_character_key_story_number ON public.story_texture USING btree (character_key, story_number);


--
-- Name: storyteller_books_character_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_books_character_name ON public.storyteller_books USING btree (character_name);


--
-- Name: storyteller_books_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_books_deleted_at_idx ON public.storyteller_books USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: storyteller_books_series_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_books_series_id_idx ON public.storyteller_books USING btree (series_id);


--
-- Name: storyteller_books_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_books_show_id ON public.storyteller_books USING btree (show_id);


--
-- Name: storyteller_chapters_book_id_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_chapters_book_id_sort_order ON public.storyteller_chapters USING btree (book_id, sort_order);


--
-- Name: storyteller_chapters_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_chapters_deleted_at_idx ON public.storyteller_chapters USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: storyteller_chapters_primary_character_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_chapters_primary_character_id_idx ON public.storyteller_chapters USING btree (primary_character_id);


--
-- Name: storyteller_echoes_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_echoes_book_id ON public.storyteller_echoes USING btree (book_id);


--
-- Name: storyteller_echoes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_echoes_status ON public.storyteller_echoes USING btree (status);


--
-- Name: storyteller_echoes_target_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_echoes_target_chapter_id ON public.storyteller_echoes USING btree (target_chapter_id);


--
-- Name: storyteller_lines_chapter_id_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_lines_chapter_id_sort_order ON public.storyteller_lines USING btree (chapter_id, sort_order);


--
-- Name: storyteller_lines_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_lines_deleted_at_idx ON public.storyteller_lines USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: storyteller_lines_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_lines_status ON public.storyteller_lines USING btree (status);


--
-- Name: storyteller_memories_career_echo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_memories_career_echo_idx ON public.storyteller_memories USING btree (career_echo_confirmed);


--
-- Name: storyteller_memories_type_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storyteller_memories_type_category_idx ON public.storyteller_memories USING btree (type, category);


--
-- Name: thumbnail_compositions_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thumbnail_compositions_episode_id ON public.thumbnail_compositions USING btree (episode_id);


--
-- Name: thumbnail_compositions_episode_id_is_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thumbnail_compositions_episode_id_is_primary ON public.thumbnail_compositions USING btree (episode_id, is_primary);


--
-- Name: thumbnail_compositions_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX thumbnail_compositions_template_id ON public.thumbnail_compositions USING btree (template_id);


--
-- Name: timeline_placements_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX timeline_placements_episode_id ON public.timeline_placements USING btree (episode_id);


--
-- Name: timeline_placements_episode_id_placement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX timeline_placements_episode_id_placement_type ON public.timeline_placements USING btree (episode_id, placement_type);


--
-- Name: timeline_placements_episode_id_track_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX timeline_placements_episode_id_track_number ON public.timeline_placements USING btree (episode_id, track_number);


--
-- Name: timeline_placements_scene_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX timeline_placements_scene_id ON public.timeline_placements USING btree (scene_id);


--
-- Name: ui_overlay_types_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ui_overlay_types_show_id ON public.ui_overlay_types USING btree (show_id);


--
-- Name: ui_overlay_types_show_type_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ui_overlay_types_show_type_key_unique ON public.ui_overlay_types USING btree (show_id, type_key) WHERE (deleted_at IS NULL);


--
-- Name: unique_episode_wardrobe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_episode_wardrobe ON public.episode_wardrobe USING btree (episode_id, wardrobe_id);


--
-- Name: unique_library_s3_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_library_s3_key ON public.wardrobe_library_references USING btree (library_item_id, s3_key);


--
-- Name: universe_characters_canon_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX universe_characters_canon_tier_idx ON public.universe_characters USING btree (canon_tier);


--
-- Name: universe_characters_registry_character_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX universe_characters_registry_character_id_idx ON public.universe_characters USING btree (registry_character_id);


--
-- Name: universe_characters_unique_promotion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX universe_characters_unique_promotion ON public.universe_characters USING btree (universe_id, registry_character_id);


--
-- Name: universe_characters_universe_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX universe_characters_universe_id_idx ON public.universe_characters USING btree (universe_id);


--
-- Name: universes_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX universes_slug_unique ON public.universes USING btree (slug);


--
-- Name: upload_logs_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX upload_logs_episode_id ON public.upload_logs USING btree (episode_id);


--
-- Name: upload_logs_raw_footage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX upload_logs_raw_footage_id ON public.upload_logs USING btree (raw_footage_id);


--
-- Name: upload_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX upload_logs_user_id ON public.upload_logs USING btree (user_id);


--
-- Name: uq_phone_playthrough_user_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_phone_playthrough_user_episode ON public.phone_playthrough_state USING btree (user_id, episode_id) WHERE (deleted_at IS NULL);


--
-- Name: user_decisions_chosen_option_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decisions_chosen_option_gin ON public.user_decisions USING gin (chosen_option);


--
-- Name: user_decisions_context_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decisions_context_data_gin ON public.user_decisions USING gin (context_data);


--
-- Name: user_decisions_decision_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decisions_decision_category ON public.user_decisions USING btree (decision_category);


--
-- Name: user_decisions_decision_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decisions_decision_type ON public.user_decisions USING btree (decision_type);


--
-- Name: user_decisions_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decisions_episode_id ON public.user_decisions USING btree (episode_id);


--
-- Name: user_decisions_scene_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decisions_scene_id ON public.user_decisions USING btree (scene_id);


--
-- Name: user_decisions_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decisions_timestamp ON public.user_decisions USING btree ("timestamp");


--
-- Name: user_decisions_was_ai_suggestion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decisions_was_ai_suggestion ON public.user_decisions USING btree (was_ai_suggestion);


--
-- Name: wardrobe_library_color; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_library_color ON public.wardrobe_library USING btree (color);


--
-- Name: wardrobe_library_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_library_deleted_at ON public.wardrobe_library USING btree (deleted_at);


--
-- Name: wardrobe_library_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_library_item_type ON public.wardrobe_library USING btree (item_type);


--
-- Name: wardrobe_library_references_s3_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_library_references_s3_key ON public.wardrobe_library_references USING btree (s3_key);


--
-- Name: wardrobe_library_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_library_show_id ON public.wardrobe_library USING btree (show_id);


--
-- Name: wardrobe_library_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_library_type ON public.wardrobe_library USING btree (type);


--
-- Name: wardrobe_parent_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_parent_item_id_idx ON public.wardrobe USING btree (parent_item_id);


--
-- Name: wardrobe_usage_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_usage_history_created_at ON public.wardrobe_usage_history USING btree (created_at);


--
-- Name: wardrobe_usage_history_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_usage_history_episode_id ON public.wardrobe_usage_history USING btree (episode_id);


--
-- Name: wardrobe_usage_history_library_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_usage_history_library_item_id ON public.wardrobe_usage_history USING btree (library_item_id);


--
-- Name: wardrobe_usage_history_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_usage_history_show_id ON public.wardrobe_usage_history USING btree (show_id);


--
-- Name: wardrobe_usage_history_usage_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wardrobe_usage_history_usage_type ON public.wardrobe_usage_history USING btree (usage_type);


--
-- Name: wca_character_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wca_character_idx ON public.wardrobe_content_assignments USING btree (character_id);


--
-- Name: wca_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wca_content_idx ON public.wardrobe_content_assignments USING btree (content_type, content_id);


--
-- Name: wca_library_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wca_library_item_idx ON public.wardrobe_content_assignments USING btree (library_item_id);


--
-- Name: world_events_parent_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX world_events_parent_event_id ON public.world_events USING btree (parent_event_id) WHERE (parent_event_id IS NOT NULL);


--
-- Name: world_events_source_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX world_events_source_profile_id_idx ON public.world_events USING btree (source_profile_id);


--
-- Name: world_events_used_in_episode_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX world_events_used_in_episode_unique ON public.world_events USING btree (used_in_episode_id) WHERE (used_in_episode_id IS NOT NULL);


--
-- Name: writing_rhythm_session_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX writing_rhythm_session_date ON public.writing_rhythm USING btree (session_date);


--
-- Name: timeline_data update_timeline_data_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_timeline_data_updated_at BEFORE UPDATE ON public.timeline_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ai_edit_plans ai_edit_plans_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_edit_plans
    ADD CONSTRAINT ai_edit_plans_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_interactions ai_interactions_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interactions
    ADD CONSTRAINT ai_interactions_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.character_profiles(id);


--
-- Name: ai_interactions ai_interactions_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interactions
    ADD CONSTRAINT ai_interactions_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id);


--
-- Name: ai_revisions ai_revisions_original_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_revisions
    ADD CONSTRAINT ai_revisions_original_plan_id_fkey FOREIGN KEY (original_plan_id) REFERENCES public.ai_edit_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: asset_roles asset_roles_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_roles
    ADD CONSTRAINT asset_roles_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id);


--
-- Name: asset_usage_log asset_usage_log_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usage_log
    ADD CONSTRAINT asset_usage_log_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: asset_usage_log asset_usage_log_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usage_log
    ADD CONSTRAINT asset_usage_log_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: asset_usage_log asset_usage_log_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usage_log
    ADD CONSTRAINT asset_usage_log_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: assets assets_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: assets assets_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audio_clips audio_clips_beat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_clips
    ADD CONSTRAINT audio_clips_beat_id_fkey FOREIGN KEY (beat_id) REFERENCES public.beats(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audio_clips audio_clips_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_clips
    ADD CONSTRAINT audio_clips_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: beats beats_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beats
    ADD CONSTRAINT beats_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: book_series book_series_protagonist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_series
    ADD CONSTRAINT book_series_protagonist_id_fkey FOREIGN KEY (protagonist_id) REFERENCES public.registry_characters(id) ON DELETE SET NULL;


--
-- Name: book_series book_series_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_series
    ADD CONSTRAINT book_series_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- Name: book_series book_series_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_series
    ADD CONSTRAINT book_series_universe_id_fkey FOREIGN KEY (universe_id) REFERENCES public.universes(id) ON DELETE CASCADE;


--
-- Name: calendar_event_attendees calendar_event_attendees_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.registry_characters(id) ON DELETE SET NULL;


--
-- Name: calendar_event_attendees calendar_event_attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.story_calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_event_ripples calendar_event_ripples_affected_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_ripples
    ADD CONSTRAINT calendar_event_ripples_affected_character_id_fkey FOREIGN KEY (affected_character_id) REFERENCES public.registry_characters(id) ON DELETE SET NULL;


--
-- Name: calendar_event_ripples calendar_event_ripples_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_ripples
    ADD CONSTRAINT calendar_event_ripples_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.story_calendar_events(id) ON DELETE CASCADE;


--
-- Name: character_arcs character_arcs_registry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_arcs
    ADD CONSTRAINT character_arcs_registry_id_fkey FOREIGN KEY (registry_id) REFERENCES public.registry_characters(id) ON DELETE SET NULL;


--
-- Name: character_clips character_clips_beat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_clips
    ADD CONSTRAINT character_clips_beat_id_fkey FOREIGN KEY (beat_id) REFERENCES public.beats(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: character_clips character_clips_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_clips
    ADD CONSTRAINT character_clips_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: character_crossings character_crossings_calendar_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_crossings
    ADD CONSTRAINT character_crossings_calendar_event_id_fkey FOREIGN KEY (calendar_event_id) REFERENCES public.story_calendar_events(id) ON DELETE SET NULL;


--
-- Name: character_crossings character_crossings_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_crossings
    ADD CONSTRAINT character_crossings_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.registry_characters(id) ON DELETE CASCADE;


--
-- Name: character_crossings character_crossings_crossing_date_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_crossings
    ADD CONSTRAINT character_crossings_crossing_date_fkey FOREIGN KEY (crossing_date) REFERENCES public.story_clock_markers(id) ON DELETE SET NULL;


--
-- Name: character_entanglements character_entanglements_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_entanglements
    ADD CONSTRAINT character_entanglements_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.registry_characters(id) ON DELETE CASCADE;


--
-- Name: character_entanglements character_entanglements_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_entanglements
    ADD CONSTRAINT character_entanglements_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.social_profiles(id) ON DELETE CASCADE;


--
-- Name: character_follow_profiles character_follow_profiles_registry_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_follow_profiles
    ADD CONSTRAINT character_follow_profiles_registry_character_id_fkey FOREIGN KEY (registry_character_id) REFERENCES public.registry_characters(id) ON DELETE SET NULL;


--
-- Name: character_growth_log character_growth_log_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_growth_log
    ADD CONSTRAINT character_growth_log_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.registry_characters(id) ON DELETE CASCADE;


--
-- Name: character_growth_log character_growth_log_scene_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_growth_log
    ADD CONSTRAINT character_growth_log_scene_proposal_id_fkey FOREIGN KEY (scene_proposal_id) REFERENCES public.scene_proposals(id) ON DELETE SET NULL;


--
-- Name: character_profiles character_profiles_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_profiles
    ADD CONSTRAINT character_profiles_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: character_registries character_registries_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_registries
    ADD CONSTRAINT character_registries_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: characters characters_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: composition_assets composition_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_assets
    ADD CONSTRAINT composition_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: composition_assets composition_assets_composition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_assets
    ADD CONSTRAINT composition_assets_composition_id_fkey FOREIGN KEY (composition_id) REFERENCES public.thumbnail_compositions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: composition_outputs composition_outputs_composition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_outputs
    ADD CONSTRAINT composition_outputs_composition_id_fkey FOREIGN KEY (composition_id) REFERENCES public.thumbnail_compositions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: continuity_beat_characters continuity_beat_characters_beat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_beat_characters
    ADD CONSTRAINT continuity_beat_characters_beat_id_fkey FOREIGN KEY (beat_id) REFERENCES public.continuity_beats(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: continuity_beat_characters continuity_beat_characters_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_beat_characters
    ADD CONSTRAINT continuity_beat_characters_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.continuity_characters(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: continuity_beats continuity_beats_timeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_beats
    ADD CONSTRAINT continuity_beats_timeline_id_fkey FOREIGN KEY (timeline_id) REFERENCES public.continuity_timelines(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: continuity_characters continuity_characters_timeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_characters
    ADD CONSTRAINT continuity_characters_timeline_id_fkey FOREIGN KEY (timeline_id) REFERENCES public.continuity_timelines(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: continuity_timelines continuity_timelines_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuity_timelines
    ADD CONSTRAINT continuity_timelines_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: decision_log decision_log_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_log
    ADD CONSTRAINT decision_log_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE SET NULL;


--
-- Name: decision_log decision_log_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_log
    ADD CONSTRAINT decision_log_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- Name: decision_logs decision_logs_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_logs
    ADD CONSTRAINT decision_logs_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: decision_logs decision_logs_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decision_logs
    ADD CONSTRAINT decision_logs_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE SET NULL;


--
-- Name: edit_maps edit_maps_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edit_maps
    ADD CONSTRAINT edit_maps_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: edit_maps edit_maps_raw_footage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edit_maps
    ADD CONSTRAINT edit_maps_raw_footage_id_fkey FOREIGN KEY (raw_footage_id) REFERENCES public.raw_footage(id) ON DELETE CASCADE;


--
-- Name: editing_decisions editing_decisions_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.editing_decisions
    ADD CONSTRAINT editing_decisions_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: editing_decisions editing_decisions_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.editing_decisions
    ADD CONSTRAINT editing_decisions_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: entanglement_events entanglement_events_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entanglement_events
    ADD CONSTRAINT entanglement_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.social_profiles(id) ON DELETE CASCADE;


--
-- Name: entanglement_unfollows entanglement_unfollows_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entanglement_unfollows
    ADD CONSTRAINT entanglement_unfollows_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.registry_characters(id) ON DELETE CASCADE;


--
-- Name: entanglement_unfollows entanglement_unfollows_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entanglement_unfollows
    ADD CONSTRAINT entanglement_unfollows_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.social_profiles(id) ON DELETE CASCADE;


--
-- Name: episode_briefs episode_briefs_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_briefs
    ADD CONSTRAINT episode_briefs_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: episode_briefs episode_briefs_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_briefs
    ADD CONSTRAINT episode_briefs_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- Name: episode_phases episode_phases_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_phases
    ADD CONSTRAINT episode_phases_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: episode_phases episode_phases_layout_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_phases
    ADD CONSTRAINT episode_phases_layout_template_id_fkey FOREIGN KEY (layout_template_id) REFERENCES public.layout_templates(id);


--
-- Name: episode_scenes episode_scenes_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_scenes
    ADD CONSTRAINT episode_scenes_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: episode_scenes episode_scenes_scene_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_scenes
    ADD CONSTRAINT episode_scenes_scene_library_id_fkey FOREIGN KEY (scene_library_id) REFERENCES public.scene_library(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: episode_scenes episode_scenes_scene_library_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_scenes
    ADD CONSTRAINT episode_scenes_scene_library_id_fkey1 FOREIGN KEY (scene_library_id) REFERENCES public.scene_library(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: episode_scripts episode_scripts_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_scripts
    ADD CONSTRAINT episode_scripts_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: episode_todo_lists episode_todo_lists_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_todo_lists
    ADD CONSTRAINT episode_todo_lists_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: episode_todo_lists episode_todo_lists_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_todo_lists
    ADD CONSTRAINT episode_todo_lists_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- Name: episode_wardrobe_defaults episode_wardrobe_defaults_default_outfit_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_wardrobe_defaults
    ADD CONSTRAINT episode_wardrobe_defaults_default_outfit_asset_id_fkey FOREIGN KEY (default_outfit_asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: episode_wardrobe_defaults episode_wardrobe_defaults_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_wardrobe_defaults
    ADD CONSTRAINT episode_wardrobe_defaults_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: episode_wardrobe episode_wardrobe_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: episode_wardrobe episode_wardrobe_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: episode_wardrobe episode_wardrobe_wardrobe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode_wardrobe
    ADD CONSTRAINT episode_wardrobe_wardrobe_id_fkey FOREIGN KEY (wardrobe_id) REFERENCES public.wardrobe(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_posts feed_posts_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id);


--
-- Name: feed_profile_relationships feed_profile_relationships_influencer_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_profile_relationships
    ADD CONSTRAINT feed_profile_relationships_influencer_a_id_fkey FOREIGN KEY (influencer_a_id) REFERENCES public.social_profiles(id) ON DELETE CASCADE;


--
-- Name: feed_profile_relationships feed_profile_relationships_influencer_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_profile_relationships
    ADD CONSTRAINT feed_profile_relationships_influencer_b_id_fkey FOREIGN KEY (influencer_b_id) REFERENCES public.social_profiles(id) ON DELETE CASCADE;


--
-- Name: feed_profile_relationships feed_profile_relationships_story_position_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_profile_relationships
    ADD CONSTRAINT feed_profile_relationships_story_position_fkey FOREIGN KEY (story_position) REFERENCES public.story_clock_markers(id) ON DELETE SET NULL;


--
-- Name: hair_library hair_library_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hair_library
    ADD CONSTRAINT hair_library_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: interactive_elements interactive_elements_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactive_elements
    ADD CONSTRAINT interactive_elements_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: lala_cash_grab_quests lala_cash_grab_quests_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_cash_grab_quests
    ADD CONSTRAINT lala_cash_grab_quests_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id);


--
-- Name: lala_emergence_scenes lala_emergence_scenes_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_emergence_scenes
    ADD CONSTRAINT lala_emergence_scenes_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.storyteller_books(id) ON DELETE CASCADE;


--
-- Name: lala_emergence_scenes lala_emergence_scenes_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_emergence_scenes
    ADD CONSTRAINT lala_emergence_scenes_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.storyteller_chapters(id) ON DELETE CASCADE;


--
-- Name: lala_emergence_scenes lala_emergence_scenes_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_emergence_scenes
    ADD CONSTRAINT lala_emergence_scenes_line_id_fkey FOREIGN KEY (line_id) REFERENCES public.storyteller_lines(id) ON DELETE CASCADE;


--
-- Name: lala_episode_formulas lala_episode_formulas_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_episode_formulas
    ADD CONSTRAINT lala_episode_formulas_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id);


--
-- Name: lala_episode_timeline lala_episode_timeline_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_episode_timeline
    ADD CONSTRAINT lala_episode_timeline_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id);


--
-- Name: lala_friend_archetypes lala_friend_archetypes_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_friend_archetypes
    ADD CONSTRAINT lala_friend_archetypes_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id);


--
-- Name: lala_micro_goals lala_micro_goals_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lala_micro_goals
    ADD CONSTRAINT lala_micro_goals_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id);


--
-- Name: layer_assets layer_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layer_assets
    ADD CONSTRAINT layer_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: layer_assets layer_assets_layer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layer_assets
    ADD CONSTRAINT layer_assets_layer_id_fkey FOREIGN KEY (layer_id) REFERENCES public.layers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: layers layers_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layers
    ADD CONSTRAINT layers_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: layout_templates layout_templates_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_templates
    ADD CONSTRAINT layout_templates_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id);


--
-- Name: makeup_library makeup_library_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.makeup_library
    ADD CONSTRAINT makeup_library_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: markers markers_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markers
    ADD CONSTRAINT markers_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: markers markers_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markers
    ADD CONSTRAINT markers_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: metadata_storage metadata_storage_episodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_storage
    ADD CONSTRAINT "metadata_storage_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: outfit_set_items outfit_set_items_outfit_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_set_items
    ADD CONSTRAINT outfit_set_items_outfit_set_id_fkey FOREIGN KEY (outfit_set_id) REFERENCES public.wardrobe_library(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: outfit_set_items outfit_set_items_wardrobe_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_set_items
    ADD CONSTRAINT outfit_set_items_wardrobe_item_id_fkey FOREIGN KEY (wardrobe_item_id) REFERENCES public.wardrobe_library(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: phone_missions phone_missions_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_missions
    ADD CONSTRAINT phone_missions_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE SET NULL;


--
-- Name: phone_playthrough_state phone_playthrough_state_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_playthrough_state
    ADD CONSTRAINT phone_playthrough_state_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: processing_queue processing_queue_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queue
    ADD CONSTRAINT processing_queue_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: processing_queues processing_queues_episodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queues
    ADD CONSTRAINT "processing_queues_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raw_footage raw_footage_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_footage
    ADD CONSTRAINT raw_footage_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: raw_footage raw_footage_intended_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_footage
    ADD CONSTRAINT raw_footage_intended_scene_id_fkey FOREIGN KEY (intended_scene_id) REFERENCES public.scenes(id);


--
-- Name: registry_characters registry_characters_feed_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registry_characters
    ADD CONSTRAINT registry_characters_feed_profile_id_fkey FOREIGN KEY (feed_profile_id) REFERENCES public.social_profiles(id) ON DELETE SET NULL;


--
-- Name: registry_characters registry_characters_registry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registry_characters
    ADD CONSTRAINT registry_characters_registry_id_fkey FOREIGN KEY (registry_id) REFERENCES public.character_registries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: relationship_events relationship_events_relationship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relationship_events
    ADD CONSTRAINT relationship_events_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES public.character_relationships(id) ON DELETE CASCADE;


--
-- Name: scene_angles scene_angles_scene_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_angles
    ADD CONSTRAINT scene_angles_scene_set_id_fkey FOREIGN KEY (scene_set_id) REFERENCES public.scene_sets(id) ON DELETE CASCADE;


--
-- Name: scene_assets scene_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: scene_assets scene_assets_scene_angle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_scene_angle_id_fkey FOREIGN KEY (scene_angle_id) REFERENCES public.scene_angles(id) ON DELETE SET NULL;


--
-- Name: scene_assets scene_assets_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE;


--
-- Name: scene_assets scene_assets_scene_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_scene_id_fkey1 FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE;


--
-- Name: scene_assets scene_assets_scene_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_assets
    ADD CONSTRAINT scene_assets_scene_set_id_fkey FOREIGN KEY (scene_set_id) REFERENCES public.scene_sets(id) ON DELETE CASCADE;


--
-- Name: scene_continuations scene_continuations_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_continuations
    ADD CONSTRAINT scene_continuations_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.intimate_scenes(id) ON DELETE CASCADE;


--
-- Name: scene_footage_links scene_footage_links_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_footage_links
    ADD CONSTRAINT scene_footage_links_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scene_footage_links scene_footage_links_script_metadata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_footage_links
    ADD CONSTRAINT scene_footage_links_script_metadata_id_fkey FOREIGN KEY (script_metadata_id) REFERENCES public.script_metadata(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scene_layer_configuration scene_layer_configuration_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_layer_configuration
    ADD CONSTRAINT scene_layer_configuration_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scene_library scene_library_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_library
    ADD CONSTRAINT scene_library_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scene_object_variants scene_object_variants_active_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_object_variants
    ADD CONSTRAINT scene_object_variants_active_variant_id_fkey FOREIGN KEY (active_variant_id) REFERENCES public.scene_assets(id) ON DELETE SET NULL;


--
-- Name: scene_object_variants scene_object_variants_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_object_variants
    ADD CONSTRAINT scene_object_variants_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE;


--
-- Name: scene_plans scene_plans_episode_brief_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_plans
    ADD CONSTRAINT scene_plans_episode_brief_id_fkey FOREIGN KEY (episode_brief_id) REFERENCES public.episode_briefs(id) ON DELETE SET NULL;


--
-- Name: scene_plans scene_plans_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_plans
    ADD CONSTRAINT scene_plans_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: scene_plans scene_plans_scene_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_plans
    ADD CONSTRAINT scene_plans_scene_set_id_fkey FOREIGN KEY (scene_set_id) REFERENCES public.scene_sets(id) ON DELETE SET NULL;


--
-- Name: scene_proposals scene_proposals_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_proposals
    ADD CONSTRAINT scene_proposals_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.storyteller_books(id) ON DELETE SET NULL;


--
-- Name: scene_proposals scene_proposals_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_proposals
    ADD CONSTRAINT scene_proposals_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.storyteller_chapters(id) ON DELETE SET NULL;


--
-- Name: scene_proposals scene_proposals_registry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_proposals
    ADD CONSTRAINT scene_proposals_registry_id_fkey FOREIGN KEY (registry_id) REFERENCES public.character_registries(id) ON DELETE SET NULL;


--
-- Name: scene_set_episodes scene_set_episodes_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_set_episodes
    ADD CONSTRAINT scene_set_episodes_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scene_set_episodes scene_set_episodes_scene_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_set_episodes
    ADD CONSTRAINT scene_set_episodes_scene_set_id_fkey FOREIGN KEY (scene_set_id) REFERENCES public.scene_sets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scene_sets scene_sets_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_sets
    ADD CONSTRAINT scene_sets_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- Name: scene_sets scene_sets_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_sets
    ADD CONSTRAINT scene_sets_universe_id_fkey FOREIGN KEY (universe_id) REFERENCES public.universes(id) ON DELETE SET NULL;


--
-- Name: scene_sets scene_sets_world_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scene_sets
    ADD CONSTRAINT scene_sets_world_location_id_fkey FOREIGN KEY (world_location_id) REFERENCES public.world_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: scenes scenes_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT scenes_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scenes scenes_scene_angle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT scenes_scene_angle_id_fkey FOREIGN KEY (scene_angle_id) REFERENCES public.scene_angles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: scenes scenes_scene_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT scenes_scene_set_id_fkey FOREIGN KEY (scene_set_id) REFERENCES public.scene_sets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: scenes scenes_thumbnail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT scenes_thumbnail_id_fkey FOREIGN KEY (thumbnail_id) REFERENCES public.thumbnails(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: script_metadata script_metadata_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_metadata
    ADD CONSTRAINT script_metadata_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.episode_scripts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: show_assets show_assets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.show_assets
    ADD CONSTRAINT show_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: show_assets show_assets_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.show_assets
    ADD CONSTRAINT show_assets_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: shows shows_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_universe_id_fkey FOREIGN KEY (universe_id) REFERENCES public.universes(id) ON DELETE SET NULL;


--
-- Name: social_media_imports social_media_imports_assigned_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_media_imports
    ADD CONSTRAINT social_media_imports_assigned_story_id_fkey FOREIGN KEY (assigned_story_id) REFERENCES public.storyteller_stories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: social_profile_followers social_profile_followers_social_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_followers
    ADD CONSTRAINT social_profile_followers_social_profile_id_fkey FOREIGN KEY (social_profile_id) REFERENCES public.social_profiles(id) ON DELETE CASCADE;


--
-- Name: social_profile_relationships social_profile_relationships_source_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_relationships
    ADD CONSTRAINT social_profile_relationships_source_profile_id_fkey FOREIGN KEY (source_profile_id) REFERENCES public.social_profiles(id) ON DELETE CASCADE;


--
-- Name: social_profile_relationships social_profile_relationships_target_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profile_relationships
    ADD CONSTRAINT social_profile_relationships_target_profile_id_fkey FOREIGN KEY (target_profile_id) REFERENCES public.social_profiles(id) ON DELETE CASCADE;


--
-- Name: social_profiles social_profiles_home_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profiles
    ADD CONSTRAINT social_profiles_home_location_id_fkey FOREIGN KEY (home_location_id) REFERENCES public.world_locations(id) ON DELETE SET NULL;


--
-- Name: social_profiles social_profiles_mirror_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_profiles
    ADD CONSTRAINT social_profiles_mirror_profile_id_fkey FOREIGN KEY (mirror_profile_id) REFERENCES public.social_profiles(id);


--
-- Name: story_calendar_events story_calendar_events_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_calendar_events
    ADD CONSTRAINT story_calendar_events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.world_locations(id) ON DELETE SET NULL;


--
-- Name: story_calendar_events story_calendar_events_source_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_calendar_events
    ADD CONSTRAINT story_calendar_events_source_line_id_fkey FOREIGN KEY (source_line_id) REFERENCES public.storyteller_lines(id) ON DELETE SET NULL;


--
-- Name: story_calendar_events story_calendar_events_story_position_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_calendar_events
    ADD CONSTRAINT story_calendar_events_story_position_fkey FOREIGN KEY (story_position) REFERENCES public.story_clock_markers(id) ON DELETE SET NULL;


--
-- Name: storyteller_books storyteller_books_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_books
    ADD CONSTRAINT storyteller_books_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.book_series(id) ON DELETE SET NULL;


--
-- Name: storyteller_books storyteller_books_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_books
    ADD CONSTRAINT storyteller_books_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON DELETE SET NULL;


--
-- Name: storyteller_chapters storyteller_chapters_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_chapters
    ADD CONSTRAINT storyteller_chapters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.storyteller_books(id) ON DELETE CASCADE;


--
-- Name: storyteller_chapters storyteller_chapters_primary_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_chapters
    ADD CONSTRAINT storyteller_chapters_primary_character_id_fkey FOREIGN KEY (primary_character_id) REFERENCES public.registry_characters(id) ON DELETE SET NULL;


--
-- Name: storyteller_echoes storyteller_echoes_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_echoes
    ADD CONSTRAINT storyteller_echoes_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.storyteller_books(id) ON DELETE CASCADE;


--
-- Name: storyteller_echoes storyteller_echoes_source_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_echoes
    ADD CONSTRAINT storyteller_echoes_source_chapter_id_fkey FOREIGN KEY (source_chapter_id) REFERENCES public.storyteller_chapters(id) ON DELETE SET NULL;


--
-- Name: storyteller_echoes storyteller_echoes_target_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_echoes
    ADD CONSTRAINT storyteller_echoes_target_chapter_id_fkey FOREIGN KEY (target_chapter_id) REFERENCES public.storyteller_chapters(id) ON DELETE SET NULL;


--
-- Name: storyteller_lines storyteller_lines_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_lines
    ADD CONSTRAINT storyteller_lines_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.storyteller_chapters(id) ON DELETE CASCADE;


--
-- Name: storyteller_memories storyteller_memories_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_memories
    ADD CONSTRAINT storyteller_memories_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.registry_characters(id) ON DELETE SET NULL;


--
-- Name: storyteller_memories storyteller_memories_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyteller_memories
    ADD CONSTRAINT storyteller_memories_line_id_fkey FOREIGN KEY (line_id) REFERENCES public.storyteller_lines(id) ON DELETE CASCADE;


--
-- Name: thumbnail_compositions thumbnail_compositions_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnail_compositions
    ADD CONSTRAINT thumbnail_compositions_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: thumbnail_compositions thumbnail_compositions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnail_compositions
    ADD CONSTRAINT thumbnail_compositions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.episode_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: thumbnail_templates thumbnail_templates_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnail_templates
    ADD CONSTRAINT thumbnail_templates_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: thumbnails thumbnails_episodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnails
    ADD CONSTRAINT "thumbnails_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: thumbnails thumbnails_episodeid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thumbnails
    ADD CONSTRAINT thumbnails_episodeid_fkey FOREIGN KEY ("episodeId") REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: timeline_data timeline_data_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_data
    ADD CONSTRAINT timeline_data_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: timeline_placements timeline_placements_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: timeline_placements timeline_placements_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE;


--
-- Name: timeline_placements timeline_placements_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.episode_scenes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: timeline_placements timeline_placements_wardrobe_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_placements
    ADD CONSTRAINT timeline_placements_wardrobe_item_id_fkey FOREIGN KEY (wardrobe_item_id) REFERENCES public.wardrobe(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ui_overlay_types ui_overlay_types_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_overlay_types
    ADD CONSTRAINT ui_overlay_types_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: universe_characters universe_characters_registry_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universe_characters
    ADD CONSTRAINT universe_characters_registry_character_id_fkey FOREIGN KEY (registry_character_id) REFERENCES public.registry_characters(id) ON DELETE SET NULL;


--
-- Name: universe_characters universe_characters_universe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universe_characters
    ADD CONSTRAINT universe_characters_universe_id_fkey FOREIGN KEY (universe_id) REFERENCES public.universes(id) ON DELETE CASCADE;


--
-- Name: upload_logs upload_logs_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_logs
    ADD CONSTRAINT upload_logs_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: upload_logs upload_logs_raw_footage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_logs
    ADD CONSTRAINT upload_logs_raw_footage_id_fkey FOREIGN KEY (raw_footage_id) REFERENCES public.raw_footage(id) ON DELETE CASCADE;


--
-- Name: user_decisions user_decisions_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_decisions
    ADD CONSTRAINT user_decisions_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: user_decisions user_decisions_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_decisions
    ADD CONSTRAINT user_decisions_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE SET NULL;


--
-- Name: video_processing_jobs video_processing_jobs_edit_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_processing_jobs
    ADD CONSTRAINT video_processing_jobs_edit_plan_id_fkey FOREIGN KEY (edit_plan_id) REFERENCES public.ai_edit_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: video_processing_jobs video_processing_jobs_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_processing_jobs
    ADD CONSTRAINT video_processing_jobs_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wardrobe_library_references wardrobe_library_references_library_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_library_references
    ADD CONSTRAINT wardrobe_library_references_library_item_id_fkey FOREIGN KEY (library_item_id) REFERENCES public.wardrobe_library(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wardrobe_library wardrobe_library_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_library
    ADD CONSTRAINT wardrobe_library_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wardrobe wardrobe_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe
    ADD CONSTRAINT wardrobe_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.wardrobe(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wardrobe_usage_history wardrobe_usage_history_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wardrobe_usage_history wardrobe_usage_history_library_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_library_item_id_fkey FOREIGN KEY (library_item_id) REFERENCES public.wardrobe_library(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wardrobe_usage_history wardrobe_usage_history_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wardrobe_usage_history wardrobe_usage_history_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wardrobe_usage_history
    ADD CONSTRAINT wardrobe_usage_history_show_id_fkey FOREIGN KEY (show_id) REFERENCES public.shows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: world_characters world_characters_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_characters
    ADD CONSTRAINT world_characters_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.world_character_batches(id) ON DELETE SET NULL;


--
-- Name: world_events world_events_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_events
    ADD CONSTRAINT world_events_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);


--
-- Name: world_events world_events_scene_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_events
    ADD CONSTRAINT world_events_scene_set_id_fkey FOREIGN KEY (scene_set_id) REFERENCES public.scene_sets(id) ON DELETE SET NULL;


--
-- Name: world_events world_events_source_calendar_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_events
    ADD CONSTRAINT world_events_source_calendar_event_id_fkey FOREIGN KEY (source_calendar_event_id) REFERENCES public.story_calendar_events(id) ON DELETE SET NULL;


--
-- Name: world_events world_events_source_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_events
    ADD CONSTRAINT world_events_source_profile_id_fkey FOREIGN KEY (source_profile_id) REFERENCES public.social_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: world_events world_events_venue_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_events
    ADD CONSTRAINT world_events_venue_location_id_fkey FOREIGN KEY (venue_location_id) REFERENCES public.world_locations(id) ON DELETE SET NULL;


--
-- Name: world_locations world_locations_parent_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.world_locations
    ADD CONSTRAINT world_locations_parent_location_id_fkey FOREIGN KEY (parent_location_id) REFERENCES public.world_locations(id);


--
-- PostgreSQL database dump complete
--

\unrestrict JS6PAFSeOmkyV4jEef1bHb3stnquVnJopFTdA50wBxsTrSGQSa6d4UJf7aeFG3y

