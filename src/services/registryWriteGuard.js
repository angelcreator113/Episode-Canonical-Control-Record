'use strict';

/**
 * Registry write guard — World Studio may not overwrite Character Registry
 * identity fields that were edited in the Registry.
 *
 * Evoni's ruling (2026-11-04): the Character Registry is the authoritative
 * owner of a character's identity; World Studio must not overwrite Registry
 * fields through broad saves.
 *
 * World Studio derives each registry column (and each key of the registry's
 * JSON columns) from its world character. After the first link, a World
 * Studio edit may write a registry value only when
 *   1. this edit changed it: the value derived from the world character
 *      before the edit differs from the value derived after it, and
 *   2. nobody has edited it in the Registry since: the registry's current
 *      value still equals the value derived before the edit.
 * A value this edit changed but the Registry holds differently is left alone
 * and reported as a conflict. A value this edit did not change is never
 * written.
 *
 *   planRegistryWrite(prev, next, current, { jsonColumns })
 *     prev    — registry values derived from the world character before the edit
 *     next    — registry values derived from it after the edit
 *     current — the registry row as it stands (read FOR UPDATE)
 *   → { set, written, conflicts }
 *     set       — { column: value } to write (JSON columns as merged objects)
 *     written   — field names written ('core_fear', 'aesthetic_dna.color_palette')
 *     conflicts — [{ field, registry_value, world_value }]
 */

const isBlank = (v) => v === undefined || v === null || v === '';

function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonical(v[k]);
    return out;
  }
  return v;
}

/** One comparable form: blank → null, scalars → string, objects → sorted JSON. */
function norm(v) {
  if (isBlank(v)) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(canonical(v));
  return String(v);
}

const same = (a, b) => norm(a) === norm(b);

function asObject(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try { return JSON.parse(v); } catch (err) {
      console.error('[registryWriteGuard] unparseable registry JSON, treated as empty:', err.message);
    }
  }
  return {};
}

/** Decide one value; pushes into `out` and returns true when it is to be written. */
function decide(field, prevV, nextV, curV, out) {
  if (same(prevV, nextV)) return false;          // this edit did not change it
  if (same(curV, nextV)) return false;           // the registry already holds it
  if (same(curV, prevV)) { out.written.push(field); return true; }
  out.conflicts.push({ field, registry_value: isBlank(curV) ? null : curV, world_value: isBlank(nextV) ? null : nextV });
  return false;
}

function planRegistryWrite(prev, next, current, { jsonColumns = [] } = {}) {
  const jsonSet = new Set(jsonColumns);
  const out = { set: {}, written: [], conflicts: [] };
  for (const col of Object.keys(next)) {
    if (jsonSet.has(col)) {
      const p = asObject(prev[col]);
      const n = asObject(next[col]);
      const c = asObject(current[col]);
      const merged = { ...c };
      let changed = false;
      for (const key of new Set([...Object.keys(p), ...Object.keys(n)])) {
        if (decide(`${col}.${key}`, p[key], n[key], c[key], out)) {
          merged[key] = n[key] === undefined ? null : n[key];
          changed = true;
        }
      }
      if (changed) out.set[col] = merged;
    } else if (decide(col, prev[col], next[col], current[col], out)) {
      out.set[col] = next[col] === undefined ? null : next[col];
    }
  }
  return out;
}

/**
 * Lock the registry character linked to a world character and apply the
 * guarded write inside `transaction` (which the caller owns).
 *
 * Returns { registry_character_id, registry_sync, registry_fields_written,
 * registry_conflicts }; registry_sync is 'not_linked', 'unchanged',
 * 'synced' or 'conflicts' (some fields written, some not, is 'conflicts').
 */
async function guardedRegistrySync(sequelize, { worldCharacterId, prev, next, jsonColumns, transaction }) {
  const [rc] = await sequelize.query(
    `SELECT * FROM registry_characters
      WHERE world_character_id = :id AND deleted_at IS NULL
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
    { replacements: { id: worldCharacterId }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  if (!rc) return { registry_character_id: null, registry_sync: 'not_linked', registry_fields_written: [], registry_conflicts: [] };

  const plan = planRegistryWrite(prev, next, rc, { jsonColumns });
  const cols = Object.keys(plan.set);
  if (cols.length) {
    const jsonSet = new Set(jsonColumns);
    const replacements = { rc_id: rc.id };
    const sets = cols.map((col, i) => {
      replacements[`v${i}`] = jsonSet.has(col) ? JSON.stringify(plan.set[col]) : plan.set[col];
      return `"${col}" = :v${i}`;
    });
    await sequelize.query(
      `UPDATE registry_characters SET ${sets.join(', ')}, updated_at = NOW() WHERE id = :rc_id`,
      { replacements, type: sequelize.QueryTypes.UPDATE, transaction }
    );
  }
  return {
    registry_character_id: rc.id,
    registry_sync: plan.conflicts.length ? 'conflicts' : cols.length ? 'synced' : 'unchanged',
    registry_fields_written: plan.written,
    registry_conflicts: plan.conflicts,
  };
}

module.exports = { planRegistryWrite, guardedRegistrySync, norm };
