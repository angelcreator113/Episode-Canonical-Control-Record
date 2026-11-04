-- Generated from scripts/deploy/migration-trust-check.js (#3710): its three queries, with the
-- migration login written as :mig_role instead of current_user, so a read-only login can preview
-- what the Deploy trust check will find. Run with search_path = public (set by the caller).
\echo '-- T1. Untrusted roles that can CREATE on the migration path (expect no row once CREATE is revoked)'
WITH trusted AS (
  SELECT r.oid FROM pg_catalog.pg_roles r
   WHERE r.rolname = :'mig_role' OR r.rolsuper OR r.rolname = 'rdsadmin'
      OR pg_catalog.pg_has_role(:'mig_role', r.oid, 'MEMBER')), path AS (
  SELECT n.oid, n.nspname FROM pg_catalog.unnest(pg_catalog.current_schemas(true)) AS s(name)
    JOIN pg_catalog.pg_namespace n ON n.nspname = s.name)
  SELECT p.nspname AS schema, r.rolname AS role
    FROM path p CROSS JOIN pg_catalog.pg_roles r
   WHERE r.oid NOT IN (SELECT oid FROM trusted)
     AND pg_catalog.has_schema_privilege(r.oid, p.oid, 'CREATE')
   ORDER BY 1, 2;
\echo '-- T2. Untrusted roles holding TRIGGER on a table on the path (expect no row)'
WITH trusted AS (
  SELECT r.oid FROM pg_catalog.pg_roles r
   WHERE r.rolname = :'mig_role' OR r.rolsuper OR r.rolname = 'rdsadmin'
      OR pg_catalog.pg_has_role(:'mig_role', r.oid, 'MEMBER')), path AS (
  SELECT n.oid, n.nspname FROM pg_catalog.unnest(pg_catalog.current_schemas(true)) AS s(name)
    JOIN pg_catalog.pg_namespace n ON n.nspname = s.name)
  SELECT p.nspname AS schema, c.relname AS relation, r.rolname AS role
    FROM pg_catalog.pg_class c JOIN path p ON p.oid = c.relnamespace CROSS JOIN pg_catalog.pg_roles r
   WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
     AND r.oid NOT IN (SELECT oid FROM trusted)
     AND pg_catalog.has_table_privilege(r.oid, c.oid, 'TRIGGER')
   ORDER BY 1, 2, 3;
\echo '-- T3. Objects on the path owned by an untrusted role (expect no row once brain_documents is dropped)'
WITH trusted AS (
  SELECT r.oid FROM pg_catalog.pg_roles r
   WHERE r.rolname = :'mig_role' OR r.rolsuper OR r.rolname = 'rdsadmin'
      OR pg_catalog.pg_has_role(:'mig_role', r.oid, 'MEMBER')), path AS (
  SELECT n.oid, n.nspname FROM pg_catalog.unnest(pg_catalog.current_schemas(true)) AS s(name)
    JOIN pg_catalog.pg_namespace n ON n.nspname = s.name),
  owned (kind, schema, name, owner) AS (
    SELECT 'relation', p.nspname, c.relname::text, c.relowner FROM pg_catalog.pg_class c JOIN path p ON p.oid = c.relnamespace
    UNION ALL SELECT CASE f.prokind WHEN 'a' THEN 'aggregate' WHEN 'p' THEN 'procedure' ELSE 'function' END,
                     p.nspname, f.proname::text, f.proowner FROM pg_catalog.pg_proc f JOIN path p ON p.oid = f.pronamespace
    UNION ALL SELECT 'operator', p.nspname, o.oprname::text, o.oprowner FROM pg_catalog.pg_operator o JOIN path p ON p.oid = o.oprnamespace
    UNION ALL SELECT 'type', p.nspname, t.typname::text, t.typowner FROM pg_catalog.pg_type t JOIN path p ON p.oid = t.typnamespace
                     WHERE t.typrelid = 0
    UNION ALL SELECT 'collation', p.nspname, x.collname::text, x.collowner FROM pg_catalog.pg_collation x JOIN path p ON p.oid = x.collnamespace
    UNION ALL SELECT 'conversion', p.nspname, x.conname::text, x.conowner FROM pg_catalog.pg_conversion x JOIN path p ON p.oid = x.connamespace
    UNION ALL SELECT 'text search configuration', p.nspname, x.cfgname::text, x.cfgowner FROM pg_catalog.pg_ts_config x JOIN path p ON p.oid = x.cfgnamespace
    UNION ALL SELECT 'text search dictionary', p.nspname, x.dictname::text, x.dictowner FROM pg_catalog.pg_ts_dict x JOIN path p ON p.oid = x.dictnamespace
    UNION ALL SELECT 'operator class', p.nspname, x.opcname::text, x.opcowner FROM pg_catalog.pg_opclass x JOIN path p ON p.oid = x.opcnamespace
    UNION ALL SELECT 'operator family', p.nspname, x.opfname::text, x.opfowner FROM pg_catalog.pg_opfamily x JOIN path p ON p.oid = x.opfnamespace
    UNION ALL SELECT 'extension', p.nspname, x.extname::text, x.extowner FROM pg_catalog.pg_extension x JOIN path p ON p.oid = x.extnamespace
    UNION ALL SELECT 'trigger function', p.nspname, c.relname || '.' || t.tgname, f.proowner
                FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
                JOIN path p ON p.oid = c.relnamespace JOIN pg_catalog.pg_proc f ON f.oid = t.tgfoid
               WHERE NOT t.tgisinternal
  )
  SELECT o.kind, o.schema, o.name, pg_catalog.pg_get_userbyid(o.owner) AS owner
    FROM owned o WHERE o.owner NOT IN (SELECT oid FROM trusted)
   ORDER BY 1, 2, 3;
