'use strict';

/** Change angle_label from ENUM to VARCHAR so users can type custom labels. */
module.exports = {
  async up(queryInterface) {
    // Convert ENUM column to VARCHAR, preserving existing values
    await queryInterface.sequelize.query(`
      ALTER TABLE scene_angles
      ALTER COLUMN angle_label TYPE VARCHAR(50) USING angle_label::text;
    `);

    // Drop the old enum type (Sequelize auto-names it)
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_scene_angles_angle_label";
    `);
  },

  async down(queryInterface) {
    // Recreate the enum type
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_scene_angles_angle_label" AS ENUM(
        'WIDE', 'CLOSET', 'VANITY', 'WINDOW', 'DOORWAY',
        'ESTABLISHING', 'ACTION', 'CLOSE', 'OVERHEAD', 'OTHER'
      );
    `);

    // Convert back — any custom labels become 'OTHER'
    await queryInterface.sequelize.query(`
      UPDATE scene_angles
      SET angle_label = 'OTHER'
      WHERE angle_label NOT IN (
        'WIDE', 'CLOSET', 'VANITY', 'WINDOW', 'DOORWAY',
        'ESTABLISHING', 'ACTION', 'CLOSE', 'OVERHEAD', 'OTHER'
      );
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE scene_angles
      ALTER COLUMN angle_label TYPE "enum_scene_angles_angle_label"
      USING angle_label::"enum_scene_angles_angle_label";
    `);
  },
};
