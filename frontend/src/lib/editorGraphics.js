/**
 * The pictures the editor offers for placing (Gate 2b PR 1b; Evoni,
 * 2026-11-28): the episode's own on-screen pieces and the show's reusable
 * overlay images, each from the list that already owns it.
 *
 *   GET /episodes/:id/overlays        the title overlay, the framed card,
 *                                     the invitation and the event's
 *                                     documents (episodeOverlaysService)
 *   GET /ui-overlays/:showId?episode_id=   the Phone Hub's screens and
 *                                     icons, with this episode's overrides
 *                                     already merged in (phoneOverlays)
 *
 * Nothing is uploaded, generated or designed here, and no third list is
 * invented: the Phone Hub stays the owner of phone design and content, and
 * Production › Overlays stays the owner of the episode's pieces.
 *
 * Two rules the lists make necessary:
 *   - the same picture can arrive from both (an episode's title overlay is
 *     itself a UI_OVERLAY row), so entries are deduped by `asset_id`, the
 *     first list winning the label it is named by;
 *   - an overlay's variants are pictures too, so each is offered beside its
 *     main image.
 *
 * This is a CATALOGUE for discovery. What is already placed on the timeline
 * is resolved by GET /edit/sources (`images`), which answers for pictures
 * no catalogue shows — a show screen an episode override replaced, say.
 */

/** A picture a producer can place: { asset_id, url, label, meta }. */
const entry = (assetId, url, label, meta) => ({ asset_id: String(assetId), url: url || null, label: label || 'Graphic', meta });

/** The episode's own pieces, in the order the overlays tab lists them. */
export function episodePieceGraphics(pieces = []) {
  return (pieces || [])
    .filter((p) => p && p.asset_id && p.status !== 'not_made')
    .map((p) => entry(p.asset_id, p.image_url, p.label || 'Overlay', p.status === 'outdated' ? 'Episode · outdated' : 'Episode'));
}

/**
 * The show's overlay images: each screen's main picture and its variants.
 * `is_episode_override` marks a screen this episode has its own version of,
 * which the list has already resolved for us.
 */
export function showOverlayGraphics(overlays = []) {
  const out = [];
  for (const o of overlays || []) {
    if (!o) continue;
    const scope = o.is_episode_override ? 'Episode override' : 'Show';
    const kind = o.category === 'phone_icon' ? 'icon' : 'screen';
    if (o.asset_id) out.push(entry(o.asset_id, o.url, o.name || o.id, `${scope} · phone ${kind}`));
    for (const v of o.variants || []) {
      if (v && v.asset_id && v.asset_id !== o.asset_id) {
        out.push(entry(v.asset_id, v.url, `${o.name || o.id} · ${v.variant_label || 'Variant'}`, `${scope} · phone ${kind}`));
      }
    }
  }
  return out;
}

/**
 * The catalogue: the episode's pieces first, then the show's images, each
 * picture once. A picture with no image address is left out — there is
 * nothing to place or to draw.
 */
export function graphicsCatalogue({ pieces = [], overlays = [] } = {}) {
  const seen = new Set();
  const out = [];
  for (const g of [...episodePieceGraphics(pieces), ...showOverlayGraphics(overlays)]) {
    if (!g.url || seen.has(g.asset_id)) continue;
    seen.add(g.asset_id);
    out.push(g);
  }
  return out;
}
