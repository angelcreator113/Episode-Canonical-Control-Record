'use strict';

/**
 * Deal components (ruling D14, Evoni 2026-09-30; docs/DEAL_COMPONENTS_DESIGN.md
 * §3.3). Build PR 2 of that note.
 *
 * world_events.deal_components JSONB NULL: the ticked components (keys in
 * src/utils/dealComponents.js). NULL is a legacy event; [] a self-funded
 * deal. Backfilled from deal_type with the one-to-one map, which changes no
 * money, so a started episode's terms read the same:
 *   self_funded → []                      invited_comped → [entry_covered]
 *   gifted → [gifted_items]               paid_appearance → [paid_to_appear]
 *   paid_deliverables → [paid_for_content]
 *   appearance_plus_deliverables → [paid_to_appear, paid_for_content]
 *   performance_booking → [paid_for_content, performance_fee]
 *   brand_partnership → [paid_for_content, partnership_base]
 *                       (+ paid_to_appear when appearance_required)
 * The drafted record moves with it: an event whose deal type was
 * Auto-drafted gets automation.auto_drafted.deal_components and
 * drafted_values.deal_components (from the drafted deal type), so it still
 * reads Auto-drafted. deal_type is kept (a derived copy for one release).
 *
 * Guarded: skipped when world_events is absent; ADD COLUMN IF NOT EXISTS;
 * only rows with deal_components NULL are backfilled. Logs its counts.
 */

const { componentsFromDealType } = require('../utils/dealComponents');

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function parseJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[migration 20261001170000] canon_consequences JSON parse failed; left as it is:', err.message);
    return null;
  }
}

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'world_events', transaction))) return;
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      await q('ALTER TABLE world_events ADD COLUMN IF NOT EXISTS deal_components JSONB');

      const [rows] = await q(`SELECT id, deal_type, appearance_required, canon_consequences FROM world_events
                               WHERE deal_type IS NOT NULL AND deal_components IS NULL`);
      let backfilled = 0; let drafted = 0; let unknown = 0;
      for (const row of rows) {
        const components = componentsFromDealType(row.deal_type, row.appearance_required);
        if (!components) { unknown += 1; continue; }
        const cc = parseJson(row.canon_consequences);
        const automation = cc?.automation;
        let nextCc = null;
        if (automation?.auto_drafted?.deal_type && automation?.drafted_values?.deal_type) {
          const draftedComponents = componentsFromDealType(automation.drafted_values.deal_type, row.appearance_required);
          if (draftedComponents) {
            nextCc = {
              ...cc,
              automation: {
                ...automation,
                auto_drafted: { ...automation.auto_drafted, deal_components: automation.auto_drafted.deal_type },
                drafted_values: { ...automation.drafted_values, deal_components: draftedComponents },
              },
            };
            drafted += 1;
          }
        }
        await q(
          `UPDATE world_events SET deal_components = CAST(:components AS JSONB)${nextCc ? ', canon_consequences = :cc' : ''}
            WHERE id = :id`,
          { id: row.id, components: JSON.stringify(components), ...(nextCc ? { cc: JSON.stringify(nextCc) } : {}) });
        backfilled += 1;
      }
      console.log(`[migration 20261001170000] deal_components backfilled on ${backfilled} event(s); drafted records carried on ${drafted}; unknown deal_type left NULL on ${unknown}`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'world_events', transaction))) return;
      await sequelize.query('ALTER TABLE world_events DROP COLUMN IF EXISTS deal_components', { transaction });
    });
  },
};
