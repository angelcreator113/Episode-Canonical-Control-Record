'use strict';

/**
 * registry_characters.created_from: how a character was made (Evoni,
 * 2026-10-19: someone made from the feed follows Lala; anyone else is her
 * choice).
 *
 * Crossing a feed profile (POST /social-profiles/:id/cross) used to write
 * metadata.source = 'social_profile_crossing', but registry_characters has no
 * metadata column, so Sequelize dropped it and nothing recorded the origin.
 * This column keeps it: 'feed_cross', 'cast_generate' ("Make one for me"),
 * 'manual' (The Cast's New character), 'clone', 'promote_ghost', 'generator'
 * (character-generation /confirm). NULL when it was not recorded.
 *
 * Backfill, for characters still NULL:
 *   - 'feed_cross' when their linked feed profile was crossed
 *     (social_profiles.status = 'crossed' or crossed_at set);
 *   - 'cast_generate' when extra_fields.made_by says so.
 * Running it again changes nothing. down() drops the column.
 */

const TABLE = 'registry_characters';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const columns = await queryInterface.describeTable(TABLE);
      if (!columns.created_from) {
        await queryInterface.addColumn(TABLE, 'created_from', { type: Sequelize.STRING(30), allowNull: true }, { transaction });
      }
      const [, crossed] = await sequelize.query(
        `UPDATE ${TABLE} rc SET created_from = 'feed_cross'
           FROM social_profiles sp
          WHERE rc.feed_profile_id = sp.id AND rc.created_from IS NULL
            AND (sp.status = 'crossed' OR sp.crossed_at IS NOT NULL)`,
        { transaction });
      const [, generated] = await sequelize.query(
        `UPDATE ${TABLE} SET created_from = 'cast_generate'
          WHERE created_from IS NULL AND extra_fields->>'made_by' = 'cast_generate'`,
        { transaction });
      console.log(`[registry-created-from] ${crossed?.rowCount ?? 0} character(s) marked made from the feed; `
        + `${generated?.rowCount ?? 0} marked made by "Make one for me".`);
    });
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable(TABLE);
    if (columns.created_from) await queryInterface.removeColumn(TABLE, 'created_from');
  },
};
