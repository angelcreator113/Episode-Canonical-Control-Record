'use strict';

/**
 * pulse_storylines and pulse_storyline_beats: Storylines on The Pulse (Task
 * #2989; The Pulse spec §4 "Storylines — long-running threads the system
 * plants and pays off across posts (planner)";
 * docs/reads/2026-10-12-pulse-world-depth-read.md §7).
 *
 *   pulse_storylines       a plan of posts across story moments: title,
 *                          premise, status planned | running | paid_off |
 *                          dropped; it may follow one of the show's threads
 *                          (show_story_thread_id, nullable), never copying it
 *   pulse_storyline_beats  each beat: kind plant | build | payoff, its story
 *                          order, who posts (a Feed profile), what the post
 *                          should do (brief); status planned | queued |
 *                          drafted | skipped, with the queue job and the post
 *                          it made
 *
 * New tables only, with deleted_at. Guarded: created only when absent. down
 * drops them.
 */

const STORYLINES = 'pulse_storylines';
const BEATS = 'pulse_storyline_beats';

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
      if (!(await tableExists(sequelize, STORYLINES, transaction))) {
        await queryInterface.createTable(STORYLINES, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
          title: { type: Sequelize.STRING(200), allowNull: false },
          premise: { type: Sequelize.TEXT, allowNull: true },
          show_story_thread_id: { type: Sequelize.UUID, allowNull: true },
          status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'planned' },
          ...stamps,
        }, { transaction });
        await queryInterface.addIndex(STORYLINES, ['show_id', 'status'], { name: 'pulse_storylines_show_status', transaction });
      }
      if (!(await tableExists(sequelize, BEATS, transaction))) {
        await queryInterface.createTable(BEATS, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          storyline_id: { type: Sequelize.UUID, allowNull: false, references: { model: STORYLINES, key: 'id' }, onDelete: 'CASCADE' },
          show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
          kind: { type: Sequelize.STRING(10), allowNull: false },
          story_order: { type: Sequelize.INTEGER, allowNull: false },
          poster_profile_id: { type: Sequelize.INTEGER, allowNull: false },
          brief: { type: Sequelize.TEXT, allowNull: false },
          status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'planned' },
          job_id: { type: Sequelize.UUID, allowNull: true },
          post_id: { type: Sequelize.UUID, allowNull: true },
          ...stamps,
        }, { transaction });
        await queryInterface.addIndex(BEATS, ['storyline_id', 'story_order'], { name: 'pulse_storyline_beats_line_order', transaction });
        await queryInterface.addIndex(BEATS, ['show_id', 'status', 'story_order'], { name: 'pulse_storyline_beats_due', transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, BEATS, transaction)) await queryInterface.dropTable(BEATS, { transaction });
      if (await tableExists(sequelize, STORYLINES, transaction)) await queryInterface.dropTable(STORYLINES, { transaction });
    });
  },
};
