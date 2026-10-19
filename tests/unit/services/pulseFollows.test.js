/**
 * services/pulseFollows (Evoni, 2026-10-19): a follow is one way, nobody
 * follows themselves, the feed rule never fails a crossing.
 */
const follows = require('../../../src/services/pulseFollows');

const dbWith = (query) => ({ sequelize: { query: jest.fn(query) } });

describe('pulseFollows', () => {
  test('a follow needs two different profiles and a known source', async () => {
    const db = dbWith(async () => [[{ id: 'x' }]]);
    await expect(follows.follow(db, 3, 3)).rejects.toMatchObject({ status: 400 });
    await expect(follows.follow(db, 0, 3)).rejects.toMatchObject({ status: 400 });
    await expect(follows.follow(db, 'a', 3)).rejects.toMatchObject({ status: 400 });
    await expect(follows.follow(db, 2, 3, { source: 'gossip' })).rejects.toMatchObject({ status: 400 });
    expect(db.sequelize.query).not.toHaveBeenCalled();
    await expect(follows.follow(db, 2, 3)).resolves.toEqual({ added: true });
    const [, opts] = db.sequelize.query.mock.calls[0];
    expect(opts.replacements).toMatchObject({ follower: 2, followed: 3, source: 'evoni' });
  });

  test('following again adds nothing', async () => {
    await expect(follows.follow(dbWith(async () => [[]]), 2, 3)).resolves.toEqual({ added: false });
  });

  test('the relation is one way each side; friends only when both', async () => {
    const live = new Set(['5>1']);
    const db = dbWith(async (sql, { replacements: r }) => (sql.includes('SELECT 1') ? [live.has(`${r.a}>${r.b}`) ? [{}] : []] : [[]]));
    expect(await follows.relationToLala(db, 5, 1)).toEqual({ follows_lala: true, lala_follows: false, friends: false });
    live.add('1>5');
    expect(await follows.relationToLala(db, 5, 1)).toEqual({ follows_lala: true, lala_follows: true, friends: true });
    expect(await follows.relationToLala(db, 1, 1)).toEqual({ follows_lala: false, lala_follows: false, friends: false });
    expect(await follows.relationToLala(db, 5, null)).toEqual({ follows_lala: false, lala_follows: false, friends: false });
  });

  test('the feed rule: nothing to do with no profiles, and a failure is logged, never thrown', async () => {
    const db = dbWith(async () => { throw new Error('no table'); });
    expect(await follows.followLalaFromFeed(db, [])).toBe(0);
    expect(await follows.followLalaFromFeed(db, [null, 'x'])).toBe(0);
    expect(db.sequelize.query).not.toHaveBeenCalled();
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await follows.followLalaFromFeed(db, [4])).toBe(0);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  test("Lala's friends with no Lala profile: none", async () => {
    expect(await follows.friendsOfLala(dbWith(async () => [[]]), { lalaId: null })).toEqual({ total: 0, list: [] });
  });
});
