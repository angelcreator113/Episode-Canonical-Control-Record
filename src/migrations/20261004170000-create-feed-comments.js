'use strict';

/**
 * feed_comments: a post's comments as records (the Feed project, step 4,
 * 2026-10-04; docs/FEED_POSTS.md rule 6). Until now a post's comments were
 * sample_comments, a list of strings with no author, so a reaction had no
 * voice and could not be canon.
 *
 * Each row names its post and show, who said it (a social profile when
 * one matches, always a handle), the text, and its status: 'draft'
 * (proposed, for approval; editable) or 'live' (on the feed under the
 * post; never edited again, only deleted). ai_generated and
 * generation_model say when the drafter wrote it; voice_note keeps why
 * this character reacts this way (the relationship the drafter used).
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'feed_comments';

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
        feed_post_id: { type: Sequelize.UUID, allowNull: false },
        show_id: { type: Sequelize.UUID, allowNull: false },
        social_profile_id: { type: Sequelize.INTEGER, allowNull: true },
        handle: { type: Sequelize.STRING(100), allowNull: false },
        display_name: { type: Sequelize.STRING(200), allowNull: true },
        text: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'draft' },
        posted_at: { type: Sequelize.DATE, allowNull: true },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        ai_generated: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        generation_model: { type: Sequelize.STRING(60), allowNull: true },
        voice_note: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT ${TABLE}_status_check CHECK (status IN ('draft', 'live'))`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_post ON ${TABLE} (feed_post_id, status) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
