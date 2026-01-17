exports.up = (pgm) => {
  pgm.createTable('scenes', {
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
    scene_number: {
      type: 'integer',
      notNull: true,
    },
    title: {
      type: 'varchar(255)',
    },
    description: {
      type: 'text',
    },
    duration_seconds: {
      type: 'integer',
    },
    location: {
      type: 'varchar(255)',
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
    },
  });

  // Create indexes
  pgm.createIndex('scenes', 'episode_id', { name: 'idx_scenes_episode_id' });
  
  // Create partial unique index - only for non-deleted scenes (supports paranoid mode)
  pgm.sql(`
    CREATE UNIQUE INDEX idx_scenes_episode_scene_number 
    ON scenes (episode_id, scene_number) 
    WHERE deleted_at IS NULL
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('scenes');
};
