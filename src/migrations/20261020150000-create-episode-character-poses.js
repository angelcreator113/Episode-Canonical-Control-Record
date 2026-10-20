'use strict';

/**
 * episode_character_poses: photos of Lala and JustAWoman for one episode,
 * uploaded on the episode's Files tab and labelled by pose (Evoni,
 * 2026-10-20). Per episode, because her look changes each episode. A pose
 * can hold several photos; one per (episode, character, pose) is the
 * default the thumbnail editor picks first.
 *
 * Each photo keeps three files: the original untouched (original_key), the
 * enhanced photo with its background (enhanced_key: colour and light fixed,
 * upscaled when small) and the final cut-out (final_key: background removed,
 * edges cleaned, trimmed; a transparent PNG). episodePoseMedia does the work.
 *
 * character_key: lala, justawoman (registry slugs).
 * pose: front, back, side, glamour.
 * status: queued, processing, ready, failed.
 * steps: what the processing did ({ color, upscale, background, edges }).
 * Raw SQL in episodePosesService, like episode_raw_clips; no model.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'episode_character_poses';

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
        character_key: { type: Sequelize.STRING(40), allowNull: false },
        pose: { type: Sequelize.STRING(20), allowNull: false },
        is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        original_filename: { type: Sequelize.STRING(255), allowNull: true },
        content_type: { type: Sequelize.STRING(100), allowNull: true },
        file_size_bytes: { type: Sequelize.BIGINT, allowNull: true },
        width: { type: Sequelize.INTEGER, allowNull: true },
        height: { type: Sequelize.INTEGER, allowNull: true },
        original_key: { type: Sequelize.TEXT, allowNull: false },
        original_url: { type: Sequelize.TEXT, allowNull: true },
        enhanced_key: { type: Sequelize.TEXT, allowNull: true },
        enhanced_url: { type: Sequelize.TEXT, allowNull: true },
        final_key: { type: Sequelize.TEXT, allowNull: true },
        final_url: { type: Sequelize.TEXT, allowNull: true },
        final_width: { type: Sequelize.INTEGER, allowNull: true },
        final_height: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'queued' },
        error: { type: Sequelize.TEXT, allowNull: true },
        steps: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        started_at: { type: Sequelize.DATE, allowNull: true },
        finished_at: { type: Sequelize.DATE, allowNull: true },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE}
           ADD CONSTRAINT ${TABLE}_character CHECK (character_key IN ('lala', 'justawoman')),
           ADD CONSTRAINT ${TABLE}_pose CHECK (pose IN ('front', 'back', 'side', 'glamour')),
           ADD CONSTRAINT ${TABLE}_status CHECK (status IN ('queued', 'processing', 'ready', 'failed'))`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_episode ON ${TABLE} (episode_id, created_at) WHERE deleted_at IS NULL`,
        { transaction });
      // One default per episode, character and pose.
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_one_default
           ON ${TABLE} (episode_id, character_key, pose) WHERE is_default AND deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
