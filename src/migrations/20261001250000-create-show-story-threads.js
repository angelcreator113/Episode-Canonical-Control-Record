'use strict';

/**
 * Story threads for Lala's show (Evoni's rulings, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff); build PR 7 of
 * docs/SEASON_ARC_DESIGN_NOTE.md). The only thread table before this,
 * story_threads, belongs to the novel (book and chapter keys).
 *
 *   A3. A slot's intention includes "the story thread it continues".
 *   A6. Accepting an episode "updates [...] story threads".
 *   Q9 (accepted). "you create and name them; drafts are offered from
 *   seeds_future_events. Acceptance can mark one "advanced", and only you
 *   close one."
 *
 * show_story_threads: one row per thread.
 *   show_id, title, description
 *   status            open | advanced | closed
 *   source            'evoni' (created by hand) | 'seed' (from a seed draft)
 *   seed_text         the seed it was created from (so the draft is not
 *                     offered again)
 *   opened_episode_id the episode whose seed it came from (nullable)
 *   last_advanced_episode_id, last_advanced_at   set by acceptance
 *   closed_at         set only by Evoni
 *   timestamps, deleted_at (paranoid)
 * season_slots.story_thread_id (from 20261001230000) points here.
 *
 * Guarded: created only when absent. down drops the table.
 */

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'show_story_threads', transaction))) {
        await queryInterface.createTable('show_story_threads', {
          id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: {
            type: Sequelize.UUID, allowNull: false,
            references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE',
          },
          title: { type: Sequelize.STRING(200), allowNull: false },
          description: { type: Sequelize.TEXT, allowNull: true },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'open' },
          source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'evoni' },
          seed_text: { type: Sequelize.TEXT, allowNull: true },
          opened_episode_id: { type: Sequelize.UUID, allowNull: true },
          last_advanced_episode_id: { type: Sequelize.UUID, allowNull: true },
          last_advanced_at: { type: Sequelize.DATE, allowNull: true },
          closed_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS show_story_threads_show_id ON show_story_threads (show_id)', { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, 'show_story_threads')) {
      await queryInterface.dropTable('show_story_threads');
    }
  },
};
