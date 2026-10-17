'use strict';

/**
 * story_canon_proposals (Evoni, 2026-10-17, stage D of the storytelling
 * plan: "the short story should not invent a major new canonical event that
 * contradicts the episode or future chapters. New revelations should be
 * proposed for canon approval").
 *
 * What one short story adds, as proposals Evoni accepts or dismisses:
 *   kind     secret         a kept secret it hints at or reveals
 *                           { secret_id, character_id, text, what, how, over_budget }
 *            fact           a new event or fact it establishes { text }
 *            thread         a thread it opens or moves on { thread_id, title, note }
 *            contradiction  where it goes against the episode's record { text }
 *                           (a flag: it can only be dismissed)
 *   status   pending | accepted | dismissed
 *
 * Accepting a secret moves its audience state on; a thread opens or is
 * marked advanced; an accepted fact is canon the chapter writer may build
 * on, a dismissed one is not. Raw SQL in services/storyCanon; no model.
 * Guarded: created only when absent. down drops it.
 */

const TABLE = 'story_canon_proposals';

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
        story_id: { type: Sequelize.UUID, allowNull: false },
        episode_id: { type: Sequelize.UUID, allowNull: false },
        show_id: { type: Sequelize.UUID, allowNull: true },
        kind: { type: Sequelize.STRING(15), allowNull: false },
        payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'{}'::jsonb") },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'pending' },
        decided_by: { type: Sequelize.STRING(255), allowNull: true },
        decided_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_episode ON ${TABLE} (episode_id, status) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_story ON ${TABLE} (story_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
