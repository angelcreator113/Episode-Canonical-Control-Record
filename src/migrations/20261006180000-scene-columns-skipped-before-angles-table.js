'use strict';

/**
 * The scene_sets and scene_angles columns the models read but a fresh
 * database never gets (found 2026-10-06 while fixing scene-angle tests that
 * failed only in a full local run).
 *
 * 20260322000000-scene-generation-v2-enhancements returns early when
 * scene_angles does not exist, and scene_angles is only created later, by
 * 20260625000000-create-scene-sets-and-angles; so on a fresh database
 * neither its scene_angles columns nor its scene_sets columns are added.
 * 20260324000000-add-scene-sets-cover-and-episodes skipped cover_angle_id
 * the same way. Seven more scene_angles columns (angle_description …
 * refined_prompt) were only ever in the dead migrations/ tree. The model
 * then selects columns that are not there and every SceneSet / SceneAngle
 * read fails with "column … does not exist".
 *
 * Each column is added only where it is missing, with the definition of
 * the migration that meant to add it, so a database that already has them
 * (any database built before those migrations started skipping) is left
 * as it is. No data changes.
 */

const SCENE_SET_COLUMNS = (S) => [
  ['style_reference_url', { type: S.TEXT, allowNull: true }],
  ['negative_prompt', { type: S.TEXT, allowNull: true }],
  ['variation_count', { type: S.INTEGER, allowNull: true, defaultValue: 1 }],
  ['cover_angle_id', {
    type: S.UUID, allowNull: true,
    references: { model: 'scene_angles', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
  }],
];

const SCENE_ANGLE_COLUMNS = (S) => [
  ['angle_description', { type: S.TEXT, allowNull: true }],
  ['camera_direction', { type: S.TEXT, allowNull: true }],
  ['quality_score', { type: S.INTEGER, allowNull: true }],
  ['artifact_flags', { type: S.JSONB, allowNull: true, defaultValue: [] }],
  ['quality_review', { type: S.JSONB, allowNull: true, defaultValue: null }],
  ['generation_attempt', { type: S.INTEGER, allowNull: false, defaultValue: 1 }],
  ['refined_prompt', { type: S.TEXT, allowNull: true }],
  ['camera_motion', { type: S.STRING, allowNull: true }],
  ['video_duration', { type: S.INTEGER, allowNull: true, defaultValue: 5 }],
  ['style_reference_url', { type: S.TEXT, allowNull: true }],
  ['variation_count', { type: S.INTEGER, allowNull: true, defaultValue: 1 }],
  ['variation_data', { type: S.JSONB, allowNull: true, defaultValue: null }],
  ['enhanced_still_url', { type: S.TEXT, allowNull: true }],
  ['enhanced_video_url', { type: S.TEXT, allowNull: true }],
];

async function addMissing(queryInterface, table, columns, transaction) {
  const have = await queryInterface.describeTable(table, { transaction }).catch(() => null);
  if (!have) {
    console.log(`[migration 20261006180000] ${table} does not exist; skipped`);
    return [];
  }
  const added = [];
  for (const [name, def] of columns) {
    if (have[name]) continue;
    await queryInterface.addColumn(table, name, def, { transaction });
    added.push(name);
  }
  return added;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const angles = await addMissing(queryInterface, 'scene_angles', SCENE_ANGLE_COLUMNS(Sequelize), transaction);

      // post_processing_status, an ENUM, as 20260322000000 defines it.
      const angleTable = await queryInterface.describeTable('scene_angles', { transaction }).catch(() => null);
      if (angleTable && !angleTable.post_processing_status) {
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE "enum_scene_angles_post_processing_status" AS ENUM ('pending', 'processing', 'complete', 'failed');
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$;`, { transaction });
        await queryInterface.sequelize.query(
          `ALTER TABLE scene_angles ADD COLUMN post_processing_status "enum_scene_angles_post_processing_status" DEFAULT 'pending'`,
          { transaction }
        );
        angles.push('post_processing_status');
      }

      const sets = await addMissing(queryInterface, 'scene_sets', SCENE_SET_COLUMNS(Sequelize), transaction);
      console.log(`[migration 20261006180000] added scene_angles: ${angles.join(', ') || 'none'}; scene_sets: ${sets.join(', ') || 'none'}`);
    });
  },

  // Nothing is removed: on a database built before the skipped migrations
  // these columns predate this one, and dropping them would lose data.
  async down() {},
};
