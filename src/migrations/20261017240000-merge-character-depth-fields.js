'use strict';

/**
 * One home for each part of a character's inner life (Evoni, 2026-10-17:
 * "yes approve the table"). Three generations stored the same ideas: the
 * Inner life fields (which every writer reads), the older Depth Engine v1
 * set (body_relationship, time_orientation_v2, change_capacity_v2, …) and
 * the Depth Engine's de_* set. Nothing kept them in step.
 *
 * Per character, each copy moves to its home (services/characterDepthFields):
 *   - a value goes into its home only where the home is empty;
 *   - a value that differs from a filled home, or has no matching value in
 *     the home's list, is kept in extra_fields.depth_archive, never lost;
 *   - the moved copy is then cleared.
 * time_orientation takes the Depth Engine's five values (four added to its
 * type) and its old values are renamed. change_capacity becomes one record
 * with the generator's keys (mobility in the Depth Engine's five levels,
 * conditions_for_change, armor_type, description) plus score, witness,
 * arc_function and blocker; a plain sentence already there becomes its
 * description.
 *
 * Every value it changes is saved first in extra_fields.depth_merge_backup;
 * down() puts them back and removes both keys. blind_spot_visible_to has no
 * twin and stays. Columns are not dropped. Logs how many characters moved
 * and how many values were archived.
 */

const TABLE = 'registry_characters';
const TIME_TYPE = 'enum_registry_characters_time_orientation';
const NEW_TIMES = ['future_oriented', 'present_impulsive', 'perpetual_waiter', 'cyclical'];

const TIME = {
  past_anchored: 'past_anchored', future_oriented: 'future_oriented', present_impulsive: 'present_impulsive',
  perpetual_waiter: 'perpetual_waiter', cyclical: 'cyclical',
  future_obsessed: 'future_oriented', impulsive_present: 'present_impulsive', waiting: 'perpetual_waiter',
  future_focused: 'future_oriented', suspended: 'perpetual_waiter',
};
const MONEY = {
  hoarder: 'hoarder', compulsive_giver: 'compulsive_giver', spends_to_feel_powerful: 'spend_to_feel',
  deprives_out_of_guilt: 'deprivation_guilt', uses_money_to_control: 'control', performs_wealth: 'performs_wealth',
};
const LUCK = { merit_based: 'effort', rigged: 'rigged', divinely_ordered: 'divine', random: 'random' };
const BLIND_SPOT = { impact: 'impact', pattern: 'pattern', motivation: 'motivation', wound: 'wound' };
const MOBILITY = {
  highly_rigid: 'highly_rigid', conditionally_open: 'conditionally_open', cyclically_mobile: 'cyclically_mobile',
  highly_fluid: 'highly_fluid', fixed_by_choice: 'fixed_by_choice',
  rigid: 'highly_rigid', conditional: 'conditionally_open', fluid: 'highly_fluid',
};

// [source, home, value map (none: the value as is)]
const COPIES = [
  ['de_blind_spot', 'blind_spot'],
  ['de_time_orientation', 'time_orientation', TIME],
  ['time_orientation_v2', 'time_orientation', TIME],
  ['body_history', 'de_body_history'],
  ['money_behavior_pattern', 'de_money_behavior', MONEY],
  ['circumstance_advantages', 'de_circumstance_advantages'],
  ['circumstance_disadvantages', 'de_circumstance_disadvantages'],
  ['luck_belief', 'de_world_belief', LUCK],
  ['blind_spot_category', 'de_blind_spot_category', BLIND_SPOT],
  ['cosmology_vs_stated_religion', 'de_cosmology_conflict'],
  ['joy_source', 'de_joy_trigger'],
];
// [source, key in the change_capacity record (the generator's keys and four more), value map]
const CHANGE_KEYS = [
  ['de_change_capacity', 'mobility', MOBILITY],
  ['change_capacity_v2', 'mobility', MOBILITY],
  ['de_change_capacity_score', 'score'],
  ['de_change_condition', 'conditions_for_change'],
  ['change_conditions', 'conditions_for_change'],
  ['change_blocker', 'blocker'],
  ['de_change_witness', 'witness'],
  ['de_arc_function', 'arc_function'],
];
// The older set's fields with no home of the same kind: archived as they are.
const ARCHIVE_ONLY = [
  'time_orientation_note', 'money_behavior_note', 'luck_belief_vs_stated',
  'body_relationship', 'body_currency', 'body_control_pattern',
  'actual_narrative', 'narrative_gap_type', 'operative_cosmology_v2',
  'foreclosed_category', 'foreclosure_origin', 'foreclosure_vs_stated_want',
  'joy_accessibility', 'joy_vs_ambition',
];

