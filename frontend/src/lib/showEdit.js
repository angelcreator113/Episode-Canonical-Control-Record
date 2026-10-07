/**
 * Edit show (Evoni, 2026-10-07: "i cant edit the show something is wrong
 * with that page and also it needs redesign"). The pure parts of EditShow:
 * the form from a show, what is wrong with it, and the PUT body.
 *
 * The old page sent fields a show does not have (tagline, category,
 * primaryColor: PUT /shows/:id ignores them) and a status the column
 * refuses ('draft'), and blocked Save on a category it never loaded. A
 * show's own fields (src/models/Show.js): name, description, genre,
 * status (active | in_development | archived | cancelled), icon, color
 * (#RRGGBB), coverImageUrl, and metadata, where the tagline lives (as
 * POST /shows stores it) beside the show's settings (required_slots,
 * lala_home, …), which a save keeps.
 */

export const STATUSES = Object.freeze([
  { value: 'active', label: 'Active', hint: 'In production' },
  { value: 'in_development', label: 'In development', hint: 'Still being shaped' },
  { value: 'archived', label: 'Archived', hint: 'Kept, no longer worked on' },
  { value: 'cancelled', label: 'Cancelled', hint: 'Stopped' },
]);

export const GENRES = Object.freeze(['Fashion', 'Lifestyle', 'Beauty', 'Entertainment', 'Drama', 'Comedy', 'Education', 'Business']);

const HEX6 = /^#[0-9a-f]{6}$/i;
export const isColor = (value) => HEX6.test(String(value || ''));
/** The colour picker's value while the show has none (the studio's lavender). */
export const DEFAULT_SWATCH = '#5B4B8A';

const metadataOf = (show) => {
  const m = show?.metadata;
  if (!m) return {};
  if (typeof m === 'string') {
    try { return JSON.parse(m) || {}; } catch (err) {
      console.error('[showEdit] metadata parse failed:', err.message);
      return {};
    }
  }
  return typeof m === 'object' && !Array.isArray(m) ? m : {};
};

/** The form for a show as stored. */
export function formFromShow(show) {
  const status = STATUSES.some((s) => s.value === show?.status) ? show.status : 'active';
  return {
    name: show?.name || '',
    tagline: metadataOf(show).tagline || '',
    description: show?.description || '',
    genre: show?.genre || '',
    status,
    icon: show?.icon || '',
    color: isColor(show?.color) ? show.color : '',
  };
}

/** What is wrong with the form: { field: message }; {} when it can be saved. */
export function formErrors(form) {
  const errors = {};
  if (!String(form.name || '').trim()) errors.name = 'The show needs a name.';
  if (String(form.name || '').trim().length > 255) errors.name = 'The name is too long.';
  if (form.color && !isColor(form.color)) errors.color = `A colour like ${DEFAULT_SWATCH}.`;
  if (String(form.icon || '').length > 10) errors.icon = 'One emoji, or a few characters.';
  if (!STATUSES.some((s) => s.value === form.status)) errors.status = 'Choose a status.';
  return errors;
}

/**
 * The PUT /shows/:id body: the show's own fields only, with the tagline in
 * metadata beside the settings already there (never dropped).
 */
export function showUpdate(form, show) {
  const metadata = { ...metadataOf(show) };
  const tagline = String(form.tagline || '').trim();
  if (tagline) metadata.tagline = tagline; else delete metadata.tagline;
  return {
    name: String(form.name).trim(),
    description: String(form.description || '').trim() || null,
    genre: String(form.genre || '').trim() || null,
    status: form.status,
    icon: String(form.icon || '').trim() || null,
    color: form.color || null,
    metadata,
  };
}

/** A save failure in plain words. */
export function saveErrorText(err) {
  const data = err?.response?.data || {};
  const raw = data.message || data.error || err?.message || '';
  if (/unique|already exists/i.test(raw)) return 'Another show already has that name.';
  if (/Network Error|Failed to fetch/i.test(raw)) return "Couldn't reach the server. Your changes are still here; try again.";
  return raw ? `The show wasn't saved: ${raw}` : "The show wasn't saved. Try again.";
}
