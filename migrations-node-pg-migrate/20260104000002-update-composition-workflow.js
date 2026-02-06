/* eslint-disable camelcase */

/**
 * Migration: Update composition workflow for multi-format generation
 * - Keep template_id as "last used" reference
 * - Add publish_status and primary flags to thumbnails
 * - Add platform_published tracking
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Update thumbnails table for publishing
  pgm.addColumns('thumbnails', {
    publish_status: {
      type: 'varchar(50)',
      default: 'DRAFT',
      notNull: true,
      comment: 'DRAFT, PUBLISHED, UNPUBLISHED, ARCHIVED',
    },
    published_at: {
      type: 'timestamp',
      notNull: false,
    },
    published_by: {
      type: 'varchar(100)',
      notNull: false,
    },
    unpublished_at: {
      type: 'timestamp',
      notNull: false,
    },
    platform_upload_status: {
      type: 'jsonb',
      notNull: false,
      comment: 'Track upload status per platform: {youtube: "uploaded", instagram: "pending"}',
    },
    platform_urls: {
      type: 'jsonb',
      notNull: false,
      comment: 'Platform-specific URLs: {youtube: "video_id", instagram: "post_id"}',
    },
  });

  // 2. Add constraint: Only YouTube can be primary
  pgm.addConstraint('thumbnails', 'youtube_primary_only', {
    check: "is_primary = false OR (is_primary = true AND format = 'YOUTUBE')",
  });

  // 3. Add index for published thumbnails
  pgm.createIndex('thumbnails', ['episode_id', 'publish_status']);
  pgm.createIndex('thumbnails', ['episode_id', 'is_primary']);

  console.log('✅ Updated composition workflow schema');
};

exports.down = (pgm) => {
  // Remove constraints
  pgm.dropConstraint('thumbnails', 'youtube_primary_only');

  // Remove indexes
  pgm.dropIndex('thumbnails', ['episode_id', 'publish_status']);
  pgm.dropIndex('thumbnails', ['episode_id', 'is_primary']);

  // Remove columns
  pgm.dropColumns('thumbnails', [
    'publish_status',
    'published_at',
    'published_by',
    'unpublished_at',
    'platform_upload_status',
    'platform_urls',
  ]);

  console.log('✅ Reverted composition workflow schema');
};
