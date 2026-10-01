'use strict';

/**
 * Lala's home city is Echo Park (Evoni's correction, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(cc)):
 *
 *   "Lala's home city is Echo Park, one of the five DREAM cities in the
 *   LalaVerse (not Los Angeles). Her home is 246 Olddy Paveway Ln, Echo
 *   Park. [...] An event inside Echo Park is local: getting there is event
 *   spending, never travel. An event in any other DREAM city drafts travel
 *   [...]"
 *
 * Migration 20261001190000 wrote shows.metadata.lala_home as { address
 * '246 Olddy Paveway Ln', neighbourhood 'Echo Park', city 'Los Angeles' }.
 * up rewrites every lala_home whose city is Los Angeles and neighbourhood
 * Echo Park (that default, or the same place re-saved at Show Settings) to
 * city 'Echo Park', neighbourhood null, keeping its address. Any other home
 * is left as it is.
 *
 * down puts back city 'Los Angeles' and neighbourhood 'Echo Park' only
 * where lala_home still equals the value up writes.
 *
 * Guarded: skipped when the shows table is absent; a re-run changes nothing.
 */

const OLD = Object.freeze({ neighbourhood: 'echo park', city: 'los angeles' });
const ADDRESS = '246 Olddy Paveway Ln';

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function parseJson(value) {
  if (value == null) return {};
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[migration 20261001210000] shows.metadata JSON parse failed; row skipped:', err.message);
    return null;
  }
}

async function rewrite(queryInterface, matches, next, label) {
  const { sequelize } = queryInterface;
  await sequelize.transaction(async (transaction) => {
    if (!(await tableExists(sequelize, 'shows', transaction))) return;
    const [shows] = await sequelize.query('SELECT id, metadata FROM shows', { transaction });
    let changed = 0;
    for (const show of shows) {
      const metadata = parseJson(show.metadata);
      const home = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata.lala_home : null;
      if (!home || typeof home !== 'object' || !matches(home)) continue;
      await sequelize.query('UPDATE shows SET metadata = :metadata WHERE id = :id', {
        replacements: { id: show.id, metadata: JSON.stringify({ ...metadata, lala_home: next(home) }) },
        transaction,
      });
      changed += 1;
    }
    console.log(`[migration 20261001210000] ${label} on ${changed} show(s)`);
  });
}

module.exports = {
  async up(queryInterface) {
    await rewrite(
      queryInterface,
      (home) => norm(home.city) === OLD.city && norm(home.neighbourhood) === OLD.neighbourhood,
      (home) => ({ address: home.address ?? null, neighbourhood: null, city: 'Echo Park' }),
      'lala_home city set to Echo Park'
    );
  },

  async down(queryInterface) {
    await rewrite(
      queryInterface,
      (home) => home.city === 'Echo Park' && home.neighbourhood == null && home.address === ADDRESS,
      (home) => ({ address: home.address, neighbourhood: 'Echo Park', city: 'Los Angeles' }),
      'lala_home city set back to Los Angeles'
    );
  },
};
