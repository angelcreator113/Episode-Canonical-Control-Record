/**
 * Migration: Add full-text search index to episode_scripts
 * Date: 2026-01-22
 * Purpose: Enable fast full-text search on script content, notes, and version labels
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_episode_scripts_fulltext 
    ON episode_scripts 
    USING gin(
      to_tsvector('english', 
        COALESCE(content, '') || ' ' || 
        COALESCE(version_label, '') || ' ' ||
        COALESCE(author, '') || ' ' ||
        COALESCE(script_type, '')
      )
    )
    WHERE deleted_at IS NULL
  `);

  pgm.sql(`
    COMMENT ON INDEX idx_episode_scripts_fulltext IS 
    'Full-text search index for script content, version labels, author names, and script types'
  `);
};

exports.down = (pgm) => {
  pgm.dropIndex('episode_scripts', 'idx_episode_scripts_fulltext', { ifExists: true });
};
