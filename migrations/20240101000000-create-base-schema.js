/**
 * Base Migration: Create core schema
 * Creates Episodes, ThumbnailCompositions, and related tables
 */

exports.up = (pgm) => {
  // Create Episodes table
  pgm.createTable('episodes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    episode_number: {
      type: 'integer',
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    air_date: {
      type: 'date',
    },
    status: {
      type: 'varchar(50)',
      default: 'draft',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    deleted_at: {
      type: 'timestamp',
    },
  });

  // Create ThumbnailTemplate table
  pgm.createTable('thumbnail_templates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    layout_config: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Create Assets table
  pgm.createTable('assets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    asset_type: {
      type: 'varchar(100)',
    },
    s3_key: {
      type: 'varchar(500)',
      unique: true,
    },
    url: {
      type: 'varchar(500)',
    },
    metadata: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Create ThumbnailComposition table
  pgm.createTable('thumbnail_compositions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: { name: 'episodes', field: 'id' },
      onDelete: 'CASCADE',
    },
    template_id: {
      type: 'uuid',
      references: { name: 'thumbnail_templates', field: 'id' },
      onDelete: 'SET NULL',
    },
    name: {
      type: 'varchar(255)',
    },
    description: {
      type: 'text',
    },
    background_frame_asset_id: {
      type: 'uuid',
      references: { name: 'assets', field: 'id' },
      onDelete: 'SET NULL',
    },
    lala_asset_id: {
      type: 'uuid',
      references: { name: 'assets', field: 'id' },
      onDelete: 'SET NULL',
    },
    guest_asset_id: {
      type: 'uuid',
      references: { name: 'assets', field: 'id' },
      onDelete: 'SET NULL',
    },
    justawomen_asset_id: {
      type: 'uuid',
      references: { name: 'assets', field: 'id' },
      onDelete: 'SET NULL',
    },
    selected_formats: {
      type: 'jsonb',
      default: '[]',
    },
    status: {
      type: 'varchar(50)',
      default: 'draft',
    },
    created_by: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Create Thumbnails table
  pgm.createTable('thumbnails', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    episode_id: {
      type: 'uuid',
      references: { name: 'episodes', field: 'id' },
      onDelete: 'CASCADE',
    },
    composition_id: {
      type: 'uuid',
      references: { name: 'thumbnail_compositions', field: 'id' },
      onDelete: 'CASCADE',
    },
    url: {
      type: 'varchar(500)',
    },
    s3_key: {
      type: 'varchar(500)',
    },
    metadata: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Create ProcessingQueue table
  pgm.createTable('processing_queue', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    composition_id: {
      type: 'uuid',
      references: { name: 'thumbnail_compositions', field: 'id' },
      onDelete: 'CASCADE',
    },
    job_type: {
      type: 'varchar(100)',
    },
    status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes
  pgm.createIndex('episodes', 'id');
  pgm.createIndex('thumbnail_compositions', 'episode_id');
  pgm.createIndex('thumbnail_compositions', 'template_id');
  pgm.createIndex('thumbnails', 'episode_id');
  pgm.createIndex('thumbnails', 'composition_id');
  pgm.createIndex('processing_queue', 'composition_id');
};

exports.down = (pgm) => {
  pgm.dropTable('processing_queue', { ifExists: true });
  pgm.dropTable('thumbnails', { ifExists: true });
  pgm.dropTable('thumbnail_compositions', { ifExists: true });
  pgm.dropTable('assets', { ifExists: true });
  pgm.dropTable('thumbnail_templates', { ifExists: true });
  pgm.dropTable('episodes', { ifExists: true });
};
