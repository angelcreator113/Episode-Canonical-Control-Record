/**
 * Scene set helpers shared by the Event Package's Place picker and the
 * Beat Plan's beat editor (§8(hh) L2, L11).
 */

/** A set's thumbnail: its base image, else its cover or first angle with an image. */
export function sceneSetThumb(set) {
  if (set?.base_still_url) return set.base_still_url;
  const angles = set?.angles || [];
  const cover = angles.find((a) => a.id === set.cover_angle_id && a.still_image_url);
  return (cover || angles.find((a) => a.still_image_url))?.still_image_url || null;
}

/**
 * Where a scene set opens: Producer Mode → Assets → Scene Sets, on that set.
 * S8 (Evoni, 2026-10-02): "landing on the exact set and zone, with a way
 * back to the page it came from": zone (an angle id, a zone kind or
 * look:<eventId>), from (a path in this app) and fromLabel.
 */
export const sceneSetPath = (showId, setId, { zone = null, from = null, fromLabel = null } = {}) => {
  const extra = [
    zone ? `&zone=${encodeURIComponent(zone)}` : '',
    from ? `&from=${encodeURIComponent(from)}` : '',
    fromLabel ? `&fromLabel=${encodeURIComponent(fromLabel)}` : '',
  ].join('');
  return `/shows/${showId}/world?tab=scene-sets&set=${setId}${extra}`;
};

/** A "from" path that stays in this app: one leading slash, not two. */
export const isAppPath = (p) => typeof p === 'string' && /^\/(?!\/)/.test(p);
