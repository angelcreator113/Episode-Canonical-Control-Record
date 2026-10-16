'use strict';

/**
 * The show's overlays as GET /api/v1/ui-overlays/:showId returns them: every
 * overlay type with its current picture, tap zones (screen_links) and
 * variants; with an episode, that episode's own overrides and invitation.
 * Moved here from the route (script phone paths, 2026-10-16) so the Script
 * tab's writer reads the same phone the Script tab does
 * (utils/phonePaths.js). Throws an error with code PHONE_IMAGES_READ when the
 * pictures can't be read (a failed read is not a phone with no images).
 */
async function overlayStatusForShow(models, showId, episodeId = null) {
  const { getAllOverlayTypes } = require('./uiOverlayService');
  // All overlay types come from the DB
  const allTypes = await getAllOverlayTypes(showId, models);

  // Direct SQL query — cast metadata to text to avoid JSONB driver issues
  // This is the same pattern used by the /debug endpoint which works reliably
  let existing = [];
  try {
    const baseSelect = `SELECT id, name, asset_type, asset_role,
                               s3_url_processed, s3_url_raw,
                               episode_id,
                               metadata::text as metadata_text
                        FROM assets
                        WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND deleted_at IS NULL`;
    // When scoped to an episode, pull both show-level (episode_id IS NULL)
    // and episode-level rows. The merge below collapses duplicates so
    // the episode override beats the show default. Without an episode_id
    // we exclude episode-scoped rows entirely so they don't pollute the
    // default phone.
    const where = episodeId
      ? `${baseSelect} AND (episode_id IS NULL OR episode_id = :episodeId)`
      : `${baseSelect} AND episode_id IS NULL`;
    const [rows] = await models.sequelize.query(
      `${where} ORDER BY created_at DESC`,
      { replacements: { showId, episodeId } }
    );
    const all = (rows || []).map(r => {
      let meta = {};
      try { meta = r.metadata_text ? JSON.parse(r.metadata_text) : {}; } catch (err) { console.warn('[PhoneOverlays] unreadable overlay metadata, read as none:', r.id, err.message); }
      return {
        id: r.id,
        name: r.name,
        metadata: meta,
        overlay_type: meta.overlay_type || r.name,
        url: r.s3_url_processed || r.s3_url_raw,
        bg_removed: meta.bg_removed || false,
        custom_prompt: meta.custom_prompt || null,
        episode_id: r.episode_id || null,
        is_episode_override: !!(episodeId && r.episode_id === episodeId),
      };
    });
    // Merge show-level + episode-level: episode override wins on
    // matching `name`. Order is preserved by inserting overrides
    // before defaults so the consumer sees the active version first.
    if (episodeId) {
      const overrides = all.filter(a => a.is_episode_override);
      const overrideNames = new Set(overrides.map(a => a.name));
      const defaults = all.filter(a => !a.is_episode_override && !overrideNames.has(a.name));
      existing = [...overrides, ...defaults];
    } else {
      existing = all;
    }
  } catch (queryErr) {
    // A failed read is an error, not a phone with no images (phone audit,
    // 2026-10-07): an empty list invited regenerating every screen.
    console.error('[UIOverlay] Asset query failed:', queryErr.message);
    throw Object.assign(new Error(`Could not read the phone's images: ${queryErr.message}`), { code: 'PHONE_IMAGES_READ' });
  }

  // Map all overlay types to show which are generated vs missing
  // Use case-insensitive matching and check name patterns to handle
  // assets stored with different naming conventions
  let status = allTypes.map(ot => {
    const otId = ot.id.toLowerCase();
    const otName = ot.name.toLowerCase();
    const lifecycle = ot.lifecycle || 'permanent';

    // Find ALL matching assets (variants).
    //
    // Strict matches first (unambiguous): explicit metadata.overlay_type,
    // canonical "UI Overlay: <name>" asset name, or the wardrobe_list
    // legacy alias. The loose substring match (eName.includes(otId)) is a
    // fallback for legacy assets that lack metadata, but when applied as a
    // primary rule it cross-contaminates types that share a name prefix:
    // the "shopping" type picks up "UI Overlay: Shopping Icon" because
    // that name contains "shopping", and both cards end up rendering the
    // same asset's URL. Apply the fallback only when strict matching
    // yields nothing.
    const strictMatches = existing.filter(e => {
      const eType = (e.overlay_type || '').toLowerCase();
      const eName = (e.name || '').toLowerCase();
      return eType === otId
        || eName === `ui overlay: ${otName}`
        || (otId === 'wardrobe_list' && eType === 'todo_checklist');
    });
    const allMatches = strictMatches.length > 0
      ? strictMatches
      : existing.filter(e => (e.name || '').toLowerCase().includes(otId.replace(/_/g, ' ')));

    // Primary = the one without a variant_label, or first match
    const primary = allMatches.find(e => !e.metadata?.variant_label) || allMatches[0] || null;

    // Build variants array
    const variants = allMatches.length > 1 ? allMatches.map(e => ({
      asset_id: e.id,
      url: e.url,
      variant_label: e.metadata?.variant_label || 'Default',
      screen_links: e.metadata?.screen_links || null,
      image_fit: e.metadata?.image_fit || null,
    })) : null;

    return {
      ...ot,
      lifecycle,
      generated: !!primary,
      url: primary?.url || null,
      asset_id: primary?.id || null,
      bg_removed: primary?.bg_removed || false,
      custom_prompt: primary?.custom_prompt || null,
      screen_links: primary?.metadata?.screen_links || null,
      image_fit: primary?.metadata?.image_fit || null,
      content_zones: primary?.metadata?.content_zones || null,
      // The stats panel's number boxes, on its art (Task #3164).
      stats_panel: primary?.metadata?.stats_panel || null,
      // Content zones read these on the device (phone audit, 2026-10-07):
      // the feed/DM/notification zones need the show, the wardrobe
      // price/brand zones read the screen's metadata. Only those two keys
      // go out, not the whole metadata.
      show_id: showId,
      metadata: primary ? {
        wardrobe_price: primary.metadata?.wardrobe_price ?? null,
        wardrobe_brand: primary.metadata?.wardrobe_brand ?? null,
      } : null,
      // True when the screen shown is this episode's own override of the
      // show default (only possible with ?episode_id=). Additive (Task #1920).
      is_episode_override: !!primary?.is_episode_override,
      // Category override from asset metadata (for built-in types reassigned by user)
      ...(primary?.metadata?.overlay_category ? { category: primary.metadata.overlay_category } : {}),
      variants,
    };
  });

  // P10 (Evoni, 2026-09-30; Task #2386): an episode's Lala's Phone shows
  // show-wide plus that episode's own — including the episode's invitation
  // overlay (the event's current approved invitation, an INVITATION_LETTER
  // asset). The Phone Hub (no episode_id) keeps show-wide overlays only.
  if (episodeId) {
    try {
      const { loadEpisodeInvitationOverlay, mergeInvitationIntoOverlayStatus } = require('./episodeInvitationOverlayService');
      const invitation = await loadEpisodeInvitationOverlay(models.sequelize, { showId, episodeId });
      status = mergeInvitationIntoOverlayStatus(status, invitation);
    } catch (invErr) {
      console.error('[UIOverlay] Episode invitation overlay lookup failed:', invErr.message);
    }
  }


  return status;
}

module.exports = { overlayStatusForShow };
