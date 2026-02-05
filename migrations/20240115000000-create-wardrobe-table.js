/**
 * Migration: Create Base Wardrobe Table
 * This table should have been created earlier but was missing
 */

exports.up = (pgm) => {
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
};

exports.down = (pgm) => {
  pgm.dropTable('wardrobe');
};
