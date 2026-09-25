'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// fitToModel.js — shared guards for writing generated fields into a model.
//
// Task #1844 added the column-length fitting inside socialProfileRoutes.js;
// Task #1851 moved it here so every path that writes AI-generated (or
// generated-then-confirmed) fields into social_profiles uses one helper:
// socialProfileRoutes (POST /generate, /:id/regenerate), socialProfileBulkRoutes
// (generateSingleProfile), characterGenerationRoutes (/confirm-feed),
// feedScheduler (generateAndSaveProfile) and feedAutoGeneration.
// ─────────────────────────────────────────────────────────────────────────────

// ── ENUM validation helpers ──────────────────────────────────────────────────
const VALID_TRAJECTORIES = new Set(['rising', 'plateauing', 'unraveling', 'pivoting', 'silent', 'viral_moment']);
const VALID_ARCHETYPES = new Set([
  'polished_curator', 'messy_transparent', 'soft_life', 'explicitly_paid',
  'overnight_rise', 'cautionary', 'the_peer', 'the_watcher',
  'chaos_creator', 'community_builder',
]);
const VALID_FOLLOWER_TIERS = new Set(['micro', 'mid', 'macro', 'mega']);

function sanitizeEnum(value, validSet, fallback) {
  if (!value) return fallback;
  const normalized = String(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (validSet.has(normalized)) return normalized;
  // Try fuzzy match for common AI variations
  for (const valid of validSet) {
    if (normalized.includes(valid) || valid.includes(normalized)) return valid;
  }
  return fallback;
}

// ── Column-length fitting (Task #1844) ───────────────────────────────────────
// Generated text can run longer than a VARCHAR column. Lengths come from the
// model's declared STRING(n) types, never a hard-coded list; TEXT, JSONB and
// ENUM attributes are left alone. Lengths are counted in code points, as
// Postgres counts characters.
function stringLengthLimits(Model) {
  const limits = {};
  for (const [name, attr] of Object.entries(Model?.rawAttributes || {})) {
    const type = attr?.type;
    if (!type || (type.key !== 'STRING' && type.key !== 'CHAR')) continue;
    const n = type.options?.length ?? type._length ?? 255; // bare STRING is VARCHAR(255)
    if (Number.isInteger(n) && n > 0) limits[name] = n;
  }
  return limits;
}

function fitToLength(value, limit) {
  const chars = Array.from(value);
  if (chars.length <= limit) return value;
  const cut = chars.slice(0, limit).join('');
  const space = cut.lastIndexOf(' ');
  // Break at a word boundary when one falls in the back half; else hard-cut.
  if (/\s/.test(chars[limit])) return cut.trimEnd();
  if (space >= Math.floor(cut.length / 2)) return cut.slice(0, space).trimEnd();
  return cut;
}

// Returns a copy of `record` with every string fitted to its column, and the
// list of fields that were cut ({ field, length, limit } — no content).
function fitRecordToModel(Model, record) {
  const limits = stringLengthLimits(Model);
  const fitted = { ...record };
  const truncated = [];
  for (const [field, limit] of Object.entries(limits)) {
    const value = fitted[field];
    if (typeof value !== 'string') continue;
    const length = Array.from(value).length;
    if (length > limit) {
      fitted[field] = fitToLength(value, limit);
      truncated.push({ field, length, limit });
    }
  }
  return { fitted, truncated };
}

function warnTruncated(label, truncated) {
  if (!truncated.length) return;
  console.warn(`[socialProfiles] ${label}: truncated to column length — ` +
    truncated.map(t => `${t.field} (${t.length} > ${t.limit})`).join(', '));
}

// A Postgres "value too long for type character varying(N)" error (22001)
// does not name the column. Name the candidates so the log diagnoses itself.
function logValueTooLong(label, err, Model, record) {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  if (code !== '22001' || !record) return;
  const limits = stringLengthLimits(Model);
  const strings = Object.entries(limits)
    .filter(([field]) => typeof record[field] === 'string')
    .map(([field, limit]) => ({ field, length: Array.from(record[field]).length, limit }));
  const over = strings.filter(s => s.length > s.limit);
  if (over.length) {
    console.error(`[socialProfiles] ${label}: value too long (22001) — over declared model length: ` +
      over.map(s => `${s.field} (${s.length} > ${s.limit})`).join(', '));
  } else {
    console.error(`[socialProfiles] ${label}: value too long (22001) but no field exceeds its declared model length, ` +
      'so a model length does not match its column. String fields (length/declared): ' +
      strings.sort((a, b) => b.length - a.length).map(s => `${s.field} ${s.length}/${s.limit}`).join(', '));
  }
}

// Task #1851: a model can return a number (or boolean) where a string column
// is expected, e.g. follower_count_approx: 250000. Coerce a truthy non-string
// with String(...) (objects/arrays as JSON); falsy values become null, as `(v || '')…|| null`
// did in feedScheduler before this helper.
function asText(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

module.exports = {
  VALID_TRAJECTORIES,
  VALID_ARCHETYPES,
  VALID_FOLLOWER_TIERS,
  sanitizeEnum,
  stringLengthLimits,
  fitToLength,
  fitRecordToModel,
  warnTruncated,
  logValueTooLong,
  asText,
};
