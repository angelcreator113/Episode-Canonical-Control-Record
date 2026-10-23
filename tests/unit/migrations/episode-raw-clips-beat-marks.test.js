/**
 * 20261023210000-add-episode-raw-clips-beat-marks ("Record whole episode",
 * 2026-10-23): beat_marks JSONB NULL, added once inside a transaction;
 * down removes it once.
 */
const migration = require('../../../src/migrations/20261023210000-add-episode-raw-clips-beat-marks');

function makeQI(columns = []) {
  const have = new Set(columns);
  const transaction = jest.fn(async (fn) => fn('tx'));
  const query = jest.fn(async (sql, opts = {}) => (/information_schema\.columns/.test(sql) ? [have.has(opts.replacements.column) ? [{ '?column?': 1 }] : []] : [[], 0]));
  return {
    qi: { sequelize: { query, transaction }, addColumn: jest.fn(async (_t, c) => have.add(c)), removeColumn: jest.fn(async (_t, c) => have.delete(c)) },
    have,
    transaction,
  };
}
const S = { JSONB: 'JSONB' };

describe('episode_raw_clips.beat_marks migration', () => {
  test('up adds beat_marks JSONB NULL in a transaction, with no CREATE TABLE', async () => {
    const { qi, transaction, have } = makeQI(['is_favorite']);
    await migration.up(qi, S);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(qi.addColumn).toHaveBeenCalledWith('episode_raw_clips', 'beat_marks', { type: 'JSONB', allowNull: true }, { transaction: 'tx' });
    expect(have.has('beat_marks')).toBe(true);
    qi.sequelize.query.mock.calls.forEach(([sql, opts]) => {
      expect(sql).not.toMatch(/CREATE TABLE/i);
      expect(opts).toMatchObject({ replacements: { table: 'episode_raw_clips', column: 'beat_marks' }, transaction: 'tx' });
    });
  });

  test('up twice adds it once', async () => {
    const { qi } = makeQI();
    await migration.up(qi, S);
    await migration.up(qi, S);
    expect(qi.addColumn).toHaveBeenCalledTimes(1);
  });

  test('down removes only beat_marks, and twice is safe', async () => {
    const { qi, have } = makeQI(['beat_marks', 'is_favorite', 'start_line']);
    await migration.down(qi);
    await migration.down(qi);
    expect(qi.removeColumn).toHaveBeenCalledTimes(1);
    expect(qi.removeColumn).toHaveBeenCalledWith('episode_raw_clips', 'beat_marks', { transaction: 'tx' });
    expect([...have]).toEqual(['is_favorite', 'start_line']);
  });
});
