-- Read-only pre-flight: exact-value fingerprints of everything A and B guard on.
\pset pager off
SET default_transaction_read_only = on;
SET search_path = pg_catalog, pg_temp;  -- built-ins only: nothing planted in public or a look-alike schema can resolve; tables are named public.x
SELECT md5(story_purpose) AS slot_purpose_md5, md5(story_purposes::text) AS slot_purposes_md5, intention_source FROM public.season_slots WHERE id = '3e9a5200-161e-4369-b596-a915a268cd43';
SELECT md5(narrative_purpose) AS brief_md5, length(narrative_purpose) AS brief_len, status FROM public.episode_briefs WHERE id = '661234d3-bf88-4c8f-b253-8352261185da';
SELECT md5(season_context::text) AS snapshot_md5 FROM public.episodes WHERE id = '8b9301a6-2d99-45a7-8488-4fe40504dd55';
SELECT to_regclass('public.data_correction_log') AS correction_log_table;
-- Ownership and privileges of the log (expect owner postgres; others only prime_readonly=r).
SELECT pg_get_userbyid(c.relowner) AS log_owner, c.relacl::text AS log_acl FROM pg_class c WHERE c.oid = to_regclass('public.data_correction_log');
SELECT has_table_privilege(r.oid, 'public.data_correction_log', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS app_has_any_privilege
  FROM pg_roles r WHERE r.rolname = 'episode_app_dev' AND to_regclass('public.data_correction_log') IS NOT NULL;
-- No schema that shadows public for the migration login ("$user" comes first in its search_path).
SELECT nspname AS shadowing_schema, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname IN ('postgres', 'episode_app_dev');
-- The log's trigger function resolves names in pg_catalog only (expect {"search_path=pg_catalog, pg_temp"}).
SELECT proconfig::text AS guard_function_config FROM pg_catalog.pg_proc WHERE oid = to_regprocedure('public.data_correction_log_guard()');
-- Functions and operators outside the system schemas not owned by postgres or rdsadmin (expect no row; a row is code
-- another role could plant for a postgres session to run. The pinned search_path already ignores it; report it anyway).
SELECT 'function' AS kind, n.nspname, p.proname AS name, pg_get_userbyid(p.proowner) AS owner FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_%' AND pg_get_userbyid(p.proowner) NOT IN ('postgres', 'rdsadmin')
UNION ALL
SELECT 'operator', n.nspname, o.oprname, pg_get_userbyid(o.oprowner) FROM pg_catalog.pg_operator o JOIN pg_catalog.pg_namespace n ON n.oid = o.oprnamespace
 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_%' AND pg_get_userbyid(o.oprowner) NOT IN ('postgres', 'rdsadmin');
