/**
 * 20261026190000-add-script-line-keys (architecture A1b). queryInterface is
 * a recorder over a pretend schema; no database. Pins: both columns are
 * added nullable JSONB with no default, each only when absent; an existing
 * column must be nullable JSONB, and any other definition on either table
 * refuses before anything is added; nothing is added when either table is
 * missing (episode_script_versions comes from 20261015100000); down drops
 * exactly the two columns and nothing else.
 */
const migration = require('../../../src/migrations/20261026190000-add-script-line-keys');

const Sequelize = { JSONB: 'JSONB' };
const JSONB_NULL = { data_type: 'jsonb', is_nullable: 'YES' };

// columns: 'table.column' (nullable jsonb) or ['table.column', { data_type, is_nullable }].
function makeQI({ tables = ['episodes', 'episode_script_versions'], columns = [] } = {}) {
  const schema = {
    tables: new Set(tables),
    columns: new Map(columns.map((c) => (Array.isArray(c) ? c : [c, JSONB_NULL]))),
  };
  const calls = [];
  const query = jest.fn(async (sql, { replacements }) => {
    if (/information_schema\.tables/.test(sql)) return [schema.tables.has(replacements.table) ? [{ '?column?': 1 }] : []];
    if (/information_schema\.columns/.test(sql)) {
      const def = schema.columns.get(`${replacements.table}.${replacements.column}`);
      return [def ? [def] : []];
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  const qi = {
    sequelize: { query, transaction: async (fn) => fn('tx') },
    addColumn: jest.fn(async (table, column, spec, opts) => { calls.push(['add', table, column, spec, opts]); schema.columns.set(`${table}.${column}`, JSONB_NULL); }),
    removeColumn: jest.fn(async (table, column, opts) => { calls.push(['remove', table, column, opts]); schema.columns.delete(`${table}.${column}`); }),
  };
  return { qi, calls, schema };
}

describe('script_line_keys migration', () => {
  test('up adds both columns, nullable JSONB with no default, in its transaction', async () => {
    const { qi, calls } = makeQI();
    await migration.up(qi, Sequelize);
    expect(calls).toEqual([
      ['add', 'episodes', 'script_line_keys', { type: 'JSONB', allowNull: true }, { transaction: 'tx' }],
      ['add', 'episode_script_versions', 'script_line_keys', { type: 'JSONB', allowNull: true }, { transaction: 'tx' }],
    ]);
  });

  test('up adds only a column that is absent, keeps an existing nullable JSONB one, and twice is the same as once', async () => {
    const { qi, calls } = makeQI({ columns: ['episodes.script_line_keys'] });
    await migration.up(qi, Sequelize);
    expect(calls.map((c) => c.slice(0, 3))).toEqual([['add', 'episode_script_versions', 'script_line_keys']]);
    await migration.up(qi, Sequelize);
    expect(calls).toHaveLength(1);
  });

  test.each([
    ['episodes', { data_type: 'text', is_nullable: 'YES' }, 'episodes.script_line_keys already exists as text NULL; expected jsonb NULL. Nothing was changed.'],
    ['episodes', { data_type: 'jsonb', is_nullable: 'NO' }, 'episodes.script_line_keys already exists as jsonb NOT NULL; expected jsonb NULL. Nothing was changed.'],
    ['episode_script_versions', { data_type: 'json', is_nullable: 'YES' }, 'episode_script_versions.script_line_keys already exists as json NULL; expected jsonb NULL. Nothing was changed.'],
  ])('up refuses, adding nothing on either table, when %s already has it as %o', async (table, def, message) => {
    const { qi, calls, schema } = makeQI({ columns: [[`${table}.script_line_keys`, def]] });
    await expect(migration.up(qi, Sequelize)).rejects.toThrow(message);
    expect(calls).toEqual([]);
    expect(schema.columns.get(`${table}.script_line_keys`)).toEqual(def);
  });

  test('up refuses, adding nothing, when episode_script_versions (20261015100000) is missing', async () => {
    const { qi, calls } = makeQI({ tables: ['episodes'] });
    await expect(migration.up(qi, Sequelize)).rejects.toThrow('episode_script_versions does not exist; 20261015100000-create-episode-script-versions must have run first');
    expect(calls).toEqual([]);
  });

  test('up refuses, adding nothing, when episodes is missing', async () => {
    const { qi, calls } = makeQI({ tables: ['episode_script_versions'] });
    await expect(migration.up(qi, Sequelize)).rejects.toThrow('20261026190000: table episodes does not exist');
    expect(calls).toEqual([]);
  });

  test('down drops exactly the two columns; up after down restores them', async () => {
    const { qi, calls, schema } = makeQI({ columns: ['episodes.script_line_keys', 'episode_script_versions.script_line_keys', 'episodes.script_content'] });
    await migration.down(qi);
    expect(calls).toEqual([
      ['remove', 'episodes', 'script_line_keys', { transaction: 'tx' }],
      ['remove', 'episode_script_versions', 'script_line_keys', { transaction: 'tx' }],
    ]);
    expect([...schema.columns.keys()]).toEqual(['episodes.script_content']);
    await migration.up(qi, Sequelize);
    expect([...schema.columns.keys()].sort()).toEqual(['episode_script_versions.script_line_keys', 'episodes.script_content', 'episodes.script_line_keys']);
  });

  test('down skips a column or table that is not there', async () => {
    const { qi, calls } = makeQI({ tables: ['episodes'], columns: [] });
    await migration.down(qi);
    expect(calls).toEqual([]);
  });
});
