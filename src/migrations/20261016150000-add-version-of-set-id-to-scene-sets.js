'use strict';

/**
 * scene_sets.version_of_set_id: a set that is an event version of an
 * everyday set (Evoni, 2026-10-16: "i also need to be able to choose which
 * photo is the everyday set and which ones belong to an event set"; she
 * chose whole sets: "Lala's bedroom [Everyday]", "Lala's bedroom – Gala
 * [Event: Spring Gala] → version of Lala's bedroom").
 *
 *   NULL      the set is an everyday set (every set before this migration)
 *   a set id  the set is an event version of that everyday set; the event
 *             it is for is the event that uses it (world_events.scene_set_id)
 *
 * Nullable, no default: existing sets stay everyday. The foreign key keeps
 * a version from pointing at a set that never existed; a soft-deleted
 * everyday set is handled by the service (its versions read as everyday).
 * Added only if missing, and down drops only what this migration added.
 */

const MARK = 'added by 20261016150000-add-version-of-set-id-to-scene-sets';

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const columnExists = (sequelize) => exists(sequelize,
  "SELECT 1 FROM information_schema.columns WHERE table_name = 'scene_sets' AND column_name = 'version_of_set_id'");
const addedHere = (sequelize) => exists(sequelize,
  `SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'scene_sets' AND a.attname = 'version_of_set_id' AND NOT a.attisdropped
      AND col_description(c.oid, a.attnum) = :mark`, { mark: MARK });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (await columnExists(sequelize)) return;
    await queryInterface.addColumn('scene_sets', 'version_of_set_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'scene_sets', key: 'id' },
      onDelete: 'SET NULL',
    });
    await sequelize.query(`COMMENT ON COLUMN scene_sets.version_of_set_id IS '${MARK}'`);
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_scene_sets_version_of_set_id ON scene_sets (version_of_set_id) WHERE version_of_set_id IS NOT NULL');
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await addedHere(sequelize))) return;
    await sequelize.query('DROP INDEX IF EXISTS idx_scene_sets_version_of_set_id');
    await queryInterface.removeColumn('scene_sets', 'version_of_set_id');
  },
};
