/**
 * The Inner life workspace (Evoni, 2026-10-17, step 2): a character's inner
 * life in five sections, each made of subjects. A subject reads as a short
 * summary and opens its own editor; nothing else opens with it.
 *
 * Every field has one home since step 1 (services/characterDepthFields):
 * a path into the character record, e.g. ['want_architecture', 'real_want']
 * or ['de_joy_trigger']. A subject saves only its own fields, through
 * PUT /character-registry/characters/:id.
 *
 *   SECTIONS                 the five, each { key, label, about, subjects }
 *   getAt(record, path)      a field's value
 *   draftOf(character, subject)       the subject's fields as a flat form
 *   saveOf(character, subject, form)  the top-level columns that changed
 *   filledCount(character, subject)   { filled, total }
 *   sectionProgress(character, section)
 *   applySuggestion(subject, form, proposed)  a Depth Engine proposal into empty fields only
 *   DIMENSION_KEYS, dimensionOf, dimensionText, searchDimensions,
 *   dimensionDraft, deepProfileWith    the Deep profile's fourteen dimensions
 */

const opts = (list) => list.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));

export const TIME_ORIENTATIONS = ['past_anchored', 'future_oriented', 'present_impulsive', 'perpetual_waiter', 'cyclical'];
export const MOBILITIES = ['highly_rigid', 'conditionally_open', 'cyclically_mobile', 'highly_fluid', 'fixed_by_choice'];
const CLASSES = ['poverty', 'working_class', 'middle_class', 'upper_middle', 'wealthy', 'ultra_wealthy'];
export const FORECLOSURE_CATEGORIES = ['love', 'safety', 'belonging', 'success', 'being_known'];

// A field: { key (form key), path, label, type, options?, authorOnly?, summary? }
const f = (key, label, type = 'long', more = {}) => ({ key, path: more.path || [key], label, type, ...more });

