/**
 * The show's Overlays library (Evoni, 2026-10-07: "show level overlays hold
 * overlays that can be used for any episode while episode overlays are for
 * that episode only"). Pure helpers over GET /ui-overlays/:showId (the
 * production overlays: titles, lower thirds, buttons, frames) and GET
 * /ui-overlays/:showId/usage ({ [asset_id]: [{ id, episode_number, title }] }).
 */

/** Every image an overlay has: its main one and its variants, once each. */
export function overlayAssetIds(overlay) {
  const ids = [overlay?.asset_id, ...((overlay?.variants || []).map((v) => v.asset_id))].filter(Boolean);
  return [...new Set(ids)];
}

/** The episodes using any of the overlay's images, once each, in episode order. */
export function episodesUsing(overlay, usage) {
  const byId = new Map();
  for (const assetId of overlayAssetIds(overlay)) {
    for (const ep of (usage?.[assetId] || [])) if (ep?.id && !byId.has(ep.id)) byId.set(ep.id, ep);
  }
  return [...byId.values()].sort((a, b) => (a.episode_number ?? Infinity) - (b.episode_number ?? Infinity));
}

/** "Not used yet", "Used in Episode 3", "Used in 4 episodes". */
export function usageLine(episodes) {
  const n = episodes?.length || 0;
  if (!n) return 'Not used yet';
  if (n === 1) return episodes[0].episode_number != null ? `Used in Episode ${episodes[0].episode_number}` : 'Used in 1 episode';
  return `Used in ${n} episodes`;
}

/** The header's tiles: overlays ready of all, and the episodes that use any. */
export function libraryTiles(overlays, usage) {
  const list = overlays || [];
  const ready = list.filter((o) => o.generated).length;
  const episodes = new Set(list.flatMap((o) => episodesUsing(o, usage).map((e) => e.id)));
  return [
    { key: 'ready', value: `${ready}/${list.length}`, label: 'ready' },
    { key: 'episodes', value: String(episodes.size), label: episodes.size === 1 ? 'episode uses them' : 'episodes use them' },
  ];
}

/** An overlay's state: 'ready' with an image, else 'not_made'. */
export function overlayState(overlay) {
  return overlay?.generated && overlay?.url ? 'ready' : 'not_made';
}
