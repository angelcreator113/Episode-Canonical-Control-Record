'use strict';

/**
 * episode_story_records (Evoni, 2026-10-17, stage C of the storytelling
 * plan: "The episode should produce an Episode Story Record containing what
 * happened, what each character knew, which secrets were hinted at, what
 * changed emotionally, and what unresolved threads remain. The short-story
 * writer uses that record ... The chapter-book writer uses both").
 *
 * One live record per episode:
 *   what_happened  the episode in a paragraph
 *   characters     [{ character_id, name, knew, learned, changed }]
 *   secrets        [{ secret_id, character_id, text, what: hinted | revealed, how }]
 *   threads        [{ thread_id, title, note }]  what is left open
 *   status         draft | approved: writers read an approved record only;
 *                  approving moves each secret's audience state on
 *
 * Raw SQL in services/episodeStoryRecord; no model. Guarded: created only
 * when absent. down drops it.
 */

const TABLE = 'episode_story_records';

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
        episode_id: { type: Sequelize.UUID, allowNull: false },
        show_id: { type: Sequelize.UUID, allowNull: true },
        status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'draft' },
        what_happened: { type: Sequelize.TEXT, allowNull: true },
        characters: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
        secrets: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
        threads: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
        drafted_at: { type: Sequelize.DATE, allowNull: true },
        approved_by: { type: Sequelize.STRING(255), allowNull: true },
        approved_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_episode ON ${TABLE} (episode_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
