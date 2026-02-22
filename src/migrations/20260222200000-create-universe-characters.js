'use strict';

/**
 * Migration: create universe_characters table
 * Stores characters promoted to LalaVerse universe level from registries.
 * Location: src/migrations/20260222200000-create-universe-characters.js
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('universe_characters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      universe_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'universes', key: 'id' },
        onDelete: 'CASCADE',
      },
      registry_character_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Links back to the registry character that was promoted',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Canonical name at universe level',
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'pressure | mirror | support | shadow | special | protagonist',
      },
      canon_tier: {
        type: Sequelize.STRING(50),
        defaultValue: 'supporting_canon',
        comment: 'core_canon | supporting_canon | minor_canon',
      },
      role: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Universe-level role description',
      },
      first_appeared: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this character first appeared in canon',
      },
      first_book_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'First book this character appeared in',
      },
      first_show_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'First show this character appeared in',
      },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'active',
        comment: 'active | evolving | archived',
      },
      portrait_url: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'S3 URL for 2D/3D character portrait',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes
    await queryInterface.addIndex('universe_characters', ['universe_id'], {
      name: 'universe_characters_universe_id_idx',
    });
    await queryInterface.addIndex('universe_characters', ['registry_character_id'], {
      name: 'universe_characters_registry_character_id_idx',
    });
    await queryInterface.addIndex('universe_characters', ['canon_tier'], {
      name: 'universe_characters_canon_tier_idx',
    });
    // Prevent duplicate promotion
    await queryInterface.addIndex(
      'universe_characters',
      ['universe_id', 'registry_character_id'],
      {
        name: 'universe_characters_unique_promotion',
        unique: true,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('universe_characters');
  },
};
