/**
 * Scene set helpers shared by the Event Package's Place picker and the
 * Beat Plan's beat editor (§8(hh) L2, L11).
 */

/**
 * A set's thumbnail: its library cover (the view chosen in Scene Sets, as
 * cover_image_url or among its angles), else its main background, else its
 * first angle with an image.
 */
export function sceneSetThumb(set) {
  if (set?.cover_image_url) return set.cover_image_url;
  const angles = set?.angles || [];
  const cover = set?.cover_angle_id ? angles.find((a) => a.id === set.cover_angle_id && a.still_image_url) : null;
  if (cover) return cover.still_image_url;
  if (set?.base_still_url) return set.base_still_url;
  return angles.find((a) => a.still_image_url)?.still_image_url || null;
}

/**
 * The extra URL parameters of a hand-off into Scene Sets. S8 (Evoni,
 * 2026-10-02): "landing on the exact set and zone, with a way back to the
 * page it came from": zone (an angle id, a zone kind or look:<eventId>),
 * from (a path in this app), fromLabel and need.
 */
const handoffParams = ({ zone = null, from = null, fromLabel = null, need = null } = {}) => [
  zone ? `&zone=${encodeURIComponent(zone)}` : '',
  from ? `&from=${encodeURIComponent(from)}` : '',
  fromLabel ? `&fromLabel=${encodeURIComponent(fromLabel)}` : '',
  // What the page that sent Evoni here needs from the set, in its words
  // ("Entrance angle missing"); Scene Sets shows it in its handoff line.
  need ? `&need=${encodeURIComponent(String(need).slice(0, 140))}` : '',
].join('');

/** Where a scene set opens: Producer Mode → Assets → Scene Sets, on that set. */
export const sceneSetPath = (showId, setId, opts = {}) =>
  `/shows/${showId}/world?tab=scene-sets&set=${setId}${handoffParams(opts)}`;

/**
 * Where a show's Scene Sets open with no set chosen yet (audit LINK-03,
 * 2026-10-03): the checklist's "Scene sets assigned" sends Evoni to this
 * show's sets, not the clip library, with the same way back.
 */
export const sceneSetsPath = (showId, opts = {}) =>
  `/shows/${showId}/world?tab=scene-sets${handoffParams(opts)}`;

/** A "from" path that stays in this app: one leading slash, not two. */
export const isAppPath = (p) => typeof p === 'string' && /^\/(?!\/)/.test(p);
