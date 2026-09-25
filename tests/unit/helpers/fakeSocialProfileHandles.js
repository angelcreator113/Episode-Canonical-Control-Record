/**
 * An in-memory SocialProfile that answers handle lookups the way PostgreSQL
 * would (Task #1893), so the handle-guard tests exercise the real WHERE the
 * code builds instead of a findOne mock that returns a holder regardless.
 *
 * findOne / findOrCreate evaluate Sequelize where clauses over the fixture
 * rows: plain equality, Op.iLike (with \-escaped %, _ and \), Op.ne, Op.eq,
 * Op.or and Op.and. Soft-deleted rows (deletedAt set) are hidden unless the
 * call passes paranoid: false — the model is paranoid (src/config/sequelize.js).
 *
 * Each fixture row gets a jest.fn() update(), and snapshot() / untouched()
 * let a test assert that a pre-existing row was never written.
 */
const { Op } = require('sequelize');

function likeToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) { re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
    if (c === '%') { re += '.*'; continue; }
    if (c === '_') { re += '.'; continue; }
    re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

function matchValue(actual, cond) {
  if (cond === null || typeof cond !== 'object' || cond instanceof Date) return actual === cond;
  return Object.getOwnPropertySymbols(cond).every((op) => {
    const v = cond[op];
    if (op === Op.iLike) return typeof actual === 'string' && likeToRegExp(v).test(actual);
    if (op === Op.ne) return String(actual) !== String(v);
    if (op === Op.eq) return actual === v;
    throw new Error(`fakeSocialProfileHandles: unsupported operator ${String(op)}`);
  });
}

function matches(row, where = {}) {
  const plain = Object.keys(where).every((k) => matchValue(row[k], where[k]));
  const ops = Object.getOwnPropertySymbols(where).every((op) => {
    if (op === Op.or) return where[op].some((w) => matches(row, w));
    if (op === Op.and) return where[op].every((w) => matches(row, w));
    throw new Error(`fakeSocialProfileHandles: unsupported operator ${String(op)}`);
  });
  return plain && ops;
}

function fakeSocialProfile(fixtures = [], { rawAttributes = {} } = {}) {
  let nextId = 1000;
  const rows = fixtures.map((f) => ({ deletedAt: null, ...f }));
  for (const r of rows) r.update = jest.fn().mockResolvedValue(r);
  const originals = rows.map((r) => {
    const { update: _u, ...data } = r;
    return JSON.parse(JSON.stringify(data));
  });

  const visible = (opts = {}) => rows.filter((r) => opts.paranoid === false || !r.deletedAt);

  const model = {
    rawAttributes,
    rows,
    findOne: jest.fn(async (opts = {}) => visible(opts).find((r) => matches(r, opts.where)) || null),
    findOrCreate: jest.fn(async (opts = {}) => {
      const found = visible(opts).find((r) => matches(r, opts.where));
      if (found) return [found, false];
      return [await model.create({ ...opts.defaults, ...opts.where }), true];
    }),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(async (record) => {
      const row = { id: nextId++, deletedAt: null, ...record };
      row.update = jest.fn().mockResolvedValue(row);
      rows.push(row);
      return row;
    }),
    findByPk: jest.fn(async (id) => rows.find((r) => String(r.id) === String(id) && !r.deletedAt) || null),
    // True when every fixture row still holds exactly its original data and
    // its update() was never called.
    untouched() {
      return fixtures.every((_, i) => {
        const { update, ...data } = rows[i];
        return update.mock.calls.length === 0
          && JSON.stringify(JSON.parse(JSON.stringify(data))) === JSON.stringify(originals[i]);
      });
    },
  };
  return model;
}

module.exports = { fakeSocialProfile, likeToRegExp };
