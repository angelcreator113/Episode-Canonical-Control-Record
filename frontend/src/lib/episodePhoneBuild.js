/**
 * The steps that make what an episode needs from the phone (phone round
 * step 2; Evoni, 2026-10-25), each through a route the Phone Hub already
 * uses, so their rate limits and cost gates stay in force:
 *   make a screen  POST /ui-overlays/:showId/types (a screen the phone has
 *                  no type for), then POST /ui-overlays/:showId/generate/:type
 *   a tap zone     POST /ui-overlays/:showId/ai/add-zones (a proposal), the
 *                  zones that open the screen PUT to /screen-links/:assetId
 *   a content zone POST /ui-overlays/:showId/ai/fill-content-zone (a
 *                  proposal), merged into the zone and PUT to /content-zones/:assetId
 *
 * Each step returns { items, error }: `items` is what it made, each with a
 * label and an `undo` that takes exactly that back out (the type and its
 * picture soft-deleted, the added zones removed, the zone's settings put
 * back), so a run is reviewed afterwards rather than trusted. A step that
 * fails part way returns what it did make and says why the rest failed.
 * Screens made here are the show's: no route makes an episode's own
 * version of a screen (generate replaces only the show's picture).
 */

const errorText = (err, fallback) => err?.response?.data?.error || err?.message || fallback;
// Out of AI or image budget: the run stops rather than failing every step after.
export const isBudgetStop = (err) => err?.response?.status === 429;

const base = (showId) => `/api/v1/ui-overlays/${showId}`;

/** Make a missing screen: its type when the phone has none, then its picture. */
export async function makeScreen(api, showId, need, { episodeNumber = null } = {}) {
  const items = [];
  let typeKey = need.screen?.id || null;
  if (!typeKey) {
    try {
      const where = `${episodeNumber != null ? `Episode ${episodeNumber}, ` : ''}${need.beats?.length ? `beat ${need.beats.join(', ')}` : 'the script'}`;
      const { data } = await api.post(`${base(showId)}/types`, { name: need.name, category: 'phone', description: `Named in the script (${where}).` });
      const made = data?.data || {};
      typeKey = made.type_key;
      items.push({
        key: `type:${made.id}`, kind: 'screen', label: `${need.name}: new screen`,
        undo: () => api.delete(`${base(showId)}/types/${made.id}`),
      });
    } catch (err) {
      console.error('[episodePhoneBuild] screen type create failed:', err);
      return { items, error: `${need.name}: the screen could not be made (${errorText(err, 'no reason given')})`, stop: isBudgetStop(err) };
    }
  }
  try {
    const { data } = await api.post(`${base(showId)}/generate/${encodeURIComponent(typeKey)}`, {});
    const assetId = data?.data?.asset_id;
    // A new type's picture goes with the type; an existing type's on its own.
    if (need.screen) {
      items.push({ key: `asset:${assetId}`, kind: 'picture', label: `${need.name}: picture`, undo: () => api.delete(`${base(showId)}/asset/${assetId}`) });
    } else if (items[0]) {
      items[0] = { ...items[0], label: `${need.name}: new screen with its picture` };
    }
    return { items, error: null };
  } catch (err) {
    console.error('[episodePhoneBuild] screen picture failed:', err);
    return { items, error: `${need.name}: the picture could not be made (${errorText(err, 'no reason given')})`, stop: isBudgetStop(err) };
  }
}

const opensTarget = (z, id) => z?.target === id || (Array.isArray(z?.actions) && z.actions.some((a) => a?.type === 'navigate' && a.target === id));

/**
 * A tap zone on `from` (a screen with a picture) that opens `need.screen`:
 * the AI's proposal for `from`, of which only the zones that open the
 * screen are kept, added to the zones it already has.
 */
