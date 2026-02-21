/**
 * Migration: Character Registry tables
 * 
 * character_registries — A named registry (e.g. "Book 1 · Before Lala")
 * registry_characters  — Individual characters within a registry
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── ENUM types ──
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_registry_characters_role_type') THEN
          CREATE TYPE "enum_registry_characters_role_type" AS ENUM(
            'protagonist','pressure','mirror','support','shadow','special'
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_registry_characters_appearance_mode') THEN
          CREATE TYPE "enum_registry_characters_appearance_mode" AS ENUM(
            'on_page','composite','observed','invisible','brief'
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_registry_characters_status') THEN
          CREATE TYPE "enum_registry_characters_status" AS ENUM(
            'draft','accepted','declined','finalized'
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_character_registries_status') THEN
          CREATE TYPE "enum_character_registries_status" AS ENUM(
            'draft','active','locked'
          );
        END IF;
      END $$;
    `);

    // ── character_registries ──
    await queryInterface.createTable('character_registries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      show_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'shows', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      book_tag: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'e.g. "Book 1 · Before Lala"',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      core_rule: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Guiding principle displayed at bottom of overview',
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'locked'),
        defaultValue: 'draft',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // ── registry_characters ──
    await queryInterface.createTable('registry_characters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      registry_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'character_registries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      character_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Slug-style key, e.g. "husband", "witness"',
      },
      icon: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Emoji icon, e.g. 🔥',
      },
      display_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'e.g. "The Husband"',
      },
      subtitle: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'e.g. "The Husband" under selected name',
      },
      role_type: {
        type: Sequelize.ENUM('protagonist', 'pressure', 'mirror', 'support', 'shadow', 'special'),
        defaultValue: 'pressure',
      },
      role_label: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'e.g. "Pressure Character · Private Marriage Thread"',
      },
      appearance_mode: {
        type: Sequelize.ENUM('on_page', 'composite', 'observed', 'invisible', 'brief'),
        defaultValue: 'on_page',
      },
      status: {
        type: Sequelize.ENUM('draft', 'accepted', 'declined', 'finalized'),
        defaultValue: 'draft',
      },
      core_belief: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      pressure_type: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      pressure_quote: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'The belief pill quote',
      },
      personality: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      job_options: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Page header description paragraph',
      },
      name_options: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of name strings to choose from',
      },
      selected_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      personality_matrix: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of {dimension, value} rows',
      },
      extra_fields: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Flexible additional fields (e.g. Algorithm craft note)',
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // ── Indexes ──
    await queryInterface.addIndex('character_registries', ['show_id']);
    await queryInterface.addIndex('character_registries', ['status']);
    await queryInterface.addIndex('registry_characters', ['registry_id', 'sort_order']);
    await queryInterface.addIndex('registry_characters', ['registry_id', 'character_key'], { unique: true });
    await queryInterface.addIndex('registry_characters', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('registry_characters');
    await queryInterface.dropTable('character_registries');
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_registry_characters_role_type";
      DROP TYPE IF EXISTS "enum_registry_characters_appearance_mode";
      DROP TYPE IF EXISTS "enum_registry_characters_status";
      DROP TYPE IF EXISTS "enum_character_registries_status";
    `);
  },
};
