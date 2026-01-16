/**
 * Add advanced scene fields for production workflow
 */

exports.up = (pgm) => {
  // Add scene type field
  pgm.addColumn('scenes', {
    scene_type: {
      type: 'varchar(50)',
      comment: 'Type of scene: intro, main, outro, transition',
    },
  });

  // Add production status field
  pgm.addColumn('scenes', {
    production_status: {
      type: 'varchar(50)',
      default: 'draft',
      notNull: true,
      comment: 'Production status: draft, storyboarded, recorded, edited, complete',
    },
  });

  // Add mood field
  pgm.addColumn('scenes', {
    mood: {
      type: 'varchar(100)',
      comment: 'Scene mood or tone',
    },
  });

  // Add script notes field
  pgm.addColumn('scenes', {
    script_notes: {
      type: 'text',
      comment: 'Script notes for the scene',
    },
  });

  // Add timecode fields
  pgm.addColumn('scenes', {
    start_timecode: {
      type: 'varchar(20)',
      comment: 'Start timecode in format HH:MM:SS:FF',
    },
  });

  pgm.addColumn('scenes', {
    end_timecode: {
      type: 'varchar(20)',
      comment: 'End timecode in format HH:MM:SS:FF',
    },
  });

  // Add locking fields
  pgm.addColumn('scenes', {
    is_locked: {
      type: 'boolean',
      default: false,
      notNull: true,
      comment: 'Whether the scene is locked for editing',
    },
  });

  pgm.addColumn('scenes', {
    locked_at: {
      type: 'timestamp',
      comment: 'When the scene was locked',
    },
  });

  pgm.addColumn('scenes', {
    locked_by: {
      type: 'varchar(255)',
      comment: 'User ID who locked the scene',
    },
  });

  // Add characters field (JSON array)
  pgm.addColumn('scenes', {
    characters: {
      type: 'jsonb',
      default: '[]',
      notNull: true,
      comment: 'Array of character names in the scene',
    },
  });

  // Add user tracking fields
  pgm.addColumn('scenes', {
    created_by: {
      type: 'varchar(255)',
      comment: 'User ID who created the scene',
    },
  });

  pgm.addColumn('scenes', {
    updated_by: {
      type: 'varchar(255)',
      comment: 'User ID who last updated the scene',
    },
  });

  // Add soft delete field
  pgm.addColumn('scenes', {
    deleted_at: {
      type: 'timestamp',
      comment: 'Soft delete timestamp (paranoid mode)',
    },
  });

  // Add indexes for frequently queried fields
  pgm.createIndex('scenes', 'scene_type', {
    name: 'idx_scenes_scene_type',
  });

  pgm.createIndex('scenes', 'production_status', {
    name: 'idx_scenes_production_status',
  });

  pgm.createIndex('scenes', 'is_locked', {
    name: 'idx_scenes_is_locked',
  });

  pgm.createIndex('scenes', 'deleted_at', {
    name: 'idx_scenes_deleted_at',
  });
};

exports.down = (pgm) => {
  // Remove indexes
  pgm.dropIndex('scenes', 'deleted_at', {
    name: 'idx_scenes_deleted_at',
    ifExists: true,
  });

  pgm.dropIndex('scenes', 'is_locked', {
    name: 'idx_scenes_is_locked',
    ifExists: true,
  });

  pgm.dropIndex('scenes', 'production_status', {
    name: 'idx_scenes_production_status',
    ifExists: true,
  });

  pgm.dropIndex('scenes', 'scene_type', {
    name: 'idx_scenes_scene_type',
    ifExists: true,
  });

  // Remove columns
  pgm.dropColumn('scenes', 'deleted_at', { ifExists: true });
  pgm.dropColumn('scenes', 'updated_by', { ifExists: true });
  pgm.dropColumn('scenes', 'created_by', { ifExists: true });
  pgm.dropColumn('scenes', 'characters', { ifExists: true });
  pgm.dropColumn('scenes', 'locked_by', { ifExists: true });
  pgm.dropColumn('scenes', 'locked_at', { ifExists: true });
  pgm.dropColumn('scenes', 'is_locked', { ifExists: true });
  pgm.dropColumn('scenes', 'end_timecode', { ifExists: true });
  pgm.dropColumn('scenes', 'start_timecode', { ifExists: true });
  pgm.dropColumn('scenes', 'script_notes', { ifExists: true });
  pgm.dropColumn('scenes', 'mood', { ifExists: true });
  pgm.dropColumn('scenes', 'production_status', { ifExists: true });
  pgm.dropColumn('scenes', 'scene_type', { ifExists: true });
};
