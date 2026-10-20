/**
 * 20261020090000-add-episode-raw-clips-favorite-start-line (Teleprompter
 * batch 2): is_favorite BOOLEAN NOT NULL DEFAULT false and start_line
 * INTEGER NULL, each added once inside a transaction; down removes each.
 */
const migration = require('../../../src/migrations/20261020090000-add-episode-raw-clips-favorite-start-line');

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
const S = { BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER' };

describe('episode_raw_clips.is_favorite / start_line migration', () => {
  test('up adds both columns with their types, in a transaction', async () => {
    const { qi, transaction } = makeQI();
    await migration.up(qi, S);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(qi.addColumn).toHaveBeenCalledWith('episode_raw_clips', 'is_favorite', { type: 'BOOLEAN', allowNull: false, defaultValue: false }, { transaction: 'tx' });
    expect(qi.addColumn).toHaveBeenCalledWith('episode_raw_clips', 'start_line', { type: 'INTEGER', allowNull: true }, { transaction: 'tx' });
    qi.sequelize.query.mock.calls.forEach(([sql, opts]) => {
      expect(sql).not.toMatch(/CREATE TABLE/i);
      expect(opts.replacements.table).toBe('episode_raw_clips');
    });
  });

  test('up is idempotent: present columns are not added again; a half-run adds only the missing one', async () => {
    const both = makeQI(['is_favorite', 'start_line']);
    await migration.up(both.qi, S);
    expect(both.qi.addColumn).not.toHaveBeenCalled();
    const half = makeQI(['is_favorite']);
    await migration.up(half.qi, S);
    expect(half.qi.addColumn).toHaveBeenCalledTimes(1);
    expect(half.qi.addColumn.mock.calls[0][1]).toBe('start_line');
  });

  test('down removes both, and does nothing when they are gone', async () => {
    const { qi, have } = makeQI(['is_favorite', 'start_line', 'beat_number']);
    await migration.down(qi);
    expect([...have]).toEqual(['beat_number']);
    const gone = makeQI([]);
    await migration.down(gone.qi);
    expect(gone.qi.removeColumn).not.toHaveBeenCalled();
  });
});