export const SECTIONS = [
  {
    key: 'core',
    label: 'Core psychology',
    about: 'Their type, what they want, the wound, the mask and the choice that splits them.',
    subjects: [
      { key: 'wants', label: 'Wants', generate: ['want_architecture'], fields: [
        f('surface_want', 'Surface want: what they say they want', 'long', { path: ['want_architecture', 'surface_want'], summary: true }),
        f('real_want', 'Real want: what they actually need', 'long', { path: ['want_architecture', 'real_want'], summary: true }),
        f('forbidden_want', 'Forbidden want: what they will not admit', 'long', { path: ['want_architecture', 'forbidden_want'] }),
      ] },
      { key: 'wound', label: 'Wound', generate: ['wound'], fields: [
        f('wound_description', 'The wound', 'long', { path: ['wound', 'description'], summary: true }),
        f('wound_origin', 'When it happened', 'text', { path: ['wound', 'origin_period'] }),
        f('wound_effects', 'What it does now', 'long', { path: ['wound', 'downstream_effects'] }),
        f('de_money_wound', 'Money wound'),
        f('de_time_wound', 'Time wound'),
        f('de_circumstance_wound', 'Circumstance wound'),
      ] },
      { key: 'mask', label: 'The mask', generate: ['the_mask'], fields: [
        f('mask_description', 'The mask they wear', 'long', { path: ['the_mask', 'description'], summary: true }),
        f('mask_divergences', 'Where the mask and the real person differ (one per line)', 'list', { path: ['the_mask', 'divergence_map'] }),
      ] },
      { key: 'dilemma', label: 'Central dilemma', generate: ['dilemma'], fields: [
        f('dilemma_tension', 'The central tension', 'long', { path: ['dilemma', 'central_tension'], summary: true }),
        f('dilemma_a', 'Option A', 'long', { path: ['dilemma', 'option_a'] }),
        f('dilemma_b', 'Option B', 'long', { path: ['dilemma', 'option_b'] }),
        f('dilemma_cost', 'What either choice costs', 'long', { path: ['dilemma', 'what_both_cost'] }),
      ] },
      { key: 'triggers', label: 'Triggers', generate: ['triggers'], fields: [
        f('triggers', 'Triggers (one per line)', 'list', { summary: true }),
      ] },
    ],
  },
  {
    key: 'emotional',
    label: 'Emotional architecture',
    about: 'What lights them up, what they cannot see, how far they can change and how they live in time.',
    subjects: [
      { key: 'joy', label: 'Joy', generate: ['experience_of_joy'], dimension: 'joy', fields: [
        f('experience_of_joy', 'Their experience of joy', 'long', { summary: true }),
        f('de_joy_trigger', 'What makes them fully alive'),
        f('de_joy_body_location', 'Where in the body joy lives'),
        f('de_joy_origin', 'Earliest memory of this joy'),
        f('de_forbidden_joy', 'The joy they will not let themselves have'),
        f('de_joy_threat_response', 'When joy is threatened', 'select', { options: opts(['fight', 'grieve', 'deny']) }),
        f('de_joy_current_access', 'Current access to aliveness (0 blocked, 100 full)', 'slider'),
      ] },
      { key: 'blindspot', label: 'Blind spot', authorOnly: true, generate: ['blind_spot'], dimension: 'blindspot', fields: [
        f('blind_spot', 'What they cannot see about themselves', 'long', { summary: true }),
        f('de_blind_spot_category', 'Kind of blind spot', 'select', { options: opts(['impact', 'pattern', 'motivation', 'strength', 'wound']) }),
        f('de_blind_spot_evidence', 'Evidence others can see that they misread'),
        f('de_blind_spot_crack_condition', 'What would have to happen for them to see it'),
      ] },
      { key: 'change', label: 'Change capacity', generate: ['change_capacity'], dimension: 'change', fields: [
        f('cc_mobility', 'How far they can change', 'select', { path: ['change_capacity', 'mobility'], options: opts(MOBILITIES), summary: true }),
        f('cc_score', 'Change score (0 rigid, 100 fluid)', 'slider', { path: ['change_capacity', 'score'] }),
        f('cc_conditions', 'What would have to be true for them to change', 'long', { path: ['change_capacity', 'conditions_for_change'], summary: true }),
        f('cc_blocker', 'What blocks it', 'long', { path: ['change_capacity', 'blocker'] }),
        f('cc_armor', 'The armour the wound built', 'long', { path: ['change_capacity', 'armor_type'] }),
        f('cc_witness', 'Who would have to be in the room', 'long', { path: ['change_capacity', 'witness'] }),
        f('cc_arc', 'In the story', 'select', { path: ['change_capacity', 'arc_function'], options: opts(['arc', 'fixed', 'both']) }),
        f('cc_description', 'In a sentence', 'long', { path: ['change_capacity', 'description'] }),
      ] },
      { key: 'time', label: 'Time', generate: ['time_orientation'], dimension: 'time', fields: [
        f('time_orientation', 'How they live in time', 'select', { options: opts(TIME_ORIENTATIONS), summary: true }),
      ] },
    ],
  },
  {
    key: 'history',
    label: 'Personal history',
    about: 'The story they tell about their life, and what body, money and luck did to them.',
    subjects: [
      { key: 'narrative', label: 'Self-narrative', generate: ['self_narrative'], dimension: 'narrative', fields: [
        f('self_narrative', 'The story they tell about themselves', 'long', { summary: true }),
        f('de_self_narrative_origin', 'Origin story'),
        f('de_self_narrative_turning_point', 'Turning point'),
        f('de_self_narrative_villain', 'Who they hold responsible'),
        f('de_actual_narrative_gap', 'What their story gets wrong', 'long', { authorOnly: true }),
        f('de_therapy_target', 'What therapy would work on'),
      ] },
      { key: 'body', label: 'Body', dimension: 'body', fields: [
        f('de_body_relationship', 'Their body is', 'select', { options: opts(['currency', 'discipline', 'burden', 'stranger', 'home', 'evidence']), summary: true }),
        f('de_body_currency', 'Body as currency (0 to 100)', 'slider'),
        f('de_body_control', 'Body control and discipline (0 to 100)', 'slider'),
        f('de_body_comfort', 'Comfort in their body (0 to 100)', 'slider'),
        f('de_body_history', 'Body history', 'long', { summary: true }),
      ] },
      { key: 'money', label: 'Money', dimension: 'money', fields: [
        f('de_money_behavior', 'How they behave with money', 'select', { options: opts(['hoarder', 'compulsive_giver', 'spend_to_feel', 'deprivation_guilt', 'control', 'performs_wealth', 'performs_poverty']), summary: true }),
        f('de_money_origin_class', 'Class they grew up in', 'select', { options: opts(CLASSES) }),
        f('de_money_current_class', 'Class now', 'select', { options: opts(CLASSES) }),
        f('de_class_gap_direction', 'Which way they moved', 'select', { options: opts(['up', 'down', 'stable']) }),
      ] },
      { key: 'luck', label: 'Luck & circumstance', dimension: 'luck', fields: [
        f('de_world_belief', 'How they think the world works', 'select', { options: opts(['random', 'rigged', 'effort', 'divine', 'strategy']), summary: true }),
        f('de_luck_interpretation', 'Luck (0 random, 100 earned)', 'slider'),
        f('de_circumstance_advantages', 'What the world gave them', 'long', { summary: true }),
        f('de_circumstance_disadvantages', 'What the world took'),
      ] },
    ],
  },
  {
    key: 'beliefs',
    label: 'Beliefs & behaviours',
    about: 'What they believe runs the world, and what they have quietly given up on.',
    subjects: [
      { key: 'cosmology', label: 'Cosmology', generate: ['operative_cosmology'], dimension: 'cosmology', fields: [
        f('operative_cosmology', 'What they believe runs the world', 'long', { summary: true }),
        f('de_operative_cosmology', 'In a word', 'select', { options: opts(['deserving', 'contractual', 'indifferent', 'relational', 'authored']), summary: true }),
        f('de_stated_religion', 'What they say they believe'),
        f('de_cosmology_conflict', 'Where the two disagree'),
        f('de_meaning_making_style', 'How they explain things that make no sense'),
      ] },
      { key: 'foreclosed', label: 'Foreclosed possibility', generate: ['foreclosed_possibility'], dimension: 'foreclosed', fields: [
        f('foreclosed_possibility', 'What they have given up on', 'long', { summary: true }),
        f('de_foreclosed_possibilities', 'Doors they have closed', 'foreclosed'),
      ] },
    ],
  },
];

