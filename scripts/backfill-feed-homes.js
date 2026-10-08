#!/usr/bin/env node
'use strict';

/**
 * One-time backfill: a home on the DREAM map for every LalaVerse Feed
 * creator that has a city and none (services/feedHomeLocation,
 * backfillHomeLocations). The Feed scheduler made its creators without one
 * until #2764, and bulk import until #2762; /generate always gave one.
 *
 * Each creator gets what /generate gives: its signature venue in its city
 * (a new world_locations row) as its home_location_id, and up to three of
 * the city's other venues as its frequent_venues.
 *
 * Usage (on the server, by Evoni):
 *   node scripts/backfill-feed-homes.js --dry-run     # list who would get one; writes nothing
 *   node scripts/backfill-feed-homes.js --ids 12,34   # these creators first
 *   node scripts/backfill-feed-homes.js --yes         # all of them, without the prompt
 *
 * Flags:
 *   --dry-run   List the creators; no writes
 *   --ids A,B   Only these social_profiles ids
 *   --limit N   At most N creators this run
 *   --yes       Skip the confirmation prompt
 *
 * Idempotent: only a creator with no home_location_id is touched, so a
 * second run leaves alone every creator the first one gave a home.
 */

require('dotenv').config();

const readline = require('readline');
const db = require('../src/models');
const { backfillHomeLocations } = require('../src/services/feedHomeLocation');

// ── Args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const argValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const DRY_RUN = hasFlag('--dry-run');
const SKIP_CONFIRM = hasFlag('--yes');
const LIMIT = argValue('--limit') ? parseInt(argValue('--limit'), 10) : null;
const IDS = argValue('--ids')
  ? argValue('--ids').split(',').map((v) => parseInt(v.trim(), 10)).filter(Number.isInteger)
  : null;

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

const count = (results, status) => results.filter((r) => r.status === status).length;

async function main() {
  const preview = await backfillHomeLocations(db, { dryRun: true, ids: IDS, limit: LIMIT });
  console.log(`${preview.total} LalaVerse creator(s) with a city and no home; ${preview.results.length} this run${LIMIT ? ` (limit ${LIMIT})` : ''}.`);
  for (const r of preview.results) {
    console.log(`  #${r.id} ${r.handle} (${r.city})${r.status === 'not_a_dream_city' ? ': not a DREAM city, skipped' : ''}`);
  }
  const toAssign = count(preview.results, 'would_assign');
  if (DRY_RUN || toAssign === 0) {
    console.log(DRY_RUN ? '\nDry run: nothing written.' : '\nNothing to do.');
    return 0;
  }

  if (!SKIP_CONFIRM && !(await confirm(`\nGive these ${toAssign} creator(s) a home on the DREAM map?`))) {
    console.log('Aborted.');
    return 0;
  }

  const { results } = await backfillHomeLocations(db, { ids: IDS, limit: LIMIT });
  console.log('');
  for (const r of results) {
    if (r.status === 'assigned') console.log(`  + #${r.id} ${r.handle}: ${r.home_name}`);
    else if (r.status === 'no_venue') console.log(`  - #${r.id} ${r.handle}: no venue could be made or found in ${r.city}`);
    else if (r.status === 'failed') console.log(`  x #${r.id} ${r.handle}: ${r.error}`);
  }
  console.log('\n─────────────────────────────────────────');
  console.log(`Assigned: ${count(results, 'assigned')}`);
  console.log(`No venue: ${count(results, 'no_venue')}`);
  console.log(`Failed:   ${count(results, 'failed')}`);
  return count(results, 'failed') > 0 ? 1 : 0;
}

main()
  .then(async (code) => {
    await db.sequelize.close();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error('Fatal:', err);
    try {
      await db.sequelize.close();
    } catch (closeErr) {
      console.error('Could not close the database connection:', closeErr.message);
    }
    process.exit(1);
  });
