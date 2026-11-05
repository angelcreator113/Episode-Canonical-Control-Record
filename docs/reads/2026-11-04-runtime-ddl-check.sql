-- Runtime-DDL inventory: read-only production check (2026-11-04).
-- Catalog reads only (no table data), so prime_readonly can run it.
\set ON_ERROR_STOP off
\pset pager off
\pset footer off
SET default_transaction_read_only = on;

\echo '== D1. The tables the runtime DDL creates or checks: present?, owner, estimated rows, size'
WITH t(name) AS (VALUES ('generation_jobs'), ('continuity_timelines'), ('continuity_characters'), ('continuity_beats'),
  ('continuity_beat_characters'), ('franchise_knowledge'), ('chapter_versions'), ('ecosystem_previews'), ('video_compositions'))
SELECT t.name, c.oid IS NOT NULL AS present, pg_get_userbyid(c.relowner) AS owner,
       s.n_live_tup AS est_rows, s.last_autoanalyze::date AS analyzed, pg_size_pretty(pg_total_relation_size(c.oid)) AS size
  FROM t LEFT JOIN pg_class c ON c.relname = t.name AND c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
 ORDER BY 1;

\echo '== D2. Every relation in public NOT owned by postgres (the app-owned table, its indexes and sequences)'
SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner, s.n_live_tup AS est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size, c.relacl::text AS acl
  FROM pg_class c LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
 WHERE c.relnamespace = 'public'::regnamespace AND pg_get_userbyid(c.relowner) <> 'postgres'
 ORDER BY c.relkind, c.relname;

\echo '== D3. Columns of the runtime-created tables (compared with the code and models)'
SELECT c.relname, a.attnum, a.attname, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null,
       pg_get_expr(d.adbin, d.adrelid) AS default
  FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
 WHERE c.relnamespace = 'public'::regnamespace
   AND c.relname IN ('continuity_timelines', 'continuity_characters', 'continuity_beats', 'continuity_beat_characters',
                     'chapter_versions', 'ecosystem_previews', 'video_compositions')
 ORDER BY 1, 2;

\echo '== D4. Indexes and constraints on those tables'
SELECT c.relname, 'index' AS kind, i.relname AS name, pg_get_indexdef(x.indexrelid) AS def
  FROM pg_index x JOIN pg_class c ON c.oid = x.indrelid JOIN pg_class i ON i.oid = x.indexrelid
 WHERE c.relnamespace = 'public'::regnamespace
   AND c.relname IN ('continuity_timelines', 'continuity_characters', 'continuity_beats', 'continuity_beat_characters',
                     'chapter_versions', 'ecosystem_previews', 'video_compositions')
UNION ALL
SELECT c.relname, 'constraint', k.conname, pg_get_constraintdef(k.oid)
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
 WHERE c.relnamespace = 'public'::regnamespace
   AND c.relname IN ('continuity_timelines', 'continuity_characters', 'continuity_beats', 'continuity_beat_characters',
                     'chapter_versions', 'ecosystem_previews', 'video_compositions')
 ORDER BY 1, 2, 3;

\echo '== D5. What depends on any relation owned by a role other than postgres (ownership transfer impact)'
SELECT c.relname AS app_owned, dep.classid::regclass AS dependent_catalog,
       pg_describe_object(dep.classid, dep.objid, dep.objsubid) AS dependent, dep.deptype
  FROM pg_class c JOIN pg_depend dep ON dep.refclassid = 'pg_class'::regclass AND dep.refobjid = c.oid
 WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND pg_get_userbyid(c.relowner) <> 'postgres'
   AND dep.deptype <> 'i'
 ORDER BY 1, 3;

\echo '== D6. Foreign keys pointing at, or from, a table owned by a role other than postgres'
SELECT k.conname, k.conrelid::regclass AS from_table, k.confrelid::regclass AS to_table
  FROM pg_constraint k
 WHERE k.contype = 'f' AND (pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = k.conrelid)) <> 'postgres'
                         OR pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = k.confrelid)) <> 'postgres');

\echo '== D7. Objects other than tables in public not owned by postgres (functions, types, sequences, views)'
SELECT 'function' AS kind, proname::text AS name, pg_get_userbyid(proowner) AS owner FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace AND pg_get_userbyid(proowner) NOT IN ('postgres', 'rdsadmin')
UNION ALL SELECT 'type', typname::text, pg_get_userbyid(typowner) FROM pg_type
 WHERE typnamespace = 'public'::regnamespace AND typrelid = 0 AND pg_get_userbyid(typowner) NOT IN ('postgres', 'rdsadmin')
UNION ALL SELECT 'schema', nspname::text, pg_get_userbyid(nspowner) FROM pg_namespace
 WHERE nspname NOT LIKE 'pg\_%' AND nspname <> 'information_schema' AND pg_get_userbyid(nspowner) NOT IN ('postgres', 'rdsadmin', 'pg_database_owner')
 ORDER BY 1, 2;

\echo '== D8. Who can create in public / in the database; default privileges'
SELECT r.rolname, has_schema_privilege(r.oid, 'public', 'CREATE') AS create_in_public,
       has_database_privilege(r.oid, current_database(), 'CREATE') AS create_schemas,
       has_schema_privilege(r.oid, 'public', 'USAGE') AS usage_public
  FROM pg_roles r WHERE r.rolname IN ('episode_app_dev', 'prime_readonly', 'postgres') ORDER BY 1;
SELECT n.nspname, pg_get_userbyid(n.nspowner) AS owner, n.nspacl::text AS acl FROM pg_namespace n WHERE n.nspname = 'public';
SELECT pg_get_userbyid(d.defaclrole) AS for_role, d.defaclnamespace::regnamespace AS in_schema, d.defaclobjtype, d.defaclacl::text
  FROM pg_default_acl d ORDER BY 1, 2, 3;

\echo '== D9. The two non-table DDL sites: legacy shows constraints (server.js) and the scenes index (sceneController.js)'
SELECT conname, pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = conrelid)) AS table_owner
  FROM pg_constraint WHERE conrelid = to_regclass('public.shows') AND conname IN ('shows_name_key', 'shows_slug_key');
SELECT i.relname AS index, pg_get_userbyid(i.relowner) AS owner, pg_get_indexdef(i.oid) AS def
  FROM pg_class i WHERE i.relname IN ('idx_scenes_episode_scene_number', 'shows_name_unique_active', 'shows_slug_unique_active')
   AND i.relnamespace = 'public'::regnamespace;

\echo '== D10. Role memberships around episode_app_dev (who may act as its tables owner for an ownership transfer)'
SELECT m.roleid::regrole AS role, m.member::regrole AS member, m.admin_option, m.inherit_option, m.set_option,
       m.grantor::regrole AS grantor
  FROM pg_auth_members m
 WHERE m.roleid = to_regrole('episode_app_dev') OR m.member = to_regrole('episode_app_dev')
 ORDER BY 1, 2;
