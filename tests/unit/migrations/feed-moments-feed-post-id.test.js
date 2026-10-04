/**
 * 20261004160000-feed-moments-feed-post-id (the Feed project, step 3).
 * A recorder stands in for queryInterface; no database.
 */
const migration = require('../../../src/migrations/20261004160000-feed-moments-feed-post-id');

function makeQI(columns = []) {
  const have = new Set(columns);
  const statements = [];
  const query = jest.fn(async (sql, opts = {}) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());
    if (/information_schema\.columns/.test(sql)) return [have.has(opts.replacements.column) ? [{ '?column?': 1 }] : []];
    return [[], 0];
  });
  return { qi: { sequelize: { query, transaction: async (fn) => fn('tx') }, addColumn: jest.fn(async (_t, c) => have.add(c)), removeColumn: jest.fn(async (_t, c) => have.delete(c)) }, statements, have };
}
const Sequelize = { UUID: 'UUID' };

describe('feed_moments.feed_post_id migration', () => {
  test('up adds a nullable UUID column and the partial index', async () => {
    const { qi, statements } = makeQI();
    await migration.up(qi, Sequelize);
    expect(qi.addColumn).toHaveBeenCalledWith('feed_moments', 'feed_post_id', { type: 'UUID', allowNull: true }, expect.anything());
    expect(statements.some((s) => /CREATE INDEX IF NOT EXISTS feed_moments_feed_post_id ON feed_moments \(feed_post_id\) WHERE feed_post_id IS NOT NULL/.test(s))).toBe(true);
  });
  test('a re-run adds nothing; down removes the index and the column', async () => {
    const again = makeQI(['feed_post_id']);
    await migration.up(again.qi, Sequelize);
    expect(again.qi.addColumn).not.toHaveBeenCalled();
    const { qi, statements, have } = makeQI(['feed_post_id']);
    await migration.down(qi);
    expect(statements.some((s) => /DROP INDEX IF EXISTS feed_moments_feed_post_id/.test(s))).toBe(true);
    expect(have.size).toBe(0);
  });
});
