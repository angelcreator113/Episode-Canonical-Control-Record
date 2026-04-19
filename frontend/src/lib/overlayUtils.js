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