export const DEEP_PROFILE = { key: 'deep', label: 'Deep profile', about: 'Fourteen dimensions of their life, each opened and edited on its own.' };

// ── Reading and writing paths ───────────────────────────────────────────────

const isFilled = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(isFilled);
  return true;
};

/** A nested column as an object: older rows stored some as JSON text. */
const objectOf = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try { return JSON.parse(v); } catch (err) { console.error('[innerLifeSections] unreadable JSON column:', err.message); }
  }
  return typeof v === 'string' && v.trim() ? { description: v } : {};
};

export function getAt(record, path) {
  if (!record) return null;
  if (path.length === 1) return record[path[0]] ?? null;
  // The column, or the older dilemma in extra_fields.
  const top = path[0] === 'dilemma' ? (record.dilemma || record.extra_fields?.dilemma) : record[path[0]];
  return objectOf(top)[path[1]] ?? null;
}

const visibleFields = (subject, isAuthor) => subject.fields.filter((fd) => isAuthor || !fd.authorOnly);

/** The subject's fields as a flat form: lists as lines, numbers as numbers, the foreclosed set as its own object. */
export function draftOf(character, subject, isAuthor = true) {
  const form = {};
  for (const fd of visibleFields(subject, isAuthor)) {
    const v = getAt(character, fd.path);
    if (fd.type === 'list') form[fd.key] = Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : x?.label || x?.name || '')).join('\n') : '';
    else if (fd.type === 'slider') form[fd.key] = Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null;
    else if (fd.type === 'foreclosed') {
      form[fd.key] = {
        selected: Array.isArray(v) ? v : [],
        origins: { ...(character?.de_foreclosure_origins || {}) },
        visibility: { ...(character?.de_foreclosure_visibility || {}) },
        cracks: { ...(character?.de_crack_conditions || {}) },
      };
    } else form[fd.key] = v === null || v === undefined ? '' : String(v);
  }
  return form;
}