export async function addTapZone(api, showId, episodeId, need, from) {
  const target = need.screen;
  if (!target) return { items: [], error: `${need.name}: make the screen first` };
  if (!from?.asset_id) return { items: [], error: `${need.name}: ${from?.name || 'the screen before it'} has no picture to put a tap zone on` };
  try {
    const { data } = await api.post(`${base(showId)}/ai/add-zones`, {
      asset_id: from.asset_id,
      episode_id: episodeId,
      prompt_hint: `Include one zone that opens the "${need.name}" screen (id ${target.id}); the script opens it from here.`,
    });
    const kept = (data?.proposal?.zones || []).filter((z) => opensTarget(z, target.id)).slice(0, 1);
    if (!kept.length) return { items: [], error: `${need.name}: the AI proposed no tap zone on ${from.name} that opens it` };
    const current = await api.get(`${base(showId)}/screen-links/${from.asset_id}`);
    const links = Array.isArray(current?.data?.screen_links) ? current.data.screen_links : [];
    await api.put(`${base(showId)}/screen-links/${from.asset_id}`, { screen_links: [...links, ...kept] });
    const ids = new Set(kept.map((z) => z.id));
    return {
      items: [{
        key: `zone:${from.asset_id}:${kept[0].id}`, kind: 'zone', label: `Tap zone "${kept[0].label || need.name}" on ${from.name} → ${need.name}`,
        undo: async () => {
          const now = await api.get(`${base(showId)}/screen-links/${from.asset_id}`);
          const left = (Array.isArray(now?.data?.screen_links) ? now.data.screen_links : []).filter((z) => !ids.has(z.id));
          await api.put(`${base(showId)}/screen-links/${from.asset_id}`, { screen_links: left });
        },
      }],
      error: null,
    };
  } catch (err) {
    console.error('[episodePhoneBuild] tap zone failed:', err);
    return { items: [], error: `${need.name}: no tap zone was added (${errorText(err, 'no reason given')})`, stop: isBudgetStop(err) };
  }
}

/** Fill one empty content zone on a screen with the AI's settings for it. */
export async function fillZone(api, showId, episodeId, screen, zone) {
  if (!screen?.asset_id) return { items: [], error: `${screen?.name || 'A screen'}: no picture, so its content zone can't be filled` };
  try {
    const { data } = await api.post(`${base(showId)}/ai/fill-content-zone`, { asset_id: screen.asset_id, zone_id: zone.id, episode_id: episodeId });
    const config = data?.proposal?.content_config;
    if (!config || typeof config !== 'object') return { items: [], error: `${screen.name}: the AI returned nothing for the ${zone.content_type} zone` };
    const current = await api.get(`${base(showId)}/content-zones/${screen.asset_id}`);
    const zones = Array.isArray(current?.data?.content_zones) ? current.data.content_zones : [];
    const before = zones.find((z) => z.id === zone.id);
    if (!before) return { items: [], error: `${screen.name}: its ${zone.content_type} zone is gone` };
    const previous = before.content_config ?? null;
    await api.put(`${base(showId)}/content-zones/${screen.asset_id}`, { content_zones: zones.map((z) => (z.id === zone.id ? { ...z, content_config: config } : z)) });
    const preview = data?.proposal?.content_preview;
    return {
      items: [{
        key: `fill:${screen.asset_id}:${zone.id}`, kind: 'fill', label: `${screen.name}: ${zone.content_type} zone filled${preview ? ` (${preview})` : ''}`,
        undo: async () => {
          const now = await api.get(`${base(showId)}/content-zones/${screen.asset_id}`);
          const list = Array.isArray(now?.data?.content_zones) ? now.data.content_zones : [];
          await api.put(`${base(showId)}/content-zones/${screen.asset_id}`, {
            content_zones: list.map((z) => {
              if (z.id !== zone.id) return z;
              const { content_config: _filled, ...rest } = z;
              return previous === null ? rest : { ...rest, content_config: previous };
            }),
          });
        },
      }],
      error: null,
    };
  } catch (err) {
    console.error('[episodePhoneBuild] content fill failed:', err);
    return { items: [], error: `${screen.name}: the ${zone.content_type} zone was not filled (${errorText(err, 'no reason given')})`, stop: isBudgetStop(err) };
  }
}
