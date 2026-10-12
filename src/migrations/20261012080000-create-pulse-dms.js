'use strict';

/**
 * pulse_dm_threads and pulse_dm_messages: DMs on The Pulse (Task #2984; The
 * Pulse spec §3 "Lala's DMs are canon conversations, drafted in voice and
 * approved like posts; they can appear on Lala's Phone";
 * docs/reads/2026-10-12-pulse-world-depth-read.md §3). Evoni, 2026-10-12:
 * both sides are drafted in voice, Lala's included, and every message waits
 * in Review.
 *
 *   pulse_dm_threads   one conversation per pair of Feed profiles in a show
 *                      (profile_a_id < profile_b_id), opened at a story
 *                      order, with what it is about (topic)
 *   pulse_dm_messages  each message: its sender, text and story order;
 *                      status draft | live | rejected; the gate's result
 *
 * Names and handles are never copied: they are read from social_profiles.
 * New tables only, with deleted_at. Guarded: created only when absent. down
 * drops them.
 */

const THREADS = 'pulse_dm_threads';
const MESSAGES = 'pulse_dm_messages';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const stamps = {
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    };
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, THREADS, transaction))) {
        await queryInterface.createTable(THREADS, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
          profile_a_id: { type: Sequelize.INTEGER, allowNull: false },
          profile_b_id: { type: Sequelize.INTEGER, allowNull: false },
          opened_story_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          topic: { type: Sequelize.TEXT, allowNull: true },
          ...stamps,
        }, { transaction });
        await sequelize.query(
          `CREATE UNIQUE INDEX pulse_dm_threads_one_per_pair ON ${THREADS} (show_id, profile_a_id, profile_b_id) WHERE deleted_at IS NULL`,
          { transaction });
      }
      if (!(await tableExists(sequelize, MESSAGES, transaction))) {
        await queryInterface.createTable(MESSAGES, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          thread_id: { type: Sequelize.UUID, allowNull: false, references: { model: THREADS, key: 'id' }, onDelete: 'CASCADE' },
          show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
          sender_profile_id: { type: Sequelize.INTEGER, allowNull: false },
          text: { type: Sequelize.TEXT, allowNull: false },
          story_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'draft' },
          gate_json: { type: Sequelize.JSONB, allowNull: true },
          ai_generated: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          generation_model: { type: Sequelize.STRING(80), allowNull: true },
          posted_at: { type: Sequelize.DATE, allowNull: true },
          decided_by: { type: Sequelize.STRING(255), allowNull: true },
          decided_at: { type: Sequelize.DATE, allowNull: true },
          ...stamps,
        }, { transaction });
        await queryInterface.addIndex(MESSAGES, ['thread_id', 'story_order'], { name: 'pulse_dm_messages_thread_order', transaction });
        await queryInterface.addIndex(MESSAGES, ['show_id', 'status'], { name: 'pulse_dm_messages_status', transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, MESSAGES, transaction)) await queryInterface.dropTable(MESSAGES, { transaction });
      if (await tableExists(sequelize, THREADS, transaction)) await queryInterface.dropTable(THREADS, { transaction });
    });
  },
};
