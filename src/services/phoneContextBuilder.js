/**
 * phoneContextBuilder — assembles show-aware context for AI calls.
 *
 * PR3 expands the MINIMAL PR1 bundle (show + current screen + peer screens)
 * with:
 *   - characters (role + name + metadata-driven voice hints)
 *   - active episode + its recent beats if episodeId provided
 *   - missions currently defined for this show/episode (count only for now)
 *   - state keys already referenced by zones on this show (so AI reuses them
 *     instead of inventing new ones)
 *
 * Kept request-scoped; no cross-request cache yet (SocialProfile / Beat churn
 * too fast). When we add Anthropic prompt-caching, the cache breakpoint should
 * sit on the static show+characters block since that's the slowest-changing
 * slice — leaving beats and missions outside the cached prefix.
 */

async function buildPhoneContext({ showId, episodeId, assetId }) {
  const models = require('../models');
  const { sequelize } = models;

  // ── Show ──────────────────────────────────────────────────────────────────
  const [showRows] = await sequelize.query(
    `SELECT id, name, description, genre, style_prefix
     FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { showId } }
  );
  const show = showRows?.[0] || null;

  // ── Current screen + existing zones ───────────────────────────────────────
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
        existing_content_zones: meta.content_zones || [],
      };
    }
  }

  // ── Peer screens (legal navigate targets) ─────────────────────────────────
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

  // ── Characters — name + role + metadata-driven voice ────────────────────
  const [charRows] = await sequelize.query(
    `SELECT id, name, display_name, role, metadata::text AS metadata_text
     FROM characters
     WHERE show_id = :showId AND deleted_at IS NULL
     ORDER BY
       CASE WHEN role = 'protagonist' THEN 0
            WHEN role = 'antagonist'  THEN 1
            WHEN role = 'supporting'  THEN 2
            ELSE 3 END,
       name ASC
     LIMIT 12`,
    { replacements: { showId } }
  ).catch(() => [[]]);

  const characters = (charRows || []).map(r => {
    let meta = {};
    try { meta = JSON.parse(r.metadata_text || '{}'); } catch { /* noop */ }
    return {
      id: r.id,
      name: r.display_name || r.name,
      role: r.role,
      // Pull the most prompt-useful slices. Shape tolerates missing fields.
      voice: meta.voice || meta.voice_signature || meta.posting_voice,
      personality: meta.personality || meta.vibe,
    };
  });

  // ── Episode + recent beats (only if episodeId passed) ─────────────────────
  let episode = null;
  let beats = [];
  if (episodeId) {
    const [epRows] = await sequelize.query(
      `SELECT id, episode_number, title, description
       FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId } }
    ).catch(() => [[]]);
    episode = epRows?.[0] || null;

    // Recent beats across all scenes in this episode — gives the AI a sense of
    // where the story currently is without dumping the whole script.
    const [beatRows] = await sequelize.query(
      `SELECT b.id, b.beat_type, b.label, b.payload::text AS payload_text, b.start_time
       FROM beats b
       JOIN scenes s ON s.id = b.scene_id
       WHERE s.episode_id = :episodeId AND b.deleted_at IS NULL
       ORDER BY b.start_time DESC NULLS LAST
       LIMIT 8`,
      { replacements: { episodeId } }
    ).catch(() => [[]]);
    beats = (beatRows || []).map(r => {
      let payload = {};
      try { payload = JSON.parse(r.payload_text || '{}'); } catch { /* noop */ }
      return { id: r.id, type: r.beat_type, label: r.label, line: payload.line, emotion: payload.emotion };
    });
  }

  // ── Missions (count + short list, scoped to episode if possible) ──────────
  // The phone_missions table lands in PR4; guard the query so this file still
  // works before then. If the table doesn't exist, fall back to an empty list.
  let missions = [];
  try {
    const whereEp = episodeId ? 'AND (episode_id = :episodeId OR episode_id IS NULL)' : '';
    const [missionRows] = await sequelize.query(
      `SELECT id, name, description FROM phone_missions
       WHERE show_id = :showId AND deleted_at IS NULL ${whereEp}
       ORDER BY display_order ASC NULLS LAST
       LIMIT 8`,
      { replacements: episodeId ? { showId, episodeId } : { showId } }
    );
    missions = missionRows || [];
  } catch { /* table not yet created */ }

  // ── State keys already in use (non-blocking autocomplete source) ─────────
  // Scan all phone assets' metadata.screen_links[*].conditions/actions for keys.
  // This isn't indexed but the dataset is small (< 100 zones per show).
  const knownKeys = new Set();
  try {
    const [allAssets] = await sequelize.query(
      `SELECT metadata::text AS metadata_text FROM assets
       WHERE show_id = :showId AND deleted_at IS NULL
         AND category IN ('phone', 'phone_icon')`,
      { replacements: { showId } }
    );
    for (const a of allAssets || []) {
      let meta = {};
      try { meta = JSON.parse(a.metadata_text || '{}'); } catch { continue; }
      for (const link of meta.screen_links || []) {
        (link.conditions || []).forEach(c => c.key && knownKeys.add(c.key));
        (link.actions || []).forEach(a => a.type === 'set_state' && a.key && knownKeys.add(a.key));
      }
    }
  } catch { /* noop */ }

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
    characters,
    episode,
    recent_beats: beats,
    missions,
    state_keys_in_use: Array.from(knownKeys).sort(),
  };
}

module.exports = { buildPhoneContext };

