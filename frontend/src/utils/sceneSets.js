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

/** Where a scene set opens: Producer Mode → Assets → Scene Sets, on that set. */
export const sceneSetPath = (showId, setId) => `/shows/${showId}/world?tab=scene-sets&set=${setId}`;
