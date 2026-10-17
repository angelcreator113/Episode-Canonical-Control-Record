'use strict';

/**
 * One home for each part of a character's inner life (Evoni, 2026-10-17:
 * approved table; migration 20261017240000-merge-character-depth-fields).
 *
 * The Depth Engine (de_*) once stored its own copies of fields the Inner
 * life already had. Those copies now live in the Inner life field, which
 * every writer reads (services/characterFile, characterPosts, …):
 *
 *   de_blind_spot              → blind_spot
 *   de_time_orientation        → time_orientation
 *   de_change_capacity         → change_capacity.mobility
 *   de_change_capacity_score   → change_capacity.score
 *   de_change_condition        → change_capacity.conditions_for_change
 *   de_change_witness          → change_capacity.witness
 *   de_arc_function            → change_capacity.arc_function
 *
 * The Depth Engine screens still speak de_* names: depthView() reads them
 * from their homes, and depthUpdates() turns a de_* save into a save of the
 * home field (withTwinsHome() for a whole set of columns). Every other de_*
 * field has no twin and is stored as is.
 *
 *   TIME_ORIENTATIONS      the five times (the Depth Engine's list)
 *   normalizeTimeOrientation(v)  an old value as its new name; null for none
 *   changeCapacityOf(v)    the change_capacity record as an object
 *   normalizeMobility(v)   a change level in the Depth Engine's five
 *
 * change_capacity keeps the generator's keys (mobility, conditions_for_change,
 * armor_type, description) and adds score, witness, arc_function, blocker.
 */

const TIME_ORIENTATIONS = ['past_anchored', 'future_oriented', 'present_impulsive', 'perpetual_waiter', 'cyclical'];
// The Inner life's first four values, and the older set's, as their new names.
const OLD_TIMES = {
  future_obsessed: 'future_oriented',
  impulsive_present: 'present_impulsive',
  waiting: 'perpetual_waiter',
  future_focused: 'future_oriented',
  suspended: 'perpetual_waiter',
};

const MOBILITIES = ['highly_rigid', 'conditionally_open', 'cyclically_mobile', 'highly_fluid', 'fixed_by_choice'];
// The generator's three and the older set's words, as the five.
const OLD_MOBILITIES = { rigid: 'highly_rigid', conditional: 'conditionally_open', fluid: 'highly_fluid' };

const STORED_IN = {
  de_blind_spot: { field: 'blind_spot' },
  de_time_orientation: { field: 'time_orientation' },
  de_change_capacity: { field: 'change_capacity', key: 'mobility' },
  de_change_capacity_score: { field: 'change_capacity', key: 'score' },
  de_change_condition: { field: 'change_capacity', key: 'conditions_for_change' },
  de_change_witness: { field: 'change_capacity', key: 'witness' },
  de_arc_function: { field: 'change_capacity', key: 'arc_function' },
};

const empty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

function normalizeTimeOrientation(value) {
  if (empty(value)) return null;
  const v = String(value).trim();
  if (TIME_ORIENTATIONS.includes(v)) return v;
  return OLD_TIMES[v] || null;
}

function normalizeMobility(value) {
  if (empty(value)) return null;
  const v = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (MOBILITIES.includes(v)) return v;
  return OLD_MOBILITIES[v] || null;
}

/** change_capacity as an object: a plain string (older generations) becomes its description. */
function changeCapacityOf(value) {
  if (empty(value)) return {};
  if (typeof value === 'string') {
    // A sentence written before it was a record is its summary.
    if (!value.trim().startsWith('{')) return { description: value };
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ...parsed };
    } catch (err) {
      console.error('[characterDepthFields] change_capacity is not readable JSON; kept as its description:', err.message);
    }
    return { description: value };
  }
  return typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

/** The value a de_* field reads, from its home when it has one. */
function readDepthField(json, deField) {
  const home = STORED_IN[deField];
  if (!home) return json[deField] ?? null;
  if (!home.key) return json[home.field] ?? null;
  const record = changeCapacityOf(json[home.field]);
  if (home.key === 'mobility') return normalizeMobility(record.mobility);
  return record[home.key] ?? null;
}

/** The Depth Engine's view: each de_* field, twins read from their homes. */
function depthView(json, fields) {
  const out = {};
  for (const f of fields) out[f] = readDepthField(json, f);
  return out;
}

/**
 * A de_* save as column updates: twins go to their homes (change capacity
 * merged into its record, time named in the new list), the rest as given.
 */
function depthUpdates(json, incoming) {
  const updates = {};
  let record = null;
  for (const [field, value] of Object.entries(incoming)) {
    const home = STORED_IN[field];
    if (!home) { updates[field] = value; continue; }
    if (home.key) {
      record = record || changeCapacityOf(json.change_capacity);
      const v = home.key === 'mobility' ? normalizeMobility(value) : value;
      if (empty(v)) delete record[home.key]; else record[home.key] = v;
    } else if (home.field === 'time_orientation') {
      updates.time_orientation = normalizeTimeOrientation(value);
    } else {
      updates[home.field] = empty(value) ? null : value;
    }
  }
  if (record) updates.change_capacity = Object.keys(record).length ? record : null;
  return updates;
}

/** Any set of column values with its de_* twins moved to their homes (for routes that save whole objects). */
function withTwinsHome(current, fields) {
  const rest = {};
  const twins = {};
  for (const [field, value] of Object.entries(fields || {})) {
    if (STORED_IN[field]) twins[field] = value; else rest[field] = value;
  }
  return Object.keys(twins).length ? { ...rest, ...depthUpdates(current || {}, twins) } : rest;
}

module.exports = {
  TIME_ORIENTATIONS, OLD_TIMES, MOBILITIES, STORED_IN,
  normalizeTimeOrientation, normalizeMobility, changeCapacityOf, readDepthField, depthView, depthUpdates, withTwinsHome,
};
