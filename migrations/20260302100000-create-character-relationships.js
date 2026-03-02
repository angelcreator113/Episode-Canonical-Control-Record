'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the old character_relationships table (different schema — string-based names/layers)
    // and recreate with proper FK-referenced UUID schema
    await queryInterface.dropTable('character_relationships').catch(() => {});

    await queryInterface.createTable('character_relationships', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      character_id_a: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      character_id_b: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      // Freeform — 'sister', 'stylist', 'brand contact', etc.
      relationship_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      // IRL | Online Only | Passing | Professional | One-sided
      connection_mode: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'IRL',
      },
      // none | knows_lala | through_justwoman | interacts_content | unaware
      lala_connection: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'none',
      },
      // Active | Past | One-sided | Complicated
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'Active',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('character_relationships', ['character_id_a'], {
      name: 'idx_char_rel_a',
    });
    await queryInterface.addIndex('character_relationships', ['character_id_b'], {
      name: 'idx_char_rel_b',
    });
    await queryInterface.addIndex(
      'character_relationships',
      ['character_id_a', 'character_id_b'],
      { name: 'idx_char_rel_pair' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('character_relationships');
  },
};
