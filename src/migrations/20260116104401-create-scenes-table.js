/**
 * Create scenes table migration
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('scenes', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    episode_id: {
      type: 'integer',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    scene_number: {
      type: 'integer',
      notNull: true,
    },
    title: {
      type: 'varchar(255)',
      notNull: false,
    },
    description: {
      type: 'text',
      notNull: false,
    },
    duration_seconds: {
      type: 'integer',
      notNull: false,
    },
    location: {
      type: 'varchar(255)',
      notNull: false,
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
      notNull: false,
    },
  });

  // Add index on episode_id for faster queries
  pgm.createIndex('scenes', 'episode_id');
  
  // Add unique constraint for episode_id + scene_number
  pgm.addConstraint('scenes', 'unique_episode_scene_number', {
    unique: ['episode_id', 'scene_number'],
  });
};

/**
 * Rollback scenes table
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('scenes');
};
