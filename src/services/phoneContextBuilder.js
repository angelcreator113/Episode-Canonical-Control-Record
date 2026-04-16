/**
 * phoneContextBuilder — assembles show-aware context for AI calls.
 *
 * PR1 ships a MINIMAL version: show name + style_prefix + current screen name
 * + existing zones on that screen + peer-screen ids for navigation targets.
 * PR3 will expand it with characters, beats, relationships, missions, plus
 * prompt-caching on the static show+characters block.
 *
 * Uses raw SQL to match the style already established in uiOverlayService.js
 * (that file reads shows/assets via `sequelize.query` too).
 */

async function buildPhoneContext({ showId, assetId }) {
  const models = require('../models');
  const { sequelize } = models;

  // Show — title, description, genre, style_prefix.
  const [showRows] = await sequelize.query(
    `SELECT id, name, description, genre, style_prefix
     FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { showId } }
  );
  const show = showRows?.[0] || null;

  // Current screen (optional) + its existing zones.
  let screen = null;
  if (assetId) {
    const [screenRows] = await sequelize.query(
      `SELECT id, name, description, category, metadata::text AS metadata_text
       FROM assets
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL
       LIMIT 1`,
      { replacements: { assetId, showId } }
    );
    const row = screenRows?.[0];
    if (row) {
      let meta = {};
      try { meta = JSON.parse(row.metadata_text || '{}'); } catch { /* noop */ }
      screen = {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        existing_zones: meta.screen_links || [],
      };
    }
  }

  // Peer screens — the AI needs legal `navigate` targets; without this it will
  // hallucinate made-up screen ids.
  const [peerRows] = await sequelize.query(
    `SELECT id, name, category FROM assets
     WHERE show_id = :showId
       AND deleted_at IS NULL
       AND category IN ('phone', 'phone_icon')
       ${assetId ? 'AND id <> :assetId' : ''}
     ORDER BY name ASC
     LIMIT 40`,
    { replacements: assetId ? { showId, assetId } : { showId } }
  );

  return {
    show: show ? {
      id: show.id,
      name: show.name,
      description: show.description,
      genre: show.genre,
      style_prefix: show.style_prefix,
    } : null,
    screen,
    peer_screens: (peerRows || []).map(s => ({ id: s.id, name: s.name, category: s.category })),
  };
}

module.exports = { buildPhoneContext };
