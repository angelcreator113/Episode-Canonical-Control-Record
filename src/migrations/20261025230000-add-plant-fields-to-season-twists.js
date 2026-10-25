'use strict';

/**
 * Plant tracker (2026-10-25): season_twists becomes the season's list of
 * plants. A plant is a small detail an episode's script sets up that should
 * pay off later in the season ("Declan Ferris is @thriftveil", "Studio by
 * Sable wants Lala to model, not design"). The table already holds the
 * episode it is planted in (plant_slot_id), the planned payoff
 * (payoff_slot_id) and the status; this adds:
 *   kind              twist | relationship | opportunity | mystery | callback (default twist)
 *   plant_beat        the script beat it is planted in; null when not known
 *   paid_off_slot_id  the slot it actually paid off in (Mark paid off in episode N),
 *                     kept apart from the planned one so the plan is not lost
 *   payoff_note       how it paid off, in her words
 * The table keeps its deleted_at. Guarded: each column is added only when
 * absent. down removes them.
 */

const TABLE = 'season_twists';
const KIND_CHECK = `${TABLE}_kind_check`;

const columnsOf = async (queryInterface, transaction) => {
  try {
    return await queryInterface.describeTable(TABLE, { transaction });
  } catch (err) {
    console.error(`[migration] ${TABLE} could not be described:`, err.message);
    return null;
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const cols = await columnsOf(queryInterface, transaction);
      if (!cols) return; // the table's own migration has not run; nothing to add to
      if (!cols.kind) {
        await queryInterface.addColumn(TABLE, 'kind', { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'twist' }, { transaction });
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${KIND_CHECK} CHECK (kind IN ('twist', 'relationship', 'opportunity', 'mystery', 'callback'))`,
          { transaction });
      }
      if (!cols.plant_beat) await queryInterface.addColumn(TABLE, 'plant_beat', { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      if (!cols.paid_off_slot_id) await queryInterface.addColumn(TABLE, 'paid_off_slot_id', { type: Sequelize.UUID, allowNull: true }, { transaction });
      if (!cols.payoff_note) await queryInterface.addColumn(TABLE, 'payoff_note', { type: Sequelize.TEXT, allowNull: true }, { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_paid_off_slot ON ${TABLE} (paid_off_slot_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const cols = await columnsOf(queryInterface, transaction);
      if (!cols) return;
      await sequelize.query(`DROP INDEX IF EXISTS ${TABLE}_paid_off_slot`, { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${KIND_CHECK}`, { transaction });
      for (const col of ['payoff_note', 'paid_off_slot_id', 'plant_beat', 'kind']) {
        if (cols[col]) await queryInterface.removeColumn(TABLE, col, { transaction });
      }
    });
  },
};
