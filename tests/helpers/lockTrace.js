/**
 * A1.3-0 (C6): a runtime lock trace for one test.
 *
 * install(sequelize) wraps sequelize.query on that instance. Every statement
 * the code under test runs (raw queries, model writes and Sequelize's own
 * START TRANSACTION / COMMIT / ROLLBACK, which all go through
 * sequelize.query) is recorded with the Sequelize transaction id it ran in
 * (null for autocommit). Helpers such as lockEpisodes, takeEvent and
 * snapshotEpisode are traced in place, through their real calls.
 *
 * What a record holds:
 *   - kind: 'begin' | 'commit' | 'rollback' | 'lock' | 'write' | 'insert' | 'other'
 *   - table, cls (E, W, P, S, A, X, L) and mode ('update', 'share', 'write')
 *   - ids: for a multi-row lock, the ids the statement returned, in order
 *   - ordered: whether a multi-row FOR UPDATE / FOR SHARE has ORDER BY id
 *
 * What it cannot see (documented in docs/reads/2026-11-06-episode-lock-order.md):
 *   - locks taken by triggers, and FOR KEY SHARE locks taken by foreign-key
 *     checks on INSERT and UPDATE;
 *   - the order Postgres takes rows inside one statement (a multi-row lock
 *     without ORDER BY id is therefore reported as unordered);
 *   - locks held by other processes, and queries made outside Sequelize.
 * The gated race tests, not the tracer, cover those.
 *
 * gate(predicate) pauses the first statement the predicate matches, after it
 * has run (its locks are held), until open() is called.
 */

const RANK = { E: 0, W: 1, P: 2, S: 3, A: 4, X: 5, L: 6 };

const TABLE_CLASS = {
  episodes: 'E',
  world_events: 'W',
  season_specials: 'P',
  season_slots: 'S',
  show_arcs: 'A',
  shows: 'L',
  financial_transactions: 'L',
  character_state: 'L',
  character_state_history: 'L',
};

function classOf(table) {
  return TABLE_CLASS[table] || 'X';
}

function squash(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim();
}

/** The table a FOR UPDATE / FOR SHARE statement locks (resolving FOR UPDATE OF <alias>). */
function lockedTable(sql) {
  const of = sql.match(/FOR (?:NO KEY )?(?:UPDATE|SHARE) OF (\w+)/i);
  const from = sql.match(/\bFROM\s+(?:public\.)?"?(\w+)"?(?:\s+(?:AS\s+)?(\w+))?/i);
  if (!of) return from ? from[1] : null;
  const alias = of[1];
  const re = /\b(?:FROM|JOIN)\s+(?:public\.)?"?(\w+)"?(?:\s+(?:AS\s+)?(\w+))?/gi;
  let m;
  while ((m = re.exec(sql))) {
    if (m[1] === alias || m[2] === alias) return m[1];
  }
  return alias;
}

function describe(sql, options, result) {
  const s = squash(sql);
  const txId = options?.transaction?.id || null;
  if (/^(START TRANSACTION|BEGIN)/i.test(s)) return { kind: 'begin', txId };
  if (/^COMMIT/i.test(s)) return { kind: 'commit', txId };
  if (/^ROLLBACK/i.test(s)) return { kind: 'rollback', txId };
  const lockMatch = s.match(/FOR (NO KEY UPDATE|UPDATE|SHARE|KEY SHARE)\b/i);
  if (/^SELECT/i.test(s) && lockMatch) {
    const table = lockedTable(s);
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    const ids = rows.map((r) => (r && r.id != null ? String(r.id) : null)).filter(Boolean);
    return {
      kind: 'lock', txId, table, cls: classOf(table),
      mode: /SHARE/i.test(lockMatch[1]) ? 'share' : 'update',
      ids,
      ordered: /ORDER BY (?:\w+\.)?id\b/i.test(s),
      limited: /\bLIMIT 1\b/i.test(s),
      sql: s.slice(0, 200),
    };
  }
  const upd = s.match(/^UPDATE\s+(?:public\.)?"?(\w+)"?/i);
  if (upd) return { kind: 'write', txId, table: upd[1], cls: classOf(upd[1]), mode: 'write', sql: s.slice(0, 200), values: valuesOf(options) };
  const del = s.match(/^DELETE FROM\s+(?:public\.)?"?(\w+)"?/i);
  if (del) return { kind: 'write', txId, table: del[1], cls: classOf(del[1]), mode: 'write', sql: s.slice(0, 200), values: valuesOf(options) };
  const ins = s.match(/^INSERT INTO\s+(?:public\.)?"?(\w+)"?/i);
  if (ins) {
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : [result[0]]) : [];
    const ids = rows.map((r) => (r && (r.id ?? r.dataValues?.id)) ?? null).filter((v) => v != null).map(String);
    if (options?.instance?.id) ids.push(String(options.instance.id));
    return { kind: 'insert', txId, table: ins[1], cls: classOf(ins[1]), ids: [...new Set(ids)], sql: s.slice(0, 120) };
  }
  return { kind: 'other', txId, sql: s.slice(0, 120) };
}

