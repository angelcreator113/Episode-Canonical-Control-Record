'use strict';

/**
 * season_arc_proposals (Evoni, 2026-10-17: "take in all the information
 * even as it grows and automatically come up with a season arc ... as the
 * feed characters grow so does the story arc"; her ruling: proposals she
 * approves). One row per proposal from services/seasonArcProposals: the
 * feed signals it read (and their hash, so an unchanged feed is not asked
 * about twice), what it proposes (phase themes, threads to open or close,
 * purposes for open slots, each with why), and what came of it.
 *
 * status: proposed | accepted | dismissed | superseded | no_change.
 * Raw SQL in services/seasonArcProposals; no model.
 *
 * Guarded: created only when absent. down drops it.
 */

const TABLE = 'season_arc_proposals';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) return;
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
        show_id: { type: Sequelize.UUID, allowNull: false },
        arc_id: { type: Sequelize.UUID, allowNull: true },
        status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'proposed' },
        trigger: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'manual' },
        signals: { type: Sequelize.JSONB, allowNull: true },
        signals_hash: { type: Sequelize.STRING(64), allowNull: true },
        summary: { type: Sequelize.TEXT, allowNull: true },
        changes: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
        applied: { type: Sequelize.JSONB, allowNull: true },
        decided_by: { type: Sequelize.STRING(255), allowNull: true },
        decided_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_show ON ${TABLE} (show_id, created_at DESC) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
