/* eslint-disable camelcase, no-console */

/**
 * Migration: Add JustAWomanInHerPrime support to compositions
 * - Adds justawomaninherprime_asset_id to thumbnail_compositions
 * - Adds include_justawomaninherprime toggle
 * - Adds justawomaninherprime_position for admin adjustments
 * - Updates all template layouts
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Add new columns to thumbnail_compositions table
  pgm.addColumns('thumbnail_compositions', {
    justawomaninherprime_asset_id: {
      type: 'uuid',
      references: 'assets(id)',
      onDelete: 'SET NULL',
      notNull: false
    },
    include_justawomaninherprime: {
      type: 'boolean',
      default: false,
      notNull: true
    },
    justawomaninherprime_position: {
      type: 'jsonb',
      notNull: false,
      comment: 'Admin-adjustable position overrides'
    }
  });

  // 2. Create index for performance
  pgm.createIndex('thumbnail_compositions', 'justawomaninherprime_asset_id');

  // 3. Update existing template layouts to include justawomaninherprime position
  const templates = [
    {
      id: 'youtube-1920x1080',
      justawomanPosition: { width_percent: 20, left_percent: 75, top_percent: 5 }
    },
    {
      id: 'instagram-1080x1080',
      justawomanPosition: { width_percent: 25, left_percent: 70, top_percent: 5 }
    }
  ];

  templates.forEach(template => {
    pgm.sql(`
      UPDATE thumbnail_templates
      SET layout_config = layout_config || '{"justawomaninherprime": ${JSON.stringify(template.justawomanPosition)}}'::jsonb
      WHERE id = '${template.id}'
    `);
  });

  console.log('✅ Added JustAWomanInHerPrime support to compositions');
};

exports.down = (pgm) => {
  // Remove index
  pgm.dropIndex('thumbnail_compositions', 'justawomaninherprime_asset_id');

  // Remove columns
  pgm.dropColumns('thumbnail_compositions', [
    'justawomaninherprime_asset_id',
    'include_justawomaninherprime',
    'justawomaninherprime_position'
  ]);

  // Remove justawomaninherprime from template layouts
  pgm.sql(`
    UPDATE thumbnail_templates
    SET layout_config = layout_config - 'justawomaninherprime'
  `);

  console.log('✅ Removed JustAWomanInHerPrime support');
};
