/**
 * Task #1942 — the two pending migrations that stopped sequelize-cli.
 *
 *   20260818000000-add-deleted-at-to-decision-logs.js — production never had
 *     decision_logs (docs/MIGRATION_DRIFT_READ.md §2); the unguarded
 *     addColumn failed and stopped the run.
 *   20260902000000-create-asset-roles.js — production already has
 *     asset_roles, 12 columns, no deleted_at (canon capture 2026-09-17); the
 *     unguarded createTable failed.
 *
 * queryInterface is an in-memory recording catalog, in the style of
 * tests/unit/helpers/episodeWardrobeTable.js: it answers tableExists,
 * describeTable and showIndex from its own state, applies createTable /
 * addColumn / addIndex / dropTable to that state, and throws the way
 * Postgres does on a duplicate table, column or index name. No database.
 */
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const ROOT = path.join(__dirname, '..', '..', '..');
const decisionLogs = require('../../../src/migrations/20260818000000-add-deleted-at-to-decision-logs');
const assetRoles = require('../../../src/migrations/20260902000000-create-asset-roles');

const CAPTURE = path.join(ROOT, 'docs', 'audit', 'EvidenceNote_Canon_Schema_Capture_2026-09-17.txt');

function canonColumns(table) {
  const cols = [];
  for (const line of fs.readFileSync(CAPTURE, 'utf8').split('\n')) {
    const parts = line.split('|').map((x) => x.trim());
    if (parts[0] === table && parts[1]) cols.push(parts[1]);
  }
  return cols;
}

/**
 * tables: { name: { columns: [...], indexes: [{ name, fields, unique, primary, definition }], rows } }
 */
function catalog(tables = {}) {
  const state = {};
  for (const [name, t] of Object.entries(tables)) {
    state[name] = {
      columns: new Set(t.columns || []),
      indexes: (t.indexes || []).map((ix) => ({ unique: false, primary: false, definition: '', ...ix })),
      rows: t.rows || 0,
    };
  }
  const calls = [];
  const must = (t) => {
    if (!state[t]) throw new Error(`relation "${t}" does not exist`);
    return state[t];
  };
  const qi = {
    state,
    calls,
    tableExists: jest.fn(async (t) => !!state[t]),
    describeTable: jest.fn(async (t) => Object.fromEntries([...must(t).columns].map((c) => [c, {}]))),
    showIndex: jest.fn(async (t) => must(t).indexes.map((ix) => ({
      name: ix.name,
      primary: ix.primary,
      unique: ix.unique,
      definition: ix.definition,
      fields: ix.fields.map((attribute) => ({ attribute })),
    }))),
    createTable: jest.fn(async (t, cols) => {
      calls.push({ op: 'createTable', table: t, columns: Object.keys(cols) });
      if (state[t]) throw new Error(`relation "${t}" already exists`);
      state[t] = { columns: new Set(Object.keys(cols)), indexes: [{ name: `${t}_pkey`, fields: ['id'], unique: true, primary: true, definition: '' }], rows: 0 };
    }),
    addColumn: jest.fn(async (t, c, def) => {
      calls.push({ op: 'addColumn', table: t, column: c, def });
      const s = must(t);
      if (s.columns.has(c)) throw new Error(`column "${c}" of relation "${t}" already exists`);
      s.columns.add(c);
    }),
    removeColumn: jest.fn(async (t, c) => {
      calls.push({ op: 'removeColumn', table: t, column: c });
      const s = must(t);
      if (!s.columns.has(c)) throw new Error(`column "${c}" of relation "${t}" does not exist`);
      s.columns.delete(c);
    }),
    addIndex: jest.fn(async (t, fields, opts = {}) => {
      calls.push({ op: 'addIndex', table: t, fields, name: opts.name, unique: !!opts.unique, where: opts.where });
      const s = must(t);
      for (const f of fields) if (!s.columns.has(f)) throw new Error(`column "${f}" does not exist`);
      if (opts.where) for (const f of Object.keys(opts.where)) if (!s.columns.has(f)) throw new Error(`column "${f}" does not exist`);
      if (Object.values(state).some((x) => x.indexes.some((ix) => ix.name === opts.name))) throw new Error(`relation "${opts.name}" already exists`);
      s.indexes.push({ name: opts.name, fields, unique: !!opts.unique, primary: false, definition: opts.where ? `CREATE INDEX ${opts.name} ... WHERE (deleted_at IS NULL)` : '' });
    }),
    dropTable: jest.fn(async (t) => {
      calls.push({ op: 'dropTable', table: t });
      must(t);
      delete state[t];
    }),
    sequelize: {
      transaction: jest.fn(async (cb) => cb({ id: 'tx' })),
      query: jest.fn(async (sql) => {
        calls.push({ op: 'query', sql });
        const m = /FROM "(\w+)"/.exec(sql);
        return [[{ n: m ? must(m[1]).rows : 0 }], 1];
      }),
    },
  };
  return qi;
}

