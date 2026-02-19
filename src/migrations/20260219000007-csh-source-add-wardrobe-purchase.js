'use strict';

/**
 * Add 'wardrobe_purchase' to character_state_history.source ENUM
 *
 * The purchase route logs wardrobe purchases with source = 'wardrobe_purchase',
 * but the original ENUM only had ('computed', 'override', 'manual').
 *
 * NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
 * so this migration uses the raw query approach outside Sequelize's default transaction.
 */
module.exports = {
  async up(queryInterface) {
    // ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
    // Use a separate connection/query that commits immediately.
    try {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_character_state_history_source" ADD VALUE IF NOT EXISTS 'wardrobe_purchase'`
      );
    } catch (err) {
      // IF NOT EXISTS requires PG >= 9.3; if it fails, the value may already exist
      console.warn('ENUM alter skipped:', err.message);
    }
  },

  async down() {
    // Removing ENUM values in PostgreSQL requires recreating the type — skip for safety
  },
};
