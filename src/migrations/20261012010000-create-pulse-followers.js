'use strict';

/**
 * pulse_followers: the follower ledger (Task #2952; The Pulse spec §8
 * "Followers are canon per character, changed only with a recorded cause";
 * docs/reads/2026-10-12-pulse-numbers-read.md). Evoni, 2026-10-12: a ledger
 * of its own, not a column on character_state (F-Stats-1) or
 * registry_characters (F-Reg-2). One row per change to a Feed profile's
 * followers in a show; a profile's count at a story moment is the latest
 * accepted row at or before it.
 *
 *   story_order  when the change takes effect (services/storyClock.js);
 *                a starting count is 0, before everything
 *   change       signed; count_after the count once it applies
 *   cause        start | episode | post | event | override (cause_id names it)
 *   status       proposed | accepted | rejected
 *
 * New table only, with deleted_at. Guarded: created only when absent. down
 * drops it.
 */

const TABLE = 'pulse_followers';

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
        social_profile_id: { type: Sequelize.INTEGER, allowNull: false },
        story_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        change: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        count_after: { type: Sequelize.INTEGER, allowNull: true },
        cause: { type: Sequelize.STRING(20), allowNull: false },
        cause_id: { type: Sequelize.STRING(64), allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'proposed' },
        decided_by: { type: Sequelize.STRING(255), allowNull: true },
        decided_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await queryInterface.addIndex(TABLE, ['show_id', 'social_profile_id', 'story_order'], { name: 'pulse_followers_profile_order', transaction });
      // One starting count per profile per show.
      await sequelize.query(
        `CREATE UNIQUE INDEX pulse_followers_one_start ON ${TABLE} (show_id, social_profile_id) WHERE cause = 'start' AND deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) await queryInterface.dropTable(TABLE, { transaction });
    });
  },
};
