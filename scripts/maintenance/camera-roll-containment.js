#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Camera Roll rollback containment, the command (#3714 Tier 1). Maintenance
 * only: run by an operator, by hand, during the runbook procedure
 * (docs/runbooks/deploy-workflow.md, "Rolling back past the Camera Roll
 * make-safety release"). Nothing runs it automatically: no deploy phase,
 * pm2 app, npm script or application module loads it.
 *
 *   node scripts/maintenance/camera-roll-containment.js status
 *   node scripts/maintenance/camera-roll-containment.js contain --op-id <id> [--apply --by <name> --approval-ref <ref>]
 *   node scripts/maintenance/camera-roll-containment.js restore --op-id <id> [--apply --by <name> --approval-ref <ref>]
 *
 * Every command is a dry run unless --apply is given; --apply refuses without
 * both --by and --approval-ref. status is always read-only. Output is JSON:
 * photo ids, statuses, counts and privilege booleans; never a credential,
 * host or photo content.
 *
 * Database: the production settings in src/config/sequelize.js (NODE_ENV,
 * DB_* from the environment, the repository's .env), read the same way as
 * scripts/check-pending-migrations.js, with a one-connection pool. Writes
 * need the migration login (data_correction_log refuses the application
 * role); status shows whether the current login has every privilege needed.
 */

const path = require('path');

const USAGE = [
  'usage: camera-roll-containment.js status',
  '       camera-roll-containment.js contain --op-id <id> [--apply --by <name> --approval-ref <ref>]',
  '       camera-roll-containment.js restore --op-id <id> [--apply --by <name> --approval-ref <ref>]',
].join('\n');

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command, apply: false };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--apply') opts.apply = true;
    else if (['--op-id', '--by', '--approval-ref'].includes(a)) {
      const v = rest[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      opts[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
      i += 1;
    } else throw new Error(`unknown argument: ${a}`);
  }
  if (!['status', 'contain', 'restore'].includes(command)) throw new Error(`unknown command: ${command || '(none)'}`);
  if (command === 'status') {
    if (opts.apply || opts.opId) throw new Error('status takes no options; it is always read-only');
    return opts;
  }
  if (!opts.opId) throw new Error(`${command} needs --op-id`);
  if (opts.apply && !(String(opts.by || '').trim() && String(opts.approvalRef || '').trim())) {
    throw new Error('--apply needs both --by and --approval-ref; nothing was changed');
  }
  return opts;
}

function connect() {
  const { Sequelize } = require('sequelize');
  const env = process.env.NODE_ENV || 'development';
  const dbConfig = require(path.join(__dirname, '..', '..', 'src', 'config', 'sequelize'))[env];
  if (!dbConfig) throw new Error(`no database config for NODE_ENV=${env}`);
  return new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: false,
    pool: { max: 1, min: 0, acquire: 30000, idle: 1000 },
    dialectOptions: { ...dbConfig.dialectOptions, client_encoding: 'UTF8' },
  });
}

async function run(opts, sequelize) {
  const lib = require('./cameraRollContainment');
  if (opts.command === 'status') return lib.status(sequelize);
  const dryRun = !opts.apply;
  if (opts.command === 'contain') {
    return lib.contain(sequelize, { opId: opts.opId, by: opts.by, approvalRef: opts.approvalRef, dryRun });
  }
  return lib.restore(sequelize, { opId: opts.opId, by: opts.by, dryRun });
}

async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`[camera-roll-containment] ${err.message}\n${USAGE}`);
    return 64;
  }
  process.chdir(path.join(__dirname, '..', '..'));
  let sequelize;
  try {
    sequelize = connect();
    const result = await run(opts, sequelize);
    console.log(JSON.stringify({ command: opts.command, apply: opts.apply, ...result }, null, 2));
    if (opts.command === 'status' && result.unsafe) {
      console.error('[camera-roll-containment] UNSAFE: photos are contained but the deletion guard is incomplete. Stop (runbook).');
      return 3;
    }
    return 0;
  } catch (err) {
    // Database errors can name the host; print only their class and code.
    const what = err && /^Sequelize/.test(String(err.name))
      ? `${err.name} (${(err.parent && err.parent.code) || 'no code'})`
      : (err && err.message) || String(err);
    console.error(`[camera-roll-containment] ${opts.command} failed: ${what}. The transaction was rolled back; nothing was changed.`);
    return 1;
  } finally {
    if (sequelize) await sequelize.close().catch((e) => console.error(`[camera-roll-containment] close: ${e.message}`));
  }
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; });
}

module.exports = { parseArgs, main, run };
