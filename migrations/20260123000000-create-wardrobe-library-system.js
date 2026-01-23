/**
 * Migration: Create Wardrobe Library System
 * Creates the core wardrobe library tables and indexes
 */

exports.up = (pgm) => {
  // 1. Create wardrobe_library table
  pgm.createTable('wardrobe_library', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    // Basic Info
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'item or set',
    },
    // Item Classification (for type=item)
    item_type: {
      type: 'varchar(100)',
      comment: 'top, bottom, dress, shoes, accessory, etc.',
    },
    // Storage
    image_url: {
      type: 'text',
      notNull: true,
    },
    thumbnail_url: {
      type: 'text',
    },
    s3_key: {
      type: 'varchar(500)',
    },
    // Metadata (optional, can be overridden per episode)
    default_character: {
      type: 'varchar(255)',
    },
    default_occasion: {
      type: 'varchar(255)',
    },
    default_season: {
      type: 'varchar(100)',
    },
    color: {
      type: 'varchar(100)',
    },
    tags: {
      type: 'jsonb',
      default: '[]',
    },
    // External References
    website: {
      type: 'text',
    },
    price: {
      type: 'decimal(10,2)',
    },
    vendor: {
      type: 'varchar(255)',
    },
    // Show Association (optional - NULL means cross-show)
    show_id: {
      type: 'integer',
      references: 'shows',
      onDelete: 'SET NULL',
    },
    // Usage Tracking
    total_usage_count: {
      type: 'integer',
      default: 0,
    },
    last_used_at: {
      type: 'timestamp',
    },
    view_count: {
      type: 'integer',
      default: 0,
    },
    selection_count: {
      type: 'integer',
      default: 0,
    },
    // Audit
    created_by: {
      type: 'varchar(255)',
    },
    updated_by: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    deleted_at: {
      type: 'timestamp',
    },
  });

  // Indexes for wardrobe_library
  pgm.createIndex('wardrobe_library', 'type', { name: 'idx_wardrobe_library_type' });
  pgm.createIndex('wardrobe_library', 'item_type', { name: 'idx_wardrobe_library_item_type' });
  pgm.createIndex('wardrobe_library', 'show_id', { name: 'idx_wardrobe_library_show_id' });
  pgm.createIndex('wardrobe_library', 'deleted_at', { name: 'idx_wardrobe_library_deleted_at' });
  pgm.createIndex('wardrobe_library', 'color', { name: 'idx_wardrobe_library_color' });
  pgm.createIndex('wardrobe_library', 'tags', {
    name: 'idx_wardrobe_library_tags',
    method: 'gin',
  });

  // Full-text search index
  pgm.sql(`
    CREATE INDEX idx_wardrobe_library_search 
    ON wardrobe_library 
    USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')))
  `);

  // 2. Create outfit_set_items table
  pgm.createTable('outfit_set_items', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    // References
    outfit_set_id: {
      type: 'integer',
      notNull: true,
      references: 'wardrobe_library',
      onDelete: 'CASCADE',
    },
    wardrobe_item_id: {
      type: 'integer',
      notNull: true,
      references: 'wardrobe_library',
      onDelete: 'CASCADE',
    },
    // Order and organization
    position: {
      type: 'integer',
      default: 0,
    },
    layer: {
      type: 'varchar(50)',
      comment: 'base, mid, outer, accessory',
    },
    is_optional: {
      type: 'boolean',
      default: false,
    },
    // Metadata
    notes: {
      type: 'text',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Unique constraint and indexes for outfit_set_items
  pgm.addConstraint('outfit_set_items', 'outfit_set_items_unique', {
    unique: ['outfit_set_id', 'wardrobe_item_id'],
  });
  pgm.createIndex('outfit_set_items', 'outfit_set_id', { name: 'idx_outfit_set_items_set' });
  pgm.createIndex('outfit_set_items', 'wardrobe_item_id', { name: 'idx_outfit_set_items_item' });

  // 3. Create wardrobe_usage_history table
  pgm.createTable('wardrobe_usage_history', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    // References
    library_item_id: {
      type: 'integer',
      notNull: true,
      references: 'wardrobe_library',
      onDelete: 'CASCADE',
    },
    episode_id: {
      type: 'uuid',
      references: 'episodes',
      onDelete: 'SET NULL',
    },
    scene_id: {
      type: 'uuid',
      references: 'scenes',
      onDelete: 'SET NULL',
    },
    show_id: {
      type: 'uuid',
      references: 'shows',
      onDelete: 'SET NULL',
    },
    // Usage details
    usage_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'assigned, viewed, selected, approved, rejected, removed',
    },
    character: {
      type: 'varchar(255)',
    },
    occasion: {
      type: 'varchar(255)',
    },
    // Metadata
    user_id: {
      type: 'varchar(255)',
    },
    notes: {
      type: 'text',
    },
    metadata: {
      type: 'jsonb',
      default: '{}',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Indexes for wardrobe_usage_history
  pgm.createIndex('wardrobe_usage_history', 'library_item_id', {
    name: 'idx_usage_history_library_item',
  });
  pgm.createIndex('wardrobe_usage_history', 'episode_id', {
    name: 'idx_usage_history_episode',
  });
  pgm.createIndex('wardrobe_usage_history', 'show_id', { name: 'idx_usage_history_show' });
  pgm.createIndex('wardrobe_usage_history', 'usage_type', { name: 'idx_usage_history_type' });
  pgm.createIndex('wardrobe_usage_history', ['created_at'], {
    name: 'idx_usage_history_created_at',
    method: 'btree',
  });

  // 4. Create wardrobe_library_references table
  pgm.createTable('wardrobe_library_references', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    library_item_id: {
      type: 'integer',
      notNull: true,
      references: 'wardrobe_library',
      onDelete: 'CASCADE',
    },
    s3_key: {
      type: 'varchar(500)',
      notNull: true,
    },
    reference_count: {
      type: 'integer',
      default: 1,
    },
    file_size: {
      type: 'bigint',
    },
    content_type: {
      type: 'varchar(100)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Unique constraint and indexes for wardrobe_library_references
  pgm.addConstraint('wardrobe_library_references', 'unique_library_s3_key', {
    unique: ['library_item_id', 's3_key'],
  });
  pgm.createIndex('wardrobe_library_references', 's3_key', {
    name: 'idx_library_references_s3_key',
  });
};

exports.down = (pgm) => {
  // Drop tables in reverse order (respecting foreign keys)
  pgm.dropTable('wardrobe_library_references', { ifExists: true, cascade: true });
  pgm.dropTable('wardrobe_usage_history', { ifExists: true, cascade: true });
  pgm.dropTable('outfit_set_items', { ifExists: true, cascade: true });
  pgm.dropTable('wardrobe_library', { ifExists: true, cascade: true });
};
