/**
 * Migration: Create episode_scripts table
 * 
 * Supports multiple script types with version management, scene markers,
 * and file uploads for PDF/DOCX/TXT/Fountain formats.
 */

exports.up = (pgm) => {
  // Create the episode_scripts table
  pgm.createTable('episode_scripts', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    script_type: {
      type: 'varchar(50)',
      notNull: true,
      check: "script_type IN ('trailer', 'main', 'shorts', 'teaser', 'behind-the-scenes', 'bonus-content')",
    },
    version_number: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    version_label: {
      type: 'varchar(255)',
    },
    author: {
      type: 'varchar(255)',
    },
    status: {
      type: 'varchar(50)',
      default: "'draft'",
      check: "status IN ('draft', 'final', 'approved')",
    },
    duration: {
      type: 'integer',
    },
    scene_count: {
      type: 'integer',
      default: 0,
    },
    content: {
      type: 'text',
    },
    file_format: {
      type: 'varchar(20)',
      check: "file_format IN ('txt', 'pdf', 'docx', 'fountain')",
    },
    file_url: {
      type: 'varchar(1024)',
    },
    file_size: {
      type: 'bigint',
    },
    is_primary: {
      type: 'boolean',
      default: false,
    },
    is_latest: {
      type: 'boolean',
      default: true,
    },
    scene_markers: {
      type: 'jsonb',
      default: "'[]'::jsonb",
    },
    created_by: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamp with time zone',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    deleted_at: {
      type: 'timestamp with time zone',
    },
  });

  // Create indexes
  pgm.createIndex('episode_scripts', 'episode_id', {
    name: 'idx_episode_scripts_episode_id',
    where: 'deleted_at IS NULL',
  });

  pgm.createIndex('episode_scripts', 'script_type', {
    name: 'idx_episode_scripts_script_type',
    where: 'deleted_at IS NULL',
  });

  pgm.createIndex('episode_scripts', 'status', {
    name: 'idx_episode_scripts_status',
    where: 'deleted_at IS NULL',
  });

  pgm.createIndex('episode_scripts', ['episode_id', 'script_type', 'is_primary'], {
    name: 'idx_episode_scripts_primary',
    where: 'deleted_at IS NULL AND is_primary = TRUE',
  });

  pgm.createIndex('episode_scripts', ['episode_id', 'script_type', 'is_latest'], {
    name: 'idx_episode_scripts_latest',
    where: 'deleted_at IS NULL AND is_latest = TRUE',
  });

  pgm.createIndex('episode_scripts', 'author', {
    name: 'idx_episode_scripts_author',
    where: 'deleted_at IS NULL',
  });

  pgm.createIndex('episode_scripts', 'created_at', {
    name: 'idx_episode_scripts_created_at',
    where: 'deleted_at IS NULL',
  });

  // Create unique constraint for primary scripts
  pgm.createIndex('episode_scripts', ['episode_id', 'script_type'], {
    name: 'idx_episode_scripts_unique_primary',
    unique: true,
    where: 'deleted_at IS NULL AND is_primary = TRUE',
  });

  // Create trigger function to update updated_at timestamp
  pgm.createFunction(
    'update_episode_scripts_timestamp',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
    `
  );

  // Create trigger
  pgm.createTrigger('episode_scripts', 'episode_scripts_update_timestamp', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_episode_scripts_timestamp',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTrigger('episode_scripts', 'episode_scripts_update_timestamp', { ifExists: true });
  pgm.dropFunction('update_episode_scripts_timestamp', [], { ifExists: true });
  pgm.dropTable('episode_scripts', { ifExists: true, cascade: true });
};
