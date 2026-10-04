/**
 * 20261004150000-feed-posts-status (the Feed project, step 2). A recorder
 * stands in for queryInterface; no database. Pins: the column is added
 * once, NOT NULL default 'live' (every existing post is on the feed), with
 * the two-value check and the live-by-show index; a re-run adds nothing;
 * down removes all three.
 */
const migration = require('../../../src/migrations/20261004150000-feed-posts-status');

function makeQI(columns = []) {
  const have = new Set(columns);
  const statements = [];
  const query = jest.fn(async (sql, opts = {}) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());
    if (/information_schema\.columns/.test(sql)) return [have.has(opts.replacements.column) ? [{ '?column?': 1 }] : []];
    return [[], 0];
  });
  return {
    qi: { sequelize: { query, transaction: async (fn) => fn('tx') }, addColumn: jest.fn(async (_t, c) => have.add(c)), removeColumn: jest.fn(async (_t, c) => have.delete(c)) },
    statements, have,
  };
}
const Sequelize = { STRING: (n) => `STRING(${n})` };

describe('feed_posts.status migration', () => {
  test('up adds the column with default live, the check and the index', async () => {
    const { qi, statements } = makeQI();
    await migration.up(qi, Sequelize);
    expect(qi.addColumn).toHaveBeenCalledWith('feed_posts', 'status', { type: 'STRING(16)', allowNull: false, defaultValue: 'live' }, expect.anything());
    expect(statements.some((s) => /ADD CONSTRAINT feed_posts_status_check CHECK \(status IN \('draft', 'live'\)\)/.test(s))).toBe(true);
    expect(statements.some((s) => /CREATE INDEX IF NOT EXISTS feed_posts_show_status ON feed_posts \(show_id, status\) WHERE deleted_at IS NULL/.test(s))).toBe(true);
  });
  test('a re-run adds nothing', async () => {
    const { qi } = makeQI(['status']);
    await migration.up(qi, Sequelize);
    expect(qi.addColumn).not.toHaveBeenCalled();
  });
  test('down removes the index, the check and the column', async () => {
    const { qi, statements, have } = makeQI(['status']);
    await migration.down(qi);
    expect(statements.some((s) => /DROP INDEX IF EXISTS feed_posts_show_status/.test(s))).toBe(true);
    expect(statements.some((s) => /DROP CONSTRAINT IF EXISTS feed_posts_status_check/.test(s))).toBe(true);
    expect(have.size).toBe(0);
  });
});
