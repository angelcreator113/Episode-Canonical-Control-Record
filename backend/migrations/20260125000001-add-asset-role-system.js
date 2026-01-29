'use strict';

/**
 * Migration: Add Asset Role System
 * 
 * This migration implements a comprehensive role-based asset system to replace
 * hardcoded asset columns with a flexible template-driven approach.
 * 
 * Changes:
 * 1. Add asset_role, show_id, asset_scope to assets table
 * 2. Create thumbnail_templates table for template definitions
 * 3. Create composition_assets junction table for flexible asset linking
 * 4. Add template tracking fields to thumbnail_compositions
 * 5. Migrate existing data from hardcoded columns to role-based system
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('Starting asset role system migration...');
      
      // ==========================================
      // PHASE 1: ALTER ASSETS TABLE
      // ==========================================
      console.log('Phase 1: Altering assets table...');
      
      // Add asset_role column (format: CATEGORY.ROLE.VARIANT)
      await queryInterface.addColumn('assets', 'asset_role', {
        type: Sequelize.STRING(100),
        allowNull: true, // Nullable during migration
        comment: 'Role of the asset in format CATEGORY.ROLE.VARIANT (e.g., CHAR.HOST.PRIMARY, BG.MAIN)'
      }, { transaction });
      
      // Add show_id for show-scoped assets
      await queryInterface.addColumn('assets', 'show_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'shows',
          key: 'show_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Show this asset belongs to (for show-scoped assets)'
      }, { transaction });
      
      // Add asset_scope enum
      await queryInterface.addColumn('assets', 'asset_scope', {
        type: Sequelize.ENUM('GLOBAL', 'SHOW', 'EPISODE'),
        allowNull: false,
        defaultValue: 'GLOBAL',
        comment: 'Scope of asset availability'
      }, { transaction });
      
      // Add indexes for performance
      await queryInterface.addIndex('assets', ['asset_role'], {
        name: 'idx_assets_role',
        transaction
      });
      
      await queryInterface.addIndex('assets', ['show_id', 'asset_role'], {
        name: 'idx_assets_show_role',
        transaction
      });
      
      await queryInterface.addIndex('assets', ['asset_scope'], {
        name: 'idx_assets_scope',
        transaction
      });
      
      // ==========================================
      // PHASE 2: CREATE THUMBNAIL_TEMPLATES TABLE
      // ==========================================
      console.log('Phase 2: Creating thumbnail_templates table...');
      
      await queryInterface.createTable('thumbnail_templates', {
        template_id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        show_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'shows',
            key: 'show_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Show this template belongs to (null = global template)'
        },
        template_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Human-readable template name'
        },
        template_version: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: 'Version string (e.g., "1.0", "2.1")'
        },
        required_roles: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
          comment: 'Array of required asset roles (e.g., ["CHAR.HOST", "BG.MAIN"])'
        },
        optional_roles: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
          comment: 'Array of optional asset roles (e.g., ["GUEST.REACTION", "WARDROBE.ITEM"])'
        },
        layout_config: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
          comment: 'Layout configuration: dimensions, positions, layers'
        },
        format_overrides: {
          type: Sequelize.JSONB,
          allowNull: true,
          comment: 'Format-specific overrides (YOUTUBE, INSTAGRAM_FEED, etc.)'
        },
        text_layers: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
          comment: 'Text layer definitions with fonts, sizes, positions'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Whether this template version is active'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true
        }
      }, { transaction });
      
      // Add indexes
      await queryInterface.addIndex('thumbnail_templates', ['show_id', 'is_active'], {
        name: 'idx_templates_show_active',
        transaction
      });
      
      await queryInterface.addIndex('thumbnail_templates', ['template_name', 'template_version'], {
        name: 'idx_templates_name_version',
        transaction
      });
      
      // ==========================================
      // PHASE 3: CREATE COMPOSITION_ASSETS TABLE
      // ==========================================
      console.log('Phase 3: Creating composition_assets junction table...');
      
      await queryInterface.createTable('composition_assets', {
        composition_asset_id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        composition_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'thumbnail_compositions',
            key: 'composition_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        asset_role: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Role this asset fills (e.g., CHAR.HOST.PRIMARY, BG.MAIN)'
        },
        asset_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'assets',
            key: 'asset_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },
        layer_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: 'Z-index for layering (0 = bottom)'
        },
        custom_config: {
          type: Sequelize.JSONB,
          allowNull: true,
          comment: 'Custom positioning/scaling overrides for this composition'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });
      
      // Add indexes
      await queryInterface.addIndex('composition_assets', ['composition_id'], {
        name: 'idx_comp_assets_composition',
        transaction
      });
      
      await queryInterface.addIndex('composition_assets', ['asset_id'], {
        name: 'idx_comp_assets_asset',
        transaction
      });
      
      await queryInterface.addIndex('composition_assets', ['composition_id', 'asset_role'], {
        name: 'idx_comp_assets_comp_role',
        unique: true,
        transaction
      });
      
      // ==========================================
      // PHASE 4: ALTER THUMBNAIL_COMPOSITIONS TABLE
      // ==========================================
      console.log('Phase 4: Altering thumbnail_compositions table...');
      
      // Add template tracking
      await queryInterface.addColumn('thumbnail_compositions', 'template_id', {
        type: Sequelize.UUID,
        allowNull: true, // Nullable for existing compositions
        references: {
          model: 'thumbnail_templates',
          key: 'template_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Template used for this composition'
      }, { transaction });
      
      await queryInterface.addColumn('thumbnail_compositions', 'template_version', {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Frozen template version at generation time'
      }, { transaction });
      
      // Add generation tracking
      await queryInterface.addColumn('thumbnail_compositions', 'generation_status', {
        type: Sequelize.ENUM('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED'),
        allowNull: false,
        defaultValue: 'DRAFT',
        comment: 'Current generation status'
      }, { transaction });
      
      await queryInterface.addColumn('thumbnail_compositions', 'validation_errors', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of validation errors (missing required assets, etc.)'
      }, { transaction });
      
      await queryInterface.addColumn('thumbnail_compositions', 'validation_warnings', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of validation warnings (missing optional assets, etc.)'
      }, { transaction });
      
      await queryInterface.addColumn('thumbnail_compositions', 'generated_formats', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Map of format to S3 URL for generated thumbnails'
      }, { transaction });
      
      // Add index for status queries
      await queryInterface.addIndex('thumbnail_compositions', ['generation_status'], {
        name: 'idx_compositions_status',
        transaction
      });
      
      // ==========================================
      // PHASE 5: CREATE DEFAULT TEMPLATE
      // ==========================================
      console.log('Phase 5: Creating default "Styling Adventures v1" template...');
      
      const defaultTemplateId = Sequelize.literal('uuid_generate_v4()');
      
      await queryInterface.bulkInsert('thumbnail_templates', [{
        template_id: defaultTemplateId,
        show_id: null, // Global template
        template_name: 'Styling Adventures v1',
        template_version: '1.0',
        required_roles: JSON.stringify([
          'BG.MAIN',
          'CHAR.HOST.PRIMARY',
          'TEXT.TITLE.PRIMARY',
          'BRAND.SHOW.TITLE'
        ]),
        optional_roles: JSON.stringify([
          'CHAR.CO_HOST.PRIMARY',
          'GUEST.REACTION.1',
          'GUEST.REACTION.2',
          'TEXT.SUBTITLE.PRIMARY',
          'BRAND.LOGO.PRIMARY',
          'WARDROBE.ITEM.1',
          'WARDROBE.ITEM.2',
          'WARDROBE.ITEM.3',
          'WARDROBE.ITEM.4',
          'WARDROBE.ITEM.5',
          'WARDROBE.ITEM.6',
          'WARDROBE.ITEM.7',
          'WARDROBE.ITEM.8',
          'ICON.WARDROBE.1',
          'ICON.WARDROBE.2',
          'ICON.WARDROBE.3',
          'ICON.WARDROBE.4',
          'ICON.WARDROBE.5',
          'ICON.WARDROBE.6',
          'ICON.WARDROBE.7',
          'ICON.WARDROBE.8',
          'UI.WARDROBE.PANEL'
        ]),
        layout_config: JSON.stringify({
          baseWidth: 1920,
          baseHeight: 1080,
          layers: {
            'BG.MAIN': { x: 0, y: 0, width: 1920, height: 1080, zIndex: 0 },
            'CHAR.HOST.PRIMARY': { x: 100, y: 150, width: 800, height: 800, zIndex: 10 },
            'GUEST.REACTION.1': { x: 1000, y: 150, width: 400, height: 400, zIndex: 11 },
            'GUEST.REACTION.2': { x: 1450, y: 150, width: 400, height: 400, zIndex: 11 },
            'WARDROBE.ITEM.1': { x: 100, y: 750, width: 100, height: 100, zIndex: 20 },
            'WARDROBE.ITEM.2': { x: 220, y: 750, width: 100, height: 100, zIndex: 20 },
            'WARDROBE.ITEM.3': { x: 340, y: 750, width: 100, height: 100, zIndex: 20 },
            'WARDROBE.ITEM.4': { x: 460, y: 750, width: 100, height: 100, zIndex: 20 },
            'WARDROBE.ITEM.5': { x: 100, y: 870, width: 100, height: 100, zIndex: 20 },
            'WARDROBE.ITEM.6': { x: 220, y: 870, width: 100, height: 100, zIndex: 20 },
            'WARDROBE.ITEM.7': { x: 340, y: 870, width: 100, height: 100, zIndex: 20 },
            'WARDROBE.ITEM.8': { x: 460, y: 870, width: 100, height: 100, zIndex: 20 },
            'BRAND.LOGO.PRIMARY': { x: 50, y: 50, width: 150, height: 150, zIndex: 30 },
            'CHAR.CO_HOST.PRIMARY': { x: 920, y: 150, width: 600, height: 600, zIndex: 10 },
            'BRAND.SHOW.TITLE': { x: 50, y: 950, width: 400, height: 100, zIndex: 30 },
            'UI.WARDROBE.PANEL': { x: 50, y: 700, width: 550, height: 300, zIndex: 15 },
            'ICON.WARDROBE.1': { x: 110, y: 760, width: 50, height: 50, zIndex: 21 },
            'ICON.WARDROBE.2': { x: 230, y: 760, width: 50, height: 50, zIndex: 21 },
            'ICON.WARDROBE.3': { x: 350, y: 760, width: 50, height: 50, zIndex: 21 },
            'ICON.WARDROBE.4': { x: 470, y: 760, width: 50, height: 50, zIndex: 21 },
            'ICON.WARDROBE.5': { x: 110, y: 880, width: 50, height: 50, zIndex: 21 },
            'ICON.WARDROBE.6': { x: 230, y: 880, width: 50, height: 50, zIndex: 21 },
            'ICON.WARDROBE.7': { x: 350, y: 880, width: 50, height: 50, zIndex: 21 },
            'ICON.WARDROBE.8': { x: 470, y: 880, width: 50, height: 50, zIndex: 21 }
          }
        }),
        format_overrides: JSON.stringify({
          YOUTUBE: { width: 1920, height: 1080 },
          INSTAGRAM_FEED: { width: 1080, height: 1080 },
          INSTAGRAM_STORY: { width: 1080, height: 1920 },
          FACEBOOK: { width: 1200, height: 630 },
          TWITTER: { width: 1200, height: 675 }
        }),
        text_layers: JSON.stringify([
          {
            role: 'TEXT.TITLE.PRIMARY',
            fontFamily: 'Arial Black',
            fontSize: 72,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 4,
            position: { x: 100, y: 50 },
            maxWidth: 1720,
            align: 'left'
          },
          {
            role: 'TEXT.SUBTITLE.PRIMARY',
            fontFamily: 'Arial',
            fontSize: 36,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 2,
            position: { x: 100, y: 130 },
            maxWidth: 1720,
            align: 'left'
          }
        ]),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }], { transaction });
      
      // ==========================================
      // PHASE 6: MIGRATE EXISTING DATA
      // ==========================================
      console.log('Phase 6: Migrating existing composition data...');
      
      // Get all existing compositions with their asset references
      const compositions = await queryInterface.sequelize.query(
        `SELECT composition_id, episode_id, lala_asset_id, guest_asset_id, 
                justawomen_asset_id, background_frame_asset_id
         FROM thumbnail_compositions
         WHERE deleted_at IS NULL`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      
      console.log(`Found ${compositions.length} compositions to migrate`);
      
      // Get the default template ID
      const [defaultTemplate] = await queryInterface.sequelize.query(
        `SELECT template_id FROM thumbnail_templates 
         WHERE template_name = 'Styling Adventures v1' AND template_version = '1.0'`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      
      if (!defaultTemplate) {
        throw new Error('Default template not found');
      }
      
      // Migrate each composition
      for (const comp of compositions) {
        // Update composition with template reference
        await queryInterface.sequelize.query(
          `UPDATE thumbnail_compositions 
           SET template_id = :templateId, 
               template_version = '1.0',
               generation_status = 'COMPLETED'
           WHERE composition_id = :compositionId`,
          {
            replacements: {
              templateId: defaultTemplate.template_id,
              compositionId: comp.composition_id
            },
            transaction
          }
        );
        
        // Create composition_assets entries for each asset
        const compositionAssets = [];
        
        if (comp.background_frame_asset_id) {
          compositionAssets.push({
            composition_asset_id: Sequelize.literal('uuid_generate_v4()'),
            composition_id: comp.composition_id,
            asset_role: 'BG.MAIN',
            asset_id: comp.background_frame_asset_id,
            layer_order: 0,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
        
        if (comp.lala_asset_id) {
          compositionAssets.push({
            composition_asset_id: Sequelize.literal('uuid_generate_v4()'),
            composition_id: comp.composition_id,
            asset_role: 'CHAR.HOST.PRIMARY',
            asset_id: comp.lala_asset_id,
            layer_order: 10,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
        
        if (comp.guest_asset_id) {
          compositionAssets.push({
            composition_asset_id: Sequelize.literal('uuid_generate_v4()'),
            composition_id: comp.composition_id,
            asset_role: 'GUEST.REACTION.1',
            asset_id: comp.guest_asset_id,
            layer_order: 11,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
        
        if (comp.justawomen_asset_id) {
          compositionAssets.push({
            composition_asset_id: Sequelize.literal('uuid_generate_v4()'),
            composition_id: comp.composition_id,
            asset_role: 'BRAND.LOGO.PRIMARY',
            asset_id: comp.justawomen_asset_id,
            layer_order: 30,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
        
        if (compositionAssets.length > 0) {
          await queryInterface.bulkInsert('composition_assets', compositionAssets, { transaction });
        }
      }
      
      console.log(`Migrated ${compositions.length} compositions to role-based system`);
      
      // ==========================================
      // PHASE 7: UPDATE EXISTING ASSETS
      // ==========================================
      console.log('Phase 7: Updating existing assets with roles...');
      
      // Update LaLa assets
      await queryInterface.sequelize.query(
        `UPDATE assets 
         SET asset_role = 'CHAR.HOST.PRIMARY', 
             asset_scope = 'GLOBAL'
         WHERE asset_group = 'LALA' AND deleted_at IS NULL`,
        { transaction }
      );
      
      // Update background assets
      await queryInterface.sequelize.query(
        `UPDATE assets 
         SET asset_role = 'BG.MAIN', 
             asset_scope = 'GLOBAL'
         WHERE asset_type = 'background' AND deleted_at IS NULL`,
        { transaction }
      );
      
      // Update guest assets
      await queryInterface.sequelize.query(
        `UPDATE assets 
         SET asset_role = 'GUEST.REACTION.1', 
             asset_scope = 'EPISODE'
         WHERE asset_group = 'GUEST' AND deleted_at IS NULL`,
        { transaction }
      );
      
      // Update brand logo assets
      await queryInterface.sequelize.query(
        `UPDATE assets 
         SET asset_role = 'BRAND.LOGO.PRIMARY', 
             asset_scope = 'GLOBAL'
         WHERE asset_group = 'SHOW' AND purpose LIKE '%logo%' AND deleted_at IS NULL`,
        { transaction }
      );
      
      // Update wardrobe assets
      await queryInterface.sequelize.query(
        `UPDATE assets 
         SET asset_role = 'WARDROBE.ITEM.1', 
             asset_scope = 'EPISODE'
         WHERE asset_group = 'WARDROBE' AND deleted_at IS NULL`,
        { transaction }
      );
      
      console.log('Asset roles updated');
      
      await transaction.commit();
      console.log('✅ Asset role system migration completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('Rolling back asset role system migration...');
      
      // Remove columns from thumbnail_compositions
      await queryInterface.removeColumn('thumbnail_compositions', 'generated_formats', { transaction });
      await queryInterface.removeColumn('thumbnail_compositions', 'validation_warnings', { transaction });
      await queryInterface.removeColumn('thumbnail_compositions', 'validation_errors', { transaction });
      await queryInterface.removeColumn('thumbnail_compositions', 'generation_status', { transaction });
      await queryInterface.removeColumn('thumbnail_compositions', 'template_version', { transaction });
      await queryInterface.removeColumn('thumbnail_compositions', 'template_id', { transaction });
      
      // Drop composition_assets table
      await queryInterface.dropTable('composition_assets', { transaction });
      
      // Drop thumbnail_templates table
      await queryInterface.dropTable('thumbnail_templates', { transaction });
      
      // Remove columns from assets
      await queryInterface.removeIndex('assets', 'idx_assets_scope', { transaction });
      await queryInterface.removeIndex('assets', 'idx_assets_show_role', { transaction });
      await queryInterface.removeIndex('assets', 'idx_assets_role', { transaction });
      
      await queryInterface.removeColumn('assets', 'asset_scope', { transaction });
      await queryInterface.removeColumn('assets', 'show_id', { transaction });
      await queryInterface.removeColumn('assets', 'asset_role', { transaction });
      
      // Drop enums
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_assets_asset_scope', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_thumbnail_compositions_generation_status', { transaction });
      
      await transaction.commit();
      console.log('✅ Rollback completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
