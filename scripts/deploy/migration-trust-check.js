#!/usr/bin/env node
'use strict';

/**
 * Migration trust check (Deploy hardening, Evoni 2026-11-04;
 * docs/reads/2026-11-04-deploy-migration-trusted-path.md).
 *
 * phase_migrate in scripts/deploy/workflow-deploy.sh runs this right before
 * `sequelize-cli db:migrate`, from the staged release, with the same migration
 * credential and the same PGOPTIONS. PGOPTIONS pins every connection the
 * migration opens to `search_path = public` (pg_catalog is always searched
 * first, and unqualified new objects go into public).
 *
 * Why: migrations run as a privileged role. Postgres resolves unqualified
 * tables, functions and operators through the search path, so code that a
 * less trusted role has placed in a schema on that path can run with the
 * migration role's rights (CVE-2018-1058 class; reproduced locally against
 * production's grants, PR #3709). Pinning the path removes the per-user
 * schema ("$user") from it. Three further conditions are needed, and they are
 * checked here:
 *   1. No untrusted role can CREATE in any schema on the path. This is what
 *      makes the check hold after it runs: if it fails, an object planted a
 *      second later would be invisible to any one-time check.
 *   2. No untrusted role holds TRIGGER on a table on the path (it could
 *      attach its own function to a table the migration writes).
 *   3. No object in a schema on the path (relation, function, procedure,
 *      aggregate, operator, type, collation, conversion, text search object,
 *      extension), and no trigger on a relation there, is owned by an
 *      untrusted role.
 *
 * Trusted: the migration login itself, every role it is a member of
 * (on RDS, rds_superuser and pg_database_owner), superusers, and rdsadmin.
 * Every other role is untrusted, including the application's.
 *
 * Read-only: it runs only SELECTs, in a READ ONLY transaction.
 *
 * Exit 0: trusted. Exit 1: untrusted; each finding is printed and the
 * migration must not run. Exit 2: could not check.
 *
 * Usage: NODE_ENV=production PGOPTIONS="-c search_path=public" \
 *   node scripts/deploy/migration-trust-check.js --config src/config/sequelize.js
 */

const path = require('path');

// pg_catalog is searched first even when it is not listed; new objects go into
// the first listed schema, so it must be public.
const EXPECTED_SEARCH_PATH = 'public';
const P = '[migration-trust]';

const TRUSTED = `
  SELECT r.oid FROM pg_catalog.pg_roles r
   WHERE r.rolname = current_user OR r.rolsuper OR r.rolname = 'rdsadmin'
      OR pg_catalog.pg_has_role(current_user, r.oid, 'MEMBER')`;

const PATH = `
  SELECT n.oid, n.nspname FROM pg_catalog.unnest(pg_catalog.current_schemas(true)) AS s(name)
    JOIN pg_catalog.pg_namespace n ON n.nspname = s.name`;

// Who can create in a schema on the path, other than trusted roles. Every
// role is checked (not only login roles): a NOINHERIT login can SET ROLE to
// a role it belongs to.
const CREATORS = `
  WITH trusted AS (${TRUSTED}), path AS (${PATH})
  SELECT p.nspname AS schema, r.rolname AS role
    FROM path p CROSS JOIN pg_catalog.pg_roles r
   WHERE r.oid NOT IN (SELECT oid FROM trusted)
     AND pg_catalog.has_schema_privilege(r.oid, p.oid, 'CREATE')
   ORDER BY 1, 2`;

// Relations on the path on which an untrusted role holds TRIGGER: it could
// attach its own function to a table the migration writes, after this check.
const TRIGGER_GRANTS = `
  WITH trusted AS (${TRUSTED}), path AS (${PATH})
  SELECT p.nspname AS schema, c.relname AS relation, r.rolname AS role
    FROM pg_catalog.pg_class c JOIN path p ON p.oid = c.relnamespace CROSS JOIN pg_catalog.pg_roles r
   WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
     AND r.oid NOT IN (SELECT oid FROM trusted)
     AND pg_catalog.has_table_privilege(r.oid, c.oid, 'TRIGGER')
   ORDER BY 1, 2, 3`;

// Objects on the path owned by an untrusted role, and triggers there whose
// function an untrusted role owns.
const OWNED = `
  WITH trusted AS (${TRUSTED}), path AS (${PATH}),
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
   ORDER BY 1, 2, 3`;

function configFromArgs(argv) {
  const i = argv.indexOf('--config');
  if (i < 0 || !argv[i + 1]) throw new Error('usage: migration-trust-check.js --config <sequelize config file>');
  const env = process.env.NODE_ENV || 'production';
  const cfg = require(path.resolve(argv[i + 1]))[env];
  if (!cfg) throw new Error(`no "${env}" entry in the config file`);
  return cfg;
}

async function check(client) {
  const findings = [];
  await client.query('BEGIN READ ONLY');
  try {
    const { rows: [sp] } = await client.query("SELECT pg_catalog.current_setting('search_path') AS search_path");
    // Compared as a list of names: "a,b" and "a, b" are the same path.
    // Every entry counts, including one that names a schema
    // that does not exist yet: it could be created later.
    const entries = sp.search_path.split(',').map((e) => e.trim()).filter(Boolean);
    if (entries.join(', ') !== EXPECTED_SEARCH_PATH) {
      findings.push(`the session's search_path is "${sp.search_path}", not "${EXPECTED_SEARCH_PATH}" (PGOPTIONS did not reach the connection)`);
    }
    const { rows: creators } = await client.query(CREATORS);
    for (const r of creators) findings.push(`role ${r.role} can CREATE in schema ${r.schema}, which is on the migration search path`);
    const { rows: triggerGrants } = await client.query(TRIGGER_GRANTS);
    for (const t of triggerGrants) findings.push(`role ${t.role} holds TRIGGER on ${t.schema}.${t.relation}`);
    const { rows: owned } = await client.query(OWNED);
    for (const o of owned) findings.push(`${o.kind} ${o.schema}.${o.name} is owned by role ${o.owner}`);
  } finally {
    await client.query('ROLLBACK');
  }
  return findings;
}

async function main() {
  let client;
  try {
    const cfg = configFromArgs(process.argv);
    const { Client } = require('pg');
    // No `options` here: PGOPTIONS, from the environment, applies, exactly as
    // for sequelize-cli's own connections.
    client = new Client({
      host: cfg.host, port: cfg.port, user: cfg.username, password: cfg.password, database: cfg.database,
      ssl: (cfg.dialectOptions && cfg.dialectOptions.ssl) || false,
    });
    await client.connect();
  } catch (err) {
    console.log(`${P} ERROR: could not connect: ${err.message}`);
    return 2;
  }
  try {
    const findings = await check(client);
    if (findings.length) {
      for (const f of findings) console.log(`${P} UNTRUSTED: ${f}`);
      console.log(`${P} FAIL: ${findings.length} finding(s); the migration must not run.`);
      return 1;
    }
    console.log(`${P} OK: search_path is "${EXPECTED_SEARCH_PATH}"; only trusted roles can create or own objects on it.`);
    return 0;
  } catch (err) {
    console.log(`${P} ERROR: ${err.message}`);
    return 2;
  } finally {
    await client.end().catch((err) => console.log(`${P} (close: ${err.message})`));
  }
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; });
}

module.exports = { EXPECTED_SEARCH_PATH, CREATORS, TRIGGER_GRANTS, OWNED, check };
