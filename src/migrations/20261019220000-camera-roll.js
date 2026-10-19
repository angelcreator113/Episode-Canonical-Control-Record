'use strict';

/**
 * The camera roll (Evoni, 2026-10-19: "every character in LalaWorld should
 * have an official headshot, but their other photos should look like moments
 * from an actual life … photographs should have a purpose. Give each
 * character a believable camera roll").
 *
 *   camera_roll_moments   one planned or made photo of a character's life:
 *     moment       what is happening ("first loaf out of the oven at 6am")
 *     purpose      posted | private | sent | work | memory | screenshot
 *     taken_by     selfie | mirror | friend | timer | photographer
 *     shows_face   whether their face is in it (most photos do not show it)
 *     outfit       at_home | going_out | work | event | none
 *     album        everyday | work | travel | events | social | fashion | objects
 *     place_text / place_ref ({ type, id }), story_date, event_id, episode_id
 *     people       who else is in it ([{ character_id?, name }])
 *     status       proposed | kept | dropped | made | failed
 *     asset_id     the made photo (media_assets), its prompt, error and cost
 *
 *   The official headshot is a media_asset_links row with role 'headshot':
 *   one live headshot per character (partial unique index below).
 *
 * New table and index only, with deleted_at. Guarded: created only when
 * absent. down drops both.
 */

const TABLE = 'camera_roll_moments';
const HEADSHOT_INDEX = 'media_asset_links_one_headshot';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, TABLE, transaction))) {
        await queryInterface.createTable(TABLE, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          character_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'registry_characters', key: 'id' }, onDelete: 'CASCADE' },
          status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'proposed' },
          moment: { type: Sequelize.TEXT, allowNull: false },
          purpose: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'private' },
          taken_by: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'friend' },
          shows_face: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          outfit: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'none' },
          album: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'everyday' },
          place_text: { type: Sequelize.TEXT, allowNull: true },
          place_ref: { type: Sequelize.JSONB, allowNull: true },
          story_date: { type: Sequelize.DATEONLY, allowNull: true },
          event_id: { type: Sequelize.UUID, allowNull: true },
          episode_id: { type: Sequelize.UUID, allowNull: true },
          people: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          prompt: { type: Sequelize.TEXT, allowNull: true },
          asset_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'media_assets', key: 'id' }, onDelete: 'SET NULL' },
          error: { type: Sequelize.TEXT, allowNull: true },
          cost: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
          created_by: { type: Sequelize.STRING(255), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await sequelize.query(
          `ALTER TABLE ${TABLE}
             ADD CONSTRAINT camera_roll_moments_status CHECK (status IN ('proposed', 'kept', 'dropped', 'made', 'failed')),
             ADD CONSTRAINT camera_roll_moments_purpose CHECK (purpose IN ('posted', 'private', 'sent', 'work', 'memory', 'screenshot')),
             ADD CONSTRAINT camera_roll_moments_taken_by CHECK (taken_by IN ('selfie', 'mirror', 'friend', 'timer', 'photographer')),
             ADD CONSTRAINT camera_roll_moments_outfit CHECK (outfit IN ('at_home', 'going_out', 'work', 'event', 'none')),
             ADD CONSTRAINT camera_roll_moments_album CHECK (album IN ('everyday', 'work', 'travel', 'events', 'social', 'fashion', 'objects'))`,
          { transaction });
        await queryInterface.addIndex(TABLE, ['character_id', 'status'], { name: 'camera_roll_moments_character', transaction });
      }
      // One live official headshot per character.
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${HEADSHOT_INDEX} ON media_asset_links (entity_type, entity_id)
          WHERE role = 'headshot' AND deleted_at IS NULL`, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${HEADSHOT_INDEX}`);
    await queryInterface.dropTable(TABLE);
  },
};
