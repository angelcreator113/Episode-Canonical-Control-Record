/**
 * Migration: Create Base Wardrobe Tables
 * Creates the foundational wardrobe tables that were missing from base schema
 */

exports.up = (pgm) => {
  // 1. Create wardrobe table
  pgm.createTable('wardrobe', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    character: {
      type: 'varchar(255)',
      notNull: true,
    },
    clothing_category: {
      type: 'varchar(100)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    s3_url: {
      type: 'text',
    },
    s3_url_processed: {
      type: 'text',
    },
    thumbnail_url: {
      type: 'text',
    },
    color: {
      type: 'varchar(100)',
    },
    season: {
      type: 'varchar(50)',
    },
    tags: {
      type: 'text[]',
      default: '{}',
    },
    notes: {
      type: 'text',
    },
    is_favorite: {
      type: 'boolean',
      default: false,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    deleted_at: {
      type: 'timestamp',
    },
  });

  // Create indexes
  pgm.createIndex('wardrobe', 'character');
  pgm.createIndex('wardrobe', 'clothing_category');
  pgm.createIndex('wardrobe', 'deleted_at');
  pgm.createIndex('wardrobe', 'created_at');

  // 2. Create outfit_sets table
  pgm.createTable('outfit_sets', {
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
    character: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    deleted_at: {
      type: 'timestamp',
    },
  });

  pgm.createIndex('outfit_sets', 'deleted_at');

  // 3. Create episode_wardrobe junction table
  pgm.createTable('episode_wardrobe', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    wardrobe_id: {
      type: 'uuid',
      notNull: true,
      references: 'wardrobe',
      onDelete: 'CASCADE',
    },
    scene_id: {
      type: 'uuid',
    },
    worn_at: {
      type: 'timestamp',
    },
    notes: {
      type: 'text',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('episode_wardrobe', 'episode_id');
  pgm.createIndex('episode_wardrobe', 'wardrobe_id');
  pgm.createIndex('episode_wardrobe', ['episode_id', 'wardrobe_id'], { unique: true });
};

exports.down = (pgm) => {
  pgm.dropTable('episode_wardrobe');
  pgm.dropTable('outfit_sets');
  pgm.dropTable('wardrobe');
};
