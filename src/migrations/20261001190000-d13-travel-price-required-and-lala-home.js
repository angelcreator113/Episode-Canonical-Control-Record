'use strict';

/**
 * D13 travel (Evoni, 2026-09-30): "Lala's home is 246 Olddy Paveway Ln, Echo
 * Park, Los Angeles; store it as a show setting (address, neighbourhood Echo
 * Park, city Los Angeles). Travel and accommodation are drafted only when an
 * event's location is outside Los Angeles (fallback: category
 * travel_destination); those lines are drafted with no amount and show
 * "Price required" (never 0), so the price is set or comped before Start
 * Episode."
 *
 * 1. event_costs.amount may be NULL: a line with no amount yet ("Price
 *    required"). The default stays 0; every existing row keeps its amount.
 * 2. Lala's home, as a show setting: shows.metadata.lala_home =
 *    { address, neighbourhood, city }, written on every live show that has
 *    none (an existing setting is left as it is). shows.metadata is JSON,
 *    so each row is read, merged and written back.
 *
 * Guarded: each step is skipped when its table is absent. Logs its counts.
 * down sets NOT NULL again after giving any NULL amount 0, and removes the
 * lala_home key only where it still equals the value written here.
 */

const LALA_HOME = Object.freeze({
  address: '246 Olddy Paveway Ln',
  neighbourhood: 'Echo Park',
  city: 'Los Angeles',
});

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function parseJson(value) {
  if (value == null) return {};
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[migration 20261001190000] shows.metadata JSON parse failed; row skipped:', err.message);
    return null;
  }
}

module.exports = {
  LALA_HOME,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, 'event_costs', transaction)) {
        await sequelize.query('ALTER TABLE event_costs ALTER COLUMN amount DROP NOT NULL', { transaction });
      }
      if (!(await tableExists(sequelize, 'shows', transaction))) return;
      const [shows] = await sequelize.query('SELECT id, metadata FROM shows WHERE deleted_at IS NULL', { transaction });
      let written = 0; let kept = 0;
      for (const show of shows) {
        const metadata = parseJson(show.metadata);
        if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) continue;
        if (metadata.lala_home) { kept += 1; continue; }
        await sequelize.query('UPDATE shows SET metadata = :metadata WHERE id = :id', {
          replacements: { id: show.id, metadata: JSON.stringify({ ...metadata, lala_home: { ...LALA_HOME } }) },
          transaction,
        });
        written += 1;
      }
      console.log(`[migration 20261001190000] event_costs.amount nullable; lala_home written on ${written} show(s), kept on ${kept}`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, 'event_costs', transaction)) {
        await sequelize.query('UPDATE event_costs SET amount = 0 WHERE amount IS NULL', { transaction });
        await sequelize.query('ALTER TABLE event_costs ALTER COLUMN amount SET NOT NULL', { transaction });
      }
      if (!(await tableExists(sequelize, 'shows', transaction))) return;
      const [shows] = await sequelize.query('SELECT id, metadata FROM shows', { transaction });
      for (const show of shows) {
        const metadata = parseJson(show.metadata);
        if (!metadata || JSON.stringify(metadata.lala_home) !== JSON.stringify(LALA_HOME)) continue;
        const { lala_home: _removed, ...rest } = metadata;
        await sequelize.query('UPDATE shows SET metadata = :metadata WHERE id = :id', {
          replacements: { id: show.id, metadata: JSON.stringify(rest) }, transaction,
        });
      }
    });
  },
};