const SOURCES = [...new Set([...COPIES.map((c) => c[0]), ...CHANGE_KEYS.map((c) => c[0]), ...ARCHIVE_ONLY])];
const HOMES = [...new Set([...COPIES.map((c) => c[1]), 'change_capacity'])];

const isEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function recordOf(value) {
  if (isEmpty(value)) return {};
  if (typeof value === 'string') {
    if (!value.trim().startsWith('{')) return { description: value };
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : { description: value };
    } catch (err) {
      console.error('[merge-character-depth-fields] change_capacity is not JSON; kept as its description:', err.message);
      return { description: value };
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

/**
 * One character's move, pure: { set: column → new value, archive: source →
 * value kept, backup: column → value before }. Columns missing from the
 * row (not in this database) are left alone.
 */
function mergeRow(row) {
  const set = {};
  const archive = {};
  const backup = {};
  const has = (col) => Object.prototype.hasOwnProperty.call(row, col);
  const now = (col) => (Object.prototype.hasOwnProperty.call(set, col) ? set[col] : row[col]);
  const write = (col, value) => {
    if (!has(col)) return;
    if (!Object.prototype.hasOwnProperty.call(backup, col)) backup[col] = row[col] ?? null;
    set[col] = value;
  };

  // The home's own old time value takes its new name.
  if (has('time_orientation') && !isEmpty(row.time_orientation) && TIME[row.time_orientation] !== row.time_orientation) {
    const renamed = TIME[row.time_orientation];
    if (renamed) write('time_orientation', renamed);
    else { archive.time_orientation = row.time_orientation; write('time_orientation', null); }
  }

  for (const [source, home, map] of COPIES) {
    if (!has(source) || isEmpty(row[source]) || !has(home)) continue;
    const mapped = map ? map[row[source]] : row[source];
    const current = now(home);
    if (mapped !== undefined && isEmpty(current)) write(home, mapped);
    else if (mapped === undefined || !same(current, mapped)) archive[source] = row[source];
    write(source, null);
  }

  if (has('change_capacity')) {
    let record = null;
    // The record's own mobility in the five levels.
    const own = recordOf(row.change_capacity);
    if (!isEmpty(own.mobility) && MOBILITY[own.mobility] !== own.mobility) {
      record = own;
      if (MOBILITY[own.mobility]) record.mobility = MOBILITY[own.mobility];
      else { archive.change_capacity_mobility = own.mobility; delete record.mobility; }
    }
    for (const [source, key, map] of CHANGE_KEYS) {
      if (!has(source) || isEmpty(row[source])) continue;
      record = record || recordOf(row.change_capacity);
      const mapped = map ? map[row[source]] : row[source];
      if (mapped !== undefined && isEmpty(record[key])) record[key] = mapped;
      else if (mapped === undefined || !same(record[key], mapped)) archive[source] = row[source];
      write(source, null);
    }
    if (record && !same(record, recordOf(row.change_capacity))) write('change_capacity', record);
  }

  for (const source of ARCHIVE_ONLY) {
    if (!has(source) || isEmpty(row[source])) continue;
    archive[source] = row[source];
    write(source, null);
  }

  return { set, archive, backup };
}

/** The columns of the table, with their type for the update's casts. */
async function columnsOf(sequelize, transaction) {
  const [rows] = await sequelize.query(
    `SELECT column_name, data_type, udt_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table`,
    { replacements: { table: TABLE }, transaction });
  return new Map(rows.map((r) => [r.column_name, r]));
}

const castOf = (col) => {
  if (col.data_type === 'jsonb') return 'jsonb';
  if (col.data_type === 'json') return 'json';
  if (col.data_type === 'USER-DEFINED') return `"${col.udt_name}"`;
  if (col.data_type === 'ARRAY') return null;
  return col.data_type === 'integer' ? 'integer' : 'text';
};
const valueFor = (col, value) => {
  if (value === null || value === undefined) return null;
  return col.data_type === 'jsonb' || col.data_type === 'json' ? JSON.stringify(value) : value;
};

async function updateRow(sequelize, columns, id, fields, extra, transaction) {
  const sets = [];
  const replacements = { id };
  let i = 0;
  for (const [name, value] of Object.entries(fields)) {
    const col = columns.get(name);
    const cast = col && castOf(col);
    if (!cast) continue;
    i += 1;
    replacements[`v${i}`] = valueFor(col, value);
    sets.push(`"${name}" = CAST(:v${i} AS ${cast})`);
  }
  if (extra !== undefined) {
    replacements.extra = JSON.stringify(extra);
    sets.push(`extra_fields = CAST(:extra AS ${castOf(columns.get('extra_fields'))})`);
  }
  if (!sets.length) return;
  await sequelize.query(`UPDATE ${TABLE} SET ${sets.join(', ')}, updated_at = NOW() WHERE id = :id`, { replacements, transaction });
}

const extraOf = (v) => {
  if (!v) return {};
  if (typeof v === 'string') {
    try { return JSON.parse(v) || {}; } catch (err) {
      console.error('[merge-character-depth-fields] extra_fields is not JSON; starting a fresh object:', err.message);
      return {};
    }
  }
  return { ...v };
};

/** Moves every character, or only `ids`; returns { moved, archived }. */
async function mergeCharacters(sequelize, { ids = null } = {}) {
  return sequelize.transaction(async (transaction) => {
    const columns = await columnsOf(sequelize, transaction);
    if (!columns.has('extra_fields')) throw new Error('registry_characters.extra_fields is missing; nowhere to keep the archive.');
    const wanted = [...new Set(['time_orientation', ...SOURCES, ...HOMES])].filter((c) => columns.has(c));
    const [rows] = await sequelize.query(
      `SELECT id, extra_fields, ${wanted.map((c) => `"${c}"`).join(', ')} FROM ${TABLE}${ids ? ' WHERE id IN (:ids)' : ''}`,
      { replacements: ids ? { ids } : {}, transaction });
    let moved = 0;
    let archived = 0;
    for (const row of rows) {
      const { set, archive, backup } = mergeRow(row);
      if (!Object.keys(set).length && !Object.keys(archive).length) continue;
      const extra = extraOf(row.extra_fields);
      if (Object.keys(archive).length) extra.depth_archive = { ...(extra.depth_archive || {}), ...archive };
      extra.depth_merge_backup = { ...(extra.depth_merge_backup || {}), ...backup };
      await updateRow(sequelize, columns, row.id, set, extra, transaction);
      moved += 1;
      archived += Object.keys(archive).length;
    }
    return { moved, archived };
  });
}

/** Puts back what mergeCharacters changed, for every character or only `ids`. */
async function restoreCharacters(sequelize, { ids = null } = {}) {
  await sequelize.transaction(async (transaction) => {
    const columns = await columnsOf(sequelize, transaction);
    const [rows] = await sequelize.query(
      `SELECT id, extra_fields FROM ${TABLE} WHERE extra_fields::jsonb ? 'depth_merge_backup'${ids ? ' AND id IN (:ids)' : ''}`,
      { replacements: ids ? { ids } : {}, transaction });
    for (const row of rows) {
      const extra = extraOf(row.extra_fields);
      const backup = extra.depth_merge_backup || {};
      delete extra.depth_merge_backup;
      delete extra.depth_archive;
      await updateRow(sequelize, columns, row.id, backup, extra, transaction);
    }
  });
}

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    // The time list's new values, before any row uses them (ADD VALUE needs its own statement).
    const [[type]] = await sequelize.query(`SELECT 1 AS ok FROM pg_type WHERE typname = :t`, { replacements: { t: TIME_TYPE } });
    if (type) {
      for (const v of NEW_TIMES) await sequelize.query(`ALTER TYPE "${TIME_TYPE}" ADD VALUE IF NOT EXISTS '${v}'`);
    }
    const { moved, archived } = await mergeCharacters(sequelize);
    console.log(`[merge-character-depth-fields] ${moved} character(s) moved; ${archived} value(s) kept in extra_fields.depth_archive.`);
  },

  async down(queryInterface) {
    await restoreCharacters(queryInterface.sequelize);
    // The added time values stay on the type: Postgres cannot drop an enum value.
  },

  mergeRow,
  mergeCharacters,
  restoreCharacters,
};
