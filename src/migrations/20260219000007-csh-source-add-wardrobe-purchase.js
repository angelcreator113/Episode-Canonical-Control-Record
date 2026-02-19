'use strict';

/**
 * Add 'wardrobe_purchase' to character_state_history.source ENUM
 *
 * The purchase route logs wardrobe purchases with source = 'wardrobe_purchase',
 * but the original ENUM only had ('computed', 'override', 'manual').
 */
module.exports = {
  async up(queryInterface) {
    // PostgreSQL: add a new value to an existing ENUM type
    // The type name for a Sequelize-created ENUM on column "source" is "enum_character_state_history_source"
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'wardrobe_purchase'
          AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'enum_character_state_history_source'
          )
        ) THEN
          ALTER TYPE "enum_character_state_history_source" ADD VALUE 'wardrobe_purchase';
        END IF;
      END
      $$;
    `);
  },

  async down() {
    // Removing ENUM values in PostgreSQL requires recreating the type — skip for safety
  },
};