const ops = (qi, op) => qi.calls.filter((c) => c.op === op);

let warn;
let log;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  log.mockRestore();
});

describe('20260818000000-add-deleted-at-to-decision-logs (Task #1942)', () => {
  const DL_COLUMNS = ['id', 'episode_id', 'scene_id', 'user_id', 'action_type', 'entity_type', 'entity_id', 'action_data', 'context_data', 'timestamp', 'created_at'];

  test('production has no decision_logs (canon capture): up skips, logs, and does not throw', async () => {
    expect(canonColumns('decision_logs')).toEqual([]);
    expect(canonColumns('decision_log').length).toBeGreaterThan(0); // the singular table is the working one

    const qi = catalog({ decision_log: { columns: canonColumns('decision_log') } });
    await expect(decisionLogs.up(qi, Sequelize)).resolves.toBeUndefined();
    expect(ops(qi, 'addColumn')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/decision_logs does not exist here/));
    // decision_log (singular) is untouched.
    expect(qi.state.decision_log.columns.has('deleted_at')).toBe(false);
  });

  test('table present without deleted_at (CI, local): adds the column, nullable, no default', async () => {
    const qi = catalog({ decision_logs: { columns: DL_COLUMNS } });
    await decisionLogs.up(qi, Sequelize);
    const adds = ops(qi, 'addColumn');
    expect(adds).toHaveLength(1);
    expect(adds[0]).toMatchObject({ table: 'decision_logs', column: 'deleted_at' });
    expect(adds[0].def.allowNull).toBe(true);
    expect(adds[0].def).not.toHaveProperty('defaultValue');
  });

  test('table present with deleted_at: nothing to do, and a second up is a no-op', async () => {
    const qi = catalog({ decision_logs: { columns: DL_COLUMNS } });
    await decisionLogs.up(qi, Sequelize);
    await expect(decisionLogs.up(qi, Sequelize)).resolves.toBeUndefined();
    expect(ops(qi, 'addColumn')).toHaveLength(1);
  });

  test('down: removes the column where it exists, and does nothing where the table is absent', async () => {
    const present = catalog({ decision_logs: { columns: [...DL_COLUMNS, 'deleted_at'] } });
    await decisionLogs.down(present);
    expect(ops(present, 'removeColumn')).toEqual([{ op: 'removeColumn', table: 'decision_logs', column: 'deleted_at' }]);

    const absent = catalog({});
    await expect(decisionLogs.down(absent)).resolves.toBeUndefined();
    expect(ops(absent, 'removeColumn')).toEqual([]);
  });
});

