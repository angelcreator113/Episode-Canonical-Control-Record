/**
 * episode_wardrobe as production has it, after the live migrations
 * (Task #1924). No database.
 *
 * Start: the table's columns in the canon capture
 * (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt), the 11
 * columns Evoni's production read attested on 2026-09-25. Then every
 * src/migrations file that names 'episode_wardrobe' is run (up) against a
 * recording query interface, which applies its addColumn / removeColumn to
 * that column set. What is left is the table the code meets once those
 * migrations have run.
 *
 * tableCheckedEpisodeWardrobe() is a fake of the EpisodeWardrobe model
 * that behaves like the real one against that table: Sequelize names every
 * declared field in each SELECT, INSERT ... RETURNING and UPDATE it
 * generates, so any declared field the table lacks makes the call throw
 * `column "x" does not exist`, as every EpisodeWardrobe query did in
 * production before #1924. Rows live in memory; paranoid reads skip rows
 * with deleted_at when the model is paranoid; the table's unique
 * (episode_id, wardrobe_id) pair is enforced.
 */
const fs = require('fs');
const path = require('path');
const { loadModel } = require('./schemaCheckedModel');

const ROOT = path.join(__dirname, '..', '..', '..');
const CAPTURE = path.join(ROOT, 'docs', 'audit', 'EvidenceNote_Canon_Schema_Capture_2026-09-17.txt');
const MIGRATIONS = path.join(ROOT, 'src', 'migrations');
const TABLE = 'episode_wardrobe';

function canonColumns(table = TABLE) {
  const cols = [];
  for (const line of fs.readFileSync(CAPTURE, 'utf8').split('\n')) {
    const parts = line.split('|').map((x) => x.trim());
    if (parts[0] === table && parts[1]) cols.push(parts[1]);
  }
  return cols;
}

/** A recording query interface over a column set. */
function recordingQueryInterface(columns, { tableExists = true } = {}) {
  const cols = new Set(columns);
  const calls = [];
  const qi = {
    calls,
    cols,
    tableExists: jest.fn(async (t) => t === TABLE && tableExists),
    describeTable: jest.fn(async (t) => {
      if (t !== TABLE) throw new Error(`describeTable ${t}: not this table`);
      return Object.fromEntries([...cols].map((c) => [c, {}]));
    }),
    addColumn: jest.fn(async (t, c, def) => {
      calls.push({ op: 'addColumn', table: t, column: c, def });
      if (t !== TABLE) return;
      if (cols.has(c)) throw new Error(`column "${c}" of relation "${t}" already exists`);
      cols.add(c);
    }),
    removeColumn: jest.fn(async (t, c) => {
      calls.push({ op: 'removeColumn', table: t, column: c });
      if (t === TABLE) cols.delete(c);
    }),
    sequelize: {
      query: jest.fn(async (sql) => { calls.push({ op: 'query', sql }); return [[], 0]; }),
      transaction: jest.fn(async (cb) => cb({ id: 'tx' })),
    },
  };
  return qi;
}

/** The src/migrations files that name the table, in run order. */
function tableMigrations() {
  return fs.readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .filter((f) => /['"`]episode_wardrobe['"`]/.test(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')));
}

/** Columns of episode_wardrobe after every live migration that names it. */
async function postMigrationColumns() {
  const qi = recordingQueryInterface(canonColumns());
  for (const f of tableMigrations()) {
    await require(path.join(MIGRATIONS, f)).up(qi, require('sequelize'));
  }
  return new Set(qi.cols);
}

function tableCheckedEpisodeWardrobe(tableColumns) {
  const Model = loadModel('EpisodeWardrobe');
  const fields = Object.values(Model.rawAttributes).map((a) => a.field);
  const paranoid = !!Model.options.paranoid;
  const deletedAt = paranoid ? Model.rawAttributes[Model._timestampAttributes.deletedAt].field : null;
  const rows = [];
  let seq = 0;

  const touchTable = () => {
    for (const f of fields) if (!tableColumns.has(f)) throw new Error(`column "${f}" does not exist`);
  };
  const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => row[k] === v);
  const visible = (row, opts = {}) => !paranoid || opts.paranoid === false || row[deletedAt] == null;

  const wrap = (row) => {
    if (row.restore) return row;
    Object.defineProperties(row, {
      update: { value: jest.fn(async (values) => { touchTable(); Object.assign(row, values); return row; }) },
      restore: { value: jest.fn(async () => { touchTable(); if (!paranoid) throw new Error('Model is not paranoid'); row[deletedAt] = null; return row; }) },
      toJSON: { value: () => ({ ...row }) },
    });
    return row;
  };

  const fake = {
    Model,
    rows,
    findOne: jest.fn(async (opts = {}) => {
      touchTable();
      const r = rows.find((x) => visible(x, opts) && matches(x, opts.where));
      return r || null;
    }),
    findAll: jest.fn(async (opts = {}) => { touchTable(); return rows.filter((x) => visible(x, opts) && matches(x, opts.where)); }),
    create: jest.fn(async (values) => {
      touchTable();
      for (const k of Object.keys(values)) if (!tableColumns.has(k)) throw new Error(`column "${k}" does not exist`);
      if (rows.some((x) => x.episode_id === values.episode_id && x.wardrobe_id === values.wardrobe_id)) {
        throw new Error('duplicate key value violates unique constraint "unique_episode_wardrobe"');
      }
      const defaults = {};
      for (const [name, a] of Object.entries(Model.rawAttributes)) {
        if (a.defaultValue !== undefined && typeof a.defaultValue !== 'object' && typeof a.defaultValue !== 'function') defaults[name] = a.defaultValue;
      }
      const row = wrap({ id: `ew-${++seq}`, ...defaults, ...(deletedAt ? { [deletedAt]: null } : {}), ...values });
      rows.push(row);
      return row;
    }),
    destroy: jest.fn(async (opts = {}) => {
      touchTable();
      const hit = rows.filter((x) => visible(x) && matches(x, opts.where));
      for (const r of hit) {
        if (paranoid) r[deletedAt] = new Date();
        else rows.splice(rows.indexOf(r), 1);
      }
      return hit.length;
    }),
    // Sequelize's findOrCreate: a paranoid find, then a create.
    findOrCreate: jest.fn(async ({ where, defaults = {} }) => {
      const found = await fake.findOne({ where });
      if (found) return [found, false];
      return [await fake.create({ ...where, ...defaults }), true];
    }),
    seed(row) { const r = wrap({ id: `ew-${++seq}`, ...(deletedAt ? { [deletedAt]: null } : {}), ...row }); rows.push(r); return r; },
  };
  return fake;
}

module.exports = {
  TABLE,
  canonColumns,
  recordingQueryInterface,
  tableMigrations,
  postMigrationColumns,
  tableCheckedEpisodeWardrobe,
};
