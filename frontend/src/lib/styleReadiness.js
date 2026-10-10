/**
 * Style sheet readiness, "Ready x of 12" (docs/design/2026-10-landing-and-
 * stylesheet.md, Style Page; Task #2876; the 12 chips are Evoni's ruling,
 * 2026-10-10). The one place the rule lives: the Style Page's bar and the
 * Production checklist's card both call styleReadiness, so they agree.
 *
 *   Front, Side, Back, Hero   a photo in that spot
 *   Hair, Nails               a photo AND a name
 *   Beauty                    a photo in any of eyes, lips, skin
 *   Venue                     an image on the sheet: one marked In lookbook,
 *                             or the event scene set's first image, which the
 *                             sheet falls back to
 *   Inspo                     one of her uploads (automatic textures don't count)
 *   Wardrobe                  a saved look with every required slot filled
 *                             (Body included)
 *   Palette                   five colours
 *   Tagline                   not empty
 *
 * The server's own readiness (episodeLookbookService.readiness) still counts
 * 11 photo categories; moving this rule to the server is owed in #2877.
 *
 * lookbook: GET /episodes/:id/lookbook. sheet: GET /episodes/:id/style-sheet
 * (for the wardrobe columns), or null while it loads. palette: the palette
 * shown (saved, or taken from the pieces), else the sheet's saved one.
 */

export const READINESS_CHIPS = [
  { key: 'front', label: 'Front' },
  { key: 'side', label: 'Side' },
  { key: 'back', label: 'Back' },
  { key: 'hero', label: 'Hero' },
  { key: 'hair', label: 'Hair' },
  { key: 'nails', label: 'Nails' },
  { key: 'beauty', label: 'Beauty' },
  { key: 'venue', label: 'Venue' },
  { key: 'inspo', label: 'Inspo' },
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'palette', label: 'Palette' },
  { key: 'tagline', label: 'Tagline' },
];

const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

export function styleReadiness({ lookbook, sheet = null, palette = null } = {}) {
  const images = lookbook?.images || {};
  const has = (spot) => (images[spot] || []).length > 0;
  const columns = sheet?.wardrobe?.columns || [];
  const colours = palette || sheet?.palette || [];

  const ready = {
    front: has('front'),
    side: has('side'),
    back: has('back'),
    hero: has('hero'),
    hair: has('hair') && hasText(lookbook?.hair_name),
    nails: has('nails') && hasText(lookbook?.nails_name),
    beauty: has('eyes') || has('lips') || has('skin'),
    venue: (images.venue || []).some((i) => i.in_lookbook) || (lookbook?.venue_options || []).length > 0,
    inspo: (images.inspo || []).some((i) => i.source === 'upload'),
    wardrobe: Boolean(sheet) && sheet.wardrobe?.state !== 'none' && columns.length > 0 && !columns.some((c) => c.needed),
    palette: colours.length >= 5,
    tagline: hasText(lookbook?.tagline),
  };

  const items = READINESS_CHIPS.map((c) => ({ ...c, ready: Boolean(ready[c.key]) }));
  const missing = items.filter((i) => !i.ready).map((i) => i.label);
  return { items, done: items.length - missing.length, total: items.length, missing };
}
