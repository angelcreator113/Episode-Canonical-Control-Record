/**
 * Show settings → Config (Evoni, 2026-10-07: "yes" to fixing it). The pure
 * parts of the Config tab: the form from a show, and the PUT body.
 *
 * The old tab read the show from `res.data.show || res.data`, but
 * GET /shows/:id answers { status, data: show }, so the form opened on its
 * defaults, never the show. It saved title, era, season_length and
 * economy_model, which are not Show columns (src/models/Show.js), so they
 * were dropped, and offered a 'paused' status the column's enum refuses (a
 * 500). Now the name is the show's name; era, planned episodes and economy
 * model live in the show's metadata beside what is already there
 * (tagline, required_slots, lala_home, …), which a save keeps.
 */

export const STATUSES = Object.freeze([
  { value: 'active', label: 'Active' },
  { value: 'in_development', label: 'In development' },
  { value: 'archived', label: 'Archived' },
  { value: 'cancelled', label: 'Cancelled' },
]);

export const ERAS = Object.freeze(['Pre-Prime Era', 'Prime Era', 'Post-Prime Era']);
export const ECONOMY_MODELS = Object.freeze(['Prime Coins + Dream Fund', 'Coins Only', 'Custom']);

export const DEFAULTS = Object.freeze({ era: ERAS[0], season_length: 24, economy_model: ECONOMY_MODELS[0] });

/** The show out of a GET /shows/:id response ({ status, data }), or null. */
export const showFromResponse = (res) => {
  const body = res?.data;
  const show = body?.data || body?.show || null;
  return show && typeof show === 'object' && show.id ? show : null;
};

export const metadataOf = (show) => {
  const m = show?.metadata;
  if (!m) return {};
  if (typeof m === 'string') {
    try { return JSON.parse(m) || {}; } catch (err) {
      console.error('[showSettings] metadata parse failed:', err.message);
      return {};
    }
  }
  return typeof m === 'object' && !Array.isArray(m) ? m : {};
};

const seasonLength = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : DEFAULTS.season_length;
};

/** The Config form for a show as stored. */
export function settingsFromShow(show) {
  const meta = metadataOf(show);
  return {
    name: show?.name || '',
    description: show?.description || '',
    status: STATUSES.some((s) => s.value === show?.status) ? show.status : 'active',
    era: ERAS.includes(meta.era) ? meta.era : DEFAULTS.era,
    season_length: seasonLength(meta.season_length),
    economy_model: ECONOMY_MODELS.includes(meta.economy_model) ? meta.economy_model : DEFAULTS.economy_model,
  };
}

/** What stops a save, in plain words; null when it can be saved. */
export function settingsError(form) {
  if (!String(form.name || '').trim()) return 'The show needs a name.';
  if (!STATUSES.some((s) => s.value === form.status)) return 'Choose a status.';
  return null;
}

/**
 * The PUT /shows/:id body: the show's own fields, and the season settings in
 * metadata beside the settings already there (never dropped). `show` should
 * be read just before the save so a Lala's home saved meanwhile is kept.
 */
export function settingsUpdate(form, show) {
  return {
    name: String(form.name).trim(),
    description: String(form.description || '').trim() || null,
    status: form.status,
    metadata: {
      ...metadataOf(show),
      era: form.era,
      season_length: seasonLength(form.season_length),
      economy_model: form.economy_model,
    },
  };
}
