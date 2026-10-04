/**
 * 20261004170000-create-feed-comments (the Feed project, step 4). A
 * recorder stands in for queryInterface; no database.
 */
const migration = require('../../../src/migrations/20261004170000-create-feed-comments');

function makeQI(exists = false) {
  const statements = [];
  const query = jest.fn(async (sql) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());
    if (/to_regclass/.test(sql)) return [[{ reg: exists ? 'feed_comments' : null }]];
    return [[], 0];
  });
  return { qi: { sequelize: { query, transaction: async (fn) => fn('tx') }, createTable: jest.fn(async () => {}), dropTable: jest.fn(async () => {}) }, statements };
}
const Sequelize = { UUID: 'UUID', INTEGER: 'INTEGER', STRING: (n) => `STRING(${n})`, TEXT: 'TEXT', DATE: 'DATE', BOOLEAN: 'BOOLEAN', literal: (s) => `literal(${s})` };

describe('feed_comments migration', () => {
  test('up creates the table with deleted_at, the status check and the post index', async () => {
    const { qi, statements } = makeQI(false);
    await migration.up(qi, Sequelize);
    expect(qi.createTable).toHaveBeenCalledTimes(1);
    const [name, cols] = qi.createTable.mock.calls[0];
    expect(name).toBe('feed_comments');
    expect(Object.keys(cols)).toEqual(expect.arrayContaining(['id', 'feed_post_id', 'show_id', 'social_profile_id', 'handle', 'text', 'status', 'posted_at', 'sort_order', 'ai_generated', 'generation_model', 'voice_note', 'deleted_at']));
    expect(cols.status).toEqual({ type: 'STRING(16)', allowNull: false, defaultValue: 'draft' });
    expect(cols.handle.allowNull).toBe(false);
    expect(statements.some((s) => /ADD CONSTRAINT feed_comments_status_check CHECK \(status IN \('draft', 'live'\)\)/.test(s))).toBe(true);
    expect(statements.some((s) => /CREATE INDEX IF NOT EXISTS feed_comments_post ON feed_comments \(feed_post_id, status\) WHERE deleted_at IS NULL/.test(s))).toBe(true);
  });
  test('up is a no-op when the table exists; down drops it', async () => {
    const again = makeQI(true);
    await migration.up(again.qi, Sequelize);
    expect(again.qi.createTable).not.toHaveBeenCalled();
    const { qi } = makeQI(true);
    await migration.down(qi);
    expect(qi.dropTable).toHaveBeenCalledWith('feed_comments');
  });
});
