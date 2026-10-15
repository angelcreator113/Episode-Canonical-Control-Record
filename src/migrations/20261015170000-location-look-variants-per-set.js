'use strict';

/**
 * location_look_variants belong to the everyday set they were made for
 * (review of #3226, 2026-10-15): keyed by location, choosing another
 * everyday look showed the old base's re-lights on the new set. Adds:
 *   scene_set_id     the everyday set the variant was made for; existing
 *                    rows take their location's approved set (the only set
 *                    variants could be made on)
 *   source_angle_id  for a season, the Front angle it shows
 * and moves the one-live-row index from (world_location_id, kind, value)
 * to (scene_set_id, kind, value). Rows whose location has no approved set
 * any more are soft-deleted (no set to show them on).
 *
 * A new file, as 20261015150000 is merged and may have run. Guarded: each
 * step only when needed. down restores the location index and drops the
 * columns.
 */

const TABLE = 'location_look_variants';

const columnExists = async (sequelize, column, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table: TABLE, column }, transaction });
  return rows.length > 0;
};
const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      if (!(await columnExists(sequelize, 'scene_set_id', transaction))) {
        await queryInterface.addColumn(TABLE, 'scene_set_id', { type: Sequelize.UUID, allowNull: true }, { transaction });
      }
      if (!(await columnExists(sequelize, 'source_angle_id', transaction))) {
        await queryInterface.addColumn(TABLE, 'source_angle_id', { type: Sequelize.UUID, allowNull: true }, { transaction });
      }
      await sequelize.query(
        `UPDATE location_look_variants v SET scene_set_id = l.approved_base_scene_set_id
           FROM world_locations l
          WHERE l.id = v.world_location_id AND v.scene_set_id IS NULL AND l.approved_base_scene_set_id IS NOT NULL`,
        { transaction });
      await sequelize.query(
        `UPDATE location_look_variants SET deleted_at = NOW(), updated_at = NOW()
          WHERE scene_set_id IS NULL AND deleted_at IS NULL`,
        { transaction });
      await sequelize.query('DROP INDEX IF EXISTS location_look_variants_unique', { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS location_look_variants_set_unique
           ON location_look_variants (scene_set_id, kind, value) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query('DROP INDEX IF EXISTS location_look_variants_set_unique', { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS location_look_variants_unique
           ON location_look_variants (world_location_id, kind, value) WHERE deleted_at IS NULL`,
        { transaction });
      if (await columnExists(sequelize, 'source_angle_id', transaction)) await queryInterface.removeColumn(TABLE, 'source_angle_id', { transaction });
      if (await columnExists(sequelize, 'scene_set_id', transaction)) await queryInterface.removeColumn(TABLE, 'scene_set_id', { transaction });
    });
  },
};
