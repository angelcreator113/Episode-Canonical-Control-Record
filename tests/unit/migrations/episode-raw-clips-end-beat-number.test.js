/**
 * 20261028120000-add-episode-raw-clips-end-beat-number (Evoni, 2026-10-28:
 * "show where a video starts and ends"): end_beat_number INTEGER NULL with a
 * 1-14 check, added once inside a transaction; down removes both once.
 */
const migration = require('../../../src/migrations/20261028120000-add-episode-raw-clips-end-beat-number');

function makeQI(columns = [], checks = []) {
  const have = new Set(columns);
  const constraints = new Set(checks);
  const transaction = jest.fn(async (fn) => fn('tx'));
  const query = jest.fn(async (sql, opts = {}) => {
    if (/information_schema\.columns/.test(sql)) return [have.has(opts.replacements.column) ? [{ '?column?': 1 }] : []];
    if (/FROM pg_constraint/.test(sql)) return [constraints.has(opts.replacements.check) ? [{ '?column?': 1 }] : []];
    const add = /ADD CONSTRAINT (\w+)/.exec(sql);
    if (add) constraints.add(add[1]);
    const drop = /DROP CONSTRAINT (\w+)/.exec(sql);
    if (drop) constraints.delete(drop[1]);
    return [[], 0];
  });
  return {
    qi: { sequelize: { query, transaction }, addColumn: jest.fn(async (_t, c) => have.add(c)), removeColumn: jest.fn(async (_t, c) => have.delete(c)) },
    have,
    constraints,
    transaction,
  };
}
const S = { INTEGER: 'INTEGER' };
const CHECK = 'episode_raw_clips_end_beat_number_range';

describe('episode_raw_clips.end_beat_number migration', () => {
  test('up adds end_beat_number INTEGER NULL and a 1-14 check, in a transaction, with no CREATE TABLE', async () => {
    const { qi, transaction, have, constraints } = makeQI(['beat_number', 'deleted_at']);
    await migration.up(qi, S);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(qi.addColumn).toHaveBeenCalledWith('episode_raw_clips', 'end_beat_number', { type: 'INTEGER', allowNull: true }, { transaction: 'tx' });
    expect(have.has('end_beat_number')).toBe(true);
    expect(constraints.has(CHECK)).toBe(true);
    const add = qi.sequelize.query.mock.calls.find(([sql]) => /ADD CONSTRAINT/.test(sql));
    expect(add[0]).toMatch(/CHECK \(end_beat_number IS NULL OR \(end_beat_number BETWEEN 1 AND 14\)\)/);
    qi.sequelize.query.mock.calls.forEach(([sql, opts]) => {
      expect(sql).not.toMatch(/CREATE TABLE/i);
      expect(opts).toMatchObject({ transaction: 'tx' });
    });
  });

  test('up twice adds the column and the check once', async () => {
    const { qi } = makeQI();
    await migration.up(qi, S);
    await migration.up(qi, S);
    expect(qi.addColumn).toHaveBeenCalledTimes(1);
    expect(qi.sequelize.query.mock.calls.filter(([sql]) => /ADD CONSTRAINT/.test(sql))).toHaveLength(1);
  });

  test('down removes only end_beat_number and its check, and twice is safe', async () => {
    const { qi, have, constraints } = makeQI(['beat_number', 'end_beat_number', 'beat_marks'], [CHECK]);
    await migration.down(qi);
    await migration.down(qi);
    expect(qi.removeColumn).toHaveBeenCalledTimes(1);
    expect(qi.removeColumn).toHaveBeenCalledWith('episode_raw_clips', 'end_beat_number', { transaction: 'tx' });
    expect(qi.sequelize.query.mock.calls.filter(([sql]) => /DROP CONSTRAINT/.test(sql))).toHaveLength(1);
    expect([...have]).toEqual(['beat_number', 'beat_marks']);
    expect(constraints.size).toBe(0);
  });
});
