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
      // The screen's description is its type's (ui_overlay_types); assets
      // have no description column, and selecting one failed every call.
      `SELECT a.id, a.name, t.description, a.metadata::text AS metadata_text
       FROM assets a
       LEFT JOIN ui_overlay_types t
         ON t.show_id = a.show_id AND t.type_key = a.metadata->>'overlay_type' AND t.deleted_at IS NULL
       WHERE a.id = :assetId AND a.show_id = :showId AND a.deleted_at IS NULL
       LIMIT 1`,
      { replacements: { assetId, showId } }
    );
    const row = screenRows?.[0];
    if (row) {
      let meta = {};
      try { meta = JSON.parse(row.metadata_text || '{}'); } catch (parseErr) {
        console.error(`[phoneContextBuilder] screen ${row.id} metadata is not JSON:`, parseErr.message);
      }
      screen = {
        id: row.id,
        name: row.name,
        description: row.description || null,
        category: meta.overlay_category || 'phone',
        // The screen's key, so it is not offered as its own peer.
        key: meta.overlay_type || row.id,
        existing_zones: meta.screen_links || [],
        existing_content_zones: meta.content_zones || [],
      };
    }
  }

  // ── Peer screens (legal navigate targets) ─────────────────────────────────
  // UI_OVERLAY assets don't set the top-level `category` column — their
  // phone-family category (phone, phone_icon, icon, production) lives in
  // metadata.overlay_category, so the AI gets each peer with its true
  // category (e.g. don't route from a phone screen into a production overlay).
  // Filtered before the limit (phone round step 1, D7): the 40 rows were
  // taken from every overlay image (icons, production overlays, variants,
  // other episodes' overrides) and then filtered, so a show with many
  // images could offer the AI few or none of its screens. One row per
  // screen key, the episode's own override first; the category is the
  // image's own (metadata.overlay_category), else its type's.
  // A zone's target is the screen's type key (metadata.overlay_type), the id
  // Lala's Phone lists screens by; the asset UUID matched no screen, so AI
  // links came out dead. Only screens are legal targets: icons and the show's
  // production overlays are not (Evoni, 2026-10-07, one system).
  const selfKey = screen?.key || assetId || null;
  const [peerRows] = await sequelize.query(
    `SELECT key AS id, name, category FROM (
       SELECT DISTINCT ON (COALESCE(a.metadata->>'overlay_type', a.id::text))
              COALESCE(a.metadata->>'overlay_type', a.id::text) AS key,
              a.name,
              COALESCE(a.metadata->>'overlay_category', t.category, 'phone') AS category
         FROM assets a
         LEFT JOIN ui_overlay_types t
           ON t.show_id = a.show_id AND t.type_key = a.metadata->>'overlay_type' AND t.deleted_at IS NULL
        WHERE a.show_id = :showId
          AND a.deleted_at IS NULL
          AND a.asset_type = 'UI_OVERLAY'
          AND a.metadata->>'variant_label' IS NULL
          AND ${episodeId ? '(a.episode_id IS NULL OR a.episode_id = :episodeId)' : 'a.episode_id IS NULL'}
        ORDER BY COALESCE(a.metadata->>'overlay_type', a.id::text), (a.episode_id IS NOT NULL) DESC, a.created_at DESC
     ) s
     WHERE category NOT IN ('phone_icon', 'icon', 'production')
       ${selfKey ? 'AND key <> :selfKey' : ''}
     ORDER BY name ASC
     LIMIT 40`,
    { replacements: { showId, episodeId: episodeId || null, selfKey } }
  );
  const peers = (peerRows || []).map(r => ({ id: r.id, name: r.name, category: r.category }));

  // ── Characters — name + role + metadata-driven voice ────────────────────
  const [charRows] = await sequelize.query(
    `SELECT id, name, display_name, role, metadata::text AS metadata_text
     FROM characters
     WHERE show_id = :showId
     ORDER BY
       CASE WHEN role = 'protagonist' THEN 0
            WHEN role = 'antagonist'  THEN 1
            WHEN role = 'supporting'  THEN 2
            ELSE 3 END,
       name ASC
     LIMIT 12`,
    { replacements: { showId } }
  ).catch((err) => { console.error('[phoneContextBuilder] characters query failed:', err.message); return [[]]; });

  const characters = (charRows || []).map(r => {
    let meta = {};
    try { meta = JSON.parse(r.metadata_text || '{}'); } catch (parseErr) {
      console.error(`[phoneContextBuilder] character ${r.id} metadata is not JSON:`, parseErr.message);
    }
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
    ).catch((err) => { console.error('[phoneContextBuilder] episode query failed:', err.message); return [[]]; });
    episode = epRows?.[0] || null;

    // Recent beats across all scenes in this episode — gives the AI a sense of
    // where the story currently is without dumping the whole script.
    const [beatRows] = await sequelize.query(
      `SELECT b.id, b.beat_type, b.label, b.payload::text AS payload_text, b.start_time
       FROM beats b
       JOIN scenes s ON s.id = b.scene_id
       WHERE s.episode_id = :episodeId AND s.deleted_at IS NULL
       ORDER BY b.start_time DESC NULLS LAST
       LIMIT 8`,
      { replacements: { episodeId } }
    ).catch((err) => { console.error('[phoneContextBuilder] beats query failed:', err.message); return [[]]; });
    beats = (beatRows || []).map(r => {
      let payload = {};
      try { payload = JSON.parse(r.payload_text || '{}'); } catch (parseErr) {
        console.error(`[phoneContextBuilder] beat ${r.id} payload is not JSON:`, parseErr.message);
      }
      return { id: r.id, type: r.beat_type, label: r.label, line: payload.line, emotion: payload.emotion };
    });
  }

  // ── Missions (count + short list, scoped to episode if possible) ──────────
  // A database without the phone_missions table has no missions; any other
  // failed read is logged and leaves them out.
  const missionsTable = await sequelize.query(`SELECT to_regclass('public.phone_missions') IS NOT NULL AS ok`)
    .then(([[r]]) => !!r?.ok)
    .catch((err) => { console.error('[phoneContextBuilder] missions table check failed:', err.message); return false; });
  const whereEp = episodeId ? 'AND (episode_id = :episodeId OR episode_id IS NULL)' : '';
  const missionReplacements = episodeId ? { showId, episodeId } : { showId };
  let missions = [];
  let missionKeyRows = [];
  if (missionsTable) {
    try {
      const [missionRows] = await sequelize.query(
        `SELECT id, name, description FROM phone_missions
         WHERE show_id = :showId AND deleted_at IS NULL ${whereEp}
         ORDER BY display_order ASC NULLS LAST
         LIMIT 8`,
        { replacements: missionReplacements }
      );
      missions = missionRows || [];
      // Every mission's conditions and rewards, for the state keys below.
      [missionKeyRows] = await sequelize.query(
        `SELECT objectives::text AS objectives_text, start_condition::text AS start_text, reward_actions::text AS rewards_text
         FROM phone_missions WHERE show_id = :showId AND deleted_at IS NULL ${whereEp}`,
        { replacements: missionReplacements }
      );
    } catch (err) {
      console.error('[phoneContextBuilder] missions read failed:', err.message);
    }
  }

  // ── State keys already in use (non-blocking autocomplete source) ─────────
  // The keys the show's zones (conditions and set_state actions) and its
  // missions (objectives, start conditions, set_state rewards) read and
  // write, so the AI reuses them instead of inventing near-duplicates. The
  // dataset is small (< 100 zones per show).
  const knownKeys = new Set();
  const addConditionKeys = (conds) => (Array.isArray(conds) ? conds : []).forEach(c => c?.key && knownKeys.add(c.key));
  const addActionKeys = (actions) => (Array.isArray(actions) ? actions : []).forEach(a => a?.type === 'set_state' && a.key && knownKeys.add(a.key));
  try {
    const [allAssets] = await sequelize.query(
      `SELECT id, metadata::text AS metadata_text FROM assets
       WHERE show_id = :showId AND deleted_at IS NULL
         AND asset_type = 'UI_OVERLAY'`,
      { replacements: { showId } }
    );
    for (const a of allAssets || []) {
      let meta = {};
      try { meta = JSON.parse(a.metadata_text || '{}'); } catch (parseErr) {
        console.error(`[phoneContextBuilder] overlay ${a.id} metadata is not JSON, keys skipped:`, parseErr.message);
        continue;
      }
      for (const link of meta.screen_links || []) {
        addConditionKeys(link.conditions);
        addActionKeys(link.actions);
      }
    }
  } catch (err) {
    console.error('[phoneContextBuilder] state keys read failed:', err.message);
  }
  for (const m of missionKeyRows || []) {
    try {
      (JSON.parse(m.objectives_text || '[]') || []).forEach(o => addConditionKeys(o?.condition));
      addConditionKeys(JSON.parse(m.start_text || 'null'));
      addActionKeys(JSON.parse(m.rewards_text || '[]'));
    } catch (parseErr) {
      console.error('[phoneContextBuilder] mission keys are not JSON, skipped:', parseErr.message);
    }
  }

  // ── The season (seasonLine) ───────────────────────────────────────────────
  // The episode's own season and part, else the show's current one; '' with
  // none (loadSeasonLine logs a failed read and never throws).
  const season = await require('./seasonLine').loadSeasonLine(sequelize, { showId, episodeId: episodeId || null }, { about: false });

  return {
    show: show ? {
      id: show.id,
      name: show.name,
      description: show.description,
      genre: show.genre,
      style_prefix: show.style_prefix,
    } : null,
    screen,
    peer_screens: peers,
    characters,
    episode,
    recent_beats: beats,
    missions,
    state_keys_in_use: Array.from(knownKeys).sort(),
    season,
  };
}

module.exports = { buildPhoneContext };

