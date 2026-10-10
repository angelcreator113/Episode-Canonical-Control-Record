/**
 * Style sheet readiness, "Ready x of 12" (Evoni's ruling, 2026-10-10). The
 * rule lives on the server since Task #2877 (styleSheetService.styleReadiness)
 * and GET /episodes/:id/style-sheet returns its result as `readiness`. The
 * Style Page's bar and the Production checklist's card both read it through
 * this one function, so they always agree.
 *
 * The 12 chips: Front, Side, Back, Hero, Hair (photo and name), Nails (photo
 * and name), Beauty, Venue, Inspo, Wardrobe (every required slot), Palette
 * (five colours), Tagline.
 *
 * Before the sheet has loaded (or if it could not be read) nothing is ready.
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

export function styleReadiness({ sheet = null } = {}) {
  const r = sheet?.readiness;
  if (r && Array.isArray(r.items) && r.items.length) {
    return { items: r.items, done: r.done, total: r.total, missing: r.missing || r.items.filter((i) => !i.ready).map((i) => i.label) };
  }
  const items = READINESS_CHIPS.map((c) => ({ ...c, ready: false }));
  return { items, done: 0, total: items.length, missing: items.map((i) => i.label) };
}
