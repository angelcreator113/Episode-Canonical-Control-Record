-- Step 1, read-only (as prime_readonly), immediately before step 2. Changes nothing.
\set ON_ERROR_STOP on
\pset pager off
\pset footer off
\ir roles.sql
SET default_transaction_read_only = on;
SET search_path = public;
\echo '== P1. brain_documents: present, owner, exact rows (before step 2 expect: t | episode_app_dev | 0; after: f)'
SELECT to_regclass('public.brain_documents') IS NOT NULL AS present,
       (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass('public.brain_documents')) AS owner,
       CASE WHEN to_regclass('public.brain_documents') IS NOT NULL
            THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.brain_documents', false, true, '')))[1]::text::bigint
       END AS rows;
\echo '== P2. Anything that depends on it besides its own key, defaults, indexes, sequence and row type (expect no row)'
\ir brain-documents-dependents.sql
;
\echo '== P3. CREATE on public (expect episode_app_dev t before step 3, f after; prime_readonly f)'
SELECT r.rolname, has_schema_privilege(r.oid, 'public', 'CREATE') AS create_in_public
  FROM pg_roles r WHERE r.rolname IN (:'app_role', :'ro_role') ORDER BY 1;
\echo '== P4. What the Deploy trust check will find (before steps 2-3: episode_app_dev CREATE and brain_documents objects; after: no row in T1-T3)'
\ir trust-preview.sql
