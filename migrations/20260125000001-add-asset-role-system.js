/**
 * Migration: Add Asset Role System
 * 
 * Implements a comprehensive role-based asset system to replace
 * hardcoded asset columns with a flexible template-driven approach.
 */

exports.up = (pgm) => {
  console.log('Starting asset role system migration...');
  
  // ==========================================
  // PHASE 1: ALTER ASSETS TABLE
  // ==========================================
  console.log('Phase 1: Altering assets table...');
  
  // Add asset_role column
  pgm.addColumn('assets', {
    asset_role: {
      type: 'varchar(100)',
      comment: 'Role-based identifier (e.g., CHAR.HOST.PRIMARY, BG.MAIN)',
    },
  });
  
  // Add show_id for show-scoped assets
  pgm.addColumn('assets', {
    show_id: {
      type: 'uuid',
      references: 'shows',
      onDelete: 'CASCADE',
    },
  });
  
  // Add episode_id for episode-scoped assets
  pgm.addColumn('assets', {
    episode_id: {
      type: 'uuid',
      references: 'episodes',
      onDelete: 'CASCADE',
    },
  });
  
  // Add asset_scope enum
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_scope_enum') THEN
        CREATE TYPE asset_scope_enum AS ENUM ('GLOBAL', 'SHOW', 'EPISODE');
      END IF;
    END $$;
  `);
  
  pgm.addColumn('assets', {
    asset_scope: {
      type: 'asset_scope_enum',
      default: 'GLOBAL',
      notNull: true,
    },
  });
  
  // Create indexes for asset queries
  pgm.createIndex('assets', 'asset_role', { name: 'idx_assets_role' });
  pgm.createIndex('assets', 'show_id', { name: 'idx_assets_show' });
  pgm.createIndex('assets', 'episode_id', { name: 'idx_assets_episode' });
  pgm.createIndex('assets', ['asset_role', 'asset_scope'], { name: 'idx_assets_role_scope' });
  
  // ==========================================
  // PHASE 2: CREATE THUMBNAIL_TEMPLATES TABLE
  // ==========================================
  console.log('Phase 2: Creating thumbnail_templates table...');
  
  pgm.createTable('thumbnail_templates', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    show_id: {
      type: 'uuid',
      references: 'shows',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    version: { type: 'integer', notNull: true, default: 1 },
    is_active: { type: 'boolean', notNull: true, default: true },
    required_roles: { type: 'jsonb', notNull: true, default: '[]' },
    optional_roles: { type: 'jsonb', notNull: true, default: '[]' },
    conditional_roles: { type: 'jsonb', default: '{}' },
    paired_roles: { type: 'jsonb', default: '{}' },
    layout_config: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });
  
  // Indexes for template queries
  pgm.createIndex('thumbnail_templates', 'show_id', { name: 'idx_templates_show' });
  pgm.createIndex('thumbnail_templates', ['show_id', 'is_active'], { name: 'idx_templates_show_active' });
  pgm.createIndex('thumbnail_templates', ['show_id', 'version'], { name: 'idx_templates_show_version' });
  
  // ==========================================
  // PHASE 2.5: CREATE THUMBNAIL_COMPOSITIONS TABLE
  // ==========================================
  console.log('Phase 2.5: Creating thumbnail_compositions table...');
  
  pgm.createTable('thumbnail_compositions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    episode_id: {
      type: 'uuid',
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    template_id: {
      type: 'uuid',
      references: 'thumbnail_templates',
      onDelete: 'SET NULL',
    },
    name: { type: 'varchar(255)' },
    description: { type: 'text' },
    status: { type: 'varchar(50)', default: 'draft' },
    created_by: { type: 'varchar(255)' },
    template_version: {
      type: 'integer',
      comment: 'Frozen version of template used',
    },
    frozen_layout_config: {
      type: 'jsonb',
      comment: 'Snapshot of layout at creation time',
    },
    frozen_required_roles: {
      type: 'jsonb',
      comment: 'Snapshot of required roles at creation time',
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });
  
  // ==========================================
  // PHASE 3: CREATE COMPOSITION_ASSETS TABLE
  // ==========================================
  console.log('Phase 3: Creating composition_assets junction table...');
  
  pgm.createTable('composition_assets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    composition_id: {
      type: 'uuid',
      notNull: true,
      references: 'thumbnail_compositions',
      onDelete: 'CASCADE',
    },
    asset_id: {
      type: 'uuid',
      notNull: true,
      references: 'assets',
      onDelete: 'CASCADE',
    },
    asset_role: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Role in this composition (e.g., CHAR.HOST.PRIMARY)',
    },
    role_category: {
      type: 'varchar(50)',
      comment: 'Parsed from role (e.g., CHAR)',
    },
    role_name: {
      type: 'varchar(50)',
      comment: 'Parsed from role (e.g., HOST)',
    },
    role_variant: {
      type: 'varchar(50)',
      comment: 'Parsed from role (e.g., PRIMARY)',
    },
    layer_order: {
      type: 'integer',
      default: 0,
    },
    transform: { type: 'jsonb', default: '{}' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });
  
  // Indexes for junction table
  pgm.createIndex('composition_assets', 'composition_id', { name: 'idx_comp_assets_comp' });
  pgm.createIndex('composition_assets', 'asset_id', { name: 'idx_comp_assets_asset' });
  pgm.createIndex('composition_assets', 'asset_role', { name: 'idx_comp_assets_role' });
  pgm.createIndex('composition_assets', ['composition_id', 'asset_role'], { 
    name: 'idx_comp_assets_comp_role',
    unique: true 
  });
  
  // ==========================================
  // PHASE 4: INSERT DEFAULT TEMPLATE
  // ==========================================
  console.log('Phase 4: Creating default template...');
  
  const defaultTemplate = {
    name: 'Styling Adventures v1',
    description: 'Standard template for Styling Adventures episodes with role-based asset system',
    version: 1,
    is_active: true,
    required_roles: JSON.stringify([
      'BG.MAIN',
      'CHAR.HOST.PRIMARY',
      'TEXT.TITLE.PRIMARY',
      'BRAND.SHOW.TITLE'
    ]),
    optional_roles: JSON.stringify([
      'CHAR.CO_HOST.PRIMARY',
      'CHAR.HOST.SECONDARY',
      'TEXT.TITLE.SECONDARY',
      'TEXT.SUBTITLE',
      'TEXT.EPISODE_NUMBER',
      'BG.SECONDARY',
      'BG.OVERLAY',
      'GUEST.REACTION.1',
      'GUEST.REACTION.2',
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
    conditional_roles: JSON.stringify({
      'UI.WARDROBE.PANEL': {
        required_if: [
          'WARDROBE.ITEM.1', 'WARDROBE.ITEM.2', 'WARDROBE.ITEM.3', 'WARDROBE.ITEM.4',
          'WARDROBE.ITEM.5', 'WARDROBE.ITEM.6', 'WARDROBE.ITEM.7', 'WARDROBE.ITEM.8'
        ]
      }
    }),
    paired_roles: JSON.stringify({
      'WARDROBE.ITEM.1': 'ICON.WARDROBE.1',
      'WARDROBE.ITEM.2': 'ICON.WARDROBE.2',
      'WARDROBE.ITEM.3': 'ICON.WARDROBE.3',
      'WARDROBE.ITEM.4': 'ICON.WARDROBE.4',
      'WARDROBE.ITEM.5': 'ICON.WARDROBE.5',
      'WARDROBE.ITEM.6': 'ICON.WARDROBE.6',
      'WARDROBE.ITEM.7': 'ICON.WARDROBE.7',
      'WARDROBE.ITEM.8': 'ICON.WARDROBE.8'
    }),
    layout_config: JSON.stringify({
      canvas: { width: 1280, height: 720 },
      layers: {
        'BG.MAIN': { x: 0, y: 0, width: 1280, height: 720, zIndex: 0 },
        'BG.SECONDARY': { x: 0, y: 0, width: 1280, height: 720, zIndex: 1 },
        'BG.OVERLAY': { x: 0, y: 0, width: 1280, height: 720, zIndex: 2 },
        'CHAR.HOST.PRIMARY': { x: 50, y: 150, width: 400, height: 720, zIndex: 10 },
        'CHAR.HOST.SECONDARY': { x: 100, y: 150, width: 350, height: 650, zIndex: 9 },
        'CHAR.CO_HOST.PRIMARY': { x: 920, y: 150, width: 320, height: 720, zIndex: 10 },
        'GUEST.REACTION.1': { x: 920, y: 50, width: 300, height: 300, zIndex: 8 },
        'GUEST.REACTION.2': { x: 920, y: 380, width: 300, height: 300, zIndex: 8 },
        'TEXT.TITLE.PRIMARY': { x: 50, y: 50, width: 880, height: 100, zIndex: 20 },
        'TEXT.TITLE.SECONDARY': { x: 50, y: 70, width: 850, height: 90, zIndex: 19 },
        'TEXT.SUBTITLE': { x: 50, y: 150, width: 800, height: 60, zIndex: 19 },
        'TEXT.EPISODE_NUMBER': { x: 1150, y: 50, width: 100, height: 50, zIndex: 21 },
        'BRAND.SHOW.TITLE': { x: 50, y: 950, width: 880, height: 80, zIndex: 25 },
        'UI.WARDROBE.PANEL': { x: 670, y: 700, width: 550, height: 300, zIndex: 15 },
        'ICON.WARDROBE.1': { x: 700, y: 980, width: 60, height: 60, zIndex: 16 },
        'ICON.WARDROBE.2': { x: 770, y: 980, width: 60, height: 60, zIndex: 16 },
        'ICON.WARDROBE.3': { x: 840, y: 980, width: 60, height: 60, zIndex: 16 },
        'ICON.WARDROBE.4': { x: 910, y: 980, width: 60, height: 60, zIndex: 16 },
        'ICON.WARDROBE.5': { x: 980, y: 980, width: 60, height: 60, zIndex: 16 },
        'ICON.WARDROBE.6': { x: 1050, y: 980, width: 60, height: 60, zIndex: 16 },
        'ICON.WARDROBE.7': { x: 1120, y: 980, width: 60, height: 60, zIndex: 16 },
        'ICON.WARDROBE.8': { x: 1190, y: 980, width: 60, height: 60, zIndex: 16 },
        'WARDROBE.ITEM.1': { x: 700, y: 750, width: 60, height: 80, zIndex: 14 },
        'WARDROBE.ITEM.2': { x: 770, y: 750, width: 60, height: 80, zIndex: 14 },
        'WARDROBE.ITEM.3': { x: 840, y: 750, width: 60, height: 80, zIndex: 14 },
        'WARDROBE.ITEM.4': { x: 910, y: 750, width: 60, height: 80, zIndex: 14 },
        'WARDROBE.ITEM.5': { x: 980, y: 750, width: 60, height: 80, zIndex: 14 },
        'WARDROBE.ITEM.6': { x: 1050, y: 750, width: 60, height: 80, zIndex: 14 },
        'WARDROBE.ITEM.7': { x: 1120, y: 750, width: 60, height: 80, zIndex: 14 },
        'WARDROBE.ITEM.8': { x: 1190, y: 750, width: 60, height: 80, zIndex: 14 }
      }
    })
  };
  
  pgm.sql(`
    INSERT INTO thumbnail_templates (
      name, description, version, is_active,
      required_roles, optional_roles, conditional_roles, paired_roles,
      layout_config
    ) VALUES (
      '${defaultTemplate.name}',
      '${defaultTemplate.description}',
      ${defaultTemplate.version},
      ${defaultTemplate.is_active},
      '${defaultTemplate.required_roles}'::jsonb,
      '${defaultTemplate.optional_roles}'::jsonb,
      '${defaultTemplate.conditional_roles}'::jsonb,
      '${defaultTemplate.paired_roles}'::jsonb,
      '${defaultTemplate.layout_config}'::jsonb
    );
  `);
  
  console.log('✅ Asset role system migration completed successfully!');
};

exports.down = (pgm) => {
  console.log('Rolling back asset role system migration...');
  
  // Drop tables in reverse order
  pgm.dropTable('composition_assets');
  pgm.dropTable('thumbnail_compositions');
  pgm.dropTable('thumbnail_templates');
  
  // Remove indexes from assets
  pgm.dropIndex('assets', 'asset_role', { name: 'idx_assets_role' });
  pgm.dropIndex('assets', 'show_id', { name: 'idx_assets_show' });
  pgm.dropIndex('assets', 'episode_id', { name: 'idx_assets_episode' });
  pgm.dropIndex('assets', ['asset_role', 'asset_scope'], { name: 'idx_assets_role_scope' });
  
  // Remove columns from assets
  pgm.dropColumn('assets', 'asset_role');
  pgm.dropColumn('assets', 'show_id');
  pgm.dropColumn('assets', 'episode_id');
  pgm.dropColumn('assets', 'asset_scope');
  
  // Drop enum type
  pgm.sql('DROP TYPE IF EXISTS asset_scope_enum;');
  
  console.log('✅ Rollback completed');
};
