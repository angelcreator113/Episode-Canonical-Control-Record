/**
 * overlayUtils — shared predicates + accessors for UI overlays (phone screens,
 * phone icons, production overlays).
 *
 * Motivation: the filter `o.category !== 'phone_icon' && o.category !== 'icon' &&
 * o.category !== 'production'` is copied verbatim across ~13 call-sites in
 * UIOverlaysTab.jsx, PhoneHub.jsx, ScreenLinkEditor.jsx, ProductionOverlaysTab.jsx.
 * Adding a new category (or fixing one missing exclusion, which has burned us
 * twice already) requires touching every copy. Centralise here; import where
 * needed; break one thing at a time.
 *
 * The accessors similarly normalise legacy/canonical storage: some assets store
 * screen_links at the top level, others inside metadata — callers shouldn't care.
 */

// ── Category predicates ────────────────────────────────────────────────────

/** True when the overlay is a phone icon (category `phone_icon` or legacy `icon`). */
export const isIcon = (o) => o?.category === 'phone_icon' || o?.category === 'icon';

/** True when the overlay is a production (UI Overlays tab) item. */
export const isProduction = (o) => o?.category === 'production';

/** True when the overlay is a phone screen (not an icon, not a production overlay). */
export const isScreen = (o) => !!o && !isIcon(o) && !isProduction(o);

/** True when a phone screen has an image ready to render in the editor / target dropdowns. */
export const isGeneratedScreen = (o) => isScreen(o) && !!o?.generated && !!o?.url;

// ── Slug derivation ────────────────────────────────────────────────────────

/**
 * Derive a canonical type_key from a human-facing name. Mirrors the server's
 * slug rule so the frontend's 409-recovery, batch-upload, and create paths
 * all resolve to the same key the backend would have produced.
 */
export const deriveTypeKey = (name) =>
  (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

/**
 * Derive a type_key from an uploaded filename (strip the extension first, then
 * run the same rule). Used by batch upload to match filenames to existing
 * types.
 */
export const slugifyFilename = (filename) =>
  deriveTypeKey((filename || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());

// ── Screen-link / zone accessors ───────────────────────────────────────────

/**
 * Normalise screen_links lookup so callers don't repeat
 * `screen?.screen_links || screen?.metadata?.screen_links || []`
 * in every render path. Always returns an array (never null/undefined).
 */
export const getScreenLinks = (screen) =>
  screen?.screen_links || screen?.metadata?.screen_links || [];

/** Same pattern for content_zones. */
export const getContentZones = (screen) =>
  screen?.content_zones || screen?.metadata?.content_zones || [];

/** Same pattern for per-screen image_fit overrides. */
export const getImageFit = (screen) =>
  screen?.image_fit || screen?.metadata?.image_fit || null;

/**
 * Normalise a tap zone's icon references. Legacy zones store a single
 * `icon_url` string; current zones store an `icon_urls` array (with
 * `icon_url` mirroring the first element for back-compat). Always
 * returns an array.
 */
export const getIconUrls = (zone) => {
  if (zone?.icon_urls?.length) return zone.icon_urls;
  if (zone?.icon_url) return [zone.icon_url];
  return [];
};

// ── Icon identity (doctrine rule 17, Task #2005) ───────────────────────────
//
// A placement stands for an icon by its key, not by a copy of its image, so
// "Change image", "Generate" and "Remove BG" (which each give the icon a new
// image address) never leave a placement stale. `icons` is the list of icon
// overlays as the list route returns them: `id` is the icon's type key, which
// stays the same across image changes; `url` is its current image (processed
// if present, else raw).

/**
 * The key of the icon overlay a zone stands for, or null.
 *   - A zone placed from an icon carries `icon_overlay_id`; it resolves when
 *     that icon is in `icons`.
 *   - A legacy zone carrying only `icon_url` resolves when that address is an
 *     icon's current image. A zone that went stale through an earlier image
 *     change does not: the old address isn't in the loaded data.
 *   - A zone's own custom icon (uploaded per zone) matches no icon: null.
 */
export const resolveZoneIconKey = (zone, icons = []) => {
  if (!zone) return null;
  const iconList = (icons || []).filter(isIcon);
  if (zone.icon_overlay_id && iconList.some(i => i.id === zone.icon_overlay_id)) {
    return zone.icon_overlay_id;
  }
  if (zone.icon_url) {
    const match = iconList.find(i => i.url && i.url === zone.icon_url);
    if (match) return match.id;
  }
  return null;
};

/**
 * The image a zone should draw: its icon's current image when the zone
 * resolves to an icon that has one, otherwise the zone's own `icon_url`
 * (legacy addresses and per-zone custom icons keep working). Null when the
 * zone has no icon.
 */
export const resolveZoneIcon = (zone, icons = []) => {
  const key = resolveZoneIconKey(zone, icons);
  if (key) {
    const icon = (icons || []).find(i => i.id === key && isIcon(i));
    if (icon?.url) return icon.url;
  }
  return zone?.icon_url || null;
};

/**
 * A legacy zone that resolves to an icon, stamped with that icon's key so the
 * reference survives the next image change. Used when an editor saves a
 * screen's zones. Zones that already carry a key, or that don't resolve, are
 * returned unchanged.
 */
export const withResolvedIconKey = (zone, icons = []) => {
  if (!zone || zone.icon_overlay_id || !zone.icon_url) return zone;
  const key = resolveZoneIconKey(zone, icons);
  return key ? { ...zone, icon_overlay_id: key } : zone;
};
