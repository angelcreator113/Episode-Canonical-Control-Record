/** 20261004180000-feed-posts-story-order: a nullable integer, added once; down removes it. */
const migration = require('../../../src/migrations/20261004180000-feed-posts-story-order');

function makeQI(columns = []) {
  const have = new Set(columns);
  const query = jest.fn(async (sql, opts = {}) => (/information_schema\.columns/.test(sql) ? [have.has(opts.replacements.column) ? [{ '?column?': 1 }] : []] : [[], 0]));
  return { qi: { sequelize: { query, transaction: async (fn) => fn('tx') }, addColumn: jest.fn(async (_t, c) => have.add(c)), removeColumn: jest.fn(async (_t, c) => have.delete(c)) }, have };
}

describe('feed_posts.story_order migration', () => {
  test('up adds a nullable integer once; down removes it', async () => {
    const { qi } = makeQI();
    await migration.up(qi, { INTEGER: 'INTEGER' });
    expect(qi.addColumn).toHaveBeenCalledWith('feed_posts', 'story_order', { type: 'INTEGER', allowNull: true }, expect.anything());
    const again = makeQI(['story_order']);
    await migration.up(again.qi, { INTEGER: 'INTEGER' });
    expect(again.qi.addColumn).not.toHaveBeenCalled();
    const down = makeQI(['story_order']);
    await migration.down(down.qi);
    expect(down.have.size).toBe(0);
  });
});
