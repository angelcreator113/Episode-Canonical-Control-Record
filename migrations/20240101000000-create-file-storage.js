exports.up = (pgm) => {
  // Create ENUM types
  pgm.createType('file_type_enum', ['video', 'image', 'script']);
  pgm.createType('upload_status_enum', ['pending', 'completed', 'failed']);
  pgm.createType('indexing_status_enum', ['pending', 'indexed', 'failed']);

  // Create FileStorages table
  pgm.createTable('file_storages', {
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
      onUpdate: 'CASCADE',
    },
    file_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    file_type: {
      type: 'file_type_enum',
      notNull: true,
    },
    file_size: {
      type: 'bigint',
      notNull: true,
    },
    mime_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    s3_key: {
      type: 'varchar(500)',
      notNull: true,
      unique: true,
    },
    s3_bucket: {
      type: 'varchar(255)',
      notNull: true,
    },
    s3_etag: {
      type: 'varchar(255)',
    },
    s3_version_id: {
      type: 'varchar(255)',
    },
    upload_status: {
      type: 'upload_status_enum',
      default: 'pending',
    },
    upload_error: {
      type: 'text',
    },
    metadata: {
      type: 'jsonb',
    },
    indexing_status: {
      type: 'indexing_status_enum',
      default: 'pending',
    },
    indexed_at: {
      type: 'timestamp',
    },
    processing_job_id: {
      type: 'uuid',
      references: { name: 'processing_queue', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    access_count: {
      type: 'integer',
      default: 0,
    },
    last_accessed_at: {
      type: 'timestamp',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('now()'),
      notNull: true,
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('now()'),
      notNull: true,
    },
    deleted_at: {
      type: 'timestamp',
    },
  });

  // Create indexes
  pgm.createIndex('file_storages', ['episode_id']);
  pgm.createIndex('file_storages', ['file_type']);
  pgm.createIndex('file_storages', ['upload_status']);
  pgm.createIndex('file_storages', ['indexing_status']);
  pgm.createIndex('file_storages', ['s3_key']);
  pgm.createIndex('file_storages', ['created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('file_storages', { ifExists: true });
  pgm.dropType('file_type_enum', { ifExists: true });
  pgm.dropType('upload_status_enum', { ifExists: true });
  pgm.dropType('indexing_status_enum', { ifExists: true });
};
