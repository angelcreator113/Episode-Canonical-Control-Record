'use strict';

/**
 * pulse_recaps: the weekly Pulse recap (Task #3008; The Pulse spec §11
 * "Weekly Pulse recap: a shareable digest of the week's biggest revealed,
 * published moments for the website"; docs/reads/2026-10-12-pulse-public-
 * extras-read.md §4). Evoni, 2026-10-12: a page on the public website,
 * drafted each week, published only when she approves.
 *
 *   one row per show per week (week_start, a Monday): status draft |
 *   published | dropped; Evoni's title and intro; the chosen posts as
 *   feed_posts ids in order (ids, never copies: a post is read live).
 *
 * New table only, with deleted_at. Guarded: created only when absent. down
 * drops it.
 */

const TABLE = 'pulse_recaps';

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
        show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
        week_start: { type: Sequelize.DATEONLY, allowNull: false },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'draft' },
        title: { type: Sequelize.STRING(200), allowNull: false },
        intro: { type: Sequelize.TEXT, allowNull: true },
        post_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        published_at: { type: Sequelize.DATE, allowNull: true },
        published_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX pulse_recaps_one_per_week ON ${TABLE} (show_id, week_start) WHERE deleted_at IS NULL`, { transaction });
      await queryInterface.addIndex(TABLE, ['status', 'published_at'], { name: 'pulse_recaps_published', transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
