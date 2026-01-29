/**
 * Create composition_outputs table to store generated thumbnails per format
 */

exports.up = (pgm) => {
  pgm.createTable('composition_outputs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    composition_id: {
      type: 'uuid',
      notNull: true,
      references: 'thumbnail_compositions',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    format: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Output format identifier (e.g., YOUTUBE, INSTAGRAM_FEED)',
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'PROCESSING',
      comment: 'Generation status: PROCESSING, READY, FAILED',
    },
    image_url: {
      type: 'text',
      notNull: false,
      comment: 'S3 URL or CDN path to generated thumbnail image',
    },
    width: {
      type: 'integer',
      notNull: false,
      comment: 'Image width in pixels',
    },
    height: {
      type: 'integer',
      notNull: false,
      comment: 'Image height in pixels',
    },
    file_size_bytes: {
      type: 'integer',
      notNull: false,
      comment: 'File size in bytes',
    },
    generation_started_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp when generation started',
    },
    generation_completed_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp when output was successfully generated',
    },
    generated_by: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'User who triggered generation',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    deleted_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Soft delete timestamp - null means record is active',
    },
  });

  // Create indexes
  pgm.createIndex('composition_outputs', 'composition_id', {
    name: 'idx_composition_outputs_composition_id',
  });

  pgm.createIndex('composition_outputs', 'status', {
    name: 'idx_composition_outputs_status',
  });

  pgm.createIndex('composition_outputs', 'format', {
    name: 'idx_composition_outputs_format',
  });

  pgm.createIndex('composition_outputs', 'deleted_at', {
    name: 'idx_composition_outputs_deleted_at',
  });

  // Create unique constraint
  pgm.createIndex('composition_outputs', ['composition_id', 'format'], {
    name: 'composition_outputs_composition_format_unique',
    unique: true,
  });

  console.log('✅ Created composition_outputs table');
};

exports.down = (pgm) => {
  pgm.dropTable('composition_outputs');
  console.log('✅ Dropped composition_outputs table');
};
