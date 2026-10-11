#!/usr/bin/env node
'use strict';

/**
 * One-time backfill: each episode's estimated money, priced from its chosen
 * look instead of the whole closet (Task #1919; Evoni's ruling 2026-10-11).
 * Start Episode priced every closet item as the outfit until #2902, so an
 * episode's total_expenses and its todo list's financial_summary carried the
 * closet's value. Each episode gets what Start writes today
 * (services/episodeEstimateBackfill).
 *
 * Finalized episodes (their totals are the ledger's), episodes whose event's
 * terms are reopened, episodes Start never estimated (no todo list
 * financial_summary) and episodes with no event are left alone. The ledger
 * and Lala's balance are never touched.
 *
 * Usage (on the server, by Evoni). A dry run is the default:
 *   node scripts/backfill-episode-estimates.js                 # list what would change; writes nothing
 *   node scripts/backfill-episode-estimates.js --ids A,B       # only these episodes
 *   node scripts/backfill-episode-estimates.js --apply         # write, after a confirmation prompt
 *   node scripts/backfill-episode-estimates.js --apply --yes   # write, without the prompt
 *
 * Flags:
 *   --apply     Write the changes (without it, nothing is written)
 *   --ids A,B   Only these episode ids (uuids)
 *   --show ID   Only this show's episodes
 *   --limit N   At most N episodes this run (oldest first)
 *   --yes       Skip the confirmation prompt
 *
 * Idempotent: an episode whose stored estimate already matches is
 * unchanged, so a second run writes nothing.
 */

require('dotenv').config();

const readline = require('readline');
const db = require('../src/models');
const { STATUS, listEpisodeIds, planEpisodeEstimate, applyEpisodeEstimate } = require('../src/services/episodeEstimateBackfill');

// ── Args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const argValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const APPLY = hasFlag('--apply');
const SKIP_CONFIRM = hasFlag('--yes');
const SHOW_ID = argValue('--show');
const LIMIT = argValue('--limit') ? parseInt(argValue('--limit'), 10) : null;
const IDS = argValue('--ids') ? argValue('--ids').split(',').map((v) => v.trim()).filter(Boolean) : null;

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

const label = (p) => `${p.episode_number != null ? `Ep ${p.episode_number}` : 'Ep ?'} "${p.title || 'Untitled'}" (${p.episode_id})`;
const money = (v) => (v === null || v === undefined ? '—' : String(v));
const describe = (p) => [
  `expenses ${money(p.before.total_expenses)} → ${money(p.after.total_expenses)}`,
  `income ${money(p.before.total_income)} → ${money(p.after.total_income)}`,
  `outfit ${money(p.before.financial_summary?.outfit_cost)} → ${p.after.financial_summary.outfit_chosen
    ? money(p.after.financial_summary.outfit_cost) : 'no outfit chosen'}`,
].join('; ');

async function main() {
  const ids = await listEpisodeIds(db.sequelize, { ids: IDS, showId: SHOW_ID, limit: LIMIT });
  const plans = [];
  for (const id of ids) {
    try {
      plans.push(await planEpisodeEstimate(db.sequelize, id));
    } catch (err) {
      console.error(`  x ${id}: plan failed: ${err.message}`);
      plans.push({ episode_id: id, status: 'failed', error: err.message });
    }
  }
  const by = (status) => plans.filter((p) => p.status === status);
  const changed = by(STATUS.CHANGED);

  console.log(`${ids.length} episode(s) checked${LIMIT ? ` (limit ${LIMIT})` : ''}.`);
  for (const p of changed) console.log(`  ~ ${label(p)}: ${describe(p)}`);
  console.log('');
  console.log(`Would change:           ${changed.length}`);
  console.log(`Already right:          ${by(STATUS.UNCHANGED).length}`);
  console.log(`Finalized (left):       ${by(STATUS.FINALIZED).length}`);
  console.log(`Terms reopened (left):  ${by(STATUS.REOPENED).length}`);
  console.log(`Never estimated (left): ${by(STATUS.NO_ESTIMATE).length}`);
  console.log(`No event (left):        ${by(STATUS.NO_EVENT).length}`);
  console.log(`Failed to plan:         ${by('failed').length}`);

  if (!APPLY || changed.length === 0) {
    console.log(APPLY ? '\nNothing to do.' : '\nDry run: nothing written. Add --apply to write.');
    return by('failed').length > 0 ? 1 : 0;
  }
  if (!SKIP_CONFIRM && !(await confirm(`\nRewrite the estimate of these ${changed.length} episode(s)?`))) {
    console.log('Aborted.');
    return 0;
  }

  let written = 0;
  let failed = 0;
  for (const p of changed) {
    try {
      const done = await applyEpisodeEstimate(db.sequelize, p.episode_id);
      if (done.status === STATUS.CHANGED) {
        written += 1;
        console.log(`  + ${label(done)}: ${describe(done)}`);
      } else {
        console.log(`  - ${label(p)}: ${done.status} since the dry run, left alone`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  x ${label(p)}: ${err.message}`);
    }
  }
  console.log('\n─────────────────────────────────────────');
  console.log(`Written: ${written}`);
  console.log(`Failed:  ${failed}`);
  return failed > 0 ? 1 : 0;
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
