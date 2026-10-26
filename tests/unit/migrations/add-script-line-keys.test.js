/**
 * 20261026190000-add-script-line-keys (architecture A1b). queryInterface is
 * a recorder over a pretend schema; no database. Pins: both columns are
 * added nullable JSONB with no default, each only when absent; nothing is
 * added when episode_script_versions (20261015100000) is missing; down drops
 * exactly the two columns and nothing else.
 */
const migration = require('../../../src/migrations/20261026190000-add-script-line-keys');

const Sequelize = { JSONB: 'JSONB' };

function makeQI({ tables = ['episodes', 'episode_script_versions'], columns = [] } = {}) {
  const schema = { tables: new Set(tables), columns: new Set(columns) };
  const calls = [];
  const query = jest.fn(async (sql, { replacements }) => {
    if (/information_schema\.tables/.test(sql)) return [schema.tables.has(replacements.table) ? [{ '?column?': 1 }] : []];
    if (/information_schema\.columns/.test(sql)) return [schema.columns.has(`${replacements.table}.${replacements.column}`) ? [{ '?column?': 1 }] : []];
    throw new Error(`unexpected query: ${sql}`);
  });
  const qi = {
    sequelize: { query, transaction: async (fn) => fn('tx') },
    addColumn: jest.fn(async (table, column, spec, opts) => { calls.push(['add', table, column, spec, opts]); schema.columns.add(`${table}.${column}`); }),
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

  test('up adds only a column that is absent, and twice is the same as once', async () => {
    const { qi, calls } = makeQI({ columns: ['episodes.script_line_keys'] });
    await migration.up(qi, Sequelize);
    expect(calls.map((c) => c.slice(0, 3))).toEqual([['add', 'episode_script_versions', 'script_line_keys']]);
    await migration.up(qi, Sequelize);
    expect(calls).toHaveLength(1);
  });

  test('up refuses, adding nothing, when episode_script_versions (20261015100000) is missing', async () => {
    const { qi, calls } = makeQI({ tables: ['episodes'] });
    await expect(migration.up(qi, Sequelize)).rejects.toThrow('episode_script_versions does not exist; 20261015100000-create-episode-script-versions must have run first');
    expect(calls).toEqual([]);
  });

  test('down drops exactly the two columns; up after down restores them', async () => {
    const { qi, calls, schema } = makeQI({ columns: ['episodes.script_line_keys', 'episode_script_versions.script_line_keys', 'episodes.script_content'] });
    await migration.down(qi);
    expect(calls).toEqual([
      ['remove', 'episodes', 'script_line_keys', { transaction: 'tx' }],
      ['remove', 'episode_script_versions', 'script_line_keys', { transaction: 'tx' }],
    ]);
    expect([...schema.columns]).toEqual(['episodes.script_content']);
    await migration.up(qi, Sequelize);
    expect([...schema.columns].sort()).toEqual(['episode_script_versions.script_line_keys', 'episodes.script_content', 'episodes.script_line_keys']);
  });

  test('down skips a column or table that is not there', async () => {
    const { qi, calls } = makeQI({ tables: ['episodes'], columns: [] });
    await migration.down(qi);
    expect(calls).toEqual([]);
  });
});
