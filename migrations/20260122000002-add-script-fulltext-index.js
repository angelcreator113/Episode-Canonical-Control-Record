/**
 * Migration: Add full-text search index to episode_scripts
 * Date: 2026-01-22
 * Purpose: Enable fast full-text search on script content, notes, and version labels
 */

exports.up = async function (db) {
  await db.runSql(`
    -- Create GIN index for full-text search on episode_scripts
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
    WHERE deleted_at IS NULL;

    -- Performance comment
    COMMENT ON INDEX idx_episode_scripts_fulltext IS 
    'Full-text search index for script content, version labels, author names, and script types';
  `);

  console.log('✅ Created full-text search index on episode_scripts');
};

exports.down = async function (db) {
  await db.runSql(`
    DROP INDEX IF EXISTS idx_episode_scripts_fulltext;
  `);

  console.log('✅ Dropped full-text search index from episode_scripts');
};

exports._meta = {
  version: 1,
};
