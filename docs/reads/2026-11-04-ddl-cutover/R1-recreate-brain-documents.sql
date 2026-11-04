-- Recovery R1, as the MIGRATION user: recreate brain_documents (empty), owned by the migration
-- role, with its migration's definition (20261008100000, the same as 20261104200000's). The default
-- privileges give the application role SELECT, INSERT, UPDATE, DELETE and the sequence, and
-- prime_readonly SELECT. Changes nothing if the table exists. Used when step 2 ran but
-- 20261104200000 has not (failure points F1-F3).
\set ON_ERROR_STOP on
\pset pager off
\ir roles.sql
BEGIN;
SET LOCAL search_path = pg_catalog, pg_temp;
SELECT session_user = :'mig_role' AS is_mig \gset
\if :is_mig \else
  \echo 'R1 STOPPED: not run as the migration user; nothing changed'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
CREATE TABLE IF NOT EXISTS public.brain_documents (
  id SERIAL PRIMARY KEY, source_name VARCHAR(300) NOT NULL, document_text TEXT NOT NULL,
  entries_created INTEGER DEFAULT 0, ingested_by VARCHAR(100) DEFAULT 'manual',
  ingested_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ);
SELECT has_table_privilege(:'app_role', 'public.brain_documents', 'SELECT,INSERT,UPDATE,DELETE') AND
       has_sequence_privilege(:'app_role', 'public.brain_documents_id_seq', 'USAGE') AS app_ok \gset
\if :app_ok \else
  \echo 'R1 STOPPED: the application role would not have its privileges; rolled back'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
COMMIT;
\echo 'R1 DONE: brain_documents exists, owned by the migration role; the application can use it'
