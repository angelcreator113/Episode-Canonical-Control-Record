/**
 * 20261004120000-franchise-knowledge-scope (review item 6, 2026-10-04).
 *
 * queryInterface is a small in-memory catalog answering the statements the
 * migration issues. No database. Pins: both columns, the check constraint
 * and the index are added when absent; the backfill (show categories and
 * the Show Brain seeder's entries become 'show', then get the one show's
 * id) runs only on the first run; a re-run adds nothing and never updates.
 */
const migration = require('../../../src/migrations/20261004120000-franchise-knowledge-scope');

function makeQI({ columns = [], shows = [{ id: 7 }], showsTable = true } = {}) {
  const have = new Set(columns);
  const statements = [];
  const query = jest.fn(async (sql, opts = {}) => {
    statements.push({ sql, replacements: opts.replacements });
    const r = opts.replacements || {};
    if (/information_schema\.columns/.test(sql)) return [have.has(r.column) ? [{ '?column?': 1 }] : []];
    if (/information_schema\.tables/.test(sql)) return [showsTable ? [{ '?column?': 1 }] : []];
    if (/SELECT id FROM shows/.test(sql)) return [shows];
    return [[], 0];
  });
  const qi = {
    sequelize: { query, transaction: async (fn) => fn('tx') },
    addColumn: jest.fn(async (_t, col) => { have.add(col); }),
    removeColumn: jest.fn(async (_t, col) => { have.delete(col); }),
  };
  return { qi, statements, have };
}
const Sequelize = { STRING: (n) => `STRING(${n})`, INTEGER: 'INTEGER' };
const updates = (statements) => statements.filter((s) => /^\s*UPDATE/.test(s.sql));

describe('franchise_knowledge scope migration', () => {
  test('first run adds scope and show_id, the check and the index, then backfills', async () => {
    const { qi, statements, have } = makeQI();
    await migration.up(qi, Sequelize);
    expect(qi.addColumn).toHaveBeenCalledWith('franchise_knowledge', 'scope',
      expect.objectContaining({ allowNull: false, defaultValue: 'franchise' }), expect.anything());
    expect(qi.addColumn).toHaveBeenCalledWith('franchise_knowledge', 'show_id',
      expect.objectContaining({ allowNull: true }), expect.anything());
    expect(have.has('scope') && have.has('show_id')).toBe(true);
    expect(statements.some((s) => /ADD CONSTRAINT franchise_knowledge_scope_check CHECK \(scope IN \('franchise', 'show'\)\)/.test(s.sql))).toBe(true);
    expect(statements.some((s) => /CREATE INDEX IF NOT EXISTS franchise_knowledge_show_id/.test(s.sql))).toBe(true);

    const ups = updates(statements);
    expect(ups).toHaveLength(2);
    expect(ups[0].sql).toMatch(/SET scope = 'show'/);
    expect(ups[0].sql).toMatch(/scope = 'franchise'/);
    expect(ups[0].replacements).toEqual({ categories: ['technical', 'brand', 'locked_decision'], document: 'show-brain-v1.0' });
    expect(ups[1].sql).toMatch(/SET show_id = :id WHERE scope = 'show' AND show_id IS NULL/);
    expect(ups[1].replacements).toEqual({ id: 7 });
  });

  test('show_id is left NULL when the show is missing or ambiguous', async () => {
    for (const shows of [[], [{ id: 1 }, { id: 2 }]]) {
      const { qi, statements } = makeQI({ shows });
      await migration.up(qi, Sequelize);
      expect(updates(statements)).toHaveLength(1);
    }
    const { qi, statements } = makeQI({ showsTable: false });
    await migration.up(qi, Sequelize);
    expect(updates(statements)).toHaveLength(1);
    expect(statements.some((s) => /SELECT id FROM shows/.test(s.sql))).toBe(false);
  });

  test('a re-run adds nothing and never touches scope again', async () => {
    const { qi, statements } = makeQI({ columns: ['scope', 'show_id'] });
    await migration.up(qi, Sequelize);
    expect(qi.addColumn).not.toHaveBeenCalled();
    expect(updates(statements)).toHaveLength(0);
    expect(statements.some((s) => /ADD CONSTRAINT franchise_knowledge_scope_check/.test(s.sql))).toBe(true);
  });

  test('down removes the index, the check and both columns', async () => {
    const { qi, statements, have } = makeQI({ columns: ['scope', 'show_id'] });
    await migration.down(qi);
    expect(statements.some((s) => /DROP INDEX IF EXISTS franchise_knowledge_show_id/.test(s.sql))).toBe(true);
    expect(statements.some((s) => /DROP CONSTRAINT IF EXISTS franchise_knowledge_scope_check/.test(s.sql))).toBe(true);
    expect(have.size).toBe(0);
  });
});
