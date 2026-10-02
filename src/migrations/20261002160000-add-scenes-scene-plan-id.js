'use strict';

/**
 * scenes.scene_plan_id: the beat a scene row stands for (Evoni's answer
 * L12a, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   "every beat with a set and angle gets its scene row automatically
 *   (scene_plan_id link, background = the beat's angle image, the dressed
 *   one after L10, scene number from the beat's position, default 5s),
 *   created or updated whenever the beat changes ... existing untied
 *   scenes show once under 'Older scenes' until removed."
 *
 * Nullable: the scenes made before this ("Use in Episode", the Timeline's
 * own) stay untied. One live scene per beat (a partial unique index). No
 * foreign key: a re-plan replaces plan rows, and the tied scene moves to
 * the new row of its beat (beatScenesService).
 *
 * Guarded: added only when absent. down drops the index and the column.
 */

const columnExists = async (sequelize, table, column, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column`,
    { replacements: { table, column }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, 'scenes', 'scene_plan_id', transaction))) {
        await sequelize.query('ALTER TABLE scenes ADD COLUMN scene_plan_id UUID NULL', { transaction });
      }
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS scenes_unique_scene_plan
           ON scenes (scene_plan_id) WHERE deleted_at IS NULL AND scene_plan_id IS NOT NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query('DROP INDEX IF EXISTS scenes_unique_scene_plan');
    if (await columnExists(sequelize, 'scenes', 'scene_plan_id')) {
      await sequelize.query('ALTER TABLE scenes DROP COLUMN scene_plan_id');
    }
  },
};