function valuesOf(options) {
  const out = [];
  const add = (v) => { if (v != null && (typeof v === 'string' || typeof v === 'number')) out.push(String(v)); };
  const r = options?.replacements;
  if (r && typeof r === 'object') for (const v of Object.values(r)) (Array.isArray(v) ? v.forEach(add) : add(v));
  const b = options?.bind;
  if (Array.isArray(b)) b.forEach(add);
  else if (b && typeof b === 'object') Object.values(b).forEach(add);
  if (options?.where && typeof options.where === 'object') Object.values(options.where).forEach(add);
  if (options?.instance?.id) add(options.instance.id);
  return out;
}

function install(sequelize) {
  const records = [];
  const gates = [];
  const hadOwn = Object.prototype.hasOwnProperty.call(sequelize, 'query');
  const original = sequelize.query;
  sequelize.query = async function tracedQuery(sql, options) {
    const text = typeof sql === 'object' && sql !== null && sql.query ? sql.query : sql;
    let result;
    try {
      result = await original.call(this, sql, options);
    } catch (err) {
      records.push({ ...describe(text, options, null), error: err?.original?.code || err?.parent?.code || err?.message });
      throw err;
    }
    const rec = describe(text, options, result);
    records.push(rec);
    for (const g of gates) {
      if (!g.fired && g.predicate(rec, squash(text))) {
        g.fired = true;
        g.reached();
        await g.wait;
      }
    }
    return result;
  };
  return {
    records,
    uninstall() {
      if (hadOwn) sequelize.query = original;
      else delete sequelize.query;
    },
    /** Pause the first statement the predicate matches (after it ran) until open(). */
    gate(predicate) {
      let open;
      let reached;
      const g = { predicate, fired: false };
      g.wait = new Promise((resolve) => { open = resolve; });
      g.atGate = new Promise((resolve) => { reached = resolve; });
      g.reached = reached;
      gates.push(g);
      return { reached: g.atGate, open: () => open() };
    },
    /** The records grouped by transaction id (autocommit statements are left out). */
    byTransaction() {
      const map = new Map();
      for (const r of records) {
        if (!r.txId) continue;
        if (!map.has(r.txId)) map.set(r.txId, []);
        map.get(r.txId).push(r);
      }
      return map;
    },
    clear() { records.length = 0; },
  };
}

/**
 * Checks one transaction's records against the canonical order
 * E -> W -> P -> S -> A -> X -> L. Rows the transaction inserted itself (E*)
 * are excluded, as are writes whose values name such a row. Locks on a class
 * already held are free. Every multi-row lock must be ORDER BY id and return
 * its ids ascending. Returns a list of violations (empty when it conforms).
 * allow: [{ from, to, why }] known, documented deviations (from -> to classes).
 */
function checkOrder(records, { allow = [] } = {}) {
  const violations = [];
  const fresh = new Set();
  let highest = -1;
  let highestCls = null;
  const held = new Map(); // cls -> Set of row ids this transaction holds
  const hold = (cls, ids) => {
    if (!held.has(cls)) held.set(cls, new Set());
    ids.forEach((id) => held.get(cls).add(id));
  };
  const holds = (r) => {
    const mine = held.get(r.cls);
    if (!mine) return false;
    if (r.kind === 'lock') return r.ids.length > 0 && r.ids.every((id) => mine.has(id));
    return (r.values || []).some((v) => mine.has(v));
  };
  for (const r of records) {
    if (r.kind === 'insert') { r.ids.forEach((id) => fresh.add(id)); continue; }
    if (r.kind !== 'lock' && r.kind !== 'write') continue;
    if (r.error) continue;
    if (r.kind === 'lock' && r.ids.length && r.ids.every((id) => fresh.has(id))) continue;
    if (r.kind === 'write' && r.values && r.values.some((v) => fresh.has(v))) continue;
    if (r.kind === 'lock' && r.ids.length > 1) {
      const sorted = [...r.ids].sort();
      if (!r.ordered || sorted.join(',') !== r.ids.join(',')) {
        violations.push({ type: 'unordered-multi-row', table: r.table, sql: r.sql, ids: r.ids });
      }
    }
    const rank = RANK[r.cls];
    // A row this transaction already holds is no new wait.
    if (rank < highest && !holds(r)) {
      const ok = allow.some((a) => a.from === highestCls && a.to === r.cls);
      if (!ok) violations.push({ type: 'order', after: highestCls, took: r.cls, table: r.table, kind: r.kind, sql: r.sql });
    }
    hold(r.cls, r.kind === 'lock' ? r.ids : (r.values || []));
    if (rank > highest) { highest = rank; highestCls = r.cls; }
  }
  return violations;
}

/** The lock and write classes of a transaction, in order (for messages and assertions). */
function classSequence(records) {
  return records.filter((r) => (r.kind === 'lock' || r.kind === 'write') && !r.error).map((r) => `${r.cls}:${r.table}:${r.kind === 'lock' ? r.mode : 'write'}`);
}

module.exports = { install, checkOrder, classSequence, RANK, TABLE_CLASS, describe, lockedTable };
