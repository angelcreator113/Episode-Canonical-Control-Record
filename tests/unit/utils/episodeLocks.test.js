/**
 * A1.1 episode-first locking: the helper's rules, without a database.
 */
const {
  lockEpisodes, holdsEpisode, assertEpisodesLocked, isLockConflict, asRetryable, inTransaction,
  RetryableConflictError, LOCK_TIMEOUT,
} = require('../../../src/utils/episodeLocks');

function fakeDb() {
  const query = jest.fn(async (sql, opts) => {
    if (/FROM episodes WHERE id IN/.test(sql)) return [opts.replacements.ids.map((id) => ({ id }))];
    return [[]];
  });
  return { query, transaction: jest.fn(async (fn) => fn({ id: 'own' })) };
}

describe('lockEpisodes', () => {
  test('needs the caller\'s transaction and never opens one', async () => {
    const db = fakeDb();
    await expect(lockEpisodes(db, ['a'])).rejects.toThrow(/needs the caller's transaction/);
    await lockEpisodes(db, ['a'], { transaction: {} });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test('locks once, in id order, after SET LOCAL lock_timeout, FOR UPDATE or FOR SHARE', async () => {
    const db = fakeDb();
    const t = {};
    await lockEpisodes(db, ['c', 'a', 'b', 'a', null], { transaction: t });
    const [setLocal, lock] = db.query.mock.calls;
    expect(setLocal[0]).toBe(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
    expect(setLocal[1].transaction).toBe(t);
    expect(lock[0]).toMatch(/ORDER BY id FOR UPDATE$/);
    expect(lock[1].replacements.ids.sort()).toEqual(['a', 'b', 'c']);

    const s = {};
    await lockEpisodes(db, ['z'], { transaction: s, mode: 'share' });
    expect(db.query.mock.calls[3][0]).toMatch(/ORDER BY id FOR SHARE$/);
  });

  test('an episode the transaction holds is not locked again; share then update locks again', async () => {
    const db = fakeDb();
    const t = {};
    await lockEpisodes(db, ['a'], { transaction: t });
    const calls = db.query.mock.calls.length;
    await lockEpisodes(db, ['a'], { transaction: t });
    await lockEpisodes(db, ['a'], { transaction: t, mode: 'share' });
    expect(db.query.mock.calls.length).toBe(calls);
    expect(holdsEpisode(t, 'a')).toBe(true);

    const s = {};
    await lockEpisodes(db, ['b'], { transaction: s, mode: 'share' });
    expect(holdsEpisode(s, 'b')).toBe(false);
    expect(holdsEpisode(s, 'b', { mode: 'any' })).toBe(true);
    await lockEpisodes(db, ['b'], { transaction: s });
    expect(holdsEpisode(s, 'b')).toBe(true);
  });

  test('an unknown mode is refused', async () => {
    await expect(lockEpisodes(fakeDb(), ['a'], { transaction: {}, mode: 'exclusive' })).rejects.toThrow(/unknown mode/);
  });
});

describe('assertEpisodesLocked', () => {
  test('passes for held episodes; one found since but not locked is a retry, nothing written', async () => {
    const db = fakeDb();
    const t = {};
    await lockEpisodes(db, ['a'], { transaction: t });
    expect(() => assertEpisodesLocked(t, ['a', null])).not.toThrow();
    expect(() => assertEpisodesLocked(t, ['b'])).toThrow(RetryableConflictError);
    try { assertEpisodesLocked(t, ['b']); } catch (err) { expect(err).toMatchObject({ status: 409, code: 'SEASON_CHANGED_RETRY' }); }
  });
});

describe('lock conflicts', () => {
  const pg = (code) => Object.assign(new Error('x'), { original: { code } });
  test('a deadlock (40P01) and a lock wait timeout (55P03) are retries; other errors are themselves', () => {
    expect(isLockConflict(pg('40P01'))).toBe(true);
    expect(isLockConflict(pg('55P03'))).toBe(true);
    expect(isLockConflict(pg('23505'))).toBe(false);
    expect(asRetryable(pg('40P01'))).toMatchObject({ status: 409, code: 'RETRY' });
    const other = pg('23505');
    expect(asRetryable(other)).toBe(other);
  });
});

describe('inTransaction', () => {
  test('uses the caller\'s transaction; opens a top-level one only when there is none', async () => {
    const db = fakeDb();
    const work = jest.fn(async (t) => t);
    expect(await inTransaction(db, 'given', work)).toBe('given');
    expect(db.transaction).not.toHaveBeenCalled();
    expect(await inTransaction(db, null, work)).toEqual({ id: 'own' });
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});