const formValue = (fd, raw) => {
  if (fd.type === 'list') return String(raw || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (fd.type === 'slider') return raw === null || raw === '' || raw === undefined ? null : Math.max(0, Math.min(100, Math.round(Number(raw))));
  const s = String(raw ?? '').trim();
  return s || null;
};

/**
 * The columns to save: each top-level column the subject touches, nested
 * ones merged onto what is stored so other keys stay. Only what changed.
 */
export function saveOf(character, subject, form, isAuthor = true) {
  const out = {};
  for (const fd of visibleFields(subject, isAuthor)) {
    if (fd.type === 'foreclosed') {
      const { selected, origins, visibility, cracks } = form[fd.key] || {};
      // Notes only for chosen doors, and only those with words; none is null.
      const keep = (obj) => {
        const kept = Object.entries(obj || {}).filter(([k, v]) => (selected || []).includes(k) && isFilled(v));
        return kept.length ? Object.fromEntries(kept.map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) : null;
      };
      const next = {
        de_foreclosed_possibilities: selected?.length ? selected : null,
        de_foreclosure_origins: keep(origins),
        de_foreclosure_visibility: keep(visibility),
        de_crack_conditions: keep(cracks),
      };
      for (const [k, v] of Object.entries(next)) {
        if (JSON.stringify(v) !== JSON.stringify(isFilled(character?.[k]) ? character[k] : null)) out[k] = v;
      }
      continue;
    }
    const value = formValue(fd, form[fd.key]);
    // What is stored, read the way the form reads it, so an untouched field is never saved.
    const before = formValue(fd, draftOf(character, { fields: [fd] })[fd.key]);
    if (JSON.stringify(value) === JSON.stringify(before)) continue;
    if (fd.path.length === 1) { out[fd.path[0]] = value; continue; }
    const [col, key] = fd.path;
    const base = out[col] || { ...objectOf(col === 'dilemma' ? (character?.dilemma || character?.extra_fields?.dilemma) : character?.[col]) };
    if (value === null) delete base[key]; else base[key] = value;
    out[col] = base;
  }
  for (const [col, v] of Object.entries(out)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) out[col] = null;
  }
  return out;
}

export function filledCount(character, subject, isAuthor = true) {
  const fields = visibleFields(subject, isAuthor);
  const filled = fields.filter((fd) => isFilled(getAt(character, fd.path))).length;
  return { filled, total: fields.length };
}

export function sectionProgress(character, section, isAuthor = true) {
  const subjects = section.subjects.filter((s) => isAuthor || !s.authorOnly);
  const started = subjects.filter((s) => filledCount(character, s, isAuthor).filled > 0).length;
  return { started, total: subjects.length };
}

/** A subject's summary: its summary fields' values, words for choices. */
export function summaryOf(character, subject, isAuthor = true) {
  return visibleFields(subject, isAuthor)
    .filter((fd) => fd.summary)
    .map((fd) => {
      const v = getAt(character, fd.path);
      if (!isFilled(v)) return null;
      if (Array.isArray(v)) return { label: fd.label.replace(/ \(one per line\)$/, ''), text: v.map((x) => (typeof x === 'string' ? x : x?.label || x?.name)).filter(Boolean).join(' · ') };
      const text = fd.type === 'select' ? String(v).replace(/_/g, ' ') : String(v);
      return { label: fd.label, text };
    })
    .filter(Boolean);
}

// A Depth Engine proposal's twins (services/characterDepthFields) as form keys.
const TWIN_KEYS = {
  de_blind_spot: 'blind_spot', de_time_orientation: 'time_orientation', de_change_capacity: 'cc_mobility',
  de_change_capacity_score: 'cc_score', de_change_condition: 'cc_conditions', de_change_witness: 'cc_witness', de_arc_function: 'cc_arc',
};
const FORECLOSED_PARTS = { de_foreclosed_possibilities: 'selected', de_foreclosure_origins: 'origins', de_foreclosure_visibility: 'visibility', de_crack_conditions: 'cracks' };

const formEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * A /character-depth/:id/generate/:dimension proposal put into the form:
 * only into fields that are empty, so nothing written is replaced. Returns
 * the new form and the labels of the fields it filled. Nothing is saved.
 */
