'use strict';

/**
 * pulse_polls, pulse_poll_options and pulse_poll_votes: audience polls (Task
 * #3005; The Pulse spec §11 "Audience voting: a public poll ('which look for
 * <event>?') whose result is offered to Evoni as a choice on the Style
 * Page"; docs/reads/2026-10-12-pulse-public-extras-read.md §2, §3).
 *
 *   pulse_polls         one poll about an event (or an episode) in a show;
 *                       status draft | open | closed
 *   pulse_poll_options  each choice: Evoni's label and the look it means, as
 *                       wardrobe item ids (the shape of world_events.
 *                       outfit_pieces and lock-outfit-atomic), never copies
 *   pulse_poll_votes    one row per vote: the option, and the voter's cookie
 *                       id and IP, each hashed with POLL_HASH_SALT (never the
 *                       raw values); one vote per poll per cookie and per IP
 *
 * New tables only, with deleted_at. Guarded: created only when absent. down
 * drops them.
 */

const POLLS = 'pulse_polls';
const OPTIONS = 'pulse_poll_options';
const VOTES = 'pulse_poll_votes';

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
      if (!(await tableExists(sequelize, POLLS, transaction))) {
        await queryInterface.createTable(POLLS, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE' },
          world_event_id: { type: Sequelize.UUID, allowNull: true },
          episode_id: { type: Sequelize.UUID, allowNull: true },
          question: { type: Sequelize.TEXT, allowNull: false },
          status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'draft' },
          closes_at: { type: Sequelize.DATE, allowNull: true },
          opened_at: { type: Sequelize.DATE, allowNull: true },
          closed_at: { type: Sequelize.DATE, allowNull: true },
          ...stamps,
        }, { transaction });
        await queryInterface.addIndex(POLLS, ['show_id', 'status'], { name: 'pulse_polls_show_status', transaction });
        await queryInterface.addIndex(POLLS, ['episode_id'], { name: 'pulse_polls_episode', transaction });
        await queryInterface.addIndex(POLLS, ['world_event_id'], { name: 'pulse_polls_event', transaction });
      }
      if (!(await tableExists(sequelize, OPTIONS, transaction))) {
        await queryInterface.createTable(OPTIONS, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          poll_id: { type: Sequelize.UUID, allowNull: false, references: { model: POLLS, key: 'id' }, onDelete: 'CASCADE' },
          label: { type: Sequelize.STRING(200), allowNull: false },
          wardrobe_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          ...stamps,
        }, { transaction });
        await queryInterface.addIndex(OPTIONS, ['poll_id', 'sort_order'], { name: 'pulse_poll_options_poll', transaction });
      }
      if (!(await tableExists(sequelize, VOTES, transaction))) {
        await queryInterface.createTable(VOTES, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          poll_id: { type: Sequelize.UUID, allowNull: false, references: { model: POLLS, key: 'id' }, onDelete: 'CASCADE' },
          option_id: { type: Sequelize.UUID, allowNull: false, references: { model: OPTIONS, key: 'id' }, onDelete: 'CASCADE' },
          voter_hash: { type: Sequelize.STRING(64), allowNull: false },
          ip_hash: { type: Sequelize.STRING(64), allowNull: false },
          ...stamps,
        }, { transaction });
        await sequelize.query(
          `CREATE UNIQUE INDEX pulse_poll_votes_one_per_voter ON ${VOTES} (poll_id, voter_hash) WHERE deleted_at IS NULL`, { transaction });
        await sequelize.query(
          `CREATE UNIQUE INDEX pulse_poll_votes_one_per_ip ON ${VOTES} (poll_id, ip_hash) WHERE deleted_at IS NULL`, { transaction });
        await queryInterface.addIndex(VOTES, ['option_id'], { name: 'pulse_poll_votes_option', transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, VOTES, transaction)) await queryInterface.dropTable(VOTES, { transaction });
      if (await tableExists(sequelize, OPTIONS, transaction)) await queryInterface.dropTable(OPTIONS, { transaction });
      if (await tableExists(sequelize, POLLS, transaction)) await queryInterface.dropTable(POLLS, { transaction });
    });
  },
};
