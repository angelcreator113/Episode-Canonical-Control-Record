-- Step 6, read-only (as prime_readonly), after the Deploy run.
\set ON_ERROR_STOP on
\pset pager off
\pset footer off
\ir roles.sql
SET default_transaction_read_only = on;
SET search_path = public;
\echo '== Q1. Tables (expect all present, owned by postgres)'
SELECT t AS name, to_regclass('public.' || t) IS NOT NULL AS present,
       (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass('public.' || t)) AS owner
  FROM unnest(ARRAY['brain_documents', 'chapter_versions', 'continuity_timelines', 'continuity_characters', 'continuity_beats',
                    'continuity_beat_characters', 'ecosystem_previews', 'video_compositions', 'generation_jobs',
                    'franchise_knowledge', 'data_correction_log']) t;
\echo '== Q2. The application role on the tables it uses (expect t t t t), on its sequence (expect t), on the correction log (expect f), CREATE on public (expect f)'
SELECT has_table_privilege(:'app_role', 'public.brain_documents', 'SELECT') AS bd_select,
       has_table_privilege(:'app_role', 'public.brain_documents', 'INSERT') AS bd_insert,
       has_table_privilege(:'app_role', 'public.chapter_versions', 'INSERT') AS cv_insert,
       has_table_privilege(:'app_role', 'public.chapter_versions', 'SELECT') AS cv_select,
       has_sequence_privilege(:'app_role', 'public.brain_documents_id_seq', 'USAGE') AS bd_seq,
       has_table_privilege(:'app_role', 'public.data_correction_log', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS dcl_any,
       has_schema_privilege(:'app_role', 'public', 'CREATE') AS create_in_public;
\echo '== Q3. The trust check now (expect no row in T1-T3)'
\ir trust-preview.sql
