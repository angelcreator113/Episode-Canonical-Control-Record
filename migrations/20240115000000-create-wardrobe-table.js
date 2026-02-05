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
    brand: {
      type: 'varchar(255)',
    },
    price: {
      type: 'decimal(10,2)',
    },
    purchase_link: {
      type: 'text',
    },
    website: {
      type: 'text',
    },
    color: {
      type: 'varchar(100)',
    },
    size: {
      type: 'varchar(50)',
    },
    season: {
      type: 'varchar(100)',
    },
    occasion: {
      type: 'varchar(255)',
    },
    outfit_set_id: {
      type: 'uuid',
    },
    outfit_set_name: {
      type: 'varchar(255)',
    },
    scene_description: {
      type: 'text',
    },
    outfit_notes: {
      type: 'text',
    },
    is_favorite: {
      type: 'boolean',
      default: false,
    },
    tags: {
      type: 'jsonb',
      default: '[]',
    },
    image_url: {
      type: 'text',
    },
    s3_key: {
      type: 'varchar(500)',
    },
    thumbnail_url: {
      type: 'text',
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
  pgm.createIndex('wardrobe', 'outfit_set_id');
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
