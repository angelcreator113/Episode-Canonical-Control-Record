/**
 * Migration 009: Create Notifications, Activity Logs, and Presence Tables
 * Phase 3A: Real-time Notifications System
 *
 * Tables created:
 * 1. notifications - User notifications (created/read/deleted)
 * 2. activity_logs - Activity audit trail
 * 3. user_presence - Online status and activity tracking
 * 4. notification_preferences - User notification settings
 */

const { v4: uuidv4 } = require('uuid');

exports.up = async (pgm) => {
  // Create notifications table
  pgm.createTable(
    'notifications',
    {
      id: {
        type: 'UUID',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      user_id: {
        type: 'UUID',
        notNull: true,
        references: 'users(id)',
        onDelete: 'CASCADE',
      },
      type: {
        type: 'VARCHAR(50)',
        notNull: true,
        comment: 'job_completed, episode_updated, admin_alert, etc.',
      },
      title: {
        type: 'VARCHAR(255)',
        notNull: true,
      },
      message: {
        type: 'TEXT',
      },
      data: {
        type: 'JSONB',
        default: '{}',
        comment: 'Additional notification data',
      },
      read_at: {
        type: 'TIMESTAMP',
      },
      priority: {
        type: 'VARCHAR(20)',
        default: 'normal',
        comment: 'critical, high, normal, low',
      },
      expires_at: {
        type: 'TIMESTAMP',
        comment: 'Auto-delete after this time',
      },
      created_at: {
        type: 'TIMESTAMP',
        default: pgm.func('NOW()'),
      },
      updated_at: {
        type: 'TIMESTAMP',
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true }
  );

  // Indexes for notifications
  pgm.createIndex('notifications', ['user_id', 'read_at'], {
    name: 'idx_notifications_user_read',
    ifNotExists: true,
  });
  pgm.createIndex('notifications', ['created_at'], {
    name: 'idx_notifications_created',
    direction: 'DESC',
    ifNotExists: true,
  });
  pgm.createIndex('notifications', ['expires_at'], {
    name: 'idx_notifications_expires',
    ifNotExists: true,
  });
  pgm.createIndex('notifications', ['priority'], {
    name: 'idx_notifications_priority',
    ifNotExists: true,
  });

  // Create activity_logs table
  pgm.createTable(
    'activity_logs',
    {
      id: {
        type: 'UUID',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      user_id: {
        type: 'UUID',
        notNull: true,
        references: 'users(id)',
      },
      action_type: {
        type: 'VARCHAR(50)',
        notNull: true,
        comment: 'created, updated, deleted, approved, rejected, etc.',
      },
      resource_type: {
        type: 'VARCHAR(50)',
        notNull: true,
        comment: 'episode, file, template, composition, etc.',
      },
      resource_id: {
        type: 'UUID',
        comment: 'ID of affected resource',
      },
      resource_name: {
        type: 'VARCHAR(255)',
        comment: 'Name/title of resource for quick display',
      },
      changes: {
        type: 'JSONB',
        comment: 'Before/after values for update actions',
      },
      ip_address: {
        type: 'INET',
        comment: 'Client IP address',
      },
      user_agent: {
        type: 'TEXT',
        comment: 'User agent string',
      },
      metadata: {
        type: 'JSONB',
        default: '{}',
        comment: 'Additional context',
      },
      created_at: {
        type: 'TIMESTAMP',
        notNull: true,
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true }
  );

  // Indexes for activity_logs
  pgm.createIndex('activity_logs', ['user_id', 'created_at'], {
    name: 'idx_activity_user_created',
    direction: { user_id: 'ASC', created_at: 'DESC' },
    ifNotExists: true,
  });
  pgm.createIndex('activity_logs', ['resource_type', 'resource_id'], {
    name: 'idx_activity_resource',
    ifNotExists: true,
  });
  pgm.createIndex('activity_logs', ['action_type'], {
    name: 'idx_activity_action',
    ifNotExists: true,
  });
  pgm.createIndex('activity_logs', ['created_at'], {
    name: 'idx_activity_created',
    direction: 'DESC',
    ifNotExists: true,
  });

  // Create user_presence table
  pgm.createTable(
    'user_presence',
    {
      user_id: {
        type: 'UUID',
        primaryKey: true,
        references: 'users(id)',
        onDelete: 'CASCADE',
      },
      status: {
        type: 'VARCHAR(20)',
        default: 'online',
        comment: 'online, offline, away, busy, do_not_disturb',
      },
      status_message: {
        type: 'VARCHAR(255)',
        comment: 'Custom status message',
      },
      last_activity_at: {
        type: 'TIMESTAMP',
        default: pgm.func('NOW()'),
      },
      current_resource_type: {
        type: 'VARCHAR(50)',
        comment: 'episode, file, composition, etc.',
      },
      current_resource_id: {
        type: 'UUID',
        comment: 'What resource user is currently viewing',
      },
      socket_ids: {
        type: 'TEXT[]',
        default: '{}',
        comment: 'Active WebSocket connection IDs',
      },
      updated_at: {
        type: 'TIMESTAMP',
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true }
  );

  // Indexes for user_presence
  pgm.createIndex('user_presence', ['status'], {
    name: 'idx_presence_status',
    ifNotExists: true,
  });
  pgm.createIndex('user_presence', ['last_activity_at'], {
    name: 'idx_presence_activity',
    direction: 'DESC',
    ifNotExists: true,
  });
  pgm.createIndex('user_presence', ['current_resource_type', 'current_resource_id'], {
    name: 'idx_presence_resource',
    ifNotExists: true,
  });

  // Create notification_preferences table
  pgm.createTable(
    'notification_preferences',
    {
      user_id: {
        type: 'UUID',
        primaryKey: true,
        references: 'users(id)',
        onDelete: 'CASCADE',
      },
      email_on_job_complete: {
        type: 'BOOLEAN',
        default: true,
      },
      email_on_episode_update: {
        type: 'BOOLEAN',
        default: true,
      },
      email_on_mention: {
        type: 'BOOLEAN',
        default: true,
      },
      push_enabled: {
        type: 'BOOLEAN',
        default: true,
      },
      in_app_enabled: {
        type: 'BOOLEAN',
        default: true,
      },
      digest_frequency: {
        type: 'VARCHAR(20)',
        default: 'daily',
        comment: 'off, hourly, daily, weekly',
      },
      quiet_hours_start: {
        type: 'TIME',
      },
      quiet_hours_end: {
        type: 'TIME',
      },
      muted_notifications: {
        type: 'TEXT[]',
        default: '{}',
        comment: 'Notification type keys to ignore',
      },
      created_at: {
        type: 'TIMESTAMP',
        default: pgm.func('NOW()'),
      },
      updated_at: {
        type: 'TIMESTAMP',
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true }
  );

  // Add trigger for updated_at on notifications
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_notifications_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON notifications;
    CREATE TRIGGER trigger_notifications_updated_at
      BEFORE UPDATE ON notifications
      FOR EACH ROW
      EXECUTE FUNCTION update_notifications_updated_at();
  `);

  // Add trigger for updated_at on user_presence
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_user_presence_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_user_presence_updated_at ON user_presence;
    CREATE TRIGGER trigger_user_presence_updated_at
      BEFORE UPDATE ON user_presence
      FOR EACH ROW
      EXECUTE FUNCTION update_user_presence_updated_at();
  `);

  // Add trigger for updated_at on notification_preferences
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_notification_preferences_updated_at ON notification_preferences;
    CREATE TRIGGER trigger_notification_preferences_updated_at
      BEFORE UPDATE ON notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_notification_preferences_updated_at();
  `);
};

exports.down = async (pgm) => {
  // Drop triggers
  pgm.sql(`
    DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON notifications;
    DROP TRIGGER IF EXISTS trigger_user_presence_updated_at ON user_presence;
    DROP TRIGGER IF EXISTS trigger_notification_preferences_updated_at ON notification_preferences;
    DROP FUNCTION IF EXISTS update_notifications_updated_at();
    DROP FUNCTION IF EXISTS update_user_presence_updated_at();
    DROP FUNCTION IF EXISTS update_notification_preferences_updated_at();
  `);

  // Drop tables
  pgm.dropTable('notification_preferences', { ifExists: true });
  pgm.dropTable('user_presence', { ifExists: true });
  pgm.dropTable('activity_logs', { ifExists: true });
  pgm.dropTable('notifications', { ifExists: true });
};
