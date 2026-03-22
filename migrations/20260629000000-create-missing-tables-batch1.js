'use strict';

/**
 * Migration: Create missing tables — batch 1
 *
 * Tables: show_configs, script_suggestions, script_edit_history,
 *         asset_roles, asset_usage_log, layer_presets
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ── show_configs ─────────────────────────────────────────────────
      await queryInterface.createTable('show_configs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        show_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'shows', key: 'id' },
          onDelete: 'CASCADE',
        },
        config_key: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        config_value: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('show_configs', ['show_id'],
        { name: 'idx_show_configs_show_id', transaction });
      await queryInterface.addIndex('show_configs', ['show_id', 'config_key'],
        { unique: true, name: 'idx_show_configs_show_key', transaction });

      // ── script_suggestions ───────────────────────────────────────────
      await queryInterface.createTable('script_suggestions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        script_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        suggestion_text: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      // ── script_edit_history ──────────────────────────────────────────
      await queryInterface.createTable('script_edit_history', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        script_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        edit_data: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      // ── asset_roles ──────────────────────────────────────────────────
      await queryInterface.createTable('asset_roles', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        show_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'shows', key: 'id' },
          onDelete: 'SET NULL',
        },
        role_key: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        role_label: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        category: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        icon: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        color: {
          type: Sequelize.STRING(20),
          allowNull: true,
        },
        is_required: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('asset_roles', ['show_id', 'role_key'],
        { unique: true, name: 'idx_asset_roles_show_key', transaction });
      await queryInterface.addIndex('asset_roles', ['show_id'],
        { name: 'idx_asset_roles_show_id', transaction });
      await queryInterface.addIndex('asset_roles', ['role_key'],
        { name: 'idx_asset_roles_role_key', transaction });

      // ── asset_usage_log ──────────────────────────────────────────────
      await queryInterface.createTable('asset_usage_log', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        asset_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'assets', key: 'id' },
          onDelete: 'CASCADE',
        },
        episode_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'episodes', key: 'id' },
          onDelete: 'CASCADE',
        },
        scene_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'scenes', key: 'id' },
          onDelete: 'CASCADE',
        },
        context: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        used_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      }, { transaction });

      await queryInterface.addIndex('asset_usage_log', ['asset_id'],
        { name: 'idx_asset_usage_asset', transaction });
      await queryInterface.addIndex('asset_usage_log', ['episode_id'],
        { name: 'idx_asset_usage_episode', transaction });
      await queryInterface.addIndex('asset_usage_log', ['scene_id'],
        { name: 'idx_asset_usage_scene', transaction });

      // ── layer_presets ────────────────────────────────────────────────
      await queryInterface.createTable('layer_presets', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        category: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        layer_template: {
          type: Sequelize.JSONB,
          allowNull: false,
        },
        placeholders: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        preview_url: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        is_system_preset: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        times_used: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        created_by: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      }, { transaction });

      await transaction.commit();
      console.log('✓ Created: show_configs, script_suggestions, script_edit_history, asset_roles, asset_usage_log, layer_presets');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('layer_presets', { transaction });
      await queryInterface.dropTable('asset_usage_log', { transaction });
      await queryInterface.dropTable('asset_roles', { transaction });
      await queryInterface.dropTable('script_edit_history', { transaction });
      await queryInterface.dropTable('script_suggestions', { transaction });
      await queryInterface.dropTable('show_configs', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
