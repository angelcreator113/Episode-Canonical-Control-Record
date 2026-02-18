'use strict';

/**
 * Fix: Allow NULL for episode_number column
 * 
 * The Episode model defines episode_number as allowNull: true,
 * but the database has a NOT NULL constraint from the original
 * sequelize.sync() that created the table.
 * 
 * This causes "null value in column episode_number violates not-null constraint"
 * when creating episodes without an episode number.
 */
module.exports = {
  async up(queryInterface) {
    // Allow NULL for episode_number (matches model definition)
    await queryInterface.sequelize.query(`
      ALTER TABLE episodes ALTER COLUMN episode_number DROP NOT NULL
    `);
  },

  async down(queryInterface) {
    // Restore NOT NULL (set any NULLs to 0 first)
    await queryInterface.sequelize.query(`
      UPDATE episodes SET episode_number = 0 WHERE episode_number IS NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE episodes ALTER COLUMN episode_number SET NOT NULL
    `);
  },
};
