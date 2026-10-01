'use strict';

/**
 * Event spending (Evoni's event cost split ruling, 2026-09-30,
 * docs/EVENT_EPISODE_FLOW.md §8(cc), §8(aa); the extras migration plan she
 * accepted the same day). Build PR 4 of docs/DEAL_COMPONENTS_DESIGN.md §6.
 *
 * "Event spending (drinks, valet, photo booth and other things Lala chooses
 * during the event) lives in the episode's Money tab, editable until
 * Complete, each line quantity × unit price, auto-drafted from the event's
 * extras as suggestions, charged at Complete like other costs."
 *
 * 1. episode_spending_lines: one line per thing Lala buys during the event.
 *      episode_id, event_id    the episode and its source event
 *      label, quantity, unit_price   the line; its total is quantity × unit_price
 *      source                  'extras' (drafted from the event's extras),
 *                              'carried' (moved from an extras cost row), or
 *                              NULL (added by hand)
 *      source_cost_id          the event_costs row it was carried from
 *      drafted_quantity, drafted_unit_price   the drafted copy; the line
 *                              reads Auto-drafted while it equals them
 *                              (doctrine rule 14), Edited once it differs
 *      timestamps, deleted_at (paranoid)
 * 2. The accepted plan for existing extras rows (event_costs.kind 'extras'):
 *      - episode started and not completed (no ledger row names the cost
 *        row, and the episode's evaluation is not accepted): each live row
 *        becomes one line (1 × its amount), keeping its Auto-drafted or
 *        Edited state and a pointer back to the row, and the row is
 *        soft-deleted, so the terms total drops by that amount and nothing
 *        is charged twice;
 *      - episode completed: untouched (the ledger names those rows);
 *      - no episode yet: left in place; Start Episode moves them.
 *    Logs its counts; production counts are known only when it runs.
 *
 * Guarded: the table is created only when absent; the data step runs only
 * when event_costs and episodes exist. down drops the table after restoring
 * the carried rows (their deleted_at cleared).
 */

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function parseJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[migration 20261001180000] canon_consequences JSON parse failed; read as empty:', err.message);
    return null;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'episode_spending_lines', transaction))) {
        await queryInterface.createTable('episode_spending_lines', {
          id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
          episode_id: {
            type: Sequelize.UUID, allowNull: false,
            references: { model: 'episodes', key: 'id' }, onDelete: 'CASCADE',
          },
          event_id: { type: Sequelize.UUID, allowNull: true },
          label: { type: Sequelize.STRING(200), allowNull: false },
          quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          unit_price: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          source: { type: Sequelize.STRING(20), allowNull: true },
          source_cost_id: { type: Sequelize.UUID, allowNull: true },
          drafted_quantity: { type: Sequelize.INTEGER, allowNull: true },
          drafted_unit_price: { type: Sequelize.INTEGER, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS episode_spending_lines_episode_id ON episode_spending_lines (episode_id)', { transaction });

      if (!(await tableExists(sequelize, 'event_costs', transaction)) || !(await tableExists(sequelize, 'episodes', transaction))) return;
      const ledger = await tableExists(sequelize, 'financial_transactions', transaction);
      const [rows] = await sequelize.query(
        `SELECT c.id, c.event_id, c.label, c.amount, e.used_in_episode_id AS episode_id, e.canon_consequences,
                ep.evaluation_status
           FROM event_costs c
           JOIN world_events e ON e.id = c.event_id
           JOIN episodes ep ON ep.id = e.used_in_episode_id AND ep.deleted_at IS NULL
          WHERE c.kind = 'extras' AND c.deleted_at IS NULL`,
        { transaction });
      let moved = 0; let completed = 0;
      for (const r of rows) {
        let charged = r.evaluation_status === 'accepted';
        if (!charged && ledger) {
          const [[hit]] = await sequelize.query(
            `SELECT COUNT(*)::int AS n FROM financial_transactions WHERE source_type = 'event_cost' AND source_id = :id`,
            { replacements: { id: r.id }, transaction });
          charged = hit.n > 0;
        }
        if (charged) { completed += 1; continue; }
        const drafted = parseJson(r.canon_consequences)?.automation?.drafted_values?.costs?.[r.id];
        const amount = Number(r.amount) || 0;
        const draftedAmount = drafted && drafted.amount != null ? Number(drafted.amount) : null;
        await sequelize.query(
          `INSERT INTO episode_spending_lines (id, episode_id, event_id, label, quantity, unit_price, source, source_cost_id,
             drafted_quantity, drafted_unit_price, created_at, updated_at)
           VALUES (gen_random_uuid(), :episodeId, :eventId, :label, 1, :amount, 'carried', :costId,
             :draftedQuantity, :draftedUnit, NOW(), NOW())`,
          {
            replacements: {
              episodeId: r.episode_id, eventId: r.event_id, label: r.label || 'Extras', amount, costId: r.id,
              draftedQuantity: draftedAmount == null ? null : 1, draftedUnit: draftedAmount,
            },
            transaction,
          });
        await sequelize.query('UPDATE event_costs SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id',
          { replacements: { id: r.id }, transaction });
        moved += 1;
      }
      console.log(`[migration 20261001180000] extras rows moved to event spending: ${moved}; left on completed episodes: ${completed}; rows of events with no episode stay until Start Episode`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'episode_spending_lines', transaction))) return;
      if (await tableExists(sequelize, 'event_costs', transaction)) {
        await sequelize.query(
          `UPDATE event_costs SET deleted_at = NULL, updated_at = NOW()
            WHERE id IN (SELECT source_cost_id FROM episode_spending_lines
                          WHERE source = 'carried' AND source_cost_id IS NOT NULL AND deleted_at IS NULL)`,
          { transaction });
      }
      await sequelize.query('DROP TABLE IF EXISTS episode_spending_lines', { transaction });
    });
  },
};
