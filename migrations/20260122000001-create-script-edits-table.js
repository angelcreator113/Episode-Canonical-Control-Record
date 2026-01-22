/**
 * Migration: Create script_edits table for audit trail
 * 
 * Tracks all edits made to scripts for complete edit history
 */

exports.up = (pgm) => {
  // Create the script_edits table
  pgm.createTable('script_edits', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    script_id: {
      type: 'integer',
      notNull: true,
      references: 'episode_scripts',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'varchar(255)',
    },
    changes: {
      type: 'jsonb',
      notNull: true,
    },
    edit_type: {
      type: 'varchar(50)',
      notNull: true,
      check: "edit_type IN ('create', 'update', 'delete', 'restore', 'set_primary')",
    },
    ip_address: {
      type: 'varchar(45)',
    },
    user_agent: {
      type: 'text',
    },
    created_at: {
      type: 'timestamp with time zone',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes
  pgm.createIndex('script_edits', 'script_id', {
    name: 'idx_script_edits_script_id',
  });

  pgm.createIndex('script_edits', 'user_id', {
    name: 'idx_script_edits_user_id',
  });

  pgm.createIndex('script_edits', 'created_at', {
    name: 'idx_script_edits_created_at',
  });

  pgm.createIndex('script_edits', 'edit_type', {
    name: 'idx_script_edits_edit_type',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('script_edits', { ifExists: true, cascade: true });
};