describe('20260902000000-create-asset-roles (Task #1942)', () => {
  const PROD_COLUMNS = canonColumns('asset_roles');
  const NAMES = ['uq_asset_roles_show_role_key', 'idx_asset_roles_show_id', 'idx_asset_roles_role_key'];

  test('the canon capture is production\'s attested shape: 12 columns, no deleted_at', () => {
    expect(PROD_COLUMNS).toHaveLength(12);
    expect(PROD_COLUMNS).not.toContain('deleted_at');
  });

  test('absent (fresh database): creates the table with deleted_at, then the three indexes', async () => {
    const qi = catalog({});
    await assetRoles.up(qi, Sequelize);
    const created = ops(qi, 'createTable');
    expect(created).toHaveLength(1);
    expect(created[0].columns.slice().sort()).toEqual([...PROD_COLUMNS, 'deleted_at'].sort());
    expect(ops(qi, 'addIndex').map((c) => c.name)).toEqual(NAMES);
    const uq = ops(qi, 'addIndex')[0];
    expect(uq).toMatchObject({ unique: true, fields: ['show_id', 'role_key'], where: { deleted_at: null } });
  });

  test('production shape, no indexes known: skips createTable, adds deleted_at, creates all three indexes', async () => {
    const qi = catalog({ asset_roles: { columns: PROD_COLUMNS, rows: 17 } });
    await expect(assetRoles.up(qi, Sequelize)).resolves.toBeUndefined();
    expect(ops(qi, 'createTable')).toEqual([]);
    expect(ops(qi, 'addColumn')).toEqual([expect.objectContaining({ table: 'asset_roles', column: 'deleted_at' })]);
    expect(ops(qi, 'addColumn')[0].def.allowNull).toBe(true);
    expect(ops(qi, 'addColumn')[0].def).not.toHaveProperty('defaultValue');
    expect(ops(qi, 'addIndex').map((c) => c.name)).toEqual(NAMES);
  });

  test('a second up against the adopted table is a no-op', async () => {
    const qi = catalog({ asset_roles: { columns: PROD_COLUMNS, rows: 17 } });
    await assetRoles.up(qi, Sequelize);
    const before = qi.calls.length;
    await expect(assetRoles.up(qi, Sequelize)).resolves.toBeUndefined();
    expect(qi.calls.slice(before)).toEqual([]);
  });

  test('partially present: equivalent indexes under other names are not duplicated', async () => {
    // What sync() / the scripts/migrations SQL would have left: a full
    // UNIQUE (show_id, role_key) under its own name, and one of the plain
    // indexes under the name this file uses.
    const qi = catalog({
      asset_roles: {
        columns: [...PROD_COLUMNS, 'deleted_at'],
        indexes: [
          { name: 'asset_roles_pkey', fields: ['id'], unique: true, primary: true },
          { name: 'asset_roles_show_id_role_key_key', fields: ['show_id', 'role_key'], unique: true },
          { name: 'idx_asset_roles_show_id', fields: ['show_id'] },
        ],
      },
    });
    await assetRoles.up(qi, Sequelize);
    expect(ops(qi, 'addColumn')).toEqual([]);
    expect(ops(qi, 'addIndex').map((c) => c.name)).toEqual(['idx_asset_roles_role_key']);
  });

  test('equivalentIndex: order, uniqueness and partial predicates all count', () => {
    const [uq, showIx, roleIx] = assetRoles.INDEXES;
    const f = (name, fields, extra = {}) => ({ name, fields: fields.map((attribute) => ({ attribute })), unique: false, primary: false, definition: '', ...extra });
    // reversed column order is a different index
    expect(assetRoles.equivalentIndex([f('x', ['role_key', 'show_id'], { unique: true })], uq)).toBeNull();
    // non-unique over the pair does not enforce uniqueness
    expect(assetRoles.equivalentIndex([f('x', ['show_id', 'role_key'])], uq)).toBeNull();
    // a partial index under another name is never taken as equivalent
    expect(assetRoles.equivalentIndex([f('x', ['show_id'], { definition: 'CREATE INDEX x ON asset_roles USING btree (show_id) WHERE (x)' })], showIx)).toBeNull();
    // a unique single-column index is not the plain one
    expect(assetRoles.equivalentIndex([f('x', ['role_key'], { unique: true })], roleIx)).toBeNull();
    // a primary key never counts
    expect(assetRoles.equivalentIndex([f('pk', ['role_key'], { primary: true })], roleIx)).toBeNull();
    // the same name always counts
    expect(assetRoles.equivalentIndex([f('idx_asset_roles_role_key', ['role_key', 'x'])], roleIx)).toMatchObject({ name: 'idx_asset_roles_role_key' });
  });

  test('down: an adopted table holding rows is not dropped; an empty one is', async () => {
    const full = catalog({ asset_roles: { columns: PROD_COLUMNS, rows: 17 } });
    await assetRoles.down(full);
    expect(ops(full, 'dropTable')).toEqual([]);
    expect(full.state.asset_roles).toBeDefined();

    const empty = catalog({});
    await assetRoles.up(empty, Sequelize);
    await assetRoles.down(empty);
    expect(ops(empty, 'dropTable')).toEqual([{ op: 'dropTable', table: 'asset_roles' }]);
  });

  test('AssetRole never names deleted_at, so the model is right as it is against either shape', () => {
    // The app's global define (src/config/sequelize.js `define`).
    const sequelize = new Sequelize.Sequelize('postgres://unused:unused@127.0.0.1:1/unused', {
      logging: false,
      define: { underscored: true, timestamps: true, paranoid: true, freezeTableName: true },
    });
    const AssetRole = require('../../../src/models/AssetRole')(sequelize);
    const fields = Object.values(AssetRole.rawAttributes).map((a) => a.field);
    expect(fields.sort()).toEqual(PROD_COLUMNS.slice().sort());
    // timestamps: false switches paranoid off: no deleted_at predicate.
    const opts = AssetRole._paranoidClause(AssetRole, { where: { role_key: 'HOST' } });
    expect(JSON.stringify(opts.where)).not.toMatch(/deleted_at/);
  });
});