export function applySuggestion(subject, form, proposed, isAuthor = true) {
  const next = { ...form };
  const filled = [];
  const fields = visibleFields(subject, isAuthor);
  const byKey = Object.fromEntries(fields.map((fd) => [fd.key, fd]));
  const foreclosed = fields.find((fd) => fd.type === 'foreclosed');
  for (const [k, raw] of Object.entries(proposed || {})) {
    if (foreclosed && FORECLOSED_PARTS[k]) {
      const part = FORECLOSED_PARTS[k];
      const cur = next[foreclosed.key] || { selected: [], origins: {}, visibility: {}, cracks: {} };
      if (part === 'selected') {
        if (cur.selected?.length || !Array.isArray(raw)) continue;
        const selected = raw.filter((c) => FORECLOSURE_CATEGORIES.includes(c));
        if (!selected.length) continue;
        next[foreclosed.key] = { ...cur, selected };
        filled.push(foreclosed.label);
      } else if (raw && typeof raw === 'object') {
        // Notes only for categories with none written yet.
        const add = Object.fromEntries(Object.entries(raw).filter(([c]) => formEmpty(cur[part]?.[c])));
        next[foreclosed.key] = { ...cur, [part]: { ...(cur[part] || {}), ...add } };
      }
      continue;
    }
    const fd = byKey[TWIN_KEYS[k] || k];
    if (!fd || !formEmpty(next[fd.key]) || formEmpty(raw)) continue;
    if (fd.type === 'slider') {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      next[fd.key] = Math.max(0, Math.min(100, Math.round(n)));
    } else if (fd.type === 'select') {
      const v = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (!fd.options.some((o) => o.value === v)) continue;
      next[fd.key] = v;
    } else if (fd.type === 'list') {
      next[fd.key] = (Array.isArray(raw) ? raw : [raw]).map(String).join('\n');
    } else next[fd.key] = typeof raw === 'string' ? raw : JSON.stringify(raw);
    filled.push(fd.label);
  }
  return { form: next, filled };
}

// ── The Deep profile: fourteen dimensions ───────────────────────────────────

export const DIMENSION_KEYS = [
  'life_stage', 'the_body', 'class_money', 'religion_meaning',
  'race_culture', 'sexuality_desire', 'family_architecture', 'friendship_loyalty',
  'ambition_identity', 'habits_rituals', 'speech_silence', 'grief_loss',
  'politics_justice', 'the_unseen',
];

// The older deep-profile endpoints name ten dimensions with "_and_"
// (class_and_money); generation v2 does not (class_money). Read both.
export const DIMENSION_ALIASES = {
  class_money: 'class_and_money', religion_meaning: 'religion_and_meaning', race_culture: 'race_and_culture',
  sexuality_desire: 'sexuality_and_desire', friendship_loyalty: 'friendship_and_loyalty',
  ambition_identity: 'ambition_and_identity', habits_rituals: 'habits_and_rituals',
  speech_silence: 'speech_and_silence', grief_loss: 'grief_and_loss', politics_justice: 'politics_and_justice',
};

// "Class & Money", from the older name where there is one.
export const dimensionLabel = (key) => (DIMENSION_ALIASES[key] || key).replace(/_and_/g, ' & ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** The deep profile as an object (older rows stored it as JSON text). */
export const deepProfileOf = (dp) => {
  if (dp && typeof dp === 'object' && !Array.isArray(dp)) return dp;
  if (typeof dp === 'string' && dp.trim().startsWith('{')) {
    try { return JSON.parse(dp); } catch (err) { console.error('[innerLifeSections] unreadable deep_profile:', err.message); }
  }
  return {};
};

export const dimensionOf = (dp, key) => {
  const obj = deepProfileOf(dp);
  return obj[key] || obj[DIMENSION_ALIASES[key]] || null;
};

// A dimension is text (generation v2) or an object of notes (the older endpoints).
export function dimensionText(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() ? value : null;
  if (typeof value === 'object') {
    const parts = Object.entries(value).filter(([, v]) => isFilled(v))
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    return parts.length ? parts.join('\n') : null;
  }
  return String(value);
}

/** Dimensions whose name or words hold every word of the search. */
export function searchDimensions(dp, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return DIMENSION_KEYS;
  return DIMENSION_KEYS.filter((key) => {
    const hay = `${dimensionLabel(key)} ${dimensionText(dimensionOf(dp, key)) || ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/**
 * A dimension as its editor: one text, or (an object of notes) one text per
 * note, so editing keeps the notes apart.
 */
export function dimensionDraft(dp, key) {
  const v = dimensionOf(dp, key);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return { parts: Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x : JSON.stringify(x)]) };
  }
  return { text: typeof v === 'string' ? v : '' };
}

/** The whole deep_profile with one dimension saved under its current name. */
export function deepProfileWith(dp, key, draft) {
  const next = { ...deepProfileOf(dp) };
  delete next[DIMENSION_ALIASES[key]];
  let value;
  if (draft.parts) {
    const kept = draft.parts.map(([k, v]) => [k, String(v ?? '').trim()]).filter(([, v]) => v);
    value = kept.length ? Object.fromEntries(kept) : null;
  } else value = String(draft.text ?? '').trim() || null;
  if (value === null) delete next[key]; else next[key] = value;
  return Object.keys(next).length ? next : null;
}
