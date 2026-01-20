/**
 * Migration: Create shows table
 * Creates the shows table for organizing episodes by show
 */

exports.up = (pgm) => {
  // Create status enum
  pgm.createType('show_status_enum', ['active', 'archived', 'cancelled', 'in_development']);

  // Create shows table
  pgm.createTable('shows', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
      comment: 'Unique show identifier',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
      comment: 'Show name',
    },
    description: {
      type: 'text',
      comment: 'Show description/synopsis',
    },
    slug: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
      comment: 'URL-friendly show identifier',
    },
    genre: {
      type: 'varchar(255)',
      comment: 'Show genre (comma-separated)',
    },
    status: {
      type: 'show_status_enum',
      notNull: true,
      default: 'active',
      comment: 'Current show status',
    },
    creator_name: {
      type: 'varchar(255)',
      comment: 'Creator or producer name',
    },
    network: {
      type: 'varchar(255)',
      comment: 'Network or platform name',
    },
    episode_count: {
      type: 'integer',
      default: 0,
      comment: 'Total number of episodes',
    },
    season_count: {
      type: 'integer',
      default: 1,
      comment: 'Number of seasons',
    },
    premiere_date: {
      type: 'date',
      comment: 'Show premiere date',
    },
    metadata: {
      type: 'jsonb',
      default: '{}',
      comment: 'Additional metadata (ratings, awards, etc)',
    },
    is_active: {
      type: 'boolean',
      default: true,
      comment: 'Whether the show is active',
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
      comment: 'Soft delete timestamp',
    },
  });

  // Create indexes
  pgm.createIndex('shows', 'slug', { unique: true });
  pgm.createIndex('shows', 'status');
  pgm.createIndex('shows', 'is_active');
  pgm.createIndex('shows', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('shows');
  pgm.dropType('show_status_enum');
};
